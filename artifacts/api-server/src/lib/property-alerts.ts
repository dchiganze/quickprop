import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  notificationsTable,
  propertiesTable,
  propertyAlertNotificationsTable,
  propertyAlertsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { sendEmailMessage } from "./housekeeping-delivery";

const PUBLIC_PROPERTY_STATUSES = ["public", "under_offer", "coming_soon"];
const DIGEST_INTERVAL_MS = { daily: 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 };
const ALERT_FREQUENCIES = ["immediately", "daily", "weekly"] as const;
type AlertFrequency = typeof ALERT_FREQUENCIES[number];

export type PropertyAlertInput = {
  name?: string;
  transactionType: "sale" | "rent";
  propertyTypes: string[];
  cities?: string[];
  suburbs?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  minBedrooms?: number | null;
  minBathrooms?: number | null;
  requiredAmenities?: string[];
  preferredAmenities?: string[];
  furnishedPreference?: string;
  parkingPreference?: string;
  petsPreference?: string;
  powerPreference?: string;
  waterPreference?: string;
  notificationFrequency?: AlertFrequency;
  notificationChannels?: string[];
  sourcePropertyId?: number | null;
};

export type PropertyAlertUpdate = Partial<PropertyAlertInput>;

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function listIncludes(values: string[], value: string): boolean {
  const target = normalize(value);
  return values.some((item) => {
    const candidate = normalize(item);
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
}

function featureMatches(features: string[], desired: string): boolean {
  const target = normalize(desired);
  return features.some((feature) => {
    const value = normalize(feature);
    return value === target || value.includes(target) || target.includes(value);
  });
}

function propertyFeatures(property: typeof propertiesTable.$inferSelect): string[] {
  const features = [...(property.features ?? [])];
  if ((property.parking ?? 0) > 0) features.push("parking");
  return features.map(normalize);
}

function generatedAlertName(input: Pick<PropertyAlertInput, "transactionType" | "propertyTypes" | "cities" | "suburbs">): string {
  const type = input.propertyTypes.length === 1
    ? input.propertyTypes[0].replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Property";
  const location = input.suburbs?.[0] ?? input.cities?.[0] ?? "Anywhere";
  return `${type} ${location} ${input.transactionType === "rent" ? "Rental" : "Search"}`;
}

function validateCriteria(input: PropertyAlertInput): void {
  if (!input.propertyTypes.length) throw new Error("Choose at least one property type.");
  if (input.minPrice != null && input.maxPrice != null && input.minPrice > input.maxPrice) {
    throw new Error("Minimum price cannot be greater than maximum price.");
  }
  if (input.notificationFrequency && !ALERT_FREQUENCIES.includes(input.notificationFrequency)) {
    throw new Error("Invalid notification frequency.");
  }
}

export function normalizePropertyAlertInput(input: PropertyAlertInput) {
  validateCriteria(input);
  return {
    name: input.name?.trim() || generatedAlertName(input),
    transactionType: input.transactionType,
    propertyTypes: cleanList(input.propertyTypes),
    cities: cleanList(input.cities),
    suburbs: cleanList(input.suburbs),
    minPrice: input.minPrice ?? null,
    maxPrice: input.maxPrice ?? null,
    minBedrooms: input.minBedrooms ?? null,
    minBathrooms: input.minBathrooms ?? null,
    requiredAmenities: cleanList(input.requiredAmenities),
    preferredAmenities: cleanList(input.preferredAmenities),
    furnishedPreference: input.furnishedPreference ?? "any",
    parkingPreference: input.parkingPreference ?? "any",
    petsPreference: input.petsPreference ?? "any",
    powerPreference: input.powerPreference ?? "any",
    waterPreference: input.waterPreference ?? "any",
    notificationFrequency: input.notificationFrequency ?? "immediately",
    notificationChannels: cleanList(input.notificationChannels?.length ? input.notificationChannels : ["in_app"]),
    sourcePropertyId: input.sourcePropertyId ?? null,
  };
}

export async function serializePropertyAlert(alert: typeof propertyAlertsTable.$inferSelect) {
  const matches = await db
    .select()
    .from(propertyAlertNotificationsTable)
    .where(eq(propertyAlertNotificationsTable.alertId, alert.id));
  return {
    ...alert,
    matchedCount: matches.length,
    notificationsSent: matches.filter((match) => match.notifiedAt != null).length,
    propertiesViewed: matches.filter((match) => match.viewedAt != null).length,
  };
}

export async function listPropertyAlerts(userId: number) {
  const alerts = await db.select().from(propertyAlertsTable)
    .where(eq(propertyAlertsTable.userId, userId))
    .orderBy(desc(propertyAlertsTable.createdAt));
  return Promise.all(alerts.map(serializePropertyAlert));
}

export async function createPropertyAlert(userId: number, input: PropertyAlertInput) {
  const values = normalizePropertyAlertInput(input);
  const [alert] = await db.insert(propertyAlertsTable).values({ ...values, userId }).returning();
  return serializePropertyAlert(alert);
}

export async function updatePropertyAlert(userId: number, id: number, input: PropertyAlertUpdate) {
  const [existing] = await db.select().from(propertyAlertsTable).where(and(
    eq(propertyAlertsTable.id, id),
    eq(propertyAlertsTable.userId, userId),
  ));
  if (!existing) return null;

  const merged: PropertyAlertInput = {
    name: input.name ?? existing.name,
    transactionType: (input.transactionType ?? existing.transactionType) as "sale" | "rent",
    propertyTypes: input.propertyTypes ?? existing.propertyTypes,
    cities: input.cities ?? existing.cities,
    suburbs: input.suburbs ?? existing.suburbs,
    minPrice: input.minPrice === undefined ? existing.minPrice : input.minPrice,
    maxPrice: input.maxPrice === undefined ? existing.maxPrice : input.maxPrice,
    minBedrooms: input.minBedrooms === undefined ? existing.minBedrooms : input.minBedrooms,
    minBathrooms: input.minBathrooms === undefined ? existing.minBathrooms : input.minBathrooms,
    requiredAmenities: input.requiredAmenities ?? existing.requiredAmenities,
    preferredAmenities: input.preferredAmenities ?? existing.preferredAmenities,
    furnishedPreference: input.furnishedPreference ?? existing.furnishedPreference,
    parkingPreference: input.parkingPreference ?? existing.parkingPreference,
    petsPreference: input.petsPreference ?? existing.petsPreference,
    powerPreference: input.powerPreference ?? existing.powerPreference,
    waterPreference: input.waterPreference ?? existing.waterPreference,
    notificationFrequency: input.notificationFrequency ?? existing.notificationFrequency as AlertFrequency,
    notificationChannels: input.notificationChannels ?? existing.notificationChannels,
    sourcePropertyId: existing.sourcePropertyId,
  };
  const values = normalizePropertyAlertInput(merged);
  const [alert] = await db.update(propertyAlertsTable)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(propertyAlertsTable.id, id), eq(propertyAlertsTable.userId, userId)))
    .returning();
  return alert ? serializePropertyAlert(alert) : null;
}

