import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, lte, ilike, or, inArray, sql } from "drizzle-orm";
import { db, usersTable, branchesTable, propertiesTable, savedPropertiesTable } from "@workspace/db";
import { jsonify } from "../lib/helpers";
import {
  SubmitEnquiryBody,
  RegisterBuyerBody,
  LoginBuyerBody,
} from "@workspace/api-zod";
import { leadsTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { canonicalPropertyId, getCanonicalProperty, getPropertyOffers } from "../lib/multi-agent";
import { calculateFreshness, freshnessRankBonus, publicFreshnessLabel } from "../lib/housekeeping";
import { getPublicReviewSummary } from "../lib/agent-reviews";
import { hashPassword, isScryptHash, verifyPassword } from "../lib/passwords";

const router: IRouter = Router();

const PUBLIC_STATUSES = ["public", "under_offer", "coming_soon"];
const BUYER_COOKIE = "qp_buyer";

/* ─── helpers ─────────────────────────────────────────────────────────── */

async function currentBuyer(req: Request) {
  const raw = req.cookies?.[BUYER_COOKIE];
  const id = parseInt(raw ?? "", 10);
  if (!id || Number.isNaN(id)) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user?.role === "buyer" && user.status === "active" ? user : null;
}

function stripPrivate(p: typeof propertiesTable.$inferSelect) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { privateNotes, commissionPercent, sellerId, mandateType, mandateStart, mandateExpiry, pipelineStage, hasBrochure, shares, ...pub } = p;
  return pub;
}

async function agentWithBranch(agentId: number | null) {
  if (!agentId) return null;
  const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, agentId));
  if (!agent) return null;
  let branchName: string | null = null;
  if (agent.branchId) {
    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, agent.branchId));
    branchName = branch?.name ?? null;
  }
  const listings = await db.select().from(propertiesTable).where(
    and(eq(propertiesTable.agentId, agent.id), inArray(propertiesTable.status, PUBLIC_STATUSES))
  );
  const reviewSummary = await getPublicReviewSummary(agent.id);
  return {
    id: agent.id,
    name: agent.name,
    phone: agent.phone ?? null,
    email: agent.email,
    avatarUrl: agent.avatarUrl ?? null,
    role: agent.role,
    branchId: agent.branchId ?? null,
    branchName,
    activeListings: listings.length,
    reviewSummary: {
      averageRating: reviewSummary.averageRating,
      reviewCount: reviewSummary.reviewCount,
    },
  };
}

/* ─── GET /public/stats ────────────────────────────────────────────────── */
router.get("/public/stats", async (_req, res): Promise<void> => {
  const all = await db.select().from(propertiesTable).where(
    inArray(propertiesTable.status, PUBLIC_STATUSES)
  );
  const forSale = all.filter((p) => p.listingType === "sale").length;
  const forRent = all.filter((p) => p.listingType === "rent").length;
  const suburbs = [...new Set(all.map((p) => p.suburb))].sort();
  const uniqueCount = new Set(all.map((property) => property.canonicalPropertyId ?? property.id)).size;
  res.json({ totalListings: uniqueCount, forSale, forRent, suburbs });
});

