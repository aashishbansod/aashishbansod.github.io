import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";
import { randomBytes } from "node:crypto";

export type QuestionType = "mcq";
export type QuestionSection = "easy" | "medium" | "hard";
export type QuestionDifficulty = QuestionSection;
export type QuestionStatus = "draft" | "published" | "archived";
export type QuestionOptionId = "A" | "B" | "C" | "D";

export interface IQuestionOption {
  optionId: QuestionOptionId;
  text: string;
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
  description: string;
  options: IQuestionOption[];
  correctOption?: QuestionOptionId;
  topic: string;
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

export const QUESTION_COLLECTION = "questions";

export const QUESTION_TYPES = Object.freeze({
  MCQ: "mcq",
} as const);

export const QUESTION_SECTIONS = Object.freeze({
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
} as const);

export const QUESTION_DIFFICULTIES = Object.freeze({
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
} as const);

export const QUESTION_STATUSES = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const);

export const QUESTION_CONFIG = Object.freeze({
  type: "mcq" as const,
  marks: 1,
  negativeMarks: 0,
  optionsPerQuestion: 4,
  questionsPerSection: 30,
  totalQuestions: 90,
  totalMarks: 90,
  passingPercentage: 40,
  passingMarks: 36,
  totalDurationMinutes: 90,
});

export const QUESTION_LIMITS = Object.freeze({
  QUESTION_TEXT: 10000,
  DESCRIPTION: 15000,
  OPTION_TEXT: 1000,
  TOPIC: 150,
  DOMAIN: 120,
  DOMAIN_KEY: 150,
  QUESTION_ID: 100,
  OPTION_ID: 1,
  MAX_ORDER: 100000,
});

const VALID_SECTIONS: readonly QuestionSection[] = [
  "easy",
  "medium",
  "hard",
];

const VALID_OPTION_IDS: readonly QuestionOptionId[] = [
  "A",
  "B",
  "C",
  "D",
];

const VALID_STATUSES: readonly QuestionStatus[] = [
  "draft",
  "published",
  "archived",
];

const FIXED_UPDATE_FIELDS = new Set([
  "type",
  "marks",
  "negativeMarks",
]);

const IMMUTABLE_UPDATE_FIELDS = new Set([
  "_id",
  "id",
  "__v",
  "createdAt",
  "updatedAt",
  "questionId",
  "assessmentId",
  "createdBy",
]);

const EDITABLE_UPDATE_FIELDS = new Set([
  "domain",
  "domainKey",
  "section",
  "question",
  "description",
  "options",
  "correctOption",
  "topic",
  "difficulty",
  "status",
  "order",
  "updatedBy",
]);

export function normalizeQuestionDomain(domain: string): string {
  return String(domain ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, QUESTION_LIMITS.DOMAIN_KEY);
}

export function normalizeQuestionType(value: unknown): QuestionType | null {
  return String(value ?? "").trim().toLowerCase() === "mcq" ? "mcq" : null;
}

export function normalizeQuestionSection(value: unknown): QuestionSection | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return VALID_SECTIONS.includes(normalized as QuestionSection)
    ? (normalized as QuestionSection)
    : null;
}

export function normalizeQuestionDifficulty(value: unknown): QuestionDifficulty | null {
  return normalizeQuestionSection(value);
}

export function normalizeQuestionStatus(value: unknown): QuestionStatus | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return VALID_STATUSES.includes(normalized as QuestionStatus)
    ? (normalized as QuestionStatus)
    : null;
}

