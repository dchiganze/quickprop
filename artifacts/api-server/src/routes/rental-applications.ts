import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  propertiesTable,
  rentalApplicationInvitesTable,
  rentalApplicationsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateRentalApplicationInviteParams,
  CreateRentalApplicationInviteResponse,
  GetPublicRentalApplicationParams,
  GetPublicRentalApplicationResponse,
  ListRentalApplicationsQueryParams,
  ListRentalApplicationsResponse,
  SubmitPublicRentalApplicationBody,
  SubmitPublicRentalApplicationParams,
  SubmitPublicRentalApplicationResponse,
} from "@workspace/api-zod";
import { currentBuyer } from "../lib/public-auth";
import { publicRentalApplicationUrl } from "../lib/rental-references";
import { createRentalReferenceToken, hashRentalReferenceToken } from "../lib/rental-reference-tokens";
import { getAccessibleProperty, propertyScope } from "./people";
import { currentUser } from "./auth";

const router: IRouter = Router();
const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AGENT_ROLES = new Set(["agent", "senior_agent", "principal", "admin", "quickprop_admin"]);

function parseToken(raw: string | string[] | undefined): string | null {
  const token = Array.isArray(raw) ? raw[0] : raw;
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number.parseInt(value ?? "", 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.post("/properties/:id/rental-application-invite", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user || !AGENT_ROLES.has(user.role)) {
    res.status(401).json({ error: "Not logged in as an agent" });
    return;
  }
  const params = CreateRentalApplicationInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const property = await getAccessibleProperty(user, params.data.id);
  if (!property) {
    res.status(404).json({ error: "Rental listing not found" });
    return;
  }
  if (property.listingType !== "rent" || property.status !== "public") {
    res.status(409).json({ error: "Applications can only be shared for published rental listings" });
    return;
  }

  const token = createRentalReferenceToken();
  const now = new Date();
  const [invite] = await db.insert(rentalApplicationInvitesTable).values({
    propertyId: property.id,
    createdBy: user.id,
    tokenHash: hashRentalReferenceToken(token),
    status: "active",
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
  }).returning();
  if (!invite) {
    res.status(500).json({ error: "Unable to create an application link" });
    return;
  }
  res.status(201).json(CreateRentalApplicationInviteResponse.parse({
    applicationUrl: publicRentalApplicationUrl(token),
    expiresAt: invite.expiresAt.toISOString(),
  }));
});

router.get("/rental-applications", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user || !AGENT_ROLES.has(user.role)) {
    res.status(401).json({ error: "Not logged in as an agent" });
    return;
  }
  const query = ListRentalApplicationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [await propertyScope(user)];
  if (query.data.propertyId != null) {
    const property = await getAccessibleProperty(user, query.data.propertyId);
    if (!property) {
      res.status(404).json({ error: "Rental listing not found" });
      return;
    }
    conditions.push(eq(propertiesTable.id, query.data.propertyId));
  }

  const rows = await db.select({ application: rentalApplicationsTable })
    .from(rentalApplicationsTable)
    .innerJoin(propertiesTable, eq(propertiesTable.id, rentalApplicationsTable.propertyId))
    .where(and(...conditions))
    .orderBy(desc(rentalApplicationsTable.submittedAt))
    .limit(200);
  res.json(ListRentalApplicationsResponse.parse(rows.map(({ application }) => ({
    id: application.id,
    propertyId: application.propertyId,
    propertyReference: application.propertyReference,
    propertyTitle: application.propertyTitle,
    applicantName: application.applicantName,
    email: application.email,
    phone: application.phone,
    moveInDate: application.moveInDate,
    occupants: application.occupants,
    employmentStatus: application.employmentStatus,
    employerName: application.employerName,
    jobTitle: application.jobTitle,
    monthlyIncome: application.monthlyIncome,
    incomeCurrency: application.incomeCurrency,
    applicantNote: application.applicantNote,
    status: application.status,
    submittedAt: application.submittedAt.toISOString(),
  }))));
});

