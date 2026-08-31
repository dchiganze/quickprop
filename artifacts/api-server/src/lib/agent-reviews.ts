import { and, desc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import {
  agentReviewInvitationsTable,
  agentReviewsTable,
  db,
  propertiesTable,
  propertyAgentRelationshipsTable,
  sellersTable,
  usersTable,
} from "@workspace/db";
import { sendEmailMessage, type DeliveryResult } from "./housekeeping-delivery";
import { logger } from "./logger";
import { createReviewToken, hashReviewToken } from "./agent-review-tokens";

const REVIEW_INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REVIEW_INITIAL_DELAY_MS = 2 * 60 * 60 * 1000;
export const REVIEW_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REMINDER_NUMBER = 2;
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000];
const TERMINAL_OUTCOMES = ["sold", "rented", "withdrawn", "archived"] as const;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL?.trim() || "https://quickprop.co.zw";

export type ReviewOutcome = typeof TERMINAL_OUTCOMES[number];

export function nextReviewDeliveryAt(from: Date, reminderNumber: number): Date {
  const delay = reminderNumber === 0 ? REVIEW_INITIAL_DELAY_MS : REVIEW_REMINDER_INTERVAL_MS;
  return new Date(from.getTime() + delay);
}

function safeReviewLink(token: string): string {
  return `${PUBLIC_APP_URL.replace(/\/$/, "")}/review/${token}`;
}

function outcomeLabel(outcome: ReviewOutcome): string {
  if (outcome === "rented") return "rental";
  if (outcome === "withdrawn") return "mandate";
  return outcome;
}

function isTerminalOutcome(value: string): value is ReviewOutcome {
  return TERMINAL_OUTCOMES.includes(value as ReviewOutcome);
}

export function reviewTokenHash(token: string): string {
  return hashReviewToken(token);
}

export function reviewInvitationUrl(token: string): string {
  return safeReviewLink(token);
}

type InvitationInput = {
  agentId: number;
  propertyId: number;
  relationshipId?: number | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  outcome: ReviewOutcome;
  mandateKey: string;
};

/**
 * Creates the review invitation in the same idempotent shape for both
 * primary listings and multi-agent relationships. The raw token is never
 * persisted; the delivery worker rotates a fresh token immediately before
 * sending.
 */
export async function ensureReviewInvitation(input: InvitationInput) {
  const token = createReviewToken();
  const expiresAt = new Date(Date.now() + REVIEW_INVITATION_TTL_MS);
  const nextAttemptAt = nextReviewDeliveryAt(new Date(), 0);
  const [created] = await db
    .insert(agentReviewInvitationsTable)
    .values({
      mandateKey: input.mandateKey,
      agentId: input.agentId,
      propertyId: input.propertyId,
      relationshipId: input.relationshipId ?? null,
      recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
      recipientName: input.recipientName?.trim() || null,
      outcome: input.outcome,
      tokenHash: hashReviewToken(token),
      expiresAt,
      nextAttemptAt,
    })
    .onConflictDoNothing({ target: agentReviewInvitationsTable.mandateKey })
    .returning();
  return created ?? null;
}

export async function queuePrimaryReviewInvitation(propertyId: number, outcomeValue: string) {
  if (!isTerminalOutcome(outcomeValue)) return null;
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, propertyId)).limit(1);
  if (!property?.agentId) return null;
  const seller = property.sellerId
    ? (await db.select().from(sellersTable).where(eq(sellersTable.id, property.sellerId)).limit(1))[0]
    : null;
  return ensureReviewInvitation({
    agentId: property.agentId,
    propertyId: property.id,
    recipientEmail: seller?.email ?? null,
    recipientName: seller?.name ?? null,
    outcome: outcomeValue,
    mandateKey: `property:${property.id}:agent:${property.agentId}`,
  });
}

export async function queueRelationshipReviewInvitation(
  relationshipId: number,
  outcomeValue: string,
) {
  if (!isTerminalOutcome(outcomeValue)) return null;
  const [relationship] = await db.select().from(propertyAgentRelationshipsTable)
    .where(eq(propertyAgentRelationshipsTable.id, relationshipId)).limit(1);
  if (!relationship) return null;
  return ensureReviewInvitation({
    agentId: relationship.agentId,
    propertyId: relationship.propertyId,
    relationshipId: relationship.id,
    recipientEmail: relationship.contactEmail,
    recipientName: relationship.contactName,
    outcome: outcomeValue,
    mandateKey: `relationship:${relationship.id}`,
  });
}

