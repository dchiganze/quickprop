export type AgencyListingAssignment = {
  branchId: number | null;
  agentId: number | null;
};

export function belongsToAgencyListing(
  property: AgencyListingAssignment,
  branchIds: ReadonlySet<number>,
  agentIds: ReadonlySet<number>,
): boolean {
  if (property.branchId != null) return branchIds.has(property.branchId);
  return property.agentId != null && agentIds.has(property.agentId);
}
