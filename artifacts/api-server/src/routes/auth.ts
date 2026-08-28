import { Router, type IRouter } from "express";
import { eq, inArray, or } from "drizzle-orm";
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
  priceHistoryTable,
  propertiesTable,
  savedPropertiesTable,
  tasksTable,
  usersTable,
  viewingsTable,
} from "@workspace/db";
import {
  DeleteCurrentUserAccountBody,
  DeleteCurrentUserAccountResponse,
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
} from "@workspace/api-zod";
import { logAudit, jsonify } from "../lib/helpers";
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
