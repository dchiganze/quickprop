import { Router, type IRouter } from "express";
import { eq, and, ilike, or, gte, lte, desc, type SQL } from "drizzle-orm";
import {
  db,
  propertiesTable,
  priceHistoryTable,
  activityTable,
  sellersTable,
} from "@workspace/db";
import {
  ListPropertiesQueryParams,
  ListPropertiesResponse,
  CreatePropertyBody,
  CreatePropertyResponse,
  GetPropertyResponse,
  UpdatePropertyBody,
  UpdatePropertyResponse,
  GetPropertyPriceHistoryResponse,
  GetPropertyActivityResponse,
  GetPipelineResponse,
  SharePropertyBody,
  SharePropertyResponse,
  GenerateBrochureResponse,
} from "@workspace/api-zod";
import { parseId, logActivity, logAudit, jsonify } from "../lib/helpers";
import { currentUser } from "./auth";

const router: IRouter = Router();

const PIPELINE_STAGES = [
  "draft",
  "awaiting_photos",
  "ready",
  "published",
  "under_offer",
  "sold",
  "archived",
];

async function nextReference(): Promise<string> {
  const rows = await db.select({ id: propertiesTable.id }).from(propertiesTable).orderBy(desc(propertiesTable.id)).limit(1);
  const next = (rows[0]?.id ?? 0) + 1;
  return `QP-${String(next).padStart(4, "0")}`;
}

router.get("/properties", async (req, res): Promise<void> => {
  const q = ListPropertiesQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const f = q.data;
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(propertiesTable.status, f.status));
  if (f.pipelineStage) conds.push(eq(propertiesTable.pipelineStage, f.pipelineStage));
  if (f.listingType) conds.push(eq(propertiesTable.listingType, f.listingType));
  if (f.propertyType) conds.push(eq(propertiesTable.propertyType, f.propertyType));
  if (f.suburb) conds.push(ilike(propertiesTable.suburb, f.suburb));
  if (f.agentId != null) conds.push(eq(propertiesTable.agentId, f.agentId));
  if (f.minPrice != null) conds.push(gte(propertiesTable.price, f.minPrice));
  if (f.maxPrice != null) conds.push(lte(propertiesTable.price, f.maxPrice));
  if (f.q) {
    const pat = `%${f.q}%`;
    const textCond = or(
      ilike(propertiesTable.title, pat),
      ilike(propertiesTable.reference, pat),
      ilike(propertiesTable.suburb, pat),
      ilike(propertiesTable.address, pat),
      ilike(propertiesTable.description, pat),
    );
    if (textCond) conds.push(textCond);
  }
  const rows = await db
    .select()
    .from(propertiesTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(propertiesTable.createdAt));
  res.json(ListPropertiesResponse.parse(jsonify(rows)));
});

router.post("/properties", async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const reference = await nextReference();
  const [row] = await db
    .insert(propertiesTable)
    .values({ ...parsed.data, reference })
    .returning();
  await db.insert(priceHistoryTable).values({
    propertyId: row.id,
    price: row.price,
    changedBy: user?.name ?? null,
  });
  await logActivity("created", `New mandate ${row.reference}: ${row.title}`, "property", row.id, user?.name);
  await logAudit("created", "property", row.id, `Created ${row.reference}`, user?.id, user?.name);
  res.status(201).json(CreatePropertyResponse.parse(jsonify(row)));
});

router.get("/properties/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [row] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json(GetPropertyResponse.parse(jsonify(row)));
});

router.patch("/properties/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const user = await currentUser(req);
  const update: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.status === "public" && existing.status !== "public") {
    update.publishedAt = new Date();
  }
  const [row] = await db
    .update(propertiesTable)
    .set(update)
    .where(eq(propertiesTable.id, id))
    .returning();

  if (parsed.data.price != null && parsed.data.price !== existing.price) {
    await db.insert(priceHistoryTable).values({
      propertyId: id,
      price: parsed.data.price,
      previousPrice: existing.price,
      changedBy: user?.name ?? null,
    });
    await logActivity("price_change", `${row.reference} price changed to $${row.price.toLocaleString()}`, "property", id, user?.name);
  }
  if (parsed.data.status && parsed.data.status !== existing.status) {
    await logActivity("status_change", `${row.reference} moved to ${row.status.replace(/_/g, " ")}`, "property", id, user?.name);
  }
  await logAudit("edited", "property", id, `Updated ${row.reference}`, user?.id, user?.name);
  res.json(UpdatePropertyResponse.parse(jsonify(row)));
});

router.delete("/properties/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const user = await currentUser(req);
  const [row] = await db.delete(propertiesTable).where(eq(propertiesTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  await logAudit("deleted", "property", id, `Deleted ${row.reference}`, user?.id, user?.name);
  res.sendStatus(204);
});

router.get("/properties/:id/price-history", async (req, res): Promise<void> => {
  const id = parseId(req);
  const rows = await db
    .select()
    .from(priceHistoryTable)
    .where(eq(priceHistoryTable.propertyId, id))
    .orderBy(desc(priceHistoryTable.changedAt));
  res.json(GetPropertyPriceHistoryResponse.parse(jsonify(rows)));
});

router.get("/properties/:id/activity", async (req, res): Promise<void> => {
  const id = parseId(req);
  const rows = await db
    .select()
    .from(activityTable)
    .where(and(eq(activityTable.entityType, "property"), eq(activityTable.entityId, id)))
    .orderBy(desc(activityTable.createdAt));
  res.json(GetPropertyActivityResponse.parse(jsonify(rows)));
});

router.post("/properties/:id/share", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = SharePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const user = await currentUser(req);
  await db
    .update(propertiesTable)
    .set({ shares: existing.shares + 1 })
    .where(eq(propertiesTable.id, id));
  const url = `https://quickprop.co.zw/p/${existing.reference.toLowerCase()}`;
  await logActivity("share", `${existing.reference} shared via ${parsed.data.channel}`, "property", id, user?.name);
  res.json(
    SharePropertyResponse.parse({
      url,
      qrData: url,
    }),
  );
});

router.post("/properties/:id/brochure", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [existing] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const user = await currentUser(req);
  await db.update(propertiesTable).set({ hasBrochure: true }).where(eq(propertiesTable.id, id));
  await logActivity("brochure", `Brochure generated for ${existing.reference}`, "property", id, user?.name);
  res.json(
    GenerateBrochureResponse.parse({
      propertyId: id,
      url: `https://quickprop.co.zw/brochures/${existing.reference.toLowerCase()}.pdf`,
      generatedAt: new Date().toISOString(),
    }),
  );
});

router.get("/pipeline", async (_req, res): Promise<void> => {
  const rows = await db.select().from(propertiesTable).orderBy(desc(propertiesTable.updatedAt));
  const board = PIPELINE_STAGES.map((stage) => ({
    stage,
    properties: rows.filter((r) => r.pipelineStage === stage),
  }));
  res.json(GetPipelineResponse.parse(jsonify(board)));
});

export default router;
