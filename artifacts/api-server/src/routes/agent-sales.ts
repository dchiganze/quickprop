import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, agentPastSalesTable, usersTable, type User } from "@workspace/db";
import {
  CreateAgentPastSaleBody, UpdateAgentPastSaleBody, GetAgentPastSalesResponse,
  CreateAgentPastSaleResponse, UpdateAgentPastSaleResponse,
} from "@workspace/api-zod";
import { getAgentAgency, getAgentSalesHistory } from "../lib/agent-sales";
import { isPastSaleDate } from "../lib/agent-sales-summary";
import { logAudit } from "../lib/helpers";

const router: IRouter = Router();

async function authorizedAgent(req: Request, res: Response): Promise<User | null> {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid agent ID." }); return null;
  }
  const actor = res.locals.user as User;
  const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!agent || !["agent", "senior_agent", "principal", "admin"].includes(agent.role) || agent.status === "deleted") {
    res.status(404).json({ error: "Agent not found." }); return null;
  }
  if (actor.id === agent.id || actor.role === "admin") return agent;
  if (actor.role === "principal") {
    const [ownAgency, targetAgency] = await Promise.all([getAgentAgency(actor.branchId), getAgentAgency(agent.branchId)]);
    if (ownAgency && targetAgency && ownAgency.agencyId === targetAgency.agencyId) return agent;
  }
  res.status(403).json({ error: "You can only manage your own sales history." });
  return null;
}

function publicSale(row: typeof agentPastSalesTable.$inferSelect) {
  const { id, title, suburb, city, currency, salePrice, soldAt } = row;
  return { id, title, suburb, city, currency, salePrice, soldAt, source: "past_sale" as const, reference: `PAST-${id}` };
}

router.get("/agents/:id/past-sales", async (req, res): Promise<void> => {
  const agent = await authorizedAgent(req, res);
  if (!agent) return;
  res.json(GetAgentPastSalesResponse.parse(await getAgentSalesHistory(agent.id)));
});

router.post("/agents/:id/past-sales", async (req, res): Promise<void> => {
  const agent = await authorizedAgent(req, res);
  if (!agent) return;
  const parsed = CreateAgentPastSaleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a property description, suburb, city, currency, positive sale price and sale date." }); return; }
  const input = parsed.data;
  if (![input.title, input.suburb, input.city].every((value) => value.trim()) || !Number.isFinite(input.salePrice) || input.salePrice <= 0 || !isPastSaleDate(input.soldAt)) {
    res.status(400).json({ error: "Use a positive sale price and a valid sale date from 1900 through today. Property details cannot be blank." }); return;
  }
  const [row] = await db.insert(agentPastSalesTable).values({
    ...input, title: input.title.trim(), suburb: input.suburb.trim(), city: input.city.trim(), agentId: agent.id,
  }).returning();
  const actor = res.locals.user as User;
  await logAudit("created", "agent_past_sale", row.id, `Added past sale for ${agent.name}`, actor.id, actor.name);
  res.status(201).json(CreateAgentPastSaleResponse.parse(publicSale(row)));
});

router.put("/agents/:id/past-sales/:saleId", async (req, res): Promise<void> => {
  const agent = await authorizedAgent(req, res);
  if (!agent) return;
  const saleId = Number(req.params.saleId);
  const parsed = UpdateAgentPastSaleBody.safeParse(req.body);
  if (!Number.isSafeInteger(saleId) || saleId <= 0 || !parsed.success) {
    res.status(400).json({ error: "Invalid sale details." }); return;
  }
  const input = parsed.data;
  if (![input.title, input.suburb, input.city].every((value) => value.trim()) || !Number.isFinite(input.salePrice) || input.salePrice <= 0 || !isPastSaleDate(input.soldAt)) {
    res.status(400).json({ error: "Use a positive sale price and a valid sale date from 1900 through today. Property details cannot be blank." }); return;
  }
  const [row] = await db.update(agentPastSalesTable).set({
    ...input, title: input.title.trim(), suburb: input.suburb.trim(), city: input.city.trim(),
  }).where(and(eq(agentPastSalesTable.id, saleId), eq(agentPastSalesTable.agentId, agent.id))).returning();
  if (!row) { res.status(404).json({ error: "Past sale not found. QuickProp listing sales must be edited on the property." }); return; }
  const actor = res.locals.user as User;
  await logAudit("edited", "agent_past_sale", row.id, `Updated past sale for ${agent.name}`, actor.id, actor.name);
  res.json(UpdateAgentPastSaleResponse.parse(publicSale(row)));
});

router.delete("/agents/:id/past-sales/:saleId", async (req, res): Promise<void> => {
  const agent = await authorizedAgent(req, res);
  if (!agent) return;
  const saleId = Number(req.params.saleId);
  if (!Number.isSafeInteger(saleId) || saleId <= 0) { res.status(400).json({ error: "Invalid sale ID." }); return; }
  const [row] = await db.delete(agentPastSalesTable)
    .where(and(eq(agentPastSalesTable.id, saleId), eq(agentPastSalesTable.agentId, agent.id))).returning();
  if (!row) { res.status(404).json({ error: "Past sale not found." }); return; }
  const actor = res.locals.user as User;
  await logAudit("deleted", "agent_past_sale", row.id, `Removed past sale for ${agent.name}`, actor.id, actor.name);
  res.status(204).send();
});

export default router;
