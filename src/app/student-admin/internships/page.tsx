"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowLeft, ArrowRight,
  BriefcaseBusiness, CheckCircle2, Clock3, CreditCard, Filter,
  GraduationCap, Mail, RefreshCw, Search, ShieldCheck, Users, X,
} from "lucide-react";

type Student = {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  domain: string;
  internshipTrack: string;
  internshipPlan: string;
  internshipStatus: string;
  paymentStatus: string;
  paymentAmount: number;
  paymentCurrency: string;
  studentOpsApprovalStatus: string;
  studentOpsStatus: string;
  taskCompletionPercentage: number;
  attendancePercentage: number;
  createdAt: string | null;
};

type Payload = {
  success?: boolean;
  message?: string;
  data?: {
    students?: unknown[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
  };
  students?: unknown[];
  pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
  total?: number;
};

type StatusFilter = "all" | "locked" | "pending" | "approved" | "active" | "completed";

const PAGE_SIZE = 25;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numeric(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value: unknown, fallback: string): string {
  return text(value, fallback).toLowerCase().replace(/[_\s]+/g, "-");
}

function normalizeStudent(value: unknown): Student {
  const raw = record(value);
  const payment = record(raw.payment);
  const fullName =
    text(raw.fullName) ||
    text(raw.name) ||
    [text(raw.firstName), text(raw.lastName)].filter(Boolean).join(" ") ||
    "Student";
  const internshipTrack = text(raw.internshipTrack);
  const internshipPlan = text(raw.internshipPlan);
  const domain =
    text(raw.selectedInternshipDomain) ||
    text(raw.internshipDomain) ||
    text(raw.domain) ||
    internshipTrack ||
    internshipPlan ||
    "Unassigned";
  const createdAt = raw.createdAt instanceof Date
    ? raw.createdAt.toISOString()
    : typeof raw.createdAt === "string" ? raw.createdAt : null;

  return {
    id: text(raw.id) || text(raw._id),
    studentId: text(raw.studentId) || text(raw.dashboardStudentId) || "—",
    fullName,
    email: text(raw.email),
    phone: text(raw.phone),
    domain,
    internshipTrack,
    internshipPlan,
    internshipStatus: normalizeStatus(raw.internshipStatus, "not-started"),
    paymentStatus: normalizeStatus(raw.paymentStatus ?? payment.status, "unpaid"),
    paymentAmount: numeric(raw.paymentAmount ?? payment.amount),
    paymentCurrency: text(raw.paymentCurrency ?? payment.currency, "INR"),
    studentOpsApprovalStatus: normalizeStatus(raw.studentOpsApprovalStatus, "pending"),
    studentOpsStatus: normalizeStatus(raw.studentOpsStatus, "pending"),
    taskCompletionPercentage: numeric(raw.taskCompletionPercentage),
    attendancePercentage: numeric(raw.attendancePercentage),
    createdAt,
  };
}

function extractRows(payload: Payload): unknown[] {
  if (Array.isArray(payload.data?.students)) return payload.data.students;
  if (Array.isArray(payload.students)) return payload.students;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function extractPagination(payload: Payload, fallbackPage: number) {
  const value = payload.data?.pagination ?? payload.pagination ?? {};
  const total = numeric(value.total ?? payload.data?.total ?? payload.total);
  const page = numeric(value.page ?? payload.data?.page) || fallbackPage;
  const limit = numeric(value.limit ?? payload.data?.limit) || PAGE_SIZE;
  const totalPages = numeric(value.totalPages ?? payload.data?.totalPages) ||
    (total ? Math.ceil(total / limit) : 0);
  return { total, page, limit, totalPages };
}

function label(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tone(value: string): string {
  if (["approved", "active", "completed", "paid", "verified"].includes(value))
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["pending", "in-progress", "under-review", "processing"].includes(value))
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (["rejected", "failed", "cancelled", "suspended"].includes(value))
    return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function money(amount: number, currency: string): string {
  if (!amount) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: currency || "INR", maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function Metric({
  title, value, description, icon: Icon, color,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <span className={`rounded-xl p-3 ${color}`}><Icon size={20} /></span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}

export default function StudentAdminInternshipsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [payment, setPayment] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (status !== "all") params.set("internshipStatus", status);
      if (payment !== "all") params.set("paymentStatus", payment);

      const response = await fetch(`/api/student-admin/students?${params}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({})) as Payload;

      if (!response.ok || payload.success === false) {
        if (response.status === 401 || response.status === 403)
          throw new Error("Student Operations session is not authorized. Please sign in again.");
        throw new Error(payload.message || `Unable to load internship records (${response.status}).`);
      }

      const rows = extractRows(payload).map(normalizeStudent);
      const pagination = extractPagination(payload, page);
      setStudents(rows);
      setTotal(pagination.total || rows.length);
      setTotalPages(pagination.totalPages || (rows.length ? 1 : 0));
      setUpdatedAt(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load internship records.");
      if (!silent) setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, status, payment]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(true); }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const metrics = useMemo(() => ({
    paid: students.filter((item) => ["paid", "verified", "success"].includes(item.paymentStatus)).length,
    pending: students.filter((item) => ["pending", "under-review"].includes(item.studentOpsApprovalStatus)).length,
    active: students.filter((item) => ["active", "in-progress"].includes(item.internshipStatus)).length,
  }), [students]);

  const exportCsv = useCallback(() => {
    const headers = [
      "Student ID", "Name", "Email", "Phone", "Domain", "Internship Status",
      "Payment Status", "Payment Amount", "Operations Approval", "Task Completion %",
      "Attendance %",
    ];
    const rows = students.map((item) => [
      item.studentId, item.fullName, item.email, item.phone, item.domain,
      item.internshipStatus, item.paymentStatus, String(item.paymentAmount),
      item.studentOpsApprovalStatus, String(item.taskCompletionPercentage),
      String(item.attendancePercentage),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cybernet-internships-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [students]);

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
          <div className="grid gap-6 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_36%),linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-6 sm:p-8 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                <BriefcaseBusiness size={13} /> Student Operations / Internship Management
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Internship operations</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Monitor student internship selections, payment readiness, operations approvals and learning progress.
                Program definitions remain controlled by Main Admin.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Operations workspace
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  {updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Waiting for API"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Auto refresh: 30 seconds</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void load(true)} disabled={refreshing}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
              </button>
              <button type="button" onClick={exportCsv} disabled={!students.length}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <ArrowDownToLine size={16} /> Export page
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle size={19} className="mt-0.5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-bold text-rose-800">Internship records could not be loaded</p>
                <p className="mt-1 text-xs leading-5 text-rose-700">{error}</p>
              </div>
            </div>
            <button type="button" onClick={() => void load(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700">
              <RefreshCw size={14} /> Try again
            </button>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Matching records" value={loading ? "—" : total} description="Records matching the current filters." icon={Users} color="bg-blue-50 text-blue-600" />
          <Metric title="Paid on this page" value={loading ? "—" : metrics.paid} description="Records marked paid or verified." icon={CreditCard} color="bg-cyan-50 text-cyan-700" />
          <Metric title="Awaiting approval" value={loading ? "—" : metrics.pending} description="Operations approval pending on this page." icon={Clock3} color="bg-amber-50 text-amber-600" />
          <Metric title="Active internships" value={loading ? "—" : metrics.active} description="Active or in-progress records on this page." icon={Activity} color="bg-emerald-50 text-emerald-600" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-950">Student enrollments</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{total} records</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Enrollment and progress records synced to Student Operations.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-xl">
              <label className="relative min-w-0 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name, email, student ID..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
                {searchInput ? <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={15} /></button> : null}
              </label>
              <label className="relative">
                <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select value={payment} onChange={(event) => { setPayment(event.target.value); setPage(1); }}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 sm:w-40">
                  <option value="all">All payments</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            {([
              ["all", "All records"], ["locked", "Locked"], ["pending", "Pending"],
              ["approved", "Approved"], ["active", "Active"], ["completed", "Completed"],
            ] as [StatusFilter, string][]).map(([value, title]) => (
              <button key={value} type="button" onClick={() => { setStatus(value); setPage(1); }}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${status === value ? "bg-blue-600 text-white shadow-md shadow-blue-600/15" : "text-slate-600 hover:bg-slate-100"}`}>
                {title}
              </button>
            ))}
            <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-slate-400 md:inline-flex">
              <ShieldCheck size={14} /> Read-only enrollment view
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4">Student</th>
                  <th className="px-4 py-4">Domain / track</th>
                  <th className="px-4 py-4">Internship status</th>
                  <th className="px-4 py-4">Payment</th>
                  <th className="px-4 py-4">Operations approval</th>
                  <th className="px-4 py-4">Learning progress</th>
                  <th className="px-5 py-4 text-right">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>{Array.from({ length: 7 }).map((__, cell) => (
                    <td key={cell} className="px-4 py-5"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                  ))}</tr>
                )) : students.length ? students.map((student) => (
                  <tr key={student.id || `${student.studentId}-${student.email}`} className="transition hover:bg-blue-50/30">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">
                          {student.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{student.fullName}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{student.studentId}</p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400"><Mail size={11} /> {student.email || "Email unavailable"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-800">{student.domain}</p>
                      <p className="mt-1 text-xs text-slate-500">{student.internshipPlan || student.internshipTrack || "Plan not specified"}</p>
                    </td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone(student.internshipStatus)}`}>{label(student.internshipStatus)}</span></td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone(student.paymentStatus)}`}>{label(student.paymentStatus)}</span>
                      <p className="mt-1 text-[11px] text-slate-500">{money(student.paymentAmount, student.paymentCurrency)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone(student.studentOpsApprovalStatus)}`}>{label(student.studentOpsApprovalStatus)}</span>
                      <p className="mt-1 text-[11px] text-slate-500">{label(student.studentOpsStatus)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-700">{Math.max(0, Math.min(100, student.taskCompletionPercentage))}%</span>
                        <span className="text-slate-400">Tasks</span>
                      </div>
                      <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, student.taskCompletionPercentage))}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">Attendance {Math.max(0, Math.min(100, student.attendancePercentage))}%</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={student.id ? `/student-admin/students?id=${encodeURIComponent(student.id)}` : "/student-admin/students"}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                        View <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><GraduationCap size={25} /></div>
                    <p className="mt-4 text-sm font-bold text-slate-800">No internship records found</p>
                    <p className="mt-1 text-xs text-slate-500">Try another status or payment filter, or refresh after student data synchronization.</p>
                    <button type="button" onClick={() => { setSearchInput(""); setStatus("all"); setPayment("all"); setPage(1); }}
                      className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700">Clear filters</button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Showing {students.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)} of {total} records
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowLeft size={14} /> Previous
              </button>
              <span className="min-w-20 text-center text-xs font-semibold text-slate-600">Page {page} of {Math.max(1, totalPages)}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(Math.max(1, totalPages), current + 1))} disabled={page >= totalPages || loading || totalPages === 0}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-blue-600" /><h3 className="text-sm font-bold text-slate-900">Workflow controls</h3></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              This page is a read-only enrollment overview. Approval or rejection must be connected to the dedicated server-side Student Operations approval workflow before mutation controls are enabled.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/student-admin/applications" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Review applications</Link>
              <Link href="/student-admin/payments" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Verify payments</Link>
            </div>
          </article>
          <article className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-blue-700" /><h3 className="text-sm font-bold text-slate-900">Program ownership</h3></div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Active internship domains, program titles, pricing and duration remain controlled by Main Admin. Student Operations monitors enrollments and progress without creating duplicate catalog entries.
            </p>
            <Link href="/student-admin/assessments" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-blue-700 hover:text-blue-800">Manage weekly assessments <ArrowRight size={14} /></Link>
          </article>
        </section>
      </div>
    </main>
  );
}
