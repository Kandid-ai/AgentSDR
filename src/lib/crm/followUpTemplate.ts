import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { currentOrganizationId, inOrg } from "@/lib/tenancy/scope";
import type { CrmTransaction } from "./repository";
import {
  crmSequenceSteps,
  crmSequenceVersions,
  crmSequences,
  crmSubcategories,
  crmSubcategorySequenceAssignments,
  type CrmSequenceStepTiming,
} from "./schema";

/**
 * The follow-up template every organization starts with (and existing ones can
 * opt into with scripts/apply-crm-follow-up-template.ts): a sequence per stage
 * of the ladder in defaults.ts, plus a "long-term loop" that chains to itself
 * so no lead is left idle.
 *
 * Step instructions are organization data — stored in crm_sequence_steps,
 * editable per organization, exactly like the ones scripts/seed-crm-response-
 * taxonomy.ts writes — not system prompts, so they are a typed constant here
 * and not an entry in src/lib/prompts/registry.ts.
 *
 * `{{booking_link}}` in an instruction: the AI writes that literal token and
 * it is replaced with the lead's personal Cal.com link at send time. Channels
 * are email and LinkedIn only.
 */

export const FOLLOW_UP_TEMPLATE_MARKER = "AgentSDR follow-up template v1";

const HOUR = 60;
const DAY = 24 * HOUR;

export type TemplateStep = {
  name: string;
  /** Minutes: after the previous message, or before the booked meeting starts. */
  delayMinutes: number;
  timing: CrmSequenceStepTiming;
  aiInstructions: string;
  knowledgeTags: string[];
};

export type TemplateSequence = {
  /** Stable key, recorded in the description so a re-run can find it. */
  key: string;
  name: string;
  description: string;
  /** Sub-stage keys (defaults.ts) the sequence is assigned to. */
  assignTo: string[];
  autoSendFollowUps: boolean;
  autoSendReply: boolean;
  /** Key of the sequence a finished run continues with; its own key for the loop. */
  then: string | null;
  steps: TemplateStep[];
};

/** Keys older organizations carry for a default sub-stage (the seed script once named it "Demo Requested"). */
export const SUBCATEGORY_KEY_ALIASES: Record<string, string[]> = {
  demo_request: ["demo_requested"],
};

const reply = (name: string, aiInstructions: string): TemplateStep => ({
  name, delayMinutes: 0, timing: "after_previous", aiInstructions, knowledgeTags: [],
});
const after = (days: number, name: string, aiInstructions: string): TemplateStep => ({
  name, delayMinutes: days * DAY, timing: "after_previous", aiInstructions, knowledgeTags: [],
});
const before = (minutes: number, name: string, aiInstructions: string): TemplateStep => ({
  name, delayMinutes: minutes, timing: "before_meeting", aiInstructions, knowledgeTags: [],
});

const LINK = "Include the literal token {{booking_link}} where the link goes; it is replaced with the person's own booking link when the message is sent.";

