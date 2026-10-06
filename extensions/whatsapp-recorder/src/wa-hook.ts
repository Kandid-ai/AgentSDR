/**
 * Records a WhatsApp Web call from inside the page. Runs in the page's own JS
 * world at document_start, before WhatsApp's code loads.
 *
 * What the probe established (29 Sep 2026): WhatsApp Web does not carry call
 * audio as WebRTC media tracks. Its own engine plays the other side through an
 * AudioWorklet connected to an AudioContext's destination, and reads the
 * microphone with getUserMedia — acquired when the call starts, stopped when
 * it ends, whoever hangs up. So the recording is assembled from exactly
 * those two points:
 *   - the other side: every node WhatsApp connects to a speaker destination
 *     is also connected into our recording graph (AudioNode.connect patch);
 *   - the rep: a clone of the call's microphone track.
 * Our graph lives in WhatsApp's own, already-running AudioContext, so
 * Chrome's autoplay policy never silences the recording.
 *
 * When: the recorder starts as soon as the call opens the microphone —
 * before the pick-up, so the lead's first words are never lost to the time it
 * takes to notice it. The pick-up is when the call timer appears; the timer
 * counts from it, so its reading dates the pick-up precisely even when it is
 * noticed a moment late. The recording stops when the timer disappears, End
 * call goes, or the microphone is released; a call never picked up is
 * discarded.
 *
 * Where: while its tab is in the background, WhatsApp moves the call UI into
 * a Document Picture-in-Picture window (seen 29 Sep 2026). So End call and
 * the timer are looked for in the page and that window, and a missing End
 * call must stay missing a few checks running — the hand-over between the
 * two must not read as a hang-up. A timer is a m:ss text near End call that changes — a voice
 * note's static "0:12" never ticks. If no timer shows within a minute of the
 * mic opening, recording starts anyway, in case WhatsApp's markup changed.
 *
 * Nothing is recorded unless wa-agent armed this tab for a call placed from
 * AgentSDR — the rep's own calls are never touched.
 */

import { AGENT_SOURCE, HOOK_SOURCE, type AgentToHook, type HookToAgent } from "./wa-protocol";

/**
 * A getUserMedia track stopped sooner than this was a permission check, not a
 * call. WhatsApp stops its check within the same millisecond (probe, 29 Sep
 * 2026), so this only needs to outlast that.
 */
const MIC_SETTLE_MS = 300;
const WATCH_INTERVAL_MS = 500;
const NO_TIMER_FALLBACK_MS = 60_000;
/**
 * How many checks running the timer, or End call, must be missing before the
 * call counts as over. Background tabs throttle intervals to 1 s, so this is
 * a few seconds — enough to ride out the move into picture-in-picture.
 */
const TIMER_GONE_CHECKS = 4;
const END_BUTTON_GONE_CHECKS = 4;
/** Armed this long with no call UI ever showing: the call was never placed. */
const ARMED_WITHOUT_CALL_MS = 90_000;
const TIMER_PATTERN = /^\d{1,2}:\d{2}(?::\d{2})?$/;
/** How far above End call to look for the timer before the search gets too wide. */
const MAX_TIMER_SEARCH_ELEMENTS = 400;
/** WhatsApp's hang-up control, by its label in the page or its picture-in-picture window. */
const END_CALL_LABEL = /end call|hang ?up|leave call/i;
const END_CALL_ICON = /call-end|end-call|hang-?up/i;
const STATUS_PATTERN = /^(calling|ringing|connecting|reconnecting)/i;
const STILL_RINGING = /^(calling|ringing)/i;
/**
 * A timer this young next to End call on the page is a call just picked up,
 * not a voice note's length — so it counts on first sight, without waiting to
 * see it tick. In the picture-in-picture window, which holds only the call,
 * any timer counts on first sight.
 */
const FRESH_TIMER_SECONDS = 10;

type Connect = (this: AudioNode, destination: AudioNode | AudioParam, output?: number, input?: number) => unknown;
type Disconnect = (this: AudioNode, destination: AudioNode) => void;

type Recording = { recorder: MediaRecorder; chunks: Blob[]; startedAt: number };

