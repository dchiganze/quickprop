import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lt, lte, count, sql, inArray } from "drizzle-orm";
import {
  db,
  businessAgenciesTable,
  usersTable,
  branchesTable,
  propertiesTable,
  leadsTable,
  buyersTable,
  activityTable,
  auditLogTable,
} from "@workspace/db";
import {
  ClearAdminPlatformDataBody,
  ClearAdminPlatformDataResponse,
  GetAdminPlatformDataCleanupPreviewResponse,
  GetAdminAgenciesResponse,
  CreateAdminAgencyBody,
  CreateAdminAgencyResponse,
  UpdateAdminAgencyBody,
  UpdateAdminAgencyResponse,
  ArchiveAdminAgencyResponse,
  CreateAdminAgencyBranchBody,
  CreateAdminAgencyBranchResponse,
  UpdateAdminAgencyBranchBody,
  UpdateAdminAgencyBranchResponse,
  ArchiveAdminAgencyBranchResponse,
  SetAdminBranchMembersBody,
  SetAdminBranchMembersResponse,
} from "@workspace/api-zod";
import { jsonify, logAudit, parseId } from "../lib/helpers";
import { requireRole, currentUser } from "./auth";
import {
  clearPlatformDashboardData,
  getPlatformCleanupPreview,
  PlatformCleanupSnapshotChangedError,
} from "../lib/platform-data-cleanup";

const router: IRouter = Router();

const adminOnly = requireRole("principal", "admin");

router.get("/admin/platform-data-cleanup/preview", adminOnly, async (_req, res): Promise<void> => {
  const preview = await getPlatformCleanupPreview();
  res.json(GetAdminPlatformDataCleanupPreviewResponse.parse(preview));
});

