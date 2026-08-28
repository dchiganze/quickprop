import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  leadsTable,
  propertiesTable,
  propertyAgentRelationshipsTable,
  propertyDuplicateReviewsTable,
  propertyMergeHistoryTable,
  tasksTable,
  viewingsTable,
  documentsTable,
  savedPropertiesTable,
} from "@workspace/db";
import { currentUser, requireRole } from "./auth";
import { jsonify, logActivity, logAudit, parseId } from "../lib/helpers";
import {
  canonicalPropertyId,
  findDuplicateCandidates,
  getCanonicalProperty,
  getPropertyOffers,
  type DuplicateInput,
} from "../lib/multi-agent";

const router: IRouter = Router();
const adminOnly = requireRole("principal", "admin");

const duplicateInputSchema = z.object({
  address: z.string().nullish(),
  suburb: z.string().nullish(),
  city: z.string().nullish(),
  propertyType: z.string().nullish(),
  bedrooms: z.number().nullish(),
  bathrooms: z.number().nullish(),
  landSize: z.number().nullish(),
  buildingSize: z.number().nullish(),
  price: z.number().nullish(),
  description: z.string().nullish(),
  phone: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  photos: z.array(z.string()).nullish(),
});

const relationshipSchema = z.object({
  askingPrice: z.number().positive(),
  currency: z.string().default("USD"),
  mandateType: z.string().default("non_exclusive"),
  terms: z.string().nullish(),
  description: z.string().nullish(),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
  contactEmail: z.string().email().nullish(),
  verificationStatus: z.string().default("pending"),
});

function matchSummary(match: Awaited<ReturnType<typeof findDuplicateCandidates>>[number]) {
  return {
    id: match.property.id,
    reference: match.property.reference,
    title: match.property.title,
    address: match.property.address,
    suburb: match.property.suburb,
    city: match.property.city,
    propertyType: match.property.propertyType,
    bedrooms: match.property.bedrooms,
    bathrooms: match.property.bathrooms,
    landSize: match.property.landSize,
    buildingSize: match.property.buildingSize,
    price: match.property.price,
    currency: match.property.currency,
    photos: match.property.photos,
    status: match.property.status,
    updatedAt: match.property.updatedAt,
    confidenceScore: match.confidenceScore,
    matchingFields: match.matchingFields,
    imageMatches: match.imageMatches,
    agencyName: match.agencyName,
  };
}

router.post("/properties/duplicate-check", async (req, res): Promise<void> => {
  const parsed = duplicateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const matches = await findDuplicateCandidates(parsed.data as DuplicateInput);
  const topScore = matches[0]?.confidenceScore ?? 0;
  res.json({
    confidenceScore: topScore,
    decision: topScore > 95 ? "high_confidence" : topScore >= 80 ? "possible_duplicate" : "continue",
    matches: matches.map(matchSummary),
  });
});

router.get("/properties/:id/multi-agent", async (req, res): Promise<void> => {
  const id = parseId(req);
  const property = await getCanonicalProperty(id);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const offers = await getPropertyOffers(property.id);
  res.json(jsonify({
    property,
    propertyId: property.id,
    offers,
    agencyCount: new Set(offers.map((offer) => offer.agencyName)).size,
    lowestPrice: offers.length ? Math.min(...offers.map((offer) => offer.askingPrice)) : property.price,
    lastAvailabilityVerification: offers
      .map((offer) => offer.lastAvailabilityConfirmation)
      .filter(Boolean)
      .sort()
      .at(-1) ?? property.lastAvailabilityConfirmedAt,
  }));
});

router.post("/properties/:id/relationships", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = relationshipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const property = await getCanonicalProperty(id);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const [existing] = await db.select().from(propertyAgentRelationshipsTable).where(and(
    eq(propertyAgentRelationshipsTable.propertyId, property.id),
    eq(propertyAgentRelationshipsTable.agentId, user.id),
    eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
  ));
  if (existing) {
    res.status(409).json({ error: "Your agency is already associated with this property.", relationship: jsonify(existing) });
    return;
  }
  const [relationship] = await db.insert(propertyAgentRelationshipsTable).values({
    propertyId: property.id,
    agentId: user.id,
    branchId: user.branchId ?? null,
    ...parsed.data,
    lastAvailabilityConfirmation: new Date(),
    lastUpdate: new Date(),
  }).returning();
  await db.update(propertiesTable).set({ duplicateStatus: "clear", updatedAt: new Date() }).where(eq(propertiesTable.id, property.id));
  await logActivity("agency_added", `${user.name} added an agency relationship to ${property.reference}`, "property", property.id, user.name);
  await logAudit("agency_added", "property", property.id, `${user.name} added an agency relationship`, user.id, user.name);
  res.status(201).json(jsonify(relationship));
});

