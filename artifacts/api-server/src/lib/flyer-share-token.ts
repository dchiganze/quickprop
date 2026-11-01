import { createHmac, timingSafeEqual } from "node:crypto";

export type FlyerShareTokenPayload = {
  agentId: number;
  propertyReference: string;
  objectPath: string;
};

const OBJECT_PATH_PATTERN = /^\/objects\/uploads\/(\d+)\/[a-z0-9-]+\.jpg$/i;

function isValidPayload(value: unknown): value is FlyerShareTokenPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<FlyerShareTokenPayload>;
  const pathMatch = typeof payload.objectPath === "string"
    ? OBJECT_PATH_PATTERN.exec(payload.objectPath)
    : null;

  return Number.isInteger(payload.agentId)
    && Number(payload.agentId) > 0
    && typeof payload.propertyReference === "string"
    && payload.propertyReference.length > 0
    && payload.propertyReference.length <= 80
    && Boolean(pathMatch)
    && Number(pathMatch?.[1]) === payload.agentId;
}

export function signFlyerShareToken(
  payload: FlyerShareTokenPayload,
  secret: string,
): string {
  if (secret.length < 32) throw new Error("Flyer share signing secret is too short.");
  if (!isValidPayload(payload)) throw new Error("Flyer share details are invalid.");

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyFlyerShareToken(
  token: string,
  secret: string,
): FlyerShareTokenPayload | null {
  if (secret.length < 32 || token.length > 2_048) return null;
  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;

  const encodedPayload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return isValidPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}
