"use client";

import { RiLinkedinBoxFill, RiMailFill, RiPhoneFill, RiWhatsappFill } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { InboxAvatar } from "@/components/inbox/shell/InboxShell";
import { monoFont } from "../../../landing/ui";
import { Chip, DataStage, Panel, Show, type Tone } from "./kit";

/*
 * One person, in three campaigns on three channels. A reply on LinkedIn
 * stops the email follow-ups. Sample data.
 */
const ROWS: Array<{ icon: typeof RiMailFill; color: string; campaign: string; before: [string, Tone]; after: [string, Tone] }> = [
  { icon: RiMailFill, color: "#fa7319", campaign: "Email · Freight ops, step 2", before: ["Active", "green"], after: ["Replied", "blue"] },
  { icon: RiLinkedinBoxFill, color: "#335cff", campaign: "LinkedIn · Freight ops", before: ["Invite sent", "neutral"], after: ["Replied", "blue"] },
  { icon: RiWhatsappFill, color: "#1fc16b", campaign: "WhatsApp · Warm intro", before: ["Queued", "neutral"], after: ["Replied", "blue"] },
];
const REPLY_AT = 3_800;
const CYCLE = 8_800;
const FINAL = 5_200;

export function PersonRecord({ className }: { className?: string }) {
  return (
    <DataStage label="One person enrolled on three channels, with a reply updating all three. An illustration with sample data." cycle={CYCLE} final={FINAL} className={className}>
      {({ t }) => {
        const replied = t >= REPLY_AT;
        return (
          <Panel className="max-w-[460px]" title="People · 1 record">
            <div className="flex items-center gap-3 px-4 py-4">
              <InboxAvatar name="Hannah Weiss" size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#141414]">Hannah Weiss</p>
                <p className="truncate text-[12px] text-[#707070]">Head of Growth · lumen-freight.example</p>
              </div>
              <div className="flex gap-1.5" aria-label="Reachable by email, LinkedIn and phone">
                {[RiMailFill, RiLinkedinBoxFill, RiPhoneFill].map((Icon, i) => (
                  <Icon key={i} className="size-4 transition-colors duration-500" style={{ color: t >= 300 + i * 250 ? ["#fa7319", "#335cff", "#1fc16b"][i] : "#d5d8de" }} aria-hidden="true" />
                ))}
              </div>
            </div>
            <ul className="border-t border-black/[0.06]">
              {ROWS.map((r, i) => {
                const Icon = r.icon;
                const [label, tone] = replied ? r.after : r.before;
                return (
                  <Show key={r.campaign} when={t >= 900 + i * 450} className="flex items-center gap-3 border-b border-black/[0.05] px-4 py-2.5 last:border-b-0">
                    <Icon className="size-4 shrink-0" style={{ color: r.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[#3a3a3a]">{r.campaign}</span>
                    <Chip tone={tone}>{label}</Chip>
                  </Show>
                );
              })}
            </ul>
            <div className={cn("flex items-center gap-2 border-t border-black/[0.06] px-4 py-3 text-[12px] transition-colors duration-500", replied ? "bg-[#335cff]/[0.05] text-[#2547d0]" : "bg-[#fbfbfc] text-[#8a8a8a]")}>
              <span className={cn(monoFont, "text-[10px] uppercase tracking-[0.05em]")}>CRM</span>
              {replied ? "Reply on LinkedIn: enrollments marked replied, remaining emails cancelled" : "No reply yet. A CRM record starts after the first reply."}
            </div>
          </Panel>
        );
      }}
    </DataStage>
  );
}
