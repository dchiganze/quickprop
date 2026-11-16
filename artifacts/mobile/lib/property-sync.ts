const SERVER_FIELDS_BY_MOBILE_FIELD: Record<string, string[]> = {
  title: ['title'],
  description: ['description'],
  type: ['propertyType', 'listingType'],
  propertyType: ['propertyType'],
  listingType: ['listingType'],
  status: ['status', 'pipelineStage'],
  pendingStatus: ['status', 'pipelineStage'],
  availabilityStatus: ['availabilityStatus'],
  price: ['price'],
  priceOnApplication: ['priceOnApplication', 'price'],
  negotiable: ['negotiable'],
  salePrice: ['salePrice'],
  currency: ['currency'],
  suburb: ['suburb'],
  city: ['city'],
  address: ['address'],
  showAddress: ['addressVisible'],
  hasTitleDeed: ['hasTitleDeed'],
  bedrooms: ['bedrooms'],
  bathrooms: ['bathrooms'],
  garages: ['parking'],
  landSize: ['landSize'],
  floorArea: ['buildingSize'],
  levies: ['levies'],
  rates: ['rates'],
  features: ['features'],
  photos: ['photos', 'coverImage'],
  proposedViewingTimes: ['proposedViewingTimes'],
  videoUrl: ['videoUrl'],
  coordinates: ['latitude', 'longitude'],
  collaborationEnabled: ['collaborationEnabled'],
  agentId: ['agentId'],
  branchId: ['branchId'],
  seller: ['sellerName', 'sellerPhone', 'sellerEmail', 'sellerNotes', 'mandateType', 'mandateExpiry'],
};

export function mergeMobilePropertyUpdates<T extends object>(
  latestOnlineProperty: T,
  mobileUpdates: Partial<T>,
): T {
  return { ...latestOnlineProperty, ...mobileUpdates };
}

export function legacyStatusPatch(localStatus: string, remoteStatus: string): string | null {
  return localStatus === remoteStatus ? null : localStatus;
}

export function buildServerPropertyUpdatePatch<T extends object>(
  completeServerProperty: T,
  mobileUpdates: object,
): Partial<T> {
  const serverProperty = completeServerProperty as Record<string, unknown>;
  const mobileUpdateFields = mobileUpdates as Record<string, unknown>;
  const serverFields = new Set<string>();
  const directValues = new Map<string, unknown>();

  for (const mobileField of Object.keys(mobileUpdates)) {
    for (const serverField of SERVER_FIELDS_BY_MOBILE_FIELD[mobileField] ?? []) {
      serverFields.add(serverField);
      if (mobileField === serverField) directValues.set(serverField, mobileUpdateFields[mobileField]);
    }
  }

  const patch: Record<string, unknown> = {};
  for (const serverField of serverFields) {
    if (Object.prototype.hasOwnProperty.call(serverProperty, serverField)) {
      patch[serverField] = serverProperty[serverField];
    } else if (directValues.has(serverField)) {
      patch[serverField] = directValues.get(serverField);
    }
  }

  return patch as Partial<T>;
}
