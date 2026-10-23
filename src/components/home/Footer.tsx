import Link from "next/link";

/* ============================================================
   CYBERNET CAREERS
   Production Footer
============================================================ */

const platformLinks = [
  { label: "Home", href: "/#home" },
  { label: "Benefits", href: "/#benefits" },
  { label: "Internships", href: "/#internships" },
  { label: "How It Works", href: "/#process" },
  { label: "Placement Preparation", href: "/#placement" },
];

const studentLinks = [
  { label: "Apply Now", href: "/apply" },
  { label: "Student Login", href: "/login" },
  { label: "Certificate Verification", href: "/certificate" },
  { label: "Contact Us", href: "/contact" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];

/* ============================================================
   VERIFIED SOCIAL PROFILES
============================================================ */

const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/cybernet-solutions/",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-current"
        aria-hidden="true"
      >
        <path d="M5.2 3.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM3.3 9.2h3.8V21H3.3V9.2Zm6.2 0h3.6v1.61h.05c.5-.95 1.72-1.95 3.55-1.95 3.8 0 4.5 2.5 4.5 5.75V21h-3.75v-5.67c0-1.35-.03-3.08-1.88-3.08-1.88 0-2.17 1.47-2.17 2.98V21H9.5V9.2Z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/CyberNet-Tech",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-current"
        aria-hidden="true"
      >
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.014-1.7-2.782.604-3.369-1.342-3.369-1.342-.455-1.157-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.004.07 1.532 1.03 1.532 1.03.892 1.53 2.341 1.088 2.91.832.091-.647.349-1.088.635-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683.103-.253.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .268.18.579.688.481A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/cybernettechnology/",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-none stroke-current"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle
          cx="17.3"
          cy="6.7"
          r="1"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    ),
  },
];

/* ============================================================
   FOOTER LINK
============================================================ */

function FooterLink({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="
          group
          inline-flex
          min-h-10
          items-center
          rounded-md
          px-1
          text-sm
          font-medium
          text-slate-600
          outline-none
          transition-all
          duration-300
          hover:translate-x-1
          hover:text-blue-600
          focus-visible:ring-2
          focus-visible:ring-blue-600
          focus-visible:ring-offset-2
        "
      >
        <span
          className="
            mr-0
            w-0
            overflow-hidden
            text-blue-600
            opacity-0
            transition-all
            duration-300
            group-hover:mr-2
            group-hover:w-3
            group-hover:opacity-100
          "
          aria-hidden="true"
        >
          →
        </span>

        <span>{label}</span>
      </Link>
    </li>
  );
}

/* ============================================================
   FOOTER HEADING
============================================================ */

function FooterHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3
        className="
          text-center
          text-sm
          font-black
          tracking-tight
          text-slate-950
          lg:text-left
        "
      >
        {children}
      </h3>

      <div
        className="
          mx-auto
          mt-2
          h-0.5
          w-8
          rounded-full
          bg-blue-600
          lg:mx-0
        "
        aria-hidden="true"
      />
    </div>
  );
}

