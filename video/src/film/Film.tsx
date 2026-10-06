import type { ComponentType } from "react";
import { AbsoluteFill, Audio, getInputProps, getStaticFiles, interpolate, Sequence, staticFile } from "remotion";
import DialogProvider from "@/components/DialogProvider";
import landing from "@/components/landing/landing.module.css";
import { FONT_VARS } from "../fonts";
import { LogoOpen, LOGO } from "./logo";
import { Everything, EVERYTHING } from "./overview";
import { Hook, HOOK, HOOK_CLICKS, Icp, ICP, Meet, MEET, STACK } from "./scenes1";
import { TablesScene, TABLES } from "./tables";
import { Swoosh, SWOOSH } from "./scenes2";
import { ChannelTour, CHANNEL_TOUR, ThreeChannels, THREE } from "./channels";
import { EndCard, END } from "./scenes3";
import { CrmScene, CRM, CRM_CLICKS } from "./crm";

/**
 * The launch film: the open-source hook, Meet AgentSDR, the ICP typed in,
 * leads landing in Tables and enriched, three channels into one open-source
 * platform and each channel at work, then — "and when they reply" — the
 * CRM: every reply in one queue, read and drafted by AI, sent in one click,
 * followed up on its own; and the end card. Scenes play
 * back to back; each handles its own entrance and exit.
 */

export const SCENES: { id: string; component: ComponentType; frames: number }[] = [
  { id: "logo", component: LogoOpen, frames: LOGO },
  { id: "hook", component: Hook, frames: HOOK },
  { id: "meet", component: Meet, frames: MEET },
  { id: "icp", component: Icp, frames: ICP },
  { id: "tables", component: TablesScene, frames: TABLES },
  { id: "everything", component: Everything, frames: EVERYTHING },
  { id: "three-channels", component: ThreeChannels, frames: THREE },
  { id: "channel-tour", component: ChannelTour, frames: CHANNEL_TOUR },
  { id: "swoosh", component: Swoosh, frames: SWOOSH },
  { id: "crm", component: CrmScene, frames: CRM },
  { id: "end", component: EndCard, frames: END },
];

export const STARTS = SCENES.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SCENES[i - 1].frames], []);
export const FILM_FRAMES = STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].frames;

