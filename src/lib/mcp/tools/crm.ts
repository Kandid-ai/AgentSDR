import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { db } from "@/lib/db";
import { CRM_ACTION_GROUPS } from "@/lib/crm/actionGroups";
import { crmOperationErrorResponse } from "@/lib/crm/api";
import { listCategoryConfiguration } from "@/lib/crm/categories";
import { getCrmAiInstructions } from "@/lib/crm/aiSettings";
import { formatAiInstructions } from "@/lib/crm/ai/instructions";
import { loadDraftNow, loadDraftSender } from "@/lib/crm/draftSender";
import { discardDraft, FALLBACK_STEP_INSTRUCTIONS, regenerateDraft, updateDraft } from "@/lib/crm/drafts";
import { retrieveKnowledge } from "@/lib/crm/knowledge";
import { getKnowledgeDocument, listKnowledgeDocuments } from "@/lib/crm/knowledge-service";
import {
  acknowledgeClassification,
  applyHumanClassification,
  closeCrmRecord,
  createManualDraft,
  moveRecordStage,
  reopenCrmRecord,
} from "@/lib/crm/operations";
import { clearPersonDoNotContact, setPersonDoNotContact } from "@/lib/crm/policies";
import { countCrmActionGroups, getCrmRecordWorkspace, listCrmActions } from "@/lib/crm/queries";
import { crmDrafts, crmRecords, crmSequenceSteps } from "@/lib/crm/schema";
import { sendDraft } from "@/lib/crm/send";
import { snoozeSequence } from "@/lib/crm/sequences";
import { getPrompt } from "@/lib/observability/langfuse";
import { CallApiError, getCall, listCalls } from "@/lib/calls/sessions";
import { inOrg, runInOrganization } from "@/lib/tenancy/scope";
import { API_SCOPES, type ApiScope } from "@/lib/publicApi/scopes";
import type { McpCaller } from "../caller";
import {
  ACTION_GROUP_LABELS,
  draftBody,
  draftNextSteps,
  errorResult,
  iso,
  jsonResult,
  personName,
  recordUrl,
  stageLabel,
  truncate,
} from "../format";
import { appBaseUrl } from "../oauth";

/**
 * The CRM's Action required queue as MCP tools: everything a rep does there —
 * read the queue, open a lead with its whole thread, review and send the AI's
 * draft (or write their own), confirm or correct the AI's reading of a reply,
 * move a stage, snooze, close, mark Do Not Contact.
 *
 * Each tool calls the same lib functions the app's routes call, inside the
 * caller's organization, so every rule the UI obeys (Do Not Contact, sending
 * guards, optimistic concurrency, sequences starting on send) holds here too.
 */

const CATEGORY_KEYS = ["customer", "interested", "not_interested", "other"] as const;
const CHANNELS = ["email", "linkedin", "whatsapp"] as const;

/** A refusal raised by a tool itself; its message goes to the model as is. */
export class CrmToolError extends Error {}

const uuid = (label: string) => z.string().uuid(`${label} must be a UUID`);

/** The caller the route put on this request (see src/app/api/mcp/route.ts). */
function callerOf(ctx: ServerContext): McpCaller {
  const caller = ctx.http?.authInfo?.extra?.caller as McpCaller | undefined;
  if (!caller) throw new Error("MCP request reached a tool without an authenticated caller");
  return caller;
}

/**
 * Runs a tool body in the caller's organization and turns every failure into
 * an `isError` result the model can read and act on — never a protocol error.
 */
async function run(ctx: ServerContext, scope: ApiScope, body: (caller: McpCaller) => Promise<Record<string, unknown>>) {
  const caller = callerOf(ctx);
  // Tools outside the caller's scopes are not even listed (registerCrmTools);
  // this is the backstop for a client calling one by name anyway.
  if (!caller.scopes.includes(scope)) {
    return errorResult(
      `This connection was not given permission to ${API_SCOPES[scope].label.toLowerCase()} (scope ${scope}). Reconnect AgentSDR and allow it, or use a key that has it.`,
    );
  }
  try {
    return jsonResult(await runInOrganization(caller.organizationId, () => body(caller)));
  } catch (error) {
    return errorResult(await describeError(error));
  }
}

async function describeError(error: unknown): Promise<string> {
  if (error instanceof CrmToolError || error instanceof CallApiError) return error.message;
  if (error instanceof z.ZodError) return error.issues.map((issue) => issue.message).join("; ");
  const response = crmOperationErrorResponse(error);
  const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
  if (response.status >= 500) {
    console.error("[mcp] tool failed", error);
    return "AgentSDR hit an internal error doing this. Try once more; if it fails again, do it in the app.";
  }
  const message = payload.error ?? "The request was refused.";
  switch (payload.code) {
    case "STALE_CONTEXT":
      return `${message}. The record changed since you read it (a new reply, or someone else acted). Call crm_get_record again and retry with the new contextVersion.`;
    case "NOT_FOUND":
      return `${message}. Check the id — it must come from crm_list_records or crm_get_record in this organization.`;
    case "PLATFORM_NOT_CONNECTED":
      return `${message}. An admin has to connect it in AgentSDR Settings first.`;
    default:
      return message;
  }
}

// ---------------------------------------------------------------------------
// Shapes

type ActionRow = Awaited<ReturnType<typeof listCrmActions>>["actions"][number];

