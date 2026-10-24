import { NextRequest, NextResponse } from "next/server";

import mongoose from "mongoose";

import { cookies } from "next/headers";

import connectDB from "@/lib/db";

import StudentModel from "@/models/Student";

import AssessmentModel from "@/models/Assessment";

import QuestionModel from "@/models/Question";

import { getAssessmentAttemptModel } from "@/models/AssessmentAttempt";

import {

  AUTH_COOKIE_NAME,

  STUDENT_AUTH_COOKIE_NAME,

  verifyAccessToken,

} from "@/lib/auth";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const revalidate = 0;

const CONFIG = {

  mcqCount: 30,

  codingCount: 2,

  mcqMarks: 2,

  codingMarks: 20,

  totalMarks: 100,

  passingMarks: 40,

  maxAnswers: 32,

  maxAnswerLength: 2_000,

  maxCodeLength: 50_000,

  maxCounter: 1_000,

  maxBodyBytes: 250_000,

} as const;

type JsonObject = Record<string, unknown>;

type IncomingAnswer = {

  questionId: string;

  answer: string;

  code: string;

  language: string;

};

type SafeOption = {

  id: string;

  text: string;

};

type AssessmentResult = {

  attemptId: string;

  status: string;

  mcqScore: number;

  codingScore: number | null;

  totalScore: number | null;

  percentage: number | null;

  passed: boolean;

  submittedAt: string | null;

};

const NO_CACHE_HEADERS = {

  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options": "nosniff",

  "X-Frame-Options": "DENY",

  "Referrer-Policy": "no-referrer",

  Vary: "Cookie",

};

function respond(body: unknown, status = 200): NextResponse {

  return NextResponse.json(body, {

    status,

    headers: {

      ...NO_CACHE_HEADERS,

      "Content-Type": "application/json; charset=utf-8",

      "Cross-Origin-Resource-Policy": "same-origin",

    },

  });

}

function fail(

  message: string,

  code: string,

  status: number,

): NextResponse {

  return respond(

    {

      success: false,

      message,

      code,

      error: { code, message },

    },

    status,

  );

}

function isObject(value: unknown): value is JsonObject {

  return (

    typeof value === "object" &&

    value !== null &&

    !Array.isArray(value)

  );

}

function str(value: unknown): string {

  if (typeof value === "string") return value.trim();

  if (typeof value === "number" || typeof value === "boolean") {

    return String(value);

  }

  return "";

}

function normalizeText(value: unknown): string {

  return str(value).toLowerCase().replace(/\s+/g, " ").trim();

}

function normalizeDomain(value: unknown): string {

  return normalizeText(value)

    .replace(/&/g, "and")

    .replace(/[^a-z0-9]+/g, "-")

    .replace(/^-+|-+$/g, "");

}

function normalizeOptionId(value: unknown): string {

  return str(value).toUpperCase().replace(/[\s_-]/g, "");

}

function asDate(value: unknown): Date | null {

  if (value === null || value === undefined || value === "") {

    return null;

  }

  const date = value instanceof Date ? value : new Date(value as string);

  return Number.isFinite(date.getTime()) ? date : null;

}

function clampCounter(value: unknown): number {

  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.min(CONFIG.maxCounter, Math.floor(number)));

}

function mergeCounter(stored: unknown, submitted: unknown): number {

  return Math.max(clampCounter(stored), clampCounter(submitted));

}

function extractOptions(value: unknown): SafeOption[] {

  if (!Array.isArray(value)) return [];

  return value

    .map((item, index): SafeOption | null => {

      if (typeof item === "string") {

        const text = item.trim();

        return text

          ? { id: String.fromCharCode(65 + index), text }

          : null;

      }

      if (!isObject(item)) return null;

      const text = str(item.text ?? item.label ?? item.value);

      const id = str(

        item.optionId ?? item.id ?? String.fromCharCode(65 + index),

      );

      return text && id ? { id, text } : null;

    })

    .filter((item): item is SafeOption => item !== null)

    .slice(0, 4);

}

