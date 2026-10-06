import Link from "next/link";
import { MascotStroll } from "@/components/brand/Mascot";
import { cn } from "@/utils/cn";
import styles from "../landing/landing.module.css";
import { AppIcon, displayFont, LINKS } from "../landing/ui";
import { isBlogPath } from "@/lib/marketing/site";
import { FOOTER } from "./catalog";

/** Every marketing page, in columns under the brand row, so each page links to every other. */
export function Footer() {
  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto max-w-[1128px] px-4 pb-14 pt-16 sm:px-6 sm:pt-24">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <Link href="/" className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#335cff]" aria-label="AgentSDR home">
            <AppIcon small className="size-11" walk="step" walkOn="hover" />
            {/* Name over tagline: two lines that together stand as tall as the tile. */}
            <span className="flex flex-col">
              <span className={cn(displayFont, "text-[18px] leading-6 tracking-[-0.025em] text-[#141414]")}>AgentSDR</span>
              <span className="text-[14px] leading-5 text-[#707070]">The open-source AI SDR</span>
            </span>
          </Link>
          <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-full px-3.5 py-2 text-[14px] text-[#141414] shadow-[0_0_0_1px_rgb(0_0_0/0.06)] outline-none transition-colors hover:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-[#335cff]">
            <span aria-hidden="true" className={cn(styles.breathe, "size-2 rounded-full bg-[#1fc16b]")} />
            Open source · built in public
          </a>
        </div>

        {/* Shade strolls along the rule between the brand row and the links. */}
        <MascotStroll className="mt-4 h-9 border-b border-black/[0.06]" walkerClassName="size-9 text-[#335cff]" />

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 pt-10 sm:grid-cols-3 lg:grid-cols-5">
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="text-[14px] text-[#707070]">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="rounded text-[14px] text-[#141414] outline-none hover:text-[#335cff] focus-visible:ring-2 focus-visible:ring-[#335cff]">
                        {l.label}
                      </a>
                    ) : isBlogPath(l.href) ? (
                      <a href={l.href} className="rounded text-[14px] text-[#141414] outline-none hover:text-[#335cff] focus-visible:ring-2 focus-visible:ring-[#335cff]">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="rounded text-[14px] text-[#141414] outline-none hover:text-[#335cff] focus-visible:ring-2 focus-visible:ring-[#335cff]">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[14px] text-[#707070]">Built with</p>
            <p className="mt-4 text-[14px] leading-6 text-[#656565]">Next.js, Postgres and your own AI key. Email, LinkedIn and WhatsApp in one workspace.</p>
          </div>
        </nav>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.06] pt-8 text-[14px] text-[#707070]">
          <p>© {new Date().getFullYear()} AgentSDR</p>
          <p>AGPL-3.0 · Sample data throughout. No customer data is shown.</p>
        </div>
      </div>
    </footer>
  );
}
