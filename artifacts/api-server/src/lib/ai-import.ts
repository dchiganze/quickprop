export function parseAiJsonResponse(
  raw: string,
  sourceLabel: string,
): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${sourceLabel} returned an empty response.`);
  }

  const withoutFence = trimmed
    .replace(/^```[a-z0-9_-]*\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (Array.isArray(value)) return { records: value };
    if (value && typeof value === "object") return value as Record<string, unknown>;
    return null;
  };

  try {
    const parsed = asRecord(JSON.parse(withoutFence));
    if (parsed) return parsed;
  } catch {
    // Try to isolate JSON when the provider adds surrounding prose.
  }

  const objectStart = withoutFence.indexOf("{");
  const arrayStart = withoutFence.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  const start = starts.length ? Math.min(...starts) : -1;
  if (start >= 0) {
    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let end = start; end < withoutFence.length; end += 1) {
      const character = withoutFence[end];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") inString = false;
        continue;
      }
      if (character === "\"") {
        inString = true;
      } else if (character === "{" || character === "[") {
        stack.push(character);
      } else if (character === "}" || character === "]") {
        const expected = character === "}" ? "{" : "[";
        if (stack.pop() !== expected) break;
        if (stack.length === 0) {
          try {
            const parsed = asRecord(JSON.parse(withoutFence.slice(start, end + 1)));
            if (parsed) return parsed;
          } catch {
            // Reject malformed or truncated JSON rather than silently returning a partial record.
          }
        }
      }
    }
  }

  throw new Error(
    `${sourceLabel} returned incomplete or invalid JSON (${trimmed.length} characters).`,
  );
}
