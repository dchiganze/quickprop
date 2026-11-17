import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, count, desc, eq, gte, inArray, or } from "drizzle-orm";
import {
  CancelAgentNetworkSubmissionResponse,
  ConfirmAgentNetworkSubmissionBody,
  ConfirmAgentNetworkSubmissionResponse,
  CreateAgentNetworkSubmissionBody,
  CreateAgentNetworkSubmissionResponse,
  ListAgentNetworkMatchesResponse,
  ListAgentNetworkSubmissionsResponse,
  RespondToAgentNetworkMatchBody,
  RespondToAgentNetworkMatchResponse,
  UpdateAgentNetworkListingSharingBody,
  UpdateAgentNetworkListingSharingResponse,
} from "@workspace/api-zod";
import {
  agentNetworkMatchesTable,
  agentNetworkRequirementsTable,
  agentNetworkSubmissionsTable,
  branchesTable,
  businessAgenciesTable,
  db,
  propertiesTable,
  usersTable,
  type AgentNetworkAttachment,
  type AgentNetworkExtraction,
} from "@workspace/db";
import { currentUser } from "./auth";
import { getPrivateObjectDownloadUrl } from "./storage";
import { extractAgentNetworkSubmission } from "../lib/agent-network-extraction";
import {
  DEFAULT_NETWORK_MATCH_WEIGHTS,
  matchNetworkListings,
  matchNetworkRequirements,
  type NetworkListing,
  type NetworkRequirement,
} from "../lib/agent-network-matching";
import { jsonify, logAudit } from "../lib/helpers";

const router: IRouter = Router();
const MAX_SUBMISSION_FILES = 5;
const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTIONS_PER_HOUR = 12;
const ALLOWED_EXTENSIONS = new Set([
  ".aac", ".csv", ".docx", ".jpeg", ".jpg", ".m4a", ".mp3", ".ogg", ".pdf",
  ".png", ".txt", ".wav", ".webm", ".xls", ".xlsx",
]);
const IMAGE_EXTENSIONS = new Set([".jpeg", ".jpg", ".png"]);
const NETWORK_AGENT_ROLES = new Set(["agent", "senior_agent", "principal"]);

type UserForNetwork = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
type SubmissionItem = AgentNetworkExtraction["items"][number] & {
  recordType?: "property" | "buyer_requirement";
  recordId?: number;
  networkEnabled?: boolean;
};

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

