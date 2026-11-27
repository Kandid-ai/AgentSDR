"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { RiVolumeUpLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import { cn } from "@/utils/cn";
import { dismissDialerNotice, pauseDialer, useDialer } from "@/components/calling/ai/dialerController";
import { dialerStatus } from "@/components/calling/ai/dialerSessionText";
import { dialerCampaignHref, dialerLeadPhone } from "@/components/calling/ai/dialerView";
import { CallRow, DialerRow, PopOutButton } from "./callBarParts";
import { PickupAlerts } from "./PickupAlerts";
import { barTone } from "./pickupAlert";
import { openPip, usePipSupported, usePipWindow } from "./pipWindow";
import { dismissRemoteRepCall, remoteRepCallSnapshot, resumeRemoteRepAudio, subscribeRemoteRepCall } from "./remoteRepCall";
import { isRemoteRepOver } from "./remoteRepStage";

/** A call that ended normally leaves the bar after this; a failure stays until dismissed. */
const ENDED_HIDE_MS = 10_000;

const BAR = "pointer-events-auto fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-md rounded-2xl p-3 shadow-regular-md ring-1 ring-inset animate-in fade-in-0 slide-in-from-bottom-2 sm:inset-x-auto sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2";

/**
 * The floating bar for a call the rep talks on through a calling number
 * (remoteRepCall.ts): who, where it stands, mute and hang up; between the
 * calls of a running dialer, what the dialer is doing. Mounted once in the
 * root layout, so it stays on screen across pages. Its rows are shared with
 * the pop-out window (callBarParts.tsx, DialerOverlay.tsx).
 */
export function RemoteRepCallBar() {
  const call = useSyncExternalStore(subscribeRemoteRepCall, remoteRepCallSnapshot, () => null);
  const { campaign, phase, wrapUp } = useDialer();
  const pipSupported = usePipSupported();
  const pip = usePipWindow();
  const popOut = pipSupported && !pip ? () => void openPip() : null;

  const stage = call?.stage;
  useEffect(() => {
    if (stage !== "ended") return;
    const timer = window.setTimeout(dismissRemoteRepCall, ENDED_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  // The wrap-up dialog (DialerOverlay) is the whole story then; the bar would only cover its buttons.
  if (!pip && phase.name === "wrap-up" && wrapUp) return <PickupAlerts />;

  // A running dialer keeps the bar up between calls: once a call is over, its status (and Pause) take the bar.
  const status = campaign ? dialerStatus(phase) : null;
  if (campaign && status && (!call || isRemoteRepOver(call.stage))) {
    return (
      <>
        <PickupAlerts />
        <div role="region" aria-label="Dialer" className={cn(BAR, "bg-bg-white-0 ring-stroke-soft-200")}>
          <DialerRow
            campaignName={campaign.name}
            text={status.text}
            button={status.canPause ? "pause" : null}
            dismissible={status.dismissible}
            onPause={pauseDialer}
            onDismiss={dismissDialerNotice}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <Link href={dialerCampaignHref(campaign.id)} className="text-paragraph-xs text-primary-base underline-offset-2 hover:underline">
              Open the Dialer tab
            </Link>
            {popOut && <PopOutButton onClick={popOut} />}
          </div>
        </div>
      </>
    );
  }
  if (!call) return <PickupAlerts />;
  const over = isRemoteRepOver(call.stage);
  const tone = barTone(call.stage);

  return (
    <>
      <PickupAlerts />
      <div
        role="region"
        aria-label="Call"
        // pointer-events-auto: a modal (the lead drawer) sets pointer-events: none on <body>.
        className={cn(BAR, tone === "live" ? "bg-success-lighter ring-success-base" : "bg-bg-white-0 ring-stroke-soft-200")}
      >
        <CallRow call={call} phone={dialerLeadPhone(phase, call)} />
        {!over && call.audioBlocked && (
          <Button.Root variant="primary" mode="lighter" size="xxsmall" className="mt-2 w-full" onClick={resumeRemoteRepAudio}>
            <Button.Icon as={RiVolumeUpLine} />
            The browser paused the call audio — click to hear them
          </Button.Root>
        )}
        {((!over && call.stage !== "mic") || popOut) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-paragraph-xs text-text-soft-400">
              {over || call.stage === "mic" ? "" : call.stage === "on-call" ? "Use headphones for the best sound." : "Keep this tab open — the call runs through it. Use headphones for the best sound."}
            </p>
            {popOut && <PopOutButton onClick={popOut} />}
          </div>
        )}
      </div>
    </>
  );
}
