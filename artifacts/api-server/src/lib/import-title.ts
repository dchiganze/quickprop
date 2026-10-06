const titleColumnAliases = new Set([
  "title",
  "listing title",
  "property title",
  "property",
  "property name",
  "listing",
  "listing name",
  "headline",
  "name",
]);

function normalizedColumnName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasText(value: unknown): boolean {
  return value != null && String(value).trim().length > 0;
}

export function findImportTitleValue(
  row: Record<string, unknown>,
  mappedSourceColumn?: string,
): unknown {
  if (mappedSourceColumn && Object.prototype.hasOwnProperty.call(row, mappedSourceColumn)) {
    const value = row[mappedSourceColumn];
    if (hasText(value)) return value;
  }

  if (hasText(row.title)) return row.title;

  const aliasedEntry = Object.entries(row).find(([columnName, value]) =>
    titleColumnAliases.has(normalizedColumnName(columnName)) && hasText(value)
  );
  return aliasedEntry?.[1];
}
