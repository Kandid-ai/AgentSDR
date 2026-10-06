import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { RiCheckboxCircleFill } from "@remixicon/react";
import { EASE, GLIDE, keys, pop, tw, typed } from "../kit/motion";
import { Canvas, display, Hand, Type } from "./kit";
import { actionOf, ActionRequiredPage, CRM_LEADS, DraftComposer, OMAR, PipelineBoard, PreloadFaces, type BoardCard } from "./crmUi";

/**
 * The CRM, after "And when they reply", in the app's own UI: the replies
 * from every channel land in the real Action required queue; AI classifies
 * each; it drafts the answer; you send in one click; the Pipeline board
 * moves them on; nothing is left waiting on you.
 *
 * Laid out like the Tables scene — the line big on the left, the product
 * on the right — with every row, chip, KPI and card the app's own
 * component, fed frame-by-frame state.
 */

export const CRM = 372;

const B = {
  arrive: 8,
  classify: 64,
  type: 128,
  sendMaya: 184,
  sendDaniel: 212,
  sendPriya: 226,
  board: 246,
  move: 266, // two cards, one at a time
  moveEvery: 24,
  moveDur: 16,
  clear: 326,
} as const;

const SENT_AT = [B.sendMaya, B.sendDaniel, B.sendPriya];
const arriveAt = (i: number) => B.arrive + i * 7;
const classifyAt = (i: number) => B.classify + i * 8;
const goneAt = (i: number) => (i < 3 ? SENT_AT[i] + 12 : Infinity);

/* The product window on the right: the page drawn at S× its logical size. */
const CARD = { x: 690, y: 140, w: 1160, h: 820 };
const S = 1.06;
const LW = CARD.w / S;
const LH = CARD.h / S;

/* Where things sit on the Action required page, in its logical pixels (measured from a render). */
const ROW_TOP = 411; // first queue row's top
const ROW_H = 70;
const SEND = { x: 790, dy: 35 }; // a row's Send button, relative to the row's top
const COMPOSER = { x: 470, y: 488, w: 560, sendDx: 98, sendDy: 135 }; // Maya's draft, open under her row

function visibleLeads(f: number) {
  return CRM_LEADS.map((lead, i) => ({ lead, i })).filter(({ i }) => f >= arriveAt(i) && f < goneAt(i));
}

function queueState(f: number) {
  const visible = visibleLeads(f);
  const rows = visible.map(({ lead, i }) => {
    const classified = f >= classifyAt(i);
    const draft = !classified || !lead.draft ? undefined : i === 0 ? (f >= B.type ? typed(lead.draft, f, B.type, 60) || undefined : undefined) : f >= classifyAt(i) + 6 ? lead.draft : undefined;
    return actionOf(lead, { classified, draft });
  });
  // Per-row effects, on the real table rows: a blue wash as a reply lands,
  // the classification popping in, green as it's sent, then fading out.
  const css = visible
    .map(({ i }, k) => {
      const sel = `.crm-q tbody tr:nth-child(${k + 1})`;
      const land = Math.max(0, 1 - (f - arriveAt(i)) / 16);
      const sentAt = i < 3 ? SENT_AT[i] : Infinity;
      const sent = f >= sentAt ? Math.max(0, 1 - (f - sentAt) / 14) : 0;
      const fade = i < 3 ? tw(f, sentAt + 4, 8, GLIDE) : 0;
      const chip = pop(f, classifyAt(i), 240, 15);
      const bg = sent > 0 ? `rgb(31 193 107 / ${0.16 * sent})` : land > 0 ? `rgb(51 92 255 / ${0.1 * land})` : "transparent";
      return [
        `${sel} > td { background: ${bg} !important; }`,
        `${sel} { opacity: ${(1 - fade) * Math.min(1, (f - arriveAt(i)) / 6)}; }`,
        f >= classifyAt(i) && f < classifyAt(i) + 12 ? `${sel} > td:nth-child(2) > div { transform: scale(${0.7 + 0.3 * chip}); transform-origin: 0 50%; }` : "",
      ].join("\n");
    })
    .join("\n");
  const tools = visible.map(({ i }, k) => (i > 0 && i < 3 && f >= SENT_AT[i] - 14 && f < SENT_AT[i] + 4 ? k : -1)).filter((k) => k >= 0);
  const drafts = visible.filter(({ lead, i }) => lead.draft && f >= classifyAt(i) + 6 && (i >= 3 || f < SENT_AT[i])).length;
  const kpis = { queue: visible.length, drafts, followUps: f >= classifyAt(3) ? 1 : 0 };
  return { rows, css, tools, kpis };
}

