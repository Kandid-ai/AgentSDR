import { cn } from "@/utils/cn";
import { ChannelCards } from "./ChannelCards";
import { Channels } from "./Channels";
import { Faq } from "./Faq";
import { Features } from "./Features";
import { FinalCta } from "./FinalCta";
import { fontVariables } from "./fonts";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import styles from "./landing.module.css";
import { Nav } from "./Nav";
import { SelfHost } from "./SelfHost";

/**
 * The public landing page at "/".
 *
 * Layout follows todesktop.com's design language: a dark sky hero that brightens through blue into white, a live
 * product window under three step tabs, a dock-driven channel tour, grey
 * feature cards with live vignettes, a plans-style self-host section, a
 * two-column FAQ, a closing sky card and a quiet footer.
 *
 * Every product visual is a real AgentSDR component on sample data shaped by
 * the real contracts (./data). `styles.page` pins the AlignUI tokens to their
 * light values, so the page looks the same whatever theme a visitor picked in
 * the app.
 */
export default function LandingPage() {
  return (
    <div className={cn(styles.page, fontVariables, "relative min-h-screen w-full overflow-x-clip font-sans antialiased")}>
      <a href="#main" className="sr-only z-50 rounded-full bg-white px-4 py-2 text-[14px] text-[#141414] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <div className={styles.sky}>
          <Hero />
        </div>
        <Channels />
        <ChannelCards />
        <Features />
        <SelfHost />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
