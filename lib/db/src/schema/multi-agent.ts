import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { propertiesTable } from "./properties";
import { branchesTable, usersTable } from "./users";

export const propertyAgentRelationshipsTable = pgTable(
  "property_agent_relationships",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
    agentId: integer("agent_id").notNull().references(() => usersTable.id),
    branchId: integer("branch_id").references(() => branchesTable.id),
    mandateType: text("mandate_type").notNull().default("non_exclusive"),
    relationshipStatus: text("relationship_status").notNull().default("active"),
    dateAdded: timestamp("date_added").notNull().defaultNow(),
    verificationStatus: text("verification_status").notNull().default("pending"),
    askingPrice: doublePrecision("asking_price").notNull(),
    currency: text("currency").notNull().default("USD"),
    priceStatus: text("price_status").notNull().default("current"),
    terms: text("terms"),
    description: text("description"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    lastAvailabilityConfirmation: timestamp("last_availability_confirmation"),
    lastUpdate: timestamp("last_update").notNull().defaultNow(),
    freshnessStatus: text("freshness_status").notNull().default("new"),
    availabilityStatus: text("availability_status").notNull().default("available"),
    nextConfirmationAt: timestamp("next_confirmation_at"),
    daysSinceConfirmation: integer("days_since_confirmation").notNull().default(0),
    freshnessScore: integer("freshness_score").notNull().default(100),
    qualityScore: integer("quality_score").notNull().default(0),
    lastReminderSentAt: timestamp("last_reminder_sent_at"),
    reminderCount: integer("reminder_count").notNull().default(0),
    staleSince: timestamp("stale_since"),
    collaborationInformation: text("collaboration_information"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("property_agent_relationship_active_unique")
      .on(table.propertyId, table.agentId)
      .where(sql`${table.relationshipStatus} = 'active'`),
  ],
);

export const propertyMarketingAssetsTable = pgTable("property_marketing_assets", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
  relationshipId: integer("relationship_id").references(() => propertyAgentRelationshipsTable.id),
  assetType: text("asset_type").notNull().default("photo"),
  objectPath: text("object_path").notNull(),
  attributionName: text("attribution_name").notNull(),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id),
  approved: boolean("approved").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const propertyDuplicateReviewsTable = pgTable("property_duplicate_reviews", {
  id: serial("id").primaryKey(),
  sourcePropertyId: integer("source_property_id").notNull().references(() => propertiesTable.id),
  candidatePropertyId: integer("candidate_property_id").notNull().references(() => propertiesTable.id),
  confidenceScore: doublePrecision("confidence_score").notNull(),
  matchingFields: text("matching_fields").array().notNull().default([]),
  imageMatches: text("image_matches").array().notNull().default([]),
  status: text("status").notNull().default("pending"),
  canonicalPropertyId: integer("canonical_property_id").references(() => propertiesTable.id),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const propertyMergeHistoryTable = pgTable("property_merge_history", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").references(() => propertyDuplicateReviewsTable.id),
  sourcePropertyId: integer("source_property_id").notNull().references(() => propertiesTable.id),
  canonicalPropertyId: integer("canonical_property_id").notNull().references(() => propertiesTable.id),
  snapshot: jsonb("snapshot").notNull(),
  mergedBy: integer("merged_by").references(() => usersTable.id),
  mergedAt: timestamp("merged_at").notNull().defaultNow(),
  unmergedAt: timestamp("unmerged_at"),
  status: text("status").notNull().default("merged"),
});

export const listingHousekeepingEventsTable = pgTable("listing_housekeeping_events", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id"),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
  relationshipId: integer("relationship_id").references(() => propertyAgentRelationshipsTable.id),
  agentId: integer("agent_id").references(() => usersTable.id),
  agencyId: integer("agency_id").references(() => branchesTable.id),
  eventType: text("event_type").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  reminderKey: text("reminder_key"),
  source: text("source").notNull().default("system"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const listingHousekeepingSettingsTable = pgTable("listing_housekeeping_settings", {
  id: serial("id").primaryKey(),
  softReminderDays: integer("soft_reminder_days").notNull().default(7),
  firstConfirmationDays: integer("first_confirmation_days").notNull().default(14),
  recurringConfirmationDays: integer("recurring_confirmation_days").notNull().default(30),
  updateRequiredOverdueDays: integer("update_required_overdue_days").notNull().default(7),
  potentiallyStaleOverdueDays: integer("potentially_stale_overdue_days").notNull().default(14),
  staleOverdueDays: integer("stale_overdue_days").notNull().default(30),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const listingHousekeepingPreferencesTable = pgTable(
  "listing_housekeeping_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    reminderFrequency: text("reminder_frequency").notNull().default("smart"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("listing_housekeeping_preferences_user_unique").on(table.userId)],
);

/**
 * The merge history snapshot is intentionally wider than the property row.
 * Related records are moved during a merge and need their original ownership
 * captured so an unmerge can put them back without guessing from current data.
 */
export type PropertyMergeSnapshot = {
  property: Record<string, unknown>;
  leads: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  viewings: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  savedProperties: Array<Record<string, unknown>>;
  marketingAssets: Array<Record<string, unknown>>;
};

export type PropertyAgentRelationship = typeof propertyAgentRelationshipsTable.$inferSelect;
export type PropertyMarketingAsset = typeof propertyMarketingAssetsTable.$inferSelect;
export type PropertyDuplicateReview = typeof propertyDuplicateReviewsTable.$inferSelect;
export type PropertyMergeHistory = typeof propertyMergeHistoryTable.$inferSelect;