"use client";

import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileArchive,
  Filter,
  GraduationCap,
  Lock,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlock,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

type AssessmentStatus = "draft" | "locked" | "published" | "archived";
type SubmissionType = "zip" | "pdf" | "images" | "github" | "multiple";

type AssessmentTask = {
  title: string;
  topic: string;
  instructions: string;
  marks: number;
};

type WeeklyAssessment = {
  id: string;
  title: string;
  domain: string;
  module: string;
  week: number;
  type: "practical";
  topics: string[];
  tasks: AssessmentTask[];
  totalMarks: number;
  passingMarks: number;
  startAt: string;
  deadline: string;
  submissionType: SubmissionType;
  status: AssessmentStatus;
  assignedCount: number;
  submittedCount: number;
  reviewedCount: number;
  createdAt?: string;
  updatedAt?: string;
};

type ApiPayload = {
  success?: boolean;
  message?: string;
  code?: string;
  assessments?: unknown[];
  internships?: unknown[];
  domains?: unknown[];
  data?: unknown;
  pagination?: { total?: number; page?: number; limit?: number; totalPages?: number };
};

type Notice = { kind: "success" | "error" | "info"; message: string };

type FormState = {
  title: string;
  domain: string;
  module: string;
  week: string;
  topicsText: string;
  tasks: AssessmentTask[];
  totalMarks: string;
  passingMarks: string;
  startAt: string;
  deadline: string;
  submissionType: SubmissionType;
  status: AssessmentStatus;
};

const API_URL = "/api/student-admin/assessments";
const DOMAIN_API_URL = "/api/student-admin/internships";
const REFRESH_MS = 30_000;
const PAGE_SIZE = 8;

const EMPTY_FORM: FormState = {
  title: "",
  domain: "",
  module: "",
  week: "1",
  topicsText: "",
  tasks: [{ title: "", topic: "", instructions: "", marks: 100 }],
  totalMarks: "100",
  passingMarks: "40",
  startAt: "",
  deadline: "",
  submissionType: "zip",
  status: "draft",
};

const STATUS_STYLES: Record<AssessmentStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  locked: "bg-amber-50 text-amber-700 ring-amber-200",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  archived: "bg-violet-50 text-violet-700 ring-violet-200",
};

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100";
const textareaClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rowsFromPayload(payload: ApiPayload): unknown[] {
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.assessments)) return payload.assessments;
  if (Array.isArray(payload.internships)) return payload.internships;
  if (Array.isArray(payload.domains)) return payload.domains;
  const data = asObject(payload.data);
  if (!data) return [];
  for (const key of ["items", "records", "internships", "assessments", "domains", "results"]) {
    if (Array.isArray(data[key])) return data[key] as unknown[];
  }
  return [];
}

function normalizeDomain(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const row = asObject(value);
  if (!row) return "";
  return (
    asText(row.domain) ||
    asText(row.domainName) ||
    asText(row.name) ||
    asText(row.title) ||
    asText(asObject(row.internship)?.domain)
  ).trim();
}

