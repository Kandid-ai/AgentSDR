import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { RiCheckboxCircleFill, RiLoader4Line } from "@remixicon/react";
import { EASE, GLIDE, keys, pop, tw } from "../kit/motion";
import { At, Canvas, Hand, Type } from "./kit";

/**
 * After "Find leads": the agent adds the people it found to a Tables
 * workbook, one row at a time; the hand adds an enrichment column, picks
 * Apollo, and the work emails fill in down the column — Clay-style
 * enrichment, built in.
 *
 * Every frame is a screenshot of the app's real workbook (src/screens/leads,
 * via tools/shots.ts): raw, the Add column menu, the enrichment catalog, the
 * Apollo dialog, enriched. Positions below are in screenshot pixels (1800 × 1020).
 */

export const TABLES = 138;


const ROW0 = 182; // first data row's top
const ROW_H = 33.67;
const ROWS = 10;
const EMAIL = { x: 922, w: 206 };
const VERIFIED = { x: 1128, w: 207 };
const TABLE = { x: 58, w: 1650 };

// Four seconds, three beats with room to read: the last five leads land
// one by one, a provider is picked, then the email column and the
// verified column each fill in one sweep.
const PRESENT = 5; // rows already in the table when the scene opens
const T = {
  rowsAt: 6,
  rowEvery: 6,
  catalog: 36,
  apollo: 56,
  findEmail: 78,
  enriched: 84,
  fillAt: 88,
  fillEvery: 1,
  verifyAt: 100,
  done: 114,
} as const;

function Shot({ name, show }: { name: string; show: number }) {
  if (show <= 0) return null;
  return <Img src={staticFile(`shots/screens/${name}.png`)} className="absolute left-0 top-0" style={{ width: 1800, height: 1020, opacity: show }} />;
}

function Spinner({ f }: { f: number }) {
  return <RiLoader4Line style={{ width: 16, height: 16, transform: `rotate(${f * 16}deg)`, color: "#99a0ae" }} />;
}

