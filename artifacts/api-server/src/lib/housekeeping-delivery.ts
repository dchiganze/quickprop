import { and, eq, inArray, lte, lt, or } from "drizzle-orm";
import {
  db,
  listingHousekeepingDeliveriesTable,
  listingHousekeepingPreferencesTable,
  userPushTokensTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";

export const REMINDER_CHANNELS = ["whatsapp", "push", "email"] as const;
export type ReminderChannel = typeof REMINDER_CHANNELS[number];

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000];

export type ReminderDeliveryPayload = {
  reference: string;
  title: string;
  freshnessStatus: string;
  reminderKey: string;
  message: string;
};

export type DeliveryResult = {
  status: "sent" | "skipped";
  providerMessageId?: string;
  reason?: string;
};

export type EmailMessage = {
  to: string | null;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey: string;
};

type ProviderResponse = {
  id?: string;
  messageId?: string;
  data?: unknown;
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalizeWhatsAppNumber(phone: string): string {
  return phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
}

async function postJson(url: string, body: unknown, idempotencyKey: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const bodyText = (await response.text()).slice(0, 500);
    throw new Error(`Provider returned ${response.status}: ${bodyText || response.statusText}`);
  }
  const result = await response.json().catch(() => ({})) as ProviderResponse;
  return result;
}

