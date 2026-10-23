
import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";
import { randomBytes } from "node:crypto";

/* ============================================================================
 * CyberNet Careers — Assessment Model
 * Production configuration:
 * 30 MCQs + 2 coding questions
 * 60 minutes total; 40/100 passing score
 * ========================================================================== */

export type AssessmentStatus = "draft" | "published" | "archived";
export type AssessmentSectionType = "mcq" | "coding";

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
  description?: string;
  totalDurationMinutes: number;
  passingScore: number;
  totalQuestions: number;
  sections: IAssessmentSection[];
  questionSelection: IAssessmentQuestionSelection;
  status: AssessmentStatus;
  isActive: boolean;
  isSelectable: boolean;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  version: number;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/* ============================================================================
 * Constants
 * ========================================================================== */

export const ASSESSMENT_CONFIG = Object.freeze({
  totalDurationMinutes: 60,
  totalQuestions: 32,
  passingScore: 40,
  mcq: Object.freeze({
    questionCount: 30,
    durationMinutes: 30,
    minimumQuestionBankSize: 30,
  }),
  coding: Object.freeze({
    questionCount: 2,
    durationMinutes: 30,
    minimumQuestionBankSize: 2,
  }),
});

export const ASSESSMENT_STATUSES = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const);

export const ASSESSMENT_COLLECTION = "assessments";

/* ============================================================================
 * Utilities
 * ========================================================================== */

export function normalizeAssessmentDomain(domain: string): string {
  return String(domain ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateAssessmentId(): string {
  const year = new Date().getFullYear();
  const random = randomBytes(4).toString("hex").toUpperCase();

  return `CN-ASSESS-${year}-${random}`;
}

export function getDefaultAssessmentSections(): IAssessmentSection[] {
  return [
    {
      section: "mcq",
      title: "Section 1 — Multiple Choice Questions",
      questionCount: ASSESSMENT_CONFIG.mcq.questionCount,
      durationMinutes: ASSESSMENT_CONFIG.mcq.durationMinutes,
      randomizeQuestions: true,
      randomizeOptions: true,
      minimumQuestionBankSize:
        ASSESSMENT_CONFIG.mcq.minimumQuestionBankSize,
    },
    {
      section: "coding",
      title: "Section 2 — Coding Problems",
      questionCount: ASSESSMENT_CONFIG.coding.questionCount,
      durationMinutes: ASSESSMENT_CONFIG.coding.durationMinutes,
      randomizeQuestions: true,
      randomizeOptions: false,
      minimumQuestionBankSize:
        ASSESSMENT_CONFIG.coding.minimumQuestionBankSize,
    },
  ];
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
  assessment.totalDurationMinutes =
    ASSESSMENT_CONFIG.totalDurationMinutes;

  assessment.totalQuestions = ASSESSMENT_CONFIG.totalQuestions;
  assessment.passingScore = ASSESSMENT_CONFIG.passingScore;
  assessment.sections = getDefaultAssessmentSections();
  assessment.questionSelection = getDefaultQuestionSelection();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/* ============================================================================
 * Section schema
 * ========================================================================== */

const AssessmentSectionSchema = new Schema<IAssessmentSection>(
  {
    section: {
      type: String,
      enum: ["mcq", "coding"],
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
      min: 1,
      max: 30,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 60,
    },
    randomizeQuestions: {
      type: Boolean,
      default: true,
    },
    randomizeOptions: {
      type: Boolean,
      default: false,
    },
    minimumQuestionBankSize: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
    },
  },
  {
    _id: false,
    id: false,
    strict: true,
  },
);

/* ============================================================================
 * Main schema
 * ========================================================================== */

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
      index: true,
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
      min: ASSESSMENT_CONFIG.totalDurationMinutes,
      max: ASSESSMENT_CONFIG.totalDurationMinutes,
    },

    passingScore: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.passingScore,
      min: ASSESSMENT_CONFIG.passingScore,
      max: ASSESSMENT_CONFIG.passingScore,
    },

    totalQuestions: {
      type: Number,
      required: true,
      default: ASSESSMENT_CONFIG.totalQuestions,
      min: ASSESSMENT_CONFIG.totalQuestions,
      max: ASSESSMENT_CONFIG.totalQuestions,
    },

    sections: {
      type: [AssessmentSectionSchema],
      required: true,
      default: getDefaultAssessmentSections,
    },

    questionSelection: {
      enabled: {
        type: Boolean,
        default: true,
      },
      randomizePerAttempt: {
        type: Boolean,
        default: true,
      },
      lockQuestionsOnStart: {
        type: Boolean,
        default: true,
      },
      preventDuplicateQuestions: {
        type: Boolean,
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
      default: true,
      index: true,
    },

    isSelectable: {
      type: Boolean,
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
      default: undefined,
    },

    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 10000,
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
    strict: true,
    minimize: false,
    collection: ASSESSMENT_COLLECTION,
  },
);

