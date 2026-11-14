import assert from "node:assert/strict";
import { test } from "node:test";
import { canViewAgencyInventory, getActiveAgencyBranchIds } from "./office-inventory-scope";

test("agency inventory access requires an allowed role and a branch in the member's agency", () => {
  const activeAgencyBranchIds = [10, 11];

  assert.equal(canViewAgencyInventory("agent", 10, activeAgencyBranchIds), true);
  assert.equal(canViewAgencyInventory("admin", 10, activeAgencyBranchIds), true);
  assert.equal(canViewAgencyInventory("agent", 20, activeAgencyBranchIds), false);
  assert.equal(canViewAgencyInventory("buyer", 10, activeAgencyBranchIds), false);
  assert.equal(canViewAgencyInventory("agent", null, activeAgencyBranchIds), false);
  assert.equal(canViewAgencyInventory("agent", 10, undefined), false);
});

test("agency inventory includes active branches in the member's active agency", () => {
  assert.deepEqual(
    getActiveAgencyBranchIds(10, { id: 10, agencyId: 3, status: "active" }, "active", [
      { id: 10, agencyId: 3, status: "active" },
      { id: 11, agencyId: 3, status: "active" },
      { id: 12, agencyId: 3, status: "inactive" },
      { id: 20, agencyId: 4, status: "active" },
    ]),
    [10, 11],
  );
});

test("agency inventory is unavailable when the member branch or agency is inactive", () => {
  assert.equal(
    getActiveAgencyBranchIds(10, { id: 10, agencyId: 3, status: "inactive" }, "active", [
      { id: 10, agencyId: 3, status: "active" },
    ]),
    undefined,
  );
  assert.equal(
    getActiveAgencyBranchIds(10, { id: 10, agencyId: 3, status: "active" }, "inactive", [
      { id: 10, agencyId: 3, status: "active" },
    ]),
    undefined,
  );
});

test("agency inventory does not cross into another agency or omit the member's active branch", () => {
  assert.equal(
    getActiveAgencyBranchIds(10, { id: 10, agencyId: 3, status: "active" }, "active", [
      { id: 11, agencyId: 3, status: "active" },
      { id: 20, agencyId: 4, status: "active" },
    ]),
    undefined,
  );
  assert.equal(
    getActiveAgencyBranchIds(10, { id: 10, agencyId: 3, status: "active" }, "active", [
      { id: 10, agencyId: 3, status: "active" },
      { id: 20, agencyId: 4, status: "active" },
    ])?.includes(20),
    false,
  );
});
