import type { Metadata, Viewport } from "next";
import "./globals.css";

/* ============================================================
   CYBERNET CAREERS — PRODUCTION SEO CONFIGURATION
============================================================ */

const SITE_URL = "https://www.cncareers.me";
const SITE_NAME = "CyberNet Careers";
const COMPANY_NAME = "CyberNet Technology";

const SITE_DESCRIPTION =
  "CyberNet Careers provides structured internship opportunities for students to build practical technology skills, complete assessments, gain project experience and prepare for software development careers.";

const SITE_TITLE =
  "CyberNet Careers | Student Internships & Career Opportunities";

const LINKEDIN_URL =
  "https://www.linkedin.com/in/cybernet-solutions/";

const CONTACT_EMAIL =
  "cybernet.tech.india@gmail.com";

/* ============================================================
   TARGETED SEO KEYWORDS
   These match the actual content of the Careers website.
============================================================ */

const SEO_KEYWORDS = [
  "CyberNet Careers",
  "CyberNet Technology",
  "student internships",
  "software internships",
  "technology internships",
  "online internships",
  "remote internships",
  "software development internship",
  "web development internship",
  "Java internship",
  "Java full stack internship",
  "frontend development internship",
  "backend development internship",
  "React internship",
  "Next.js internship",
  "Node.js internship",
  "student career opportunities",
  "internship application",
  "internship assessment",
  "practical technology experience",
  "verified internship certificate",
];

/* ============================================================
   METADATA
============================================================ */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: SITE_TITLE,
    template: "%s | CyberNet Careers",
  },

  description: SITE_DESCRIPTION,

  keywords: SEO_KEYWORDS,

  applicationName: SITE_NAME,

  generator: "Next.js",

  authors: [
    {
      name: COMPANY_NAME,
      url: LINKEDIN_URL,
    },
  ],

  creator: COMPANY_NAME,

  publisher: COMPANY_NAME,

  category: "education",

  classification: "Internships and Career Development",

  referrer: "origin-when-cross-origin",

  /* ==========================================================
     CANONICAL
  ========================================================== */

  alternates: {
    canonical: "/",
  },

  /* ==========================================================
     ROBOTS / SEARCH ENGINE INDEXING
  ========================================================== */

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,

      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  /* ==========================================================
     OPEN GRAPH
  ========================================================== */

  openGraph: {
    type: "website",

    locale: "en_IN",

    url: SITE_URL,

    siteName: SITE_NAME,

    title: SITE_TITLE,

    description: SITE_DESCRIPTION,

    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CyberNet Careers - Student Internships and Career Opportunities",
        type: "image/png",
      },
    ],
  },

  /* ==========================================================
     TWITTER / X
  ========================================================== */

  twitter: {
    card: "summary_large_image",

    title: SITE_TITLE,

    description: SITE_DESCRIPTION,

    images: ["/og-image.png"],
  },

  /* ==========================================================
     ICONS
  ========================================================== */

  icons: {
    icon: [
      {
        url: "/favicon.ico",
        type: "image/x-icon",
      },
    ],
  },

  /* ==========================================================
     GOOGLE SEARCH CONSOLE VERIFICATION

     Add this environment variable in production:

     NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=YOUR_CODE

  ========================================================== */

  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        google:
          process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
};

/* ============================================================
   VIEWPORT / MOBILE
============================================================ */

export const viewport: Viewport = {
  width: "device-width",

  initialScale: 1,

  minimumScale: 1,

  maximumScale: 5,

  userScalable: true,

  colorScheme: "light",

  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#ffffff",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#020617",
    },
  ],
};

/* ============================================================
   SAFE JSON-LD SERIALIZER

   Prevents special HTML characters from becoming executable
   markup inside JSON-LD.
============================================================ */

function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/* ============================================================
   ROOT LAYOUT
============================================================ */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /* ==========================================================
     ORGANIZATION SCHEMA

     Based only on the actual CyberNet information used by
     the Careers website.
  ========================================================== */

  const organizationSchema = {
    "@context": "https://schema.org",

    "@type": "Organization",

    "@id": `${SITE_URL}/#organization`,

    name: COMPANY_NAME,

    url: SITE_URL,

    email: CONTACT_EMAIL,

    sameAs: [LINKEDIN_URL],

    logo: {
      "@type": "ImageObject",

      url: `${SITE_URL}/og-image.png`,

      width: 1200,

      height: 630,
    },
  };

  /* ==========================================================
     WEBSITE SCHEMA
  ========================================================== */

  const websiteSchema = {
    "@context": "https://schema.org",

    "@type": "WebSite",

    "@id": `${SITE_URL}/#website`,

    name: SITE_NAME,

    url: SITE_URL,

    description: SITE_DESCRIPTION,

    inLanguage: "en-IN",

    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  };

  /* ==========================================================
     WEBPAGE SCHEMA
  ========================================================== */

  const webpageSchema = {
    "@context": "https://schema.org",

    "@type": "WebPage",

    "@id": `${SITE_URL}/#webpage`,

    url: SITE_URL,

    name: SITE_TITLE,

    description: SITE_DESCRIPTION,

    isPartOf: {
      "@id": `${SITE_URL}/#website`,
    },

    about: {
      "@id": `${SITE_URL}/#organization`,
    },

    inLanguage: "en-IN",

    primaryImageOfPage: {
      "@type": "ImageObject",

      url: `${SITE_URL}/og-image.png`,

      width: 1200,

      height: 630,
    },
  };

  return (
    <html lang="en-IN">
      <head>
        {/* ====================================================
            MOBILE / DEVICE
        ==================================================== */}

        <meta
          name="format-detection"
          content="telephone=no"
        />

        <meta
          name="mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />

        <meta
          name="apple-mobile-web-app-title"
          content={SITE_NAME}
        />

        {/* ====================================================
            ORGANIZATION STRUCTURED DATA
        ==================================================== */}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(organizationSchema),
          }}
        />

        {/* ====================================================
            WEBSITE STRUCTURED DATA
        ==================================================== */}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(websiteSchema),
          }}
        />

        {/* ====================================================
            WEBPAGE STRUCTURED DATA
        ==================================================== */}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd(webpageSchema),
          }}
        />
      </head>

      <body>{children}</body>
    </html>
  );
}