import { Router, type IRouter } from "express";
import { and, eq, gt, gte, inArray, isNull, or } from "drizzle-orm";
import {
  activityTable,
  auditLogTable,
  buyerRequestsTable,
  buyersTable,
  collaborationMatchRequestsTable,
  db,
  documentsTable,
  leadTimelineTable,
  leadsTable,
  listingHousekeepingDeliveriesTable,
  listingHousekeepingEventsTable,
  listingHousekeepingPreferencesTable,
  notificationsTable,
  passwordResetTokensTable,
  priceHistoryTable,
  propertiesTable,
  savedPropertiesTable,
  tasksTable,
  usersTable,
  viewingsTable,
} from "@workspace/db";
import {
  CompleteAgentSetupBody,
  CompleteAgentSetupResponse,
  CompleteAdminPasswordResetBody,
  CompleteAdminPasswordResetResponse,
  DeleteCurrentUserAccountBody,
  DeleteCurrentUserAccountResponse,
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
  RequestAdminPasswordResetBody,
  RequestAdminPasswordResetResponse,
  UpdateCurrentUserProfileBody,
  UpdateCurrentUserProfileResponse,
} from "@workspace/api-zod";
import { logAudit, jsonify } from "../lib/helpers";
import {
  ADMIN_PASSWORD_RESET_COOLDOWN_MS,
  ADMIN_PASSWORD_RESET_TTL_MS,
  ADMIN_RECOVERY_COMPLETED_AUDIT_ACTION,
  ADMIN_RECOVERY_COOLDOWN_MS,
  hashAgentSetupToken,
  createAdminPasswordResetToken,
  getAdminPasswordResetBaseUrl,
  hashAdminPasswordResetToken,
  matchesAdminRecoveryEmail,
  meetsAdminPasswordPolicy,
} from "../lib/password-reset";
import {
  ADMIN_RECOVERY_DEACTIVATE_EMAILS,
  getOrCreateAdminRecoveryUser,
} from "../lib/admin-recovery";
import {
  checkAdminPasswordResetEmailReadiness,
  sendAdminPasswordResetEmail,
} from "../lib/housekeeping-delivery";
import { hashPassword, isScryptHash, verifyPassword } from "../lib/passwords";
import {
  createSessionToken,
  readSessionToken,
  SESSION_TOKEN_TTL_SECONDS,
} from "../lib/sessions";

const router: IRouter = Router();

const COOKIE = "qp_uid";
const PHONE_LOGIN_ROLES = new Set(["agent", "senior_agent", "principal", "admin"]);

function normalizePhoneNumber(value: string): string | null {
  const compact = value.trim().replace(/[^\d+]/g, "");
  let e164 = compact;
  if (compact.startsWith("0")) e164 = `+263${compact.slice(1)}`;
  else if (compact.startsWith("263")) e164 = `+${compact}`;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  return e164;
}

function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

async function requestTwilioVerify(path: "Verifications" | "VerificationCheck", values: Record<string, string>) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) throw new Error("Twilio Verify is not configured");
  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
  });
  const result = await response.json().catch(() => null) as { status?: string; message?: string } | null;
  if (!response.ok) {
    console.error("Twilio Verify request failed", { status: response.status, message: result?.message });
    throw new Error("Twilio Verify request failed");
  }
  return result;
}

async function findPhoneLoginUser(phone: string) {
  const digits = phoneDigits(phone);
  const users = await db.select().from(usersTable).where(eq(usersTable.status, "active"));
  const matches = users.filter((user) =>
    PHONE_LOGIN_ROLES.has(user.role) && phoneDigits(user.phone) === digits,
  );
  return matches.length === 1 ? matches[0] : null;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters to issue bearer sessions.");
  }
  return secret;
}

function userIdFromBearerToken(authorization: string | string[] | undefined): number | null {
  if (typeof authorization !== "string") return null;
  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra.length > 0) return null;
  return readSessionToken(token, sessionSecret());
}

router.post("/auth/phone/start", async (req, res): Promise<void> => {
  const phone = typeof req.body?.phone === "string" ? normalizePhoneNumber(req.body.phone) : null;
  if (!phone) { res.status(400).json({ error: "Enter a valid mobile number in international format." }); return; }
  try {
    const user = await findPhoneLoginUser(phone);
    if (user) await requestTwilioVerify("Verifications", { To: phone, Channel: "sms" });
    res.status(202).json({ message: "If the number belongs to an active QuickProp account, a code has been sent." });
  } catch (error) {
    console.error("Unable to start phone sign-in", error);
    res.status(503).json({ error: "Phone sign-in is temporarily unavailable." });
  }
});

