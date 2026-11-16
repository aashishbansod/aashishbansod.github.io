import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";
import AssessmentModel from "@/models/Assessment";
import QuestionModel from "@/models/Question";
import { getAssessmentAttemptModel, ASSESSMENT_CONSTANTS } from "@/models/AssessmentAttempt";
import {
  AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CONFIG = Object.freeze({
  questionCount: ASSESSMENT_CONSTANTS.MCQ_COUNT,
  easyCount: ASSESSMENT_CONSTANTS.EASY_COUNT,
  mediumCount: ASSESSMENT_CONSTANTS.MEDIUM_COUNT,
  hardCount: ASSESSMENT_CONSTANTS.HARD_COUNT,
  totalMarks: ASSESSMENT_CONSTANTS.TOTAL_MARKS,
  passingMarks: ASSESSMENT_CONSTANTS.PASSING_MARKS,
  maxAnswers: ASSESSMENT_CONSTANTS.MCQ_COUNT,
  maxAnswerLength: 2000,
  maxCounter: 1000,
  maxBodyBytes: 100000,
  submissionGraceMs: 30000,
});

type JsonObject = Record<string, unknown>;
type IncomingAnswer = { questionId: string; answer: string };
type SafeOption = { id: string; text: string };

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  Vary: "Cookie",
};

function respond(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...NO_CACHE_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function fail(message: string, code: string, status: number): NextResponse {
  return respond({ success: false, message, code, error: { code, message } }, status);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: unknown): string {
  return str(value).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeDomain(value: unknown): string {
  return normalizeText(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isFinite(date.getTime()) ? date : null;
}

function safeCounter(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(CONFIG.maxCounter, Math.floor(number)));
}

function mergeCounter(stored: unknown, submitted: unknown): number {
  return Math.max(safeCounter(stored), safeCounter(submitted));
}

function extractOptions(value: unknown): SafeOption[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index): SafeOption | null => {
    const fallbackId = String.fromCharCode(65 + index);
    if (typeof item === "string") {
      const text = item.trim();
      return text ? { id: fallbackId, text } : null;
    }
    if (!isObject(item)) return null;
    const text = str(item.text ?? item.label ?? item.value);
    const id = str(item.optionId ?? item.id) || fallbackId;
    return text ? { id, text } : null;
  }).filter((item): item is SafeOption => item !== null);
}

function normalizeOptionId(value: unknown): string {
  return str(value).toUpperCase().replace(/[\s_-]/g, "");
}

function optionLetter(value: unknown, options: SafeOption[]): string {
  const raw = str(value);
  if (!raw) return "";
  const normalized = normalizeOptionId(raw);
  const byId = options.find((option) => normalizeOptionId(option.id) === normalized);
  if (byId) return String.fromCharCode(65 + options.indexOf(byId));
  if (/^[A-D]$/i.test(raw)) return raw.toUpperCase();
  if (/^[0-3]$/.test(raw)) return String.fromCharCode(65 + Number(raw));
  const byText = options.find((option) => normalizeText(option.text) === normalizeText(raw));
  return byText ? String.fromCharCode(65 + options.indexOf(byText)) : "";
}

function parseAnswers(body: JsonObject):
  | { ok: true; answers: IncomingAnswer[] }
  | { ok: false; message: string } {
  const raw = body.answers ?? body.responses ?? body.submissions;
  if (raw === undefined || raw === null) return { ok: false, message: "Assessment answers are required." };

  const answers: IncomingAnswer[] = [];
  const add = (questionIdValue: unknown, value: unknown) => {
    const questionId = str(questionIdValue);
    if (!questionId) return;
    const item = isObject(value) ? value : { answer: value };
    answers.push({
      questionId,
      answer: str(item.answer ?? item.selectedOption ?? item.selectedAnswer ?? item.optionId ?? item.value),
    });
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isObject(item)) return { ok: false, message: "An answer entry is invalid." };
      const questionId = str(item.questionId ?? item.id);
      if (!questionId) return { ok: false, message: "An answer is missing its question ID." };
      add(questionId, item);
    }
  } else if (isObject(raw)) {
    for (const [questionId, value] of Object.entries(raw)) add(questionId, value);
  } else {
    return { ok: false, message: "Invalid assessment answer format." };
  }

  if (answers.length > CONFIG.maxAnswers) return { ok: false, message: "Too many answers were submitted." };
  const seen = new Set<string>();
  for (const answer of answers) {
    if (seen.has(answer.questionId)) return { ok: false, message: "Duplicate answers were submitted." };
    seen.add(answer.questionId);
    if (answer.answer.length > CONFIG.maxAnswerLength) return { ok: false, message: "An answer exceeds the allowed size." };
  }
  return { ok: true, answers };
}

