import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { randomBytes } from "node:crypto";

export type AssessmentStatus = "draft" | "published" | "archived";
export type AssessmentSectionType = "easy" | "medium" | "hard";

export interface IAssessmentSection {
  section: AssessmentSectionType;
  title: string;
  questionCount: number;
  durationMinutes: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  minimumQuestionBankSize: number;
}

export interface IAssessmentQuestionSelection {
  enabled: boolean;
  randomizePerAttempt: boolean;
  lockQuestionsOnStart: boolean;
  preventDuplicateQuestions: boolean;
}

export interface IAssessment extends Document {
  _id: Types.ObjectId;
  assessmentId: string;
  title: string;
  domain: string;
  domainKey: string;
  description: string;
  totalDurationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  marksPerQuestion: number;
  passingScore: number;
  passingMarks: number;
  negativeMarking: number;
  sections: IAssessmentSection[];
  questionSelection: IAssessmentQuestionSelection;
  status: AssessmentStatus;
  isActive: boolean;
  isSelectable: boolean;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  version: number;
  adminNotes: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ASSESSMENT_STATUSES = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const);

export const ASSESSMENT_COLLECTION = "assessments";

const SECTION_ORDER: readonly AssessmentSectionType[] = [
  "easy",
  "medium",
  "hard",
];

export const ASSESSMENT_CONFIG = Object.freeze({
  totalDurationMinutes: 90,
  totalQuestions: 90,
  totalMarks: 90,
  marksPerQuestion: 1,
  passingScore: 40,
  passingMarks: 36,
  negativeMarking: 0,
  sections: Object.freeze({
    easy: Object.freeze({
      section: "easy" as const,
      title: "Easy Level",
      questionCount: 30,
      durationMinutes: 30,
      randomizeQuestions: true,
      randomizeOptions: true,
      minimumQuestionBankSize: 30,
    }),
    medium: Object.freeze({
      section: "medium" as const,
      title: "Medium Level",
      questionCount: 30,
      durationMinutes: 30,
      randomizeQuestions: true,
      randomizeOptions: true,
      minimumQuestionBankSize: 30,
    }),
    hard: Object.freeze({
      section: "hard" as const,
      title: "Hard Level",
      questionCount: 30,
      durationMinutes: 30,
      randomizeQuestions: true,
      randomizeOptions: true,
      minimumQuestionBankSize: 30,
    }),
  }),
});

const FIXED_CONFIGURATION_KEYS = new Set([
  "totalDurationMinutes",
  "totalQuestions",
  "totalMarks",
  "marksPerQuestion",
  "passingScore",
  "passingMarks",
  "negativeMarking",
  "sections",
  "questionSelection",
]);

const IMMUTABLE_UPDATE_KEYS = new Set([
  "_id",
  "assessmentId",
  "createdBy",
  "createdAt",
  "updatedAt",
  "__v",
]);

const EDITABLE_FIELDS = new Set([
  "title",
  "domain",
  "description",
  "status",
  "publishedBy",
  "adminNotes",
  "version",
]);

