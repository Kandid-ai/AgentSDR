import type { ReactNode } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { RiCheckboxCircleFill, RiCheckLine, RiPhoneFill, RiSendPlane2Fill, RiUserAddLine } from "@remixicon/react";
import { EASE, GLIDE, pop, tw } from "../kit/motion";
import { At, Canvas, display, Hand, INK, mix, Type } from "./kit";
import { shadePose, ShadeTile } from "./shade";
import { Card } from "./kit";
import { CallCard, EmailCard, InboxList, LiThread, NoteCard, ProfileCard, SequenceCard, SummaryCard, WaChat } from "./ui";



/* ================================================================== */
/* Three channels. One platform.                                       */
/* ================================================================== */

export const THREE = 84;

/** The channels' own marks, each on the same white app tile. */
const BRANDS = [
  { key: "gmail", src: "brands/gmail.svg", inset: 0.6 },
  { key: "linkedin", src: "brands/linkedin.svg", inset: 0.62 },
  { key: "whatsapp", src: "brands/whatsapp.svg", inset: 0.66 },
] as const;

const TILE = 240;

/** The channel switch's tabs. */
/** The channels, in order. */
const CHANNELS = [
  { key: "email", label: "Email", src: "brands/gmail.svg" },
  { key: "linkedin", label: "LinkedIn", src: "brands/linkedin.svg" },
  { key: "whatsapp", label: "WhatsApp", src: "brands/whatsapp.svg" },
] as const;
const MERGE = 22;

function BrandTile({ src, inset, size }: { src: string; inset: number; size: number }) {
  return (
    <span
      className="flex items-center justify-center bg-white"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        boxShadow: "0 0 0 1px rgb(14 18 27 / 0.06), 0 2px 4px rgb(14 18 27 / 0.04), 0 28px 50px -22px rgb(14 18 27 / 0.3)",
      }}
    >
      <Img src={staticFile(src)} style={{ width: size * inset, height: size * inset, objectFit: "contain" }} />
    </span>
  );
}

/**
 * Gmail, LinkedIn and WhatsApp land side by side, each named as it lands;
 * then they collapse into the middle and AgentSDR bursts out of them —
 * Shade hops in the tile and keeps walking — on "One open-source platform."
 * Fast, and centred on the frame.
 */
