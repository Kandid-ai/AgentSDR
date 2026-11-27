/**
 * Automate the immediate reply for the "no, but…" stages and make every step
 * read the thread before it writes (27 Nov 2026).
 *
 * Why: reps sent the AI's reply unedited 76–81% of the time on Left Company and
 * Not Required Right Now, yet those replies waited 30–50 hours for a person.
 * Every new reply restarts the stage's sequence at its reply step
 * (handlers.ts), so a reply step must also handle "they are answering the
 * question we asked" — not ask it again. "Did Not Connect to Different POC"
 * replies were rewritten by reps 87% of the time (the AI asked whether pricing
 * or the product was the problem; reps sent "a name is all I need"), so its
 * instructions change too, but it stays a person's to send.
 *
 * What it does, for the organization given with --org:
 * - "Not a Fit" (not_interested): a new stage for "this is not relevant to us"
 *   (no ads, wrong business, shut down), with a one-step sequence that closes
 *   politely. Not Required Right Now's guidance now sends those here, so its
 *   follow-ups only ever go to timing objections.
 * - New step instructions for Already Using a Tool, Not Required Right Now,
 *   Left Company and Did Not Connect, published as a new version (knowledge
 *   tags, timing and channel of existing positions are kept).
 * - Send the immediate reply automatically: on for Already Using a Tool, Not
 *   Required Right Now, Left Company and Not a Fit (15-minute hold, applied
 *   classifications only — drafts.ts).
 * - Then: Already Using a Tool and Not Required Right Now continue with the
 *   Long-term loop when their steps run out.
 *
 * Run: bun run --conditions=react-server scripts/apply-crm-objection-replies.ts --org <id> [--apply]
 * Without --apply it only prints the plan. Safe to re-run: a sequence is
 * republished only when its steps differ, the stage is created only if missing.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { createSubcategory, updateSubcategory } from "../src/lib/crm/categories";
import { crmPipelines, crmSequenceSteps, crmSequences, crmSubcategories, crmSubcategorySequenceAssignments } from "../src/lib/crm/schema";
import {
  assignSubcategorySequence,
  createSequence,
  getSequence,
  publishSequence,
  updateSequence,
  type SequenceStepInput,
} from "../src/lib/crm/sequences";
import { inOrg, runInOrganization } from "../src/lib/tenancy/scope";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const orgFlag = args.indexOf("--org");
const organizationId = orgFlag >= 0 ? args[orgFlag + 1] : undefined;
if (!organizationId) {
  console.error("Usage: --org <organization id> [--apply]");
  process.exit(1);
}

const DAY = 24 * 60;

type StepPlan = { name: string; delayMinutes: number; aiInstructions: string };
type SequencePlan = {
  name: string;
  /** Create the sequence (and stage) when missing. */
  create?: { description: string };
  autoSendReply: boolean;
  /** Name of the sequence to continue with; undefined leaves it as it is. */
  then?: string;
  steps: StepPlan[];
};

const NO_REPEAT = "Never ask a question the thread shows they have already answered, and never repeat the wording of an earlier message.";

