import "server-only";

import {
  MAX_AGENT_BRIEF_CHARS,
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
const LIVE_VOICE = "Kore";
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
  return { brief, lead: parseLead(body.lead) };
}

function parseLead(value: unknown): RecorderLead | null {
  if (!value || typeof value !== "object") return null;
  const lead = value as Record<string, unknown>;
  const text = (key: string) => (typeof lead[key] === "string" ? (lead[key] as string).slice(0, 200) : null);
  return { name: text("name"), detail: text("detail"), firstName: text("firstName"), company: text("company") };
}

export async function mintAgentToken(row: CallSessionRow, request: AgentTokenRequest): Promise<AgentTokenResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new CallApiError(409, "The AI voice agent is not set up on this server (GEMINI_API_KEY is missing)");
  if (row.status !== "pending" && row.status !== "in_progress") {
    throw new CallApiError(409, "This call is already over");
  }

  const now = Date.now();
  const response = await fetch(`${API_BASE}/v1alpha/auth_tokens`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
      newSessionExpireTime: new Date(now + NEW_SESSION_WINDOW_MS).toISOString(),
      bidiGenerateContentSetup: liveSetup(request),
    }),
  });
  const body = (await response.json().catch(() => null)) as { name?: string; error?: { message?: string } } | null;
  if (!response.ok || !body?.name) {
    // Not 502: Cloudflare, in front of app.agentsdr.ai, replaces a 502's body
    // with its own "Bad gateway" page, so the extension saw only the status
    // and never Gemini's reason (23 Oct 2026).
    throw new CallApiError(424, `Gemini refused the agent session: ${body?.error?.message ?? `HTTP ${response.status}`}`);
  }
  return { token: body.name, model: `models/${LIVE_MODEL}`, websocketUrl: WEBSOCKET_URL };
}

/** The Live session, in the API's own JSON shape (BidiGenerateContentSetup). */
function liveSetup(request: AgentTokenRequest) {
  return {
    model: `models/${LIVE_MODEL}`,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: LIVE_VOICE } } },
    },
    systemInstruction: { parts: [{ text: agentInstructions(request) }] },
    tools: [
      {
        functionDeclarations: [
          {
            name: "end_call",
            description:
              "Hang up the call. Only after you have said goodbye, and only when the person said goodbye or asked to end the call, the call reached its goal, or they clearly said no twice. Never because of a question, a complaint or a request — answer those instead.",
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

function agentInstructions({ brief, lead }: AgentTokenRequest): string {
  const who = [lead?.name, lead?.detail].filter(Boolean).join(", ");
  return [
    "You are on a live WhatsApp voice call, speaking with a real person. Everything you say is spoken aloud to them.",
    who ? `You are calling ${who}.` : "",
    "Your brief from the sales rep who set up this call:",
    "<brief>",
    brief,
    "</brief>",
    "You are a woman (your voice is female). In Hindi, always use feminine forms for yourself: \"मैं कर रही हूँ\", \"मैं समझ सकती हूँ\", never \"रहा\" or \"सकता\".",
    "How to talk:",
    "- This is a phone call: keep each turn short (one or two sentences), natural and warm. Never use lists, markdown or emojis.",
    "- Speak first when the call connects: greet them by first name if you know it, say who you are and why you are calling, in one breath.",
    "- Speak the language the person speaks — English, Hindi or Hinglish — and switch if they do.",
    "- Listen more than you talk. If they interrupt, stop and respond to what they said.",
    "- If you did not catch something, ask them to repeat it. Never invent facts that are not in the brief; offer to have the team follow up instead.",
    "- Never hang up because of a question or a request, even an odd one (\"can you sound more natural?\"): answer it and carry on.",
    "- When the call has done its job, or they clearly want to go, say a short goodbye and then call end_call.",
  ]
    .filter(Boolean)
    .join("\n");
}
