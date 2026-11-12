import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/db";
import AdminModel from "@/models/Admin";
import Assessment from "@/models/Assessment";
import Question, {
  generateQuestionId,
  normalizeQuestionDomain,
  normalizeQuestionSection,
  type QuestionSection,
  type QuestionStatus,
} from "@/models/Question";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  verifyAuthToken,
  type AuthUser,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const REQUIRED_PER_SECTION = 30;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;
const MAX_QUESTION_LENGTH = 10000;
const MAX_OPTION_LENGTH = 1000;

type AnyRecord = Record<string, unknown>;
type MongoFilter = Record<string, any>;
type UiStatus = "draft" | "active" | "inactive";
type DbStatus = "draft" | "published" | "archived";
type OptionId = "A" | "B" | "C" | "D";
type AdminPermission = "read" | "manage" | "delete";

type SafeOption = {
  optionId: OptionId;
  text: string;
};

type AdminContext = AuthUser & {
  adminRole?: string;
  designation?: string;
  persistedRole?: string;
};

type ValidationResult =
  | { valid: true; value: AnyRecord }
  | { valid: false; message: string; code: string };

const SECTIONS: QuestionSection[] = ["easy", "medium", "hard"];
const UI_STATUSES: UiStatus[] = ["draft", "active", "inactive"];
const DB_STATUSES: DbStatus[] = ["draft", "published", "archived"];
const OPTION_IDS: OptionId[] = ["A", "B", "C", "D"];

function respond(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      Vary: "Cookie",
    },
  });
}

function ok(data: Record<string, unknown>, status = 200): NextResponse {
  return respond({ success: true, ...data }, status);
}

function verifyMutationOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return true;

  try {
    const expected = request.nextUrl.origin;
    if (origin && new URL(origin).origin !== expected) return false;
    if (!origin && referer && new URL(referer).origin !== expected) return false;
    return true;
  } catch {
    return false;
  }
}

async function readJsonBody(
  request: NextRequest,
  maximumBytes = 256_000,
): Promise<AnyRecord | null> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error("REQUEST_BODY_TOO_LARGE");
  }

  const raw = await request.text();
  if (!raw || new TextEncoder().encode(raw).byteLength > maximumBytes) return null;

  const parsed: unknown = JSON.parse(raw);
  return isRecord(parsed) ? parsed : null;
}

function fail(message: string, code: string, status: number): NextResponse {
  return respond({ success: false, message, code }, status);
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max = 10000): string {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().slice(0, max)
    : "";
}

function normalizedRole(value: unknown): string {
  return text(value, 100).toLowerCase().replace(/[^a-z]/g, "");
}

function toObjectId(value: unknown): mongoose.Types.ObjectId | null {
  if (value instanceof mongoose.Types.ObjectId) return value;
  const valueText = text(value, 100);
  if (!valueText || !mongoose.isValidObjectId(valueText)) return null;
  return new mongoose.Types.ObjectId(valueText);
}

function isSection(value: unknown): value is QuestionSection {
  return SECTIONS.includes(value as QuestionSection);
}

function isValidStatus(value: unknown): value is UiStatus {
  return UI_STATUSES.includes(value as UiStatus);
}

function toUiStatus(value: unknown, isActive?: unknown): UiStatus {
  const status = text(value, 30).toLowerCase();
  if (status === "draft") return "draft";
  if (status === "inactive" || status === "archived") return "inactive";
  if (status === "active" || status === "published") {
    return isActive === false ? "inactive" : "active";
  }
  return isActive === false ? "inactive" : "draft";
}

function toDbStatus(status: UiStatus): DbStatus {
  if (status === "active") return "published";
  if (status === "inactive") return "archived";
  return "draft";
}

function idFromRequest(
  request: NextRequest,
  body?: AnyRecord,
): mongoose.Types.ObjectId | null {
  const queryId =
    request.nextUrl.searchParams.get("id") ??
    request.nextUrl.searchParams.get("questionId");

  return toObjectId(
    queryId || body?.id || body?._id || body?.questionId,
  );
}

