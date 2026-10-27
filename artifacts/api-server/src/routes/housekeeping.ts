import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  listingHousekeepingEventsTable,
  listingHousekeepingPreferencesTable,
  listingHousekeepingSettingsTable,
  notificationsTable,
  propertiesTable,
  propertyAgentRelationshipsTable,
  tasksTable,
  userPushTokensTable,
  type Property,
  type PropertyAgentRelationship,
} from "@workspace/db";
import { currentUser, requireRole } from "./auth";
import { jsonify, logAudit } from "../lib/helpers";
import {
  AVAILABILITY_STATES,
  calculateFreshness,
  DEFAULT_HOUSEKEEPING_SETTINGS,
  HOUSEKEEPING_ACTIVE_STATUSES,
  normalizeHousekeepingSettings,
  publicFreshnessLabel,
  type FreshnessStatus,
  type HousekeepingSettings,
} from "../lib/housekeeping";
import { runHousekeepingCycle } from "../lib/housekeeping-job";

const router: IRouter = Router();
const adminOnly = requireRole("principal", "admin", "quickprop_admin");

type HousekeepingEntry = {
  property: Property;
  relationship: PropertyAgentRelationship | null;
  source: "property" | "relationship";
  expiredDraft: boolean;
};

function userIsAgent(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.role === "agent" || user?.role === "senior_agent";
}

async function settings(): Promise<HousekeepingSettings> {
  const [row] = await db.select().from(listingHousekeepingSettingsTable).limit(1);
  return normalizeHousekeepingSettings(row ?? DEFAULT_HOUSEKEEPING_SETTINGS);
}

async function entriesFor(user: Awaited<ReturnType<typeof currentUser>>, includeInactive = false): Promise<HousekeepingEntry[]> {
  const statuses = includeInactive
    ? [...HOUSEKEEPING_ACTIVE_STATUSES, "sold", "rented", "withdrawn", "archived"]
    : [...HOUSEKEEPING_ACTIVE_STATUSES];
  const properties = await db.select().from(propertiesTable).where(
    userIsAgent(user)
      ? and(eq(propertiesTable.agentId, user!.id), inArray(propertiesTable.status, statuses))
      : inArray(propertiesTable.status, statuses),
  );
  const propertyIds = properties.map((p) => p.id);
  if (propertyIds.length === 0) return [];
  const relationships = await db.select().from(propertyAgentRelationshipsTable).where(
    and(
      inArray(propertyAgentRelationshipsTable.propertyId, propertyIds),
      eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
      userIsAgent(user) ? eq(propertyAgentRelationshipsTable.agentId, user!.id) : undefined,
    ),
  );
  const lifecycleEvents = await db.select({
    propertyId: listingHousekeepingEventsTable.propertyId,
    eventType: listingHousekeepingEventsTable.eventType,
  }).from(listingHousekeepingEventsTable).where(and(
    inArray(listingHousekeepingEventsTable.propertyId, propertyIds),
    isNull(listingHousekeepingEventsTable.relationshipId),
    inArray(listingHousekeepingEventsTable.eventType, ["auto_drafted", "republished"]),
  )).orderBy(desc(listingHousekeepingEventsTable.createdAt), desc(listingHousekeepingEventsTable.id));
  const latestLifecycleEventByProperty = new Map<number, string>();
  for (const event of lifecycleEvents) {
    if (!latestLifecycleEventByProperty.has(event.propertyId)) {
      latestLifecycleEventByProperty.set(event.propertyId, event.eventType);
    }
  }
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const result: HousekeepingEntry[] = relationships
    .filter((relationship) => relationship.agentId !== propertyById.get(relationship.propertyId)?.agentId)
    .map((relationship) => ({
    property: properties.find((p) => p.id === relationship.propertyId)!,
    relationship,
    source: "relationship",
    expiredDraft: false,
  }));
  for (const property of properties) {
    result.push({
      property,
      relationship: null,
      source: "property",
      expiredDraft: property.status === "draft" && latestLifecycleEventByProperty.get(property.id) === "auto_drafted",
    });
  }
  return result.filter((entry) => entry.property);
}

