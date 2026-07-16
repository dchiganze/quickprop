import { Router, type IRouter } from "express";
import { eq, ilike, or, desc } from "drizzle-orm";
import {
  db,
  sellersTable,
  buyersTable,
  buyerRequestsTable,
  propertiesTable,
} from "@workspace/db";
import {
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
import { parseId, logAudit, jsonify } from "../lib/helpers";
import { matchProperties } from "../lib/matching";
import { currentUser } from "./auth";

const router: IRouter = Router();

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
