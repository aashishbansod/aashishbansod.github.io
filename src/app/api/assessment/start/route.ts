import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { createHash, randomInt } from "node:crypto";
import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";
import AssessmentModel from "@/models/Assessment";
import QuestionModel from "@/models/Question";
import {
  ASSESSMENT_CONSTANTS as C,
  getAssessmentAttemptModel,
  type AttemptQuestion,
} from "@/models/AssessmentAttempt";
import {
  AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const ACTIVE_STATUSES = ["in-progress", "submitted", "evaluating"] as const;
const MCQ_DURATION_MS = C.MCQ_DURATION_SECONDS * 1000;
const CODING_DURATION_MS = C.CODING_DURATION_SECONDS * 1000;
const TOTAL_DURATION_MS = C.TOTAL_DURATION_SECONDS * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEXT_LENGTH = 20_000;
type AnyRecord = Record<string, any>;
class InvalidBodyError extends Error {}
class BodyTooLargeError extends Error {}
function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    },
  });
}
function fail(message: string, code: string, status: number, details?: AnyRecord) {
  return json({ success: false, message, code, error: { code, message }, ...(details ? { details } : {}) }, status);
}
function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, max = MAX_TEXT_LENGTH): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "bigint") return String(value).slice(0, max);
  return "";
}
function normalizeDomain(value: unknown): string {
  return text(value, 300).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function normalizeStatus(value: unknown): string {
  return text(value, 50).toLowerCase().replace(/_/g, "-");
}
function normalizeDifficulty(value: unknown): "easy" | "medium" | "hard" | null {
  const difficulty = normalizeStatus(value);
  return difficulty === "easy" || difficulty === "medium" || difficulty === "hard"
    ? difficulty
    : null;
}
function asDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}
async function readBody(request: NextRequest): Promise<AnyRecord> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new BodyTooLargeError();
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new BodyTooLargeError();
  if (!raw.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new InvalidBodyError(); }
  if (!isRecord(parsed)) throw new InvalidBodyError();
  return parsed;
}
function readStudentToken(request: NextRequest): string {
  return request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value || request.cookies.get(AUTH_COOKIE_NAME)?.value || "";
}
function authId(auth: unknown): string {
  if (!isRecord(auth)) return "";
  return text(auth.userId ?? auth.sub ?? auth.id, 128);
}
function authRole(auth: unknown): string {
  return isRecord(auth) ? text(auth.role, 50).toLowerCase() : "";
}
function authSessionType(auth: unknown): string {
  return isRecord(auth) ? text(auth.sessionType, 50).toLowerCase() : "";
}
function getStudentDomain(student: AnyRecord): string {
  return text(student.internshipTrack, 300) || text(student.internshipDomain, 300) || text(student.selectedDomain, 300) || text(student.domain, 300);
}
function assessmentIsComplete(value: unknown): boolean {
  return ["submitted", "evaluated", "passed", "failed"].includes(normalizeStatus(value));
}
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function uniqueStrings(values: string[]): string[] {
  const map = new Map<string, string>();
  for (const value of values) {
    const v = value.trim();
    if (v) map.set(v.toLowerCase(), v);
  }
  return [...map.values()];
}
function normalizeOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.map((option) => {
    if (typeof option === "string") return text(option, 10_000);
    if (isRecord(option)) return text(option.text ?? option.label ?? option.value, 10_000);
    return "";
  }).filter(Boolean));
}
function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.filter((v): v is string => typeof v === "string").map((v) => text(v, 100).toLowerCase()).filter(Boolean)).slice(0, 10);
}
function normalizeExamples(value: unknown): AnyRecord[] {
  if (!Array.isArray(value)) return [];
  const examples: AnyRecord[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const input = text(item.input, 5_000);
    const output = text(item.output, 5_000);
    const explanation = text(item.explanation, 5_000);
    if (!input || !output) continue;
    examples.push({ input, output, ...(explanation ? { explanation } : {}) });
    if (examples.length >= 10) break;
  }
  return examples;
}
function questionIdOf(question: AnyRecord): string {
  const id = question.questionId ?? question._id?.toString?.() ?? question._id;
  return text(id, 256);
}
function sanitizeMCQ(raw: AnyRecord, order: number): AttemptQuestion | null {
  const questionId = questionIdOf(raw);
  const prompt = text(raw.question ?? raw.questionText);
  const options = normalizeOptions(raw.options);
  const difficulty = normalizeDifficulty(raw.difficulty) ?? normalizeDifficulty(raw.section);
  if (!questionId || !prompt || options.length !== 4 || !difficulty) return null;
  return {
    questionId,
    section: "mcq",
    difficulty,
    order,
    marks: C.MCQ_MARKS_PER_QUESTION,
    question: prompt,
    options,
  };
}
function fingerprint(questions: AttemptQuestion[]): string {
  const value = questions.map((q) => `${q.section}:${q.questionId}:${q.marks}`).sort().join("|");
  return createHash("sha256").update(value).digest("hex");
}
function createAttemptId(): string {
  const suffix = new mongoose.Types.ObjectId().toString().slice(-10).toUpperCase();
  return `CN-ATT-${new Date().getUTCFullYear()}-${suffix}`;
}
function sanitizeStoredAttemptQuestions(value: unknown): AnyRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((question) => ({
    questionId: text(question.questionId, 256),
    section: "mcq",
    difficulty: normalizeDifficulty(question.difficulty) ?? "medium",
    order: Number.isSafeInteger(Number(question.order)) ? Number(question.order) : 0,
    marks: Number.isSafeInteger(Number(question.marks)) ? Number(question.marks) : 0,
    question: text(question.question),
    options: normalizeOptions(question.options),
  })).filter((question) =>
    question.questionId &&
    question.question &&
    question.options.length === 4
  );
}

