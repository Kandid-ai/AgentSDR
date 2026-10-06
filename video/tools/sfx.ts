import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * The film's sound effects, synthesized: soft UI sounds built from filtered
 * noise and enveloped sines, with a touch of room so they sit in the mix
 * rather than on top of it. Deterministic (seeded noise), 48 kHz stereo.
 *
 *   bun run tools/sfx.ts   → public/sfx/*.wav
 */

const SR = 48_000;
const out = path.resolve("public/sfx");
mkdirSync(out, { recursive: true });

/* ------------------------------------------------------------ primitives */

let seed = 1;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rand() * 2 - 1;
const buf = (seconds: number) => new Float64Array(Math.round(seconds * SR));

/** RBJ biquad, coefficients recomputed per sample from `fc(i)` (for sweeps). */
function bandpass(x: Float64Array, fc: (i: number) => number, q: number): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const w = (2 * Math.PI * fc(i)) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

function highpass(x: Float64Array, fc: number): Float64Array {
  const y = new Float64Array(x.length);
  const rc = 1 / (2 * Math.PI * fc);
  const a = rc / (rc + 1 / SR);
  let prevX = 0, prevY = 0;
  for (let i = 0; i < x.length; i++) {
    prevY = a * (prevY + x[i] - prevX);
    prevX = x[i];
    y[i] = prevY;
  }
  return y;
}

function lowpass(x: Float64Array, fc: number): Float64Array {
  const y = new Float64Array(x.length);
  const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  let v = 0;
  for (let i = 0; i < x.length; i++) y[i] = v += a * (x[i] - v);
  return y;
}

/** An exponentially decaying burst with a short attack, in seconds. */
const env = (t: number, attack: number, tau: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));

function mix(...layers: [Float64Array, number][]): Float64Array {
  const n = Math.max(...layers.map(([l]) => l.length));
  const y = new Float64Array(n);
  for (const [l, g] of layers) for (let i = 0; i < l.length; i++) y[i] += l[i] * g;
  return y;
}

/** A small room: four combs and two allpasses (Schroeder), mixed in at `wet`. */
function room(x: Float64Array, wet = 0.18, tail = 0.35): Float64Array {
  const n = x.length + Math.round(tail * SR);
  const dry = new Float64Array(n);
  dry.set(x);
  const combs = [1116, 1188, 1277, 1356].map((d) => Math.round((d * SR) / 44100));
  const acc = new Float64Array(n);
  for (const d of combs) {
    const line = new Float64Array(n);
    for (let i = 0; i < n; i++) line[i] = dry[i] + (i >= d ? line[i - d] * 0.72 : 0);
    for (let i = 0; i < n; i++) acc[i] += line[i] / combs.length;
  }
  let y = acc;
  for (const d of [225, 556].map((v) => Math.round((v * SR) / 44100))) {
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) z[i] = -0.5 * y[i] + (i >= d ? y[i - d] + 0.5 * z[i - d] : 0);
    y = z;
  }
  const wetLine = lowpass(y, 5000);
  for (let i = 0; i < n; i++) dry[i] = dry[i] * (1 - wet) + wetLine[i] * wet;
  return dry;
}

/** Peak-normalise, add a 2 ms fade-out guard, write 16-bit stereo (with optional width). */
function write(name: string, x: Float64Array, peakDb = -3, width = 0) {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const g = peak ? Math.pow(10, peakDb / 20) / peak : 1;
  const n = x.length;
  const guard = Math.round(0.002 * SR);
  const data = Buffer.alloc(44 + n * 4);
  data.write("RIFF", 0); data.writeUInt32LE(36 + n * 4, 4); data.write("WAVE", 8);
  data.write("fmt ", 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const fade = i > n - guard ? (n - i) / guard : 1;
    const v = x[i] * g * fade;
    const pan = width ? Math.sin((i / n) * Math.PI * 2) * width : 0;
    const l = Math.max(-1, Math.min(1, v * (1 - pan)));
    const r = Math.max(-1, Math.min(1, v * (1 + pan)));
    data.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  writeFileSync(path.join(out, `${name}.wav`), data);
  console.log(`sfx ${name} (${(n / SR).toFixed(2)} s)`);
}

const tone = (seconds: number, f: (t: number) => number, e: (t: number) => number) => {
  const x = buf(seconds);
  let phase = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * f(t)) / SR;
    x[i] = Math.sin(phase) * e(t);
  }
  return x;
};
const burst = (seconds: number, e: (t: number) => number) => {
  const x = buf(seconds);
  for (let i = 0; i < x.length; i++) x[i] = noise() * e(i / SR);
  return x;
};

