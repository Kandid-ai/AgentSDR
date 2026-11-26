/**
 * One side's audio up to AgentSDR's relay (contract.ts, "a rep talking
 * through a calling station"), for both senders: the rep's tab
 * (src/components/calls/remoteRepCall.ts) and the station's extension
 * (extensions/whatsapp-recorder/src/rep-relay.ts, which imports this as it
 * imports the contract). Client-safe; imports only the contract and
 * relayPcm.ts.
 *
 * Chunked is the default. Streaming is tried only with `tryStreaming`:
 * production's path has never let a stream through (see below), so trying
 * one only cost audio.
 *
 *   streaming  ONE long POST whose body is a stream (REP_RELAY_STREAM_HEADER):
 *              each read of it takes everything queued, so audio goes as
 *              soon as the network takes it, with no round trip per chunk.
 *              The relay answers its first audio with an `uplink` event on
 *              this side's down stream (heard()). Every rotateMs a new
 *              stream starts and the old one's body ends.
 *   chunked    a POST as soon as REP_RELAY_CHUNK_MS has gathered, up to
 *              MAX_CHUNKS_IN_FLIGHT at once, so audio never waits for the
 *              previous POST's answer (a round trip to production is
 *              ~280 ms; one at a time held the voice ~0.4 s on average
 *              before it even left, each way). Each carries `seq` (its send
 *              time, strictly increasing), and the relay drops one that
 *              arrives after a newer one. Round trips are logged every statsMs.
 *
 * Streaming falls back for the rest of the call when this browser cannot
 * stream a request body (Firefox), or when the first stream fails before any
 * worked — refused (Chrome streams only over HTTP/2 or newer), or carrying
 * audio the relay did not hear within ackMs (something in between holds the
 * body back). Once one has worked, a failure (a network blip) only retries
 * with backoff. Either way the backlog is capped at REP_RELAY_MAX_CHUNK_MS,
 * oldest dropped: after a stall the other side hears now, not late.
 *
 * A fallback is remembered by the page (STREAMING_RETRY_AFTER_MS): the next
 * calls start as chunks at once. Production never heard a stream (26 Nov
 * 2026: 12 of 12 failed — something in front of the app holds the body), and
 * the probe of two 5 s attempts cost every call its first ~10 s of audio both
 * ways: the rep saw "Ringing" long before hearing it, and a lead who picked
 * up quickly heard nobody.
 */

import { REP_RELAY_CHUNK_MS, REP_RELAY_SAMPLE_RATE, REP_RELAY_SEQ_PARAM, REP_RELAY_STREAM_HEADER, REP_RELAY_STREAM_ROTATE_MS } from "./contract";
import { PcmOutbox } from "./relayPcm";

export type RelayUplinkMode = "streaming" | "chunked";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type RelayUplinkTiming = {
  /** A stream's first audio not heard by the relay in this long: it is not arriving. */
  ackMs: number;
  /** A new stream replaces the open one this often. */
  rotateMs: number;
  /** Waits before retrying a failed stream, by failures in a row; the last repeats. */
  backoffMs: number[];
  /** Chunked: round trips are summed up in the log this often. */
  statsMs: number;
};

const DEFAULT_TIMING: RelayUplinkTiming = {
  // A heard stream is acked within a round trip (~0.3 s); waiting longer only loses audio.
  ackMs: 1_500,
  rotateMs: REP_RELAY_STREAM_ROTATE_MS,
  backoffMs: [250, 500, 1_000, 2_000],
  statsMs: 10_000,
};

/** A rotated-out stream whose answer has not come in this long is aborted. */
const ROTATED_ABORT_MS = 10_000;
/** A stream that ended this soon, even cleanly, waits before the next. */
const QUICK_END_MS = 1_000;
const CHUNK_SAMPLES = Math.round((REP_RELAY_SAMPLE_RATE * REP_RELAY_CHUNK_MS) / 1000);
/** Chunked POSTs under way at once: a round trip's worth of 40 ms chunks (~280 / 40), with room. */
export const MAX_CHUNKS_IN_FLIGHT = 8;

