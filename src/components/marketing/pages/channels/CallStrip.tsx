"use client";

import { RiReplay5Line } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { useClock } from "./useClock";

/**
 * The stages AgentSDR's live call strip shows (docs/whatsapp/calling), then
 * what happens to the recording. A stereo waveform draws while recording:
 * your microphone on the left channel, the lead on the right.
 */

const STAGES = ["Opening WhatsApp…", "Calling…", "Ringing, recording starts when they pick up", "Recording", "Saved to your R2 bucket", "Transcribed"] as const;
const BARS = 44;

function height(i: number, channel: 0 | 1) {
  const x = Math.sin(i * 1.7 + channel * 2.3) * Math.sin(i * 0.45 + channel);
  return 10 + Math.abs(x) * 30;
}

export function CallStrip({ accent = "#1fc16b" }: { accent?: string }) {
  const { ref, p, reduced, replay } = useClock(9000);
  const stage = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
  const recording = stage >= 3;
  const drawn = stage === 3 ? Math.round(((p * STAGES.length - 3) % 1) * BARS) : stage > 3 ? BARS : 0;
  return (
    <div ref={ref} className="rounded-[28px] bg-[#f4f5f7] p-4 sm:p-6" role="img" aria-label="A call strip moving from opening WhatsApp, to calling, ringing and recording, then saving the recording and transcribing it. An illustration.">
      <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_16px_40px_-20px_rgb(14_18_27/0.22)] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="relative flex size-3">
            {recording && stage === 3 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#e5484d] opacity-60" />}
            <span className="relative inline-flex size-3 rounded-full" style={{ background: stage === 3 ? "#e5484d" : stage > 3 ? accent : "#c9cdd4" }} />
          </span>
          <p className="text-[15px] font-medium leading-[24px] text-[#141414]">{STAGES[stage]}</p>
        </div>

        <div className="mt-5 space-y-2" aria-hidden="true">
          {([0, 1] as const).map((channel) => (
            <div key={channel} className="flex items-center gap-3">
              <span className="w-10 shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-[#8a8f98]">{channel === 0 ? "You" : "Lead"}</span>
              <div className="flex h-12 flex-1 items-center gap-[3px]">
                {Array.from({ length: BARS }, (_, i) => (
                  <span key={i} className="w-full rounded-full" style={{ height: i < drawn ? height(i, channel) : 3, background: i < drawn ? (channel === 0 ? "#141414" : accent) : "#e4e6ea", transition: "height 160ms, background 160ms" }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <ol className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#eceef1] pt-4 text-[13px] leading-[20px] sm:grid-cols-3">
          {STAGES.map((label, i) => (
            <li key={label} className={cn("flex items-start gap-2 transition-colors duration-300", i <= stage ? "text-[#141414]" : "text-[#a1a1a1]")}>
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: i <= stage ? accent : "#d4d7dd" }} />
              {label.split(",")[0]}
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-[12px] text-[#8a8f98]">
        <span>Illustration, not a real recording.</span>
        {!reduced && (
          <button type="button" onClick={replay} aria-label="Replay the call" className="flex items-center gap-1 rounded-full px-2 py-1 hover:text-[#141414]">
            <RiReplay5Line className="size-4" aria-hidden="true" /> Replay
          </button>
        )}
      </div>
    </div>
  );
}
