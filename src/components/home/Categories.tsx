"use client";

import { useEffect, useRef, useState } from "react";

type InternshipCategory = {
  title: string;
  description: string;
  tags: string[];
};

const categories: InternshipCategory[] = [
  {
    title: "Java Full Stack Development",
    description:
      "Build full-stack applications using Java, Spring Boot, REST APIs, databases and modern frontend technologies.",
    tags: ["Java", "Spring Boot", "React", "MySQL"],
  },
  {
    title: "Python Full Stack Development",
    description:
      "Develop web applications using Python, Django, REST APIs, databases and modern frontend technologies.",
    tags: ["Python", "Django", "React", "MySQL"],
  },
  {
    title: "Frontend Development",
    description:
      "Create responsive and interactive user interfaces using HTML, CSS, JavaScript and React-based technologies.",
    tags: ["HTML", "CSS", "JavaScript", "React"],
  },
  {
    title: "Backend Development",
    description:
      "Develop backend systems with APIs, authentication, databases, server-side logic and application integrations.",
    tags: ["Node.js", "Express.js", "MongoDB", "APIs"],
  },
  {
    title: "Web Development",
    description:
      "Learn to design and develop responsive websites and modern web applications using practical development workflows.",
    tags: ["HTML", "CSS", "JavaScript", "Responsive Design"],
  },
  {
    title: "MERN Stack Development",
    description:
      "Build full-stack web applications using MongoDB, Express.js, React and Node.js with practical project workflows.",
    tags: ["MongoDB", "Express.js", "React", "Node.js"],
  },
];

