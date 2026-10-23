import Link from "next/link";

const trustPoints = [
  "Real Project Experience",
  "Structured Learning",
  "Verified Certificate",
];

export default function Hero() {
  return (
    <header
      id="hero"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[calc(100svh-76px)] w-full items-center justify-center overflow-hidden bg-white"
    >
      {/* =========================================================
          DECORATIVE BACKGROUND
          Visual only — hidden from screen readers
      ========================================================== */}

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Main center glow */}

        <div className="absolute left-1/2 top-[8%] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-blue-500/[0.075] blur-[85px] animate-[heroGlow_7s_ease-in-out_infinite] sm:top-[12%] sm:h-[460px] sm:w-[460px] sm:blur-[105px] lg:h-[540px] lg:w-[540px]" />

        {/* Left glow */}

        <div className="absolute -left-44 top-[38%] h-[280px] w-[280px] rounded-full bg-blue-400/[0.05] blur-[85px] animate-[heroSideGlow_9s_ease-in-out_infinite] sm:h-[360px] sm:w-[360px]" />

        {/* Right glow */}

        <div className="absolute -right-44 top-[25%] h-[300px] w-[300px] rounded-full bg-cyan-400/[0.045] blur-[90px] animate-[heroSideGlowReverse_10s_ease-in-out_infinite] sm:h-[390px] sm:w-[390px]" />

        {/* Bottom glow */}

        <div className="absolute -bottom-52 left-1/2 h-[340px] w-[580px] -translate-x-1/2 rounded-full bg-blue-600/[0.03] blur-[105px] sm:-bottom-60 sm:h-[430px] sm:w-[720px]" />
      </div>

      {/* =========================================================
          SUBTLE GRID
      ========================================================== */}

      <div
        className="pointer-events-none absolute inset-0 opacity-35 sm:opacity-45"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(37,99,235,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.032) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage:
            "radial-gradient(ellipse 82% 70% at 50% 42%, black 0%, transparent 86%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 82% 70% at 50% 42%, black 0%, transparent 86%)",
        }}
      />

      {/* =========================================================
          CENTER LIGHT BEAMS
      ========================================================== */}

      <div
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-blue-500/[0.06] to-transparent"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[20%] h-px w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-500/[0.06] to-transparent"
        aria-hidden="true"
      />

      {/* =========================================================
          MAIN CONTENT
      ========================================================== */}

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-18 md:pb-24 md:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
        {/* =======================================================
            STATUS BADGE
        ======================================================== */}

        <div className="animate-[heroFadeDown_700ms_ease-out_both]">
          <div
            role="status"
            className="group relative inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-blue-200/80 bg-white/90 px-4 py-2 text-xs font-bold text-blue-700 shadow-lg shadow-blue-500/[0.06] backdrop-blur-xl transition-all duration-300 hover:border-blue-300 hover:shadow-blue-500/[0.12] sm:px-5 sm:py-2.5 sm:text-sm"
          >
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-1000 group-hover:translate-x-full"
              aria-hidden="true"
            />

            <span
              className="relative flex h-2.5 w-2.5 shrink-0"
              aria-hidden="true"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-50" />

              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600 shadow-lg shadow-blue-500/50" />
            </span>

            <span className="relative whitespace-nowrap">
              Internship Applications Open
            </span>
          </div>
        </div>

        {/* =======================================================
            PRIMARY H1
        ======================================================== */}

        <div className="mt-7 w-full animate-[heroFadeUp_800ms_ease-out_100ms_both] sm:mt-8">
          <h1
            id="hero-heading"
            className="mx-auto max-w-6xl text-[clamp(2.35rem,9.5vw,5.25rem)] font-black leading-[0.98] tracking-[-0.055em] text-slate-950 sm:leading-[1]"
          >
            Start Your{" "}
            <span className="relative inline-block whitespace-nowrap text-blue-600">
              <span className="relative z-10">
                Tech Career
              </span>

              <span
                className="absolute -bottom-1 left-1/2 h-1 w-0 -translate-x-1/2 rounded-full bg-blue-600 shadow-lg shadow-blue-500/40 animate-[heroUnderline_1s_ease-out_700ms_forwards] sm:-bottom-2 sm:h-1.5"
                aria-hidden="true"
              />
            </span>{" "}
            <br />
            With CyberNet
          </h1>

          {/* =====================================================
              SUPPORTING SEO CONTENT
          ====================================================== */}

          <p className="mx-auto mt-7 max-w-2xl px-2 text-sm font-medium leading-6 text-slate-600 sm:mt-8 sm:px-0 sm:text-base sm:leading-7 md:text-lg md:leading-8 lg:text-xl">
            Build practical technology skills, complete
            structured assessments, work on practical projects,
            and take the next step toward your career with
            CyberNet Careers.
          </p>
        </div>

        {/* =======================================================
            PRIMARY ACTIONS
        ======================================================== */}

        <div className="mt-9 flex w-full max-w-md flex-col items-stretch justify-center gap-3.5 animate-[heroFadeUp_800ms_ease-out_250ms_both] sm:mt-10 sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
          {/* Primary CTA */}

          <Link
            href="/apply"
            prefetch
            aria-label="Apply now for a CyberNet Careers internship"
            className="group relative inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/25 outline-none transition-all duration-300 hover:-translate-y-1 hover:bg-blue-500 hover:shadow-2xl hover:shadow-blue-600/30 focus-visible:ring-4 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2 active:translate-y-0 sm:w-auto sm:px-9 sm:text-base"
          >
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              aria-hidden="true"
            />

            <span className="relative z-10 flex items-center justify-center gap-2">
              Apply Now

              <span
                className="transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              >
                →
              </span>
            </span>
          </Link>

          {/* Secondary CTA */}

          <a
            href="#process"
            aria-label="Learn how the CyberNet Careers internship process works"
            className="group inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white/90 px-7 py-3.5 text-sm font-bold text-slate-800 shadow-lg shadow-slate-900/[0.04] backdrop-blur outline-none transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-xl focus-visible:ring-4 focus-visible:ring-blue-500/20 focus-visible:ring-offset-2 active:translate-y-0 sm:w-auto sm:px-9 sm:text-base"
          >
            <span className="flex items-center justify-center gap-2">
              How It Works

              <span
                className="transition-transform duration-300 group-hover:translate-y-1"
                aria-hidden="true"
              >
                ↓
              </span>
            </span>
          </a>
        </div>

        {/* =======================================================
            TRUST / VALUE POINTS
        ======================================================== */}

        <div className="mt-10 w-full animate-[heroFadeUp_800ms_ease-out_400ms_both] sm:mt-12">
          <ul
            className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-3 text-[11px] font-semibold text-slate-400 sm:gap-x-5 sm:text-sm"
            aria-label="CyberNet Careers internship highlights"
          >
            {trustPoints.map(
              (point, index) => (
                <li
                  key={point}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                    aria-hidden="true"
                  />

                  <span>{point}</span>

                  {index <
                    trustPoints.length - 1 && (
                    <span
                      className="ml-2 hidden h-4 w-px bg-slate-200 sm:block"
                      aria-hidden="true"
                    />
                  )}
                </li>
              )
            )}
          </ul>
        </div>

        {/* =======================================================
            INTERNAL SEO / CONTEXTUAL LINKS
        ======================================================== */}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-400 sm:mt-10 sm:text-sm">
          <Link
            href="/internships"
            className="rounded-md underline-offset-4 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Explore Internships
          </Link>

          <span
            className="h-1 w-1 rounded-full bg-slate-300"
            aria-hidden="true"
          />

          <Link
            href="/certificate"
            className="rounded-md underline-offset-4 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Certificate
          </Link>

          <span
            className="h-1 w-1 rounded-full bg-slate-300"
            aria-hidden="true"
          />

          <Link
            href="/contact"
            className="rounded-md underline-offset-4 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Contact
          </Link>
        </div>

        {/* =======================================================
            BOTTOM DECORATIVE LINE
        ======================================================== */}

        <div
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-[88%] -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-200/60 to-transparent sm:w-[80%]"
          aria-hidden="true"
        />
      </div>

      {/* =========================================================
          ANIMATIONS
      ========================================================== */}

      <style>{`
        @keyframes heroFadeUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes heroFadeDown {
          from {
            opacity: 0;
            transform: translateY(-18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes heroUnderline {
          from {
            width: 0;
          }

          to {
            width: 72%;
          }
        }

        @keyframes heroGlow {
          0%,
          100% {
            opacity: 0.45;
            transform: translateX(-50%) scale(0.95);
          }

          50% {
            opacity: 0.9;
            transform: translateX(-50%) scale(1.08);
          }
        }

        @keyframes heroSideGlow {
          0%,
          100% {
            opacity: 0.28;
            transform: translateY(0) scale(1);
          }

          50% {
            opacity: 0.62;
            transform: translateY(-25px) scale(1.07);
          }
        }

        @keyframes heroSideGlowReverse {
          0%,
          100% {
            opacity: 0.25;
            transform: translateY(0) scale(1);
          }

          50% {
            opacity: 0.58;
            transform: translateY(24px) scale(1.08);
          }
        }

        @media (max-width: 380px) {
          #hero h1 {
            font-size: 2.2rem;
            letter-spacing: -0.045em;
          }
        }

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
    </header>
  );
}