import { Router, type IRouter } from "express";
import { and, eq, ilike, inArray, or, desc, sql } from "drizzle-orm";
import {
  branchesTable,
  documentsTable,
  db,
  agentContactsTable,
  propertiesTable,
  sellersTable,
  buyersTable,
  buyerRequestsTable,
} from "@workspace/db";
import {
  CreateAgentContactMandateBody,
  CreateAgentContactMandateParams,
  CreateAgentContactMandateResponse,
  CreateAgentContactBody,
  CreateAgentContactResponse,
  CreateAgentContactReviewInvitationParams,
  CreateAgentContactReviewInvitationResponse,
  UpdateAgentContactParams,
  UpdateAgentContactBody,
  UpdateAgentContactResponse,
  GetAgentContactsQueryParams,
  GetAgentContactsResponse,
  ListSellersQueryParams,
  ListSellersResponse,
  CreateSellerBody,
  CreateSellerResponse,
  GetSellerResponse,
  UpdateSellerBody,
  UpdateSellerResponse,
  ListBuyersQueryParams,
  ListBuyersResponse,
  CreateBuyerBody,
  CreateBuyerResponse,
  GetBuyerResponse,
  UpdateBuyerBody,
  UpdateBuyerResponse,
  GetBuyerMatchesResponse,
  ListBuyerRequestsQueryParams,
  ListBuyerRequestsResponse,
  CreateBuyerRequestBody,
  CreateBuyerRequestResponse,
  UpdateBuyerRequestBody,
  UpdateBuyerRequestResponse,
  GetBuyerRequestMatchesResponse,
} from "@workspace/api-zod";
import type { AgentContact } from "@workspace/api-zod";
import { parseId, logAudit, jsonify } from "../lib/helpers";
import { matchProperties } from "../lib/matching";
import { currentUser } from "./auth";
import { createShareableReviewInvitation } from "../lib/agent-reviews";

const router: IRouter = Router();

type ContactType = "seller" | "landlord";

function contactPhoneKey(phone: string | null | undefined) {
  return phone?.replace(/\D/g, "") ?? "";
}

export async function propertyScope(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  if (user.role === "agent" || user.role === "senior_agent") {
    return eq(propertiesTable.agentId, user.id);
  }
  // A branchless Office admin can already see the full office inventory through
  // GET /properties; keep linked seller/landlord contacts in the same scope.
  if (user.role === "admin" && !user.branchId) return sql`true`;
  if (!user.branchId) return eq(propertiesTable.agentId, user.id);
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, user.branchId)).limit(1);
  if (!branch?.agencyId) return eq(propertiesTable.branchId, user.branchId);
  const branches = await db.select({ id: branchesTable.id })
    .from(branchesTable).where(eq(branchesTable.agencyId, branch.agencyId));
  const branchIds = branches.map((entry) => entry.id);
  return branchIds.length ? inArray(propertiesTable.branchId, branchIds) : eq(propertiesTable.branchId, user.branchId);
}

export async function getAccessibleProperty(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
  propertyId: number,
) {
  const scope = await propertyScope(user);
  const [property] = await db.select().from(propertiesTable).where(and(
    eq(propertiesTable.id, propertyId),
    scope,
  )).limit(1);
  return property ?? null;
}

