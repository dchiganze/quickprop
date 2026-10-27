import { and, desc, eq, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  agenciesTable,
  db,
  referenceRequestsTable,
  rentalDisputesTable,
  rentalHistoryTable,
  rentalReferencesTable,
  usersTable,
} from "@workspace/db";
import {
  CreateRentalAgencyBody,
  CreateRentalAgencyResponse,
  CreateRentalHistoryBody,
  CreateRentalHistoryResponse,
  DisputeRentalReferenceBody,
  DisputeRentalReferenceParams,
  DisputeRentalReferenceResponse,
  GetPublicRentalReferenceParams,
  GetPublicRentalReferenceResponse,
  GetRentalProfileResponse,
  ListAdminRentalReferencesResponse,
  PublicRentalReference,
  RentalReferenceInput,
  RequestRentalVerificationBody,
  RequestRentalVerificationParams,
  RequestRentalVerificationResponse,
  ResendRentalReferenceParams,
  ResendRentalReferenceResponse,
  SearchRentalAgenciesQueryParams,
  SearchRentalAgenciesResponse,
  SubmitPublicRentalReferenceBody,
  SubmitPublicRentalReferenceParams,
  SubmitPublicRentalReferenceResponse,
  UpdateRentalAgencyBody,
  UpdateRentalAgencyQueryParams,
  UpdateRentalAgencyResponse,
  UpdateRentalDisputeBody,
  UpdateRentalDisputeParams,
  UpdateRentalDisputeResponse,
} from "@workspace/api-zod";
import { getPublicReviewSummary } from "../lib/agent-reviews";
import { getEacAgency, searchEacAgencies } from "../lib/eac-agencies";
import { currentBuyer } from "../lib/public-auth";
import {
  createReferenceRequest,
  getReferenceRequestByToken,
  getRentalHistoryView,
  getRentalProfile,
  notifyAdmins,
  referenceIsUnavailable,
  resendReferenceRequest,
  submitReference,
} from "../lib/rental-references";
import { requireAuth, requireRole } from "./auth";

const router: IRouter = Router();
const TERMINAL_REQUEST_STATUSES = ["completed", "not_verified", "expired"];

