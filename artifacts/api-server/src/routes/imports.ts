import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { ai } from "@workspace/integrations-gemini-ai";
import { batchProcess } from "@workspace/integrations-gemini-ai/batch";
import {
  db,
  importChangesTable,
  importFieldConfidenceTable,
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
import { logger } from "../lib/logger";
import { matchPropertyToAlerts } from "../lib/property-alerts";

const router: IRouter = Router();
const IMPORT_EXTENSIONS = new Set([".xlsx", ".xls", ".csv", ".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png"]);
const IMPORT_FIELDS = [
  "title", "reference", "address", "suburb", "city", "price", "currency", "propertyType",
  "bedrooms", "bathrooms", "description", "agent", "agency", "mandateType",
  "mandateStart", "mandateExpiry", "availability", "contactName", "contactPhone",
  "contactEmail", "photos", "listingUrl",
] as const;
type ImportField = typeof IMPORT_FIELDS[number];
type LooseRecord = Record<string, unknown>;
type VisionFieldSource = {
  confidence: number;
  evidence: string;
  method: "gemini-vision";
};
type ExtractionResult = {
  rows: LooseRecord[];
  sourceType: string;
  fieldConfidence?: Record<string, number>[];
  fieldSources?: Record<string, VisionFieldSource>[];
  reviewFlags?: string[][];
  sourceIdentities?: string[];
};
type ImageExtractionResult = {
  fileId: number;
  extraction?: ExtractionResult;
  error?: string;
};

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};
const VISION_REVIEW_THRESHOLD = 70;
const IMPORT_WORKER_ID = randomUUID();
const IMPORT_LEASE_MS = 15 * 60 * 1000;

const fieldAliases: Record<ImportField, string[]> = {
  title: ["title", "listing title", "property title", "headline", "name"],
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
  if (field in row) return row[field];
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
    else if (field === "photos") data[field] = Array.isArray(value)
      ? value.map(asText).filter(Boolean)
      : asText(value).split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
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

function parseJsonResponse(raw: string): LooseRecord {
  const withoutFence = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(withoutFence) as LooseRecord;
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(withoutFence.slice(start, end + 1)) as LooseRecord; } catch { /* handled below */ }
    }
    throw new Error("Vision extraction returned invalid JSON.");
  }
}

function confidenceValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed <= 1 ? parsed * 100 : parsed)));
}

