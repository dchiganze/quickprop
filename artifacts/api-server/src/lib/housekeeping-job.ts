import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  listingHousekeepingEventsTable,
  listingHousekeepingSettingsTable,
  notificationsTable,
  propertiesTable,
  propertyAgentRelationshipsTable,
  tasksTable,
} from "@workspace/db";
import {
  calculateFreshness,
  DEFAULT_HOUSEKEEPING_SETTINGS,
  HOUSEKEEPING_ACTIVE_STATUSES,
  type HousekeepingSettings,
} from "./housekeeping";

async function getSettings(): Promise<HousekeepingSettings> {
  const [row] = await db.select().from(listingHousekeepingSettingsTable).limit(1);
  return row ? {
    softReminderDays: row.softReminderDays,
    firstConfirmationDays: row.firstConfirmationDays,
    recurringConfirmationDays: row.recurringConfirmationDays,
    updateRequiredOverdueDays: row.updateRequiredOverdueDays,
    potentiallyStaleOverdueDays: row.potentiallyStaleOverdueDays,
    staleOverdueDays: row.staleOverdueDays,
  } : DEFAULT_HOUSEKEEPING_SETTINGS;
}

export async function runHousekeepingCycle() {
  const houseSettings = await getSettings();
  const now = new Date();
  const properties = await db.select().from(propertiesTable).where(
    inArray(propertiesTable.status, [...HOUSEKEEPING_ACTIVE_STATUSES]),
  );
  const relationships = await db.select().from(propertyAgentRelationshipsTable).where(
    and(
      inArray(propertyAgentRelationshipsTable.propertyId, properties.map((p) => p.id).length
        ? properties.map((p) => p.id) : [0]),
      eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
    ),
  );
  const relationshipsByProperty = new Map<number, typeof relationships>();
  for (const relationship of relationships) {
    const current = relationshipsByProperty.get(relationship.propertyId) ?? [];
    current.push(relationship);
    relationshipsByProperty.set(relationship.propertyId, current);
  }

  let updated = 0;
  let reminders = 0;
  for (const property of properties) {
    const propertyRelationships = relationshipsByProperty.get(property.id) ?? [];
    const targets = propertyRelationships.length
      ? propertyRelationships.map((relationship) => ({ relationship, property }))
      : [{ relationship: null, property }];
    for (const target of targets) {
      const r = target.relationship;
      const computed = calculateFreshness({
        createdAt: r?.createdAt ?? property.createdAt,
        lastConfirmedAt: r?.lastAvailabilityConfirmation ?? property.lastAvailabilityConfirmedAt,
        lastUpdatedAt: r?.lastUpdate ?? property.updatedAt,
        nextConfirmationAt: r?.nextConfirmationAt ?? property.nextConfirmationAt,
        availabilityStatus: r?.availabilityStatus ?? property.availabilityStatus,
        photos: property.photos,
        title: property.title,
        description: r?.description ?? property.description,
        price: r?.askingPrice ?? property.price,
        suburb: property.suburb,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
      }, now, houseSettings);
      const previousStatus = r?.freshnessStatus ?? property.freshnessStatus;
      const previousReminderCount = r?.reminderCount ?? property.reminderCount;
      if (r) {
        await db.update(propertyAgentRelationshipsTable).set({
          freshnessStatus: computed.freshnessStatus,
          nextConfirmationAt: computed.nextConfirmationAt,
          daysSinceConfirmation: computed.daysSinceConfirmation,
          freshnessScore: computed.freshnessScore,
          qualityScore: computed.qualityScore,
          staleSince: computed.staleSince,
        }).where(eq(propertyAgentRelationshipsTable.id, r.id));
      } else {
        await db.update(propertiesTable).set({
          freshnessStatus: computed.freshnessStatus,
          nextConfirmationAt: computed.nextConfirmationAt,
          daysSinceConfirmation: computed.daysSinceConfirmation,
          freshnessScore: computed.freshnessScore,
          qualityScore: computed.qualityScore,
          staleSince: computed.staleSince,
        }).where(eq(propertiesTable.id, property.id));
      }
      if (previousStatus !== computed.freshnessStatus) {
        updated++;
        await db.insert(listingHousekeepingEventsTable).values({
          listingId: r?.id ?? property.id,
          propertyId: property.id,
          relationshipId: r?.id ?? null,
          agentId: r?.agentId ?? property.agentId,
          agencyId: r?.branchId ?? property.branchId,
          eventType: "status_changed",
          previousStatus,
          newStatus: computed.freshnessStatus,
          source: "system",
          metadata: { runAt: now.toISOString() },
        });
      }
      if (computed.reminderKey && (r?.agentId ?? property.agentId)) {
        const eventConditions = [
          eq(listingHousekeepingEventsTable.propertyId, property.id),
          eq(listingHousekeepingEventsTable.eventType, "reminder"),
          eq(listingHousekeepingEventsTable.reminderKey, computed.reminderKey),
          r ? eq(listingHousekeepingEventsTable.relationshipId, r.id) : isNull(listingHousekeepingEventsTable.relationshipId),
        ];
        const [existingReminder] = await db.select({ id: listingHousekeepingEventsTable.id })
          .from(listingHousekeepingEventsTable).where(and(...eventConditions)).limit(1);
        if (!existingReminder) {
          const agentId = r?.agentId ?? property.agentId!;
          const label = computed.freshnessStatus === "stale" ? "stale" : computed.freshnessStatus.replace("_", " ");
          await db.insert(listingHousekeepingEventsTable).values({
            listingId: r?.id ?? property.id,
            propertyId: property.id,
            relationshipId: r?.id ?? null,
            agentId,
            agencyId: r?.branchId ?? property.branchId,
            eventType: "reminder",
            previousStatus,
            newStatus: computed.freshnessStatus,
            reminderKey: computed.reminderKey,
            source: "system",
            metadata: { runAt: now.toISOString() },
          });
          await db.insert(notificationsTable).values({
            userId: agentId,
            type: "listing_housekeeping",
            title: `Listing ${label}: ${property.reference}`,
            message: `Confirm availability or update ${property.title} before it becomes stale.`,
          });
          const [openTask] = await db.select({ id: tasksTable.id }).from(tasksTable).where(and(
            eq(tasksTable.propertyId, property.id),
            eq(tasksTable.assigneeId, agentId),
            eq(tasksTable.type, "listing_confirmation"),
            eq(tasksTable.status, "open"),
          )).limit(1);
          if (!openTask) {
            await db.insert(tasksTable).values({
              title: `Confirm listing: ${property.reference}`,
              description: `Housekeeping reminder — ${property.title}`,
              type: "listing_confirmation",
              assigneeId: agentId,
              propertyId: property.id,
              dueDate: now.toISOString().slice(0, 10),
              priority: computed.freshnessStatus === "stale" ? "high" : "medium",
              status: "open",
            });
          }
          reminders++;
          if (r) {
            await db.update(propertyAgentRelationshipsTable).set({
              lastReminderSentAt: now,
              reminderCount: previousReminderCount + 1,
            }).where(eq(propertyAgentRelationshipsTable.id, r.id));
          } else {
            await db.update(propertiesTable).set({
              lastReminderSentAt: now,
              reminderCount: previousReminderCount + 1,
            }).where(eq(propertiesTable.id, property.id));
          }
        }
      }
    }
  }
  return { properties: properties.length, updated, reminders, ranAt: now };
}

export function startHousekeepingScheduler() {
  const run = () => runHousekeepingCycle().catch((error) => {
    console.error("Listing housekeeping cycle failed", error);
  });
  setTimeout(run, 5_000);
  return setInterval(run, 24 * 60 * 60 * 1000);
}