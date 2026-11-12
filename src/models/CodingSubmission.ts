
import { randomUUID } from "node:crypto";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { connectStudentDB } from "@/lib/student-db";

export const SUBMISSION_STATUSES = [
  "submitted",
  "queued",
  "running",
  "accepted",
  "wrong-answer",
  "compilation-error",
  "runtime-error",
  "time-limit-exceeded",
  "memory-limit-exceeded",
  "system-error",
  "under-review",
  "rejected",
] as const;

export const EVALUATION_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const SUBMISSION_LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Java",
  "Python",
  "C",
  "C++",
  "SQL",
] as const;

export type SubmissionStatus =
  (typeof SUBMISSION_STATUSES)[number];

export type EvaluationStatus =
  (typeof EVALUATION_STATUSES)[number];

export type SubmissionLanguage =
  (typeof SUBMISSION_LANGUAGES)[number];

const COLLECTION_NAME = "coding_submissions";

const MAX_CODE_LENGTH = 100000;
const MAX_OUTPUT_LENGTH = 20000;
const MAX_ERROR_LENGTH = 20000;
const MAX_REVIEW_LENGTH = 5000;
const MAX_TEST_RESULTS = 200;
const MAX_TEST_OUTPUT_LENGTH = 10000;

const testResultSchema = new Schema(
  {
    testCaseIndex: {
      type: Number,
      required: true,
      min: [0, "Test case index cannot be negative."],
      max: [10000, "Test case index is too large."],
      validate: {
        validator: Number.isInteger,
        message: "Test case index must be a whole number.",
      },
    },
    passed: {
      type: Boolean,
      required: true,
    },
    isHidden: {
      type: Boolean,
      default: true,
    },
    pointsAwarded: {
      type: Number,
      min: [0, "Awarded points cannot be negative."],
      max: [1000, "Awarded points cannot exceed 1000."],
      default: 0,
    },
    executionTimeMs: {
      type: Number,
      min: [0, "Execution time cannot be negative."],
      max: [3600000, "Execution time is too large."],
      default: 0,
    },
    memoryUsedKb: {
      type: Number,
      min: [0, "Memory usage cannot be negative."],
      max: [1073741824, "Memory usage is too large."],
      default: 0,
    },
    actualOutput: {
      type: String,
      maxlength: [
        MAX_TEST_OUTPUT_LENGTH,
        "Actual output is too long.",
      ],
      default: "",
    },
    expectedOutput: {
      type: String,
      maxlength: [
        MAX_TEST_OUTPUT_LENGTH,
        "Expected output is too long.",
      ],
      default: "",
    },
    errorMessage: {
      type: String,
      maxlength: [
        MAX_ERROR_LENGTH,
        "Test error message is too long.",
      ],
      default: "",
    },
  },
  {
    _id: false,
    id: false,
    strict: "throw",
  },
);

