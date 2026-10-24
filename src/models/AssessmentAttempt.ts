import "server-only";

import mongoose, { Schema, Types, type Model } from "mongoose";
import { connectDB } from "@/lib/db";

/**
 * Assessment attempt persistence model.
 * API/service code must authenticate callers, verify ownership and calculate
 * authoritative scores. Never execute student code inside the Next.js process.
 */
export const ASSESSMENT_CONSTANTS = {
  MCQ_COUNT: 30,
  CODING_COUNT: 2,
  MCQ_MARKS_PER_QUESTION: 2,
  CODING_MARKS_PER_QUESTION: 20,
  MCQ_TOTAL_MARKS: 60,
  CODING_TOTAL_MARKS: 40,
  TOTAL_MARKS: 100,
  PASSING_MARKS: 40,
  PASSING_PERCENTAGE: 40,
  MCQ_DURATION_MINUTES: 30,
  CODING_DURATION_MINUTES: 30,
  TOTAL_DURATION_MINUTES: 60,
  MCQ_DURATION_SECONDS: 1800,
  CODING_DURATION_SECONDS: 1800,
  TOTAL_DURATION_SECONDS: 3600,
} as const;

export const ASSESSMENT_ATTEMPT_STATUS = [
  "in-progress", "coding-in-progress", "submitted", "evaluating",
  "passed", "failed", "expired", "cancelled",
] as const;
export type AssessmentAttemptStatus = (typeof ASSESSMENT_ATTEMPT_STATUS)[number];

export const ASSESSMENT_PHASE = ["mcq", "coding", "completed"] as const;
export type AssessmentPhase = (typeof ASSESSMENT_PHASE)[number];
export const QUESTION_SECTION = ["mcq", "coding"] as const;
export type QuestionSection = (typeof QUESTION_SECTION)[number];
export const CODING_SUBMISSION_STATUS = [
  "not-submitted", "submitted", "evaluating", "evaluated", "failed",
] as const;
export type CodingSubmissionStatus = (typeof CODING_SUBMISSION_STATUS)[number];

export interface IAttemptQuestion {
  questionId: string;
  section: QuestionSection;
  order: number;
  marks: number;
  question: string;
  options?: string[];
  language?: string;
  languages?: string[];
  starterCode?: string;
  inputFormat?: string;
  outputFormat?: string;
  examples?: unknown[];
  constraints?: string;
}
export interface IMCQAnswer {
  questionId: string;
  answer: string;
  answeredAt: Date;
  marksAwarded: number;
}
export interface ICodingAnswer {
  questionId: string;
  language: string;
  code: string;
  submittedAt?: Date;
  status: CodingSubmissionStatus;
  marksAwarded: number;
  executionTimeMs?: number;
  memoryUsedKb?: number;
  testCasesPassed?: number;
  testCasesTotal?: number;
  evaluationMessage?: string;
  evaluatedAt?: Date;
}
export interface IAssessmentAttempt {
  _id: Types.ObjectId;
  attemptId: string;
  studentId: Types.ObjectId;
  assessmentId: string;
  domain: string;
  internshipTrack: string;
  status: AssessmentAttemptStatus;
  currentPhase: AssessmentPhase;
  questions: IAttemptQuestion[];
  startedAt: Date;
  mcqStartedAt: Date;
  mcqDeadline: Date;
  codingStartedAt?: Date;
  codingDeadline?: Date;
  finalDeadline: Date;
  mcqAnswers: IMCQAnswer[];
  codingAnswers: ICodingAnswer[];
  mcqScore: number;
  codingScore: number;
  totalScore: number;
  percentage: number;
  passingMarks: number;
  passed: boolean;
  tabSwitches: number;
  fullscreenExitCount: number;
  copyAttempts: number;
  pasteAttempts: number;
  shortcutAttempts: number;
  lastActivityAt?: Date;
  submittedAt?: Date;
  submittedBy?: "student" | "system";
  evaluationStartedAt?: Date;
  evaluatedAt?: Date;
  resultDeclaredAt?: Date;
  evaluationError?: string;
  ipHash?: string;
  userAgent?: string;
  questionBankVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

const C = ASSESSMENT_CONSTANTS;
const MAX_COUNTER = 1000;
const safeInteger = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value);
const safeNonNegativeInteger = (value: unknown) =>
  safeInteger(value) && Number(value) >= 0;
const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

