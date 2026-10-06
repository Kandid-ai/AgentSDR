import type { ComponentType } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { RiDashboard3Line } from "@remixicon/react";
import { CHANNEL_META } from "@/components/analytics/theme";
import { views, type ViewProps } from "@/components/analytics/views";
import { OVERVIEW } from "@/components/landing/data/analytics";
import { PageHeader } from "@/components/page/PageHeader";
import { ANALYTICS_CHANNELS } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { AppScreen } from "../screens/Shell";
import { EASE, GLIDE, between, tw } from "../kit/motion";
import { At, Canvas, Type } from "./kit";

/**
 * "Everything an SDR team does, handled for you." — the line at the top,
 * and under it the real Analytics overview rising into frame, its numbers
 * counting up and its charts growing as the frame advances (the view is
 * fed the sample data scaled by the count's progress).
 */

export const EVERYTHING = 90;

// Values that describe rather than count keep their real value throughout. `previous`
// scales with the current value, so every delta reads its true change while counting.
const FIXED = new Set(["stageRank", "replyRate", "overrideRate", "medianFirstResponseMinutes"]);

function scaled<T>(value: T, p: number, key = ""): T {
  if (typeof value === "number") return (FIXED.has(key) ? value : Math.round(value * p)) as T;
  if (Array.isArray(value)) return value.map((v) => scaled(v, p, key)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scaled(v, p, k);
    return out as T;
  }
  return value;
}

const OverviewView = views.overview as unknown as ComponentType<ViewProps<"overview">>;

const TABS = [{ key: "overview", label: "Overview", icon: RiDashboard3Line, color: undefined as string | undefined }, ...ANALYTICS_CHANNELS.map((c) => ({ key: c, label: CHANNEL_META[c].label, icon: CHANNEL_META[c].icon, color: CHANNEL_META[c].color }))];

export function Dashboard({ p }: { p: number }) {
  return (
    <AppScreen path="/analytics" active="/analytics" width={1440} height={1000}>
      <div className="h-full overflow-hidden bg-bg-white-0 px-8 py-6">
        <PageHeader title="Analytics" description="How conversations turn into meetings and customers, and which channels bring them in." />
        <div className="mt-6 flex gap-5 border-b border-stroke-soft-200">
          {TABS.map(({ key, label, icon: Icon, color }) => {
            const active = key === "overview";
            return (
              <span key={key} className={cn("relative flex h-10 items-center gap-2 text-label-sm", active ? "text-text-strong-950" : "text-text-sub-600")}>
                <span className={cn("flex", color ? !active && "opacity-70" : active ? "text-text-strong-950" : "text-text-soft-400")} style={color ? { color } : undefined}>
                  <Icon className="size-[18px]" />
                </span>
                {label}
                <span className={cn("absolute inset-x-0 bottom-0 h-0.5 rounded-full", active ? "bg-primary-base" : "bg-transparent")} />
              </span>
            );
          })}
        </div>
        <div className="mt-6">
          <OverviewView data={scaled(OVERVIEW, p)} loading={false} onSelectView={() => {}} />
        </div>
      </div>
    </AppScreen>
  );
}

const WIN = { w: 1560, top: 420 };
const K = WIN.w / 1440;

export function Everything() {
  const f = useCurrentFrame();
  const rise = tw(f, 0, 18, EASE);
  const count = tw(f, 12, 44, EASE);
  const pan = between(f, 30, 50, 0, -150, GLIDE);
  const out = tw(f, EVERYTHING - 12, 12, GLIDE);
  return (
    <Canvas>
      <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 12}px)` : undefined }}>
        <At y={250}>
          <Type text={"Everything an SDR team does,\nhandled for you."} start={0} size={74} every={2} />
        </At>
        {/* The dashboard, rising into the lower half and running off the bottom of the frame. */}
        <div className="absolute left-1/2 overflow-hidden" style={{ top: WIN.top, width: WIN.w, height: 1080 - WIN.top, transform: "translateX(-50%)", perspective: 2400 }}>
          <div
            style={{
              transformOrigin: "50% 0",
              transform: `translateY(${(1 - rise) * 260 + pan}px) rotateX(${(1 - rise) * 18}deg) scale(${K})`,
              opacity: Math.min(1, rise * 1.4),
              width: 1440,
              marginLeft: (WIN.w - 1440) / 2,
            }}
          >
            <Dashboard p={0.03 + 0.97 * count} />
          </div>
        </div>
        {/* Soft fade where the dashboard meets the bottom edge. */}
        <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(180deg, rgb(247 247 246 / 0), #f7f7f6)" }} />
      </AbsoluteFill>
    </Canvas>
  );
}
