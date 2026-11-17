export type ListingDraftScope = 'all' | 'my' | 'agency';

export interface AgencyDraftQueryParams {
  status: 'draft';
  agencyInventory: 'agency';
  agentId?: number;
}

export function buildAgencyDraftQueryParams(
  scope: ListingDraftScope,
  visibilityFilter: 'all' | 'draft' | 'live',
  userId: string | undefined,
  agentId?: number,
): AgencyDraftQueryParams | undefined {
  if (
    scope !== 'agency'
    || visibilityFilter === 'live'
    || !/^\d+$/.test(userId ?? '')
  ) return undefined;

  return {
    status: 'draft',
    agencyInventory: 'agency',
    ...(agentId == null ? {} : { agentId }),
  };
}

export function shouldOpenPrivateListingDetails(
  scope: ListingDraftScope,
  status: string,
): boolean {
  return scope === 'my' || status === 'draft';
}

export function mergeAgencyListings<T extends { id: string }>(
  liveListings: readonly T[],
  draftListings: readonly T[],
): T[] {
  const combined = new Map(liveListings.map((listing) => [listing.id, listing]));
  for (const listing of draftListings) combined.set(listing.id, listing);
  return [...combined.values()];
}
