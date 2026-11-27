"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RiAddLine, RiArrowRightUpLine, RiCheckLine, RiCloseCircleLine, RiMailLine, RiPhoneLine, RiLinkedinLine, RiPencilLine, RiSendPlaneLine, RiUserSharedLine } from "@remixicon/react";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { cn } from "@/utils/cn";
import {
  REFERRAL_CHANNELS,
  REFERRAL_CHANNEL_LABELS,
  referralChannelAvailable,
  type Referral,
  type ReferralChannel,
  type ReferralChannelResult,
  type ReferralCreateRequest,
  type ReferralStartResponse,
  type ReferralSummary,
  type ReferralTargetsResponse,
  type ReferralUpdateRequest,
} from "@/lib/crm/referralTypes";
import { crmFetch, errorMessage } from "./crm-utils";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from "./CrmLayout";
import type { RowMutation } from "./ActionRowTools";

const inputClass = "h-9 w-full min-w-0 rounded-lg bg-bg-white-0 px-3 text-paragraph-sm text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 placeholder:text-text-soft-400 focus:outline-none focus:ring-primary-base";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Fields = { name: string; email: string; phone: string; linkedinUrl: string; role: string; companyName: string; anonymous: boolean };

const fieldsOf = (referral?: Partial<Referral>): Fields => ({
  name: referral?.name ?? "", email: referral?.email ?? "", phone: referral?.phone ?? "", linkedinUrl: referral?.linkedinUrl ?? "",
  role: referral?.role ?? "", companyName: referral?.companyName ?? "", anonymous: referral?.anonymous ?? false,
});

const orNull = (value: string) => value.trim() || null;

/** At least one way to identify them, and a plausible email when one is given. Phone format never blocks. */
function validate(fields: Fields): string | null {
  if (!fields.name.trim() && !fields.email.trim() && !fields.phone.trim() && !fields.linkedinUrl.trim()) return "Add a name, email, phone or LinkedIn.";
  if (fields.email.trim() && !EMAIL_PATTERN.test(fields.email.trim())) return "That email does not look right.";
  return null;
}

export function referralLabel(referral: Pick<Referral, "name" | "email" | "phone" | "linkedinUrl">): string {
  return referral.name || referral.email || referral.phone || referral.linkedinUrl || "referred contact";
}

/** Email / phone / LinkedIn chips, shared by the card and the Action required row. */
export function ReferralChips({ referral }: { referral: Pick<Referral, "email" | "phone" | "linkedinUrl" | "role"> }) {
  const chip = "inline-flex max-w-full items-center gap-1 rounded-md bg-bg-weak-50 px-1.5 py-0.5 text-paragraph-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {referral.role && <span className={chip}>{referral.role}</span>}
      {referral.email && <span className={chip}><RiMailLine className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{referral.email}</span></span>}
      {referral.phone && <span className={chip}><RiPhoneLine className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{referral.phone}</span></span>}
      {referral.linkedinUrl && <span className={chip}><RiLinkedinLine className="size-3 shrink-0" aria-hidden="true" />LinkedIn</span>}
    </span>
  );
}

function ReferralFields({ fields, onChange }: { fields: Fields; onChange: (next: Fields) => void }) {
  const set = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement>) => onChange({ ...fields, [key]: event.target.value });
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Name" aria-label="Name" value={fields.name} onChange={set("name")} />
        <input className={inputClass} placeholder="Role" aria-label="Role" value={fields.role} onChange={set("role")} />
        <input className={inputClass} placeholder="Email" aria-label="Email" type="email" value={fields.email} onChange={set("email")} />
        <input className={inputClass} placeholder="Phone" aria-label="Phone" value={fields.phone} onChange={set("phone")} />
        <input className={inputClass} placeholder="LinkedIn URL" aria-label="LinkedIn URL" value={fields.linkedinUrl} onChange={set("linkedinUrl")} />
        <input className={inputClass} placeholder="Company" aria-label="Company" value={fields.companyName} onChange={set("companyName")} />
      </div>
      <label className="flex items-center gap-2 text-paragraph-sm text-text-sub-600">
        <input type="checkbox" checked={fields.anonymous} onChange={(event) => onChange({ ...fields, anonymous: event.target.checked })} />
        Don&apos;t name the referrer
      </label>
    </div>
  );
}