const PLANS: SequencePlan[] = [
  {
    name: "Already Using a Tool — Not Required",
    autoSendReply: true,
    then: "Long-term loop",
    steps: [
      {
        name: "Reply",
        delayMinutes: 0,
        aiInstructions: `Work out from the thread which case this is, then reply in 2–4 short sentences.
A) They say they already have a tool, agency or in-house process and did not name it: acknowledge it respectfully, then ask one easy question: which tool or agency they use, and how it is working for them on conversion from ad traffic.
B) They named the tool, or they are answering our question about it: thank them, reflect what they said in one line, then give the single most relevant difference between Dynamic Storefront and that kind of tool, taken from Knowledge, and offer a short side-by-side comparison. Never invent claims about the other tool; if Knowledge says nothing about it, describe what Dynamic Storefront does that a typical tool of that kind does not.
C) They use an agency: make clear Dynamic Storefront is a SaaS tool their agency can use alongside what it does, not another agency.
D) They say it works well and they want nothing more: accept it gracefully, leave the door open in one line, and ask nothing.
${NO_REPEAT}`,
      },
      {
        name: "Tool question, unanswered",
        delayMinutes: 3 * DAY,
        aiInstructions: `Read what our last message asked.
- If we asked which tool they use and they have not said: make it easy and pressure-free. Say it is completely fine if they would rather not share, mention in one line the kinds of tools brands like theirs usually run (only ones named in Knowledge), say how Dynamic Storefront differs, and ask whether a quick comparison would be useful.
- If they already named their tool: share one concrete result or capability from Knowledge that speaks to the gap they mentioned, and offer the comparison.
- If they made clear they want nothing further: two lines, no question, door left open.
${NO_REPEAT}`,
      },
      {
        name: "Comparison",
        delayMinutes: 4 * DAY,
        aiInstructions: `Share the comparison from Knowledge of Dynamic Storefront against the tools brands commonly use (against their tool when they named one). Keep it to the two or three points that matter for a brand like theirs, and end with one easy question. If they made clear they want nothing further, send two lines that leave the door open instead.`,
      },
      {
        name: "Side-by-side trial",
        delayMinutes: 5 * DAY,
        aiInstructions: `A final note offering a one-month free trial, so they can run Dynamic Storefront alongside their existing tool and compare results side by side with no commitment: if they like the outcome they continue, otherwise they stop. Keep it short and refer back to what they told us about their current setup.`,
      },
    ],
  },
  {
    name: "Not Required Right Now",
    autoSendReply: true,
    then: "Long-term loop",
    steps: [
      {
        name: "Reply",
        delayMinutes: 0,
        aiInstructions: `Work out from the thread which case this is, then reply in 2–4 short sentences, with no pressure.
A) Timing ("not right now", "maybe later", "next quarter", other priorities): acknowledge it. If they gave a time, repeat it accurately and say we will reconnect then. If not, ask when would be a better time. Add one light question only if it fits naturally: whether they are improving conversion from ad traffic another way today.
B) They are answering a question we asked earlier (a time, how they handle it today, why not now): respond to what they actually said in one line. If they gave a reason (budget, team, priorities), acknowledge it, and say how Dynamic Storefront fits that situation only when Knowledge supports it.
C) It turns out the offer is not relevant to them at all (they do not run ads, we misread their business, the company closed): thank them, apologise briefly if we got it wrong, and close politely without asking when to reconnect.
Never argue with their decision or ask why they would not solve the problem.
${NO_REPEAT}`,
      },
      {
        name: "One easy question",
        delayMinutes: 5 * DAY,
        aiInstructions: `Read the thread.
- If we asked when to reconnect or how they handle conversion today and they have not answered: ask one easy question instead, whether they run anything today to lift conversion from ad traffic or whether it is simply not a priority this quarter, and make clear a one-word answer is fine.
- If they gave a time to reconnect: do not ask again. Two lines: we will be in touch then, plus one useful result from Knowledge for a brand like theirs.
- If they said it is not relevant to them: one line wishing them well, no question.
${NO_REPEAT}`,
      },
      {
        name: "Reconnect",
        delayMinutes: 55 * DAY,
        aiInstructions: `Reconnect, referring to the earlier conversation and any time frame or reason they gave. Share one new, relevant result or capability from Knowledge and ask whether improving conversion from ad traffic is a priority now. If they said it is not relevant to them, write a one-line friendly check-in with no ask.`,
      },
    ],
  },
  {
    name: "Left Company",
    autoSendReply: true,
    steps: [
      {
        name: "Reply",
        delayMinutes: 0,
        aiInstructions: `They (or someone on their behalf) told us they have left the company. Reply in 2–3 short sentences.
- If the message is an automated notice, keep it to one line asking who now looks after ads or performance marketing there. If the notice already names a replacement or gives their email, do not ask for it.
- If they wrote it themselves: thank them, wish them well in the new role, and ask for the name of whoever handles ads or performance marketing at their previous company (a name is enough, we will take it from there). Then ask in one line whether their new company runs paid ads, since Dynamic Storefront could help there too.
- If they are answering a question we asked earlier, respond to their answer instead of asking again.
${NO_REPEAT}`,
      },
      {
        name: "Just a name",
        delayMinutes: 3 * DAY,
        aiInstructions: `If they have not shared a contact at their previous company, ask once more and make it tiny: just a name is all we need. If they already shared one, thank them again in one line and ask only about their new company. Two or three sentences.`,
      },
      {
        name: "New company",
        delayMinutes: 4 * DAY,
        aiInstructions: `Ask whether Dynamic Storefront could be relevant to the person's new company, with one line from Knowledge on what it does for brands running paid ads, and offer a short look. If the thread shows they are not in a role where this applies, close warmly instead.`,
      },
    ],
  },
  {
    name: "Did Not Connect to Different POC",
    autoSendReply: false,
    steps: [
      {
        name: "Reply",
        delayMinutes: 0,
        aiInstructions: `They are not the right person and have not given us a contact. Thank them and ask, lightly, who looks after paid ads or performance marketing at the company: a name is all we need and we will take it from there. Two or three sentences. Do not ask why they could not connect us, and do not ask about pricing or the product. If they made clear they will not share anyone, thank them and close politely without asking.
${NO_REPEAT}`,
      },
      {
        name: "Just a name",
        delayMinutes: 2 * DAY,
        aiInstructions: `If they have not shared a name, ask once more in one or two lines: just the name of whoever runs ads or performance marketing. If they made clear they will not share anyone, one line thanking them, no question.`,
      },
    ],
  },
  {
    name: "Not a Fit",
    create: { description: "The offer is not relevant to them (no paid ads, a different business, company closed). One polite close, no follow-ups." },
    autoSendReply: true,
    steps: [
      {
        name: "Reply",
        delayMinutes: 0,
        aiInstructions: `They told us the offer is not relevant to them. Thank them in one or two sentences, apologise briefly if we misread their business, and wish them well. Ask nothing, offer nothing, and do not suggest reconnecting later.`,
      },
    ],
  },
];

