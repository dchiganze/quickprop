import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPropertyAIFlyerPrompt,
  buildFlyerCopyPrompt,
  FLYER_COPY_SYSTEM_INSTRUCTION,
  normalizePropertyAIFlyer,
  normalizeFlyerCopy,
  PROPERTY_AI_FLYER_SYSTEM_INSTRUCTION,
} from "./property-flyer-copy";

const facts = {
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
};

test("flyer copy prompt includes only bounded public listing facts", () => {
  const prompt = buildFlyerCopyPrompt(facts);

  assert.match(prompt, /Borrowdale Family Home/);
  assert.match(prompt, /Solar backup, borehole and a garden/);
  assert.match(prompt, /Harare/);
  assert.equal((prompt.match(/Feature \d+/g) ?? []).length, 8);
  assert.doesNotMatch(prompt, /seller|privateNotes|phone/i);
  assert.match(FLYER_COPY_SYSTEM_INSTRUCTION, /untrusted listing data/);
});

test("AI flyer prompt bounds the user's style request and preserves only public facts", () => {
  const prompt = buildPropertyAIFlyerPrompt(facts, `  Elegant, dark navy and spacious\u0000${"x".repeat(400)}`);
  assert.match(prompt, /"styleRequest":"Elegant, dark navy and spacious/);
  assert.doesNotMatch(prompt, /x{301}/);
  assert.match(prompt, /"title":"Borrowdale Family Home"/);
  assert.match(PROPERTY_AI_FLYER_SYSTEM_INSTRUCTION, /only visual direction and writing tone/);
  assert.match(PROPERTY_AI_FLYER_SYSTEM_INSTRUCTION, /agency logo and all property photos unchanged/);
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

test("AI flyer normalization allows only safe design options", () => {
  assert.deepEqual(
    normalizePropertyAIFlyer('{"copy":"A generous family home with solar backup.","designStyle":"luxury","palette":"navy"}'),
    { copy: "A generous family home with solar backup.", designStyle: "luxury", palette: "navy" },
  );
  assert.equal(
    normalizePropertyAIFlyer('{"copy":"A generous family home with solar backup.","designStyle":"invented","palette":"navy"}'),
    null,
  );
  assert.equal(
    normalizePropertyAIFlyer('{"copy":"A generous family home with solar backup.","designStyle":"bold","palette":"#FFFFFF"}'),
    null,
  );
});
