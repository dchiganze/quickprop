import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";

export const propertyAlertsTable = pgTable(
  "property_alerts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    transactionType: text("transaction_type").notNull(),
    propertyTypes: text("property_types").array().notNull().default([]),
    cities: text("cities").array().notNull().default([]),
    suburbs: text("suburbs").array().notNull().default([]),
    minPrice: doublePrecision("min_price"),
    maxPrice: doublePrecision("max_price"),
    minBedrooms: integer("min_bedrooms"),
    minBathrooms: integer("min_bathrooms"),
    requiredAmenities: text("required_amenities").array().notNull().default([]),
    preferredAmenities: text("preferred_amenities").array().notNull().default([]),
    furnishedPreference: text("furnished_preference").notNull().default("any"),
    parkingPreference: text("parking_preference").notNull().default("any"),
    petsPreference: text("pets_preference").notNull().default("any"),
    powerPreference: text("power_preference").notNull().default("any"),
    waterPreference: text("water_preference").notNull().default("any"),
    notificationFrequency: text("notification_frequency").notNull().default("immediately"),
    notificationChannels: text("notification_channels").array().notNull().default(["in_app"]),
    active: boolean("active").notNull().default(true),
    sourcePropertyId: integer("source_property_id").references(() => propertiesTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [],
);

export const propertyAlertNotificationsTable = pgTable(
  "property_alert_notifications",
  {
    id: serial("id").primaryKey(),
    alertId: integer("alert_id").notNull().references(() => propertyAlertsTable.id, { onDelete: "cascade" }),
    propertyId: integer("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    matchPercentage: integer("match_percentage").notNull(),
    notificationStatus: text("notification_status").notNull().default("sent"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("property_alert_notifications_alert_property_unique").on(table.alertId, table.propertyId),
  ],
);

export const insertPropertyAlertSchema = createInsertSchema(propertyAlertsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPropertyAlertNotificationSchema = createInsertSchema(propertyAlertNotificationsTable).omit({
  id: true,
  createdAt: true,
});

export type PropertyAlert = typeof propertyAlertsTable.$inferSelect;
export type InsertPropertyAlert = z.infer<typeof insertPropertyAlertSchema>;
export type PropertyAlertNotification = typeof propertyAlertNotificationsTable.$inferSelect;
export type InsertPropertyAlertNotification = z.infer<typeof insertPropertyAlertNotificationSchema>;