async function activeNetworkAgentIds(agentIds: number[]): Promise<Set<number>> {
  const uniqueIds = [...new Set(agentIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!uniqueIds.length) return new Set();
  const rows = await db.select({ id: usersTable.id })
    .from(usersTable)
    .innerJoin(branchesTable, eq(branchesTable.id, usersTable.branchId))
    .innerJoin(businessAgenciesTable, eq(businessAgenciesTable.id, branchesTable.agencyId))
    .where(and(
      inArray(usersTable.id, uniqueIds),
      eq(usersTable.status, "active"),
      inArray(usersTable.role, [...NETWORK_AGENT_ROLES]),
      eq(branchesTable.status, "active"),
      eq(businessAgenciesTable.status, "active"),
    ));
  return new Set(rows.map((row) => row.id));
}

async function getNetworkUser(req: Request, res: Response): Promise<UserForNetwork | null> {
  const user = await currentUser(req);
  if (!user) {
    sendError(res, 401, "Sign in to use the Agent Network.");
    return null;
  }
  if (
    user.status !== "active" ||
    !NETWORK_AGENT_ROLES.has(user.role) ||
    !user.branchId
  ) {
    sendError(res, 403, "An active agent assigned to an agency branch is required.");
    return null;
  }
  if (!(await activeNetworkAgentIds([user.id])).has(user.id)) {
    sendError(res, 403, "Your agency branch is inactive. Contact your agency administrator.");
    return null;
  }
  return user;
}

function textValue(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,$\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function integerValue(value: unknown): number | null {
  const number = numberValue(value);
  return number != null && Number.isInteger(number) ? number : null;
}

function stringArray(value: unknown, maxItems = 24): string[] {
  return Array.isArray(value)
    ? value.map((item) => textValue(item, 120)).filter((item): item is string => Boolean(item)).slice(0, maxItems)
    : [];
}

function networkListing(property: typeof propertiesTable.$inferSelect): NetworkListing {
  return {
    id: property.id,
    title: property.title,
    propertyType: property.propertyType,
    listingType: property.listingType,
    suburb: property.suburb,
    city: property.city,
    price: property.price,
    currency: property.currency,
    bedrooms: property.bedrooms,
    features: property.features,
    description: property.description,
  };
}

function networkRequirement(
  requirement: typeof agentNetworkRequirementsTable.$inferSelect,
): NetworkRequirement {
  return {
    id: requirement.id,
    propertyType: requirement.propertyType,
    listingType: requirement.listingType,
    areas: requirement.areas,
    budgetMin: requirement.budgetMin,
    budgetMax: requirement.budgetMax,
    bedroomsMin: requirement.bedroomsMin,
    bedroomsMax: requirement.bedroomsMax,
    requiredFeatures: requirement.requiredFeatures,
    preferredFeatures: requirement.preferredFeatures,
    otherPreferences: requirement.otherPreferences,
  };
}

function activeListingCondition() {
  return and(
    eq(propertiesTable.networkEnabled, true),
    eq(propertiesTable.availabilityStatus, "available"),
    inArray(propertiesTable.status, ["draft", "internal_only", "public", "private_listing"]),
  );
}

async function createNetworkMatchesForRequirement(
  requirement: typeof agentNetworkRequirementsTable.$inferSelect,
) {
  const candidates = await db.select().from(propertiesTable).where(activeListingCondition());
  const activeAgents = await activeNetworkAgentIds(candidates.map((property) => property.agentId ?? 0));
  const properties = candidates.filter((property) => property.agentId != null && activeAgents.has(property.agentId));
  const scored = matchNetworkListings(networkRequirement(requirement), properties.map(networkListing));
  const matches = [];
  for (const match of scored) {
    const property = properties.find((item) => item.id === match.propertyId);
    if (!property?.agentId || property.agentId === requirement.agentId) continue;
    const [row] = await db.insert(agentNetworkMatchesTable).values({
      propertyId: property.id,
      requirementId: requirement.id,
      listingAgentId: property.agentId,
      buyerAgentId: requirement.agentId,
      matchPercent: match.matchPercent,
      category: match.category,
      reasons: match.reasons,
    }).onConflictDoUpdate({
      target: [agentNetworkMatchesTable.propertyId, agentNetworkMatchesTable.requirementId],
      set: {
        matchPercent: match.matchPercent,
        category: match.category,
        reasons: match.reasons,
        updatedAt: new Date(),
      },
    }).returning();
    matches.push(row);
  }
  return matches;
}

async function createNetworkMatchesForListing(
  property: typeof propertiesTable.$inferSelect,
) {
  const candidates = await db.select().from(agentNetworkRequirementsTable);
  const activeAgents = await activeNetworkAgentIds(candidates.map((requirement) => requirement.agentId));
  const requirements = candidates.filter((requirement) => activeAgents.has(requirement.agentId));
  const scored = matchNetworkRequirements(networkListing(property), requirements.map(networkRequirement));
  const matches = [];
  for (const match of scored) {
    const requirement = requirements.find((item) => item.id === match.requirementId);
    if (!property.agentId || !requirement?.agentId || property.agentId === requirement.agentId) continue;
    const [row] = await db.insert(agentNetworkMatchesTable).values({
      propertyId: property.id,
      requirementId: requirement.id,
      listingAgentId: property.agentId,
      buyerAgentId: requirement.agentId,
      matchPercent: match.matchPercent,
      category: match.category,
      reasons: match.reasons,
    }).onConflictDoUpdate({
      target: [agentNetworkMatchesTable.propertyId, agentNetworkMatchesTable.requirementId],
      set: {
        matchPercent: match.matchPercent,
        category: match.category,
        reasons: match.reasons,
        updatedAt: new Date(),
      },
    }).returning();
    matches.push(row);
  }
  return matches;
}

function photoPaths(
  attachments: AgentNetworkAttachment[],
  rawPhotoIndexes: unknown,
): string[] {
  const indexes = Array.isArray(rawPhotoIndexes)
    ? rawPhotoIndexes.map(integerValue).filter((value): value is number => value != null)
    : [];
  return [...new Set(indexes)]
    .map((index) => attachments[index])
    .filter((file): file is AgentNetworkAttachment => Boolean(file && IMAGE_EXTENSIONS.has(extname(file.fileName).toLowerCase())))
    .map((file) => `/api/storage${file.storagePath}`);
}

function isValidPropertyData(data: Record<string, unknown>): string | null {
  if (!textValue(data.title, 160)) return "Add a listing title before saving.";
  if (!textValue(data.propertyType, 80)) return "Choose the property type before saving.";
  if (data.listingType !== "sale" && data.listingType !== "rent") return "Choose sale or rent before saving.";
  const price = numberValue(data.price);
  if (price == null || price <= 0) return "Enter a price greater than zero before saving.";
  if (!textValue(data.suburb, 120) || !textValue(data.city, 120)) return "Add both suburb and city before saving.";
  return null;
}

function isValidRequirementData(data: Record<string, unknown>): string | null {
  if (!textValue(data.propertyType, 80)) return "Add the property type before saving this buyer requirement.";
  if (data.listingType !== "sale" && data.listingType !== "rent") return "Choose whether the buyer wants to buy or rent.";
  if (!stringArray(data.areas).length) return "Add at least one preferred area before saving.";
  if (numberValue(data.budgetMin) != null && numberValue(data.budgetMax) != null
    && numberValue(data.budgetMin)! > numberValue(data.budgetMax)!) {
    return "The minimum budget cannot be greater than the maximum.";
  }
  return null;
}

async function networkMatchViews(user: UserForNetwork) {
  const rows = await db.select({
    match: agentNetworkMatchesTable,
    property: propertiesTable,
    requirement: agentNetworkRequirementsTable,
  }).from(agentNetworkMatchesTable)
    .innerJoin(propertiesTable, eq(propertiesTable.id, agentNetworkMatchesTable.propertyId))
    .innerJoin(agentNetworkRequirementsTable, eq(agentNetworkRequirementsTable.id, agentNetworkMatchesTable.requirementId))
    .where(and(
      or(
        eq(agentNetworkMatchesTable.listingAgentId, user.id),
        eq(agentNetworkMatchesTable.buyerAgentId, user.id),
      ),
      activeListingCondition(),
    ))
    .orderBy(desc(agentNetworkMatchesTable.updatedAt))
    .limit(200);

  const agentIds = [...new Set(rows.flatMap(({ match }) => [match.listingAgentId, match.buyerAgentId]))];
  const activeAgents = await activeNetworkAgentIds(agentIds);
  const visibleRows = rows.filter(({ match }) =>
    activeAgents.has(match.listingAgentId) && activeAgents.has(match.buyerAgentId),
  );
  const visibleAgentIds = [...new Set(visibleRows.flatMap(({ match }) => [match.listingAgentId, match.buyerAgentId]))];
  const agents = visibleAgentIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, visibleAgentIds))
    : [];
  const branchIds = [...new Set(agents.map((agent) => agent.branchId).filter((value): value is number => value != null))];
  const branches = branchIds.length
    ? await db.select().from(branchesTable).where(inArray(branchesTable.id, branchIds))
    : [];
  const agencyIds = [...new Set(branches.map((branch) => branch.agencyId).filter((value): value is number => value != null))];
  const agencies = agencyIds.length
    ? await db.select().from(businessAgenciesTable).where(inArray(businessAgenciesTable.id, agencyIds))
    : [];
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const agencyNameForAgent = (agentId: number) => {
    const agent = agentById.get(agentId);
    const branch = branches.find((item) => item.id === agent?.branchId);
    return agencies.find((agency) => agency.id === branch?.agencyId)?.name ?? "QuickProp agency";
  };
  const agentContact = (agentId: number) => {
    const agent = agentById.get(agentId);
    return {
      name: agent?.name ?? "QuickProp agent",
      agencyName: agencyNameForAgent(agentId),
      email: agent?.email ?? null,
      phone: agent?.phone ?? null,
    };
  };

  return visibleRows.map(({ match, property, requirement }) => {
    const contactReleased = match.status === "accepted"
      && match.listingAgentInterested
      && match.buyerAgentInterested;
    const isListingAgent = match.listingAgentId === user.id;
    const otherAgentId = isListingAgent ? match.buyerAgentId : match.listingAgentId;
    return {
      id: match.id,
      propertyId: property.id,
      requirementId: requirement.id,
      matchPercent: match.matchPercent,
      category: match.category,
      reasons: match.reasons,
      status: match.status,
      listingAgentInterested: match.listingAgentInterested,
      buyerAgentInterested: match.buyerAgentInterested,
      contactReleased,
      listing: {
        id: property.id,
        reference: property.reference,
        title: property.title,
        propertyType: property.propertyType,
        listingType: property.listingType,
        price: property.price,
        currency: property.currency,
        suburb: property.suburb,
        city: property.city,
        bedrooms: property.bedrooms,
        features: property.features,
          photos: property.photos,
        agencyName: agencyNameForAgent(match.listingAgentId),
        agentName: contactReleased ? agentById.get(match.listingAgentId)?.name ?? "QuickProp agent" : "Network agent",
      },
      requirementSummary: {
        propertyType: requirement.propertyType,
        listingType: requirement.listingType,
        areas: requirement.areas,
        budgetMin: requirement.budgetMin,
        budgetMax: requirement.budgetMax,
        currency: requirement.currency,
        bedroomsMin: requirement.bedroomsMin,
        bedroomsMax: requirement.bedroomsMax,
        requiredFeatures: requirement.requiredFeatures,
        preferredFeatures: requirement.preferredFeatures,
      },
      ...(contactReleased ? {
        otherAgent: agentContact(otherAgentId),
        buyerContact: {
          name: requirement.buyerName,
          email: requirement.email,
          phone: requirement.phone,
        },
      } : {}),
    };
  });
}

