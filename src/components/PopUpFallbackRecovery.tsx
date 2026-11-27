"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { popUpFallbackSource } from "@/lib/navigation/popUpFallback";

const ATTEMPT_KEY = "agentsdr:pop-up-recovery";
/** One attempt per URL in this window, so a pop-up that keeps failing settles on its full page. */
const ATTEMPT_WINDOW_MS = 30_000;

/**
 * A lead record or Settings page that loaded as a full page only because its
 * pop-up's navigation failed (a deploy since the tab opened, an error) is put
 * back the way it was asked for: the page underneath returns, and the pop-up
 * opens over it. See src/lib/navigation/popUpFallback.ts for when that is.
 *
 * Mounted once in the root layout, which outlives both steps: the first
 * replaces the full page with the page underneath (now on this build, so
 * interception works), the second opens the pop-up once that has rendered.
 */
export function PopUpFallbackRecovery() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<{ underneathPath: string; target: string } | null>(null);

  useEffect(() => {
    let navigationType: string | undefined;
    try { navigationType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type; }
    catch { navigationType = undefined; }
    const from = popUpFallbackSource({
      origin: window.location.origin,
      pathname: window.location.pathname,
      referrer: document.referrer,
      navigationType,
      historyLength: window.history.length,
    });
    if (!from) return;
    const target = window.location.pathname + window.location.search + window.location.hash;
    // Without a record of the attempt a pop-up that always fails would bounce
    // forever, so no storage means no attempt.
    try {
      const last = JSON.parse(window.sessionStorage.getItem(ATTEMPT_KEY) ?? "null") as { target?: string; at?: number } | null;
      if (last?.target === target && Date.now() - Number(last.at) < ATTEMPT_WINDOW_MS) return;
      window.sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ target, at: Date.now() }));
    } catch {
      return;
    }
    pending.current = { underneathPath: new URL(from, window.location.origin).pathname, target };
    router.replace(from, { scroll: false });
  }, [router]);

  useEffect(() => {
    const step = pending.current;
    if (!step || pathname !== step.underneathPath) return;
    pending.current = null;
    router.push(step.target, { scroll: false });
  }, [pathname, router]);

  return null;
}