export async function updatePropertyAlertStatus(userId: number, id: number, active: boolean) {
  const [alert] = await db.update(propertyAlertsTable)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(propertyAlertsTable.id, id), eq(propertyAlertsTable.userId, userId)))
    .returning();
  return alert ? serializePropertyAlert(alert) : null;
}

export async function deletePropertyAlert(userId: number, id: number): Promise<boolean> {
  const deleted = await db.delete(propertyAlertsTable)
    .where(and(eq(propertyAlertsTable.id, id), eq(propertyAlertsTable.userId, userId)))
    .returning({ id: propertyAlertsTable.id });
  return deleted.length > 0;
}

export function similarPropertyAlertInput(property: typeof propertiesTable.$inferSelect): PropertyAlertInput {
  const tolerance = property.price > 0 ? property.price * 0.1 : 0;
  return {
    transactionType: property.listingType === "rent" ? "rent" : "sale",
    propertyTypes: [property.propertyType],
    cities: [property.city],
    suburbs: [property.suburb],
    minPrice: tolerance ? Math.max(0, property.price - tolerance) : property.price,
    maxPrice: property.price + tolerance || null,
    minBedrooms: property.bedrooms ?? null,
    minBathrooms: property.bathrooms ?? null,
    preferredAmenities: (property.features ?? []).slice(0, 5),
    notificationFrequency: "immediately",
    notificationChannels: ["in_app", "email"],
    sourcePropertyId: property.id,
  };
}

