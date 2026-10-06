import type { ReactNode } from "react";
import { RiBookOpenLine } from "@remixicon/react";
import { ClosingCta, FaqSection, PageHero, RelatedPages } from "@/components/marketing/blocks";
import { JsonLd } from "@/components/marketing/JsonLd";
import { articleLd } from "@/lib/marketing/seo";
import { KeyTakeaways, Prose } from "./Prose";
import { Toc, type TocItem } from "./Toc";

export const GUIDE_PUBLISHED = "2026-10-06";

/** The shared frame of a guide: hero, takeaways, sticky contents, prose, FAQ, related, closing. */
export function GuideLayout({
  path,
  crumb,
  title,
  headline,
  description,
  lede,
  readMinutes,
  toc,
  takeaways,
  faq,
  related,
  closing,
  children,
}: {
  path: string;
  crumb: string;
  /** The h1. */
  title: ReactNode;
  /** Plain-text headline for the Article structured data. */
  headline: string;
  description: string;
  lede: string;
  readMinutes: number;
  toc: TocItem[];
  takeaways: string[];
  faq: ReadonlyArray<{ q: string; a: string }>;
  related: string[];
  closing: { title: string; lede: string };
  children: ReactNode;
}) {
  return (
    <>
      <JsonLd data={articleLd({ path, title: headline, description, published: GUIDE_PUBLISHED })} />
      <PageHero path={path} crumb={crumb} eyebrow={`Guide · ${readMinutes} min read`} eyebrowIcon={RiBookOpenLine} title={title} lede={lede} primary={null} secondary={null} />
      <article className="bg-white pb-8 pt-12 sm:pt-16">
        <div className="mx-auto grid max-w-[1128px] gap-12 px-4 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <aside className="order-2 lg:order-1">
            <Toc items={toc} />
          </aside>
          <div className="order-1 min-w-0 max-w-[720px] lg:order-2">
            <p className="font-[family-name:var(--font-landing-mono)] text-[12px] uppercase tracking-[0.06em] text-[#8a8a8a]">
              <time dateTime={GUIDE_PUBLISHED}>Published 6 October 2026</time> · By the AgentSDR team
            </p>
            <div className="mt-6">
              <KeyTakeaways items={takeaways} />
            </div>
            <Prose>{children}</Prose>
          </div>
        </div>
      </article>
      <FaqSection items={faq} />
      <RelatedPages paths={related} />
      <ClosingCta title={closing.title} lede={closing.lede} />
    </>
  );
}
