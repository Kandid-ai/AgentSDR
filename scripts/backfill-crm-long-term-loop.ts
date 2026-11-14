/**
 * One-off: put interested records that already went idle into the Long-term
 * loop, so the leads whose follow-ups ran out before "never idle" existed
 * are chased again (src/lib/crm/sequences.ts continueWithThenSequenceInTransaction
 * covers every run that finishes from now on).
 *
 * Run with: bun run --conditions=react-server scripts/backfill-crm-long-term-loop.ts [--org <id>] [--apply]
 *
 * A record qualifies when it is in the `interested` category, idle, has an
 * inbound message, has no active sequence run, its person is not Do Not
 * Contact, and we spoke last (a record whose latest message is the lead's is
 * owed a reply, not a nurture touch). Each gets a run of the organization's
 * Long-term loop (the template's, found by its description marker) from its
 * first follow-up. The first touches are spread from 2 to 15 days out, oldest
 * conversation first, rather than all landing 21 days from today; after that
 * the loop's own 21-day rhythm takes over.
 *
 * Default is a DRY RUN that only reads. --apply writes one transaction per
 * record. Safe to re-run: a record with an active run no longer qualifies.
 */
import postgres from "postgres";
import { and, asc, eq, isNotNull, like, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { appendCrmEvent } from "../src/lib/crm/events";
import { isPersonDoNotContact } from "../src/lib/crm/policies";
import { lockCrmRecord } from "../src/lib/crm/records";
import {
  crmConversationMessages,
  crmConversations,
  crmRecords,
  crmSequenceRuns,
  crmSequenceStepRuns,
  crmSequences,
} from "../src/lib/crm/schema";
import { startSequenceRunInTransaction } from "../src/lib/crm/sequences";
import { inOrg, runInOrganization } from "../src/lib/tenancy/scope";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const orgFlag = args.indexOf("--org");
const onlyOrg = orgFlag >= 0 ? args[orgFlag + 1] : undefined;

const LOOP_MARKER = "%[AgentSDR follow-up template v1: long_term_loop]%";
const FIRST_DAY = 2;
const LAST_DAY = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

async function listOrganizations(): Promise<Array<{ id: string; name: string }>> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { ssl: process.env.DATABASE_SSL === "disable" ? false : "require", max: 1 });
  try {
    return onlyOrg
      ? await client<Array<{ id: string; name: string }>>`select id, name from organizations where id = ${onlyOrg}`
      : await client<Array<{ id: string; name: string }>>`select id, name from organizations order by created_at`;
  } finally {
    await client.end({ timeout: 5 });
  }
}

/** Day offsets spread evenly from FIRST_DAY to LAST_DAY across `count` records. */
export function spreadDays(count: number): number[] {
  if (count <= 1) return count === 1 ? [FIRST_DAY] : [];
  return Array.from({ length: count }, (_, i) => FIRST_DAY + ((LAST_DAY - FIRST_DAY) * i) / (count - 1));
}

async function candidates() {
  const rows = await db.select({
    id: crmRecords.id,
    personId: crmRecords.personId,
    latestInboundMessageId: crmRecords.latestInboundMessageId,
    lastInboundAt: crmRecords.lastInboundAt,
    lastOutboundAt: crmRecords.lastOutboundAt,
  }).from(crmRecords)
    .where(and(
      inOrg(crmRecords),
      eq(crmRecords.categoryKey, "interested"),
      eq(crmRecords.workflowState, "idle"),
      isNotNull(crmRecords.latestInboundMessageId),
      isNotNull(crmRecords.lastOutboundAt),
      sql`${crmRecords.lastOutboundAt} >= coalesce(${crmRecords.lastInboundAt}, ${crmRecords.lastOutboundAt})`,
      sql`not exists (select 1 from crm_sequence_runs r where r.crm_record_id = ${crmRecords.id} and r.status = 'active')`,
    ))
    .orderBy(asc(crmRecords.lastOutboundAt));
  const out: typeof rows = [];
  for (const row of rows) {
    if (!(await isPersonDoNotContact(db as never, row.personId))) out.push(row);
  }
  return out;
}

async function run(organization: { id: string; name: string }) {
  const [loop] = await db.select({ id: crmSequences.id, status: crmSequences.status, versionId: crmSequences.latestPublishedVersionId })
    .from(crmSequences)
    .where(and(inOrg(crmSequences), like(crmSequences.description, LOOP_MARKER))).limit(1);
  if (!loop || loop.status !== "active" || !loop.versionId) {
    console.log(`\n${organization.name}: no active Long-term loop sequence (run apply-crm-follow-up-template.ts first), skipped`);
    return;
  }
  const records = await candidates();
  const days = spreadDays(records.length);
  console.log(`\n${organization.name}: ${records.length} idle interested record(s) qualify`);
  if (!records.length) return;
  console.log(`  first touches from day ${FIRST_DAY} to day ${LAST_DAY}, oldest conversation first`);
  if (!apply) return;

  let started = 0;
  for (const [index, row] of records.entries()) {
    const dueAt = new Date(Date.now() + days[index]! * DAY_MS);
    try {
      await db.transaction(async (tx) => {
        const record = await lockCrmRecord(tx, row.id);
        if (record.workflowState !== "idle" || !record.latestInboundMessageId) return;
        const [conversation] = await tx.select({ id: crmConversations.id }).from(crmConversationMessages)
          .innerJoin(crmConversations, eq(crmConversations.id, crmConversationMessages.conversationId))
          .where(and(inOrg(crmConversations), eq(crmConversationMessages.id, record.latestInboundMessageId), eq(crmConversations.crmRecordId, record.id)))
          .limit(1);
        if (!conversation) return;
        const result = await startSequenceRunInTransaction(tx, {
          recordId: record.id,
          conversationId: conversation.id,
          triggerMessageId: record.latestInboundMessageId,
          expectedContextVersion: record.contextVersion,
          skipReply: true,
          sequenceId: loop.id,
          actorType: "ai",
        });
        const first = result?.stepRuns.find((step) => step.status === "scheduled");
        if (!result || !first) return;
        await tx.update(crmSequenceStepRuns).set({ dueAt, updatedAt: new Date() }).where(eq(crmSequenceStepRuns.id, first.id));
        await tx.update(crmRecords).set({ workflowState: "waiting", nextActionAt: dueAt, updatedAt: new Date() })
          .where(eq(crmRecords.id, record.id));
        await appendCrmEvent(tx, {
          personId: record.personId,
          crmRecordId: record.id,
          pipelineId: record.pipelineId,
          eventType: "sequence.chained",
          actorType: "system",
          fromData: null,
          toData: { sequenceId: loop.id, sequenceRunId: result.run.id, nextActionAt: dueAt.toISOString() },
          meta: { reason: "backfill_idle_interested" },
          contextVersion: record.contextVersion,
        });
        started += 1;
      });
    } catch (error) {
      console.error(`  record ${row.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(crmSequenceRuns)
    .where(and(inOrg(crmSequenceRuns), eq(crmSequenceRuns.sequenceId, loop.id), eq(crmSequenceRuns.status, "active")));
  console.log(`  started ${started}; the Long-term loop now has ${count} active run(s)`);
}

async function main() {
  console.log(apply ? "APPLY: writing." : "DRY RUN: nothing is written. Add --apply to write.");
  for (const organization of await listOrganizations()) {
    await runInOrganization(organization.id, () => run(organization));
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
