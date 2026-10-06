"use client";

import { useState } from "react";
import { RiCheckLine, RiFileCopyLine, RiGithubFill, RiTerminalBoxLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import styles from "./landing.module.css";
import { Reveal } from "./Reveal";
import { Cta, LINKS, monoFont, SectionHead } from "./ui";

/**
 * Self-host: how to run it, for real. A terminal card with the repository's
 * actual setup (clone, configure .env, build and run the Dockerfile — or Bun
 * for local development), the accounts you connect beside it, and the stack
 * underneath. Nothing here is a price: there isn't one.
 */

type Line = { kind: "cmd" | "comment" | "note" | "out" | "done"; text: string };

const CLONE: Line[] = [
  { kind: "comment", text: "# 1 · Clone" },
  { kind: "cmd", text: "git clone https://github.com/Kandid-ai/AgentSDR.git && cd AgentSDR" },
];
const CONFIGURE: Line[] = [
  { kind: "comment", text: "# 2 · Configure" },
  { kind: "cmd", text: "cp .env.example .env.local" },
  { kind: "out", text: "  DATABASE_URL=postgres://…" },
  { kind: "out", text: "  BETTER_AUTH_SECRET=…   BETTER_AUTH_URL=…" },
  { kind: "out", text: "  INTEGRATION_CREDENTIALS_KEY=…" },
  { kind: "note", text: "# then create the schema: the migrations in scripts/" },
];

const RECIPES: Record<"docker" | "bun", { label: string; lines: Line[] }> = {
  docker: {
    label: "Docker",
    lines: [
      ...CLONE,
      ...CONFIGURE,
      { kind: "comment", text: "# 3 · Build and run one container" },
      { kind: "cmd", text: "docker build -t agentsdr ." },
      { kind: "cmd", text: "docker run --env-file .env.local -p 3000:3000 agentsdr" },
      { kind: "done", text: "✓ Ready — http://localhost:3000" },
    ],
  },
  bun: {
    label: "Bun",
    lines: [
      ...CLONE,
      ...CONFIGURE,
      { kind: "comment", text: "# 3 · Install and start" },
      { kind: "cmd", text: "bun install" },
      { kind: "cmd", text: "bun run dev" },
      { kind: "done", text: "✓ Ready — http://localhost:3000" },
    ],
  },
};

// The same marks the Settings Connection pages show. Apollo's has its own square
// background, so it fills the tile (as it does in the hero) instead of sitting inset.
const CONNECT: Array<{ logo: string; bleed?: boolean; name: string; role: string; optional?: boolean }> = [
  { logo: "/Integrations - Icon/google.svg", name: "Google Workspace", role: "Mailboxes for email sequences" },
  { logo: "/Integrations - Icon/unipile.png", name: "Unipile", role: "LinkedIn and WhatsApp accounts" },
  { logo: "/Integrations - Icon/openrouter.svg", name: "OpenRouter", role: "Your model key, for every AI step" },
  { logo: "/Integrations - Icon/cloudflare.svg", name: "Cloudflare R2", role: "Storage for call recordings" },
  { logo: "/landing/tools/apollo.png", bleed: true, name: "Apollo and 14 more", role: "Enrichment providers", optional: true },
];

const STACK = ["Next.js 16", "React 19", "TypeScript", "Postgres", "Drizzle", "Tailwind 4", "Bun", "Docker"];

export function SelfHost() {
  const [recipe, setRecipe] = useState<"docker" | "bun">("docker");
  const [copied, setCopied] = useState(false);
  const lines = RECIPES[recipe].lines;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.filter((l) => l.kind === "cmd").map((l) => l.text).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the commands are on screen to copy by hand.
    }
  };

  return (
    <section id="self-host" aria-labelledby="self-host-title" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <Reveal>
        <SectionHead
          id="self-host-title"
          eyebrow="Self-host"
          title="Run it yourself"
          lede="Free and open source. No seats and no per-contact fees — you pay for your server and your own AI usage."
        />
      </Reveal>

      <Reveal className="mx-auto mt-12 grid max-w-[1128px] gap-4 px-4 sm:mt-16 sm:gap-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Terminal */}
        <div className="flex min-w-0 flex-col overflow-hidden rounded-3xl bg-[#0d0f1a] shadow-[0_0_0_1px_rgb(255_255_255/0.06)_inset,0_24px_48px_-24px_rgb(11_10_26/0.5)]">
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="size-3 rounded-full bg-white/15" />
              <span className="size-3 rounded-full bg-white/15" />
              <span className="size-3 rounded-full bg-white/15" />
            </span>
            <div role="tablist" aria-label="How to run it" className="ml-1 flex rounded-lg bg-white/[0.06] p-0.5">
              {(Object.keys(RECIPES) as Array<keyof typeof RECIPES>).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={recipe === key}
                  onClick={() => setRecipe(key)}
                  className={cn("rounded-md px-3 py-1 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#97baff]", recipe === key ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white/85")}
                >
                  {RECIPES[key].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={copy}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-white/60 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-[#97baff]"
            >
              {copied ? <RiCheckLine className="size-4 text-[#1fc16b]" aria-hidden="true" /> : <RiFileCopyLine className="size-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className={cn(monoFont, "flex-1 overflow-x-auto px-5 py-5 text-[13px] leading-[1.9] sm:px-6 sm:py-6")}>
            <code>
              {lines.map((line, i) => (
                <span key={`${recipe}-${i}`} className={cn("block whitespace-pre", (line.kind === "comment" || line.kind === "note") && "text-white/40", line.kind === "note" && "mt-1", line.kind === "out" && "text-[#97baff]/80", line.kind === "done" && "mt-3 text-[#1fc16b]", line.kind === "cmd" && "text-white/90", line.kind === "comment" && i > 0 && "mt-4")}>
                  {line.kind === "cmd" && <span className="select-none text-[#739eff]">$ </span>}
                  {line.text}
                </span>
              ))}
            </code>
          </pre>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-white/[0.07] px-5 py-4 sm:px-6">
            <span className="mr-1 flex items-center gap-1.5 text-[13px] text-white/45">
              <RiTerminalBoxLine className="size-4" aria-hidden="true" /> Stack
            </span>
            {STACK.map((s) => (
              <span key={s} className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[12px] text-white/70 ring-1 ring-inset ring-white/[0.06]">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* What you connect */}
        <div className="flex flex-col rounded-3xl bg-[#3737370b] p-1">
          <div className={cn(styles.slab, "rounded-[20px] px-6 pb-2 pt-6")}>
            <p className="text-[16px] font-medium leading-6 text-[#141414]">What you connect</p>
            <p className="mt-1 text-[14px] leading-[22px] text-[#656565]">Your own accounts, so the data and the sending reputation stay yours.</p>
            <ul className="mt-4 divide-y divide-black/[0.06]">
              {CONNECT.map((c) => (
                <li key={c.name} className="flex items-center gap-3.5 py-3.5">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-black/[0.08]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand marks, SVG and PNG alike; nothing to optimise */}
                    <img src={c.logo} alt="" width={40} height={40} draggable={false} className={c.bleed ? "size-full object-cover" : "size-6 object-contain"} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] font-medium leading-5 text-[#141414]">
                      {c.name}
                      {c.optional && <span className="rounded-full bg-[#3737370b] px-2 py-px text-[11px] font-normal text-[#656565]">optional</span>}
                    </span>
                    <span className="block text-[13px] leading-5 text-[#656565]">{c.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto px-5 pb-5 pt-5">
            <Cta href={LINKS.selfHost} external variant="dark" icon={RiGithubFill} className="w-full">
              Read the setup notes
            </Cta>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
