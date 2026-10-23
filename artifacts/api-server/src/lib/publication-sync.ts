import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  branchesTable,
  propertiesTable,
  sellersTable,
  usersTable,
} from "@workspace/db";

export const QUICKPROP_PUBLIC_ORIGIN = "https://www.quickprop.melios.co.zw";
const PUBLICATION_SYNC_PATH = "/api/internal/publications/properties";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableDate = z.coerce.date().nullable().optional();

const propertyPublicationSchema = z.object({
  isPublic: z.boolean(),
  property: z.object({
    reference: z.string().min(1),
    title: z.string().min(1),
    description: nullableString,
    propertyType: z.string(),
    listingType: z.string(),
    status: z.string(),
    pipelineStage: z.string(),
    price: z.number(),
    negotiable: z.boolean(),
    salePrice: nullableNumber,
    currency: z.string(),
    suburb: z.string(),
    city: z.string(),
    address: nullableString,
    addressVisible: z.boolean(),
    bedrooms: nullableNumber,
    bathrooms: nullableNumber,
    parking: nullableNumber,
    landSize: nullableNumber,
    buildingSize: nullableNumber,
    levies: nullableNumber,
    rates: nullableNumber,
    features: z.array(z.string()),
    photos: z.array(z.string()),
    proposedViewingTimes: z.array(z.string()),
    videoUrl: nullableString,
    coverImage: nullableString,
    mandateType: nullableString,
    mandateStart: nullableString,
    mandateExpiry: nullableString,
    commissionPercent: nullableNumber,
    hasBrochure: z.boolean(),
    collaborationEnabled: z.boolean(),
    availabilityStatus: z.string(),
    publishedAt: nullableDate,
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  seller: z.object({
    name: z.string(),
    idNumber: nullableString,
    phone: nullableString,
    email: nullableString,
    postalAddress: nullableString,
    notes: nullableString,
  }).nullable(),
  agent: z.object({
    name: z.string(),
    email: z.string(),
  }).nullable(),
  branch: z.object({
    name: z.string(),
  }).nullable(),
});

export type PropertyPublicationPayload = z.infer<typeof propertyPublicationSchema>;

function syncSecret(): string {
  const secret = process.env.PUBLICATION_SYNC_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Publication sync is not configured.");
  }
  return secret;
}

function signatureFor(timestamp: string, body: string): string {
  return createHmac("sha256", syncSecret())
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export function isPublicProperty(property: typeof propertiesTable.$inferSelect): boolean {
  return (
    ["public", "under_offer", "coming_soon"].includes(property.status)
    && ["available", "under_offer"].includes(property.availabilityStatus)
  );
}

export async function propertyPublicationPayload(
  property: typeof propertiesTable.$inferSelect,
): Promise<PropertyPublicationPayload> {
  const [seller] = property.sellerId
    ? await db.select().from(sellersTable).where(eq(sellersTable.id, property.sellerId))
    : [];
  const [agent] = property.agentId
    ? await db.select({
        name: usersTable.name,
        email: usersTable.email,
      }).from(usersTable).where(eq(usersTable.id, property.agentId))
    : [];
  const [branch] = property.branchId
    ? await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, property.branchId))
    : [];

  return {
    isPublic: isPublicProperty(property),
    property: {
      reference: property.reference,
      title: property.title,
      description: property.description,
      propertyType: property.propertyType,
      listingType: property.listingType,
      status: property.status,
      pipelineStage: property.pipelineStage,
      price: property.price,
      negotiable: property.negotiable,
      salePrice: property.salePrice,
      currency: property.currency,
      suburb: property.suburb,
      city: property.city,
      address: property.address,
      addressVisible: property.addressVisible,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parking: property.parking,
      landSize: property.landSize,
      buildingSize: property.buildingSize,
      levies: property.levies,
      rates: property.rates,
      features: property.features ?? [],
      photos: property.photos ?? [],
      proposedViewingTimes: property.proposedViewingTimes ?? [],
      videoUrl: property.videoUrl,
      coverImage: property.coverImage,
      mandateType: property.mandateType,
      mandateStart: property.mandateStart,
      mandateExpiry: property.mandateExpiry,
      commissionPercent: property.commissionPercent,
      hasBrochure: property.hasBrochure,
      collaborationEnabled: property.collaborationEnabled,
      availabilityStatus: property.availabilityStatus,
      publishedAt: property.publishedAt,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    },
    seller: seller ? {
      name: seller.name,
      idNumber: seller.idNumber,
      phone: seller.phone,
      email: seller.email,
      postalAddress: seller.postalAddress,
      notes: seller.notes,
    } : null,
    agent: agent ?? null,
    branch: branch ?? null,
  };
}

/**
 * Development and production use separate managed databases. When a listing
 * becomes public in development, send only the public listing snapshot to the
 * production API. The request is server-to-server and signed with a
 * server-only secret; no publication credential reaches the browser.
 */
export async function syncPropertyToProduction(
  property: typeof propertiesTable.$inferSelect,
): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const payload = await propertyPublicationPayload(property);
  await sendPropertyPublication(payload);
}

/** Send a validated snapshot through the existing authenticated publication API. */
export async function sendPropertyPublication(input: PropertyPublicationPayload): Promise<void> {
  const payload = propertyPublicationSchema.parse(input);
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const response = await fetch(`${QUICKPROP_PUBLIC_ORIGIN}${PUBLICATION_SYNC_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-QuickProp-Publication-Timestamp": timestamp,
      "X-QuickProp-Publication-Signature": signatureFor(timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error("The listing was saved, but it could not be published to the live QuickProp site yet.");
  }
}

export function verifyPublicationRequest(
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  body: string,
): boolean {
  if (!timestampHeader || !signatureHeader || !/^\d+$/.test(timestampHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) return false;

  const expected = signatureFor(timestampHeader, body);
  const received = Buffer.from(signatureHeader, "hex");
  const calculated = Buffer.from(expected, "hex");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export { propertyPublicationSchema };