import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../src/webpack";

/**
 * Renders chosen frames as PNGs for review, bundling once:
 *   bun run tools/stills.ts <outDir> <frame> [frame…]
 */
const [outDir, ...frames] = process.argv.slice(2);
if (!outDir || frames.length === 0) throw new Error("usage: stills.ts <outDir> <frame>…");

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride, publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "Launch" });
const only = process.env.SCALE ? Number(process.env.SCALE) : 0.5;
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `f${String(f).padStart(4, "0")}.png`);
  await renderStill({ serveUrl, composition, frame: f, output, scale: only });
  console.log(output);
}
