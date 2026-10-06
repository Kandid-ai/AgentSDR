"use client";

import type { ComponentType, ReactNode } from "react";
import {
  RiAddLine,
  RiBookOpenLine,
  RiCheckboxCircleFill,
  RiCommandLine,
  RiDatabase2Line,
  RiDraftLine,
  RiFileExcel2Line,
  RiKey2Line,
  RiLoader4Line,
  RiShieldCheckLine,
  RiSparkling2Line,
  RiStackLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import { InboxAvatar, Kbd } from "@/components/inbox/shell/InboxShell";
import { cn } from "@/utils/cn";
import styles from "./landing.module.css";
import { Stage } from "./motion/Stage";
import { at, count, flag, within } from "./motion/timeline";
import vs from "./motion/vignettes.module.css";
import { Reveal } from "./Reveal";
import { monoFont, SectionHead } from "./ui";

/**
 * The data layer and the rules the AI plays by: two grey cards in the
 * reference's style (a live vignette over a centred title and a short
 * caption) for the lead database and enrichment tables, then six principles
 * on a hairline grid. The vignettes are the app's own pieces over sample
 * data. Channels have their own section (./Channels).
 */

export function Features() {
  return (
    <section id="product" aria-labelledby="product-title" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <Reveal>
        <SectionHead
          id="product-title"
          eyebrow="Data & AI"
          title="Built on data you own"
          lede="One database of people and companies feeds every channel, and every AI step runs on your own model key."
        />
      </Reveal>

      <div className="mx-auto mt-12 grid max-w-[1128px] gap-4 px-4 sm:mt-16 sm:gap-6 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <Card title="One lead database for every channel" body="People and companies shared by every channel. Import CSV or XLSX, add your own columns, merge duplicates.">
            <LeadsVignette />
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card title="Enrichment tables with AI columns" body="Columns that call an API, run a formula, ask your model or pull from Apollo — then become a campaign.">
            <TablesVignette />
          </Card>
        </Reveal>
      </div>

      <Reveal className="mx-auto mt-4 max-w-[1128px] px-4 sm:mt-6 sm:px-6">
        <ul className="grid overflow-hidden rounded-3xl bg-black/[0.06] [gap:1px] ring-1 ring-black/[0.06] sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map((p) => (
            <Point key={p.title} {...p} />
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

// ---------------------------------------------------------------- card

/** `top` pins a tall vignette to the top of its well (the bottom fades out) instead of centring it. */
export function Card({ id, title, body, children, top = false }: { id?: string; title: string; body: string; children: ReactNode; top?: boolean }) {
  return (
    <article id={id} className="flex h-full scroll-mt-28 flex-col overflow-hidden rounded-3xl bg-[#3737370b]">
      <div className={cn(styles.fadeBottom, "relative flex h-[320px] justify-center overflow-hidden px-4 pt-8 sm:h-[360px] sm:px-10 sm:pt-10", top ? "items-start" : "items-center")}>{children}</div>
      <div className="px-6 pb-9 pt-7 text-center sm:px-10">
        <h3 className="text-[16px] font-medium leading-[26px] text-[#141414]">{title}</h3>
        <div aria-hidden="true" className="mx-auto my-5 h-px w-3/5 bg-black/[0.07]" />
        <p className="text-pretty text-[14px] leading-[22px] text-[#656565]">{body}</p>
      </div>
    </article>
  );
}

/** The white slab a vignette sits on (the reference's frosted inner card). */
export function Slab({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(styles.slab, "w-full max-w-[360px] rounded-[14px] p-4 text-left sm:p-5", className)}>{children}</div>;
}

// ---------------------------------------------------------------- vignettes

const LEADS = [
  { name: "Hannah Weiss", company: "Lumen Freight", title: "Head of Growth", source: "CSV import" },
  { name: "Rafael Costa", company: "Brightloop", title: "VP Sales", source: "LinkedIn search" },
  { name: "Aiko Tanaka", company: "Kestrel Health", title: "Growth Lead", source: "Table" },
  { name: "Samir Haddad", company: "Parcelly", title: "COO", source: "CSV import" },
];

/*
 * Leads: the rows import one by one out of leads-q4.xlsx (the count ticking
 * up as each lands), then the "Add a column" hint lights up.
 */
const LEADS_LOOP = { cycle: 11_000, final: 3_600 };
const LEAD_ROW_AT = [500, 880, 1_260, 1_640];
const IMPORTING = { at: 200, ms: 1_900 };
const ADD_COLUMN_AT = 2_400;
const PEOPLE_BEFORE = 4_812 - LEADS.length;

function LeadsVignette() {
  return (
    <Stage {...LEADS_LOOP}>
      {({ t }) => (
        <Slab className="max-w-[380px] p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-stroke-soft-200 px-4 py-3">
            <span className={cn(monoFont, "text-[11px] font-medium uppercase tracking-[0.03em] text-[#656565]")}>People · {(PEOPLE_BEFORE + count(t, LEAD_ROW_AT)).toLocaleString("en-US")}</span>
            <span className={cn(vs.glow, "flex items-center gap-1 rounded-md bg-bg-weak-50 px-1.5 py-0.5 text-[11px] text-[#656565] ring-1 ring-inset ring-stroke-soft-200")} data-on={flag(within(t, IMPORTING.at, IMPORTING.ms))}>
              <RiFileExcel2Line className="size-3.5 text-[#1fc16b]" aria-hidden="true" /> leads-q4.xlsx
            </span>
          </div>
          <table className="w-full table-fixed text-left text-[12px]">
            <thead>
              <tr className="text-[#707070]">
                <th scope="col" className="w-[40%] px-4 py-2 font-normal">Name</th>
                <th scope="col" className="px-2 py-2 font-normal">
                  <span className="inline-flex items-center gap-1 rounded bg-[#335cff]/10 px-1.5 text-[#335cff]">Job title</span>
                </th>
                <th scope="col" className="w-[30%] py-2 pr-4 font-normal">Source</th>
              </tr>
            </thead>
            <tbody>
              {LEADS.map((l, i) => (
                <tr key={l.name} className={cn(vs.drop, "border-t border-stroke-soft-200")} data-on={at(t, LEAD_ROW_AT[i])}>
                  <td className="px-4 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <InboxAvatar name={l.name} size="xs" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[#141414]">{l.name}</span>
                        <span className="block truncate text-[11px] text-[#707070]">{l.company}</span>
                      </span>
                    </span>
                  </td>
                  <td className="truncate px-2 py-2 text-[#3a3a3a]">{l.title}</td>
                  <td className="truncate py-2 pr-4 text-[#656565]">{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={cn(vs.wash, vs.washFlush, "border-t border-stroke-soft-200")} data-on={flag(within(t, ADD_COLUMN_AT, 1_100))}>
            <div className={cn(vs.fade, "relative flex items-center gap-1.5 px-4 py-2.5 text-[12px] text-[#656565]")} data-on={at(t, ADD_COLUMN_AT)}>
              <RiAddLine className="size-3.5" aria-hidden="true" /> Add a column <span className="text-[#707070]">— text, number, date, select…</span>
            </div>
          </div>
        </Slab>
      )}
    </Stage>
  );
}

type CellStatus = "done" | "running" | "queued";
type Cell = { text: string; state?: CellStatus };

/*
 * The table at rest: two rows enriched, the third's pitch angle being
 * written, the fourth's headcount being looked up, the last still queued.
 * `run` and `done` are when each cell starts and finishes in the loop
 * (never = still going at rest).
 */
const NEVER = Number.POSITIVE_INFINITY;
const GRID: Array<{ company: string; domain: string; size: Cell & { run: number; done: number }; angle: Cell & { run: number; done: number } }> = [
  { company: "Lumen Freight", domain: "lumen-freight.example", size: { text: "51–200", state: "done", run: 300, done: 800 }, angle: { text: "Hiring 2 SDRs — onboarding cost", state: "done", run: 800, done: 1_700 } },
  { company: "Brightloop", domain: "brightloop.example", size: { text: "11–50", state: "done", run: 1_100, done: 1_600 }, angle: { text: "New VP Sales, rebuilding outbound", state: "done", run: 1_700, done: 2_600 } },
  { company: "Kestrel Health", domain: "kestrel.example", size: { text: "201–500", state: "done", run: 2_000, done: 2_500 }, angle: { text: "Writing…", state: "running", run: 2_600, done: NEVER } },
  { company: "Parcelly", domain: "parcelly.example", size: { text: "…", state: "running", run: 2_900, done: NEVER }, angle: { text: "Queued", state: "queued", run: NEVER, done: NEVER } },
  { company: "Atelier Nord", domain: "ateliernord.example", size: { text: "Queued", state: "queued", run: NEVER, done: NEVER }, angle: { text: "Queued", state: "queued", run: NEVER, done: NEVER } },
];
const TABLES_LOOP = { cycle: 10_000, final: 3_200 };
const RUNNING_TEXT = { size: "…", angle: "Writing…" } as const;

/** A cell at time `t`: queued, then running, then its value. */
function cellAt(cell: Cell & { run: number; done: number }, kind: "size" | "angle", t: number): Cell {
  if (t >= cell.done) return cell;
  if (t >= cell.run) return { text: RUNNING_TEXT[kind], state: "running" };
  return { text: "Queued", state: "queued" };
}

function CellState({ cell }: { cell: Cell }) {
  if (cell.state === "running") return <RiLoader4Line className="size-3.5 shrink-0 animate-spin text-[#335cff] motion-reduce:animate-none" aria-hidden="true" />;
  if (cell.state === "done") return <RiCheckboxCircleFill className="size-3.5 shrink-0 text-[#1fc16b]" aria-hidden="true" />;
  return <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border border-dashed border-[#cacfd8]" />;
}

/** One enrichment cell; `entering` lets a just-changed state settle in rather than snap. */
function GridCell({ cell, entering, muted }: { cell: Cell; entering: boolean; muted: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 border-l border-stroke-soft-200 px-2 py-2 text-[#3a3a3a]">
      <span key={cell.state} className={cn("flex min-w-0 items-center gap-1.5", entering && vs.enter)}>
        <CellState cell={cell} />
        <span className={cn("truncate", muted && "text-[#707070]")}>{cell.text}</span>
      </span>
    </span>
  );
}

function TablesVignette() {
  return (
    <Stage {...TABLES_LOOP}>
      {({ t, live }) => {
        const rows = GRID.map((r) => ({ company: r.company, size: cellAt(r.size, "size", t), angle: cellAt(r.angle, "angle", t) }));
        // Only a state that changed a moment ago animates in (never the frame a card mounts on).
        const entering = (cell: { run: number; done: number }) => live && (within(t, cell.run, 400) || within(t, cell.done, 400));
        const enriched = rows.filter((r) => r.size.state === "done").length;
        return (
          <Slab className="max-w-[400px] p-0 sm:p-0">
            <div className="grid grid-cols-[1fr_0.8fr_1.35fr] border-b border-stroke-soft-200 text-[11px]">
              <span className="px-3 py-2 text-[#707070]">Company</span>
              <span className="flex items-center gap-1 border-l border-stroke-soft-200 px-2 py-2 text-[#656565]">
                <RiDatabase2Line className="size-3.5 text-[#fa7319]" aria-hidden="true" /> Employees
              </span>
              <span className="flex items-center gap-1 border-l border-stroke-soft-200 px-2 py-2 text-[#656565]">
                <RiSparkling2Line className="size-3.5 text-[#7d52f4]" aria-hidden="true" /> AI · Pitch angle
              </span>
            </div>
            {rows.map((r, i) => (
              <div key={r.company} className={cn("grid grid-cols-[1fr_0.8fr_1.35fr] text-[12px]", i > 0 && "border-t border-stroke-soft-200")}>
                <span className="min-w-0 px-3 py-2">
                  <span className="block truncate font-medium text-[#141414]">{r.company}</span>
                </span>
                <GridCell cell={r.size} entering={entering(GRID[i].size)} muted={r.size.state === "queued"} />
                <GridCell cell={r.angle} entering={entering(GRID[i].angle)} muted={r.angle.state !== "done"} />
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 border-t border-stroke-soft-200 px-3 py-2.5">
              <span className="text-[11px] text-[#656565]">{enriched} of 5 enriched</span>
              <Badge.Root size="small" variant="lighter" color="blue">
                <Badge.Icon as={RiStackLine} />
                Create campaign from table
              </Badge.Root>
            </div>
          </Slab>
        );
      }}
    </Stage>
  );
}

// ---------------------------------------------------------------- points

const POINTS: Array<{ icon: ComponentType<{ className?: string }>; title: string; body: ReactNode }> = [
  { icon: RiKey2Line, title: "Bring your own model", body: "Every AI call runs on your OpenRouter key, pinned to the provider you chose — no silent fallbacks." },
  { icon: RiDatabase2Line, title: "Your data stays yours", body: "Leads, conversations and call recordings live in your Postgres and your own storage bucket." },
  { icon: RiShieldCheckLine, title: "Guardrails on every channel", body: "Daily caps, sending windows, warm-up for new numbers, and Do Not Contact honoured everywhere." },
  { icon: RiDraftLine, title: "Drafts, not auto-sends", body: "The AI proposes and a person approves. Low-confidence classifications wait for review." },
  { icon: RiBookOpenLine, title: "Grounded in what you know", body: "Drafts draw on your knowledge base: pricing, FAQs, case studies and objections." },
  {
    icon: RiCommandLine,
    title: "Keyboard-first",
    body: (
      <>
        <Kbd>⌘K</Kbd> jumps anywhere; <Kbd>J</Kbd> and <Kbd>K</Kbd> move through an inbox, <Kbd>Enter</Kbd> opens.
      </>
    ),
  },
];

function Point({ icon: Icon, title, body }: { icon: ComponentType<{ className?: string }>; title: string; body: ReactNode }) {
  return (
    <li className="flex flex-col bg-white px-6 py-7 sm:px-8 sm:py-8">
      <IconTile icon={Icon} />
      <p className="mt-5 text-[16px] font-medium leading-6 text-[#141414]">{title}</p>
      <p className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">{body}</p>
    </li>
  );
}

/** The page's one icon tile: a line icon in AgentSDR blue on a faint blue square. */
export function IconTile({ icon: Icon, className }: { icon: ComponentType<{ className?: string }>; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#335cff]/[0.07] text-[#335cff] ring-1 ring-inset ring-[#335cff]/[0.14]", className)}>
      <Icon className="size-5" />
    </span>
  );
}
