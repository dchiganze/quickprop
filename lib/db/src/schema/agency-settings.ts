import {
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const agencySettingsTable = pgTable("agency_settings", {
  id: serial("id").primaryKey(),
  agencyName: text("agency_name").notNull().default("QuickProp Real Estate"),
  phone: text("phone").notNull().default("+263 242 123 456"),
  email: text("email").notNull().default("info@quickprop.co.zw"),
  website: text("website").notNull().default("https://quickprop.co.zw"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#10B981"),
  newLeadAlerts: boolean("new_lead_alerts").notNull().default(true),
  mandateExpiryAlerts: boolean("mandate_expiry_alerts").notNull().default(true),
  weeklyReport: boolean("weekly_report").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AgencySettings = typeof agencySettingsTable.$inferSelect;