export function normalizeAssessmentDomain(domain: string): string {
  return String(domain ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

export function generateAssessmentId(): string {
  const year = new Date().getFullYear();
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `CN-ASSESS-${year}-${random}`;
}

export function getDefaultAssessmentSections(): IAssessmentSection[] {
  return SECTION_ORDER.map((section) => ({
    ...ASSESSMENT_CONFIG.sections[section],
  }));
}

export function getDefaultQuestionSelection(): IAssessmentQuestionSelection {
  return {
    enabled: true,
    randomizePerAttempt: true,
    lockQuestionsOnStart: true,
    preventDuplicateQuestions: true,
  };
}

function applyFixedConfiguration(assessment: IAssessment): void {
  assessment.totalDurationMinutes = ASSESSMENT_CONFIG.totalDurationMinutes;
  assessment.totalQuestions = ASSESSMENT_CONFIG.totalQuestions;
  assessment.totalMarks = ASSESSMENT_CONFIG.totalMarks;
  assessment.marksPerQuestion = ASSESSMENT_CONFIG.marksPerQuestion;
  assessment.passingScore = ASSESSMENT_CONFIG.passingScore;
  assessment.passingMarks = ASSESSMENT_CONFIG.passingMarks;
  assessment.negativeMarking = ASSESSMENT_CONFIG.negativeMarking;
  assessment.sections = getDefaultAssessmentSections();
  assessment.questionSelection = getDefaultQuestionSelection();
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBlockedPath(path: string): boolean {
  return (
    FIXED_CONFIGURATION_KEYS.has(path) ||
    IMMUTABLE_UPDATE_KEYS.has(path) ||
    [...FIXED_CONFIGURATION_KEYS, ...IMMUTABLE_UPDATE_KEYS].some(
      (key) => path.startsWith(`${key}.`),
    )
  );
}

function applyStatusFields(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...values };

  if (next.status === "published") {
    next.isActive = true;
    next.isSelectable = true;
    if (!next.publishedAt) {
      next.publishedAt = new Date();
    }
  } else if (next.status === "draft") {
    next.isActive = true;
    next.isSelectable = false;
  } else if (next.status === "archived") {
    next.isActive = false;
    next.isSelectable = false;
  }

  return next;
}

function sanitizeEditableValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [path, value] of Object.entries(values)) {
    if (isBlockedPath(path)) {
      throw new Error(`The assessment field "${path}" is managed by the system.`);
    }

    if (!EDITABLE_FIELDS.has(path)) {
      throw new Error(`The assessment field "${path}" cannot be updated.`);
    }

    sanitized[path] = value;
  }

  if (Object.prototype.hasOwnProperty.call(sanitized, "domain")) {
    if (typeof sanitized.domain !== "string") {
      throw new Error("Assessment domain must be a string.");
    }

    const domain = sanitized.domain.normalize("NFKC").trim();
    sanitized.domain = domain;
    const domainKey = normalizeAssessmentDomain(domain);

    if (domain.length < 2 || !domainKey) {
      throw new Error("A valid assessment domain is required.");
    }

    sanitized.domainKey = domainKey;
  }

  if (
    Object.prototype.hasOwnProperty.call(sanitized, "title") &&
    (typeof sanitized.title !== "string" || sanitized.title.trim().length < 3)
  ) {
    throw new Error("Assessment title must contain at least 3 characters.");
  }

  if (
    Object.prototype.hasOwnProperty.call(sanitized, "status") &&
    !["draft", "published", "archived"].includes(String(sanitized.status))
  ) {
    throw new Error("Invalid assessment status.");
  }

  if (
    Object.prototype.hasOwnProperty.call(sanitized, "version") &&
    (!Number.isInteger(sanitized.version) ||
      Number(sanitized.version) < 1 ||
      Number(sanitized.version) > 10000)
  ) {
    throw new Error("Assessment version must be an integer between 1 and 10000.");
  }

  return sanitized;
}

