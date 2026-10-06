import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { cn } from "@/utils/cn";
import { GLIDE, keys, pop, tw } from "../kit/motion";

/**
 * The film's building blocks. The look is a quiet product film: an
 * off-white canvas, one dark sans face, near-black type where each new word
 * arrives grey and blurred and settles to ink, and the product's own UI on
 * white cards — lifted, tilted, clicked by a hand cursor.
 */

export const W = 1920;
export const H = 1080;
export const BG = "#f7f7f6";
export const INK = "#141414";
export const SOFT = "#a3a3a3";
export const BLUE = "#335cff";
export const GREEN = "#1fc16b";

export const display = "font-[family-name:var(--font-landing-display)]";

/** The canvas: off-white with the faintest pool of light at the centre. */
export function Canvas({ children }: { children?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: BG }}>
      <AbsoluteFill style={{ background: "radial-gradient(60% 55% at 50% 45%, #ffffff 0%, rgb(255 255 255 / 0) 70%)" }} />
      {children}
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Type                                                                */
/* ------------------------------------------------------------------ */

/**
 * A line of type that writes itself in word by word: each word fades up out
 * of a blur in light grey, then settles to ink a few frames later. `\n`
 * breaks the line. `out` blurs the whole line away.
 */
export function Type({
  text,
  start,
  size = 64,
  every = 3,
  out,
  outDur = 8,
  className,
  style,
  weight = 500,
  align = "center",
  color = INK,
  tracking = -0.025,
  lineHeight = 1.12,
}: {
  text: string;
  start: number;
  size?: number;
  every?: number;
  out?: number;
  outDur?: number;
  className?: string;
  style?: CSSProperties;
  weight?: number;
  align?: "center" | "left";
  color?: string;
  tracking?: number;
  lineHeight?: number;
}) {
  const frame = useCurrentFrame();
  const gone = out === undefined ? 0 : tw(frame, out, outDur, GLIDE);
  let i = 0;
  return (
    <div
      className={cn(display, className)}
      style={{
        fontSize: size,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        lineHeight,
        textAlign: align,
        opacity: 1 - gone,
        filter: gone > 0 ? `blur(${gone * 14}px)` : undefined,
        ...style,
      }}
    >
      {text.split("\n").map((line, l) => (
        <div key={l} className="whitespace-nowrap">
          {line.split(" ").map((word, w) => {
            const at = start + i++ * every;
            const a = tw(frame, at, 7);
            const ink = tw(frame, at + 3, 9);
            return (
              <span key={w}>
                <span
                  className="inline-block"
                  style={{
                    opacity: a,
                    filter: a < 1 ? `blur(${(1 - a) * 9}px)` : undefined,
                    transform: `translateY(${(1 - a) * 0.12}em)`,
                    color: mix(SOFT, color, ink),
                  }}
                >
                  {word}
                </span>
                {w < line.split(" ").length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Mix two #rrggbb colours. */
export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(" ")})`;
}

/** Centre something on the canvas at (x, y). */
export function At({ x = W / 2, y = H / 2, children, style }: { x?: number; y?: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="absolute" style={{ left: x, top: y, transform: "translate(-50%, -50%)", ...style }}>
      {children}
    </div>
  );
}

/** Fade + scale + blur in at `start`, out at `end`. */
export function Show({ start, end, children, from = 0.94, style, dur = 10 }: { start: number; end?: number; children: ReactNode; from?: number; style?: CSSProperties; dur?: number }) {
  const frame = useCurrentFrame();
  const a = tw(frame, start, dur);
  const b = end === undefined ? 0 : tw(frame, end, 8, GLIDE);
  const v = a * (1 - b);
  if (v <= 0.001) return null;
  return (
    <div style={{ opacity: v, transform: `scale(${from + (1 - from) * a + b * 0.04})`, filter: v < 1 ? `blur(${(1 - v) * 10}px)` : undefined, ...style }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

/** A white product card: hairline ring, deep soft shadow. */
export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn("overflow-hidden rounded-[18px] bg-white text-left", className)}
      style={{
        boxShadow: "0 0 0 1px rgb(14 18 27 / 0.07), 0 2px 4px rgb(14 18 27 / 0.03), 0 24px 48px -16px rgb(14 18 27 / 0.16), 0 60px 90px -40px rgb(14 18 27 / 0.12)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A card lifted off its surface: scales up and casts a deeper shadow. */
export function Lift({ on, children, style }: { on: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="relative rounded-[14px] bg-white"
      style={{
        transform: `scale(${1 + 0.06 * on}) translateY(${-6 * on}px)`,
        boxShadow: `0 0 0 1px rgb(14 18 27 / ${0.06 + 0.04 * on}), 0 ${30 * on}px ${60 * on}px -20px rgb(14 18 27 / ${0.28 * on})`,
        zIndex: on > 0 ? 5 : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A status pill: label and a green check, popping in. */
export function Pill({ at, children, size = 28 }: { at: number; children: ReactNode; size?: number }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = pop(frame, at, 220, 16);
  return (
    <span
      className={cn(display, "inline-flex items-center gap-3 rounded-full bg-white pl-6 pr-4 font-medium")}
      style={{
        fontSize: size,
        height: size * 2,
        color: INK,
        boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 10px 24px -10px rgb(14 18 27 / 0.25)",
        transform: `scale(${0.6 + 0.4 * k})`,
        opacity: Math.min(1, k * 1.5),
      }}
    >
      {children}
      <svg width={size * 1.05} height={size * 1.05} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={GREEN} strokeOpacity="0.35" strokeWidth="1.6" />
        <path d="M7.5 12.2l3 3 6-6.4" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16" strokeDashoffset={16 * (1 - tw(frame, at + 3, 8))} />
      </svg>
    </span>
  );
}

/** A logo image from video/public. */
export function Logo({ src, size, radius = 0.22, pad = 0 }: { src: string; size: number; radius?: number; pad?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden bg-white" style={{ width: size, height: size, borderRadius: size * radius }}>
      <Img src={staticFile(src)} style={{ width: size * (1 - pad), height: size * (1 - pad), objectFit: "contain" }} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The hand                                                            */
/* ------------------------------------------------------------------ */

export type HandKey = readonly [frame: number, x: number, y: number];

/**
 * The pointing-hand cursor, large, gliding through `path` and pressing at
 * each of `clicks`. (x, y) is the fingertip.
 */
export function Hand({ path, clicks = [], show = [0, Infinity], size = 64 }: { path: readonly HandKey[]; clicks?: readonly number[]; show?: readonly [number, number]; size?: number }) {
  const frame = useCurrentFrame();
  const x = keys(frame, path.map(([f, v]) => [f, v] as const));
  const y = keys(frame, path.map(([f, , v]) => [f, v] as const));
  const vis = Math.min(tw(frame, show[0], 6), 1 - tw(frame, show[1], 6));
  if (vis <= 0) return null;
  const press = clicks.reduce((m, c) => Math.max(m, frame >= c - 2 && frame < c + 6 ? 1 - Math.abs(frame - c - 1) / 5 : 0), 0);
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-50" style={{ transform: `translate(${x - size * 0.36}px, ${y - size * 0.09}px)`, opacity: vis }}>
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ transform: `scale(${1 - press * 0.12})`, transformOrigin: "36% 10%", filter: "drop-shadow(0 4px 6px rgb(14 18 27 / 0.28))", overflow: "visible" }}>
        <path
          d="M11.5 3.2c1.2 0 2.1.9 2.1 2.1v7.4c.4-.6 1.1-1 1.9-1 1.1 0 2 .7 2.2 1.7.4-.4 1-.6 1.6-.6 1.1 0 2 .8 2.2 1.8.3-.2.7-.3 1.1-.3 1.2 0 2.1 1 2.1 2.2v5.6c0 4.3-3.5 7.8-7.8 7.8h-1.6c-2.6 0-5-1.3-6.5-3.5L4.6 21.8c-.6-.9-.4-2.1.5-2.7.8-.6 2-.4 2.6.4l1.7 2.3V5.3c0-1.2.9-2.1 2.1-2.1z"
          fill="#fff"
          stroke="#141414"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M13.6 12.7v4.6M17.7 13.6v3.8M21.7 15.1v2.6" stroke="#141414" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * Out-of-focus UI drifting behind a headline: each item sits at a depth
 * (0 near, 1 far) that sets its blur, size and drift speed.
 */
export function DepthField({ items, start = 0, end, zoom = 0 }: { items: { x: number; y: number; depth: number; node: ReactNode; w: number }[]; start?: number; end?: number; zoom?: number }) {
  const frame = useCurrentFrame();
  const a = tw(frame, start, 14);
  const b = end === undefined ? 0 : tw(frame, end, 10);
  const t = frame - start;
  return (
    <AbsoluteFill style={{ opacity: a * (1 - b) }}>
      {items.map((it, i) => {
        const s = 1 - it.depth * 0.45 + zoom * (1 - it.depth) * 0.4;
        const dx = (it.x - W / 2) * zoom * (1 - it.depth) * 0.6;
        const dy = (it.y - H / 2) * zoom * (1 - it.depth) * 0.6;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: it.x + dx + Math.sin((t + i * 40) / 60) * 10,
              top: it.y + dy - t * (0.25 + (1 - it.depth) * 0.35),
              width: it.w,
              transform: `translate(-50%, -50%) scale(${s})`,
              filter: `blur(${2 + it.depth * 7}px)`,
              opacity: 0.85 - it.depth * 0.35,
            }}
          >
            {it.node}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
