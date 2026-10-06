"use client";

import { RiArrowRightLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { Chip, DataStage, Panel, Show, type Tone } from "./kit";

/*
 * How an import decides what to do with each row: match on email, then on
 * LinkedIn, never merge two people silently. Sample data.
 */
const ROWS: Array<{ incoming: string; rule: string; outcome: string; tone: Tone; note?: string }> = [
  { incoming: "hannah@lumen-freight.example", rule: "Email matches Hannah Weiss", outcome: "Updated", tone: "blue" },
  { incoming: "linkedin.com/in/rcosta (no email)", rule: "LinkedIn matches Rafael Costa", outcome: "Updated", tone: "blue" },
  { incoming: "aiko@kestrel.example", rule: "Nobody with this email or profile", outcome: "Created", tone: "green" },
  { incoming: "samir@parcelly.example + a profile of someone else", rule: "Email and LinkedIn belong to two people", outcome: "Failed", tone: "red", note: "Merge them first" },
];
const CYCLE = 9_000;
const FINAL = 5_600;
const at = (i: number) => 700 + i * 1_100;

export function MatchRows({ className }: { className?: string }) {
  return (
    <DataStage label="Import rows matched to existing people by email, then LinkedIn. An illustration with sample data." cycle={CYCLE} final={FINAL} className={className}>
      {({ t }) => (
        <Panel className="max-w-[560px]" title="Import result" right={<Chip>leads-q4.xlsx</Chip>}>
          <ul>
            {ROWS.map((r, i) => (
              <Show key={r.incoming} when={t >= at(i)} className="border-b border-black/[0.05] px-4 py-3 last:border-b-0">
                <p className="truncate font-mono text-[12px] text-[#141414]">{r.incoming}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[12px] text-[#707070]">
                  <RiArrowRightLine className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{r.rule}</span>
                  <Chip tone={r.tone}>{t >= at(i) + 350 ? r.outcome : "Matching…"}</Chip>
                </div>
                {r.note && <p className={cn("mt-1 pl-5 text-[11px] text-[#c4202f] transition-opacity duration-500", t >= at(i) + 350 ? "opacity-100" : "opacity-0")}>{r.note}</p>}
              </Show>
            ))}
          </ul>
          <p className="border-t border-black/[0.06] bg-[#fbfbfc] px-4 py-3 text-[12px] text-[#656565]">A blank cell never erases what is already stored. One bad row never blocks the rest.</p>
        </Panel>
      )}
    </DataStage>
  );
}
