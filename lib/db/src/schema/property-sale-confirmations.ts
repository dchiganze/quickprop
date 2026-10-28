import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";
import { z } from "zod/v4";

export const propertySaleConfirmationsTable = pgTable("property_sale_confirmations", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  requestedBy: integer("requested_by").references(() => usersTable.id, { onDelete: "set null" }),
  tokenHash: text("token_hash").notNull(),
  conveyancerName: text("conveyancer_name").notNull(),
  conveyancerEmail: text("conveyancer_email"),
  conveyancerPhone: text("conveyancer_phone"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("property_sale_confirmations_property_unique").on(table.propertyId),
  uniqueIndex("property_sale_confirmations_token_unique").on(table.tokenHash),
]);

export const insertPropertySaleConfirmationSchema = createInsertSchema(propertySaleConfirmationsTable);
export type InsertPropertySaleConfirmation = z.infer<typeof insertPropertySaleConfirmationSchema>;
export type PropertySaleConfirmation = typeof propertySaleConfirmationsTable.$inferSelect;