router.post("/auth/phone/verify", async (req, res): Promise<void> => {
  const phone = typeof req.body?.phone === "string" ? normalizePhoneNumber(req.body.phone) : null;
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!phone || !/^\d{4,10}$/.test(code)) {
    res.status(400).json({ error: "Enter the mobile number and verification code." });
    return;
  }
  try {
    const result = await requestTwilioVerify("VerificationCheck", { To: phone, Code: code });
    if (result?.status !== "approved") { res.status(401).json({ error: "That verification code is invalid or expired." }); return; }
    const user = await findPhoneLoginUser(phone);
    if (!user) { res.status(401).json({ error: "This number is not linked to an eligible QuickProp account." }); return; }
    const accessToken = createSessionToken(user.id, sessionSecret());
    await logAudit("login", "user", user.id, `${user.name} signed in with verified phone`, user.id, user.name);
    res.json({ ...jsonify(toUser(user)), accessToken });
  } catch (error) {
    console.error("Unable to verify phone sign-in", error);
    res.status(503).json({ error: "Phone sign-in is temporarily unavailable." });
  }
});

function toUser(u: typeof usersTable.$inferSelect) {
  const { password: _pw, createdAt: _c, ...rest } = u;
  return rest;
}

router.post("/auth/password-reset/request", async (req, res): Promise<void> => {
  const parsed = RequestAdminPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const baseUrl = getAdminPasswordResetBaseUrl({
    runtimeEnvironment: process.env.NODE_ENV,
    developmentDomain: process.env.REPLIT_DEV_DOMAIN,
    productionBaseUrl: process.env.QUICKPROP_ADMIN_BASE_URL,
  });
  const emailReadiness = await checkAdminPasswordResetEmailReadiness();
  if (!emailReadiness.ready || !baseUrl) {
    res.status(503).json({ error: "Password reset email is currently unavailable. Contact a QuickProp administrator." });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const genericResponse = RequestAdminPasswordResetResponse.parse({ ok: true });
  let user: typeof usersTable.$inferSelect | undefined;
  let isRecoveryRequest = false;

  if (matchesAdminRecoveryEmail(email, process.env.QUICKPROP_ADMIN_RECOVERY_EMAIL)) {
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    let recoveryAlreadyCompleted = false;
    if (existingUser) {
      const [completedRecovery] = await db
        .select({ id: auditLogTable.id })
        .from(auditLogTable)
        .where(and(
          eq(auditLogTable.action, ADMIN_RECOVERY_COMPLETED_AUDIT_ACTION),
          eq(auditLogTable.entityType, "user"),
          eq(auditLogTable.entityId, existingUser.id),
        ))
        .limit(1);
      recoveryAlreadyCompleted = Boolean(completedRecovery);
    }
    if (!recoveryAlreadyCompleted) {
      user = existingUser ?? await getOrCreateAdminRecoveryUser(email) ?? undefined;
      isRecoveryRequest = Boolean(user);
    }
  }

  if (!user) {
    const [activeAdmin] = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.email, email),
        eq(usersTable.status, "active"),
        inArray(usersTable.role, ["principal", "admin"]),
      ))
      .limit(1);
    user = activeAdmin;
  }

  if (!user) {
    res.json(genericResponse);
    return;
  }

  const issuedReset = await db.transaction(async (tx) => {
    const [lockedUser] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user!.id))
      .limit(1)
      .for("update");
    if (!lockedUser) return null;

    const recoveryEligible = isRecoveryRequest
      && matchesAdminRecoveryEmail(lockedUser.email, process.env.QUICKPROP_ADMIN_RECOVERY_EMAIL);
    if (recoveryEligible) {
      const [completedRecovery] = await tx
        .select({ id: auditLogTable.id })
        .from(auditLogTable)
        .where(and(
          eq(auditLogTable.action, ADMIN_RECOVERY_COMPLETED_AUDIT_ACTION),
          eq(auditLogTable.entityType, "user"),
          eq(auditLogTable.entityId, lockedUser.id),
        ))
        .limit(1);
      if (completedRecovery) return null;
    } else if (
      lockedUser.status !== "active"
      || !["principal", "admin"].includes(lockedUser.role)
    ) {
      return null;
    }

    const cooldownMs = recoveryEligible ? ADMIN_RECOVERY_COOLDOWN_MS : ADMIN_PASSWORD_RESET_COOLDOWN_MS;
    const cooldownStart = new Date(Date.now() - cooldownMs);
    const [recentRequest] = await tx
      .select({ id: passwordResetTokensTable.id })
      .from(passwordResetTokensTable)
      .where(and(
        eq(passwordResetTokensTable.userId, lockedUser.id),
        eq(passwordResetTokensTable.purpose, "password_reset"),
        gte(passwordResetTokensTable.createdAt, cooldownStart),
      ))
      .limit(1);
    if (recentRequest) return null;

    await tx.delete(passwordResetTokensTable).where(and(
      eq(passwordResetTokensTable.userId, lockedUser.id),
      eq(passwordResetTokensTable.purpose, "password_reset"),
    ));
    const token = createAdminPasswordResetToken();
    const [resetRecord] = await tx
      .insert(passwordResetTokensTable)
      .values({
        userId: lockedUser.id,
        tokenHash: hashAdminPasswordResetToken(token),
        purpose: "password_reset",
        expiresAt: new Date(Date.now() + ADMIN_PASSWORD_RESET_TTL_MS),
      })
      .returning({ id: passwordResetTokensTable.id });
    if (!resetRecord) return null;
    return { id: resetRecord.id, token, email: lockedUser.email, userId: lockedUser.id };
  });

  if (!issuedReset) {
    res.json(genericResponse);
    return;
  }

  try {
    const delivery = await sendAdminPasswordResetEmail(
      issuedReset.email,
      `${baseUrl}/login?resetToken=${encodeURIComponent(issuedReset.token)}`,
      `admin-password-reset-${issuedReset.id}`,
    );
    if (delivery.status !== "sent") {
      await db
        .update(passwordResetTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokensTable.id, issuedReset.id));
      req.log.error({ userId: issuedReset.userId }, "Admin password reset email was skipped");
    }
  } catch (err) {
    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, issuedReset.id));
    req.log.error({ err, userId: issuedReset.userId }, "Admin password reset email delivery failed");
  }

  res.json(genericResponse);
});

