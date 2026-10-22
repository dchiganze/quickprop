import type { Property } from '@/types';

export function getPrimaryListingPhoto(property: Pick<Property, 'id' | 'photos'>): string | undefined {
  return property.photos?.find(photo => typeof photo === 'string' && photo.trim().length > 0)?.trim();
}

export function getStoredMediaObjectPath(uri: string): string | undefined {
  return uri.trim().match(/(?:^|\/api\/storage)(\/objects\/uploads\/\d+\/[a-f0-9-]+\.[a-z0-9]{1,8})(?:[?#].*)?$/i)?.[1];
}