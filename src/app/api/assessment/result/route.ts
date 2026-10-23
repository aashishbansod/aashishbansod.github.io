import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";
import { getAssessmentAttemptModel } from "@/models/AssessmentAttempt";
import {
  AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MCQ_COUNT = 30;
const CODING_COUNT = 2;
const MCQ_TOTAL_MARKS = 60;
const CODING_TOTAL_MARKS = 40;
const TOTAL_QUESTIONS = MCQ_COUNT + CODING_COUNT;
const TOTAL_MARKS = MCQ_TOTAL_MARKS + CODING_TOTAL_MARKS;
const PASSING_MARKS = 40;
const PASSING_PERCENTAGE = 40;

type AnyRecord = Record<string, unknown>;

type StudentRecord = {
  _id?: unknown;
  studentId?: unknown;
  applicationId?: unknown;
  fullName?: unknown;
  email?: unknown;
  loginEnabled?: unknown;
  accountLocked?: unknown;
  lockedUntil?: unknown;
  applicationStatus?: unknown;
  assessmentStatus?: unknown;
  assessmentScore?: unknown;
  assessmentStartedAt?: unknown;
  assessmentSubmittedAt?: unknown;
  assessmentEvaluatedAt?: unknown;
  resultDeclaredAt?: unknown;
  resultVisibleAt?: unknown;
  internshipApplicationAllowed?: unknown;
  internshipTrack?: unknown;
  internshipPlan?: unknown;
  internshipStatus?: unknown;
  paymentStatus?: unknown;
  paymentAmount?: unknown;
  paymentCurrency?: unknown;
  journeyExpired?: unknown;
  journeyExpiresAt?: unknown;
};

type AttemptRecord = {
  _id?: unknown;
  attemptId?: unknown;
  studentId?: unknown;
  assessmentId?: unknown;
  domain?: unknown;
  internshipTrack?: unknown;
  status?: unknown;
  currentPhase?: unknown;
  questions?: unknown;
  startedAt?: unknown;
  mcqDeadline?: unknown;
  codingDeadline?: unknown;
  finalDeadline?: unknown;
  mcqAnswers?: unknown;
  codingAnswers?: unknown;
  mcqScore?: unknown;
  codingScore?: unknown;
  totalScore?: unknown;
  percentage?: unknown;
  passed?: unknown;
  tabSwitches?: unknown;
  fullscreenExitCount?: unknown;
  copyAttempts?: unknown;
  pasteAttempts?: unknown;
  shortcutAttempts?: unknown;
  submittedAt?: unknown;
  evaluatedAt?: unknown;
  resultDeclaredAt?: unknown;
};

function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "same-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}

function errorResponse(message: string, code: string, status: number): NextResponse {
  return jsonResponse(
    {
      success: false,
      message,
      code,
      error: { code, message },
    },
    status,
  );
}

function cleanString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  return "";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function statusOf(value: unknown): string {
  return cleanString(value)
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");
}

function isApplicationApproved(value: unknown): boolean {
  return ["approved", "admin-approved", "accepted"].includes(statusOf(value));
}

function normalizePlan(value: unknown): string {
  const normalized = cleanString(value).toLowerCase().replace(/\s+/g, " ");
  if (["1 month", "1-month", "1 months", "1-months"].includes(normalized)) return "1 Month";
  if (["3 months", "3-months", "3 month", "3-month"].includes(normalized)) return "3 Months";
  if (["6 months", "6-months", "6 month", "6-month"].includes(normalized)) return "6 Months";
  return "";
}

function planPrice(plan: string): number {
  if (plan === "1 Month") return 499;
  if (plan === "3 Months") return 999;
  if (plan === "6 Months") return 1699;
  return 0;
}

function validScore(value: unknown): number | null {
  const score = numberOrNull(value);
  if (score === null || score < 0 || score > TOTAL_MARKS) return null;
  return Number(score.toFixed(2));
}

function percentage(score: number): number {
  return Number(((score / TOTAL_MARKS) * 100).toFixed(2));
}

function isLocked(student: StudentRecord): boolean {
  if (student.accountLocked !== true) return false;
  if (!student.lockedUntil) return true;
  const until = new Date(String(student.lockedUntil));
  return Number.isNaN(until.getTime()) || until.getTime() > Date.now();
}

function isJourneyExpired(student: StudentRecord): boolean {
  if (student.journeyExpired === true) return true;
  if (!student.journeyExpiresAt) return false;
  const expiresAt = new Date(String(student.journeyExpiresAt));
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now();
}

async function authenticateStudent(): Promise<mongoose.Types.ObjectId | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(STUDENT_AUTH_COOKIE_NAME)?.value ??
    cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload || cleanString(payload.role).toLowerCase() !== "student") return null;

  const claims = payload as unknown as AnyRecord;
  const sessionType = cleanString(claims.sessionType).toLowerCase();
  if (sessionType === "admin" || sessionType === "student-dashboard") return null;

  const rawUserId = cleanString(claims.userId ?? claims.sub ?? claims.id);
  if (!rawUserId || !mongoose.isValidObjectId(rawUserId)) return null;
  return new mongoose.Types.ObjectId(rawUserId);
}

