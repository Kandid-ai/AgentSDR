/**
 * The rep dialer's state transitions, pure so they can be tested without a
 * browser (dialerController.ts runs the effects: the requests, the call, the timers).
 *
 *   stopped ──start──▶ dialing ──calling──▶ calling ──ended──▶ wrap-up ──Next lead──▶ dialing
 *                         │  ├──waiting──▶ waiting ──retry──▶ dialing        └─Pause──▶ stopped
 *                         │  └──idle─────▶ stopped (message, next due time)
 *                         └ calling ──hung up unanswered / error──▶ stopped
 *                           calling ──not answered──▶ countdown ──▶ dialing (same lead first)
 */
import {
  REP_CALL_OUTCOMES,
  REP_MESSAGE_MAX_CHARS,
  REP_NOTES_MAX_CHARS,
  repOutcomeTakesTime,
  type DialerLead,
  type DialerNextResponse,
  type DialerWrapUpRequest,
  type RepCallOutcome,
} from "@/lib/calls/aiCampaigns/dialer";

/** Seconds between an unanswered call and the next one. */
export const NEXT_CALL_COUNTDOWN_SECONDS = 3;

export type DialerPhase =
  | { name: "stopped"; notice: string | null; nextDueAt: string | null }
  /** Asking the server for the next lead. `prefer`: the lead just called, whose redial may be due at once. */
  | { name: "dialing"; prefer: string | null }
  | { name: "waiting"; message: string; retryInMs: number; prefer: string | null }
  /** The call is queued; the microphone, then the call itself, are in progress. */
  | { name: "calling"; lead: DialerLead; callId: string; numberName: string }
  /** Picked up: the rep records what happened. Cannot be left without saving. */
  | { name: "wrap-up"; lead: DialerLead; callId: string }
  | { name: "countdown"; lead: DialerLead; seconds: number };

export const STOPPED: DialerPhase = { name: "stopped", notice: null, nextDueAt: null };

/** How a call the rep talked on ended, from remoteRepCall.ts's state. */
export type CallEnd = {
  stage: "ended" | "error";
  answeredAt: number | null;
  endedBy: "rep" | null;
  message: string | null;
};

export type DialerEvent =
  | { type: "start" }
  | { type: "pause" }
  | { type: "dial-result"; response: DialerNextResponse }
  | { type: "dial-failed"; message: string }
  | { type: "retry" }
  /** startRemoteRepCall returned null: no microphone, no browser support, ... */
  | { type: "call-not-started"; message: string | null }
  | { type: "call-ended"; end: CallEnd }
  | { type: "tick" }
  | { type: "wrap-up-saved"; next: boolean };

export const PAUSED_BY_REP_NOTICE = "Paused — you hung up. Press Start to continue.";

/** Where the dialer goes when a call it placed has ended. */
export function afterCallEnded(phase: Extract<DialerPhase, { name: "calling" }>, end: CallEnd): DialerPhase {
  if (end.answeredAt != null) return { name: "wrap-up", lead: phase.lead, callId: phase.callId };
  if (end.stage === "error") return { name: "stopped", notice: end.message ?? "The call failed.", nextDueAt: null };
  if (end.endedBy === "rep") return { name: "stopped", notice: PAUSED_BY_REP_NOTICE, nextDueAt: null };
  return { name: "countdown", lead: phase.lead, seconds: NEXT_CALL_COUNTDOWN_SECONDS };
}