export function ThreeChannels() {
  const f = useCurrentFrame();
  const out = tw(f, THREE - 8, 8, GLIDE);
  const merge = tw(f, MERGE, 9, (x) => x * x * (3 - 2 * x));
  const burst = pop(f, MERGE + 7, 210, 11);
  const ripple = tw(f, MERGE + 7, 22, EASE);
  // Shade: lands with a hop, then walks in place.
  const hop = f >= MERGE + 9 && f < MERGE + 19 ? Math.sin(((f - MERGE - 9) / 10) * Math.PI) : 0;
  const pose = shadePose(f >= MERGE + 19 ? "bounce" : undefined, f - MERGE - 19);
  return (
    <Canvas>
      <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 12}px)` : undefined }}>
        {/* The title, held while "One open-source platform." lands below */}
        <At y={225}>
          <Type text="Three channels." start={0} size={100} every={3} />
        </At>
        {/* The three channels */}
        {BRANDS.map((b, i) => {
          const k = pop(f, 1 + i * 4, 260, 15);
          const home = 960 + (i - 1) * 320;
          const x = home + (960 - home) * merge;
          const gone = tw(f, MERGE + 6, 4);
          return (
            <div key={b.key}>
              <div
                className="absolute"
                style={{
                  left: x,
                  top: 485,
                  transform: `translate(-50%, -50%) translateY(${(1 - k) * 70}px) rotate(${(i - 1) * 10 * merge}deg) scale(${(0.5 + 0.5 * k) * (1 - 0.5 * merge)})`,
                  opacity: Math.min(1, k * 1.8) * (1 - gone),
                  filter: merge > 0.2 ? `blur(${merge * 3}px)` : undefined,
                }}
              >
                <BrandTile src={b.src} inset={b.inset} size={TILE} />
              </div>
              <div className="absolute" style={{ left: home, top: 690, transform: "translate(-50%, -50%)", opacity: tw(f, 3 + i * 4, 5) * (1 - tw(f, MERGE - 2, 6)), filter: f > MERGE - 2 ? `blur(${tw(f, MERGE - 2, 6) * 8}px)` : undefined }}>
                <span className={`${display} text-[46px] font-medium tracking-[-0.02em]`} style={{ color: mix("#a3a3a3", INK, tw(f, 6 + i * 4, 6)) }}>
                  {CHANNELS[i].label}
                </span>
              </div>
            </div>
          );
        })}
        {/* AgentSDR, out of the three */}
        {f >= MERGE + 6 && (
          <>
            <At y={485}>
              <span className="block rounded-full" style={{ width: 620, height: 620, background: "radial-gradient(closest-side, rgb(51 92 255 / 0.22), rgb(51 92 255 / 0))", transform: `scale(${0.4 + 0.8 * ripple})`, opacity: Math.min(1, burst * 1.5) * (1 - 0.4 * ripple) }} />
            </At>
            <At y={485}>
              <div style={{ transform: `translateY(${-hop * 40}px) scale(${0.3 + 0.7 * burst})`, opacity: Math.min(1, burst * 2) }}>
                <ShadeTile size={TILE + 30} pose={pose} />
              </div>
            </At>
          </>
        )}
        {f >= MERGE + 10 && (
          <At y={755}>
            <OpenSourceLine f={f} start={MERGE + 10} />
          </At>
        )}
      </AbsoluteFill>
    </Canvas>
  );
}

/** "One open-source platform." — the word that matters in brand blue, underlined by hand. */
function OpenSourceLine({ f, start }: { f: number; start: number }) {
  const words: [string, string][] = [
    ["One", INK],
    ["open-source", "#335cff"],
    ["platform.", INK],
  ];
  const draw = tw(f, start + 10, 12, EASE);
  return (
    <div className={`${display} flex items-baseline gap-[0.28em] whitespace-nowrap text-[100px] font-medium tracking-[-0.03em]`}>
      {words.map(([w, color], i) => {
        const a = tw(f, start + i * 3, 6);
        return (
          <span key={w} className="relative inline-block" style={{ opacity: a, transform: `translateY(${(1 - a) * 0.15}em)`, filter: a < 1 ? `blur(${(1 - a) * 8}px)` : undefined, color: mix("#a3a3a3", color, tw(f, start + i * 3 + 2, 6)) }}>
            {w}
            {i === 1 && (
              <svg className="absolute left-0 top-[96%]" width="100%" height="22" viewBox="0 0 300 22" preserveAspectRatio="none" fill="none">
                <path d="M4 14 C 80 4, 200 2, 296 10" stroke="#335cff" strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/* Each channel                                                        */
/* ================================================================== */

/**
 * Two seconds a channel, after the agent beats of the reference film: the
 * channel's mark and name big, a collage of live panels that swings in in
 * 3D — the hero panel in front, two related ones behind it — then the one
 * action that matters lifts out of the panel, large; the hand clicks it,
 * it changes state, and a pill by the name confirms it. Every panel is a
 * live component (the app's own where it has one), so it stays crisp at
 * any size.
 */

export const PHASE = 60;
export const CHANNEL_TOUR = PHASE * 3;

const LIFT = 22; // the action lifts out
const PRESS = 36; // the hand presses it
const DONE = 40; // its new state, and the pill

type Story = {
  brand: number;
  name: string;
  pill: string;
  center: (t: number) => ReactNode;
  left: (t: number) => ReactNode;
  right: (t: number) => ReactNode;
  action: (t: number) => ReactNode;
};

const Sent = ({ children, tone = "#1fc16b" }: { children: ReactNode; tone?: string }) => (
  <span className="inline-flex h-[64px] items-center gap-3 rounded-[16px] px-7 text-[26px] font-semibold text-white" style={{ background: tone }}>
    {children}
  </span>
);

const STORIES: Story[] = [
  {
    brand: 0,
    name: "Email",
    pill: "Replied",
    center: (t) => (
      <Card>
        <InboxList t={t * 1.7} width={420} classifyAt={6} />
      </Card>
    ),
    left: (t) => (
      <Card>
        <EmailCard t={t} resolveAt={2} sendAt={999} />
      </Card>
    ),
    right: (t) => (
      <Card>
        <SequenceCard t={t * 2} doneAt={12} />
      </Card>
    ),
    action: (t) =>
      t < DONE ? (
        <span className="inline-flex h-[64px] items-center gap-3 rounded-[16px] bg-[#335cff] px-7 text-[26px] font-semibold text-white" style={{ boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.25)" }}>
          <RiSendPlane2Fill style={{ width: 28, height: 28 }} /> Approve & send
        </span>
      ) : (
        <Sent>
          <RiCheckLine style={{ width: 30, height: 30 }} /> Sent to Maya
        </Sent>
      ),
  },
  {
    brand: 1,
    name: "LinkedIn",
    pill: "Connected",
    center: (t) => (
      <Card>
        <ProfileCard t={t} connectAt={DONE} acceptedAt={DONE + 12} />
      </Card>
    ),
    left: (t) => (
      <Card>
        <NoteCard t={t * 2.6} typeAt={0} />
      </Card>
    ),
    right: (t) => (
      <Card>
        <LiThread t={t * 1.6 - 6} />
      </Card>
    ),
    action: (t) =>
      t < DONE ? (
        <span className="inline-flex h-[64px] items-center gap-3 rounded-full bg-[#0a66c2] px-8 text-[26px] font-semibold text-white">
          <RiUserAddLine style={{ width: 28, height: 28 }} /> Connect
        </span>
      ) : (
        <Sent tone="#0a66c2">
          <RiCheckLine style={{ width: 30, height: 30 }} /> Invitation sent
        </Sent>
      ),
  },
  {
    brand: 2,
    name: "WhatsApp",
    pill: "Call recorded",
    center: (t) => (
      <Card>
        <WaChat t={t * 1.4 + 6} width={440} />
      </Card>
    ),
    left: (t) => (
      <Card>
        <CallCard t={t * 2} width={400} />
      </Card>
    ),
    right: (t) => (
      <Card>
        <SummaryCard t={t * 1.6} width={420} />
      </Card>
    ),
    action: (t) =>
      t < DONE ? (
        <Sent>
          <RiPhoneFill style={{ width: 28, height: 28 }} /> Call
        </Sent>
      ) : (
        <span className="inline-flex h-[64px] items-center gap-3 rounded-[16px] bg-[#0b3b2c] px-7 text-[26px] font-semibold tabular-nums text-white">
          <span className="size-3.5 rounded-full bg-[#fb3748]" style={{ opacity: 0.5 + 0.5 * Math.abs(Math.sin(t / 3)) }} />
          0:{String(Math.min(59, Math.floor((t - DONE) / 3))).padStart(2, "0")} · Recording
        </span>
      ),
  },
];

/** Header: the channel's mark and name, big; the pill once the action lands. */
function Header({ story, t, exit }: { story: Story; t: number; exit: number }) {
  const a = tw(t, 0, 7, EASE);
  const b = exit;
  const brand = BRANDS[story.brand];
  const pk = pop(t, DONE + 2, 240, 15);
  return (
    <div className="flex items-center gap-7" style={{ opacity: a * (1 - b), transform: `translateY(${(1 - a) * 20 - b * 16}px)`, filter: a < 1 || b > 0 ? `blur(${(1 - a + b) * 8}px)` : undefined }}>
      <BrandTile src={brand.src} inset={brand.inset} size={112} />
      <span className={`${display} text-[92px] font-medium tracking-[-0.03em] text-[#4a4a4a]`}>{story.name}</span>
      {t >= DONE + 2 && (
        <span
          className={`${display} ml-3 inline-flex h-[78px] items-center gap-3.5 rounded-full bg-white pl-8 pr-5 text-[38px] font-medium text-[#141414]`}
          style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 12px 26px -12px rgb(14 18 27 / 0.3)", transform: `scale(${0.6 + 0.4 * pk})`, transformOrigin: "0 50%", opacity: Math.min(1, pk * 1.5) }}
        >
          {story.pill}
          <RiCheckboxCircleFill style={{ width: 40, height: 40, color: "#1fc16b" }} />
        </span>
      )}
    </div>
  );
}

