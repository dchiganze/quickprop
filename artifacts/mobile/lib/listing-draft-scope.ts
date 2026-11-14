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
    || visibilityFilter !== 'draft'
    || !/^\d+$/.test(userId ?? '')
  ) return undefined;

  return {
    status: 'draft',
    agencyInventory: 'agency',
    ...(agentId == null ? {} : { agentId }),
  };
}
