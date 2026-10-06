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
      rows.push(row);
      sourceLocations.push(
        index === 0
          ? `section ${page.pageNumber}`
          : `section ${page.pageNumber} listing ${index + 1}`,
      );
    });
  }

  return { rows, sourceLocations };
}
