export type OfflinePropertyScope = "my" | "agency";

export interface OfflinePropertyAccessRecord {
  agentId: number | null;
  branchId: number | null;
  status: string;
  pipelineStage: string;
  availabilityStatus: string;
}

const AGENCY_LIVE_STATUSES = new Set(["public", "under_offer", "coming_soon"]);
const AGENCY_LIVE_AVAILABILITY = new Set(["available", "under_offer"]);

export function canSyncOfflineProperty(
  scope: OfflinePropertyScope,
  actorId: number,
  property: OfflinePropertyAccessRecord,
  activeAgencyBranchIds: number[] | undefined,
): boolean {
  if (scope === "my") return property.agentId === actorId;

  if (
    !activeAgencyBranchIds
    || property.branchId == null
    || !activeAgencyBranchIds.includes(property.branchId)
  ) return false;

  const isDraft = property.status === "draft" || property.pipelineStage === "draft";
  const isLive = AGENCY_LIVE_STATUSES.has(property.status)
    && AGENCY_LIVE_AVAILABILITY.has(property.availabilityStatus);
  return isDraft || isLive;
}
