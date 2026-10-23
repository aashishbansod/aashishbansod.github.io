import "server-only";

import mongoose, { type Model } from "mongoose";
import { connectDB } from "@/lib/db";
import StudentModel from "@/models/Student";
import getAssessmentAttemptModel, {
  ASSESSMENT_CONSTANTS,
  type AssessmentPhase,
  type IAssessmentAttempt,
} from "@/models/AssessmentAttempt";
import {
  startAssessment as startStudentAssessment,
  submitAssessmentResult as submitStudentAssessmentResult,
  type ServiceResult,
} from "@/services/student.service";

const C = ASSESSMENT_CONSTANTS;
const ACTIVE_STATUSES = ["in-progress", "coding-in-progress"] as const;
const EVALUATION_STATUSES = ["submitted", "evaluating"] as const;
const FINAL_STATUSES = ["passed", "failed", "expired", "cancelled"] as const;
const MAX_HISTORY_LIMIT = 50;
const MAX_ID_LENGTH = 200;
const MAX_TEXT_LENGTH = 300;
const MAX_INCREMENT = 100;

type AnyRecord = Record<string, any>;

export interface AssessmentStartInput {
  studentId: string;
  assessmentId?: string;
  domain?: string;
  internshipTrack?: string;
}

export interface AssessmentResultInput {
  studentId: string;
  score: number;
  passingScore?: number;
  resultStatus?: "passed" | "failed";
}

export interface AssessmentAttemptInput {
  studentId: string;
  attemptId: string;
}

export interface AssessmentIntegrityInput extends AssessmentAttemptInput {
  tabSwitches?: number;
  fullscreenExitCount?: number;
  copyAttempts?: number;
  pasteAttempts?: number;
  shortcutAttempts?: number;
}

export interface AssessmentStatus {
  available: boolean;
  status: string;
  attemptId?: string;
  currentPhase?: string;
  remainingSeconds?: number;
  finalDeadline?: Date;
  totalQuestions: number;
  mcqQuestions: number;
  codingQuestions: number;
  totalMarks: number;
  passingMarks: number;
  passingPercentage: number;
  score?: number | null;
  percentage?: number | null;
  passed?: boolean;
  failed?: boolean;
  internshipSelectionUnlocked: boolean;
}

export interface SafeAssessmentQuestion {
  questionId: string;
  section: string;
  order: number;
  marks: number;
}

export interface SafeAssessmentAttempt {
  attemptId: string;
  assessmentId: string;
  studentId: string;
  domain: string;
  internshipTrack: string;
  status: string;
  currentPhase: string;
  questions: SafeAssessmentQuestion[];
  startedAt?: Date;
  mcqStartedAt?: Date;
  mcqDeadline?: Date;
  codingStartedAt?: Date;
  codingDeadline?: Date;
  finalDeadline?: Date;
  remainingSeconds: number;
  mcqRemainingSeconds: number;
  codingRemainingSeconds: number;
  totalMarks: number;
  passingMarks: number;
  score?: number;
  percentage?: number;
  passed?: boolean;
  tabSwitches: number;
  fullscreenExitCount: number;
  copyAttempts: number;
  pasteAttempts: number;
  shortcutAttempts: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AssessmentHistoryItem {
  attemptId: string;
  assessmentId: string;
  status: string;
  currentPhase: string;
  score: number;
  percentage: number;
  passingMarks: number;
  passed: boolean;
  startedAt?: Date;
  submittedAt?: Date;
  evaluatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AssessmentServiceError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AssessmentServiceError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function cleanString(value: unknown, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function normalizeStatus(value: unknown): string {
  return cleanString(value, 100).toLowerCase();
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeDate(value: unknown): Date | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  return undefined;
}

function clampScore(value: unknown): number {
  return Math.max(0, Math.min(C.TOTAL_MARKS, numberValue(value, 0)));
}

function clampPercentage(value: unknown): number {
  return Math.max(0, Math.min(100, numberValue(value, 0)));
}

function clampIncrement(value: unknown): number {
  return Math.min(MAX_INCREMENT, Math.max(0, Math.floor(numberValue(value, 0))));
}

function getRemainingSeconds(deadline: unknown): number {
  const date = safeDate(deadline);
  return date ? Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000)) : 0;
}

function isActiveStatus(value: unknown): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(normalizeStatus(value));
}

function isFinalStatus(value: unknown): boolean {
  return (FINAL_STATUSES as readonly string[]).includes(normalizeStatus(value));
}

async function ensureMainDatabase(): Promise<void> {
  await connectDB();
}

async function getAttemptModel(): Promise<Model<IAssessmentAttempt>> {
  return getAssessmentAttemptModel();
}

