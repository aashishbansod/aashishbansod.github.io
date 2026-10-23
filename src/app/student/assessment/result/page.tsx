"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type JsonRecord = Record<string, unknown>;

type AssessmentResult = {
  attemptId: string;
  status: string;
  pending: boolean;
  passed: boolean;
  score: number | null;
  percentage: number | null;
  totalMarks: number;
  passingMarks: number;
  mcqScore: number | null;
  codingScore: number | null;
  mcqTotalMarks: number;
  codingTotalMarks: number;
  mcqAnswered: number | null;
  mcqCorrect: number | null;
  codingAnswered: number | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
  resultDeclaredAt: string | null;
  message: string;
  internshipEligible: boolean;
  nextStep: string;
};

type LoadState = "loading" | "ready" | "error";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function extractResult(payload: unknown): AssessmentResult | null {
  if (!isRecord(payload)) return null;

  const data = isRecord(payload.data) ? payload.data : payload;
  const assessment = isRecord(data.assessment) ? data.assessment : data;
  const sections = isRecord(data.sections) ? data.sections : {};
  const mcq = isRecord(sections.mcq) ? sections.mcq : {};
  const coding = isRecord(sections.coding) ? sections.coding : {};
  const eligibility = isRecord(data.eligibility) ? data.eligibility : {};

  const status = asText(
    assessment.result ?? assessment.status ?? data.status ?? payload.status,
    "pending",
  ).toLowerCase();

  const explicitPassed =
    typeof assessment.passed === "boolean"
      ? assessment.passed
      : typeof data.passed === "boolean"
        ? data.passed
        : typeof payload.passed === "boolean"
          ? payload.passed
          : null;

  const pending =
    status === "pending" ||
    status === "evaluating" ||
    status === "evaluation-pending" ||
    status === "submitted" ||
    status === "in-progress" ||
    status === "coding-in-progress" ||
    status === "processing";

  const score = asNumber(
    assessment.totalScore ?? assessment.score ?? data.score ?? payload.score,
  );
  const percentage = asNumber(
    assessment.percentage ?? data.percentage ?? payload.percentage,
  );

  const passed =
    explicitPassed ??
    (status === "passed" ? true : status === "failed" ? false : false);

  const rawMessage = asText(payload.message ?? data.message);
  const defaultMessage = pending
    ? "Your assessment has been submitted. Coding answers may still be awaiting evaluation."
    : passed
      ? "You have met the required passing criteria. Internship eligibility is determined by the server."
      : "The server has recorded your assessment result.";

  return {
    attemptId: asText(data.attemptId ?? assessment.attemptId ?? payload.attemptId),
    status,
    pending,
    passed,
    score,
    percentage,
    totalMarks: asNumber(assessment.totalMarks ?? assessment.totalMarksPossible ?? data.totalMarks) ?? 100,
    passingMarks: asNumber(assessment.passingMarks ?? data.passingMarks) ?? 40,
    mcqScore: asNumber(assessment.mcqScore ?? mcq.score),
    codingScore: asNumber(assessment.codingScore ?? coding.score),
    mcqTotalMarks: asNumber(mcq.totalMarks) ?? 60,
    codingTotalMarks: asNumber(coding.totalMarks) ?? 40,
    mcqAnswered: asNumber(mcq.answered),
    mcqCorrect: asNumber(mcq.correct),
    codingAnswered: asNumber(coding.answered),
    submittedAt: asText(assessment.submittedAt ?? data.submittedAt) || null,
    evaluatedAt: asText(assessment.evaluatedAt ?? data.evaluatedAt) || null,
    resultDeclaredAt: asText(assessment.resultDeclaredAt ?? data.resultDeclaredAt) || null,
    message: rawMessage || defaultMessage,
    internshipEligible: asBoolean(
      eligibility.internshipEligible ??
        eligibility.internshipSelectionUnlocked ??
        data.internshipEligible,
    ),
    nextStep: asText(data.nextStep, passed ? "/student/internships" : "/student/dashboard"),
  };
}

