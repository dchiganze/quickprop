import { and, desc, eq, inArray, lte, lt } from "drizzle-orm";
import {
  agenciesTable,
  db,
  notificationsTable,
  referenceRequestsTable,
  rentalDisputesTable,
  rentalHistoryTable,
  rentalReferencesTable,
  usersTable,
} from "@workspace/db";
import { sendEmailMessage, type DeliveryResult } from "./housekeeping-delivery";
import { logger } from "./logger";
import { createRentalReferenceToken, hashRentalReferenceToken } from "./rental-reference-tokens";

const REFERENCE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const REMINDER_DELAYS_MS = [3 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL?.trim() || "https://quickprop.co.zw";

export type ReferenceType = "private_landlord" | "agency";

function publicReferenceUrl(token: string): string {
  return `${PUBLIC_APP_URL.replace(/\/$/, "")}/rental-reference/${token}`;
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

function asIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function serializeAgency(agency: typeof agenciesTable.$inferSelect | null) {
  if (!agency) return null;
  return {
    ...agency,
    createdAt: agency.createdAt.toISOString(),
    updatedAt: agency.updatedAt.toISOString(),
  };
}

function serializeReference(reference: typeof rentalReferencesTable.$inferSelect | null) {
  if (!reference) return null;
  return {
    id: reference.id,
    rentalHistoryId: reference.rentalHistoryId,
    verifiedTenancy: reference.verifiedTenancy,
    rentPaymentRating: reference.rentPaymentRating,
    propertyConditionRating: reference.propertyConditionRating,
    wouldRentAgain: reference.wouldRentAgain,
    submittedBy: reference.submittedBy,
    submittedAt: asIso(reference.submittedAt),
    disputeStatus: reference.disputeStatus,
    disputeReason: reference.disputeReason,
  };
}

function serializeRequest(request: typeof referenceRequestsTable.$inferSelect | null) {
  if (!request) return null;
  return {
    id: request.id,
    rentalHistoryId: request.rentalHistoryId,
    recipientType: request.recipientType,
    recipientEmail: request.recipientEmail,
    recipientPhone: request.recipientPhone,
    agencyId: request.agencyId,
    status: request.status,
    sentAt: asIso(request.sentAt),
    reminderCount: request.reminderCount,
    lastReminderAt: asIso(request.lastReminderAt),
    completedAt: asIso(request.completedAt),
    expiresAt: request.expiresAt.toISOString(),
    lastError: request.lastError,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

function serializeDispute(dispute: typeof rentalDisputesTable.$inferSelect) {
  return {
    id: dispute.id,
    rentalHistoryId: dispute.rentalHistoryId,
    reason: dispute.reason,
    status: dispute.status,
    resolutionNote: dispute.resolutionNote,
    resolvedAt: asIso(dispute.resolvedAt),
    createdAt: dispute.createdAt.toISOString(),
    updatedAt: dispute.updatedAt.toISOString(),
  };
}

export async function getRentalHistoryView(id: number) {
  const [history] = await db.select().from(rentalHistoryTable)
    .where(eq(rentalHistoryTable.id, id)).limit(1);
  if (!history) return null;

  const [[agency], [reference], [request], disputes] = await Promise.all([
    history.agencyId
      ? db.select().from(agenciesTable).where(eq(agenciesTable.id, history.agencyId)).limit(1)
      : Promise.resolve([]),
    db.select().from(rentalReferencesTable).where(eq(rentalReferencesTable.rentalHistoryId, history.id)).limit(1),
    db.select().from(referenceRequestsTable).where(eq(referenceRequestsTable.rentalHistoryId, history.id)).limit(1),
    db.select().from(rentalDisputesTable)
      .where(eq(rentalDisputesTable.rentalHistoryId, history.id))
      .orderBy(desc(rentalDisputesTable.createdAt)),
  ]);

  return {
    id: history.id,
    propertyId: history.propertyId,
    propertyAddress: history.propertyAddress,
    suburb: history.suburb,
    city: history.city,
    startDate: history.startDate,
    endDate: history.endDate,
    tenancyType: history.tenancyType,
    refereeType: history.refereeType,
    refereeName: history.refereeName,
    refereeEmail: history.refereeEmail,
    refereePhone: history.refereePhone,
    agencyId: history.agencyId,
    agency: serializeAgency(agency ?? null),
    verificationStatus: history.verificationStatus,
    verifiedAt: asIso(history.verifiedAt),
    createdAt: history.createdAt.toISOString(),
    updatedAt: history.updatedAt.toISOString(),
    reference: serializeReference(reference ?? null),
    request: serializeRequest(request ?? null),
    disputes: disputes.map(serializeDispute),
  };
}

export async function getRentalProfile(userId: number) {
  const histories = await db.select().from(rentalHistoryTable)
    .where(eq(rentalHistoryTable.tenantUserId, userId))
    .orderBy(desc(rentalHistoryTable.startDate), desc(rentalHistoryTable.createdAt));
  const tenancies = await Promise.all(histories.map((history) => getRentalHistoryView(history.id)));
  const safeTenancies = tenancies.filter((history): history is NonNullable<typeof history> => Boolean(history));
  return {
    verifiedCount: safeTenancies.filter((history) => history.verificationStatus === "verified").length,
    totalCount: safeTenancies.length,
    tenancies: safeTenancies,
  };
}

async function notifyTenant(userId: number, title: string, message: string) {
  await db.insert(notificationsTable).values({
    userId,
    type: "rental_reference",
    title,
    message,
  });
}

export async function notifyAdmins(title: string, message: string) {
  const admins = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(inArray(usersTable.role, ["principal", "admin"]), eq(usersTable.status, "active")));
  if (admins.length) {
    await db.insert(notificationsTable).values(admins.map((admin) => ({
      userId: admin.id,
      type: "rental_reference_admin",
      title,
      message,
    })));
  }
}

function referenceEmail(input: {
  tenantName: string;
  history: typeof rentalHistoryTable.$inferSelect;
  recipientName: string | null;
  agencyName: string | null;
  token: string;
  reminder: boolean;
}) {
  const link = publicReferenceUrl(input.token);
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hello,";
  const subject = input.reminder
    ? `Reminder: rental reference requested for ${input.tenantName}`
    : `Rental reference requested for ${input.tenantName}`;
  const text = [
    greeting,
    "",
    `${input.tenantName} has asked QuickProp to verify a previous tenancy at ${input.history.propertyAddress}, ${input.history.suburb}, ${input.history.city}.`,
    `Claimed rental period: ${input.history.startDate} to ${input.history.endDate}.`,
    "",
    "Please confirm the tenancy and answer three short questions:",
    link,
    "",
    "This secure, one-time link expires in 14 days.",
    "If you did not manage this tenancy, select No on the form.",
    "",
    "QuickProp",
  ].join("\n");
  const html = `<p>${escapeHtml(greeting)}</p><p><strong>${escapeHtml(input.tenantName)}</strong> has asked QuickProp to verify a previous tenancy at <strong>${escapeHtml(input.history.propertyAddress)}</strong>, ${escapeHtml(input.history.suburb)}, ${escapeHtml(input.history.city)}.</p><p>Claimed rental period: ${escapeHtml(input.history.startDate)} to ${escapeHtml(input.history.endDate)}.</p><p><a href="${link}">Verify this rental reference</a></p><p>This secure, one-time link expires in 14 days. If you did not manage this tenancy, select No on the form.</p><p>QuickProp</p>`;
  return { subject, text, html, link };
}

export async function createReferenceRequest(input: {
  history: typeof rentalHistoryTable.$inferSelect;
  tenantName: string;
  refereeType: ReferenceType;
  refereeName?: string | null;
  refereeEmail?: string | null;
  refereePhone?: string | null;
  agency?: typeof agenciesTable.$inferSelect | null;
}) {
  const token = createRentalReferenceToken();
  const now = new Date();
  const request = await db.transaction(async (tx) => {
    const [created] = await tx.insert(referenceRequestsTable).values({
      rentalHistoryId: input.history.id,
      recipientType: input.refereeType,
      recipientEmail: input.refereeEmail?.trim().toLowerCase() || null,
      recipientPhone: input.refereePhone?.trim() || null,
      agencyId: input.agency?.id ?? null,
      tokenHash: hashRentalReferenceToken(token),
      status: "pending",
      expiresAt: new Date(now.getTime() + REFERENCE_TTL_MS),
    }).returning();
    if (!created) throw new Error("Unable to create rental reference request");
    await tx.update(rentalHistoryTable).set({
      refereeType: input.refereeType,
      refereeName: input.refereeName?.trim() || null,
      refereeEmail: input.refereeEmail?.trim().toLowerCase() || null,
      refereePhone: input.refereePhone?.trim() || null,
      agencyId: input.agency?.id ?? null,
      verificationStatus: "pending",
      updatedAt: now,
    }).where(eq(rentalHistoryTable.id, input.history.id));
    return created;
  });

  let delivery: DeliveryResult = { status: "skipped", reason: "no_email_address" };
  if (request.recipientEmail) {
    const email = referenceEmail({
      tenantName: input.tenantName,
      history: { ...input.history, refereeName: input.refereeName ?? null },
      recipientName: input.refereeName ?? null,
      agencyName: input.agency?.name ?? null,
      token,
      reminder: false,
    });
    delivery = await sendEmailMessage({
      to: request.recipientEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
      idempotencyKey: `rental-reference-request-${request.id}`,
    });
  }

  await db.update(referenceRequestsTable).set({
    status: request.recipientEmail ? "sent" : "pending",
    sentAt: request.recipientEmail ? now : null,
    providerMessageId: delivery.providerMessageId ?? null,
    lastError: delivery.status === "skipped" ? delivery.reason ?? null : null,
    updatedAt: new Date(),
  }).where(eq(referenceRequestsTable.id, request.id));
  await notifyTenant(
    input.history.tenantUserId,
    "Reference request sent",
    input.refereeName
      ? `We've contacted ${input.refereeName} to verify your ${input.history.suburb} tenancy.`
      : "Your rental reference request has been created and is awaiting a referee contact.",
  );
  if (!input.agency && input.refereeType === "agency") {
    await notifyAdmins("Agency verification requested", `A renter requested an agency reference for ${input.history.propertyAddress}.`);
  }
  return getRentalHistoryView(input.history.id);
}

export async function resendReferenceRequest(requestId: number) {
  const [request] = await db.select().from(referenceRequestsTable)
    .where(eq(referenceRequestsTable.id, requestId)).limit(1);
  if (!request || ["completed", "not_verified", "expired"].includes(request.status)) return null;
  const [history] = await db.select().from(rentalHistoryTable)
    .where(eq(rentalHistoryTable.id, request.rentalHistoryId)).limit(1);
  if (!history) return null;
  const [[tenant], [agency]] = await Promise.all([
    db.select({ name: usersTable.name }).from(usersTable)
      .where(eq(usersTable.id, history.tenantUserId)).limit(1),
    request.agencyId
      ? db.select().from(agenciesTable).where(eq(agenciesTable.id, request.agencyId)).limit(1)
      : Promise.resolve([]),
  ]);
  const token = createRentalReferenceToken();
  const now = new Date();
  const email = referenceEmail({
    tenantName: tenant?.name ?? "a QuickProp renter",
    history,
    recipientName: history.refereeName,
    agencyName: agency?.name ?? null,
    token,
    reminder: true,
  });
  const delivery = request.recipientEmail
    ? await sendEmailMessage({
        to: request.recipientEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
        idempotencyKey: `rental-reference-resend-${request.id}-${now.getTime()}`,
      })
    : { status: "skipped" as const, reason: "no_email_address" };
  const [updated] = await db.update(referenceRequestsTable).set({
    tokenHash: hashRentalReferenceToken(token),
    status: request.recipientEmail ? "sent" : "pending",
    sentAt: request.recipientEmail ? now : null,
    expiresAt: new Date(now.getTime() + REFERENCE_TTL_MS),
    providerMessageId: delivery.providerMessageId ?? null,
    lastError: delivery.status === "skipped" ? delivery.reason ?? null : null,
    updatedAt: now,
  }).where(eq(referenceRequestsTable.id, request.id)).returning();
  if (updated) await notifyTenant(history.tenantUserId, "Reference request resent", `We've sent the request to ${history.refereeName ?? "your referee"} again.`);
  return updated ? serializeRequest(updated) : null;
}

export async function getReferenceRequestByToken(token: string) {
  const [row] = await db.select({
    request: referenceRequestsTable,
    history: rentalHistoryTable,
    tenantName: usersTable.name,
    agency: agenciesTable,
  })
    .from(referenceRequestsTable)
    .innerJoin(rentalHistoryTable, eq(rentalHistoryTable.id, referenceRequestsTable.rentalHistoryId))
    .innerJoin(usersTable, eq(usersTable.id, rentalHistoryTable.tenantUserId))
    .leftJoin(agenciesTable, eq(agenciesTable.id, referenceRequestsTable.agencyId))
    .where(eq(referenceRequestsTable.tokenHash, hashRentalReferenceToken(token)))
    .limit(1);
  return row ?? null;
}

export function referenceIsUnavailable(request: typeof referenceRequestsTable.$inferSelect, now = new Date()) {
  return ["completed", "not_verified", "expired"].includes(request.status) || request.expiresAt <= now;
}

export async function submitReference(input: {
  token: string;
  verifiedTenancy: boolean;
  rentPaymentRating?: string;
  propertyConditionRating?: string;
  wouldRentAgain?: boolean;
  submittedBy?: string | null;
}) {
  const row = await getReferenceRequestByToken(input.token);
  if (!row) return { kind: "not_found" as const };
  if (referenceIsUnavailable(row.request)) return {
    kind: row.request.expiresAt <= new Date() ? "expired" as const : "used" as const,
  };

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [request] = await tx.select().from(referenceRequestsTable)
      .where(eq(referenceRequestsTable.id, row.request.id)).limit(1);
    if (!request || referenceIsUnavailable(request, now)) return null;
    const [reference] = await tx.insert(rentalReferencesTable).values({
      rentalHistoryId: row.history.id,
      verifiedTenancy: input.verifiedTenancy,
      rentPaymentRating: input.verifiedTenancy ? input.rentPaymentRating ?? null : null,
      propertyConditionRating: input.verifiedTenancy ? input.propertyConditionRating ?? null : null,
      wouldRentAgain: input.verifiedTenancy ? input.wouldRentAgain ?? null : null,
      submittedBy: input.submittedBy ?? row.request.recipientEmail ?? row.agency?.name ?? null,
      submittedAt: now,
      disputeStatus: "none",
    }).onConflictDoNothing({ target: rentalReferencesTable.rentalHistoryId }).returning();
    if (!reference) return null;
    const status = input.verifiedTenancy ? "verified" : "not_verified";
    await tx.update(referenceRequestsTable).set({
      status,
      completedAt: now,
      updatedAt: now,
    }).where(eq(referenceRequestsTable.id, row.request.id));
    await tx.update(rentalHistoryTable).set({
      verificationStatus: status,
      verifiedAt: input.verifiedTenancy ? now : null,
      updatedAt: now,
    }).where(eq(rentalHistoryTable.id, row.history.id));
    return { reference, status };
  });
  if (!result) return { kind: "used" as const };
  await notifyTenant(
    row.history.tenantUserId,
    result.status === "verified" ? "Rental history verified" : "Rental history could not be verified",
    result.status === "verified"
      ? `${row.history.suburb} is now part of your verified rental history.`
      : `The nominated referee could not verify your ${row.history.suburb} tenancy.`,
  );
  return { kind: "created" as const, status: result.status };
}

export async function runRentalReferenceReminders(now = new Date()) {
  const requests = await db.select().from(referenceRequestsTable)
    .where(and(
      inArray(referenceRequestsTable.status, ["sent", "pending"]),
      lte(referenceRequestsTable.sentAt, now),
      lt(referenceRequestsTable.reminderCount, REMINDER_DELAYS_MS.length),
    ));
  let attempted = 0;
  let sent = 0;
  for (const request of requests) {
    if (!request.sentAt) continue;
    const delay = REMINDER_DELAYS_MS[request.reminderCount];
    if (request.sentAt.getTime() + delay > now.getTime() || request.expiresAt <= now) continue;
    const row = await getReferenceRequestByTokenForReminder(request);
    if (!row) continue;
    const token = createRentalReferenceToken();
    const email = referenceEmail({
      tenantName: row.tenantName,
      history: row.history,
      recipientName: row.history.refereeName,
      agencyName: row.agency?.name ?? null,
      token,
      reminder: true,
    });
    attempted++;
    let delivery: DeliveryResult = { status: "skipped", reason: "no_email_address" };
    if (request.recipientEmail) {
      delivery = await sendEmailMessage({
        to: request.recipientEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
        idempotencyKey: `rental-reference-reminder-${request.id}-${request.reminderCount + 1}`,
      });
    }
    await db.update(referenceRequestsTable).set({
      tokenHash: hashRentalReferenceToken(token),
      reminderCount: request.reminderCount + 1,
      lastReminderAt: now,
      status: "sent",
      providerMessageId: delivery.providerMessageId ?? request.providerMessageId,
      lastError: delivery.status === "skipped" ? delivery.reason ?? null : null,
      updatedAt: now,
    }).where(eq(referenceRequestsTable.id, request.id));
    if (delivery.status === "sent") sent++;
  }
  return { attempted, sent };
}

async function getReferenceRequestByTokenForReminder(request: typeof referenceRequestsTable.$inferSelect) {
  const [row] = await db.select({
    history: rentalHistoryTable,
    tenantName: usersTable.name,
    agency: agenciesTable,
  }).from(rentalHistoryTable)
    .innerJoin(usersTable, eq(usersTable.id, rentalHistoryTable.tenantUserId))
    .leftJoin(agenciesTable, eq(agenciesTable.id, request.agencyId ?? -1))
    .where(eq(rentalHistoryTable.id, request.rentalHistoryId))
    .limit(1);
  return row ?? null;
}

export function startRentalReferenceScheduler() {
  const run = () => runRentalReferenceReminders().catch((error) => {
    logger.error({ error }, "Rental reference reminder run failed");
  });
  run();
  return setInterval(run, 60 * 60 * 1000);
}