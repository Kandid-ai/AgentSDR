"use client";

import { useState } from "react";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { cn } from "@/utils/cn";

const MONO = "font-[family-name:var(--font-landing-mono)]";

function Chrome({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[22px] bg-[#0d0f1a] shadow-[0_0_0_1px_rgb(255_255_255/0.06)_inset,0_30px_60px_-24px_rgb(11_10_26/0.6)]">
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-3 rounded-full bg-white/15" />
          <span className="size-3 rounded-full bg-white/15" />
          <span className="size-3 rounded-full bg-white/15" />
        </span>
        <span className={cn(MONO, "text-[12px] text-white/45")}>{title}</span>
        <span className="ml-auto">{right}</span>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- hero terminal

type Step = { kind: "cmd" | "comment" | "out" | "done"; text: string };
const SCRIPT: readonly Step[] = [
  { kind: "cmd", text: "git clone https://github.com/Kandid-ai/AgentSDR.git && cd AgentSDR" },
  { kind: "cmd", text: "cp .env.example .env" },
  { kind: "comment", text: "# set BETTER_AUTH_SECRET, INTEGRATION_CREDENTIALS_KEY, POSTGRES_PASSWORD…" },
  { kind: "cmd", text: "docker compose up -d" },
  { kind: "out", text: "services  db · setup · app · cron" },
  { kind: "done", text: "✓ http://localhost:3000 — sign up, create your organization" },
];
const CHAR_MS = 24;
const GAP_MS = 450;

// Cumulative start time of each line: commands type out, the rest appear whole.
const STARTS = SCRIPT.reduce<number[]>((acc, s, i) => {
  const prev = i === 0 ? 300 : acc[i - 1] + (SCRIPT[i - 1].kind === "cmd" ? SCRIPT[i - 1].text.length * CHAR_MS : 0) + GAP_MS;
  acc.push(prev);
  return acc;
}, []);
const TOTAL = STARTS[STARTS.length - 1] + 900;

export function HeroTerminal({ className }: { className?: string }) {
  return (
    <Showcase label="A terminal cloning the repository, copying the example environment file and starting Docker Compose." className={className}>
      <Stage cycle={TOTAL + 3200} final={TOTAL + 400}>
        {({ t }) => (
          <div className="w-full">
            <Chrome title="~/AgentSDR — zsh">
              <div className={cn(MONO, "min-h-[290px] space-y-2 p-5 text-[13px] leading-[22px] sm:p-7 sm:text-[14px]")}>
                {SCRIPT.map((s, i) => {
                  if (t < STARTS[i]) return null;
                  if (s.kind === "cmd") {
                    const typed = Math.min(s.text.length, Math.floor((t - STARTS[i]) / CHAR_MS));
                    const typing = typed < s.text.length;
                    return (
                      <p key={s.text} className="break-all text-white/90">
                        <span className="mr-2 text-[#97baff]">$</span>
                        {s.text.slice(0, typed)}
                        {typing && <span aria-hidden="true" className="ml-px inline-block h-[1.1em] w-[7px] translate-y-[3px] bg-white/80" />}
                      </p>
                    );
                  }
                  return (
                    <p key={s.text} className={cn("break-words", s.kind === "comment" && "text-white/40", s.kind === "out" && "text-white/60", s.kind === "done" && "text-[#5ee09c]")}>
                      {s.text}
                    </p>
                  );
                })}
              </div>
            </Chrome>
          </div>
        )}
      </Stage>
    </Showcase>
  );
}

// ---------------------------------------------------------------- copyable recipes

type Line = { text: string; note?: string };
const RECIPES: Record<string, { label: string; lines: Line[]; after: string }> = {
  compose: {
    label: "Docker Compose",
    lines: [
      { text: "git clone https://github.com/Kandid-ai/AgentSDR.git" },
      { text: "cd AgentSDR" },
      { text: "cp .env.example .env", note: "set the secrets and POSTGRES_PASSWORD" },
      { text: "docker compose up -d" },
    ],
    after: "Starts db (PostgreSQL 18), setup (creates the schema on an empty database), app on port 3000, and cron.",
  },
  source: {
    label: "From source",
    lines: [
      { text: "git clone https://github.com/Kandid-ai/AgentSDR.git" },
      { text: "cd AgentSDR" },
      { text: "bun install" },
      { text: "cp .env.example .env.local", note: "then edit it" },
      { text: "bun run db:setup", note: "creates the schema in an EMPTY database" },
      { text: "bun run build" },
      { text: "bun run start", note: "serves on http://localhost:3000" },
    ],
    after: "Needs PostgreSQL 16 or newer and Bun 1.2+ (or Node.js 20.9+). Put it behind a reverse proxy that terminates TLS.",
  },
  external: {
    label: "Your own Postgres",
    lines: [
      { text: "COMPOSE_FILE=docker-compose.yml:docker-compose.external-db.yml", note: "in .env" },
      { text: "DATABASE_URL=postgres://user:password@your-host:5432/agentsdr", note: "in .env" },
      { text: "DATABASE_SSL=", note: "empty = TLS on, which hosted Postgres expects" },
      { text: "docker compose up -d" },
    ],
    after: "The db service is not started and setup creates the schema in your database on first start, so it must be empty then. Needs Docker Compose 2.24 or newer.",
  },
};

export function GetRunning({ className }: { className?: string }) {
  const [key, setKey] = useState<keyof typeof RECIPES>("compose");
  const [copied, setCopied] = useState(false);
  const recipe = RECIPES[key];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recipe.lines.map((l) => (l.note ? `${l.text}  # ${l.note}` : l.text)).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the commands are on screen to copy by hand.
    }
  };

  return (
    <div className={className}>
      <Chrome
        title="get running"
        right={
          <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-2.5 py-1 text-[12px] font-medium text-white/80 outline-none transition-colors hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-[#97baff]">
            {copied ? <RiCheckLine className="size-3.5" aria-hidden="true" /> : <RiFileCopyLine className="size-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        }
      >
        <div role="tablist" aria-label="How to run it" className="flex gap-1 overflow-x-auto border-b border-white/[0.07] px-3 py-2">
          {Object.entries(RECIPES).map(([k, r]) => (
            <button key={k} type="button" role="tab" aria-selected={key === k} onClick={() => setKey(k)} className={cn("shrink-0 rounded-md px-3 py-1 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#97baff]", key === k ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white/85")}>
              {r.label}
            </button>
          ))}
        </div>
        <pre className={cn(MONO, "overflow-x-auto p-5 text-[13px] leading-[24px] text-white/90 sm:p-6")}>
          <code>
            {recipe.lines.map((l) => (
              <span key={l.text} className="block whitespace-pre">
                {!l.text.includes("=") || l.text.startsWith("docker") ? <span className="select-none text-[#97baff]">$ </span> : <span className="select-none text-white/30">  </span>}
                {l.text}
                {l.note && <span className="text-white/40">{`   # ${l.note}`}</span>}
              </span>
            ))}
          </code>
        </pre>
        <p className="border-t border-white/[0.07] px-5 py-4 text-[13px] leading-[20px] text-white/55 sm:px-6">{recipe.after}</p>
      </Chrome>
    </div>
  );
}
