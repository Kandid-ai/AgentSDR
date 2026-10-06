import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { EASE, keys, tw } from "./motion";

/**
 * The video's building blocks, in the landing page's design language: the
 * dark sky, Geist headlines in the sky gradient, glass frames around white
 * app windows, and the AgentSDR tile.
 */

export const W = 1920;
export const H = 1080;

export const display = "font-[family-name:var(--font-landing-display)] font-medium";
export const mono = "font-[family-name:var(--font-landing-mono)]";

/* ------------------------------------------------------------------ */
/* Cursor                                                              */
/* ------------------------------------------------------------------ */

export type CursorKey = readonly [frame: number, x: number, y: number];

/**
 * A pointer gliding through `path` (frame, x, y), pressing at each frame in
 * `clicks` with a soft ripple, as the reference films drive their UI.
 */
export function Cursor({ path, clicks = [], show = [0, Infinity], scale = 1.5 }: { path: readonly CursorKey[]; clicks?: readonly number[]; show?: readonly [number, number]; scale?: number }) {
  const frame = useCurrentFrame();
  const x = keys(frame, path.map(([f, px]) => [f, px] as const));
  const y = keys(frame, path.map(([f, , py]) => [f, py] as const));
  const visible = Math.min(tw(frame, show[0], 8), 1 - tw(frame, show[1], 8));
  const press = clicks.reduce((m, c) => Math.max(m, frame >= c && frame < c + 8 ? 1 - Math.abs(frame - c - 3) / 5 : 0), 0);
  const ripple = clicks.map((c) => frame - c).find((d) => d >= 0 && d < 18);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-50" style={{ transform: `translate(${x}px, ${y}px)`, opacity: visible }}>
      {ripple !== undefined && (
        <span
          className="absolute rounded-full"
          style={{
            left: -22,
            top: -22,
            width: 44,
            height: 44,
            border: "2px solid rgb(51 92 255 / 0.55)",
            background: "rgb(51 92 255 / 0.12)",
            transform: `scale(${0.4 + EASE(ripple / 18) * 0.9})`,
            opacity: 1 - ripple / 18,
          }}
        />
      )}
      <svg width={20 * scale} height={22 * scale} viewBox="0 0 20 22" style={{ transform: `scale(${1 - press * 0.14})`, transformOrigin: "3px 3px", filter: "drop-shadow(0 3px 5px rgb(14 18 27 / 0.35))", marginLeft: -3 * scale, marginTop: -2.5 * scale }}>
        <path d="M3 2.5v15.2l4.1-3.9 2.7 6.1 2.9-1.3-2.7-6h5.6L3 2.5Z" fill="#141414" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

export type Shot = readonly [frame: number, x: number, y: number, scale: number];

/**
 * Moves a W × H stage like a camera: each shot centres (x, y) of the stage
 * on screen at `scale`, gliding between shots.
 */
export function Camera({ shots, children, width = W, height = H }: { shots: readonly Shot[]; children: ReactNode; width?: number; height?: number }) {
  const frame = useCurrentFrame();
  const x = keys(frame, shots.map(([f, v]) => [f, v] as const));
  const y = keys(frame, shots.map(([f, , v]) => [f, v] as const));
  const k = keys(frame, shots.map(([f, , , v]) => [f, v] as const));
  return (
    <div className="absolute left-0 top-0" style={{ width, height, transformOrigin: "0 0", transform: `translate(${W / 2 - x * k}px, ${H / 2 - y * k}px) scale(${k})` }}>
      {children}
    </div>
  );
}
