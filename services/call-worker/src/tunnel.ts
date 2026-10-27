import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createSocket } from "node:dgram";
import { lookup } from "node:dns/promises";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { WorkerProxy } from "../../../src/lib/calls/stationContract";

/**
 * Carries a number's call audio through its proxy (TUNNEL=true).
 *
 * A browser sends only TCP through a proxy; WebRTC's UDP — the call's audio —
 * cannot go that way, so GoLogin forced it into TCP through the proxy, where
 * WhatsApp's "Connecting…" took 3.3 s and the audio lagged (27 Oct 2026). A
 * SOCKS5 proxy with UDP support (Proxy-Cheap's does) can carry it if the
 * container's UDP reaches it: sing-box holds a TUN interface and relays what
 * arrives there through the proxy, and policy routing sends the container's
 * UDP — and only UDP — into that interface. TCP is never routed there: the
 * browser's web traffic keeps using the profile's proxy, the worker's API calls
 * go out as before. DNS, private and link-local addresses, and the proxy's own
 * address stay on the normal route.
 *
 * (sing-box's own auto_route captured every packet, and in the container all
 * TCP then timed out — GoLogin's API, AgentSDR — 27 Oct 2026.)
 *
 * One number per container: the routing is container-wide (STATIONS names
 * the one number). Needs NET_ADMIN, /dev/net/tun and loose reverse-path
 * filtering (docker-compose.tunnel.yml).
 */

const INTERFACE = "agentsdr0";
/** RFC 2544 benchmarking space: never a Docker network's. */
const ADDRESS = "198.18.0.1/30";
const TABLE = "7777";
/** Our ip rules' priorities, all removed on stop. */
const PREFS = { proxy: 9000, dns: 9001, local: 9002, udp: 9010 } as const;
const LOCAL_RANGES = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "127.0.0.0/8", "100.64.0.0/10"];

export function tunnelConfig(proxy: WorkerProxy): object {
  const server = new URL(proxy.server);
  if (server.protocol !== "socks5:") throw new Error(`the tunnel needs a SOCKS5 proxy (with UDP); this number's is ${server.protocol.replace(":", "")}`);
  return {
    log: { level: "warn", timestamp: true },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        interface_name: INTERFACE,
        address: [ADDRESS],
        mtu: 1400,
        // Routing is ours (policy rules for UDP only) — see the header.
        auto_route: false,
        stack: "gvisor",
      },
    ],
    outbounds: [
      {
        type: "socks",
        tag: "proxy",
        server: server.hostname,
        server_port: Number(server.port),
        version: "5",
        ...(proxy.username ? { username: proxy.username } : {}),
        ...(proxy.password ? { password: proxy.password } : {}),
      },
      { type: "direct", tag: "direct" },
    ],
    route: {
      rules: [
        { port: 53, outbound: "direct" },
        { ip_is_private: true, outbound: "direct" },
      ],
      // Only UDP is routed into the interface; all of it goes through the proxy.
      final: "proxy",
    },
  };
}

const run = promisify(execFile);

/** The ip commands that send the container's UDP into the tunnel, and those that undo them. */
export function routingCommands(proxyIp: string): { up: string[][]; down: string[][] } {
  const up: string[][] = [
    ["ip", "rule", "add", "pref", String(PREFS.proxy), "to", `${proxyIp}/32`, "lookup", "main"],
    ["ip", "rule", "add", "pref", String(PREFS.dns), "ipproto", "udp", "dport", "53", "lookup", "main"],
    ...LOCAL_RANGES.map((range) => ["ip", "rule", "add", "pref", String(PREFS.local), "to", range, "lookup", "main"]),
    ["ip", "route", "replace", "default", "dev", INTERFACE, "table", TABLE],
    ["ip", "rule", "add", "pref", String(PREFS.udp), "ipproto", "udp", "lookup", TABLE],
  ];
  const down: string[][] = [
    ["ip", "rule", "del", "pref", String(PREFS.udp)],
    ["ip", "route", "flush", "table", TABLE],
    ...LOCAL_RANGES.map(() => ["ip", "rule", "del", "pref", String(PREFS.local)]),
    ["ip", "rule", "del", "pref", String(PREFS.dns)],
    ["ip", "rule", "del", "pref", String(PREFS.proxy)],
  ];
  return { up, down };
}

