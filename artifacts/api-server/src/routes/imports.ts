import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import {
  db,
  importChangesTable,
  importFilesTable,
  importRecordsTable,
  importSessionsTable,
  propertiesTable,
  propertyAgentRelationshipsTable,
  usersTable,
} from "@workspace/db";
import { currentUser } from "./auth";
import { getPrivateObjectDownloadUrl } from "./storage";
import { findDuplicateCandidates, normalizeText } from "../lib/multi-agent";
import { jsonify, logAudit } from "../lib/helpers";

const router: IRouter = Router();
const IMPORT_EXTENSIONS = new Set([".xlsx", ".xls", ".csv", ".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png"]);
const IMPORT_FIELDS = [
  "reference", "address", "suburb", "city", "price", "currency", "propertyType",
  "bedrooms", "bathrooms", "description", "agent", "agency", "mandateType",
  "mandateStart", "mandateExpiry", "availability", "contactName", "contactPhone",
  "contactEmail", "photos", "listingUrl",
] as const;
type ImportField = typeof IMPORT_FIELDS[number];
type LooseRecord = Record<string, unknown>;

const fieldAliases: Record<ImportField, string[]> = {
  reference: ["reference", "ref", "listing reference", "property reference", "mandate reference"],
  address: ["address", "street", "street address", "property address", "physical address"],
  suburb: ["suburb", "neighbourhood", "neighborhood", "area"],
  city: ["city", "town", "location"],
  price: ["price", "asking price", "sale price", "rent", "amount"],
  currency: ["currency", "price currency"],
  propertyType: ["property type", "type", "category"],
  bedrooms: ["bedrooms", "beds", "bed", "bedroom count"],
  bathrooms: ["bathrooms", "baths", "bath", "bathroom count"],
  description: ["description", "remarks", "notes", "details", "property description"],
  agent: ["agent", "agent name", "listed by", "sales agent"],
  agency: ["agency", "company", "branch", "agency name"],
  mandateType: ["mandate", "mandate type", "listing authority", "authority"],
  mandateStart: ["mandate start", "start date", "listing date"],
  mandateExpiry: ["mandate expiry", "expiry", "expiry date", "end date"],
  availability: ["availability", "status", "listing status"],
  contactName: ["contact", "contact name", "seller", "owner"],
  contactPhone: ["phone", "mobile", "contact phone", "seller phone"],
  contactEmail: ["email", "contact email", "seller email"],
  photos: ["photos", "images", "image urls", "photo urls"],
  listingUrl: ["url", "listing url", "website", "property url"],
};

function agencyIdFor(user: Awaited<ReturnType<typeof currentUser>>): number {
  return user?.branchId ?? 1;
}

function asText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function numberValue(value: unknown): number | null {
  const cleaned = asText(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function findSourceValue(row: LooseRecord, field: ImportField, mapping: Record<string, string>): unknown {
  const explicitlyMapped = mapping[field];
  if (explicitlyMapped && explicitlyMapped in row) return row[explicitlyMapped];
  const entries = Object.entries(row);
  const aliases = new Set(fieldAliases[field].map(normalizeHeader));
  const match = entries.find(([key]) => aliases.has(normalizeHeader(key)));
  return match?.[1];
}

function normaliseRow(row: LooseRecord, mapping: Record<string, string>): LooseRecord {
  const data: LooseRecord = {};
  for (const field of IMPORT_FIELDS) {
    const value = findSourceValue(row, field, mapping);
    if (value == null || asText(value) === "") continue;
    if (["price", "bedrooms", "bathrooms"].includes(field)) data[field] = numberValue(value);
    else if (field === "photos") data[field] = asText(value).split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
    else data[field] = asText(value);
  }
  return data;
}

function labelledTextToRow(text: string): LooseRecord[] {
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const records = blocks.map((block) => {
    const row: LooseRecord = {};
    for (const line of block.split("\n")) {
      const match = line.match(/^\s*([^:—-]{2,40})\s*[:—-]\s*(.+)$/);
      if (match) row[match[1].trim()] = match[2].trim();
    }
    return Object.keys(row).length ? row : { description: block };
  });
  return records.length ? records : [{ description: text }];
}

async function extractRows(fileName: string, bytes: Buffer): Promise<{ rows: LooseRecord[]; sourceType: string }> {
  const extension = extname(fileName).toLowerCase();
  if (extension === ".xlsx" || extension === ".xls" || extension === ".csv") {
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true });
    const rows = workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json<LooseRecord>(sheet, { defval: "" }).map((row) => ({
        ...row,
        __sheet: sheetName,
      }));
    });
    return { rows, sourceType: "spreadsheet" };
  }
  if (extension === ".pdf") {
    // Import the parser implementation rather than the package entrypoint:
    // pdf-parse's entrypoint runs its bundled fixture when loaded as an ESM
    // module, which would crash the API before it can listen.
    // @ts-expect-error pdf-parse v1 exposes its implementation without types.
    const parserModule = await import("pdf-parse/lib/pdf-parse.js");
    const result = await parserModule.default(bytes);
    return { rows: labelledTextToRow(result.text), sourceType: "pdf" };
  }
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return { rows: labelledTextToRow(result.value), sourceType: "document" };
  }
  if (extension === ".txt") return { rows: labelledTextToRow(bytes.toString("utf8")), sourceType: "text" };
  return { rows: [{ description: "", sourceFormat: "image" }], sourceType: "image" };
}

