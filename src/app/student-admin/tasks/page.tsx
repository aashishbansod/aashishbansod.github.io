"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, AlertCircle, ArrowRight, BookOpen, CheckCircle2, Clock3, Code2,
  Eye, FileCode2, Filter, Layers3, Loader2, Plus, RefreshCw, Search,
  Send, ShieldCheck, Sparkles, Terminal, Users, X
} from "lucide-react";

type Difficulty = "Easy" | "Medium" | "Hard";
type TaskStatus = "Draft" | "Published" | "Archived";
type Tab = "overview" | "library" | "create" | "submissions";
type Language = "HTML" | "CSS" | "JavaScript";

type Task = {
  id: string;
  title: string;
  domain: string;
  topic: string;
  dayNumber: number;
  durationDays: number;
  difficulty: Difficulty;
  estimatedMinutes: number;
  points: number;
  status: TaskStatus;
  assignedStudents: number;
  submissions: number;
  approved: number;
  createdAt: string | null;
};

type Submission = {
  id: string;
  studentName: string;
  studentId: string;
  email: string;
  taskTitle: string;
  domain: string;
  status: string;
  submittedAt: string | null;
};

type Stats = {
  totalTasks: number;
  publishedTasks: number;
  draftTasks: number;
  assignedStudents: number;
  pendingReviews: number;
  approvedSubmissions: number;
};

type FormState = {
  title: string;
  domain: string;
  topic: string;
  dayNumber: string;
  durationDays: string;
  difficulty: Difficulty;
  estimatedMinutes: string;
  points: string;
  problemStatement: string;
  instructions: string;
  requirements: string;
  starterHtml: string;
  starterCss: string;
  starterJs: string;
  expectedOutput: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    tasks?: Task[];
    records?: Task[];
    submissions?: Submission[];
    stats?: Partial<Stats>;
    pagination?: { totalPages?: number };
  };
};

const API_URL = "/api/student-admin/tasks";
const PAGE_SIZE = 12;
const MAX_SEARCH = 120;
const DOMAINS = [
  "MERN Stack Developer",
  "Java Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Python Developer",
  "Data Analyst",
  "Software Developer",
];

const STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Task</title>
</head>
<body>
  <main class="container">
    <h1>Hello, CyberNet!</h1>
    <p>Start building your solution here.</p>
    <button id="actionButton">Click me</button>
  </main>
</body>
</html>`;

const STARTER_CSS = `* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  font-family: Arial, sans-serif;
  background: #f1f5f9;
  color: #0f172a;
}
.container {
  max-width: 640px;
  margin: 60px auto;
  padding: 32px;
  background: white;
  border-radius: 18px;
  text-align: center;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
}
button {
  border: 0;
  border-radius: 10px;
  padding: 12px 18px;
  background: #2563eb;
  color: white;
  cursor: pointer;
}`;

const STARTER_JS = `document.getElementById("actionButton")?.addEventListener("click", () => {
  alert("Your JavaScript is working!");
});`;

const EMPTY_FORM: FormState = {
  title: "",
  domain: DOMAINS[0],
  topic: "",
  dayNumber: "1",
  durationDays: "30",
  difficulty: "Easy",
  estimatedMinutes: "60",
  points: "10",
  problemStatement: "",
  instructions: "",
  requirements: "",
  starterHtml: STARTER_HTML,
  starterCss: STARTER_CSS,
  starterJs: STARTER_JS,
  expectedOutput: "",
};

const EMPTY_STATS: Stats = {
  totalTasks: 0,
  publishedTasks: 0,
  draftTasks: 0,
  assignedStudents: 0,
  pendingReviews: 0,
  approvedSubmissions: 0,
};

function safeText(value: unknown, fallback = "—"): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim() || fallback;
}

function safeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    id: safeText(task.id, ""),
    title: safeText(task.title, "Untitled task"),
    domain: safeText(task.domain),
    topic: safeText(task.topic),
    dayNumber: safeNumber(task.dayNumber),
    durationDays: safeNumber(task.durationDays),
    difficulty: task.difficulty === "Medium" || task.difficulty === "Hard" ? task.difficulty : "Easy",
    estimatedMinutes: safeNumber(task.estimatedMinutes),
    points: safeNumber(task.points),
    status: task.status === "Published" || task.status === "Archived" ? task.status : "Draft",
    assignedStudents: safeNumber(task.assignedStudents),
    submissions: safeNumber(task.submissions),
    approved: safeNumber(task.approved),
    createdAt: task.createdAt || null,
  };
}

function normalizeStats(stats?: Partial<Stats>): Stats {
  return {
    totalTasks: safeNumber(stats?.totalTasks),
    publishedTasks: safeNumber(stats?.publishedTasks),
    draftTasks: safeNumber(stats?.draftTasks),
    assignedStudents: safeNumber(stats?.assignedStudents),
    pendingReviews: safeNumber(stats?.pendingReviews),
    approvedSubmissions: safeNumber(stats?.approvedSubmissions),
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

function buildPreview(html: string, css: string, js: string): string {
  const safeHtml = html.replace(/<base\b[^>]*>/gi, "");
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:;"><style>${safeCss}</style></head><body>${safeHtml}<script>"use strict";try{${safeJs}}catch(error){document.body.insertAdjacentHTML("beforeend","<pre style='padding:12px;background:#fee2e2;color:#991b1b'>"+String(error.message||error)+"</pre>")}<\/script></body></html>`;
}