/** The chunk's URL with its sequence number: a query parameter, not a header, so no CORS preflight changes. */
export function withRelaySeq(url: string, seq: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}${REP_RELAY_SEQ_PARAM}=${seq}`;
}

export type RelayUplinkOptions = {
  /** The side's relay URL (…/relay). */
  url: string;
  /** Sent with every request: the station's Authorization; none for the rep's tab, whose cookie goes along. */
  headers?: Record<string, string>;
  /** A step worth the call's log: the mode in use, why it fell back, round trips, drops. */
  log: (step: string) => void;
  /** For tests; the global fetch otherwise. */
  fetch?: Fetch;
  /**
   * Try a streaming upload before chunks. Off by default: nothing in front of
   * production lets a stream through (26 Nov 2026), so a try only delays the
   * audio. Turn it on where streams are known to arrive.
   */
  tryStreaming?: boolean;
  /** Whether this browser can stream a request body; detected when unset (and only when tryStreaming). */
  canStream?: boolean;
  /** For tests. */
  timing?: Partial<RelayUplinkTiming>;
};

// --- pure pieces (tested) --------------------------------------------------------

/** Failed streams in a row, before any worked, that send the rest of the call as chunks. */
export const STREAM_FAILURES_BEFORE_FALLBACK = 1;

/** After streaming fell back on this page, later calls skip it for this long (then try again: the path may be fixed). */
export const STREAMING_RETRY_AFTER_MS = 30 * 60_000;

/** When streaming last fell back in this page (0: never) — the rep's tab and the station's WhatsApp tab each live across calls. */
let streamingFellBackAt = 0;

/** For tests: forget an earlier fallback. */
export function forgetStreamingFallback(): void {
  streamingFellBackAt = 0;
}

/** How one streaming attempt ended. */
export type StreamAttempt = {
  /** The relay said its audio arrived (`uplink`). */
  heard: boolean;
  /** Why it failed: refused, broke, or carried audio that was not heard. Null when it just ended. */
  error: string | null;
};

export type StreamState = {
  /** A stream has been heard in this call: streaming works here. */
  worked: boolean;
  /** Failed attempts in a row. */
  failures: number;
};

/**
 * After a streaming attempt: the new state, and whether to fall back to
 * chunks. A heard stream proves streaming works; before one has,
 * STREAM_FAILURES_BEFORE_FALLBACK failures in a row give up on it. An
 * attempt that ended with no error and nothing heard (rotated while the line
 * was quiet) counts neither way.
 */
export function streamDecision(state: StreamState, attempt: StreamAttempt): StreamState & { fallBack: boolean } {
  if (attempt.heard) return { worked: true, failures: 0, fallBack: false };
  if (!attempt.error) return { ...state, fallBack: false };
  const failures = state.failures + 1;
  return { worked: state.worked, failures, fallBack: !state.worked && failures >= STREAM_FAILURES_BEFORE_FALLBACK };
}

/** Round trips of the chunked POSTs, summed up once per window. */
export class RoundTrips {
  private count = 0;
  private total = 0;
  private min = Infinity;
  private max = 0;
  private since: number | null = null;

  constructor(private readonly windowMs: number) {}

  /** Records one; returns the window's summary once `windowMs` has passed since its first. */
  add(ms: number, now: number): string | null {
    this.since ??= now;
    this.count += 1;
    this.total += ms;
    this.min = Math.min(this.min, ms);
    this.max = Math.max(this.max, ms);
    if (now - this.since < this.windowMs) return null;
    const line = `POST round trips over ${Math.round((now - this.since) / 1000)} s: min ${Math.round(this.min)} / avg ${Math.round(this.total / this.count)} / max ${Math.round(this.max)} ms (${this.count} requests)`;
    this.count = 0;
    this.total = 0;
    this.min = Infinity;
    this.max = 0;
    this.since = null;
    return line;
  }
}

/**
 * Whether fetch can send a ReadableStream body (Chrome 105+). A browser that
 * cannot sends the stream's text ("[object ReadableStream]") instead, so it
 * has to be known before trying.
 */
export function canStreamRequests(): boolean {
  try {
    let duplexAccessed = false;
    const init = {
      method: "POST",
      body: new ReadableStream(),
      get duplex() {
        duplexAccessed = true;
        return "half";
      },
    };
    const hasContentType = new Request("https://relay.invalid/", init as RequestInit).headers.has("Content-Type");
    return duplexAccessed && !hasContentType;
  } catch {
    return false;
  }
}

// --- the uplink ------------------------------------------------------------------

/** One upload stream. */
type Upload = {
  abort: AbortController;
  /** Its body ends once its pending read is answered (rotated out, or closed). */
  ending: boolean;
  /** Wakes the body's pending read: audio queued, or it is ending. */
  wake: (() => void) | null;
  /** It has carried audio. */
  delivered: boolean;
  heard: boolean;
  ack: ReturnType<typeof setTimeout> | undefined;
  /** Set when the ack wait ran out, before the stream is aborted for it. */
  notHeard: string | null;
};

export class RelayUplink {
  private readonly outbox = new PcmOutbox();
  private readonly fetch: Fetch;
  private readonly timing: RelayUplinkTiming;
  private readonly trips: RoundTrips;
  private current: RelayUplinkMode;
  private closed = false;
  /** The stream audio goes into now. */
  private upload: Upload | null = null;
  private state: StreamState = { worked: false, failures: 0 };
  private announced = false;
  /** Chunked: POSTs under way. */
  private inFlight = 0;
  /** Chunked: the last POST's sequence number. */
  private lastSeq = 0;
  /** Chunked: the last POST failed (logged once until one works). */
  private failing = false;
  private droppedSamples = 0;

  constructor(private readonly options: RelayUplinkOptions) {
    this.fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.timing = { ...DEFAULT_TIMING, ...options.timing };
    this.trips = new RoundTrips(this.timing.statsMs);
    if (!options.tryStreaming) {
      this.current = "chunked";
      options.log("uplink: chunked");
      return;
    }
    const canStream = options.canStream ?? canStreamRequests();
    const fellBackRecently = streamingFellBackAt > 0 && Date.now() - streamingFellBackAt < STREAMING_RETRY_AFTER_MS;
    this.current = canStream && !fellBackRecently ? "streaming" : "chunked";
    if (!canStream) options.log("uplink: chunked (fallback: this browser cannot stream a request body)");
    else if (fellBackRecently) options.log("uplink: chunked (streaming did not get through on an earlier call)");
  }

  get mode(): RelayUplinkMode {
    return this.current;
  }

  /** Opens the first stream (streaming), so the connection is ready before the first audio. */
  start(): void {
    if (this.current === "streaming" && !this.closed) void this.streamLoop();
  }

  /** A block of audio (mono 16-bit PCM at REP_RELAY_SAMPLE_RATE). */
  send(pcm: Int16Array): void {
    if (this.closed) return;
    const dropped = this.outbox.push(pcm);
    if (dropped) {
      if (!this.droppedSamples) this.options.log("uplink: audio is backing up; dropping the oldest");
      this.droppedSamples += dropped;
    }
    if (this.current === "streaming") wake(this.upload);
    else this.postChunks();
  }

  /** Drops what is waiting (muted, or nobody to hear it). */
  clear(): void {
    this.outbox.clear();
  }

  /** The relay's `uplink` event: the open stream's audio arrives. */
  heard(): void {
    const upload = this.upload;
    if (!upload || upload.heard) return;
    upload.heard = true;
    clearTimeout(upload.ack);
    if (!this.announced) {
      this.announced = true;
      this.options.log("uplink: streaming");
    }
  }

  /** Stops sending; what is queued is dropped. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.outbox.clear();
    const upload = this.upload;
    this.upload = null;
    if (upload) {
      upload.ending = true;
      wake(upload);
      upload.abort.abort();
    }
    if (this.droppedSamples) {
      this.options.log(`uplink: dropped ${Math.round((this.droppedSamples / REP_RELAY_SAMPLE_RATE) * 1000)} ms of audio that could not go up in time`);
    }
  }

  // --- streaming ---

  private async streamLoop(): Promise<void> {
    while (!this.closed && this.current === "streaming") {
      const started = Date.now();
      const attempt = await this.streamOnce();
      if (this.closed) return;
      const next = streamDecision(this.state, attempt);
      this.state = { worked: next.worked, failures: next.failures };
      if (next.fallBack) return this.fallBack(attempt.error ?? "streaming failed");
      if (attempt.error) this.options.log(`uplink: the stream failed (${attempt.error}); opening another`);
      const { backoffMs } = this.timing;
      const wait = attempt.error
        ? backoffMs[Math.min(next.failures - 1, backoffMs.length - 1)]!
        : Date.now() - started < QUICK_END_MS
          ? backoffMs[0]!
          : 0;
      if (wait) await sleep(wait);
    }
  }

  /**
   * One upload stream, until its request ends — or until it is rotated out,
   * when the next starts at once while this one's body finishes.
   */
  private streamOnce(): Promise<StreamAttempt> {
    return new Promise((resolve) => {
      const upload: Upload = { abort: new AbortController(), ending: false, wake: null, delivered: false, heard: false, ack: undefined, notHeard: null };
      this.upload = upload;
      let settled = false;
      const settle = (error: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(rotate);
        clearTimeout(upload.ack);
        if (this.upload === upload) this.upload = null;
        resolve({ heard: upload.heard, error });
      };
      const rotate = setTimeout(() => {
        // Still waiting to be heard: the ack wait decides.
        if (upload.delivered && !upload.heard) return;
        upload.ending = true;
        wake(upload);
        setTimeout(() => upload.abort.abort(), ROTATED_ABORT_MS);
        settle(null);
      }, this.timing.rotateMs);
      const body = new ReadableStream<Uint8Array>(
        {
          pull: (controller) => this.pull(upload, controller),
          cancel: () => {
            upload.ending = true;
            wake(upload);
          },
        },
        // Read only when the network asks: until then audio waits in the capped outbox.
        { highWaterMark: 0 },
      );
      const init = {
        method: "POST",
        headers: { ...this.options.headers, "Content-Type": "application/octet-stream", [REP_RELAY_STREAM_HEADER]: "1" },
        body,
        duplex: "half",
        signal: upload.abort.signal,
      };
      this.fetch(this.options.url, init as RequestInit).then(
        (response) => {
          void response.body?.cancel().catch(() => {});
          if (!response.ok) settle(`AgentSDR answered ${response.status}`);
          else settle(upload.delivered && !upload.heard ? "AgentSDR did not hear its audio" : null);
        },
        (error: unknown) => settle(upload.notHeard ?? describe(error)),
      );
    });
  }

  /** The stream's body asks for more: everything queued, or wait for it. */
  private async pull(upload: Upload, controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
    for (;;) {
      if (upload.ending || this.closed) {
        try {
          controller.close();
        } catch {
          // Cancelled already.
        }
        return;
      }
      const bytes = this.upload === upload ? this.outbox.take() : null;
      if (bytes) {
        controller.enqueue(bytes);
        this.delivered(upload);
        return;
      }
      await new Promise<void>((resolve) => (upload.wake = resolve));
    }
  }

  private delivered(upload: Upload): void {
    if (upload.delivered) return;
    upload.delivered = true;
    if (upload.heard) return;
    upload.ack = setTimeout(() => {
      if (upload.heard) return;
      upload.notHeard = `AgentSDR did not hear its audio in ${this.timing.ackMs / 1000} s`;
      upload.abort.abort();
    }, this.timing.ackMs);
  }

  private fallBack(reason: string): void {
    this.current = "chunked";
    streamingFellBackAt = Date.now();
    this.options.log(`uplink: chunked (fallback: ${reason})`);
    const upload = this.upload;
    this.upload = null;
    upload?.abort.abort();
    this.postChunks();
  }

  // --- chunked ---

  /** POSTs what is queued as soon as there is a chunk of it, up to MAX_CHUNKS_IN_FLIGHT at once. */
  private postChunks(): void {
    while (!this.closed && this.inFlight < MAX_CHUNKS_IN_FLIGHT && this.outbox.size >= CHUNK_SAMPLES) {
      const body = this.outbox.take()!;
      const seq = (this.lastSeq = Math.max(this.lastSeq + 1, Date.now()));
      const started = Date.now();
      this.inFlight += 1;
      this.fetch(withRelaySeq(this.options.url, seq), {
        method: "POST",
        headers: { ...this.options.headers, "Content-Type": "application/octet-stream" },
        body,
      })
        .then((response) => {
          if (!response.ok) throw new Error(`AgentSDR answered ${response.status}`);
          const summary = this.trips.add(Date.now() - started, Date.now());
          if (summary) this.options.log(`uplink: ${summary}`);
          if (this.failing) {
            this.failing = false;
            this.options.log("uplink: sending works again");
          }
        })
        .catch((error: unknown) => {
          // Real-time audio: what did not get through is not sent again.
          if (!this.failing && !this.closed) {
            this.failing = true;
            this.options.log(`uplink: could not send audio: ${describe(error)}`);
          }
        })
        .finally(() => {
          this.inFlight -= 1;
          this.postChunks();
        });
    }
  }
}

function wake(upload: Upload | null): void {
  const resolve = upload?.wake;
  if (!upload || !resolve) return;
  upload.wake = null;
  resolve();
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
