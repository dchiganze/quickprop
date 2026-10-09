import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./passwords";
import { logger } from "./logger";

const DEMO_PASSWORD = "demo1234";
const DEMO_BUYER = {
  name: "Demo Buyer",
  email: "buyer.demo@quickprop.co.zw",
  phone: "+263 77 000 0000",
} as const;

/**
 * Development-only demo login. Production accounts must be created through
 * the real account and invitation flows, never re-seeded at server startup.
 */
export async function ensureDemoAccounts(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const password = await hashPassword(DEMO_PASSWORD);

  await db
    .insert(usersTable)
    .values({
      ...DEMO_BUYER,
      role: "buyer",
      branchId: null,
      status: "active",
      password,
    })
    .onConflictDoUpdate({
      target: usersTable.email,
      set: {
        name: DEMO_BUYER.name,
        phone: DEMO_BUYER.phone,
        role: "buyer",
        branchId: null,
        status: "active",
        password,
      },
    });

  logger.info({ buyer: DEMO_BUYER.email }, "Demo buyer account ready");
}