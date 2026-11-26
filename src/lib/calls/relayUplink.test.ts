import { beforeEach, describe, expect, test } from "bun:test";
import { REP_RELAY_STREAM_HEADER } from "./contract";
import { forgetStreamingFallback, MAX_CHUNKS_IN_FLIGHT, RelayUplink, RoundTrips, STREAM_FAILURES_BEFORE_FALLBACK, streamDecision } from "./relayUplink";

describe("streamDecision", () => {
  const fresh = { worked: false, failures: 0 };

  test("falls back on the first failure before any stream worked: every second of probing is audio lost", () => {
    expect(STREAM_FAILURES_BEFORE_FALLBACK).toBe(1);
    expect(streamDecision(fresh, { heard: false, error: "AgentSDR did not hear its audio in 1.5 s" })).toEqual({ worked: false, failures: 1, fallBack: true });
  });

  test("a heard stream resets the count and proves streaming works: later failures only retry", () => {
    const once = streamDecision(fresh, { heard: false, error: "Failed to fetch" });
    const worked = streamDecision(once, { heard: true, error: null });
    expect(worked).toEqual({ worked: true, failures: 0, fallBack: false });
    let state = worked;
    for (let i = 0; i < 5; i++) state = streamDecision(state, { heard: false, error: "network" });
    expect(state).toEqual({ worked: true, failures: 5, fallBack: false });
  });

  test("an attempt that ended quietly counts neither way", () => {
    expect(streamDecision(fresh, { heard: false, error: null })).toEqual({ ...fresh, fallBack: false });
  });
});

describe("RoundTrips", () => {
  test("sums up min / avg / max once per window, then starts a new one", () => {
    const trips = new RoundTrips(10_000);
    expect(trips.add(800, 0)).toBeNull();
    expect(trips.add(1_000, 4_000)).toBeNull();
    expect(trips.add(1_200, 10_000)).toBe("POST round trips over 10 s: min 800 / avg 1000 / max 1200 ms (3 requests)");
    expect(trips.add(50, 11_000)).toBeNull();
  });
});

type StreamBehaviour = "heard" | "refused" | "unheard";

/**
 * A relay for the uplink to talk to: streams behave as told (heard — the
 * relay acknowledges the first audio; refused — fetch rejects, as Chrome does
 * without HTTP/2; unheard — accepted but never acknowledged), chunks are kept.
 */
function fakeRelay(behaviour: (attempt: number) => StreamBehaviour) {
  const streams: { headers: Record<string, string>; chunks: number[][]; ended: boolean }[] = [];
  const posts: number[][] = [];
  const steps: string[] = [];
  let uplink: RelayUplink | null = null;
  const fetch = async (_url: string, init: RequestInit): Promise<Response> => {
    const headers = init.headers as Record<string, string>;
    if (headers[REP_RELAY_STREAM_HEADER] !== "1") {
      const bytes = init.body as Uint8Array;
      posts.push(Array.from(new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)));
      return new Response(null, { status: 204 });
    }
    const kind = behaviour(streams.length);
    const stream = { headers, chunks: [] as number[][], ended: false };
    streams.push(stream);
    if (kind === "refused") throw new TypeError("Failed to fetch");
    const reader = (init.body as ReadableStream<Uint8Array>).getReader();
    const signal = init.signal!;
    for (;;) {
      const read = reader.read();
      const aborted = new Promise<"aborted">((resolve) => {
        if (signal.aborted) resolve("aborted");
        signal.addEventListener("abort", () => resolve("aborted"), { once: true });
      });
      const result = await Promise.race([read, aborted]);
      if (result === "aborted") {
        await reader.cancel().catch(() => {});
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      if (result.done) break;
      const bytes = result.value;
      stream.chunks.push(Array.from(new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)));
      if (kind === "heard" && stream.chunks.length === 1) uplink?.heard();
    }
    stream.ended = true;
    return new Response(null, { status: 204 });
  };
  return {
    streams,
    posts,
    steps,
    open(timing: ConstructorParameters<typeof RelayUplink>[0]["timing"] = {}) {
      uplink = new RelayUplink({ url: "u", headers: { Authorization: "Bearer t" }, log: (step) => steps.push(step), fetch, tryStreaming: true, canStream: true, timing: { backoffMs: [5], ackMs: 100, ...timing } });
      uplink.start();
      return uplink;
    },
  };
}

const block = (value: number, samples = 700) => new Int16Array(samples).fill(value);

