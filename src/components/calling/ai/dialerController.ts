"use client";

/**
 * The rep dialer, run at module level so it keeps dialing on any page of
 * AgentSDR for as long as this tab is open (the call itself is
 * remoteRepCall.ts, also module-level). One dialer per tab.
 *
 * It holds the phase (dialerMachine.ts's reducer), the campaign it works, the
 * wrap-up form and the WhatsApp send of the current wrap-up, and each
 * campaign's header numbers. Every transition goes through `apply`, which
 * runs what the new phase needs: ask for the next lead (dialing), place the
 * call (calling), wait (waiting, countdown). Its waits run on background
 * timers (backgroundTimer.ts), so a hidden tab keeps dialing on time.
 *
 * Views: DialerTab (the campaign's Dialer tab), RemoteRepCallBar (between
 * calls), DialerOverlay (the wrap-up on any page, and the pop-out window).
 * Nothing here stops when a view unmounts; only Pause, a wrap-up's Pause, a
 * hang-up before the pick-up, an idle answer or an error stop it.
 */

import { useSyncExternalStore } from "react";
import { clearBackgroundTimeout, setBackgroundTimeout } from "@/components/calls/backgroundTimer";
import {
  isRemoteRepCallActive,
  remoteRepCallSnapshot,
  startRemoteRepCall,
  subscribeRemoteRepCall,
} from "@/components/calls/remoteRepCall";
import { dialNext, getDialerOverview, sendDialerMessage, wrapUpDialerCall } from "@/lib/calls/aiCampaigns/client";
import type { DialerOverview } from "@/lib/calls/aiCampaigns/dialer";
import { cancelCall, getCall } from "@/lib/calls/client";
import { errorText } from "./aiShared";
import {
  EMPTY_WRAP_UP,
  STOPPED,
  dialerReducer,
  messageProblem,
  wrapUpProblem,
  wrapUpRequest,
  type DialerEvent,
  type DialerPhase,
  type WrapUpForm,
} from "./dialerMachine";
import { answeredOn, callEndFor, startRefusal, type DialerCampaign } from "./dialerView";

/** The wrap-up of the call just picked up: the form, its save, and the separate WhatsApp. */
export type WrapUpState = {
  callId: string;
  form: WrapUpForm;
  saving: "pause" | "next" | null;
  error: string | null;
  message: string;
  sending: boolean;
  sent: boolean;
  messageError: string | null;
};

export type OverviewState = { data: DialerOverview | null; error: string | null };

export type DialerSnapshot = {
  /** The campaign the dialer works; kept after it stops, so Start (in the pop-out) resumes it. */
  campaign: DialerCampaign | null;
  phase: DialerPhase;
  wrapUp: WrapUpState | null;
  /** Each campaign's header numbers, by campaign id. */
  overviews: Readonly<Record<string, OverviewState>>;
};

let snapshot: DialerSnapshot = { campaign: null, phase: STOPPED, wrapUp: null, overviews: {} };
const listeners = new Set<() => void>();

function set(update: Partial<DialerSnapshot>) {
  snapshot = { ...snapshot, ...update };
  for (const listener of listeners) listener();
}

export function subscribeDialer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dialerSnapshot(): DialerSnapshot {
  return snapshot;
}

const SERVER_SNAPSHOT: DialerSnapshot = { campaign: null, phase: STOPPED, wrapUp: null, overviews: {} };

export function useDialer(): DialerSnapshot {
  return useSyncExternalStore(subscribeDialer, dialerSnapshot, () => SERVER_SNAPSHOT);
}

// --- the phase and what each one runs ---------------------------------------------------

/** The wait of the current phase (retry, countdown tick). */
let timer: number | undefined;
/** The call id startRemoteRepCall was asked to start for (so its end is read once, and only for it). */
let startedCallId: string | null = null;
let unsubscribeCall: (() => void) | null = null;

function apply(event: DialerEvent) {
  const before = snapshot.phase;
  const after = dialerReducer(before, event);
  if (after === before) return;
  clearBackgroundTimeout(timer);
  timer = undefined;
  const wrapUp = after.name === "wrap-up"
    ? (snapshot.wrapUp?.callId === after.callId ? snapshot.wrapUp : { callId: after.callId, form: EMPTY_WRAP_UP, saving: null, error: null, message: "", sending: false, sent: false, messageError: null })
    : null;
  set({ phase: after, wrapUp });
  syncUnloadWarning();
  if (after.name !== before.name && snapshot.campaign) void refreshDialerOverview(snapshot.campaign.id);
  enter(after);
}

