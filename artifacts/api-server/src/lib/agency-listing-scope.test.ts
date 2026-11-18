import assert from "node:assert/strict";
import test from "node:test";
import { belongsToAgencyListing } from "./agency-listing-scope";

const agencyBranches = new Set([10, 11]);
const agencyAgents = new Set([101, 102]);

test("agency listings match an assigned agency branch", () => {
  assert.equal(belongsToAgencyListing({ branchId: 11, agentId: 999 }, agencyBranches, agencyAgents), true);
});

test("a listing without a branch falls back to its assigned agency agent", () => {
  assert.equal(belongsToAgencyListing({ branchId: null, agentId: 101 }, agencyBranches, agencyAgents), true);
  assert.equal(belongsToAgencyListing({ branchId: null, agentId: 999 }, agencyBranches, agencyAgents), false);
});

test("an explicit branch in another agency is never overridden by its agent", () => {
  assert.equal(belongsToAgencyListing({ branchId: 20, agentId: 101 }, agencyBranches, agencyAgents), false);
});

test("unassigned listings are not attributed to an agency", () => {
  assert.equal(belongsToAgencyListing({ branchId: null, agentId: null }, agencyBranches, agencyAgents), false);
});