router.post("/properties/:id/health", async (req, res): Promise<void> => {
  const id = parseId(req);
  const action = z.object({ action: z.enum(["still_available", "update", "sold", "let", "withdraw"]) }).safeParse(req.body);
  if (!action.success) {
    res.status(400).json({ error: action.error.message });
    return;
  }
  const user = await currentUser(req);
  const property = await getCanonicalProperty(id);
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const now = new Date();
  const status = action.data.action === "sold" ? "sold"
    : action.data.action === "let" ? "rented"
      : action.data.action === "withdraw" ? "withdrawn" : property.status;
  await db.update(propertiesTable).set({
    status,
    lastAvailabilityConfirmedAt: now,
    lastPriceConfirmedAt: action.data.action === "update" ? now : property.lastPriceConfirmedAt,
    updatedAt: now,
  }).where(eq(propertiesTable.id, property.id));
  if (user) await logAudit("availability_confirmed", "property", property.id, `${user.name}: ${action.data.action}`, user.id, user.name);
  res.json({ ok: true, status, confirmedAt: now.toISOString() });
});

router.get("/admin/duplicates", adminOnly, async (_req, res): Promise<void> => {
  const reviews = await db.select().from(propertyDuplicateReviewsTable)
    .where(eq(propertyDuplicateReviewsTable.status, "pending"))
    .orderBy(desc(propertyDuplicateReviewsTable.confidenceScore), desc(propertyDuplicateReviewsTable.createdAt));
  const propertyIds = [...new Set(reviews.flatMap((review) => [review.sourcePropertyId, review.candidatePropertyId]))];
  const properties = propertyIds.length ? await db.select().from(propertiesTable).where(inArray(propertiesTable.id, propertyIds)) : [];
  res.json(jsonify(reviews.map((review) => ({
    ...review,
    sourceProperty: properties.find((property) => property.id === review.sourcePropertyId) ?? null,
    candidateProperty: properties.find((property) => property.id === review.candidatePropertyId) ?? null,
  }))));
});

router.get("/admin/duplicates/:id", adminOnly, async (req, res): Promise<void> => {
  const reviewId = parseId(req);
  const [review] = await db.select().from(propertyDuplicateReviewsTable).where(eq(propertyDuplicateReviewsTable.id, reviewId));
  if (!review) {
    res.status(404).json({ error: "Duplicate review not found" });
    return;
  }
  const [source, candidate] = await Promise.all([
    db.select().from(propertiesTable).where(eq(propertiesTable.id, review.sourcePropertyId)).then((rows) => rows[0]),
    db.select().from(propertiesTable).where(eq(propertiesTable.id, review.candidatePropertyId)).then((rows) => rows[0]),
  ]);
  res.json(jsonify({
    review,
    sourceProperty: source,
    candidateProperty: candidate,
    sourceOffers: source ? await getPropertyOffers(source.id) : [],
    candidateOffers: candidate ? await getPropertyOffers(candidate.id) : [],
  }));
});

router.post("/admin/duplicates/:id/keep-separate", adminOnly, async (req, res): Promise<void> => {
  const reviewId = parseId(req);
  const actor = await currentUser(req);
  const [review] = await db.update(propertyDuplicateReviewsTable)
    .set({ status: "keep_separate", reviewedBy: actor?.id ?? null, reviewedAt: new Date(), notes: req.body?.notes ?? null })
    .where(eq(propertyDuplicateReviewsTable.id, reviewId))
    .returning();
  if (!review) {
    res.status(404).json({ error: "Duplicate review not found" });
    return;
  }
  await db.update(propertiesTable).set({ duplicateStatus: "keep_separate" }).where(or(
    eq(propertiesTable.id, review.sourcePropertyId),
    eq(propertiesTable.id, review.candidatePropertyId),
  ));
  await logAudit("duplicate_kept_separate", "property_duplicate_review", reviewId, "Admin kept records separate", actor?.id, actor?.name);
  res.json(jsonify(review));
});

router.post("/admin/duplicates/:id/request-information", adminOnly, async (req, res): Promise<void> => {
  const reviewId = parseId(req);
  const actor = await currentUser(req);
  const [review] = await db.update(propertyDuplicateReviewsTable)
    .set({ status: "information_requested", reviewedBy: actor?.id ?? null, reviewedAt: new Date(), notes: req.body?.notes ?? null })
    .where(eq(propertyDuplicateReviewsTable.id, reviewId))
    .returning();
  if (!review) {
    res.status(404).json({ error: "Duplicate review not found" });
    return;
  }
  await logAudit("duplicate_information_requested", "property_duplicate_review", reviewId, review.notes ?? "Admin requested more information", actor?.id, actor?.name);
  res.json(jsonify(review));
});