export const FOLLOW_UP_TEMPLATE: readonly TemplateSequence[] = [
  {
    key: "interested_book",
    name: "Interested: book the meeting",
    description: "Reply and follow-ups that move an interested person to a booked meeting over 14 days; then the long-term loop.",
    assignTo: ["information_requested", "case_study", "demo_request", "meeting_requested"],
    autoSendFollowUps: true,
    autoSendReply: false,
    then: "long_term_loop",
    steps: [
      reply("Reply and booking link", `Answer what they asked in two lines at most, using only the Knowledge and the thread. Then invite them to a short call. ${LINK} Do not propose specific times.`),
      after(1, "Nudge with the link", `Short nudge, one or two lines: the link is here if they want to pick a time. ${LINK} No pressure, no repeating the earlier message.`),
      after(1, "Refer to what they said", "A short note that picks up the specific thing they said or asked in their reply and connects it to why a call would be useful. Quote or paraphrase their words accurately; add nothing they did not say. Include {{booking_link}} once."),
      after(1, "Likely objection", `Address the most likely objection from the thread (time, price or fit) in two or three lines, honestly and from Knowledge only; if the thread shows no objection, say a call can be 15 minutes. ${LINK}`),
      after(2, "Relevant case study", `Share the one case study from Knowledge most relevant to their business, with its results as written there and nothing more. Say in one line why it is relevant to them. ${LINK}`),
      after(2, "Hold a time this week?", `Ask whether they would like you to hold a time this week. One or two lines, friendly. ${LINK}`),
      after(3, "Useful insight", "Share one short, useful insight about their business or industry that comes from Knowledge or the thread; do not invent statistics or claims about their company. End with one easy question. Include {{booking_link}} once."),
      after(4, "Break-up", `A short, kind break-up: ask whether to close this out or check back in a month. Make clear either answer is fine. ${LINK}`),
    ],
  },
  {
    key: "meeting_booked",
    name: "Meeting booked: get them there",
    description: "Confirms the booked meeting and reminds the person a day and an hour before it.",
    assignTo: ["meeting_booked"],
    autoSendFollowUps: true,
    autoSendReply: false,
    then: null,
    steps: [
      reply("Confirm the meeting", "Confirm the meeting warmly in two or three lines, stating the time only if it is in the thread or the record. Ask what they would like the demo to cover so it is useful to them."),
      before(DAY, "Reminder with agenda", "A reminder that the meeting is tomorrow, with a short agenda built from what they said they want covered (or a simple default if they said nothing). Say the join link is in their calendar invite; never write a link yourself."),
      before(HOUR, "See you soon", "One line: looking forward to speaking at the meeting time. The join link is in their calendar invite; never write a link yourself."),
    ],
  },
  {
    key: "no_show_rebook",
    name: "No-show: rebook",
    description: "Blame-free rebooking messages after a missed meeting over a week; then the long-term loop.",
    assignTo: ["meeting_no_show"],
    autoSendFollowUps: true,
    autoSendReply: false,
    then: "long_term_loop",
    steps: [
      reply("No worries, rebook", `Say no worries that the meeting did not work out, with no blame, and offer to find another time. ${LINK}`),
      after(1, "One-line rebook ask", `One line asking if they would like to rebook. ${LINK}`),
      after(2, "New link, different time of day", `Share the booking link again and offer a different time of day than the missed meeting if the record shows one. ${LINK}`),
      after(4, "Break-up", `A short break-up: say you will stop chasing, and leave the door open to book whenever it suits them. ${LINK}`),
    ],
  },
  {
    key: "meeting_held_pilot",
    name: "Meeting held: start the pilot",
    description: "Recap after the meeting, then steps toward starting a pilot over about two weeks; then the long-term loop.",
    assignTo: ["meeting_done"],
    autoSendFollowUps: true,
    autoSendReply: false,
    then: "long_term_loop",
    steps: [
      reply("Recap and pilot plan", "Send a recap of the meeting: their problem in their words, what was shown, the proposed pilot plan and the one next step. Use only facts from the meeting notes, thread and Knowledge, and flag anything unconfirmed instead of guessing."),
      after(1, "Open questions", "Answer any question left open in the meeting, from Knowledge and the thread only. If there is none, ask whether anything from the meeting needs more detail."),
      after(2, "What we need to start", "Say what is needed from them to start the pilot (access, a contact, data), as agreed in the thread or Knowledge, and make the first step easy. Do not invent requirements."),
      after(2, "Case study for their use case", "Share the case study from Knowledge that best matches their use case, with its results as written there, and say in a line why it applies to them."),
      after(2, "What is in the way?", "Ask plainly what is in the way of starting the pilot, and offer to help with it. Two lines, no pressure."),
      after(7, "Break-up", "A short, kind break-up: ask whether to pause the pilot plan for now or check back later. Either answer is fine."),
    ],
  },
  {
    key: "pilot_convert",
    name: "Pilot: convert to paid",
    description: "Kickoff, progress updates and a paid-plan proposal across a two-week pilot; then the long-term loop.",
    assignTo: ["pilot"],
    autoSendFollowUps: true,
    autoSendReply: false,
    then: "long_term_loop",
    steps: [
      reply("Pilot kickoff", "Kick off the pilot: what we are setting up for them, what success looks like and what happens next. Use only what the thread and Knowledge support."),
      after(2, "First progress update", "A short first progress update on the pilot. State only progress that appears in the thread or the record; if there is none to report, say what is being set up next."),
      after(5, "Midpoint results", "A midpoint update with the results so far. Use only real numbers or observations from the thread or record, and never estimate results."),
      after(4, "Results and paid-plan proposal", "Summarise the pilot's results from the thread and record, then propose moving to the paid plan, with plan details only if they are in Knowledge. Ask for their reaction."),
      after(3, "Shall we continue?", "Ask whether they would like to continue on the paid plan. One or two lines, direct and friendly."),
      after(3, "Decision nudge", "A brief nudge for a decision. Offer to answer any remaining question or adjust the proposal, and say what happens to the pilot if they do not continue only if Knowledge states it."),
      after(4, "Final note", "A final note: you will leave the decision with them, the offer stands, and they can reply any time to continue."),
    ],
  },
  {
    key: "customer_grow",
    name: "Customer: keep and grow",
    description: "Welcome, a check-in after a week and a results review with a referral ask at day 30. Nothing sends automatically.",
    assignTo: ["customer"],
    autoSendFollowUps: false,
    autoSendReply: false,
    then: null,
    steps: [
      reply("Welcome and next steps", "Reply to what they wrote, helpfully and briefly, and say what happens next for their account. Use only facts from the thread and Knowledge."),
      after(7, "Check-in", "A short check-in: how is it going, and is there anything blocking them. One easy question."),
      after(23, "Results review and referral", "Offer a review of their results so far, citing only what the thread or record shows. Then ask if there is one person or company who could benefit from the same, as a light, optional ask."),
    ],
  },
  {
    key: "long_term_loop",
    name: "Long-term loop",
    description: "A useful touch every three weeks for people who have gone quiet. It repeats until the person replies or is stopped.",
    assignTo: [],
    autoSendFollowUps: true,
    autoSendReply: false,
    then: "long_term_loop",
    steps: [
      reply("Short useful note", "A short, useful note that refers back to where the conversation left off. Only used if someone starts this sequence by hand."),
      after(21, "One useful touch", "One genuinely useful touch drawn from Knowledge: a relevant case study, feature or insight. Refer back to where the conversation left off, end with one easy question, and avoid phrases like \"just bumping this\"."),
    ],
  },
];

