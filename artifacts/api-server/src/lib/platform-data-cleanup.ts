import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export interface PlatformCleanupCounts {
  properties: number;
  agents: number;
  buyers: number;
  agencies: number;
  branches: number;
  leads: number;
  demoBuyerLogins: number;
}

const countsQuery = sql`
  SELECT
    (SELECT count(*)::int FROM properties) AS properties,
    (SELECT count(*)::int FROM users WHERE role IN ('agent', 'senior_agent')) AS agents,
    (SELECT count(*)::int FROM buyers) AS buyers,
    (SELECT count(*)::int FROM business_agencies) AS agencies,
    (SELECT count(*)::int FROM branches) AS branches,
    (SELECT count(*)::int FROM leads) AS leads,
    (SELECT count(*)::int FROM users WHERE lower(email) = 'buyer.demo@quickprop.co.zw') AS demo_buyer_logins
`;

function countsFromRows(rows: readonly unknown[]): PlatformCleanupCounts {
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error("The cleanup preview query returned no result.");

  return {
    properties: Number(row.properties),
    agents: Number(row.agents),
    buyers: Number(row.buyers),
    agencies: Number(row.agencies),
    branches: Number(row.branches),
    leads: Number(row.leads),
    demoBuyerLogins: Number(row.demo_buyer_logins),
  };
}

function idsFromRows(rows: readonly unknown[]): number[] {
  return rows
    .map((row) => Number((row as { id: unknown }).id))
    .filter((id) => Number.isSafeInteger(id));
}

