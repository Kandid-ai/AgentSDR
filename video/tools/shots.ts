import { mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../src/webpack";

/**
 * Screenshots of the real screens (src/screens), for the film's cards:
 *   bun run tools/shots.ts leads actions email-inbox …
 * Each is rendered through the Screen preview composition at full size and
 * cropped to the app window below the browser bar, into public/shots/screens/<name>.png.
 */
const names = process.argv.slice(2);
if (names.length === 0) throw new Error("usage: shots.ts <screen>…");

const out = path.resolve("public/shots/screens");
const raw = path.resolve("out/full");
mkdirSync(out, { recursive: true });
mkdirSync(raw, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride, publicDir: path.resolve("public") });
for (const name of names) {
  const composition = await selectComposition({ serveUrl, id: "Screen", inputProps: { name } });
  const file = path.join(raw, `${name}.png`);
  await renderStill({ serveUrl, composition, frame: 0, output: file, inputProps: { name } });
  // Preview draws the 1440 × 860 screen at 1.25× from (60, 2.5); the browser bar is the first 44 logical px.
  const proc = Bun.spawnSync(["ffmpeg", "-v", "error", "-y", "-i", file, "-vf", "crop=1800:1020:60:58", path.join(out, `${name}.png`)]);
  if (proc.exitCode !== 0) throw new Error(`crop failed for ${name}: ${proc.stderr.toString()}`);
  console.log(`shot ${name}`);
}
