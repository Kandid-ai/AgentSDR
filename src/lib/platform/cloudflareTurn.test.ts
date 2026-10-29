import { describe, expect, test } from "bun:test";
import { MAX_REP_LINK_ICE_SERVERS } from "@/lib/calls/contract";
import { hasTurnRelay, usableIceServers } from "./cloudflareTurn";

// Cloudflare's documented answer (developers.cloudflare.com/realtime/turn/generate-credentials/), plus port 53.
const ANSWER = {
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
    {
      urls: [
        "turn:turn.cloudflare.com:3478?transport=udp",
        "turn:turn.cloudflare.com:53?transport=udp",
        "turn:turn.cloudflare.com:443?transport=udp",
        "turn:turn.cloudflare.com:3478?transport=tcp",
        "turn:turn.cloudflare.com:80?transport=tcp",
        "turns:turn.cloudflare.com:5349?transport=tcp",
        "turns:turn.cloudflare.com:443?transport=tcp",
      ],
      username: "user",
      credential: "secret",
    },
  ],
};

describe("usableIceServers", () => {
  test("keeps STUN, TURN over UDP/TCP and TLS; drops port 53", () => {
    const servers = usableIceServers(ANSWER);
    expect(servers).toEqual([
      { urls: ["stun:stun.cloudflare.com:3478"] },
      {
        urls: [
          "turn:turn.cloudflare.com:3478?transport=udp",
          "turn:turn.cloudflare.com:443?transport=udp",
          "turn:turn.cloudflare.com:3478?transport=tcp",
          "turn:turn.cloudflare.com:80?transport=tcp",
          "turns:turn.cloudflare.com:5349?transport=tcp",
          "turns:turn.cloudflare.com:443?transport=tcp",
        ],
        username: "user",
        credential: "secret",
      },
    ]);
    expect(hasTurnRelay(servers)).toBe(true);
  });

  test("port 5349 or 5300 is not port 53", () => {
    expect(usableIceServers({ iceServers: [{ urls: "turn:x.example:5300" }] })).toEqual([{ urls: ["turn:x.example:5300"] }]);
    expect(usableIceServers({ iceServers: [{ urls: "turn:x.example:53" }] })).toEqual([]);
  });

  test("drops what is not an ICE URL, and empty servers", () => {
    expect(usableIceServers({ iceServers: [{ urls: ["https://x.example", 5] }, null, "stun:x"] })).toEqual([]);
  });

  test("not the documented shape", () => {
    expect(usableIceServers(null)).toEqual([]);
    expect(usableIceServers({ iceServers: { urls: "stun:x" } })).toEqual([]);
  });

  test("at most MAX_REP_LINK_ICE_SERVERS servers", () => {
    const many = { iceServers: Array.from({ length: 20 }, () => ({ urls: "stun:x.example:3478" })) };
    expect(usableIceServers(many)).toHaveLength(MAX_REP_LINK_ICE_SERVERS);
  });
});

describe("hasTurnRelay", () => {
  test("needs a TURN URL with credentials", () => {
    expect(hasTurnRelay([{ urls: ["stun:x"] }])).toBe(false);
    expect(hasTurnRelay([{ urls: ["turn:x"] }])).toBe(false);
    expect(hasTurnRelay([{ urls: "turns:x", username: "u", credential: "c" }])).toBe(true);
  });
});