function mandateState(value: unknown): string {
  if (!value) return "unknown";
  const timestamp = Date.parse(asText(value));
  if (!Number.isFinite(timestamp)) return "unknown";
  const days = (timestamp - Date.now()) / 86_400_000;
  return days < 0 ? "expired" : days <= 30 ? "expiring_soon" : "active";
}

function validateData(data: LooseRecord, sourceType: string): string[] {
  const issues: string[] = [];
  if (!data.address) issues.push("Address is missing");
  if (!data.suburb) issues.push("Suburb is missing");
  if (!data.city) issues.push("City is missing");
  if (!data.propertyType) issues.push("Property type is missing");
  if (data.price == null) issues.push("Price is missing");
  if (sourceType === "image") issues.push("Image needs manual transcription or OCR review");
  return issues;
}

function confidenceFor(data: LooseRecord, sourceType: string): Record<string, number> {
  const confidence: Record<string, number> = {};
  for (const field of IMPORT_FIELDS) {
    if (data[field] == null || asText(data[field]) === "") continue;
    confidence[field] = sourceType === "spreadsheet" ? 92 : sourceType === "image" ? 24 : 72;
  }
  if (data.address) confidence.address = Math.min(98, (confidence.address ?? 50) + 4);
  if (data.price != null) confidence.price = Math.min(98, (confidence.price ?? 50) + 3);
  return confidence;
}

function effectiveData(record: typeof importRecordsTable.$inferSelect): LooseRecord {
  return (record.correctedData ?? record.extractedData) as LooseRecord;
}

async function sessionFor(id: number, agencyId: number) {
  const [session] = await db.select().from(importSessionsTable).where(and(
    eq(importSessionsTable.id, id),
    eq(importSessionsTable.agencyId, agencyId),
  ));
  return session;
}

async function detailFor(id: number, agencyId: number) {
  const session = await sessionFor(id, agencyId);
  if (!session) return null;
  const files = await db.select().from(importFilesTable).where(eq(importFilesTable.sessionId, id));
  const records = await db.select().from(importRecordsTable).where(eq(importRecordsTable.sessionId, id)).orderBy(importRecordsTable.id);
  const agents = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.branchId, agencyId));
  const agentsById = new Map(agents.map((agent) => [agent.id, agent.name]));
  return {
    ...jsonify(session),
    files: jsonify(files),
    records: records.map((record) => jsonify({
      id: record.id,
      sourceFileId: record.sourceFileId,
      sourceFileName: files.find((file) => file.id === record.sourceFileId)?.fileName ?? "Source file",
      sourceLocation: record.sourceLocation,
      rawData: record.rawData,
      data: effectiveData(record),
      fieldConfidence: record.fieldConfidence,
      confidenceScore: record.confidenceScore,
      reviewStatus: record.reviewStatus,
      duplicateStatus: record.duplicateStatus,
      matchedPropertyId: record.matchedPropertyId,
      match: record.sourceMetadata && typeof record.sourceMetadata === "object"
        ? (record.sourceMetadata as LooseRecord).duplicateMatch ?? null
        : null,
      validationIssues: record.validationIssues,
      mandateStatus: record.mandateStatus,
      agentMatchStatus: record.agentMatchStatus,
      agentId: record.agentId,
      agentName: record.agentId ? agentsById.get(record.agentId) ?? null : null,
      sourceMetadata: record.sourceMetadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })),
  };
}

