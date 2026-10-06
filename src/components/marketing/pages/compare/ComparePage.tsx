import type { Metadata } from "next";
import { RiArrowRightUpLine, RiScalesLine, RiThumbUpLine } from "@remixicon/react";
import { ClosingCta, FaqSection, FeatureGrid, FeatureSplit, HeroFrame, PageHero, Pill, RelatedPages, Section, Steps } from "@/components/marketing/blocks";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ProductShot, SceneStage, StatBand } from "@/components/marketing/live";
import { marketingMetadata, softwareLd } from "@/lib/marketing/seo";
import { ComparisonTable } from "./ComparisonTable";
import { disclaimerFor, getCompetitor, type Competitor } from "./data";

/** The metadata export each /compare/<name> route uses. */
export function compareMetadata(slug: Competitor["slug"]): Metadata {
  const c = getCompetitor(slug);
  return marketingMetadata({ path: `/compare/${c.slug}`, title: c.metaTitle, ogTitle: c.ogTitle, eyebrow: "Compare", description: c.description });
}

/** One template for all five alternatives, so they stay consistent. All copy is in ./data. */
export function ComparePage({ slug }: { slug: Competitor["slug"] }) {
  const c = getCompetitor(slug);
  const path = `/compare/${c.slug}`;
  return (
    <>
      <JsonLd data={softwareLd(c.description, path)} />
      <PageHero eyebrow={c.eyebrow} eyebrowIcon={RiScalesLine} title={c.h1} lede={c.lede}>
        <HeroFrame>
          <ProductShot screen={c.heroScreen} />
        </HeroFrame>
      </PageHero>

      <Section id="verdict" eyebrow="The short version" title={`AgentSDR and ${c.name}, in a line each`} lede={`${c.name} is ${c.whatItIs.charAt(0).toLowerCase()}${c.whatItIs.slice(1)}`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-[#335cff]/[0.06] p-6 ring-1 ring-[#335cff]/15 sm:p-8">
            <Pill tone="blue">AgentSDR</Pill>
            <p className="mt-4 text-[17px] leading-[1.6] text-[#141414]">{c.verdict.agentsdr}</p>
          </div>
          <div className="rounded-3xl bg-[#f7f7f8] p-6 ring-1 ring-black/[0.06] sm:p-8">
            <Pill>{c.name}</Pill>
            <p className="mt-4 text-[17px] leading-[1.6] text-[#141414]">{c.verdict.them}</p>
          </div>
        </div>
      </Section>

      <Section id="compare" tone="grey" eyebrow="Side by side" title={`AgentSDR vs ${c.name}, feature by feature`} lede={c.tableLede}>
        <ComparisonTable
          caption={`AgentSDR compared with ${c.name}, feature by feature`}
          columns={[{ name: "AgentSDR", highlight: true }, { name: c.name }]}
          rows={c.rows.map((r) => ({ feature: r.feature, cells: [r.agentsdr, r.them] }))}
        />
        <p className="mt-4 text-[13px] leading-5 text-[#6b6b6b]">&ldquo;Not compared&rdquo; means we could not confirm it from {c.name}&rsquo;s own site, so we have not claimed either way.</p>
      </Section>

      <Section id="how-it-differs" eyebrow="How AgentSDR works" title={`What you get instead of ${c.name}`}>
        {c.angles.map((a, i) => (
          <FeatureSplit
            key={a.title}
            reverse={i % 2 === 1}
            eyebrow={a.eyebrow}
            accent={a.scene.accent}
            title={a.title}
            body={a.body}
            bullets={a.bullets}
            visual={<SceneStage channel={a.scene.channel} index={a.scene.index} accent={a.scene.accent} label={a.scene.label} />}
          />
        ))}
      </Section>

      <Section tone="grey">
        <StatBand
          items={[
            { value: 3, label: "channels from one lead record: email, LinkedIn, WhatsApp" },
            { value: 15, label: "enrichment providers you can connect with your own keys" },
            { value: 30, label: "emails a day per mailbox by default, changeable" },
            { value: 0, prefix: "$", label: "per seat, sender or contact from AgentSDR" },
          ]}
        />
      </Section>

      <Section id="better-choice" eyebrow="Being fair" title={`Where ${c.name} is the better choice`} lede="Open source is not the right answer for everyone. If one of these describes you, use the other tool.">
        <FeatureGrid columns={2} items={c.better.map((b) => ({ icon: RiThumbUpLine, title: b.title, body: b.body }))} />
      </Section>

      <Section id="why-switch" tone="grey" eyebrow="Why teams switch" title={`Reasons to move from ${c.name} to AgentSDR`}>
        <FeatureGrid columns={2} items={c.switchReasons.map((b) => ({ icon: RiArrowRightUpLine, title: b.title, body: b.body }))} />
      </Section>

      <Section id="get-started" eyebrow="Getting started" title={`Moving from ${c.name}`} lede="A day of work for a typical list. Nothing here touches your old account until you decide to close it.">
        <Steps items={c.steps} />
      </Section>

      <FaqSection items={c.faq} />

      <RelatedPages paths={c.related} />

      <p className="bg-white px-4 pb-4 text-center text-[12.5px] leading-5 text-[#7a7a7a] sm:px-6">{disclaimerFor(c.name)}</p>

      <ClosingCta title={c.cta.title} lede={c.cta.lede} />
    </>
  );
}
