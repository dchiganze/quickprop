import type { Property } from '@/types';

export const OFFLINE_LISTINGS_CACHE_PREFIX = '@qp_downloaded_listings_';
export const OFFLINE_LISTINGS_CACHE_VERSION = 1;

export interface OfflineListingsCache {
  version: typeof OFFLINE_LISTINGS_CACHE_VERSION;
  userId: string;
  properties: Property[];
  updatedAt: string;
}

let cacheWriteQueue: Promise<void> = Promise.resolve();

export function offlineListingsCacheKey(userId: string): string {
  return `${OFFLINE_LISTINGS_CACHE_PREFIX}${encodeURIComponent(userId)}`;
}

export function enqueueOfflineListingsCacheTask(task: () => Promise<void>): Promise<void> {
  const next = cacheWriteQueue.catch(() => undefined).then(task);
  cacheWriteQueue = next.catch(() => undefined);
  return next;
}

export function emptyOfflineListingsCache(userId: string): OfflineListingsCache {
  return {
    version: OFFLINE_LISTINGS_CACHE_VERSION,
    userId,
    properties: [],
    updatedAt: '',
  };
}

function isCachedProperty(value: unknown): value is Property {
  if (!value || typeof value !== 'object') return false;
  const property = value as Partial<Property>;
  return typeof property.id === 'string'
    && typeof property.referenceNumber === 'string'
    && typeof property.status === 'string'
    && Array.isArray(property.photos)
    && property.photos.every((photo) => typeof photo === 'string');
}

export function parseOfflineListingsCache(
  serialized: string | null,
  expectedUserId: string,
): OfflineListingsCache | null {
  if (!serialized || !expectedUserId) return null;
  try {
    const value = JSON.parse(serialized) as Partial<OfflineListingsCache>;
    if (
      value.version !== OFFLINE_LISTINGS_CACHE_VERSION
      || value.userId !== expectedUserId
      || !Array.isArray(value.properties)
    ) return null;

    return {
      version: OFFLINE_LISTINGS_CACHE_VERSION,
      userId: expectedUserId,
      properties: value.properties.filter(isCachedProperty),
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    };
  } catch {
    return null;
  }
}

export function upsertOfflineListing(
  current: OfflineListingsCache | null,
  userId: string,
  property: Property,
  updatedAt: string,
): OfflineListingsCache {
  const base = current?.userId === userId ? current : emptyOfflineListingsCache(userId);
  return {
    ...base,
    properties: [
      property,
      ...base.properties.filter((item) => item.id !== property.id),
    ],
    updatedAt,
  };
}

export function removeOfflineListing(
  current: OfflineListingsCache | null,
  userId: string,
  propertyId: string,
  updatedAt: string,
): { cache: OfflineListingsCache; removed?: Property } {
  const base = current?.userId === userId ? current : emptyOfflineListingsCache(userId);
  const removed = base.properties.find((property) => property.id === propertyId);
  return {
    cache: {
      ...base,
      properties: base.properties.filter((property) => property.id !== propertyId),
      updatedAt,
    },
    removed,
  };
}
