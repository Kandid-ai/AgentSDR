/**
 * Who talks on an AI calling campaign's calls: call_campaigns.ai_caller
 * ('agent', the default: the AI agent places and talks on every call; 'rep':
 * a person works it through the dialer, src/lib/calls/aiCampaigns/dialer.ts).
 * Matches src/lib/calls/schema.ts.
 *
 * Run with:  bun run scripts/add-ai-campaign-caller.ts
 *
 * Additive and re-runnable.
 */
import { Client } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set — check .env.local");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '5s'");
    await client.query(`ALTER TABLE call_campaigns ADD COLUMN IF NOT EXISTS ai_caller text NOT NULL DEFAULT 'agent'`);
    await client.query(`DO $$ BEGIN
      ALTER TABLE call_campaigns ADD CONSTRAINT call_campaigns_ai_caller_check CHECK (ai_caller IN ('agent', 'rep'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    console.log("call_campaigns.ai_caller ready");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
