import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmKnowledgeDocuments, crmKnowledgeDocumentVersions } from "@/lib/crm/schema";
import { inOrg } from "@/lib/tenancy/scope";
import { goalGuidance, loadAgentContext, type AgentPromptContext } from "./agentContext";
import {
  AGENT_OUTCOMES,
  AGENT_VOICES,
  DEFAULT_AGENT_NAME,
  DEFAULT_AGENT_VOICE,
  MAX_AGENT_BRIEF_CHARS,
  MAX_AGENT_NAME_CHARS,
  type AgentOutcome,
  type AgentTokenRequest,
  type AgentTokenResponse,
  type RecorderLead,
} from "./contract";
import type { callSessions } from "./schema";
import { CallApiError } from "./sessions";

type CallSessionRow = typeof callSessions.$inferSelect;

/**
 * The AI voice agent (trial): a WhatsApp call placed from AgentSDR where
 * Gemini Live, not the rep, talks to the lead. The extension streams the
 * lead's audio to the model and plays the model's voice into the call as the
 * microphone (see extensions/whatsapp-recorder/src/live-agent.ts).
 *
 * The browser never sees the API key: this mints a single-use ephemeral token
 * with the whole session — model, voice, instructions, tools — locked into
 * it, so the extension's own setup message cannot change any of it.
 *
 * TRIAL EXCEPTION to two standing rules, on the owner's instruction (11 Oct
 * 2026): the key is read from GEMINI_API_KEY rather than a per-organization
 * integration, and the model is called directly rather than through the
 * OpenRouter BYOK runtime (OpenRouter has no realtime audio API). Move the
 * key into an organization integration before this leaves the trial.
 */

const LIVE_MODEL = "gemini-3.8-live";
const API_BASE = "https://generativelanguage.googleapis.com";
/** Ephemeral tokens are v1alpha-only for the Live socket (constrained endpoint). */
const WEBSOCKET_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
/** The socket is opened when the call starts ringing, so a minute is plenty. */
const NEW_SESSION_WINDOW_MS = 2 * 60_000;
const TOKEN_LIFETIME_MS = 30 * 60_000;

export function parseAgentTokenRequest(value: unknown): AgentTokenRequest {
  if (!value || typeof value !== "object") throw new CallApiError(400, "Expected a JSON object");
  const body = value as Record<string, unknown>;
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) throw new CallApiError(400, "The agent needs a brief");
  if (brief.length > MAX_AGENT_BRIEF_CHARS) throw new CallApiError(400, `The brief is over ${MAX_AGENT_BRIEF_CHARS} characters`);
  return { brief, lead: parseLead(body.lead), name: parseAgentName(body.name), voice: parseAgentVoice(body.voice) };
}

/** The agent's name, or null for the default. */
export function parseAgentName(value: unknown): string | null {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) return null;
  if (name.length > MAX_AGENT_NAME_CHARS) throw new CallApiError(400, `The agent's name is over ${MAX_AGENT_NAME_CHARS} characters`);
  return name;
}

/** One of AGENT_VOICES, or null for the default. */
export function parseAgentVoice(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !AGENT_VOICES.some((voice) => voice.id === value)) {
    throw new CallApiError(400, "Unknown voice for the agent");
  }
  return value;
}

/** The body of POST …/outcome: what the agent's record_outcome tool was called with. */
export function parseAgentOutcome(value: unknown): AgentOutcome {
  if (!value || typeof value !== "object") throw new CallApiError(400, "Expected a JSON object");
  const body = value as Record<string, unknown>;
  const outcome = AGENT_OUTCOMES.find((kind) => kind === body.outcome);
  if (!outcome) throw new CallApiError(400, "Unknown outcome");
  const text = (key: string, max: number) => {
    const raw = typeof body[key] === "string" ? (body[key] as string).trim() : "";
    return raw ? raw.slice(0, max) : null;
  };
  return { outcome, summary: text("summary", 500), when: text("when", 120), whenAt: parseWhenAt(body.whenAt), recordedAt: new Date().toISOString() };
}

const WHEN_AT_PAST_MS = 60 * 60_000;
const WHEN_AT_FUTURE_MS = 60 * 24 * 60 * 60_000;

