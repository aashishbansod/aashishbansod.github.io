import "server-only";

import { createHash, randomInt, randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  STUDENT_AUTH_COOKIE_NAME,
  verifyAuthToken,
} from "@/lib/auth";
import Assessment, {
  ASSESSMENT_CONFIG,
  normalizeAssessmentDomain,
} from "@/models/Assessment";
import Question from "@/models/Question";
import StudentModel from "@/models/Student";
import getAssessmentAttemptModel, {
  type AttemptQuestion,
  type MCQAnswer,
} from "@/models/AssessmentAttempt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIG = Object.freeze({
  questionCount: ASSESSMENT_CONFIG.totalQuestions,
  questionsPerDifficulty: ASSESSMENT_CONFIG.sections.easy.questionCount,
  marksPerQuestion: ASSESSMENT_CONFIG.marksPerQuestion,
  totalMarks: ASSESSMENT_CONFIG.totalMarks,
  passingMarks: ASSESSMENT_CONFIG.passingMarks,
  passingPercentage: ASSESSMENT_CONFIG.passingScore,
  durationMinutes: ASSESSMENT_CONFIG.totalDurationMinutes,
  durationMilliseconds: ASSESSMENT_CONFIG.totalDurationMinutes * 60 * 1000,
  maximumBodyBytes: 48 * 1024,
});

const ACTIVE_STATUSES = ["in-progress", "coding-in-progress", "submitted", "evaluating"] as const;

type AnyRecord = Record<string, unknown>;
type AnswerInput = { questionId: string; answer: string };
type StudentContext = {
  id: Types.ObjectId;
  record: AnyRecord;
};

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum = 500): string {
  if (value instanceof Types.ObjectId) return value.toString().slice(0, maximum);
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).normalize("NFKC").trim().slice(0, maximum);
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function response(
  body: AnyRecord,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie, Origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}

function success(data: AnyRecord, message = "Success.", status = 200): NextResponse {
  return response({ success: true, message, data }, status);
}

function failure(message: string, code: string, status: number): NextResponse {
  return response(
    {
      success: false,
      message,
      code,
      error: { code, message },
    },
    status,
  );
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function normalizeAnswerInput(value: unknown):
  | { valid: true; answers: AnswerInput[] }
  | { valid: false; message: string } {
  if (!Array.isArray(value)) {
    return { valid: false, message: "Answers must be provided as an array." };
  }

  if (value.length > CONFIG.questionCount) {
    return { valid: false, message: "Too many answers were submitted." };
  }

  const answers: AnswerInput[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry)) {
      return { valid: false, message: "An answer entry is invalid." };
    }

    const questionId = text(entry.questionId, 256);
    const answer = text(entry.answer, 5).toUpperCase();

    if (!questionId || !["A", "B", "C", "D"].includes(answer)) {
      return { valid: false, message: "Each answer must contain a valid question ID and option A, B, C or D." };
    }

    if (seen.has(questionId)) {
      return { valid: false, message: "Duplicate answers for the same question are not allowed." };
    }

    seen.add(questionId);
    answers.push({ questionId, answer });
  }

  return { valid: true, answers };
}

function serializeAttempt(attempt: AnyRecord): AnyRecord {
  const questions = Array.isArray(attempt.questions)
    ? attempt.questions.map((entry: unknown) => {
        const question = isRecord(entry) ? entry : {};
        return {
          questionId: text(question.questionId, 256),
          section: "mcq",
          difficulty: text(question.difficulty, 20).toLowerCase(),
          order: Number(question.order) || 0,
          marks: CONFIG.marksPerQuestion,
          question: text(question.question, 20_000),
          options: Array.isArray(question.options)
            ? question.options.map((option) => text(option, 5000))
            : [],
        };
      })
    : [];

  const answers = Array.isArray(attempt.mcqAnswers)
    ? attempt.mcqAnswers.map((entry: unknown) => {
        const answer = isRecord(entry) ? entry : {};
        return {
          questionId: text(answer.questionId, 256),
          answer: text(answer.answer, 5).toUpperCase(),
        };
      })
    : [];

  return {
    attemptId: text(attempt.attemptId, 100),
    status: text(attempt.status, 40),
    questions,
    answers,
    deadline: safeDate(attempt.finalDeadline)?.toISOString() ?? "",
    startedAt: safeDate(attempt.startedAt)?.toISOString() ?? "",
  };
}

function serializeAssessment(assessment: AnyRecord): AnyRecord {
  return {
    id: text(assessment._id, 100),
    assessmentId: text(assessment.assessmentId, 100),
    title: text(assessment.title, 160),
    domain: text(assessment.domain, 120),
    questionCount: CONFIG.questionCount,
    totalMarks: CONFIG.totalMarks,
    durationMinutes: CONFIG.durationMinutes,
    passingPercentage: CONFIG.passingPercentage,
    passingMarks: CONFIG.passingMarks,
  };
}

function serializeResult(attempt: AnyRecord): AnyRecord {
  const score = Number.isFinite(Number(attempt.totalScore))
    ? Number(attempt.totalScore)
    : 0;
  const percentage = Number.isFinite(Number(attempt.percentage))
    ? Number(attempt.percentage)
    : Math.round((score / CONFIG.totalMarks) * 10000) / 100;
  const passed = attempt.status === "passed" || attempt.passed === true;

  return {
    status: text(attempt.status, 40),
    score,
    percentage,
    passed,
    message: passed
      ? "Congratulations! You have passed the assessment."
      : "Your assessment has been evaluated. Please check your dashboard for the next steps.",
  };
}