router.get("/agent-network/submissions", async (req, res): Promise<void> => {
  const user = await getNetworkUser(req, res);
  if (!user) return;
  const rows = await db.select().from(agentNetworkSubmissionsTable)
    .where(eq(agentNetworkSubmissionsTable.agentId, user.id))
    .orderBy(desc(agentNetworkSubmissionsTable.createdAt))
    .limit(100);
  const propertyIds = [...new Set(rows.flatMap((row) => {
    const items = ((row.extraction as AgentNetworkExtraction | null)?.items ?? []) as SubmissionItem[];
    return items.flatMap((item) => item.recordType === "property" && item.recordId ? [item.recordId] : []);
  }))];
  const properties = propertyIds.length
    ? await db.select({ id: propertiesTable.id, networkEnabled: propertiesTable.networkEnabled })
      .from(propertiesTable)
      .where(and(eq(propertiesTable.agentId, user.id), inArray(propertiesTable.id, propertyIds)))
    : [];
  const networkEnabledById = new Map(properties.map((property) => [property.id, property.networkEnabled]));
  const enriched = rows.map((row) => {
    const extraction = row.extraction as AgentNetworkExtraction | null;
    if (!extraction?.items) return row;
    return {
      ...row,
      extraction: {
        ...extraction,
        items: extraction.items.map((item) => {
          const stored = item as SubmissionItem;
          return stored.recordType === "property" && stored.recordId
            ? { ...stored, networkEnabled: networkEnabledById.get(stored.recordId) ?? false }
            : stored;
        }),
      },
    };
  });
  res.json(ListAgentNetworkSubmissionsResponse.parse(jsonify(enriched)));
});

