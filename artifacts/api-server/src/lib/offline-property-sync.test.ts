import test from "node:test";
import assert from "node:assert/strict";
import { canSyncOfflineProperty } from "./offline-property-sync";

const liveProperty = {
  agentId: 12,
  branchId: 4,
  status: "public",
  pipelineStage: "published",
  availabilityStatus: "available",
};

test("My Listings snapshots only include the signed-in agent's own records", () => {
  assert.equal(canSyncOfflineProperty("my", 12, liveProperty, undefined), true);
  assert.equal(canSyncOfflineProperty("my", 13, liveProperty, undefined), false);
});

test("agency snapshots include drafts and live listings only in active agency branches", () => {
  const draft = { ...liveProperty, status: "draft", pipelineStage: "draft" };
  assert.equal(canSyncOfflineProperty("agency", 13, draft, [4, 5]), true);
  assert.equal(canSyncOfflineProperty("agency", 13, liveProperty, [4, 5]), true);
  assert.equal(canSyncOfflineProperty("agency", 13, { ...liveProperty, status: "archived" }, [4, 5]), false);
  assert.equal(canSyncOfflineProperty("agency", 13, { ...liveProperty, availabilityStatus: "withdrawn" }, [4, 5]), false);
  assert.equal(canSyncOfflineProperty("agency", 13, { ...liveProperty, branchId: 6 }, [4, 5]), false);
  assert.equal(canSyncOfflineProperty("agency", 13, draft, undefined), false);
});
