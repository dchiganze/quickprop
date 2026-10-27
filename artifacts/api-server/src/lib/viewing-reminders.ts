import { and, eq, gte, isNull, lt, or } from "drizzle-orm";
import { db, listingHousekeepingPreferencesTable, notificationsTable, pool, propertiesTable, viewingsTable } from "@workspace/db";
import { logger } from "./logger";
import { sendUserPushNotification } from "./housekeeping-delivery";
import { formatViewingReminderTime, getHarareDayRange, isViewingReminderWindow } from "./viewing-reminder-planner";

const CLAIM_STALE_AFTER_MS = 10 * 60_000;

export async function ensureViewingReminderSchema(): Promise<void> {
  await pool.query(`
    ALTER TABLE viewings
      ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp,
      ADD COLUMN IF NOT EXISTS reminder_claimed_at timestamp;
    ALTER TABLE listing_housekeeping_preferences
      ADD COLUMN IF NOT EXISTS viewing_reminder_enabled boolean NOT NULL DEFAULT true;
    CREATE INDEX IF NOT EXISTS viewings_morning_reminder_due_idx
      ON viewings (scheduled_at)
      WHERE status = 'scheduled' AND reminder_sent_at IS NULL;
  `);
}

export async function runViewingReminderCycle(now = new Date()) {
  if (!isViewingReminderWindow(now)) return { candidates: 0, sent: 0 };

  const { end } = getHarareDayRange(now);
  const staleClaimBefore = new Date(now.getTime() - CLAIM_STALE_AFTER_MS);
  const candidates = await db.select({
    id: viewingsTable.id,
    agentId: viewingsTable.agentId,
    propertyId: viewingsTable.propertyId,
    buyerName: viewingsTable.buyerName,
    scheduledAt: viewingsTable.scheduledAt,
    notes: viewingsTable.notes,
    propertyTitle: propertiesTable.title,
    propertyReference: propertiesTable.reference,
    propertyAddress: propertiesTable.address,
    propertySuburb: propertiesTable.suburb,
    propertyCity: propertiesTable.city,
  })
    .from(viewingsTable)
    .innerJoin(propertiesTable, eq(propertiesTable.id, viewingsTable.propertyId))
    .where(and(
      eq(viewingsTable.status, "scheduled"),
      isNull(viewingsTable.reminderSentAt),
      gte(viewingsTable.scheduledAt, now),
      lt(viewingsTable.scheduledAt, end),
      or(isNull(viewingsTable.reminderClaimedAt), lt(viewingsTable.reminderClaimedAt, staleClaimBefore)),
    ));

  let sent = 0;
  for (const viewing of candidates) {
    if (!viewing.agentId) continue;
    const [preferences] = await db.select({
      viewingReminderEnabled: listingHousekeepingPreferencesTable.viewingReminderEnabled,
    }).from(listingHousekeepingPreferencesTable)
      .where(eq(listingHousekeepingPreferencesTable.userId, viewing.agentId))
      .limit(1);
    if (preferences?.viewingReminderEnabled === false) continue;

    const [claim] = await db.update(viewingsTable)
      .set({ reminderClaimedAt: now })
      .where(and(
        eq(viewingsTable.id, viewing.id),
        eq(viewingsTable.status, "scheduled"),
        isNull(viewingsTable.reminderSentAt),
        or(isNull(viewingsTable.reminderClaimedAt), lt(viewingsTable.reminderClaimedAt, staleClaimBefore)),
      ))
      .returning({ id: viewingsTable.id });
    if (!claim) continue;

    const time = formatViewingReminderTime(viewing.scheduledAt);
    const propertyName = viewing.propertyTitle || viewing.propertyReference;
    const address = [viewing.propertyAddress, viewing.propertySuburb, viewing.propertyCity]
      .filter(Boolean).join(", ");
    const title = `Viewing today at ${time}`;
    const message = `${propertyName}${address ? ` · ${address}` : ""}${viewing.buyerName ? ` · ${viewing.buyerName}` : ""}`;

    try {
      const pushResult = await sendUserPushNotification(viewing.agentId, {
        title,
        body: message,
        data: { type: "viewing_reminder", propertyId: viewing.propertyId, viewingId: viewing.id },
      }, `viewing-reminder-${viewing.id}`);
      const [existingNotification] = await db.select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(and(
          eq(notificationsTable.userId, viewing.agentId),
          eq(notificationsTable.type, "viewing_reminder"),
          eq(notificationsTable.title, title),
          eq(notificationsTable.message, message),
        ))
        .limit(1);
      if (!existingNotification) {
        await db.insert(notificationsTable).values({
          userId: viewing.agentId,
          type: "viewing_reminder",
          title,
          message,
        });
      }
      await db.update(viewingsTable)
        .set({ reminderSentAt: now, reminderClaimedAt: null })
        .where(and(eq(viewingsTable.id, viewing.id), eq(viewingsTable.reminderClaimedAt, now)));
      sent++;
      if (pushResult.status === "skipped") {
        logger.info({ viewingId: viewing.id, agentId: viewing.agentId, reason: pushResult.reason }, "Viewing reminder saved in app without push token");
      }
    } catch (error) {
      await db.update(viewingsTable)
        .set({ reminderClaimedAt: null })
        .where(and(eq(viewingsTable.id, viewing.id), eq(viewingsTable.reminderClaimedAt, now)));
      logger.error({ error, viewingId: viewing.id, agentId: viewing.agentId }, "Viewing reminder delivery failed");
    }
  }

  return { candidates: candidates.length, sent };
}

export function startViewingReminderScheduler(): NodeJS.Timeout {
  const run = () => runViewingReminderCycle().catch((error) => {
    logger.error({ error }, "Viewing reminder cycle failed");
  });
  setTimeout(run, 1_000);
  return setInterval(run, 30_000);
}
