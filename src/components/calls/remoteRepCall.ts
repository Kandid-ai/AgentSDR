"use client";

/**
 * The rep's side of a call they talk on through a cloud calling station
 * (contract.ts, RecorderRemoteRep): their microphone, the WebRTC link to the
 * station's browser, the lead's voice coming back, mute and hang-up.
 *
 * One call at a time, held at module level rather than in a component, so it
 * survives the drawer that started it closing and client-side navigation;
 * RemoteRepCallBar (mounted once in the root layout) shows it. A full page
 * load or a closed tab ends it — the station hangs up when the link drops.
 *
 *   relay (TURN credentials) → mic → offer (ICE gathered, no trickle) →
 *   queued with the offer → the station answers (GET /api/calls/:id `rtcAnswer`, polled) → link up →
 *   the station dials → on call → ended
 */

import { cancelCall, getCall, getRepLinkIceServers, RepLinkIceError } from "@/lib/calls/client";
import {
  REP_LINK_CHANNEL,
  REP_LINK_GATHER_MS,
  type CallDetail,
  type RepLinkIceServer,
  type RepLinkControl,
} from "@/lib/calls/contract";
import { isRemoteRepOver, microphoneErrorText, remoteRepView, type RemoteRepStage } from "./remoteRepStage";

export type RemoteRepCallState = {
  callId: string | null;
  leadName: string;
  numberName: string | null;
  stage: RemoteRepStage;
  /** On call: when the lead picked up (epoch ms). */
  answeredAt: number | null;
  /** Ended or failed: what to tell the rep. */
  message: string | null;
  muted: boolean;
  /** The link to the number dropped mid-call; the station hangs up if it does not come back. */
  unstable: boolean;
  /** The browser held back the lead's audio until a click (autoplay rules). */
  audioBlocked: boolean;
};

/** Before the station answers: quick, so the link is up as soon as it can be. */
const POLL_WAITING_MS = 1_000;
const POLL_LIVE_MS = 2_000;
/**
 * A rep sits waiting on this; past it, the call is withdrawn. The offer's
 * reflexive candidates also age (NAT mappings), so a very late answer may not
 * connect anyway.
 */
const WAIT_FOR_NUMBER_MS = 5 * 60_000;
/** After the link closes, how long to keep reading the call for how it ended. */
const SETTLE_MS = 20_000;

type Session = {
  pc: RTCPeerConnection;
  stream: MediaStream;
  channel: RTCDataChannel;
  audio: HTMLAudioElement;
  callId: string | null;
  placedAt: number;
  answerApplied: boolean;
  linkUp: boolean;
  /** Media released: hung up, failed or over. */
  ended: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
};

let state: RemoteRepCallState | null = null;
let session: Session | null = null;
const listeners = new Set<() => void>();

function emit(next: RemoteRepCallState | null) {
  state = next;
  for (const listener of listeners) listener();
}

function patch(s: Session | null, update: Partial<RemoteRepCallState>) {
  // A late callback from an earlier call must not touch the current one.
  if (!state || (s && session !== s)) return;
  emit({ ...state, ...update });
}

export function subscribeRemoteRepCall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function remoteRepCallSnapshot(): RemoteRepCallState | null {
  return state;
}

/** A call is being placed or is on (the microphone is, or is about to be, in use). */
export function isRemoteRepCallActive(): boolean {
  return !!state && !isRemoteRepOver(state.stage);
}

export type StartRemoteRepCall = {
  leadName: string;
  numberName: string | null;
  /** Queues the call on the server with this offer (e.g. callAiLead with `remoteRep`). */
  place: (offer: string) => Promise<{ callId: string; numberName?: string | null }>;
};

/**
 * Gets a relay and the microphone, makes the offer and queues the call.
 * Resolves with the call id once queued, or null if it was not (the reason is
 * in the state, so the call bar shows it). Nothing is queued without a relay
 * (Cloudflare TURN) or a microphone.
 */