router.post("/agent-network/submissions", async (req, res): Promise<void> => {
  const user = await getNetworkUser(req, res);
  if (!user) return;
  const parsed = CreateAgentNetworkSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "Add a message or one or more supported files.");
    return;
  }
  const message = textValue(parsed.data.message, 12_000) ?? "";
  const attachments = (parsed.data.attachments ?? []) as AgentNetworkAttachment[];
  if (!message && !attachments.length) {
    sendError(res, 400, "Add a message or attach at least one file.");
    return;
  }
  if (attachments.length > MAX_SUBMISSION_FILES || attachments.some((file) =>
    !file.storagePath.startsWith(`/objects/uploads/${user.id}/`)
    || !ALLOWED_EXTENSIONS.has(extname(file.fileName).toLowerCase())
  )) {
    sendError(res, 400, "Use up to five supported files uploaded from this agent account.");
    return;
  }
  const totalBytes = attachments.reduce((total, file) => total + file.sizeBytes, 0);
  if (totalBytes > MAX_SUBMISSION_BYTES) {
    sendError(res, 400, "The combined file size must be less than 25 MB.");
    return;
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentCount] = await db.select({ count: count() })
    .from(agentNetworkSubmissionsTable)
    .where(and(
      eq(agentNetworkSubmissionsTable.agentId, user.id),
      gte(agentNetworkSubmissionsTable.createdAt, hourAgo),
    ));
  if ((recentCount?.count ?? 0) >= MAX_EXTRACTIONS_PER_HOUR) {
    sendError(res, 429, "You have reached the AI message limit. Please try again in an hour.");
    return;
  }
  const [submission] = await db.insert(agentNetworkSubmissionsTable).values({
    agentId: user.id,
    branchId: user.branchId,
    sourceText: message,
    attachments,
    status: "processing",
  }).returning();
  try {
    const files = await Promise.all(attachments.map(async (file) => {
      if (file.sizeBytes < 1 || file.sizeBytes > MAX_SUBMISSION_BYTES) {
        throw new Error(`${file.fileName} is outside the supported file size limit.`);
      }
      const response = await fetch(await getPrivateObjectDownloadUrl(file.storagePath), {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Could not read ${file.fileName} from secure storage.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > MAX_SUBMISSION_BYTES) {
        throw new Error(`${file.fileName} exceeds the supported file size limit.`);
      }
      return { fileName: file.fileName, contentType: file.contentType, bytes };
    }));
    const extraction = await extractAgentNetworkSubmission({ message, files });
    const [row] = await db.update(agentNetworkSubmissionsTable).set({
      extraction,
      status: "needs_review",
      updatedAt: new Date(),
    }).where(and(
      eq(agentNetworkSubmissionsTable.id, submission.id),
      eq(agentNetworkSubmissionsTable.agentId, user.id),
    )).returning();
    await logAudit("agent_network_submission_created", "agent_network_submission", row.id, `Reviewed ${extraction.items.length} extracted network item(s)`, user.id, user.name);
    res.status(201).json(CreateAgentNetworkSubmissionResponse.parse(jsonify(row)));
  } catch (error) {
    await db.update(agentNetworkSubmissionsTable).set({
      status: "failed",
      updatedAt: new Date(),
    }).where(and(
      eq(agentNetworkSubmissionsTable.id, submission.id),
      eq(agentNetworkSubmissionsTable.agentId, user.id),
    ));
    req.log.error({ err: error, userId: user.id }, "Agent Network message extraction failed");
    sendError(
      res,
      503,
      error instanceof Error ? error.message : "Could not read this message. Please try again.",
    );
  }
});

