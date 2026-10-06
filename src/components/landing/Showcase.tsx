"use client";

import { useEffect, type ReactNode, type SyntheticEvent } from "react";
import { cn } from "@/utils/cn";

/**
 * A live product component on a public page: the real thing, fed sample
 * data, that visitors can hover and poke but that can't leave the page or
 * write anything.
 *
 * It lets through what only changes the component's own state — tabs,
 * segmented controls, the chart/table toggle, KPI switchers — and swallows
 * everything else in the capture phase: links (the app's routes need a
 * session), row clicks, menus and the Send / Accept buttons (their API calls
 * would only 401 for a signed-out visitor). Hover tooltips and chart
 * tooltips keep working. Events from Radix portals (tooltips, menus) reach
 * this handler too, since React events follow the component tree.
 *
 * Some behaviour starts without a click (a row warms its record page when
 * the pointer rests on it). While any showcase is mounted, same-origin
 * /api/ requests are answered locally with a 403, so a preview never reaches
 * the real API.
 */

const INTERACTIVE = "a, button, [role='button'], [role='menuitem'], [role='option'], [role='combobox'], input, textarea, select, tr[tabindex], article[tabindex], [data-inbox-row]";
const ALLOWED = "[role='tab'], [aria-pressed], [data-showcase-allow]";

function guard(event: SyntheticEvent) {
  const target = event.target as HTMLElement | null;
  if (!target?.closest) return;
  const hit = target.closest(INTERACTIVE);
  if (!hit || hit.closest(ALLOWED) === hit || target.closest(ALLOWED)) return;
  event.preventDefault();
  event.stopPropagation();
}

function guardKeys(event: React.KeyboardEvent) {
  if (event.key === "Enter" || event.key === " ") guard(event);
}

let sandboxes = 0;
let realFetch: typeof fetch | null = null;

function useApiSandbox() {
  useEffect(() => {
    if (sandboxes++ === 0) {
      const inner = window.fetch;
      realFetch = inner;
      const sandboxed = (input: RequestInfo | URL, init?: RequestInit) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, window.location.href);
        if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
          return Promise.resolve(new Response(JSON.stringify({ error: "This is a preview with sample data." }), { status: 403, headers: { "content-type": "application/json" } }));
        }
        return inner.call(window, input, init);
      };
      window.fetch = sandboxed as typeof fetch;
    }
    return () => {
      if (--sandboxes === 0 && realFetch) {
        window.fetch = realFetch;
        realFetch = null;
      }
    };
  }, []);
}

export function Showcase({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  useApiSandbox();
  return (
    <div
      role="group"
      aria-roledescription="product preview"
      aria-label={label}
      className={cn("[&_a]:cursor-default [&_tr]:cursor-default", className)}
      onClickCapture={guard}
      onPointerDownCapture={guard}
      onMouseDownCapture={guard}
      onKeyDownCapture={guardKeys}
      onSubmitCapture={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}
