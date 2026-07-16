import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const sellersTable = pgTable("sellers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  idNumber: text("id_number"),
  phone: text("phone"),
  email: text("email"),
  postalAddress: text("postal_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const buyersTable = pgTable("buyers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  budgetMin: doublePrecision("budget_min"),
  budgetMax: doublePrecision("budget_max"),
  preferredAreas: text("preferred_areas").array().notNull().default([]),
  propertyType: text("property_type"),
  bedroomsMin: integer("bedrooms_min"),
  bathroomsMin: integer("bathrooms_min"),
  features: text("features").array().notNull().default([]),
  financing: text("financing"),
  urgency: text("urgency"),
  agentId: integer("agent_id").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const buyerRequestsTable = pgTable("buyer_requests", {
  id: serial("id").primaryKey(),
  buyerName: text("buyer_name"),
  phone: text("phone"),
  email: text("email"),
  requestText: text("request_text").notNull(),
  budgetMin: doublePrecision("budget_min"),
  budgetMax: doublePrecision("budget_max"),
  areas: text("areas").array().notNull().default([]),
  propertyType: text("property_type"),
  status: text("status").notNull().default("new"),
  agentId: integer("agent_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Seller = typeof sellersTable.$inferSelect;
export type Buyer = typeof buyersTable.$inferSelect;
export type BuyerRequest = typeof buyerRequestsTable.$inferSelect;