function intArray(values: readonly number[]) {
  if (values.length === 0) return sql`ARRAY[]::int[]`;
  return sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::int[]`;
}

export class PlatformCleanupSnapshotChangedError extends Error {
  constructor(readonly currentCounts: PlatformCleanupCounts) {
    super("Platform data changed after the cleanup preview. Review the updated counts before continuing.");
    this.name = "PlatformCleanupSnapshotChangedError";
  }
}

export async function getPlatformCleanupPreview() {
  const result = await db.execute(countsQuery);
  return {
    environment: process.env.NODE_ENV === "production" ? "production" as const : "development" as const,
    counts: countsFromRows(result.rows),
  };
}

export async function clearPlatformDashboardData(
  expectedCounts: PlatformCleanupCounts,
  actor: { id: number; name: string },
): Promise<PlatformCleanupCounts> {
  return db.transaction(async (tx) => {
    // Block concurrent writes to the counted tables while validating and clearing
    // the exact snapshot the administrator reviewed.
    await tx.execute(sql`
      LOCK TABLE properties, users, buyers, business_agencies, branches, leads
      IN SHARE ROW EXCLUSIVE MODE
    `);

    const currentCounts = countsFromRows((await tx.execute(countsQuery)).rows);
    const countsMatch = Object.keys(currentCounts).every(
      (key) =>
        currentCounts[key as keyof PlatformCleanupCounts] ===
        expectedCounts[key as keyof PlatformCleanupCounts],
    );
    if (!countsMatch) {
      throw new PlatformCleanupSnapshotChangedError(currentCounts);
    }

    const propertyRows = (await tx.execute(sql`SELECT id, seller_id FROM properties`)).rows as Array<{
      id: number | string;
      seller_id: number | string | null;
    }>;
    const propertyIds = idsFromRows(propertyRows);
    const sellerIds = propertyRows
      .map((row) => row.seller_id)
      .filter((id): id is number | string => id !== null)
      .map(Number)
      .filter(Number.isSafeInteger);

    const agentIds = idsFromRows(
      (await tx.execute(sql`
        SELECT id FROM users WHERE role IN ('agent', 'senior_agent')
      `)).rows,
    );
    const demoBuyerLoginIds = idsFromRows(
      (await tx.execute(sql`
        SELECT id FROM users WHERE lower(email) = 'buyer.demo@quickprop.co.zw'
      `)).rows,
    );
    const userIds = [...new Set([...agentIds, ...demoBuyerLoginIds])];
    const buyerIds = idsFromRows((await tx.execute(sql`SELECT id FROM buyers`)).rows);
    const agencyIds = idsFromRows((await tx.execute(sql`SELECT id FROM business_agencies`)).rows);
    const branchIds = idsFromRows((await tx.execute(sql`SELECT id FROM branches`)).rows);
    const leadIds = idsFromRows((await tx.execute(sql`SELECT id FROM leads`)).rows);

    const relationshipIds = idsFromRows(
      (await tx.execute(sql`
        SELECT id
        FROM property_agent_relationships
        WHERE property_id = ANY(${intArray(propertyIds)})
           OR agent_id = ANY(${intArray(userIds)})
           OR branch_id = ANY(${intArray(branchIds)})
      `)).rows,
    );
    const duplicateReviewIds = idsFromRows(
      (await tx.execute(sql`
        SELECT id
        FROM property_duplicate_reviews
        WHERE source_property_id = ANY(${intArray(propertyIds)})
           OR candidate_property_id = ANY(${intArray(propertyIds)})
           OR canonical_property_id = ANY(${intArray(propertyIds)})
           OR reviewed_by = ANY(${intArray(userIds)})
      `)).rows,
    );
    const housekeepingEventIds = idsFromRows(
      (await tx.execute(sql`
        SELECT id
        FROM listing_housekeeping_events
        WHERE property_id = ANY(${intArray(propertyIds)})
           OR agent_id = ANY(${intArray(userIds)})
           OR agency_id = ANY(${intArray(branchIds)})
           OR relationship_id = ANY(${intArray(relationshipIds)})
      `)).rows,
    );
    const importSessionIds = idsFromRows(
      (await tx.execute(sql`
        SELECT id
        FROM import_sessions
        WHERE agency_id = ANY(${intArray(branchIds)})
           OR created_by = ANY(${intArray(userIds)})
      `)).rows,
    );
    const importFileIds = idsFromRows(
      (await tx.execute(sql`
        SELECT id FROM import_files WHERE session_id = ANY(${intArray(importSessionIds)})
      `)).rows,
    );
    const importRecordIds = idsFromRows(
      (await tx.execute(sql`
        SELECT id
        FROM import_records
        WHERE agent_id = ANY(${intArray(userIds)})
           OR final_property_id = ANY(${intArray(propertyIds)})
           OR matched_property_id = ANY(${intArray(propertyIds)})
           OR final_relationship_id = ANY(${intArray(relationshipIds)})
           OR session_id = ANY(${intArray(importSessionIds)})
           OR source_file_id = ANY(${intArray(importFileIds)})
      `)).rows,
    );

    const deleteWhereAny = async (
      table: string,
      conditions: Array<{ column: string; ids: number[] }>,
    ): Promise<void> => {
      const activeConditions = conditions.filter(({ ids }) => ids.length > 0);
      if (activeConditions.length === 0) return;
      const where = sql.join(
        activeConditions.map(
          ({ column, ids }) =>
            sql`${sql.identifier(column)} = ANY(${intArray(ids)})`,
        ),
        sql` OR `,
      );
      await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE ${where}`);
    };

    await deleteWhereAny("import_changes", [
      { column: "record_id", ids: importRecordIds },
      { column: "changed_by", ids: userIds },
    ]);
    await deleteWhereAny("import_field_confidence", [
      { column: "record_id", ids: importRecordIds },
    ]);
    await deleteWhereAny("import_records", [{ column: "id", ids: importRecordIds }]);
    await deleteWhereAny("import_files", [{ column: "id", ids: importFileIds }]);
    await deleteWhereAny("import_sessions", [{ column: "id", ids: importSessionIds }]);

    await deleteWhereAny("agent_reviews", [
      { column: "agent_id", ids: userIds },
      { column: "property_id", ids: propertyIds },
      { column: "relationship_id", ids: relationshipIds },
    ]);
    await deleteWhereAny("agent_review_invitations", [
      { column: "agent_id", ids: userIds },
      { column: "property_id", ids: propertyIds },
      { column: "relationship_id", ids: relationshipIds },
    ]);
    await deleteWhereAny("collaboration_match_requests", [
      { column: "property_id", ids: propertyIds },
      { column: "property_owner_id", ids: userIds },
      { column: "requester_id", ids: userIds },
    ]);
    await deleteWhereAny("documents", [{ column: "property_id", ids: propertyIds }]);
    await deleteWhereAny("property_alerts", [
      { column: "source_property_id", ids: propertyIds },
      { column: "user_id", ids: userIds },
    ]);
    await deleteWhereAny("property_merge_history", [
      { column: "review_id", ids: duplicateReviewIds },
      { column: "source_property_id", ids: propertyIds },
      { column: "canonical_property_id", ids: propertyIds },
      { column: "merged_by", ids: userIds },
    ]);
    await deleteWhereAny("property_duplicate_reviews", [
      { column: "source_property_id", ids: propertyIds },
      { column: "candidate_property_id", ids: propertyIds },
      { column: "canonical_property_id", ids: propertyIds },
      { column: "reviewed_by", ids: userIds },
    ]);
    await deleteWhereAny("property_marketing_assets", [
      { column: "property_id", ids: propertyIds },
      { column: "uploaded_by", ids: userIds },
      { column: "relationship_id", ids: relationshipIds },
    ]);

    await deleteWhereAny("listing_housekeeping_deliveries", [
      { column: "event_id", ids: housekeepingEventIds },
      { column: "user_id", ids: userIds },
    ]);
    await deleteWhereAny("listing_housekeeping_events", [
      { column: "property_id", ids: propertyIds },
      { column: "agent_id", ids: userIds },
      { column: "agency_id", ids: branchIds },
      { column: "relationship_id", ids: relationshipIds },
    ]);

    await deleteWhereAny("property_agent_relationships", [
      { column: "property_id", ids: propertyIds },
      { column: "agent_id", ids: userIds },
      { column: "branch_id", ids: branchIds },
    ]);
    await deleteWhereAny("price_history", [{ column: "property_id", ids: propertyIds }]);

    await deleteWhereAny("listing_housekeeping_preferences", [
      { column: "user_id", ids: userIds },
    ]);
    await deleteWhereAny("rental_disputes", [
      { column: "resolved_by_user_id", ids: userIds },
      { column: "tenant_user_id", ids: userIds },
    ]);
    await deleteWhereAny("rental_history", [
      { column: "property_id", ids: propertyIds },
      { column: "tenant_user_id", ids: userIds },
    ]);
    await deleteWhereAny("rental_references", [
      { column: "submitted_by_user_id", ids: userIds },
    ]);
    await deleteWhereAny("saved_properties", [
      { column: "property_id", ids: propertyIds },
      { column: "user_id", ids: userIds },
    ]);
    await deleteWhereAny("sync_mutations", [{ column: "actor_id", ids: userIds }]);
    await deleteWhereAny("tasks", [
      { column: "assignee_id", ids: userIds },
      { column: "lead_id", ids: leadIds },
      { column: "property_id", ids: propertyIds },
    ]);
    await deleteWhereAny("viewings", [
      { column: "agent_id", ids: userIds },
      { column: "lead_id", ids: leadIds },
      { column: "property_id", ids: propertyIds },
    ]);
    await deleteWhereAny("buyer_requests", [{ column: "agent_id", ids: agentIds }]);
    await deleteWhereAny("notifications", [{ column: "user_id", ids: userIds }]);
    await deleteWhereAny("user_push_tokens", [{ column: "user_id", ids: userIds }]);

    await tx.execute(sql`
      DELETE FROM audit_log
      WHERE user_id = ANY(${intArray(userIds)})
         OR (entity_type IN ('property', 'properties') AND entity_id = ANY(${intArray(propertyIds)}))
         OR (entity_type IN ('agent', 'agents', 'user', 'users') AND entity_id = ANY(${intArray(agentIds)}))
         OR (entity_type IN ('buyer', 'buyers') AND entity_id = ANY(${intArray(buyerIds)}))
          OR (entity_type IN ('business_agency', 'branch', 'branches', 'agency', 'agencies') AND entity_id = ANY(${intArray([...agencyIds, ...branchIds])}))
         OR (entity_type IN ('lead', 'leads') AND entity_id = ANY(${intArray(leadIds)}))
    `);
    await tx.execute(sql`DELETE FROM activity`);

    await deleteWhereAny("lead_timeline", [{ column: "lead_id", ids: leadIds }]);
    await tx.execute(sql`DELETE FROM leads`);
    await tx.execute(sql`DELETE FROM buyers`);

    await tx.execute(sql`
      UPDATE properties SET canonical_property_id = NULL
      WHERE id = ANY(${intArray(propertyIds)})
    `);
    await tx.execute(sql`DELETE FROM properties`);
    await deleteWhereAny("sellers", [{ column: "id", ids: sellerIds }]);

    await tx.execute(sql`
      UPDATE users SET branch_id = NULL
      WHERE branch_id = ANY(${intArray(branchIds)})
        AND id <> ALL(${intArray(userIds)})
    `);
    await deleteWhereAny("users", [{ column: "id", ids: userIds }]);
    await tx.execute(sql`DELETE FROM branches`);
    await tx.execute(sql`DELETE FROM business_agencies`);

    await tx.execute(sql`
      INSERT INTO audit_log (action, entity_type, entity_id, detail, user_id, user_name)
      VALUES (
        'deleted',
        'platform_data_cleanup',
        NULL,
        'Admin cleared all dashboard-counted records and linked database history.',
        ${actor.id},
        ${actor.name}
      )
    `);

    return currentCounts;
  });
}