/** The agreed instant, kept only if it is an ISO 8601 time between an hour ago and 60 days ahead; a model's arithmetic slips. */
export function parseWhenAt(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return null;
  const at = Date.parse(text);
  if (Number.isNaN(at) || at < now - WHEN_AT_PAST_MS || at > now + WHEN_AT_FUTURE_MS) return null;
  return text;
}

function parseLead(value: unknown): RecorderLead | null {
  if (!value || typeof value !== "object") return null;
  const lead = value as Record<string, unknown>;
  const text = (key: string) => (typeof lead[key] === "string" ? (lead[key] as string).slice(0, 200) : null);
  return { name: text("name"), detail: text("detail"), firstName: text("firstName"), company: text("company") };
}

/** Runs in the call's organization (withRecorderScope): the knowledge is that organization's. */
export async function mintAgentToken(row: CallSessionRow, request: AgentTokenRequest): Promise<AgentTokenResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new CallApiError(409, "The AI voice agent is not set up on this server (GEMINI_API_KEY is missing)");
  if (row.status !== "pending" && row.status !== "in_progress") {
    throw new CallApiError(409, "This call is already over");
  }
  const [knowledge, context] = await Promise.all([agentKnowledge(), loadAgentContext(row)]);

  const now = Date.now();
  const response = await fetch(`${API_BASE}/v1alpha/auth_tokens`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
      newSessionExpireTime: new Date(now + NEW_SESSION_WINDOW_MS).toISOString(),
      bidiGenerateContentSetup: liveSetup(request, knowledge, context),
    }),
  });
  const body = (await response.json().catch(() => null)) as { name?: string; error?: { message?: string } } | null;
  if (!response.ok || !body?.name) {
    // Not 502: Cloudflare, in front of app.agentsdr.ai, replaces a 502's body
    // with its own "Bad gateway" page, so the extension saw only the status
    // and never Gemini's reason (23 Oct 2026).
    throw new CallApiError(424, `Gemini refused the agent session: ${body?.error?.message ?? `HTTP ${response.status}`}`);
  }
  return { token: body.name, model: `models/${LIVE_MODEL}`, websocketUrl: WEBSOCKET_URL, saveHeardAudio: saveHeardAudio() };
}

/** The Live session, in the API's own JSON shape (BidiGenerateContentSetup). */
export function liveSetup(request: AgentTokenRequest, knowledge: KnowledgeDocument[], context: AgentPromptContext = {}) {
  return {
    model: `models/${LIVE_MODEL}`,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: request.voice ?? DEFAULT_AGENT_VOICE } } },
    },
    // Background noise on the lead's line counted as them talking: the agent
    // held its greeting for 8.5 s after the pick-up, until the noise paused
    // (23 Oct 2026). Low start-of-speech sensitivity needs clearer speech
    // before it yields; everything else stays at Gemini's defaults.
    realtimeInputConfig: { automaticActivityDetection: { startOfSpeechSensitivity: "START_SENSITIVITY_LOW" } },
    systemInstruction: { parts: [{ text: agentInstructions(request, knowledge, context) }] },
    tools: [
      {
        functionDeclarations: [
          {
            name: "record_outcome",
            description:
              "Record how the call went, once, before your goodbye. Call it again only if the outcome changes (they agree to a meeting after all).",
            parameters: {
              type: "OBJECT",
              properties: {
                outcome: {
                  type: "STRING",
                  enum: [...AGENT_OUTCOMES],
                  description:
                    "meeting_booked: they agreed to book a meeting with the team or to receive the booking link. interested: they want to hear more, nothing agreed. human_callback: they want a person from the team to call them. call_back: a bad moment, call them again later. not_interested. wrong_person: not who you were calling. do_not_contact: they asked never to be contacted again. no_response: they never really answered. other.",
                },
                summary: { type: "STRING", description: "One sentence on what happened and anything they asked for." },
                when: {
                  type: "STRING",
                  description: "For meeting_booked, human_callback or call_back: the day and time as agreed, in their words (\"Thursday around 4 pm\").",
                },
                whenAt: {
                  type: "STRING",
                  description:
                    "The exact instant of an agreed meeting or call-back time, ISO 8601 with UTC offset (2026-10-29T16:00:00+05:30), worked out from the current date and time in your instructions. Omit if no time was agreed.",
                },
              },
              required: ["outcome", "summary"],
            },
          },
          {
            name: "end_call",
            description:
              "Hang up the call. Only after you have said goodbye, and only when the person said goodbye or asked to end the call, the call reached its goal, they clearly said no, or a call note tells you to. Never because of a question, a complaint or a request — answer those instead.",
            parameters: {
              type: "OBJECT",
              properties: { reason: { type: "STRING", description: "Why the call is ending, in a few words." } },
            },
          },
        ],
      },
    ],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
}