function entryPayload(entry: HousekeepingEntry, houseSettings: HousekeepingSettings) {
  const p = entry.property;
  const r = entry.relationship;
  const confirmationAnchor = r
    ? r.lastAvailabilityConfirmation ?? r.createdAt
    : p.lastAvailabilityConfirmedAt ?? p.publishedAt
      ?? (p.status === "public" ? new Date() : p.createdAt);
  const computed = calculateFreshness({
    createdAt: r?.createdAt ?? confirmationAnchor,
    lastConfirmedAt: r?.lastAvailabilityConfirmation ?? p.lastAvailabilityConfirmedAt,
    lastUpdatedAt: r?.lastUpdate ?? p.updatedAt,
    nextConfirmationAt: r?.nextConfirmationAt ?? new Date(
      confirmationAnchor.getTime() + houseSettings.recurringConfirmationDays * 86400000,
    ),
    availabilityStatus: r?.availabilityStatus ?? p.availabilityStatus,
    photos: p.photos,
    title: p.title,
    description: r?.description ?? p.description,
    price: r?.askingPrice ?? p.price,
    suburb: p.suburb,
    propertyType: p.propertyType,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
  }, new Date(), houseSettings);
  return {
    id: r?.id ?? p.id,
    propertyId: p.id,
    relationshipId: r?.id ?? null,
    agentId: r?.agentId ?? p.agentId,
    agencyId: r?.branchId ?? p.branchId,
    reference: p.reference,
    title: p.title,
    suburb: p.suburb,
    city: p.city,
    price: r?.askingPrice ?? p.price,
    currency: r?.currency ?? p.currency,
    status: p.status,
    availabilityStatus: r?.availabilityStatus ?? p.availabilityStatus,
    freshnessStatus: computed.freshnessStatus,
    freshnessLabel: publicFreshnessLabel(
      computed.freshnessStatus,
      r?.lastAvailabilityConfirmation ?? p.lastAvailabilityConfirmedAt,
      r?.lastUpdate ?? p.updatedAt,
    ),
    lastConfirmedAt: r?.lastAvailabilityConfirmation ?? p.lastAvailabilityConfirmedAt,
    lastUpdate: r?.lastUpdate ?? p.updatedAt,
    nextConfirmationAt: computed.nextConfirmationAt,
    daysSinceConfirmation: computed.daysSinceConfirmation,
    freshnessScore: computed.freshnessScore,
    qualityScore: computed.qualityScore,
    reminderCount: r?.reminderCount ?? p.reminderCount,
    staleSince: computed.staleSince,
    photos: p.photos,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    expiredDraft: entry.expiredDraft,
  };
}

async function findEntry(user: Awaited<ReturnType<typeof currentUser>>, propertyId?: number, relationshipId?: number) {
  const entries = await entriesFor(user, true);
  return entries.find((entry) =>
    relationshipId != null ? entry.relationship?.id === relationshipId : entry.property.id === propertyId,
  ) ?? null;
}

function requestSource(req: Request): string {
  const source = req.get("X-QuickProp-Source");
  return source === "mobile" || source === "office" || source === "admin" ? source : "api";
}

