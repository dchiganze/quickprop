import { createHash, randomBytes } from "node:crypto";

export function createReviewToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashReviewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}