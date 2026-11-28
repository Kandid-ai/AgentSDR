import "server-only";

import { PermanentRunError, RetryableRunError } from "@/lib/grid/runners/types";
import { asRecord } from "../server/helpers";

const API_BASE = "https://api.firecrawl.dev";
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_TIMEOUT_MS = 60_000;

export const FIRECRAWL_ORIGIN = "agentsdr";

export type FirecrawlPath = "/v2/scrape" | "/v2/search" | "/v2/team/credit-usage";

export type FirecrawlResponse = { status: number; body: Record<string, unknown>; latencyMs: number };

async function readBody(response: Response): Promise<unknown> {
  const tooLarge = () => new PermanentRunError("Firecrawl response exceeded the 5 MiB limit. The request may have used credits.");
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw tooLarge();
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw tooLarge();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const TERMS_SETTINGS_URL = "https://www.firecrawl.dev/app/settings?tab=data-sources";

function termsUrl(value: unknown): string {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && (url.hostname === "firecrawl.dev" || url.hostname.endsWith(".firecrawl.dev")) ? url.toString() : TERMS_SETTINGS_URL;
  } catch {
    return TERMS_SETTINGS_URL;
  }
}

export function firecrawlFailureDetail(status: number, body: Record<string, unknown>): string {
  if (body.code === "THIRD_PARTY_DATA_TERMS_REQUIRED") {
    return `This Firecrawl Alexandria data provider needs an organization admin to accept its terms first. Accept them at ${termsUrl(asRecord(body.requiresAction).url)} and run the row again.`;
  }
  if (status === 401) return "The API key was rejected.";
  if (status === 402) return "The account has run out of credits.";
  if (status === 429) return "The account is rate limited.";
  if (status === 408) return "The page took too long to load.";
  const raw = typeof body.error === "string" ? body.error : body.message;
  const message = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!message) return `The API returned HTTP ${status}.`;
  if (message.length <= 300) return message.endsWith(".") ? message : `${message}.`;
  const sentence = message.lastIndexOf(". ", 300);
  return sentence > 0 ? message.slice(0, sentence + 1) : `${message.slice(0, 300)}...`;
}

export function firecrawlTimeout(timeoutMs: number | undefined): number {
  return Number.isFinite(timeoutMs) ? Math.min(MAX_TIMEOUT_MS, Math.max(1, Math.floor(timeoutMs!))) : 30_000;
}

export async function requestFirecrawl(
  path: FirecrawlPath,
  apiKey: string | undefined,
  options: { body?: Record<string, unknown>; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<FirecrawlResponse> {
  const key = apiKey?.trim();
  if (!key || /^Bearer\s/i.test(key) || /[^\x21-\x7e]/.test(key)) {
    throw new PermanentRunError("Enter the Firecrawl API key without the Bearer prefix.");
  }
  const deadline = AbortSignal.timeout(firecrawlTimeout(options.timeoutMs));
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const started = Date.now();
  try {
    signal.throwIfAborted();
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.body ? "POST" : "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${key}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
      body: options.body ? JSON.stringify({ ...options.body, origin: FIRECRAWL_ORIGIN }) : undefined,
      redirect: "error", cache: "no-store", signal,
    });
    const body = asRecord(await readBody(response));
    if (!response.ok || body.success === false) {
      const detail = firecrawlFailureDetail(response.status, body);
      const audit = { provider: "firecrawl", request: { path }, response: { status: response.status, code: body.code ?? null } };
      if (response.status === 429) throw new RetryableRunError(`Firecrawl: ${detail}`, audit);
      if (body.code === "THIRD_PARTY_DATA_TERMS_REQUIRED") throw new PermanentRunError(`Firecrawl: ${detail}`, audit);
      throw new PermanentRunError(`Firecrawl: ${detail} No automatic retry was made.`, audit);
    }
    if (path === "/v2/team/credit-usage") {
      if (body.success !== true) throw new PermanentRunError("Firecrawl: The API key could not be checked.");
      return { status: response.status, body: {}, latencyMs: Date.now() - started };
    }
    return { status: response.status, body, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof PermanentRunError || error instanceof RetryableRunError) throw error;
    throw new PermanentRunError("Firecrawl request could not be completed. No automatic retry was made; the request may have used credits.");
  }
}
