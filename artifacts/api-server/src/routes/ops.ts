import { Router, type IRouter } from "express";
import { eq, and, desc, asc, ilike, or, type SQL } from "drizzle-orm";
import { db, tasksTable, viewingsTable, documentsTable } from "@workspace/db";
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

// Tasks
router.get("/tasks", async (req, res): Promise<void> => {
  const q = ListTasksQueryParams.safeParse(req.query);
  const conds: SQL[] = [];
  if (q.success && q.data.status) conds.push(eq(tasksTable.status, q.data.status));
  if (q.success && q.data.assigneeId != null) conds.push(eq(tasksTable.assigneeId, q.data.assigneeId));
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
  const [row] = await db.insert(tasksTable).values(parsed.data).returning();
  res.status(201).json(CreateTaskResponse.parse(jsonify(row)));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(tasksTable).set(parsed.data).where(eq(tasksTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(UpdateTaskResponse.parse(jsonify(row)));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [row] = await db.delete(tasksTable).where(eq(tasksTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

// Viewings
router.get("/viewings", async (req, res): Promise<void> => {
  const q = ListViewingsQueryParams.safeParse(req.query);
  const conds: SQL[] = [];
  if (q.success && q.data.propertyId != null) conds.push(eq(viewingsTable.propertyId, q.data.propertyId));
  if (q.success && q.data.agentId != null) conds.push(eq(viewingsTable.agentId, q.data.agentId));
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
  const { scheduledAt, ...rest } = parsed.data;
  const [row] = await db
    .insert(viewingsTable)
    .values({ ...rest, scheduledAt: new Date(scheduledAt) })
    .returning();
  await logActivity("viewing", `Viewing scheduled${row.buyerName ? ` with ${row.buyerName}` : ""}`, "property", row.propertyId, user?.name);
  res.status(201).json(CreateViewingResponse.parse(jsonify(row)));
});

router.patch("/viewings/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateViewingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { scheduledAt, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  if (scheduledAt) update.scheduledAt = new Date(scheduledAt);
  const [row] = await db.update(viewingsTable).set(update).where(eq(viewingsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Viewing not found" });
    return;
  }
  res.json(UpdateViewingResponse.parse(jsonify(row)));
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