async function sendWhatsApp(
  phone: string | null,
  payload: ReminderDeliveryPayload,
  deliveryId: number,
): Promise<DeliveryResult> {
  if (!phone) return { status: "skipped", reason: "no_phone_number" };
  const webhook = env("QUICKPROP_WHATSAPP_WEBHOOK_URL");
  if (webhook) {
    const result = await postJson(webhook, {
      channel: "whatsapp",
      to: phone,
      message: payload.message,
      listing: payload,
    }, `housekeeping-delivery-${deliveryId}`);
    return {
      status: "sent",
      providerMessageId: result.id ?? result.messageId,
    };
  }

  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_WHATSAPP_FROM");
  if (!accountSid || !authToken || !from) {
    return { status: "skipped", reason: "whatsapp_provider_not_configured" };
  }

  const form = new URLSearchParams({
    To: normalizeWhatsAppNumber(phone),
    From: normalizeWhatsAppNumber(from),
    Body: payload.message,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const bodyText = (await response.text()).slice(0, 500);
    throw new Error(`WhatsApp provider returned ${response.status}: ${bodyText || response.statusText}`);
  }
  const result = await response.json() as { sid?: string };
  return { status: "sent", providerMessageId: result.sid };
}

export async function sendEmailMessage(message: EmailMessage): Promise<DeliveryResult> {
  if (!message.to) return { status: "skipped", reason: "no_email_address" };
  const webhook = env("QUICKPROP_EMAIL_WEBHOOK_URL");
  if (webhook) {
    const result = await postJson(webhook, {
      channel: "email",
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }, message.idempotencyKey);
    return {
      status: "sent",
      providerMessageId: result.id ?? result.messageId,
    };
  }

  const resendKey = env("RESEND_API_KEY");
  const from = env("QUICKPROP_EMAIL_FROM");
  if (!resendKey || !from) {
    return { status: "skipped", reason: "email_provider_not_configured" };
  }

  const result = await postJson(
    "https://api.resend.com/emails",
    {
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    },
    message.idempotencyKey,
    { Authorization: `Bearer ${resendKey}` },
  );
  return {
    status: "sent",
    providerMessageId: result.id ?? result.messageId,
  };
}

async function sendEmail(
  email: string | null,
  payload: ReminderDeliveryPayload,
  deliveryId: number,
): Promise<DeliveryResult> {
  return sendEmailMessage({
    to: email,
    subject: `Listing reminder: ${payload.reference}`,
    text: payload.message,
    idempotencyKey: `housekeeping-delivery-${deliveryId}`,
  });
}

async function sendPush(
  userId: number,
  payload: ReminderDeliveryPayload,
  deliveryId: number,
): Promise<DeliveryResult> {
  const tokens = await db.select().from(userPushTokensTable).where(and(
    eq(userPushTokensTable.userId, userId),
    eq(userPushTokensTable.active, true),
  ));
  if (!tokens.length) return { status: "skipped", reason: "no_active_push_token" };

  const ids: string[] = [];
  for (const token of tokens) {
    const result = await postJson(
      "https://exp.host/--/api/v2/push/send",
      {
        to: token.token,
        title: `Listing ${payload.freshnessStatus}: ${payload.reference}`,
        body: payload.message,
        data: { type: "listing_housekeeping", reference: payload.reference },
      },
      `housekeeping-delivery-${deliveryId}-${token.id}`,
    );
    const resultData = Array.isArray(result.data) ? result.data[0] : result.data;
    if (resultData && typeof resultData === "object" && "status" in resultData && resultData.status !== "ok") {
      const errorMessage = "message" in resultData && typeof resultData.message === "string"
        ? resultData.message
        : "Expo rejected the push notification";
      throw new Error(errorMessage);
    }
    if (result.id ?? result.messageId) ids.push(result.id ?? result.messageId!);
  }
  return { status: "sent", providerMessageId: ids.join(",") || undefined };
}

async function sendDelivery(
  delivery: typeof listingHousekeepingDeliveriesTable.$inferSelect,
  user: typeof usersTable.$inferSelect,
): Promise<DeliveryResult> {
  const payload = delivery.payload as ReminderDeliveryPayload;
  if (delivery.channel === "whatsapp") return sendWhatsApp(user.phone, payload, delivery.id);
  if (delivery.channel === "email") return sendEmail(user.email, payload, delivery.id);
  if (delivery.channel === "push") return sendPush(user.id, payload, delivery.id);
  return { status: "skipped", reason: "unsupported_channel" };
}

export async function deliverDueHousekeepingReminders() {
  const now = new Date();
  const abandonedBefore = new Date(now.getTime() - 15 * 60_000);
  const due = await db.select().from(listingHousekeepingDeliveriesTable).where(and(
    // A short lease prevents a crashed worker from leaving a delivery stuck in
    // "sending" forever, while still avoiding two live workers sending it.
    or(
      inArray(listingHousekeepingDeliveriesTable.status, ["pending", "failed"]),
      and(
        eq(listingHousekeepingDeliveriesTable.status, "sending"),
        lte(listingHousekeepingDeliveriesTable.updatedAt, abandonedBefore),
      ),
    ),
    lt(listingHousekeepingDeliveriesTable.attempts, MAX_ATTEMPTS),
    lte(listingHousekeepingDeliveriesTable.nextAttemptAt, now),
  )).limit(100);

  let sent = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;
  for (const candidate of due) {
    const [claimed] = await db.update(listingHousekeepingDeliveriesTable).set({
      status: "sending",
      updatedAt: new Date(),
    }).where(and(
      eq(listingHousekeepingDeliveriesTable.id, candidate.id),
      or(
        inArray(listingHousekeepingDeliveriesTable.status, ["pending", "failed"]),
        and(
          eq(listingHousekeepingDeliveriesTable.status, "sending"),
          lte(listingHousekeepingDeliveriesTable.updatedAt, abandonedBefore),
        ),
      ),
      lt(listingHousekeepingDeliveriesTable.attempts, MAX_ATTEMPTS),
      lte(listingHousekeepingDeliveriesTable.nextAttemptAt, now),
    )).returning();
    if (!claimed) continue;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, claimed.userId)).limit(1);
    if (!user) {
      await db.update(listingHousekeepingDeliveriesTable).set({
        status: "skipped",
        lastError: "user_not_found",
        updatedAt: new Date(),
      }).where(eq(listingHousekeepingDeliveriesTable.id, claimed.id));
      skipped++;
      continue;
    }

    try {
      const [preferences] = await db.select().from(listingHousekeepingPreferencesTable)
        .where(eq(listingHousekeepingPreferencesTable.userId, user.id)).limit(1);
      const channelEnabled = preferences?.[`${claimed.channel}Enabled` as "whatsappEnabled" | "pushEnabled" | "emailEnabled"] ?? true;
      if (!channelEnabled) {
        await db.update(listingHousekeepingDeliveriesTable).set({
          status: "skipped",
          lastError: "channel_disabled",
          updatedAt: new Date(),
        }).where(eq(listingHousekeepingDeliveriesTable.id, claimed.id));
        skipped++;
        continue;
      }
      const result = await sendDelivery(claimed, user);
      await db.update(listingHousekeepingDeliveriesTable).set({
        status: result.status,
        providerMessageId: result.providerMessageId ?? null,
        lastError: result.reason ?? null,
        sentAt: result.status === "sent" ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(listingHousekeepingDeliveriesTable.id, claimed.id));
      if (result.status === "sent") sent++;
      else skipped++;
    } catch (error) {
      const attempts = claimed.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      const nextAttemptAt = new Date(Date.now() + (RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS.at(-1)!));
      await db.update(listingHousekeepingDeliveriesTable).set({
        status: exhausted ? "failed" : "pending",
        attempts,
        nextAttemptAt,
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      }).where(eq(listingHousekeepingDeliveriesTable.id, claimed.id));
      if (exhausted) failed++;
      else retried++;
      logger.warn({ deliveryId: claimed.id, channel: claimed.channel, attempts }, "Listing reminder delivery failed");
    }
  }
  return { attempted: due.length, sent, retried, failed, skipped };
}