function parseId(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number.parseInt(value ?? "", 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

router.get("/public/rental-profile", async (req, res): Promise<void> => {
  const user = await currentBuyer(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  res.json(GetRentalProfileResponse.parse(await getRentalProfile(user.id)));
});

router.post("/public/rental-history", async (req, res): Promise<void> => {
  const user = await currentBuyer(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const parsed = CreateRentalHistoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.endDate < parsed.data.startDate) {
    res.status(400).json({ error: "End date must be after the start date" });
    return;
  }
  const selectedAgency = parsed.data.refereeType === "agency" && parsed.data.agencySourceId
    ? getEacAgency(parsed.data.agencySourceId)
    : null;
  if (parsed.data.refereeType === "agency" && !selectedAgency) {
    res.status(400).json({ error: "Select an agency from the EAC registered-agency directory" });
    return;
  }
  const selectedAgencyEmail = parsed.data.agencyEmail?.trim().toLowerCase() || null;
  const selectedAgencyPhone = parsed.data.agencyPhone?.trim() || null;
  if (selectedAgency && (
    (selectedAgencyEmail && !selectedAgency.emails.some((email) => email.toLowerCase() === selectedAgencyEmail))
    || (selectedAgencyPhone && !selectedAgency.phones.includes(selectedAgencyPhone))
    || (!selectedAgencyEmail && !selectedAgencyPhone)
  )) {
    res.status(400).json({ error: "Choose an email address or phone number listed for this EAC agency" });
    return;
  }
  if (parsed.data.refereeType === "private_landlord"
    && (!parsed.data.refereeName?.trim() || (!parsed.data.refereeEmail?.trim() && !parsed.data.refereePhone?.trim()))) {
    res.status(400).json({ error: "Provide the landlord's name and an email address or phone number" });
    return;
  }
  const [history] = await db.insert(rentalHistoryTable).values({
    tenantUserId: user.id,
    propertyId: parsed.data.propertyId ?? null,
    propertyAddress: parsed.data.propertyAddress.trim(),
    suburb: parsed.data.suburb.trim(),
    city: parsed.data.city.trim(),
    startDate: normalizeDate(parsed.data.startDate),
    endDate: normalizeDate(parsed.data.endDate),
    tenancyType: parsed.data.tenancyType,
    refereeType: parsed.data.refereeType,
    refereeName: selectedAgency?.name ?? parsed.data.refereeName?.trim() ?? null,
    refereeEmail: selectedAgency ? selectedAgencyEmail : parsed.data.refereeEmail?.trim().toLowerCase() ?? null,
    refereePhone: selectedAgency ? selectedAgencyPhone : parsed.data.refereePhone?.trim() ?? null,
    agencyId: null,
    verificationStatus: "self_reported",
  }).returning();
  if (!history) {
    res.status(400).json({ error: "Unable to create rental history" });
    return;
  }
  res.status(201).json(CreateRentalHistoryResponse.parse(await getRentalHistoryView(history.id)));
});

router.post("/public/rental-history/:id/request-verification", async (req, res): Promise<void> => {
  const user = await currentBuyer(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const params = RequestRentalVerificationParams.safeParse(req.params);
  const parsed = RequestRentalVerificationBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const error = !params.success ? params.error.message : !parsed.success ? parsed.error.message : "Invalid request";
    res.status(400).json({ error });
    return;
  }
  const [history] = await db.select().from(rentalHistoryTable).where(and(
    eq(rentalHistoryTable.id, params.data.id),
    eq(rentalHistoryTable.tenantUserId, user.id),
  )).limit(1);
  if (!history) {
    res.status(404).json({ error: "Rental history not found" });
    return;
  }
  const [existingRequest] = await db.select({ id: referenceRequestsTable.id })
    .from(referenceRequestsTable).where(eq(referenceRequestsTable.rentalHistoryId, history.id)).limit(1);
  if (existingRequest) {
    res.status(409).json({ error: "A reference request already exists for this tenancy" });
    return;
  }
  if (parsed.data.refereeType !== history.refereeType) {
    res.status(400).json({ error: "The selected referee type does not match this tenancy" });
    return;
  }
  const agency = null;
  const refereeEmail = parsed.data.refereeType === "private_landlord"
    ? parsed.data.refereeEmail?.trim().toLowerCase() || history.refereeEmail
    : history.refereeEmail;
  const refereePhone = parsed.data.refereeType === "private_landlord"
    ? parsed.data.refereePhone?.trim() || history.refereePhone
    : history.refereePhone;
  const refereeName = parsed.data.refereeType === "private_landlord"
    ? parsed.data.refereeName?.trim() || history.refereeName
    : history.refereeName;
  if (!refereeName || (!refereeEmail && !refereePhone)) {
    res.status(400).json({ error: "Provide the landlord's name and an email or phone number" });
    return;
  }
  const deliveryChannel = parsed.data.deliveryChannel ?? (refereeEmail ? "email" : "whatsapp");
  if (deliveryChannel === "email" && !refereeEmail) {
    res.status(400).json({ error: "This referee has no email address; choose WhatsApp instead" });
    return;
  }
  if (deliveryChannel === "whatsapp" && !refereePhone) {
    res.status(400).json({ error: "This referee has no phone number; choose email instead" });
    return;
  }
  const result = await createReferenceRequest({
    history,
    tenantName: user.name,
    refereeType: parsed.data.refereeType,
    refereeName,
    refereeEmail,
    refereePhone,
    agency,
    deliveryChannel,
  });
  res.json(RequestRentalVerificationResponse.parse(result));
});

router.post("/public/rental-history/:id/dispute", async (req, res): Promise<void> => {
  const user = await currentBuyer(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const params = DisputeRentalReferenceParams.safeParse(req.params);
  const parsed = DisputeRentalReferenceBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const error = !params.success ? params.error.message : !parsed.success ? parsed.error.message : "Invalid request";
    res.status(400).json({ error });
    return;
  }
  const [history] = await db.select().from(rentalHistoryTable).where(and(
    eq(rentalHistoryTable.id, params.data.id),
    eq(rentalHistoryTable.tenantUserId, user.id),
  )).limit(1);
  if (!history) {
    res.status(404).json({ error: "Rental history not found" });
    return;
  }
  const [reference] = await db.select().from(rentalReferencesTable)
    .where(and(eq(rentalReferencesTable.rentalHistoryId, history.id), eq(rentalReferencesTable.verifiedTenancy, true))).limit(1);
  if (!reference) {
    res.status(400).json({ error: "Only verified references can be disputed" });
    return;
  }
  const [openDispute] = await db.select({ id: rentalDisputesTable.id }).from(rentalDisputesTable)
    .where(and(eq(rentalDisputesTable.rentalHistoryId, history.id), or(
      eq(rentalDisputesTable.status, "open"),
      eq(rentalDisputesTable.status, "under_review"),
    ))).limit(1);
  if (openDispute) {
    res.status(409).json({ error: "A dispute is already open for this tenancy" });
    return;
  }
  const [dispute] = await db.insert(rentalDisputesTable).values({
    rentalHistoryId: history.id,
    tenantUserId: user.id,
    reason: parsed.data.reason.trim(),
    status: "open",
  }).returning();
  if (!dispute) {
    res.status(400).json({ error: "Unable to create dispute" });
    return;
  }
  await db.update(rentalReferencesTable).set({ disputeStatus: "open", disputeReason: parsed.data.reason.trim(), updatedAt: new Date() })
    .where(eq(rentalReferencesTable.id, reference.id));
  await notifyAdmins("Rental reference disputed", `${user.name} disputed a verified rental reference for ${history.propertyAddress}.`);
  res.status(201).json(DisputeRentalReferenceResponse.parse({
    ...dispute,
    resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    createdAt: dispute.createdAt.toISOString(),
    updatedAt: dispute.updatedAt.toISOString(),
  }));
});

router.get("/public/agencies/search", async (req, res): Promise<void> => {
  const parsed = SearchRentalAgenciesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(SearchRentalAgenciesResponse.parse(searchEacAgencies(parsed.data.q)));
});

router.get("/public/rental-references/:token", async (req, res): Promise<void> => {
  const params = GetPublicRentalReferenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Reference not found" });
    return;
  }
  const row = await getReferenceRequestByToken(params.data.token);
  if (!row) {
    res.status(404).json({ error: "Reference not found" });
    return;
  }
  if (referenceIsUnavailable(row.request)) {
    res.status(row.request.expiresAt <= new Date() ? 410 : 410).json({ error: "This reference link is no longer available" });
    return;
  }
  res.json(GetPublicRentalReferenceResponse.parse({
    status: "available",
    tenantName: row.tenantName,
    propertyAddress: row.history.propertyAddress,
    suburb: row.history.suburb,
    city: row.history.city,
    startDate: row.history.startDate,
    endDate: row.history.endDate,
    refereeName: row.history.refereeName,
    agencyName: row.agency?.name ?? (row.request.recipientType === "agency" ? row.history.refereeName : null),
    expiresAt: row.request.expiresAt.toISOString(),
  }));
});

router.post("/public/rental-references/:token", async (req, res): Promise<void> => {
  const params = SubmitPublicRentalReferenceParams.safeParse(req.params);
  const parsed = SubmitPublicRentalReferenceBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const error = !params.success ? params.error.message : !parsed.success ? parsed.error.message : "Invalid request";
    res.status(400).json({ error });
    return;
  }
  const row = await getReferenceRequestByToken(params.data.token);
  if (!row) {
    res.status(404).json({ error: "Reference not found" });
    return;
  }
  const result = await submitReference({
    token: params.data.token,
    tenancyPeriod: parsed.data.tenancyPeriod,
    rentPaymentRating: parsed.data.rentPaymentRating,
    propertyConditionRating: parsed.data.propertyConditionRating,
    wouldRentAgain: parsed.data.wouldRentAgain,
    submittedBy: row.request.recipientEmail ?? row.agency?.name ?? null,
  });
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Reference not found" });
    return;
  }
  if (result.kind === "expired" || result.kind === "used") {
    res.status(410).json({ error: "This reference link is no longer available" });
    return;
  }
  res.status(201).json(SubmitPublicRentalReferenceResponse.parse({ success: true, status: result.status }));
});

