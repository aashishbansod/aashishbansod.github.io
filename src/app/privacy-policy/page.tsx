import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.cncareers.me";
const EMAIL = "cybernet.tech.india@gmail.com";

export const metadata: Metadata = {
  title: "Privacy Policy | CyberNet Careers",
  description:
    "Read the Privacy Policy for CyberNet Careers, including information about applications, student accounts, assessments, payments, certificates and website usage.",
  alternates: {
    canonical: `${SITE_URL}/privacy-policy`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Privacy Policy | CyberNet Careers",
    description:
      "Privacy Policy for the CyberNet Careers internship and student platform.",
    url: `${SITE_URL}/privacy-policy`,
    siteName: "CyberNet Careers",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | CyberNet Careers",
    description:
      "Privacy Policy for the CyberNet Careers internship and student platform.",
  },
};

const sections = [
  {
    title: "1. About This Privacy Policy",
    paragraphs: [
      "This Privacy Policy explains how CyberNet Careers, a platform by CyberNet Technology Systems, handles information when you access or use the website and related internship and student services.",
      "By using CyberNet Careers, you acknowledge that information may be collected and used as described in this Privacy Policy.",
    ],
  },
  {
    title: "2. Information We Collect",
    paragraphs: [
      "Depending on the service you use, we may collect information that you provide directly through the platform.",
    ],
    bullets: [
      "Name and contact information such as email address and phone number.",
      "Education-related information such as college or university, course, branch or stream and graduation year.",
      "Internship-related information such as selected track, skills and application details.",
      "Information required for student accounts, assessments and internship services.",
      "Payment and transaction-related information provided through the applicable payment process.",
      "Information submitted for certificate verification where applicable.",
    ],
  },
  {
    title: "3. Information Collected Automatically",
    paragraphs: [
      "When you access the website, certain technical information may be processed automatically to help operate, secure and improve the platform.",
    ],
    bullets: [
      "Browser and device information.",
      "IP address and general technical information.",
      "Pages or services accessed on the website.",
      "Basic information relating to website requests, errors and security events.",
    ],
  },
  {
    title: "4. How We Use Information",
    paragraphs: [
      "Information collected through CyberNet Careers may be used for legitimate platform and service-related purposes.",
    ],
    bullets: [
      "To process and manage internship applications.",
      "To communicate application, verification and account-related information.",
      "To create and manage student accounts where applicable.",
      "To provide assessments and evaluate applicable eligibility requirements.",
      "To provide selected internship services.",
      "To process applicable payments through the payment gateway.",
      "To provide certificate verification services.",
      "To maintain platform security and prevent misuse or unauthorized activity.",
      "To troubleshoot technical issues and improve website functionality.",
      "To comply with applicable legal or regulatory requirements.",
    ],
  },
  {
    title: "5. Application & Student Information",
    paragraphs: [
      "Information submitted during an internship application may be used to review the application, communicate with the applicant and manage the applicable internship workflow.",
      "If an application is approved, relevant information may be used to create and manage the student's account and provide the services associated with the selected internship program.",
    ],
  },
  {
    title: "6. Payments",
    paragraphs: [
      "Where payment is applicable, payment transactions are processed through the payment gateway made available on CyberNet Careers.",
      "CyberNet Careers currently uses Razorpay for the applicable online payment workflow. Payment-related information may therefore be processed by the payment service provider according to its applicable policies and terms.",
      "CyberNet Careers does not require users to share payment credentials such as card PINs, passwords or UPI PINs directly with the website.",
    ],
  },
  {
    title: "7. Email & Communications",
    paragraphs: [
      "We may use the contact information provided by applicants and students to send important service-related communications.",
      "These communications may include application updates, email verification, student account information, assessment information, internship-related updates, payment-related information and other necessary service notifications.",
    ],
  },
  {
    title: "8. Information Sharing",
    paragraphs: [
      "We do not intend to sell personal information as part of the normal operation of CyberNet Careers.",
      "Information may be shared with service providers or third parties where reasonably necessary to operate the platform or provide requested services.",
    ],
    bullets: [
      "Payment and transaction processing providers.",
      "Email or communication service providers.",
      "Hosting, infrastructure and technical service providers.",
      "Security, fraud-prevention or technical-support services where required.",
      "Authorities or other parties where disclosure is required by applicable law.",
    ],
  },
  {
    title: "9. Data Security",
    paragraphs: [
      "Reasonable technical and organizational measures may be used to protect information against unauthorized access, misuse, alteration or disclosure.",
      "However, no internet-based service can guarantee absolute security. Users should also protect their account credentials and avoid sharing passwords or other authentication information with others.",
    ],
  },
  {
    title: "10. Data Retention",
    paragraphs: [
      "Information may be retained for as long as reasonably necessary to provide requested services, maintain application and student records, support certificate verification, resolve disputes, maintain security or comply with applicable legal obligations.",
      "The retention period may vary depending on the type and purpose of the information.",
    ],
  },
  {
    title: "11. Cookies & Similar Technologies",
    paragraphs: [
      "CyberNet Careers may use cookies or similar technologies where necessary for website functionality, security, session management or improving the user experience.",
      "You may be able to control cookies through your browser settings. Disabling certain cookies may affect some website functionality.",
    ],
  },
  {
    title: "12. Third-Party Services",
    paragraphs: [
      "CyberNet Careers may use third-party services to support functions such as payments, email delivery, hosting, security or other technical operations.",
      "Third-party services may process information according to their own privacy policies and terms. Users should review the applicable third-party policies where appropriate.",
    ],
  },
  {
    title: "13. External Links",
    paragraphs: [
      "The website may contain links to external websites or services.",
      "CyberNet Careers is not responsible for the privacy practices, content or security of external websites. Users should review the privacy policy of any external service they visit.",
    ],
  },
  {
    title: "14. Children's Privacy",
    paragraphs: [
      "CyberNet Careers is intended for users who are legally able to use the applicable services.",
      "If information has been submitted by a person who is not permitted to use the applicable service, please contact us so the matter can be reviewed and appropriate action can be taken.",
    ],
  },
  {
    title: "15. Your Choices",
    paragraphs: [
      "You may contact CyberNet Careers regarding information you have submitted through the platform or to raise a privacy-related question.",
      "Depending on the nature of the request and applicable requirements, we may ask for information necessary to verify the request before taking action.",
    ],
  },
  {
    title: "16. Changes to This Privacy Policy",
    paragraphs: [
      "This Privacy Policy may be updated when the website, services, data practices or applicable requirements change.",
      "The latest version will be published on this page. Users are encouraged to review this page periodically.",
    ],
  },
];

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 3 20 6v5c0 5.25-3.36 8.95-8 10-4.64-1.05-8-4.75-8-10V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
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

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="CyberNet Careers home"
            className="group flex min-w-0 items-center gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[11px] font-black text-white shadow-lg shadow-blue-600/20 transition-transform duration-200 group-hover:scale-105">
              CN
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight text-slate-950">
                CyberNet Careers
              </span>

              <span className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:block">
                Internship & Student Portal
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 sm:text-sm"
          >
            <span>Home</span>
            <ArrowIcon />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/20">
            <ShieldIcon />
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
            Legal
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Privacy Policy
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            This policy explains how information is handled when you use
            CyberNet Careers and its internship and student services.
          </p>

          <p className="mt-5 text-xs font-medium text-slate-400">
            Last updated: September 2026
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* Intro */}
          <div className="border-b border-slate-200 bg-slate-50/70 p-6 sm:p-8">
            <p className="text-sm leading-7 text-slate-700 sm:text-base">
              CyberNet Careers is an internship and student platform by{" "}
              <strong className="font-bold text-slate-950">
                CyberNet Technology Systems
              </strong>
              . We respect the privacy of applicants, students and visitors
              and aim to handle information responsibly.
            </p>
          </div>

          {/* Sections */}
          <div className="divide-y divide-slate-200">
            {sections.map((section) => (
              <section key={section.title} className="p-6 sm:p-8">
                <h2 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                  {section.title}
                </h2>

                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-4 text-sm leading-7 text-slate-600 sm:text-base"
                  >
                    {paragraph}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="mt-5 space-y-3">
                    {section.bullets.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-sm leading-6 text-slate-600 sm:text-base"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Contact */}
          <section className="p-6 sm:p-8">
            <div className="rounded-2xl bg-slate-950 p-6 text-white sm:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">
                Privacy Contact
              </p>

              <h2 className="mt-2 text-xl font-black sm:text-2xl">
                Questions about your privacy?
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                For privacy-related questions, requests or concerns, contact
                CyberNet Careers through the official email address.
              </p>

              <a
                href={`mailto:${EMAIL}`}
                className="mt-5 inline-block max-w-full break-all text-sm font-bold text-white underline decoration-blue-400 underline-offset-4 transition hover:text-blue-300"
              >
                {EMAIL}
              </a>
            </div>
          </section>
        </article>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-7 text-center sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:text-left">
          <p className="text-xs text-slate-500">
            © 2026 CyberNet Careers. All rights reserved.
          </p>

          <nav
            aria-label="Legal navigation"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500"
          >
            <Link
              href="/privacy-policy"
              className="text-blue-600"
              aria-current="page"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms-and-conditions"
              className="transition hover:text-blue-600"
            >
              Terms & Conditions
            </Link>

            <Link
              href="/contact"
              className="transition hover:text-blue-600"
            >
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}