/**
 * The follow-up system after a reply: chase each lead until they move up a
 * stage or say stop, and track the meeting in between.
 *
 * Run with:  bun run scripts/add-crm-follow-up-system.ts
 *
 * - crm_sequences.auto_send_reply — the stage's immediate reply sends itself
 *   after a short hold (src/lib/crm/autoFollowUps.ts), off by default.
 * - crm_sequences.then_sequence_id — when a run's steps run out, the record
 *   continues with this sequence instead of going idle (it may name itself:
 *   the long-term loop).
 * - crm_sequence_steps.timing — 'after_previous' (the delay counts from the
 *   previous message, as before) or 'before_meeting' (the delay is how long
 *   before the record's booked meeting starts).
 * - crm_settings.booking_url — the Cal.com booking page `{{booking_link}}`
 *   becomes, carrying the record's booking code.
 * - crm_records.booking_code / booking_link_first_sent_at /
 *   booking_link_sent_count — the record's own link and when it went out.
 * - crm_meetings — one row per booking: when, and whether they showed up.
 *
 * Additive and idempotent: re-running changes nothing. Run it before the
 * code that reads these columns is deployed.
 */
import { Client } from "pg";

const DDL = `
ALTER TABLE crm_sequences ADD COLUMN IF NOT EXISTS auto_send_reply boolean NOT NULL DEFAULT false;
ALTER TABLE crm_sequences ADD COLUMN IF NOT EXISTS then_sequence_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_sequences_then_sequence_fk') THEN
    ALTER TABLE crm_sequences ADD CONSTRAINT crm_sequences_then_sequence_fk
      FOREIGN KEY (then_sequence_id) REFERENCES crm_sequences(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE crm_sequence_steps ADD COLUMN IF NOT EXISTS timing text NOT NULL DEFAULT 'after_previous';
ALTER TABLE crm_sequence_steps DROP CONSTRAINT IF EXISTS crm_sequence_steps_timing_chk;
ALTER TABLE crm_sequence_steps ADD CONSTRAINT crm_sequence_steps_timing_chk
  CHECK (timing IN ('after_previous', 'before_meeting') AND (position > 1 OR timing = 'after_previous'));

ALTER TABLE crm_settings ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE crm_settings DROP CONSTRAINT IF EXISTS crm_settings_booking_url_chk;
ALTER TABLE crm_settings ADD CONSTRAINT crm_settings_booking_url_chk
  CHECK (booking_url IS NULL OR (booking_url ~ '^https?://' AND length(booking_url) <= 2000));

ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS booking_code text;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS booking_link_first_sent_at timestamptz;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS booking_link_sent_count integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS crm_records_booking_code_uq ON crm_records (booking_code) WHERE booking_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_meetings (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'calcom',
  provider_booking_uid text,
  status text NOT NULL DEFAULT 'booked',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  booked_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  outcome text,
  outcome_at timestamptz,
  outcome_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_meetings_provider_chk CHECK (provider IN ('calcom')),
  CONSTRAINT crm_meetings_status_chk CHECK (status IN ('booked', 'cancelled')),
  CONSTRAINT crm_meetings_outcome_chk CHECK (outcome IS NULL OR outcome IN ('showed', 'no_show')),
  CONSTRAINT crm_meetings_outcome_at_chk CHECK ((outcome IS NULL) = (outcome_at IS NULL)),
  CONSTRAINT crm_meetings_time_chk CHECK (end_at >= start_at)
);
CREATE INDEX IF NOT EXISTS crm_meetings_organization_idx ON crm_meetings (organization_id);
CREATE INDEX IF NOT EXISTS crm_meetings_record_idx ON crm_meetings (crm_record_id);
CREATE INDEX IF NOT EXISTS crm_meetings_open_end_idx ON crm_meetings (end_at) WHERE status = 'booked' AND outcome IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_meetings_provider_uid_uq
  ON crm_meetings (provider, provider_booking_uid) WHERE provider_booking_uid IS NOT NULL;
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
    console.log("CRM follow-up system columns and crm_meetings are in place.");
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
