import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, usersTable } from "@workspace/db";

const BUYER_COOKIE = "qp_buyer";

export async function currentBuyer(req: Request) {
  const id = Number.parseInt(req.cookies?.[BUYER_COOKIE] ?? "", 10);
  if (!id) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return user?.role === "buyer" && user.status === "active" ? user : null;
}