/** The score, if video/public/music.(wav|mp3) exists; 1.5 dB down so the effects never push the mix past 0 dBFS, and faded out over the last second. */
function Score() {
  // Which track: --props='{"music":"music-3.wav"}' picks a variant, "none" renders the effects alone.
  const pick = (getInputProps() as { music?: string }).music;
  if (pick === "none") return null;
  const file = getStaticFiles().find((f) => (pick ? f.name === pick : /^music\.(wav|mp3)$/.test(f.name)));
  if (!file) return null;
  // Starts with the hook: the logo opener is silent, so the drop stays on the arrow.
  const end = FILM_FRAMES - LOGO;
  return (
    <Sequence from={LOGO} layout="none">
      <Audio
        src={staticFile(file.name)}
        volume={(f) => interpolate(f, [0, 6, end - 36, end], [0, 0.84, 0.84, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    </Sequence>
  );
}

const at = (id: string) => STARTS[SCENES.findIndex((s) => s.id === id)];

/**
 * The sound design: soft, short UI sounds (tools/sfx.ts) on what happens on
 * screen, mixed well under the score — key ticks under typing, a tick as a
 * row lands, a click on each press, a pop as a chip or pill appears, a
 * two-note chime when something is sent, a whoosh on the big moves.
 * Offsets are frames into each scene (see the scene files' timings).
 */
type Sfx = { file: string; frame: number; volume: number; frames?: number };

const VOL = { click: 0.34, tick: 0.16, typing: 0.14, pop: 0.2, chime: 0.18, success: 0.2, whoosh: 0.16, swipe: 0.13 } as const;
const fx = (id: string, offset: number, sound: keyof typeof VOL, frames?: number): Sfx => ({ file: `sfx/${sound}.wav`, frame: at(id) + offset, volume: VOL[sound], frames });
const typing = (id: string, offset: number, frames: number) => fx(id, offset, "typing", frames);

const SFX: Sfx[] = [
  // Logo: Shade hops.
  fx("logo", 9, "pop"),
  // Hook: the tool tabs open, the camera moves in, each is clicked closed, ours lands, in on it, fade.
  ...[0, 1, 2, 3, 4, 5].map((i) => fx("hook", STACK.tabsAt + i * STACK.tabEvery, "tick")),
  fx("hook", STACK.zoomIn, "swipe"),
  ...HOOK_CLICKS.map((c) => fx("hook", c, "click")),
  fx("hook", STACK.ours, "pop"),
  fx("hook", STACK.oursZoom, "swipe"),
  fx("hook", STACK.out - 2, "whoosh"),
  // Meet: Shade lands in the tile; the wordmark slides out.
  fx("meet", 44, "pop"),
  fx("meet", 54, "swipe"),
  // ICP: the brief is typed, the camera pushes in, Find leads.
  typing("icp", 24, 36),
  fx("icp", 44, "swipe"),
  fx("icp", 82, "click"),
  // Tables: five leads land, the catalog opens, two picks, the columns fill, done.
  ...[6, 12, 18, 24, 30].map((o) => fx("tables", o, "tick")),
  fx("tables", 36, "swipe"),
  fx("tables", 56, "click"),
  fx("tables", 78, "click"),
  typing("tables", 88, 10),
  typing("tables", 100, 10),
  fx("tables", 114, "chime"),
  // Everything: the dashboard rises.
  fx("everything", 2, "whoosh"),
  // Three channels: the logos land, merge, and AgentSDR bursts out.
  ...[1, 5, 9].map((o) => fx("three-channels", o, "pop")),
  fx("three-channels", 22, "swipe"),
  fx("three-channels", 29, "success"),
  // The channels: each swings in, its action lifts, is pressed, changes state, and its pill lands.
  ...[0, 1, 2].flatMap((c) => [
    fx("channel-tour", c * 60, "swipe"),
    fx("channel-tour", c * 60 + 22, "pop"),
    fx("channel-tour", c * 60 + 36, "click"),
    fx("channel-tour", c * 60 + 40, "chime"),
  ]),
  // The arrow zooms through (the score's drop carries the moment).
  fx("swoosh", 34, "whoosh"),
  // CRM: replies land, get classified, the draft is written and sent, two more sends, the board, all clear.
  ...[8, 15, 22, 29, 36].map((o) => fx("crm", o, "tick")),
  ...[64, 72, 80, 88, 96].map((o) => fx("crm", o, "pop")),
  fx("crm", 120, "swipe"),
  typing("crm", 128, 48),
  ...CRM_CLICKS.map((c) => fx("crm", c, "click")),
  ...CRM_CLICKS.map((c) => fx("crm", c + 3, "chime")),
  fx("crm", 246, "whoosh"),
  fx("crm", 266, "swipe"),
  fx("crm", 290, "swipe"),
  fx("crm", 326, "success"),
  // End: Shade lands, the name and line type out, the bar opens and types the link.
  fx("end", 3, "pop"),
  typing("end", 14, 9),
  typing("end", 32, 14),
  fx("end", 60, "swipe"),
  typing("end", 70, 28),
];

export function Film() {
  return (
    <AbsoluteFill className={landing.page} style={{ ...FONT_VARS, background: "#f7f7f6" }}>
      <Score />
      {SFX.map((s, i) => (
        <Sequence key={i} from={s.frame} durationInFrames={s.frames ?? 60} layout="none">
          <Audio src={staticFile(s.file)} volume={s.frames ? (f) => s.volume * Math.min(1, (s.frames! - f) / 3) : s.volume} />
        </Sequence>
      ))}
      <DialogProvider>
        {SCENES.map(({ id, component: Scene, frames }, i) => (
          <Sequence key={id} name={id} from={STARTS[i]} durationInFrames={frames}>
            <Scene />
          </Sequence>
        ))}
      </DialogProvider>
    </AbsoluteFill>
  );
}
