"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  UserRoundCheck,
  X,
} from "lucide-react";

type Student = {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  domain: string;
  status: string;
  paymentStatus: string;
  internshipPlanCode: string;
  internshipPlan: string;
  internshipDurationMonths: number;
  internshipDurationDays: number;
  paymentAmount: number;
  paymentCurrency: string;
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

type Metric = {
  title: string;
  value: number;
  description: string;
  href: string;
  icon: typeof Users;
  tone: "blue" | "emerald" | "amber" | "violet" | "cyan" | "orange" | "rose";
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

const PLANS = [
  { code: "ONE_MONTH", name: "1 Month", duration: "30 days", amount: 499, description: "Starter internship plan", tone: "blue" },
  { code: "THREE_MONTHS", name: "3 Months", duration: "90 days", amount: 999, description: "Extended learning plan", tone: "violet" },
  { code: "SIX_MONTHS", name: "6 Months", duration: "180 days", amount: 1699, description: "Complete internship plan", tone: "cyan" },
] as const;

function asNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function asText(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStudent(value: Partial<Student>, index: number): Student {
  const code = asText(value.internshipPlanCode, "").toUpperCase();
  const legacyPlan = asText(value.internshipPlan, "");
  const plan = PLANS.find((item) => item.code === code) ?? PLANS.find((item) => item.name.toLowerCase() === legacyPlan.toLowerCase()) ?? null;
  return {
    id: asText(value.id, asText(value.studentId, `student-${index}`)),
    studentId: asText(value.studentId),
    fullName: asText(value.fullName, "Unnamed student"),
    email: asText(value.email),
    domain: asText(value.domain),
    status: asText(value.status, "Unknown"),
    paymentStatus: asText(value.paymentStatus, "Unknown"),
    internshipPlanCode: plan?.code ?? code,
    internshipPlan: plan?.name ?? legacyPlan,
    internshipDurationMonths: asNonNegativeNumber(value.internshipDurationMonths, plan ? Number(plan.code === "ONE_MONTH" ? 1 : plan.code === "THREE_MONTHS" ? 3 : 6) : 0),
    internshipDurationDays: asNonNegativeNumber(value.internshipDurationDays, plan ? Number(plan.code === "ONE_MONTH" ? 30 : plan.code === "THREE_MONTHS" ? 90 : 180) : 0),
    paymentAmount: asNonNegativeNumber(value.paymentAmount),
    paymentCurrency: asText(value.paymentCurrency, "INR").toUpperCase(),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatCurrency(value: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synchronized";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function getInitials(value: string): string {
  return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function statusTone(value: string): string {
  const status = value.toLowerCase().replace(/[_\s-]+/g, "");
  if (["active", "approved", "paid", "completed", "verified", "success"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["rejected", "failed", "suspended", "cancelled", "inactive", "refunded"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (["pending", "underreview", "processing", "unassigned", "initiated", "paymentpending", "expired"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${statusTone(value)}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" /><span className="truncate">{value.replace(/[_-]+/g, " ")}</span></span>;
}

function MetricCard({ metric, loading }: { metric: Metric; loading: boolean }) {
  const Icon = metric.icon;
  const tones = {
    blue: "border-t-blue-500 bg-blue-50 text-blue-700",
    emerald: "border-t-emerald-500 bg-emerald-50 text-emerald-700",
    amber: "border-t-amber-500 bg-amber-50 text-amber-700",
    violet: "border-t-violet-500 bg-violet-50 text-violet-700",
    cyan: "border-t-cyan-500 bg-cyan-50 text-cyan-700",
    orange: "border-t-orange-500 bg-orange-50 text-orange-700",
    rose: "border-t-rose-500 bg-rose-50 text-rose-700",
  };
  return (
    <Link href={metric.href} className="dashboard-enter group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 border-t-[3px] bg-white p-4 shadow-[0_5px_24px_rgba(15,23,42,0.035)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(15,23,42,0.09)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:p-5" style={{ borderTopColor: undefined }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{metric.title}</p>{loading ? <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-slate-100" /> : <p className="mt-2 text-3xl font-black leading-none tracking-tight text-slate-950">{formatNumber(metric.value)}</p>}</div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[metric.tone]}`}><Icon size={19} strokeWidth={2} /></span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2"><p className="text-[10px] leading-5 text-slate-500 sm:text-[11px]">{metric.description}</p><ArrowUpRight size={15} className="shrink-0 text-slate-300 transition group-hover:text-blue-600" /></div>
    </Link>
  );
}

function SkeletonRows() {
  return <div className="space-y-3 p-4 sm:p-5">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex animate-pulse items-center gap-3 rounded-xl border border-slate-100 p-4"><div className="h-10 w-10 rounded-xl bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-3 w-1/3 rounded bg-slate-100" /><div className="h-2.5 w-1/2 rounded bg-slate-100" /></div><div className="h-6 w-20 rounded-full bg-slate-100" /></div>)}</div>;
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

  const loadDashboard = useCallback(async (showLoader = false) => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const sequence = ++requestSequence.current;
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
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
      if (!response.ok || !result?.success || !result.data) throw new Error(result?.message || `Dashboard request failed (${response.status}).`);
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      const data = result.data;
      const rawStats = data.stats || {};
      const legacyStats = data.statistics || {};
      setStats({
        totalStudents: asNonNegativeNumber(rawStats.totalStudents, asNonNegativeNumber(legacyStats.totalStudents)),
        activeStudents: asNonNegativeNumber(rawStats.activeStudents, asNonNegativeNumber(legacyStats.activeOperationsStudents)),
        pendingApplications: asNonNegativeNumber(rawStats.pendingApplications),
        pendingOperationsApprovals: asNonNegativeNumber(rawStats.pendingOperationsApprovals, asNonNegativeNumber(legacyStats.pendingReviewStudents)),
        failedStudents: asNonNegativeNumber(rawStats.failedStudents, asNonNegativeNumber(legacyStats.rejectedStudents)),
        paidEnrollments: asNonNegativeNumber(rawStats.paidEnrollments, asNonNegativeNumber(legacyStats.paidStudents)),
        pendingPayments: asNonNegativeNumber(rawStats.pendingPayments),
      });
      const records = Array.isArray(data.recentStudents) ? data.recentStudents : Array.isArray(data.students) ? data.students : [];
      setStudents(records.map((student, index) => normalizeStudent(student, index)));
      const rawViewer = data.viewer;
      setViewer(rawViewer ? {
        id: asText(rawViewer.id, ""),
        identifier: asText(rawViewer.identifier, "Student Operations Admin"),
        role: asText(rawViewer.role, "Student Operations Admin"),
      } : null);
      const pagination = data.pagination || {};
      setTotal(asNonNegativeNumber(pagination.total, records.length));
      setTotalPages(asNonNegativeNumber(pagination.totalPages, Math.max(1, Math.ceil(records.length / PAGE_SIZE))));
      setLastUpdated(typeof data.generatedAt === "string" && !Number.isNaN(Date.parse(data.generatedAt)) ? data.generatedAt : new Date().toISOString());
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      console.error("[STUDENT ADMIN DASHBOARD]", requestError);
      setError(requestError instanceof Error ? requestError.message : "Unable to synchronize dashboard data.");
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
    setAppliedSearch(search.trim().slice(0, 120));
  }

  function clearSearch() {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  }

  const metrics = useMemo<Metric[]>(() => [
    { title: "Total students", value: stats.totalStudents, description: "Student records in Operations", href: "/student-admin/students", icon: Users, tone: "blue" },
    { title: "Active students", value: stats.activeStudents, description: "Currently active in the program", href: "/student-admin/students", icon: UserRoundCheck, tone: "emerald" },
    { title: "Pending applications", value: stats.pendingApplications, description: "Waiting for application review", href: "/student-admin/applications", icon: FileText, tone: "amber" },
    { title: "Pending approvals", value: stats.pendingOperationsApprovals, description: "Awaiting Operations decision", href: "/student-admin/applications", icon: ShieldCheck, tone: "violet" },
    { title: "Paid enrollments", value: stats.paidEnrollments, description: "Verified paid enrollments", href: "/student-admin/payments", icon: CreditCard, tone: "cyan" },
    { title: "Pending payments", value: stats.pendingPayments, description: "Awaiting payment confirmation", href: "/student-admin/payments", icon: CircleDollarSign, tone: "orange" },
    { title: "Rejected records", value: stats.failedStudents, description: "Rejected or failed records", href: "/student-admin/students", icon: AlertCircle, tone: "rose" },
  ], [stats]);

  const updatedLabel = lastUpdated ? formatDateTime(lastUpdated) : "Not synchronized";
  const activeRate = stats.totalStudents > 0 ? Math.min(100, Math.round((stats.activeStudents / stats.totalStudents) * 100)) : 0;
  const paymentTotal = stats.paidEnrollments + stats.pendingPayments;
  const paidRate = paymentTotal > 0 ? Math.min(100, Math.round((stats.paidEnrollments / paymentTotal) * 100)) : 0;

  return (
    <main className="mx-auto w-full max-w-[1440px] min-w-0 px-3 pb-8 pt-4 text-slate-900 sm:px-5 sm:pt-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1320px] space-y-5 sm:space-y-6">
        <header className="dashboard-enter flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-600"><span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> CyberNet Careers / Student Operations</div><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Student Admin Dashboard</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">Monitor enrollments, internship plans, payment verification and student progress from one workspace.</p></div>
          <div className="flex flex-wrap items-center gap-2"><div className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600"><span className={`h-2 w-2 rounded-full ${error ? "bg-amber-500" : loading ? "animate-pulse bg-blue-500" : "bg-emerald-500"}`} />{error ? "Sync attention" : loading ? "Connecting" : "System connected"}</div><button type="button" onClick={() => void loadDashboard(false)} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3.5 text-[11px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh</button></div>
        </header>

        {error ? <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><AlertCircle size={19} className="mt-0.5 shrink-0 text-rose-600" /><div><p className="text-sm font-bold text-rose-800">Dashboard synchronization failed</p><p className="mt-1 break-words text-xs leading-5 text-rose-700">{error}</p></div></div><button type="button" onClick={() => void loadDashboard(true)} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"><RefreshCw size={14} /> Try again</button></section> : null}

        <section className="dashboard-enter relative overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_45px_rgba(15,23,42,0.055)]">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blue-100/80 blur-3xl" /><div className="pointer-events-none absolute right-1/3 top-24 h-44 w-44 rounded-full bg-cyan-100/60 blur-3xl" />
          <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center lg:p-9">
            <div className="min-w-0"><span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[9px] font-extrabold tracking-[0.15em] text-blue-700"><Sparkles size={13} /> OPERATIONS CONTROL CENTER</span><h2 className="mt-4 max-w-3xl text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-tight text-slate-950">Student operations, <span className="block bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">under control.</span></h2><p className="mt-4 max-w-2xl text-xs leading-6 text-slate-500 sm:text-sm">Track the complete student journey while keeping Main Admin approval, verified payments and Operations authorization connected.</p><div className="mt-5 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-600"><ShieldCheck size={14} className="text-emerald-600" />{viewer?.role || "Student Operations Admin"}</span><span className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-600"><CalendarDays size={14} className="shrink-0 text-blue-600" /><span className="truncate">Last sync: {updatedLabel}</span></span></div></div>
            <div className="relative overflow-hidden rounded-2xl bg-[#07152f] p-5 text-white shadow-xl shadow-blue-950/15 sm:p-6"><div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border-[28px] border-blue-400/10" /><div className="relative"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-[9px] font-extrabold tracking-[0.16em] text-cyan-200"><Activity size={14} /> DATA SYNCHRONIZATION</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold ${error ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/15 text-emerald-300"}`}>{error ? "ATTENTION" : loading ? "CONNECTING" : "ACTIVE"}</span></div><h3 className="mt-6 text-2xl font-black tracking-tight">{loading ? "Connecting..." : error ? "Sync required" : "Workspace online"}</h3><p className="mt-2 text-[11px] leading-5 text-blue-100/65">Dashboard data is served by the authenticated Student Operations API.</p><div className="mt-6 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/10 bg-white/[0.07] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-blue-100/55">Student records</p><p className="mt-1 text-2xl font-black">{loading ? "—" : formatNumber(stats.totalStudents)}</p></div><div className="rounded-xl border border-white/10 bg-white/[0.07] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-blue-100/55">Active students</p><p className="mt-1 text-2xl font-black">{loading ? "—" : formatNumber(stats.activeStudents)}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[9px] text-blue-100/50"><span>Automatic refresh</span><span>Every 30 seconds</span></div></div></div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.slice(0, 4).map((metric) => <MetricCard key={metric.title} metric={metric} loading={loading} />)}</section>
        <section className="grid gap-3 sm:grid-cols-3">{metrics.slice(4).map((metric) => <MetricCard key={metric.title} metric={metric} loading={loading} />)}</section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_5px_24px_rgba(15,23,42,0.035)] sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.17em] text-blue-600">Performance snapshot</p><h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Operations analytics</h2><p className="mt-1 text-[11px] text-slate-500">Calculated from the statistics returned by the dashboard API.</p></div><span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[9px] font-bold text-slate-500">Live summary</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-600">Active student rate</span><UserRoundCheck size={16} className="text-emerald-600" /></div><div className="mt-3 flex items-end justify-between"><strong className="text-3xl font-black tracking-tight text-slate-950">{loading ? "—" : `${activeRate}%`}</strong><span className="text-[9px] font-semibold text-slate-500">{formatNumber(stats.activeStudents)} / {formatNumber(stats.totalStudents)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${loading ? 0 : activeRate}%` }} /></div><p className="mt-2 text-[9px] text-slate-500">Active records compared with all student records.</p></div><div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-600">Paid payment share</span><CircleDollarSign size={16} className="text-blue-600" /></div><div className="mt-3 flex items-end justify-between"><strong className="text-3xl font-black tracking-tight text-slate-950">{loading ? "—" : `${paidRate}%`}</strong><span className="text-[9px] font-semibold text-slate-500">{formatNumber(stats.paidEnrollments)} / {formatNumber(paymentTotal)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-all duration-700" style={{ width: `${loading ? 0 : paidRate}%` }} /></div><p className="mt-2 text-[9px] text-slate-500">Paid enrollments as a share of paid plus pending.</p></div></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Clock3 size={17} /></span><div className="min-w-0"><p className="text-[9px] text-slate-500">Awaiting review</p><p className="text-lg font-black text-slate-900">{loading ? "—" : formatNumber(stats.pendingOperationsApprovals)}</p></div></div><div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><ArrowDownRight size={17} /></span><div className="min-w-0"><p className="text-[9px] text-slate-500">Rejected records</p><p className="text-lg font-black text-slate-900">{loading ? "—" : formatNumber(stats.failedStudents)}</p></div></div></div></div>

          <aside className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_5px_24px_rgba(15,23,42,0.035)] sm:p-6"><div><p className="text-[9px] font-black uppercase tracking-[0.17em] text-blue-600">Internship enrollment</p><h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Available plan structure</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">Standard plan amounts used by the enrollment flow.</p></div><div className="mt-4 space-y-3">{PLANS.map((plan) => <div key={plan.code} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition duration-200 hover:border-blue-200 hover:bg-blue-50/40"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${plan.tone === "blue" ? "bg-blue-50 text-blue-700" : plan.tone === "violet" ? "bg-violet-50 text-violet-700" : "bg-cyan-50 text-cyan-700"}`}><BriefcaseBusiness size={17} /></span><div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-slate-800">{plan.name}</p><p className="mt-0.5 text-[9px] text-slate-500">{plan.duration} · {plan.description}</p></div><p className="shrink-0 text-sm font-black text-slate-950">{formatCurrency(plan.amount)}</p></div>)}</div><Link href="/student-admin/internships" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-[11px] font-bold text-white transition hover:bg-blue-700">View internship records <ArrowRight size={14} /></Link></aside>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_5px_24px_rgba(15,23,42,0.035)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.17em] text-blue-600">Student operations</p><h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Recent student records</h2><p className="mt-1 text-[11px] text-slate-500">{loading ? "Loading student records..." : `${formatNumber(total)} records available.`}</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><form onSubmit={handleSearch} className="flex min-w-0 gap-2"><label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:w-[270px]"><Search size={15} className="shrink-0 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or ID" maxLength={120} aria-label="Search student records" className="w-full min-w-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />{search ? <button type="button" aria-label="Clear search" onClick={clearSearch} className="text-slate-400 hover:text-slate-700"><X size={14} /></button> : null}</label><button type="submit" disabled={loading} className="h-10 shrink-0 rounded-xl bg-blue-600 px-4 text-[11px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">Search</button></form><Link href="/student-admin/students" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-[11px] font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">View all students <ArrowUpRight size={14} /></Link></div></div>
          {loading ? <SkeletonRows /> : students.length > 0 ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="bg-slate-50/80 text-[9px] font-extrabold uppercase tracking-[0.13em] text-slate-500"><th scope="col" className="px-5 py-4">Student</th><th scope="col" className="px-5 py-4">Student ID</th><th scope="col" className="px-5 py-4">Domain</th><th scope="col" className="px-5 py-4">Internship plan</th><th scope="col" className="px-5 py-4">Operations</th><th scope="col" className="px-5 py-4">Payment</th><th scope="col" className="px-5 py-4">Joined</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id} className="transition hover:bg-blue-50/30"><td className="px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-[10px] font-black text-blue-700">{getInitials(student.fullName) || "ST"}</span><span className="min-w-0"><span className="block max-w-[210px] truncate text-xs font-bold text-slate-900">{student.fullName}</span><span className="mt-1 block max-w-[210px] truncate text-[10px] text-slate-500">{student.email}</span></span></div></td><td className="px-5 py-4 text-xs font-semibold text-slate-600">{student.studentId}</td><td className="px-5 py-4 text-xs text-slate-600">{student.domain}</td><td className="px-5 py-4"><div className="text-xs font-bold text-slate-800">{student.internshipPlan || "Not selected"}</div><div className="mt-1 text-[10px] text-slate-500">{student.internshipDurationDays ? `${student.internshipDurationDays} days` : "Duration pending"}{student.paymentAmount ? ` · ${formatCurrency(student.paymentAmount, student.paymentCurrency)}` : ""}</div></td><td className="px-5 py-4"><StatusBadge value={student.status} /></td><td className="px-5 py-4"><StatusBadge value={student.paymentStatus} /></td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(student.createdAt)}</td></tr>)}</tbody></table></div><div className="grid gap-3 p-3 md:hidden">{students.map((student) => <article key={student.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-[10px] font-black text-blue-700">{getInitials(student.fullName) || "ST"}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-slate-900">{student.fullName}</p><p className="mt-1 truncate text-[10px] text-slate-500">{student.email}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{student.studentId}</p></div><StatusBadge value={student.paymentStatus} /></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3"><div><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Domain</p><p className="mt-1 truncate text-[11px] font-semibold text-slate-700">{student.domain}</p></div><div><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Internship plan</p><p className="mt-1 text-[11px] font-semibold text-slate-700">{student.internshipPlan || "Not selected"}</p><p className="text-[9px] text-slate-500">{student.internshipDurationDays ? `${student.internshipDurationDays} days` : "Duration pending"}{student.paymentAmount ? ` · ${formatCurrency(student.paymentAmount, student.paymentCurrency)}` : ""}</p></div><div className="col-span-2 flex items-center justify-between gap-2"><StatusBadge value={student.status} /><span className="text-[9px] text-slate-400">Joined {formatDate(student.createdAt)}</span></div></div></article>)}</div></> : <div className="px-5 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Users size={21} /></span><h3 className="mt-4 text-sm font-bold text-slate-800">{appliedSearch ? "No matching students" : "No student records yet"}</h3><p className="mt-1 text-xs text-slate-500">{appliedSearch ? "Try another name, email or student ID." : "Student records will appear here after they are synchronized to Operations."}</p>{appliedSearch ? <button type="button" onClick={clearSearch} className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700">Clear search</button> : null}</div>}
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-[10px] text-slate-500">{loading ? "Synchronizing records..." : total === 0 ? "No records" : `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, total)}–${Math.min(page * PAGE_SIZE, total)} of ${formatNumber(total)}`}</p><div className="flex items-center justify-between gap-2 sm:justify-end"><button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} /> Previous</button><span className="min-w-[64px] text-center text-[10px] font-bold text-slate-600">{totalPages > 0 ? `${page} / ${totalPages}` : "0 / 0"}</span><button type="button" disabled={loading || totalPages === 0 || page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={14} /></button></div></div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2"><div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm"><ShieldCheck size={18} /></span><div><h3 className="text-xs font-extrabold text-slate-900">Main Admin connected workflow</h3><p className="mt-1 text-[10px] leading-5 text-slate-600">Student Operations displays synchronized records. Main Admin payment verification and application decisions remain authoritative; dashboard metrics do not grant approvals.</p></div></div><div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600"><CheckCircle2 size={18} /></span><div><h3 className="text-xs font-extrabold text-slate-900">Protected student access</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">Student dashboard access remains subject to verified payment, Operations approval and credential generation on the server.</p></div></div></section>

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-[10px] text-slate-400 sm:flex-row sm:items-center"><p>© {new Date().getFullYear()} CyberNet Careers · Student Operations</p><p className="flex items-center gap-2"><ShieldCheck size={13} /> Protected administrative workspace</p></footer>
      </div>
      {refreshing ? <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-semibold text-slate-600 shadow-xl"><LoaderCircle size={15} className="animate-spin text-blue-600" /> Synchronizing dashboard</div> : null}
      <style jsx>{`@keyframes dashboardEnter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.dashboard-enter{animation:dashboardEnter .55s cubic-bezier(.2,.7,.2,1) both}@media(prefers-reduced-motion:reduce){.dashboard-enter{animation:none}*{scroll-behavior:auto!important;transition-duration:.01ms!important}}`}</style>
    </main>
  );
}