function answerCounts(attempt: AttemptRecord) {
  const questions = Array.isArray(attempt.questions)
    ? (attempt.questions as AnyRecord[])
    : [];
  const mcqQuestions = questions.filter((question) => statusOf(question?.section) === "mcq");
  const codingQuestions = questions.filter((question) => statusOf(question?.section) === "coding");
  const mcqAnswers = Array.isArray(attempt.mcqAnswers)
    ? (attempt.mcqAnswers as AnyRecord[])
    : [];
  const codingAnswers = Array.isArray(attempt.codingAnswers)
    ? (attempt.codingAnswers as AnyRecord[])
    : [];

  return {
    mcqTotal: mcqQuestions.length || MCQ_COUNT,
    codingTotal: codingQuestions.length || CODING_COUNT,
    mcqAnswered: mcqAnswers.filter((answer) => cleanString(answer?.answer).length > 0).length,
    codingAnswered: codingAnswers.filter((answer) => cleanString(answer?.code).length > 0).length,
  };
}

function baseAssessment() {
  return {
    totalQuestions: TOTAL_QUESTIONS,
    mcqQuestions: MCQ_COUNT,
    codingQuestions: CODING_COUNT,
    totalMarks: TOTAL_MARKS,
    passingMarks: PASSING_MARKS,
    passingPercentage: PASSING_PERCENTAGE,
  };
}

function eligibilityPayload(passed: boolean) {
  return {
    assessmentPassed: passed,
    internshipEligible: passed,
    internshipSelectionUnlocked: passed,
    minimumPassingMarks: PASSING_MARKS,
  };
}

function isFinalStatus(status: string): boolean {
  return status === "passed" || status === "failed";
}

