"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RiArrowDownSLine, RiArrowRightLine, RiArrowRightUpLine, RiCloseLine, RiGithubFill, RiMenuLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import landing from "../landing/landing.module.css";
import { AppIcon, Cta, displayFont, LINKS, monoFont } from "../landing/ui";
import { NAV, type NavLink, type NavSection } from "./catalog";
import { NavIcon } from "./NavIcon";
import styles from "./marketing.module.css";

/**
 * The marketing site's header, after Clay's: Product, Solutions and
 * Resources each open a mega-menu of icon rows in titled columns, with a
 * featured card at the end. Two bars carry it, as on the landing page — a
 * dark glass bar on the hero and a white pill that drops in once the hero
 * has scrolled away — and on a phone a sheet lists every link.
 *
 * Every panel is in the server-rendered HTML (hidden ones are inert), so
 * crawlers follow each link from every page.
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

  const menuButton = (tone: "dark" | "light") => (
    <button
      type="button"
      onClick={() => setMenuOpen(true)}
      aria-label="Open menu"
      aria-expanded={menuOpen}
      aria-controls={menuId}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 lg:hidden",
        tone === "dark" ? "text-white hover:bg-white/[0.08] focus-visible:ring-white/60" : "text-[#141414] hover:bg-black/5 focus-visible:ring-[#335cff]",
      )}
    >
      <RiMenuLine className="size-5" aria-hidden="true" />
    </button>
  );

  return (
    <>
      {/* On the hero: the glass bar */}
      <header className="absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className={cn(landing.navGlass, "relative mx-auto grid h-14 max-w-[1128px] grid-cols-[1fr_auto] items-center rounded-full pl-2 pr-2 lg:grid-cols-[1fr_auto_1fr] sm:h-[60px]")}>
          <Link href="/" aria-label="AgentSDR home" className="group flex w-max items-center gap-2.5 rounded-full py-1 pl-3 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60">
            <AppIcon small className="size-7" walk="scuttle" walkOn="hover" />
            <span className={cn(displayFont, landing.wordmark, "text-white")}>AgentSDR</span>
          </Link>
          <MegaMenu tone="dark" />
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
            {menuButton("dark")}
          </div>
        </div>
      </header>

      {/* Once the hero has gone: the floating pill */}
      <div
        className={cn(
          "fixed inset-x-2 top-2 z-40 transition-[transform,opacity] duration-500 ease-[cubic-bezier(.6,.6,0,1)] sm:inset-x-4 sm:top-5 motion-reduce:transition-none",
          floating ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-[140%] opacity-0",
        )}
        inert={!floating}
      >
        <div className={cn(landing.navPill, "relative mx-auto flex h-14 max-w-[820px] items-center gap-2 rounded-full pl-3 pr-2 sm:h-[60px]")}>
          <Link href="/" aria-label="AgentSDR home" className="group flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#335cff]">
            <AppIcon small className="size-9" walk="scuttle" walkOn="hover" />
          </Link>
          <div className="hidden flex-1 lg:block">
            <MegaMenu tone="light" />
          </div>
          <span className="flex-1 lg:hidden" />
          <Cta href={LINKS.app} variant="light" className="hidden sm:inline-flex">
            Open the app
          </Cta>
          <Cta href={LINKS.github} external variant="primary" icon={RiGithubFill} className="px-3.5 sm:px-4">
            <span>
              Star<span className="hidden sm:inline"> on GitHub</span>
            </span>
          </Cta>
          {menuButton("light")}
        </div>
      </div>

      <PhoneMenu id={menuId} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

// ---------------------------------------------------------------- desktop

const OPEN_DELAY = 70;
const CLOSE_DELAY = 160;

/**
 * The three triggers and the panel they share. Hover opens (after a short
 * delay, so passing over doesn't flash it), moving between triggers slides
 * the content sideways, and leaving the trigger row and the panel closes it.
 * Click and keyboard work too: Enter/Space toggle, Escape closes and returns
 * focus, ArrowDown moves into the panel.
 */
