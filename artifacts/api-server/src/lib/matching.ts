import type { Property } from "@workspace/db";

export interface MatchCriteria {
  budgetMin?: number | null;
  budgetMax?: number | null;
  areas?: string[] | null;
  propertyType?: string | null;
  bedroomsMin?: number | null;
  bathroomsMin?: number | null;
  features?: string[] | null;
}

export interface Match {
  property: Property;
  matchPercent: number;
  reasons: string[];
}

const ACTIVE_STATUSES = new Set([
  "public",
  "internal_only",
  "coming_soon",
  "private_listing",
  "draft",
]);

export function matchProperties(
  criteria: MatchCriteria,
  properties: Property[],
): Match[] {
  const matches: Match[] = [];
  for (const p of properties) {
    if (!ACTIVE_STATUSES.has(p.status)) continue;
    let score = 0;
    let possible = 0;
    const reasons: string[] = [];

    if (criteria.budgetMax != null || criteria.budgetMin != null) {
      possible += 30;
      const min = criteria.budgetMin ?? 0;
      const max = criteria.budgetMax ?? Number.MAX_SAFE_INTEGER;
      if (p.price >= min && p.price <= max) {
        score += 30;
        reasons.push(`Within budget at $${p.price.toLocaleString()}`);
      } else if (p.price <= max * 1.1) {
        score += 15;
        reasons.push("Slightly above budget (within 10%)");
      }
    }
    if (criteria.areas && criteria.areas.length > 0) {
      possible += 25;
      const hit = criteria.areas.find(
        (a) => a.toLowerCase() === p.suburb.toLowerCase(),
      );
      if (hit) {
        score += 25;
        reasons.push(`Located in preferred area ${p.suburb}`);
      }
    }
    if (criteria.propertyType) {
      possible += 20;
      if (criteria.propertyType === p.propertyType) {
        score += 20;
        reasons.push(`Matches property type: ${p.propertyType}`);
      }
    }
    if (criteria.bedroomsMin != null) {
      possible += 15;
      if ((p.bedrooms ?? 0) >= criteria.bedroomsMin) {
        score += 15;
        reasons.push(`${p.bedrooms} bedrooms meets minimum`);
      }
    }
    if (criteria.features && criteria.features.length > 0) {
      possible += 10;
      const propFeatures = new Set(p.features.map((f) => f.toLowerCase()));
      const hits = criteria.features.filter((f) =>
        propFeatures.has(f.toLowerCase()),
      );
      if (hits.length > 0) {
        score += Math.round((10 * hits.length) / criteria.features.length);
        reasons.push(`Has ${hits.join(", ")}`);
      }
    }

    if (possible === 0) continue;
    const percent = Math.round((score / possible) * 100);
    if (percent >= 40) {
      matches.push({ property: p, matchPercent: percent, reasons });
    }
  }
  matches.sort((a, b) => b.matchPercent - a.matchPercent);
  return matches.slice(0, 20);
}

export interface ParsedQuery {
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  listingType?: "sale" | "rent";
  bedrooms?: number;
  minBedrooms?: number;
  bathrooms?: number;
  garages?: number;
  suburb?: string;
  amenities: string[];
  keywords: string[];
  interpretation: string;
}