router.post("/agent-network/submissions/:id/confirm", async (req, res): Promise<void> => {
  const user = await getNetworkUser(req, res);
  if (!user) return;
  const id = Number(req.params.id);
  const parsed = ConfirmAgentNetworkSubmissionBody.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
    sendError(res, 400, "Review the extracted details and try again.");
    return;
  }
  const itemIndex = parsed.success ? parsed.data.itemIndex ?? 0 : -1;
  if (!Number.isSafeInteger(itemIndex) || itemIndex < 0 || itemIndex > 39) {
    sendError(res, 400, "Choose a valid extracted item.");
    return;
  }
  const data = parsed.data.data as Record<string, unknown>;
  const validationError = parsed.data.recordType === "property"
    ? isValidPropertyData(data)
    : isValidRequirementData(data);
  if (validationError) {
    sendError(res, 400, validationError);
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [submission] = await tx.select().from(agentNetworkSubmissionsTable)
        .where(and(
          eq(agentNetworkSubmissionsTable.id, id),
          eq(agentNetworkSubmissionsTable.agentId, user.id),
        ))
        .for("update");
      if (!submission || submission.status === "cancelled") return null;
      const extraction = submission.extraction as AgentNetworkExtraction | null;
      const items = extraction?.items as SubmissionItem[] | undefined;
      const item = items?.[itemIndex];
      if (!item || (item.intent !== "unknown" && item.intent !== parsed.data.recordType)) {
        return { invalidItem: true as const };
      }
      if (item.reviewStatus === "confirmed" && item.recordId) {
        return {
          submission,
          recordType: item.recordType ?? parsed.data.recordType,
          recordId: item.recordId,
          matches: [],
          idempotent: true,
        };
      }

      let recordId: number;
      let matches: typeof agentNetworkMatchesTable.$inferSelect[] = [];
      if (parsed.data.recordType === "property") {
        if (!user.branchId) return { missingBranch: true as const };
        const photos = photoPaths(submission.attachments, data.photos);
        const [created] = await tx.insert(propertiesTable).values({
          reference: `pending-${randomUUID()}`,
          title: textValue(data.title, 160)!,
          description: textValue(data.description, 5000),
          propertyType: textValue(data.propertyType, 80)!,
          listingType: data.listingType === "rent" ? "rent" : "sale",
          status: "draft",
          pipelineStage: "draft",
          availabilityStatus: "available",
          price: numberValue(data.price)!,
          currency: (textValue(data.currency, 3) ?? "USD").toUpperCase(),
          suburb: textValue(data.suburb, 120)!,
          city: textValue(data.city, 120)!,
          bedrooms: integerValue(data.bedrooms),
          bathrooms: integerValue(data.bathrooms),
          parking: integerValue(data.parking),
          landSize: numberValue(data.landSize),
          buildingSize: numberValue(data.buildingSize),
          features: stringArray(data.features),
          photos,
          coverImage: photos[0] ?? null,
          agentId: user.id,
          branchId: user.branchId,
          networkEnabled: parsed.data.shareWithNetwork ?? false,
          updatedAt: new Date(),
        }).returning();
        const reference = `QP-${String(created.id).padStart(4, "0")}`;
        const [withReference] = await tx.update(propertiesTable).set({ reference })
          .where(eq(propertiesTable.id, created.id)).returning();
        recordId = created.id;
        if (parsed.data.shareWithNetwork) {
          // Matching is calculated after the submission transaction commits.
          matches = [];
        }
        item.recordType = "property";
        item.intent = "property";
        item.recordId = recordId;
        item.reviewStatus = "confirmed";
        item.networkEnabled = withReference.networkEnabled;
        extraction!.items[itemIndex] = item;
        const allReviewed = extraction!.items.every((entry) => entry.reviewStatus !== "needs_review");
        const [updated] = await tx.update(agentNetworkSubmissionsTable).set({
          extraction,
          status: allReviewed ? "confirmed" : "needs_review",
          propertyId: withReference.id,
          confirmedAt: allReviewed ? new Date() : null,
          updatedAt: new Date(),
        }).where(eq(agentNetworkSubmissionsTable.id, id)).returning();
        return { submission: updated, recordType: "property" as const, recordId, matches, networkEnabled: withReference.networkEnabled };
      }

      const [requirement] = await tx.insert(agentNetworkRequirementsTable).values({
        agentId: user.id,
        branchId: user.branchId,
        sourceSubmissionId: submission.id,
        buyerName: textValue(data.buyerName, 160),
        phone: textValue(data.phone, 80),
        email: textValue(data.email, 254),
        requestText: submission.sourceText || JSON.stringify(data),
        propertyType: textValue(data.propertyType, 80),
        listingType: data.listingType === "rent" ? "rent" : "sale",
        budgetMin: numberValue(data.budgetMin),
        budgetMax: numberValue(data.budgetMax),
        currency: (textValue(data.currency, 3) ?? "USD").toUpperCase(),
        areas: stringArray(data.areas),
        bedroomsMin: integerValue(data.bedroomsMin),
        bedroomsMax: integerValue(data.bedroomsMax),
        requiredFeatures: stringArray(data.requiredFeatures),
        preferredFeatures: stringArray(data.preferredFeatures),
        otherPreferences: stringArray(data.otherPreferences),
        financing: textValue(data.financing, 120),
        urgency: textValue(data.urgency, 120),
      }).returning();
      recordId = requirement.id;
      item.recordType = "buyer_requirement";
      item.intent = "buyer_requirement";
      item.recordId = recordId;
      item.reviewStatus = "confirmed";
      extraction!.items[itemIndex] = item;
      const allReviewed = extraction!.items.every((entry) => entry.reviewStatus !== "needs_review");
      const [updated] = await tx.update(agentNetworkSubmissionsTable).set({
        extraction,
        status: allReviewed ? "confirmed" : "needs_review",
        requirementId: requirement.id,
        confirmedAt: allReviewed ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(agentNetworkSubmissionsTable.id, id)).returning();
      return { submission: updated, recordType: "buyer_requirement" as const, recordId, matches, requirement };
    });

    if (!result) {
      sendError(res, 404, "Submission not found for this agent.");
      return;
    }
    if ("invalidItem" in result) {
      sendError(res, 400, "This item needs clarification before it can be saved.");
      return;
    }
    if ("missingBranch" in result) {
      sendError(res, 409, "Assign this agent to an active agency branch before saving a listing.");
      return;
    }
    if (!result.idempotent && result.recordType === "property" && "networkEnabled" in result && result.networkEnabled) {
      const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, result.recordId));
      if (property) result.matches = await createNetworkMatchesForListing(property);
    }
    if (
      !result.idempotent &&
      result.recordType === "buyer_requirement" &&
      "requirement" in result &&
      result.requirement
    ) {
      result.matches = await createNetworkMatchesForRequirement(result.requirement);
    }
    await logAudit(
      "agent_network_submission_confirmed",
      result.recordType === "property" ? "property" : "agent_network_requirement",
      result.recordId,
      `Confirmed an Agent Network ${result.recordType === "property" ? "listing" : "buyer requirement"}`,
      user.id,
      user.name,
    );
    res.json(ConfirmAgentNetworkSubmissionResponse.parse(jsonify({
      submission: result.submission,
      recordType: result.recordType,
      recordId: result.recordId,
      matches: await networkMatchViews(user).then((views) => {
        const matchedIds = (result.matches as Array<{ id: number }>).map((match) => match.id);
        return views.filter((view) => matchedIds.includes(view.id));
      }),
    })));
  } catch (error) {
    req.log.error({ err: error, userId: user.id, submissionId: id }, "Agent Network confirmation failed");
    sendError(res, 500, "Could not save this reviewed item. Nothing was confirmed; please try again.");
  }
});

