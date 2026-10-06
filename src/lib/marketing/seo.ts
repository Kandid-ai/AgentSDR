import type { Metadata } from "next";
import { EXTERNAL, SITE_NAME, SITE_URL } from "./site";

/**
 * Metadata and structured data for marketing pages. Every page calls
 * `marketingMetadata` so canonical, Open Graph and Twitter tags stay
 * consistent, and renders `<JsonLd>` (src/components/marketing/JsonLd.tsx)
 * with the builders below.
 */

export const absoluteUrl = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

/** The generated social card (src/app/og/route.tsx) for a page. */
export function ogImageUrl(title: string, eyebrow?: string): string {
  const params = new URLSearchParams({ title });
  if (eyebrow) params.set("eyebrow", eyebrow);
  return `${SITE_URL}/og?${params.toString()}`;
}

type MetadataInput = {
  path: string;
  /** The <title>, without the brand suffix (added here). Aim for 50–60 characters in all. */
  title: string;
  /** 140–160 characters: what the page answers, in the searcher's words. */
  description: string;
  /** Large text on the social card; defaults to `title`. */
  ogTitle?: string;
  /** Small label above it on the social card. */
  eyebrow?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

export function marketingMetadata({ path, title, description, ogTitle, eyebrow, type = "website", publishedTime, modifiedTime }: MetadataInput): Metadata {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const image = { url: ogImageUrl(ogTitle ?? title, eyebrow), width: 1200, height: 630, alt: ogTitle ?? title };
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      type,
      siteName: SITE_NAME,
      url: absoluteUrl(path),
      title: fullTitle,
      description,
      images: [image],
      ...(type === "article" ? { publishedTime, modifiedTime } : null),
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image.url] },
  };
}

// ---------------------------------------------------------------- JSON-LD

type Json = Record<string, unknown>;

export function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/apple-icon.png`,
    sameAs: [EXTERNAL.github],
  };
}

/** The product itself. Free and open source, so the offer is a zero price. */
export function softwareLd(description: string, path = "/"): Json {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: absoluteUrl(path),
    description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Linux, macOS, Windows (Docker)",
    license: "https://www.gnu.org/licenses/agpl-3.0.html",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    codeRepository: EXTERNAL.github,
  };
}

/** Questions with plain-text answers (the visible answers may carry links; pass their text). */
export function faqLd(items: ReadonlyArray<{ q: string; a: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

export function articleLd({ path, title, description, published, modified }: { path: string; title: string; description: string; published: string; modified?: string }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    datePublished: published,
    dateModified: modified ?? published,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon.png` } },
    image: ogImageUrl(title, "Guide"),
  };
}
