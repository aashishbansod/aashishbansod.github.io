import type { MetadataRoute } from "next";

/**
 * ============================================================
 * CyberNet Careers
 * Production SEO Sitemap
 *
 * Official Careers Website:
 * https://www.cncareers.me/
 *
 * Sitemap:
 * https://www.cncareers.me/sitemap.xml
 * ============================================================
 */

const SITE_URL = "https://www.cncareers.me";

/**
 * Keep URLs centralized so accidental URL changes
 * do not create inconsistent sitemap entries.
 */
const routes = {
  home: "/",
  internships: "/internships",
  apply: "/apply",
  certificate: "/certificate",
  contact: "/contact",
  privacy: "/privacy-policy",
  terms: "/terms-and-conditions",
} as const;

/**
 * ============================================================
 * SITEMAP
 * ============================================================
 *
 * Only public, canonical, indexable pages are included.
 *
 * Private/internal routes such as:
 *
 * /api/*
 * /admin/*
 * /login/*
 * /student/*
 * /payment/*
 *
 * are intentionally NOT included.
 *
 * Note:
 * Google does not require priority/changeFrequency for ranking.
 * They are kept here as valid sitemap metadata for crawlers
 * and other search engines.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    /**
     * ========================================================
     * HOMEPAGE
     * ========================================================
     */
    {
      url: `${SITE_URL}${routes.home}`,
      changeFrequency: "weekly",
      priority: 1,
    },

    /**
     * ========================================================
     * INTERNSHIPS
     * ========================================================
     *
     * Main public internship discovery page.
     */
    {
      url: `${SITE_URL}${routes.internships}`,
      changeFrequency: "daily",
      priority: 0.95,
    },

    /**
     * ========================================================
     * APPLICATION
     * ========================================================
     *
     * Public internship application entry point.
     */
    {
      url: `${SITE_URL}${routes.apply}`,
      changeFrequency: "weekly",
      priority: 0.9,
    },

    /**
     * ========================================================
     * CERTIFICATE
     * ========================================================
     *
     * Public certificate-related page.
     */
    {
      url: `${SITE_URL}${routes.certificate}`,
      changeFrequency: "weekly",
      priority: 0.8,
    },

    /**
     * ========================================================
     * CONTACT
     * ========================================================
     */
    {
      url: `${SITE_URL}${routes.contact}`,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    /**
     * ========================================================
     * PRIVACY POLICY
     * ========================================================
     */
    {
      url: `${SITE_URL}${routes.privacy}`,
      changeFrequency: "yearly",
      priority: 0.4,
    },

    /**
     * ========================================================
     * TERMS & CONDITIONS
     * ========================================================
     */
    {
      url: `${SITE_URL}${routes.terms}`,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}