router.post("/agent-network/submissions/:id/cancel", async (req, res): Promise<void> => {
  const user = await getNetworkUser(req, res);
  if (!user) return;
  const id = Number(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [submission] = await tx.select().from(agentNetworkSubmissionsTable)
      .where(and(
        eq(agentNetworkSubmissionsTable.id, id),
        eq(agentNetworkSubmissionsTable.agentId, user.id),
        inArray(agentNetworkSubmissionsTable.status, ["needs_review", "failed"]),
      ))
      .for("update");
    if (!submission) return null;
    const extraction = submission.extraction as AgentNetworkExtraction | null;
    if (extraction?.items) {
      extraction.items = extraction.items.map((item) => item.reviewStatus === "needs_review"
        ? { ...item, reviewStatus: "skipped" }
        : item);
    }
    const hasConfirmedRecord = extraction?.items.some((item) => item.reviewStatus === "confirmed") ?? false;
    const [updated] = await tx.update(agentNetworkSubmissionsTable).set({
      extraction,
      status: hasConfirmedRecord ? "confirmed" : "cancelled",
      confirmedAt: hasConfirmedRecord ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(agentNetworkSubmissionsTable.id, id)).returning();
    return updated;
  });
  if (!row) {
    sendError(res, 404, "Submission not found or already confirmed.");
    return;
  }
  res.json(CancelAgentNetworkSubmissionResponse.parse(jsonify(row)));
});