type Session = {
  callId: string;
  /** WhatsApp's own microphone track for the call. */
  micTrack: MediaStreamTrack;
  micClone: MediaStreamTrack;
  /** The context our recording graph lives in. */
  context: AudioContext;
  remoteBus: GainNode;
  output: MediaStreamAudioDestinationNode;
  /** Connections we added, undone when the call ends. */
  links: [AudioNode, AudioNode][];
  /** Other contexts' playback, bridged into `context` through a MediaStream. */
  bridges: Map<BaseAudioContext, MediaStreamAudioDestinationNode>;
  dialedAt: number;
  /** When the lead picked up; null while the call is still ringing. */
  answeredAt: number | null;
  lastTimerText: string | null;
  timerSeen: boolean;
  /** Checks running the (trusted) timer has not moved — a frozen timer means the call ended. */
  timerStill: number;
  sawEndButton: boolean;
  endButtonMissing: number;
  /** WhatsApp's last "Calling…" / "Ringing…" text, reported when it changes. */
  lastStatusText: string | null;
  /** Where the call UI was last seen, reported when it changes. */
  lastWhere: string | null;
  /** Running from the moment the call opened the microphone. */
  recording: Recording;
  watch: number;
};

const scope = window as unknown as { __agentsdrHook?: boolean };
if (!scope.__agentsdrHook) {
  scope.__agentsdrHook = true;
  install();
}

