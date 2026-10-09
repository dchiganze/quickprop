import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./passwords";

export const ADMIN_RECOVERY_DEACTIVATE_EMAILS = [
  "nyasha@quickprop.co.zw",
  "rutendo@quickprop.co.zw",
] as const;

export async function getOrCreateAdminRecoveryUser(email: string): Promise<typeof usersTable.$inferSelect | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1)
      .for("update");
    if (existing) return existing;

    const randomPassword = `${randomBytes(32).toString("base64url")}A1!`;
    const [created] = await tx
      .insert(usersTable)
      .values({
        name: "Douglas Chiganze",
        email,
        role: "admin",
        status: "inactive",
        password: await hashPassword(randomPassword),
      })
      .onConflictDoNothing({ target: usersTable.email })
      .returning();
    if (created) return created;

    const [concurrentCreate] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1)
      .for("update");
    return concurrentCreate ?? null;
  });
}
