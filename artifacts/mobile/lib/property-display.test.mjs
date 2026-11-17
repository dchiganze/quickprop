import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPropertyLocation,
  getPropertyDisplayTitle,
  hasVisiblePropertyStats,
} from "./property-display.ts";

test("property titles use saved text and never fall back to a temporary reference", () => {
  assert.equal(getPropertyDisplayTitle("  Avondale Family Home  "), "Avondale Family Home");
  assert.equal(getPropertyDisplayTitle(""), "Untitled listing");
});

test("property location shows suburb and city once each", () => {
  assert.equal(formatPropertyLocation(" Avondale ", "Harare"), "Avondale, Harare");
  assert.equal(formatPropertyLocation("Harare", "harare"), "Harare");
  assert.equal(formatPropertyLocation("", "Harare"), "Harare");
});

test("size-only records still show their property stats", () => {
  assert.equal(hasVisiblePropertyStats({ landSize: 3000 }), true);
  assert.equal(hasVisiblePropertyStats({ floorArea: 180 }), true);
});

test("zero garages is a saved stat and keeps the stats row visible", () => {
  assert.equal(hasVisiblePropertyStats({ garages: 0 }), true);
});

test("empty records do not show an empty stats row", () => {
  assert.equal(hasVisiblePropertyStats({ bedrooms: null, bathrooms: null, garages: null }), false);
});
