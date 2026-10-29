import { describe, expect, test } from "bun:test";
import { MAX_REP_LINK_ICE_SERVERS, MAX_RTC_SDP_CHARS } from "../../../src/lib/calls/contract";
import {
  parseRepLinkControl,
  requestIceServers,
  requestRemoteRep,
  summarizeLocalCandidates,
  summarizeSdpCandidates,
  waitForIceGathering,
} from "./rep-link";

const ICE = [
  { urls: ["stun:stun.cloudflare.com:3478"] },
  {
    urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"],
    username: "user",
    credential: "secret",
  },
];

describe("requestRemoteRep", () => {
  test("no rep call", () => {
    expect(requestRemoteRep(undefined)).toBeNull();
    expect(requestRemoteRep(null)).toBeNull();
  });

  test("an offer with its ICE servers", () => {
    expect(requestRemoteRep({ offer: "v=0", iceServers: ICE })).toEqual({ offer: "v=0", iceServers: ICE });
  });

  test("an unusable offer", () => {
    expect(requestRemoteRep({ iceServers: ICE })).toBe("invalid");
    expect(requestRemoteRep({ offer: "  ", iceServers: ICE })).toBe("invalid");
    expect(requestRemoteRep({ offer: 5, iceServers: ICE })).toBe("invalid");
    expect(requestRemoteRep({ offer: "x".repeat(MAX_RTC_SDP_CHARS + 1), iceServers: ICE })).toBe("invalid");
  });

  test("an offer without a relay list (an older AgentSDR) is refused", () => {
    expect(requestRemoteRep({ offer: "v=0" })).toBe("invalid");
    expect(requestRemoteRep({ offer: "v=0", iceServers: [] })).toBe("invalid");
  });
});

describe("requestIceServers", () => {
  test("a single URL string and no credentials", () => {
    expect(requestIceServers([{ urls: "stun:stun.cloudflare.com:3478" }])).toEqual([{ urls: "stun:stun.cloudflare.com:3478" }]);
  });

  test("only stun:, turn: and turns: URLs", () => {
    expect(requestIceServers([{ urls: "https://evil.example" }])).toBeNull();
    expect(requestIceServers([{ urls: ["turn:ok.example", "javascript:alert(1)"] }])).toBeNull();
    expect(requestIceServers([{ urls: [] }])).toBeNull();
    expect(requestIceServers([{ urls: 5 }])).toBeNull();
    expect(requestIceServers([{ urls: "turn: spaced" }])).toBeNull();
  });

  test("username and credential must be text", () => {
    expect(requestIceServers([{ urls: "turn:x.example", username: 1 }])).toBeNull();
    expect(requestIceServers([{ urls: "turn:x.example", credential: { a: 1 } }])).toBeNull();
    expect(requestIceServers([{ urls: "turn:x.example", credential: "c".repeat(1_001) }])).toBeNull();
  });

  test("at most MAX_REP_LINK_ICE_SERVERS servers", () => {
    const one = { urls: "stun:stun.example:3478" };
    expect(requestIceServers(Array.from({ length: MAX_REP_LINK_ICE_SERVERS }, () => one))).toHaveLength(MAX_REP_LINK_ICE_SERVERS);
    expect(requestIceServers(Array.from({ length: MAX_REP_LINK_ICE_SERVERS + 1 }, () => one))).toBeNull();
  });

  test("not a list", () => {
    expect(requestIceServers(undefined)).toBeNull();
    expect(requestIceServers({ urls: "stun:x" })).toBeNull();
    expect(requestIceServers([null])).toBeNull();
  });

  test("drops unknown keys", () => {
    expect(requestIceServers([{ urls: "stun:x.example", extra: true }])).toEqual([{ urls: "stun:x.example" }]);
  });
});

describe("summarizeSdpCandidates", () => {
  test("counts kinds, without addresses", () => {
    const sdp = [
      "v=0",
      "a=candidate:1 1 udp 2122260223 192.168.1.2 51000 typ host generation 0",
      "a=candidate:2 1 udp 1686052607 203.0.113.9 51000 typ srflx raddr 192.168.1.2 rport 51000",
      "a=candidate:3 1 udp 41885439 198.51.100.4 40000 typ relay raddr 203.0.113.9 rport 51000",
      "a=candidate:4 1 udp 41885438 198.51.100.4 40001 typ relay raddr 203.0.113.9 rport 51001",
      "a=candidate:5 1 tcp 1518280447 192.168.1.2 9 typ host tcptype active",
    ].join("\r\n");
    const summary = summarizeSdpCandidates(sdp);
    expect(summary).toBe("host/udp×1 srflx/udp×1 relay/udp×2 host/tcp×1");
    expect(summary).not.toContain("198.51");
  });

  test("none", () => {
    expect(summarizeSdpCandidates("v=0\r\no=- 1 2 IN IP4 127.0.0.1")).toBe("none");
  });
});

describe("summarizeLocalCandidates", () => {
  test("labels a relay by how it reaches the TURN server", () => {
    expect(
      summarizeLocalCandidates([
        { type: "local-candidate", candidateType: "relay", protocol: "udp", relayProtocol: "tls" },
        { type: "local-candidate", candidateType: "srflx", protocol: "udp" },
        { type: "remote-candidate", candidateType: "host", protocol: "udp" },
        { type: "candidate-pair" },
      ]),
    ).toBe("relay/tls×1 srflx/udp×1");
    expect(summarizeLocalCandidates([])).toBe("none");
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
