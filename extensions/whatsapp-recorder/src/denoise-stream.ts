/**
 * Runs a frame-based processor (RNNoise: 480 samples, 10 ms at 48 kHz) over
 * audio that arrives in blocks of another size (a ScriptProcessor's 1024).
 * Input is queued until a whole frame is there; output starts one frame late
 * (10 ms of silence), which keeps every block fully supplied from then on.
 *
 * `processFrame` works in place on samples scaled to 16-bit range, as
 * RNNoise expects; this converts from and back to Web Audio's ±1.
 */
export function createFrameStream(processFrame: (frame: Float32Array) => void, frameSize: number): (block: Float32Array) => Float32Array {
  let pending = new Float32Array(0);
  let ready: Float32Array = new Float32Array(frameSize);

  return (block) => {
    const input = new Float32Array(pending.length + block.length);
    input.set(pending);
    input.set(block, pending.length);
    const frames = Math.floor(input.length / frameSize);
    const produced = new Float32Array(ready.length + frames * frameSize);
    produced.set(ready);
    const frame = new Float32Array(frameSize);
    for (let f = 0; f < frames; f++) {
      for (let i = 0; i < frameSize; i++) frame[i] = input[f * frameSize + i]! * 0x8000;
      processFrame(frame);
      for (let i = 0; i < frameSize; i++) produced[ready.length + f * frameSize + i] = Math.max(-1, Math.min(1, frame[i]! / 0x8000));
    }
    pending = input.slice(frames * frameSize);
    const out = produced.slice(0, block.length);
    ready = produced.slice(block.length);
    return out;
  };
}
