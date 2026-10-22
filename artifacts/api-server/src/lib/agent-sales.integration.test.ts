import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool, usersTable, branchesTable, businessAgenciesTable, propertiesTable,
  agentPastSalesTable, auditLogTable, type User,
} from "@workspace/db";
import salesRouter from "../routes/agent-sales";
import { CreateAgentPastSaleResponse, GetAgentPastSalesResponse } from "@workspace/api-zod";
import { ensureAgentPastSalesTable, getAgentAgency, getAgentSalesHistory } from "./agent-sales";

test("past sales persist, enforce ownership, merge completed listings and recalculate medians", async () => {
  assert.notEqual(process.env.REPLIT_DEPLOYMENT, "1", "Never run this fixture test in production");
  await ensureAgentPastSalesTable();
  const token = crypto.randomUUID();
  const userIds: number[] = [];
  const branchIds: number[] = [];
  const agencyIds: number[] = [];
  let actor: User;
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.user = actor; next(); });
  app.use(salesRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, method = "GET", data?: unknown) => fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  try {
    const [agency] = await db.insert(businessAgenciesTable).values({ name: `Sales test ${token}` }).returning();
    agencyIds.push(agency.id);
    const [branch] = await db.insert(branchesTable).values({ name: "Main", agencyId: agency.id }).returning();
    branchIds.push(branch.id);
    for (const role of ["agent", "agent", "admin"]) {
      const [user] = await db.insert(usersTable).values({
        name: "Sales test fixture", email: `${token}-${userIds.length}@example.invalid`, role, branchId: branch.id,
      }).returning();
      userIds.push(user.id);
    }
    const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, userIds[0]));
    const [other] = await db.select().from(usersTable).where(eq(usersTable.id, userIds[1]));
    const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, userIds[2]));
    actor = agent;
    const path = `/agents/${agent.id}/past-sales`;
    const input = { title: "Three-bedroom home", suburb: "Highlands", city: "Harare", currency: "USD", salePrice: 100000, soldAt: "2024-02-29" };
    const invalid = await request(path, "POST", { ...input, soldAt: "2026-02-30" });
    assert.equal(invalid.status, 400);
    const negative = await request(path, "POST", { ...input, salePrice: 0 });
    assert.equal(negative.status, 400);
    const created = await request(path, "POST", { ...input, agentId: other.id });
    assert.equal(created.status, 201);
    const sale = CreateAgentPastSaleResponse.parse(await created.json());
    assert.equal(sale.source, "past_sale");
    assert.equal(sale.soldAt, input.soldAt);
    assert.equal((await getAgentSalesHistory(other.id)).sales.length, 0, "Cannot override ownership in the request body");
    const persisted = await request(path);
    assert.equal(persisted.status, 200);
    assert.deepEqual(GetAgentPastSalesResponse.parse(await persisted.json()).medians, [{ currency: "USD", medianPrice: 100000, saleCount: 1 }]);
    actor = other;
    for (const [suffix, method, data] of [
      ["", "GET", undefined], ["", "POST", input], [`/${sale.id}`, "PUT", input], [`/${sale.id}`, "DELETE", undefined],
    ] as const) {
      assert.equal((await request(`${path}${suffix}`, method, data)).status, 403, method);
    }
    assert.equal((await request(`/agents/${other.id}/past-sales/${sale.id}`, "DELETE")).status, 404);
    actor = admin;
    assert.equal((await request(`${path}/${sale.id}`, "PUT", { ...input, salePrice: 200000 })).status, 200);
    await db.insert(propertiesTable).values({
      reference: `TEST-SALES-${token}`, title: "Completed listing", address: "Test fixture",
      suburb: "Highlands", city: "Harare", price: 999999, propertyType: "house",
      salePrice: 400000, soldAt: new Date("2024-03-01"), currency: "USD",
      status: "sold", availabilityStatus: "sold", agentId: agent.id,
    });
    const combined = await getAgentSalesHistory(agent.id);
    assert.equal(combined.sales.length, 2);
    assert.deepEqual(combined.medians, [{ currency: "USD", medianPrice: 300000, saleCount: 2 }]);
    assert.deepEqual(await getAgentAgency(branch.id), { agencyId: agency.id, agencyName: agency.name });
    assert.equal(await getAgentAgency(null), null, "Never invent an agency when none is assigned");
    assert.equal((await request(`${path}/${sale.id}`, "DELETE")).status, 204);
    assert.deepEqual((await getAgentSalesHistory(agent.id)).medians, [{ currency: "USD", medianPrice: 400000, saleCount: 1 }]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (userIds.length) {
      await db.delete(auditLogTable).where(inArray(auditLogTable.userId, userIds));
      await db.delete(agentPastSalesTable).where(inArray(agentPastSalesTable.agentId, userIds));
      await db.delete(propertiesTable).where(inArray(propertiesTable.agentId, userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    }
    if (branchIds.length) await db.delete(branchesTable).where(inArray(branchesTable.id, branchIds));
    if (agencyIds.length) await db.delete(businessAgenciesTable).where(inArray(businessAgenciesTable.id, agencyIds));
    await pool.end();
  }
});