/* ============================================================
   MAIN FOOTER
============================================================ */

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      aria-labelledby="footer-title"
      className="
        relative
        isolate
        overflow-hidden
        border-t
        border-slate-200
        bg-white
      "
    >
      {/* ======================================================
          ACCESSIBLE SEO HEADING
      ======================================================= */}

      <h2 id="footer-title" className="sr-only">
        CyberNet Careers website navigation and information
      </h2>

      {/* ======================================================
          DECORATIVE BACKGROUND
      ======================================================= */}

      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="
            absolute
            left-1/2
            top-0
            h-48
            w-[70%]
            -translate-x-1/2
            rounded-full
            bg-blue-500/[0.035]
            blur-3xl
          "
        />

        <div
          className="
            absolute
            -bottom-40
            -left-40
            h-80
            w-80
            rounded-full
            bg-blue-500/[0.035]
            blur-3xl
          "
        />

        <div
          className="
            absolute
            -right-40
            top-20
            h-80
            w-80
            rounded-full
            bg-cyan-400/[0.035]
            blur-3xl
          "
        />
      </div>

      {/* ======================================================
          TOP ACCENT
      ======================================================= */}

      <div
        className="
          absolute
          left-1/2
          top-0
          h-[2px]
          w-40
          -translate-x-1/2
          rounded-full
          bg-blue-600
          sm:w-64
          lg:w-80
        "
        aria-hidden="true"
      />

      {/* ======================================================
          CONTENT CONTAINER
      ======================================================= */}

      <div
        className="
          mx-auto
          w-full
          max-w-7xl
          px-4
          py-14
          sm:px-6
          sm:py-16
          lg:px-8
          lg:py-20
        "
      >
        {/* ====================================================
            MAIN GRID
        ===================================================== */}

        <div
          className="
            grid
            grid-cols-1
            gap-12
            text-center
            sm:grid-cols-2
            lg:grid-cols-[1.5fr_1fr_1fr_1fr]
            lg:items-start
            lg:gap-12
            lg:text-left
          "
        >
          {/* ==================================================
              BRAND / COMPANY
          =================================================== */}

          <section className="mx-auto w-full max-w-md lg:mx-0">
            <Link
              href="/"
              aria-label="CyberNet Careers home"
              className="
                group
                inline-flex
                items-center
                rounded-xl
                outline-none
                focus-visible:ring-2
                focus-visible:ring-blue-600
                focus-visible:ring-offset-4
              "
            >
             

              {/* Brand */}

              <span className="ml-3 text-left">
                <span
                  className="
                    block
                    text-lg
                    font-black
                    tracking-tight
                    text-slate-950
                    transition-colors
                    duration-300
                    group-hover:text-blue-600
                  "
                >
                CyberNet Careers
                </span>

                <span
                  className="
                    mt-0.5
                    block
                    text-[9px]
                    font-bold
                    uppercase
                    tracking-[0.28em]
                    text-slate-500
                  "
                >
                  Internship &amp; Student Portal
                </span>
              </span>
            </Link>

            {/* Description */}

            <p
              className="
                mx-auto
                mt-5
                max-w-sm
                text-sm
                leading-7
                text-slate-600
                lg:mx-0
              "
            >
              CyberNet Careers provides a structured platform
              for students to apply for internships, complete
              assessments, select internship opportunities and
              build practical technology experience.
            </p>

            {/* Company */}

            <p
              className="
                mt-5
                flex
                items-center
                justify-center
                gap-2
                text-xs
                font-semibold
                leading-5
                text-slate-500
                lg:justify-start
              "
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
                aria-hidden="true"
              />

              <span>CyberNet Technology Systems</span>
            </p>

            {/* ==================================================
                SOCIAL LINKS
            =================================================== */}

            <nav
              aria-label="CyberNet Careers social media profiles"
              className="
                mt-7
                flex
                items-center
                justify-center
                gap-3
                lg:justify-start
              "
            >
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`CyberNet Careers ${social.label} profile`}
                  title={`CyberNet Careers on ${social.label}`}
                  className="
                    group
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-slate-600
                    shadow-sm
                    outline-none
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:border-blue-300
                    hover:bg-blue-50
                    hover:text-blue-600
                    hover:shadow-lg
                    hover:shadow-blue-500/10
                    focus-visible:ring-2
                    focus-visible:ring-blue-600
                    focus-visible:ring-offset-2
                    active:scale-95
                  "
                >
                  <span
                    className="
                      transition-transform
                      duration-300
                      group-hover:scale-110
                    "
                  >
                    {social.icon}
                  </span>
                </a>
              ))}
            </nav>
          </section>

          {/* ==================================================
              PLATFORM
          =================================================== */}

          <nav
            aria-label="Platform navigation"
            className="mx-auto w-full max-w-xs lg:mx-0"
          >
            <FooterHeading>Platform</FooterHeading>

            <ul className="mt-5 space-y-1 lg:mt-4">
              {platformLinks.map((link) => (
                <FooterLink
                  key={link.href}
                  label={link.label}
                  href={link.href}
                />
              ))}
            </ul>
          </nav>

          {/* ==================================================
              STUDENT
          =================================================== */}

          <nav
            aria-label="Student navigation"
            className="mx-auto w-full max-w-xs lg:mx-0"
          >
            <FooterHeading>Student</FooterHeading>

            <ul className="mt-5 space-y-1 lg:mt-4">
              {studentLinks.map((link) => (
                <FooterLink
                  key={link.href}
                  label={link.label}
                  href={link.href}
                />
              ))}
            </ul>
          </nav>

          {/* ==================================================
              LEGAL / CONTACT
          =================================================== */}

          <section className="mx-auto w-full max-w-xs lg:mx-0">
            <nav aria-label="Legal navigation">
              <FooterHeading>Legal</FooterHeading>

              <ul className="mt-5 space-y-1 lg:mt-4">
                {legalLinks.map((link) => (
                  <FooterLink
                    key={link.href}
                    label={link.label}
                    href={link.href}
                  />
                ))}
              </ul>
            </nav>

            {/* Contact */}

            <address className="mt-8 not-italic">
              <p
                className="
                  text-[10px]
                  font-extrabold
                  uppercase
                  tracking-[0.22em]
                  text-slate-400
                "
              >
                Contact
              </p>

              <a
                href="mailto:cybernet.tech.india@gmail.com"
                className="
                  mt-2
                  inline-block
                  max-w-full
                  break-all
                  text-sm
                  font-semibold
                  text-slate-700
                  transition-colors
                  duration-300
                  hover:text-blue-600
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-blue-600
                  focus-visible:ring-offset-2
                  sm:break-normal
                "
              >
                cybernet.tech.india@gmail.com
              </a>
            </address>
          </section>
        </div>

        {/* ====================================================
            BOTTOM DIVIDER
        ===================================================== */}

        <div
          className="
            mt-12
            border-t
            border-slate-200
            pt-7
            sm:mt-14
          "
        >
          <div
            className="
              flex
              flex-col
              items-center
              justify-between
              gap-5
              text-center
              lg:flex-row
            "
          >
            {/* Copyright */}

            <p className="text-xs leading-5 text-slate-500 sm:text-sm">
              © {year}{" "}
              <span className="font-semibold text-slate-700">
                CyberNet Careers
              </span>
              . All rights reserved.
            </p>

            {/* Developer */}

            <p className="text-xs leading-5 text-slate-500 sm:text-sm">
              Developed by{" "}
              <span className="font-bold text-slate-900">
                Ashish Bansod
              </span>
            </p>

            {/* Bottom Navigation */}

            <nav
              aria-label="Footer legal navigation"
              className="
                flex
                flex-wrap
                items-center
                justify-center
                gap-3
                text-xs
                text-slate-500
                sm:text-sm
              "
            >
              <Link
                href="/privacy-policy"
                className="
                  rounded-md
                  transition-colors
                  duration-200
                  hover:text-blue-600
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-blue-600
                  focus-visible:ring-offset-2
                "
              >
                Privacy
              </Link>

              <span aria-hidden="true">•</span>

              <Link
                href="/terms-and-conditions"
                className="
                  rounded-md
                  transition-colors
                  duration-200
                  hover:text-blue-600
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-blue-600
                  focus-visible:ring-offset-2
                "
              >
                Terms
              </Link>

              <span aria-hidden="true">•</span>

              <Link
                href="/contact"
                className="
                  rounded-md
                  transition-colors
                  duration-200
                  hover:text-blue-600
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-blue-600
                  focus-visible:ring-offset-2
                "
              >
                Contact
              </Link>
            </nav>
          </div>
        </div>

        {/* ====================================================
            COMPANY SIGNATURE
        ===================================================== */}

        <div
          className="
            mt-7
            flex
            items-center
            justify-center
            gap-3
            text-center
            text-[9px]
            font-bold
            uppercase
            tracking-[0.22em]
            text-slate-400
            sm:text-[10px]
          "
        >
          <span
            className="h-px w-8 bg-slate-200 sm:w-12"
            aria-hidden="true"
          />

          <span>CyberNet Technology Systems</span>

          <span
            className="h-px w-8 bg-slate-200 sm:w-12"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* ======================================================
          ACCESSIBILITY / REDUCED MOTION
      ======================================================= */}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </footer>
  );
}