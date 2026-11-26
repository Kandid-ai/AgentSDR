"use client";

import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import {
  RiCalendarCheckLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiPauseCircleLine,
  RiPhoneLine,
  RiPlayCircleLine,
  RiSendPlane2Line,
  RiTimeLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { formatElapsed } from "@/components/calls/formatElapsed";
import {
  hangUpRemoteRepCall,
  isRemoteRepCallActive,
  remoteRepCallSnapshot,
  startRemoteRepCall,
  subscribeRemoteRepCall,
} from "@/components/calls/remoteRepCall";
import { isRemoteRepOver } from "@/components/calls/remoteRepStage";
import { EmptyState } from "@/components/page/EmptyState";
import { StatRow } from "@/components/page/StatRow";
import type { AiCampaignDetail } from "@/lib/calls/aiCampaigns/api";
import { dialNext, getDialerOverview, sendDialerMessage, wrapUpDialerCall } from "@/lib/calls/aiCampaigns/client";
import {
  REP_CALL_OUTCOMES,
  REP_CALL_OUTCOME_LABELS,
  REP_MESSAGE_MAX_CHARS,
  REP_NOTES_MAX_CHARS,
  type DialerLead,
  type DialerOverview,
} from "@/lib/calls/aiCampaigns/dialer";
import { cancelCall, getCall } from "@/lib/calls/client";
import type { CallDetail } from "@/lib/calls/contract";
import { cn } from "@/utils/cn";
import {
  EMPTY_WRAP_UP,
  STOPPED,
  callStageLabel,
  dialerReducer,
  isRunning,
  messageProblem,
  wrapUpProblem,
  wrapUpRequest,
  wrapUpTime,
  type DialerPhase,
  type WrapUpForm,
} from "./dialerMachine";
import { errorText } from "./aiShared";
import { clearDialerSession, publishDialerSession } from "./dialerSession";
import { dialerStatus } from "./dialerSessionText";

const OVERVIEW_REFRESH_MS = 15_000;

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The Dialer tab of a rep campaign: Start places the next due lead's call
 * through a calling station and the rep talks from this tab (remoteRepCall.ts);
 * a call that was picked up ends in a wrap-up, one that was not goes on to the
 * next lead after a short countdown. The transitions are in dialerMachine.ts;
 * this component runs the requests, the call and the timers. The dialer lives in
 * this component: leave the page and it stops, while a call on carries on in
 * the call bar.
 */
/** The lead picked up: the extension marked the call started, it was recorded, or its phase reports a length. */
function answeredOn(call: CallDetail): boolean {
  if (call.status === "recorded" || call.status === "in_progress") return true;
  const phase = call.livePhase;
  return (phase?.kind === "processing" || phase?.kind === "done") && (phase.durationMs ?? 0) > 0;
}

/** From the Start click only, never on load: a pick-up while this tab is hidden can then notify. */
function askNotificationPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
  } catch {
    // Older browsers use a callback form; a missing notification is not worth an error.
  }
}

