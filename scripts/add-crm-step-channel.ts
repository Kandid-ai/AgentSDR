/**
 * A CRM follow-up step can go out on the lead's other channel: email if they
 * replied on LinkedIn, LinkedIn if they replied by email.
 *
 * Run with:  bun run scripts/add-crm-step-channel.ts
 *
 * - crm_sequence_steps.channel — 'same' (the conversation the run is on, as
 *   before) or 'other' (the person's email ↔ LinkedIn conversation, resolved
 *   when the step is drafted; src/lib/crm/stepChannel.ts). The immediate
 *   reply (position 1) is always 'same'. Versioned like timing: copied when a
 *   sequence is published.
 *
 * Additive and idempotent: re-running changes nothing. Existing steps become
 * 'same', which is what they did. Run it before the code that reads the
 * column is deployed.
 */
import { Client } from "pg";

const DDL = `
ALTER TABLE crm_sequence_steps ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'same';
ALTER TABLE crm_sequence_steps DROP CONSTRAINT IF EXISTS crm_sequence_steps_channel_chk;
ALTER TABLE crm_sequence_steps ADD CONSTRAINT crm_sequence_steps_channel_chk
  CHECK (channel IN ('same', 'other') AND (position > 1 OR channel = 'same'));
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
    console.log("crm_sequence_steps.channel is in place.");
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
