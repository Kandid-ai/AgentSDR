"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  RiCalendarCheckLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiPauseCircleLine,
  RiPhoneLine,
  RiPlayCircleLine,
  RiTimeLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { formatElapsed } from "@/components/calls/formatElapsed";
import { openPip } from "@/components/calls/pipWindow";
import { hangUpRemoteRepCall, remoteRepCallSnapshot, subscribeRemoteRepCall } from "@/components/calls/remoteRepCall";
import { isRemoteRepOver } from "@/components/calls/remoteRepStage";
import { EmptyState } from "@/components/page/EmptyState";
import { StatRow } from "@/components/page/StatRow";
import type { AiCampaignDetail } from "@/lib/calls/aiCampaigns/api";
import type { DialerLead } from "@/lib/calls/aiCampaigns/dialer";
import { cn } from "@/utils/cn";
import { askNotificationPermission, pauseDialer, refreshDialerOverview, startDialer, useDialer } from "./dialerController";
import { STOPPED, callStageLabel, isRunning, type DialerPhase } from "./dialerMachine";
import { dialerCampaignHref } from "./dialerView";

const OVERVIEW_REFRESH_MS = 15_000;

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The Dialer tab of a rep campaign: Start places the next due lead's call
 * through a calling station and the rep talks from this tab (remoteRepCall.ts);
 * a call that was picked up ends in a wrap-up, one that was not goes on to the
 * next lead after a short countdown. The dialer runs in dialerController.ts,
 * not here: leaving the page does not stop it (the call bar, the pop-out and
 * the wrap-up follow the rep, DialerOverlay.tsx). This tab is a view of it.
 */