async function findStudent(studentId: string): Promise<any | null> {
  const id = cleanString(studentId, MAX_ID_LENGTH);
  if (!id) return null;
  await ensureMainDatabase();
  return StudentModel.findOne({ studentId: id }).exec();
}

async function findStudentAndAttempt(
  studentId: string,
  attemptId: string,
): Promise<{ student: any; attempt: any } | null> {
  const student = await findStudent(studentId);
  if (!student) return null;
  const Attempt = await getAttemptModel();
  const attempt = await Attempt.findOne({
    attemptId: cleanString(attemptId, MAX_ID_LENGTH),
    studentId: student._id,
  }).exec();
  return attempt ? { student, attempt } : null;
}

async function findActiveAttempt(studentObjectId: mongoose.Types.ObjectId): Promise<any | null> {
  const Attempt = await getAttemptModel();
  return Attempt.findOne({
    studentId: studentObjectId,
    status: { $in: ACTIVE_STATUSES },
  }).sort({ createdAt: -1 }).exec();
}

function calculatePhase(attempt: AnyRecord): AssessmentPhase {
  const finalDeadline = safeDate(attempt.finalDeadline);
  const mcqDeadline = safeDate(attempt.mcqDeadline);
  if (!finalDeadline || Date.now() >= finalDeadline.getTime()) return "completed";
  if (mcqDeadline && Date.now() >= mcqDeadline.getTime()) return "coding";
  return normalizeStatus(attempt.currentPhase) === "coding" ? "coding" : "mcq";
}

function sanitizeQuestion(raw: unknown): SafeAssessmentQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as AnyRecord;
  const questionId = cleanString(q.questionId ?? q.id, MAX_ID_LENGTH);
  if (!questionId) return null;
  return {
    questionId,
    section: normalizeStatus(q.section),
    order: Math.max(0, Math.floor(numberValue(q.order))),
    marks: Math.max(0, Math.min(C.TOTAL_MARKS, numberValue(q.marks))),
  };
}

function serializeAttempt(raw: AnyRecord): SafeAssessmentAttempt {
  const phase = calculatePhase(raw);
  const mcqDeadline = safeDate(raw.mcqDeadline);
  const codingDeadline = safeDate(raw.codingDeadline);
  const finalDeadline = safeDate(raw.finalDeadline);
  return {
    attemptId: cleanString(raw.attemptId, MAX_ID_LENGTH),
    assessmentId: cleanString(raw.assessmentId, MAX_ID_LENGTH),
    studentId: String(raw.studentId ?? ""),
    domain: cleanString(raw.domain),
    internshipTrack: cleanString(raw.internshipTrack),
    status: normalizeStatus(raw.status),
    currentPhase: phase,
    // Intentionally expose only safe metadata, never answers or hidden tests.
    questions: (Array.isArray(raw.questions) ? raw.questions : [])
      .map(sanitizeQuestion)
      .filter((q: SafeAssessmentQuestion | null): q is SafeAssessmentQuestion => q !== null)
      .slice(0, C.MCQ_COUNT + C.CODING_COUNT),
    startedAt: safeDate(raw.startedAt),
    mcqStartedAt: safeDate(raw.mcqStartedAt),
    mcqDeadline,
    codingStartedAt: safeDate(raw.codingStartedAt),
    codingDeadline,
    finalDeadline,
    remainingSeconds: getRemainingSeconds(finalDeadline),
    mcqRemainingSeconds: getRemainingSeconds(mcqDeadline),
    codingRemainingSeconds: getRemainingSeconds(codingDeadline),
    totalMarks: C.TOTAL_MARKS,
    passingMarks: numberValue(raw.passingMarks, C.PASSING_MARKS),
    score: clampScore(raw.totalScore),
    percentage: clampPercentage(raw.percentage),
    passed: raw.passed === true,
    tabSwitches: Math.max(0, numberValue(raw.tabSwitches)),
    fullscreenExitCount: Math.max(0, numberValue(raw.fullscreenExitCount)),
    copyAttempts: Math.max(0, numberValue(raw.copyAttempts)),
    pasteAttempts: Math.max(0, numberValue(raw.pasteAttempts)),
    shortcutAttempts: Math.max(0, numberValue(raw.shortcutAttempts)),
    createdAt: safeDate(raw.createdAt),
    updatedAt: safeDate(raw.updatedAt),
  };
}

async function expireAttemptIfRequired(attempt: AnyRecord): Promise<boolean> {
  if (!isActiveStatus(attempt.status)) return false;
  const deadline = safeDate(attempt.finalDeadline);
  if (!deadline || Date.now() < deadline.getTime()) return false;
  const Attempt = await getAttemptModel();
  const now = new Date();
  const result = await Attempt.updateOne(
    {
      _id: attempt._id,
      status: { $in: ACTIVE_STATUSES },
      finalDeadline: { $lte: now },
    },
    {
      $set: {
        status: "expired",
        currentPhase: "completed",
        lastActivityAt: now,
      },
    },
  ).exec();
  return Number(result.modifiedCount ?? 0) > 0;
}

