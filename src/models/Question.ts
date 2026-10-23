
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";
import { randomBytes } from "node:crypto";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type QuestionType = "mcq" | "coding";
export type QuestionSection = "mcq" | "coding";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuestionStatus = "draft" | "published" | "archived";

export interface IQuestionOption {
  optionId: string;
  text: string;
}

export interface ICodingExample {
  input: string;
  output: string;
  explanation?: string;
}

/** Optional grader cases. Keep hidden expected outputs server-side only. */
export interface ICodingTestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
}

export interface IQuestion extends Document {
  _id: Types.ObjectId;
  questionId: string;
  assessmentId: Types.ObjectId;
  domain: string;
  domainKey: string;
  section: QuestionSection;
  type: QuestionType;
  question: string;
  description?: string;
  options: IQuestionOption[];
  correctOption?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  examples: ICodingExample[];
  testCases: ICodingTestCase[];
  starterCode?: string;
  languages: string[];
  topic?: string;
  difficulty: QuestionDifficulty;
  marks: number;
  negativeMarks: number;
  status: QuestionStatus;
  isActive: boolean;
  order: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const QUESTION_COLLECTION = "questions";

export const QUESTION_TYPES = {
  MCQ: "mcq",
  CODING: "coding",
} as const;

export const QUESTION_STATUSES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export const QUESTION_LIMITS = {
  QUESTION_TEXT: 10_000,
  DESCRIPTION: 15_000,
  OPTION_TEXT: 1_000,
  EXAMPLE_TEXT: 5_000,
  STARTER_CODE: 30_000,
  MAX_OPTIONS: 4,
  MAX_LANGUAGES: 10,
  MAX_TEST_CASES: 50,
} as const;

/* -------------------------------------------------------------------------- */
/* Normalization utilities                                                    */
/* -------------------------------------------------------------------------- */

export function normalizeQuestionDomain(domain: string): string {
  return String(domain ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeQuestionType(value: unknown): QuestionType | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "mcq" || normalized === "coding") {
    return normalized;
  }

  return null;
}

export function normalizeQuestionStatus(
  value: unknown,
): QuestionStatus | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (
    normalized === "draft" ||
    normalized === "published" ||
    normalized === "archived"
  ) {
    return normalized;
  }

  return null;
}

