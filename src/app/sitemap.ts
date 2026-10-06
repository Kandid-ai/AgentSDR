import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "@/lib/marketing/site";

/** Every public marketing page (src/lib/marketing/site.ts), on the canonical origin. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    // The blog's index; its posts are in Ghost's own sitemap (/blog/sitemap.xml, listed in robots.txt).
    { url: `${SITE_URL}/blog/`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...PAGES.map((p) => ({ url: `${SITE_URL}${p.path}`, lastModified: now, changeFrequency: p.section === "resources" ? ("weekly" as const) : ("monthly" as const), priority: p.priority })),
  ];
}
