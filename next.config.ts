import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",

  // package.json's version, inlined into client code for the Help menu's bug-report link.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },

  // The formula sandbox reads these library sources off disk at runtime and
  // evaluates them inside the QuickJS isolate (src/lib/grid/runners/sandbox.ts).
  // A readFileSync path is invisible to Next's module tracer, so without this
  // they are missing from the standalone output and every formula fails with
  // "_ is not defined" in production but works in dev.
  outputFileTracingIncludes: {
    "/api/grid/**": [
      "./node_modules/lodash/lodash.min.js",
      "./node_modules/moment/min/moment.min.js",
      "./node_modules/@formulajs/formulajs/lib/browser/formula.min.js",
    ],
    // The Call Recorder zip, built by `bun run build` and read off disk by the download route.
    "/downloads/call-recorder": ["./extensions/whatsapp-recorder/release/agentsdr-call-recorder.zip"],
    // The marketing changelog page renders CHANGELOG.md, read off disk.
    "/changelog": ["./CHANGELOG.md"],
  },

  // Ghost (the blog, proxied below) 301s its admin to the trailing-slash URL,
  // and Next's own trailing-slash normalisation strips it straight back off:
  // the two bounce until the browser gives up. So Next leaves slashes alone,
  // and src/proxy.ts strips them itself everywhere except /blog.
  skipTrailingSlashRedirect: true,

  // The blog is Ghost installed at the subpath agentsdr.ai/blog, so its posts
  // build authority for agentsdr.ai instead of a subdomain. These rewrites
  // proxy /blog/* to the Ghost origin (infra/ghost/README.md). Ghost's `url`
  // must be https://agentsdr.ai/blog or it emits the origin's canonicals.
  // GHOST_ORIGIN must never be a hostname that redirects back here: that loops.
  // Read at build time.
  async rewrites() {
    const ghostOrigin = (process.env.GHOST_ORIGIN ?? "https://blog.agentsdr.ai").replace(/\/$/, "");
    return [
      { source: "/blog", destination: `${ghostOrigin}/blog/` },
      // Admin: Ghost serves it at /blog/ghost/ and 301s the bare form, so the
      // slash has to survive the hop or the two redirect at each other.
      { source: "/blog/ghost", destination: `${ghostOrigin}/blog/ghost/` },
      // Admin files keep their exact path.
      { source: "/blog/ghost/:path*.:ext", destination: `${ghostOrigin}/blog/ghost/:path*.:ext` },
      // Every other admin route (the app shell and its API) wants the slash back.
      { source: "/blog/ghost/:path*", destination: `${ghostOrigin}/blog/ghost/:path*/` },
      // The theme's own CSS/JS live under /blog/assets/built/. Matched before
      // the admin shim below, which would otherwise send them to the admin
      // asset path and serve the blog unstyled. Theme assets must stay in built/.
      { source: "/blog/assets/built/:path*", destination: `${ghostOrigin}/blog/assets/built/:path*` },
      // Ghost admin loads its assets by relative path ("./assets/…"), which the
      // browser resolves to /blog/assets/* once the slash is gone. Map those
      // back onto the real admin assets, or admin renders blank.
      { source: "/blog/assets/:path*", destination: `${ghostOrigin}/blog/ghost/assets/:path*` },
      // Files (sitemap.xml, content/images/*, rss) keep their exact path:
      // anything with a dot is a file, and a trailing slash would 404 it.
      { source: "/blog/:path*.:ext", destination: `${ghostOrigin}/blog/:path*.:ext` },
      // Ghost's pages end in a slash and 404 without one; put it back.
      { source: "/blog/:path*", destination: `${ghostOrigin}/blog/:path*/` },
    ];
  },

  async redirects() {
    // The enrichment grid moved from /grid to /tables, to match what the
    // sidebar has always called it. Existing bookmarks and already-open tabs
    // still point at the old path. Deliberately NOT permanent: a 308 is
    // cached by the browser indefinitely, which would be painful to undo,
    // and there is no SEO to preserve on an authenticated internal tool.
    // Query strings (?folder=, ?table=) are carried over automatically.
    return [
      { source: "/grid", destination: "/tables", permanent: false },
      { source: "/grid/:path*", destination: "/tables/:path*", permanent: false },

      // Settings screens moved into the settings box (src/app/settings). The
      // LinkedIn one matters beyond bookmarks: a Unipile hosted-auth flow
      // started before the move returns to /linkedin/accounts?unipile=…, and
      // the query string is carried over to the page that handles it.
      { source: "/crm/settings", destination: "/settings/lead-categories", permanent: false },
      { source: "/crm/knowledge", destination: "/settings/knowledge", permanent: false },
      { source: "/outreach/mailboxes", destination: "/settings/email-accounts", permanent: false },
      { source: "/linkedin/accounts", destination: "/settings/linkedin-accounts", permanent: false },
      { source: "/calling/accounts", destination: "/settings/whatsapp-accounts", permanent: false },
      // Integrations moved into each channel's own Connection page.
      { source: "/settings/integrations", destination: "/settings/email-connection", permanent: false },

      // People and Companies are the two tabs of Leads.
      { source: "/people", destination: "/leads", permanent: false },
      { source: "/companies", destination: "/leads?tab=companies", permanent: false },
    ];
  },
};

export default nextConfig;