router.post("/admin/platform-data-cleanup", adminOnly, async (req, res): Promise<void> => {
  if (process.env.NODE_ENV !== "production") {
    res.status(403).json({ error: "Platform data cleanup is only enabled on the published production app." });
    return;
  }

  const parsed = ClearAdminPlatformDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.confirmation !== "DELETE ALL DASHBOARD DATA") {
    res.status(400).json({ error: "Type DELETE ALL DASHBOARD DATA exactly to continue." });
    return;
  }

  const actor = await currentUser(req);
  if (!actor) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const deletedCounts = await clearPlatformDashboardData(parsed.data.expectedCounts, {
      id: actor.id,
      name: actor.name,
    });
    const result = ClearAdminPlatformDataResponse.parse({
      deletedCounts,
      administratorAccountsPreserved: true,
      objectStorageFilesRetained: true,
    });
    req.log.info({ deletedCounts, adminUserId: actor.id }, "Administrator cleared platform dashboard data");
    res.json(result);
  } catch (error) {
    if (error instanceof PlatformCleanupSnapshotChangedError) {
      res.status(409).json({
        error: error.message,
        currentCounts: error.currentCounts,
      });
      return;
    }
    req.log.error({ err: error }, "Platform data cleanup failed");
    res.status(500).json({
      error: "Cleanup failed. Refresh the preview before trying again.",
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Platform Stats
// ──────────────────────────────────────────────────────────────────────────────
router.get("/admin/platform-stats", adminOnly, async (_req, res): Promise<void> => {
  const [props, users, buyers, leads, agencies] = await Promise.all([
    db.select().from(propertiesTable),
    db.select().from(usersTable),
    db.select().from(buyersTable),
    db.select().from(leadsTable),
    db.select().from(businessAgenciesTable),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const agents = users.filter((u) => ["agent", "senior_agent"].includes(u.role));
  const activeProps = props.filter((p) =>
    ["public", "under_offer", "internal_only", "coming_soon", "private_listing", "draft"].includes(p.status)
  );

  // Weekly active agents — those who appear in recent audit entries
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const recentAudit = await db
    .select({ userId: auditLogTable.userId })
    .from(auditLogTable)
    .where(gte(auditLogTable.createdAt, weekAgo));
  const weeklyActiveAgentIds = new Set(recentAudit.map((r) => r.userId).filter(Boolean));
  const weeklyActiveAgents = agents.filter((a) => weeklyActiveAgentIds.has(a.id)).length;

  const newLeadsToday = leads.filter((l) => l.createdAt >= today).length;
  const openLeads = leads.filter((l) =>
    ["new", "attempted_contact", "viewing_booked"].includes(l.stage)
  ).length;

  const propsToday = props.filter((p) => p.createdAt >= today).length;

  res.json(
    jsonify({
      activeProperties: activeProps.length,
      totalProperties: props.length,
      propertiesToday: propsToday,
      propertiesSold: props.filter((p) => p.status === "sold").length,
      propertiesRented: props.filter((p) => p.status === "rented").length,
      registeredBuyers: buyers.length,
      registeredAgencies: agencies.filter((agency) => agency.status === "active").length,
      registeredAgents: agents.length,
      weeklyActiveAgents,
      newLeadsToday,
      openLeads,
      avgResponseTimeHours: null,
      marketplaceCoveragePercent: Math.min(
        100,
        Math.round((activeProps.filter((p) => p.status === "public").length / Math.max(1, activeProps.length)) * 100)
      ),
    })
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Platform Charts
// ──────────────────────────────────────────────────────────────────────────────
function lastMonths(n: number) {
  const out: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return out;
}

router.get("/admin/platform-charts", adminOnly, async (_req, res): Promise<void> => {
  const [props, leads, buyers] = await Promise.all([
    db.select().from(propertiesTable),
    db.select().from(leadsTable),
    db.select().from(buyersTable),
  ]);

  const months = lastMonths(6);

  const uploadsPerMonth = months.map((m) => ({
    label: m.label,
    value: props.filter(
      (p) => p.createdAt.getFullYear() === m.year && p.createdAt.getMonth() === m.month
    ).length,
  }));

  const leadsPerMonth = months.map((m) => ({
    label: m.label,
    value: leads.filter(
      (l) => l.createdAt.getFullYear() === m.year && l.createdAt.getMonth() === m.month
    ).length,
  }));

  const buyerRegistrations = months.map((m) => ({
    label: m.label,
    value: buyers.filter(
      (b) => b.createdAt.getFullYear() === m.year && b.createdAt.getMonth() === m.month
    ).length,
  }));

  const stageCounts = new Map<string, number>();
  for (const l of leads) stageCounts.set(l.stage, (stageCounts.get(l.stage) ?? 0) + 1);
  const leadsByStage = [...stageCounts.entries()].map(([label, value]) => ({ label, value }));

  const typeCounts = new Map<string, number>();
  for (const p of props) typeCounts.set(p.propertyType, (typeCounts.get(p.propertyType) ?? 0) + 1);
  const propertiesByType = [...typeCounts.entries()].map(([label, value]) => ({ label, value }));

  res.json(jsonify({ uploadsPerMonth, leadsPerMonth, buyerRegistrations, leadsByStage, propertiesByType }));
});

// ──────────────────────────────────────────────────────────────────────────────
// Coverage (city + suburb)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/admin/coverage", adminOnly, async (_req, res): Promise<void> => {
  const props = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.status, "public"));

  const cityCounts = new Map<string, number>();
  const suburbCounts = new Map<string, number>();
  const suburbCity = new Map<string, string>();

  for (const p of props) {
    cityCounts.set(p.city, (cityCounts.get(p.city) ?? 0) + 1);
    suburbCounts.set(p.suburb, (suburbCounts.get(p.suburb) ?? 0) + 1);
    suburbCity.set(p.suburb, p.city);
  }

  const cities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([city, actual]) => ({ city, actual }));

  const suburbs = [...suburbCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([suburb, actual]) => ({
      suburb,
      city: suburbCity.get(suburb) ?? "",
      actual,
    }));

  res.json(jsonify({ cities, suburbs }));
});

// ──────────────────────────────────────────────────────────────────────────────
// Freshness dashboard
// ──────────────────────────────────────────────────────────────────────────────
router.get("/admin/freshness", adminOnly, async (_req, res): Promise<void> => {
  const props = await db
    .select()
    .from(propertiesTable)
    .where(
      sql`${propertiesTable.status} IN ('public','internal_only','coming_soon','private_listing','under_offer','draft')`
    );

  const now = Date.now();
  const d30 = now - 30 * 24 * 3600 * 1000;
  const d60 = now - 60 * 24 * 3600 * 1000;
  const d90 = now - 90 * 24 * 3600 * 1000;

  function entry(p: (typeof props)[number]) {
    return {
      id: p.id,
      reference: p.reference,
      title: p.title,
      suburb: p.suburb,
      city: p.city,
      agentId: p.agentId,
      status: p.status,
      daysStale: Math.floor((now - p.updatedAt.getTime()) / 86400000),
      updatedAt: p.updatedAt,
    };
  }

  const stale30 = props.filter((p) => p.updatedAt.getTime() < d30 && p.updatedAt.getTime() >= d60).map(entry);
  const stale60 = props.filter((p) => p.updatedAt.getTime() < d60 && p.updatedAt.getTime() >= d90).map(entry);
  const stale90 = props.filter((p) => p.updatedAt.getTime() < d90).map(entry);

  res.json(jsonify({ stale30, stale60, stale90 }));
});

// ──────────────────────────────────────────────────────────────────────────────
// Moderate a listing
// ──────────────────────────────────────────────────────────────────────────────
router.patch("/admin/properties/:id/moderate", adminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const { action } = req.body as { action: string; reason?: string };
  const actor = await currentUser(req);

  const statusMap: Record<string, string> = {
    approve: "public",
    hide: "archived",
    expire: "withdrawn",
    restore: "draft",
  };

  const newStatus = statusMap[action];
  if (!newStatus && action !== "flag") {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  if (action === "flag") {
    await logAudit("flagged", "property", id, `Admin flagged property #${id}`, actor?.id, actor?.name);
    res.json({ ok: true });
    return;
  }

  const [row] = await db
    .update(propertiesTable)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(propertiesTable.id, id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  await logAudit(action, "property", id, `Admin ${action}d property #${id} — ${row.title}`, actor?.id, actor?.name);
  res.json(jsonify(row));
});

// ──────────────────────────────────────────────────────────────────────────────
// Admin agents list (users with agent roles + stats)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/admin/agents", adminOnly, async (_req, res): Promise<void> => {
  const [users, props, leads, branches] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(propertiesTable),
    db.select().from(leadsTable),
    db.select().from(branchesTable),
  ]);

  const agents = users.filter((u) => ["agent", "senior_agent", "principal"].includes(u.role));

  const result = agents.map((a) => {
    const { password: _pw, ...agentData } = a;
    const branch = branches.find((b) => b.id === a.branchId);
    const agentProps = props.filter((p) => p.agentId === a.id);
    const agentLeads = leads.filter((l) => l.agentId === a.id);
    return {
      ...agentData,
      branchName: branch?.name ?? null,
      activeListings: agentProps.filter((p) => p.status === "public").length,
      totalListings: agentProps.length,
      totalLeads: agentLeads.length,
      openLeads: agentLeads.filter((l) => ["new", "attempted_contact", "viewing_booked"].includes(l.stage)).length,
    };
  });

  res.json(jsonify(result));
});

