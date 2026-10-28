import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  propertiesTable,
  propertySaleConfirmationsTable,
  usersTable,
} from "@workspace/db";
import {
  ConfirmPublicSaleBody,
  ConfirmPublicSaleResponse,
  GetPublicSaleConfirmationQueryParams,
  GetPublicSaleConfirmationResponse,
} from "@workspace/api-zod";
import { hashPropertySaleConfirmationToken } from "../lib/property-sale-confirmations";

const router: IRouter = Router();

router.get("/public/sale-confirmation", async (req, res): Promise<void> => {
  const parsed = GetPublicSaleConfirmationQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(404).json({ error: "Confirmation link not found." });
    return;
  }
  const [row] = await db.select({
    confirmation: propertySaleConfirmationsTable,
    property: propertiesTable,
    agentName: usersTable.name,
  })
    .from(propertySaleConfirmationsTable)
    .innerJoin(propertiesTable, eq(propertiesTable.id, propertySaleConfirmationsTable.propertyId))
    .leftJoin(usersTable, eq(usersTable.id, propertiesTable.agentId))
    .where(eq(
      propertySaleConfirmationsTable.tokenHash,
      hashPropertySaleConfirmationToken(parsed.data.token),
    ))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Confirmation link not found." });
    return;
  }
  if (row.confirmation.status !== "confirmed" && row.confirmation.expiresAt <= new Date()) {
    res.status(410).json({ error: "This confirmation link has expired." });
    return;
  }
  res.json(GetPublicSaleConfirmationResponse.parse({
    status: row.confirmation.status === "confirmed" ? "confirmed" : "pending",
    propertyReference: row.property.reference,
    propertyTitle: row.property.title,
    agentName: row.agentName ?? "QuickProp agent",
    currency: row.property.currency,
    salePrice: row.property.salePrice,
    expiresAt: row.confirmation.expiresAt.toISOString(),
    confirmedAt: row.confirmation.confirmedAt?.toISOString() ?? null,
  }));
});

router.post("/public/sale-confirmation/confirm", async (req, res): Promise<void> => {
  const parsed = ConfirmPublicSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid confirmation link." });
    return;
  }
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [confirmation] = await tx.select().from(propertySaleConfirmationsTable)
      .where(eq(
        propertySaleConfirmationsTable.tokenHash,
        hashPropertySaleConfirmationToken(parsed.data.token),
      ))
      .for("update")
      .limit(1);
    if (!confirmation) return "not_found" as const;
    if (confirmation.status === "confirmed" && confirmation.confirmedAt) {
      return { status: "already_confirmed" as const, confirmedAt: confirmation.confirmedAt };
    }
    if (confirmation.expiresAt <= now) return "expired" as const;
    const [updated] = await tx.update(propertySaleConfirmationsTable).set({
      status: "confirmed",
      confirmedAt: now,
      updatedAt: now,
    }).where(eq(propertySaleConfirmationsTable.id, confirmation.id)).returning();
    return { status: "confirmed" as const, confirmedAt: updated.confirmedAt ?? now };
  });
  if (result === "not_found") {
    res.status(404).json({ error: "Confirmation link not found." });
    return;
  }
  if (result === "expired") {
    res.status(410).json({ error: "This confirmation link has expired." });
    return;
  }
  res.json(ConfirmPublicSaleResponse.parse({
    status: result.status,
    confirmedAt: result.confirmedAt.toISOString(),
  }));
});

export default router;
