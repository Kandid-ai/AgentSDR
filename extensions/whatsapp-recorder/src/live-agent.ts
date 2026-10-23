/**
 * The AI voice agent's side of a call (trial): one Gemini Live session,
 * opened by wa-agent when an agent call starts ringing.
 *
 * Why here, in the isolated world: web.whatsapp.com's CSP (connect-src) only
 * lets the page reach WhatsApp's own hosts, so wa-hook, in the page's world,
 * cannot open this socket. Content scripts are not bound by the page's CSP.
 * Audio crosses between the two over window.postMessage as raw PCM:
 *   lead → model: wa-hook posts the lead's side at 16 kHz ("agent-audio");
 *   model → lead: the model's 24 kHz voice goes back to wa-hook
 *                 ("agent-play"), which plays it into the call's microphone.
 *
 * The session's setup — model, voice, instructions, tools — is locked into
 * the token AgentSDR mints (src/lib/calls/liveAgent.ts); the setup sent here
 * only names the model.
 */

import type { AgentTokenResult } from "./messages";

type Handlers = {
  /** The model's voice: mono 16-bit PCM at `rate` Hz. */
  play(pcm: ArrayBuffer, rate: number): void;
  /** The lead talked over the model: drop its voice still queued. */
  interrupt(): void;
  /** The model called end_call. */
  hangup(reason: string): void;
  /** A step worth seeing in the call's timing table. */
  trace(step: string): void;
  /** The token request, through the service worker (it holds the call's bearer token). */
  token(): Promise<AgentTokenResult>;
};

const OUTPUT_RATE_PATTERN = /rate=(\d+)/;
const GREETING_PROMPT = "The call has just connected and the person is on the line. Greet them now.";
/**
 * People pick up and say "Hello?" first; a greeting started at the pick-up
 * gets talked over (seen 11 Oct 2026: three restarts). So the agent waits
 * this long for them, and if they speak, answers them instead.
 */
const GREETING_WAIT_MS = 1_200;

export class LiveAgent {
  private socket: WebSocket | null = null;
  private ready = false;
  private closed = false;
  private greetPending = false;
  private saidThisTurn = "";
  private warnedNotReady = false;
  private sentSamples = 0;
  private sentPeak = 0;
  private sentSince = Date.now();
  private greetTimer: ReturnType<typeof setTimeout> | null = null;
  private leadSpoke = false;
  private firstReply = true;
  private heardThisTurn = "";

  constructor(private readonly handlers: Handlers) {}

