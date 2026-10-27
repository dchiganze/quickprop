import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  listingHousekeepingDeliveriesTable,
  listingHousekeepingEventsTable,
  listingHousekeepingPreferencesTable,
  listingHousekeepingSettingsTable,
  notificationsTable,
  propertiesTable,
  propertyAgentRelationshipsTable,
  tasksTable,
  usersTable,
} from "@workspace/db";
import {
  calculateFreshness,
  DEFAULT_HOUSEKEEPING_SETTINGS,
  HOUSEKEEPING_ACTIVE_STATUSES,
  makeReminderEventKey,
  needsPublicationBaseline,
  normalizeHousekeepingSettings,
  shouldAutoDraftPublishedListing,
  type HousekeepingSettings,
} from "./housekeeping";
import { deliverDueHousekeepingReminders, REMINDER_CHANNELS, type ReminderDeliveryPayload } from "./housekeeping-delivery";
import { planHousekeepingActions } from "./housekeeping-planner";
import { logger } from "./logger";

async function getSettings(): Promise<HousekeepingSettings> {
  const [row] = await db.select().from(listingHousekeepingSettingsTable).limit(1);
  return normalizeHousekeepingSettings(row ?? DEFAULT_HOUSEKEEPING_SETTINGS);
}

export async function runHousekeepingCycle() {
  const houseSettings = await getSettings();
  const now = new Date();
  const legacyNextConfirmationAt = new Date(
    now.getTime() + houseSettings.firstConfirmationDays * 24 * 60 * 60 * 1000,
  );
  await db.update(propertiesTable).set({
    publishedAt: now,
    lastAvailabilityConfirmedAt: now,
    nextConfirmationAt: legacyNextConfirmationAt,
    freshnessStatus: "fresh",
    freshnessScore: 100,
    qualityScore: 100,
    daysSinceConfirmation: 0,
    staleSince: null,
    updatedAt: now,
  }).where(and(
    eq(propertiesTable.status, "public"),
    isNull(propertiesTable.publishedAt),
    isNull(propertiesTable.lastAvailabilityConfirmedAt),
  ));
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

  const propertyIds = properties.map((property) => property.id);
  const lifecycleEvents = propertyIds.length
    ? await db.select({
        propertyId: listingHousekeepingEventsTable.propertyId,
        eventType: listingHousekeepingEventsTable.eventType,
      }).from(listingHousekeepingEventsTable).where(and(
        inArray(listingHousekeepingEventsTable.propertyId, propertyIds),
        isNull(listingHousekeepingEventsTable.relationshipId),
        inArray(listingHousekeepingEventsTable.eventType, ["auto_drafted", "republished"]),
      )).orderBy(desc(listingHousekeepingEventsTable.createdAt), desc(listingHousekeepingEventsTable.id))
    : [];
  const latestLifecycleEventByProperty = new Map<number, string>();
  for (const event of lifecycleEvents) {
    if (!latestLifecycleEventByProperty.has(event.propertyId)) {
      latestLifecycleEventByProperty.set(event.propertyId, event.eventType);
    }
  }

  let updated = 0;
  let reminders = 0;
  let autoDrafted = 0;
  for (const propertyRow of properties) {
      let property = propertyRow;
      if (needsPublicationBaseline(
        property.status,
        property.publishedAt,
        property.lastAvailabilityConfirmedAt,
      )) {
        const nextConfirmationAt = new Date(
          now.getTime() + houseSettings.firstConfirmationDays * 24 * 60 * 60 * 1000,
        );
        await db.update(propertiesTable).set({
          publishedAt: now,
          lastAvailabilityConfirmedAt: now,
          nextConfirmationAt,
          freshnessStatus: "fresh",
          freshnessScore: 100,
          qualityScore: 100,
          daysSinceConfirmation: 0,
          staleSince: null,
          updatedAt: now,
        }).where(eq(propertiesTable.id, property.id));
        property = {
          ...propertyRow,
          publishedAt: now,
          lastAvailabilityConfirmedAt: now,
          nextConfirmationAt,
          freshnessStatus: "fresh",
          freshnessScore: 100,
          qualityScore: 100,
          daysSinceConfirmation: 0,
          staleSince: null,
          updatedAt: now,
        };
      }
    const propertyRelationships = relationshipsByProperty.get(property.id) ?? [];
    // Publication expiry belongs to the listing owner. Other agents keep
    // independent freshness reminders, but must not extend the owner's live
    // period or receive duplicate owner reminders.
    const targets = [
      { relationship: null, property },
      ...propertyRelationships
        .filter((relationship) => relationship.agentId !== property.agentId)
        .map((relationship) => ({ relationship, property })),
    ];
    for (const target of targets) {
      const r = target.relationship;
      const isOwnerListing = !r;
      const publicationAnchor = property.lastAvailabilityConfirmedAt
        ?? property.publishedAt
        ?? property.createdAt;
      const publicationDueAt = new Date(
        publicationAnchor.getTime() + houseSettings.recurringConfirmationDays * 24 * 60 * 60 * 1000,
      );
      const computed = calculateFreshness({
        createdAt: r?.createdAt ?? property.publishedAt ?? property.createdAt,
        lastConfirmedAt: r?.lastAvailabilityConfirmation ?? property.lastAvailabilityConfirmedAt,
        lastUpdatedAt: r?.lastUpdate ?? property.updatedAt,
        nextConfirmationAt: isOwnerListing
          ? publicationDueAt
          : r?.nextConfirmationAt ?? property.nextConfirmationAt,
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
      const agentId = r?.agentId ?? property.agentId;
      const initialPlan = planHousekeepingActions({
        previousStatus,
        nextStatus: computed.freshnessStatus,
        reminderKey: computed.reminderKey,
        agentId,
        existingReminder: false,
        hasOpenTask: false,
      });
      const expiredDraft = isOwnerListing
        && property.status === "draft"
        && latestLifecycleEventByProperty.get(property.id) === "auto_drafted";
      const shouldAutoDraft = isOwnerListing && shouldAutoDraftPublishedListing(
        property.status,
        property.availabilityStatus,
        computed.nextConfirmationAt,
        now,
      );
      let autoDraftedNow = false;
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
        if (shouldAutoDraft) {
          autoDraftedNow = await db.transaction(async (tx) => {
            const [transitioned] = await tx.update(propertiesTable).set({
              status: "draft",
              pipelineStage: "draft",
              freshnessStatus: computed.freshnessStatus,
              nextConfirmationAt: computed.nextConfirmationAt,
              daysSinceConfirmation: computed.daysSinceConfirmation,
              freshnessScore: computed.freshnessScore,
              qualityScore: computed.qualityScore,
              staleSince: computed.staleSince,
              updatedAt: now,
            }).where(and(
              eq(propertiesTable.id, property.id),
              eq(propertiesTable.status, "public"),
            )).returning({ id: propertiesTable.id });
            if (!transitioned) return false;
            await tx.insert(listingHousekeepingEventsTable).values({
              listingId: property.id,
              propertyId: property.id,
              relationshipId: null,
              agentId: property.agentId,
              agencyId: property.branchId,
              eventType: "auto_drafted",
              previousStatus: property.status,
              newStatus: "draft",
              source: "system",
              metadata: { expiredAt: computed.nextConfirmationAt.toISOString(), runAt: now.toISOString() },
            });
            return true;
          });
          if (autoDraftedNow) {
            latestLifecycleEventByProperty.set(property.id, "auto_drafted");
            autoDrafted++;
          }
        }
        const ownerRelationship = propertyRelationships.find(
          (relationship) => relationship.agentId === property.agentId,
        );
        if (ownerRelationship) {
          await db.update(propertyAgentRelationshipsTable).set({
            freshnessStatus: computed.freshnessStatus,
            nextConfirmationAt: computed.nextConfirmationAt,
            daysSinceConfirmation: computed.daysSinceConfirmation,
            freshnessScore: computed.freshnessScore,
            qualityScore: computed.qualityScore,
            staleSince: computed.staleSince,
          }).where(eq(propertyAgentRelationshipsTable.id, ownerRelationship.id));
        }
        await db.update(propertiesTable).set({
          freshnessStatus: computed.freshnessStatus,
          nextConfirmationAt: computed.nextConfirmationAt,
          daysSinceConfirmation: computed.daysSinceConfirmation,
          freshnessScore: computed.freshnessScore,
          qualityScore: computed.qualityScore,
          staleSince: computed.staleSince,
        }).where(eq(propertiesTable.id, property.id));
      }
      if (initialPlan.statusEvent) {
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
      const reminderEligible = isOwnerListing
        ? property.status === "public" || expiredDraft || autoDraftedNow
        : property.status !== "draft";
      const eventReminderKey = computed.reminderKey
        ? makeReminderEventKey(computed.reminderKey, computed.nextConfirmationAt)
        : null;
      if (computed.reminderKey && eventReminderKey && agentId && reminderEligible) {
        const eventConditions = [
          eq(listingHousekeepingEventsTable.propertyId, property.id),
          eq(listingHousekeepingEventsTable.eventType, "reminder"),
          eq(listingHousekeepingEventsTable.reminderKey, eventReminderKey),
          r ? eq(listingHousekeepingEventsTable.relationshipId, r.id) : isNull(listingHousekeepingEventsTable.relationshipId),
        ];
        const [existingReminder] = await db.select({ id: listingHousekeepingEventsTable.id })
          .from(listingHousekeepingEventsTable).where(and(...eventConditions)).limit(1);
        const reminderPlan = planHousekeepingActions({
          previousStatus,
          nextStatus: computed.freshnessStatus,
          reminderKey: eventReminderKey,
          agentId,
          existingReminder: Boolean(existingReminder),
          hasOpenTask: false,
        });
        if (reminderPlan.reminderEvent) {
          const isPreExpiryReminder = isOwnerListing && computed.reminderKey === "due-soon";
          const label = autoDraftedNow || expiredDraft ? "moved to drafts"
            : isPreExpiryReminder ? "confirmation due soon"
              : computed.freshnessStatus === "stale" ? "stale" : computed.freshnessStatus.replace("_", " ");
          const deliveryPayload: ReminderDeliveryPayload = {
            propertyId: property.id,
            reference: property.reference,
            title: property.title,
            freshnessStatus: computed.freshnessStatus,
            reminderKey: computed.reminderKey,
            message: isPreExpiryReminder
              ? `Confirm that ${property.title} (${property.reference}) is still available within ${houseSettings.softReminderDays} days to keep it live for another ${houseSettings.recurringConfirmationDays} days.`
              : autoDraftedNow || expiredDraft
                ? `${property.title} (${property.reference}) has reached its ${houseSettings.recurringConfirmationDays}-day confirmation date and is now a draft. Confirm it is available to republish, or archive it. We will remind you every ${houseSettings.softReminderDays} days until you act.`
                : `Confirm availability or update ${property.title} (${property.reference}) before it becomes stale.`,
          };
          const createdReminder = await db.transaction(async (tx) => {
            // The event is the source record for all channel deliveries. A retry
            // only changes its delivery row and never creates another reminder.
            const [alreadyCreated] = await tx.select({ id: listingHousekeepingEventsTable.id })
              .from(listingHousekeepingEventsTable).where(and(...eventConditions)).limit(1);
            if (alreadyCreated) return false;

            const [event] = await tx.insert(listingHousekeepingEventsTable).values({
              listingId: r?.id ?? property.id,
              propertyId: property.id,
              relationshipId: r?.id ?? null,
              agentId,
              agencyId: r?.branchId ?? property.branchId,
              eventType: "reminder",
              previousStatus,
              newStatus: computed.freshnessStatus,
              reminderKey: eventReminderKey,
              source: "system",
              metadata: {
                runAt: now.toISOString(),
                dueAt: computed.nextConfirmationAt.toISOString(),
                reminderSlot: computed.reminderKey,
              },
            }).returning({ id: listingHousekeepingEventsTable.id });
            if (!event) throw new Error("Unable to create housekeeping reminder event");

            await tx.insert(notificationsTable).values({
              userId: agentId,
              type: "listing_housekeeping",
              title: `Listing ${label}: ${property.reference}`,
              message: deliveryPayload.message,
            });
            const [openTask] = await tx.select({ id: tasksTable.id }).from(tasksTable).where(and(
              eq(tasksTable.propertyId, property.id),
              eq(tasksTable.assigneeId, agentId),
              eq(tasksTable.type, "listing_confirmation"),
              eq(tasksTable.status, "open"),
            )).limit(1);
            const transactionPlan = planHousekeepingActions({
              previousStatus,
              nextStatus: computed.freshnessStatus,
              reminderKey: eventReminderKey,
              agentId,
              existingReminder: false,
              hasOpenTask: Boolean(openTask),
            });
            if (transactionPlan.task) {
              await tx.insert(tasksTable).values({
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

            const [preferences] = await tx.select().from(listingHousekeepingPreferencesTable)
              .where(eq(listingHousekeepingPreferencesTable.userId, agentId)).limit(1);
            const frequency = preferences?.reminderFrequency ?? "smart";
            const shouldDeliver = isOwnerListing || (
              frequency !== "never"
              && (frequency !== "stale_only" || computed.freshnessStatus === "stale")
              && (frequency !== "urgent" || ["potentially_stale", "stale"].includes(computed.freshnessStatus))
            );
            if (shouldDeliver) {
              const channels = isOwnerListing ? ["push", "email"] as const : REMINDER_CHANNELS;
              const enabledChannels = channels.filter((channel) => preferences?.[`${channel}Enabled`] ?? true);
              if (enabledChannels.length) {
                await tx.insert(listingHousekeepingDeliveriesTable).values(enabledChannels.map((channel) => ({
                  eventId: event.id,
                  userId: agentId,
                  channel,
                  payload: deliveryPayload,
                })));
              }
            }
            return true;
          });
          if (createdReminder) {
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
  }
  const deliveries = await deliverDueHousekeepingReminders();
  return { properties: properties.length, updated, reminders, autoDrafted, deliveries, ranAt: now };
}

export function startHousekeepingScheduler() {
  const run = () => runHousekeepingCycle().catch((error) => {
    logger.error({ error }, "Listing housekeeping cycle failed");
  });
  setTimeout(run, 5_000);
  return setInterval(run, 24 * 60 * 60 * 1000);
}