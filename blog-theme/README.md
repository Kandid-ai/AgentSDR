# AgentSDR Ghost theme

The blog at `agentsdr.ai/blog` is Ghost, installed at the subpath `/blog` (Ghost
`url` = `https://agentsdr.ai/blog`) and proxied by the Next.js rewrites to
`https://blog.agentsdr.ai/blog/`. This folder is the custom theme. Ghost keeps
emitting the SEO tags, sitemaps, RSS and pagination; only the templates change.

It is not part of the Next.js app: nothing in `src/` imports it. Only
`src/main.ts` and `build.ts` are TypeScript and are covered by `npx tsc --noEmit`.

## Design

The look mirrors the marketing site (`src/components/landing/landing.module.css`,
`src/components/marketing/marketing.module.css`, `blocks.tsx`):

| Token | Value | Used for |
| --- | --- | --- |
| `--accent` | `#335cff` (hover `#3f66ff`) | Links, primary buttons, active states |
| `--ink` | `#141414` | Headings |
| `--body` / `--grey` / `--muted` | `#3d3d3d` / `#656565` / `#8a8a8a` | Prose, secondary, tertiary text |
| `--card` | `#f7f7f8` | Post cards, TOC, author card |
| `--hair` | `rgb(0 0 0 / .06)` | Hairlines |
| `--sky` | dark indigo, blue, white | Hero bands (`.sky`, same stops as `skyCompact`) |
| radii | 28px cards, 16px small, 999px pills | |

Faces: Geist 500 (display, `-0.03em`), Geist Mono (eyebrows, uppercase), Inter
(body), from Google Fonts. They read `var(--gh-font-heading)` / `--gh-font-body`,
so Ghost's Design, Typography picker still works.

Motifs: sky hero band with aurora and blueprint grid and `skytext` headings;
a dark glass nav pill that turns white once scrolled; a mega-menu with the same
groups, labels and blurbs as `catalog.ts` NAV; grey cards that lift on hover; a
sticky post rail (contents plus a dark sky card); a closing CTA card like
`ClosingCta`. Motion is rise-in on load and hover lifts, all off under
`prefers-reduced-motion`.

## Templates

| Template | Renders |
| --- | --- |
| `index.hbs` | Sky hero, lead story (page one only), sidebar plus 2-column grid |
| `tag.hbs` / `author.hbs` | Sky hero, then the same sidebar and grid |
| `post.hbs` | Sky header, feature image, article with sticky rail, related posts |
| `page.hbs` | Static pages; respects `@page.show_title_and_feature_image` |
| `error-404.hbs` / `error.hbs` | Error states |

Partials: `site-header` (uses `nav-menu`), `site-footer` (uses `footer-cols`),
`hero-post`, `post-card`, `pagination`, `sidebar`, `cta`, `rail-cta`,
`feature-image`, and `icons/`. `nav-menu.hbs` and `footer-cols.hbs` were
generated from `src/components/marketing/catalog.ts`; when the site's menus
change, edit them by hand (all URLs are `{{@custom.site_root_url}}`-prefixed
except GitHub and docs).

## Behaviour that needs explaining

- **Numbered pagination.** `partials/pagination.hbs` renders real Previous/Next
  links; `src/main.ts` builds the number row from `data-page` / `data-pages`,
  deriving URLs from `location.pathname` (works under `/blog/`).
- **Category active state** is resolved in `main.ts` from the path.
- **Contents list** is built in `main.ts` from the article's `h2`s (hidden below
  three) with a scroll-spy.
- **Header** is CSS-driven (hover, `:has(:focus-visible)`); `main.ts` adds the
  scrolled state, click toggles for touch and the phone menu.
- **`{{#get "tags" limit="50"}}`**: gscan rejects `limit="all"`. Raise it past 50
  public tags.

## Assets must stay under `assets/built/`

The production rewrite sends `/blog/assets/:path*` to Ghost's admin asset path,
so only `/blog/assets/built/:path*` reaches theme assets. Everything the theme
loads (`screen.css`, `main.js`, `images/logo.svg`) lives there and is referenced
with `{{asset "built/..."}}`. An asset anywhere else under `assets/` works on a
local Ghost and 404s in production.

## Build

```bash
bun run build:blog-theme    # from the repo root
```

`build.ts` bundles `src/main.ts` into `assets/built/main.js` (minified, browser
target; git-ignored) and writes `dist/agentsdr-theme.zip` (git-ignored)
excluding `src/`, `build.ts`, `dist/`, `README.md`, `node_modules/`.

## Validate

```bash
npx gscan -z blog-theme/dist/agentsdr-theme.zip    # must report no errors
```

## Install

1. `https://agentsdr.ai/blog/ghost/` -> **Settings -> Design & branding -> Change theme -> Upload theme**.
   Ghost uses the zip's file name as the theme id; upload a uniquely named copy
   (for example `agentsdr-2026-10.zip`) to keep the previous theme for rollback.
2. **Activate**.
3. Check **Design -> Typography** uses the theme default, and Site-wide copy
   (custom settings are stored per theme id, so a new id starts at the defaults).
4. Check `/blog/`, a post, `/blog/tag/<slug>/`, `/blog/page/2/`, `/blog/rss/`,
   `/blog/sitemap.xml`, and that `/blog/assets/built/screen.css` returns CSS.

The header navigation is hard-coded in the partials; Ghost's Navigation setting
is not used.

## Custom settings (Design -> Site-wide)

Closing CTA band: `cta_heading`, `cta_subheading`, `cta_button_text`,
`cta_button_url`, `cta_secondary_text`, `cta_secondary_url`. Marketing root:
`site_root_url` (prefix of every nav and footer link). Post rail card:
`rail_heading`, `rail_text`, `rail_button_text`, `rail_stat`, `rail_stat_label`;
its buttons reuse the CTA URLs.

`rail_stat` ships blank on purpose. Put a real, defensible figure in it and the
stat block appears; leave it empty and the card renders without one. Keep
numerical claims out of the defaults unless they are supported.

## Local testing

Install Ghost locally (`ghost install local`, Node 22) with
`url` = `http://localhost:2368/blog/`, symlink this folder into
`content/themes/agentsdr`, and activate it.