const codingSubmissionSchema = new Schema(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => randomUUID(),
      maxlength: [100, "Submission ID is too long."],
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: [
        128,
        "Idempotency key cannot exceed 128 characters.",
      ],
      default: "",
    },

    studentOperationsId: {
      type: String,
      required: [true, "Student Operations ID is required."],
      trim: true,
      maxlength: [
        100,
        "Student Operations ID cannot exceed 100 characters.",
      ],
      index: true,
    },

    mainStudentId: {
      type: String,
      required: [true, "Main Student ID is required."],
      trim: true,
      maxlength: [
        100,
        "Main Student ID cannot exceed 100 characters.",
      ],
    },

    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [80, "Student ID cannot exceed 80 characters."],
      default: "",
    },

    dashboardStudentId: {
      type: String,
      required: [true, "Dashboard Student ID is required."],
      trim: true,
      uppercase: true,
      maxlength: [
        80,
        "Dashboard Student ID cannot exceed 80 characters.",
      ],
    },

    studentName: {
      type: String,
      required: [true, "Student name is required."],
      trim: true,
      minlength: [2, "Student name is too short."],
      maxlength: [
        120,
        "Student name cannot exceed 120 characters.",
      ],
    },

    studentEmail: {
      type: String,
      required: [true, "Student email is required."],
      trim: true,
      lowercase: true,
      maxlength: [
        254,
        "Student email cannot exceed 254 characters.",
      ],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid student email.",
      ],
    },

    questionId: {
      type: Schema.Types.ObjectId,
      ref: "CodingQuestion",
      required: [true, "Coding question reference is required."],
      immutable: true,
    },

    questionCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [
        80,
        "Question code cannot exceed 80 characters.",
      ],
      default: "",
    },

    questionTitle: {
      type: String,
      required: [true, "Question title is required."],
      trim: true,
      maxlength: [
        180,
        "Question title cannot exceed 180 characters.",
      ],
    },

    track: {
      type: String,
      required: [true, "Internship track is required."],
      trim: true,
      maxlength: [
        150,
        "Internship track cannot exceed 150 characters.",
      ],
    },

    dayNumber: {
      type: Number,
      required: [true, "Question day number is required."],
      min: [1, "Day number must be at least 1."],
      max: [365, "Day number cannot exceed 365."],
      validate: {
        validator: Number.isInteger,
        message: "Day number must be a whole number.",
      },
    },

    attemptNumber: {
      type: Number,
      required: true,
      min: [1, "Attempt number must be at least 1."],
      max: [10000, "Attempt number is too large."],
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Attempt number must be a whole number.",
      },
    },

    language: {
      type: String,
      enum: {
        values: SUBMISSION_LANGUAGES,
        message: "Choose a supported programming language.",
      },
      required: true,
    },

    sourceCode: {
      type: String,
      required: [true, "Source code is required."],
      trim: false,
      minlength: [1, "Source code cannot be empty."],
      maxlength: [
        MAX_CODE_LENGTH,
        "Source code cannot exceed 100000 characters.",
      ],
    },

    sourceCodeHash: {
      type: String,
      trim: true,
      maxlength: [128, "Source code hash is too long."],
      default: "",
    },

    status: {
      type: String,
      enum: {
        values: SUBMISSION_STATUSES,
        message: "Choose a valid submission status.",
      },
      required: true,
      default: "submitted",
      index: true,
    },

    evaluationStatus: {
      type: String,
      enum: {
        values: EVALUATION_STATUSES,
        message: "Choose a valid evaluation status.",
      },
      required: true,
      default: "pending",
      index: true,
    },

    totalTestCases: {
      type: Number,
      min: [0, "Total test cases cannot be negative."],
      max: [MAX_TEST_RESULTS, "Too many test cases."],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Total test cases must be a whole number.",
      },
    },

    passedTestCases: {
      type: Number,
      min: [0, "Passed test cases cannot be negative."],
      max: [MAX_TEST_RESULTS, "Too many passed test cases."],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Passed test cases must be a whole number.",
      },
    },

    failedTestCases: {
      type: Number,
      min: [0, "Failed test cases cannot be negative."],
      max: [MAX_TEST_RESULTS, "Too many failed test cases."],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Failed test cases must be a whole number.",
      },
    },

    score: {
      type: Number,
      min: [0, "Score cannot be negative."],
      max: [100000, "Score is too large."],
      default: 0,
    },

    maxScore: {
      type: Number,
      min: [0, "Maximum score cannot be negative."],
      max: [100000, "Maximum score is too large."],
      default: 0,
    },

    scorePercentage: {
      type: Number,
      min: [0, "Score percentage cannot be negative."],
      max: [100, "Score percentage cannot exceed 100."],
      default: 0,
    },

    executionTimeMs: {
      type: Number,
      min: [0, "Execution time cannot be negative."],
      max: [3600000, "Execution time is too large."],
      default: 0,
    },

    memoryUsedKb: {
      type: Number,
      min: [0, "Memory usage cannot be negative."],
      max: [1073741824, "Memory usage is too large."],
      default: 0,
    },

    compileOutput: {
      type: String,
      maxlength: [
        MAX_OUTPUT_LENGTH,
        "Compile output is too long.",
      ],
      default: "",
    },

    runtimeOutput: {
      type: String,
      maxlength: [
        MAX_OUTPUT_LENGTH,
        "Runtime output is too long.",
      ],
      default: "",
    },

    errorMessage: {
      type: String,
      maxlength: [
        MAX_ERROR_LENGTH,
        "Error message is too long.",
      ],
      default: "",
    },

    testResults: {
      type: [testResultSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) =>
          Array.isArray(value) &&
          value.length <= MAX_TEST_RESULTS,
        message: `A submission cannot contain more than ${MAX_TEST_RESULTS} test results.`,
      },
    },

    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    evaluationStartedAt: {
      type: Date,
      default: null,
    },

    evaluatedAt: {
      type: Date,
      default: null,
    },

    lastExecutionAt: {
      type: Date,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: String,
      trim: true,
      maxlength: [
        100,
        "Reviewer ID cannot exceed 100 characters.",
      ],
      default: "",
    },

    reviewStatus: {
      type: String,
      enum: {
        values: ["not-reviewed", "approved", "rework", "rejected"],
        message: "Choose a valid review status.",
      },
      default: "not-reviewed",
    },

    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [
        MAX_REVIEW_LENGTH,
        "Review notes cannot exceed 5000 characters.",
      ],
      default: "",
    },

    isLatestAttempt: {
      type: Boolean,
      default: true,
      index: true,
    },

    isPractice: {
      type: Boolean,
      default: false,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
    strict: "throw",
    versionKey: false,
    minimize: true,
    optimisticConcurrency: true,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

codingSubmissionSchema.index(
  {
    submissionId: 1,
  },
  {
    name: "uniq_coding_submission_id",
    unique: true,
  },
);

codingSubmissionSchema.index(
  {
    idempotencyKey: 1,
  },
  {
    name: "uniq_coding_submission_idempotency",
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
        $gt: "",
      },
    },
  },
);

codingSubmissionSchema.index(
  {
    studentOperationsId: 1,
    questionId: 1,
    attemptNumber: -1,
  },
  {
    name: "submission_student_question_attempt",
  },
);

