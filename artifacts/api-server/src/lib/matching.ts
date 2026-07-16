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
  keywords: string[];
  interpretation: string;
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
  const keywords: string[] = [];

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

  for (const word of cleaned.split(" ")) {
    const w = word.toLowerCase();
    if (!w) continue;
    if (TYPE_WORDS[w]) {
      propertyType = TYPE_WORDS[w];
      parts.push(`type: ${propertyType}`);
    } else {
      keywords.push(word);
    }
  }
  if (keywords.length > 0) parts.push(`keywords: ${keywords.join(" ")}`);

  return {
    minPrice,
    maxPrice,
    propertyType,
    keywords,
    interpretation:
      parts.length > 0 ? `Searching ${parts.join(", ")}` : "Showing everything",
  };
}
