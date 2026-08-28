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

export type PropertyAgentRelationship = typeof propertyAgentRelationshipsTable.$inferSelect;
export type PropertyMarketingAsset = typeof propertyMarketingAssetsTable.$inferSelect;
export type PropertyDuplicateReview = typeof propertyDuplicateReviewsTable.$inferSelect;
export type PropertyMergeHistory = typeof propertyMergeHistoryTable.$inferSelect;