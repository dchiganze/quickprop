type PdfPageRows = {
  pageNumber: number;
  rows: Record<string, unknown>[];
};

export function flattenPdfPageRows(pages: PdfPageRows[]): {
  rows: Record<string, unknown>[];
  sourceLocations: string[];
} {
  const rows: Record<string, unknown>[] = [];
  const sourceLocations: string[] = [];

  for (const page of pages) {
    page.rows.forEach((row, index) => {
      const listingNumber = rows.length + 1;
      rows.push(row);
      sourceLocations.push(`section ${page.pageNumber} listing ${listingNumber}`);
    });
  }

  return { rows, sourceLocations };
}
