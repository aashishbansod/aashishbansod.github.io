import "server-only";

import mongoose, { Schema, Types, type Model } from "mongoose";
import { connectDB } from "@/lib/db";

export const ASSESSMENT_CONSTANTS = {
  MCQ_COUNT: 90,
  EASY_COUNT: 30,
  MEDIUM_COUNT: 30,
  HARD_COUNT: 30,
  CODING_COUNT: 0,
  MCQ_MARKS_PER_QUESTION: 1,
  CODING_MARKS_PER_QUESTION: 0,
  MCQ_TOTAL_MARKS: 90,
  CODING_TOTAL_MARKS: 0,
  TOTAL_MARKS: 90,
  PASSING_MARKS: 36,
  PASSING_PERCENTAGE: 40,
  MCQ_DURATION_MINUTES: 90,
  CODING_DURATION_MINUTES: 0,
  TOTAL_DURATION_MINUTES: 90,
  MCQ_DURATION_SECONDS: 5400,
  CODING_DURATION_SECONDS: 0,
  TOTAL_DURATION_SECONDS: 5400,
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

export type AssessmentAttemptStatus = (typeof ASSESSMENT_ATTEMPT_STATUS)[number];

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

export type CodingSubmissionStatus = (typeof CODING_SUBMISSION_STATUS)[number];
export type AssessmentDifficulty = "easy" | "medium" | "hard";

export interface IAttemptQuestion {
  questionId: string;
  section: QuestionSection;
  difficulty: AssessmentDifficulty;
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
const OPTION_IDS = ["A", "B", "C", "D"] as const;
const DIFFICULTIES: AssessmentDifficulty[] = ["easy", "medium", "hard"];

const safeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);

const safeNonNegativeInteger = (value: unknown): value is number =>
  safeInteger(value) && value >= 0;

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validDate = (value: unknown): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime());

