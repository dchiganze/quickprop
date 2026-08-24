import { Router, type IRouter } from "express";
import { eq, and, desc, type SQL } from "drizzle-orm";
import { db, usersTable, branchesTable, notificationsTable, auditLogTable } from "@workspace/db";
import {
  ListUsersResponse,
  CreateUserBody,
  CreateUserResponse,
  UpdateUserBody,
  UpdateUserResponse,
  ListBranchesResponse,
  CreateBranchBody,
  CreateBranchResponse,
  ListNotificationsResponse,
  MarkNotificationReadResponse,
  ListAuditLogQueryParams,
  ListAuditLogResponse,
} from "@workspace/api-zod";
import { parseId, logAudit, jsonify } from "../lib/helpers";
import { hashPassword } from "../lib/passwords";
import { currentUser, requireRole } from "./auth";

const router: IRouter = Router();

const adminOnly = requireRole("principal", "admin");

function stripUser(u: typeof usersTable.$inferSelect) {
  const { password: _pw, createdAt: _c, ...rest } = u;
  return rest;
}

router.get("/users", async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(ListUsersResponse.parse(jsonify(rows.map(stripUser))));
});

router.post("/users", adminOnly, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const actor = await currentUser(req);
  const { password, ...rest } = parsed.data;
  const [row] = await db
    .insert(usersTable)
    .values({ ...rest, email: rest.email.toLowerCase().trim(), password: await hashPassword(password ?? "demo1234") })
    .returning();
  await logAudit("created", "user", row.id, `Created user ${row.name}`, actor?.id, actor?.name);
  res.status(201).json(CreateUserResponse.parse(jsonify(stripUser(row))));
});

router.patch("/users/:id", adminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const actor = await currentUser(req);
  const [row] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAudit("edited", "user", id, `Updated user ${row.name}`, actor?.id, actor?.name);
  res.json(UpdateUserResponse.parse(jsonify(stripUser(row))));
});

router.get("/branches", async (_req, res): Promise<void> => {
  const rows = await db.select().from(branchesTable).orderBy(branchesTable.name);
  res.json(ListBranchesResponse.parse(jsonify(rows)));
});

router.post("/branches", adminOnly, async (req, res): Promise<void> => {
  const parsed = CreateBranchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(branchesTable).values(parsed.data).returning();
  res.status(201).json(CreateBranchResponse.parse(jsonify(row)));
});

router.get("/notifications", async (_req, res): Promise<void> => {
  const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(50);
  res.json(ListNotificationsResponse.parse(jsonify(rows)));
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [row] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(MarkNotificationReadResponse.parse(jsonify(row)));
});

router.get("/audit-log", adminOnly, async (req, res): Promise<void> => {
  const q = ListAuditLogQueryParams.safeParse(req.query);
  const conds: SQL[] = [];
  if (q.success && q.data.entityType) conds.push(eq(auditLogTable.entityType, q.data.entityType));
  if (q.success && q.data.userId != null) conds.push(eq(auditLogTable.userId, q.data.userId));
  const rows = await db
    .select()
    .from(auditLogTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(200);
  res.json(ListAuditLogResponse.parse(jsonify(rows)));
});

export default router;