router.patch("/agent-network/listings/:id/sharing", async (req, res): Promise<void> => {
  const user = await getNetworkUser(req, res);
  if (!user) return;
  const id = Number(req.params.id);
  const parsed = UpdateAgentNetworkListingSharingBody.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
    sendError(res, 400, "Choose whether this listing is shared with the network.");
    return;
  }
  const [property] = await db.update(propertiesTable)
    .set({ networkEnabled: parsed.data.enabled, updatedAt: new Date() })
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.agentId, user.id)))
    .returning();
  if (!property) {
    sendError(res, 404, "Only the listing's assigned agent can change network sharing.");
    return;
  }
  const matches = property.networkEnabled
    && property.availabilityStatus === "available"
    ? await createNetworkMatchesForListing(property)
    : [];
  await logAudit(
    "agent_network_listing_sharing_updated",
    "property",
    property.id,
    property.networkEnabled ? "Agent opted the listing into Agent Network sharing" : "Agent removed the listing from Agent Network sharing",
    user.id,
    user.name,
  );
  const views = await networkMatchViews(user);
  res.json(UpdateAgentNetworkListingSharingResponse.parse(jsonify({
    propertyId: property.id,
    networkEnabled: property.networkEnabled,
    matches: views.filter((view) => matches.some((match) => match.id === view.id)),
  })));
});

