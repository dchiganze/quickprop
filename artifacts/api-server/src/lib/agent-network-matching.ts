export type NetworkListing = {
  id: number;
  title: string;
  propertyType: string;
  listingType: string;
  suburb: string;
  city?: string;
  price: number;
  currency: string;
  bedrooms: number | null;
  features: string[];
  description: string | null;
};

export type NetworkRequirement = {
  id: number;
  propertyType: string | null;
  listingType: string | null;
  areas: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  bedroomsMin: number | null;
  bedroomsMax: number | null;
  requiredFeatures: string[];
  preferredFeatures: string[];
  otherPreferences?: string[];
};

export type NetworkMatchWeights = {
  propertyType: number;
  location: number;
  budget: number;
  bedrooms: number;
  features: number;
  other: number;
};

export type NetworkMatch = {
  propertyId: number;
  requirementId: number;
  matchPercent: number;
  category: "strong" | "potential" | "weak";
  reasons: string[];
};

export const DEFAULT_NETWORK_MATCH_WEIGHTS: NetworkMatchWeights = {
  propertyType: 20,
  location: 25,
  budget: 25,
  bedrooms: 15,
  features: 10,
  other: 5,
};

const DEFAULT_THRESHOLDS = { strong: 80, potential: 60 };

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function featureText(listing: NetworkListing): string {
  return normalize(`${listing.features.join(" ")} ${listing.description ?? ""}`);
}

function containsFeature(source: string, feature: string): boolean {
  const normalized = normalize(feature);
  if (!normalized) return false;
  return ` ${source} `.includes(` ${normalized} `);
}

