import { Router, type IRouter, type Request } from "express";
import { eq, and, desc, asc, ilike, or, type SQL } from "drizzle-orm";
import { db, tasksTable, viewingsTable, documentsTable, syncMutationsTable } from "@workspace/db";
import {
  ListTasksQueryParams,
  ListTasksResponse,
  CreateTaskBody,
  CreateTaskResponse,
  UpdateTaskBody,
  UpdateTaskResponse,
  ListViewingsQueryParams,
  ListViewingsResponse,
  CreateViewingBody,
  CreateViewingResponse,
  UpdateViewingBody,
  UpdateViewingResponse,
  ListDocumentsQueryParams,
  ListDocumentsResponse,
  CreateDocumentBody,
  CreateDocumentResponse,
} from "@workspace/api-zod";
import { parseId, logActivity, jsonify } from "../lib/helpers";
import { currentUser } from "./auth";

const router: IRouter = Router();

function mutationKey(req: Request): string | null {
  const value = req.get("Idempotency-Key")?.trim();
  return value && /^[a-z0-9-]{8,80}$/i.test(value) ? value : null;
}

// Tasks
router.get("/tasks", async (req, res): Promise<void> => {
  const q = ListTasksQueryParams.safeParse(req.query);
  const conds: SQL[] = [];
  if (q.success && q.data.status) conds.push(eq(tasksTable.status, q.data.status));
  const user = await currentUser(req);
  if (user?.role === "agent" || user?.role === "senior_agent") {
    conds.push(eq(tasksTable.assigneeId, user.id));
  } else if (q.success && q.data.assigneeId != null) {
    conds.push(eq(tasksTable.assigneeId, q.data.assigneeId));
  }
  const rows = await db
    .select()
    .from(tasksTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(asc(tasksTable.dueDate), desc(tasksTable.createdAt));
  res.json(ListTasksResponse.parse(jsonify(rows)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const requestKey = mutationKey(req);
  const result = await db.transaction(async (tx) => {
    let mutationId: number | null = null;
    if (requestKey && user) {
      const [claim] = await tx
        .insert(syncMutationsTable)
        .values({ actorId: user.id, mutationKey: requestKey, resourceType: "task" })
        .onConflictDoNothing()
        .returning();
      if (!claim) {
        const [existingClaim] = await tx.select().from(syncMutationsTable).where(and(
          eq(syncMutationsTable.actorId, user.id),
          eq(syncMutationsTable.mutationKey, requestKey),
          eq(syncMutationsTable.resourceType, "task"),
        ));
        if (!existingClaim?.resourceId) throw new Error("Sync mutation did not complete.");
        const [existing] = await tx.select().from(tasksTable).where(eq(tasksTable.id, existingClaim.resourceId));
        if (!existing) throw new Error("Sync mutation resource is unavailable.");
        return existing;
      }
      mutationId = claim.id;
    }
    const [row] = await tx.insert(tasksTable).values({ ...parsed.data, assigneeId: user?.id }).returning();
    if (mutationId) {
      await tx.update(syncMutationsTable).set({ resourceId: row.id }).where(eq(syncMutationsTable.id, mutationId));
    }
    return row;
  });
  res.status(201).json(CreateTaskResponse.parse(jsonify(result)));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const ownership = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(tasksTable.id, id), eq(tasksTable.assigneeId, user.id))
    : eq(tasksTable.id, id);
  const [row] = await db.update(tasksTable).set(parsed.data).where(ownership).returning();
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(UpdateTaskResponse.parse(jsonify(row)));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const user = await currentUser(req);
  const ownership = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(tasksTable.id, id), eq(tasksTable.assigneeId, user.id))
    : eq(tasksTable.id, id);
  const [row] = await db.delete(tasksTable).where(ownership).returning();
  if (!row) {
    // Delete is a terminal operation for the offline queue; a retry after a
    // lost 204 must not permanently block subsequent mutations.
    res.sendStatus(204);
    return;
  }
  res.sendStatus(204);
});

// Viewings
router.get("/viewings", async (req, res): Promise<void> => {
  const q = ListViewingsQueryParams.safeParse(req.query);
  const conds: SQL[] = [];
  if (q.success && q.data.propertyId != null) conds.push(eq(viewingsTable.propertyId, q.data.propertyId));
  const user = await currentUser(req);
  if (user?.role === "agent" || user?.role === "senior_agent") {
    conds.push(eq(viewingsTable.agentId, user.id));
  } else if (q.success && q.data.agentId != null) {
    conds.push(eq(viewingsTable.agentId, q.data.agentId));
  }
  const rows = await db
    .select()
    .from(viewingsTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(asc(viewingsTable.scheduledAt));
  const dateFilter = q.success ? q.data.date : undefined;
  const filtered = dateFilter
    ? rows.filter((r) => r.scheduledAt.toISOString().slice(0, 10) === dateFilter)
    : rows;
  res.json(ListViewingsResponse.parse(jsonify(filtered)));
});

router.post("/viewings", async (req, res): Promise<void> => {
  const parsed = CreateViewingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const requestKey = mutationKey(req);
  const result = await db.transaction(async (tx) => {
    let mutationId: number | null = null;
    if (requestKey && user) {
      const [claim] = await tx
        .insert(syncMutationsTable)
        .values({ actorId: user.id, mutationKey: requestKey, resourceType: "viewing" })
        .onConflictDoNothing()
        .returning();
      if (!claim) {
        const [existingClaim] = await tx.select().from(syncMutationsTable).where(and(
          eq(syncMutationsTable.actorId, user.id),
          eq(syncMutationsTable.mutationKey, requestKey),
          eq(syncMutationsTable.resourceType, "viewing"),
        ));
        if (!existingClaim?.resourceId) throw new Error("Sync mutation did not complete.");
        const [existing] = await tx.select().from(viewingsTable).where(eq(viewingsTable.id, existingClaim.resourceId));
        if (!existing) throw new Error("Sync mutation resource is unavailable.");
        return { row: existing, created: false };
      }
      mutationId = claim.id;
    }
    const { scheduledAt, ...rest } = parsed.data;
    const [row] = await tx
      .insert(viewingsTable)
      .values({ ...rest, agentId: user?.id, scheduledAt: new Date(scheduledAt) })
      .returning();
    if (mutationId) {
      await tx.update(syncMutationsTable).set({ resourceId: row.id }).where(eq(syncMutationsTable.id, mutationId));
    }
    return { row, created: true };
  });
  if (result.created) {
    await logActivity("viewing", `Viewing scheduled${result.row.buyerName ? ` with ${result.row.buyerName}` : ""}`, "property", result.row.propertyId, user?.name);
  }
  res.status(201).json(CreateViewingResponse.parse(jsonify(result.row)));
});

router.patch("/viewings/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const user = await currentUser(req);
  const parsed = UpdateViewingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { scheduledAt, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  if (scheduledAt) update.scheduledAt = new Date(scheduledAt);
  const ownership = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(viewingsTable.id, id), eq(viewingsTable.agentId, user.id))
    : eq(viewingsTable.id, id);
  const [row] = await db.update(viewingsTable).set(update).where(ownership).returning();
  if (!row) {
    res.status(404).json({ error: "Viewing not found" });
    return;
  }
  res.json(UpdateViewingResponse.parse(jsonify(row)));
});

router.delete("/viewings/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const user = await currentUser(req);
  const ownership = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(viewingsTable.id, id), eq(viewingsTable.agentId, user.id))
    : eq(viewingsTable.id, id);
  const [row] = await db.delete(viewingsTable).where(ownership).returning();
  if (!row) {
    // See task deletes above: retries after a committed delete are successful.
    res.sendStatus(204);
    return;
  }
  res.sendStatus(204);
});

// Documents
router.get("/documents", async (req, res): Promise<void> => {
  const q = ListDocumentsQueryParams.safeParse(req.query);
  const conds: SQL[] = [];
  if (q.success && q.data.propertyId != null) conds.push(eq(documentsTable.propertyId, q.data.propertyId));
  if (q.success && q.data.category) conds.push(eq(documentsTable.category, q.data.category));
  if (q.success && q.data.q) {
    const cond = ilike(documentsTable.name, `%${q.data.q}%`);
    conds.push(cond);
  }
  const rows = await db
    .select()
    .from(documentsTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(documentsTable.createdAt));
  res.json(ListDocumentsResponse.parse(jsonify(rows)));
});

router.post("/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const [row] = await db
    .insert(documentsTable)
    .values({ ...parsed.data, uploadedBy: user?.name ?? null })
    .returning();
  res.status(201).json(CreateDocumentResponse.parse(jsonify(row)));
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [row] = await db.delete(documentsTable).where(eq(documentsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