/** Which records crm_list_records reads: the queue, every open record (the CRM's pipeline), or the closed ones. */
const LIST_VIEWS = ["action_required", "open", "closed"] as const;
type ListView = (typeof LIST_VIEWS)[number];
const PIPELINE_STAGE_KEYS = ["needs_action", "waiting", "exhausted"] as const;

function shapeAction(row: ActionRow, detailed: boolean, baseUrl: string, view: ListView) {
  const draft = row.draft;
  const run = row.activeRun;
  const classification = row.classification;
  return {
    recordId: row.recordId,
    contextVersion: row.record.contextVersion,
    url: recordUrl(baseUrl, row.recordId),
    action: row.actionType,
    person: {
      id: row.person.id,
      name: personName(row.person),
      email: row.person.email ?? null,
      title: row.person.title ?? null,
      company: row.company?.name ?? null,
    },
    channel: row.channel,
    stage: {
      categoryKey: row.record.categoryKey,
      subcategoryId: row.record.subcategoryId,
      label: stageLabel(row.record.categoryKey, row.subcategory?.name ?? null),
    },
    workflowState: row.record.workflowState,
    ...(view === "open" ? { pipelineStage: row.stage } : {}),
    ...(view === "closed" ? { closedReason: row.record.closedReason ?? null } : {}),
    dueAt: iso(row.dueAt),
    latestReply: row.latestInbound
      ? {
          at: iso(row.latestInbound.sentAt),
          channel: row.latestInbound.channel,
          subject: row.latestInbound.subject ?? null,
          text: truncate(row.latestInbound.bodyText, detailed ? 1500 : 240),
        }
      : null,
    draft: draft
      ? {
          id: draft.id,
          revision: draft.revision,
          status: draft.status,
          channel: draft.channel,
          step: row.draftStepLabel ?? null,
          subject: draft.subject ?? null,
          body: truncate(draftBody(draft), detailed ? 4000 : 300),
          autoSendAt: iso(draft.autoSendAt),
          error: draft.error ?? null,
        }
      : null,
    classification:
      classification && !classification.acknowledgedAt
        ? {
            id: classification.id,
            status: classification.status,
            proposed: stageLabel(classification.proposedCategoryKey, null),
            reasoning: truncate(classification.reasoning, detailed ? 1000 : 200),
          }
        : null,
    sequence: run
      ? { name: run.sequence.name, status: run.run.status, step: run.step?.name ?? null, position: run.run.currentStepPosition }
      : null,
    doNotContact: Boolean(row.contactPolicy?.doNotContact),
  };
}

type Workspace = Awaited<ReturnType<typeof getCrmRecordWorkspace>>;

/** The conversation a new reply belongs in: the one the latest reply came in on, else the newest on the record's channel. */
function replyConversationId(workspace: Workspace): string | null {
  const latest = workspace.messages.find((message) => message.id === workspace.latestInboundMessageId);
  if (latest) return latest.conversationId;
  const onChannel = workspace.conversations.filter((conversation) => conversation.channel === workspace.activeChannel);
  return (onChannel.at(-1) ?? workspace.conversations.at(-1))?.id ?? null;
}

const KNOWLEDGE_KINDS = ["company", "product", "pricing", "faq", "case_study", "objection", "scheduling", "custom"] as const;
/** Knowledge is read whole, as the CRM's drafter reads it; this only guards a pathological document. */
const MAX_KNOWLEDGE_CHARS = 40_000;

type KnowledgeListing = Awaited<ReturnType<typeof listKnowledgeDocuments>>[number];

function knowledgeIndexEntry(document: KnowledgeListing) {
  const content = document.latest?.content ?? "";
  return {
    id: document.id,
    title: document.title,
    kind: document.kind,
    tags: document.tags,
    alwaysInclude: document.alwaysInclude,
    chars: content.length,
    preview: truncate(content, 200),
  };
}

/**
 * The sequence step a message for this record is written for: the draft's own
 * step, else the active run's current one. Null when the record runs no
 * sequence — the CRM's drafter then follows FALLBACK_STEP_INSTRUCTIONS.
 */
async function currentWritingStep(workspace: Workspace) {
  const draft = workspace.draft;
  const fromDraft = draft?.sequenceStepRunId
    ? workspace.stepRuns.find((row) => row.stepRun.id === draft.sequenceStepRunId) ?? null
    : null;
  const activeRun = workspace.runs.find((row) => row.run.status === "active" || row.run.status === "paused") ?? null;
  const versionId = fromDraft?.step.sequenceVersionId ?? activeRun?.run.sequenceVersionId;
  if (!versionId) return null;
  // Steps hang off an organization-scoped sequence version reached through this record's run.
  const steps = await db.select().from(crmSequenceSteps)
    .where(eq(crmSequenceSteps.sequenceVersionId, versionId))
    .orderBy(asc(crmSequenceSteps.position));
  const step = fromDraft?.step ?? steps.find((row) => row.position === activeRun?.run.currentStepPosition) ?? null;
  if (!step) return null;
  return { step, totalSteps: steps.length, sequenceName: activeRun?.sequence.name ?? null };
}

// ---------------------------------------------------------------------------
// Tools

const SERVER_URL_NOTE = "Every record has a `url` that opens it in AgentSDR — share it when the user may want to look themselves.";

