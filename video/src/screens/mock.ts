import { continueRender, delayRender } from "remotion";

/**
 * A mock of the app's API for the film. Real screens that load their own data
 * (`fetch("/api/...")` in an effect) render unchanged: each route answers
 * with sample data, and every request holds the frame (delayRender) until the
 * response has been read and React has painted it, so no frame is captured
 * half-loaded.
 *
 * Screens register their routes with `mockRoutes([...])` at module load; when
 * several match, the most specific wins (exact path, then longest prefix).
 * Anything unmatched under /api answers `{}` (and logs it), never the network.
 */

export type Route = {
  /** A path prefix (matched against pathname) or a RegExp tested against pathname + search. */
  match: string | RegExp;
  method?: string;
  respond: (url: URL, init?: RequestInit) => unknown;
};

const routes: Route[] = [];
let installed = false;

export function mockRoutes(list: Route[]) {
  routes.push(...list);
  install();
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, "http://agentsdr.local");
    if (!url.pathname.startsWith("/api/")) return real(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    // The most specific route wins: an exact path, then the longest prefix; a RegExp ranks by its source length.
    const score = (r: Route) => {
      if ((r.method ?? "GET").toUpperCase() !== method) return -1;
      if (typeof r.match !== "string") return r.match.test(url.pathname + url.search) ? r.match.source.length : -1;
      if (url.pathname === r.match) return 10_000;
      return url.pathname.startsWith(r.match.endsWith("/") ? r.match : `${r.match}/`) ? r.match.length : -1;
    };
    const route = routes.reduce<Route | undefined>((best, r) => (score(r) > (best ? score(best) : -1) ? r : best), undefined);
    if (!route) console.warn(`[mock] unmatched ${method} ${url.pathname}${url.search}`);
    const body = route ? route.respond(url, init) : {};
    const handle = delayRender(`mock ${method} ${url.pathname}`);
    // Release the frame once the caller has read the body and React has had time to paint.
    setTimeout(() => continueRender(handle), 120);
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