function optionLetter(value: unknown, options: SafeOption[]): string {

  const raw = str(value);

  if (!raw) return "";

  const normalizedId = normalizeOptionId(raw);

  const optionById = options.find(

    (option) => normalizeOptionId(option.id) === normalizedId,

  );

  if (optionById) {

    return String.fromCharCode(65 + options.indexOf(optionById));

  }

  if (/^[A-D]$/i.test(raw)) {

    return raw.toUpperCase();

  }

  const numeric = Number(raw);

  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 3) {

    return String.fromCharCode(65 + numeric);

  }

  const optionByText = options.find(

    (option) => normalizeText(option.text) === normalizeText(raw),

  );

  return optionByText

    ? String.fromCharCode(65 + options.indexOf(optionByText))

    : "";

}

function parseAnswers(

  body: JsonObject,

):

  | { ok: true; answers: IncomingAnswer[] }

  | { ok: false; message: string } {

  const raw = body.answers ?? body.responses ?? body.submissions;

  if (raw === undefined || raw === null) {

    return { ok: false, message: "Assessment answers are required." };

  }

  const answers: IncomingAnswer[] = [];

  const addAnswer = (questionIdValue: unknown, value: unknown) => {

    const questionId = str(questionIdValue);

    if (!questionId) return;

    const item = isObject(value) ? value : { answer: value };

    answers.push({

      questionId,

      answer: str(

        item.answer ??

          item.selectedOption ??

          item.selectedAnswer ??

          item.optionId ??

          item.value,

      ),

      code: str(item.code ?? item.answerCode),

      language: str(item.language),

    });

  };

  if (Array.isArray(raw)) {

    for (const item of raw) {

      if (!isObject(item)) {

        return { ok: false, message: "An answer entry is invalid." };

      }

      const submittedQuestionId = str(item.questionId ?? item.id);

      if (!submittedQuestionId) {

        return { ok: false, message: "An answer is missing its question ID." };

      }

      addAnswer(submittedQuestionId, item);

    }

  } else if (isObject(raw)) {

    for (const [questionId, value] of Object.entries(raw)) {

      addAnswer(questionId, value);

    }

  } else {

    return { ok: false, message: "Invalid assessment answer format." };

  }

  if (answers.length > CONFIG.maxAnswers) {

    return { ok: false, message: "Too many answers were submitted." };

  }

  const seen = new Set<string>();

  for (const answer of answers) {

    if (!answer.questionId) {

      return { ok: false, message: "An answer is missing its question ID." };

    }

    if (seen.has(answer.questionId)) {

      return { ok: false, message: "Duplicate answers were submitted." };

    }

    seen.add(answer.questionId);

    if (answer.answer.length > CONFIG.maxAnswerLength) {

      return { ok: false, message: "An answer exceeds the allowed size." };

    }

    if (answer.code.length > CONFIG.maxCodeLength) {

      return { ok: false, message: "A coding answer exceeds the allowed size." };

    }

    if (answer.language.length > 100) {

      return { ok: false, message: "The selected language is invalid." };

    }

  }

  return { ok: true, answers };

}

async function authenticateStudent(): Promise<string | null> {

  const cookieStore = await cookies();

  const token =

    cookieStore.get(STUDENT_AUTH_COOKIE_NAME)?.value ??

    cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = await verifyAccessToken(token);

  if (!payload) return null;

  const claims = payload as unknown as Record<string, unknown>;

  if (str(claims.role).toLowerCase() !== "student") {

    return null;

  }

  const sessionType = str(claims.sessionType).toLowerCase();

  if (sessionType === "admin" || sessionType === "student-dashboard") {

    return null;

  }

  const userId = str(claims.userId ?? claims.sub ?? claims.id);

  return mongoose.isValidObjectId(userId) ? userId : null;

}

function isActiveAttemptStatus(status: unknown): boolean {

  return ["in-progress", "coding-in-progress"].includes(str(status));

}

function isPendingEvaluationStatus(status: unknown): boolean {

  return ["submitted", "evaluating"].includes(str(status));

}