/**
 * The agent's instructions. Written against the first 38 agent calls (11–27
 * Oct 2026): with a one-line pitch as the brief and "say who you are and why
 * you are calling, in one breath", every call opened with the same pitch and
 * repeated it each turn, the agent invented a new name per call, dodged "are
 * you an AI?", talked over the lead's "Hello?", promised bookings it could
 * not make, and asked people to "repeat that in English". The shape below is
 * a person's cold call: a short hello and permission, a question about them,
 * one relevant point, a next step.
 */
export function agentInstructions(
  { brief, lead, name, voice }: AgentTokenRequest,
  knowledge: KnowledgeDocument[],
  context: AgentPromptContext = {},
): string {
  const agentName = name ?? DEFAULT_AGENT_NAME;
  const female = (AGENT_VOICES.find((option) => option.id === voice)?.gender ?? "female") === "female";
  const firstName = lead?.firstName?.trim() || null;
  const who = [lead?.name, lead?.company ?? null, lead?.detail].filter(Boolean).join(", ");
  return [
    `You are ${agentName}, on a live WhatsApp voice call with a real person. Everything you say is spoken aloud to them.`,
    who ? `You are calling ${who}.` : "You do not know the person's name: ask it naturally if it matters.",
    ...(context.now ? [`It is now ${context.now}.`] : []),
    "",
    "What this call is for, from the sales rep who set it up:",
    "<brief>",
    brief,
    "</brief>",
    ...(knowledge.length
      ? [
          "",
          "What you know about the company you are calling for. It is reference, not a script: use it to answer questions and to pick the one point that fits this person. Never read it out, never list features, and never quote a number unless it answers what they asked.",
          "<knowledge>",
          ...knowledge.map((document) => `## ${document.title}\n${document.content}`),
          "</knowledge>",
          "Where the knowledge names a contact person or tells you how to sign off, that is the team you are calling for; you are still " + agentName + ".",
        ]
      : []),
    ...(context.history ? ["", context.history] : []),
    "",
    "Who you are:",
    `- Your name is ${agentName}. Always introduce yourself as ${agentName}; never use any other name.`,
    female
      ? "- You are a woman. In Hindi always use feminine forms for yourself: \"मैं कर रही हूँ\", \"मैं समझ सकती हूँ\", never \"रहा\" or \"सकता\"."
      : "- You are a man. In Hindi always use masculine forms for yourself: \"मैं कर रहा हूँ\", \"मैं समझ सकता हूँ\".",
    "- Keep the same calm, warm, unhurried voice for the whole call.",
    "- If they ask whether you are an AI, a bot or a recording, say honestly in one short sentence that you are an AI assistant calling for the team, then offer to carry on or to have a person from the team call them. Never claim to be human.",
    "",
    "How the call goes:",
    `1. Opening: a short hello${firstName ? ` with their first name (${firstName})` : ""}, your name and the company you are calling for (as your brief or knowledge names it — never the person's own company), and ask whether it is an okay moment — one sentence, for example "Hi ${firstName ?? "there"}, this is ${agentName} from <your company> — did I catch you at an okay time?". No pitch yet. Then stop and let them answer.`,
    "2. If it is a bad moment, ask when would suit them, then record it (with that time) and wrap up kindly: someone from the team will call them then.",
    "3. Before pitching, ask one short, open question about their situation that relates to the brief, and listen. React to what they actually said before you move on.",
    "4. Connect one point to what they told you, in your own words. One idea per turn.",
    "5. If they are interested, agree the next step the brief asks for. If they are not, thank them and let them go — do not push.",
    "- Suggest the next step at most once until they show interest. Do not end every answer with \"would you be interested in a call?\".",
    "",
    "How to talk:",
    "- Sound like a person on the phone, not a script: one or two short sentences per turn, plain words, contractions, and now and then a natural \"got it\", \"right\", \"achha\" or \"haan\". Never lists, markdown or emojis.",
    "- Always respond to what they just said first. Small talk gets a real answer (\"I'm good, thanks — how about you?\").",
    "- Ask one question at a time, then stop talking and wait.",
    "- Never repeat a sentence you have already said, and never repeat your pitch. If they ask again, say it differently and shorter.",
    "- If they say \"Hello?\" or \"Can you hear me?\", say yes briefly and carry on from where you were. Do not restart your introduction.",
    "- If they ask something your notes do not answer (an exact price, a specific integration), say you do not have that to hand and that the team will follow up with it. Never invent facts, numbers, customers or prices.",
    "- If they wander off topic, go along with it briefly and kindly, then steer back. Never argue.",
    "- Language: speak the language they speak — English, Hindi or Hinglish — and switch when they do. Only ever speak English or Hindi.",
    "- The line is a phone line in India and can be unclear. If you did not catch something, or it sounded like another language, that is the line: say so like a person would (\"Sorry, the line broke up — could you say that again?\"). Never ask them to speak a particular language.",
    "",
    ...(context.goal
      ? goalGuidance(context.goal.goal)
      : [
          "Booking a next step:",
          "- You cannot see a calendar or send invitations. When they agree to talk further, ask which day and roughly what time suits them, and tell them the team will confirm it on WhatsApp.",
        ]),
    "",
    "Ending:",
    "- Before your goodbye, call record_outcome once with how the call went. It is silent bookkeeping: right after it, keep talking — confirm out loud what you agreed (\"Great, Thursday around 4 then — the team will confirm on WhatsApp.\").",
    "- When the call has done its job, or they clearly want to go, say a short goodbye out loud, then call end_call.",
    "- Never hang up because of a question, a complaint or an odd request (\"can you sound more natural?\"): answer it and carry on.",
    "",
    "Text in square brackets that starts with \"[Call note:\" comes from the calling system, not from the person. Follow it and never mention it.",
  ].join("\n");
}

