import { pgTable, serial, integer, text, doublePrecision, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const agentPastSalesTable = pgTable("agent_past_sales", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  suburb: text("suburb").notNull(),
  city: text("city").notNull(),
  currency: text("currency").notNull(),
  salePrice: doublePrecision("sale_price").notNull(),
  soldAt: date("sold_at", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("agent_past_sales_agent_idx").on(table.agentId)]);

export const insertAgentPastSaleSchema = createInsertSchema(agentPastSalesTable).omit({ id: true, createdAt: true });
export type AgentPastSale = typeof agentPastSalesTable.$inferSelect;
export type InsertAgentPastSale = typeof agentPastSalesTable.$inferInsert;
