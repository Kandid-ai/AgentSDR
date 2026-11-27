/**
 * Saved views of the CRM Funnel page (src/lib/crm/boardViews.ts).
 *
 * Run with:  bun run scripts/create-crm-board-views.ts
 *
 * - crm_board_views — a name plus the page's config (layout, grouping,
 *   filters, column order, card fields), shared by the organization. Scoped by
 *   organization_id; the defaults are seeded lazily on the first list.
 *
 * Additive and idempotent: re-running changes nothing.
 */
import { Client } from "pg";

const DDL = `
CREATE TABLE IF NOT EXISTS crm_board_views (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_board_views_organization_position_idx ON crm_board_views (organization_id, position);
`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set — check .env.local");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '2min'");
    await client.query("BEGIN");
    await client.query(DDL);
    await client.query("COMMIT");
    console.log("crm_board_views is in place.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
