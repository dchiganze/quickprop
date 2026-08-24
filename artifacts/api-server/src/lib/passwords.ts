import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

export function isScryptHash(value: string): boolean {
  const [prefix, salt, digest, ...rest] = value.split("$");
  return prefix === HASH_PREFIX
    && Boolean(salt)
    && /^[0-9a-f]+$/i.test(digest ?? "")
    && (digest?.length ?? 0) === KEY_LENGTH * 2
    && rest.length === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH) as Buffer;
  return `${HASH_PREFIX}$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedPassword: string): Promise<boolean> {
  if (isScryptHash(storedPassword)) {
    const [, salt, encodedDigest] = storedPassword.split("$");
    const expected = Buffer.from(encodedDigest, "hex");
    const derivedKey = await scryptAsync(password, salt, expected.length) as Buffer;
    return timingSafeEqual(expected, derivedKey);
  }

  // Existing seeded databases may contain the legacy plaintext value. Compare
  // it in constant time, then callers can upgrade it after successful auth.
  const expected = Buffer.from(storedPassword);
  const supplied = Buffer.from(password);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}