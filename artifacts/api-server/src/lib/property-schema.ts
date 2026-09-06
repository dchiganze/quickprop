import { pool } from "@workspace/db";

/**
 * Sale metadata was added after the initial properties table was provisioned.
 * Keep startup compatible with existing development and deployed databases
 * while the Drizzle schema remains the source of truth for new environments.
 */
export async function ensurePropertySaleColumns(): Promise<void> {
  await pool.query(`
    ALTER TABLE properties
      ADD COLUMN IF NOT EXISTS sale_price double precision,
      ADD COLUMN IF NOT EXISTS sold_at timestamp,
      ADD COLUMN IF NOT EXISTS sold_by integer REFERENCES users(id)
  `);
}