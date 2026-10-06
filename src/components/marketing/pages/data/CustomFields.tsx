"use client";

import { cn } from "@/utils/cn";
import { monoFont } from "../../../landing/ui";
import { Chip, DataStage, Panel, Show } from "./kit";

/*
 * The Lead columns page: add a typed field, rename it (key stays), change a
 * type (checked first), remove it (data kept). Sample data.
 */
const ADD_AT = 900;
const RENAME_AT = 2_700;
const RETYPE_AT = 4_600;
const REMOVE_AT = 6_500;
const CYCLE = 10_800;
const FINAL = 7_600;

const CAPTIONS: Array<[number, string]> = [
  [REMOVE_AT, "Remove hides a field everywhere and keeps its data. Restore brings it back."],
  [RETYPE_AT, "Text to Number is checked first: if any value can't convert, nothing changes."],
  [RENAME_AT, "A rename changes the label only. The key never changes."],
  [ADD_AT, "A new field gets its key from its name, starting with x_."],
  [0, "Built-in fields can be renamed but not retyped, removed or deleted."],
];

function Row({ name, keyName, type, badge, strike }: { name: string; keyName: string; type: string; badge?: boolean; strike?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[1.2fr_1.2fr_auto] items-center gap-3 border-t border-black/[0.05] px-4 py-2.5 text-[12px] transition-opacity duration-500", strike && "opacity-50")}>
      <span className="truncate font-medium text-[#141414] transition-all duration-300">{name}</span>
      <span className={cn(monoFont, "truncate text-[11px] text-[#8a8a8a]")}>{keyName}</span>
      <span className="flex items-center gap-1.5">
        {badge && <Chip>Built-in</Chip>}
        <Chip tone="blue">{type}</Chip>
      </span>
    </div>
  );
}

export function CustomFields({ className }: { className?: string }) {
  return (
    <DataStage label="Adding, renaming, retyping and removing a custom lead field. An illustration with sample data." cycle={CYCLE} final={FINAL} className={className}>
      {({ t }) => {
        const caption = CAPTIONS.find(([at]) => t >= at)?.[1] ?? "";
        return (
          <Panel
            className="max-w-[520px]"
            title="Lead columns · People"
            right={
              <span className="flex rounded-lg bg-[#f2f3f5] p-0.5 text-[11px]">
                <span className="rounded-md bg-white px-2 py-0.5 font-medium text-[#141414] shadow-sm">People</span>
                <span className="px-2 py-0.5 text-[#707070]">Companies</span>
              </span>
            }
          >
            <Row name="Email" keyName="email" type="Email" badge />
            <Row name="Job Title" keyName="job_title" type="Text" badge />
            <Show when={t >= ADD_AT}>
              <Row name="Plan tier" keyName="x_plan_tier" type="Select" />
            </Show>
            <Row name={t >= RENAME_AT ? "Sales region" : "Region"} keyName="x_region" type="Text" />
            <Row name="Seats" keyName="x_seats" type={t >= RETYPE_AT ? "Number" : "Text"} />
            {t >= RETYPE_AT && t < REMOVE_AT && (
              <div className="border-t border-black/[0.05] bg-[#1fc16b]/[0.06] px-4 py-2 text-[11px] text-[#178c4e]">Checked 412 stored values: all 412 convert to a number.</div>
            )}
            {t < REMOVE_AT && <Row name="Legacy id" keyName="x_legacy_id" type="Text" />}
            {t >= REMOVE_AT && (
              <Show when className="border-t border-black/[0.06] bg-[#fbfbfc]">
                <p className={cn(monoFont, "px-4 pt-3 text-[10px] uppercase tracking-[0.05em] text-[#8a8a8a]")}>Removed fields</p>
                <Row name="Legacy id" keyName="x_legacy_id" type="Text" strike />
              </Show>
            )}
            <p className="border-t border-black/[0.06] px-4 py-3 text-[12px] leading-5 text-[#656565]">{caption}</p>
          </Panel>
        );
      }}
    </DataStage>
  );
}
