"use client";

import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  FileQuestion,
  Filter,
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
} from "react";

type Difficulty = "easy" | "medium" | "hard";
type QuestionStatus = "draft" | "active" | "inactive";
type OptionId = "A" | "B" | "C" | "D";

type Assessment = {
  _id: string;
  assessmentId?: string;
  title: string;
  domain?: string;
  status: string;
};

type Option = {
  optionId: OptionId;
  text: string;
};

type Question = {
  _id: string;
  questionId?: string;
  assessmentId: string;
  type: "mcq";
  section: Difficulty;
  difficulty: Difficulty;
  question: string;
  options: Option[];
  correctOption: OptionId;
  marks: number;
  negativeMarks?: number;
  status: QuestionStatus;
  isActive: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
};

type QuestionForm = {
  section: Difficulty;
  question: string;
  options: Option[];
  correctOption: OptionId | "";
  status: "draft" | "active";
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

const API_URL = "/api/admin/questions";
const ASSESSMENTS_API_URL = "/api/admin/assessments";
const SECTION_ORDER: Difficulty[] = ["easy", "medium", "hard"];
const SECTION_LIMIT = 30;
const TOTAL_QUESTIONS = 90;
const OPTION_IDS: OptionId[] = ["A", "B", "C", "D"];

const SECTION_META: Record<
  Difficulty,
  { title: string; description: string; accent: string; soft: string; ring: string }
> = {
  easy: {
    title: "Easy",
    description: "Fundamental concepts and basic understanding",
    accent: "text-emerald-700",
    soft: "bg-emerald-50",
    ring: "border-emerald-200",
  },
  medium: {
    title: "Medium",
    description: "Applied concepts and practical understanding",
    accent: "text-amber-700",
    soft: "bg-amber-50",
    ring: "border-amber-200",
  },
  hard: {
    title: "Hard",
    description: "Advanced concepts and deeper problem solving",
    accent: "text-rose-700",
    soft: "bg-rose-50",
    ring: "border-rose-200",
  },
};

function makeOptions(): Option[] {
  return OPTION_IDS.map((optionId) => ({ optionId, text: "" }));
}

function emptyForm(section: Difficulty = "easy"): QuestionForm {
  return {
    section,
    question: "",
    options: makeOptions(),
    correctOption: "",
    status: "draft",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readArray(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload[key])) return payload[key];
  if (Array.isArray(payload.data)) return payload.data;
  if (isRecord(payload.data)) {
    const nested = payload.data;
    if (Array.isArray(nested[key])) return nested[key];
    if (Array.isArray(nested.items)) return nested.items;
  }
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function readError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return fallback;
}

function normalizeAssessment(value: unknown): Assessment | null {
  if (!isRecord(value)) return null;
  const id = value._id ?? value.id;
  if (typeof id !== "string") return null;
  return {
    _id: id,
    assessmentId: typeof value.assessmentId === "string" ? value.assessmentId : undefined,
    title: typeof value.title === "string" ? value.title : "Untitled assessment",
    domain: typeof value.domain === "string" ? value.domain : undefined,
    status: typeof value.status === "string" ? value.status.toLowerCase() : "draft",
  };
}

function normalizeQuestion(value: unknown): Question | null {
  if (!isRecord(value)) return null;
  const id = value._id ?? value.id;
  if (typeof id !== "string") return null;

  const rawSection = String(value.section ?? value.difficulty ?? "").toLowerCase();
  if (!SECTION_ORDER.includes(rawSection as Difficulty)) return null;

  const options = Array.isArray(value.options)
    ? value.options.slice(0, 4).map((item, index) => {
        const option = isRecord(item) ? item : {};
        const rawId = String(option.optionId ?? option.id ?? OPTION_IDS[index]).toUpperCase();
        const optionId = OPTION_IDS.includes(rawId as OptionId)
          ? (rawId as OptionId)
          : OPTION_IDS[index];
        return {
          optionId,
          text: typeof option.text === "string" ? option.text : "",
        };
      })
    : [];

  const rawStatus = String(value.status ?? "").toLowerCase();
  const status: QuestionStatus =
    rawStatus === "published" || rawStatus === "active"
      ? value.isActive === false
        ? "inactive"
        : "active"
      : rawStatus === "archived" || rawStatus === "inactive"
        ? "inactive"
        : "draft";

  const correct = String(value.correctOption ?? value.correctAnswer ?? "").toUpperCase();

  return {
    _id: id,
    questionId: typeof value.questionId === "string" ? value.questionId : undefined,
    assessmentId: typeof value.assessmentId === "string" ? value.assessmentId : "",
    type: "mcq",
    section: rawSection as Difficulty,
    difficulty: rawSection as Difficulty,
    question: typeof value.question === "string" ? value.question : "",
    options,
    correctOption: OPTION_IDS.includes(correct as OptionId) ? (correct as OptionId) : "A",
    marks: typeof value.marks === "number" ? value.marks : 1,
    negativeMarks: typeof value.negativeMarks === "number" ? value.negativeMarks : 0,
    status,
    isActive: value.isActive === true || rawStatus === "active" || rawStatus === "published",
    order: typeof value.order === "number" ? value.order : undefined,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
}

function isAssessmentLocked(assessment?: Assessment): boolean {
  return assessment?.status === "published" || assessment?.status === "archived";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isComplete(question: Question): boolean {
  return (
    question.question.trim().length >= 5 &&
    question.options.length === 4 &&
    question.options.every((option) => option.text.trim().length > 0) &&
    OPTION_IDS.includes(question.correctOption) &&
    question.marks === 1
  );
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readError(payload, `Request failed with status ${response.status}.`));
  }
  return payload;
}

export default function AdminQuestionsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuestionStatus>("all");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [form, setForm] = useState<QuestionForm>(emptyForm());
  const [selectedSection, setSelectedSection] = useState<Difficulty>("easy");
  const searchRef = useRef<HTMLInputElement>(null);
  const assessmentRequestRef = useRef(0);
  const questionRequestRef = useRef(0);

  const selectedAssessment = useMemo(
    () => assessments.find((item) => item._id === selectedAssessmentId),
    [assessments, selectedAssessmentId],
  );

  const locked = isAssessmentLocked(selectedAssessment);

  const sectionCounts = useMemo(() => {
    const result: Record<Difficulty, { total: number; active: number; draft: number; inactive: number }> = {
      easy: { total: 0, active: 0, draft: 0, inactive: 0 },
      medium: { total: 0, active: 0, draft: 0, inactive: 0 },
      hard: { total: 0, active: 0, draft: 0, inactive: 0 },
    };
    for (const question of questions) {
      const row = result[question.section];
      row.total += 1;
      row[question.status] += 1;
    }
    return result;
  }, [questions]);

  const activeCount = SECTION_ORDER.reduce((sum, section) => sum + sectionCounts[section].active, 0);
  const completeActiveCount = questions.filter(
    (question) => question.status === "active" && isComplete(question),
  ).length;
  const totalReady = SECTION_ORDER.every(
    (section) => sectionCounts[section].total === SECTION_LIMIT &&
      sectionCounts[section].active === SECTION_LIMIT,
  );
  const assessmentReady = totalReady && completeActiveCount === TOTAL_QUESTIONS;

  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      if (statusFilter !== "all" && question.status !== statusFilter) return false;
      if (!query) return true;
      return (
        question.question.toLowerCase().includes(query) ||
        (question.questionId ?? "").toLowerCase().includes(query)
      );
    }).sort((a, b) => {
      const sectionDiff = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
      if (sectionDiff !== 0) return sectionDiff;
      return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
    });
  }, [questions, search, statusFilter]);

  const loadAssessments = useCallback(async () => {
    const requestId = ++assessmentRequestRef.current;
    setLoadingAssessments(true);
    try {
      const payload = await requestJson(`${ASSESSMENTS_API_URL}?page=1&limit=100`);
      const rows = readArray(payload, "assessments")
        .map(normalizeAssessment)
        .filter((item): item is Assessment => item !== null);
      if (requestId !== assessmentRequestRef.current) return;
      setAssessments(rows);
      setSelectedAssessmentId((current) => {
        if (rows.some((item) => item._id === current)) return current;
        const queryId = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("assessmentId")
          : null;
        const match = rows.find((item) => item._id === queryId || item.assessmentId === queryId);
        return match?._id ?? rows[0]?._id ?? "";
      });
    } catch (error) {
      if (requestId === assessmentRequestRef.current) {
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to load assessments.",
        });
      }
    } finally {
      if (requestId === assessmentRequestRef.current) setLoadingAssessments(false);
    }
  }, []);

  const loadQuestions = useCallback(async (assessmentId: string, silent = false) => {
    const requestId = ++questionRequestRef.current;
    if (!assessmentId) {
      setQuestions([]);
      setLoadingQuestions(false);
      return;
    }
    if (!silent) {
      setLoadingQuestions(true);
      setQuestions([]);
    }
    try {
      const params = new URLSearchParams({
        assessmentId,
        type: "mcq",
        page: "1",
        limit: "100",
        sortField: "order",
        sortDirection: "asc",
      });
      const payload = await requestJson(`${API_URL}?${params.toString()}`);
      const rows = readArray(payload, "questions")
        .map(normalizeQuestion)
        .filter((item): item is Question => item !== null)
        .filter((item) => !item.assessmentId || item.assessmentId === assessmentId);
      if (requestId === questionRequestRef.current) setQuestions(rows);
    } catch (error) {
      if (requestId === questionRequestRef.current && !silent) {
        setQuestions([]);
        setNotice({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to load questions.",
        });
      }
    } finally {
      if (requestId === questionRequestRef.current && !silent) setLoadingQuestions(false);
    }
  }, []);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  useEffect(() => {
    void loadQuestions(selectedAssessmentId);
  }, [selectedAssessmentId, loadQuestions]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setNotice(null);
    await loadAssessments();
    if (selectedAssessmentId) await loadQuestions(selectedAssessmentId);
    setRefreshing(false);
  }, [loadAssessments, loadQuestions, selectedAssessmentId]);

  const openCreate = useCallback((section: Difficulty) => {
    if (!selectedAssessmentId) {
      setNotice({ type: "error", message: "Create or select an assessment before adding questions." });
      return;
    }
    if (locked) {
      setNotice({ type: "error", message: "This assessment is locked because it is published or archived." });
      return;
    }
    if (sectionCounts[section].total >= SECTION_LIMIT) {
      setNotice({ type: "error", message: `${SECTION_META[section].title} section already contains 30 questions.` });
      return;
    }
    setSelectedSection(section);
    setEditingQuestion(null);
    setForm(emptyForm(section));
    setNotice(null);
    setModalOpen(true);
  }, [selectedAssessmentId, locked, sectionCounts]);

  const openEdit = useCallback((question: Question) => {
    if (locked) {
      setNotice({ type: "error", message: "Published or archived assessments cannot be edited." });
      return;
    }
    setSelectedSection(question.section);
    setEditingQuestion(question);
    setForm({
      section: question.section,
      question: question.question,
      options: OPTION_IDS.map((optionId) => ({
        optionId,
        text: question.options.find((item) => item.optionId === optionId)?.text ?? "",
      })),
      correctOption: question.correctOption,
      status: question.status === "active" ? "active" : "draft",
    });
    setNotice(null);
    setModalOpen(true);
  }, [locked]);

  const updateField = useCallback(<K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const updateOption = useCallback((optionId: OptionId, text: string) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.optionId === optionId ? { ...option, text } : option,
      ),
    }));
  }, []);

  const validateForm = useCallback((): string | null => {
    if (form.question.trim().length < 5) return "Question must contain at least 5 characters.";
    if (form.question.trim().length > 10000) return "Question is too long.";
    if (form.options.length !== 4 || form.options.some((option) => !option.text.trim())) {
      return "Fill all four answer options.";
    }
    if (form.options.some((option) => option.text.trim().length > 1000)) {
      return "Each option must be 1000 characters or fewer.";
    }
    const uniqueOptions = new Set(form.options.map((option) => option.text.trim().toLowerCase()));
    if (uniqueOptions.size !== 4) return "All four options must be different.";
    if (!OPTION_IDS.includes(form.correctOption as OptionId)) return "Select the correct answer.";
    return null;
  }, [form]);

  const saveQuestion = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (saving) return;
    if (!selectedAssessmentId) {
      setNotice({ type: "error", message: "Select an assessment first." });
      return;
    }
    if (locked) {
      setNotice({ type: "error", message: "This assessment is locked." });
      return;
    }
    const validation = validateForm();
    if (validation) {
      setNotice({ type: "error", message: validation });
      return;
    }
    if (!editingQuestion && sectionCounts[form.section].total >= SECTION_LIMIT) {
      setNotice({ type: "error", message: `${SECTION_META[form.section].title} section already contains 30 questions.` });
      return;
    }

    setSaving(true);
    setNotice(null);
    const payload = {
      assessmentId: selectedAssessmentId,
      type: "mcq",
      section: form.section,
      difficulty: form.section,
      question: form.question.trim(),
      options: form.options.map((option) => ({
        optionId: option.optionId,
        id: option.optionId,
        text: option.text.trim(),
      })),
      correctOption: form.correctOption,
      correctAnswer: form.correctOption,
      status: form.status,
      isActive: form.status === "active",
    };

    try {
      const endpoint = editingQuestion
        ? `${API_URL}?id=${encodeURIComponent(editingQuestion._id)}`
        : API_URL;
      await requestJson(endpoint, {
        method: editingQuestion ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      setEditingQuestion(null);
      setForm(emptyForm());
      setNotice({
        type: "success",
        message: editingQuestion ? "Question updated successfully." : "New question added successfully.",
      });
      await loadQuestions(selectedAssessmentId);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save question.",
      });
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    selectedAssessmentId,
    locked,
    validateForm,
    editingQuestion,
    sectionCounts,
    form,
    loadQuestions,
  ]);

  const changeStatus = useCallback(async (question: Question, status: QuestionStatus) => {
    if (locked || statusUpdatingId) return;
    if (status === "active" && !isComplete(question)) {
      setNotice({ type: "error", message: "Complete all question fields before activating this question." });
      return;
    }
    if (status === "inactive" && !window.confirm("Deactivate this question?")) return;
    setStatusUpdatingId(question._id);
    setNotice(null);
    try {
      await requestJson(`${API_URL}?id=${encodeURIComponent(question._id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          isActive: status === "active",
        }),
      });
      setNotice({ type: "success", message: `Question status changed to ${status}.` });
      await loadQuestions(selectedAssessmentId);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to update question status.",
      });
    } finally {
      setStatusUpdatingId("");
    }
  }, [locked, statusUpdatingId, selectedAssessmentId, loadQuestions]);

  const deleteQuestion = useCallback(async (question: Question) => {
    if (locked || deletingId) return;
    const confirmed = window.confirm(
      `Permanently delete this ${question.section} question?\n\nThis action cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingId(question._id);
    setNotice(null);
    try {
      await requestJson(`${API_URL}?id=${encodeURIComponent(question._id)}`, {
        method: "DELETE",
      });
      setNotice({ type: "success", message: "Question deleted successfully." });
      await loadQuestions(selectedAssessmentId);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete question.",
      });
    } finally {
      setDeletingId("");
    }
  }, [locked, deletingId, selectedAssessmentId, loadQuestions]);

  const duplicateQuestion = useCallback((question: Question) => {
    if (locked) return;
    if (sectionCounts[question.section].total >= SECTION_LIMIT) {
      setNotice({ type: "error", message: `${SECTION_META[question.section].title} section already contains 30 questions.` });
      return;
    }
    setEditingQuestion(null);
    setSelectedSection(question.section);
    setForm({
      section: question.section,
      question: `${question.question} (Copy)`,
      options: question.options.map((option) => ({ ...option })),
      correctOption: question.correctOption,
      status: "draft",
    });
    setNotice({ type: "info", message: "Review the copied question and save it as a new draft." });
    setModalOpen(true);
  }, [locked, sectionCounts]);

  const exportQuestions = useCallback(() => {
    if (filteredQuestions.length === 0) {
      setNotice({ type: "error", message: "There are no questions to export." });
      return;
    }
    const exportData = filteredQuestions.map((question) => ({
      questionId: question.questionId ?? question._id,
      section: question.section,
      difficulty: question.difficulty,
      question: question.question,
      options: question.options,
      correctOption: question.correctOption,
      marks: question.marks,
      status: question.status,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cybernet-question-bank-${selectedAssessment?.assessmentId ?? selectedAssessmentId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [filteredQuestions, selectedAssessment, selectedAssessmentId]);

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
    setEditingQuestion(null);
    setForm(emptyForm());
  }, [saving]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !modalOpen) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA" && target?.tagName !== "SELECT") {
          event.preventDefault();
          searchRef.current?.focus();
        }
      }
      if (event.key === "Escape" && modalOpen && !saving) closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, saving, closeModal]);

  const changeAssessment = (value: string) => {
    setSelectedAssessmentId(value);
    setSearch("");
    setStatusFilter("all");
    setNotice(null);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
              <BookOpen className="h-3.5 w-3.5" />
              CyberNet Assessment Workspace
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Question Bank</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Create, organize and validate the 90-question assessment bank. Every question belongs to one difficulty section.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing || loadingAssessments}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh data
            </button>
            <button
              type="button"
              onClick={exportQuestions}
              disabled={!filteredQuestions.length}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
          </div>
        </header>

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : notice.type === "info"
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <p className="flex-1 text-sm font-semibold">{notice.message}</p>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Step 1 · Select assessment</p>
              {loadingAssessments ? (
                <div className="flex h-12 items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading assessments…
                </div>
              ) : assessments.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  No assessment found. Create an assessment before adding questions.
                </div>
              ) : (
                <div className="relative max-w-2xl">
                  <select
                    value={selectedAssessmentId}
                    onChange={(event) => changeAssessment(event.target.value)}
                    className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    {assessments.map((assessment) => (
                      <option key={assessment._id} value={assessment._id}>
                        {assessment.title}{assessment.domain ? ` · ${assessment.domain}` : ""} · {assessment.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              )}
              {selectedAssessment && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono font-bold text-slate-600">
                    {selectedAssessment.assessmentId ?? selectedAssessment._id}
                  </span>
                  {selectedAssessment.domain && (
                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700">{selectedAssessment.domain}</span>
                  )}
                  <span className={`rounded-lg px-2.5 py-1 font-black uppercase ${
                    selectedAssessment.status === "published"
                      ? "bg-emerald-50 text-emerald-700"
                      : selectedAssessment.status === "archived"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-50 text-amber-700"
                  }`}>
                    {selectedAssessment.status}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Total questions" value={`${questions.length}/90`} />
              <Metric label="Active" value={`${activeCount}/90`} />
              <Metric label="Marks" value={`${activeCount}/90`} />
              <Metric label="Readiness" value={assessmentReady ? "Ready" : "In progress"} />
            </div>
          </div>
          {locked && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-slate-700">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Assessment is locked</p>
                <p className="mt-1 text-xs leading-5">Published or archived assessments are read-only. Create a new assessment version to make changes.</p>
              </div>
            </div>
          )}
        </section>

        <section className={`rounded-2xl border p-4 ${
          assessmentReady ? "border-emerald-200 bg-emerald-50" : "border-blue-100 bg-blue-50"
        }`}>
          <div className="flex items-start gap-3">
            {assessmentReady ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            )}
            <div>
              <p className={`text-sm font-semibold ${assessmentReady ? "text-emerald-900" : "text-blue-900"}`}>
                {assessmentReady ? "Question bank is ready for assessment review." : "Step 2 · Complete all three difficulty sections"}
              </p>
              <p className={`mt-1 text-xs leading-5 ${assessmentReady ? "text-emerald-700" : "text-blue-700"}`}>
                Required structure: 30 Easy + 30 Medium + 30 Hard. Each MCQ carries 1 mark. All 90 questions must be complete and active before the bank is ready.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {SECTION_ORDER.map((section) => {
            const meta = SECTION_META[section];
            const counts = sectionCounts[section];
            const percentage = Math.min(100, (counts.total / SECTION_LIMIT) * 100);
            const sectionQuestions = filteredQuestions.filter((question) => question.section === section);
            return (
              <article key={section} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold uppercase tracking-wider ${meta.soft} ${meta.accent}`}>
                        Difficulty  ·  {section}
                      </span>
                      <h2 className="mt-3 text-lg font-bold">{meta.title} Questions</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{meta.description}</p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.soft} ${meta.accent}`}>
                      <FileQuestion className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-black tabular-nums">{counts.total}<span className="text-base font-bold text-slate-400">/30</span></p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{counts.active} active · {counts.draft} draft · {counts.inactive} inactive</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">{Math.round(percentage)}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${section === "easy" ? "bg-emerald-500" : section === "medium" ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${percentage}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreate(section)}
                    disabled={!selectedAssessmentId || locked || counts.total >= SECTION_LIMIT || loadingQuestions}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Plus className="h-4 w-4" />
                    Add {meta.title} Question
                  </button>
                  {counts.total >= SECTION_LIMIT && (
                    <p className="mt-2 text-center text-xs font-semibold text-emerald-700">Section limit reached · 30/30</p>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {loadingQuestions ? (
                    <div className="flex h-28 items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
                    </div>
                  ) : sectionQuestions.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <FileQuestion className="mx-auto h-7 w-7 text-slate-300" />
                      <p className="mt-2 text-sm font-bold text-slate-600">No questions yet</p>
                      <p className="mt-1 text-xs text-slate-400">Add the first {meta.title.toLowerCase()} question.</p>
                    </div>
                  ) : (
                    sectionQuestions.map((question, index) => (
                      <QuestionItem
                        key={question._id}
                        question={question}
                        index={index + 1}
                        locked={locked}
                        savingStatus={statusUpdatingId === question._id}
                        deleting={deletingId === question._id}
                        onEdit={() => openEdit(question)}
                        onDuplicate={() => duplicateQuestion(question)}
                        onDelete={() => void deleteQuestion(question)}
                        onStatus={(status) => void changeStatus(question, status)}
                      />
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex-1">
              <p className="text-sm font-semibold">Question library tools</p>
              <p className="mt-1 text-xs text-slate-500">Find questions across all difficulty levels and filter by status.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-72">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search question or ID…"
                  aria-label="Search questions"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
              <div className="relative sm:w-44">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | QuestionStatus)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-bold outline-none focus:border-blue-500"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <Filter className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>{filteredQuestions.length} matching questions across all sections</span>
            <span>Tip: press <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs">/</kbd> to search</span>
          </div>
        </section>
      </div>

      {modalOpen && (
        <QuestionEditor
          form={form}
          editing={Boolean(editingQuestion)}
          saving={saving}
          onClose={closeModal}
          onSubmit={saveQuestion}
          onField={updateField}
          onOption={updateOption}
        />
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[105px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function QuestionItem({
  question,
  index,
  locked,
  savingStatus,
  deleting,
  onEdit,
  onDuplicate,
  onDelete,
  onStatus,
}: {
  question: Question;
  index: number;
  locked: boolean;
  savingStatus: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStatus: (status: QuestionStatus) => void;
}) {
  const complete = isComplete(question);
  const statusTone = question.status === "active"
    ? "bg-emerald-50 text-emerald-700"
    : question.status === "inactive"
      ? "bg-slate-100 text-slate-600"
      : "bg-amber-50 text-amber-700";

  return (
    <div className="p-4 transition hover:bg-slate-50">
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-500">
          {question.order ?? index}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${statusTone}`}>{question.status}</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700">1 mark</span>
            {question.questionId && <span className="font-mono text-xs text-slate-400">{question.questionId}</span>}
          </div>
          <p className="line-clamp-3 text-sm font-bold leading-6 text-slate-900">{question.question}</p>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {question.options.map((option) => (
              <div
                key={option.optionId}
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                  option.optionId === question.correctOption
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-100 bg-slate-50 text-slate-600"
                }`}
              >
                <span className="font-black">{option.optionId}.</span>
                <span className="min-w-0 flex-1 break-words">{option.text || "Empty option"}</span>
                {option.optionId === question.correctOption && <Check className="h-3.5 w-3.5 shrink-0" />}
              </div>
            ))}
          </div>
          {!complete && <p className="mt-2 text-xs font-bold text-rose-600">Incomplete question · review before activating</p>}
          {question.updatedAt && <p className="mt-2 text-xs text-slate-400">Updated {formatDate(question.updatedAt)}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={locked || savingStatus || question.status === "active" || !complete}
              onClick={() => onStatus("active")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Activate
            </button>
            <button
              type="button"
              disabled={locked || savingStatus || question.status === "draft"}
              onClick={() => onStatus("draft")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pencil className="h-3 w-3" /> Draft
            </button>
            <button
              type="button"
              disabled={locked || savingStatus || question.status === "inactive"}
              onClick={() => onStatus("inactive")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-3 w-3" /> Deactivate
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={onEdit}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700 disabled:opacity-40"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={onDuplicate}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700 disabled:opacity-40"
            >
              <Copy className="h-3 w-3" /> Duplicate
            </button>
            <button
              type="button"
              disabled={locked || deleting}
              onClick={onDelete}
              title="Delete question"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-100 bg-white px-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({
  form,
  editing,
  saving,
  onClose,
  onSubmit,
  onField,
  onOption,
}: {
  form: QuestionForm;
  editing: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onField: <K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) => void;
  onOption: (optionId: OptionId, text: string) => void;
}) {
  const sectionMeta = SECTION_META[form.section];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-editor-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">
              {editing ? "Update question" : "New question · Step 3"}
            </p>
            <h2 id="question-editor-title" className="mt-1 text-lg font-bold">
              {editing ? "Edit MCQ" : "Create MCQ"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">One question · Four options · One correct answer · One mark</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close editor"
            className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {SECTION_ORDER.map((section) => {
              const meta = SECTION_META[section];
              const active = form.section === section;
              return (
                <button
                  key={section}
                  type="button"
                  disabled={editing}
                  onClick={() => onField("section", section)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active ? `${meta.ring} ${meta.soft} ring-2 ring-blue-500/10` : "border-slate-200 bg-white hover:border-slate-300"
                  } disabled:cursor-not-allowed`}
                >
                  <span className={`text-sm font-semibold uppercase ${meta.accent}`}>{meta.title}</span>
                  <span className="mt-1 block text-xs leading-4 text-slate-500">{meta.description}</span>
                </button>
              );
            })}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="question-text" className="text-sm font-semibold text-slate-700">Question text <span className="text-rose-500">*</span></label>
              <span className="text-xs font-semibold text-slate-400">{form.question.length}/10000</span>
            </div>
            <textarea
              id="question-text"
              required
              minLength={5}
              maxLength={10000}
              rows={4}
              value={form.question}
              onChange={(event) => onField("question", event.target.value)}
              placeholder="Write a clear, complete question…"
              className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base leading-6 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Question type</label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-700">
              <FileQuestion className="h-4 w-4" /> Multiple Choice Question
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-700">Answer options <span className="text-rose-500">*</span></p>
                <p className="mt-1 text-xs text-slate-400">Enter all four options, then mark exactly one correct answer.</p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-500">A · B · C · D</span>
            </div>
            <div className="space-y-3">
              {form.options.map((option) => {
                const selected = form.correctOption === option.optionId;
                return (
                  <div
                    key={option.optionId}
                    className={`flex flex-wrap items-center gap-2 rounded-2xl border p-2.5 sm:flex-nowrap ${
                      selected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                      selected ? "bg-emerald-500 text-white" : "bg-white text-slate-500"
                    }`}>{option.optionId}</span>
                    <input
                      required
                      value={option.text}
                      maxLength={1000}
                      onChange={(event) => onOption(option.optionId, event.target.value)}
                      placeholder={`Enter option ${option.optionId}`}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => onField("correctOption", option.optionId)}
                      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                        selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
                      }`}
                    >
                      {selected ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-4 w-4 rounded-full border-2 border-slate-300" />}
                      {selected ? "Correct answer" : "Mark correct"}
                    </button>
                  </div>
                );
              })}
            </div>
            {!form.correctOption && (
              <p className="mt-2 text-xs font-semibold text-amber-700">Select the correct answer before saving.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Save status</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onField("status", "draft")}
                className={`rounded-xl border p-3 text-left ${
                  form.status === "draft" ? "border-amber-300 bg-amber-50 ring-2 ring-amber-500/10" : "border-slate-200 bg-white"
                }`}
              >
                <span className="block text-sm font-semibold text-amber-700">Save as Draft</span>
                <span className="mt-1 block text-xs leading-4 text-slate-500">Save now and activate after review.</span>
              </button>
              <button
                type="button"
                onClick={() => onField("status", "active")}
                className={`rounded-xl border p-3 text-left ${
                  form.status === "active" ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-500/10" : "border-slate-200 bg-white"
                }`}
              >
                <span className="block text-sm font-semibold text-emerald-700">Save as Active</span>
                <span className="mt-1 block text-xs leading-4 text-slate-500">Make this question eligible for assessment selection.</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            This question will be saved under <strong>{sectionMeta.title}</strong>. The server validates the assessment, section limit, four options and correct answer before storing it.
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-xs font-bold text-slate-500">1 mark · 0 negative marks</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Saving…" : editing ? "Update question" : "Save question"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
