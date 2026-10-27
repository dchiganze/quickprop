import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatViewingReminderTime,
  getHarareDayRange,
  isViewingReminderWindow,
} from "./viewing-reminder-planner";

test("viewing reminder window is 7:30 to 7:39 Harare time", () => {
  assert.equal(isViewingReminderWindow(new Date("2026-10-27T05:30:00.000Z")), true);
  assert.equal(isViewingReminderWindow(new Date("2026-10-27T05:39:59.000Z")), true);
  assert.equal(isViewingReminderWindow(new Date("2026-10-27T05:29:59.000Z")), false);
  assert.equal(isViewingReminderWindow(new Date("2026-10-27T05:40:00.000Z")), false);
});

test("viewing day bounds use the Zimbabwe local calendar day", () => {
  const range = getHarareDayRange(new Date("2026-10-27T05:30:00.000Z"));
  assert.equal(range.dateKey, "2026-10-27");
  assert.equal(range.start.toISOString(), "2026-10-26T22:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-27T22:00:00.000Z");
  assert.equal(formatViewingReminderTime(new Date("2026-10-27T08:15:00.000Z")), "10:15");
});