async function authenticateAdmin(
  request: NextRequest,
): Promise<AdminContext | null> {
  try {
    const dedicatedToken = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
    const legacyToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const token = dedicatedToken || legacyToken;

    if (!token) return null;

    const user = await verifyAuthToken(token);
    if (!user || user.role !== "admin" || !user.id) return null;

    if (dedicatedToken && user.sessionType !== "admin") return null;
    if (
      !dedicatedToken &&
      user.sessionType &&
      !["admin", "legacy"].includes(user.sessionType)
    ) {
      return null;
    }

    await connectDB();

    const adminId = toObjectId(user.id);
    if (!adminId) return null;

    const admin = await AdminModel.findById(adminId)
      .select("_id role isActive adminRole designation isEmailVerified security")
      .lean()
      .exec() as unknown as AnyRecord | null;

    if (!admin || admin.isActive === false) return null;
    if (admin.isEmailVerified === false) return null;

    const security = isRecord(admin.security) ? admin.security : {};
    if (security.accountLocked === true) return null;
    if (security.lockedUntil) {
      const lockedUntil = new Date(String(security.lockedUntil));
      if (!Number.isNaN(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now()) {
        return null;
      }
    }

    const persistedRoles = [
      admin.adminRole,
      admin.designation,
      admin.role,
    ].map(normalizedRole).filter(Boolean);

    const isSuperAdmin = persistedRoles.includes("superadmin");
    const isAssessmentManager = persistedRoles.includes("assessmentmanager");
    const isAdmin = persistedRoles.includes("admin");

    const effectiveRole = isSuperAdmin
      ? "Super Admin"
      : isAssessmentManager
        ? "Assessment Manager"
        : isAdmin
          ? "Admin"
          : text(admin.adminRole ?? admin.designation ?? admin.role, 100) || "Admin";

    return {
      ...user,
      adminRole: effectiveRole,
      designation: text(admin.designation, 100),
      persistedRole: text(admin.role, 100),
    } as AdminContext;
  } catch (error) {
    console.error("[admin/questions] authentication error", error);
    return null;
  }
}

function hasPermission(admin: AdminContext, permission: AdminPermission): boolean {
  const assignedRoles = [admin.adminRole, admin.designation]
    .map(normalizedRole)
    .filter(Boolean);
  const roles = (assignedRoles.length > 0
    ? assignedRoles
    : [admin.persistedRole].map(normalizedRole));

  const isSuperAdmin = roles.includes("superadmin");
  const isAssessmentManager = roles.includes("assessmentmanager");
  const isAdmin = roles.includes("admin");

  if (permission === "read") {
    return isSuperAdmin || isAssessmentManager || isAdmin ||
      roles.includes("hr") || roles.includes("support");
  }

  if (permission === "manage") {
    return isSuperAdmin || isAssessmentManager || isAdmin;
  }

  return isSuperAdmin;
}

function assessmentDomain(assessment: AnyRecord): string {
  return text(assessment.domain, 200) || text(assessment.category, 200);
}

function assessmentDomainKey(assessment: AnyRecord): string {
  return normalizeQuestionDomain(
    text(assessment.domainKey, 200) || assessmentDomain(assessment),
  );
}

function assessmentIsLocked(assessment: AnyRecord): boolean {
  const status = text(assessment.status, 30).toLowerCase();
  return status === "published" || status === "archived";
}

async function findAssessment(
  id: mongoose.Types.ObjectId,
): Promise<AnyRecord | null> {
  const assessment = await Assessment.findById(id).lean().exec();
  return assessment ? assessment as unknown as AnyRecord : null;
}

function normalizeOptions(value: unknown): SafeOption[] {
  if (!Array.isArray(value) || value.length !== 4) return [];

  return value.map((entry, index) => {
    const fallback = OPTION_IDS[index];
    const raw = typeof entry === "string"
      ? { text: entry }
      : isRecord(entry)
        ? entry
        : {};

    const candidate = text(raw.optionId ?? raw.id, 5).toUpperCase();
    const optionId = (OPTION_IDS.includes(candidate as OptionId)
      ? candidate
      : fallback) as OptionId;

    return {
      optionId,
      text: text(raw.text ?? raw.value ?? raw.label, MAX_OPTION_LENGTH),
    };
  });
}

function normalizeCorrectOption(value: unknown, options: SafeOption[]): string {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 0 && value <= 3) return OPTION_IDS[value];
    return "";
  }

  const raw = text(value, MAX_OPTION_LENGTH).toUpperCase();
  if (OPTION_IDS.includes(raw as OptionId)) return raw;

  const match = options.find(
    (option) => option.text.toLowerCase() === text(value, MAX_OPTION_LENGTH).toLowerCase(),
  );
  return match?.optionId ?? "";
}