export async function startRemoteRepCall({ leadName, numberName, place }: StartRemoteRepCall): Promise<string | null> {
  if (isRemoteRepCallActive()) throw new Error("You are already on a call");
  // A finished call still on the bar: drop it, so its late reads cannot touch this one.
  if (session) clearTimeout(session.timer);
  session = null;
  emit({ callId: null, leadName, numberName, stage: "mic", answeredAt: null, message: null, muted: false, unstable: false, audioBlocked: false });

  if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    emit({ ...state!, stage: "error", message: "This browser can't place calls — use a recent Chrome, Edge or Firefox." });
    return null;
  }
  // The station reaches the internet only through its number's proxy, over
  // TCP: the link needs a TURN relay (contract.ts, RecorderRemoteRep).
  let iceServers: RepLinkIceServer[];
  try {
    iceServers = await getRepLinkIceServers();
  } catch (error) {
    emit({ ...state!, stage: "error", message: relayErrorText(error) });
    return null;
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    emit({ ...state!, stage: "error", message: microphoneErrorText(error) });
    return null;
  }

  const pc = new RTCPeerConnection({ iceServers });
  for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
  const channel = pc.createDataChannel(REP_LINK_CHANNEL);
  const audio = document.createElement("audio");
  audio.autoplay = true;
  const s: Session = { pc, stream, channel, audio, callId: null, placedAt: Date.now(), answerApplied: false, linkUp: false, ended: false, timer: undefined };
  session = s;
  window.addEventListener("beforeunload", warnBeforeUnload);
  window.addEventListener("pagehide", hangUpOnUnload);

  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
    playRemoteAudio(s);
  };
  pc.onconnectionstatechange = () => onConnectionState(s);
  channel.onclose = () => {
    // The station closes the link when the call is over (or it gave up on it).
    if (s.linkUp && !s.ended) void finish(s, { stage: "ended", message: "Call ended" }, { settle: true });
  };

  try {
    await pc.setLocalDescription(await pc.createOffer());
    await iceGathered(pc, REP_LINK_GATHER_MS);
  } catch (error) {
    await finish(s, { stage: "error", message: error instanceof Error ? `Couldn't set up the call audio: ${error.message}` : "Couldn't set up the call audio" });
    return null;
  }
  if (s.ended) return null;
  const offer = pc.localDescription?.sdp;
  if (!offer) {
    await finish(s, { stage: "error", message: "Couldn't set up the call audio" });
    return null;
  }

  patch(s, { stage: "placing" });
  let placed: { callId: string; numberName?: string | null };
  try {
    placed = await place(offer);
  } catch (error) {
    await finish(s, { stage: "error", message: error instanceof Error ? error.message : "Could not place the call" });
    return null;
  }
  s.callId = placed.callId;
  s.placedAt = Date.now();
  if (s.ended) {
    // Hung up while it was being queued: withdraw it.
    await cancelCall(placed.callId).catch(() => {});
    return placed.callId;
  }
  patch(s, { callId: placed.callId, numberName: placed.numberName ?? numberName, stage: "waiting" });
  void poll(s);
  return placed.callId;
}

export function setRemoteRepMuted(muted: boolean) {
  const s = session;
  if (!s || s.ended) return;
  for (const track of s.stream.getAudioTracks()) track.enabled = !muted;
  patch(s, { muted });
}

/** Retries the lead's audio after the browser blocked it; call from a click. */
export function resumeRemoteRepAudio() {
  if (session && !session.ended) playRemoteAudio(session);
}

/**
 * Hangs up: tells the station over the link (it ends the WhatsApp call, and
 * the recording is kept), and withdraws the call if it had not connected yet.
 */
export async function hangUpRemoteRepCall(): Promise<void> {
  const s = session;
  if (!s || s.ended || !state) return;
  const connected = state.stage === "on-call";
  sendHangup(s);
  // Give the message a moment to leave before the connection closes.
  await waitForDrain(s.channel, 500);
  await finish(s, { stage: "ended", message: connected ? "You hung up" : "Call cancelled" }, { settle: connected });
  if (!connected && s.callId) await cancelCall(s.callId).catch(() => {});
}

/** Clears a finished call from the bar. */
export function dismissRemoteRepCall() {
  if (state && isRemoteRepOver(state.stage)) {
    if (session?.ended) clearTimeout(session.timer);
    session = null;
    emit(null);
  }
}

// --- internals ------------------------------------------------------------------

async function poll(s: Session) {
  if (s.ended || !s.callId) return;
  let call: CallDetail | null = null;
  try {
    call = await getCall(s.callId);
  } catch {
    // A blip: try again below.
  }
  if (s.ended || session !== s) return;
  if (call) {
    if (call.rtcAnswer && !s.answerApplied) {
      s.answerApplied = true;
      try {
        await s.pc.setRemoteDescription({ type: "answer", sdp: call.rtcAnswer });
      } catch {
        await finish(s, { stage: "error", message: "Couldn't connect to the number's audio — the call was withdrawn" });
        await cancelCall(s.callId).catch(() => {});
        return;
      }
    }
    const view = remoteRepView(call, s.linkUp);
    if (isRemoteRepOver(view.stage)) {
      await finish(s, { stage: view.stage, message: view.message ?? null });
      return;
    }
    if (!s.answerApplied && Date.now() - s.placedAt > WAIT_FOR_NUMBER_MS) {
      await finish(s, { stage: "error", message: "The number didn't take this call within 5 minutes — it was withdrawn. Try again." });
      await cancelCall(s.callId).catch(() => {});
      return;
    }
    patch(s, { stage: view.stage, answeredAt: view.answeredAt ?? state?.answeredAt ?? null });
  }
  s.timer = setTimeout(() => void poll(s), s.linkUp ? POLL_LIVE_MS : POLL_WAITING_MS);
}