function getMatchScore(alert: typeof propertyAlertsTable.$inferSelect, property: typeof propertiesTable.$inferSelect): number | null {
  if (!PUBLIC_PROPERTY_STATUSES.includes(property.status)) return null;
  if (alert.transactionType !== property.listingType) return null;
  if (alert.propertyTypes.length && !listIncludes(alert.propertyTypes, property.propertyType)) return null;
  if (alert.cities.length && !listIncludes(alert.cities, property.city)) return null;
  if (alert.suburbs.length && !listIncludes(alert.suburbs, property.suburb)) return null;
  if (alert.minPrice != null && property.price < alert.minPrice) return null;
  if (alert.maxPrice != null && property.price > alert.maxPrice) return null;
  if (alert.minBedrooms != null && (property.bedrooms == null || property.bedrooms < alert.minBedrooms)) return null;
  if (alert.minBathrooms != null && (property.bathrooms == null || property.bathrooms < alert.minBathrooms)) return null;

  const features = propertyFeatures(property);
  if (alert.requiredAmenities.some((amenity) => !featureMatches(features, amenity))) return null;
  if (alert.parkingPreference === "required" && !featureMatches(features, "parking")) return null;
  if (alert.petsPreference === "required" && !featureMatches(features, "pet friendly")) return null;

  const preferred: string[] = [...alert.preferredAmenities];
  if (alert.furnishedPreference !== "any") preferred.push(alert.furnishedPreference);
  if (alert.powerPreference !== "any") preferred.push(alert.powerPreference.replace("_", " "));
  if (alert.waterPreference !== "any") preferred.push(alert.waterPreference);
  if (alert.parkingPreference !== "any") preferred.push("parking");
  if (alert.petsPreference !== "any") preferred.push("pet friendly");
  const softMatches = preferred.filter((item, index) => preferred.indexOf(item) === index && featureMatches(features, item)).length;
  return preferred.length ? Math.round(70 + (softMatches / preferred.length) * 30) : 100;
}

function propertyUrl(property: typeof propertiesTable.$inferSelect): string {
  const base = process.env.PUBLIC_APP_URL?.trim() || "https://quickprop.co.zw";
  return `${base.replace(/\/$/, "")}/properties/${property.reference.toLowerCase()}`;
}

async function sendImmediateMatch(
  alert: typeof propertyAlertsTable.$inferSelect,
  user: typeof usersTable.$inferSelect,
  property: typeof propertiesTable.$inferSelect,
  notification: typeof propertyAlertNotificationsTable.$inferSelect,
) {
  const url = propertyUrl(property);
  const message = `${property.title} is a ${notification.matchPercentage}% match for “${alert.name}”. ${property.suburb}, ${property.city} · $${property.price.toLocaleString()}.`;
  const channels = alert.notificationChannels;
  if (channels.includes("in_app")) {
    await db.insert(notificationsTable).values({
      userId: user.id,
      type: "property_alert",
      title: "New property matching your search",
      message: `${message} View it at ${url}`,
    });
  }
  if (channels.includes("email")) {
    await sendEmailMessage({
      to: user.email,
      subject: `New property matching ${alert.name}`,
      text: `${message}\n\nView property: ${url}`,
      idempotencyKey: `property-alert-${notification.id}`,
    });
  }
  await db.update(propertyAlertNotificationsTable).set({
    notificationStatus: "sent",
    notifiedAt: new Date(),
  }).where(eq(propertyAlertNotificationsTable.id, notification.id));
}

