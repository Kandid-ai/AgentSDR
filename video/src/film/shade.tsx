import type { CSSProperties } from "react";
import { CYCLES, STAND, VIEWBOX, frameRuns, type MascotCycle, type MascotFrame } from "@/components/brand/mascotFrames";
import { FPS } from "../kit/time";

/**
 * Shade, the AgentSDR mascot, driven by the film's frame instead of the
 * app's CSS animation (which runs on the wall clock and would drift from the
 * captured frames). Same pixels as the logo: src/components/brand/mascotFrames.ts.
 */

/** The pose a walk cycle shows at `frame` (film frames), or the standing logo. */
export function shadePose(cycle: MascotCycle | undefined, frame: number): MascotFrame {
  if (!cycle) return { grid: STAND };
  const { frameMs, frames } = CYCLES[cycle];
  const perPose = (frameMs / 1000) * FPS;
  return frames[Math.floor(Math.max(0, frame) / perPose) % frames.length];
}

export function Shade({ pose, color = "currentColor", size, style }: { pose: MascotFrame; color?: string; size: number; style?: CSSProperties }) {
  return (
    <svg viewBox={VIEWBOX} width={size} height={size} fill={color} aria-hidden="true" shapeRendering="crispEdges" style={{ display: "block", ...style }}>
      {frameRuns(pose).map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
      ))}
    </svg>
  );
}

/**
 * The logo tile (as AppIcon draws it: blue glass, soft grid, 14% corners)
 * with Shade inside. `tile` 0 → 1 grows the tile in behind the mascot.
 */
export function ShadeTile({ size, pose, tile = 1, mascot }: { size: number; pose: MascotFrame; tile?: number; mascot?: string }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#5b7bff] to-[#1f3bad]"
        style={{
          borderRadius: "14%",
          transform: `scale(${tile})`,
          opacity: Math.min(1, tile * 1.6),
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 0 0 1px rgb(255 255 255 / 0.18), 0 8px 24px -6px rgb(51 92 255 / 0.8)",
        }}
      >
        <span className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.08)_1px,transparent_1px)] bg-[size:25%_25%]" />
      </span>
      <span className="relative" style={{ filter: "drop-shadow(0 1px 1px rgb(11 10 26 / 0.35))" }}>
        <Shade pose={pose} size={size * 0.62} color={mascot ?? "#fff"} />
      </span>
    </span>
  );
}
