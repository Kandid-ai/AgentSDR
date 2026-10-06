import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "@/lib/marketing/site";

/** Every public marketing page (src/lib/marketing/site.ts), on the canonical origin. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...PAGES.map((p) => ({ url: `${SITE_URL}${p.path}`, lastModified: now, changeFrequency: p.section === "resources" ? ("weekly" as const) : ("monthly" as const), priority: p.priority })),
  ];
}