export function DialerTab({ campaign, onChanged }: { campaign: AiCampaignDetail; onChanged: () => void }) {
  const campaignId = campaign.id;
  const dialer = useDialer();
  // Another campaign's dialer: this tab shows itself stopped, and Start is refused until that one is paused.
  const ours = dialer.campaign?.id === campaignId;
  const phase: DialerPhase = ours ? dialer.phase : STOPPED;
  const busyElsewhere = !ours && dialer.campaign !== null && dialer.phase.name !== "stopped" ? dialer.campaign : null;
  const overview = dialer.overviews[campaignId]?.data ?? null;
  const overviewError = dialer.overviews[campaignId]?.error ?? null;
  const call = useSyncExternalStore(subscribeRemoteRepCall, remoteRepCallSnapshot, () => null);
  const [now, setNow] = useState(() => Date.now());
  const [refusal, setRefusal] = useState<string | null>(null);
  const active = campaign.state === "active";
  const onChangedRef = useRef(onChanged);

  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  // The header's numbers: now, every 15 s while the tab is visible (the controller refreshes them after every call).
  useEffect(() => {
    if (campaign.state === "draft") return;
    void refreshDialerOverview(campaignId);
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refreshDialerOverview(campaignId); }, OVERVIEW_REFRESH_MS);
    return () => clearInterval(timer);
  }, [campaignId, campaign.state]);

  // At every phase change of this campaign's dialer (a call settling, a save): the page's own figures too.
  const phaseName = phase.name;
  useEffect(() => {
    if (ours) onChangedRef.current();
  }, [phaseName, ours]);

  // The call timer.
  const onCall = phase.name === "calling" && call?.callId === phase.callId && call.stage === "on-call";
  useEffect(() => {
    if (!onCall) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [onCall]);

  const start = () => {
    const refused = startDialer({ id: campaignId, name: campaign.name });
    setRefusal(refused);
    if (refused) return;
    // The same click opens the pop-out, so the rep can work elsewhere: first, while the click's
    // user activation is fresh (requestWindow needs it), then the notification permission.
    void openPip();
    askNotificationPermission();
  };

  const running = isRunning(phase);
  const live = phase.name === "calling" || phase.name === "wrap-up";
  const mine = phase.name === "calling" && call && (call.callId === phase.callId || call.callId === null) ? call : null;
  const callNumber = phase.name === "calling" ? phase.numberName : "";
  const canHangUp = phase.name === "calling" && mine !== null && !isRemoteRepOver(mine.stage);

  if (campaign.state === "draft" && !live) {
    return <EmptyState icon={RiPlayCircleLine} title="Launch the campaign to start calling" description="Calls to your leads only start once the campaign is launched." />;
  }
  if (!active && !live) {
    return <EmptyState icon={RiPauseCircleLine} title="The campaign is paused" description="Resume it from the header to start calling." />;
  }

  const lead: DialerLead | null = phase.name === "calling" || phase.name === "wrap-up" || phase.name === "countdown" ? phase.lead : null;
  const today = overview?.today;
  const num = (value: number | undefined) => (value === undefined ? "–" : value.toLocaleString("en-US"));

  return (
    <div className="space-y-4">
      <Frame>
        <FrameHeader
          title="Dialer"
          description="Press Start and the next lead is called from your campaign's number. When they pick up, you talk. It keeps going on any page of AgentSDR while this browser tab is open."
          actions={
            running ? (
              <Button.Root variant="neutral" mode="stroke" size="small" onClick={pauseDialer} disabled={live} title={live ? "Finish the call first" : undefined}>
                <Button.Icon as={RiPauseCircleLine} />
                Pause
              </Button.Root>
            ) : (
              <Button.Root variant="primary" mode="filled" size="small" onClick={start} disabled={!active || busyElsewhere !== null} title={busyElsewhere ? "Pause the other campaign's dialer first" : undefined}>
                <Button.Icon as={RiPlayCircleLine} />
                Start
              </Button.Root>
            )
          }
        />
        <FramePanel className="space-y-4">
          {busyElsewhere && (
            <p role="status" className="text-paragraph-sm text-text-sub-600">
              The dialer is working on{" "}
              <Link href={dialerCampaignHref(busyElsewhere.id)} className="text-primary-base underline-offset-2 hover:underline">{busyElsewhere.name}</Link>
              . Pause it there to call this campaign.
            </p>
          )}
          {refusal && !busyElsewhere && <p role="alert" className="text-paragraph-sm text-error-base">{refusal}</p>}
          <StatRow
            items={[
              { label: "Dials today", value: num(today?.dials), icon: RiPhoneLine, hint: "Calls this campaign placed today" },
              { label: "Picked up", value: num(today?.pickedUp), icon: RiCheckboxCircleLine, hint: "Of today's calls, the ones that were picked up" },
              { label: "Meetings", value: num(today?.meetings), icon: RiCalendarCheckLine, hint: "Meetings agreed today" },
              { label: "Due now", value: num(overview?.dueNow), icon: RiTimeLine, hint: overview?.nextDueAt && !overview.dueNow ? `Next due ${when(overview.nextDueAt)}` : "Leads with a call due now" },
            ]}
          />
          {overview && overview.numbers.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Numbers">
              {overview.numbers.map((number) => (
                <li key={number.id} className="flex items-center gap-2 rounded-lg bg-bg-weak-50 px-3 py-1.5 text-paragraph-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
                  <span className="text-label-xs text-text-strong-950">{number.name}</span>
                  <span className="tabular-nums">{number.callsToday}/{number.limit} today</span>
                  <Badge.Root size="small" variant="lighter" color={number.open ? "green" : "gray"}>{number.open ? "Open" : "Not open"}</Badge.Root>
                  {!number.withinHours && <Badge.Root size="small" variant="lighter" color="orange">Outside hours</Badge.Root>}
                </li>
              ))}
            </ul>
          )}
          {overviewError && <p role="alert" className="text-paragraph-xs text-error-base">{overviewError}</p>}
        </FramePanel>
      </Frame>

      <div className={cn("grid gap-4", overview?.script.trim() && "lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]")}>
        <Frame>
          <FramePanel>
            {lead ? (
              <LeadCard
                lead={lead}
                status={
                  phase.name === "countdown" ? (
                    <p role="status" className="flex flex-wrap items-center gap-3 text-paragraph-sm text-text-sub-600">
                      <span>Not answered. Next call in {phase.seconds}…</span>
                      <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={pauseDialer}>
                        <Button.Icon as={RiPauseCircleLine} />
                        Pause
                      </Button.Root>
                    </p>
                  ) : phase.name === "wrap-up" ? (
                    <p role="status" className="text-paragraph-sm text-text-sub-600">Call ended. Record how it went.</p>
                  ) : (
                    <div role="status" className="flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-2 text-label-sm text-text-strong-950">
                        {mine && mine.stage !== "on-call" && !isRemoteRepOver(mine.stage) && <RiLoader4Line className="size-4 animate-spin text-text-sub-600" aria-hidden="true" />}
                        {callStageLabel(mine?.stage ?? "placing")}
                        {mine?.stage === "on-call" && mine.answeredAt != null && <span className="tabular-nums text-text-sub-600">{formatElapsed(now - mine.answeredAt)}</span>}
                        {mine?.stage === "on-call" && mine.muted && <span className="text-paragraph-xs text-warning-dark">Muted</span>}
                      </span>
                      <span className="text-paragraph-xs text-text-soft-400">from {callNumber}</span>
                      {canHangUp && (
                        <Button.Root variant="error" mode="stroke" size="xsmall" className="ml-auto" onClick={() => void hangUpRemoteRepCall()}>
                          <Button.Icon as={RiCloseCircleLine} />
                          Hang up
                        </Button.Root>
                      )}
                    </div>
                  )
                }
              />
            ) : (
              <IdleState phase={phase} />
            )}
          </FramePanel>
        </Frame>
        {overview?.script.trim() && (
          <Frame>
            <FrameHeader title="Call script" />
            <FramePanel>
              <p className="whitespace-pre-wrap break-words text-paragraph-sm text-text-sub-600">{overview.script}</p>
            </FramePanel>
          </Frame>
        )}
      </div>
    </div>
  );
}

