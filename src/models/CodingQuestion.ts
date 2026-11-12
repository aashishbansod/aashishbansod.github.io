
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { connectStudentDB } from "@/lib/student-db";

export const CODING_DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
] as const;

export const CODING_QUESTION_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

export const CODING_LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Java",
  "Python",
  "C",
  "C++",
  "SQL",
] as const;

export const CODING_TRACKS = [
  "MERN Stack Developer",
  "Java Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Python Developer",
  "Data Analyst",
  "Software Developer",
] as const;

export type CodingDifficulty =
  (typeof CODING_DIFFICULTIES)[number];

export type CodingQuestionStatus =
  (typeof CODING_QUESTION_STATUSES)[number];

export type CodingLanguage =
  (typeof CODING_LANGUAGES)[number];

const COLLECTION_NAME = "coding_questions";

const MAX_TITLE_LENGTH = 180;
const MAX_TOPIC_LENGTH = 100;
const MAX_TRACK_LENGTH = 150;
const MAX_STATEMENT_LENGTH = 12000;
const MAX_FORMAT_LENGTH = 3000;
const MAX_SAMPLE_LENGTH = 5000;
const MAX_EXPLANATION_LENGTH = 5000;
const MAX_TAGS = 30;
const MAX_TEST_CASES = 200;
const MAX_TEST_CASE_INPUT_LENGTH = 20000;
const MAX_TEST_CASE_OUTPUT_LENGTH = 20000;

