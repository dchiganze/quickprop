import type { Property, PropertyAgentRelationship } from "@workspace/db";

export const HOUSEKEEPING_ACTIVE_STATUSES = [
  "public",
  "internal_only",
  "coming_soon",
  "private_listing",
  "under_offer",
  "draft",
] as const;

export const AVAILABILITY_STATES = [
  "available",
  "under_offer",
  "sold",
  "let",
  "withdrawn",
  "temporarily_unavailable",
] as const;

export type FreshnessStatus =
  | "new"
  | "fresh"
  | "due"
  | "update_required"
  | "potentially_stale"
  | "stale"
  | "inactive";

export type HousekeepingSettings = {
  softReminderDays: number;
  firstConfirmationDays: number;
  recurringConfirmationDays: number;
  updateRequiredOverdueDays: number;
  potentiallyStaleOverdueDays: number;
  staleOverdueDays: number;
};

export const DEFAULT_HOUSEKEEPING_SETTINGS: HousekeepingSettings = {
  softReminderDays: 7,
  firstConfirmationDays: 14,
  recurringConfirmationDays: 30,
  updateRequiredOverdueDays: 7,
  potentiallyStaleOverdueDays: 14,
  staleOverdueDays: 30,
};

const DAY = 24 * 60 * 60 * 1000;

export type FreshnessInput = {
  createdAt: Date;
  lastConfirmedAt?: Date | null;
  lastUpdatedAt?: Date | null;
  nextConfirmationAt?: Date | null;
  availabilityStatus?: string | null;
  photos?: string[] | null;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  suburb?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
};

export function calculateQualityScore(input: FreshnessInput): number {
  let score = 0;
  if ((input.photos?.length ?? 0) >= 5) score += 30;
  else if ((input.photos?.length ?? 0) >= 2) score += 20;
  else if ((input.photos?.length ?? 0) === 1) score += 10;
  if (input.title?.trim()) score += 10;
  if (input.description?.trim()) score += 15;
  if (input.price != null && input.price > 0) score += 15;
  if (input.suburb?.trim()) score += 10;
  if (input.propertyType?.trim()) score += 5;
  if (input.bedrooms != null) score += 7.5;
  if (input.bathrooms != null) score += 7.5;
  return Math.round(Math.min(100, score));
}

