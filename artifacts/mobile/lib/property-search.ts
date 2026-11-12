export interface ParsedListingSearch {
  propertyType?: string;
  listingType?: 'sale' | 'rent';
  bedrooms?: number;
  minBedrooms?: number;
  bathrooms?: number;
  garages?: number;
  suburb?: string;
  amenities: string[];
  keywords: string[];
}

export interface SearchableMobileProperty {
  address: string;
  suburb: string;
  referenceNumber: string;
  type: string;
  propertyType?: string;
  listingType?: 'sale' | 'rent';
  status: string;
  currency: string;
  description: string;
  price: number;
  priceOnApplication?: boolean;
  bedrooms?: number;
  bathrooms?: number;
  garages?: number;
  features: string[];
  seller: { name: string; mandateType: string };
}

const PROPERTY_TYPE_WORDS: Record<string, string> = {
  house: 'house',
  houses: 'house',
  apartment: 'apartment',
  apartments: 'apartment',
  flat: 'apartment',
  flats: 'apartment',
  townhouse: 'townhouse',
  townhouses: 'townhouse',
  stand: 'stand',
  stands: 'stand',
  commercial: 'commercial',
  industrial: 'industrial',
  farm: 'farm',
  farms: 'farm',
  mine: 'mine',
  mines: 'mine',
};

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseListingSearch(query: string): ParsedListingSearch {
  const parsed: ParsedListingSearch = { amenities: [], keywords: [] };
  let cleaned = query.trim();

  const minimumBedroomMatch = cleaned.match(/\b(?:at least|minimum)\s+(\d+)\s*\+?\s*(?:beds?|bedrooms?)\b/i);
  const plusBedroomMatch = cleaned.match(/\b(\d+)\s*\+\s*(?:beds?|bedrooms?)\b/i);
  const exactBedroomMatch = cleaned.match(/\b(\d+)\s*-?\s*(?:beds?|bedrooms?)\b/i);
  const bedroomMatch = minimumBedroomMatch ?? plusBedroomMatch ?? exactBedroomMatch;
  if (bedroomMatch) {
    const count = Number(minimumBedroomMatch?.[1] ?? plusBedroomMatch?.[1] ?? exactBedroomMatch?.[1]);
    if (minimumBedroomMatch || plusBedroomMatch) parsed.minBedrooms = count;
    else parsed.bedrooms = count;
    cleaned = cleaned.replace(bedroomMatch[0], ' ');
  }

  const bathroomMatch = cleaned.match(/\b(\d+)\s*-?\s*(?:baths?|bathrooms?)\b/i);
  if (bathroomMatch) {
    parsed.bathrooms = Number(bathroomMatch[1]);
    cleaned = cleaned.replace(bathroomMatch[0], ' ');
  }

  const garageMatch = cleaned.match(/\b(\d+)\s*-?\s*(?:garages?|garage)\b/i);
  if (garageMatch) {
    parsed.garages = Number(garageMatch[1]);
    cleaned = cleaned.replace(garageMatch[0], ' ');
  }

  for (const [word, propertyType] of Object.entries(PROPERTY_TYPE_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(cleaned)) {
      parsed.propertyType = propertyType;
      cleaned = cleaned.replace(pattern, ' ');
    }
  }

  if (/\bfor\s+sale\b/i.test(cleaned)) {
    parsed.listingType = 'sale';
    cleaned = cleaned.replace(/\bfor\s+sale\b/i, ' ');
  } else if (/\b(?:for|to)\s+rent\b/i.test(cleaned)) {
    parsed.listingType = 'rent';
    cleaned = cleaned.replace(/\b(?:for|to)\s+rent\b/i, ' ');
  }

  const areaMatch = cleaned.match(
    /\b(?:in|near|around|at)\s+(?:the\s+)?([a-z][a-z\s'-]*?)(?=\s+\b(?:with|for|to)\b|[,;]|$)/i,
  );
  if (areaMatch) {
    parsed.suburb = areaMatch[1].trim().replace(/^the\s+/i, '');
    cleaned = cleaned.replace(areaMatch[0], ' ');
  }

  const amenityMatch = cleaned.match(
    /\bwith\s+(.+?)(?=\s+\b(?:for\s+(?:sale|rent)|to\s+rent)\b|[,;]|$)/i,
  );
  if (amenityMatch) {
    parsed.amenities = amenityMatch[1]
      .split(/\s*(?:,|\band\b|\bor\b)\s*/i)
      .map((item) => item.trim())
      .filter(Boolean);
    cleaned = cleaned.replace(amenityMatch[0], ' ');
  }

  parsed.keywords = cleaned
    .replace(/\b(?:in|near|around|at|with|and|or|the|a|an)\b/gi, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  return parsed;
}

export function propertyMatchesQuery(property: SearchableMobileProperty, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  if (/^\d+$/.test(trimmed)) {
    return (
      String(property.bedrooms ?? '') === trimmed ||
      String(property.bathrooms ?? '') === trimmed ||
      String(property.garages ?? '') === trimmed ||
      String(property.price).includes(trimmed) ||
      property.referenceNumber.toLowerCase().includes(trimmed)
    );
  }

  const parsed = parseListingSearch(trimmed);
  if (parsed.propertyType) {
    const propertyType = normalizeSearchText(property.propertyType ?? property.type);
    if (propertyType !== parsed.propertyType) return false;
  }
  if (parsed.listingType && (property.listingType ?? property.type) !== parsed.listingType) return false;
  if (parsed.bedrooms != null && (property.bedrooms ?? 0) !== parsed.bedrooms) return false;
  if (parsed.minBedrooms != null && (property.bedrooms ?? 0) < parsed.minBedrooms) return false;
  if (parsed.bathrooms != null && (property.bathrooms ?? 0) !== parsed.bathrooms) return false;
  if (parsed.garages != null && (property.garages ?? 0) !== parsed.garages) return false;
  if (parsed.suburb && !normalizeSearchText(property.suburb).includes(normalizeSearchText(parsed.suburb))) return false;

  const amenityText = normalizeSearchText(`${property.features.join(' ')} ${property.description}`);
  if (parsed.amenities.some((amenity) => {
    const words = normalizeSearchText(amenity).split(' ').filter(Boolean);
    return !words.every((word) => amenityText.includes(word));
  })) return false;

  const searchableText = normalizeSearchText([
    property.address,
    property.suburb,
    property.referenceNumber,
    property.type,
    property.propertyType ?? '',
    property.listingType ?? '',
    property.status,
    property.currency,
    property.description,
    property.priceOnApplication ? 'price on application' : '',
    String(property.price),
    property.seller.name,
    property.seller.mandateType,
    ...property.features,
    property.bedrooms == null ? '' : `${property.bedrooms} bedrooms`,
    property.bathrooms == null ? '' : `${property.bathrooms} bathrooms`,
    property.garages == null ? '' : `${property.garages} garages`,
  ].join(' '));
  return parsed.keywords.every((keyword) => searchableText.includes(normalizeSearchText(keyword)));
}
