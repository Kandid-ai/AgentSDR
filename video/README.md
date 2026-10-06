# AgentSDR launch film

A 51-second launch film made with [Remotion](https://www.remotion.dev): the
open-source AI SDR, told in the app's own components on fictional sample data.

| Scene | File |
|---|---|
| Logo — Shade and AgentSDR (the first frame, so a paused video shows it) | `src/film/logo.tsx` |
| Hook — "This open-source agent will replace your entire sales stack": a cursor closes the tool tabs, AgentSDR is left | `src/film/scenes1.tsx` |
| Meet — "Open-source AI SDR", real screens blurred around it | `src/film/scenes1.tsx` |
| ICP — the brief typed in, Find leads | `src/film/scenes1.tsx` |
| Tables — "Clay enrichment, built into AgentSDR": leads land, Apollo picked, columns fill | `src/film/tables.tsx` |
| Everything — the live Analytics overview counting up | `src/film/overview.tsx` |
| Three channels — Gmail, LinkedIn, WhatsApp merge into Shade | `src/film/channels.tsx` |
| Channel tour — email, LinkedIn, WhatsApp in fast cuts | `src/film/channels.tsx`, `ui.tsx` |
| "And when they reply" — the arrow | `src/film/scenes2.tsx` |
| CRM — replies classified, drafts sent in one click, the pipeline | `src/film/crm.tsx`, `crmUi.tsx` |
| End card — github.com/Kandid-ai/AgentSDR | `src/film/scenes3.tsx` |

`src/film/Film.tsx` holds the scene order, the score and every sound effect.

## Render

```
cd video
bun install
bun run studio     # preview and scrub in the browser
bun run preview    # quick check: out/preview.mp4, 960×540, fast encode
bun run render     # final: out/final/agentsdr-launch-4k.mp4, 3840×2160, 30 fps
```

The final render draws every frame at 2× (the UI is real DOM, so it is sharp
at 4K), as lossless PNG frames, encoded at CRF 12; `tools/finalize.ts` then
trims the audio to the picture's exact length (Remotion's AAC runs a few ms
long, and players show black for that sliver at the end). `tools/stills.ts` renders
chosen frames for review (`bun run tools/stills.ts out/stills 120 480`;
`SCALE=1` for full size).

## Product Hunt assets

`src/ph/` builds the launch gallery from the same components as the film:
fourteen 1270 × 760 images (one idea and one headline each, in story order:
hero, one tab instead of six, channels, find, enrich, email, LinkedIn,
WhatsApp, AI replies, one-click send, pipeline, analytics, self-hosting, the
GitHub call to action) and the 240 × 240 thumbnail, still and animated.

```
bun run ph          # → out/product-hunt/{gallery, gallery@2x, thumbnail.png, thumbnail.gif}
bun run ph enrich   # just the images whose id matches
```

The first image is the one Product Hunt uses as the share card everywhere,
so keep it the hero.

## Real screens on sample data

`src/screens/` renders the app's own page components, unchanged, inside the
app shell (`Shell.tsx`: browser window + the real sidebar). Pages that load
their own data get it from `mock.ts`, a `fetch` override that answers
`/api/*` with sample data. Only the screens the film shows are kept:

- `leads/` — Leads, a workbook, and the workbook's three states in the Tables
  scene (raw, the enrichment catalog, enriched)
- `outreach/` — an email campaign, LinkedIn messages
- `crm/` — Action required, Pipeline

Their images live in `public/shots/` (Meet's background cards) and
`public/shots/screens/` (Tables). Regenerate after an app change with
`bun run tools/shots.ts workbook-raw workbook-enrich-catalog workbook-enriched`.
The analytics overview, the CRM and the channel cards are not images: they
render live from the app's components every frame.

All people, companies and numbers on screen are fictional; the contact faces
(`public/faces/`, `tools/faces.ts`) are generated, not real people.

## Sound

- **Score** — `public/music.wav`, cut from `public/score-v1.mp3` (Google
  Lyria 3 Pro through OpenRouter, `tools/music.ts`; prompt on stdin, reads
  `OPENROUTER_API_KEY` from the app's `.env.local`). Both are gitignored.
  `tools/align-music.ts` fits the raw track to the film: it finds the tempo,
  the beat grid and the drop, and cuts so the drop lands at music time
  32.0 s — the "And when they reply" arrow (the score starts at frame 28).
  The breakdown before the drop is shortened only inside its quiet pad, so
  the groove eases off under Three channels and the riser builds unbroken
  through the channel tour:

  ```
  bun run tools/align-music.ts public/score-v1.mp3 public/music.wav 126 --breakdown=6:4
  ```

  Changing the length of any scene before the arrow moves the drop off its
  mark: update `DROP_AT` and `LENGTH` at the top of the tool and re-run it.
  The film plays `public/music.wav`, or the file named by the `music` input
  prop (`--props='{"music":"none"}'` renders effects only).
- **Effects** — `public/sfx/` (click, tick, typing, pop, chime, success,
  whoosh, swipe), synthesized by `bun run tools/sfx.ts`, placed scene by
  scene in `Film.tsx` well under the score (the effects-only mix measures
  about −29 LUFS against the score's −14).

## Conventions

- Every animation is a function of the frame; no CSS transitions or timers.
  A component that calls `useCurrentFrame()` reads its scene's clock, so pass
  it times on that clock.
- `src/kit/motion.ts` — frame maths; `src/film/kit.tsx` — canvas, type, hand
  cursor; `src/webpack.ts` — points the bundler at the app (`@/` → `../src`).
- `src/video.css` loads before `src/style.css` (the app's globals) so the
  app's own responsive utilities win.
