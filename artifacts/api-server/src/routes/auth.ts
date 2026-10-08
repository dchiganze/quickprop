import { Router, type IRouter } from "express";
import { and, eq, gt, gte, inArray, isNull, or } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
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
  createAdminPasswordResetToken,
  getAdminPasswordResetBaseUrl,
  hashAdminPasswordResetToken,
  meetsAdminPasswordPolicy,
} from "../lib/password-reset";
import {
  checkAdminPasswordResetEmailReadiness,
  sendAdminPasswordResetEmail,
} from "../lib/housekeeping-delivery";
import { hashPassword, isScryptHash, verifyPassword } from "../lib/passwords";

const router: IRouter = Router();

const COOKIE = "qp_uid";
const TOKEN_PREFIX = "qp1";
// Native clients cannot rely on browser cookies, so bearer sessions are durable
// enough for normal mobile use while still expiring and requiring re-authentication.
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

type SessionPayload = {
  sub: number;
  exp: number;
};

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters to issue bearer sessions.");
  }
  return secret;
}

function signSession(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function createSessionToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })).toString("base64url");
  const signed = `${TOKEN_PREFIX}.${payload}`;
  return `${signed}.${signSession(signed)}`;
}

function userIdFromBearerToken(authorization: string | string[] | undefined): number | null {
  if (typeof authorization !== "string") return null;
  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra.length > 0) return null;

  const [prefix, encodedPayload, signature, ...parts] = token.split(".");
  if (prefix !== TOKEN_PREFIX || !encodedPayload || !signature || parts.length > 0) return null;

  let expected: Buffer;
  let supplied: Buffer;
  try {
    expected = Buffer.from(signSession(`${prefix}.${encodedPayload}`), "base64url");
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    expected.length !== supplied.length
    || supplied.toString("base64url") !== signature
    || !timingSafeEqual(expected, supplied)
  ) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!Number.isSafeInteger(payload.sub) || payload.sub <= 0 || !Number.isSafeInteger(payload.exp)) return null;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload.sub : null;
  } catch {
    return null;
  }
}

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
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(
      eq(usersTable.email, email),
      eq(usersTable.status, "active"),
      inArray(usersTable.role, ["principal", "admin"]),
    ))
    .limit(1);

  const genericResponse = RequestAdminPasswordResetResponse.parse({ ok: true });
  if (!user) {
    res.json(genericResponse);
    return;
  }

  const cooldownStart = new Date(Date.now() - ADMIN_PASSWORD_RESET_COOLDOWN_MS);
  const [recentRequest] = await db
    .select({ id: passwordResetTokensTable.id })
    .from(passwordResetTokensTable)
    .where(and(
      eq(passwordResetTokensTable.userId, user.id),
      gte(passwordResetTokensTable.createdAt, cooldownStart),
    ))
    .limit(1);
  if (recentRequest) {
    res.json(genericResponse);
    return;
  }

  await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));
  const token = createAdminPasswordResetToken();
  const [resetRecord] = await db
    .insert(passwordResetTokensTable)
    .values({
      userId: user.id,
      tokenHash: hashAdminPasswordResetToken(token),
      expiresAt: new Date(Date.now() + ADMIN_PASSWORD_RESET_TTL_MS),
    })
    .returning({ id: passwordResetTokensTable.id });

  try {
    const delivery = await sendAdminPasswordResetEmail(
      user.email,
      `${baseUrl}/login?resetToken=${encodeURIComponent(token)}`,
      `admin-password-reset-${resetRecord.id}`,
    );
    if (delivery.status !== "sent") {
      await db
        .update(passwordResetTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokensTable.id, resetRecord.id));
      req.log.error({ userId: user.id }, "Admin password reset email was skipped");
    }
  } catch (err) {
    await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, resetRecord.id));
    req.log.error({ err, userId: user.id }, "Admin password reset email delivery failed");
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
  const resetUser = await db.transaction(async (tx) => {
    const [resetRecord] = await tx
      .select()
      .from(passwordResetTokensTable)
      .where(and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, now),
      ))
      .limit(1)
      .for("update");
    if (!resetRecord) return null;

    const [user] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, resetRecord.userId))
      .limit(1);
    if (!user || user.status !== "active" || !["principal", "admin"].includes(user.role)) {
      await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(eq(passwordResetTokensTable.id, resetRecord.id));
      return null;
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
        isNull(passwordResetTokensTable.usedAt),
      ));
    return { id: user.id, name: user.name };
  });

  if (!resetUser) {
    res.status(410).json({ error: "This password reset link has expired or has already been used." });
    return;
  }

  try {
    await logAudit(
      "password_reset",
      "user",
      resetUser.id,
      "Administrator password reset using an emailed link",
      resetUser.id,
      resetUser.name,
    );
  } catch (err) {
    req.log.error({ err, userId: resetUser.id }, "Password reset audit logging failed");
  }
  res.json(CompleteAdminPasswordResetResponse.parse({ ok: true }));
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
    accessToken = createSessionToken(user.id);
  } catch (error) {
    console.error("Unable to issue bearer session", error);
    res.status(503).json({ error: "Mobile sessions are not configured" });
    return;
  }
  res.cookie(COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 3600 * 1000,
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
  if (!user) {
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
  const id = bearerUserId ?? parseInt(req.cookies?.[COOKIE] ?? "", 10);
  if (!id || Number.isNaN(id)) return null;
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
