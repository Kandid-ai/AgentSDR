"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref, type RefObject } from "react";
import { cn } from "@/utils/cn";
import styles from "./converge.module.css";
import { TOOLS } from "./data/tools";

/**
 * "One workspace", shown: the tools AgentSDR replaces travel in from both
 * edges of the hero along a fan of hairline curves and merge into the
 * headline's own icon. They enter large and softened, slow and shrink as
 * they near the icon, pass behind the text (which always stays on top and
 * legible) and slip under the icon, which answers with a soft bloom.
 *
 * Every curve ends on the icon's measured centre — re-measured on resize,
 * once the display font has loaded, and whenever the icon is seen to have
 * moved — so the arrival, the ring and the bloom are concentric with it.
 *
 * One requestAnimationFrame loop writes transform and opacity only. It stops
 * while off screen or in a hidden tab, and never runs under
 * prefers-reduced-motion: the tools then rest near the edges on their curves
 * and the icon stays still.
 */

/* ------------------------------------------------------------ the lines */

/**
 * Each side's six lines: where a line meets the hero's edge (dy, px from the
 * icon's centre line). Lines now run straight to the icon; `a` and `b` were
 * the curved fan's bends and are kept only so that version is one edit away.
 */
const LINES: readonly { dy: number; a: number; b: number }[] = [
  { dy: -204, a: 0.4, b: 0.5 },
  { dy: -132, a: 0.34, b: 0.46 },
  { dy: -60, a: 0.28, b: 0.4 },
  { dy: 26, a: 0.3, b: 0.42 },
  { dy: 112, a: 0.36, b: 0.5 },
  { dy: 196, a: 0.42, b: 0.56 },
];

type Pt = [number, number];
type Box = { l: number; t: number; r: number; b: number };

function bezier(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const m = 1 - t;
  const k0 = m * m * m;
  const k1 = 3 * m * m * t;
  const k2 = 3 * m * t * t;
  const k3 = t * t * t;
  return [k0 * a[0] + k1 * b[0] + k2 * c[0] + k3 * d[0], k0 * a[1] + k1 * b[1] + k2 * c[1] + k3 * d[1]];
}

const STEPS = 200;

