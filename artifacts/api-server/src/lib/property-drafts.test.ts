import assert from "node:assert/strict";
import test from "node:test";
import { hasListingPhotos, importedPropertyDraft, needsPublicationPhoto } from "./property-drafts";

test("all imports start as unpublished drafts, including imports containing photos", () => {
  for (const photos of [undefined, [], ["https://example.com/photo.jpg"]]) {
    const draft = importedPropertyDraft(photos);
    assert.equal(draft.status, "draft");
    assert.equal(draft.pipelineStage, "draft");
    assert.equal(draft.publishedAt, null);
  }
});

test("imports retain real photo references and discard empty/non-photo values", () => {
  assert.deepEqual(importedPropertyDraft([" ", null, 123, " /api/storage/objects/photo.jpg "]).photos, ["/api/storage/objects/photo.jpg"]);
});

test("draft edits can have no photos but publishing requires a nonblank photo", () => {
  assert.equal(needsPublicationPhoto({ status: "draft", pipelineStage: "draft", photos: [] }), false);
  for (const status of ["public", "under_offer", "coming_soon"]) {
    assert.equal(needsPublicationPhoto({ status, photos: [] }), true);
    assert.equal(needsPublicationPhoto({ status, photos: [" "] }), true);
    assert.equal(needsPublicationPhoto({ status, photos: ["/api/storage/objects/photo.jpg"] }), false);
  }
  assert.equal(needsPublicationPhoto({ status: "draft", pipelineStage: "published", photos: [] }), true);
  assert.equal(hasListingPhotos([null, 0, " "]), false);
});
