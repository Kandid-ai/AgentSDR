import type { CellResult, HttpConfig } from "../types";
import {
  PermanentRunError,
  interpolate,
  pluck,
  tokensIn,
  type ColumnRunner,
} from "./types";

/** Response bodies past this are truncated before being stored as audit. */
const MAX_AUDIT_BYTES = 16 * 1024;

/**
 * HTTP / REST columns — the universal escape hatch.
 *
 * The highest-leverage runner to build first: it lets a self-hoster wire up
 * any provider that was never built as a first-class integration. Integrations
 * added later are this same call with the credentials and URL filled in for
 * you, rather than a separate mechanism.
 */
export const httpRunner: ColumnRunner<HttpConfig> = {
  type: "http",

  resolveDeps(config) {
    const found = [...tokensIn(config.url), ...tokensIn(config.body)];
    for (const v of Object.values(config.headers ?? {})) found.push(...tokensIn(v));
    return [...new Set(found)];
  },

  async run(config, row, ctx): Promise<CellResult> {
    const url = interpolate(config.url ?? "", row);
    if (!url) throw new PermanentRunError("This column has no URL configured");

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new PermanentRunError(`Not a valid URL after substitution: ${url}`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new PermanentRunError(`Unsupported protocol: ${parsed.protocol}`);
    }

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(config.headers ?? {})) {
      headers[k] = interpolate(v, row);
    }

    // The credential is read from the environment by NAME. It is never stored
    // in the database, because grid_providers rows end up in the dumps that
    // self-hosters share around. See docs/design/enrichment-plan.md §6.
    if (config.authEnvVar) {
      const secret = process.env[config.authEnvVar];
      if (!secret) {
        throw new PermanentRunError(
          `Environment variable ${config.authEnvVar} is not set on this server`,
        );
      }
      headers.Authorization ??= secret.startsWith("Bearer ") ? secret : `Bearer ${secret}`;
    }

    const method = (config.method ?? "GET").toUpperCase();
    const body = method === "GET" ? undefined : interpolate(config.body ?? "", row) || undefined;
    if (body && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }

    // Two timeouts are combined: the caller's per-cell budget, and this
    // request's own. Whichever fires first aborts the fetch.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
    const onOuterAbort = () => controller.abort();
    ctx.signal?.addEventListener("abort", onOuterAbort);

    const started = Date.now();
    try {
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      const text = await res.text();

      let parsedBody: unknown = text;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("json") || text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
        try {
          parsedBody = JSON.parse(text);
        } catch {
          // Leave it as text — a provider mislabelling its content type is
          // not worth failing the cell over.
        }
      }

      if (!res.ok) {
        // 4xx is the config being wrong and will fail identically on retry;
        // 5xx and 429 are worth retrying, so only the former is permanent.
        const snippet = text.slice(0, 200);
        const message = `${res.status} ${res.statusText}${snippet ? ` — ${snippet}` : ""}`;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new PermanentRunError(message);
        }
        throw new Error(message);
      }

      const value = pluck(parsedBody, config.responsePath);
      const empty = value === null || value === undefined || value === "";

      return {
        value: empty ? null : value,
        provider: config.providerKey,
        outcome: empty ? "miss" : "hit",
        // A miss still costs money at most providers, which is the whole
        // reason waterfall ordering is worth tuning.
        costCents: config.costCents ?? 0,
        latencyMs: Date.now() - started,
        request: { url, method },
        response: truncate(parsedBody),
      } as CellResult;
    } catch (err) {
      if (err instanceof PermanentRunError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new Error(`Request timed out after ${ctx.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      ctx.signal?.removeEventListener("abort", onOuterAbort);
    }
  },

  estimateCost(config) {
    return config.costCents ?? 0;
  },
};

/** Keeps one enormous response from bloating grid_cell_runs. */
function truncate(value: unknown): unknown {
  try {
    const json = JSON.stringify(value);
    if (json && json.length > MAX_AUDIT_BYTES) {
      return { truncated: true, preview: json.slice(0, MAX_AUDIT_BYTES) };
    }
    return value;
  } catch {
    return null;
  }
}