const descriptionTag = (key: string) => `[${FOLLOW_UP_TEMPLATE_MARKER}: ${key}]`;

export type TemplatePlan = {
  /** Template sequences that do not exist yet. */
  toCreate: TemplateSequence[];
  /** Template key -> id, for the ones already in the organization. */
  existing: Map<string, string>;
  /** A sequence to assign to a sub-stage; subcategoryId is null when the sub-stage does not exist yet. */
  assignments: Array<{ sequenceKey: string; subcategoryKey: string; subcategoryId: string | null }>;
  /** Sub-stages left alone because they already have a sequence. */
  skippedAssigned: Array<{ sequenceKey: string; subcategoryKey: string }>;
};

/** Reads only. Which template sequences are missing and which sub-stages could take them. */
export async function planFollowUpTemplate(tx: CrmTransaction, pipelineId: string): Promise<TemplatePlan> {
  const found = await tx.select({ id: crmSequences.id, description: crmSequences.description })
    .from(crmSequences)
    .where(and(inOrg(crmSequences), like(crmSequences.description, `%${FOLLOW_UP_TEMPLATE_MARKER}:%`)));
  const existing = new Map<string, string>();
  for (const sequence of FOLLOW_UP_TEMPLATE) {
    const hit = found.find((row) => row.description?.includes(descriptionTag(sequence.key)));
    if (hit) existing.set(sequence.key, hit.id);
  }
  const subcategories = await tx.select({ id: crmSubcategories.id, key: crmSubcategories.key })
    .from(crmSubcategories).where(eq(crmSubcategories.pipelineId, pipelineId));
  const assigned = new Set(
    (await tx.select({ id: crmSubcategorySequenceAssignments.subcategoryId })
      .from(crmSubcategorySequenceAssignments)
      .where(inArray(crmSubcategorySequenceAssignments.subcategoryId, subcategories.map((row) => row.id).concat(randomUUID()))))
      .map((row) => row.id),
  );
  const plan: TemplatePlan = {
    toCreate: FOLLOW_UP_TEMPLATE.filter((sequence) => !existing.has(sequence.key)),
    existing,
    assignments: [],
    skippedAssigned: [],
  };
  for (const sequence of FOLLOW_UP_TEMPLATE) {
    for (const key of sequence.assignTo) {
      const candidates = [key, ...(SUBCATEGORY_KEY_ALIASES[key] ?? [])];
      const row = subcategories.find((entry) => candidates.includes(entry.key));
      if (row && assigned.has(row.id)) plan.skippedAssigned.push({ sequenceKey: sequence.key, subcategoryKey: row.key });
      else plan.assignments.push({ sequenceKey: sequence.key, subcategoryKey: key, subcategoryId: row?.id ?? null });
    }
  }
  return plan;
}