export async function getReviewInvitationByToken(token: string) {
  const [invitation] = await db.select({
    invitation: agentReviewInvitationsTable,
    agentName: usersTable.name,
    propertyReference: propertiesTable.reference,
    propertyTitle: propertiesTable.title,
  })
    .from(agentReviewInvitationsTable)
    .innerJoin(usersTable, eq(usersTable.id, agentReviewInvitationsTable.agentId))
    .innerJoin(propertiesTable, eq(propertiesTable.id, agentReviewInvitationsTable.propertyId))
    .where(eq(agentReviewInvitationsTable.tokenHash, hashReviewToken(token)))
    .limit(1);
  return invitation ?? null;
}

export function invitationIsExpired(invitation: { expiresAt: Date; status: string }) {
  return invitation.expiresAt.getTime() <= Date.now() || invitation.status === "expired";
}

export async function createReviewFromToken(
  token: string,
  input: { rating: number; reviewText: string },
) {
  return db.transaction(async (tx) => {
    const tokenHash = hashReviewToken(token);
    const [invitation] = await tx.select().from(agentReviewInvitationsTable)
      .where(eq(agentReviewInvitationsTable.tokenHash, tokenHash))
      .limit(1);
    if (!invitation) return { kind: "not_found" as const };
    if (invitation.status === "submitted") return { kind: "used" as const };
    if (invitation.expiresAt.getTime() <= Date.now()) {
      await tx.update(agentReviewInvitationsTable).set({
        status: "expired",
        updatedAt: new Date(),
      }).where(eq(agentReviewInvitationsTable.id, invitation.id));
      return { kind: "expired" as const };
    }

    const [review] = await tx.insert(agentReviewsTable).values({
      invitationId: invitation.id,
      agentId: invitation.agentId,
      propertyId: invitation.propertyId,
      relationshipId: invitation.relationshipId,
      rating: input.rating,
      reviewText: input.reviewText.trim(),
    }).onConflictDoNothing({ target: agentReviewsTable.invitationId }).returning();
    if (!review) return { kind: "used" as const };

    await tx.update(agentReviewInvitationsTable).set({
      status: "submitted",
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(agentReviewInvitationsTable.id, invitation.id));
    return {
      kind: "created" as const,
      review: {
        ...review,
        outcome: invitation.outcome,
        verified: true,
      },
    };
  });
}

export async function getPublicReviewSummary(agentId: number) {
  const [aggregate] = await db.select({
    averageRating: sql<number>`coalesce(avg(${agentReviewsTable.rating}), 0)`,
    reviewCount: sql<number>`count(*)`,
  }).from(agentReviewsTable).where(eq(agentReviewsTable.agentId, agentId));
  const reviews = await db.select({
    rating: agentReviewsTable.rating,
    reviewText: agentReviewsTable.reviewText,
    outcome: agentReviewInvitationsTable.outcome,
    createdAt: agentReviewsTable.createdAt,
  }).from(agentReviewsTable)
    .innerJoin(agentReviewInvitationsTable, eq(agentReviewInvitationsTable.id, agentReviewsTable.invitationId))
    .where(eq(agentReviewsTable.agentId, agentId))
    .orderBy(desc(agentReviewsTable.createdAt))
    .limit(3);
  return {
    averageRating: Number(aggregate?.averageRating ?? 0),
    reviewCount: Number(aggregate?.reviewCount ?? 0),
    reviews: reviews.map((review) => ({ ...review, verified: true })),
  };
}

function reviewEmail(invitation: typeof agentReviewInvitationsTable.$inferSelect, property: typeof propertiesTable.$inferSelect, agentName: string, token: string) {
  const link = safeReviewLink(token);
  const label = outcomeLabel(invitation.outcome as ReviewOutcome);
  const isReminder = invitation.reminderNumber > 0;
  const opening = isReminder
    ? `Just a quick reminder that we'd value a short review of your experience with ${agentName}.`
    : `Now that the ${label} mandate has closed, we'd value a short review of your experience.`;
  const text = [
    `Hi${invitation.recipientName ? ` ${invitation.recipientName}` : ""},`,
    "",
    `Thank you for working with ${agentName} on ${property.title} (${property.reference}).`,
    opening,
    "",
    `Leave your review: ${link}`,
    "",
    "This one-time link expires in 30 days.",
    "QuickProp",
  ].join("\n");
  const html = `<p>Hi${invitation.recipientName ? ` ${escapeHtml(invitation.recipientName)}` : ""},</p><p>Thank you for working with <strong>${escapeHtml(agentName)}</strong> on ${escapeHtml(property.title)} (${escapeHtml(property.reference)}).</p><p>${escapeHtml(opening)}</p><p><a href="${link}">Leave your review</a></p><p>This one-time link expires in 30 days.</p><p>QuickProp</p>`;
  return {
    to: invitation.recipientEmail,
    subject: isReminder ? `A quick reminder about your ${agentName} review` : `How was your experience with ${agentName}?`,
    text,
    html,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function deliverInvitation(invitation: typeof agentReviewInvitationsTable.$inferSelect): Promise<DeliveryResult> {
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, invitation.propertyId)).limit(1);
  const [agent] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, invitation.agentId)).limit(1);
  if (!property || !agent) return { status: "skipped", reason: "mandate_not_found" };
  const token = createReviewToken();
  const [rotated] = await db.update(agentReviewInvitationsTable).set({
    tokenHash: hashReviewToken(token),
    updatedAt: new Date(),
  }).where(eq(agentReviewInvitationsTable.id, invitation.id)).returning();
  if (!rotated) return { status: "skipped", reason: "invitation_not_found" };
  const email = reviewEmail(rotated, property, agent.name, token);
  return sendEmailMessage({
    ...email,
    idempotencyKey: `agent-review-invitation-${invitation.id}-${invitation.reminderNumber}`,
  });
}

