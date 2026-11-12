import assert from "node:assert/strict";
import test from "node:test";
import { matchesPropertySearchQuery, parseSearchQuery } from "./matching";

const highlandsHome = {
  title: "Highlands Family Home",
  reference: "QP-1001",
  suburb: "Highlands",
  address: "Enterprise Road",
  description: "Renovated three-bedroom family home",
  price: 275_000,
  propertyType: "house",
  listingType: "sale",
  bedrooms: 3,
  bathrooms: 2,
  parking: 2,
  features: ["Solar panels", "Borehole"],
};

test("parses bedroom, suburb, and amenity intent from one query", () => {
  assert.deepEqual(parseSearchQuery("3 bedroom in Highlands with solar"), {
    minPrice: undefined,
    maxPrice: undefined,
    propertyType: undefined,
    listingType: undefined,
    bedrooms: 3,
    minBedrooms: undefined,
    bathrooms: undefined,
    garages: undefined,
    suburb: "Highlands",
    amenities: ["solar"],
    keywords: [],
    interpretation: "Searching 3 bedrooms, area: Highlands, features: solar",
  });
});

test("matches only listings satisfying every structured criterion", () => {
  const query = parseSearchQuery("3 bedroom in Highlands with solar");
  assert.equal(matchesPropertySearchQuery(highlandsHome, query), true);
  assert.equal(matchesPropertySearchQuery({ ...highlandsHome, bedrooms: 4 }, query), false);
  assert.equal(matchesPropertySearchQuery({ ...highlandsHome, suburb: "Avondale" }, query), false);
  assert.equal(matchesPropertySearchQuery({ ...highlandsHome, features: ["Borehole"] }, query), false);
});

test("keeps price and property-type filters alongside compound criteria", () => {
  const query = parseSearchQuery("3+ bedrooms in Highlands with solar under 300k house");
  assert.equal(query.minBedrooms, 3);
  assert.equal(query.suburb, "Highlands");
  assert.deepEqual(query.amenities, ["solar"]);
  assert.equal(query.maxPrice, 300_000);
  assert.equal(query.propertyType, "house");
  assert.equal(matchesPropertySearchQuery(highlandsHome, query), true);
  assert.equal(matchesPropertySearchQuery({ ...highlandsHome, price: 320_000 }, query), false);
});
