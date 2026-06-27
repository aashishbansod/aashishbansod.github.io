import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaTimes,
  FaBell,
  FaUserCircle,
  FaSignOutAlt,
  FaHome,
} from "react-icons/fa";

import Sidebar from "../components/common/Sidebar";

function getStoredUser() {
  try {
    const raw =
      localStorage.getItem("student") ||
      localStorage.getItem("user") ||
      sessionStorage.getItem("student") ||
      sessionStorage.getItem("user");

    if (!raw) return null;

    if (typeof raw === "string") {
      return JSON.parse(raw);
    }

    return raw;
  } catch {
    return null;
  }
}

function clearAuth() {
  [
    "token",
    "authToken",
    "cybernet_token",
    "student",
    "user",
    "admin",
    "userRole",
  ].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const user = useMemo(() => getStoredUser(), [location.pathname]);

  const studentName =
    [
      user?.firstName,
      user?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || user?.fullName || "Student";

  const studentEmail =
    user?.email ||
    localStorage.getItem("email") ||
    "CyberNet Member";

  const pageTitle = useMemo(() => {
    const path = location.pathname;

    if (path.includes("/dashboard")) return "Dashboard";
    if (path.includes("/internships")) return "Internships";
    if (path.includes("/daily-tasks")) return "Daily Tasks";
    if (path.includes("/coding-practice")) return "Coding Practice";
    if (path.includes("/assessment")) return "Assessment";
    if (path.includes("/certificates")) return "Certificates";
    if (path.includes("/leaderboard")) return "Leaderboard";
    if (path.includes("/scholarship")) return "Scholarship";
    if (path.includes("/ai-mentor")) return "AI Mentor";
    if (path.includes("/profile")) return "Profile";

    return "Student Portal";
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:pl-72">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-800 bg-slate-950 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-800 bg-slate-950 transition-transform duration-300 ease-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <Sidebar />
      </aside>

      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
              </button>

              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                  <FaHome />
                  CyberNet Student Portal
                </div>

                <h1 className="mt-2 truncate text-lg font-black text-slate-900 sm:text-2xl">
                  {pageTitle}
                </h1>

                <p className="truncate text-xs text-slate-500 sm:text-sm">
                  Internship • Learning • Certification Platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                aria-label="Notifications"
              >
                <FaBell className="text-lg" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>

              <div className="hidden items-center gap-3 sm:flex">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <FaUserCircle className="text-3xl" />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900">
                    {studentName}
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    {studentEmail}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-600"
              >
                <FaSignOutAlt />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="w-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default StudentLayout;