export function scoreNetworkMatch(
  requirement: NetworkRequirement,
  listing: NetworkListing,
  weights: NetworkMatchWeights = DEFAULT_NETWORK_MATCH_WEIGHTS,
): NetworkMatch | null {
  const wantedType = normalize(requirement.propertyType);
  const actualType = normalize(listing.propertyType);
  const wantedTransaction = normalize(requirement.listingType);
  const actualTransaction = normalize(listing.listingType);

  // Property type and sale/rent are essential: incomplete requirements are
  // held for clarification rather than matched on a guess.
  if (!wantedType || !actualType || wantedType !== actualType) return null;
  if (!wantedTransaction || !actualTransaction || wantedTransaction !== actualTransaction) return null;

  const reasons: string[] = [
    `Property type matches: ${listing.propertyType}`,
    `${listing.listingType === "rent" ? "Rental" : "Sale"} requirement matches`,
  ];
  let possible = weights.propertyType;
  let earned = weights.propertyType;

  const wantedAreas = requirement.areas.map(normalize).filter(Boolean);
  if (wantedAreas.length) {
    possible += weights.location;
    if (wantedAreas.includes(normalize(listing.suburb)) || wantedAreas.includes(normalize(listing.city))) {
      earned += weights.location;
      reasons.push(`Located in preferred area ${listing.suburb}${listing.city ? `, ${listing.city}` : ""}`);
    } else {
      reasons.push(`Location differs from preferred areas: ${requirement.areas.join(", ")}`);
    }
  }

  if (requirement.budgetMin != null || requirement.budgetMax != null) {
    possible += weights.budget;
    const min = requirement.budgetMin ?? 0;
    const max = requirement.budgetMax ?? Number.POSITIVE_INFINITY;
    if (listing.price >= min && listing.price <= max) {
      earned += weights.budget;
      reasons.push(`Price is within budget (${listing.currency} ${listing.price.toLocaleString()})`);
    } else if (listing.price > max && Number.isFinite(max) && listing.price <= max * 1.1) {
      earned += Math.floor(weights.budget / 2);
      reasons.push(`Price is slightly above budget (${listing.currency} ${listing.price.toLocaleString()})`);
    } else {
      reasons.push(`Price is outside the stated budget (${listing.currency} ${listing.price.toLocaleString()})`);
    }
  }

  if (requirement.bedroomsMin != null || requirement.bedroomsMax != null) {
    const bedrooms = listing.bedrooms ?? 0;
    if (requirement.bedroomsMax != null && bedrooms > requirement.bedroomsMax) return null;
    possible += weights.bedrooms;
    const meetsMin = requirement.bedroomsMin == null || bedrooms >= requirement.bedroomsMin;
    if (meetsMin) {
      earned += weights.bedrooms;
      reasons.push(`${bedrooms} bedrooms meet the requirement`);
    } else {
      reasons.push(`${bedrooms} bedrooms are below the requested minimum`);
    }
  }

  const searchable = featureText(listing);
  const requiredFeatures = requirement.requiredFeatures.map((value) => value.trim()).filter(Boolean);
  const preferredFeatures = requirement.preferredFeatures.map((value) => value.trim()).filter(Boolean);
  if (requiredFeatures.length) {
    const missing = requiredFeatures.filter((feature) => !containsFeature(searchable, feature));
    if (missing.length) return null;
    reasons.push(`All required features are present: ${requiredFeatures.join(", ")}`);
  }
  if (requiredFeatures.length || preferredFeatures.length) {
    possible += weights.features;
    const hits = preferredFeatures.filter((feature) => containsFeature(searchable, feature));
    if (requiredFeatures.length && preferredFeatures.length) {
      earned += Math.floor(weights.features / 2);
      earned += Math.round(
        (Math.ceil(weights.features / 2) * hits.length) / preferredFeatures.length,
      );
    } else if (requiredFeatures.length) {
      earned += weights.features;
    } else {
      earned += Math.round((weights.features * hits.length) / preferredFeatures.length);
    }
    if (hits.length) reasons.push(`Preferred features found: ${hits.join(", ")}`);
    if (preferredFeatures.length && hits.length < preferredFeatures.length) {
      const missing = preferredFeatures.filter((feature) => !hits.includes(feature));
      reasons.push(`Preferred features not listed: ${missing.join(", ")}`);
    }
  }

  const otherPreferences = (requirement.otherPreferences ?? []).map((value) => value.trim()).filter(Boolean);
  if (otherPreferences.length) {
    possible += weights.other;
    const hits = otherPreferences.filter((preference) => containsFeature(searchable, preference));
    earned += Math.round((weights.other * hits.length) / otherPreferences.length);
    reasons.push(
      hits.length
        ? `Other preferences found: ${hits.join(", ")}`
        : `Other preferences were not found: ${otherPreferences.join(", ")}`,
    );
  }

  const matchPercent = possible
    ? Math.max(0, Math.min(100, Math.round((earned / possible) * 100)))
    : 0;
  const category = matchPercent >= DEFAULT_THRESHOLDS.strong
    ? "strong"
    : matchPercent >= DEFAULT_THRESHOLDS.potential
      ? "potential"
      : "weak";

  return {
    propertyId: listing.id,
    requirementId: requirement.id,
    matchPercent,
    category,
    reasons,
  };
}

export function matchNetworkListings(
  requirement: NetworkRequirement,
  listings: NetworkListing[],
  weights: NetworkMatchWeights = DEFAULT_NETWORK_MATCH_WEIGHTS,
): NetworkMatch[] {
  return listings
    .map((listing) => scoreNetworkMatch(requirement, listing, weights))
    .filter((match): match is NetworkMatch => match !== null)
    .sort((a, b) => b.matchPercent - a.matchPercent || a.propertyId - b.propertyId);
}

export function matchNetworkRequirements(
  listing: NetworkListing,
  requirements: NetworkRequirement[],
  weights: NetworkMatchWeights = DEFAULT_NETWORK_MATCH_WEIGHTS,
): NetworkMatch[] {
  return requirements
    .map((requirement) => scoreNetworkMatch(requirement, listing, weights))
    .filter((match): match is NetworkMatch => match !== null)
    .sort((a, b) => b.matchPercent - a.matchPercent || a.requirementId - b.requirementId);
}
