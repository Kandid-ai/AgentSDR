/**
 * Bring existing organizations up to the follow-up template
 * (src/lib/crm/followUpTemplate.ts): the "Meeting Booked" and "Pilot" stages,
 * the new ranks, the template sequences, and their assignment to stages that
 * have none.
 *
 * Run with: bun run --conditions=react-server scripts/apply-crm-follow-up-template.ts [--org <id>] [--apply] [--loop-existing]
 * (--conditions=react-server because src/lib/tenancy/scope imports server-only.)
 *
 * Default is a DRY RUN: the whole plan is read inside a READ ONLY transaction,
 * so the database refuses any write. --apply writes in one transaction per
 * organization. Safe to re-run: stages are added only when missing, ranks move
 * only where they still equal the old default (meeting_no_show 2->3,
 * meeting_done 3->4), sequences are found by the marker in their description,
 * and a stage that already has a sequence is NEVER reassigned.
 * --loop-existing additionally points the organization's own sequences on the
 * interested stages, when they have no "then" sequence, at the Long-term loop;
 * without it they are only listed.
 */
import postgres from "postgres";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { slugifySubcategoryKey } from "../src/lib/crm/categories";
import { DEFAULT_SUBCATEGORIES } from "../src/lib/crm/defaults";
import { planFollowUpTemplate, seedFollowUpTemplateInTransaction } from "../src/lib/crm/followUpTemplate";
import { crmPipelines, crmSequences, crmSubcategories, crmSubcategorySequenceAssignments } from "../src/lib/crm/schema";
import { runInOrganization, inOrg } from "../src/lib/tenancy/scope";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const loopExisting = args.includes("--loop-existing");
const orgFlag = args.indexOf("--org");
const onlyOrg = orgFlag >= 0 ? args[orgFlag + 1] : undefined;

const NEW_KEYS = ["meeting_booked", "pilot"] as const;
const RANK_CHANGES: Record<string, { from: number; to: number }> = {
  meeting_no_show: { from: 2, to: 3 },
  meeting_done: { from: 3, to: 4 },
};
const INTERESTED_KEYS = ["information_requested", "case_study", "demo_request", "demo_requested", "meeting_requested"];

