import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../src/webpack";

/**
 * Renders the Product Hunt assets (src/ph) into out/product-hunt:
 *   gallery/NN-name.png      1270 × 760, the size Product Hunt asks for
 *   gallery@2x/NN-name.png   2540 × 1520, sharper on high-density screens
 *   thumbnail.png (240), thumbnail@2x.png (480), thumbnail.gif (240, looping)
 *
 *   bun run tools/ph.ts [id-filter]
 */
const only = process.argv[2];
const out = path.resolve("out/product-hunt");
for (const d of ["gallery", "gallery@2x"]) mkdirSync(path.join(out, d), { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride, publicDir: path.resolve("public") });
const kb = (f: string) => `${Math.round(statSync(f).size / 1024)} KB`;

const { getCompositions } = await import("@remotion/renderer");
const ids = (await getCompositions(serveUrl)).map((c) => c.id).filter((id) => id.startsWith("ph-") && (!only || id.includes(only)));

for (const id of ids.filter((i) => !i.startsWith("ph-thumbnail"))) {
  const name = id.slice(3);
  const composition = await selectComposition({ serveUrl, id });
  const big = path.join(out, "gallery@2x", `${name}.png`);
  await renderStill({ serveUrl, composition, frame: 0, output: big, scale: 2540 / composition.width });
  const small = path.join(out, "gallery", `${name}.png`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", big, "-vf", "scale=1270:760:flags=lanczos", small]);
  console.log(`${name}: ${kb(small)} · @2x ${kb(big)}`);
}

if (ids.includes("ph-thumbnail")) {
  const composition = await selectComposition({ serveUrl, id: "ph-thumbnail" });
  await renderStill({ serveUrl, composition, frame: 0, output: path.join(out, "thumbnail@2x.png") });
  await renderStill({ serveUrl, composition, frame: 0, output: path.join(out, "thumbnail.png"), scale: 0.5 });
  console.log("thumbnail.png, thumbnail@2x.png");
}
if (ids.includes("ph-thumbnail-animated")) {
  const composition = await selectComposition({ serveUrl, id: "ph-thumbnail-animated" });
  const gif = path.join(out, "thumbnail.gif");
  await renderMedia({ serveUrl, composition, codec: "gif", outputLocation: gif, scale: 0.5, numberOfGifLoops: null });
  console.log(`thumbnail.gif: ${kb(gif)}`);
}