/* ─── GET /public/properties ───────────────────────────────────────────── */
router.get("/public/properties", async (req, res): Promise<void> => {
  const {
    listingType, propertyType, suburb, city, q,
    minPrice, maxPrice, minBeds, minBaths,
    page = "1", limit = "12", sort = "newest",
  } = req.query as Record<string, string>;

  const conditions = [inArray(propertiesTable.status, PUBLIC_STATUSES)];
  if (listingType) conditions.push(eq(propertiesTable.listingType, listingType));
  if (propertyType) conditions.push(eq(propertiesTable.propertyType, propertyType));
  if (suburb) conditions.push(ilike(propertiesTable.suburb, `%${suburb}%`));
  if (city) conditions.push(ilike(propertiesTable.city, `%${city}%`));
  if (minPrice) conditions.push(gte(propertiesTable.price, parseFloat(minPrice)));
  if (maxPrice) conditions.push(lte(propertiesTable.price, parseFloat(maxPrice)));
  if (minBeds) conditions.push(gte(propertiesTable.bedrooms, parseInt(minBeds)));
  if (minBaths) conditions.push(gte(propertiesTable.bathrooms, parseInt(minBaths)));
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(propertiesTable.title, like),
        ilike(propertiesTable.suburb, like),
        ilike(propertiesTable.city, like),
        ilike(propertiesTable.description, like),
      )!
    );
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(48, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const rows = await db.select().from(propertiesTable).where(and(...conditions));
  const grouped = new Map<number, typeof rows[number]>();
  for (const row of rows) {
    const key = row.canonicalPropertyId ?? row.id;
    const current = grouped.get(key);
    if (!current || row.id === key || row.updatedAt > current.updatedAt) grouped.set(key, row);
  }
  // A source row can be the only public row that matches a filter while its
  // canonical row has a different status or was not returned by the query.
  // Resolve every group before returning it so a public link never points at
  // the archived duplicate.
  const groupedRows = (await Promise.all(
    [...grouped.values()].map(async (row) => getCanonicalProperty(row.id)),
  )).filter((property): property is NonNullable<typeof property> => (
    property != null && PUBLIC_STATUSES.includes(property.status)
  ));
  if (sort === "price_asc") groupedRows.sort((a, b) => a.price - b.price);
  else if (sort === "price_desc") groupedRows.sort((a, b) => b.price - a.price);
  else if (sort === "freshness") groupedRows.sort((a, b) => freshnessRankBonus(b.freshnessStatus) - freshnessRankBonus(a.freshnessStatus));
  else groupedRows.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  const count = groupedRows.length;
  const pageRows = groupedRows.slice(offset, offset + limitNum);
  const properties = await Promise.all(pageRows.map(async (row) => {
    const offers = await getPropertyOffers(row.id);
    return {
      ...stripPrivate(row),
      canonicalPropertyId: row.canonicalPropertyId ?? row.id,
      agencyCount: new Set(offers.map((offer) => offer.agencyName)).size || 1,
      lowestPrice: offers.length ? Math.min(...offers.map((offer) => offer.askingPrice)) : row.price,
      lastAvailabilityVerification: offers.map((offer) => offer.lastAvailabilityConfirmation).filter(Boolean).sort().at(-1) ?? row.lastAvailabilityConfirmedAt,
      freshnessStatus: row.freshnessStatus,
      freshnessLabel: publicFreshnessLabel(row.freshnessStatus, row.lastAvailabilityConfirmedAt, row.updatedAt),
      freshnessScore: row.freshnessScore,
      qualityScore: row.qualityScore,
    };
  }));

  res.json({
    properties: jsonify(properties),
    total: count,
    page: pageNum,
    limit: limitNum,
  });
});

/* ─── GET /public/properties/:id ──────────────────────────────────────── */
router.get("/public/properties/:id", async (req, res): Promise<void> => {
  const rawIdentifier = req.params.id ?? "";
  const numericId = parseInt(rawIdentifier, 10);
  const propertyIdentifier = /^\d+$/.test(rawIdentifier)
    ? eq(propertiesTable.id, numericId)
    : eq(propertiesTable.reference, rawIdentifier.toUpperCase());
  const [found] = await db.select().from(propertiesTable).where(propertyIdentifier);
  const prop = found ? await getCanonicalProperty(found.id) : null;
  if (!prop || !PUBLIC_STATUSES.includes(prop.status)) { res.status(404).json({ error: "Not found" }); return; }

  // Increment views
  await db.update(propertiesTable).set({ views: (prop.views ?? 0) + 1 }).where(eq(propertiesTable.id, prop.id));

  const agent = await agentWithBranch(prop.agentId);
  const offers = await getPropertyOffers(prop.id);
  res.json(jsonify({
    property: {
      ...stripPrivate(prop),
      canonicalPropertyId: prop.id,
      agencyCount: new Set(offers.map((offer) => offer.agencyName)).size || 1,
      lowestPrice: offers.length ? Math.min(...offers.map((offer) => offer.askingPrice)) : prop.price,
      lastAvailabilityVerification: offers.map((offer) => offer.lastAvailabilityConfirmation).filter(Boolean).sort().at(-1) ?? prop.lastAvailabilityConfirmedAt,
      freshnessStatus: prop.freshnessStatus,
      freshnessLabel: publicFreshnessLabel(prop.freshnessStatus, prop.lastAvailabilityConfirmedAt, prop.updatedAt),
      freshnessScore: prop.freshnessScore,
      qualityScore: prop.qualityScore,
    },
    agent,
    offers,
    agencyCount: new Set(offers.map((offer) => offer.agencyName)).size || 1,
    lowestPrice: offers.length ? Math.min(...offers.map((offer) => offer.askingPrice)) : prop.price,
    lastAvailabilityVerification: offers.map((offer) => offer.lastAvailabilityConfirmation).filter(Boolean).sort().at(-1) ?? prop.lastAvailabilityConfirmedAt,
  }));
});