function optionalId(value: unknown): number | undefined {
  const id = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

async function writeConfirmation(entry: HousekeepingEntry, actorId: number, source: string) {
  const now = new Date();
  const houseSettings = await settings();
  const next = new Date(now.getTime() + houseSettings.recurringConfirmationDays * 86400000);
  const computed = calculateFreshness({
    createdAt: entry.relationship?.createdAt ?? entry.property.createdAt,
    lastConfirmedAt: now,
    lastUpdatedAt: entry.relationship?.lastUpdate ?? entry.property.updatedAt,
    nextConfirmationAt: next,
    availabilityStatus: "available",
    photos: entry.property.photos,
    title: entry.property.title,
    description: entry.relationship?.description ?? entry.property.description,
    price: entry.relationship?.askingPrice ?? entry.property.price,
    suburb: entry.property.suburb,
    propertyType: entry.property.propertyType,
    bedrooms: entry.property.bedrooms,
    bathrooms: entry.property.bathrooms,
  }, now, houseSettings);
  if (entry.relationship) {
    await db.update(propertyAgentRelationshipsTable).set({
      lastAvailabilityConfirmation: now,
      availabilityStatus: "available",
      freshnessStatus: "fresh",
      nextConfirmationAt: next,
      daysSinceConfirmation: 0,
      freshnessScore: computed.freshnessScore,
      qualityScore: computed.qualityScore,
      staleSince: null,
      updatedAt: now,
    }).where(eq(propertyAgentRelationshipsTable.id, entry.relationship.id));
  } else {
    await db.update(propertiesTable).set({
      lastAvailabilityConfirmedAt: now,
      availabilityStatus: "available",
      freshnessStatus: "fresh",
      nextConfirmationAt: next,
      daysSinceConfirmation: 0,
      freshnessScore: computed.freshnessScore,
      qualityScore: computed.qualityScore,
      staleSince: null,
      updatedAt: now,
    }).where(eq(propertiesTable.id, entry.property.id));
    if (entry.property.agentId) {
      await db.update(propertyAgentRelationshipsTable).set({
        lastAvailabilityConfirmation: now,
        availabilityStatus: "available",
        freshnessStatus: "fresh",
        nextConfirmationAt: next,
        daysSinceConfirmation: 0,
        freshnessScore: computed.freshnessScore,
        qualityScore: computed.qualityScore,
        staleSince: null,
        lastUpdate: now,
        updatedAt: now,
      }).where(and(
        eq(propertyAgentRelationshipsTable.propertyId, entry.property.id),
        eq(propertyAgentRelationshipsTable.agentId, entry.property.agentId),
        eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
      ));
    }
  }
  await db.insert(listingHousekeepingEventsTable).values({
    listingId: entry.relationship?.id ?? entry.property.id,
    propertyId: entry.property.id,
    relationshipId: entry.relationship?.id ?? null,
    agentId: entry.relationship?.agentId ?? entry.property.agentId,
    agencyId: entry.relationship?.branchId ?? entry.property.branchId,
    eventType: "confirmed",
    previousStatus: entry.relationship?.freshnessStatus ?? entry.property.freshnessStatus,
    newStatus: "fresh",
    source,
    metadata: { actorId },
  });
  await logAudit("listing_confirmed", "listing_housekeeping", entry.relationship?.id ?? entry.property.id,
    `Listing ${entry.property.reference} availability confirmed`, actorId);
  return { confirmedAt: now, nextConfirmationAt: next };
}

async function republishExpiredListing(entry: HousekeepingEntry, actorId: number, source: string) {
  if (entry.relationship || !entry.expiredDraft) {
    throw new Error("Only a listing moved to drafts for expired availability can be republished here.");
  }
  if (entry.property.photos.length < 1) {
    throw new Error("Upload at least one property photo before republishing.");
  }

  const now = new Date();
  const houseSettings = await settings();
  const next = new Date(now.getTime() + houseSettings.recurringConfirmationDays * 86400000);
  const computed = calculateFreshness({
    createdAt: entry.property.publishedAt ?? entry.property.createdAt,
    lastConfirmedAt: now,
    lastUpdatedAt: now,
    nextConfirmationAt: next,
    availabilityStatus: "available",
    photos: entry.property.photos,
    title: entry.property.title,
    description: entry.property.description,
    price: entry.property.price,
    suburb: entry.property.suburb,
    propertyType: entry.property.propertyType,
    bedrooms: entry.property.bedrooms,
    bathrooms: entry.property.bathrooms,
  }, now, houseSettings);

  const [updated] = await db.update(propertiesTable).set({
    status: "public",
    pipelineStage: "published",
    publishedAt: now,
    lastAvailabilityConfirmedAt: now,
    availabilityStatus: "available",
    freshnessStatus: "fresh",
    nextConfirmationAt: next,
    daysSinceConfirmation: 0,
    freshnessScore: computed.freshnessScore,
    qualityScore: computed.qualityScore,
    staleSince: null,
    updatedAt: now,
  }).where(and(
    eq(propertiesTable.id, entry.property.id),
    eq(propertiesTable.status, "draft"),
  )).returning();
  if (!updated) throw new Error("This listing is no longer a draft. Refresh and try again.");
  if (entry.property.agentId) {
    await db.update(propertyAgentRelationshipsTable).set({
      lastAvailabilityConfirmation: now,
      availabilityStatus: "available",
      freshnessStatus: "fresh",
      nextConfirmationAt: next,
      daysSinceConfirmation: 0,
      freshnessScore: computed.freshnessScore,
      qualityScore: computed.qualityScore,
      staleSince: null,
      lastUpdate: now,
      updatedAt: now,
    }).where(and(
      eq(propertyAgentRelationshipsTable.propertyId, entry.property.id),
      eq(propertyAgentRelationshipsTable.agentId, entry.property.agentId),
      eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
    ));
  }

  await db.insert(listingHousekeepingEventsTable).values({
    listingId: entry.property.id,
    propertyId: entry.property.id,
    relationshipId: null,
    agentId: entry.property.agentId,
    agencyId: entry.property.branchId,
    eventType: "republished",
    previousStatus: "draft",
    newStatus: "public",
    source,
    metadata: { actorId },
  });
  await logAudit("listing_republished", "listing_housekeeping", entry.property.id,
    `Listing ${entry.property.reference} republished after availability confirmation`, actorId);
  return { confirmedAt: now, nextConfirmationAt: next };
}

async function archiveListing(entry: HousekeepingEntry, actorId: number, source: string) {
  const now = new Date();
  if (entry.relationship) {
    await db.update(propertyAgentRelationshipsTable).set({
      relationshipStatus: "archived",
      availabilityStatus: "withdrawn",
      freshnessStatus: "inactive",
      staleSince: null,
      updatedAt: now,
    }).where(eq(propertyAgentRelationshipsTable.id, entry.relationship.id));
  } else {
    await db.update(propertiesTable).set({
      status: "archived",
      pipelineStage: "archived",
      availabilityStatus: "withdrawn",
      freshnessStatus: "inactive",
      nextConfirmationAt: null,
      staleSince: null,
      updatedAt: now,
    }).where(eq(propertiesTable.id, entry.property.id));
    await db.update(propertyAgentRelationshipsTable).set({
      relationshipStatus: "archived",
      availabilityStatus: "withdrawn",
      freshnessStatus: "inactive",
      staleSince: null,
      updatedAt: now,
    }).where(and(
      eq(propertyAgentRelationshipsTable.propertyId, entry.property.id),
      eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
    ));
  }
  await db.insert(listingHousekeepingEventsTable).values({
    listingId: entry.relationship?.id ?? entry.property.id,
    propertyId: entry.property.id,
    relationshipId: entry.relationship?.id ?? null,
    agentId: entry.relationship?.agentId ?? entry.property.agentId,
    agencyId: entry.relationship?.branchId ?? entry.property.branchId,
    eventType: "archived",
    previousStatus: entry.property.status,
    newStatus: "archived",
    source,
    metadata: { actorId, preservesBusinessHistory: true },
  });
  await logAudit("listing_archived", "listing_housekeeping", entry.relationship?.id ?? entry.property.id,
    `Listing ${entry.property.reference} archived without deleting its history`, actorId);
}

async function setAvailability(entry: HousekeepingEntry, availabilityStatus: string, actorId: number, source: string) {
  if (!AVAILABILITY_STATES.includes(availabilityStatus as typeof AVAILABILITY_STATES[number])) {
    throw new Error("Invalid availability state");
  }
  const now = new Date();
  const freshnessStatus = availabilityStatus === "available" || availabilityStatus === "under_offer" ? "fresh" : "inactive";
  const propertyStatus = availabilityStatus === "sold" ? "sold"
    : availabilityStatus === "let" ? "rented"
      : availabilityStatus === "withdrawn" ? "withdrawn" : undefined;
  if (entry.relationship) {
    await db.update(propertyAgentRelationshipsTable).set({
      availabilityStatus,
      freshnessStatus,
      ...(propertyStatus ? {} : {}),
      updatedAt: now,
    }).where(eq(propertyAgentRelationshipsTable.id, entry.relationship.id));
  } else {
    await db.update(propertiesTable).set({
      availabilityStatus,
      freshnessStatus,
      ...(propertyStatus ? { status: propertyStatus } : {}),
      updatedAt: now,
    }).where(eq(propertiesTable.id, entry.property.id));
  }
  await db.insert(listingHousekeepingEventsTable).values({
    listingId: entry.relationship?.id ?? entry.property.id,
    propertyId: entry.property.id,
    relationshipId: entry.relationship?.id ?? null,
    agentId: entry.relationship?.agentId ?? entry.property.agentId,
    agencyId: entry.relationship?.branchId ?? entry.property.branchId,
    eventType: availabilityStatus === "available" ? "reactivated" : "availability_changed",
    previousStatus: entry.relationship?.availabilityStatus ?? entry.property.availabilityStatus,
    newStatus: availabilityStatus,
    source,
    metadata: { actorId },
  });
  await logAudit("listing_availability_changed", "listing_housekeeping", entry.relationship?.id ?? entry.property.id,
    `Listing ${entry.property.reference} marked ${availabilityStatus.replace("_", " ")}`, actorId);
}

router.get("/listing-housekeeping", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const houseSettings = await settings();
  const listings = (await entriesFor(user)).map((entry) => entryPayload(entry, houseSettings));
  const counts = listings.reduce<Record<string, number>>((acc, listing) => {
    acc[listing.freshnessStatus] = (acc[listing.freshnessStatus] ?? 0) + 1;
    return acc;
  }, {});
  res.json(jsonify({
    summary: {
      total: listings.length,
      new: counts.new ?? 0,
      fresh: counts.fresh ?? 0,
      due: counts.due ?? 0,
      updateRequired: counts.update_required ?? 0,
      potentiallyStale: counts.potentially_stale ?? 0,
      stale: counts.stale ?? 0,
      inactive: counts.inactive ?? 0,
    },
    listings,
    thresholds: houseSettings,
  }));
});

