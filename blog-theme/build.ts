/// <reference types="bun-types" />
/**
 * Builds the Ghost theme: bundles src/main.ts into assets/built/main.js, then
 * zips the theme into dist/agentsdr-theme.zip with the system `zip`.
 * Run with `bun run build:blog-theme` from the repo root.
 */
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = dirname(new URL(import.meta.url).pathname);

// Ghost's production proxy only serves /blog/assets/built/*, so the script must land there.
const result = await Bun.build({
  entrypoints: [join(root, "src/main.ts")],
  outdir: join(root, "assets/built"),
  target: "browser",
  format: "iife",
  minify: true,
  naming: "main.js",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const dist = join(root, "dist");
const zipPath = join(dist, "agentsdr-theme.zip");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const proc = Bun.spawn(
  ["zip", "-r", "-q", zipPath, ".", "-x", "src/*", "build.ts", "dist/*", "README.md", "node_modules/*", "*.DS_Store", ".gitignore", ".git/*"],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);
if ((await proc.exited) !== 0) {
  console.error("zip failed");
  process.exit(1);
}
console.log(`built ${zipPath}`);