function install(): void {
  const nativeConnect = AudioNode.prototype.connect as unknown as Connect;
  const nativeDisconnect = AudioNode.prototype.disconnect as unknown as Disconnect;
  const nativeStop = MediaStreamTrack.prototype.stop;

  /** Nodes WhatsApp routes to the speakers, per context: the other side of the call. */
  const playback = new Map<BaseAudioContext, Set<AudioNode>>();
  let armedCallId: string | null = null;
  let session: Session | null = null;
  /** A call whose recording is being stopped and handed over (end() until "recording" is posted). */
  let finishingCallId: string | null = null;
  /** The call whose screen was last reported as shown, so it is reported once. */
  let callUiShownFor: string | null = null;

  function noteCallUi(callId: string): void {
    if (callUiShownFor === callId) return;
    callUiShownFor = callId;
    post({ source: HOOK_SOURCE, type: "call-ui", callId });
  }

  // --- instrumentation -------------------------------------------------------

  // Arguments pass through exactly as WhatsApp gave them: connect() is
  // overloaded (AudioNode, output, input) / (AudioParam, output), and an
  // extra trailing argument would steer Chrome to the wrong overload.
  AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
    const result = (nativeConnect as unknown as (...rest: unknown[]) => unknown).apply(this, args);
    const destination = args[0];
    if (destination instanceof AudioDestinationNode) {
      rememberPlayback(this);
      if (session) tap(session, this);
    }
    return result;
  } as unknown as typeof AudioNode.prototype.connect;

  MediaStreamTrack.prototype.stop = function (this: MediaStreamTrack) {
    nativeStop.call(this);
    if (session && this === session.micTrack) end();
  };

  const mediaDevices = navigator.mediaDevices;
  if (mediaDevices?.getUserMedia) {
    const getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      const stream = await getUserMedia(constraints);
      const track = stream.getAudioTracks()[0];
      if (track) setTimeout(() => begin(track), MIC_SETTLE_MS);
      return stream;
    };
  }

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as Partial<AgentToHook> | null;
    if (data?.source !== AGENT_SOURCE) return;
    if (data.type === "arm" && data.callId) arm(data.callId);
    else if (data.type === "disarm") armedCallId = null;
    else if (data.type === "resume-audio") resumeAudio();
    else if (data.type === "probe") post({ source: HOOK_SOURCE, type: "probe-result", callId: session?.callId ?? finishingCallId });
    else if (data.type === "end-call" && data.callId) {
      // Hang up with WhatsApp's own button; if the call is already over
      // there (hung up in WhatsApp, unseen), close it out here instead.
      const button = readCallUi().endButton;
      if (button) button.click();
      else if (session) end();
      else if (armedCallId) reportNotAnswered();
      post({ source: HOOK_SOURCE, type: "end-result", callId: data.callId, clicked: true });
    }
  });

  // --- before the call picks up the microphone --------------------------------
  // A call hung up while still "Calling…" may never open the microphone, so
  // there is no session to end. Watching the call UI from the moment the call
  // is armed catches it: seen, then gone, is a call that ended unanswered.

  let armedAt = 0;
  let armWatch = 0;
  let armSawCallUi = false;
  let armCallUiMissing = 0;

  function arm(callId: string): void {
    // A session whose call ended unseen would block this call's session.
    if (session && !readCallUi().present) end();
    armedCallId = callId;
    armedAt = Date.now();
    armSawCallUi = false;
    armCallUiMissing = 0;
    window.clearInterval(armWatch);
    armWatch = window.setInterval(watchArmed, WATCH_INTERVAL_MS);
  }

  function watchArmed(): void {
    if (!armedCallId || session) {
      window.clearInterval(armWatch);
      return;
    }
    if (readCallUi().present) {
      noteCallUi(armedCallId);
      armSawCallUi = true;
      armCallUiMissing = 0;
    } else if (armSawCallUi) {
      armCallUiMissing += 1;
    }
    const neverPlaced = !armSawCallUi && Date.now() - armedAt > ARMED_WITHOUT_CALL_MS;
    if (armCallUiMissing >= END_BUTTON_GONE_CHECKS || neverPlaced) reportNotAnswered();
  }

  function reportNotAnswered(): void {
    const callId = armedCallId;
    armedCallId = null;
    window.clearInterval(armWatch);
    if (callId) post({ source: HOOK_SOURCE, type: "not-answered", callId, dialedAt: armedAt, endedAt: Date.now() });
  }

  function rememberPlayback(node: AudioNode): void {
    for (const context of playback.keys()) if (context.state === "closed") playback.delete(context);
    const nodes = playback.get(node.context) ?? new Set<AudioNode>();
    nodes.add(node);
    playback.set(node.context, nodes);
  }

  // --- a call ----------------------------------------------------------------

  /** WhatsApp's microphone survived the settle delay: a call is dialing. */
  function begin(micTrack: MediaStreamTrack): void {
    if (!armedCallId || session || micTrack.readyState !== "live") return;
    const callId = armedCallId;
    let started: Recording | null = null;
    try {
      const context = newestPlaybackContext() ?? new AudioContext();
      const remoteBus = context.createGain();
      const merger = context.createChannelMerger(2);
      const output = context.createMediaStreamDestination();
      const micClone = micTrack.clone();
      const micSource = context.createMediaStreamSource(new MediaStream([micClone]));

      // Started at once, on the output stream: the graph is wired below
      // within the same task, so nothing is missed.
      const recording = startRecording(output);
      started = recording;

      const next: Session = {
        callId,
        micTrack,
        micClone,
        context,
        remoteBus,
        output,
        links: [],
        bridges: new Map(),
        dialedAt: Date.now(),
        answeredAt: null,
        lastTimerText: null,
        timerSeen: false,
        timerStill: 0,
        sawEndButton: false,
        endButtonMissing: 0,
        lastStatusText: null,
        lastWhere: null,
        recording,
        watch: 0,
      };
      // Each merger input is downmixed to mono: the rep left, the lead right.
      link(next, leveled(next, micSource), merger, 0);
      link(next, leveled(next, remoteBus), merger, 1);
      link(next, merger, output);
      for (const [playbackContext, nodes] of playback) {
        if (playbackContext.state !== "closed") for (const node of nodes) tap(next, node);
      }

      session = next;
      micTrack.addEventListener("ended", () => { if (session?.micTrack === micTrack) end(); });
      next.watch = window.setInterval(watch, WATCH_INTERVAL_MS);
      post({ source: HOOK_SOURCE, type: "dialing", callId });
      setTimeout(checkSuspended, 1500);
    } catch (error) {
      armedCallId = null;
      try {
        if (started && started.recorder.state !== "inactive") started.recorder.stop();
      } catch {
        // Nothing to keep; the call is reported failed below.
      }
      post({ source: HOOK_SOURCE, type: "recording-failed", callId, error: describe(error) });
    }
  }

  function watch(): void {
    const current = session;
    if (!current) return;
    const ui = readCallUi();
    const { timerText, statusText } = ui;
    if (ui.present) {
      noteCallUi(current.callId);
      current.sawEndButton = true;
      current.endButtonMissing = 0;
    } else if (current.sawEndButton) {
      current.endButtonMissing += 1;
    }
    const callUiGone = current.endButtonMissing >= END_BUTTON_GONE_CHECKS;
    if (ui.describe !== current.lastWhere) {
      current.lastWhere = ui.describe;
      post({ source: HOOK_SOURCE, type: "diag", callId: current.callId, text: ui.describe });
    }
    if (statusText && statusText !== current.lastStatusText) {
      current.lastStatusText = statusText;
      post({ source: HOOK_SOURCE, type: "call-status", callId: current.callId, text: statusText });
    }

    if (current.answeredAt === null) {
      // The call UI closed without the timer ever running: not answered.
      if (callUiGone) return end();
      const timerSeconds = timerText ? clockSeconds(timerText) : null;
      const pickedUp =
        timerText !== null &&
        (ui.inPip ||
          (timerSeconds !== null && timerSeconds <= FRESH_TIMER_SECONDS) ||
          (current.lastTimerText !== null && timerText !== current.lastTimerText));
      if (pickedUp) {
        // The timer counts from the pick-up: a 0:02 when noticed means about
        // two and a half seconds ago.
        const now = Date.now();
        answer(current, true, Math.max(current.recording.startedAt, now - (timerSeconds ?? 0) * 1000 - 500));
      } else if (Date.now() - current.dialedAt > NO_TIMER_FALLBACK_MS && !STILL_RINGING.test(statusText ?? "")) {
        // No timer seen in a minute — WhatsApp's markup may have changed, so
        // keep the recording rather than discard the call. Not while WhatsApp
        // itself still says "Calling…"/"Ringing…": that is a long ring.
        answer(current, false, current.recording.startedAt);
      }
      current.lastTimerText = timerText;
      return;
    }

    if (callUiGone) return end();
    // A running call's timer ticks every second. Where it can be trusted to
    // (see CallUi.timerTrusted), one that stops moving, or disappears, for
    // a few checks means the call ended — hung up anywhere, even when a stale
    // End call lingers on the page.
    if (current.timerSeen && ui.timerTrusted) {
      if (timerText && timerText !== current.lastTimerText) {
        current.lastTimerText = timerText;
        current.timerStill = 0;
      } else {
        current.timerStill += 1;
      }
      if (current.timerStill >= TIMER_GONE_CHECKS) end();
    }
  }

  /**
   * The lead picked up at `answeredAt`. The recorder is already running; this
   * only dates the pick-up, from the timer's reading or — without one — as
   * the start of the recording, so the whole of it is kept as the call.
   * `timerSeen` also decides how the call's end is recognised (see watch).
   */
  function answer(current: Session, timerSeen: boolean, answeredAt: number): void {
    current.answeredAt = answeredAt;
    current.timerSeen = timerSeen;
    post({ source: HOOK_SOURCE, type: "answered", callId: current.callId, answeredAt, timerSeen });
  }

  /** Records the call's stereo mix, in one-second chunks, from now until end(). */
  function startRecording(output: MediaStreamAudioDestinationNode): Recording {
    const recorder = new MediaRecorder(output.stream, { mimeType: recordingMimeType() });
    const recording: Recording = { recorder, chunks: [], startedAt: Date.now() };
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recording.chunks.push(event.data);
    };
    recorder.start(1000);
    return recording;
  }

  function end(): void {
    const current = session;
    if (!current) return;
    session = null;
    armedCallId = null; // one call per arming
    window.clearInterval(current.watch);
    const endedAt = Date.now();

    const recording = current.recording;
    const answeredAt = current.answeredAt;
    if (answeredAt === null) {
      // Never picked up: the ringing recorded so far is discarded.
      recording.recorder.ondataavailable = null;
      try {
        if (recording.recorder.state !== "inactive") recording.recorder.stop();
      } catch {
        // Already stopped; there is nothing to keep either way.
      }
      cleanup(current);
      post({ source: HOOK_SOURCE, type: "not-answered", callId: current.callId, dialedAt: current.dialedAt, endedAt });
      return;
    }
    finishingCallId = current.callId;
    let handedOver = false;
    const handOver = () => {
      if (handedOver) return;
      handedOver = true;
      cleanup(current);
      const blob = new Blob(recording.chunks, { type: recording.recorder.mimeType || recordingMimeType() });
      post({
        source: HOOK_SOURCE,
        type: "recording",
        callId: current.callId,
        blob,
        startedAt: recording.startedAt,
        answeredAt,
        endedAt,
      });
      // Kept a moment past the hand-over, so a probe landing before wa-agent
      // has started the upload still sees the call as busy.
      setTimeout(() => {
        if (finishingCallId === current.callId) finishingCallId = null;
      }, 2_000);
    };
    // A recorder Chrome already stopped (its source ended, or it errored)
    // has nothing left to flush and would throw on stop(): hand over what it
    // recorded instead of losing it.
    if (recording.recorder.state === "inactive") return handOver();
    recording.recorder.onstop = handOver;
    try {
      recording.recorder.stop();
    } catch {
      handOver();
    }
  }

  function cleanup(current: Session): void {
    nativeStop.call(current.micClone);
    for (const [from, to] of current.links) {
      try {
        nativeDisconnect.call(from, to);
      } catch {
        // Already gone with its context.
      }
    }
  }

  // --- the recording graph ---------------------------------------------------

  /** Feeds one of WhatsApp's speaker-bound nodes into the recording too. */
  function tap(current: Session, node: AudioNode): void {
    const source = node.context;
    if (source.state === "closed") return;
    if (source === current.context) return link(current, node, current.remoteBus);
    if (!(source instanceof AudioContext)) return;
    // Nodes cannot connect across contexts; a MediaStream can carry audio between them.
    let bridge = current.bridges.get(source);
    if (!bridge) {
      bridge = source.createMediaStreamDestination();
      current.bridges.set(source, bridge);
      link(current, current.context.createMediaStreamSource(bridge.stream), current.remoteBus);
    }
    link(current, node, bridge);
  }

  function link(current: Session, from: AudioNode, to: AudioNode, input?: number): void {
    nativeConnect.call(from, to, 0, input ?? 0);
    current.links.push([from, to]);
  }

  /**
   * Evens out one speaker's loudness in the recording (not in what the rep
   * hears): the raw mic sat ~6 dB above the call audio in the first tests.
   */
  function leveled(current: Session, source: AudioNode): AudioNode {
    const compressor = new DynamicsCompressorNode(current.context, {
      threshold: -40,
      knee: 20,
      ratio: 4,
      attack: 0.01,
      release: 0.25,
    });
    link(current, source, compressor);
    return compressor;
  }

  function newestPlaybackContext(): AudioContext | null {
    let newest: AudioContext | null = null;
    for (const context of playback.keys()) {
      if (context instanceof AudioContext && context.state !== "closed") newest = context;
    }
    return newest;
  }

  // --- audio that Chrome's autoplay policy held back --------------------------

  function checkSuspended(): void {
    const current = session;
    if (!current) return;
    const contexts = [current.context, ...playback.keys()];
    if (contexts.some((context) => context.state === "suspended")) {
      post({ source: HOOK_SOURCE, type: "audio-suspended", callId: current.callId });
    }
  }

  function resumeAudio(): void {
    const contexts = new Set<BaseAudioContext>(playback.keys());
    if (session) contexts.add(session.context);
    for (const context of contexts) {
      if (context instanceof AudioContext && context.state === "suspended") void context.resume();
    }
  }
}

