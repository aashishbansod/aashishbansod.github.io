"use client";

import { useEffect, useRef, useState } from "react";

type ProcessStep = {
  step: string;
  title: string;
  description: string;
};

const steps: ProcessStep[] = [
  {
    step: "01",
    title: "Apply",
    description:
      "Complete the CyberNet Careers internship application form with your academic and personal details.",
  },
  {
    step: "02",
    title: "Get Login",
    description:
      "After application processing, your Student ID and password are sent to your registered email address.",
  },
  {
    step: "03",
    title: "Assessment",
    description:
      "Log in to your student account and complete the required assessment within the specified time period.",
  },
  {
    step: "04",
    title: "Select Internship",
    description:
      "After passing the assessment, eligible students can access available internship tracks and choose a 1, 3 or 6 month plan.",
  },
  {
    step: "05",
    title: "Payment",
    description:
      "Complete payment for the selected internship plan through the available Razorpay payment flow.",
  },
  {
    step: "06",
    title: "Dashboard",
    description:
      "After the required approval process, your student dashboard becomes active so you can continue your internship journey.",
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement | null>(null);

  const [visible, setVisible] = useState(false);

  /* ============================================================
     REVEAL SECTION ON SCROLL
  ============================================================ */

  useEffect(() => {
    const element = sectionRef.current;

    if (!element) {
      return;
    }

    const reducedMotion = window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    if (reducedMotion) {
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
        threshold: 0.08,
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
      id="process"
      aria-labelledby="process-heading"
      className="relative isolate overflow-hidden bg-white py-20 sm:py-24 md:py-28 lg:py-32"
    >
      {/* ========================================================
          DECORATIVE BACKGROUND
      ========================================================= */}

      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        {/* Left glow */}

        <div className="absolute -left-48 top-10 h-[320px] w-[320px] rounded-full bg-blue-500/[0.05] blur-[95px] sm:h-[460px] sm:w-[460px] sm:blur-[125px]" />

        {/* Right glow */}

        <div className="absolute -right-48 bottom-10 h-[340px] w-[340px] rounded-full bg-cyan-400/[0.05] blur-[100px] sm:h-[480px] sm:w-[480px] sm:blur-[130px]" />

        {/* Center glow */}

        <div className="absolute left-1/2 top-1/2 h-[300px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.018] blur-[100px] sm:h-[420px] sm:w-[700px]" />

        {/* Subtle grid */}

        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(rgba(37,99,235,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.025) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse 80% 75% at 50% 50%, black, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 75% at 50% 50%, black, transparent 90%)",
          }}
        />
      </div>

      {/* ========================================================
          FLOATING PARTICLES
      ========================================================= */}

      <span
        className="process-particle process-particle-one pointer-events-none absolute left-[8%] top-[24%] -z-10 h-1.5 w-1.5 rounded-full bg-blue-500"
        aria-hidden="true"
      />

      <span
        className="process-particle process-particle-two pointer-events-none absolute right-[9%] top-[35%] -z-10 h-1.5 w-1.5 rounded-full bg-cyan-400"
        aria-hidden="true"
      />

      <span
        className="process-particle process-particle-three pointer-events-none absolute bottom-[18%] left-[22%] -z-10 h-1 w-1 rounded-full bg-blue-400"
        aria-hidden="true"
      />

      {/* ========================================================
          MAIN CENTERED CONTAINER
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

            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-2 shadow-sm shadow-blue-500/[0.06] backdrop-blur sm:px-4">
              <span
                className="relative flex h-2 w-2 shrink-0"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-40" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>

              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-blue-600 sm:text-[11px] sm:tracking-[0.28em]">
                How It Works
              </span>
            </div>

            {/* H2 */}

            <h2
              id="process-heading"
              className="mx-auto mt-5 max-w-3xl text-[clamp(1.9rem,6vw,3.25rem)] font-black leading-[1.08] tracking-[-0.045em] text-slate-950"
            >
              Your internship journey,{" "}
              <span className="relative inline-block whitespace-nowrap text-blue-600">
                step by step
                <span
                  className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-blue-500/20 sm:-bottom-1.5"
                  aria-hidden="true"
                />
              </span>
              .
            </h2>

            {/* Supporting SEO content */}

            <p className="mx-auto mt-5 max-w-2xl px-2 text-sm leading-6 text-slate-600 sm:px-0 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
              Follow the CyberNet Careers internship process from
              application and assessment to internship selection,
              payment and student dashboard activation.
            </p>
          </header>

          {/* ======================================================
              PROCESS TIMELINE
          ======================================================= */}

          <div className="relative mx-auto mt-11 w-full max-w-6xl sm:mt-14 lg:mt-16">
            {/* ====================================================
                DESKTOP TIMELINE BASE
            ===================================================== */}

            <div
              className="pointer-events-none absolute left-[8.33%] right-[8.33%] top-[58px] hidden h-px bg-gradient-to-r from-blue-100 via-blue-300 to-cyan-200 lg:block"
              aria-hidden="true"
            />

            {/* Animated desktop progress */}

            <div
              className={[
                "pointer-events-none absolute left-[8.33%] top-[57px] hidden h-[2px] bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-400 shadow-[0_0_14px_rgba(37,99,235,0.35)] transition-all duration-[1800ms] ease-out lg:block",
                visible ? "w-[83.34%]" : "w-0",
              ].join(" ")}
              aria-hidden="true"
            />

            {/* ====================================================
                MOBILE VERTICAL GUIDE
            ===================================================== */}

            <div
              className={[
                "pointer-events-none absolute bottom-8 left-[27px] top-8 w-px bg-gradient-to-b from-blue-200 via-blue-300 to-cyan-200 transition-opacity duration-1000 md:left-[31px] lg:hidden",
                visible ? "opacity-100" : "opacity-0",
              ].join(" ")}
              aria-hidden="true"
            />

            {/* ====================================================
                PROCESS STEPS
            ===================================================== */}

            <ol
              className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:gap-6"
              aria-label="CyberNet Careers internship process"
            >
              {steps.map((item, index) => (
                <li
                  key={item.step}
                  className={[
                    "relative list-none",
                    "transition-all duration-700 ease-out",
                    visible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-10 opacity-0",
                  ].join(" ")}
                  style={{
                    transitionDelay: visible
                      ? `${150 + index * 100}ms`
                      : "0ms",
                  }}
                >
                  {/* Mobile connector */}

                  {index < steps.length - 1 && (
                    <span
                      className="pointer-events-none absolute bottom-[-16px] left-[27px] top-[64px] w-px bg-gradient-to-b from-blue-200 to-transparent md:hidden"
                      aria-hidden="true"
                    />
                  )}

                  {/* =================================================
                      STEP CARD
                  ================================================== */}

                  <article className="process-card group relative flex min-h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-lg shadow-slate-900/[0.035] transition-all duration-500 hover:-translate-y-1 hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-500/[0.11] focus-within:border-blue-300 focus-within:shadow-xl sm:rounded-3xl sm:p-7 lg:p-8">
                    {/* Card glow */}

                    <div
                      className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/[0.045] blur-3xl transition-all duration-700 group-hover:scale-150 group-hover:bg-blue-500/[0.12]"
                      aria-hidden="true"
                    />

                    <div
                      className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-cyan-400/[0.025] blur-3xl transition-all duration-700 group-hover:scale-125 group-hover:bg-cyan-400/[0.075]"
                      aria-hidden="true"
                    />

                    {/* Shine */}

                    <span
                      className="process-shine pointer-events-none absolute inset-y-0 left-[-120%] z-20 w-[32%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-0"
                      aria-hidden="true"
                    />

                    {/* =================================================
                        CARD TOP
                    ================================================== */}

                    <div className="relative flex items-center justify-between gap-4">
                      <div className="relative shrink-0">
                        <span
                          className="absolute -inset-2 rounded-2xl bg-blue-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
                          aria-hidden="true"
                        />

                        <span
                          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-xs font-black text-blue-600 shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:border-blue-500 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-blue-500/30 sm:h-12 sm:w-12 sm:rounded-2xl sm:text-sm"
                          aria-label={`Step ${item.step}`}
                        >
                          {item.step}
                        </span>
                      </div>

                      {/* Arrow */}

                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-400 transition-all duration-500 group-hover:translate-x-1 group-hover:border-blue-100 group-hover:bg-blue-50 group-hover:text-blue-600 sm:h-10 sm:w-10"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </div>

                    {/* =================================================
                        TITLE
                    ================================================== */}

                    <h3 className="relative mt-6 text-lg font-black tracking-tight text-slate-950 transition-colors duration-300 group-hover:text-blue-600 sm:mt-7 sm:text-xl">
                      {item.title}
                    </h3>

                    {/* =================================================
                        DESCRIPTION
                    ================================================== */}

                    <p className="relative mt-3 flex-1 text-sm leading-6 text-slate-600 sm:leading-7">
                      {item.description}
                    </p>

                    {/* =================================================
                        STEP FOOTER
                    ================================================== */}

                    <div className="relative mt-6 flex items-center gap-3 sm:mt-7">
                      <span
                        className="h-px flex-1 bg-slate-100 transition-colors duration-500 group-hover:bg-blue-100"
                        aria-hidden="true"
                      />

                      <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400 transition-colors duration-300 group-hover:text-blue-500 sm:text-[10px] sm:tracking-[0.2em]">
                        Step {item.step}
                      </span>
                    </div>

                    {/* Bottom glow line */}

                    <span
                      className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_14px_rgba(37,99,235,0.5)] transition-all duration-700 group-hover:w-3/4"
                      aria-hidden="true"
                    />

                    {/* Border glow */}

                    <span
                      className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent transition-colors duration-500 group-hover:border-blue-400/30 sm:rounded-3xl"
                      aria-hidden="true"
                    />
                  </article>
                </li>
              ))}
            </ol>
          </div>

          {/* ======================================================
              PROCESS SUMMARY
          ======================================================= */}

          <div
            className={[
              "mx-auto mt-10 w-full max-w-4xl text-center transition-all duration-1000 sm:mt-14",
              visible
                ? "translate-y-0 opacity-100"
                : "translate-y-5 opacity-0",
            ].join(" ")}
            style={{
              transitionDelay: "950ms",
            }}
          >
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-4 shadow-sm shadow-blue-500/[0.03] sm:rounded-3xl sm:px-6 sm:py-5">
              <p className="text-xs font-semibold leading-6 text-slate-600 sm:text-sm">
                <span className="font-extrabold text-blue-600">
                  Apply
                </span>{" "}
                →{" "}
                <span className="font-extrabold text-blue-600">
                  Get Login
                </span>{" "}
                →{" "}
                <span className="font-extrabold text-blue-600">
                  Assessment
                </span>{" "}
                →{" "}
                <span className="font-extrabold text-blue-600">
                  Select Internship
                </span>{" "}
                →{" "}
                <span className="font-extrabold text-blue-600">
                  Payment
                </span>{" "}
                →{" "}
                <span className="font-extrabold text-blue-600">
                  Dashboard
                </span>
              </p>
            </div>
          </div>

          {/* ======================================================
              ACCESSIBILITY / INFORMATION NOTE
          ======================================================= */}

          <p className="mx-auto mt-6 max-w-3xl text-center text-[11px] leading-5 text-slate-400 sm:text-xs">
            Internship access and dashboard activation are subject
            to the applicable application, assessment and approval
            requirements.
          </p>
        </div>
      </div>

      {/* ========================================================
          ANIMATIONS
      ========================================================= */}

      <style>{`
        .process-card {
          will-change: transform, opacity;
        }

        .process-shine {
          animation: processShine 1.1s ease-out forwards;
          animation-play-state: paused;
        }

        .process-card:hover .process-shine {
          animation-play-state: running;
        }

        .process-particle {
          box-shadow: 0 0 18px rgba(37, 99, 235, 0.35);
        }

        .process-particle-one {
          animation: processFloatOne 5s ease-in-out infinite;
        }

        .process-particle-two {
          animation: processFloatTwo 6s ease-in-out infinite;
        }

        .process-particle-three {
          animation: processFloatThree 4.5s ease-in-out infinite;
        }

        @keyframes processShine {
          0% {
            left: -120%;
          }

          100% {
            left: 160%;
          }
        }

        @keyframes processFloatOne {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.25;
          }

          50% {
            transform: translate3d(20px, -18px, 0);
            opacity: 1;
          }
        }

        @keyframes processFloatTwo {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.25;
          }

          50% {
            transform: translate3d(-20px, 20px, 0);
            opacity: 1;
          }
        }

        @keyframes processFloatThree {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.2;
          }

          50% {
            transform: translate3d(18px, -15px, 0);
            opacity: 0.9;
          }
        }

        @media (max-width: 639px) {
          .process-card:hover {
            transform: translateY(-3px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .process-card,
          .process-shine,
          .process-particle,
          .process-particle-one,
          .process-particle-two,
          .process-particle-three,
          .process-card * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}