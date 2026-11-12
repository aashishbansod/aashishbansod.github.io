"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileBarChart2,
  FileCheck2,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

type AnyRecord = Record<string, unknown>;
type SourceKey = "applications" | "payments" | "coding" | "tasks" | "certificates";
type SourceState = "loading" | "ready" | "error";
type SourceResult = {
  state: SourceState;
  data: AnyRecord;
  error: string;
};
type ReportData = Record<SourceKey, SourceResult>;

const SOURCE_CONFIG: Record<SourceKey, { label: string; url: string }> = {
  applications: {
    label: "Applications",
    url: "/api/student-admin/applications?page=1&limit=1",
  },
  payments: {
    label: "Payments",
    url: "/api/student-admin/payments?page=1&limit=1",
  },
  coding: {
    label: "Coding",
    url: "/api/student-admin/coding?page=1&limit=1",
  },
  tasks: {
    label: "Tasks",
    url: "/api/student-admin/tasks?page=1&limit=1",
  },
  certificates: {
    label: "Certificates",
    url: "/api/student-admin/certificates?page=1&limit=1",
  },
};

const SOURCE_KEYS = Object.keys(SOURCE_CONFIG) as SourceKey[];
const REFRESH_INTERVAL = 60_000;
const EMPTY_SOURCE: SourceResult = { state: "loading", data: {}, error: "" };

function createInitialReport(): ReportData {
  return {
    applications: { ...EMPTY_SOURCE },
    payments: { ...EMPTY_SOURCE },
    coding: { ...EMPTY_SOURCE },
    tasks: { ...EMPTY_SOURCE },
    certificates: { ...EMPTY_SOURCE },
  };
}

function asRecord(value: unknown): AnyRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function readPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as AnyRecord)[key];
  }
  return current;
}

function readMetric(source: SourceResult, paths: string[]): number | null {
  if (source.state !== "ready") return null;
  for (const path of paths) {
    const value = asFiniteNumber(readPath(source.data, path.split(".")));
    if (value !== null) return value;
  }
  return null;
}

function formatNumber(value: number | null, compact = false): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function unwrapPayload(payload: unknown): AnyRecord {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  return Object.keys(data).length ? data : root;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  const root = asRecord(payload);
  return typeof root.message === "string" && root.message.trim()
    ? root.message.slice(0, 240)
    : fallback;
}

function exportReport(rows: Array<[string, string | number]>) {
  const escapeCell = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const csv = [
    ["Metric", "Value"].map(escapeCell).join(","),
    ...rows.map(([label, value]) =>
      [escapeCell(label), escapeCell(value)].join(","),
    ),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cybernet-student-operations-report-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone: "blue" | "emerald" | "violet" | "amber";
  loading: boolean;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-3 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {loading ? "…" : value}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}>
          <Icon size={20} />
        </span>
      </div>
    </article>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function SourceBadge({
  label,
  source,
}: {
  label: string;
  source: SourceResult;
}) {
  const ready = source.state === "ready";
  const loading = source.state === "loading";
  return (
    <span
      title={source.error || `${label} ${ready ? "connected" : loading ? "loading" : "unavailable"}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
        ready
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : loading
            ? "border-slate-200 bg-slate-50 text-slate-500"
            : "border-rose-100 bg-rose-50 text-rose-700"
      }`}
    >
      {ready ? <CheckCircle2 size={12} /> : loading ? <Activity size={12} className="animate-pulse" /> : <XCircle size={12} />}
      {label}: {ready ? "Connected" : loading ? "Checking" : "Unavailable"}
    </span>
  );
}

function SourceHealthTile({
  label,
  source,
}: {
  label: string;
  source: SourceResult;
}) {
  const ready = source.state === "ready";
  const loading = source.state === "loading";
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-slate-800">{label}</p>
        <p className={`mt-1 text-[10px] font-semibold ${ready ? "text-emerald-700" : loading ? "text-slate-500" : "text-rose-700"}`}>
          {ready ? "Operational" : loading ? "Checking connection" : "Unavailable"}
        </p>
      </div>
      {ready ? (
        <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
      ) : loading ? (
        <Activity size={18} className="shrink-0 animate-pulse text-slate-400" />
      ) : (
        <AlertCircle size={18} className="shrink-0 text-rose-600" />
      )}
    </div>
  );
}