async function updateCounters(sessionId: number) {
  const records = await db.select().from(importRecordsTable).where(eq(importRecordsTable.sessionId, sessionId));
  const counts = {
    totalRecords: records.length,
    recordsReady: records.filter((record) => record.reviewStatus === "approved" && Array.isArray(record.validationIssues) && record.validationIssues.length === 0 && record.duplicateStatus !== "possible").length,
    recordsNeedingReview: records.filter((record) => record.reviewStatus === "draft" || record.reviewStatus === "needs_review").length,
    recordsDuplicate: records.filter((record) => record.duplicateStatus === "possible").length,
    recordsPublished: records.filter((record) => record.reviewStatus === "published").length,
    recordsFailed: records.filter((record) => record.reviewStatus === "failed").length,
  };
  await db.update(importSessionsTable).set({ ...counts, updatedAt: new Date() }).where(eq(importSessionsTable.id, sessionId));
}

async function processSession(sessionId: number, agencyId: number, mapping: Record<string, string>) {
  const session = await sessionFor(sessionId, agencyId);
  if (!session) return;
  await db.update(importSessionsTable).set({
    status: "processing",
    currentStage: "extract",
    progress: 5,
    columnMapping: mapping,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(importSessionsTable.id, sessionId));
  const files = await db.select().from(importFilesTable).where(eq(importFilesTable.sessionId, sessionId));
  try {
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      await db.update(importFilesTable).set({ processingStatus: "processing", error: null, updatedAt: new Date() }).where(eq(importFilesTable.id, file.id));
      const signedUrl = await getPrivateObjectDownloadUrl(file.storagePath);
      const response = await fetch(signedUrl, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Could not download ${file.fileName} from private storage.`);
      const { rows, sourceType } = await extractRows(file.fileName, Buffer.from(await response.arrayBuffer()));
      let createdCount = 0;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const rawData = rows[rowIndex];
        const data = normaliseRow(rawData, mapping);
        const confidence = confidenceFor(data, sourceType);
        const confidenceValues = Object.values(confidence);
        const confidenceScore = confidenceValues.length ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) : 0;
        const validationIssues = validateData(data, sourceType);
        let duplicateStatus = "clear";
        let matchedPropertyId: number | null = null;
        let duplicateMatch: LooseRecord | null = null;
        if (data.address || data.suburb || data.price) {
          const candidates = await findDuplicateCandidates({
            address: asText(data.address),
            suburb: asText(data.suburb),
            city: asText(data.city),
            propertyType: asText(data.propertyType),
            bedrooms: numberValue(data.bedrooms),
            bathrooms: numberValue(data.bathrooms),
            price: numberValue(data.price),
            description: asText(data.description),
          });
          const scoped = candidates.filter((candidate) => candidate.property.branchId === agencyId);
          const match = scoped[0];
          if (match && match.confidenceScore >= 70) {
            duplicateStatus = "possible";
            matchedPropertyId = match.property.id;
            duplicateMatch = {
              id: match.property.id,
              reference: match.property.reference,
              title: match.property.title,
              address: match.property.address,
              confidenceScore: match.confidenceScore,
              matchingFields: match.matchingFields,
            };
          }
        }
        const mandateStatus = mandateState(data.mandateExpiry);
        await db.insert(importRecordsTable).values({
          sessionId,
          sourceFileId: file.id,
          sourceLocation: sourceType === "spreadsheet" ? `row ${rowIndex + 2}` : `section ${rowIndex + 1}`,
          rawData,
          extractedData: data,
          fieldConfidence: confidence,
          confidenceScore,
          reviewStatus: "draft",
          duplicateStatus,
          matchedPropertyId,
          validationIssues,
          mandateStatus,
          agentMatchStatus: data.agent ? "suggested" : "unmatched",
          sourceMetadata: { sourceType, duplicateMatch },
        });
        createdCount += 1;
      }
      await db.update(importFilesTable).set({ processingStatus: "complete", extractedRecordCount: createdCount, updatedAt: new Date() }).where(eq(importFilesTable.id, file.id));
      await db.update(importSessionsTable).set({
        currentStage: "review",
        progress: Math.min(90, Math.round(((fileIndex + 1) / files.length) * 85) + 5),
        updatedAt: new Date(),
      }).where(eq(importSessionsTable.id, sessionId));
    }
    await updateCounters(sessionId);
    await db.update(importSessionsTable).set({ status: "review", currentStage: "review", progress: 100, updatedAt: new Date() }).where(eq(importSessionsTable.id, sessionId));
    await logAudit("import_processed", "import_session", sessionId, `Extracted ${files.length} source file(s)`, session.createdBy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import processing failed.";
    await db.update(importSessionsTable).set({ status: "failed", currentStage: "error", lastError: message, updatedAt: new Date() }).where(eq(importSessionsTable.id, sessionId));
  }
}

router.get("/imports/sessions", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const sessions = await db.select().from(importSessionsTable)
    .where(eq(importSessionsTable.agencyId, agencyIdFor(user)))
    .orderBy(desc(importSessionsTable.createdAt));
  res.json(jsonify(sessions));
});

router.post("/imports/sessions", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const files = Array.isArray(req.body?.files) ? req.body.files as LooseRecord[] : [];
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!files.length || files.some((file) => typeof file.fileName !== "string" || typeof file.fileType !== "string" || typeof file.sizeBytes !== "number" || typeof file.storagePath !== "string")) {
    res.status(400).json({ error: "At least one uploaded source file is required." }); return;
  }
  if (files.some((file) => !IMPORT_EXTENSIONS.has(extname(asText(file.fileName)).toLowerCase()))) {
    res.status(400).json({ error: "One or more file types are not supported." }); return;
  }
  const agencyId = agencyIdFor(user);
  const [session] = await db.insert(importSessionsTable).values({
    reference: `IMP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    agencyId,
    createdBy: user.id,
    totalFiles: files.length,
  }).returning();
  await db.insert(importFilesTable).values(files.map((file) => ({
    sessionId: session.id,
    fileName: asText(file.fileName),
    fileType: asText(file.fileType),
    sizeBytes: Number(file.sizeBytes),
    storagePath: asText(file.storagePath),
  })));
  const detail = await detailFor(session.id, agencyId);
  res.status(201).json(detail);
});

