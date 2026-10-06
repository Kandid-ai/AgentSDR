"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { subscribeToCallUpdates } from "@/lib/calls/client";
import type { RecorderCallPhase } from "@/lib/calls/contract";

/**
 * The latest phase the recorder extension has pushed for `callId` in this
 * tab, or null before any update arrives (or when `callId` is null). Resets
 * to null whenever `callId` changes, so a stale phase from a previous call
 * never leaks onto a new one.
 */
export function useLiveCall(callId: string | null): RecorderCallPhase | null {
  const [phase, setPhase] = useState<RecorderCallPhase | null>(null);

  useEffect(() => {
    setPhase(null);
    if (!callId) return;
    return subscribeToCallUpdates((update) => {
      if (update.callId === callId) setPhase(update.phase);
    });
  }, [callId]);

  return phase;
}

/** Whichever call, by id, most recently pushed a phase update in this tab. */
export type LatestLiveCall = { callId: string; phase: RecorderCallPhase };

/**
 * The most recently updated call in this tab, id included. A caller may not
 * yet know which call id to watch — e.g. a panel opened before its first
 * poll has resolved the contact's calls — so this bridges that gap: whatever
 * call the extension is actively reporting on, whoever placed it.
 */
export function useLatestLiveCall(): LatestLiveCall | null {
  const [latest, setLatest] = useState<LatestLiveCall | null>(null);

  useEffect(() => {
    return subscribeToCallUpdates((update) => {
      setLatest({ callId: update.callId, phase: update.phase });
    });
  }, []);

  return latest;
}
