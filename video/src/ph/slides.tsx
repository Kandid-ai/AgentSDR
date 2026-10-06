import type { ComponentType, ReactNode } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import {
  RiArrowDownLine,
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiCheckLine,
  RiDatabase2Line,
  RiGithubFill,
  RiKey2Line,
  RiServerLine,
  RiSparkling2Fill,
} from "@remixicon/react";
import { AppIcon } from "@/components/brand/Logo";
import { CYCLES } from "@/components/brand/mascotFrames";
import { TOOLS } from "@/components/landing/data/tools";
import type { PipelineStage } from "@/components/crm/CrmActionsClient";
import { actionOf, ActionRequiredPage, CRM_LEADS, DraftComposer, OMAR, PipelineBoard, PreloadFaces, type BoardCard } from "../film/crmUi";
import { Card, display, Hand, INK } from "../film/kit";
import { Dashboard } from "../film/overview";
import { Shade, shadePose, ShadeTile } from "../film/shade";
import { CallCard, EmailCard, InboxList, LiThread, NoteCard, ProfileCard, SequenceCard, SummaryCard, WaChat } from "../film/ui";
import { AppScreen } from "../screens/Shell";
import { BrandTile, Centre, Chip, Headline, PH, PW, Scaled, ShotWindow, Slide, WINDOW_SHADOW } from "./kit";

/** Large enough that every frame-driven film component shows its finished state. */
const DONE = 400;

const CLAY = "landing/tools/clay.png";
const GMAIL = "brands/gmail.svg";
const LINKEDIN = "brands/linkedin.svg";
const WHATSAPP = "brands/whatsapp.svg";

/* ---------------------------------------------------------------- CRM data */

const QUEUE = CRM_LEADS.map((lead) => actionOf(lead, { classified: true, draft: lead.draft }));
const QUEUE_KPIS = { queue: 5, drafts: 3, followUps: 1 };

function CrmQueue() {
  return (
    <AppScreen path="/crm/actions" active="/crm/actions" width={1440} height={930}>
      <ActionRequiredPage rows={QUEUE} kpis={QUEUE_KPIS} rowStyles="" tools={[]} />
    </AppScreen>
  );
}

const board = (): { columns: Record<PipelineStage, BoardCard[]>; counts: Record<PipelineStage, number> } => {
  const [maya, daniel, priya, lucas] = CRM_LEADS;
  return {
    columns: {
      needs_action: [daniel, priya].map((l) => ({ action: actionOf(l, { classified: true, draft: l.draft, stage: "needs_action" }) })),
      waiting: [maya, lucas].map((l) => ({ action: actionOf(l, { classified: true, stage: "waiting", sent: l.id === "maya" }) })),
      exhausted: [{ action: actionOf(OMAR, { classified: true, stage: "exhausted" }) }],
    },
    counts: { needs_action: 2, waiting: 2, exhausted: 1 },
  };
};

/* ================================================================ 01 · Hero */

export function Hero() {
  return (
    <Slide mark={false}>
      <PreloadFaces />
      <div className="absolute" style={{ left: 110, top: 268, width: 700 }}>
        <div className="flex items-center gap-5">
          <ShadeTile size={92} pose={shadePose(undefined, 0)} />
          <span className={`${display} text-[66px] font-semibold tracking-[-0.04em]`} style={{ color: INK }}>
            AgentSDR
          </span>
        </div>
        <h1 className={`${display} mt-10 whitespace-nowrap text-[92px] font-semibold leading-[0.98] tracking-[-0.045em]`} style={{ color: INK }}>
          The open-source
          <br />
          AI SDR
        </h1>
        <p className={`${display} mt-8 text-[32px] leading-[1.35] tracking-[-0.012em] text-[#5f5f5f]`}>
          Find leads, reach them on email, LinkedIn and WhatsApp, and let AI work every reply. On your own servers.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Chip>Self-hosted</Chip>
          <Chip>Your own AI key</Chip>
          <Chip>No seats</Chip>
        </div>
      </div>
      <Scaled w={1440} h={930} scale={0.7} x={845} y={245} style={{ borderRadius: 20, boxShadow: WINDOW_SHADOW }}>
        <CrmQueue />
      </Scaled>
    </Slide>
  );
}