export function DialerTab({ campaign, onChanged }: { campaign: AiCampaignDetail; onChanged: () => void }) {
  const campaignId = campaign.id;
  const [phase, dispatch] = useReducer(dialerReducer, STOPPED);
  const phaseRef = useRef<DialerPhase>(phase);
  const [overview, setOverview] = useState<DialerOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const call = useSyncExternalStore(subscribeRemoteRepCall, remoteRepCallSnapshot, () => null);
  const [now, setNow] = useState(() => Date.now());
  const active = campaign.state === "active";
  const onChangedRef = useRef(onChanged);

  useEffect(() => {
    phaseRef.current = phase;
    onChangedRef.current = onChanged;
  });

  const refresh = useCallback(async () => {
    try {
      setOverview(await getDialerOverview(campaignId));
      setOverviewError(null);
    } catch (cause) {
      setOverviewError(errorText(cause, "Could not load today's numbers"));
    }
  }, [campaignId]);

  // The header's numbers: now, every 15 s while the tab is visible, and after every call.
  useEffect(() => {
    if (campaign.state === "draft") return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, OVERVIEW_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh, campaign.state]);

  const phaseName = phase.name;
  useEffect(() => {
    // On mount and at every phase change (a call settling, a save): bring the figures up to date.
    if (campaign.state !== "draft") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh();
      onChangedRef.current();
    }
  }, [phaseName, refresh, campaign.state]);

  // Ask for the next lead. Once per dialing phase (a re-run of the effect must not queue a second call).
  const requested = useRef<DialerPhase | null>(null);
  useEffect(() => {
    if (phase.name !== "dialing" || requested.current === phase) return;
    requested.current = phase;
    const mine = phase;
    if (isRemoteRepCallActive()) {
      dispatch({ type: "dial-failed", message: "You are on another call. Finish it, then press Start." });
      return;
    }
    dialNext(campaignId, { preferContactId: mine.prefer })
      .then((response) => {
        if (phaseRef.current !== mine) {
          // Paused (or restarted) while asking: a call queued meanwhile is withdrawn.
          if (response.kind === "calling") void cancelCall(response.callId).catch(() => {});
          return;
        }
        dispatch({ type: "dial-result", response });
      })
      .catch((cause) => {
        if (phaseRef.current === mine) dispatch({ type: "dial-failed", message: errorText(cause, "Could not start the next call") });
      });
  }, [phase, campaignId]);

  // Nothing could be placed this moment: ask again after a short wait.
  useEffect(() => {
    if (phase.name !== "waiting") return;
    const timer = setTimeout(() => dispatch({ type: "retry" }), phase.retryInMs);
    return () => clearTimeout(timer);
  }, [phase]);

  // The countdown to the next call.
  useEffect(() => {
    if (phase.name !== "countdown") return;
    const timer = setTimeout(() => dispatch({ type: "tick" }), 1_000);
    return () => clearTimeout(timer);
  }, [phase]);

  // The call is queued server-side already: open the microphone and let the rep's audio go.
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (phase.name !== "calling" || started.current === phase.callId) return;
    const { callId, numberName, lead } = phase;
    started.current = callId;
    const fail = (message: string | null) => {
      void cancelCall(callId).catch(() => {});
      dispatch({ type: "call-not-started", message });
    };
    startRemoteRepCall({ leadName: lead.name || lead.phone, leadCompany: lead.company, numberName, place: async () => ({ callId, numberName }) })
      .then((id) => { if (id === null) fail(remoteRepCallSnapshot()?.message ?? null); })
      .catch((cause) => fail(errorText(cause, "The call could not start")));
  }, [phase]);

  // Watch the call; when it is over, the machine decides what follows.
  useEffect(() => {
    if (phase.name !== "calling" || started.current !== phase.callId || !call || !isRemoteRepOver(call.stage)) return;
    if (call.callId !== phase.callId && call.callId !== null) return;
    const end = { stage: call.stage, answeredAt: call.answeredAt, endedBy: call.endedBy, message: call.message };
    if (end.answeredAt != null || end.endedBy === "rep" || end.stage === "error") {
      dispatch({ type: "call-ended", end });
      return;
    }
    // The bar polls every second or two, so a pick-up that ended between two polls was never
    // seen on call: ask the call itself before reading it as unanswered (a pick-up needs a wrap-up).
    let cancelled = false;
    void getCall(phase.callId)
      .then((detail) => (answeredOn(detail) ? { ...end, answeredAt: Date.now() } : end))
      .catch(() => end)
      .then((settled) => { if (!cancelled) dispatch({ type: "call-ended", end: settled }); });
    return () => { cancelled = true; };
  }, [phase, call]);

  // The call timer.
  const onCall = phase.name === "calling" && call?.callId === phase.callId && call.stage === "on-call";
  useEffect(() => {
    if (!onCall) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [onCall]);

  // Tell the call bar what the dialer is doing, so it shows between calls on any page.
  const campaignName = campaign.name;
  const status = dialerStatus(phase);
  const statusText = status?.text ?? null;
  const statusCanPause = status?.canPause ?? false;
  const statusDismissible = status?.dismissible ?? false;
  const pauseDialer = useCallback(() => dispatch({ type: "pause" }), []);
  useEffect(() => {
    if (statusText === null) {
      clearDialerSession();
      return;
    }
    publishDialerSession({ campaignId, campaignName, text: statusText, canPause: statusCanPause, dismissible: statusDismissible, pause: pauseDialer });
  }, [campaignId, campaignName, statusText, statusCanPause, statusDismissible, pauseDialer]);
  useEffect(() => clearDialerSession, []);

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
          description="Press Start and the next lead is called from your campaign's number. When they pick up, you talk."
          actions={
            running ? (
              <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => dispatch({ type: "pause" })} disabled={phase.name === "calling" || phase.name === "wrap-up"} title={live ? "Finish the call first" : undefined}>
                <Button.Icon as={RiPauseCircleLine} />
                Pause
              </Button.Root>
            ) : (
              <Button.Root variant="primary" mode="filled" size="small" onClick={() => { askNotificationPermission(); dispatch({ type: "start" }); }} disabled={!active}>
                <Button.Icon as={RiPlayCircleLine} />
                Start
              </Button.Root>
            )
          }
        />
        <FramePanel className="space-y-4">
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
                      <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => dispatch({ type: "pause" })}>
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

      {phase.name === "wrap-up" && (
        <WrapUpModal
          key={phase.callId}
          lead={phase.lead}
          callId={phase.callId}
          campaignId={campaignId}
          onSaved={(next) => dispatch({ type: "wrap-up-saved", next })}
        />
      )}
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

