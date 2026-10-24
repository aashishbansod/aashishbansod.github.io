"use client";

import {

  useCallback,

  useEffect,

  useMemo,

  useRef,

  useState,

} from "react";

import { useRouter } from "next/navigation";

import {

  ArrowLeft,

  ArrowRight,

  CheckCircle2,

  Clock3,

  Code2,

  Camera,

  Mic,

  Maximize,

  ShieldAlert,

  FileQuestion,

  LoaderCircle,

  ShieldCheck,

  XCircle,

} from "lucide-react";

type Phase = "mcq" | "coding";

type Screen =

  | "loading"

  | "instructions"

  | "assessment"

  | "submitting"

  | "result"

  | "error";

type Question = {

  id: string;

  question: string;

  type: string;

  section: Phase;

  options: string[];

  language?: string;

  languages?: string[];

  starterCode?: string;

  inputFormat?: string;

  outputFormat?: string;

  examples: unknown[];

  constraints?: string;

};

type Answer = string | string[];

type Exam = {

  id: string;

  title: string;

  domain: string;

  questions: Question[];

  timing: {

    finalDeadline: string;

    mcqDeadline?: string;

    codingDeadline?: string;

  };

};

type ExamResult = {

  pending: boolean;

  passed: boolean;

  score: number | null;

  percentage: number | null;

  message: string;

};

const MCQ_COUNT = 30;

const CODING_COUNT = 2;

const TOTAL_QUESTIONS = 32;

const MAX_CODE_LENGTH = 50000;

function record(value: unknown): Record<string, unknown> {

  return value !== null && typeof value === "object"

    ? (value as Record<string, unknown>)

    : {};

}

function str(value: unknown, fallback = ""): string {

  return typeof value === "string" || typeof value === "number"

    ? String(value).trim()

    : fallback;

}

function arr(value: unknown): unknown[] {

  return Array.isArray(value) ? value : [];

}

function secondsUntil(value?: string): number {

  if (!value) return 0;

  const time = new Date(value).getTime();

  return Number.isFinite(time)

    ? Math.max(0, Math.ceil((time - Date.now()) / 1000))

    : 0;

}

