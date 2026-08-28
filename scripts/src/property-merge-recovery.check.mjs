import assert from "node:assert/strict";
import { createServer } from "node:http";

// This check intentionally exercises the same HTTP routes used by the admin
// portal. It creates only disposable rows and removes them in finally.
const { default: app } = await import("../../artifacts/api-server/src/app.ts");
const {
  activityTable,
  auditLogTable,
  db,
  documentsTable,
  leadsTable,
  propertyDuplicateReviewsTable,
  propertyMarketingAssetsTable,
  propertyMergeHistoryTable,
  propertiesTable,
  savedPropertiesTable,
  tasksTable,
  usersTable,
  viewingsTable,
  pool,
} = await import("../../lib/db/src/index.ts");
const { eq, inArray, or } = await import("../../artifacts/api-server/node_modules/drizzle-orm/index.js");

const suffix = `${process.pid}-${Date.now()}`;
const password = "property-merge-recovery-check";
const adminEmail = `merge-check-admin-${suffix}@example.invalid`;
const viewerEmail = `merge-check-viewer-${suffix}@example.invalid`;
let adminId;
let viewerId;
let sourceId;
let canonicalId;
let reviewId;

function property(reference, title, values = {}) {
  return {
    reference,
    title,
    propertyType: "house",
    listingType: "sale",
    status: "public",
    pipelineStage: "published",
    price: 250000,
    suburb: "Borrowdale",
    city: "Harare",
    address: "1 Recovery Lane",
    bedrooms: 3,
    bathrooms: 2,
    views: 7,
    enquiries: 2,
    shares: 1,
    duplicateStatus: "clear",
    ...values,
  };
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${options.method ?? "GET"} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function cleanup() {
  const propertyIds = [sourceId, canonicalId].filter(Number.isInteger);
  const userIds = [adminId, viewerId].filter(Number.isInteger);
  if (reviewId) {
    await db.delete(propertyMergeHistoryTable).where(eq(propertyMergeHistoryTable.reviewId, reviewId));
    await db.delete(propertyDuplicateReviewsTable).where(eq(propertyDuplicateReviewsTable.id, reviewId));
  }
  if (propertyIds.length) {
    await db.delete(propertyMarketingAssetsTable).where(inArray(propertyMarketingAssetsTable.propertyId, propertyIds));
    await db.delete(savedPropertiesTable).where(inArray(savedPropertiesTable.propertyId, propertyIds));
    await db.delete(viewingsTable).where(inArray(viewingsTable.propertyId, propertyIds));
    await db.delete(tasksTable).where(inArray(tasksTable.propertyId, propertyIds));
    await db.delete(documentsTable).where(inArray(documentsTable.propertyId, propertyIds));
    await db.delete(leadsTable).where(inArray(leadsTable.propertyId, propertyIds));
    await db.delete(propertiesTable).where(inArray(propertiesTable.id, propertyIds));
  }
  if (userIds.length) {
    await db.delete(auditLogTable).where(inArray(auditLogTable.userId, userIds));
    await db.delete(activityTable).where(or(...userIds.map((id) => eq(activityTable.userName, id === adminId ? "Merge check admin" : "Merge check viewer"))));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
}

const server = createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.equal(typeof address, "object");
const baseUrl = `http://127.0.0.1:${address.port}/api`;

try {
  [adminId] = (await db.insert(usersTable).values({
    name: "Merge check admin",
    email: adminEmail,
    role: "admin",
    password,
  }).returning()).map((row) => row.id);
  [viewerId] = (await db.insert(usersTable).values({
    name: "Merge check viewer",
    email: viewerEmail,
    role: "agent",
    password,
  }).returning()).map((row) => row.id);
  [canonicalId] = (await db.insert(propertiesTable).values(property(`MERGE-CANONICAL-${suffix}`, "Canonical recovery property", {
    views: 10,
    enquiries: 3,
    shares: 2,
  })).returning()).map((row) => row.id);
  [sourceId] = (await db.insert(propertiesTable).values(property(`MERGE-SOURCE-${suffix}`, "Source recovery property", {
    privateNotes: "Restore this source note",
  })).returning()).map((row) => row.id);
  [reviewId] = (await db.insert(propertyDuplicateReviewsTable).values({
    sourcePropertyId: sourceId,
    candidatePropertyId: canonicalId,
    confidenceScore: 99,
    matchingFields: ["address", "bedrooms"],
    imageMatches: [],
  }).returning()).map((row) => row.id);

  await db.insert(leadsTable).values({
    name: "Recovery lead",
    email: `lead-${suffix}@example.invalid`,
    propertyId: sourceId,
  });
  await db.insert(tasksTable).values({
    title: "Recovery task",
    propertyId: sourceId,
  });
  await db.insert(viewingsTable).values({
    propertyId: sourceId,
    buyerName: "Recovery buyer",
    scheduledAt: new Date("2026-09-01T10:00:00.000Z"),
  });
  await db.insert(documentsTable).values({
    name: "Recovery document",
    category: "mandate",
    propertyId: sourceId,
    url: "object://recovery-document",
  });
  await db.insert(propertyMarketingAssetsTable).values({
    propertyId: sourceId,
    assetType: "photo",
    objectPath: "public/recovery-photo.jpg",
    attributionName: "Recovery agency",
  });
  await db.insert(savedPropertiesTable).values([
    { userId: adminId, propertyId: canonicalId },
    { userId: adminId, propertyId: sourceId },
    { userId: viewerId, propertyId: sourceId },
  ]);

  const login = await request(baseUrl, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password }),
  });
  assert.ok(login.accessToken, "admin login did not return an access token");
  const headers = { Authorization: `Bearer ${login.accessToken}` };

  const merge = await request(baseUrl, `/admin/duplicates/${reviewId}/merge`, {
    method: "POST",
    headers,
    body: JSON.stringify({ canonicalPropertyId: canonicalId }),
  });
  assert.equal(merge.history.snapshot.leads.length, 1);
  assert.equal(merge.history.snapshot.tasks.length, 1);
  assert.equal(merge.history.snapshot.viewings.length, 1);
  assert.equal(merge.history.snapshot.documents.length, 1);
  assert.equal(merge.history.snapshot.savedProperties.length, 2);
  assert.equal(merge.history.snapshot.marketingAssets.length, 1);

  const movedRows = await Promise.all([
    db.select().from(leadsTable).where(eq(leadsTable.propertyId, canonicalId)),
    db.select().from(tasksTable).where(eq(tasksTable.propertyId, canonicalId)),
    db.select().from(viewingsTable).where(eq(viewingsTable.propertyId, canonicalId)),
    db.select().from(documentsTable).where(eq(documentsTable.propertyId, canonicalId)),
    db.select().from(propertyMarketingAssetsTable).where(eq(propertyMarketingAssetsTable.propertyId, canonicalId)),
  ]);
  assert.deepEqual(movedRows.map((rows) => rows.length), [1, 1, 1, 1, 1]);
  assert.equal((await db.select().from(savedPropertiesTable).where(eq(savedPropertiesTable.propertyId, canonicalId))).length, 2);
  assert.equal((await db.select().from(savedPropertiesTable).where(eq(savedPropertiesTable.propertyId, sourceId))).length, 0);
  assert.equal((await request(baseUrl, `/properties/${canonicalId}/multi-agent`, { headers })).property.id, canonicalId);

  await request(baseUrl, `/admin/duplicates/${reviewId}/unmerge`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const [source] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, sourceId));
  const [canonical] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, canonicalId));
  assert.equal(source.canonicalPropertyId, null);
  assert.equal(source.status, "public");
  assert.equal(source.duplicateStatus, "clear");
  assert.equal(source.views, 7);
  assert.equal(source.privateNotes, "Restore this source note");
  assert.equal(canonical.views, 17);
  assert.deepEqual((await db.select().from(leadsTable).where(eq(leadsTable.propertyId, sourceId))).length, 1);
  assert.deepEqual((await db.select().from(tasksTable).where(eq(tasksTable.propertyId, sourceId))).length, 1);
  assert.deepEqual((await db.select().from(viewingsTable).where(eq(viewingsTable.propertyId, sourceId))).length, 1);
  assert.deepEqual((await db.select().from(documentsTable).where(eq(documentsTable.propertyId, sourceId))).length, 1);
  assert.deepEqual((await db.select().from(propertyMarketingAssetsTable).where(eq(propertyMarketingAssetsTable.propertyId, sourceId))).length, 1);
  assert.equal((await db.select().from(savedPropertiesTable).where(eq(savedPropertiesTable.propertyId, sourceId))).length, 2);
  assert.equal((await db.select().from(savedPropertiesTable).where(eq(savedPropertiesTable.propertyId, canonicalId))).length, 1);
  assert.equal((await request(baseUrl, `/properties/${canonicalId}/multi-agent`, { headers })).property.id, canonicalId);
  console.log("Property merge recovery check passed.");
} finally {
  await cleanup();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
}