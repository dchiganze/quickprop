import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lt, lte, count, sql } from "drizzle-orm";
import {
  db,
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
    throw error;
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Platform Stats
// ──────────────────────────────────────────────────────────────────────────────
router.get("/admin/platform-stats", adminOnly, async (_req, res): Promise<void> => {
  const [props, users, buyers, leads, branches] = await Promise.all([
    db.select().from(propertiesTable),
    db.select().from(usersTable),
    db.select().from(buyersTable),
    db.select().from(leadsTable),
    db.select().from(branchesTable),
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
      registeredAgencies: branches.length,
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
// Admin agencies list (branches + stats)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/admin/agencies", adminOnly, async (_req, res): Promise<void> => {
  const [branches, users, props, leads] = await Promise.all([
    db.select().from(branchesTable),
    db.select().from(usersTable),
    db.select().from(propertiesTable),
    db.select().from(leadsTable),
  ]);

  const result = branches.map((b) => {
    const agents = users.filter((u) => u.branchId === b.id);
    const branchProps = props.filter((p) => p.branchId === b.id);
    const agentIds = new Set(agents.map((a) => a.id));
    const branchLeads = leads.filter((l) => l.agentId != null && agentIds.has(l.agentId!));
    return {
      ...b,
      agentCount: agents.length,
      activeListings: branchProps.filter((p) => p.status === "public").length,
      totalListings: branchProps.length,
      totalLeads: branchLeads.length,
    };
  });

  res.json(jsonify(result));
});

export default router;
