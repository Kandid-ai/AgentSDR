import { Geist } from "next/font/google";

/**
 * The brand's display face: Geist 500/600. It sets the wordmark everywhere
 * (sidebar, login), so the root layout puts its variable on <html>. The
 * variable keeps its original name (--font-landing-display) because the
 * stylesheets refer to it.
 */
export const brandDisplay = Geist({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-landing-display", display: "swap" });

/** Tailwind classes for text in the display face. */
export const brandDisplayClass = "font-[family-name:var(--font-landing-display)] font-medium";