router.post("/admin/duplicates/:id/merge", adminOnly, async (req, res): Promise<void> => {
  const reviewId = parseId(req);
  const canonicalId = Number(req.body?.canonicalPropertyId);
  if (!Number.isInteger(canonicalId)) {
    res.status(400).json({ error: "canonicalPropertyId is required" });
    return;
  }
  const actor = await currentUser(req);
  const result = await db.transaction(async (tx) => {
    const [review] = await tx.select().from(propertyDuplicateReviewsTable).where(eq(propertyDuplicateReviewsTable.id, reviewId));
    if (!review || review.status === "merged") return null;
    const sourceId = review.sourcePropertyId === canonicalId ? review.candidatePropertyId : review.sourcePropertyId;
    const [canonical] = await tx.select().from(propertiesTable).where(eq(propertiesTable.id, canonicalId));
    const [source] = await tx.select().from(propertiesTable).where(eq(propertiesTable.id, sourceId));
    if (!canonical || !source) return null;
    const sourceSnapshot = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
    await tx.update(leadsTable).set({ propertyId: canonical.id }).where(eq(leadsTable.propertyId, source.id));
    await tx.update(tasksTable).set({ propertyId: canonical.id }).where(eq(tasksTable.propertyId, source.id));
    await tx.update(viewingsTable).set({ propertyId: canonical.id }).where(eq(viewingsTable.propertyId, source.id));
    await tx.update(documentsTable).set({ propertyId: canonical.id }).where(eq(documentsTable.propertyId, source.id));
    await tx.update(savedPropertiesTable).set({ propertyId: canonical.id }).where(eq(savedPropertiesTable.propertyId, source.id));
    await tx.update(propertiesTable).set({
      views: (canonical.views ?? 0) + (source.views ?? 0),
      enquiries: (canonical.enquiries ?? 0) + (source.enquiries ?? 0),
      shares: (canonical.shares ?? 0) + (source.shares ?? 0),
      updatedAt: new Date(),
    }).where(eq(propertiesTable.id, canonical.id));
    await tx.update(propertiesTable).set({
      canonicalPropertyId: canonical.id,
      duplicateStatus: "merged",
      status: "archived",
      updatedAt: new Date(),
    }).where(eq(propertiesTable.id, source.id));
    await tx.update(propertyDuplicateReviewsTable).set({
      status: "merged",
      canonicalPropertyId: canonical.id,
      reviewedBy: actor?.id ?? null,
      reviewedAt: new Date(),
    }).where(eq(propertyDuplicateReviewsTable.id, review.id));
    const [history] = await tx.insert(propertyMergeHistoryTable).values({
      reviewId: review.id,
      sourcePropertyId: source.id,
      canonicalPropertyId: canonical.id,
      snapshot: sourceSnapshot,
      mergedBy: actor?.id ?? null,
    }).returning();
    return { review, canonical, source, history };
  });
  if (!result) {
    res.status(404).json({ error: "Duplicate review or property not found" });
    return;
  }
  await logActivity("merged", `${result.source.reference} merged into ${result.canonical.reference}`, "property", result.canonical.id, actor?.name);
  await logAudit("merged", "property", result.canonical.id, `${result.source.reference} merged into ${result.canonical.reference}`, actor?.id, actor?.name);
  res.json(jsonify(result));
});

router.post("/admin/duplicates/:id/unmerge", adminOnly, async (req, res): Promise<void> => {
  const reviewId = parseId(req);
  const actor = await currentUser(req);
  const [history] = await db.select().from(propertyMergeHistoryTable)
    .where(and(eq(propertyMergeHistoryTable.reviewId, reviewId), eq(propertyMergeHistoryTable.status, "merged")))
    .orderBy(desc(propertyMergeHistoryTable.mergedAt));
  if (!history) {
    res.status(404).json({ error: "No active merge history found" });
    return;
  }
  const snapshot = history.snapshot as { status?: string; duplicateStatus?: string };
  const result = await db.transaction(async (tx) => {
    const [source] = await tx.update(propertiesTable).set({
      canonicalPropertyId: null,
      status: snapshot.status ?? "draft",
      duplicateStatus: snapshot.duplicateStatus ?? "clear",
      updatedAt: new Date(),
    }).where(eq(propertiesTable.id, history.sourcePropertyId)).returning();
    const [review] = await tx.update(propertyDuplicateReviewsTable).set({
      status: "pending",
      canonicalPropertyId: null,
      reviewedBy: actor?.id ?? null,
      reviewedAt: new Date(),
    }).where(eq(propertyDuplicateReviewsTable.id, reviewId)).returning();
    await tx.update(propertyMergeHistoryTable).set({ status: "unmerged", unmergedAt: new Date() })
      .where(eq(propertyMergeHistoryTable.id, history.id));
    return { source, review };
  });
  await logAudit("unmerged", "property", history.sourcePropertyId, "Admin reversed a property merge", actor?.id, actor?.name);
  res.json(jsonify(result));
});

export default router;