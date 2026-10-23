import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/db";
import AdminModel from "@/models/Admin";
import Assessment from "@/models/Assessment";
import Question, {
  generateQuestionId,
  normalizeQuestionDomain,
  type QuestionDifficulty,
  type QuestionSection,
  type QuestionType,
} from "@/models/Question";
import {
  AUTH_COOKIE_NAME,
  verifyAuthToken,
  type AuthUser,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const REQUIRED_MCQ = 30;
const REQUIRED_CODING = 2;
const REQUIRED_TOTAL = REQUIRED_MCQ + REQUIRED_CODING;
const MCQ_MARKS = 2;
const CODING_MARKS = 20;
const MAX_LIMIT = 100;

const QUESTION_TYPES = ["mcq", "coding"] as const;
const DB_STATUSES = ["draft", "published", "archived"] as const;
const UI_STATUSES = ["draft", "active", "inactive"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

type AnyRecord = Record<string, unknown>;
type UiStatus = (typeof UI_STATUSES)[number];
type DbStatus = (typeof DB_STATUSES)[number];
type OptionId = "A" | "B" | "C" | "D";
type SafeOption = { optionId: OptionId; text: string };
type SafeExample = { input: string; output: string; explanation?: string };

function respond(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function ok(data: Record<string, unknown>, status = 200): NextResponse {
  return respond({ success: true, ...data }, status);
}

function fail(message: string, code: string, status: number): NextResponse {
  return respond({ success: false, message, code }, status);
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max = 10000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function toObjectId(value: unknown): mongoose.Types.ObjectId | null {
  if (value instanceof mongoose.Types.ObjectId) return value;
  const valueText = text(value, 100);
  return valueText && mongoose.isValidObjectId(valueText)
    ? new mongoose.Types.ObjectId(valueText)
    : null;
}

function isQuestionType(value: unknown): value is QuestionType {
  return QUESTION_TYPES.includes(value as QuestionType);
}

function isDifficulty(value: unknown): value is QuestionDifficulty {
  return DIFFICULTIES.includes(value as QuestionDifficulty);
}

function toUiStatus(value: unknown, isActive?: unknown): UiStatus {
  const status = text(value, 30).toLowerCase();
  if (status === "draft") return "draft";
  if (status === "inactive" || status === "archived") return "inactive";
  if (status === "active" || status === "published") return "active";
  return isActive === false ? "inactive" : "draft";
}

/**
 * Compatibility layer:
 * The existing Question model uses draft/published/archived.
 * The admin UI uses draft/active/inactive.
 * Keep the schema-compatible database values while returning UI vocabulary.
 */
function toDbStatus(value: UiStatus): DbStatus {
  if (value === "active") return "published";
  if (value === "inactive") return "archived";
  return "draft";
}

function activeForStatus(status: UiStatus): boolean {
  return status === "active";
}

function idFromRequest(request: NextRequest, body?: AnyRecord): mongoose.Types.ObjectId | null {
  const queryId = request.nextUrl.searchParams.get("id") ??
    request.nextUrl.searchParams.get("questionId");
  return toObjectId(queryId || body?.id || body?._id || body?.questionId);
}

async function authenticateAdmin(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;

    const user = await verifyAuthToken(token);
    if (!user || user.role !== "admin" || !user.id) return null;

    await connectDB();
    const adminId = toObjectId(user.id);
    if (!adminId) return null;

    const admin = await AdminModel.findById(adminId)
      .select("_id role isActive")
      .lean()
      .exec();

    if (!admin || admin.isActive === false) return null;
    return user;
  } catch (error) {
    console.error("[admin/questions] authentication error", error);
    return null;
  }
}

function assessmentDomain(assessment: AnyRecord): string {
  return text(assessment.domain, 200) || text(assessment.category, 200);
}

function getAssessmentDomainKey(assessment: AnyRecord): string {
  return normalizeQuestionDomain(
    text(assessment.domainKey, 200) || assessmentDomain(assessment),
  );
}

function assessmentIsLocked(assessment: AnyRecord): boolean {
  const status = text(assessment.status, 30).toLowerCase();
  return status === "published" || status === "archived";
}

async function findAssessment(id: mongoose.Types.ObjectId): Promise<AnyRecord | null> {
  const assessment = await Assessment.findById(id).lean().exec();
  return assessment ? (assessment as unknown as AnyRecord) : null;
}

function normalizeOptions(value: unknown): SafeOption[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((entry, index) => {
    const fallback = String.fromCharCode(65 + index) as OptionId;
    const raw = typeof entry === "string"
      ? { text: entry }
      : isRecord(entry) ? entry : {};
    const candidate = text(raw.optionId ?? raw.id, 5).toUpperCase();
    const optionId = (["A", "B", "C", "D"].includes(candidate)
      ? candidate
      : fallback) as OptionId;
    return {
      optionId,
      text: text(raw.text ?? raw.value ?? raw.label, 1000),
    };
  });
}

function normalizeCorrectOption(value: unknown, options: SafeOption[]): string {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 0 && value < options.length) return options[value].optionId;
    if (value >= 1 && value <= options.length) return options[value - 1].optionId;
  }
  const raw = text(value, 1000).toUpperCase();
  if (["A", "B", "C", "D"].includes(raw)) return raw;
  const match = options.find(
    (option) => option.text.toLowerCase() === text(value, 1000).toLowerCase(),
  );
  return match?.optionId ?? "";
}

function normalizeLanguages(body: AnyRecord): string[] {
  const source: unknown[] = Array.isArray(body.languages)
    ? body.languages
    : [body.language];
  return [...new Set(source.map((item) => text(item, 100)).filter(Boolean))].slice(0, 10);
}

function normalizeExamples(value: unknown): SafeExample[] {
  let parsed: unknown = value;

  if (typeof parsed === "string") {
    const source = parsed.trim();
    if (!source) return [];
    try {
      parsed = JSON.parse(source) as unknown;
    } catch {
      const blocks = source
        .split(/\n\s*(?:---+|Example\s*\d+\s*:|Sample\s*\d+\s*:)\s*\n/i)
        .filter(Boolean);
      parsed = blocks.map((block) => {
        const inputMatch = block.match(
          /(?:^|\n)\s*(?:sample\s*)?input\s*:\s*([\s\S]*?)(?=\n\s*(?:sample\s*)?output\s*:|$)/i,
        );
        const outputMatch = block.match(
          /(?:^|\n)\s*(?:expected\s*)?output\s*:\s*([\s\S]*?)(?=\n\s*(?:explanation|input|sample\s*input)\s*:|$)/i,
        );
        const explanationMatch = block.match(/(?:^|\n)\s*explanation\s*:\s*([\s\S]*?)\s*$/i);
        return inputMatch && outputMatch
          ? {
              input: inputMatch[1].trim(),
              output: outputMatch[1].trim(),
              explanation: explanationMatch?.[1]?.trim() ?? "",
            }
          : null;
      }).filter(Boolean);
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(isRecord)
    .map((item) => {
      const input = text(item.input ?? item.sampleInput, 5000);
      const output = text(item.output ?? item.expectedOutput ?? item.sampleOutput, 5000);
      const explanation = text(item.explanation, 3000);
      return { input, output, ...(explanation ? { explanation } : {}) };
    })
    .filter((item) => item.input.length > 0 && item.output.length > 0)
    .slice(0, 50);
}

function serializeQuestion(rawValue: unknown): AnyRecord {
  const raw = isRecord(rawValue) ? rawValue : {};
  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  const options = rawOptions.filter(isRecord).map((option, index) => {
    const fallback = String.fromCharCode(65 + index);
    const optionId = text(option.optionId ?? option.id ?? fallback, 5).toUpperCase();
    return { id: optionId, optionId, text: text(option.text, 1000) };
  });
  const rawExamples = Array.isArray(raw.examples) ? raw.examples : [];
  const examples = rawExamples.filter(isRecord).map((example) => ({
    input: text(example.input ?? example.sampleInput, 5000),
    output: text(example.output ?? example.expectedOutput ?? example.sampleOutput, 5000),
    expectedOutput: text(example.expectedOutput ?? example.output ?? example.sampleOutput, 5000),
    ...(text(example.explanation, 3000)
      ? { explanation: text(example.explanation, 3000) }
      : {}),
  }));
  const correctOption = text(raw.correctOption ?? raw.correctAnswer, 10);
  const status = toUiStatus(raw.status, raw.isActive);
  const createdAt = raw.createdAt ? new Date(String(raw.createdAt)).toISOString() : undefined;
  const updatedAt = raw.updatedAt ? new Date(String(raw.updatedAt)).toISOString() : undefined;

  return {
    _id: String(raw._id ?? raw.id ?? ""),
    id: String(raw._id ?? raw.id ?? ""),
    questionId: text(raw.questionId, 150),
    assessmentId: String(raw.assessmentId ?? ""),
    domain: text(raw.domain, 200),
    domainKey: text(raw.domainKey, 200),
    section: text(raw.section, 30),
    type: text(raw.type, 30),
    question: text(raw.question, 10000),
    questionText: text(raw.question, 10000),
    description: text(raw.description, 15000),
    options,
    correctOption: correctOption || undefined,
    correctAnswer: correctOption || undefined,
    inputFormat: text(raw.inputFormat, 10000),
    outputFormat: text(raw.outputFormat, 10000),
    constraints: text(raw.constraints, 10000),
    examples,
    testCases: examples,
    starterCode: text(raw.starterCode, 30000),
    codeTemplate: text(raw.starterCode, 30000),
    languages: Array.isArray(raw.languages)
      ? raw.languages.filter((item): item is string => typeof item === "string")
      : [],
    language: Array.isArray(raw.languages) && typeof raw.languages[0] === "string"
      ? raw.languages[0]
      : undefined,
    topic: text(raw.topic, 150),
    difficulty: text(raw.difficulty, 20) || "medium",
    marks: Number(raw.marks) || 0,
    negativeMarks: Number(raw.negativeMarks) || 0,
    status,
    isActive: activeForStatus(status),
    order: Number(raw.order) || 0,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
    createdAt,
    updatedAt,
  };
}

async function getStats(assessmentId: mongoose.Types.ObjectId) {
  const docs = await Question.find({ assessmentId }).select("section type status isActive marks").lean().exec();
  const visible = docs.filter((doc) => String(doc.status) !== "archived");
  const mcq = visible.filter((doc) => String(doc.section ?? doc.type) === "mcq").length;
  const coding = visible.filter((doc) => String(doc.section ?? doc.type) === "coding").length;
  const activeMcq = visible.filter(
    (doc) => String(doc.section ?? doc.type) === "mcq" &&
      String(doc.status) === "published" && doc.isActive !== false,
  ).length;
  const activeCoding = visible.filter(
    (doc) => String(doc.section ?? doc.type) === "coding" &&
      String(doc.status) === "published" && doc.isActive !== false,
  ).length;

  return {
    mcq,
    coding,
    total: mcq + coding,
    activeMcq,
    activeCoding,
    activeTotal: activeMcq + activeCoding,
    requiredMcq: REQUIRED_MCQ,
    requiredCoding: REQUIRED_CODING,
    requiredTotal: REQUIRED_TOTAL,
    complete: mcq === REQUIRED_MCQ && coding === REQUIRED_CODING,
    activeComplete: activeMcq === REQUIRED_MCQ && activeCoding === REQUIRED_CODING,
    totalMarks: activeMcq * MCQ_MARKS + activeCoding * CODING_MARKS,
  };
}

function normalizeQuestionPayload(body: AnyRecord, assessment: AnyRecord):
  | { valid: true; value: AnyRecord }
  | { valid: false; message: string; code: string } {
  const typeRaw = text(body.type ?? body.questionType ?? body.section, 30).toLowerCase();
  const sectionRaw = text(body.section ?? body.type ?? body.questionType, 30).toLowerCase();

  if (!isQuestionType(typeRaw)) {
    return { valid: false, code: "INVALID_QUESTION_TYPE", message: "Question type must be mcq or coding." };
  }
  if (!isQuestionType(sectionRaw) || typeRaw !== sectionRaw) {
    return { valid: false, code: "QUESTION_SECTION_MISMATCH", message: "Question type and section must match." };
  }

  const question = text(body.question ?? body.questionText ?? body.text, 10000);
  if (question.length < 5) {
    return { valid: false, code: "QUESTION_TOO_SHORT", message: "Question/problem must contain at least 5 characters." };
  }

  const domain = text(assessment.domain, 200) || text(assessment.category, 200);
  const domainKey = normalizeQuestionDomain(
    text(assessment.domainKey, 200) || domain,
  );
  if (!domain || !domainKey) {
    return { valid: false, code: "ASSESSMENT_DOMAIN_MISSING", message: "The assessment needs a valid domain or category." };
  }

  const difficultyRaw = text(body.difficulty, 20).toLowerCase();
  const difficulty: QuestionDifficulty = isDifficulty(difficultyRaw) ? difficultyRaw : "medium";
  const description = text(body.description, 15000);
  const topic = text(body.topic, 150);

  if (typeRaw === "mcq") {
    const options = normalizeOptions(body.options);
    if (options.length !== 4 || options.some((option) => !option.text)) {
      return { valid: false, code: "MCQ_OPTIONS_REQUIRED", message: "MCQs require four non-empty options." };
    }
    const ids = options.map((option) => option.optionId);
    if (new Set(ids).size !== 4 || !["A", "B", "C", "D"].every((id) => ids.includes(id as OptionId))) {
      return { valid: false, code: "MCQ_OPTION_IDS_INVALID", message: "MCQ options must have unique A, B, C and D IDs." };
    }
    const correctOption = normalizeCorrectOption(
      body.correctOption ?? body.correctAnswer ?? body.answer,
      options,
    );
    if (!ids.includes(correctOption as OptionId)) {
      return { valid: false, code: "MCQ_CORRECT_OPTION_REQUIRED", message: "Select the correct MCQ answer." };
    }

    return {
      valid: true,
      value: {
        type: "mcq",
        section: "mcq",
        question,
        description,
        domain,
        domainKey,
        difficulty,
        marks: MCQ_MARKS,
        negativeMarks: 0,
        options,
        correctOption,
        inputFormat: "",
        outputFormat: "",
        constraints: "",
        examples: [],
        starterCode: "",
        languages: [],
        topic,
      },
    };
  }

  const inputFormat = text(body.inputFormat, 10000);
  const outputFormat = text(body.outputFormat, 10000);
  const constraints = text(body.constraints, 10000);
  const starterCode = text(body.starterCode ?? body.sampleCode ?? body.codeTemplate ?? body.solutionTemplate, 30000);
  const languages = normalizeLanguages(body);
  const examples = normalizeExamples(body.examples ?? body.testCases);

  if (!inputFormat) return { valid: false, code: "CODING_INPUT_FORMAT_REQUIRED", message: "Coding questions require an input format." };
  if (!outputFormat) return { valid: false, code: "CODING_OUTPUT_FORMAT_REQUIRED", message: "Coding questions require an output format." };
  if (!starterCode) return { valid: false, code: "CODING_STARTER_CODE_REQUIRED", message: "Add starter code for the coding problem." };
  if (!languages.length) return { valid: false, code: "CODING_LANGUAGE_REQUIRED", message: "Select at least one programming language." };
  if (!examples.length) return { valid: false, code: "CODING_EXAMPLES_REQUIRED", message: "Add at least one example with input and expected output." };

  return {
    valid: true,
    value: {
      type: "coding",
      section: "coding",
      question,
      description,
      domain,
      domainKey,
      difficulty,
      marks: CODING_MARKS,
      negativeMarks: 0,
      options: [],
      correctOption: undefined,
      inputFormat,
      outputFormat,
      constraints,
      examples,
      starterCode,
      languages,
      topic,
    },
  };
}

function jsonError(error: unknown, fallback: string, code: string): NextResponse {
  if (error instanceof mongoose.Error.ValidationError) {
    const message = Object.values(error.errors).map((item) => item.message).filter(Boolean).join(" ");
    return fail(message || "Question validation failed.", "QUESTION_VALIDATION_FAILED", 400);
  }
  if (isRecord(error) && error.code === 11000) {
    return fail("A question with this identifier already exists.", "QUESTION_DUPLICATE", 409);
  }
  console.error(`[admin/questions] ${code}`, error);
  return fail(fallback, code, 500);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await authenticateAdmin(request);
  if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);

  try {
    await connectDB();
    const params = request.nextUrl.searchParams;
    const assessmentRaw = params.get("assessmentId");
    let assessmentId: mongoose.Types.ObjectId | null = null;

    if (assessmentRaw) {
      assessmentId = toObjectId(assessmentRaw);
      if (!assessmentId) return fail("Invalid assessment ID.", "INVALID_ASSESSMENT_ID", 400);
      if (!(await findAssessment(assessmentId))) return fail("Assessment not found.", "ASSESSMENT_NOT_FOUND", 404);
    }

    const pageRaw = Number(params.get("page") || 1);
    const limitRaw = Number(params.get("limit") || 50);
    const page = Number.isSafeInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 10000) : 1;
    const limit = Number.isSafeInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 50;
    const filter: AnyRecord = {};

    if (assessmentId) filter.assessmentId = assessmentId;

    const type = text(params.get("type") ?? params.get("section"), 30).toLowerCase();
    if (isQuestionType(type)) {
      filter.type = type;
      filter.section = type;
    }

    const rawStatus = text(params.get("status"), 30).toLowerCase();
    if (UI_STATUSES.includes(rawStatus as UiStatus)) {
      const uiStatus = rawStatus as UiStatus;
      filter.status = toDbStatus(uiStatus);
      filter.isActive = activeForStatus(uiStatus);
    } else if (DB_STATUSES.includes(rawStatus as DbStatus)) {
      filter.status = rawStatus;
    }

    const difficulty = text(params.get("difficulty"), 20).toLowerCase();
    if (isDifficulty(difficulty)) filter.difficulty = difficulty;

    const activeParam = params.get("isActive");
    if (activeParam === "true" || activeParam === "false") filter.isActive = activeParam === "true";

    const search = text(params.get("search"), 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { question: regex },
        { questionId: regex },
        { domain: regex },
        { topic: regex },
      ];
    }

    const sortFieldRaw = text(params.get("sortField") ?? params.get("sort"), 30);
    const sortField = ["order", "createdAt", "updatedAt", "difficulty", "marks"].includes(sortFieldRaw)
      ? sortFieldRaw
      : "order";
    const direction = params.get("sortDirection") === "desc" || params.get("direction") === "desc" ? -1 : 1;

    const mongoFilter = filter as unknown as Parameters<typeof Question.find>[0];
    const [documents, total] = await Promise.all([
      Question.find(mongoFilter)
        .select("+correctOption")
        .sort({ [sortField]: direction, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      Question.countDocuments(mongoFilter).exec(),
    ]);

    const questions = documents.map((doc) => serializeQuestion(doc));
    const stats = assessmentId ? await getStats(assessmentId) : null;
    const totalPages = Math.ceil(total / limit);

    return ok({
      message: "Question bank loaded successfully.",
      questions,
      data: questions,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      stats,
    });
  } catch (error) {
    return jsonError(error, "Unable to load questions.", "QUESTIONS_FETCH_FAILED");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await authenticateAdmin(request);
  if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);

  try {
    await connectDB();
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body)) return fail("Request body must be valid JSON.", "INVALID_JSON", 400);

    const assessmentId = toObjectId(body.assessmentId);
    if (!assessmentId) return fail("A valid assessmentId is required.", "INVALID_ASSESSMENT_ID", 400);
    const assessment = await findAssessment(assessmentId);
    if (!assessment) return fail("Assessment not found.", "ASSESSMENT_NOT_FOUND", 404);
    if (assessmentIsLocked(assessment)) {
      return fail("Published or archived assessments are locked.", "ASSESSMENT_LOCKED", 409);
    }

    const requestedStatus = text(body.status, 30).toLowerCase();
    const status: UiStatus = UI_STATUSES.includes(requestedStatus as UiStatus)
      ? requestedStatus as UiStatus
      : "draft";

    const validation = normalizeQuestionPayload(body, assessment);
    if (!validation.valid) return fail(validation.message, validation.code, 400);

    const stats = await getStats(assessmentId);
    const value = validation.value;
    if (value.section === "mcq" && stats.mcq >= REQUIRED_MCQ) {
      return fail("This assessment already contains 30 MCQs.", "MCQ_LIMIT_REACHED", 409);
    }
    if (value.section === "coding" && stats.coding >= REQUIRED_CODING) {
      return fail("This assessment already contains 2 coding questions.", "CODING_LIMIT_REACHED", 409);
    }
    if (stats.total >= REQUIRED_TOTAL) {
      return fail("This assessment already contains 32 questions.", "TOTAL_QUESTION_LIMIT_REACHED", 409);
    }

    const created = await Question.create({
      questionId: generateQuestionId(),
      assessmentId,
      ...value,
      status: toDbStatus(status),
      isActive: activeForStatus(status),
      order: value.section === "mcq" ? stats.mcq : stats.coding,
      createdBy: toObjectId(admin.id) ?? undefined,
      updatedBy: toObjectId(admin.id) ?? undefined,
    });

    const question = serializeQuestion(created.toObject());
    return ok({
      message: "Question added successfully.",
      question,
      data: question,
      stats: await getStats(assessmentId),
    }, 201);
  } catch (error) {
    return jsonError(error, "Unable to create question.", "QUESTION_CREATE_FAILED");
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return updateQuestion(request, false);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return updateQuestion(request, true);
}

async function updateQuestion(request: NextRequest, statusOnlyAllowed: boolean): Promise<NextResponse> {
  const admin = await authenticateAdmin(request);
  if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);

  try {
    await connectDB();
    const parsed: unknown = await request.json().catch(() => null);
    if (!isRecord(parsed)) return fail("Request body must be valid JSON.", "INVALID_JSON", 400);

    const id = idFromRequest(request, parsed);
    if (!id) return fail("A valid question ID is required.", "INVALID_QUESTION_ID", 400);

    const existing = await Question.findById(id).select("+correctOption").exec();
    if (!existing) return fail("Question not found.", "QUESTION_NOT_FOUND", 404);

    const assessmentId = toObjectId(existing.assessmentId);
    if (!assessmentId) return fail("Question has an invalid assessment reference.", "INVALID_ASSESSMENT_ID", 409);
    const assessment = await findAssessment(assessmentId);
    if (!assessment) return fail("Parent assessment not found.", "ASSESSMENT_NOT_FOUND", 404);
    if (assessmentIsLocked(assessment)) {
      return fail("Published or archived assessments are locked; their questions cannot be changed.", "ASSESSMENT_LOCKED", 409);
    }

    // Status-only PATCH is deliberately handled separately so it cannot fail
    // content validation for legacy questions that predate the current editor.
    const requestedStatus = text(parsed.status, 30).toLowerCase();
    const statusOnly = statusOnlyAllowed &&
      Object.keys(parsed).every((key) => ["status", "isActive", "id", "_id", "questionId"].includes(key));

    if (statusOnly) {
      let nextStatus: UiStatus | null = null;
      if (UI_STATUSES.includes(requestedStatus as UiStatus)) {
        nextStatus = requestedStatus as UiStatus;
      } else if (typeof parsed.isActive === "boolean") {
        nextStatus = parsed.isActive ? "active" : "inactive";
      }
      if (!nextStatus) {
        return fail("Status must be draft, active or inactive.", "INVALID_QUESTION_STATUS", 400);
      }

      existing.status = toDbStatus(nextStatus) as typeof existing.status;
      existing.isActive = activeForStatus(nextStatus);
      existing.updatedBy = toObjectId(admin.id) ?? undefined;
      await existing.save();

      const question = serializeQuestion(existing.toObject());
      return ok({
        message: `Question status updated to ${nextStatus}.`,
        question,
        data: question,
        stats: await getStats(assessmentId),
      });
    }

    const old = existing.toObject() as unknown as AnyRecord;
    const merged: AnyRecord = { ...old, ...parsed, assessmentId: String(assessmentId) };
    merged.type = parsed.type ?? parsed.questionType ?? old.type;
    merged.section = parsed.section ?? parsed.type ?? old.section;
    merged.question = parsed.question ?? parsed.questionText ?? old.question;
    merged.options = parsed.options ?? old.options;
    merged.correctOption = parsed.correctOption ?? parsed.correctAnswer ?? old.correctOption;
    merged.inputFormat = parsed.inputFormat ?? old.inputFormat;
    merged.outputFormat = parsed.outputFormat ?? old.outputFormat;
    merged.constraints = parsed.constraints ?? old.constraints;
    merged.examples = parsed.examples ?? parsed.testCases ?? old.examples;
    merged.starterCode = parsed.starterCode ?? parsed.sampleCode ?? parsed.codeTemplate ?? old.starterCode;
    merged.languages = parsed.languages ?? (parsed.language !== undefined ? [parsed.language] : old.languages);

    const validation = normalizeQuestionPayload(merged, assessment);
    if (!validation.valid) return fail(validation.message, validation.code, 400);
    const value = validation.value;

    if (String(existing.section) !== String(value.section)) {
      const stats = await getStats(assessmentId);
      const count = value.section === "mcq" ? stats.mcq : stats.coding;
      const limit = value.section === "mcq" ? REQUIRED_MCQ : REQUIRED_CODING;
      if (count >= limit) {
        return fail(`The assessment already contains the maximum number of ${value.section} questions.`, "QUESTION_LIMIT_REACHED", 409);
      }
      existing.order = count;
    }

    existing.section = value.section as QuestionSection;
    existing.type = value.type as QuestionType;
    existing.question = String(value.question);
    existing.description = String(value.description);
    existing.domain = String(value.domain);
    existing.domainKey = String(value.domainKey);
    existing.options = value.options as typeof existing.options;
    existing.correctOption = value.correctOption as typeof existing.correctOption;
    existing.inputFormat = String(value.inputFormat);
    existing.outputFormat = String(value.outputFormat);
    existing.constraints = String(value.constraints);
    existing.examples = value.examples as typeof existing.examples;
    existing.starterCode = String(value.starterCode);
    existing.languages = value.languages as typeof existing.languages;
    existing.topic = String(value.topic);
    existing.difficulty = value.difficulty as QuestionDifficulty;
    existing.marks = Number(value.marks);
    existing.negativeMarks = Number(value.negativeMarks);
    existing.updatedBy = toObjectId(admin.id) ?? undefined;

    if (UI_STATUSES.includes(requestedStatus as UiStatus)) {
      const nextStatus = requestedStatus as UiStatus;
      existing.status = toDbStatus(nextStatus) as typeof existing.status;
      existing.isActive = activeForStatus(nextStatus);
    } else if (typeof parsed.isActive === "boolean") {
      existing.isActive = parsed.isActive;
      if (!parsed.isActive && String(existing.status) === "published") {
        existing.status = "archived" as typeof existing.status;
      } else if (parsed.isActive) {
        existing.status = "published" as typeof existing.status;
      }
    }

    await existing.save();
    const question = serializeQuestion(existing.toObject());
    return ok({
      message: "Question updated successfully.",
      question,
      data: question,
      stats: await getStats(assessmentId),
    });
  } catch (error) {
    return jsonError(error, "Unable to update question.", "QUESTION_UPDATE_FAILED");
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const admin = await authenticateAdmin(request);
  if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);

  // Permanent deletion is restricted to the explicitly designated Super Admin.
  const adminRecord = await AdminModel.findById(toObjectId(admin.id))
    .select("adminRole designation")
    .lean()
    .exec()
    .catch(() => null) as unknown as AnyRecord | null;

  const designation = text(adminRecord?.adminRole ?? adminRecord?.designation, 100)
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (designation !== "super admin") {
    return fail("Only Super Admin can permanently delete questions.", "FORBIDDEN", 403);
  }

  try {
    await connectDB();
    const id = idFromRequest(request);
    if (!id) return fail("A valid question ID is required. Use ?id=QUESTION_ID.", "INVALID_QUESTION_ID", 400);

    const existing = await Question.findById(id).exec();
    if (!existing) return fail("Question not found.", "QUESTION_NOT_FOUND", 404);

    const assessmentId = toObjectId(existing.assessmentId);
    if (assessmentId) {
      const assessment = await findAssessment(assessmentId);
      if (assessment && assessmentIsLocked(assessment)) {
        return fail("Questions belonging to a published or archived assessment cannot be permanently deleted.", "ASSESSMENT_LOCKED", 409);
      }
    }

    const result = await Question.deleteOne({ _id: id }).exec();
    if (result.deletedCount !== 1) {
      return fail("Question changed before deletion. Refresh and retry.", "QUESTION_STATE_CHANGED", 409);
    }

    return ok({
      message: "Question deleted successfully.",
      deleted: true,
      questionId: String(id),
      stats: assessmentId ? await getStats(assessmentId) : null,
    });
  } catch (error) {
    return jsonError(error, "Unable to delete question.", "QUESTION_DELETE_FAILED");
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
