import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import DialogProvider from "@/components/DialogProvider";
import landing from "@/components/landing/landing.module.css";
import { cn } from "@/utils/cn";
import { FONT_VARS } from "../fonts";
import { BG, display, INK } from "../film/kit";
import { shadePose, ShadeTile } from "../film/shade";

/**
 * Product Hunt gallery images: 1270 × 760 (5:3), designed on a 1.5× canvas
 * and rendered at 2× (2540 × 1520) by tools/ph.ts. The same look as the film
 * — off-white canvas, Geist display type, the app's own components on white
 * cards — with one idea and one headline per image.
 */

export const PW = 1905;
export const PH = 1140;

/** The canvas every gallery image sits on, with the brand mark top-left. */
export function Slide({ children, mark = true }: { children: ReactNode; mark?: boolean }) {
  return (
    <AbsoluteFill className={landing.page} style={{ ...FONT_VARS, background: BG }}>
      <AbsoluteFill style={{ background: "radial-gradient(70% 60% at 50% 55%, #ffffff 0%, rgb(255 255 255 / 0) 72%)" }} />
      <DialogProvider>{children}</DialogProvider>
      {mark && <BrandMark />}
    </AbsoluteFill>
  );
}

export function BrandMark({ style }: { style?: CSSProperties }) {
  return (
    <div className="absolute flex items-center gap-3" style={{ left: 84, top: 64, ...style }}>
      <ShadeTile size={52} pose={shadePose(undefined, 0)} />
      <span className={`${display} text-[32px] font-semibold tracking-[-0.03em]`} style={{ color: INK }}>
        AgentSDR
      </span>
    </div>
  );
}

/** The headline block, centred near the top: 3–7 words, and one plain sentence under it. */
export function Headline({ title, sub, top = 150, size = 84, children }: { title: ReactNode; sub?: ReactNode; top?: number; size?: number; children?: ReactNode }) {
  return (
    <div className="absolute inset-x-0 flex flex-col items-center px-[150px] text-center" style={{ top }}>
      {children}
      <h1 className={`${display} font-semibold leading-[1.04] tracking-[-0.04em]`} style={{ color: INK, fontSize: size }}>
        {title}
      </h1>
      {sub && (
        <p className={`${display} mt-5 max-w-[1240px] text-[31px] leading-[1.35] tracking-[-0.012em] text-[#6b6b6b]`}>{sub}</p>
      )}
    </div>
  );
}

/** A box laid out at `w × h` and shown at `scale`, positioned by its top-left. */
export function Scaled({ w, h, scale, x, y, children, style }: { w: number; h: number; scale: number; x: number; y: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="absolute" style={{ left: x, top: y, width: w * scale, height: h * scale, ...style }}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>{children}</div>
    </div>
  );
}

/** Centred horizontally on the canvas. */
export function Centre({ y, children, style }: { y: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="absolute inset-x-0 flex justify-center" style={{ top: y, ...style }}>
      {children}
    </div>
  );
}

/** A plain browser window around an image of a real screen. */
export function ShotWindow({ src, width, url = "agentsdr.ai", path = "", height }: { src: string; width: number; url?: string; path?: string; /** Show only the top `height` px of the image. */ height?: number }) {
  return (
    <div className="overflow-hidden rounded-[20px] bg-white" style={{ width, boxShadow: WINDOW_SHADOW }}>
      <div className="flex h-[52px] items-center gap-3 border-b border-[#ececea] bg-[#f6f6f5] px-5">
        <span className="flex gap-2">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="size-[13px] rounded-full" style={{ background: c }} />
          ))}
        </span>
        <span className="mx-auto flex h-[32px] items-center rounded-lg bg-white px-4 text-[15px] text-[#6b6b6b] ring-1 ring-inset ring-[#ececea]">
          {url}
          <span className="text-[#a3a3a3]">{path}</span>
        </span>
        <span className="w-[60px]" />
      </div>
      <div style={{ overflow: "hidden", height }}>
        <Img src={staticFile(src)} style={{ width, display: "block" }} />
      </div>
    </div>
  );
}

export const WINDOW_SHADOW = "0 0 0 1px rgb(14 18 27 / 0.08), 0 2px 6px rgb(14 18 27 / 0.04), 0 40px 90px -36px rgb(14 18 27 / 0.32)";

/** A small rounded label: what a card is, or a fact. */
export function Chip({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn(`${display} inline-flex h-[52px] items-center gap-2.5 rounded-full bg-white px-6 text-[23px] font-medium text-[#3a3a3a]`, className)} style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 10px 24px -14px rgb(14 18 27 / 0.3)", ...style }}>
      {children}
    </span>
  );
}

/** A channel's own mark on a white app tile. */
export function BrandTile({ src, size, inset = 0.62 }: { src: string; size: number; inset?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center bg-white" style={{ width: size, height: size, borderRadius: size * 0.24, boxShadow: "0 0 0 1px rgb(14 18 27 / 0.06), 0 2px 4px rgb(14 18 27 / 0.04), 0 22px 40px -20px rgb(14 18 27 / 0.3)" }}>
      <Img src={staticFile(src)} style={{ width: size * inset, height: size * inset, objectFit: "contain" }} />
    </span>
  );
}
