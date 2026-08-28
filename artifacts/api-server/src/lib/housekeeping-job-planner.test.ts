import assert from "node:assert/strict";
import { test } from "node:test";
import {
  planHousekeepingActions,
  type HousekeepingActionPlanInput,
} from "./housekeeping-planner";

test("a repeated housekeeping day does not plan duplicate records", () => {
  const state: HousekeepingActionPlanInput = {
    previousStatus: "fresh",
    nextStatus: "stale",
    reminderKey: "overdue-30",
    agentId: 42,
    existingReminder: false,
    hasOpenTask: false,
  };

  const firstRun = planHousekeepingActions(state);
  assert.deepEqual(firstRun, {
    statusEvent: true,
    reminderEvent: true,
    notification: true,
    task: true,
  });

  const secondRun = planHousekeepingActions({
    ...state,
    previousStatus: state.nextStatus,
    existingReminder: state.existingReminder || firstRun.reminderEvent,
    hasOpenTask: state.hasOpenTask || firstRun.task,
  });
  assert.deepEqual(secondRun, {
    statusEvent: false,
    reminderEvent: false,
    notification: false,
    task: false,
  });
});

test("the same canonical property can plan different agent outcomes", () => {
  const staleAgent = planHousekeepingActions({
    previousStatus: "fresh",
    nextStatus: "stale",
    reminderKey: "overdue-30",
    agentId: 10,
    existingReminder: false,
    hasOpenTask: false,
  });
  const freshAgent = planHousekeepingActions({
    previousStatus: "fresh",
    nextStatus: "fresh",
    reminderKey: null,
    agentId: 11,
    existingReminder: false,
    hasOpenTask: false,
  });

  assert.equal(staleAgent.reminderEvent, true);
  assert.equal(staleAgent.task, true);
  assert.deepEqual(freshAgent, {
    statusEvent: false,
    reminderEvent: false,
    notification: false,
    task: false,
  });
});