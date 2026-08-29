import { Router, type IRouter } from "express";
import { eq, ilike, or, desc, count, sql } from "drizzle-orm";
import {
  db,
  propertiesTable,
  leadsTable,
  buyerRequestsTable,
  viewingsTable,
  tasksTable,
  activityTable,
  buyersTable,
  sellersTable,
  usersTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetCommandCentreResponse,
  GetDashboardChartsResponse,
  GetRecentActivityResponse,
  GetAnalyticsSummaryResponse,
  OfficeSearchQueryParams,
  OfficeSearchResponse,
} from "@workspace/api-zod";
import { parseSearchQuery } from "../lib/matching";
import { jsonify } from "../lib/helpers";
import { matchProperties } from "../lib/matching";

const router: IRouter = Router();

const ACTIVE = ["public", "internal_only", "coming_soon", "private_listing", "under_offer", "draft"];

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const props = await db.select().from(propertiesTable);
  const leads = await db.select().from(leadsTable);
  const requests = await db.select().from(buyerRequestsTable);
  const viewings = await db.select().from(viewingsTable);
  const tasks = await db.select().from(tasksTable);
  const today = new Date().toISOString().slice(0, 10);

  res.json(
    GetDashboardSummaryResponse.parse({
      activeMandates: props.filter((p) => ACTIVE.includes(p.status)).length,
      publicListings: props.filter((p) => p.status === "public").length,
      draftListings: props.filter((p) => p.status === "draft").length,
      propertiesSold: props.filter((p) => p.status === "sold").length,
      propertiesRented: props.filter((p) => p.status === "rented").length,
      newLeads: leads.filter((l) => l.stage === "new").length,
      buyerRequests: requests.filter((r) => r.status === "new" || r.status === "in_progress").length,
      viewingsToday: viewings.filter((v) => v.scheduledAt.toISOString().slice(0, 10) === today && v.status === "scheduled").length,
      offers: leads.filter((l) => l.stage === "offer_received" || l.stage === "negotiation").length,
      openTasks: tasks.filter((t) => t.status === "open").length,
    }),
  );
});

router.get("/dashboard/command-centre", async (_req, res): Promise<void> => {
  const props = await db.select().from(propertiesTable);
  const leads = await db.select().from(leadsTable);
  const requests = await db.select().from(buyerRequestsTable);
  const now = Date.now();
  const in30d = now + 30 * 24 * 3600 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 3600 * 1000;

  const awaitingPhotos = props.filter((p) => p.pipelineStage === "awaiting_photos").length;
  const expiring = props.filter((p) => {
    if (!p.mandateExpiry || !ACTIVE.includes(p.status)) return false;
    const t = Date.parse(p.mandateExpiry);
    return !Number.isNaN(t) && t > now && t < in30d;
  }).length;
  const missingBrochures = props.filter((p) => !p.hasBrochure && (p.status === "public" || p.pipelineStage === "published")).length;
  const newLeadsAwaiting = leads.filter((l) => l.stage === "new").length;

  let unmatched = 0;
  const openRequests = requests.filter((r) => r.status === "new" || r.status === "in_progress");
  for (const r of openRequests) {
    const m = matchProperties(
      { budgetMin: r.budgetMin, budgetMax: r.budgetMax, areas: r.areas, propertyType: r.propertyType },
      props,
    );
    if (m.length === 0) unmatched += 1;
  }

  const staleShares = props.filter(
    (p) => p.status === "public" && p.updatedAt.getTime() < fourteenDaysAgo,
  ).length;
  const priceReview = props.filter(
    (p) => ACTIVE.includes(p.status) && p.createdAt.getTime() < now - 90 * 24 * 3600 * 1000 && p.status !== "under_offer",
  ).length;

  const items = [
    { key: "mandates_expiring", label: "Mandates expiring in 30 days", count: expiring, severity: expiring > 10 ? "critical" : expiring > 0 ? "warning" : "info" },
    { key: "leads_awaiting_response", label: "New leads awaiting response", count: newLeadsAwaiting, severity: newLeadsAwaiting > 10 ? "critical" : newLeadsAwaiting > 0 ? "warning" : "info" },
    { key: "awaiting_photos", label: "Listings awaiting photos", count: awaitingPhotos, severity: awaitingPhotos > 0 ? "warning" : "info" },
    { key: "unmatched_requests", label: "Buyer demand without a match", count: unmatched, severity: unmatched > 5 ? "critical" : unmatched > 0 ? "warning" : "info" },
    { key: "missing_brochures", label: "Listings missing brochures", count: missingBrochures, severity: missingBrochures > 0 ? "warning" : "info" },
    { key: "price_review", label: "Price reductions recommended", count: priceReview, severity: priceReview > 0 ? "warning" : "info" },
    { key: "not_shared_recently", label: "Not shared in the last 14 days", count: staleShares, severity: staleShares > 0 ? "warning" : "info" },
  ];
  res.json(GetCommandCentreResponse.parse(jsonify(items)));
});

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