/** The documents a call's UI can be in: the page, and WhatsApp's picture-in-picture window. */
function callDocuments(): Document[] {
  const documents: Document[] = [document];
  try {
    const pip = (window as unknown as { documentPictureInPicture?: { window: Window | null } }).documentPictureInPicture
      ?.window;
    if (pip && pip.document !== document) documents.push(pip.document);
  } catch {
    // No picture-in-picture support, or the window just closed.
  }
  return documents;
}

type CallUi = {
  /** The call UI is showing somewhere — End call found, or WhatsApp's picture-in-picture window open. */
  present: boolean;
  endButton: HTMLElement | null;
  timerText: string | null;
  statusText: string | null;
  /** A short account of what was found, for diagnosis. */
  describe: string;
  /** The call UI is WhatsApp's picture-in-picture window, which holds nothing but the call. */
  inPip: boolean;
  /**
   * Whether the timer is on screen and so keeps ticking: the picture-in-
   * picture window, or the page while its tab is visible. A hidden page may
   * render lazily, so its timer is not evidence either way.
   */
  timerTrusted: boolean;
};

/**
 * Reads the call UI, preferring WhatsApp's picture-in-picture window. On 29
 * Sep 2026 a call answered after it moved there was never seen as answered:
 * the page went on showing an End call but no running timer, so the page's
 * copy is not to be trusted once that window is open. That window holds nothing but the
 * call, so its whole text is searched for the timer; on the page the search
 * stays next to End call, away from voice-note durations in the chat.
 */