router.get("/imports/sessions/:id", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const id = Number(req.params.id);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const detail = await detailFor(id, agencyIdFor(user));
  if (!detail) { res.status(404).json({ error: "Import session not found." }); return; }
  res.json(detail);
});

router.post("/imports/sessions/:id/process", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const id = Number(req.params.id);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const session = await sessionFor(id, agencyIdFor(user));
  if (!session) { res.status(404).json({ error: "Import session not found." }); return; }
  if (req.body?.columnMapping && typeof req.body.columnMapping !== "object") {
    res.status(400).json({ error: "Column mapping must be an object." }); return;
  }
  const mapping = (req.body?.columnMapping ?? session.columnMapping) as Record<string, string>;
  void processSession(id, agencyIdFor(user), mapping);
  res.status(202).json(jsonify({ ...session, status: "processing", currentStage: "extract", progress: 5, columnMapping: mapping }));
});

router.patch("/imports/sessions/:id/records/:recordId", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const sessionId = Number(req.params.id);
  const recordId = Number(req.params.recordId);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const session = await sessionFor(sessionId, agencyIdFor(user));
  const [record] = await db.select().from(importRecordsTable).where(and(eq(importRecordsTable.id, recordId), eq(importRecordsTable.sessionId, sessionId)));
  if (!session || !record) { res.status(404).json({ error: "Import record not found." }); return; }
  if (!req.body?.data || typeof req.body.data !== "object") { res.status(400).json({ error: "Record data is required." }); return; }
  const nextData = req.body.data as LooseRecord;
  const previousData = effectiveData(record);
  const changes = Object.keys(nextData).filter((field) => JSON.stringify(previousData[field]) !== JSON.stringify(nextData[field]));
  await db.update(importRecordsTable).set({
    correctedData: nextData,
    validationIssues: validateData(nextData, asText((record.sourceMetadata as LooseRecord)?.sourceType ?? "spreadsheet")),
    confidenceScore: 100,
    reviewStatus: req.body.reviewStatus === "approved" ? "approved" : "needs_review",
    agentId: req.body.agentId === null ? null : Number.isInteger(req.body.agentId) ? req.body.agentId : record.agentId,
    agentMatchStatus: req.body.agentId ? "matched" : record.agentMatchStatus,
    mandateStatus: mandateState(nextData.mandateExpiry),
    updatedAt: new Date(),
  }).where(eq(importRecordsTable.id, recordId));
  if (changes.length) {
    await db.insert(importChangesTable).values(changes.map((field) => ({
      recordId,
      fieldName: field,
      oldValue: previousData[field] ?? null,
      newValue: nextData[field] ?? null,
      changedBy: user.id,
    })));
  }
  await updateCounters(sessionId);
  const detail = await detailFor(sessionId, agencyIdFor(user));
  const updated = detail?.records.find((item) => item.id === recordId);
  res.json(updated);
});