router.get("/public/rental-applications/:token", async (req, res): Promise<void> => {
  const params = GetPublicRentalApplicationParams.safeParse(req.params);
  const token = params.success ? parseToken(params.data.token) : null;
  if (!token) {
    res.status(404).json({ error: "Application link not found" });
    return;
  }
  const [invite] = await db.select().from(rentalApplicationInvitesTable)
    .where(eq(rentalApplicationInvitesTable.tokenHash, hashRentalReferenceToken(token)))
    .limit(1);
  if (!invite) {
    res.status(404).json({ error: "Application link not found" });
    return;
  }
  if (invite.status !== "active" || invite.expiresAt <= new Date()) {
    res.status(410).json({ error: "This application link is no longer available" });
    return;
  }
  const [[property], [agent]] = await Promise.all([
    db.select().from(propertiesTable).where(eq(propertiesTable.id, invite.propertyId)).limit(1),
    db.select({ name: usersTable.name }).from(usersTable)
      .innerJoin(propertiesTable, eq(propertiesTable.agentId, usersTable.id))
      .where(eq(propertiesTable.id, invite.propertyId)).limit(1),
  ]);
  if (!property || property.listingType !== "rent" || property.status !== "public") {
    res.status(410).json({ error: "This rental listing is no longer available" });
    return;
  }
  res.json(GetPublicRentalApplicationResponse.parse({
    status: "available",
    propertyTitle: property.title,
    propertyReference: property.reference,
    propertyAddress: property.address,
    suburb: property.suburb,
    city: property.city,
    price: property.price,
    currency: property.currency,
    imageUrl: property.photos[0] ?? null,
    agentName: agent?.name ?? "QuickProp agent",
    expiresAt: invite.expiresAt.toISOString(),
  }));
});

router.post("/public/rental-applications/:token", async (req, res): Promise<void> => {
  const params = SubmitPublicRentalApplicationParams.safeParse(req.params);
  const body = SubmitPublicRentalApplicationBody.safeParse(req.body);
  const token = params.success ? parseToken(params.data.token) : null;
  if (!token || !body.success) {
    const error = !params.success ? params.error.message
      : !body.success ? body.error.message
        : "Application link not found";
    res.status(400).json({ error });
    return;
  }
  const application = body.data;
  const employerName = application.employerName?.trim() ?? "";
  if ((application.employmentStatus === "employed" || application.employmentStatus === "self_employed")
    && (application.monthlyIncome == null || !employerName || !application.incomeCurrency)) {
    res.status(400).json({ error: "Provide your employer and monthly income" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email.trim())) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }

  const tenant = await currentBuyer(req);
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [invite] = await tx.select().from(rentalApplicationInvitesTable)
      .where(eq(rentalApplicationInvitesTable.tokenHash, hashRentalReferenceToken(token)))
      .for("update")
      .limit(1);
    if (!invite) return "not_found" as const;
    if (invite.status !== "active" || invite.expiresAt <= now) return "unavailable" as const;
    const [property] = await tx.select().from(propertiesTable)
      .where(eq(propertiesTable.id, invite.propertyId)).limit(1);
    if (!property || property.listingType !== "rent" || property.status !== "public") return "unavailable" as const;

    const [created] = await tx.insert(rentalApplicationsTable).values({
      inviteId: invite.id,
      propertyId: property.id,
      tenantUserId: tenant?.id ?? null,
      propertyReference: property.reference,
      propertyTitle: property.title,
      propertyAddress: property.address ?? `${property.suburb}, ${property.city}`,
      suburb: property.suburb,
      city: property.city,
      applicantName: application.fullName.trim(),
      email: application.email.trim().toLowerCase(),
      phone: application.phone.trim(),
      moveInDate: application.moveInDate.toISOString().slice(0, 10),
      occupants: application.occupants,
      employmentStatus: application.employmentStatus,
      employerName: application.employerName?.trim() || null,
      jobTitle: application.jobTitle?.trim() || null,
      monthlyIncome: application.monthlyIncome ?? null,
      incomeCurrency: application.monthlyIncome == null ? null : application.incomeCurrency ?? null,
      applicantNote: application.applicantNote?.trim() || null,
      status: "submitted",
      consentAt: now,
      submittedAt: now,
    }).returning({ id: rentalApplicationsTable.id });
    if (!created) throw new Error("Unable to store rental application");
    await tx.update(rentalApplicationInvitesTable).set({
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
    }).where(eq(rentalApplicationInvitesTable.id, invite.id));
    return "submitted" as const;
  });

  if (result === "not_found") {
    res.status(404).json({ error: "Application link not found" });
    return;
  }
  if (result === "unavailable") {
    res.status(410).json({ error: "This application link is no longer available" });
    return;
  }
  res.status(201).json(SubmitPublicRentalApplicationResponse.parse({ success: true }));
});

export default router;
