import { Router, type IRouter } from "express";
import { eq, and, desc, type SQL } from "drizzle-orm";
import { db, leadsTable, leadTimelineTable } from "@workspace/db";
import {
  ListLeadsQueryParams,
  ListLeadsResponse,
  CreateLeadBody,
  CreateLeadResponse,
  GetLeadResponse,
  UpdateLeadBody,
  UpdateLeadResponse,
  GetLeadTimelineResponse,
  AddLeadTimelineEntryBody,
  AddLeadTimelineEntryResponse,
} from "@workspace/api-zod";
import { parseId, logActivity, jsonify } from "../lib/helpers";
import { currentUser } from "./auth";

const router: IRouter = Router();

router.get("/leads", async (req, res): Promise<void> => {
  const q = ListLeadsQueryParams.safeParse(req.query);
  const conds: SQL[] = [];
  if (q.success && q.data.stage) conds.push(eq(leadsTable.stage, q.data.stage));
  if (q.success && q.data.agentId != null) conds.push(eq(leadsTable.agentId, q.data.agentId));
  const rows = await db
    .select()
    .from(leadsTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(leadsTable.createdAt));
  res.json(ListLeadsResponse.parse(jsonify(rows)));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const [row] = await db.insert(leadsTable).values(parsed.data).returning();
  await db.insert(leadTimelineTable).values({
    leadId: row.id,
    type: "note",
    content: `Lead created${row.source ? ` from ${row.source.replace(/_/g, " ")}` : ""}`,
    userName: user?.name ?? null,
  });
  await logActivity("enquiry", `New lead: ${row.name}`, "lead", row.id, user?.name);
  res.status(201).json(CreateLeadResponse.parse(jsonify(row)));
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(GetLeadResponse.parse(jsonify(row)));
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const user = await currentUser(req);
  const [row] = await db
    .update(leadsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(leadsTable.id, id))
    .returning();
  if (parsed.data.stage && parsed.data.stage !== existing.stage) {
    await db.insert(leadTimelineTable).values({
      leadId: id,
      type: "status_change",
      content: `Stage changed from ${existing.stage.replace(/_/g, " ")} to ${row.stage.replace(/_/g, " ")}`,
      userName: user?.name ?? null,
    });
  }
  res.json(UpdateLeadResponse.parse(jsonify(row)));
});

router.get("/leads/:id/timeline", async (req, res): Promise<void> => {
  const id = parseId(req);
  const rows = await db
    .select()
    .from(leadTimelineTable)
    .where(eq(leadTimelineTable.leadId, id))
    .orderBy(desc(leadTimelineTable.createdAt));
  res.json(GetLeadTimelineResponse.parse(jsonify(rows)));
});

router.post("/leads/:id/timeline", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = AddLeadTimelineEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const user = await currentUser(req);
  const [row] = await db
    .insert(leadTimelineTable)
    .values({ leadId: id, ...parsed.data, userName: user?.name ?? null })
    .returning();
  res.status(201).json(AddLeadTimelineEntryResponse.parse(jsonify(row)));
});

export default router;