function errorResult<T = unknown>(context: string, error: unknown): ServiceResult<T> {
  if (error instanceof AssessmentServiceError) {
    return { success: false, message: error.message, code: error.code } as ServiceResult<T>;
  }
  console.error(context, error);
  if (error instanceof mongoose.Error) {
    return {
      success: false,
      message: "Database error while processing assessment.",
      code: "DATABASE_ERROR",
    } as ServiceResult<T>;
  }
  return {
    success: false,
    message: "Unable to process assessment request right now. Please try again later.",
    code: "INTERNAL_SERVER_ERROR",
  } as ServiceResult<T>;
}

function eligibility(student: AnyRecord): { valid: boolean; code?: string; message?: string } {
  if (normalizeStatus(student.applicationStatus) !== "approved") {
    return { valid: false, code: "APPLICATION_NOT_APPROVED", message: "Student application must be approved before assessment." };
  }
  if (student.loginEnabled !== true) {
    return { valid: false, code: "LOGIN_NOT_ENABLED", message: "Student login is currently disabled." };
  }
  const status = normalizeStatus(student.assessmentStatus);
  if (status === "passed" || status === "evaluated") {
    return { valid: false, code: "ASSESSMENT_ALREADY_COMPLETED", message: "Assessment has already been completed." };
  }
  return { valid: true };
}

export function getAssessmentConfiguration() {
  return {
    mcqCount: C.MCQ_COUNT,
    codingCount: C.CODING_COUNT,
    totalQuestions: C.MCQ_COUNT + C.CODING_COUNT,
    mcqMarksPerQuestion: C.MCQ_MARKS_PER_QUESTION,
    codingMarksPerQuestion: C.CODING_MARKS_PER_QUESTION,
    mcqTotalMarks: C.MCQ_TOTAL_MARKS,
    codingTotalMarks: C.CODING_TOTAL_MARKS,
    totalMarks: C.TOTAL_MARKS,
    passingMarks: C.PASSING_MARKS,
    passingPercentage: C.PASSING_PERCENTAGE,
    mcqDurationMinutes: C.MCQ_DURATION_MINUTES,
    codingDurationMinutes: C.CODING_DURATION_MINUTES,
    totalDurationMinutes: C.TOTAL_DURATION_MINUTES,
    mcqDurationSeconds: C.MCQ_DURATION_SECONDS,
    codingDurationSeconds: C.CODING_DURATION_SECONDS,
    totalDurationSeconds: C.TOTAL_DURATION_SECONDS,
  };
}

export async function startAssessment(input: AssessmentStartInput): Promise<ServiceResult> {
  try {
    const studentId = cleanString(input?.studentId, MAX_ID_LENGTH);
    if (!studentId) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    const student = await findStudent(studentId);
    if (!student) return { success: false, message: "Student account was not found.", code: "STUDENT_NOT_FOUND" };
    const check = eligibility(student.toObject ? student.toObject() : student);
    if (!check.valid) return { success: false, message: check.message ?? "Assessment is not available.", code: check.code ?? "ASSESSMENT_NOT_AVAILABLE" };

    const existing = await findActiveAttempt(student._id as mongoose.Types.ObjectId);
    if (existing) {
      const expired = await expireAttemptIfRequired(existing);
      if (!expired) {
        return {
          success: true,
          message: "An active assessment attempt already exists. Resume the existing attempt.",
          code: "ASSESSMENT_ATTEMPT_ACTIVE",
          data: { resumed: true, attemptId: existing.attemptId, assessment: serializeAttempt(existing.toObject ? existing.toObject() : existing) },
        };
      }
    }
    // The student service owns the student lifecycle; the assessment start API
    // is responsible for selecting questions and creating the actual attempt.
    return await startStudentAssessment(studentId);
  } catch (error) {
    return errorResult("[AssessmentService] startAssessment", error);
  }
}

export async function submitAssessmentResult(input: AssessmentResultInput): Promise<ServiceResult> {
  try {
    const studentId = cleanString(input?.studentId, MAX_ID_LENGTH);
    const score = numberValue(input?.score, -1);
    if (!studentId) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    if (score < 0 || score > C.TOTAL_MARKS) {
      return { success: false, message: `Assessment score must be between 0 and ${C.TOTAL_MARKS}.`, code: "INVALID_ASSESSMENT_SCORE" };
    }
    const student = await findStudent(studentId);
    if (!student) return { success: false, message: "Student account was not found.", code: "STUDENT_NOT_FOUND" };
    const record = student.toObject ? student.toObject() : student;
    if (normalizeStatus(record.applicationStatus) !== "approved") {
      return { success: false, message: "Application is not approved.", code: "APPLICATION_NOT_APPROVED" };
    }
    const passingScore = Math.max(0, Math.min(C.TOTAL_MARKS, numberValue(input.passingScore, numberValue(record.assessmentPassingScore, C.PASSING_MARKS))));
    const passed = score >= passingScore;
    if (input.resultStatus && input.resultStatus !== (passed ? "passed" : "failed")) {
      return { success: false, message: "Assessment result is inconsistent with the authoritative score.", code: "INVALID_ASSESSMENT_RESULT" };
    }
    return submitStudentAssessmentResult({ studentId, score, passingScore, resultStatus: passed ? "passed" : "failed" });
  } catch (error) {
    return errorResult("[AssessmentService] submitAssessmentResult", error);
  }
}