export type Tunnel = { stop(): Promise<void> };

/** Starts sing-box, routes the container's UDP into it, and resolves once it is in place (or rejects with why). */
export async function startTunnel(proxy: WorkerProxy, dir: string, log: (text: string) => void): Promise<Tunnel> {
  const server = new URL(proxy.server);
  const proxyIp = (await lookup(server.hostname, { family: 4 })).address;
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, "sing-box.json");
  await writeFile(configPath, JSON.stringify(tunnelConfig(proxy), null, 2), { mode: 0o600 });
  const child: ChildProcess = spawn(process.env.SING_BOX_PATH ?? "sing-box", ["run", "-c", configPath], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const collect = (chunk: Buffer) => {
    output = (output + String(chunk)).slice(-2_000);
    for (const line of String(chunk).split("\n").filter(Boolean)) log(`tunnel: ${line.slice(0, 300)}`);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  child.once("error", (error) => {
    output += `\n${error.message}`;
  });
  const stopSingBox = async () => {
    if (child.exitCode !== null) return;
    child.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3_000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
  };
  // sing-box has no ready signal: up once the interface exists and it is still running.
  const up = await Promise.race([
    (async () => {
      for (let i = 0; i < 40; i++) {
        if (await access(`/sys/class/net/${INTERFACE}`).then(() => true, () => false)) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return false;
    })(),
    exited.then(() => false),
  ]);
  if (!up) {
    await stopSingBox();
    throw new Error(`the tunnel did not start: ${output.trim().split("\n").slice(-3).join(" | ") || "no output"}`);
  }
  const { up: routeUp, down: routeDown } = routingCommands(proxyIp);
  const unroute = async () => {
    for (const [cmd, ...args] of routeDown) await run(cmd!, args).catch(() => {});
  };
  await unroute(); // leftovers from a worker that died without cleaning up
  try {
    for (const [cmd, ...args] of routeUp) await run(cmd!, args);
  } catch (error) {
    await unroute();
    await stopSingBox();
    throw new Error(`could not route UDP into the tunnel: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  }
  log(`tunnel: up — UDP goes through ${server.host}; TCP untouched`);
  // Proof, not hope: ask a public STUN server which address our UDP comes from.
  const seen = await stunPublicAddress().catch((error: unknown) => `failed (${error instanceof Error ? error.message : String(error)})`);
  log(
    seen === proxyIp
      ? `tunnel: UDP check passed — STUN sees ${seen}, the proxy's IP`
      : `tunnel: UDP check FAILED — STUN answered ${seen}, expected the proxy's ${proxyIp}; call audio will fall back to TCP`,
  );
  return {
    stop: async () => {
      await unroute();
      await stopSingBox();
    },
  };
}

/** The public IPv4 address a STUN server sees for our UDP (RFC 5389 binding request), or throws on no answer. */
export function stunPublicAddress(host = "stun.l.google.com", port = 19302, timeoutMs = 5_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    const id = randomBytes(12);
    const request = Buffer.alloc(20);
    request.writeUInt16BE(0x0001, 0); // binding request
    request.writeUInt16BE(0, 2);
    request.writeUInt32BE(0x2112a442, 4); // magic cookie
    id.copy(request, 8);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`no answer from ${host}:${port} in ${timeoutMs / 1000} s`));
    }, timeoutMs);
    socket.on("message", (message) => {
      clearTimeout(timer);
      socket.close();
      // Walk the attributes for XOR-MAPPED-ADDRESS (0x0020) or MAPPED-ADDRESS (0x0001).
      for (let at = 20; at + 4 <= message.length; ) {
        const type = message.readUInt16BE(at);
        const length = message.readUInt16BE(at + 2);
        const value = message.subarray(at + 4, at + 4 + length);
        if ((type === 0x0020 || type === 0x0001) && value[1] === 0x01) {
          const raw = value.readUInt32BE(4) ^ (type === 0x0020 ? 0x2112a442 : 0);
          resolve([raw >>> 24, (raw >>> 16) & 255, (raw >>> 8) & 255, raw & 255].join("."));
          return;
        }
        at += 4 + length + ((4 - (length % 4)) % 4);
      }
      reject(new Error("the STUN answer had no address"));
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
    socket.send(request, port, host);
  });
}
