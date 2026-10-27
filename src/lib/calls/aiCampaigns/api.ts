/**
 * AI calling campaigns: the request and response shapes of
 * /api/calling/ai-campaigns, plus the pure checks the pages and the server
 * share (settings validation, launch blockers). Client-safe: only types and
 * constants from the contracts.
 */

import type { WeeklyHours } from "@/lib/channels/rules";
import type { AgentOutcomeKind, CallCampaignStatus, CallStatus } from "../contract";
import type { StationStatus } from "../stationContract";
import {
  AI_CAMPAIGN_MAX_CALLBACKS,
  AI_CAMPAIGN_GOALS,
  aiCampaignStepsError,
  type AiCallResult,
  type AiCampaignGoal,
  type AiCampaignSettings,
  type AiCampaignStep,
  type AiContactStatus,
  type AiStepRunKind,
  type AiStepRunStatus,
} from "./contract";

export const AI_CAMPAIGN_MAX_INSTRUCTIONS = 4_000;
export const AI_CAMPAIGN_MAX_BOOKING_MESSAGE = 1_000;

/** Where a campaign is in its life: a draft places nothing until it is launched. */
export type AiCampaignState = "draft" | "active" | "paused";

export type AiCampaignNumber = {
  id: string;
  name: string;
  phone: string;
  status: StationStatus;
  /** The call worker keeping its WhatsApp Web open (calls start right away). */
  openOn: string | null;
  /** The number's own AI calls-a-day limit; null = the organization's rule. */
  callsPerDay: number | null;
  /** AI campaign calls placed from it today (all campaigns). */
  callsToday: number;
};

export type AiCampaignSummary = {
  id: string;
  name: string;
  description: string | null;
  status: CallCampaignStatus;
  state: AiCampaignState;
  launchedAt: string | null;
  goal: AiCampaignGoal;
  createdAt: string;
  numbers: AiCampaignNumber[];
  leads: number;
  /** This campaign's calls placed today. */
  callsToday: number;
  booked: number;
  stepCount: number;
};

export type AiCampaignDetail = AiCampaignSummary &
  AiCampaignSettings & {
    steps: AiCampaignStep[];
    chaseSteps: AiCampaignStep[];
    /** Why it cannot launch yet (drafts only), or null. */
    blocker: string | null;
    /** The most calls its numbers may place a day (their own limits or the organization's rule), before warm-up. */
    callsPerDayLimit: number;
  };

export type ListAiCampaignsResponse = { campaigns: AiCampaignSummary[] };

export type CreateAiCampaignRequest = { name: string; description?: string | null };

export type UpdateAiCampaignRequest = {
  name?: string;
  description?: string | null;
  /** Pause or resume a launched campaign. */
  status?: CallCampaignStatus;
  goal?: AiCampaignGoal;
  instructions?: string;
  agentName?: string | null;
  agentVoice?: string | null;
  bookingUrl?: string | null;
  bookingMessage?: string;
  maxCallbacks?: number;
  steps?: AiCampaignStep[];
  chaseSteps?: AiCampaignStep[];
};

export type SetAiCampaignStationsRequest = { stationIds: string[] };

export type AiLeadsQuery = { status?: AiContactStatus; q?: string; page?: number; pageSize?: number };

export type AiCampaignLead = {
  id: string;
  personId: string;
  name: string | null;
  title: string | null;
  companyName: string | null;
  phone: string;
  status: AiContactStatus;
  note: string | null;
  /** "Call 2 of 4", "Message 1 of 2 (follow-up)": the step it is on, or null once it is done. */
  currentStep: string | null;
  nextAt: string | null;
  lastOutcome: { outcome: AgentOutcomeKind; summary: string | null; at: string } | null;
  calls: number;
  numberName: string | null;
};

export type ListAiLeadsResponse = { leads: AiCampaignLead[]; total: number; page: number; pageSize: number };

export type AiLeadAction = "stop" | "requeue";
export type UpdateAiLeadRequest = { action: AiLeadAction };

export type AddAiCampaignPeopleResponse = { requested: number; added: number; skippedDuplicate: number; skippedMissingPhone: number };
export type AiLeadsImportResponse = { added: number; alreadyInCampaign: number; skipped: string[] };