export function generateQuestionId(): string {
  return `CN-Q-${Date.now()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function normalizeQuestionOptionId(value: unknown): QuestionOptionId | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return VALID_OPTION_IDS.includes(normalized as QuestionOptionId)
    ? (normalized as QuestionOptionId)
    : null;
}

export function isValidObjectId(value: unknown): boolean {
  if (value instanceof Types.ObjectId) return true;
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) return false;
  return mongoose.Types.ObjectId.isValid(value);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFKC").trim() : "";
}

function normalizeOptions(value: unknown): IQuestionOption[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const option = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    const optionId = normalizeQuestionOptionId(option.optionId);

    return {
      optionId: optionId ?? ("" as QuestionOptionId),
      text: normalizeText(option.text),
    };
  });
}

function applyFixedQuestionConfiguration(question: IQuestion): void {
  question.type = QUESTION_CONFIG.type;
  question.marks = QUESTION_CONFIG.marks;
  question.negativeMarks = QUESTION_CONFIG.negativeMarks;

  if (question.section) {
    question.difficulty = question.section;
  } else if (question.difficulty) {
    question.section = question.difficulty;
  }
}

function synchronizeQuestionStatus(question: IQuestion): void {
  if (question.status === "published") {
    question.isActive = true;
  } else {
    question.isActive = false;
  }
}

function validatePublishedQuestion(question: IQuestion): void {
  if (!question.question || question.question.trim().length < 5) {
    question.invalidate("question", "A published question requires at least five characters.");
  }

  if (!question.assessmentId || !isValidObjectId(question.assessmentId)) {
    question.invalidate("assessmentId", "A valid assessment reference is required.");
  }

  if (!question.domain || question.domain.trim().length < 2) {
    question.invalidate("domain", "A valid assessment domain is required.");
  }

  if (!question.domainKey || question.domainKey.trim().length < 2) {
    question.invalidate("domainKey", "A valid assessment domain key is required.");
  }

  if (!normalizeQuestionSection(question.section)) {
    question.invalidate("section", "Question section must be easy, medium or hard.");
  }

  if (question.difficulty !== question.section) {
    question.invalidate("difficulty", "Question difficulty must match its section.");
  }

  if (question.type !== QUESTION_CONFIG.type) {
    question.invalidate("type", "Only multiple-choice questions are supported.");
  }

  if (
    !Array.isArray(question.options) ||
    question.options.length !== QUESTION_CONFIG.optionsPerQuestion
  ) {
    question.invalidate("options", "A published MCQ must contain exactly four options.");
    return;
  }

  const optionIds = question.options.map((option) =>
    normalizeQuestionOptionId(option.optionId),
  );

  if (
    optionIds.some((optionId) => optionId === null) ||
    new Set(optionIds).size !== QUESTION_CONFIG.optionsPerQuestion ||
    !VALID_OPTION_IDS.every((optionId) => optionIds.includes(optionId))
  ) {
    question.invalidate("options", "Options must have unique A, B, C and D identifiers.");
  }

  if (question.options.some((option) => {
    const text = normalizeText(option.text);
    return !text || text.length > QUESTION_LIMITS.OPTION_TEXT;
  })) {
    question.invalidate("options", "Every option must contain valid text.");
  }

  const correctOption = normalizeQuestionOptionId(question.correctOption);
  if (!correctOption || !optionIds.includes(correctOption)) {
    question.invalidate("correctOption", "Select exactly one valid correct answer.");
  }

  if (question.marks !== QUESTION_CONFIG.marks) {
    question.invalidate("marks", "Each assessment question must carry exactly one mark.");
  }

  if (question.negativeMarks !== QUESTION_CONFIG.negativeMarks) {
    question.invalidate("negativeMarks", "Negative marking is disabled.");
  }
}

const QuestionOptionSchema = new Schema<IQuestionOption>(
  {
    optionId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: [...VALID_OPTION_IDS],
      minlength: 1,
      maxlength: QUESTION_LIMITS.OPTION_ID,
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
    strict: "throw",
  },
);

const QuestionSchema = new Schema<IQuestion>(
  {
    questionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 5,
      maxlength: QUESTION_LIMITS.QUESTION_ID,
      default: generateQuestionId,
      immutable: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
      immutable: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: QUESTION_LIMITS.DOMAIN,
    },
    domainKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: QUESTION_LIMITS.DOMAIN_KEY,
      index: true,
    },
    section: {
      type: String,
      enum: [...VALID_SECTIONS],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["mcq"],
      required: true,
      default: QUESTION_CONFIG.type,
      immutable: true,
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
      required: true,
      default: [],
      validate: [
        {
          validator: (value: IQuestionOption[]) =>
            Array.isArray(value) && value.length <= QUESTION_CONFIG.optionsPerQuestion,
          message: "An MCQ can contain no more than four options.",
        },
        {
          validator: (value: IQuestionOption[]) => {
            if (!Array.isArray(value)) return false;
            const ids = value.map((option) => option.optionId);
            return new Set(ids).size === ids.length;
          },
          message: "Option identifiers must be unique.",
        },
      ],
    },
    correctOption: {
      type: String,
      trim: true,
      uppercase: true,
      enum: [...VALID_OPTION_IDS],
      minlength: 1,
      maxlength: QUESTION_LIMITS.OPTION_ID,
      select: false,
      default: undefined,
    },
    topic: {
      type: String,
      trim: true,
      maxlength: QUESTION_LIMITS.TOPIC,
      default: "",
    },
    difficulty: {
      type: String,
      enum: [...VALID_SECTIONS],
      required: true,
      index: true,
    },
    marks: {
      type: Number,
      required: true,
      default: QUESTION_CONFIG.marks,
      min: QUESTION_CONFIG.marks,
      max: QUESTION_CONFIG.marks,
      validate: {
        validator: Number.isInteger,
        message: "Question marks must be an integer.",
      },
    },
    negativeMarks: {
      type: Number,
      required: true,
      default: QUESTION_CONFIG.negativeMarks,
      min: QUESTION_CONFIG.negativeMarks,
      max: QUESTION_CONFIG.negativeMarks,
    },
    status: {
      type: String,
      enum: [...VALID_STATUSES],
      required: true,
      default: "draft",
      index: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: QUESTION_LIMITS.MAX_ORDER,
      validate: {
        validator: Number.isInteger,
        message: "Question order must be a non-negative integer.",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: undefined,
      immutable: true,
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
    strict: "throw",
    minimize: false,
    collection: QUESTION_COLLECTION,
    toJSON: {
      virtuals: false,
      versionKey: false,
      transform: (_document, returned) => {
        delete returned.correctOption;
        return returned;
      },
    },
    toObject: {
      virtuals: false,
      versionKey: false,
    },
  },
);

QuestionSchema.pre("validate", function () {
  this.questionId = String(this.questionId ?? "").trim().toUpperCase();
  this.domain = normalizeText(this.domain);
  this.domainKey = normalizeQuestionDomain(this.domain);
  this.question = normalizeText(this.question);
  this.description = normalizeText(this.description);
  this.topic = normalizeText(this.topic);

  const normalizedSection = normalizeQuestionSection(this.section);
  const normalizedDifficulty = normalizeQuestionDifficulty(this.difficulty);

  if (!normalizedSection) {
    this.invalidate("section", "Section must be easy, medium or hard.");
  } else {
    this.section = normalizedSection;
  }

  if (!normalizedDifficulty) {
    this.invalidate("difficulty", "Difficulty must be easy, medium or hard.");
  } else {
    this.difficulty = normalizedDifficulty;
  }

  if (
    normalizedSection &&
    normalizedDifficulty &&
    normalizedSection !== normalizedDifficulty
  ) {
    this.invalidate("difficulty", "Difficulty must match the selected section.");
  }

  if (normalizeQuestionType(this.type) !== QUESTION_CONFIG.type) {
    this.invalidate("type", "Only multiple-choice questions are supported.");
  }

  this.options = normalizeOptions(this.options);

  const normalizedCorrectOption = normalizeQuestionOptionId(this.correctOption);
  if (normalizedCorrectOption) {
    this.correctOption = normalizedCorrectOption;
  }

  const normalizedStatus = normalizeQuestionStatus(this.status);

  if (!normalizedStatus) {
    this.invalidate("status", "Question status must be draft, published or archived.");
  } else {
    this.status = normalizedStatus;
  }

  applyFixedQuestionConfiguration(this);
  synchronizeQuestionStatus(this);

  if (this.status === "published") {
    validatePublishedQuestion(this);
  }

  if (this.assessmentId && !isValidObjectId(this.assessmentId)) {
    this.invalidate("assessmentId", "Invalid assessment reference.");
  }

  if (!Number.isInteger(this.order) || this.order < 0 || this.order > QUESTION_LIMITS.MAX_ORDER) {
    this.invalidate("order", "Question order must be a valid non-negative integer.");
  }
});

QuestionSchema.pre("save", function () {
  applyFixedQuestionConfiguration(this);
  synchronizeQuestionStatus(this);
  this.domain = normalizeText(this.domain);
  this.domainKey = normalizeQuestionDomain(this.domain);
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAllowedUpdatePath(path: string): boolean {
  if (
    path.startsWith("$") ||
    path.includes("$") ||
    path.split(".").some((part) => part === "__proto__" || part === "prototype" || part === "constructor")
  ) {
    return false;
  }

  const normalized = path.replace(/\.\d+(?=\.|$)/g, ".*");
  if (IMMUTABLE_UPDATE_FIELDS.has(normalized)) return false;
  if (FIXED_UPDATE_FIELDS.has(normalized)) return false;

  if (EDITABLE_UPDATE_FIELDS.has(normalized)) return true;

  if (/^options\.\*\.(optionId|text)$/.test(normalized)) return true;

  return false;
}

function sanitizeUpdateValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [path, value] of Object.entries(values)) {
    if (!isAllowedUpdatePath(path)) {
      throw new Error(`Question field "${path}" cannot be updated.`);
    }

    result[path] = value;
  }

  return result;
}

function normalizeUpdateDocument(
  update: Record<string, unknown>,
): Record<string, unknown> {
  const keys = Object.keys(update);
  const hasOperators = keys.some((key) => key.startsWith("$"));
  const hasPlainKeys = keys.some((key) => !key.startsWith("$"));

  if (hasOperators && hasPlainKeys) {
    throw new Error("Question updates cannot mix operator and plain fields.");
  }

  let setValues: Record<string, unknown> = {};
  let insertValues: Record<string, unknown> = {};

  if (!hasOperators) {
    setValues = sanitizeUpdateValues(update);
  } else {
    for (const [operator, rawValues] of Object.entries(update)) {
      if (operator !== "$set" && operator !== "$setOnInsert") {
        throw new Error(`Question update operator "${operator}" is not permitted.`);
      }

      if (!isPlainObject(rawValues)) {
        throw new Error(`Invalid question update payload for ${operator}.`);
      }

      const sanitized = sanitizeUpdateValues(rawValues);

      if (operator === "$set") {
        setValues = { ...setValues, ...sanitized };
      } else {
        insertValues = { ...insertValues, ...sanitized };
      }
    }
  }

  const normalizeValues = (
    values: Record<string, unknown>,
  ): Record<string, unknown> => {
    const normalized = { ...values };

    if (Object.prototype.hasOwnProperty.call(normalized, "domain")) {
      if (typeof normalized.domain !== "string") {
        throw new Error("Question domain must be a string.");
      }

      const domain = normalizeText(normalized.domain);
      normalized.domain = domain;
      const domainKey = normalizeQuestionDomain(domain);

      if (domain.length < 2 || !domainKey) {
        throw new Error("A valid question domain is required.");
      }

      normalized.domainKey = domainKey;
    }

    if (
      Object.prototype.hasOwnProperty.call(normalized, "domainKey") &&
      !Object.prototype.hasOwnProperty.call(normalized, "domain")
    ) {
      throw new Error("Question domainKey is managed by the system.");
    }

    const section = Object.prototype.hasOwnProperty.call(normalized, "section")
      ? normalizeQuestionSection(normalized.section)
      : null;
    const difficulty = Object.prototype.hasOwnProperty.call(normalized, "difficulty")
      ? normalizeQuestionDifficulty(normalized.difficulty)
      : null;

    if (
      Object.prototype.hasOwnProperty.call(normalized, "section") &&
      !section
    ) {
      throw new Error("Question section must be easy, medium or hard.");
    }

    if (
      Object.prototype.hasOwnProperty.call(normalized, "difficulty") &&
      !difficulty
    ) {
      throw new Error("Question difficulty must be easy, medium or hard.");
    }

    if (section && difficulty && section !== difficulty) {
      throw new Error("Question difficulty must match its section.");
    }

    if (section) {
      normalized.section = section;
      normalized.difficulty = section;
    } else if (difficulty) {
      normalized.difficulty = difficulty;
      normalized.section = difficulty;
    }

    if (Object.prototype.hasOwnProperty.call(normalized, "status")) {
      const status = normalizeQuestionStatus(normalized.status);

      if (!status) {
        throw new Error("Question status must be draft, published or archived.");
      }

      normalized.status = status;
      normalized.isActive = status === "published";
    }

    if (
      Object.prototype.hasOwnProperty.call(normalized, "question") &&
      (typeof normalized.question !== "string" ||
        normalizeText(normalized.question).length < 5)
    ) {
      throw new Error("Question text must contain at least five characters.");
    }

    if (Object.prototype.hasOwnProperty.call(normalized, "options")) {
      const options = normalizeOptions(normalized.options);

      if (options.length > QUESTION_CONFIG.optionsPerQuestion) {
        throw new Error("An MCQ can contain no more than four options.");
      }

      normalized.options = options;
    }

    return normalized;
  };

  setValues = normalizeValues(setValues);
  insertValues = normalizeValues(insertValues);

  const result: Record<string, unknown> = {};

  if (Object.keys(setValues).length > 0) {
    result.$set = {
      ...setValues,
      type: QUESTION_CONFIG.type,
      marks: QUESTION_CONFIG.marks,
      negativeMarks: QUESTION_CONFIG.negativeMarks,
    };
  }

  if (Object.keys(insertValues).length > 0) {
    result.$setOnInsert = {
      ...insertValues,
      type: QUESTION_CONFIG.type,
      marks: QUESTION_CONFIG.marks,
      negativeMarks: QUESTION_CONFIG.negativeMarks,
    };
  }

  if (Object.keys(result).length === 0) {
    throw new Error("Question update contains no editable fields.");
  }

  return result;
}

function applyQuestionUpdateMiddleware(
  query: mongoose.Query<unknown, IQuestion>,
): void {
  const update = query.getUpdate();

  if (!update) return;

  if (Array.isArray(update)) {
    throw new Error("Aggregation pipeline updates are not permitted for questions.");
  }

  query.setOptions({
    runValidators: true,
    context: "query",
    strict: "throw",
  });

  query.setUpdate(normalizeUpdateDocument(update as Record<string, unknown>));
}

QuestionSchema.pre("findOneAndUpdate", function () {
  applyQuestionUpdateMiddleware(this);
});

QuestionSchema.pre("updateOne", function () {
  applyQuestionUpdateMiddleware(this);
});

QuestionSchema.pre("updateMany", function () {
  applyQuestionUpdateMiddleware(this);
});

QuestionSchema.pre("replaceOne", function () {
  throw new Error("Question replacement is disabled. Load the document and update it with save().");
});

QuestionSchema.pre("findOneAndReplace", function () {
  throw new Error("Question replacement is disabled. Load the document and update it with save().");
});

QuestionSchema.index(
  {
    assessmentId: 1,
    domainKey: 1,
    section: 1,
    difficulty: 1,
    status: 1,
    isActive: 1,
  },
  {
    name: "assessment_question_bank_lookup",
  },
);

QuestionSchema.index(
  {
    assessmentId: 1,
    section: 1,
    status: 1,
    order: 1,
    createdAt: 1,
  },
  {
    name: "assessment_question_order",
  },
);

QuestionSchema.index(
  {
    domainKey: 1,
    section: 1,
    status: 1,
    isActive: 1,
  },
  {
    name: "question_domain_difficulty_lookup",
  },
);

QuestionSchema.index(
  {
    assessmentId: 1,
    questionId: 1,
  },
  {
    name: "assessment_question_id_lookup",
  },
);

const Question: Model<IQuestion> =
  (mongoose.models.Question as Model<IQuestion> | undefined) ??
  mongoose.model<IQuestion>(
    "Question",
    QuestionSchema,
    QUESTION_COLLECTION,
  );

export { QuestionSchema };
export default Question;