function isFinalStatus(status: unknown): boolean {

  return ["passed", "failed"].includes(str(status));

}

function getAttemptQuestions(attempt: any): Array<{

  questionId: string;

  section: string;

  order: number;

  marks: number;

  language: string;

  languages: string[];

}> {

  if (!Array.isArray(attempt.questions)) return [];

  return attempt.questions.map((question: any) => ({

    questionId: str(question.questionId),

    section: str(question.section),

    order: Number(question.order),

    marks: Number(question.marks),

    language: str(question.language),

    languages: Array.isArray(question.languages)

      ? question.languages.map(str).filter(Boolean)

      : [],

  }));

}

function buildResult(attempt: any): AssessmentResult {

  const status = str(attempt.status);

  const submittedAt = asDate(attempt.submittedAt)?.toISOString() ?? null;

  const pending = isPendingEvaluationStatus(status);

  const mcqScore = Number(attempt.mcqScore) || 0;

  const codingScore = pending ? null : Number(attempt.codingScore) || 0;

  const totalScore = pending ? null : Number(attempt.totalScore) || 0;

  const percentage = pending ? null : Number(attempt.percentage) || 0;

  return {

    attemptId: str(attempt.attemptId),

    status,

    mcqScore,

    codingScore,

    totalScore,

    percentage,

    passed: !pending && attempt.passed === true,

    submittedAt,

  };

}

async function syncStudentResult(

  studentId: string,

  attempt: any,

): Promise<boolean> {

  const now = new Date();

  const status = str(attempt.status);

  const pending = isPendingEvaluationStatus(status);

  const passed = isFinalStatus(status) && attempt.passed === true;

  const failed = isFinalStatus(status) && !passed;

  let update: Record<string, unknown>;

  if (pending) {

    update = {

      assessmentStatus: "submitted",

      assessmentSubmittedAt: asDate(attempt.submittedAt) ?? now,

      resultStatus: "pending",

      internshipApplicationAllowed: false,

      internshipStatus: "locked",

    };

  } else if (passed || failed) {

    update = {

      assessmentStatus: passed ? "passed" : "failed",

      assessmentScore: Number(attempt.totalScore) || 0,

      assessmentSubmittedAt: asDate(attempt.submittedAt) ?? now,

      assessmentEvaluatedAt: asDate(attempt.evaluatedAt) ?? now,

      resultDeclaredAt: asDate(attempt.resultDeclaredAt) ?? now,

      resultVisibleAt: now,

      resultStatus: passed ? "passed" : "failed",

      internshipApplicationAllowed: passed,

      internshipStatus: passed ? "available" : "locked",

    };

  } else {

    return false;

  }

  const result = await StudentModel.updateOne(

    {

      _id: new mongoose.Types.ObjectId(studentId),

      applicationStatus: "approved",

    },

    { $set: update },

  ).exec();

  return result.matchedCount === 1;

}

function pendingResponse(attempt: any): NextResponse {

  const mcqScore = Number(attempt.mcqScore) || 0;

  const questions = getAttemptQuestions(attempt);

  const codingQuestions = questions.filter((q) => q.section === "coding");

  const answers = Array.isArray(attempt.codingAnswers)

    ? attempt.codingAnswers

    : [];

  return respond(

    {

      success: true,

      message: "Assessment submitted. Coding answers are waiting for evaluation.",

      status: "evaluation-pending",

      data: {

        attemptId: str(attempt.attemptId),

        assessment: {

          totalQuestions: CONFIG.maxAnswers,

          totalMarks: CONFIG.totalMarks,

          passingMarks: CONFIG.passingMarks,

          mcqScore,

          codingScore: null,

          totalScore: null,

          percentage: null,

          result: "pending",

          passed: false,

          submittedAt: asDate(attempt.submittedAt)?.toISOString() ?? null,

          submissionLate: str(attempt.submittedBy) === "system",

        },

        sections: {

          mcq: {

            totalQuestions: CONFIG.mcqCount,

            score: mcqScore,

            totalMarks: CONFIG.mcqCount * CONFIG.mcqMarks,

          },

          coding: {

            totalQuestions: CONFIG.codingCount,

            answered: answers.filter((item: any) => str(item.code)).length,

            score: null,

            totalMarks: CONFIG.codingCount * CONFIG.codingMarks,

            status: "pending-evaluation",

            questions: codingQuestions.map((question) => ({

              questionId: question.questionId,

              order: question.order,

            })),

          },

        },

        eligibility: {

          assessmentPassed: false,

          internshipEligible: false,

          internshipSelectionUnlocked: false,

        },

        nextStep: "/student/dashboard",

      },

    },

    202,

  );

}

