import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaRocket,
  FaBars,
  FaTimes,
  FaArrowRight,
  FaUserGraduate,
  FaUserShield,
  FaRobot,
  FaChevronDown,
  FaBolt,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

import LogoDark from "../../assets/logo-light.png";
import LogoLight from "../../assets/logo-dark.png";

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const auth = useMemo(() => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("cybernet_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("cybernet_token");

    const role =
      localStorage.getItem("userRole") ||
      sessionStorage.getItem("userRole") ||
      "";

    return {
      loggedIn: Boolean(token),
      role: String(role).toLowerCase(),
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setLoginOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setLoginOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = useMemo(
    () => [
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
      { name: "Internships", path: "/internships" },
      { name: "Certificate & Verification", path: "/certificates" },
      { name: "Contact", path: "/contact" },
    ],
    []
  );

  const isActive = (path) => location.pathname === path;

  const goToDashboard = () => {
    if (auth.role === "admin") navigate("/admin/dashboard");
    else navigate("/student/dashboard");
  };

  const loginLinks = [
    {
      label: "Student Login",
      icon: FaUserGraduate,
      path: "/login?role=student",
      hint: "Internships, assessment, certificates",
    },
    {
      label: "Admin Login",
      icon: FaUserShield,
      path: "/login?role=admin",
      hint: "Dashboard, students, payments, reports",
    },
  ];

  return (
    <>
      <div className="fixed top-0 z-[60] w-full bg-gradient-to-r from-blue-700 via-cyan-500 to-purple-600 text-white shadow-lg">
        <div className="mx-auto flex max-w-[1900px] items-center justify-center px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2 py-2 text-[11px] font-semibold tracking-[0.18em] sm:text-xs">
            <FaRobot className="animate-pulse" />
            <span className="uppercase">
              AI Systems Online • Internship Portal • Certificate Verification
            </span>
          </div>
        </div>
      </div>

      <nav
        className={[
          "fixed left-0 right-0 top-[36px] z-50 border-b transition-all duration-500",
          scrolled
            ? "border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-xl"
            : "border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl",
        ].join(" ")}
      >
        <div className="mx-auto max-w-[1900px] px-4 sm:px-6 lg:px-10 xl:px-16 2xl:px-24">
          <div className="flex h-[76px] items-center justify-between gap-4 sm:h-[84px]">
            <Link
              to="/"
              className="flex items-center gap-3 select-none"
              aria-label="CyberNet home"
            >
              <motion.img
                key={scrolled ? "light" : "dark"}
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                src={scrolled ? LogoLight : LogoDark}
                alt="CyberNet Technology Systems"
                className="h-10 w-auto object-contain sm:h-12 lg:h-14"
                draggable="false"
              />

              <div className="hidden min-w-0 lg:block">
                <p
                  className={[
                    "text-[11px] font-semibold tracking-[0.22em] uppercase",
                    scrolled ? "text-slate-400" : "text-slate-500",
                  ].join(" ")}
                >
                  Technology
                </p>
                <p
                  className={[
                    "text-sm font-black leading-none",
                    scrolled ? "text-white" : "text-slate-900",
                  ].join(" ")}
                >
                  Pvt Limited
                </p>
              </div>
            </Link>

            <div className="hidden xl:flex items-center gap-6 2xl:gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={[
                    "relative rounded-full px-1 py-2 text-[15px] font-bold tracking-wide transition-colors duration-300",
                    isActive(item.path)
                      ? scrolled
                        ? "text-cyan-400"
                        : "text-blue-600"
                      : scrolled
                      ? "text-slate-200 hover:text-cyan-400"
                      : "text-slate-700 hover:text-blue-600",
                  ].join(" ")}
                >
                  {item.name}
                  <span
                    className={[
                      "absolute left-0 -bottom-1 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300",
                      isActive(item.path) ? "w-full" : "w-0",
                    ].join(" ")}
                  />
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
                AI Systems Online
              </motion.div>

              {auth.loggedIn ? (
                <button
                  onClick={goToDashboard}
                  className={[
                    "hidden sm:inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition-all duration-300",
                    scrolled
                      ? "border border-cyan-500 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                      : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
                  ].join(" ")}
                >
                  <FaBolt />
                  Dashboard
                </button>
              ) : (
                <div ref={dropdownRef} className="relative hidden md:block">
                  <button
                    onClick={() => setLoginOpen((prev) => !prev)}
                    className={[
                      "flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition-all duration-300",
                      scrolled
                        ? "border-slate-700 text-white hover:border-cyan-500 hover:text-cyan-300"
                        : "border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600",
                    ].join(" ")}
                  >
                    Login
                    <FaChevronDown
                      className={`transition-transform duration-200 ${
                        loginOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {loginOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        className="absolute right-0 mt-3 w-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                      >
                        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-4">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                            Choose Access
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            Login as student or admin
                          </p>
                        </div>

                        <div className="p-2">
                          {loginLinks.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setLoginOpen(false)}
                                className="flex items-start gap-3 rounded-2xl px-4 py-3 transition hover:bg-slate-50"
                              >
                                <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg">
                                  <Icon />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-slate-900">
                                    {item.label}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {item.hint}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {!auth.loggedIn && (
                <Link to="/register" className="hidden sm:block">
                  <motion.button
                    whileHover={{ scale: 1.04, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 px-5 py-3 text-sm font-black text-white shadow-xl shadow-blue-500/20"
                  >
                    <FaRocket />
                    Start Career
                    <FaArrowRight />
                  </motion.button>
                </Link>
              )}

              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Toggle menu"
                className={[
                  "xl:hidden rounded-2xl p-3 text-xl transition-colors",
                  scrolled ? "text-white hover:bg-white/5" : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                {menuOpen ? <FaTimes /> : <FaBars />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="h-[112px] sm:h-[120px]" />

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="xl:hidden border-b border-slate-200 bg-white shadow-2xl"
          >
            <div className="mx-auto flex max-w-[1900px] flex-col gap-2 px-4 py-5 sm:px-6">
              <div className="mb-3 rounded-2xl bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <FaRobot className="text-blue-600" />
                  AI Systems Online
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Premium internship portal for students and admins
                </p>
              </div>

              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={[
                    "rounded-2xl px-4 py-3 font-bold transition-colors",
                    isActive(item.path)
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {item.name}
                </Link>
              ))}

              <div className="mt-3 border-t border-slate-200 pt-4 flex flex-col gap-3">
                {auth.loggedIn ? (
                  <button
                    onClick={goToDashboard}
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 font-black text-white"
                  >
                    Go to Dashboard
                  </button>
                ) : (
                  <>
                    <Link to="/login?role=student">
                      <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 py-3 font-bold text-slate-700">
                        <FaUserGraduate />
                        Student Login
                      </button>
                    </Link>

                    <Link to="/login?role=admin">
                      <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 py-3 font-bold text-slate-700">
                        <FaUserShield />
                        Admin Login
                      </button>
                    </Link>

                    <Link to="/register">
                      <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 py-3 font-black text-white">
                        <FaRocket />
                        Start Career
                        <FaArrowRight />
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Navbar;