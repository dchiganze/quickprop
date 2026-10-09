import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const businessAgenciesTable = pgTable("business_agencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  aboutText: text("about_text").notNull().default(""),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BusinessAgency = typeof businessAgenciesTable.$inferSelect;
