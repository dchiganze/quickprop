import type { Property } from '@/types';

/** Main photo is first, so the same selection survives API/offline round trips. */
export function selectMainListingPhoto(photos: string[], index: number): string[] {
  if (!Number.isInteger(index) || index < 0 || index >= photos.length) return [...photos];
  return [photos[index], ...photos.filter((_, photoIndex) => photoIndex !== index)];
}

export function getPrimaryListingPhoto(property: Pick<Property, 'id' | 'photos'>): string | undefined {
  return property.photos?.find(photo => typeof photo === 'string' && photo.trim().length > 0)?.trim();
}

export function getStoredMediaObjectPath(uri: string): string | undefined {
  return uri.trim().match(/(?:^|\/api\/storage)(\/objects\/uploads\/\d+\/[a-f0-9-]+\.[a-z0-9]{1,8})(?:[?#].*)?$/i)?.[1];
}