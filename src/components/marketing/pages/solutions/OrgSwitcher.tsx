"use client";

import { RiArrowDownSLine, RiCheckLine, RiLinkedinBoxFill, RiLockLine, RiMailFill, RiTeamLine, RiWhatsappFill } from "@remixicon/react";
import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { cn } from "@/utils/cn";
import { Fade, MonoLabel } from "./Fade";

/**
 * Three client organizations on one deployment. The switcher cycles through
 * them and each workspace shows its own leads, connected accounts, sending
 * rules and people. Clients, people and numbers are fictional.
 */

type Org = {
  name: string;
  slug: string;
  tint: string;
  leads: string;
  mailboxes: string[];
  linkedin: string;
  whatsapp: string;
  perDay: number;
  invites: number;
  people: Array<{ name: string; role: "Owner" | "Admin" | "Member" }>;
};

const ORGS: readonly Org[] = [
  {
    name: "Harbor & Pine",
    slug: "harbor-pine",
    tint: "#335cff",
    leads: "2,480 people",
    mailboxes: ["sam@harborpine.example", "ana@harborpine.example"],
    linkedin: "Sam Okafor",
    whatsapp: "+44 20 7946 0100",
    perDay: 30,
    invites: 30,
    people: [
      { name: "You", role: "Owner" },
      { name: "Jo (client)", role: "Member" },
    ],
  },
  {
    name: "Lumen Robotics",
    slug: "lumen-robotics",
    tint: "#7d52f4",
    leads: "960 people",
    mailboxes: ["lena@lumenrobotics.example"],
    linkedin: "Lena Voss",
    whatsapp: "+49 30 0000 0000",
    perDay: 20,
    invites: 20,
    people: [
      { name: "You", role: "Owner" },
      { name: "Kai (client)", role: "Admin" },
      { name: "Mina (client)", role: "Member" },
    ],
  },
  {
    name: "Calder Freight",
    slug: "calder-freight",
    tint: "#0b8a7a",
    leads: "5,120 people",
    mailboxes: ["rob@calderfreight.example", "ines@calderfreight.example", "team@calderfreight.example"],
    linkedin: "Rob Calder",
    whatsapp: "+1 202 555 0143",
    perDay: 40,
    invites: 30,
    people: [
      { name: "You", role: "Owner" },
      { name: "Rob (client)", role: "Admin" },
    ],
  },
];

const PHASE = 3600;
const START = 400;