export default function StudentAdminReportsPage() {
  const [report, setReport] = useState<ReportData>(createInitialReport);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pageError, setPageError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const loadReports = useCallback(async (silent = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    if (silent) setRefreshing(true);
    else setLoading(true);
    setPageError("");

    const results = await Promise.all(
      SOURCE_KEYS.map(async (key) => {
        const config = SOURCE_CONFIG[key];
        try {
          const response = await fetch(config.url, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          const payload: unknown = await response.json().catch(() => null);

          if (response.status === 401 || response.status === 403) {
            return [key, {
              state: "error",
              data: {},
              error: "AUTH_REQUIRED",
            }] as const;
          }

          const root = asRecord(payload);
          if (!response.ok || root.success === false || payload === null) {
            return [key, {
              state: "error",
              data: {},
              error: getErrorMessage(payload, `Request failed (${response.status}).`),
            }] as const;
          }

          return [key, {
            state: "ready",
            data: unwrapPayload(payload),
            error: "",
          }] as const;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return [key, {
              state: "error",
              data: {},
              error: "Request cancelled.",
            }] as const;
          }
          return [key, {
            state: "error",
            data: {},
            error: error instanceof Error
              ? error.message.slice(0, 240)
              : "Unable to load this report source.",
          }] as const;
        }
      }),
    );

    if (controller.signal.aborted || !mountedRef.current) return;

    const next = Object.fromEntries(results) as ReportData;
    setReport(next);
    setLastUpdated(new Date());

    const authFailure = results.some(([, value]) => value.error === "AUTH_REQUIRED");
    if (authFailure) {
      window.location.replace(
        "/login?mode=student-admin&next=%2Fstudent-admin%2Freports",
      );
      return;
    }

    if (results.every(([, value]) => value.state === "error")) {
      setPageError(
        "Reports are currently unavailable. Check your Student Operations session and API connections, then try again.",
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadReports();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadReports(true);
    }, REFRESH_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadReports(true);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      requestRef.current?.abort();
    };
  }, [loadReports]);

  const values = useMemo(() => {
    const appTotal = readMetric(report.applications, [
      "pagination.total",
      "total",
      "stats.totalApplications",
      "stats.total",
    ]);
    const appPending = readMetric(report.applications, [
      "stats.pending",
      "stats.pendingApplications",
      "stats.pendingReview",
    ]);
    const appApproved = readMetric(report.applications, [
      "stats.approved",
      "stats.approvedApplications",
    ]);

    const paymentTotal = readMetric(report.payments, [
      "stats.total",
      "stats.totalPayments",
      "pagination.total",
      "total",
    ]);
    const paymentSuccessful = readMetric(report.payments, [
      "stats.successful",
      "stats.success",
      "stats.paid",
      "stats.issued",
    ]);
    const revenue = readMetric(report.payments, [
      "stats.revenue",
      "stats.totalRevenue",
      "stats.successfulRevenue",
    ]);

    const codingQuestions = readMetric(report.coding, [
      "stats.totalQuestions",
      "stats.total",
    ]);
    const codingSubmissions = readMetric(report.coding, [
      "stats.totalSubmissions",
      "stats.submissions",
    ]);
    const codingPending = readMetric(report.coding, [
      "stats.pendingSubmissions",
      "stats.pending",
    ]);

    const taskTotal = readMetric(report.tasks, [
      "stats.totalTasks",
      "stats.total",
    ]);
    const taskPublished = readMetric(report.tasks, [
      "stats.publishedTasks",
      "stats.published",
    ]);
    const taskPending = readMetric(report.tasks, [
      "stats.pendingReviews",
      "stats.pendingSubmissions",
    ]);

    const certificateTotal = readMetric(report.certificates, [
      "stats.total",
      "pagination.total",
      "total",
    ]);
    const certificateIssued = readMetric(report.certificates, [
      "stats.issued",
      "stats.generated",
    ]);
    const certificatePending = readMetric(report.certificates, [
      "stats.pending",
    ]);

    return {
      appTotal,
      appPending,
      appApproved,
      paymentTotal,
      paymentSuccessful,
      revenue,
      codingQuestions,
      codingSubmissions,
      codingPending,
      taskTotal,
      taskPublished,
      taskPending,
      certificateTotal,
      certificateIssued,
      certificatePending,
    };
  }, [report]);

  const sourceErrors = SOURCE_KEYS.filter((key) => report[key].state === "error");
  const readyCount = SOURCE_KEYS.filter((key) => report[key].state === "ready").length;

  const exportRows = useMemo<Array<[string, string | number]>>(() => {
    const entries: Array<[string, number | null]> = [
      ["Applications received", values.appTotal],
      ["Applications pending", values.appPending],
      ["Applications approved", values.appApproved],
      ["Payment transactions", values.paymentTotal],
      ["Successful payments", values.paymentSuccessful],
      ["Verified revenue (INR)", values.revenue],
      ["Coding questions", values.codingQuestions],
      ["Coding submissions", values.codingSubmissions],
      ["Coding reviews pending", values.codingPending],
      ["Tasks created", values.taskTotal],
      ["Tasks published", values.taskPublished],
      ["Task reviews pending", values.taskPending],
      ["Certificates", values.certificateTotal],
      ["Certificates issued", values.certificateIssued],
      ["Certificates pending", values.certificatePending],
    ];
    return [
      ...entries.map(([label, value]) => [label, value === null ? "Unavailable" : value] as [string, string | number]),
      ["Sources connected", `${readyCount}/${SOURCE_KEYS.length}`],
      ["Report generated at", lastUpdated ? lastUpdated.toISOString() : "Not synchronized"],
    ];
  }, [values, readyCount, lastUpdated]);

  const cards = [
    {
      label: "Applications received",
      value: formatNumber(values.appTotal, true),
      detail: `${formatNumber(values.appPending, true)} pending review`,
      icon: Users,
      tone: "blue" as const,
    },
    {
      label: "Successful payments",
      value: formatNumber(values.paymentSuccessful, true),
      detail: `${formatNumber(values.paymentTotal, true)} transactions`,
      icon: CreditCard,
      tone: "emerald" as const,
    },
    {
      label: "Verified revenue",
      value: formatMoney(values.revenue),
      detail: "Reported by payment records API",
      icon: Wallet,
      tone: "violet" as const,
    },
    {
      label: "Certificates issued",
      value: formatNumber(values.certificateIssued, true),
      detail: `${formatNumber(values.certificatePending, true)} pending`,
      icon: FileCheck2,
      tone: "amber" as const,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4f7fc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-5 p-5 sm:p-7 xl:flex-row xl:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <FileBarChart2 size={23} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-blue-700">
                    CyberNet Careers
                  </p>
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-bold tracking-wide text-blue-700">
                    STUDENT OPERATIONS
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Reports & Analytics
                </h1>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
                  A consolidated operational snapshot across applications, payments, learning activity and certificates.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                <span className={`h-2 w-2 rounded-full ${readyCount === SOURCE_KEYS.length ? "bg-emerald-500" : readyCount > 0 ? "bg-amber-500" : "bg-rose-500"}`} />
                {readyCount}/{SOURCE_KEYS.length} sources online
              </div>
              <button
                type="button"
                onClick={() => void loadReports(true)}
                disabled={refreshing || loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={() => exportReport(exportRows)}
                disabled={loading || readyCount === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowDownToLine size={14} />
                Export CSV
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 text-[10px] font-medium text-slate-500 sm:px-7">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-600" />
              Authenticated Student Operations workspace
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={13} />
              {lastUpdated ? `Last synchronized ${formatDate(lastUpdated)}` : "Waiting for first synchronization"}
            </span>
          </div>
        </header>

        {pageError ? (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Reports unavailable</p>
              <p className="mt-1 text-xs leading-5">{pageError}</p>
            </div>
          </div>
        ) : null}

        {sourceErrors.length > 0 && !pageError ? (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <AlertCircle size={17} />
              Some report sources could not be loaded
            </div>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              Unavailable sources are shown as unavailable, not as verified zero values. Other connected sources remain visible.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sourceErrors.map((key) => (
                <span key={key} className="rounded-lg border border-amber-200 bg-white/80 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                  {SOURCE_CONFIG[key].label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <MetricCard
              key={card.label}
              label={card.label}
              value={card.value}
              detail={card.detail}
              icon={card.icon}
              tone={card.tone}
              loading={loading}
            />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">Admissions</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Application pipeline</h2>
                <p className="mt-1 text-xs text-slate-500">Application records and review progress</p>
              </div>
              <GraduationCap size={23} className="shrink-0 text-blue-600" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <MiniMetric label="Total" value={formatNumber(values.appTotal, true)} />
              <MiniMetric label="Pending" value={formatNumber(values.appPending, true)} />
              <MiniMetric label="Approved" value={formatNumber(values.appApproved, true)} />
            </div>
            <div className="mt-4">
              <SourceBadge label="Applications API" source={report.applications} />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">Finance</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Payment performance</h2>
                <p className="mt-1 text-xs text-slate-500">Transaction and revenue metrics from payment records</p>
              </div>
              <Wallet size={23} className="shrink-0 text-emerald-600" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <MiniMetric label="Transactions" value={formatNumber(values.paymentTotal, true)} />
              <MiniMetric label="Successful" value={formatNumber(values.paymentSuccessful, true)} />
              <MiniMetric label="Revenue" value={formatMoney(values.revenue)} />
            </div>
            <div className="mt-4">
              <SourceBadge label="Payments API" source={report.payments} />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-700">Learning operations</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Tasks & coding activity</h2>
                <p className="mt-1 text-xs text-slate-500">Learning content and submission review workload</p>
              </div>
              <BookOpenCheck size={23} className="shrink-0 text-violet-600" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniMetric label="Tasks" value={formatNumber(values.taskTotal, true)} />
              <MiniMetric label="Published" value={formatNumber(values.taskPublished, true)} />
              <MiniMetric label="Coding bank" value={formatNumber(values.codingQuestions, true)} />
              <MiniMetric label="Submissions" value={formatNumber(values.codingSubmissions, true)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SourceBadge label="Tasks API" source={report.tasks} />
              <SourceBadge label="Coding API" source={report.coding} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
              <span>Task reviews pending: <strong className="text-slate-800">{formatNumber(values.taskPending, true)}</strong></span>
              <span>Coding reviews pending: <strong className="text-slate-800">{formatNumber(values.codingPending, true)}</strong></span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-700">Credentials & recognition</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Certificate operations</h2>
                <p className="mt-1 text-xs text-slate-500">Eligibility and issued certificate counts</p>
              </div>
              <BadgeCheck size={23} className="shrink-0 text-amber-600" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <MiniMetric label="Total" value={formatNumber(values.certificateTotal, true)} />
              <MiniMetric label="Issued" value={formatNumber(values.certificateIssued, true)} />
              <MiniMetric label="Pending" value={formatNumber(values.certificatePending, true)} />
            </div>
            <div className="mt-4">
              <SourceBadge label="Certificates API" source={report.certificates} />
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">Report integrity</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Data source health</h2>
              <p className="mt-1 text-xs text-slate-500">Connection status reflects the latest response from each existing Student Operations API.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Clock3 size={14} />
              Automatic refresh every 60 seconds
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SOURCE_KEYS.map((key) => (
              <SourceHealthTile
                key={key}
                label={SOURCE_CONFIG[key].label}
                source={report[key]}
              />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} />
              Read-only reporting view
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity size={13} />
              {readyCount} of {SOURCE_KEYS.length} data sources connected
            </span>
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-2 px-1 text-[10px] text-slate-400 sm:flex-row sm:items-center">
          <span>CyberNet Careers · Student Operations Reports</span>
          <span>Metrics depend on fields returned by the connected APIs.</span>
        </footer>
      </div>
    </main>
  );
}