const AttemptQuestionSchema = new Schema<IAttemptQuestion>({
  questionId: { type: String, required: true, trim: true, maxlength: 256 },
  section: { type: String, required: true, enum: QUESTION_SECTION },
  order: {
    type: Number, required: true, min: 1, max: C.MCQ_COUNT + C.CODING_COUNT,
    validate: { validator: safeInteger, message: "Question order must be an integer." },
  },
  marks: {
    type: Number, required: true, min: 0, max: C.CODING_MARKS_PER_QUESTION,
    validate: { validator: safeInteger, message: "Question marks must be an integer." },
  },
  question: { type: String, required: true, trim: true, maxlength: 20_000 },
  options: {
    type: [String], default: undefined,
    validate: {
      validator: (v: string[] | undefined) => v === undefined ||
        (v.length === 4 && v.every((s) => nonEmpty(s) && s.length <= 5000)),
      message: "MCQ questions must contain exactly four non-empty options.",
    },
  },
  language: { type: String, trim: true, maxlength: 100 },
  languages: {
    type: [String], default: undefined,
    validate: {
      validator: (v: string[] | undefined) => {
        if (v === undefined) return true;
        if (v.length > 20 || !v.every((s) => nonEmpty(s) && s.length <= 100)) return false;
        const normalized = v.map((s) => s.trim().toLowerCase());
        return new Set(normalized).size === normalized.length;
      },
      message: "Allowed languages must be non-empty and unique.",
    },
  },
  starterCode: { type: String, maxlength: 30_000 },
  inputFormat: { type: String, maxlength: 10_000 },
  outputFormat: { type: String, maxlength: 10_000 },
  examples: {
    type: [Schema.Types.Mixed], default: undefined,
    validate: { validator: (v: unknown[] | undefined) => v === undefined || v.length <= 20 },
  },
  constraints: { type: String, maxlength: 10_000 },
}, { _id: false, id: false, strict: "throw" });

const MCQAnswerSchema = new Schema<IMCQAnswer>({
  questionId: { type: String, required: true, trim: true, maxlength: 256 },
  answer: { type: String, required: true, trim: true, uppercase: true, enum: ["A", "B", "C", "D"] },
  answeredAt: { type: Date, required: true },
  marksAwarded: {
    type: Number, required: true, default: 0, min: 0, max: C.MCQ_MARKS_PER_QUESTION,
    validate: { validator: safeInteger, message: "Awarded MCQ marks must be an integer." },
  },
}, { _id: false, id: false, strict: "throw" });

const CodingAnswerSchema = new Schema<ICodingAnswer>({
  questionId: { type: String, required: true, trim: true, maxlength: 256 },
  language: { type: String, required: true, trim: true, maxlength: 100 },
  code: { type: String, required: true, maxlength: 50_000 },
  submittedAt: Date,
  status: { type: String, required: true, enum: CODING_SUBMISSION_STATUS, default: "not-submitted" },
  marksAwarded: {
    type: Number, required: true, default: 0, min: 0, max: C.CODING_MARKS_PER_QUESTION,
    validate: { validator: safeInteger, message: "Awarded coding marks must be an integer." },
  },
  executionTimeMs: {
    type: Number, min: 0, max: 600_000,
    validate: { validator: (v: number | undefined) => v === undefined || safeNonNegativeInteger(v) },
  },
  memoryUsedKb: {
    type: Number, min: 0, max: 2_147_483_647,
    validate: { validator: (v: number | undefined) => v === undefined || safeNonNegativeInteger(v) },
  },
  testCasesPassed: {
    type: Number, min: 0, max: 100_000,
    validate: { validator: (v: number | undefined) => v === undefined || safeNonNegativeInteger(v) },
  },
  testCasesTotal: {
    type: Number, min: 0, max: 100_000,
    validate: { validator: (v: number | undefined) => v === undefined || safeNonNegativeInteger(v) },
  },
  evaluationMessage: { type: String, maxlength: 5000 },
  evaluatedAt: Date,
}, { _id: false, id: false, strict: "throw" });

