import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { RiArrowRightLine } from "@remixicon/react";
import { AgentMark, AppIcon } from "@/components/brand/Logo";
import { TOOLS } from "@/components/landing/data/tools";
import { Camera } from "../kit/ui";
import { between, EASE, GLIDE, keys, pop, tw, typed } from "../kit/motion";
import { At, Canvas, display, DepthField, Hand, INK, mix, Show, Type } from "./kit";
import { Shade, shadePose, ShadeTile } from "./shade";

/* ================================================================== */
/* 1 · Hook — "This open-source agent will replace your entire sales stack." */
/* ================================================================== */

export const HOOK = 200;

/**
 * The beats of "will replace your entire sales stack", in Hook frames. The
 * line reads in full first; then the camera moves in on the tab strip and a
 * cursor closes the tools one at a time (each slides under it, active, its
 * address in the bar — the way Chrome closes tabs), AgentSDR opens as the
 * one tab left, the camera moves in on it, and the scene fades from there.
 */
export const STACK = {
  barIn: 44,
  tabsAt: 46,
  tabEvery: 3,
  bottomLine: 64,
  zoomIn: 90,
  zoomed: 104,
  click: 108,
  clickEvery: 8,
  ours: 158,
  oursZoom: 160,
  oursZoomed: 174,
  out: 188,
} as const;
const STACK_CLICKS = [0, 1, 2, 3, 4, 5].map((k) => STACK.click + k * STACK.clickEvery);

export function Hook() {
  const f = useCurrentFrame();
  // The mark behind "This open-source agent": huge and pale, settling, then gone.
  const markK = between(f, 0, 30, 1.25, 1, EASE);
  const markOut = tw(f, 34, 10);
  const shrink = tw(f, 26, 12, GLIDE);
  return (
    <Canvas>
      {f < 46 && (
        <>
          <At y={470}>
            <div style={{ color: MARK_FILL, opacity: tw(f, 0, 10) * (1 - markOut), transform: `scale(${markK + markOut * 0.3})` }}>
              <AgentMark className="h-[400px] w-auto" />
            </div>
          </At>
          <At y={between(f, 26, 12, 520, 600, GLIDE)}>
            <div style={{ transform: `scale(${1 - shrink * 0.45})`, opacity: 1 - tw(f, 38, 8) }}>
              <Type text="This open-source agent" start={2} size={112} every={5} />
            </div>
          </At>
        </>
      )}
      {f >= 40 && <ReplaceStack f={f} />}
    </Canvas>
  );
}

/** Mark colour: the pale beige of the reference's ghost, in our blue family. */
const MARK_FILL = "#e3e8f6";

// Where things sit on the canvas (the browser is 1500 wide, centred, its tab strip at y≈456).
const TAB_X0 = 330;
const TAB_Y = 456;
const CLOSE_DX = 188; // a tab's ✕ from its left edge

export const HOOK_CLICKS = STACK_CLICKS;

function ReplaceStack({ f }: { f: number }) {
  const S = STACK;
  const barIn = tw(f, S.barIn, 14, GLIDE);
  const out = tw(f, S.out, 12, GLIDE);
  // The lines step back while the camera is on the tabs.
  const dim = tw(f, S.zoomIn, 14);
  // … and leave entirely for the close-up on ours.
  const gone = tw(f, S.oursZoom, 10);
  const lines = (1 - dim * 0.75) * (1 - gone);
  const oursX = TAB_X0 + 230;
  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: out > 0 ? `blur(${out * 16}px)` : undefined, transform: `scale(${1 + out * 0.25})` }}>
      <Camera
        shots={[
          [S.zoomIn, 960, 540, 1],
          // In on the left of the strip, where the cursor works.
          [S.zoomed, 700, 470, 1.8],
          [S.oursZoom, 700, 470, 1.8],
          [S.oursZoomed, oursX, 470, 2.4],
        ]}
      >
        <div style={{ opacity: lines }}>
          <At y={between(f, 44, 14, 470, 310, GLIDE)}>
            <Type text="Will replace your" start={40} size={64} every={4} />
          </At>
        </div>
        {/* The browser: a tab for each tool, then one. */}
        <At y={between(f, 44, 14, 1200, 480, GLIDE)}>
          <div style={{ opacity: barIn }}>
            <Browser f={f} />
          </div>
        </At>
        <div style={{ opacity: lines }}>
          <At y={680}>
            <div className="relative">
              <Type text="Entire sales stack" start={S.bottomLine} size={96} every={4} />
              <Scribble t={f - S.bottomLine - 16} />
            </div>
          </At>
        </div>
        {/* The cursor that closes them: every tab slides under it in turn. */}
        <Hand
          size={46}
          path={[
            [S.zoomIn + 6, 1180, 760],
            [STACK_CLICKS[0] - 4, TAB_X0 + CLOSE_DX, TAB_Y],
            [STACK_CLICKS[5] + 6, TAB_X0 + CLOSE_DX, TAB_Y],
            [S.ours + 10, 760, 700],
          ]}
          clicks={STACK_CLICKS}
          show={[S.zoomIn + 6, S.ours + 2]}
        />
      </Camera>
    </AbsoluteFill>
  );
}

