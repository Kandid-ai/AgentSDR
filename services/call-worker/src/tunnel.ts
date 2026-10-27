import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkerProxy } from "../../../src/lib/calls/stationContract";

/**
 * Carries a number's call audio through its proxy (TUNNEL=true).
 *
 * A browser sends only TCP through a proxy; WebRTC's UDP — the call's audio —
 * cannot go that way, so GoLogin forced it into TCP through the proxy, where
 * WhatsApp's "Connecting…" took 3.3 s and the audio lagged (27 Oct 2026). A
 * SOCKS5 proxy with UDP support (Proxy-Cheap's does) can carry it if the
 * container's UDP is routed there: sing-box makes a TUN interface for the
 * whole container and sends every UDP packet through the proxy; all TCP goes
 * direct — the browser's own web traffic still uses the profile's proxy, as
 * before. The audio then leaves from the proxy's IP over UDP.
 *
 * One number per container: the tunnel is container-wide (STATIONS names the
 * one number). The container needs NET_ADMIN and /dev/net/tun (see
 * docker-compose.tunnel.yml); the GoLogin profile's WebRTC must allow UDP
 * ("Real"), and QUIC is turned off so web pages stay on TCP.
 */

export function tunnelConfig(proxy: WorkerProxy): object {
  const server = new URL(proxy.server);
  if (server.protocol !== "socks5:") throw new Error(`the tunnel needs a SOCKS5 proxy (with UDP); this number's is ${server.protocol.replace(":", "")}`);
  return {
    log: { level: "warn", timestamp: true },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        interface_name: "agentsdr0",
        address: ["172.19.0.1/30"],
        mtu: 1400,
        auto_route: true,
        stack: "mixed",
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
      // UDP (WebRTC: STUN and the call's audio) through the number's proxy; everything else as before.
      // DNS and private/link-local addresses stay local: Google Cloud's resolver is 169.254.169.254.
      rules: [
        { port: 53, outbound: "direct" },
        { ip_is_private: true, outbound: "direct" },
        { network: "udp", outbound: "proxy" },
      ],
      final: "direct",
      auto_detect_interface: true,
    },
  };
}

export type Tunnel = { stop(): Promise<void> };

/** Starts sing-box with tunnelConfig and resolves once its TUN interface is up (or rejects with its output). */
export async function startTunnel(proxy: WorkerProxy, dir: string, log: (text: string) => void): Promise<Tunnel> {
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
  // sing-box has no ready signal; up once the interface exists and it is still running.
  const up = await Promise.race([
    (async () => {
      for (let i = 0; i < 40; i++) {
        if (await interfaceExists("agentsdr0")) return true;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return false;
    })(),
    exited.then(() => false),
  ]);
  if (!up) {
    child.kill("SIGKILL");
    throw new Error(`the tunnel did not start: ${output.trim().split("\n").slice(-3).join(" | ") || "no output"}`);
  }
  log(`tunnel: up — UDP goes through ${new URL(proxy.server).host}`);
  return {
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3_000))]);
      if (child.exitCode === null) child.kill("SIGKILL");
    },
  };
}

async function interfaceExists(name: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  return access(`/sys/class/net/${name}`).then(
    () => true,
    () => false,
  );
}
