import assert from "node:assert/strict";
import { test } from "node:test";
import { canAssignPropertyToAgent } from "./property-assignment";

test("administrators and principals can assign a listing to another agent", () => {
  assert.equal(canAssignPropertyToAgent({ id: 1, role: "admin" }, 24), true);
  assert.equal(canAssignPropertyToAgent({ id: 2, role: "principal" }, 24), true);
});

test("agents can assign listings only to themselves", () => {
  assert.equal(canAssignPropertyToAgent({ id: 12, role: "agent" }, 12), true);
  assert.equal(canAssignPropertyToAgent({ id: 12, role: "agent" }, 24), false);
  assert.equal(canAssignPropertyToAgent({ id: 13, role: "senior_agent" }, 13), true);
  assert.equal(canAssignPropertyToAgent({ id: 13, role: "senior_agent" }, 24), false);
});

test("other roles and invalid agent IDs cannot assign listings", () => {
  assert.equal(canAssignPropertyToAgent({ id: 3, role: "branch_manager" }, 24), false);
  assert.equal(canAssignPropertyToAgent({ id: 4, role: "quickprop_admin" }, 24), false);
  assert.equal(canAssignPropertyToAgent(null, 24), false);
  assert.equal(canAssignPropertyToAgent({ id: 1, role: "admin" }, 0), false);
});