function IdleState({ phase }: { phase: DialerPhase }) {
  if (phase.name === "dialing") {
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-10 text-paragraph-sm text-text-sub-600">
        <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
        Finding the next lead…
      </p>
    );
  }
  if (phase.name === "waiting") {
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-10 text-paragraph-sm text-text-sub-600">
        <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
        {phase.message}
      </p>
    );
  }
  if (phase.name === "stopped" && phase.notice) {
    return (
      <div role="status" className="py-8 text-center">
        <p className="flex items-center justify-center gap-2 text-paragraph-sm text-text-strong-950">
          <RiErrorWarningLine className="size-4 shrink-0 text-warning-dark" aria-hidden="true" />
          {phase.notice}
        </p>
        {phase.nextDueAt && <p className="mt-1 text-paragraph-xs text-text-sub-600">Next call due {when(phase.nextDueAt)}.</p>}
      </div>
    );
  }
  return <EmptyState compact icon={RiPhoneLine} title="Press Start to begin" description="You will be connected when a lead picks up." />;
}

function LeadCard({ lead, status }: { lead: DialerLead; status: React.ReactNode }) {
  const subtitle = [lead.title, lead.company].filter(Boolean).join(" · ");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-label-lg text-text-strong-950">{lead.name || lead.phone}</h3>
          {subtitle && <p className="mt-0.5 truncate text-paragraph-sm text-text-sub-600">{subtitle}</p>}
          <p className="mt-0.5 text-paragraph-sm tabular-nums text-text-sub-600">{lead.phone}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge.Root size="small" variant="lighter" color="blue">{lead.stepLabel}</Badge.Root>
          <span className="text-paragraph-xs text-text-soft-400">{lead.previousCalls === 0 ? "First call" : `${lead.previousCalls} earlier ${lead.previousCalls === 1 ? "call" : "calls"}`}</span>
        </div>
      </div>
      <div className="rounded-xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">{status}</div>
      {lead.stepNote && (
        <div className="rounded-xl bg-warning-lighter p-3">
          <p className="text-label-xs text-warning-dark">Note for this call</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-paragraph-sm text-text-strong-950">{lead.stepNote}</p>
        </div>
      )}
      {lead.lastNote && (
        <div>
          <p className="text-label-xs text-text-sub-600">Last note</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-paragraph-sm text-text-strong-950">{lead.lastNote}</p>
        </div>
      )}
      {lead.notes && (
        <div>
          <p className="text-label-xs text-text-sub-600">Notes on this lead</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-paragraph-sm text-text-strong-950">{lead.notes}</p>
        </div>
      )}
    </div>
  );
}
