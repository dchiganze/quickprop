import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { propertiesTable } from "./properties";

export const savedPropertiesTable = pgTable(
  "saved_properties",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    propertyId: integer("property_id")
      .notNull()
      .references(() => propertiesTable.id),
    savedAt: timestamp("saved_at").notNull().defaultNow(),
  },
  (t) => [unique("saved_properties_user_property_unique").on(t.userId, t.propertyId)],
);
