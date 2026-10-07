export type ImportDraftValues = Record<string, unknown>;

export type ImportDraftState = {
  drafts: Record<number, ImportDraftValues>;
  serverData: Record<number, ImportDraftValues>;
};

type ImportDraftRecord = {
  id: number;
  data: unknown;
};

function asDraftValues(value: unknown): ImportDraftValues {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as ImportDraftValues
    : {};
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => (
      `${JSON.stringify(key)}:${stableSerialize(entryValue)}`
    )).join(",")}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function sameDraftValues(left: ImportDraftValues | undefined, right: ImportDraftValues | undefined) {
  return stableSerialize(left) === stableSerialize(right);
}

export function syncImportDraftState(
  current: ImportDraftState,
  records: readonly ImportDraftRecord[],
): ImportDraftState {
  const drafts = { ...current.drafts };
  const serverData = { ...current.serverData };
  const liveRecordIds = new Set(records.map((record) => record.id));
  let changed = false;

  for (const id of Object.keys(drafts).map(Number)) {
    if (!liveRecordIds.has(id)) {
      delete drafts[id];
      changed = true;
    }
  }
  for (const id of Object.keys(serverData).map(Number)) {
    if (!liveRecordIds.has(id)) {
      delete serverData[id];
      changed = true;
    }
  }

  for (const record of records) {
    const latestServerData = asDraftValues(record.data);
    const previousServerData = serverData[record.id];
    const currentDraft = drafts[record.id];

    if (
      currentDraft === undefined
      || previousServerData === undefined
      || sameDraftValues(currentDraft, previousServerData)
    ) {
      if (!sameDraftValues(currentDraft, latestServerData)) {
        drafts[record.id] = latestServerData;
        changed = true;
      }
    }

    if (!sameDraftValues(previousServerData, latestServerData)) {
      serverData[record.id] = latestServerData;
      changed = true;
    }
  }

  return changed ? { drafts, serverData } : current;
}
