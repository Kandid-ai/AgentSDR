import { AbsoluteFill, useCurrentFrame } from "remotion";
import { GLIDE, tw } from "../kit/motion";
import { At, Canvas, display, INK } from "./kit";
import { Shade, shadePose } from "./shade";

/**
 * The opening frame: Shade and "AgentSDR", fully drawn on frame 0, so a
 * paused or not-yet-played video shows the logo rather than a blank canvas.
 * After a beat Shade hops, and the lockup blurs away into the hook.
 */

export const LOGO = 28;

export function LogoOpen() {
  const f = useCurrentFrame();
  const hop = f >= 8 && f < 18 ? Math.sin(((f - 8) / 10) * Math.PI) : 0;
  const pose = shadePose(f >= 8 ? "bounce" : undefined, f - 8);
  const out = tw(f, 18, 10, GLIDE);
  return (
    <Canvas>
      <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 14}px)` : undefined, transform: `scale(${1 + out * 0.08})` }}>
        <At y={540}>
          <div className="flex items-center">
            <span className="inline-flex" style={{ transform: `translateY(${-hop * 30}px)` }}>
              <Shade pose={pose} size={150} color={INK} />
            </span>
            <span className={`${display} ml-7 whitespace-nowrap text-[136px] font-semibold leading-none tracking-[-0.04em]`} style={{ color: INK }}>
              AgentSDR
            </span>
          </div>
        </At>
      </AbsoluteFill>
    </Canvas>
  );
}