router.post("/listing-housekeeping/confirm", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const entry = await findEntry(user, optionalId(req.body?.propertyId), optionalId(req.body?.relationshipId));
  if (!entry) { res.status(404).json({ error: "Listing not found or not assigned to you" }); return; }
  if (entry.expiredDraft) {
    res.status(409).json({ error: "This listing has expired. Republish it or archive it instead of confirming it." });
    return;
  }
  const result = await writeConfirmation(entry, user!.id, requestSource(req));
  res.json(jsonify({ ok: true, ...result, listing: entryPayload(entry, await settings()) }));
});

router.post("/listing-housekeeping/bulk-confirm", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const ids = new Set((Array.isArray(req.body?.relationshipIds) ? req.body.relationshipIds : []).map(Number));
  const propertyIds = new Set((Array.isArray(req.body?.propertyIds) ? req.body.propertyIds : []).map(Number));
  const entries = (await entriesFor(user)).filter((entry) => ids.has(entry.relationship?.id ?? -1) || propertyIds.has(entry.property.id));
  if (entries.some((entry) => entry.expiredDraft)) {
    res.status(409).json({ error: "Expired drafts must be republished or archived individually." });
    return;
  }
  for (const entry of entries) await writeConfirmation(entry, user!.id, requestSource(req));
  res.json({ ok: true, confirmed: entries.length });
});