function validateQuestionSnapshot(questions: IAttemptQuestion[]): boolean {
  if (!Array.isArray(questions) || questions.length !== C.MCQ_COUNT) return false;

  const questionIds: string[] = [];
  const orders: number[] = [];

  for (const question of questions) {
    if (!question || typeof question !== "object") return false;
    if (!nonEmpty(question.questionId) || !safeInteger(question.order)) return false;
    questionIds.push(question.questionId.trim());
    orders.push(question.order);
  }

  orders.sort((a, b) => a - b);

  if (
    questionIds.some((id) => !id) ||
    new Set(questionIds).size !== C.MCQ_COUNT ||
    !orders.every((order, index) => order === index + 1)
  ) {
    return false;
  }

  const counts = {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  for (const question of questions) {
    if (
      question.section !== "mcq" ||
      !DIFFICULTIES.includes(question.difficulty) ||
      !nonEmpty(question.question) ||
      question.question.length > 20_000 ||
      question.marks !== C.MCQ_MARKS_PER_QUESTION ||
      !Array.isArray(question.options) ||
      question.options.length !== 4 ||
      !question.options.every((option) => nonEmpty(option) && option.length <= 5000)
    ) {
      return false;
    }

    counts[question.difficulty] += 1;
  }

  return (
    counts.easy === C.EASY_COUNT &&
    counts.medium === C.MEDIUM_COUNT &&
    counts.hard === C.HARD_COUNT &&
    questions.reduce((total, question) => total + question.marks, 0) === C.TOTAL_MARKS
  );
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
      enum: ["mcq"],
      default: "mcq",
    },
    difficulty: {
      type: String,
      required: true,
      enum: DIFFICULTIES,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
      max: C.MCQ_COUNT,
      validate: {
        validator: safeInteger,
        message: "Question order must be an integer between 1 and 90.",
      },
    },
    marks: {
      type: Number,
      required: true,
      min: C.MCQ_MARKS_PER_QUESTION,
      max: C.MCQ_MARKS_PER_QUESTION,
      validate: {
        validator: (value: number) => value === C.MCQ_MARKS_PER_QUESTION,
        message: "Every MCQ must carry exactly one mark.",
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
      required: true,
      validate: {
        validator: (value: string[]) =>
          Array.isArray(value) &&
          value.length === 4 &&
          value.every((option) => nonEmpty(option) && option.length <= 5000),
        message: "Every MCQ must contain exactly four non-empty options.",
      },
    },
    language: {
      type: String,
      trim: true,
      maxlength: 100,
      select: false,
    },
    languages: {
      type: [String],
      default: undefined,
      select: false,
      validate: {
        validator: (value: string[] | undefined) => {
          if (value === undefined) return true;
          if (value.length > 20 || !value.every((item) => nonEmpty(item) && item.length <= 100)) {
            return false;
          }
          const normalized = value.map((item) => item.trim().toLowerCase());
          return new Set(normalized).size === normalized.length;
        },
        message: "Allowed languages must be non-empty and unique.",
      },
    },
    starterCode: {
      type: String,
      maxlength: 30_000,
      select: false,
    },
    inputFormat: {
      type: String,
      maxlength: 10_000,
      select: false,
    },
    outputFormat: {
      type: String,
      maxlength: 10_000,
      select: false,
    },
    examples: {
      type: [Schema.Types.Mixed],
      default: undefined,
      select: false,
      validate: {
        validator: (value: unknown[] | undefined) =>
          value === undefined || value.length <= 20,
      },
    },
    constraints: {
      type: String,
      maxlength: 10_000,
      select: false,
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
      enum: OPTION_IDS,
    },
    answeredAt: {
      type: Date,
      required: true,
      validate: {
        validator: validDate,
        message: "Answer timestamp must be valid.",
      },
    },
    marksAwarded: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.MCQ_MARKS_PER_QUESTION,
      validate: {
        validator: safeInteger,
        message: "Awarded MCQ marks must be an integer between 0 and 1.",
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
      required: true,
      enum: CODING_SUBMISSION_STATUS,
      default: "not-submitted",
    },
    marksAwarded: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.CODING_MARKS_PER_QUESTION,
      validate: {
        validator: safeInteger,
      },
    },
    executionTimeMs: {
      type: Number,
      min: 0,
      max: 600_000,
      validate: {
        validator: (value: number | undefined) => value === undefined || safeNonNegativeInteger(value),
      },
    },
    memoryUsedKb: {
      type: Number,
      min: 0,
      max: 2_147_483_647,
      validate: {
        validator: (value: number | undefined) => value === undefined || safeNonNegativeInteger(value),
      },
    },
    testCasesPassed: {
      type: Number,
      min: 0,
      max: 100_000,
      validate: {
        validator: (value: number | undefined) => value === undefined || safeNonNegativeInteger(value),
      },
    },
    testCasesTotal: {
      type: Number,
      min: 0,
      max: 100_000,
      validate: {
        validator: (value: number | undefined) => value === undefined || safeNonNegativeInteger(value),
      },
    },
    evaluationMessage: {
      type: String,
      maxlength: 5000,
      select: false,
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
        validator: validateQuestionSnapshot,
        message:
          "An attempt must contain exactly 90 one-mark MCQs: 30 Easy, 30 Medium and 30 Hard, with four options per question and no coding questions.",
      },
    },
    startedAt: {
      type: Date,
      required: true,
      immutable: true,
      validate: {
        validator: validDate,
      },
    },
    mcqStartedAt: {
      type: Date,
      required: true,
      immutable: true,
      validate: {
        validator: validDate,
      },
    },
    mcqDeadline: {
      type: Date,
      required: true,
      immutable: true,
      validate: {
        validator: validDate,
      },
    },
    codingStartedAt: {
      type: Date,
      select: false,
    },
    codingDeadline: {
      type: Date,
      select: false,
    },
    finalDeadline: {
      type: Date,
      required: true,
      immutable: true,
      validate: {
        validator: validDate,
      },
    },
    mcqAnswers: {
      type: [MCQAnswerSchema],
      default: [],
      validate: {
        validator: (answers: IMCQAnswer[]) =>
          Array.isArray(answers) &&
          answers.length <= C.MCQ_COUNT &&
          answers.every((answer) => nonEmpty(answer.questionId)) &&
          new Set(answers.map((answer) => answer.questionId.trim())).size === answers.length,
        message: "MCQ answers must have unique question IDs and cannot exceed 90 answers.",
      },
    },
    codingAnswers: {
      type: [CodingAnswerSchema],
      default: [],
      validate: {
        validator: (answers: ICodingAnswer[]) => Array.isArray(answers) && answers.length === 0,
        message: "Coding submissions are disabled for the frozen 90-MCQ assessment.",
      },
    },
    mcqScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.MCQ_TOTAL_MARKS,
      validate: {
        validator: safeInteger,
        message: "MCQ score must be an integer between 0 and 90.",
      },
    },
    codingScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 0,
      validate: {
        validator: (value: number) => value === 0,
        message: "Coding score must remain zero because coding is disabled.",
      },
    },
    totalScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: C.TOTAL_MARKS,
      validate: {
        validator: safeInteger,
        message: "Total score must be an integer between 0 and 90.",
      },
    },
    percentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
      validate: {
        validator: (value: number) => Number.isFinite(value) && value >= 0 && value <= 100,
        message: "Percentage must be between 0 and 100.",
      },
    },
    passingMarks: {
      type: Number,
      required: true,
      default: C.PASSING_MARKS,
      immutable: true,
      min: C.PASSING_MARKS,
      max: C.PASSING_MARKS,
      validate: {
        validator: (value: number) => value === C.PASSING_MARKS,
        message: "The frozen passing threshold is 36 marks.",
      },
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
      max: MAX_COUNTER,
      validate: {
        validator: safeNonNegativeInteger,
      },
    },
    fullscreenExitCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_COUNTER,
      validate: {
        validator: safeNonNegativeInteger,
      },
    },
    copyAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_COUNTER,
      validate: {
        validator: safeNonNegativeInteger,
      },
    },
    pasteAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_COUNTER,
      validate: {
        validator: safeNonNegativeInteger,
      },
    },
    shortcutAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_COUNTER,
      validate: {
        validator: safeNonNegativeInteger,
      },
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
      maxlength: 5000,
      select: false,
    },
    ipHash: {
      type: String,
      maxlength: 256,
      select: false,
    },
    userAgent: {
      type: String,
      maxlength: 1000,
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
    minimize: true,
  },
);