export async function getActiveAttempt(studentId: string): Promise<ServiceResult<{ active: boolean; attempt?: SafeAssessmentAttempt }>> {
  try {
    const id = cleanString(studentId, MAX_ID_LENGTH);
    if (!id) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    const student = await findStudent(id);
    if (!student) return { success: false, message: "Student account was not found.", code: "STUDENT_NOT_FOUND" };
    const attempt = await findActiveAttempt(student._id as mongoose.Types.ObjectId);
    if (!attempt) return { success: true, message: "No active assessment attempt exists.", code: "NO_ACTIVE_ATTEMPT", data: { active: false } };
    if (await expireAttemptIfRequired(attempt)) {
      return { success: true, message: "Assessment attempt has expired.", code: "ASSESSMENT_EXPIRED", data: { active: false } };
    }
    return { success: true, message: "Active assessment attempt loaded successfully.", code: "ACTIVE_ATTEMPT_FOUND", data: { active: true, attempt: serializeAttempt(attempt.toObject ? attempt.toObject() : attempt) } };
  } catch (error) {
    return errorResult("[AssessmentService] getActiveAttempt", error);
  }
}

export async function getAssessmentAttempt(input: AssessmentAttemptInput): Promise<ServiceResult<{ attempt: SafeAssessmentAttempt }>> {
  try {
    const studentId = cleanString(input?.studentId, MAX_ID_LENGTH);
    const attemptId = cleanString(input?.attemptId, MAX_ID_LENGTH);
    if (!studentId) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    if (!attemptId) return { success: false, message: "Assessment attempt ID is required.", code: "INVALID_ATTEMPT_ID" };
    const found = await findStudentAndAttempt(studentId, attemptId);
    if (!found) return { success: false, message: "Assessment attempt was not found.", code: "ATTEMPT_NOT_FOUND" };
    const record = found.attempt.toObject ? found.attempt.toObject() : found.attempt;
    return { success: true, message: "Assessment attempt loaded successfully.", code: "ATTEMPT_LOADED", data: { attempt: serializeAttempt(record) } };
  } catch (error) {
    return errorResult("[AssessmentService] getAssessmentAttempt", error);
  }
}

