import { ChannelCards } from "./ChannelCards";
import { Channels } from "./Channels";
import { Faq } from "./Faq";
import { Features } from "./Features";
import { FinalCta } from "./FinalCta";
import { Hero } from "./Hero";
import styles from "./landing.module.css";
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
 * the real contracts (./data). The nav, footer and light-theme pinning come
 * from the marketing layout (src/app/(marketing)/layout.tsx).
 */
export default function LandingPage() {
  return (
    <>
      <div className={styles.sky}>
        <Hero />
      </div>
      <Channels />
      <ChannelCards />
      <Features />
      <SelfHost />
      <Faq />
      <FinalCta />
    </>
  );
}