/** The scope each tool needs: reading, changing records, or sending. */
export const CRM_TOOL_SCOPES = {
  crm_list_records: "crm:read",
  crm_get_record: "crm:read",
  crm_get_call: "crm:read",
  crm_list_stages: "crm:read",
  crm_get_writing_guide: "crm:read",
  crm_get_knowledge: "crm:read",
  crm_update_draft: "crm:write",
  crm_send_draft: "crm:send",
  crm_regenerate_draft: "crm:write",
  crm_write_draft: "crm:write",
  crm_discard_draft: "crm:write",
  crm_review_classification: "crm:write",
  crm_move_stage: "crm:write",
  crm_snooze: "crm:write",
  crm_close_record: "crm:write",
  crm_set_do_not_contact: "crm:write",
} as const satisfies Record<string, ApiScope>;

/** Registers the CRM tools the caller's scopes allow; the rest are not listed at all. */
export function registerCrmTools(server: McpServer, granted: readonly ApiScope[]) {
  const registered = registerAllCrmTools(server);
  for (const [name, tool] of Object.entries(registered)) {
    if (!granted.includes(CRM_TOOL_SCOPES[name as keyof typeof CRM_TOOL_SCOPES])) tool.remove();
  }
}

function registerAllCrmTools(server: McpServer) {
  const baseUrl = appBaseUrl();
  const tools: Record<string, { remove: () => void }> = {};

  tools["crm_list_records"] = server.registerTool(
    "crm_list_records",
    {
      title: "List or find leads",
      description: [
        "List AgentSDR CRM records (one per lead who replied), newest activity first, or find one by name, email or company with `search`.",
        "`view`: `action_required` (default) is the queue of leads waiting on the team; `open` is every open lead, including those waiting on the lead's reply or a scheduled follow-up and those whose follow-ups have all gone out (`pipelineStage`); `closed` is closed records. For \"show me the interested leads\" or to find a person, use `open`; if `search` finds nothing there, try `closed`.",
        "Narrow with `stage` (customer, interested, not_interested, other), `subcategoryId` (a sub-stage such as \"Demo booked\", ids from crm_list_stages), `channel` and, in the queue, `group`.",
        "Each item says what is needed or what it is waiting on (`action`), who the lead is, their latest reply, the AI's draft if there is one (id + revision, needed to edit or send it) and the record's contextVersion. Use crm_get_record for the whole conversation.",
        "Queue groups: reply = an AI reply draft to approve; follow_up = a follow-up draft to approve or a follow-up that is due; classification = confirm the AI's reading of a reply; next_step = no sequence, decide what's next; problem = a send failed or delivery is uncertain.",
      ].join("\n"),
      inputSchema: z.object({
        view: z.enum(LIST_VIEWS).default("action_required").describe("`action_required` (the queue), `open` (every open lead) or `closed`."),
        stage: z.enum(CATEGORY_KEYS).optional().describe("Only records in this stage category."),
        subcategoryId: uuid("subcategoryId").optional().describe("Only this sub-stage (ids from crm_list_stages)."),
        search: z.string().trim().min(1).max(200).optional().describe("Match the person's name or email, or their company's name."),
        channel: z.enum(CHANNELS).optional().describe("Only records whose active channel is this."),
        group: z.enum(CRM_ACTION_GROUPS).optional().describe("view action_required only: one action group."),
        pipelineStage: z
          .enum(PIPELINE_STAGE_KEYS)
          .optional()
          .describe("view open only: `needs_action` (in the queue), `waiting` (on their reply or a scheduled follow-up) or `exhausted` (every follow-up sent, no answer)."),
        overdueOnly: z.boolean().optional().describe("Only records whose next action is past due."),
        limit: z.number().int().min(1).max(50).default(20).describe("Items per page (max 50)."),
        offset: z.number().int().min(0).default(0).describe("Skip this many items; use `nextOffset` from the previous page."),
        detail: z
          .enum(["concise", "detailed"])
          .default("concise")
          .describe("`concise` cuts replies to 240 chars and drafts to 300; `detailed` gives up to 1500 / 4000."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:read", async () => {
        const view = input.view;
        if (input.group && view !== "action_required") throw new CrmToolError("`group` only applies to view action_required.");
        if (input.pipelineStage && view !== "open") throw new CrmToolError("`pipelineStage` only applies to view open.");
        const queue = view === "action_required";
        const [page, counts] = await Promise.all([
          listCrmActions({
            scope: queue ? "actions" : "pipeline",
            workflowState: view === "closed" ? "closed" : undefined,
            stage: view === "open" ? input.pipelineStage : undefined,
            actionGroup: queue ? input.group : undefined,
            channel: input.channel,
            categoryKey: input.stage,
            subcategoryId: input.subcategoryId,
            search: input.search,
            overdue: input.overdueOnly || undefined,
            limit: input.limit,
            offset: input.offset,
          }),
          queue ? countCrmActionGroups() : null,
        ]);
        const detailed = input.detail === "detailed";
        return {
          view,
          total: page.total,
          ...(counts
            ? {
                countsByGroup: Object.fromEntries(
                  CRM_ACTION_GROUPS.map((group) => [group, { label: ACTION_GROUP_LABELS[group], count: counts[group] }]),
                ),
              }
            : {}),
          ...(view === "open" && page.stageCounts ? { countsByPipelineStage: page.stageCounts } : {}),
          items: page.actions.map((row) => shapeAction(row, detailed, baseUrl, view)),
          nextOffset: page.hasMore ? page.nextOffset : null,
          listUrl: `${baseUrl}/crm/${queue ? "actions" : "pipeline"}`,
        };
      }),
  );

  tools["crm_get_record"] = server.registerTool(
    "crm_get_record",
    {
      title: "Get lead record",
      description: [
        "Everything about one CRM record (a lead's relationship): the person and company (including imported custom fields), stage, the AI's latest classification, the open draft in full, the active sequence, the conversation across email, LinkedIn and WhatsApp (newest messages last), and recent calls.",
        "Read this before drafting, editing or sending a reply. Returns `contextVersion` (for stage changes) and `draft.id` + `draft.revision` (for draft changes).",
        SERVER_URL_NOTE,
      ].join("\n"),
      inputSchema: z.object({
        recordId: uuid("recordId").describe("From crm_list_records."),
        messageLimit: z.number().int().min(1).max(100).default(15).describe("How many of the most recent messages to include."),
        maxMessageChars: z.number().int().min(200).max(20_000).default(2000).describe("Cut each message body at this length."),
        includeActivity: z.boolean().default(false).describe("Also return the last 15 CRM events (stage changes, sends, …)."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:read", async () => {
        const workspace = await getCrmRecordWorkspace(input.recordId);
        const person = workspace.person;
        const calls = await listCalls(person.id).catch(() => []);
        const timeline = workspace.timeline;
        const shown = timeline.slice(-input.messageLimit);
        const draft = workspace.draft;
        const draftStep = draft?.sequenceStepRunId
          ? workspace.stepRuns.find((row) => row.stepRun.id === draft.sequenceStepRunId)?.step ?? null
          : null;
        const activeRun = workspace.runs.find((row) => row.run.status === "active" || row.run.status === "paused") ?? null;
        const conversationNames = new Map(workspace.conversations.map((conversation) => [conversation.id, conversation.accountLabel]));
        return {
          recordId: workspace.id,
          contextVersion: workspace.contextVersion,
          url: recordUrl(baseUrl, workspace.id),
          workflowState: workspace.workflowState,
          closedReason: workspace.closedReason ?? null,
          stage: {
            categoryKey: workspace.categoryKey,
            subcategoryId: workspace.subcategoryId,
            label: stageLabel(workspace.categoryKey, workspace.subcategory),
          },
          activeChannel: workspace.activeChannel,
          nextActionAt: iso(workspace.nextActionAt),
          lastInboundAt: iso(workspace.lastInboundAt),
          lastOutboundAt: iso(workspace.lastOutboundAt),
          doNotContact: workspace.dnc,
          person: {
            id: person.id,
            name: personName(person),
            email: person.email ?? null,
            phone: person.phone ?? null,
            title: person.title ?? null,
            linkedinUrl: person.linkedinUrl ?? null,
            customFields: person.custom ?? {},
          },
          company: workspace.company
            ? {
                id: workspace.company.id,
                name: workspace.company.name ?? null,
                domain: workspace.company.domain,
                linkedinUrl: workspace.company.linkedinUrl ?? null,
                customFields: (workspace.company as { custom?: Record<string, unknown> }).custom ?? {},
              }
            : null,
          classification: workspace.classification
            ? {
                id: workspace.classification.id,
                status: workspace.classification.status,
                category: workspace.classification.category,
                reasoning: truncate(workspace.classification.reason, 2000),
                needsConfirmation: workspace.aiChanged,
              }
            : null,
          draft: draft
            ? {
                id: draft.id,
                revision: draft.revision,
                status: draft.status,
                channel: draft.channel,
                conversationId: draft.conversationId,
                sendsFrom: conversationNames.get(draft.conversationId) ?? null,
                step: draftStep ? { name: draftStep.name, type: draftStep.stepType, position: draftStep.position } : null,
                subject: draft.subject ?? null,
                body: draftBody(draft),
                editedByHuman: draft.editedBodyText != null,
                autoSendAt: iso(draft.autoSendAt),
                error: draft.error ?? null,
                nextSteps: draftNextSteps(draft.status),
              }
            : null,
          sequence: activeRun
            ? {
                name: activeRun.sequence.name,
                status: activeRun.run.status,
                currentStepPosition: activeRun.run.currentStepPosition,
              }
            : null,
          conversations: workspace.conversations.map((conversation) => ({
            id: conversation.id,
            channel: conversation.channel,
            account: conversation.accountLabel,
            messageCount: conversation.messages.length,
          })),
          messages: {
            total: timeline.length,
            omittedOlder: timeline.length - shown.length,
            items: shown.map((message) => ({
              at: iso(message.sentAt ?? message.createdAt),
              direction: message.direction,
              channel: message.channel,
              from: message.direction === "inbound" ? personName(person) : "us",
              label: message.label ?? null,
              subject: message.subject ?? null,
              text: truncate(message.bodyText ?? message.body ?? "", input.maxMessageChars),
            })),
          },
          calls: calls.slice(0, 10).map((call) => ({
            id: call.id,
            at: call.startedAt ?? call.createdAt,
            status: call.status,
            durationSeconds: call.durationMs ? Math.round(call.durationMs / 1000) : null,
            disposition: call.disposition ?? null,
            agentOutcome: call.agentOutcome ?? null,
            transcript: call.transcriptStatus,
          })),
          ...(input.includeActivity
            ? {
                activity: workspace.events.slice(0, 15).map((event) => ({
                  at: iso(event.createdAt),
                  type: event.eventType,
                  actor: event.actorRef ?? event.actorType,
                })),
              }
            : {}),
        };
      }),
  );

  tools["crm_get_call"] = server.registerTool(
    "crm_get_call",
    {
      title: "Get call transcript",
      description:
        "The transcript and summary of one WhatsApp call with a lead (ids from crm_get_record's `calls`). Use it when the next message should follow up on what was said on a call.",
      inputSchema: z.object({
        callId: uuid("callId"),
        maxUtterances: z.number().int().min(1).max(500).default(200),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:read", async () => {
        const call = await getCall(input.callId);
        const utterances = call.transcript?.utterances ?? [];
        return {
          id: call.id,
          personId: call.personId,
          at: call.startedAt ?? call.createdAt,
          status: call.status,
          durationSeconds: call.durationMs ? Math.round(call.durationMs / 1000) : null,
          mode: call.mode ?? "rep",
          agentOutcome: call.agentOutcome ?? null,
          summary: call.transcript?.summary ?? null,
          language: call.transcript?.language ?? null,
          transcriptStatus: call.transcriptStatus,
          utterances: utterances.slice(0, input.maxUtterances).map((utterance) => ({
            at: utterance.startSeconds,
            speaker: utterance.speaker === "rep" ? "us" : "lead",
            text: utterance.text,
          })),
          omittedUtterances: Math.max(0, utterances.length - input.maxUtterances),
        };
      }),
  );

  tools["crm_list_stages"] = server.registerTool(
    "crm_list_stages",
    {
      title: "List pipeline stages",
      description:
        "The organization's pipeline stages: four categories (customer, interested, not_interested, other), each with its sub-stages (`subcategoryId`) and the sequence each sub-stage runs. Use the ids with crm_move_stage and crm_review_classification.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (_input, ctx) =>
      run(ctx, "crm:read", async () => {
        const configuration = await listCategoryConfiguration();
        return {
          categories: configuration.categories.map((category) => ({
            key: category.key,
            name: category.label,
            subcategories: category.subcategories
              .filter((subcategory) => subcategory.active)
              .map((subcategory) => ({
                id: subcategory.id,
                name: subcategory.name,
                hasSequence: Boolean(subcategory.sequenceId),
                openRecords: subcategory.activeRecordCount,
              })),
          })),
        };
      }),
  );

  tools["crm_get_writing_guide"] = server.registerTool(
    "crm_get_writing_guide",
    {
      title: "Get writing guide",
      description: [
        "How this team writes to leads. Read it before you write or rewrite a message (crm_write_draft, crm_update_draft, or a draft in the chat) so it sounds like the team and states only what is true.",
        "Returns AgentSDR's reply rules (`rules`), the team's own drafting instructions (`teamInstructions`: tone, style, positioning, what to offer or avoid) and the Knowledge base: documents marked \"always include\" in full, the rest as an index (read them with crm_get_knowledge).",
        "Pass `recordId` to also get what applies to that lead: who the message goes out as (`sendsAs`), the current time in the team's time zone (`now`), the sequence step the message is for (its instructions, step N of M) and, in full, the Knowledge that step draws on — the same picture AgentSDR's own AI drafts from.",
      ].join("\n"),
      inputSchema: z.object({
        recordId: uuid("recordId").optional().describe("The lead's record (from crm_list_records), to include what applies to this message."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:read", async () => {
        const workspace = input.recordId ? await getCrmRecordWorkspace(input.recordId) : null;
        const [rules, settings, documents] = await Promise.all([
          getPrompt("mcp/writing-rules"),
          getCrmAiInstructions(workspace?.pipelineId),
          listKnowledgeDocuments({}),
        ]);

        let forThisLead: Record<string, unknown> | null = null;
        let included: { id: string; title: string; kind: string; content: string }[];
        if (workspace) {
          const conversationId = replyConversationId(workspace);
          const conversation = workspace.conversations.find((row) => row.id === conversationId) ?? null;
          const [writing, sender, now] = await Promise.all([
            currentWritingStep(workspace),
            conversation ? loadDraftSender(db, { channel: conversation.channel, accountRef: conversation.accountRef }) : null,
            loadDraftNow(),
          ]);
          const step = writing?.step ?? null;
          // The drafter's own retrieval for this step: always-include, the step's tags, and a search on its brief.
          const knowledge = await retrieveKnowledge(db, step
            ? { query: [step.name, step.aiInstructions, step.bodyTemplate].filter(Boolean).join(" "), knowledgeTags: step.knowledgeTags }
            : { query: FALLBACK_STEP_INSTRUCTIONS, knowledgeTags: [] });
          included = knowledge.entries.map((entry) => ({ id: entry.documentId, title: entry.title, kind: entry.kind, content: entry.excerpt }));
          forThisLead = {
            recordId: workspace.id,
            channel: conversation?.channel ?? workspace.activeChannel,
            sendsAs: sender,
            now,
            sequenceStep: step
              ? {
                  sequence: writing?.sequenceName ?? null,
                  name: step.name,
                  type: step.stepType,
                  position: step.position,
                  totalSteps: writing?.totalSteps ?? null,
                  instructions: step.aiInstructions,
                  subjectTemplate: step.subjectTemplate ?? null,
                  bodyTemplate: step.bodyTemplate ?? null,
                }
              : null,
            ...(step ? {} : { instructions: FALLBACK_STEP_INSTRUCTIONS }),
          };
        } else {
          included = documents
            .filter((document) => document.alwaysInclude && document.latest?.content)
            .map((document) => ({ id: document.id, title: document.title, kind: document.kind, content: document.latest!.content }));
        }
        const includedIds = new Set(included.map((document) => document.id));
        return {
          rules: rules.text,
          teamInstructions: formatAiInstructions(settings.draftInstructions),
          ...(forThisLead ? { forThisLead } : {}),
          knowledge: included.map((document) => ({ ...document, content: truncate(document.content, MAX_KNOWLEDGE_CHARS) })),
          otherKnowledge: documents
            .filter((document) => !includedIds.has(document.id))
            .map((document) => ({ id: document.id, title: document.title, kind: document.kind })),
        };
      }),
  );

  tools["crm_get_knowledge"] = server.registerTool(
    "crm_get_knowledge",
    {
      title: "Get Knowledge",
      description: [
        "The team's Knowledge base: what AgentSDR's AI knows about the company (product, pricing, FAQs, case studies, objection handling, scheduling, …).",
        "Without `documentIds` it returns an index (id, title, kind, tags, size, a preview), narrowed by `search` or `kind`. With `documentIds` it returns those documents in full.",
        "Use it to ground a reply in facts — never state a product detail, price or claim that is not in Knowledge, the conversation or what the user told you. crm_get_writing_guide already includes the documents that apply to a given lead.",
      ].join("\n"),
      inputSchema: z.object({
        documentIds: z.array(uuid("documentIds[]")).min(1).max(20).optional().describe("Read these documents in full (ids from the index)."),
        search: z.string().trim().min(1).max(200).optional().describe("Index only: documents whose title, tags or text contain every word."),
        kind: z.enum(KNOWLEDGE_KINDS).optional().describe("Index only: one kind of document."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:read", async () => {
        if (input.documentIds) {
          const documents = await Promise.all([...new Set(input.documentIds)].map((id) => getKnowledgeDocument(id)));
          return {
            documents: documents.map((document) => {
              const latest = document.versions.find((version) => version.version === document.latestVersion);
              return {
                id: document.id,
                title: document.title,
                kind: document.kind,
                tags: document.tags,
                alwaysInclude: document.alwaysInclude,
                active: document.active,
                updatedAt: iso(document.updatedAt),
                content: truncate(latest?.content ?? "", MAX_KNOWLEDGE_CHARS),
              };
            }),
          };
        }
        const words = input.search?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
        const documents = (await listKnowledgeDocuments({ kind: input.kind })).filter((document) => {
          if (!words.length) return true;
          const haystack = [document.title, document.tags.join(" "), document.latest?.content ?? ""].join(" ").toLowerCase();
          return words.every((word) => haystack.includes(word));
        });
        return {
          total: documents.length,
          documents: documents.map(knowledgeIndexEntry),
          knowledgeUrl: `${baseUrl}/settings/knowledge`,
        };
      }),
  );

  tools["crm_update_draft"] = server.registerTool(
    "crm_update_draft",
    {
      title: "Edit draft",
      description:
        "Replace the text (and, for email, the subject) of an open draft without sending it. Plain text; line breaks are kept. Returns the new revision — pass it to crm_send_draft. Fails if the draft changed since `revision` (re-read with crm_get_record).",
      inputSchema: z.object({
        draftId: uuid("draftId"),
        revision: z.number().int().min(0).describe("The draft's current revision."),
        body: z.string().trim().min(1, "body must not be empty").max(100_000),
        subject: z.string().trim().max(998).optional().describe("Email only; omit to keep the current subject."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async (caller) => {
        const draft = await updateDraft({
          draftId: input.draftId,
          revision: input.revision,
          subject: input.subject,
          bodyText: input.body,
          actorRef: caller.actorRef,
        });
        return { draftId: draft.id, revision: draft.revision, status: draft.status, subject: draft.subject, body: draftBody(draft) };
      }),
  );

  tools["crm_send_draft"] = server.registerTool(
    "crm_send_draft",
    {
      title: "Send draft",
      description: [
        "Send an open draft to the lead now, from the mailbox / LinkedIn account / WhatsApp number of its conversation. This really sends a message and cannot be undone.",
        "Unless the user has told you to send without asking, show them the final text and get a yes first.",
        "Optionally pass `body` (and `subject`) to send an edited version in one step. Sending starts the stage's follow-ups, like sending from the app. Do Not Contact and sending limits are enforced.",
        "Retrying with the same draftId + revision never sends twice.",
      ].join("\n"),
      inputSchema: z.object({
        draftId: uuid("draftId"),
        revision: z.number().int().min(0).describe("The draft's current revision (from crm_get_record or crm_update_draft)."),
        body: z.string().trim().min(1).max(100_000).optional().describe("Send this text instead of the draft's current text."),
        subject: z.string().trim().max(998).optional().describe("Email only."),
        cc: z.array(z.string().email()).max(20).optional().describe("Email only."),
        bcc: z.array(z.string().email()).max(20).optional().describe("Email only."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (input, ctx) =>
      run(ctx, "crm:send", async (caller) => {
        let revision = input.revision;
        if (input.body !== undefined || input.subject !== undefined) {
          const [current] = await db.select({ aiBodyText: crmDrafts.aiBodyText, editedBodyText: crmDrafts.editedBodyText })
            .from(crmDrafts).where(eq(crmDrafts.id, input.draftId)).limit(1);
          const edited = await updateDraft({
            draftId: input.draftId,
            revision,
            subject: input.subject,
            bodyText: input.body ?? draftBody(current ?? {}),
            actorRef: caller.actorRef,
          });
          revision = edited.revision;
        }
        try {
          const attempt = await sendDraft({
            draftId: input.draftId,
            revision,
            // Deterministic: a client retrying the same send replays the first attempt.
            idempotencyKey: `mcp:${input.draftId}:${revision}`,
            requestId: crypto.randomUUID(),
            actorRef: caller.actorRef,
            ccEmails: input.cc,
            bccEmails: input.bcc,
          });
          return {
            sent: attempt.status === "sent",
            attemptStatus: attempt.status,
            error: attempt.error ?? null,
            draftId: input.draftId,
            revision,
          };
        } catch (error) {
          // A provider failure is recorded on the draft; report it rather than a generic error.
          const [draft] = await db.select({ status: crmDrafts.status, error: crmDrafts.error })
            .from(crmDrafts).where(eq(crmDrafts.id, input.draftId)).limit(1);
          if (draft && (draft.status === "failed" || draft.status === "delivery_uncertain")) {
            return {
              sent: false,
              draftStatus: draft.status,
              error: draft.error,
              nextSteps: draftNextSteps(draft.status),
            };
          }
          throw error;
        }
      }),
  );

  tools["crm_regenerate_draft"] = server.registerTool(
    "crm_regenerate_draft",
    {
      title: "Rewrite draft with AI",
      description:
        "Ask AgentSDR's AI to rewrite an open draft, optionally with feedback (\"shorter\", \"mention the case study\", \"propose Tuesday 3pm\"). Uses the organization's own sequence instructions and knowledge. Returns the new draft when ready; if it is still `generating`, read the record again shortly. For hand-written drafts, use crm_update_draft instead.",
      inputSchema: z.object({
        draftId: uuid("draftId"),
        feedback: z.string().trim().max(2000).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async () => {
        const draft = await regenerateDraft(input.draftId, {}, input.feedback ?? null);
        return {
          draftId: draft.id,
          revision: draft.revision,
          status: draft.status,
          subject: draft.subject,
          body: draftBody(draft),
          nextSteps: draftNextSteps(draft.status),
        };
      }),
  );

  tools["crm_write_draft"] = server.registerTool(
    "crm_write_draft",
    {
      title: "Write a new draft",
      description:
        "Create a draft for a record that has none (or after discarding one), with your own text. It is not sent — review it, then crm_send_draft. Goes on the conversation the latest reply came in on unless `conversationId` (from crm_get_record) says otherwise. Email drafts need a subject. Refused for Do Not Contact.",
      inputSchema: z.object({
        recordId: uuid("recordId"),
        body: z.string().trim().min(1, "body must not be empty").max(100_000),
        subject: z.string().trim().max(998).optional(),
        conversationId: uuid("conversationId").optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async () => {
        let conversationId = input.conversationId ?? null;
        if (!conversationId) {
          conversationId = replyConversationId(await getCrmRecordWorkspace(input.recordId));
          if (!conversationId) throw new CrmToolError("This record has no conversation to write in yet.");
        }
        const draft = await createManualDraft({
          recordId: input.recordId,
          conversationId,
          subject: input.subject ?? null,
          bodyText: input.body,
        });
        return { draftId: draft.id, revision: draft.revision, status: draft.status, channel: draft.channel, subject: draft.subject };
      }),
  );

  tools["crm_discard_draft"] = server.registerTool(
    "crm_discard_draft",
    {
      title: "Discard draft",
      description: "Throw away an open draft without sending it. The record stays in the queue until it is replied to, moved or closed.",
      inputSchema: z.object({ draftId: uuid("draftId") }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async (caller) => {
        const draft = await discardDraft({ draftId: input.draftId, actorRef: caller.actorRef });
        return { draftId: draft.id, status: draft.status };
      }),
  );

  tools["crm_review_classification"] = server.registerTool(
    "crm_review_classification",
    {
      title: "Confirm or correct the AI's reading",
      description: [
        "For items in the `classification` group: the AI read the lead's latest reply and proposed a stage.",
        "`confirm` accepts it. `correct` says the AI misread the reply and sets the right stage (categoryKey + subcategoryId from crm_list_stages); a new reply draft is then written for that stage.",
        "To record that the deal moved on for another reason (a meeting happened), use crm_move_stage instead.",
      ].join("\n"),
      inputSchema: z.object({
        recordId: uuid("recordId"),
        decision: z.enum(["confirm", "correct"]),
        expectedContextVersion: z.number().int().min(0).describe("contextVersion from crm_get_record."),
        categoryKey: z.enum(CATEGORY_KEYS).optional().describe("Required for `correct`."),
        subcategoryId: uuid("subcategoryId").nullable().optional().describe("For `correct`: the sub-stage, or null for none."),
        reason: z.string().trim().max(2000).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async (caller) => {
        const workspace = await getCrmRecordWorkspace(input.recordId);
        const classification = workspace.classification;
        if (input.decision === "confirm") {
          if (!classification) throw new CrmToolError("This record has no AI classification to confirm.");
          if (workspace.contextVersion !== input.expectedContextVersion) {
            throw new CrmToolError("The record changed since you read it. Call crm_get_record again and review the latest reading.");
          }
          await acknowledgeClassification({ classificationId: classification.id, actorRef: caller.actorRef });
          return { recordId: input.recordId, confirmed: stageLabel(classification.category, workspace.subcategory) };
        }
        if (!input.categoryKey) throw new CrmToolError("`correct` needs categoryKey (and subcategoryId, from crm_list_stages).");
        const record = await applyHumanClassification({
          recordId: input.recordId,
          categoryKey: input.categoryKey,
          subcategoryId: input.subcategoryId ?? null,
          expectedContextVersion: input.expectedContextVersion,
          classificationId: classification?.id,
          reason: input.reason ?? null,
          actorRef: caller.actorRef,
        });
        return {
          recordId: input.recordId,
          stage: { categoryKey: input.categoryKey, subcategoryId: input.subcategoryId ?? null },
          contextVersion: (record as { record?: { contextVersion?: number } }).record?.contextVersion ?? null,
          note: "A new reply draft for this stage is being written; read the record again in a few seconds.",
        };
      }),
  );

  tools["crm_move_stage"] = server.registerTool(
    "crm_move_stage",
    {
      title: "Move to another stage",
      description: [
        "Move a record to another stage because something happened outside the thread (a meeting took place, a trial started, they signed). The AI's reading of the last reply stays as it was.",
        "`next`: `follow_up` (usual) treats the new stage's immediate reply as handled and schedules its follow-ups; `reply` drafts that stage's reply now.",
      ].join("\n"),
      inputSchema: z.object({
        recordId: uuid("recordId"),
        expectedContextVersion: z.number().int().min(0).describe("contextVersion from crm_get_record."),
        categoryKey: z.enum(CATEGORY_KEYS),
        subcategoryId: uuid("subcategoryId").nullable().describe("Sub-stage id from crm_list_stages, or null."),
        next: z.enum(["follow_up", "reply"]).default("follow_up"),
        note: z.string().trim().max(2000).optional().describe("What happened, for the timeline and for future drafts."),
        occurredAt: z.string().datetime({ offset: true }).optional().describe("When it happened (ISO 8601); defaults to now."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async (caller) => {
        await moveRecordStage({
          recordId: input.recordId,
          categoryKey: input.categoryKey,
          subcategoryId: input.subcategoryId,
          expectedContextVersion: input.expectedContextVersion,
          next: input.next,
          note: input.note ?? null,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
          actorRef: caller.actorRef,
        });
        const [record] = await db.select({ contextVersion: crmRecords.contextVersion, workflowState: crmRecords.workflowState, nextActionAt: crmRecords.nextActionAt })
          .from(crmRecords).where(and(inOrg(crmRecords), eq(crmRecords.id, input.recordId))).limit(1);
        return {
          recordId: input.recordId,
          moved: true,
          contextVersion: record?.contextVersion ?? null,
          workflowState: record?.workflowState ?? null,
          nextActionAt: iso(record?.nextActionAt),
        };
      }),
  );

  tools["crm_snooze"] = server.registerTool(
    "crm_snooze",
    {
      title: "Snooze follow-up",
      description:
        "Push the record's next sequence step to a later time (the app's \"Snooze\"). Only for records with an active sequence. Give `until` (ISO 8601) or `days`.",
      inputSchema: z.object({
        recordId: uuid("recordId"),
        until: z.string().datetime({ offset: true }).optional(),
        days: z.number().min(0.01).max(365).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async (caller) => {
        const until = input.until ? new Date(input.until) : input.days ? new Date(Date.now() + input.days * 86_400_000) : null;
        if (!until) throw new CrmToolError("Give `until` or `days`.");
        if (until.getTime() <= Date.now()) throw new CrmToolError("`until` must be in the future.");
        await snoozeSequence({ recordId: input.recordId, until, actorRef: caller.actorRef });
        return { recordId: input.recordId, snoozedUntil: until.toISOString() };
      }),
  );

  tools["crm_close_record"] = server.registerTool(
    "crm_close_record",
    {
      title: "Close or reopen record",
      description:
        "`close` takes a record off the queue and stops its sequence (e.g. not a fit, duplicate, handled elsewhere) — it reopens by itself if they write again. `reopen` puts a closed record back. To stop ALL contact with the person on every channel, use crm_set_do_not_contact.",
      inputSchema: z.object({
        recordId: uuid("recordId"),
        action: z.enum(["close", "reopen"]),
        reason: z.string().trim().max(2000).optional().describe("Why, for `close`."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async (caller) => {
        const record =
          input.action === "close"
            ? await closeCrmRecord({ recordId: input.recordId, reason: input.reason || "Closed via AI assistant", actorRef: caller.actorRef })
            : await reopenCrmRecord({ recordId: input.recordId, actorRef: caller.actorRef });
        return { recordId: input.recordId, workflowState: (record as { workflowState?: string }).workflowState ?? null };
      }),
  );

  tools["crm_set_do_not_contact"] = server.registerTool(
    "crm_set_do_not_contact",
    {
      title: "Do Not Contact",
      description:
        "Mark a person Do Not Contact (they asked to stop, or must not be messaged): every campaign, sequence and draft on every channel stops, and nothing can be sent to them until it is cleared. `enabled: false` clears it. Use the person id from crm_get_record.",
      inputSchema: z.object({
        personId: uuid("personId"),
        enabled: z.boolean(),
        reason: z.string().trim().min(1).max(2000).default("Set via AI assistant"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (input, ctx) =>
      run(ctx, "crm:write", async (caller) => {
        const actor = { personId: input.personId, reason: input.reason, source: "human" as const, actorType: "authenticated_operator" as const, actorRef: caller.actorRef };
        const policy = input.enabled ? await setPersonDoNotContact(actor) : await clearPersonDoNotContact(actor);
        return { personId: input.personId, doNotContact: policy.doNotContact };
      }),
  );
  return tools;
}