export const AssessmentAttemptSchema = new Schema<IAssessmentAttempt>({
  attemptId: { type: String, required: true, unique: true, trim: true, immutable: true, maxlength: 100 },
  studentId: { type: Schema.Types.ObjectId, required: true, immutable: true, index: true },
  assessmentId: { type: String, required: true, trim: true, maxlength: 256, immutable: true },
  domain: { type: String, required: true, trim: true, maxlength: 200, immutable: true, index: true },
  internshipTrack: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
  status: { type: String, required: true, enum: ASSESSMENT_ATTEMPT_STATUS, default: "in-progress", index: true },
  currentPhase: { type: String, required: true, enum: ASSESSMENT_PHASE, default: "mcq" },
  questions: {
    type: [AttemptQuestionSchema], required: true,
    validate: {
      validator: (qs: IAttemptQuestion[]) => {
        if (!Array.isArray(qs) || qs.length !== C.MCQ_COUNT + C.CODING_COUNT) return false;
        const mcqs = qs.filter((q) => q.section === "mcq");
        const coding = qs.filter((q) => q.section === "coding");
        const ids = qs.map((q) => q.questionId?.trim());
        const orders = qs.map((q) => q.order);
        return mcqs.length === C.MCQ_COUNT && coding.length === C.CODING_COUNT &&
          ids.every(Boolean) && new Set(ids).size === ids.length &&
          orders.every((n) => safeInteger(n) && n >= 1 && n <= qs.length) &&
          new Set(orders).size === orders.length &&
          mcqs.every((q) => q.marks === C.MCQ_MARKS_PER_QUESTION && Array.isArray(q.options) && q.options.length === 4) &&
          coding.every((q) => q.marks === C.CODING_MARKS_PER_QUESTION) &&
          mcqs.reduce((s, q) => s + q.marks, 0) === C.MCQ_TOTAL_MARKS &&
          coding.reduce((s, q) => s + q.marks, 0) === C.CODING_TOTAL_MARKS;
      },
      message: "Attempt must contain 30 two-mark MCQs and 2 twenty-mark coding questions.",
    },
  },
  startedAt: { type: Date, required: true, immutable: true },
  mcqStartedAt: { type: Date, required: true, immutable: true },
  mcqDeadline: { type: Date, required: true, immutable: true },
  codingStartedAt: Date,
  codingDeadline: Date,
  finalDeadline: { type: Date, required: true, immutable: true },
  mcqAnswers: {
    type: [MCQAnswerSchema], default: [],
    validate: {
      validator: (as: IMCQAnswer[]) => Array.isArray(as) && as.length <= C.MCQ_COUNT &&
        as.every((a) => nonEmpty(a.questionId)) &&
        new Set(as.map((a) => a.questionId.trim())).size === as.length,
      message: "MCQ answers must have unique IDs and cannot exceed 30 answers.",
    },
  },
  codingAnswers: {
    type: [CodingAnswerSchema], default: [],
    validate: {
      validator: (as: ICodingAnswer[]) => Array.isArray(as) && as.length <= C.CODING_COUNT &&
        as.every((a) => nonEmpty(a.questionId)) &&
        new Set(as.map((a) => a.questionId.trim())).size === as.length,
      message: "Coding answers must have unique IDs and cannot exceed 2 answers.",
    },
  },
  mcqScore: { type: Number, required: true, default: 0, min: 0, max: C.MCQ_TOTAL_MARKS, validate: { validator: safeInteger } },
  codingScore: { type: Number, required: true, default: 0, min: 0, max: C.CODING_TOTAL_MARKS, validate: { validator: safeInteger } },
  totalScore: { type: Number, required: true, default: 0, min: 0, max: C.TOTAL_MARKS, validate: { validator: safeInteger } },
  percentage: { type: Number, required: true, default: 0, min: 0, max: 100 },
  passingMarks: { type: Number, required: true, default: C.PASSING_MARKS, immutable: true },
  passed: { type: Boolean, required: true, default: false },
  tabSwitches: { type: Number, required: true, default: 0, min: 0, max: MAX_COUNTER, validate: { validator: safeInteger } },
  fullscreenExitCount: { type: Number, required: true, default: 0, min: 0, max: MAX_COUNTER, validate: { validator: safeInteger } },
  copyAttempts: { type: Number, required: true, default: 0, min: 0, max: MAX_COUNTER, validate: { validator: safeInteger } },
  pasteAttempts: { type: Number, required: true, default: 0, min: 0, max: MAX_COUNTER, validate: { validator: safeInteger } },
  shortcutAttempts: { type: Number, required: true, default: 0, min: 0, max: MAX_COUNTER, validate: { validator: safeInteger } },
  lastActivityAt: Date,
  submittedAt: Date,
  submittedBy: { type: String, enum: ["student", "system"] },
  evaluationStartedAt: Date,
  evaluatedAt: Date,
  resultDeclaredAt: Date,
  evaluationError: { type: String, maxlength: 5000, select: false },
  ipHash: { type: String, maxlength: 256, select: false },
  userAgent: { type: String, maxlength: 1000, select: false },
  questionBankVersion: { type: String, maxlength: 100 },
}, {
  timestamps: true,
  strict: "throw",
  versionKey: false,
  id: false,
  collection: "assessmentattempts",
  autoIndex: process.env.NODE_ENV !== "production",
});

AssessmentAttemptSchema.index({ studentId: 1, createdAt: -1 });
AssessmentAttemptSchema.index({ assessmentId: 1, domain: 1, status: 1 });
AssessmentAttemptSchema.index({ status: 1, submittedAt: 1 });
AssessmentAttemptSchema.index(
  { studentId: 1 },
  {
    name: "active_student_attempt_unique",
    unique: true,
    partialFilterExpression: {
      status: { $in: ["in-progress", "coding-in-progress", "submitted", "evaluating"] },
    },
  },
);

const MODEL_NAME = "AssessmentAttempt";
const COLLECTION_NAME = "assessmentattempts";

/**
 * Preserves the current service contract: StudentModel and assessment attempts
 * use the Main Careers connection. If moving attempts to Student Operations,
 * migrate the service and all assessment routes together.
 */
export async function getAssessmentAttemptModel(): Promise<Model<IAssessmentAttempt>> {
  await connectDB();
  const connection = mongoose.connection;
  if (connection.readyState !== 1) {
    throw new Error("Main Careers MongoDB is not connected. Assessment attempt operations cannot continue.");
  }
  const existing = connection.models[MODEL_NAME] as Model<IAssessmentAttempt> | undefined;
  if (existing) return existing;
  return connection.model<IAssessmentAttempt>(MODEL_NAME, AssessmentAttemptSchema, COLLECTION_NAME);
}

export type AssessmentAttemptDocument = IAssessmentAttempt;
export type AttemptQuestion = IAttemptQuestion;
export type MCQAnswer = IMCQAnswer;
export type CodingAnswer = ICodingAnswer;

export default getAssessmentAttemptModel;
