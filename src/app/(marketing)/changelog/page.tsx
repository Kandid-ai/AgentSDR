import fs from "node:fs";
import path from "node:path";
import { RiHistoryLine } from "@remixicon/react";
import { ClosingCta, PageHero, RelatedPages, Section } from "@/components/marketing/blocks";
import { Inline, parseChangelog } from "@/components/marketing/pages/resources/Markdown";
import { monoFont } from "@/components/landing/ui";
import { marketingMetadata } from "@/lib/marketing/seo";
import { cn } from "@/utils/cn";

export const dynamic = "force-static";

const PATH = "/changelog";

export const metadata = marketingMetadata({
  path: PATH,
  title: "AgentSDR changelog: what shipped",
  ogTitle: "AgentSDR changelog",
  eyebrow: "Changelog",
  description: "Every AgentSDR release, with what was added, changed and fixed, and the database migrations each one needs. Rendered from the project's CHANGELOG.md.",
});

export default function ChangelogPage() {
  const releases = parseChangelog(fs.readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8"));
  return (
    <>
      <PageHero eyebrow="Changelog" eyebrowIcon={RiHistoryLine} title="AgentSDR changelog" lede="What shipped, release by release, including the database migrations each release needs. This page is the project's CHANGELOG.md, built with the site." primary={{ href: "https://github.com/Kandid-ai/AgentSDR/blob/main/CHANGELOG.md", label: "View on GitHub", external: true }} secondary={null} />
      <Section id="releases">
        <ol className="mx-auto max-w-[820px]">
          {releases.map((r, i) => (
            <li key={r.version} className="relative grid gap-4 pb-14 last:pb-0 md:grid-cols-[160px_minmax(0,1fr)] md:gap-10">
              <div className="md:text-right">
                <h2 className={cn(monoFont, "text-[18px] font-medium tracking-[-0.01em] text-[#141414]")}>{r.version}</h2>
                <p className={cn(monoFont, "mt-1 text-[12px] uppercase tracking-[0.06em] text-[#8a8a8a]")}>{r.date ?? "Not yet tagged"}</p>
              </div>
              <div className="relative border-l border-black/[0.08] pl-6 md:pl-10">
                <span aria-hidden="true" className={cn("absolute -left-[5px] top-2 size-2.5 rounded-full ring-4 ring-white", i === 0 ? "bg-[#335cff]" : "bg-[#c8c8c8]")} />
                {r.intro.map((p) => (
                  <p key={p} className="text-[16px] leading-[1.7] text-[#3d3d3d]">
                    <Inline text={p} />
                  </p>
                ))}
                {r.groups.map((g) => (
                  <div key={g.title} className="mt-8 first:mt-0">
                    <h3 className={cn(monoFont, "text-[12px] font-medium uppercase tracking-[0.06em] text-[#335cff]")}>{g.title}</h3>
                    {g.paragraphs.map((p) => (
                      <p key={p} className="mt-3 text-[15.5px] leading-[1.7] text-[#3d3d3d]">
                        <Inline text={p} />
                      </p>
                    ))}
                    <ul className="mt-3 grid gap-3">
                      {g.items.map((item) => (
                        <li key={item} className="flex gap-3 text-[15.5px] leading-[1.7] text-[#3d3d3d]">
                          <span aria-hidden="true" className="mt-[11px] size-1.5 shrink-0 rounded-full bg-[#c8c8c8]" />
                          <span>
                            <Inline text={item} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <RelatedPages paths={["/guides", "/open-source", "/product/email", "/product/linkedin", "/product/whatsapp"]} />
      <ClosingCta title="Follow along on GitHub." lede="AgentSDR is open source. Releases, issues and the roadmap all live in the repository." />
    </>
  );
}
