"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { RiCloseLine, RiGithubFill, RiMenuLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import styles from "./landing.module.css";
import { AppIcon, Cta, displayFont, LINKS } from "./ui";

const SECTIONS = [
  { href: "#product", label: "Product" },
  { href: "#channels", label: "Channels" },
  { href: "#self-host", label: "Self-host" },
  { href: "#faq", label: "FAQ" },
];

/**
 * Two headers, as in the reference: a dark glass bar sitting on the hero, and
 * a white floating pill that drops in once the hero has scrolled away. Both
 * carry the same brand tile and links; on a phone each holds a menu button.
 */
export function Nav() {
  const [floating, setFloating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    const onScroll = () => setFloating(window.scrollY > 160);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      {/* On the hero: one glass bar, the same shape as the floating pill it hands over to */}
      <header className="absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className={cn(styles.navGlass, "mx-auto grid h-14 max-w-[1128px] grid-cols-[1fr_auto] items-center rounded-full pl-2 pr-2 md:grid-cols-[1fr_auto_1fr] sm:h-[60px]")}>
          {/* A compact lockup, inset from the bar's rounded end: a small tile and the name at a matching weight */}
          <Link href="/" aria-label="AgentSDR home" className="group flex w-max items-center gap-2.5 rounded-full py-1 pl-3 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60">
            <AppIcon small className="size-7" walk="scuttle" walkOn="hover" />
            <span className={cn(displayFont, styles.wordmark, "text-white")}>AgentSDR</span>
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-0.5 md:flex">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className="rounded-full px-3.5 py-2 text-[14px] text-white/70 outline-none transition-[background,color] duration-200 ease-[cubic-bezier(.6,.6,0,1)] hover:bg-white/[0.08] hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/50">
                {s.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-1.5">
            <a
              href={LINKS.github}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-[14px] text-white/80 outline-none transition-[background,color] duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 sm:flex"
            >
              <RiGithubFill className="size-[18px]" aria-hidden="true" />
              GitHub
            </a>
            <Cta href={LINKS.app} variant="light" className="hidden sm:inline-flex">
              Open the app
            </Cta>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              className="flex size-10 items-center justify-center rounded-full text-white outline-none hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white/60 md:hidden"
            >
              <RiMenuLine className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating pill */}
      <div
        className={cn(
          "fixed inset-x-2 top-2 z-40 transition-[transform,opacity] duration-500 ease-[cubic-bezier(.6,.6,0,1)] sm:inset-x-4 sm:top-5 motion-reduce:transition-none",
          floating ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-[140%] opacity-0",
        )}
        inert={!floating}
      >
        <div className={cn(styles.navPill, "mx-auto flex h-14 max-w-[740px] items-center gap-2 rounded-full pl-4 pr-2 sm:h-[60px]")}>
          {/* The pill is tight: the icon alone */}
          <Link href="/" aria-label="AgentSDR home" className="group flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#335cff]">
            <AppIcon small className="size-9" walk="scuttle" walkOn="hover" />
          </Link>
          <nav aria-label="Sections" className="hidden flex-1 items-center gap-0.5 whitespace-nowrap md:flex">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className="rounded-full px-3 py-2 text-[14px] text-[#141414]/80 outline-none transition-[background,color] duration-200 ease-[cubic-bezier(.6,.6,0,1)] hover:bg-[#37373714] hover:text-[#141414] focus-visible:ring-2 focus-visible:ring-[#335cff]">
                {s.label}
              </a>
            ))}
          </nav>
          <span className="flex-1 md:hidden" />
          <Cta href={LINKS.app} variant="light" className="hidden sm:inline-flex">
            Open the app
          </Cta>
          <Cta href={LINKS.github} external variant="primary" icon={RiGithubFill} className="px-3.5 sm:px-4">
            <span>Star<span className="hidden sm:inline"> on GitHub</span></span>
          </Cta>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#141414] outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#335cff] md:hidden"
          >
            <RiMenuLine className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Phone menu */}
      <div id={menuId} role="dialog" aria-modal="true" aria-label="Menu" hidden={!menuOpen} className="fixed inset-0 z-50 md:hidden">
        <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-[#0b0a1a]/40 backdrop-blur-sm" />
        <div className="absolute inset-x-2 top-2 rounded-[28px] bg-white p-3 shadow-[0_24px_64px_-12px_rgb(11_10_26/0.45)]">
          <div className="flex items-center justify-between pl-3">
            <span className="flex items-center gap-2.5">
              <AppIcon small className="size-8" />
              <span className={cn(displayFont, styles.wordmark, styles.wordmarkSm, "text-[#141414]")}>AgentSDR</span>
            </span>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" autoFocus className="flex size-10 items-center justify-center rounded-full text-[#141414] outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#335cff]">
              <RiCloseLine className="size-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Sections" className="mt-2 flex flex-col">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href} onClick={() => setMenuOpen(false)} className="rounded-2xl px-3 py-3 text-[17px] text-[#141414] outline-none hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#335cff]">
                {s.label}
              </a>
            ))}
          </nav>
          <div className="mt-2 grid gap-2 border-t border-black/[0.06] p-1 pt-3">
            <Cta href={LINKS.github} external variant="primary" icon={RiGithubFill} size="lg">
              Star on GitHub
            </Cta>
            <Cta href={LINKS.app} variant="light" size="lg">
              Open the app
            </Cta>
          </div>
        </div>
      </div>
    </>
  );
}