export function calculateFreshness(
  input: FreshnessInput,
  now = new Date(),
  settings: HousekeepingSettings = DEFAULT_HOUSEKEEPING_SETTINGS,
): {
  freshnessStatus: FreshnessStatus;
  daysSinceConfirmation: number;
  freshnessScore: number;
  nextConfirmationAt: Date;
  staleSince: Date | null;
  qualityScore: number;
  reminderKey: string | null;
} {
  const createdAt = input.createdAt;
  const lastUpdatedAt = input.lastUpdatedAt ?? createdAt;
  const lastConfirmedAt = input.lastConfirmedAt ?? null;
  const nextConfirmationAt = input.nextConfirmationAt
    ?? new Date((lastConfirmedAt ?? createdAt).getTime() + (lastConfirmedAt ? settings.recurringConfirmationDays : settings.firstConfirmationDays) * DAY);
  const anchor = lastConfirmedAt ?? createdAt;
  const daysSinceConfirmation = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / DAY));
  const overdueDays = Math.max(0, Math.floor((now.getTime() - nextConfirmationAt.getTime()) / DAY));
  const availability = input.availabilityStatus ?? "available";
  const qualityScore = calculateQualityScore(input);

  if (availability !== "available" && availability !== "under_offer") {
    return {
      freshnessStatus: "inactive",
      daysSinceConfirmation,
      freshnessScore: 0,
      nextConfirmationAt,
      staleSince: null,
      qualityScore,
      reminderKey: null,
    };
  }

  let freshnessStatus: FreshnessStatus;
  if (!lastConfirmedAt && now < nextConfirmationAt) freshnessStatus = "new";
  else if (now < nextConfirmationAt) freshnessStatus = "fresh";
  else if (overdueDays < settings.updateRequiredOverdueDays) freshnessStatus = "due";
  else if (overdueDays < settings.potentiallyStaleOverdueDays) freshnessStatus = "update_required";
  else if (overdueDays < settings.staleOverdueDays) freshnessStatus = "potentially_stale";
  else freshnessStatus = "stale";

  const freshnessScore = freshnessStatus === "new" || freshnessStatus === "fresh"
    ? Math.max(90, 100 - Math.max(0, Math.floor((nextConfirmationAt.getTime() - now.getTime()) / DAY) < settings.softReminderDays ? 10 : 0))
    : freshnessStatus === "due"
      ? 70
      : freshnessStatus === "update_required"
        ? 55
        : freshnessStatus === "potentially_stale"
          ? 35
          : 15;

  const staleSince = freshnessStatus === "potentially_stale" || freshnessStatus === "stale"
    ? new Date(nextConfirmationAt.getTime() + settings.potentiallyStaleOverdueDays * DAY)
    : null;
  let reminderKey: string | null = null;
  const daysUntilDue = Math.ceil((nextConfirmationAt.getTime() - now.getTime()) / DAY);
  if (daysUntilDue <= settings.softReminderDays && daysUntilDue > 0) reminderKey = "due-soon";
  else if (daysUntilDue <= 0 && overdueDays < settings.updateRequiredOverdueDays) reminderKey = "due";
  else if (overdueDays >= settings.updateRequiredOverdueDays && overdueDays < settings.potentiallyStaleOverdueDays) reminderKey = "overdue-7";
  else if (overdueDays >= settings.potentiallyStaleOverdueDays && overdueDays < settings.staleOverdueDays) reminderKey = "overdue-14";
  else if (overdueDays >= settings.staleOverdueDays) reminderKey = "overdue-30";

  return {
    freshnessStatus,
    daysSinceConfirmation,
    freshnessScore,
    nextConfirmationAt,
    staleSince,
    qualityScore,
    reminderKey,
  };
}

export function publicFreshnessLabel(
  freshnessStatus: string | null | undefined,
  lastConfirmedAt: Date | null | undefined,
  lastUpdatedAt: Date | null | undefined,
  now = new Date(),
): string {
  const date = lastConfirmedAt ?? lastUpdatedAt;
  if (!date) return "Recently listed";
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY));
  if (freshnessStatus === "stale" || freshnessStatus === "potentially_stale") return "Availability should be confirmed";
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days} days ago`;
  if (days < 30) return "Updated 2 weeks ago";
  return `Updated ${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"} ago`;
}

export function freshnessRankBonus(status: string | null | undefined): number {
  return status === "fresh" || status === "new" ? 10
    : status === "due" ? 3
      : status === "update_required" ? 0
        : status === "potentially_stale" ? -5
          : status === "stale" ? -15 : 0;
}

export function inputFromProperty(property: Property): FreshnessInput {
  return {
    createdAt: property.createdAt,
    lastConfirmedAt: property.lastAvailabilityConfirmedAt,
    lastUpdatedAt: property.updatedAt,
    nextConfirmationAt: property.nextConfirmationAt,
    availabilityStatus: property.availabilityStatus,
    photos: property.photos,
    title: property.title,
    description: property.description,
    price: property.price,
    suburb: property.suburb,
    propertyType: property.propertyType,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
  };
}

export function inputFromRelationship(
  property: Property,
  relationship: PropertyAgentRelationship,
): FreshnessInput {
  return {
    createdAt: relationship.createdAt,
    lastConfirmedAt: relationship.lastAvailabilityConfirmation,
    lastUpdatedAt: relationship.lastUpdate,
    nextConfirmationAt: relationship.nextConfirmationAt,
    availabilityStatus: relationship.availabilityStatus,
    photos: property.photos,
    title: property.title,
    description: relationship.description ?? property.description,
    price: relationship.askingPrice,
    suburb: property.suburb,
    propertyType: property.propertyType,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
  };
}