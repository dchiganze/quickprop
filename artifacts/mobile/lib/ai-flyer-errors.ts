const FALLBACK_MESSAGE = 'Could not create the AI flyer. Check your connection and try again.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function messageFromPayload(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.error === 'string' && value.error.trim()
    ? value.error.trim()
    : undefined;
}

export function getAIFlyerErrorMessage(error: unknown): string {
  if (!isRecord(error)) return FALLBACK_MESSAGE;

  const response = isRecord(error.response) ? error.response : undefined;
  const message = messageFromPayload(error.data) ?? messageFromPayload(response?.data);
  if (message) return message;

  const errorMessage = typeof error.message === 'string'
    ? error.message
    : error instanceof Error ? error.message : '';
  const httpMessage = errorMessage.match(/^HTTP \d{3}[^:]*:\s*(.+)$/s)?.[1]?.trim();
  return httpMessage || FALLBACK_MESSAGE;
}
