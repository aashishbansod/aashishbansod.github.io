import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Clock,
  Trophy,
  Target,
  Brain,
  Rocket,
  CheckCircle,
  BookOpen,
  Star,
  Award,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Code2,
  Sparkles,
  ShieldCheck,
  Send,
  Play,
  List,
  Timer,
  Loader2,
  CircleHelp,
  Flag,
  Search,
  Filter,
} from "lucide-react";

import api, { AssessmentAPI, StudentAPI } from "../../services/api";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const STORAGE_KEY = "cybernet_assessment_session_v1";
const QUESTION_LIMIT_OPTIONS = [10, 20, 30, 50];
const ANSWER_PLACEHOLDER = "SKIPPED";

/*
|--------------------------------------------------------------------------
| IMPORTANT:
|--------------------------------------------------------------------------
| Change this to "text" if your admin stores MCQ correctAnswer as option text
| instead of optionId.
|--------------------------------------------------------------------------
*/

const MCQ_ANSWER_MODE = "optionId";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const safeArray = (value) => (Array.isArray(value) ? value : []);

const getStudentName = (student) => {
  if (!student) return "Student";

  const fullName =
    `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
    student.fullName ||
    "";

  return fullName || student.email || "Student";
};

const getStudentEmail = (student) =>
  student?.email || student?.mobile || "CyberNet Member";

const getQuestionId = (question, index = 0) =>
  String(
    question?._id ||
      question?.id ||
      question?.questionCode ||
      `Q-${index + 1}`
  );

const normalizeQuestion = (question, index = 0) => {
  const rawOptions = safeArray(question?.options);

  const options = rawOptions.map((option, optionIndex) => {
    const fallbackOptionId =
      String.fromCharCode(65 + optionIndex) || `O${optionIndex + 1}`;

    if (typeof option === "string") {
      return {
        optionId: fallbackOptionId,
        text: option,
      };
    }

    return {
      optionId: String(
        option?.optionId || option?.id || fallbackOptionId
      ),
      text: String(option?.text || option?.label || option?.value || ""),
    };
  });

  return {
    _id: getQuestionId(question, index),
    questionCode: question?.questionCode || "",
    questionType: String(question?.questionType || "MCQ").toUpperCase(),
    title: question?.title || "",
    question: question?.question || "",
    domain: question?.domain || "General",
    subDomain: question?.subDomain || "",
    difficulty: question?.difficulty || "Easy",
    options,
    marks: Number(question?.marks || 1),
    negativeMarks: Number(question?.negativeMarks || 0),
    codingLanguage: safeArray(question?.codingLanguage),
    starterCode: question?.starterCode || "",
    sampleInput: question?.sampleInput || "",
    sampleOutput: question?.sampleOutput || "",
    timeLimit: Number(question?.timeLimit || 2),
    memoryLimit: Number(question?.memoryLimit || 256),
  };
};

const deriveDurationSeconds = (questions) => {
  const count = safeArray(questions).length;

  if (count <= 0) return 30 * 60;

  const suggested = count * 90;
  return Math.max(30 * 60, Math.min(90 * 60, suggested));
};

const formatTime = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`;
  }

  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const getPerformanceLabel = (percentage) => {
  const score = Number(percentage || 0);

  if (score >= 95) return "Outstanding";
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Average";
  return "Needs Improvement";
};

const getToneClasses = (tone) => {
  const map = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    cyan: "from-cyan-50 to-cyan-100 text-cyan-700",
    red: "from-red-50 to-red-100 text-red-700",
    slate: "from-slate-50 to-slate-100 text-slate-700",
  };

  return map[tone] || map.blue;
};

const saveDraft = (draft) => {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage errors
  }
};

const readDraft = () => {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const clearDraft = () => {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

const isMeaningfulAnswer = (entry, questionType) => {
  const qType = String(questionType || "MCQ").toUpperCase();

  if (!entry) return false;

  if (qType === "CODING") {
    const code = normalizeText(entry.codeAnswer || entry.selectedAnswer);
    return code !== "" && code.toUpperCase() !== ANSWER_PLACEHOLDER;
  }

  const selected = normalizeText(entry.selectedAnswer);
  return selected !== "" && selected.toUpperCase() !== ANSWER_PLACEHOLDER;
};

const getTopLeaderboardName = (row) =>
  row?.studentName ||
  `${row?.firstName || ""} ${row?.lastName || ""}`.trim() ||
  row?.email ||
  "Student";

function StatCard({ icon: Icon, title, value, hint, tone = "blue" }) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
      <div
        className={[
          "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br",
          getToneClasses(tone),
        ].join(" ")}
      >
        <Icon className="text-xl" />
      </div>

      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-xs font-medium text-slate-500">{hint}</p>
    </div>
  );
}