describe("RelayUplink", () => {
  beforeEach(forgetStreamingFallback);

  test("streams audio on one request as it comes, marked for the relay, and says so once heard", async () => {
    const relay = fakeRelay(() => "heard");
    const uplink = relay.open();
    await waitFor(() => relay.streams.length === 1);
    uplink.send(block(1, 3));
    await waitFor(() => relay.streams[0]!.chunks.length === 1);
    uplink.send(block(2, 2));
    await waitFor(() => relay.streams[0]!.chunks.length === 2);
    expect(relay.streams[0]!.chunks).toEqual([[1, 1, 1], [2, 2]]);
    expect(relay.streams[0]!.headers.Authorization).toBe("Bearer t");
    expect(relay.streams).toHaveLength(1);
    expect(relay.posts).toHaveLength(0);
    expect(relay.steps).toEqual(["uplink: streaming"]);
    expect(uplink.mode).toBe("streaming");
    uplink.close();
  });

  test("falls back to chunked POSTs when a stream is refused (no HTTP/2)", async () => {
    const relay = fakeRelay(() => "refused");
    const uplink = relay.open();
    await waitFor(() => uplink.mode === "chunked");
    expect(relay.streams).toHaveLength(STREAM_FAILURES_BEFORE_FALLBACK);
    expect(relay.steps.at(-1)).toBe("uplink: chunked (fallback: Failed to fetch)");
    uplink.send(block(3));
    await waitFor(() => relay.posts.length === 1);
    expect(relay.posts[0]).toEqual(Array.from(block(3)));
    uplink.close();
  });

  test("falls back when the relay never hears a stream's audio (something holds the body back)", async () => {
    const relay = fakeRelay(() => "unheard");
    const uplink = relay.open({ ackMs: 30 });
    for (let i = 0; i < STREAM_FAILURES_BEFORE_FALLBACK; i++) {
      await waitFor(() => relay.streams.length === i + 1);
      uplink.send(block(1, 10));
      await waitFor(() => relay.streams[i]!.chunks.length === 1);
    }
    await waitFor(() => uplink.mode === "chunked");
    expect(relay.steps.at(-1)).toBe("uplink: chunked (fallback: AgentSDR did not hear its audio in 0.03 s)");
    uplink.close();
  });

  test("by default it never tries a stream: chunks from the first audio", async () => {
    const steps: string[] = [];
    const posts: number[] = [];
    const uplink = new RelayUplink({
      url: "u",
      log: (step) => steps.push(step),
      canStream: true,
      fetch: async (_url, init) => {
        expect((init.headers as Record<string, string>)["X-Relay-Stream"]).toBeUndefined();
        posts.push((init.body as Uint8Array).byteLength / 2);
        return new Response(null, { status: 204 });
      },
    });
    uplink.start();
    expect(uplink.mode).toBe("chunked");
    expect(steps).toEqual(["uplink: chunked"]);
    uplink.send(block(1));
    await waitFor(() => posts.length === 1);
    uplink.close();
  });

  test("after a fallback, the page's next call sends chunks from the start, without probing", async () => {
    const first = fakeRelay(() => "refused");
    const uplink = first.open();
    await waitFor(() => uplink.mode === "chunked");
    uplink.close();
    const next = fakeRelay(() => "heard");
    const again = next.open();
    expect(again.mode).toBe("chunked");
    expect(next.steps).toEqual(["uplink: chunked (streaming did not get through on an earlier call)"]);
    again.send(block(4));
    await waitFor(() => next.posts.length === 1);
    expect(next.streams).toHaveLength(0);
    again.close();
  });

  test("once a stream worked, a refused one is retried with a stream, not given up on", async () => {
    const relay = fakeRelay((attempt) => (attempt === 0 ? "heard" : attempt < 4 ? "refused" : "heard"));
    const uplink = relay.open({ rotateMs: 30 });
    uplink.send(block(1, 10));
    await waitFor(() => relay.streams.length >= 5);
    expect(uplink.mode).toBe("streaming");
    expect(relay.steps.filter((step) => step.startsWith("uplink: the stream failed"))).toHaveLength(3);
    uplink.close();
  });

  test("rotates: a new stream takes over and the old one's body ends", async () => {
    const relay = fakeRelay(() => "heard");
    const uplink = relay.open({ rotateMs: 40 });
    uplink.send(block(1, 10));
    await waitFor(() => relay.streams.length === 2);
    await waitFor(() => relay.streams[0]!.ended);
    uplink.send(block(2, 10));
    await waitFor(() => relay.streams[1]!.chunks.length === 1);
    expect(relay.streams[1]!.chunks[0]).toEqual(Array.from(block(2, 10)));
    expect(uplink.mode).toBe("streaming");
    uplink.close();
  });

  test("a browser that cannot stream sends chunks from the start", async () => {
    const steps: string[] = [];
    const uplink = new RelayUplink({
      url: "u",
      log: (step) => steps.push(step),
      tryStreaming: true,
      canStream: false,
      fetch: async () => new Response(null, { status: 204 }),
    });
    uplink.start();
    expect(steps).toEqual(["uplink: chunked (fallback: this browser cannot stream a request body)"]);
    expect(uplink.mode).toBe("chunked");
    uplink.close();
  });

  test("chunks go out without waiting for the previous answer, numbered in order, at most MAX_CHUNKS_IN_FLIGHT at once", async () => {
    const urls: string[] = [];
    const bodies: number[] = [];
    const gates: Array<() => void> = [];
    const uplink = new RelayUplink({
      url: "/api/calls/c/relay",
      log: () => {},
      fetch: async (url, init) => {
        urls.push(url);
        bodies.push((init.body as Uint8Array).byteLength / 2);
        await new Promise<void>((resolve) => gates.push(resolve));
        return new Response(null, { status: 204 });
      },
    });
    // Less than REP_RELAY_CHUNK_MS (640 samples) waits for more.
    uplink.send(block(1, 600));
    expect(bodies).toHaveLength(0);
    uplink.send(block(1, 100));
    uplink.send(block(2, 700));
    // The second goes while the first is still out.
    expect(bodies).toEqual([700, 700]);
    const seqs = urls.map((url) => Number(new URL(url, "https://x").searchParams.get("seq")));
    expect(seqs[1]!).toBeGreaterThan(seqs[0]!);
    expect(urls[0]!.startsWith("/api/calls/c/relay?seq=")).toBe(true);
    for (let i = 0; i < MAX_CHUNKS_IN_FLIGHT; i++) uplink.send(block(3, 700));
    expect(bodies).toHaveLength(MAX_CHUNKS_IN_FLIGHT);
    // At the cap, audio gathers and goes in the next free slot.
    gates.shift()!();
    await waitFor(() => bodies.length === MAX_CHUNKS_IN_FLIGHT + 1);
    expect(bodies.at(-1)).toBe(700 * 2);
    for (const release of gates) release();
    uplink.close();
  });
});

async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}