/** Points spaced evenly by arc length, so speed comes from the easing alone. */
function arcTable(a: Pt, b: Pt, c: Pt, d: Pt): Float32Array {
  const fine = 1000;
  const pts: Pt[] = [];
  const len: number[] = [0];
  for (let i = 0; i <= fine; i++) {
    pts.push(bezier(a, b, c, d, i / fine));
    if (i > 0) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = len[fine];
  const out = new Float32Array((STEPS + 1) * 2);
  let j = 0;
  for (let s = 0; s <= STEPS; s++) {
    const target = (s / STEPS) * total;
    while (j < fine - 1 && len[j + 1] < target) j++;
    const span = len[j + 1] - len[j] || 1;
    const f = Math.min(1, Math.max(0, (target - len[j]) / span));
    out[s * 2] = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f;
    out[s * 2 + 1] = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f;
  }
  return out;
}

function at(table: Float32Array, u: number): Pt {
  const f = Math.min(1, Math.max(0, u)) * STEPS;
  const i = Math.min(STEPS - 1, Math.floor(f));
  const r = f - i;
  return [table[i * 2] + (table[i * 2 + 2] - table[i * 2]) * r, table[i * 2 + 1] + (table[i * 2 + 3] - table[i * 2 + 1]) * r];
}

/** First fraction of the curve inside the text block, or 1 if it never enters. */
function entersAt(table: Float32Array, box: Box): number {
  for (let s = 0; s <= STEPS; s++) {
    const x = table[s * 2];
    const y = table[s * 2 + 1];
    if (x > box.l && x < box.r && y > box.t && y < box.b) return s / STEPS;
  }
  return 1;
}

/* ---------------------------------------------------------------- motion */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
const band = (v: number, a: number, b: number) => smooth((v - a) / (b - a));
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Distance along the curve for time fraction p: quick off the edge, settling as it nears the icon. */
const EASE = 1.55;
const travelEase = (p: number) => 1 - Math.pow(1 - p, EASE);

/** Where a tool has slipped fully under the icon: the moment it lands. */
const LAND_U = 0.985;
const LAND_P = 1 - Math.pow(1 - LAND_U, 1 / EASE);

/** Where a resting tool sits on its curve under prefers-reduced-motion. */
const REST_U = 0.07;

/**
 * Tools leave in waves rather than one by one: two or three at a time, from
 * both edges (TOOLS alternates sides, so consecutive tools make a mixed
 * wave), a beat apart within the wave so they read as a group, not a drill.
 * `wave` is the time between waves, `stagger` between tools in one.
 */
type Mode = { wave: number; stagger: number; travel: number; tile: number };
const DESK: Mode = { wave: 2.6, stagger: 0.22, travel: 6.6, tile: 56 };
const PHONE: Mode = { wave: 2.6, stagger: 0.22, travel: 5.6, tile: 40 };
const WAVE_SIZES = [3, 2];

/** Each tool's launch time in the loop, and how many waves make the loop. */
function waves(count: number, mode: Mode): { starts: number[]; loops: number } {
  const groups: number[] = [];
  for (let left = count, k = 0; left > 0; k++) {
    const size = Math.min(left, WAVE_SIZES[k % WAVE_SIZES.length]);
    // A lone tool joins the wave before it rather than flying solo.
    if (size === 1 && groups.length) groups[groups.length - 1]++;
    else groups.push(size);
    left -= size;
  }
  const starts = groups.flatMap((size, g) => Array.from({ length: size }, (_, m) => g * mode.wave + m * mode.stagger));
  return { starts, loops: groups.length };
}

type Flight = { i: number; table: Float32Array; behind: number; start: number };
type Trail = { d: string; x1: number; x2: number; fade: number };

/* ----------------------------------------------------------------- view */

/**
 * Wraps the headline's icon: the element the tools fly into, and the one
 * that brightens when they land. The logo inside can be swapped freely.
 */
export function ConvergeTarget({ ref, children, className }: { ref?: Ref<HTMLSpanElement>; children: ReactNode; className?: string }) {
  return (
    <span ref={ref} className={cn(styles.target, className)}>
      {children}
      <span data-glint="" aria-hidden="true" className={styles.glint} />
    </span>
  );
}

export function Converge({ target }: { target: RefObject<HTMLSpanElement | null> }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const veilRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bloomRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const [trails, setTrails] = useState<Trail[]>([]);

  useEffect(() => {
    const layer = layerRef.current;
    const anchor = target.current;
    if (!layer || !anchor) return;
    const glint = anchor.querySelector<HTMLElement>("[data-glint]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const phoneQuery = window.matchMedia("(max-width: 639.98px)");

    let flights: Flight[] = [];
    let loop = 1;
    let mode = DESK;
    let land: Pt = [0, 0];
    let raf = 0;
    let last = 0;
    let started = 0;
    let frames = 0;
    let onScreen = false;
    // Begin with tools already on their way, so the first landing comes soon.
    let clock = DESK.travel * 0.85;

    /** The icon's centre in the layer's coordinates. Its scale nudge is about its centre, so it never moves this. */
    const centre = (): Pt => {
      const box = layer.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      return [a.left - box.left + a.width / 2, a.top - box.top + a.height / 2];
    };

    const place = (el: HTMLElement | null, x: number, y: number, scale: number) => {
      if (el) el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%) scale(${scale.toFixed(4)})`;
    };

    const measure = () => {
      const w = layer.clientWidth;
      if (!w || !anchor.offsetWidth) return;
      land = centre();
      const phone = phoneQuery.matches;
      mode = phone ? PHONE : DESK;

      // The text the tools pass behind: the headline's and the paragraph's actual lines
      // (not their full-width boxes), padded so a tile is small before it reaches a glyph.
      const box = layer.getBoundingClientRect();
      const head = anchor.closest("h1");
      const range = document.createRange();
      const lines = [head, head?.nextElementSibling].flatMap((e) => {
        if (!e) return [];
        range.selectNodeContents(e);
        return [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
      });
      const pad = mode.tile * 0.3;
      const zone: Box = lines.length
        ? {
            l: Math.min(...lines.map((r) => r.left)) - box.left - pad,
            t: Math.min(...lines.map((r) => r.top)) - box.top - pad,
            r: Math.max(...lines.map((r) => r.right)) - box.left + pad,
            b: Math.max(...lines.map((r) => r.bottom)) - box.top + pad,
          }
        : { l: 0, t: 0, r: 0, b: 0 };

      const next: Flight[] = [];
      const drawn: Trail[] = [];
      const seen = new Set<string>();
      TOOLS.forEach((t, i) => {
        if (phone && t.phone === undefined) return;
        const spec = phone ? { dy: t.phone ?? 0, a: 0.34, b: 0.46 } : LINES[t.line];
        const from: Pt = [t.side === "left" ? 0 : w, land[1] + spec.dy];
        const dx = land[0] - from[0];
        // A straight run from the edge to the icon (a cubic with its handles on the line, so the
        // arc-length table and easing work as before). The curved fan is commit c7890b4.
        const dy = land[1] - from[1];
        const c: [Pt, Pt, Pt, Pt] = [from, [from[0] + dx / 3, from[1] + dy / 3], [from[0] + (2 * dx) / 3, from[1] + (2 * dy) / 3], land];
        const table = arcTable(...c);
        const behind = entersAt(table, zone);
        next.push({ i, table, behind, start: 0 });
        const key = `${t.side}${spec.dy}`;
        if (!seen.has(key)) {
          seen.add(key);
          const [ex] = at(table, behind);
          drawn.push({
            d: `M${c[0][0].toFixed(1)} ${c[0][1].toFixed(1)}C${c[1][0].toFixed(1)} ${c[1][1].toFixed(1)} ${c[2][0].toFixed(1)} ${c[2][1].toFixed(1)} ${c[3][0].toFixed(1)} ${c[3][1].toFixed(1)}`,
            x1: from[0],
            x2: land[0],
            // How far along the horizontal run the line reaches the text: it has faded out by then.
            fade: clamp01((ex - from[0]) / (land[0] - from[0] || 1)),
          });
        }
      });
      const plan = waves(next.length, mode);
      next.forEach((f, j) => (f.start = plan.starts[j]));
      loop = plan.loops * mode.wave;
      flights = next;
      setTrails(drawn);

      // Ring and bloom: centred on the icon, the ring its exact size.
      const size = anchor.offsetWidth;
      if (ringRef.current) {
        ringRef.current.style.width = `${size}px`;
        ringRef.current.style.height = `${size}px`;
        place(ringRef.current, land[0], land[1], 1);
      }
      if (bloomRef.current) {
        bloomRef.current.style.width = `${size * 3.4}px`;
        bloomRef.current.style.height = `${size * 3.4}px`;
        place(bloomRef.current, land[0], land[1], 1);
      }

      // At rest, the tools sit near the edges on their curves.
      if (reduce.matches) {
        for (const f of flights) {
          const [x, y] = at(f.table, REST_U);
          place(tileRefs.current[f.i], x, y, 0.82);
        }
      }
      layer.dataset.ready = "";
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      if (!started) started = now;
      // Cap the step so a stalled stretch never jumps a tool across the hero.
      clock += Math.min(0.05, (now - last) / 1000);
      last = now;

      // About once a second, check the icon has not moved (late fonts, content above it changing).
      if (++frames % 60 === 0) {
        const c = centre();
        if (Math.abs(c[0] - land[0]) > 0.5 || Math.abs(c[1] - land[1]) > 0.5) measure();
      }

      const n = flights.length;
      if (!n) return;
      const intro = smooth((now - started) / 1000);

      for (let j = 0; j < n; j++) {
        const { i, table, behind, start } = flights[j];
        const el = tileRefs.current[i];
        if (!el) continue;
        const p = mod(clock - start, loop) / mode.travel;
        if (p >= 1) {
          if (el.style.opacity !== "0") el.style.opacity = "0";
          continue;
        }
        const u = travelEase(p);
        const [x, y] = at(table, u);
        // Large and softened at the edge; clearest out in the open sky; smaller and quieter
        // once behind the text; then under the icon.
        const open = band(u, 0.02, Math.max(0.12, behind * 0.7));
        const under = band(u, behind - 0.04, behind + 0.04);
        const size = 1 - 0.4 * band(u, 0, behind) - 0.24 * band(u, behind, LAND_U);
        const opacity = band(u, 0, 0.06) * (0.55 + 0.4 * open) * (1 - 0.35 * under) * (1 - band(u, 0.94, LAND_U)) * intro;
        el.style.opacity = opacity.toFixed(3);
        place(el, x, y, size);
        const veil = veilRefs.current[i];
        if (veil) veil.style.opacity = Math.min(0.62, 0.5 * (1 - open) + 0.56 * under).toFixed(3);
      }

      // Each wave's landing: a soft bloom on the icon, a ring easing out of its edge, a brief lift.
      // Timed from the wave's first arrival; the others land inside the same glow.
      const since = mod(clock - LAND_P * mode.travel, mode.wave);
      const ring = clamp01(since / 0.9);
      const lift = intro * Math.exp(-since * 3) * clamp01(since / 0.1);
      if (bloomRef.current) bloomRef.current.style.opacity = (0.25 + 0.75 * lift).toFixed(3);
      if (ringRef.current) {
        ringRef.current.style.opacity = (0.5 * Math.pow(1 - ring, 2) * intro * clamp01(since / 0.06)).toFixed(3);
        place(ringRef.current, land[0], land[1], 1 + 0.2 * (1 - Math.pow(1 - ring, 3)));
      }
      if (glint) glint.style.opacity = (0.5 * lift).toFixed(3);
      anchor.style.transform = `scale(${(1 + 0.025 * lift).toFixed(4)})`;
    };

    const shouldRun = () => onScreen && !document.hidden && !reduce.matches;
    const sync = () => {
      if (shouldRun()) {
        if (!raf) {
          layer.dataset.live = "";
          last = 0;
          raf = requestAnimationFrame(frame);
        }
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onReduce = () => {
      if (reduce.matches) {
        cancelAnimationFrame(raf);
        raf = 0;
        delete layer.dataset.live;
        for (const el of [...tileRefs.current, ...veilRefs.current, bloomRef.current, ringRef.current, glint]) if (el) el.style.opacity = "";
        anchor.style.transform = "";
      }
      measure();
      sync();
    };

    measure();
    let alive = true;
    document.fonts?.ready.then(() => alive && measure());

    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      sync();
    });
    io.observe(layer);
    const ro = new ResizeObserver(() => measure());
    ro.observe(layer);
    if (anchor.parentElement) ro.observe(anchor.parentElement);
    document.addEventListener("visibilitychange", sync);
    reduce.addEventListener("change", onReduce);
    phoneQuery.addEventListener("change", measure);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduce.removeEventListener("change", onReduce);
      phoneQuery.removeEventListener("change", measure);
    };
  }, [target]);

  return (
    <div ref={layerRef} aria-hidden="true" className={styles.layer}>
      {/* The fan of hairlines each side: in from the edge, gone before the text. */}
      <svg className={styles.lines} fill="none">
        <defs>
          {trails.map((t, k) => (
            <linearGradient key={k} id={`converge-line-${k}`} gradientUnits="userSpaceOnUse" x1={t.x1} y1="0" x2={t.x2} y2="0">
              <stop offset="0" stopColor="#c7d2ff" stopOpacity="0" />
              <stop offset={(t.fade * 0.35).toFixed(3)} stopColor="#c7d2ff" stopOpacity="0.2" />
              <stop offset={(t.fade * 0.75).toFixed(3)} stopColor="#c7d2ff" stopOpacity="0.1" />
              <stop offset={(t.fade * 0.98).toFixed(3)} stopColor="#c7d2ff" stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {trails.map((t, k) => (
          <path key={k} d={t.d} stroke={`url(#converge-line-${k})`} strokeWidth="1" />
        ))}
      </svg>

      <span ref={bloomRef} className={styles.bloom} />

      {TOOLS.map((t, i) => (
        <span
          key={t.name}
          ref={(el) => {
            tileRefs.current[i] = el;
          }}
          className={cn(styles.tile, t.phone === undefined && styles.notPhone)}
          style={{ "--inset": `${Math.round((t.inset ?? 0.62) * 100)}%` } as CSSProperties}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand marks, SVG and PNG alike; nothing to optimise */}
          <img src={t.src} alt={t.name} width={56} height={56} draggable={false} className={t.bleed ? styles.bleed : styles.mark} />
          <span
            ref={(el) => {
              veilRefs.current[i] = el;
            }}
            className={styles.veil}
          />
        </span>
      ))}

      <span ref={ringRef} className={styles.ring} />
    </div>
  );
}
