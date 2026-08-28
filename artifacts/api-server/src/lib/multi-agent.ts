import { and, eq, inArray, or } from "drizzle-orm";
import {
  db,
  branchesTable,
  propertiesTable,
  propertyAgentRelationshipsTable,
  propertyDuplicateReviewsTable,
  propertyMarketingAssetsTable,
  usersTable,
} from "@workspace/db";

export type DuplicateInput = {
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  landSize?: number | null;
  buildingSize?: number | null;
  price?: number | null;
  description?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photos?: string[] | null;
};

export type DuplicateMatch = {
  property: typeof propertiesTable.$inferSelect;
  confidenceScore: number;
  matchingFields: string[];
  imageMatches: string[];
  agencyName: string | null;
};

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

function tokens(value: string | null | undefined): Set<string> {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 2));
}

function similarity(a: string | null | undefined, b: string | null | undefined): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / new Set([...left, ...right]).size;
}

function near(a: number | null | undefined, b: number | null | undefined, tolerance: number): boolean {
  return a != null && b != null && Math.abs(a - b) <= tolerance;
}

export function scoreDuplicate(input: DuplicateInput, candidate: DuplicateInput): Omit<DuplicateMatch, "property" | "agencyName"> {
  let score = 0;
  const matchingFields: string[] = [];
  const imageMatches: string[] = [];

  const normalizedAddress = normalizeText(input.address);
  const candidateAddress = normalizeText(candidate.address);
  if (normalizedAddress && candidateAddress && normalizedAddress === candidateAddress) {
    score += 30;
    matchingFields.push("address");
  } else if (normalizedAddress && candidateAddress && similarity(normalizedAddress, candidateAddress) >= 0.75) {
    score += 18;
    matchingFields.push("similar address");
  }
  if (normalizeText(input.suburb) && normalizeText(input.suburb) === normalizeText(candidate.suburb)) {
    score += 10;
    matchingFields.push("suburb");
  }
  if (normalizeText(input.city) && normalizeText(input.city) === normalizeText(candidate.city)) {
    score += 5;
    matchingFields.push("city");
  }
  if (near(input.latitude, candidate.latitude, 0.001) && near(input.longitude, candidate.longitude, 0.001)) {
    score += 10;
    matchingFields.push("GPS coordinates");
  }
  if (input.propertyType && candidate.propertyType && input.propertyType === candidate.propertyType) {
    score += 6;
    matchingFields.push("property type");
  }
  if (input.bedrooms != null && candidate.bedrooms != null && input.bedrooms === candidate.bedrooms) {
    score += 6;
    matchingFields.push("bedrooms");
  }
  if (input.bathrooms != null && candidate.bathrooms != null && input.bathrooms === candidate.bathrooms) {
    score += 6;
    matchingFields.push("bathrooms");
  }
  if (near(input.landSize, candidate.landSize, Math.max(10, (input.landSize ?? 0) * 0.05))) {
    score += 6;
    matchingFields.push("land size");
  }
  if (near(input.buildingSize, candidate.buildingSize, Math.max(10, (input.buildingSize ?? 0) * 0.05))) {
    score += 5;
    matchingFields.push("building size");
  }
  if (input.price != null && candidate.price != null && Math.abs(input.price - candidate.price) / Math.max(input.price, candidate.price, 1) <= 0.1) {
    score += 5;
    matchingFields.push("price range");
  }
  if (similarity(input.description, candidate.description) >= 0.45) {
    score += 6;
    matchingFields.push("description");
  }
  const phone = normalizePhone(input.phone);
  const candidatePhone = normalizePhone(candidate.phone);
  if (phone && candidatePhone && phone === candidatePhone) {
    score += 5;
    matchingFields.push("contact phone");
  }

  const photos = new Set((input.photos ?? []).map((photo) => normalizeText(photo.split("/").pop())));
  for (const photo of candidate.photos ?? []) {
    const key = normalizeText(photo.split("/").pop());
    if (key && photos.has(key)) imageMatches.push(photo);
  }
  if (imageMatches.length > 0) {
    score += Math.min(5, imageMatches.length * 2);
    matchingFields.push("matching photo");
  }

  return {
    confidenceScore: Math.min(100, score),
    matchingFields,
    imageMatches,
  };
}

function rowInput(row: typeof propertiesTable.$inferSelect): DuplicateInput {
  return {
    address: row.address,
    suburb: row.suburb,
    city: row.city,
    propertyType: row.propertyType,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    landSize: row.landSize,
    buildingSize: row.buildingSize,
    price: row.price,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    photos: row.photos,
  };
}