codingSubmissionSchema.index(
  {
    mainStudentId: 1,
    submittedAt: -1,
  },
  {
    name: "submission_student_history",
  },
);

codingSubmissionSchema.index(
  {
    dashboardStudentId: 1,
    status: 1,
    submittedAt: -1,
  },
  {
    name: "submission_dashboard_status_history",
  },
);

codingSubmissionSchema.index(
  {
    questionId: 1,
    status: 1,
    submittedAt: -1,
  },
  {
    name: "submission_question_status_history",
  },
);

codingSubmissionSchema.index(
  {
    evaluationStatus: 1,
    submittedAt: 1,
  },
  {
    name: "submission_evaluation_queue",
  },
);

codingSubmissionSchema.index(
  {
    reviewStatus: 1,
    reviewedAt: -1,
  },
  {
    name: "submission_review_queue",
  },
);

codingSubmissionSchema.index(
  {
    track: 1,
    dayNumber: 1,
    submittedAt: -1,
  },
  {
    name: "submission_track_day_history",
  },
);

codingSubmissionSchema.pre(
  "validate",
  function validateCodingSubmission() {
    if (typeof this.studentOperationsId === "string") {
      this.studentOperationsId = this.studentOperationsId.trim();
    }

    if (typeof this.mainStudentId === "string") {
      this.mainStudentId = this.mainStudentId.trim();
    }

    if (typeof this.studentId === "string") {
      this.studentId = this.studentId.trim().toUpperCase();
    }

    if (typeof this.dashboardStudentId === "string") {
      this.dashboardStudentId = this.dashboardStudentId
        .trim()
        .toUpperCase();
    }

    if (typeof this.studentName === "string") {
      this.studentName = this.studentName.replace(/\s+/g, " ").trim();
    }

    if (typeof this.studentEmail === "string") {
      this.studentEmail = this.studentEmail.trim().toLowerCase();
    }

    if (typeof this.questionCode === "string") {
      this.questionCode = this.questionCode.trim().toUpperCase();
    }

    if (typeof this.questionTitle === "string") {
      this.questionTitle = this.questionTitle.replace(/\s+/g, " ").trim();
    }

    if (typeof this.track === "string") {
      this.track = this.track.replace(/\s+/g, " ").trim();
    }

    if (
      Number.isInteger(this.passedTestCases) &&
      Number.isInteger(this.failedTestCases) &&
      Number.isInteger(this.totalTestCases) &&
      this.passedTestCases + this.failedTestCases >
        this.totalTestCases
    ) {
      this.invalidate(
        "passedTestCases",
        "Passed and failed test cases cannot exceed total test cases.",
      );
    }

    if (
      Number.isInteger(this.totalTestCases) &&
      Number.isInteger(this.testResults?.length) &&
      this.testResults.length > this.totalTestCases
    ) {
      this.invalidate(
        "testResults",
        "Test results cannot exceed total test cases.",
      );
    }

    if (
      Number.isFinite(this.score) &&
      Number.isFinite(this.maxScore) &&
      this.score > this.maxScore
    ) {
      this.invalidate(
        "score",
        "Score cannot exceed the maximum score.",
      );
    }

    if (
      this.status === "accepted" &&
      this.evaluationStatus !== "completed"
    ) {
      this.invalidate(
        "evaluationStatus",
        "Accepted submissions must have completed evaluation.",
      );
    }

    if (
      this.evaluationStatus === "completed" &&
      !this.evaluatedAt
    ) {
      this.invalidate(
        "evaluatedAt",
        "Completed evaluations require an evaluation date.",
      );
    }

    if (
      this.reviewStatus !== "not-reviewed" &&
      (!this.reviewedAt || !this.reviewedBy)
    ) {
      this.invalidate(
        "reviewedAt",
        "Reviewed submissions require reviewer information and a review date.",
      );
    }

    if (
      this.reviewStatus === "approved" &&
      this.status !== "accepted"
    ) {
      this.invalidate(
        "reviewStatus",
        "Only accepted submissions can be approved.",
      );
    }
  },
);

export type CodingSubmissionDocument = InferSchemaType<
  typeof codingSubmissionSchema
>;

const modelRegistry = new WeakMap<
  Connection,
  Model<CodingSubmissionDocument>
>();

export async function getCodingSubmissionModel(): Promise<
  Model<CodingSubmissionDocument>
> {
  const connection = await connectStudentDB();

  const cached = modelRegistry.get(connection);

  if (cached) {
    return cached;
  }

  const existing = connection.models.CodingSubmission as
    | Model<CodingSubmissionDocument>
    | undefined;

  if (existing) {
    modelRegistry.set(connection, existing);
    return existing;
  }

  const model = connection.model<CodingSubmissionDocument>(
    "CodingSubmission",
    codingSubmissionSchema,
    COLLECTION_NAME,
  );

  modelRegistry.set(connection, model);

  return model;
}

export const getCodingSubmission = getCodingSubmissionModel;

export default getCodingSubmissionModel;