router.use("/admin", requireAuth);
const adminOnly = requireRole("principal", "admin", "quickprop_admin");

router.get("/admin/rental-references", adminOnly, async (_req, res): Promise<void> => {
  const histories = await db.select({
    history: rentalHistoryTable,
    tenantName: usersTable.name,
    tenantEmail: usersTable.email,
  }).from(rentalHistoryTable)
    .innerJoin(usersTable, eq(usersTable.id, rentalHistoryTable.tenantUserId))
    .orderBy(desc(rentalHistoryTable.updatedAt));
  const rows = await Promise.all(histories.map(async ({ history, tenantName, tenantEmail }) => ({
    ...(await getRentalHistoryView(history.id)),
    tenantName,
    tenantEmail,
  })));
  res.json(ListAdminRentalReferencesResponse.parse(rows));
});

router.post("/admin/rental-reference-requests/:id/resend", adminOnly, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid request id" });
    return;
  }
  const request = await resendReferenceRequest(id);
  if (!request) {
    res.status(404).json({ error: "Request not found or cannot be resent" });
    return;
  }
  res.json(ResendRentalReferenceResponse.parse(request));
});

router.post("/admin/rental-agencies", adminOnly, async (req, res): Promise<void> => {
  const parsed = CreateRentalAgencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [agency] = await db.insert(agenciesTable).values({
    ...parsed.data,
    verificationStatus: "pending",
    status: "active",
  }).returning();
  res.status(201).json(CreateRentalAgencyResponse.parse({
    ...agency,
    createdAt: agency.createdAt.toISOString(),
    updatedAt: agency.updatedAt.toISOString(),
  }));
});

