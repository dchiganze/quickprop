import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { eq, and, ilike, or, gte, lte, desc, type SQL } from "drizzle-orm";
import {
  db,
  propertiesTable,
  priceHistoryTable,
  activityTable,
  sellersTable,
  syncMutationsTable,
  savedPropertiesTable,
  tasksTable,
  viewingsTable,
  documentsTable,
  leadsTable,
  collaborationMatchRequestsTable,
  propertyDuplicateReviewsTable,
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
import { DEFAULT_HOUSEKEEPING_SETTINGS } from "../lib/housekeeping";
import { findDuplicateCandidates, normalizeText } from "../lib/multi-agent";

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

function mutationKey(req: Request): string | null {
  const value = req.get("Idempotency-Key")?.trim();
  return value && /^[a-z0-9-]{8,80}$/i.test(value) ? value : null;
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
  const user = await currentUser(req);
  // Agent mobile sessions only ever see their own portfolio. Principals and
  // admins retain the broader office query behaviour used by the web apps.
  if (user?.role === "agent" || user?.role === "senior_agent") {
    conds.push(eq(propertiesTable.agentId, user.id));
  } else if (f.agentId != null) {
    conds.push(eq(propertiesTable.agentId, f.agentId));
  }
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
  if (!parsed.data.photos?.length) {
    res.status(400).json({ error: "At least one listing photo is required." });
    return;
  }
  const user = await currentUser(req);
  const requestKey = mutationKey(req);
  const result = await db.transaction(async (tx) => {
    let mutationId: number | null = null;
    if (requestKey && user) {
      const [claim] = await tx
        .insert(syncMutationsTable)
        .values({ actorId: user.id, mutationKey: requestKey, resourceType: "property" })
        .onConflictDoNothing()
        .returning();
      if (!claim) {
        const [existingClaim] = await tx.select().from(syncMutationsTable).where(and(
          eq(syncMutationsTable.actorId, user.id),
          eq(syncMutationsTable.mutationKey, requestKey),
          eq(syncMutationsTable.resourceType, "property"),
        ));
        if (!existingClaim?.resourceId) throw new Error("Sync mutation did not complete.");
        const [existing] = await tx.select().from(propertiesTable).where(eq(propertiesTable.id, existingClaim.resourceId));
        if (!existing) throw new Error("Sync mutation resource is unavailable.");
        return { row: existing, created: false };
      }
      mutationId = claim.id;
    }
    const temporaryReference = `pending-${randomUUID()}`;
    const [created] = await tx
      .insert(propertiesTable)
      .values({
        ...parsed.data,
        agentId: user?.id,
        reference: temporaryReference,
        normalizedAddress: normalizeText(parsed.data.address),
      })
      .returning();
    const [row] = await tx
      .update(propertiesTable)
      .set({ reference: `QP-${String(created.id).padStart(4, "0")}` })
      .where(eq(propertiesTable.id, created.id))
      .returning();
    if (mutationId) {
      await tx.update(syncMutationsTable).set({ resourceId: row.id }).where(eq(syncMutationsTable.id, mutationId));
    }
    await tx.insert(priceHistoryTable).values({
      propertyId: row.id,
      price: row.price,
      changedBy: user?.name ?? null,
    });
    return { row, created: true };
  });
  if (result.created) {
    const duplicateMatches = await findDuplicateCandidates({
      address: result.row.address,
      suburb: result.row.suburb,
      city: result.row.city,
      propertyType: result.row.propertyType,
      bedrooms: result.row.bedrooms,
      bathrooms: result.row.bathrooms,
      landSize: result.row.landSize,
      buildingSize: result.row.buildingSize,
      price: result.row.price,
      description: result.row.description,
      photos: result.row.photos,
    }, result.row.id);
    const possibleDuplicate = duplicateMatches[0];
    if (possibleDuplicate) {
      await db.insert(propertyDuplicateReviewsTable).values({
        sourcePropertyId: result.row.id,
        candidatePropertyId: possibleDuplicate.property.id,
        confidenceScore: possibleDuplicate.confidenceScore,
        matchingFields: possibleDuplicate.matchingFields,
        imageMatches: possibleDuplicate.imageMatches,
      });
      await db.update(propertiesTable).set({ duplicateStatus: "review" }).where(eq(propertiesTable.id, result.row.id));
    }
    await logActivity("created", `New mandate ${result.row.reference}: ${result.row.title}`, "property", result.row.id, user?.name);
    await logAudit("created", "property", result.row.id, `Created ${result.row.reference}`, user?.id, user?.name);
  }
  res.status(201).json(CreatePropertyResponse.parse(jsonify(result.row)));
});

