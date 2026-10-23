import type { Metadata } from "next";

import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import Benefits from "@/components/home/Benefits";
import Categories from "@/components/home/Categories";
import HowItWorks from "@/components/home/HowItWorks";
import Footer from "@/components/home/Footer";

/* ============================================================================
   CYBERNET CAREERS
   HOMEPAGE

   PUBLIC INTERNSHIP DOMAINS
   ----------------------------------------------------------------------------
   Only these six domains are allowed on the homepage:

   01. Java Full Stack Development
   02. Python Full Stack Development
   03. Frontend Development
   04. Backend Development
   05. Web Development
   06. MERN Stack Development

   Domain cards are rendered by:
     @/components/home/Categories

   Application availability is enforced server-side by the application API.
============================================================================ */

/* ============================================================================
   SITE
============================================================================ */

const SITE_URL = "https://www.cncareers.me";

const SITE_NAME = "CyberNet Careers";

const SITE_DESCRIPTION =
  "Explore CyberNet Careers internship opportunities for students across Java Full Stack Development, Python Full Stack Development, Frontend Development, Backend Development, Web Development and MERN Stack Development.";

/* ============================================================================
   APPROVED INTERNSHIP DOMAINS
============================================================================ */

const APPROVED_INTERNSHIP_DOMAINS = [
  "Java Full Stack Development",
  "Python Full Stack Development",
  "Frontend Development",
  "Backend Development",
  "Web Development",
  "MERN Stack Development",
] as const;

/* ============================================================================
   PAGE SEO
============================================================================ */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:
      "CyberNet Careers | Software & Technology Internships",
    template:
      "%s | CyberNet Careers",
  },

  description:
    SITE_DESCRIPTION,

  keywords: [
    "CyberNet Careers",
    "software development internship",
    "technology internship",
    "student internship",
    "Java Full Stack Development internship",
    "Python Full Stack Development internship",
    "Frontend Development internship",
    "Backend Development internship",
    "Web Development internship",
    "MERN Stack Development internship",
    "Java internship",
    "Python internship",
    "React internship",
    "Node.js internship",
    "MongoDB internship",
    "web development internship",
    "software engineering internship",
  ],

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview":
        "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,

    title:
      "CyberNet Careers | Software & Technology Internships",

    description:
      SITE_DESCRIPTION,

    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt:
          "CyberNet Careers - Software and Technology Internships",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title:
      "CyberNet Careers | Software & Technology Internships",

    description:
      SITE_DESCRIPTION,

    images: [
      "/og-image.png",
    ],
  },

  category:
    "Education",

  applicationName:
    SITE_NAME,
};

/* ============================================================================
   STRUCTURED DATA
============================================================================ */

const structuredData = {
  "@context":
    "https://schema.org",

  "@graph": [
    {
      "@type":
        "Organization",

      "@id":
        `${SITE_URL}/#organization`,

      name:
        "CyberNet Careers",

      url:
        SITE_URL,
    },

    {
      "@type":
        "WebSite",

      "@id":
        `${SITE_URL}/#website`,

      name:
        "CyberNet Careers",

      url:
        SITE_URL,

      publisher: {
        "@id":
          `${SITE_URL}/#organization`,
      },
    },

    {
      "@type":
        "WebPage",

      "@id":
        `${SITE_URL}/#webpage`,

      name:
        "CyberNet Careers | Software & Technology Internships",

      url:
        SITE_URL,

      description:
        SITE_DESCRIPTION,

      isPartOf: {
        "@id":
          `${SITE_URL}/#website`,
      },

      about: {
        "@id":
          `${SITE_URL}/#organization`,
      },

      mainEntity: {
        "@type":
          "ItemList",

        name:
          "CyberNet Careers Internship Domains",

        numberOfItems:
          APPROVED_INTERNSHIP_DOMAINS.length,

        itemListElement:
          APPROVED_INTERNSHIP_DOMAINS.map(
            (domain, index) => ({
              "@type":
                "ListItem",

              position:
                index + 1,

              name:
                domain,
            }),
          ),
      },
    },
  ],
};

/* ============================================================================
   HOME PAGE
============================================================================ */

export default function HomePage() {
  return (
    <>
      {/* ======================================================================
          STRUCTURED DATA
      ======================================================================= */}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            JSON.stringify(
              structuredData,
            ),
        }}
      />

      {/* ======================================================================
          PAGE
      ======================================================================= */}

      <main
        id="main-content"
        className="
          min-h-screen
          w-full
          overflow-x-hidden
          bg-white
          text-slate-950
        "
      >
        {/* ====================================================================
            NAVBAR
        ===================================================================== */}

        <Navbar />

        {/* ====================================================================
            HERO
        ===================================================================== */}

        <section
          id="home"
          aria-labelledby="home-heading"
          className="scroll-mt-20"
        >
          <h1
            id="home-heading"
            className="sr-only"
          >
            Software Development and Technology Internships for Students
          </h1>

          <Hero />
        </section>

        {/* ====================================================================
            BENEFITS
        ===================================================================== */}

        <section
          id="benefits"
          aria-labelledby="benefits-heading"
          className="
            scroll-mt-20
            w-full
          "
        >
          <h2
            id="benefits-heading"
            className="sr-only"
          >
            Benefits of CyberNet Careers Internships
          </h2>

          <Benefits />
        </section>

        {/* ====================================================================
            INTERNSHIP DOMAINS
        =====================================================================

            IMPORTANT:
            The Categories component contains ONLY the six approved domains.
            No additional internship domain is added here.
        ===================================================================== */}

        <section
          aria-labelledby="internships-heading"
          className="
            w-full
            scroll-mt-20
          "
        >
          <header className="sr-only">
            <h2
              id="internships-heading"
            >
              CyberNet Careers Internship Domains
            </h2>

            <p>
              Explore the six available technology internship domains offered
              through CyberNet Careers.
            </p>
          </header>

          <Categories />
        </section>

        {/* ====================================================================
            HOW IT WORKS
        ===================================================================== */}

        <section
          id="process"
          aria-labelledby="process-heading"
          className="
            w-full
            scroll-mt-20
          "
        >
          <h2
            id="process-heading"
            className="sr-only"
          >
            How CyberNet Careers Internship Applications Work
          </h2>

          <HowItWorks />
        </section>

        {/* ====================================================================
            FOOTER
        ===================================================================== */}

        <Footer />
      </main>
    </>
  );
}