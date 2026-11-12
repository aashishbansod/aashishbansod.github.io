"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type InternshipStatus = "active" | "inactive" | "draft" | "closed";
type PlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";

type Internship = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  domain?: string;
  assessmentDomain?: string;
  planCode?: string;
  duration?: string;
  durationMonths?: number;
  price?: string | number;
  priceInPaise?: number;
  currency?: string;
  mode?: string;
  location?: string;
  stipend?: string | number;
  status?: string;
  isPublic?: boolean;
  isSelectable?: boolean;
  applicationRequired?: boolean;
  assessmentRequired?: boolean;
  applications?: number;
  applicants?: number;
  enrolledStudents?: number;
  maxStudents?: number;
  skills?: string[];
  technologies?: string[];
  requirements?: string[];
  responsibilities?: string[];
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

type ApiData = Internship[] | {
  internships?: Internship[];
  items?: Internship[];
  data?: Internship[];
  created?: Internship[];
  plans?: Internship[];
} | null | undefined;

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: ApiData;
  internships?: Internship[];
  items?: Internship[];
  created?: Internship[];
  plans?: Internship[];
  deleted?: boolean;
  closed?: boolean;
};

type CreateForm = {
  description: string;
  domain: string;
  mode: string;
  status: InternshipStatus;
  skills: string;
  technologies: string;
};

type PlanInfo = {
  code: PlanCode;
  duration: string;
  months: number;
  price: number;
  label: string;
};

type InternshipStats = {
  total: number;
  active: number;
  inactive: number;
  draft: number;
  closed: number;
  applications: number;
  enrolled: number;
};

const PLAN_CONFIG: PlanInfo[] = [
  { code: "ONE_MONTH", duration: "1 Month", months: 1, price: 499, label: "Starter" },
  { code: "THREE_MONTHS", duration: "3 Months", months: 3, price: 999, label: "Popular" },
  { code: "SIX_MONTHS", duration: "6 Months", months: 6, price: 1699, label: "Advanced" },
];

const INITIAL_FORM: CreateForm = {
  description: "",
  domain: "",
  mode: "Remote",
  status: "draft",
  skills: "",
  technologies: "",
};

const PAGE_SIZE = 10;

function normalizeInternships(payload: ApiResponse): Internship[] {
  if ( Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    if (Array.isArray(payload.data.internships)) return payload.data.internships;
    if (Array.isArray(payload.data.items)) return payload.data.items;
    if (Array.isArray(payload.data.data)) return payload.data.data;
    if (Array.isArray(payload.data.created)) return payload.data.created;
    if (Array.isArray(payload.data.plans)) return payload.data.plans;
  }
  if (Array.isArray(payload?.internships)) return payload.internships;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.created)) return payload.created;
  if (Array.isArray(payload?.plans)) return payload.plans;
  return [];
}

function getId(item: Internship): string {
  return String(item._id || item.id || "");
}

function getTitle(item: Internship): string {
  return item.title?.trim() || item.name?.trim() || "Untitled Internship";
}

function getDomain(item: Internship): string {
  return item.domain?.trim() || item.assessmentDomain?.trim() || "General";
}

function getStatus(item: Internship): InternshipStatus {
  const value = String(item.status || "draft").toLowerCase();
  return value === "active" || value === "inactive" || value === "closed" || value === "draft" ? value : "draft";
}

function getPlanCode(item: Internship): PlanCode | null {
  const value = String(item.planCode || "").toUpperCase();
  if (value === "ONE_MONTH" || value === "THREE_MONTHS" || value === "SIX_MONTHS") return value;
  const duration = String(item.duration || "").toLowerCase();
  if (duration.includes("1 month") || duration === "1") return "ONE_MONTH";
  if (duration.includes("3 month") || duration === "3") return "THREE_MONTHS";
  if (duration.includes("6 month") || duration === "6") return "SIX_MONTHS";
  return null;
}

function getPlanInfo(item: Internship): PlanInfo | null {
  const code = getPlanCode(item);
  return code ? PLAN_CONFIG.find((plan) => plan.code === code) || null : null;
}

