"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RiCheckboxCircleFill, RiFlashlightLine, RiFunctionLine, RiGlobalLine, RiSparkling2Line } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { Showcase } from "../../../landing/Showcase";
import { useReducedMotion } from "../../../landing/motion/Stage";
import { monoFont } from "../../../landing/ui";
import { Chip } from "./kit";

/*
 * The four run columns, one tab each, with the config on the left and the
 * cell it produces on the right. Tabs advance on their own until someone
 * picks one. Sample data.
 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-3">
      <span className={cn(monoFont, "text-[10px] uppercase tracking-[0.05em] text-[#8a8a8a]")}>{label}</span>
      <div className="min-w-0 text-[12px] text-[#141414]">{children}</div>
    </div>
  );
}
function Box({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <div className={cn("overflow-x-auto whitespace-pre rounded-lg bg-[#f7f7f8] px-2.5 py-1.5 text-[12px] ring-1 ring-inset ring-black/[0.05]", mono && monoFont)}>{children}</div>;
}
function Token({ children }: { children: string }) {
  return <span className="rounded bg-[#335cff]/10 px-1 text-[#2547d0]">{children}</span>;
}

type Tab = { id: string; label: string; icon: typeof RiGlobalLine; accent: string; blurb: string; result: string; resultLabel: string; body: ReactNode };
const TABS: Tab[] = [
  {
    id: "enrich",
    label: "Enrichment",
    icon: RiFlashlightLine,
    accent: "#fa7319",
    blurb: "Pick a provider action, map its inputs to your columns, tick the outputs you want. Each output becomes a column.",
    resultLabel: "Work email",
    result: "hannah@lumen-freight.example",
    body: (
      <>
        <Field label="Provider"><Chip tone="orange">Apollo.io</Chip> <span className="ml-1 text-[#707070]">Find work email</span></Field>
        <Field label="Account"><Box>Lumen team key</Box></Field>
        <Field label="Inputs"><Box mono>Full name  ←  <Token>Full name</Token>{"\n"}Domain     ←  <Token>Company domain</Token></Box></Field>
        <Field label="Outputs"><span className="flex flex-wrap gap-1.5"><Chip tone="green">Work email</Chip><Chip tone="green">Email status</Chip></span></Field>
      </>
    ),
  },
  {
    id: "ai",
    label: "Use AI",
    icon: RiSparkling2Line,
    accent: "#7d52f4",
    blurb: "Prompt a model per row on your own OpenRouter key. Every output field you define becomes its own column.",
    resultLabel: "Pitch angle",
    result: "Hiring two SDRs, onboarding cost",
    body: (
      <>
        <Field label="Use case"><Chip tone="purple">Web research</Chip></Field>
        <Field label="Model"><Box>One of the models you allowed</Box></Field>
        <Field label="Prompt"><Box>{"For {{company_domain}}, find one recent\nsign they are growing their sales team."}</Box></Field>
        <Field label="Outputs"><span className="flex flex-wrap gap-1.5"><Chip mono>pitch_angle · Text</Chip></span></Field>
      </>
    ),
  },
  {
    id: "http",
    label: "HTTP API",
    icon: RiGlobalLine,
    accent: "#335cff",
    blurb: "Call any endpoint per row. Tokens work in the URL, headers and body, and the secret stays in a server environment variable.",
    resultLabel: "Employees",
    result: "184",
    body: (
      <>
        <Field label="Request"><Box mono>GET  https://api.example.com/companies/{"{{company_domain}}"}</Box></Field>
        <Field label="Credential"><Box mono>MY_VENDOR_KEY  →  Authorization: Bearer …</Box></Field>
        <Field label="Response path"><Box mono>data.employees</Box></Field>
        <Field label="On failure"><span className="text-[#707070]">5xx and 429 retry; other 4xx do not</span></Field>
      </>
    ),
  },
  {
    id: "formula",
    label: "Formula",
    icon: RiFunctionLine,
    accent: "#0b8a7a",
    blurb: "One expression per row over {{column}} tokens. It runs in a WebAssembly sandbox with no network or filesystem, and a time limit.",
    resultLabel: "Fit",
    result: "Mid-market",
    body: (
      <>
        <Field label="Expression"><Box mono>{"{{employees}} > 50 ? \"Mid-market\" : \"SMB\""}</Box></Field>
        <Field label="Libraries"><span className="flex flex-wrap gap-1.5"><Chip>JavaScript</Chip><Chip>FormulaJS</Chip><Chip>lodash</Chip><Chip>moment</Chip></span></Field>
        <Field label="Cross-table"><Box mono>{"LOOKUP(\"Accounts\", {{domain}}, \"Domain\", \"Tier\")"}</Box></Field>
        <Field label="Sandbox"><span className="text-[#707070]">QuickJS in WebAssembly, 1 s per evaluation</span></Field>
      </>
    ),
  },
];
const DWELL = 6_000;

export function ColumnTypes({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [shownFor, setShownFor] = useState(-1);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !auto) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % TABS.length), DWELL);
    return () => window.clearInterval(id);
  }, [auto, reduced]);
  useEffect(() => {
    const id = window.setTimeout(() => setShownFor(active), reduced ? 0 : 900);
    return () => window.clearTimeout(id);
  }, [active, reduced]);

  const shown = shownFor === active;
  const tab = TABS[active];
  return (
    <Showcase label="The four kinds of run column in a table: enrichment, AI, HTTP API and formula. An illustration with sample data." className={className}>
      <div className="overflow-hidden rounded-[28px] bg-[#f7f7f8] p-3 ring-1 ring-black/[0.04] sm:p-5">
        <div role="tablist" aria-label="Column types" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const on = i === active;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                data-showcase-allow
                onClick={() => {
                  setAuto(false);
                  setActive(i);
                }}
                className={cn("flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#335cff]", on ? "bg-white text-[#141414] shadow-[0_0_0_1px_rgb(20_20_20/0.06),0_4px_12px_-6px_rgb(14_18_27/0.2)]" : "text-[#656565] hover:bg-white/60")}
              >
                <Icon className="size-4" style={{ color: t.accent }} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(20_20_20/0.06)]">
            <p className="text-[14px] leading-[22px] text-[#5c5c5c]">{tab.blurb}</p>
            <div className="mt-4 grid gap-3">{tab.body}</div>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgb(20_20_20/0.06)]">
            <p className={cn(monoFont, "text-[10px] uppercase tracking-[0.05em] text-[#8a8a8a]")}>Result in the table</p>
            <p className="mt-3 text-[11px] text-[#707070]">{tab.resultLabel}</p>
            <div className="mt-1 flex min-h-9 items-center gap-2 rounded-lg px-3 ring-1 ring-black/[0.08] transition-colors duration-300" style={{ background: shown ? `color-mix(in srgb, ${tab.accent} 6%, white)` : "#fbfbfc" }}>
              {shown ? (
                <>
                  <RiCheckboxCircleFill className="size-4 shrink-0 text-[#1fc16b]" aria-hidden="true" />
                  <span className="truncate text-[13px] font-medium text-[#141414]">{tab.result}</span>
                </>
              ) : (
                <span className="text-[12px] text-[#9aa0aa]">Running…</span>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-[#8a8a8a]">Click a cell to see its provider, outcome, latency and error.</p>
          </div>
        </div>
      </div>
    </Showcase>
  );
}
