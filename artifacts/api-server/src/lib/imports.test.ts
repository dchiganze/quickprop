import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const releaseValidation = process.env.RELEASE_VALIDATION === "1";
const databaseTestSkip = testDatabaseUrl
  ? false
  : releaseValidation
    ? false
    : "requires an isolated database configured through TEST_DATABASE_URL";
let databasePool: { end: () => Promise<void> } | null = null;

after(async () => {
  await databasePool?.end();
});

test(
  "requires an explicit duplicate decision before publishing imported listings",
  {
    skip: databaseTestSkip,
  },
  async () => {
    assert.ok(
      testDatabaseUrl,
      "release validation requires an isolated database configured through TEST_DATABASE_URL",
    );
    process.env.DATABASE_URL = testDatabaseUrl;
    const database = await import("@workspace/db");
    databasePool ??= database.pool;
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
    }
  },
);

test(
  "image imports are mocked, confidence-aware, and safe to retry after human decisions",
  {
    skip: databaseTestSkip,
  },
  async () => {
    assert.ok(
      testDatabaseUrl,
      "release validation requires an isolated database configured through TEST_DATABASE_URL",
    );
    process.env.DATABASE_URL = testDatabaseUrl;
    const database = await import("@workspace/db");
    databasePool ??= database.pool;
    const { default: app } = await import("../app");
    const { ai } = await import("@workspace/integrations-gemini-ai");
    const {
      db,
      auditLogTable,
      branchesTable,
      importChangesTable,
      importFieldConfidenceTable,
      importFilesTable,
      importRecordsTable,
      importSessionsTable,
      propertiesTable,
      usersTable,
    } = database;

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fixture = {
      branchIds: [] as number[],
      userIds: [] as number[],
      sessionIds: [] as number[],
      fileIds: [] as number[],
      recordIds: [] as number[],
      propertyIds: [] as number[],
    };
    const providerCalls: string[] = [];
    const providerResponses: Array<Record<string, unknown>> = [];
    let providerError: Error | null = null;
    let providerGate: Promise<void> | null = null;
    let releaseProviderGate: (() => void) | null = null;

    function imageResponse(
      records: Array<{
        reference: string;
        title: string;
        address: string;
        confidence?: number;
        titleConfidence?: number;
      }>,
    ): Record<string, unknown> {
      return {
        records: records.map((record, index) => ({
          fields: {
            title: record.title,
            reference: record.reference,
            address: record.address,
            suburb: "Avondale",
            city: "Harare",
            price: 250000 + index * 10000,
            currency: "USD",
            propertyType: "house",
            bedrooms: 3,
            bathrooms: 2,
            description: `${record.title} visible in the mocked listing image`,
          },
          fieldConfidence: {
            title: record.titleConfidence ?? record.confidence ?? 95,
            reference: record.confidence ?? 95,
            address: record.confidence ?? 95,
            suburb: record.confidence ?? 95,
            city: record.confidence ?? 95,
            price: record.confidence ?? 95,
            currency: record.confidence ?? 95,
            propertyType: record.confidence ?? 95,
            bedrooms: record.confidence ?? 95,
            bathrooms: record.confidence ?? 95,
            description: record.confidence ?? 95,
          },
          fieldEvidence: {
            title: `Visible title for ${record.reference}`,
            reference: `Visible reference ${record.reference}`,
            address: `Visible address for ${record.reference}`,
            price: "Visible asking price",
          },
          boundingBox: [index * 250, 0, index * 250 + 200, 900],
        })),
      };
    }

    const originalFetch = globalThis.fetch;
    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async (
        input: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1],
      ): Promise<Response> => {
        const url = String(input);
        if (url.startsWith("http://127.0.0.1:1106/object-storage/signed-object-url")) {
          return Response.json({
            signed_url: "https://mock-private-storage.test/image-bytes",
          });
        }
        if (url === "https://mock-private-storage.test/image-bytes") {
          return new Response(Buffer.from("mock image bytes"), {
            headers: { "content-type": "image/jpeg" },
          });
        }
        return originalFetch(input, init);
      },
    );
    const providerMock = mock.method(
      ai.models,
      "generateContent",
      async (request: unknown): Promise<{ text: string }> => {
        const contents = (request as {
          contents?: Array<{ parts?: Array<{ inlineData?: { mimeType?: string } }> }>;
        }).contents;
        const inlineData = contents?.[0]?.parts?.find((part) => part.inlineData)?.inlineData;
        providerCalls.push(inlineData?.mimeType ?? "unknown");
        if (providerGate) await providerGate;
        if (providerError) throw providerError;
        const response = providerResponses.shift();
        if (!response) throw new Error("No mocked Gemini response configured.");
        return { text: JSON.stringify(response) };
      },
    );

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
      const response = await originalFetch(`${apiUrl}${path}`, {
        method,
        headers: {
          cookie: `qp_uid=${userId}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let responseBody: unknown = text;
      try {
        responseBody = JSON.parse(text) as unknown;
      } catch {
        // Error reports are intentionally plain CSV.
      }
      return { status: response.status, body: responseBody };
    }

    async function waitForSession(sessionId: number, userId: number) {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const result = await api(`/imports/sessions/${sessionId}`, userId);
        assert.equal(result.status, 200);
        const session = result.body as { status: string };
        if (session.status !== "processing") {
          const finishedSession = result.body as {
            status: string;
            files: Array<{
              id: number;
              fileName: string;
              processingStatus: string;
              error: string | null;
            }>;
            records: Array<{
              id: number;
              sourceFileId: number;
              sourceLocation: string;
              data: Record<string, unknown>;
              fieldConfidence: Record<string, number>;
              confidenceScore: number;
              reviewStatus: string;
              validationIssues: string[];
              sourceMetadata: Record<string, unknown>;
            }>;
          };
          for (const record of finishedSession.records) {
            if (!fixture.recordIds.includes(record.id)) fixture.recordIds.push(record.id);
          }
          return finishedSession;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`Import session ${sessionId} did not finish processing.`);
    }

    async function createImageSession(
      userId: number,
      branchId: number,
      reference: string,
      fileNames: string[],
    ) {
      const [session] = await db.insert(importSessionsTable).values({
        reference: `IMP-${reference}-${suffix}`,
        agencyId: branchId,
        createdBy: userId,
        totalFiles: fileNames.length,
      }).returning({ id: importSessionsTable.id });
      assert.ok(session);
      fixture.sessionIds.push(session.id);
      const files = await db.insert(importFilesTable).values(fileNames.map((fileName, index) => {
        const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
        return {
          sessionId: session.id,
          fileName,
          fileType: fileName.endsWith(".png") ? "image/png" : "image/jpeg",
          sizeBytes: 16,
          storagePath: `/objects/uploads/${userId}/a${userId}${branchId}${index + 1}.${extension}`,
        };
      })).returning({ id: importFilesTable.id });
      fixture.fileIds.push(...files.map((file) => file.id));
      return session.id;
    }

    try {
      const [branch] = await db.insert(branchesTable).values({
        name: `Image import test agency ${suffix}`,
      }).returning({ id: branchesTable.id });
      assert.ok(branch);
      fixture.branchIds.push(branch.id);
      const [agent] = await db.insert(usersTable).values({
        name: `Image import test agent ${suffix}`,
        email: `image-import-${suffix}@example.test`,
        role: "agent",
        branchId: branch.id,
      }).returning({ id: usersTable.id });
      assert.ok(agent);
      fixture.userIds.push(agent.id);

      const mimeSessionId = await createImageSession(
        agent.id,
        branch.id,
        "mime",
        ["listing.jpg", "listing.jpeg", "listing.png"],
      );
      providerResponses.push(
        imageResponse([{ reference: "JPG-1", title: "JPG home", address: "1 JPG Street" }]),
        imageResponse([{ reference: "JPEG-1", title: "JPEG home", address: "2 JPEG Street" }]),
        imageResponse([{ reference: "PNG-1", title: "PNG home", address: "3 PNG Street" }]),
      );
      const mimeProcess = await api(`/imports/sessions/${mimeSessionId}/process`, agent.id, "POST", {});
      assert.equal(mimeProcess.status, 202);
      const mimeResult = await waitForSession(mimeSessionId, agent.id);
      assert.equal(mimeResult.status, "review");
      assert.deepEqual(new Set(providerCalls), new Set(["image/jpeg", "image/png"]));
      assert.equal(providerCalls.filter((mime) => mime === "image/jpeg").length, 2);
      assert.equal(providerCalls.filter((mime) => mime === "image/png").length, 1);
      const mimeRecords = mimeResult.records;
      assert.equal(mimeRecords.length, 3);
      const jpgRecord = mimeRecords.find((record) => record.data.reference === "JPG-1");
      assert.ok(jpgRecord);
      assert.equal(jpgRecord.reviewStatus, "draft");
      assert.equal(jpgRecord.fieldConfidence.title, 95);
      const jpgSources = jpgRecord.sourceMetadata.fieldSources as Record<string, {
        confidence: number;
        evidence: string;
        method: string;
      }>;
      assert.deepEqual(jpgSources.title, {
        confidence: 95,
        evidence: "Visible title for JPG-1",
        method: "gemini-vision",
      });
      assert.equal(jpgRecord.validationIssues.length, 0);

      const lowConfidenceSessionId = await createImageSession(
        agent.id,
        branch.id,
        "low-confidence",
        ["low-confidence.png"],
      );
      providerResponses.push(imageResponse([{
        reference: "LOW-1",
        title: "Unclear home",
        address: "4 Unclear Street",
        confidence: 35,
      }]));
      const lowConfidenceProcess = await api(
        `/imports/sessions/${lowConfidenceSessionId}/process`,
        agent.id,
        "POST",
        {},
      );
      assert.equal(lowConfidenceProcess.status, 202);
      const lowConfidenceResult = await waitForSession(lowConfidenceSessionId, agent.id);
      assert.equal(lowConfidenceResult.status, "review");
      assert.equal(lowConfidenceResult.records.length, 1);
      assert.equal(lowConfidenceResult.records[0]?.reviewStatus, "draft");
      assert.ok(lowConfidenceResult.records[0]?.validationIssues.some((issue) => issue.includes("confidence")));
      assert.ok(
        (lowConfidenceResult.records[0]?.sourceMetadata.reviewFlags as string[]).some((flag) => flag.includes("Low-confidence")),
      );

      const decisionSessionId = await createImageSession(
        agent.id,
        branch.id,
        "decisions",
        ["decisions.jpg"],
      );
      providerResponses.push(imageResponse([
        { reference: "DEC-A", title: "Approved home", address: "10 Decision Street" },
        { reference: "DEC-B", title: "Rejected home", address: "11 Decision Street" },
        { reference: "DEC-C", title: "Corrected home", address: "12 Decision Street" },
        { reference: "DEC-D", title: "Published home", address: "13 Decision Street" },
      ]));
      const decisionProcess = await api(`/imports/sessions/${decisionSessionId}/process`, agent.id, "POST", {});
      assert.equal(decisionProcess.status, 202);
      const decisionInitial = await waitForSession(decisionSessionId, agent.id);
      assert.equal(decisionInitial.records.length, 4);
      const initialIds = new Map(
        decisionInitial.records.map((record) => [record.data.reference, record.id]),
      );
      const recordByReference = (reference: string) => {
        const record = decisionInitial.records.find((item) => item.data.reference === reference);
        assert.ok(record);
        return record;
      };
      const approved = await api(
        `/imports/sessions/${decisionSessionId}/bulk-action`,
        agent.id,
        "POST",
        { recordIds: [recordByReference("DEC-A").id], action: "approve" },
      );
      assert.equal(approved.status, 200);
      const rejected = await api(
        `/imports/sessions/${decisionSessionId}/bulk-action`,
        agent.id,
        "POST",
        { recordIds: [recordByReference("DEC-B").id], action: "reject" },
      );
      assert.equal(rejected.status, 200);
      const correctedData = {
        title: "Corrected home",
        reference: "DEC-C",
        address: "12 Corrected Decision Street",
        suburb: "Avondale",
        city: "Harare",
        price: 275000,
        currency: "USD",
        propertyType: "house",
        bedrooms: 4,
        bathrooms: 2,
        description: "Human-corrected listing data",
      };
      const corrected = await api(
        `/imports/sessions/${decisionSessionId}/records/${recordByReference("DEC-C").id}`,
        agent.id,
        "PATCH",
        { data: correctedData, reviewStatus: "approved" },
      );
      assert.equal(corrected.status, 200);
      const publishApproval = await api(
        `/imports/sessions/${decisionSessionId}/bulk-action`,
        agent.id,
        "POST",
        { recordIds: [recordByReference("DEC-D").id], action: "approve" },
      );
      assert.equal(publishApproval.status, 200);
      const partialPublish = await api(
        `/imports/sessions/${decisionSessionId}/publish`,
        agent.id,
        "POST",
        {
          recordIds: [
            recordByReference("DEC-D").id,
            recordByReference("DEC-B").id,
          ],
        },
      );
      assert.deepEqual(partialPublish.body, {
        published: 1,
        linked: 0,
        created: 1,
        failed: 1,
        errors: [
          `Record ${recordByReference("DEC-B").id}: approve the record and resolve validation or duplicate issues first.`,
        ],
      });
      const [publishedBeforeRetry] = await db.select({
        finalPropertyId: importRecordsTable.finalPropertyId,
        reviewStatus: importRecordsTable.reviewStatus,
      }).from(importRecordsTable).where(eq(importRecordsTable.id, recordByReference("DEC-D").id));
      assert.equal(publishedBeforeRetry?.reviewStatus, "published");
      assert.ok(publishedBeforeRetry?.finalPropertyId);
      fixture.propertyIds.push(publishedBeforeRetry.finalPropertyId);

      providerResponses.push(imageResponse([
        {
          reference: "DEC-D",
          title: "Published home must not change",
          address: "13 Changed Decision Street",
        },
        {
          reference: "DEC-C",
          title: "Model changed title but human correction wins",
          address: "12 Reordered Street",
        },
        {
          reference: "DEC-A",
          title: "Approved home refreshed",
          address: "10 Decision Street",
        },
      ]));
      const retryProcess = await api(`/imports/sessions/${decisionSessionId}/process`, agent.id, "POST", {});
      assert.equal(retryProcess.status, 202);
      const decisionAfterRetry = await waitForSession(decisionSessionId, agent.id);
      assert.equal(decisionAfterRetry.records.length, 4);
      assert.deepEqual(
        new Set(decisionAfterRetry.records.map((record) => record.id)),
        new Set(initialIds.values()),
      );
      const afterRetryByReference = new Map(
        decisionAfterRetry.records.map((record) => [record.data.reference, record]),
      );
      assert.equal(afterRetryByReference.get("DEC-A")?.reviewStatus, "approved");
      assert.equal(afterRetryByReference.get("DEC-B")?.reviewStatus, "rejected");
      assert.equal(afterRetryByReference.get("DEC-C")?.reviewStatus, "approved");
      assert.equal(afterRetryByReference.get("DEC-C")?.id, initialIds.get("DEC-C"));
      assert.deepEqual(afterRetryByReference.get("DEC-C")?.data, correctedData);
      assert.equal(afterRetryByReference.get("DEC-D")?.reviewStatus, "published");
      assert.equal(afterRetryByReference.get("DEC-D")?.id, initialIds.get("DEC-D"));
      assert.equal(afterRetryByReference.get("DEC-D")?.data.address, "13 Decision Street");

      const concurrentSessionId = await createImageSession(
        agent.id,
        branch.id,
        "concurrent",
        ["concurrent.jpg"],
      );
      providerResponses.push(imageResponse([{
        reference: "CONCURRENT-1",
        title: "Held home",
        address: "20 Concurrent Street",
      }]));
      providerGate = new Promise<void>((resolve) => {
        releaseProviderGate = resolve;
      });
      const firstConcurrentProcess = await api(
        `/imports/sessions/${concurrentSessionId}/process`,
        agent.id,
        "POST",
        {},
      );
      assert.equal(firstConcurrentProcess.status, 202);
      const secondConcurrentProcess = await api(
        `/imports/sessions/${concurrentSessionId}/process`,
        agent.id,
        "POST",
        {},
      );
      assert.equal(secondConcurrentProcess.status, 409);
      const releaseGate = releaseProviderGate as (() => void) | null;
      releaseGate?.();
      providerGate = null;
      const concurrentResult = await waitForSession(concurrentSessionId, agent.id);
      assert.equal(concurrentResult.status, "review");

      const providerFailureSessionId = await createImageSession(
        agent.id,
        branch.id,
        "provider-failure",
        ["provider-failure.jpg"],
      );
      providerError = new Error("mock Gemini provider unavailable");
      const providerFailureProcess = await api(
        `/imports/sessions/${providerFailureSessionId}/process`,
        agent.id,
        "POST",
        {},
      );
      assert.equal(providerFailureProcess.status, 202);
      const providerFailureResult = await waitForSession(providerFailureSessionId, agent.id);
      assert.equal(providerFailureResult.status, "failed");
      assert.match(providerFailureResult.files[0]?.error ?? "", /mock Gemini provider unavailable/);
      providerError = null;
      const providerFailureReport = await api(
        `/imports/sessions/${providerFailureSessionId}/error-report`,
        agent.id,
      );
      assert.equal(providerFailureReport.status, 200);
      assert.match(String(providerFailureReport.body), /provider-failure\.jpg/);
      assert.match(String(providerFailureReport.body), /mock Gemini provider unavailable/);
      providerResponses.push(imageResponse([{
        reference: "PROVIDER-RECOVERED-1",
        title: "Provider recovered home",
        address: "25 Provider Recovery Street",
      }]));
      const providerRetryProcess = await api(
        `/imports/sessions/${providerFailureSessionId}/process`,
        agent.id,
        "POST",
        {},
      );
      assert.equal(providerRetryProcess.status, 202);
      const providerRetryResult = await waitForSession(providerFailureSessionId, agent.id);
      assert.equal(providerRetryResult.status, "review");
      assert.equal(providerRetryResult.records.length, 1);
      assert.equal(providerRetryResult.files[0]?.processingStatus, "complete");

      const persistenceFailureSessionId = await createImageSession(
        agent.id,
        branch.id,
        "persistence-failure",
        ["persistence-failure.jpg"],
      );
      providerResponses.push(imageResponse([{
        reference: "PERSIST-1",
        title: "Retryable home",
        address: "30 Persistence Street",
      }]));
      const originalTransaction = db.transaction.bind(db);
      (db as unknown as { transaction: typeof db.transaction }).transaction = async () => {
        throw new Error("mock persistence unavailable");
      };
      try {
        const persistenceFailureProcess = await api(
          `/imports/sessions/${persistenceFailureSessionId}/process`,
          agent.id,
          "POST",
          {},
        );
        assert.equal(persistenceFailureProcess.status, 202);
        const persistenceFailureResult = await waitForSession(persistenceFailureSessionId, agent.id);
        assert.equal(persistenceFailureResult.status, "failed");
        assert.match(persistenceFailureResult.files[0]?.error ?? "", /mock persistence unavailable/);
        const persistenceFailureReport = await api(
          `/imports/sessions/${persistenceFailureSessionId}/error-report`,
          agent.id,
        );
        assert.equal(persistenceFailureReport.status, 200);
        assert.match(String(persistenceFailureReport.body), /persistence-failure\.jpg/);
        assert.match(String(persistenceFailureReport.body), /mock persistence unavailable/);
      } finally {
        (db as unknown as { transaction: typeof db.transaction }).transaction = originalTransaction;
      }

      providerResponses.push(imageResponse([{
        reference: "PERSIST-1",
        title: "Retryable home",
        address: "30 Persistence Street",
      }]));
      const persistenceRetryProcess = await api(
        `/imports/sessions/${persistenceFailureSessionId}/process`,
        agent.id,
        "POST",
        {},
      );
      assert.equal(persistenceRetryProcess.status, 202);
      const persistenceRetryResult = await waitForSession(persistenceFailureSessionId, agent.id);
      assert.equal(persistenceRetryResult.status, "review");
      assert.equal(persistenceRetryResult.records.length, 1);
      assert.equal(persistenceRetryResult.files[0]?.processingStatus, "complete");
    } finally {
      fetchMock.mock.restore();
      providerMock.mock.restore();
      if (server.listening) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      if (fixture.recordIds.length) {
        await db.delete(importChangesTable).where(inArray(importChangesTable.recordId, fixture.recordIds));
        await db.delete(importFieldConfidenceTable).where(inArray(importFieldConfidenceTable.recordId, fixture.recordIds));
        await db.delete(importRecordsTable).where(inArray(importRecordsTable.id, fixture.recordIds));
      }
      if (fixture.fileIds.length) {
        await db.delete(importFilesTable).where(inArray(importFilesTable.id, fixture.fileIds));
      }
      if (fixture.sessionIds.length) {
        await db.delete(importSessionsTable).where(inArray(importSessionsTable.id, fixture.sessionIds));
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
    }
  },
);