const NOT_A_FIT_STAGE = {
  categoryKey: "not_interested",
  name: "Not a Fit",
  description: "The offer is not relevant to the person or company at all — not a timing question.",
  classificationGuidance: "Use when the person says the offer does not apply to them: they do not run paid ads or performance marketing, they are a different kind of business than we assumed, the company has closed, or they are the wrong audience entirely. A temporary 'not now' is Not Required Right Now instead; an existing tool is Already Using a Tool.",
};
const NOT_REQUIRED_GUIDANCE = "Use when the person says the offering is not needed now, timing is not right, priorities are elsewhere, or asks to reconnect later without rejecting future contact. If they say it does not apply to them at all (no paid ads, a different business, company closed), use Not a Fit instead.";

function sameSteps(current: Array<{ name: string; delayMinutes: number; aiInstructions: string }>, planned: StepPlan[]) {
  return current.length === planned.length && current.every((step, index) => (
    step.name === planned[index]!.name
    && step.delayMinutes === planned[index]!.delayMinutes
    && step.aiInstructions === planned[index]!.aiInstructions
  ));
}

async function run() {
  const [pipeline] = await db.select({ id: crmPipelines.id }).from(crmPipelines)
    .where(and(inOrg(crmPipelines), eq(crmPipelines.isDefault, true))).limit(1);
  if (!pipeline) throw new Error("No default pipeline");
  const sequences = await db.select().from(crmSequences).where(inOrg(crmSequences));
  const byName = new Map(sequences.map((sequence) => [sequence.name, sequence]));
  const stages = await db.select().from(crmSubcategories).where(eq(crmSubcategories.pipelineId, pipeline.id));
  const stageByName = new Map(stages.map((stage) => [stage.name, stage]));

  // Stages first: Not a Fit, and Not Required's guidance pointing at it.
  let notAFit = stageByName.get(NOT_A_FIT_STAGE.name);
  if (!notAFit) {
    console.log(`+ stage "${NOT_A_FIT_STAGE.name}" (${NOT_A_FIT_STAGE.categoryKey})`);
    if (apply) {
      notAFit = await createSubcategory({
        pipelineId: pipeline.id,
        ...NOT_A_FIT_STAGE,
        sortOrder: (stageByName.get("Not Required Right Now")?.sortOrder ?? 0) + 1,
      });
    }
  }
  const notRequired = stageByName.get("Not Required Right Now");
  if (notRequired && notRequired.classificationGuidance !== NOT_REQUIRED_GUIDANCE) {
    console.log(`~ stage "Not Required Right Now": guidance now points "not relevant at all" to Not a Fit`);
    if (apply) await updateSubcategory(notRequired.id, { classificationGuidance: NOT_REQUIRED_GUIDANCE });
  }

  for (const plan of PLANS) {
    let sequence = byName.get(plan.name);
    if (!sequence) {
      if (!plan.create) throw new Error(`Sequence "${plan.name}" not found`);
      console.log(`+ sequence "${plan.name}"`);
      if (!apply) continue;
      const created = await createSequence({ name: plan.name, description: plan.create.description, steps: [] });
      sequence = (await db.select().from(crmSequences).where(and(inOrg(crmSequences), eq(crmSequences.id, created.id))).limit(1))[0]!;
    }
    const detail = await getSequence(sequence.id);
    const published = sequence.latestPublishedVersionId
      ? await db.select().from(crmSequenceSteps)
        .where(eq(crmSequenceSteps.sequenceVersionId, sequence.latestPublishedVersionId))
        .orderBy(crmSequenceSteps.position)
      : [];
    if (sameSteps(published, plan.steps)) {
      console.log(`= "${plan.name}": steps already published`);
    } else {
      console.log(`~ "${plan.name}": publish ${plan.steps.length} steps (was ${published.length})`);
      for (const step of plan.steps) console.log(`    ${step.name} (+${step.delayMinutes / DAY}d)`);
      if (apply) {
        const steps: SequenceStepInput[] = plan.steps.map((step, index) => {
          const existing = detail.draftSteps[index] ?? published[index];
          return {
            name: step.name,
            delayMinutes: step.delayMinutes,
            subjectTemplate: existing?.subjectTemplate ?? null,
            bodyTemplate: null,
            aiInstructions: step.aiInstructions,
            knowledgeTags: existing?.knowledgeTags ?? [],
            timing: existing?.timing ?? "after_previous",
            channel: index === 0 ? "same" : existing?.channel ?? "same",
          };
        });
        await updateSequence(sequence.id, { steps });
        await publishSequence(sequence.id);
      }
    }
    const thenId = plan.then === undefined ? undefined : byName.get(plan.then)?.id;
    if (plan.then && !thenId) throw new Error(`Then-sequence "${plan.then}" not found`);
    const metadata: Record<string, unknown> = {};
    if (sequence.autoSendReply !== plan.autoSendReply) metadata.autoSendReply = plan.autoSendReply;
    if (!sequence.autoSendFollowUps && plan.steps.length > 1) metadata.autoSendFollowUps = true;
    if (thenId !== undefined && sequence.thenSequenceId !== thenId) metadata.thenSequenceId = thenId;
    if (Object.keys(metadata).length) {
      console.log(`~ "${plan.name}": ${JSON.stringify({ ...metadata, ...(thenId ? { thenSequenceId: plan.then } : {}) })}`);
      if (apply) await updateSequence(sequence.id, metadata);
    }
  }

  // Not a Fit's stage runs Not a Fit's sequence.
  if (apply && notAFit) {
    const sequence = (await db.select().from(crmSequences)
      .where(and(inOrg(crmSequences), eq(crmSequences.name, "Not a Fit"))).limit(1))[0];
    const [assigned] = await db.select().from(crmSubcategorySequenceAssignments)
      .where(eq(crmSubcategorySequenceAssignments.subcategoryId, notAFit.id)).limit(1);
    if (sequence && assigned?.sequenceId !== sequence.id) {
      await assignSubcategorySequence(notAFit.id, { sequenceId: sequence.id });
      console.log(`~ stage "Not a Fit" → sequence "Not a Fit"`);
    }
  } else if (!notAFit) {
    console.log(`~ stage "Not a Fit" → sequence "Not a Fit"`);
  }
}

console.log(apply ? "APPLY: writing." : "DRY RUN: nothing is written. Add --apply to write.");
await runInOrganization(organizationId, run);
process.exit(0);
