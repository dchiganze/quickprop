import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { propertiesTable } from "./properties";
import { leadsTable } from "./leads";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type"),
  assigneeId: integer("assignee_id").references(() => usersTable.id),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  leadId: integer("lead_id").references(() => leadsTable.id),
  dueDate: text("due_date"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  recurring: boolean("recurring").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const viewingsTable = pgTable("viewings", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => propertiesTable.id),
  buyerName: text("buyer_name"),
  leadId: integer("lead_id").references(() => leadsTable.id),
  agentId: integer("agent_id").references(() => usersTable.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("scheduled"),
  outcome: text("outcome"),
  notes: text("notes"),
});

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  url: text("url"),
  sizeKb: integer("size_kb"),
  version: integer("version").notNull().default(1),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