/** The tools AgentSDR replaces, as browser tabs — a few, so each one reads. */
const STACK_TABS: { name: string; host: string }[] = [
  { name: "Apollo.io", host: "app.apollo.io" },
  { name: "Clay", host: "app.clay.com" },
  { name: "Instantly", host: "app.instantly.ai" },
  { name: "lemlist", host: "app.lemlist.com" },
  { name: "HeyReach", host: "app.heyreach.io" },
  { name: "HubSpot", host: "app.hubspot.com" },
];
const TAB_W = 212;

/**
 * A browser: traffic lights in their own corner, a row of tabs (one per
 * tool), and the address bar under them. Each click closes the active (first)
 * tab; the next slides into its place and becomes active, its address in the
 * bar. When the last is gone, a single AgentSDR tab opens.
 */
function Browser({ f }: { f: number }) {
  const tools = STACK_TABS.map((t) => ({ ...t, tool: TOOLS.find((x) => x.name === t.name)! }));
  // A clicked tab's contents fade first (so its ✕ and name never squash), then its slot
  // closes and the next tab slides under the cursor — and only then becomes active.
  const fade = (i: number) => tw(f, STACK_CLICKS[i] + 1, 3);
  const close = (i: number) => tw(f, STACK_CLICKS[i] + 2, 5, GLIDE);
  const active = STACK_CLICKS.filter((_, i) => close(i) >= 0.75).length;
  const ours = pop(f, STACK.ours, 200, 16);
  const url = active < tools.length ? tools[active].host : f >= STACK.ours ? "agentsdr.ai" : "";
  return (
    <div className="w-[1500px] overflow-hidden rounded-[24px] bg-[#f1f1f0] text-left" style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.07), 0 30px 60px -30px rgb(14 18 27 / 0.28)" }}>
      {/* Tab row */}
      <div className="flex h-[68px] items-end gap-6 pl-7 pr-7">
        <div className="mb-[22px] flex shrink-0 gap-2.5">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="size-[16px] rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1 items-end">
          {tools.map(({ name, tool }, i) => {
            const k = pop(f, STACK.tabsAt + i * STACK.tabEvery, 220, 18);
            const c = close(i);
            const gone = fade(i);
            // Active: the first tab still open — or the one just clicked, while it fades.
            const on = i === active || (i < active + 1 && gone > 0 && c < 0.75);
            // The ✕ lights up under the cursor just before the click.
            const hover = i === active && f >= STACK_CLICKS[i] - 3 && f <= STACK_CLICKS[i];
            return (
              <span
                key={name}
                className="flex h-[52px] shrink-0 items-center gap-3 overflow-hidden rounded-t-[14px] px-4"
                style={{
                  width: TAB_W * (1 - c),
                  paddingInline: 16 * (1 - c),
                  marginRight: 4 * (1 - c),
                  background: on ? `rgb(255 255 255 / ${1 - gone})` : "transparent",
                  opacity: Math.min(1, k * 1.4),
                  transform: `translateY(${(1 - k) * 18}px)`,
                }}
              >
                <span className="flex shrink-0 items-center gap-3" style={{ width: TAB_W - 32, opacity: 1 - gone }}>
                  <Img src={staticFile(tool.src.replace(/^\//, ""))} style={{ width: 26, height: 26, objectFit: "contain", borderRadius: 6, flexShrink: 0 }} />
                  <span className="min-w-0 flex-1 truncate text-[19px]" style={{ color: on ? "#141414" : "#3a3a3a" }}>
                    {name}
                  </span>
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[16px]" style={{ color: hover ? "#3a3a3a" : "#a0a0a0", background: hover ? "#e6e6e4" : "transparent" }}>
                    ✕
                  </span>
                </span>
              </span>
            );
          })}
          {/* Ours: one tab where there were six. */}
          {f >= STACK.ours - 1 && (
            <span className="absolute bottom-0 left-0 flex h-[52px] items-center gap-3 rounded-t-[14px] bg-white px-4" style={{ width: TAB_W, opacity: Math.min(1, ours * 1.4), transform: `translateY(${(1 - ours) * 18}px)` }}>
              <AppIcon small className="size-[26px]" />
              <span className="flex-1 text-[19px] font-medium text-[#141414]">AgentSDR</span>
              <span className="text-[16px] text-[#a0a0a0]">✕</span>
            </span>
          )}
        </div>
      </div>
      {/* Address bar */}
      <div className="flex h-[64px] items-center gap-5 bg-white px-7">
        <span className="flex gap-4 text-[22px] text-[#b4b4b4]">
          <span>←</span>
          <span>→</span>
        </span>
        <span className="flex h-[40px] flex-1 items-center gap-2.5 rounded-full bg-[#f1f1f0] px-5 text-[18px] text-[#6b6b6b]">
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
            <rect x="1" y="7" width="12" height="8" rx="2" fill="#9a9a9a" />
            <path d="M4 7V5a3 3 0 0 1 6 0v2" stroke="#9a9a9a" strokeWidth="1.6" />
          </svg>
          <span style={{ color: f >= STACK.ours ? "#141414" : undefined }}>{url}</span>
        </span>
      </div>
    </div>
  );
}

/** The hand-drawn double underline. */
function Scribble({ t }: { t: number }) {
  const p = tw(t, 0, 12, EASE);
  const q = tw(t, 6, 12, EASE);
  return (
    <svg className="absolute left-1/2 top-[92%] -translate-x-[52%]" width="300" height="40" viewBox="0 0 300 40" fill="none">
      <path d="M8 14 C 80 6, 200 4, 292 12" stroke="#4a4a4a" strokeWidth="6" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />
      <path d="M40 30 C 120 20, 210 20, 270 26" stroke="#4a4a4a" strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - q} />
    </svg>
  );
}

/* ================================================================== */
/* 2 · Meet AgentSDR — the open-source AI SDR                          */
/* ================================================================== */

export const MEET = 112;

/** A real screen of the app, as a screenshot card (public/shots — cropped from src/screens renders). */
function ScreenCard({ name }: { name: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-white" style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 30px 60px -24px rgb(14 18 27 / 0.3)" }}>
      <Img src={staticFile(`shots/${name}.png`)} style={{ display: "block", width: "100%" }} />
    </div>
  );
}