function normaliseVisionRows(parsed: LooseRecord): {
  rows: LooseRecord[];
  fieldConfidence: Record<string, number>[];
  fieldSources: Record<string, VisionFieldSource>[];
  reviewFlags: string[][];
  sourceIdentities: string[];
} {
  const candidates = Array.isArray(parsed.records)
    ? parsed.records
    : parsed.fields && typeof parsed.fields === "object"
      ? [parsed]
      : [parsed];
  const rows: LooseRecord[] = [];
  const fieldConfidence: Record<string, number>[] = [];
  const fieldSources: Record<string, VisionFieldSource>[] = [];
  const reviewFlags: string[][] = [];
  const sourceIdentities: string[] = [];

  for (const candidateValue of candidates) {
    if (!candidateValue || typeof candidateValue !== "object" || Array.isArray(candidateValue)) continue;
    const candidate = candidateValue as LooseRecord;
    const rawFields = candidate.fields && typeof candidate.fields === "object" && !Array.isArray(candidate.fields)
      ? candidate.fields as LooseRecord
      : candidate;
    const rawConfidence = candidate.fieldConfidence && typeof candidate.fieldConfidence === "object"
      ? candidate.fieldConfidence as LooseRecord
      : {};
    const rawEvidence = candidate.fieldEvidence && typeof candidate.fieldEvidence === "object"
      ? candidate.fieldEvidence as LooseRecord
      : {};
    const row: LooseRecord = {};
    const confidence: Record<string, number> = {};
    const sources: Record<string, VisionFieldSource> = {};

    for (const field of IMPORT_FIELDS) {
      const value = rawFields[field];
      if (value == null || asText(value) === "") continue;
      row[field] = value;
      const score = confidenceValue(rawConfidence[field], 55);
      confidence[field] = score;
      sources[field] = {
        confidence: score,
        evidence: asText(rawEvidence[field]) || "Value read from the uploaded image.",
        method: "gemini-vision",
      };
    }

    if (Object.keys(row).length) {
      rows.push(row);
      fieldConfidence.push(confidence);
      fieldSources.push(sources);
      const identityText = (value: unknown) => asText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const reference = identityText(row.reference);
      const address = identityText(row.address);
      const rawBoundingBox = Array.isArray(candidate.boundingBox)
        ? candidate.boundingBox.slice(0, 4).map(Number)
        : [];
      const boundingBox = rawBoundingBox.length === 4 && rawBoundingBox.every(Number.isFinite)
        ? rawBoundingBox.map((value) => Math.round(value / 25) * 25).join(",")
        : "";
      const fallbackFacts = IMPORT_FIELDS.map((field) => identityText(row[field])).filter(Boolean).join("|");
      const identityBasis = reference
        ? `reference:${reference}`
        : address
          ? `address:${address}`
          : boundingBox && boundingBox !== "0,0,0,0"
            ? `region:${boundingBox}`
            : `facts:${fallbackFacts}`;
      sourceIdentities.push(`vision:${createHash("sha256").update(identityBasis).digest("hex").slice(0, 24)}`);
      const flags = Array.isArray(candidate.reviewFlags)
        ? candidate.reviewFlags.map(asText).filter(Boolean)
        : [];
      const lowConfidenceFields = Object.entries(confidence)
        .filter(([, score]) => score < VISION_REVIEW_THRESHOLD)
        .map(([field]) => field);
      if (lowConfidenceFields.length) {
        flags.push(`Low-confidence vision fields: ${lowConfidenceFields.join(", ")}`);
      }
      reviewFlags.push([...new Set(flags)]);
    }
  }

  if (!rows.length) throw new Error("Vision extraction found no listing fields in the image.");
  return { rows, fieldConfidence, fieldSources, reviewFlags, sourceIdentities };
}

async function withRetries<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function extractImageRows(fileName: string, bytes: Buffer): Promise<ExtractionResult> {
  const extension = extname(fileName).toLowerCase();
  const mimeType = IMAGE_MIME_TYPES[extension];
  if (!mimeType) throw new Error("Only JPG, JPEG and PNG files can be vision processed.");
  const response = await withRetries(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        {
          inlineData: {
            data: bytes.toString("base64"),
            mimeType,
          },
        },
        {
          text: `Extract real-estate listing candidates from this agency image. It may be a scanned flyer, screenshot, or property photograph with overlaid text.

Return raw JSON only in this shape:
{
  "records": [
    {
      "fields": {
        "title": "string or null",
        "reference": "string or null",
        "address": "string or null",
        "suburb": "string or null",
        "city": "string or null",
        "price": "number or null",
        "currency": "string or null",
        "propertyType": "string or null",
        "bedrooms": "number or null",
        "bathrooms": "number or null",
        "description": "string or null",
        "agent": "string or null",
        "agency": "string or null",
        "mandateType": "string or null",
        "mandateStart": "string or null",
        "mandateExpiry": "string or null",
        "availability": "string or null",
        "contactName": "string or null",
        "contactPhone": "string or null",
        "contactEmail": "string or null",
        "photos": [],
        "listingUrl": "string or null"
      },
      "fieldConfidence": { "fieldName": 0 },
      "fieldEvidence": { "fieldName": "short visible text or location in image" },
      "boundingBox": [0, 0, 1000, 1000],
      "reviewFlags": ["optional reason for human review"]
    }
  ]
}

Rules:
- Only include values visibly present or strongly legible in the image. Never invent missing values.
- Use null for absent values and confidence 0-100 for each included field.
- Preserve phone numbers, references, currency and dates exactly when legible.
- boundingBox is the approximate [top, left, bottom, right] region containing this listing, using integer coordinates from 0 to 1000.
- Do not turn the uploaded image into a photo URL. The source image is tracked by QuickProp.
- Use one record per distinct listing visible in the image.`,
        },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  }), 3);
  const parsed = parseJsonResponse(response.text?.trim() ?? "");
  const normalised = normaliseVisionRows(parsed);
  return {
    ...normalised,
    sourceType: "image",
  };
}

