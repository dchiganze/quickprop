import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const phoneOtpSendAttemptsTable = pgTable(
  "phone_otp_send_attempts",
  {
    id: serial("id").primaryKey(),
    phoneHash: text("phone_hash").notNull(),
    attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
  },
  (table) => [
    index("phone_otp_send_attempts_phone_time_idx").on(table.phoneHash, table.attemptedAt),
    index("phone_otp_send_attempts_time_idx").on(table.attemptedAt),
  ],
);