function boardState(f: number) {
  // Two, unhurried: Maya (replied — now waiting on her) and Lucas (not now — a follow-up booked for January).
  const movers = [CRM_LEADS[0], CRM_LEADS[3]];
  const moveAt = (j: number) => B.move + j * B.moveEvery;
  const needs: BoardCard[] = [];
  const waiting: BoardCard[] = [];
  movers.forEach((lead, j) => {
    const m = moveAt(j);
    if (f < m + B.moveDur) {
      const t = tw(f, m, B.moveDur, GLIDE);
      needs.push({ action: actionOf(lead, { classified: true, stage: "needs_action" }), style: { opacity: 1 - t, transform: `translateX(${t * 120}px) scale(${1 - 0.03 * t})` } });
    }
    if (f >= m + 6) {
      const t = tw(f, m + 6, B.moveDur, EASE);
      waiting.unshift({ action: actionOf(lead, { classified: true, stage: "waiting", sent: lead.id === "maya" }), style: { opacity: t, transform: `translateX(${(1 - t) * -100}px)` } });
    }
  });
  const exhausted: BoardCard[] = [{ action: actionOf(OMAR, { classified: true, stage: "exhausted" }) }];
  const moved = movers.filter((_, j) => f >= moveAt(j) + B.moveDur / 2).length;
  return {
    columns: { needs_action: needs, waiting, exhausted },
    counts: { needs_action: movers.length - moved, waiting: moved, exhausted: 1 },
    clear: tw(f, B.clear, 12),
  };
}

/* ------------------------------------------------------------ the left */

const LINES: { at: number; until: number; head: string; sub: string }[] = [
  { at: 0, until: 60, head: "Every reply,\nin one place.", sub: "Email, LinkedIn and WhatsApp — one queue, one record per person." },
  { at: 60, until: 124, head: "AI reads\nevery one.", sub: "Meeting requested, information, not now — and do not contact." },
  { at: 124, until: 196, head: "And drafts\nthe answer.", sub: "Written from your knowledge base, in your voice." },
  { at: 196, until: 244, head: "One click.", sub: "Approve, and it's sent on the channel they used." },
  { at: 244, until: 322, head: "Follow-ups run\nthemselves.", sub: "Not now becomes a follow-up on the right day. It stops when they answer." },
  { at: 322, until: CRM, head: "Nothing waiting\non you.", sub: "Every reply answered." },
];

