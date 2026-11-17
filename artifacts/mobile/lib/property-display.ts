export interface PropertyStatValues {
  bedrooms?: number | null;
  bathrooms?: number | null;
  garages?: number | null;
  landSize?: number | null;
  floorArea?: number | null;
}

export function getPropertyDisplayTitle(title?: string | null): string {
  return title?.trim() || 'Untitled listing';
}

export function formatPropertyLocation(suburb?: string | null, city?: string | null): string {
  const parts = [suburb, city]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.filter((part, index) =>
    parts.findIndex((candidate) => candidate.toLocaleLowerCase() === part.toLocaleLowerCase()) === index,
  ).join(', ');
}

export function hasVisiblePropertyStats(property: PropertyStatValues): boolean {
  return property.bedrooms != null
    || property.bathrooms != null
    || property.garages != null
    || (property.landSize ?? 0) > 0
    || (property.floorArea ?? 0) > 0;
}