function MegaMenu({ tone }: { tone: "dark" | "light" }) {
  const [open, setOpen] = useState<number | null>(null);
  // The last section shown, so content stays put while the panel fades out.
  const [shown, setShown] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();

  const schedule = useCallback((fn: () => void, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  }, []);
  const show = useCallback((i: number) => {
    setOpen(i);
    setShown(i);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Close on an outside click, and on Escape from anywhere inside.
  useEffect(() => {
    if (open === null) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      triggers.current[open]?.focus();
      setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dark = tone === "dark";

  return (
    <div
      ref={root}
      className={cn(dark ? "hidden lg:block" : "")}
      onPointerLeave={(e) => e.pointerType === "mouse" && schedule(() => setOpen(null), CLOSE_DELAY)}
      onPointerEnter={() => window.clearTimeout(timer.current)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) setOpen(null);
      }}
    >
      <nav aria-label="Main" className={cn("flex items-center gap-0.5", !dark && "justify-center")}>
        {NAV.map((section, i) => (
          <button
            key={section.key}
            ref={(el) => {
              triggers.current[i] = el;
            }}
            type="button"
            id={`${baseId}-trigger-${i}`}
            aria-expanded={open === i}
            aria-controls={`${baseId}-pane-${i}`}
            onPointerEnter={(e) => e.pointerType === "mouse" && schedule(() => show(i), open === null ? OPEN_DELAY : 0)}
            onClick={() => (open === i ? setOpen(null) : show(i))}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                show(i);
                requestAnimationFrame(() => document.getElementById(`${baseId}-pane-${i}`)?.querySelector<HTMLElement>("a")?.focus());
              }
            }}
            className={cn(
              "flex items-center gap-1 rounded-full py-2 pl-3.5 pr-2.5 text-[14px] outline-none transition-[background,color] duration-200 ease-[cubic-bezier(.6,.6,0,1)] focus-visible:ring-2",
              dark
                ? cn("text-white/70 hover:bg-white/[0.08] hover:text-white focus-visible:text-white focus-visible:ring-white/50", open === i && "bg-white/[0.08] text-white")
                : cn("text-[#141414]/75 hover:bg-[#37373714] hover:text-[#141414] focus-visible:ring-[#335cff]", open === i && "bg-[#37373714] text-[#141414]"),
            )}
          >
            {section.label}
            <RiArrowDownSLine className={cn(styles.chevron, "size-4 opacity-60")} aria-hidden="true" />
          </button>
        ))}
        <Link
          href="/compare"
          className={cn(
            "rounded-full px-3.5 py-2 text-[14px] outline-none transition-[background,color] duration-200 focus-visible:ring-2",
            dark ? "text-white/70 hover:bg-white/[0.08] hover:text-white focus-visible:ring-white/50" : "text-[#141414]/75 hover:bg-[#37373714] hover:text-[#141414] focus-visible:ring-[#335cff]",
          )}
        >
          Compare
        </Link>
      </nav>

      {/* The panel: centred under the bar, as wide as the page's content column. */}
      <div
        data-open={open !== null}
        inert={open === null}
        className={cn(styles.panel, "absolute left-1/2 top-full z-50 w-[min(1128px,calc(100vw-32px))] -translate-x-1/2 pt-3")}
      >
        <div className={cn(styles.panelCard, "grid overflow-hidden rounded-[28px] p-3")}>
          {NAV.map((section, i) => (
            <Pane key={section.key} id={`${baseId}-pane-${i}`} labelledBy={`${baseId}-trigger-${i}`} section={section} active={open === i || (open === null && shown === i)} dir={Math.sign(i - shown)} onNavigate={() => setOpen(null)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Pane({ id, labelledBy, section, active, dir, onNavigate }: { id: string; labelledBy: string; section: NavSection; active: boolean; dir: number; onNavigate: () => void }) {
  return (
    <div id={id} role="region" aria-labelledby={labelledBy} data-active={active} inert={!active} className={cn(styles.pane, "grid gap-2 lg:grid-cols-[1fr_300px]")} style={{ "--dir": dir } as CSSProperties}>
      <div className="grid gap-x-2 gap-y-4 p-3 sm:grid-cols-3">
        {section.groups.map((group) => (
          <div key={group.title}>
            <p className={cn(monoFont, "px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#8a8a8a]")}>{group.title}</p>
            <ul className="grid gap-0.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <MenuLink link={link} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <FeatureCard section={section} onNavigate={onNavigate} />
    </div>
  );
}

function MenuLink({ link, onNavigate, size = "md" }: { link: NavLink; onNavigate?: () => void; size?: "md" | "lg" }) {
  const marked = Boolean(link.icon || link.logo);
  const body = (
    <>
      {marked && <NavIcon link={link} className={styles.menuIcon} />}
      <span className="min-w-0">
        <span className={cn("flex items-center gap-1 font-medium leading-5 text-[#141414]", size === "lg" ? "text-[16px]" : "text-[14.5px]", marked && "pt-0.5")}>
          {link.label}
          {link.external && <RiArrowRightUpLine className="size-3.5 text-[#a3a3a3]" aria-hidden="true" />}
        </span>
        {link.blurb && <span className="mt-0.5 block text-[13px] leading-[18px] text-[#7a7a7a]">{link.blurb}</span>}
      </span>
    </>
  );
  // Icon and title share a top edge; a row with no mark is a compact text link.
  const cls = cn(
    styles.menuItem,
    "flex items-start gap-3 rounded-2xl px-3 outline-none transition-colors duration-200 hover:bg-[#f5f5f6] focus-visible:bg-[#f5f5f6] focus-visible:ring-2 focus-visible:ring-[#335cff]/40",
    marked ? "py-2.5" : "py-2",
  );
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onNavigate}>
      {body}
    </a>
  ) : (
    <Link href={link.href} className={cls} onClick={onNavigate}>
      {body}
    </Link>
  );
}

function FeatureCard({ section, onNavigate }: { section: NavSection; onNavigate: () => void }) {
  const { feature } = section;
  const inner: ReactNode = (
    <>
      <div aria-hidden="true" className={cn(styles.grid, "pointer-events-none absolute inset-0 opacity-70")} />
      <div className="relative flex h-full flex-col p-6">
        <div className="flex flex-1 items-center justify-center py-6">
          <span className="relative">
            <span aria-hidden="true" className="absolute inset-0 -z-10 scale-150 rounded-full bg-[#335cff]/40 blur-2xl" />
            <AppIcon className="size-[72px]" walk="bounce" />
          </span>
        </div>
        <p className={cn(monoFont, "text-[11px] font-medium uppercase tracking-[0.06em] text-white/60")}>{feature.eyebrow}</p>
        <p className={cn(displayFont, "mt-2 text-[20px] leading-[1.25] tracking-[-0.02em] text-white")}>{feature.title}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-white/85">
          Learn more <RiArrowRightLine className={cn(styles.featureArrow, "size-4")} aria-hidden="true" />
        </span>
      </div>
    </>
  );
  const cls = cn(styles.featureCard, "relative isolate hidden min-h-[300px] overflow-hidden rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-[#335cff] focus-visible:ring-offset-2 lg:block");
  return feature.external ? (
    <a href={feature.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onNavigate}>
      {inner}
    </a>
  ) : (
    <Link href={feature.href} className={cls} onClick={onNavigate}>
      {inner}
    </Link>
  );
}

// ---------------------------------------------------------------- phone

function PhoneMenu({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  return (
    <div id={id} role="dialog" aria-modal="true" aria-label="Menu" hidden={!open} className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-[#0b0a1a]/40 backdrop-blur-sm" />
      <div className="absolute inset-x-2 top-2 flex max-h-[calc(100dvh-16px)] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_64px_-12px_rgb(11_10_26/0.45)]">
        <div className="flex items-center justify-between p-3 pl-6">
          <Link href="/" onClick={onClose} className="flex items-center gap-2.5">
            <AppIcon small className="size-8" />
            <span className={cn(displayFont, landing.wordmark, landing.wordmarkSm, "text-[#141414]")}>AgentSDR</span>
          </Link>
          <button type="button" onClick={onClose} aria-label="Close menu" autoFocus className="flex size-10 items-center justify-center rounded-full text-[#141414] outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#335cff]">
            <RiCloseLine className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {NAV.map((section, i) => (
            <details key={section.key} open={i === 0} className="group border-t border-black/[0.06] first:border-t-0">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-3 py-3.5 text-[17px] font-medium text-[#141414] outline-none hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-[#335cff] [&::-webkit-details-marker]:hidden">
                {section.label}
                <RiArrowDownSLine className="size-5 text-[#8a8a8a] transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-3 pb-3">
                {section.groups.map((group) => (
                  <div key={group.title}>
                    <p className={cn(monoFont, "px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#8a8a8a]")}>{group.title}</p>
                    <ul>
                      {group.links.map((link) => (
                        <li key={link.href}>
                          <MenuLink link={{ ...link, blurb: undefined }} onNavigate={onClose} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </nav>
        <div className="grid gap-2 border-t border-black/[0.06] p-3">
          <Cta href={LINKS.github} external variant="primary" icon={RiGithubFill} size="lg">
            Star on GitHub
          </Cta>
          <Cta href={LINKS.app} variant="light" size="lg">
            Open the app
          </Cta>
        </div>
      </div>
    </div>
  );
}