function ResultLine({ channel, result }: { channel: ReferralChannel; result: ReferralChannelResult }) {
  const tone = result.outcome === "enrolled" ? "text-success-base" : result.outcome === "failed" ? "text-error-base" : "text-text-sub-600";
  return (
    <li className="flex flex-wrap items-baseline gap-x-1.5 text-paragraph-xs">
      <span className="text-label-xs text-text-strong-950">{REFERRAL_CHANNEL_LABELS[channel]}</span>
      <span className={cn("capitalize", tone)}>{result.outcome}</span>
      <span className="text-text-sub-600">{result.campaignName}{result.message ? ` — ${result.message}` : ""}</span>
    </li>
  );
}

function PendingReferral({ referral, targets, targetsError, onChanged }: {
  referral: Referral;
  targets: ReferralTargetsResponse | null;
  targetsError: string;
  onChanged: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(referral));
  const [chosen, setChosen] = useState<Partial<Record<ReferralChannel, string>>>({});
  const [off, setOff] = useState<Partial<Record<ReferralChannel, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Default each channel's campaign to the suggested one, once targets arrive.
  useEffect(() => {
    if (!targets) return;
    setChosen((current) => {
      const next = { ...current };
      for (const channel of REFERRAL_CHANNELS) {
        if (next[channel] === undefined) next[channel] = targets[channel]?.find((target) => target.suggested)?.id ?? "";
      }
      return next;
    });
  }, [targets]);

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setError("");
    try { onChanged(await work()); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };

  const save = () => {
    const invalid = validate(fields);
    if (invalid) { setError(invalid); return; }
    const body: ReferralUpdateRequest = {
      name: orNull(fields.name), email: orNull(fields.email), phone: orNull(fields.phone), linkedinUrl: orNull(fields.linkedinUrl),
      role: orNull(fields.role), companyName: orNull(fields.companyName), anonymous: fields.anonymous,
    };
    void run(async () => {
      await crmFetch<Referral>(`/referrals/${referral.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditing(false);
      return "Referral updated";
    });
  };

  const selected = REFERRAL_CHANNELS.filter((channel) => referralChannelAvailable(referral, channel) && !off[channel] && chosen[channel]);
  const label = referralLabel(referral);
  const start = () => void run(async () => {
    const channels: Partial<Record<ReferralChannel, string>> = {};
    for (const channel of selected) channels[channel] = chosen[channel];
    const response = await crmFetch<ReferralStartResponse>(`/referrals/${referral.id}/start`, { method: "POST", body: JSON.stringify({ channels }) });
    const failed = Object.values(response.results).filter((result) => result?.outcome === "failed").length;
    return failed ? `Outreach to ${label} started, ${failed} channel${failed === 1 ? "" : "s"} failed` : `Outreach to ${label} started`;
  });
  const dismiss = () => void run(async () => {
    await crmFetch<Referral>(`/referrals/${referral.id}/dismiss`, { method: "POST", body: "{}" });
    return "Referral dismissed";
  });

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-label-sm text-text-strong-950">{label}{referral.companyName ? <span className="text-text-sub-600"> · {referral.companyName}</span> : null}</p>
          <ReferralChips referral={referral} />
          {referral.anonymous && <p className="text-paragraph-xs text-warning-base">Asked not to be named to them.</p>}
        </div>
        {!editing && <button type="button" className={cn(secondaryButtonClass, "h-7 px-2 text-label-xs")} onClick={() => { setFields(fieldsOf(referral)); setEditing(true); }}><RiPencilLine className="size-3.5" aria-hidden="true" />Edit</button>}
      </div>
      {referral.context && <p className="border-l-2 border-stroke-soft-200 pl-2.5 text-paragraph-xs italic text-text-sub-600">&ldquo;{referral.context}&rdquo;</p>}

      {editing ? (
        <>
          <ReferralFields fields={fields} onChange={setFields} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className={cn(primaryButtonClass, "h-8")} onClick={save}>Save</button>
            <button type="button" disabled={busy} className={cn(secondaryButtonClass, "h-8")} onClick={() => { setEditing(false); setError(""); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="space-y-2 rounded-lg bg-bg-weak-50 p-2.5 ring-1 ring-inset ring-stroke-soft-200">
          {targetsError && <p className="text-paragraph-xs text-error-base">{targetsError}</p>}
          {REFERRAL_CHANNELS.map((channel) => {
            const available = referralChannelAvailable(referral, channel);
            const options = targets?.[channel] ?? [];
            const checked = available && !off[channel] && Boolean(chosen[channel]);
            return (
              <div key={channel} className={cn("grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2", !available && "opacity-50")}>
                <label className="flex items-center gap-2 text-label-sm text-text-strong-950">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!available || !chosen[channel]}
                    onChange={(event) => setOff((current) => ({ ...current, [channel]: !event.target.checked }))}
                  />
                  {REFERRAL_CHANNEL_LABELS[channel]}
                </label>
                {available ? (
                  <select
                    className={cn(inputClass, "h-8 text-paragraph-xs")}
                    aria-label={`${REFERRAL_CHANNEL_LABELS[channel]} campaign`}
                    value={chosen[channel] ?? ""}
                    disabled={!targets}
                    onChange={(event) => { setChosen((current) => ({ ...current, [channel]: event.target.value })); setOff((current) => ({ ...current, [channel]: false })); }}
                  >
                    <option value="">{!targets ? "Loading campaigns…" : options.length ? "No campaign" : "No campaigns available"}</option>
                    {options.map((target) => <option key={target.id} value={target.id}>{target.name}{target.status ? ` (${target.status})` : ""}</option>)}
                  </select>
                ) : <span className="text-paragraph-xs text-text-sub-600">Needs {channel === "email" ? "an email" : channel === "linkedin" ? "a LinkedIn URL" : "a phone number"}</span>}
              </div>
            );
          })}
        </div>
      )}

      {error && <p role="alert" className="text-paragraph-xs text-error-base">{error}</p>}
      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy || !selected.length} className={primaryButtonClass} onClick={start}>
            <RiSendPlaneLine className="size-4" aria-hidden="true" />Start outreach to {label}
          </button>
          <button type="button" disabled={busy} className={dangerButtonClass} onClick={dismiss}><RiCloseCircleLine className="size-4" aria-hidden="true" />Dismiss</button>
          {!selected.length && <span className="text-paragraph-xs text-text-sub-600">Pick a campaign for at least one channel.</span>}
        </div>
      )}
    </div>
  );
}

function StartedReferral({ referral }: { referral: Referral }) {
  const results = REFERRAL_CHANNELS.flatMap((channel) => { const result = referral.channels?.[channel]; return result ? [[channel, result] as const] : []; });
  return (
    <div className="space-y-1.5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-label-sm text-text-strong-950"><RiCheckLine className="size-4 shrink-0 text-success-base" aria-hidden="true" />{referralLabel(referral)} <span className="text-text-sub-600">· outreach started</span></p>
        {referral.referredPersonId && <Link href="/leads" className="inline-flex shrink-0 items-center gap-0.5 text-label-xs text-primary-base hover:underline">View lead<RiArrowRightUpLine className="size-3.5" aria-hidden="true" /></Link>}
      </div>
      {results.length > 0 && <ul className="space-y-0.5 pl-5.5">{results.map(([channel, result]) => <ResultLine key={channel} channel={channel} result={result} />)}</ul>}
    </div>
  );
}

function AddReferralForm({ recordId, onDone, onCancel }: { recordId: string; onDone: (message: string) => void; onCancel: () => void }) {
  const [fields, setFields] = useState<Fields>(() => fieldsOf());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    const invalid = validate(fields);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    setError("");
    const body: ReferralCreateRequest = {
      name: orNull(fields.name), email: orNull(fields.email), phone: orNull(fields.phone), linkedinUrl: orNull(fields.linkedinUrl),
      role: orNull(fields.role), companyName: orNull(fields.companyName), anonymous: fields.anonymous,
    };
    try { await crmFetch<Referral>(`/records/${recordId}/referrals`, { method: "POST", body: JSON.stringify(body) }); onDone("Referral added"); }
    catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  };
  return (
    <div className="space-y-3 px-4 py-3">
      <ReferralFields fields={fields} onChange={setFields} />
      {error && <p role="alert" className="text-paragraph-xs text-error-base">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} className={cn(primaryButtonClass, "h-8")} onClick={() => void submit()}>Add referral</button>
        <button type="button" disabled={busy} className={cn(secondaryButtonClass, "h-8")} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * The record's referrals: pending ones to act on, started ones with what
 * happened per channel, dismissed ones as a muted line. Shown when there are
 * referrals; with none, only a small "Add referral" button.
 * `onChanged` receives a success message and should reload the record.
 */
export function ReferralCard({ recordId, referrals, onChanged }: { recordId: string; referrals: Referral[]; onChanged: (message: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [targets, setTargets] = useState<ReferralTargetsResponse | null>(null);
  const [targetsError, setTargetsError] = useState("");
  const hasPending = referrals.some((referral) => referral.status === "pending");

  useEffect(() => {
    if (!hasPending || targets) return;
    let cancelled = false;
    crmFetch<ReferralTargetsResponse>("/referrals/targets")
      .then((result) => { if (!cancelled) setTargets(result); })
      .catch((cause) => { if (!cancelled) setTargetsError(errorMessage(cause)); });
    return () => { cancelled = true; };
  }, [hasPending, targets]);

  const done = (message: string) => { setAdding(false); onChanged(message); };

  if (!referrals.length && !adding) {
    return <div><button type="button" className="inline-flex items-center gap-1 text-label-xs text-text-sub-600 hover:text-text-strong-950" onClick={() => setAdding(true)}><RiAddLine className="size-3.5" aria-hidden="true" />Add referral</button></div>;
  }
  return (
    <Frame>
      <FrameHeader
        title="Referrals"
        description={hasPending ? "Someone this lead pointed us to." : undefined}
        actions={!adding ? <button type="button" className={cn(secondaryButtonClass, "h-7 px-2 text-label-xs")} onClick={() => setAdding(true)}><RiAddLine className="size-3.5" aria-hidden="true" />Add referral</button> : undefined}
      />
      <FramePanel className="divide-y divide-stroke-soft-200 p-0 sm:p-0">
        {adding && <AddReferralForm recordId={recordId} onDone={done} onCancel={() => setAdding(false)} />}
        {referrals.map((referral) => referral.status === "pending"
          ? <PendingReferral key={referral.id} referral={referral} targets={targets} targetsError={targetsError} onChanged={done} />
          : referral.status === "started"
            ? <StartedReferral key={referral.id} referral={referral} />
            : <p key={referral.id} className="flex items-center gap-1.5 px-4 py-2 text-paragraph-xs text-text-soft-400"><RiUserSharedLine className="size-3.5" aria-hidden="true" />{referralLabel(referral)} · referral dismissed</p>)}
      </FramePanel>
    </Frame>
  );
}

/**
 * The Action required row's version: who was referred and how to reach them,
 * Start outreach (opens the record, where campaigns are picked) and Dismiss.
 */
export function ReferralRowTools({ referral, href, busy, onMutate }: {
  referral: ReferralSummary;
  href: string;
  busy: boolean;
  onMutate: RowMutation;
}) {
  const label = referralLabel(referral);
  return (
    <div className="space-y-1.5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-label-sm text-text-strong-950"><RiUserSharedLine className="size-4 shrink-0 text-text-soft-400" aria-hidden="true" />{label}</p>
        <div className="mt-1"><ReferralChips referral={referral} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={href} className={cn(primaryButtonClass, "h-8")}>Start outreach</Link>
        <button type="button" disabled={busy} className={dangerButtonClass} onClick={() => void onMutate(`/referrals/${referral.id}/dismiss`, {}, "POST", "Referral dismissed")}>Dismiss</button>
      </div>
    </div>
  );
}
