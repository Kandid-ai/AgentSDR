"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  RiBookOpenLine,
  RiBracesLine,
  RiChat3Line,
  RiCommandLine,
  RiFlowChart,
  RiInbox2Fill,
  RiLinkedinBoxFill,
  RiListOrdered2,
  RiMailFill,
  RiMicLine,
  RiPhoneLine,
  RiPriceTag3Line,
  RiRepeatLine,
  RiSearchLine,
  RiShieldCheckLine,
  RiSpeedUpLine,
  RiStackLine,
  RiTimerLine,
  RiWhatsappFill,
} from "@remixicon/react";
import { HUE } from "@/components/analytics/theme";
import { EmailView } from "@/components/analytics/views/EmailView";
import { cn } from "@/utils/cn";
import { EMAIL } from "./data/analytics";
import styles from "./landing.module.css";
import { Reveal } from "./Reveal";
import { SCENES, SceneFit } from "./scenes";
import sceneStyles from "./scenes/scenes.module.css";
import { ActionsScreen, CallsScreen, InboxScreen } from "./screens";
import { Showcase } from "./Showcase";
import { SectionHead } from "./ui";

/**
 * Channels: a quiet list on the left (Email, LinkedIn, WhatsApp, and the AI
 * CRM they all feed) and a stage on the right. Each channel plays as a short
 * tour: first its real screen — at natural size, a top-left slice that runs
 * off the stage's right and bottom edges and fades there — then one scene per
 * capability, each a small animation of what that capability does. The
 * active channel opens to its four capabilities; the one playing is lit, with
 * its own loader, while the channel's rail fills across the whole tour.
 *
 * It advances on its own while the section is in view, and pauses (mid-step,
 * where it is) only while keyboard focus is inside. Picking a channel or a
 * capability jumps the tour there and plays that step from its start, then
 * carries on to the next. With reduced motion it never advances and every
 * scene shows its final frame. On a phone the list becomes
 * tabs above, and the capabilities a four-step stepper.
 */

type Capability = { icon: ComponentType<{ className?: string; style?: CSSProperties }>; label: string; detail: string };

type Item = {
  key: string;
  label: string;
  summary: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  capabilities: Capability[];
  /** Width the screen is laid out at (natural scale); the stage shows a centred slice of it. */
  canvas: number;
};

const ITEMS: Item[] = [
  {
    key: "email",
    label: "Email",
    summary: "Sequences from your own Google Workspace mailboxes.",
    icon: RiMailFill,
    color: HUE.orange,
    capabilities: [
      { icon: RiBracesLine, label: "Merge fields", detail: "Any CSV or XLSX column, plus {A|B} spin text" },
      { icon: RiTimerLine, label: "Per-mailbox limits", detail: "Daily cap, sending window and signature" },
      { icon: RiStackLine, label: "Mailbox pool", detail: "Campaigns share mailboxes, assigned round-robin" },
      { icon: RiShieldCheckLine, label: "Clean lists", detail: "One-click unsubscribe; bounces suppressed" },
    ],
    canvas: 1040,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    summary: "Invites and follow-ups across several accounts, via Unipile.",
    icon: RiLinkedinBoxFill,
    color: HUE.blue,
    capabilities: [
      { icon: RiListOrdered2, label: "Sequence", detail: "Invite, accept message and three follow-ups" },
      { icon: RiSpeedUpLine, label: "Safe pacing", detail: "30 invites a day on premium, 5 on free, inside working hours" },
      { icon: RiSearchLine, label: "Search batches", detail: "Up to 400 leads a day per account into campaigns" },
      { icon: RiChat3Line, label: "Replies inbox", detail: "Every LinkedIn reply in one thread view, AI draft ready" },
    ],
    canvas: 1040,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    summary: "Calls dialled and recorded in WhatsApp Web, plus messages.",
    icon: RiWhatsappFill,
    color: HUE.green,
    capabilities: [
      { icon: RiPhoneLine, label: "One-click calls", detail: "A Chrome extension dials inside WhatsApp Web" },
      { icon: RiMicLine, label: "Recorded & transcribed", detail: "Both sides to your R2 bucket, your model writes it up" },
      { icon: RiRepeatLine, label: "Retries", detail: "Unanswered leads called again after 1, 2 and 4 days" },
      { icon: RiChat3Line, label: "Messages", detail: "24-hour warm-up, 25 new chats a day per number" },
    ],
    canvas: 1040,
  },
  {
    key: "crm",
    label: "AI CRM & inbox",
    summary: "Every reply classified, every answer drafted and queued for you.",
    icon: RiInbox2Fill,
    color: "#141414",
    capabilities: [
      { icon: RiPriceTag3Line, label: "Classification", detail: "Interested, Customer, Not interested or Other — your stages" },
      { icon: RiBookOpenLine, label: "Grounded drafts", detail: "Written from your knowledge base, held for approval" },
      { icon: RiFlowChart, label: "Reply sequences", detail: "Every follow-up step drafted for review" },
      { icon: RiCommandLine, label: "Keyboard-first", detail: "J / K to move, Enter to open, ⌘K to jump" },
    ],
    canvas: 1040,
  },
];

