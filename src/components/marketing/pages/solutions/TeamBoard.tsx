"use client";

import { RiLinkedinBoxFill, RiMailFill, RiWhatsappFill } from "@remixicon/react";
import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { cn } from "@/utils/cn";
import { Fade, MonoLabel } from "./Fade";

/**
 * Three reps, each with their own accounts, and one shared Action required
 * queue their replies land in. Reps, leads and companies are fictional.
 */

type Rep = { name: string; initials: string; role: "Owner" | "Admin" | "Member"; mailbox: string; linkedin: string; whatsapp: string };
const REPS: readonly Rep[] = [
  { name: "Priya Nair", initials: "PN", role: "Owner", mailbox: "priya@acme-sales.example", linkedin: "Priya Nair", whatsapp: "+91 80 0000 0101" },
  { name: "Marcus Bell", initials: "MB", role: "Member", mailbox: "marcus@acme-sales.example", linkedin: "Marcus Bell", whatsapp: "+44 20 0000 0102" },
  { name: "Elena Ruiz", initials: "ER", role: "Member", mailbox: "elena@acme-sales.example", linkedin: "Elena Ruiz", whatsapp: "+34 91 000 0103" },
];

type Reply = { at: number; rep: number; channel: "email" | "linkedin" | "whatsapp"; lead: string; company: string; text: string; tag: string };
const REPLIES: readonly Reply[] = [
  { at: 1200, rep: 1, channel: "linkedin", lead: "Hannah Cole", company: "Fernwood", text: "Happy to see a demo next week.", tag: "Demo Requested" },
  { at: 2800, rep: 0, channel: "email", lead: "Ravi Menon", company: "Oakline", text: "Can you share a case study?", tag: "Information Requested" },
  { at: 4400, rep: 2, channel: "whatsapp", lead: "Sofia Marin", company: "Tidewater", text: "Not right now, maybe in Q3.", tag: "Not Required Right Now" },
  { at: 6000, rep: 1, channel: "email", lead: "Ian Prescott", company: "Brightloom", text: "Looping in our ops lead.", tag: "Connected to Different POC" },
];

const ICON = { email: RiMailFill, linkedin: RiLinkedinBoxFill, whatsapp: RiWhatsappFill };
const COLOR = { email: "#fa7319", linkedin: "#335cff", whatsapp: "#1fc16b" };

export function TeamBoard({ className }: { className?: string }) {
  return (
    <Showcase label="Three reps with their own mailboxes, LinkedIn and WhatsApp accounts, and their replies arriving in one shared Action required queue. An illustration with sample data." className={className}>
      <Stage cycle={9800} final={7800}>
        {({ t }) => {
          const active = REPLIES.reduce<number | null>((a, r) => (t >= r.at && t < r.at + 1300 ? r.rep : a), null);
          return (
            <div className="grid w-full gap-3 rounded-[22px] bg-white p-3 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_24px_60px_-24px_rgb(14_18_27/0.35)] sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="grid gap-2.5">
                <MonoLabel className="px-1 text-[#8a8a8a]">Reps and their accounts</MonoLabel>
                {REPS.map((rep, i) => (
                  <Fade key={rep.name} on={t >= 150 + i * 200} className={cn("rounded-2xl bg-[#f7f7f8] p-3.5 ring-2 transition-shadow duration-300", active === i ? "ring-[#335cff]/50" : "ring-transparent")}>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-white text-[12px] font-medium text-[#525866] shadow-[0_0_0_1px_rgb(0_0_0/0.07)]">{rep.initials}</span>
                      <p className="flex-1 text-[14px] font-medium text-[#141414]">{rep.name}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#525866] ring-1 ring-black/[0.06]">{rep.role}</span>
                    </div>
                    <ul className="mt-2.5 grid gap-1 text-[12px] text-[#656565] sm:grid-cols-3">
                      <li className="flex min-w-0 items-center gap-1.5">
                        <RiMailFill className="size-3.5 shrink-0 text-[#fa7319]" aria-hidden="true" />
                        <span className="truncate">{rep.mailbox.split("@")[0]}@&hellip;</span>
                      </li>
                      <li className="flex min-w-0 items-center gap-1.5">
                        <RiLinkedinBoxFill className="size-3.5 shrink-0 text-[#335cff]" aria-hidden="true" />
                        <span className="truncate">{rep.linkedin}</span>
                      </li>
                      <li className="flex min-w-0 items-center gap-1.5">
                        <RiWhatsappFill className="size-3.5 shrink-0 text-[#1fc16b]" aria-hidden="true" />
                        <span className="truncate">{rep.whatsapp}</span>
                      </li>
                    </ul>
                  </Fade>
                ))}
              </div>
              <div className="rounded-2xl bg-[#f7f7f8] p-3.5">
                <div className="flex items-center justify-between px-1">
                  <MonoLabel className="text-[#8a8a8a]">Action required &middot; shared</MonoLabel>
                  <span className="rounded-full bg-[#335cff] px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">{REPLIES.filter((r) => t >= r.at).length}</span>
                </div>
                <ul className="mt-3 grid gap-2">
                  {REPLIES.map((r) => {
                    const Icon = ICON[r.channel];
                    return (
                      <li key={r.lead}>
                        <Fade on={t >= r.at} className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
                          <div className="flex items-center gap-2">
                            <Icon className="size-4 shrink-0" style={{ color: COLOR[r.channel] }} aria-hidden="true" />
                            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#141414]">
                              {r.lead} <span className="font-normal text-[#8a8a8a]">&middot; {r.company}</span>
                            </p>
                            <span className="shrink-0 text-[11px] text-[#8a8a8a]">via {REPS[r.rep].name.split(" ")[0]}</span>
                          </div>
                          <p className="mt-1.5 truncate text-[13px] text-[#656565]">&ldquo;{r.text}&rdquo;</p>
                          <span className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-[#525866] ring-1 ring-inset ring-black/10">
                            <span className="size-1.5 rounded-full bg-[#335cff]" aria-hidden="true" />
                            {r.tag}
                          </span>
                        </Fade>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 px-1 text-[12px] leading-[18px] text-[#8a8a8a]">Everyone in the organization sees the same queue. An illustration with sample data.</p>
              </div>
            </div>
          );
        }}
      </Stage>
    </Showcase>
  );
}
