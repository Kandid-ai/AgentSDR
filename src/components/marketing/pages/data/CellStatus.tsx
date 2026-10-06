"use client";

import { RiCheckboxCircleFill, RiErrorWarningFill, RiLoader4Line } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { monoFont } from "../../../landing/ui";
import { DataStage, Panel } from "./kit";

/*
 * One cell's life, and a failing one's retries: up to 3 attempts, 2 s then
 * 8 s apart (docs/tables/overview.mdx). Times are compressed for the loop.
 */
const CYCLE = 11_000;
const FINAL = 8_600;
const STATES = [
  { at: 0, label: "Not run" },
  { at: 800, label: "Queued…" },
  { at: 1_600, label: "Running…" },
  { at: 2_600, label: "Waiting for provider…" },
  { at: 3_800, label: "Completed" },
];
const ATTEMPTS = [
  { at: 4_600, ok: false, label: "Attempt 1", note: "503 from provider" },
  { at: 5_900, ok: false, label: "Attempt 2", note: "after a 2 s wait" },
  { at: 7_400, ok: true, label: "Attempt 3", note: "after an 8 s wait" },
];

export function CellStatus({ className }: { className?: string }) {
  return (
    <DataStage label="A table cell moving from queued to completed, and a failing cell retrying. An illustration with sample data." cycle={CYCLE} final={FINAL} className={className}>
      {({ t }) => {
        const state = [...STATES].reverse().find((s) => t >= s.at) ?? STATES[0];
        const retrying = t >= ATTEMPTS[0].at - 200;
        const done = state.label === "Completed";
        return (
          <Panel className="max-w-[460px]" title="Cell status">
            <div className="grid gap-4 px-4 py-4">
              <div>
                <p className={cn(monoFont, "text-[10px] uppercase tracking-[0.05em] text-[#8a8a8a]")}>Work email · row 1</p>
                <div className="mt-1.5 flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] ring-1 ring-black/[0.08]">
                  {done ? <RiCheckboxCircleFill className="size-4 text-[#1fc16b]" aria-hidden="true" /> : state.at >= 1_600 ? <RiLoader4Line className="size-4 animate-spin text-[#335cff] motion-reduce:animate-none" aria-hidden="true" /> : <span aria-hidden="true" className="size-3.5 rounded-full border border-dashed border-[#cacfd8]" />}
                  <span className={done ? "font-medium text-[#141414]" : "text-[#707070]"}>{done ? "hannah@lumen-freight.example" : state.label}</span>
                </div>
                <div className="mt-2 flex gap-1" aria-hidden="true">
                  {STATES.map((s) => (
                    <span key={s.label} className="h-1 flex-1 rounded-full transition-colors duration-500" style={{ background: t >= s.at ? "#335cff" : "#e6e8ec" }} />
                  ))}
                </div>
              </div>
              <div className={cn("transition-opacity duration-500", retrying ? "opacity-100" : "opacity-30")}>
                <p className={cn(monoFont, "text-[10px] uppercase tracking-[0.05em] text-[#8a8a8a]")}>Work email · row 2, a flaky provider</p>
                <ul className="mt-1.5 grid gap-1.5">
                  {ATTEMPTS.map((a) => {
                    const on = t >= a.at;
                    return (
                      <li key={a.label} className="flex items-center gap-2 text-[12px] transition-opacity duration-500" style={{ opacity: on ? 1 : 0.35 }}>
                        {on ? a.ok ? <RiCheckboxCircleFill className="size-4 text-[#1fc16b]" aria-hidden="true" /> : <RiErrorWarningFill className="size-4 text-[#fb3748]" aria-hidden="true" /> : <span aria-hidden="true" className="size-3.5 rounded-full border border-dashed border-[#cacfd8]" />}
                        <span className="font-medium text-[#141414]">{a.label}</span>
                        <span className="text-[#707070]">{a.ok ? "Completed" : "Failed"} · {a.note}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <p className="border-t border-black/[0.06] bg-[#fbfbfc] px-4 py-3 text-[12px] leading-5 text-[#656565]">Only the final failure shows on the cell. A bad URL, a 4xx or a missing environment variable is not retried.</p>
          </Panel>
        );
      }}
    </DataStage>
  );
}
