import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { agencySettingsTable, db } from "@workspace/db";
import { requireRole } from "./auth";
import { jsonify } from "../lib/helpers";

const router: IRouter = Router();
const adminOnly = requireRole("principal", "admin", "quickprop_admin");

const DEFAULTS = {
  id: 1,
  agencyName: "QuickProp Real Estate",
  phone: "+263 242 123 456",
  email: "info@quickprop.co.zw",
  website: "https://quickprop.co.zw",
  logoUrl: null,
  primaryColor: "#10B981",
  newLeadAlerts: true,
  mandateExpiryAlerts: true,
  weeklyReport: true,
} as const;

async function getSettings() {
  const [row] = await db.select().from(agencySettingsTable).where(eq(agencySettingsTable.id, 1)).limit(1);
  return row ?? {
    ...DEFAULTS,
    updatedAt: new Date(),
  };
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

router.get("/admin/agency-settings", adminOnly, async (_req, res): Promise<void> => {
  res.json(jsonify(await getSettings()));
});

router.patch("/admin/agency-settings", adminOnly, async (req, res): Promise<void> => {
  const current = await getSettings();
  const body = req.body ?? {};
  const requestedColor = stringValue(body.primaryColor, current.primaryColor);
  const next = {
    agencyName: stringValue(body.agencyName, current.agencyName),
    phone: stringValue(body.phone, current.phone),
    email: stringValue(body.email, current.email),
    website: stringValue(body.website, current.website),
    logoUrl: body.logoUrl === null ? null : stringValue(body.logoUrl, current.logoUrl ?? ""),
    primaryColor: /^#[0-9A-Fa-f]{6}$/.test(requestedColor) ? requestedColor.toUpperCase() : current.primaryColor,
    newLeadAlerts: booleanValue(body.newLeadAlerts, current.newLeadAlerts),
    mandateExpiryAlerts: booleanValue(body.mandateExpiryAlerts, current.mandateExpiryAlerts),
    weeklyReport: booleanValue(body.weeklyReport, current.weeklyReport),
    updatedAt: new Date(),
  };
  const [row] = await db.insert(agencySettingsTable)
    .values({ id: 1, ...next })
    .onConflictDoUpdate({ target: agencySettingsTable.id, set: next })
    .returning();
  res.json(jsonify(row));
});

export default router;