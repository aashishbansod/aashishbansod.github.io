const mongoose = require("mongoose");
const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeLower = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeUpper = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter((item) => typeof item === "string" && item.length > 0);
};

const clampNumber = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
};

const generateCode = (prefix = "Q") => {
  const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `${prefix}-${raw}`;
};

/*
|--------------------------------------------------------------------------
| Option Schema
|--------------------------------------------------------------------------
*/

const optionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: true,
      trim: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/*
|--------------------------------------------------------------------------
| Question Schema
|--------------------------------------------------------------------------
*/

const questionSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | Basic Information
    |--------------------------------------------------------------------------
    */
    questionCode: {
      type: String,
      unique: true,
      index: true,
      trim: true,
    },

    questionType: {
      type: String,
      enum: ["MCQ", "CODING"],
      required: true,
      index: true,
    },

    title: {
      type: String,
      default: "",
      trim: true,
    },

    question: {
      type: String,
      required: true,
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Domain
    |--------------------------------------------------------------------------
    */
    domain: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    subDomain: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Difficulty
    |--------------------------------------------------------------------------
    */
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Easy",
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | MCQ Section
    |--------------------------------------------------------------------------
    */
    options: {
      type: [optionSchema],
      default: [],
    },

    correctAnswer: {
      type: String,
      required: true,
      trim: true,
    },

    explanation: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Marks
    |--------------------------------------------------------------------------
    */
    marks: {
      type: Number,
      default: 1,
      min: 1,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | Coding Section
    |--------------------------------------------------------------------------
    */
    codingLanguage: {
      type: [String],
      default: [],
    },

    starterCode: {
      type: String,
      default: "",
    },

    sampleInput: {
      type: String,
      default: "",
    },

    sampleOutput: {
      type: String,
      default: "",
    },

    hiddenInput: {
      type: String,
      default: "",
    },

    hiddenOutput: {
      type: String,
      default: "",
    },

    timeLimit: {
      type: Number,
      default: 2,
      min: 1,
    },

    memoryLimit: {
      type: Number,
      default: 256,
      min: 16,
    },

    /*
    |--------------------------------------------------------------------------
    | Assessment Settings
    |--------------------------------------------------------------------------
    */
    assessmentType: {
      type: String,
      enum: ["Scholarship", "Internship", "Practice", "Company"],
      default: "Scholarship",
      index: true,
    },

    companyName: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Analytics
    |--------------------------------------------------------------------------
    */
    totalAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    correctAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    successRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    /*
    |--------------------------------------------------------------------------
    | Status
    |--------------------------------------------------------------------------
    */
    isActive: {
      type: Boolean,
      default: true,
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

questionSchema.index({ domain: 1, difficulty: 1 });
questionSchema.index({ assessmentType: 1, isActive: 1 });
questionSchema.index({ questionType: 1, isActive: 1 });
questionSchema.index({ companyName: 1, isActive: 1 });
questionSchema.index({ createdAt: -1 });

/*
|--------------------------------------------------------------------------
| Virtuals
|--------------------------------------------------------------------------
*/

questionSchema.virtual("attemptAccuracy").get(function () {
  if (!this.totalAttempts) return 0;
  return Math.round((this.correctAttempts / this.totalAttempts) * 100);
});

questionSchema.virtual("isCodingQuestion").get(function () {
  return this.questionType === "CODING";
});

questionSchema.virtual("isMcqQuestion").get(function () {
  return this.questionType === "MCQ";
});

/*
|--------------------------------------------------------------------------
| Methods
|--------------------------------------------------------------------------
*/

questionSchema.methods.incrementAttempt = async function (isCorrect = false) {
  this.totalAttempts = clampNumber(this.totalAttempts, 0, 0) + 1;

  if (isCorrect) {
    this.correctAttempts = clampNumber(this.correctAttempts, 0, 0) + 1;
  }

  this.successRate =
    this.totalAttempts > 0
      ? Number(
          (
            (this.correctAttempts / this.totalAttempts) *
            100
          ).toFixed(2)
        )
      : 0;

  return this.save();
};

questionSchema.methods.getPublicData = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  delete obj.hiddenInput;
  delete obj.hiddenOutput;
  return obj;
};

questionSchema.methods.isAnswerCorrect = function (answer) {
  const normalize = (value) =>
    typeof value === "string"
      ? value.replace(/\s+/g, "").trim().toLowerCase()
      : "";

  return normalize(answer) === normalize(this.correctAnswer);
};

/*
|--------------------------------------------------------------------------
| Pre-Validate
|--------------------------------------------------------------------------
*/

questionSchema.pre("validate", function (next) {
  try {
    if (!this.questionCode) {
      this.questionCode = generateCode("Q");
    }

    this.questionType = normalizeUpper(this.questionType);
    this.title = normalizeText(this.title);
    this.question = normalizeText(this.question);
    this.domain = normalizeText(this.domain);
    this.subDomain = normalizeText(this.subDomain);
    this.difficulty = normalizeText(this.difficulty) || "Easy";
    this.correctAnswer = normalizeText(this.correctAnswer);
    this.explanation = normalizeText(this.explanation);
    this.assessmentType = normalizeText(this.assessmentType) || "Scholarship";
    this.companyName = normalizeText(this.companyName);
    this.createdBy = normalizeText(this.createdBy) || "CyberNet Admin";
    this.updatedBy = normalizeText(this.updatedBy) || "CyberNet Admin";

    if (!Array.isArray(this.options)) {
      this.options = [];
    }

    this.options = this.options
      .map((opt, index) => {
        if (!opt) return null;

        const optionId = normalizeText(opt.optionId) || `OPT-${index + 1}`;
        const text = normalizeText(opt.text);

        if (!text) return null;

        return {
          optionId,
          text,
        };
      })
      .filter(Boolean);

    this.codingLanguage = normalizeArray(this.codingLanguage);
    this.starterCode = normalizeText(this.starterCode);
    this.sampleInput = normalizeText(this.sampleInput);
    this.sampleOutput = normalizeText(this.sampleOutput);
    this.hiddenInput = normalizeText(this.hiddenInput);
    this.hiddenOutput = normalizeText(this.hiddenOutput);

    this.marks = clampNumber(this.marks, 1, 1, 1000);
    this.negativeMarks = clampNumber(this.negativeMarks, 0, 0, 1000);
    this.timeLimit = clampNumber(this.timeLimit, 2, 1, 60);
    this.memoryLimit = clampNumber(this.memoryLimit, 256, 16, 2048);

    this.totalAttempts = clampNumber(this.totalAttempts, 0, 0);
    this.correctAttempts = clampNumber(this.correctAttempts, 0, 0);
    this.successRate = clampNumber(this.successRate, 0, 0, 100);

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

questionSchema.pre("save", function (next) {
  try {
    if (this.isModified("questionType")) {
      this.questionType = normalizeUpper(this.questionType);
    }

    if (this.isModified("domain")) {
      this.domain = normalizeText(this.domain);
    }

    if (this.isModified("difficulty")) {
      const allowed = ["Easy", "Medium", "Hard"];
      const normalized = normalizeText(this.difficulty);
      this.difficulty = allowed.includes(normalized) ? normalized : "Easy";
    }

    if (this.isModified("assessmentType")) {
      const allowed = ["Scholarship", "Internship", "Practice", "Company"];
      const normalized = normalizeText(this.assessmentType);
      this.assessmentType = allowed.includes(normalized)
        ? normalized
        : "Scholarship";
    }

    if (this.isModified("questionCode") && this.questionCode) {
      this.questionCode = normalizeUpper(this.questionCode);
    }

    if (this.isModified("options") && Array.isArray(this.options)) {
      this.options = this.options
        .map((opt, index) => {
          if (!opt) return null;

          const optionId = normalizeText(opt.optionId) || `OPT-${index + 1}`;
          const text = normalizeText(opt.text);

          if (!text) return null;

          return {
            optionId,
            text,
          };
        })
        .filter(Boolean);
    }

    if (this.isModified("codingLanguage") && Array.isArray(this.codingLanguage)) {
      this.codingLanguage = normalizeArray(this.codingLanguage);
    }

    if (this.isModified("question")) this.question = normalizeText(this.question);
    if (this.isModified("title")) this.title = normalizeText(this.title);
    if (this.isModified("subDomain")) this.subDomain = normalizeText(this.subDomain);
    if (this.isModified("correctAnswer")) this.correctAnswer = normalizeText(this.correctAnswer);
    if (this.isModified("explanation")) this.explanation = normalizeText(this.explanation);
    if (this.isModified("starterCode")) this.starterCode = normalizeText(this.starterCode);
    if (this.isModified("sampleInput")) this.sampleInput = normalizeText(this.sampleInput);
    if (this.isModified("sampleOutput")) this.sampleOutput = normalizeText(this.sampleOutput);
    if (this.isModified("hiddenInput")) this.hiddenInput = normalizeText(this.hiddenInput);
    if (this.isModified("hiddenOutput")) this.hiddenOutput = normalizeText(this.hiddenOutput);
    if (this.isModified("companyName")) this.companyName = normalizeText(this.companyName);
    if (this.isModified("createdBy")) this.createdBy = normalizeText(this.createdBy) || "CyberNet Admin";
    if (this.isModified("updatedBy")) this.updatedBy = normalizeText(this.updatedBy) || "CyberNet Admin";

    this.marks = clampNumber(this.marks, 1, 1, 1000);
    this.negativeMarks = clampNumber(this.negativeMarks, 0, 0, 1000);
    this.timeLimit = clampNumber(this.timeLimit, 2, 1, 60);
    this.memoryLimit = clampNumber(this.memoryLimit, 256, 16, 2048);

    this.totalAttempts = clampNumber(this.totalAttempts, 0, 0);
    this.correctAttempts = clampNumber(this.correctAttempts, 0, 0);
    this.successRate = clampNumber(this.successRate, 0, 0, 100);

    if (this.totalAttempts > 0) {
      this.successRate = Number(
        ((this.correctAttempts / this.totalAttempts) * 100).toFixed(2)
      );
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

const transformQuestion = (doc, ret) => {
  delete ret.__v;
  delete ret.hiddenInput;
  delete ret.hiddenOutput;
  return ret;
};

questionSchema.set("toJSON", {
  virtuals: true,
  transform: transformQuestion,
});

questionSchema.set("toObject", {
  virtuals: true,
  transform: transformQuestion,
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports =
  mongoose.models.Question ||
  mongoose.model("Question", questionSchema);