async function extractRows(fileName: string, bytes: Buffer): Promise<ExtractionResult> {
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
  return extractImageRows(fileName, bytes);
}

function mandateState(value: unknown): string {
  if (!value) return "unknown";
  const timestamp = Date.parse(asText(value));
  if (!Number.isFinite(timestamp)) return "unknown";
  const days = (timestamp - Date.now()) / 86_400_000;
  return days < 0 ? "expired" : days <= 30 ? "expiring_soon" : "active";
}

function validateData(data: LooseRecord, sourceType: string, confidence: Record<string, number> = {}): string[] {
  const issues: string[] = [];
  if (!data.address) issues.push("Address is missing");
  if (!data.suburb) issues.push("Suburb is missing");
  if (!data.city) issues.push("City is missing");
  if (!data.propertyType) issues.push("Property type is missing");
  if (data.price == null) issues.push("Price is missing");
  if (sourceType === "image") {
    const lowConfidenceFields = Object.entries(confidence)
      .filter(([, score]) => score < VISION_REVIEW_THRESHOLD)
      .map(([field]) => field);
    if (lowConfidenceFields.length) issues.push(`Vision confidence is below ${VISION_REVIEW_THRESHOLD}% for: ${lowConfidenceFields.join(", ")}`);
    if (!Object.keys(data).length) issues.push("Vision extraction found no listing fields.");
  }
  return issues;
}