router.post("/auth/password-reset/complete", async (req, res): Promise<void> => {
  const parsed = CompleteAdminPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!meetsAdminPasswordPolicy(parsed.data.newPassword)) {
    res.status(400).json({
      error: "Password must be at least 10 characters and include a letter, a number, and a special character.",
    });
    return;
  }

  const now = new Date();
  const tokenHash = hashAdminPasswordResetToken(parsed.data.token);
  const resetResult = await db.transaction(async (tx) => {
    const [resetRecord] = await tx
      .select()
      .from(passwordResetTokensTable)
      .where(and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        eq(passwordResetTokensTable.purpose, "password_reset"),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, now),
      ))
      .limit(1)
      .for("update");
    if (!resetRecord) return { kind: "invalid" as const };

    const [initialUser] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, resetRecord.userId))
      .limit(1);
    if (!initialUser) {
      await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(eq(passwordResetTokensTable.id, resetRecord.id));
      return { kind: "invalid" as const };
    }

    const configuredRecoveryTarget = matchesAdminRecoveryEmail(
      initialUser.email,
      process.env.QUICKPROP_ADMIN_RECOVERY_EMAIL,
    );
    const [completedRecovery] = configuredRecoveryTarget
      ? await tx
        .select({ id: auditLogTable.id })
        .from(auditLogTable)
        .where(and(
          eq(auditLogTable.action, ADMIN_RECOVERY_COMPLETED_AUDIT_ACTION),
          eq(auditLogTable.entityType, "user"),
          eq(auditLogTable.entityId, initialUser.id),
        ))
        .limit(1)
      : [];
    const isRecoveryCompletion = configuredRecoveryTarget && !completedRecovery;
    const isNormalReset = initialUser.status === "active"
      && ["principal", "admin"].includes(initialUser.role);
    if (!isRecoveryCompletion && !isNormalReset) {
      await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(eq(passwordResetTokensTable.id, resetRecord.id));
      return { kind: "invalid" as const };
    }

    const activeAdmins = isRecoveryCompletion
      ? await tx
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(and(
          eq(usersTable.status, "active"),
          inArray(usersTable.role, ["principal", "admin"]),
        ))
        .orderBy(usersTable.id)
        .for("update")
      : [];

    const [user] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, initialUser.id))
      .limit(1)
      .for("update");
    if (!user) {
      await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(eq(passwordResetTokensTable.id, resetRecord.id));
      return { kind: "invalid" as const };
    }

    if (isRecoveryCompletion) {
      const [latestRecoveryMarker] = await tx
        .select({ id: auditLogTable.id })
        .from(auditLogTable)
        .where(and(
          eq(auditLogTable.action, ADMIN_RECOVERY_COMPLETED_AUDIT_ACTION),
          eq(auditLogTable.entityType, "user"),
          eq(auditLogTable.entityId, user.id),
        ))
        .limit(1);
      if (!matchesAdminRecoveryEmail(user.email, process.env.QUICKPROP_ADMIN_RECOVERY_EMAIL) || latestRecoveryMarker) {
        await tx
          .update(passwordResetTokensTable)
          .set({ usedAt: now })
          .where(eq(passwordResetTokensTable.id, resetRecord.id));
        return { kind: "invalid" as const };
      }

      const previousAdmins = activeAdmins.filter((admin) => admin.id !== user.id);
      const unexpectedAdmins = previousAdmins.filter(
        (admin) => !ADMIN_RECOVERY_DEACTIVATE_EMAILS.includes(
          admin.email.trim().toLowerCase() as typeof ADMIN_RECOVERY_DEACTIVATE_EMAILS[number],
        ),
      );
      if (unexpectedAdmins.length > 0) {
        await tx
          .update(passwordResetTokensTable)
          .set({ usedAt: now })
          .where(eq(passwordResetTokensTable.id, resetRecord.id));
        return { kind: "roster-changed" as const };
      }

      const adminsToDeactivate = previousAdmins.filter((admin) =>
        ADMIN_RECOVERY_DEACTIVATE_EMAILS.includes(
          admin.email.trim().toLowerCase() as typeof ADMIN_RECOVERY_DEACTIVATE_EMAILS[number],
        ),
      );
      const password = await hashPassword(parsed.data.newPassword);
      await tx
        .update(usersTable)
        .set({
          name: "Douglas Chiganze",
          role: "admin",
          status: "active",
          password,
        })
        .where(eq(usersTable.id, user.id));
      if (adminsToDeactivate.length > 0) {
        await tx
          .update(usersTable)
          .set({ status: "inactive" })
          .where(inArray(usersTable.id, adminsToDeactivate.map((admin) => admin.id)));
      }
      await tx.insert(auditLogTable).values([
        {
          action: ADMIN_RECOVERY_COMPLETED_AUDIT_ACTION,
          entityType: "user",
          entityId: user.id,
          detail: "Douglas Chiganze became the sole active Admin after completing the one-time email setup link.",
          userId: user.id,
          userName: "Douglas Chiganze",
        },
        ...adminsToDeactivate.map((admin) => ({
          action: "edited",
          entityType: "user",
          entityId: admin.id,
          detail: `Account deactivated after Douglas Chiganze completed the one-time admin recovery link.`,
          userId: user.id,
          userName: "Douglas Chiganze",
        })),
      ]);
      await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(and(
          eq(passwordResetTokensTable.userId, user.id),
          eq(passwordResetTokensTable.purpose, "password_reset"),
          isNull(passwordResetTokensTable.usedAt),
        ));
      return {
        kind: "completed" as const,
        user: { id: user.id, name: "Douglas Chiganze" },
        recovered: true,
      };
    }

    if (user.status !== "active" || !["principal", "admin"].includes(user.role)) {
      await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(eq(passwordResetTokensTable.id, resetRecord.id));
      return { kind: "invalid" as const };
    }

    await tx
      .update(usersTable)
      .set({ password: await hashPassword(parsed.data.newPassword) })
      .where(eq(usersTable.id, user.id));
    await tx
      .update(passwordResetTokensTable)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokensTable.userId, user.id),
        eq(passwordResetTokensTable.purpose, "password_reset"),
        isNull(passwordResetTokensTable.usedAt),
      ));
    return {
      kind: "completed" as const,
      user: { id: user.id, name: user.name },
      recovered: false,
    };
  });

  if (resetResult.kind === "invalid") {
    res.status(410).json({ error: "This password reset link has expired or has already been used." });
    return;
  }
  if (resetResult.kind === "roster-changed") {
    res.status(409).json({ error: "The active administrator list changed. No account transfer was made; request a fresh setup link and contact QuickProp support." });
    return;
  }

  try {
    await logAudit(
      "password_reset",
      "user",
      resetResult.user.id,
      "Administrator password reset using an emailed link",
      resetResult.user.id,
      resetResult.user.name,
    );
  } catch (err) {
    req.log.error({ err, userId: resetResult.user.id }, "Password reset audit logging failed");
  }
  res.json(CompleteAdminPasswordResetResponse.parse({ ok: true }));
});

