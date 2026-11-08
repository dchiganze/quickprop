export const PHONE_OTP_SEND_COOLDOWN_MS = 60_000;
export const PHONE_OTP_SEND_WINDOW_MS = 10 * 60_000;
export const PHONE_OTP_SEND_WINDOW_MAX = 3;
export const PHONE_OTP_SEND_COOLDOWN_SECONDS = PHONE_OTP_SEND_COOLDOWN_MS / 1_000;

export interface PhoneOtpSendAttempt {
  attemptedAt: Date;
}

export type PhoneOtpSendLimit =
  | { allowed: true; retryAfterSeconds: number }
  | { allowed: false; retryAfterSeconds: number };

function secondsUntil(timestamp: number, now: number): number {
  return Math.max(1, Math.ceil((timestamp - now) / 1_000));
}

export function evaluatePhoneOtpSendLimit(
  attempts: readonly PhoneOtpSendAttempt[],
  now = Date.now(),
): PhoneOtpSendLimit {
  const windowStart = now - PHONE_OTP_SEND_WINDOW_MS;
  const recentAttempts = attempts
    .map((attempt) => attempt.attemptedAt.getTime())
    .filter((timestamp) => timestamp > windowStart && timestamp <= now)
    .sort((a, b) => a - b);

  const latestAttempt = recentAttempts.at(-1);
  const cooldownRemaining = latestAttempt === undefined
    ? 0
    : latestAttempt + PHONE_OTP_SEND_COOLDOWN_MS - now;
  const windowRemaining = recentAttempts.length < PHONE_OTP_SEND_WINDOW_MAX
    ? 0
    : recentAttempts[0] + PHONE_OTP_SEND_WINDOW_MS - now;
  const remaining = Math.max(cooldownRemaining, windowRemaining);

  return remaining > 0
    ? { allowed: false, retryAfterSeconds: secondsUntil(now + remaining, now) }
    : { allowed: true, retryAfterSeconds: PHONE_OTP_SEND_COOLDOWN_SECONDS };
}

export type PhoneOtpStartResult =
  | { kind: "accepted"; retryAfterSeconds: number }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "delivery_unavailable"; retryAfterSeconds: number };

export async function runPhoneOtpStart<T>(dependencies: {
  reserveAttempt: () => Promise<PhoneOtpSendLimit>;
  findEligibleAccount: () => Promise<T | null>;
  sendCode: (account: T) => Promise<void>;
}): Promise<PhoneOtpStartResult> {
  const limit = await dependencies.reserveAttempt();
  if (!limit.allowed) {
    return { kind: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const account = await dependencies.findEligibleAccount();
  if (!account) {
    return { kind: "accepted", retryAfterSeconds: PHONE_OTP_SEND_COOLDOWN_SECONDS };
  }

  try {
    await dependencies.sendCode(account);
    return { kind: "accepted", retryAfterSeconds: PHONE_OTP_SEND_COOLDOWN_SECONDS };
  } catch {
    // The reserved attempt remains recorded; do not automatically retry a provider failure.
    return { kind: "delivery_unavailable", retryAfterSeconds: PHONE_OTP_SEND_COOLDOWN_SECONDS };
  }
}

export function isPhoneOtpApproved(status: unknown): boolean {
  return status === "approved";
}
