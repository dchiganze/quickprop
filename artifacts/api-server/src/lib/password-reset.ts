import { createHash, randomBytes } from "node:crypto";

export const ADMIN_PASSWORD_RESET_TTL_MS = 15 * 60_000;
export const ADMIN_PASSWORD_RESET_COOLDOWN_MS = 60_000;

export function createAdminPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAdminPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function meetsAdminPasswordPolicy(password: string): boolean {
  return password.length >= 10
    && /[A-Za-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9\s]/.test(password);
}

function normalizeHttpsBaseUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return null;
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed;
  } catch {
    return null;
  }
}

export function getAdminPasswordResetBaseUrl(options: {
  runtimeEnvironment: string | undefined;
  developmentDomain: string | undefined;
  productionBaseUrl: string | undefined;
}): string | null {
  if (options.runtimeEnvironment === "production") {
    return normalizeHttpsBaseUrl(options.productionBaseUrl)?.toString().replace(/\/+$/, "") ?? null;
  }

  const developmentDomain = options.developmentDomain?.trim();
  if (!developmentDomain) return null;
  const developmentUrl = developmentDomain.includes("://")
    ? developmentDomain
    : `https://${developmentDomain}`;
  const parsed = normalizeHttpsBaseUrl(developmentUrl);
  return parsed ? `${parsed.origin}/admin` : null;
}
