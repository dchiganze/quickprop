export function shouldShowImportDuplicateMatch(status: string): boolean {
  return status === "possible" || status === "link_existing";
}