/* ================================================================ 02 · One tab */

const STACK = ["Apollo.io", "Clay", "Instantly", "lemlist", "HeyReach", "HubSpot"].map((name) => TOOLS.find((t) => t.name === name)!);

function TabBar({ children, url, muted }: { children: ReactNode; url: string; muted?: boolean }) {
  return (
    <div className="w-[1500px] overflow-hidden rounded-[24px] bg-[#f1f1f0]" style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.07), 0 30px 60px -30px rgb(14 18 27 / 0.28)", opacity: muted ? 0.92 : 1 }}>
      <div className="flex h-[68px] items-end gap-6 px-7">
        <div className="mb-[22px] flex shrink-0 gap-2.5">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="size-[16px] rounded-full" style={{ background: c, filter: muted ? "grayscale(1)" : undefined, opacity: muted ? 0.5 : 1 }} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-end gap-1">{children}</div>
      </div>
      <div className="flex h-[60px] items-center gap-5 bg-white px-7">
        <span className="flex gap-4 text-[22px] text-[#b4b4b4]">
          <span>←</span>
          <span>→</span>
        </span>
        <span className="flex h-[38px] flex-1 items-center rounded-full bg-[#f1f1f0] px-5 text-[18px]" style={{ color: muted ? "#8a8a8a" : "#141414" }}>
          {url}
        </span>
      </div>
    </div>
  );
}

function Tab({ icon, name, on }: { icon: ReactNode; name: string; on?: boolean }) {
  return (
    <span className="flex h-[52px] w-[208px] shrink-0 items-center gap-3 rounded-t-[14px] px-4" style={{ background: on ? "#fff" : "transparent" }}>
      {icon}
      <span className="min-w-0 flex-1 truncate text-[19px]" style={{ color: on ? "#141414" : "#5a5a5a", fontWeight: on ? 500 : 400 }}>
        {name}
      </span>
      <span className="text-[15px] text-[#a0a0a0]">✕</span>
    </span>
  );
}

