import mongoose, {
  Schema,
  Types,
  type Model,
} from "mongoose";

import { connectDB } from "@/lib/db";

/**
 * CyberNet Careers — Assessment Attempt model.
 *
 * Security boundaries:
 * - This model stores attempt snapshots, not authoritative question-bank answer keys.
 * - Hidden coding test cases must never be copied into attempt snapshots.
 * - Scores and pass/fail decisions must be calculated by trusted server-side code.
 * - Submitted source code must only run in a separately isolated code runner.
 * - Student identity/authorization must be verified by the API/service layer.
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
  MCQ_DURATION_SECONDS: 30 * 60,
  CODING_DURATION_SECONDS: 30 * 60,
  TOTAL_DURATION_SECONDS: 60 * 60,
} as const;

export const ASSESSMENT_ATTEMPT_STATUS = [
  "in-progress",
  "coding-in-progress",
  "submitted",
  "evaluating",
  "passed",
  "failed",
  "expired",
  "cancelled",
] as const;

export type AssessmentAttemptStatus =
  (typeof ASSESSMENT_ATTEMPT_STATUS)[number];

export const ASSESSMENT_PHASE = ["mcq", "coding", "completed"] as const;
export type AssessmentPhase = (typeof ASSESSMENT_PHASE)[number];

export const QUESTION_SECTION = ["mcq", "coding"] as const;
export type QuestionSection = (typeof QUESTION_SECTION)[number];

export const CODING_SUBMISSION_STATUS = [
  "not-submitted",
  "submitted",
  "evaluating",
  "evaluated",
  "failed",
] as const;
export type CodingSubmissionStatus =
  (typeof CODING_SUBMISSION_STATUS)[number];

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

function isSafeNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

const AttemptQuestionSchema = new Schema<IAttemptQuestion>(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    section: {
      type: String,
      required: true,
      enum: QUESTION_SECTION,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
      max: C.MCQ_COUNT + C.CODING_COUNT,
      validate: {
        validator: Number.isSafeInteger,
        message: "Question order must be an integer.",
      },
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
      max: C.CODING_MARKS_PER_QUESTION,
      validate: {
        validator: Number.isSafeInteger,
        message: "Question marks must be an integer.",
      },
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20_000,
    },
    options: {
      type: [String],
      default: undefined,
      validate: {
        validator(value: string[] | undefined): boolean {
          if (value === undefined) return true;
          return (
            value.length === 4 &&
            value.every((item) => isNonEmptyString(item) && item.length <= 5_000)
          );
        },
        message: "MCQ questions must contain exactly four non-empty options.",
      },
    },
    language: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    languages: {
      type: [String],
      default: undefined,
      validate: {
        validator(value: string[] | undefined): boolean {
          return (
            value === undefined ||
            (value.length <= 20 &&
              value.every((item) => isNonEmptyString(item) && item.length <= 100) &&
              new Set(value.map((item) => item.trim().toLowerCase())).size === value.length)
          );
        },
        message: "Allowed languages must be non-empty and unique.",
      },
    },
    starterCode: {
      type: String,
      maxlength: 30_000,
    },
    inputFormat: {
      type: String,
      maxlength: 10_000,
    },
    outputFormat: {
      type: String,
      maxlength: 10_000,
    },
    examples: {
      type: [Schema.Types.Mixed],
      default: undefined,
      validate: {
        validator(value: unknown[] | undefined): boolean {
          return value === undefined || value.length <= 20;
        },
        message: "A coding question cannot contain more than 20 public examples.",
      },
    },
    constraints: {
      type: String,
      maxlength: 10_000,
    },
  },
  {
    _id: false,
    id: false,
    strict: "throw",
  },
);

const MCQAnswerSchema = new Schema<IMCQAnswer>(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: ["A", "B", "C", "D"],
    },
    answeredAt: {
      type: Date,
      required: true,
    },
    marksAwarded: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.MCQ_MARKS_PER_QUESTION,
      validate: {
        validator: Number.isSafeInteger,
        message: "Awarded MCQ marks must be an integer.",
      },
    },
  },
  {
    _id: false,
    id: false,
    strict: "throw",
  },
);

const CodingAnswerSchema = new Schema<ICodingAnswer>(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    language: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    code: {
      type: String,
      required: true,
      maxlength: 50_000,
    },
    submittedAt: Date,
    status: {
      type: String,
      enum: CODING_SUBMISSION_STATUS,
      default: "not-submitted",
      required: true,
    },
    marksAwarded: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.CODING_MARKS_PER_QUESTION,
      validate: {
        validator: Number.isSafeInteger,
        message: "Awarded coding marks must be an integer.",
      },
    },
    executionTimeMs: {
      type: Number,
      min: 0,
      max: 600_000,
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || Number.isSafeInteger(value),
        message: "Execution time must be a non-negative integer.",
      },
    },
    memoryUsedKb: {
      type: Number,
      min: 0,
      max: 2_147_483_647,
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || isSafeNonNegativeInteger(value),
        message: "Memory usage must be a non-negative integer in kilobytes.",
      },
    },
    testCasesPassed: {
      type: Number,
      min: 0,
      max: 100_000,
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || isSafeNonNegativeInteger(value),
        message: "Passed test case count must be a non-negative integer.",
      },
    },
    testCasesTotal: {
      type: Number,
      min: 0,
      max: 100_000,
      validate: {
        validator: (value: number | undefined) =>
          value === undefined || isSafeNonNegativeInteger(value),
        message: "Total test case count must be a non-negative integer.",
      },
    },
    evaluationMessage: {
      type: String,
      maxlength: 5_000,
    },
    evaluatedAt: Date,
  },
  {
    _id: false,
    id: false,
    strict: "throw",
  },
);

export const AssessmentAttemptSchema = new Schema<IAssessmentAttempt>(
  {
    attemptId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
      maxlength: 100,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      index: true,
    },
    assessmentId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
      immutable: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      immutable: true,
      index: true,
    },
    internshipTrack: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      immutable: true,
    },
    status: {
      type: String,
      required: true,
      enum: ASSESSMENT_ATTEMPT_STATUS,
      default: "in-progress",
      index: true,
    },
    currentPhase: {
      type: String,
      required: true,
      enum: ASSESSMENT_PHASE,
      default: "mcq",
    },
    questions: {
      type: [AttemptQuestionSchema],
      required: true,
      validate: {
        validator(questions: IAttemptQuestion[]): boolean {
          if (!Array.isArray(questions) || questions.length !== C.MCQ_COUNT + C.CODING_COUNT) {
            return false;
          }

          const mcqs = questions.filter((q) => q.section === "mcq");
          const coding = questions.filter((q) => q.section === "coding");
          const ids = questions.map((q) => q.questionId?.trim());
          const orders = questions.map((q) => q.order);
          const mcqMarks = mcqs.reduce((sum, q) => sum + Number(q.marks || 0), 0);
          const codingMarks = coding.reduce((sum, q) => sum + Number(q.marks || 0), 0);

          return (
            mcqs.length === C.MCQ_COUNT &&
            coding.length === C.CODING_COUNT &&
            ids.every(Boolean) &&
            new Set(ids).size === ids.length &&
            orders.every((order) => Number.isSafeInteger(order) && order >= 1 && order <= questions.length) &&
            new Set(orders).size === orders.length &&
            mcqs.every((q) => q.marks === C.MCQ_MARKS_PER_QUESTION &&
              Array.isArray(q.options) && q.options.length === 4) &&
            coding.every((q) => q.marks === C.CODING_MARKS_PER_QUESTION) &&
            mcqMarks === C.MCQ_TOTAL_MARKS &&
            codingMarks === C.CODING_TOTAL_MARKS
          );
        },
        message: "An attempt must contain 30 MCQs worth 2 marks each and 2 coding questions worth 20 marks each.",
      },
    },
    startedAt: {
      type: Date,
      required: true,
      immutable: true,
    },
    mcqStartedAt: {
      type: Date,
      required: true,
      immutable: true,
    },
    mcqDeadline: {
      type: Date,
      required: true,
      immutable: true,
    },
    codingStartedAt: Date,
    codingDeadline: Date,
    finalDeadline: {
      type: Date,
      required: true,
      immutable: true,
    },
    mcqAnswers: {
      type: [MCQAnswerSchema],
      default: [],
      validate: {
        validator(answers: IMCQAnswer[]): boolean {
          if (!Array.isArray(answers) || answers.length > C.MCQ_COUNT) return false;
          const ids = answers.map((answer) => answer.questionId?.trim());
          return ids.every(Boolean) && new Set(ids).size === ids.length;
        },
        message: "MCQ answers must have unique question IDs and cannot exceed 30 answers.",
      },
    },
    codingAnswers: {
      type: [CodingAnswerSchema],
      default: [],
      validate: {
        validator(answers: ICodingAnswer[]): boolean {
          if (!Array.isArray(answers) || answers.length > C.CODING_COUNT) return false;
          const ids = answers.map((answer) => answer.questionId?.trim());
          return ids.every(Boolean) && new Set(ids).size === ids.length;
        },
        message: "Coding answers must have unique question IDs and cannot exceed 2 answers.",
      },
    },
    mcqScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.MCQ_TOTAL_MARKS,
      validate: {
        validator: Number.isSafeInteger,
        message: "MCQ score must be an integer.",
      },
    },
    codingScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.CODING_TOTAL_MARKS,
      validate: {
        validator: Number.isSafeInteger,
        message: "Coding score must be an integer.",
      },
    },
    totalScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.TOTAL_MARKS,
      validate: {
        validator: Number.isSafeInteger,
        message: "Total score must be an integer.",
      },
    },
    percentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    passingMarks: {
      type: Number,
      required: true,
      default: C.PASSING_MARKS,
      immutable: true,
    },
    passed: {
      type: Boolean,
      required: true,
      default: false,
    },
    tabSwitches: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1000,
      validate: { validator: Number.isSafeInteger },
    },
    fullscreenExitCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1000,
      validate: { validator: Number.isSafeInteger },
    },
    copyAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1000,
      validate: { validator: Number.isSafeInteger },
    },
    pasteAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1000,
      validate: { validator: Number.isSafeInteger },
    },
    shortcutAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1000,
      validate: { validator: Number.isSafeInteger },
    },
    lastActivityAt: Date,
    submittedAt: Date,
    submittedBy: {
      type: String,
      enum: ["student", "system"],
    },
    evaluationStartedAt: Date,
    evaluatedAt: Date,
    resultDeclaredAt: Date,
    evaluationError: {
      type: String,
      maxlength: 5_000,
      select: false,
    },
    ipHash: {
      type: String,
      maxlength: 256,
      select: false,
    },
    userAgent: {
      type: String,
      maxlength: 1_000,
      select: false,
    },
    questionBankVersion: {
      type: String,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
    id: false,
    collection: "assessmentattempts",
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

// Query indexes used by attempt history, admin review and evaluation workers.
AssessmentAttemptSchema.index({ studentId: 1, createdAt: -1 });
AssessmentAttemptSchema.index({ assessmentId: 1, domain: 1, status: 1 });
AssessmentAttemptSchema.index({ status: 1, submittedAt: 1 });

/**
 * Prevent multiple active/pending attempts for a student.
 * Keep this index consistent with ACTIVE statuses used by service code.
 */