// ──────────────────────────────────────────────────────────────────────────────
// Agency, branch and team management
// ──────────────────────────────────────────────────────────────────────────────
async function loadAdminAgencySnapshot() {
  const [agencies, branches, users, properties, leads] = await Promise.all([
    db.select().from(businessAgenciesTable).orderBy(businessAgenciesTable.name),
    db.select().from(branchesTable).orderBy(branchesTable.name),
    db.select().from(usersTable).orderBy(usersTable.name),
    db.select().from(propertiesTable),
    db.select().from(leadsTable),
  ]);

  const agents = users.filter((user) => ["agent", "senior_agent"].includes(user.role));
  const agencyBranches = branches.map((branch) => {
    const members = agents
      .filter((agent) => agent.branchId === branch.id)
      .map(({ id, name, email, phone, role, status, branchId }) => ({
        id, name, email, phone, role, status, branchId,
      }));
    const memberIds = new Set(members.map((member) => member.id));
    const branchProperties = properties.filter((property) => property.branchId === branch.id);
    const branchLeads = leads.filter((lead) => lead.agentId != null && memberIds.has(lead.agentId));

    return {
      ...branch,
      members,
      agentCount: members.length,
      activeListings: branchProperties.filter((property) => property.status === "public").length,
      totalListings: branchProperties.length,
      totalLeads: branchLeads.length,
    };
  });

  const response = {
    agencies: agencies.map((agency) => {
      const nestedBranches = agencyBranches.filter((branch) => branch.agencyId === agency.id);
      return {
        ...agency,
        branches: nestedBranches,
        branchCount: nestedBranches.length,
        teamCount: nestedBranches.reduce((total, branch) => total + branch.agentCount, 0),
        activeListings: nestedBranches.reduce((total, branch) => total + branch.activeListings, 0),
        totalListings: nestedBranches.reduce((total, branch) => total + branch.totalListings, 0),
        totalLeads: nestedBranches.reduce((total, branch) => total + branch.totalLeads, 0),
      };
    }),
    unassignedBranches: agencyBranches.filter((branch) => branch.agencyId == null),
  };

  return GetAdminAgenciesResponse.parse(jsonify(response));
}

