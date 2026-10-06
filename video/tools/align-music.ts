import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Fits a generated track to the film: finds its tempo and beat grid, finds
 * the drop (the beat where the low end jumps), and cuts on that grid so the
 * drop lands on the arrow zoom (music time DROP_AT — the score starts at film
 * frame 28). A track too short after its drop gets whole bars repeated
 * after the drop, so the groove carries to the end card. A long drumless
 * breakdown before the drop is cut down to BUILD_BARS (its first bar, then
 * the last bars of the riser), so the fast channel cuts keep a beat under
 * them. Then a fade-out and loudnorm to -14 LUFS.
 *
 *   bun run tools/align-music.ts public/score-v1.mp3 public/music-v1.wav [bpm] [drop hint, s] [--breakdown=K:R]
 *
 * --breakdown=K:R sets the breakdown cut by hand, in bars before the drop:
 * play to K bars before it, resume R bars before it. Pick both inside the
 * breakdown's quiet pad, so the splice joins quiet to quiet and the riser
 * after it plays whole — a cut into the riser is heard as a jolt.
 */

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const [src, dst, bpmArg, hintArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const manual = flags.find((a) => a.startsWith("--breakdown="))?.split("=")[1].split(":").map(Number);
if (!src || !dst) throw new Error("usage: align-music.ts <in> <out.wav> [expected bpm] [drop hint]");
const BUILD_BARS = 4;

const DROP_AT = 32.0; // music time of the drop (the arrow, film 32.93 s − the score's 0.933 s start)
const LENGTH = 50.27; // film length (51.20 s) − the score's start
const FADE = 1.8;
const SR = 11025;
const HOP = 64;

const raw = execFileSync("ffmpeg", ["-v", "error", "-i", src, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const dur = x.length / SR;

/* ---- onset envelope: half-wave rectified rise in log energy, per hop */
const frames = Math.floor(x.length / HOP);
const logE = new Float64Array(frames);
for (let i = 0; i < frames; i++) {
  let s = 0;
  for (let j = 0; j < HOP * 2 && i * HOP + j < x.length; j++) s += x[i * HOP + j] ** 2;
  logE[i] = Math.log10(s + 1e-9);
}
const onset = new Float64Array(frames);
for (let i = 1; i < frames; i++) onset[i] = Math.max(0, logE[i] - logE[i - 1]);

/* ---- tempo: autocorrelation of the onset envelope, with a prior near the asked-for bpm */
const fps = SR / HOP;
const expected = Number(bpmArg) || 0;
let best = { bpm: 0, score: -Infinity, lag: 0 };
for (let bpm = 80; bpm <= 190; bpm += 0.1) {
  const lag = (60 / bpm) * fps;
  let s = 0;
  for (let i = 0; i + lag * 4 < frames; i++) {
    const a = Math.floor(i + lag), b = a + 1, w = i + lag - a;
    s += onset[i] * (onset[a] * (1 - w) + onset[b] * w);
  }
  const prior = expected ? Math.exp(-0.5 * (Math.log2(bpm / expected) / 0.08) ** 2) : 1;
  const score = s * (0.5 + prior);
  if (score > best.score) best = { bpm, score, lag };
}
const beat = 60 / best.bpm;

/* ---- beat phase: the offset whose grid collects the most onset */
let phase = 0, phaseScore = -1;
for (let p = 0; p < beat; p += 1 / fps) {
  let s = 0;
  for (let t = p; t < dur; t += beat) s += onset[Math.round(t * fps)] ?? 0;
  if (s > phaseScore) { phaseScore = s; phase = p; }
}

/* ---- loudness curves: full band and low end (kick + bass) in 50 ms windows */
const W = Math.round(0.05 * SR);
function dbCurve(sig: Float32Array | Float64Array) {
  const n = Math.floor(sig.length / W);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < W; j++) s += sig[i * W + j] ** 2;
    out[i] = Math.max(-90, 10 * Math.log10(s / W + 1e-12));
  }
  return out;
}
const low = new Float64Array(x.length);
{
  const a = 1 - Math.exp((-2 * Math.PI * 150) / SR);
  let v1 = 0, v2 = 0;
  for (let i = 0; i < x.length; i++) { v1 += a * (x[i] - v1); v2 += a * (v1 - v2); low[i] = v2; }
}
const fullDb = dbCurve(x);
const lowDb = dbCurve(low);
const mean = (c: Float64Array, from: number, to: number) => {
  let s = 0, n = 0;
  for (let i = Math.max(0, Math.round(from / 0.05)); i < Math.min(c.length, Math.round(to / 0.05)); i++) { s += c[i]; n++; }
  return n ? s / n : -90;
};

/* ---- the drop: the beat after which the low end is loudest relative to before
   (near the hint, when one is given: a track whose bass returns in a drum build
   before the real drop needs to be told which one is the drop) */
const hint = Number(hintArg) || 0;
let drop = 0, dropScore = -Infinity;
for (let t = phase; t < dur - 8; t += beat) {
  if (t < 18 || (hint && Math.abs(t - hint) > 1)) continue;
  const s = mean(lowDb, t, t + 2) - mean(lowDb, t - 2, t) + 0.5 * (mean(fullDb, t, t + 2) - mean(fullDb, t - 2, t));
  if (s > dropScore) { dropScore = s; drop = t; }
}

/* ---- where the music actually stops (the track's own tail is silence) */
let contentEnd = dur;
for (let i = fullDb.length - 1; i > 0; i--) if (fullDb[i] > -38) { contentEnd = i * 0.05; break; }

/* ---- the breakdown: whole bars before the drop whose low end sits well under the drop's */
const bar = beat * 4;
const dropLevel = mean(lowDb, drop + 1, drop + 9);
const quiet = (k: number) => mean(lowDb, drop - k * bar, drop - (k - 1) * bar) < dropLevel - 6;
let quietBars = 0;
// One loud bar inside a breakdown (a fill) does not end it.
while (drop - (quietBars + 1) * bar > 0 && (quiet(quietBars + 1) || (quiet(quietBars + 2) && drop - (quietBars + 2) * bar > 0))) quietBars++;
const cutBars = manual ? manual[0] - manual[1] : Math.max(0, quietBars - BUILD_BARS); // removed from the breakdown
const breakIn = manual ? drop - manual[0] * bar : drop - quietBars * bar + bar; // keep up to here …
const breakOut = breakIn + cutBars * bar; // … and resume here

/* ---- the cut: start exactly DROP_AT before the drop. The start may fall mid-beat;
   the score fades in under the hook, so landing the drop on the arrow matters more. */
let start = drop - cutBars * bar - DROP_AT;
const lead = 0;
const need = LENGTH - DROP_AT + lead + 0.6; // after the drop, with a little tail to fade
const have = contentEnd - drop;
let repeatBars = 0;
if (have < need) repeatBars = Math.ceil((need - have) / bar);
const pad = start < 0 ? -start : 0;
if (start < 0) start = 0;

// The track as a list of [from, to] spans joined on the grid with short crossfades.
const XF = 0.03;
const BREAK_XF = 0.25; // the breakdown splice sits in a quiet pad, so it can blend slowly
const spans: [number, number][] = [];
const xfs: number[] = []; // crossfade into span i (i ≥ 1)
let at = start;
if (cutBars) { spans.push([at, breakIn]); at = breakOut; xfs.push(BREAK_XF); }
if (repeatBars) {
  // Play to X, then go back `repeatBars` bars and play on from there: bars repeat on the grid.
  const X = drop + 4 * bar;
  spans.push([at, X]);
  at = X - repeatBars * bar;
  xfs.push(XF);
}
spans.push([at, dur]);
const xfIn = (i: number) => (i ? xfs[i - 1] : 0);
const xfOut = (i: number) => (i < spans.length - 1 ? xfs[i] : 0);

const r = (n: number) => n.toFixed(4);
let filter = spans.map(([a, b], i) => `[0:a]atrim=${r(Math.max(0, a - xfIn(i) / 2))}:${r(Math.min(dur, b + xfOut(i) / 2))},asetpts=PTS-STARTPTS[s${i}];`).join("");
let last = "s0";
for (let i = 1; i < spans.length; i++) {
  filter += `[${last}][s${i}]acrossfade=d=${xfs[i - 1]}:c1=qsin:c2=qsin[j${i}];`;
  last = `j${i}`;
}
filter += `[${last}]`;
filter +=
  (pad ? `adelay=${Math.round(pad * 1000)}:all=1,` : "") +
  `atrim=0:${LENGTH},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${LENGTH - FADE}:d=${FADE},` +
  `aresample=48000,loudnorm=I=-14:TP=-2:LRA=11,aresample=48000[out]`;

execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-filter_complex", filter, "-map", "[out]", "-ac", "2", "-c:a", "pcm_s16le", dst]);

console.log(
  `${path.basename(src)}: ${best.bpm.toFixed(1)} bpm, drop at ${drop.toFixed(2)} s (+${dropScore.toFixed(1)} dB), ` +
    `cut from ${start.toFixed(2)} s → drop at music ${(DROP_AT - lead).toFixed(2)} s` +
    `, breakdown ${quietBars} bars` +
    (cutBars ? ` (${cutBars} cut, ${breakIn.toFixed(2)}→${breakOut.toFixed(2)} s)` : "") +
    (repeatBars ? `, ${repeatBars} bar(s) repeated` : "") +
    (pad ? `, ${pad.toFixed(2)} s lead-in silence` : "") +
    ` → ${path.basename(dst)}`,
);