router.post("/imports/sessions/:id/bulk-action", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const sessionId = Number(req.params.id);
  const recordIds = Array.isArray(req.body?.recordIds) ? req.body.recordIds.filter(Number.isInteger) : [];
  const action = asText(req.body?.action);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const session = await sessionFor(sessionId, agencyIdFor(user));
  if (!session || !recordIds.length) { res.status(400).json({ error: "A session and at least one record are required." }); return; }
  const records = await db.select().from(importRecordsTable).where(and(eq(importRecordsTable.sessionId, sessionId), inArray(importRecordsTable.id, recordIds)));
  const update: Partial<typeof importRecordsTable.$inferInsert> = { updatedAt: new Date() };
  if (action === "approve") update.reviewStatus = "approved";
  else if (action === "reject") update.reviewStatus = "rejected";
  else if (action === "clear_duplicate") update.duplicateStatus = "clear";
  else if (action === "mark_duplicate") update.duplicateStatus = "possible";
  else if (action === "assign" && (req.body.agentId === null || Number.isInteger(req.body.agentId))) {
    update.agentId = req.body.agentId;
    update.agentMatchStatus = req.body.agentId ? "matched" : "unmatched";
  } else { res.status(400).json({ error: "Unsupported bulk action." }); return; }
  await db.update(importRecordsTable).set(update).where(inArray(importRecordsTable.id, records.map((record) => record.id)));
  await updateCounters(sessionId);
  const detail = await detailFor(sessionId, agencyIdFor(user));
  res.json(detail);
});

