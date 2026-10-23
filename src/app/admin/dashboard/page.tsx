 "use client";

import dynamic from "next/dynamic";
import {
  Activity,
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
  database?: DatabaseUsage;
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
  { key: "certificates", label: "Certificates", icon: CheckCircle2 },
  { key: "questions", label: "Questions", icon: FileCheck2 },
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

function numberValue(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function formatNumber(value: unknown): string {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) return "—";

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(count);
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function formatBytes(value: unknown): string {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{formatNumber(value)}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </button>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2.5 sm:p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className="mt-1 break-words text-sm font-extrabold leading-5 text-slate-900 sm:text-base"
        title={value}
      >
        {value}
      </p>
    </div>
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
  const abortRef = useRef<AbortController | null>(null);

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

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || `Dashboard request failed (${response.status}).`);
      }

      if (!data) throw new Error("Dashboard API returned an invalid response.");

      if (data.admin) setAdmin(data.admin);
      if (data.stats) setStats((current) => ({ ...current, ...data.stats }));
      if (data.database) setDatabase(data.database);
      setOnline(Boolean(data.database?.connected));
      setLastUpdated(new Date().toISOString());
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      console.error("[ADMIN DASHBOARD]", requestError);
      setOnline(false);
      setError(requestError instanceof Error ? requestError.message : "Dashboard synchronization failed.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadDashboard(false);
    }, REFRESH_MS);

    return () => {
      window.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [loadDashboard]);

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
    return query ? NAV.filter((item) => item.label.toLowerCase().includes(query)) : [];
  }, [search]);

  const adminName = admin.fullName?.trim() || "CyberNet Admin";
  const adminRole = admin.role || admin.designation || "Administrator";
  const ActiveModule = activeModule === "dashboard" ? null : MODULES[activeModule];
  const activeRate = stats.students > 0
    ? Math.min(100, Math.round((stats.activeStudents / stats.students) * 100))
    : 0;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-all duration-200",
          collapsed ? "lg:w-[82px]" : "lg:w-[260px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-[72px] items-center border-b border-slate-100 px-4">
          <button
            type="button"
            onClick={() => openModule("dashboard")}
            className={`flex min-w-0 items-center ${collapsed ? "mx-auto" : "gap-3"}`}
            aria-label="CyberNet dashboard"
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md">
              <ShieldCheck className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            {!collapsed && (
              <span className="text-left">
                <span className="block text-base font-black text-slate-950">CyberNet</span>
                <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">Careers Admin</span>
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="ml-auto hidden rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 lg:block"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          {!collapsed && <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Workspace</p>}
          <nav className="space-y-1" aria-label="Admin sections">
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
                    "group relative flex w-full items-center rounded-xl px-3 py-3 transition focus:outline-none focus:ring-4 focus:ring-blue-100",
                    collapsed ? "justify-center" : "gap-3",
                    active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  ].join(" ")}
                >
                  {active && <span className="absolute left-0 top-2.5 h-7 w-1 rounded-r-full bg-blue-600" />}
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} />
                  {!collapsed && <span className="text-sm font-semibold">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className={`flex items-center rounded-xl bg-slate-50 p-2 ${collapsed ? "justify-center" : "gap-3"}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">{initials(adminName)}</span>
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
                  className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600 disabled:opacity-50"
                >
                  {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
          {collapsed && (
            <button type="button" onClick={() => void logout()} disabled={loggingOut} className="mt-2 flex w-full justify-center rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Log out">
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </button>
          )}
        </div>
      </aside>

      <main className={`min-h-screen transition-[margin] duration-200 ${collapsed ? "lg:ml-[82px]" : "lg:ml-[260px]"}`}>
        <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden w-full max-w-lg md:block">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find an admin section..."
              aria-label="Find an admin section"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
            {search && (
              <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {searchResults.length > 0 ? searchResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={() => openModule(item.key)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-blue-50">
                      <Icon className="h-4 w-4 text-blue-600" />{item.label}
                    </button>
                  );
                }) : <p className="px-3 py-2.5 text-sm text-slate-500">No matching section.</p>}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold sm:flex ${online ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}`}>
              <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`} />
              {online ? "CONNECTED" : "CHECK CONNECTION"}
            </span>
            <button type="button" onClick={() => void loadDashboard(false)} disabled={refreshing} aria-label="Refresh dashboard data" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-[10px] font-black text-white">{initials(adminName)}</span>
              <div className="hidden max-w-[160px] lg:block">
                <p className="truncate text-xs font-bold">{adminName}</p>
                <p className="truncate text-[10px] text-slate-500">{adminRole}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {activeModule !== "dashboard" && ActiveModule ? (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">Admin workspace</p>
                  <h1 className="mt-1 text-2xl font-black text-slate-950">{NAV.find((item) => item.key === activeModule)?.label}</h1>
                </div>
                <button type="button" onClick={() => openModule("dashboard")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Back to dashboard</button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"><ActiveModule /></div>
            </section>
          ) : (
            <section className="space-y-5">
              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-7">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    <Activity className="h-3.5 w-3.5" /> Main Admin Overview
                  </div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    {getGreeting()}, <span className="text-blue-600">{adminName.split(/\s+/)[0]}</span>
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">Essential operational metrics and live database health.</p>
                  <p className="mt-1 text-xs text-slate-400">{lastUpdated ? `Last synchronized: ${new Date(lastUpdated).toLocaleTimeString("en-IN")}` : "Waiting for first synchronization"}</p>
                </div>

                <div className="w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white sm:max-w-[460px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-cyan-300" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300">Live MongoDB status</span>
                    </div>
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold ${database.connected ? "text-emerald-300" : "text-rose-300"}`}>
                      <span className={`h-2 w-2 rounded-full ${database.connected ? "bg-emerald-400" : "bg-rose-400"}`} />
                      {database.connected ? "ONLINE" : "OFFLINE"}
                    </span>
                  </div>
                  <p className="mt-3 break-words text-3xl font-black tabular-nums">
                    {formatBytes(database.totalSizeBytes)}
                  </p>
                  <p
                    className="mt-1 break-words text-xs text-slate-400"
                    title={database.databaseName || "Database name unavailable"}
                  >
                    {database.databaseName || "Database name unavailable"} · data + indexes
                  </p>
                  <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                    <InfoTile label="Data" value={formatBytes(database.dataSizeBytes)} />
                    <InfoTile label="Indexes" value={formatBytes(database.indexSizeBytes)} />
                    <InfoTile label="Collections" value={formatNumber(database.collections)} />
                    <InfoTile label="Objects" value={formatNumber(database.objects)} />
                  </div>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center">
                  <p>{error}</p>
                  <button type="button" onClick={() => void loadDashboard(false)} className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold hover:bg-rose-100">Retry connection</button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total Students" value={stats.students} detail={`${formatNumber(stats.activeStudents)} active`} icon={Users} onClick={() => openModule("students")} />
                <MetricCard label="Applications" value={stats.applications} detail={`${formatNumber(stats.pendingApplications)} awaiting review`} icon={FileCheck2} onClick={() => openModule("applications")} />
                <MetricCard label="Assessments" value={stats.assessments} detail={`${formatNumber(stats.assessmentPending)} pending`} icon={ClipboardCheck} onClick={() => openModule("assessments")} />
                <MetricCard label="Internships" value={stats.internships} detail={`${formatNumber(stats.activeInternships)} active`} icon={BriefcaseBusiness} onClick={() => openModule("internships")} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Action queue</p>
                      <h2 className="mt-1 text-xl font-black">Needs attention</h2>
                      <p className="mt-1 text-sm text-slate-500">Open the relevant module to review pending work.</p>
                    </div>
                    <ClipboardCheck className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => openModule("applications")} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50">
                      <p className="text-sm font-semibold text-slate-700">Pending applications</p>
                      <p className="mt-2 text-2xl font-black">{formatNumber(stats.pendingApplications)}</p>
                    </button>
                    <button type="button" onClick={() => openModule("assessments")} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50">
                      <p className="text-sm font-semibold text-slate-700">Pending assessments</p>
                      <p className="mt-2 text-2xl font-black">{formatNumber(stats.assessmentPending)}</p>
                    </button>
                    <button type="button" onClick={() => openModule("payments")} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50">
                      <p className="text-sm font-semibold text-slate-700">Payment approvals</p>
                      <p className="mt-2 text-2xl font-black">{formatNumber(stats.paymentApprovalPending)}</p>
                    </button>
                    <button type="button" onClick={() => openModule("students")} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50">
                      <p className="text-sm font-semibold text-slate-700">Plans expiring in 3 days</p>
                      <p className="mt-2 text-2xl font-black">{formatNumber(stats.expiringWithin3Days)}</p>
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Payment summary</p>
                      <h2 className="mt-1 text-xl font-black">Recorded revenue</h2>
                      <p className="mt-1 text-sm text-slate-500">Based on the totals returned by the dashboard API.</p>
                    </div>
                    <CreditCard className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="mt-5 text-3xl font-black tracking-tight">{formatMoney(stats.revenue)}</p>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <InfoTile label="Paid" value={formatNumber(stats.paymentPaid)} />
                    <InfoTile label="Pending" value={formatNumber(stats.paymentPending)} />
                    <InfoTile label="Failed" value={formatNumber(stats.paymentFailed)} />
                  </div>
                  <button type="button" onClick={() => openModule("payments")} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900">
                    Open payments <ArrowRight className="h-4 w-4" />
                  </button>
                </section>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">System health</p>
                    <h2 className="mt-1 text-xl font-black">Essential status</h2>
                  </div>
                  <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${database.connected && online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    <span className={`h-2 w-2 rounded-full ${database.connected && online ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {database.connected && online ? "Dashboard API and database connected" : "Connection needs verification"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoTile label="Active students" value={formatNumber(stats.activeStudents)} />
                  <InfoTile label="Recently active" value={formatNumber(stats.recentlyActiveStudents)} />
                  <InfoTile label="Expired plans" value={formatNumber(stats.expiredStudents)} />
                  <InfoTile label="Certificates issued" value={formatNumber(stats.certificates)} />
                </div>
              </section>

              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-slate-500" role="status">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading live dashboard data…
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