async function findAdminAgency(agencyId: number) {
  const snapshot = await loadAdminAgencySnapshot();
  return snapshot.agencies.find((agency) => agency.id === agencyId) ?? null;
}

async function findAdminBranch(branchId: number) {
  const snapshot = await loadAdminAgencySnapshot();
  for (const agency of snapshot.agencies) {
    const branch = agency.branches.find((item) => item.id === branchId);
    if (branch) return branch;
  }
  return snapshot.unassignedBranches.find((branch) => branch.id === branchId) ?? null;
}

function cleanOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

router.get("/admin/agencies", adminOnly, async (_req, res): Promise<void> => {
  res.json(await loadAdminAgencySnapshot());
});

router.post("/admin/agencies", adminOnly, async (req, res): Promise<void> => {
  const parsed = CreateAdminAgencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const actor = await currentUser(req);
  const body = parsed.data;
  const [agency] = await db.insert(businessAgenciesTable).values({
    name: body.name.trim(),
    logoUrl: cleanOptionalText(body.logoUrl),
    email: cleanOptionalText(body.email)?.toLowerCase() ?? null,
    phone: cleanOptionalText(body.phone),
    website: cleanOptionalText(body.website),
    aboutText: body.aboutText?.trim() ?? "",
  }).returning();

  await logAudit("created", "business_agency", agency.id, `Created agency ${agency.name}`, actor?.id, actor?.name);
  const result = await findAdminAgency(agency.id);
  res.status(201).json(CreateAdminAgencyResponse.parse(jsonify(result)));
});

router.patch("/admin/agencies/:id", adminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateAdminAgencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const patch = parsed.data;
  const update: Partial<typeof businessAgenciesTable.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.logoUrl !== undefined) update.logoUrl = cleanOptionalText(patch.logoUrl);
  if (patch.email !== undefined) update.email = cleanOptionalText(patch.email)?.toLowerCase() ?? null;
  if (patch.phone !== undefined) update.phone = cleanOptionalText(patch.phone);
  if (patch.website !== undefined) update.website = cleanOptionalText(patch.website);
  if (patch.aboutText !== undefined) update.aboutText = patch.aboutText.trim();
  if (patch.status !== undefined) update.status = patch.status;

  const [agency] = await db.update(businessAgenciesTable)
    .set(update)
    .where(eq(businessAgenciesTable.id, id))
    .returning();
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }

  const actor = await currentUser(req);
  await logAudit("edited", "business_agency", id, `Updated agency ${agency.name}`, actor?.id, actor?.name);
  const result = await findAdminAgency(id);
  res.json(UpdateAdminAgencyResponse.parse(jsonify(result)));
});

router.delete("/admin/agencies/:id", adminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const [agency] = await db.update(businessAgenciesTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(businessAgenciesTable.id, id))
    .returning();
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }

  const actor = await currentUser(req);
  await logAudit("archived", "business_agency", id, `Archived agency ${agency.name}`, actor?.id, actor?.name);
  res.json(ArchiveAdminAgencyResponse.parse(jsonify(await findAdminAgency(id))));
});

router.post("/admin/agencies/:agencyId/branches", adminOnly, async (req, res): Promise<void> => {
  const agencyId = Number(req.params.agencyId);
  if (!Number.isSafeInteger(agencyId) || agencyId < 1) {
    res.status(400).json({ error: "Invalid agency ID" });
    return;
  }
  const parsed = CreateAdminAgencyBranchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agency] = await db.select().from(businessAgenciesTable)
    .where(eq(businessAgenciesTable.id, agencyId)).limit(1);
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  if (agency.status !== "active") {
    res.status(409).json({ error: "Restore this agency before adding branches." });
    return;
  }

  const body = parsed.data;
  const [branch] = await db.insert(branchesTable).values({
    agencyId,
    name: body.name.trim(),
    address: cleanOptionalText(body.address) ?? null,
    phone: cleanOptionalText(body.phone) ?? null,
  }).returning();
  const actor = await currentUser(req);
  await logAudit("created", "branch", branch.id, `Added ${branch.name} to ${agency.name}`, actor?.id, actor?.name);
  const result = await findAdminBranch(branch.id);
  res.status(201).json(CreateAdminAgencyBranchResponse.parse(jsonify(result)));
});

