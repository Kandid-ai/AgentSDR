import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { RiArrowRightSLine } from "@remixicon/react";
import { brandDisplayClass } from "@/components/brand/font";
import { cn } from "@/utils/cn";
import styles from "./landing.module.css";

/** Where the calls to action go. */
export const LINKS = {
  github: "https://github.com/Kandid-ai/AgentSDR",
  /** The README's Quick start (Docker Compose, or from source). */
  selfHost: "https://github.com/Kandid-ai/AgentSDR#quick-start",
  issues: "https://github.com/Kandid-ai/AgentSDR/issues",
  // The app's home. Signed out, proxy.ts sends this to /sign-in?from=/analytics,
  // so signing in lands here too.
  app: "/analytics",
} as const;

/** Headline face: the brand display face (Geist 500, tight). */
export const displayFont = brandDisplayClass;
export const monoFont = "font-[family-name:var(--font-landing-mono)]";

/** The small uppercase mono pill above every headline. `tone` follows the background it sits on. */
export function Eyebrow({ children, icon: Icon, tone = "light", className }: { children: ReactNode; icon?: ComponentType<{ className?: string }>; tone?: "light" | "dark"; className?: string }) {
  return (
    <p
      className={cn(
        monoFont,
        "mx-auto inline-flex w-max items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium uppercase leading-4 tracking-[0.03em]",
        tone === "dark" ? "bg-white/[0.08] text-white/85 ring-1 ring-inset ring-white/15" : "bg-[#3737370b] text-[#656565]",
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </p>
  );
}

/** Eyebrow, headline and a one- or two-line lede, centred — the reference's section opener. */
export function SectionHead({ eyebrow, eyebrowIcon, title, lede, tone = "light", id, className }: { eyebrow: string; eyebrowIcon?: ComponentType<{ className?: string }>; title: ReactNode; lede?: ReactNode; tone?: "light" | "dark"; id?: string; className?: string }) {
  return (
    <div className={cn("mx-auto flex max-w-3xl flex-col items-center px-4 text-center", className)}>
      <Eyebrow tone={tone} icon={eyebrowIcon}>{eyebrow}</Eyebrow>
      <h2 id={id} className={cn(displayFont, "mt-4 text-balance text-[40px] leading-[1.08] tracking-[-0.035em] sm:text-[56px] lg:text-[64px]", tone === "dark" ? styles.skyText : "text-[#141414]")}>
        {title}
      </h2>
      {lede && <p className={cn("mt-5 max-w-xl text-pretty text-[16px] leading-[1.6] sm:text-[17px]", tone === "dark" ? "text-white/75" : "text-[#656565]")}>{lede}</p>}
    </div>
  );
}

type CtaProps = { href: string; children: ReactNode; icon?: ComponentType<{ className?: string }>; variant?: "primary" | "glass" | "light" | "dark"; size?: "md" | "lg"; className?: string; external?: boolean };

/** Pill buttons in the reference's three looks, plus a solid dark one for light sections. */
export function Cta({ href, children, icon: Icon, variant = "primary", size = "md", className, external }: CtaProps) {
  const cls = cn(
    "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] outline-none transition-[background,transform,box-shadow] duration-200 ease-[cubic-bezier(.6,.6,0,1)] focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-px active:duration-[50ms]",
    size === "lg" ? "h-11 px-5 text-[15px]" : "h-9 px-4 text-[14px]",
    variant === "primary" && cn(styles.btnPrimary, "text-white focus-visible:ring-[#97baff] focus-visible:ring-offset-transparent"),
    variant === "glass" && cn(styles.btnGlass, "text-white focus-visible:ring-white/60 focus-visible:ring-offset-transparent"),
    variant === "light" && cn(styles.btnLight, "text-[#141414] focus-visible:ring-[#335cff] focus-visible:ring-offset-white"),
    variant === "dark" && "bg-[#141414] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-[#2a2a2a] focus-visible:ring-[#335cff] focus-visible:ring-offset-white",
    className,
  );
  const inner = (
    <>
      {Icon && <Icon className="size-[18px] shrink-0" aria-hidden="true" />}
      {children}
      {variant === "primary" && <RiArrowRightSLine className="-mr-1 size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

// The logo lives in components/brand so the app and this page share it.
export { AgentMark, AppIcon, ICON_RADIUS } from "@/components/brand/Logo";
