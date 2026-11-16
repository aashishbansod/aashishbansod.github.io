"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileQuestion,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  XCircle,
  Camera,
  Mic,
  Maximize2,
  AlertTriangle,
  Monitor,
} from "lucide-react";

const CONFIG = Object.freeze({
  questionCount: 90,
  easyCount: 30,
  mediumCount: 30,
  hardCount: 30,
  totalMarks: 90,
  passingMarks: 36,
  passingPercentage: 40,
  durationMinutes: 90,
  maxAnswerLength: 10,
});

type Screen = "loading" | "instructions" | "assessment" | "submitting" | "result" | "error";

type Difficulty = "easy" | "medium" | "hard";

type Option = {
  id: string;
  text: string;
};

type Question = {
  id: string;
  question: string;
  options: Option[];
  difficulty: Difficulty;
  order: number;
};

type AnswerMap = Record<string, string>;

type AssessmentInfo = {
  id: string;
  title: string;
  domain: string;
  questionCount: number;
  totalMarks: number;
  durationMinutes: number;
  passingPercentage: number;
};

type Attempt = {
  attemptId: string;
  status: string;
  questions: Question[];
  answers: AnswerMap;
  deadline: string;
  startedAt: string;
};

type AssessmentResult = {
  status: string;
  score: number | null;
  percentage: number | null;
  passed: boolean;
  message: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: string | { message?: string; code?: string };
  data?: Record<string, unknown>;
  attempt?: unknown;
  assessment?: unknown;
  student?: unknown;
  result?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeDifficulty(value: unknown): Difficulty {
  const difficulty = asString(value).toLowerCase();

  if (difficulty === "medium") return "medium";
  if (difficulty === "hard") return "hard";

  return "easy";
}

function normalizeOptions(value: unknown): Option[] {
  return asArray(value)
    .slice(0, 4)
    .map((item, index) => {
      const raw = asRecord(item);
      const fallbackId = String.fromCharCode(65 + index);

      if (typeof item === "string") {
        return {
          id: fallbackId,
          text: item.trim(),
        };
      }

      return {
        id: asString(raw.optionId ?? raw.id ?? raw.key, fallbackId).toUpperCase(),
        text: asString(raw.text ?? raw.label ?? raw.value ?? raw.option),
      };
    })
    .filter((option) => option.text.length > 0);
}

function normalizeQuestion(value: unknown, index: number): Question {
  const raw = asRecord(value);

  return {
    id: asString(
      raw.questionId ?? raw.id ?? raw._id,
      `question-${index + 1}`,
    ),
    question: asString(
      raw.question ?? raw.questionText ?? raw.text,
      `Question ${index + 1}`,
    ),
    options: normalizeOptions(raw.options ?? raw.choices),
    difficulty: normalizeDifficulty(raw.difficulty ?? raw.section),
    order: asNumber(raw.order, index + 1),
  };
}

function normalizeAnswers(value: unknown): AnswerMap {
  const result: AnswerMap = {};

  if (Array.isArray(value)) {
    for (const item of value) {
      const answer = asRecord(item);
      const questionId = asString(answer.questionId);
      const selected = asString(answer.answer ?? answer.selectedOption);

      if (questionId && selected) {
        result[questionId] = selected;
      }
    }

    return result;
  }

  const raw = asRecord(value);

  for (const [questionId, answer] of Object.entries(raw)) {
    const selected = asString(answer);

    if (questionId && selected) {
      result[questionId] = selected;
    }
  }

  return result;
}

function extractStudentDomain(studentValue: unknown): string {
  const student = asRecord(studentValue);
  const internship = asRecord(
    student.assignedInternship ??
      student.internship ??
      student.internshipDetails ??
      student.internshipTrack,
  );
  const application = asRecord(student.application);
  const candidates = [
    student.domain,
    student.domainName,
    student.domainTitle,
    student.domainKey,
    student.assignedDomain,
    student.internshipDomain,
    student.selectedDomain,
    student.internshipTrackName,
    internship.domain,
    internship.domainName,
    internship.title,
    internship.name,
    internship.track,
    application.domain,
    application.domainName,
    application.selectedDomain,
  ];

  for (const candidate of candidates) {
    const value = asString(candidate);
    if (value && !["assigned domain", "not assigned", "unknown"].includes(value.toLowerCase())) {
      return value;
    }
  }

  return "";
}

function normalizeAssessment(value: unknown, fallbackDomain = ""): AssessmentInfo {
  const raw = asRecord(value);
  const internship = asRecord(
    raw.internship ?? raw.internshipTrack ?? raw.assignedInternship,
  );

  return {
    id: asString(raw.assessmentId ?? raw.id ?? raw._id),
    title: asString(raw.title ?? raw.name, "Technical Assessment"),
    domain: asString(
      raw.domain ?? raw.domainName ?? raw.domainKey ?? raw.trackName ??
        internship.domain ?? internship.domainName ?? internship.name,
      fallbackDomain || "Domain not assigned",
    ),
    questionCount: asNumber(raw.questionCount ?? raw.mcqCount ?? raw.totalQuestions, CONFIG.questionCount),
    totalMarks: asNumber(raw.totalMarks ?? raw.totalMarksAvailable, CONFIG.totalMarks),
    durationMinutes: asNumber(raw.durationMinutes ?? raw.totalDurationMinutes, CONFIG.durationMinutes),
    passingPercentage: asNumber(raw.passingPercentage ?? raw.passingScore, CONFIG.passingPercentage),
  };
}

function normalizeAttempt(value: unknown): Attempt | null {
  if (!value || typeof value !== "object") return null;

  const raw = asRecord(value);
  const timing = asRecord(raw.timing);

  const questions = asArray(raw.questions)
    .map(normalizeQuestion)
    .sort((a, b) => {
      const rank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
      return rank[a.difficulty] - rank[b.difficulty] || a.order - b.order;
    });

  return {
    attemptId: asString(raw.attemptId ?? raw.id),
    status: asString(raw.status, "in-progress").toLowerCase(),
    questions,
    answers: normalizeAnswers(raw.answers ?? raw.mcqAnswers),
    deadline: asString(
      raw.deadline ?? raw.finalDeadline ?? timing.finalDeadline,
    ),
    startedAt: asString(raw.startedAt ?? raw.createdAt),
  };
}

function getErrorMessage(payload: unknown, fallback: string): string {
  const root = asRecord(payload);
  const error = asRecord(root.error);

  return asString(
    root.message ?? error.message ?? root.error,
    fallback,
  );
}

async function parseResponse(response: Response): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {};
  }
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function getRemainingSeconds(deadline: string): number {
  if (!deadline) return 0;

  const timestamp = new Date(deadline).getTime();

  if (!Number.isFinite(timestamp)) return 0;

  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

function isAnswered(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeResult(value: unknown): AssessmentResult {
  const raw = asRecord(value);
  const scoreValue = raw.score ?? raw.totalScore;
  const percentageValue = raw.percentage;
  const status = asString(raw.status, "pending").toLowerCase();

  const pending = [
    "pending",
    "submitted",
    "evaluating",
    "evaluation-pending",
    "pending-evaluation",
  ].includes(status);

  const score =
    scoreValue === null || scoreValue === undefined || pending
      ? null
      : Number.isFinite(Number(scoreValue))
        ? Number(scoreValue)
        : null;

  const percentage =
    percentageValue === null || percentageValue === undefined || pending
      ? null
      : Number.isFinite(Number(percentageValue))
        ? Number(percentageValue)
        : null;

  return {
    status,
    score,
    percentage,
    passed: !pending && (raw.passed === true || status === "passed"),
    message: asString(
      raw.message,
      pending
        ? "Your assessment has been submitted and is awaiting evaluation."
        : "Your assessment result has been recorded.",
    ),
  };
}

export default function StudentAssessmentPage() {
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("loading");
  const [studentName, setStudentName] = useState("Student");
  const [studentDomain, setStudentDomain] = useState("");
  const [assessment, setAssessment] = useState<AssessmentInfo | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(CONFIG.durationMinutes * 60);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [activeSection, setActiveSection] = useState<Difficulty>("easy");
  const [deviceReady, setDeviceReady] = useState(false);
  const [deviceError, setDeviceError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [proctorWarning, setProctorWarning] = useState("");

  const answersRef = useRef<AnswerMap>({});
  const attemptRef = useRef<Attempt | null>(null);
  const submittingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSavedRef = useRef("");
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const resumeAttemptRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const questions = attempt?.questions ?? [];
  const sectionOrder: Difficulty[] = ["easy", "medium", "hard"];
  const sectionPosition = sectionOrder.indexOf(activeSection);
  const currentQuestion = questions[currentIndex] ?? null;
  const sectionQuestions = useMemo(
    () => questions
      .map((question, index) => ({ question, index }))
      .filter((item) => item.question.difficulty === activeSection),
    [questions, activeSection],
  );
  const activeSectionIndex = sectionQuestions.findIndex((item) => item.index === currentIndex);
  const isLastQuestionInSection = activeSectionIndex === sectionQuestions.length - 1;
  const nextSection = sectionPosition < sectionOrder.length - 1 ? sectionOrder[sectionPosition + 1] : null;
  const activeSectionComplete = sectionQuestions.length === 30 &&
    sectionQuestions.every(({ question }) => isAnswered(answers[question.id]));
  const unlockedSectionIndex = sectionOrder.reduce((highest, section, index) => {
    if (index === 0) return 0;
    const priorQuestions = questions.filter((question) => question.difficulty === sectionOrder[index - 1]);
    return priorQuestions.length === 30 &&
      priorQuestions.every((question) => isAnswered(answers[question.id]))
      ? index
      : highest;
  }, 0);
  const sectionAnsweredCount = sectionQuestions.filter(
    ({ question }) => isAnswered(answers[question.id]),
  ).length;

  const answeredCount = useMemo(
    () => questions.filter((question) => isAnswered(answers[question.id])).length,
    [questions, answers],
  );

  const easyCount = useMemo(
    () => questions.filter((question) => question.difficulty === "easy").length,
    [questions],
  );

  const mediumCount = useMemo(
    () => questions.filter((question) => question.difficulty === "medium").length,
    [questions],
  );

  const hardCount = useMemo(
    () => questions.filter((question) => question.difficulty === "hard").length,
    [questions],
  );

  const progress = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  const requestApi = useCallback(
    async (
      method: "GET" | "POST",
      body?: Record<string, unknown>,
    ): Promise<ApiResponse> => {
      const response = await fetch("/api/student/assessment", {
        method,
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const payload = await parseResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, `Assessment request failed (${response.status}).`),
        );
      }

      return payload;
    },
    [],
  );



  const stopMedia = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
    setMicrophoneActive(false);
  }, []);

  const requestDevicePermissions = useCallback(async () => {
    setDeviceError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceError("This browser does not support camera and microphone access. Please use an updated browser over HTTPS or localhost.");
      return false;
    }
    try {
      const existing = mediaStreamRef.current;
      if (existing?.getVideoTracks().some((track) => track.readyState === "live") &&
          existing?.getAudioTracks().some((track) => track.readyState === "live")) {
        setDeviceReady(true);
        setCameraActive(true);
        setMicrophoneActive(true);
        return true;
      }
      stopMedia();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;
      setDeviceReady(true);
      setCameraActive(stream.getVideoTracks().some((track) => track.readyState === "live"));
      setMicrophoneActive(stream.getAudioTracks().some((track) => track.readyState === "live"));
      setProctorWarning("");
      return true;
    } catch (cause) {
      stopMedia();
      const name = cause instanceof DOMException ? cause.name : "";
      const message = name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "Camera and microphone permission is required. Allow both in your browser's site settings, then try again."
        : name === "NotFoundError"
          ? "A working camera and microphone could not be found on this device."
          : name === "NotReadableError"
            ? "The camera or microphone is already being used by another application. Close it and retry."
            : "Unable to access the camera and microphone. Check device connections and browser permissions.";
      setDeviceReady(false);
      setDeviceError(message);
      return false;
    }
  }, [stopMedia]);

  useEffect(() => () => stopMedia(), [stopMedia]);

  useEffect(() => {
    const stream = mediaStreamRef.current;
    const video = videoRef.current;
    if (stream && video && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [deviceReady, screen]);

  useEffect(() => {
    if (!deviceReady || !mediaStreamRef.current) return;
    const stream = mediaStreamRef.current;
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
    const handleTrackChange = () => {
      const videoLive = videoTrack?.readyState === "live" && videoTrack.enabled;
      const audioLive = audioTrack?.readyState === "live" && audioTrack.enabled;
      setCameraActive(Boolean(videoLive));
      setMicrophoneActive(Boolean(audioLive));
      if (!videoLive || !audioLive) {
        setDeviceReady(false);
        setProctorWarning("Camera or microphone access was interrupted. Re-enable both devices to continue securely.");
      }
    };
    videoTrack?.addEventListener("ended", handleTrackChange);
    audioTrack?.addEventListener("ended", handleTrackChange);
    videoTrack?.addEventListener("mute", handleTrackChange);
    audioTrack?.addEventListener("mute", handleTrackChange);
    return () => {
      videoTrack?.removeEventListener("ended", handleTrackChange);
      audioTrack?.removeEventListener("ended", handleTrackChange);
      videoTrack?.removeEventListener("mute", handleTrackChange);
      audioTrack?.removeEventListener("mute", handleTrackChange);
    };
  }, [deviceReady]);

  useEffect(() => {
    const handleFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreenActive(active);
      if (screen === "assessment" && !active) {
        setProctorWarning("Full-screen mode was exited. Return to full screen to continue the exam.");
      } else if (active) {
        setProctorWarning("");
      }
    };
    const handleVisibility = () => {
      if (screen === "assessment" && document.visibilityState === "hidden") {
        setProctorWarning("The assessment tab is not visible. Return to this tab and continue in full-screen mode.");
      } else if (screen === "assessment" && document.visibilityState === "visible") {
        setProctorWarning("");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreen);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreen);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [screen]);

  useEffect(() => {
    if (screen === "result" || screen === "error") {
      stopMedia();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    }
  }, [screen, stopMedia]);


  const loadAssessment = useCallback(async () => {
    setScreen("loading");
    setError("");

    try {
      const payload = await requestApi("GET");
      const root = asRecord(payload);
      const data = asRecord(root.data);

      const student = asRecord(data.student ?? root.student);
      const assessmentSource = data.assessment ?? root.assessment;
      const resolvedStudentDomain = extractStudentDomain(student);
      setStudentDomain(resolvedStudentDomain);
      setAssessment(null);
      const attemptSource = data.attempt ?? root.attempt;
      const resultSource = data.result ?? root.result;

      setStudentName(
        asString(student.fullName ?? student.name, "Student"),
      );

      if (assessmentSource) {
        setAssessment(normalizeAssessment(assessmentSource, resolvedStudentDomain));
      }

      if (resultSource) {
        setResult(normalizeResult(resultSource));
        setScreen("result");
        return;
      }

      const existingAttempt = normalizeAttempt(attemptSource);

      if (existingAttempt) {
        if (
          ["submitted", "evaluating", "passed", "failed", "expired", "completed"].includes(
            existingAttempt.status,
          )
        ) {
          setResult(
            normalizeResult(
              data.result ?? {
                status: existingAttempt.status,
              },
            ),
          );
          setScreen("result");
          return;
        }

        if (
          !existingAttempt.attemptId ||
          !existingAttempt.deadline ||
          existingAttempt.questions.length !== CONFIG.questionCount
        ) {
          throw new Error(
            "The active assessment data is incomplete. Please contact support.",
          );
        }

        const restoredAnswers = existingAttempt.answers;

        setAttempt(existingAttempt);
        attemptRef.current = existingAttempt;
        setAnswers(restoredAnswers);
        answersRef.current = restoredAnswers;
        lastSavedRef.current = JSON.stringify(restoredAnswers);
        const firstEasyIndex = existingAttempt.questions.findIndex((question) => question.difficulty === "easy");
        const initialIndex = firstEasyIndex >= 0 ? firstEasyIndex : 0;
        setCurrentIndex(initialIndex);
        setActiveSection(existingAttempt.questions[initialIndex]?.difficulty ?? "easy");
        setTimeLeft(getRemainingSeconds(existingAttempt.deadline));
        resumeAttemptRef.current = true;
        setScreen("instructions");
        return;
      }

      setScreen("instructions");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load your assessment.",
      );
      setScreen("error");
    }
  }, [requestApi]);

  useEffect(() => {
    void loadAssessment();
  }, [loadAssessment]);

  const saveAnswers = useCallback(
    (snapshot?: AnswerMap): Promise<void> => {
      const activeAttempt = attemptRef.current;

      if (!activeAttempt?.attemptId || submittingRef.current) {
        return Promise.resolve();
      }

      const answerSnapshot = snapshot ?? answersRef.current;
      const serialized = JSON.stringify(answerSnapshot);

      if (serialized === lastSavedRef.current) {
        setSaveState("saved");
        return Promise.resolve();
      }

      setSaveState("saving");

      const operation = async () => {
        try {
          await requestApi("POST", {
            action: "save",
            attemptId: activeAttempt.attemptId,
            answers: Object.entries(answerSnapshot).map(([questionId, answer]) => ({
              questionId,
              answer,
            })),
          });

          lastSavedRef.current = serialized;
          setSaveState("saved");
        } catch (cause) {
          setSaveState("unsaved");
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to save your answers. Please retry.",
          );
          throw cause;
        }
      };

      const queued = saveQueueRef.current
        .catch(() => undefined)
        .then(operation);

      saveQueueRef.current = queued;
      return queued;
    },
    [requestApi],
  );

  useEffect(() => {
    if (screen !== "assessment" || !attempt) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void saveAnswers().catch(() => undefined);
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [answers, attempt, screen, saveAnswers]);

  useEffect(() => {
    if (screen !== "assessment" || !attempt?.deadline) return;

    const updateTimer = () => {
      const remaining = getRemainingSeconds(attempt.deadline);
      setTimeLeft(remaining);

      if (remaining <= 0 && !submittingRef.current) {
        void submitAssessment(true);
      }
    };

    updateTimer();

    const interval = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(interval);
  }, [screen, attempt]);

  const startAssessment = async () => {
    if (busy || submittingRef.current) return;
    const activeStream = mediaStreamRef.current;
    const hasLiveCamera = Boolean(activeStream?.getVideoTracks().some((track) => track.readyState === "live" && track.enabled));
    const hasLiveMicrophone = Boolean(activeStream?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled));
    if (!deviceReady || !hasLiveCamera || !hasLiveMicrophone) {
      setDeviceReady(false);
      setDeviceError("Camera and microphone must both be enabled before starting the assessment.");
      return;
    }
    if (document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setProctorWarning("Full-screen mode could not be enabled. Use the full-screen control and continue.");
      }
    }
    if (resumeAttemptRef.current && attemptRef.current) {
      resumeAttemptRef.current = false;
      setTimeLeft(getRemainingSeconds(attemptRef.current.deadline));
      setScreen("assessment");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = await requestApi("POST", {
        action: "start",
      });

      const root = asRecord(payload);
      const data = asRecord(root.data);
      const source = data.attempt ?? root.attempt;
      const startedAttempt = normalizeAttempt(source);

      if (!startedAttempt) {
        throw new Error("The server did not return a valid assessment attempt.");
      }

      if (!startedAttempt.attemptId) {
        throw new Error("The assessment attempt ID is missing.");
      }

      if (!startedAttempt.deadline) {
        throw new Error("The server did not return the assessment deadline.");
      }

      if (startedAttempt.questions.length !== CONFIG.questionCount) {
        throw new Error(
          `The assessment must contain exactly ${CONFIG.questionCount} questions.`,
        );
      }

      const difficultyCounts = {
        easy: startedAttempt.questions.filter((q) => q.difficulty === "easy").length,
        medium: startedAttempt.questions.filter((q) => q.difficulty === "medium").length,
        hard: startedAttempt.questions.filter((q) => q.difficulty === "hard").length,
      };

      if (
        difficultyCounts.easy !== CONFIG.easyCount ||
        difficultyCounts.medium !== CONFIG.mediumCount ||
        difficultyCounts.hard !== CONFIG.hardCount
      ) {
        throw new Error(
          "The question bank must contain 30 Easy, 30 Medium and 30 Hard questions.",
        );
      }

      const invalidQuestion = startedAttempt.questions.some(
        (question) =>
          !question.id ||
          !question.question ||
          question.options.length !== 4 ||
          question.options.some((option) => !option.id || !option.text),
      );

      if (invalidQuestion) {
        throw new Error(
          "Some assessment questions have invalid options. Please contact support.",
        );
      }

      const initialAnswers = startedAttempt.answers;

      setAttempt(startedAttempt);
      attemptRef.current = startedAttempt;
      setAnswers(initialAnswers);
      answersRef.current = initialAnswers;
      lastSavedRef.current = JSON.stringify(initialAnswers);
      const firstEasyIndex = startedAttempt.questions.findIndex((question) => question.difficulty === "easy");
      const initialIndex = firstEasyIndex >= 0 ? firstEasyIndex : 0;
      setCurrentIndex(initialIndex);
      setActiveSection(startedAttempt.questions[initialIndex]?.difficulty ?? "easy");
      setTimeLeft(getRemainingSeconds(startedAttempt.deadline));
      setScreen("assessment");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to start your assessment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const selectAnswer = (questionId: string, optionId: string) => {
    if (submittingRef.current || !attemptRef.current?.attemptId) return;

    const next = {
      ...answersRef.current,
      [questionId]: optionId,
    };

    answersRef.current = next;
    setAnswers(next);
    setSaveState("saving");
    setError("");
    void saveAnswers(next).catch(() => undefined);
  };

  const submitAssessment = useCallback(
    async (automatic = false) => {
      if (submittingRef.current) return;

      const activeAttempt = attemptRef.current;

      if (!activeAttempt?.attemptId) {
        setError("Your assessment attempt could not be verified.");
        return;
      }

      submittingRef.current = true;
      setBusy(true);
      setConfirmSubmit(false);
      setScreen("submitting");
      setError("");

      try {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }

        await saveQueueRef.current.catch(() => undefined);

        const payload = await requestApi("POST", {
          action: "submit",
          attemptId: activeAttempt.attemptId,
          answers: Object.entries(answersRef.current).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
          autoSubmitted: automatic,
        });

        const root = asRecord(payload);
        const data = asRecord(root.data);
        const resultSource = data.result ?? root.result ?? data.assessment ?? root.assessment;

        setResult(
          normalizeResult(
            resultSource ?? {
              status: asString(data.status ?? root.status, "pending"),
              message: asString(
                root.message,
                "Your assessment has been submitted successfully.",
              ),
            },
          ),
        );

        stopMedia();
        setScreen("result");
      } catch (cause) {
        submittingRef.current = false;
        setScreen("assessment");
        setError(
          cause instanceof Error
            ? cause.message
            : "Submission failed. Your attempt is still active.",
        );
      } finally {
        setBusy(false);
      }
    },
    [requestApi],
  );

  const changeSection = (section: Difficulty) => {
    const requestedIndex = sectionOrder.indexOf(section);
    if (requestedIndex < 0 || requestedIndex > unlockedSectionIndex) return;
    const first = questions.findIndex((question) => question.difficulty === section);
    if (first >= 0) {
      setActiveSection(section);
      setCurrentIndex(first);
    }
  };

  const navigateToQuestion = (index: number) => {
    const question = questions[index];
    if (!question || question.difficulty !== activeSection) return;
    setCurrentIndex(index);
  };

  const goToNext = () => {
    if (!currentQuestion) return;
    if (!isLastQuestionInSection) {
      const next = sectionQuestions[activeSectionIndex + 1];
      if (next) setCurrentIndex(next.index);
      return;
    }
    if (!activeSectionComplete) {
      setError("Please answer all 30 questions in this section before moving to the next section.");
      return;
    }
    if (nextSection) {
      const nextIndex = questions.findIndex((question) => question.difficulty === nextSection);
      if (nextIndex >= 0) {
        setError("");
        setActiveSection(nextSection);
        setCurrentIndex(nextIndex);
      }
      return;
    }
    setConfirmSubmit(true);
  };

  const goToPrevious = () => {
    if (activeSectionIndex > 0) {
      const previous = sectionQuestions[activeSectionIndex - 1];
      if (previous) setCurrentIndex(previous.index);
    }
  };

  const retrySave = async () => {
    try {
      await saveAnswers();
      setError("");
    } catch {
      setSaveState("unsaved");
    }
  };

  const continueAfterResult = () => {
    if (result?.passed) {
      router.push("/student/internships");
      return;
    }

    router.push("/student/dashboard");
  };

  if (screen === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-blue-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Preparing your assessment...
          </p>
        </div>
      </main>
    );
  }

  if (screen === "error") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <XCircle className="mx-auto h-11 w-11 text-red-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Assessment unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadAssessment()}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (screen === "instructions") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
        <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <header className="relative overflow-hidden bg-gradient-to-br from-[#1237a8] via-blue-700 to-indigo-700 px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[36px] border-white/5" />
            <div className="pointer-events-none absolute -bottom-28 right-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100">
                      CyberNet Careers
                    </p>
                    <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                      Technical Assessment
                    </h1>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-blue-50 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Candidate evaluation
                </span>
              </div>

              <p className="mt-7 text-sm text-blue-100">Welcome back,</p>
              <p className="mt-1 text-xl font-bold">{studentName}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold">
                  <GraduationCap className="h-4 w-4 text-cyan-200" />
                  {assessment?.domain || studentDomain || "Domain not assigned"}
                </span>
                <span className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-blue-50">
                  {assessment?.title || "Internship eligibility assessment"}
                </span>
              </div>
            </div>
          </header>

          <div className="p-5 sm:p-9">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Assessment overview</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Your evaluation details</h2>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                Ready to begin
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/70 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/5">
                <div className="flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100 text-blue-700">
                    <FileQuestion className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">01 / QUESTIONS</span>
                </div>
                <h3 className="mt-5 text-2xl font-extrabold text-slate-900">90 MCQs</h3>
                <p className="mt-1 text-sm text-slate-500">One mark for each correct answer</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">30 Easy</span>
                  <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">30 Medium</span>
                  <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">30 Hard</span>
                </div>
              </div>

              <div className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/70 p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-900/5">
                <div className="flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-100 text-indigo-700">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">02 / DURATION</span>
                </div>
                <h3 className="mt-5 text-2xl font-extrabold text-slate-900">90 Minutes</h3>
                <p className="mt-1 text-sm text-slate-500">One continuous, server-controlled timer</p>
                <div className="mt-4 flex items-center gap-2 text-sm font-bold text-indigo-700">
                  <Target className="h-4 w-4" />
                  40% passing score · 36 marks
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-blue-700 shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Important assessment instructions</h2>
                  <p className="text-xs text-slate-500">Please read before you start</p>
                </div>
              </div>
              <div className="mt-4 grid gap-x-8 gap-y-3 text-sm leading-6 text-slate-700 sm:grid-cols-2">
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />Each question carries one mark.</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />Select one correct option per question.</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />Answers are automatically saved.</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />Use the question palette to navigate.</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />The assessment auto-submits when time expires.</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />The server controls the official timer and score.</p>
                <p className="flex gap-2 sm:col-span-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />Once submitted, the attempt cannot be restarted.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">Camera & microphone check</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Both devices are required before the exam starts. Live preview only; this page does not record or upload audio/video.</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${deviceReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{deviceReady ? "Ready" : "Required"}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${cameraActive ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600"}`}><Camera className="h-4 w-4" /> Camera {cameraActive ? "Allowed" : "Not allowed"}</span>
                <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${microphoneActive ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600"}`}><Mic className="h-4 w-4" /> Microphone {microphoneActive ? "Allowed" : "Not allowed"}</span>
                <button type="button" onClick={() => void requestDevicePermissions()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">{deviceReady ? "Check devices again" : "Allow camera & microphone"}</button>
              </div>
              {deviceError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">{deviceError}</p>}
              {deviceReady && <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-900 p-3 text-white"><video ref={videoRef} autoPlay muted playsInline className="h-20 w-28 scale-x-[-1] rounded-lg bg-slate-700 object-cover" /><p className="text-xs leading-5 text-slate-300">Live camera preview. Your browser may remember permission, but you can revoke it any time in site settings.</p></div>}
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={busy || !deviceReady}
              onClick={() => void startAssessment()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5 hover:from-blue-800 hover:to-indigo-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Starting assessment...
                </>
              ) : (
                <>
                  Start Assessment
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "submitting") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-blue-600" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Submitting assessment
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Please keep this page open while your answers are submitted.
          </p>
        </div>
      </main>
    );
  }

  if (screen === "result" && result) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
          <div
            className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${
              result.status === "pending" ||
              result.status === "submitted" ||
              result.status === "evaluating"
                ? "bg-amber-50 text-amber-600"
                : result.passed
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
            }`}
          >
            {result.status === "pending" ||
            result.status === "submitted" ||
            result.status === "evaluating" ? (
              <Clock3 className="h-8 w-8" />
            ) : result.passed ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : (
              <XCircle className="h-8 w-8" />
            )}
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            {result.status === "pending" ||
            result.status === "submitted" ||
            result.status === "evaluating"
              ? "Evaluation Pending"
              : result.passed
                ? "Assessment Passed"
                : "Assessment Result"}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {result.message}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Score</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {result.score === null
                  ? "Pending"
                  : `${result.score}/${CONFIG.totalMarks}`}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Percentage</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {result.percentage === null
                  ? "Pending"
                  : `${result.percentage}%`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={continueAfterResult}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            {result.passed ? "Continue to Internships" : "Go to Dashboard"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </main>
    );
  }

  if (screen !== "assessment" || !attempt || !currentQuestion) {
    return null;
  }

  return (
    <main className="fixed inset-0 z-40 flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#f3f6fb] text-slate-900">
      <header className="z-30 flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-extrabold sm:text-base">CyberNet Careers · Assessment</h1>
            <p className="truncate text-xs text-slate-500">{assessment?.domain || studentDomain || "Technical Assessment"} · 90 MCQs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-sm font-extrabold tabular-nums sm:text-base ${timeLeft <= 300 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
            <Clock3 className="h-4 w-4" />{formatTime(timeLeft)}
          </div>
          <button type="button" onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
            else void document.documentElement.requestFullscreen?.().catch(() => undefined);
          }} className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:flex">
            <Maximize2 className="h-4 w-4" /> Full screen
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-5">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["easy", "medium", "hard"] as Difficulty[]).map((section) => {
                const count = questions.filter((question) => question.difficulty === section).length;
                const answered = questions.filter((question) => question.difficulty === section && isAnswered(answers[question.id])).length;
                const active = activeSection === section;
                const locked = sectionOrder.indexOf(section) > unlockedSectionIndex;
                const complete = count === 30 && answered === 30;
                return (
                  <button key={section} type="button" onClick={() => changeSection(section)} disabled={locked || busy} aria-current={active ? "step" : undefined} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-extrabold capitalize transition sm:text-sm ${active ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20" : complete ? "border-emerald-200 bg-emerald-50 text-emerald-800" : locked ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}>
                    {complete && <CheckCircle2 className="h-4 w-4" />}
                    {locked && <ShieldCheck className="h-3.5 w-3.5" />}
                    {section} <span className={active ? "text-blue-100" : "text-slate-400"}>{answered}/{count || 30}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-right text-xs font-semibold text-slate-500">
              Question {currentIndex + 1} / 90 · {currentQuestion.difficulty.toUpperCase()} section
            </div>
          </div>

          <div className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{activeSection} section · Questions {sectionPosition * 30 + 1}–{sectionPosition * 30 + 30}</p>
              <p className="mt-1 text-xs text-slate-500">{sectionAnsweredCount}/30 answered in this section · Complete all questions to unlock the next section</p>
            </div>
            <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">1 mark · No negative marking</span>
          </div>

          <article key={currentQuestion.id} className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700">Question {currentIndex + 1}</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-600">{currentQuestion.difficulty} · 1 mark</span>
            </div>
            <h2 className="mt-5 whitespace-pre-wrap text-lg font-semibold leading-8 text-slate-900 sm:text-xl">{currentQuestion.question}</h2>
            <div className="mt-7 grid gap-3">
              {currentQuestion.options.map((option, optionIndex) => {
                const selected = answers[currentQuestion.id] === option.id;
                return (
                  <button key={`${currentQuestion.id}-${option.id}`} type="button" onClick={() => selectAnswer(currentQuestion.id, option.id)} disabled={busy} aria-pressed={selected} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition sm:p-5 ${selected ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-extrabold ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600"}`}>{String.fromCharCode(65 + optionIndex)}</span>
                    <span className="pt-1 text-sm leading-7 text-slate-800 sm:text-base">{option.text}</span>
                  </button>
                );
              })}
            </div>
          </article>

          <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
            <button type="button" disabled={activeSectionIndex <= 0 || busy} onClick={goToPrevious} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Previous</button>
            <div className="flex items-center gap-2">
              {isLastQuestionInSection && nextSection && (
                <span className="hidden text-xs font-semibold text-slate-500 sm:inline">
                  {activeSectionComplete ? "Section complete" : `${30 - sectionAnsweredCount} answers remaining`}
                </span>
              )}
              {nextSection ? (
                <button type="button" disabled={busy || (isLastQuestionInSection && !activeSectionComplete)} onClick={goToNext} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                  {isLastQuestionInSection ? `Continue to ${nextSection}` : "Save & Next"} <ArrowRight className="h-4 w-4" />
                </button>
              ) : isLastQuestionInSection ? (
                <button type="button" disabled={busy || !activeSectionComplete} onClick={() => setConfirmSubmit(true)} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40">Submit Assessment</button>
              ) : (
                <button type="button" disabled={busy} onClick={goToNext} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-40">Save & Next <ArrowRight className="h-4 w-4" /></button>
              )}
            </div>
          </div>
          {error && <div role="alert" className="mt-2 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>}
        </section>

        <aside className="flex max-h-[34dvh] w-full shrink-0 flex-col overflow-y-auto border-t border-slate-200 bg-white p-3 lg:max-h-none lg:w-[310px] lg:border-l lg:border-t-0 lg:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">Question palette</h2>
            <span className="text-xs font-bold text-slate-500">{answeredCount}/90</span>
          </div>
          <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-15 lg:grid-cols-5">
            {sectionQuestions.map(({ question, index }) => {
              const selected = index === currentIndex;
              const done = isAnswered(answers[question.id]);
              return (
                <button key={question.id} type="button" onClick={() => navigateToQuestion(index)} aria-label={`Question ${index + 1}${done ? ", answered" : ", unanswered"}`} aria-current={selected ? "step" : undefined} className={`grid aspect-square min-h-8 place-items-center rounded-lg text-xs font-bold transition ${selected ? "bg-blue-600 text-white ring-2 ring-blue-200" : done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{index + 1}</button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-blue-600" /> Current</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-500" /> Answered</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-slate-300" /> Unanswered</span>
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Overall progress</span><strong>{progress}%</strong></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-[11px] text-slate-500">{answeredCount} answered · {90 - answeredCount} remaining</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-lg bg-emerald-50 p-2"><strong className="block text-emerald-800">{easyCount}/30</strong><span className="text-emerald-700">Easy</span></div>
            <div className="rounded-lg bg-amber-50 p-2"><strong className="block text-amber-800">{mediumCount}/30</strong><span className="text-amber-700">Medium</span></div>
            <div className="rounded-lg bg-rose-50 p-2"><strong className="block text-rose-800">{hardCount}/30</strong><span className="text-rose-700">Hard</span></div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500">Answer sync</span>
            <strong className={saveState === "saved" ? "text-emerald-700" : saveState === "saving" ? "text-blue-700" : "text-red-600"}>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : "Not saved"}</strong>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-2">
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`h-2 w-2 rounded-full ${cameraActive ? "bg-emerald-500" : "bg-red-500"}`} />
              <span>Camera {cameraActive ? "On" : "Off"}</span>
              <span className={`ml-2 h-2 w-2 rounded-full ${microphoneActive ? "bg-emerald-500" : "bg-red-500"}`} />
              <span>Mic {microphoneActive ? "On" : "Off"}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Live only</span>
          </div>
          <div className="mt-3 flex min-h-[94px] items-center gap-3 rounded-xl bg-slate-900 p-2 text-white">
            <div className="relative h-[78px] w-[104px] shrink-0 overflow-hidden rounded-lg bg-slate-700">
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
              {!cameraActive && <div className="absolute inset-0 grid place-items-center"><Camera className="h-6 w-6 text-slate-300" /></div>}
              {cameraActive && <span className="absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold">LIVE</span>}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold">Candidate preview</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-300">Camera preview is not recorded or uploaded by this page.</p>
            </div>
          </div>
          {proctorWarning && <div role="alert" className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-4 text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />{proctorWarning}</div>}
          <button type="button" onClick={() => setConfirmSubmit(true)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Finish Assessment</button>
        </aside>
      </div>

      {(!fullscreenActive || !deviceReady || !cameraActive || !microphoneActive) && (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-slate-950/85 p-5 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            {!fullscreenActive ? (
              <>
                <Monitor className="mx-auto h-9 w-9 text-blue-600" />
                <h2 className="mt-3 text-lg font-extrabold text-slate-900">Full-screen mode required</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Return to full screen to continue. Your official assessment timer continues running.</p>
              </>
            ) : (
              <>
                <Camera className="mx-auto h-9 w-9 text-blue-600" />
                <h2 className="mt-3 text-lg font-extrabold text-slate-900">Camera and microphone required</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">The exam is paused until both devices are available. Your official timer continues running. Allow access in your browser if prompted.</p>
                <div className="mt-4 flex justify-center gap-3 text-xs font-bold">
                  <span className={cameraActive ? "text-emerald-700" : "text-red-600"}>Camera {cameraActive ? "On" : "Off"}</span>
                  <span className={microphoneActive ? "text-emerald-700" : "text-red-600"}>Microphone {microphoneActive ? "On" : "Off"}</span>
                </div>
              </>
            )}
            {deviceError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">{deviceError}</p>}
            <button
              type="button"
              onClick={() => {
                if (!fullscreenActive) {
                  void document.documentElement.requestFullscreen?.().catch(() => setProctorWarning("Your browser did not allow full-screen mode. Retry using the button."));
                } else {
                  void requestDevicePermissions();
                }
              }}
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
            >
              {!fullscreenActive ? "Return to full screen" : "Enable camera and microphone"}
            </button>
          </section>
        </div>
      )}

      {confirmSubmit && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="submit-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="submit-title" className="text-xl font-extrabold text-slate-900">Submit assessment?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">You have answered {answeredCount} out of 90 questions. {90 - answeredCount} questions are unanswered. Unanswered questions receive zero marks.</p>
            <p className="mt-3 text-sm font-semibold text-amber-700">You cannot restart after submission.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" disabled={busy} onClick={() => setConfirmSubmit(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Continue Exam</button>
              <button type="button" disabled={busy} onClick={() => void submitAssessment(false)} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Submit Now</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}