export async function matchPropertyToAlerts(propertyId: number): Promise<void> {
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, propertyId));
  if (!property || !PUBLIC_PROPERTY_STATUSES.includes(property.status)) return;

  const alerts = await db.select().from(propertyAlertsTable)
    .where(and(eq(propertyAlertsTable.active, true), inArray(propertyAlertsTable.transactionType, ["sale", "rent"])));
  for (const alert of alerts) {
    const score = getMatchScore(alert, property);
    if (score == null) continue;
    const [notification] = await db.insert(propertyAlertNotificationsTable).values({
      alertId: alert.id,
      propertyId: property.id,
      userId: alert.userId,
      matchPercentage: score,
      notificationStatus: alert.notificationFrequency === "immediately" ? "sending" : "queued",
    }).onConflictDoNothing().returning();
    if (!notification) continue;
    if (alert.notificationFrequency === "immediately") {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, alert.userId));
      if (user) {
        try {
          await sendImmediateMatch(alert, user, property, notification);
        } catch (error) {
          await db.update(propertyAlertNotificationsTable).set({
            notificationStatus: "failed",
          }).where(eq(propertyAlertNotificationsTable.id, notification.id));
          logger.warn({ alertId: alert.id, propertyId, error }, "Property alert notification failed");
        }
      }
    }
  }
}

export async function runPropertyAlertDigests(): Promise<void> {
  const queued = await db.select({
    notification: propertyAlertNotificationsTable,
    alert: propertyAlertsTable,
    property: propertiesTable,
    user: usersTable,
  })
    .from(propertyAlertNotificationsTable)
    .innerJoin(propertyAlertsTable, eq(propertyAlertNotificationsTable.alertId, propertyAlertsTable.id))
    .innerJoin(propertiesTable, eq(propertyAlertNotificationsTable.propertyId, propertiesTable.id))
    .innerJoin(usersTable, eq(propertyAlertNotificationsTable.userId, usersTable.id))
    .where(and(
      eq(propertyAlertNotificationsTable.notificationStatus, "queued"),
      eq(propertyAlertsTable.active, true),
    ));

  const now = Date.now();
  const groups = new Map<string, typeof queued>();
  for (const row of queued) {
    const frequency = row.alert.notificationFrequency as "daily" | "weekly";
    const interval = DIGEST_INTERVAL_MS[frequency];
    if (!interval || now - row.notification.createdAt.getTime() < interval) continue;
    const key = `${row.alert.id}:${frequency}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  for (const rows of groups.values()) {
    const first = rows[0];
    const lines = rows.map(({ property, notification }) => `- ${property.title} (${property.suburb}) · $${property.price.toLocaleString()} · ${notification.matchPercentage}% match`);
    const message = `${rows.length} new propert${rows.length === 1 ? "y" : "ies"} match your alert “${first.alert.name}”.`;
    const url = propertyUrl(first.property);
    if (first.alert.notificationChannels.includes("in_app")) {
      await db.insert(notificationsTable).values({
        userId: first.user.id,
        type: "property_alert_digest",
        title: message,
        message: `${lines.join("\n")}\nView the latest match: ${url}`,
      });
    }
    if (first.alert.notificationChannels.includes("email")) {
      await sendEmailMessage({
        to: first.user.email,
        subject: message,
        text: `${message}\n\n${lines.join("\n")}\n\nView the latest match: ${url}`,
        idempotencyKey: `property-alert-digest-${first.alert.id}-${first.notification.createdAt.toISOString()}`,
      });
    }
    await db.update(propertyAlertNotificationsTable).set({
      notificationStatus: "sent",
      notifiedAt: new Date(),
    }).where(inArray(propertyAlertNotificationsTable.id, rows.map(({ notification }) => notification.id)));
  }
}

export function startPropertyAlertScheduler(): NodeJS.Timeout {
  return setInterval(() => {
    void runPropertyAlertDigests().catch((error) => logger.warn({ error }, "Property alert digest run failed"));
  }, 15 * 60 * 1000);
}