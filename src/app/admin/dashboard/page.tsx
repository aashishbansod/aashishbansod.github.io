 "use client";

import dynamic from "next/dynamic";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Database,
  FileCheck2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
  AlertTriangle,
  Clock3,
  Server,
  CircleDollarSign,
  GraduationCap,
  Award,
  CalendarClock,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";

const ApplicationsModule = dynamic(() => import("../applications/page"), { ssr: false });
const StudentsModule = dynamic(() => import("../students/page"), { ssr: false });
const InternshipsModule = dynamic(() => import("../internships/page"), { ssr: false });
const AssessmentsModule = dynamic(() => import("../assessments/page"), { ssr: false });
const PaymentsModule = dynamic(() => import("../payments/page"), { ssr: false });
const CertificatesModule = dynamic(() => import("../certificates/page"), { ssr: false });
const QuestionsModule = dynamic(() => import("../questions/page"), { ssr: false });
const AnalyticsModule = dynamic(() => import("../analytics/page"), { ssr: false });
const SettingsModule = dynamic(() => import("../settings/page"), { ssr: false });

const DASHBOARD_API = "/api/admin/dashboard";
const LOGOUT_API = "/api/auth/logout";
const REFRESH_MS = 30_000;

type ModuleKey =
  | "dashboard"
  | "applications"
  | "students"
  | "internships"
  | "assessments"
  | "payments"
  | "certificates"
  | "questions"
  | "analytics"
  | "settings";

type Admin = {
  fullName?: string;
  email?: string;
  role?: string;
  designation?: string;
};

type DatabaseUsage = {
  connected: boolean;
  databaseName: string;
  dataSizeBytes: number;
  storageSizeBytes: number;
  indexSizeBytes: number;
  totalSizeBytes: number;
  collections: number;
  objects: number;
  refreshedAt: string;
};

type Stats = {
  students: number;
  applications: number;
  assessments: number;
  internships: number;
  pendingApplications: number;
  assessmentPending: number;
  payments: number;
  paymentPending: number;
  paymentPaid: number;
  paymentFailed: number;
  paymentApprovalPending: number;
  activeStudents: number;
  expiredStudents: number;
  recentlyActiveStudents: number;
  expiringWithin3Days: number;
  certificates: number;
  revenue: number;
  activeInternships: number;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  admin?: Admin;
  stats?: Partial<Stats>;
  database?: Partial<DatabaseUsage>;
};

type NavItem = {
  key: ModuleKey;
  label: string;
  icon: typeof LayoutDashboard;
};

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "applications", label: "Applications", icon: FileCheck2 },
  { key: "students", label: "Students", icon: Users },
  { key: "internships", label: "Internships", icon: BriefcaseBusiness },
  { key: "assessments", label: "Assessments", icon: ClipboardCheck },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "certificates", label: "Certificates", icon: Award },
  { key: "questions", label: "Questions", icon: GraduationCap },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
];

const MODULES: Record<Exclude<ModuleKey, "dashboard">, ComponentType> = {
  applications: ApplicationsModule,
  students: StudentsModule,
  internships: InternshipsModule,
  assessments: AssessmentsModule,
  payments: PaymentsModule,
  certificates: CertificatesModule,
  questions: QuestionsModule,
  analytics: AnalyticsModule,
  settings: SettingsModule,
};

const EMPTY_STATS: Stats = {
  students: 0,
  applications: 0,
  assessments: 0,
  internships: 0,
  pendingApplications: 0,
  assessmentPending: 0,
  payments: 0,
  paymentPending: 0,
  paymentPaid: 0,
  paymentFailed: 0,
  paymentApprovalPending: 0,
  activeStudents: 0,
  expiredStudents: 0,
  recentlyActiveStudents: 0,
  expiringWithin3Days: 0,
  certificates: 0,
  revenue: 0,
  activeInternships: 0,
};

const EMPTY_DB: DatabaseUsage = {
  connected: false,
  databaseName: "",
  dataSizeBytes: 0,
  storageSizeBytes: 0,
  indexSizeBytes: 0,
  totalSizeBytes: 0,
  collections: 0,
  objects: 0,
  refreshedAt: "",
};

function safeNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatNumber(value: unknown): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatBytes(value: unknown): string {
  const bytes = safeNumber(value);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function safeDateLabel(value: string): string {
  if (!value) return "Not synchronized yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
  accent = "blue",
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
  onClick: () => void;
  accent?: "blue" | "violet" | "cyan" | "amber";
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    violet: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    cyan: "bg-cyan-50 text-cyan-700 group-hover:bg-cyan-600 group-hover:text-white",
    amber: "bg-amber-50 text-amber-700 group-hover:bg-amber-500 group-hover:text-white",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-4 focus:ring-blue-100"
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${accents[accent]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
      </div>
      <p className="mt-5 text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-[30px] font-black tracking-tight text-slate-950 tabular-nums">
        {formatNumber(value)}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-400">{detail}</p>
    </button>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/90 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-extrabold leading-5 text-slate-900" title={value}>
        {value}
      </p>
    </div>
  );
}

function QueueItem({
  label,
  value,
  description,
  icon: Icon,
  onClick,
  tone = "blue",
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof ClipboardCheck;
  onClick: () => void;
  tone?: "blue" | "amber" | "violet" | "rose";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-white p-3.5 text-left transition hover:border-blue-200 hover:bg-blue-50/50 focus:outline-none focus:ring-4 focus:ring-blue-100"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
      </span>
      <span className="text-lg font-black tabular-nums text-slate-950">{formatNumber(value)}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  );
}

export default function AdminDashboardPage() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState<Admin>({});
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [database, setDatabase] = useState<DatabaseUsage>(EMPTY_DB);
  const [lastUpdated, setLastUpdated] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const abortRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const openModule = useCallback((module: ModuleKey) => {
    setActiveModule(module);
    setSidebarOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const loadDashboard = useCallback(async (initial = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++requestSequence.current;

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const response = await fetch(DASHBOARD_API, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as ApiResponse | null;

      if (response.status === 401 || response.status === 403) {
        window.location.replace("/login");
        return;
      }

      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || `Dashboard request failed (${response.status}).`);
      }

      if (!data || typeof data !== "object") {
        throw new Error("Dashboard API returned an invalid response.");
      }

      if (sequence !== requestSequence.current || controller.signal.aborted) return;

      if (data.admin && typeof data.admin === "object") setAdmin(data.admin);
      if (data.stats && typeof data.stats === "object") {
        setStats((current) => {
          const next = { ...current };
          (Object.keys(EMPTY_STATS) as (keyof Stats)[]).forEach((key) => {
            const value = data.stats?.[key];
            if (value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0) {
              next[key] = Number(value);
            }
          });
          return next;
        });
      }

      if (data.database && typeof data.database === "object") {
        setDatabase((current) => ({
          ...current,
          ...data.database,
          connected: Boolean(data.database?.connected),
          databaseName: typeof data.database?.databaseName === "string" ? data.database.databaseName : current.databaseName,
        }));
        setOnline(Boolean(data.database.connected));
      } else {
        setOnline(false);
      }

      setLastUpdated(new Date().toISOString());
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      if (sequence !== requestSequence.current) return;
      console.error("[ADMIN DASHBOARD]", requestError);
      setOnline(false);
      setError(requestError instanceof Error ? requestError.message : "Dashboard synchronization failed.");
    } finally {
      if (sequence === requestSequence.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard(true);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadDashboard(false);
    }, REFRESH_MS);
    const clockTimer = window.setInterval(() => setClock(new Date()), 60_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadDashboard(false);
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      abortRef.current?.abort();
    };
  }, [loadDashboard]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearch("");
        setSidebarOpen(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch(LOGOUT_API, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch (logoutError) {
      console.error("[ADMIN LOGOUT]", logoutError);
    } finally {
      window.location.replace("/login");
    }
  }, [loggingOut]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return NAV.filter((item) => item.label.toLowerCase().includes(query));
  }, [search]);

  const adminName = admin.fullName?.trim() || "CyberNet Admin";
  const adminRole = admin.role || admin.designation || "Administrator";
  const ActiveModule = activeModule === "dashboard" ? null : MODULES[activeModule];
  const activeRate = stats.students > 0
    ? Math.min(100, Math.round((stats.activeStudents / stats.students) * 100))
    : 0;
  const hasPendingWork =
    stats.pendingApplications +
    stats.assessmentPending +
    stats.paymentApprovalPending +
    stats.expiringWithin3Days > 0;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f8fc] text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-slate-200/80 bg-white transition-all duration-200",
          collapsed ? "lg:w-[84px]" : "lg:w-[270px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-[76px] shrink-0 items-center border-b border-slate-100 px-4">
          <button
            type="button"
            onClick={() => openModule("dashboard")}
            className={`flex min-w-0 items-center ${collapsed ? "mx-auto" : "gap-3"}`}
            aria-label="CyberNet dashboard"
          >
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20">
              <ShieldCheck className="h-6 w-6" />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-[3px] border-white bg-emerald-500" />
            </span>
            {!collapsed && (
              <span className="text-left">
                <span className="block text-[17px] font-black tracking-tight text-slate-950">CyberNet</span>
                <span className="block text-[9px] font-black uppercase tracking-[0.22em] text-blue-600">Careers Admin</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="ml-auto hidden rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 lg:block"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          {!collapsed && (
            <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
              Workspace
            </p>
          )}
          <nav className="space-y-1.5" aria-label="Admin sections">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => openModule(item.key)}
                  className={[
                    "group relative flex min-h-12 w-full items-center rounded-xl px-3 transition focus:outline-none focus:ring-4 focus:ring-blue-100",
                    collapsed ? "justify-center" : "gap-3",
                    active
                      ? "bg-blue-50 font-bold text-blue-700 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.06)]"
                      : "font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  ].join(" ")}
                >
                  {active && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-blue-600" />}
                  <Icon className={`h-[19px] w-[19px] shrink-0 ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                  {!collapsed && <span className="text-[13px]">{item.label}</span>}
                  {!collapsed && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className={`flex items-center rounded-2xl bg-slate-50 p-2 ${collapsed ? "justify-center" : "gap-3"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
              {initials(adminName)}
            </span>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">{adminName}</p>
                  <p className="truncate text-[10px] text-slate-500">{adminRole}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  disabled={loggingOut}
                  aria-label="Log out"
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-rose-600 disabled:opacity-50"
                >
                  {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
          {collapsed && (
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="mt-2 flex w-full justify-center rounded-xl p-2.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              aria-label="Log out"
            >
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </button>
          )}
        </div>
      </aside>

      <main className={`min-h-screen transition-[margin] duration-200 ${collapsed ? "lg:ml-[84px]" : "lg:ml-[270px]"}`}>
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden w-full max-w-xl md:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) openModule(searchResults[0].key);
              }}
              placeholder="Search admin sections..."
              aria-label="Search admin sections"
              aria-expanded={Boolean(search)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-10 pr-20 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 lg:inline-flex">
                Ctrl K
              </span>
            )}
            {search && (
              <div className="absolute left-0 right-0 top-[52px] z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                {searchResults.length ? searchResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openModule(item.key)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Icon className="h-4 w-4 text-blue-600" />
                      {item.label}
                      <ArrowRight className="ml-auto h-4 w-4 text-slate-300" />
                    </button>
                  );
                }) : (
                  <p className="px-3 py-4 text-sm text-slate-500">No matching section found.</p>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-extrabold tracking-wide sm:flex ${online ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>
              <span className={`h-2 w-2 rounded-full ${online ? "animate-pulse bg-emerald-500" : "bg-rose-500"}`} />
              {online ? "CONNECTED" : "DISCONNECTED"}
            </div>
            <button
              type="button"
              onClick={() => void loadDashboard(false)}
              disabled={refreshing}
              aria-label="Refresh dashboard data"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <div className="hidden items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 sm:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-[10px] font-black text-white">
                {initials(adminName)}
              </span>
              <div className="hidden max-w-[150px] lg:block">
                <p className="truncate text-xs font-bold text-slate-800">{adminName}</p>
                <p className="truncate text-[10px] text-slate-500">{adminRole}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {activeModule !== "dashboard" && ActiveModule ? (
            <section>
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-600">Admin workspace</p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                    {NAV.find((item) => item.key === activeModule)?.label}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => openModule("dashboard")}
                  className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Back to dashboard
                </button>
              </div>
              <div className="min-h-[500px] rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
                <ActiveModule />
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)] sm:p-7 lg:p-8">
                <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
                <div className="pointer-events-none absolute right-48 top-20 h-40 w-40 rounded-full bg-cyan-100/50 blur-3xl" />
                <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-center">
                  <div className="min-w-0">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
                      <Activity className="h-3.5 w-3.5" />
                      Main admin overview
                    </div>
                    <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-black leading-[1.08] tracking-tight text-slate-950">
                      {greeting()},
                      <span className="block text-blue-600">{adminName.split(/\s+/)[0]}</span>
                    </h1>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
                      Your CyberNet Careers operations at a glance. Monitor student activity, applications, assessments and payments from one workspace.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        {clock.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4" />
                        {clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-slate-300">Last sync: {safeDateLabel(lastUpdated)}</span>
                    </div>
                  </div>

                  <div className="relative min-w-0 overflow-hidden rounded-[22px] bg-[#071329] p-5 text-white shadow-xl shadow-blue-950/10 sm:p-6">
                    <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full border-[28px] border-blue-500/10" />
                    <div className="relative">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-cyan-300" />
                          <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-cyan-200">Main MongoDB status</span>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold ${database.connected ? "text-emerald-300" : "text-rose-300"}`}>
                          <span className={`h-2 w-2 rounded-full ${database.connected ? "bg-emerald-400" : "bg-rose-400"}`} />
                          {database.connected ? "ONLINE" : "OFFLINE"}
                        </span>
                      </div>
                      <p className="mt-5 break-words text-4xl font-black tracking-tight tabular-nums">
                        {formatBytes(database.totalSizeBytes)}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-400" title={database.databaseName || "Database name unavailable"}>
                        {database.databaseName || "Database name unavailable"} · data + indexes
                      </p>
                      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <InfoTile label="Data" value={formatBytes(database.dataSizeBytes)} />
                        <InfoTile label="Indexes" value={formatBytes(database.indexSizeBytes)} />
                        <InfoTile label="Collections" value={formatNumber(database.collections)} />
                        <InfoTile label="Objects" value={formatNumber(database.objects)} />
                      </div>
                      <p className="mt-3 text-[10px] text-slate-500">
                        Database metrics last refreshed: {safeDateLabel(database.refreshedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadDashboard(false)}
                    className="shrink-0 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold transition hover:bg-rose-100"
                  >
                    Retry connection
                  </button>
                </div>
              )}

              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading dashboard" role="status">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-[174px] animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="h-11 w-11 rounded-2xl bg-slate-100" />
                      <div className="mt-5 h-3 w-28 rounded bg-slate-100" />
                      <div className="mt-3 h-8 w-20 rounded bg-slate-100" />
                      <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Total students" value={stats.students} detail={`${formatNumber(stats.activeStudents)} currently active`} icon={Users} onClick={() => openModule("students")} accent="blue" />
                  <MetricCard label="Applications" value={stats.applications} detail={`${formatNumber(stats.pendingApplications)} awaiting review`} icon={FileCheck2} onClick={() => openModule("applications")} accent="violet" />
                  <MetricCard label="Assessments" value={stats.assessments} detail={`${formatNumber(stats.assessmentPending)} pending review`} icon={ClipboardCheck} onClick={() => openModule("assessments")} accent="cyan" />
                  <MetricCard label="Internships" value={stats.internships} detail={`${formatNumber(stats.activeInternships)} active internships`} icon={BriefcaseBusiness} onClick={() => openModule("internships")} accent="amber" />
                </div>
              )}

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
                <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] sm:p-6">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">Action center</p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Needs your attention</h2>
                      <p className="mt-1 text-sm text-slate-500">Review pending operations and time-sensitive student activity.</p>
                    </div>
                    <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold ${hasPendingWork ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${hasPendingWork ? "bg-amber-500" : "bg-emerald-500"}`} />
                      {hasPendingWork ? "ACTION REQUIRED" : "ALL CLEAR"}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <QueueItem label="Pending applications" value={stats.pendingApplications} description="Applications awaiting review" icon={FileCheck2} onClick={() => openModule("applications")} tone="blue" />
                    <QueueItem label="Pending assessments" value={stats.assessmentPending} description="Assessment reviews pending" icon={ClipboardCheck} onClick={() => openModule("assessments")} tone="violet" />
                    <QueueItem label="Payment approvals" value={stats.paymentApprovalPending} description="Payment workflow needs review" icon={CreditCard} onClick={() => openModule("payments")} tone="amber" />
                    <QueueItem label="Expiring in 3 days" value={stats.expiringWithin3Days} description="Student plans nearing expiry" icon={CalendarClock} onClick={() => openModule("students")} tone="rose" />
                  </div>
                </section>

                <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">Payment summary</p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Recorded revenue</h2>
                      <p className="mt-1 text-sm text-slate-500">Totals reported by the admin dashboard API.</p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <CircleDollarSign className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="mt-6 text-3xl font-black tracking-tight text-slate-950 tabular-nums">{formatMoney(stats.revenue)}</p>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <InfoTile label="Paid" value={formatNumber(stats.paymentPaid)} />
                    <InfoTile label="Pending" value={formatNumber(stats.paymentPending)} />
                    <InfoTile label="Failed" value={formatNumber(stats.paymentFailed)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => openModule("payments")}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:gap-3 hover:text-blue-900"
                  >
                    Open payment management <ArrowRight className="h-4 w-4" />
                  </button>
                </section>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">Student overview</p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Student engagement</h2>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div
                      className="relative mx-auto flex h-36 w-36 shrink-0 items-center justify-center rounded-full sm:mx-0"
                      style={{ background: `conic-gradient(#2563eb ${activeRate * 3.6}deg, #e8eef7 0deg)` }}
                      role="img"
                      aria-label={`${activeRate}% of students are active`}
                    >
                      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
                        <span className="text-3xl font-black tracking-tight text-slate-950">{activeRate}%</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active</span>
                      </div>
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-3">
                      <InfoTile label="Total students" value={formatNumber(stats.students)} />
                      <InfoTile label="Active students" value={formatNumber(stats.activeStudents)} />
                      <InfoTile label="Recently active" value={formatNumber(stats.recentlyActiveStudents)} />
                      <InfoTile label="Expired plans" value={formatNumber(stats.expiredStudents)} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModule("students")}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:gap-3 hover:text-blue-900"
                  >
                    View students <ArrowRight className="h-4 w-4" />
                  </button>
                </section>

                <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.03)] sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">Platform health</p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">System overview</h2>
                      <p className="mt-1 text-sm text-slate-500">Current status from the dashboard service.</p>
                    </div>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${online ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                      <Server className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Database className="h-4 w-4 text-slate-400" />
                        Main database
                      </span>
                      <span className={`text-xs font-extrabold ${database.connected ? "text-emerald-600" : "text-rose-600"}`}>
                        {database.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Activity className="h-4 w-4 text-slate-400" />
                        Dashboard API
                      </span>
                      <span className={`text-xs font-extrabold ${online ? "text-emerald-600" : "text-rose-600"}`}>
                        {online ? "Responding" : "Unavailable"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Award className="h-4 w-4 text-slate-400" />
                        Certificates issued
                      </span>
                      <span className="text-sm font-black tabular-nums text-slate-950">{formatNumber(stats.certificates)}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="text-[11px] text-slate-400">Automatic refresh every 30 seconds</span>
                    <button
                      type="button"
                      onClick={() => void loadDashboard(false)}
                      disabled={refreshing}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      Refresh now
                    </button>
                  </div>
                </section>
              </div>

              <footer className="flex flex-col justify-between gap-2 px-1 pb-3 text-[11px] text-slate-400 sm:flex-row sm:items-center">
                <span>CyberNet Careers Admin · Secure operations workspace</span>
                <span className="inline-flex items-center gap-1.5">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  Live operational data supplied by your dashboard API
                </span>
              </footer>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
