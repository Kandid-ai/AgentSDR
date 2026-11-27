/**
 * Referrals: a lead's reply names someone else to talk to, and a person
 * decides what to do about it (src/lib/crm/referrals.ts, referralTypes.ts).
 *
 * Run with:  bun run scripts/create-crm-referrals.ts
 *
 * - crm_referrals — one row per person named, on the referrer's record. Scoped
 *   by organization_id. A unique index on (source message, email, phone, name)
 *   keeps the AI from storing the same contact twice when it reads a message
 *   again.
 *
 * Additive and idempotent: re-running changes nothing. Run it before the code
 * that reads the table is deployed.
 */
import { Client } from "pg";

const DDL = `
CREATE TABLE IF NOT EXISTS crm_referrals (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE RESTRICT,
  referrer_person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  source_message_id uuid REFERENCES crm_conversation_messages(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  linkedin_url text,
  role text,
  company_name text,
  context text,
  anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL,
  referred_person_id uuid REFERENCES people(id) ON DELETE SET NULL,
  channels jsonb,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_referrals_status_chk CHECK (status IN ('pending', 'started', 'dismissed')),
  CONSTRAINT crm_referrals_source_chk CHECK (source IN ('ai', 'human')),
  CONSTRAINT crm_referrals_contact_chk CHECK (name IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL OR linkedin_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS crm_referrals_organization_idx ON crm_referrals (organization_id);
CREATE INDEX IF NOT EXISTS crm_referrals_record_status_idx ON crm_referrals (crm_record_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS crm_referrals_source_contact_uq
  ON crm_referrals (source_message_id, coalesce(lower(email), ''), coalesce(phone, ''), coalesce(lower(name), ''))
  WHERE source_message_id IS NOT NULL;
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
    console.log("crm_referrals is in place.");
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
