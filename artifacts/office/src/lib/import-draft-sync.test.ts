import assert from "node:assert/strict";
import test from "node:test";
import { syncImportDraftState, type ImportDraftState } from "./import-draft-sync";

const emptyState: ImportDraftState = { drafts: {}, serverData: {} };

test("refreshes an untouched draft when a reprocess updates the same record ID", () => {
  const before = syncImportDraftState(emptyState, [{ id: 27, data: { title: "" } }]);
  const after = syncImportDraftState(before, [{ id: 27, data: { title: "Eastlea" } }]);

  assert.equal(after.drafts[27]?.title, "Eastlea");
  assert.equal(after.serverData[27]?.title, "Eastlea");
});

test("preserves a local edit while recording the latest server snapshot", () => {
  const before = syncImportDraftState(emptyState, [{ id: 27, data: { title: "Eastlea" } }]);
  const edited: ImportDraftState = {
    ...before,
    drafts: { ...before.drafts, 27: { title: "My corrected title" } },
  };
  const after = syncImportDraftState(edited, [{ id: 27, data: { title: "Eastlea Centre" } }]);

  assert.equal(after.drafts[27]?.title, "My corrected title");
  assert.equal(after.serverData[27]?.title, "Eastlea Centre");
});

test("removes editor state for rows no longer returned by the server", () => {
  const before = syncImportDraftState(emptyState, [
    { id: 27, data: { title: "Eastlea" } },
    { id: 28, data: { title: "Avondale" } },
  ]);
  const after = syncImportDraftState(before, [{ id: 27, data: { title: "Eastlea" } }]);

  assert.deepEqual(Object.keys(after.drafts), ["27"]);
  assert.deepEqual(Object.keys(after.serverData), ["27"]);
});