function enter(phase: DialerPhase) {
  switch (phase.name) {
    case "dialing":
      requestNext(phase);
      return;
    case "waiting":
      timer = setBackgroundTimeout(() => { if (snapshot.phase === phase) apply({ type: "retry" }); }, phase.retryInMs);
      return;
    case "countdown":
      timer = setBackgroundTimeout(() => { if (snapshot.phase === phase) apply({ type: "tick" }); }, 1_000);
      return;
    case "calling":
      placeCall(phase);
      return;
    default:
      return;
  }
}

function requestNext(phase: Extract<DialerPhase, { name: "dialing" }>) {
  const campaign = snapshot.campaign;
  if (!campaign) {
    apply({ type: "dial-failed", message: "Open a campaign's Dialer tab and press Start." });
    return;
  }
  if (isRemoteRepCallActive()) {
    apply({ type: "dial-failed", message: "You are on another call. Finish it, then press Start." });
    return;
  }
  dialNext(campaign.id, { preferContactId: phase.prefer })
    .then((response) => {
      if (snapshot.phase !== phase) {
        // Paused (or restarted) while asking: a call queued meanwhile is withdrawn.
        if (response.kind === "calling") void cancelCall(response.callId).catch(() => {});
        return;
      }
      apply({ type: "dial-result", response });
    })
    .catch((cause) => {
      if (snapshot.phase === phase) apply({ type: "dial-failed", message: errorText(cause, "Could not start the next call") });
    });
}

/** The call is queued server-side already: open the microphone and let the rep's audio go. */
function placeCall(phase: Extract<DialerPhase, { name: "calling" }>) {
  const { callId, numberName, lead } = phase;
  if (startedCallId === callId) return;
  startedCallId = callId;
  watchCalls();
  const fail = (message: string | null) => {
    void cancelCall(callId).catch(() => {});
    if (snapshot.phase === phase) apply({ type: "call-not-started", message });
  };
  startRemoteRepCall({ leadName: lead.name || lead.phone, leadCompany: lead.company, numberName, place: async () => ({ callId, numberName }) })
    .then((id) => { if (id === null) fail(remoteRepCallSnapshot()?.message ?? null); })
    .catch((cause) => fail(errorText(cause, "The call could not start")));
}

/** Reads every change of the call; when the dialer's call is over, the machine decides what follows. */
let checking: string | null = null;
function onCallChanged() {
  const phase = snapshot.phase;
  const ended = callEndFor(phase, startedCallId, remoteRepCallSnapshot());
  if (!ended || phase.name !== "calling") return;
  if (!ended.check) {
    apply({ type: "call-ended", end: ended.end });
    return;
  }
  if (checking === phase.callId) return;
  checking = phase.callId;
  void getCall(phase.callId)
    .then((detail) => (answeredOn(detail) ? { ...ended.end, answeredAt: Date.now() } : ended.end))
    .catch(() => ended.end)
    .then((end) => { if (snapshot.phase === phase) apply({ type: "call-ended", end }); });
}

function watchCalls() {
  if (unsubscribeCall) return;
  unsubscribeCall = subscribeRemoteRepCall(onCallChanged);
}

// --- leaving the page -----------------------------------------------------------------------

let warning = false;
function warnBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  // Older browsers need returnValue set to show the prompt.
  event.returnValue = "";
}

/** A reload or a closed tab ends the dialer: ask first while it works. */
function syncUnloadWarning() {
  if (typeof window === "undefined") return;
  const running = snapshot.phase.name !== "stopped";
  if (running === warning) return;
  warning = running;
  if (running) window.addEventListener("beforeunload", warnBeforeUnload);
  else window.removeEventListener("beforeunload", warnBeforeUnload);
}

// --- actions ------------------------------------------------------------------------------

/**
 * From the Start click only, never on load: a pick-up while this tab is hidden
 * can then notify. Call it AFTER openPip(): the pop-out needs the click's user
 * activation, and a permission prompt shown first can leave it without one.
 */
export function askNotificationPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
  } catch {
    // Older browsers use a callback form; a missing notification is not worth an error.
  }
}

