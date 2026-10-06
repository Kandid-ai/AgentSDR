"use client";

import { Stage } from "@/components/landing/motion/Stage";
import { Showcase } from "@/components/landing/Showcase";
import { cn } from "@/utils/cn";
import { Fade } from "./Fade";

const MONO = "font-[family-name:var(--font-landing-mono)]";

/** The repository's real top level, with what each part is for. */
type Node = { depth: 0 | 1 | 2; name: string; note: string; dir?: boolean };
const TREE: readonly Node[] = [
  { depth: 0, name: "AgentSDR/", dir: true, note: "" },
  { depth: 1, name: "src/", dir: true, note: "the Next.js app" },
  { depth: 2, name: "app/", dir: true, note: "pages, API routes, the marketing site" },
  { depth: 2, name: "lib/", dir: true, note: "domain code: outreach, crm, inbox, tenancy, platform" },
  { depth: 2, name: "jobs/ functions/ services/", dir: true, note: "the LinkedIn sending engine" },
  { depth: 1, name: "db/", dir: true, note: "schema.sql and seed.sql for a fresh install" },
  { depth: 1, name: "scripts/", dir: true, note: "migration history, run by hand" },
  { depth: 1, name: "extensions/whatsapp-recorder/", dir: true, note: "Chrome extension that records calls" },
  { depth: 1, name: "docs/", dir: true, note: "self-hosting, configuration, guides" },
  { depth: 1, name: "Dockerfile", note: "three-stage Bun image" },
  { depth: 1, name: "docker-compose.yml", note: "db, setup, app, cron" },
  { depth: 1, name: "docker-compose.external-db.yml", note: "use your own PostgreSQL" },
  { depth: 1, name: "LICENSE", note: "AGPL-3.0" },
  { depth: 1, name: "CONTRIBUTING.md  GOVERNANCE.md", note: "how changes get merged" },
];

export function RepoTree({ className }: { className?: string }) {
  return (
    <Showcase label="The repository's top-level folders and files, each with a note on what it is for." className={className}>
      <Stage cycle={TREE.length * 220 + 5200} final={TREE.length * 220 + 800}>
        {({ t }) => (
          <div className="w-full overflow-hidden rounded-[22px] bg-[#0d0f1a] shadow-[0_0_0_1px_rgb(255_255_255/0.06)_inset,0_30px_60px_-24px_rgb(11_10_26/0.6)]">
            <div className={cn(MONO, "overflow-x-auto p-5 text-[13px] leading-[26px] sm:p-7")}>
              {TREE.map((n, i) => (
                <Fade key={n.name} on={t >= 200 + i * 220} from="left" className="flex min-w-max items-baseline gap-4 whitespace-pre" style={{ paddingLeft: n.depth * 22 }}>
                  <span className={n.dir ? "text-[#97baff]" : "text-white/90"}>{n.name}</span>
                  {n.note && <span className="text-white/40">{`# ${n.note}`}</span>}
                </Fade>
              ))}
            </div>
          </div>
        )}
      </Stage>
    </Showcase>
  );
}