/* ─── GET /public/agents ───────────────────────────────────────────────── */
router.get("/public/agents", async (_req, res): Promise<void> => {
  const agents = await db.select().from(usersTable).where(
    and(
      inArray(usersTable.role, ["agent", "senior_agent", "principal"]),
      eq(usersTable.status, "active"),
    )
  );

  const result = await Promise.all(
    agents.map(async (agent) => {
      let branchName: string | null = null;
      if (agent.branchId) {
        const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, agent.branchId));
        branchName = branch?.name ?? null;
      }
      const listings = await db.select({ id: propertiesTable.id }).from(propertiesTable).where(
        and(eq(propertiesTable.agentId, agent.id), inArray(propertiesTable.status, PUBLIC_STATUSES))
      );
      const reviewSummary = await getPublicReviewSummary(agent.id);
      return {
        id: agent.id,
        name: agent.name,
        phone: agent.phone ?? null,
        email: agent.email,
        avatarUrl: agent.avatarUrl ?? null,
        role: agent.role,
        branchId: agent.branchId ?? null,
        branchName,
        activeListings: listings.length,
        reviewSummary: {
          averageRating: reviewSummary.averageRating,
          reviewCount: reviewSummary.reviewCount,
        },
      };
    })
  );

  res.json(jsonify(result));
});

/* ─── GET /public/agents/:id ───────────────────────────────────────────── */
router.get("/public/agents/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (!id) { res.status(404).json({ error: "Not found" }); return; }

  const [agent] = await db.select().from(usersTable).where(
    and(eq(usersTable.id, id), inArray(usersTable.role, ["agent", "senior_agent", "principal"]))
  );
  if (!agent) { res.status(404).json({ error: "Not found" }); return; }

  let branchName: string | null = null;
  if (agent.branchId) {
    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, agent.branchId));
    branchName = branch?.name ?? null;
  }

  const listings = await db.select().from(propertiesTable).where(
    and(eq(propertiesTable.agentId, agent.id), inArray(propertiesTable.status, PUBLIC_STATUSES))
  );

  const reviewSummary = await getPublicReviewSummary(agent.id);
  res.json(jsonify({
    agent: {
      id: agent.id,
      name: agent.name,
      phone: agent.phone ?? null,
      email: agent.email,
      avatarUrl: agent.avatarUrl ?? null,
      role: agent.role,
      branchId: agent.branchId ?? null,
      branchName,
      activeListings: listings.length,
      reviewSummary: {
        averageRating: reviewSummary.averageRating,
        reviewCount: reviewSummary.reviewCount,
      },
    },
    listings: listings.map(stripPrivate),
    reviews: reviewSummary.reviews,
  }));
});

/* ─── POST /public/enquiries ───────────────────────────────────────────── */
router.post("/public/enquiries", async (req, res): Promise<void> => {
  const parsed = SubmitEnquiryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, email, phone, message, propertyId, agentId, enquiryType } = parsed.data;
  const canonicalId = propertyId ? await canonicalPropertyId(propertyId) : null;

  // Create lead
  const [lead] = await db
    .insert(leadsTable)
    .values({
      name,
      phone: phone ?? null,
      email: email ?? null,
      source: "website",
      stage: "new",
      propertyId: canonicalId,
      agentId: agentId ?? null,
      notes: `Enquiry type: ${enquiryType ?? "general"}\n\n${message}`,
    })
    .returning();

  // Increment enquiries on property
  if (canonicalId) {
    const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, canonicalId));
    if (prop) {
      await db.update(propertiesTable).set({ enquiries: (prop.enquiries ?? 0) + 1 }).where(eq(propertiesTable.id, canonicalId));
    }
  }

  res.status(201).json({ leadId: lead.id, message: "Enquiry submitted successfully" });
});

/* ─── POST /public/auth/register ──────────────────────────────────────── */
router.post("/public/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBuyerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { name, email, password, phone } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (existing) { res.status(409).json({ error: "Email already registered" }); return; }

  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email: email.toLowerCase().trim(),
      phone: phone ?? null,
      password: await hashPassword(password),
      role: "buyer",
      status: "active",
    })
    .returning();

  res.cookie(BUYER_COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 3600 * 1000,
  });

  res.status(201).json({ id: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role });
});

/* ─── POST /public/auth/login ─────────────────────────────────────────── */
router.post("/public/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBuyerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email.toLowerCase().trim()));
  if (!user || user.role !== "buyer" || user.status !== "active" || !await verifyPassword(parsed.data.password, user.password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!isScryptHash(user.password)) {
    await db.update(usersTable).set({ password: await hashPassword(parsed.data.password) }).where(eq(usersTable.id, user.id));
  }

  res.cookie(BUYER_COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 3600 * 1000,
  });

  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role });
});

/* ─── POST /public/auth/logout ────────────────────────────────────────── */
router.post("/public/auth/logout", (_req, res): void => {
  res.clearCookie(BUYER_COOKIE);
  res.json({ ok: true });
});