router.get("/agent-contacts", async (req, res): Promise<void> => {
  const query = GetAgentContactsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const scope = await propertyScope(user);
  const listingType = query.data.type === "landlord" ? "rent" : "sale";
  const linkedRecords = await db.select({
    seller: sellersTable,
    property: propertiesTable,
  }).from(propertiesTable)
    .innerJoin(sellersTable, eq(sellersTable.id, propertiesTable.sellerId))
    .where(and(eq(propertiesTable.listingType, listingType), scope))
    .orderBy(desc(propertiesTable.updatedAt));
  const propertyIds = linkedRecords.map(({ property }) => property.id);
  const documents = propertyIds.length
    ? await db.select().from(documentsTable).where(and(
        inArray(documentsTable.propertyId, propertyIds),
        eq(documentsTable.category, "mandate"),
      )).orderBy(desc(documentsTable.createdAt))
    : [];
  const docsByProperty = new Map<number, typeof documents>();
  for (const document of documents) {
    if (document.propertyId == null) continue;
    const current = docsByProperty.get(document.propertyId) ?? [];
    current.push(document);
    docsByProperty.set(document.propertyId, current);
  }
  const contactsById = new Map<number, AgentContact>();
  for (const { seller, property } of linkedRecords) {
    const contact = contactsById.get(seller.id) ?? {
      id: seller.id,
      name: seller.name,
      idNumber: seller.idNumber,
      phone: seller.phone,
      email: seller.email,
      postalAddress: seller.postalAddress,
      notes: seller.notes,
      properties: [],
    };
    contact.properties.push({
      id: property.id,
      reference: property.reference,
      title: property.title,
      address: property.address,
      suburb: property.suburb,
      city: property.city,
      price: property.price,
      currency: property.currency,
      listingType: property.listingType,
      status: property.status,
      availabilityStatus: property.availabilityStatus,
      mandateType: property.mandateType,
      mandateExpiry: property.mandateExpiry,
      documents: (docsByProperty.get(property.id) ?? []).map((document) => ({
        id: document.id,
        name: document.name,
        category: document.category,
        propertyId: document.propertyId,
        url: document.url,
        sizeKb: document.sizeKb,
        version: document.version,
        uploadedBy: document.uploadedBy,
        createdAt: document.createdAt.toISOString(),
      })),
    });
    contactsById.set(seller.id, contact);
  }
  const linkedPhoneKeys = new Set(
    [...contactsById.values()]
      .map((contact) => contactPhoneKey(contact.phone))
      .filter(Boolean),
  );
  const standaloneContacts = await db.select().from(agentContactsTable).where(and(
    eq(agentContactsTable.agentId, user.id),
    eq(agentContactsTable.type, query.data.type),
  )).orderBy(desc(agentContactsTable.createdAt));
  for (const contact of standaloneContacts) {
    if (linkedPhoneKeys.has(contactPhoneKey(contact.phone))) continue;
    contactsById.set(-contact.id, {
      id: -contact.id,
      name: contact.name,
      idNumber: null,
      phone: contact.phone,
      email: contact.email,
      postalAddress: null,
      notes: null,
      standalone: true,
      properties: [],
    });
  }
  res.json(GetAgentContactsResponse.parse(jsonify([...contactsById.values()])));
});

router.post("/agent-contacts", async (req, res): Promise<void> => {
  const parsed = CreateAgentContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const name = parsed.data.name.trim();
  const phone = parsed.data.phone.trim();
  const email = parsed.data.email?.trim() || null;
  if (!name || !phone) {
    res.status(400).json({ error: "Enter a name and phone number." });
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  const [created] = await db.insert(agentContactsTable).values({
    agentId: user.id,
    type: parsed.data.type,
    name,
    phone,
    email,
  }).onConflictDoNothing({
    target: [agentContactsTable.agentId, agentContactsTable.type, agentContactsTable.phone],
  }).returning();
  const [contact] = created
    ? [created]
    : await db.select().from(agentContactsTable).where(and(
        eq(agentContactsTable.agentId, user.id),
        eq(agentContactsTable.type, parsed.data.type),
        eq(agentContactsTable.phone, phone),
      )).limit(1);
  if (!contact) {
    res.status(500).json({ error: "The contact could not be saved." });
    return;
  }
  if (created) {
    await logAudit("created", "agent_contact", contact.id, `Added ${parsed.data.type} contact ${contact.name}`, user.id, user.name);
  }
  res.status(201).json(CreateAgentContactResponse.parse(jsonify({
    id: -contact.id,
    name: contact.name,
    idNumber: null,
    phone: contact.phone,
    email: contact.email,
    postalAddress: null,
    notes: null,
    standalone: true,
    properties: [],
  })));
});

router.patch("/agent-contacts/:contactId", async (req, res): Promise<void> => {
  const params = UpdateAgentContactParams.safeParse(req.params);
  const body = UpdateAgentContactBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid contact details." : params.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const [existing] = await db.select().from(agentContactsTable).where(and(
    eq(agentContactsTable.id, params.data.contactId),
    eq(agentContactsTable.agentId, user.id),
  )).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const phone = body.data.phone.trim();
  const email = body.data.email?.trim() || null;
  if (phone.replace(/\D/g, "").length < 7) {
    res.status(400).json({ error: "Enter a complete phone number." });
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  const [duplicate] = await db.select({ id: agentContactsTable.id }).from(agentContactsTable).where(and(
    eq(agentContactsTable.agentId, user.id),
    eq(agentContactsTable.type, existing.type),
    eq(agentContactsTable.phone, phone),
    sql`${agentContactsTable.id} <> ${existing.id}`,
  )).limit(1);
  if (duplicate) {
    res.status(409).json({ error: "Another contact already uses this phone number." });
    return;
  }
  const [updated] = await db.update(agentContactsTable).set({ phone, email })
    .where(and(
      eq(agentContactsTable.id, existing.id),
      eq(agentContactsTable.agentId, user.id),
    )).returning();
  await logAudit("edited", "agent_contact", updated.id, `Updated ${existing.type} contact details for ${updated.name}`, user.id, user.name);
  res.json(UpdateAgentContactResponse.parse(jsonify({
    id: -updated.id,
    name: updated.name,
    idNumber: null,
    phone: updated.phone,
    email: updated.email,
    postalAddress: null,
    notes: null,
    standalone: true,
    properties: [],
  })));
});