router.post("/auth/agent-setup/complete", async (req, res): Promise<void> => {
  const parsed = CompleteAgentSetupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!meetsAdminPasswordPolicy(parsed.data.newPassword)) {
    res.status(400).json({
      error: "Password must be at least 10 characters and include a letter, a number, and a special character.",
    });
    return;
  }

  const now = new Date();
  const tokenHash = hashAgentSetupToken(parsed.data.token);
  const setupResult = await db.transaction(async (tx) => {
    const [setupToken] = await tx
      .select()
      .from(passwordResetTokensTable)
      .where(and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        eq(passwordResetTokensTable.purpose, "agent_setup"),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, now),
      ))
      .limit(1)
      .for("update");
    if (!setupToken) return { kind: "invalid" as const };

    const [user] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, setupToken.userId))
      .limit(1)
      .for("update");
    if (!user || user.status !== "invited" || !["agent", "senior_agent"].includes(user.role)) {
      await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(eq(passwordResetTokensTable.id, setupToken.id));
      return { kind: "invalid" as const };
    }

    await tx
      .update(usersTable)
      .set({
        password: await hashPassword(parsed.data.newPassword),
        status: "active",
      })
      .where(eq(usersTable.id, user.id));
    await tx
      .update(passwordResetTokensTable)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokensTable.userId, user.id),
        eq(passwordResetTokensTable.purpose, "agent_setup"),
        isNull(passwordResetTokensTable.usedAt),
      ));
    return { kind: "completed" as const, userId: user.id, userName: user.name };
  });

  if (setupResult.kind === "invalid") {
    res.status(410).json({ error: "This account setup link has expired or has already been used. Ask your administrator for a new invitation." });
    return;
  }

  try {
    await logAudit(
      "password_reset",
      "user",
      setupResult.userId,
      "Agent completed first-time account setup",
      setupResult.userId,
      setupResult.userName,
    );
  } catch (err) {
    req.log.error({ err, userId: setupResult.userId }, "Agent account setup audit logging failed");
  }
  res.json(CompleteAgentSetupResponse.parse({ ok: true }));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase().trim()));
  if (!user || user.status !== "active" || !await verifyPassword(parsed.data.password, user.password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!isScryptHash(user.password)) {
    await db.update(usersTable).set({ password: await hashPassword(parsed.data.password) }).where(eq(usersTable.id, user.id));
  }
  let accessToken: string;
  try {
    accessToken = createSessionToken(user.id, sessionSecret());
  } catch (error) {
    console.error("Unable to issue bearer session", error);
    res.status(503).json({ error: "Mobile sessions are not configured" });
    return;
  }
  res.cookie(COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TOKEN_TTL_SECONDS * 1000,
  });
  await logAudit("login", "user", user.id, `${user.name} logged in`, user.id, user.name);
  res.json(LoginResponse.parse({ ...jsonify(toUser(user)), accessToken }));
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user || user.status !== "active") {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(jsonify(toUser(user))));
});