export async function getAssessmentStatus(studentId: string): Promise<ServiceResult<AssessmentStatus>> {
  try {
    const id = cleanString(studentId, MAX_ID_LENGTH);
    if (!id) {
      return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    }

    const student = await findStudent(id);
    if (!student) {
      return { success: false, message: "Student account was not found.", code: "STUDENT_NOT_FOUND" };
    }

    const record = student.toObject ? student.toObject() : student;
    const studentObjectId = student._id as mongoose.Types.ObjectId;
    const studentStatus = normalizeStatus(record.assessmentStatus) || "not-started";
    const rawStudentScore = Number(record.assessmentScore);
    const studentScore = Number.isFinite(rawStudentScore) ? clampScore(rawStudentScore) : null;
    const Attempt = await getAttemptModel();

    // Active attempt is authoritative while the student is still taking the assessment.
    const activeAttempt = await findActiveAttempt(studentObjectId);
    if (activeAttempt) {
      const expired = await expireAttemptIfRequired(activeAttempt);
      if (!expired) {
        const safe = serializeAttempt(
          activeAttempt.toObject ? activeAttempt.toObject() : activeAttempt,
        );
        return {
          success: true,
          message: "Assessment status loaded successfully.",
          code: "ASSESSMENT_STATUS_LOADED",
          data: {
            available: true,
            status: normalizeStatus(activeAttempt.status) || studentStatus,
            attemptId: safe.attemptId,
            currentPhase: safe.currentPhase,
            remainingSeconds: safe.remainingSeconds,
            finalDeadline: safe.finalDeadline,
            totalQuestions: C.MCQ_COUNT + C.CODING_COUNT,
            mcqQuestions: C.MCQ_COUNT,
            codingQuestions: C.CODING_COUNT,
            totalMarks: C.TOTAL_MARKS,
            passingMarks: C.PASSING_MARKS,
            passingPercentage: C.PASSING_PERCENTAGE,
            score: safe.score ?? null,
            percentage: safe.percentage ?? null,
            passed: false,
            failed: false,
            internshipSelectionUnlocked: false,
          },
        };
      }
    }

    // Read the latest persisted attempt as well as the Student document.
    // This prevents a saved PASS/FAIL from appearing permanently "pending" if
    // synchronizing the Student lifecycle document previously failed.
    const latestAttempt = (await Attempt.findOne({ studentId: studentObjectId })
      .sort({ evaluatedAt: -1, updatedAt: -1, createdAt: -1 })
      .lean()
      .exec()) as AnyRecord | null;

    if (latestAttempt) {
      const attemptStatus = normalizeStatus(latestAttempt.status);
      if (attemptStatus === "passed" || attemptStatus === "failed") {
        const score = clampScore(latestAttempt.totalScore);
        const percentage = clampPercentage(
          latestAttempt.percentage ?? calculatePercentage(score),
        );
        const passed = attemptStatus === "passed";
        const finalStatus = passed ? "passed" : "failed";

        return {
          success: true,
          message: "Final assessment result loaded successfully.",
          code: "ASSESSMENT_RESULT_FINAL",
          data: {
            available: false,
            status: finalStatus,
            attemptId: cleanString(latestAttempt.attemptId, MAX_ID_LENGTH),
            currentPhase: "completed",
            totalQuestions: C.MCQ_COUNT + C.CODING_COUNT,
            mcqQuestions: C.MCQ_COUNT,
            codingQuestions: C.CODING_COUNT,
            totalMarks: C.TOTAL_MARKS,
            passingMarks: numberValue(latestAttempt.passingMarks, C.PASSING_MARKS),
            passingPercentage: C.PASSING_PERCENTAGE,
            score,
            percentage,
            passed,
            failed: !passed,
            // Do not unlock selection from the attempt alone. The student lifecycle
            // flag must also confirm that the downstream workflow is synchronized.
            internshipSelectionUnlocked:
              passed && record.internshipApplicationAllowed === true,
          },
        };
      }

      if (attemptStatus === "submitted" || attemptStatus === "evaluating") {
        return {
          success: true,
          message: "Assessment submitted; evaluation is still pending.",
          code: "ASSESSMENT_EVALUATION_PENDING",
          data: {
            available: false,
            status: attemptStatus,
            attemptId: cleanString(latestAttempt.attemptId, MAX_ID_LENGTH),
            currentPhase: "completed",
            totalQuestions: C.MCQ_COUNT + C.CODING_COUNT,
            mcqQuestions: C.MCQ_COUNT,
            codingQuestions: C.CODING_COUNT,
            totalMarks: C.TOTAL_MARKS,
            passingMarks: numberValue(latestAttempt.passingMarks, C.PASSING_MARKS),
            passingPercentage: C.PASSING_PERCENTAGE,
            score: null,
            percentage: null,
            passed: false,
            failed: false,
            internshipSelectionUnlocked: false,
          },
        };
      }
    }

    return {
      success: true,
      message: "Assessment status loaded successfully.",
      code: "ASSESSMENT_STATUS_LOADED",
      data: {
        available: studentStatus === "not-started" || studentStatus === "failed",
        status: studentStatus,
        totalQuestions: C.MCQ_COUNT + C.CODING_COUNT,
        mcqQuestions: C.MCQ_COUNT,
        codingQuestions: C.CODING_COUNT,
        totalMarks: C.TOTAL_MARKS,
        passingMarks: C.PASSING_MARKS,
        passingPercentage: C.PASSING_PERCENTAGE,
        score: studentScore,
        percentage: studentScore === null ? null : calculatePercentage(studentScore),
        passed: studentStatus === "passed",
        failed: studentStatus === "failed",
        internshipSelectionUnlocked:
          studentStatus === "passed" && record.internshipApplicationAllowed === true,
      },
    };
  } catch (error) {
    return errorResult<AssessmentStatus>("[AssessmentService] getAssessmentStatus", error);
  }
}
export async function recordIntegrityEvents(input: AssessmentIntegrityInput): Promise<ServiceResult> {
  try {
    const studentId = cleanString(input?.studentId, MAX_ID_LENGTH);
    const attemptId = cleanString(input?.attemptId, MAX_ID_LENGTH);
    if (!studentId) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    if (!attemptId) return { success: false, message: "Assessment attempt ID is required.", code: "INVALID_ATTEMPT_ID" };
    const found = await findStudentAndAttempt(studentId, attemptId);
    if (!found) return { success: false, message: "Assessment attempt was not found.", code: "ATTEMPT_NOT_FOUND" };
    const { attempt } = found;
    if (await expireAttemptIfRequired(attempt)) return { success: false, message: "Assessment attempt has expired.", code: "ASSESSMENT_EXPIRED" };
    if (!isActiveStatus(attempt.status)) return { success: false, message: "Assessment attempt is no longer active.", code: "ATTEMPT_NOT_ACTIVE" };
    const increments: Record<string, number> = {};
    for (const key of ["tabSwitches", "fullscreenExitCount", "copyAttempts", "pasteAttempts", "shortcutAttempts"] as const) {
      const value = clampIncrement(input[key]);
      if (value > 0) increments[key] = value;
    }
    if (!Object.keys(increments).length) return { success: true, message: "No new integrity events were recorded.", code: "NO_INTEGRITY_CHANGES", data: { attemptId, recorded: false } };
    const Attempt = await getAttemptModel();
    const now = new Date();
    const result = await Attempt.updateOne(
      { _id: attempt._id, status: { $in: ACTIVE_STATUSES }, finalDeadline: { $gt: now } },
      { $inc: increments, $set: { lastActivityAt: now } },
    ).exec();
    if (!result.modifiedCount) return { success: false, message: "Assessment attempt is no longer active.", code: "ATTEMPT_UPDATE_REJECTED" };
    return { success: true, message: "Assessment integrity events recorded successfully.", code: "INTEGRITY_EVENTS_RECORDED", data: { attemptId, recorded: true, events: increments } };
  } catch (error) {
    return errorResult("[AssessmentService] recordIntegrityEvents", error);
  }
}

