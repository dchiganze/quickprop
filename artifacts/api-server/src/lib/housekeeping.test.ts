import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateFreshness,
  DEFAULT_HOUSEKEEPING_SETTINGS,
  inputFromRelationship,
  makeReminderEventKey,
  needsPublicationBaseline,
  normalizeHousekeepingSettings,
  shouldAutoDraftPublishedListing,
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
    ["update_required", withNextConfirmation(-7)],
    ["potentially_stale", withNextConfirmation(-12)],
    ["stale", withNextConfirmation(-20)],
  ] as const;

  for (const [expected, result] of cases) {
    assert.equal(result.freshnessStatus, expected);
  }

  assert.equal(cases[0][1].reminderKey, null);
  assert.equal(cases[1][1].reminderKey, null);
  assert.equal(cases[2][1].reminderKey, "overdue-0");
  assert.equal(cases[3][1].reminderKey, "overdue-5");
  assert.equal(cases[4][1].reminderKey, "overdue-10");
  assert.equal(cases[5][1].reminderKey, "overdue-20");
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
    ["due", atOverdue(0), "overdue-0"],
    ["due", atOverdue(5 * DAY - 1), "overdue-0"],
    ["update_required", atOverdue(5 * DAY), "overdue-5"],
    ["update_required", atOverdue(10 * DAY - 1), "overdue-5"],
    ["potentially_stale", atOverdue(10 * DAY), "overdue-10"],
    ["potentially_stale", atOverdue(15 * DAY - 1), "overdue-10"],
    ["stale", atOverdue(15 * DAY), "overdue-15"],
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
    now.getTime() + 29 * DAY,
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
    nextConfirmationAt: new Date(now.getTime() - 4 * DAY),
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
  assert.equal(DEFAULT_HOUSEKEEPING_SETTINGS.firstConfirmationDays, 30);
  assert.equal(DEFAULT_HOUSEKEEPING_SETTINGS.softReminderDays, 5);
  assert.equal(DEFAULT_HOUSEKEEPING_SETTINGS.staleOverdueDays, 15);
});

test("normalizes the previous default policy to 30-day listing cycles", () => {
  const normalized = normalizeHousekeepingSettings({
    softReminderDays: 7,
    firstConfirmationDays: 14,
    recurringConfirmationDays: 30,
    updateRequiredOverdueDays: 7,
    potentiallyStaleOverdueDays: 14,
    staleOverdueDays: 30,
  });

  assert.deepEqual(normalized, DEFAULT_HOUSEKEEPING_SETTINGS);
});

test("reminder event keys are stable per confirmation cycle", () => {
  const firstDueDate = new Date("2026-09-01T12:00:00.000Z");
  const nextDueDate = new Date("2026-10-01T12:00:00.000Z");

  assert.equal(makeReminderEventKey("due-soon", firstDueDate), makeReminderEventKey("due-soon", firstDueDate));
  assert.notEqual(makeReminderEventKey("due-soon", firstDueDate), makeReminderEventKey("due-soon", nextDueDate));
});

test("legacy public listings without dates receive a fresh baseline", () => {
  assert.equal(needsPublicationBaseline("public", null, null), true);
  assert.equal(needsPublicationBaseline("public", new Date(), null), false);
  assert.equal(needsPublicationBaseline("public", null, new Date()), false);
  assert.equal(needsPublicationBaseline("draft", null, null), false);
});

test("only expired, publicly available listings are auto-drafted", () => {
  const overdue = new Date(now.getTime() - 1);
  const future = new Date(now.getTime() + 1);

  assert.equal(shouldAutoDraftPublishedListing("public", "available", overdue, now), true);
  assert.equal(shouldAutoDraftPublishedListing("public", "under_offer", overdue, now), true);
  assert.equal(shouldAutoDraftPublishedListing("public", "sold", overdue, now), false);
  assert.equal(shouldAutoDraftPublishedListing("draft", "available", overdue, now), false);
  assert.equal(shouldAutoDraftPublishedListing("public", "available", future, now), false);
});