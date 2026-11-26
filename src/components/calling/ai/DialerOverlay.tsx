"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RiPhoneLine, RiVolumeUpLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Modal from "@/components/alignui/modal";
import { CallRow, DialerRow } from "@/components/calls/callBarParts";
import { PickupGlow, usePickupGlow } from "@/components/calls/PickupAlerts";
import { PIP_WRAP_UP_HEIGHT, growPip, usePipWindow } from "@/components/calls/pipWindow";
import { remoteRepCallSnapshot, resumeRemoteRepAudio, subscribeRemoteRepCall } from "@/components/calls/remoteRepCall";
import { isRemoteRepOver } from "@/components/calls/remoteRepStage";
import { cn } from "@/utils/cn";
import { dismissDialerNotice, pauseDialer, startDialer, useDialer, type DialerSnapshot } from "./dialerController";
import { dialerLeadPhone, pipLayout } from "./dialerView";
import { WrapUpActions, WrapUpFields } from "./WrapUpForm";

/**
 * The dialer's UI that is not tied to a page, mounted once in the root layout
 * beside the call bar: the wrap-up on whatever page the rep is on, and the
 * pop-out window's contents while it is open (then the wrap-up is there
 * instead). The dialer itself runs in dialerController.ts.
 */
export function DialerOverlay() {
  const dialer = useDialer();
  const pip = usePipWindow();
  const { phase, wrapUp } = dialer;

  return (
    <>
      {!pip && phase.name === "wrap-up" && wrapUp && (
        <Modal.Root open>
          <Modal.Content
            hideClose
            size="max-w-xl"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <Modal.Header icon={RiPhoneLine}>
              <Modal.Title>How did the call go?</Modal.Title>
              <Modal.Description>{leadTitle(phase.lead)}</Modal.Description>
            </Modal.Header>
            <Modal.Body>
              <WrapUpFields wrapUp={wrapUp} />
            </Modal.Body>
            <Modal.Footer>
              <WrapUpActions wrapUp={wrapUp} />
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}
      {pip && createPortal(<DialerPip dialer={dialer} />, pip.document.body)}
    </>
  );
}

const leadTitle = (lead: { name: string; phone: string; company: string | null }) => `${lead.name || lead.phone}${lead.company ? ` · ${lead.company}` : ""}`;

/** The pop-out window: the call, the dialer, and the wrap-up, compact. */
function DialerPip({ dialer }: { dialer: DialerSnapshot }) {
  const call = useSyncExternalStore(subscribeRemoteRepCall, remoteRepCallSnapshot, () => null);
  const { phase, campaign, wrapUp } = dialer;
  const layout = pipLayout(phase, campaign, call);
  const glow = usePickupGlow(call?.stage ?? null);

  // Room for the form; where Chrome refuses the resize, the window scrolls.
  useEffect(() => {
    if (layout.showWrapUp) growPip(PIP_WRAP_UP_HEIGHT);
  }, [layout.showWrapUp]);

  const nothing = !layout.showCall && !layout.dialer && !layout.showWrapUp;
  return (
    <div className={cn("min-h-screen space-y-3 p-3 transition-colors", layout.live ? "bg-success-lighter" : "bg-bg-white-0")}>
      <PickupGlow glow={glow} />
      {layout.live && call && (
        <p role="status" className="rounded-xl bg-success-base px-3 py-2 text-label-md text-static-white">
          Picked up — talk now
        </p>
      )}
      {layout.showCall && call && (
        <div className={cn("rounded-xl p-2.5 ring-1 ring-inset", layout.live ? "bg-bg-white-0 ring-success-base" : "ring-stroke-soft-200")}>
          <CallRow call={call} phone={dialerLeadPhone(phase, call)} />
          {!isRemoteRepOver(call.stage) && call.audioBlocked && (
            <Button.Root variant="primary" mode="lighter" size="xxsmall" className="mt-2 w-full" onClick={resumeRemoteRepAudio}>
              <Button.Icon as={RiVolumeUpLine} />
              Click to hear them
            </Button.Root>
          )}
        </div>
      )}
      {layout.dialer && campaign && (
        <div className="rounded-xl p-2.5 ring-1 ring-inset ring-stroke-soft-200">
          <DialerRow
            campaignName={layout.dialer.campaignName}
            text={layout.dialer.text}
            button={layout.dialer.button}
            dismissible={layout.dialer.dismissible}
            onPause={pauseDialer}
            onStart={() => { startDialer(campaign); }}
            onDismiss={dismissDialerNotice}
          />
        </div>
      )}
      {layout.showWrapUp && wrapUp && phase.name === "wrap-up" && (
        <section aria-label="Wrap-up" className="space-y-3">
          <div>
            <h2 className="text-label-md text-text-strong-950">How did the call go?</h2>
            <p className="truncate text-paragraph-xs text-text-sub-600">{leadTitle(phase.lead)}</p>
          </div>
          <WrapUpFields wrapUp={wrapUp} compact />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <WrapUpActions wrapUp={wrapUp} />
          </div>
        </section>
      )}
      {nothing && <p className="py-6 text-center text-paragraph-sm text-text-sub-600">No call right now.</p>}
    </div>
  );
}
