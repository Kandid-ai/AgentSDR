/**
 * Telling a pop-up that fell back to a full page from one that was meant to.
 *
 * Lead records and Settings open as pop-ups over the page you were on, through
 * Next's intercepting routes (src/app/@modal). That only works on a soft
 * (client-side) navigation. When the soft navigation's request fails, Next
 * gives up and loads the URL as a whole new document — the full page, not the
 * pop-up (node_modules/next/dist/client/components/router-reducer/
 * fetch-server-response.js, `doMpaNavigation`). It does so when:
 *
 * - the server's build differs from the tab's: the first in-app click in any
 *   tab opened before a deploy, and during a rolling deploy, while old and new
 *   containers both answer;
 * - the response is not a 200 flight response (an error, a 503 while a
 *   migration blocks requests, an auth redirect) or the fetch fails.
 *
 * Such a load still looks like an in-app click: a same-origin referrer that is
 * the page underneath, in a tab with history behind it. A load the person
 * meant as a full page does not: a new tab (ctrl/cmd-click) has no history, a
 * shared link or bookmark has no referrer (or another site's), a reload or
 * back/forward is not a "navigate", and "Open full page" is followed from the
 * pop-up's own URL.
 */

/** URLs that have a pop-up twin under src/app/@modal. */
const POP_UP_PATHS = [/^\/crm\/records\/[^/]+\/?$/, /^\/settings\/[^/]+\/?$/];

/** Pages a pop-up is never opened over: sign-in and the other pages outside the app. */
const NOT_UNDERNEATH = /^\/(api|sign-in|sign-up|login|forgot-password|reset-password|accept-invitation|oauth|onboarding|setup|unsubscribe|demo|downloads)(\/|$)/;

export function isPopUpPath(pathname: string): boolean {
  return POP_UP_PATHS.some((pattern) => pattern.test(pathname));
}

export type PageLoad = {
  /** location.origin */
  origin: string;
  /** location.pathname of the page that loaded */
  pathname: string;
  /** document.referrer */
  referrer: string;
  /** PerformanceNavigationTiming.type: "navigate" | "reload" | "back_forward" | "prerender" */
  navigationType: string | undefined;
  /** history.length */
  historyLength: number;
};

/**
 * The page to put back underneath (path + query) when this load is a pop-up
 * that fell back to a full page; null when the full page is what was meant.
 */
export function popUpFallbackSource(load: PageLoad): string | null {
  if (!isPopUpPath(load.pathname)) return null;
  if (load.navigationType !== "navigate") return null;
  if (load.historyLength < 2) return null;
  if (!load.referrer) return null;
  let from: URL;
  try { from = new URL(load.referrer); } catch { return null; }
  if (from.origin !== load.origin) return null;
  if (from.pathname === load.pathname) return null;
  // From inside a pop-up (its URL is the pop-up's): there is no page known to
  // put back, e.g. "Open full page", or Settings moving between its pages.
  if (isPopUpPath(from.pathname)) return null;
  if (NOT_UNDERNEATH.test(from.pathname)) return null;
  return from.pathname + from.search;
}
