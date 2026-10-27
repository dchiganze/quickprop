import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  DeleteAgentSearchAlertParams,
  ListAgentSearchAlertsResponse,
  MarkAgentSearchAlertMatchesSeenBody,
  MarkAgentSearchAlertMatchesSeenParams,
  UpsertAgentSearchAlertBody,
  UpsertAgentSearchAlertParams,
  UpsertAgentSearchAlertResponse,
} from "@workspace/api-zod";
import {
  db,
  propertyAlertNotificationsTable,
  propertyAlertsTable,
  type PropertyAlert,
} from "@workspace/db";
import { currentUser } from "./auth";
import { jsonify } from "../lib/helpers";

const router: IRouter = Router();

function toAlertType(alert: PropertyAlert): string | null {
  if (alert.propertyTypes.length) return alert.propertyTypes[0];
  return alert.transactionType === "any" ? null : alert.transactionType;
}

async function serializeAgentAlerts(alerts: PropertyAlert[]) {
  if (!alerts.length) return [];
  const alertIds = alerts.map((alert) => alert.id);
  const matches = await db.select({
    alertId: propertyAlertNotificationsTable.alertId,
    propertyId: propertyAlertNotificationsTable.propertyId,
    viewedAt: propertyAlertNotificationsTable.viewedAt,
  }).from(propertyAlertNotificationsTable)
    .where(inArray(propertyAlertNotificationsTable.alertId, alertIds));
  const seenByAlert = new Map<number, string[]>();
  for (const match of matches) {
    if (match.viewedAt == null) continue;
    const seen = seenByAlert.get(match.alertId) ?? [];
    seen.push(String(match.propertyId));
    seenByAlert.set(match.alertId, seen);
  }
  return alerts.map((alert) => ({
    id: alert.clientId!,
    name: alert.name,
    type: toAlertType(alert),
    suburb: alert.suburbs[0] ?? null,
    minBedrooms: alert.minBedrooms,
    maxPrice: alert.maxPrice,
    currency: alert.currency,
    features: alert.requiredAmenities,
    seenPropertyIds: seenByAlert.get(alert.id) ?? [],
    createdAt: alert.createdAt.toISOString(),
  }));
}

router.get("/agent/search-alerts", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const rows = await db.select().from(propertyAlertsTable)
    .where(eq(propertyAlertsTable.userId, user.id))
    .orderBy(desc(propertyAlertsTable.createdAt));
  const agentAlerts = rows.filter((alert) => alert.clientId != null && alert.notificationChannels.includes("push"));
  res.json(ListAgentSearchAlertsResponse.parse(jsonify(await serializeAgentAlerts(agentAlerts))));
});

router.put("/agent/search-alerts/:clientId", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const params = UpsertAgentSearchAlertParams.safeParse(req.params);
  const parsed = UpsertAgentSearchAlertBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message ?? "Invalid search alert" });
    return;
  }

  const input = parsed.data;
  const propertyType = input.type && !["sale", "rent"].includes(input.type) ? input.type : null;
  const transactionType = input.type === "sale" || input.type === "rent" ? input.type : "any";
  const values = {
    userId: user.id,
    clientId: params.data.clientId,
    name: input.name.trim(),
    currency: input.currency?.trim() || null,
    transactionType,
    propertyTypes: propertyType ? [propertyType] : [],
    cities: [],
    suburbs: input.suburb?.trim() ? [input.suburb.trim()] : [],
    minPrice: null,
    maxPrice: input.maxPrice,
    minBedrooms: input.minBedrooms,
    minBathrooms: null,
    requiredAmenities: input.features.map((feature) => feature.trim()).filter(Boolean),
    preferredAmenities: [],
    furnishedPreference: "any",
    parkingPreference: "any",
    petsPreference: "any",
    powerPreference: "any",
    waterPreference: "any",
    notificationFrequency: "immediately",
    notificationChannels: ["in_app", "push"],
    active: true,
    sourcePropertyId: null,
    updatedAt: new Date(),
  };
  const [alert] = await db.insert(propertyAlertsTable).values(values)
    .onConflictDoUpdate({
      target: [propertyAlertsTable.userId, propertyAlertsTable.clientId],
      set: {
        name: values.name,
        currency: values.currency,
        transactionType: values.transactionType,
        propertyTypes: values.propertyTypes,
        cities: values.cities,
        suburbs: values.suburbs,
        minPrice: values.minPrice,
        maxPrice: values.maxPrice,
        minBedrooms: values.minBedrooms,
        minBathrooms: values.minBathrooms,
        requiredAmenities: values.requiredAmenities,
        preferredAmenities: values.preferredAmenities,
        notificationFrequency: values.notificationFrequency,
        notificationChannels: values.notificationChannels,
        active: values.active,
        updatedAt: values.updatedAt,
      },
    })
    .returning();
  const [serialized] = await serializeAgentAlerts([alert]);
  res.json(UpsertAgentSearchAlertResponse.parse(jsonify(serialized)));
});

router.delete("/agent/search-alerts/:clientId", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const params = DeleteAgentSearchAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(propertyAlertsTable).where(and(
    eq(propertyAlertsTable.userId, user.id),
    eq(propertyAlertsTable.clientId, params.data.clientId),
  ));
  res.status(204).send();
});

router.post("/agent/search-alerts/:clientId/seen", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const params = MarkAgentSearchAlertMatchesSeenParams.safeParse(req.params);
  const parsed = MarkAgentSearchAlertMatchesSeenBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message ?? "Invalid match list" });
    return;
  }
  const [alert] = await db.select({ id: propertyAlertsTable.id }).from(propertyAlertsTable)
    .where(and(
      eq(propertyAlertsTable.userId, user.id),
      eq(propertyAlertsTable.clientId, params.data.clientId),
    ));
  if (!alert) {
    res.status(404).json({ error: "Search alert not found" });
    return;
  }
  if (parsed.data.propertyIds.length) {
    await db.update(propertyAlertNotificationsTable).set({ viewedAt: new Date() })
      .where(and(
        eq(propertyAlertNotificationsTable.alertId, alert.id),
        eq(propertyAlertNotificationsTable.userId, user.id),
        inArray(propertyAlertNotificationsTable.propertyId, parsed.data.propertyIds),
      ));
  }
  res.status(204).send();
});

export default router;