// Each scene's timeline ends by ~2.8 s at SCENE_SPEED; the rest of a step holds its final frame.
const OVERVIEW_MS = 1600;
const CAPABILITY_MS = 3400;
const TOUR_MS = OVERVIEW_MS + 4 * CAPABILITY_MS;

/** Where the tour is: a channel, and a step in it — 0 is its screen, 1–4 its capabilities. */
type Position = { channel: number; step: number };

const stepMs = (step: number) => (step === 0 ? OVERVIEW_MS : CAPABILITY_MS);
/** The share of the channel's tour done before `step` starts. */
const doneBefore = (step: number) => (step === 0 ? 0 : OVERVIEW_MS + (step - 1) * CAPABILITY_MS) / TOUR_MS;
const next = ({ channel, step }: Position): Position => (step < 4 ? { channel, step: step + 1 } : { channel: (channel + 1) % ITEMS.length, step: 0 });
const keyOf = ({ channel, step }: Position) => `${channel}-${step}`;

export function Channels() {
  const [position, setPosition] = useState<Position>({ channel: 0, step: 0 });
  // Bumped on every pick, so choosing the step already playing still replays it from the start.
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(true);
  const baseId = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = useRef<HTMLUListElement | null>(null);
  // Where the rail stops for each step of the open channel, as a share of its item's height: the
  // summary's bottom for the overview, then each capability row's bottom. Measured, so a click on a
  // capability fills the rail exactly to that row whatever the text wraps to. Null below lg.
  const railRefs = useRef<Array<HTMLLIElement | null>>([]);
  const summaryRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const capRefs = useRef<Array<Array<HTMLLIElement | null>>>([]);
  const [stops, setStops] = useState<number[] | null>(null);
  // Time left on the current step, so a pause resumes where it stopped rather than starting the step over.
  const remaining = useRef({ key: "", ms: 0 });

  const { channel: index, step } = position;

  useLayoutEffect(() => {
    const item = railRefs.current[index];
    if (!item) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      const height = item.getBoundingClientRect().height;
      const top = item.getBoundingClientRect().top;
      const bottomOf = (el: Element | null | undefined) => (el ? (el.getBoundingClientRect().bottom - top) / height : 1);
      if (!wide.matches || height === 0) return setStops(null);
      setStops([bottomOf(summaryRefs.current[index]), ...[0, 1, 2, 3].map((c) => bottomOf(capRefs.current[index]?.[c]))].map((v) => Math.min(1, Math.max(0, v))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(item);
    wide.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, [index]);

  // On a phone the tabs scroll sideways: keep the active one in view (the list only, never the page).
  useEffect(() => {
    const list = listRef.current;
    const tab = tabRefs.current[index];
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: Math.max(0, tab.offsetLeft - 16), behavior: "smooth" });
  }, [index]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The tour only runs while someone can see it.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animated = !reduced;
  const running = animated && !paused && inView;
  // Keys the step's timer and every animation of it: the position, and which pick started it.
  const runKey = `${keyOf(position)}-${run}`;
  useEffect(() => {
    if (!running) return;
    const key = runKey;
    if (remaining.current.key !== key) remaining.current = { key, ms: stepMs(position.step) };
    const started = performance.now();
    const id = window.setTimeout(() => setPosition(next(position)), remaining.current.ms);
    return () => {
      window.clearTimeout(id);
      if (remaining.current.key === key) remaining.current.ms = Math.max(0, remaining.current.ms - (performance.now() - started));
    };
  }, [running, position, runKey]);

  const choose = (channel: number, chosenStep = 0) => {
    setPosition({ channel, step: chosenStep });
    setRun((r) => r + 1);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!(event.target as HTMLElement).dataset.channelTab) return;
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (event.key === "Home" || event.key === "End" || event.key in keys) {
      event.preventDefault();
      const target = event.key === "Home" ? 0 : event.key === "End" ? ITEMS.length - 1 : (index + keys[event.key] + ITEMS.length) % ITEMS.length;
      choose(target);
      tabRefs.current[target]?.focus();
    }
  };

  const current = ITEMS[index];
  const capability = step > 0 ? current.capabilities[step - 1] : null;
  const Scene = step > 0 ? SCENES[current.key][step - 1] : null;
  const stageId = `${baseId}-stage`;
  // The step's progress, as CSS reads it: from / to (share of the bar) and how long. Paused with the timer.
  const progress = (from: number, to: number): CSSProperties =>
    ({ "--from": from, "--to": to, "--ms": `${stepMs(step)}ms`, animationPlayState: running ? "running" : "paused" }) as CSSProperties;

  return (
    <section ref={sectionRef} id="channels" aria-labelledby="channels-title" className="scroll-mt-24 bg-white pb-16 pt-10 sm:pb-20 sm:pt-14">
      <Reveal>
        <SectionHead
          id="channels-title"
          eyebrow="Channels"
          title="Every channel, one workspace"
          lede="Email, LinkedIn and WhatsApp run side by side, and every reply lands in one AI CRM. Pick a channel, or one of its capabilities, to see it work."
        />
      </Reveal>

      <div
        className="mx-auto mt-12 grid max-w-[1128px] gap-6 px-4 sm:mt-16 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[320px_minmax(0,1fr)]"
        // Keyboard focus holds the tour still (a pointer click focuses too, but should not).
        onFocusCapture={(event) => setPaused((event.target as HTMLElement).matches(":focus-visible"))}
        onBlurCapture={() => setPaused(false)}
      >
        {/* The list: a channel button per item; the active one opens to its capabilities (wide screens) */}
        <ul ref={listRef} aria-label="Channels" onKeyDown={onKeyDown} className="-mx-4 flex gap-1 overflow-x-auto border-b border-black/[0.06] px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-b-0 [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((item, i) => {
            const on = i === index;
            const Icon = item.icon;
            const accent = accentOf(item);
            return (
              <li
                key={item.key}
                ref={(el) => {
                  railRefs.current[i] = el;
                }}
                className="relative shrink-0 lg:pl-6"
              >
                {/* The rail: a hairline on every item; on the active one it fills in the channel colour across the tour. */}
                <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[2px] lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[2px] lg:bg-black/[0.06]">
                  {on &&
                    (animated ? (
                      <span
                        key={runKey}
                        className={cn("block size-full", sceneStyles.fillY)}
                        style={{
                          backgroundColor: accent,
                          ...(stops ? progress(step === 0 ? 0 : stops[step - 1], stops[step]) : progress(doneBefore(step), doneBefore(step) + stepMs(step) / TOUR_MS)),
                        }}
                      />
                    ) : (
                      // Reduced motion: filled to the current row (the whole tab underline on phones), settling there.
                      <span
                        className="block size-full transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
                        style={{ backgroundColor: accent, transformOrigin: "top", transform: stops ? `scaleY(${stops[step]})` : undefined }}
                      />
                    ))}
                </span>
                <button
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  data-channel-tab=""
                  aria-current={on ? "true" : undefined}
                  aria-controls={stageId}
                  aria-label={`${item.label}: ${item.summary}`}
                  onClick={() => choose(i)}
                  className="group flex items-center gap-2.5 rounded-md px-3 pb-3 pt-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#335cff] lg:w-full lg:px-0 lg:pb-0 lg:pt-4"
                >
                  <Icon className={cn("size-5 shrink-0 transition-colors duration-300", !on && "text-[#a3a3a3] group-hover:text-[#6b6b6b]")} style={on ? { color: item.color } : undefined} aria-hidden="true" />
                  <span className={cn("whitespace-nowrap text-[15px] font-medium leading-6 transition-colors duration-300", on ? "text-[#141414]" : "text-[#8a8a8a] group-hover:text-[#3a3a3a]")}>{item.label}</span>
                </button>
                {/* Summary and capabilities, open on the active item only (wide screens); inert while closed */}
                <div inert={!on} className={cn("hidden overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.6,.6,0,1)] motion-reduce:transition-none lg:grid", on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                  <div className="min-h-0">
                    <p
                      ref={(el) => {
                        summaryRefs.current[i] = el;
                      }}
                      className="mt-1 pl-[30px] text-[15px] leading-[23px] text-[#2b2b2b]"
                    >
                      {item.summary}
                    </p>
                    <ol aria-label={`${item.label} capabilities`} className="mt-3 grid gap-0.5 pb-4 pl-[22px]">
                      {item.capabilities.map((cap, c) => (
                        <li
                          key={cap.label}
                          ref={(el) => {
                            (capRefs.current[i] ??= [])[c] = el;
                          }}
                        >
                          <CapabilityButton
                            capability={cap}
                            accent={accent}
                            state={!on || step === 0 ? "idle" : step === c + 1 ? "active" : "muted"}
                            controls={stageId}
                            onClick={() => choose(i, c + 1)}
                            loader={on && step === c + 1 && animated ? <span key={runKey} className={cn("block h-full rounded-full", sceneStyles.fillX)} style={{ backgroundColor: accent, ...progress(0, 1) }} /> : null}
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* On phones and tablets: a four-step stepper between the tabs and the stage */}
        <div className="lg:hidden">
          <ol aria-label={`${current.label} capabilities`} className="flex gap-1.5">
            {current.capabilities.map((cap, c) => {
              const accent = accentOf(current);
              const done = step > c + 1;
              const playing = step === c + 1;
              return (
                <li key={cap.label} className="flex-1">
                  <button
                    type="button"
                    aria-label={cap.label}
                    aria-current={playing ? "step" : undefined}
                    aria-controls={stageId}
                    onClick={() => choose(index, c + 1)}
                    className="flex h-7 w-full items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#335cff]"
                  >
                    <span className="block h-[3px] w-full overflow-hidden rounded-full bg-black/[0.08]">
                      {(done || playing) && (
                        <span
                          key={playing && animated ? runKey : "still"}
                          className={cn("block h-full rounded-full", playing && animated && sceneStyles.fillX)}
                          style={{ backgroundColor: accent, ...(playing && animated ? progress(0, 1) : null) }}
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-1.5 min-h-[48px] text-[14px] leading-6 text-[#3a3a3a]">
            {capability ? (
              <>
                <span className="font-medium text-[#141414]">{capability.label}</span>
                <span className="text-[#7a7a7a]"> · {capability.detail}</span>
              </>
            ) : (
              current.summary
            )}
          </p>
        </div>

        {/* The stage: the channel's screen, then a scene per capability, cross-fading */}
        <div id={stageId} className="min-w-0">
          <div className={cn(styles.stage, "relative h-[460px] overflow-hidden rounded-3xl sm:h-[600px]")}>
            <Crossfade layerKey={runKey}>
              {Scene && capability ? (
                <Showcase label={`${current.label}, ${capability.label}: ${capability.detail}. An illustration with sample data.`} className="absolute inset-0">
                  <SceneFit>
                    <Scene reduced={reduced} />
                  </SceneFit>
                </Showcase>
              ) : (
                <div className={cn(styles.stageFade, "absolute inset-0")}>
                  <Showcase label={`AgentSDR ${current.label} screen with sample data`}>
                    <div
                      className="absolute left-5 top-8 h-[560px] w-[600px] overflow-hidden rounded-2xl bg-bg-white-0 shadow-[0_0_0_1px_rgb(14_18_27/0.07),0_24px_60px_-20px_rgb(14_18_27/0.25)] sm:left-10 sm:top-10 sm:h-[640px] lg:w-[var(--canvas)]"
                      style={{ "--canvas": `${current.canvas}px` } as CSSProperties}
                    >
                      {current.key === "email" && (
                        <div className="px-7 py-6">
                          <EmailView data={EMAIL} loading={false} />
                        </div>
                      )}
                      {current.key === "linkedin" && <InboxScreen showDetails={false} />}
                      {current.key === "whatsapp" && <CallsScreen />}
                      {current.key === "crm" && <ActionsScreen />}
                    </div>
                  </Showcase>
                </div>
              )}
            </Crossfade>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The CRM's colour is near-black; its rail and highlights use the app's blue instead. */
function accentOf(item: Item): string {
  return item.color === "#141414" ? HUE.blue : item.color;
}

function CapabilityButton({
  capability: { icon: Icon, label, detail },
  accent,
  state,
  controls,
  onClick,
  loader,
}: {
  capability: Capability;
  accent: string;
  /** idle: the channel's screen is showing, all read alike; active: this one's scene is playing. */
  state: "idle" | "active" | "muted";
  controls: string;
  onClick: () => void;
  loader: ReactNode;
}) {
  const active = state === "active";
  return (
    <button
      type="button"
      aria-current={active ? "step" : undefined}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "group flex w-full gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-opacity duration-500 focus-visible:ring-2 focus-visible:ring-[#335cff]",
        state === "muted" ? "opacity-[0.42] hover:opacity-80" : "opacity-100",
      )}
    >
      <span
        aria-hidden="true"
        className="mt-px flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition-colors duration-500"
        style={{
          backgroundColor: active ? `color-mix(in srgb, ${accent} 12%, white)` : "#f4f5f7",
          // A ring in the channel colour while playing, the neutral hairline otherwise.
          ["--tw-ring-color" as string]: active ? `color-mix(in srgb, ${accent} 30%, transparent)` : "rgb(0 0 0 / 0.05)",
        }}
      >
        <Icon className="size-3.5 transition-colors duration-500" style={{ color: active ? accent : "#6b6b6b" }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-5 text-[#141414]">{label}</span>
        <span className="block text-[13px] leading-5 text-[#7a7a7a]">{detail}</span>
        {/* The capability's loader: a hairline that fills while its scene plays */}
        <span aria-hidden="true" className={cn("mt-1.5 block h-[2px] overflow-hidden rounded-full bg-black/[0.06] transition-opacity duration-300", loader ? "opacity-100" : "opacity-0")}>
          {loader}
        </span>
      </span>
    </button>
  );
}

/**
 * Cross-fades the stage when its content changes: the new layer comes in over
 * the old one, which stays mounted — on its last frame — until it has faded.
 */
function Crossfade({ layerKey, children }: { layerKey: string; children: ReactNode }) {
  const [current, setCurrent] = useState<{ key: string; node: ReactNode }>({ key: layerKey, node: children });
  const [leaving, setLeaving] = useState<{ key: string; node: ReactNode } | null>(null);
  if (current.key !== layerKey) {
    setLeaving(current);
    setCurrent({ key: layerKey, node: children });
  }
  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => setLeaving(null), 420);
    return () => window.clearTimeout(id);
  }, [leaving]);
  return (
    <>
      {leaving && leaving.key !== layerKey && (
        <div key={leaving.key} aria-hidden="true" inert className={cn(sceneStyles.layerOut, "absolute inset-0")}>
          {leaving.node}
        </div>
      )}
      <div key={layerKey} className={cn(sceneStyles.layerIn, "absolute inset-0")}>
        {children}
      </div>
    </>
  );
}
