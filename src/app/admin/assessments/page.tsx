"use client";

/**
 * CyberNet Careers — Admin Assessment Management
 * Replace: src/app/admin/assessments/page.tsx
 *
 * This page manages assessment metadata and lifecycle only.
 * Question creation/editing belongs to the separate Questions section.
 * The API is authoritative for authentication, validation and lifecycle rules.
 */

import Link from "next/link";
import {
  AlertCircle,
  Archive,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

const API = "/api/admin/assessments";
const FORMAT = {
  durationMinutes: 60,
  mcqCount: 30,
  mcqMarks: 2,
  codingCount: 2,
  codingMarks: 20,
  totalMarks: 100,
  passingScore: 40,
} as const;

type AssessmentStatus = "draft" | "published" | "archived";
type Assessment = {
  _id: string;
  id?: string;
  assessmentId?: string;
  title: string;
  domain: string;
  domainKey?: string;
  description?: string;
  status: AssessmentStatus;
  isActive?: boolean;
  isSelectable?: boolean;
  totalDurationMinutes?: number;
  durationMinutes?: number;
  totalQuestions?: number;
  passingScore?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  questionStats?: { mcq?: number; coding?: number; total?: number };
};

type ApiPayload = {
  success?: boolean;
  message?: string;
  error?: string | { message?: string; code?: string };
  code?: string;
  data?: unknown;
  items?: unknown;
  assessments?: unknown;
  stats?: Record<string, unknown>;
  requiresConfirmation?: boolean;
};

type AssessmentForm = { title: string; domain: string; description: string };
type Notice = { kind: "success" | "error" | "info"; message: string };

const EMPTY_FORM: AssessmentForm = { title: "", domain: "", description: "" };

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getApiMessage(payload: ApiPayload | null, fallback: string): string {
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
  if (payload?.error && typeof payload.error === "object" && payload.error.message) {
    return payload.error.message;
  }
  return fallback;
}

function normalizeStatus(value: unknown): AssessmentStatus {
  return value === "published" || value === "archived" ? value : "draft";
}

function normalizeAssessment(value: unknown): Assessment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = asText(row._id) || asText(row.id);
  if (!id) return null;
  const questionStats = row.questionStats && typeof row.questionStats === "object"
    ? row.questionStats as Record<string, unknown>
    : {};
  return {
    _id: id,
    id,
    assessmentId: asText(row.assessmentId) || undefined,
    title: asText(row.title) || "Untitled assessment",
    domain: asText(row.domain) || asText(row.domainKey) || "General",
    domainKey: asText(row.domainKey) || undefined,
    description: asText(row.description),
    status: normalizeStatus(row.status),
    isActive: row.isActive !== false,
    isSelectable: row.isSelectable === true,
    totalDurationMinutes: numberOrUndefined(row.totalDurationMinutes ?? row.durationMinutes),
    durationMinutes: numberOrUndefined(row.durationMinutes ?? row.totalDurationMinutes),
    totalQuestions: numberOrUndefined(row.totalQuestions),
    passingScore: numberOrUndefined(row.passingScore),
    createdAt: asText(row.createdAt) || undefined,
    updatedAt: asText(row.updatedAt) || undefined,
    publishedAt: asText(row.publishedAt) || undefined,
    questionStats: {
      mcq: numberOrUndefined(questionStats.mcq) ?? 0,
      coding: numberOrUndefined(questionStats.coding) ?? 0,
      total: numberOrUndefined(questionStats.total) ?? 0,
    },
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function extractAssessments(payload: ApiPayload | null): Assessment[] {
  if (!payload) return [];
  const candidates: unknown[] = [payload.data, payload.assessments, payload.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map(normalizeAssessment).filter((x): x is Assessment => x !== null);
    if (candidate && typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      for (const key of ["items", "assessments", "data", "results"]) {
        if (Array.isArray(record[key])) {
          return (record[key] as unknown[]).map(normalizeAssessment).filter((x): x is Assessment => x !== null);
        }
      }
    }
  }
  return [];
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function statusClasses(status: AssessmentStatus): string {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "archived") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function AdminAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AssessmentStatus>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<AssessmentForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pageError, setPageError] = useState("");
  const requestCounter = useRef(0);

  const selected = useMemo(
    () => assessments.find((item) => item._id === selectedId) ?? null,
    [assessments, selectedId],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assessments.filter((item) => {
      const statusMatches = statusFilter === "all" || item.status === statusFilter;
      const searchMatches = !query || `${item.title} ${item.domain} ${item.assessmentId ?? ""} ${item.description ?? ""}`.toLowerCase().includes(query);
      return statusMatches && searchMatches;
    });
  }, [assessments, search, statusFilter]);

  const loadAssessments = useCallback(async (quiet = false, preferredId?: string) => {
    const requestId = ++requestCounter.current;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setPageError("");
    try {
      const params = new URLSearchParams({ page: "1", limit: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`${API}?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok) throw new Error(getApiMessage(payload, `Unable to load assessments (HTTP ${response.status}).`));
      const rows = extractAssessments(payload);
      if (requestId !== requestCounter.current) return;
      setAssessments(rows);
      setSelectedId((current) => {
        const wanted = preferredId || current;
        const match = rows.find((item) => item._id === wanted);
        return match?._id ?? rows[0]?._id ?? "";
      });
    } catch (error) {
      if (requestId === requestCounter.current) {
        console.error("[ADMIN ASSESSMENTS] load failed", error);
        setPageError(error instanceof Error ? error.message : "Unable to load assessments.");
      }
    } finally {
      if (requestId === requestCounter.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [search, statusFilter]);

  useEffect(() => { void loadAssessments(); }, [loadAssessments]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalMode("create");
  }

  function openEdit(item: Assessment) {
    if (item.status !== "draft") return;
    setForm({ title: item.title, domain: item.domain, description: item.description ?? "" });
    setFormError("");
    setModalMode("edit");
  }

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const domain = form.domain.trim();
    const description = form.description.trim();
    if (title.length < 3 || title.length > 160) {
      setFormError("Title must contain between 3 and 160 characters.");
      return;
    }
    if (domain.length < 2 || domain.length > 120) {
      setFormError("Domain must contain between 2 and 120 characters.");
      return;
    }
    if (description.length > 2000) {
      setFormError("Description cannot exceed 2,000 characters.");
      return;
    }
    if (modalMode === "edit" && selected?.status !== "draft") {
      setFormError("Only draft assessments can be edited.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const isEdit = modalMode === "edit" && selected !== null;
      const body = isEdit
        ? { id: selected._id, title, domain, description }
        : { title, domain, description };
      const response = await fetch(API, {
        method: isEdit ? "PUT" : "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok) throw new Error(getApiMessage(payload, `Unable to ${isEdit ? "update" : "create"} assessment.`));
      const record = normalizeAssessment(payload?.data);
      setModalMode(null);
      setNotice({ kind: "success", message: getApiMessage(payload, isEdit ? "Assessment updated." : "Draft assessment created. Add questions from the Questions section.") });
      await loadAssessments(true, record?._id ?? (isEdit ? selected?._id : undefined));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save assessment.");
    } finally {
      setSaving(false);
    }
  }

  async function changeLifecycle(action: "publish" | "archive" | "return_to_draft") {
    if (!selected || lifecycleBusy) return;
    if (action === "return_to_draft" && selected.status !== "published") return;
    if (action === "archive" && selected.status !== "published") return;
    if (action === "publish" && selected.status !== "draft") return;

    const label = action === "publish" ? "publish" : action === "archive" ? "archive" : "unpublish and return to draft";
    const warning = action === "publish"
      ? `Publish “${selected.title}”? The API will validate the required published question bank first.`
      : action === "archive"
        ? `Archive “${selected.title}”? Students will no longer be able to select it.`
        : `Unpublish “${selected.title}”? This removes it from student selection and unlocks its question bank. Only Super Admin is allowed to do this.`;
    if (!window.confirm(warning)) return;

    setLifecycleBusy(true);
    try {
      const response = await fetch(API, {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          id: selected._id,
          action,
          ...(action === "return_to_draft" ? { confirmUnpublish: true } : {}),
        }),
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok) throw new Error(getApiMessage(payload, `Unable to ${label}.`));
      setNotice({ kind: "success", message: getApiMessage(payload, `Assessment ${label} successful.`) });
      await loadAssessments(true, selected._id);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : `Unable to ${label}.` });
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function deleteDraft() {
    if (!selected || selected.status !== "draft" || deleting) return;
    if (!window.confirm(`Permanently delete draft “${selected.title}” and its question bank? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const response = await fetch(`${API}?id=${encodeURIComponent(selected._id)}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok) throw new Error(getApiMessage(payload, "Unable to delete draft assessment."));
      setNotice({ kind: "success", message: getApiMessage(payload, "Draft assessment deleted successfully.") });
      await loadAssessments(true);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unable to delete draft assessment." });
    } finally {
      setDeleting(false);
    }
  }

  const totalDraft = assessments.filter((item) => item.status === "draft").length;
  const totalPublished = assessments.filter((item) => item.status === "published").length;
  const totalArchived = assessments.filter((item) => item.status === "archived").length;
  const stats = selected?.questionStats;

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] space-y-5">
        <header className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
              <ShieldCheck size={14} /> CyberNet Careers · Admin
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Assessment Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Create and manage assessment records. Add and maintain questions in the separate Questions section.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadAssessments(true)} disabled={refreshing || loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
              <Plus size={16} /> Create assessment
            </button>
          </div>
        </header>

        {pageError && <NoticeBanner kind="error" message={pageError} onClose={() => setPageError("")} />}
        {notice && <NoticeBanner kind={notice.kind} message={notice.message} onClose={() => setNotice(null)} />}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total records loaded" value={assessments.length} detail="Live API results" icon={<BookOpen size={18} />} />
          <Metric label="Draft" value={totalDraft} detail="Editable assessment records" icon={<Pencil size={18} />} />
          <Metric label="Published" value={totalPublished} detail="Published records in current result set" icon={<CheckCircle2 size={18} />} />
          <Metric label="Archived" value={totalArchived} detail="Unavailable for student selection" icon={<Archive size={18} />} />
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black">Assessments</h2>
              <p className="mt-1 text-xs text-slate-500">Search and filter live records. Only draft assessments can be edited or deleted.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_170px]">
              <label className="relative block">
                <span className="sr-only">Search assessments</span>
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={120} placeholder="Search title, domain or ID" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </label>
              <select aria-label="Filter assessment status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | AssessmentStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm font-semibold text-slate-500"><Loader2 size={20} className="animate-spin" /> Loading assessments…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FileQuestion size={34} className="mx-auto text-slate-300" />
              <h3 className="mt-3 font-bold text-slate-800">No assessments found</h3>
              <p className="mt-1 text-sm text-slate-500">Try another filter or create a new assessment draft.</p>
              <button type="button" onClick={openCreate} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><Plus size={15} /> Create assessment</button>
            </div>
          ) : (
            <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="max-h-[760px] overflow-y-auto border-b border-slate-200 p-3 sm:p-4 lg:border-b-0 lg:border-r">
                <div className="space-y-2">
                  {filtered.map((item) => {
                    const active = item._id === selectedId;
                    return (
                      <button key={item._id} type="button" onClick={() => setSelectedId(item._id)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-blue-300 bg-blue-50/70 ring-1 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-extrabold text-slate-900">{item.title}</p>
                            <p className="mt-1 truncate text-xs font-semibold text-blue-700">{item.domain}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-400">{item.assessmentId || item._id}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold capitalize ${statusClasses(item.status)}`}>{item.status}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
                          <span>{FORMAT.mcqCount} MCQ</span><span>{FORMAT.codingCount} coding</span><span>{FORMAT.totalMarks} marks</span><span>Created {formatDate(item.createdAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="px-1 pt-3 text-[11px] text-slate-400">Showing up to 100 records from the API. Use search and status filters to narrow the list.</p>
              </div>

              <div className="min-w-0 p-4 sm:p-6">
                {!selected ? (
                  <div className="flex min-h-80 flex-col items-center justify-center text-center">
                    <FileQuestion size={32} className="text-slate-300" />
                    <p className="mt-3 font-bold">Select an assessment</p>
                    <p className="mt-1 max-w-xs text-sm text-slate-500">Choose a record from the list to view details and available actions.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold capitalize ${statusClasses(selected.status)}`}>{selected.status}</span>
                      {selected.isSelectable && <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">Student selectable</span>}
                    </div>
                    <h2 className="mt-3 break-words text-2xl font-black tracking-tight">{selected.title}</h2>
                    <p className="mt-1 text-sm font-bold text-blue-700">{selected.domain}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selected.description || "No description provided."}</p>

                    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <InfoTile label="MCQ questions" value={`${stats?.mcq ?? 0} / ${FORMAT.mcqCount}`} detail={`${FORMAT.mcqMarks} marks each`} />
                      <InfoTile label="Coding questions" value={`${stats?.coding ?? 0} / ${FORMAT.codingCount}`} detail={`${FORMAT.codingMarks} marks each`} />
                      <InfoTile label="Duration" value={`${selected.totalDurationMinutes ?? FORMAT.durationMinutes} min`} detail="Section timing set by API" />
                      <InfoTile label="Pass score" value={`${selected.passingScore ?? FORMAT.passingScore}%`} detail="API configuration" />
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-extrabold"><Clock3 size={16} className="text-blue-600" /> Assessment format</div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">30 MCQs × 2 marks = 60 marks; 2 coding questions × 20 marks = 40 marks; total 100 marks in 60 minutes. The server validates question counts and content before publishing.</p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link href={`/admin/questions?assessmentId=${encodeURIComponent(selected._id)}`} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100"><FileQuestion size={15} /> Manage questions</Link>
                      {selected.status === "draft" && <button type="button" onClick={() => openEdit(selected)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pencil size={15} /> Edit draft</button>}
                      {selected.status === "draft" && <button type="button" onClick={() => void changeLifecycle("publish")} disabled={lifecycleBusy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{lifecycleBusy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Publish</button>}
                      {selected.status === "published" && <button type="button" onClick={() => void changeLifecycle("archive")} disabled={lifecycleBusy} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60">{lifecycleBusy ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />} Archive</button>}
                      {selected.status === "published" && <button type="button" onClick={() => void changeLifecycle("return_to_draft")} disabled={lifecycleBusy} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60">Unpublish to draft</button>}
                      {selected.status === "draft" && <button type="button" onClick={() => void deleteDraft()} disabled={deleting} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">{deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete draft</button>}
                    </div>
                    <p className="mt-4 text-[11px] leading-5 text-slate-400">Created {formatDate(selected.createdAt)} · Updated {formatDate(selected.updatedAt)} · Published {formatDate(selected.publishedAt)}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalMode(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="assessment-form-title" className="my-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
              <div><h2 id="assessment-form-title" className="text-xl font-black">{modalMode === "create" ? "Create assessment draft" : "Edit assessment draft"}</h2><p className="mt-1 text-sm text-slate-500">Questions are managed in the separate Questions page.</p></div>
              <button type="button" onClick={() => setModalMode(null)} disabled={saving} aria-label="Close dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
            </div>
            <form onSubmit={saveAssessment} className="space-y-4 p-5 sm:p-6">
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Assessment title <span className="text-red-600">*</span></span><input autoFocus required minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Java Full Stack Eligibility Assessment" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Domain <span className="text-red-600">*</span></span><input required minLength={2} maxLength={120} value={form.domain} onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))} placeholder="e.g. Java Full Stack" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><span className="mt-1 block text-xs text-slate-400">Use the same domain as the internship/student eligibility flow.</span></label>
              <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Description</span><textarea rows={4} maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the skills assessed and instructions for students…" className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><span className="mt-1 block text-right text-xs text-slate-400">{form.description.length}/2000</span></label>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">The API creates new assessments as drafts. Publishing is enabled only after the server validates the required 30 published MCQs and 2 published coding questions.</div>
              {formError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{formError}</span></div>}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModalMode(null)} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving && <Loader2 size={15} className="animate-spin" />}{saving ? "Saving…" : modalMode === "create" ? "Create draft" : "Save changes"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{label}</span><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</span></div><p className="mt-3 text-2xl font-black tabular-nums text-slate-950">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>;
}

function InfoTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p></div>;
}

function NoticeBanner({ kind, message, onClose }: { kind: Notice["kind"]; message: string; onClose: () => void }) {
  const styles = kind === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  return <div role={kind === "error" ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${styles}`}><div className="flex min-w-0 items-start gap-2"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p className="break-words">{message}</p></div><button type="button" onClick={onClose} aria-label="Dismiss message" className="shrink-0 rounded-md p-1 hover:bg-black/5"><X size={15} /></button></div>;
}
