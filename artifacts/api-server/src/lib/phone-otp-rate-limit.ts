import { createHmac } from "node:crypto";
import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { db, phoneOtpSendAttemptsTable } from "@workspace/db";
import {
  evaluatePhoneOtpSendLimit,
  PHONE_OTP_SEND_WINDOW_MS,
  type PhoneOtpSendLimit,
} from "./phone-otp";

function phoneHashSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters to rate-limit phone sign-in.");
  }
  return secret;
}

function hashNormalizedPhone(phone: string): string {
  return createHmac("sha256", phoneHashSecret()).update(phone).digest("hex");
}

export async function reservePhoneOtpSend(phone: string): Promise<PhoneOtpSendLimit> {
  const phoneHash = hashNormalizedPhone(phone);

  return db.transaction(async (tx) => {
    // Serialize requests for this normalized number, including the first concurrent requests.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${phoneHash}, 0))`);

    const clockResult = await tx.execute(sql`SELECT clock_timestamp() AS now`);
    const databaseNow = (clockResult.rows[0] as { now: Date | string } | undefined)?.now;
    if (!databaseNow) throw new Error("Database clock is unavailable for phone sign-in rate limiting.");
    const now = new Date(databaseNow);
    const windowStart = new Date(now.getTime() - PHONE_OTP_SEND_WINDOW_MS);

    // Keep only the active rolling window; phone numbers are represented only by a keyed hash.
    await tx
      .delete(phoneOtpSendAttemptsTable)
      .where(lt(phoneOtpSendAttemptsTable.attemptedAt, windowStart));

    const attempts = await tx
      .select({ attemptedAt: phoneOtpSendAttemptsTable.attemptedAt })
      .from(phoneOtpSendAttemptsTable)
      .where(and(
        eq(phoneOtpSendAttemptsTable.phoneHash, phoneHash),
        gt(phoneOtpSendAttemptsTable.attemptedAt, windowStart),
      ))
      .orderBy(asc(phoneOtpSendAttemptsTable.attemptedAt))
      .limit(3);

    const decision = evaluatePhoneOtpSendLimit(attempts, now.getTime());
    if (!decision.allowed) return decision;

    // Reserve before calling Twilio so failed provider deliveries still consume an attempt.
    await tx.insert(phoneOtpSendAttemptsTable).values({ phoneHash, attemptedAt: now });
    return decision;
  });
}
