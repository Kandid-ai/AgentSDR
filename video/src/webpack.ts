import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind-v4";

/**
 * The video imports the app's real components from ../src, so the bundler is
 * pointed at the app: `@/` resolves to ../src, React (and react-dom) to the
 * app's single copy — two Reacts break every hook; video/package.json pins
 * the same version for the CLI's own checks — and next/link,
 * next/navigation and next/font/google to inert stubs, since a render has no
 * Next router or font transform.
 *
 * Shared by remotion.config.ts (CLI, Studio) and tools/stills.ts (Node API).
 */
// The CLI bundles remotion.config.ts elsewhere before running it, so
// __dirname is not this file's folder; every script runs from video/.
const root = process.cwd();
const app = path.resolve(root, "..");
const appModules = path.join(app, "node_modules");

export const webpackOverride: WebpackOverrideFn = (config) => {
  const tailwind = enableTailwind(config);
  return {
    ...tailwind,
    resolve: {
      ...tailwind.resolve,
      alias: {
        ...(tailwind.resolve?.alias as Record<string, string> | undefined),
        "@": path.join(app, "src"),
        react: path.join(appModules, "react"),
        "react-dom/client": path.join(appModules, "react-dom/client.js"),
        "react-dom": path.join(appModules, "react-dom"),
        "next/link": path.join(root, "src/stubs/link.tsx"),
        "next/navigation": path.join(root, "src/stubs/navigation.ts"),
        "next/font/google": path.join(root, "src/stubs/font.ts"),
      },
    },
  };
};