AssessmentAttemptSchema.pre("validate", function validateAttemptConsistency() {
  const document = this as unknown as IAssessmentAttempt & {
    invalidate: (path: string, message: string) => void;
  };

  const questions = Array.isArray(document.questions) ? document.questions : [];
  const questionIds = new Set(questions.map((question) => question.questionId));
  const answers = Array.isArray(document.mcqAnswers) ? document.mcqAnswers : [];

  for (const answer of answers) {
    if (!questionIds.has(answer.questionId)) {
      document.invalidate("mcqAnswers", "An answer references a question outside this attempt.");
      break;
    }

    if (!OPTION_IDS.includes(answer.answer as (typeof OPTION_IDS)[number])) {
      document.invalidate("mcqAnswers", "An answer must be one of A, B, C or D.");
      break;
    }

    if (answer.marksAwarded !== 0 && answer.marksAwarded !== 1) {
      document.invalidate("mcqAnswers", "An answer can receive only zero or one mark.");
      break;
    }
  }

  if (validDate(document.startedAt) && validDate(document.mcqStartedAt) &&
      Math.abs(document.startedAt.getTime() - document.mcqStartedAt.getTime()) > 1000) {
    document.invalidate("mcqStartedAt", "The MCQ start time must match the attempt start time.");
  }

  if (validDate(document.mcqDeadline) && validDate(document.finalDeadline) &&
      Math.abs(document.mcqDeadline.getTime() - document.finalDeadline.getTime()) > 1000) {
    document.invalidate("finalDeadline", "The MCQ and final deadlines must match for the 90-minute assessment.");
  }

  if (document.mcqAnswers?.some((answer) =>
    !validDate(answer.answeredAt) ||
    !safeInteger(answer.marksAwarded) ||
    answer.marksAwarded < 0 ||
    answer.marksAwarded > C.MCQ_MARKS_PER_QUESTION
  )) {
    document.invalidate("mcqAnswers", "Every MCQ answer must have a valid timestamp and an integer mark from zero to one.");
  }

  if (document.mcqScore !== document.mcqAnswers.reduce(
    (total, answer) => total + (safeNonNegativeInteger(answer.marksAwarded) ? answer.marksAwarded : 0),
    0,
  ) && ["passed", "failed"].includes(document.status)) {
    document.invalidate("mcqScore", "The final MCQ score must equal the marks awarded to saved answers.");
  }

  if (document.percentage !== Math.round((document.totalScore / C.TOTAL_MARKS) * 10000) / 100) {
    document.invalidate("percentage", "The percentage must match the final score out of 90.");
  }

  if (document.mcqScore > C.MCQ_TOTAL_MARKS || document.totalScore > C.TOTAL_MARKS) {
    document.invalidate("totalScore", "Assessment scores cannot exceed 90 marks.");
  }

  if (document.codingAnswers?.length) {
    document.invalidate("codingAnswers", "Coding submissions are disabled.");
  }

  if (document.currentPhase === "coding" || document.status === "coding-in-progress") {
    document.invalidate("currentPhase", "Coding phase is disabled for the frozen 90-MCQ assessment.");
  }

  if (document.codingStartedAt || document.codingDeadline) {
    document.invalidate("codingStartedAt", "Coding timing fields are disabled for this assessment.");
  }

  if (document.codingScore !== 0) {
    document.invalidate("codingScore", "Coding score must be zero.");
  }

  if (document.totalScore !== document.mcqScore) {
    document.invalidate("totalScore", "Total score must equal the MCQ score.");
  }

  if (document.passingMarks !== C.PASSING_MARKS) {
    document.invalidate("passingMarks", "Passing marks are fixed at 36.");
  }

  if (validDate(document.startedAt) && validDate(document.finalDeadline)) {
    const expectedDeadline = document.startedAt.getTime() + C.TOTAL_DURATION_SECONDS * 1000;
    const actualDeadline = document.finalDeadline.getTime();

    if (Math.abs(actualDeadline - expectedDeadline) > 1000) {
      document.invalidate("finalDeadline", "The assessment deadline must be exactly 90 minutes after start.");
    }
  }

  if (validDate(document.startedAt) && validDate(document.mcqDeadline)) {
    const expectedDeadline = document.startedAt.getTime() + C.MCQ_DURATION_SECONDS * 1000;
    const actualDeadline = document.mcqDeadline.getTime();

    if (Math.abs(actualDeadline - expectedDeadline) > 1000) {
      document.invalidate("mcqDeadline", "The MCQ deadline must be exactly 90 minutes after start.");
    }
  }

  if (["passed", "failed"].includes(document.status)) {
    if (document.currentPhase !== "completed") {
      document.invalidate("currentPhase", "A finalized assessment must be in the completed phase.");
    }

    const expectedPassed = document.totalScore >= C.PASSING_MARKS;

    if (document.passed !== expectedPassed) {
      document.invalidate("passed", "The pass result must match the 36-mark threshold.");
    }

    if (document.status !== (expectedPassed ? "passed" : "failed")) {
      document.invalidate("status", "The final status must match the 36-mark passing threshold.");
    }

    if (!validDate(document.submittedAt)) {
      document.invalidate("submittedAt", "A finalized assessment must have a valid submission timestamp.");
    }

    if (!validDate(document.evaluatedAt)) {
      document.invalidate("evaluatedAt", "A finalized assessment must have a valid evaluation timestamp.");
    }
  }
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
      status: {
        $in: ["in-progress", "coding-in-progress", "submitted", "evaluating"],
      },
    },
  },
);

const MODEL_NAME = "AssessmentAttempt";
const COLLECTION_NAME = "assessmentattempts";

export async function getAssessmentAttemptModel(): Promise<Model<IAssessmentAttempt>> {
  await connectDB();

  const connection = mongoose.connection;

  if (connection.readyState !== 1) {
    throw new Error("Main Careers MongoDB is not connected. Assessment attempt operations cannot continue.");
  }

  const existing = connection.models[MODEL_NAME] as Model<IAssessmentAttempt> | undefined;

  if (existing) {
    return existing;
  }

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
