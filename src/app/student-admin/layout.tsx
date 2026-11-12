"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Code2,
  CreditCard,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
  RefreshCw,
  UserPlus,
} from "lucide-react";

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
  keywords: string;
};

type Viewer = {
  identifier?: string;
  role?: string;
};

const NAVIGATION: NavigationItem[] = [
  { label: "Dashboard", href: "/student-admin/dashboard", icon: LayoutDashboard, description: "Operations overview", keywords: "home overview stats" },
  { label: "Students", href: "/student-admin/students", icon: Users, description: "Student directory and records", keywords: "learners directory active failed" },
  { label: "Applications", href: "/student-admin/applications", icon: FileText, description: "Review student applications", keywords: "apply admission review" },
  { label: "Assessments", href: "/student-admin/assessments", icon: ClipboardCheck, description: "Assessment operations", keywords: "tests exams mcq results" },
  { label: "Internships", href: "/student-admin/internships", icon: BriefcaseBusiness, description: "Internship enrollment and tracking", keywords: "training domain placement" },
  { label: "Payments", href: "/student-admin/payments", icon: CreditCard, description: "Payment records and status", keywords: "fees transactions receipts" },
  { label: "Certificates", href: "/student-admin/certificates", icon: Award, description: "Certificate verification and issue status", keywords: "credential verify award" },
  { label: "Coding", href: "/student-admin/coding", icon: Code2, description: "Coding tasks and submissions", keywords: "programming code challenge" },
  { label: "Placement", href: "/student-admin/placement", icon: GraduationCap, description: "Placement coordination", keywords: "career job hiring" },
  { label: "Projects", href: "/student-admin/projects", icon: FolderKanban, description: "Student project workspace", keywords: "portfolio files work" },
  { label: "Registration", href: "/student-admin/register", icon: UserPlus, description: "Student registration workflow", keywords: "enroll onboarding" },
  { label: "Tasks", href: "/student-admin/tasks", icon: CalendarCheck, description: "Tasks and operational follow-ups", keywords: "todo activity schedule" },
  { label: "Reports", href: "/student-admin/reports", icon: BarChart3, description: "Operational reports", keywords: "analytics export" },
  { label: "Settings", href: "/student-admin/settings", icon: Settings, description: "Workspace preferences", keywords: "configuration account" },
];

const LOGOUT_ENDPOINT = "/api/auth/logout";

function getPageTitle(pathname: string): string {
  const exact = NAVIGATION.find((item) => item.href === pathname);
  if (exact) return exact.label;
  const matched = NAVIGATION.filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (matched) return matched.label;
  return "Student Operations";
}

function getInitials(value: string): string {
  const parts = value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "SA";
}

