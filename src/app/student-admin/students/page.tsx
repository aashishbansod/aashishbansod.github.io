 "use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays,
  CheckCircle2, ChevronDown, CircleAlert, Clock3, CreditCard, Download, Eye,
  FileText, GraduationCap, Mail, Phone, RefreshCw, Search, ShieldCheck,
  SlidersHorizontal, Users, X,
} from "lucide-react";

type Student = {
  id: string;
  studentId: string;
  dashboardStudentId?: string;
  applicationId?: string;
  fullName: string;
  email: string;
  phone?: string;
  applicationStatus?: string;
  adminApprovalStatus?: string;
  assessmentStatus?: string;
  resultStatus?: string;
  internshipStatus?: string;
  internshipPlan?: string;
  internshipTrack?: string;
  paymentStatus: string;
  paymentAmount?: number;
  studentOpsApprovalStatus?: string;
  studentOpsStatus?: string;
  dashboardStatus?: string;
  dashboardLoginEnabled?: boolean;
  dashboardCredentialsGenerated?: boolean;
  learningStatus?: string;
  taskCompletionPercentage?: number;
  learningProgressPercentage?: number;
  attendancePercentage?: number;
  weeklyAssessmentStatus?: string;
  saturdayAssessmentStatus?: string;
  projectStatus?: string;
  projectCompletionPercentage?: number;
  certificateStatus?: string;
  certificateId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  data?: {
    students?: Student[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

type FilterKey =
  | "studentOpsStatus"
  | "studentOpsApprovalStatus"
  | "applicationStatus"
  | "assessmentStatus"
  | "internshipStatus"
  | "paymentStatus"
  | "dashboardStatus";

const API_URL = "/api/student-admin/students";
const PAGE_SIZE = 25;
const REFRESH_INTERVAL = 30000;

const FILTERS: { key: FilterKey; label: string; options: string[] }[] = [
  { key: "studentOpsStatus", label: "Operations status", options: ["active", "pending", "pending-review", "rejected", "suspended", "completed"] },
  { key: "studentOpsApprovalStatus", label: "Operations approval", options: ["pending", "approved", "rejected"] },
  { key: "applicationStatus", label: "Application", options: ["pending", "approved", "rejected"] },
  { key: "assessmentStatus", label: "Assessment", options: ["not-started", "in-progress", "passed", "failed", "evaluated"] },
  { key: "internshipStatus", label: "Internship", options: ["not-started", "pending", "approved", "active", "completed", "rejected"] },
  { key: "paymentStatus", label: "Payment", options: ["unpaid", "pending", "paid", "failed", "refunded"] },
  { key: "dashboardStatus", label: "Dashboard access", options: ["locked", "pending", "active", "completed", "disabled"] },
];

const EMPTY_FILTERS: Record<FilterKey, string> = {
  studentOpsStatus: "",
  studentOpsApprovalStatus: "",
  applicationStatus: "",
  assessmentStatus: "",
  internshipStatus: "",
  paymentStatus: "",
  dashboardStatus: "",
};

function safeText(value: unknown, fallback = "—"): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim() || fallback;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function boundedPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function titleCase(value?: string): string {
  return safeText(value, "Not set").replace(/[_-]+/g, " ").replace(/\b\w/g, (part) => part.toUpperCase());
}

function statusClass(value?: string): string {
  const key = safeText(value, "").toLowerCase().replace(/[\s_-]+/g, "");
  if (["active", "approved", "paid", "completed", "passed", "verified", "enabled"].includes(key)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["rejected", "failed", "suspended", "disabled", "refunded"].includes(key)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (["pending", "pendingreview", "processing", "initiated", "inprogress"].includes(key)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function Status({ value }: { value?: string }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass(value)}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" /><span className="truncate">{titleCase(value)}</span></span>;
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST";
}

function Metric({ label, value, note, icon: Icon, tone }: {
  label: string; value: string | number; note: string; icon: typeof Users; tone: string;
}) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></span></div><p className="mt-3 text-[10px] leading-5 text-slate-500">{note}</p></article>;
}

function Progress({ label, value }: { label: string; value: unknown }) {
  const amount = boundedPercent(value);
  return <div><div className="mb-1.5 flex justify-between gap-2"><span className="text-[10px] font-semibold text-slate-500">{label}</span><span className="text-[10px] font-bold text-slate-700">{amount === null ? "—" : `${amount}%`}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${amount ?? 0}%` }} /></div></div>;
}

export default function StudentAdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const requestSequence = useRef(0);

  const activeFilterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);
  const activeOnPage = useMemo(() => students.filter((item) => ["active", "completed"].includes(safeText(item.studentOpsStatus, "").toLowerCase())).length, [students]);
  const paidOnPage = useMemo(() => students.filter((item) => safeText(item.paymentStatus, "").toLowerCase() === "paid").length, [students]);

  const loadStudents = useCallback(async (initial = false, signal?: AbortSignal) => {
    const requestId = ++requestSequence.current;
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set("search", search);
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });

    try {
      const response = await fetch(`${API_URL}?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      const result = await response.json().catch(() => null) as ApiResponse | null;
      if (signal?.aborted || requestId !== requestSequence.current) return;
      if (response.status === 401 || response.status === 403) {
        window.location.replace("/login?mode=student-admin&next=%2Fstudent-admin%2Fstudents");
        return;
      }
      if (!response.ok || !result?.success || !result.data) {
        throw new Error(result?.message || `Unable to load student records (${response.status}).`);
      }
      setStudents(Array.isArray(result.data.students) ? result.data.students : []);
      setTotal(Math.max(0, safeNumber(result.data.total)));
      setTotalPages(Math.max(0, safeNumber(result.data.totalPages)));
      setLastUpdated(new Date().toISOString());
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      if (signal?.aborted || requestId !== requestSequence.current) return;
      setError(cause instanceof Error ? cause.message : "Student records could not be synchronized.");
    } finally {
      if (!signal?.aborted && requestId === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, search, filters]);

  useEffect(() => {
    const controller = new AbortController();
    void loadStudents(true, controller.signal);
    return () => controller.abort();
  }, [loadStudents]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadStudents(false);
    }, REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [loadStudents]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim().slice(0, 120));
  }

  function updateFilter(key: FilterKey, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setSearchInput("");
    setPage(1);
  }

  function exportCurrentPage() {
    if (!students.length) return;
    const columns = ["Student ID", "Dashboard ID", "Application ID", "Name", "Email", "Phone", "Application", "Assessment", "Internship", "Plan", "Track", "Payment", "Operations Approval", "Operations Status", "Dashboard", "Attendance", "Task Completion", "Learning Progress", "Certificate", "Joined"];
    const rows = students.map((item) => [item.studentId, item.dashboardStudentId, item.applicationId, item.fullName, item.email, item.phone, item.applicationStatus, item.assessmentStatus, item.internshipStatus, item.internshipPlan, item.internshipTrack, item.paymentStatus, item.studentOpsApprovalStatus, item.studentOpsStatus, item.dashboardStatus, item.attendancePercentage, item.taskCompletionPercentage, item.learningProgressPercentage, item.certificateStatus, item.createdAt]);
    const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [columns, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cybernet-students-page-${page}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const updatedLabel = lastUpdated ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(lastUpdated)) : "Not synced";

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <div className="mx-auto w-full max-w-[1680px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.045)]">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blue-100/80 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 p-5 sm:p-7 xl:flex-row xl:items-end xl:p-9">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700"><Users size={13} /> Student Operations / Directory</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Students Management</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Centralized student records, enrollment status, internship progress and dashboard access.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700"><Activity size={12} /> Live API synchronization</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Updated {updatedLabel}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Auto refresh · 30 sec</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadStudents(false)} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh</button>
              <button type="button" onClick={exportCurrentPage} disabled={!students.length || loading} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Download size={15} /> Export current page</button>
            </div>
          </div>
        </section>

        {error && <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><CircleAlert size={18} className="mt-0.5 shrink-0 text-rose-600" /><div><p className="text-sm font-bold text-rose-800">Unable to synchronize student records</p><p className="mt-1 break-words text-xs text-rose-700">{error}</p></div></div><button type="button" onClick={() => void loadStudents(true)} className="h-9 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700">Retry</button></section>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Matching students" value={total.toLocaleString("en-IN")} note="Records matching current search and filters" icon={Users} tone="bg-blue-50 text-blue-600" />
          <Metric label="Records on this page" value={students.length} note={`Page ${page}${totalPages ? ` of ${totalPages}` : ""}`} icon={FileText} tone="bg-violet-50 text-violet-600" />
          <Metric label="Active on this page" value={activeOnPage} note="Active or completed operations status in this page" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
          <Metric label="Paid on this page" value={paidOnPage} note="Paid status in this result page" icon={CreditCard} tone="bg-amber-50 text-amber-600" />
        </section>

        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.035)]">
          <div className="border-b border-slate-100 p-4 sm:p-6">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black tracking-tight text-slate-950">Student directory</h2><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{total.toLocaleString("en-IN")} records</span></div><p className="mt-1 text-xs text-slate-500">Search, filter and inspect records managed by Student Operations.</p></div>
              <form onSubmit={submitSearch} className="flex w-full gap-2 xl:max-w-[470px]">
                <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50"><Search size={16} className="shrink-0 text-slate-400" /><input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={120} placeholder="Search name, email, phone or student ID" className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-slate-400" />{searchInput && <button type="button" aria-label="Clear search input" onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }} className="text-slate-400 hover:text-slate-700"><X size={15} /></button>}</div>
                <button type="submit" className="h-11 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700">Search</button>
              </form>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"><SlidersHorizontal size={14} /> Filters{activeFilterCount > 0 && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] text-white">{activeFilterCount}</span>}<ChevronDown size={14} className={`transition ${filtersOpen ? "rotate-180" : ""}`} /></button><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><ShieldCheck size={13} className="text-emerald-600" /> Read-only student directory</span></div>
            {filtersOpen && <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2 xl:grid-cols-3">{FILTERS.map((filter) => <label key={filter.key} className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{filter.label}</span><select value={filters[filter.key]} onChange={(event) => updateFilter(filter.key, event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"><option value="">All {filter.label.toLowerCase()}</option>{filter.options.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}</select></label>)}<div className="flex items-end"><button type="button" onClick={clearFilters} disabled={!activeFilterCount && !search} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 sm:w-auto">Clear all</button></div></div>}
            {(activeFilterCount > 0 || search) && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold text-slate-500">Applied:</span>{search && <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">Search: {search}<X size={11} /></button>}{FILTERS.map((filter) => filters[filter.key] ? <button key={filter.key} type="button" onClick={() => updateFilter(filter.key, "")} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{filter.label}: {titleCase(filters[filter.key])}<X size={11} /></button> : null)}</div>}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1160px] border-collapse text-left">
              <thead><tr className="bg-slate-50 text-[9px] font-black uppercase tracking-[0.13em] text-slate-500"><th className="px-5 py-4">Student</th><th className="px-4 py-4">Identifiers</th><th className="px-4 py-4">Internship track</th><th className="px-4 py-4">Operations</th><th className="px-4 py-4">Application</th><th className="px-4 py-4">Assessment</th><th className="px-4 py-4">Payment</th><th className="px-4 py-4">Joined</th><th className="px-5 py-4 text-right">Profile</th></tr></thead>
              {!loading && students.length > 0 && <tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id || student.studentId} className="transition hover:bg-blue-50/30"><td className="px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-[10px] font-black text-blue-700">{initials(student.fullName)}</span><div className="min-w-0"><p className="max-w-[190px] truncate text-xs font-bold text-slate-900">{safeText(student.fullName, "Student")}</p><p className="mt-1 flex max-w-[190px] items-center gap-1 truncate text-[10px] text-slate-500"><Mail size={10} />{safeText(student.email)}</p></div></div></td><td className="px-4 py-4"><p className="text-[10px] font-bold text-slate-700">{safeText(student.studentId)}</p><p className="mt-1 text-[9px] text-slate-400">{safeText(student.dashboardStudentId, "No dashboard ID")}</p></td><td className="px-4 py-4"><p className="max-w-[170px] truncate text-[11px] font-semibold text-slate-700">{safeText(student.internshipTrack, "Unassigned")}</p><p className="mt-1 text-[10px] text-slate-400">{safeText(student.internshipPlan, "No plan")}</p></td><td className="px-4 py-4"><Status value={student.studentOpsStatus} /></td><td className="px-4 py-4"><Status value={student.applicationStatus} /></td><td className="px-4 py-4"><Status value={student.assessmentStatus} /></td><td className="px-4 py-4"><Status value={student.paymentStatus} /></td><td className="px-4 py-4 text-[10px] text-slate-500">{formatDate(student.createdAt)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelected(student)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Eye size={13} /> View</button></td></tr>)}</tbody>}
            </table>
            {loading && <div className="space-y-3 p-5">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((__, cell) => <div key={cell} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>)}</div>}
            {!loading && students.length === 0 && <EmptyState filtered={Boolean(search || activeFilterCount)} onClear={clearFilters} />}
          </div>

          <div className="space-y-3 p-3 lg:hidden">
            {loading && <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div>}
            {!loading && students.map((student) => <article key={student.id || student.studentId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">{initials(student.fullName)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-950">{safeText(student.fullName, "Student")}</p><p className="mt-1 truncate text-[10px] text-slate-500">{safeText(student.email)}</p><p className="mt-1 text-[10px] font-bold text-blue-700">{safeText(student.studentId)}</p></div><button type="button" onClick={() => setSelected(student)} aria-label={`View ${student.fullName}`} className="rounded-lg border border-slate-200 p-2 text-slate-600"><Eye size={15} /></button></div><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Internship</p><p className="mt-1 truncate text-[11px] font-semibold text-slate-700">{safeText(student.internshipTrack, "Unassigned")}</p></div><div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Joined</p><p className="mt-1 text-[11px] font-semibold text-slate-700">{formatDate(student.createdAt)}</p></div></div><div className="mt-3 flex flex-wrap gap-1.5"><Status value={student.studentOpsStatus} /><Status value={student.paymentStatus} /></div></article>)}
            {!loading && students.length === 0 && <EmptyState filtered={Boolean(search || activeFilterCount)} onClear={clearFilters} />}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-[10px] text-slate-500">{loading ? "Loading student records…" : total === 0 ? "No student records" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString("en-IN")} students`}</p><div className="flex items-center justify-between gap-2 sm:justify-end"><button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={13} /> Previous</button><span className="min-w-[70px] text-center text-[10px] font-bold text-slate-600">{totalPages ? `${page} / ${totalPages}` : "0 / 0"}</span><button type="button" disabled={loading || totalPages === 0 || page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next <ArrowRight size={13} /></button></div></div>
        </section>

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 py-4 text-[10px] text-slate-400 sm:flex-row sm:items-center"><span>© {new Date().getFullYear()} CyberNet Careers · Student Operations</span><span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Authorized read-only workspace</span></footer>
      </div>
      {selected && <StudentDetails student={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return <div className="px-5 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Users size={22} /></span><h3 className="mt-4 text-sm font-bold text-slate-800">{filtered ? "No matching students" : "No student records yet"}</h3><p className="mt-1 text-xs text-slate-500">{filtered ? "Try changing your search or filters." : "Student records will appear here when available in Student Operations."}</p>{filtered && <button type="button" onClick={onClear} className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700">Clear search and filters</button>}</div>;
}

function StudentDetails({ student, onClose }: { student: Student; onClose: () => void }) {
  const details = [
    { label: "Student ID", value: student.studentId, icon: Users },
    { label: "Dashboard ID", value: student.dashboardStudentId, icon: ShieldCheck },
    { label: "Application ID", value: student.applicationId, icon: FileText },
    { label: "Email", value: student.email, icon: Mail },
    { label: "Phone", value: student.phone, icon: Phone },
    { label: "Application", value: student.applicationStatus, icon: FileText },
    { label: "Main Admin approval", value: student.adminApprovalStatus, icon: BadgeCheck },
    { label: "Assessment", value: student.assessmentStatus, icon: GraduationCap },
    { label: "Assessment result", value: student.resultStatus, icon: CheckCircle2 },
    { label: "Internship", value: student.internshipStatus, icon: BriefcaseBusiness },
    { label: "Internship plan", value: student.internshipPlan, icon: CalendarDays },
    { label: "Internship track", value: student.internshipTrack, icon: GraduationCap },
    { label: "Payment", value: student.paymentStatus, icon: CreditCard },
    { label: "Operations approval", value: student.studentOpsApprovalStatus, icon: BadgeCheck },
    { label: "Operations status", value: student.studentOpsStatus, icon: Activity },
    { label: "Dashboard status", value: student.dashboardStatus, icon: ShieldCheck },
    { label: "Dashboard login", value: student.dashboardLoginEnabled ? "Enabled" : "Disabled", icon: ShieldCheck },
    { label: "Credentials generated", value: student.dashboardCredentialsGenerated ? "Yes" : "No", icon: CheckCircle2 },
    { label: "Learning status", value: student.learningStatus, icon: GraduationCap },
    { label: "Project status", value: student.projectStatus, icon: FileText },
    { label: "Certificate status", value: student.certificateStatus, icon: BadgeCheck },
    { label: "Certificate ID", value: student.certificateId, icon: FileText },
    { label: "Joined", value: formatDate(student.createdAt), icon: CalendarDays },
    { label: "Last updated", value: formatDate(student.updatedAt), icon: Clock3 },
  ];

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="student-profile-heading" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 p-5 backdrop-blur"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Student record</p><h2 id="student-profile-heading" className="mt-1 text-lg font-black text-slate-950">Profile overview</h2></div><button type="button" onClick={onClose} aria-label="Close student profile" className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"><X size={18} /></button></header><div className="p-5 sm:p-6"><div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-100 text-lg font-black text-blue-700">{initials(student.fullName)}</span><div className="min-w-0 flex-1"><h3 className="truncate text-base font-black text-slate-950">{safeText(student.fullName, "Student")}</h3><p className="mt-1 truncate text-xs text-slate-500">{safeText(student.email)}</p><div className="mt-2 flex flex-wrap gap-1.5"><Status value={student.studentOpsStatus} /><Status value={student.paymentStatus} /></div></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{details.map((item) => { const Icon = item.icon; return <div key={item.label} className="min-w-0 rounded-xl border border-slate-100 p-3"><div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400"><Icon size={13} />{item.label}</div><p className="mt-2 break-words text-xs font-bold text-slate-800">{safeText(item.value)}</p></div>; })}</div><div className="mt-5 rounded-2xl border border-slate-200 p-4"><h3 className="mb-4 text-xs font-black text-slate-800">Student dashboard progress</h3><div className="space-y-4"><Progress label="Attendance" value={student.attendancePercentage} /><Progress label="Task completion" value={student.taskCompletionPercentage} /><Progress label="Learning progress" value={student.learningProgressPercentage} /><Progress label="Project completion" value={student.projectCompletionPercentage} /></div><p className="mt-4 text-[10px] leading-5 text-slate-400">Progress values appear only when supplied by the Student Operations API. This page does not modify student progress.</p></div><div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white transition hover:bg-slate-700">Close profile</button></div></div></section></div>;
}