/* ─── GET /public/auth/me ─────────────────────────────────────────────── */
router.get("/public/auth/me", async (req, res): Promise<void> => {
  const user = await currentBuyer(req);
  if (!user) { res.status(401).json({ error: "Not logged in" }); return; }
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone ?? null, role: user.role });
});

/* ─── GET /public/saved ───────────────────────────────────────────────── */
router.get("/public/saved", async (req, res): Promise<void> => {
  const user = await currentBuyer(req);
  if (!user) { res.status(401).json({ error: "Not logged in" }); return; }

  const saved = await db
    .select({ property: propertiesTable })
    .from(savedPropertiesTable)
    .innerJoin(propertiesTable, eq(savedPropertiesTable.propertyId, propertiesTable.id))
    .where(eq(savedPropertiesTable.userId, user.id));

  const canonicalProperties = await Promise.all(saved.map((s) => getCanonicalProperty(s.property.id)));
  const uniquePublicProperties = new Map<number, NonNullable<typeof canonicalProperties[number]>>();
  for (const property of canonicalProperties) {
    if (property && PUBLIC_STATUSES.includes(property.status)) uniquePublicProperties.set(property.id, property);
  }
  res.json(jsonify([...uniquePublicProperties.values()].map(stripPrivate)));
});

/* ─── POST /public/saved/:propertyId ─────────────────────────────────── */
router.post("/public/saved/:propertyId", async (req, res): Promise<void> => {
  const user = await currentBuyer(req);
  if (!user) { res.status(401).json({ error: "Not logged in" }); return; }

  const propertyId = parseInt(req.params.propertyId ?? "", 10);
  if (!propertyId) { res.status(400).json({ error: "Invalid property" }); return; }
  const canonicalId = await canonicalPropertyId(propertyId);

  await db
    .insert(savedPropertiesTable)
    .values({ userId: user.id, propertyId: canonicalId })
    .onConflictDoNothing();

  res.status(201).json({ saved: true, propertyId: canonicalId });
});

/* ─── DELETE /public/saved/:propertyId ───────────────────────────────── */
router.delete("/public/saved/:propertyId", async (req, res): Promise<void> => {
  const user = await currentBuyer(req);
  if (!user) { res.status(401).json({ error: "Not logged in" }); return; }

  const propertyId = parseInt(req.params.propertyId ?? "", 10);
  if (!propertyId) { res.status(400).json({ error: "Invalid property" }); return; }
  const canonicalId = await canonicalPropertyId(propertyId);

  await db
    .delete(savedPropertiesTable)
    .where(and(eq(savedPropertiesTable.userId, user.id), eq(savedPropertiesTable.propertyId, canonicalId)));

  res.status(204).send();
});

/* ─── POST /public/nlp-search ─────────────────────────────────────────── */
router.post("/public/nlp-search", async (req, res): Promise<void> => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) { res.status(400).json({ error: "query is required" }); return; }

  const SYSTEM = `You are a property search parser for the Zimbabwe real estate market.
Given a natural-language search query from a buyer, extract structured search parameters.
Return ONLY a valid JSON object with these optional fields:
- listingType: "sale" | "rent"
- propertyType: "house" | "apartment" | "townhouse" | "stand" | "commercial"
- suburb: string (suburb or neighbourhood name if mentioned)
- city: string (city name if mentioned, e.g. Harare, Bulawayo, Mutare)
- minPrice: number (USD, no commas)
- maxPrice: number (USD, no commas)
- minBeds: number (minimum bedrooms)
- keywords: string (any remaining descriptive terms useful for a full-text search, e.g. "pool garden garage")

Rules:
- Only include fields that are clearly implied by the query.
- If no listing type is mentioned assume "sale".
- For price: "k" means thousands, "m" means millions.
- Do not include any explanation or markdown — output raw JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: query }] }],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        maxOutputTokens: 512,
      },
    });

    const raw = response.text?.trim() ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    // Sanitise — only return known, safe fields
    const result: Record<string, unknown> = {};
    if (typeof parsed.listingType === "string") result.listingType = parsed.listingType;
    if (typeof parsed.propertyType === "string") result.propertyType = parsed.propertyType;
    if (typeof parsed.suburb === "string") result.suburb = parsed.suburb;
    if (typeof parsed.city === "string") result.city = parsed.city;
    if (typeof parsed.minPrice === "number") result.minPrice = parsed.minPrice;
    if (typeof parsed.maxPrice === "number") result.maxPrice = parsed.maxPrice;
    if (typeof parsed.minBeds === "number") result.minBeds = parsed.minBeds;
    if (typeof parsed.keywords === "string") result.keywords = parsed.keywords;

    res.json(result);
  } catch (err) {
    console.error("NLP search error:", err);
    res.status(500).json({ error: "Search parsing failed" });
  }
});

export default router;