/** Shown after a call that was picked up. It cannot be dismissed: the outcome is how the lead moves on. */
function WrapUpModal({
  lead,
  callId,
  campaignId,
  onSaved,
}: {
  lead: DialerLead;
  callId: string;
  campaignId: string;
  onSaved: (next: boolean) => void;
}) {
  const [form, setForm] = useState<WrapUpForm>(EMPTY_WRAP_UP);
  const [saving, setSaving] = useState<"pause" | "next" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const time = wrapUpTime(form);
  const problem = wrapUpProblem(form);

  async function save(next: boolean) {
    if (problem) { setError(problem); return; }
    setSaving(next ? "next" : "pause");
    setError(null);
    try {
      await wrapUpDialerCall(campaignId, wrapUpRequest(callId, form));
      onSaved(next);
    } catch (cause) {
      setError(errorText(cause, "Could not save. Try again."));
      setSaving(null);
    }
  }

  async function send() {
    const invalid = messageProblem(message);
    if (invalid) { setMessageError(invalid); return; }
    setSending(true);
    setMessageError(null);
    setSent(false);
    try {
      await sendDialerMessage(campaignId, { contactId: lead.contactId, body: message.trim() });
      setSent(true);
      setMessage("");
    } catch (cause) {
      setMessageError(errorText(cause, "Could not send the message"));
    } finally {
      setSending(false);
    }
  }

  const busy = saving !== null;
  return (
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
          <Modal.Description>{lead.name || lead.phone}{lead.company ? ` · ${lead.company}` : ""}</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-label-sm text-text-strong-950">Outcome</legend>
            <div role="radiogroup" aria-label="Outcome" className="grid gap-2 sm:grid-cols-2">
              {REP_CALL_OUTCOMES.map((outcome) => {
                const selected = form.outcome === outcome;
                return (
                  <button
                    key={outcome}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busy}
                    onClick={() => { setError(null); setForm((current) => ({ ...current, outcome })); }}
                    className={cn("rounded-xl p-3 text-left outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-primary-base disabled:opacity-60", selected ? "bg-bg-weak-50 ring-primary-base" : "ring-stroke-soft-200 hover:bg-bg-weak-50")}
                  >
                    <span className="block text-label-sm text-text-strong-950">{REP_CALL_OUTCOME_LABELS[outcome].label}</span>
                    <span className="mt-0.5 block text-paragraph-xs text-text-sub-600">{REP_CALL_OUTCOME_LABELS[outcome].help}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {time && (
            <div>
              <label htmlFor="dialer-when" className="mb-1.5 block text-label-sm text-text-strong-950">
                {form.outcome === "call_back" ? "Call back at" : "Follow up at"} {time === "optional" && <span className="text-text-soft-400">(optional)</span>}
              </label>
              <Input.Root size="small" className="w-64" hasError={time === "required" && !form.when && Boolean(error)}>
                <Input.Wrapper>
                  <Input.Input id="dialer-when" type="datetime-local" value={form.when} disabled={busy} onChange={(event) => { setError(null); setForm((current) => ({ ...current, when: event.target.value })); }} />
                </Input.Wrapper>
              </Input.Root>
            </div>
          )}

          <div>
            <label htmlFor="dialer-notes" className="mb-1.5 block text-label-sm text-text-strong-950">Notes <span className="text-text-soft-400">(optional)</span></label>
            <Textarea.Root id="dialer-notes" simple rows={3} maxLength={REP_NOTES_MAX_CHARS} value={form.notes} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="What they said, who to ask for, anything the next call should know." />
            <div className="mt-1 flex justify-end text-paragraph-xs tabular-nums text-text-soft-400">{form.notes.length}/{REP_NOTES_MAX_CHARS}</div>
          </div>

          <div className="rounded-xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
            <label htmlFor="dialer-message" className="mb-1.5 block text-label-sm text-text-strong-950">Send a WhatsApp</label>
            <p className="mb-2 text-paragraph-xs text-text-sub-600">From the same number, right now. It does not depend on saving the call.</p>
            <Textarea.Root id="dialer-message" simple rows={2} maxLength={REP_MESSAGE_MAX_CHARS} value={message} disabled={sending} onChange={(event) => { setSent(false); setMessageError(null); setMessage(event.target.value); }} placeholder="Hi, great speaking just now …" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-paragraph-xs tabular-nums text-text-soft-400">{message.length}/{REP_MESSAGE_MAX_CHARS}</span>
              <div className="flex items-center gap-3">
                {sent && <span role="status" className="text-paragraph-xs text-success-base">Sent</span>}
                {messageError && <span role="alert" className="text-paragraph-xs text-error-base">{messageError}</span>}
                <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => void send()} disabled={sending || !message.trim()}>
                  <Button.Icon as={sending ? RiLoader4Line : RiSendPlane2Line} className={cn(sending && "animate-spin")} />
                  {sending ? "Sending…" : "Send"}
                </Button.Root>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          {error && <p role="alert" className="mr-auto text-paragraph-sm text-error-base">{error}</p>}
          <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => void save(false)} disabled={busy || Boolean(problem)}>
            <Button.Icon as={saving === "pause" ? RiLoader4Line : RiPauseCircleLine} className={cn(saving === "pause" && "animate-spin")} />
            Pause
          </Button.Root>
          <Button.Root variant="primary" mode="filled" size="small" onClick={() => void save(true)} disabled={busy || Boolean(problem)}>
            <Button.Icon as={saving === "next" ? RiLoader4Line : RiPlayCircleLine} className={cn(saving === "next" && "animate-spin")} />
            Next lead
          </Button.Root>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
