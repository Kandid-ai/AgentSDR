/**
 * The pure half of the dialer controller (dialerController.ts) and its
 * pop-out window: whether a start is allowed, how a finished call is read,
 * and what the pop-out shows for a state. No browser here, so it is tested
 * on its own. The phase transitions themselves are in dialerMachine.ts.
 */
import type { CallDetail } from "@/lib/calls/contract";
import { isRemoteRepOver, type RemoteRepStage } from "@/components/calls/remoteRepStage";
import type { CallEnd, DialerPhase } from "./dialerMachine";
import { dialerStatus } from "./dialerSessionText";

/** The campaign a dialer session works. */
export type DialerCampaign = { id: string; name: string };

export function dialerCampaignHref(campaignId: string): string {
  return `/calling/campaigns/ai/${campaignId}?tab=dialer`;
}

/**
 * Why Start for `campaignId` is refused, or null. One dialer per tab: while
 * another campaign's dialer is doing anything (not stopped), it must be
 * paused first.
 */
export function startRefusal(current: DialerCampaign | null, phase: DialerPhase, campaignId: string): string | null {
  if (!current || phase.name === "stopped" || current.id === campaignId) return null;
  return `The dialer is already working on “${current.name}”. Pause it there first.`;
}

/** The lead picked up: the extension marked the call started, it was recorded, or its phase reports a length. */
export function answeredOn(call: Pick<CallDetail, "status" | "livePhase">): boolean {
  if (call.status === "recorded" || call.status === "in_progress") return true;
  const phase = call.livePhase;
  return (phase?.kind === "processing" || phase?.kind === "done") && (phase.durationMs ?? 0) > 0;
}

/** What the dialer needs of remoteRepCall.ts's state to tell how a call ended. */
export type ObservedCall = {
  callId: string | null;
  stage: RemoteRepStage;
  answeredAt: number | null;
  endedBy: "rep" | null;
  message: string | null;
};

/**
 * The dialer's call has ended: how, and whether to ask the call itself first.
 * null while it runs, or when the state is not this call's (an earlier call
 * still on the bar). `check`: it looks unanswered, but the bar polls every
 * second or two, so a pick-up that ended between two polls was never seen on
 * call — ask the call before reading it as unanswered (a pick-up needs a wrap-up).
 */
export function callEndFor(phase: DialerPhase, startedCallId: string | null, call: ObservedCall | null): { end: CallEnd; check: boolean } | null {
  if (phase.name !== "calling" || startedCallId !== phase.callId || !call || !isRemoteRepOver(call.stage)) return null;
  if (call.callId !== phase.callId && call.callId !== null) return null;
  const end: CallEnd = { stage: call.stage, answeredAt: call.answeredAt, endedBy: call.endedBy, message: call.message };
  const check = !(end.answeredAt != null || end.endedBy === "rep" || end.stage === "error");
  return { end, check };
}

/** What the pop-out window shows. */
export type PipLayout = {
  /** The lead picked up: the window turns green. */
  live: boolean;
  /** The call's own row (who, stage, timer, mute, hang up). */
  showCall: boolean;
  /** The dialer's row, when a dialer session exists. `text`: null when the call row already says it. */
  dialer: { campaignName: string; text: string | null; button: "pause" | "start" | null; dismissible: boolean } | null;
  /** The wrap-up form, compact. */
  showWrapUp: boolean;
};

export function pipLayout(phase: DialerPhase, campaign: DialerCampaign | null, call: Pick<ObservedCall, "stage"> | null): PipLayout {
  const status = campaign ? dialerStatus(phase) : null;
  const callOver = call ? isRemoteRepOver(call.stage) : true;
  // A finished call stays only while the dialer has nothing newer to say (a wrap-up or the next dial takes over).
  const showCall = call !== null && (!callOver || status === null);
  let dialer: PipLayout["dialer"] = null;
  if (campaign) {
    const button = phase.name === "stopped" ? "start" : status?.canPause ? "pause" : null;
    const text = phase.name === "calling" && showCall ? null : phase.name === "stopped" ? (status?.text ?? "Paused. Press Start to call the next lead.") : (status?.text ?? null);
    dialer = { campaignName: campaign.name, text, button, dismissible: status?.dismissible ?? false };
  }
  return { live: call?.stage === "on-call", showCall, dialer, showWrapUp: phase.name === "wrap-up" };
}

/** The lead's own number for the call row, when the call on the bar is the dialer's. */
export function dialerLeadPhone(phase: DialerPhase, call: Pick<ObservedCall, "callId"> | null): string | null {
  if (phase.name !== "calling" || !call) return null;
  return call.callId === phase.callId || call.callId === null ? phase.lead.phone : null;
}
