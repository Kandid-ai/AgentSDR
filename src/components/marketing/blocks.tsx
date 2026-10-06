import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { RiArrowRightLine, RiCheckLine, RiGithubFill } from "@remixicon/react";
import { faqLd } from "@/lib/marketing/seo";
import { cn } from "@/utils/cn";
import landing from "../landing/landing.module.css";
import { Reveal } from "../landing/Reveal";
import { AppIcon, Cta, displayFont, Eyebrow, LINKS, monoFont, SectionHead } from "../landing/ui";
import { linkFor } from "./catalog";
import { JsonLd } from "./JsonLd";
import { NavIcon } from "./NavIcon";
import styles from "./marketing.module.css";

/**
 * The building blocks every marketing page is made of. Server components:
 * pages pass plain data and icons straight in. The animated, stateful ones
 * (scene stages, product shots, counting stats) are in ./live.
 *
 * A page is, top to bottom: PageHero (with a HeroFrame visual), then
 * sections — FeatureSplit rows, a FeatureGrid, Steps, StatBand, a
 * comparison — then FaqSection, RelatedPages and ClosingCta.
 */

type Icon = ComponentType<{ className?: string; style?: CSSProperties }>;
type Action = { href: string; label: string; external?: boolean };

const DEFAULT_PRIMARY: Action = { href: LINKS.github, label: "Star on GitHub", external: true };
const DEFAULT_SECONDARY: Action = { href: LINKS.selfHost, label: "Self-host it", external: true };

// ---------------------------------------------------------------- hero

/**
 * The page opener on the landing page's sky: eyebrow, the h1, a lede and
 * two calls to action, rising in one after another. `children` is the
 * visual under it (usually a HeroFrame).
 */
export function PageHero({
  eyebrow,
  eyebrowIcon,
  title,
  lede,
  primary = DEFAULT_PRIMARY,
  secondary = DEFAULT_SECONDARY,
  children,
}: {
  eyebrow: string;
  eyebrowIcon?: Icon;
  /** The h1. Keep the page's main search phrase in it. */
  title: ReactNode;
  lede: ReactNode;
  primary?: Action | null;
  secondary?: Action | null;
  children?: ReactNode;
}) {
  return (
    <div className={cn(children ? landing.sky : styles.skyCompact, "relative isolate overflow-hidden")}>
      <div aria-hidden="true" className={cn(styles.aurora, "pointer-events-none absolute -inset-x-1/4 top-0 -z-10 h-[720px]")} />
      <div aria-hidden="true" className={cn(styles.grid, "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px]")} />
      <section aria-labelledby="page-title" className={cn("relative", children ? "pb-10 sm:pb-16" : "pb-16 sm:pb-20")}>
        <div className="mx-auto max-w-[1128px] px-4 pb-12 pt-32 text-center sm:px-6 sm:pt-40">
          <div className={styles.rise}>
            <Eyebrow tone="dark" icon={eyebrowIcon}>
              {eyebrow}
            </Eyebrow>
          </div>
          <h1
            id="page-title"
            className={cn(styles.rise, displayFont, landing.skyText, "mx-auto mt-6 max-w-[18ch] text-balance text-[42px] leading-[1.08] tracking-[-0.03em] sm:text-[60px] lg:text-[68px]")}
            style={{ "--rise-delay": "120ms" } as CSSProperties}
          >
            {title}
          </h1>
          <p className={cn(styles.rise, "mx-auto mt-6 max-w-[42rem] text-pretty text-[16px] leading-[1.6] text-white/75 sm:text-[18px]")} style={{ "--rise-delay": "200ms" } as CSSProperties}>
            {lede}
          </p>
          {(primary || secondary) && (
            <div className={cn(styles.rise, "mt-8 flex flex-wrap items-center justify-center gap-4")} style={{ "--rise-delay": "280ms" } as CSSProperties}>
              {primary && (
                <Cta href={primary.href} external={primary.external} variant="primary" icon={primary.href === LINKS.github ? RiGithubFill : undefined} size="lg">
                  {primary.label}
                </Cta>
              )}
              {secondary && (
                <Cta href={secondary.href} external={secondary.external} variant="glass" size="lg">
                  {secondary.label}
                </Cta>
              )}
            </div>
          )}
        </div>
        {children}
      </section>
    </div>
  );
}

