"use client";

/**
 * Plays the lead's voice so the browser's echo canceller hears it.
 *
 * Chrome's echo canceller (getUserMedia's echoCancellation) takes only audio
 * that arrived over WebRTC as the far end; Web Audio played straight to the
 * speakers is not, so without headphones the rep's microphone would send the
 * lead their own voice back. So the playback graph goes through a loopback
 * WebRTC connection inside this page — two RTCPeerConnections, host
 * candidates only, descriptions handed across directly — and out of an
 * <audio> element as a "remote" track. Nothing leaves the machine.
 *
 * If the loopback does not connect within `timeoutMs`, the graph plays
 * straight to the speakers instead (and the rep had better wear headphones).
 */

const CONNECT_TIMEOUT_MS = 2_000;

export type PlaybackRoute = {
  mode: "loopback" | "direct";
  /** Tries playing again after the browser's autoplay rules held it back; resolves false if still blocked. */
  resume(): Promise<boolean>;
  close(): void;
};

export async function routePlayback(
  context: AudioContext,
  source: AudioNode,
  { timeoutMs = CONNECT_TIMEOUT_MS, onBlocked }: { timeoutMs?: number; onBlocked?: (blocked: boolean) => void } = {},
): Promise<PlaybackRoute> {
  if (typeof RTCPeerConnection !== "undefined" && typeof context.createMediaStreamDestination === "function") {
    try {
      return await loopback(context, source, timeoutMs, onBlocked);
    } catch (error) {
      console.warn("Call audio: the echo-cancelling loopback did not connect; playing directly", error);
    }
  }
  source.connect(context.destination);
  return {
    mode: "direct",
    resume: async () => {
      await context.resume().catch(() => {});
      return context.state === "running";
    },
    close: () => {
      try {
        source.disconnect(context.destination);
      } catch {
        // Already disconnected.
      }
    },
  };
}

async function loopback(
  context: AudioContext,
  source: AudioNode,
  timeoutMs: number,
  onBlocked?: (blocked: boolean) => void,
): Promise<PlaybackRoute> {
  const destination = context.createMediaStreamDestination();
  source.connect(destination);
  const sender = new RTCPeerConnection({ iceServers: [] });
  const receiver = new RTCPeerConnection({ iceServers: [] });
  const audio = document.createElement("audio");
  audio.autoplay = true;
  const close = () => {
    sender.close();
    receiver.close();
    audio.pause();
    audio.srcObject = null;
    try {
      source.disconnect(destination);
    } catch {
      // Already disconnected.
    }
  };

  try {
    sender.onicecandidate = (event) => {
      if (event.candidate) void receiver.addIceCandidate(event.candidate).catch(() => {});
    };
    receiver.onicecandidate = (event) => {
      if (event.candidate) void sender.addIceCandidate(event.candidate).catch(() => {});
    };
    const play = async () => {
      try {
        await audio.play();
        onBlocked?.(false);
        return true;
      } catch {
        onBlocked?.(true);
        return false;
      }
    };
    receiver.ontrack = (event) => {
      // A loopback inside the page has no network jitter: ask for the smallest
      // jitter buffer (Chrome otherwise holds some tens of ms more of the lead's voice).
      try {
        const rtp = event.receiver as unknown as { jitterBufferTarget?: number | null; playoutDelayHint?: number | null };
        // jitterBufferTarget (ms) where supported (null until set), else the older playoutDelayHint (s).
        if (rtp.jitterBufferTarget !== undefined) rtp.jitterBufferTarget = 0;
        else rtp.playoutDelayHint = 0;
      } catch {
        // Not supported: the default buffer.
      }
      audio.srcObject = new MediaStream([event.track]);
      void play();
    };
    for (const track of destination.stream.getAudioTracks()) sender.addTrack(track, destination.stream);

    const connected = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`not connected after ${timeoutMs} ms`)), timeoutMs);
      sender.onconnectionstatechange = () => {
        if (sender.connectionState === "connected") {
          clearTimeout(timer);
          resolve();
        } else if (sender.connectionState === "failed") {
          clearTimeout(timer);
          reject(new Error("connection failed"));
        }
      };
    });
    await sender.setLocalDescription(await sender.createOffer());
    await receiver.setRemoteDescription(sender.localDescription!);
    await receiver.setLocalDescription(await receiver.createAnswer());
    await sender.setRemoteDescription(receiver.localDescription!);
    await connected;
    return { mode: "loopback", resume: play, close };
  } catch (error) {
    close();
    throw error;
  }
}
