import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

import { propertiesTable } from "./properties";
import { usersTable } from "./users";

export const agenciesTable = pgTable(
  "rental_agencies",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    tradingName: text("trading_name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    address: text("address"),
    verificationStatus: text("verification_status").notNull().default("pending"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "rental_agencies_verification_status_check",
      sql`${table.verificationStatus} in ('pending', 'verified', 'rejected')`,
    ),
  ],
);

export const rentalHistoryTable = pgTable(
  "rental_history",
  {
    id: serial("id").primaryKey(),
    tenantUserId: integer("tenant_user_id").notNull().references(() => usersTable.id),
    propertyId: integer("property_id").references(() => propertiesTable.id),
    propertyAddress: text("property_address").notNull(),
    suburb: text("suburb").notNull(),
    city: text("city").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    tenancyType: text("tenancy_type").notNull(),
    refereeType: text("referee_type").notNull(),
    refereeName: text("referee_name"),
    refereeEmail: text("referee_email"),
    refereePhone: text("referee_phone"),
    agencyId: integer("agency_id").references(() => agenciesTable.id),
    verificationStatus: text("verification_status").notNull().default("self_reported"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "rental_history_verification_status_check",
      sql`${table.verificationStatus} in ('verified', 'pending', 'self_reported', 'not_verified')`,
    ),
    check(
      "rental_history_referee_type_check",
      sql`${table.refereeType} in ('private_landlord', 'agency')`,
    ),
    check(
      "rental_history_tenancy_type_check",
      sql`${table.tenancyType} in ('private_landlord', 'agency')`,
    ),
  ],
);

export const rentalReferencesTable = pgTable(
  "rental_references",
  {
    id: serial("id").primaryKey(),
    rentalHistoryId: integer("rental_history_id")
      .notNull()
      .references(() => rentalHistoryTable.id, { onDelete: "cascade" }),
    verifiedTenancy: boolean("verified_tenancy").notNull(),
    rentPaymentRating: text("rent_payment_rating"),
    propertyConditionRating: text("property_condition_rating"),
    wouldRentAgain: boolean("would_rent_again"),
    submittedBy: text("submitted_by"),
    submittedByUserId: integer("submitted_by_user_id").references(() => usersTable.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    disputeStatus: text("dispute_status").notNull().default("none"),
    disputeReason: text("dispute_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rental_references_history_unique").on(table.rentalHistoryId),
    check(
      "rental_references_dispute_status_check",
      sql`${table.disputeStatus} in ('none', 'open', 'under_review', 'resolved')`,
    ),
  ],
);

export const referenceRequestsTable = pgTable(
  "reference_requests",
  {
    id: serial("id").primaryKey(),
    rentalHistoryId: integer("rental_history_id")
      .notNull()
      .references(() => rentalHistoryTable.id, { onDelete: "cascade" }),
    recipientType: text("recipient_type").notNull(),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),
    agencyId: integer("agency_id").references(() => agenciesTable.id),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    reminderCount: integer("reminder_count").notNull().default(0),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reference_requests_history_unique").on(table.rentalHistoryId),
    uniqueIndex("reference_requests_token_hash_unique").on(table.tokenHash),
    check(
      "reference_requests_recipient_type_check",
      sql`${table.recipientType} in ('private_landlord', 'agency')`,
    ),
    check(
      "reference_requests_status_check",
      sql`${table.status} in ('pending', 'sent', 'completed', 'not_verified', 'expired')`,
    ),
  ],
);

export const rentalDisputesTable = pgTable(
  "rental_disputes",
  {
    id: serial("id").primaryKey(),
    rentalHistoryId: integer("rental_history_id")
      .notNull()
      .references(() => rentalHistoryTable.id, { onDelete: "cascade" }),
    tenantUserId: integer("tenant_user_id").notNull().references(() => usersTable.id),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    resolvedByUserId: integer("resolved_by_user_id").references(() => usersTable.id),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "rental_disputes_status_check",
      sql`${table.status} in ('open', 'under_review', 'resolved', 'dismissed')`,
    ),
  ],
);

export const insertAgencySchema = createInsertSchema(agenciesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRentalHistorySchema = createInsertSchema(rentalHistoryTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRentalReferenceSchema = createInsertSchema(rentalReferencesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertReferenceRequestSchema = createInsertSchema(referenceRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRentalDisputeSchema = createInsertSchema(rentalDisputesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Agency = typeof agenciesTable.$inferSelect;
export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type RentalHistory = typeof rentalHistoryTable.$inferSelect;
export type InsertRentalHistory = z.infer<typeof insertRentalHistorySchema>;
export type RentalReference = typeof rentalReferencesTable.$inferSelect;
export type InsertRentalReference = z.infer<typeof insertRentalReferenceSchema>;
export type ReferenceRequest = typeof referenceRequestsTable.$inferSelect;
export type InsertReferenceRequest = z.infer<typeof insertReferenceRequestSchema>;
export type RentalDispute = typeof rentalDisputesTable.$inferSelect;
export type InsertRentalDispute = z.infer<typeof insertRentalDisputeSchema>;