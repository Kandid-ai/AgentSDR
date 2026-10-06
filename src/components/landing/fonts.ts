import { Caveat, Geist_Mono } from "next/font/google";
import { brandDisplay } from "@/components/brand/font";

/**
 * The landing page's type (next/font self-hosts them, no layout shift). The
 * app's Inter stays the body face, as in the app itself.
 *
 * - display: the brand face, Geist 500 for headlines — the reference sets
 *   Aeonik Pro, a licensed face; Geist is the closest open geometric
 *   grotesk. Defined in components/brand/font.ts because the wordmark uses
 *   it app-wide; the root layout loads it everywhere.
 * - mono: Geist Mono for the small uppercase eyebrows, as the reference does.
 * - hand: Caveat for the two handwritten annotations around the channel dock.
 *
 * mono and hand load on "/" only.
 */
export const display = brandDisplay;
export const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-landing-mono", display: "swap" });
export const hand = Caveat({ subsets: ["latin"], weight: ["500"], variable: "--font-landing-hand", display: "swap" });

export const fontVariables = `${display.variable} ${mono.variable} ${hand.variable}`;
