"use client";

import { RiCloudLine, RiDatabase2Line, RiKey2Line, RiMailLine, RiServerLine } from "@remixicon/react";
import { Showcase } from "@/components/landing/Showcase";

/**
 * Where your data goes: your server on the left, the five places it talks to
 * on the right. Dashed lines flow while motion is allowed.
 */

const DESTINATIONS = [
  { icon: RiDatabase2Line, title: "Your PostgreSQL", body: "Leads, conversations, campaigns, settings. Saved credentials sit encrypted with AES-256-GCM.", accent: "#335cff" },
  { icon: RiCloudLine, title: "Your Cloudflare R2 bucket", body: "Call recordings, reached only through short-lived presigned links.", accent: "#fa7319" },
  { icon: RiKey2Line, title: "OpenRouter, on your keys", body: "Every AI call goes to the one provider you picked. Fallbacks are off, so a failure fails.", accent: "#7d52f4" },
  { icon: RiMailLine, title: "Your Google Workspace and Unipile", body: "Mailboxes, LinkedIn and WhatsApp accounts you connect, per organization.", accent: "#1fc16b" },
] as const;

export function DataMap({ className }: { className?: string }) {
  return (
    <Showcase label="Your server connected to your PostgreSQL, your Cloudflare R2 bucket, OpenRouter with your keys, and your Google Workspace and Unipile accounts.">
      <style>{`
        .dm-flow{background-image:repeating-linear-gradient(90deg,currentColor 0 6px,transparent 6px 14px);background-size:14px 2px;animation:dm-flow 900ms linear infinite}
        @keyframes dm-flow{to{background-position:14px 0}}
        @media (prefers-reduced-motion: reduce){.dm-flow{animation:none}}
      `}</style>
      <div className={`grid items-stretch gap-4 rounded-[28px] bg-[#f7f7f8] p-4 ring-1 ring-black/[0.05] sm:p-8 lg:grid-cols-[260px_minmax(0,1fr)] ${className ?? ""}`}>
        <div className="flex flex-col justify-center rounded-2xl bg-[#0d0f1a] p-6 text-white">
          <RiServerLine className="size-7 text-[#97baff]" aria-hidden="true" />
          <p className="mt-4 text-[18px] font-medium leading-6">Your server</p>
          <p className="mt-2 text-[14px] leading-[22px] text-white/60">One AgentSDR app process that you run, on the host you choose.</p>
        </div>
        <ul className="grid gap-3">
          {DESTINATIONS.map(({ icon: Icon, title, body, accent }) => (
            <li key={title} className="flex items-center gap-3">
              <span aria-hidden="true" className="dm-flow hidden h-[2px] w-12 shrink-0 lg:block" style={{ color: accent }} />
              <div className="flex flex-1 items-start gap-3 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.05)]">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${accent} 12%, white)`, color: accent }}>
                  <Icon className="size-[18px]" />
                </span>
                <div>
                  <p className="text-[15px] font-medium leading-5 text-[#141414]">{title}</p>
                  <p className="mt-1 text-[13px] leading-[20px] text-[#656565]">{body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Showcase>
  );
}
