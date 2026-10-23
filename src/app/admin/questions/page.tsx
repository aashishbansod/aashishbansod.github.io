"use client";

/**
 * CyberNet Careers — Admin Question Bank
 * Full page replacement.
 * Uses the existing /api/admin/assessments and /api/admin/questions endpoints.
 * API/server validation remains authoritative for data integrity and assessment locking.
 */

import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Download,
  FileQuestion,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Admin Question Bank
 * ------------------------------------------------------------
 * Production rules:
 * - Live API only. No mock/demo data.
 * - 30 MCQs + 2 coding questions.
 * - MCQ = 2 marks, Coding = 20 marks, total = 100.
 * - Published/archived assessments are read-only.
 * - Backend remains authoritative for limits, validation and locking.
 */

type QuestionType = "mcq" | "coding";
type OptionId = "A" | "B" | "C" | "D";
type Difficulty = "easy" | "medium" | "hard";
type AssessmentStatus = "draft" | "published" | "archived" | string;
type QuestionStatus = "draft" | "active" | "inactive" | "published" | "archived" | string;
type ProgrammingLanguage =
  | "Java"
  | "Python"
  | "JavaScript"
  | "TypeScript"
  | "SQL";

type Assessment = {
  _id: string;
  assessmentId?: string;
  title: string;
  domain?: string;
  status?: AssessmentStatus;
};

type MCQOption = {
  id: OptionId;
  text: string;
};

type TestCase = {
  input?: string;
  expectedOutput?: string;
  output?: string;
  explanation?: string;
};

type Question = {
  _id: string;
  questionId?: string;
  assessmentId: string;
  type: QuestionType;
  question: string;
  description?: string;
  options?: MCQOption[];
  correctOption?: string;
  correctAnswer?: string;
  language?: string;
  languages?: string[];
  starterCode?: string;
  codeTemplate?: string;
  solutionTemplate?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  testCases?: TestCase[];
  examples?: TestCase[] | string;
  difficulty?: Difficulty | string;
  explanation?: string;
  marks?: number;
  order?: number;
  status?: QuestionStatus;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type QuestionForm = {
  type: QuestionType;
  question: string;
  description: string;
  options: MCQOption[];
  correctOption: OptionId | "";
  language: ProgrammingLanguage;
  starterCode: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  examples: string;
  difficulty: Difficulty;
  explanation: string;
  isActive: boolean;
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

const API_URL = "/api/admin/questions";
const ASSESSMENTS_API_URL = "/api/admin/assessments";

const MCQ_TOTAL = 30;
const CODING_TOTAL = 2;
const MCQ_MARKS = 2;
const CODING_MARKS = 20;
const TOTAL_MARKS = 100;
const REFRESH_MS = 30_000;

const PROGRAMMING_LANGUAGES: ProgrammingLanguage[] = [
  "Java",
  "Python",
  "JavaScript",
  "TypeScript",
  "SQL",
];

function isLocked(assessment?: Assessment): boolean {
  const status = assessment?.status?.toLowerCase();
  return status === "published" || status === "archived";
}

function createDefaultOptions(): MCQOption[] {
  return [
    { id: "A", text: "" },
    { id: "B", text: "" },
    { id: "C", text: "" },
    { id: "D", text: "" },
  ];
}

function starterCodeFor(language: ProgrammingLanguage): string {
  switch (language) {
    case "Java":
      return `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your solution here
    }
}`;
    case "Python":
      return `def main():
    # Write your solution here
    pass

if __name__ == "__main__":
    main()`;
    case "JavaScript":
      return `function main() {
    // Write your solution here
}

main();`;
    case "TypeScript":
      return `function main(): void {
    // Write your solution here
}

main();`;
    case "SQL":
      return `-- Write your SQL query here

SELECT *
FROM table_name;`;
  }
}

function emptyForm(type: QuestionType = "mcq"): QuestionForm {
  return {
    type,
    question: "",
    description: "",
    options: createDefaultOptions(),
    correctOption: "",
    language: "Java",
    starterCode: starterCodeFor("Java"),
    inputFormat: "",
    outputFormat: "",
    constraints: "",
    examples: "",
    difficulty: "medium",
    explanation: "",
    isActive: true,
  };
}

function normalizeLanguage(value: unknown): ProgrammingLanguage {
  return PROGRAMMING_LANGUAGES.includes(value as ProgrammingLanguage)
    ? (value as ProgrammingLanguage)
    : "Java";
}

function normalizeOption(value: unknown, index: number): MCQOption {
  const fallback = String.fromCharCode(65 + index) as OptionId;

  if (!value || typeof value !== "object") {
    return {
      id: fallback,
      text: typeof value === "string" ? value : "",
    };
  }

  const item = value as Record<string, unknown>;
  const rawId =
    typeof item.id === "string"
      ? item.id
      : typeof item.optionId === "string"
        ? item.optionId
        : fallback;

  const id: OptionId =
    rawId === "A" || rawId === "B" || rawId === "C" || rawId === "D"
      ? rawId
      : fallback;

  return {
    id,
    text: typeof item.text === "string" ? item.text : "",
  };
}

function normalizeQuestion(value: unknown): Question | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;

  const id = item._id ?? item.id;
  if (typeof id !== "string") return null;

  const rawType =
    item.type === "coding" || item.type === "code" ? "coding" : "mcq";

  const rawOptions = Array.isArray(item.options) ? item.options : [];
  const options = rawOptions
    .slice(0, 4)
    .map((option, index) => normalizeOption(option, index));

  const rawLanguages = Array.isArray(item.languages)
    ? item.languages.filter((x): x is string => typeof x === "string")
    : undefined;

  const rawExamples = Array.isArray(item.testCases)
    ? item.testCases
    : Array.isArray(item.examples)
      ? item.examples
      : [];
  const rawTestCases = rawExamples
    .filter(
      (x): x is Record<string, unknown> =>
        Boolean(x) && typeof x === "object",
    )
    .map((x) => ({
      input: typeof x.input === "string" ? x.input : "",
      expectedOutput:
        typeof x.expectedOutput === "string"
          ? x.expectedOutput
          : typeof x.output === "string"
            ? x.output
            : "",
      explanation:
        typeof x.explanation === "string" ? x.explanation : "",
    }));

  return {
    _id: id,
    questionId:
      typeof item.questionId === "string" ? item.questionId : undefined,
    assessmentId:
      typeof item.assessmentId === "string" ? item.assessmentId : "",
    type: rawType,
    question:
      typeof item.question === "string"
        ? item.question
        : typeof item.text === "string"
          ? item.text
          : "",
    description:
      typeof item.description === "string" ? item.description : undefined,
    options,
    correctOption:
      typeof item.correctOption === "string"
        ? item.correctOption
        : typeof item.correctAnswer === "string"
          ? item.correctAnswer
          : undefined,
    correctAnswer:
      typeof item.correctAnswer === "string" ? item.correctAnswer : undefined,
    language:
      typeof item.language === "string"
        ? item.language
        : rawLanguages?.[0],
    languages: rawLanguages,
    starterCode:
      typeof item.starterCode === "string"
        ? item.starterCode
        : typeof item.codeTemplate === "string"
          ? item.codeTemplate
          : typeof item.solutionTemplate === "string"
            ? item.solutionTemplate
            : undefined,
    codeTemplate:
      typeof item.codeTemplate === "string" ? item.codeTemplate : undefined,
    solutionTemplate:
      typeof item.solutionTemplate === "string"
        ? item.solutionTemplate
        : undefined,
    inputFormat:
      typeof item.inputFormat === "string" ? item.inputFormat : undefined,
    outputFormat:
      typeof item.outputFormat === "string" ? item.outputFormat : undefined,
    constraints:
      typeof item.constraints === "string" ? item.constraints : undefined,
    testCases: rawTestCases,
    examples: rawTestCases.length > 0
      ? rawTestCases
      : typeof item.examples === "string"
        ? item.examples
        : [],
    difficulty:
      item.difficulty === "easy" ||
      item.difficulty === "hard" ||
      item.difficulty === "medium"
        ? item.difficulty
        : "medium",
    explanation:
      typeof item.explanation === "string" ? item.explanation : undefined,
    marks:
      typeof item.marks === "number"
        ? item.marks
        : rawType === "coding"
          ? CODING_MARKS
          : MCQ_MARKS,
    order: typeof item.order === "number" ? item.order : undefined,
    status: (() => {
      const raw = typeof item.status === "string" ? item.status.toLowerCase() : "";
      if (raw === "published") return "active";
      if (raw === "archived") return "inactive";
      if (raw === "active" || raw === "inactive" || raw === "draft") return raw;
      return item.isActive === true ? "active" : "draft";
    })(),
    isActive: typeof item.isActive === "boolean"
      ? item.isActive
      : item.status === "active" || item.status === "published",
    createdAt:
      typeof item.createdAt === "string" ? item.createdAt : undefined,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  };
}

function extractArray(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const root = payload as Record<string, unknown>;

  if (Array.isArray(root[key])) return root[key];
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.results)) return root.results;

  if (root.data && typeof root.data === "object") {
    const data = root.data as Record<string, unknown>;
    if (Array.isArray(data[key])) return data[key];
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
  }

  return [];
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const root = payload as Record<string, unknown>;

  if (typeof root.message === "string") return root.message;
  if (typeof root.error === "string") return root.error;

  if (root.error && typeof root.error === "object") {
    const error = root.error as Record<string, unknown>;
    if (typeof error.message === "string") return error.message;
  }

  return fallback;
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