export async function markEvaluationPending(input: AssessmentAttemptInput): Promise<ServiceResult> {
  try {
    const studentId = cleanString(input?.studentId, MAX_ID_LENGTH);
    const attemptId = cleanString(input?.attemptId, MAX_ID_LENGTH);
    if (!studentId) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    if (!attemptId) return { success: false, message: "Assessment attempt ID is required.", code: "INVALID_ATTEMPT_ID" };
    const found = await findStudentAndAttempt(studentId, attemptId);
    if (!found) return { success: false, message: "Assessment attempt was not found.", code: "ATTEMPT_NOT_FOUND" };
    const status = normalizeStatus(found.attempt.status);
    if (status === "passed" || status === "failed") {
      return { success: true, message: "Assessment has already been evaluated.", code: "ASSESSMENT_ALREADY_EVALUATED", data: { attemptId, status } };
    }
    if (!(EVALUATION_STATUSES as readonly string[]).includes(status)) {
      return { success: false, message: "Assessment attempt is not ready for evaluation.", code: "ATTEMPT_NOT_READY_FOR_EVALUATION" };
    }
    const Attempt = await getAttemptModel();
    const now = new Date();
    const existingEvaluationStartedAt = safeDate(found.attempt.evaluationStartedAt);
    const result = await Attempt.updateOne(
      { _id: found.attempt._id, status: { $in: EVALUATION_STATUSES } },
      {
        $set: {
          status: "evaluating",
          currentPhase: "completed",
          // Keep the original queue timestamp on retries; do not make stale jobs look new.
          evaluationStartedAt: existingEvaluationStartedAt ?? now,
          lastActivityAt: now,
        },
      },
    ).exec();
    if (!result.modifiedCount) {
      const latest = await Attempt.findById(found.attempt._id).lean().exec() as AnyRecord | null;
      if (latest && normalizeStatus(latest.status) === "evaluating") {
        return { success: true, message: "Assessment is already in the evaluation queue.", code: "ASSESSMENT_EVALUATION_PENDING", data: { attemptId, status: "evaluating" } };
      }
      return { success: false, message: "Assessment evaluation state could not be updated.", code: "EVALUATION_STATE_UPDATE_FAILED" };
    }
    return { success: true, message: "Assessment moved to evaluation queue.", code: "ASSESSMENT_EVALUATION_PENDING", data: { attemptId, status: "evaluating" } };
  } catch (error) {
    return errorResult("[AssessmentService] markEvaluationPending", error);
  }
}

/**
 * Trusted evaluator only. The API route must authenticate and authorize the evaluator.
 * Never pass student-submitted score values directly into this function.
 * This function never executes submitted code; it only persists a trusted evaluator's result.
 */