async function getStudentContext(request: NextRequest): Promise<
  | { valid: true; student: StudentContext }
  | { valid: false; response: NextResponse }
> {
  const token = request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return {
      valid: false,
      response: failure("Student login is required.", "UNAUTHORIZED", 401),
    };
  }

  const user = await verifyAuthToken(token);
  if (!user || user.role !== "student" || user.sessionType !== "student") {
    return {
      valid: false,
      response: failure("A valid student portal session is required.", "INVALID_STUDENT_SESSION", 401),
    };
  }

  if (!mongoose.isValidObjectId(user.id)) {
    return {
      valid: false,
      response: failure("The student session is invalid.", "INVALID_STUDENT_ID", 401),
    };
  }

  await connectDB();

  const student = await StudentModel.findById(user.id)
    .select(
      "_id fullName email studentId loginEnabled accountLocked lockedUntil credentialsExpiresAt journeyExpired journeyExpiresAt applicationStatus adminApprovalStatus assessmentStatus assessmentScore assessmentStartedAt assessmentSubmittedAt assessmentEvaluatedAt resultDeclaredAt resultVisibleAt resultStatus internshipApplicationAllowed internshipTrack",
    )
    .lean()
    .exec() as unknown as AnyRecord | null;

  if (!student) {
    return {
      valid: false,
      response: failure("Student account was not found.", "STUDENT_NOT_FOUND", 404),
    };
  }

  const now = new Date();
  const credentialExpiry = safeDate(student.credentialsExpiresAt);
  const journeyExpiry = safeDate(student.journeyExpiresAt);

  if (student.loginEnabled !== true) {
    return {
      valid: false,
      response: failure("Your student account is not enabled. Contact the administration team.", "STUDENT_LOGIN_DISABLED", 403),
    };
  }

  if (student.adminApprovalStatus !== "approved" || student.applicationStatus !== "approved") {
    return {
      valid: false,
      response: failure("Your application must be approved before starting the assessment.", "APPLICATION_NOT_APPROVED", 403),
    };
  }

  if (student.accountLocked === true && (!safeDate(student.lockedUntil) || (safeDate(student.lockedUntil) as Date) > now)) {
    return {
      valid: false,
      response: failure("Your student account is temporarily locked. Contact support.", "STUDENT_ACCOUNT_LOCKED", 403),
    };
  }

  if (credentialExpiry && credentialExpiry <= now) {
    return {
      valid: false,
      response: failure("Your student credentials have expired. Contact support.", "STUDENT_CREDENTIALS_EXPIRED", 403),
    };
  }

  if (student.journeyExpired === true || (journeyExpiry && journeyExpiry <= now)) {
    return {
      valid: false,
      response: failure("Your application journey has expired.", "STUDENT_JOURNEY_EXPIRED", 403),
    };
  }

  return {
    valid: true,
    student: {
      id: new Types.ObjectId(user.id),
      record: student,
    },
  };
}

function getStudentDomain(student: AnyRecord): string {
  return text(student.internshipTrack, 150);
}

function getDomainMatchCandidates(track: string): { keys: string[]; labels: string[] } {
  const suffixPattern = /\s+(?:developer|development|engineer|engineering)$/i;
  const labels = new Set<string>();
  let current = track.trim();

  while (current) {
    labels.add(current);
    const shortened = current.replace(suffixPattern, "").trim();
    if (shortened === current) break;
    current = shortened;
  }

  const keys = new Set<string>();
  for (const label of labels) {
    const key = normalizeAssessmentDomain(label);
    if (key) keys.add(key);
  }

  return { keys: [...keys], labels: [...labels] };
}