AssessmentAttemptSchema.index(
  { studentId: 1 },
  {
    name: "active_student_attempt_unique",
    unique: true,
    partialFilterExpression: {
      status: {
        $in: ["in-progress", "coding-in-progress", "submitted", "evaluating"],
      },
    },
  },
);

const MODEL_NAME = "AssessmentAttempt";
const COLLECTION_NAME = "assessmentattempts";

/**
 * Resolve the model after connecting to the Main Careers database.
 * This async resolver preserves the existing API import contract.
 */
export async function getAssessmentAttemptModel(): Promise<Model<IAssessmentAttempt>> {
  await connectDB();

  const connection = mongoose.connection;
  if (connection.readyState !== 1) {
    throw new Error(
      "Main Careers MongoDB is not connected. Assessment attempt operations cannot continue.",
    );
  }

  const existing = connection.models[MODEL_NAME] as Model<IAssessmentAttempt> | undefined;
  if (existing) return existing;

  return connection.model<IAssessmentAttempt>(
    MODEL_NAME,
    AssessmentAttemptSchema,
    COLLECTION_NAME,
  );
}

export type AssessmentAttemptDocument = IAssessmentAttempt;
export type AttemptQuestion = IAttemptQuestion;
export type MCQAnswer = IMCQAnswer;
export type CodingAnswer = ICodingAnswer;

export default getAssessmentAttemptModel;
