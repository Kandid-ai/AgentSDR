/**
 * "Connect Google Workspace to AgentSDR": a captioned walkthrough of
 * docs/integrations/google-workspace.mdx and gmail-reply-sync.mdx, built on
 * the docs' own screenshots (public/guides/). Google console captures had
 * every identifier replaced before capture; the app shots use demo data.
 * Keep the step titles and wording in step with those two pages.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, Img, Series, staticFile, useCurrentFrame } from "remotion";
import { BG, BLUE, Canvas, INK } from "../film/kit";
import { s, tw } from "../kit/motion";
import { display, mono } from "../kit/ui";

const SOFT_INK = "#5c5c5c";
const LINE = "#e6e6e3";

/** Fractions of the image: [left, top, right, bottom]. */
type Box = readonly [number, number, number, number];

function Fade({ children, dur }: { children: ReactNode; dur: number }) {
  const f = useCurrentFrame();
  const o = Math.min(tw(f, 0, 10), 1 - tw(f, dur - 10, 10));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

/** Step label and title, top left; the caption sits in a bar at the bottom. */
function Chrome({ label, title, caption, captionAt = 18 }: { label: string; title: string; caption: ReactNode; captionAt?: number }) {
  const f = useCurrentFrame();
  const c = tw(f, captionAt, 14);
  return (
    <>
      <div style={{ position: "absolute", left: 96, top: 56, display: "flex", alignItems: "center", gap: 20 }}>
        <div className={display} style={{ fontSize: 22, color: BLUE, background: "#eaf0ff", borderRadius: 999, padding: "8px 18px", letterSpacing: 0.2 }}>{label}</div>
        <div className={display} style={{ fontSize: 44, color: INK, letterSpacing: -1 }}>{title}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center", opacity: c, transform: `translateY(${(1 - c) * 16}px)` }}>
        <div style={{ maxWidth: 1500, background: "rgba(20,20,20,0.88)", color: "white", borderRadius: 18, padding: "18px 30px", fontSize: 32, lineHeight: 1.35, textAlign: "center", fontFamily: "var(--font-landing-display), Inter, system-ui, sans-serif" }}>
          {caption}
        </div>
      </div>
    </>
  );
}

/**
 * A screenshot in a frame. It starts whole, then the camera glides to
 * `focus` and a blue box draws around `mark` (defaults to `focus`).
 */
function Screen({ src, w, h, focus, mark, zoom = 1.7, label, title, caption, dur }: {
  src: string; w: number; h: number; focus: Box; mark?: Box; zoom?: number; label: string; title: string; caption: ReactNode; dur: number;
}) {
  const f = useCurrentFrame();
  // The screenshot lives in a clipped window between the title and the caption.
  const VX = 110, VY = 140, VW = 1700, VH = 800;
  const k0 = Math.min(VW / w, VH / h);
  const dw = w * k0, dh = h * k0;
  const z = tw(f, s(1.6), s(1.4));
  const k = 1 + (zoom - 1) * z;
  const fx = ((focus[0] + focus[2]) / 2) * dw, fy = ((focus[1] + focus[3]) / 2) * dh;
  // At rest the image is centred in the window; zooming glides the focus point to the window centre.
  // Keep the zoomed image covering the window, so its edge never slides into view.
  const fit = (t: number, size: number, view: number) => (size * k <= view ? (view - size * k) / 2 : Math.min(0, Math.max(view - size * k, t)));
  const tx = fit(VW / 2 - (dw / 2) * k + (dw / 2 - fx) * k * z, dw, VW);
  const ty = fit(VH / 2 - (dh / 2) * k + (dh / 2 - fy) * k * z, dh, VH);
  const m = mark ?? focus;
  const b = tw(f, s(2.7), 12);
  const pulse = 1 + 0.03 * Math.sin(Math.max(0, f - s(3.1)) / 6);
  return (
    <Fade dur={dur}>
      <Canvas>
        <div style={{ position: "absolute", left: VX, top: VY, width: VW, height: VH, overflow: "hidden", borderRadius: 20, background: "#1b1b1b", boxShadow: "0 30px 80px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: dw, height: dh, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
            <Img src={staticFile(`guides/${src}`)} style={{ width: dw, height: dh, display: "block" }} />
            <div style={{
              position: "absolute", left: m[0] * dw - 6, top: m[1] * dh - 6, width: (m[2] - m[0]) * dw + 12, height: (m[3] - m[1]) * dh + 12,
              border: `${4 / k}px solid ${BLUE}`, borderRadius: 10 / k, opacity: b,
              boxShadow: `0 0 0 ${6 / k}px rgba(51,92,255,0.22)`, transform: `scale(${b > 0.99 ? pulse : 0.96 + 0.04 * b})`,
            }} />
          </div>
        </div>
        <Chrome label={label} title={title} caption={caption} />
      </Canvas>
    </Fade>
  );
}

/** A text-only step: a short instruction card. */
function Note({ label, title, lines, caption, dur }: { label: string; title: string; lines: ReactNode[]; caption?: ReactNode; dur: number }) {
  const f = useCurrentFrame();
  return (
    <Fade dur={dur}>
      <Canvas>
        <div style={{ position: "absolute", left: 260, right: 260, top: 230, display: "flex", flexDirection: "column", gap: 26 }}>
          {lines.map((line, i) => {
            const a = tw(f, 12 + i * 14, 14);
            return (
              <div key={i} style={{ opacity: a, transform: `translateY(${(1 - a) * 18}px)`, background: "white", border: `1px solid ${LINE}`, borderRadius: 18, padding: "26px 32px", fontSize: 34, color: INK, lineHeight: 1.4, fontFamily: "var(--font-landing-display), Inter, system-ui, sans-serif", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
                {line}
              </div>
            );
          })}
        </div>
        <Chrome label={label} title={title} caption={caption ?? ""} captionAt={caption ? 30 : 9999} />
      </Canvas>
    </Fade>
  );
}

const B = ({ children }: { children: ReactNode }) => <span style={{ fontWeight: 600 }}>{children}</span>;
const Code = ({ children }: { children: ReactNode }) => (
  // Inherits its colour, so it reads on the white step cards and in the dark caption bar alike.
  <span className={mono} style={{ fontSize: "0.82em", color: "inherit", background: "rgba(128,128,128,0.2)", borderRadius: 8, padding: "2px 10px" }}>{children}</span>
);

function Title({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const a = tw(f, 4, 18), b = tw(f, 18, 18);
  return (
    <Fade dur={dur}>
      <Canvas>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 28 }}>
          <Img src={staticFile("guides/logo.svg")} style={{ width: 120, height: 120, opacity: a, transform: `scale(${0.9 + 0.1 * a})` }} />
          <div className={display} style={{ fontSize: 76, color: INK, letterSpacing: -2, opacity: a }}>Connect Google Workspace</div>
          <div style={{ fontSize: 34, color: SOFT_INK, opacity: b, fontFamily: "var(--font-landing-display), Inter, system-ui, sans-serif" }}>
            Send and read Gmail from AgentSDR · about 15 minutes · needs a Workspace super admin
          </div>
        </AbsoluteFill>
      </Canvas>
    </Fade>
  );
}

/** How the pieces fit: three boxes, drawn left to right. */
function Overview({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const items = [
    { head: "Google Cloud", body: "A service account and its JSON key: a robot identity for AgentSDR." },
    { head: "Google Admin console", body: "Domain-wide delegation: lets that identity send and read Gmail for your domain." },
    { head: "AgentSDR", body: "Acts as each mailbox you add: sends campaigns and reads replies." },
  ];
  return (
    <Fade dur={dur}>
      <Canvas>
        <div style={{ position: "absolute", left: 120, right: 120, top: 300, display: "flex", alignItems: "stretch", gap: 0 }}>
          {items.map((it, i) => {
            const a = tw(f, 14 + i * 40, 18);
            const arrow = tw(f, 34 + i * 40, 14);
            return (
              <div key={it.head} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ flex: 1, opacity: a, transform: `translateY(${(1 - a) * 20}px)`, background: "white", border: `1px solid ${LINE}`, borderRadius: 22, padding: "34px 34px 38px", boxShadow: "0 14px 40px rgba(0,0,0,0.06)", minHeight: 250 }}>
                  <div className={display} style={{ fontSize: 22, color: BLUE, marginBottom: 14 }}>{`${i + 1}`}</div>
                  <div className={display} style={{ fontSize: 40, color: INK, letterSpacing: -1, marginBottom: 14 }}>{it.head}</div>
                  <div style={{ fontSize: 28, color: SOFT_INK, lineHeight: 1.4, fontFamily: "var(--font-landing-display), Inter, system-ui, sans-serif" }}>{it.body}</div>
                </div>
                {i < items.length - 1 && <div style={{ width: 70, textAlign: "center", fontSize: 48, color: BLUE, opacity: arrow }}>→</div>}
              </div>
            );
          })}
        </div>
        <Chrome label="Overview" title="How it fits together" caption="Two Google consoles, then one form in AgentSDR. No passwords or per-mailbox consent." captionAt={130} />
      </Canvas>
    </Fade>
  );
}

/**
 * The Admin console step: the menu path, then the real "Add a new client ID"
 * dialog (cropped to the dialog; placeholder Client ID), its fields outlined
 * one after another.
 */
function Delegation({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const path = ["Security", "Access and data control", "API controls", "Manage domain-wide delegation", "Add new"];
  const IW = 472 * 1.6, IH = 420 * 1.6;
  const dialog = tw(f, s(2.6), 16);
  // Fractions of the dialog image: Client ID, OAuth scopes, Authorise.
  const marks: ReadonlyArray<readonly [Box, number, number]> = [
    [[0.04, 0.215, 0.935, 0.355], s(3.6), s(6.6)],
    [[0.04, 0.465, 0.84, 0.605], s(6.6), s(9.8)],
    [[0.775, 0.895, 0.96, 0.98], s(9.8), dur],
  ];
  return (
    <Fade dur={dur}>
      <Canvas>
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26, color: SOFT_INK, marginRight: 4, fontFamily: "var(--font-landing-display), Inter, sans-serif" }}>admin.google.com</div>
          {path.map((p, i) => {
            const a = tw(f, 10 + i * 12, 10);
            return (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 12, opacity: a }}>
                <span style={{ color: SOFT_INK, fontSize: 26 }}>→</span>
                <span className={display} style={{ fontSize: 26, color: i === path.length - 1 ? "white" : INK, background: i === path.length - 1 ? BLUE : "white", border: `1px solid ${LINE}`, borderRadius: 12, padding: "6px 14px", whiteSpace: "nowrap" }}>{p}</span>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 960 - IW / 2, top: 236, width: IW, height: IH, opacity: dialog, transform: `translateY(${(1 - dialog) * 24}px)` }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 10, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)" }}>
            <Img src={staticFile("guides/admin-delegation-add-client.jpg")} style={{ width: IW, height: IH, display: "block" }} />
          </div>
          {marks.map(([m, from, to], i) => {
            const o = Math.min(tw(f, from, 10), 1 - tw(f, to - 6, 6));
            return (
              <div key={i} style={{ position: "absolute", left: m[0] * IW - 6, top: m[1] * IH - 6, width: (m[2] - m[0]) * IW + 12, height: (m[3] - m[1]) * IH + 12, border: `4px solid ${BLUE}`, borderRadius: 10, opacity: o, boxShadow: "0 0 0 6px rgba(51,92,255,0.22)" }} />
            );
          })}
        </div>
        <Chrome label="Step 6" title="Allow it in the Admin console" caption={<>Paste the Unique ID and both Gmail scopes (comma-separated), then <B>Authorise</B>.</>} captionAt={s(3.4)} />
      </Canvas>
    </Fade>
  );
}

function End({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const a = tw(f, 4, 16), b = tw(f, 20, 16);
  return (
    <Fade dur={dur}>
      <Canvas>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 26 }}>
          <Img src={staticFile("guides/logo.svg")} style={{ width: 96, height: 96, opacity: a }} />
          <div className={display} style={{ fontSize: 64, color: INK, letterSpacing: -1.6, opacity: a }}>You're connected</div>
          <div style={{ fontSize: 32, color: SOFT_INK, opacity: b, textAlign: "center", lineHeight: 1.5, fontFamily: "var(--font-landing-display), Inter, sans-serif" }}>
            Every step, with troubleshooting:
            <br />
            <span className={mono} style={{ color: BLUE }}>docs.agentsdr.ai/integrations/google-workspace</span>
          </div>
        </AbsoluteFill>
      </Canvas>
    </Fade>
  );
}

/** [component, seconds] in order. */
const SCENES: ReadonlyArray<readonly [(p: { dur: number }) => ReactNode, number]> = [
  [({ dur }) => <Title dur={dur} />, 4.5],
  [({ dur }) => <Overview dur={dur} />, 8],
  [({ dur }) => <Note dur={dur} label="Step 1" title="Pick a Google Cloud project" lines={[
    <>Open <B>console.cloud.google.com</B> and choose <B>New project</B> from the project picker, or use one you already control.</>,
    <>Note the <B>project ID</B>: reply sync uses it later.</>,
  ]} />, 6],
  [({ dur }) => <Screen dur={dur} label="Step 2" title="Enable the Gmail API" src="gmail-api.jpg" w={1470} h={745} focus={[0.13, 0.33, 0.38, 0.43]} mark={[0.138, 0.36, 0.37, 0.41]} zoom={1.9}
    caption={<><B>APIs &amp; Services → Library</B>, search <B>Gmail API</B>, click <B>Enable</B>. Already on? You'll see <B>Manage</B>.</>} />, 7.5],
  [({ dur }) => <Screen dur={dur} label="Step 3" title="Create a service account" src="create-service-account.jpg" w={1440} h={746} focus={[0.22, 0.26, 0.57, 0.6]} mark={[0.228, 0.262, 0.564, 0.48]} zoom={1.6}
    caption={<><B>IAM &amp; Admin → Service accounts → Create service account</B>. Give it a name. It needs no roles.</>} />, 8],
  [({ dur }) => <Screen dur={dur} label="Step 4" title="Create a JSON key" src="create-json-key.jpg" w={1440} h={746} focus={[0.3, 0.3, 0.7, 0.72]} mark={[0.318, 0.465, 0.69, 0.715]} zoom={1.6}
    caption={<>On the account's <B>Keys</B> tab: <B>Add key → Create new key → JSON → Create</B>. A file downloads; keep it safe.</>} />, 8],
  [({ dur }) => <Screen dur={dur} label="Step 5" title="Copy its Client ID" src="service-account-unique-id.jpg" w={1440} h={746} focus={[0.2, 0.44, 0.5, 0.6]} mark={[0.2, 0.53, 0.335, 0.59]} zoom={2}
    caption={<>On the <B>Details</B> tab, copy the <B>Unique ID</B>. It is the Client ID the Admin console asks for.</>} />, 7],
  [({ dur }) => <Delegation dur={dur} />, 12.5],
  [({ dur }) => <Screen dur={dur} label="Step 7" title="Connect it in AgentSDR" src="email-connection.png" w={2880} h={1800} focus={[0.6, 0.2, 0.92, 0.34]} mark={[0.84, 0.25, 0.905, 0.298]} zoom={1.8}
    caption={<>In AgentSDR: <B>Settings → Email → Connection</B>, then <B>Connect</B> on Google Workspace.</>} />, 6.5],
  [({ dur }) => <Screen dur={dur} label="Step 7" title="Upload the key file" src="google-workspace-connect.png" w={2880} h={1800} focus={[0.3, 0.24, 0.7, 0.62]} mark={[0.31, 0.26, 0.42, 0.308]} zoom={1.5}
    caption={<><B>Upload key file</B> fills the email and private key. <B>Connect &amp; test</B> checks it with Google before saving.</>} />, 8.5],
  [({ dur }) => <Note dur={dur} label="Step 8" title="Add a mailbox" lines={[
    <><B>Settings → Email → Mailboxes → Add mailbox</B>, enter a real address on your domain, such as <Code>rep@yourcompany.com</Code>.</>,
    <><B>Connect &amp; test</B> acts as that user. <B>Mailbox connected</B> means delegation works.</>,
  ]} />, 7],
  [({ dur }) => <Note dur={dur} label="Optional" title="Read replies in real time" lines={[
    <>Sending works now. To pick up replies, Gmail pushes a notice to a <B>Pub/Sub topic</B>, which forwards it to AgentSDR.</>,
    <>Three things in Google Cloud: a topic, one permission, a push subscription.</>,
  ]} />, 7],
  [({ dur }) => <Screen dur={dur} label="Reply sync 1" title="Create a topic" src="pubsub-create-topic.jpg" w={1440} h={746} focus={[0.2, 0.2, 0.58, 0.36]} mark={[0.204, 0.21, 0.562, 0.29]} zoom={1.8}
    caption={<><B>Pub/Sub → Topics → Create topic</B>. The full name under the field goes into AgentSDR.</>} />, 7],
  [({ dur }) => <Screen dur={dur} label="Reply sync 2" title="Let Gmail publish to it" src="pubsub-topic-publisher.jpg" w={1440} h={746} focus={[0.7, 0.36, 0.99, 0.84]} mark={[0.705, 0.7, 0.99, 0.83]} zoom={1.7}
    caption={<><B>Add principal</B> <Code>gmail-api-push@system.gserviceaccount.com</Code> with the role <B>Pub/Sub Publisher</B>.</>} />, 8],
  [({ dur }) => <Screen dur={dur} label="Reply sync 3" title="Push it to AgentSDR" src="pubsub-push-subscription.jpg" w={1440} h={746} focus={[0.2, 0.58, 0.58, 0.76]} mark={[0.205, 0.595, 0.562, 0.745]} zoom={1.7}
    caption={<><B>Create subscription</B>, delivery <B>Push</B>, endpoint <Code>https://your-domain/api/outreach/webhooks/gmail-watch</Code>.</>} />, 8],
  [({ dur }) => <Screen dur={dur} label="Reply sync 4" title="Tell AgentSDR the topic" src="google-workspace-connect.png" w={2880} h={1800} focus={[0.3, 0.66, 0.7, 0.82]} mark={[0.312, 0.69, 0.688, 0.766]} zoom={1.7}
    caption={<>Paste the topic's full name into <B>Gmail Pub/Sub topic</B>, and schedule the daily watch renewal job.</>} />, 7.5],
  [({ dur }) => <End dur={dur} />, 6],
];

export const GW_FRAMES = SCENES.reduce((n, [, sec]) => n + s(sec), 0);

export function GoogleWorkspaceGuide() {
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Series>
        {SCENES.map(([Scene, sec], i) => (
          <Series.Sequence key={i} durationInFrames={s(sec)}>
            <Scene dur={s(sec)} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

