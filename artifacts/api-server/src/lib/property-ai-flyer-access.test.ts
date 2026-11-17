import assert from "node:assert/strict";
import { test } from "node:test";
import { canGeneratePropertyAIFlyerForListing } from "./property-ai-flyer-access";

test("AI flyers can be generated from published listings", () => {
  assert.equal(canGeneratePropertyAIFlyerForListing({
    isPublic: true,
    isDraft: false,
    isAssignedAgent: false,
    canViewDraftWithinAgency: false,
  }), true);
});

test("an assigned agent can generate an AI flyer from their saved draft", () => {
  assert.equal(canGeneratePropertyAIFlyerForListing({
    isPublic: false,
    isDraft: true,
    isAssignedAgent: true,
    canViewDraftWithinAgency: false,
  }), true);
});

test("an agency member can generate an AI flyer from an accessible agency draft", () => {
  assert.equal(canGeneratePropertyAIFlyerForListing({
    isPublic: false,
    isDraft: true,
    isAssignedAgent: false,
    canViewDraftWithinAgency: true,
  }), true);
});

test("AI flyers cannot be generated from another agency's draft", () => {
  assert.equal(canGeneratePropertyAIFlyerForListing({
    isPublic: false,
    isDraft: true,
    isAssignedAgent: false,
    canViewDraftWithinAgency: false,
  }), false);
});

test("AI flyers remain unavailable for non-public, non-draft listings", () => {
  assert.equal(canGeneratePropertyAIFlyerForListing({
    isPublic: false,
    isDraft: false,
    isAssignedAgent: true,
    canViewDraftWithinAgency: true,
  }), false);
});
