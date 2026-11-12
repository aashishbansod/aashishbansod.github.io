
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Code2,
  Download,
  Filter,
  Flame,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";
type QuestionStatus = "draft" | "published" | "archived";
type Tab = "overview" | "questions" | "schedule" | "analytics";

type CodingQuestion = {
  id: string;
  title: string;
  topic: string;
  track: string;
  difficulty: Difficulty;
  dayNumber: number;
  durationDays: number;
  points: number;
  status: QuestionStatus;
  language: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type CodingStudent = {
  id: string;
  studentName: string;
  studentId: string;
  email: string;
  track: string;
  durationDays: number;
  completedDays: number;
  progress: number;
  attendance: number;
  streak: number;
  lastSubmissionAt: string | null;
  status: string;
};

type CodingStats = {
  totalQuestions: number;
  publishedQuestions: number;
  draftQuestions: number;
  totalStudents: number;
  activeStudents: number;
  submissionsToday: number;
  completedToday: number;
  attendanceToday: number;
  averageProgress: number;
  totalSubmissions: number;
  passedSubmissions: number;
  pendingSubmissions: number;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    questions?: CodingQuestion[];
    records?: CodingQuestion[];
    students?: CodingStudent[];
    stats?: Partial<CodingStats>;
    pagination?: {
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
    };
  };
};

type QuestionForm = {
  title: string;
  track: string;
  topic: string;
  difficulty: Difficulty;
  language: string;
  durationDays: string;
  dayNumber: string;
  points: string;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  explanation: string;
};

const API_URL = "/api/student-admin/coding";
const PAGE_SIZE = 10;
const SEARCH_LIMIT = 120;

const TRACK_OPTIONS = [
  "MERN Stack Developer",
  "Java Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Python Developer",
  "Data Analyst",
  "Software Developer",
];

const LANGUAGE_OPTIONS = [
  "JavaScript",
  "TypeScript",
  "Java",
  "Python",
  "C",
  "C++",
  "SQL",
];

const EMPTY_STATS: CodingStats = {
  totalQuestions: 0,
  publishedQuestions: 0,
  draftQuestions: 0,
  totalStudents: 0,
  activeStudents: 0,
  submissionsToday: 0,
  completedToday: 0,
  attendanceToday: 0,
  averageProgress: 0,
  totalSubmissions: 0,
  passedSubmissions: 0,
  pendingSubmissions: 0,
};

const EMPTY_FORM: QuestionForm = {
  title: "",
  track: TRACK_OPTIONS[0],
  topic: "",
  difficulty: "easy",
  language: "JavaScript",
  durationDays: "30",
  dayNumber: "1",
  points: "10",
  problemStatement: "",
  inputFormat: "",
  outputFormat: "",
  constraints: "",
  sampleInput: "",
  sampleOutput: "",
  explanation: "",
};

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "questions", label: "Question Bank", icon: BookOpen },
  { id: "schedule", label: "Daily Schedule", icon: CalendarDays },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

function textValue(value: unknown, fallback = "—"): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned || fallback;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function percentage(value: unknown): number {
  return Math.min(100, numberValue(value));
}