function StatusBadge({ children, tone = "blue" }) {
  const toneMap = {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-700",
    cyan: "bg-cyan-100 text-cyan-700",
  };

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold",
        toneMap[tone] || toneMap.blue,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| Main Component
|--------------------------------------------------------------------------
*/

function StudentAssessment() {
  const navigate = useNavigate();
  const autoSubmitTriggeredRef = useRef(false);

  const [pageLoading, setPageLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [status, setStatus] = useState("ready"); // ready | exam | submitted
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [profile, setProfile] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [latestResult, setLatestResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [submissionSummary, setSubmissionSummary] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});

  const [startedAt, setStartedAt] = useState(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);

  const [domainFilter, setDomainFilter] = useState("All");
  const [questionTypeFilter, setQuestionTypeFilter] = useState("All");
  const [questionLimit, setQuestionLimit] = useState(30);

  const currentQuestion = questions[currentIndex] || null;

  const currentStudentName = useMemo(
    () => getStudentName(profile),
    [profile]
  );

  const currentStudentEmail = useMemo(
    () => getStudentEmail(profile),
    [profile]
  );

  const visibleResult = submissionSummary || latestResult;

  const estimatedDurationMinutes = useMemo(() => {
    const count = questions.length;
    if (!count) return 30;
    return Math.max(30, Math.min(90, Math.ceil(count * 1.5)));
  }, [questions.length]);

  const availableDomains = useMemo(() => {
    const set = new Set();

    questions.forEach((question) => {
      if (question?.domain) {
        set.add(question.domain);
      }
    });

    return ["All", ...Array.from(set)];
  }, [questions]);

  const mcqCount = useMemo(
    () => questions.filter((item) => item.questionType === "MCQ").length,
    [questions]
  );

  const codingCount = useMemo(
    () => questions.filter((item) => item.questionType === "CODING").length,
    [questions]
  );

  const flaggedCount = useMemo(
    () => Object.values(markedForReview).filter(Boolean).length,
    [markedForReview]
  );

  const answeredCount = useMemo(
    () =>
      questions.filter((question) =>
        isMeaningfulAnswer(answers[question._id], question.questionType)
      ).length,
    [answers, questions]
  );

  const unansweredCount = useMemo(
    () => Math.max(questions.length - answeredCount, 0),
    [answeredCount, questions.length]
  );

  const progressPercent = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const timeProgressPercent = useMemo(() => {
    if (!totalDurationSeconds) return 0;
    const spent = Math.max(totalDurationSeconds - timeLeftSeconds, 0);
    return Math.min(
      100,
      Math.round((spent / totalDurationSeconds) * 100)
    );
  }, [timeLeftSeconds, totalDurationSeconds]);

  const leaderboardPreview = useMemo(
    () => safeArray(leaderboard).slice(0, 5),
    [leaderboard]
  );

  const latestResultPercentage = Number(visibleResult?.percentage || 0);
  const latestResultRank = Number(visibleResult?.rank || 0);
  const latestResultScholarship = Number(
    visibleResult?.scholarshipPercentage || 0
  );
  const latestResultUnlocked = Boolean(
    submissionSummary?.internshipUnlocked ??
      visibleResult?.internshipUnlocked
  );
  const latestResultPassed = Boolean(
    submissionSummary
      ? submissionSummary.assessmentPassed
      : visibleResult?.status === "PASS"
  );
  const latestResultPerformance = getPerformanceLabel(
    latestResultPercentage
  );

  const questionCounts = useMemo(
    () => ({
      total: questions.length,
      mcq: mcqCount,
      coding: codingCount,
      domains: availableDomains.length > 1 ? availableDomains.length - 1 : 0,
      estimatedMinutes: estimatedDurationMinutes,
    }),
    [
      questions.length,
      mcqCount,
      codingCount,
      availableDomains.length,
      estimatedDurationMinutes,
    ]
  );

  const currentAnswer = currentQuestion ? answers[currentQuestion._id] || {} : {};

  const loadSupportData = useCallback(async () => {
    const [profileRes, resultRes, leaderboardRes] =
      await Promise.allSettled([
        StudentAPI.profile(),
        AssessmentAPI.getResult(),
        AssessmentAPI.leaderboard(),
      ]);

    if (profileRes.status === "fulfilled") {
      const student =
        profileRes.value?.data?.student ||
        profileRes.value?.data?.user ||
        profileRes.value?.data?.profile ||
        null;

      setProfile(student);
    }

    if (resultRes.status === "fulfilled") {
      const result = resultRes.value?.data?.result || null;
      setLatestResult(result);
    } else if (
      resultRes.status === "rejected" &&
      resultRes.reason?.response?.status === 404
    ) {
      setLatestResult(null);
    }

    if (leaderboardRes.status === "fulfilled") {
      const list = leaderboardRes.value?.data?.leaderboard;
      setLeaderboard(safeArray(list));
    }
  }, []);

  const loadQuestions = useCallback(
    async ({
      domain = domainFilter,
      questionType = questionTypeFilter,
      limit = questionLimit,
    } = {}) => {
      setLoadingQuestions(true);
      setError("");
      setNotice("");

      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit || 30));

        if (domain && domain !== "All") {
          params.set("domain", domain);
        }

        if (questionType && questionType !== "All") {
          params.set("questionType", questionType);
        }

        const response = await api.get(
          `/assessment/questions?${params.toString()}`
        );

        const nextQuestions = safeArray(response?.data?.questions).map(
          normalizeQuestion
        );

        setQuestions(nextQuestions);
        setAnswers({});
        setMarkedForReview({});
        setCurrentIndex(0);
        setStartedAt(null);
        setTimeLeftSeconds(0);
        setTotalDurationSeconds(deriveDurationSeconds(nextQuestions));
        setStatus("ready");
        setSubmissionSummary(null);
        clearDraft();

        setNotice(
          nextQuestions.length > 0
            ? `Loaded ${nextQuestions.length} assessment question(s) from the server.`
            : "No questions matched the selected filters. Try another domain or a different limit."
        );
      } catch (err) {
        console.error("Assessment question load error:", err);
        setQuestions([]);
        setStatus("ready");
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load assessment questions"
        );
      } finally {
        setLoadingQuestions(false);
      }
    },
    [domainFilter, questionLimit, questionTypeFilter]
  );

  const buildSubmissionAnswers = useCallback(() => {
    return questions.map((question) => {
      const entry = answers[question._id] || {};

      if (question.questionType === "CODING") {
        const codeAnswer = normalizeText(
          entry.codeAnswer || entry.selectedAnswer
        );

        return {
          questionId: question._id,
          selectedAnswer: "",
          codeAnswer: codeAnswer || ANSWER_PLACEHOLDER,
        };
      }

      const selectedAnswer = normalizeText(entry.selectedAnswer);

      return {
        questionId: question._id,
        selectedAnswer: selectedAnswer || ANSWER_PLACEHOLDER,
        codeAnswer: "",
      };
    });
  }, [answers, questions]);

  const restoreDraft = useCallback((draft) => {
    const draftQuestions = safeArray(draft?.questions).map(normalizeQuestion);

    if (!draftQuestions.length) return false;

    const savedTimeLeft = Number(draft?.timeLeftSeconds || 0);
    if (savedTimeLeft <= 0) return false;

    setQuestions(draftQuestions);
    setAnswers(draft?.answers || {});
    setMarkedForReview(draft?.markedForReview || {});
    setCurrentIndex(
      Math.min(
        Number(draft?.currentIndex || 0),
        Math.max(draftQuestions.length - 1, 0)
      )
    );
    setStartedAt(draft?.startedAt || new Date().toISOString());
    setTimeLeftSeconds(savedTimeLeft);
    setTotalDurationSeconds(
      Number(draft?.totalDurationSeconds || deriveDurationSeconds(draftQuestions))
    );
    setDomainFilter(draft?.domainFilter || "All");
    setQuestionTypeFilter(draft?.questionTypeFilter || "All");
    setQuestionLimit(Number(draft?.questionLimit || 30));
    setStatus("exam");
    setSubmissionSummary(null);
    setNotice("Restored your saved assessment session.");
    return true;
  }, []);

  const submitAssessment = useCallback(
    async ({ auto = false } = {}) => {
      if (submitting) return;

      if (!questions.length) {
        setError("No questions available to submit.");
        return;
      }

      const payloadAnswers = buildSubmissionAnswers();
      const meaningfulCount = questions.filter((question) =>
        isMeaningfulAnswer(answers[question._id], question.questionType)
      ).length;

      if (meaningfulCount <= 0) {
        setError("Please answer at least one question before submitting.");
        return;
      }

      if (!auto) {
        const ok = window.confirm(
          `Submit assessment now?\n\n${unansweredCount} unanswered question(s) will be marked as SKIPPED and may score zero.`
        );

        if (!ok) return;
      }

      setSubmitting(true);
      setError("");
      setNotice(
        auto ? "Time is up. Submitting automatically..." : "Submitting assessment..."
      );

      try {
        const response = await AssessmentAPI.submitAssessment({
          answers: payloadAnswers,
          startedAt,
          finishedAt: new Date().toISOString(),
          timeSpentSeconds: totalDurationSeconds
            ? Math.max(totalDurationSeconds - timeLeftSeconds, 0)
            : 0,
        });

        const data = response?.data || {};
        const finalResult = data?.result || null;

        setLatestResult(finalResult);
        setSubmissionSummary({
          resultId: data?.resultId || finalResult?.resultId || "",
          percentage: Number(data?.percentage ?? finalResult?.percentage ?? 0),
          scholarshipPercentage: Number(
            data?.scholarshipPercentage ?? finalResult?.scholarshipPercentage ?? 0
          ),
          internshipUnlocked: Boolean(
            data?.internshipUnlocked ?? finalResult?.internshipUnlocked
          ),
          assessmentPassed: Boolean(
            data?.assessmentPassed ?? data?.internshipUnlocked ?? false
          ),
          certificateEligible: Boolean(
            data?.assessmentPassed ?? data?.internshipUnlocked ?? false
          ),
          leaderboardPoints: Number(data?.leaderboardPoints || 0),
          rank: Number(data?.rank || finalResult?.rank || 0),
          message: data?.message || "Assessment submitted successfully.",
        });

        clearDraft();
        setStatus("submitted");
        setNotice(data?.message || "Assessment submitted successfully.");
        setAnswers({});
        setMarkedForReview({});

        await loadSupportData();
      } catch (err) {
        console.error("Assessment submit error:", err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to submit assessment"
        );
        setNotice("");
      } finally {
        setSubmitting(false);
        autoSubmitTriggeredRef.current = false;
      }
    },
    [
      answers,
      buildSubmissionAnswers,
      loadSupportData,
      questions,
      startedAt,
      submitting,
      timeLeftSeconds,
      totalDurationSeconds,
      unansweredCount,
    ]
  );

  const loadFreshBank = useCallback(async () => {
    if (status === "exam") {
      setError(
        "You cannot reload the question bank while an assessment is running."
      );
      return;
    }

    await loadQuestions({
      domain: domainFilter,
      questionType: questionTypeFilter,
      limit: questionLimit,
    });
  }, [domainFilter, loadQuestions, questionLimit, questionTypeFilter, status]);

  const handleStartAssessment = useCallback(() => {
    if (!questions.length) {
      setError("No questions are loaded. Please load the question bank first.");
      return;
    }

    autoSubmitTriggeredRef.current = false;
    setError("");
    setNotice(
      "Assessment started. Stay focused and answer each question carefully."
    );
    setStatus("exam");
    setStartedAt(new Date().toISOString());
    setTimeLeftSeconds(totalDurationSeconds || deriveDurationSeconds(questions));
    setCurrentIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [questions, totalDurationSeconds]);

  const handleResetSession = useCallback(async () => {
    if (status === "exam") {
      const ok = window.confirm(
        "Reset the current assessment session? Unsaved progress will be cleared."
      );

      if (!ok) return;
    }

    clearDraft();
    autoSubmitTriggeredRef.current = false;

    setAnswers({});
    setMarkedForReview({});
    setCurrentIndex(0);
    setStartedAt(null);
    setTimeLeftSeconds(0);
    setTotalDurationSeconds(deriveDurationSeconds([]));
    setSubmissionSummary(null);
    setLatestResult(null);
    setStatus("ready");
    setError("");
    setNotice("Session reset. Loading a fresh question bank now.");
    setDomainFilter("All");
    setQuestionTypeFilter("All");
    setQuestionLimit(30);

    await loadQuestions({
      domain: "All",
      questionType: "All",
      limit: 30,
    });
  }, [loadQuestions, status]);

  const handleRetake = useCallback(async () => {
    const ok = window.confirm(
      "Start a fresh assessment with a new question bank?"
    );

    if (!ok) return;

    clearDraft();
    autoSubmitTriggeredRef.current = false;
    setSubmissionSummary(null);
    setLatestResult(null);
    setAnswers({});
    setMarkedForReview({});
    setCurrentIndex(0);
    setStartedAt(null);
    setTimeLeftSeconds(0);
    setTotalDurationSeconds(deriveDurationSeconds([]));
    setStatus("ready");
    setError("");
    setNotice("Fresh assessment bank will be loaded now.");

    await loadQuestions({
      domain: domainFilter,
      questionType: questionTypeFilter,
      limit: questionLimit,
    });
  }, [domainFilter, loadQuestions, questionLimit, questionTypeFilter]);

  const handleOptionSelect = useCallback((question, option, optionIndex) => {
    if (!question) return;

    const optionValue =
      MCQ_ANSWER_MODE === "text"
        ? option?.text || option?.optionId || String.fromCharCode(65 + optionIndex)
        : option?.optionId || option?.text || String.fromCharCode(65 + optionIndex);

    setAnswers((prev) => ({
      ...prev,
      [question._id]: {
        ...(prev[question._id] || {}),
        selectedAnswer: String(optionValue),
        codeAnswer: "",
      },
    }));
  }, []);

  const handleCodeChange = useCallback((question, codeValue) => {
    if (!question) return;

    setAnswers((prev) => ({
      ...prev,
      [question._id]: {
        ...(prev[question._id] || {}),
        codeAnswer: codeValue,
        selectedAnswer: "",
      },
    }));
  }, []);

  const handleClearAnswer = useCallback((question) => {
    if (!question) return;

    setAnswers((prev) => ({
      ...prev,
      [question._id]: {
        selectedAnswer: "",
        codeAnswer: "",
      },
    }));
  }, []);

  const toggleReview = useCallback((questionId) => {
    if (!questionId) return;

    setMarkedForReview((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  }, []);

  const jumpToQuestion = useCallback(
    (index) => {
      if (index < 0 || index >= questions.length) return;
      setCurrentIndex(index);
    },
    [questions.length]
  );

  /*
  |--------------------------------------------------------------------------
  | Effects
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setPageLoading(true);

      try {
        await loadSupportData();

        const draft = readDraft();

        if (
          draft?.status === "exam" &&
          safeArray(draft?.questions).length > 0 &&
          Number(draft?.timeLeftSeconds || 0) > 0
        ) {
          const restored = restoreDraft(draft);

          if (!restored) {
            clearDraft();
            await loadQuestions({
              domain: "All",
              questionType: "All",
              limit: 30,
            });
          }
        } else {
          clearDraft();
          await loadQuestions({
            domain: "All",
            questionType: "All",
            limit: 30,
          });
        }
      } catch (err) {
        console.error(err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to initialize assessment portal"
        );
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [loadQuestions, loadSupportData, restoreDraft]);

  useEffect(() => {
    if (status !== "exam" || !questions.length || pageLoading) return;

    saveDraft({
      status,
      questions,
      answers,
      markedForReview,
      currentIndex,
      startedAt,
      timeLeftSeconds,
      totalDurationSeconds,
      domainFilter,
      questionTypeFilter,
      questionLimit,
      savedAt: Date.now(),
    });
  }, [
    answers,
    currentIndex,
    domainFilter,
    markedForReview,
    pageLoading,
    questionLimit,
    questionTypeFilter,
    questions,
    startedAt,
    status,
    timeLeftSeconds,
    totalDurationSeconds,
  ]);

  useEffect(() => {
    if (status !== "exam" || !questions.length) return;

    autoSubmitTriggeredRef.current = false;

    const timerId = window.setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [questions.length, status]);

  useEffect(() => {
    if (
      status === "exam" &&
      questions.length > 0 &&
      timeLeftSeconds === 0 &&
      !submitting &&
      !autoSubmitTriggeredRef.current
    ) {
      autoSubmitTriggeredRef.current = true;
      submitAssessment({ auto: true });
    }
  }, [questions.length, status, submitting, submitAssessment, timeLeftSeconds]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (status === "exam" && !submitting) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status, submitting]);

  /*
  |--------------------------------------------------------------------------
  | Render helpers
  |--------------------------------------------------------------------------
  */

  const renderReadyState = () => (
    <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            <Sparkles size={14} />
            Assessment Hub
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Real-time Skill Evaluation
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Questions are pulled from the CyberNet backend. MCQ and coding
            questions are graded by the server, and the final result updates
            your scholarship, rank, and internship status.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                {availableDomains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={questionTypeFilter}
                onChange={(e) => setQuestionTypeFilter(e.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="All">All Types</option>
                <option value="MCQ">MCQ</option>
                <option value="CODING">CODING</option>
              </select>
            </div>

            <div className="relative">
              <List className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={questionLimit}
                onChange={(e) => setQuestionLimit(Number(e.target.value))}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                {QUESTION_LIMIT_OPTIONS.map((limit) => (
                  <option key={limit} value={limit}>
                    {limit} Questions
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={loadFreshBank}
              disabled={loadingQuestions}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-bold text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingQuestions ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              Load Question Bank
            </button>

            <button
              onClick={handleResetSession}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={18} />
              Reset Session
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
          <div className="rounded-[26px] bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Total Questions</span>
              <BookOpen size={16} />
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {questionCounts.total}
            </div>
          </div>

          <div className="rounded-[26px] bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Estimate</span>
              <Clock size={16} />
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {questionCounts.estimatedMinutes}m
            </div>
          </div>

          <div className="rounded-[26px] bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>MCQ</span>
              <Trophy size={16} />
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {questionCounts.mcq}
            </div>
          </div>

          <div className="rounded-[26px] bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Coding</span>
              <Code2 size={16} />
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900">
              {questionCounts.coding}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Domains
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {questionCounts.domains}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Loaded from backend
          </p>
        </div>

        <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Progress
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            {progressPercent}%
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Answered questions
          </p>
        </div>

        <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Pass / Scholarship
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            Server
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Final result is generated by backend
          </p>
        </div>

        <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Autosave
          </p>
          <p className="mt-2 text-3xl font-black text-slate-900">
            On
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Saves your live session in the browser
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-[30px] bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-cyan-300" size={24} />
          <div>
            <h3 className="text-xl font-black">Assessment Rules</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
              <li>• The timer runs continuously once you start the test.</li>
              <li>• Unanswered questions are submitted as SKIPPED.</li>
              <li>• MCQ and coding questions are both supported.</li>
              <li>• Scholarship, rank, and internship unlock are set by the server.</li>
              <li>• Your session is autosaved in this browser tab.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          {notice ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 font-semibold text-emerald-700">
              <CheckCircle size={16} />
              {notice}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 font-semibold text-slate-600">
              <CircleHelp size={16} />
              Load a bank and start when ready
            </span>
          )}
        </div>

        <button
          onClick={handleStartAssessment}
          disabled={!questions.length || loadingQuestions}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-6 py-4 font-bold text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Play size={18} />
          Start Live Assessment
        </button>
      </div>
    </div>
  );

  const renderCodingQuestion = () => (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
          <Code2 size={16} />
          Starter Code
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-900 p-4 text-sm leading-6 text-slate-100">
          {currentQuestion?.starterCode ||
            "// No starter code provided by the admin."}
        </pre>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Sample Input
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
            {currentQuestion?.sampleInput || "—"}
          </pre>
        </div>

        <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Sample Output
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
            {currentQuestion?.sampleOutput || "—"}
          </pre>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-700">
            Your Answer / Code
          </p>
          <button
            type="button"
            onClick={() => handleClearAnswer(currentQuestion)}
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
          >
            Clear answer
          </button>
        </div>

        <textarea
          value={normalizeText(
            currentAnswer.codeAnswer || currentAnswer.selectedAnswer
          )}
          onChange={(e) => handleCodeChange(currentQuestion, e.target.value)}
          placeholder="Paste your code or final answer here..."
          className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
        />
      </div>
    </div>
  );

  const renderMcqQuestion = () => (
    <div className="space-y-4">
      {safeArray(currentQuestion?.options).length > 0 ? (
        currentQuestion.options.map((option, index) => {
          const optionLabel =
            option?.optionId || String.fromCharCode(65 + index);
          const optionValue =
            MCQ_ANSWER_MODE === "text"
              ? option?.text || optionLabel
              : optionLabel;

          const selected =
            normalizeText(currentAnswer.selectedAnswer) ===
            normalizeText(optionValue);

          return (
            <button
              key={`${currentQuestion?._id}-${optionLabel}-${index}`}
              type="button"
              onClick={() => handleOptionSelect(currentQuestion, option, index)}
              className={[
                "flex w-full items-start gap-4 rounded-[24px] border p-4 text-left transition",
                selected
                  ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-100"
                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black",
                  selected
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700",
                ].join(" ")}
              >
                {optionLabel}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Option
                </p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {option?.text || "—"}
                </p>
              </div>
            </button>
          );
        })
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
          No options provided for this question.
        </div>
      )}
    </div>
  );

  const renderExamState = () => {
    if (!currentQuestion) {
      return (
        <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <Brain className="mx-auto text-slate-400" size={48} />
            <h3 className="mt-4 text-2xl font-black text-slate-900">
              No assessment questions loaded
            </h3>
            <p className="mt-3 text-slate-600">
              Load a question bank before starting the exam.
            </p>
            <button
              onClick={loadFreshBank}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-bold text-white shadow-lg"
            >
              <RefreshCw size={18} />
              Load Question Bank
            </button>
          </div>
        </div>
      );
    }

    const questionTypeTone =
      currentQuestion.questionType === "CODING" ? "purple" : "blue";

    return (
      <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="blue">
                <BookOpen size={14} />
                Question {currentIndex + 1} of {questions.length}
              </StatusBadge>

              <StatusBadge tone={questionTypeTone}>
                {currentQuestion.questionType}
              </StatusBadge>

              <StatusBadge tone="amber">
                {currentQuestion.difficulty}
              </StatusBadge>

              <StatusBadge tone="emerald">
                {currentQuestion.domain}
              </StatusBadge>
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
              {currentQuestion.question}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
                <Trophy size={14} />
                {currentQuestion.marks} mark(s)
              </span>

              {currentQuestion.questionType === "MCQ" && (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
                  <List size={14} />
                  Choose one option
                </span>
              )}

              {currentQuestion.questionType === "CODING" && (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
                  <Code2 size={14} />
                  Paste your code or final answer
                </span>
              )}
            </div>
          </div>

          <div className="min-w-[220px] rounded-[28px] bg-gradient-to-r from-blue-600 to-cyan-500 p-5 text-white shadow-lg">
            <div className="flex items-center justify-between text-sm text-blue-100">
              <span>Time Left</span>
              <Clock size={16} />
            </div>
            <div className="mt-3 text-4xl font-black">
              {formatTime(timeLeftSeconds)}
            </div>
            <p className="mt-2 text-xs text-blue-100">
              Timer starts when the live assessment begins
            </p>
          </div>
        </div>

        <div className="mt-6 h-3 rounded-full bg-slate-100">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-500"
            style={{
              width: `${Math.min(
                100,
                Math.max(timeProgressPercent, progressPercent)
              )}%`,
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Answered: {answeredCount}</span>
          <span>Flagged: {flaggedCount}</span>
          <span>Remaining: {unansweredCount}</span>
        </div>

        <div className="mt-8">
          {currentQuestion.questionType === "CODING"
            ? renderCodingQuestion()
            : renderMcqQuestion()}
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => jumpToQuestion(currentIndex - 1)}
              disabled={currentIndex <= 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={18} />
              Previous
            </button>

            <button
              type="button"
              onClick={() => toggleReview(currentQuestion._id)}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              <Flag size={18} />
              {markedForReview[currentQuestion._id]
                ? "Remove Review"
                : "Mark for Review"}
            </button>

            <button
              type="button"
              onClick={() => handleClearAnswer(currentQuestion)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={18} />
              Clear Answer
            </button>

            <button
              type="button"
              onClick={() => jumpToQuestion(currentIndex + 1)}
              disabled={currentIndex >= questions.length - 1}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="text-sm text-slate-500">
            Autosave is on while the exam is running.
          </div>
        </div>
      </div>
    );
  };

  const renderResultState = () => {
    const source = submissionSummary || visibleResult || {};
    const percentage = Number(source?.percentage || 0);
    const scholarship = Number(source?.scholarshipPercentage || 0);
    const rank = Number(source?.rank || 0);
    const passed = Boolean(
      source?.assessmentPassed ?? source?.status === "PASS"
    );
    const unlocked = Boolean(source?.internshipUnlocked);
    const resultId = source?.resultId || visibleResult?.resultId || "—";
    const performance = getPerformanceLabel(percentage);

    return (
      <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              <CheckCircle size={14} />
              Assessment Result
            </div>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
              {passed ? "Assessment Passed" : "Assessment Submitted"}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              Your backend result is now available. Scholarship, rank,
              certificate eligibility, and internship unlock status are pulled
              from the server response.
            </p>
          </div>

          <div
            className={[
              "rounded-[28px] p-5 shadow-lg",
              passed
                ? "bg-gradient-to-r from-emerald-600 to-cyan-500 text-white"
                : "bg-gradient-to-r from-slate-900 to-slate-700 text-white",
            ].join(" ")}
          >
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
              Result ID
            </div>
            <div className="mt-2 text-xl font-black">{resultId}</div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Target}
            title="Score"
            value={`${percentage}%`}
            hint={performance}
            tone={percentage >= 90 ? "emerald" : percentage >= 70 ? "blue" : "amber"}
          />

          <StatCard
            icon={Award}
            title="Scholarship"
            value={`${scholarship}%`}
            hint="Server-generated discount"
            tone={scholarship >= 50 ? "emerald" : scholarship >= 20 ? "blue" : "amber"}
          />

          <StatCard
            icon={Trophy}
            title="Rank"
            value={rank ? `#${rank}` : "—"}
            hint="Leaderboard position"
            tone="purple"
          />

          <StatCard
            icon={CheckCircle}
            title="Internship"
            value={unlocked ? "Unlocked" : "Locked"}
            hint={unlocked ? "Apply for internships now" : "Complete eligibility first"}
            tone={unlocked ? "emerald" : "red"}
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">
                Submission Breakdown
              </h3>
              <CircleHelp className="text-slate-400" size={18} />
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Total Questions</span>
                <span className="font-semibold">
                  {visibleResult?.totalQuestions || questions.length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Attempted</span>
                <span className="font-semibold">
                  {visibleResult?.attemptedQuestions || answeredCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Correct</span>
                <span className="font-semibold">
                  {visibleResult?.correctAnswers || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Wrong</span>
                <span className="font-semibold">
                  {visibleResult?.wrongAnswers || 0}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="font-bold text-slate-900">
                  Certificate Eligible
                </span>
                <span className="font-black text-slate-900">
                  {Boolean(source?.certificateEligible) ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-900 p-5 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Next Step</h3>
              <Rocket size={20} />
            </div>

            <p className="mt-3 text-sm leading-6 text-blue-100">
              {unlocked
                ? "Your internship module is unlocked. Go to internships and apply for the live programs created by the admin."
                : "Your result is saved. Improve your score to unlock internships, scholarship benefits, and certificate access."}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/student/dashboard")}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 font-bold text-blue-700 transition hover:scale-[1.01]"
              >
                Dashboard
              </button>

              <button
                onClick={() => navigate("/student/leaderboard")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition hover:bg-white/15"
              >
                Leaderboard
              </button>

              <button
                onClick={() => navigate("/student/internships")}
                disabled={!unlocked}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Internships
              </button>

              <button
                onClick={handleRetake}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition hover:bg-white/15"
              >
                Retake
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-slate-100 bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">
              Performance Overview
            </h3>
            <Star className="text-amber-500" size={20} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Level
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {performance}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Unlock
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {unlocked ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Scholarship
              </p>
              <p className="mt-2 text-xl font-black text-slate-900">
                {scholarship}%
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderExamSidebar = () => (
    <div className="space-y-6">
      <div className="rounded-[32px] bg-white p-6 shadow-lg shadow-slate-200/60">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900">Timer</h3>
          <Timer className="text-blue-600" size={20} />
        </div>

        <div className="mt-4 rounded-[26px] bg-gradient-to-r from-blue-700 to-cyan-500 p-5 text-white">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
            Time Remaining
          </div>
          <div className="mt-2 text-4xl font-black">
            {formatTime(timeLeftSeconds)}
          </div>
          <p className="mt-2 text-xs text-blue-100">
            The assessment submits automatically when time reaches zero.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Answered
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {answeredCount}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Flagged
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {flaggedCount}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Left
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {unansweredCount}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] bg-white p-6 shadow-lg shadow-slate-200/60">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900">
            Question Navigator
          </h3>
          <List className="text-slate-500" size={18} />
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2">
          {questions.map((question, index) => {
            const answerEntry = answers[question._id];
            const answered = isMeaningfulAnswer(
              answerEntry,
              question.questionType
            );
            const flagged = Boolean(markedForReview[question._id]);
            const current = index === currentIndex;

            return (
              <button
                key={question._id}
                type="button"
                onClick={() => jumpToQuestion(index)}
                className={[
                  "flex h-11 items-center justify-center rounded-2xl text-sm font-black transition",
                  current
                    ? "bg-blue-600 text-white shadow-lg"
                    : flagged
                    ? "bg-amber-500 text-white"
                    : answered
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                ].join(" ")}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <CircleHelp size={16} />
            Exam Controls
          </div>
          <ul className="mt-3 space-y-2 leading-6">
            <li>• Use Next / Previous to move through questions.</li>
            <li>• Mark important questions for review.</li>
            <li>• Autosave keeps your live session in browser storage.</li>
            <li>• Submit manually before time ends to avoid auto submit.</li>
          </ul>
        </div>

        <button
          onClick={() => submitAssessment({ auto: false })}
          disabled={submitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-4 font-bold text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Submitting...
            </>
          ) : (
            <>
              <Send size={18} />
              Submit Assessment
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderInsightsSidebar = () => (
    <div className="space-y-6">
      <div className="rounded-[32px] bg-white p-6 shadow-lg shadow-slate-200/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              Student Profile
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Live account snapshot
            </p>
          </div>
          <Brain className="text-blue-600" size={20} />
        </div>

        <div className="mt-5 rounded-[26px] bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Name
          </div>
          <div className="mt-2 text-lg font-black text-slate-900">
            {currentStudentName}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {currentStudentEmail}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Score
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {Number(profile?.assessmentScore || 0)}%
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Scholarship
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {Number(profile?.scholarshipPercentage || 0)}%
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] bg-white p-6 shadow-lg shadow-slate-200/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              Latest Result
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Most recent assessment summary
            </p>
          </div>
          <Award className="text-amber-500" size={20} />
        </div>

        {visibleResult ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-[26px] bg-gradient-to-r from-blue-700 to-cyan-500 p-5 text-white">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">
                Score
              </div>
              <div className="mt-2 text-4xl font-black">
                {latestResultPercentage}%
              </div>
              <div className="mt-2 text-sm text-blue-100">
                {latestResultPerformance}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Rank
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {latestResultRank ? `#${latestResultRank}` : "—"}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Scholarship
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {latestResultScholarship}%
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={latestResultPassed ? "emerald" : "red"}>
                {latestResultPassed ? "PASS" : "FAIL"}
              </StatusBadge>

              <StatusBadge tone={latestResultUnlocked ? "emerald" : "amber"}>
                {latestResultUnlocked ? "Internship Unlocked" : "Locked"}
              </StatusBadge>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            No result available yet. Complete an assessment to see your
            scholarship, rank, and internship status here.
          </div>
        )}
      </div>

      <div className="rounded-[32px] bg-white p-6 shadow-lg shadow-slate-200/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              Leaderboard
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Top performers in the portal
            </p>
          </div>
          <Trophy className="text-amber-500" size={20} />
        </div>

        <div className="mt-5 space-y-3">
          {leaderboardPreview.length > 0 ? (
            leaderboardPreview.map((row, index) => (
              <div
                key={row?.studentId || row?._id || index}
                className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    #{row?.rank || index + 1} {getTopLeaderboardName(row)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Scholarship {Number(row?.scholarshipPercentage || 0)}%
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-black text-slate-900">
                    {Number(row?.points || row?.leaderboardPoints || 0)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {Number(row?.assessmentScore || row?.percentage || 0)}%
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              No leaderboard records yet.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[32px] bg-gradient-to-r from-slate-900 to-blue-900 p-6 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-cyan-300" size={22} />
          <div>
            <h3 className="text-lg font-black">Quick Tips</h3>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-200">
              <li>• Start only when you are ready to finish the full set.</li>
              <li>• Coding answers can be pasted as final code or solution text.</li>
              <li>• Use the review flag for tricky questions.</li>
              <li>• Submit before time ends to keep full control.</li>
            </ul>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate("/student/leaderboard")}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 font-bold text-slate-700 transition hover:bg-slate-50"
      >
        Open Leaderboard
      </button>
    </div>
  );

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin text-blue-600" size={44} />
          <h2 className="mt-4 text-2xl font-black text-slate-900">
            Loading Assessment Center
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Fetching your profile, question bank, result history, and leaderboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-4 text-slate-900 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <section className="rounded-[36px] bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <StatusBadge tone="slate">
                <Sparkles size={14} />
                CyberNet Assessment Center
              </StatusBadge>

              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                Live Skill Evaluation Portal
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                This page connects directly to the backend assessment engine.
                The server returns questions, stores results, calculates
                scholarship, updates leaderboard points, and unlocks internship
                access when the assessment is completed.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/student/dashboard")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-blue-700 shadow-lg shadow-black/10 transition hover:scale-[1.02]"
                >
                  Dashboard
                </button>

                <button
                  onClick={() => navigate("/student/internships")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Internships
                </button>

                <button
                  onClick={() => navigate("/student/leaderboard")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Leaderboard
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Student</span>
                  <Brain size={16} />
                </div>
                <div className="mt-3 text-2xl font-black">{currentStudentName}</div>
                <div className="mt-1 text-sm text-slate-200">
                  {currentStudentEmail}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Session</span>
                  <Timer size={16} />
                </div>
                <div className="mt-3 text-2xl font-black">
                  {status === "exam"
                    ? "Running"
                    : status === "submitted"
                    ? "Completed"
                    : "Ready"}
                </div>
                <div className="mt-1 text-sm text-slate-200">
                  Auto-save is enabled
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Loaded</span>
                  <BookOpen size={16} />
                </div>
                <div className="mt-3 text-2xl font-black">{questions.length}</div>
                <div className="mt-1 text-sm text-slate-200">
                  Question bank from backend
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Duration</span>
                  <Clock size={16} />
                </div>
                <div className="mt-3 text-2xl font-black">
                  {estimatedDurationMinutes}m
                </div>
                <div className="mt-1 text-sm text-slate-200">
                  Dynamic exam timer
                </div>
              </div>
            </div>
          </div>
        </section>

        {(error || notice) && (
          <div
            className={[
              "mt-6 rounded-2xl border p-4",
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              {error ? (
                <AlertCircle className="mt-0.5" size={20} />
              ) : (
                <CheckCircle className="mt-0.5" size={20} />
              )}
              <div className="flex-1">
                <p className="font-bold">{error ? "Action failed" : "Status"}</p>
                <p className="mt-1 text-sm">{error || notice}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={BookOpen}
            title="Questions"
            value={questions.length}
            hint="Loaded from server"
            tone="blue"
          />
          <StatCard
            icon={CheckCircle}
            title="Answered"
            value={answeredCount}
            hint="Autosaved progress"
            tone="emerald"
          />
          <StatCard
            icon={Flag}
            title="Flagged"
            value={flaggedCount}
            hint="Marked for review"
            tone="amber"
          />
          <StatCard
            icon={Clock}
            title="Time Left"
            value={formatTime(timeLeftSeconds)}
            hint="Timer updates live"
            tone="purple"
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div className="space-y-6">
            {status === "submitted"
              ? renderResultState()
              : status === "exam"
              ? renderExamState()
              : renderReadyState()}
          </div>

          <div>{status === "exam" ? renderExamSidebar() : renderInsightsSidebar()}</div>
        </div>

        <footer className="py-10 text-center text-sm text-slate-500">
          <h3 className="font-bold text-slate-700">
            CyberNet Technology Systems
          </h3>
          <p className="mt-1">
            Assessment • Scholarship • Internship Unlock • Leaderboard
          </p>
          <p className="mt-1">© {new Date().getFullYear()} All Rights Reserved</p>
        </footer>
      </div>
    </div>
  );
}

export default StudentAssessment;