async function authenticateStudent(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_AUTH_COOKIE_NAME)?.value ?? cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyAccessToken(token);
  if (!payload) return null;
  const claims = payload as unknown as Record<string, unknown>;
  if (str(claims.role).toLowerCase() !== "student") return null;
  const sessionType = str(claims.sessionType).toLowerCase();
  if (sessionType === "admin" || sessionType === "student-dashboard") return null;
  const userId = str(claims.userId ?? claims.sub ?? claims.id);
  return mongoose.isValidObjectId(userId) ? userId : null;
}

function isFinalStatus(status: unknown): boolean {
  return ["passed", "failed"].includes(str(status));
}

function buildResponse(attempt: any): NextResponse {
  const passed = attempt.passed === true && str(attempt.status) === "passed";
  return respond({
    success: true,
    message: passed ? "Assessment submitted and passed." : "Assessment submitted. The required passing score was not reached.",
    status: passed ? "passed" : "failed",
    data: {
      attemptId: str(attempt.attemptId),
      assessment: {
        totalQuestions: CONFIG.questionCount,
        answeredQuestions: Array.isArray(attempt.mcqAnswers) ? attempt.mcqAnswers.length : 0,
        totalMarks: CONFIG.totalMarks,
        passingMarks: CONFIG.passingMarks,
        score: Number(attempt.totalScore) || 0,
        mcqScore: Number(attempt.mcqScore) || 0,
        codingScore: 0,
        percentage: Number(attempt.percentage) || 0,
        result: passed ? "passed" : "failed",
        passed,
        failed: !passed,
        submittedAt: asDate(attempt.submittedAt)?.toISOString() ?? null,
        evaluatedAt: asDate(attempt.evaluatedAt)?.toISOString() ?? null,
      },
      eligibility: {
        assessmentPassed: passed,
        internshipEligible: passed,
        internshipSelectionUnlocked: passed,
      },
      nextStep: passed ? "/student/internships" : "/student/dashboard",
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > CONFIG.maxBodyBytes) {
      return fail("Submission payload is too large.", "PAYLOAD_TOO_LARGE", 413);
    }

    const origin = request.headers.get("origin");
    if (origin) {
      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        return fail("Invalid request origin.", "INVALID_ORIGIN", 403);
      }
      if (parsedOrigin.origin !== request.nextUrl.origin) {
        return fail("Cross-origin assessment submission is not allowed.", "CROSS_ORIGIN_REQUEST", 403);
      }
    } else {
      const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
      if (!["same-origin", "same-site", "none"].includes(fetchSite)) {
        return fail("Request origin could not be verified.", "ORIGIN_REQUIRED", 403);
      }
    }

    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      return fail("Content-Type must be application/json.", "UNSUPPORTED_MEDIA_TYPE", 415);
    }

    const studentId = await authenticateStudent();
    if (!studentId) return fail("Student authentication is required.", "AUTH_REQUIRED", 401);

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > CONFIG.maxBodyBytes) {
      return fail("Submission payload is too large.", "PAYLOAD_TOO_LARGE", 413);
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return fail("Request body must contain valid JSON.", "INVALID_JSON", 400);
    }
    if (!isObject(parsedBody)) return fail("Invalid request body.", "INVALID_JSON", 400);

    const body = parsedBody;
    const parsed = parseAnswers(body);
    if (!parsed.ok) return fail(parsed.message, "INVALID_ANSWERS", 400);

    const attemptId = str(body.attemptId);
    if (!attemptId || attemptId.length > 128 || /[\u0000-\u001f\u007f]/.test(attemptId)) {
      return fail("A valid attemptId is required.", "INVALID_ATTEMPT_ID", 400);
    }

    const automatic = body.autoSubmitted === true || body.submittedBy === "system";
    await connectDB();

    const [student, AttemptModel] = await Promise.all([
      StudentModel.findById(studentId)
        .select("_id applicationStatus loginEnabled accountLocked lockedUntil journeyExpired journeyExpiresAt internshipTrack emailVerified isEmailVerified")
        .lean()
        .exec(),
      getAssessmentAttemptModel(),
    ]);

    if (!student) return fail("Student account was not found.", "STUDENT_NOT_FOUND", 404);
    if (student.loginEnabled !== true) return fail("Student login is disabled.", "LOGIN_DISABLED", 403);
    if (student.accountLocked === true) {
      const lockedUntil = asDate(student.lockedUntil);
      if (!lockedUntil || lockedUntil.getTime() > Date.now()) return fail("Your account is temporarily locked.", "ACCOUNT_LOCKED", 423);
    }
    if (student.journeyExpired === true) return fail("Your internship journey has expired.", "JOURNEY_EXPIRED", 403);
    const journeyExpiresAt = asDate(student.journeyExpiresAt);
    if (journeyExpiresAt && journeyExpiresAt.getTime() <= Date.now()) {
      return fail("Your internship journey has expired.", "JOURNEY_EXPIRED", 403);
    }
    if (str(student.applicationStatus).toLowerCase() !== "approved") {
      return fail("Your application must be approved before submitting the assessment.", "APPLICATION_NOT_APPROVED", 403);
    }
    const studentRecord = student as unknown as Record<string, unknown>;
    if (studentRecord.emailVerified === false || studentRecord.isEmailVerified === false) {
      return fail("Verify your email address before submitting the assessment.", "EMAIL_NOT_VERIFIED", 403);
    }

    const ownerId = new mongoose.Types.ObjectId(studentId);
    const attempt = await AttemptModel.findOne({ attemptId, studentId: ownerId }).exec();
    if (!attempt) return fail("Assessment attempt was not found.", "ATTEMPT_NOT_FOUND", 404);
    if (String(attempt.studentId) !== studentId) return fail("You cannot submit this assessment attempt.", "ACCESS_DENIED", 403);

    if (isFinalStatus(attempt.status)) return buildResponse(attempt);
    if (["submitted", "evaluating"].includes(str(attempt.status))) {
      return fail("Assessment result is still being processed. Please refresh shortly.", "RESULT_PENDING", 409);
    }
    if (!["in-progress"].includes(str(attempt.status))) {
      return fail("This assessment attempt is no longer active.", "ATTEMPT_NOT_ACTIVE", 409);
    }

    const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
    if (questions.length !== CONFIG.questionCount) {
      return fail("The saved assessment question snapshot is invalid. Contact the administrator.", "INVALID_QUESTION_SNAPSHOT", 500);
    }

    const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
    const questionIds = new Set<string>();
    for (const question of questions) {
      const id = str(question.questionId);
      const difficulty = str(question.difficulty).toLowerCase();
      if (!id || questionIds.has(id) || !Object.hasOwn(difficultyCounts, difficulty)) {
        return fail("The attempt contains invalid or duplicate question data.", "INVALID_QUESTION_SNAPSHOT", 500);
      }
      questionIds.add(id);
      difficultyCounts[difficulty as keyof typeof difficultyCounts] += 1;
    }
    if (
      difficultyCounts.easy !== CONFIG.easyCount ||
      difficultyCounts.medium !== CONFIG.mediumCount ||
      difficultyCounts.hard !== CONFIG.hardCount
    ) {
      return fail("The attempt must contain 30 Easy, 30 Medium and 30 Hard questions.", "INVALID_QUESTION_DISTRIBUTION", 500);
    }

    const answerMap = new Map(parsed.answers.map((answer) => [answer.questionId, answer.answer]));
    for (const questionId of answerMap.keys()) {
      if (!questionIds.has(questionId)) return fail("A submitted question does not belong to this attempt.", "QUESTION_NOT_IN_ATTEMPT", 400);
    }

    const now = new Date();
    const deadline = asDate(attempt.finalDeadline);
    const startedAt = asDate(attempt.startedAt);
    if (!deadline || !startedAt || deadline.getTime() <= startedAt.getTime()) {
      return fail("Assessment timing data is invalid.", "INVALID_TIMING", 500);
    }
    if (!automatic && parsed.answers.filter((answer) => answer.answer.length > 0).length !== CONFIG.questionCount) {
      return fail("Please answer all 90 questions before submitting.", "ASSESSMENT_INCOMPLETE", 400);
    }
    if (!automatic && now.getTime() > deadline.getTime() + CONFIG.submissionGraceMs) {
      return fail("The assessment deadline has passed.", "ASSESSMENT_DEADLINE_PASSED", 409);
    }
    if (automatic && now.getTime() < deadline.getTime() - 5000) {
      return fail("Automatic submission is only allowed when the assessment timer expires.", "AUTO_SUBMIT_TOO_EARLY", 403);
    }

    const storedAssessmentId = str(attempt.assessmentId);
    const assessmentFilter: Record<string, unknown> = {
      status: "published",
      isActive: true,
      ...(mongoose.isValidObjectId(storedAssessmentId)
        ? { $or: [{ assessmentId: storedAssessmentId }, { _id: new mongoose.Types.ObjectId(storedAssessmentId) }] }
        : { assessmentId: storedAssessmentId }),
    };
    const assessment = await AssessmentModel.findOne(assessmentFilter as any)
      .select("_id assessmentId domain domainKey status isActive")
      .lean()
      .exec();
    if (!assessment) return fail("The assessment is no longer published or active.", "ASSESSMENT_NOT_ACTIVE", 409);

    const assessmentDomain = normalizeDomain(assessment.domainKey || assessment.domain);
    const attemptDomain = normalizeDomain(attempt.domain);
    const studentDomain = normalizeDomain(student.internshipTrack);
    const attemptTrack = normalizeDomain(attempt.internshipTrack);
    if (!assessmentDomain || assessmentDomain !== attemptDomain) {
      return fail("The attempt domain does not match the published assessment.", "ASSESSMENT_DOMAIN_MISMATCH", 409);
    }
    if (!studentDomain || studentDomain !== attemptTrack) {
      return fail("This assessment does not match your assigned internship domain.", "STUDENT_DOMAIN_MISMATCH", 403);
    }

    const assessmentIds: unknown[] = [assessment._id];
    if (mongoose.isValidObjectId(String(assessment._id))) assessmentIds.push(String(assessment._id));
    const sourceQuestions = await QuestionModel.find({
      questionId: { $in: [...questionIds] },
      assessmentId: { $in: assessmentIds },
      section: "mcq",
      type: "mcq",
      status: "published",
      isActive: true,
    } as any)
      .select("+correctOption questionId assessmentId domain domainKey options correctOption status isActive")
      .lean()
      .exec();

    const sourceMap = new Map<string, any>();
    for (const source of sourceQuestions as any[]) sourceMap.set(str(source.questionId), source);
    if (sourceMap.size !== CONFIG.questionCount) {
      return fail("Published MCQ data is missing or has changed. Contact the administrator.", "MCQ_BANK_INVALID", 503);
    }

    const mcqAnswers: Array<{ questionId: string; answer: string; answeredAt: Date; marksAwarded: number }> = [];
    let score = 0;
    let answeredCount = 0;
    let correctCount = 0;

    for (const question of questions) {
      const source = sourceMap.get(str(question.questionId));
      if (!source) return fail("An MCQ is no longer available.", "MCQ_NOT_FOUND", 503);
      if (normalizeDomain(source.domainKey || source.domain) !== assessmentDomain) {
        return fail("An MCQ does not match the assessment domain.", "QUESTION_DOMAIN_MISMATCH", 503);
      }

      const options = extractOptions(source.options);
      if (options.length !== 4) return fail("An MCQ does not have four valid options.", "INVALID_MCQ_OPTIONS", 503);
      const correct = optionLetter(source.correctOption, options);
      if (!correct) return fail("An MCQ has no valid answer key.", "MCQ_ANSWER_KEY_MISSING", 503);

      const rawAnswer = answerMap.get(str(question.questionId)) || "";
      const selected = rawAnswer ? optionLetter(rawAnswer, options) : "";
      if (rawAnswer && !selected) return fail("An answer does not match an available option.", "INVALID_MCQ_ANSWER", 400);

      const isCorrect = Boolean(selected) && selected === correct;
      if (selected) {
        answeredCount += 1;
        mcqAnswers.push({
          questionId: str(question.questionId),
          answer: selected,
          answeredAt: now,
          marksAwarded: isCorrect ? 1 : 0,
        });
      }
      if (isCorrect) {
        correctCount += 1;
        score += 1;
      }
    }

    const counters = {
      tabSwitches: mergeCounter(attempt.tabSwitches, body.tabSwitches),
      fullscreenExitCount: mergeCounter(attempt.fullscreenExitCount, body.fullscreenExitCount),
      copyAttempts: mergeCounter(attempt.copyAttempts, body.copyAttempts),
      pasteAttempts: mergeCounter(attempt.pasteAttempts, body.pasteAttempts),
      shortcutAttempts: mergeCounter(attempt.shortcutAttempts, body.shortcutAttempts),
    };

    const passed = score >= CONFIG.passingMarks;
    const nextStatus = passed ? "passed" : "failed";
    const submittedBy = automatic || now.getTime() > deadline.getTime() ? "system" : "student";

    const claimed = await AttemptModel.findOneAndUpdate(
      {
        _id: attempt._id,
        attemptId,
        studentId: ownerId,
        status: "in-progress",
      },
      {
        $set: {
          status: nextStatus,
          currentPhase: "completed",
          mcqAnswers,
          codingAnswers: [],
          mcqScore: score,
          codingScore: 0,
          totalScore: score,
          percentage: Number(((score / CONFIG.totalMarks) * 100).toFixed(2)),
          passingMarks: CONFIG.passingMarks,
          passed,
          submittedAt: now,
          submittedBy,
          lastActivityAt: now,
          evaluatedAt: now,
          resultDeclaredAt: now,
          ...counters,
        },
      },
      { new: true, runValidators: true },
    ).lean().exec();

    if (!claimed) {
      const existing = await AttemptModel.findOne({ attemptId, studentId: ownerId }).lean().exec();
      if (existing && isFinalStatus(existing.status)) return buildResponse(existing);
      return fail("This assessment attempt has already been processed. Refresh to view its status.", "SUBMISSION_ALREADY_PROCESSED", 409);
    }

    const studentUpdate = await StudentModel.updateOne(
      { _id: ownerId, applicationStatus: "approved" },
      {
        $set: {
          assessmentStatus: passed ? "passed" : "failed",
          assessmentScore: score,
          assessmentSubmittedAt: now,
          assessmentEvaluatedAt: now,
          resultDeclaredAt: now,
          resultVisibleAt: now,
          resultStatus: passed ? "passed" : "failed",
          internshipApplicationAllowed: passed,
          internshipStatus: passed ? "available" : "locked",
        },
      },
    ).exec();

    if (studentUpdate.matchedCount !== 1) {
      console.error("[ASSESSMENT_SUBMIT_STUDENT_SYNC_FAILED]", { studentId, attemptId, status: nextStatus });
      return fail(
        "Your assessment was saved, but account status synchronization needs administrator review. Refresh before retrying.",
        "STUDENT_STATE_SYNC_FAILED",
        503,
      );
    }

    return respond({
      success: true,
      message: passed ? "Assessment submitted and passed." : "Assessment submitted. The required passing score was not reached.",
      status: nextStatus,
      data: {
        attemptId,
        assessment: {
          totalQuestions: CONFIG.questionCount,
          answeredQuestions: answeredCount,
          correctAnswers: correctCount,
          totalMarks: CONFIG.totalMarks,
          passingMarks: CONFIG.passingMarks,
          score,
          mcqScore: score,
          codingScore: 0,
          percentage: Number(((score / CONFIG.totalMarks) * 100).toFixed(2)),
          result: nextStatus,
          passed,
          failed: !passed,
          submittedAt: now.toISOString(),
          evaluatedAt: now.toISOString(),
        },
        eligibility: {
          assessmentPassed: passed,
          internshipEligible: passed,
          internshipSelectionUnlocked: passed,
        },
        nextStep: passed ? "/student/internships" : "/student/dashboard",
      },
    });
  } catch (error) {
    console.error("[ASSESSMENT_SUBMIT_ERROR]", error);
    if (error instanceof mongoose.Error.ValidationError) {
      return fail("Assessment submission failed database validation.", "VALIDATION_ERROR", 400);
    }
    if (error instanceof mongoose.Error.CastError) {
      return fail("Invalid database identifier or value.", "INVALID_DATABASE_VALUE", 400);
    }
    return fail("Unable to submit the assessment right now. Please try again.", "ASSESSMENT_SUBMIT_FAILED", 500);
  }
}

export async function GET(): Promise<NextResponse> {
  return fail("Use POST to submit the assessment.", "METHOD_NOT_ALLOWED", 405);
}

export async function PUT(): Promise<NextResponse> {
  return fail("Use POST to submit the assessment.", "METHOD_NOT_ALLOWED", 405);
}

export async function PATCH(): Promise<NextResponse> {
  return fail("Use POST to submit the assessment.", "METHOD_NOT_ALLOWED", 405);
}

export async function DELETE(): Promise<NextResponse> {
  return fail("Assessment submissions cannot be deleted.", "METHOD_NOT_ALLOWED", 405);
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
