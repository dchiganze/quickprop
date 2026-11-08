import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluatePhoneOtpSendLimit,
  isPhoneOtpApproved,
  PHONE_OTP_SEND_COOLDOWN_MS,
  PHONE_OTP_SEND_WINDOW_MS,
  runPhoneOtpStart,
} from "./phone-otp";

test("phone OTP cooldown blocks sends until 60 seconds after the previous attempt", () => {
  const now = 1_800_000_000_000;
  const justTooSoon = evaluatePhoneOtpSendLimit(
    [{ attemptedAt: new Date(now - PHONE_OTP_SEND_COOLDOWN_MS + 1) }],
    now,
  );
  const atCooldownBoundary = evaluatePhoneOtpSendLimit(
    [{ attemptedAt: new Date(now - PHONE_OTP_SEND_COOLDOWN_MS) }],
    now,
  );

  assert.deepEqual(justTooSoon, { allowed: false, retryAfterSeconds: 1 });
  assert.deepEqual(atCooldownBoundary, { allowed: true, retryAfterSeconds: 60 });
});

test("the rolling window blocks a fourth attempt until the oldest attempt expires", () => {
  const now = 1_800_000_000_000;
  const attempts = [
    { attemptedAt: new Date(now - 5 * 60_000) },
    { attemptedAt: new Date(now - 3 * 60_000) },
    { attemptedAt: new Date(now - 2 * 60_000) },
  ];

  assert.deepEqual(evaluatePhoneOtpSendLimit(attempts, now), {
    allowed: false,
    retryAfterSeconds: 300,
  });
  assert.deepEqual(
    evaluatePhoneOtpSendLimit(
      [{ attemptedAt: new Date(now - PHONE_OTP_SEND_WINDOW_MS) }],
      now,
    ),
    { allowed: true, retryAfterSeconds: 60 },
  );
});

test("failed Twilio delivery keeps the reserved attempt and never retries automatically", async () => {
  const now = 1_800_000_000_000;
  const storedAttempts: { attemptedAt: Date }[] = [];
  let deliveryCalls = 0;
  const reserveAttempt = async () => {
    const decision = evaluatePhoneOtpSendLimit(storedAttempts, now);
    if (decision.allowed) storedAttempts.push({ attemptedAt: new Date(now) });
    return decision;
  };

  const result = await runPhoneOtpStart({
    reserveAttempt,
    findEligibleAccount: async () => ({ id: 42 }),
    sendCode: async () => {
      deliveryCalls += 1;
      throw new Error("Provider rejection details must not be exposed or retried.");
    },
  });

  assert.deepEqual(result, { kind: "delivery_unavailable", retryAfterSeconds: 60 });
  assert.equal(storedAttempts.length, 1);
  assert.equal(deliveryCalls, 1);
  assert.deepEqual(await reserveAttempt(), { allowed: false, retryAfterSeconds: 60 });
});

test("unknown numbers get the same accepted result without a Twilio send", async () => {
  let deliveryCalls = 0;
  const result = await runPhoneOtpStart({
    reserveAttempt: async () => ({ allowed: true, retryAfterSeconds: 60 }),
    findEligibleAccount: async () => null,
    sendCode: async () => {
      deliveryCalls += 1;
    },
  });

  assert.deepEqual(result, { kind: "accepted", retryAfterSeconds: 60 });
  assert.equal(deliveryCalls, 0);
});

test("phone OTP verification accepts only Twilio's approved status", () => {
  assert.equal(isPhoneOtpApproved("approved"), true);
  assert.equal(isPhoneOtpApproved("pending"), false);
  assert.equal(isPhoneOtpApproved(undefined), false);
});