/** The glass frame and channel-coloured wallpaper a hero's product visual sits in. */
export function HeroFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(styles.lift, "mx-auto max-w-[1200px] px-2 sm:px-6", className)}>
      <div className={cn(landing.skyFrame, "rounded-[26px] p-1.5 sm:rounded-[34px] sm:p-2.5")}>
        <div className={cn(landing.wallpaper, "overflow-hidden rounded-[20px] p-2 pt-6 sm:rounded-[26px] sm:p-8")}>{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sections

/** A white page section with an optional centred head. */
export function Section({ id, eyebrow, title, lede, tone = "white", children, className }: { id?: string; eyebrow?: string; title?: ReactNode; lede?: ReactNode; tone?: "white" | "grey"; children: ReactNode; className?: string }) {
  const headId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headId : undefined} className={cn("scroll-mt-24 py-16 sm:py-24", tone === "grey" ? "bg-[#f7f7f8]" : "bg-white", className)}>
      {title && eyebrow && (
        <Reveal>
          <SectionHead id={headId} eyebrow={eyebrow} title={title} lede={lede} />
        </Reveal>
      )}
      <div className={cn("mx-auto max-w-[1128px] px-4 sm:px-6", title && "mt-12 sm:mt-16")}>{children}</div>
    </section>
  );
}

/**
 * Copy on one side, a visual on the other (alternating with `reverse`): the
 * main way a page walks through a capability. Bullets get ticks that pop in.
 */
