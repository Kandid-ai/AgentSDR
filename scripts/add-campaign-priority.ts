/**
 * Adds `priority` (urgent / high / medium / low) to email, LinkedIn and
 * WhatsApp campaigns: outreach_campaigns.priority, "Campaign".priority and
 * whatsapp_campaigns.priority. A sending account works its highest-priority
 * campaign first (src/lib/campaigns/priority.ts). Matches
 * src/lib/outreach/schema.ts, src/lib/linkedin/schema.ts and
 * src/lib/whatsapp/schema.ts.
 *
 * Run with:  bun run scripts/add-campaign-priority.ts
 *
 * Additive: every existing campaign becomes "medium", the order the engines
 * already used, and code that does not know the column keeps working.
 *
 * Re-runnable: each column and constraint is guarded.
 */
import { Client } from "pg";

const TABLES = [
  { table: "outreach_campaigns", constraint: "outreach_campaigns_priority_chk" },
  { table: `"Campaign"`, constraint: "Campaign_priority_chk" },
  { table: "whatsapp_campaigns", constraint: "whatsapp_campaigns_priority_chk" },
];

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
    for (const { table, constraint } of TABLES) {
      await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'`);
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraint}') THEN
            ALTER TABLE ${table} ADD CONSTRAINT "${constraint}" CHECK (priority IN ('urgent', 'high', 'medium', 'low'));
          END IF;
        END $$
      `);
    }
    await client.query("COMMIT");
    for (const { table } of TABLES) {
      const { rows } = await client.query<{ priority: string; n: string }>(
        `SELECT priority, count(*)::text AS n FROM ${table} GROUP BY priority ORDER BY priority`,
      );
      console.log(`${table}: ${rows.map((row) => `${row.priority} ${row.n}`).join(", ") || "no campaigns"}`);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