function finalResponse(attempt: any): NextResponse {

  const result = buildResult(attempt);

  const passed = result.passed;

  return respond({

    success: true,

    message: passed

      ? "Assessment submitted and passed."

      : "Assessment submitted. The required passing score was not reached.",

    status: passed ? "passed" : "failed",

    data: {

      attemptId: result.attemptId,

      assessment: {

        totalQuestions: CONFIG.maxAnswers,

        totalMarks: CONFIG.totalMarks,

        passingMarks: CONFIG.passingMarks,

        mcqScore: result.mcqScore,

        codingScore: result.codingScore,

        totalScore: result.totalScore,

        percentage: result.percentage,

        result: passed ? "passed" : "failed",

        passed,

        failed: !passed,

        submittedAt: result.submittedAt,

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

    // Browser cookie-authenticated POSTs must originate from this application origin.

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

      // If Origin is absent, require recognized Fetch Metadata; do not trust

      // missing or unknown context for a cookie-authenticated state change.

      const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();

      if (!["same-origin", "same-site", "none"].includes(fetchSite)) {

        return fail("Request origin could not be verified.", "ORIGIN_REQUIRED", 403);

      }

    }

    const contentType = request.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {

      return fail("Content-Type must be application/json.", "UNSUPPORTED_MEDIA_TYPE", 415);

    }

    const studentId = await authenticateStudent();

    if (!studentId) {

      return fail("Student authentication is required.", "AUTH_REQUIRED", 401);

    }

    let rawBody: string;

    try {

      rawBody = await request.text();

    } catch {

      return fail("Unable to read submission payload.", "INVALID_BODY", 400);

    }

    if (new TextEncoder().encode(rawBody).byteLength > CONFIG.maxBodyBytes) {

      return fail("Submission payload is too large.", "PAYLOAD_TOO_LARGE", 413);

    }

    let parsedBody: unknown;

    try {

      parsedBody = JSON.parse(rawBody);

    } catch {

      return fail("Request body must contain valid JSON.", "INVALID_JSON", 400);

    }

    if (!isObject(parsedBody)) {

      return fail("Invalid request body.", "INVALID_JSON", 400);

    }

    const body = parsedBody;

    const parsed = parseAnswers(body);

    if (parsed.ok === false) {

      return fail(parsed.message, "INVALID_ANSWERS", 400);

    }

    const attemptId = str(body.attemptId);

    if (!attemptId || attemptId.length > 128 || /[\u0000-\u001f\u007f]/.test(attemptId)) {

      return fail("A valid attemptId is required.", "INVALID_ATTEMPT_ID", 400);

    }

    await connectDB();

    const AttemptModel = await getAssessmentAttemptModel();

    const student = await StudentModel.findById(studentId)

      .select(

        [

          "_id",

          "applicationStatus",

          "loginEnabled",

          "accountLocked",

          "lockedUntil",

          "journeyExpired",

          "journeyExpiresAt",

          "assessmentStatus",

          "internshipTrack",

        ].join(" "),

      )

      .lean()

      .exec();

    if (!student) {

      return fail("Student account was not found.", "STUDENT_NOT_FOUND", 404);

    }

    if (student.loginEnabled !== true) {

      return fail("Student login is disabled.", "LOGIN_DISABLED", 403);

    }

    if (student.accountLocked === true) {

      const lockedUntil = asDate(student.lockedUntil);

      if (!lockedUntil || lockedUntil.getTime() > Date.now()) {

        return fail("Your account is temporarily locked.", "ACCOUNT_LOCKED", 423);

      }

    }

    if (student.journeyExpired === true) {

      return fail("Your internship journey has expired.", "JOURNEY_EXPIRED", 403);

    }

    const journeyExpiresAt = asDate(student.journeyExpiresAt);

    if (journeyExpiresAt && journeyExpiresAt.getTime() <= Date.now()) {

      return fail("Your internship journey has expired.", "JOURNEY_EXPIRED", 403);

    }

    if (str(student.applicationStatus).toLowerCase() !== "approved") {

      return fail(

        "Your application must be approved before submitting the assessment.",

        "APPLICATION_NOT_APPROVED",

        403,

      );

    }

    const studentRecord = student as unknown as Record<string, unknown>;

    if (studentRecord.emailVerified === false || studentRecord.isEmailVerified === false) {

      return fail("Verify your email address before submitting the assessment.", "EMAIL_NOT_VERIFIED", 403);

    }

    let attempt = await AttemptModel.findOne({

      attemptId,

      studentId: new mongoose.Types.ObjectId(studentId),

    }).exec();

    if (!attempt) {

      return fail("Assessment attempt was not found.", "ATTEMPT_NOT_FOUND", 404);

    }

    if (String(attempt.studentId) !== studentId) {

      return fail("You cannot submit this assessment attempt.", "ACCESS_DENIED", 403);

    }

    if (

      isPendingEvaluationStatus(attempt.status) ||

      isFinalStatus(attempt.status)

    ) {

      const synced = await syncStudentResult(studentId, attempt);

      if (!synced) {

        console.error("[ASSESSMENT_SUBMIT_RECOVERY_SYNC_FAILED]", {

          studentId,

          attemptId,

          status: attempt.status,

        });

        return fail(

          "The submission exists, but student status synchronization needs administrator review.",

          "STUDENT_STATE_SYNC_FAILED",

          503,

        );

      }

      return isPendingEvaluationStatus(attempt.status)

        ? pendingResponse(attempt)

        : finalResponse(attempt);

    }

    if (["expired", "cancelled"].includes(str(attempt.status))) {

      return fail(

        "This assessment attempt has expired or been cancelled.",

        "ATTEMPT_NOT_ACTIVE",

        409,

      );

    }

    if (!isActiveAttemptStatus(attempt.status)) {

      return fail(

        "This assessment attempt cannot be submitted.",

        "ATTEMPT_NOT_SUBMITTABLE",

        409,

      );

    }

    const questions = getAttemptQuestions(attempt);

    const mcqQuestions = questions.filter((q) => q.section === "mcq");

    const codingQuestions = questions.filter((q) => q.section === "coding");

    if (

      questions.length !== CONFIG.maxAnswers ||

      mcqQuestions.length !== CONFIG.mcqCount ||

      codingQuestions.length !== CONFIG.codingCount

    ) {

      return fail(

        "The saved assessment question snapshot is invalid. Contact the administrator.",

        "INVALID_QUESTION_SNAPSHOT",

        500,

      );

    }

    const questionIds = new Set<string>();

    for (const question of questions) {

      if (!question.questionId || questionIds.has(question.questionId)) {

        return fail(

          "The attempt contains missing or duplicate question IDs.",

          "INVALID_QUESTION_IDS",

          500,

        );

      }

      questionIds.add(question.questionId);

    }

    const answerMap = new Map(

      parsed.answers.map((answer) => [answer.questionId, answer]),

    );

    for (const answer of parsed.answers) {

      if (!questionIds.has(answer.questionId)) {

        return fail(

          "A submitted question does not belong to this attempt.",

          "QUESTION_NOT_IN_ATTEMPT",

          400,

        );

      }

    }

    const startedAt = asDate(attempt.startedAt);

    const finalDeadline = asDate(attempt.finalDeadline);

    if (!startedAt || !finalDeadline || finalDeadline <= startedAt) {

      return fail("Assessment timing data is invalid.", "INVALID_TIMING", 500);

    }

    const now = new Date();

    const submissionLate = now.getTime() > finalDeadline.getTime();

    const submissionGraceMs = 30_000;

    if (now.getTime() > finalDeadline.getTime() + submissionGraceMs) {

      return fail(

        "The assessment deadline has passed. This attempt can no longer be submitted.",

        "ASSESSMENT_DEADLINE_PASSED",

        409,

      );

    }

    const storedAssessmentId = str(attempt.assessmentId);

    const assessmentLookup: Record<string, unknown> = {

      status: "published",

      isActive: true,

      ...(mongoose.isValidObjectId(storedAssessmentId)

        ? { $or: [{ assessmentId: storedAssessmentId }, { _id: new mongoose.Types.ObjectId(storedAssessmentId) }] }

        : { assessmentId: storedAssessmentId }),

    };

    const assessment = await AssessmentModel.findOne(assessmentLookup as any)

      .select("_id assessmentId domain domainKey status isActive")

      .lean()

      .exec();

    if (!assessment) {

      return fail(

        "The assessment is no longer published or active.",

        "ASSESSMENT_NOT_ACTIVE",

        409,

      );

    }

    const assessmentDomain = normalizeDomain(

      assessment.domainKey || assessment.domain,

    );

    const attemptDomain = normalizeDomain(attempt.domain);

    const studentDomain = normalizeDomain(student.internshipTrack);

    const attemptTrack = normalizeDomain(attempt.internshipTrack);

    if (!assessmentDomain || !attemptDomain || assessmentDomain !== attemptDomain) {

      return fail(

        "The attempt domain does not match the published assessment.",

        "ASSESSMENT_DOMAIN_MISMATCH",

        409,

      );

    }

    if (!studentDomain || !attemptTrack || studentDomain !== attemptTrack) {

      return fail(

        "This assessment does not match your assigned internship domain.",

        "STUDENT_DOMAIN_MISMATCH",

        403,

      );

    }

    const questionAssessmentIds: unknown[] = [assessment._id];

    if (mongoose.isValidObjectId(String(assessment._id))) {

      questionAssessmentIds.push(String(assessment._id));

    }

    const mcqQuestionFilter: Record<string, unknown> = {

      questionId: { $in: mcqQuestions.map((question) => question.questionId) },

      assessmentId: { $in: questionAssessmentIds },

      section: "mcq",

      type: "mcq",

      status: "published",

      isActive: true,

    };

    if (str(assessment.domainKey)) {

      mcqQuestionFilter.$or = [

        { domainKey: assessment.domainKey },

        { domainKey: { $exists: false } },

        { domainKey: "" },

      ];

    }

    const mcqSourceDocuments = await QuestionModel.find(mcqQuestionFilter as any)

      .select(

        "+correctOption questionId assessmentId domain domainKey options correctOption status isActive",

      )

      .lean()

      .exec();

    const sourceMap = new Map<string, any>();

    for (const source of mcqSourceDocuments as any[]) {

      sourceMap.set(str(source.questionId), source);

    }

    if (sourceMap.size !== CONFIG.mcqCount) {

      return fail(

        "Published MCQ data changed or is incomplete. Contact the administrator.",

        "MCQ_BANK_INVALID",

        503,

      );

    }

    let mcqScore = 0;

    let answeredMcq = 0;

    let correctMcq = 0;

    const mcqAnswers: Array<{

      questionId: string;

      answer: string;

      answeredAt: Date;

      marksAwarded: number;

    }> = [];

    const mcqResults: Array<{

      questionId: string;

      answered: boolean;

      correct: boolean;

      marks: number;

    }> = [];

    for (const question of mcqQuestions) {

      const source = sourceMap.get(question.questionId);

      if (!source) {

        return fail("An MCQ is no longer available.", "MCQ_NOT_FOUND", 503);

      }

      if (

        normalizeDomain(source.domainKey || source.domain) !== assessmentDomain

      ) {

        return fail(

          "An MCQ does not match the assessment domain.",

          "QUESTION_DOMAIN_MISMATCH",

          503,

        );

      }

      const options = extractOptions(source.options);

      if (options.length !== 4) {

        return fail(

          "An MCQ does not have four valid options.",

          "INVALID_MCQ_OPTIONS",

          503,

        );

      }

      const correctOption = optionLetter(source.correctOption, options);

      if (!correctOption) {

        return fail(

          "An MCQ has no valid answer key.",

          "MCQ_ANSWER_KEY_MISSING",

          503,

        );

      }

      const submitted = answerMap.get(question.questionId);

      const rawAnswer = str(submitted?.answer);

      const answered = Boolean(rawAnswer);

      const selected = answered ? optionLetter(rawAnswer, options) : "";

      if (answered && !selected) {

        return fail(

          "An MCQ answer does not match any available option.",

          "INVALID_MCQ_ANSWER",

          400,

        );

      }

      const correct = answered && selected === correctOption;

      const marks = correct ? CONFIG.mcqMarks : 0;

      if (answered) {

        answeredMcq += 1;

        mcqAnswers.push({

          questionId: question.questionId,

          answer: selected,

          answeredAt: now,

          marksAwarded: marks,

        });

      }

      if (correct) {

        correctMcq += 1;

        mcqScore += marks;

      }

      mcqResults.push({

        questionId: question.questionId,

        answered,

        correct,

        marks,

      });

    }

    let answeredCoding = 0;

    const codingAnswers: Array<{

      questionId: string;

      language: string;

      code: string;

      submittedAt: Date;

      status: "evaluating";

      marksAwarded: number;

    }> = [];

    const codingResults: Array<{

      questionId: string;

      answered: boolean;

      language: string;

      status: "not-attempted" | "pending-evaluation";

    }> = [];

    for (const question of codingQuestions) {

      const submitted = answerMap.get(question.questionId);

      const code = str(submitted?.code || submitted?.answer);

      const language = str(submitted?.language || question.language);

      const answered = code.length > 0;

      if (answered) {

        if (!language) {

          return fail(

            `Programming language is required for coding question ${question.order}.`,

            "CODING_LANGUAGE_REQUIRED",

            400,

          );

        }

        if (

          question.languages.length > 0 &&

          !question.languages.some(

            (supported) => normalizeText(supported) === normalizeText(language),

          )

        ) {

          return fail(

            `The selected language is not supported for coding question ${question.order}.`,

            "CODING_LANGUAGE_NOT_ALLOWED",

            400,

          );

        }

        answeredCoding += 1;

        codingAnswers.push({

          questionId: question.questionId,

          language,

          code,

          submittedAt: now,

          status: "evaluating",

          marksAwarded: 0,

        });

      }

      codingResults.push({

        questionId: question.questionId,

        answered,

        language,

        status: answered ? "pending-evaluation" : "not-attempted",

      });

    }

    const codingNeedsEvaluation = answeredCoding > 0;

    const codingScore = 0;

    const canFinalize = !codingNeedsEvaluation;

    const totalScore = mcqScore + codingScore;

    const percentage = Number(

      ((totalScore / CONFIG.totalMarks) * 100).toFixed(2),

    );

    const passed = canFinalize && totalScore >= CONFIG.passingMarks;

    const nextStatus = codingNeedsEvaluation

      ? "evaluating"

      : passed

        ? "passed"

        : "failed";

    const counters = {

      tabSwitches: mergeCounter(attempt.tabSwitches, body.tabSwitches),

      fullscreenExitCount: mergeCounter(

        attempt.fullscreenExitCount,

        body.fullscreenExitCount,

      ),

      copyAttempts: mergeCounter(attempt.copyAttempts, body.copyAttempts),

      pasteAttempts: mergeCounter(attempt.pasteAttempts, body.pasteAttempts),

      shortcutAttempts: mergeCounter(

        attempt.shortcutAttempts,

        body.shortcutAttempts,

      ),

    };

    const claimed = await AttemptModel.findOneAndUpdate(

      {

        _id: attempt._id,

        studentId: new mongoose.Types.ObjectId(studentId),

        attemptId,

        status: { $in: ["in-progress", "coding-in-progress"] },

      },

      {

        $set: {

          status: nextStatus,

          currentPhase: "completed",

          mcqAnswers,

          codingAnswers,

          mcqScore,

          codingScore,

          totalScore: canFinalize ? totalScore : 0,

          percentage: canFinalize ? percentage : 0,

          passingMarks: CONFIG.passingMarks,

          passed: canFinalize ? passed : false,

          submittedAt: now,

          submittedBy: submissionLate ? "system" : "student",

          lastActivityAt: now,

          ...counters,

          ...(canFinalize

            ? {

                evaluatedAt: now,

                resultDeclaredAt: now,

              }

            : {

                evaluationStartedAt: now,

              }),

        },

      },

      {

        new: true,

        runValidators: true,

      },

    )

      .lean()

      .exec();

    if (!claimed) {

      // Another tab/request may have won the atomic submission race

      // Re-read the persisted attempt and return its actual saved state

      const persistedAttempt = await AttemptModel.findOne({

        attemptId,

        studentId: new mongoose.Types.ObjectId(studentId),

      })

        .lean()

        .exec();

      if (

        persistedAttempt &&

        (isPendingEvaluationStatus(persistedAttempt.status) ||

          isFinalStatus(persistedAttempt.status))

      ) {

        const recoveredSync = await syncStudentResult(studentId, persistedAttempt);

        if (!recoveredSync) {

          console.error("[ASSESSMENT_SUBMIT_RACE_RECOVERY_SYNC_FAILED]", {

            studentId,

            attemptId,

            status: persistedAttempt.status,

          });

          return fail(

            "Your submission is saved, but account status synchronization needs administrator review.",

            "STUDENT_STATE_SYNC_FAILED",

            503,

          );

        }

        return isPendingEvaluationStatus(persistedAttempt.status)

          ? pendingResponse(persistedAttempt)

          : finalResponse(persistedAttempt);

      }

      return fail(

        "This assessment attempt is no longer active. Refresh the page to check its saved status.",

        "SUBMISSION_ALREADY_PROCESSED",

        409,

      );

    }

    const synced = await syncStudentResult(studentId, claimed);

    if (!synced) {

      console.error("[ASSESSMENT_SUBMIT_STUDENT_SYNC_FAILED]", {

        studentId,

        attemptId,

        status: claimed.status,

      });

      return fail(

        "Submission was recorded, but student status synchronization needs administrator review. Retry safely or contact support.",

        "STUDENT_STATE_SYNC_FAILED",

        503,

      );

    }

    if (codingNeedsEvaluation) {

      return pendingResponse(claimed);

    }

    return finalResponse(claimed);

  } catch (error) {

    console.error("[ASSESSMENT_SUBMIT_ERROR]", error);

    if (error instanceof mongoose.Error.ValidationError) {

      return fail(

        "Assessment submission failed database validation.",

        "VALIDATION_ERROR",

        400,

      );

    }

    if (error instanceof mongoose.Error.CastError) {

      return fail(

        "Invalid database identifier or value.",

        "INVALID_DATABASE_VALUE",

        400,

      );

    }

    return fail(

      "Unable to submit the assessment right now. Please try again.",

      "ASSESSMENT_SUBMIT_FAILED",

      500,

    );

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

  return fail(

    "Assessment submissions cannot be deleted.",

    "METHOD_NOT_ALLOWED",

    405,

  );

}

export async function OPTIONS(): Promise<NextResponse> {

  return new NextResponse(null, {

    status: 204,

    headers: {

      Allow: "POST, OPTIONS",

      "Cache-Control": "no-store",

      "X-Content-Type-Options": "nosniff",

    },

  });

}

export async function HEAD(): Promise<NextResponse> {

  return new NextResponse(null, {

    status: 405,

    headers: {

      Allow: "POST, OPTIONS",

      "Cache-Control": "no-store",

      "X-Content-Type-Options": "nosniff",

    },

  });

}