router.post("/agent-contacts/:propertyId/mandates", async (req, res): Promise<void> => {
  const params = CreateAgentContactMandateParams.safeParse(req.params);
  const body = CreateAgentContactMandateBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid mandate document" : params.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const property = await getAccessibleProperty(user, params.data.propertyId);
  if (!property?.sellerId) {
    res.status(404).json({ error: "Contact property not found" });
    return;
  }
  const expectedPrefix = `/objects/uploads/${user.id}/`;
  if (!body.data.objectPath.startsWith(expectedPrefix) ||
      !/^\/objects\/uploads\/\d+\/[a-f0-9-]+\.[a-z0-9]{1,8}$/i.test(body.data.objectPath)) {
    res.status(400).json({ error: "The mandate must be uploaded to your private account storage first." });
    return;
  }
  const [document] = await db.insert(documentsTable).values({
    name: body.data.name.trim(),
    category: "mandate",
    propertyId: property.id,
    url: body.data.objectPath,
    sizeKb: body.data.sizeKb,
    uploadedBy: user.name,
  }).returning();
  res.status(201).json(CreateAgentContactMandateResponse.parse(jsonify(document)));
});

router.post("/agent-contacts/:propertyId/review-invitation", async (req, res): Promise<void> => {
  const params = CreateAgentContactReviewInvitationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const property = await getAccessibleProperty(user, params.data.propertyId);
  if (!property?.sellerId) {
    res.status(404).json({ error: "Contact property not found" });
    return;
  }
  const completedOutcome = property.listingType === "rent"
    ? property.status === "rented" || property.availabilityStatus === "let" ? "rented"
      : ["withdrawn", "archived"].includes(property.status) || property.availabilityStatus === "withdrawn" ? "withdrawn" : null
    : property.status === "sold" || property.availabilityStatus === "sold" ? "sold"
      : ["withdrawn", "archived"].includes(property.status) || property.availabilityStatus === "withdrawn" ? "withdrawn" : null;
  const outcome = completedOutcome ?? "ongoing";
  const [seller] = await db.select().from(sellersTable).where(eq(sellersTable.id, property.sellerId)).limit(1);
  if (!seller) {
    res.status(404).json({ error: "Contact details not found" });
    return;
  }
  let invitation: Awaited<ReturnType<typeof createShareableReviewInvitation>>;
  try {
    invitation = await createShareableReviewInvitation({
      agentId: property.agentId ?? user.id,
      propertyId: property.id,
      recipientName: seller.name,
      recipientEmail: seller.email,
      outcome,
    });
  } catch (error) {
    req.log.error({ err: error, propertyId: property.id }, "Could not create agent review invitation");
    res.status(500).json({ error: "Could not create the review link. Please try again." });
    return;
  }
  if (invitation.kind === "submitted") {
    res.status(409).json({ error: "A review has already been submitted for this mandate." });
    return;
  }
  res.json(CreateAgentContactReviewInvitationResponse.parse({
    url: invitation.url,
    recipientName: seller.name,
    phone: seller.phone,
    propertyReference: property.reference,
    propertyTitle: property.title,
  }));
});

// Sellers
router.get("/sellers", async (req, res): Promise<void> => {
  const q = ListSellersQueryParams.safeParse(req.query);
  const pat = q.success && q.data.q ? `%${q.data.q}%` : null;
  const rows = await db
    .select()
    .from(sellersTable)
    .where(pat ? or(ilike(sellersTable.name, pat), ilike(sellersTable.email, pat), ilike(sellersTable.phone, pat)) : undefined)
    .orderBy(desc(sellersTable.createdAt));
  res.json(ListSellersResponse.parse(jsonify(rows)));
});

router.post("/sellers", async (req, res): Promise<void> => {
  const parsed = CreateSellerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const [row] = await db.insert(sellersTable).values(parsed.data).returning();
  await logAudit("created", "seller", row.id, `Added seller ${row.name}`, user?.id, user?.name);
  res.status(201).json(CreateSellerResponse.parse(jsonify(row)));
});

