import { Property } from '@/types';

export function getPrimaryListingPhoto(property: Pick<Property, 'id' | 'photos'>): string | undefined {
  return property.photos?.[0];
}