"use client";

/**
 * A call's recording, starting at the pick-up. Recordings begin when the call
 * opens the microphone, so they open with the ringing before the lead
 * answered (recordingOffsetMs); the player skips it once the audio loads.
 * The rep can still scrub back to hear it.
 */
export function RecordingPlayer({ callId, offsetMs }: { callId: string; offsetMs: number | null }) {
  const start = offsetMs && offsetMs > 0 ? offsetMs / 1000 : 0;
  return (
    <audio
      controls
      preload="none"
      src={`/api/calls/${callId}/recording`}
      className="w-full"
      onLoadedMetadata={(event) => {
        if (start > 0 && event.currentTarget.currentTime < start) event.currentTarget.currentTime = start;
      }}
    />
  );
}