router.get("/admin/rental-agencies", adminOnly, async (_req, res): Promise<void> => {
  const agencies = await db.select().from(agenciesTable).orderBy(desc(agenciesTable.createdAt));
  res.json(agencies.map((agency) => ({
    ...agency,
    createdAt: agency.createdAt.toISOString(),
    updatedAt: agency.updatedAt.toISOString(),
  })));
});

router.patch("/admin/rental-agencies", adminOnly, async (req, res): Promise<void> => {
  const params = UpdateRentalAgencyQueryParams.safeParse(req.query);
  const parsed = UpdateRentalAgencyBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const error = !params.success ? params.error.message : !parsed.success ? parsed.error.message : "Invalid request";
    res.status(400).json({ error });
    return;
  }
  const [agency] = await db.update(agenciesTable).set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(agenciesTable.id, params.data.id)).returning();
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.json(UpdateRentalAgencyResponse.parse({
    ...agency,
    createdAt: agency.createdAt.toISOString(),
    updatedAt: agency.updatedAt.toISOString(),
  }));
});

router.patch("/admin/rental-disputes/:id", adminOnly, async (req, res): Promise<void> => {
  const params = UpdateRentalDisputeParams.safeParse(req.params);
  const parsed = UpdateRentalDisputeBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    const error = !params.success ? params.error.message : !parsed.success ? parsed.error.message : "Invalid request";
    res.status(400).json({ error });
    return;
  }
  const now = new Date();
  const adminUser = res.locals.user as typeof usersTable.$inferSelect;
  const [dispute] = await db.update(rentalDisputesTable).set({
    status: parsed.data.status,
    resolutionNote: parsed.data.resolutionNote ?? null,
    resolvedByUserId: ["resolved", "dismissed"].includes(parsed.data.status) ? adminUser.id : null,
    resolvedAt: ["resolved", "dismissed"].includes(parsed.data.status) ? now : null,
    updatedAt: now,
  }).where(eq(rentalDisputesTable.id, params.data.id)).returning();
  if (!dispute) {
    res.status(404).json({ error: "Dispute not found" });
    return;
  }
  await db.update(rentalReferencesTable).set({
    disputeStatus: parsed.data.status === "dismissed" ? "none" : parsed.data.status,
    updatedAt: now,
  }).where(eq(rentalReferencesTable.rentalHistoryId, dispute.rentalHistoryId));
  res.json(UpdateRentalDisputeResponse.parse({
    ...dispute,
    resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    createdAt: dispute.createdAt.toISOString(),
    updatedAt: dispute.updatedAt.toISOString(),
  }));
});

export default router;