export type SeedReport = {
  createdSequences: string[];
  assigned: Array<{ sequenceKey: string; subcategoryKey: string }>;
  skippedAssigned: TemplatePlan["skippedAssigned"];
  /** Sub-stages that do not exist in the pipeline, so nothing was assigned. */
  missingSubcategories: Array<{ sequenceKey: string; subcategoryKey: string }>;
  sequenceIds: Map<string, string>;
};

/**
 * Creates the template's missing sequences (published version 1 plus the
 * mutable draft, like the app does), chains them, and assigns them to
 * sub-stages that have no sequence. Never replaces an assignment.
 *
 * mode "new_organization": the pipeline was just created in this transaction.
 * mode "existing_organization": run by the script; same rules, the label only
 * documents the caller.
 */
export async function seedFollowUpTemplateInTransaction(
  tx: CrmTransaction,
  input: { organizationId: string; pipelineId: string; mode: "new_organization" | "existing_organization" },
): Promise<SeedReport> {
  const { organizationId } = input;
  if (organizationId !== currentOrganizationId()) throw new Error("Template organization does not match the scope");
  const plan = await planFollowUpTemplate(tx, input.pipelineId);
  const sequenceIds = new Map(plan.existing);
  const now = new Date();

  for (const sequence of plan.toCreate) {
    const id = randomUUID();
    const publishedId = randomUUID();
    const draftId = randomUUID();
    sequenceIds.set(sequence.key, id);
    // The version pointers are circular and DEFERRABLE: sequence first, as createSequence does.
    await tx.insert(crmSequences).values({
      organizationId,
      id,
      name: sequence.name,
      description: `${sequence.description} ${descriptionTag(sequence.key)}`,
      draftVersionId: draftId,
      latestPublishedVersionId: publishedId,
      autoSendFollowUps: sequence.autoSendFollowUps,
      autoSendReply: sequence.autoSendReply,
    });
    await tx.insert(crmSequenceVersions).values([
      { id: publishedId, sequenceId: id, version: 1, status: "published", publishedAt: now },
      { id: draftId, sequenceId: id, version: 2, status: "draft" },
    ]);
    for (const versionId of [publishedId, draftId]) {
      await tx.insert(crmSequenceSteps).values(sequence.steps.map((step, index) => ({
        sequenceVersionId: versionId,
        position: index + 1,
        stepType: index === 0 ? "reply" as const : "follow_up" as const,
        name: step.name,
        delayMinutes: step.delayMinutes,
        timing: step.timing,
        aiInstructions: step.aiInstructions,
        knowledgeTags: step.knowledgeTags,
      })));
    }
  }
  for (const sequence of plan.toCreate) {
    if (!sequence.then) continue;
    const target = sequenceIds.get(sequence.then);
    if (!target) continue;
    await tx.update(crmSequences).set({ thenSequenceId: target })
      .where(and(inOrg(crmSequences), eq(crmSequences.id, sequenceIds.get(sequence.key)!)));
  }

  const report: SeedReport = {
    createdSequences: plan.toCreate.map((sequence) => sequence.key),
    assigned: [],
    skippedAssigned: plan.skippedAssigned,
    missingSubcategories: [],
    sequenceIds,
  };
  for (const entry of plan.assignments) {
    if (!entry.subcategoryId) {
      report.missingSubcategories.push({ sequenceKey: entry.sequenceKey, subcategoryKey: entry.subcategoryKey });
      continue;
    }
    await tx.insert(crmSubcategorySequenceAssignments)
      .values({ subcategoryId: entry.subcategoryId, sequenceId: sequenceIds.get(entry.sequenceKey)! })
      .onConflictDoNothing();
    report.assigned.push({ sequenceKey: entry.sequenceKey, subcategoryKey: entry.subcategoryKey });
  }
  return report;
}