export type KnowledgeDocument = { title: string; content: string };

/** Each knowledge document is cut to this; the agent needs the gist, and a long prompt slows every turn a little. */
const KNOWLEDGE_DOCUMENT_CHARS = 5_000;
const KNOWLEDGE_TOTAL_CHARS = 12_000;
/** Most useful first, so the budget cuts case studies before the product. */
const KNOWLEDGE_ORDER = ["company", "product", "pricing", "faq", "objection", "scheduling", "custom", "case_study"];

/**
 * The organization's CRM Knowledge marked "always include" — the same set
 * that grounds the call-transcript classification (leadStage.ts) — so the
 * agent can answer questions instead of deferring every one to "the team".
 */
export async function agentKnowledge(): Promise<KnowledgeDocument[]> {
  const rows = await db
    .select({ title: crmKnowledgeDocuments.title, kind: crmKnowledgeDocuments.kind, content: crmKnowledgeDocumentVersions.content })
    .from(crmKnowledgeDocuments)
    .innerJoin(
      crmKnowledgeDocumentVersions,
      and(
        eq(crmKnowledgeDocumentVersions.documentId, crmKnowledgeDocuments.id),
        eq(crmKnowledgeDocumentVersions.version, crmKnowledgeDocuments.latestVersion),
      ),
    )
    .where(and(inOrg(crmKnowledgeDocuments), eq(crmKnowledgeDocuments.active, true), eq(crmKnowledgeDocuments.alwaysInclude, true)))
    .orderBy(asc(crmKnowledgeDocuments.title));
  return budgetKnowledge(rows);
}

export function budgetKnowledge(rows: { title: string; kind: string; content: string }[]): KnowledgeDocument[] {
  const rank = (kind: string) => {
    const index = KNOWLEDGE_ORDER.indexOf(kind);
    return index === -1 ? KNOWLEDGE_ORDER.length : index;
  };
  let left = KNOWLEDGE_TOTAL_CHARS;
  const chosen: KnowledgeDocument[] = [];
  for (const row of [...rows].sort((a, b) => rank(a.kind) - rank(b.kind))) {
    const content = row.content.trim();
    if (!content || left <= 200) continue;
    const take = Math.min(content.length, KNOWLEDGE_DOCUMENT_CHARS, left);
    chosen.push({ title: row.title, content: take < content.length ? `${content.slice(0, take).trimEnd()} …` : content });
    left -= take;
  }
  return chosen;
}

