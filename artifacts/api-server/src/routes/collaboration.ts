import { Router, type IRouter } from "express";
import { aliasedTable, and, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import {
  collaborationMatchRequestsTable,
  db,
  propertiesTable,
  usersTable,
} from "@workspace/db";
import {
  CreateCollaborationRequestBody,
  CreateCollaborationRequestResponse,
  ListCollaborationDiscoveryQueryParams,
  ListCollaborationDiscoveryResponse,
  ListCollaborationRequestsQueryParams,
  ListCollaborationRequestsResponse,
  UpdateCollaborationRequestBody,
  UpdateCollaborationRequestResponse,
} from "@workspace/api-zod";
import { jsonify, parseId } from "../lib/helpers";
import { currentUser } from "./auth";

const router: IRouter = Router();
const ACTIVE_REQUEST_STATUSES = ["pending", "approved"] as const;
const requester = aliasedTable(usersTable, "collaboration_requester");
const owner = aliasedTable(usersTable, "collaboration_owner");

type NaturalLanguageFilters = {
  minBedrooms?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  suburb?: string;
  hasStructuredFilters: boolean;
};

function numericAmount(raw: string, suffix?: string): number | undefined {
  const parsed = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  if (suffix?.toLowerCase() === "m") return parsed * 1_000_000;
  if (suffix?.toLowerCase() === "k") return parsed * 1_000;
  return parsed;
}

/**
 * Converts the common property-search phrasing agents use into database
 * filters. The original text search remains in effect when no structured
 * phrase is present, so road names and feature words still work naturally.
 */
function parseNaturalLanguage(query?: string): NaturalLanguageFilters {
  if (!query?.trim()) return { hasStructuredFilters: false };
  const value = query.trim();
  const result: NaturalLanguageFilters = { hasStructuredFilters: false };

  const bedrooms = value.match(/\b(\d+)\s*(?:bed(?:room)?s?)\b/i);
  if (bedrooms) {
    result.minBedrooms = Number(bedrooms[1]);
    result.hasStructuredFilters = true;
  }

  const price = value.match(/\b(?:under|below|up\s+to|max(?:imum)?|less\s+than)\s*[$£€R]?\s*([\d,.]+)\s*([km])?\b/i);
  const maxPrice = price && numericAmount(price[1], price[2]);
  if (maxPrice) {
    result.maxPrice = maxPrice;
    result.hasStructuredFilters = true;
  }

  const minimumSize = value.match(/\b(?:over|above|at\s+least|min(?:imum)?)\s*([\d,.]+)\s*(?:m2|m²|sqm|square\s*met(?:er|re)s?)\b/i);
  const maximumSize = value.match(/\b(?:under|below|up\s+to|max(?:imum)?|less\s+than)\s*([\d,.]+)\s*(?:m2|m²|sqm|square\s*met(?:er|re)s?)\b/i);
  const minSize = minimumSize && numericAmount(minimumSize[1]);
  const maxSize = maximumSize && numericAmount(maximumSize[1]);
  if (minSize) {
    result.minSize = minSize;
    result.hasStructuredFilters = true;
  }
  if (maxSize) {
    result.maxSize = maxSize;
    result.hasStructuredFilters = true;
  }

  const location = value.match(/\b(?:in|at|near)\s+([a-z][a-z\s'-]*?)(?=\s+(?:under|below|up\s+to|max(?:imum)?|less\s+than|over|above|with|and|for)\b|$)/i);
  if (location?.[1]?.trim()) {
    result.suburb = location[1].trim();
    result.hasStructuredFilters = true;
  }
  return result;
}

async function requestWithContacts(id: number) {
  const [row] = await db
    .select({
      request: collaborationMatchRequestsTable,
      property: propertiesTable,
      requesterName: requester.name,
      requesterPhone: requester.phone,
      ownerName: owner.name,
      ownerPhone: owner.phone,
    })
    .from(collaborationMatchRequestsTable)
    .innerJoin(propertiesTable, eq(collaborationMatchRequestsTable.propertyId, propertiesTable.id))
    .innerJoin(requester, eq(collaborationMatchRequestsTable.requesterId, requester.id))
    .innerJoin(owner, eq(collaborationMatchRequestsTable.propertyOwnerId, owner.id))
    .where(eq(collaborationMatchRequestsTable.id, id));
  return row ? {
    ...row.request,
    property: row.property,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    ownerName: row.ownerName,
    ownerPhone: row.ownerPhone,
  } : null;
}

router.get("/collaboration/discovery", async (req, res): Promise<void> => {
  const parsed = ListCollaborationDiscoveryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user?.branchId) {
    res.json(ListCollaborationDiscoveryResponse.parse([]));
    return;
  }

  const f = parsed.data;
  const natural = parseNaturalLanguage(f.q);
  const conds: SQL[] = [
    eq(propertiesTable.status, "public"),
    or(
      eq(propertiesTable.branchId, user.branchId),
      and(
        ne(propertiesTable.branchId, user.branchId),
        eq(propertiesTable.collaborationEnabled, true),
      ),
    )!,
  ];
  if (f.q && !natural.hasStructuredFilters) {
    const value = `%${f.q}%`;
    conds.push(or(
      ilike(propertiesTable.title, value),
      ilike(propertiesTable.reference, value),
      ilike(propertiesTable.suburb, value),
      ilike(propertiesTable.address, value),
      ilike(propertiesTable.description, value),
      sql`array_to_string(${propertiesTable.features}, ' ') ILIKE ${value}`,
    )!);
  }
  if (f.suburb ?? natural.suburb) conds.push(ilike(propertiesTable.suburb, `%${f.suburb ?? natural.suburb}%`));
  if (f.road) conds.push(ilike(propertiesTable.address, `%${f.road}%`));
  if (f.description) conds.push(ilike(propertiesTable.description, `%${f.description}%`));
  if (f.minBedrooms ?? natural.minBedrooms) conds.push(gte(propertiesTable.bedrooms, f.minBedrooms ?? natural.minBedrooms!));
  if (f.minPrice != null) conds.push(gte(propertiesTable.price, f.minPrice));
  if (f.maxPrice ?? natural.maxPrice) conds.push(lte(propertiesTable.price, f.maxPrice ?? natural.maxPrice!));
  if (f.minSize ?? natural.minSize) conds.push(or(
    gte(propertiesTable.landSize, f.minSize ?? natural.minSize!),
    gte(propertiesTable.buildingSize, f.minSize ?? natural.minSize!),
  )!);
  if (f.maxSize ?? natural.maxSize) conds.push(and(
    or(lte(propertiesTable.landSize, f.maxSize ?? natural.maxSize!), sql`${propertiesTable.landSize} IS NULL`)!,
    or(lte(propertiesTable.buildingSize, f.maxSize ?? natural.maxSize!), sql`${propertiesTable.buildingSize} IS NULL`)!,
  )!);
  for (const feature of f.feature?.split(",").map((value) => value.trim()).filter(Boolean) ?? []) {
    conds.push(sql`${propertiesTable.features} @> ARRAY[${feature}]::text[]`);
  }

  const rows = await db.select().from(propertiesTable)
    .where(and(...conds))
    .orderBy(desc(propertiesTable.createdAt));
  res.json(ListCollaborationDiscoveryResponse.parse(jsonify(rows)));
});

router.get("/collaboration/requests", async (req, res): Promise<void> => {
  const parsed = ListCollaborationRequestsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const f = parsed.data;
  const conds: SQL[] = [];
  if (f.direction === "incoming") conds.push(eq(collaborationMatchRequestsTable.propertyOwnerId, user.id));
  else if (f.direction === "outgoing") conds.push(eq(collaborationMatchRequestsTable.requesterId, user.id));
  else conds.push(or(
    eq(collaborationMatchRequestsTable.requesterId, user.id),
    eq(collaborationMatchRequestsTable.propertyOwnerId, user.id),
  )!);
  if (f.status) conds.push(eq(collaborationMatchRequestsTable.status, f.status));

  const rows = await db
    .select({
      request: collaborationMatchRequestsTable,
      property: propertiesTable,
      requesterName: requester.name,
      requesterPhone: requester.phone,
      ownerName: owner.name,
      ownerPhone: owner.phone,
    })
    .from(collaborationMatchRequestsTable)
    .innerJoin(propertiesTable, eq(collaborationMatchRequestsTable.propertyId, propertiesTable.id))
    .innerJoin(requester, eq(collaborationMatchRequestsTable.requesterId, requester.id))
    .innerJoin(owner, eq(collaborationMatchRequestsTable.propertyOwnerId, owner.id))
    .where(and(...conds))
    .orderBy(desc(collaborationMatchRequestsTable.createdAt));
  const result = rows.map((row) => ({
    ...row.request,
    property: row.property,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    ownerName: row.ownerName,
    ownerPhone: row.ownerPhone,
  }));
  res.json(ListCollaborationRequestsResponse.parse(jsonify(result)));
});

router.post("/collaboration/requests", async (req, res): Promise<void> => {
  const parsed = CreateCollaborationRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  if (!user?.branchId) {
    res.status(403).json({ error: "A branch assignment is required for collaboration." });
    return;
  }
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, parsed.data.propertyId));
  if (!property || property.status !== "public" || !property.agentId || !property.branchId) {
    res.status(404).json({ error: "Published collaboration property not found." });
    return;
  }
  if (property.agentId === user.id) {
    res.status(400).json({ error: "You cannot request collaboration on your own property." });
    return;
  }
  const sameBranch = property.branchId === user.branchId;
  const allowedCrossBranch = property.branchId !== user.branchId && property.collaborationEnabled;
  if (!sameBranch && !allowedCrossBranch) {
    res.status(403).json({ error: "This property is not available for cross-branch collaboration." });
    return;
  }
  const [active] = await db.select({ id: collaborationMatchRequestsTable.id })
    .from(collaborationMatchRequestsTable)
    .where(and(
      eq(collaborationMatchRequestsTable.requesterId, user.id),
      eq(collaborationMatchRequestsTable.propertyId, property.id),
      inArray(collaborationMatchRequestsTable.status, ACTIVE_REQUEST_STATUSES),
    ));
  if (active) {
    res.status(409).json({ error: "An active collaboration request already exists for this property." });
    return;
  }
  try {
    const [created] = await db.insert(collaborationMatchRequestsTable).values({
      requesterId: user.id,
      propertyOwnerId: property.agentId,
      propertyId: property.id,
      message: parsed.data.message?.trim() || null,
    }).returning({ id: collaborationMatchRequestsTable.id });
    const result = await requestWithContacts(created.id);
    res.status(201).json(CreateCollaborationRequestResponse.parse(jsonify(result)));
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "An active collaboration request already exists for this property." });
      return;
    }
    throw error;
  }
});

router.patch("/collaboration/requests/:id", async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateCollaborationRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await currentUser(req);
  const [existing] = await db.select().from(collaborationMatchRequestsTable).where(eq(collaborationMatchRequestsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Collaboration request not found." });
    return;
  }
  if (!user || existing.propertyOwnerId !== user.id) {
    res.status(403).json({ error: "Only the property owner can update this request." });
    return;
  }
  if (existing.status !== "pending") {
    res.status(409).json({ error: "Only pending collaboration requests can be updated." });
    return;
  }
  await db.update(collaborationMatchRequestsTable)
    .set({ status: parsed.data.status, respondedAt: new Date(), updatedAt: new Date() })
    .where(eq(collaborationMatchRequestsTable.id, id));
  const result = await requestWithContacts(id);
  res.json(UpdateCollaborationRequestResponse.parse(jsonify(result)));
});

export default router;