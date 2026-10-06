"use client";

import { RiCheckboxCircleFill, RiCheckboxFill, RiCheckboxBlankLine, RiMailFill } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { monoFont } from "../../../landing/ui";
import { Chip, DataStage, Panel, Show } from "./kit";

/*
 * Select rows, map columns, create the campaign: people exist only after
 * the mapping is confirmed. Counts are illustrative sample data.
 */
const ROWS = [
  { name: "Hannah Weiss", email: "hannah@lumen-freight.example" },
  { name: "Rafael Costa", email: "rafael@brightloop.example" },
  { name: "Aiko Tanaka", email: "aiko@kestrel.example" },
  { name: "Samir Haddad", email: "samir@parcelly.example" },
];
const TICK = (i: number) => 600 + i * 380;
const DIALOG_AT = 2_600;
const MAPPED_AT = 3_800;
const DONE_AT = 5_000;
const CYCLE = 9_600;
const FINAL = 6_000;

export function RowsToCampaign({ className }: { className?: string }) {
  return (
    <DataStage label="Rows selected in a table and turned into an email campaign. An illustration with sample data." cycle={CYCLE} final={FINAL} className={className}>
      {({ t }) => (
        <div className="relative w-full max-w-[520px]">
          <Panel title="Table · 4 rows selected">
            <ul>
              {ROWS.map((r, i) => {
                const on = t >= TICK(i);
                return (
                  <li key={r.email} className={cn("flex items-center gap-3 border-b border-black/[0.05] px-4 py-2.5 text-[12px] transition-colors duration-300 last:border-b-0", on && "bg-[#335cff]/[0.04]")}>
                    {on ? <RiCheckboxFill className="size-4 text-[#335cff]" aria-hidden="true" /> : <RiCheckboxBlankLine className="size-4 text-[#b0b4bd]" aria-hidden="true" />}
                    <span className="w-28 truncate font-medium text-[#141414]">{r.name}</span>
                    <span className="min-w-0 flex-1 truncate text-[#707070]">{r.email}</span>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-black/[0.06] bg-[#fbfbfc] px-4 py-2.5 text-[12px] text-[#656565]">Actions → Create campaign</div>
          </Panel>
          <Show when={t >= DIALOG_AT} y={14} className="relative -mt-8 ml-6 sm:ml-12">
            <Panel title="Create campaign from selected rows" className="shadow-[0_0_0_1px_rgb(20_20_20/0.08),0_24px_48px_-16px_rgb(14_18_27/0.35)]">
              <div className="grid gap-2.5 px-4 py-3 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className={cn(monoFont, "w-20 text-[10px] uppercase tracking-[0.05em] text-[#8a8a8a]")}>Channel</span>
                  <Chip tone="orange"><RiMailFill className="size-3" aria-hidden="true" /> Email</Chip>
                  <span className="text-[#707070]">Logistics heads Q4</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(monoFont, "w-20 text-[10px] uppercase tracking-[0.05em] text-[#8a8a8a]")}>Email</span>
                  <span className="rounded-lg border border-dashed border-[#cacfd8] px-2 py-0.5 text-[#9aa0aa]" style={t >= MAPPED_AT ? { display: "none" } : undefined}>Choose a column…</span>
                  {t >= MAPPED_AT && <Chip tone="blue">Work email</Chip>}
                </div>
                <p className="text-[11px] leading-4 text-[#8a8a8a]">Unmapped columns are kept on the person and become merge fields.</p>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] bg-[#fbfbfc] px-4 py-2.5">
                {t >= DONE_AT ? (
                  <Show when className="flex items-center gap-1.5 text-[12px] text-[#178c4e]">
                    <RiCheckboxCircleFill className="size-4" aria-hidden="true" /> 4 people enrolled in the new campaign
                  </Show>
                ) : (
                  <span className="text-[12px] text-[#8a8a8a]">People are created only when you confirm.</span>
                )}
                <span className={cn("rounded-lg px-3 py-1 text-[12px] font-medium text-white transition-colors duration-300", t >= MAPPED_AT ? "bg-[#335cff]" : "bg-[#335cff]/40")}>Create</span>
              </div>
            </Panel>
          </Show>
        </div>
      )}
    </DataStage>
  );
}