function readCallUi(): CallUi {
  const pip = callDocuments()[1] ?? null;
  if (pip?.body) {
    const texts = textsIn(pip.body);
    const endButton = findEndButtonIn(pip) ?? findEndButtonIn(document);
    const labels = Array.from(pip.querySelectorAll("[aria-label]"))
      .map((element) => element.getAttribute("aria-label"))
      .filter(Boolean)
      .slice(0, 12);
    return {
      present: true,
      inPip: true,
      timerTrusted: true,
      endButton,
      timerText: texts.find((text) => TIMER_PATTERN.test(text)) ?? null,
      statusText: texts.find((text) => STATUS_PATTERN.test(text)) ?? null,
      describe: `call UI in picture-in-picture; End call ${endButton ? "found" : "NOT found"}; labels: ${labels.join(" | ") || "none"}`,
    };
  }
  const endButton = findEndButtonIn(document);
  return {
    present: Boolean(endButton),
    inPip: false,
    timerTrusted: document.visibilityState === "visible",
    endButton,
    timerText: endButton ? findTimerText(endButton) : null,
    statusText: endButton ? findStatusText(endButton) : null,
    describe: endButton ? "call UI in the WhatsApp page" : "no call UI found",
  };
}

function findEndButtonIn(doc: Document): HTMLElement | null {
  for (const element of Array.from(doc.querySelectorAll<HTMLElement>("button[aria-label], [role='button'][aria-label]"))) {
    if (END_CALL_LABEL.test(element.getAttribute("aria-label") ?? "")) return element;
  }
  for (const icon of Array.from(doc.querySelectorAll<HTMLElement>("[data-icon]"))) {
    if (END_CALL_ICON.test(icon.getAttribute("data-icon") ?? "")) {
      return icon.closest<HTMLElement>("button, [role='button']") ?? icon;
    }
  }
  return null;
}

