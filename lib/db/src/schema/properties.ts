import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  doublePrecision,
  boolean,
} from "drizzle-orm/pg-core";
import { usersTable, branchesTable } from "./users";
import { sellersTable } from "./people";

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  propertyType: text("property_type").notNull(),
  listingType: text("listing_type").notNull().default("sale"),
  status: text("status").notNull().default("draft"),
  pipelineStage: text("pipeline_stage").notNull().default("draft"),
  price: doublePrecision("price").notNull(),
  currency: text("currency").notNull().default("USD"),
  suburb: text("suburb").notNull(),
  city: text("city").notNull().default("Harare"),
  address: text("address"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  parking: integer("parking"),
  landSize: doublePrecision("land_size"),
  buildingSize: doublePrecision("building_size"),
  features: text("features").array().notNull().default([]),
  photos: text("photos").array().notNull().default([]),
  videoUrl: text("video_url"),
  coverImage: text("cover_image"),
  agentId: integer("agent_id").references(() => usersTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  sellerId: integer("seller_id").references(() => sellersTable.id),
  mandateType: text("mandate_type"),
  mandateStart: text("mandate_start"),
  mandateExpiry: text("mandate_expiry"),
  commissionPercent: doublePrecision("commission_percent"),
  privateNotes: text("private_notes"),
  views: integer("views").notNull().default(0),
  enquiries: integer("enquiries").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  hasBrochure: boolean("has_brochure").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const priceHistoryTable = pgTable("price_history", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => propertiesTable.id),
  price: doublePrecision("price").notNull(),
  previousPrice: doublePrecision("previous_price"),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  changedBy: text("changed_by"),
});

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  userName: text("user_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Property = typeof propertiesTable.$inferSelect;
