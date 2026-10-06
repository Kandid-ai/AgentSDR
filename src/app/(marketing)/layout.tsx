import type { ReactNode } from "react";
import { fontVariables } from "@/components/landing/fonts";
import styles from "@/components/landing/landing.module.css";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Nav } from "@/components/marketing/Nav";
import { organizationLd } from "@/lib/marketing/seo";
import { cn } from "@/utils/cn";

/**
 * The public marketing site: the landing page and every product, solution,
 * comparison and guide page. Shares one header (with the mega-menu) and one
 * footer, and pins the AlignUI tokens to their light values (`styles.page`)
 * so the product showcases look the same whatever theme a visitor picked in
 * the app. Paths are public and chromeless via MARKETING_PREFIXES.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn(styles.page, fontVariables, "relative min-h-screen w-full overflow-x-clip font-sans antialiased")}>
      <a href="#main" className="sr-only z-50 rounded-full bg-white px-4 py-2 text-[14px] text-[#141414] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <JsonLd data={organizationLd()} />
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </div>
  );
}