function buildSafeUpdate(
  rawUpdate: Record<string, unknown>,
): mongoose.UpdateQuery<IAssessment> {
  const keys = Object.keys(rawUpdate);
  const hasOperators = keys.some((key) => key.startsWith("$"));
  const hasPlainKeys = keys.some((key) => !key.startsWith("$"));

  if (hasOperators && hasPlainKeys) {
    throw new Error("Assessment updates cannot mix operator and plain fields.");
  }

  let setValues: Record<string, unknown> = {};
  let insertValues: Record<string, unknown> = {};

  if (!hasOperators) {
    setValues = sanitizeEditableValues(rawUpdate);
  } else {
    for (const [operator, rawValue] of Object.entries(rawUpdate)) {
      if (operator !== "$set" && operator !== "$setOnInsert") {
        throw new Error(`Assessment update operator "${operator}" is not permitted.`);
      }

      if (!isPlainObject(rawValue)) {
        throw new Error(`Invalid value supplied for ${operator}.`);
      }

      const sanitized = sanitizeEditableValues(rawValue);

      if (operator === "$set") {
        setValues = { ...setValues, ...sanitized };
      } else {
        insertValues = { ...insertValues, ...sanitized };
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(setValues, "status")) {
    setValues = applyStatusFields(setValues);
  }

  if (Object.prototype.hasOwnProperty.call(insertValues, "status")) {
    insertValues = applyStatusFields(insertValues);
  }

  const fixedConfiguration = {
    totalDurationMinutes: ASSESSMENT_CONFIG.totalDurationMinutes,
    totalQuestions: ASSESSMENT_CONFIG.totalQuestions,
    totalMarks: ASSESSMENT_CONFIG.totalMarks,
    marksPerQuestion: ASSESSMENT_CONFIG.marksPerQuestion,
    passingScore: ASSESSMENT_CONFIG.passingScore,
    passingMarks: ASSESSMENT_CONFIG.passingMarks,
    negativeMarking: ASSESSMENT_CONFIG.negativeMarking,
    sections: getDefaultAssessmentSections(),
    questionSelection: getDefaultQuestionSelection(),
  };

  const safeUpdate: Record<string, unknown> = {
    $set: {
      ...setValues,
      ...fixedConfiguration,
    },
  };

  if (Object.keys(insertValues).length > 0) {
    safeUpdate.$setOnInsert = insertValues;
  }

  return safeUpdate as mongoose.UpdateQuery<IAssessment>;
}

const AssessmentSectionSchema = new Schema<IAssessmentSection>(
  {
    section: {
      type: String,
      enum: [...SECTION_ORDER],
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    questionCount: {
      type: Number,
      required: true,
      min: 30,
      max: 30,
      validate: {
        validator: Number.isInteger,
        message: "Question count must be an integer.",
      },
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 30,
      max: 30,
      validate: {
        validator: Number.isInteger,
        message: "Section duration must be an integer.",
      },
    },
    randomizeQuestions: {
      type: Boolean,
      required: true,
      default: true,
    },
    randomizeOptions: {
      type: Boolean,
      required: true,
      default: true,
    },
    minimumQuestionBankSize: {
      type: Number,
      required: true,
      min: 30,
      max: 1000,
      default: 30,
      validate: {
        validator: Number.isInteger,
        message: "Minimum question bank size must be an integer.",
      },
    },
  },
  {
    _id: false,
    id: false,
    strict: "throw",
  },
);

const AssessmentSchema = new Schema<IAssessment>(
  {
    assessmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 5,
      maxlength: 80,
      immutable: true,
      default: generateAssessmentId,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 160,
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
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    totalDurationMinutes: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.totalDurationMinutes,
      min: 90,
      max: 90,
    },
    totalQuestions: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.totalQuestions,
      min: 90,
      max: 90,
    },
    totalMarks: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.totalMarks,
      min: 90,
      max: 90,
    },
    marksPerQuestion: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.marksPerQuestion,
      min: 1,
      max: 1,
    },
    passingScore: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.passingScore,
      min: 40,
      max: 40,
    },
    passingMarks: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.passingMarks,
      min: 36,
      max: 36,
    },
    negativeMarking: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.negativeMarking,
      min: 0,
      max: 0,
    },
    sections: {
      type: [AssessmentSectionSchema],
      required: true,
      default: getDefaultAssessmentSections,
      validate: {
        validator: (sections: IAssessmentSection[]) => {
          if (!Array.isArray(sections) || sections.length !== 3) {
            return false;
          }

          return SECTION_ORDER.every((section, index) => {
            const current = sections[index];
            return (
              current?.section === section &&
              current.questionCount === 30 &&
              current.durationMinutes === 30 &&
              Number.isInteger(current.minimumQuestionBankSize) &&
              current.minimumQuestionBankSize >= 30 &&
              current.minimumQuestionBankSize <= 1000
            );
          });
        },
        message: "Assessment must contain exactly 3 valid difficulty sections.",
      },
    },
    questionSelection: {
      enabled: {
        type: Boolean,
        required: true,
        default: true,
      },
      randomizePerAttempt: {
        type: Boolean,
        required: true,
        default: true,
      },
      lockQuestionsOnStart: {
        type: Boolean,
        required: true,
        default: true,
      },
      preventDuplicateQuestions: {
        type: Boolean,
        required: true,
        default: true,
      },
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
      required: true,
      default: true,
      index: true,
    },
    isSelectable: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: undefined,
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: undefined,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      immutable: true,
      default: undefined,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 10000,
      validate: {
        validator: Number.isInteger,
        message: "Assessment version must be a positive integer.",
      },
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
    minimize: false,
    collection: ASSESSMENT_COLLECTION,
  },
);