/** The workbook, layer by layer, in screenshot coordinates. */
function Workbook({ f }: { f: number }) {
  const catalog = tw(f, T.catalog, 4) * (1 - tw(f, T.enriched, 4));
  const enriched = tw(f, T.enriched, 5);
  const added = (i: number) => (i < PRESENT ? -100 : T.rowsAt + (i - PRESENT) * T.rowEvery);
  const filled = (i: number) => T.fillAt + i * T.fillEvery;
  return (
    <div className="relative overflow-hidden rounded-[20px] bg-white" style={{ width: 1800, height: 1020, boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 40px 90px -40px rgb(14 18 27 / 0.35)" }}>
      <Shot name="workbook-raw" show={1} />
      <Shot name="workbook-enriched" show={enriched} />
      {/* Rows not yet added are blank; each lands with a soft blue flash. */}
      {Array.from({ length: ROWS }, (_, i) => {
        const top = ROW0 + i * ROW_H;
        const on = tw(f, added(i), 6);
        const flash = Math.max(0, 1 - Math.max(0, f - added(i)) / 16);
        return (
          <div key={i}>
            <div className="absolute bg-white" style={{ left: 0, top, width: 1800, height: ROW_H + 1, opacity: 1 - on }} />
            {f >= added(i) && flash > 0 && <div className="absolute" style={{ left: TABLE.x, top, width: TABLE.w, height: ROW_H, background: `rgb(51 92 255 / ${0.12 * flash})` }} />}
          </div>
        );
      })}
      {/* Enrichment, column by column: the whole Work email column is looked up
          at once and sweeps in top to bottom, then Email verified does the same. */}
      {f >= T.enriched &&
        Array.from({ length: ROWS }, (_, i) => {
          const top = ROW0 + i * ROW_H + 1;
          const eAt = filled(i);
          const vAt = T.verifyAt + i * T.fillEvery;
          const e = tw(f, eAt, 4);
          const v = tw(f, vAt, 4);
          const ef = Math.max(0, 1 - Math.max(0, f - eAt) / 12);
          const vf = Math.max(0, 1 - Math.max(0, f - vAt) / 12);
          return (
            <div key={i}>
              <div className="absolute flex items-center gap-2 bg-white pl-3 text-[15px] text-[#99a0ae]" style={{ left: EMAIL.x + 1, top, width: EMAIL.w - 2, height: ROW_H - 2, opacity: 1 - e }}>
                <Spinner f={f} /> Apollo…
              </div>
              <div className="absolute flex items-center gap-2 bg-white pl-3 text-[15px] text-[#99a0ae]" style={{ left: VERIFIED.x + 1, top, width: VERIFIED.w - 2, height: ROW_H - 2, opacity: 1 - v }}>
                {f >= eAt && <><Spinner f={f} /> Verifying…</>}
              </div>
              {e > 0 && ef > 0 && <div className="absolute" style={{ left: EMAIL.x, top, width: EMAIL.w, height: ROW_H - 2, background: `rgb(31 193 107 / ${0.16 * ef})` }} />}
              {v > 0 && vf > 0 && <div className="absolute" style={{ left: VERIFIED.x, top, width: VERIFIED.w, height: ROW_H - 2, background: `rgb(31 193 107 / ${0.16 * vf})` }} />}
            </div>
          );
        })}
      <Shot name="workbook-enrich-catalog" show={catalog} />
      {/* The provider pick, ringed as it is clicked; Find work email is a plain click. */}
      <PickRing f={f} at={T.apollo} x={443} y={322} w={214} h={46} until={T.findEmail} />
    </div>
  );
}

/* The table, on the right, in its own window; the camera moves inside it. */
const CARD = { x: 700, y: 200, w: 1140, h: 780 };
const BASE = CARD.w / 1800;

/** Where the view inside the card looks (screenshot px) and how close, over time. */
const VIEW: readonly (readonly [frame: number, x: number, y: number, z: number])[] = [
  [0, 560, 380, 1.9],
  [32, 560, 380, 1.9],
  [44, 900, 500, 1.75],
  [80, 900, 500, 1.75],
  [88, 1010, 360, 1.9],
  [114, 1010, 360, 1.9],
  [124, 900, 380, 1.3],
];

function viewAt(frame: number) {
  const x = keys(frame, VIEW.map(([f, v]) => [f, v] as const));
  const y = keys(frame, VIEW.map(([f, , v]) => [f, v] as const));
  const z = keys(frame, VIEW.map(([f, , , v]) => [f, v] as const));
  const k = BASE * z;
  return { k, tx: CARD.w / 2 - x * k, ty: CARD.h / 2 - y * k };
}
/** A screenshot point, in the card's own coordinates, at a frame. */
function inCard(frame: number, px: number, py: number) {
  const v = viewAt(frame);
  return [v.tx + px * v.k, v.ty + py * v.k] as const;
}

const STEPS = [
  { at: 0, until: T.catalog, text: "The agent adds the leads it found" },
  { at: T.catalog, until: T.enriched, text: "You pick a provider — any of them" },
  { at: T.enriched, until: T.done, text: "Emails found, then verified — whole column" },
];
const PROVIDERS = ["apollo.io", "findymail.com", "hunter.io", "leadmagic.io", "lusha.com", "zerobounce.net"];

export function TablesScene() {
  const f = useCurrentFrame();
  const a = tw(f, 0, 14, EASE);
  const out = tw(f, TABLES - 12, 12, GLIDE);
  const v = viewAt(f);
  const hand = (fr: number, px: number, py: number) => [fr, ...inCard(fr, px, py)] as const;
  return (
    <Canvas>
      <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 12}px)` : undefined }}>
        {/* Left: the message — Clay's job, built in. */}
        <div className="absolute" style={{ left: 110, top: 270, width: 540 }}>
          <div className="flex items-center gap-3">
            <ClayLogo f={f} />
            <Type text="Clay enrichment," start={4} size={52} every={2} align="left" lineHeight={1.15} />
          </div>
          <div className="mt-1">
            <Type text="built into AgentSDR." start={10} size={52} every={2} align="left" lineHeight={1.15} />
          </div>
          <div className="mt-10 space-y-3">
            {STEPS.map((st, i) => {
              const on = f >= st.at && f < st.until;
              const done = f >= st.until;
              const k = tw(f, 4 + i * 2, 6);
              return (
                <div key={st.text} style={{ opacity: k }}>
                  <div className="flex items-center gap-4 rounded-2xl px-4 py-3.5" style={{ background: on ? "#ffffff" : "transparent", boxShadow: on ? "0 0 0 1px rgb(14 18 27 / 0.08), 0 12px 28px -14px rgb(14 18 27 / 0.3)" : "none" }}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold" style={{ background: done ? "#1fc16b" : on ? "#335cff" : "#ececea", color: done || on ? "#fff" : "#8a8a8a" }}>
                      {done ? <RiCheckboxCircleFill style={{ width: 22, height: 22 }} /> : i + 1}
                    </span>
                    <span className="text-[22px] tracking-[-0.01em]" style={{ color: on || done ? "#141414" : "#8a8a8a" }}>
                      {st.text}
                    </span>
                  </div>
                  {i === 1 && (
                    <div className="mt-2 flex gap-2 pl-[68px]" style={{ opacity: tw(f, 8, 8) }}>
                      {/* Grey until this step is on, then each lights up in its own colour. */}
                      {PROVIDERS.map((d, j) => {
                        const lit = tw(f, T.catalog + 2 + j * 2, 6);
                        const k = pop(f, T.catalog + 2 + j * 2, 240, 14);
                        return (
                          <span key={d} className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-white" style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08)", transform: `scale(${f >= T.catalog ? 0.85 + 0.15 * k : 1})` }}>
                            <Img src={staticFile(`integrations/${d}.png`)} style={{ width: 28, height: 28, objectFit: "contain", filter: `grayscale(${1 - lit})`, opacity: 0.45 + 0.55 * lit }} />
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: the line, then the real workbook. */}
        <At x={CARD.x + CARD.w / 2} y={128}>
          {f < T.catalog ? (
            <Type text="It finds the people you sell to." start={0} size={48} every={2} out={T.catalog - 4} outDur={4} />
          ) : f < T.done ? (
            <Type text="Then enriches them, from any provider." start={T.catalog} size={48} every={2} out={T.done - 4} outDur={4} />
          ) : (
            <Type text="Every lead, ready to reach." start={T.done} size={48} every={2} />
          )}
        </At>
        <div
          className="absolute overflow-hidden rounded-[24px] bg-white"
          style={{
            left: CARD.x,
            top: CARD.y,
            width: CARD.w,
            height: CARD.h,
            opacity: a,
            transform: `translateY(${(1 - a) * 60}px)`,
            boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 40px 90px -40px rgb(14 18 27 / 0.35)",
          }}
        >
          <div className="absolute left-0 top-0" style={{ width: 1800, height: 1020, transformOrigin: "0 0", transform: `translate(${v.tx}px, ${v.ty}px) scale(${v.k})` }}>
            <Workbook f={f} />
          </div>
          <Hand
            show={[T.catalog + 10, T.enriched + 2]}
            clicks={[T.apollo, T.findEmail]}
            path={[
              hand(T.catalog + 10, 1100, 760),
              hand(T.apollo - 2, 520, 348),
              hand(T.apollo + 6, 520, 348),
              hand(T.findEmail - 2, 790, 512),
            ]}
            size={72}
          />
        </div>
      </AbsoluteFill>
    </Canvas>
  );
}

/** A blue ring around something in the screenshot as it is clicked. */
function PickRing({ f, at, until, x, y, w, h }: { f: number; at: number; until: number; x: number; y: number; w: number; h: number }) {
  const a = tw(f, at - 4, 5) * (1 - tw(f, until, 4));
  if (a <= 0) return null;
  const k = pop(f, at, 260, 14);
  return (
    <div
      className="absolute rounded-[12px]"
      style={{ left: x, top: y, width: w, height: h, opacity: a, transform: `scale(${0.96 + 0.04 * k})`, boxShadow: "0 0 0 3px #335cff, 0 0 0 9px rgb(51 92 255 / 0.18)", background: "rgb(51 92 255 / 0.06)" }}
    />
  );
}


/** Clay's logo, popping in at the start of the headline. */
function ClayLogo({ f }: { f: number }) {
  const k = pop(f, 2, 190, 14);
  return <Img src={staticFile("landing/tools/clay.png")} style={{ width: 58, height: 58, objectFit: "contain", transform: `scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 1.4) }} />;
}
