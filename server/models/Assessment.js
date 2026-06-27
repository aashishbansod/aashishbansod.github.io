const mongoose = require("mongoose");
const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeUpper = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const normalizeLower = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter((item) => typeof item === "string" && item.length > 0);
};

const clampNumber = (
  value,
  fallback = 0,
  min = 0,
  max = Number.MAX_SAFE_INTEGER
) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
};

const generateCode = (prefix = "ASM") => {
  const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${prefix}-${raw}`;
};

/*
|--------------------------------------------------------------------------
| Scholarship Rules Sub-Schema
|--------------------------------------------------------------------------
*/

const scholarshipRulesSchema = new mongoose.Schema(
  {
    scholarship100: {
      type: Number,
      default: 90,
      min: 0,
      max: 100,
    },
    scholarship75: {
      type: Number,
      default: 80,
      min: 0,
      max: 100,
    },
    scholarship50: {
      type: Number,
      default: 70,
      min: 0,
      max: 100,
    },
    scholarship30: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

/*
|--------------------------------------------------------------------------
| Assessment Schema
|--------------------------------------------------------------------------
*/

const assessmentSchema = new mongoose.Schema(
  {
    assessmentName: {
      type: String,
      required: [true, "Assessment name is required"],
      trim: true,
      minlength: 2,
      maxlength: 120,
      index: true,
    },

    assessmentCode: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    internshipDomain: {
      type: String,
      required: [true, "Internship domain is required"],
      trim: true,
      index: true,
    },

    duration: {
      type: Number,
      default: 60,
      min: 5,
      max: 600,
    },

    totalMCQQuestions: {
      type: Number,
      default: 30,
      min: 0,
      max: 500,
    },

    totalCodingQuestions: {
      type: Number,
      default: 2,
      min: 0,
      max: 100,
    },

    totalMarks: {
      type: Number,
      default: 100,
      min: 1,
      max: 10000,
    },

    passingPercentage: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },

    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],

    scholarshipEnabled: {
      type: Boolean,
      default: true,
    },

    certificateEnabled: {
      type: Boolean,
      default: true,
    },

    antiCopyPaste: {
      type: Boolean,
      default: true,
    },

    antiTabSwitch: {
      type: Boolean,
      default: true,
    },

    fullScreenRequired: {
      type: Boolean,
      default: true,
    },

    webcamMonitoring: {
      type: Boolean,
      default: false,
    },

    autoSubmit: {
      type: Boolean,
      default: true,
    },

    randomQuestions: {
      type: Boolean,
      default: true,
    },

    shuffleOptions: {
      type: Boolean,
      default: true,
    },

    maxAttempts: {
      type: Number,
      default: 1,
      min: 1,
      max: 20,
    },

    scholarshipRules: {
      type: scholarshipRulesSchema,
      default: () => ({}),
    },

    instructions: {
      type: [String],
      default: [],
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "CLOSED"],
      default: "DRAFT",
      index: true,
    },

    createdBy: {
      type: String,
      default: "CyberNet Admin",
      trim: true,
    },

    updatedBy: {
      type: String,
      default: "CyberNet Admin",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

assessmentSchema.index({ assessmentName: 1, internshipDomain: 1 });
assessmentSchema.index({ assessmentCode: 1 });
assessmentSchema.index({ status: 1, isActive: 1 });
assessmentSchema.index({ internshipDomain: 1, status: 1 });
assessmentSchema.index({ createdAt: -1 });

/*
|--------------------------------------------------------------------------
| Virtuals
|--------------------------------------------------------------------------
*/

assessmentSchema.virtual("isPublished").get(function () {
  return this.status === "ACTIVE" && this.isActive === true;
});

assessmentSchema.virtual("isExpired").get(function () {
  if (!this.endDate) return false;
  return new Date() > new Date(this.endDate);
});

assessmentSchema.virtual("questionCount").get(function () {
  return Array.isArray(this.questions) ? this.questions.length : 0;
});

assessmentSchema.virtual("totalQuestionCount").get(function () {
  return (
    Number(this.totalMCQQuestions || 0) +
    Number(this.totalCodingQuestions || 0)
  );
});

/*
|--------------------------------------------------------------------------
| Methods
|--------------------------------------------------------------------------
*/

assessmentSchema.methods.isCurrentlyActive = function () {
  if (!this.isActive || this.status !== "ACTIVE") return false;

  const now = new Date();

  if (this.startDate && now < new Date(this.startDate)) {
    return false;
  }

  if (this.endDate && now > new Date(this.endDate)) {
    return false;
  }

  return true;
};

assessmentSchema.methods.getScholarshipTier = function (percentage) {
  const score = clampNumber(percentage, 0, 0, 100);

  if (score >= this.scholarshipRules?.scholarship100) return 100;
  if (score >= this.scholarshipRules?.scholarship75) return 75;
  if (score >= this.scholarshipRules?.scholarship50) return 50;
  if (score >= this.scholarshipRules?.scholarship30) return 30;

  return 0;
};

assessmentSchema.methods.canAttempt = function (attemptCount = 0) {
  return Number(attemptCount || 0) < Number(this.maxAttempts || 1);
};

assessmentSchema.methods.getPublicData = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

/*
|--------------------------------------------------------------------------
| Pre-Validate
|--------------------------------------------------------------------------
*/

assessmentSchema.pre("validate", function (next) {
  try {
    if (!this.assessmentCode) {
      this.assessmentCode = generateCode("ASM");
    }

    this.assessmentName = normalizeText(this.assessmentName);
    this.assessmentCode = normalizeUpper(this.assessmentCode);
    this.description = normalizeText(this.description);
    this.internshipDomain = normalizeText(this.internshipDomain);
    this.createdBy = normalizeText(this.createdBy) || "CyberNet Admin";
    this.updatedBy = normalizeText(this.updatedBy) || "CyberNet Admin";

    this.instructions = normalizeArray(this.instructions);

    if (!Array.isArray(this.questions)) {
      this.questions = [];
    }

    this.totalMCQQuestions = clampNumber(this.totalMCQQuestions, 30, 0, 500);
    this.totalCodingQuestions = clampNumber(this.totalCodingQuestions, 2, 0, 100);
    this.totalMarks = clampNumber(this.totalMarks, 100, 1, 10000);
    this.passingPercentage = clampNumber(this.passingPercentage, 60, 0, 100);
    this.maxAttempts = clampNumber(this.maxAttempts, 1, 1, 20);

    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| Pre-Save
|--------------------------------------------------------------------------
*/

assessmentSchema.pre("save", function (next) {
  try {
    if (this.isModified("assessmentCode") && this.assessmentCode) {
      this.assessmentCode = normalizeUpper(this.assessmentCode);
    }

    if (this.isModified("status")) {
      const allowed = ["DRAFT", "ACTIVE", "CLOSED"];
      const normalized = normalizeUpper(this.status);
      this.status = allowed.includes(normalized) ? normalized : "DRAFT";
    }

    if (this.isModified("assessmentName")) {
      this.assessmentName = normalizeText(this.assessmentName);
    }

    if (this.isModified("description")) {
      this.description = normalizeText(this.description);
    }

    if (this.isModified("internshipDomain")) {
      this.internshipDomain = normalizeText(this.internshipDomain);
    }

    if (this.isModified("createdBy")) {
      this.createdBy = normalizeText(this.createdBy) || "CyberNet Admin";
    }

    if (this.isModified("updatedBy")) {
      this.updatedBy = normalizeText(this.updatedBy) || "CyberNet Admin";
    }

    if (this.isModified("instructions") && Array.isArray(this.instructions)) {
      this.instructions = normalizeArray(this.instructions);
    }

    if (this.isModified("totalMCQQuestions")) {
      this.totalMCQQuestions = clampNumber(this.totalMCQQuestions, 30, 0, 500);
    }

    if (this.isModified("totalCodingQuestions")) {
      this.totalCodingQuestions = clampNumber(this.totalCodingQuestions, 2, 0, 100);
    }

    if (this.isModified("totalMarks")) {
      this.totalMarks = clampNumber(this.totalMarks, 100, 1, 10000);
    }

    if (this.isModified("passingPercentage")) {
      this.passingPercentage = clampNumber(
        this.passingPercentage,
        60,
        0,
        100
      );
    }

    if (this.isModified("maxAttempts")) {
      this.maxAttempts = clampNumber(this.maxAttempts, 1, 1, 20);
    }

    if (this.startDate && this.endDate && new Date(this.endDate) < new Date(this.startDate)) {
      const tmp = this.startDate;
      this.startDate = this.endDate;
      this.endDate = tmp;
    }

    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| Transform
|--------------------------------------------------------------------------
*/

const transformAssessment = (doc, ret) => {
  delete ret.__v;
  return ret;
};

assessmentSchema.set("toJSON", {
  virtuals: true,
  transform: transformAssessment,
});

assessmentSchema.set("toObject", {
  virtuals: true,
  transform: transformAssessment,
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports =
  mongoose.models.Assessment ||
  mongoose.model("Assessment", assessmentSchema);