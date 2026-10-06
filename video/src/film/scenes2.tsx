import { AbsoluteFill, useCurrentFrame } from "remotion";
import { between, EASE, GLIDE, tw } from "../kit/motion";
import { At, Canvas, Type } from "./kit";
import {
  IntegrationCard,
} from "./ui";





const ROW_A: [string, string, string, boolean?][] = [
  ["integrations/apollo.io.png", "Apollo.io", "People and company search", true],
  ["integrations/findymail.com.png", "Findymail", "Verified work emails"],
  ["integrations/hunter.io.png", "Hunter", "Email finder and verifier", true],
  ["integrations/leadmagic.io.png", "LeadMagic", "Emails, mobiles and profiles"],
  ["integrations/lusha.com.png", "Lusha", "Direct dials and emails"],
  ["integrations/fullenrich.com.png", "FullEnrich", "Waterfall over 15 providers"],
  ["integrations/icypeas.com.png", "Icypeas", "Email search and scraping"],
  ["integrations/rocketreach.co.png", "RocketReach", "Contact lookup"],
];
const ROW_B: [string, string, string, boolean?][] = [
  ["integrations/zerobounce.net.png", "ZeroBounce", "Verify before you send", true],
  ["integrations/millionverifier.com.png", "MillionVerifier", "Bulk email verification"],
  ["integrations/snov.io.png", "Snov.io", "Prospect finder"],
  ["integrations/unipile.com.png", "Unipile", "LinkedIn and WhatsApp accounts", true],
  ["integrations/openrouter.ai.png", "OpenRouter", "Your own model key", true],
  ["integrations/semrush.com.png", "Semrush", "Company traffic and SEO"],
  ["integrations/similarweb.com.png", "Similarweb", "Web traffic insights"],
  ["integrations/cleanlist.ai.png", "Cleanlist", "List cleaning"],
  ["integrations/contactout.com.png", "ContactOut", "Emails from LinkedIn"],
];

function Marquee({ items, y, speed, offset }: { items: typeof ROW_A; y: number; speed: number; offset: number }) {
  const f = useCurrentFrame();
  const row = [...items, ...items];
  return (
    <div className="absolute flex gap-5" style={{ top: y, left: offset + f * speed }}>
      {row.map(([src, name, detail, connected], i) => (
        <IntegrationCard key={i} src={src} name={name} detail={detail} connected={connected} />
      ))}
    </div>
  );
}

export function Integrations() {
  const f = useCurrentFrame();
  const a = tw(f, 0, 10);
  const out = tw(f, 76, 12, GLIDE);
  return (
    <Canvas>
      <AbsoluteFill style={{ opacity: a * (1 - out), filter: out ? `blur(${out * 12}px)` : undefined }}>
        <Marquee items={ROW_A} y={190} speed={-5} offset={-200} />
        <Marquee items={ROW_A.slice().reverse()} y={330} speed={4} offset={-2400} />
        <At y={540}>
          <Type text="And every data provider you already use." start={6} size={68} every={3} />
        </At>
        <Marquee items={ROW_B} y={660} speed={-4} offset={-500} />
        <Marquee items={ROW_B.slice().reverse()} y={800} speed={5} offset={-2600} />
      </AbsoluteFill>
    </Canvas>
  );
}

/* ================================================================== */
/* 9 · And when they reply — zoom through                            */
/* ================================================================== */

export const SWOOSH = 66;

export function Swoosh() {
  const f = useCurrentFrame();
  const draw = tw(f, 0, 26, EASE);
  const zoom = tw(f, 40, 24, (x) => x * x * x);
  return (
    <Canvas>
      <AbsoluteFill style={{ transform: `scale(${1 + zoom * 0.6})` }}>
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" fill="none" style={{ position: "absolute" }}>
          <path d="M-120 1180 C 260 760, 420 980, 700 760 S 1040 520, 1180 650 S 1420 520, 1560 230" stroke="#ecebe7" strokeWidth="120" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
          <path d="M1400 230 L1600 150 L1610 360" stroke="#ecebe7" strokeWidth="110" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: tw(f, 20, 8) }} />
        </svg>
      </AbsoluteFill>
      <At y={between(f, 0, 30, 560, 540)}>
        <div style={{ transform: `scale(${1 + zoom * 7})`, opacity: 1 - tw(f, 58, 6) }}>
          <Type text={"And when\nthey reply"} start={4} size={84} every={3} />
        </div>
      </At>
    </Canvas>
  );
}
