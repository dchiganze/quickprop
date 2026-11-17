export interface PropertyAIFlyerAccess {
  isPublic: boolean;
  isDraft: boolean;
  isAssignedAgent: boolean;
  canViewDraftWithinAgency: boolean;
}

export function canGeneratePropertyAIFlyerForListing(
  access: PropertyAIFlyerAccess,
): boolean {
  if (access.isPublic) return true;
  return access.isDraft && (access.isAssignedAgent || access.canViewDraftWithinAgency);
}
