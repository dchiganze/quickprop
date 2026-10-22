import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { businessAgenciesTable } from "./business-agencies";

export const branchesTable = pgTable("branches", {
  id: serial("id").primaryKey(),
  agencyId: integer("agency_id").references(() => businessAgenciesTable.id),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  isMain: boolean("is_main").notNull().default(false),
  status: text("status").notNull().default("active"),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  role: text("role").notNull().default("agent"),
  branchId: integer("branch_id").references(() => branchesTable.id),
  status: text("status").notNull().default("active"),
  avatarUrl: text("avatar_url"),
  password: text("password").notNull().default("demo1234"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type Branch = typeof branchesTable.$inferSelect;
