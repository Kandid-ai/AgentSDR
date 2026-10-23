import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import type { WorkerStation } from "../../../src/lib/calls/stationContract";
import { config } from "./config";
import { resetProfile, restoreProfile, saveProfile } from "./profiles";
import { startProxyRelay } from "./proxyRelay";

export type StationBrowser = { context: BrowserContext; close(): Promise<void> };

/**
 * A plain desktop Chrome user agent for the bundled Chromium. Headless
 * Chromium says "HeadlessChrome", and WhatsApp Web answers that with its
 * "works with Google Chrome 100+" page instead of loading (seen 11 Oct 2026).
 */
function desktopUserAgent(): string {
  let version = "140.0.0.0";
  try {
    const browsers = JSON.parse(readFileSync(createRequire(import.meta.url).resolve("playwright-core/browsers.json"), "utf8")) as {
      browsers: { name: string; browserVersion?: string }[];
    };
    const major = browsers.browsers.find((b) => b.name === "chromium")?.browserVersion?.split(".")[0];
    if (major) version = `${major}.0.0.0`;
  } catch {
    // Keep the fallback version; any recent one passes WhatsApp's check.
  }
  const platform =
    process.platform === "darwin"
      ? "Macintosh; Intel Mac OS X 10_15_7"
      : process.platform === "win32"
        ? "Windows NT 10.0; Win64; x64"
        : "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

/** Flags shared by every launcher: fake media devices and no background throttling. */
export function chromiumArgs(extensionPath: string): string[] {
  return [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-blink-features=AutomationControlled",
    "--lang=en-US",
  ];
}

const CLOUD_START_ATTEMPTS = 3;

/** An error's first line — Playwright appends its whole call log to the message. */
export function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0]!.slice(0, 300);
}

/** `fresh`: open logged out, discarding the session the profile holds (see WorkerJob "link"). */
export async function openStationBrowser(station: WorkerStation, options: { fresh?: boolean } = {}): Promise<StationBrowser> {
  switch (station.launcher) {
    case "cloak":
      return openCloak(station, options.fresh === true);
    case "local":
      if (options.fresh) await rm(join(config().profilesDir, station.id), { recursive: true, force: true });
      return openLocal(station);
    case "gologin_cloud":
      return openGologinCloud(station);
    case "gologin_sdk":
      return openGologinSdk(station);
    default:
      throw new Error(`Unknown launcher "${String(station.launcher)}" for station ${station.name}`);
  }
}

async function openLocal(station: WorkerStation): Promise<StationBrowser> {
  const cfg = config();
  const ignoreDefaultArgs = ["--enable-automation", "--disable-extensions"];
  if (!cfg.headless) ignoreDefaultArgs.push("--mute-audio");
  const context = await chromium.launchPersistentContext(join(cfg.profilesDir, station.id), {
    headless: cfg.headless,
    // The default headless shell cannot load extensions; "chromium" is the full build in new headless mode.
    channel: cfg.chromiumPath ? undefined : "chromium",
    viewport: cfg.headless ? { width: 1280, height: 900 } : null,
    userAgent: desktopUserAgent(),
    executablePath: cfg.chromiumPath,
    args: chromiumArgs(cfg.extensionPath),
    ignoreDefaultArgs,
    permissions: ["microphone"],
  });
  await context.grantPermissions(["microphone"], { origin: "https://web.whatsapp.com" });
  return { context, close: () => context.close() };
}

/**
 * CloakBrowser — stealth Chromium with C++-level fingerprint patches — on the
 * worker's own disk, one profile folder per station. The folder is the
 * station's whole state: WhatsApp Web's login, cookies and storage are saved
 * when the browser closes and loaded on the next open, and CloakBrowser keeps
 * the profile's fingerprint seed in it (`.cloakbrowser-seed`), so a number
 * shows the same device on every call. Measured 23 Oct 2026: opens in under
 * a second, WhatsApp Web loads headless, same seed and canvas across launches.
 *
 * The free binary runs one session at a time (a Pro key, in
 * CLOAKBROWSER_LICENSE_KEY, lifts that); the worker runs one job at a time.
 */