/**
 * Start (from a click). Refused with a message while another campaign's
 * dialer is working; null when it started (or was already running).
 */
export function startDialer(campaign: DialerCampaign): string | null {
  const refusal = startRefusal(snapshot.campaign, snapshot.phase, campaign.id);
  if (refusal) return refusal;
  if (snapshot.campaign?.id !== campaign.id || snapshot.campaign.name !== campaign.name) set({ campaign });
  watchCalls();
  apply({ type: "start" });
  return null;
}

/** Pause between calls (a call or a wrap-up in progress is finished first). */
export function pauseDialer() {
  apply({ type: "pause" });
}

/** Closes a stopped dialer's notice. */
export function dismissDialerNotice() {
  const phase = snapshot.phase;
  if (phase.name === "stopped" && phase.notice) set({ phase: STOPPED });
}

export function updateWrapUpForm(update: Partial<WrapUpForm>) {
  const wrapUp = snapshot.wrapUp;
  if (!wrapUp || wrapUp.saving) return;
  set({ wrapUp: { ...wrapUp, form: { ...wrapUp.form, ...update }, error: null } });
}

export function updateWrapUpMessage(message: string) {
  const wrapUp = snapshot.wrapUp;
  if (!wrapUp) return;
  set({ wrapUp: { ...wrapUp, message, sent: false, messageError: null } });
}

function patchWrapUp(callId: string, update: Partial<WrapUpState>) {
  const wrapUp = snapshot.wrapUp;
  if (wrapUp?.callId === callId) set({ wrapUp: { ...wrapUp, ...update } });
}

/** Saves the wrap-up, then Next lead (`next`) or Pause. */
export async function saveWrapUp(next: boolean) {
  const wrapUp = snapshot.wrapUp;
  const campaign = snapshot.campaign;
  if (!wrapUp || !campaign || wrapUp.saving) return;
  const problem = wrapUpProblem(wrapUp.form);
  if (problem) {
    patchWrapUp(wrapUp.callId, { error: problem });
    return;
  }
  patchWrapUp(wrapUp.callId, { saving: next ? "next" : "pause", error: null });
  try {
    await wrapUpDialerCall(campaign.id, wrapUpRequest(wrapUp.callId, wrapUp.form));
    const phase = snapshot.phase;
    if (phase.name === "wrap-up" && phase.callId === wrapUp.callId) apply({ type: "wrap-up-saved", next });
  } catch (cause) {
    patchWrapUp(wrapUp.callId, { saving: null, error: errorText(cause, "Could not save. Try again.") });
  }
}

/** Sends the wrap-up's WhatsApp from the lead's number; independent of saving the call. */
export async function sendWrapUpMessage() {
  const wrapUp = snapshot.wrapUp;
  const campaign = snapshot.campaign;
  const phase = snapshot.phase;
  if (!wrapUp || !campaign || phase.name !== "wrap-up" || wrapUp.sending) return;
  const invalid = messageProblem(wrapUp.message);
  if (invalid) {
    patchWrapUp(wrapUp.callId, { messageError: invalid });
    return;
  }
  patchWrapUp(wrapUp.callId, { sending: true, messageError: null, sent: false });
  try {
    await sendDialerMessage(campaign.id, { contactId: phase.lead.contactId, body: wrapUp.message.trim() });
    patchWrapUp(wrapUp.callId, { sending: false, sent: true, message: "" });
  } catch (cause) {
    patchWrapUp(wrapUp.callId, { sending: false, messageError: errorText(cause, "Could not send the message") });
  }
}

const refreshing = new Map<string, Promise<void>>();

/** Brings a campaign's header numbers up to date (one request at a time per campaign). */
export function refreshDialerOverview(campaignId: string): Promise<void> {
  const inFlight = refreshing.get(campaignId);
  if (inFlight) return inFlight;
  const request = getDialerOverview(campaignId)
    .then((data) => ({ data, error: null }))
    .catch((cause) => ({ data: snapshot.overviews[campaignId]?.data ?? null, error: errorText(cause, "Could not load today's numbers") }))
    .then((state: OverviewState) => {
      set({ overviews: { ...snapshot.overviews, [campaignId]: state } });
    })
    .finally(() => refreshing.delete(campaignId));
  refreshing.set(campaignId, request);
  return request;
}