router.get("/properties/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const user = await currentUser(req);
  const [row] = await db.select().from(propertiesTable).where(
    user?.role === "agent" || user?.role === "senior_agent"
      ? and(eq(propertiesTable.id, id), eq(propertiesTable.agentId, user.id))
      : eq(propertiesTable.id, id),
  );
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
  if (parsed.data.photos && parsed.data.photos.length === 0) {
    res.status(400).json({ error: "At least one listing photo is required." });
    return;
  }
  const user = await currentUser(req);
  const ownership = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(propertiesTable.id, id), eq(propertiesTable.agentId, user.id))
    : eq(propertiesTable.id, id);
  const [existing] = await db.select().from(propertiesTable).where(ownership);
  if (!existing) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const update: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  const meaningfulFields = ["title", "description", "price", "photos", "features", "address", "suburb", "bedrooms", "bathrooms", "buildingSize", "landSize"];
  if (meaningfulFields.some((field) => field in parsed.data)) {
    update.nextConfirmationAt = new Date(Date.now() + DEFAULT_HOUSEKEEPING_SETTINGS.recurringConfirmationDays * 86400000);
    update.freshnessStatus = "fresh";
    update.freshnessScore = 100;
    update.daysSinceConfirmation = 0;
    update.staleSince = null;
  }
  if (parsed.data.status === "public" && existing.status !== "public") {
    update.publishedAt = new Date();
  }
  const [row] = await db
    .update(propertiesTable)
    .set(update)
    .where(ownership)
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
  const ownership = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(propertiesTable.id, id), eq(propertiesTable.agentId, user.id))
    : eq(propertiesTable.id, id);
  const row = await db.transaction(async (tx) => {
    const [property] = await tx.select({ id: propertiesTable.id, reference: propertiesTable.reference })
      .from(propertiesTable)
      .where(ownership);
    if (!property) return null;

    // Keep independent leads and tasks, but detach them before removing the
    // listing. Other dependent records have no useful meaning without it.
    await tx.update(tasksTable).set({ propertyId: null }).where(eq(tasksTable.propertyId, id));
    await tx.update(leadsTable).set({ propertyId: null }).where(eq(leadsTable.propertyId, id));
    await tx.delete(viewingsTable).where(eq(viewingsTable.propertyId, id));
    await tx.delete(documentsTable).where(eq(documentsTable.propertyId, id));
    await tx.delete(savedPropertiesTable).where(eq(savedPropertiesTable.propertyId, id));
    await tx.delete(collaborationMatchRequestsTable).where(eq(collaborationMatchRequestsTable.propertyId, id));
    await tx.delete(priceHistoryTable).where(eq(priceHistoryTable.propertyId, id));
    const [deleted] = await tx.delete(propertiesTable).where(ownership).returning();
    return deleted;
  });
  if (!row) {
    // A queued client may retry after the first delete committed but before it
    // received the 204 response. Treat that retry as complete so it cannot
    // block later offline mutations.
    res.sendStatus(204);
    return;
  }
  await logAudit("deleted", "property", id, `Deleted ${row.reference}`, user?.id, user?.name);
  res.sendStatus(204);
});

router.get("/properties/:id/price-history", async (req, res): Promise<void> => {
  const id = parseId(req);
  const user = await currentUser(req);
  const propertyCondition = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(propertiesTable.id, id), eq(propertiesTable.agentId, user.id))
    : eq(propertiesTable.id, id);
  const [property] = await db.select({ id: propertiesTable.id }).from(propertiesTable).where(propertyCondition);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const rows = await db
    .select()
    .from(priceHistoryTable)
    .where(eq(priceHistoryTable.propertyId, id))
    .orderBy(desc(priceHistoryTable.changedAt));
  res.json(GetPropertyPriceHistoryResponse.parse(jsonify(rows)));
});

router.get("/properties/:id/activity", async (req, res): Promise<void> => {
  const id = parseId(req);
  const user = await currentUser(req);
  const propertyCondition = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(propertiesTable.id, id), eq(propertiesTable.agentId, user.id))
    : eq(propertiesTable.id, id);
  const [property] = await db.select({ id: propertiesTable.id }).from(propertiesTable).where(propertyCondition);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
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
  const user = await currentUser(req);
  const propertyCondition = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(propertiesTable.id, id), eq(propertiesTable.agentId, user.id))
    : eq(propertiesTable.id, id);
  const [existing] = await db.select().from(propertiesTable).where(propertyCondition);
  if (!existing) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  await db
    .update(propertiesTable)
    .set({ shares: existing.shares + 1 })
    .where(eq(propertiesTable.id, id));
  const url = `${req.protocol}://${req.get("host")}/properties/${existing.reference.toLowerCase()}`;
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
  const user = await currentUser(req);
  const propertyCondition = user?.role === "agent" || user?.role === "senior_agent"
    ? and(eq(propertiesTable.id, id), eq(propertiesTable.agentId, user.id))
    : eq(propertiesTable.id, id);
  const [existing] = await db.select().from(propertiesTable).where(propertyCondition);
  if (!existing) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
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
