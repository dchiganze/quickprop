import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFlyerCopyPrompt,
  FLYER_COPY_SYSTEM_INSTRUCTION,
  normalizeFlyerCopy,
} from "./property-flyer-copy";

test("flyer copy prompt includes only bounded public listing facts", () => {
  const prompt = buildFlyerCopyPrompt({
    title: "  Borrowdale Family Home  ",
    description: "Solar backup, borehole and a garden.",
    propertyType: "house",
    listingType: "sale",
    suburb: "Borrowdale",
    city: "Harare",
    bedrooms: 4,
    bathrooms: 3,
    parking: 2,
    landSize: 2_000,
    buildingSize: null,
    features: Array.from({ length: 10 }, (_, index) => `Feature ${index + 1}`),
  });

  assert.match(prompt, /Borrowdale Family Home/);
  assert.match(prompt, /Solar backup, borehole and a garden/);
  assert.match(prompt, /Harare/);
  assert.equal((prompt.match(/Feature \d+/g) ?? []).length, 8);
  assert.doesNotMatch(prompt, /seller|privateNotes|phone/i);
  assert.match(FLYER_COPY_SYSTEM_INSTRUCTION, /untrusted listing data/);
});

test("flyer copy normalization cleans formatting and rejects empty output", () => {
  assert.equal(
    normalizeFlyerCopy('  "A bright family home with solar backup."  '),
    "A bright family home with solar backup.",
  );
  assert.equal(normalizeFlyerCopy("  \n "), null);
  assert.equal(normalizeFlyerCopy("Too short"), null);
});

test("flyer copy is bounded without cutting off a complete early sentence", () => {
  const output = normalizeFlyerCopy(
    `A welcoming home with generous living space. ${"Additional details ".repeat(30)}`,
  );

  assert.equal(output, "A welcoming home with generous living space.");
});
