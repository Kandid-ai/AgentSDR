"use client";

import { RiCheckLine, RiForbidLine, RiLinkedinBoxFill, RiMailFill, RiWhatsappFill } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { InboxAvatar } from "@/components/inbox/shell/InboxShell";
import { Chip, DataStage, Panel } from "./kit";

/*
 * Mark do not contact once; every channel refuses the next send. Sample data.
 */
const FLIP_AT = 2_200;
const SENDS = [
  { icon: RiMailFill, color: "#fa7319", label: "Email step 3", at: 3_000 },
  { icon: RiLinkedinBoxFill, color: "#335cff", label: "LinkedIn message", at: 3_500 },
  { icon: RiWhatsappFill, color: "#1fc16b", label: "WhatsApp message", at: 4_000 },
];
const CYCLE = 8_400;
const FINAL = 5_000;

export function DoNotContact({ className }: { className?: string }) {
  return (
    <DataStage label="A person marked Do Not Contact, with email, LinkedIn and WhatsApp sends refused. An illustration with sample data." cycle={CYCLE} final={FINAL} className={className}>
      {({ t }) => {
        const dnc = t >= FLIP_AT;
        return (
          <Panel className="max-w-[420px]" title="CRM record">
            <div className="flex items-center gap-3 px-4 py-4">
              <InboxAvatar name="Samir Haddad" size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#141414]">Samir Haddad</p>
                <p className="truncate text-[12px] text-[#707070]">COO · parcelly.example</p>
              </div>
              <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-300", dnc ? "bg-[#fb3748]/10 text-[#c4202f]" : "bg-black/[0.05] text-[#525866]")}>
                <RiForbidLine className="size-3.5" aria-hidden="true" /> Do Not Contact
                <span className="relative ml-0.5 h-3.5 w-6 rounded-full transition-colors duration-300" style={{ background: dnc ? "#fb3748" : "#cacfd8" }}>
                  <span className="absolute top-0.5 size-2.5 rounded-full bg-white transition-all duration-300" style={{ left: dnc ? 12 : 2 }} />
                </span>
              </span>
            </div>
            <ul className="border-t border-black/[0.06]">
              {SENDS.map((s) => {
                const Icon = s.icon;
                const tried = t >= s.at;
                return (
                  <li key={s.label} className="flex items-center gap-3 border-b border-black/[0.05] px-4 py-2.5 last:border-b-0">
                    <Icon className="size-4" style={{ color: s.color }} aria-hidden="true" />
                    <span className="flex-1 text-[12px] text-[#3a3a3a]">{s.label}</span>
                    {tried ? (
                      <Chip tone="red">
                        <RiForbidLine className="size-3" aria-hidden="true" /> Refused
                      </Chip>
                    ) : (
                      <Chip tone="green">
                        <RiCheckLine className="size-3" aria-hidden="true" /> Allowed
                      </Chip>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-black/[0.06] bg-[#fbfbfc] px-4 py-3 text-[12px] leading-5 text-[#656565]">Enforced by the server before each send, not just hidden in the UI. Clear the flag from the same menu to send again.</p>
          </Panel>
        );
      }}
    </DataStage>
  );
}
