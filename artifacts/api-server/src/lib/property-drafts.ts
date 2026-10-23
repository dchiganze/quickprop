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

export function hasListingPhotos(photos: unknown): boolean {
  return Array.isArray(photos) && photos.some(photo => typeof photo === "string" && !!photo.trim());
}

export function needsPublicationPhoto(property: { status?: string; pipelineStage?: string; photos?: unknown }): boolean {
  const publishing = ["public", "under_offer", "coming_soon"].includes(property.status ?? "")
    || property.pipelineStage === "published";
  return publishing && !hasListingPhotos(property.photos);
}