function Left({ f }: { f: number }) {
  return (
    <div className="absolute" style={{ left: 100, top: 300, width: 540 }}>
      <span className={`${display} inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[19px] font-medium text-[#525866]`} style={{ boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08)", opacity: tw(f, 0, 8) }}>
        <span className="size-2 rounded-full bg-[#335cff]" /> AgentSDR CRM
      </span>
      {LINES.map((l) => {
        if (f < l.at - 1 || f >= l.until + 6) return null;
        const last = l.until === CRM;
        return (
          <div key={l.head} className="absolute left-0 top-[76px] w-full">
            <Type text={l.head} start={l.at} size={74} every={2} align="left" lineHeight={1.05} out={last ? undefined : l.until - 4} outDur={5} />
            <p className="mt-6 text-[25px] leading-[1.35] text-[#6b6b6b]" style={{ opacity: tw(f, l.at + 6, 8) * (last ? 1 : 1 - tw(f, l.until - 4, 5)) }}>
              {l.sub}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Pill({ f, at, children }: { f: number; at: number; children: ReactNode }) {
  if (f < at) return null;
  const k = pop(f, at, 240, 15);
  return (
    <div className="absolute left-1/2 z-20 flex items-center gap-3 rounded-full bg-white py-3 pl-6 pr-4 text-[24px] font-medium text-[#141414]" style={{ bottom: 28, transform: `translateX(-50%) translateY(${(1 - k) * 24}px) scale(${0.8 + 0.2 * k})`, opacity: Math.min(1, k * 1.5), boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 16px 34px -14px rgb(14 18 27 / 0.35)" }}>
      {children}
      <RiCheckboxCircleFill style={{ width: 30, height: 30, color: "#1fc16b" }} />
    </div>
  );
}

/* ------------------------------------------------------------ the scene */

/** The camera inside the window: a push-in on Maya's draft while it's written, then back out. */
const VIEW: readonly (readonly [number, number, number, number])[] = [
  [0, LW / 2, LH / 2, 1],
  [124, LW / 2, LH / 2, 1],
  [140, COMPOSER.x + COMPOSER.w / 2, COMPOSER.y + 60, 1.45],
  [190, COMPOSER.x + COMPOSER.w / 2, COMPOSER.y + 60, 1.45],
  [204, LW / 2, LH / 2, 1],
];
function viewAt(f: number) {
  const x = keys(f, VIEW.map(([fr, v]) => [fr, v] as const));
  const y = keys(f, VIEW.map(([fr, , v]) => [fr, v] as const));
  const z = keys(f, VIEW.map(([fr, , , v]) => [fr, v] as const));
  const k = S * z;
  return { k, tx: CARD.w / 2 - x * k, ty: CARD.h / 2 - y * k };
}
function onCanvas(fr: number, px: number, py: number) {
  const v = viewAt(fr);
  return [CARD.x + v.tx + px * v.k, CARD.y + v.ty + py * v.k] as const;
}
/** Lead i's Send button, on canvas, at frame fr (rows above it may have gone). */
function sendAt(fr: number, i: number) {
  const k = visibleLeads(fr).findIndex((v) => v.i === i);
  return onCanvas(fr, SEND.x, ROW_TOP + Math.max(0, k) * ROW_H + SEND.dy);
}

export function CrmScene() {
  const f = useCurrentFrame();
  const a = tw(f, 0, 12, EASE);
  const out = tw(f, CRM - 10, 10, GLIDE);
  const board = tw(f, B.board, 10, GLIDE);
  const v = viewAt(f);
  const q = queueState(f);
  const bs = board > 0 ? boardState(f) : null;
  const composer = tw(f, B.type - 8, 8, EASE) * (1 - tw(f, B.sendMaya + 4, 6, GLIDE));
  const m0 = onCanvas(B.sendMaya - 2, COMPOSER.x + COMPOSER.w - COMPOSER.sendDx, COMPOSER.y + COMPOSER.sendDy);
  return (
    <Canvas>
      <AbsoluteFill style={{ opacity: 1 - out, filter: out ? `blur(${out * 12}px)` : undefined }}>
        <PreloadFaces />
        <Left f={f} />
        <div
          className="absolute overflow-hidden rounded-[22px] bg-white"
          style={{ left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, opacity: a, transform: `translateY(${(1 - a) * 60}px)`, boxShadow: "0 0 0 1px rgb(14 18 27 / 0.08), 0 40px 90px -40px rgb(14 18 27 / 0.35)" }}
        >
          {board < 1 && (
            <div className="absolute left-0 top-0" style={{ width: LW, height: LH, transformOrigin: "0 0", transform: `translate(${v.tx}px, ${v.ty}px) scale(${v.k})`, opacity: 1 - board }}>
              <ActionRequiredPage
                rows={q.rows}
                kpis={q.kpis}
                rowStyles={q.css}
                tools={q.tools}
                overlay={
                  composer > 0 && (
                    <div className="absolute" style={{ left: COMPOSER.x, top: COMPOSER.y, width: COMPOSER.w, opacity: composer, transform: `translateY(${(1 - composer) * -12}px)` }}>
                      <DraftComposer text={typed(CRM_LEADS[0].draft ?? "", f, B.type, 60)} pressed={f >= B.sendMaya - 1 && f < B.sendMaya + 3} />
                    </div>
                  )
                }
              />
            </div>
          )}
          {bs && (
            <div className="absolute left-0 top-0" style={{ width: LW, height: LH, transformOrigin: "0 0", transform: `scale(${S}) translateY(${(1 - board) * 16}px)`, opacity: board }}>
              <PipelineBoard columns={bs.columns} counts={bs.counts} clear={bs.clear} />
            </div>
          )}
          {f < B.board + 8 && (
            <div style={{ opacity: 1 - board }}>
              <Pill f={f} at={B.sendPriya + 8}>
                3 replies sent
              </Pill>
            </div>
          )}
        </div>
        <Hand
          show={[B.sendMaya - 20, B.sendPriya + 10]}
          clicks={[B.sendMaya, B.sendDaniel, B.sendPriya]}
          path={[
            [B.sendMaya - 20, m0[0] + 150, m0[1] + 170],
            [B.sendMaya - 2, ...m0],
            [B.sendMaya + 8, ...m0],
            [B.sendDaniel - 2, ...sendAt(B.sendDaniel - 2, 1)],
            [B.sendPriya - 2, ...sendAt(B.sendPriya - 2, 2)],
          ]}
          size={76}
        />
      </AbsoluteFill>
    </Canvas>
  );
}

export const CRM_CLICKS = [B.sendMaya, B.sendDaniel, B.sendPriya];