function textsIn(root: HTMLElement): string[] {
  const texts: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text) texts.push(text);
  }
  return texts;
}

/** The call timer's current text near End call, or null. */
function findTimerText(endButton: HTMLElement): string | null {
  let container: HTMLElement | null = endButton.parentElement;
  while (container) {
    const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? "";
      if (TIMER_PATTERN.test(text)) return text;
    }
    const parent: HTMLElement | null = container.parentElement;
    if (!parent || parent.getElementsByTagName("*").length > MAX_TIMER_SEARCH_ELEMENTS) return null;
    container = parent;
  }
  return null;
}

/** WhatsApp's own call-state line near End call ("Calling…", "Ringing…"), for timing. */
function findStatusText(endButton: HTMLElement): string | null {
  let container: HTMLElement | null = endButton.parentElement;
  while (container) {
    const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? "";
      if (STATUS_PATTERN.test(text)) return text;
    }
    const parent: HTMLElement | null = container.parentElement;
    if (!parent || parent.getElementsByTagName("*").length > MAX_TIMER_SEARCH_ELEMENTS) return null;
    container = parent;
  }
  return null;
}

/** Seconds shown by a call timer: "0:07" → 7, "1:02:03" → 3723. */
function clockSeconds(text: string): number | null {
  const parts = text.split(":").map(Number);
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Ogg/Opus where Chrome can record it, else WebM; transcription accepts both. */
function recordingMimeType(): string {
  const ogg = "audio/ogg;codecs=opus";
  return MediaRecorder.isTypeSupported(ogg) ? ogg : "audio/webm;codecs=opus";
}

function post(message: HookToAgent): void {
  window.postMessage(message, location.origin);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