router.get("/sellers/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [row] = await db.select().from(sellersTable).where(eq(sellersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  res.json(GetSellerResponse.parse(jsonify(row)));
});

router.patch("/sellers/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateSellerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const [row] = await db.update(sellersTable).set(parsed.data).where(eq(sellersTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Seller not found" });
    return;
  }
  await logAudit("edited", "seller", id, `Updated seller ${row.name}`, user?.id, user?.name);
  res.json(UpdateSellerResponse.parse(jsonify(row)));
});

// Buyers
router.get("/buyers", async (req, res): Promise<void> => {
  const q = ListBuyersQueryParams.safeParse(req.query);
  const pat = q.success && q.data.q ? `%${q.data.q}%` : null;
  const rows = await db
    .select()
    .from(buyersTable)
    .where(pat ? or(ilike(buyersTable.name, pat), ilike(buyersTable.email, pat), ilike(buyersTable.phone, pat)) : undefined)
    .orderBy(desc(buyersTable.createdAt));
  res.json(ListBuyersResponse.parse(jsonify(rows)));
});

router.post("/buyers", async (req, res): Promise<void> => {
  const parsed = CreateBuyerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const [row] = await db.insert(buyersTable).values(parsed.data).returning();
  await logAudit("created", "buyer", row.id, `Added buyer ${row.name}`, user?.id, user?.name);
  res.status(201).json(CreateBuyerResponse.parse(jsonify(row)));
});

router.get("/buyers/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [row] = await db.select().from(buyersTable).where(eq(buyersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Buyer not found" });
    return;
  }
  res.json(GetBuyerResponse.parse(jsonify(row)));
});

router.patch("/buyers/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateBuyerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const [row] = await db.update(buyersTable).set(parsed.data).where(eq(buyersTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Buyer not found" });
    return;
  }
  await logAudit("edited", "buyer", id, `Updated buyer ${row.name}`, user?.id, user?.name);
  res.json(UpdateBuyerResponse.parse(jsonify(row)));
});

router.get("/buyers/:id/matches", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [buyer] = await db.select().from(buyersTable).where(eq(buyersTable.id, id));
  if (!buyer) {
    res.status(404).json({ error: "Buyer not found" });
    return;
  }
  const properties = await db.select().from(propertiesTable);
  const matches = matchProperties(
    {
      budgetMin: buyer.budgetMin,
      budgetMax: buyer.budgetMax,
      areas: buyer.preferredAreas,
      propertyType: buyer.propertyType,
      bedroomsMin: buyer.bedroomsMin,
      bathroomsMin: buyer.bathroomsMin,
      features: buyer.features,
    },
    properties,
  );
  res.json(GetBuyerMatchesResponse.parse(jsonify(matches)));
});

// Buyer Requests
router.get("/buyer-requests", async (req, res): Promise<void> => {
  const q = ListBuyerRequestsQueryParams.safeParse(req.query);
  const status = q.success ? q.data.status : undefined;
  const rows = await db
    .select()
    .from(buyerRequestsTable)
    .where(status ? eq(buyerRequestsTable.status, status) : undefined)
    .orderBy(desc(buyerRequestsTable.createdAt));
  res.json(ListBuyerRequestsResponse.parse(jsonify(rows)));
});

router.post("/buyer-requests", async (req, res): Promise<void> => {
  const parsed = CreateBuyerRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(buyerRequestsTable).values(parsed.data).returning();
  res.status(201).json(CreateBuyerRequestResponse.parse(jsonify(row)));
});

router.patch("/buyer-requests/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateBuyerRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(buyerRequestsTable).set(parsed.data).where(eq(buyerRequestsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Buyer request not found" });
    return;
  }
  res.json(UpdateBuyerRequestResponse.parse(jsonify(row)));
});

router.get("/buyer-requests/:id/matches", async (req, res): Promise<void> => {
  const id = parseId(req);
  const [request] = await db.select().from(buyerRequestsTable).where(eq(buyerRequestsTable.id, id));
  if (!request) {
    res.status(404).json({ error: "Buyer request not found" });
    return;
  }
  const properties = await db.select().from(propertiesTable);
  const matches = matchProperties(
    {
      budgetMin: request.budgetMin,
      budgetMax: request.budgetMax,
      areas: request.areas,
      propertyType: request.propertyType,
    },
    properties,
  );
  res.json(GetBuyerRequestMatchesResponse.parse(jsonify(matches)));
});

export default router;
