export function isPrintCancellation(error: unknown): boolean {
  if (typeof error === 'string') {
    return /printing did not complete|printincompleteexception|cancel/i.test(error);
  }

  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: unknown; message?: unknown; name?: unknown };
  const details = [candidate.code, candidate.name, candidate.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return details.includes('printing did not complete')
    || details.includes('printincompleteexception')
    || details.includes('err_print_incomplete')
    || details.includes('cancel');
}
