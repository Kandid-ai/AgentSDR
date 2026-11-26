"use client";

import { RiLoader4Line, RiPauseCircleLine, RiPlayCircleLine, RiSendPlane2Line } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Textarea from "@/components/alignui/textarea";
import { REP_CALL_OUTCOMES, REP_CALL_OUTCOME_LABELS, REP_MESSAGE_MAX_CHARS, REP_NOTES_MAX_CHARS } from "@/lib/calls/aiCampaigns/dialer";
import { cn } from "@/utils/cn";
import { saveWrapUp, sendWrapUpMessage, updateWrapUpForm, updateWrapUpMessage, type WrapUpState } from "./dialerController";
import { wrapUpProblem, wrapUpTime } from "./dialerMachine";

/**
 * The wrap-up after a call that was picked up: outcome, time, notes, and a
 * WhatsApp from the same number. Its state lives in the dialer controller, so
 * the page's modal and the pop-out window show the same form (DialerOverlay).
 * `compact`: the pop-out's narrow layout.
 */
export function WrapUpFields({ wrapUp, compact = false }: { wrapUp: WrapUpState; compact?: boolean }) {
  const { form, error, message, sending, sent, messageError } = wrapUp;
  const busy = wrapUp.saving !== null;
  const time = wrapUpTime(form);
  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <fieldset>
        <legend className="mb-2 text-label-sm text-text-strong-950">Outcome</legend>
        <div role="radiogroup" aria-label="Outcome" className={cn("grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
          {REP_CALL_OUTCOMES.map((outcome) => {
            const selected = form.outcome === outcome;
            return (
              <button
                key={outcome}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                title={compact ? REP_CALL_OUTCOME_LABELS[outcome].help : undefined}
                onClick={() => updateWrapUpForm({ outcome })}
                className={cn("rounded-xl text-left outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-primary-base disabled:opacity-60", compact ? "px-2.5 py-2" : "p-3", selected ? "bg-bg-weak-50 ring-primary-base" : "ring-stroke-soft-200 hover:bg-bg-weak-50")}
              >
                <span className="block text-label-sm text-text-strong-950">{REP_CALL_OUTCOME_LABELS[outcome].label}</span>
                {!compact && <span className="mt-0.5 block text-paragraph-xs text-text-sub-600">{REP_CALL_OUTCOME_LABELS[outcome].help}</span>}
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
          <Input.Root size="small" className={compact ? "w-full" : "w-64"} hasError={time === "required" && !form.when && Boolean(error)}>
            <Input.Wrapper>
              <Input.Input id="dialer-when" type="datetime-local" value={form.when} disabled={busy} onChange={(event) => updateWrapUpForm({ when: event.target.value })} />
            </Input.Wrapper>
          </Input.Root>
        </div>
      )}

      <div>
        <label htmlFor="dialer-notes" className="mb-1.5 block text-label-sm text-text-strong-950">Notes <span className="text-text-soft-400">(optional)</span></label>
        <Textarea.Root id="dialer-notes" simple rows={compact ? 2 : 3} maxLength={REP_NOTES_MAX_CHARS} value={form.notes} disabled={busy} onChange={(event) => updateWrapUpForm({ notes: event.target.value })} placeholder="What they said, who to ask for, anything the next call should know." />
        {!compact && <div className="mt-1 flex justify-end text-paragraph-xs tabular-nums text-text-soft-400">{form.notes.length}/{REP_NOTES_MAX_CHARS}</div>}
      </div>

      <div className={cn("rounded-xl bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200", compact ? "p-2.5" : "p-3")}>
        <label htmlFor="dialer-message" className="mb-1.5 block text-label-sm text-text-strong-950">Send a WhatsApp</label>
        {!compact && <p className="mb-2 text-paragraph-xs text-text-sub-600">From the same number, right now. It does not depend on saving the call.</p>}
        <Textarea.Root id="dialer-message" simple rows={2} maxLength={REP_MESSAGE_MAX_CHARS} value={message} disabled={sending} onChange={(event) => updateWrapUpMessage(event.target.value)} placeholder="Hi, great speaking just now …" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-paragraph-xs tabular-nums text-text-soft-400">{message.length}/{REP_MESSAGE_MAX_CHARS}</span>
          <div className="flex items-center gap-3">
            {sent && <span role="status" className="text-paragraph-xs text-success-base">Sent</span>}
            {messageError && <span role="alert" className="text-paragraph-xs text-error-base">{messageError}</span>}
            <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => void sendWrapUpMessage()} disabled={sending || !message.trim()}>
              <Button.Icon as={sending ? RiLoader4Line : RiSendPlane2Line} className={cn(sending && "animate-spin")} />
              {sending ? "Sending…" : "Send"}
            </Button.Root>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pause or Next lead, each saving the wrap-up first; the save's error beside them. */
export function WrapUpActions({ wrapUp }: { wrapUp: WrapUpState }) {
  const { saving, error } = wrapUp;
  const busy = saving !== null;
  const problem = wrapUpProblem(wrapUp.form);
  return (
    <>
      {error && <p role="alert" className="mr-auto text-paragraph-sm text-error-base">{error}</p>}
      <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => void saveWrapUp(false)} disabled={busy || Boolean(problem)}>
        <Button.Icon as={saving === "pause" ? RiLoader4Line : RiPauseCircleLine} className={cn(saving === "pause" && "animate-spin")} />
        Pause
      </Button.Root>
      <Button.Root variant="primary" mode="filled" size="small" onClick={() => void saveWrapUp(true)} disabled={busy || Boolean(problem)}>
        <Button.Icon as={saving === "next" ? RiLoader4Line : RiPlayCircleLine} className={cn(saving === "next" && "animate-spin")} />
        Next lead
      </Button.Root>
    </>
  );
}