const testCaseSchema = new Schema(
  {
    input: {
      type: String,
      trim: false,
      required: [true, "Test case input is required."],
      maxlength: [
        MAX_TEST_CASE_INPUT_LENGTH,
        "Test case input is too long.",
      ],
    },
    expectedOutput: {
      type: String,
      trim: false,
      required: [true, "Expected output is required."],
      maxlength: [
        MAX_TEST_CASE_OUTPUT_LENGTH,
        "Expected output is too long.",
      ],
    },
    isHidden: {
      type: Boolean,
      default: true,
    },
    points: {
      type: Number,
      min: [0, "Test case points cannot be negative."],
      max: [1000, "Test case points cannot exceed 1000."],
      default: 0,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: [
        2000,
        "Test case explanation cannot exceed 2000 characters.",
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

const codingQuestionSchema = new Schema(
  {
    questionCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [80, "Question code cannot exceed 80 characters."],
      default: "",
    },

    title: {
      type: String,
      required: [true, "Question title is required."],
      trim: true,
      minlength: [5, "Question title must contain at least 5 characters."],
      maxlength: [
        MAX_TITLE_LENGTH,
        "Question title cannot exceed 180 characters.",
      ],
    },

    track: {
      type: String,
      required: [true, "Internship track is required."],
      trim: true,
      maxlength: [
        MAX_TRACK_LENGTH,
        "Internship track cannot exceed 150 characters.",
      ],
      index: true,
    },

    topic: {
      type: String,
      required: [true, "Question topic is required."],
      trim: true,
      minlength: [2, "Topic must contain at least 2 characters."],
      maxlength: [
        MAX_TOPIC_LENGTH,
        "Topic cannot exceed 100 characters.",
      ],
    },

    difficulty: {
      type: String,
      enum: {
        values: CODING_DIFFICULTIES,
        message: "Choose a valid coding difficulty.",
      },
      required: true,
      default: "easy",
      index: true,
    },

    language: {
      type: String,
      enum: {
        values: CODING_LANGUAGES,
        message: "Choose a supported programming language.",
      },
      required: true,
      default: "JavaScript",
    },

    durationDays: {
      type: Number,
      required: [true, "Program duration is required."],
      min: [1, "Program duration must be at least 1 day."],
      max: [365, "Program duration cannot exceed 365 days."],
      validate: {
        validator: Number.isInteger,
        message: "Program duration must be a whole number.",
      },
    },

    dayNumber: {
      type: Number,
      required: [true, "Question day number is required."],
      min: [1, "Question day must be at least 1."],
      max: [365, "Question day cannot exceed 365."],
      validate: {
        validator: Number.isInteger,
        message: "Question day must be a whole number.",
      },
      index: true,
    },

    points: {
      type: Number,
      required: [true, "Question points are required."],
      min: [1, "Question must have at least 1 point."],
      max: [1000, "Question points cannot exceed 1000."],
      default: 10,
      validate: {
        validator: Number.isInteger,
        message: "Question points must be a whole number.",
      },
    },

    estimatedMinutes: {
      type: Number,
      min: [1, "Estimated time must be at least 1 minute."],
      max: [1440, "Estimated time cannot exceed 1440 minutes."],
      default: 30,
      validate: {
        validator: Number.isInteger,
        message: "Estimated time must be a whole number.",
      },
    },

    problemStatement: {
      type: String,
      required: [true, "Problem statement is required."],
      trim: true,
      minlength: [
        20,
        "Problem statement must contain at least 20 characters.",
      ],
      maxlength: [
        MAX_STATEMENT_LENGTH,
        "Problem statement is too long.",
      ],
    },

    inputFormat: {
      type: String,
      trim: true,
      maxlength: [
        MAX_FORMAT_LENGTH,
        "Input format cannot exceed 3000 characters.",
      ],
      default: "",
    },

    outputFormat: {
      type: String,
      trim: true,
      maxlength: [
        MAX_FORMAT_LENGTH,
        "Output format cannot exceed 3000 characters.",
      ],
      default: "",
    },

    constraints: {
      type: String,
      trim: true,
      maxlength: [
        MAX_FORMAT_LENGTH,
        "Constraints cannot exceed 3000 characters.",
      ],
      default: "",
    },

    sampleInput: {
      type: String,
      required: [true, "Sample input is required."],
      trim: false,
      maxlength: [
        MAX_SAMPLE_LENGTH,
        "Sample input cannot exceed 5000 characters.",
      ],
    },

    sampleOutput: {
      type: String,
      required: [true, "Sample output is required."],
      trim: false,
      maxlength: [
        MAX_SAMPLE_LENGTH,
        "Sample output cannot exceed 5000 characters.",
      ],
    },

    explanation: {
      type: String,
      trim: true,
      maxlength: [
        MAX_EXPLANATION_LENGTH,
        "Explanation cannot exceed 5000 characters.",
      ],
      default: "",
    },

    starterCode: {
      type: String,
      trim: false,
      maxlength: [
        20000,
        "Starter code cannot exceed 20000 characters.",
      ],
      default: "",
    },

    testCases: {
      type: [testCaseSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) =>
          Array.isArray(value) && value.length <= MAX_TEST_CASES,
        message: `A question cannot contain more than ${MAX_TEST_CASES} test cases.`,
      },
    },

    tags: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: [
            50,
            "Each tag cannot exceed 50 characters.",
          ],
        },
      ],
      default: [],
      validate: {
        validator: (value: string[]) =>
          Array.isArray(value) && value.length <= MAX_TAGS,
        message: `A question cannot contain more than ${MAX_TAGS} tags.`,
      },
    },

    status: {
      type: String,
      enum: {
        values: CODING_QUESTION_STATUSES,
        message: "Choose a valid question status.",
      },
      default: "draft",
      required: true,
      index: true,
    },

    allowResubmission: {
      type: Boolean,
      default: true,
    },

    maxAttempts: {
      type: Number,
      min: [0, "Maximum attempts cannot be negative."],
      max: [100, "Maximum attempts cannot exceed 100."],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Maximum attempts must be a whole number.",
      },
    },

    sortOrder: {
      type: Number,
      min: [0, "Sort order cannot be negative."],
      max: [1000000, "Sort order is too large."],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Sort order must be a whole number.",
      },
    },

    createdBy: {
      type: String,
      trim: true,
      maxlength: [100, "Creator ID cannot exceed 100 characters."],
      default: "",
    },

    updatedBy: {
      type: String,
      trim: true,
      maxlength: [100, "Updater ID cannot exceed 100 characters."],
      default: "",
    },

    publishedBy: {
      type: String,
      trim: true,
      maxlength: [100, "Publisher ID cannot exceed 100 characters."],
      default: "",
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    version: {
      type: Number,
      min: [1, "Version must be at least 1."],
      max: [1000000, "Version is too large."],
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Version must be a whole number.",
      },
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

codingQuestionSchema.index(
  { questionCode: 1 },
  {
    name: "uniq_coding_question_code",
    unique: true,
    partialFilterExpression: {
      questionCode: {
        $type: "string",
        $gt: "",
      },
    },
  },
);

codingQuestionSchema.index(
  {
    track: 1,
    durationDays: 1,
    dayNumber: 1,
  },
  {
    name: "uniq_published_coding_track_day",
    unique: true,
    partialFilterExpression: {
      status: "published",
    },
  },
);

codingQuestionSchema.index(
  {
    status: 1,
    track: 1,
    durationDays: 1,
    dayNumber: 1,
  },
  {
    name: "coding_question_schedule_lookup",
  },
);

codingQuestionSchema.index(
  {
    track: 1,
    topic: 1,
    difficulty: 1,
    status: 1,
  },
  {
    name: "coding_question_track_topic_lookup",
  },
);

codingQuestionSchema.index(
  {
    status: 1,
    createdAt: -1,
  },
  {
    name: "coding_question_status_created_at",
  },
);

codingQuestionSchema.index(
  {
    createdBy: 1,
    createdAt: -1,
  },
  {
    name: "coding_question_creator_created_at",
  },
);

codingQuestionSchema.index(
  {
    updatedAt: -1,
  },
  {
    name: "coding_question_latest_updated",
  },
);

codingQuestionSchema.pre(
  "validate",
  function validateCodingQuestion() {
    if (typeof this.title === "string") {
      this.title = this.title.replace(/\s+/g, " ").trim();
    }

    if (typeof this.track === "string") {
      this.track = this.track.replace(/\s+/g, " ").trim();
    }

    if (typeof this.topic === "string") {
      this.topic = this.topic.replace(/\s+/g, " ").trim();
    }

    if (typeof this.questionCode === "string") {
      this.questionCode = this.questionCode.trim().toUpperCase();
    }

    if (Array.isArray(this.tags)) {
      this.tags = [
        ...new Set(
          this.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
    }

    if (
      Number.isInteger(this.durationDays) &&
      Number.isInteger(this.dayNumber) &&
      this.dayNumber > this.durationDays
    ) {
      this.invalidate(
        "dayNumber",
        "Question day cannot exceed the program duration.",
      );
    }

    if (
      this.status === "published" &&
      (!this.publishedAt || !this.publishedBy)
    ) {
      this.invalidate(
        "publishedAt",
        "Published questions require publisher information and a publication date.",
      );
    }

    if (this.status !== "published" && this.publishedAt) {
      this.invalidate(
        "publishedAt",
        "Only published questions can have a publication date.",
      );
    }

    if (this.status === "archived" && !this.archivedAt) {
      this.archivedAt = new Date();
    }

    if (this.status !== "archived" && this.archivedAt) {
      this.invalidate(
        "archivedAt",
        "Only archived questions can have an archive date.",
      );
    }
  },
);

export type CodingQuestionDocument = InferSchemaType<
  typeof codingQuestionSchema
>;

const modelRegistry = new WeakMap<
  Connection,
  Model<CodingQuestionDocument>
>();

export async function getCodingQuestionModel(): Promise<
  Model<CodingQuestionDocument>
> {
  const connection = await connectStudentDB();

  const cached = modelRegistry.get(connection);

  if (cached) {
    return cached;
  }

  const existing = connection.models.CodingQuestion as
    | Model<CodingQuestionDocument>
    | undefined;

  if (existing) {
    modelRegistry.set(connection, existing);
    return existing;
  }

  const model = connection.model<CodingQuestionDocument>(
    "CodingQuestion",
    codingQuestionSchema,
    COLLECTION_NAME,
  );

  modelRegistry.set(connection, model);

  return model;
}

export const getCodingQuestion = getCodingQuestionModel;

export default getCodingQuestionModel;
