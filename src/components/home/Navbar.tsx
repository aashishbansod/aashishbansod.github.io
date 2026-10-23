"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/* ============================================================
   TYPES
============================================================ */

type NavItem = {
  label: string;
  href: string;
  section?: string;
};

/* ============================================================
   SITE NAVIGATION
============================================================ */

const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Benefits",
    href: "/#benefits",
    section: "benefits",
  },
  {
    label: "Internships",
    href: "/#internships",
    section: "internships",
  },
  {
    label: "How It Works",
    href: "/#process",
    section: "process",
  },
  {
    label: "Certificate",
    href: "/certificate",
  },
  {
    label: "Contact",
    href: "/contact",
  },
];

/* ============================================================
   CONSTANTS
============================================================ */

const DEFAULT_NAV_HEIGHT = 76;
const SCROLLED_NAV_HEIGHT = 68;

/* ============================================================
   COMPONENT
============================================================ */

export default function Navbar() {
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] =
    useState("home");

  /* ==========================================================
     SCROLL STATE
  ========================================================== */

  useEffect(() => {
    let ticking = false;

    const updateScrollState = () => {
      if (ticking) {
        return;
      }

      ticking = true;

      window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;

        setIsScrolled(scrollY > 12);

        if (pathname === "/" && scrollY < 120) {
          setActiveSection("home");
        }

        ticking = false;
      });
    };

    updateScrollState();

    window.addEventListener(
      "scroll",
      updateScrollState,
      {
        passive: true,
      }
    );

    return () => {
      window.removeEventListener(
        "scroll",
        updateScrollState
      );
    };
  }, [pathname]);

  /* ==========================================================
     ACTIVE HOMEPAGE SECTION
  ========================================================== */

  useEffect(() => {
    if (pathname !== "/") {
      setActiveSection(pathname);
      return;
    }

    const sectionIds = [
      "benefits",
      "internships",
      "process",
      "placement",
    ];

    const elements = sectionIds
      .map((id) =>
        document.getElementById(id)
      )
      .filter(
        (element): element is HTMLElement =>
          element !== null
      );

    if (elements.length === 0) {
      setActiveSection("home");
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visibleEntries =
            entries
              .filter(
                (entry) =>
                  entry.isIntersecting
              )
              .sort(
                (a, b) =>
                  b.intersectionRatio -
                  a.intersectionRatio
              );

          if (
            visibleEntries.length > 0
          ) {
            setActiveSection(
              visibleEntries[0].target.id
            );
          }
        },
        {
          root: null,
          rootMargin:
            "-20% 0px -60% 0px",
          threshold: [
            0.1,
            0.25,
            0.5,
            0.75,
          ],
        }
      );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  /* ==========================================================
     CLOSE MOBILE MENU ON ROUTE CHANGE
  ========================================================== */

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  /* ==========================================================
     BODY SCROLL LOCK
  ========================================================== */

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [menuOpen]);

  /* ==========================================================
     ESCAPE KEY
  ========================================================== */

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [menuOpen]);

  /* ==========================================================
     ACTIVE NAV ITEM
  ========================================================== */

  const isItemActive = (
    item: NavItem
  ): boolean => {
    if (item.href === "/") {
      return (
        pathname === "/" &&
        activeSection === "home"
      );
    }

    if (item.section) {
      return (
        pathname === "/" &&
        activeSection === item.section
      );
    }

    return pathname === item.href;
  };

  /* ==========================================================
     NAVIGATION CLICK
  ========================================================== */

  const handleNavigationClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: NavItem
  ) => {
    setMenuOpen(false);

    if (!item.section) {
      return;
    }

    if (pathname !== "/") {
      return;
    }

    event.preventDefault();

    const target =
      document.getElementById(
        item.section
      );

    if (!target) {
      return;
    }

    setActiveSection(item.section);

    const offset =
      (isScrolled
        ? SCROLLED_NAV_HEIGHT
        : DEFAULT_NAV_HEIGHT) + 12;

    const targetTop =
      target.getBoundingClientRect()
        .top +
      window.scrollY -
      offset;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });

    window.history.replaceState(
      null,
      "",
      `/#${item.section}`
    );
  };

  /* ==========================================================
     LOGO CLICK
  ========================================================== */

  const handleLogoClick = (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    setMenuOpen(false);

    if (pathname !== "/") {
      return;
    }

    event.preventDefault();

    setActiveSection("home");

    window.history.replaceState(
      null,
      "",
      "/"
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <>
      {/* ======================================================
          HEADER
      ======================================================= */}

      <header
        className={[
          "fixed inset-x-0 top-0 z-[100]",
          "transition-all duration-500 ease-out",
          isScrolled
            ? [
                "border-b border-slate-200/80",
                "bg-white/95",
                "shadow-lg shadow-slate-950/[0.06]",
                "backdrop-blur-2xl",
              ].join(" ")
            : [
                "border-b border-slate-100/80",
                "bg-white/90",
                "backdrop-blur-xl",
              ].join(" "),
        ].join(" ")}
      >
        {/* ====================================================
            TOP LIGHT
        ===================================================== */}

        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
          aria-hidden="true"
        >
          <span className="navbar-light absolute left-[-35%] top-0 h-full w-[30%] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
        </div>

        {/* ====================================================
            BOTTOM LIGHT
        ===================================================== */}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-300/60 to-transparent"
          aria-hidden="true"
        />

        {/* ====================================================
            MAIN NAVIGATION CONTAINER
        ===================================================== */}

        <div
          className={[
            "mx-auto flex w-full max-w-7xl items-center",
            "justify-between",
            "px-4 sm:px-6 lg:px-8",
            "transition-[height] duration-500 ease-out",
            isScrolled
              ? "h-[68px]"
              : "h-[76px]",
          ].join(" ")}
        >
          {/* ==================================================
              LOGO
          =================================================== */}

          <Link
            href="/"
            onClick={handleLogoClick}
            aria-label="CyberNet Careers home"
            className="group relative flex shrink-0 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
          >
            {/* Glow */}

            <span
              className="pointer-events-none absolute -inset-4 rounded-3xl bg-blue-500/10 opacity-0 blur-2xl transition-all duration-700 group-hover:scale-110 group-hover:opacity-100"
              aria-hidden="true"
            />

            {/* Logo image container */}

            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md shadow-blue-900/10 ring-1 ring-slate-200 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:ring-blue-300 group-hover:shadow-xl group-hover:shadow-blue-500/20 sm:h-11 sm:w-11">
              <Image
                src="/logos/CompanyLogo.png"
                alt="CyberNet Technology Systems logo"
                width={44}
                height={44}
                priority
                sizes="44px"
                className="h-full w-full object-contain p-1 transition-transform duration-500 group-hover:scale-110"
              />

              {/* Shine */}

              <span
                className="logo-shine pointer-events-none absolute bottom-0 left-[-75%] top-0 z-20 w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/75 to-transparent"
                aria-hidden="true"
              />
            </span>

            {/* Brand */}

            <span className="ml-3 hidden sm:block">
              <span className="block text-[15px] font-extrabold tracking-tight text-slate-950 transition-colors duration-300 group-hover:text-blue-600">
                CyberNet
              </span>

              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Careers
              </span>
            </span>
          </Link>

          {/* ==================================================
              DESKTOP NAVIGATION
          =================================================== */}

          <nav
            aria-label="Primary navigation"
            className="hidden items-center justify-center gap-0.5 md:flex lg:gap-1"
          >
            {navItems.map((item) => {
              const active =
                isItemActive(item);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={(event) =>
                    handleNavigationClick(
                      event,
                      item
                    )
                  }
                  aria-current={
                    active
                      ? "page"
                      : undefined
                  }
                  className={[
                    "nav-link group relative",
                    "rounded-xl",
                    "px-3 py-2.5 lg:px-3.5",
                    "text-[13px] font-semibold",
                    "outline-none",
                    "transition-all duration-300",
                    "focus-visible:ring-2",
                    "focus-visible:ring-blue-600",
                    "focus-visible:ring-offset-2",
                    active
                      ? "text-blue-600"
                      : "text-slate-700 hover:text-blue-600",
                  ].join(" ")}
                >
                  {/* Hover / active background */}

                  <span
                    className={[
                      "absolute inset-0 rounded-xl",
                      "transition-all duration-300",
                      active
                        ? "scale-100 bg-blue-50 opacity-100"
                        : "scale-95 bg-blue-50 opacity-0 group-hover:scale-100 group-hover:opacity-100",
                    ].join(" ")}
                    aria-hidden="true"
                  />

                  {/* Label */}

                  <span className="relative z-10 whitespace-nowrap">
                    {item.label}
                  </span>

                  {/* Active underline */}

                  <span
                    className={[
                      "absolute bottom-1.5 left-1/2",
                      "h-[2px] -translate-x-1/2",
                      "rounded-full bg-blue-600",
                      "transition-all duration-500",
                      active
                        ? "w-6 opacity-100 shadow-[0_0_8px_rgba(37,99,235,0.65)]"
                        : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </nav>

          {/* ==================================================
              DESKTOP ACTIONS
          =================================================== */}

          <div className="hidden items-center gap-2 md:flex">
            {/* Login */}

            <Link
              href="/login"
              aria-current={
                pathname === "/login"
                  ? "page"
                  : undefined
              }
              className={[
                "group relative rounded-xl",
                "px-4 py-2.5",
                "text-sm font-bold",
                "outline-none",
                "transition-all duration-300",
                "focus-visible:ring-2",
                "focus-visible:ring-blue-600",
                "focus-visible:ring-offset-2",
                pathname === "/login"
                  ? "text-blue-600"
                  : "text-slate-700 hover:-translate-y-0.5 hover:text-blue-600",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute inset-0 rounded-xl",
                  "transition-opacity duration-300",
                  pathname === "/login"
                    ? "bg-blue-50 opacity-100"
                    : "bg-blue-50 opacity-0 group-hover:opacity-100",
                ].join(" ")}
                aria-hidden="true"
              />

              <span className="relative z-10">
                Login
              </span>
            </Link>

            {/* Apply */}

            <Link
              href="/apply"
              prefetch
              aria-label="Apply for a CyberNet Careers internship"
              className="apply-button group relative overflow-hidden rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 outline-none transition-all duration-300 hover:-translate-y-1 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-600/30 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span
                className="button-shine pointer-events-none absolute bottom-0 left-[-65%] top-0 w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/35 to-transparent"
                aria-hidden="true"
              />

              <span className="relative z-10 flex items-center gap-2">
                Apply Now

                <span
                  className="transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
              </span>
            </Link>
          </div>

          {/* ==================================================
              MOBILE MENU BUTTON
          =================================================== */}

          <button
            type="button"
            onClick={() =>
              setMenuOpen(
                (current) => !current
              )
            }
            aria-label={
              menuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            className={[
              "relative flex h-11 w-11",
              "items-center justify-center",
              "rounded-xl border",
              "outline-none",
              "transition-all duration-300",
              "focus-visible:ring-2",
              "focus-visible:ring-blue-600",
              "focus-visible:ring-offset-2",
              menuOpen
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50",
              "md:hidden",
            ].join(" ")}
          >
            <span
              className="relative block h-5 w-5"
              aria-hidden="true"
            >
              <span
                className={[
                  "absolute left-0 h-0.5 w-5 rounded-full",
                  "transition-all duration-300",
                  menuOpen
                    ? "top-2.5 rotate-45 bg-blue-600"
                    : "top-1 bg-slate-900",
                ].join(" ")}
              />

              <span
                className={[
                  "absolute left-0 top-2.5 h-0.5 w-5 rounded-full",
                  "transition-all duration-200",
                  menuOpen
                    ? "scale-0 opacity-0"
                    : "bg-slate-900",
                ].join(" ")}
              />

              <span
                className={[
                  "absolute left-0 h-0.5 w-5 rounded-full",
                  "transition-all duration-300",
                  menuOpen
                    ? "top-2.5 -rotate-45 bg-blue-600"
                    : "top-4 bg-slate-900",
                ].join(" ")}
              />
            </span>
          </button>
        </div>

        {/* ====================================================
            MOBILE NAVIGATION
        ===================================================== */}

        <div
          id="mobile-navigation"
          aria-hidden={!menuOpen}
          className={[
            "overflow-hidden md:hidden",
            "border-t",
            "bg-white/95 backdrop-blur-2xl",
            "transition-[max-height,opacity] duration-500 ease-out",
            menuOpen
              ? "max-h-[calc(100dvh-68px)] border-slate-200/70 opacity-100"
              : "max-h-0 border-transparent opacity-0",
          ].join(" ")}
        >
          <div className="max-h-[calc(100dvh-68px)] overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-5">
            <nav
              aria-label="Mobile primary navigation"
              className="flex flex-col gap-1"
            >
              {navItems.map(
                (item, index) => {
                  const active =
                    isItemActive(item);

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={(event) =>
                        handleNavigationClick(
                          event,
                          item
                        )
                      }
                      tabIndex={
                        menuOpen ? 0 : -1
                      }
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
                      className={[
                        "mobile-nav-item group relative",
                        "flex min-h-12 items-center justify-between",
                        "overflow-hidden rounded-xl",
                        "px-4 py-3.5",
                        "text-sm font-semibold",
                        "outline-none",
                        "transition-all duration-300",
                        "focus-visible:ring-2",
                        "focus-visible:ring-blue-600",
                        "focus-visible:ring-inset",
                        active
                          ? "bg-blue-50 text-blue-600"
                          : "text-slate-700 hover:bg-blue-50 hover:pl-5 hover:text-blue-600",
                      ].join(" ")}
                      style={{
                        animationDelay: `${index * 45}ms`,
                      }}
                    >
                      {/* Active marker */}

                      {active && (
                        <span
                          className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.65)]"
                          aria-hidden="true"
                        />
                      )}

                      <span className="relative z-10">
                        {item.label}
                      </span>

                      <span
                        className="relative z-10 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-500"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </Link>
                  );
                }
              )}
            </nav>

            {/* ==================================================
                MOBILE ACTIONS
            =================================================== */}

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <Link
                href="/login"
                onClick={() =>
                  setMenuOpen(false)
                }
                tabIndex={
                  menuOpen ? 0 : -1
                }
                aria-current={
                  pathname === "/login"
                    ? "page"
                    : undefined
                }
                className={[
                  "rounded-xl border px-4 py-3.5",
                  "text-center text-sm font-bold",
                  "outline-none",
                  "transition-all duration-300",
                  "focus-visible:ring-2",
                  "focus-visible:ring-blue-600",
                  "focus-visible:ring-offset-2",
                  pathname === "/login"
                    ? "border-blue-200 bg-blue-50 text-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600",
                ].join(" ")}
              >
                Login
              </Link>

              <Link
                href="/apply"
                prefetch
                onClick={() =>
                  setMenuOpen(false)
                }
                tabIndex={
                  menuOpen ? 0 : -1
                }
                aria-label="Apply for a CyberNet Careers internship"
                className="group relative overflow-hidden rounded-xl bg-blue-600 px-4 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-blue-600/20 outline-none transition-all duration-300 hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <span
                  className="button-shine pointer-events-none absolute bottom-0 left-[-65%] top-0 w-1/2 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  aria-hidden="true"
                />

                <span className="relative z-10">
                  Apply Now →
                </span>
              </Link>
            </div>

            {/* ==================================================
                MOBILE BRANDING
            =================================================== */}

            <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"
                aria-hidden="true"
              />

              <span>
                CyberNet Careers
              </span>

              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </header>

      {/* ======================================================
          HEADER SPACE
      ======================================================= */}

      <div
        className="transition-[height] duration-500 ease-out"
        style={{
          height: isScrolled
            ? SCROLLED_NAV_HEIGHT
            : DEFAULT_NAV_HEIGHT,
        }}
        aria-hidden="true"
      />

      {/* ======================================================
          ANIMATIONS
      ======================================================= */}

      <style jsx>{`
        .navbar-light {
          animation: navbarLight 4.5s linear infinite;
        }

        .logo-shine {
          animation: logoShine 5.5s ease-in-out infinite;
        }

        .button-shine {
          animation: buttonShine 4.5s ease-in-out infinite;
        }

        .apply-button {
          animation: applyFloat 4s ease-in-out infinite;
        }

        .mobile-nav-item {
          animation: mobileItem 420ms ease-out both;
        }

        @keyframes navbarLight {
          0% {
            transform: translateX(0);
            opacity: 0;
          }

          12% {
            opacity: 1;
          }

          72% {
            opacity: 1;
          }

          100% {
            transform: translateX(450%);
            opacity: 0;
          }
        }

        @keyframes logoShine {
          0%,
          55% {
            left: -75%;
          }

          76%,
          100% {
            left: 145%;
          }
        }

        @keyframes buttonShine {
          0%,
          55% {
            left: -65%;
          }

          76%,
          100% {
            left: 145%;
          }
        }

        @keyframes applyFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-1px);
          }
        }

        @keyframes mobileItem {
          from {
            opacity: 0;
            transform: translateX(-14px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @media (max-width: 767px) {
          .apply-button {
            animation: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .navbar-light,
          .logo-shine,
          .button-shine,
          .apply-button,
          .mobile-nav-item {
            animation: none !important;
          }

          html {
            scroll-behavior: auto !important;
          }

          *,
          *::before,
          *::after {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </>
  );
}