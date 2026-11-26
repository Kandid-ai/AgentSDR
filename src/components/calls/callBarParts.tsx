"use client";

import { useEffect, useState } from "react";
import { RiCloseLine, RiErrorWarningLine, RiLoader4Line, RiMicLine, RiMicOffLine, RiPauseCircleLine, RiPhoneFill, RiPictureInPicture2Line, RiPlayCircleLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import { cn } from "@/utils/cn";
import { formatElapsed } from "./formatElapsed";
import { barTone, leadLine } from "./pickupAlert";
import { dismissRemoteRepCall, hangUpRemoteRepCall, setRemoteRepMuted, type RemoteRepCallState } from "./remoteRepCall";
import { isRemoteRepOver } from "./remoteRepStage";

/**
 * The pieces of the call bar, shared by the bar in the page (RemoteRepCallBar)
 * and the pop-out window (DialerPip): the call's row and the dialer's row.
 * No positioning here; the containers place them.
 */

/** Who, where the call stands, mute and hang up (or close, once it is over). `phone`: the lead's number, when known. */
export function CallRow({ call, phone = null }: { call: RemoteRepCallState; phone?: string | null }) {
  const [hangingUp, setHangingUp] = useState(false);
  const over = isRemoteRepOver(call.stage);
  const tone = barTone(call.stage);

  const hangUp = async () => {
    setHangingUp(true);
    try {
      await hangUpRemoteRepCall();
    } finally {
      setHangingUp(false);
    }
  };

  const from = [phone, call.numberName ? `from ${call.numberName}` : null].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3">
      <StageIcon call={call} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-label-sm text-text-strong-950">
          {leadLine(call.leadName, call.leadCompany)}
          {from && <span className="font-normal text-text-soft-400"> · {from}</span>}
        </p>
        <p aria-live="polite" className={cn("text-paragraph-xs", call.stage === "error" ? "text-error-dark" : tone === "live" ? "text-label-sm text-success-dark" : "text-text-sub-600")}>
          <StageText call={call} />
        </p>
      </div>
      {!over ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button.Root
            variant="neutral"
            mode="stroke"
            size="xsmall"
            aria-pressed={call.muted}
            aria-label={call.muted ? "Unmute" : "Mute"}
            title={call.muted ? "Unmute" : "Mute"}
            disabled={call.stage === "mic"}
            onClick={() => setRemoteRepMuted(!call.muted)}
          >
            <Button.Icon as={call.muted ? RiMicOffLine : RiMicLine} className={cn(call.muted && "text-error-base")} />
          </Button.Root>
          <Button.Root variant="error" mode="filled" size="xsmall" disabled={call.stage === "mic" || hangingUp} onClick={() => void hangUp()}>
            <Button.Icon as={hangingUp ? RiLoader4Line : RiPhoneFill} className={cn("rotate-[135deg]", hangingUp && "animate-spin")} />
            {call.stage === "on-call" ? "Hang up" : "Cancel"}
          </Button.Root>
        </div>
      ) : (
        <Button.Root variant="neutral" mode="ghost" size="xsmall" aria-label="Close" title="Close" onClick={dismissRemoteRepCall}>
          <Button.Icon as={RiCloseLine} />
        </Button.Root>
      )}
    </div>
  );
}

/** The dialer between calls (or beside the call in the pop-out): what it is doing, and Pause / Start / close. */
export function DialerRow({
  campaignName,
  text,
  button,
  dismissible,
  onPause,
  onStart,
  onDismiss,
}: {
  campaignName: string;
  text: string | null;
  button: "pause" | "start" | null;
  dismissible: boolean;
  onPause: () => void;
  onStart?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <RiLoader4Line className={cn("size-4 shrink-0 text-text-sub-600", button === "pause" && "animate-spin")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-label-sm text-text-strong-950">
          Dialer<span className="font-normal text-text-soft-400"> · {campaignName}</span>
        </p>
        {text && <p aria-live="polite" className="text-paragraph-xs text-text-sub-600">{text}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {button === "pause" ? (
          <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={onPause}>
            <Button.Icon as={RiPauseCircleLine} />
            Pause
          </Button.Root>
        ) : button === "start" && onStart ? (
          <Button.Root variant="primary" mode="filled" size="xsmall" onClick={onStart}>
            <Button.Icon as={RiPlayCircleLine} />
            Start
          </Button.Root>
        ) : null}
        {dismissible && (
          <Button.Root variant="neutral" mode="ghost" size="xsmall" aria-label="Close" title="Close" onClick={onDismiss}>
            <Button.Icon as={RiCloseLine} />
          </Button.Root>
        )}
      </div>
    </div>
  );
}

/** Opens the always-on-top pop-out window. */
export function PopOutButton({ onClick }: { onClick: () => void }) {
  return (
    <Button.Root variant="neutral" mode="ghost" size="xxsmall" onClick={onClick} title="Keep the call on top of your other windows">
      <Button.Icon as={RiPictureInPicture2Line} />
      Pop out
    </Button.Root>
  );
}

function StageIcon({ call }: { call: RemoteRepCallState }) {
  if (call.stage === "on-call") {
    return (
      <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-base opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-success-base" />
      </span>
    );
  }
  if (call.stage === "error") return <RiErrorWarningLine className="size-4 shrink-0 text-error-base" aria-hidden="true" />;
  if (call.stage === "ended") return <RiPhoneFill className="size-4 shrink-0 rotate-[135deg] text-text-soft-400" aria-hidden="true" />;
  return <RiLoader4Line className="size-4 shrink-0 animate-spin text-text-sub-600" aria-hidden="true" />;
}

function StageText({ call }: { call: RemoteRepCallState }) {
  const number = call.numberName ?? "the number";
  switch (call.stage) {
    case "mic":
      return <>Getting your microphone…</>;
    case "placing":
      return <>Placing the call…</>;
    case "waiting":
      return <>Waiting for {number} to be free…</>;
    case "opening":
      return <>Opening {number}&apos;s WhatsApp…</>;
    case "dialing":
      return <>Calling…</>;
    case "ringing":
      return <>Ringing…</>;
    case "on-call":
      return (
        <>
          On call · <OnCallTimer answeredAt={call.answeredAt} />
          {call.muted && " · muted"}
          {call.unstable && " · connection unstable…"}
        </>
      );
    case "ended":
    case "error":
      return <>{call.message ?? (call.stage === "error" ? "The call failed" : "Call ended")}</>;
  }
}

function OnCallTimer({ answeredAt }: { answeredAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return <span className="tabular-nums">{answeredAt ? formatElapsed(now - answeredAt) : "0:00"}</span>;
}
