import type { Property, PropertyAlert } from '../types';

export function propertyMatchesAlert(property: Property, alert: PropertyAlert): boolean {
  if ((alert.type === 'sale' || alert.type === 'rent') &&
      (property.listingType ?? property.type) !== alert.type) return false;

  const propertyTypes = [
    ...(alert.propertyTypes ?? []),
    ...(alert.type && alert.type !== 'sale' && alert.type !== 'rent' &&
      !(alert.propertyTypes ?? []).includes(alert.type) ? [alert.type] : []),
  ];
  if (propertyTypes.length && !propertyTypes.some(type =>
    (property.propertyType ?? property.type).toLowerCase() === type.toLowerCase()
  )) return false;
  if (alert.city && !(property.city ?? '').toLowerCase().includes(alert.city.toLowerCase())) return false;
  if (alert.suburb && !property.suburb.toLowerCase().includes(alert.suburb.toLowerCase())) return false;
  if (alert.minBedrooms && (property.bedrooms ?? 0) < alert.minBedrooms) return false;
  if (alert.maxPrice && property.price > alert.maxPrice) return false;
  if (alert.currency && property.currency !== alert.currency) return false;
  if (alert.features.length > 0) {
    const hasAll = alert.features.every(feature =>
      property.features.some(propertyFeature => propertyFeature.toLowerCase().includes(feature.toLowerCase()))
    );
    if (!hasAll) return false;
  }
  return true;
}