router.post("/listing-housekeeping/action", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const entry = await findEntry(user, optionalId(req.body?.propertyId), optionalId(req.body?.relationshipId));
  if (!entry) { res.status(404).json({ error: "Listing not found or not assigned to you" }); return; }
  const action = req.body?.action as string;
  if (action === "republish") {
    try {
      await republishExpiredListing(entry, user!.id, requestSource(req));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Unable to republish listing." });
      return;
    }
  } else if (action === "archive") {
    await archiveListing(entry, user!.id, requestSource(req));
  } else if (entry.expiredDraft && (action === "confirm" || action === "update")) {
    res.status(409).json({ error: "This listing has expired. Republish it or archive it instead of confirming it." });
    return;
  } else {
  const state = action === "mark_unavailable" ? "temporarily_unavailable"
    : action === "reactivate" ? "available"
      : action;
    if (action === "update" || action === "confirm") {
      await writeConfirmation(entry, user!.id, requestSource(req));
    } else {
      try { await setAvailability(entry, state, user!.id, requestSource(req)); }
      catch { res.status(400).json({ error: "Unsupported housekeeping action" }); return; }
    }
  }
  res.json(jsonify({ ok: true, listing: entryPayload(entry, await settings()) }));
});

router.get("/listing-housekeeping/preferences", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const [existing] = await db.select().from(listingHousekeepingPreferencesTable).where(eq(listingHousekeepingPreferencesTable.userId, user!.id));
  res.json(jsonify(existing ?? {
    userId: user!.id,
    whatsappEnabled: true,
    pushEnabled: true,
    emailEnabled: true,
    viewingReminderEnabled: true,
    reminderFrequency: "smart",
  }));
});

router.patch("/listing-housekeeping/preferences", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const values = {
    userId: user!.id,
    whatsappEnabled: req.body?.whatsappEnabled !== false,
    pushEnabled: req.body?.pushEnabled !== false,
    emailEnabled: req.body?.emailEnabled !== false,
    viewingReminderEnabled: req.body?.viewingReminderEnabled !== false,
    reminderFrequency: typeof req.body?.reminderFrequency === "string" ? req.body.reminderFrequency : "smart",
    updatedAt: new Date(),
  };
  const [row] = await db.insert(listingHousekeepingPreferencesTable).values(values)
    .onConflictDoUpdate({ target: listingHousekeepingPreferencesTable.userId, set: values }).returning();
  res.json(jsonify(row));
});

