export function importedPropertyDraft(photos: unknown) {
  return {
    status: "draft",
    pipelineStage: "draft",
    publishedAt: null,
    photos: Array.isArray(photos)
      ? photos.filter((photo): photo is string => typeof photo === "string" && !!photo.trim()).map(photo => photo.trim())
      : [],
  };
}

export function isDraftPropertyState(status?: string | null, pipelineStage?: string | null): boolean {
  return status === "draft" || pipelineStage === "draft";
}

export function hasPositiveDraftPrice(price: unknown): boolean {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

export function hasValidListingPrice(price: unknown, priceOnApplication: unknown): boolean {
  return priceOnApplication === true || hasPositiveDraftPrice(price);
}

export function hasListingPhotos(photos: unknown): boolean {
  return Array.isArray(photos) && photos.some(photo => typeof photo === "string" && !!photo.trim());
}

export function needsPublicationPhoto(property: { status?: string; pipelineStage?: string; photos?: unknown }): boolean {
  const publishing = ["public", "under_offer", "coming_soon"].includes(property.status ?? "")
    || property.pipelineStage === "published";
  return publishing && !hasListingPhotos(property.photos);
}

export function isPhotoRequirementIssue(issue: unknown): boolean {
  if (typeof issue !== "string") return false;
  const normalized = issue.toLowerCase();
  return /photo|image/.test(normalized)
    && /required|requirement|need|missing|must|before publish|before publishing/.test(normalized);
}
