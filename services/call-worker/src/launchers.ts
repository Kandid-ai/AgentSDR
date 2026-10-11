import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import type { WorkerStation } from "../../../src/lib/calls/stationContract";
import { config } from "./config";

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

export async function openStationBrowser(station: WorkerStation): Promise<StationBrowser> {
  switch (station.launcher) {
    case "local":
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

async function openGologinCloud(station: WorkerStation): Promise<StationBrowser> {
  if (!station.gologinToken) throw new Error(`Station ${station.name}: the organization has no GoLogin API token`);
  if (!station.gologinProfileId) throw new Error(`Station ${station.name}: no GoLogin profile id`);
  const url = `wss://cloudbrowser.gologin.com/connect?token=${encodeURIComponent(station.gologinToken)}&profile=${encodeURIComponent(station.gologinProfileId)}`;
  const browser = await chromium.connectOverCDP(url);
  const context = browser.contexts()[0];
  if (!context) {
    await browser.close().catch(() => {});
    throw new Error("GoLogin cloud browser opened without a browser context");
  }
  await context.grantPermissions(["microphone"], { origin: "https://web.whatsapp.com" }).catch(() => {});
  return { context, close: () => browser.close() };
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