function getPrice(item: Internship): number {
  const paise = Number(item.priceInPaise);
  if (Number.isFinite(paise) && paise >= 0) return paise / 100;
  const raw = Number(item.price);
  if (item.price !== undefined && item.price !== null && Number.isFinite(raw) && raw >= 0) return raw;
  const plan = getPlanInfo(item);
  return plan?.price ?? 0;
}

function getCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function parseTags(value: string): string[] {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean))).slice(0, 30);
}

function generateProgramTitle(domain: string): string {
  const value = domain.trim();
  if (!value) return "Internship Program";
  return value.toLowerCase().endsWith("internship") ? value : `${value} Internship`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("The server returned an invalid response. Please refresh and try again.");
  }
  return (await response.json()) as ApiResponse;
}

function Icon({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>;
}

function StatusBadge({ status }: { status: InternshipStatus }) {
  const styles: Record<InternshipStatus, string> = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    inactive: "border-slate-200 bg-slate-100 text-slate-600",
    draft: "border-amber-200 bg-amber-50 text-amber-700",
    closed: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${styles[status]}`}><span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : status === "draft" ? "bg-amber-500" : status === "closed" ? "bg-rose-500" : "bg-slate-400"}`} />{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function StatCard({ label, value, helper, tone, icon, loading }: { label: string; value: number; helper: string; tone: string; icon: React.ReactNode; loading: boolean }) {
  return <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"><div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-500/[0.04] blur-2xl transition group-hover:bg-blue-500/[0.09]" /><div className="relative flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{loading ? "—" : value.toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-slate-400">{helper}</p></div><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon>{icon}</Icon></div></div></article>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>{children}</label>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p></div>;
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : (parts[0] || "IN").slice(0, 2).toUpperCase();
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function AdminInternshipsPage() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Internship | null>(null);
  const [form, setForm] = useState<CreateForm>(INITIAL_FORM);

  const loadInternships = useCallback(async (isRefresh = false, signal?: AbortSignal) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const response = await fetch("/api/admin/internships", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal,
      });
      const payload = await readApiResponse(response);
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || payload.error || `Unable to load internships (HTTP ${response.status}).`);
      }
      setInternships(normalizeInternships(payload));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(getErrorMessage(err, "Unable to load internship records."));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadInternships(false, controller.signal);
    return () => controller.abort();
  }, [loadInternships]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadInternships(true);
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadInternships]);

  const stats = useMemo(() => internships.reduce<InternshipStats>((acc, item) => {
    acc.total += 1;
    acc[getStatus(item)] += 1;
    acc.applications += getCount(item.applications ?? item.applicants);
    acc.enrolled += getCount(item.enrolledStudents);
    return acc;
  }, { total: 0, active: 0, inactive: 0, draft: 0, closed: 0, applications: 0, enrolled: 0 }), [internships]);

  const filteredInternships = useMemo(() => {
    const query = search.trim().toLowerCase();
    return internships.filter((item) => {
      if (statusFilter !== "all" && getStatus(item) !== statusFilter) return false;
      if (!query) return true;
      const values = [getTitle(item), getDomain(item), item.description, item.duration, item.planCode, item.mode, item.location, ...(item.skills || []), ...(item.technologies || [])];
      return values.filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [internships, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInternships.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleInternships = filteredInternships.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [search, statusFilter]);

  function updateForm<K extends keyof CreateForm>(field: K, value: CreateForm[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function openCreateModal() {
    setError("");
    setSuccess("");
    setForm(INITIAL_FORM);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
    setForm(INITIAL_FORM);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    const domain = form.domain.trim();
    const description = form.description.trim();
    if (!domain || domain.length > 100) {
      setError("Enter a valid internship domain (maximum 100 characters).");
      return;
    }
    if (!description || description.length > 3000) {
      setError("Enter an internship description (maximum 3,000 characters).");
      return;
    }
    setError("");
    setSuccess("");
    setCreating(true);
    try {
      const title = generateProgramTitle(domain);
      const response = await fetch("/api/admin/internships", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          title,
          name: title,
          description,
          domain,
          mode: form.mode,
          status: form.status,
          skills: parseTags(form.skills),
          technologies: parseTags(form.technologies),
          createAllPlans: true,
          planDurations: ["1 Month", "3 Months", "6 Months"],
        }),
      });
      const result = await readApiResponse(response);
      if (!response.ok || result.success === false) {
        throw new Error(result.message || result.error || `Unable to create internship (HTTP ${response.status}).`);
      }
      setShowCreateModal(false);
      setForm(INITIAL_FORM);
      setSuccess(result.message || "Internship program created. The server has processed the three duration plans.");
      await loadInternships(true);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create internship."));
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(item: Internship, nextStatus: "active" | "inactive") {
    const id = getId(item);
    if (!id) {
      setError("This internship record has no valid ID.");
      return;
    }
    if (updatingStatusId || deletingId || creating || getStatus(item) === nextStatus) return;
    setError("");
    setSuccess("");
    setUpdatingStatusId(id);
    try {
      const response = await fetch("/api/admin/internships", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, internshipId: id, status: nextStatus, action: nextStatus === "active" ? "activate" : "deactivate" }),
      });
      const result = await readApiResponse(response);
      if (!response.ok || result.success === false) {
        throw new Error(result.message || result.error || `Unable to update status (HTTP ${response.status}).`);
      }
      await loadInternships(true);
      setSuccess(result.message || `${getTitle(item)} status updated to ${nextStatus}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update internship status."));
      await loadInternships(true);
    } finally {
      setUpdatingStatusId("");
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deletingId) return;
    const id = getId(deleteTarget);
    if (!id) {
      setError("This internship record has no valid ID.");
      setDeleteTarget(null);
      return;
    }
    setDeletingId(id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/internships?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = await readApiResponse(response);
      if (!response.ok || result.success === false) {
        throw new Error(result.message || result.error || `Unable to remove internship (HTTP ${response.status}).`);
      }
      setDeleteTarget(null);
      setSelectedInternship(null);
      setSuccess(result.closed ? "This plan has historical activity and was safely closed instead of permanently deleted." : result.message || "Internship plan deleted successfully.");
      await loadInternships(true);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete internship."));
    } finally {
      setDeletingId("");
    }
  }

  function exportCurrentResults() {
    if (!filteredInternships.length) return;
    const headers = ["Title", "Domain", "Plan", "Price (INR)", "Applications", "Enrolled", "Status", "Mode", "Created At", "Record ID"];
    const rows = filteredInternships.map((item) => [
      getTitle(item), getDomain(item), getPlanInfo(item)?.duration || item.duration || "", getPrice(item),
      getCount(item.applications ?? item.applicants), getCount(item.enrolledStudents), getStatus(item), item.mode || "", item.createdAt || "", getId(item),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cybernet-internships-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const inputClass = "form-input";

  return (
    <main className="min-h-screen bg-[#f4f7fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1560px] space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/[0.08] blur-3xl" />
          <div className="relative flex flex-col gap-6 p-6 sm:p-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600"><span className="h-2 w-2 rounded-full bg-blue-600" />CyberNet Careers · Admin Workspace</div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Internship Management</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage internship programs, duration plans, availability and enrollment activity from one workspace.</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live API data</span><span>Auto-refresh every 30 seconds</span><span>{internships.length.toLocaleString("en-IN")} records loaded</span></div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void loadInternships(true)} disabled={loading || refreshing} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60"><Icon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" /></Icon>{refreshing ? "Refreshing" : "Refresh"}</button>
              <button type="button" onClick={exportCurrentResults} disabled={!filteredInternships.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><Icon className="h-4 w-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></Icon>Export CSV</button>
              <button type="button" onClick={openCreateModal} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600"><Icon className="h-4 w-4"><path d="M12 5v14M5 12h14" /></Icon>Create Internship</button>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70 sm:grid-cols-4">
            {[{ label: "Active plans", value: stats.active }, { label: "Draft plans", value: stats.draft }, { label: "Applications", value: stats.applications }, { label: "Enrolled students", value: stats.enrolled }].map((item) => <div key={item.label} className="border-b border-r border-slate-100 px-6 py-4 last:border-r-0 sm:border-b-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p><p className="mt-1 text-xl font-black text-slate-950">{loading ? "—" : item.value.toLocaleString("en-IN")}</p></div>)}
          </div>
        </header>

        {success && <div role="status" className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100"><Icon><path d="m5 12 4 4L19 6" /></Icon></span><div><p className="font-black">Action completed</p><p className="mt-1 leading-6">{success}</p></div></div><button type="button" onClick={() => setSuccess("")} className="text-xs font-bold">Dismiss</button></div>}
        {error && <div role="alert" className="flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100"><Icon><path d="M12 9v4m0 4h.01" /><path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></Icon></span><div><p className="font-black">Unable to complete request</p><p className="mt-1 leading-6">{error}</p></div></div><button type="button" onClick={() => setError("")} className="text-xs font-bold">Dismiss</button></div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total internship plans" value={stats.total} helper="All plan records" loading={loading} tone="bg-blue-50 text-blue-600" icon={<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4m8-4v4M3 9h18" /></>} />
          <StatCard label="Active plans" value={stats.active} helper="Available according to plan status" loading={loading} tone="bg-emerald-50 text-emerald-600" icon={<path d="m5 12 4 4L19 6" />} />
          <StatCard label="Student enrollments" value={stats.enrolled} helper="Enrollment count reported by API" loading={loading} tone="bg-cyan-50 text-cyan-700" icon={<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6m1-14a3 3 0 0 1 0 6m1 2c2 .7 3 2.2 3 4" /></>} />
          <StatCard label="Applications" value={stats.applications} helper="Application count reported by API" loading={loading} tone="bg-violet-50 text-violet-600" icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8m-8 4h5" /></>} />
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
            <div><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-black text-slate-950">Internship directory</h2><span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{filteredInternships.length} matching</span></div><p className="mt-1 text-sm text-slate-500">Search, filter and manage the internship plan records returned by the server.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative sm:w-80"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon className="h-4 w-4"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon></span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search domain, title, skill..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status" className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option><option value="closed">Closed</option></select>
            </div>
          </div>

          {loading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="animate-pulse rounded-2xl border border-slate-100 p-5"><div className="h-5 w-52 rounded bg-slate-200" /><div className="mt-3 h-4 w-72 rounded bg-slate-100" /><div className="mt-5 h-10 rounded bg-slate-100" /></div>)}</div> : visibleInternships.length === 0 ? <div className="px-6 py-20 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon className="h-7 w-7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4m8-4v4M3 9h18" /></Icon></div><h3 className="mt-5 text-lg font-black text-slate-900">{internships.length ? "No matching internships" : "No internship plans yet"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{internships.length ? "Try changing your search or status filter." : "Create an internship program to add its duration plans to the directory."}</p>{!internships.length && <button type="button" onClick={openCreateModal} className="mt-6 h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700">Create Internship</button>}</div> : <>
            <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1120px]"><thead><tr className="border-b border-slate-200 bg-slate-50/80 text-left"><th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Internship</th><th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Plan & pricing</th><th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Activity</th><th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th><th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Created</th><th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleInternships.map((item, index) => { const id = getId(item); const status = getStatus(item); const plan = getPlanInfo(item); return <tr key={id || `${getTitle(item)}-${index}`} className="transition hover:bg-blue-50/30"><td className="px-6 py-5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-black text-white">{initials(getTitle(item))}</div><div className="min-w-0"><p className="max-w-[300px] truncate text-sm font-black text-slate-950">{getTitle(item)}</p><p className="mt-1 max-w-[320px] truncate text-xs text-slate-500">{getDomain(item)} · {item.mode || "Mode not set"}</p></div></div></td><td className="px-6 py-5"><p className="text-sm font-black text-slate-900">{plan?.duration || item.duration || "Plan not set"}</p><p className="mt-1 text-xs font-bold text-blue-700">{formatMoney(getPrice(item))}</p></td><td className="px-6 py-5"><p className="text-sm font-bold text-slate-800">{getCount(item.applications ?? item.applicants)} applications</p><p className="mt-1 text-xs text-slate-500">{getCount(item.enrolledStudents)} enrolled</p></td><td className="px-6 py-5"><StatusBadge status={status} /></td><td className="px-6 py-5 text-sm font-medium text-slate-500">{formatDate(item.createdAt)}</td><td className="px-6 py-5"><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelectedInternship(item)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">View</button>{(status === "active" || status === "inactive") && <button type="button" onClick={() => void handleStatusChange(item, status === "active" ? "inactive" : "active")} disabled={Boolean(updatingStatusId || deletingId || creating)} className={`h-9 rounded-lg border px-3 text-xs font-black disabled:opacity-50 ${status === "active" ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>{updatingStatusId === id ? "Saving..." : status === "active" ? "Deactivate" : "Activate"}</button>}<button type="button" onClick={() => setDeleteTarget(item)} disabled={Boolean(deletingId)} className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50 disabled:opacity-50">Remove</button></div></td></tr>; })}</tbody></table></div>
            <div className="grid gap-4 p-4 lg:hidden">{visibleInternships.map((item, index) => { const id = getId(item); const status = getStatus(item); const plan = getPlanInfo(item); return <article key={id || `${getTitle(item)}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-black text-white">{initials(getTitle(item))}</div><div className="min-w-0"><h3 className="truncate text-sm font-black text-slate-950">{getTitle(item)}</h3><p className="mt-1 truncate text-xs font-semibold text-blue-600">{getDomain(item)}</p></div></div><StatusBadge status={status} /></div><div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Duration</p><p className="mt-1 text-sm font-black text-slate-900">{plan?.duration || item.duration || "—"}</p></div><p className="text-xl font-black text-blue-700">{formatMoney(getPrice(item))}</p></div></div><div className="mt-3 grid grid-cols-2 gap-3"><DetailItem label="Applications" value={String(getCount(item.applications ?? item.applicants))} /><DetailItem label="Enrolled" value={String(getCount(item.enrolledStudents))} /><DetailItem label="Mode" value={item.mode || "—"} /><DetailItem label="Created" value={formatDate(item.createdAt)} /></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSelectedInternship(item)} className="h-10 rounded-xl border border-slate-200 text-sm font-black text-slate-700 hover:bg-slate-50">View details</button>{(status === "active" || status === "inactive") ? <button type="button" onClick={() => void handleStatusChange(item, status === "active" ? "inactive" : "active")} disabled={Boolean(updatingStatusId || deletingId)} className="h-10 rounded-xl border border-blue-200 bg-blue-50 text-sm font-black text-blue-700 disabled:opacity-50">{updatingStatusId === id ? "Saving..." : status === "active" ? "Deactivate" : "Activate"}</button> : <button type="button" onClick={() => setDeleteTarget(item)} className="h-10 rounded-xl border border-rose-200 text-sm font-black text-rose-600 hover:bg-rose-50">Remove plan</button>}</div></article>; })}</div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-medium text-slate-500">Showing <span className="font-black text-slate-800">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredInternships.length)}</span> of <span className="font-black text-slate-800">{filteredInternships.length}</span> matching plans</p><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40">Previous</button><span className="px-2 text-xs font-bold text-slate-500">Page {currentPage} of {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40">Next</button></div></div>
          </>}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Configured duration pricing</p><p className="mt-1 text-sm text-slate-600">Displayed plan prices are informational. The backend remains authoritative during creation and payment.</p></div><div className="grid grid-cols-3 gap-2 sm:gap-3">{PLAN_CONFIG.map((plan) => <div key={plan.code} className="rounded-xl border border-white bg-white/90 px-3 py-3 text-center shadow-sm"><p className="text-[10px] font-bold text-slate-500">{plan.duration}</p><p className="mt-1 text-base font-black text-slate-950">{formatMoney(plan.price)}</p></div>)}</div></div></section>
      </div>

      {showCreateModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreateModal(); }}><section role="dialog" aria-modal="true" aria-labelledby="create-internship-title" className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 p-5 sm:p-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">New program</p><h2 id="create-internship-title" className="mt-2 text-2xl font-black text-slate-950">Create Internship</h2><p className="mt-1 text-sm text-slate-500">One program submission requests all three duration plans.</p></div><button type="button" onClick={closeCreateModal} disabled={creating} aria-label="Close create dialog" className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50"><Icon><path d="m7 7 10 10M17 7 7 17" /></Icon></button></div><form onSubmit={handleCreate} className="min-h-0 flex-1 overflow-y-auto"><div className="space-y-5 p-5 sm:p-6"><div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-sm font-black text-blue-950">Automatic plan structure</p><p className="mt-1 text-xs leading-5 text-blue-800">The existing API receives the three configured durations. Final plan creation and prices are validated by the backend.</p><div className="mt-4 grid grid-cols-3 gap-2">{PLAN_CONFIG.map((plan) => <div key={plan.code} className="rounded-xl border border-white bg-white p-3 text-center"><p className="text-[10px] font-bold text-slate-500">{plan.label}</p><p className="mt-1 text-xs font-black text-slate-800">{plan.duration}</p><p className="mt-1 text-sm font-black text-blue-700">{formatMoney(plan.price)}</p></div>)}</div></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Internship domain" required><input value={form.domain} onChange={(event) => updateForm("domain", event.target.value)} placeholder="e.g. Java Full Stack" maxLength={100} required className={inputClass} /></Field><Field label="Mode"><select value={form.mode} onChange={(event) => updateForm("mode", event.target.value)} className={inputClass}><option value="Remote">Remote</option><option value="Hybrid">Hybrid</option><option value="On-site">On-site</option></select></Field></div><div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4"><p className="text-xs font-black uppercase tracking-wider text-violet-700">Generated title preview</p><p className="mt-1 text-sm font-bold text-violet-950">{generateProgramTitle(form.domain)}</p></div><Field label="Initial status"><select value={form.status} onChange={(event) => updateForm("status", event.target.value as InternshipStatus)} className={inputClass}><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="closed">Closed</option></select></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Skills · comma separated"><input value={form.skills} onChange={(event) => updateForm("skills", event.target.value)} placeholder="Java, Spring Boot, REST API" maxLength={500} className={inputClass} /></Field><Field label="Technologies · comma separated"><input value={form.technologies} onChange={(event) => updateForm("technologies", event.target.value)} placeholder="Java, MySQL, Git, React" maxLength={500} className={inputClass} /></Field></div><Field label="Internship description" required><textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Describe the internship, learning outcomes, projects and responsibilities..." rows={6} maxLength={3000} required className={`${inputClass} resize-y`} /><span className="mt-1 block text-right text-[10px] text-slate-400">{form.description.length}/3000</span></Field></div><div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end sm:p-5"><button type="button" onClick={closeCreateModal} disabled={creating} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={creating || !form.domain.trim() || !form.description.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 text-sm font-black text-white shadow-lg shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50">{creating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{creating ? "Creating plans..." : "Create internship plans"}</button></div></form></section></div>}

      {selectedInternship && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedInternship(null); }}><section role="dialog" aria-modal="true" aria-labelledby="internship-details-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 p-5 sm:p-6"><div className="flex min-w-0 items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-black text-white">{initials(getTitle(selectedInternship))}</div><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-blue-600">Internship details</p><h2 id="internship-details-title" className="mt-1 truncate text-xl font-black text-slate-950">{getTitle(selectedInternship)}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{getDomain(selectedInternship)}</p></div></div><button type="button" onClick={() => setSelectedInternship(null)} aria-label="Close details" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><Icon><path d="m7 7 10 10M17 7 7 17" /></Icon></button></div><div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={getStatus(selectedInternship)} /><span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{getPlanInfo(selectedInternship)?.duration || selectedInternship.duration || "Plan not set"}</span></div><div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{selectedInternship.description || "No description available."}</p></div><div className="grid gap-3 sm:grid-cols-2"><DetailItem label="Plan price" value={formatMoney(getPrice(selectedInternship))} /><DetailItem label="Plan code" value={selectedInternship.planCode || "—"} /><DetailItem label="Mode" value={selectedInternship.mode || "—"} /><DetailItem label="Location" value={selectedInternship.location || "—"} /><DetailItem label="Applications" value={String(getCount(selectedInternship.applications ?? selectedInternship.applicants))} /><DetailItem label="Enrolled students" value={String(getCount(selectedInternship.enrolledStudents))} /><DetailItem label="Maximum students" value={selectedInternship.maxStudents ? String(selectedInternship.maxStudents) : "Unlimited / not set"} /><DetailItem label="Stipend" value={selectedInternship.stipend ? String(selectedInternship.stipend) : "—"} /><DetailItem label="Public listing" value={selectedInternship.isPublic === false ? "No" : "Yes / not restricted"} /><DetailItem label="Student selectable" value={selectedInternship.isSelectable === false ? "No" : "Yes / not restricted"} /><DetailItem label="Created" value={formatDate(selectedInternship.createdAt)} /><DetailItem label="Last updated" value={formatDate(selectedInternship.updatedAt)} /></div>{(selectedInternship.skills?.length || selectedInternship.technologies?.length) ? <div className="space-y-4">{selectedInternship.skills && selectedInternship.skills.length > 0 && <div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Skills</p><div className="mt-2 flex flex-wrap gap-2">{selectedInternship.skills.map((value, index) => <span key={`${value}-${index}`} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{value}</span>)}</div></div>}{selectedInternship.technologies && selectedInternship.technologies.length > 0 && <div><p className="text-xs font-black uppercase tracking-wider text-slate-400">Technologies</p><div className="mt-2 flex flex-wrap gap-2">{selectedInternship.technologies.map((value, index) => <span key={`${value}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">{value}</span>)}</div></div>}</div> : null}<div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Record ID</p><p className="mt-1 break-all font-mono text-xs text-slate-600">{getId(selectedInternship) || "Not available"}</p></div></div><div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-between"><button type="button" onClick={() => setDeleteTarget(selectedInternship)} className="h-10 rounded-xl border border-rose-200 bg-white px-5 text-sm font-black text-rose-600 hover:bg-rose-50">Remove plan</button><button type="button" onClick={() => setSelectedInternship(null)} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800">Close</button></div></section></div>}

      {deleteTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingId) setDeleteTarget(null); }}><section role="dialog" aria-modal="true" aria-labelledby="delete-internship-title" className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Icon className="h-6 w-6"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 5v5m4-5v5" /></Icon></div><h2 id="delete-internship-title" className="mt-5 text-xl font-black text-slate-950">Remove internship plan?</h2><p className="mt-2 text-sm leading-6 text-slate-500">You are requesting removal of <strong className="text-slate-800">{getPlanInfo(deleteTarget)?.duration || deleteTarget.duration || "this"}</strong> from <strong className="text-slate-800">{getTitle(deleteTarget)}</strong>.</p><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs leading-5 text-amber-800">If the plan has student or payment history, the server should preserve the record by closing it rather than deleting historical data.</p></div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingId)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="button" onClick={() => void handleDelete()} disabled={Boolean(deletingId)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-60">{deletingId && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{deletingId ? "Processing..." : "Confirm removal"}</button></div></div></section></div>}

      <style jsx global>{`
        .form-input{display:block;width:100%;min-height:44px;border-radius:.75rem;border:1px solid rgb(226 232 240);background:#fff;padding:.7rem .9rem;font-size:.875rem;line-height:1.25rem;color:rgb(15 23 42);outline:none;transition:border-color 150ms ease,box-shadow 150ms ease}
        .form-input::placeholder{color:rgb(148 163 184)}
        .form-input:focus{border-color:rgb(59 130 246);box-shadow:0 0 0 4px rgb(59 130 246 / .1)}
        .form-input:disabled{cursor:not-allowed;opacity:.6;background:rgb(248 250 252)}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
      `}</style>
    </main>
  );
}
