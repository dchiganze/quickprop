import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowImportDuplicateMatch } from "./import-duplicate-visibility";

test("only actionable duplicate statuses show a match panel", () => {
  assert.equal(shouldShowImportDuplicateMatch("possible"), true);
  assert.equal(shouldShowImportDuplicateMatch("link_existing"), true);
  assert.equal(shouldShowImportDuplicateMatch("clear"), false);
  assert.equal(shouldShowImportDuplicateMatch("keep_separate"), false);
  assert.equal(shouldShowImportDuplicateMatch("none"), false);
});
