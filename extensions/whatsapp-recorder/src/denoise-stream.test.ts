import { describe, expect, test } from "bun:test";
import { createFrameStream } from "./denoise-stream";

describe("createFrameStream", () => {
  test("an untouched signal comes back whole, one frame late, across uneven blocks", () => {
    const frameSize = 480;
    const stream = createFrameStream(() => {}, frameSize);
    const total = 1024 * 20;
    const input = Float32Array.from({ length: total }, (_, i) => Math.sin(i / 7) * 0.5);
    const output = new Float32Array(total);
    for (let at = 0; at < total; at += 1024) output.set(stream(input.subarray(at, at + 1024)), at);
    for (let i = 0; i < frameSize; i++) expect(output[i]).toBe(0);
    for (let i = frameSize; i < total; i++) expect(Math.abs(output[i]! - input[i - frameSize]!)).toBeLessThan(1e-4);
  });

  test("frames reach the processor at 16-bit scale and come back to ±1", () => {
    const seen: number[] = [];
    const stream = createFrameStream((frame) => {
      seen.push(frame[0]!);
      frame.fill(16_384);
    }, 480);
    stream(new Float32Array(1024).fill(0.25));
    const out = stream(new Float32Array(1024).fill(0.25));
    expect(seen[0]).toBeCloseTo(0.25 * 0x8000);
    expect(out[out.length - 1]).toBeCloseTo(0.5);
  });
});
