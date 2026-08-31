import assert from "node:assert/strict";
import { test } from "node:test";
import { createReviewToken, hashReviewToken } from "./agent-review-tokens";
import {
  nextReviewDeliveryAt,
  REVIEW_INITIAL_DELAY_MS,
  REVIEW_REMINDER_INTERVAL_MS,
} from "./agent-reviews";

test("review tokens are random, fixed-length, and stored as one-way hashes", () => {
  const token = createReviewToken();
  const hash = hashReviewToken(token);

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(hashReviewToken(token), hash);
  assert.notEqual(hashReviewToken(createReviewToken()), hash);
});

test("review delivery starts two hours after closure and repeats weekly", () => {
  const closedAt = new Date("2026-08-31T12:00:00.000Z");
  const initialDelivery = nextReviewDeliveryAt(closedAt, 0);
  const firstReminder = nextReviewDeliveryAt(initialDelivery, 1);
  const secondReminder = nextReviewDeliveryAt(firstReminder, 2);

  assert.equal(
    initialDelivery.getTime(),
    closedAt.getTime() + REVIEW_INITIAL_DELAY_MS,
  );
  assert.equal(
    firstReminder.getTime(),
    initialDelivery.getTime() + REVIEW_REMINDER_INTERVAL_MS,
  );
  assert.equal(
    secondReminder.getTime(),
    firstReminder.getTime() + REVIEW_REMINDER_INTERVAL_MS,
  );
});