import type { ReactNode } from "react";

const REPO_BLOB = "https://github.com/Kandid-ai/AgentSDR/blob/main/";

/** Relative links in the changelog point at files in the repo; make them absolute. */
function hrefOf(url: string): string {
  return /^(https?:|mailto:|#|\/)/.test(url) ? url : REPO_BLOB + url;
}

/** Inline subset: **bold**, `code`, [text](url). */
export function Inline({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++} className="font-medium text-[#141414]"><Inline text={m[1]} /></strong>);
    else if (m[2] !== undefined) out.push(<code key={k++} className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[0.88em]">{m[2]}</code>);
    else {
      const href = hrefOf(m[4]);
      out.push(
        <a key={k++} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-[#2547d0] underline decoration-[#335cff]/30 underline-offset-4 hover:decoration-[#335cff]">
          {m[3]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export type Group = { title: string; items: string[]; paragraphs: string[] };
export type Release = { version: string; date: string | null; intro: string[]; groups: Group[] };

/** Parses the Keep a Changelog subset: `## [version] - date`, `### Group`, `- bullets` with indented continuations, paragraphs. */
export function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  let release: Release | null = null;
  let group: Group | null = null;
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      const text = para.join(" ").trim();
      if (text) (group ? group.paragraphs : release?.intro)?.push(text);
    }
    para = [];
  };
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const h2 = /^## \[([^\]]+)\](?:\s*-\s*(\S+))?/.exec(line);
    if (h2) {
      flush();
      release = { version: h2[1], date: h2[2] ?? null, intro: [], groups: [] };
      releases.push(release);
      group = null;
      continue;
    }
    if (!release) continue;
    if (/^\[[^\]]+\]:\s/.test(line)) { flush(); continue; } // link reference definitions
    const h3 = /^### (.+)/.exec(line);
    if (h3) {
      flush();
      group = { title: h3[1], items: [], paragraphs: [] };
      release.groups.push(group);
      continue;
    }
    if (!line.trim()) { if (!(group && para.length === 0)) flush(); else flush(); continue; }
    if (group && /^- /.test(line)) {
      flush();
      group.items.push(line.slice(2).trim());
      continue;
    }
    if (group && /^\s+\S/.test(line) && group.items.length && para.length === 0 && !group.paragraphs.length) {
      group.items[group.items.length - 1] += " " + line.trim();
      continue;
    }
    para.push(line.trim());
  }
  flush();
  // An empty section (the fresh "Unreleased" right after a release) has nothing to show.
  return releases.filter((r) => r.intro.length > 0 || r.groups.length > 0);
}