export async function deliverDueReviewInvitations() {
  const now = new Date();
  const abandonedBefore = new Date(now.getTime() - 15 * 60_000);
  const due = await db.select().from(agentReviewInvitationsTable).where(and(
    or(
      inArray(agentReviewInvitationsTable.status, ["pending", "failed"]),
      and(
        eq(agentReviewInvitationsTable.status, "sending"),
        lte(agentReviewInvitationsTable.updatedAt, abandonedBefore),
      ),
    ),
    lt(agentReviewInvitationsTable.attempts, MAX_ATTEMPTS),
    lte(agentReviewInvitationsTable.nextAttemptAt, now),
  )).limit(100);
  let sent = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of due) {
    const [claimed] = await db.update(agentReviewInvitationsTable).set({
      status: "sending",
      attempts: candidate.attempts + 1,
      updatedAt: new Date(),
    }).where(and(
      eq(agentReviewInvitationsTable.id, candidate.id),
      eq(agentReviewInvitationsTable.status, candidate.status),
      lte(agentReviewInvitationsTable.nextAttemptAt, now),
    )).returning();
    if (!claimed) continue;
    try {
      const result = await deliverInvitation(claimed);
      if (result.status === "sent") {
        const nextReminderNumber = claimed.reminderNumber + 1;
        const hasMoreReminders = nextReminderNumber <= MAX_REMINDER_NUMBER;
        await db.update(agentReviewInvitationsTable).set({
          status: hasMoreReminders ? "pending" : "sent",
          reminderNumber: nextReminderNumber,
          attempts: 0,
          nextAttemptAt: hasMoreReminders
            ? nextReviewDeliveryAt(new Date(), nextReminderNumber)
            : claimed.nextAttemptAt,
          sentAt: new Date(),
          providerMessageId: result.providerMessageId ?? null,
          lastError: null,
          updatedAt: new Date(),
        }).where(eq(agentReviewInvitationsTable.id, claimed.id));
        sent++;
      } else {
        await db.update(agentReviewInvitationsTable).set({
          status: "skipped",
          lastError: result.reason ?? "delivery_skipped",
          updatedAt: new Date(),
        }).where(eq(agentReviewInvitationsTable.id, claimed.id));
        skipped++;
      }
    } catch (error) {
      const attempts = claimed.attempts;
      const exhausted = attempts >= MAX_ATTEMPTS;
      const nextAttemptAt = new Date(Date.now() + (RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS.at(-1)!));
      await db.update(agentReviewInvitationsTable).set({
        status: exhausted ? "failed" : "pending",
        nextAttemptAt,
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      }).where(eq(agentReviewInvitationsTable.id, claimed.id));
      if (exhausted) failed++;
      else retried++;
      logger.warn({ invitationId: claimed.id, attempts }, "Agent review invitation delivery failed");
    }
  }
  return { attempted: due.length, sent, retried, failed, skipped };
}

export async function retryReviewInvitation(invitationId: number) {
  const [invitation] = await db.update(agentReviewInvitationsTable).set({
    status: "pending",
    attempts: 0,
    nextAttemptAt: new Date(),
    lastError: null,
    updatedAt: new Date(),
  }).where(and(
    eq(agentReviewInvitationsTable.id, invitationId),
    or(
      eq(agentReviewInvitationsTable.status, "failed"),
      eq(agentReviewInvitationsTable.status, "skipped"),
    ),
  )).returning();
  return invitation ?? null;
}

export function startReviewInvitationScheduler() {
  const run = () => deliverDueReviewInvitations().catch((error) => {
    logger.error({ error }, "Agent review invitation cycle failed");
  });
  setTimeout(run, 5_000);
  return setInterval(run, 60_000);
}