AssessmentSchema.pre("validate", function () {
  this.title = typeof this.title === "string" ? this.title.trim() : this.title;
  this.domain = typeof this.domain === "string" ? this.domain.trim() : this.domain;
  this.domainKey = normalizeAssessmentDomain(this.domain);

  if (!this.domainKey) {
    this.invalidate("domainKey", "A valid assessment domain is required.");
  }

  if (!this.assessmentId) {
    this.assessmentId = generateAssessmentId();
  } else {
    this.assessmentId = this.assessmentId.trim().toUpperCase();
  }

  if (!Number.isInteger(this.version) || this.version < 1) {
    this.invalidate("version", "Assessment version must be a positive integer.");
  }

  applyFixedConfiguration(this);

  if (this.status === "published") {
    this.isActive = true;
    this.isSelectable = true;
    if (!this.publishedAt) {
      this.publishedAt = new Date();
    }
  } else if (this.status === "draft") {
    this.isActive = true;
    this.isSelectable = false;
  } else if (this.status === "archived") {
    this.isActive = false;
    this.isSelectable = false;
  }
});

AssessmentSchema.pre("save", function () {
  this.domain = this.domain.trim();
  this.domainKey = normalizeAssessmentDomain(this.domain);
  applyFixedConfiguration(this);

  if (this.status === "published") {
    this.isActive = true;
    this.isSelectable = true;
    if (!this.publishedAt) {
      this.publishedAt = new Date();
    }
  } else if (this.status === "draft") {
    this.isActive = true;
    this.isSelectable = false;
  } else if (this.status === "archived") {
    this.isActive = false;
    this.isSelectable = false;
  }
});

function installUpdateGuards(): void {
  const guard = function (this: mongoose.Query<unknown, IAssessment>) {
    const update = this.getUpdate();

    if (!update) {
      return;
    }

    if (Array.isArray(update)) {
      throw new Error("Aggregation pipeline updates are not permitted for assessments.");
    }

    this.setOptions({
      runValidators: true,
      context: "query",
      strict: "throw",
    });

    this.setUpdate(buildSafeUpdate(update as Record<string, unknown>));
  };

  AssessmentSchema.pre("findOneAndUpdate", guard);
  AssessmentSchema.pre("updateOne", guard);
  AssessmentSchema.pre("updateMany", guard);

  AssessmentSchema.pre("replaceOne", function () {
    throw new Error("Assessment replacement updates are not permitted.");
  });

  AssessmentSchema.pre("findOneAndReplace", function () {
    throw new Error("Assessment replacement updates are not permitted.");
  });
}

installUpdateGuards();

AssessmentSchema.index(
  {
    domainKey: 1,
    status: 1,
    isActive: 1,
    isSelectable: 1,
  },
  {
    name: "assessment_student_selection",
  },
);

AssessmentSchema.index(
  { domainKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "published",
    },
    name: "one_published_assessment_per_domain",
  },
);

AssessmentSchema.index(
  {
    status: 1,
    createdAt: -1,
  },
  {
    name: "assessment_admin_status_created",
  },
);

AssessmentSchema.index(
  {
    assessmentId: 1,
    status: 1,
  },
  {
    name: "assessment_id_status",
  },
);

const Assessment: Model<IAssessment> =
  (mongoose.models.Assessment as Model<IAssessment> | undefined) ??
  mongoose.model<IAssessment>(
    "Assessment",
    AssessmentSchema,
    ASSESSMENT_COLLECTION,
  );

export default Assessment;
