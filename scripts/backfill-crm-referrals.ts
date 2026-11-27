/**
 * Read past replies for referrals (src/lib/crm/referralExtract.ts), so people
 * named before referral extraction existed reach Action required too.
 *
 * Candidates: inbound messages since --days (default 14) whose newest
 * classification proposed or applied "Connected to Different POC", on records
 * that are not closed. Each goes through extractReferralsForMessage, which
 * skips a message it already read and keeps only details the message supports.
 *
 * Run: bun run --conditions=react-server scripts/backfill-crm-referrals.ts --org <id> [--days 14] [--apply]
 * Without --apply it only lists the candidates (no model calls, no writes).
 */
import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "../src/lib/db";
import { extractReferralsForMessage } from "../src/lib/crm/referralExtract";
import { crmClassifications, crmConversationMessages, crmConversations, crmRecords, crmSubcategories } from "../src/lib/crm/schema";
import { inOrg, runInOrganization } from "../src/lib/tenancy/scope";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const organizationId = value("--org");
const days = Number(value("--days") ?? 14);
if (!organizationId || !Number.isFinite(days) || days <= 0) {
  console.error("Usage: --org <organization id> [--days 14] [--apply]");
  process.exit(1);
}

async function run() {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.selectDistinctOn([crmClassifications.messageId], {
    messageId: crmClassifications.messageId,
    subcategoryKey: crmSubcategories.key,
    sentAt: crmConversationMessages.sentAt,
    body: crmConversationMessages.bodyText,
  }).from(crmClassifications)
    .innerJoin(crmConversationMessages, eq(crmConversationMessages.id, crmClassifications.messageId))
    .innerJoin(crmConversations, eq(crmConversations.id, crmConversationMessages.conversationId))
    .innerJoin(crmRecords, eq(crmRecords.id, crmConversations.crmRecordId))
    .innerJoin(crmSubcategories, eq(crmSubcategories.id, crmClassifications.proposedSubcategoryId))
    .where(and(
      inOrg(crmRecords),
      ne(crmRecords.workflowState, "closed"),
      eq(crmConversationMessages.direction, "inbound"),
      gte(crmConversationMessages.sentAt, since),
      inArray(crmClassifications.status, ["auto_applied", "accepted", "overridden", "proposed", "stale"]),
    ))
    .orderBy(crmClassifications.messageId, desc(crmClassifications.createdAt));
  const candidates = rows.filter((row) => row.subcategoryKey === "connected_to_different_poc");
  console.log(`${candidates.length} candidate replies since ${since.toISOString().slice(0, 10)}`);
  let stored = 0;
  for (const candidate of candidates) {
    const preview = candidate.body.replace(/\s+/g, " ").slice(0, 110);
    if (!apply) { console.log(`  ${candidate.sentAt.toISOString().slice(0, 10)}  ${preview}`); continue; }
    try {
      const outcome = await extractReferralsForMessage(candidate.messageId, { subcategoryKey: candidate.subcategoryKey });
      stored += outcome.stored;
      console.log(`  ${outcome.stored ? `+${outcome.stored}` : outcome.skipped ?? "0"}  ${preview}`);
    } catch (error) {
      console.log(`  error  ${preview}  — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (apply) console.log(`${stored} referrals stored.`);
}

console.log(apply ? "APPLY: reading replies with the model and storing referrals." : "DRY RUN: listing candidates only. Add --apply to read them.");
await runInOrganization(organizationId, run);
process.exit(0);