router.post("/imports/sessions/:id/publish", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const sessionId = Number(req.params.id);
  const recordIds = Array.isArray(req.body?.recordIds) ? req.body.recordIds.filter(Number.isInteger) : [];
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const session = await sessionFor(sessionId, agencyIdFor(user));
  if (!session || !recordIds.length) { res.status(400).json({ error: "Select at least one approved record to publish." }); return; }
  const records = await db.select().from(importRecordsTable).where(and(eq(importRecordsTable.sessionId, sessionId), inArray(importRecordsTable.id, recordIds)));
  let created = 0; let linked = 0; let published = 0; const errors: string[] = [];
  for (const record of records) {
    const data = effectiveData(record);
    const issues = validateData(data, "spreadsheet").filter((issue) => !issue.includes("Image needs"));
    if (record.reviewStatus !== "approved" || issues.length || (record.duplicateStatus === "possible" && !record.matchedPropertyId)) {
      errors.push(`Record ${record.id}: approve the record and resolve validation or duplicate issues first.`);
      continue;
    }
    try {
      let propertyId = record.matchedPropertyId;
      if (!propertyId) {
        const [property] = await db.insert(propertiesTable).values({
          reference: asText(data.reference) || `pending-${randomUUID()}`,
          title: asText(data.title) || `${asText(data.propertyType) || "Property"} in ${asText(data.suburb)}`,
          description: asText(data.description) || null,
          propertyType: asText(data.propertyType) || "residential",
          listingType: "sale",
          status: "public",
          pipelineStage: "published",
          price: numberValue(data.price) ?? 0,
          currency: asText(data.currency) || "USD",
          suburb: asText(data.suburb),
          city: asText(data.city),
          address: asText(data.address) || null,
          bedrooms: numberValue(data.bedrooms),
          bathrooms: numberValue(data.bathrooms),
          photos: Array.isArray(data.photos) ? data.photos.map(asText).filter(Boolean) : [],
          agentId: record.agentId,
          branchId: agencyIdFor(user),
          mandateType: asText(data.mandateType) || null,
          mandateStart: asText(data.mandateStart) || null,
          mandateExpiry: asText(data.mandateExpiry) || null,
          publishedAt: new Date(),
          updatedAt: new Date(),
        }).returning({ id: propertiesTable.id });
        propertyId = property.id;
        created += 1;
      } else {
        linked += 1;
      }
      if (record.agentId && propertyId) {
        const [existingRelationship] = await db.select({ id: propertyAgentRelationshipsTable.id }).from(propertyAgentRelationshipsTable).where(and(
          eq(propertyAgentRelationshipsTable.propertyId, propertyId),
          eq(propertyAgentRelationshipsTable.agentId, record.agentId),
          eq(propertyAgentRelationshipsTable.relationshipStatus, "active"),
        ));
        if (!existingRelationship) {
          const [relationship] = await db.insert(propertyAgentRelationshipsTable).values({
            propertyId,
            agentId: record.agentId,
            branchId: agencyIdFor(user),
            askingPrice: numberValue(data.price) ?? 0,
            currency: asText(data.currency) || "USD",
            mandateType: asText(data.mandateType) || "non_exclusive",
            description: asText(data.description) || null,
            contactName: asText(data.contactName) || null,
            contactPhone: asText(data.contactPhone) || null,
            contactEmail: asText(data.contactEmail) || null,
            lastUpdate: new Date(),
          }).returning({ id: propertyAgentRelationshipsTable.id });
          await db.update(importRecordsTable).set({ finalRelationshipId: relationship.id }).where(eq(importRecordsTable.id, record.id));
        }
      }
      await db.update(importRecordsTable).set({ finalPropertyId: propertyId, reviewStatus: "published", updatedAt: new Date() }).where(eq(importRecordsTable.id, record.id));
      published += 1;
    } catch (error) {
      errors.push(`Record ${record.id}: ${error instanceof Error ? error.message : "publish failed"}`);
      await db.update(importRecordsTable).set({ reviewStatus: "failed", updatedAt: new Date() }).where(eq(importRecordsTable.id, record.id));
    }
  }
  await updateCounters(sessionId);
  await db.update(importSessionsTable).set({ status: errors.length ? "review" : "published", currentStage: errors.length ? "review" : "published", updatedAt: new Date() }).where(eq(importSessionsTable.id, sessionId));
  await logAudit("import_published", "import_session", sessionId, `Published ${published} record(s)`, user.id, user.name);
  res.json({ published, linked, created, failed: errors.length, errors });
});

router.get("/imports/sessions/:id/error-report", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const sessionId = Number(req.params.id);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const session = await sessionFor(sessionId, agencyIdFor(user));
  if (!session) { res.status(404).send("Import session not found."); return; }
  const records = await db.select().from(importRecordsTable).where(and(eq(importRecordsTable.sessionId, sessionId), ne(importRecordsTable.reviewStatus, "published")));
  const csv = ["record_id,source_location,issues,review_status", ...records.map((record) => [
    record.id,
    JSON.stringify(record.sourceLocation ?? ""),
    JSON.stringify((record.validationIssues as string[]).join("; ")),
    record.reviewStatus,
  ].join(","))].join("\n");
  res.type("text/csv").attachment(`${session.reference}-errors.csv`).send(csv);
});

router.post("/imports/assistant", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const prompt = asText(req.body?.prompt);
  const sessionId = Number(req.body?.sessionId);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (!prompt || !await sessionFor(sessionId, agencyIdFor(user))) { res.status(400).json({ error: "A valid import session and question are required." }); return; }
  const lower = prompt.toLowerCase();
  const message = lower.includes("duplicate")
    ? "Review the highlighted match fields before publishing. A possible duplicate should be linked only when the address and agency ownership are correct."
    : lower.includes("mapping")
      ? "Map source columns to the canonical fields, then reprocess the session. Corrections made in the review grid always override extraction suggestions."
      : "I can help explain a confidence flag, suggest a column mapping, or walk through a duplicate decision. Keep records in draft until the final review is complete.";
  res.json({
    message,
    suggestions: ["Suggest mappings for this file", "Explain the highlighted duplicate", "Which records are safe to approve?"],
  });
});

export default router;