/* ============================================================================
 * Document validation
 * ========================================================================== */

AssessmentSchema.pre("validate", function () {
  if (typeof this.domain === "string") {
    this.domain = this.domain.trim();
    this.domainKey = normalizeAssessmentDomain(this.domain);
  }

  if (typeof this.assessmentId === "string") {
    this.assessmentId = this.assessmentId.trim().toUpperCase();
  }

  if (!this.assessmentId) {
    this.assessmentId = generateAssessmentId();
  }

  if (!Number.isInteger(this.version) || this.version < 1) {
    this.version = 1;
  }

  applyFixedConfiguration(this);

  if (this.status === "published") {
    this.isActive = true;
    this.isSelectable = true;

    if (!this.publishedAt) {
      this.publishedAt = new Date();
    }
  } else if (this.status === "draft") {
    this.isSelectable = false;
  } else if (this.status === "archived") {
    this.isActive = false;
    this.isSelectable = false;
  }
});

/* ============================================================================
 * Save safety
 * ========================================================================== */

AssessmentSchema.pre("save", function () {
  if (typeof this.domain === "string") {
    this.domain = this.domain.trim();
    this.domainKey = normalizeAssessmentDomain(this.domain);
  }

  applyFixedConfiguration(this);

  if (this.status === "published") {
    this.isActive = true;
    this.isSelectable = true;

    if (!this.publishedAt) {
      this.publishedAt = new Date();
    }
  } else if (this.status === "draft") {
    this.isSelectable = false;
  } else if (this.status === "archived") {
    this.isActive = false;
    this.isSelectable = false;
  }
});

/* ============================================================================
 * Update-query safety
 *
 * Mongoose document middleware does not run for updateOne/findOneAndUpdate.
 * Keep the fixed assessment configuration consistent for those operations too.
 * ========================================================================== */

function enforceUpdateConfiguration(
  update: Record<string, unknown>,
): Record<string, unknown> {
  const enforced = {
    totalDurationMinutes: ASSESSMENT_CONFIG.totalDurationMinutes,
    passingScore: ASSESSMENT_CONFIG.passingScore,
    totalQuestions: ASSESSMENT_CONFIG.totalQuestions,
    sections: getDefaultAssessmentSections(),
    questionSelection: getDefaultQuestionSelection(),
  };

  const next: Record<string, unknown> = { ...update };

  const existingSet = isPlainObject(next.$set) ? next.$set : {};

  // Prevent conflicting direct and $set paths for fixed fields.
  for (const key of Object.keys(next)) {
    if (
      key === "totalDurationMinutes" ||
      key === "passingScore" ||
      key === "totalQuestions" ||
      key === "sections" ||
      key.startsWith("sections.") ||
      key === "questionSelection" ||
      key.startsWith("questionSelection.")
    ) {
      delete next[key];
    }
  }

  next.$set = {
    ...existingSet,
    ...enforced,
  };

  const status = (next.$set as Record<string, unknown>).status;

  if (status === "published") {
    (next.$set as Record<string, unknown>).isActive = true;
    (next.$set as Record<string, unknown>).isSelectable = true;

    if (!(next.$set as Record<string, unknown>).publishedAt) {
      (next.$set as Record<string, unknown>).publishedAt = new Date();
    }
  } else if (status === "draft") {
    (next.$set as Record<string, unknown>).isSelectable = false;
  } else if (status === "archived") {
    (next.$set as Record<string, unknown>).isActive = false;
    (next.$set as Record<string, unknown>).isSelectable = false;
  }

  return next;
}

AssessmentSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();

  if (!update || Array.isArray(update)) {
    return;
  }

  this.setUpdate(
    enforceUpdateConfiguration(
      update as Record<string, unknown>,
    ) as never,
  );
});

AssessmentSchema.pre("updateOne", function () {
  const update = this.getUpdate();

  if (!update || Array.isArray(update)) {
    return;
  }

  this.setUpdate(
    enforceUpdateConfiguration(
      update as Record<string, unknown>,
    ) as never,
  );
});

/* ============================================================================
 * Indexes
 * ========================================================================== */

// Fast lookup for the student assessment-start endpoint.
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

// Only one published assessment per domain.
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

// Admin list and dashboard sorting.
AssessmentSchema.index(
  {
    status: 1,
    createdAt: -1,
  },
  {
    name: "assessment_admin_status_created",
  },
);

/* ============================================================================
 * Model export
 * ========================================================================== */

const Assessment: Model<IAssessment> =
  (mongoose.models.Assessment as Model<IAssessment> | undefined) ??
  mongoose.model<IAssessment>(
    "Assessment",
    AssessmentSchema,
    ASSESSMENT_COLLECTION,
  );

export default Assessment;