export default function StudentAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [clock, setClock] = useState("");
  const [viewerLoading, setViewerLoading] = useState(true);

  const pageTitle = getPageTitle(pathname);
  const initials = getInitials(viewer?.identifier || "Student Admin");

  const filteredNavigation = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return NAVIGATION;
    return NAVIGATION.filter((item) =>
      `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(query),
    );
  }, [search]);

  const closeMobileSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    let active = true;
    const loadViewer = async () => {
      try {
        const response = await fetch("/api/student-admin/dashboard?page=1&limit=1", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (response.status === 401 || response.status === 403) {
          router.replace("/login?mode=student-admin&next=%2Fstudent-admin%2Fdashboard");
          return;
        }
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!result || typeof result !== "object") return;
        const data = (result as { data?: { viewer?: Viewer } }).data;
        if (active && data?.viewer) setViewer(data.viewer);
      } catch {
        if (active) setViewer(null);
      } finally {
        if (active) setViewerLoading(false);
      }
    };
    void loadViewer();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const updateClock = () => {
      setClock(new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
    setLogoutError("");
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    const confirmed = window.confirm("Are you sure you want to log out of Student Operations?");
    if (!confirmed) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch(LOGOUT_ENDPOINT, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(result?.message || `Logout failed (${response.status}).`);
      }
      router.replace("/login?mode=student-admin");
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const sidebarWidth = sidebarCollapsed ? "lg:w-[84px]" : "lg:w-[268px]";
  const contentOffset = sidebarCollapsed ? "lg:pl-[84px]" : "lg:pl-[268px]";

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-800">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-slate-200 bg-white shadow-xl shadow-slate-900/5 transition-all duration-300 ${sidebarWidth} ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-[78px] shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <Link href="/student-admin/dashboard" className="flex min-w-0 items-center gap-3" aria-label="CyberNet Student Operations home">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20">
              <ShieldCheck size={23} />
            </span>
            {!sidebarCollapsed && (
              <span className="min-w-0">
                <span className="block text-[15px] font-black tracking-tight text-slate-950">CyberNet</span>
                <span className="mt-0.5 block text-[9px] font-extrabold tracking-[0.19em] text-blue-600">STUDENT OPERATIONS</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
            <X size={18} />
          </button>
          <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:inline-flex">
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="px-4 pt-4">
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-3.5 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-extrabold text-blue-900">Operations Workspace</span>
              </div>
              <p className="mt-1 pl-[18px] text-[10px] text-blue-700/70">Authorized administration portal</p>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-6 [scrollbar-width:thin]">
          {!sidebarCollapsed && (
            <div className="mb-3 flex items-center justify-between px-3">
              <span className="text-[9px] font-black tracking-[0.2em] text-slate-400">WORKSPACE</span>
              <span className="text-[9px] font-semibold text-slate-300">{NAVIGATION.length} MODULES</span>
            </div>
          )}
          <nav aria-label="Student Admin navigation" className="space-y-1">
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={closeMobileSidebar}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[12px] font-semibold transition-all ${sidebarCollapsed ? "justify-center" : ""} ${active ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
                >
                  <Icon size={18} className={`shrink-0 ${active ? "text-white" : "text-slate-400 group-hover:text-blue-600"}`} />
                  {!sidebarCollapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                  {!sidebarCollapsed && active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </Link>
              );
            })}
          </nav>
          {!sidebarCollapsed && (
            <div className="mt-7 border-t border-slate-100 pt-5">
              <p className="mb-2 px-3 text-[9px] font-black tracking-[0.2em] text-slate-400">SUPPORT</p>
              <a href="mailto:support@cncareers.me" className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                <CircleHelp size={17} className="text-slate-400" />
                Help & Support
              </a>
              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600"><ShieldCheck size={14} className="text-emerald-600" /> Secure workspace</div>
                <p className="mt-1 text-[9px] leading-4 text-slate-400">Access is limited by your Student Operations Admin session.</p>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className={`flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 ${sidebarCollapsed ? "justify-center" : ""}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white">{initials}</span>
            {!sidebarCollapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-slate-900">{viewer?.identifier || "Student Admin"}</span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500">{viewer?.role || "Student Operations Admin"}</span>
              </span>
            )}
            {!sidebarCollapsed && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
          </div>
          {!sidebarCollapsed && (
            <button type="button" onClick={handleLogout} disabled={loggingOut} className="mt-2 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">
              {loggingOut ? <RefreshCw size={16} className="animate-spin" /> : <LogOut size={16} />}
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          )}
        </div>
      </aside>

      <div className={`min-h-screen min-w-0 transition-[padding] duration-300 ${contentOffset}`}>
        <header className="sticky top-0 z-30 flex h-[78px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden">
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <p className="hidden text-[9px] font-bold uppercase tracking-[0.17em] text-slate-400 sm:block">Student Operations / Workspace</p>
              <h1 className="truncate text-base font-black tracking-tight text-slate-950 sm:mt-0.5 sm:text-lg">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setSearchOpen(true)} className="hidden h-10 w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-400 transition hover:border-blue-200 hover:bg-white md:flex xl:w-[290px]">
              <Search size={16} />
              <span className="flex-1">Search admin sections...</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold">Ctrl K</kbd>
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-extrabold tracking-wide text-emerald-700">SESSION ACTIVE</span>
            </div>
            <div className="hidden items-center gap-1.5 text-[10px] font-medium text-slate-400 xl:flex"><Activity size={14} /> {clock}</div>
            <button type="button" aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50">
              <Bell size={17} />
            </button>
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 transition hover:bg-slate-50 sm:gap-3 sm:px-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">{initials}</span>
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-[125px] truncate text-[10px] font-bold text-slate-900">{viewerLoading ? "Loading account..." : viewer?.identifier || "Student Admin"}</span>
                  <span className="block text-[9px] text-slate-500">Operations Admin</span>
                </span>
                <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
              </button>
              {profileOpen && (
                <>
                  <button type="button" aria-label="Close profile menu" onClick={() => setProfileOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                    <div className="border-b border-slate-100 px-3 py-3">
                      <p className="truncate text-xs font-bold text-slate-900">{viewer?.identifier || "Student Admin"}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{viewer?.role || "Student Operations Admin"}</p>
                    </div>
                    <Link href="/student-admin/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><UserRound size={15} /> Account settings</Link>
                    <button type="button" onClick={handleLogout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><LogOut size={15} /> {loggingOut ? "Signing out..." : "Logout"}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {logoutError && (
          <div role="alert" className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 sm:mx-6 xl:mx-8">
            <span>{logoutError}</span>
            <button type="button" onClick={() => setLogoutError("")} aria-label="Dismiss logout error"><X size={15} /></button>
          </div>
        )}

        <main id="student-admin-main" className="mx-auto min-h-[calc(100vh-78px)] w-full max-w-[1800px] min-w-0 p-4 sm:p-6 xl:p-8">
          {children}
        </main>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/40 px-4 pt-[14vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Search dashboard sections" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Search size={18} className="text-slate-400" />
              <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dashboard sections..." className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              <button type="button" onClick={() => { setSearchOpen(false); setSearch(""); }} aria-label="Close search" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {filteredNavigation.length ? filteredNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => { setSearchOpen(false); setSearch(""); }} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-blue-50">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon size={17} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800">{item.label}</span><span className="mt-0.5 block text-[10px] text-slate-400">{item.description}</span></span>
                    <ChevronRight size={15} className="text-slate-300" />
                  </Link>
                );
              }) : <p className="px-4 py-10 text-center text-xs text-slate-400">No matching sections found.</p>}
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5 text-[9px] text-slate-400">Navigate to a section · Press Esc to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