function normalizeQuestionPayload(
  body: AnyRecord,
  assessment: AnyRecord,
): ValidationResult {
  const suppliedType = text(body.type ?? body.questionType, 30).toLowerCase();
  if (suppliedType && suppliedType !== "mcq") {
    return {
      valid: false,
      code: "INVALID_QUESTION_TYPE",
      message: "Only MCQ questions are supported.",
    };
  }

  const sectionRaw = text(body.section ?? body.difficulty, 30).toLowerCase();
  if (!isSection(sectionRaw)) {
    return {
      valid: false,
      code: "INVALID_QUESTION_SECTION",
      message: "Select Easy, Medium or Hard difficulty.",
    };
  }

  const difficultyRaw = text(body.difficulty ?? body.section, 30).toLowerCase();
  if (!isSection(difficultyRaw) || difficultyRaw !== sectionRaw) {
    return {
      valid: false,
      code: "SECTION_DIFFICULTY_MISMATCH",
      message: "Question section and difficulty must match.",
    };
  }

  const question = text(
    body.question ?? body.questionText ?? body.text,
    MAX_QUESTION_LENGTH,
  );

  if (question.length < 5) {
    return {
      valid: false,
      code: "QUESTION_TOO_SHORT",
      message: "Question must contain at least five characters.",
    };
  }

  const domain = assessmentDomain(assessment);
  const domainKey = assessmentDomainKey(assessment);
  if (!domain || domainKey.length < 2) {
    return {
      valid: false,
      code: "ASSESSMENT_DOMAIN_MISSING",
      message: "The assessment requires a valid domain.",
    };
  }

  const options = normalizeOptions(body.options);
  if (options.length !== 4 || options.some((option) => !option.text)) {
    return {
      valid: false,
      code: "MCQ_OPTIONS_REQUIRED",
      message: "Every MCQ must contain exactly four non-empty options.",
    };
  }

  const optionIds = options.map((option) => option.optionId);
  const normalizedOptionTexts = options.map((option) =>
    option.text.normalize("NFKC").trim().toLocaleLowerCase(),
  );

  if (
    new Set(optionIds).size !== 4 ||
    !OPTION_IDS.every((id) => optionIds.includes(id))
  ) {
    return {
      valid: false,
      code: "MCQ_OPTION_IDS_INVALID",
      message: "MCQ options must have unique A, B, C and D identifiers.",
    };
  }

  if (new Set(normalizedOptionTexts).size !== 4) {
    return {
      valid: false,
      code: "MCQ_OPTIONS_DUPLICATE",
      message: "All four answer options must be different.",
    };
  }

  const correctOption = normalizeCorrectOption(
    body.correctOption ?? body.correctAnswer ?? body.answer,
    options,
  );

  if (!optionIds.includes(correctOption as OptionId)) {
    return {
      valid: false,
      code: "MCQ_CORRECT_OPTION_REQUIRED",
      message: "Select one valid correct answer. Numeric answers use zero-based indexes 0–3.",
    };
  }

  return {
    valid: true,
    value: {
      type: "mcq",
      section: sectionRaw,
      difficulty: sectionRaw,
      question,
      description: text(body.description, 15000),
      domain,
      domainKey,
      topic: text(body.topic, 150),
      marks: 1,
      negativeMarks: 0,
      options,
      correctOption,
    },
  };
}

function validIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function serializeQuestion(rawValue: unknown, includeAnswer = true): AnyRecord {
  const raw = isRecord(rawValue) ? rawValue : {};
  const rawOptions = Array.isArray(raw.options) ? raw.options : [];

  const options = rawOptions.filter(isRecord).map((option, index) => {
    const fallback = OPTION_IDS[index] ?? "A";
    const optionId = text(option.optionId ?? option.id ?? fallback, 5).toUpperCase();
    return {
      id: optionId,
      optionId,
      text: text(option.text, MAX_OPTION_LENGTH),
    };
  });

  const status = toUiStatus(raw.status, raw.isActive);
  const correctOption = text(raw.correctOption, 5).toUpperCase();

  return {
    _id: String(raw._id ?? ""),
    id: String(raw._id ?? ""),
    questionId: text(raw.questionId, 150),
    assessmentId: String(raw.assessmentId ?? ""),
    domain: text(raw.domain, 200),
    domainKey: text(raw.domainKey, 200),
    section: text(raw.section, 30),
    type: "mcq",
    question: text(raw.question, MAX_QUESTION_LENGTH),
    questionText: text(raw.question, MAX_QUESTION_LENGTH),
    description: text(raw.description, 15000),
    options,
    ...(includeAnswer && correctOption
      ? { correctOption, correctAnswer: correctOption }
      : {}),
    topic: text(raw.topic, 150),
    difficulty: text(raw.difficulty, 20),
    marks: 1,
    negativeMarks: 0,
    status,
    isActive: status === "active",
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : 0,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
    createdAt: validIsoDate(raw.createdAt),
    updatedAt: validIsoDate(raw.updatedAt),
  };
}

async function getStats(assessmentId: mongoose.Types.ObjectId): Promise<AnyRecord> {
  const documents = await Question.find({ assessmentId })
    .select("section difficulty status isActive marks")
    .lean()
    .exec();

  const stats: Record<
    QuestionSection,
    { total: number; active: number; draft: number; archived: number }
  > = {
    easy: { total: 0, active: 0, draft: 0, archived: 0 },
    medium: { total: 0, active: 0, draft: 0, archived: 0 },
    hard: { total: 0, active: 0, draft: 0, archived: 0 },
  };

  for (const document of documents) {
    const section = String(document.section ?? document.difficulty ?? "") as QuestionSection;
    if (!SECTIONS.includes(section)) continue;

    const status = String(document.status ?? "draft");
    if (status === "archived") {
      stats[section].archived += 1;
      continue;
    }

    stats[section].total += 1;
    if (status === "published" && document.isActive !== false) {
      stats[section].active += 1;
    }
    if (status === "draft") stats[section].draft += 1;
  }

  const total = Object.values(stats).reduce((sum, section) => sum + section.total, 0);
  const activeTotal = Object.values(stats).reduce((sum, section) => sum + section.active, 0);
  const complete = SECTIONS.every((section) => stats[section].total === REQUIRED_PER_SECTION);
  const activeComplete = SECTIONS.every((section) => stats[section].active === REQUIRED_PER_SECTION);

  return {
    easy: stats.easy,
    medium: stats.medium,
    hard: stats.hard,
    total,
    activeTotal,
    draftTotal: stats.easy.draft + stats.medium.draft + stats.hard.draft,
    archivedTotal: stats.easy.archived + stats.medium.archived + stats.hard.archived,
    requiredPerSection: REQUIRED_PER_SECTION,
    requiredTotal: 90,
    totalMarks: activeTotal,
    passingPercentage: 40,
    passingMarks: 36,
    complete,
    activeComplete,
    readiness: activeComplete ? "ready" : "incomplete",
  };
}

