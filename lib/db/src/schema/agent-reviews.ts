import {
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { propertiesTable } from "./properties";
import { propertyAgentRelationshipsTable } from "./multi-agent";
import { usersTable } from "./users";

export const agentReviewInvitationsTable = pgTable(
  "agent_review_invitations",
  {
    id: serial("id").primaryKey(),
    mandateKey: text("mandate_key").notNull(),
    agentId: integer("agent_id").notNull().references(() => usersTable.id),
    propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
    relationshipId: integer("relationship_id").references(() => propertyAgentRelationshipsTable.id),
    recipientEmail: text("recipient_email"),
    recipientName: text("recipient_name"),
    outcome: text("outcome").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    reminderNumber: integer("reminder_number").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
    sentAt: timestamp("sent_at"),
    submittedAt: timestamp("submitted_at"),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_review_invitations_mandate_unique").on(table.mandateKey),
    uniqueIndex("agent_review_invitations_token_hash_unique").on(table.tokenHash),
    check(
      "agent_review_invitations_outcome_check",
      sql`${table.outcome} in ('sold', 'rented', 'withdrawn', 'archived')`,
    ),
  ],
);

export const agentReviewsTable = pgTable(
  "agent_reviews",
  {
    id: serial("id").primaryKey(),
    invitationId: integer("invitation_id")
      .notNull()
      .references(() => agentReviewInvitationsTable.id),
    agentId: integer("agent_id").notNull().references(() => usersTable.id),
    propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
    relationshipId: integer("relationship_id").references(() => propertyAgentRelationshipsTable.id),
    rating: integer("rating").notNull(),
    reviewText: text("review_text").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("agent_reviews_invitation_unique").on(table.invitationId),
    check("agent_reviews_rating_check", sql`${table.rating} between 1 and 5`),
  ],
);

export type AgentReviewInvitation = typeof agentReviewInvitationsTable.$inferSelect;
export type AgentReview = typeof agentReviewsTable.$inferSelect;