import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetCurrentUserResponse } from "@workspace/api-zod";
import { logAudit, jsonify } from "../lib/helpers";

const router: IRouter = Router();

const COOKIE = "qp_uid";

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
  if (!user || user.password !== parsed.data.password || user.status !== "active") {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  res.cookie(COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 3600 * 1000,
  });
  await logAudit("login", "user", user.id, `${user.name} logged in`, user.id, user.name);
  res.json(LoginResponse.parse(jsonify(toUser(user))));
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.delete("/auth/account", async (req, res): Promise<void> => {
  const raw = req.cookies?.[COOKIE];
  const id = parseInt(raw ?? "", 10);
  if (!id || Number.isNaN(id)) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  await logAudit("deleted", "user", id, `${user.name} deleted their account`, id, user.name);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const raw = req.cookies?.[COOKIE];
  const id = parseInt(raw ?? "", 10);
  if (!id || Number.isNaN(id)) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  res.json(GetCurrentUserResponse.parse(jsonify(toUser(user))));
});

export async function currentUser(req: { cookies?: Record<string, string> }) {
  const id = parseInt(req.cookies?.[COOKIE] ?? "", 10);
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
