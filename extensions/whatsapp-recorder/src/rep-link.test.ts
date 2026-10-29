import { describe, expect, test } from "bun:test";
import { MAX_RTC_SDP_CHARS } from "../../../src/lib/calls/contract";
import { parseRepLinkControl, requestRemoteRep, waitForIceGathering } from "./rep-link";

describe("requestRemoteRep", () => {
  test("no rep call", () => {
    expect(requestRemoteRep(undefined)).toBeNull();
    expect(requestRemoteRep(null)).toBeNull();
  });

  test("an offer", () => {
    expect(requestRemoteRep({ offer: "v=0" })).toEqual({ offer: "v=0" });
  });

  test("an unusable offer", () => {
    expect(requestRemoteRep({})).toBe("invalid");
    expect(requestRemoteRep({ offer: "  " })).toBe("invalid");
    expect(requestRemoteRep({ offer: 5 })).toBe("invalid");
    expect(requestRemoteRep({ offer: "x".repeat(MAX_RTC_SDP_CHARS + 1) })).toBe("invalid");
  });
});

describe("parseRepLinkControl", () => {
  test("hangup", () => {
    expect(parseRepLinkControl(JSON.stringify({ type: "hangup" }))).toEqual({ type: "hangup" });
  });

  test("anything else is ignored", () => {
    expect(parseRepLinkControl("not json")).toBeNull();
    expect(parseRepLinkControl(JSON.stringify({ type: "dance" }))).toBeNull();
    expect(parseRepLinkControl("null")).toBeNull();
    expect(parseRepLinkControl(new ArrayBuffer(4))).toBeNull();
  });
});

class FakeGathering extends EventTarget {
  iceGatheringState: RTCIceGathererState = "gathering";
  complete() {
    this.iceGatheringState = "complete";
    this.dispatchEvent(new Event("icegatheringstatechange"));
  }
}

describe("waitForIceGathering", () => {
  test("already complete", async () => {
    const pc = new FakeGathering();
    pc.iceGatheringState = "complete";
    await waitForIceGathering(pc as unknown as RTCPeerConnection, 10_000);
  });

  test("resolves when gathering completes", async () => {
    const pc = new FakeGathering();
    const started = Date.now();
    const waiting = waitForIceGathering(pc as unknown as RTCPeerConnection, 10_000);
    setTimeout(() => pc.complete(), 10);
    await waiting;
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  test("gives up after the timeout", async () => {
    const pc = new FakeGathering();
    const started = Date.now();
    await waitForIceGathering(pc as unknown as RTCPeerConnection, 30);
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  });
});
