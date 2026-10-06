/**
 * Messages between the two scripts the extension runs on web.whatsapp.com,
 * over window.postMessage:
 *
 *   wa-hook  (the page's own JS world) — sees WhatsApp's audio graph and
 *            microphone, and records the call.
 *   wa-agent (the extension's isolated world) — talks to the service worker:
 *            learns which call to place, clicks Voice call, ships the file.
 *
 * WhatsApp's own scripts see these messages too; they carry nothing but the
 * rep's own call.
 */

export const HOOK_SOURCE = "agentsdr-wa-hook";
export const AGENT_SOURCE = "agentsdr-wa-agent";

export type AgentToHook =
  /** Record the next call in this tab; nothing is recorded unless armed. */
  | { source: typeof AGENT_SOURCE; type: "arm"; callId: string }
  | { source: typeof AGENT_SOURCE; type: "disarm" }
  /** The rep clicked the "turn on call audio" prompt — resume suspended audio. */
  | { source: typeof AGENT_SOURCE; type: "resume-audio" }
  /** Press WhatsApp's End call, wherever it is — the page or its picture-in-picture window. */
  | { source: typeof AGENT_SOURCE; type: "end-call"; callId: string }
  /** Which call, if any, wa-hook is recording or finishing off — answered with probe-result. */
  | { source: typeof AGENT_SOURCE; type: "probe" };

export type HookToAgent =
  /** WhatsApp opened the microphone for the call: it is dialing or ringing. */
  | { source: typeof HOOK_SOURCE; type: "dialing"; callId: string }
  /** The call timer appeared — the lead picked up — and recording began. */
  | { source: typeof HOOK_SOURCE; type: "answered"; callId: string; answeredAt: number; timerSeen: boolean }
  | { source: typeof HOOK_SOURCE; type: "audio-suspended"; callId: string }
  /**
   * The finished recording. It runs from `startedAt` (the call opening the
   * microphone) to `endedAt`; the lead picked up at `answeredAt`, in between.
   */
  | {
      source: typeof HOOK_SOURCE;
      type: "recording";
      callId: string;
      blob: Blob;
      startedAt: number;
      answeredAt: number;
      endedAt: number;
    }
  /** The call ended without the timer ever appearing. */
  | { source: typeof HOOK_SOURCE; type: "not-answered"; callId: string; dialedAt: number; endedAt: number }
  | { source: typeof HOOK_SOURCE; type: "recording-failed"; callId: string; error: string }
  | { source: typeof HOOK_SOURCE; type: "end-result"; callId: string; clicked: boolean }
  /** WhatsApp's own call screen changed what it says ("Calling…", "Ringing…"). */
  | { source: typeof HOOK_SOURCE; type: "call-status"; callId: string; text: string }
  /** What wa-hook can see of the call UI, when that changes — for the timing table. */
  | { source: typeof HOOK_SOURCE; type: "diag"; callId: string; text: string }
  | { source: typeof HOOK_SOURCE; type: "probe-result"; callId: string | null }
  /** WhatsApp's call screen appeared for this call — the rep can go back to AgentSDR. */
  | { source: typeof HOOK_SOURCE; type: "call-ui"; callId: string };