export async function finalizeAssessmentAttempt(input: {
  studentId: string;
  attemptId: string;
  score: number;
  mcqScore?: number;
  codingScore?: number;
  percentage?: number;
  passed?: boolean;
}): Promise<ServiceResult> {
  try {
    const studentId = cleanString(input?.studentId, MAX_ID_LENGTH);
    const attemptId = cleanString(input?.attemptId, MAX_ID_LENGTH);
    const score = numberValue(input?.score, -1);
    if (!studentId) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    if (!attemptId) return { success: false, message: "Assessment attempt ID is required.", code: "INVALID_ATTEMPT_ID" };
    if (score < 0 || score > C.TOTAL_MARKS) return { success: false, message: `Final score must be between 0 and ${C.TOTAL_MARKS}.`, code: "INVALID_FINAL_SCORE" };

    const found = await findStudentAndAttempt(studentId, attemptId);
    if (!found) return { success: false, message: "Assessment attempt was not found.", code: "ATTEMPT_NOT_FOUND" };
    const { attempt } = found;
    const status = normalizeStatus(attempt.status);
    if (status === "passed" || status === "failed") {
      const studentRecord = found.student.toObject ? found.student.toObject() : found.student;
      return {
        success: true,
        message: "Assessment was already finalized.",
        code: "ASSESSMENT_ALREADY_FINALIZED",
        data: {
          attemptId,
          score: numberValue(attempt.totalScore),
          percentage: numberValue(attempt.percentage),
          passed: status === "passed",
          // A passed attempt alone must not unlock the next workflow step.
          internshipSelectionUnlocked: studentRecord.internshipApplicationAllowed === true,
        },
      };
    }
    if (!(EVALUATION_STATUSES as readonly string[]).includes(status)) {
      return { success: false, message: "Assessment attempt is not ready for final evaluation.", code: "ATTEMPT_NOT_EVALUATING" };
    }

    const passed = score >= C.PASSING_MARKS;
    if (typeof input.passed === "boolean" && input.passed !== passed) {
      return { success: false, message: "Provided PASS/FAIL result does not match the authoritative score.", code: "RESULT_MISMATCH" };
    }
    const mcqScore = Math.max(0, Math.min(C.MCQ_TOTAL_MARKS, numberValue(input.mcqScore)));
    const codingScore = Math.max(0, Math.min(C.CODING_TOTAL_MARKS, numberValue(input.codingScore)));
    const sectionScoresProvided = input.mcqScore !== undefined || input.codingScore !== undefined;
    if (sectionScoresProvided && (input.mcqScore === undefined || input.codingScore === undefined)) {
      return {
        success: false,
        message: "Provide both MCQ and coding scores when supplying section scores.",
        code: "INCOMPLETE_SECTION_SCORES",
      };
    }
    if (sectionScoresProvided && mcqScore + codingScore !== score) {
      return { success: false, message: "When section scores are supplied, they must add up to the final score.", code: "SECTION_SCORE_MISMATCH" };
    }

    const Attempt = await getAttemptModel();
    const now = new Date();
    const update = await Attempt.updateOne(
      { _id: attempt._id, status: { $in: EVALUATION_STATUSES } },
      {
        $set: {
          mcqScore, codingScore, totalScore: score, percentage: calculatePercentage(score),
          passingMarks: C.PASSING_MARKS, passed, status: passed ? "passed" : "failed",
          currentPhase: "completed", evaluatedAt: now, resultDeclaredAt: now, lastActivityAt: now,
        },
      },
    ).exec();

    if (!update.modifiedCount) {
      const latest = await Attempt.findById(attempt._id).lean().exec() as AnyRecord | null;
      if (latest && (normalizeStatus(latest.status) === "passed" || normalizeStatus(latest.status) === "failed")) {
        const studentRecord = found.student.toObject ? found.student.toObject() : found.student;
        return {
          success: true,
          message: "Assessment was already finalized.",
          code: "ASSESSMENT_ALREADY_FINALIZED",
          data: {
            attemptId,
            score: numberValue(latest.totalScore),
            percentage: numberValue(latest.percentage),
            passed: normalizeStatus(latest.status) === "passed",
            internshipSelectionUnlocked: studentRecord.internshipApplicationAllowed === true,
          },
        };
      }
      return { success: false, message: "Assessment finalization failed because the attempt changed state.", code: "FINALIZATION_CONFLICT" };
    }

    const studentResult = await submitStudentAssessmentResult({
      studentId, score, passingScore: C.PASSING_MARKS, resultStatus: passed ? "passed" : "failed",
    });
    if (!studentResult.success) {
      console.error("[AssessmentService] Student lifecycle synchronization failed:", studentResult);
      return { success: true, message: "Assessment finalized, but student lifecycle synchronization requires reconciliation.", code: "ASSESSMENT_FINALIZED_SYNC_PENDING", data: { attemptId, score, percentage: calculatePercentage(score), passed, studentSync: false } };
    }
    return {
      success: true, message: passed ? "Assessment passed successfully." : "Assessment failed.",
      code: passed ? "ASSESSMENT_PASSED" : "ASSESSMENT_FAILED",
      data: { attemptId, score, percentage: calculatePercentage(score), passed, mcqScore, codingScore, totalMarks: C.TOTAL_MARKS, passingMarks: C.PASSING_MARKS, internshipSelectionUnlocked: passed, studentSync: true },
    };
  } catch (error) {
    return errorResult("[AssessmentService] finalizeAssessmentAttempt", error);
  }
}