export function OneTab() {
  return (
    <Slide>
      <Headline title="One tab instead of six." sub="Leads, enrichment, email, LinkedIn, WhatsApp and the CRM in one workspace, with one record per lead." />
      <Centre y={455}>
        <div className="flex flex-col items-center" style={{ zoom: 1.08 }}>
          <TabBar url="app.apollo.io" muted>
            {STACK.map((t, i) => (
              <Tab key={t.name} on={i === 0} name={t.name} icon={<Img src={staticFile(t.src.replace(/^\//, ""))} style={{ width: 26, height: 26, objectFit: "contain", borderRadius: 6 }} />} />
            ))}
          </TabBar>
          <span className="my-10 flex size-[64px] items-center justify-center rounded-full bg-white text-[#141414]" style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 10px 24px -12px rgb(14 18 27 / 0.3)" }}>
            <RiArrowDownLine style={{ width: 32, height: 32 }} />
          </span>
          <TabBar url="agentsdr.ai">
            <Tab on name="AgentSDR" icon={<AppIcon small className="size-[26px]" />} />
          </TabBar>
        </div>
      </Centre>
    </Slide>
  );
}

/* ================================================================ 03 · Three channels */

export function ThreeChannelsSlide() {
  const tiles = [
    { src: GMAIL, name: "Email", inset: 0.6 },
    { src: LINKEDIN, name: "LinkedIn", inset: 0.62 },
    { src: WHATSAPP, name: "WhatsApp", inset: 0.66 },
  ];
  return (
    <Slide>
      <Headline title="Three channels. One platform." sub="Email from your own mailboxes, LinkedIn invites and messages, WhatsApp chats and calls, all on one lead record." />
      <Centre y={480}>
        <div className="flex items-center gap-14">
          {tiles.map((t) => (
            <div key={t.name} className="flex flex-col items-center gap-5">
              <BrandTile src={t.src} size={210} inset={t.inset} />
              <span className={`${display} text-[34px] font-medium tracking-[-0.02em] text-[#4a4a4a]`}>{t.name}</span>
            </div>
          ))}
          <RiArrowRightLine style={{ width: 64, height: 64, color: "#b4b4b4", marginBottom: 56 }} />
          <div className="flex flex-col items-center gap-5">
            <ShadeTile size={250} pose={shadePose(undefined, 0)} />
            <span className={`${display} text-[34px] font-semibold tracking-[-0.02em]`} style={{ color: INK }}>
              AgentSDR
            </span>
          </div>
        </div>
      </Centre>
    </Slide>
  );
}

/* ================================================================ 04 · Find */

export function Find() {
  return (
    <Slide>
      <Headline title="Tell it who you sell to." sub="Describe your buyer in plain words. AgentSDR finds the people and adds them to your lead database." />
      <div className="absolute" style={{ left: 640, top: 410 }}>
        <ShotWindow src="shots/leads.png" width={1120} path="/leads" />
      </div>
      <div className="absolute" style={{ left: 150, top: 560, width: 640 }}>
        <Card>
          <div className="p-7">
            <div className="flex items-center gap-2.5 text-[17px] font-medium text-[#6b6b6b]">
              <RiSparkling2Fill style={{ width: 20, height: 20, color: "#335cff" }} /> Who do you sell to?
            </div>
            <p className="mt-4 rounded-xl bg-[#f6f6f5] p-5 text-[25px] leading-[1.4] text-[#141414] ring-1 ring-inset ring-[#ececea]">Heads of Sales at US SaaS companies, 50–200 people</p>
            <div className="mt-5 flex items-center justify-end">
              <span className="inline-flex h-[52px] items-center gap-2 rounded-xl bg-[#335cff] px-6 text-[20px] font-semibold text-white">Find leads</span>
            </div>
          </div>
        </Card>
      </div>
    </Slide>
  );
}

/* ================================================================ 05 · Enrich */

const PROVIDERS = ["apollo.io", "hunter.io", "findymail.com", "leadmagic.io", "lusha.com", "zerobounce.net", "snov.io", "rocketreach.co", "contactout.com", "fullenrich.com", "icypeas.com", "millionverifier.com", "cleanlist.ai", "similarweb.com", "semrush.com"];

export function Enrich() {
  return (
    <Slide>
      <Headline
        title={
          <span className="inline-flex items-center gap-5">
            <Img src={staticFile(CLAY)} style={{ width: 86, height: 86, objectFit: "contain" }} />
            Clay enrichment, built in.
          </span>
        }
        sub="Pick any of 15 providers. Work emails are found, then verified, a whole column at a time."
      />
      <Centre y={410}>
        <div className="flex flex-col items-center">
          <div className="flex gap-3 rounded-[22px] bg-white p-3" style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.07), 0 16px 36px -18px rgb(14 18 27 / 0.3)" }}>
            {PROVIDERS.map((d) => (
              <span key={d} className="flex size-[64px] items-center justify-center rounded-[14px] bg-white ring-1 ring-inset ring-[#ececea]">
                <Img src={staticFile(`integrations/${d}.png`)} style={{ width: 40, height: 40, objectFit: "contain" }} />
              </span>
            ))}
          </div>
          <div className="mt-8">
            <ShotWindow src="shots/screens/workbook-enriched.png" width={1380} path="/tables" height={440} />
          </div>
        </div>
      </Centre>
    </Slide>
  );
}

/* ================================================================ 06–08 · Channels */

function ChannelSlide({ brand, inset, title, sub, cards }: { brand: string; inset: number; title: string; sub: string; cards: ReactNode }) {
  return (
    <Slide>
      <Headline title={title} sub={sub} top={170}>
        <div className="mb-7">
          <BrandTile src={brand} size={96} inset={inset} />
        </div>
      </Headline>
      <Centre y={520}>
        <div className="flex items-start gap-9">{cards}</div>
      </Centre>
    </Slide>
  );
}

/** A film card at `k`× — CSS zoom, so each card keeps its own intrinsic width. */
const big = (node: ReactNode, k = 1.2) => (
  <div style={{ zoom: k }}>
    <Card>{node}</Card>
  </div>
);

export function Email() {
  return (
    <ChannelSlide
      brand={GMAIL}
      inset={0.6}
      title="Sequences from your own mailboxes."
      sub="Personalised from each lead's data and sent inside the windows and daily limits that keep inboxes healthy."
      cards={
        <>
          {big(<EmailCard t={DONE} resolveAt={2} sendAt={999} />, 1.16)}
          {big(<SequenceCard t={DONE} doneAt={12} />, 1.16)}
          {big(<InboxList t={DONE} width={420} classifyAt={0} />, 1.16)}
        </>
      }
    />
  );
}

export function LinkedIn() {
  return (
    <ChannelSlide
      brand={LINKEDIN}
      inset={0.62}
      title="LinkedIn invites and messages."
      sub="A note written from each lead's profile, then the whole conversation, next to their email and WhatsApp."
      cards={
        <>
          {big(<NoteCard t={DONE} typeAt={0} />, 1.3)}
          {big(<ProfileCard t={DONE} connectAt={0} acceptedAt={0} />, 1.3)}
          {big(<LiThread t={DONE} />, 1.3)}
        </>
      }
    />
  );
}

export function WhatsApp() {
  return (
    <ChannelSlide
      brand={WHATSAPP}
      inset={0.66}
      title="WhatsApp chats and recorded calls."
      sub="Call from AgentSDR. The recording is transcribed and summarised into the lead's record."
      cards={
        <>
          {big(<CallCard t={80} width={400} />, 1.26)}
          {big(<WaChat t={DONE} width={440} />, 1.26)}
          {big(<SummaryCard t={DONE} width={420} />, 1.26)}
        </>
      }
    />
  );
}

/* ================================================================ 09 · Replies */

export function Replies() {
  return (
    <Slide>
      <PreloadFaces />
      <Headline title="AI reads every reply and drafts the answer." sub="Replies from every channel land in one queue, classified (interested, meeting requested, not now) with a draft ready." size={78} />
      <Scaled w={1440} h={930} scale={0.92} x={(PW - 1440 * 0.92) / 2} y={390} style={{ borderRadius: 20, boxShadow: WINDOW_SHADOW, overflow: "hidden" }}>
        <CrmQueue />
      </Scaled>
      <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(180deg, rgb(247 247 246 / 0), #f7f7f6 85%)" }} />
    </Slide>
  );
}

/* ================================================================ 10 · One click */

export function OneClick() {
  const draft = CRM_LEADS[0].draft ?? "";
  return (
    <Slide>
      <PreloadFaces />
      <Headline title="Approve and send in one click." sub="Edit it if you like. The reply goes out on the channel the lead wrote on." />
      <div className="absolute" style={{ left: 210, top: 470 }}>
        {big(<InboxList t={DONE} width={420} classifyAt={0} />, 1.3)}
      </div>
      <div className="absolute" style={{ left: 840, top: 500, width: 860 }}>
        <div style={{ transform: "scale(1.3)", transformOrigin: "0 0", width: 660 }}>
          <DraftComposer text={draft} pressed={false} />
        </div>
      </div>
      <div className="absolute" style={{ left: 1270, top: 880 }}>
        <span className="inline-flex h-[70px] items-center gap-3 rounded-[18px] bg-[#1fc16b] px-8 text-[28px] font-semibold text-white" style={{ boxShadow: "0 18px 36px -16px rgb(31 193 107 / 0.7)" }}>
          <RiCheckLine style={{ width: 32, height: 32 }} /> Sent to Maya
        </span>
      </div>
      <Hand path={[[0, 1600, 945]]} show={[-10, Infinity]} size={78} />
    </Slide>
  );
}

/* ================================================================ 11 · Pipeline */

export function Pipeline() {
  const { columns, counts } = board();
  return (
    <Slide>
      <PreloadFaces />
      <Headline title="Follow-ups schedule themselves." sub="Every lead sits where it stands: waiting on you, waiting on them, or out of follow-ups." />
      <Scaled w={1440} h={820} scale={0.86} x={(PW - 1440 * 0.86) / 2} y={410} style={{ borderRadius: 20, boxShadow: WINDOW_SHADOW, overflow: "hidden" }}>
        <AppScreen path="/crm/pipeline" active="/crm/pipeline" width={1440} height={820}>
          <PipelineBoard columns={columns} counts={counts} clear={0} />
        </AppScreen>
      </Scaled>
    </Slide>
  );
}

/* ================================================================ 12 · Analytics */

export function Analytics() {
  return (
    <Slide>
      <Headline title="See what turns into meetings." sub="Which channels and sequences bring replies, meetings and customers." />
      <Scaled w={1440} h={1000} scale={0.8} x={(PW - 1440 * 0.8) / 2} y={380} style={{ borderRadius: 20, boxShadow: WINDOW_SHADOW, overflow: "hidden" }}>
        <Dashboard p={1} />
      </Scaled>
      <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(180deg, rgb(247 247 246 / 0), #f7f7f6 85%)" }} />
    </Slide>
  );
}

/* ================================================================ 13 · Self-host */

const TERMINAL: { text: string; tone?: "cmd" | "ok" | "dim" }[] = [
  { text: "$ git clone https://github.com/Kandid-ai/AgentSDR.git", tone: "cmd" },
  { text: "$ cd AgentSDR && cp .env.example .env", tone: "cmd" },
  { text: "$ docker compose up -d", tone: "cmd" },
  { text: "[+] Running 4/4", tone: "dim" },
  { text: " ✔ Container agentsdr-db-1     Healthy", tone: "ok" },
  { text: " ✔ Container agentsdr-setup-1  Exited", tone: "ok" },
  { text: " ✔ Container agentsdr-app-1    Started", tone: "ok" },
  { text: " ✔ Container agentsdr-cron-1   Started", tone: "ok" },
];

const OWN: { icon: ComponentType<{ style?: React.CSSProperties }>; title: string; detail: string }[] = [
  { icon: RiServerLine, title: "Your servers", detail: "One Next.js app and PostgreSQL. No Redis, no queue server." },
  { icon: RiDatabase2Line, title: "Your data", detail: "Leads, conversations and call recordings stay in your database." },
  { icon: RiKey2Line, title: "Your own AI key", detail: "Bring your model through OpenRouter. No seats, no per-contact fees." },
];

export function SelfHost() {
  return (
    <Slide>
      <Headline title="Self-host it in minutes." sub="Clone it, fill in a few secrets, and start it with Docker Compose." />
      <div className="absolute" style={{ left: 150, top: 440, width: 980 }}>
        <div className="overflow-hidden rounded-[22px] bg-[#111214]" style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.2), 0 40px 80px -36px rgb(14 18 27 / 0.6)" }}>
          <div className="flex h-[48px] items-center gap-2 border-b border-white/10 px-5">
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span key={c} className="size-[13px] rounded-full" style={{ background: c }} />
            ))}
            <span className="ml-auto mr-auto text-[15px] text-white/40">~ / AgentSDR</span>
          </div>
          <pre className="px-8 py-7 font-[family-name:var(--font-landing-mono)] text-[22px] leading-[1.75]">
            {TERMINAL.map((l, i) => (
              <div key={i} style={{ color: l.tone === "cmd" ? "#f5f5f5" : l.tone === "ok" ? "#4ade80" : "#8a8f98" }}>
                {l.text}
              </div>
            ))}
          </pre>
        </div>
      </div>
      <div className="absolute flex flex-col gap-5" style={{ left: 1180, top: 440, width: 580 }}>
        {OWN.map(({ icon: Icon, title, detail }) => (
          <Card key={title}>
            <div className="flex gap-5 p-6">
              <span className="flex size-[56px] shrink-0 items-center justify-center rounded-[14px] bg-[#eef1ff] text-[#335cff]">
                <Icon style={{ width: 28, height: 28 }} />
              </span>
              <span>
                <span className={`${display} block text-[27px] font-semibold tracking-[-0.02em] text-[#141414]`}>{title}</span>
                <span className="mt-1 block text-[19px] leading-[1.4] text-[#6b6b6b]">{detail}</span>
              </span>
            </div>
          </Card>
        ))}
      </div>
    </Slide>
  );
}

/* ================================================================ 14 · Get it */

export function GetIt() {
  return (
    <Slide mark={false}>
      <Centre y={300}>
        <div className="flex items-center">
          <Shade pose={shadePose(undefined, 0)} size={150} color={INK} />
          <span className={`${display} ml-7 text-[136px] font-semibold leading-none tracking-[-0.04em]`} style={{ color: INK }}>
            AgentSDR
          </span>
        </div>
      </Centre>
      <Centre y={490}>
        <span className={`${display} text-[64px] font-medium tracking-[-0.025em] text-[#8b8b8b]`}>Open-source AI SDR</span>
      </Centre>
      <Centre y={640}>
        <div className="flex h-[96px] items-center gap-4 rounded-[20px] bg-[#141414] px-12 text-[36px] font-medium text-white" style={{ boxShadow: "0 18px 40px -18px rgb(0 0 0 / 0.6)" }}>
          <RiGithubFill style={{ width: 42, height: 42 }} />
          Self-host yours → github.com/Kandid-ai/AgentSDR
        </div>
      </Centre>
      <Centre y={790}>
        <span className={`${display} text-[34px] tracking-[-0.01em] text-[#8b8b8b]`}>Free · Your servers · Your own AI key</span>
      </Centre>
    </Slide>
  );
}

/* ================================================================ Thumbnail */

/** The logo tile, full-bleed: Product Hunt rounds the corners itself. */
function ThumbTile({ pose, bob = 0 }: { pose: ReturnType<typeof shadePose>; bob?: number }) {
  return (
    <AbsoluteFill className="bg-gradient-to-b from-[#5b7bff] to-[#1f3bad]">
      <AbsoluteFill className="bg-[linear-gradient(rgb(255_255_255/0.08)_2px,transparent_2px),linear-gradient(90deg,rgb(255_255_255/0.08)_2px,transparent_2px)] bg-[size:25%_25%]" />
      <AbsoluteFill className="flex items-center justify-center">
        <div style={{ transform: `translateY(${bob}px)`, filter: "drop-shadow(0 6px 8px rgb(11 10 26 / 0.35))" }}>
          <Shade pose={pose} size={300} color="#fff" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Thumbnail() {
  return <ThumbTile pose={shadePose(undefined, 0)} />;
}

/** Shade's bounce, looping: four poses, six frames each, with a small hop on the tall ones. */
export const THUMB_LOOP = 24;
export function ThumbnailAnimated() {
  const f = useCurrentFrame();
  const i = Math.floor(f / 6) % 4;
  const pose = CYCLES.bounce.frames[i];
  return <ThumbTile pose={pose} bob={i % 2 ? -14 : 0} />;
}

/* ================================================================ Registry */

export const GALLERY: { id: string; component: ComponentType }[] = [
  { id: "01-hero", component: Hero },
  { id: "02-one-tab", component: OneTab },
  { id: "03-three-channels", component: ThreeChannelsSlide },
  { id: "04-find-leads", component: Find },
  { id: "05-enrichment", component: Enrich },
  { id: "06-email", component: Email },
  { id: "07-linkedin", component: LinkedIn },
  { id: "08-whatsapp", component: WhatsApp },
  { id: "09-ai-replies", component: Replies },
  { id: "10-one-click", component: OneClick },
  { id: "11-pipeline", component: Pipeline },
  { id: "12-analytics", component: Analytics },
  { id: "13-self-host", component: SelfHost },
  { id: "14-get-it", component: GetIt },
];

export { PH, PW };
