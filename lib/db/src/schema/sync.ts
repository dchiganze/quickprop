import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Durable, per-user mutation claims make offline retries idempotent even when
// the device loses a response after the server has already committed it.
export const syncMutationsTable = pgTable(
  "sync_mutations",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").notNull().references(() => usersTable.id),
    mutationKey: text("mutation_key").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: integer("resource_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("sync_mutations_actor_key_type_unique").on(table.actorId, table.mutationKey, table.resourceType)],
);