async function countSectionQuestions(
  assessmentId: mongoose.Types.ObjectId,
  section: QuestionSection,
  excludeId?: mongoose.Types.ObjectId,
): Promise<number> {
  const filter: AnyRecord = {
    assessmentId,
    section,
    status: { $ne: "archived" },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  return Question.countDocuments(
    filter as MongoFilter,
  ).exec();
}

function jsonError(error: unknown, fallback: string, code: string): NextResponse {
  if (error instanceof Error && error.message === "REQUEST_BODY_TOO_LARGE") {
    return fail("Request body exceeds the allowed size.", "REQUEST_BODY_TOO_LARGE", 413);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const message = Object.values(error.errors)
      .map((item) => item.message)
      .filter(Boolean)
      .join(" ");
    return fail(message || "Question validation failed.", "QUESTION_VALIDATION_FAILED", 400);
  }

  if (error instanceof mongoose.Error.CastError) {
    return fail(
      "One or more supplied database identifiers are invalid.",
      "INVALID_DATABASE_VALUE",
      400,
    );
  }

  if (isRecord(error) && error.code === 11000) {
    return fail(
      "A question with this identifier already exists.",
      "QUESTION_DUPLICATE",
      409,
    );
  }

  if (error instanceof SyntaxError) {
    return fail("Invalid request body.", "INVALID_JSON", 400);
  }

  console.error(`[admin/questions] ${code}`, error);
  return fail(fallback, code, 500);
}

function permissionDenied(permission: AdminPermission): NextResponse {
  const message = permission === "delete"
    ? "Only Super Admin can permanently delete questions."
    : "Your administrator role does not have permission to modify the question bank.";
  return fail(message, "FORBIDDEN", 403);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await authenticateAdmin(request);
  if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);
  if (!hasPermission(admin, "read")) return permissionDenied("read");

  try {
    await connectDB();

    const params = request.nextUrl.searchParams;
    const assessmentRaw = params.get("assessmentId");
    let assessmentId: mongoose.Types.ObjectId | null = null;

    if (assessmentRaw) {
      assessmentId = toObjectId(assessmentRaw);
      if (!assessmentId) {
        return fail("Invalid assessment ID.", "INVALID_ASSESSMENT_ID", 400);
      }
      if (!(await findAssessment(assessmentId))) {
        return fail("Assessment not found.", "ASSESSMENT_NOT_FOUND", 404);
      }
    }

    const pageRaw = Number(params.get("page") || 1);
    const limitRaw = Number(params.get("limit") || 50);
    const page = Number.isSafeInteger(pageRaw) && pageRaw > 0
      ? Math.min(pageRaw, 10000)
      : 1;
    const limit = Number.isSafeInteger(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIMIT)
      : 50;

    const filter: AnyRecord = {};
    if (assessmentId) filter.assessmentId = assessmentId;

    const sectionRaw = text(params.get("section") ?? params.get("difficulty"), 30).toLowerCase();
    if (sectionRaw) {
      const section = normalizeQuestionSection(sectionRaw);
      if (!section) {
        return fail("Section must be easy, medium or hard.", "INVALID_QUESTION_SECTION", 400);
      }
      filter.section = section;
      filter.difficulty = section;
    }

    const type = text(params.get("type"), 30).toLowerCase();
    if (type && type !== "mcq") {
      return fail("Only MCQ questions are supported.", "INVALID_QUESTION_TYPE", 400);
    }

    const rawStatus = text(params.get("status"), 30).toLowerCase();
    if (rawStatus) {
      if (UI_STATUSES.includes(rawStatus as UiStatus)) {
        filter.status = toDbStatus(rawStatus as UiStatus);
      } else if (DB_STATUSES.includes(rawStatus as DbStatus)) {
        filter.status = rawStatus;
      } else {
        return fail("Invalid question status.", "INVALID_QUESTION_STATUS", 400);
      }
    }

    const activeParam = params.get("isActive");
    if (activeParam === "true" || activeParam === "false") {
      filter.isActive = activeParam === "true";
    }

    const search = text(params.get("search"), MAX_SEARCH_LENGTH);
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
    const sortField = ["order", "createdAt", "updatedAt", "difficulty", "marks"]
      .includes(sortFieldRaw)
      ? sortFieldRaw
      : "order";
    const direction =
      params.get("sortDirection") === "desc" || params.get("direction") === "desc"
        ? -1
        : 1;

    const mongoFilter = filter as MongoFilter;
    const [documents, total, stats] = await Promise.all([
      Question.find(mongoFilter)
        .select("+correctOption")
        .sort({ [sortField]: direction, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      Question.countDocuments(mongoFilter).exec(),
      assessmentId ? getStats(assessmentId) : Promise.resolve(null),
    ]);

    const canViewAnswerKey = hasPermission(admin, "manage");
    const questions = documents.map((document) =>
      serializeQuestion(document, canViewAnswerKey),
    );
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
  if (!hasPermission(admin, "manage")) return permissionDenied("manage");
  if (!verifyMutationOrigin(request)) {
    return fail("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    await connectDB();

    const body = await readJsonBody(request);
    if (!body) {
      return fail("Request body must be a valid JSON object.", "INVALID_JSON", 400);
    }

    const assessmentId = toObjectId(body.assessmentId);
    if (!assessmentId) {
      return fail("A valid assessmentId is required.", "INVALID_ASSESSMENT_ID", 400);
    }

    const assessment = await findAssessment(assessmentId);
    if (!assessment) return fail("Assessment not found.", "ASSESSMENT_NOT_FOUND", 404);
    if (assessmentIsLocked(assessment)) {
      return fail("Published or archived assessments are locked.", "ASSESSMENT_LOCKED", 409);
    }

    const validation = normalizeQuestionPayload(body, assessment);
    if (!validation.valid) {
      return fail(validation.message, validation.code, 400);
    }

    const value = validation.value;
    const section = value.section as QuestionSection;
    const count = await countSectionQuestions(assessmentId, section);
    if (count >= REQUIRED_PER_SECTION) {
      return fail(
        `The ${section} section already contains 30 questions.`,
        "SECTION_LIMIT_REACHED",
        409,
      );
    }

    const requestedStatus = text(body.status, 30).toLowerCase();
    if (requestedStatus && !isValidStatus(requestedStatus)) {
      return fail(
        "Status must be draft, active or inactive.",
        "INVALID_QUESTION_STATUS",
        400,
      );
    }
    const status: UiStatus = requestedStatus ? requestedStatus as UiStatus : "draft";
    const created = await Question.create({
      questionId: generateQuestionId(),
      assessmentId,
      ...value,
      status: toDbStatus(status),
      isActive: status === "active",
      order: count,
      createdBy: toObjectId(admin.id) ?? undefined,
      updatedBy: toObjectId(admin.id) ?? undefined,
    });

    const question = serializeQuestion(created.toObject());
    return ok({
      message: "MCQ question created successfully.",
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

async function updateQuestion(
  request: NextRequest,
  statusOnlyAllowed: boolean,
): Promise<NextResponse> {
  const admin = await authenticateAdmin(request);
  if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);
  if (!hasPermission(admin, "manage")) return permissionDenied("manage");
  if (!verifyMutationOrigin(request)) {
    return fail("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    await connectDB();

    const parsed = await readJsonBody(request);
    if (!parsed) {
      return fail("Request body must be a valid JSON object.", "INVALID_JSON", 400);
    }

    const id = idFromRequest(request, parsed);
    if (!id) return fail("A valid question ID is required.", "INVALID_QUESTION_ID", 400);

    const existing = await Question.findById(id).select("+correctOption").exec();
    if (!existing) return fail("Question not found.", "QUESTION_NOT_FOUND", 404);

    const assessmentId = toObjectId(existing.assessmentId);
    if (!assessmentId) {
      return fail("Question has an invalid assessment reference.", "INVALID_ASSESSMENT_ID", 409);
    }

    const assessment = await findAssessment(assessmentId);
    if (!assessment) return fail("Parent assessment not found.", "ASSESSMENT_NOT_FOUND", 404);
    if (assessmentIsLocked(assessment)) {
      return fail(
        "Published or archived assessments are locked. Create a new assessment version to make changes.",
        "ASSESSMENT_LOCKED",
        409,
      );
    }

    const allowedStatusKeys = ["status", "isActive", "id", "_id", "questionId"];
    const statusOnly = statusOnlyAllowed &&
      Object.keys(parsed).every((key) => allowedStatusKeys.includes(key));

    const requestedStatus = text(parsed.status, 30).toLowerCase();

    if (requestedStatus && !isValidStatus(requestedStatus)) {
      return fail(
        "Status must be draft, active or inactive.",
        "INVALID_QUESTION_STATUS",
        400,
      );
    }

    if (statusOnly) {
      let nextStatus: UiStatus | null = null;
      if (isValidStatus(requestedStatus)) {
        nextStatus = requestedStatus;
      } else if (typeof parsed.isActive === "boolean") {
        nextStatus = parsed.isActive ? "active" : "inactive";
      }

      if (!nextStatus) {
        return fail("Status must be draft, active or inactive.", "INVALID_QUESTION_STATUS", 400);
      }

      const nextDbStatus = toDbStatus(nextStatus);
      if (nextDbStatus === "published") {
        const count = await countSectionQuestions(
          assessmentId,
          existing.section as QuestionSection,
          existing._id,
        );
        if (count >= REQUIRED_PER_SECTION) {
          return fail(
            "This difficulty section already has 30 questions.",
            "SECTION_LIMIT_REACHED",
            409,
          );
        }
      }

      existing.status = nextDbStatus as QuestionStatus;
      existing.isActive = nextStatus === "active";
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
    const merged: AnyRecord = {
      ...old,
      ...parsed,
      assessmentId: String(assessmentId),
      section: parsed.section ?? parsed.difficulty ?? old.section,
      difficulty: parsed.difficulty ?? parsed.section ?? old.difficulty,
      type: parsed.type ?? old.type,
      question: parsed.question ?? parsed.questionText ?? old.question,
      options: parsed.options ?? old.options,
      correctOption: parsed.correctOption ?? parsed.correctAnswer ?? old.correctOption,
      description: parsed.description ?? old.description,
      topic: parsed.topic ?? old.topic,
    };

    const validation = normalizeQuestionPayload(merged, assessment);
    if (!validation.valid) {
      return fail(validation.message, validation.code, 400);
    }

    const value = validation.value;
    const nextSection = value.section as QuestionSection;
    const currentSection = existing.section as QuestionSection;
    const sectionChanged = nextSection !== currentSection;

    if (sectionChanged) {
      const count = await countSectionQuestions(assessmentId, nextSection, existing._id);
      if (count >= REQUIRED_PER_SECTION) {
        return fail(
          `The ${nextSection} section already contains 30 questions.`,
          "SECTION_LIMIT_REACHED",
          409,
        );
      }
      existing.order = count;
    }

    existing.section = nextSection;
    existing.difficulty = nextSection;
    existing.type = "mcq";
    existing.question = String(value.question);
    existing.description = String(value.description);
    existing.domain = String(value.domain);
    existing.domainKey = String(value.domainKey);
    existing.options = value.options as typeof existing.options;
    existing.correctOption = String(value.correctOption) as typeof existing.correctOption;
    existing.topic = String(value.topic);
    existing.marks = 1;
    existing.negativeMarks = 0;
    existing.updatedBy = toObjectId(admin.id) ?? undefined;

    if (isValidStatus(requestedStatus)) {
      existing.status = toDbStatus(requestedStatus) as QuestionStatus;
      existing.isActive = requestedStatus === "active";
    } else if (typeof parsed.isActive === "boolean") {
      existing.isActive = parsed.isActive;
      existing.status = parsed.isActive
        ? "published" as QuestionStatus
        : "archived" as QuestionStatus;
    }

    if (existing.status === "published" && existing.isActive !== false) {
      const count = await countSectionQuestions(assessmentId, nextSection, existing._id);
      if (count >= REQUIRED_PER_SECTION) {
        return fail(
          `The ${nextSection} section already contains 30 questions.`,
          "SECTION_LIMIT_REACHED",
          409,
        );
      }
    }

    await existing.save();

    const question = serializeQuestion(existing.toObject());
    return ok({
      message: "MCQ question updated successfully.",
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
  if (!hasPermission(admin, "delete")) return permissionDenied("delete");
  if (!verifyMutationOrigin(request)) {
    return fail("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    await connectDB();

    const id = idFromRequest(request);
    if (!id) {
      return fail(
        "A valid question ID is required. Use ?id=QUESTION_ID.",
        "INVALID_QUESTION_ID",
        400,
      );
    }

    const existing = await Question.findById(id).exec();
    if (!existing) return fail("Question not found.", "QUESTION_NOT_FOUND", 404);

    const assessmentId = toObjectId(existing.assessmentId);
    if (!assessmentId) {
      return fail("Question has an invalid assessment reference.", "INVALID_ASSESSMENT_ID", 409);
    }

    const assessment = await findAssessment(assessmentId);
    if (!assessment) return fail("Parent assessment not found.", "ASSESSMENT_NOT_FOUND", 404);
    if (assessmentIsLocked(assessment)) {
      return fail(
        "Questions belonging to a published or archived assessment cannot be deleted.",
        "ASSESSMENT_LOCKED",
        409,
      );
    }

    const result = await Question.deleteOne({
      _id: id,
      assessmentId,
      status: existing.status,
      updatedAt: existing.updatedAt,
    }).exec();

    if (result.deletedCount !== 1) {
      return fail(
        "Question changed before deletion. Refresh and retry.",
        "QUESTION_STATE_CHANGED",
        409,
      );
    }

    return ok({
      message: "Question deleted successfully.",
      deleted: true,
      questionId: String(id),
      stats: await getStats(assessmentId),
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
