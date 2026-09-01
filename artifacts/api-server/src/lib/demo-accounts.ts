import { eq } from "drizzle-orm";
import { branchesTable, db, usersTable } from "@workspace/db";
import { hashPassword } from "./passwords";
import { logger } from "./logger";

const DEMO_PASSWORD = "demo1234";
const DEMO_BRANCH_NAME = "Borrowdale Branch";

const DEMO_ACCOUNTS = [
  { name: "Chipo Marufu", email: "chipo@quickprop.co.zw", phone: "+263 78 456 7890" },
  { name: "Kudzai Dube", email: "kudzai@quickprop.co.zw", phone: "+263 71 567 8901" },
  { name: "Tendai", email: "tendai@quickprop.co.zw", phone: null },
  { name: "Farai", email: "farai@quickprop.co.zw", phone: null },
] as const;
const DEMO_BUYER = {
  name: "Demo Buyer",
  email: "buyer.demo@quickprop.co.zw",
  phone: "+263 77 000 0000",
} as const;

/**
 * Keep the known demo agent accounts available in production.
 *
 * This is intentionally limited to the four explicit demo emails. Existing
 * records are updated so a previously deleted/inactive demo account can log
 * in again, while all other users remain untouched.
 */
export async function ensureDemoAccounts(): Promise<void> {
  const password = await hashPassword(DEMO_PASSWORD);

  if (process.env.NODE_ENV === "production") {
    const [existingBranch] = await db
      .select({ id: branchesTable.id })
      .from(branchesTable)
      .where(eq(branchesTable.name, DEMO_BRANCH_NAME))
      .limit(1);

    const branchId = existingBranch?.id ?? (await db
      .insert(branchesTable)
      .values({ name: DEMO_BRANCH_NAME, address: "Borrowdale, Harare" })
      .returning({ id: branchesTable.id }))[0].id;

    for (const account of DEMO_ACCOUNTS) {
      await db
        .insert(usersTable)
        .values({
          ...account,
          role: "agent",
          branchId,
          status: "active",
          password,
        })
        .onConflictDoUpdate({
          target: usersTable.email,
          set: {
            name: account.name,
            phone: account.phone,
            role: "agent",
            branchId,
            status: "active",
            password,
          },
        });
    }
  }

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
  if (process.env.NODE_ENV === "production") {
    logger.info({ accounts: DEMO_ACCOUNTS.map(({ email }) => email) }, "Production demo accounts ready");
  }
}