router.post("/listing-housekeeping/push-tokens", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const platform = typeof req.body?.platform === "string" ? req.body.platform.trim() : "unknown";
  if (!token || token.length > 500) {
    res.status(400).json({ error: "A valid push token is required" });
    return;
  }
  const [row] = await db.insert(userPushTokensTable).values({
    userId: user!.id,
    token,
    platform: platform || "unknown",
    active: true,
    lastSeenAt: new Date(),
  }).onConflictDoUpdate({
    target: [userPushTokensTable.userId, userPushTokensTable.token],
    set: { platform: platform || "unknown", active: true, lastSeenAt: new Date() },
  }).returning();
  res.status(201).json(jsonify(row));
});

router.delete("/listing-housekeeping/push-tokens", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!token) {
    res.status(400).json({ error: "A push token is required" });
    return;
  }
  await db.update(userPushTokensTable).set({ active: false })
    .where(and(eq(userPushTokensTable.userId, user!.id), eq(userPushTokensTable.token, token)));
  res.json({ ok: true });
});

router.get("/admin/listing-health", adminOnly, async (_req, res): Promise<void> => {
  const houseSettings = await settings();
  const listings = (await entriesFor(null)).map((entry) => entryPayload(entry, houseSettings));
  const byAgent = new Map<number, { agentId: number; total: number; stale: number; due: number; averageFreshnessScore: number }>();
  for (const listing of listings) {
    if (!listing.agentId) continue;
    const row = byAgent.get(listing.agentId) ?? { agentId: listing.agentId, total: 0, stale: 0, due: 0, averageFreshnessScore: 0 };
    row.total++;
    row.averageFreshnessScore += listing.freshnessScore;
    if (listing.freshnessStatus === "stale" || listing.freshnessStatus === "potentially_stale") row.stale++;
    if (listing.freshnessStatus === "due" || listing.freshnessStatus === "update_required") row.due++;
    byAgent.set(listing.agentId, row);
  }
  for (const row of byAgent.values()) row.averageFreshnessScore = row.total ? Math.round(row.averageFreshnessScore / row.total) : 0;
  res.json(jsonify({ summary: listings.reduce<Record<string, number>>((a, l) => { a[l.freshnessStatus] = (a[l.freshnessStatus] ?? 0) + 1; return a; }, {}), listings, agents: [...byAgent.values()], thresholds: houseSettings }));
});

router.get("/admin/listing-health/events", adminOnly, async (_req, res): Promise<void> => {
  const events = await db.select().from(listingHousekeepingEventsTable).orderBy(desc(listingHousekeepingEventsTable.createdAt)).limit(200);
  res.json(jsonify(events));
});

router.post("/admin/listing-health/run", adminOnly, async (_req, res): Promise<void> => {
  res.json(jsonify(await runHousekeepingCycle()));
});

router.get("/admin/listing-housekeeping/settings", adminOnly, async (_req, res): Promise<void> => {
  res.json(jsonify(await settings()));
});

router.patch("/admin/listing-housekeeping/settings", adminOnly, async (req, res): Promise<void> => {
  const current = await settings();
  const next = {
    softReminderDays: Number(req.body?.softReminderDays ?? current.softReminderDays),
    firstConfirmationDays: Number(req.body?.firstConfirmationDays ?? current.firstConfirmationDays),
    recurringConfirmationDays: Number(req.body?.recurringConfirmationDays ?? current.recurringConfirmationDays),
    updateRequiredOverdueDays: Number(req.body?.updateRequiredOverdueDays ?? current.updateRequiredOverdueDays),
    potentiallyStaleOverdueDays: Number(req.body?.potentiallyStaleOverdueDays ?? current.potentiallyStaleOverdueDays),
    staleOverdueDays: Number(req.body?.staleOverdueDays ?? current.staleOverdueDays),
    updatedAt: new Date(),
  };
  const [row] = await db.insert(listingHousekeepingSettingsTable).values(next)
    .onConflictDoUpdate({ target: listingHousekeepingSettingsTable.id, set: next }).returning();
  res.json(jsonify(row));
});

export default router;