import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";

export const rentalApplicationInvitesTable = pgTable(
  "rental_application_invites",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => propertiesTable.id, { onDelete: "cascade" }),
    createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rental_application_invites_token_hash_unique").on(table.tokenHash),
    index("rental_application_invites_property_idx").on(table.propertyId),
    check(
      "rental_application_invites_status_check",
      sql`${table.status} in ('active', 'submitted', 'revoked', 'expired')`,
    ),
  ],
);

export const rentalApplicationsTable = pgTable(
  "rental_applications",
  {
    id: serial("id").primaryKey(),
    inviteId: integer("invite_id")
      .notNull()
      .references(() => rentalApplicationInvitesTable.id, { onDelete: "cascade" }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => propertiesTable.id, { onDelete: "cascade" }),
    tenantUserId: integer("tenant_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    propertyReference: text("property_reference").notNull(),
    propertyTitle: text("property_title").notNull(),
    propertyAddress: text("property_address").notNull(),
    suburb: text("suburb").notNull(),
    city: text("city").notNull(),
    applicantName: text("applicant_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    moveInDate: date("move_in_date", { mode: "string" }).notNull(),
    occupants: integer("occupants").notNull(),
    employmentStatus: text("employment_status").notNull(),
    employerName: text("employer_name"),
    jobTitle: text("job_title"),
    monthlyIncome: numeric("monthly_income", { precision: 14, scale: 2, mode: "number" }),
    incomeCurrency: text("income_currency"),
    applicantNote: text("applicant_note"),
    status: text("status").notNull().default("submitted"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rental_applications_invite_unique").on(table.inviteId),
    index("rental_applications_property_submitted_idx").on(table.propertyId, table.submittedAt),
    check(
      "rental_applications_employment_status_check",
      sql`${table.employmentStatus} in ('employed', 'self_employed', 'unemployed', 'student', 'retired', 'other')`,
    ),
    check(
      "rental_applications_status_check",
      sql`${table.status} in ('submitted')`,
    ),
  ],
);

export const insertRentalApplicationInviteSchema = createInsertSchema(
  rentalApplicationInvitesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRentalApplicationInvite = z.infer<typeof insertRentalApplicationInviteSchema>;
export type RentalApplicationInvite = typeof rentalApplicationInvitesTable.$inferSelect;

export const insertRentalApplicationSchema = createInsertSchema(
  rentalApplicationsTable,
).omit({ id: true, submittedAt: true });
export type InsertRentalApplication = z.infer<typeof insertRentalApplicationSchema>;
export type RentalApplication = typeof rentalApplicationsTable.$inferSelect;