export function dialerReducer(phase: DialerPhase, event: DialerEvent): DialerPhase {
  switch (event.type) {
    case "start":
      return phase.name === "stopped" ? { name: "dialing", prefer: null } : phase;
    case "pause":
      // A call or a wrap-up in progress is finished first; only the quiet phases stop.
      return phase.name === "dialing" || phase.name === "waiting" || phase.name === "countdown"
        ? { name: "stopped", notice: null, nextDueAt: null }
        : phase;
    case "dial-result": {
      if (phase.name !== "dialing") return phase;
      const { response } = event;
      if (response.kind === "calling") return { name: "calling", lead: response.lead, callId: response.callId, numberName: response.numberName };
      // A picked-up call left without its wrap-up (a reload, a closed tab): record it first.
      if (response.kind === "wrap-up") return { name: "wrap-up", lead: response.lead, callId: response.callId };
      // Keep the lead to prefer: the server waits while the call just made is still settling, and its redial goes first.
      if (response.kind === "waiting") return { name: "waiting", message: response.message, retryInMs: Math.max(500, response.retryInMs), prefer: phase.prefer };
      return { name: "stopped", notice: response.message, nextDueAt: response.nextDueAt };
    }
    case "dial-failed":
      return phase.name === "dialing" ? { name: "stopped", notice: event.message, nextDueAt: null } : phase;
    case "retry":
      return phase.name === "waiting" ? { name: "dialing", prefer: phase.prefer } : phase;
    case "call-not-started":
      return phase.name === "calling" ? { name: "stopped", notice: event.message ?? "The call could not start.", nextDueAt: null } : phase;
    case "call-ended":
      return phase.name === "calling" ? afterCallEnded(phase, event.end) : phase;
    case "tick": {
      if (phase.name !== "countdown") return phase;
      return phase.seconds <= 1 ? { name: "dialing", prefer: phase.lead.contactId } : { ...phase, seconds: phase.seconds - 1 };
    }
    case "wrap-up-saved":
      if (phase.name !== "wrap-up") return phase;
      return event.next ? { name: "dialing", prefer: null } : { name: "stopped", notice: null, nextDueAt: null };
  }
}

/** Whether the dialer is working (so the button says Pause). */
export const isRunning = (phase: DialerPhase): boolean => phase.name !== "stopped";

/** What the lead card says about the call's live stage. */
export function callStageLabel(stage: string): string {
  switch (stage) {
    case "mic":
      return "Getting your microphone…";
    case "placing":
      return "Queuing the call…";
    case "waiting":
      return "Waiting for the number…";
    case "opening":
      return "Opening WhatsApp…";
    case "dialing":
      return "Dialing…";
    case "ringing":
      return "Ringing…";
    case "on-call":
      return "On call";
    case "ended":
      return "Call ended";
    default:
      return "Call failed";
  }
}

// --- the wrap-up form ------------------------------------------------------------------

export type WrapUpForm = {
  outcome: RepCallOutcome | null;
  /** The datetime-local input's value ("2026-11-27T16:00"), or "". */
  when: string;
  notes: string;
};

export const EMPTY_WRAP_UP: WrapUpForm = { outcome: null, when: "", notes: "" };

/** The time field a form needs: none, optional or required. */
export function wrapUpTime(form: WrapUpForm): "required" | "optional" | null {
  return form.outcome ? repOutcomeTakesTime(form.outcome) : null;
}

/** Why the wrap-up cannot be saved yet, or null. */
export function wrapUpProblem(form: WrapUpForm): string | null {
  if (!form.outcome) return "Choose how the call went.";
  if (!(REP_CALL_OUTCOMES as readonly string[]).includes(form.outcome)) return "Choose how the call went.";
  const time = wrapUpTime(form);
  if (time === "required" && !form.when) return "Choose when to call back.";
  if (time && form.when && Number.isNaN(new Date(form.when).getTime())) return "That time is not valid.";
  if (form.notes.length > REP_NOTES_MAX_CHARS) return `Notes can be at most ${REP_NOTES_MAX_CHARS} characters.`;
  return null;
}

/** The request for a valid form. A time is sent only for outcomes that take one. */
export function wrapUpRequest(callId: string, form: WrapUpForm): DialerWrapUpRequest {
  const problem = wrapUpProblem(form);
  if (problem || !form.outcome) throw new Error(problem ?? "Choose how the call went.");
  const takesTime = wrapUpTime(form) !== null;
  return {
    callId,
    outcome: form.outcome,
    whenAt: takesTime && form.when ? new Date(form.when).toISOString() : null,
    notes: form.notes.trim() || null,
  };
}

/** Why a WhatsApp cannot be sent yet, or null. */
export function messageProblem(body: string): string | null {
  if (!body.trim()) return "Write the message first.";
  if (body.length > REP_MESSAGE_MAX_CHARS) return `A message can be at most ${REP_MESSAGE_MAX_CHARS} characters.`;
  return null;
}