async function openCloak(station: WorkerStation, fresh: boolean): Promise<StationBrowser> {
  const cfg = config();
  const dir = join(cfg.profilesDir, "cloak", station.id);
  // The browser reaches the number's proxy through a local, password-free
  // relay: neither SOCKS5 nor Playwright's HTTP proxy auth works with the
  // proxies we buy (see proxyRelay.ts).
  const relay = station.proxy ? await startProxyRelay(station.proxy) : null;
  if (relay) {
    // Fail with the proxy's own reason now, not a browser error later.
    await relay.check().catch(async (error: unknown) => {
      await relay.close();
      throw new Error(`This number's IP doesn't work: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  // The saved profile and the number's fingerprint seed, from AgentSDR — or,
  // for a fresh link, only the seed.
  if (fresh) await resetProfile(station, dir);
  else await restoreProfile(station, dir);
  const { launchPersistentContext } = await import("cloakbrowser");
  const context = await launchPersistentContext({
    userDataDir: dir,
    headless: cfg.headless,
    extensionPaths: [cfg.extensionPath],
    locale: cfg.cloakLocale,
    // The browser's clock follows the number's IP when it has one.
    timezone: station.proxy?.timezone ?? cfg.cloakTimezone,
    ...(relay ? { proxy: { server: relay.server } } : {}),
    // Media and throttling flags only: CloakBrowser supplies its own stealth
    // and extension flags, and our user agent and automation tweaks would
    // contradict its fingerprint.
    args: [
      ...chromiumArgs(cfg.extensionPath).filter(
        (arg) =>
          !arg.startsWith("--load-extension") &&
          !arg.startsWith("--disable-extensions-except") &&
          !arg.startsWith("--lang=") &&
          !arg.startsWith("--disable-blink-features"),
      ),
      // With an IP assigned, nothing may leave around it: WebRTC would
      // otherwise send UDP straight from this machine, showing its real IP.
      ...(relay ? ["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] : []),
    ],
  }).catch(async (error: unknown) => {
    await relay?.close();
    throw error;
  });
  await context.grantPermissions(["microphone"], { origin: "https://web.whatsapp.com" }).catch(() => {});
  return {
    context,
    close: async () => {
      await context.close();
      await relay?.close();
      // Only once closed: the profile is consistent on disk then.
      await saveProfile(station, dir);
    },
  };
}

async function openGologinCloud(station: WorkerStation): Promise<StationBrowser> {
  if (!station.gologinToken) throw new Error(`Station ${station.name}: the organization has no GoLogin API token`);
  if (!station.gologinProfileId) throw new Error(`Station ${station.name}: no GoLogin profile id`);
  const url = `wss://cloudbrowser.gologin.com/connect?token=${encodeURIComponent(station.gologinToken)}&profile=${encodeURIComponent(station.gologinProfileId)}`;
  const token = station.gologinToken;
  const profileId = station.gologinProfileId;
  // Disconnecting does not stop a cloud profile: GoLogin keeps it running
  // (and billing hours) until it idles out, seen still "running" after a
  // job on 12 Oct 2026. So every close also stops it through the API.
  const stop = async () => {
    const response = await fetch(`https://api.gologin.com/browser/${encodeURIComponent(profileId)}/web`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch((error: unknown) => {
      throw new Error(`could not stop the GoLogin cloud profile: ${String(error)}`);
    });
    if (!response.ok && response.status !== 404) throw new Error(`GoLogin refused to stop the cloud profile (HTTP ${response.status})`);
  };
  // GoLogin answers "503 Failed to start browser" while a profile is still
  // stopping from its last session (seen 12 Oct 2026, seconds after a stop);
  // it starts on a retry a few seconds later.
  let browser: Browser | null = null;
  for (let attempt = 1; !browser; attempt++) {
    try {
      browser = await chromium.connectOverCDP(url);
    } catch (error) {
      const busy = /\b503\b|failed to start browser/i.test(String(error));
      if (!busy || attempt >= CLOUD_START_ATTEMPTS) {
        await stop().catch(() => {});
        throw new Error(busy ? "GoLogin's cloud could not start this profile's browser (503) — try again in a minute" : firstLine(error));
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    }
  }
  const connected = browser;
  const context = connected.contexts()[0];
  if (!context) {
    await connected.close().catch(() => {});
    await stop().catch(() => {});
    throw new Error("GoLogin cloud browser opened without a browser context");
  }
  await context.grantPermissions(["microphone"], { origin: "https://web.whatsapp.com" }).catch(() => {});
  return {
    context,
    close: async () => {
      await connected.close().catch(() => {});
      await stop();
    },
  };
}

async function openGologinSdk(station: WorkerStation): Promise<StationBrowser> {
  if (!station.gologinToken) throw new Error(`Station ${station.name}: the organization has no GoLogin API token`);
  if (!station.gologinProfileId) throw new Error(`Station ${station.name}: no GoLogin profile id`);
  const cfg = config();
  // Dynamic import so the local launcher works without the gologin package loaded.
  const { GoLogin } = await import("gologin");
  const extra = chromiumArgs(cfg.extensionPath).filter((a) => !a.startsWith("--lang=") && !a.startsWith("--disable-extensions-except="));
  if (cfg.headless) extra.push("--headless=new");
  const gl = new GoLogin({
    token: station.gologinToken,
    profile_id: station.gologinProfileId,
    // GoLogin merges a "--load-extension=" entry in extra_params with the extensions it installs itself.
    extra_params: extra,
    executablePath: cfg.chromiumPath,
  });
  let browser: Browser | null = null;
  try {
    const { wsUrl } = await gl.start();
    if (!wsUrl) throw new Error("GoLogin started the profile but gave no websocket URL");
    browser = await chromium.connectOverCDP(wsUrl);
    const context = browser.contexts()[0];
    if (!context) throw new Error("GoLogin browser has no browser context");
    await context.grantPermissions(["microphone"], { origin: "https://web.whatsapp.com" }).catch(() => {});
    const b = browser;
    return {
      context,
      close: async () => {
        await b.close().catch(() => {});
        await gl.stop();
      },
    };
  } catch (err) {
    await browser?.close().catch(() => {});
    await gl.stop().catch(() => {});
    throw err;
  }
}
