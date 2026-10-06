"use client";

import { RiArrowRightLine, RiCheckboxCircleFill, RiFileExcel2Line } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { monoFont } from "../../../landing/ui";
import { tween } from "../../../landing/motion/timeline";
import { Chip, DataStage, Panel, Show } from "./kit";

/*
 * A campaign lead import: every column of the file next to a sample value,
 * a Platform field picked for each (extra columns kept as variables), then
 * the result counts. Sample data; the counts are illustrative.
 */
const COLUMNS = [
  { header: "Email", sample: "hannah@lumen-freight.example", field: "Email", keep: false },
  { header: "First Name", sample: "Hannah", field: "First name", keep: false },
  { header: "Job Title", sample: "Head of Growth", field: "Job title", keep: false },
  { header: "Website", sample: "lumen-freight.example", field: "Company domain", keep: false },
  { header: "Linkedin Url", sample: "linkedin.com/in/hweiss", field: "LinkedIn URL", keep: false },
  { header: "Company Size", sample: "51-200", field: "Keep as variable", keep: true, merge: "{{companySize}}" },
] as const;
const MAP_AT = (i: number) => 700 + i * 520;
const RESULT_AT = 4_600;
const CYCLE = 10_000;
const FINAL = 6_400;

export function ImportMapping({ className }: { className?: string }) {
  return (
    <DataStage label="A CSV's columns being mapped to lead fields. An illustration with sample data." cycle={CYCLE} final={FINAL} className={className}>
      {({ t }) => {
        const mapped = COLUMNS.filter((_, i) => t >= MAP_AT(i)).length;
        const done = t >= RESULT_AT;
        const n = (v: number) => Math.round(tween(t, RESULT_AT, 900, 0, v));
        return (
          <Panel
            className="max-w-[760px]"
            title="Map columns"
            right={
              <span className="flex items-center gap-1.5 rounded-md bg-[#f7f7f8] px-1.5 py-0.5 text-[11px] text-[#656565] ring-1 ring-inset ring-black/[0.06]">
                <RiFileExcel2Line className="size-3.5 text-[#1fc16b]" aria-hidden="true" /> leads-q4.csv
              </span>
            }
          >
            <div className={cn(monoFont, "grid grid-cols-[1fr_20px_1fr] items-center gap-x-2 px-4 pb-1.5 pt-3 text-[10px] uppercase tracking-[0.05em] text-[#8a8a8a] sm:grid-cols-[1.1fr_1.3fr_28px_1fr]")}>
              <span>Your column</span>
              <span className="hidden sm:block">Sample value</span>
              <span />
              <span>Platform field</span>
            </div>
            <ul className="px-4 pb-3">
              {COLUMNS.map((c, i) => {
                const on = t >= MAP_AT(i);
                return (
                  <li key={c.header} className="grid grid-cols-[1fr_20px_1fr] items-center gap-x-2 border-t border-black/[0.05] py-2 text-[12px] sm:grid-cols-[1.1fr_1.3fr_28px_1fr]">
                    <span className="font-medium text-[#141414]">{c.header}</span>
                    <span className="hidden truncate text-[#707070] sm:block">{c.sample}</span>
                    <RiArrowRightLine className="size-3.5 text-[#b0b4bd] transition-colors duration-300" style={{ color: on ? (c.keep ? "#fa7319" : "#335cff") : undefined }} aria-hidden="true" />
                    <span className="relative flex h-7 items-center">
                      <span className={cn("absolute inset-0 flex items-center rounded-lg border border-dashed border-[#cacfd8] px-2 text-[#9aa0aa] transition-opacity duration-300", on && "opacity-0")}>Choose…</span>
                      <Show when={on} y={4} className="relative flex min-w-0 items-center gap-1.5">
                        <Chip tone={c.keep ? "orange" : "blue"}>{c.field}</Chip>
                        {"merge" in c && <Chip mono>{c.merge}</Chip>}
                      </Show>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] bg-[#fbfbfc] px-4 py-3">
              <span className="text-[12px] text-[#656565]">
                <span className="tabular-nums font-medium text-[#141414]">{mapped}</span> of {COLUMNS.length} columns mapped
              </span>
              {done ? (
                <Show when className="flex flex-wrap items-center justify-end gap-1.5">
                  <RiCheckboxCircleFill className="size-4 text-[#1fc16b]" aria-hidden="true" />
                  <Chip tone="green">{n(412)} imported</Chip>
                  <Chip>{n(9)} duplicate</Chip>
                  <Chip>{n(3)} suppressed</Chip>
                  <Chip tone="red">{n(2)} failed</Chip>
                </Show>
              ) : (
                <span className={cn("rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-300", mapped === COLUMNS.length ? "bg-[#335cff]" : "bg-[#335cff]/40")}>Import</span>
              )}
            </div>
          </Panel>
        );
      }}
    </DataStage>
  );
}
