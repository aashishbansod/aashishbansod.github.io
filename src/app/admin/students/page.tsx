"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {

  Activity,

  AlertCircle,

  ArrowDown,

  ArrowUp,

  CheckCircle2,

  ChevronLeft,

  ChevronRight,

  ClipboardCheck,

  Download,

  Eye,

  Filter,

  Mail,

  RefreshCw,

  Search,

  Trash2,

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

  internshipTrack?: string;

  internshipPlan?: string;

  internshipStatus?: string;

  applicationStatus?: string;

  assessmentStatus?: string;

  assessmentScore?: number | null;

  resultStatus?: string;

  paymentStatus?: string;

  adminApprovalStatus?: string;

  dashboardStatus?: string;

  loginEnabled?: boolean;

  accountLocked?: boolean;

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

function text(value: unknown, fallback = ""): string {

  return typeof value === "string" ? value.trim() || fallback : fallback;

}

function nameOf(student: Student): string {

  return text(student.fullName) || text(student.name, "Unnamed student");

}

function idOf(student: Student): string {

  return text(student.studentId) || text(student.applicationId, "Not assigned");

}

function domainOf(student: Student): string {

  return text(student.internshipTrack) || text(student.internshipPlan, "Not selected");

}

function dateOf(value?: string): string {

  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {

    day: "2-digit",

    month: "short",

    year: "numeric",

  }).format(date);

}

function numberOf(value: unknown): number {

  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

}

function statusLabel(student: Student): string {

  if (student.accountLocked) return "Locked";

  if (student.loginEnabled === true) return "Active";

  const status = text(student.applicationStatus || student.adminApprovalStatus).toLowerCase();

  if (status === "rejected") return "Rejected";

  if (status === "approved") return "Approved";

  if (status === "under_review") return "Under review";

  if (status === "pending") return "Pending";

  return "Inactive";

}

function assessmentLabel(student: Student): string {

  const status = text(student.assessmentStatus || student.resultStatus).toLowerCase().replace(/[\s-]+/g, "_");

  if (status === "passed" || status === "pass") return "Passed";

  if (status === "failed" || status === "fail") return "Failed";

  if (status === "active" || status === "in_progress" || status === "started") return "In progress";

  if (status === "not_started" || status === "pending") return "Not started";

  return "Not recorded";

}

function csvCell(value: unknown): string {

  return `"${String(value ?? "").replace(/"/g, '""')}"`;

}