function lastMonths(n: number): { label: string; year: number; month: number }[] {
  const out: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ label: monthLabel(d), year: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

router.get("/dashboard/charts", async (_req, res): Promise<void> => {
  const props = await db.select().from(propertiesTable);
  const leads = await db.select().from(leadsTable);
  const users = await db.select().from(usersTable);
  const months = lastMonths(6);

  const newListingsByMonth = months.map((m) => ({
    label: m.label,
    value: props.filter((p) => p.createdAt.getFullYear() === m.year && p.createdAt.getMonth() === m.month).length,
  }));
  const salesByMonth = months.map((m) => ({
    label: m.label,
    value: props.filter((p) => p.status === "sold" && p.updatedAt.getFullYear() === m.year && p.updatedAt.getMonth() === m.month).length,
  }));

  const sourceCounts = new Map<string, number>();
  for (const l of leads) {
    const s = (l.source ?? "other").replace(/_/g, " ");
    sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1);
  }
  const leadSources = [...sourceCounts.entries()].map(([label, value]) => ({ label, value }));

  const suburbCounts = new Map<string, number>();
  for (const p of props) suburbCounts.set(p.suburb, (suburbCounts.get(p.suburb) ?? 0) + 1);
  const propertiesBySuburb = [...suburbCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  const agentCounts = new Map<string, number>();
  for (const p of props) {
    if (!p.agentId) continue;
    const agent = users.find((u) => u.id === p.agentId);
    if (!agent) continue;
    agentCounts.set(agent.name, (agentCounts.get(agent.name) ?? 0) + 1);
  }
  const topAgents = [...agentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));

  res.json(GetDashboardChartsResponse.parse(jsonify({ newListingsByMonth, leadSources, propertiesBySuburb, salesByMonth, topAgents })));
});

router.get("/activity/recent", async (_req, res): Promise<void> => {
  const rows = await db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(30);
  res.json(GetRecentActivityResponse.parse(jsonify(rows)));
});

router.get("/analytics/summary", async (_req, res): Promise<void> => {
  const props = await db.select().from(propertiesTable);
  const leads = await db.select().from(leadsTable);
  const months = lastMonths(6);

  let cumulative = 0;
  const inventoryGrowth = months.map((m) => {
    const monthEnd = new Date(m.year, m.month + 1, 1).getTime();
    cumulative = props.filter((p) => p.createdAt.getTime() < monthEnd).length;
    return { label: m.label, value: cumulative };
  });

  const completed = leads.filter((l) => l.stage === "completed").length;
  const leadConversionPercent = leads.length > 0 ? Math.round((completed / leads.length) * 1000) / 10 : 0;

  const soldProps = props.filter((p) => p.status === "sold" || p.status === "rented");
  const avgDaysOnMarket =
    soldProps.length > 0
      ? Math.round(
          soldProps.reduce((acc, p) => acc + (p.updatedAt.getTime() - p.createdAt.getTime()) / 86400000, 0) /
            soldProps.length,
        )
      : 0;

  const typeCounts = new Map<string, number>();
  for (const p of props) typeCounts.set(p.propertyType, (typeCounts.get(p.propertyType) ?? 0) + 1);
  const propertyTypes = [...typeCounts.entries()].map(([label, value]) => ({ label, value }));

  const suburbCounts = new Map<string, number>();
  for (const p of props) suburbCounts.set(p.suburb, (suburbCounts.get(p.suburb) ?? 0) + 1);
  const suburbs = [...suburbCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  const totals = {
    views: props.reduce((a, p) => a + p.views, 0),
    enquiries: props.reduce((a, p) => a + p.enquiries, 0),
    shares: props.reduce((a, p) => a + p.shares, 0),
    brochures: props.filter((p) => p.hasBrochure).length,
  };

  res.json(
    GetAnalyticsSummaryResponse.parse({
      inventoryGrowth,
      leadConversionPercent,
      avgDaysOnMarket,
      propertyTypes,
      suburbs,
      totals,
    }),
  );
});

router.get("/search", async (req, res): Promise<void> => {
  const q = OfficeSearchQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const parsed = parseSearchQuery(q.data.q);
  const props = await db.select().from(propertiesTable);
  const keyword = parsed.keywords.join(" ").toLowerCase();

  const properties = props
    .filter((p) => {
      if (parsed.minPrice != null && p.price < parsed.minPrice) return false;
      if (parsed.maxPrice != null && p.price > parsed.maxPrice) return false;
      if (parsed.propertyType && p.propertyType !== parsed.propertyType) return false;
      if (keyword) {
        const hay = `${p.title} ${p.reference} ${p.suburb} ${p.address ?? ""} ${p.description ?? ""} ${p.features.join(" ")}`.toLowerCase();
        const words = keyword.split(" ").filter(Boolean);
        return words.every((w) => hay.includes(w));
      }
      return true;
    })
    .slice(0, 25);

  let buyers: (typeof buyersTable.$inferSelect)[] = [];
  let sellers: (typeof sellersTable.$inferSelect)[] = [];
  let leadRows: (typeof leadsTable.$inferSelect)[] = [];
  if (keyword) {
    const pat = `%${keyword}%`;
    buyers = await db.select().from(buyersTable).where(or(ilike(buyersTable.name, pat), ilike(buyersTable.email, pat))).limit(10);
    sellers = await db.select().from(sellersTable).where(or(ilike(sellersTable.name, pat), ilike(sellersTable.email, pat))).limit(10);
    leadRows = await db.select().from(leadsTable).where(or(ilike(leadsTable.name, pat), ilike(leadsTable.email, pat))).limit(10);
  }

  res.json(
    OfficeSearchResponse.parse(
      jsonify({
        interpretation: parsed.interpretation,
        properties,
        buyers,
        sellers,
        leads: leadRows,
      }),
    ),
  );
});

export default router;