export default function Categories() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  /* ============================================================
     REVEAL SECTION WHEN IT ENTERS THE VIEWPORT
  ============================================================ */

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) {
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
        threshold: 0.08,
        rootMargin: "0px 0px -60px 0px",
      }
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="internships"
      aria-labelledby="internships-heading"
      className="relative isolate overflow-hidden bg-slate-50 py-20 sm:py-24 md:py-28 lg:py-32"
    >
      {/* ========================================================
          DECORATIVE BACKGROUND
          Purely visual
      ========================================================= */}

      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        {/* Left glow */}

        <div className="absolute -left-48 top-10 h-[320px] w-[320px] rounded-full bg-blue-500/[0.05] blur-[95px] sm:h-[460px] sm:w-[460px] sm:blur-[120px]" />

        {/* Right glow */}

        <div className="absolute -right-48 bottom-0 h-[340px] w-[340px] rounded-full bg-cyan-400/[0.05] blur-[100px] sm:h-[480px] sm:w-[480px] sm:blur-[125px]" />

        {/* Center glow */}

        <div className="absolute left-1/2 top-1/2 h-[300px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.018] blur-[100px] sm:h-[420px] sm:w-[680px]" />

        {/* Grid */}

        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(37,99,235,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.025) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent 90%)",
          }}
        />
      </div>

      {/* ========================================================
          FLOATING DECORATION
      ========================================================= */}

      <span
        className="category-particle category-particle-one pointer-events-none absolute left-[8%] top-[18%] -z-10 h-1.5 w-1.5 rounded-full bg-blue-500"
        aria-hidden="true"
      />

      <span
        className="category-particle category-particle-two pointer-events-none absolute right-[10%] top-[28%] -z-10 h-1.5 w-1.5 rounded-full bg-cyan-400"
        aria-hidden="true"
      />

      <span
        className="category-particle category-particle-three pointer-events-none absolute bottom-[20%] left-[20%] -z-10 h-1 w-1 rounded-full bg-blue-400"
        aria-hidden="true"
      />

      <span
        className="category-particle category-particle-four pointer-events-none absolute bottom-[25%] right-[20%] -z-10 h-1 w-1 rounded-full bg-cyan-400"
        aria-hidden="true"
      />

      {/* ========================================================
          CENTERED CONTENT CONTAINER
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
            {/* Section label */}

            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-2 shadow-sm shadow-blue-500/[0.06] backdrop-blur sm:px-4">
              <span
                className="relative flex h-2 w-2 shrink-0"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-40" />

                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>

              <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-blue-600 sm:text-[11px] sm:tracking-[0.28em]">
                Internship Tracks
              </span>
            </div>

            {/* Primary section heading */}

            <h2
              id="internships-heading"
              className="mx-auto mt-5 max-w-3xl text-[clamp(1.9rem,6vw,3.25rem)] font-black leading-[1.08] tracking-[-0.045em] text-slate-950"
            >
              Choose your{" "}
              <span className="relative inline-block whitespace-nowrap text-blue-600">
                technology path
                <span
                  className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-blue-500/20 sm:-bottom-1.5"
                  aria-hidden="true"
                />
              </span>
              .
            </h2>

            {/* Supporting SEO content */}

            <p className="mx-auto mt-5 max-w-2xl px-2 text-sm leading-6 text-slate-600 sm:px-0 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
              Explore software development and technology internship
              tracks covering Java, Python, frontend, backend, web
              development and MERN stack technologies.
            </p>
          </header>

          {/* ======================================================
              INTERNSHIP TRACK GRID
          ======================================================= */}

          <div
            className="mx-auto mt-11 grid w-full max-w-6xl grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:mt-16 lg:gap-6"
            role="list"
            aria-label="CyberNet Careers technology internship tracks"
          >
            {categories.map((category, index) => (
              <article
                key={category.title}
                role="listitem"
                className={[
                  "category-card group relative flex min-h-full flex-col overflow-hidden",
                  "rounded-2xl border border-slate-200/90 bg-white",
                  "p-5 shadow-lg shadow-slate-900/[0.035]",
                  "transition-all duration-700 ease-out",
                  "hover:-translate-y-1 hover:border-blue-300",
                  "hover:shadow-2xl hover:shadow-blue-500/[0.11]",
                  "focus-within:border-blue-300",
                  "focus-within:shadow-xl",
                  "sm:rounded-3xl sm:p-7 lg:p-8",
                  visible
                    ? "translate-y-0 scale-100 opacity-100"
                    : "translate-y-12 scale-[0.97] opacity-0",
                ].join(" ")}
                style={{
                  transitionDelay: visible
                    ? `${140 + index * 90}ms`
                    : "0ms",
                }}
              >
                {/* ==================================================
                    CARD GLOW
                =================================================== */}

                <div
                  className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-500/[0.045] blur-3xl transition-all duration-700 group-hover:scale-150 group-hover:bg-blue-500/[0.11]"
                  aria-hidden="true"
                />

                <div
                  className="pointer-events-none absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-cyan-400/[0.025] blur-3xl transition-all duration-700 group-hover:scale-125 group-hover:bg-cyan-400/[0.075]"
                  aria-hidden="true"
                />

                {/* ==================================================
                    SHINE
                =================================================== */}

                <span
                  className="category-shine pointer-events-none absolute inset-y-0 left-[-120%] z-20 w-[30%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-0"
                  aria-hidden="true"
                />

                {/* ==================================================
                    CARD HEADER
                =================================================== */}

                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {/* Track number */}

                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.55)]"
                        aria-hidden="true"
                      />

                      <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-blue-500 sm:text-[10px] sm:tracking-[0.2em]">
                        Track{" "}
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Semantic card heading */}

                    <h3 className="text-lg font-black leading-tight tracking-tight text-slate-950 transition-colors duration-300 group-hover:text-blue-600 sm:text-xl lg:text-2xl">
                      {category.title}
                    </h3>
                  </div>

                  {/* Arrow */}

                  <div
                    className="relative shrink-0"
                    aria-hidden="true"
                  >
                    <span className="absolute -inset-2 rounded-2xl bg-blue-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

                    <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:border-blue-500 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-blue-500/30 sm:h-12 sm:w-12 sm:rounded-2xl">
                      <span className="text-base transition-transform duration-500 group-hover:translate-x-1 sm:text-lg">
                        →
                      </span>
                    </span>
                  </div>
                </div>

                {/* ==================================================
                    DESCRIPTION
                =================================================== */}

                <p className="relative mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:mt-5 sm:text-[15px] sm:leading-7">
                  {category.description}
                </p>

                {/* ==================================================
                    DIVIDER
                =================================================== */}

                <div
                  className="relative mt-6 h-px overflow-hidden bg-slate-100 sm:mt-7"
                  aria-hidden="true"
                >
                  <span className="absolute left-0 top-0 h-full w-0 bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 group-hover:w-full" />
                </div>

                {/* ==================================================
                    TECHNOLOGY TAGS
                =================================================== */}

                <div className="relative mt-5 flex flex-wrap gap-2 sm:mt-6">
                  {category.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-all duration-300 group-hover:border-blue-100 group-hover:bg-blue-50 group-hover:text-blue-600 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* ==================================================
                    REQUIREMENT STATUS
                =================================================== */}

                <div className="relative mt-6 flex items-center justify-between gap-3 sm:mt-7">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                      aria-hidden="true"
                    />

                    <span className="truncate text-[11px] font-semibold text-slate-400 sm:text-xs">
                      Assessment required
                    </span>
                  </div>

                  <span
                    className="hidden shrink-0 text-xs font-extrabold text-blue-600 opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100 sm:block sm:translate-x-2"
                    aria-hidden="true"
                  >
                    Explore track →
                  </span>
                </div>

                {/* ==================================================
                    BORDER ACCENT
                =================================================== */}

                <span
                  className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent transition-colors duration-500 group-hover:border-blue-400/30 sm:rounded-3xl"
                  aria-hidden="true"
                />

                {/* ==================================================
                    BOTTOM GLOW LINE
                =================================================== */}

                <span
                  className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all duration-700 group-hover:w-2/3"
                  aria-hidden="true"
                />
              </article>
            ))}
          </div>

          {/* ======================================================
              SUPPORTING INFORMATION
          ======================================================= */}

          <div
            className={[
              "mx-auto mt-10 flex max-w-3xl items-center justify-center gap-3 text-center",
              "transition-all duration-1000 ease-out sm:mt-12",
              visible
                ? "translate-y-0 opacity-100"
                : "translate-y-5 opacity-0",
            ].join(" ")}
            style={{
              transitionDelay: "850ms",
            }}
          >
            <span
              className="hidden h-px w-10 bg-gradient-to-r from-transparent to-blue-200 sm:block sm:w-12"
              aria-hidden="true"
            />

            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.5)]"
              aria-hidden="true"
            />

            <p className="text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
              Pass the required assessment to continue with
              internship selection.
            </p>

            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
              aria-hidden="true"
            />

            <span
              className="hidden h-px w-10 bg-gradient-to-l from-transparent to-cyan-200 sm:block sm:w-12"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* ========================================================
          ANIMATIONS
      ========================================================= */}

      <style>{`
        .category-card {
          will-change: transform, opacity;
        }

        .category-shine {
          animation: categoryShine 1.1s ease-out forwards;
          animation-play-state: paused;
        }

        .category-card:hover .category-shine {
          animation-play-state: running;
        }

        .category-particle-one {
          animation: categoryFloatOne 5s ease-in-out infinite;
        }

        .category-particle-two {
          animation: categoryFloatTwo 6s ease-in-out infinite;
        }

        .category-particle-three {
          animation: categoryFloatThree 4.5s ease-in-out infinite;
        }

        .category-particle-four {
          animation: categoryFloatFour 5.5s ease-in-out infinite;
        }

        @keyframes categoryShine {
          0% {
            left: -120%;
          }

          100% {
            left: 160%;
          }
        }

        @keyframes categoryFloatOne {
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

        @keyframes categoryFloatTwo {
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

        @keyframes categoryFloatThree {
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

        @keyframes categoryFloatFour {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.2;
          }

          50% {
            transform: translate3d(-16px, -20px, 0);
            opacity: 0.9;
          }
        }

        @media (max-width: 640px) {
          .category-card:hover {
            transform: translateY(-4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .category-card,
          .category-shine,
          .category-particle-one,
          .category-particle-two,
          .category-particle-three,
          .category-particle-four,
          .category-card * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}