export function FeatureSplit({ eyebrow, title, body, bullets, visual, reverse = false, accent = "#335cff", id }: { eyebrow?: string; title: string; body: ReactNode; bullets?: string[]; visual: ReactNode; reverse?: boolean; accent?: string; id?: string }) {
  return (
    <div id={id} className="grid scroll-mt-28 items-center gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <Reveal className={cn("max-w-[30rem]", reverse && "lg:order-2")}>
        {eyebrow && (
          <p className={cn(monoFont, "flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.06em]")} style={{ color: accent }}>
            <span aria-hidden="true" className="h-px w-6" style={{ background: accent }} />
            {eyebrow}
          </p>
        )}
        <h3 className={cn(displayFont, "mt-4 text-balance text-[30px] leading-[1.12] tracking-[-0.03em] text-[#141414] sm:text-[38px]")}>{title}</h3>
        <div className="mt-4 text-pretty text-[16px] leading-[1.65] text-[#5c5c5c]">{body}</div>
        {bullets && bullets.length > 0 && (
          <ul className="mt-6 grid gap-3">
            {bullets.map((b, i) => (
              <li key={b} className="flex gap-3 text-[15px] leading-6 text-[#2b2b2b]">
                <span aria-hidden="true" className={cn(styles.tick, "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white")} style={{ background: accent, "--tick-delay": `${300 + i * 90}ms` } as CSSProperties}>
                  <RiCheckLine className="size-3.5" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}
      </Reveal>
      <Reveal delay={120} className={cn("min-w-0", reverse && "lg:order-1")}>
        {visual}
      </Reveal>
    </div>
  );
}

/** Icon, title and a line or two, on a hairline grid of white cells. */
export function FeatureGrid({ items, columns = 3 }: { items: ReadonlyArray<{ icon: Icon; title: string; body: ReactNode }>; columns?: 2 | 3 | 4 }) {
  return (
    <Reveal>
      <ul className={cn("grid overflow-hidden rounded-3xl bg-black/[0.06] [gap:1px] ring-1 ring-black/[0.06] sm:grid-cols-2", columns === 3 && "lg:grid-cols-3", columns === 4 && "lg:grid-cols-4")}>
        {items.map(({ icon: Icon, title, body }) => (
          <li key={title} className="group flex flex-col bg-white px-6 py-7 transition-colors duration-300 hover:bg-[#fbfbfc] sm:px-8 sm:py-8">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#335cff]/[0.07] text-[#335cff] ring-1 ring-inset ring-[#335cff]/[0.14] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:-translate-y-0.5 group-hover:rotate-[-4deg]">
              <Icon className="size-5" />
            </span>
            <p className="mt-5 text-[16px] font-medium leading-6 text-[#141414]">{title}</p>
            <div className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">{body}</div>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

/** Numbered steps joined by a line: how something works, or how to get started. */
export function Steps({ items }: { items: ReadonlyArray<{ title: string; body: ReactNode }> }) {
  return (
    <ol className="relative grid gap-6 lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": items.length } as CSSProperties}>
      <span aria-hidden="true" className="absolute left-[19px] top-5 hidden h-px bg-gradient-to-r from-[#335cff]/40 via-[#335cff]/20 to-transparent lg:left-5 lg:right-0 lg:block" />
      {items.map((step, i) => (
        <Reveal as="li" key={step.title} delay={i * 90} className="relative flex gap-4 lg:flex-col">
          <span className={cn(monoFont, "relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-medium text-[#335cff] shadow-[0_0_0_1px_rgb(51_92_255/0.25),0_6px_16px_-8px_rgb(51_92_255/0.6)]")}>{String(i + 1).padStart(2, "0")}</span>
          <div>
            <p className="text-[16px] font-medium leading-6 text-[#141414]">{step.title}</p>
            <div className="mt-1.5 text-[14px] leading-[22px] text-[#656565]">{step.body}</div>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- closing

/**
 * Questions as native <details> in two columns, plus FAQPage structured data.
 * Answers are plain strings so what Google reads is exactly what is shown.
 */
export function FaqSection({ items, title = "Questions, answered", eyebrow = "FAQ" }: { items: ReadonlyArray<{ q: string; a: string }>; title?: string; eyebrow?: string }) {
  return (
    <Section id="faq" eyebrow={eyebrow} title={title}>
      <JsonLd data={faqLd(items)} />
      <Reveal className="grid gap-x-10 lg:grid-cols-2">
        {[items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))].map((col, c) => (
          <div key={c}>
            {col.map((item) => (
              <details key={item.q} className="group border-b border-black/[0.07]">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[16px] font-medium leading-6 text-[#141414] outline-none focus-visible:ring-2 focus-visible:ring-[#335cff] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#525866] transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="-mt-1 pb-5 pr-10 text-[15px] leading-[1.65] text-[#5c5c5c]">{item.a}</p>
              </details>
            ))}
          </div>
        ))}
      </Reveal>
    </Section>
  );
}

/** Cards linking to related pages — internal links with real anchor text. */
export function RelatedPages({ paths, title = "Keep exploring" }: { paths: string[]; title?: string }) {
  return (
    <section aria-labelledby="related-title" className="bg-white pb-8 pt-4 sm:pb-12">
      <div className="mx-auto max-w-[1128px] px-4 sm:px-6">
        <h2 id="related-title" className={cn(monoFont, "text-[12px] font-medium uppercase tracking-[0.06em] text-[#8a8a8a]")}>
          {title}
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => {
            const link = linkFor(path);
            return (
              <li key={path}>
                <Link href={link.href} className={cn(styles.liftCard, "flex h-full items-start gap-4 rounded-2xl bg-[#f7f7f8] p-5 outline-none ring-1 ring-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#335cff]")}>
                  <NavIcon link={link} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15px] font-medium text-[#141414]">
                      {link.label}
                      <RiArrowRightLine className={cn(styles.arrow, "size-4 text-[#8a8a8a]")} aria-hidden="true" />
                    </span>
                    <span className="mt-1 block text-[14px] leading-[20px] text-[#6b6b6b]">{link.blurb}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** The closing call to action: the sky folded into a rounded card. `children` is an optional visual under the copy. */
export function ClosingCta({ title, lede, primary = DEFAULT_PRIMARY, secondary = DEFAULT_SECONDARY, children }: { title: ReactNode; lede: ReactNode; primary?: Action; secondary?: Action | null; children?: ReactNode }) {
  return (
    <section aria-labelledby="closing-title" className="bg-white px-4 pb-16 pt-8 sm:px-6 sm:pb-24">
      <Reveal>
        <div className={cn(landing.ctaSky, "relative isolate mx-auto max-w-[1080px] overflow-hidden rounded-[28px] sm:rounded-[32px]", children ? "pt-14 sm:pt-20" : "py-14 sm:py-20")}>
          <div aria-hidden="true" className={cn(styles.grid, "pointer-events-none absolute inset-0 -z-10")} />
          <div className="relative flex flex-col items-start gap-8 px-6 sm:px-[12%] lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[34rem]">
              <h2 id="closing-title" className={cn(displayFont, landing.skyText, "text-balance text-[36px] leading-[1.1] tracking-[-0.03em] sm:text-[48px]")}>
                {title}
              </h2>
              <p className="mt-5 text-[16px] leading-[1.6] text-white/75">{lede}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Cta href={primary.href} external={primary.external} variant="primary" icon={primary.href === LINKS.github ? RiGithubFill : undefined} size="lg">
                  {primary.label}
                </Cta>
                {secondary && (
                  <Cta href={secondary.href} external={secondary.external} variant="glass" size="lg">
                    {secondary.label}
                  </Cta>
                )}
              </div>
            </div>
            {!children && <AppIcon className="hidden size-[96px] shrink-0 lg:block" walk="waddle" />}
          </div>
          {children && <div className="relative mt-14 px-3 sm:mt-16 sm:px-10">{children}</div>}
        </div>
      </Reveal>
    </section>
  );
}

/** A small rounded label, e.g. on a comparison row or a scene caption. */
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "orange" }) {
  const tones = { neutral: "bg-black/[0.05] text-[#525866]", blue: "bg-[#335cff]/10 text-[#2547d0]", green: "bg-[#1fc16b]/12 text-[#178c4e]", orange: "bg-[#fa7319]/12 text-[#c2570c]" };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium", tones[tone])}>{children}</span>;
}
