const mongoose = require("mongoose");
const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

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

const generateResultId = () => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RES-${year}-${random}`;
};

const normalizeStatus = (value) => {
  const status = typeof value === "string" ? value.trim().toUpperCase() : "";
  return status === "PASS" ? "PASS" : "FAIL";
};

/*
|--------------------------------------------------------------------------
| Answer Schema
|--------------------------------------------------------------------------
*/

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
    },

    selectedAnswer: {
      type: String,
      default: "",
      trim: true,
    },

    correctAnswer: {
      type: String,
      default: "",
      trim: true,
    },

    isCorrect: {
      type: Boolean,
      default: false,
    },

    marksObtained: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

/*
|--------------------------------------------------------------------------
| Result Schema
|--------------------------------------------------------------------------
*/

const resultSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | References
    |--------------------------------------------------------------------------
    */
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Result Information
    |--------------------------------------------------------------------------
    */
    resultId: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    assessmentType: {
      type: String,
      enum: ["Scholarship", "Internship", "Practice", "Company"],
      default: "Scholarship",
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Answers
    |--------------------------------------------------------------------------
    */
    answers: {
      type: [answerSchema],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | Statistics
    |--------------------------------------------------------------------------
    */
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    attemptedQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    skippedQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    correctAnswers: {
      type: Number,
      default: 0,
      min: 0,
    },

    wrongAnswers: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | Scores
    |--------------------------------------------------------------------------
    */
    mcqScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    codingScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    bonusMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Scholarship
    |--------------------------------------------------------------------------
    */
    scholarshipPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    internshipUnlocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Status
    |--------------------------------------------------------------------------
    */
    status: {
      type: String,
      enum: ["PASS", "FAIL"],
      default: "FAIL",
      index: true,
    },

    passPercentage: {
      type: Number,
      default: 40,
      min: 0,
      max: 100,
    },

    /*
    |--------------------------------------------------------------------------
    | Leaderboard
    |--------------------------------------------------------------------------
    */
    rank: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    percentile: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    /*
    |--------------------------------------------------------------------------
    | Certificate
    |--------------------------------------------------------------------------
    */
    certificateEligible: {
      type: Boolean,
      default: false,
      index: true,
    },

    certificateIssued: {
      type: Boolean,
      default: false,
    },

    certificateIssuedAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | Email Tracking
    |--------------------------------------------------------------------------
    */
    emailSent: {
      type: Boolean,
      default: false,
    },

    emailSentAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | Publication
    |--------------------------------------------------------------------------
    */
    resultPublished: {
      type: Boolean,
      default: false,
      index: true,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | Timing
    |--------------------------------------------------------------------------
    */
    assessmentDuration: {
      type: Number,
      default: 0,
      min: 0,
    },

    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    finishedAt: {
      type: Date,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Remarks
    |--------------------------------------------------------------------------
    */
    remarks: {
      type: String,
      default: "",
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

resultSchema.index({ student: 1, createdAt: -1 });
resultSchema.index({ assessment: 1, student: 1 });
resultSchema.index({ percentage: -1 });
resultSchema.index({ scholarshipPercentage: -1 });
resultSchema.index({ status: 1, resultPublished: 1 });
resultSchema.index({ certificateEligible: 1, certificateIssued: 1 });

/*
|--------------------------------------------------------------------------
| Virtuals
|--------------------------------------------------------------------------
*/

resultSchema.virtual("performanceLevel").get(function () {
  if (this.percentage >= 95) return "Outstanding";
  if (this.percentage >= 90) return "Excellent";
  if (this.percentage >= 80) return "Good";
  if (this.percentage >= 70) return "Average";
  return "Needs Improvement";
});

resultSchema.virtual("totalAttempted").get(function () {
  return Number(this.attemptedQuestions || 0);
});

resultSchema.virtual("totalSkipped").get(function () {
  return Number(this.skippedQuestions || 0);
});

resultSchema.virtual("isPassed").get(function () {
  return this.status === "PASS";
});

/*
|--------------------------------------------------------------------------
| Methods
|--------------------------------------------------------------------------
*/

resultSchema.methods.recalculateStatus = function () {
  const passPercentage = clampNumber(this.passPercentage, 40, 0, 100);

  this.status = Number(this.percentage || 0) >= passPercentage ? "PASS" : "FAIL";
  this.internshipUnlocked = this.status === "PASS";
  this.certificateEligible = this.status === "PASS";

  return this.status;
};

resultSchema.methods.getPublicData = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

/*
|--------------------------------------------------------------------------
| Pre-Validate
|--------------------------------------------------------------------------
*/

resultSchema.pre("validate", function (next) {
  try {
    if (!this.resultId) {
      this.resultId = generateResultId();
    }

    this.resultId = String(this.resultId).trim().toUpperCase();
    this.assessmentType = normalizeText(this.assessmentType) || "Scholarship";
    this.status = normalizeStatus(this.status);
    this.remarks = normalizeText(this.remarks);

    this.totalQuestions = clampNumber(this.totalQuestions, 0, 0);
    this.attemptedQuestions = clampNumber(this.attemptedQuestions, 0, 0);
    this.skippedQuestions = clampNumber(this.skippedQuestions, 0, 0);
    this.correctAnswers = clampNumber(this.correctAnswers, 0, 0);
    this.wrongAnswers = clampNumber(this.wrongAnswers, 0, 0);

    this.mcqScore = clampNumber(this.mcqScore, 0, 0);
    this.codingScore = clampNumber(this.codingScore, 0, 0);
    this.bonusMarks = clampNumber(this.bonusMarks, 0, 0);
    this.negativeMarks = clampNumber(this.negativeMarks, 0, 0);
    this.totalScore = clampNumber(this.totalScore, 0, 0);

    this.percentage = clampNumber(this.percentage, 0, 0, 100);
    this.scholarshipPercentage = clampNumber(
      this.scholarshipPercentage,
      0,
      0,
      100
    );

    this.rank = clampNumber(this.rank, 0, 0);
    this.percentile = clampNumber(this.percentile, 0, 0, 100);

    this.passPercentage = clampNumber(this.passPercentage, 40, 0, 100);
    this.assessmentDuration = clampNumber(this.assessmentDuration, 0, 0);
    this.timeSpentSeconds = clampNumber(this.timeSpentSeconds, 0, 0);

    this.recalculateStatus();

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

resultSchema.pre("save", function (next) {
  try {
    if (this.isModified("resultId") && this.resultId) {
      this.resultId = String(this.resultId).trim().toUpperCase();
    }

    if (this.isModified("status")) {
      this.status = normalizeStatus(this.status);
    }

    if (this.isModified("percentage")) {
      this.percentage = clampNumber(this.percentage, 0, 0, 100);
    }

    if (this.isModified("scholarshipPercentage")) {
      this.scholarshipPercentage = clampNumber(
        this.scholarshipPercentage,
        0,
        0,
        100
      );
    }

    if (this.isModified("assessmentType")) {
      this.assessmentType = normalizeText(this.assessmentType) || "Scholarship";
    }

    if (this.isModified("remarks")) {
      this.remarks = normalizeText(this.remarks);
    }

    if (this.isModified("startedAt") && this.startedAt) {
      this.startedAt = new Date(this.startedAt);
    }

    if (this.isModified("finishedAt") && this.finishedAt) {
      this.finishedAt = new Date(this.finishedAt);
    }

    if (this.isModified("submittedAt") && this.submittedAt) {
      this.submittedAt = new Date(this.submittedAt);
    }

    if (this.status === "PASS") {
      this.internshipUnlocked = true;
      this.certificateEligible = true;
    } else {
      this.internshipUnlocked = false;
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

const transformResult = (doc, ret) => {
  delete ret.__v;
  return ret;
};

resultSchema.set("toJSON", {
  virtuals: true,
  transform: transformResult,
});

resultSchema.set("toObject", {
  virtuals: true,
  transform: transformResult,
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports =
  mongoose.models.Result ||
  mongoose.model("Result", resultSchema);