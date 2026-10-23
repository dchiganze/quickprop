/**
 * Temporary, uniquely named development fixtures for real two-agent QA.
 * Run with the workspace tsx executable; run again with "cleanup" afterwards.
 * Credentials exist only in a mode-0600 file in /tmp, never source control.
 */
import { randomUUID, randomBytes } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  db, pool, usersTable, branchesTable, propertiesTable,
  collaborationMatchRequestsTable, notificationsTable, auditLogTable,
} from "@workspace/db";
import { hashPassword } from "../lib/passwords";

const path = "/tmp/quickprop-collaboration-qa.json";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Development fixtures must never run in production.");
  if (process.argv.includes("cleanup")) {
    const fixture = JSON.parse(await readFile(path, "utf8"));
    await db.transaction(async tx => {
      const ids = fixture.agents.map((agent: { id: number }) => agent.id);
      const rows = await tx.select({ name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, ids));
      if (rows.some(row => !row.name.startsWith(fixture.prefix))) throw new Error("Fixture ownership mismatch.");
      await tx.delete(collaborationMatchRequestsTable).where(or(
        inArray(collaborationMatchRequestsTable.propertyId, fixture.properties.map((p: { id: number }) => p.id)),
        inArray(collaborationMatchRequestsTable.requesterId, ids),
      ));
      await tx.delete(notificationsTable).where(inArray(notificationsTable.userId, ids));
      await tx.delete(auditLogTable).where(inArray(auditLogTable.userId, ids));
      await tx.delete(propertiesTable).where(and(
        eq(propertiesTable.branchId, fixture.branchId),
        inArray(propertiesTable.id, fixture.properties.map((p: { id: number }) => p.id)),
      ));
      await tx.delete(usersTable).where(inArray(usersTable.id, ids));
      await tx.delete(branchesTable).where(eq(branchesTable.id, fixture.branchId));
    });
    await unlink(path);
    console.log("Removed only collaboration QA fixture records.");
    return;
  }
  try { await readFile(path); throw new Error("Clean up the previous collaboration QA fixtures first."); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const suffix = randomUUID().slice(0, 8);
  const prefix = `Collaboration QA ${suffix}`;
  await db.transaction(async tx => {
    const [branch] = await tx.insert(branchesTable).values({ name: prefix, status: "active" }).returning();
    const agents: Array<{
      id: number; name: string; email: string; phone: string | null;
      password: string; role: string; branchId: number;
    }> = [];
    for (const [index, role] of ["Requester", "Owner", "Observer"].entries()) {
      const password = randomBytes(24).toString("base64url");
      const [agent] = await tx.insert(usersTable).values({
        name: `${prefix} ${role}`, email: `collaboration-${role.toLowerCase()}-${suffix}@example.invalid`,
        password: await hashPassword(password), phone: `+26377000000${index + 1}`,
        role: "agent", branchId: branch.id, status: "active",
      }).returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone });
      agents.push({ ...agent, password, role, branchId: branch.id });
    }
    const properties = await tx.insert(propertiesTable).values(["Accept", "Decline"].map(label => ({
      reference: `QA-${suffix}-${label}`, title: `${prefix} ${label} property`,
      status: "public", pipelineStage: "published", agentId: agents[1].id, branchId: branch.id,
      propertyType: "house", listingType: "sale", price: 100000, suburb: prefix, city: "Harare",
      photos: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"],
      collaborationEnabled: true,
    }))).returning({ id: propertiesTable.id, title: propertiesTable.title, reference: propertiesTable.reference });
    await writeFile(path, JSON.stringify({ prefix, branchId: branch.id, agents, properties }), { mode: 0o600 });
  });
  console.log(`Created temporary collaboration QA fixtures; private credentials at ${path}.`);
}

main().catch(() => { console.error("Collaboration QA setup/cleanup failed; no credentials logged."); process.exitCode = 1; })
  .finally(() => pool.end());