function confidenceFor(data: LooseRecord, sourceType: string, extracted?: Record<string, number>): Record<string, number> {
  const confidence: Record<string, number> = {};
  for (const field of IMPORT_FIELDS) {
    if (data[field] == null || asText(data[field]) === "") continue;
    confidence[field] = extracted?.[field] ?? (sourceType === "spreadsheet" ? 92 : sourceType === "image" ? 24 : 72);
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

function workerLeaseUntil(now = new Date()): Date {
  return new Date(now.getTime() + IMPORT_LEASE_MS);
}

function ownedSessionWhere(sessionId: number, agencyId: number) {
  return and(
    eq(importSessionsTable.id, sessionId),
    eq(importSessionsTable.agencyId, agencyId),
    eq(importSessionsTable.processingWorkerId, IMPORT_WORKER_ID),
    eq(importSessionsTable.status, "processing"),
  );
}

type ProcessOptions = {
  resumeOnly?: boolean;
};

async function processSession(
  sessionId: number,
  agencyId: number,
  mapping: Record<string, string>,
  options: ProcessOptions = {},
) {
  const session = await sessionFor(sessionId, agencyId);
  if (!session) return;
  const [started] = await db.update(importSessionsTable).set({
    columnMapping: mapping,
    lastError: null,
    processingHeartbeatAt: new Date(),
    processingLeaseUntil: workerLeaseUntil(),
    updatedAt: new Date(),
  }).where(ownedSessionWhere(sessionId, agencyId)).returning({ id: importSessionsTable.id });
  if (!started) return;
  const fileFailures: string[] = [];
  let heartbeatTimer: NodeJS.Timeout | undefined;
  try {
    const allFiles = await db.select().from(importFilesTable).where(eq(importFilesTable.sessionId, sessionId));
    const files = options.resumeOnly
      ? allFiles.filter((file) => file.processingStatus !== "complete")
      : allFiles;
    const imageFiles = files.filter((file) => Boolean(IMAGE_MIME_TYPES[extname(file.fileName).toLowerCase()]));
    const completedBefore = allFiles.length - files.length;
    heartbeatTimer = setInterval(() => {
      void db.update(importSessionsTable).set({
        processingHeartbeatAt: new Date(),
        processingLeaseUntil: workerLeaseUntil(),
        updatedAt: new Date(),
      }).where(ownedSessionWhere(sessionId, agencyId)).catch(() => undefined);
    }, 30_000);
    await db.update(importSessionsTable).set({
      currentStage: "extract",
      progress: Math.max(session.progress, files.length ? Math.min(90, Math.round((completedBefore / allFiles.length) * 85) + 5) : 90),
      updatedAt: new Date(),
    }).where(ownedSessionWhere(sessionId, agencyId));
    if (imageFiles.length) {
      await db.update(importFilesTable).set({
        processingStatus: "processing",
        processingAttempt: sql`${importFilesTable.processingAttempt} + 1`,
        processingStartedAt: new Date(),
        error: null,
        completedAt: null,
        updatedAt: new Date(),
      }).where(inArray(importFilesTable.id, imageFiles.map((file) => file.id)));
    }
    const imageResults = new Map<number, ImageExtractionResult>();
    if (imageFiles.length) {
      const results = await batchProcess(
        imageFiles,
        async (file): Promise<ImageExtractionResult> => {
          try {
            const signedUrl = await getPrivateObjectDownloadUrl(file.storagePath);
            const response = await fetch(signedUrl, { signal: AbortSignal.timeout(60_000) });
            if (!response.ok) throw new Error(`Could not download ${file.fileName} from private storage.`);
            const extraction = await extractImageRows(file.fileName, Buffer.from(await response.arrayBuffer()));
            return { fileId: file.id, extraction };
          } catch (error) {
            return {
              fileId: file.id,
              error: error instanceof Error ? error.message : "Vision extraction failed.",
            };
          }
        },
        {
          concurrency: 2,
          retries: 3,
        },
      );
      results.forEach((result) => imageResults.set(result.fileId, result));
    }

    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      if (!imageFiles.some((imageFile) => imageFile.id === file.id)) {
        await db.update(importFilesTable).set({
          processingStatus: "processing",
          processingAttempt: sql`${importFilesTable.processingAttempt} + 1`,
          processingStartedAt: new Date(),
          error: null,
          completedAt: null,
          updatedAt: new Date(),
        }).where(eq(importFilesTable.id, file.id));
      }
      const imageResult = imageResults.get(file.id);
      if (imageResult?.error) {
        fileFailures.push(`${file.fileName}: ${imageResult.error}`);
        await db.update(importFilesTable).set({
          processingStatus: "failed",
          error: imageResult.error,
          completedAt: null,
          updatedAt: new Date(),
        }).where(eq(importFilesTable.id, file.id));
        continue;
      }
      let extraction: ExtractionResult;
      try {
        if (imageResult?.extraction) {
          extraction = imageResult.extraction;
        } else {
          const signedUrl = await getPrivateObjectDownloadUrl(file.storagePath);
          const response = await fetch(signedUrl, { signal: AbortSignal.timeout(60_000) });
          if (!response.ok) throw new Error(`Could not download ${file.fileName} from private storage.`);
          extraction = await extractRows(file.fileName, Buffer.from(await response.arrayBuffer()));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Source extraction failed.";
        fileFailures.push(`${file.fileName}: ${message}`);
        await db.update(importFilesTable).set({
          processingStatus: "failed",
          error: message,
          completedAt: null,
          updatedAt: new Date(),
        }).where(eq(importFilesTable.id, file.id));
        continue;
      }
      try {
        const { rows, sourceType } = extraction;
        await db.transaction(async (tx) => {
          const existingRows = await tx.select().from(importRecordsTable).where(eq(importRecordsTable.sourceFileId, file.id));
          const replaceableImageRows = sourceType === "image"
            ? existingRows.filter((record) => record.correctedData == null && ["draft", "needs_review"].includes(record.reviewStatus))
            : [];
          if (replaceableImageRows.length) {
            const replaceableIds = replaceableImageRows.map((record) => record.id);
            await tx.delete(importFieldConfidenceTable).where(inArray(importFieldConfidenceTable.recordId, replaceableIds));
            await tx.delete(importRecordsTable).where(inArray(importRecordsTable.id, replaceableIds));
          }
          const retainedRows = replaceableImageRows.length
            ? existingRows.filter((record) => !replaceableImageRows.some((replaceable) => replaceable.id === record.id))
            : existingRows;
          const updatableRows = retainedRows.filter((record) => (
            record.reviewStatus !== "published"
            && (sourceType !== "image" || record.correctedData != null)
          ));
          const existingByLocation = new Map(updatableRows.map((record) => [record.sourceLocation, record]));
          const existingByIdentity = new Map<string, (typeof updatableRows)[number]>();
          for (const record of updatableRows) {
            const identity = asText((record.sourceMetadata as LooseRecord)?.sourceIdentity);
            if (identity) existingByIdentity.set(identity, record);
          }
          const protectedIdentities = new Set(
            retainedRows
              .filter((record) => !updatableRows.some((updatable) => updatable.id === record.id))
              .map((record) => asText((record.sourceMetadata as LooseRecord)?.sourceIdentity))
              .filter(Boolean),
          );
          let createdCount = 0;

          for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            const rawData = rows[rowIndex];
            const sourceLocation = sourceType === "spreadsheet"
              ? `row ${rowIndex + 2}`
              : sourceType === "image"
                ? `image region ${rowIndex + 1}`
                : `section ${rowIndex + 1}`;
            const sourceIdentity = extraction.sourceIdentities?.[rowIndex];
            if (sourceType === "image" && sourceIdentity && protectedIdentities.has(sourceIdentity)) {
              createdCount += 1;
              continue;
            }
            const data = normaliseRow(rawData, mapping);
            const confidence = confidenceFor(data, sourceType, extraction.fieldConfidence?.[rowIndex]);
            const confidenceValues = Object.values(confidence);
            const confidenceScore = confidenceValues.length ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) : 0;
            const validationIssues = validateData(data, sourceType, confidence);
            const lowConfidence = confidenceScore < VISION_REVIEW_THRESHOLD;
            if (sourceType === "image" && lowConfidence) {
              validationIssues.push(`Overall vision confidence is ${confidenceScore}%; review before approval.`);
            }
            const fieldSources = Object.fromEntries(Object.entries(confidence).map(([field, score]) => [
              field,
              extraction.fieldSources?.[rowIndex]?.[field] ?? {
                confidence: score,
                evidence: "Value read from the uploaded image.",
                method: "gemini-vision" as const,
              },
            ]));
            const reviewFlags = [
              ...(extraction.reviewFlags?.[rowIndex] ?? []),
              ...(validationIssues.filter((issue) => issue.toLowerCase().includes("vision"))),
            ];
            let duplicateStatus = "clear";
            let matchedPropertyId: number | null = null;
            let duplicateMatch: LooseRecord | null = null;
            let changeSummary: string[] = [];
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
                changeSummary = [
                  "price", "currency", "description", "bedrooms", "bathrooms", "mandateExpiry", "availability",
                ].filter((field) => data[field] != null && asText(data[field]) !== asText((match.property as LooseRecord)[field]));
              }
            }
            const mandateStatus = mandateState(data.mandateExpiry);
            const existing = sourceType === "image" && sourceIdentity
              ? existingByIdentity.get(sourceIdentity)
              : existingByLocation.get(sourceLocation);
            const recordValues = {
              rawData,
              extractedData: data,
              fieldConfidence: confidence,
              confidenceScore,
              duplicateStatus,
              matchedPropertyId,
              validationIssues,
              mandateStatus,
              agentMatchStatus: data.agent ? "suggested" : "unmatched",
              sourceMetadata: {
                sourceType,
                extractionMethod: sourceType === "image" ? "gemini-vision" : sourceType,
                sourceFileName: file.fileName,
                sourceLocation,
                sourceIdentity,
                fieldSources,
                reviewFlags: [...new Set(reviewFlags)],
                duplicateMatch,
                changeSummary,
              },
              updatedAt: new Date(),
            };
            const [saved] = existing
              ? await tx.update(importRecordsTable).set({
                ...recordValues,
                reviewStatus: existing.reviewStatus,
              }).where(eq(importRecordsTable.id, existing.id)).returning()
              : await tx.insert(importRecordsTable).values({
                sessionId,
                sourceFileId: file.id,
                sourceLocation,
                ...recordValues,
                reviewStatus: "draft",
              }).returning();
            await tx.delete(importFieldConfidenceTable).where(eq(importFieldConfidenceTable.recordId, saved.id));
            const confidenceRows = Object.entries(confidence).map(([fieldName, score]) => ({
              recordId: saved.id,
              fieldName,
              extractedValue: data[fieldName] == null ? null : asText(data[fieldName]),
              confidenceScore: score,
              sourceReference: `${file.fileName} · ${sourceLocation}`,
            }));
            if (confidenceRows.length) await tx.insert(importFieldConfidenceTable).values(confidenceRows);
            createdCount += 1;
          }
          await tx.update(importFilesTable).set({
            processingStatus: "complete",
            extractedRecordCount: createdCount,
            error: null,
            completedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(importFilesTable.id, file.id));
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Source records could not be saved.";
        fileFailures.push(`${file.fileName}: ${message}`);
        await db.update(importFilesTable).set({
          processingStatus: "failed",
          error: message,
          completedAt: null,
          updatedAt: new Date(),
        }).where(eq(importFilesTable.id, file.id));
        continue;
      }
      await db.update(importSessionsTable).set({
        currentStage: fileFailures.length ? "review" : "extract",
        progress: Math.min(90, Math.round(((completedBefore + fileIndex + 1) / allFiles.length) * 85) + 5),
        processingHeartbeatAt: new Date(),
        processingLeaseUntil: workerLeaseUntil(),
        updatedAt: new Date(),
      }).where(ownedSessionWhere(sessionId, agencyId));
    }
    await updateCounters(sessionId);
    const hasSuccessfulFile = allFiles.length > fileFailures.length;
    const lastError = fileFailures.length
      ? `${fileFailures.length} source file${fileFailures.length === 1 ? "" : "s"} failed. Retry processing to try them again. ${fileFailures.join(" ")}`
      : null;
    await db.update(importSessionsTable).set({
      status: hasSuccessfulFile ? "review" : "failed",
      currentStage: hasSuccessfulFile ? "review" : "error",
      progress: 100,
      lastError,
      processingHeartbeatAt: new Date(),
      processingWorkerId: null,
      processingLeaseUntil: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(ownedSessionWhere(sessionId, agencyId));
    await logAudit("import_processed", "import_session", sessionId, `Extracted ${files.length - fileFailures.length} source file(s)${fileFailures.length ? `; ${fileFailures.length} failed` : ""}`, session.createdBy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import processing failed.";
    await db.update(importSessionsTable).set({
      status: "failed",
      currentStage: "error",
      lastError: message,
      processingHeartbeatAt: new Date(),
      processingWorkerId: null,
      processingLeaseUntil: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(ownedSessionWhere(sessionId, agencyId));
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

async function claimRecoverySession(sessionId: number, agencyId: number) {
  const now = new Date();
  const [claimed] = await db.update(importSessionsTable).set({
    processingWorkerId: IMPORT_WORKER_ID,
    processingAttempt: sql`${importSessionsTable.processingAttempt} + 1`,
    processingStartedAt: now,
    processingHeartbeatAt: now,
    processingLeaseUntil: workerLeaseUntil(now),
    updatedAt: now,
  }).where(and(
    eq(importSessionsTable.id, sessionId),
    eq(importSessionsTable.agencyId, agencyId),
    eq(importSessionsTable.status, "processing"),
    or(
      isNull(importSessionsTable.processingWorkerId),
      ne(importSessionsTable.processingWorkerId, IMPORT_WORKER_ID),
      isNull(importSessionsTable.processingLeaseUntil),
      lt(importSessionsTable.processingLeaseUntil, now),
    ),
  )).returning();
  return claimed;
}

/**
 * Recover sessions that were processing when the API stopped. File statuses
 * are the durable checkpoint: completed files are skipped and uploaded,
 * failed, or interrupted files are safe to retry.
 */
export async function resumeImportSessions(): Promise<number> {
  const sessions = await db.select({
    id: importSessionsTable.id,
    agencyId: importSessionsTable.agencyId,
    columnMapping: importSessionsTable.columnMapping,
  }).from(importSessionsTable).where(eq(importSessionsTable.status, "processing"));
  let resumed = 0;
  for (const session of sessions) {
    const claimed = await claimRecoverySession(session.id, session.agencyId);
    if (!claimed) continue;
    resumed += 1;
    void processSession(
      session.id,
      session.agencyId,
      (session.columnMapping ?? {}) as Record<string, string>,
      { resumeOnly: true },
    );
  }
  return resumed;
}

export function startImportRecoveryWorker() {
  const run = () => resumeImportSessions().catch((error) => {
    logger.error({ error }, "Import recovery worker failed");
  });
  setTimeout(run, 5_000);
  return setInterval(run, 60_000);
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
  if (files.some((file) => !asText(file.storagePath).startsWith(`/objects/uploads/${user.id}/`))) {
    res.status(403).json({ error: "Source files must belong to the authenticated user." }); return;
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
  if (session.status === "published") { res.status(409).json({ error: "Published sessions cannot be reprocessed." }); return; }
  if (req.body?.columnMapping && typeof req.body.columnMapping !== "object") {
    res.status(400).json({ error: "Column mapping must be an object." }); return;
  }
  const mapping = (req.body?.columnMapping ?? session.columnMapping) as Record<string, string>;
  const now = new Date();
  const [claimed] = await db.update(importSessionsTable).set({
    status: "processing",
    currentStage: "extract",
    progress: 5,
    columnMapping: mapping,
    lastError: null,
    processingWorkerId: IMPORT_WORKER_ID,
    processingAttempt: sql`${importSessionsTable.processingAttempt} + 1`,
    processingStartedAt: now,
    processingHeartbeatAt: now,
    processingLeaseUntil: workerLeaseUntil(now),
    completedAt: null,
    updatedAt: now,
  }).where(and(
    eq(importSessionsTable.id, id),
    eq(importSessionsTable.agencyId, agencyIdFor(user)),
    ne(importSessionsTable.status, "processing"),
    ne(importSessionsTable.status, "published"),
  )).returning();
  if (!claimed) {
    res.status(409).json({ error: "This import session is already processing or has been published." });
    return;
  }
  void processSession(id, agencyIdFor(user), mapping);
  res.status(202).json(jsonify(claimed));
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
  else if (action === "link_duplicate") {
    if (records.some((record) => !record.matchedPropertyId)) {
      res.status(400).json({ error: "Every selected record needs a matched property before it can be linked." }); return;
    }
    update.duplicateStatus = "link_existing";
  }
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
  const createdPropertyIds: number[] = [];
  for (const record of records) {
    const data = effectiveData(record);
    const issues = validateData(data, "spreadsheet").filter((issue) => !issue.includes("Image needs"));
    if (record.reviewStatus !== "approved" || issues.length || record.duplicateStatus === "possible" || (record.duplicateStatus === "link_existing" && !record.matchedPropertyId)) {
      errors.push(`Record ${record.id}: approve the record and resolve validation or duplicate issues first.`);
      continue;
    }
    try {
      let propertyId = record.duplicateStatus === "link_existing" ? record.matchedPropertyId : null;
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
        createdPropertyIds.push(property.id);
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
  for (const propertyId of createdPropertyIds) {
    void matchPropertyToAlerts(propertyId).catch((error) => {
      logger.warn({ propertyId, error }, "Imported property alert matching failed");
    });
  }
  await logAudit("import_published", "import_session", sessionId, `Published ${published} record(s)`, user.id, user.name);
  res.json({ published, linked, created, failed: errors.length, errors });
});

router.get("/imports/sessions/:id/error-report", async (req, res): Promise<void> => {
  const user = await currentUser(req);
  const sessionId = Number(req.params.id);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const session = await sessionFor(sessionId, agencyIdFor(user));
  if (!session) { res.status(404).send("Import session not found."); return; }
  const files = await db.select().from(importFilesTable).where(eq(importFilesTable.sessionId, sessionId));
  const records = await db.select().from(importRecordsTable).where(and(eq(importRecordsTable.sessionId, sessionId), ne(importRecordsTable.reviewStatus, "published")));
  const csvEscape = (value: unknown) => JSON.stringify(value == null ? "" : String(value));
  const fileRows = files.filter((file) => file.error || file.processingStatus === "failed").map((file) => [
    `file:${file.id}`,
    csvEscape(file.fileName),
    csvEscape(""),
    csvEscape(file.error || "Source processing failed."),
    file.processingStatus,
  ].join(","));
  const recordRows = records.map((record) => [
    record.id,
    csvEscape(files.find((file) => file.id === record.sourceFileId)?.fileName ?? "Source file"),
    csvEscape(record.sourceLocation ?? ""),
    csvEscape((record.validationIssues as string[]).join("; ")),
    record.reviewStatus,
  ].join(","));
  const csv = ["record_id,source_file,source_location,issues,review_status", ...fileRows, ...recordRows].join("\n");
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