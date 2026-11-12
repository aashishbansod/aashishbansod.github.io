"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  Filter,
  GraduationCap,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";

const API_URL = "/api/admin/students";
const REFRESH_MS = 30_000;
const PAGE_SIZES = [10, 20, 50, 100] as const;

type StatusFilter =
  | "all"
  | "active"
  | "pending"
  | "inactive"
  | "verified"
  | "assessment_passed"
  | "assessment_failed";

type SortKey = "fullName" | "studentId" | "email" | "createdAt";
type SortDirection = "asc" | "desc";

interface Student {
  _id?: string;
  applicationId?: string;
  studentId?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  collegeName?: string;
  university?: string;
  course?: string;
  branchStream?: string;
  year?: string;
  semester?: string;
  graduationYear?: string;
  internshipTrack?: string;
  internshipPlan?: string;
  internshipStatus?: string;
  applicationStatus?: string;
  assessmentStatus?: string;
  assessmentScore?: number | null;
  resultStatus?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  adminApprovalStatus?: string;
  dashboardStatus?: string;
  loginEnabled?: boolean;
  accountLocked?: boolean;
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface Stats {
  totalStudents: number;
  activeStudents: number;
  pending: number;
  verified: number;
  approved: number;
  rejected: number;
  paid: number;
  assessmentPassed: number;
  assessmentFailed: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ApiPayload {
  success?: boolean;
  message?: string;
  code?: string;
  data?: {
    students?: Student[];
    pagination?: Partial<Pagination>;
    stats?: Partial<Stats>;
  };
}

const EMPTY_STATS: Stats = {
  totalStudents: 0,
  activeStudents: 0,
  pending: 0,
  verified: 0,
  approved: 0,
  rejected: 0,
  paid: 0,
  assessmentPassed: 0,
  assessmentFailed: 0,
};

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function safeText(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function studentName(student: Student): string {
  return safeText(student.fullName, safeText(student.name, "Unnamed student"));
}

function studentIdentifier(student: Student): string {
  return safeText(
    student.studentId,
    safeText(student.applicationId, "Not assigned"),
  );
}

function studentDomain(student: Student): string {
  return safeText(
    student.internshipTrack,
    safeText(student.internshipPlan, "Not selected"),
  );
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizedStatus(value: unknown): string {
  return safeText(value, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function accountStatus(student: Student): string {
  if (student.accountLocked) return "Locked";
  if (student.loginEnabled === true) return "Active";
  const status = normalizedStatus(
    student.applicationStatus || student.adminApprovalStatus,
  );
  if (status === "rejected") return "Rejected";
  if (status === "approved") return "Approved";
  if (status === "under_review") return "Under review";
  if (status === "pending") return "Pending";
  return "Inactive";
}

function assessmentStatus(student: Student): string {
  const status = normalizedStatus(
    student.assessmentStatus || student.resultStatus,
  );
  if (["passed", "pass"].includes(status)) return "Passed";
  if (["failed", "fail"].includes(status)) return "Failed";
  if (["active", "in_progress", "started"].includes(status)) {
    return "In progress";
  }
  if (["not_started", "pending", "scheduled"].includes(status)) {
    return "Not started";
  }
  if (["submitted", "evaluated"].includes(status)) return "Submitted";
  return "Not recorded";
}

function statusClasses(status: string): string {
  const value = status.toLowerCase();
  if (["active", "passed", "paid", "verified", "approved"].includes(value)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["failed", "rejected", "locked"].includes(value)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (["pending", "under review", "in progress", "not started"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function csvCell(value: unknown): string {
  let content = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(content)) content = `'${content}`;
  return `"${content.replace(/"/g, '""')}"`;
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof Users;
  tone: "blue" | "green" | "amber" | "teal" | "rose" | "slate";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {value.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">
            {description}
          </p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100 ${
        active ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      {content}
    </button>
  );
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof UserRound;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <p className="mt-1.5 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClasses(value)}`}>
      {value}
    </span>
  );
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notice, setNotice] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const detailCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadStudents = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestId = ++requestRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError("");
      setNotice("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      try {
        const response = await fetch(`${API_URL}?${params.toString()}`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
        });

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().includes("application/json")) {
          throw new Error(`Unexpected server response (${response.status}).`);
        }

        const payload = (await response.json()) as ApiPayload;
        if (!response.ok || payload.success !== true) {
          throw new Error(
            payload.message || `Unable to load students (${response.status}).`,
          );
        }

        if (requestId !== requestRef.current) return;

        const data = payload.data;
        setStudents(Array.isArray(data?.students) ? data.students : []);

        const rawStats = data?.stats ?? {};
        setStats({
          totalStudents: safeNumber(rawStats.totalStudents),
          activeStudents: safeNumber(rawStats.activeStudents),
          pending: safeNumber(rawStats.pending),
          verified: safeNumber(rawStats.verified),
          approved: safeNumber(rawStats.approved),
          rejected: safeNumber(rawStats.rejected),
          paid: safeNumber(rawStats.paid),
          assessmentPassed: safeNumber(rawStats.assessmentPassed),
          assessmentFailed: safeNumber(rawStats.assessmentFailed),
        });

        const rawPage = data?.pagination ?? {};
        setPagination({
          page: safeNumber(rawPage.page) || page,
          limit: safeNumber(rawPage.limit) || pageSize,
          total: safeNumber(rawPage.total),
          totalPages: safeNumber(rawPage.totalPages),
          hasNextPage: rawPage.hasNextPage === true,
          hasPreviousPage: rawPage.hasPreviousPage === true,
        });
        setLastUpdated(new Date());
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        if (requestId !== requestRef.current) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load student records.",
        );
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, pageSize, search, statusFilter],
  );

  useEffect(() => {
    void loadStudents("initial");
    return () => abortRef.current?.abort();
  }, [loadStudents]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadStudents("refresh");
      }
    }, REFRESH_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadStudents("refresh");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadStudents]);

  useEffect(() => {
    if (!selectedStudent) return;
    detailCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedStudent(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedStudent]);

  const sortedStudents = useMemo(() => {
    const result = [...students];
    result.sort((left, right) => {
      const values: Record<SortKey, [string, string]> = {
        fullName: [
          studentName(left).toLocaleLowerCase(),
          studentName(right).toLocaleLowerCase(),
        ],
        studentId: [
          studentIdentifier(left).toLocaleLowerCase(),
          studentIdentifier(right).toLocaleLowerCase(),
        ],
        email: [
          safeText(left.email, "").toLocaleLowerCase(),
          safeText(right.email, "").toLocaleLowerCase(),
        ],
        createdAt: [left.createdAt || "", right.createdAt || ""],
      };
      const [a, b] = values[sortKey];
      const comparison = a.localeCompare(b, undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return result;
  }, [students, sortKey, sortDirection]);

  const exportCsv = useCallback(() => {
    if (!sortedStudents.length) return;

    const rows = [
      [
        "Name",
        "Student ID",
        "Email",
        "Phone",
        "College",
        "Course",
        "Domain",
        "Account status",
        "Assessment result",
        "Assessment score",
        "Payment status",
        "Dashboard status",
        "Registered",
      ],
      ...sortedStudents.map((student) => [
        studentName(student),
        studentIdentifier(student),
        safeText(student.email, ""),
        safeText(student.phone, ""),
        safeText(student.collegeName, safeText(student.university, "")),
        safeText(student.course, ""),
        studentDomain(student),
        accountStatus(student),
        assessmentStatus(student),
        student.assessmentScore ?? "",
        safeText(student.paymentStatus, ""),
        safeText(student.dashboardStatus, ""),
        formatDate(student.createdAt),
      ]),
    ];

    const csv = rows
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cybernet-students-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Current page exported successfully.");
  }, [sortedStudents]);

  const selectStatus = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const changeSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "createdAt" ? "desc" : "asc");
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  const visibleStart =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;
  const visibleEnd = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  const metrics = [
    {
      label: "Total students",
      value: stats.totalStudents,
      description: "All registered student records",
      icon: Users,
      tone: "blue" as const,
      filter: "all" as StatusFilter,
    },
    {
      label: "Active students",
      value: stats.activeStudents,
      description: "Login-enabled accounts",
      icon: Activity,
      tone: "green" as const,
      filter: "active" as StatusFilter,
    },
    {
      label: "Assessment passed",
      value: stats.assessmentPassed,
      description: "Students with a passing result",
      icon: CheckCircle2,
      tone: "teal" as const,
      filter: "assessment_passed" as StatusFilter,
    },
    {
      label: "Assessment failed",
      value: stats.assessmentFailed,
      description: "Students with a failed result",
      icon: XCircle,
      tone: "rose" as const,
      filter: "assessment_failed" as StatusFilter,
    },
    {
      label: "Pending students",
      value: stats.pending,
      description: "Awaiting application review",
      icon: Clock3,
      tone: "amber" as const,
      filter: "pending" as StatusFilter,
    },
    {
      label: "Email verified",
      value: stats.verified,
      description: "Email verification completed",
      icon: BadgeCheck,
      tone: "slate" as const,
      filter: "verified" as StatusFilter,
    },
  ];

  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => changeSort(key)}
      className="inline-flex items-center gap-1.5 transition hover:text-blue-700"
    >
      {label}
      {sortKey === key ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : null}
    </button>
  );

  return (
    <div className="min-h-full bg-[#f4f7fc] text-slate-900">
      <main className="mx-auto w-full max-w-[1700px] space-y-5 px-3 py-4 sm:px-5 lg:px-7 lg:py-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Admin workspace · CyberNet Careers
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Students
                </h1>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">
                  Student directory
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Manage registered student records, account activity, assessment
                progress and verification status from one workspace.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Live database connection
                </span>
                <span>
                  {lastUpdated
                    ? `Last synced ${lastUpdated.toLocaleTimeString("en-IN")}`
                    : "Waiting for first sync"}
                </span>
                <span>Auto-refresh every 30 seconds</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadStudents("refresh")}
                disabled={refreshing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!sortedStudents.length || loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Export current page
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70 sm:grid-cols-4">
            <div className="border-r border-slate-100 px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Approved
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {stats.approved.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="border-r border-slate-100 px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Rejected
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {stats.rejected.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="border-r border-slate-100 px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Payments received
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {stats.paid.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Matching records
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {pagination.total.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-label="Student statistics"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              {...metric}
              active={statusFilter === metric.filter}
              onClick={() => selectStatus(metric.filter)}
            />
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, Student ID, email, college or domain..."
                aria-label="Search students"
                maxLength={120}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setPage(1);
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500">
                <SlidersHorizontal className="h-4 w-4" />
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    selectStatus(event.target.value as StatusFilter)
                  }
                  aria-label="Filter students by status"
                  className="max-w-[190px] bg-transparent text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="all">All students</option>
                  <option value="active">Active accounts</option>
                  <option value="pending">Pending review</option>
                  <option value="inactive">Inactive accounts</option>
                  <option value="verified">Email verified</option>
                  <option value="assessment_passed">Assessment passed</option>
                  <option value="assessment_failed">Assessment failed</option>
                </select>
              </label>

              <label className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500">
                <Filter className="h-4 w-4" />
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  aria-label="Rows per page"
                  className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} per page
                    </option>
                  ))}
                </select>
              </label>

              {(searchInput || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-12 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>
              Showing{" "}
              <strong className="text-slate-800">
                {visibleStart}–{visibleEnd}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-800">
                {pagination.total.toLocaleString("en-IN")}
              </strong>{" "}
              matching records
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {refreshing ? "Synchronizing..." : "Live database data"}
            </span>
          </div>
        </section>

        {error ? (
          <section
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Unable to synchronize student records</p>
              <p className="mt-1 break-words text-sm">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadStudents("refresh")}
              className="shrink-0 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-800"
            >
              Retry
            </button>
          </section>
        ) : null}

        {notice ? (
          <section
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          >
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {notice}
            </span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
              className="rounded-md p-1 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Users className="h-4 w-4" />
                </div>
                <h2 className="font-black text-slate-950">Student directory</h2>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Student account, assessment and payment information.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {pagination.total.toLocaleString("en-IN")} records
            </span>
          </div>

          {loading ? (
            <div className="space-y-3 p-5" aria-label="Loading students">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="h-[66px] animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-black text-slate-800">
                No matching students
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                {error
                  ? "Resolve the API error and refresh the records."
                  : "No student records match the current search or filters."}
              </p>
              {(search || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px]">
                <thead className="bg-slate-50/90 text-left">
                  <tr>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {sortButton("fullName", "Student")}
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {sortButton("studentId", "Student ID")}
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {sortButton("email", "Contact")}
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {sortButton("createdAt", "Registered")}
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Account
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Assessment
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Internship / Payment
                    </th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedStudents.map((student, index) => {
                    const account = accountStatus(student);
                    const assessment = assessmentStatus(student);
                    return (
                      <tr
                        key={
                          student._id ||
                          student.studentId ||
                          student.applicationId ||
                          `${studentName(student)}-${index}`
                        }
                        className="transition hover:bg-blue-50/35"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-sm font-black text-blue-700">
                              {studentName(student)
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part[0] || "")
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[210px] truncate text-sm font-bold text-slate-900">
                                {studentName(student)}
                              </p>
                              <p className="mt-1 max-w-[210px] truncate text-xs text-slate-400">
                                {safeText(
                                  student.collegeName,
                                  safeText(student.university, "College not provided"),
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700">
                            {studentIdentifier(student)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="max-w-[210px] truncate text-xs font-semibold text-slate-700">
                            {safeText(student.email, "No email")}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {safeText(student.phone, "No phone")}
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
                            {student.emailVerified ? (
                              <BadgeCheck className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                            {student.emailVerified ? "Email verified" : "Email unverified"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-600">
                          {formatDate(student.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill value={account} />
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill value={assessment} />
                          {student.assessmentScore != null ? (
                            <p className="mt-1.5 text-[10px] text-slate-400">
                              Score: {student.assessmentScore}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <p className="max-w-[180px] truncate text-xs font-semibold text-slate-700">
                            {studentDomain(student)}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Payment: {safeText(student.paymentStatus, "Not recorded")}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(student)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View profile
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && pagination.totalPages > 1 ? (
            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Page{" "}
                <strong className="text-slate-800">{pagination.page}</strong>{" "}
                of{" "}
                <strong className="text-slate-800">
                  {pagination.totalPages}
                </strong>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPreviousPage || page <= 1}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {selectedStudent ? (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedStudent(null);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-profile-title"
              className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/50 bg-white shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 p-5 backdrop-blur sm:p-6">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white">
                    {studentName(selectedStudent)
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0] || "")
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                      Student profile
                    </p>
                    <h2
                      id="student-profile-title"
                      className="mt-1 truncate text-xl font-black text-slate-950"
                    >
                      {studentName(selectedStudent)}
                    </h2>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {safeText(selectedStudent.email)}
                    </p>
                  </div>
                </div>
                <button
                  ref={detailCloseRef}
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  aria-label="Close student profile"
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap gap-2">
                  <StatusPill value={accountStatus(selectedStudent)} />
                  <StatusPill value={assessmentStatus(selectedStudent)} />
                  <StatusPill
                    value={
                      selectedStudent.emailVerified
                        ? "Verified"
                        : "Unverified"
                    }
                  />
                </div>

                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    <UserRound className="h-4 w-4 text-blue-600" />
                    Personal information
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Student ID" value={studentIdentifier(selectedStudent)} />
                    <Detail label="Application ID" value={safeText(selectedStudent.applicationId)} />
                    <Detail label="Email address" value={safeText(selectedStudent.email)} icon={Mail} />
                    <Detail label="Phone number" value={safeText(selectedStudent.phone)} />
                    <Detail label="Registered" value={formatDateTime(selectedStudent.createdAt)} icon={CalendarDays} />
                    <Detail label="Last updated" value={formatDateTime(selectedStudent.updatedAt)} icon={CalendarDays} />
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                    Academic information
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label="College" value={safeText(selectedStudent.collegeName, safeText(selectedStudent.university))} icon={Building2} />
                    <Detail label="University" value={safeText(selectedStudent.university)} />
                    <Detail label="Course" value={safeText(selectedStudent.course)} />
                    <Detail label="Branch / Stream" value={safeText(selectedStudent.branchStream)} />
                    <Detail label="Year" value={safeText(selectedStudent.year)} />
                    <Detail label="Semester" value={safeText(selectedStudent.semester)} />
                    <Detail label="Graduation year" value={safeText(selectedStudent.graduationYear)} />
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    <BookOpenCheck className="h-4 w-4 text-blue-600" />
                    Internship and assessment
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Internship domain" value={studentDomain(selectedStudent)} />
                    <Detail label="Internship plan" value={safeText(selectedStudent.internshipPlan)} />
                    <Detail label="Internship status" value={safeText(selectedStudent.internshipStatus)} />
                    <Detail label="Assessment status" value={assessmentStatus(selectedStudent)} />
                    <Detail label="Assessment score" value={selectedStudent.assessmentScore == null ? "Not recorded" : String(selectedStudent.assessmentScore)} />
                    <Detail label="Result status" value={safeText(selectedStudent.resultStatus)} />
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Account and payment
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Login status" value={accountStatus(selectedStudent)} />
                    <Detail label="Account locked" value={selectedStudent.accountLocked ? "Yes" : "No"} />
                    <Detail label="Must change password" value={selectedStudent.mustChangePassword ? "Yes" : "No"} />
                    <Detail label="Dashboard status" value={safeText(selectedStudent.dashboardStatus)} />
                    <Detail label="Payment status" value={safeText(selectedStudent.paymentStatus)} icon={CircleDollarSign} />
                    <Detail
                      label="Payment amount"
                      value={
                        selectedStudent.paymentAmount == null
                          ? "Not recorded"
                          : `${safeText(selectedStudent.paymentCurrency, "INR")} ${selectedStudent.paymentAmount.toLocaleString("en-IN")}`
                      }
                    />
                    <Detail label="Admin approval" value={safeText(selectedStudent.adminApprovalStatus)} />
                  </div>
                </section>
              </div>

              <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 p-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  Close profile
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