export interface SearchableProperty {
  title: string;
  reference: string;
  suburb: string;
  address?: string | null;
  description?: string | null;
  price: number;
  propertyType: string;
  listingType: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking?: number | null;
  features?: string[] | null;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesPropertySearchQuery(
  property: SearchableProperty,
  query: ParsedQuery,
): boolean {
  if (query.minPrice != null && property.price < query.minPrice) return false;
  if (query.maxPrice != null && property.price > query.maxPrice) return false;
  if (query.propertyType && normalizeSearchText(property.propertyType) !== query.propertyType) return false;
  if (query.listingType && normalizeSearchText(property.listingType) !== query.listingType) return false;
  if (query.bedrooms != null && (property.bedrooms ?? 0) !== query.bedrooms) return false;
  if (query.minBedrooms != null && (property.bedrooms ?? 0) < query.minBedrooms) return false;
  if (query.bathrooms != null && (property.bathrooms ?? 0) !== query.bathrooms) return false;
  if (query.garages != null && (property.parking ?? 0) !== query.garages) return false;

  const suburb = normalizeSearchText(property.suburb);
  if (query.suburb && !suburb.includes(normalizeSearchText(query.suburb))) return false;

  const features = property.features ?? [];
  const amenityText = normalizeSearchText(`${features.join(" ")} ${property.description ?? ""}`);
  if (query.amenities.some((amenity) => {
    const words = normalizeSearchText(amenity).split(" ").filter(Boolean);
    return !words.every((word) => amenityText.includes(word));
  })) return false;

  const searchableText = normalizeSearchText([
    property.title,
    property.reference,
    property.suburb,
    property.address ?? "",
    property.description ?? "",
    property.propertyType,
    property.listingType,
    ...features,
    property.bedrooms == null ? "" : `${property.bedrooms} bedrooms`,
    property.bathrooms == null ? "" : `${property.bathrooms} bathrooms`,
    property.parking == null ? "" : `${property.parking} garages`,
    String(property.price),
  ].join(" "));
  return query.keywords.every((keyword) => searchableText.includes(normalizeSearchText(keyword)));
}

const TYPE_WORDS: Record<string, string> = {
  house: "house",
  houses: "house",
  apartment: "apartment",
  apartments: "apartment",
  flat: "apartment",
  flats: "apartment",
  townhouse: "townhouse",
  townhouses: "townhouse",
  stand: "stand",
  stands: "stand",
  commercial: "commercial",
  industrial: "industrial",
  farm: "farm",
  farms: "farm",
};

export function parseSearchQuery(q: string): ParsedQuery {
  const parts: string[] = [];
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  let propertyType: string | undefined;
  let listingType: "sale" | "rent" | undefined;
  let bedrooms: number | undefined;
  let minBedrooms: number | undefined;
  let bathrooms: number | undefined;
  let garages: number | undefined;
  let suburb: string | undefined;
  const amenities: string[] = [];

  const parseAmount = (s: string): number => {
    const n = parseFloat(s.replace(/[,$]/g, ""));
    if (/k$/i.test(s)) return n * 1000;
    if (/m$/i.test(s)) return n * 1000000;
    return n;
  };

  const underMatch = q.match(/(?:under|below|less than|max)\s+\$?([\d,.]+[km]?)/i);
  if (underMatch) {
    maxPrice = parseAmount(underMatch[1]);
    parts.push(`under $${maxPrice.toLocaleString()}`);
  }
  const overMatch = q.match(/(?:over|above|more than|min)\s+\$?([\d,.]+[km]?)/i);
  if (overMatch) {
    minPrice = parseAmount(overMatch[1]);
    parts.push(`over $${minPrice.toLocaleString()}`);
  }

  let cleaned = q
    .replace(/(?:under|below|less than|max|over|above|more than|min)\s+\$?[\d,.]+[km]?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const minimumBedroomMatch = cleaned.match(/\b(?:at least|minimum)\s+(\d+)\s*\+?\s*(?:beds?|bedrooms?)\b/i);
  const plusBedroomMatch = cleaned.match(/\b(\d+)\s*\+\s*(?:beds?|bedrooms?)\b/i);
  const exactBedroomMatch = cleaned.match(/\b(\d+)\s*-?\s*(?:beds?|bedrooms?)\b/i);
  const bedroomMatch = minimumBedroomMatch ?? plusBedroomMatch ?? exactBedroomMatch;
  if (bedroomMatch) {
    const count = Number(minimumBedroomMatch?.[1] ?? plusBedroomMatch?.[1] ?? exactBedroomMatch?.[1]);
    if (minimumBedroomMatch || plusBedroomMatch) {
      minBedrooms = count;
      parts.push(`at least ${count} bedrooms`);
    } else {
      bedrooms = count;
      parts.push(`${count} bedrooms`);
    }
    cleaned = cleaned.replace(bedroomMatch[0], " ");
  }

  const bathroomMatch = cleaned.match(/\b(\d+)\s*-?\s*(?:baths?|bathrooms?)\b/i);
  if (bathroomMatch) {
    bathrooms = Number(bathroomMatch[1]);
    parts.push(`${bathrooms} bathrooms`);
    cleaned = cleaned.replace(bathroomMatch[0], " ");
  }

  const garageMatch = cleaned.match(/\b(\d+)\s*-?\s*(?:garages?|garage)\b/i);
  if (garageMatch) {
    garages = Number(garageMatch[1]);
    parts.push(`${garages} garages`);
    cleaned = cleaned.replace(garageMatch[0], " ");
  }

  for (const word of Object.keys(TYPE_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(cleaned)) {
      propertyType = TYPE_WORDS[word];
      cleaned = cleaned.replace(pattern, " ");
    }
  }

  if (/\bfor\s+sale\b/i.test(cleaned)) {
    listingType = "sale";
    cleaned = cleaned.replace(/\bfor\s+sale\b/i, " ");
  } else if (/\b(?:for|to)\s+rent\b/i.test(cleaned)) {
    listingType = "rent";
    cleaned = cleaned.replace(/\b(?:for|to)\s+rent\b/i, " ");
  }

  const areaMatch = cleaned.match(
    /\b(?:in|near|around|at)\s+(?:the\s+)?([a-z][a-z\s'-]*?)(?=\s+\b(?:with|under|below|over|above|for|to)\b|[,;]|$)/i,
  );
  if (areaMatch) {
    suburb = areaMatch[1].trim().replace(/^the\s+/i, "");
    cleaned = cleaned.replace(areaMatch[0], " ");
    parts.push(`area: ${suburb}`);
  }

  const amenityMatch = cleaned.match(
    /\bwith\s+(.+?)(?=\s+\bfor\s+(?:sale|rent)\b|[,;]|$)/i,
  );
  if (amenityMatch) {
    amenities.push(
      ...amenityMatch[1]
        .split(/\s*(?:,|\band\b|\bor\b)\s*/i)
        .map((item) => item.trim())
        .filter(Boolean),
    );
    cleaned = cleaned.replace(amenityMatch[0], " ");
    parts.push(`features: ${amenities.join(", ")}`);
  }

  cleaned = cleaned.replace(/\b(?:in|near|around|at|with|and|or|the|a|an)\b/gi, " ");
  const keywords = cleaned.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  if (keywords.length > 0) parts.push(`keywords: ${keywords.join(" ")}`);
  if (propertyType) parts.push(`type: ${propertyType}`);
  if (listingType) parts.push(`listing: ${listingType}`);

  return {
    minPrice,
    maxPrice,
    propertyType,
    listingType,
    bedrooms,
    minBedrooms,
    bathrooms,
    garages,
    suburb,
    amenities,
    keywords,
    interpretation:
      parts.length > 0 ? `Searching ${parts.join(", ")}` : "Showing everything",
  };
}
