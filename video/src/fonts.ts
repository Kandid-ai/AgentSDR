import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

/**
 * The landing page's faces, loaded the Remotion way (the app gets them from
 * next/font): Geist for display, Geist Mono for eyebrows, Inter for the app
 * UI. They are exposed under the same CSS variables the app reads, so the
 * borrowed components render in their own type.
 */
const display = loadGeist("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadGeistMono("normal", { weights: ["400", "500"], subsets: ["latin"] });
const sans = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const FONT_VARS = {
  "--font-landing-display": display.fontFamily,
  "--font-landing-mono": mono.fontFamily,
  "--font-sans-inter": sans.fontFamily,
} as React.CSSProperties;
