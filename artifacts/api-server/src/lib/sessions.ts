import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "qp1";
export const SESSION_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

type SessionPayload = {
  sub: number;
  exp: number;
};

function signSession(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(userId: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TOKEN_TTL_SECONDS,
  })).toString("base64url");
  const signed = `${TOKEN_PREFIX}.${payload}`;
  return `${signed}.${signSession(signed, secret)}`;
}

export function readSessionToken(token: string, secret: string): number | null {
  const [prefix, encodedPayload, signature, ...parts] = token.split(".");
  if (prefix !== TOKEN_PREFIX || !encodedPayload || !signature || parts.length > 0) return null;

  let expected: Buffer;
  let supplied: Buffer;
  try {
    expected = Buffer.from(signSession(`${prefix}.${encodedPayload}`, secret), "base64url");
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    expected.length !== supplied.length
    || supplied.toString("base64url") !== signature
    || !timingSafeEqual(expected, supplied)
  ) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!Number.isSafeInteger(payload.sub) || payload.sub <= 0 || !Number.isSafeInteger(payload.exp)) return null;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload.sub : null;
  } catch {
    return null;
  }
}