function badge(value: string) {
  if (["Published", "Approved"].includes(value)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["Archived", "Rejected"].includes(value)) return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function StatCard({ title, value, note, icon: Icon, tone }: {
  title: string; value: number; note: string; icon: typeof Activity; tone: string;
}) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex justify-between gap-3">
      <div><p className="text-xs font-semibold text-slate-500">{title}</p><p className="mt-2 text-2xl font-black text-slate-950">{value.toLocaleString("en-IN")}</p><p className="mt-1 text-[11px] text-slate-500">{note}</p></div>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={19}/></span>
    </div>
  </div>;
}

function InputField({ label, value, onChange, placeholder, type = "text", min, max }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; min?: string; max?: string;
}) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} min={min} max={max} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-3 focus:ring-blue-100"/></label>;
}

export default function StudentAdminTasksPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorTab, setEditorTab] = useState<Language>("HTML");
  const [showPreview, setShowPreview] = useState(true);
  const [previewVersion, setPreviewVersion] = useState(0);

  const updateForm = useCallback(<K extends keyof FormState,>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const preview = useMemo(() => buildPreview(form.starterHtml, form.starterCss, form.starterJs), [form.starterHtml, form.starterCss, form.starterJs, previewVersion]);

  const loadData = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");
    const params = new URLSearchParams({
      view: tab === "library" ? "library" : tab === "submissions" ? "submissions" : "overview",
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (search) params.set("search", search);
    if (domainFilter) params.set("domain", domainFilter);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const response = await fetch(`${API_URL}?${params}`, {
        method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "application/json" }
      });
      const result = await response.json().catch(() => null) as ApiResponse | null;
      if (response.status === 401 || response.status === 403) {
        window.location.replace("/login?mode=student-admin&next=%2Fstudent-admin%2Ftasks");
        return;
      }
      if (!response.ok || result?.success !== true || !result.data) {
        throw new Error(result?.message || `Tasks API is not ready (${response.status}).`);
      }
      const data = result.data;
      const records = Array.isArray(data.tasks) ? data.tasks : Array.isArray(data.records) ? data.records : [];
      setTasks(records.map(normalizeTask));
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      setStats(normalizeStats(data.stats));
      setTotalPages(safeNumber(data.pagination?.totalPages));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load task management data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, page, search, domainFilter, statusFilter]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    updateForm(key, value);
  }

  function validate(): string {
    if (form.title.trim().length < 5) return "Task title must contain at least 5 characters.";
    if (form.topic.trim().length < 2) return "Enter a valid task topic.";
    if (form.problemStatement.trim().length < 20) return "Problem statement must contain at least 20 characters.";
    if (form.instructions.trim().length < 10) return "Add clear student instructions.";
    if (!form.requirements.trim()) return "Add at least one requirement.";
    const day = Number(form.dayNumber);
    const duration = Number(form.durationDays);
    const minutes = Number(form.estimatedMinutes);
    const points = Number(form.points);
    if (!Number.isInteger(day) || !Number.isInteger(duration) || duration < 1 || duration > 365 || day < 1 || day > duration) return "Day number must be within the selected program duration.";
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) return "Estimated time must be between 5 and 1440 minutes.";
    if (!Number.isInteger(points) || points < 1 || points > 1000) return "Points must be between 1 and 1000.";
    if (form.starterHtml.length > 50000 || form.starterCss.length > 30000 || form.starterJs.length > 30000) return "Starter code exceeds the allowed size.";
    return "";
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validate();
    if (message) {
      setFormError(message);
      return;
    }
    setSaving(true);
    setFormError("");
    setNotice("");
    try {
      const response = await fetch(API_URL, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "create-task",
          task: {
            ...form,
            dayNumber: Number(form.dayNumber),
            durationDays: Number(form.durationDays),
            estimatedMinutes: Number(form.estimatedMinutes),
            points: Number(form.points),
            requirements: form.requirements.split("\n").map((item) => item.trim()).filter(Boolean),
          },
        }),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        window.location.replace("/login?mode=student-admin&next=%2Fstudent-admin%2Ftasks");
        return;
      }
      if (!response.ok || result?.success !== true) throw new Error(result?.message || `Task could not be saved (${response.status}).`);
      setNotice(result.message || "Task draft saved.");
      setForm(EMPTY_FORM);
      setTab("library");
      setPage(1);
      await loadData(false);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "Unable to create task.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(taskId: string, action: "publish-task" | "archive-task") {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(API_URL, {
        method: "PATCH", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, taskId }),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 401 || response.status === 403) {
        window.location.replace("/login?mode=student-admin&next=%2Fstudent-admin%2Ftasks");
        return;
      }
      if (!response.ok || result?.success !== true) throw new Error(result?.message || "Task status could not be updated.");
      setNotice(result.message || "Task status updated.");
      await loadData(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  const editorValue = editorTab === "HTML" ? form.starterHtml : editorTab === "CSS" ? form.starterCss : form.starterJs;
  const editorChange = (value: string) => {
    if (editorTab === "HTML") setField("starterHtml", value);
    else if (editorTab === "CSS") setField("starterCss", value);
    else setField("starterJs", value);
  };

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "library", label: "Task Library", icon: BookOpen },
    { id: "create", label: "Create Task", icon: Plus },
    { id: "submissions", label: "Submissions", icon: Users },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-600"><Code2 size={14}/> Student Operations / Training Workspace</div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Daily Tasks Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Create domain-specific practical tasks, provide starter code, preview web output and review student submissions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700"><ShieldCheck size={15}/> Admin workspace</span>
            <button type="button" onClick={() => void loadData(false)} disabled={refreshing || loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""}/> Refresh</button>
            <button type="button" onClick={() => setTab("create")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700"><Plus size={15}/> Create daily task</button>
          </div>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-950"><Sparkles size={16} className="text-blue-600"/> Domain-based learning · One assigned task per training day</div>
          <span className="text-[10px] font-semibold text-blue-700">Student submissions require admin review</span>
        </div>

        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {tabs.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex min-w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${tab === item.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={15}/>{item.label}</button>;
          })}
        </nav>

        {notice && <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"><CheckCircle2 size={16}/>{notice}<button type="button" onClick={() => setNotice("")} className="ml-auto"><X size={14}/></button></div>}
        {error && <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-700"/><div><p className="text-xs font-extrabold text-amber-900">Task API connection issue</p><p className="mt-1 text-xs leading-5 text-amber-800">{error}</p></div></div><button type="button" onClick={() => void loadData(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800"><RefreshCw size={13}/>Retry</button></div>}

        {loading ? <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white"><div className="flex flex-col items-center gap-3 text-slate-500"><Loader2 size={27} className="animate-spin text-blue-600"/><p className="text-xs font-semibold">Loading task workspace...</p></div></div> : <>
          {tab === "overview" && <section className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Total Tasks" value={stats.totalTasks} note={`${stats.publishedTasks} published · ${stats.draftTasks} drafts`} icon={BookOpen} tone="bg-blue-50 text-blue-600"/>
              <StatCard title="Assigned Students" value={stats.assignedStudents} note="Students with task assignments" icon={Users} tone="bg-violet-50 text-violet-600"/>
              <StatCard title="Pending Reviews" value={stats.pendingReviews} note="Waiting for Student Admin" icon={Clock3} tone="bg-amber-50 text-amber-600"/>
              <StatCard title="Approved Submissions" value={stats.approvedSubmissions} note="Completed and locked tasks" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600"/>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <div className="flex items-center justify-between"><div><h2 className="text-sm font-extrabold text-slate-900">Training domains</h2><p className="mt-1 text-xs text-slate-500">Tracks supported by the existing CyberNet coding workspace.</p></div><Layers3 size={19} className="text-blue-600"/></div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DOMAINS.map((domain) => <button key={domain} type="button" onClick={() => { setForm((current) => ({ ...current, domain })); setTab("create"); }} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50"><span><span className="block text-xs font-bold text-slate-800">{domain}</span><span className="mt-1 block text-[10px] text-slate-500">Create domain-specific task</span></span><ArrowRight size={15} className="text-slate-400"/></button>)}
                </div>
              </div>
              <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={18}/></span><div><h2 className="text-xs font-extrabold text-slate-900">Task lifecycle</h2><p className="text-[10px] text-slate-500">Approval-controlled progression</p></div></div>
                <div className="mt-5 space-y-4">{["Draft task", "Publish to domain", "Student solves in editor", "Submission under review", "Admin approves or requests revision", "Next task unlocks"].map((item, index) => <div key={item} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[10px] font-extrabold text-blue-700">{index + 1}</span><span className="text-[11px] font-semibold text-slate-700">{item}</span></div>)}</div>
                <p className="mt-5 rounded-xl bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">Publishing, assignment, approval and next-task unlocking must be enforced by backend APIs.</p>
              </aside>
            </div>
          </section>}

          {tab === "library" && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center"><div><h2 className="text-sm font-extrabold text-slate-900">Task Library</h2><p className="mt-1 text-xs text-slate-500">Manage daily tasks by domain, training day and difficulty.</p></div><button type="button" onClick={() => setTab("create")} className="inline-flex h-9 items-center gap-2 self-start rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"><Plus size={14}/>New task</button></div>
              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_240px_160px_auto]">
                <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim().slice(0, MAX_SEARCH)); }} className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search task title or topic..." className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-blue-400"/></form>
                <select value={domainFilter} onChange={(event) => { setDomainFilter(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="">All domains</option>{DOMAINS.map((domain) => <option key={domain}>{domain}</option>)}</select>
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="">All statuses</option><option>Draft</option><option>Published</option><option>Archived</option></select>
                <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setDomainFilter(""); setStatusFilter(""); setPage(1); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600"><Filter size={14}/>Clear</button>
              </div>
            </div>
            {tasks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Task</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Day</th><th className="px-4 py-3">Difficulty</th><th className="px-4 py-3">Students</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{tasks.map((task) => <tr key={task.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="text-xs font-bold text-slate-900">{task.title}</p><p className="mt-1 text-[10px] text-slate-500">{task.topic} · {task.points} points</p></td><td className="px-4 py-4 text-xs text-slate-600">{task.domain}</td><td className="px-4 py-4 text-xs font-semibold">{task.dayNumber}/{task.durationDays}</td><td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${task.difficulty === "Hard" ? "border-rose-200 bg-rose-50 text-rose-700" : task.difficulty === "Medium" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{task.difficulty}</span></td><td className="px-4 py-4 text-xs text-slate-600">{task.assignedStudents}</td><td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge(task.status)}`}>{task.status}</span></td><td className="px-5 py-4 text-right">{task.status === "Draft" ? <button type="button" disabled={saving} onClick={() => void updateStatus(task.id, "publish-task")} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Publish</button> : task.status === "Published" ? <button type="button" disabled={saving} onClick={() => void updateStatus(task.id, "archive-task")} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 disabled:opacity-50">Archive</button> : <span className="text-[10px] text-slate-400">Archived</span>}</td></tr>)}</tbody></table></div> : <div className="px-5 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><BookOpen size={22}/></span><h3 className="mt-4 text-sm font-bold text-slate-800">No tasks loaded</h3><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">{error || "Create your first domain-specific daily task. Saved tasks will appear here."}</p><button type="button" onClick={() => setTab("create")} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white"><Plus size={14}/>Create first task</button></div>}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4"><span className="text-[10px] text-slate-500">Page {page}{totalPages ? ` of ${totalPages}` : ""}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-8 rounded-lg border border-slate-200 px-3 text-[10px] font-bold disabled:opacity-40">Previous</button><button type="button" disabled={!totalPages || page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="h-8 rounded-lg border border-slate-200 px-3 text-[10px] font-bold disabled:opacity-40">Next</button></div></div>
          </section>}

          {tab === "create" && <form onSubmit={createTask} className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-extrabold text-slate-900">Create domain-based daily task</h2><p className="mt-1 text-xs text-slate-500">Define the practical problem and what the student must deliver.</p></div><FileCode2 size={20} className="text-blue-600"/></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InputField label="Task title *" value={form.title} onChange={(value) => setField("title", value)} placeholder="Build a responsive login page"/>
                <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Internship domain *</span><select value={form.domain} onChange={(event) => setField("domain", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs">{DOMAINS.map((domain) => <option key={domain}>{domain}</option>)}</select></label>
                <InputField label="Topic / technology *" value={form.topic} onChange={(value) => setField("topic", value)} placeholder="HTML Forms, React Hooks, REST API"/>
                <InputField label="Training day *" type="number" min="1" max="365" value={form.dayNumber} onChange={(value) => setField("dayNumber", value)}/>
                <InputField label="Program duration (days) *" type="number" min="1" max="365" value={form.durationDays} onChange={(value) => setField("durationDays", value)}/>
                <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Difficulty</span><select value={form.difficulty} onChange={(event) => setField("difficulty", event.target.value as Difficulty)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
                <InputField label="Estimated time (minutes)" type="number" min="5" max="1440" value={form.estimatedMinutes} onChange={(value) => setField("estimatedMinutes", value)}/>
                <InputField label="Points" type="number" min="1" max="1000" value={form.points} onChange={(value) => setField("points", value)}/>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Problem statement *</span><textarea value={form.problemStatement} onChange={(event) => setField("problemStatement", event.target.value)} rows={5} maxLength={5000} placeholder="Explain the real-world problem the student must solve..." className="w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-5 outline-none focus:border-blue-400"/></label>
                <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Student instructions *</span><textarea value={form.instructions} onChange={(event) => setField("instructions", event.target.value)} rows={5} maxLength={8000} placeholder="Step-by-step instructions and submission guidance..." className="w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-5 outline-none focus:border-blue-400"/></label>
              </div>
              <label className="mt-4 block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Requirements / acceptance criteria * (one per line)</span><textarea value={form.requirements} onChange={(event) => setField("requirements", event.target.value)} rows={4} maxLength={5000} placeholder={"Responsive on mobile and desktop\nValidate email and password\nShow clear error messages"} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-5 outline-none focus:border-blue-400"/></label>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5"><div><div className="flex items-center gap-2"><Code2 size={17} className="text-blue-600"/><h2 className="text-sm font-extrabold text-slate-900">Starter code & live web preview</h2></div><p className="mt-1 text-xs text-slate-500">Prepare starter HTML, CSS and JavaScript for the student editor.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowPreview((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600"><Eye size={14}/>{showPreview ? "Hide preview" : "Show preview"}</button><button type="button" onClick={() => setPreviewVersion((value) => value + 1)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600"><RefreshCw size={13}/>Refresh</button></div></div>
              <div className={`grid ${showPreview ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
                <div className="min-w-0 border-b border-slate-200 xl:border-b-0 xl:border-r">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3"><div className="flex gap-1">{(["HTML", "CSS", "JavaScript"] as Language[]).map((language) => <button key={language} type="button" onClick={() => setEditorTab(language)} className={`rounded-lg px-3 py-1.5 text-[10px] font-extrabold ${editorTab === language ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-200"}`}>{language}</button>)}</div><span className="text-[10px] font-semibold text-slate-400">Starter editor</span></div>
                  <textarea spellCheck={false} value={editorValue} onChange={(event) => editorChange(event.target.value)} aria-label={`${editorTab} starter code`} className="min-h-[440px] w-full resize-y bg-[#0b1220] p-4 font-mono text-[12px] leading-6 text-slate-100 outline-none selection:bg-blue-500/40"/>
                  <div className="flex items-center justify-between border-t border-slate-800 bg-[#111b2d] px-4 py-2.5"><span className="inline-flex items-center gap-2 text-[10px] text-slate-400"><Terminal size={13}/> Isolated browser preview</span><span className="text-[10px] text-slate-500">HTML · CSS · JS</span></div>
                </div>
                {showPreview && <div className="min-w-0 bg-slate-100"><div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><div><p className="text-xs font-extrabold text-slate-800">Live preview</p><p className="mt-0.5 text-[10px] text-slate-500">Rendered output of starter code</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Preview ready</span></div><iframe key={previewVersion} title="Task starter code preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={preview} className="h-[440px] w-full bg-white"/><div className="border-t border-slate-200 bg-white px-4 py-3 text-[10px] leading-5 text-slate-500">Runs in an isolated iframe without same-origin access. This is a browser preview, not a server-side code grader.</div></div>}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600">Expected output / reference notes</span><textarea value={form.expectedOutput} onChange={(event) => setField("expectedOutput", event.target.value)} rows={3} maxLength={4000} placeholder="Describe the expected result..." className="w-full rounded-xl border border-slate-200 px-3 py-3 text-xs leading-5 outline-none focus:border-blue-400"/></label>
              {formError && <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700"><AlertCircle size={15}/>{formError}</div>}
              <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="max-w-xl text-[10px] leading-5 text-slate-500">Save creates a draft. Publish and assign it only after checking the task details and starter preview.</p><div className="flex gap-2"><button type="button" onClick={() => { setForm(EMPTY_FORM); setFormError(""); }} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600">Reset</button><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={15}/>}Save task draft</button></div></div>
            </section>
          </form>}

          {tab === "submissions" && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="text-sm font-extrabold text-slate-900">Student task submissions</h2><p className="mt-1 text-xs text-slate-500">Review submitted work, provide feedback and approve or request revision.</p></div>{submissions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Student</th><th className="px-4 py-3">Task</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Submitted</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{submissions.map((item) => <tr key={item.id}><td className="px-5 py-4"><p className="text-xs font-bold text-slate-800">{item.studentName}</p><p className="mt-1 text-[10px] text-slate-500">{item.studentId} · {item.email}</p></td><td className="px-4 py-4 text-xs font-semibold text-slate-700">{item.taskTitle}</td><td className="px-4 py-4 text-xs text-slate-600">{item.domain}</td><td className="px-4 py-4 text-[10px] text-slate-500">{formatDate(item.submittedAt)}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge(item.status)}`}>{item.status}</span></td></tr>)}</tbody></table></div> : <div className="px-5 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Send size={21}/></span><h3 className="mt-4 text-sm font-bold text-slate-800">No submissions available</h3><p className="mt-2 text-xs text-slate-500">Student submissions will appear here after the student submission API is connected.</p></div>}</section>}
        </>}

        <footer className="mt-7 flex flex-col justify-between gap-2 border-t border-slate-200 py-4 text-[10px] text-slate-400 sm:flex-row sm:items-center"><span>© {new Date().getFullYear()} CyberNet Careers · Student Operations</span><span className="inline-flex items-center gap-1.5"><ShieldCheck size={13}/>Authorized training workspace</span></footer>
      </div>
    </main>
  );
}
