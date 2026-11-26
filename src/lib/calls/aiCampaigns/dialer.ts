/**
 * The rep dialer: a calling campaign worked by a person instead of the AI
 * agent (call_campaigns.ai_caller = 'rep'), on the AI campaign machinery —
 * the same sequence, leads, numbers and outcome rules. Client-safe and
 * import-free apart from types.
 *
 *   - The engine never places a rep campaign's calls. It still sends its
 *     WhatsApp steps and settles its calls.
 *   - Calls go out only while a rep has pressed Start: the rep's page asks for
 *     the next lead (POST …/dialer/next). The server picks the most urgent due
 *     lead on a free number, claims its step and queues the call with
 *     `remoteRep`, so the rep talks from their tab through the station.
 *   - A lead keeps the number that first called it (ai_station_id). Numbers
 *     rotate across leads, not within one.
 *   - Steps wait exactly their delay, set to the minute (stepDelay.ts): 0 is
 *     right away. Rep campaigns have no 10-minute minimum between steps. The
 *     dialer always calls the most urgent due lead, so a lead whose 5-minute
 *     redial has come due is called before new leads.
 *   - After a call that was picked up, the rep's wrap-up (outcome, notes) is
 *     stored as the call's agent_outcome, and engineRules.afterCall applies it
 *     exactly as it applies the agent's record_outcome.
 *   - A rep who hangs up before the lead answers pauses the dialer. A wrap-up
 *     ends with Next lead or Pause.
 */
import type { AgentOutcomeKind } from "../contract";
import type { AiCampaignStep, AiContactStatus } from "./contract";

/** Who talks on a campaign's calls: the AI agent, or a rep through the dialer. */
export const AI_CAMPAIGN_CALLERS = ["agent", "rep"] as const;
export type AiCampaignCaller = (typeof AI_CAMPAIGN_CALLERS)[number];
export const AI_CAMPAIGN_CALLER_LABELS: Record<AiCampaignCaller, { label: string; help: string }> = {
  agent: { label: "AI agent", help: "The AI agent places every call and talks to the lead." },
  rep: {
    label: "Rep (dialer)",
    help: "You press Start and the system calls your leads one after another. When someone picks up, you talk to them.",
  },
};

/**
 * A rep campaign's starting sequence, only a template the campaign edits:
 * call, redial 5 minutes later, "Hi", call the next day. Each step runs only
 * if they have not picked up for a real conversation. A wait of 0 is right
 * away. The dialer calls whichever lead's next call is due first, so it
 * returns to a lead once its redial's wait is up, between other leads.
 */
export const DEFAULT_REP_STEPS: AiCampaignStep[] = [
  { id: "call-1", kind: "call", delayHours: 0, instructions: "" },
  { id: "call-2", kind: "call", delayHours: 5 / 60, instructions: "Redial: they missed your call a few minutes ago." },
  { id: "message-1", kind: "message", delayHours: 0, body: "Hi {{firstName}}" },
  { id: "call-3", kind: "call", delayHours: 24, instructions: "Next day: they have your missed calls and the Hi." },
];

export const DEFAULT_REP_CHASE_STEPS: AiCampaignStep[] = [
  {
    id: "chase-message-1",
    kind: "message",
    delayHours: 24,
    body: "Hi {{firstName}}, just a reminder — here's the link to pick a time: {{bookingLink}}",
  },
  {
    id: "chase-call-1",
    kind: "call",
    delayHours: 48,
    instructions: "They agreed to a meeting but haven't booked. Check whether the link worked.",
  },
];

/**
 * What the rep marks after a call that was picked up. Each maps onto the
 * agent's outcome kinds, so the engine's rules (engineRules.afterCall) apply
 * unchanged.
 */
export const REP_CALL_OUTCOMES = [
  "meeting",
  "interested",
  "call_back",
  "not_interested",
  "wrong_person",
  "do_not_contact",
  "no_conversation",
] as const;
export type RepCallOutcome = (typeof REP_CALL_OUTCOMES)[number];