router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateCurrentUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = res.locals.user as typeof usersTable.$inferSelect;
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Name cannot be blank" });
    return;
  }

  const phone = parsed.data.phone?.trim() || null;
  const [updatedUser] = await db
    .update(usersTable)
    .set({ name, phone })
    .where(eq(usersTable.id, user.id))
    .returning();
  if (!updatedUser) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  await logAudit("edited", "user", user.id, "Updated personal profile details", user.id, name);
  res.json(UpdateCurrentUserProfileResponse.parse(jsonify(toUser(updatedUser))));
});

router.delete("/auth/account", requireAuth, async (req, res): Promise<void> => {
  const parsed = DeleteCurrentUserAccountBody.safeParse(req.body);
  if (!parsed.success || parsed.data.confirmation !== "DELETE") {
    res.status(400).json({ error: 'Enter DELETE to confirm permanent account deletion' });
    return;
  }

  const user = res.locals.user as typeof usersTable.$inferSelect;
  if (!await verifyPassword(parsed.data.password, user.password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await db.transaction(async (tx) => {
    const ownedProperties = await tx
      .select({ id: propertiesTable.id })
      .from(propertiesTable)
      .where(eq(propertiesTable.agentId, user.id));
    const propertyIds = ownedProperties.map((property) => property.id);

    // A lead can be directly assigned to the user or belong to one of their
    // properties. Fetch IDs first because timelines, tasks, and viewings
    // reference leads and must be removed before the lead rows.
    const leadCondition = propertyIds.length > 0
      ? or(eq(leadsTable.agentId, user.id), inArray(leadsTable.propertyId, propertyIds))
      : eq(leadsTable.agentId, user.id);
    const ownedLeads = await tx
      .select({ id: leadsTable.id })
      .from(leadsTable)
      .where(leadCondition);
    const leadIds = ownedLeads.map((lead) => lead.id);

    // Delete leaf records first. Where a record can reference an owned
    // property or lead, include all such paths before deleting its parent.
    await tx.delete(notificationsTable).where(eq(notificationsTable.userId, user.id));
    await tx.delete(listingHousekeepingDeliveriesTable).where(eq(listingHousekeepingDeliveriesTable.userId, user.id));
    await tx.delete(listingHousekeepingPreferencesTable).where(eq(listingHousekeepingPreferencesTable.userId, user.id));
    await tx.delete(listingHousekeepingEventsTable).where(eq(listingHousekeepingEventsTable.agentId, user.id));
    await tx.delete(auditLogTable).where(eq(auditLogTable.userId, user.id));
    await tx.delete(savedPropertiesTable).where(eq(savedPropertiesTable.userId, user.id));
    await tx.delete(collaborationMatchRequestsTable).where(or(
      eq(collaborationMatchRequestsTable.requesterId, user.id),
      eq(collaborationMatchRequestsTable.propertyOwnerId, user.id),
    ));

    const viewingConditions = [eq(viewingsTable.agentId, user.id)];
    if (propertyIds.length > 0) viewingConditions.push(inArray(viewingsTable.propertyId, propertyIds));
    if (leadIds.length > 0) viewingConditions.push(inArray(viewingsTable.leadId, leadIds));
    await tx.delete(viewingsTable).where(or(...viewingConditions));

    const taskConditions = [eq(tasksTable.assigneeId, user.id)];
    if (propertyIds.length > 0) taskConditions.push(inArray(tasksTable.propertyId, propertyIds));
    if (leadIds.length > 0) taskConditions.push(inArray(tasksTable.leadId, leadIds));
    await tx.delete(tasksTable).where(or(...taskConditions));

    if (propertyIds.length > 0) {
      await tx.delete(documentsTable).where(inArray(documentsTable.propertyId, propertyIds));
    }
    if (leadIds.length > 0) {
      await tx.delete(leadTimelineTable).where(inArray(leadTimelineTable.leadId, leadIds));
    }

    await tx.delete(leadsTable).where(leadCondition);
    await tx.delete(buyersTable).where(eq(buyersTable.agentId, user.id));
    await tx.delete(buyerRequestsTable).where(eq(buyerRequestsTable.agentId, user.id));

    if (propertyIds.length > 0) {
      await tx.delete(priceHistoryTable).where(inArray(priceHistoryTable.propertyId, propertyIds));
      await tx.delete(savedPropertiesTable).where(inArray(savedPropertiesTable.propertyId, propertyIds));
      await tx.delete(propertiesTable).where(inArray(propertiesTable.id, propertyIds));
    }

    // Activity has no user FK, but remove authored, user-identifying activity
    // records where possible before removing the account.
    await tx.delete(activityTable).where(eq(activityTable.userName, user.name));
    await tx.delete(usersTable).where(eq(usersTable.id, user.id));
  });

  res.clearCookie(COOKIE);
  res.json(DeleteCurrentUserAccountResponse.parse({ ok: true }));
});

export async function currentUser(req: {
  cookies?: Record<string, string>;
  headers?: { authorization?: string | string[] | undefined };
}) {
  const bearerUserId = userIdFromBearerToken(req.headers?.authorization);
  const cookieToken = req.cookies?.[COOKIE];
  const cookieUserId = cookieToken?.startsWith("qp1.")
    ? readSessionToken(cookieToken, sessionSecret())
    : null;
  const id = bearerUserId ?? cookieUserId;
  if (!id) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user ?? null;
}

/** Middleware: reject unauthenticated requests; attaches user to res.locals.user. */
export async function requireAuth(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  const user = await currentUser(req);
  if (!user || user.status !== "active") {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  res.locals.user = user;
  next();
}

/** Middleware factory: require one of the given roles (after requireAuth). */
export function requireRole(...roles: string[]) {
  return (
    _req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ): void => {
    const user = res.locals.user as typeof usersTable.$inferSelect | undefined;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export default router;
