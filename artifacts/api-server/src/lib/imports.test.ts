import assert from "node:assert/strict";
import { test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "requires an explicit duplicate decision before publishing imported listings",
  {
    skip: testDatabaseUrl
      ? false
      : "requires an isolated database configured through TEST_DATABASE_URL",
  },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    const database = await import("@workspace/db");
    const { default: app } = await import("../app");
    const {
      auditLogTable,
      db,
      branchesTable,
      importFilesTable,
      importRecordsTable,
      importSessionsTable,
      propertiesTable,
      propertyAgentRelationshipsTable,
      usersTable,
    } = database;

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fixture = {
      branchIds: [] as number[],
      userIds: [] as number[],
      propertyIds: [] as number[],
      sessionIds: [] as number[],
      fileIds: [] as number[],
      recordIds: [] as number[],
    };

    const server = app.listen(0);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const apiUrl = `http://127.0.0.1:${address.port}/api`;

    async function api(
      path: string,
      userId: number,
      method = "GET",
      body?: unknown,
    ): Promise<{ status: number; body: unknown }> {
      const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers: {
          cookie: `qp_uid=${userId}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const responseBody = await response.json() as unknown;
      return { status: response.status, body: responseBody };
    }

    try {
      const [branchOne, branchTwo] = await db.insert(branchesTable).values([
        { name: `Import test agency one ${suffix}` },
        { name: `Import test agency two ${suffix}` },
      ]).returning({ id: branchesTable.id });
      assert.ok(branchOne && branchTwo);
      fixture.branchIds = [branchOne.id, branchTwo.id];

      const [agentOne, agentTwo] = await db.insert(usersTable).values([
        {
          name: `Import test agent one ${suffix}`,
          email: `import-one-${suffix}@example.test`,
          role: "agent",
          branchId: branchOne.id,
        },
        {
          name: `Import test agent two ${suffix}`,
          email: `import-two-${suffix}@example.test`,
          role: "agent",
          branchId: branchTwo.id,
        },
      ]).returning({ id: usersTable.id });
      assert.ok(agentOne && agentTwo);
      fixture.userIds = [agentOne.id, agentTwo.id];

      const [canonical] = await db.insert(propertiesTable).values({
        reference: `IMPORT-CANONICAL-${suffix}`,
        title: "Canonical import fixture",
        description: "The existing canonical property for duplicate decisions.",
        propertyType: "house",
        listingType: "sale",
        status: "public",
        pipelineStage: "published",
        price: 250000,
        currency: "USD",
        suburb: "Avondale",
        city: "Harare",
        address: "12 Import Test Street",
        bedrooms: 3,
        bathrooms: 2,
        agentId: agentOne.id,
        branchId: branchOne.id,
      }).returning({ id: propertiesTable.id });
      assert.ok(canonical);
      fixture.propertyIds.push(canonical.id);

      async function createImportRecord(reference: string) {
        const [session] = await db.insert(importSessionsTable).values({
          reference: `IMP-${reference}-${suffix}`,
          agencyId: branchOne.id,
          createdBy: agentOne.id,
          status: "review",
          totalFiles: 1,
        }).returning({ id: importSessionsTable.id });
        assert.ok(session);
        fixture.sessionIds.push(session.id);

        const [file] = await db.insert(importFilesTable).values({
          sessionId: session.id,
          fileName: `${reference}.csv`,
          fileType: "text/csv",
          sizeBytes: 1,
          storagePath: `/objects/uploads/${agentOne.id}/${reference}-${suffix}.csv`,
          processingStatus: "complete",
          extractedRecordCount: 1,
        }).returning({ id: importFilesTable.id });
        assert.ok(file);
        fixture.fileIds.push(file.id);

        const [record] = await db.insert(importRecordsTable).values({
          sessionId: session.id,
          sourceFileId: file.id,
          sourceLocation: "row 2",
          rawData: { address: "12 Import Test Street" },
          extractedData: {
            reference,
            address: "12 Import Test Street",
            suburb: "Avondale",
            city: "Harare",
            propertyType: "house",
            price: 250000,
            currency: "USD",
            bedrooms: 3,
            bathrooms: 2,
            description: `${reference} imported listing`,
          },
          reviewStatus: "approved",
          duplicateStatus: "possible",
          matchedPropertyId: canonical.id,
          validationIssues: [],
          agentId: agentOne.id,
        }).returning({ id: importRecordsTable.id });
        assert.ok(record);
        fixture.recordIds.push(record.id);
        return { sessionId: session.id, recordId: record.id };
      }

      const blocked = await createImportRecord("blocked");
      const linked = await createImportRecord("linked");
      const keptSeparate = await createImportRecord("kept-separate");

      const blockedPublish = await api(
        `/imports/sessions/${blocked.sessionId}/publish`,
        agentOne.id,
        "POST",
        { recordIds: [blocked.recordId] },
      );
      assert.equal(blockedPublish.status, 200);
      assert.deepEqual(blockedPublish.body, {
        published: 0,
        linked: 0,
        created: 0,
        failed: 1,
        errors: [
          `Record ${blocked.recordId}: approve the record and resolve validation or duplicate issues first.`,
        ],
      });
      const [blockedAfterPublish] = await db.select({
        duplicateStatus: importRecordsTable.duplicateStatus,
        reviewStatus: importRecordsTable.reviewStatus,
      }).from(importRecordsTable).where(eq(importRecordsTable.id, blocked.recordId));
      assert.deepEqual(blockedAfterPublish, {
        duplicateStatus: "possible",
        reviewStatus: "approved",
      });

      const beforeLinkPropertyCount = await db.select({ id: propertiesTable.id })
        .from(propertiesTable)
        .where(eq(propertiesTable.reference, `IMPORT-CANONICAL-${suffix}`));
      const linkDecision = await api(
        `/imports/sessions/${linked.sessionId}/bulk-action`,
        agentOne.id,
        "POST",
        { recordIds: [linked.recordId], action: "link_duplicate" },
      );
      assert.equal(linkDecision.status, 200);
      const linkPublish = await api(
        `/imports/sessions/${linked.sessionId}/publish`,
        agentOne.id,
        "POST",
        { recordIds: [linked.recordId] },
      );
      assert.deepEqual(linkPublish.body, {
        published: 1,
        linked: 1,
        created: 0,
        failed: 0,
        errors: [],
      });
      const afterLinkPropertyCount = await db.select({ id: propertiesTable.id })
        .from(propertiesTable)
        .where(eq(propertiesTable.reference, `IMPORT-CANONICAL-${suffix}`));
      assert.equal(afterLinkPropertyCount.length, beforeLinkPropertyCount.length);
      const [linkedAfterPublish] = await db.select({
        finalPropertyId: importRecordsTable.finalPropertyId,
        finalRelationshipId: importRecordsTable.finalRelationshipId,
        reviewStatus: importRecordsTable.reviewStatus,
      }).from(importRecordsTable).where(eq(importRecordsTable.id, linked.recordId));
      assert.equal(linkedAfterPublish?.finalPropertyId, canonical.id);
      assert.ok(linkedAfterPublish?.finalRelationshipId);
      assert.equal(linkedAfterPublish?.reviewStatus, "published");
      const canonicalRelationships = await db.select({
        id: propertyAgentRelationshipsTable.id,
        propertyId: propertyAgentRelationshipsTable.propertyId,
        agentId: propertyAgentRelationshipsTable.agentId,
        branchId: propertyAgentRelationshipsTable.branchId,
      }).from(propertyAgentRelationshipsTable).where(and(
        eq(propertyAgentRelationshipsTable.propertyId, canonical.id),
        eq(propertyAgentRelationshipsTable.agentId, agentOne.id),
        eq(propertyAgentRelationshipsTable.branchId, branchOne.id),
      ));
      assert.equal(canonicalRelationships.length, 1);

      const keepDecision = await api(
        `/imports/sessions/${keptSeparate.sessionId}/bulk-action`,
        agentOne.id,
        "POST",
        { recordIds: [keptSeparate.recordId], action: "clear_duplicate" },
      );
      assert.equal(keepDecision.status, 200);
      const keepPublish = await api(
        `/imports/sessions/${keptSeparate.sessionId}/publish`,
        agentOne.id,
        "POST",
        { recordIds: [keptSeparate.recordId] },
      );
      assert.deepEqual(keepPublish.body, {
        published: 1,
        linked: 0,
        created: 1,
        failed: 0,
        errors: [],
      });
      const [keptAfterPublish] = await db.select({
        finalPropertyId: importRecordsTable.finalPropertyId,
        reviewStatus: importRecordsTable.reviewStatus,
        duplicateStatus: importRecordsTable.duplicateStatus,
      }).from(importRecordsTable).where(eq(importRecordsTable.id, keptSeparate.recordId));
      assert.equal(keptAfterPublish?.reviewStatus, "published");
      assert.equal(keptAfterPublish?.duplicateStatus, "clear");
      assert.ok(keptAfterPublish?.finalPropertyId);
      assert.notEqual(keptAfterPublish.finalPropertyId, canonical.id);
      fixture.propertyIds.push(keptAfterPublish.finalPropertyId);

      const propertyRowsAfterDecisions = await db.select({ id: propertiesTable.id })
        .from(propertiesTable)
        .where(inArray(propertiesTable.id, fixture.propertyIds));
      assert.equal(propertyRowsAfterDecisions.length, 2);

      const foreignPath = await api("/imports/sessions", agentOne.id, "POST", {
        files: [{
          fileName: "foreign.csv",
          fileType: "text/csv",
          sizeBytes: 1,
          storagePath: `/objects/uploads/${agentTwo.id}/foreign.csv`,
        }],
      });
      assert.equal(foreignPath.status, 403);

      const foreignSession = await api(
        `/imports/sessions/${blocked.sessionId}`,
        agentTwo.id,
      );
      assert.equal(foreignSession.status, 404);
      const foreignSessionList = await api("/imports/sessions", agentTwo.id);
      assert.equal(foreignSessionList.status, 200);
      assert.ok(Array.isArray(foreignSessionList.body));
      assert.equal(
        (foreignSessionList.body as Array<{ id: number }>).some(
          (session) => fixture.sessionIds.includes(session.id),
        ),
        false,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (fixture.recordIds.length) {
        await db.delete(importRecordsTable).where(inArray(importRecordsTable.id, fixture.recordIds));
      }
      if (fixture.fileIds.length) {
        await db.delete(importFilesTable).where(inArray(importFilesTable.id, fixture.fileIds));
      }
      if (fixture.sessionIds.length) {
        await db.delete(importSessionsTable).where(inArray(importSessionsTable.id, fixture.sessionIds));
      }
      if (fixture.propertyIds.length) {
        await db.delete(propertyAgentRelationshipsTable).where(inArray(
          propertyAgentRelationshipsTable.propertyId,
          fixture.propertyIds,
        ));
      }
      if (fixture.propertyIds.length) {
        await db.delete(propertiesTable).where(inArray(propertiesTable.id, fixture.propertyIds));
      }
      if (fixture.userIds.length) {
        await db.delete(auditLogTable).where(inArray(auditLogTable.userId, fixture.userIds));
        await db.delete(usersTable).where(inArray(usersTable.id, fixture.userIds));
      }
      if (fixture.branchIds.length) {
        await db.delete(branchesTable).where(inArray(branchesTable.id, fixture.branchIds));
      }
      await database.pool.end();
    }
  },
);