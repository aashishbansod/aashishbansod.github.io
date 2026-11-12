
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  Filter,
  GraduationCap,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";

type StudentRecord = {
  id: string;
  studentId?: string;
  dashboardStudentId?: string;
  applicationId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  applicationStatus?: string;
  adminApprovalStatus?: string;
  assessmentStatus?: string;
  resultStatus?: string;
  internshipStatus?: string;
  internshipPlan?: string;
  internshipTrack?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  studentOpsApprovalStatus?: string;
  studentOpsStatus?: string;
  dashboardStatus?: string;
  dashboardLoginEnabled?: boolean;
  dashboardCredentialsGenerated?: boolean;
  dateOfBirth?: string | null;
  internshipId?: string;
  planCode?: string;
  durationMonths?: number;
  dashboardExpiresAt?: string | null;
  credentialEmailStatus?: string;
  credentialsIssuedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: {
    students?: StudentRecord[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
  students?: StudentRecord[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  requestId?: string;
};

type QueueTab = "pending" | "approved" | "rejected" | "all";
type ModalMode = "details" | "approve" | "reject" | null;

const API_URL = "/api/student-admin/applications";
const PAGE_SIZE = 25;
const REFRESH_INTERVAL = 30000;

function clean(value: unknown, fallback = "—"): string {
  if (typeof value !== "string") return fallback;
  const result = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return result || fallback;
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalized(value: unknown): string {
  return clean(value, "pending").toLowerCase().replace(/[_-]+/g, " ");
}

function formatDate(value?: string | null): string {
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

function formatCurrency(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Not available";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusClass(value: unknown): string {
  const status = normalized(value);

  if (["paid", "approved", "passed", "active", "completed"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["rejected", "failed", "suspended", "refunded"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (["pending", "submitted", "under review", "created"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusPill({ value }: { value?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(value)}`}>
      {clean(value, "Pending")}
    </span>
  );
}

function studentName(student: StudentRecord): string {
  return clean(student.fullName, "Student");
}

function isPaymentVerified(student: StudentRecord): boolean {
  return ["paid", "success", "verified", "captured"].includes(normalized(student.paymentStatus));
}

function isAssessmentPassed(student: StudentRecord): boolean {
  const status = normalized(student.assessmentStatus || student.resultStatus);
  return ["passed", "pass", "completed"].includes(status);
}

function planDuration(student: StudentRecord): string {
  const months = numeric(student.durationMonths);
  if ([1, 3, 6].includes(months)) return `${months} month${months === 1 ? "" : "s"}`;
  const source = `${student.internshipPlan || ""} ${student.planCode || ""}`.toLowerCase();
  if (/six|6.month|six.month/.test(source)) return "6 months";
  if (/three|3.month|three.month/.test(source)) return "3 months";
  if (/one|1.month|one.month/.test(source)) return "1 month";
  return clean(student.internshipPlan, "Plan not recorded");
}

function canApproveStudent(student: StudentRecord): boolean {
  return isPaymentVerified(student) &&
    Boolean(clean(student.internshipTrack || student.internshipPlan, "")) &&
    Boolean(student.email?.trim());
}

function buildQuery(tab: QueueTab, page: number, search: string): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });

  if (search.trim()) params.set("search", search.trim());

  if (tab === "pending") {
    params.set("studentOpsApprovalStatus", "pending");
  } else if (tab === "approved") {
    params.set("studentOpsApprovalStatus", "approved");
  } else if (tab === "rejected") {
    params.set("studentOpsApprovalStatus", "rejected");
  }

  return params.toString();
}

function extractData(result: ApiResponse) {
  const data = result.data ?? result;
  return {
    students: Array.isArray(data.students) ? data.students : [],
    total: numeric(data.total),
    totalPages: numeric(data.totalPages),
  };
}

export default function StudentAdminApplicationsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [activeTab, setActiveTab] = useState<QueueTab>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [requestId, setRequestId] = useState("");
  const sequence = useRef(0);

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    const current = ++sequence.current;
    setRefreshing(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}?${buildQuery(activeTab, page, search)}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal,
        }
      );

      const result = (await response.json().catch(() => null)) as ApiResponse | null;

      if (signal?.aborted || current !== sequence.current) return;

      if (response.status === 401 || response.status === 403) {
        setStudents([]);
        setTotal(0);
        setTotalPages(0);
        setError(
          response.status === 401
            ? "Your Student Operations session was not accepted by the API. Please sign in again only if your session has expired. The page has not redirected you."
            : "Your account does not have permission to access Student Operations applications."
        );
        setRequestId(clean(result?.requestId, ""));
        return;
      }

      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.message || `Unable to load applications (${response.status}).`
        );
      }

      const data = extractData(result);
      setStudents(data.students);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setRequestId(clean(result.requestId, ""));
      setLastUpdated(new Date());
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      if (signal?.aborted || current !== sequence.current) return;

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load student applications."
      );
    } finally {
      if (!signal?.aborted && current === sequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeTab, page, search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadApplications(controller.signal);
    return () => controller.abort();
  }, [loadApplications]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !modalMode) {
        void loadApplications();
      }
    }, REFRESH_INTERVAL);

    return () => window.clearInterval(timer);
  }, [loadApplications, modalMode]);

  const paidAmount = useMemo(
    () => students.reduce((sum, student) => sum + numeric(student.paymentAmount), 0),
    [students]
  );

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openDetails(student: StudentRecord) {
    setSelectedStudent(student);
    setModalMode("details");
    setRejectReason("");
  }

  function closeModal() {
    if (actionLoading) return;
    setModalMode(null);
    setSelectedStudent(null);
    setRejectReason("");
  }

  async function submitAction(action: "approve" | "reject") {
    if (!selectedStudent?.id) {
      setError("Student record ID is missing. Refresh the list and try again.");
      return;
    }

    if (action === "reject" && !rejectReason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }

    if (action === "approve" && !canApproveStudent(selectedStudent)) {
      setError("Approval is blocked: verified payment, selected internship plan/domain and student email must be present. Refresh the record and verify it in Payments before approval.");
      return;
    }

    setActionLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action,
          studentId: selectedStudent.id,
          ...(action === "reject" ? { reason: rejectReason.trim() } : {}),
        }),
      });

      const result = (await response.json().catch(() => null)) as ApiResponse | null;

      if (response.status === 401 || response.status === 403) {
        setError(
          response.status === 401
            ? "Your session was not accepted. No approval action was completed."
            : "You do not have permission to review this student."
        );
        return;
      }

      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || `Unable to ${action} this student.`);
      }

      setNotice(
        result.message ||
          (action === "approve"
            ? "Student Operations approval request completed."
            : "Student review rejection completed.")
      );

      setModalMode(null);
      setSelectedStudent(null);
      setRejectReason("");
      await loadApplications();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The requested action could not be completed."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function exportCurrentPage() {
    const headers = [
      "Student ID",
      "Application ID",
      "Name",
      "Email",
      "Phone",
      "Internship",
      "Assessment",
      "Payment Status",
      "Payment Amount",
      "Operations Approval",
      "Created At",
    ];

    const rows = students.map((student) => [
      student.studentId,
      student.applicationId,
      studentName(student),
      student.email,
      student.phone,
      student.internshipTrack || student.internshipPlan,
      student.assessmentStatus || student.resultStatus,
      student.paymentStatus,
      student.paymentAmount,
      student.studentOpsApprovalStatus,
      student.createdAt,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cybernet-applications-page-${page}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const tabs: { key: QueueTab; label: string }[] = [
    { key: "pending", label: "Pending review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All applications" },
  ];

  return (
    <main className="min-h-screen bg-[#f3f6fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">
                <FileCheck2 size={14} />
                Student Operations / Enrollment review
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Applications & verification
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Review verified payments, assessment outcomes, selected domain and 1 / 3 / 6-month plans. Approval triggers the server-side student dashboard credential workflow.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  API status
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-600">
                  {lastUpdated ? `Updated ${formatDate(lastUpdated.toISOString())}` : "Waiting for data"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-600">
                  Auto refresh: 30 seconds
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadApplications()}
                disabled={refreshing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-60"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportCurrentPage}
                disabled={students.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} />
                Export page
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Matching records</span>
              <span className="rounded-xl bg-blue-50 p-3 text-blue-600"><Users size={20} /></span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{total.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-xs text-slate-500">Records matching this filter</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Current page</span>
              <span className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><FileCheck2 size={20} /></span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{students.length}</p>
            <p className="mt-1 text-xs text-slate-500">Records currently loaded</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Paid amount on page</span>
              <span className="rounded-xl bg-violet-50 p-3 text-violet-600"><Banknote size={20} /></span>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">{formatCurrency(paidAmount)}</p>
            <p className="mt-1 text-xs text-slate-500">Sum of displayed payment amounts</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Review workflow</span>
              <span className="rounded-xl bg-amber-50 p-3 text-amber-600"><ShieldCheck size={20} /></span>
            </div>
            <p className="mt-3 text-lg font-black text-slate-950">Server validated</p>
            <p className="mt-1 text-xs text-slate-500">Approval is processed by the backend</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-950">Student applications</h2>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {total.toLocaleString("en-IN")} records
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Student Operations review queue. Main Admin approval remains a separate step.
                </p>
              </div>

              <form onSubmit={submitSearch} className="flex w-full gap-2 xl:max-w-xl">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search applications</span>
                  <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    maxLength={120}
                    placeholder="Search name, email, student ID..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <button type="submit" className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">
                  Search
                </button>
              </form>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      setPage(1);
                    }}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      activeTab === tab.key
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Filter size={14} />
                {activeTab === "pending" ? "Pending Operations review" : "Filtered student records"}
              </div>
            </div>
          </div>

          {notice && (
            <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 sm:mx-6">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p>{notice}</p>
              <button type="button" onClick={() => setNotice("")} className="ml-auto text-emerald-700"><X size={16} /></button>
            </div>
          )}

          {error && (
            <div className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:mx-6">
              <div className="flex items-start gap-3">
                <XCircle size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{error}</p>
                  {requestId && <p className="mt-1 text-xs text-rose-700">Request ID: {requestId}</p>}
                  <p className="mt-2 text-xs text-rose-700">
                    Your page session has not been redirected. Check the API authentication and server logs.
                  </p>
                </div>
                <button type="button" onClick={() => setError("")} className="text-rose-700"><X size={16} /></button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="rounded-2xl bg-blue-50 p-4 text-blue-600"><FileCheck2 size={30} /></div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">
                {error ? "Applications could not be loaded" : "No student records found"}
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                {error
                  ? "Resolve the API or session error, then refresh this page."
                  : "Students will appear here when their records match the selected review filter."}
              </p>
              <button
                type="button"
                onClick={() => void loadApplications()}
                className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1100px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-bold">Student</th>
                      <th className="px-5 py-4 font-bold">Domain & plan</th>
                      <th className="px-5 py-4 font-bold">Assessment</th>
                      <th className="px-5 py-4 font-bold">Payment</th>
                      <th className="px-5 py-4 font-bold">Operations review</th>
                      <th className="px-5 py-4 font-bold">Submitted</th>
                      <th className="px-6 py-4 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student) => (
                      <tr key={student.id} className="transition hover:bg-blue-50/40">
                        <td className="px-6 py-4">
                          <div className="flex min-w-[230px] items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">
                              {studentName(student).slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{studentName(student)}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">{clean(student.email)}</p>
                              <p className="mt-1 text-[11px] text-slate-400">{clean(student.studentId, clean(student.applicationId))}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-800">{clean(student.internshipTrack || student.internshipPlan)}</p>
                          <p className="mt-1 text-xs font-semibold text-blue-700">{planDuration(student)}</p>
                          <p className="mt-1 text-xs text-slate-500">{clean(student.internshipStatus, "Not set")}</p>
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill value={student.assessmentStatus || student.resultStatus} />
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill value={student.paymentStatus} />
                          <p className="mt-1 text-xs text-slate-500">{formatCurrency(student.paymentAmount)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <StatusPill value={student.studentOpsApprovalStatus || student.studentOpsStatus} />
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">{formatDate(student.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => openDetails(student)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700">
                              <Eye size={14} /> Review
                            </button>
                            {activeTab === "pending" && (
                              <>
                                <button type="button" onClick={() => { setSelectedStudent(student); setModalMode("approve"); }} disabled={!canApproveStudent(student)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
                                  <CheckCircle2 size={14} /> Approve
                                </button>
                                <button type="button" onClick={() => { setSelectedStudent(student); setModalMode("reject"); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                                  <X size={14} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {students.map((student) => (
                  <article key={student.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
                          {studentName(student).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">{studentName(student)}</p>
                          <p className="truncate text-xs text-slate-500">{clean(student.email)}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{clean(student.studentId, clean(student.applicationId))}</p>
                        </div>
                      </div>
                      <StatusPill value={student.studentOpsApprovalStatus || student.studentOpsStatus} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Internship</p>
                        <p className="mt-1 font-semibold text-slate-700">{clean(student.internshipTrack || student.internshipPlan)}</p>
                         <p className="mt-1 text-xs font-semibold text-blue-700">{planDuration(student)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Payment</p>
                        <p className="mt-1 font-semibold text-slate-700">{formatCurrency(student.paymentAmount)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => openDetails(student)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700">Review details</button>
                      {activeTab === "pending" && (
                        <>
                          <button type="button" onClick={() => { setSelectedStudent(student); setModalMode("approve"); }} className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">Approve</button>
                          <button type="button" onClick={() => { setSelectedStudent(student); setModalMode("reject"); }} className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700">Reject</button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-800">{pageStart}-{pageEnd}</span> of{" "}
              <span className="font-semibold text-slate-800">{total}</span> records
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={14} /> Previous
              </button>
              <span className="min-w-20 text-center text-xs font-semibold text-slate-600">
                Page {page} / {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(Math.max(totalPages, 1), current + 1))}
                disabled={page >= totalPages || loading || totalPages === 0}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-blue-700" />
            <div>
              <h3 className="text-sm font-bold text-blue-950">Approval and credential security</h3>
              <p className="mt-1 text-sm leading-6 text-blue-900/80">
                Approval is processed by the server. It must generate a unique Internship ID, create a secure temporary password, force a password change at first login, and email the credentials. Date of birth must not be used as a permanent password because it is guessable. This page never displays passwords or password hashes.
              </p>
            </div>
          </div>
        </section>
      </div>

      {modalMode && selectedStudent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Student Operations review</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-950">
                  {modalMode === "details"
                    ? "Student application profile"
                    : modalMode === "approve"
                      ? "Approve and activate dashboard"
                      : "Reject student review"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {studentName(selectedStudent)} · {clean(selectedStudent.studentId, clean(selectedStudent.applicationId))}
                </p>
              </div>
              <button type="button" onClick={closeModal} disabled={actionLoading} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[65vh] space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><UserRound size={14} /> Student contact</div>
                  <p className="mt-2 break-all text-sm font-bold text-slate-900">{clean(selectedStudent.email)}</p>
                  <p className="mt-1 text-sm text-slate-600">{clean(selectedStudent.phone)}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><CalendarDays size={14} /> Application received</div>
                  <p className="mt-2 text-sm font-bold text-slate-900">{formatDate(selectedStudent.createdAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">Application ID: {clean(selectedStudent.applicationId)}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><GraduationCap size={14} /> Assessment</div>
                  <div className="mt-2"><StatusPill value={selectedStudent.assessmentStatus || selectedStudent.resultStatus} /></div>
                  <p className="mt-2 text-xs text-slate-500">Main application: {clean(selectedStudent.applicationStatus)}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><CreditCard size={14} /> Payment verification</div>
                  <div className="mt-2"><StatusPill value={selectedStudent.paymentStatus} /></div>
                  <p className="mt-2 text-sm font-bold text-slate-900">{formatCurrency(selectedStudent.paymentAmount)}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck size={14} /> Student dashboard access</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill value={selectedStudent.dashboardStatus || (selectedStudent.dashboardLoginEnabled ? "active" : "locked")} />
                    <StatusPill value={selectedStudent.credentialEmailStatus || (selectedStudent.dashboardCredentialsGenerated ? "generated" : "not issued")} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Internship ID: {clean(selectedStudent.internshipId || selectedStudent.dashboardStudentId, "Issued after approval")}</p>
                  <p className="mt-1 text-xs text-slate-500">Credentials issued: {formatDate(selectedStudent.credentialsIssuedAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">Access expiry: {formatDate(selectedStudent.dashboardExpiresAt)}</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Activity size={14} /> Selected internship</div>
                  <p className="mt-2 text-sm font-bold text-slate-900">{clean(selectedStudent.internshipTrack || selectedStudent.internshipPlan)}</p>
                  <p className="mt-1 text-xs font-semibold text-blue-700">Selected duration: {planDuration(selectedStudent)}</p>
                  <p className="mt-1 text-xs text-slate-500">Internship status: {clean(selectedStudent.internshipStatus)}</p>
                </div>
              </div>

              {modalMode === "approve" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <BadgeCheck size={20} className="mt-0.5 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Dashboard credential workflow</p>
                      <p className="mt-1 text-sm leading-6 text-emerald-800">
                        The server must re-check verified payment, assessment eligibility, domain and paid duration, then issue a unique Internship ID and send the student dashboard login details to the registered email. No password or date of birth is displayed in this panel.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {modalMode === "reject" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Rejection reason <span className="text-rose-600">*</span>
                  </span>
                  <textarea
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Enter a clear reason for rejecting this review..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
                  />
                  <span className="mt-1 block text-right text-xs text-slate-400">{rejectReason.length}/1000</span>
                </label>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:justify-end sm:p-6">
              <button type="button" onClick={closeModal} disabled={actionLoading} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>

              {modalMode === "details" && activeTab === "pending" && (
                <>
                  <button type="button" onClick={() => setModalMode("reject")} className="h-11 rounded-xl border border-rose-200 bg-white px-5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                    Reject
                  </button>
                  <button type="button" onClick={() => setModalMode("approve")} className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
                    Continue to approval
                  </button>
                </>
              )}

              {modalMode === "approve" && (
                <button
                  type="button"
                  onClick={() => void submitAction("approve")}
                  disabled={actionLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {actionLoading ? "Processing..." : "Approve & issue dashboard login"}
                </button>
              )}

              {modalMode === "reject" && (
                <button
                  type="button"
                  onClick={() => void submitAction("reject")}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <XCircle size={16} />}
                  {actionLoading ? "Processing..." : "Confirm rejection"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
