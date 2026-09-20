import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  branchesTable,
  db,
  propertiesTable,
  sellersTable,
  usersTable,
} from "@workspace/db";
import {
  propertyPublicationSchema,
  verifyPublicationRequest,
} from "../lib/publication-sync";

const router: IRouter = Router();

router.post("/internal/publications/properties", async (req, res): Promise<void> => {
  const rawBody = JSON.stringify(req.body);
  if (!verifyPublicationRequest(
    req.get("X-QuickProp-Publication-Timestamp"),
    req.get("X-QuickProp-Publication-Signature"),
    rawBody,
  )) {
    res.status(401).json({ error: "Invalid publication signature." });
    return;
  }

  const parsed = propertyPublicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const payload = parsed.data;
  const property = payload.property;
  const [agent] = payload.agent
    ? await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, payload.agent.email.toLowerCase()))
    : [];
  const [branch] = payload.branch
    ? await db.select({ id: branchesTable.id })
      .from(branchesTable)
      .where(eq(branchesTable.name, payload.branch.name))
    : [];

  const result = await db.transaction(async (tx) => {
    let sellerId: number | null = null;
    if (payload.seller) {
      const sellerEmail = payload.seller.email?.trim().toLowerCase();
      const [existingSeller] = sellerEmail
        ? await tx.select({ id: sellersTable.id })
          .from(sellersTable)
          .where(eq(sellersTable.email, sellerEmail))
        : await tx.select({ id: sellersTable.id })
          .from(sellersTable)
          .where(and(
            eq(sellersTable.name, payload.seller.name),
            payload.seller.phone ? eq(sellersTable.phone, payload.seller.phone) : isNull(sellersTable.phone),
          ));

      if (existingSeller) {
        sellerId = existingSeller.id;
        await tx.update(sellersTable).set({
          name: payload.seller.name,
          idNumber: payload.seller.idNumber ?? null,
          phone: payload.seller.phone ?? null,
          email: sellerEmail ?? null,
          postalAddress: payload.seller.postalAddress ?? null,
          notes: payload.seller.notes ?? null,
        }).where(eq(sellersTable.id, sellerId));
      } else {
        const [createdSeller] = await tx.insert(sellersTable).values({
          name: payload.seller.name,
          idNumber: payload.seller.idNumber ?? null,
          phone: payload.seller.phone ?? null,
          email: sellerEmail ?? null,
          postalAddress: payload.seller.postalAddress ?? null,
          notes: payload.seller.notes ?? null,
        }).returning({ id: sellersTable.id });
        sellerId = createdSeller.id;
      }
    }

    const publicStatus = payload.isPublic ? property.status : "internal_only";
    const publicPipelineStage = payload.isPublic ? property.pipelineStage : "draft";
    const publishedAt = payload.isPublic ? (property.publishedAt ?? new Date()) : null;
    const values = {
      reference: property.reference,
      title: property.title,
      description: property.description ?? null,
      propertyType: property.propertyType,
      listingType: property.listingType,
      status: publicStatus,
      pipelineStage: publicPipelineStage,
      price: property.price,
      negotiable: property.negotiable,
      salePrice: property.salePrice ?? null,
      currency: property.currency,
      suburb: property.suburb,
      city: property.city,
      address: property.address ?? null,
      addressVisible: property.addressVisible,
      bedrooms: property.bedrooms ?? null,
      bathrooms: property.bathrooms ?? null,
      parking: property.parking ?? null,
      landSize: property.landSize ?? null,
      buildingSize: property.buildingSize ?? null,
      levies: property.levies ?? null,
      rates: property.rates ?? null,
      features: property.features,
      photos: property.photos,
      proposedViewingTimes: property.proposedViewingTimes,
      videoUrl: property.videoUrl ?? null,
      coverImage: property.coverImage ?? null,
      agentId: agent?.id ?? null,
      branchId: branch?.id ?? null,
      sellerId,
      mandateType: property.mandateType ?? null,
      mandateStart: property.mandateStart ?? null,
      mandateExpiry: property.mandateExpiry ?? null,
      commissionPercent: property.commissionPercent ?? null,
      hasBrochure: property.hasBrochure,
      collaborationEnabled: property.collaborationEnabled,
      availabilityStatus: property.availabilityStatus,
      publishedAt,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    };

    const [row] = await tx.insert(propertiesTable)
      .values(values)
      .onConflictDoUpdate({
        target: propertiesTable.reference,
        set: {
          title: values.title,
          description: values.description,
          propertyType: values.propertyType,
          listingType: values.listingType,
          status: values.status,
          pipelineStage: values.pipelineStage,
          price: values.price,
          negotiable: values.negotiable,
          salePrice: values.salePrice,
          currency: values.currency,
          suburb: values.suburb,
          city: values.city,
          address: values.address,
          addressVisible: values.addressVisible,
          bedrooms: values.bedrooms,
          bathrooms: values.bathrooms,
          parking: values.parking,
          landSize: values.landSize,
          buildingSize: values.buildingSize,
          levies: values.levies,
          rates: values.rates,
          features: values.features,
          photos: values.photos,
          proposedViewingTimes: values.proposedViewingTimes,
          videoUrl: values.videoUrl,
          coverImage: values.coverImage,
          agentId: values.agentId,
          branchId: values.branchId,
          sellerId: values.sellerId,
          mandateType: values.mandateType,
          mandateStart: values.mandateStart,
          mandateExpiry: values.mandateExpiry,
          commissionPercent: values.commissionPercent,
          hasBrochure: values.hasBrochure,
          collaborationEnabled: values.collaborationEnabled,
          availabilityStatus: values.availabilityStatus,
          publishedAt: values.publishedAt,
          updatedAt: values.updatedAt,
        },
      })
      .returning({ id: propertiesTable.id, reference: propertiesTable.reference });

    return row;
  });

  res.json({ ok: true, ...result });
});

export default router;