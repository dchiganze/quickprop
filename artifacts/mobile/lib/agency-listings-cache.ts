import type { Property } from '@/types';

export const AGENCY_LISTINGS_CACHE_PREFIX = '@qp_agency_listings_';
export const AGENCY_LISTINGS_CACHE_VERSION = 1;

export interface CachedAgencyAgent {
  id: string;
  name: string;
  detail: string;
}

let cacheStorageQueue: Promise<void> = Promise.resolve();

export function enqueueAgencyListingsCacheTask(task: () => Promise<void>): Promise<void> {
  const next = cacheStorageQueue.catch(() => undefined).then(task);
  cacheStorageQueue = next.catch(() => undefined);
  return next;
}

export interface AgencyListingsCache {
  version: typeof AGENCY_LISTINGS_CACHE_VERSION;
  userId: string;
  agencyName: string | null;
  agents: CachedAgencyAgent[];
  live: Property[];
  drafts: Property[];
  agentsSyncedAt: string | null;
  liveSyncedAt: string | null;
  draftsSyncedAt: string | null;
}

export function agencyListingsCacheKey(userId: string): string {
  return `${AGENCY_LISTINGS_CACHE_PREFIX}${encodeURIComponent(userId)}`;
}

export function emptyAgencyListingsCache(userId: string): AgencyListingsCache {
  return {
    version: AGENCY_LISTINGS_CACHE_VERSION,
    userId,
    agencyName: null,
    agents: [],
    live: [],
    drafts: [],
    agentsSyncedAt: null,
    liveSyncedAt: null,
    draftsSyncedAt: null,
  };
}

function isCachedProperty(value: unknown): value is Property {
  if (!value || typeof value !== 'object') return false;
  const property = value as Partial<Property>;
  return typeof property.id === 'string'
    && typeof property.status === 'string'
    && Array.isArray(property.photos)
    && property.photos.every((photo) => typeof photo === 'string');
}

export function parseAgencyListingsCache(
  serialized: string | null,
  expectedUserId: string,
): AgencyListingsCache | null {
  if (!serialized || !expectedUserId) return null;
  try {
    const value = JSON.parse(serialized) as Partial<AgencyListingsCache>;
    if (
      value.version !== AGENCY_LISTINGS_CACHE_VERSION
      || value.userId !== expectedUserId
      || !Array.isArray(value.live)
      || !Array.isArray(value.drafts)
    ) return null;

    return {
      version: AGENCY_LISTINGS_CACHE_VERSION,
      userId: expectedUserId,
      agencyName: typeof value.agencyName === 'string' ? value.agencyName : null,
      agents: Array.isArray(value.agents)
        ? value.agents.filter((agent): agent is CachedAgencyAgent => Boolean(
          agent
          && typeof agent === 'object'
          && typeof (agent as CachedAgencyAgent).id === 'string'
          && typeof (agent as CachedAgencyAgent).name === 'string'
          && typeof (agent as CachedAgencyAgent).detail === 'string',
        ))
        : [],
      live: value.live.filter(isCachedProperty),
      drafts: value.drafts.filter(isCachedProperty),
      agentsSyncedAt: typeof value.agentsSyncedAt === 'string' ? value.agentsSyncedAt : null,
      liveSyncedAt: typeof value.liveSyncedAt === 'string' ? value.liveSyncedAt : null,
      draftsSyncedAt: typeof value.draftsSyncedAt === 'string' ? value.draftsSyncedAt : null,
    };
  } catch {
    return null;
  }
}

export function mergeAgencyListingsCache(
  current: AgencyListingsCache | null,
  userId: string,
  update: Partial<Omit<AgencyListingsCache, 'version' | 'userId'>>,
): AgencyListingsCache {
  const base = current?.userId === userId ? current : emptyAgencyListingsCache(userId);
  return { ...base, ...update, version: AGENCY_LISTINGS_CACHE_VERSION, userId };
}