router.patch("/admin/branches/:id", adminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = UpdateAdminAgencyBranchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patch = parsed.data;

  if (patch.agencyId != null) {
    const [agency] = await db.select().from(businessAgenciesTable)
      .where(eq(businessAgenciesTable.id, patch.agencyId)).limit(1);
    if (!agency) {
      res.status(404).json({ error: "Destination agency not found" });
      return;
    }
    if (agency.status !== "active") {
      res.status(409).json({ error: "Branches can only be assigned to an active agency." });
      return;
    }
  }

  const update: Partial<typeof branchesTable.$inferInsert> = {};
  if (patch.agencyId !== undefined) update.agencyId = patch.agencyId;
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.address !== undefined) update.address = cleanOptionalText(patch.address);
  if (patch.phone !== undefined) update.phone = cleanOptionalText(patch.phone);
  if (patch.status !== undefined) update.status = patch.status;

  const [branch] = await db.update(branchesTable)
    .set(update)
    .where(eq(branchesTable.id, id))
    .returning();
  if (!branch) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }

  const actor = await currentUser(req);
  await logAudit("edited", "branch", id, `Updated branch ${branch.name}`, actor?.id, actor?.name);
  res.json(UpdateAdminAgencyBranchResponse.parse(jsonify(await findAdminBranch(id))));
});

router.delete("/admin/branches/:id", adminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const [branch] = await db.update(branchesTable)
    .set({ status: "archived" })
    .where(eq(branchesTable.id, id))
    .returning();
  if (!branch) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }

  const actor = await currentUser(req);
  await logAudit("archived", "branch", id, `Archived branch ${branch.name}`, actor?.id, actor?.name);
  res.json(ArchiveAdminAgencyBranchResponse.parse(jsonify(await findAdminBranch(id))));
});

router.put("/admin/branches/:id/members", adminOnly, async (req, res): Promise<void> => {
  const id = parseId(req);
  const parsed = SetAdminBranchMembersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const requestedIds = [...new Set(parsed.data.userIds)];

  const outcome = await db.transaction(async (tx) => {
    const [branch] = await tx.select().from(branchesTable)
      .where(eq(branchesTable.id, id)).limit(1);
    if (!branch) return { kind: "missing" as const };
    if (branch.status !== "active") return { kind: "archived-branch" as const };

    if (branch.agencyId != null) {
      const [agency] = await tx.select().from(businessAgenciesTable)
        .where(eq(businessAgenciesTable.id, branch.agencyId)).limit(1);
      if (!agency || agency.status !== "active") return { kind: "archived-agency" as const };
    }

    const requestedUsers = requestedIds.length
      ? await tx.select().from(usersTable).where(inArray(usersTable.id, requestedIds))
      : [];
    if (requestedUsers.length !== requestedIds.length ||
        requestedUsers.some((user) => !["agent", "senior_agent"].includes(user.role))) {
      return { kind: "invalid-members" as const };
    }

    await tx.update(usersTable)
      .set({ branchId: null })
      .where(and(
        eq(usersTable.branchId, id),
        inArray(usersTable.role, ["agent", "senior_agent"]),
      ));
    if (requestedIds.length) {
      await tx.update(usersTable)
        .set({ branchId: id })
        .where(inArray(usersTable.id, requestedIds));
    }

    return {
      kind: "updated" as const,
      users: requestedUsers.map((user) => ({ ...user, branchId: id })),
    };
  });

  if (outcome.kind === "missing") {
    res.status(404).json({ error: "Branch not found" });
    return;
  }
  if (outcome.kind === "archived-branch" || outcome.kind === "archived-agency") {
    res.status(409).json({ error: "Restore the branch and its agency before changing team assignments." });
    return;
  }
  if (outcome.kind === "invalid-members") {
    res.status(400).json({ error: "Only existing agent or senior agent accounts can be assigned to a branch." });
    return;
  }

  const actor = await currentUser(req);
  await logAudit("edited", "branch", id, `Updated team membership for branch ${id}`, actor?.id, actor?.name);
  const members = outcome.users.map(({ id: userId, name, email, phone, role, status, branchId }) => ({
    id: userId, name, email, phone, role, status, branchId,
  }));
  res.json(SetAdminBranchMembersResponse.parse(jsonify(members)));
});

export default router;
