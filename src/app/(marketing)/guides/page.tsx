import Link from "next/link";
import { RiArrowRightLine, RiBookOpenLine, RiHistoryLine } from "@remixicon/react";
import { ClosingCta, PageHero, RelatedPages, Section } from "@/components/marketing/blocks";
import { ACCENT, linkFor } from "@/components/marketing/catalog";
import { monoFont } from "@/components/landing/ui";
import { Reveal } from "@/components/landing/Reveal";
import { marketingMetadata } from "@/lib/marketing/seo";
import { EXTERNAL } from "@/lib/marketing/site";
import { cn } from "@/utils/cn";

const PATH = "/guides";

export const metadata = marketingMetadata({
  path: PATH,
  title: "Outbound guides: email, LinkedIn and WhatsApp",
  ogTitle: "Guides for safe multichannel outbound",
  eyebrow: "Guides",
  description: "Playbooks for safe outbound: cold email from Google Workspace, LinkedIn automation limits and WhatsApp for B2B, with the defaults AgentSDR uses.",
});

const GUIDES = [
  { path: "/guides/cold-email-google-workspace", accent: ACCENT.email, tag: "Email", minutes: 11, summary: "Mailbox setup, SPF, DKIM and DMARC, daily volumes and gaps, bounces and list hygiene." },
  { path: "/guides/linkedin-automation-limits", accent: ACCENT.linkedin, tag: "LinkedIn", minutes: 10, summary: "Invitation volumes, free versus Premium accounts, working hours, delays and what triggers restrictions." },
  { path: "/guides/whatsapp-b2b-outreach", accent: ACCENT.whatsapp, tag: "WhatsApp", minutes: 10, summary: "Consent, warming up a new number, new chats a day, calls versus messages and recording." },
];

export default function GuidesPage() {
  return (
    <>
      <PageHero eyebrow="Guides" eyebrowIcon={RiBookOpenLine} title="Guides to safe multichannel outbound" lede="Long-form, practical guides to sending email, LinkedIn and WhatsApp outreach without burning your domain, account or number, each ending with the defaults AgentSDR ships." />
      <Section id="guides" eyebrow="Start here" title="Three channels, three sets of limits" lede="Each guide separates general practice from what AgentSDR does, and links to the provider's own rules where we cite one.">
        <ul className="grid gap-5 lg:grid-cols-3">
          {GUIDES.map((g, i) => {
            const link = linkFor(g.path);
            return (
              <Reveal as="li" key={g.path} delay={i * 90} className="h-full">
                <Link href={g.path} className="group flex h-full flex-col rounded-3xl bg-[#f7f7f8] p-7 outline-none ring-1 ring-black/[0.05] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)] focus-visible:ring-2 focus-visible:ring-[#335cff]">
                  <span className={cn(monoFont, "flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.06em]")} style={{ color: g.accent }}>
                    <span aria-hidden="true" className="h-px w-6" style={{ background: g.accent }} />
                    {g.tag} · {g.minutes} min read
                  </span>
                  <h2 className="mt-4 text-balance text-[24px] font-medium leading-[1.2] tracking-[-0.02em] text-[#141414]">{link.label}</h2>
                  <p className="mt-3 flex-1 text-[15px] leading-[1.65] text-[#5c5c5c]">{g.summary}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#141414]">
                    Read the guide
                    <RiArrowRightLine className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </ul>
        <Reveal className="mt-10 grid gap-5 sm:grid-cols-2">
          <a href={EXTERNAL.docs} target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/[0.08] transition-colors hover:bg-[#fbfbfc]">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#335cff]/[0.07] text-[#335cff]"><RiBookOpenLine className="size-5" /></span>
            <span>
              <span className="block text-[15px] font-medium text-[#141414]">Documentation</span>
              <span className="mt-1 block text-[14px] leading-5 text-[#6b6b6b]">Setup, every feature and every limit, read on GitHub.</span>
            </span>
          </a>
          <Link href="/changelog" className="flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/[0.08] transition-colors hover:bg-[#fbfbfc]">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#335cff]/[0.07] text-[#335cff]"><RiHistoryLine className="size-5" /></span>
            <span>
              <span className="block text-[15px] font-medium text-[#141414]">Changelog</span>
              <span className="mt-1 block text-[14px] leading-5 text-[#6b6b6b]">What shipped, release by release.</span>
            </span>
          </Link>
        </Reveal>
      </Section>
      <RelatedPages paths={["/product/email", "/product/linkedin", "/product/whatsapp", "/open-source", "/changelog"]} />
      <ClosingCta title="Put the safe defaults to work." lede="AgentSDR is open source and self-hosted, with email, LinkedIn and WhatsApp limits you can read, change and audit." />
    </>
  );
}