  async start(): Promise<void> {
    this.handlers.trace("AI agent: asking for a session");
    const result = await this.handlers.token();
    if (this.closed) return;
    if (!result.ok) {
      this.handlers.trace(`AI agent: no session — ${result.error}`);
      console.warn("[agentsdr agent] no session:", result.error);
      return;
    }
    const socket = new WebSocket(`${result.websocketUrl}?access_token=${encodeURIComponent(result.token)}`);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ setup: { model: result.model } }));
    socket.onmessage = (event) => this.receive(event.data);
    socket.onerror = () => console.warn("[agentsdr agent] socket error");
    socket.onclose = (event) => {
      this.ready = false;
      if (!this.closed) {
        this.handlers.trace(`AI agent: disconnected (${event.code}${event.reason ? ` ${event.reason}` : ""})`);
        console.warn("[agentsdr agent] socket closed", event.code, event.reason);
      }
    };
  }

  /** The lead picked up: the model speaks first. */
  greet(): void {
    this.handlers.trace("AI agent: lead picked up — waiting for their hello");
    this.greetTimer = setTimeout(() => {
      this.greetTimer = null;
      if (this.leadSpoke) return;
      this.handlers.trace("AI agent: lead said nothing — greeting");
      if (this.ready) this.sendGreeting();
      else this.greetPending = true;
    }, GREETING_WAIT_MS);
  }

  /** The lead's side of the call: mono 16-bit PCM at 16 kHz. */
  sendAudio(pcm: ArrayBuffer): void {
    if (!this.ready || !this.socket) {
      if (!this.warnedNotReady) this.handlers.trace("AI agent: lead audio arrived before the session was ready — dropped");
      this.warnedNotReady = true;
      return;
    }
    this.socket.send(JSON.stringify({ realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: toBase64(pcm) } } }));
    // Every 5 s: how much of the lead's audio went to the model, and how loud
    // it was — the evidence for "the agent did not hear me".
    const samples = new Int16Array(pcm);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    this.sentSamples += samples.length;
    this.sentPeak = Math.max(this.sentPeak, peak);
    const now = Date.now();
    if (now - this.sentSince >= 5_000) {
      const peakDb = this.sentPeak > 0 ? Math.round(20 * Math.log10(this.sentPeak / 0x8000)) : -Infinity;
      this.handlers.trace(`AI agent: sent ${(this.sentSamples / 16_000).toFixed(1)} s of the lead's audio in ${((now - this.sentSince) / 1000).toFixed(1)} s, peak ${peakDb} dB`);
      this.sentSamples = 0;
      this.sentPeak = 0;
      this.sentSince = now;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.greetTimer) clearTimeout(this.greetTimer);
    this.ready = false;
    try {
      this.socket?.close(1000);
    } catch {
      // Already closing.
    }
    this.socket = null;
  }

  private sendGreeting(): void {
    this.greetPending = false;
    this.socket?.send(JSON.stringify({ realtimeInput: { text: GREETING_PROMPT } }));
  }

  private receive(data: unknown): void {
    const text = typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);
    let message: LiveServerMessage;
    try {
      message = JSON.parse(text) as LiveServerMessage;
    } catch {
      return;
    }

    if (message.setupComplete) {
      this.ready = true;
      this.handlers.trace("AI agent: session ready");
      if (this.greetPending) this.sendGreeting();
      return;
    }

    const content = message.serverContent;
    if (content) {
      if (content.interrupted) {
        this.handlers.interrupt();
        this.flushTranscript("interrupted");
      }
      if (content.inputTranscription?.text) {
        // They spoke first: the model answers that turn itself, greeting included.
        if (!this.leadSpoke && this.greetTimer) this.handlers.trace("AI agent: lead said hello first — answering them");
        this.leadSpoke = true;
        this.heardThisTurn += content.inputTranscription.text;
        // Logged as it arrives: a turn the model never answers is never flushed.
        this.handlers.trace(`AI agent: heard "${content.inputTranscription.text.trim()}"`);
      }
      if (content.outputTranscription?.text) {
        if (this.heardThisTurn) this.flushHeard();
        this.saidThisTurn += content.outputTranscription.text;
      }
      for (const part of content.modelTurn?.parts ?? []) {
        const audio = part.inlineData;
        if (!audio?.data || !audio.mimeType?.startsWith("audio/pcm")) continue;
        const rate = Number(OUTPUT_RATE_PATTERN.exec(audio.mimeType)?.[1] ?? 24_000);
        if (this.firstReply) {
          this.firstReply = false;
          this.handlers.trace("AI agent: first audio from Gemini");
        }
        this.handlers.play(fromBase64(audio.data), rate);
      }
      if (content.turnComplete) this.flushTranscript("turn");
    }

    for (const call of message.toolCall?.functionCalls ?? []) {
      if (call.name !== "end_call") continue;
      const reason = typeof call.args?.reason === "string" ? call.args.reason : "the agent ended the call";
      this.socket?.send(
        JSON.stringify({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { ok: true } }] } }),
      );
      this.handlers.trace(`AI agent: hanging up (${reason})`);
      this.handlers.hangup(reason);
    }

    if (message.goAway) this.handlers.trace(`AI agent: Gemini will close the session in ${message.goAway.timeLeft ?? "?"}`);
  }

  private flushHeard(): void {
    console.info("[agentsdr agent] lead:", this.heardThisTurn.trim());
    this.handlers.trace(`lead: ${this.heardThisTurn.trim()}`);
    this.heardThisTurn = "";
  }

  private flushTranscript(why: string): void {
    if (this.heardThisTurn) this.flushHeard();
    if (this.saidThisTurn) {
      console.info(`[agentsdr agent] agent (${why}):`, this.saidThisTurn.trim());
      this.handlers.trace(`agent (${why}): ${this.saidThisTurn.trim()}`);
    }
    this.saidThisTurn = "";
  }
}

/** The fields of a BidiGenerateContent server message this reads. */
type LiveServerMessage = {
  setupComplete?: object;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
  };
  toolCall?: { functionCalls?: { id: string; name: string; args?: Record<string, unknown> }[] };
  goAway?: { timeLeft?: string };
};

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(data: string): ArrayBuffer {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
