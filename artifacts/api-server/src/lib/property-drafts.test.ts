import assert from "node:assert/strict";
import test from "node:test";
import {
  hasListingPhotos,
  hasPositiveDraftPrice,
  hasValidListingPrice,
  importedPropertyDraft,
  isDraftBlockingImportIssue,
  needsPublicationPhoto,
} from "./property-drafts";

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

test("draft imports allow incomplete listing details but retain branch and duplicate-check blockers", () => {
  assert.equal(isDraftBlockingImportIssue("Address is missing"), false);
  assert.equal(isDraftBlockingImportIssue("Property type is missing"), false);
  assert.equal(isDraftBlockingImportIssue("Choose an active branch before approving this listing."), true);
  assert.equal(isDraftBlockingImportIssue("Exact title-and-price duplicate check unavailable."), true);
});

test("drafts require a positive finite price", () => {
  assert.equal(hasPositiveDraftPrice(275000), true);
  assert.equal(hasPositiveDraftPrice(0), false);
  assert.equal(hasPositiveDraftPrice(-1), false);
  assert.equal(hasPositiveDraftPrice(Number.NaN), false);
  assert.equal(hasPositiveDraftPrice(null), false);
});

test("POA is accepted as a valid listing price without accepting unmarked zero", () => {
  assert.equal(hasValidListingPrice(0, true), true);
  assert.equal(hasValidListingPrice(275000, false), true);
  assert.equal(hasValidListingPrice(0, false), false);
  assert.equal(hasValidListingPrice(-1, true), true);
});
