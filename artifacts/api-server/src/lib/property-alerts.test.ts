import assert from "node:assert/strict";
import test from "node:test";
import type { PropertyAlert } from "@workspace/db";
import { getMatchScore } from "./property-alerts";

const property = {
  status: "public",
  listingType: "sale",
  propertyType: "house",
  city: "Harare",
  suburb: "Avondale",
  price: 250_000,
  currency: "USD",
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  features: ["Solar", "Borehole"],
} as Parameters<typeof getMatchScore>[1];

const alert = {
  transactionType: "sale",
  propertyTypes: ["house"],
  cities: [],
  suburbs: ["Avondale"],
  minPrice: null,
  maxPrice: 300_000,
  currency: "USD",
  minBedrooms: 2,
  minBathrooms: null,
  requiredAmenities: ["solar"],
  preferredAmenities: [],
  furnishedPreference: "any",
  parkingPreference: "any",
  petsPreference: "any",
  powerPreference: "any",
  waterPreference: "any",
} as unknown as PropertyAlert;

test("saved search criteria match a public listing with the selected currency", () => {
  assert.equal(getMatchScore(alert, property), 100);
});

test("saved search criteria reject listings priced in another currency", () => {
  assert.equal(getMatchScore(alert, { ...property, currency: "ZiG" }), null);
});

test("any transaction type still respects property type and criteria", () => {
  assert.equal(
    getMatchScore({ ...alert, transactionType: "any" }, { ...property, listingType: "rent" }),
    100,
  );
  assert.equal(
    getMatchScore({ ...alert, transactionType: "any" }, { ...property, propertyType: "farm" }),
    null,
  );
});