function isCodingEvaluationPending(attempt: AttemptRecord): boolean {
  const answers = Array.isArray(attempt.codingAnswers)
    ? (attempt.codingAnswers as AnyRecord[])
    : [];

  return answers.some((answer) => {
    const code = cleanString(answer?.code);
    const status = statusOf(answer?.status);
    return (
      code.length > 0 &&
      ["submitted", "evaluating", "not-submitted", "pending", "pending-evaluation"].includes(status)
    );
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await authenticateStudent();
    if (!userId) {
      return errorResponse(
        "Authentication required. Please log in with your student account.",
        "UNAUTHORIZED",
        401,
      );
    }

    await connectDB();

    const studentDoc = await StudentModel.findById(userId)
      .select(
        [
          "_id",
          "studentId",
          "applicationId",
          "fullName",
          "email",
          "loginEnabled",
          "accountLocked",
          "lockedUntil",
          "applicationStatus",
          "assessmentStatus",
          "assessmentScore",
          "assessmentStartedAt",
          "assessmentSubmittedAt",
          "assessmentEvaluatedAt",
          "resultDeclaredAt",
          "resultVisibleAt",
          "internshipApplicationAllowed",
          "internshipTrack",
          "internshipPlan",
          "internshipStatus",
          "paymentStatus",
          "paymentAmount",
          "paymentCurrency",
          "journeyExpired",
          "journeyExpiresAt",
        ].join(" "),
      )
      .lean()
      .exec();

    if (!studentDoc) {
      return errorResponse("Student account could not be found.", "STUDENT_NOT_FOUND", 404);
    }

    const student = studentDoc as unknown as StudentRecord;

    if (isLocked(student)) {
      return errorResponse("Your student account is temporarily locked.", "ACCOUNT_TEMPORARILY_LOCKED", 423);
    }
    if (student.loginEnabled === false) {
      return errorResponse("Student login is currently disabled.", "LOGIN_DISABLED", 403);
    }
    if (isJourneyExpired(student)) {
      return errorResponse("Your internship journey has expired.", "JOURNEY_EXPIRED", 403);
    }
    if (!isApplicationApproved(student.applicationStatus)) {
      return errorResponse(
        "Your application is not approved for the assessment journey.",
        "APPLICATION_NOT_APPROVED",
        403,
      );
    }

    const AttemptModel = await getAssessmentAttemptModel();
    const requestedAttemptId = request.nextUrl.searchParams.get("attemptId")?.trim();

    const attemptQuery: AnyRecord = { studentId: userId };
    if (requestedAttemptId) {
      if (requestedAttemptId.length > 128) {
        return errorResponse("Invalid assessment attempt ID.", "INVALID_ATTEMPT_ID", 400);
      }
      attemptQuery.attemptId = requestedAttemptId;
    }

    const attemptDoc = await AttemptModel.findOne(attemptQuery)
      .sort({ createdAt: -1, _id: -1 })
      .lean()
      .exec();

    if (requestedAttemptId && !attemptDoc) {
      return errorResponse(
        "No assessment attempt matching this ID was found for your account.",
        "ASSESSMENT_ATTEMPT_NOT_FOUND",
        404,
      );
    }

    const studentAssessmentStatus = statusOf(student.assessmentStatus);
    const studentScore = validScore(student.assessmentScore);

    if (!attemptDoc) {
      // Never infer a final result from a score alone. The status must be final.
      const studentHasFinalResult =
        ["passed", "failed"].includes(studentAssessmentStatus) &&
        studentScore !== null &&
        Boolean(dateOrNull(student.assessmentEvaluatedAt) || dateOrNull(student.resultDeclaredAt));

      if (!studentHasFinalResult) {
        const pending =
          ["submitted", "evaluating", "pending"].includes(studentAssessmentStatus) ||
          Boolean(dateOrNull(student.assessmentSubmittedAt));

        return jsonResponse({
          success: true,
          message: pending
            ? "Assessment was submitted, but its final evaluated result is not available yet."
            : "Assessment has not been started yet.",
          data: {
            available: false,
            status: pending ? "evaluation-pending" : (studentAssessmentStatus || "not-started"),
            attemptId: null,
            assessment: {
              ...baseAssessment(),
              status: pending ? "evaluation-pending" : (studentAssessmentStatus || "not-started"),
              score: null,
              totalScore: null,
              percentage: null,
              result: pending ? "evaluation-pending" : null,
              passed: false,
              failed: false,
              submittedAt: dateOrNull(student.assessmentSubmittedAt),
              evaluatedAt: dateOrNull(student.assessmentEvaluatedAt),
              resultDeclaredAt: dateOrNull(student.resultDeclaredAt),
            },
            eligibility: eligibilityPayload(false),
          },
        });
      }

      const fallbackVisibleAt = dateOrNull(student.resultVisibleAt);
      if (fallbackVisibleAt && new Date(fallbackVisibleAt).getTime() > Date.now()) {
        return jsonResponse({
          success: true,
          message: "Assessment has been evaluated. The result is scheduled to become visible later.",
          data: {
            available: false,
            status: "result-scheduled",
            resultVisibleAt: fallbackVisibleAt,
            attemptId: null,
          },
        });
      }

      const passed = studentAssessmentStatus === "passed" && studentScore >= PASSING_MARKS;
      const selectedPlan = normalizePlan(student.internshipPlan);
      const paymentStatus = cleanString(student.paymentStatus) || "unpaid";

      return jsonResponse({
        success: true,
        message: "Assessment result loaded successfully.",
        data: {
          available: true,
          attemptId: null,
          student: {
            studentId: cleanString(student.studentId),
            applicationId: cleanString(student.applicationId),
            fullName: cleanString(student.fullName),
            email: cleanString(student.email),
          },
          assessment: {
            ...baseAssessment(),
            status: passed ? "passed" : "failed",
            score: studentScore,
            totalScore: studentScore,
            percentage: percentage(studentScore),
            result: passed ? "passed" : "failed",
            passed,
            failed: !passed,
            startedAt: dateOrNull(student.assessmentStartedAt),
            submittedAt: dateOrNull(student.assessmentSubmittedAt),
            evaluatedAt: dateOrNull(student.assessmentEvaluatedAt),
            declaredAt: dateOrNull(student.resultDeclaredAt),
            resultDeclaredAt: dateOrNull(student.resultDeclaredAt),
            visibleAt: dateOrNull(student.resultVisibleAt),
          },
          eligibility: eligibilityPayload(passed),
          internship: {
            eligible: passed,
            track: cleanString(student.internshipTrack),
            selectedPlan,
            status: cleanString(student.internshipStatus) || (passed ? "available" : "locked"),
            selectionRequired: passed && !selectedPlan,
            paymentRequired: passed && Boolean(selectedPlan) && paymentStatus.toLowerCase() !== "paid",
          },
          payment: {
            status: paymentStatus,
            amount: selectedPlan ? planPrice(selectedPlan) : numberOrNull(student.paymentAmount),
            currency: cleanString(student.paymentCurrency).toUpperCase() || "INR",
          },
          score: studentScore,
          percentage: percentage(studentScore),
          passed,
          failed: !passed,
          result: passed ? "passed" : "failed",
          totalMarks: TOTAL_MARKS,
          passingMarks: PASSING_MARKS,
        },
      });
    }

    const attempt = attemptDoc as unknown as AttemptRecord;
    if (String(attempt.studentId) !== String(userId)) {
      return errorResponse("Assessment attempt access denied.", "ATTEMPT_ACCESS_DENIED", 403);
    }

    const attemptStatus = statusOf(attempt.status);
    const counts = answerCounts(attempt);
    const finalDeadline = dateOrNull(attempt.finalDeadline);
    const expired = finalDeadline ? new Date(finalDeadline).getTime() <= Date.now() : false;

    if (["in-progress", "coding-in-progress"].includes(attemptStatus)) {
      return jsonResponse({
        success: true,
        message: expired
          ? "Assessment time has expired. Please complete submission."
          : "Assessment is currently in progress.",
        data: {
          available: false,
          attemptId: cleanString(attempt.attemptId),
          status: attemptStatus,
          currentPhase: statusOf(attempt.currentPhase) || "mcq",
          assessment: {
            ...baseAssessment(),
            startedAt: dateOrNull(attempt.startedAt),
            mcqDeadline: dateOrNull(attempt.mcqDeadline),
            codingDeadline: dateOrNull(attempt.codingDeadline),
            finalDeadline,
            expired,
          },
          progress: {
            mcq: { total: counts.mcqTotal, answered: counts.mcqAnswered },
            coding: { total: counts.codingTotal, answered: counts.codingAnswered },
          },
          eligibility: eligibilityPayload(false),
        },
      });
    }

    const rawAttemptScore = validScore(attempt.totalScore);
    const codingEvaluationPending = isCodingEvaluationPending(attempt);
    const pendingAttemptStatus = ["submitted", "evaluating", "pending"].includes(attemptStatus);
    const score = pendingAttemptStatus || codingEvaluationPending
      ? null
      : (rawAttemptScore ?? studentScore);

    if (
      ["submitted", "evaluating", "pending"].includes(attemptStatus) ||
      (codingEvaluationPending && !isFinalStatus(attemptStatus))
    ) {
      if (
        score === null ||
        ["submitted", "evaluating", "pending"].includes(attemptStatus) ||
        codingEvaluationPending
      ) {
        return jsonResponse({
          success: true,
          message: "Assessment submitted successfully. The final evaluation is pending.",
          data: {
            available: false,
            attemptId: cleanString(attempt.attemptId),
            status: "pending",
            currentPhase: "completed",
            assessment: {
              ...baseAssessment(),
              status: "pending",
              mcqScore: numberOrNull(attempt.mcqScore),
              codingScore: numberOrNull(attempt.codingScore),
              score,
              totalScore: score,
              percentage: score === null ? null : percentage(score),
              result: "pending",
              passed: false,
              failed: false,
              startedAt: dateOrNull(attempt.startedAt),
              submittedAt: dateOrNull(attempt.submittedAt),
              evaluatedAt: dateOrNull(attempt.evaluatedAt),
              resultDeclaredAt: dateOrNull(attempt.resultDeclaredAt),
            },
            sections: {
              mcq: {
                totalQuestions: MCQ_COUNT,
                totalMarks: MCQ_TOTAL_MARKS,
                answered: counts.mcqAnswered,
                score: numberOrNull(attempt.mcqScore),
              },
              coding: {
                totalQuestions: CODING_COUNT,
                totalMarks: CODING_TOTAL_MARKS,
                answered: counts.codingAnswered,
                score: numberOrNull(attempt.codingScore),
                status: "pending-evaluation",
              },
            },
            eligibility: eligibilityPayload(false),
          },
        });
      }
    }

    if (attemptStatus === "expired" && score === null) {
      return jsonResponse({
        success: true,
        message: "This assessment attempt has expired and does not have a final evaluated result.",
        data: {
          available: false,
          attemptId: cleanString(attempt.attemptId),
          status: "expired",
          assessment: baseAssessment(),
          eligibility: eligibilityPayload(false),
        },
      });
    }

    if (score === null) {
      return errorResponse(
        "Assessment result is not available because a valid final score has not been recorded.",
        "RESULT_NOT_EVALUATED",
        409,
      );
    }

    const statusIsExplicitlyFinal = isFinalStatus(attemptStatus);
    if (!statusIsExplicitlyFinal) {
      return errorResponse(
        "The assessment has a score record but no trusted final result status. Please contact support.",
        "RESULT_STATUS_NOT_FINAL",
        409,
      );
    }
    const passed = attemptStatus === "passed";
    if ((passed && score < PASSING_MARKS) || (!passed && score >= PASSING_MARKS)) {
      return errorResponse(
        "The saved assessment status conflicts with its score. Please contact Student Operations for a result review.",
        "RESULT_SCORE_STATUS_MISMATCH",
        409,
      );
    }

    const declaredAt =
      dateOrNull(attempt.resultDeclaredAt) ?? dateOrNull(student.resultDeclaredAt);
    const explicitVisibleAt = dateOrNull(student.resultVisibleAt);

    if (explicitVisibleAt && new Date(explicitVisibleAt).getTime() > Date.now()) {
      return jsonResponse({
        success: true,
        message: "Assessment has been evaluated. The result is scheduled to become visible later.",
        data: {
          available: false,
          attemptId: cleanString(attempt.attemptId),
          status: "result-scheduled",
          resultVisibleAt: explicitVisibleAt,
        },
      });
    }

    const mcqScoreRaw = numberOrNull(attempt.mcqScore);
    const codingScoreRaw = numberOrNull(attempt.codingScore);
    const mcqScore =
      mcqScoreRaw !== null && mcqScoreRaw >= 0 && mcqScoreRaw <= MCQ_TOTAL_MARKS
        ? Number(mcqScoreRaw.toFixed(2))
        : null;
    const codingScore =
      codingScoreRaw !== null && codingScoreRaw >= 0 && codingScoreRaw <= CODING_TOTAL_MARKS
        ? Number(codingScoreRaw.toFixed(2))
        : null;

    const selectedPlan = normalizePlan(student.internshipPlan);
    const paymentStatus = cleanString(student.paymentStatus) || "unpaid";
    const internshipStatus =
      cleanString(student.internshipStatus) || (passed ? "available" : "locked");

    const resultStatus = passed ? "passed" : "failed";

    return jsonResponse({
      success: true,
      message: passed
        ? "Assessment result loaded successfully. Internship selection is available."
        : "Assessment result loaded successfully.",
      data: {
        available: true,
        attemptId: cleanString(attempt.attemptId),
        student: {
          studentId: cleanString(student.studentId),
          applicationId: cleanString(student.applicationId),
          fullName: cleanString(student.fullName),
          email: cleanString(student.email),
        },
        assessment: {
          ...baseAssessment(),
          status: resultStatus,
          score,
          totalScore: score,
          percentage: percentage(score),
          result: resultStatus,
          passed,
          failed: !passed,
          mcqScore,
          codingScore,
          startedAt: dateOrNull(attempt.startedAt),
          submittedAt:
            dateOrNull(attempt.submittedAt) ?? dateOrNull(student.assessmentSubmittedAt),
          evaluatedAt:
            dateOrNull(attempt.evaluatedAt) ?? dateOrNull(student.assessmentEvaluatedAt),
          declaredAt,
          resultDeclaredAt: declaredAt,
          visibleAt: explicitVisibleAt ?? declaredAt,
          finalDeadline,
        },
        sections: {
          mcq: {
            totalQuestions: MCQ_COUNT,
            totalMarks: MCQ_TOTAL_MARKS,
            answered: counts.mcqAnswered,
            score: mcqScore,
          },
          coding: {
            totalQuestions: CODING_COUNT,
            totalMarks: CODING_TOTAL_MARKS,
            answered: counts.codingAnswered,
            score: codingScore,
          },
        },
        eligibility: {
          ...eligibilityPayload(passed),
          achievedMarks: score,
        },
        internship: {
          eligible: passed,
          track: cleanString(attempt.internshipTrack) || cleanString(student.internshipTrack),
          selectedPlan,
          status: internshipStatus,
          selectionRequired: passed && !selectedPlan,
          paymentRequired: passed && Boolean(selectedPlan) && paymentStatus.toLowerCase() !== "paid",
        },
        payment: {
          status: paymentStatus,
          amount: selectedPlan ? planPrice(selectedPlan) : numberOrNull(student.paymentAmount),
          currency: cleanString(student.paymentCurrency).toUpperCase() || "INR",
        },
        security: {
          tabSwitches: numberOrNull(attempt.tabSwitches) ?? 0,
          fullscreenExitCount: numberOrNull(attempt.fullscreenExitCount) ?? 0,
          copyAttempts: numberOrNull(attempt.copyAttempts) ?? 0,
          pasteAttempts: numberOrNull(attempt.pasteAttempts) ?? 0,
          shortcutAttempts: numberOrNull(attempt.shortcutAttempts) ?? 0,
        },
        // Compatibility fields used by existing result-page clients.
        score,
        percentage: percentage(score),
        passed,
        failed: !passed,
        result: resultStatus,
        totalMarks: TOTAL_MARKS,
        passingMarks: PASSING_MARKS,
      },
    });
  } catch (error) {
    console.error("[ASSESSMENT_RESULT_GET_ERROR]", error);

    if (error instanceof mongoose.Error) {
      return errorResponse(
        "Database error while loading assessment result.",
        "DATABASE_ERROR",
        503,
      );
    }

    return errorResponse(
      "Unable to load assessment result right now.",
      "INTERNAL_SERVER_ERROR",
      500,
    );
  }
}

export async function POST(): Promise<NextResponse> {
  return errorResponse(
    "Method not allowed. Assessment results are generated by the assessment evaluation system.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function PUT(): Promise<NextResponse> {
  return errorResponse(
    "Method not allowed. Assessment results cannot be changed through the student result API.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function PATCH(): Promise<NextResponse> {
  return errorResponse(
    "Method not allowed. Assessment results cannot be changed through the student result API.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function DELETE(): Promise<NextResponse> {
  return errorResponse(
    "Method not allowed. Assessment results cannot be deleted through the student result API.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "GET, OPTIONS",
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
