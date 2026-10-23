import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.cncareers.me";
const EMAIL = "cybernet.tech.india@gmail.com";
const LINKEDIN_URL =
  "https://www.linkedin.com/in/cybernet-solutions/";

export const metadata: Metadata = {
  title: "Contact CyberNet Careers | Internship & Student Support",
  description:
    "Contact CyberNet Careers for internship applications, student portal, assessments, payments and certificate verification related queries.",
  keywords: [
    "CyberNet Careers contact",
    "CyberNet Technology Systems contact",
    "internship support",
    "student portal support",
    "internship application support",
    "certificate verification support",
  ],
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Contact CyberNet Careers",
    description:
      "Official contact page for CyberNet Careers internship and student portal support.",
    url: `${SITE_URL}/contact`,
    siteName: "CyberNet Careers",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Contact CyberNet Careers",
    description:
      "Official contact page for CyberNet Careers internship and student portal support.",
  },
};

function MailIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="m5 7 7 5 7-5" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M6.5 8.5A1.5 1.5 0 1 0 6.5 5.5a1.5 1.5 0 0 0 0 3Z" />
      <path d="M5.3 9.8h2.4V19H5.3z" />
      <path d="M10 9.8h2.3v1.25h.03c.32-.61 1.1-1.58 2.75-1.58 2.94 0 3.48 1.93 3.48 4.44V19h-2.4v-4.5c0-1.08-.02-2.47-1.5-2.47-1.5 0-1.73 1.17-1.73 2.39V19H10z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export default function ContactPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact CyberNet Careers",
    url: `${SITE_URL}/contact`,
    description:
      "Official contact page for CyberNet Careers internship and student support.",
    mainEntity: {
      "@type": "Organization",
      name: "CyberNet Technology Systems",
      email: EMAIL,
      sameAs: [LINKEDIN_URL],
    },
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link
            href="/"
            aria-label="CyberNet Careers home"
            className="group flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[11px] font-black text-white shadow-lg shadow-blue-600/20 transition-transform duration-200 group-hover:scale-105"
            >
              CN
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight text-slate-950 sm:text-base">
                CyberNet Careers
              </span>

              <span className="hidden truncate text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:block">
                Internship & Student Portal
              </span>
            </span>
          </Link>

          {/* Home */}
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:text-sm"
          >
            Home
            <ArrowIcon />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        aria-labelledby="contact-title"
        className="relative isolate border-b border-slate-200 bg-white"
      >
        {/* Decorative background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute left-1/2 top-[-180px] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-blue-500/[0.06] blur-[110px]" />
        </div>

        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-18 lg:px-8 lg:py-20">
          {/* Icon */}
          <div
            aria-hidden="true"
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/20 sm:h-16 sm:w-16"
          >
            <MailIcon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>

          {/* Label */}
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
            Contact
          </p>

          {/* Heading */}
          <h1
            id="contact-title"
            className="mx-auto mt-3 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl"
          >
            Get in{" "}
            <span className="text-blue-600">touch.</span>
          </h1>

          {/* Description */}
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Have a question about an internship application, student portal,
            assessment or certificate verification? Contact CyberNet Careers
            through the official support channel.
          </p>
        </div>
      </section>

      {/* Main */}
      <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="mx-auto w-full max-w-4xl">
          {/* Contact Card */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-42px_rgba(15,23,42,0.35)]">
            <div className="p-6 sm:p-8 lg:p-10">
              {/* Card heading */}
              <div className="flex items-start gap-4">
                <div
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                >
                  <MailIcon />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                    Official Support
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                    Contact CyberNet Careers
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    For platform, internship and student-related queries,
                    reach us through the official email address.
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:mt-8 sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Official Email
                  </span>

                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  />
                </div>

                <a
                  href={`mailto:${EMAIL}`}
                  className="mt-2 block break-all text-base font-black tracking-tight text-slate-950 transition-colors duration-200 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:text-lg"
                >
                  {EMAIL}
                </a>

                <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">
                  Click the email address to contact us using your email
                  application.
                </p>
              </div>

              {/* LinkedIn */}
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="CyberNet Technology Systems on LinkedIn"
                className="mt-4 flex min-h-16 items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 transition-all duration-200 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"
                  >
                    <LinkedinIcon />
                  </span>

                  <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-950">
                      LinkedIn
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      CyberNet Technology Systems
                    </span>
                  </span>
                </div>

                <ArrowIcon />
              </a>

              {/* Response note */}
              <div className="mt-6 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm"
                >
                  <CheckIcon />
                </span>

                <p className="text-xs leading-5 text-slate-600 sm:text-sm">
                  When contacting us, include your application or student
                  details where relevant so your query can be reviewed more
                  efficiently.
                </p>
              </div>
            </div>
          </div>

          {/* Helpful Links */}
          <nav
            aria-label="Helpful links"
            className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs font-bold text-slate-500"
          >
            <Link
              href="/apply"
              className="transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Apply for Internship
            </Link>

            <span aria-hidden="true" className="text-slate-300">
              •
            </span>

            <Link
              href="/internships"
              className="transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Internships
            </Link>

            <span aria-hidden="true" className="text-slate-300">
              •
            </span>

            <Link
              href="/certificate"
              className="transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Certificate Verification
            </Link>
          </nav>

          {/* Legal Links */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-400">
            <Link
              href="/privacy-policy"
              className="transition-colors hover:text-blue-600"
            >
              Privacy Policy
            </Link>

            <span aria-hidden="true">•</span>

            <Link
              href="/terms-and-conditions"
              className="transition-colors hover:text-blue-600"
            >
              Terms & Conditions
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-7 text-center sm:px-6 lg:px-8">
          <p className="text-xs text-slate-500">
            © 2026 CyberNet Careers. All rights reserved.
          </p>

          <p className="text-[11px] text-slate-400">
            CyberNet Careers · CyberNet Technology Systems
          </p>
        </div>
      </footer>
    </main>
  );
}