export async function findDuplicateCandidates(input: DuplicateInput, excludePropertyId?: number): Promise<DuplicateMatch[]> {
  const rows = await db.select().from(propertiesTable);
  const activeRows = rows.filter((row) =>
    row.id !== excludePropertyId &&
    !["archived", "withdrawn", "sold", "rented"].includes(row.status) &&
    row.duplicateStatus !== "keep_separate"
  );
  const scored = activeRows.map((property) => ({
    property,
    ...scoreDuplicate(input, rowInput(property)),
    agencyName: null as string | null,
  })).filter((match) => match.confidenceScore >= 50);

  const branchIds = [...new Set(scored.map((match) => match.property.branchId).filter((id): id is number => id != null))];
  if (branchIds.length > 0) {
    const branches = await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds));
    const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
    for (const match of scored) match.agencyName = match.property.branchId ? branchNames.get(match.property.branchId) ?? null : null;
  }
  return scored.sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 5);
}

export async function canonicalPropertyId(propertyId: number): Promise<number> {
  const [property] = await db.select({ id: propertiesTable.id, canonicalPropertyId: propertiesTable.canonicalPropertyId })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, propertyId));
  return property?.canonicalPropertyId ?? property?.id ?? propertyId;
}

export async function getCanonicalProperty(propertyId: number) {
  const canonicalId = await canonicalPropertyId(propertyId);
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, canonicalId));
  return property ?? null;
}

export async function getPropertyOffers(propertyId: number) {
  const canonicalId = await canonicalPropertyId(propertyId);
  const relatedRows = await db.select().from(propertiesTable).where(or(
    eq(propertiesTable.id, canonicalId),
    eq(propertiesTable.canonicalPropertyId, canonicalId),
  ));
  const relatedPropertyIds = [...new Set(relatedRows.map((row) => row.id))];
  const relationships = await db.select().from(propertyAgentRelationshipsTable)
    .where(and(
      inArray(propertyAgentRelationshipsTable.propertyId, relatedPropertyIds),
      eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
    ));
  const [users, branches, assets] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(branchesTable),
    db.select().from(propertyMarketingAssetsTable).where(inArray(propertyMarketingAssetsTable.propertyId, relatedPropertyIds)),
  ]);
  const offers = relationships.map((relationship) => {
    const agent = users.find((user) => user.id === relationship.agentId);
    const branch = branches.find((item) => item.id === relationship.branchId);
    return {
      id: relationship.id,
      agentId: relationship.agentId,
      agentName: agent?.name ?? relationship.contactName ?? "QuickProp Agent",
      agencyName: branch?.name ?? "Independent Agent",
      phone: relationship.contactPhone ?? agent?.phone ?? null,
      email: relationship.contactEmail ?? agent?.email ?? null,
      askingPrice: relationship.askingPrice,
      currency: relationship.currency,
      priceStatus: relationship.priceStatus,
      mandateType: relationship.mandateType,
      relationshipStatus: relationship.relationshipStatus,
      verificationStatus: relationship.verificationStatus,
      terms: relationship.terms,
      description: relationship.description,
      lastAvailabilityConfirmation: relationship.lastAvailabilityConfirmation,
      lastUpdate: relationship.lastUpdate,
      assets: assets.filter((asset) => asset.relationshipId === relationship.id || asset.relationshipId == null),
    };
  });
  if (offers.length > 0) return offers;

  const legacyOffers = relatedRows.filter((row) => row.agentId != null).map((row) => {
    const agent = users.find((user) => user.id === row.agentId);
    const branch = branches.find((item) => item.id === row.branchId);
    return {
      id: row.id,
      agentId: row.agentId!,
      agentName: agent?.name ?? "QuickProp Agent",
      agencyName: branch?.name ?? "Independent Agent",
      phone: agent?.phone ?? null,
      email: agent?.email ?? null,
      askingPrice: row.price,
      currency: row.currency,
      priceStatus: "current",
      mandateType: row.mandateType ?? "non_exclusive",
      relationshipStatus: "active",
      verificationStatus: row.lastAvailabilityConfirmedAt ? "verified" : "pending",
      terms: null,
      description: row.description,
      lastAvailabilityConfirmation: row.lastAvailabilityConfirmedAt,
      lastUpdate: row.updatedAt,
      assets: assets.filter((asset) => asset.relationshipId === row.id),
    };
  });
  return legacyOffers;
}

export async function getDuplicateReview(reviewId: number) {
  const [review] = await db.select().from(propertyDuplicateReviewsTable)
    .where(eq(propertyDuplicateReviewsTable.id, reviewId));
  return review ?? null;
}