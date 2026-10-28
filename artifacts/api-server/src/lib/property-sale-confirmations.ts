import { createHash, randomBytes } from "node:crypto";
import { pool } from "@workspace/db";

const CONFIRMATION_BASE_URL = process.env.PUBLIC_APP_URL?.trim()
  || "https://www.quickprop.melios.co.zw";

export const PROPERTY_SALE_CONFIRMATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createPropertySaleConfirmationToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPropertySaleConfirmationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function publicPropertySaleConfirmationUrl(token: string): string {
  return `${CONFIRMATION_BASE_URL.replace(/\/$/, "")}/sale-confirmation?token=${encodeURIComponent(token)}`;
}

export async function ensurePropertySaleConfirmationSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS property_sale_confirmations (
      id serial PRIMARY KEY,
      property_id integer NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
      requested_by integer REFERENCES users(id) ON DELETE SET NULL,
      token_hash text NOT NULL UNIQUE,
      conveyancer_name text NOT NULL,
      conveyancer_email text,
      conveyancer_phone text,
      status text NOT NULL DEFAULT 'pending',
      expires_at timestamp NOT NULL,
      confirmed_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS property_sale_confirmations_status_idx
      ON property_sale_confirmations(status, expires_at);
  `);
}