/* ------------------------------------------------------------ the sounds */

// A UI click: a crisp transient, a small body, nothing ringing.
function click() {
  const tick = highpass(burst(0.05, (t) => env(t, 0.0004, 0.0018)), 2500);
  const body = tone(0.06, () => 1650, (t) => env(t, 0.0005, 0.006));
  const thump = tone(0.06, () => 210, (t) => env(t, 0.001, 0.012));
  return room(mix([tick, 0.9], [body, 0.35], [thump, 0.3]), 0.08, 0.15);
}

// A key tick for typing; `v` varies pitch and grain so a run never repeats.
function key(v: number) {
  const f = 2600 + v * 900;
  const grain = bandpass(burst(0.03, (t) => env(t, 0.0003, 0.0016)), () => f, 1.4);
  const knock = tone(0.035, () => 900 + v * 300, (t) => env(t, 0.0004, 0.004));
  return mix([grain, 1], [knock, 0.25]);
}

// A run of keystrokes at a human, uneven pace (~13 keys a second).
function typing(seconds: number) {
  const x = buf(seconds);
  let t = 0.01;
  while (t < seconds - 0.05) {
    const k = key(rand());
    const at = Math.round(t * SR);
    const g = 0.55 + rand() * 0.45;
    for (let i = 0; i < k.length && at + i < x.length; i++) x[at + i] += k[i] * g;
    t += 0.055 + rand() * 0.04;
  }
  return room(x, 0.06, 0.1);
}

// A soft tick for rows and cells landing.
function row() {
  const t1 = tone(0.08, () => 1320, (t) => env(t, 0.001, 0.012));
  const g = highpass(burst(0.04, (t) => env(t, 0.0004, 0.002)), 3000);
  return room(mix([t1, 0.5], [g, 0.5]), 0.12, 0.2);
}

// A pop: a short upward bubble, for chips and pills appearing.
function pop() {
  const b = tone(0.11, (t) => 420 + 700 * Math.min(1, t / 0.03), (t) => env(t, 0.002, 0.03));
  const g = highpass(burst(0.03, (t) => env(t, 0.0005, 0.002)), 2000);
  return room(mix([b, 1], [g, 0.25]), 0.12, 0.25);
}

// "Sent": two soft glassy notes, a fifth apart.
function chime() {
  const note = (f: number, delay: number) =>
    tone(0.9, () => f, (t) => (t < delay ? 0 : env(t - delay, 0.004, 0.16))).map((v, i, a) => v + 0.12 * Math.sin((2 * Math.PI * f * 2 * i) / SR) * (i / SR < delay ? 0 : env(i / SR - delay, 0.004, 0.09)));
  return room(mix([note(1318.5, 0), 0.7], [note(1975.5, 0.07), 0.55]), 0.22, 0.6);
}

// A finished moment: a rising triad, a little brighter than "sent".
function success() {
  const note = (f: number, delay: number) => tone(1.1, () => f, (t) => (t < delay ? 0 : env(t - delay, 0.004, 0.22)));
  return room(mix([note(1046.5, 0), 0.55], [note(1318.5, 0.06), 0.5], [note(1568, 0.12), 0.5], [note(2093, 0.18), 0.3]), 0.25, 0.8);
}

// A whoosh: noise through a band that sweeps up, swelling and fading.
function whoosh(seconds = 0.55, from = 350, to = 2600) {
  const n = buf(seconds);
  for (let i = 0; i < n.length; i++) {
    const t = i / n.length;
    n[i] = noise() * Math.pow(Math.sin(Math.PI * t), 1.6);
  }
  return room(bandpass(n, (i) => from * Math.pow(to / from, i / n.length), 1.1), 0.15, 0.3);
}

write("click", click(), -3);
write("tick", row(), -4);
write("typing", typing(3.2), -3);
write("pop", pop(), -3);
write("chime", chime(), -3);
write("success", success(), -3);
write("whoosh", whoosh(0.6, 300, 2400), -3, 0.25);
write("swipe", whoosh(0.32, 700, 3200), -3, 0.2);