function serializeAttempt(attempt: AnyRecord) {
  const startedAt = asDate(attempt.startedAt);
  const mcqStartedAt = asDate(attempt.mcqStartedAt);
  const mcqDeadline = asDate(attempt.mcqDeadline);
  const codingStartedAt = asDate(attempt.codingStartedAt) ?? mcqDeadline;
  const codingDeadline = asDate(attempt.codingDeadline) ?? asDate(attempt.finalDeadline);
  const finalDeadline = asDate(attempt.finalDeadline);
  if (!startedAt || !mcqStartedAt || !mcqDeadline || !codingStartedAt || !codingDeadline || !finalDeadline) throw new Error("INVALID_ATTEMPT_DATES");
  const now = Date.now();
  const currentPhase = now >= finalDeadline.getTime() ? "completed" : "mcq";
  return {
    attemptId: text(attempt.attemptId, 128),
    assessmentId: text(attempt.assessmentId, 256),
    domain: text(attempt.domain, 300),
    internshipTrack: text(attempt.internshipTrack, 300),
    status: text(attempt.status, 100),
    currentPhase,
    questions: sanitizeStoredAttemptQuestions(attempt.questions),
    startedAt: startedAt.toISOString(),
    finalDeadline: finalDeadline.toISOString(),
    remainingSeconds: Math.max(0, Math.ceil((finalDeadline.getTime() - now) / 1000)),
    totalDurationMinutes: C.TOTAL_DURATION_MINUTES,
    totalQuestions: C.MCQ_COUNT + C.CODING_COUNT,
    totalMarks: C.TOTAL_MARKS,
    passingMarks: C.PASSING_MARKS,
    passingScore: C.PASSING_MARKS,
    mcq: {
      count: C.MCQ_COUNT, marksPerQuestion: C.MCQ_MARKS_PER_QUESTION, totalMarks: C.MCQ_TOTAL_MARKS,
      durationMinutes: C.MCQ_DURATION_MINUTES, startedAt: mcqStartedAt.toISOString(), deadline: mcqDeadline.toISOString(),
      remainingSeconds: Math.max(0, Math.ceil((mcqDeadline.getTime() - now) / 1000)),
    },
    coding: {
      count: C.CODING_COUNT, marksPerQuestion: C.CODING_MARKS_PER_QUESTION, totalMarks: C.CODING_TOTAL_MARKS,
      durationMinutes: C.CODING_DURATION_MINUTES, startedAt: codingStartedAt.toISOString(), deadline: codingDeadline.toISOString(),
      remainingSeconds: Math.max(0, Math.ceil((codingDeadline.getTime() - now) / 1000)),
    },
    security: {
      tabSwitches: Number(attempt.tabSwitches ?? 0), fullscreenExitCount: Number(attempt.fullscreenExitCount ?? 0),
      copyAttempts: Number(attempt.copyAttempts ?? 0), pasteAttempts: Number(attempt.pasteAttempts ?? 0), shortcutAttempts: Number(attempt.shortcutAttempts ?? 0),
    },
  };
}
async function findActiveAttempt(studentId: mongoose.Types.ObjectId) {
  const Attempt = await getAssessmentAttemptModel();
  return Attempt.findOne({ studentId, status: { $in: [...ACTIVE_STATUSES] } }).exec();
}
async function findPublishedAssessment(requestedId: string, domainKey: string): Promise<AnyRecord | null> {
  const baseFilter: AnyRecord = { domainKey, status: "published", isActive: true, isSelectable: true };
  if (requestedId) {
    if (mongoose.isValidObjectId(requestedId)) {
      const byObjectId = await (AssessmentModel as any).findOne({ ...baseFilter, _id: new mongoose.Types.ObjectId(requestedId) }).lean().exec();
      if (byObjectId) return byObjectId;
    }
    return (AssessmentModel as any).findOne({ ...baseFilter, assessmentId: requestedId }).lean().exec();
  }
  return (AssessmentModel as any).findOne(baseFilter).sort({ version: -1, publishedAt: -1, createdAt: -1, _id: 1 }).lean().exec();
}
function classifyQuestion(row: AnyRecord): "mcq" | "coding" | null {
  const section = normalizeStatus(row.section);
  const type = normalizeStatus(row.type);
  const recognizedSection = section === "mcq" || section === "coding" ? section : null;
  const recognizedType = type === "mcq" || type === "coding" ? type : null;
  if (recognizedSection && recognizedType && recognizedSection !== recognizedType) return null;
  return recognizedSection ?? recognizedType;
}
async function getQuestionPool(
  assessmentObjectId: mongoose.Types.ObjectId,
  expectedDomainKey: string,
): Promise<AnyRecord[]> {
  const requiredCount = C.MCQ_COUNT;
  const projection = "questionId assessmentId domain domainKey section type difficulty question questionText options status isActive order";
  const Question = QuestionModel as any;
  const objectIdRows = await Question.find({ assessmentId: assessmentObjectId }).select(projection).sort({ order: 1, questionId: 1, _id: 1 }).lean().exec();
  let candidates: AnyRecord[] = Array.isArray(objectIdRows) ? objectIdRows : [];
  if (candidates.length < requiredCount) {
    const stringRows = await Question.find({ assessmentId: assessmentObjectId.toString() }).select(projection).sort({ order: 1, questionId: 1, _id: 1 }).lean().exec();
    const unique = new Map<string, AnyRecord>();
    for (const row of [...candidates, ...(Array.isArray(stringRows) ? stringRows : [])]) {
      if (!isRecord(row)) continue;
      const id = questionIdOf(row);
      if (id) unique.set(id, row);
    }
    candidates = [...unique.values()];
  }
  return candidates.filter((row) => {
    if (
      classifyQuestion(row) !== "mcq" ||
      normalizeStatus(row.status) !== "published" ||
      row.isActive !== true
    ) {
      return false;
    }
    const questionDomainKey = normalizeDomain(row.domainKey);
    const questionDomain = normalizeDomain(row.domain);
    if (questionDomainKey && questionDomainKey !== expectedDomainKey) return false;
    if (questionDomain && questionDomain !== expectedDomainKey) return false;
    return true;
  });
}
async function questionDiagnostics(assessmentObjectId: mongoose.Types.ObjectId): Promise<AnyRecord> {
  const rows = await (QuestionModel as any).aggregate([
    { $match: { assessmentId: { $in: [assessmentObjectId, assessmentObjectId.toString()] } } },
    { $group: { _id: { section: "$section", type: "$type", difficulty: "$difficulty", status: "$status", isActive: "$isActive" }, count: { $sum: 1 } } },
  ]).exec();
  return {
    totalCandidateRecords: rows.reduce((sum: number, row: AnyRecord) => sum + Number(row.count ?? 0), 0),
    byStatus: rows.map((row: AnyRecord) => ({ section: row._id?.section ?? null, type: row._id?.type ?? null, difficulty: row._id?.difficulty ?? null, status: row._id?.status ?? null, isActive: row._id?.isActive ?? null, count: Number(row.count ?? 0) })),
  };
}
function isDuplicateKey(error: unknown): boolean { return isRecord(error) && error.code === 11000; }
function isMongooseError(error: unknown): boolean { return error instanceof mongoose.Error; }
function isDatabaseConnectionError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const name = text(error.name, 120).toLowerCase();
  const code = text(error.code, 80).toUpperCase();
  const message = text(error.message, 2_000).toLowerCase();
  const knownConnectionNames = [
    "mongoserverselectionerror",
    "mongonetworkerror",
    "mongonetworktimeouterror",
    "mongotimeouterror",
    "mongonotconnectederror",
    "mongotopologyclosederror",
  ];
  if (knownConnectionNames.includes(name)) return true;
  if (["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"].includes(code)) return true;
  return /server selection timed out|failed to connect to|connection timed out|connection refused|topology is closed|not connected to mongodb|authentication failed|bad auth|ip address is not allowed/.test(message);
}
async function expireAttemptIfNeeded(attempt: AnyRecord): Promise<boolean> {
  const status = normalizeStatus(attempt.status);
  if (!["in-progress", "coding-in-progress"].includes(status)) return false;
  const deadline = asDate(attempt.finalDeadline);
  if (!deadline || Date.now() < deadline.getTime() || !attempt._id) return false;
  const Attempt = await getAssessmentAttemptModel();
  const result = await Attempt.updateOne(
    { _id: attempt._id, status: { $in: ["in-progress", "coding-in-progress"] } } as any,
    {
      $set: {
        status: "expired",
        currentPhase: "completed",
        submittedAt: new Date(),
        submittedBy: "system",
        lastActivityAt: new Date(),
      },
    } as any,
  ).exec();
  return Number(result.modifiedCount ?? 0) > 0;
}
function activeAttemptResponse(attempt: AnyRecord, requestId: string) {
  const data = serializeAttempt(attempt);
  return json({ success: true, message: "Active assessment resumed successfully.", data, attemptId: attempt.attemptId, questions: data.questions, assessment: data, resumed: true, meta: { requestId, resumed: true } });
}
export async function POST(request: NextRequest) {
  const requestId = `assessment-start-${new mongoose.Types.ObjectId()}`;
  try {
    const origin = request.headers.get("origin");
    if (origin) {
      let requestOrigin = "";
      try { requestOrigin = new URL(request.url).origin; } catch {}
      if (!requestOrigin || origin !== requestOrigin) {
        return fail("Cross-origin assessment start requests are not allowed.", "CROSS_ORIGIN_REQUEST_BLOCKED", 403);
      }
    }
    const token = readStudentToken(request);
    if (!token) return fail("Student authentication is required.", "AUTH_REQUIRED", 401);
    const auth = await verifyAccessToken(token);
    if (!auth) return fail("Your student session is invalid or expired.", "INVALID_SESSION", 401);
    if (authRole(auth) !== "student" || authSessionType(auth) === "student-dashboard" || authSessionType(auth) === "admin") {
      return fail("A valid student assessment session is required.", "STUDENT_SESSION_REQUIRED", 403);
    }
    const studentId = authId(auth);
    if (!studentId || !mongoose.isValidObjectId(studentId)) return fail("The authenticated student session is invalid.", "INVALID_STUDENT_SESSION", 401);
    let body: AnyRecord;
    try { body = await readBody(request); }
    catch (error) {
      if (error instanceof BodyTooLargeError) return fail("Request body is too large.", "REQUEST_TOO_LARGE", 413);
      return fail("Invalid JSON request body.", "INVALID_JSON", 400);
    }
    const config = isRecord(body.assessmentConfig) ? body.assessmentConfig : {};
    const requestedAssessmentId = text(config.assessmentId, 256);
    const requestedDomain = text(config.domainKey ?? config.domain ?? config.internshipTrack, 300);
    await connectDB();
    const studentDocument = await StudentModel.findById(studentId).lean().exec();
    if (!studentDocument) return fail("Student account not found.", "STUDENT_NOT_FOUND", 404);
    const student = studentDocument as unknown as AnyRecord;
    if (student.accountLocked === true) {
      const lockedUntil = asDate(student.lockedUntil);
      if (!lockedUntil || lockedUntil.getTime() > Date.now()) return fail("Your student account is temporarily locked.", "ACCOUNT_LOCKED", 423);
    }
    const journeyExpiresAt = asDate(student.journeyExpiresAt);
    if (student.journeyExpired === true || (journeyExpiresAt && journeyExpiresAt.getTime() <= Date.now())) return fail("Your internship journey has expired.", "JOURNEY_EXPIRED", 403);
    const applicationStatus = normalizeStatus(student.applicationStatus);
    if (applicationStatus !== "approved") {
      return fail(
        applicationStatus === "rejected"
          ? "Your application was rejected. Assessment access is not available."
          : "Your application must be approved before starting the assessment.",
        applicationStatus === "rejected" ? "APPLICATION_REJECTED" : "APPLICATION_NOT_APPROVED",
        403,
      );
    }
    if (student.loginEnabled !== true) {
      return fail("Student login is currently disabled.", "LOGIN_DISABLED", 403);
    }
    if (student.emailVerified === false || student.isEmailVerified === false) {
      return fail("Verify your email address before starting the assessment.", "EMAIL_NOT_VERIFIED", 403);
    }
    const studentDomain = getStudentDomain(student);
    const studentDomainKey = normalizeDomain(studentDomain);
    if (!studentDomainKey) return fail("Your internship domain has not been assigned yet.", "INTERNSHIP_DOMAIN_NOT_ASSIGNED", 409);
    if (requestedDomain && normalizeDomain(requestedDomain) !== studentDomainKey) return fail("The requested assessment domain does not match your assigned internship domain.", "ASSESSMENT_DOMAIN_MISMATCH", 403);
    if (assessmentIsComplete(student.assessmentStatus)) return fail("Your assessment has already been completed.", "ASSESSMENT_ALREADY_COMPLETED", 409);
    const studentObjectId = new mongoose.Types.ObjectId(studentId);
    const existingAttempt = await findActiveAttempt(studentObjectId);
    if (existingAttempt) {
      const active = existingAttempt.toObject() as unknown as AnyRecord;
      if (await expireAttemptIfNeeded(active)) return fail("Your assessment time has expired. This attempt is now locked.", "ASSESSMENT_EXPIRED", 409);
      if (["submitted", "evaluating"].includes(text(active.status))) return fail("Your assessment has already been submitted and is awaiting evaluation.", "ASSESSMENT_UNDER_EVALUATION", 409);
      return activeAttemptResponse(active, requestId);
    }
    const assessment = await findPublishedAssessment(requestedAssessmentId, studentDomainKey);
    if (!assessment) return fail("No published and selectable assessment was found for your assigned domain.", "ASSESSMENT_NOT_AVAILABLE", 503, { requestedAssessmentId: requestedAssessmentId || null, studentDomain, studentDomainKey });
    const assessmentId = text(assessment.assessmentId, 256);
    const assessmentDomain = text(assessment.domain, 300);
    const assessmentDomainKey = normalizeDomain(assessment.domainKey || assessmentDomain);
    if (assessmentDomainKey !== studentDomainKey) return fail("Published assessment domain does not match the student's assigned domain.", "ASSESSMENT_DOMAIN_MISMATCH", 503, { studentDomainKey, assessmentDomainKey });
    if (normalizeStatus(assessment.status) !== "published" || assessment.isActive !== true || assessment.isSelectable !== true) return fail("This assessment is not currently available.", "ASSESSMENT_NOT_SELECTABLE", 503);
    if (Number(assessment.totalDurationMinutes) !== C.TOTAL_DURATION_MINUTES) return fail(`Assessment duration must be exactly ${C.TOTAL_DURATION_MINUTES} minutes.`, "INVALID_ASSESSMENT_DURATION", 503);
    if (Number(assessment.totalQuestions) !== C.MCQ_COUNT) return fail(`Assessment must contain exactly ${C.MCQ_COUNT} MCQs.`, "INVALID_ASSESSMENT_QUESTION_COUNT", 503);
    if (Number(assessment.totalMarks) !== C.TOTAL_MARKS) return fail(`Assessment total marks must be exactly ${C.TOTAL_MARKS}.`, "INVALID_ASSESSMENT_TOTAL_MARKS", 503);
    if (Number(assessment.passingScore) !== C.PASSING_PERCENTAGE) return fail(`Assessment passing percentage must be exactly ${C.PASSING_PERCENTAGE}%.`, "INVALID_ASSESSMENT_PASSING_PERCENTAGE", 503);
    if (Number(assessment.passingMarks) !== C.PASSING_MARKS) return fail(`Assessment passing marks must be exactly ${C.PASSING_MARKS}.`, "INVALID_ASSESSMENT_PASSING_MARKS", 503);
    if (!mongoose.isValidObjectId(assessment._id)) return fail("Published assessment has an invalid database reference.", "INVALID_ASSESSMENT_REFERENCE", 503);
    const assessmentObjectId = new mongoose.Types.ObjectId(String(assessment._id));
    const mcqPool = await getQuestionPool(assessmentObjectId, assessmentDomainKey);
    const difficultyRequirements = [
      { difficulty: "easy" as const, count: C.EASY_COUNT },
      { difficulty: "medium" as const, count: C.MEDIUM_COUNT },
      { difficulty: "hard" as const, count: C.HARD_COUNT },
    ];
    const selectedQuestions: AttemptQuestion[] = [];
    const difficultyAvailability: Record<string, number> = {};

    for (const requirement of difficultyRequirements) {
      const matching = mcqPool.filter(
        (question) => normalizeDifficulty(question.difficulty) === requirement.difficulty,
      );
      difficultyAvailability[requirement.difficulty] = matching.length;

      if (matching.length < requirement.count) {
        const diagnostics = await questionDiagnostics(assessmentObjectId);
        console.error("[assessment/start] Difficulty question bank incomplete", {
          requestId,
          assessmentId,
          assessmentObjectId: String(assessmentObjectId),
          studentDomainKey,
          requiredDifficulty: requirement.difficulty,
          required: requirement.count,
          available: matching.length,
          diagnostics,
        });
        return fail(
          `Assessment is not ready. It requires ${requirement.count} active ${requirement.difficulty} MCQs.`,
          "INSUFFICIENT_DIFFICULTY_QUESTIONS",
          503,
          {
            assessmentId,
            difficulty: requirement.difficulty,
            required: requirement.count,
            available: matching.length,
            difficultyAvailability,
          },
        );
      }

      const selected = shuffle(matching)
        .slice(0, requirement.count)
        .map((question) => sanitizeMCQ(question, selectedQuestions.length + 1))
        .filter((question): question is AttemptQuestion => question !== null);

      if (selected.length !== requirement.count) {
        return fail(
          `Some published ${requirement.difficulty} MCQs are invalid. Each question must have a prompt and four unique options.`,
          "INVALID_DIFFICULTY_QUESTION_BANK",
          503,
          {
            assessmentId,
            difficulty: requirement.difficulty,
            required: requirement.count,
            valid: selected.length,
          },
        );
      }

      selectedQuestions.push(...selected);
    }

    const questions = selectedQuestions.map((question, index) => ({
      ...question,
      order: index + 1,
    }));
    if (questions.length !== C.MCQ_COUNT || new Set(questions.map((question) => question.questionId)).size !== C.MCQ_COUNT) return fail("The selected assessment contains an invalid question count or duplicate question IDs.", "DUPLICATE_QUESTION_IDS", 503);
    const mcqMarks = questions.reduce((sum, question) => sum + question.marks, 0);
    const codingMarks = 0;
    if (mcqMarks !== C.MCQ_TOTAL_MARKS || codingMarks !== C.CODING_TOTAL_MARKS || mcqMarks + codingMarks !== C.TOTAL_MARKS) return fail("Assessment marks are incorrectly configured.", "INVALID_ASSESSMENT_MARKS", 503);
    const startedAt = new Date();
    const mcqStartedAt = startedAt;
    const mcqDeadline = new Date(startedAt.getTime() + MCQ_DURATION_MS);
    const codingStartedAt = mcqDeadline;
    const codingDeadline = new Date(codingStartedAt.getTime() + CODING_DURATION_MS);
    const finalDeadline = new Date(startedAt.getTime() + TOTAL_DURATION_MS);
    if (codingDeadline.getTime() !== finalDeadline.getTime()) return fail("Server assessment timing configuration is inconsistent.", "INVALID_SERVER_TIMING", 503);
    const Attempt = await getAssessmentAttemptModel();
    let attempt: any;
    try {
      attempt = await Attempt.create({
        attemptId: createAttemptId(), studentId: studentObjectId, assessmentId: assessmentId || String(assessmentObjectId),
        domain: assessmentDomain || studentDomain, internshipTrack: studentDomain, status: "in-progress", currentPhase: "mcq", questions,
        startedAt, mcqStartedAt, mcqDeadline, codingStartedAt, codingDeadline, finalDeadline,
        mcqAnswers: [], codingAnswers: [], mcqScore: 0, codingScore: 0, totalScore: 0, percentage: 0,
        passingMarks: C.PASSING_MARKS, passed: false, tabSwitches: 0, fullscreenExitCount: 0, copyAttempts: 0,
        pasteAttempts: 0, shortcutAttempts: 0, lastActivityAt: startedAt, questionBankVersion: fingerprint(questions),
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        const raced = await findActiveAttempt(studentObjectId);
        if (raced) {
          const racedAttempt = raced.toObject() as unknown as AnyRecord;
          if (await expireAttemptIfNeeded(racedAttempt)) return fail("Your assessment time has expired.", "ASSESSMENT_EXPIRED", 409);
          if (["submitted", "evaluating"].includes(text(racedAttempt.status))) return fail("Your assessment has already been submitted.", "ASSESSMENT_UNDER_EVALUATION", 409);
          return activeAttemptResponse(racedAttempt, requestId);
        }
        return fail("An active assessment attempt already exists.", "ACTIVE_ATTEMPT_EXISTS", 409);
      }
      throw error;
    }
    try {
      const update = await StudentModel.updateOne({ _id: studentObjectId, assessmentStatus: { $nin: ["passed", "failed", "submitted", "evaluated"] } } as any, {
        $set: { assessmentStatus: "in-progress", assessmentStartedAt: startedAt, assessmentScore: 0, resultStatus: "pending", internshipApplicationAllowed: false },
        $unset: { assessmentSubmittedAt: 1, assessmentEvaluatedAt: 1, resultDeclaredAt: 1, resultVisibleAt: 1 },
      } as any).exec();
      if (update.matchedCount === 0) {
        await Attempt.updateOne({ _id: attempt._id, status: "in-progress" } as any, { $set: { status: "cancelled", currentPhase: "completed", submittedAt: new Date(), submittedBy: "system", lastActivityAt: new Date() } } as any).exec();
        return fail("Your assessment status changed. Refresh your student account before trying again.", "STUDENT_ASSESSMENT_STATE_CHANGED", 409);
      }
    } catch (error) {
      try {
        await Attempt.updateOne({ _id: attempt._id, status: "in-progress" } as any, { $set: { status: "cancelled", currentPhase: "completed", submittedAt: new Date(), submittedBy: "system", lastActivityAt: new Date() } } as any).exec();
      } catch (cancelError) {
        console.error("[assessment/start] Attempt cancellation failed", { requestId, cancelError });
      }
      throw error;
    }
    const data = serializeAttempt(attempt.toObject() as unknown as AnyRecord);
    return json({ success: true, message: "Assessment started successfully.", data, attemptId: attempt.attemptId, questions: data.questions, assessment: data, resumed: false, meta: { requestId, serverTime: startedAt.toISOString(), authenticated: true } }, 201);
  } catch (error) {
    console.error("[POST /api/assessment/start]", { requestId, error });
    if (isDatabaseConnectionError(error)) {
      return fail(
        "Assessment database is temporarily unavailable. Please retry shortly. If this continues, contact support.",
        "DATABASE_UNAVAILABLE",
        503,
      );
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return fail(
        "The assessment attempt could not be saved because its data did not match the database schema. Please contact support.",
        "ASSESSMENT_ATTEMPT_VALIDATION_FAILED",
        500,
      );
    }
    if (isMongooseError(error)) {
      return fail(
        "The assessment could not be started because of a data-layer error. Please retry or contact support.",
        "ASSESSMENT_DATA_ERROR",
        500,
      );
    }
    return fail("Unable to start the assessment. Please retry or contact support.", "ASSESSMENT_START_FAILED", 500);
  }
}
export async function GET() { return fail("Method not allowed. Use POST to start an assessment.", "METHOD_NOT_ALLOWED", 405); }
export async function PUT() { return fail("Method not allowed.", "METHOD_NOT_ALLOWED", 405); }
export async function PATCH() { return fail("Method not allowed.", "METHOD_NOT_ALLOWED", 405); }
export async function DELETE() { return fail("Method not allowed.", "METHOD_NOT_ALLOWED", 405); }
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST, OPTIONS", "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST, OPTIONS", "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