function normalizeDomains(payload: ApiPayload): string[] {
  const direct = rowsFromPayload(payload);
  const values = direct.map(normalizeDomain).filter(Boolean);
  const data = asObject(payload.data);
  const nestedDomains = Array.isArray(data?.domains) ? data.domains : [];
  for (const item of nestedDomains) {
    const domain = normalizeDomain(item);
    if (domain) values.push(domain);
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function normalizeAssessment(value: unknown): WeeklyAssessment | null {
  const row = asObject(value);
  if (!row) return null;
  const id = asText(row.id || row._id || row.assessmentId);
  if (!id) return null;
  const statusValue = asText(row.status, "draft").toLowerCase();
  const status: AssessmentStatus =
    statusValue === "published" || statusValue === "locked" || statusValue === "archived"
      ? statusValue
      : "draft";
  const tasks = Array.isArray(row.tasks)
    ? row.tasks.map((item) => {
        const task = asObject(item) || {};
        return {
          title: asText(task.title, "Untitled task"),
          topic: asText(task.topic),
          instructions: asText(task.instructions),
          marks: asNumber(task.marks),
        };
      })
    : [];
  return {
    id,
    title: asText(row.title, "Untitled weekly assessment"),
    domain: asText(row.domain, "Unassigned domain"),
    module: asText(row.module),
    week: asNumber(row.week, 1),
    type: "practical",
    topics: Array.isArray(row.topics)
      ? row.topics.filter((item): item is string => typeof item === "string")
      : [],
    tasks,
    totalMarks: asNumber(row.totalMarks),
    passingMarks: asNumber(row.passingMarks),
    startAt: asText(row.startAt),
    deadline: asText(row.deadline),
    submissionType: ["pdf", "images", "github", "multiple"].includes(asText(row.submissionType))
      ? (asText(row.submissionType) as SubmissionType)
      : "zip",
    status,
    assignedCount: asNumber(row.assignedCount),
    submittedCount: asNumber(row.submittedCount),
    reviewedCount: asNumber(row.reviewedCount),
    createdAt: asText(row.createdAt),
    updatedAt: asText(row.updatedAt),
  };
}

function formatDate(value: string): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function statusLabel(status: AssessmentStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function errorMessage(payload: unknown, fallback: string): string {
  const row = asObject(payload);
  return asText(row?.message, fallback);
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-bold text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_3px_12px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${tone}`}><Icon size={20} /></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export default function StudentAdminAssessmentsPage() {
  const [assessments, setAssessments] = useState<WeeklyAssessment[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selected, setSelected] = useState<WeeklyAssessment | null>(null);
  const [page, setPage] = useState(1);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [domainError, setDomainError] = useState("");
  const requestSequence = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((kind: Notice["kind"], message: string) => {
    setNotice({ kind, message });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  const loadDomains = useCallback(async () => {
    setDomainsLoading(true);
    setDomainError("");
    try {
      const response = await fetch(`${DOMAIN_API_URL}?page=1&limit=200`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok) throw new Error(errorMessage(payload, `Unable to load Main Admin domains (${response.status}).`));
      const nextDomains = normalizeDomains(payload);
      setDomains(nextDomains);
      setDomainError(nextDomains.length ? "" : "No configured internship domains were returned by the domain source.");
      setForm((current) => ({
        ...current,
        domain: current.domain && nextDomains.includes(current.domain) ? current.domain : nextDomains[0] || "",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load configured domains.";
      setDomains([]);
      setDomainError(message);
    } finally {
      setDomainsLoading(false);
    }
  }, []);

  const loadAssessments = useCallback(async (silent = false) => {
    const requestId = ++requestSequence.current;
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${API_URL}?page=1&limit=200`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok) throw new Error(errorMessage(payload, `Unable to load weekly assessments (${response.status}).`));
      const rows = rowsFromPayload(payload)
        .map(normalizeAssessment)
        .filter((item): item is WeeklyAssessment => item !== null);
      if (requestId !== requestSequence.current) return;
      setAssessments(rows);
      setApiAvailable(true);
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      setApiAvailable(false);
      if (!silent) notify("error", error instanceof Error ? error.message : "Weekly assessment API is unavailable.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [notify]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadAssessments(), loadDomains()]);
  }, [loadAssessments, loadDomains]);

  useEffect(() => {
    void refreshAll();
    const timer = setInterval(() => {
      void loadAssessments(true);
      void loadDomains();
    }, REFRESH_MS);
    return () => {
      clearInterval(timer);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      requestSequence.current += 1;
    };
  }, [refreshAll, loadAssessments, loadDomains]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assessments.filter((item) => {
      const matchesSearch = !query ||
        item.title.toLowerCase().includes(query) ||
        item.domain.toLowerCase().includes(query) ||
        item.module.toLowerCase().includes(query) ||
        item.topics.some((topic) => topic.toLowerCase().includes(query)) ||
        item.tasks.some((task) => task.title.toLowerCase().includes(query) || task.topic.toLowerCase().includes(query));
      return matchesSearch &&
        (statusFilter === "all" || item.status === statusFilter) &&
        (domainFilter === "all" || item.domain === domainFilter);
    });
  }, [assessments, search, statusFilter, domainFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, statusFilter, domainFilter]);

  const stats = useMemo(() => ({
    total: assessments.length,
    published: assessments.filter((item) => item.status === "published").length,
    locked: assessments.filter((item) => item.status === "locked").length,
    drafts: assessments.filter((item) => item.status === "draft").length,
    submissions: assessments.reduce((sum, item) => sum + item.submittedCount, 0),
  }), [assessments]);

  function openCreate() {
    if (!domains.length) {
      notify("error", "Assessment create karne se pehle Main Admin mein internship domain configure hona chahiye.");
      return;
    }
    setEditingId(null);
    setForm({ ...EMPTY_FORM, domain: domains[0] });
    setModalOpen(true);
  }

  function openEdit(item: WeeklyAssessment) {
    if (!domains.includes(item.domain)) {
      notify("error", "Is assessment ka domain ab Main Admin domain list mein available nahi hai. Main Admin se domain verify karein.");
      return;
    }
    setEditingId(item.id);
    setForm({
      title: item.title,
      domain: item.domain,
      module: item.module,
      week: String(item.week),
      topicsText: item.topics.join("\n"),
      tasks: item.tasks.length ? item.tasks : [{ title: "", topic: "", instructions: "", marks: 0 }],
      totalMarks: String(item.totalMarks),
      passingMarks: String(item.passingMarks),
      startAt: toLocalInput(item.startAt),
      deadline: toLocalInput(item.deadline),
      submissionType: item.submissionType,
      status: item.status,
    });
    setModalOpen(true);
  }

  function updateTask(index: number, key: keyof AssessmentTask, value: string) {
    setForm((current) => ({
      ...current,
      tasks: current.tasks.map((task, taskIndex) => taskIndex === index
        ? { ...task, [key]: key === "marks" ? Number(value) : value }
        : task),
    }));
  }

  function addTask() {
    setForm((current) => ({
      ...current,
      tasks: [...current.tasks, { title: "", topic: "", instructions: "", marks: 0 }],
    }));
  }

  function removeTask(index: number) {
    setForm((current) => ({ ...current, tasks: current.tasks.filter((_, taskIndex) => taskIndex !== index) }));
  }

  function validateForm(): string | null {
    if (!domains.includes(form.domain)) return "Select a currently configured Main Admin domain.";
    if (!form.title.trim()) return "Weekly assessment title is required.";
    if (!form.module.trim()) return "Learning module is required.";
    const week = Number(form.week);
    const total = Number(form.totalMarks);
    const passing = Number(form.passingMarks);
    if (!Number.isInteger(week) || week < 1 || week > 104) return "Week number must be between 1 and 104.";
    if (!Number.isFinite(total) || total < 1 || total > 10000) return "Total marks must be between 1 and 10000.";
    if (!Number.isFinite(passing) || passing < 0 || passing > total) return "Passing marks must be between 0 and total marks.";
    if (!form.tasks.length) return "Add at least one task.";
    if (form.tasks.some((task) => !task.title.trim() || !task.topic.trim() || !task.instructions.trim())) return "Every task needs a title, covered topic and instructions.";
    if (form.tasks.some((task) => !Number.isFinite(task.marks) || task.marks <= 0)) return "Every task must have marks greater than zero.";
    const topics = form.topicsText.split("\n").map((item) => item.trim()).filter(Boolean);
    if (!topics.length) return "Add at least one taught topic for this weekly assessment.";
    const start = form.startAt ? new Date(form.startAt).getTime() : NaN;
    const deadline = form.deadline ? new Date(form.deadline).getTime() : NaN;
    if (form.status === "published" && (!Number.isFinite(start) || !Number.isFinite(deadline))) return "Set start date and deadline before publishing.";
    if (Number.isFinite(start) && Number.isFinite(deadline) && deadline <= start) return "Submission deadline must be later than the start date.";
    const taskTotal = form.tasks.reduce((sum, task) => sum + task.marks, 0);
    if (taskTotal !== total) return `Task marks total (${taskTotal}) must equal total marks (${total}).`;
    return null;
  }

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      notify("error", validationError);
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      domain: form.domain,
      module: form.module.trim(),
      week: Number(form.week),
      type: "practical",
      topics: form.topicsText.split("\n").map((item) => item.trim()).filter(Boolean),
      tasks: form.tasks.map((task) => ({
        title: task.title.trim(),
        topic: task.topic.trim(),
        instructions: task.instructions.trim(),
        marks: task.marks,
      })),
      totalMarks: Number(form.totalMarks),
      passingMarks: Number(form.passingMarks),
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      submissionType: form.submissionType,
      status: form.status,
    };
    try {
      const response = await fetch(editingId ? `${API_URL}/${encodeURIComponent(editingId)}` : API_URL, {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok) throw new Error(errorMessage(result, `Save failed (${response.status}).`));
      setModalOpen(false);
      notify("success", editingId ? "Weekly assessment updated." : "Weekly assessment created.");
      await loadAssessments(true);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to save weekly assessment.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item: WeeklyAssessment, next: AssessmentStatus) {
    const message = next === "published"
      ? "Publish and unlock this weekly assessment for eligible students?"
      : next === "locked"
        ? "Lock this weekly assessment? Students must not be able to access it while locked."
        : next === "archived"
          ? "Archive this assessment?"
          : "Move this assessment to draft?";
    if (!window.confirm(message)) return;
    try {
      const response = await fetch(`${API_URL}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok) throw new Error(errorMessage(payload, `Status update failed (${response.status}).`));
      notify("success", `Weekly assessment ${next}.`);
      await loadAssessments(true);
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Unable to update assessment status.");
    }
  }

  function exportCsv() {
    const headers = ["Title", "Domain", "Module", "Week", "Topics", "Tasks", "Status", "Total Marks", "Passing Marks", "Start", "Deadline", "Assigned", "Submitted", "Reviewed"];
    const rows = filtered.map((item) => [
      item.title, item.domain, item.module, item.week, item.topics.join("; "),
      item.tasks.map((task) => `${task.title} (${task.marks})`).join("; "), item.status,
      item.totalMarks, item.passingMarks, item.startAt, item.deadline,
      item.assignedCount, item.submittedCount, item.reviewedCount,
    ]);
    const safe = (value: unknown) => {
      const raw = String(value ?? "");
      const guarded = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${guarded.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((row) => row.map(safe).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cybernet-weekly-assessments.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="min-h-screen bg-[#f3f6fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blue-100/80 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.17em] text-blue-700">
                <GraduationCap size={14} /> Student Operations / Weekly learning
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Weekly Task Assessments</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Create weekly practical tasks from topics already covered in each domain. Publish to unlock student access or lock an assessment whenever required.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ring-1 ${apiAvailable === true ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : apiAvailable === false ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                  <span className={`h-2 w-2 rounded-full ${apiAvailable === true ? "bg-emerald-500" : apiAvailable === false ? "bg-amber-500" : "bg-slate-400"}`} />
                  {apiAvailable === true ? "Assessment API connected" : apiAvailable === false ? "Assessment API unavailable" : "Connecting"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">{domainsLoading ? "Loading domains…" : `${domains.length} Main Admin domains available`}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Auto refresh: 30 seconds</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void refreshAll()} disabled={loading || domainsLoading} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={16} className={loading || domainsLoading ? "animate-spin" : ""} /> Refresh
              </button>
              <button type="button" onClick={exportCsv} disabled={!filtered.length} className="inline-flex h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                <ArrowDownToLine size={16} /> Export CSV
              </button>
              <button type="button" onClick={openCreate} disabled={domainsLoading || !domains.length} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus size={17} /> Create weekly assessment
              </button>
            </div>
          </div>
        </section>

        {notice ? (
          <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${notice.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
            {notice.kind === "error" ? <AlertCircle size={18} /> : notice.kind === "success" ? <CheckCircle2 size={18} /> : <Activity size={18} />}
            <p className="min-w-0 flex-1">{notice.message}</p>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={16} /></button>
          </div>
        ) : null}

        {domainError ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 shrink-0 text-amber-700" size={19} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-900">Main Admin domains are not available</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">{domainError} Assessment creation is disabled until the configured domain list is available. Check the protected Student Operations internships API and its access to Main Admin internship records.</p>
                <button type="button" onClick={() => void loadDomains()} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100">Retry domain loading</button>
              </div>
            </div>
          </section>
        ) : null}

        {apiAvailable === false ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 shrink-0 text-rose-700" size={19} /><div><p className="text-sm font-bold text-rose-900">Weekly assessment API connection failed</p><p className="mt-1 text-xs leading-5 text-rose-800">This page uses <code className="rounded bg-rose-100 px-1">/api/student-admin/assessments</code>. Create, edit, lock and publish actions require the protected API and database model to support these operations.</p></div></div>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Weekly assessments" value={loading ? "—" : stats.total} detail="All task-based weekly assessments." icon={ClipboardCheck} tone="bg-blue-50 text-blue-600" />
          <StatCard label="Published / unlocked" value={loading ? "—" : stats.published} detail="Available according to their schedule." icon={Unlock} tone="bg-emerald-50 text-emerald-600" />
          <StatCard label="Locked assessments" value={loading ? "—" : stats.locked} detail="Student access is disabled while locked." icon={LockKeyhole} tone="bg-amber-50 text-amber-600" />
          <StatCard label="Submissions received" value={loading ? "—" : stats.submissions} detail="Submissions recorded across assessments." icon={FileArchive} tone="bg-violet-50 text-violet-600" />
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-700"><BookOpen size={17} /><span className="text-[10px] font-extrabold uppercase tracking-[0.16em]">Assessment library</span></div>
              <h2 className="mt-2 text-xl font-black text-slate-950">Manage weekly task plans</h2>
              <p className="mt-1 text-sm text-slate-500">Filter by configured domain and access status. Each assessment is linked to taught topics and task marks.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_190px_160px]">
              <label className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, topic or task" className={`${inputClass} pl-10`} /></label>
              <select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)} className={inputClass}><option value="all">All domains</option>{domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="all">All statuses</option><option value="draft">Draft</option><option value="locked">Locked</option><option value="published">Published</option><option value="archived">Archived</option></select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Filter size={14} /> Quick filters</span>
            {[["all", "All"], ["draft", "Drafts"], ["locked", "Locked"], ["published", "Published"]].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setStatusFilter(key)} className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${statusFilter === key ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
            ))}
            <span className="ml-auto text-xs font-semibold text-slate-500">{filtered.length} records</span>
          </div>

          {loading ? (
            <div className="mt-5 grid gap-3 py-8 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-slate-100" />)}</div>
          ) : visibleRows.length ? (
            <>
              <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {visibleRows.map((item) => (
                  <article key={item.id} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60">
                    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><BookOpen size={17} /></span><span className="truncate text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{item.domain}</span></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${STATUS_STYLES[item.status]}`}>{statusLabel(item.status)}</span></div>
                    <h3 className="mt-4 line-clamp-2 text-lg font-extrabold text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{item.module} · Week {item.week}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">{item.topics.slice(0, 4).map((topic) => <span key={topic} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">{topic}</span>)}{item.topics.length > 4 ? <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700">+{item.topics.length - 4} more</span> : null}</div>
                    <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3"><div><p className="text-[9px] font-bold uppercase text-slate-400">Tasks</p><p className="mt-1 text-sm font-extrabold text-slate-900">{item.tasks.length}</p></div><div><p className="text-[9px] font-bold uppercase text-slate-400">Marks</p><p className="mt-1 text-sm font-extrabold text-slate-900">{item.totalMarks}</p></div><div><p className="text-[9px] font-bold uppercase text-slate-400">Submitted</p><p className="mt-1 text-sm font-extrabold text-slate-900">{item.submittedCount}/{item.assignedCount || "—"}</p></div></div>
                    <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500"><CalendarClock size={14} /><span className="truncate">Due {formatDate(item.deadline)}</span></div>
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      <button type="button" onClick={() => setSelected(item)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50">Details</button>
                      <button type="button" onClick={() => openEdit(item)} disabled={item.status === "archived"} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"><Pencil size={14} /> Edit</button>
                      {item.status === "published" ? <button type="button" onClick={() => void changeStatus(item, "locked")} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:bg-amber-100"><Lock size={14} /> Lock</button> : item.status === "locked" || item.status === "draft" ? <button type="button" onClick={() => void changeStatus(item, "published")} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"><Unlock size={14} /> Publish / unlock</button> : null}
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-40">Previous</button><span className="px-2 text-xs font-bold text-slate-600">Page {page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-40">Next</button></div></div>
            </>
          ) : (
            <div className="py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ClipboardCheck size={25} /></div><h3 className="mt-4 text-lg font-extrabold text-slate-900">No weekly assessments found</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Create a task-based weekly assessment for a live Main Admin domain, or adjust your filters.</p><button type="button" onClick={openCreate} disabled={!domains.length} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Plus size={16} /> Create first assessment</button></div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5"><div className="flex items-center gap-2 text-blue-700"><ShieldCheck size={18} /><span className="text-xs font-extrabold uppercase tracking-wider">Student access control</span></div><h3 className="mt-3 text-lg font-extrabold text-slate-950">Lock and publish must be enforced by the API</h3><p className="mt-2 text-sm leading-6 text-slate-600">The student assessment API must validate published status, lock state, student domain, assignment eligibility, start time and deadline for every read and submission request.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-emerald-700"><FileArchive size={18} /><span className="text-xs font-extrabold uppercase tracking-wider">Weekly task submission</span></div><h3 className="mt-3 text-lg font-extrabold text-slate-950">Topic-aligned practical work</h3><p className="mt-2 text-sm leading-6 text-slate-600">Each weekly assessment contains taught topics, task instructions, marks and a fixed submission window. Students should submit evidence using the selected format.</p></div>
        </section>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-4 max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">Weekly task learning plan</p><h2 className="mt-1 text-xl font-black text-slate-950">{editingId ? "Edit weekly assessment" : "Create weekly assessment"}</h2></div><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Close form"><X size={18} /></button></div>
            <form onSubmit={saveAssessment} className="space-y-6 p-5 sm:p-7">
              <section><div className="mb-4 flex items-center gap-2"><BookOpen size={17} className="text-blue-600" /><h3 className="text-sm font-extrabold text-slate-900">Assessment information</h3></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2"><Field label="Weekly assessment title"><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Week 01 – Java Programming Assignment 1" className={inputClass} maxLength={160} required /></Field></div>
                <Field label="Main Admin domain" hint="Only domains returned by the live internship configuration are selectable."><select value={form.domain} onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))} className={inputClass} required disabled={domainsLoading || !domains.length}><option value="">{domainsLoading ? "Loading configured domains…" : "Select configured domain"}</option>{domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select></Field>
                <Field label="Learning module"><input value={form.module} onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))} className={inputClass} placeholder="Java Programming" required maxLength={120} /></Field>
                <Field label="Week number"><input type="number" min="1" max="104" value={form.week} onChange={(event) => setForm((current) => ({ ...current, week: event.target.value }))} className={inputClass} required /></Field>
              </div></section>

              <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5"><div className="flex items-center gap-2 text-blue-800"><GraduationCap size={17} /><p className="text-xs font-extrabold">TASK-BASED WEEKLY LEARNING</p></div><p className="mt-2 text-xs leading-5 text-slate-600">Select the domain and module, then add only the concepts already taught to students. Build each practical task from those topics and assign marks per task.</p></section>

              <section><div className="mb-4 flex items-center gap-2"><ClipboardCheck size={17} className="text-blue-600" /><h3 className="text-sm font-extrabold text-slate-900">Topics covered and task breakdown</h3></div><Field label="Topics covered (one topic per line)" hint="Topics listed here should match the lectures or learning tasks completed during this week."><textarea value={form.topicsText} onChange={(event) => setForm((current) => ({ ...current, topicsText: event.target.value }))} rows={4} className={textareaClass} placeholder={"Variables and Data Types\nArrays\nLoops\nIf-Else"} required /></Field>
                <div className="mt-4 space-y-4">{form.tasks.map((task, index) => <div key={index} className="rounded-2xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-extrabold text-slate-800">Practical task {index + 1}</p>{form.tasks.length > 1 ? <button type="button" onClick={() => removeTask(index)} className="text-xs font-bold text-rose-600 hover:text-rose-700">Remove task</button> : null}</div><div className="grid gap-3 md:grid-cols-[1fr_180px]"><Field label="Task title"><input value={task.title} onChange={(event) => updateTask(index, "title", event.target.value)} className={inputClass} required maxLength={160} placeholder="Array operations" /></Field><Field label="Task marks"><input type="number" min="1" max="10000" value={task.marks} onChange={(event) => updateTask(index, "marks", event.target.value)} className={inputClass} required /></Field></div><div className="mt-3"><Field label="Covered topic / concepts"><input value={task.topic} onChange={(event) => updateTask(index, "topic", event.target.value)} className={inputClass} placeholder="Arrays, loops, sum and average" maxLength={300} required /></Field></div><div className="mt-3"><Field label="Task instructions"><textarea value={task.instructions} onChange={(event) => updateTask(index, "instructions", event.target.value)} rows={4} className={textareaClass} required maxLength={6000} placeholder="Explain the practical work students must complete…" /></Field></div></div>)}</div>
                <button type="button" onClick={addTask} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-blue-300 px-4 text-xs font-bold text-blue-700 hover:bg-blue-50"><Plus size={15} /> Add practical task</button>
              </section>

              <section><div className="mb-4 flex items-center gap-2"><CalendarClock size={17} className="text-blue-600" /><h3 className="text-sm font-extrabold text-slate-900">Schedule, marks and submission</h3></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Assessment start date and time"><input type="datetime-local" value={form.startAt} onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))} className={inputClass} /></Field>
                <Field label="Fixed submission deadline"><input type="datetime-local" value={form.deadline} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} className={inputClass} /></Field>
                <Field label="Submission format"><select value={form.submissionType} onChange={(event) => setForm((current) => ({ ...current, submissionType: event.target.value as SubmissionType }))} className={inputClass}><option value="zip">ZIP archive</option><option value="pdf">PDF document</option><option value="images">Screenshots / images</option><option value="github">GitHub repository</option><option value="multiple">Multiple file types</option></select></Field>
                <Field label="Total marks"><input type="number" min="1" max="10000" value={form.totalMarks} onChange={(event) => setForm((current) => ({ ...current, totalMarks: event.target.value }))} className={inputClass} required /></Field>
                <Field label="Passing marks"><input type="number" min="0" value={form.passingMarks} onChange={(event) => setForm((current) => ({ ...current, passingMarks: event.target.value }))} className={inputClass} required /></Field>
                <Field label="Initial access status"><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as AssessmentStatus }))} className={inputClass}><option value="draft">Draft — not visible</option><option value="locked">Locked — student access off</option><option value="published">Published — unlock by schedule</option></select></Field>
              </div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Task marks total: <strong className="text-slate-900">{form.tasks.reduce((sum, task) => sum + (Number(task.marks) || 0), 0)}</strong> / {Number(form.totalMarks) || 0}. Task marks must exactly match total marks.</div></section>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModalOpen(false)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving || !domains.includes(form.domain)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}{saving ? "Saving…" : editingId ? "Save weekly assessment" : "Create weekly assessment"}</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="my-6 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-700">Weekly assessment details</p><h2 className="mt-2 text-2xl font-black text-slate-950">{selected.title}</h2><p className="mt-1 text-sm text-slate-500">{selected.domain} · {selected.module} · Week {selected.week}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500"><X size={18} /></button></div>
            <div className="mt-5 flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${STATUS_STYLES[selected.status]}`}>{statusLabel(selected.status)}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{selected.totalMarks} marks</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Pass: {selected.passingMarks}</span></div>
            <div className="mt-5"><h3 className="text-sm font-extrabold text-slate-900">Topics covered</h3><div className="mt-2 flex flex-wrap gap-2">{selected.topics.map((topic) => <span key={topic} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">{topic}</span>)}</div></div>
            <div className="mt-6 space-y-3"><h3 className="text-sm font-extrabold text-slate-900">Practical tasks ({selected.tasks.length})</h3>{selected.tasks.map((task, index) => <div key={`${task.title}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-slate-900">Task {index + 1}: {task.title}</p><span className="shrink-0 text-xs font-bold text-blue-700">{task.marks} marks</span></div><p className="mt-1 text-xs font-semibold text-slate-500">{task.topic}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{task.instructions}</p></div>)}</div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Starts</p><p className="mt-1 text-xs font-semibold text-slate-700">{formatDate(selected.startAt)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Deadline</p><p className="mt-1 text-xs font-semibold text-slate-700">{formatDate(selected.deadline)}</p></div></div>
            <div className="mt-6 flex justify-end"><button type="button" onClick={() => setSelected(null)} className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700">Close</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