function validCorrectOption(value: unknown): value is OptionId {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function formatExamplesForForm(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => {
      const input = typeof item.input === "string" ? item.input : "";
      const output = typeof item.output === "string"
        ? item.output
        : typeof item.expectedOutput === "string"
          ? item.expectedOutput
          : "";
      const explanation = typeof item.explanation === "string" ? item.explanation : "";
      return `Example ${index + 1}:\nInput: ${input}\nOutput: ${output}${explanation ? `\nExplanation: ${explanation}` : ""}`;
    })
    .join("\n\n");
}

function questionIsComplete(question: Question): boolean {
  if (question.type === "mcq") {
    return (
      question.options?.length === 4 &&
      question.options.every((option) => option.text.trim().length > 0) &&
      validCorrectOption(question.correctOption ?? question.correctAnswer) &&
      question.marks === MCQ_MARKS
    );
  }

  return Boolean(
    question.question.trim() &&
      question.starterCode?.trim() &&
      question.language &&
      question.marks === CODING_MARKS &&
      ((Array.isArray(question.testCases) && question.testCases.length > 0) ||
        (Array.isArray(question.examples) && question.examples.length > 0)),
  );
}

export default function AdminQuestionsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");

  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | QuestionStatus>(
    "all",
  );
  const [filterDifficulty, setFilterDifficulty] = useState<
    "all" | Difficulty
  >("all");

  const [notice, setNotice] = useState<Notice | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [form, setForm] = useState<QuestionForm>(emptyForm());

  const assessmentsRequest = useRef(0);
  const questionsRequest = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedAssessment = useMemo(
    () =>
      assessments.find(
        (assessment) => assessment._id === selectedAssessmentId,
      ),
    [assessments, selectedAssessmentId],
  );

  const locked = isLocked(selectedAssessment);

  const mcqQuestions = useMemo(
    () => questions.filter((question) => question.type === "mcq"),
    [questions],
  );

  const codingQuestions = useMemo(
    () => questions.filter((question) => question.type === "coding"),
    [questions],
  );

  const activeMCQCount = useMemo(
    () => mcqQuestions.filter((question) => question.status === "active" && question.isActive !== false).length,
    [mcqQuestions],
  );

  const activeCodingCount = useMemo(
    () =>
      codingQuestions.filter((question) => question.status === "active" && question.isActive !== false).length,
    [codingQuestions],
  );

  const totalMarks = useMemo(
    () => activeMCQCount * MCQ_MARKS + activeCodingCount * CODING_MARKS,
    [activeMCQCount, activeCodingCount],
  );

  const completeMCQCount = useMemo(
    () =>
      mcqQuestions.filter(
        (question) => question.status === "active" && question.isActive !== false && questionIsComplete(question),
      ).length,
    [mcqQuestions],
  );

  const completeCodingCount = useMemo(
    () =>
      codingQuestions.filter(
        (question) => question.status === "active" && question.isActive !== false && questionIsComplete(question),
      ).length,
    [codingQuestions],
  );

  const assessmentReady =
    activeMCQCount === MCQ_TOTAL &&
    activeCodingCount === CODING_TOTAL &&
    completeMCQCount === MCQ_TOTAL &&
    completeCodingCount === CODING_TOTAL &&
    totalMarks === TOTAL_MARKS;

  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...questions]
      .filter((question) => {
        if (filterStatus !== "all" && question.status !== filterStatus)
          return false;
        if (
          filterDifficulty !== "all" &&
          question.difficulty !== filterDifficulty
        )
          return false;

        if (!query) return true;

        return (
          question.question.toLowerCase().includes(query) ||
          Boolean(question.questionId?.toLowerCase().includes(query)) ||
          Boolean(question.language?.toLowerCase().includes(query))
        );
      })
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER),
      );
  }, [questions, search, filterStatus, filterDifficulty]);

  // Keep MCQs and coding problems in separate visual sections.
  const filteredMCQQuestions = useMemo(
    () => filteredQuestions.filter((question) => question.type === "mcq"),
    [filteredQuestions],
  );
  const filteredCodingQuestions = useMemo(
    () => filteredQuestions.filter((question) => question.type === "coding"),
    [filteredQuestions],
  );

  const setSuccess = useCallback((message: string) => {
    setNotice({ type: "success", message });
  }, []);

  const setError = useCallback((message: string) => {
    setNotice({ type: "error", message });
  }, []);

  const fetchAssessments = useCallback(async () => {
    const requestId = ++assessmentsRequest.current;
    setLoadingAssessments(true);

    try {
      const response = await fetch(
        `${ASSESSMENTS_API_URL}?limit=100&page=1`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          errorMessage(payload, "Unable to load assessments."),
        );
      }

      const rows = extractArray(payload, "assessments");
      const normalized = rows
        .map((item): Assessment | null => {
          if (!item || typeof item !== "object") return null;
          const value = item as Record<string, unknown>;
          const id = value._id ?? value.id;
          if (typeof id !== "string") return null;

          return {
            _id: id,
            assessmentId:
              typeof value.assessmentId === "string"
                ? value.assessmentId
                : undefined,
            title:
              typeof value.title === "string"
                ? value.title
                : "Untitled Assessment",
            domain:
              typeof value.domain === "string" ? value.domain : undefined,
            status:
              typeof value.status === "string" ? value.status : "draft",
          };
        })
        .filter((item): item is Assessment => item !== null);

      if (requestId !== assessmentsRequest.current) return;

      setAssessments(normalized);

      if (normalized.length === 0) {
        setSelectedAssessmentId("");
        return;
      }

      setSelectedAssessmentId((current) => {
        if (normalized.some((item) => item._id === current)) return current;

        const queryId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("assessmentId")
            : null;

        const queryMatch = normalized.find(
          (item) => item._id === queryId || item.assessmentId === queryId,
        );

        return queryMatch?._id ?? normalized[0]._id;
      });
    } catch (error) {
      if (requestId !== assessmentsRequest.current) return;
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load assessments.",
      );
    } finally {
      if (requestId === assessmentsRequest.current) {
        setLoadingAssessments(false);
      }
    }
  }, [setError]);

  const fetchQuestions = useCallback(
    async (assessmentId: string, silent = false) => {
      const requestId = ++questionsRequest.current;

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
          limit: "100",
          page: "1",
          sortField: "order",
          sortDirection: "asc",
        });

        const response = await fetch(`${API_URL}?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            errorMessage(payload, `Unable to load questions (HTTP ${response.status}).`),
          );
        }

        const normalized = extractArray(payload, "questions")
          .map(normalizeQuestion)
          .filter((item): item is Question => item !== null)
          .filter(
            (question) =>
              !question.assessmentId ||
              question.assessmentId === assessmentId,
          );

        if (requestId !== questionsRequest.current) return;

        setQuestions(normalized);
      } catch (error) {
        if (requestId !== questionsRequest.current) return;
        if (!silent) {
          setQuestions([]);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load questions.",
          );
        }
      } finally {
        if (requestId === questionsRequest.current && !silent) {
          setLoadingQuestions(false);
        }
      }
    },
    [setError],
  );

  useEffect(() => {
    void fetchAssessments();
  }, [fetchAssessments]);

  useEffect(() => {
    void fetchQuestions(selectedAssessmentId);
  }, [selectedAssessmentId, fetchQuestions]);

  useEffect(() => {
    if (!selectedAssessmentId) return;

    const timer = window.setInterval(() => {
      void fetchQuestions(selectedAssessmentId, true);
    }, REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [selectedAssessmentId, fetchQuestions]);

  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        selectedAssessmentId
      ) {
        void fetchQuestions(selectedAssessmentId, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [selectedAssessmentId, fetchQuestions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !showModal) {
        const target = event.target as HTMLElement | null;
        if (
          target?.tagName !== "INPUT" &&
          target?.tagName !== "TEXTAREA" &&
          target?.tagName !== "SELECT"
        ) {
          event.preventDefault();
          searchInputRef.current?.focus();
        }
      }

      if (event.key === "Escape" && showModal && !saving) {
        setShowModal(false);
        setEditingQuestion(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal, saving]);

  const updateForm = useCallback(
    <K extends keyof QuestionForm,>(key: K, value: QuestionForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updateOption = useCallback((index: number, text: string) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, text } : option,
      ),
    }));
  }, []);

  const updateLanguage = useCallback((language: ProgrammingLanguage) => {
    setForm((current) => ({
      ...current,
      language,
      starterCode: starterCodeFor(language),
    }));
  }, []);

  const openCreate = useCallback(
    (type: QuestionType) => {
      if (!selectedAssessmentId) {
        setError("Select an assessment before adding a question.");
        return;
      }

      if (locked) {
        setError("Published or archived assessments are locked.");
        return;
      }

      if (
        type === "mcq" &&
        mcqQuestions.length >= MCQ_TOTAL
      ) {
        setError("The assessment already has the maximum 30 MCQs.");
        return;
      }

      if (
        type === "coding" &&
        codingQuestions.length >= CODING_TOTAL
      ) {
        setError("The assessment already has the maximum 2 coding questions.");
        return;
      }

      setNotice(null);
      setEditingQuestion(null);
      setForm(emptyForm(type));
      setShowModal(true);
    },
    [
      selectedAssessmentId,
      locked,
      mcqQuestions.length,
      codingQuestions.length,
      setError,
    ],
  );

  const openEdit = useCallback(
    (question: Question) => {
      if (locked) {
        setError("Published or archived assessments cannot be edited.");
        return;
      }

      const language = normalizeLanguage(
        question.language ?? question.languages?.[0],
      );

      const options =
        question.options?.length === 4
          ? question.options.map((option, index) =>
              normalizeOption(option, index),
            )
          : createDefaultOptions();

      const correct = question.correctOption ?? question.correctAnswer ?? "";

      setEditingQuestion(question);
      setForm({
        type: question.type,
        question: question.question,
        description: question.description ?? "",
        options,
        correctOption: validCorrectOption(correct) ? correct : "",
        language,
        starterCode:
          question.starterCode ??
          question.codeTemplate ??
          question.solutionTemplate ??
          starterCodeFor(language),
        inputFormat: question.inputFormat ?? "",
        outputFormat: question.outputFormat ?? "",
        constraints: question.constraints ?? "",
        examples: formatExamplesForForm(question.examples ?? question.testCases),
        difficulty:
          question.difficulty === "easy" || question.difficulty === "hard"
            ? question.difficulty
            : "medium",
        explanation: question.explanation ?? "",
        isActive: question.isActive !== false,
      });
      setNotice(null);
      setShowModal(true);
    },
    [locked, setError],
  );

  const openDuplicate = useCallback(
    (question: Question) => {
      if (locked) {
        setError("Published or archived assessments cannot be changed.");
        return;
      }

      if (
        question.type === "mcq" &&
        mcqQuestions.length >= MCQ_TOTAL
      ) {
        setError("Cannot duplicate: the MCQ limit of 30 is reached.");
        return;
      }

      if (
        question.type === "coding" &&
        codingQuestions.length >= CODING_TOTAL
      ) {
        setError("Cannot duplicate: the coding limit of 2 is reached.");
        return;
      }

      const language = normalizeLanguage(
        question.language ?? question.languages?.[0],
      );

      setEditingQuestion(null);
      setForm({
        type: question.type,
        question: `${question.question} (Copy)`,
        description: question.description ?? "",
        options:
          question.options?.length === 4
            ? question.options.map((option, index) =>
                normalizeOption(option, index),
              )
            : createDefaultOptions(),
        correctOption: validCorrectOption(
          question.correctOption ?? question.correctAnswer,
        )
          ? (question.correctOption ??
              question.correctAnswer) as OptionId
          : "",
        language,
        starterCode:
          question.starterCode ??
          question.codeTemplate ??
          question.solutionTemplate ??
          starterCodeFor(language),
        inputFormat: question.inputFormat ?? "",
        outputFormat: question.outputFormat ?? "",
        constraints: question.constraints ?? "",
        examples: formatExamplesForForm(question.examples ?? question.testCases),
        difficulty:
          question.difficulty === "easy" || question.difficulty === "hard"
            ? question.difficulty
            : "medium",
        explanation: question.explanation ?? "",
        isActive: question.isActive !== false,
      });
      setNotice(null);
      setShowModal(true);
    },
    [
      locked,
      mcqQuestions.length,
      codingQuestions.length,
      setError,
    ],
  );

  const validateForm = useCallback((): string | null => {
    if (!selectedAssessmentId) return "Select an assessment first.";

    if (form.question.trim().length < 5) {
      return "Question/problem must contain at least 5 characters.";
    }

    if (form.type === "mcq") {
      if (form.options.length !== 4) {
        return "MCQ must contain exactly 4 options.";
      }

      if (form.options.some((option) => option.text.trim().length === 0)) {
        return "Fill all four MCQ options.";
      }

      const duplicateOptions = new Set(
        form.options.map((option) => option.text.trim().toLowerCase()),
      );
      if (duplicateOptions.size !== 4) {
        return "MCQ options must be unique.";
      }

      if (!validCorrectOption(form.correctOption)) {
        return "Select the correct MCQ answer.";
      }

      return null;
    }

    if (!PROGRAMMING_LANGUAGES.includes(form.language)) {
      return "Select a valid programming language.";
    }

    if (!form.inputFormat.trim()) {
      return "Enter the input format for this coding problem.";
    }

    if (!form.outputFormat.trim()) {
      return "Enter the output format for this coding problem.";
    }

    if (!form.starterCode.trim()) {
      return "Add sample/starter code for this coding problem.";
    }

    if (!form.examples.trim()) {
      return "Add at least one example containing both Input: and Output:.";
    }

    return null;
  }, [selectedAssessmentId, form]);

  const buildPayload = useCallback(() => {
    if (form.type === "mcq") {
      return {
        assessmentId: selectedAssessmentId,
        type: "mcq",
        question: form.question.trim(),
        description: "",
        options: form.options.map((option) => ({
          id: option.id,
          optionId: option.id,
          text: option.text.trim(),
        })),
        correctOption: form.correctOption,
        correctAnswer: form.correctOption,
        explanation: "",
        difficulty: form.difficulty,
        marks: MCQ_MARKS,
        isActive: false,
        status: "draft",
      };
    }

    return {
      assessmentId: selectedAssessmentId,
      type: "coding",
      question: form.question.trim(),
      description: "",
      language: form.language,
      languages: [form.language],
      starterCode: form.starterCode,
      codeTemplate: form.starterCode,
      solutionTemplate: form.starterCode,
      // Preserve the controlled form values. Sending empty literals here was
      // the cause of HTTP 400 responses even when the admin filled the fields.
      inputFormat: form.inputFormat.trim(),
      outputFormat: form.outputFormat.trim(),
      constraints: form.constraints.trim(),
      // The API accepts the form's labelled text and normalizes it into
      // structured examples. Example format: Input: ...\nOutput: ...
      examples: form.examples.trim(),
      testCases: form.examples.trim(),
      explanation: "",
      difficulty: form.difficulty,
      marks: CODING_MARKS,
      isActive: false,
      status: "draft",
    };
  }, [form, selectedAssessmentId]);

  const saveQuestion = useCallback(async () => {
    setNotice(null);

    if (locked) {
      setError("Published or archived assessments are locked.");
      return;
    }

    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }

    if (!editingQuestion) {
      if (
        form.type === "mcq" &&
        mcqQuestions.length >= MCQ_TOTAL
      ) {
        setError("MCQ limit reached. Maximum is 30.");
        return;
      }

      if (
        form.type === "coding" &&
        codingQuestions.length >= CODING_TOTAL
      ) {
        setError("Coding limit reached. Maximum is 2.");
        return;
      }
    }

    setSaving(true);

    try {
      const endpoint = editingQuestion
        ? `${API_URL}?id=${encodeURIComponent(editingQuestion._id)}`
        : API_URL;

      const response = await fetch(endpoint, {
        method: editingQuestion ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          errorMessage(
            payload,
            editingQuestion
              ? `Unable to update question (HTTP ${response.status}).`
              : `Unable to create question (HTTP ${response.status}).`,
          ),
        );
      }

      setShowModal(false);
      setEditingQuestion(null);
      setForm(emptyForm());
      setSuccess(
        editingQuestion
          ? "Question updated successfully."
          : "Question added successfully.",
      );
      await fetchQuestions(selectedAssessmentId);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save question.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    locked,
    validateForm,
    editingQuestion,
    form.type,
    mcqQuestions.length,
    codingQuestions.length,
    buildPayload,
    selectedAssessmentId,
    fetchQuestions,
    setError,
    setSuccess,
  ]);

  const updateQuestionStatus = useCallback(
    async (question: Question, nextStatus: "draft" | "active" | "inactive") => {
      if (locked) {
        setError("Published or archived assessments are locked.");
        return;
      }
      if (question.status === nextStatus) return;
      if (nextStatus === "active" && !questionIsComplete(question)) {
        setError("This question is incomplete. Edit it and complete all required fields before activating it.");
        return;
      }
      const confirmed = nextStatus === "inactive"
        ? window.confirm("Deactivate this question? It will not be offered in new assessments.")
        : true;
      if (!confirmed) return;

      setNotice(null);
      setSaving(true);
      try {
        const response = await fetch(`${API_URL}?id=${encodeURIComponent(question._id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            status: nextStatus,
            isActive: nextStatus === "active",
            assessmentId: question.assessmentId,
          }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(errorMessage(payload, `Unable to update question status (HTTP ${response.status}).`));
        }
        setSuccess(`Question status updated to ${nextStatus}.`);
        await fetchQuestions(selectedAssessmentId);
      } catch (error) {
        setError(error instanceof Error
          ? error.message
          : "Unable to update question status. Ensure the questions API supports PATCH.");
      } finally {
        setSaving(false);
      }
    },
    [locked, selectedAssessmentId, fetchQuestions, setError, setSuccess],
  );

  const deleteQuestion = useCallback(
    async (question: Question) => {
      if (locked) {
        setError("Published or archived assessments are locked.");
        return;
      }

      const confirmed = window.confirm(
        `Delete ${question.type === "mcq" ? "this MCQ" : "this coding question"}?\n\nThis permanently removes the question.`,
      );

      if (!confirmed) return;

      setDeletingId(question._id);
      setNotice(null);

      try {
        const response = await fetch(
          `${API_URL}?id=${encodeURIComponent(question._id)}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            errorMessage(payload, `Unable to delete question (HTTP ${response.status}).`),
          );
        }

        setSuccess("Question deleted successfully.");
        await fetchQuestions(selectedAssessmentId);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to delete question.",
        );
      } finally {
        setDeletingId("");
      }
    },
    [locked, selectedAssessmentId, fetchQuestions, setError, setSuccess],
  );

  const exportVisibleQuestions = useCallback(() => {
    if (filteredQuestions.length === 0) {
      setError("There are no questions to export.");
      return;
    }

    const data = filteredQuestions.map((question) => ({
      questionId: question.questionId ?? question._id,
      assessmentId: question.assessmentId,
      type: question.type,
      question: question.question,
      options: question.options ?? [],
      correctOption: question.correctOption ?? question.correctAnswer ?? null,
      language: question.language ?? null,
      inputFormat: question.inputFormat ?? null,
      outputFormat: question.outputFormat ?? null,
      constraints: question.constraints ?? null,
      examples: question.examples ?? null,
      difficulty: question.difficulty ?? "medium",
      marks: question.marks ?? null,
      status: question.status ?? "draft",
      isActive: question.status === "active" && question.isActive !== false,
      order: question.order ?? null,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `question-bank-${selectedAssessment?.assessmentId ?? selectedAssessmentId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [
    filteredQuestions,
    selectedAssessment?.assessmentId,
    selectedAssessmentId,
    setError,
  ]);

  const closeModal = useCallback(() => {
    if (saving) return;
    setShowModal(false);
    setEditingQuestion(null);
    setForm(emptyForm());
  }, [saving]);

  const changeAssessment = useCallback(
    (value: string) => {
      setSelectedAssessmentId(value);
      setSearch("");
      setFilterStatus("all");
      setFilterDifficulty("all");
      setNotice(null);
    },
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto w-full max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
              <BookOpen className="h-3.5 w-3.5" />
              Live Assessment Question Bank
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Manage Questions
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Build and maintain the production assessment structure with 30
              MCQs and 2 coding problems.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void fetchAssessments()}
              disabled={loadingAssessments}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={loadingAssessments ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportVisibleQuestions}
              disabled={!filteredQuestions.length}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
          </div>
        </header>

        {notice && (
          <div
            role="status"
            className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : notice.type === "info"
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <p className="flex-1 text-sm font-semibold">{notice.message}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-lg p-1 hover:bg-black/5"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Select Assessment
              </p>

              {loadingAssessments ? (
                <div className="flex h-12 items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading assessments...
                </div>
              ) : assessments.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  No assessments are available. Create an assessment first.
                </div>
              ) : (
                <div className="relative max-w-2xl">
                  <select
                    value={selectedAssessmentId}
                    onChange={(event) => changeAssessment(event.target.value)}
                    className="h-12 w-full min-w-0 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:text-base"
                  >
                    {assessments.map((assessment) => (
                      <option key={assessment._id} value={assessment._id}>
                        {assessment.title}
                        {assessment.domain ? ` — ${assessment.domain}` : ""}
                        {assessment.status
                          ? ` · ${assessment.status.toUpperCase()}`
                          : ""}
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
                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700">
                      {selectedAssessment.domain}
                    </span>
                  )}
                  <span
                    className={`rounded-lg px-2.5 py-1 font-black uppercase ${
                      selectedAssessment.status === "published"
                        ? "bg-emerald-50 text-emerald-700"
                        : selectedAssessment.status === "archived"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {selectedAssessment.status ?? "draft"}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="MCQ"
                value={`${activeMCQCount}/${MCQ_TOTAL}`}
                tone={activeMCQCount === MCQ_TOTAL ? "green" : "blue"}
              />
              <Stat
                label="Coding"
                value={`${activeCodingCount}/${CODING_TOTAL}`}
                tone={activeCodingCount === CODING_TOTAL ? "green" : "purple"}
              />
              <Stat
                label="Marks"
                value={`${totalMarks}/${TOTAL_MARKS}`}
                tone={totalMarks === TOTAL_MARKS ? "green" : "amber"}
              />
              <Stat
                label="Readiness"
                value={assessmentReady ? "Ready" : "Draft"}
                tone={assessmentReady ? "green" : "amber"}
              />
            </div>
          </div>
        </section>

        <section
          className={`mb-5 rounded-2xl border p-4 ${
            assessmentReady
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {assessmentReady ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0">
              <p
                className={`text-sm font-black ${
                  assessmentReady ? "text-emerald-900" : "text-amber-900"
                }`}
              >
                {assessmentReady
                  ? "Assessment question structure is complete."
                  : "Assessment question structure is incomplete."}
              </p>
              <p
                className={`mt-1 text-xs leading-5 ${
                  assessmentReady ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {assessmentReady
                  ? "30 active MCQs + 2 active coding problems = 100 marks, with coding test cases configured."
                  : `Active questions: ${activeMCQCount} MCQs + ${activeCodingCount} coding. Required: 30 MCQs + 2 coding. Coding questions also need grading test cases before automatic scoring can be enabled.`}
              </p>
            </div>
          </div>
        </section>

        {locked && (
          <section className="mb-5 rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
              <div>
                <p className="text-sm font-black text-slate-900">
                  Question bank is locked
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  This assessment is {selectedAssessment?.status}. Published
                  and archived assessments are protected by the backend and
                  cannot have their questions changed here.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search questions, IDs or language…"
                aria-label="Search questions"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 sm:block">
                /
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 xl:w-[260px]">
              <FilterSelect
                value={filterDifficulty}
                onChange={(value) =>
                  setFilterDifficulty(value as "all" | Difficulty)
                }
                options={[
                  ["all", "All Difficulty"],
                  ["easy", "Easy"],
                  ["medium", "Medium"],
                  ["hard", "Hard"],
                ]}
              />
              <FilterSelect
                value={filterStatus}
                onChange={(value) =>
                  setFilterStatus(value as "all" | QuestionStatus)
                }
                options={[
                  ["all", "All Status"],
                  ["draft", "Draft"],
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={
                  !selectedAssessmentId ||
                  locked ||
                  mcqQuestions.length >= MCQ_TOTAL
                }
                onClick={() => openCreate("mcq")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add MCQ
              </button>
              <button
                type="button"
                disabled={
                  !selectedAssessmentId ||
                  locked ||
                  codingQuestions.length >= CODING_TOTAL
                }
                onClick={() => openCreate("coding")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Code2 className="h-4 w-4" />
                Add Coding
              </button>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <QuestionSection
            title="MCQ Questions"
            subtitle="Multiple-choice questions only"
            type="mcq"
            questions={filteredMCQQuestions}
            total={mcqQuestions.length}
            activeCount={activeMCQCount}
            requiredCount={MCQ_TOTAL}
            loading={loadingQuestions}
            selectedAssessmentId={selectedAssessmentId}
            locked={locked}
            deletingId={deletingId}
            onAdd={() => openCreate("mcq")}
            onEdit={openEdit}
            onDuplicate={openDuplicate}
            onDelete={(question) => void deleteQuestion(question)}
            onStatusChange={(question, status) => void updateQuestionStatus(question, status)}
            updatingStatus={saving}
          />

          <QuestionSection
            title="Coding Problems"
            subtitle="Programming problems, input/output format and starter code"
            type="coding"
            questions={filteredCodingQuestions}
            total={codingQuestions.length}
            activeCount={activeCodingCount}
            requiredCount={CODING_TOTAL}
            loading={loadingQuestions}
            selectedAssessmentId={selectedAssessmentId}
            locked={locked}
            deletingId={deletingId}
            onAdd={() => openCreate("coding")}
            onEdit={openEdit}
            onDuplicate={openDuplicate}
            onDelete={(question) => void deleteQuestion(question)}
            onStatusChange={(question, status) => void updateQuestionStatus(question, status)}
            updatingStatus={saving}
          />
        </div>
      </div>

      {showModal && (
        <QuestionModal
          form={form}
          editing={Boolean(editingQuestion)}
          saving={saving}
          onClose={closeModal}
          onSave={() => void saveQuestion()}
          updateForm={updateForm}
          updateOption={updateOption}
          updateLanguage={updateLanguage}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "purple" | "amber";
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    purple: "border-purple-100 bg-purple-50 text-purple-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  };

  return (
    <div className={`min-w-[86px] rounded-xl border px-3 py-2 ${styles[tone]}`}>
      <p className="text-[9px] font-black uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-black">{value}</p>
    </div>
  );
}

function QuestionSection({
  title,
  subtitle,
  type,
  questions,
  total,
  activeCount,
  requiredCount,
  loading,
  selectedAssessmentId,
  locked,
  deletingId,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  onStatusChange,
  updatingStatus,
}: {
  title: string;
  subtitle: string;
  type: QuestionType;
  questions: Question[];
  total: number;
  activeCount: number;
  requiredCount: number;
  loading: boolean;
  selectedAssessmentId: string;
  locked: boolean;
  deletingId: string;
  onAdd: () => void;
  onEdit: (question: Question) => void;
  onDuplicate: (question: Question) => void;
  onDelete: (question: Question) => void;
  onStatusChange: (question: Question, status: "draft" | "active" | "inactive") => void;
  updatingStatus: boolean;
}) {
  const isMCQ = type === "mcq";
  const Icon = isMCQ ? FileQuestion : Code2;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isMCQ ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {activeCount}/{requiredCount} active · {total} total · {isMCQ ? "2 marks each" : "20 marks each"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!selectedAssessmentId || locked || total >= requiredCount}
          className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${isMCQ ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-950 hover:bg-slate-800"}`}
        >
          <Plus className="h-4 w-4" />
          {isMCQ ? "Add MCQ" : "Add Coding Problem"}
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : !selectedAssessmentId ? (
        <EmptyState title="Select an assessment" description="Select an assessment above to load this section." />
      ) : questions.length === 0 ? (
        <EmptyState
          title={total > 0 ? "No questions match the current filters" : `No ${isMCQ ? "MCQ questions" : "coding problems"} yet`}
          description={total > 0 ? "Clear or adjust the search and filters to see questions." : `Add your first ${isMCQ ? "multiple-choice question" : "coding problem"} to this assessment.`}
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {questions.map((question, index) => (
            <QuestionRow
              key={question._id}
              question={question}
              displayIndex={index + 1}
              locked={locked}
              deleting={deletingId === question._id}
              onEdit={() => onEdit(question)}
              onDuplicate={() => onDuplicate(question)}
              onDelete={() => onDelete(question)}
              onStatusChange={(status) => onStatusChange(question, status)}
              updatingStatus={updatingStatus}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-bold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      <Filter className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        Loading live question bank…
      </div>
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
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <FileQuestion className="h-7 w-7" />
      </div>
      <h3 className="text-base font-black">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function QuestionRow({
  question,
  displayIndex,
  locked,
  deleting,
  onEdit,
  onDuplicate,
  onDelete,
  onStatusChange,
  updatingStatus,
}: {
  question: Question;
  displayIndex: number;
  locked: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStatusChange: (status: "draft" | "active" | "inactive") => void;
  updatingStatus: boolean;
}) {
  const isMCQ = question.type === "mcq";
  const correct = question.correctOption ?? question.correctAnswer;
  const active = question.status === "active" && question.isActive !== false;
  const status = question.status === "published" ? "active" : question.status === "archived" ? "inactive" : (question.status ?? (active ? "active" : "draft"));
  const complete = questionIsComplete(question);

  return (
    <article className="group px-4 py-4 transition hover:bg-slate-50 sm:px-5">
      <div className="flex gap-3 sm:gap-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
            isMCQ
              ? "bg-blue-50 text-blue-700"
              : "bg-purple-50 text-purple-700"
          }`}
        >
          {question.order ?? displayIndex}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={isMCQ ? "blue" : "purple"}>
              {isMCQ ? "MCQ" : "Coding"}
            </Badge>
            <Badge tone="green">{isMCQ ? "2 marks" : "20 marks"}</Badge>
            <Badge
              tone={
                question.difficulty === "hard"
                  ? "red"
                  : question.difficulty === "easy"
                    ? "green"
                    : "amber"
              }
            >
              {question.difficulty ?? "medium"}
            </Badge>
            <Badge tone={status === "active" ? "green" : status === "inactive" ? "slate" : "amber"}>
              {status}
            </Badge>
            {question.questionId && (
              <span className="font-mono text-[10px] text-slate-400">
                {question.questionId}
              </span>
            )}
          </div>

          <h3 className="line-clamp-3 text-sm font-bold leading-6 text-slate-900">
            {question.question}
          </h3>

          {isMCQ ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(question.options ?? []).map((option) => {
                const isCorrect = option.id === correct;
                return (
                  <div
                    key={option.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                      isCorrect
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-100 bg-slate-50 text-slate-600"
                    }`}
                  >
                    <span className="font-black">{option.id}</span>
                    <span className="min-w-0 flex-1 break-words">
                      {option.text || "Empty option"}
                    </span>
                    {isCorrect && (
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="slate">{question.language ?? "Code"}</Badge>
              <Badge tone={question.inputFormat ? "green" : "red"}>
                {question.inputFormat ? "Input ready" : "Input missing"}
              </Badge>
              <Badge tone={question.outputFormat ? "green" : "red"}>
                {question.outputFormat ? "Output ready" : "Output missing"}
              </Badge>
              <Badge tone={question.starterCode ? "green" : "red"}>
                {question.starterCode ? "Starter ready" : "Starter missing"}
              </Badge>
            </div>
          )}

          {!complete && (
            <p className="mt-2 text-[11px] font-bold text-amber-600">
              This question is incomplete for production assessment readiness.
            </p>
          )}

          {question.updatedAt && (
            <p className="mt-2 text-[10px] text-slate-400">
              Updated {formatDate(question.updatedAt)}
            </p>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 pt-3 sm:w-auto sm:justify-end sm:pt-0">
          <button type="button" disabled={locked || updatingStatus || status === "active"} onClick={() => onStatusChange("active")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">
            {updatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Active
          </button>
          <button type="button" disabled={locked || updatingStatus || status === "draft"} onClick={() => onStatusChange("draft")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40">
            <Pencil className="h-3.5 w-3.5" /> Draft
          </button>
          <button type="button" disabled={locked || updatingStatus || status === "inactive"} onClick={() => onStatusChange("inactive")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40">
            <X className="h-3.5 w-3.5" /> Inactive
          </button>
          <IconButton
            label="Edit question"
            disabled={locked}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Duplicate question"
            disabled={locked}
            onClick={onDuplicate}
          >
            <Copy className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Delete question"
            disabled={locked || deleting}
            onClick={onDelete}
            danger
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "blue" | "purple" | "green" | "amber" | "red" | "slate";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black capitalize ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-slate-500 hover:bg-red-50 hover:text-red-600"
          : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
      }`}
    >
      {children}
    </button>
  );
}

function QuestionModal({
  form,
  editing,
  saving,
  onClose,
  onSave,
  updateForm,
  updateOption,
  updateLanguage,
}: {
  form: QuestionForm;
  editing: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  updateForm: <K extends keyof QuestionForm>(
    key: K,
    value: QuestionForm[K],
  ) => void;
  updateOption: (index: number, text: string) => void;
  updateLanguage: (language: ProgrammingLanguage) => void;
}) {
  const isMCQ = form.type === "mcq";

  const switchType = (type: QuestionType) => {
    if (type === form.type) return;
    updateForm("type", type);
    if (type === "mcq") {
      updateForm("options", createDefaultOptions());
      updateForm("correctOption", "");
    } else {
      updateForm("language", "Java");
      updateForm("starterCode", starterCodeFor("Java"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Edit question" : "Create question"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isMCQ
                  ? "bg-blue-50 text-blue-600"
                  : "bg-purple-50 text-purple-600"
              }`}
            >
              {isMCQ ? (
                <FileQuestion className="h-5 w-5" />
              ) : (
                <Code2 className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">
                {editing ? "Edit Question" : "New Question"}
              </p>
              <h2 className="text-lg font-black">
                {isMCQ ? "Multiple Choice Question" : "Coding Problem"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close question editor"
            className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-6 grid grid-cols-2 gap-3">
            <TypeCard
              active={isMCQ}
              icon={<FileQuestion className="h-5 w-5" />}
              title="Multiple Choice"
              description="4 options · 2 marks"
              onClick={() => switchType("mcq")}
            />
            <TypeCard
              active={!isMCQ}
              icon={<Code2 className="h-5 w-5" />}
              title="Coding Problem"
              description="Starter code · 20 marks"
              onClick={() => switchType("coding")}
            />
          </div>

          {isMCQ ? (
            <MCQForm
              form={form}
              updateForm={updateForm}
              updateOption={updateOption}
            />
          ) : (
            <CodingForm
              form={form}
              updateForm={updateForm}
              updateLanguage={updateLanguage}
            />
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-500">
            {isMCQ ? "MCQ · 2 Marks" : "Coding · 20 Marks"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {editing ? "Update Question" : "Add Question"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MCQForm({
  form,
  updateForm,
  updateOption,
}: {
  form: QuestionForm;
  updateForm: <K extends keyof QuestionForm>(
    key: K,
    value: QuestionForm[K],
  ) => void;
  updateOption: (index: number, text: string) => void;
}) {
  return (
    <div>
      <FieldLabel required>Question</FieldLabel>
      <textarea
        value={form.question}
        onChange={(event) => updateForm("question", event.target.value)}
        rows={5}
        maxLength={2000}
        placeholder="Enter the MCQ question…"
        className="mb-6 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
      />

      <div className="mb-2 flex items-center justify-between">
        <FieldLabel required>Answer Options</FieldLabel>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Select correct answer
        </span>
      </div>

      <div className="space-y-3">
        {form.options.map((option, index) => {
          const selected = form.correctOption === option.id;

          return (
            <div
              key={option.id}
              className={`flex flex-wrap items-center gap-2 rounded-2xl border p-2.5 transition sm:flex-nowrap sm:gap-3 ${
                selected
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                  selected
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-slate-500"
                }`}
              >
                {option.id}
              </div>

              <input
                value={option.text}
                onChange={(event) => updateOption(index, event.target.value)}
                maxLength={1000}
                placeholder={`Enter option ${option.id}`}
                className="h-11 min-w-0 w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-auto"
              />

              <button
                type="button"
                onClick={() => updateForm("correctOption", option.id)}
                aria-label={`Mark option ${option.id} as correct`}
                className={`flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
                  selected
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-white bg-white text-emerald-500"
                      : "border-slate-300"
                  }`}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="hidden sm:inline">
                  {selected ? "Correct" : "Mark Correct"}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div
        className={`mt-4 flex items-center gap-3 rounded-2xl border p-4 ${
          form.correctOption
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        {form.correctOption ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div>
          <p
            className={`text-sm font-black ${
              form.correctOption ? "text-emerald-900" : "text-amber-900"
            }`}
          >
            {form.correctOption
              ? `Option ${form.correctOption} is marked correct`
              : "Select the correct answer"}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              form.correctOption ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            The assessment system uses this value for MCQ scoring.
          </p>
        </div>
      </div>

    </div>
  );
}

function CodingForm({
  form,
  updateForm,
  updateLanguage,
}: {
  form: QuestionForm;
  updateForm: <K extends keyof QuestionForm>(
    key: K,
    value: QuestionForm[K],
  ) => void;
  updateLanguage: (language: ProgrammingLanguage) => void;
}) {
  return (
    <div>
      <FieldLabel required>Problem Statement</FieldLabel>
      <textarea
        value={form.question}
        onChange={(event) => updateForm("question", event.target.value)}
        rows={7}
        maxLength={10000}
        placeholder="Write the coding problem here…"
        className="mb-6 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div>
          <FieldLabel required>Input Format</FieldLabel>
          <textarea
            value={form.inputFormat}
            onChange={(event) =>
              updateForm("inputFormat", event.target.value)
            }
            rows={5}
            maxLength={5000}
            placeholder="Describe the exact input format…"
            className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </div>

        <div>
          <FieldLabel required>Output Format</FieldLabel>
          <textarea
            value={form.outputFormat}
            onChange={(event) =>
              updateForm("outputFormat", event.target.value)
            }
            rows={5}
            maxLength={5000}
            placeholder="Describe the expected output format…"
            className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </div>

      <div className="mb-6">
        <FieldLabel>Constraints</FieldLabel>
        <textarea
          value={form.constraints}
          onChange={(event) =>
            updateForm("constraints", event.target.value)
          }
          rows={4}
          maxLength={5000}
          placeholder="Example: 1 ≤ n ≤ 100000…"
          className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
        />
      </div>

      <div className="mb-6">
        <FieldLabel>Examples</FieldLabel>
        <textarea
          value={form.examples}
          onChange={(event) => updateForm("examples", event.target.value)}
          rows={6}
          maxLength={10000}
          placeholder={`Example 1
Input: 5
Output: 120
Explanation: ...`}
          className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs leading-6 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel required>Programming Language</FieldLabel>
          <div className="relative">
            <select
              value={form.language}
              onChange={(event) =>
                updateLanguage(
                  event.target.value as ProgrammingLanguage,
                )
              }
              className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            >
              {PROGRAMMING_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Select the language students will use for this coding problem.
          </p>
        </div>

        <div>
          <FieldLabel>Fixed Marks</FieldLabel>
          <div className="flex h-12 items-center rounded-xl border border-purple-200 bg-purple-50 px-4 text-sm font-black text-purple-700">
            20 Marks
          </div>
        </div>
      </div>

      <FieldLabel required>Basic / Starter Code</FieldLabel>
      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-300">
              Starter Code
            </span>
          </div>
          <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400">
            {form.language}
          </span>
        </div>
        <textarea
          value={form.starterCode}
          onChange={(event) =>
            updateForm("starterCode", event.target.value)
          }
          rows={16}
          maxLength={30000}
          spellCheck={false}
          placeholder="Enter the basic code students will start with…"
          className="w-full resize-y bg-slate-950 px-4 py-4 font-mono text-xs leading-6 text-slate-100 outline-none placeholder:text-slate-600"
        />
      </div>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-black text-blue-900">
              Coding assessment
            </p>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              Students receive the problem, input/output specification and
              starter code. The assessment backend handles submission and
              evaluation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
        active
          ? "border-blue-300 bg-blue-50 ring-2 ring-blue-500/10"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          active
            ? "bg-blue-600 text-white"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {active && (
        <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-blue-600" />
      )}
    </button>
  );
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-xs font-black text-slate-700">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}