function formatTime(seconds: number): string {

  const safe = Math.max(0, seconds);

  const minutes = Math.floor(safe / 60);

  const remaining = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(

    remaining,

  ).padStart(2, "0")}`;

}

function answered(value: Answer | undefined): boolean {

  return Array.isArray(value)

    ? value.length > 0

    : Boolean(value?.trim());

}

function normalizeStatus(value: unknown): string {

  return str(value)

    .toLowerCase()

    .replace(/[\s_-]+/g, "-")

    .replace(/-+/g, "-");

}

function optionText(value: unknown): string {

  if (typeof value === "string") return value;

  const item = record(value);

  return str(item.text ?? item.label ?? item.value ?? item.option);

}

function normalizeExam(raw: unknown): Exam {

  const root = record(raw);

  const data = record(root.data);

  const source = record(data.assessment ?? root.assessment ?? root);

  const timing = record(source.timing);

  const mcqTiming = record(timing.mcq);

  const codingTiming = record(timing.coding);

  const rawQuestions = arr(

    data.questions ?? source.questions ?? root.questions,

  );

  const questions: Question[] = rawQuestions.map((item, index) => {

    const q = record(item);

    const type = str(q.type ?? q.questionType).toLowerCase();

    const sectionValue = str(q.section).toLowerCase();

    const section: Phase =

      ["coding", "code", "programming", "section-2", "section2"].includes(

        sectionValue,

      ) ||

      ["coding", "code", "programming"].includes(type)

        ? "coding"

        : "mcq";

    return {

      id: str(q.questionId ?? q.id ?? q._id, `question-${index + 1}`),

      question: str(

        q.question ?? q.questionText ?? q.text ?? q.title,

        `Question ${index + 1}`,

      ),

      type,

      section,

      options: arr(q.options ?? q.choices ?? q.answers)

        .map(optionText)

        .filter(Boolean),

      language: str(q.language ?? q.programmingLanguage) || undefined,

      languages: arr(q.languages).map(optionText).filter(Boolean),

      starterCode:

        str(q.starterCode ?? q.codeTemplate ?? q.template) || undefined,

      inputFormat: str(q.inputFormat ?? q.input) || undefined,

      outputFormat: str(q.outputFormat ?? q.output) || undefined,

      examples: arr(q.examples ?? q.example),

      constraints: str(q.constraints) || undefined,

    };

  });

  const finalDeadline = str(

    timing.finalDeadline ?? source.finalDeadline,

  );

  const sourceMCQ = record(source.mcq);

  const sourceCoding = record(source.coding);

  const mcqDeadline = str(

    mcqTiming.deadline ?? timing.mcqDeadline ?? source.mcqDeadline ?? sourceMCQ.deadline,

  );

  const codingDeadline = str(

    codingTiming.deadline ?? timing.codingDeadline ?? source.codingDeadline ?? sourceCoding.deadline,

  );

  return {

    id: str(

      source.attemptId ?? source.assessmentId ?? source.id ?? source._id ??

        data.attemptId,

    ),

    title: str(source.title ?? source.name, "Technical Assessment"),

    domain: str(

      source.domain ?? source.domainKey ?? source.internshipTrack,

    ),

    questions,

    timing: {

      finalDeadline,

      mcqDeadline: mcqDeadline || undefined,

      codingDeadline: codingDeadline || undefined,

    },

  };

}

async function jsonOf(response: Response): Promise<unknown> {

  try {

    return await response.json();

  } catch {

    return null;

  }

}

function messageOf(data: unknown, fallback: string): string {

  const root = record(data);

  const error = record(root.error);

  return str(root.message ?? error.message ?? root.error, fallback);

}

export default function StudentAssessmentPage() {

  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("loading");

  const [studentName, setStudentName] = useState("");

  const [domain, setDomain] = useState("");

  const [exam, setExam] = useState<Exam | null>(null);

  const [attemptId, setAttemptId] = useState("");

  const [phase, setPhase] = useState<Phase>("mcq");

  const [index, setIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const [timeLeft, setTimeLeft] = useState(0);

  const [result, setResult] = useState<ExamResult | null>(null);

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [cameraConsent, setCameraConsent] = useState(false);
  const [micConsent, setMicConsent] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const submittingRef = useRef(false);

  const startedRef = useRef(false);

  const answersRef = useRef(answers);

  const examRef = useRef<Exam | null>(null);

  const attemptRef = useRef("");

  const phaseRef = useRef<Phase>("mcq");

  useEffect(() => {

    answersRef.current = answers;

  }, [answers]);

  useEffect(() => {

    examRef.current = exam;

  }, [exam]);

  useEffect(() => {

    attemptRef.current = attemptId;

  }, [attemptId]);

  useEffect(() => {

    phaseRef.current = phase;

  }, [phase]);

  const mcqs = useMemo(

    () => exam?.questions.filter((q) => q.section === "mcq").slice(0, MCQ_COUNT) ?? [],

    [exam],

  );

  const coding = useMemo(

    () =>

      exam?.questions.filter((q) => q.section === "coding").slice(0, CODING_COUNT) ??

      [],

    [exam],

  );

  const questions = phase === "mcq" ? mcqs : coding;

  const current = questions[index] ?? null;

  const currentAnswer = current ? answers[current.id] : undefined;

  const answeredCount = questions.filter((q) => answered(answers[q.id])).length;

  const totalAnswered = Object.values(answers).filter(answered).length;

  const progress = questions.length

    ? Math.round((answeredCount / questions.length) * 100)

    : 0;

  const loadProfile = useCallback(async () => {

    setScreen("loading");

    setError("");

    try {

      const response = await fetch("/api/student/profile", {

        method: "GET",

        credentials: "include",

        cache: "no-store",

        headers: { Accept: "application/json" },

      });

      const payload = await jsonOf(response);

      if (!response.ok) {

        throw new Error(messageOf(payload, "Unable to verify your account."));

      }

      const root = record(payload);

      const data = record(root.data);

      const profile = record(root.student ?? root.profile ?? data.student ?? data.profile ?? data);

      const internship = record(profile.internship);

      // Fail closed: assessment access requires explicit Main Admin approval.
      // The profile API must return applicationStatus (preferred) or
      // adminApprovalStatus. Missing/unknown status is never treated as approved.
      const applicationStatus = str(

        profile.applicationStatus ?? profile.adminApprovalStatus,

      )

        .toLowerCase()

        .replace(/[\s-]+/g, "_");

      const applicationApproved = [

        "approved",

        "admin_approved",

        "accepted",

      ].includes(applicationStatus);

      if (!applicationApproved) {

        const applicationRejected = [

          "rejected",

          "declined",

          "denied",

        ].includes(applicationStatus);

        setError(

          applicationRejected

            ? "Your application has not been approved. Please contact Main Admin."

            : "Your application is awaiting Main Admin approval. Assessment access is locked until approval.",

        );

        setScreen("error");

        return;

      }

      const status = normalizeStatus(profile.assessmentStatus ?? profile.assessmentResultStatus);

      setStudentName(str(profile.fullName ?? profile.name, "Student"));

      setDomain(

        str(

          profile.assignedDomain ??

            profile.internshipDomain ??

            profile.internshipTrack ??

            profile.domainKey ??

            profile.domain ??

            profile.selectedDomain ??

            internship.domain ??

            internship.track,

          "",

        ),

      );

      // Check the server-side saved result before ever showing Start Assessment.
      const resultResponse = await fetch("/api/assessment/result", {

        method: "GET",

        credentials: "include",

        cache: "no-store",

        headers: { Accept: "application/json" },

      });

      const resultPayload = await jsonOf(resultResponse);

      const resultRoot = record(resultPayload);

      const resultData = record(resultRoot.data);

      const resultAssessment = record(resultData.assessment ?? resultRoot.assessment);

      const resultEligibility = record(resultData.eligibility);

      const resultStatus = normalizeStatus(

        resultAssessment.status ??

          resultAssessment.resultStatus ??

          resultAssessment.result ??

          resultData.assessmentStatus ??

          resultData.resultStatus ??

          resultData.status ??

          resultRoot.status ??

          profile.resultStatus ??

          status,

      );

      const completedStatuses = [

        "passed",

        "failed",

        "evaluated",

        "completed",

        "submitted",

        "evaluation-pending",

        "pending-evaluation",

        "evaluating",

        "result-scheduled",

        "assessment-completed",

        "assessment-submitted",

        "pass",

        "fail",

      ];

      const profileIndicatesCompleted = completedStatuses.includes(status);

      const resultAvailable = resultData.available === true;

      const statusIndicatesResult = completedStatuses.includes(resultStatus);

      if (

        (resultResponse.ok && (resultAvailable || statusIndicatesResult)) ||

        resultResponse.status === 202 ||

        resultResponse.status === 409

      ) {

        const pending =

          resultResponse.status === 202 ||

          resultResponse.status === 409 ||

          [

            "pending",

            "evaluation-pending",

            "pending-evaluation",

            "evaluating",

            "submitted",

            "assessment-submitted",

            "result-scheduled",

          ].includes(resultStatus);

        const scoreValue =

          resultAssessment.score ??

          resultAssessment.totalScore ??

          resultData.score ??

          profile.assessmentScore;

        const percentageValue =

          resultAssessment.percentage ??

          resultData.percentage ??

          profile.assessmentPercentage;

        const passedValue =

          resultAssessment.passed ??

          resultData.passed ??

          resultEligibility.assessmentPassed ??

          (resultStatus === "passed");

        setResult({

          pending,

          passed: !pending && (passedValue === true || resultStatus === "passed" || resultStatus === "pass"),

          score:

            pending || scoreValue === null || scoreValue === undefined || !Number.isFinite(Number(scoreValue))

              ? null

              : Number(scoreValue),

          percentage:

            pending || percentageValue === null || percentageValue === undefined || !Number.isFinite(Number(percentageValue))

              ? null

              : Number(percentageValue),

          message: messageOf(

            resultPayload,

            pending

              ? "Your assessment is saved and awaiting evaluation. You do not need to take it again."

              : (passedValue === true || resultStatus === "passed" || resultStatus === "pass")

                ? "Your saved assessment result is available. Continue to internship selection."

                : resultStatus === "failed" || resultStatus === "fail"

                  ? "Your saved assessment result is available."

                  : "Your assessment attempt already exists. The result is being confirmed; you do not need to take it again.",

          ),

        });

        setScreen("result");

        return;

      }

      // Fail closed: a completed/submitted profile must never be sent back
      // to the start screen, even if the result service is temporarily unavailable.
      if (

        profileIndicatesCompleted ||

        resultResponse.status === 202

      ) {

        const pending =

          ["submitted", "completed", "evaluated", "evaluation-pending", "pending-evaluation", "evaluating"].includes(status) ||

          resultResponse.status === 202 ||

          resultResponse.status === 409;

        const scoreValue = profile.assessmentScore;

        const percentageValue = profile.assessmentPercentage;

        setResult({

          pending,

          passed: !pending && ["passed", "pass"].includes(status),

          score:

            scoreValue === null || scoreValue === undefined || !Number.isFinite(Number(scoreValue))

              ? null

              : Number(scoreValue),

          percentage:

            percentageValue === null || percentageValue === undefined || !Number.isFinite(Number(percentageValue))

              ? null

              : Number(percentageValue),

          message: pending

            ? "Your assessment has already been submitted. The final result is not available yet; refresh this page later."

            : "Your saved assessment result is available. You cannot start the same assessment again.",

        });

        setScreen("result");

        return;

      }

      setScreen("instructions");

    } catch (cause) {

      setError(cause instanceof Error ? cause.message : "Unable to load your profile.");

      setScreen("error");

    }

  }, [router]);

  useEffect(() => {

    void loadProfile();

  }, [loadProfile]);

  const stopMediaTracks = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraReady(false);
    setMicReady(false);
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    setIsFullscreen(Boolean(document.fullscreenElement));
    setFullscreenWarning(false);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active && screen === "assessment" && !submittingRef.current) {
        setFullscreenExitCount((count) => count + 1);
        setFullscreenWarning(true);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && screen === "assessment") {
        setTabSwitchCount((count) => count + 1);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [screen]);

  useEffect(() => {
    if (screen === "result") {
      stopMediaTracks();
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
      setFullscreenWarning(false);
    }
  }, [screen, stopMediaTracks]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const submitExam = useCallback(

    async (automatic = false) => {

      if (submittingRef.current) return;

      const activeExam = examRef.current;

      const activeAttempt = attemptRef.current;

      if (!activeExam || !activeAttempt) {

        setError("Assessment attempt is missing. Please reload and try again.");

        return;

      }

      submittingRef.current = true;

      setBusy(true);

      setConfirmSubmit(false);

      setScreen("submitting");

      try {

        const serializedAnswers = Object.entries(answersRef.current).map(

          ([questionId, value]) => {

            const question = activeExam.questions.find((q) => q.id === questionId);

            if (question?.section === "coding") {

              return {

                questionId,

                type: "coding",

                code: Array.isArray(value)

                  ? value.join("\n").slice(0, MAX_CODE_LENGTH)

                  : value.slice(0, MAX_CODE_LENGTH),

                language: question.language ?? question.languages?.[0] ?? "Java",

              };

            }

            return {

              questionId,

              type: "mcq",

              answer: Array.isArray(value) ? value.join(",") : value,

            };

          },

        );

        const response = await fetch("/api/assessment/submit", {

          method: "POST",

          credentials: "include",

          cache: "no-store",

          headers: {

            "Content-Type": "application/json",

            Accept: "application/json",

          },

          body: JSON.stringify({

            attemptId: activeAttempt,

            answers: serializedAnswers,

            autoSubmitted: automatic,

          }),

        });

        const payload = await jsonOf(response);

        if (!response.ok && response.status !== 202) {

          throw new Error(

            messageOf(payload, `Submission failed (${response.status}).`),

          );

        }

        const root = record(payload);

        const data = record(root.data);

        const assessment = record(data.assessment);

        const pending =

          response.status === 202 ||

          ["pending", "evaluation-pending", "evaluating"].includes(

            str(root.status ?? data.status).toLowerCase(),

          );

        const scoreRaw = assessment.totalScore ?? assessment.score ?? root.score;

        const percentageRaw = assessment.percentage ?? root.percentage;

        const passedRaw = assessment.passed ?? root.passed;

        const score =

          scoreRaw === null || scoreRaw === undefined || pending

            ? null

            : Number(scoreRaw);

        const percentage =

          percentageRaw === null || percentageRaw === undefined || pending

            ? null

            : Number(percentageRaw);

  // A final PASS must be explicitly confirmed by the server.
        const passed = !pending && passedRaw === true;

        stopMediaTracks();
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        setFullscreenWarning(false);
        setResult({

          pending,

          passed,

          score: score !== null && Number.isFinite(score) ? score : null,

          percentage:

            percentage !== null && Number.isFinite(percentage)

              ? percentage

              : null,

          message: messageOf(

            payload,

            pending

              ? "Your answers are awaiting evaluation."

              : passed

                ? "Assessment completed successfully."

                : "The assessment result has been recorded.",

          ),

        });

        setScreen("result");

      } catch (cause) {

        setError(cause instanceof Error ? cause.message : "Submission failed.");

        setScreen("assessment");

      } finally {

        submittingRef.current = false;

        setBusy(false);

      }

    },

    [stopMediaTracks],

  );

  const startExam = async () => {

    if (startedRef.current || busy) return;

    startedRef.current = true;

    setBusy(true);

    setError("");

    try {

      if (!cameraConsent || !micConsent) {
        throw new Error("Please provide consent for camera and microphone before starting.");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera and microphone access are not supported by this browser.");
      }
      await enterFullscreen();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setCameraReady(stream.getVideoTracks().some((track) => track.readyState === "live"));
      setMicReady(stream.getAudioTracks().some((track) => track.readyState === "live"));
      if (!stream.getVideoTracks().length || !stream.getAudioTracks().length) {
        stopMediaTracks();
        throw new Error("Both camera and microphone permissions are required for this assessment.");
      }
      const response = await fetch("/api/assessment/start", {

        method: "POST",

        credentials: "include",

        cache: "no-store",

        headers: {

          "Content-Type": "application/json",

          Accept: "application/json",

        },

        body: JSON.stringify({}),

      });

      const payload = await jsonOf(response);

      if (!response.ok) {

        throw new Error(messageOf(payload, "Unable to start the assessment."));

      }

      const root = record(payload);

      const data = record(root.data);

      const assessmentSource = record(data.assessment ?? root.assessment);

      const started = normalizeExam(payload);

      const returnedAttemptId = str(

        root.attemptId ??

          data.attemptId ??

          assessmentSource.attemptId ??

          started.id,

      );

      if (!returnedAttemptId) {

        throw new Error("The server did not return an assessment attempt ID.");

      }

      if (!started.timing.finalDeadline) {

        throw new Error("The server did not return a valid assessment deadline.");

      }

      const nextMcqs = started.questions.filter((q) => q.section === "mcq");

      const nextCoding = started.questions.filter((q) => q.section === "coding");

      if (nextMcqs.length !== MCQ_COUNT || nextCoding.length !== CODING_COUNT) {

        throw new Error("The assessment must contain exactly 30 MCQs and 2 coding questions.");

      }

      setExam(started);

      examRef.current = started;

      if (started.domain) setDomain(started.domain);

      setAttemptId(returnedAttemptId);

      attemptRef.current = returnedAttemptId;

      setAnswers({});

      answersRef.current = {};

      setPhase("mcq");

      phaseRef.current = "mcq";

      setIndex(0);

      setTimeLeft(

        secondsUntil(started.timing.mcqDeadline ?? started.timing.finalDeadline),

      );

      setScreen("assessment");

    } catch (cause) {
      stopMediaTracks();
      if (document.fullscreenElement && !examRef.current) {
        void document.exitFullscreen().catch(() => undefined);
      }
      setError(cause instanceof Error ? cause.message : "Unable to start assessment.");

    } finally {

      startedRef.current = false;

      setBusy(false);

    }

  };

  // Use server deadlines. MCQ timeout moves to coding; final timeout submits.
  useEffect(() => {

    if (screen !== "assessment" || !exam) return;

    const tick = () => {

      const activeExam = examRef.current;

      if (!activeExam || submittingRef.current) return;

      const finalRemaining = secondsUntil(activeExam.timing.finalDeadline);

      const activePhase = phaseRef.current;

      if (finalRemaining <= 0) {

        setTimeLeft(0);

        void submitExam(true);

        return;

      }

      if (activePhase === "mcq") {

        const mcqRemaining = secondsUntil(

          activeExam.timing.mcqDeadline ?? activeExam.timing.finalDeadline,

        );

        setTimeLeft(Math.min(mcqRemaining, finalRemaining));

        if (mcqRemaining <= 0) {

          phaseRef.current = "coding";

          setPhase("coding");

          setIndex(0);

          setTimeLeft(

            secondsUntil(

              activeExam.timing.codingDeadline ?? activeExam.timing.finalDeadline,

            ),

          );

        }

        return;

      }

      setTimeLeft(finalRemaining);

    };

    tick();

    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);

  }, [screen, exam, submitExam]);

  const selectOption = (question: Question, option: string) => {

    setAnswers((previous) => {

      const existing = previous[question.id];

      if (question.type.includes("multiple")) {

        const selected = Array.isArray(existing) ? existing : [];

        const next = selected.includes(option)

          ? selected.filter((item) => item !== option)

          : [...selected, option];

        return { ...previous, [question.id]: next };

      }

      return { ...previous, [question.id]: option };

    });

  };

  const updateCode = (questionId: string, code: string) => {

    if (code.length > MAX_CODE_LENGTH) return;

    setAnswers((previous) => ({ ...previous, [questionId]: code }));

  };

  const moveToQuestion = (nextIndex: number) => {

    if (nextIndex < 0 || nextIndex >= questions.length) return;

    setIndex(nextIndex);

  };

  const moveToCoding = () => {

    phaseRef.current = "coding";

    setPhase("coding");

    setIndex(0);

    setConfirmSubmit(false);

    if (exam) {

      setTimeLeft(

        secondsUntil(exam.timing.codingDeadline ?? exam.timing.finalDeadline),

      );

    }

  };

  const continueResult = async () => {

    if (result?.pending) {

      await loadProfile();

      return;

    }

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

          <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-blue-600" />

          <p className="mt-4 text-sm font-semibold text-slate-600">

            Preparing your assessment…

          </p>

        </div>

      </main>

    );

  }

  if (screen === "error" || (screen === "instructions" && error)) {

    return (

      <main className="grid min-h-screen place-items-center bg-slate-50 p-5">

        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">

          <XCircle className="mx-auto h-10 w-10 text-red-500" />

          <h1 className="mt-4 text-xl font-bold text-slate-900">

            Assessment unavailable

          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>

          <button

            onClick={() => void loadProfile()}

            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"

          >

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

          <header className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-8 text-white sm:px-9">

            <div className="flex items-center gap-3">

              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">

                <ShieldCheck className="h-6 w-6" />

              </div>

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">

                  CyberNet Careers

                </p>

                <h1 className="mt-1 text-2xl font-bold">Technical Assessment</h1>

              </div>

            </div>

            <p className="mt-5 text-sm text-blue-100">{studentName}</p>

            <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">

              <span className="font-semibold text-blue-100">Assigned domain:</span>

              <span className="font-bold">{domain || "Not returned by student profile"}</span>

            </div>

          </header>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-9">

            <div className="rounded-2xl border border-slate-200 p-5 transition hover:border-blue-300">

              <FileQuestion className="h-6 w-6 text-blue-600" />

              <h2 className="mt-4 font-bold text-slate-900">MCQ Section</h2>

              <p className="mt-1 text-sm text-slate-500">30 questions · 30 minutes</p>

              <p className="mt-3 text-sm font-semibold text-slate-700">60 marks</p>

            </div>

            <div className="rounded-2xl border border-slate-200 p-5 transition hover:border-indigo-300">

              <Code2 className="h-6 w-6 text-indigo-600" />

              <h2 className="mt-4 font-bold text-slate-900">Coding Section</h2>

              <p className="mt-1 text-sm text-slate-500">2 questions · 30 minutes</p>

              <p className="mt-3 text-sm font-semibold text-slate-700">40 marks</p>

            </div>

          </div>

          <div className="px-6 pb-6 sm:px-9 sm:pb-9">

            <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">

              <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />

              <p>

                Total time: <strong>60 minutes</strong>. MCQ time over hone par

                coding section shuru hoga. Total time khatam hote hi answers

                automatically submit honge.

              </p>

            </div>
            <div className="mt-6 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <h2 className="font-bold text-amber-950">Secure assessment permissions</h2>
                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    Fullscreen, camera and microphone are requested for the assessment. Camera and microphone stay active only during the attempt and are stopped after successful submission or when you leave the assessment page. This page does not record or upload audio/video.
                  </p>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-800">
                <input type="checkbox" checked={cameraConsent} onChange={(event) => setCameraConsent(event.target.checked)} className="mt-1 h-4 w-4" />
                <span><Camera className="mr-2 inline h-4 w-4 align-text-bottom" />I consent to enabling my camera during this assessment.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-800">
                <input type="checkbox" checked={micConsent} onChange={(event) => setMicConsent(event.target.checked)} className="mt-1 h-4 w-4" />
                <span><Mic className="mr-2 inline h-4 w-4 align-text-bottom" />I consent to enabling my microphone during this assessment.</span>
              </label>
              <p className="text-xs text-amber-900">Your browser will ask for permission. If you deny it, the assessment will not start. Fullscreen can be exited by browser/system controls; if that happens, you will be asked to return to fullscreen.</p>
            </div>

            <button

              disabled={busy || !cameraConsent || !micConsent}

              onClick={() => void startExam()}

              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"

            >

              {busy ? (

                <>

                  <LoaderCircle className="h-4 w-4 animate-spin" />

                  Starting…

                </>

              ) : (

                <>

                  Start Assessment <ArrowRight className="h-4 w-4" />

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

          <h1 className="mt-4 text-xl font-bold text-slate-900">Submitting assessment</h1>

          <p className="mt-2 text-sm text-slate-500">Please keep this page open.</p>

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

              result.pending

                ? "bg-amber-50 text-amber-600"

                : result.passed

                  ? "bg-emerald-50 text-emerald-600"

                  : "bg-red-50 text-red-600"

            }`}

          >

            {result.pending ? (

              <Clock3 className="h-8 w-8" />

            ) : result.passed ? (

              <CheckCircle2 className="h-8 w-8" />

            ) : (

              <XCircle className="h-8 w-8" />

            )}

          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">

            {result.pending

              ? "Evaluation Pending"

              : result.passed

                ? "Assessment Passed"

                : "Assessment Result"}

          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">{result.message}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">

            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-xs text-slate-500">Score</p>

              <p className="mt-1 text-lg font-bold text-slate-900">

                {result.score === null ? "Pending" : `${result.score}/100`}

              </p>

            </div>

            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-xs text-slate-500">Percentage</p>

              <p className="mt-1 text-lg font-bold text-slate-900">

                {result.percentage === null ? "Pending" : `${result.percentage}%`}

              </p>

            </div>

          </div>

          <button

            onClick={continueResult}

            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-700"

          >

            {result.passed ? "Continue to Internships" : "View Result"}

            <ArrowRight className="h-4 w-4" />

          </button>

        </section>

      </main>

    );

  }

  if (screen !== "assessment" || !exam || !current) return null;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 pt-3 text-xs font-semibold sm:px-6" aria-live="polite">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-2 ${isFullscreen ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
          <Maximize className="h-3.5 w-3.5" /> {isFullscreen ? "Fullscreen active" : "Fullscreen inactive"}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-2 ${cameraReady ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
          <Camera className="h-3.5 w-3.5" /> Camera {cameraReady ? "on" : "off"}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-2 ${micReady ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
          <Mic className="h-3.5 w-3.5" /> Microphone {micReady ? "on" : "off"}
        </span>
        <span className="rounded-full bg-slate-200 px-3 py-2 text-slate-700">Tab switches: {tabSwitchCount}</span>
        <span className="rounded-full bg-slate-200 px-3 py-2 text-slate-700">Fullscreen exits: {fullscreenExitCount}</span>
      </div>
      {fullscreenWarning && screen === "assessment" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/80 p-5">
          <section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">Return to fullscreen</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Fullscreen was exited. Your attempt is still active. Return to fullscreen to continue. This event is counted in this page session.</p>
            <button type="button" onClick={() => void enterFullscreen().catch(() => setError("Fullscreen could not be enabled. Use your browser controls and try again."))} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Re-enter fullscreen</button>
          </section>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">

        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">

          <div className="flex min-w-0 items-center gap-3">

            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">

              {phase === "mcq" ? (

                <FileQuestion className="h-5 w-5" />

              ) : (

                <Code2 className="h-5 w-5" />

              )}

            </div>

            <div className="min-w-0">

              <h1 className="truncate text-sm font-bold sm:text-base">

                {phase === "mcq" ? "MCQ Assessment" : "Coding Assessment"}

              </h1>

              <p className="text-xs text-slate-500">

                {phase === "mcq" ? "Section 1 of 2" : "Section 2 of 2"}

              </p>

              <p className="mt-1 max-w-[65vw] truncate text-xs font-semibold text-blue-700 sm:max-w-md" title={domain}>

                Assigned domain: {domain || exam.domain || "Not available"}

              </p>

            </div>

          </div>

          <div

            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 font-mono text-base font-bold ${

              timeLeft <= 60

                ? "bg-red-50 text-red-600"

                : "bg-blue-50 text-blue-700"

            }`}

            aria-live="polite"

          >

            <Clock3 className="h-4 w-4" />

            {formatTime(timeLeft)}

          </div>

        </div>

      </header>

      <div className="mx-auto grid max-w-[1400px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_270px]">

        <section className="min-w-0">

          <div className="mb-4 flex items-center justify-between gap-3">

            <div>

              <p className="text-xs font-semibold text-slate-500">

                Question {index + 1} of {questions.length}

              </p>

              <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">

                <div

                  className="h-full rounded-full bg-blue-600 transition-all duration-300"

                  style={{ width: `${((index + 1) / questions.length) * 100}%` }}

                />

              </div>

            </div>

            <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">

              {current.section === "mcq" ? "2 marks" : "20 marks"}

            </span>

          </div>

          <article

            key={current.id}

            className="min-h-[390px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm animate-in fade-in duration-200 sm:p-8"

          >

            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">

              Question {index + 1}

            </p>

            <h2 className="mt-4 whitespace-pre-wrap text-lg font-semibold leading-8 text-slate-900 sm:text-xl">

              {current.question}

            </h2>

            {phase === "mcq" ? (

              <div className="mt-7 space-y-3">

                {current.options.map((option, optionIndex) => {

                  const multi = current.type.includes("multiple");

                  const selected = Array.isArray(currentAnswer)

                    ? currentAnswer.includes(option)

                    : currentAnswer === option;

                  return (

                    <button

                      key={`${current.id}-${optionIndex}`}

                      type="button"

                      onClick={() => selectOption(current, option)}

                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition duration-150 ${

                        selected

                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"

                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"

                      }`}

                    >

                      <span

                        className={`grid h-7 w-7 shrink-0 place-items-center border text-xs font-bold ${

                          multi ? "rounded-md" : "rounded-full"

                        } ${

                          selected

                            ? "border-blue-600 bg-blue-600 text-white"

                            : "border-slate-300 text-slate-500"

                        }`}

                      >

                        {selected ? "✓" : String.fromCharCode(65 + optionIndex)}

                      </span>

                      <span className="pt-0.5 text-sm leading-6 text-slate-800">

                        {option}

                      </span>

                    </button>

                  );

                })}

                {current.type.includes("multiple") && (

                  <p className="text-xs text-slate-500">

                    Select all correct options.

                  </p>

                )}

              </div>

            ) : (

              <div className="mt-6 space-y-4">

                {current.inputFormat && (

                  <div>

                    <p className="mb-1 text-xs font-bold text-slate-500">INPUT</p>

                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">

                      {current.inputFormat}

                    </pre>

                  </div>

                )}

                {current.outputFormat && (

                  <div>

                    <p className="mb-1 text-xs font-bold text-slate-500">OUTPUT</p>

                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">

                      {current.outputFormat}

                    </pre>

                  </div>

                )}

                {current.constraints && (

                  <p className="text-xs leading-5 text-slate-500">

                    {current.constraints}

                  </p>

                )}

                {current.examples.length > 0 && (

                  <details className="rounded-lg border border-slate-200 p-3">

                    <summary className="cursor-pointer text-sm font-semibold">

                      View example

                    </summary>

                    <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-600">

                      {current.examples

                        .map((item) =>

                          typeof item === "string"

                            ? item

                            : JSON.stringify(item, null, 2),

                        )

                        .join("\n\n")}

                    </pre>

                  </details>

                )}

                <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#0d1117]">

                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">

                    <span className="text-xs font-semibold text-slate-300">

                      Code editor

                    </span>

                    <span className="text-xs text-slate-400">

                      {current.language ?? current.languages?.[0] ?? "Java"}

                    </span>

                  </div>

                  <textarea

                    value={

                      typeof currentAnswer === "string"

                        ? currentAnswer

                        : current.starterCode ?? ""

                    }

                    onChange={(event) => updateCode(current.id, event.target.value)}

                    spellCheck={false}

                    aria-label="Coding answer"

                    placeholder="// Write your solution here..."

                    className="min-h-[280px] w-full resize-y bg-[#0d1117] p-4 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600"

                  />

                  <div className="border-t border-white/10 px-4 py-2 text-right text-[11px] text-slate-500">

                    {typeof currentAnswer === "string" ? currentAnswer.length : 0}/

                    {MAX_CODE_LENGTH}

                  </div>

                </div>

              </div>

            )}

          </article>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <button

              disabled={index === 0}

              onClick={() => moveToQuestion(index - 1)}

              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"

            >

              <ArrowLeft className="h-4 w-4" /> Previous

            </button>

            {index < questions.length - 1 ? (

              <button

                onClick={() => moveToQuestion(index + 1)}

                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"

              >

                Save & Next <ArrowRight className="h-4 w-4" />

              </button>

            ) : phase === "mcq" ? (

              <button

                onClick={moveToCoding}

                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"

              >

                Coding Section <ArrowRight className="h-4 w-4" />

              </button>

            ) : (

              <button

                onClick={() => setConfirmSubmit(true)}

                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"

              >

                Submit Assessment

              </button>

            )}

          </div>

        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-[88px]">

          <div className="flex items-center justify-between">

            <h2 className="text-sm font-bold text-slate-900">Question Palette</h2>

            <span className="text-xs font-semibold text-slate-500">

              {answeredCount}/{questions.length}

            </span>

          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">

            {questions.map((question, questionIndex) => {

              const selected = questionIndex === index;

              const done = answered(answers[question.id]);

              return (

                <button

                  key={question.id}

                  onClick={() => moveToQuestion(questionIndex)}

                  aria-label={`Question ${questionIndex + 1}${

                    done ? ", answered" : ", unanswered"

                  }`}

                  className={`grid h-10 place-items-center rounded-lg text-xs font-bold transition ${

                    selected

                      ? "bg-blue-600 text-white ring-2 ring-blue-200"

                      : done

                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"

                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"

                  }`}

                >

                  {questionIndex + 1}

                </button>

              );

            })}

          </div>

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">

            <p className="flex items-center gap-2">

              <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Current

            </p>

            <p className="flex items-center gap-2">

              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Answered

            </p>

            <p className="flex items-center gap-2">

              <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> Unanswered

            </p>

          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-4">

            <div className="flex items-center justify-between text-xs">

              <span className="text-slate-500">Overall progress</span>

              <strong className="text-slate-900">

                {totalAnswered}/{TOTAL_QUESTIONS}

              </strong>

            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">

              <div

                className="h-full rounded-full bg-emerald-500 transition-all"

                style={{ width: `${(totalAnswered / TOTAL_QUESTIONS) * 100}%` }}

              />

            </div>

          </div>

          <button

            onClick={() => setConfirmSubmit(true)}

            className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"

          >

            Finish assessment

          </button>

        </aside>

      </div>

      {error && (

        <div

          role="alert"

          className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-xl"

        >

          <div className="flex items-start justify-between gap-3">

            <p>{error}</p>

            <button

              onClick={() => setError("")}

              className="font-bold"

              aria-label="Dismiss error"

            >

              ×

            </button>

          </div>

        </div>

      )}

      {confirmSubmit && (

        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">

          <section

            role="dialog"

            aria-modal="true"

            aria-labelledby="submit-title"

            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"

          >

            <h2 id="submit-title" className="text-xl font-bold text-slate-900">

              Submit assessment?

            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">

              Answered: {totalAnswered}/{TOTAL_QUESTIONS}. Unanswered questions

              will be submitted without an answer.

            </p>

            <div className="mt-6 flex gap-3">

              <button

                disabled={busy}

                onClick={() => setConfirmSubmit(false)}

                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"

              >

                Continue exam

              </button>

              <button

                disabled={busy}

                onClick={() => void submitExam(false)}

                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"

              >

                {busy ? "Submitting…" : "Submit now"}

              </button>

            </div>

          </section>

        </div>

      )}

    </main>

  );

}
