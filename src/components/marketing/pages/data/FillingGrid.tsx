"use client";

import { RiCheckboxCircleFill, RiLoader4Line, RiSparkling2Line, RiFlashlightLine, RiFunctionLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { monoFont } from "../../../landing/ui";
import { Chip, DataStage, Panel } from "./kit";

/*
 * An enrichment table filling in column by column: two input columns, then
 * Apollo (email, employees), an AI column and a formula, each waiting for
 * what it reads. Fictional people and companies.
 */
type Kind = "input" | "enrich" | "ai" | "formula";
const COLS: Array<{ key: string; label: string; kind: Kind; source?: string }> = [
  { key: "domain", label: "Company domain", kind: "input" },
  { key: "name", label: "Full name", kind: "input" },
  { key: "email", label: "Work email", kind: "enrich", source: "Apollo" },
  { key: "size", label: "Employees", kind: "enrich", source: "Apollo" },
  { key: "angle", label: "Pitch angle", kind: "ai", source: "Use AI" },
  { key: "fit", label: "Fit", kind: "formula", source: "Formula" },
];
const ROWS = [
  { domain: "lumen-freight.example", name: "Hannah Weiss", email: "hannah@lumen-freight.example", size: "184", angle: "Hiring two SDRs, onboarding cost", fit: "Mid-market" },
  { domain: "brightloop.example", name: "Rafael Costa", email: "rafael@brightloop.example", size: "42", angle: "New VP Sales rebuilding outbound", fit: "SMB" },
  { domain: "kestrel.example", name: "Aiko Tanaka", email: "aiko@kestrel.example", size: "310", angle: "Opening a second clinic region", fit: "Mid-market" },
  { domain: "parcelly.example", name: "Samir Haddad", email: "samir@parcelly.example", size: "97", angle: "Same-day delivery launch", fit: "Mid-market" },
  { domain: "ateliernord.example", name: "Ingrid Solberg", email: "ingrid@ateliernord.example", size: "18", angle: "Wholesale channel is new", fit: "SMB" },
] as const;
const COL_START = [0, 0, 1_200, 1_200, 3_400, 5_000]; // when each run column begins
const ROW_GAP = 260;
const RUN_MS = 700;
const END = 6_800;
const CYCLE = 11_600;
const FINAL = 7_600;

type State = "idle" | "queued" | "running" | "done";
function stateOf(t: number, c: number, r: number): State {
  if (c < 2) return t >= 200 + r * 120 ? "done" : "idle";
  const start = COL_START[c] + r * ROW_GAP;
  if (t >= start + RUN_MS) return "done";
  if (t >= start) return "running";
  return t >= COL_START[c] - 400 ? "queued" : "idle";
}

function KindIcon({ kind }: { kind: Kind }) {
  const cls = "size-3.5 shrink-0";
  if (kind === "enrich") return <RiFlashlightLine className={cn(cls, "text-[#fa7319]")} aria-hidden="true" />;
  if (kind === "ai") return <RiSparkling2Line className={cn(cls, "text-[#7d52f4]")} aria-hidden="true" />;
  if (kind === "formula") return <RiFunctionLine className={cn(cls, "text-[#0b8a7a]")} aria-hidden="true" />;
  return null;
}

export function FillingGrid({ className }: { className?: string }) {
  return (
    <DataStage label="A table whose Apollo, AI and formula columns fill in row by row. An illustration with sample data." cycle={CYCLE} final={FINAL} className={className}>
      {({ t }) => {
        let working = 0;
        for (let c = 2; c < COLS.length; c++) for (let r = 0; r < ROWS.length; r++) {
          const s = stateOf(t, c, r);
          if (s === "queued" || s === "running") working++;
        }
        const finished = t >= END;
        return (
          <Panel
            className="max-w-[980px]"
            title="Q4 logistics · table 1"
            right={
              <span className="flex items-center gap-2">
                <Chip tone="green">Auto-run on</Chip>
                <span className="text-[11px] tabular-nums text-[#707070]">{working > 0 ? `${working} cells queued or running` : "All cells complete"}</span>
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] table-fixed border-collapse text-left text-[12px]">
                <thead>
                  <tr className="bg-[#fbfbfc]">
                    {COLS.map((c) => (
                      <th key={c.key} scope="col" className={cn("border-b border-l border-black/[0.06] px-2.5 py-2 font-normal first:border-l-0", c.key === "angle" && "w-[22%]")}>
                        <span className="flex items-center gap-1.5 font-medium text-[#3a3a3a]">
                          <KindIcon kind={c.kind} />
                          <span className="truncate">{c.label}</span>
                        </span>
                        {c.source && <span className={cn(monoFont, "mt-0.5 block text-[10px] uppercase tracking-[0.05em] text-[#9aa0aa]")}>{c.source}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, r) => (
                    <tr key={row.domain} className="border-b border-black/[0.05] last:border-b-0">
                      {COLS.map((col, c) => {
                        const s = stateOf(t, c, r);
                        const value = row[col.key as keyof typeof row];
                        return (
                          <td key={col.key} className="h-9 border-l border-black/[0.05] px-2.5 first:border-l-0">
                            <span className="flex min-w-0 items-center gap-1.5">
                              {s === "done" ? (
                                <>
                                  {c >= 2 && <RiCheckboxCircleFill className="size-3.5 shrink-0 text-[#1fc16b]" aria-hidden="true" />}
                                  <span className="truncate text-[#141414]">{value}</span>
                                </>
                              ) : s === "running" ? (
                                <>
                                  <RiLoader4Line className="size-3.5 shrink-0 animate-spin text-[#335cff] motion-reduce:animate-none" aria-hidden="true" />
                                  <span className="text-[#9aa0aa]">Running…</span>
                                </>
                              ) : s === "queued" ? (
                                <>
                                  <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border border-dashed border-[#cacfd8]" />
                                  <span className="text-[#b0b4bd]">Queued…</span>
                                </>
                              ) : (
                                <span className="text-[#d5d8de]">Not run</span>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] bg-[#fbfbfc] px-4 py-3">
              <span className="text-[12px] text-[#656565]">{finished ? "5 rows selected" : "Each column waits for the columns it reads."}</span>
              <span className={cn("rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-500", finished ? "bg-[#335cff] text-white shadow-[0_6px_16px_-8px_rgb(51_92_255/0.8)]" : "bg-black/[0.05] text-[#9aa0aa]")}>Create campaign</span>
            </div>
          </Panel>
        );
      }}
    </DataStage>
  );
}
