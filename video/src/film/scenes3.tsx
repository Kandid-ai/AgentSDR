import { useCurrentFrame } from "remotion";
import {
  RiArrowRightLine,
  RiGithubFill,
} from "@remixicon/react";
import { Shade, shadePose } from "./shade";
import { between, GLIDE, pop, tw, typed } from "../kit/motion";
import { At, Canvas, display, INK } from "./kit";

/* ================================================================== */
/* 10 · One message runs the whole campaign                            */
/* ================================================================== */





/* ================================================================== */
/* 13 · End card                                                       */
/* ================================================================== */

export const END = 150;

const REPO = "Self-host yours → github.com/Kandid-ai/AgentSDR";

/**
 * The close, after the reference film's: Shade lands on the empty canvas,
 * "AgentSDR" types out beside it, "Open-source AI SDR" in grey beneath; a
 * black bar opens under them and types where to get it. Shade keeps a quiet
 * idle step the whole time.
 */
export function EndCard() {
  const f = useCurrentFrame();
  const land = pop(f, 2, 200, 13);
  const hop = f >= 4 && f < 16 ? Math.sin(((f - 4) / 12) * Math.PI) : 0;
  const pose = shadePose(f >= 20 ? "step" : undefined, f - 20);
  const name = typed("AgentSDR", f, 14, 28);
  const tag = typed("Open-source AI SDR", f, 32, 40);
  const bar = tw(f, 60, 14, GLIDE);
  const label = typed(REPO, f, 70, 52);
  const lift = between(f, 58, 14, 0, -60, GLIDE);
  return (
    <Canvas>
      <At y={470 + lift}>
        <div className="flex items-center">
          <span className="inline-flex" style={{ transform: `translateY(${-hop * 36}px) scale(${0.3 + 0.7 * land})`, opacity: Math.min(1, land * 1.5) }}>
            <Shade pose={pose} size={132} color={INK} />
          </span>
          <span className={`${display} ml-6 whitespace-nowrap text-[120px] font-semibold leading-none tracking-[-0.04em]`} style={{ color: INK }}>
            {name}
          </span>
        </div>
      </At>
      <At y={590 + lift}>
        <span className={`${display} whitespace-nowrap text-[58px] font-medium tracking-[-0.025em] text-[#8b8b8b]`} style={{ opacity: tag ? 1 : 0 }}>
          {tag || "\u00a0"}
        </span>
      </At>
      <At y={700}>
        <div className="flex h-[84px] items-center justify-center overflow-hidden rounded-[18px] bg-[#141414] text-[32px] font-medium text-white" style={{ width: 24 + bar * 900, opacity: Math.min(1, bar * 3), boxShadow: "0 18px 40px -18px rgb(0 0 0 / 0.6)" }}>
          <span className="flex items-center gap-3 whitespace-nowrap">
            <RiGithubFill className="size-9" style={{ opacity: tw(f, 68, 6) }} />
            {label}
          </span>
        </div>
      </At>
      <At y={810}>
        <p className={`${display} text-[30px] tracking-[-0.01em] text-[#8b8b8b]`} style={{ opacity: tw(f, 108, 12) }}>
          Free · Your servers · Your own AI key
        </p>
      </At>
    </Canvas>
  );
}

export { RiArrowRightLine };
