import { and, eq, or, desc } from "drizzle-orm";
import { db, pool, agentPastSalesTable, branchesTable, businessAgenciesTable, propertiesTable } from "@workspace/db";
import { medianSalePrices } from "./agent-sales-summary";

/** Additive, restart-safe provisioning for existing installations. */
export async function ensureAgentPastSalesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_past_sales (
      id serial PRIMARY KEY,
      agent_id integer NOT NULL REFERENCES users(id),
      title text NOT NULL,
      suburb text NOT NULL,
      city text NOT NULL,
      currency text NOT NULL,
      sale_price double precision NOT NULL CHECK (sale_price > 0),
      sold_at date NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS agent_past_sales_agent_idx ON agent_past_sales(agent_id);
  `);
}

export async function getAgentAgency(branchId: number | null) {
  if (!branchId) return null;
  const [row] = await db.select({ agencyId: businessAgenciesTable.id, agencyName: businessAgenciesTable.name })
    .from(branchesTable)
    .innerJoin(businessAgenciesTable, eq(branchesTable.agencyId, businessAgenciesTable.id))
    .where(eq(branchesTable.id, branchId));
  return row ?? null;
}

export async function getAgentSalesHistory(agentId: number) {
  const [past, listings] = await Promise.all([
    db.select().from(agentPastSalesTable).where(eq(agentPastSalesTable.agentId, agentId)).orderBy(desc(agentPastSalesTable.soldAt)),
    db.select({
      id: propertiesTable.id, reference: propertiesTable.reference, title: propertiesTable.title,
      suburb: propertiesTable.suburb, city: propertiesTable.city, currency: propertiesTable.currency,
      salePrice: propertiesTable.salePrice, soldAt: propertiesTable.soldAt,
    }).from(propertiesTable).where(and(
      eq(propertiesTable.agentId, agentId),
      or(eq(propertiesTable.availabilityStatus, "sold"), eq(propertiesTable.status, "sold")),
    )),
  ]);
  const sales = [
    ...past.map(({ id, title, suburb, city, currency, salePrice, soldAt }) => ({
      id, reference: `PAST-${id}`, title, suburb, city, currency, salePrice, soldAt, source: "past_sale" as const,
    })),
    ...listings.map((sale) => ({
      ...sale, soldAt: sale.soldAt?.toISOString() ?? null, source: "listing" as const,
    })),
  ].sort((a, b) => (b.soldAt ?? "").localeCompare(a.soldAt ?? "") || b.id - a.id);
  return { sales, medians: medianSalePrices(sales) };
}