function StatusIcon({ pending, passed }: { pending: boolean; passed: boolean }) {
  if (pending) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity=".25" />
        <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (passed) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9">
        <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9">
      <path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export default function AssessmentResultPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const loadResult = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setState("loading");

    setError("");

    try {
      const url = new URL("/api/assessment/result", window.location.origin);
      const requestedAttemptId = new URLSearchParams(window.location.search).get("attemptId")?.trim() ?? "";
      if (requestedAttemptId) url.searchParams.set("attemptId", requestedAttemptId);

      const response = await fetch(url.toString(), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const record = isRecord(payload) ? payload : {};
        const nestedError = isRecord(record.error) ? record.error : {};
        const message =
          asText(record.message) ||
          asText(nestedError.message) ||
          (response.status === 401
            ? "Please log in with your student account to view the result."
            : response.status === 404
              ? "No assessment result was found for this account yet."
              : "Unable to load the assessment result.");
        throw new Error(message);
      }

      const normalized = extractResult(payload);
      if (!normalized) {
        throw new Error("The result API returned an unexpected response.");
      }

      setResult(normalized);
      setState("ready");
      setLastChecked(new Date().toISOString());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong while loading your result.",
      );
      setState("error");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadResult();
  }, [loadResult]);

  useEffect(() => {
    if (!result?.pending) return;
    const intervalId = window.setInterval(() => {
      void loadResult(true);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [result?.pending, loadResult]);

  const scoreText = useMemo(() => {
    if (!result || result.score === null) return "Pending";
    return `${result.score} / ${result.totalMarks}`;
  }, [result]);

  const percentageText = useMemo(() => {
    if (!result || result.percentage === null) return "Pending";
    return `${result.percentage.toFixed(2)}%`;
  }, [result]);

  const statusTheme = result?.pending
    ? {
        panel: "border-amber-200 bg-amber-50 text-amber-800",
        icon: "bg-amber-500 text-white",
        title: "Evaluation pending",
      }
    : result?.passed
      ? {
          panel: "border-emerald-200 bg-emerald-50 text-emerald-800",
          icon: "bg-emerald-500 text-white",
          title: "Assessment passed",
        }
      : {
          panel: "border-rose-200 bg-rose-50 text-rose-800",
          icon: "bg-rose-500 text-white",
          title: "Assessment result",
        };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_36%),#f4f7fb] px-4 py-8 text-slate-900 sm:px-6 lg:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <Link href="/student/dashboard" className="inline-flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-800 hover:text-blue-700">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-sm font-black text-white">CN</span>
            CyberNet Careers
          </Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500">
            Student Assessment Portal
          </span>
        </header>

        {state === "loading" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 sm:p-12">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
              <h1 className="mt-6 text-2xl font-black tracking-tight">Loading your result</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">We are securely checking the latest assessment status from the server.</p>
            </div>
          </section>
        )}

        {state === "error" && (
          <section className="rounded-3xl border border-rose-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-10">
            <div className="mx-auto max-w-xl text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <StatusIcon pending={false} passed={false} />
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-rose-600">Unable to load result</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">We could not retrieve your result</h1>
              <p role="alert" className="mt-3 text-sm leading-6 text-slate-600">{error}</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => void loadResult(true)} disabled={refreshing} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {refreshing ? "Checking..." : "Try again"}
                </button>
                <Link href="/student/dashboard" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
                  Student dashboard
                </Link>
              </div>
            </div>
          </section>
        )}

        {state === "ready" && result && (
          <>
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
              <div className={`px-6 py-10 text-center sm:px-12 sm:py-14 ${result.pending ? "bg-gradient-to-br from-amber-50 via-white to-orange-50" : result.passed ? "bg-gradient-to-br from-emerald-50 via-white to-cyan-50" : "bg-gradient-to-br from-rose-50 via-white to-orange-50"}`}>
                <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl shadow-lg ${statusTheme?.icon ?? "bg-blue-700 text-white"}`}>
                  <StatusIcon pending={result.pending} passed={result.passed} />
                </div>
                <p className="mt-7 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">CyberNet Careers · Assessment result</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                  {result.pending ? "Evaluation Pending" : result.passed ? "Assessment Passed" : "Assessment Result"}
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">{result.message}</p>
                <div className={`mx-auto mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-extrabold uppercase tracking-wide ${statusTheme?.panel ?? ""}`}>
                  <span className={`h-2 w-2 rounded-full ${result.pending ? "animate-pulse bg-amber-500" : result.passed ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {result.pending ? "Awaiting final evaluation" : result.passed ? "Passed" : result.status}
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
                <MetricCard label="Final score" value={scoreText} detail={`Passing marks: ${result.passingMarks}`} />
                <MetricCard label="Percentage" value={percentageText} detail="Calculated by the server" />
                <MetricCard label="MCQ score" value={result.mcqScore === null ? "Pending" : `${result.mcqScore} / ${result.mcqTotalMarks}`} detail={result.mcqCorrect === null ? "MCQ breakdown" : `${result.mcqCorrect} correct answers`} />
                <MetricCard label="Coding score" value={result.codingScore === null ? "Pending" : `${result.codingScore} / ${result.codingTotalMarks}`} detail={result.codingAnswered === null ? "Coding evaluation" : `${result.codingAnswered} submitted`} />
              </div>

              <div className="border-t border-slate-100 px-5 py-6 sm:px-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Attempt ID</p>
                    <p className="mt-2 break-all font-mono text-sm font-bold text-slate-800">{result.attemptId || "Not provided"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Submitted at</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{formatDate(result.submittedAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Evaluation completed</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{formatDate(result.evaluatedAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Result declared</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{formatDate(result.resultDeclaredAt)}</p>
                  </div>
                </div>
              </div>

              {result.pending && (
                <div className="mx-5 mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:mx-8 sm:mb-8">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-amber-950">Your result is not final yet</p>
                      <p className="mt-1 text-xs leading-5 text-amber-900">This page checks the server periodically. Internship selection remains locked until the server declares eligibility.</p>
                    </div>
                    <button type="button" onClick={() => void loadResult(true)} disabled={refreshing} className="shrink-0 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-extrabold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60">
                      {refreshing ? "Refreshing..." : "Refresh result"}
                    </button>
                  </div>
                </div>
              )}

              <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <p className="text-xs text-slate-500">
                  {lastChecked ? `Last checked ${formatDate(lastChecked)}` : "Result retrieved from server"}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void loadResult(true)} disabled={refreshing} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60">
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                  {result.internshipEligible && !result.pending ? (
                    <Link href="/student/internships" className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800">
                      Continue to internships
                    </Link>
                  ) : (
                    <Link href="/student/dashboard" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800">
                      Student dashboard
                    </Link>
                  )}
                </div>
              </footer>
            </section>
            <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-5 text-slate-500">
              Scores and eligibility displayed here come from the assessment API. If your coding evaluation is pending, the final result may change after the trusted evaluator completes its work.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
