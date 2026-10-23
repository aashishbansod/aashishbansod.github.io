import type { MetadataRoute } from "next";

/**
 * ============================================================
 * CyberNet Careers
 * Production robots configuration
 *
 * Official careers domain:
 * https://www.cncareers.me/
 *
 * Related official LinkedIn profile:
 * https://www.linkedin.com/in/cybernet-solutions/
 * ============================================================
 */

const SITE_URL = "https://www.cncareers.me";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",

      /**
       * Public website content can be crawled.
       */
      allow: "/",

      /**
       * Private, application-internal and API areas
       * should not be crawled by search engines.
       */
      disallow: [
        "/api/",
        "/admin/",
        "/login/",
        "/student/",
        "/payment/",
      ],
    },

    /**
     * Help search engines discover the canonical
     * XML sitemap for the CyberNet Careers website.
     */
    sitemap: `${SITE_URL}/sitemap.xml`,

    /**
     * Canonical host for the website.
     */
    host: SITE_URL,
  };
}