import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.cncareers.me";
const SUPPORT_EMAIL = "cybernet.tech.india@gmail.com";

export const metadata: Metadata = {
  title: "Terms & Conditions | CyberNet Careers",
  description:
    "Terms & Conditions for CyberNet Careers covering internship applications, assessments, internship plans, payments, cancellations, refunds, student accounts and certificate verification.",
  alternates: {
    canonical: `${SITE_URL}/terms-and-conditions`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/terms-and-conditions`,
    siteName: "CyberNet Careers",
    title: "Terms & Conditions | CyberNet Careers",
    description:
      "Terms governing the use of CyberNet Careers internship and student platform.",
  },
};

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6M9 9h2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
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
      strokeWidth={2}
      className="mt-1 h-4 w-4 shrink-0 text-blue-600"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function Section({
  id,
  number,
  title,
  children,
  last = false,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section
      id={id}
      className={`${last ? "" : "border-b border-slate-200"} py-8 sm:py-10`}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-blue-600">
          {number}
        </span>

        <h2 className="pt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
          {title}
        </h2>
      </div>

      <div className="mt-5 pl-0 sm:pl-12">{children}</div>
    </section>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-7 text-slate-600 sm:text-base">
      {children}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-sm leading-6 text-slate-600 sm:text-base"
        >
          <CheckIcon />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="CyberNet Careers home"
            className="flex min-w-0 items-center gap-3"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[11px] font-black text-white shadow-lg shadow-blue-600/20"
            >
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
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 sm:text-sm"
          >
            <span>Home</span>
            <ArrowIcon />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          <div
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/20"
          >
            <DocumentIcon />
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
            Legal
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Terms & Conditions
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Please read these terms before using CyberNet Careers,
            submitting an internship application, using student
            services or making a payment.
          </p>

          <p className="mt-5 text-xs font-medium text-slate-400">
            Last updated: September 2026
          </p>
        </div>
      </section>

      {/* Main Document */}
      <section className="px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <article className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* Introduction */}
          <div className="border-b border-slate-200 bg-slate-50/80 p-6 sm:p-8 lg:p-10">
            <p className="text-sm leading-7 text-slate-700 sm:text-base">
              CyberNet Careers is an internship and student platform
              by{" "}
              <strong className="font-bold text-slate-950">
                CyberNet Technology Systems
              </strong>
              .
            </p>

            <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">
              By accessing or using CyberNet Careers, you agree to
              comply with these Terms & Conditions and the applicable
              policies published on the website.
            </p>
          </div>

          <div className="px-6 sm:px-8 lg:px-10">
            {/* 1 */}
            <Section
              id="acceptance"
              number="01"
              title="Acceptance of Terms"
            >
              <Paragraph>
                By accessing or using CyberNet Careers, you agree to
                these Terms & Conditions and the applicable policies
                published on the website.
              </Paragraph>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                If you do not agree with these terms, please do not
                use the platform or submit an application.
              </p>
            </Section>

            {/* 2 */}
            <Section
              id="platform"
              number="02"
              title="CyberNet Careers Platform"
            >
              <Paragraph>
                CyberNet Careers is an internship and student
                platform operated by CyberNet Technology Systems.
              </Paragraph>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                The platform provides functionality related to
                internship applications, email verification,
                assessments, internship selection, applicable
                payments, student services and certificate
                verification.
              </p>
            </Section>

            {/* 3 */}
            <Section
              id="eligibility"
              number="03"
              title="Eligibility"
            >
              <Paragraph>
                Applicants must satisfy the requirements communicated
                for the applicable internship program or service.
              </Paragraph>

              <div className="mt-5">
                <BulletList
                  items={[
                    "Provide accurate and complete information.",
                    "Use your own information during the application process.",
                    "Meet the requirements of the selected internship program.",
                    "Provide additional information when reasonably required for verification.",
                  ]}
                />
              </div>
            </Section>

            {/* 4 */}
            <Section
              id="application"
              number="04"
              title="Internship Application"
            >
              <Paragraph>
                Students may submit an internship application through
                the CyberNet Careers platform by providing the
                information requested in the application form.
              </Paragraph>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Submitting an application does not automatically
                guarantee approval, internship selection, placement
                or employment.
              </p>

              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm leading-6 text-slate-700">
                  False, misleading or incomplete information may
                  affect application processing or eligibility.
                </p>
              </div>
            </Section>

            {/* 5 */}
            <Section
              id="assessment"
              number="05"
              title="Assessment & Evaluation"
            >
              <Paragraph>
                An assessment may be required before an applicant can
                proceed to internship selection.
              </Paragraph>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Assessment requirements, scoring, deadlines and
                eligibility conditions may vary according to the
                applicable internship program.
              </p>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Passing an assessment does not by itself guarantee
                employment, salary or job placement.
              </p>
            </Section>

            {/* 6 */}
            <Section
              id="internship"
              number="06"
              title="Internship Program"
            >
              <Paragraph>
                Available internship tracks, durations, project
                requirements and other program conditions are
                determined by the applicable internship offering.
              </Paragraph>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Available durations may include:
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {["1 Month", "3 Months", "6 Months"].map((duration) => (
                  <div
                    key={duration}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-bold text-slate-800"
                  >
                    {duration}
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm leading-6 text-slate-600">
                  Participation in an internship does not guarantee
                  employment, salary or job placement.
                </p>
              </div>
            </Section>

            {/* 7 */}
            <Section
              id="payment"
              number="07"
              title="Fees & Payments"
            >
              <Paragraph>
                Where an internship or service requires payment, the
                applicable amount will be displayed before the payment
                is submitted.
              </Paragraph>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                CyberNet Careers currently uses Razorpay for
                applicable online payment processing.
              </p>

              <div className="mt-5">
                <BulletList
                  items={[
                    "Payment status may be recorded for order and transaction management.",
                    "Payment and order references may be retained for reconciliation and support.",
                    "Payment processing is handled through the applicable payment provider.",
                    "Payment-provider terms and policies may also apply to a transaction.",
                  ]}
                />
              </div>
            </Section>

            {/* 8 */}
            <Section
              id="refund"
              number="08"
              title="Cancellation & Refund Policy"
            >
              <Paragraph>
                If a student wants to cancel a paid internship service
                and request a refund, the student must contact CyberNet
                Careers within{" "}
                <strong className="font-bold text-slate-950">
                  7 calendar days from the date of payment
                </strong>
                .
              </Paragraph>

              {/* Refund Steps */}
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                    Step 01
                  </span>

                  <h3 className="mt-2 font-black text-slate-950">
                    Submit Request
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Send the cancellation or refund request to the
                    official CyberNet Careers email within 7 calendar
                    days of payment.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                    Step 02
                  </span>

                  <h3 className="mt-2 font-black text-slate-950">
                    Verification
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    The request, payment details and relevant
                    transaction information will be reviewed and
                    verified before approval.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                    Step 03
                  </span>

                  <h3 className="mt-2 font-black text-slate-950">
                    Refund Processing
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Once approved, the refund will be initiated or
                    processed within 3–7 business days.
                  </p>
                </div>
              </div>

              {/* Refund Information */}
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
                <h3 className="font-black text-amber-950">
                  Important refund information
                </h3>

                <p className="mt-2 text-sm leading-6 text-amber-900">
                  Approved refunds will be returned to the original
                  payment method used for the transaction.
                </p>

                <p className="mt-3 text-sm leading-6 text-amber-900">
                  After the refund is initiated, the time required
                  for the amount to appear in the customer's bank
                  account, card or other original payment method may
                  vary depending on the payment method, bank and
                  payment provider.
                </p>
              </div>

              {/* Email */}
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
                <h3 className="font-black text-slate-950">
                  How to request a refund
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Send your request with your registered email
                  address, payment or order reference and a brief
                  reason for cancellation or refund.
                </p>

                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="mt-4 inline-block break-all text-sm font-bold text-blue-700 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-900"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-600 sm:text-base">
                Requests submitted after the 7-day period may not
                qualify under this refund policy unless otherwise
                applicable based on the circumstances and the
                applicable service policy.
              </p>
            </Section>

            {/* 9 */}
            <Section
              id="account"
              number="09"
              title="Student Account"
            >
              <Paragraph>
                Students are responsible for maintaining the
                confidentiality of their login credentials and for
                activity performed through their account.
              </Paragraph>

              <div className="mt-5">
                <BulletList
                  items={[
                    "Do not share your account credentials with another person.",
                    "Do not access another user's account.",
                    "Do not attempt to bypass account or platform security.",
                    "Report suspected unauthorized account access promptly.",
                  ]}
                />
              </div>
            </Section>

            {/* 10 */}
            <Section
              id="conduct"
              number="10"
              title="User Conduct"
            >
              <Paragraph>
                Users must use CyberNet Careers responsibly and only
                for legitimate purposes.
              </Paragraph>

              <div className="mt-5">
                <BulletList
                  items={[
                    "Do not provide fraudulent or intentionally misleading information.",
                    "Do not impersonate another person.",
                    "Do not manipulate or bypass assessment systems.",
                    "Do not attempt unauthorized access to platform systems or data.",
                    "Do not introduce malware or harmful code.",
                    "Do not interfere with another user's account or platform access.",
                  ]}
                />
              </div>
            </Section>

            {/* 11 */}
            <Section
              id="certificate"
              number="11"
              title="Certificates & Verification"
            >
              <Paragraph>
                Where certificates are provided, issuance may depend
                on completion of the applicable internship requirements.
              </Paragraph>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                CyberNet Careers may provide certificate verification
                functionality for certificates issued through the
                platform.
              </p>

              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm leading-6 text-slate-600">
                  A certificate does not represent a guarantee of
                  employment, salary, job placement or academic
                  accreditation unless explicitly stated.
                </p>
              </div>
            </Section>

            {/* 12 */}
            <Section
              id="availability"
              number="12"
              title="Service Availability"
            >
              <Paragraph>
                CyberNet Careers aims to keep its platform available
                and reliable. Temporary interruptions may occur
                because of maintenance, technical issues, network
                problems, security incidents or third-party service
                interruptions.
              </Paragraph>
            </Section>

            {/* 13 */}
            <Section
              id="changes"
              number="13"
              title="Changes to These Terms"
            >
              <Paragraph>
                CyberNet Careers may update these Terms & Conditions
                when its services, platform, policies or applicable
                requirements change.
              </Paragraph>

              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                The latest version will be published on this page
                together with an updated date.
              </p>
            </Section>

            {/* 14 */}
            <Section
              id="contact"
              number="14"
              title="Contact"
              last
            >
              <div className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
                <p className="text-sm leading-6 text-slate-400">
                  For questions about these Terms & Conditions,
                  internship services, payments, cancellations or
                  refunds, contact CyberNet Careers using the official
                  email address.
                </p>

                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="mt-5 inline-block break-all text-sm font-bold text-white underline decoration-blue-400 underline-offset-4 transition hover:text-blue-300"
                >
                  {SUPPORT_EMAIL}
                </a>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-xs font-semibold text-slate-400">
                    CyberNet Careers
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    CyberNet Technology Systems
                  </p>
                </div>
              </div>
            </Section>
          </div>
        </article>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-7 text-center sm:flex-row sm:px-6 lg:px-8 lg:text-left">
          <p className="text-xs text-slate-500">
            © 2026 CyberNet Careers. All rights reserved.
          </p>

          <nav
            aria-label="Legal navigation"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold"
          >
            <Link
              href="/privacy-policy"
              className="text-slate-600 transition hover:text-blue-600"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms-and-conditions"
              aria-current="page"
              className="text-blue-600"
            >
              Terms & Conditions
            </Link>

            <Link
              href="/contact"
              className="text-slate-600 transition hover:text-blue-600"
            >
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}