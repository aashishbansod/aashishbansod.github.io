"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  FolderKanban,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
  Code2,
  CalendarCheck,
  UserPlus,
} from "lucide-react";

type Student = {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  domain: string;
  status: string;
  paymentStatus: string;
  createdAt: string | null;
};

type DashboardStats = {
  totalStudents: number;
  activeStudents: number;
  pendingApplications: number;
  pendingOperationsApprovals: number;
  failedStudents: number;
  paidEnrollments: number;
  pendingPayments: number;
};

type DashboardViewer = {
  id: string;
  identifier: string;
  role: string;
};

type DashboardResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: {
    stats?: Partial<DashboardStats>;
    recentStudents?: Partial<Student>[];
    generatedAt?: string;
    statistics?: {
      totalStudents?: number;
      activeOperationsStudents?: number;
      pendingReviewStudents?: number;
      paidStudents?: number;
      rejectedStudents?: number;
    };
    students?: Partial<Student>[];
    pagination?: {
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
    };
    viewer?: Partial<DashboardViewer>;
  };
};

type MetricCardProps = {
  title: string;
  value: number;
  description: string;
  icon: typeof Users;
  tone: string;
  loading: boolean;
  href: string;
};

const API_URL = "/api/student-admin/dashboard";
const REFRESH_INTERVAL = 30_000;
const PAGE_SIZE = 10;

const EMPTY_STATS: DashboardStats = {
  totalStudents: 0,
  activeStudents: 0,
  pendingApplications: 0,
  pendingOperationsApprovals: 0,
  failedStudents: 0,
  paidEnrollments: 0,
  pendingPayments: 0,
};

const QUICK_LINKS = [
  {
    label: "Manage students",
    detail: "View student profiles and records",
    href: "/student-admin/students",
    icon: Users,
  },
  {
    label: "Review applications",
    detail: "Check application progress",
    href: "/student-admin/applications",
    icon: FileText,
  },
  {
    label: "Manage internships",
    detail: "Track internship enrollment",
    href: "/student-admin/internships",
    icon: BriefcaseBusiness,
  },
  {
    label: "Payment records",
    detail: "Review payment status",
    href: "/student-admin/payments",
    icon: CreditCard,
  },
  {
    label: "Certificates",
    detail: "Review certificate records",
    href: "/student-admin/certificates",
    icon: Award,
  },
  {
    label: "Operations reports",
    detail: "Open operational reports",
    href: "/student-admin/reports",
    icon: BarChart3,
  },
];

function asNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function asText(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStudent(value: Partial<Student>, index: number): Student {
  return {
    id: asText(value.id, asText(value.studentId, `student-${index}`)),
    studentId: asText(value.studentId),
    fullName: asText(value.fullName, "Unnamed student"),
    email: asText(value.email),
    domain: asText(value.domain),
    status: asText(value.status, "Unknown"),
    paymentStatus: asText(value.paymentStatus, "Unknown"),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synchronized";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusClasses(value: string): string {
  const status = value.toLowerCase().replace(/[_\s-]+/g, "");
  if (["active", "approved", "paid", "completed", "verified", "success"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["rejected", "failed", "suspended", "cancelled", "inactive"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (["pending", "underreview", "processing", "unassigned", "initiated"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${getStatusClasses(value)}`}>
      <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
      <span className="truncate">{value.replace(/[_-]+/g, " ")}</span>
    </span>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
  loading,
  href,
}: MetricCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_3px_16px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          {loading ? (
            <div className="mt-3 h-9 w-24 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {formatNumber(value)}
            </p>
          )}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
          <Icon size={20} strokeWidth={2.1} />
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <p className="text-[11px] leading-5 text-slate-500">{description}</p>
        <ArrowUpRight size={16} className="shrink-0 text-slate-300 transition group-hover:text-blue-600" />
      </div>
    </Link>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="grid grid-cols-2 gap-4 px-5 py-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((__, cell) => (
            <div key={cell} className="h-4 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

function getInitials(value: string): string {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function StudentAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [students, setStudents] = useState<Student[]>([]);
  const [viewer, setViewer] = useState<DashboardViewer | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const requestController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  const initials = useMemo(
    () => getInitials(viewer?.identifier || "Student Admin") || "SA",
    [viewer],
  );

  const loadDashboard = useCallback(async (showLoader = false) => {
    requestController.current?.abort();

    const controller = new AbortController();
    requestController.current = controller;
    const sequence = ++requestSequence.current;

    if (showLoader) setLoading(true);
    else setRefreshing(true);

    setError("");

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });

    if (appliedSearch) params.set("search", appliedSearch);

    try {
      const response = await fetch(`${API_URL}?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      const result = (await response.json().catch(() => null)) as DashboardResponse | null;

      if (response.status === 401 || response.status === 403) {
        window.location.replace("/login?mode=student-admin&next=%2Fstudent-admin%2Fdashboard");
        return;
      }

      if (!response.ok || !result?.success || !result.data) {
        throw new Error(result?.message || `Dashboard request failed (${response.status}).`);
      }

      if (controller.signal.aborted || sequence !== requestSequence.current) return;

      const data = result.data;
      const rawStats = data.stats || {};
      const legacyStats = data.statistics || {};

      setStats({
        totalStudents: asNonNegativeNumber(
          rawStats.totalStudents,
          asNonNegativeNumber(legacyStats.totalStudents),
        ),
        activeStudents: asNonNegativeNumber(
          rawStats.activeStudents,
          asNonNegativeNumber(legacyStats.activeOperationsStudents),
        ),
        pendingApplications: asNonNegativeNumber(rawStats.pendingApplications),
        pendingOperationsApprovals: asNonNegativeNumber(
          rawStats.pendingOperationsApprovals,
          asNonNegativeNumber(legacyStats.pendingReviewStudents),
        ),
        failedStudents: asNonNegativeNumber(
          rawStats.failedStudents,
          asNonNegativeNumber(legacyStats.rejectedStudents),
        ),
        paidEnrollments: asNonNegativeNumber(
          rawStats.paidEnrollments,
          asNonNegativeNumber(legacyStats.paidStudents),
        ),
        pendingPayments: asNonNegativeNumber(rawStats.pendingPayments),
      });

      const records = Array.isArray(data.recentStudents)
        ? data.recentStudents
        : Array.isArray(data.students)
          ? data.students
          : [];

      setStudents(records.map((student, index) => normalizeStudent(student, index)));

      const rawViewer = data.viewer;
      setViewer(
        rawViewer
          ? {
              id: asText(rawViewer.id, ""),
              identifier: asText(rawViewer.identifier, "Student Admin"),
              role: asText(rawViewer.role, "Student Operations Admin"),
            }
          : null,
      );

      const pagination = data.pagination || {};
      setTotal(asNonNegativeNumber(pagination.total, records.length));
      setTotalPages(
        asNonNegativeNumber(
          pagination.totalPages,
          records.length >= PAGE_SIZE ? Math.ceil(records.length / PAGE_SIZE) : 1,
        ),
      );
      setLastUpdated(
        typeof data.generatedAt === "string" && !Number.isNaN(Date.parse(data.generatedAt))
          ? data.generatedAt
          : new Date().toISOString(),
      );
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      console.error("[STUDENT ADMIN DASHBOARD]", requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to synchronize dashboard data.",
      );
    } finally {
      if (!controller.signal.aborted && sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, appliedSearch]);

  useEffect(() => {
    void loadDashboard(true);
    return () => requestController.current?.abort();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadDashboard(false);
    }, REFRESH_INTERVAL);

    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function clearSearch() {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  }

  const updatedLabel = lastUpdated ? formatDateTime(lastUpdated) : "Not synchronized";
  const currentYear = new Date().getFullYear();
  const metrics: MetricCardProps[] = [
    {
      title: "Total students",
      value: stats.totalStudents,
      description: "Student records in the operations workspace.",
      icon: Users,
      tone: "bg-blue-50 text-blue-600",
      loading,
      href: "/student-admin/students",
    },
    {
      title: "Active students",
      value: stats.activeStudents,
      description: "Students currently marked as active.",
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
      loading,
      href: "/student-admin/students",
    },
    {
      title: "Pending applications",
      value: stats.pendingApplications,
      description: "Applications awaiting the next review step.",
      icon: FileText,
      tone: "bg-amber-50 text-amber-600",
      loading,
      href: "/student-admin/applications",
    },
    {
      title: "Pending approvals",
      value: stats.pendingOperationsApprovals,
      description: "Students awaiting operations approval.",
      icon: ClipboardCheck,
      tone: "bg-violet-50 text-violet-600",
      loading,
      href: "/student-admin/applications",
    },
    {
      title: "Paid enrollments",
      value: stats.paidEnrollments,
      description: "Student records marked as paid.",
      icon: CreditCard,
      tone: "bg-cyan-50 text-cyan-700",
      loading,
      href: "/student-admin/payments",
    },
    {
      title: "Pending payments",
      value: stats.pendingPayments,
      description: "Payments awaiting confirmation.",
      icon: Activity,
      tone: "bg-orange-50 text-orange-600",
      loading,
      href: "/student-admin/payments",
    },
    {
      title: "Rejected students",
      value: stats.failedStudents,
      description: "Records marked as rejected or failed.",
      icon: AlertCircle,
      tone: "bg-rose-50 text-rose-600",
      loading,
      href: "/student-admin/students",
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6">
      <section className="relative isolate overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_35px_rgba(15,23,42,0.045)] sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 -z-10 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute right-32 top-20 -z-10 h-40 w-40 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.12em] text-blue-700">
              <Activity size={13} />
              STUDENT OPERATIONS OVERVIEW
            </span>
            <h2 className="mt-5 max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-4xl lg:text-[46px]">
              Your operations,
              <span className="block text-blue-600">all in one place.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
              Monitor student records, application progress, approvals and payments from your Student Operations workspace.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-500">
                <ShieldCheck size={14} className="text-emerald-600" />
                {viewer?.role || "Student Operations Admin"}
              </span>
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-500">
                Last sync: {updatedLabel}
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[22px] bg-[#07152f] p-5 text-white shadow-xl shadow-blue-950/15 sm:p-6">
            <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full border-[24px] border-blue-500/10" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.16em] text-cyan-200">
                  <Activity size={14} />
                  DATA SYNCHRONIZATION
                </p>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold ${error ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300"}`}>
                  {error ? "ATTENTION" : loading ? "CONNECTING" : "ACTIVE"}
                </span>
              </div>
              <p className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">
                {loading ? "Connecting..." : error ? "Sync required" : "Workspace online"}
              </p>
              <p className="mt-2 max-w-xs text-[11px] leading-5 text-blue-100/65">
                {error
                  ? "The dashboard could not retrieve the latest API response."
                  : "Dashboard metrics are loaded from the Student Operations dashboard API."}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-blue-100/55">Total records</p>
                  <p className="mt-1 text-xl font-black">{loading ? "—" : formatNumber(stats.totalStudents)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-blue-100/55">Active students</p>
                  <p className="mt-1 text-xl font-black">{loading ? "—" : formatNumber(stats.activeStudents)}</p>
                </div>
              </div>
              <p className="mt-4 text-[9px] text-blue-100/45">
                API status only · Database storage usage is not provided by this endpoint
              </p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle size={19} className="mt-0.5 shrink-0 text-rose-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-rose-800">Dashboard synchronization failed</p>
              <p className="mt-1 break-words text-xs leading-5 text-rose-700">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white transition hover:bg-rose-700"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {metrics.slice(0, 4).map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.slice(4).map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_3px_16px_rgba(15,23,42,0.035)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Student operations</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Recent student records</h2>
              <p className="mt-1 text-xs text-slate-500">
                {loading ? "Loading student records..." : `${formatNumber(total)} total records`}
              </p>
            </div>
            <form onSubmit={handleSearch} className="flex w-full gap-2 sm:max-w-[360px]">
              <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <Search size={15} className="shrink-0 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search students..."
                  maxLength={120}
                  aria-label="Search student records"
                  className="w-full min-w-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
                />
                {search ? (
                  <button type="button" aria-label="Clear search" onClick={clearSearch} className="text-slate-400 hover:text-slate-700">
                    <X size={14} />
                  </button>
                ) : null}
              </label>
              <button
                type="submit"
                disabled={loading}
                className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 text-[9px] font-extrabold uppercase tracking-[0.13em] text-slate-500">
                  <th scope="col" className="px-5 py-4">Student</th>
                  <th scope="col" className="px-5 py-4">Student ID</th>
                  <th scope="col" className="px-5 py-4">Domain</th>
                  <th scope="col" className="px-5 py-4">Status</th>
                  <th scope="col" className="px-5 py-4">Payment</th>
                  <th scope="col" className="px-5 py-4">Joined</th>
                </tr>
              </thead>
              {!loading && students.length > 0 ? (
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => (
                    <tr key={student.id} className="transition hover:bg-blue-50/30">
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[10px] font-black text-blue-700">
                            {getInitials(student.fullName) || "ST"}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[190px] truncate text-xs font-bold text-slate-900">{student.fullName}</span>
                            <span className="mt-1 block max-w-[190px] truncate text-[10px] text-slate-500">{student.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">{student.studentId}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{student.domain}</td>
                      <td className="px-5 py-4"><StatusBadge value={student.status} /></td>
                      <td className="px-5 py-4"><StatusBadge value={student.paymentStatus} /></td>
                      <td className="px-5 py-4 text-xs text-slate-500">{formatDate(student.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              ) : null}
            </table>

            {loading ? <LoadingRows /> : null}

            {!loading && students.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Users size={21} />
                </span>
                <h3 className="mt-4 text-sm font-bold text-slate-800">
                  {appliedSearch ? "No matching students" : "No student records yet"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {appliedSearch
                    ? "Try another name, email or student ID."
                    : "Student records will appear here when available."}
                </p>
                {appliedSearch ? (
                  <button type="button" onClick={clearSearch} className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700">
                    Clear search
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-slate-500">
              {loading
                ? "Synchronizing records..."
                : total === 0
                  ? "No records"
                  : `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, total)}–${Math.min(page * PAGE_SIZE, total)} of ${formatNumber(total)}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="min-w-[64px] text-center text-[10px] font-bold text-slate-600">
                {totalPages > 0 ? `${page} / ${totalPages}` : "0 / 0"}
              </span>
              <button
                type="button"
                disabled={loading || totalPages === 0 || page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_3px_16px_rgba(15,23,42,0.035)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.17em] text-blue-600">Quick access</p>
                <h2 className="mt-1 text-base font-black text-slate-950">Manage workspace</h2>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ArrowRight size={17} />
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {QUICK_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-blue-100 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-700">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-800">{item.label}</span>
                      <span className="mt-1 block truncate text-[10px] text-slate-500">{item.detail}</span>
                    </span>
                    <ArrowUpRight size={14} className="shrink-0 text-slate-300 transition group-hover:text-blue-600" />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 to-blue-950 p-5 text-white shadow-lg shadow-blue-900/10">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <ShieldCheck size={20} />
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-bold tracking-wide text-blue-100">
                ACCESS CONTROL
              </span>
            </div>
            <h2 className="mt-5 text-lg font-black">Student Operations</h2>
            <p className="mt-2 text-xs leading-5 text-blue-100/75">
              This workspace displays information returned by the Student Admin dashboard service. Access permissions must continue to be enforced by the server APIs.
            </p>
            <div className="mt-5 border-t border-white/15 pt-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-blue-100/55">Signed-in account</p>
              <p className="mt-1 truncate text-xs font-bold">{viewer?.identifier || "Loading account..."}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-700">
              <Activity size={16} className="text-blue-600" />
              <h2 className="text-xs font-bold">Workspace modules</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: "Internships", icon: BriefcaseBusiness },
                { label: "Assessments", icon: ClipboardCheck },
                { label: "Placement", icon: GraduationCap },
                { label: "Projects", icon: FolderKanban },
                { label: "Coding", icon: Code2 },
                { label: "Tasks", icon: CalendarCheck },
                { label: "Registration", icon: UserPlus },
                { label: "Settings", icon: ShieldCheck },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                    <Icon size={13} className="shrink-0 text-slate-400" />
                    <span className="truncate text-[10px] font-semibold text-slate-600">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </section>

      <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-[10px] text-slate-400 sm:flex-row sm:items-center">
        <p>© {currentYear} CyberNet Careers · Student Operations</p>
        <p className="flex items-center gap-2"><ShieldCheck size={13} /> Protected administrative workspace</p>
      </footer>

      {refreshing ? (
        <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-xl">
          <LoaderCircle size={15} className="animate-spin text-blue-600" />
          Synchronizing dashboard
        </div>
      ) : null}
    </div>
  );
}