async function listOrganizations(): Promise<Array<{ id: string; name: string }>> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sqlClient = postgres(url, { ssl: process.env.DATABASE_SSL === "disable" ? false : "require", max: 1 });
  try {
    return onlyOrg
      ? await sqlClient<Array<{ id: string; name: string }>>`select id, name from organizations where id = ${onlyOrg}`
      : await sqlClient<Array<{ id: string; name: string }>>`select id, name from organizations order by created_at`;
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function process_(tx: Tx, organization: { id: string; name: string }) {
  const [pipeline] = await tx.select({ id: crmPipelines.id }).from(crmPipelines)
    .where(and(inOrg(crmPipelines), eq(crmPipelines.isDefault, true))).limit(1);
  if (!pipeline) return console.log(`\n${organization.name}: no default pipeline, skipped (created lazily on first use)`);
  console.log(`\n${organization.name} (${organization.id}), pipeline ${pipeline.id}`);

  const stages = await tx.select().from(crmSubcategories).where(eq(crmSubcategories.pipelineId, pipeline.id));
  const byKey = new Map(stages.map((stage) => [stage.key, stage]));

  // 1. Missing stages.
  const missing = DEFAULT_SUBCATEGORIES.filter((entry) => {
    const key = slugifySubcategoryKey(entry.name);
    return (NEW_KEYS as readonly string[]).includes(key) && !byKey.has(key);
  });
  console.log(`  stages to add: ${missing.map((entry) => slugifySubcategoryKey(entry.name)).join(", ") || "none"}`);
  if (apply) {
    for (const entry of missing) {
      await tx.insert(crmSubcategories).values({
        pipelineId: pipeline.id,
        categoryKey: entry.categoryKey,
        key: slugifySubcategoryKey(entry.name),
        name: entry.name,
        description: entry.description,
        classificationGuidance: entry.classificationGuidance,
        sortOrder: entry.sortOrder,
        stageRank: entry.stageRank,
      }).onConflictDoNothing();
    }
  }

  // 2. Ranks that still equal the old default.
  for (const [key, change] of Object.entries(RANK_CHANGES)) {
    const stage = byKey.get(key);
    if (!stage) console.log(`  rank ${key}: stage not present`);
    else if (stage.stageRank === change.from) {
      console.log(`  rank ${key}: ${change.from} -> ${change.to}`);
      if (apply) await tx.update(crmSubcategories).set({ stageRank: change.to, updatedAt: new Date() }).where(eq(crmSubcategories.id, stage.id));
    } else console.log(`  rank ${key}: left at ${stage.stageRank ?? "none"} (customised)`);
  }

  // 3. Sequences and assignments.
  if (apply) {
    const report = await seedFollowUpTemplateInTransaction(tx, { organizationId: organization.id, pipelineId: pipeline.id, mode: "existing_organization" });
    console.log(`  sequences created: ${report.createdSequences.join(", ") || "none"}`);
    console.log(`  assigned: ${report.assigned.map((entry) => `${entry.subcategoryKey} <- ${entry.sequenceKey}`).join(", ") || "none"}`);
    console.log(`  left alone (already has a sequence): ${report.skippedAssigned.map((entry) => entry.subcategoryKey).join(", ") || "none"}`);
    if (report.missingSubcategories.length) console.log(`  no such stage: ${report.missingSubcategories.map((entry) => entry.subcategoryKey).join(", ")}`);
  } else {
    const plan = await planFollowUpTemplate(tx, pipeline.id);
    console.log(`  sequences to create: ${plan.toCreate.map((entry) => entry.name).join("; ") || "none"}`);
    console.log(`  already present: ${[...plan.existing.keys()].join(", ") || "none"}`);
    console.log(`  would assign: ${plan.assignments.map((entry) => `${entry.subcategoryKey}${entry.subcategoryId ? "" : " (new stage)"} <- ${entry.sequenceKey}`).join(", ") || "none"}`);
    console.log(`  left alone (already has a sequence): ${plan.skippedAssigned.map((entry) => entry.subcategoryKey).join(", ") || "none"}`);
  }

  // 4. The organization's own interested-stage sequences that never chain.
  const interestedIds = stages.filter((stage) => INTERESTED_KEYS.includes(stage.key)).map((stage) => stage.id);
  const own = interestedIds.length
    ? await tx.select({ id: crmSequences.id, name: crmSequences.name, description: crmSequences.description })
      .from(crmSubcategorySequenceAssignments)
      .innerJoin(crmSequences, eq(crmSequences.id, crmSubcategorySequenceAssignments.sequenceId))
      .where(and(inArray(crmSubcategorySequenceAssignments.subcategoryId, interestedIds), isNull(crmSequences.thenSequenceId), inOrg(crmSequences)))
    : [];
  const chainable = own.filter((row) => !row.description?.includes("AgentSDR follow-up template v1:"));
  console.log(`  own sequences on interested stages with no "then": ${chainable.map((row) => row.name).join("; ") || "none"}`
    + (chainable.length ? (loopExisting ? " -> pointing at the Long-term loop" : " (suggestion: re-run with --loop-existing)") : ""));
  if (apply && loopExisting && chainable.length) {
    const [loop] = await tx.select({ id: crmSequences.id }).from(crmSequences)
      .where(and(inOrg(crmSequences), sql`${crmSequences.description} LIKE '%[AgentSDR follow-up template v1: long_term_loop]%'`)).limit(1);
    if (loop) await tx.update(crmSequences).set({ thenSequenceId: loop.id, updatedAt: new Date() })
      .where(inArray(crmSequences.id, chainable.map((row) => row.id)));
  }
}

console.log(apply ? "APPLY: writing." : "DRY RUN: read-only transaction, nothing is written. Add --apply to write.");
for (const organization of await listOrganizations()) {
  await runInOrganization(organization.id, async () => {
    await db.transaction(async (tx) => {
      if (!apply) await tx.execute(sql`SET TRANSACTION READ ONLY`);
      await process_(tx, organization);
    });
  });
}
process.exit(0);
