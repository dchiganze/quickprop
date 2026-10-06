export type ImportReconciliationRecord = {
  id: number;
  reviewStatus: string;
  correctedData: unknown | null;
  duplicateStatus: string;
  matchedPropertyId: number | null;
  agentId: number | null;
  agentMatchStatus: string;
};

export function findStalePdfDraftIds(
  records: readonly ImportReconciliationRecord[],
  matchedRecordIds: ReadonlySet<number>,
  protectedRecordIds: ReadonlySet<number> = new Set(),
): number[] {
  return records
    .filter((record) => (
      record.reviewStatus === "draft"
      && record.correctedData == null
      && record.duplicateStatus === "clear"
      && record.matchedPropertyId == null
      && record.agentId == null
      && record.agentMatchStatus !== "matched"
      && !matchedRecordIds.has(record.id)
      && !protectedRecordIds.has(record.id)
    ))
    .map((record) => record.id);
}