export function ChannelTour() {
  const f = useCurrentFrame();
  const c = Math.min(STORIES.length - 1, Math.floor(f / PHASE));
  const t = f - c * PHASE;
  const story = STORIES[c];
  const last = c === STORIES.length - 1;
  // The collage swings in from the right, settles, and swings out to the left.
  const a = tw(t, 0, 10, EASE);
  const b = last ? tw(t, PHASE - 8, 8, GLIDE) : tw(t, PHASE - 7, 7, GLIDE);
  const ry = 30 * (1 - a) - 26 * b + (-4 + 6 * (1 - tw(t, 0, PHASE)));
  const rx = 10 - 4 * a;
  const x = 420 * (1 - a) - 520 * b;
  // The action lifts out of the panel, the hand presses it.
  const lift = pop(t, LIFT, 200, 14);
  const press = t >= PRESS && t < PRESS + 5 ? 0.93 : 1;
  const ax = 1330;
  const ay = 380;
  return (
    <Canvas>
      <At y={130}>
        <Header story={story} t={t} exit={b} />
      </At>
      <div className="absolute left-0 top-0" style={{ width: 1920, height: 1080, perspective: 2400, opacity: Math.min(1, a * 1.4) * (1 - b) }}>
        <div className="absolute left-0 top-0" style={{ width: 1920, height: 1080, transformStyle: "preserve-3d", transform: `translateX(${x}px) rotateY(${ry}deg) rotateX(${rx}deg)`, transformOrigin: "960px 640px" }}>
          {/* Behind: two related panels */}
          <div className="absolute" style={{ left: 380, top: 640, transform: "translate(-50%, -50%) translateZ(-200px) scale(1.6) rotateZ(-2deg)", opacity: 0.9 }}>
            {story.left(t)}
          </div>
          <div className="absolute" style={{ left: 1560, top: 630, transform: "translate(-50%, -50%) translateZ(-180px) scale(1.6) rotateZ(2deg)", opacity: 0.9 }}>
            {story.right(t)}
          </div>
          {/* In front: the hero panel */}
          <div className="absolute" style={{ left: 960, top: 670, transform: "translate(-50%, -50%) scale(2)", filter: "drop-shadow(0 40px 60px rgb(14 18 27 / 0.22))" }}>
            {story.center(t)}
          </div>
        </div>
      </div>
      {/* The action, lifted out large */}
      {t >= LIFT && (
        <div
          className="absolute"
          style={{
            left: ax,
            top: ay,
            transform: `translate(-50%, -50%) translateY(${(1 - lift) * 40}px) scale(${(0.6 + 0.4 * lift) * press * 1.6})`,
            opacity: Math.min(1, lift * 1.5) * (1 - b),
            filter: "drop-shadow(0 30px 40px rgb(14 18 27 / 0.35))",
          }}
        >
          {story.action(t)}
        </div>
      )}
      <Hand
        show={[c * PHASE + LIFT + 4, c * PHASE + PHASE - 8]}
        clicks={[c * PHASE + PRESS]}
        path={[
          [c * PHASE + LIFT + 4, ax + 200, ay + 260],
          [c * PHASE + PRESS - 2, ax + 70, ay + 30],
        ]}
        size={96}
      />
    </Canvas>
  );
}