function dateLabel(value?: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeDifficulty(value: unknown): Difficulty {
  if (value === "medium" || value === "hard") return value;
  return "easy";
}

function normalizeQuestion(item: CodingQuestion): CodingQuestion {
  return {
    ...item,
    id: textValue(item.id, ""),
    title: textValue(item.title, "Untitled question"),
    topic: textValue(item.topic),
    track: textValue(item.track),
    difficulty: normalizeDifficulty(item.difficulty),
    dayNumber: numberValue(item.dayNumber),
    durationDays: numberValue(item.durationDays),
    points: numberValue(item.points),
    status:
      item.status === "published" || item.status === "archived"
        ? item.status
        : "draft",
    language: textValue(item.language),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function normalizeStudent(item: CodingStudent): CodingStudent {
  return {
    ...item,
    id: textValue(item.id, ""),
    studentName: textValue(item.studentName, "Student"),
    studentId: textValue(item.studentId),
    email: textValue(item.email),
    track: textValue(item.track),
    durationDays: numberValue(item.durationDays),
    completedDays: numberValue(item.completedDays),
    progress: percentage(item.progress),
    attendance: percentage(item.attendance),
    streak: numberValue(item.streak),
    lastSubmissionAt: item.lastSubmissionAt || null,
    status: textValue(item.status, "active"),
  };
}

function normalizeStats(input?: Partial<CodingStats>): CodingStats {
  return {
    totalQuestions: numberValue(input?.totalQuestions),
    publishedQuestions: numberValue(input?.publishedQuestions),
    draftQuestions: numberValue(input?.draftQuestions),
    totalStudents: numberValue(input?.totalStudents),
    activeStudents: numberValue(input?.activeStudents),
    submissionsToday: numberValue(input?.submissionsToday),
    completedToday: numberValue(input?.completedToday),
    attendanceToday: percentage(input?.attendanceToday),
    averageProgress: percentage(input?.averageProgress),
    totalSubmissions: numberValue(input?.totalSubmissions),
    passedSubmissions: numberValue(input?.passedSubmissions),
    pendingSubmissions: numberValue(input?.pendingSubmissions),
  };
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "ST"
  );
}

function badgeClass(value: string): string {
  if (value === "published" || value === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "archived" || value === "inactive") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function difficultyClass(value: Difficulty): string {
  if (value === "hard") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (value === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
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
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={percentage(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-blue-600 transition-all"
        style={{ width: `${percentage(value)}%` }}
      />
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Code2 size={25} />
      </span>
      <h3 className="mt-4 text-sm font-bold text-slate-800">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-6 text-slate-500">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

const textareaClass =
  "w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default function StudentAdminCodingPage() {
  const abortRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [questions, setQuestions] = useState<CodingQuestion[]>([]);
  const [students, setStudents] = useState<CodingStudent[]>([]);
  const [stats, setStats] = useState<CodingStats>(EMPTY_STATS);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("");
  const [track, setTrack] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);

  const activeFilters = useMemo(
    () =>
      Number(Boolean(search)) +
      Number(Boolean(difficulty)) +
      Number(Boolean(status)) +
      Number(Boolean(track)),
    [search, difficulty, status, track],
  );

  const loadCodingData = useCallback(
    async (initial = false) => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      const sequence = ++requestSequence.current;

      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (search) params.set("search", search);
      if (difficulty) params.set("difficulty", difficulty);
      if (status) params.set("status", status);
      if (track) params.set("track", track);

      try {
        const response = await fetch(`${API_URL}?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        const result = (await response.json().catch(() => null)) as
          | ApiResponse
          | null;

        if (response.status === 401 || response.status === 403) {
          window.location.replace(
            "/login?mode=student-admin&next=%2Fstudent-admin%2Fcoding",
          );
          return;
        }

        if (!response.ok || result?.success !== true || !result.data) {
          throw new Error(
            result?.message ||
              `Unable to load coding records (${response.status}).`,
          );
        }

        if (sequence !== requestSequence.current) return;

        const data = result.data;
        const records = Array.isArray(data.questions)
          ? data.questions
          : Array.isArray(data.records)
            ? data.records
            : [];

        setQuestions(records.map(normalizeQuestion));
        setStudents(
          Array.isArray(data.students)
            ? data.students.map(normalizeStudent)
            : [],
        );
        setStats(normalizeStats(data.stats));
        setTotal(numberValue(data.pagination?.total));
        setTotalPages(numberValue(data.pagination?.totalPages));
        setLastUpdated(new Date().toISOString());
      } catch (requestError) {
        if (
          requestError instanceof Error &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        if (sequence !== requestSequence.current) return;

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Coding records could not be loaded.",
        );
      } finally {
        if (sequence === requestSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, search, difficulty, status, track],
  );

  useEffect(() => {
    void loadCodingData(true);

    return () => {
      abortRef.current?.abort();
    };
  }, [loadCodingData]);

  function updateForm<K extends keyof QuestionForm>(
    key: K,
    value: QuestionForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim().slice(0, SEARCH_LIMIT));
  }

  function clearFilters() {
    setSearch("");
    setSearchInput("");
    setDifficulty("");
    setStatus("");
    setTrack("");
    setPage(1);
  }

  function validateQuestion(): string {
    if (form.title.trim().length < 5) {
      return "Question title must contain at least 5 characters.";
    }

    if (form.topic.trim().length < 2) {
      return "Please enter a valid topic.";
    }

    if (form.problemStatement.trim().length < 20) {
      return "Problem statement must contain at least 20 characters.";
    }

    const duration = Number(form.durationDays);
    const day = Number(form.dayNumber);
    const points = Number(form.points);

    if (
      !Number.isInteger(duration) ||
      ![30, 90, 180, 365].includes(duration)
    ) {
      return "Select a valid internship duration.";
    }

    if (!Number.isInteger(day) || day < 1 || day > duration) {
      return "Question day must be within the selected duration.";
    }

    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      return "Points must be between 1 and 1000.";
    }

    if (!form.sampleInput.trim() || !form.sampleOutput.trim()) {
      return "Sample input and sample output are required.";
    }

    if (form.sampleInput.length > 5000 || form.sampleOutput.length > 5000) {
      return "Sample input and output must be 5000 characters or less.";
    }

    return "";
  }

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateQuestion();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    setSuccess("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "create-question",
          question: {
            title: form.title.trim(),
            track: form.track,
            topic: form.topic.trim(),
            difficulty: form.difficulty,
            language: form.language,
            durationDays: Number(form.durationDays),
            dayNumber: Number(form.dayNumber),
            points: Number(form.points),
            problemStatement: form.problemStatement.trim(),
            inputFormat: form.inputFormat.trim(),
            outputFormat: form.outputFormat.trim(),
            constraints: form.constraints.trim(),
            sampleInput: form.sampleInput.trim(),
            sampleOutput: form.sampleOutput.trim(),
            explanation: form.explanation.trim(),
          },
        }),
      });

      const result = await response.json().catch(() => null);

      if (response.status === 401 || response.status === 403) {
        window.location.replace(
          "/login?mode=student-admin&next=%2Fstudent-admin%2Fcoding",
        );
        return;
      }

      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.message ||
            `Question could not be saved (${response.status}).`,
        );
      }

      setSuccess(result.message || "Coding question created successfully.");
      setShowForm(false);
      setForm(EMPTY_FORM);
      setPage(1);
      setSearch("");
      setSearchInput("");
      setDifficulty("");
      setStatus("");
      setTrack("");
      setActiveTab("questions");
      await loadCodingData(true);
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create coding question.",
      );
    } finally {
      setSaving(false);
    }
  }

  function exportQuestions() {
    if (questions.length === 0) return;

    const columns = [
      "Title",
      "Track",
      "Topic",
      "Difficulty",
      "Day",
      "Duration",
      "Language",
      "Points",
      "Status",
    ];

    const rows = questions.map((question) => [
      question.title,
      question.track,
      question.topic,
      question.difficulty,
      question.dayNumber,
      question.durationDays,
      question.language,
      question.points,
      question.status,
    ]);

    const escapeCsv = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      columns.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `cybernet-coding-questions-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const completionRate =
    stats.totalSubmissions > 0
      ? Math.round(
          (stats.passedSubmissions / stats.totalSubmissions) * 100,
        )
      : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
              <Code2 size={14} />
              Student Operations
              <span className="text-slate-300">/</span>
              Learning Management
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Coding Management
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage daily coding questions, internship schedules and student
              learning performance from one workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadCodingData(false)}
              disabled={refreshing || loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} />
              Create Question
            </button>
          </div>
        </header>

        <div className="mb-5 flex flex-col justify-between gap-2 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <ShieldCheck size={19} />
            </span>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Secure Student Operations workspace
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Authenticated requests · Server-side data loading
              </p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            {lastUpdated
              ? `Last updated ${dateLabel(lastUpdated)}`
              : "Waiting for coding data"}
          </p>
        </div>

        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-w-fit items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {error ? (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <div>
                <p className="text-xs font-bold text-rose-900">
                  Coding data could not be loaded
                </p>
                <p className="mt-1 text-xs leading-5 text-rose-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadCodingData(true)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-auto rounded-md p-1 hover:bg-emerald-100"
              aria-label="Dismiss success message"
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 size={28} className="animate-spin text-blue-600" />
              <p className="text-xs font-semibold">
                Loading coding workspace...
              </p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "overview" ? (
              <section className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Total Questions"
                    value={stats.totalQuestions}
                    detail={`${stats.publishedQuestions} published · ${stats.draftQuestions} drafts`}
                    icon={BookOpen}
                    tone="bg-blue-50 text-blue-600"
                  />
                  <StatCard
                    label="Enrolled Students"
                    value={stats.totalStudents}
                    detail={`${stats.activeStudents} active students`}
                    icon={Users}
                    tone="bg-violet-50 text-violet-600"
                  />
                  <StatCard
                    label="Today's Submissions"
                    value={stats.submissionsToday}
                    detail={`${stats.completedToday} completed questions`}
                    icon={Zap}
                    tone="bg-amber-50 text-amber-600"
                  />
                  <StatCard
                    label="Attendance Today"
                    value={`${stats.attendanceToday}%`}
                    detail="Based on recorded attendance"
                    icon={CalendarDays}
                    tone="bg-emerald-50 text-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900">
                          Coding Performance
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Submission results across assigned questions
                        </p>
                      </div>
                      <BarChart3 size={19} className="text-blue-600" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold text-slate-500">
                          Average Student Progress
                        </p>
                        <p className="mt-3 text-3xl font-extrabold text-slate-950">
                          {stats.averageProgress}%
                        </p>
                        <div className="mt-4">
                          <ProgressBar value={stats.averageProgress} />
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold text-slate-500">
                          Successful Submission Rate
                        </p>
                        <p className="mt-3 text-3xl font-extrabold text-slate-950">
                          {completionRate}%
                        </p>
                        <div className="mt-4">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-[10px] text-slate-500">
                          Total Submissions
                        </p>
                        <p className="mt-1 text-xl font-extrabold text-slate-900">
                          {stats.totalSubmissions}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-[10px] text-slate-500">Passed</p>
                        <p className="mt-1 text-xl font-extrabold text-emerald-600">
                          {stats.passedSubmissions}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-[10px] text-slate-500">Pending</p>
                        <p className="mt-1 text-xl font-extrabold text-amber-600">
                          {stats.pendingSubmissions}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Quick Actions
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Manage your coding program
                    </p>

                    <div className="mt-5 space-y-3">
                      <button
                        type="button"
                        onClick={openCreateForm}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Plus size={18} />
                        </span>
                        <span>
                          <span className="block text-xs font-bold text-slate-800">
                            Add Coding Question
                          </span>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            Create a daily task
                          </span>
                        </span>
                        <ArrowRight size={15} className="ml-auto text-slate-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("questions")}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                          <Layers3 size={18} />
                        </span>
                        <span>
                          <span className="block text-xs font-bold text-slate-800">
                            Question Bank
                          </span>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            Review created questions
                          </span>
                        </span>
                        <ArrowRight size={15} className="ml-auto text-slate-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab("analytics")}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                          <BarChart3 size={18} />
                        </span>
                        <span>
                          <span className="block text-xs font-bold text-slate-800">
                            Student Analytics
                          </span>
                          <span className="mt-1 block text-[10px] text-slate-500">
                            Monitor learning progress
                          </span>
                        </span>
                        <ArrowRight size={15} className="ml-auto text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Student Progress Snapshot
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Latest student coding activity
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("analytics")}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      View all
                    </button>
                  </div>

                  {students.length === 0 ? (
                    <EmptyState
                      title="No student progress available"
                      description="Student progress will appear here when the coding API returns student records."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="px-3 py-3 font-bold">Student</th>
                            <th className="px-3 py-3 font-bold">Track</th>
                            <th className="px-3 py-3 font-bold">Progress</th>
                            <th className="px-3 py-3 font-bold">Attendance</th>
                            <th className="px-3 py-3 font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.slice(0, 5).map((student) => (
                            <tr
                              key={student.id}
                              className="border-b border-slate-50 last:border-0"
                            >
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-[11px] font-extrabold text-blue-700">
                                    {initials(student.studentName)}
                                  </span>
                                  <span>
                                    <span className="block text-xs font-bold text-slate-800">
                                      {student.studentName}
                                    </span>
                                    <span className="mt-1 block text-[10px] text-slate-500">
                                      {student.studentId}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600">
                                {student.track}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-24">
                                    <ProgressBar value={student.progress} />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600">
                                    {student.progress}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-xs font-semibold text-slate-700">
                                {student.attendance}%
                              </td>
                              <td className="px-3 py-3">
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${badgeClass(student.status)}`}>
                                  {student.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "questions" ? (
              <section className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard
                    label="All Questions"
                    value={stats.totalQuestions}
                    detail="Created in question bank"
                    icon={BookOpen}
                    tone="bg-blue-50 text-blue-600"
                  />
                  <StatCard
                    label="Published"
                    value={stats.publishedQuestions}
                    detail="Available for assignment"
                    icon={CheckCircle2}
                    tone="bg-emerald-50 text-emerald-600"
                  />
                  <StatCard
                    label="Drafts"
                    value={stats.draftQuestions}
                    detail="Not yet published"
                    icon={Clock3}
                    tone="bg-amber-50 text-amber-600"
                  />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900">
                          Coding Question Bank
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Organize questions by internship track and day
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={exportQuestions}
                          disabled={questions.length === 0}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Download size={14} />
                          Export CSV
                        </button>
                        <button
                          type="button"
                          onClick={openCreateForm}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          <Plus size={14} />
                          Add Question
                        </button>
                      </div>
                    </div>

                    <form
                      onSubmit={handleSearch}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5"
                    >
                      <div className="relative sm:col-span-2 xl:col-span-2">
                        <Search
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          value={searchInput}
                          onChange={(event) =>
                            setSearchInput(event.target.value)
                          }
                          maxLength={SEARCH_LIMIT}
                          placeholder="Search title, topic or track..."
                          className={`${inputClass} pl-9`}
                        />
                      </div>

                      <select
                        value={track}
                        onChange={(event) => {
                          setTrack(event.target.value);
                          setPage(1);
                        }}
                        className={inputClass}
                      >
                        <option value="">All tracks</option>
                        {TRACK_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>

                      <select
                        value={difficulty}
                        onChange={(event) => {
                          setDifficulty(event.target.value);
                          setPage(1);
                        }}
                        className={inputClass}
                      >
                        <option value="">All difficulty</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>

                      <select
                        value={status}
                        onChange={(event) => {
                          setStatus(event.target.value);
                          setPage(1);
                        }}
                        className={inputClass}
                      >
                        <option value="">All statuses</option>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>

                      <div className="flex gap-2 sm:col-span-2 xl:col-span-5">
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          <Filter size={13} />
                          Apply Filters
                        </button>
                        <button
                          type="button"
                          onClick={clearFilters}
                          disabled={activeFilters === 0}
                          className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </form>
                  </div>

                  {questions.length === 0 ? (
                    <EmptyState
                      title="No coding questions found"
                      description={
                        activeFilters > 0
                          ? "Try changing your search or filters."
                          : "Create your first coding question to start building the daily learning schedule."
                      }
                      action={
                        <button
                          type="button"
                          onClick={openCreateForm}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          <Plus size={15} />
                          Create First Question
                        </button>
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="px-5 py-3 font-bold">Question</th>
                            <th className="px-4 py-3 font-bold">Track</th>
                            <th className="px-4 py-3 font-bold">Difficulty</th>
                            <th className="px-4 py-3 font-bold">Schedule</th>
                            <th className="px-4 py-3 font-bold">Points</th>
                            <th className="px-4 py-3 font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {questions.map((question) => (
                            <tr
                              key={question.id}
                              className="border-b border-slate-50 transition hover:bg-slate-50/70 last:border-0"
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-start gap-3">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                    <Code2 size={17} />
                                  </span>
                                  <span>
                                    <span className="block max-w-[280px] truncate text-xs font-bold text-slate-800">
                                      {question.title}
                                    </span>
                                    <span className="mt-1 block text-[10px] text-slate-500">
                                      {question.topic} · {question.language}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-xs text-slate-600">
                                {question.track}
                              </td>
                              <td className="px-4 py-4">
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${difficultyClass(question.difficulty)}`}>
                                  {question.difficulty}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-xs font-semibold text-slate-700">
                                Day {question.dayNumber}
                                <span className="mt-1 block text-[10px] font-normal text-slate-400">
                                  of {question.durationDays} days
                                </span>
                              </td>
                              <td className="px-4 py-4 text-xs font-bold text-slate-700">
                                {question.points}
                              </td>
                              <td className="px-4 py-4">
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${badgeClass(question.status)}`}>
                                  {question.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-slate-500">
                      {total > 0
                        ? `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, total)}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString("en-IN")} questions`
                        : "No question records"}
                    </p>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <button
                        type="button"
                        disabled={loading || page <= 1}
                        onClick={() =>
                          setPage((current) => Math.max(1, current - 1))
                        }
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ArrowLeft size={13} />
                        Previous
                      </button>
                      <span className="min-w-[65px] text-center text-xs font-bold text-slate-600">
                        {totalPages > 0 ? `${page} / ${totalPages}` : "0 / 0"}
                      </span>
                      <button
                        type="button"
                        disabled={
                          loading || totalPages === 0 || page >= totalPages
                        }
                        onClick={() =>
                          setPage((current) =>
                            Math.min(totalPages, current + 1),
                          )
                        }
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Next
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === "schedule" ? (
              <section className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Published Questions"
                    value={stats.publishedQuestions}
                    detail="Ready for daily assignment"
                    icon={CheckCircle2}
                    tone="bg-emerald-50 text-emerald-600"
                  />
                  <StatCard
                    label="Active Students"
                    value={stats.activeStudents}
                    detail="Eligible student records"
                    icon={Users}
                    tone="bg-blue-50 text-blue-600"
                  />
                  <StatCard
                    label="Daily Completion"
                    value={stats.completedToday}
                    detail="Recorded completions today"
                    icon={Target}
                    tone="bg-violet-50 text-violet-600"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900">
                        Daily Coding Schedule
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                        One assigned question per active internship day.
                        Each student's schedule should follow their approved
                        internship duration and start date.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 self-start rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">
                      <CalendarDays size={13} />
                      Day-wise program
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { days: 30, title: "1 Month Program" },
                      { days: 90, title: "3 Months Program" },
                      { days: 180, title: "6 Months Program" },
                    ].map((item) => (
                      <div
                        key={item.days}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <p className="text-2xl font-extrabold text-slate-900">
                          {item.days}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-700">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[10px] leading-5 text-slate-500">
                          {item.days} daily coding questions
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-amber-700"
                      />
                      <div>
                        <p className="text-xs font-bold text-amber-900">
                          Daily unlock and approval require backend enforcement
                        </p>
                        <p className="mt-1 text-xs leading-6 text-amber-800">
                          This page manages the question bank and displays
                          schedule information. Student submission approval,
                          question locking and next-day unlocking must be
                          validated by the server before a student can access
                          another question.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("questions")}
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <BookOpen size={15} />
                    Manage Questions
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Daily Learning Rules
                  </h2>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {[
                      {
                        title: "One question per day",
                        detail:
                          "Each student receives one question for their current internship day.",
                        icon: Target,
                      },
                      {
                        title: "Admin approval",
                        detail:
                          "A submitted solution should be reviewed before the next day is unlocked.",
                        icon: ShieldCheck,
                      },
                      {
                        title: "Locked after approval",
                        detail:
                          "An approved daily submission should become read-only and prevent duplicate completion.",
                        icon: CheckCircle2,
                      },
                      {
                        title: "Duration-aware schedule",
                        detail:
                          "Daily assignments should stop at the approved internship duration.",
                        icon: Clock3,
                      },
                    ].map((rule) => {
                      const Icon = rule.icon;

                      return (
                        <div
                          key={rule.title}
                          className="flex gap-3 rounded-xl border border-slate-100 p-4"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <Icon size={17} />
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {rule.title}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-slate-500">
                              {rule.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === "analytics" ? (
              <section className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Total Students"
                    value={stats.totalStudents}
                    detail="Coding program students"
                    icon={Users}
                    tone="bg-blue-50 text-blue-600"
                  />
                  <StatCard
                    label="Average Progress"
                    value={`${stats.averageProgress}%`}
                    detail="Across available student records"
                    icon={Activity}
                    tone="bg-violet-50 text-violet-600"
                  />
                  <StatCard
                    label="Passed Submissions"
                    value={stats.passedSubmissions}
                    detail="Successful submissions"
                    icon={CheckCircle2}
                    tone="bg-emerald-50 text-emerald-600"
                  />
                  <StatCard
                    label="Active Streaks"
                    value={students.filter((item) => item.streak > 0).length}
                    detail="Students with a recorded streak"
                    icon={Flame}
                    tone="bg-orange-50 text-orange-600"
                  />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-5">
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Student Coding Analytics
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Individual progress, attendance and submission activity
                    </p>
                  </div>

                  {students.length === 0 ? (
                    <EmptyState
                      title="No analytics records available"
                      description="Student analytics will populate when the coding API returns student progress, submissions and attendance records."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px] text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="px-5 py-3 font-bold">Student</th>
                            <th className="px-4 py-3 font-bold">Track</th>
                            <th className="px-4 py-3 font-bold">Days Completed</th>
                            <th className="px-4 py-3 font-bold">Progress</th>
                            <th className="px-4 py-3 font-bold">Attendance</th>
                            <th className="px-4 py-3 font-bold">Streak</th>
                            <th className="px-4 py-3 font-bold">Last Submission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr
                              key={student.id}
                              className="border-b border-slate-50 last:border-0"
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-[11px] font-extrabold text-blue-700">
                                    {initials(student.studentName)}
                                  </span>
                                  <span>
                                    <span className="block text-xs font-bold text-slate-800">
                                      {student.studentName}
                                    </span>
                                    <span className="mt-1 block text-[10px] text-slate-500">
                                      {student.studentId}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-xs text-slate-600">
                                {student.track}
                              </td>
                              <td className="px-4 py-4 text-xs font-bold text-slate-700">
                                {student.completedDays} / {student.durationDays}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-20">
                                    <ProgressBar value={student.progress} />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600">
                                    {student.progress}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-xs font-bold text-slate-700">
                                {student.attendance}%
                              </td>
                              <td className="px-4 py-4">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600">
                                  <Flame size={13} />
                                  {student.streak} days
                                </span>
                              </td>
                              <td className="px-4 py-4 text-[10px] text-slate-500">
                                {dateLabel(student.lastSubmissionAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </>
        )}

        <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-[10px] text-slate-400 sm:flex-row sm:items-center">
          <span>
            © {new Date().getFullYear()} CyberNet Careers · Student Operations
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} />
            Authorized coding management workspace
          </span>
        </footer>
      </div>

      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coding-question-title"
        >
          <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  <Code2 size={13} />
                  Question Builder
                </div>
                <h2
                  id="coding-question-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  Create Coding Question
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Configure a track-specific daily coding assignment
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Close question form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createQuestion}>
              <div className="max-h-[72vh] space-y-6 overflow-y-auto p-5 sm:p-6">
                {formError ? (
                  <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                    <AlertCircle size={15} className="shrink-0" />
                    {formError}
                  </div>
                ) : null}

                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <BookOpen size={16} className="text-blue-600" />
                    <h3 className="text-xs font-extrabold text-slate-800">
                      Question Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label="Question Title" required>
                        <input
                          required
                          minLength={5}
                          maxLength={180}
                          value={form.title}
                          onChange={(event) =>
                            updateForm("title", event.target.value)
                          }
                          placeholder="Example: Build a function to reverse a string"
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <Field label="Internship Track" required>
                      <select
                        value={form.track}
                        onChange={(event) =>
                          updateForm("track", event.target.value)
                        }
                        className={inputClass}
                      >
                        {TRACK_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Topic" required>
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={form.topic}
                        onChange={(event) =>
                          updateForm("topic", event.target.value)
                        }
                        placeholder="Example: JavaScript Functions"
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Difficulty" required>
                      <select
                        value={form.difficulty}
                        onChange={(event) =>
                          updateForm(
                            "difficulty",
                            event.target.value as Difficulty,
                          )
                        }
                        className={inputClass}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </Field>

                    <Field label="Programming Language" required>
                      <select
                        value={form.language}
                        onChange={(event) =>
                          updateForm("language", event.target.value)
                        }
                        className={inputClass}
                      >
                        {LANGUAGE_OPTIONS.map((language) => (
                          <option key={language} value={language}>
                            {language}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CalendarDays size={16} className="text-blue-600" />
                    <h3 className="text-xs font-extrabold text-slate-800">
                      Daily Schedule Configuration
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Program Duration" required>
                      <select
                        value={form.durationDays}
                        onChange={(event) => {
                          const nextDuration = event.target.value;
                          updateForm("durationDays", nextDuration);

                          if (Number(form.dayNumber) > Number(nextDuration)) {
                            updateForm("dayNumber", nextDuration);
                          }
                        }}
                        className={inputClass}
                      >
                        <option value="30">30 Days · 1 Month</option>
                        <option value="90">90 Days · 3 Months</option>
                        <option value="180">180 Days · 6 Months</option>
                        <option value="365">365 Days · 1 Year</option>
                      </select>
                    </Field>

                    <Field label="Question Day" required>
                      <input
                        required
                        type="number"
                        min={1}
                        max={Number(form.durationDays)}
                        step={1}
                        value={form.dayNumber}
                        onChange={(event) =>
                          updateForm("dayNumber", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Maximum Points" required>
                      <input
                        required
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        value={form.points}
                        onChange={(event) =>
                          updateForm("points", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <p className="mt-3 text-[10px] leading-5 text-slate-500">
                    A complete program should contain one published question
                    for each scheduled day of the selected track and duration.
                  </p>
                </section>

                <section className="border-t border-slate-100 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Code2 size={16} className="text-blue-600" />
                    <h3 className="text-xs font-extrabold text-slate-800">
                      Problem Statement
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <Field label="Description" required>
                      <textarea
                        required
                        minLength={20}
                        maxLength={12000}
                        rows={5}
                        value={form.problemStatement}
                        onChange={(event) =>
                          updateForm("problemStatement", event.target.value)
                        }
                        placeholder="Explain the coding problem and expected behavior..."
                        className={textareaClass}
                      />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Input Format">
                        <textarea
                          rows={3}
                          maxLength={3000}
                          value={form.inputFormat}
                          onChange={(event) =>
                            updateForm("inputFormat", event.target.value)
                          }
                          placeholder="Describe the expected input..."
                          className={textareaClass}
                        />
                      </Field>

                      <Field label="Output Format">
                        <textarea
                          rows={3}
                          maxLength={3000}
                          value={form.outputFormat}
                          onChange={(event) =>
                            updateForm("outputFormat", event.target.value)
                          }
                          placeholder="Describe the expected output..."
                          className={textareaClass}
                        />
                      </Field>
                    </div>

                    <Field label="Constraints">
                      <textarea
                        rows={2}
                        maxLength={3000}
                        value={form.constraints}
                        onChange={(event) =>
                          updateForm("constraints", event.target.value)
                        }
                        placeholder="Example: 1 <= n <= 100000"
                        className={textareaClass}
                      />
                    </Field>
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Layers3 size={16} className="text-blue-600" />
                    <h3 className="text-xs font-extrabold text-slate-800">
                      Sample Test Case
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Sample Input" required>
                      <textarea
                        required
                        rows={4}
                        maxLength={5000}
                        value={form.sampleInput}
                        onChange={(event) =>
                          updateForm("sampleInput", event.target.value)
                        }
                        placeholder="Enter sample input..."
                        className={`${textareaClass} bg-slate-950 font-mono text-emerald-300 placeholder:text-slate-500`}
                      />
                    </Field>

                    <Field label="Sample Output" required>
                      <textarea
                        required
                        rows={4}
                        maxLength={5000}
                        value={form.sampleOutput}
                        onChange={(event) =>
                          updateForm("sampleOutput", event.target.value)
                        }
                        placeholder="Enter expected output..."
                        className={`${textareaClass} bg-slate-950 font-mono text-emerald-300 placeholder:text-slate-500`}
                      />
                    </Field>
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-5">
                  <Field label="Explanation / Learning Hint">
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={form.explanation}
                      onChange={(event) =>
                        updateForm("explanation", event.target.value)
                      }
                      placeholder="Optional explanation shown according to your learning policy..."
                      className={textareaClass}
                    />
                  </Field>
                </section>
              </div>

              <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <p className="text-[10px] leading-5 text-slate-500">
                  Question creation is processed by the authenticated API.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    {saving ? "Saving..." : "Save Question"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
