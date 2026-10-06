import { RiArrowDownSLine, RiLockLine, RiSearchLine, RiSideBarLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { NAV_FOOTER, NAV_SECTIONS, type NavBadges, type NavEntry } from "@/components/nav/navConfig";
import { cn } from "@/utils/cn";
import styles from "./landing.module.css";
import { AgentMark } from "./ui";

/**
 * A product window: browser chrome (traffic lights + the URL of the page on
 * show) around the app's own sidebar and a real screen. The sidebar is drawn
 * from the app's real nav config (src/components/nav/navConfig.ts) — the
 * live Sidebar fetches badge counts for a signed-in user, so it can't run
 * here — and it is decorative, hidden from assistive tech; the screen next to
 * it is the real component.
 */

const SAMPLE_BADGES: NavBadges = { actionRequired: 23, whatsappUnread: 4, draftsAwaitingReview: 11, accountsNeedingAttention: 1 };

export function AppWindow({
  path,
  host = "agentsdr.your-company.com",
  active,
  open = ["email", "linkedin", "whatsapp"],
  sidebar = true,
  rail = false,
  fade = true,
  dark = false,
  height,
  className,
  children,
}: {
  /** Shown in the URL bar, after the workspace host. */
  path: string;
  /** The workspace host in the URL bar. */
  host?: string;
  /** The nav href to light up. */
  active: string;
  /** Nav groups shown expanded. */
  open?: string[];
  sidebar?: boolean;
  /** The sidebar collapsed to its icon rail, as the app does, to give the screen the width. */
  rail?: boolean;
  /** Fade the clipped bottom of the screen into the window's own surface, so it never ends mid-row. */
  fade?: boolean;
  /** Render the window in the app's dark mode. */
  dark?: boolean;
  /** Fixed body height (the screen scrolls inside, clipped with a fade). */
  height?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(styles.window, "overflow-hidden rounded-xl bg-bg-white-0 text-left sm:rounded-2xl", dark && cn("dark", styles.darkWindow), className)}>
      <div className="flex h-10 items-center gap-3 border-b border-stroke-soft-200 bg-bg-weak-50 px-3.5 sm:h-11">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#ff5f57] ring-1 ring-inset ring-black/10 sm:size-3" />
          <span className="size-2.5 rounded-full bg-[#febc2e] ring-1 ring-inset ring-black/10 sm:size-3" />
          <span className="size-2.5 rounded-full bg-[#28c840] ring-1 ring-inset ring-black/10 sm:size-3" />
        </span>
        <span className="mx-auto flex h-6 min-w-0 max-w-full items-center gap-1.5 rounded-md bg-bg-white-0 px-2.5 text-[11px] text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 sm:h-7 sm:px-3 sm:text-[12px]">
          <RiLockLine className="size-3 shrink-0 text-text-soft-400" aria-hidden="true" />
          <span className="truncate">
            {host}<span className="text-text-soft-400">{path}</span>
          </span>
        </span>
        <span className="hidden w-[46px] sm:block" aria-hidden="true" />
      </div>
      <div className={cn("flex min-h-0", height)}>
        {sidebar && (rail ? <MiniRail active={active} /> : <MiniSidebar active={active} open={open} />)}
        <div className="relative min-w-0 flex-1 overflow-hidden bg-bg-white-0">
          {children}
          {fade && height && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-b from-transparent to-bg-white-0" />}
        </div>
      </div>
    </div>
  );
}

function MiniSidebar({ active, open }: { active: string; open: string[] }) {
  const row = (entry: NavEntry) => {
    if (entry.kind === "link") {
      const Icon = entry.icon;
      const on = entry.href === active;
      const badge = entry.badge ? SAMPLE_BADGES[entry.badge] : 0;
      return (
        <div key={entry.href} className={cn("flex h-8 items-center gap-2.5 rounded-lg px-2 text-label-sm", on ? "bg-bg-weak-50 text-text-strong-950" : "text-text-sub-600")}>
          <Icon className={cn("size-[18px] shrink-0", on ? "text-text-strong-950" : "text-text-soft-400")} />
          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          {badge > 0 &&
            (entry.badgeStyle === "dot" ? (
              <span className="size-2 shrink-0 rounded-full bg-warning-base" />
            ) : (
              <span className="shrink-0 rounded-md bg-bg-weak-50 px-1.5 py-0.5 text-label-xs tabular-nums text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">{badge}</span>
            ))}
        </div>
      );
    }
    const Icon = entry.icon;
    const expanded = open.includes(entry.id);
    return (
      <div key={entry.id}>
        <div className="flex h-8 items-center gap-2.5 rounded-lg px-2 text-label-sm text-text-sub-600">
          <span className={cn("flex shrink-0", !entry.color && "text-text-soft-400")} style={entry.color ? { color: entry.color } : undefined}>
            <Icon className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          <RiArrowDownSLine className={cn("size-4 shrink-0 text-text-soft-400", !expanded && "-rotate-90")} />
        </div>
        {expanded && (
          <div className="mt-0.5 space-y-0.5 pl-3">
            {entry.children.map((c) => {
              const ChildIcon = c.icon;
              const on = c.href === active;
              const badge = c.badge ? SAMPLE_BADGES[c.badge] : 0;
              return (
                <div key={c.href} className={cn("flex h-7 items-center gap-2 rounded-lg px-2 text-paragraph-sm", on ? "bg-bg-weak-50 text-label-sm text-text-strong-950" : "text-text-sub-600")}>
                  <ChildIcon className={cn("size-4 shrink-0", on ? "text-text-strong-950" : "text-text-soft-400")} />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {badge > 0 && <span className="shrink-0 rounded-md bg-bg-weak-50 px-1.5 text-label-xs tabular-nums text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">{badge}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div aria-hidden="true" className="hidden w-56 shrink-0 flex-col border-r border-stroke-soft-200 bg-bg-white-0 lg:flex">
      <div className="flex h-12 shrink-0 items-center justify-between pl-4 pr-3">
        <span className="flex items-center gap-2">
          <AgentMark className="h-[15px] w-auto text-text-strong-950" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-text-strong-950">AgentSDR</span>
        </span>
        <RiSideBarLine className="size-[18px] text-text-soft-400" />
      </div>
      <div className="px-3 pb-2">
        <div className="flex h-8 items-center gap-2 rounded-lg bg-bg-white-0 px-2.5 text-paragraph-sm text-text-soft-400 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">
          <RiSearchLine className="size-4 shrink-0" />
          <span className="flex-1 truncate">Search or jump to…</span>
          <kbd className="rounded bg-bg-weak-50 px-1.5 text-label-xs text-text-soft-400 ring-1 ring-inset ring-stroke-soft-200">⌘K</kbd>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? i} className={cn(i > 0 && "mt-3")}>
            {section.label && <p className="mb-1 px-2 text-paragraph-xs text-text-soft-400">{section.label}</p>}
            <div className="space-y-0.5">{section.entries.map(row)}</div>
          </div>
        ))}
        <div className="mt-3 space-y-0.5 border-t border-stroke-soft-200 pt-2">{NAV_FOOTER.map(row)}</div>
      </div>
    </div>
  );
}

/** The sidebar collapsed to its icon rail (the app's own collapsed state). */
function MiniRail({ active }: { active: string }) {
  const icon = (entry: NavEntry) => {
    if (entry.kind === "link") {
      const Icon = entry.icon;
      const on = entry.href === active;
      const badge = entry.badge ? SAMPLE_BADGES[entry.badge] : 0;
      return (
        <div key={entry.href} className={cn("relative flex h-9 items-center justify-center rounded-lg", on && "bg-bg-weak-50")}>
          <Icon className={cn("size-[18px]", on ? "text-text-strong-950" : "text-text-soft-400")} />
          {badge > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-warning-base ring-2 ring-bg-white-0" />}
        </div>
      );
    }
    const Icon = entry.icon;
    const on = entry.children.some((c) => c.href === active);
    return (
      <div key={entry.id} className={cn("flex h-9 items-center justify-center rounded-lg", on && "bg-bg-weak-50")}>
        <span className={cn("flex", !entry.color && "text-text-soft-400")} style={entry.color ? { color: entry.color } : undefined}>
          <Icon className="size-[18px]" />
        </span>
      </div>
    );
  };
  return (
    <div aria-hidden="true" className="hidden w-[60px] shrink-0 flex-col border-r border-stroke-soft-200 bg-bg-white-0 px-2.5 lg:flex">
      <div className="flex h-12 shrink-0 items-center justify-center">
        <AgentMark className="h-[15px] w-auto text-text-strong-950" />
      </div>
      <div className="flex h-9 items-center justify-center rounded-lg text-text-soft-400">
        <RiSearchLine className="size-[18px]" />
      </div>
      {NAV_SECTIONS.map((section, i) => (
        <div key={section.label ?? i} className="mt-1 space-y-0.5">
          {i > 0 && <div className="mx-1.5 mb-1.5 mt-2 border-t border-stroke-soft-200" />}
          {section.entries.map(icon)}
        </div>
      ))}
    </div>
  );
}
