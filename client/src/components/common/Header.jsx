import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBars,
  FaBell,
  FaSearch,
  FaChevronDown,
  FaSignOutAlt,
  FaUserCircle,
  FaMoon,
  FaSun,
  FaTasks,
  FaShieldAlt,
  FaRocket,
  FaChartLine,
  FaGraduationCap,
} from "react-icons/fa";

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function getStoredUser() {
  try {
    const raw =
      localStorage.getItem("student") ||
      sessionStorage.getItem("student");

    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem("cybernet_token") ||
    sessionStorage.getItem("cybernet_token") ||
    ""
  );
}

function Header({
  title = "Dashboard",
  subtitle = "CyberNet Technology Systems",
  onMenuClick,
  onSearch,
  searchPlaceholder = "Search...",
  showSearch = true,
  unreadCount = 0,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const token = getToken();

  const user = useMemo(() => {
    const stored = getStoredUser();
    const payload = decodeJwtPayload(token);

    return (
      stored || {
        firstName: payload?.firstName || "Student",
        lastName: payload?.lastName || "",
        email: payload?.email || "",
        role: payload?.role || "student",
      }
    );
  }, [token]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initialDark =
      saved === "dark" ||
      (!saved &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    setDarkMode(initialDark);
    document.documentElement.classList.toggle("dark", initialDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  const handleSearch = (value) => {
    setQuery(value);
    if (typeof onSearch === "function") {
      onSearch(value);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("cybernet_token");
    localStorage.removeItem("student");
    localStorage.removeItem("userRole");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("cybernet_token");
    sessionStorage.removeItem("student");
    sessionStorage.removeItem("userRole");

    navigate("/login", { replace: true });
  };

  const role = user?.role || "student";

  const roleLabel =
    role === "admin"
      ? "Admin"
      : role === "mentor"
      ? "Mentor"
      : "Student";

  const quickStats = useMemo(
    () => [
      {
        label: "Tasks",
        value: "18",
        icon: FaTasks,
      },
      {
        label: "Progress",
        value: "72%",
        icon: FaChartLine,
      },
      {
        label: "Mentor",
        value: "AI",
        icon: FaRocket,
      },
      {
        label: "Secure",
        value: "On",
        icon: FaShieldAlt,
      },
    ],
    []
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto max-w-[1900px] px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* LEFT */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (typeof onMenuClick === "function") {
                  onMenuClick();
                }
                setMenuOpen((prev) => !prev);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Toggle sidebar"
            >
              <FaBars />
            </button>

            <div className="hidden sm:block">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                {subtitle}
              </p>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {title}
              </h1>
            </div>
          </div>

          {/* CENTER SEARCH */}
          {showSearch && (
            <div className="hidden flex-1 px-4 md:block">
              <div className="relative mx-auto max-w-2xl">
                <FaSearch className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950"
                />
              </div>
            </div>
          )}

          {/* RIGHT */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Toggle theme"
            >
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>

            <button
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Notifications"
            >
              <FaBell />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                  <FaUserCircle />
                </div>

                <div className="hidden text-left sm:block">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {user?.firstName || "Student"} {user?.lastName || ""}
                  </p>
                  <p className="text-xs text-slate-500">{roleLabel}</p>
                </div>

                <FaChevronDown className="text-xs text-slate-400" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 mt-3 w-[320px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                          <FaUserCircle />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">
                            {user?.firstName || "Student"} {user?.lastName || ""}
                          </p>
                          <p className="text-sm text-slate-500">{user?.email || ""}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 px-5 py-5">
                      {quickStats.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-900"
                        >
                          <item.icon className="mx-auto text-blue-600" />
                          <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">
                            {item.value}
                          </p>
                          <p className="text-xs text-slate-500">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                      <Link
                        to="/student/profile"
                        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        <FaUserCircle className="text-blue-600" />
                        My Profile
                      </Link>

                      <Link
                        to="/student/dashboard"
                        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        <FaGraduationCap className="text-cyan-600" />
                        Dashboard
                      </Link>

                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <FaSignOutAlt />
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE SEARCH */}
      {showSearch && (
        <div className="border-t border-slate-200 px-4 py-3 md:hidden dark:border-slate-800">
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950"
            />
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;