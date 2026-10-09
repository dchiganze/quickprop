import { createHash, randomBytes } from "node:crypto";

export const ADMIN_PASSWORD_RESET_TTL_MS = 15 * 60_000;
export const AGENT_SETUP_TTL_MS = 24 * 60 * 60_000;
export const ADMIN_PASSWORD_RESET_COOLDOWN_MS = 60_000;
export const ADMIN_RECOVERY_COOLDOWN_MS = 15 * 60_000;
export const ADMIN_RECOVERY_COMPLETED_AUDIT_ACTION = "admin_recovery_completed";

export function normalizeAdminRecoveryEmail(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function matchesAdminRecoveryEmail(email: string, configuredEmail: string | undefined): boolean {
  const recoveryEmail = normalizeAdminRecoveryEmail(configuredEmail);
  return recoveryEmail !== null && email.trim().toLowerCase() === recoveryEmail;
}

export function createAdminPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAdminPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createAgentSetupToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAgentSetupToken(token: string): string {
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