async function findAssessmentForStudent(student: AnyRecord): Promise<AnyRecord | null> {
  const track = getStudentDomain(student);
  if (!track) return null;

  const candidates = getDomainMatchCandidates(track);
  if (candidates.keys.length === 0 || candidates.labels.length === 0) return null;

  const domainPatterns = candidates.labels.map((label) => ({
    domain: {
      $regex: `^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  }));

  const assessment = await Assessment.findOne({
    $and: [
      {
        $or: [
          { domainKey: { $in: candidates.keys } },
          ...domainPatterns,
        ],
      },
      {
        status: "published",
        isActive: true,
        isSelectable: true,
      },
    ],
  })
    .select("_id assessmentId title domain domainKey status isActive isSelectable totalQuestions totalMarks totalDurationMinutes passingScore passingMarks version updatedAt createdAt")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean()
    .exec();

  return assessment as unknown as AnyRecord | null;
}

async function getActiveAttempt(studentId: Types.ObjectId): Promise<AnyRecord | null> {
  const Attempt = await getAssessmentAttemptModel();
  const attempt = await Attempt.findOne({
    studentId,
    status: { $in: [...ACTIVE_STATUSES] },
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return attempt as unknown as AnyRecord | null;
}

async function createAttempt(
  student: StudentContext,
  assessment: AnyRecord,
  request: NextRequest,
): Promise<AnyRecord> {
  const assessmentObjectId = new Types.ObjectId(String(assessment._id));
  const questionDocuments = await Question.find({
    assessmentId: assessmentObjectId,
    status: "published",
    isActive: true,
    type: "mcq",
  })
    .select("questionId section difficulty question options marks negativeMarks")
    .lean()
    .exec() as unknown as AnyRecord[];

  const selected: AnyRecord[] = [];
  const difficultyCounts = { easy: 0, medium: 0, hard: 0 };

  for (const difficulty of ["easy", "medium", "hard"] as const) {
    const candidates = questionDocuments.filter((question) => {
      const section = text(question.section, 20).toLowerCase();
      const questionDifficulty = text(question.difficulty, 20).toLowerCase();
      const effectiveDifficulty = questionDifficulty || section;
      const options = Array.isArray(question.options) ? question.options : [];

      return (
        (section === difficulty || !section) &&
        effectiveDifficulty === difficulty &&
        Number(question.marks) === CONFIG.marksPerQuestion &&
        Number(question.negativeMarks) === 0 &&
        text(question.question, 20_000).length >= 5 &&
        options.length === 4 &&
        new Set(options.filter(isRecord).map((option) => text(option.optionId, 5).toUpperCase())).size === 4 &&
        ["A", "B", "C", "D"].every((optionId) => options.some((option) => isRecord(option) && text(option.optionId, 5).toUpperCase() === optionId && text(option.text, 5000).length > 0))
      );
    });

    if (candidates.length < CONFIG.questionsPerDifficulty) {
      throw new Error(`ASSESSMENT_QUESTION_BANK_INCOMPLETE:${difficulty}:${candidates.length}`);
    }

    const chosen = shuffle(candidates).slice(0, CONFIG.questionsPerDifficulty);
    selected.push(...chosen);
    difficultyCounts[difficulty] = chosen.length;
  }

  if (
    selected.length !== CONFIG.questionCount ||
    difficultyCounts.easy !== CONFIG.questionsPerDifficulty ||
    difficultyCounts.medium !== CONFIG.questionsPerDifficulty ||
    difficultyCounts.hard !== CONFIG.questionsPerDifficulty
  ) {
    throw new Error("ASSESSMENT_QUESTION_BANK_INVALID");
  }

  const orderedQuestions: AttemptQuestion[] = shuffle(selected).map((question, index) => {
    const options = (question.options as AnyRecord[])
      .map((option) => ({
        optionId: text(option.optionId, 5).toUpperCase(),
        text: text(option.text, 5000),
      }))
      .sort((left, right) => left.optionId.localeCompare(right.optionId));

    const optionIds = options.map((option) => option.optionId);
    if (
      options.length !== 4 ||
      new Set(optionIds).size !== 4 ||
      ["A", "B", "C", "D"].some((id) => !optionIds.includes(id)) ||
      options.some((option) => !option.text)
    ) {
      throw new Error("ASSESSMENT_QUESTION_OPTIONS_INVALID");
    }

    return {
      questionId: text(question.questionId, 256),
      section: "mcq",
      difficulty: (text(question.difficulty, 20).toLowerCase() || text(question.section, 20).toLowerCase()) as AttemptQuestion["difficulty"],
      order: index + 1,
      marks: CONFIG.marksPerQuestion,
      question: text(question.question, 20_000),
      options: options.map((option) => option.text),
    };
  });

  const questionIds = orderedQuestions.map((question) => question.questionId);
  if (questionIds.some((id) => !id) || new Set(questionIds).size !== CONFIG.questionCount) {
    throw new Error("ASSESSMENT_QUESTION_IDS_INVALID");
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + CONFIG.durationMilliseconds);
  const Attempt = await getAssessmentAttemptModel();
  const forwardedFor = text(request.headers.get("x-forwarded-for"), 500).split(",")[0].trim();
  const userAgent = text(request.headers.get("user-agent"), 1000);
  const ipHash = forwardedFor
    ? createHash("sha256").update(forwardedFor).digest("hex")
    : undefined;

  const attempt = await Attempt.create({
    attemptId: randomUUID(),
    studentId: student.id,
    assessmentId: String(assessment._id),
    domain: text(assessment.domain, 200),
    internshipTrack: text(student.record.internshipTrack, 200) || text(assessment.domain, 200),
    status: "in-progress",
    currentPhase: "mcq",
    questions: orderedQuestions,
    startedAt: now,
    mcqStartedAt: now,
    mcqDeadline: deadline,
    finalDeadline: deadline,
    mcqAnswers: [],
    codingAnswers: [],
    mcqScore: 0,
    codingScore: 0,
    totalScore: 0,
    percentage: 0,
    passingMarks: CONFIG.passingMarks,
    passed: false,
    tabSwitches: 0,
    fullscreenExitCount: 0,
    copyAttempts: 0,
    pasteAttempts: 0,
    shortcutAttempts: 0,
    lastActivityAt: now,
    questionBankVersion: String(assessment.version ?? "1"),
    ...(ipHash ? { ipHash } : {}),
    ...(userAgent ? { userAgent } : {}),
  });

  const studentUpdate = await StudentModel.updateOne(
    {
      _id: student.id,
      loginEnabled: true,
      adminApprovalStatus: "approved",
      applicationStatus: "approved",
      assessmentStatus: { $in: ["not-started", "scheduled", "in-progress"] },
    },
    {
      $set: {
        assessmentStatus: "in-progress",
        assessmentStartedAt: student.record.assessmentStartedAt ?? now,
      },
    },
  ).exec();

  if (Number(studentUpdate.matchedCount ?? 0) !== 1) {
    await Attempt.deleteOne({
      __id: attempt._id,
      studentId: student.id,
      status: "in-progress",
    }).exec();
    throw new Error("ASSESSMENT_STUDENT_STATE_CONFLICT");
  }

  return attempt.toObject() as unknown as AnyRecord;
}

function parseAnswersForAttempt(
  rawAnswers: unknown,
  attempt: AnyRecord,
): { valid: true; answers: AnswerInput[] } | { valid: false; message: string } {
  const normalized = normalizeAnswerInput(rawAnswers);
  if (!normalized.valid) return normalized;

  const questionIds = new Set(
    (Array.isArray(attempt.questions) ? attempt.questions : []).map((question: unknown) =>
      isRecord(question) ? text(question.questionId, 256) : "",
    ),
  );

  for (const answer of normalized.answers) {
    if (!questionIds.has(answer.questionId)) {
      return { valid: false, message: "An answer references a question outside this assessment attempt." };
    }
  }

  return normalized;
}

function mergeAnswers(
  existing: unknown,
  incoming: AnswerInput[],
): AnswerInput[] {
  const merged = new Map<string, string>();

  if (Array.isArray(existing)) {
    for (const entry of existing) {
      if (!isRecord(entry)) continue;
      const questionId = text(entry.questionId, 256);
      const answer = text(entry.answer, 5).toUpperCase();
      if (questionId && ["A", "B", "C", "D"].includes(answer)) {
        merged.set(questionId, answer);
      }
    }
  }

  for (const answer of incoming) merged.set(answer.questionId, answer.answer);

  return [...merged.entries()].map(([questionId, answer]) => ({ questionId, answer }));
}

async function finalizeAttempt(
  attempt: AnyRecord,
  studentId: Types.ObjectId,
  incomingAnswers?: AnswerInput[],
  submittedBy: "student" | "system" = "student",
): Promise<AnyRecord> {
  const Attempt = await getAssessmentAttemptModel();
  const mergedAnswers = mergeAnswers(attempt.mcqAnswers, incomingAnswers ?? []);
  const attemptQuestions = Array.isArray(attempt.questions) ? attempt.questions : [];
  const questionIds = attemptQuestions.map((question: unknown) =>
    isRecord(question) ? text(question.questionId, 256) : "",
  );

  if (
    questionIds.length !== CONFIG.questionCount ||
    questionIds.some((id) => !id) ||
    new Set(questionIds).size !== CONFIG.questionCount
  ) {
    throw new Error("ASSESSMENT_ATTEMPT_QUESTION_SNAPSHOT_INVALID");
  }

  const snapshotCounts = { easy: 0, medium: 0, hard: 0 };
  for (const entry of attemptQuestions) {
    if (!isRecord(entry)) throw new Error("ASSESSMENT_ATTEMPT_QUESTION_SNAPSHOT_INVALID");
    const difficulty = text(entry.difficulty, 20).toLowerCase();
    if (!(difficulty in snapshotCounts) || text(entry.section, 20) !== "mcq" || Number(entry.marks) !== CONFIG.marksPerQuestion) {
      throw new Error("ASSESSMENT_ATTEMPT_QUESTION_SNAPSHOT_INVALID");
    }
    snapshotCounts[difficulty as keyof typeof snapshotCounts] += 1;
  }
  if (
    snapshotCounts.easy !== CONFIG.questionsPerDifficulty ||
    snapshotCounts.medium !== CONFIG.questionsPerDifficulty ||
    snapshotCounts.hard !== CONFIG.questionsPerDifficulty
  ) {
    throw new Error("ASSESSMENT_ATTEMPT_QUESTION_SNAPSHOT_INVALID");
  }

  const assessmentId = text(attempt.assessmentId, 100);
  if (!mongoose.isValidObjectId(assessmentId)) {
    throw new Error("ASSESSMENT_ATTEMPT_ASSESSMENT_ID_INVALID");
  }

  const questionDocuments = await Question.find({
    assessmentId: new Types.ObjectId(assessmentId),
    questionId: { $in: questionIds },
  })
    .select("+correctOption questionId")
    .lean()
    .exec() as unknown as AnyRecord[];

  if (questionDocuments.length !== CONFIG.questionCount) {
    throw new Error("ASSESSMENT_ANSWER_KEY_UNAVAILABLE");
  }

  const answerKey = new Map<string, string>();
  for (const question of questionDocuments) {
    const questionId = text(question.questionId, 256);
    const correctOption = text(question.correctOption, 5).toUpperCase();
    if (!questionId || !["A", "B", "C", "D"].includes(correctOption)) {
      throw new Error("ASSESSMENT_ANSWER_KEY_INVALID");
    }
    answerKey.set(questionId, correctOption);
  }

  const snapshotQuestionIds = new Set(questionIds);
  if (mergedAnswers.some((answer) => !snapshotQuestionIds.has(answer.questionId))) {
    throw new Error("ASSESSMENT_ANSWER_OUTSIDE_SNAPSHOT");
  }

  if (submittedBy === "student" && mergedAnswers.length !== CONFIG.questionCount) {
    throw new Error(`ASSESSMENT_ALL_QUESTIONS_REQUIRED:${CONFIG.questionCount - mergedAnswers.length}`);
  }

  const now = new Date();
  const submittedAnswers: MCQAnswer[] = mergedAnswers.map((answer) => ({
    questionId: answer.questionId,
    answer: answer.answer,
    answeredAt: now,
    marksAwarded: answer.answer === answerKey.get(answer.questionId)
      ? CONFIG.marksPerQuestion
      : 0,
  }));

  const score = submittedAnswers.reduce((total, answer) => total + answer.marksAwarded, 0);
  const percentage = Math.round((score / CONFIG.totalMarks) * 10000) / 100;
  const passed = score >= CONFIG.passingMarks;
  const status = passed ? "passed" : "failed";
  const deadline = safeDate(attempt.finalDeadline);
  const effectiveSubmitter = submittedBy === "system" || (deadline !== null && now >= deadline)
    ? "system"
    : "student";

  const updated = await Attempt.findOneAndUpdate(
    {
      _id: attempt._id,
      studentId,
      status: "in-progress",
    } as any,
    {
      $set: {
        status,
        currentPhase: "completed",
        mcqAnswers: submittedAnswers,
        codingAnswers: [],
        mcqScore: score,
        codingScore: 0,
        totalScore: score,
        percentage,
        passingMarks: CONFIG.passingMarks,
        passed,
        submittedAt: now,
        submittedBy: effectiveSubmitter,
        evaluationStartedAt: now,
        evaluatedAt: now,
        resultDeclaredAt: now,
        lastActivityAt: now,
      },
    },
    { new: true, runValidators: true },
  )
    .lean()
    .exec();

  let finalAttempt = updated as unknown as AnyRecord | null;

  if (!finalAttempt) {
    const rawAttemptId = attempt?._id;
    if (rawAttemptId === undefined || rawAttemptId === null || !mongoose.isValidObjectId(String(rawAttemptId))) {
      throw new Error("ASSESSMENT_ATTEMPT_ID_INVALID");
    }

    const attemptObjectId = rawAttemptId instanceof Types.ObjectId
      ? rawAttemptId
      : new Types.ObjectId(String(rawAttemptId));

    finalAttempt = await (Attempt.findOne({
      _id: attemptObjectId,
      studentId,
    } as any)
      .lean()
      .exec()) as unknown as AnyRecord | null;
  }

  if (!finalAttempt) {
    throw new Error("ASSESSMENT_ATTEMPT_NOT_FOUND_AFTER_SUBMISSION");
  }

  if (["passed", "failed"].includes(text(finalAttempt.status, 30))) {
    const finalScore = Number(finalAttempt.totalScore) || 0;
    const finalPassed = finalAttempt.status === "passed";

    if (!Number.isFinite(finalScore) || finalScore < 0 || finalScore > CONFIG.totalMarks) {
      throw new Error("ASSESSMENT_FINAL_SCORE_INVALID");
    }

    const studentSync = await StudentModel.updateOne(
      { _id: studentId },
      {
        $set: {
          assessmentStatus: finalPassed ? "passed" : "failed",
          assessmentScore: finalScore,
          assessmentSubmittedAt: finalAttempt.submittedAt ?? now,
          assessmentEvaluatedAt: finalAttempt.evaluatedAt ?? now,
          resultDeclaredAt: finalAttempt.resultDeclaredAt ?? now,
          resultVisibleAt: finalAttempt.resultDeclaredAt ?? now,
          resultStatus: finalPassed ? "passed" : "failed",
          internshipApplicationAllowed: finalPassed,
        },
      },
    ).exec();

    if (Number(studentSync.matchedCount ?? 0) !== 1) {
      throw new Error("ASSESSMENT_STUDENT_RESULT_SYNC_FAILED");
    }
  }

  return finalAttempt;
}

async function loadAttemptForStudent(
  attemptId: string,
  studentId: Types.ObjectId,
): Promise<AnyRecord | null> {
  const Attempt = await getAssessmentAttemptModel();
  const attempt = await Attempt.findOne({ attemptId })
    .lean()
    .exec() as unknown as AnyRecord | null;

  if (!attempt) return null;
  if (String(attempt.studentId) !== String(studentId)) {
    throw new Error("ASSESSMENT_ATTEMPT_OWNER_MISMATCH");
  }

  return attempt;
}

async function readRequestBody(request: NextRequest): Promise<
  | { valid: true; body: AnyRecord }
  | { valid: false; response: NextResponse }
> {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    try {
      if (new URL(origin).origin !== request.nextUrl.origin) {
        return {
          valid: false,
          response: failure("Cross-origin requests are not allowed.", "CROSS_ORIGIN_REQUEST", 403),
        };
      }
    } catch {
      return {
        valid: false,
        response: failure("Request origin is invalid.", "INVALID_ORIGIN", 403),
      };
    }
  } else if (referer) {
    try {
      if (new URL(referer).origin !== request.nextUrl.origin) {
        return {
          valid: false,
          response: failure("Cross-origin requests are not allowed.", "CROSS_ORIGIN_REQUEST", 403),
        };
      }
    } catch {
      return {
        valid: false,
        response: failure("Request referrer is invalid.", "INVALID_REFERER", 403),
      };
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      valid: false,
      response: failure("Content-Type must be application/json.", "UNSUPPORTED_CONTENT_TYPE", 415),
    };
  }

  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength !== null) {
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return {
        valid: false,
        response: failure("Request Content-Length is invalid.", "INVALID_CONTENT_LENGTH", 400),
      };
    }
    if (contentLength > CONFIG.maximumBodyBytes) {
      return {
        valid: false,
        response: failure("Request body is too large.", "REQUEST_TOO_LARGE", 413),
      };
    }
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return {
      valid: false,
      response: failure("Request body could not be read.", "INVALID_BODY", 400),
    };
  }

  if (new TextEncoder().encode(rawBody).byteLength > CONFIG.maximumBodyBytes) {
    return {
      valid: false,
      response: failure("Request body is too large.", "REQUEST_TOO_LARGE", 413),
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return {
      valid: false,
      response: failure("Request body must contain valid JSON.", "INVALID_JSON", 400),
    };
  }

  if (!isRecord(body)) {
    return {
      valid: false,
      response: failure("Request body must be a JSON object.", "INVALID_BODY", 400),
    };
  }

  return { valid: true, body };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getStudentContext(request);
    if (!auth.valid) return auth.response;

    const { student } = auth;
    let activeAttempt = await getActiveAttempt(student.id);

    if (activeAttempt && (!Array.isArray(activeAttempt.questions) || activeAttempt.questions.length !== CONFIG.questionCount)) {
      return failure("An older assessment attempt is incompatible with the frozen 90-MCQ format. Contact the administrator to resolve the existing attempt before continuing.", "LEGACY_ATTEMPT_REQUIRES_REVIEW", 409);
    }

    if (activeAttempt && text(activeAttempt.status, 40) === "in-progress") {
      const deadline = safeDate(activeAttempt.finalDeadline);
      if (!deadline) {
        return failure("Your active assessment has an invalid deadline. Contact support.", "INVALID_ATTEMPT_DEADLINE", 409);
      }

      if (deadline <= new Date()) {
        activeAttempt = await finalizeAttempt(activeAttempt, student.id, [], "system");
      }
    }

    if (activeAttempt) {
      const status = text(activeAttempt.status, 40);
      if (["submitted", "evaluating", "evaluation-pending", "pending-evaluation"].includes(status)) {
        return success(
          {
            student: {
              fullName: text(student.record.fullName, 120),
              internshipTrack: getStudentDomain(student.record),
              domain: getStudentDomain(student.record),
            },
            assessment: null,
            attempt: null,
            result: {
              status: "pending",
              score: null,
              percentage: null,
              passed: false,
              message: "Your assessment has been submitted and is awaiting evaluation.",
            },
          },
          "Assessment evaluation is pending.",
        );
      }

      if (["passed", "failed", "expired", "cancelled"].includes(status)) {
        return success(
          {
            student: {
              fullName: text(student.record.fullName, 120),
              internshipTrack: getStudentDomain(student.record),
              domain: getStudentDomain(student.record),
            },
            assessment: null,
            attempt: null,
            result: status === "cancelled"
              ? { status: "failed", score: Number(activeAttempt.totalScore) || 0, percentage: Number(activeAttempt.percentage) || 0, passed: false, message: "This assessment attempt is no longer active." }
              : serializeResult(activeAttempt),
          },
          "Assessment result loaded.",
        );
      }

      return success(
        {
          student: {
              fullName: text(student.record.fullName, 120),
              internshipTrack: getStudentDomain(student.record),
              domain: getStudentDomain(student.record),
            },
          assessment: {
            id: text(activeAttempt.assessmentId, 100),
            title: "Technical Assessment",
            domain: text(activeAttempt.domain, 120),
            questionCount: CONFIG.questionCount,
            totalMarks: CONFIG.totalMarks,
            durationMinutes: CONFIG.durationMinutes,
            passingPercentage: CONFIG.passingPercentage,
          },
          attempt: serializeAttempt(activeAttempt),
          result: null,
        },
        "Active assessment attempt loaded.",
      );
    }

    if (["passed", "failed", "evaluated"].includes(text(student.record.assessmentStatus, 30)) || ["passed", "failed"].includes(text(student.record.resultStatus, 30))) {
      const storedScore = Number.isFinite(Number(student.record.assessmentScore)) ? Number(student.record.assessmentScore) : null;
      const storedStatus = ["passed", "failed"].includes(text(student.record.resultStatus, 30)) ? text(student.record.resultStatus, 30) : text(student.record.assessmentStatus, 30);
      return success(
        {
          student: {
              fullName: text(student.record.fullName, 120),
              internshipTrack: getStudentDomain(student.record),
              domain: getStudentDomain(student.record),
            },
          assessment: null,
          attempt: null,
          result: {
            status: storedStatus,
            score: storedScore,
            percentage: storedScore === null ? null : Math.round((storedScore / CONFIG.totalMarks) * 10000) / 100,
            passed: storedStatus === "passed",
            message: storedStatus === "passed"
              ? "Your assessment has already been passed."
              : "Your assessment has already been evaluated.",
          },
        },
        "Assessment result loaded.",
      );
    }

    const assessment = await findAssessmentForStudent(student.record);
    if (!assessment) {
      const assignedDomain = getStudentDomain(student.record);

      return success(
        {
          student: {
            fullName: text(student.record.fullName, 120),
            internshipTrack: assignedDomain,
            domain: assignedDomain,
          },
          assessment: null,
          attempt: null,
          result: null,
          assignment: {
            domainAssigned: Boolean(assignedDomain),
            domain: assignedDomain,
            assessmentAvailable: false,
          },
        },
        assignedDomain
          ? `Your internship domain is ${assignedDomain}, but no published and selectable assessment is available for this domain.`
          : "Your internship domain has not been assigned to your student profile yet. Contact the administration team.",
      );
    }

    return success(
      {
        student: {
              fullName: text(student.record.fullName, 120),
              internshipTrack: getStudentDomain(student.record),
              domain: getStudentDomain(student.record),
            },
        assessment: serializeAssessment(assessment),
        attempt: null,
        result: null,
      },
      "Assessment is ready.",
    );
  } catch (error) {
    console.error("[STUDENT ASSESSMENT GET]", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: isRecord(error) ? text(error.code, 40) : "",
    });
    if (error instanceof mongoose.Error) {
      return failure("Assessment data could not be loaded. Please contact support.", "ASSESSMENT_DATA_ERROR", 500);
    }
    return failure("The assessment service is temporarily unavailable.", "ASSESSMENT_SERVICE_ERROR", 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getStudentContext(request);
    if (!auth.valid) return auth.response;

    const parsed = await readRequestBody(request);
    if (!parsed.valid) return parsed.response;

    const { student } = auth;
    const body = parsed.body;
    const action = text(body.action, 20).toLowerCase();

    const allowedBodyKeys = action === "start"
      ? new Set(["action"])
      : action === "save"
        ? new Set(["action", "attemptId", "answers"])
        : action === "submit"
          ? new Set(["action", "attemptId", "answers", "autoSubmitted"])
          : new Set(["action"]);

    if (Object.keys(body).some((key) => !allowedBodyKeys.has(key))) {
      return failure(
        "The request contains unsupported fields. Webcam recordings, audio, video and media uploads are not accepted or stored.",
        "UNSUPPORTED_ASSESSMENT_PAYLOAD",
        400,
      );
    }

    if (action === "submit" && body.autoSubmitted !== undefined && typeof body.autoSubmitted !== "boolean") {
      return failure("The automatic submission flag is invalid.", "INVALID_SUBMISSION_FLAG", 400);
    }

    if (action === "start") {
      const existingAttempt = await getActiveAttempt(student.id);
      if (existingAttempt) {
        if (!Array.isArray(existingAttempt.questions) || existingAttempt.questions.length !== CONFIG.questionCount) {
          return failure("An older assessment attempt is incompatible with the frozen 90-MCQ format. Contact the administrator before starting a new attempt.", "LEGACY_ATTEMPT_REQUIRES_REVIEW", 409);
        }

        if (["submitted", "evaluating", "evaluation-pending", "pending-evaluation"].includes(text(existingAttempt.status, 40))) {
          return success(
            {
              attempt: null,
              assessment: null,
              result: {
                status: "pending",
                score: null,
                percentage: null,
                passed: false,
                message: "Your assessment has been submitted and is awaiting evaluation.",
              },
            },
            "Assessment evaluation is pending.",
          );
        }

        if (text(existingAttempt.status, 40) === "in-progress") {
          const deadline = safeDate(existingAttempt.finalDeadline);
          if (!deadline) {
            return failure("Your active assessment has an invalid deadline. Contact support.", "INVALID_ATTEMPT_DEADLINE", 409);
          }
          if (deadline <= new Date()) {
            const finalized = await finalizeAttempt(existingAttempt, student.id, [], "system");
            return success({ result: serializeResult(finalized), attempt: null }, "Assessment time expired and the attempt was submitted.");
          }
        }

        return success(
          {
            attempt: serializeAttempt(existingAttempt),
            assessment: {
              id: text(existingAttempt.assessmentId, 100),
              title: "Technical Assessment",
              domain: text(existingAttempt.domain, 120),
              questionCount: CONFIG.questionCount,
              totalMarks: CONFIG.totalMarks,
              durationMinutes: CONFIG.durationMinutes,
              passingPercentage: CONFIG.passingPercentage,
            },
          },
          "Your existing assessment attempt has been restored.",
        );
      }

      if (["passed", "failed"].includes(text(student.record.assessmentStatus, 30))) {
        return failure("Your assessment has already been evaluated. A new attempt requires administrator approval.", "ASSESSMENT_ALREADY_EVALUATED", 409);
      }

      const assignedDomain = getStudentDomain(student.record);
      if (!assignedDomain) {
        return failure(
          "Your internship domain is missing from your student profile. The assessment cannot be assigned until the domain is saved by the administration team.",
          "STUDENT_DOMAIN_NOT_ASSIGNED",
          409,
        );
      }

      const assessment = await findAssessmentForStudent(student.record);
      if (!assessment) {
        return failure(
          `No published and selectable assessment is available for your assigned domain: ${assignedDomain}.`,
          "ASSESSMENT_NOT_ASSIGNED",
          404,
        );
      }

      try {
        const created = await createAttempt(student, assessment, request);
        return success(
          {
            assessment: serializeAssessment(assessment),
            attempt: serializeAttempt(created),
          },
          "Assessment started successfully.",
          201,
        );
      } catch (error) {
        if (isRecord(error) && Number(error.code) === 11000) {
          const racedAttempt = await getActiveAttempt(student.id);
          if (racedAttempt) {
            return success(
              { attempt: serializeAttempt(racedAttempt) },
              "Your active assessment attempt has been restored.",
            );
          }
        }

        if (error instanceof Error && error.message.startsWith("ASSESSMENT_QUESTION_BANK_INCOMPLETE:")) {
          return failure("The published question bank is incomplete. The assessment requires exactly 30 valid questions at each difficulty level.", "ASSESSMENT_QUESTION_BANK_INCOMPLETE", 409);
        }

        throw error;
      }
    }

    if (action !== "save" && action !== "submit") {
      return failure("Action must be start, save or submit.", "INVALID_ASSESSMENT_ACTION", 400);
    }

    const attemptId = text(body.attemptId, 100);
    if (!attemptId) {
      return failure("A valid assessment attempt ID is required.", "ATTEMPT_ID_REQUIRED", 400);
    }

    let attempt: AnyRecord | null;

    try {
      attempt = await loadAttemptForStudent(attemptId, student.id);
    } catch (error) {
      if (error instanceof Error && error.message === "ASSESSMENT_ATTEMPT_OWNER_MISMATCH") {
        return failure("This assessment attempt belongs to a different student account.", "ATTEMPT_OWNER_MISMATCH", 403);
      }
      throw error;
    }

    if (!attempt) {
      console.error("[ASSESSMENT_ATTEMPT_LOOKUP_MISS]", {
        attemptId,
        studentId: String(student.id),
      });
      return failure("Assessment attempt was not found. Refresh the assessment to restore the server-side attempt.", "ATTEMPT_NOT_FOUND", 404);
    }

    const status = text(attempt.status, 40);
    if (status !== "in-progress") {
      if (["passed", "failed", "expired"].includes(status)) {
        return success({ result: serializeResult(attempt), attempt: null }, "Assessment has already been submitted.");
      }
      return failure("This assessment attempt is not accepting answers.", "ATTEMPT_NOT_ACTIVE", 409);
    }

    const parsedAnswers = parseAnswersForAttempt(body.answers, attempt);
    if (!parsedAnswers.valid) {
      return failure(parsedAnswers.message, "INVALID_ANSWERS", 400);
    }

    const deadline = safeDate(attempt.finalDeadline);
    if (!deadline) {
      return failure("The assessment deadline is invalid. Contact support.", "INVALID_ATTEMPT_DEADLINE", 409);
    }

    if (action === "submit" && body.autoSubmitted !== true && deadline > new Date()) {
      const completeAnswers = mergeAnswers(attempt.mcqAnswers, parsedAnswers.answers);
      if (completeAnswers.length !== CONFIG.questionCount) {
        return failure("Please answer all 90 questions before submitting.", "ASSESSMENT_INCOMPLETE", 400);
      }
    }

    if (deadline <= new Date() || action === "submit") {
      if (body.autoSubmitted === true && deadline > new Date()) {
        return failure("Automatic submission is only allowed after the assessment timer expires.", "AUTO_SUBMIT_TOO_EARLY", 403);
      }

      const finalized = await finalizeAttempt(
        attempt,
        student.id,
        parsedAnswers.answers,
        deadline <= new Date() || body.autoSubmitted === true ? "system" : "student",
      );
      return success(
        { result: serializeResult(finalized), attempt: null },
        deadline <= new Date()
          ? "Assessment time expired. Your saved answers were submitted automatically."
          : "Assessment submitted and evaluated successfully.",
      );
    }

    const records: MCQAnswer[] = mergeAnswers(
      attempt.mcqAnswers,
      parsedAnswers.answers,
    ).map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer,
      answeredAt: new Date(),
      marksAwarded: 0,
    }));

    const Attempt = await getAssessmentAttemptModel();
    const saved = await Attempt.findOneAndUpdate(
      {
        _id: attempt._id,
        attemptId,
        studentId: student.id,
        status: "in-progress",
        finalDeadline: { $gt: new Date() },
      } as any,
      {
        $set: {
          mcqAnswers: records,
          lastActivityAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    )
      .lean()
      .exec();

    if (!saved) {
      return failure("The attempt expired or changed while saving. Refresh the assessment to restore its latest state.", "ATTEMPT_SAVE_CONFLICT", 409);
    }

    return success(
      {
        savedCount: records.length,
        deadline: safeDate(saved.finalDeadline)?.toISOString() ?? "",
      },
      "Answers saved successfully.",
    );
  } catch (error) {
    console.error("[STUDENT ASSESSMENT POST]", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: isRecord(error) ? text(error.code, 40) : "",
    });

    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      return failure("Assessment data failed validation. Please refresh and try again.", "ASSESSMENT_VALIDATION_ERROR", 400);
    }

    if (error instanceof Error && error.message === "ASSESSMENT_STUDENT_STATE_CONFLICT") {
      return failure("Your student assessment status changed while the attempt was starting. Refresh the page and contact support if the issue continues.", "ASSESSMENT_STUDENT_STATE_CONFLICT", 409);
    }

    if (error instanceof Error && error.message === "ASSESSMENT_ANSWER_OUTSIDE_SNAPSHOT") {
      return failure("The saved answers do not match this assessment attempt. Contact support.", "ASSESSMENT_ANSWER_INVALID", 409);
    }

    if (error instanceof Error && error.message.startsWith("ASSESSMENT_ALL_QUESTIONS_REQUIRED:")) {
      const remaining = Number(error.message.split(":")[1]);
      return failure(
        `Please answer all 90 questions before submitting. ${Number.isFinite(remaining) ? remaining : "Some"} questions remain unanswered.`,
        "ASSESSMENT_INCOMPLETE",
        400,
      );
    }

    if (error instanceof Error && error.message === "ASSESSMENT_STUDENT_RESULT_SYNC_FAILED") {
      return failure("Your assessment was finalized, but the student result could not be synchronized. Contact support before proceeding to internship selection.", "ASSESSMENT_RESULT_SYNC_PENDING", 503);
    }

    if (error instanceof Error && error.message === "ASSESSMENT_FINAL_SCORE_INVALID") {
      return failure("The calculated assessment score is invalid. Contact support.", "ASSESSMENT_FINAL_SCORE_INVALID", 500);
    }

    if (error instanceof Error && error.message === "ASSESSMENT_ANSWER_KEY_UNAVAILABLE") {
      return failure("The assessment answer key is temporarily unavailable. Your attempt has not been finalized. Contact support.", "ANSWER_KEY_UNAVAILABLE", 503);
    }

    if (error instanceof Error && error.message === "ASSESSMENT_ANSWER_KEY_INVALID") {
      return failure("The assessment answer key contains invalid data. Contact support.", "ANSWER_KEY_INVALID", 500);
    }

    if (error instanceof Error && error.message === "ASSESSMENT_ATTEMPT_QUESTION_SNAPSHOT_INVALID") {
      return failure("The saved assessment question snapshot is invalid. Contact support.", "ATTEMPT_SNAPSHOT_INVALID", 409);
    }

    if (error instanceof Error && error.message === "ASSESSMENT_ATTEMPT_ASSESSMENT_ID_INVALID") {
      return failure("The saved assessment reference is invalid. Contact support.", "ATTEMPT_ASSESSMENT_INVALID", 409);
    }

    if (error instanceof Error && error.message === "ASSESSMENT_QUESTION_OPTIONS_INVALID") {
      return failure("The published question bank contains invalid options. Contact support.", "QUESTION_OPTIONS_INVALID", 409);
    }

    return failure("The assessment service could not complete your request. Please retry or contact support.", "ASSESSMENT_SERVICE_ERROR", 500);
  }
}