export function generateQuestionId(): string {
  return `CN-Q-${Date.now()}-${randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;
}

function normalizeOptionId(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, QUESTION_LIMITS.MAX_LANGUAGES);
}

function isValidObjectId(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^[a-f\d]{24}$/i.test(value) &&
    mongoose.Types.ObjectId.isValid(value)
  );
}

/* -------------------------------------------------------------------------- */
/* Embedded schemas                                                           */
/* -------------------------------------------------------------------------- */

const QuestionOptionSchema = new Schema<IQuestionOption>(
  {
    optionId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 5,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: QUESTION_LIMITS.OPTION_TEXT,
    },
  },
  {
    _id: false,
    id: false,
    strict: true,
  },
);

const CodingExampleSchema = new Schema<ICodingExample>(
  {
    input: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.EXAMPLE_TEXT,
      default: "",
    },
    output: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.EXAMPLE_TEXT,
      default: "",
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.EXAMPLE_TEXT,
      default: "",
    },
  },
  {
    _id: false,
    id: false,
    strict: true,
  },
);

const CodingTestCaseSchema = new Schema<ICodingTestCase>(
  {
    input: {
      type: String,
      required: true,
      maxlength: QUESTION_LIMITS.EXAMPLE_TEXT,
      default: "",
    },
    expectedOutput: {
      type: String,
      required: true,
      maxlength: QUESTION_LIMITS.EXAMPLE_TEXT,
    },
    isHidden: {
      type: Boolean,
      default: true,
    },
    points: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    _id: false,
    id: false,
    strict: true,
  },
);

/* -------------------------------------------------------------------------- */
/* Main schema                                                                */
/* -------------------------------------------------------------------------- */

const QuestionSchema = new Schema<IQuestion>(
  {
    questionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 5,
      maxlength: 100,
      index: true,
      default: generateQuestionId,
    },

    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },

    domain: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
      index: true,
    },

    domainKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 150,
      index: true,
    },

    section: {
      type: String,
      enum: ["mcq", "coding"],
      required: true,
      trim: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["mcq", "coding"],
      required: true,
      trim: true,
      index: true,
    },

    question: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: QUESTION_LIMITS.QUESTION_TEXT,
    },

    description: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.DESCRIPTION,
      default: "",
    },

    options: {
      type: [QuestionOptionSchema],
      default: [],
    },

    // Hidden by default. Admin-side answer checking must explicitly
    // request .select("+correctOption").
    correctOption: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 5,
      select: false,
      default: undefined,
    },

    inputFormat: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.DESCRIPTION,
      default: "",
    },

    outputFormat: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.DESCRIPTION,
      default: "",
    },

    constraints: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.DESCRIPTION,
      default: "",
    },

    examples: {
      type: [CodingExampleSchema],
      default: [],
    },

    // Hidden grader cases must never be serialized into student-facing payloads.
    testCases: {
      type: [CodingTestCaseSchema],
      default: [],
      validate: {
        validator: (value: ICodingTestCase[]) =>
          Array.isArray(value) && value.length <= QUESTION_LIMITS.MAX_TEST_CASES,
        message: `A question may contain at most ${QUESTION_LIMITS.MAX_TEST_CASES} test cases.`,
      },
      select: false,
    },

    starterCode: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.STARTER_CODE,
      default: "",
    },

    languages: {
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
          maxlength: 30,
        },
      ],
      default: [],
      validate: {
        validator: (value: string[]) =>
          Array.isArray(value) &&
          value.length <= QUESTION_LIMITS.MAX_LANGUAGES &&
          value.every(
            (item) =>
              typeof item === "string" && Boolean(item.trim()),
          ),
        message: "Languages must contain at most 10 valid entries.",
      },
    },

    topic: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
      default: "medium",
      index: true,
    },

    marks: {
      type: Number,
      required: true,
      min: 0.5,
      max: 100,
      default: 1,
    },

    negativeMarks: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      required: true,
      default: "draft",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    order: {
      type: Number,
      default: 0,
      min: 0,
      max: 100_000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: undefined,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
    minimize: false,
    collection: QUESTION_COLLECTION,
  },
);

/* -------------------------------------------------------------------------- */
/* Validation and normalization                                               */
/* -------------------------------------------------------------------------- */

QuestionSchema.pre("validate", function () {
  if (typeof this.domain === "string") {
    this.domain = this.domain.trim();
    this.domainKey = normalizeQuestionDomain(this.domain);
  }

  if (typeof this.questionId === "string") {
    this.questionId = this.questionId.trim().toUpperCase();
  }

  if (typeof this.correctOption === "string") {
    this.correctOption = normalizeOptionId(this.correctOption);
  }

  if (this.section !== this.type) {
    this.invalidate(
      "type",
      "Question type must match question section.",
    );
  }

  if (Array.isArray(this.options)) {
    this.options = this.options.map((option) => ({
      optionId: normalizeOptionId(option.optionId),
      text: String(option.text ?? "").trim(),
    }));
  }

  this.languages = normalizeLanguages(this.languages);

  if (this.status === "archived") {
    this.isActive = false;
  }

  if (!Number.isFinite(this.marks) || this.marks <= 0) {
    this.invalidate("marks", "Marks must be greater than zero.");
  }

  if (
    !Number.isFinite(this.negativeMarks) ||
    this.negativeMarks < 0
  ) {
    this.invalidate(
      "negativeMarks",
      "Negative marks cannot be negative.",
    );
  }

  if (this.negativeMarks > this.marks) {
    this.invalidate(
      "negativeMarks",
      "Negative marks cannot exceed question marks.",
    );
  }

  // Draft questions can be incomplete while an admin edits them.
  if (this.status !== "published") {
    return;
  }

  if (!this.question?.trim()) {
    this.invalidate(
      "question",
      "A published question cannot be empty.",
    );
  }

  if (!this.domainKey || this.domainKey.length < 2) {
    this.invalidate("domainKey", "A valid domain is required.");
  }

  if (this.section === "mcq" && this.type === "mcq") {
    if (this.options.length !== 4) {
      this.invalidate(
        "options",
        "A published MCQ requires exactly 4 options.",
      );
    } else {
      const optionIds = this.options.map(
        (option) => option.optionId,
      );
      const uniqueOptionIds = new Set(optionIds);

      if (uniqueOptionIds.size !== 4) {
        this.invalidate(
          "options",
          "MCQ option IDs must be unique.",
        );
      }

      if (
        this.options.some(
          (option) => !option.optionId || !option.text,
        )
      ) {
        this.invalidate(
          "options",
          "Every MCQ option needs an ID and text.",
        );
      }

      if (!this.correctOption) {
        this.invalidate(
          "correctOption",
          "An MCQ requires a correct option.",
        );
      } else if (!uniqueOptionIds.has(this.correctOption)) {
        this.invalidate(
          "correctOption",
          "The correct option must match one option ID.",
        );
      }
    }

    // Clear coding-only properties on published MCQs.
    this.inputFormat = "";
    this.outputFormat = "";
    this.constraints = "";
    this.examples = [];
    this.testCases = [];
    this.starterCode = "";
    this.languages = [];
  }

  if (this.section === "coding" && this.type === "coding") {
    if (this.options.length > 0) {
      this.invalidate(
        "options",
        "Coding questions cannot contain MCQ options.",
      );
    }

    if (this.correctOption) {
      this.invalidate(
        "correctOption",
        "Coding questions cannot have an MCQ answer.",
      );
    }

    if (!this.inputFormat?.trim()) {
      this.invalidate(
        "inputFormat",
        "A published coding question requires an input format.",
      );
    }

    if (!this.outputFormat?.trim()) {
      this.invalidate(
        "outputFormat",
        "A published coding question requires an output format.",
      );
    }

    if (!Array.isArray(this.examples) || this.examples.length === 0) {
      this.invalidate(
        "examples",
        "A published coding question requires an example.",
      );
    } else {
      for (const example of this.examples) {
        if (!example.input?.trim()) {
          this.invalidate(
            "examples",
            "Coding example input cannot be empty.",
          );
        }

        if (!example.output?.trim()) {
          this.invalidate(
            "examples",
            "Coding example output cannot be empty.",
          );
        }
      }
    }

    if (!this.languages.length) {
      this.invalidate(
        "languages",
        "A published coding question requires a programming language.",
      );
    }

    if (Array.isArray(this.testCases)) {
      if (this.testCases.length > QUESTION_LIMITS.MAX_TEST_CASES) {
        this.invalidate(
          "testCases",
          `A question may contain at most ${QUESTION_LIMITS.MAX_TEST_CASES} test cases.`,
        );
      }
      for (const testCase of this.testCases) {
        if (typeof testCase.input !== "string" || typeof testCase.expectedOutput !== "string") {
          this.invalidate("testCases", "Each coding test case requires input and expected output.");
          break;
        }
        if (!Number.isFinite(testCase.points) || testCase.points < 0 || testCase.points > 100) {
          this.invalidate("testCases", "Test-case points must be between 0 and 100.");
          break;
        }
      }
    }
  }
});

QuestionSchema.pre("save", function () {
  if (typeof this.domain === "string") {
    this.domainKey = normalizeQuestionDomain(this.domain);
  }

  if (this.status === "archived") {
    this.isActive = false;
  }
});

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

// Supports assessment-start lookups by assessment, domain and section.
QuestionSchema.index(
  {
    assessmentId: 1,
    domainKey: 1,
    section: 1,
    type: 1,
    status: 1,
    isActive: 1,
  },
  {
    name: "assessment_question_bank_lookup",
  },
);

// Supports ordered admin lists and deterministic question selection.
QuestionSchema.index(
  {
    assessmentId: 1,
    section: 1,
    order: 1,
    createdAt: 1,
  },
  {
    name: "assessment_question_order",
  },
);

/* -------------------------------------------------------------------------- */
/* Model export                                                               */
/* -------------------------------------------------------------------------- */

// Reuse the existing model during Next.js hot reload to avoid
// OverwriteModelError. Keep the existing default mongoose connection.
const Question: Model<IQuestion> =
  (mongoose.models.Question as Model<IQuestion> | undefined) ??
  mongoose.model<IQuestion>(
    "Question",
    QuestionSchema,
    QUESTION_COLLECTION,
  );

export { isValidObjectId };
export default Question;
