import { Geist } from "next/font/google";

/**
 * The brand's display face: Geist 500/600. It sets the wordmark everywhere
 * (sidebar, login, landing) and the landing page's headlines, so the root
 * layout puts its variable on <html>. The variable keeps its original name
 * because the landing CSS refers to it.
 */
export const brandDisplay = Geist({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-landing-display", display: "swap" });

/** Tailwind classes for text in the display face. */
export const brandDisplayClass = "font-[family-name:var(--font-landing-display)] font-medium";