router.get("/agent-network/matches", async (req, res): Promise<void> => {
  const user = await getNetworkUser(req, res);
  if (!user) return;
  res.json(ListAgentNetworkMatchesResponse.parse(jsonify(await networkMatchViews(user))));
});

router.post("/agent-network/matches/:id/interest", async (req, res): Promise<void> => {
  const user = await getNetworkUser(req, res);
  if (!user) return;
  const id = Number(req.params.id);
  const parsed = RespondToAgentNetworkMatchBody.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
    sendError(res, 400, "Choose whether you are interested in this match.");
    return;
  }
  const match = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(agentNetworkMatchesTable)
      .where(and(
        eq(agentNetworkMatchesTable.id, id),
        or(
          eq(agentNetworkMatchesTable.listingAgentId, user.id),
          eq(agentNetworkMatchesTable.buyerAgentId, user.id),
        ),
      ))
      .for("update");
    if (!current) return null;
    if (current.status !== "open") return current;
    const isListingAgent = current.listingAgentId === user.id;
    const values = isListingAgent
      ? { listingAgentInterested: parsed.data.interested, listingAgentRespondedAt: new Date() }
      : { buyerAgentInterested: parsed.data.interested, buyerAgentRespondedAt: new Date() };
    const listingInterested = isListingAgent ? parsed.data.interested : current.listingAgentInterested;
    const buyerInterested = isListingAgent ? current.buyerAgentInterested : parsed.data.interested;
    const status = !parsed.data.interested
      ? "declined"
      : listingInterested && buyerInterested
        ? "accepted"
        : "open";
    const [updated] = await tx.update(agentNetworkMatchesTable).set({
      ...values,
      status,
      introducedAt: status === "accepted" ? new Date() : current.introducedAt,
      updatedAt: new Date(),
    }).where(eq(agentNetworkMatchesTable.id, id)).returning();
    return updated;
  });
  if (!match) {
    sendError(res, 404, "Match not found for this agent.");
    return;
  }
  await logAudit(
    "agent_network_match_interest",
    "agent_network_match",
    match.id,
    parsed.data.interested ? "Agent expressed interest in a private network match" : "Agent declined a private network match",
    user.id,
    user.name,
  );
  const view = (await networkMatchViews(user)).find((item) => item.id === match.id);
  if (!view) {
    sendError(res, 404, "This match is no longer available.");
    return;
  }
  res.json(RespondToAgentNetworkMatchResponse.parse(jsonify(view)));
});

export default router;