export function OrgSwitcher({ className }: { className?: string }) {
  return (
    <Showcase label="An organization switcher moving between three client workspaces, each with its own leads, accounts and rules. An illustration with sample data." className={className}>
      <Stage cycle={START + PHASE * 3 + 800} final={START + PHASE * 3 - 500}>
        {({ t }) => {
          const phase = Math.min(2, Math.max(0, Math.floor((t - START) / PHASE)));
          const lt = t - START - phase * PHASE; // time inside this phase
          const org = ORGS[phase];
          const open = lt >= 0 && lt < 900 && phase > 0; // the menu opens briefly between clients
          return (
            <div className="w-full overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_24px_60px_-24px_rgb(14_18_27/0.35)]">
              <div className="flex items-center gap-2 border-b border-black/[0.06] bg-[#fafafa] px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-black/10" />
                  <span className="size-2.5 rounded-full bg-black/10" />
                  <span className="size-2.5 rounded-full bg-black/10" />
                </span>
                <span className="ml-2 truncate rounded-md bg-black/[0.04] px-2.5 py-1 font-[family-name:var(--font-landing-mono)] text-[11px] text-[#656565]">agentsdr.your-agency.com / {org.slug}</span>
              </div>
              <div className="grid min-h-[430px] sm:grid-cols-[210px_minmax(0,1fr)]">
                {/* sidebar with the switcher */}
                <div className="relative border-b border-black/[0.06] bg-[#fafafa] p-3 sm:border-b-0 sm:border-r">
                  <div className="flex items-center gap-2.5 rounded-xl bg-white p-2 shadow-[0_0_0_1px_rgb(0_0_0/0.07)]">
                    <span className="flex size-8 items-center justify-center rounded-lg text-[13px] font-semibold text-white transition-colors duration-500" style={{ background: org.tint }}>
                      {org.name[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium leading-4 text-[#141414]">{org.name}</span>
                      <span className="block text-[11px] leading-4 text-[#8a8a8a]">Organization</span>
                    </span>
                    <RiArrowDownSLine className="size-4 text-[#8a8a8a]" aria-hidden="true" />
                  </div>
                  <div className={cn("absolute inset-x-3 top-[60px] z-10 rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_16px_32px_-12px_rgb(0_0_0/0.25)] transition-all duration-300", open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0")}>
                    {ORGS.map((o, i) => (
                      <div key={o.slug} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#141414] transition-colors", i === phase ? "bg-[#335cff]/[0.08]" : "")}>
                        <span className="flex size-5 items-center justify-center rounded text-[10px] font-semibold text-white" style={{ background: o.tint }}>
                          {o.name[0]}
                        </span>
                        <span className="flex-1 truncate">{o.name}</span>
                        {i === phase && <RiCheckLine className="size-3.5 text-[#335cff]" aria-hidden="true" />}
                      </div>
                    ))}
                  </div>
                  <ul className="mt-4 hidden gap-1 text-[13px] text-[#656565] sm:grid">
                    {["Leads", "Campaigns", "Action required", "Analytics", "Settings"].map((item, i) => (
                      <li key={item} className={cn("rounded-lg px-2.5 py-1.5", i === 4 && "bg-black/[0.05] font-medium text-[#141414]")}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* the workspace */}
                <div key={org.slug} className="p-4 sm:p-6">
                  <Fade on={lt >= 300} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <MonoLabel className="text-[#8a8a8a]">Workspace</MonoLabel>
                      <p className="mt-1 text-[20px] font-medium leading-6 tracking-[-0.01em] text-[#141414]">{org.name}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f1f3] px-3 py-1 text-[12px] text-[#525866]">
                      <RiLockLine className="size-3.5" aria-hidden="true" />
                      Not visible from other organizations
                    </span>
                  </Fade>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Fade on={lt >= 600} className="rounded-2xl bg-[#f7f7f8] p-4">
                      <MonoLabel className="text-[#8a8a8a]">Lead database</MonoLabel>
                      <p className="mt-2 text-[22px] font-medium tracking-[-0.02em] text-[#141414]">{org.leads}</p>
                      <p className="mt-0.5 text-[13px] text-[#656565]">Only this client&rsquo;s leads</p>
                    </Fade>
                    <Fade on={lt >= 900} className="rounded-2xl bg-[#f7f7f8] p-4">
                      <MonoLabel className="text-[#8a8a8a]">Sending rules</MonoLabel>
                      <p className="mt-2 text-[14px] leading-6 text-[#141414]">
                        <span className="font-medium">{org.perDay}</span> emails a day per mailbox
                        <br />
                        <span className="font-medium">{org.invites}</span> LinkedIn invites a day
                      </p>
                    </Fade>
                    <Fade on={lt >= 1200} className="rounded-2xl bg-[#f7f7f8] p-4">
                      <MonoLabel className="text-[#8a8a8a]">Connected accounts</MonoLabel>
                      <ul className="mt-2 grid gap-1.5 text-[13px] text-[#141414]">
                        {org.mailboxes.map((m) => (
                          <li key={m} className="flex items-center gap-2">
                            <RiMailFill className="size-3.5 shrink-0 text-[#fa7319]" aria-hidden="true" />
                            <span className="truncate">{m}</span>
                          </li>
                        ))}
                        <li className="flex items-center gap-2">
                          <RiLinkedinBoxFill className="size-3.5 shrink-0 text-[#335cff]" aria-hidden="true" />
                          {org.linkedin}
                        </li>
                        <li className="flex items-center gap-2">
                          <RiWhatsappFill className="size-3.5 shrink-0 text-[#1fc16b]" aria-hidden="true" />
                          {org.whatsapp}
                        </li>
                      </ul>
                    </Fade>
                    <Fade on={lt >= 1500} className="rounded-2xl bg-[#f7f7f8] p-4">
                      <MonoLabel className="text-[#8a8a8a]">People</MonoLabel>
                      <ul className="mt-2 grid gap-1.5 text-[13px] text-[#141414]">
                        {org.people.map((p) => (
                          <li key={p.name} className="flex items-center gap-2">
                            <RiTeamLine className="size-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
                            <span className="flex-1">{p.name}</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#525866] ring-1 ring-black/[0.06]">{p.role}</span>
                          </li>
                        ))}
                      </ul>
                    </Fade>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      </Stage>
    </Showcase>
  );
}