function onConnectionState(s: Session) {
  if (s.ended) return;
  switch (s.pc.connectionState) {
    case "connected":
      s.linkUp = true;
      patch(s, { unstable: false, ...(state?.stage === "connecting" || state?.stage === "opening" ? { stage: "dialing" as const } : {}) });
      return;
    case "disconnected":
      if (s.linkUp) patch(s, { unstable: true });
      return;
    case "failed":
      if (s.linkUp) {
        void finish(s, { stage: "ended", message: "The connection to the number was lost" }, { settle: true });
      } else {
        // The station never dials without the link, so there is nothing to keep.
        void finish(s, {
          stage: "error",
          message: "Couldn't connect your audio to the number, even through the relay. Check your network, or try again.",
        }).then(() => (s.callId ? cancelCall(s.callId).catch(() => {}) : undefined));
      }
      return;
  }
}

/**
 * Releases the microphone and the link and shows how the call ended. With
 * `settle`, keeps reading the call for a while for a better ending ("Not
 * answered", the call's length) than the link closing can tell.
 */
async function finish(s: Session, end: { stage: "ended" | "error"; message: string | null }, { settle = false } = {}) {
  if (s.ended) return;
  s.ended = true;
  clearTimeout(s.timer);
  for (const track of s.stream.getTracks()) track.stop();
  s.channel.onclose = null;
  s.pc.ontrack = null;
  s.pc.onconnectionstatechange = null;
  s.pc.close();
  s.audio.pause();
  s.audio.srcObject = null;
  window.removeEventListener("beforeunload", warnBeforeUnload);
  window.removeEventListener("pagehide", hangUpOnUnload);
  patch(s, { stage: end.stage, message: end.message, unstable: false, audioBlocked: false });
  if (settle && s.callId) void settleEnding(s, s.callId, Date.now() + SETTLE_MS);
}

async function settleEnding(s: Session, callId: string, until: number) {
  if (session !== s || Date.now() > until) return;
  try {
    const view = remoteRepView(await getCall(callId), false);
    if (isRemoteRepOver(view.stage)) {
      patch(s, { stage: view.stage, message: view.message ?? state?.message ?? null });
      return;
    }
  } catch {
    // Keep the ending already shown.
  }
  s.timer = setTimeout(() => void settleEnding(s, callId, until), POLL_LIVE_MS);
}

function relayErrorText(error: unknown): string {
  if (error instanceof RepLinkIceError && error.notConnected) {
    return "Calls through a number need Cloudflare TURN. An owner or admin connects it in Settings → WhatsApp → Integrations.";
  }
  return `Couldn't get a relay for the call audio: ${error instanceof Error ? error.message : "unknown error"}`;
}

function playRemoteAudio(s: Session) {
  s.audio.play().then(
    () => patch(s, { audioBlocked: false }),
    () => patch(s, { audioBlocked: true }),
  );
}

function sendHangup(s: Session) {
  if (s.channel.readyState !== "open") return;
  const message: RepLinkControl = { type: "hangup" };
  try {
    s.channel.send(JSON.stringify(message));
  } catch {
    // The link is going anyway; the station hangs up when it drops.
  }
}

function waitForDrain(channel: RTCDataChannel, capMs: number): Promise<void> {
  const until = Date.now() + capMs;
  return new Promise((resolve) => {
    const check = () => {
      if (channel.readyState !== "open" || channel.bufferedAmount === 0 || Date.now() > until) resolve();
      else setTimeout(check, 50);
    };
    // Even with nothing buffered, a beat for the SCTP packet to go out.
    setTimeout(check, 100);
  });
}

/** Waits for ICE gathering to finish (no trickle), or `capMs`, whichever is first. */
function iceGathered(pc: RTCPeerConnection, capMs: number): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const timer = setTimeout(done, capMs);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!isRemoteRepCallActive()) return;
  event.preventDefault();
  // Older browsers need returnValue set to show the prompt.
  event.returnValue = "";
}

function hangUpOnUnload() {
  // Best effort: the page is going, and with it the link; the station hangs up on its own soon after.
  if (session && !session.ended) sendHangup(session);
}
