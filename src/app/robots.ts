import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/site";

/**
 * Crawlers get the marketing pages; the app itself sits behind sign-in and has
 * nothing to index. The app's top-level routes are listed explicitly — keep
 * this in step when one is added.
 */
const APP_ROUTES = [
  "/api/",
  "/analytics",
  "/calling",
  "/campaigns",
  "/crm",
  "/dev",
  "/domains",
  "/downloads",
  "/leads",
  "/linkedin",
  "/onboarding",
  "/outreach",
  "/settings",
  "/tables",
  "/whatsapp",
  "/unsubscribe",
  "/accept-invitation",
  "/reset-password",
  "/forgot-password",
  // Ghost's admin, behind the proxied blog.
  "/blog/ghost/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: APP_ROUTES }],
    // The site's own pages, and the blog's (Ghost writes and serves its own).
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/blog/sitemap.xml`],
    host: SITE_URL,
  };
}
