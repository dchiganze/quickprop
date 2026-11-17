import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { branchesTable, usersTable } from "./users";
import { propertiesTable } from "./properties";

export type AgentNetworkAttachment = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
};

export type AgentNetworkExtraction = {
  items: Array<{
    intent: "property" | "buyer_requirement" | "unknown";
    confidence: number;
    property?: Record<string, unknown>;
    buyerRequirement?: Record<string, unknown>;
    clarificationQuestion?: string | null;
    reviewStatus: "needs_review" | "confirmed" | "skipped";
  }>;
};

export const agentNetworkSubmissionsTable = pgTable("agent_network_submissions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => usersTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  sourceChannel: text("source_channel").notNull().default("simulator"),
  sourceText: text("source_text").notNull().default(""),
  attachments: jsonb("attachments").$type<AgentNetworkAttachment[]>().notNull().default([]),
  extraction: jsonb("extraction").$type<AgentNetworkExtraction>(),
  status: text("status").notNull().default("needs_review"),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  requirementId: integer("requirement_id"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("agent_network_submissions_agent_created_idx").on(table.agentId, table.createdAt.desc()),
]);

export const agentNetworkRequirementsTable = pgTable("agent_network_requirements", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => usersTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  sourceSubmissionId: integer("source_submission_id").references(() => agentNetworkSubmissionsTable.id),
  buyerName: text("buyer_name"),
  phone: text("phone"),
  email: text("email"),
  requestText: text("request_text").notNull(),
  propertyType: text("property_type"),
  listingType: text("listing_type"),
  budgetMin: doublePrecision("budget_min"),
  budgetMax: doublePrecision("budget_max"),
  currency: text("currency").notNull().default("USD"),
  areas: text("areas").array().notNull().default([]),
  bedroomsMin: integer("bedrooms_min"),
  bedroomsMax: integer("bedrooms_max"),
  requiredFeatures: text("required_features").array().notNull().default([]),
  preferredFeatures: text("preferred_features").array().notNull().default([]),
  otherPreferences: text("other_preferences").array().notNull().default([]),
  financing: text("financing"),
  urgency: text("urgency"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("agent_network_requirements_agent_idx").on(table.agentId),
]);

export const agentNetworkMatchesTable = pgTable(
  "agent_network_matches",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
    requirementId: integer("requirement_id").notNull().references(() => agentNetworkRequirementsTable.id),
    listingAgentId: integer("listing_agent_id").notNull().references(() => usersTable.id),
    buyerAgentId: integer("buyer_agent_id").notNull().references(() => usersTable.id),
    matchPercent: integer("match_percent").notNull(),
    category: text("category").notNull(),
    reasons: text("reasons").array().notNull().default([]),
    status: text("status").notNull().default("open"),
    listingAgentInterested: boolean("listing_agent_interested").notNull().default(false),
    buyerAgentInterested: boolean("buyer_agent_interested").notNull().default(false),
    listingAgentRespondedAt: timestamp("listing_agent_responded_at"),
    buyerAgentRespondedAt: timestamp("buyer_agent_responded_at"),
    introducedAt: timestamp("introduced_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_network_match_property_requirement_unique").on(
      table.propertyId,
      table.requirementId,
    ),
    index("agent_network_matches_listing_agent_idx").on(table.listingAgentId, table.updatedAt.desc()),
    index("agent_network_matches_buyer_agent_idx").on(table.buyerAgentId, table.updatedAt.desc()),
  ],
);

export type AgentNetworkSubmission = typeof agentNetworkSubmissionsTable.$inferSelect;
export type AgentNetworkRequirement = typeof agentNetworkRequirementsTable.$inferSelect;
export type AgentNetworkMatch = typeof agentNetworkMatchesTable.$inferSelect;
