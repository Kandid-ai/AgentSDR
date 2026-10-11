import type { BrowserContext, Page } from "playwright-core";

const WA_URL = "https://web.whatsapp.com/";

export type WhatsAppState = "ready" | "logged_out" | "timeout";

export async function openWhatsApp(context: BrowserContext): Promise<Page> {
  const existing = context.pages().find((p) => p.url().startsWith(WA_URL));
  const page = existing ?? context.pages().find((p) => p.url() === "about:blank" || p.url() === "chrome://newtab/") ?? (await context.newPage());
  await page.goto(WA_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  return page;
}

const READY_SELECTOR = '#pane-side, [aria-label="Chat list"], #side div[role="grid"]';
const LOGIN_SELECTOR = "canvas[aria-label]";
const LOGIN_TEXT = /log in with phone number|link with phone number|steps to log in|scan the qr code/i;

async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

export async function waitForWhatsAppState(page: Page, timeoutMs: number): Promise<WhatsAppState> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isVisible(page, READY_SELECTOR)) return "ready";
    if (await isVisible(page, LOGIN_SELECTOR)) return "logged_out";
    const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    if (LOGIN_TEXT.test(text)) return "logged_out";
    await page.waitForTimeout(1000).catch(() => {});
  }
  return "timeout";
}

/** Waits up to `timeoutMs` for the chat list — WhatsApp Web logged in and loaded. */
export async function waitForReady(page: Page, timeoutMs: number): Promise<boolean> {
  return page
    .locator(READY_SELECTOR)
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
}

const CODE_RE = /\b[A-Z0-9]{4}-?[A-Z0-9]{4}\b/;

async function readLinkCode(page: Page): Promise<string | null> {
  try {
    const attr = await page.locator("[data-link-code]").first().getAttribute("data-link-code", { timeout: 1500 });
    if (attr) {
      const code = attr.split(",").map((c) => c.trim()).join("");
      if (code.length >= 8) return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
    }
  } catch {
    /* fall through */
  }
  try {
    const chars = await page.evaluate(() => {
      const el = document.querySelector("[data-link-code]");
      if (!el) return "";
      return Array.from(el.children).map((c) => (c.textContent ?? "").trim()).join("");
    });
    if (chars.length === 8) return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  } catch {
    /* fall through */
  }
  try {
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    // Uppercase-only words with a digit or letter mix; ignore plain words like "WHATSAPP".
    for (const m of text.matchAll(new RegExp(CODE_RE, "g"))) {
      const c = m[0];
      if (/-/.test(c) || /\d/.test(c)) return c.includes("-") ? c : `${c.slice(0, 4)}-${c.slice(4)}`;
    }
    const spaced = text.split(/\s+/).filter((t) => /^[A-Z0-9]$/.test(t));
    if (spaced.length >= 8) return `${spaced.slice(0, 4).join("")}-${spaced.slice(4, 8).join("")}`;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Drives WhatsApp Web's "Log in with phone number" flow; returns the 8-character
 * code, or null. Never throws — the screenshot shows the operator what happened.
 *
 * As seen 11 Oct 2026: the login card shows a QR first, and the "Log in with
 * phone number" link appears beside it once the QR has loaded. The next screen
 * has a country picker, one text field labelled "Type your phone number to log
 * in to WhatsApp" (pre-filled "+91 "), and Next.
 */
export async function startPhoneNumberLogin(page: Page, phoneE164: string): Promise<string | null> {
  try {
    await page.locator(LOGIN_SELECTOR).first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    await page.getByText(/log in with phone number|link with phone number/i).filter({ visible: true }).first().click({ timeout: 15_000 });
    const input = page.locator('input[aria-label*="phone number" i], input[type="tel"]').filter({ visible: true }).first();
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(phoneE164.startsWith("+") ? phoneE164 : `+${phoneE164}`);
    await page.waitForTimeout(500);
    const next = page.getByRole("button", { name: /^next$/i }).filter({ visible: true }).first();
    if (await next.isVisible().catch(() => false)) await next.click();
    else await input.press("Enter");
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      const code = await readLinkCode(page);
      if (code) return code;
    }
  } catch {
    /* defensive: the screenshot still shows what happened */
  }
  return null;
}

export async function screenshotDataUrl(page: Page): Promise<string> {
  const buf = await page.screenshot({ type: "jpeg", quality: 60 });
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
