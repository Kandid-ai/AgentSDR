# AgentSDR call worker

Runs WhatsApp voice calls for AgentSDR's AI voice agent. A **calling station** is one WhatsApp
number whose WhatsApp Web lives in a browser profile. The worker polls AgentSDR
(`/api/call-worker/*`) for jobs, opens the station's browser with the recorder extension
(`extensions/whatsapp-recorder/dist`) loaded, and either:

- **call** — waits for WhatsApp Web to show the chats, then hands the call to the extension's
  station mode (`agentsdrStation.startCall`) and watches until AgentSDR reports it done;
- **link** — shows WhatsApp Web's login screen, tries "Log in with phone number", and reports
  the 8-character code plus a screenshot every ~8 s so the operator can link the number.

One job at a time per worker. Run several workers for more concurrency.

## Environment

| Variable | Default | |
|---|---|---|
| `AGENTSDR_URL` | required | e.g. `http://localhost:3000` |
| `CALL_WORKER_SECRET` | required | Bearer secret the app checks |
| `WORKER_ID` | hostname | shown on the station while held |
| `LAUNCHERS` | `local` | comma list of `local`, `gologin_sdk`, `gologin_cloud` |
| `EXTENSION_PATH` | repo `extensions/whatsapp-recorder/dist` | built extension |
| `PROFILES_DIR` | `~/.agentsdr-call-worker/profiles` | `local` profiles, one folder per station id |
| `HEADLESS` | `false` | `true` for new headless Chromium |
| `CLAIM_INTERVAL_MS` | `3000` | poll gap when idle |
| `CALL_TIMEOUT_MS` | 30 min | then the worker hangs up |
| `CHROMIUM_PATH` | – | Chromium executable override |

## Run locally

```sh
bun run build:recorder                      # from the repo root, builds the extension
cd services/call-worker && bun install
bunx playwright-core install chromium       # once; Playwright's bundled Chromium (needed for extensions)
AGENTSDR_URL=http://localhost:3000 CALL_WORKER_SECRET=… LAUNCHERS=local npm start
# Runs on Node (tsx), not Bun: Bun's WebSocket cannot hold Playwright's connectOverCDP,
# which the GoLogin launchers use. Bun only installs.
```

Link the number once (Settings → WhatsApp → stations → Link); the session persists in
`PROFILES_DIR/<station id>`.

## Launchers

- `local` — `chromium.launchPersistentContext` on a profile folder. Loads the extension via
  `--load-extension`, fake mic/camera devices, no background throttling.
- `gologin_cloud` — `chromium.connectOverCDP("wss://cloudbrowser.gologin.com/connect?token=…&profile=…")`.
  The extension must already be installed on the GoLogin profile (upload `dist/` as a custom
  extension in GoLogin's UI, keep it updated).
- `gologin_sdk` — the `gologin` npm package: `new GoLogin({ token, profile_id, extra_params })`,
  `await gl.start()` returns `{ wsUrl }`, then `connectOverCDP(wsUrl)`; closing calls `gl.stop()`
  (which uploads the profile back). Extension passed as `--load-extension=` in `extra_params`
  (the SDK merges it with its own extensions). Needs the Orbita browser the SDK downloads.

The GoLogin token and profile id come from the claim (organization's GoLogin integration and the
station), never from env.

## Server deployment

Build from the repo root after `bun run build:recorder`:
`docker build -f services/call-worker/Dockerfile -t agentsdr-call-worker .`
Run with `-e AGENTSDR_URL=… -e CALL_WORKER_SECRET=… -v profiles:/data`. The entrypoint starts
PulseAudio with a null sink (so WhatsApp has an audio output to tap) and runs the worker under
`xvfb-run` with `HEADLESS=false`; extensions and WhatsApp's audio are most reliable headful.
Give the container `--shm-size=1g` (or `--ipc=host`).

## GoLogin notes (tested 12 Oct 2026)

- **SDK (`gologin_sdk`)**: Orbita starts on this machine in about 5 s; the worker loads the extension
  from `EXTENSION_PATH`. Do **not** also upload the extension to that GoLogin profile, or two copies run.
- **Cloud (`gologin_cloud`)**: opens in about 17 s; the extension must be uploaded to the profile
  (Extensions → Upload custom extension, the built `dist/` folder) and re-uploaded after every change.
  GoLogin's cloud machines have no audio input; the extension supplies the agent's voice as the only
  microphone on agent calls (0.17.3+).

## CloakBrowser (`cloak`) — the default launcher (23 Oct 2026)

Stealth Chromium on the worker's own disk: `PROFILES_DIR/cloak/<station id>` holds the station's whole
state — WhatsApp Web's login (saved when the browser closes, loaded on the next open) and the
fingerprint seed CloakBrowser keeps in `.cloakbrowser-seed`, so a number shows the same device on
every call. Opens in under a second; WhatsApp Web loads headless.

- `npx cloakbrowser install` once (Docker does it at build). The free binary runs one session at a
  time, which the worker never exceeds; a Pro key goes in `CLOAKBROWSER_LICENSE_KEY`.
- `CLOAK_TIMEZONE` (default `Asia/Kolkata`) and `CLOAK_LOCALE` (default `en-US`) apply to every
  station; keep them matching the IP the calls leave from. The locale must be English — the
  extension finds WhatsApp's buttons by their English labels.
- Losing `PROFILES_DIR` logs every number out of WhatsApp Web and changes its fingerprint: back it up.
- **Check the audio before trusting it with calls: `npm run audio-check`** (in the container:
  `xvfb-run npm run audio-check`). WhatsApp makes its call audio at 16 kHz, and CloakBrowser's free
  macOS build (145) reports 48 kHz for that and runs at under a third of real time — the agent sounds
  choppy or humming and never hears the lead (23 Oct 2026; no flag fixes it, `--fingerprint=off`
  included). The Linux build is a different one (146). Every line must say `OK`; if `cloak` says
  `BAD`, use `local` on that machine.