/** Real screens framing the title, close in and out of focus: nearer ones sharper, far ones softer. */
const FIELD = [
  { x: 380, y: 215, depth: 0.22, w: 720, node: <ScreenCard name="leads" /> },
  { x: 1545, y: 215, depth: 0.2, w: 760, node: <ScreenCard name="actions" /> },
  { x: 360, y: 905, depth: 0.3, w: 660, node: <ScreenCard name="pipeline" /> },
  { x: 1585, y: 915, depth: 0.28, w: 470, node: <ScreenCard name="linkedin-messages" /> },
  { x: 960, y: 95, depth: 0.6, w: 620, node: <ScreenCard name="email-campaign" /> },
  { x: 975, y: 985, depth: 0.5, w: 660, node: <ScreenCard name="workbook" /> },
];

export function Meet() {
  const f = useCurrentFrame();
  // Shade walks in from the left on its own bounce cycle and stops at centre.
  const walking = f < 40;
  const x = between(f, 10, 30, 380, 960, (t) => t);
  // A hop: up, the tile grows in behind it at the top, then it lands in the tile.
  const hop = f >= 40 && f < 52 ? Math.sin(((f - 40) / 12) * Math.PI) : 0;
  const tile = pop(f, 44, 170, 14);
  const inTile = tw(f, 44, 8);
  const lock = tw(f, 54, 12, GLIDE);
  const up = tw(f, 68, 12, GLIDE);
  const out = tw(f, 100, 12, GLIDE);
  const pose = shadePose(walking ? "bounce" : undefined, f - 10);
  const size = 170 - 30 * inTile; // the tile it lands in, settling to the logo's size
  return (
    <Canvas>
      <DepthField items={FIELD} start={0} zoom={f / 320} />
      <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 12}px)` : undefined }}>
        {f < 26 && (
          <At y={540}>
            <div style={{ opacity: 1 - tw(f, 16, 8), transform: `translateY(${-tw(f, 16, 8) * 30}px)` }}>
              <Type text="Meet" start={0} size={72} every={1} />
            </div>
          </At>
        )}
        {f >= 8 && f < 44 && (
          <div className="absolute" style={{ left: x, top: 540 - hop * 70, transform: "translate(-50%, -50%)", opacity: tw(f, 8, 6) }}>
            {/* On the canvas Shade is brand blue; it turns white as the tile forms. */}
            <Shade pose={pose} size={170 * 0.62} color="#335cff" />
          </div>
        )}
        {f >= 44 && (
          <At y={between(f, 68, 12, 540, 455, GLIDE)}>
            <div className="flex items-center" style={{ transform: `scale(${1 - up * 0.35})` }}>
              <span className="inline-flex" style={{ transform: `translateY(${-hop * 70}px) scaleX(${f >= 50 && f < 56 ? 1.06 : 1}) scaleY(${f >= 50 && f < 56 ? 0.92 : 1})`, transformOrigin: "50% 100%" }}>
                <ShadeTile size={size} pose={pose} tile={tile} mascot={mix("#335cff", "#ffffff", Math.min(1, tile * 1.4))} />
              </span>
              <span className="overflow-hidden" style={{ maxWidth: lock * 760, marginLeft: lock * 36 }}>
                <span className={`${display} block whitespace-nowrap text-[132px] font-medium leading-none tracking-[-0.04em]`} style={{ color: INK, transform: `translateX(${(1 - lock) * -40}px)` }}>
                  AgentSDR
                </span>
              </span>
            </div>
          </At>
        )}
        {f >= 70 && (
          <At y={600}>
            <Type text="Open-source AI SDR" start={70} size={120} every={4} />
          </At>
        )}
      </AbsoluteFill>
    </Canvas>
  );
}

/* ================================================================== */
/* 3 · Tell it who you sell to                                        */
/* ================================================================== */

export const ICP = 116;
const ICP_TEXT = "Heads of Sales at US SaaS, 50–200 people";

export function Icp() {
  const f = useCurrentFrame();
  const up = tw(f, 14, 12, GLIDE);
  const barIn = tw(f, 16, 12, GLIDE);
  const pressed = f >= 82;
  const out = tw(f, 100, 14, GLIDE);
  return (
    <Canvas>
      <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 14}px)` : undefined }}>
        <Camera
          shots={[
            [0, 960, 540, 1],
            [44, 960, 540, 1],
            [62, 1180, 600, 1.55],
            [78, 1380, 600, 1.75],
            [92, 1380, 600, 1.75],
            [104, 960, 540, 1.1],
          ]}
        >
          <At y={between(f, 14, 12, 540, 440, GLIDE)}>
            <div style={{ transform: `scale(${1 - up * 0.08})` }}>
              <Type text="Just tell it who you sell to" start={0} size={68} every={3} />
            </div>
          </At>
          <At y={between(f, 16, 12, 700, 600, GLIDE)}>
            <div className="flex h-[104px] w-[1240px] items-center gap-5 rounded-[30px] bg-white pl-8 pr-3" style={{ opacity: barIn, boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 24px 50px -24px rgb(14 18 27 / 0.3)" }}>
              <AppIcon small className="size-11" />
              <span className="flex-1 text-[34px] tracking-[-0.01em] text-[#141414]">
                {f < 24 ? <span className="text-[#b5b5b5]">Describe your ideal buyer…</span> : typed(ICP_TEXT, f, 24, 34)}
                {f >= 24 && f < 70 && <span className="ml-0.5 inline-block h-9 w-[3px] translate-y-1.5 bg-[#141414]" />}
              </span>
              <span
                className="inline-flex h-[78px] items-center gap-3 rounded-[24px] px-8 text-[30px] font-medium text-white"
                style={{ background: pressed ? "#6b6b6b" : "#141414", transform: f >= 80 && f < 86 ? "scale(0.96)" : undefined }}
              >
                Find leads <RiArrowRightLine className="size-8" />
              </span>
            </div>
          </At>
          <Hand show={[60, 104]} clicks={[82]} path={[[60, 1560, 820], [80, 1446, 612]]} size={84} />
        </Camera>
      </AbsoluteFill>
    </Canvas>
  );
}


export { keys, Show };
