import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import {
  CreatePropertyAlertBody,
  CreatePropertyAlertResponse,
  CreateSimilarPropertyAlertParams,
  CreateSimilarPropertyAlertResponse,
  DeletePropertyAlertParams,
  UpdatePropertyAlertBody,
  UpdatePropertyAlertParams,
  UpdatePropertyAlertResponse,
  UpdatePropertyAlertStatusBody,
  UpdatePropertyAlertStatusParams,
  UpdatePropertyAlertStatusResponse,
  ListPropertyAlertsResponse,
} from "@workspace/api-zod";
import { currentBuyer } from "./public";
import { jsonify } from "../lib/helpers";
import {
  createPropertyAlert,
  deletePropertyAlert,
  listPropertyAlerts,
  similarPropertyAlertInput,
  updatePropertyAlert,
  updatePropertyAlertStatus,
} from "../lib/property-alerts";

const router: IRouter = Router();
const PUBLIC_PROPERTY_STATUSES = ["public", "under_offer", "coming_soon"];

async function requireBuyer(req: Request, res: Response) {
  const user = await currentBuyer(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return null;
  }
  return user;
}

router.get("/public/property-alerts", async (req, res): Promise<void> => {
  const user = await requireBuyer(req, res);
  if (!user) return;
  res.json(ListPropertyAlertsResponse.parse(jsonify(await listPropertyAlerts(user.id))));
});

router.post("/public/property-alerts", async (req, res): Promise<void> => {
  const user = await requireBuyer(req, res);
  if (!user) return;
  const parsed = CreatePropertyAlertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const alert = await createPropertyAlert(user.id, parsed.data);
    res.status(201).json(CreatePropertyAlertResponse.parse(jsonify(alert)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid alert criteria" });
  }
});

router.patch("/public/property-alerts/:id", async (req, res): Promise<void> => {
  const user = await requireBuyer(req, res);
  if (!user) return;
  const params = UpdatePropertyAlertParams.safeParse(req.params);
  const parsed = UpdatePropertyAlertBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const alert = await updatePropertyAlert(user.id, params.data.id, parsed.data);
    if (!alert) {
      res.status(404).json({ error: "Property alert not found" });
      return;
    }
    res.json(UpdatePropertyAlertResponse.parse(jsonify(alert)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid alert criteria" });
  }
});

router.delete("/public/property-alerts/:id", async (req, res): Promise<void> => {
  const user = await requireBuyer(req, res);
  if (!user) return;
  const params = DeletePropertyAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await deletePropertyAlert(user.id, params.data.id);
  if (!deleted) {
    res.status(404).json({ error: "Property alert not found" });
    return;
  }
  res.status(204).send();
});

router.patch("/public/property-alerts/:id/status", async (req, res): Promise<void> => {
  const user = await requireBuyer(req, res);
  if (!user) return;
  const params = UpdatePropertyAlertStatusParams.safeParse(req.params);
  const parsed = UpdatePropertyAlertStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const alert = await updatePropertyAlertStatus(user.id, params.data.id, parsed.data.active);
  if (!alert) {
    res.status(404).json({ error: "Property alert not found" });
    return;
  }
  res.json(UpdatePropertyAlertStatusResponse.parse(jsonify(alert)));
});

router.post("/public/properties/:id/similar-alert", async (req, res): Promise<void> => {
  const user = await requireBuyer(req, res);
  if (!user) return;
  const params = CreateSimilarPropertyAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [property] = await db.select().from(propertiesTable).where(and(
    eq(propertiesTable.id, params.data.id),
    inArray(propertiesTable.status, PUBLIC_PROPERTY_STATUSES),
  ));
  if (!property) {
    res.status(404).json({ error: "Public property not found" });
    return;
  }
  const alert = await createPropertyAlert(user.id, similarPropertyAlertInput(property));
  res.status(201).json(CreateSimilarPropertyAlertResponse.parse(jsonify(alert)));
});

export default router;