export const REP_CALL_OUTCOME_LABELS: Record<RepCallOutcome, { label: string; help: string }> = {
  meeting: { label: "Meeting agreed", help: "The booking link goes out on WhatsApp from this number, then reminders until they book." },
  interested: { label: "Interested — follow up", help: "Goes to Action required in the CRM (at the time you set, or now)." },
  call_back: { label: "Call back later", help: "Back in your dialer queue at the time you set." },
  not_interested: { label: "Not interested", help: "No more calls or messages from this campaign." },
  wrong_person: { label: "Wrong person / number", help: "No more calls or messages from this campaign." },
  do_not_contact: { label: "Do not contact", help: "Marks the person Do Not Contact on every channel." },
  no_conversation: { label: "No real conversation", help: "Picked up but no real talk (silence, cut at once). The sequence carries on as if unanswered." },
};

/** The agent outcome a rep's choice is stored as (call_sessions.agent_outcome.outcome). */
export const REP_OUTCOME_AS_AGENT: Record<RepCallOutcome, AgentOutcomeKind> = {
  meeting: "meeting_booked",
  interested: "human_callback",
  call_back: "call_back",
  not_interested: "not_interested",
  wrong_person: "wrong_person",
  do_not_contact: "do_not_contact",
  no_conversation: "no_response",
};

/** Outcomes that need a time from the rep (call_back) or may take one (interested). */
export function repOutcomeTakesTime(outcome: RepCallOutcome): "required" | "optional" | null {
  if (outcome === "call_back") return "required";
  if (outcome === "interested") return "optional";
  return null;
}

export const REP_NOTES_MAX_CHARS = 2_000;
export const REP_MESSAGE_MAX_CHARS = 1_000;

// --- API ------------------------------------------------------------------------------

/** The lead the dialer is calling, for the rep's card. */
export type DialerLead = {
  contactId: string;
  personId: string;
  name: string;
  company: string | null;
  title: string | null;
  phone: string;
  /** Where in the sequence ("Call 2 of 4", "Call back 1"). */
  stepLabel: string;
  /** The step's note for the rep (the call step's instructions), if any. */
  stepNote: string | null;
  /** Notes kept on the lead (call_campaign_contacts.notes). */
  notes: string | null;
  /** Their status before this call. */
  status: AiContactStatus;
  /** The lead's last note from the engine ("Call back: Thursday around 4"). */
  lastNote: string | null;
  /** Calls placed to this lead before this one. */
  previousCalls: number;
};

/** POST /api/calling/ai-campaigns/:id/dialer/next */
export type DialerNextRequest = {
  /** The lead just called: if its next call is due now (an instant redial), it goes first. */
  preferContactId?: string | null;
};

export type DialerNextResponse =
  | { kind: "calling"; callId: string; numberName: string; lead: DialerLead }
  /** Nothing can be placed this moment (the number is busy with a call or a message): ask again after retryInMs. */
  | { kind: "waiting"; message: string; retryInMs: number }
  /** Nothing to call now: the queue is empty, outside calling hours, or every number is at its limit. */
  | { kind: "idle"; message: string; nextDueAt: string | null };

/** POST /api/calling/ai-campaigns/:id/dialer/wrap-up — after a call the lead picked up. */
export type DialerWrapUpRequest = {
  callId: string;
  outcome: RepCallOutcome;
  /** ISO 8601: the call-back or follow-up time. */
  whenAt?: string | null;
  notes?: string | null;
};
export type DialerWrapUpResponse = { status: AiContactStatus; note: string | null };

/** POST /api/calling/ai-campaigns/:id/dialer/message — a WhatsApp from the lead's own number, outside the sequence. */
export type DialerMessageRequest = { contactId: string; body: string };
export type DialerMessageResponse = { whatsappMessageId: string };

export type DialerNumber = {
  id: string;
  name: string;
  /** A call worker holds its WhatsApp Web open. */
  open: boolean;
  callsToday: number;
  limit: number;
  withinHours: boolean;
};

/** GET /api/calling/ai-campaigns/:id/dialer — the dialer page's header. */
export type DialerOverview = {
  /** The campaign's instructions, shown to the rep as the call script. */
  script: string;
  numbers: DialerNumber[];
  /** Leads with a call due now. */
  dueNow: number;
  /** When the next call becomes due, if none is now. */
  nextDueAt: string | null;
  today: {
    /** Calls this campaign placed today (the organization's day). */
    dials: number;
    /** Of them, picked up. */
    pickedUp: number;
    /** Outcomes "Meeting agreed" today. */
    meetings: number;
  };
};
