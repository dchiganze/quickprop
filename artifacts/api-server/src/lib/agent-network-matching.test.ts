import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchNetworkListings,
  matchNetworkRequirements,
  scoreNetworkMatch,
  type NetworkListing,
  type NetworkRequirement,
} from "./agent-network-matching";

const listing: NetworkListing = {
  id: 41,
  title: "Four bedroom home",
  propertyType: "house",
  listingType: "sale",
  suburb: "Borrowdale",
  price: 235_000,
  currency: "USD",
  bedrooms: 4,
  features: ["Borehole", "Solar"],
  description: "Double lock-up garage",
};

const requirement: NetworkRequirement = {
  id: 71,
  propertyType: "House",
  listingType: "sale",
  areas: ["Borrowdale", "Highlands"],
  budgetMin: 200_000,
  budgetMax: 250_000,
  bedroomsMin: 4,
  bedroomsMax: null,
  requiredFeatures: ["borehole"],
  preferredFeatures: ["solar"],
};

test("scores a listing against a buyer requirement and explains the fit", () => {
  const result = scoreNetworkMatch(requirement, listing);
  assert.ok(result);
  assert.equal(result.category, "strong");
  assert.ok(result.reasons.some((reason) => reason.includes("within budget")));
  assert.ok(result.reasons.some((reason) => reason.includes("Borrowdale")));
});

test("does not match a different property type or sale/rent requirement", () => {
  assert.equal(scoreNetworkMatch({ ...requirement, propertyType: "apartment" }, listing), null);
  assert.equal(scoreNetworkMatch({ ...requirement, listingType: "rent" }, listing), null);
});

test("required features are hard requirements; preferred features affect score only", () => {
  assert.equal(
    scoreNetworkMatch(requirement, { ...listing, features: ["Solar"], description: "" }),
    null,
  );
  const withoutPreferred = scoreNetworkMatch(
    { ...requirement, preferredFeatures: ["Swimming pool"] },
    listing,
  );
  assert.ok(withoutPreferred);
  assert.ok(withoutPreferred.matchPercent < 100);
  const requiredOnly = scoreNetworkMatch(
    { ...requirement, preferredFeatures: [] },
    listing,
  );
  assert.ok(requiredOnly);
  assert.equal(requiredOnly.matchPercent, 100);
});

test("matches a requested city when the buyer did not name the suburb", () => {
  const result = scoreNetworkMatch(
    { ...requirement, areas: ["Harare"], budgetMin: null, budgetMax: null },
    { ...listing, city: "Harare", bedrooms: null },
  );
  assert.ok(result);
  assert.ok(result.reasons.some((reason) => reason.includes("preferred area")));
});

test("maximum bedrooms is respected and a near-budget property remains a potential match", () => {
  assert.equal(scoreNetworkMatch({ ...requirement, bedroomsMax: 3 }, listing), null);
  const nearBudget = scoreNetworkMatch(
    { ...requirement, budgetMax: 220_000, requiredFeatures: [], preferredFeatures: [] },
    listing,
  );
  assert.ok(nearBudget);
  assert.ok(nearBudget.reasons.some((reason) => reason.includes("slightly above budget")));
});

test("matching works in both directions and returns deterministic order", () => {
  const second: NetworkRequirement = { ...requirement, id: 72, areas: ["Avondale"] };
  const requirements = matchNetworkRequirements(listing, [second, requirement]);
  const listings = matchNetworkListings(requirement, [
    { ...listing, id: 42, suburb: "Avondale" },
    listing,
  ]);
  assert.deepEqual(requirements.map((match) => match.requirementId), [71, 72]);
  assert.deepEqual(listings.map((match) => match.propertyId), [41, 42]);
});