export async function getAssessmentHistory(studentId: string, limit = 20): Promise<ServiceResult<{ attempts: AssessmentHistoryItem[] }>> {
  try {
    const id = cleanString(studentId, MAX_ID_LENGTH);
    if (!id) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    const student = await findStudent(id);
    if (!student) return { success: false, message: "Student account was not found.", code: "STUDENT_NOT_FOUND" };
    const safeLimit = Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.floor(numberValue(limit, 20))));
    const Attempt = await getAttemptModel();
    const attempts = await Attempt.find({ studentId: student._id })
      .sort({ createdAt: -1 }).limit(safeLimit).lean().exec() as AnyRecord[];
    return {
      success: true, message: "Assessment history loaded successfully.", code: "ASSESSMENT_HISTORY_LOADED",
      data: {
        attempts: attempts.map((a) => ({
          attemptId: cleanString(a.attemptId, MAX_ID_LENGTH),
          assessmentId: cleanString(a.assessmentId, MAX_ID_LENGTH),
          status: normalizeStatus(a.status), currentPhase: normalizeStatus(a.currentPhase),
          score: clampScore(a.totalScore), percentage: clampPercentage(a.percentage),
          passingMarks: numberValue(a.passingMarks, C.PASSING_MARKS), passed: a.passed === true,
          startedAt: safeDate(a.startedAt), submittedAt: safeDate(a.submittedAt),
          evaluatedAt: safeDate(a.evaluatedAt), createdAt: safeDate(a.createdAt), updatedAt: safeDate(a.updatedAt),
        })),
      },
    };
  } catch (error) {
    return errorResult("[AssessmentService] getAssessmentHistory", error);
  }
}

export async function validateAttemptOwnership(input: AssessmentAttemptInput): Promise<ServiceResult<{ valid: boolean; attemptId?: string; studentId?: string }>> {
  try {
    const studentId = cleanString(input?.studentId, MAX_ID_LENGTH);
    const attemptId = cleanString(input?.attemptId, MAX_ID_LENGTH);
    if (!studentId) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    if (!attemptId) return { success: false, message: "Assessment attempt ID is required.", code: "INVALID_ATTEMPT_ID" };
    const found = await findStudentAndAttempt(studentId, attemptId);
    if (!found) return { success: true, message: "Assessment attempt does not belong to the student.", code: "ATTEMPT_OWNERSHIP_INVALID", data: { valid: false } };
    return { success: true, message: "Assessment attempt ownership verified.", code: "ATTEMPT_OWNERSHIP_VALID", data: { valid: true, attemptId, studentId } };
  } catch (error) {
    return errorResult("[AssessmentService] validateAttemptOwnership", error);
  }
}

export async function expireActiveAttempt(input: AssessmentAttemptInput): Promise<ServiceResult> {
  try {
    const studentId = cleanString(input?.studentId, MAX_ID_LENGTH);
    const attemptId = cleanString(input?.attemptId, MAX_ID_LENGTH);
    if (!studentId) return { success: false, message: "Student ID is required.", code: "INVALID_STUDENT_ID" };
    if (!attemptId) return { success: false, message: "Assessment attempt ID is required.", code: "INVALID_ATTEMPT_ID" };
    const found = await findStudentAndAttempt(studentId, attemptId);
    if (!found) return { success: false, message: "Assessment attempt was not found.", code: "ATTEMPT_NOT_FOUND" };
    const expired = await expireAttemptIfRequired(found.attempt);
    if (!expired) return { success: false, message: "Assessment attempt has not reached its final deadline.", code: "ATTEMPT_NOT_EXPIRED" };
    return { success: true, message: "Assessment attempt expired successfully.", code: "ASSESSMENT_EXPIRED", data: { attemptId, status: "expired" } };
  } catch (error) {
    return errorResult("[AssessmentService] expireActiveAttempt", error);
  }
}

export function calculatePercentage(score: number): number {
  return Number(((clampScore(score) / C.TOTAL_MARKS) * 100).toFixed(2));
}

export function isPassingScore(score: number): boolean {
  return clampScore(score) >= C.PASSING_MARKS;
}

export function getResultStatus(score: number): "passed" | "failed" {
  return isPassingScore(score) ? "passed" : "failed";
}

const assessmentService = {
  getAssessmentConfiguration,
  startAssessment,
  submitAssessmentResult,
  getActiveAttempt,
  getAssessmentAttempt,
  getAssessmentStatus,
  recordIntegrityEvents,
  markEvaluationPending,
  finalizeAssessmentAttempt,
  getAssessmentHistory,
  validateAttemptOwnership,
  expireActiveAttempt,
  calculatePercentage,
  isPassingScore,
  getResultStatus,
};

export default assessmentService;
