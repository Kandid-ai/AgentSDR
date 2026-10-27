"use client";

import { useCallback, useEffect, useState } from "react";
import { RiArrowDownSLine, RiChat1Line, RiLoader4Line, RiPhoneLine, RiPlayCircleLine, RiStopCircleLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Modal from "@/components/alignui/modal";
import { AgentOutcomeLine } from "@/components/calls/AgentOutcomeLine";
import { RecordingPlayer } from "@/components/calls/RecordingPlayer";
import { formatOffset } from "@/components/calls/formatElapsed";
import { Skeleton } from "@/components/page/Skeletons";
import type { AiLeadDetail, AiLeadTimelineEntry } from "@/lib/calls/aiCampaigns/api";
import { getAiLead, updateAiLead } from "@/lib/calls/aiCampaigns/client";
import { getCall } from "@/lib/calls/client";
import type { CallDetail } from "@/lib/calls/contract";
import { cn } from "@/utils/cn";
import { AiStatusBadge, errorText, formatCallLength, formatWhen } from "./aiShared";

const RESULT_LABEL = {
  conversation: "Had a conversation",
  no_answer: "No answer",
  not_on_whatsapp: "Not on WhatsApp",
  error: "Error",
} as const;

/** A lead's side sheet: where it stands and the timeline of every call and message the campaign sent. */
export function AiLeadDrawer({
  campaignId,
  contactId,
  onClose,
  onChanged,
}: {
  campaignId: string;
  contactId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<AiLeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await getAiLead(campaignId, contactId));
      setError(null);
    } catch (cause) {
      setError(errorText(cause, "Could not load the lead"));
    }
  }, [campaignId, contactId]);

  useEffect(() => {
    // Fetch on open; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(action: "stop" | "requeue") {
    setBusy(true);
    setError(null);
    try {
      await updateAiLead(campaignId, contactId, { action });
      await load();
      onChanged();
    } catch (cause) {
      setError(errorText(cause, "Could not update the lead"));
    } finally {
      setBusy(false);
    }
  }

  const lead = detail?.lead ?? null;
  const open = lead && ["queued", "reaching", "callback", "chasing"].includes(lead.status);
  const requeueable = lead && (lead.status === "failed" || lead.status === "unreached" || (lead.status === "stopped" && (lead.note ?? "").startsWith("Stopped by ")));

  return (
    <Modal.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Modal.SideContent size="max-w-xl">
        <Modal.Header>
          <div className="min-w-0">
            <Modal.Title className="truncate">{lead ? lead.name || "Unnamed lead" : "Loading…"}</Modal.Title>
            <Modal.Description className="mt-0.5 truncate text-paragraph-xs tabular-nums text-text-sub-600">
              {lead ? [lead.phone, lead.title, lead.companyName].filter(Boolean).join(" · ") : " "}
            </Modal.Description>
          </div>
        </Modal.Header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-lg bg-error-lighter px-3 py-2 text-paragraph-xs text-error-dark ring-1 ring-inset ring-error-light">{error}</p>}
          {!lead ? (
            !error && (
              <div aria-busy="true" aria-label="Loading" className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            )
          ) : (
            <>
              <section className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AiStatusBadge status={lead.status} />
                  {lead.currentStep && <span className="text-paragraph-sm text-text-sub-600">{lead.currentStep}</span>}
                  {lead.numberName && <span className="text-paragraph-xs text-text-soft-400">from {lead.numberName}</span>}
                </div>
                {lead.nextAt && <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>Next action {formatWhen(lead.nextAt)}</p>}
                {lead.note && <p className="text-paragraph-sm text-text-sub-600">{lead.note}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {open && (
                    <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy} onClick={() => void act("stop")}>
                      <Button.Icon as={busy ? RiLoader4Line : RiStopCircleLine} className={cn(busy && "animate-spin")} />
                      Stop this lead
                    </Button.Root>
                  )}
                  {requeueable && (
                    <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy} onClick={() => void act("requeue")}>
                      <Button.Icon as={busy ? RiLoader4Line : RiPlayCircleLine} className={cn(busy && "animate-spin")} />
                      Queue again
                    </Button.Root>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-label-sm text-text-strong-950">Timeline</h3>
                {detail!.timeline.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-bg-weak-50 p-4 text-paragraph-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
                    Nothing has happened yet. {lead.status === "queued" ? "The first step runs once the campaign is launched and a number is free." : ""}
                  </p>
                ) : (
                  <ol className="mt-3 space-y-3 border-l border-stroke-soft-200 pl-4">
                    {detail!.timeline.map((entry) => <TimelineEntry key={entry.id} entry={entry} />)}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </Modal.SideContent>
    </Modal.Root>
  );
}

function TimelineEntry({ entry }: { entry: AiLeadTimelineEntry }) {
  const Icon = entry.kind === "call" ? RiPhoneLine : RiChat1Line;
  const length = entry.call ? formatCallLength(entry.call.durationMs) : null;
  const failed = entry.status === "failed";
  return (
    <li className="relative">
      <span className="absolute -left-[1.4rem] top-0.5 flex size-5 items-center justify-center rounded-full bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200">
        <Icon className="size-3 text-text-sub-600" aria-hidden="true" />
      </span>
      <div className="space-y-2 rounded-xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-label-sm text-text-strong-950">{entry.stepLabel}</span>
          {entry.status === "started" && <Badge.Root size="small" variant="light" color="blue">In progress</Badge.Root>}
          {failed && <Badge.Root size="small" variant="light" color="red">Failed</Badge.Root>}
          {entry.result && <Badge.Root size="small" variant="light" color={entry.result === "conversation" ? "green" : "gray"}>{RESULT_LABEL[entry.result]}</Badge.Root>}
          <span className="ml-auto text-paragraph-xs tabular-nums text-text-soft-400" suppressHydrationWarning>
            {formatWhen(entry.at)}{length ? ` · ${length}` : ""}
          </span>
        </div>
        {entry.error && <p className="text-paragraph-xs text-error-dark">{entry.error}</p>}
        {entry.body && <p className="max-w-md whitespace-pre-wrap break-words rounded-xl rounded-tl-sm bg-bg-white-0 px-3.5 py-2.5 text-paragraph-sm leading-6 text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">{entry.body}</p>}
        {entry.call?.outcome && (
          <AgentOutcomeLine outcome={{ ...entry.call.outcome, recordedAt: entry.at }} />
        )}
        {entry.call?.hasRecording && <RecordingPlayer callId={entry.call.id} offsetMs={entry.call.recordingOffsetMs} />}
        {entry.call && entry.call.transcriptStatus === "done" && <Transcript callId={entry.call.id} />}
      </div>
    </li>
  );
}

/** The call's transcript, fetched when opened. */
function Transcript({ callId }: { callId: string }) {
  const [open, setOpen] = useState(false);
  const [call, setCall] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !call) {
      try {
        setCall(await getCall(callId));
      } catch (cause) {
        setError(errorText(cause, "Could not load the transcript"));
      }
    }
  }

  return (
    <div>
      <Button.Root variant="neutral" mode="ghost" size="xxsmall" className="-ml-2 gap-1.5 text-label-xs" aria-expanded={open} onClick={() => void toggle()}>
        <RiArrowDownSLine className={cn("size-3.5 transition", open && "rotate-180")} aria-hidden="true" />
        {open ? "Hide transcript" : "Show transcript"}
      </Button.Root>
      {open && (
        <div className="mt-1 space-y-1.5 rounded-lg bg-bg-white-0 p-3 ring-1 ring-inset ring-stroke-soft-200">
          {error && <p className="text-paragraph-xs text-error-dark">{error}</p>}
          {!call && !error && <p className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600"><RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />Loading…</p>}
          {call?.transcript?.summary && <p className="pb-1 text-paragraph-xs text-text-sub-600">{call.transcript.summary}</p>}
          {call?.transcript?.utterances.map((utterance, index) => (
            <div key={index} className="flex gap-2 text-paragraph-xs">
              <span className="w-12 shrink-0 text-text-soft-400">{formatOffset(utterance.startSeconds)}</span>
              <span className={utterance.speaker === "rep" ? "w-10 shrink-0 font-medium text-information-base" : "w-10 shrink-0 font-medium text-text-sub-600"}>
                {utterance.speaker === "rep" ? "Agent" : "Lead"}
              </span>
              <span className="text-text-strong-950">{utterance.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
