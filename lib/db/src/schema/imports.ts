import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { branchesTable, usersTable } from "./users";
import { propertiesTable } from "./properties";
import { propertyAgentRelationshipsTable } from "./multi-agent";

export const importSessionsTable = pgTable("import_sessions", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  agencyId: integer("agency_id").notNull().references(() => branchesTable.id),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("uploading"),
  totalFiles: integer("total_files").notNull().default(0),
  totalRecords: integer("total_records").notNull().default(0),
  recordsReady: integer("records_ready").notNull().default(0),
  recordsNeedingReview: integer("records_needing_review").notNull().default(0),
  recordsDuplicate: integer("records_duplicate").notNull().default(0),
  recordsPublished: integer("records_published").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  columnMapping: jsonb("column_mapping").notNull().default({}),
  currentStage: text("current_stage").notNull().default("upload"),
  progress: integer("progress").notNull().default(0),
  lastError: text("last_error"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const importFilesTable = pgTable("import_files", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => importSessionsTable.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  processingStatus: text("processing_status").notNull().default("uploaded"),
  extractedRecordCount: integer("extracted_record_count").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const importRecordsTable = pgTable("import_records", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => importSessionsTable.id),
  sourceFileId: integer("source_file_id").notNull().references(() => importFilesTable.id),
  sourceLocation: text("source_location"),
  rawData: jsonb("raw_data").notNull().default({}),
  extractedData: jsonb("extracted_data").notNull().default({}),
  correctedData: jsonb("corrected_data"),
  fieldConfidence: jsonb("field_confidence").notNull().default({}),
  confidenceScore: integer("confidence_score").notNull().default(0),
  reviewStatus: text("review_status").notNull().default("draft"),
  duplicateStatus: text("duplicate_status").notNull().default("clear"),
  matchedPropertyId: integer("matched_property_id").references(() => propertiesTable.id),
  finalPropertyId: integer("final_property_id").references(() => propertiesTable.id),
  finalRelationshipId: integer("final_relationship_id").references(() => propertyAgentRelationshipsTable.id),
  validationIssues: jsonb("validation_issues").notNull().default([]),
  mandateStatus: text("mandate_status").notNull().default("unknown"),
  agentMatchStatus: text("agent_match_status").notNull().default("unmatched"),
  agentId: integer("agent_id").references(() => usersTable.id),
  sourceMetadata: jsonb("source_metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const importFieldConfidenceTable = pgTable(
  "import_field_confidence",
  {
    id: serial("id").primaryKey(),
    recordId: integer("record_id").notNull().references(() => importRecordsTable.id),
    fieldName: text("field_name").notNull(),
    extractedValue: text("extracted_value"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    sourceReference: text("source_reference"),
  },
  (table) => [uniqueIndex("import_field_confidence_record_field_unique").on(table.recordId, table.fieldName)],
);

export const importChangesTable = pgTable("import_changes", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull().references(() => importRecordsTable.id),
  fieldName: text("field_name").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  changedBy: integer("changed_by").references(() => usersTable.id),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

export type ImportSession = typeof importSessionsTable.$inferSelect;
export type ImportFile = typeof importFilesTable.$inferSelect;
export type ImportRecord = typeof importRecordsTable.$inferSelect;
export type ImportChange = typeof importChangesTable.$inferSelect;