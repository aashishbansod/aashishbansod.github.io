"use client";

import { useEffect, useRef, useState } from "react";

/* ============================================================
   CYBERNET CAREERS — REAL BENEFITS
============================================================ */

const benefits = [
  {
    number: "01",
    title: "Practical Learning",
    description:
      "Work with development tools, modern technologies and practical project workflows designed to help build useful technology skills.",
  },
  {
    number: "02",
    title: "Skill Assessment",
    description:
      "Complete a structured assessment to demonstrate your technical knowledge before moving forward with internship selection.",
  },
  {
    number: "03",
    title: "Real Projects",
    description:
      "Build practical projects that help you understand development workflows and strengthen your professional portfolio.",
  },
  {
    number: "04",
    title: "Verified Certificate",
    description:
      "Receive a certificate after completing the applicable internship eligibility and completion requirements.",
  },
];

const trustPoints = [
  "Structured Learning",
  "Practical Projects",
  "Verified Completion",
];

/* ============================================================
   COMPONENT
============================================================ */

export default function Benefits() {
  const sectionRef = useRef<HTMLElement | null>(null);

  const [visible, setVisible] = useState(false);

  /* ==========================================================
     REVEAL ON SCROLL
  ========================================================== */

  useEffect(() => {
    const element = sectionRef.current;

    if (!element) {
      return;
    }

    const prefersReducedMotion = window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -60px 0px",
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="benefits"
      aria-labelledby="benefits-heading"
      className="relative isolate overflow-hidden bg-white py-20 sm:py-24 md:py-28 lg:py-32"
    >
      {/* ========================================================
          DECORATIVE BACKGROUND
          Visual only
      ========================================================= */}

      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        {/* Center glow */}

        <div className="absolute left-1/2 top-1/4 h-[280px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/[0.035] blur-[100px] sm:h-[360px] sm:w-[650px]" />

        {/* Left glow */}

        <div className="absolute -left-40 top-16 h-[300px] w-[300px] rounded-full bg-blue-500/[0.05] blur-[90px] sm:h-[420px] sm:w-[420px] sm:blur-[110px]" />

        {/* Right glow */}

        <div className="absolute -right-40 bottom-10 h-[300px] w-[300px] rounded-full bg-cyan-400/[0.045] blur-[90px] sm:h-[420px] sm:w-[420px] sm:blur-[110px]" />

        {/* Floating orb */}

        <span className="benefit-orb absolute left-[12%] top-[18%] h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_25px_8px_rgba(37,99,235,0.14)]" />

        <span className="benefit-orb-reverse absolute bottom-[20%] right-[14%] h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_25px_8px_rgba(34,211,238,0.14)]" />
      </div>

      {/* ========================================================
          MAIN CONTAINER
      ========================================================= */}

      <div className="mx-auto flex w-full max-w-7xl justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          {/* ======================================================
              SECTION HEADER
          ======================================================= */}

          <header
            className={[
              "mx-auto w-full max-w-3xl text-center",
              "transition-all duration-1000 ease-out",
              visible
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0",
            ].join(" ")}
          >
            {/* Label */}

            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-2 shadow-sm shadow-blue-500/[0.05] backdrop-blur sm:px-4">
              <span
                className="relative flex h-2 w-2 shrink-0"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-40" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>

              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-blue-600 sm:text-[11px] sm:tracking-[0.28em]">
                Why CyberNet Careers
              </span>
            </div>

            {/* H2 */}

            <h2
              id="benefits-heading"
              className="mx-auto mt-5 max-w-3xl text-[clamp(1.9rem,6vw,3.25rem)] font-black leading-[1.08] tracking-[-0.045em] text-slate-950"
            >
              More than just an{" "}
              <span className="relative inline-block whitespace-nowrap text-blue-600">
                internship
                <span
                  className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-blue-500/20 sm:-bottom-1.5"
                  aria-hidden="true"
                />
              </span>
            </h2>

            {/* Supporting content */}

            <p className="mx-auto mt-5 max-w-2xl px-2 text-sm leading-6 text-slate-600 sm:px-0 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
              CyberNet Careers provides a structured internship
              experience that helps students develop practical
              technology skills, complete assessments, work on
              projects and prepare for professional opportunities.
            </p>
          </header>

          {/* ======================================================
              BENEFIT GRID
          ======================================================= */}

          <div
            className="mx-auto mt-12 grid w-full max-w-6xl grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:mt-16 lg:grid-cols-4"
            role="list"
            aria-label="CyberNet Careers internship benefits"
          >
            {benefits.map((benefit, index) => (
              <article
                key={benefit.number}
                role="listitem"
                className={[
                  "benefit-card group relative flex min-h-full flex-col overflow-hidden rounded-2xl",
                  "border border-slate-200/80 bg-white",
                  "p-5 sm:p-6",
                  "shadow-sm",
                  "transition-all duration-700 ease-out",
                  "hover:-translate-y-1 hover:border-blue-200",
                  "hover:shadow-2xl hover:shadow-blue-500/[0.10]",
                  "focus-within:border-blue-300",
                  "focus-within:shadow-xl",
                  visible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-12 opacity-0",
                ].join(" ")}
                style={{
                  transitionDelay: visible
                    ? `${120 + index * 100}ms`
                    : "0ms",
                }}
              >
                {/* ==================================================
                    CARD GLOW
                =================================================== */}

                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-blue-500/[0.065] blur-3xl transition-all duration-700 group-hover:scale-[2] group-hover:bg-blue-500/[0.12]"
                  aria-hidden="true"
                />

                {/* ==================================================
                    CARD SHINE
                =================================================== */}

                <span
                  className="benefit-shine pointer-events-none absolute bottom-0 left-[-100%] top-0 z-10 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-0"
                  aria-hidden="true"
                />

                {/* ==================================================
                    CARD TOP
                =================================================== */}

                <div className="relative flex items-center justify-between">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-600 ring-1 ring-blue-100 transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-600/25 sm:h-11 sm:w-11 sm:text-sm"
                    aria-hidden="true"
                  >
                    {benefit.number}
                  </span>

                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-300 transition-all duration-500 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:border-blue-100 group-hover:bg-blue-50 group-hover:text-blue-600"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </div>

                {/* ==================================================
                    CARD CONTENT
                =================================================== */}

                <div className="relative mt-7 flex flex-1 flex-col sm:mt-8">
                  <h3 className="text-base font-extrabold tracking-tight text-slate-950 transition-colors duration-300 group-hover:text-blue-600 sm:text-lg">
                    {benefit.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {benefit.description}
                  </p>
                </div>

                {/* ==================================================
                    CARD BOTTOM ACCENT
                =================================================== */}

                <div
                  className="absolute bottom-0 left-5 right-5 h-[2px] overflow-hidden rounded-full bg-slate-100 sm:left-6 sm:right-6"
                  aria-hidden="true"
                >
                  <span className="benefit-line block h-full w-0 rounded-full bg-blue-600 transition-all duration-700 group-hover:w-full" />
                </div>
              </article>
            ))}
          </div>

          {/* ======================================================
              TRUST STRIP
          ======================================================= */}

          <div
            className={[
              "mx-auto mt-12 flex w-full max-w-4xl flex-col items-center justify-center",
              "gap-4 border-t border-slate-100 pt-7 text-center",
              "transition-all duration-1000 ease-out",
              "sm:mt-14 sm:flex-row sm:gap-6 sm:pt-8 lg:gap-8",
              visible
                ? "translate-y-0 opacity-100"
                : "translate-y-6 opacity-0",
            ].join(" ")}
            style={{
              transitionDelay: "650ms",
            }}
          >
            {trustPoints.map((point, index) => (
              <div
                key={point}
                className="flex items-center gap-2"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-600 ring-1 ring-blue-100"
                  aria-hidden="true"
                >
                  ✓
                </span>

                <span className="text-xs font-semibold text-slate-500 sm:text-sm">
                  {point}
                </span>

                {index <
                  trustPoints.length - 1 && (
                  <span
                    className="ml-3 hidden h-1 w-1 rounded-full bg-slate-300 sm:block"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================
          ANIMATIONS
      ========================================================== */}

      <style>{`
        .benefit-card {
          will-change: transform, opacity;
        }

        .benefit-shine {
          animation: benefitShine 900ms ease-out forwards;
          animation-play-state: paused;
        }

        .benefit-card:hover .benefit-shine {
          animation-play-state: running;
        }

        .benefit-orb {
          animation: floatingOrb 5s ease-in-out infinite;
        }

        .benefit-orb-reverse {
          animation: floatingOrb 6s ease-in-out infinite reverse;
        }

        @keyframes benefitShine {
          0% {
            left: -100%;
            opacity: 0;
          }

          15% {
            opacity: 0.7;
          }

          100% {
            left: 150%;
            opacity: 0;
          }
        }

        @keyframes floatingOrb {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.4;
          }

          50% {
            transform: translate3d(0, -18px, 0);
            opacity: 1;
          }
        }

        @media (max-width: 640px) {
          .benefit-card:hover {
            transform: translateY(-4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .benefit-card,
          .benefit-shine,
          .benefit-orb,
          .benefit-orb-reverse,
          .benefit-card *,
          .benefit-card *::before,
          .benefit-card *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}