/** One thing the engine did for a lead, in time order. */
export type AiLeadTimelineEntry = {
  id: string;
  at: string;
  kind: AiStepRunKind;
  /** "Reach · step 1", "Follow-up · step 2", "Call back", "Booking link" ... */
  stepLabel: string;
  status: AiStepRunStatus;
  result: AiCallResult | null;
  error: string | null;
  /** A message: what was sent. */
  body: string | null;
  call: {
    id: string;
    status: CallStatus;
    durationMs: number | null;
    hasRecording: boolean;
    recordingOffsetMs: number | null;
    transcriptStatus: string;
    outcome: { outcome: AgentOutcomeKind; summary: string | null; when: string | null } | null;
  } | null;
};

export type AiLeadDetail = { lead: AiCampaignLead; timeline: AiLeadTimelineEntry[] };

export type AiStepStat = {
  key: string;
  phase: "reach" | "chase" | "system";
  stepId: string | null;
  kind: AiStepRunKind;
  label: string;
  /** Runs started (including failed ones). */
  attempted: number;
  done: number;
  failed: number;
  /** Calls that ended in a real conversation. */
  conversations: number;
};

export type AiCampaignStats = {
  total: number;
  byStatus: Record<AiContactStatus, number>;
  callsPlaced: number;
  callsAnswered: number;
  conversations: number;
  outcomes: Partial<Record<AgentOutcomeKind, number>>;
  /** Leads with a call that ended interested, meeting agreed or wanting the team to call. */
  interested: number;
  messagesSent: number;
  booked: number;
  handoffs: number;
  callsToday: number;
  callsPerDayLimit: number;
  perStep: AiStepStat[];
  callsByDay: Array<{ date: string; placed: number; answered: number }>;
};

export type AiLaunchCheck = {
  numbers: number;
  steps: AiCampaignStep[];
  instructions: string;
  goal: AiCampaignGoal;
  bookingUrl: string | null;
  leads: number;
};

/** Why a campaign cannot launch yet, or null. The API runs the same check. */
export function aiLaunchBlocker(input: AiLaunchCheck): string | null {
  if (input.numbers === 0) return "Choose at least one calling number";
  if (!input.steps.some((step) => step.kind === "call")) return "Add at least one call to the sequence";
  if (!input.instructions.trim()) return "Write the campaign instructions (what every call is about)";
  if (input.goal !== "human_callback" && !input.bookingUrl) return "Add the booking link, or set the goal to hand over to the team";
  if (input.leads === 0) return "Add at least one lead";
  return null;
}

/** An https URL as people paste it ("https://cal.com/acme/30min"), or null when it is not one. */
export function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Problems with the campaign's settings (null = fine); for the form and the API. */
export function aiSettingsError(
  settings: Pick<AiCampaignSettings, "goal" | "instructions" | "bookingUrl" | "bookingMessage" | "maxCallbacks">,
): string | null {
  if (!(AI_CAMPAIGN_GOALS as readonly string[]).includes(settings.goal)) return "Choose what the calls are for";
  if (settings.instructions.length > AI_CAMPAIGN_MAX_INSTRUCTIONS) return `Instructions must be at most ${AI_CAMPAIGN_MAX_INSTRUCTIONS} characters`;
  if (settings.bookingUrl && !httpsUrl(settings.bookingUrl)) return "The booking link must be an https:// address";
  if (settings.bookingMessage.length > AI_CAMPAIGN_MAX_BOOKING_MESSAGE) return `The booking message must be at most ${AI_CAMPAIGN_MAX_BOOKING_MESSAGE} characters`;
  if (settings.bookingUrl && !settings.bookingMessage.includes("{{bookingLink}}")) return "The booking message must include {{bookingLink}}";
  if (!Number.isInteger(settings.maxCallbacks) || settings.maxCallbacks < 0 || settings.maxCallbacks > AI_CAMPAIGN_MAX_CALLBACKS) {
    return `Call-backs must be between 0 and ${AI_CAMPAIGN_MAX_CALLBACKS}`;
  }
  return null;
}

