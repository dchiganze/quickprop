import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateFreshness,
  DEFAULT_HOUSEKEEPING_SETTINGS,
  inputFromRelationship,
  type FreshnessInput,
} from "./housekeeping";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-08-28T12:00:00.000Z");

function input(overrides: Partial<FreshnessInput> = {}): FreshnessInput {
  return {
    createdAt: new Date(now.getTime() - DAY),
    lastUpdatedAt: new Date(now.getTime() - DAY),
    availabilityStatus: "available",
    ...overrides,
  };
}

function withNextConfirmation(daysFromNow: number, overrides: Partial<FreshnessInput> = {}) {
  return calculateFreshness(
    input({
      lastConfirmedAt: new Date(now.getTime() - 60 * DAY),
      nextConfirmationAt: new Date(now.getTime() + daysFromNow * DAY),
      ...overrides,
    }),
    now,
  );
}

test("classifies every active freshness state at its threshold", () => {
  const cases = [
    ["new", calculateFreshness(input(), now)],
    ["fresh", withNextConfirmation(10)],
    ["due", withNextConfirmation(-3)],
    ["update_required", withNextConfirmation(-10)],
    ["potentially_stale", withNextConfirmation(-20)],
    ["stale", withNextConfirmation(-35)],
  ] as const;

  for (const [expected, result] of cases) {
    assert.equal(result.freshnessStatus, expected);
  }

  assert.equal(cases[0][1].reminderKey, null);
  assert.equal(cases[1][1].reminderKey, null);
  assert.equal(cases[2][1].reminderKey, "due");
  assert.equal(cases[3][1].reminderKey, "overdue-7");
  assert.equal(cases[4][1].reminderKey, "overdue-14");
  assert.equal(cases[5][1].reminderKey, "overdue-30");
});

test("changes state exactly at each freshness boundary", () => {
  const atOverdue = (milliseconds: number) => calculateFreshness(
    input({
      lastConfirmedAt: new Date(now.getTime() - 60 * DAY),
      nextConfirmationAt: new Date(now.getTime() - milliseconds),
    }),
    now,
  );
  const cases = [
    ["fresh", atOverdue(-1), "due-soon"],
    ["due", atOverdue(0), "due"],
    ["due", atOverdue(7 * DAY - 1), "due"],
    ["update_required", atOverdue(7 * DAY), "overdue-7"],
    ["update_required", atOverdue(14 * DAY - 1), "overdue-7"],
    ["potentially_stale", atOverdue(14 * DAY), "overdue-14"],
    ["potentially_stale", atOverdue(30 * DAY - 1), "overdue-14"],
    ["stale", atOverdue(30 * DAY), "overdue-30"],
  ] as const;

  for (const [status, result, reminderKey] of cases) {
    assert.equal(result.freshnessStatus, status);
    assert.equal(result.reminderKey, reminderKey);
  }
});

test("uses the configured first and recurring confirmation windows", () => {
  const firstConfirmation = calculateFreshness(
    input({ createdAt: new Date(now.getTime() - DAY) }),
    now,
  );
  const recurringConfirmation = calculateFreshness(
    input({
      createdAt: new Date(now.getTime() - 60 * DAY),
      lastConfirmedAt: new Date(now.getTime() - DAY),
    }),
    now,
  );

  assert.equal(
    firstConfirmation.nextConfirmationAt.getTime(),
    now.getTime() + 13 * DAY,
  );
  assert.equal(
    recurringConfirmation.nextConfirmationAt.getTime(),
    now.getTime() + 29 * DAY,
  );
  assert.equal(firstConfirmation.freshnessStatus, "new");
  assert.equal(recurringConfirmation.freshnessStatus, "fresh");
});

test("marks unavailable listings inactive without stale reminders", () => {
  const result = withNextConfirmation(-35, { availabilityStatus: "sold" });

  assert.equal(result.freshnessStatus, "inactive");
  assert.equal(result.freshnessScore, 0);
  assert.equal(result.staleSince, null);
  assert.equal(result.reminderKey, null);
});

test("a reactivated listing returns to a fresh relationship state", () => {
  const inactive = withNextConfirmation(-35, { availabilityStatus: "withdrawn" });
  const reactivated = withNextConfirmation(10, { availabilityStatus: "available" });

  assert.equal(inactive.freshnessStatus, "inactive");
  assert.equal(reactivated.freshnessStatus, "fresh");
  assert.equal(reactivated.reminderKey, null);
});

test("confirmation timing is scoped to each agent relationship", () => {
  const property = {
    createdAt: new Date(now.getTime() - 60 * DAY),
    updatedAt: new Date(now.getTime() - 60 * DAY),
    photos: [],
    title: "Shared canonical property",
    description: "A property shared by two agents",
    price: 250000,
    suburb: "Avondale",
    propertyType: "house",
    bedrooms: 3,
    bathrooms: 2,
  } as any;
  const agentOne = {
    createdAt: new Date(now.getTime() - 60 * DAY),
    lastAvailabilityConfirmation: new Date(now.getTime() - 2 * DAY),
    lastUpdate: new Date(now.getTime() - 2 * DAY),
    nextConfirmationAt: new Date(now.getTime() + 28 * DAY),
    availabilityStatus: "available",
    description: null,
    askingPrice: 250000,
  } as any;
  const agentTwo = {
    createdAt: new Date(now.getTime() - 60 * DAY),
    lastAvailabilityConfirmation: new Date(now.getTime() - 60 * DAY),
    lastUpdate: new Date(now.getTime() - 60 * DAY),
    nextConfirmationAt: new Date(now.getTime() - 5 * DAY),
    availabilityStatus: "available",
    description: null,
    askingPrice: 250000,
  } as any;

  const first = calculateFreshness(inputFromRelationship(property, agentOne), now);
  const second = calculateFreshness(inputFromRelationship(property, agentTwo), now);

  assert.equal(first.freshnessStatus, "fresh");
  assert.equal(second.freshnessStatus, "due");
  assert.equal(first.daysSinceConfirmation, 2);
  assert.equal(second.daysSinceConfirmation, 60);
});

test("keeps freshness score stable for identical inputs", () => {
  const first = calculateFreshness(input({ photos: ["a", "b"], title: "A listing" }), now);
  const second = calculateFreshness(input({ photos: ["a", "b"], title: "A listing" }), now);

  assert.deepEqual(second, first);
  assert.equal(first.freshnessScore, 100);
  assert.equal(DEFAULT_HOUSEKEEPING_SETTINGS.staleOverdueDays, 30);
});