/** Test option: the extension uploads the exact audio the model heard (see AgentTokenResponse). */
export function saveHeardAudio(): boolean {
  return process.env.AGENT_SAVE_HEARD_AUDIO?.trim() === "true";
}

// --- Rehearsal ----------------------------------------------------------------

export type RehearsalTurn = { role: "lead" | "agent"; text: string };
export type RehearsalResult = { reply: string; tools: { name: string; args: Record<string, unknown> }[] };

const REHEARSAL_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const REHEARSAL_TIMEOUT_MS = 25_000;
/** The same notes live-agent.ts (the extension) sends on a real call. */
const GREETING_NOTE = "[Call note: the call has just connected and the person is on the line. Open the call now.]";
const CARRY_ON_NOTE = "[Call note: noted. Carry on talking: confirm out loud what you agreed, or say goodbye if the call is over.]";

/**
 * One agent turn of a rehearsal: the real session setup (liveSetup, so the
 * prompt is exactly a call's) over a server-side Gemini Live socket, the typed
 * conversation sent as text, the agent's speech read back as its transcript.
 * Runs in the organization scope; the caller supplies the context.
 */
export async function rehearseAgent(
  request: AgentTokenRequest,
  knowledge: KnowledgeDocument[],
  context: AgentPromptContext,
  turns: RehearsalTurn[],
): Promise<RehearsalResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new CallApiError(409, "The AI voice agent is not set up on this server (GEMINI_API_KEY is missing)");
  const history = [
    { role: "user", parts: [{ text: GREETING_NOTE }] },
    ...turns.map((turn) => ({ role: turn.role === "lead" ? "user" : "model", parts: [{ text: turn.text }] })),
  ];

  return await new Promise<RehearsalResult>((resolve, reject) => {
    const socket = new WebSocket(`${REHEARSAL_URL}?key=${encodeURIComponent(apiKey)}`);
    socket.binaryType = "arraybuffer";
    let reply = "";
    const tools: RehearsalResult["tools"] = [];
    let nudged = false;
    let settled = false;
    const finish = (error: CallApiError | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      if (error) reject(error);
      else resolve({ reply: reply.trim(), tools });
    };
    const timer = setTimeout(() => finish(new CallApiError(504, "The agent did not answer in time")), REHEARSAL_TIMEOUT_MS);

    socket.addEventListener("open", () => socket.send(JSON.stringify({ setup: liveSetup(request, knowledge, context) })));
    socket.addEventListener("error", () => finish(new CallApiError(424, "Could not reach Gemini Live")));
    socket.addEventListener("close", (event) => finish(new CallApiError(424, `Gemini closed the session${event.reason ? `: ${event.reason}` : ""}`)));
    socket.addEventListener("message", (event) => {
      let message: {
        setupComplete?: unknown;
        serverContent?: { outputTranscription?: { text?: string }; turnComplete?: boolean };
        toolCall?: { functionCalls?: { id?: string; name: string; args?: Record<string, unknown> }[] };
      };
      try {
        const raw = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (message.setupComplete) {
        socket.send(JSON.stringify({ clientContent: { turns: history, turnComplete: true } }));
        return;
      }
      if (message.toolCall?.functionCalls?.length) {
        const calls = message.toolCall.functionCalls;
        for (const call of calls) tools.push({ name: call.name, args: call.args ?? {} });
        socket.send(JSON.stringify({ toolResponse: { functionResponses: calls.map((call) => ({ id: call.id, name: call.name, response: { ok: true } })) } }));
      }
      const content = message.serverContent;
      if (content?.outputTranscription?.text) reply += content.outputTranscription.text;
      if (content?.turnComplete) {
        // The live model goes silent after a tool call: ask it, once, to carry on.
        if (!reply.trim() && tools.length && !nudged) {
          nudged = true;
          socket.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text: CARRY_ON_NOTE }] }], turnComplete: true } }));
          return;
        }
        finish(null);
      }
    });
  });
}