function cardTone(tone: "blue" | "green" | "amber" | "emerald" | "rose" | "slate"): string {

  const tones = {

    blue: "border-blue-100 bg-blue-50 text-blue-700",

    green: "border-emerald-100 bg-emerald-50 text-emerald-700",

    amber: "border-amber-100 bg-amber-50 text-amber-700",

    emerald: "border-teal-100 bg-teal-50 text-teal-700",

    rose: "border-rose-100 bg-rose-50 text-rose-700",

    slate: "border-slate-200 bg-slate-50 text-slate-700",

  };

  return tones[tone];

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
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const requestRef = useRef(0);

  useEffect(() => {

    const handle = window.setTimeout(() => {

      setSearch(searchInput.trim());

      setPage(1);

    }, 300);

    return () => window.clearTimeout(handle);

  }, [searchInput]);

  const loadStudents = useCallback(async (mode: "initial" | "refresh" = "initial") => {

    const requestId = ++requestRef.current;

    abortRef.current?.abort();

    const controller = new AbortController();

    abortRef.current = controller;

    if (mode === "refresh") setRefreshing(true);

    else setLoading(true);

    setError("");

    const params = new URLSearchParams({

      page: String(page),

      limit: String(pageSize),

    });

    if (search) params.set("search", search);

    if (statusFilter !== "all") params.set("status", statusFilter);

    try {

      const response = await fetch(`${API_URL}?${params.toString()}`, {

        method: "GET",

        credentials: "include",

        cache: "no-store",

        signal: controller.signal,

        headers: { Accept: "application/json", "Cache-Control": "no-cache" },

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

        throw new Error(payload.message || `Unable to load students (${response.status}).`);

      }

      if (requestId !== requestRef.current) return;

      const data = payload.data;

      setStudents(Array.isArray(data?.students) ? data.students : []);

      const rawStats = data?.stats ?? {};

      setStats({

        totalStudents: numberOf(rawStats.totalStudents),

        activeStudents: numberOf(rawStats.activeStudents),

        pending: numberOf(rawStats.pending),

        verified: numberOf(rawStats.verified),

        approved: numberOf(rawStats.approved),

        rejected: numberOf(rawStats.rejected),

        paid: numberOf(rawStats.paid),

        assessmentPassed: numberOf(rawStats.assessmentPassed),

        assessmentFailed: numberOf(rawStats.assessmentFailed),

      });

      const rawPage = data?.pagination ?? {};

      setPagination({

        page: numberOf(rawPage.page) || page,

        limit: numberOf(rawPage.limit) || pageSize,

        total: numberOf(rawPage.total),

        totalPages: numberOf(rawPage.totalPages),

        hasNextPage: rawPage.hasNextPage === true,

        hasPreviousPage: rawPage.hasPreviousPage === true,

      });

      setLastUpdated(new Date());

    } catch (requestError) {

      if (requestError instanceof DOMException && requestError.name === "AbortError") return;

      if (requestId !== requestRef.current) return;

      const message = requestError instanceof Error ? requestError.message : "Unable to load student records.";

      setError(message);

    } finally {

      if (requestId === requestRef.current) {

        setLoading(false);

        setRefreshing(false);

      }

    }

  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {

    void loadStudents("initial");

    return () => abortRef.current?.abort();

  }, [loadStudents]);

  useEffect(() => {

    const interval = window.setInterval(() => {

      if (document.visibilityState === "visible") void loadStudents("refresh");

    }, REFRESH_MS);

    const onVisibility = () => {

      if (document.visibilityState === "visible") void loadStudents("refresh");

    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {

      window.clearInterval(interval);

      document.removeEventListener("visibilitychange", onVisibility);

    };

  }, [loadStudents]);

  const sortedStudents = useMemo(() => {

    const result = [...students];

    result.sort((a, b) => {

      let left = "";

      let right = "";

      if (sortKey === "fullName") {

        left = nameOf(a).toLowerCase();

        right = nameOf(b).toLowerCase();

      } else if (sortKey === "studentId") {

        left = idOf(a).toLowerCase();

        right = idOf(b).toLowerCase();

      } else if (sortKey === "email") {

        left = text(a.email).toLowerCase();

        right = text(b.email).toLowerCase();

      } else {

        left = a.createdAt || "";

        right = b.createdAt || "";

      }

      const compare = left.localeCompare(right, undefined, { sensitivity: "base" });

      return (sortDirection === "asc" ? compare : -compare);

    });

    return result;

  }, [students, sortKey, sortDirection]);

  const exportCsv = useCallback(() => {

    if (!sortedStudents.length) return;

    const rows = [

      ["Name", "Student ID", "Email", "Phone", "Domain", "Account status", "Assessment result", "Assessment score", "Payment status", "Registered"],

      ...sortedStudents.map((student) => [

        nameOf(student),

        idOf(student),

        text(student.email),

        text(student.phone),

        domainOf(student),

        statusLabel(student),

        assessmentLabel(student),

        student.assessmentScore ?? "",

        text(student.paymentStatus),

        dateOf(student.createdAt),

      ]),

    ];

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;

    anchor.download = `cybernet-students-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(url);

  }, [sortedStudents]);

  const deleteFailedStudent = useCallback(async (student: Student) => {
    const assessmentStatus = text(student.assessmentStatus || student.resultStatus)
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const isFailed = assessmentStatus === "failed" || assessmentStatus === "fail";
    const studentId = text(student.studentId) || text(student._id) || text(student.applicationId);

    if (!isFailed) {
      setDeleteError("Only students with a failed assessment can be deleted from this page.");
      setDeleteSuccess("");
      return;
    }
    if (!studentId) {
      setDeleteError("Student identifier is missing. This record cannot be deleted safely.");
      setDeleteSuccess("");
      return;
    }

    const confirmed = window.confirm(
      `Delete failed student ${nameOf(student)} (${studentId})? This action may permanently remove the student record.`
    );
    if (!confirmed) return;

    setDeletingStudentId(studentId);
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const response = await fetch(API_URL, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          studentId,
          onlyIfAssessmentFailed: true,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error(
          response.status === 405
            ? "Student deletion is not enabled in the backend yet. Add a secure DELETE handler to /api/admin/students."
            : `Unexpected server response (${response.status}).`
        );
      }

      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || payload.success !== true) {
        throw new Error(
          payload.message ||
            (response.status === 405
              ? "Student deletion is not enabled in the backend yet."
              : `Unable to delete student (${response.status}).`)
        );
      }

      setStudents((current) =>
        current.filter((item) => {
          const itemId = text(item.studentId) || text(item._id) || text(item.applicationId);
          return itemId !== studentId;
        })
      );
      setSelectedStudent((current) => {
        if (!current) return current;
        const currentId = text(current.studentId) || text(current._id) || text(current.applicationId);
        return currentId === studentId ? null : current;
      });
      setStats((current) => ({
        ...current,
        totalStudents: Math.max(0, current.totalStudents - 1),
        assessmentFailed: Math.max(0, current.assessmentFailed - 1),
      }));
      setPagination((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
      }));
      setDeleteSuccess(`Failed student ${nameOf(student)} was deleted.`);
      if (students.length === 1 && page > 1) setPage((current) => Math.max(1, current - 1));
      else void loadStudents("refresh");
    } catch (deleteRequestError) {
      const message =
        deleteRequestError instanceof Error
          ? deleteRequestError.message
          : "Unable to delete this student.";
      setDeleteError(message);
    } finally {
      setDeletingStudentId(null);
    }
  }, [loadStudents, page, students.length]);

  const selectStatus = (value: StatusFilter) => {

    setStatusFilter(value);

    setPage(1);

  };

  const changeSort = (key: SortKey) => {

    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");

    else {

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

  const visibleStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;

  const visibleEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  const metrics = [

    { label: "Total Students", value: stats.totalStudents, description: "All registered student records", tone: "blue" as const, icon: Users, filter: "all" as StatusFilter },

    { label: "Active Students", value: stats.activeStudents, description: "Login enabled accounts", tone: "green" as const, icon: Activity, filter: "active" as StatusFilter },

    { label: "Assessment Passed", value: stats.assessmentPassed, description: "Students with passed result", tone: "emerald" as const, icon: CheckCircle2, filter: "assessment_passed" as StatusFilter },

    { label: "Assessment Failed", value: stats.assessmentFailed, description: "Students with failed result", tone: "rose" as const, icon: XCircle, filter: "assessment_failed" as StatusFilter },

    { label: "Pending Students", value: stats.pending, description: "Awaiting application review", tone: "amber" as const, icon: ClipboardCheck, filter: "pending" as StatusFilter },

    { label: "Email Verified", value: stats.verified, description: "Email verification completed", tone: "slate" as const, icon: Mail, filter: "verified" as StatusFilter },

  ];

  return (

    <div className="min-h-full bg-[#f5f7fb] text-slate-900">

      <main className="mx-auto w-full max-w-[1600px] space-y-5 px-3 py-4 sm:px-5 lg:px-7">

        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Admin Workspace · CyberNet Careers</p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Students</h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-500">

                Live student records with separate account, assessment, and verification statistics.

              </p>

              <p className="mt-2 text-[11px] text-slate-400">

                {lastUpdated ? `Last synced ${lastUpdated.toLocaleTimeString("en-IN")}` : "Connecting to live student data…"} · Auto-refresh every 30 seconds

              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              <button type="button" onClick={() => void loadStudents("refresh")} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">

                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh

              </button>

              <button type="button" onClick={exportCsv} disabled={!sortedStudents.length} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">

                <Download className="h-4 w-4" /> Export current page

              </button>

            </div>

          </div>

        </header>

        <section aria-label="Student statistics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

          {metrics.map((metric) => {

            const Icon = metric.icon;

            const active = statusFilter === metric.filter;

            return (

              <button key={metric.label} type="button" onClick={() => selectStatus(metric.filter)} className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"}`}>

                <div className="flex items-start justify-between gap-3">

                  <div>

                    <p className="text-xs font-bold text-slate-500">{metric.label}</p>

                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{loading ? <span className="inline-block h-9 w-14 animate-pulse rounded-lg bg-slate-100" /> : metric.value.toLocaleString("en-IN")}</p>

                    <p className="mt-1 text-[11px] text-slate-400">{metric.description}</p>

                  </div>

                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${cardTone(metric.tone)}`}><Icon className="h-5 w-5" /></span>

                </div>

              </button>

            );

          })}

        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">

            <div className="relative min-w-0 flex-1">

              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, Student ID, email, college or domain…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-500">

                <Filter className="h-4 w-4" />

                <select value={statusFilter} onChange={(event) => selectStatus(event.target.value as StatusFilter)} className="max-w-[180px] bg-transparent text-sm font-semibold text-slate-700 outline-none">

                  <option value="all">All students</option>

                  <option value="active">Active accounts</option>

                  <option value="pending">Pending review</option>

                  <option value="inactive">Inactive accounts</option>

                  <option value="verified">Email verified</option>

                  <option value="assessment_passed">Assessment passed</option>

                  <option value="assessment_failed">Assessment failed</option>

                </select>

              </label>

              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none">

                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}

              </select>

              {(searchInput || statusFilter !== "all") && <button type="button" onClick={clearFilters} className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /> Clear</button>}

            </div>

          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">

            <span>Showing <strong className="text-slate-800">{visibleStart}–{visibleEnd}</strong> of <strong className="text-slate-800">{pagination.total.toLocaleString("en-IN")}</strong> matching records</span>

            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live database data</span>

          </div>

        </section>

        {error && <section role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0"><p className="font-bold">Unable to sync student records</p><p className="mt-1 break-words text-sm">{error}</p><button type="button" onClick={() => void loadStudents("refresh")} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white">Try again</button></div></section>}

        {deleteError && (
          <section role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Student deletion failed</p>
              <p className="mt-1 break-words text-sm">{deleteError}</p>
            </div>
            <button type="button" onClick={() => setDeleteError("")} aria-label="Dismiss error" className="rounded-lg p-1 hover:bg-rose-100">
              <X className="h-4 w-4" />
            </button>
          </section>
        )}
        {deleteSuccess && (
          <section role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Student deleted</p>
              <p className="mt-1 text-sm">{deleteSuccess}</p>
            </div>
            <button type="button" onClick={() => setDeleteSuccess("")} aria-label="Dismiss success" className="rounded-lg p-1 hover:bg-emerald-100">
              <X className="h-4 w-4" />
            </button>
          </section>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

            <div><h2 className="font-black text-slate-950">Student Records</h2><p className="mt-1 text-xs text-slate-500">Account status and assessment results are shown in separate columns.</p></div>

            <span className="text-xs font-semibold text-slate-400">{pagination.total.toLocaleString("en-IN")} records</span>

          </div>

          {loading ? (

            <div className="space-y-3 p-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>

          ) : sortedStudents.length === 0 ? (

            <div className="px-5 py-16 text-center">

              <Users className="mx-auto h-10 w-10 text-slate-300" />

              <h3 className="mt-3 font-black text-slate-800">No matching students</h3>

              <p className="mt-1 text-sm text-slate-500">{error ? "Resolve the API error and refresh." : "No records match the selected search or filter."}</p>

              {(search || statusFilter !== "all") && <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Clear filters</button>}

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1050px]">

                <thead className="bg-slate-50 text-left">

                  <tr>

                    {([

                      ["fullName", "Student"],

                      ["studentId", "Student ID"],

                      ["email", "Contact"],

                      ["createdAt", "Registered"],

                    ] as Array<[SortKey, string]>).map(([key, label]) => (

                      <th key={key} className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">

                        <button type="button" onClick={() => changeSort(key)} className="inline-flex items-center gap-1.5 hover:text-blue-600">{label}{sortKey === key && (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button>

                      </th>

                    ))}

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Account</th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Assessment</th>

                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Domain / Payment</th>

                    <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Action</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {sortedStudents.map((student, index) => (

                    <tr key={student._id || student.studentId || student.applicationId || `${nameOf(student)}-${index}`} className="hover:bg-blue-50/30">

                      <td className="px-5 py-4"><p className="text-sm font-bold text-slate-900">{nameOf(student)}</p><p className="mt-1 text-xs text-slate-400">{text(student.collegeName) || text(student.university, "College not provided")}</p></td>

                      <td className="px-5 py-4"><span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700">{idOf(student)}</span></td>

                      <td className="px-5 py-4"><p className="text-xs font-semibold text-slate-700">{text(student.email, "No email")}</p><p className="mt-1 text-xs text-slate-400">{text(student.phone, "No phone")}</p><p className="mt-1 text-[10px] text-slate-400">{student.emailVerified ? "Email verified" : "Email unverified"}</p></td>

                      <td className="px-5 py-4 text-xs text-slate-600">{dateOf(student.createdAt)}</td>

                      <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${student.loginEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{statusLabel(student)}</span></td>

                      <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${assessmentLabel(student) === "Passed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : assessmentLabel(student) === "Failed" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{assessmentLabel(student)}</span>{student.assessmentScore != null && <p className="mt-1 text-[10px] text-slate-400">Score: {student.assessmentScore}</p>}</td>

                      <td className="px-5 py-4"><p className="text-xs font-semibold text-slate-700">{domainOf(student)}</p><p className="mt-1 text-xs text-slate-400">Payment: {text(student.paymentStatus, "Not recorded")}</p></td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setSelectedStudent(student)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                          {(assessmentLabel(student) === "Failed") && (
                            <button
                              type="button"
                              onClick={() => void deleteFailedStudent(student)}
                              disabled={deletingStudentId !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Delete failed-assessment student"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingStudentId === (text(student.studentId) || text(student._id) || text(student.applicationId)) ? "Deleting…" : "Delete"}
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

          {!loading && pagination.totalPages > 1 && (

            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-xs text-slate-500">Page {pagination.page} of {pagination.totalPages}</p>

              <div className="flex gap-2">

                <button type="button" disabled={!pagination.hasPreviousPage || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button>

                <button type="button" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)} className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button>

              </div>

            </div>

          )}

        </section>

      </main>

      {selectedStudent && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Student details" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedStudent(null); }}>

          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-slate-100 p-5">

              <div><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Student Profile</p><h2 className="mt-1 text-xl font-black text-slate-950">{nameOf(selectedStudent)}</h2><p className="mt-1 text-sm text-slate-500">{text(selectedStudent.email, "No email")}</p></div>

              <button type="button" onClick={() => setSelectedStudent(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Close details"><X className="h-5 w-5" /></button>

            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">

              <Detail label="Student ID" value={idOf(selectedStudent)} />

              <Detail label="Phone" value={text(selectedStudent.phone, "Not provided")} />

              <Detail label="Course" value={text(selectedStudent.course, "Not provided")} />

              <Detail label="College / University" value={text(selectedStudent.collegeName) || text(selectedStudent.university, "Not provided")} />

              <Detail label="Account status" value={statusLabel(selectedStudent)} />

              <Detail label="Assessment result" value={assessmentLabel(selectedStudent)} />

              <Detail label="Assessment score" value={selectedStudent.assessmentScore == null ? "Not recorded" : String(selectedStudent.assessmentScore)} />

              <Detail label="Internship domain" value={domainOf(selectedStudent)} />

              <Detail label="Payment status" value={text(selectedStudent.paymentStatus, "Not recorded")} />

              <Detail label="Email verification" value={selectedStudent.emailVerified ? "Verified" : "Not verified"} />

              <Detail label="Application status" value={text(selectedStudent.applicationStatus, "Not recorded")} />

              <Detail label="Dashboard status" value={text(selectedStudent.dashboardStatus, "Not recorded")} />

            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-4">
                {assessmentLabel(selectedStudent) === "Failed" && (
                  <button
                    type="button"
                    onClick={() => void deleteFailedStudent(selectedStudent)}
                    disabled={deletingStudentId !== null}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingStudentId ? "Deleting…" : "Delete failed student"}
                  </button>
                )}
                <button type="button" onClick={() => setSelectedStudent(null)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Close</button>
              </div>

          </section>

        </div>

      )}

    </div>

  );

}

function Detail({ label, value }: { label: string; value: string }) {

  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>;

}