/** Both sequences, for the editor's save button and the API. The chase may be empty. */
export function aiSequencesError(steps: unknown, chaseSteps: unknown): string | null {
  const reach = aiCampaignStepsError(steps);
  if (reach) return `Reach them: ${reach}`;
  const chase = aiCampaignStepsError(chaseSteps, { allowEmpty: true });
  if (chase) return `If they said yes but haven't booked: ${chase}`;
  return null;
}

/** draft until launched, then the stored status. */
export function aiCampaignState(row: { launchedAt: string | Date | null; status: CallCampaignStatus }): AiCampaignState {
  if (!row.launchedAt) return "draft";
  return row.status === "paused" ? "paused" : "active";
}

export const AI_CAMPAIGN_STATE_LABELS: Record<AiCampaignState, string> = { draft: "Draft", active: "Active", paused: "Paused" };

/** "Call 2 of 4" for the step at `index` of `steps`. */
export function aiStepLabel(steps: AiCampaignStep[], index: number, chase: boolean): string | null {
  const step = steps[index];
  if (!step) return null;
  const kindIndex = steps.slice(0, index + 1).filter((candidate) => candidate.kind === step.kind).length;
  const kindTotal = steps.filter((candidate) => candidate.kind === step.kind).length;
  return `${step.kind === "call" ? "Call" : "Message"} ${kindIndex} of ${kindTotal}${chase ? " (chasing the booking)" : ""}`;
}

/** The step key the engine stores for a step run, and what it means. */
export function describeStepKey(stepKey: string): { phase: "reach" | "chase" | "system"; stepId: string | null; label: string } {
  // "@<id>": a run from before the lead was queued again (requeue retires its key).
  const current = stepKey.replace(/@[0-9a-f]{8}$/, "");
  const retry = /^retry:(.+):\d+$/.exec(current);
  const key = retry ? retry[1]! : current;
  if (key.startsWith("reach:")) return { phase: "reach", stepId: key.slice(6), label: "Reach them" };
  if (key.startsWith("chase:")) return { phase: "chase", stepId: key.slice(6), label: "Chasing the booking" };
  if (key.startsWith("callback:")) return { phase: "system", stepId: null, label: `Call back ${key.slice(9)}` };
  if (key === "booking-link") return { phase: "system", stepId: null, label: "Booking link" };
  return { phase: "system", stepId: null, label: key };
}

/** A starting point for a message's merge fields preview. */
export const AI_MESSAGE_FIELDS = [
  { token: "firstName", label: "First name", sample: "Priya" },
  { token: "company", label: "Company", sample: "Acme" },
  { token: "agentName", label: "Agent name", sample: "Riya" },
  { token: "bookingLink", label: "Booking link", sample: "https://cal.com/acme/30min" },
] as const;

/** A message with sample values in place of its merge fields; unknown tokens stay as written. */
export function previewAiMessage(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, token: string) => values[token] ?? match);
}

export const AI_EMPTY_STATUS_COUNTS: Record<AiContactStatus, number> = {
  queued: 0,
  reaching: 0,
  callback: 0,
  chasing: 0,
  booked: 0,
  handoff: 0,
  not_interested: 0,
  unreached: 0,
  replied: 0,
  stopped: 0,
  failed: 0,
};

/** Today's AI-calls-a-day figure for a station list. */
export function callsPerDayLimit(numbers: Array<Pick<AiCampaignNumber, "callsPerDay">>, ruleDefault: number): number {
  return numbers.reduce((sum, number) => sum + (number.callsPerDay ?? ruleDefault), 0);
}

// --- per-number AI calling settings (Settings → WhatsApp → Calling numbers) ---

/** A calling number's own AI calls-a-day and calling hours; null = the organization's rule. */
export type StationAiSettings = {
  stationId: string;
  callsPerDay: number | null;
  callingHours: WeeklyHours | null;
};

export type StationAiSettingsResponse = {
  settings: StationAiSettings[];
  /** The organization's Sending rules these fall back to. */
  rules: { callsPerDay: number; callingHours: WeeklyHours };
};

export type UpdateStationAiSettingsRequest = {
  callsPerDay?: number | null;
  callingHours?: WeeklyHours | null;
};
