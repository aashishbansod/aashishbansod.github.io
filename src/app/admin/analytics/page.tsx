"use client";

import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";

type MainStats = {
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
  approvedApplications: number;
  rejectedApplications: number;
  passedAssessments: number;
  failedAssessments: number;
};

type OperationsStats = {
  totalStudents: number;
  activeStudents: number;
  pendingApplications: number;
  pendingOperationsApprovals: number;
  failedStudents: number;
  totalRevenuePaise: number;
  paidEnrollments: number;
  pendingPayments: number;
  tasksAssigned: number;
  pendingSubmissions: number;
  certificatesIssued: number;
  placementReadyStudents: number;
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

type MainResponse = {
  success?: boolean;
  message?: string;
  stats?: Partial<MainStats>;
  database?: DatabaseUsage;
  meta?: { generatedAt?: string; role?: string; refreshIntervalMs?: number };
};

type OperationsResponse = {
  success?: boolean;
  message?: string;
  data?: {
    stats?: Partial<OperationsStats>;
    generatedAt?: string;
    viewer?: { role?: string };
  };
};

type SourceState = "loading" | "connected" | "error";
type Tone = "blue" | "indigo" | "violet" | "green" | "amber" | "red";
type MetricProps = {
  label: string;
  value: string;
  detail: string;
  icon: ElementType;
  tone?: Tone;
};

const REFRESH_MS = 30_000;
const MAIN_API = "/api/admin/dashboard";
const OPERATIONS_API = "/api/student-admin/dashboard";

const EMPTY_MAIN: MainStats = {
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
  approvedApplications: 0,
  rejectedApplications: 0,
  passedAssessments: 0,
  failedAssessments: 0,
};

const EMPTY_OPERATIONS: OperationsStats = {
  totalStudents: 0,
  activeStudents: 0,
  pendingApplications: 0,
  pendingOperationsApprovals: 0,
  failedStudents: 0,
  totalRevenuePaise: 0,
  paidEnrollments: 0,
  pendingPayments: 0,
  tasksAssigned: 0,
  pendingSubmissions: 0,
  certificatesIssued: 0,
  placementReadyStudents: 0,
};

const EMPTY_DATABASE: DatabaseUsage = {
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
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function normalizeMain(value?: Partial<MainStats>): MainStats {
  const result = { ...EMPTY_MAIN };
  for (const key of Object.keys(result) as (keyof MainStats)[]) {
    result[key] = safeNumber(value?.[key]);
  }
  return result;
}

function normalizeOperations(value?: Partial<OperationsStats>): OperationsStats {
  const result = { ...EMPTY_OPERATIONS };
  for (const key of Object.keys(result) as (keyof OperationsStats)[]) {
    result[key] = safeNumber(value?.[key]);
  }
  return result;
}

function normalizeDatabase(value?: DatabaseUsage): DatabaseUsage {
  return {
    connected: Boolean(value?.connected),
    databaseName: typeof value?.databaseName === "string" ? value.databaseName : "",
    dataSizeBytes: safeNumber(value?.dataSizeBytes),
    storageSizeBytes: safeNumber(value?.storageSizeBytes),
    indexSizeBytes: safeNumber(value?.indexSizeBytes),
    totalSizeBytes: safeNumber(value?.totalSizeBytes),
    collections: safeNumber(value?.collections),
    objects: safeNumber(value?.objects),
    refreshedAt: typeof value?.refreshedAt === "string" ? value.refreshedAt : "",
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBytes(value: number): string {
  if (value < 1) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTime(value: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function MetricCard({ label, value, detail, icon: Icon, tone = "blue" }: MetricProps) {
  const tones: Record<Tone, string> = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    red: "border-red-100 bg-red-50 text-red-700",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function ProgressMetric({ label, value, total, detail, tone = "blue" }: {
  label: string;
  value: number;
  total: number;
  detail: string;
  tone?: Tone;
}) {
  const amount = percent(value, total);
  const fills: Record<Tone, string> = {
    blue: "bg-blue-600",
    indigo: "bg-indigo-600",
    violet: "bg-violet-600",
    green: "bg-emerald-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="shrink-0 text-sm font-black text-slate-900">{amount.toFixed(1)}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all duration-500 ${fills[tone]}`} style={{ width: `${amount}%` }} />
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, icon: Icon }: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ElementType;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function SourceBadge({ state, label }: { state: SourceState; label: string }) {
  const styles = state === "connected"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : state === "loading"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-red-200 bg-red-50 text-red-700";
  const Icon = state === "connected" ? Wifi : state === "loading" ? RefreshCw : WifiOff;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${styles}`}>
      <Icon size={12} className={state === "loading" ? "animate-spin" : ""} />
      {label}
    </span>
  );
}

export default function AdminAnalyticsPage() {
  const [mainStats, setMainStats] = useState<MainStats>(EMPTY_MAIN);
  const [operationsStats, setOperationsStats] = useState<OperationsStats>(EMPTY_OPERATIONS);
  const [mainDatabase, setMainDatabase] = useState<DatabaseUsage>(EMPTY_DATABASE);
  const [mainState, setMainState] = useState<SourceState>("loading");
  const [operationsState, setOperationsState] = useState<SourceState>("loading");
  const [mainError, setMainError] = useState("");
  const [operationsError, setOperationsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const mountedRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);

  const loadAnalytics = useCallback(async (manual = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    if (manual) setRefreshing(true);
    else setLoading(true);

    setMainState((current) => current === "connected" ? current : "loading");
    setOperationsState((current) => current === "connected" ? current : "loading");

    const fetchJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null) as (T & { success?: boolean; message?: string }) | null;
      if (!response.ok || !body?.success) {
        throw new Error(body?.message || `Request failed (${response.status}).`);
      }
      return body as T;
    };

    const [mainResult, operationsResult] = await Promise.allSettled([
      fetchJson<MainResponse>(MAIN_API),
      fetchJson<OperationsResponse>(OPERATIONS_API),
    ]);

    if (!mountedRef.current || controller.signal.aborted) return;

    if (mainResult.status === "fulfilled") {
      setMainStats(normalizeMain(mainResult.value.stats));
      setMainDatabase(normalizeDatabase(mainResult.value.database));
      setMainState("connected");
      setMainError("");
    } else {
      setMainState("error");
      setMainError(mainResult.reason instanceof Error ? mainResult.reason.message : "Main Admin analytics unavailable.");
    }

    if (operationsResult.status === "fulfilled") {
      setOperationsStats(normalizeOperations(operationsResult.value.data?.stats));
      setOperationsState("connected");
      setOperationsError("");
    } else {
      setOperationsState("error");
      setOperationsError(operationsResult.reason instanceof Error ? operationsResult.reason.message : "Student Operations analytics unavailable.");
    }

    setLastUpdated(new Date().toISOString());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadAnalytics();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadAnalytics();
    }, REFRESH_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadAnalytics();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      requestRef.current?.abort();
    };
  }, [loadAnalytics]);

  const applicationTotal = mainStats.approvedApplications + mainStats.rejectedApplications + mainStats.pendingApplications;
  const assessmentTotal = mainStats.passedAssessments + mainStats.failedAssessments + mainStats.assessmentPending;
  const paymentTotal = mainStats.paymentPaid + mainStats.paymentPending + mainStats.paymentFailed;
  const operationsApprovalTotal = operationsStats.activeStudents + operationsStats.pendingOperationsApprovals + operationsStats.failedStudents;
  const anyConnected = mainState === "connected" || operationsState === "connected";
  const allConnected = mainState === "connected" && operationsState === "connected";
  const busy = loading || refreshing;

  const platformCards: MetricProps[] = useMemo(() => [
    { label: "Main database students", value: formatNumber(mainStats.students), detail: "Student records in Main Admin database", icon: Users, tone: "blue" },
    { label: "Applications", value: formatNumber(mainStats.applications), detail: "All recorded applications", icon: FileCheck2, tone: "indigo" },
    { label: "Assessments", value: formatNumber(mainStats.assessments), detail: "Assessment records", icon: ClipboardCheck, tone: "violet" },
    { label: "Verified revenue", value: formatCurrency(mainStats.revenue), detail: "Paid payment records reported by Main Admin API", icon: CircleDollarSign, tone: "green" },
  ], [mainStats]);

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="overflow-hidden rounded-3xl bg-slate-950 px-5 py-6 text-white shadow-xl sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">
                <Activity size={13} /> CyberNet Intelligence
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Platform Analytics</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Unified operational view of Main Admin and Student Operations, with each database reported independently to prevent duplicate student totals.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <SourceBadge state={mainState} label={`Main Admin: ${mainState}`} />
                <SourceBadge state={operationsState} label={`Student Operations: ${operationsState}`} />
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-300">Auto refresh · 30 sec</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Last synchronized</p>
                <p className="mt-1 text-xs font-semibold text-slate-200">{formatTime(lastUpdated)}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadAnalytics(true)}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 text-sm font-bold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-300/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Syncing..." : "Refresh analytics"}
              </button>
            </div>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <p className="text-xs text-slate-400">Data sources online</p>
              <p className="mt-1 text-2xl font-black">{Number(mainState === "connected") + Number(operationsState === "connected")}/2</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <p className="text-xs text-slate-400">Operations active students</p>
              <p className="mt-1 text-2xl font-black">{formatNumber(operationsStats.activeStudents)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <p className="text-xs text-slate-400">Main Admin active students</p>
              <p className="mt-1 text-2xl font-black">{formatNumber(mainStats.activeStudents)}</p>
            </div>
          </div>
        </header>

        {!anyConnected && !loading ? (
          <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Both analytics sources are currently unavailable. Check the administrator session and both dashboard APIs, then retry.
          </div>
        ) : null}

        {mainError ? (
          <div role="alert" className="mt-5 flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-red-800"><strong>Main Admin:</strong> {mainError}</p>
            <button type="button" onClick={() => void loadAnalytics(true)} className="text-xs font-bold text-red-800 underline">Retry</button>
          </div>
        ) : null}
        {operationsError ? (
          <div role="alert" className="mt-3 flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-red-800"><strong>Student Operations:</strong> {operationsError}</p>
            <button type="button" onClick={() => void loadAnalytics(true)} className="text-xs font-bold text-red-800 underline">Retry</button>
          </div>
        ) : null}

        <section className="mt-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <SectionHeading eyebrow="Source 01 · Main database" title="Main Admin Analytics" description="Applications, assessments, internship catalogue, payment status and main student lifecycle." icon={ShieldCheck} />
            <SourceBadge state={mainState} label={mainState === "connected" ? "Main DB connected" : mainState} />
          </div>
          {loading && mainState !== "connected" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{platformCards.map((card) => <MetricCard key={card.label} {...card} />)}</div>
          )}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-sm font-black text-slate-900">Main Admin performance</h3>
              <p className="mt-1 text-xs text-slate-500">Ratios calculated from the current API counts.</p>
              <div className="mt-5 space-y-4">
                <ProgressMetric label="Application approvals" value={mainStats.approvedApplications} total={applicationTotal} detail={`${formatNumber(mainStats.approvedApplications)} approved · ${formatNumber(applicationTotal)} classified`} tone="blue" />
                <ProgressMetric label="Assessment pass rate" value={mainStats.passedAssessments} total={mainStats.passedAssessments + mainStats.failedAssessments} detail={`${formatNumber(mainStats.passedAssessments)} passed · ${formatNumber(mainStats.failedAssessments)} failed`} tone="green" />
                <ProgressMetric label="Payment completion" value={mainStats.paymentPaid} total={paymentTotal} detail={`${formatNumber(mainStats.paymentPaid)} paid · ${formatNumber(mainStats.paymentPending)} pending · ${formatNumber(mainStats.paymentFailed)} failed`} tone="violet" />
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-sm font-black text-slate-900">Main Admin operational queue</h3>
              <p className="mt-1 text-xs text-slate-500">Records requiring review or attention.</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricCard label="Pending applications" value={formatNumber(mainStats.pendingApplications)} detail="Awaiting application review" icon={FileCheck2} tone="amber" />
                <MetricCard label="Assessment pending" value={formatNumber(mainStats.assessmentPending)} detail="Pending or in progress" icon={ClipboardCheck} tone="amber" />
                <MetricCard label="Payment approvals" value={formatNumber(mainStats.paymentApprovalPending)} detail="Paid, awaiting approval" icon={CircleDollarSign} tone="amber" />
                <MetricCard label="Expiring in 3 days" value={formatNumber(mainStats.expiringWithin3Days)} detail="Student access expiry window" icon={AlertTriangle} tone="red" />
                <MetricCard label="Active internships" value={formatNumber(mainStats.activeInternships)} detail="Active catalogue entries" icon={BriefcaseBusiness} tone="green" />
                <MetricCard label="Certificates" value={formatNumber(mainStats.certificates)} detail="Main database certificate count" icon={Award} tone="indigo" />
              </div>
            </section>
          </div>
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Main database health</h3>
                <p className="mt-1 text-xs text-slate-500">MongoDB statistics reported by the Main Admin API.</p>
              </div>
              <SourceBadge state={mainDatabase.connected ? "connected" : mainState === "error" ? "error" : "loading"} label={mainDatabase.connected ? "Connected" : "Unavailable"} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] text-slate-500">Database name</p><p className="mt-1 truncate text-sm font-bold">{mainDatabase.databaseName || "Unavailable"}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] text-slate-500">Data size</p><p className="mt-1 text-sm font-bold">{formatBytes(mainDatabase.dataSizeBytes)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] text-slate-500">Storage + indexes</p><p className="mt-1 text-sm font-bold">{formatBytes(mainDatabase.storageSizeBytes + mainDatabase.indexSizeBytes)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] text-slate-500">Collections / documents</p><p className="mt-1 text-sm font-bold">{formatNumber(mainDatabase.collections)} / {formatNumber(mainDatabase.objects)}</p></div>
            </div>
          </section>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <SectionHeading eyebrow="Source 02 · Student operations database" title="Student Operations Analytics" description="Separate operational student records, approvals, paid enrollments and payment queue." icon={Database} />
            <SourceBadge state={operationsState} label={operationsState === "connected" ? "Operations API connected" : operationsState} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Operations students" value={formatNumber(operationsStats.totalStudents)} detail="Student records from Student Operations service" icon={Users} tone="blue" />
            <MetricCard label="Active operations students" value={formatNumber(operationsStats.activeStudents)} detail="Students with active operations status" icon={CheckCircle2} tone="green" />
            <MetricCard label="Paid enrollments" value={formatNumber(operationsStats.paidEnrollments)} detail="Paid status from operations student service" icon={CircleDollarSign} tone="violet" />
            <MetricCard label="Pending payments" value={formatNumber(operationsStats.pendingPayments)} detail="Awaiting payment completion" icon={AlertTriangle} tone="amber" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-sm font-black text-slate-900">Operations approval pipeline</h3>
              <p className="mt-1 text-xs text-slate-500">Separate operational approval lifecycle.</p>
              <div className="mt-5 space-y-4">
                <ProgressMetric label="Active operations students" value={operationsStats.activeStudents} total={operationsStats.totalStudents} detail={`${formatNumber(operationsStats.activeStudents)} active of ${formatNumber(operationsStats.totalStudents)} total`} tone="green" />
                <ProgressMetric label="Approval queue" value={operationsStats.pendingOperationsApprovals} total={operationsApprovalTotal} detail={`${formatNumber(operationsStats.pendingOperationsApprovals)} paid students awaiting operations approval`} tone="amber" />
                <ProgressMetric label="Paid enrollments" value={operationsStats.paidEnrollments} total={operationsStats.totalStudents} detail={`${formatNumber(operationsStats.paidEnrollments)} paid enrollments`} tone="violet" />
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-sm font-black text-slate-900">Operations workflow counters</h3>
              <p className="mt-1 text-xs text-slate-500">Only counters currently exposed by the Student Operations API are shown as measured values.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricCard label="Pending applications" value={formatNumber(operationsStats.pendingApplications)} detail="Awaiting application action" icon={FileCheck2} tone="amber" />
                <MetricCard label="Rejected students" value={formatNumber(operationsStats.failedStudents)} detail="Rejected operations records" icon={AlertTriangle} tone="red" />
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-700">Additional workflow analytics not exposed yet</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Task assignments, pending submissions, issued certificates and placement-ready counts are currently returned as fixed zero values by the Student Operations API. They are intentionally not presented as verified live measurements here.</p>
              </div>
            </section>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading eyebrow="Source 03 · Student journey" title="Student Dashboard Overview" description="Student-facing dashboard activity is represented here only through the aggregate operational counters currently available to the admin API." icon={BarChart3} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Students with active journey" value={formatNumber(operationsStats.activeStudents)} detail="Operations active status; not individual login activity" icon={Activity} tone="green" />
            <MetricCard label="Students enrolled after payment" value={formatNumber(operationsStats.paidEnrollments)} detail="Paid enrollment count from operations service" icon={CheckCircle2} tone="blue" />
            <MetricCard label="Awaiting operations approval" value={formatNumber(operationsStats.pendingOperationsApprovals)} detail="Dashboard activation remains subject to approval" icon={ShieldCheck} tone="amber" />
            <MetricCard label="Payment still pending" value={formatNumber(operationsStats.pendingPayments)} detail="Enrollment payment not yet completed" icon={CircleDollarSign} tone="violet" />
          </div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <p className="text-xs font-bold text-blue-900">Student-level analytics limitation</p>
            <p className="mt-1 text-xs leading-5 text-blue-800">The supplied Student Operations dashboard API does not currently return student login activity, attendance totals, learning progress, task completion or student assessment results. Those values need dedicated aggregate queries in the API before they can be displayed as real-time student dashboard analytics.</p>
          </div>
        </section>

        <footer className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><Database size={14} /><span>{allConnected ? "Both analytics APIs responded successfully." : anyConnected ? "Partial analytics available; one source needs attention." : "Waiting for analytics sources."}</span></div>
          <span>Updated: {formatTime(lastUpdated)} · Refresh interval: 30 seconds</span>
        </footer>
      </div>
    </main>
  );
}
