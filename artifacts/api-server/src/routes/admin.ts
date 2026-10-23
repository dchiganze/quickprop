import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq, and, desc, inArray, or, isNull, type SQL } from "drizzle-orm";
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
const teamAdminOnly = requireRole("admin");
const ADMIN_ROLES = ["principal", "admin"] as const;

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]);
}

function stripUser(u: typeof usersTable.$inferSelect) {
  const { password: _pw, createdAt: _c, ...rest } = u;
  return rest;
}

router.get("/users", async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(ListUsersResponse.parse(jsonify(rows.filter((user) => user.status !== "deleted").map(stripUser))));
});

router.post("/users", teamAdminOnly, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const actor = await currentUser(req);
  const { password, ...rest } = parsed.data;
  const [row] = await db
    .insert(usersTable)
    .values({
      ...rest,
      email: rest.email.toLowerCase().trim(),
      password: await hashPassword(password ?? `${randomBytes(32).toString("base64url")}A1!`),
    })
    .returning();
  await logAudit("created", "user", row.id, `Created user ${row.name}`, actor?.id, actor?.name);
  res.status(201).json(CreateUserResponse.parse(jsonify(stripUser(row))));
});

router.patch("/users/:id", teamAdminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.status === "deleted") {
    res.status(400).json({ error: "Use the delete profile action to remove a team member." });
    return;
  }
  const actor = await currentUser(req);

  const outcome = await db.transaction(async (tx) => {
    const activeAdmins = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        eq(usersTable.status, "active"),
        inArray(usersTable.role, [...ADMIN_ROLES]),
      ))
      .orderBy(usersTable.id)
      .for("update");
    const [existing] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1)
      .for("update");
    if (!existing || existing.status === "deleted") return { kind: "missing" as const };

    const nextRole = parsed.data.role ?? existing.role;
    const nextStatus = parsed.data.status ?? existing.status;
    const wasActiveAdmin = existing.status === "active" && isAdminRole(existing.role);
    const remainsActiveAdmin = nextStatus === "active" && isAdminRole(nextRole);

    if (wasActiveAdmin && !remainsActiveAdmin && activeAdmins.every((admin) => admin.id === id)) {
      return { kind: "last-admin" as const };
    }

    const [row] = await tx.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
    return row ? { kind: "updated" as const, row } : { kind: "missing" as const };
  });

  if (outcome.kind === "missing") {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (outcome.kind === "last-admin") {
    res.status(409).json({ error: "QuickProp must keep at least one active administrator." });
    return;
  }
  await logAudit("edited", "user", id, `Updated user ${outcome.row.name}`, actor?.id, actor?.name);
  res.json(UpdateUserResponse.parse(jsonify(stripUser(outcome.row))));
});

router.delete("/users/:id", teamAdminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const actor = await currentUser(req);
  if (!actor) {
    res.status(401).json({ error: "Sign in as an Admin to delete a team profile." });
    return;
  }
  if (actor.id === id) {
    res.status(409).json({ error: "You cannot delete your own profile from Team & Branches." });
    return;
  }

  const randomPassword = `${randomBytes(48).toString("base64url")}A1!`;
  const passwordHash = await hashPassword(randomPassword);
  const outcome = await db.transaction(async (tx) => {
    const activeAdmins = await tx.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        eq(usersTable.status, "active"),
        inArray(usersTable.role, [...ADMIN_ROLES]),
      ))
      .orderBy(usersTable.id)
      .for("update");
    const [target] = await tx.select().from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1)
      .for("update");
    if (!target || target.status === "deleted") return { kind: "missing" as const };

    const isActiveAdmin = target.status === "active" && isAdminRole(target.role);
    if (isActiveAdmin && activeAdmins.every((admin) => admin.id === id)) {
      return { kind: "last-admin" as const };
    }

    await tx.update(usersTable).set({
      name: "Deleted profile",
      email: `deleted-profile-${id}@removed.quickprop.invalid`,
      phone: null,
      role: "viewer",
      branchId: null,
      status: "deleted",
      avatarUrl: null,
      password: passwordHash,
    }).where(eq(usersTable.id, id));
    return { kind: "deleted" as const, previousName: target.name };
  });

  if (outcome.kind === "missing") {
    res.status(404).json({ error: "Team profile not found." });
    return;
  }
  if (outcome.kind === "last-admin") {
    res.status(409).json({ error: "QuickProp must keep at least one active administrator." });
    return;
  }
  await logAudit("deleted", "user", id, `Deleted team profile ${outcome.previousName}; linked business records were retained.`, actor.id, actor.name);
  res.json({ ok: true });
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

router.get("/notifications", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const rows = await db.select().from(notificationsTable)
    .where(or(eq(notificationsTable.userId, user.id), isNull(notificationsTable.userId)))
    .orderBy(desc(notificationsTable.createdAt)).limit(50);
  res.json(ListNotificationsResponse.parse(jsonify(rows)));
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseId(req);
  const user = await currentUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [row] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), or(eq(notificationsTable.userId, user.id), isNull(notificationsTable.userId))))
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
