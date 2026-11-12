import mongoose, {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { connectStudentDB } from "@/lib/db";

const COLLECTION_NAME = "weekly_assessments";

const taskSchema = new Schema(
  {
    taskId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 160,
    },
    instructions: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 8000,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    learningOutcome: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    marks: {
      type: Number,
      required: true,
      min: [1, "Each task must have at least one mark."],
      max: [1000, "Task marks cannot exceed 1000."],
    },
    submissionType: {
      type: String,
      enum: ["text", "file", "link", "code", "text-or-file", "any"],
      default: "text-or-file",
    },
    allowedFileTypes: {
      type: [String],
      default: [],
      validate: {
        validator: (values: string[]) =>
          Array.isArray(values) &&
          values.length <= 12 &&
          values.every((value) => typeof value === "string" && value.trim().length > 0 && value.length <= 20),
        message: "Allowed file types must contain at most 12 valid entries.",
      },
    },
    maxFileSizeMB: {
      type: Number,
      min: 1,
      max: 50,
      default: 10,
    },
    position: {
      type: Number,
      min: 0,
      default: 0,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
    strict: "throw",
  },
);

const WeeklyAssessmentSchema = new Schema(
  {
    assessmentCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [4, "Assessment title must contain at least 4 characters."],
      maxlength: [180, "Assessment title cannot exceed 180 characters."],
    },
    description: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    domainKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 140,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    weekNumber: {
      type: Number,
      required: true,
      min: [1, "Week number must be at least 1."],
      max: [104, "Week number cannot exceed 104."],
    },
    topics: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: (values: string[]) =>
          Array.isArray(values) &&
          values.length >= 1 &&
          values.length <= 40 &&
          values.every(
            (value) =>
              typeof value === "string" &&
              value.trim().length >= 2 &&
              value.trim().length <= 160,
          ),
        message: "Add between 1 and 40 valid covered topics.",
      },
    },
    tasks: {
      type: [taskSchema],
      required: true,
      default: [],
      validate: {
        validator: (values: unknown[]) =>
          Array.isArray(values) && values.length >= 1 && values.length <= 30,
        message: "An assessment must contain between 1 and 30 tasks.",
      },
    },
    totalMarks: {
      type: Number,
      required: true,
      min: [1, "Total marks must be greater than zero."],
      max: [10000, "Total marks cannot exceed 10000."],
    },
    passingMarks: {
      type: Number,
      required: true,
      min: [0, "Passing marks cannot be negative."],
      max: [10000, "Passing marks cannot exceed 10000."],
    },
    startAt: {
      type: Date,
      required: true,
    },
    dueAt: {
      type: Date,
      required: true,
    },
    timezone: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "Asia/Kolkata",
    },
    status: {
      type: String,
      enum: ["draft", "published", "locked", "archived"],
      default: "draft",
      index: true,
    },
    isLocked: {
      type: Boolean,
      default: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    lateSubmissionAllowed: {
      type: Boolean,
      default: false,
    },
    lateSubmissionGraceMinutes: {
      type: Number,
      min: 0,
      max: 10080,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      min: 1,
      max: 10,
      default: 1,
    },
    createdByAdminId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    updatedByAdminId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    publishedByAdminId: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    lockedByAdminId: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    archivedByAdminId: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    version: {
      type: Number,
      min: 1,
      default: 1,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
    strict: "throw",
    versionKey: false,
    minimize: true,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

WeeklyAssessmentSchema.index(
  { assessmentCode: 1 },
  { unique: true, name: "weekly_assessment_code_unique" },
);

WeeklyAssessmentSchema.index(
  { domainKey: 1, weekNumber: 1, title: 1 },
  { unique: true, name: "weekly_assessment_domain_week_title_unique" },
);

WeeklyAssessmentSchema.index(
  { domainKey: 1, status: 1, startAt: 1, dueAt: 1 },
  { name: "weekly_assessment_domain_status_schedule" },
);

WeeklyAssessmentSchema.index(
  { status: 1, isLocked: 1, dueAt: 1 },
  { name: "weekly_assessment_student_visibility" },
);

WeeklyAssessmentSchema.index(
  { createdByAdminId: 1, createdAt: -1 },
  { name: "weekly_assessment_creator_created" },
);

WeeklyAssessmentSchema.pre("validate", function validateWeeklyAssessment() {
  if (typeof this.assessmentCode === "string") {
    this.assessmentCode = this.assessmentCode.trim().toUpperCase();
  }

  if (typeof this.title === "string") {
    this.title = this.title.trim();
  }

  if (typeof this.domain === "string") {
    this.domain = this.domain.trim();
  }

  if (typeof this.domainKey === "string") {
    this.domainKey = this.domainKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  if (typeof this.module === "string") {
    this.module = this.module.trim();
  }

  if (typeof this.topics !== "undefined" && Array.isArray(this.topics)) {
    this.topics = this.topics
      .map((topic) => (typeof topic === "string" ? topic.trim() : ""))
      .filter(Boolean);
  }

  if (typeof this.tasks !== "undefined" && Array.isArray(this.tasks)) {
    this.tasks.forEach((task, index) => {
      task.position = index;
      if (typeof task.taskId === "string") {
        task.taskId = task.taskId.trim();
      }
      if (typeof task.title === "string") {
        task.title = task.title.trim();
      }
      if (typeof task.topic === "string") {
        task.topic = task.topic.trim();
      }
    });
  }

  if (
    typeof this.totalMarks === "number" &&
    typeof this.passingMarks === "number" &&
    this.passingMarks > this.totalMarks
  ) {
    this.invalidate("passingMarks", "Passing marks cannot exceed total marks.");
  }

  if (
    typeof this.tasks !== "undefined" &&
    Array.isArray(this.tasks) &&
    typeof this.totalMarks === "number"
  ) {
    const calculatedMarks = this.tasks.reduce(
      (total, task) => total + (Number(task.marks) || 0),
      0,
    );

    if (calculatedMarks !== this.totalMarks) {
      this.invalidate(
        "totalMarks",
        "Total marks must equal the sum of all task marks.",
      );
    }
  }

  if (
    this.startAt instanceof Date &&
    this.dueAt instanceof Date &&
    this.startAt.getTime() >= this.dueAt.getTime()
  ) {
    this.invalidate("dueAt", "Submission deadline must be after the start date.");
  }

  if (this.status === "published") {
    if (!this.tasks || this.tasks.length === 0) {
      this.invalidate("tasks", "Add at least one task before publishing.");
    }
    if (!this.topics || this.topics.length === 0) {
      this.invalidate("topics", "Add covered topics before publishing.");
    }
    this.isLocked = false;
  }

  if (this.status === "locked" || this.status === "draft" || this.status === "archived") {
    this.isLocked = true;
  }

  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  if (this.status === "locked" && !this.lockedAt) {
    this.lockedAt = new Date();
  }

  if (this.status === "archived" && !this.archivedAt) {
    this.archivedAt = new Date();
  }

  if (typeof this.createdByAdminId === "string") {
    this.createdByAdminId = this.createdByAdminId.trim();
  }

  if (typeof this.updatedByAdminId === "string") {
    this.updatedByAdminId = this.updatedByAdminId.trim();
  }
});

export type WeeklyAssessmentDocument = InferSchemaType<
  typeof WeeklyAssessmentSchema
>;

const modelRegistry = new WeakMap<Connection, Model<WeeklyAssessmentDocument>>();

export async function getWeeklyAssessmentModel(): Promise<
  Model<WeeklyAssessmentDocument>
> {
  const connection = await connectStudentDB();

  const cached = modelRegistry.get(connection);

  if (cached) {
    return cached;
  }

  const existing = connection.models.WeeklyAssessment as
    | Model<WeeklyAssessmentDocument>
    | undefined;

  if (existing) {
    modelRegistry.set(connection, existing);
    return existing;
  }

  const model = connection.model<WeeklyAssessmentDocument>(
    "WeeklyAssessment",
    WeeklyAssessmentSchema,
    COLLECTION_NAME,
  );

  modelRegistry.set(connection, model);

  return model;
}

export const getWeeklyAssessment = getWeeklyAssessmentModel;
