 "use client";

import {
  Activity,
  Award,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  RefreshCw,
  TrendingUp,
  Users,
  AlertTriangle,
  Database,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";

const DASHBOARD_API = "/api/admin/dashboard";
const REFRESH_MS = 30_000;

type Stats = {
  students: number;
  applications: number;
  assessments: number;
  internships: number;
  pendingApplications: number;
  assessmentPending: number;
  paymentApprovalPending: number;
  expiringWithin3Days: number;
  payments: number;
  verifiedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  revenue: number;
  activeStudents: number;
  expiredStudents: number;
  recentlyActiveStudents: number;
  completedAssessments: number;
  passedAssessments: number;
  failedAssessments: number;
  activeInternships: number;
  selectedInternships: number;
  approvedApplications: number;
  rejectedApplications: number;
  certificates: number;
  studentChange: string;
  applicationChange: string;
  assessmentChange: string;
  internshipChange: string;
  paymentChange: string;
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

type ApiResponse = {
  success?: boolean;
  message?: string;
  stats?: Partial<Stats>;
  database?: DatabaseUsage;
  meta?: {
    generatedAt?: string;
    authenticated?: boolean;
    role?: string;
  };
};

type MetricCard = {
  title: string;
  value: string;
  description: string;
  icon: ElementType;
  tone: "blue" | "indigo" | "sky" | "violet";
};

const EMPTY_STATS: Stats = {
  students: 0,
  applications: 0,
  assessments: 0,
  internships: 0,
  pendingApplications: 0,
  assessmentPending: 0,
  paymentApprovalPending: 0,
  expiringWithin3Days: 0,
  payments: 0,
  verifiedPayments: 0,
  pendingPayments: 0,
  failedPayments: 0,
  revenue: 0,
  activeStudents: 0,
  expiredStudents: 0,
  recentlyActiveStudents: 0,
  completedAssessments: 0,
  passedAssessments: 0,
  failedAssessments: 0,
  activeInternships: 0,
  selectedInternships: 0,
  approvedApplications: 0,
  rejectedApplications: 0,
  certificates: 0,
  studentChange: "Live",
  applicationChange: "Live",
  assessmentChange: "Live",
  internshipChange: "Live",
  paymentChange: "Live",
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

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeStats(input?: Partial<Stats>): Stats {
  return {
    ...EMPTY_STATS,
    ...(input ?? {}),
    students: number(input?.students),
    applications: number(input?.applications),
    assessments: number(input?.assessments),
    internships: number(input?.internships),
    pendingApplications: number(input?.pendingApplications),
    assessmentPending: number(input?.assessmentPending),
    paymentApprovalPending: number(input?.paymentApprovalPending),
    expiringWithin3Days: number(input?.expiringWithin3Days),
    payments: number(input?.payments),
    verifiedPayments: number(input?.verifiedPayments),
    pendingPayments: number(input?.pendingPayments),
    failedPayments: number(input?.failedPayments),
    revenue: number(input?.revenue),
    activeStudents: number(input?.activeStudents),
    expiredStudents: number(input?.expiredStudents),
    recentlyActiveStudents: number(input?.recentlyActiveStudents),
    completedAssessments: number(input?.completedAssessments),
    passedAssessments: number(input?.passedAssessments),
    failedAssessments: number(input?.failedAssessments),
    activeInternships: number(input?.activeInternships),
    selectedInternships: number(input?.selectedInternships),
    approvedApplications: number(input?.approvedApplications),
    rejectedApplications: number(input?.rejectedApplications),
    certificates: number(input?.certificates),
  };
}

function normalizeDatabase(input?: DatabaseUsage): DatabaseUsage {
  return {
    connected: Boolean(input?.connected),
    databaseName: typeof input?.databaseName === "string" ? input.databaseName : "",
    dataSizeBytes: number(input?.dataSizeBytes),
    storageSizeBytes: number(input?.storageSizeBytes),
    indexSizeBytes: number(input?.indexSizeBytes),
    totalSizeBytes: number(input?.totalSizeBytes),
    collections: number(input?.collections),
    objects: number(input?.objects),
    refreshedAt: typeof input?.refreshedAt === "string" ? input.refreshedAt : "",
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBytes(value: number): string {
  if (!value || value < 1) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );

  return `${(value / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (part / total) * 100));
}

function timeLabel(value: string): string {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Metric({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: MetricCard) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    sky: "bg-sky-50 text-sky-600 border-sky-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClasses[tone]}`}
        >
          <Icon size={20} strokeWidth={2} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}

function ProgressRow({
  label,
  value,
  total,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  total: number;
  detail: string;
  icon: ElementType;
}) {
  const percent = percentage(value, total);

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-100">
            <Icon size={17} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {label}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>
          </div>
        </div>

        <p className="text-sm font-bold text-slate-900">
          {formatNumber(value)}
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-right text-[10px] font-semibold text-slate-400">
        {percent.toFixed(1)}%
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const classes = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <div className={`rounded-xl border p-4 ${classes[tone]}`}>
      <p className="text-[11px] font-semibold opacity-70">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [database, setDatabase] =
    useState<DatabaseUsage>(EMPTY_DATABASE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const mountedRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);

  const loadAnalytics = useCallback(async (manual = false) => {
    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    if (manual) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const response = await fetch(
        `${DASHBOARD_API}?analyticsRefresh=${Date.now()}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        },
      );

      const result = (await response.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            `Analytics request failed with status ${response.status}.`,
        );
      }

      if (!mountedRef.current) return;

      setStats(normalizeStats(result.stats));
      setDatabase(normalizeDatabase(result.database));
      setLastUpdated(
        result.database?.refreshedAt ||
          new Date().toISOString(),
      );
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return;
      }

      if (!mountedRef.current) return;

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load live analytics.",
      );
    } finally {
      if (!mountedRef.current) return;

      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadAnalytics();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadAnalytics();
      }
    }, REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadAnalytics();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
      requestRef.current?.abort();
    };
  }, [loadAnalytics]);

  const applicationTotal = useMemo(
    () =>
      stats.approvedApplications +
      stats.rejectedApplications +
      stats.pendingApplications,
    [stats],
  );

  const assessmentTotal = useMemo(
    () =>
      stats.passedAssessments +
      stats.failedAssessments +
      stats.assessmentPending,
    [stats],
  );

  const paymentTotal = useMemo(
    () =>
      stats.verifiedPayments +
      stats.pendingPayments +
      stats.failedPayments,
    [stats],
  );

  const studentTotal = stats.students;

  const passRate = percentage(
    stats.passedAssessments,
    stats.completedAssessments,
  );

  const approvalRate = percentage(
    stats.approvedApplications,
    applicationTotal,
  );

  const paymentSuccessRate = percentage(
    stats.verifiedPayments,
    paymentTotal,
  );

  const activeStudentRate = percentage(
    stats.activeStudents,
    studentTotal,
  );

  const metrics: MetricCard[] = [
    {
      title: "Total Students",
      value: formatNumber(stats.students),
      description: "Live student records available to the admin platform.",
      icon: Users,
      tone: "blue",
    },
    {
      title: "Applications",
      value: formatNumber(stats.applications),
      description: "All internship applications currently recorded.",
      icon: FileCheck2,
      tone: "indigo",
    },
    {
      title: "Internships",
      value: formatNumber(stats.internships),
      description: "Internship programs available in the platform.",
      icon: BriefcaseBusiness,
      tone: "sky",
    },
    {
      title: "Revenue",
      value: formatCurrency(stats.revenue),
      description: "Live revenue value returned by the admin dashboard API.",
      icon: CreditCard,
      tone: "violet",
    },
  ];

  const busy = loading || refreshing;

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <style jsx>{`
        @keyframes analytics-float {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.22;
          }
          50% {
            transform: translateY(-10px);
            opacity: 0.4;
          }
        }

        .analytics-orb {
          animation: analytics-float 7s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .analytics-orb {
            animation: none;
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="analytics-orb absolute -left-32 top-10 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="analytics-orb absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl [animation-delay:1.5s]" />
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-600">
                Admin Workspace
              </p>
            </div>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Analytics
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Live platform performance based on the same authenticated
              dashboard data used by the admin workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadAnalytics(true)}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
        </header>

        {error ? (
          <div
            role="alert"
            className="mt-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-bold text-red-800">
                Analytics could not be loaded
              </p>
              <p className="mt-1 text-xs text-red-700">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => void loadAnalytics(true)}
              className="h-9 rounded-lg border border-red-200 bg-white px-4 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Metric key={metric.title} {...metric} />
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-7">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-600" />
                  <h2 className="text-lg font-bold text-slate-950">
                    Platform Performance
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Current-state ratios calculated only from live API values.
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live data
              </span>
            </div>

            <div className="mt-6 grid gap-4">
              <ProgressRow
                label="Application Approval"
                value={stats.approvedApplications}
                total={applicationTotal}
                detail={`${formatNumber(stats.approvedApplications)} approved of ${formatNumber(applicationTotal)} classified applications`}
                icon={FileCheck2}
              />

              <ProgressRow
                label="Assessment Pass Rate"
                value={stats.passedAssessments}
                total={stats.completedAssessments}
                detail={`${formatNumber(stats.passedAssessments)} passed of ${formatNumber(stats.completedAssessments)} completed assessments`}
                icon={ClipboardCheck}
              />

              <ProgressRow
                label="Payment Success"
                value={stats.verifiedPayments}
                total={paymentTotal}
                detail={`${formatNumber(stats.verifiedPayments)} verified of ${formatNumber(paymentTotal)} classified payments`}
                icon={CreditCard}
              />

              <ProgressRow
                label="Active Students"
                value={stats.activeStudents}
                total={studentTotal}
                detail={`${formatNumber(stats.activeStudents)} active of ${formatNumber(studentTotal)} total students`}
                icon={Users}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-7">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-600" />
              <h2 className="text-lg font-bold text-slate-950">
                Key Performance
              </h2>
            </div>

            <div className="mt-5 grid gap-3">
              <MiniStat
                label="Application approval rate"
                value={`${approvalRate.toFixed(1)}%`}
                tone="blue"
              />

              <MiniStat
                label="Assessment pass rate"
                value={`${passRate.toFixed(1)}%`}
                tone="green"
              />

              <MiniStat
                label="Payment success rate"
                value={`${paymentSuccessRate.toFixed(1)}%`}
                tone="green"
              />

              <MiniStat
                label="Active student rate"
                value={`${activeStudentRate.toFixed(1)}%`}
                tone="blue"
              />
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600">
                <AlertTriangle size={18} />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Attention Required
                </h2>
                <p className="text-xs text-slate-500">
                  Current operational queue
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniStat
                label="Pending applications"
                value={formatNumber(stats.pendingApplications)}
                tone="amber"
              />

              <MiniStat
                label="Assessment pending"
                value={formatNumber(stats.assessmentPending)}
                tone="amber"
              />

              <MiniStat
                label="Payment approval"
                value={formatNumber(stats.paymentApprovalPending)}
                tone="amber"
              />

              <MiniStat
                label="Expiring ≤ 3 days"
                value={formatNumber(stats.expiringWithin3Days)}
                tone="red"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                <ClipboardCheck size={18} />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Assessments
                </h2>
                <p className="text-xs text-slate-500">
                  Live assessment lifecycle
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <MiniStat
                label="Completed"
                value={formatNumber(stats.completedAssessments)}
                tone="blue"
              />

              <MiniStat
                label="Passed"
                value={formatNumber(stats.passedAssessments)}
                tone="green"
              />

              <MiniStat
                label="Failed"
                value={formatNumber(stats.failedAssessments)}
                tone="red"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-600">
                <Award size={18} />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Platform Output
                </h2>
                <p className="text-xs text-slate-500">
                  Current completed platform records
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniStat
                label="Certificates"
                value={formatNumber(stats.certificates)}
                tone="blue"
              />

              <MiniStat
                label="Active internships"
                value={formatNumber(stats.activeInternships)}
                tone="green"
              />

              <MiniStat
                label="Approved applications"
                value={formatNumber(stats.approvedApplications)}
                tone="green"
              />

              <MiniStat
                label="Rejected applications"
                value={formatNumber(stats.rejectedApplications)}
                tone="red"
              />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-7">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Database size={18} className="text-blue-600" />
                <h2 className="text-lg font-bold text-slate-950">
                  Database Overview
                </h2>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Live database information returned by the protected admin
                dashboard endpoint.
              </p>
            </div>

            <div
              className={[
                "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold",
                database.connected
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : "border-red-100 bg-red-50 text-red-700",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  database.connected
                    ? "bg-emerald-500"
                    : "bg-red-500",
                ].join(" ")}
              />
              {database.connected ? "Connected" : "Unavailable"}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold text-slate-500">
                Database
              </p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900">
                {database.databaseName || "Unavailable"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold text-slate-500">
                Data size
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatBytes(database.dataSizeBytes)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold text-slate-500">
                Storage size
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatBytes(database.storageSizeBytes)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold text-slate-500">
                Collections
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatNumber(database.collections)}
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Analytics uses live authenticated admin data. No demo or fabricated
            historical values are displayed.
          </p>

          <p className="shrink-0 font-medium text-slate-400">
            Last updated: {timeLabel(lastUpdated)}
          </p>
        </footer>
      </div>
    </main>
  );
}
