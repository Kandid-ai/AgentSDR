import { describe, expect, test } from "bun:test";
import { REP_RELAY_SAMPLE_RATE } from "./contract";
import {
  base64ToBytes,
  createDownsampler,
  int16ToLeBytes,
  leBytesToFloat32,
  MAX_OUTBOX_SAMPLES,
  catchUpRate,
  nextPlayTime,
  PcmOutbox,
} from "./relayPcm";

function sine(frequency: number, rate: number, samples: number, from = 0): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) out[i] = 0.5 * Math.sin((2 * Math.PI * frequency * (from + i)) / rate);
  return out;
}

function rms(pcm: Int16Array, skip = 64): number {
  let sum = 0;
  for (let i = skip; i < pcm.length; i++) sum += (pcm[i]! / 0x8000) ** 2;
  return Math.sqrt(sum / (pcm.length - skip));
}

describe("createDownsampler", () => {
  test("48 kHz to 16 kHz: exactly a third of the samples, across odd block sizes", () => {
    const downsample = createDownsampler(48_000, REP_RELAY_SAMPLE_RATE);
    let input = 0;
    let output = 0;
    for (const size of [512, 128, 2048, 333, 512, 1000]) {
      output += downsample(sine(440, 48_000, size, input)).length;
      input += size;
    }
    // Within the filter's look-ahead of the exact ratio.
    expect(Math.abs(output - input / 3)).toBeLessThanOrEqual(8);
  });

  test("keeps speech-band tones and removes what would alias", () => {
    const pass = createDownsampler(48_000, REP_RELAY_SAMPLE_RATE)(sine(1_000, 48_000, 9_600));
    expect(rms(pass)).toBeGreaterThan(0.3);
    const stop = createDownsampler(48_000, REP_RELAY_SAMPLE_RATE)(sine(12_000, 48_000, 9_600));
    expect(rms(stop)).toBeLessThan(0.02);
  });

  test("works from 44.1 kHz", () => {
    const out = createDownsampler(44_100, REP_RELAY_SAMPLE_RATE)(sine(500, 44_100, 4_410));
    expect(Math.abs(out.length - 1_600)).toBeLessThanOrEqual(8);
    expect(rms(out)).toBeGreaterThan(0.3);
  });
});

describe("PCM bytes", () => {
  test("little-endian both ways", () => {
    const bytes = int16ToLeBytes(Int16Array.from([1, -1, 0x7fff, -0x8000]));
    expect([...bytes]).toEqual([0x01, 0x00, 0xff, 0xff, 0xff, 0x7f, 0x00, 0x80]);
    expect([...leBytesToFloat32(bytes)]).toEqual([1 / 0x8000, -1 / 0x8000, 0x7fff / 0x8000, -1]);
  });

  test("a stray odd byte and a view's offset are handled", () => {
    expect(leBytesToFloat32(new Uint8Array([0, 0x40, 9])).length).toBe(1);
    expect([...leBytesToFloat32(new Uint8Array([9, 0, 0x40]).subarray(1))]).toEqual([0.5]);
  });

  test("base64 decodes to the relay's bytes", () => {
    expect([...base64ToBytes("AQD/fw==")]).toEqual([0x01, 0x00, 0xff, 0x7f]);
  });
});

describe("PcmOutbox", () => {
  test("takes everything waiting, in order, once", () => {
    const outbox = new PcmOutbox();
    expect(outbox.take()).toBeNull();
    outbox.push(Int16Array.from([1, 2]));
    outbox.push(Int16Array.from([3]));
    expect([...leBytesToFloat32(outbox.take()!)].map((v) => v * 0x8000)).toEqual([1, 2, 3]);
    expect(outbox.take()).toBeNull();
  });

  test("drops the oldest audio past the cap", () => {
    const outbox = new PcmOutbox(4);
    outbox.push(Int16Array.from([1, 2, 3]));
    outbox.push(Int16Array.from([4, 5, 6]));
    expect(outbox.size).toBe(4);
    expect([...leBytesToFloat32(outbox.take()!)].map((v) => v * 0x8000)).toEqual([3, 4, 5, 6]);
    outbox.push(Int16Array.from([1, 2, 3, 4, 5, 6, 7]));
    expect([...leBytesToFloat32(outbox.take()!)].map((v) => v * 0x8000)).toEqual([4, 5, 6, 7]);
  });

  test("never holds more than one POST may carry", () => {
    const outbox = new PcmOutbox();
    for (let i = 0; i < 100; i++) outbox.push(new Int16Array(640));
    expect(outbox.size).toBe(MAX_OUTBOX_SAMPLES);
    expect(outbox.take()!.byteLength).toBe(MAX_OUTBOX_SAMPLES * 2);
  });
});

describe("nextPlayTime", () => {
  test("buffers before starting, and again after running dry", () => {
    expect(nextPlayTime(10, 0, 0.1, 0.4)).toBeCloseTo(10.1);
    expect(nextPlayTime(10, 9.9, 0.1, 0.4)).toBeCloseTo(10.1);
  });

  test("plays back to back, and drops to catch up past the limit", () => {
    expect(nextPlayTime(10, 10.25, 0.1, 0.4)).toBe(10.25);
    expect(nextPlayTime(10, 10.45, 0.1, 0.4)).toBeNull();
  });
});

describe("catchUpRate", () => {
  test("plays at normal speed while the queue is at or under the target", () => {
    expect(catchUpRate(0.1, 0.15)).toBe(1);
    expect(catchUpRate(0.15, 0.15)).toBe(1);
  });

  test("speeds up a little over the target, more when well over, so a burst's delay drains", () => {
    expect(catchUpRate(0.2, 0.15)).toBe(1.05);
    expect(catchUpRate(0.35, 0.15)).toBe(1.1);
  });

  test("drains: 0.25 s of extra delay is gone within a few seconds of continuous audio", () => {
    let ahead = 0.4;
    const target = 0.15;
    const chunk = 0.04;
    let elapsed = 0;
    while (ahead > target && elapsed < 10) {
      // A 40 ms chunk arrives every 40 ms; it plays for chunk / rate.
      ahead += chunk / catchUpRate(ahead, target) - chunk;
      elapsed += chunk;
    }
    expect(ahead).toBeLessThanOrEqual(target + 0.01);
    expect(elapsed).toBeLessThan(5);
  });
});
