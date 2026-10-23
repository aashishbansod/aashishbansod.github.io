import { NextRequest, NextResponse } from "next/server";

import mongoose from "mongoose";

import connectDB from "@/lib/db";

import AdminModel from "@/models/Admin";

import Assessment, {

  ASSESSMENT_CONFIG,

  generateAssessmentId,

  normalizeAssessmentDomain,

  type IAssessmentSection,

} from "@/models/Assessment";

import Question from "@/models/Question";

import {

  ADMIN_AUTH_COOKIE_NAME,

  AUTH_COOKIE_NAME,

  verifyAuthToken,

  type AuthUser,

} from "@/lib/auth";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const revalidate = 0;

const DEFAULT_LIMIT = 20;

const MAX_LIMIT = 100;

const MAX_PAGE = 10_000;

const MAX_SEARCH_LENGTH = 120;

const MAX_TITLE_LENGTH = 160;

const MAX_DOMAIN_LENGTH = 120;

const MAX_DESCRIPTION_LENGTH = 2_000;

type AssessmentStatus = "draft" | "published" | "archived";

type AnyRecord = Record<string, any>;

type QuestionStats = { mcq: number; coding: number; total: number };

function response(data: unknown, status = 200): NextResponse {

  return NextResponse.json(data, {

    status,

    headers: {

      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",

      Pragma: "no-cache",

      Expires: "0",

      Vary: "Cookie",

      "X-Content-Type-Options": "nosniff",

      "X-Frame-Options": "DENY",

      "Referrer-Policy": "same-origin",

    },

  });

}

function success(data: AnyRecord, status = 200) {

  return response({ success: true, ...data }, status);

}

function failure(message: string, code: string, status: number, extra: AnyRecord = {}) {

  return response({ success: false, message, code, error: { code, message }, ...extra }, status);

}

function str(value: unknown): string {

  if (typeof value === "string") return value.trim();

  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  return "";

}

function positiveInt(value: unknown, fallback: number): number {

  const n = typeof value === "number" ? value : Number(value);

  return Number.isSafeInteger(n) && n > 0 ? n : fallback;

}

function validStatus(value: unknown): value is AssessmentStatus {

  return value === "draft" || value === "published" || value === "archived";

}

function objectId(value: unknown): mongoose.Types.ObjectId | null {

  const valueString = str(value);

  return valueString && mongoose.isValidObjectId(valueString)

    ? new mongoose.Types.ObjectId(valueString)

    : null;

}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getAdmin(request: NextRequest): Promise<AuthUser | null> {

  try {

    const dedicated = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;

    const legacy = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    const token = dedicated || legacy;

    if (!token) return null;

    const user = await verifyAuthToken(token);
    if (!user || user.role !== "admin" || !str(user.id)) return null;
    if (dedicated && user.sessionType !== "admin") return null;
    if (!dedicated && user.sessionType && !["admin", "legacy"].includes(user.sessionType)) return null;

    await connectDB();
    const adminId = objectId(user.id);
    if (!adminId) return null;

    const adminRecord = await AdminModel.findById(adminId)
      .select("_id role isActive adminRole designation")
      .lean()
      .exec();

    if (!adminRecord || adminRecord.isActive === false) return null;

    // Resolve privileges from the persisted admin record, never from client input.
    // Different Admin model versions may store the display role in `role`,
    // `adminRole`, or `designation`, so inspect all supported fields.
    const roleRecord = adminRecord as unknown as AnyRecord;
    const persistedRoles = [roleRecord.adminRole, roleRecord.designation, roleRecord.role]
      .map((value) => str(value))
      .filter(Boolean);
    const hasSuperAdminRole = persistedRoles.some((value) => {
      const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
      return normalized === "superadmin";
    });
    const adminRole = hasSuperAdminRole
      ? "Super Admin"
      : persistedRoles[0] || "Admin";

    return { ...user, adminRole } as AuthUser;
  } catch (error) {

    console.error("[ADMIN ASSESSMENTS AUTH]", error);

    return null;

  }

}

async function requireAdmin(request: NextRequest): Promise<AuthUser | NextResponse> {

  const admin = await getAdmin(request);

  return admin ?? failure("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);

}

function isResponse(value: AuthUser | NextResponse): value is NextResponse {

  return value instanceof NextResponse;

}

function isSuperAdmin(admin: AuthUser): boolean {
  const record = admin as unknown as AnyRecord;
  const roles = [record.adminRole, record.designation, record.role]
    .map((value) => str(value).toLowerCase().replace(/[^a-z]/g, ""));
  return roles.includes("superadmin");
}

function productionSections(): IAssessmentSection[] {

  return [

    {

      section: "mcq",

      title: "Multiple Choice Questions",

      questionCount: ASSESSMENT_CONFIG.mcq.questionCount,

      durationMinutes: ASSESSMENT_CONFIG.mcq.durationMinutes,

      randomizeQuestions: true,

      randomizeOptions: true,

      minimumQuestionBankSize: ASSESSMENT_CONFIG.mcq.minimumQuestionBankSize,

    },

    {

      section: "coding",

      title: "Coding Problems",

      questionCount: ASSESSMENT_CONFIG.coding.questionCount,

      durationMinutes: ASSESSMENT_CONFIG.coding.durationMinutes,

      randomizeQuestions: true,

      randomizeOptions: false,

      minimumQuestionBankSize: ASSESSMENT_CONFIG.coding.minimumQuestionBankSize,

    },

  ];

}

function productionSelection() {

  return {

    enabled: true,

    randomizePerAttempt: true,

    lockQuestionsOnStart: true,

    preventDuplicateQuestions: true,

  };

}

function productionConfiguration() {

  return {

    totalDurationMinutes: ASSESSMENT_CONFIG.totalDurationMinutes,

    totalQuestions: ASSESSMENT_CONFIG.totalQuestions,

    passingScore: ASSESSMENT_CONFIG.passingScore,

    mcqCount: ASSESSMENT_CONFIG.mcq.questionCount,

    mcqDurationMinutes: ASSESSMENT_CONFIG.mcq.durationMinutes,

    codingCount: ASSESSMENT_CONFIG.coding.questionCount,

    codingDurationMinutes: ASSESSMENT_CONFIG.coding.durationMinutes,

    totalMarks: 100,

    mcqMarksPerQuestion: 2,

    codingMarksPerQuestion: 20,

  };

}

function emptyStats(): QuestionStats {

  return { mcq: 0, coding: 0, total: 0 };

}

async function questionStats(id: mongoose.Types.ObjectId): Promise<QuestionStats> {

  const rows = await Question.aggregate<{ _id: string; count: number }>([

    { $match: { assessmentId: id, isActive: true, status: { $ne: "archived" } } },

    { $group: { _id: "$section", count: { $sum: 1 } } },

  ]).exec();

  const result = emptyStats();

  for (const row of rows) {

    if (row._id === "mcq") result.mcq = Number(row.count) || 0;

    if (row._id === "coding") result.coding = Number(row.count) || 0;

  }

  result.total = result.mcq + result.coding;

  return result;

}

async function statsForMany(ids: mongoose.Types.ObjectId[]) {

  const map = new Map<string, QuestionStats>();

  for (const id of ids) map.set(String(id), emptyStats());

  if (!ids.length) return map;

  const rows = await Question.aggregate<{

    _id: { assessmentId: mongoose.Types.ObjectId; section: string };

    count: number;

  }>([

    { $match: { assessmentId: { $in: ids }, isActive: true, status: { $ne: "archived" } } },

    { $group: { _id: { assessmentId: "$assessmentId", section: "$section" }, count: { $sum: 1 } } },

  ]).exec();

  for (const row of rows) {

    const target = map.get(String(row._id?.assessmentId ?? ""));

    if (!target) continue;

    if (row._id.section === "mcq") target.mcq += Number(row.count) || 0;

    if (row._id.section === "coding") target.coding += Number(row.count) || 0;

    target.total = target.mcq + target.coding;

  }

  return map;

}

function serializeAssessment(source: AnyRecord, stats: QuestionStats = emptyStats()): AnyRecord {

  const { adminNotes: _adminNotes, ...assessment } = source;

  const id = assessment._id == null ? "" : String(assessment._id);

  const status = validStatus(assessment.status) ? assessment.status : "draft";

  const config = productionConfiguration();

  return {

    ...assessment,

    _id: id,

    id,

    assessmentId: str(assessment.assessmentId),

    title: str(assessment.title),

    domain: str(assessment.domain),

    domainKey: str(assessment.domainKey),

    description: str(assessment.description),

    status,

    isActive: assessment.isActive !== false,

    isSelectable: assessment.isSelectable === true,

    ...config,

    durationMinutes: config.totalDurationMinutes,

    duration: config.totalDurationMinutes,

    questionStats: stats,

    configuration: {

      ...config,

      randomizePerAttempt: true,

      lockQuestionsOnStart: true,

      preventDuplicateQuestions: true,

      section1: { type: "mcq", questionCount: config.mcqCount, durationMinutes: config.mcqDurationMinutes },

      section2: { type: "coding", questionCount: config.codingCount, durationMinutes: config.codingDurationMinutes },

    },

  };

}

type PublishValidation =

  | { valid: true; stats: QuestionStats }

  | { valid: false; code: string; message: string; stats: QuestionStats };

/**
 * Validate published and active questions before publishing an assessment.
 * Repair stale domain keys only when the normalized question domain matches
 * the assessment domain, because student start APIs use the canonical key.
 */
async function validateForPublish(id: mongoose.Types.ObjectId): Promise<PublishValidation> {

  const assessment = await Assessment.findById(id)

    .select("_id domain domainKey status")

    .lean()

    .exec();

  if (!assessment) {

    return { valid: false, code: "ASSESSMENT_NOT_FOUND", message: "Assessment not found.", stats: emptyStats() };

  }

  const expectedKey = normalizeAssessmentDomain(str(assessment.domainKey) || str(assessment.domain));

  if (!expectedKey) {

    return { valid: false, code: "INVALID_ASSESSMENT_DOMAIN", message: "Assessment domain is missing or invalid.", stats: emptyStats() };

  }

  const candidates = await Question.find({

    assessmentId: id,

    status: "published",

    isActive: true,

  })

    .select("+correctOption assessmentId domain domainKey section type question options inputFormat outputFormat examples languages")

    .lean()

    .exec() as unknown as AnyRecord[];

  const stats = emptyStats();

  let domainMismatch = 0;

  let invalidShape = 0;

  for (const q of candidates) {

    const fromDomain = normalizeAssessmentDomain(str(q.domain));

    const fromKey = normalizeAssessmentDomain(str(q.domainKey));

    const effectiveKey = fromDomain || fromKey;

    // Repair stale keys only when the human-readable domain is authoritative

    // and clearly matches the parent assessment.

    if (fromDomain === expectedKey && fromKey !== expectedKey) {

      await Question.updateOne(

        { _id: q._id, assessmentId: id, status: "published", isActive: true },

        { $set: { domainKey: expectedKey } },

      ).exec();

      q.domainKey = expectedKey;

    }

    if (effectiveKey !== expectedKey && fromDomain !== expectedKey) {

      domainMismatch++;

      continue;

    }

    const section = str(q.section).toLowerCase();

    const type = str(q.type).toLowerCase();

    if (!str(q.question) || !["mcq", "coding"].includes(section) || type !== section) {

      invalidShape++;

      continue;

    }

    if (section === "mcq") {

      const options = Array.isArray(q.options) ? q.options.filter((x: unknown) => x && typeof x === "object" && !Array.isArray(x)) as AnyRecord[] : [];

      const ids = options.map((o) => str(o.optionId ?? o.id).toUpperCase());

      const labels = options.map((o) => str(o.text));

      const correct = str(q.correctOption).toUpperCase();

      if (

        options.length !== 4 ||

        ids.some((x) => !x) ||

        new Set(ids).size !== 4 ||

        labels.some((x) => !x) ||

        !correct ||

        !ids.includes(correct)

      ) {

        invalidShape++;

        continue;

      }

      stats.mcq++;

      continue;

    }

    const examples = Array.isArray(q.examples) ? q.examples.filter((x: unknown) => x && typeof x === "object" && !Array.isArray(x)) as AnyRecord[] : [];

    const languages = Array.isArray(q.languages) ? q.languages.map(str).filter(Boolean) : [];

    if (

      !str(q.inputFormat) ||

      !str(q.outputFormat) ||

      examples.length === 0 ||

      examples.some((x) => !str(x.input) || !str(x.output)) ||

      languages.length === 0

    ) {

      invalidShape++;

      continue;

    }

    stats.coding++;

  }

  stats.total = stats.mcq + stats.coding;

  if (domainMismatch) {

    return {

      valid: false,

      code: "QUESTION_DOMAIN_MISMATCH",

      message: `${domainMismatch} published active question(s) do not match the assessment domain. Correct their domain before publishing.`,

      stats,

    };

  }

  if (invalidShape) {

    return {

      valid: false,

      code: "INVALID_PUBLISHED_QUESTIONS",

      message: `${invalidShape} published active question(s) have incomplete or invalid fields. Fix them before publishing.`,

      stats,

    };

  }

  if (stats.mcq !== ASSESSMENT_CONFIG.mcq.questionCount) {

    return {

      valid: false,

      code: "INVALID_MCQ_COUNT",

      message: `Exactly ${ASSESSMENT_CONFIG.mcq.questionCount} valid published active MCQs are required; ${stats.mcq} are available.`,

      stats,

    };

  }

  if (stats.coding !== ASSESSMENT_CONFIG.coding.questionCount) {

    return {

      valid: false,

      code: "INVALID_CODING_COUNT",

      message: `Exactly ${ASSESSMENT_CONFIG.coding.questionCount} valid published active coding questions are required; ${stats.coding} are available.`,

      stats,

    };

  }

  if (stats.total !== ASSESSMENT_CONFIG.totalQuestions) {

    return {

      valid: false,

      code: "INVALID_TOTAL_QUESTION_COUNT",

      message: `Exactly ${ASSESSMENT_CONFIG.totalQuestions} valid published active questions are required; ${stats.total} are available.`,

      stats,

    };

  }

  return { valid: true, stats };

}

function handleError(error: unknown, operation: string): NextResponse {

  console.error(`[${operation}]`, error);

  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {

    return failure("Assessment data is invalid.", "VALIDATION_ERROR", 400);

  }

  if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === 11000) {

    return failure("An assessment with conflicting unique information already exists.", "DUPLICATE_ASSESSMENT", 409);

  }

  return failure("The assessment service could not complete the request. Check server database configuration and logs.", "ASSESSMENT_SERVICE_ERROR", 500);

}

async function readBody(request: NextRequest): Promise<{ valid: true; data: AnyRecord } | { valid: false; response: NextResponse }> {

  let body: unknown;

  try {

    body = await request.json();

  } catch {

    return { valid: false, response: failure("Request body must contain valid JSON.", "INVALID_JSON", 400) };

  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {

    return { valid: false, response: failure("Request body must be a JSON object.", "INVALID_BODY", 400) };

  }

  return { valid: true, data: body as AnyRecord };

}

export async function GET(request: NextRequest): Promise<NextResponse> {

  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  try {

    await connectDB();

    const params = request.nextUrl.searchParams;

    const search = str(params.get("search")).replace(/\s+/g, " ").slice(0, MAX_SEARCH_LENGTH);

    const statusParam = str(params.get("status")).toLowerCase();

    const page = Math.min(positiveInt(params.get("page"), 1), MAX_PAGE);

    const limit = Math.min(positiveInt(params.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);

    const filter: AnyRecord = {};

    if (validStatus(statusParam)) filter.status = statusParam;

    if (search) {

      const regex = escapeRegex(search);

      filter.$or = [

        { title: { $regex: regex, $options: "i" } },

        { domain: { $regex: regex, $options: "i" } },

        { assessmentId: { $regex: regex, $options: "i" } },

      ];

    }

    const skip = (page - 1) * limit;

    const [items, total, published, draft, archived] = await Promise.all([

      Assessment.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean().exec(),

      Assessment.countDocuments(filter).exec(),

      Assessment.countDocuments({ ...filter, status: "published" }).exec(),

      Assessment.countDocuments({ ...filter, status: "draft" }).exec(),

      Assessment.countDocuments({ ...filter, status: "archived" }).exec(),

    ]);

    const ids = items.map((item) => item._id as mongoose.Types.ObjectId);

    const statsMap = await statsForMany(ids);

    const data = items.map((item) => serializeAssessment(item as unknown as AnyRecord, statsMap.get(String(item._id)) ?? emptyStats()));

    return success({

      message: "Assessments loaded successfully.",

      data,

      total,

      pagination: {

        page, limit, total,

        totalPages: total ? Math.ceil(total / limit) : 0,

        hasNextPage: page * limit < total,

        hasPreviousPage: page > 1,

      },

      stats: { total, published, active: published, draft, archived },

      configuration: productionConfiguration(),

      meta: { generatedAt: new Date().toISOString(), authenticated: true, adminId: str(auth.id) },

    });

  } catch (error) {

    return handleError(error, "GET /api/admin/assessments");

  }

}

export async function POST(request: NextRequest): Promise<NextResponse> {

  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  try {

    await connectDB();

    const parsed = await readBody(request);

    if (!parsed.valid) return parsed.response;

    const title = str(parsed.data.title);

    const domain = str(parsed.data.domain);

    const description = str(parsed.data.description);

    if (title.length < 3 || title.length > MAX_TITLE_LENGTH) {

      return failure(`Title must contain between 3 and ${MAX_TITLE_LENGTH} characters.`, "INVALID_TITLE", 400);

    }

    if (domain.length < 2 || domain.length > MAX_DOMAIN_LENGTH) {

      return failure(`Domain must contain between 2 and ${MAX_DOMAIN_LENGTH} characters.`, "INVALID_DOMAIN", 400);

    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {

      return failure(`Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`, "DESCRIPTION_TOO_LONG", 400);

    }

    const domainKey = normalizeAssessmentDomain(domain);

    if (!domainKey) return failure("Assessment domain is invalid.", "INVALID_DOMAIN", 400);

    const existing = await Assessment.findOne({

      domainKey,

      status: { $in: ["draft", "published"] },

    }).select("_id assessmentId status").lean().exec();

    if (existing) {

      const published = existing.status === "published";

      return failure(

        published

          ? "A published assessment already exists for this domain. Archive it before creating a replacement."

          : "A draft assessment already exists for this domain.",

        published ? "PUBLISHED_ASSESSMENT_EXISTS" : "DRAFT_ASSESSMENT_EXISTS",

        409,

        { existingAssessmentId: str(existing.assessmentId) },

      );

    }

    const adminId = objectId(auth.id);

    const created = await Assessment.create({

      assessmentId: generateAssessmentId(),

      title,

      domain,

      domainKey,

      description,

      totalDurationMinutes: ASSESSMENT_CONFIG.totalDurationMinutes,

      passingScore: ASSESSMENT_CONFIG.passingScore,

      totalQuestions: ASSESSMENT_CONFIG.totalQuestions,

      sections: productionSections(),

      questionSelection: productionSelection(),

      status: "draft",

      isActive: true,

      isSelectable: false,

      version: 1,

      ...(adminId ? { createdBy: adminId } : {}),

    });

    return success({

      message: "Assessment created as a draft. Add its questions from the separate Questions section.",

      data: serializeAssessment(created.toObject() as unknown as AnyRecord, await questionStats(created._id)),

    }, 201);

  } catch (error) {

    return handleError(error, "POST /api/admin/assessments");

  }

}

export async function PUT(request: NextRequest): Promise<NextResponse> {

  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  try {

    await connectDB();

    const parsed = await readBody(request);

    if (!parsed.valid) return parsed.response;

    const body = parsed.data;

    const id = objectId(body.id ?? body._id);

    if (!id) return failure("A valid assessment document ID is required.", "INVALID_ASSESSMENT_ID", 400);

    const assessment = await Assessment.findById(id).exec();

    if (!assessment) return failure("Assessment not found.", "ASSESSMENT_NOT_FOUND", 404);

    const action = str(body.action).toLowerCase();

    const requestedStatus = str(body.status).toLowerCase();

    if (action === "publish" || requestedStatus === "published") {

      if (assessment.status === "archived") {

        return failure("Archived assessments cannot be republished. Create a new assessment instead.", "ARCHIVED_ASSESSMENT_LOCKED", 409);

      }

      const validation = await validateForPublish(id);

      if (!validation.valid) {

        return failure(validation.message, validation.code, 400, { questionStats: validation.stats });

      }

      const otherPublished = await Assessment.findOne({

        domainKey: assessment.domainKey,

        status: "published",

        _id: { $ne: id },

      }).select("_id assessmentId").lean().exec();

      if (otherPublished) {

        return failure("Another assessment is already published for this domain.", "PUBLISHED_ASSESSMENT_EXISTS", 409);

      }

      assessment.status = "published";

      assessment.isActive = true;

      assessment.isSelectable = true;

      assessment.publishedAt = assessment.publishedAt ?? new Date();

      const adminId = objectId(auth.id);

      if (adminId) assessment.publishedBy = adminId;

      assessment.totalDurationMinutes = ASSESSMENT_CONFIG.totalDurationMinutes;

      assessment.totalQuestions = ASSESSMENT_CONFIG.totalQuestions;

      assessment.passingScore = ASSESSMENT_CONFIG.passingScore;

      assessment.sections = productionSections();

      assessment.questionSelection = productionSelection();

      await assessment.save();

      return success({

        message: "Assessment published and made available to eligible students.",

        data: serializeAssessment(assessment.toObject() as unknown as AnyRecord, validation.stats),

      });

    }

    if (action === "archive" || requestedStatus === "archived") {

      assessment.status = "archived";

      assessment.isActive = false;

      assessment.isSelectable = false;

      await assessment.save();

      return success({

        message: "Assessment archived successfully.",

        data: serializeAssessment(assessment.toObject() as unknown as AnyRecord, await questionStats(id)),

      });

    }

    if (
      action === "draft" ||
      action === "return_to_draft" ||
      requestedStatus === "draft"
    ) {
      if (assessment.status === "archived") {
        return failure(
          "Archived assessments cannot be moved back to draft. Create a new assessment instead.",
          "ARCHIVED_ASSESSMENT_LOCKED",
          409,
        );
      }

      if (assessment.status === "published") {
        if (!isSuperAdmin(auth)) {
          return failure(
            "Only Super Admin can unpublish a live assessment.",
            "FORBIDDEN",
            403,
          );
        }

        if (body.confirmUnpublish !== true) {
          return failure(
            "Unpublishing will immediately remove this assessment from student selection and unlock its question bank. Confirm by sending confirmUnpublish: true.",
            "UNPUBLISH_CONFIRMATION_REQUIRED",
            409,
            { requiresConfirmation: true },
          );
        }
      }

      assessment.status = "draft";
      assessment.isActive = true;
      assessment.isSelectable = false;
      assessment.set("publishedAt", undefined);
      assessment.set("publishedBy", undefined);
    }

    if (assessment.status === "published" && (body.title !== undefined || body.domain !== undefined)) {

      return failure("Published assessment details are locked. Archive it and create a new version.", "PUBLISHED_ASSESSMENT_LOCKED", 409);

    }

    if (body.title !== undefined) {

      const title = str(body.title);

      if (title.length < 3 || title.length > MAX_TITLE_LENGTH) {

        return failure(`Title must contain between 3 and ${MAX_TITLE_LENGTH} characters.`, "INVALID_TITLE", 400);

      }

      assessment.title = title;

    }

    if (body.description !== undefined) {

      const description = str(body.description);

      if (description.length > MAX_DESCRIPTION_LENGTH) {

        return failure(`Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`, "DESCRIPTION_TOO_LONG", 400);

      }

      assessment.description = description;

    }

    if (body.domain !== undefined) {

      const domain = str(body.domain);

      if (domain.length < 2 || domain.length > MAX_DOMAIN_LENGTH) {

        return failure(`Domain must contain between 2 and ${MAX_DOMAIN_LENGTH} characters.`, "INVALID_DOMAIN", 400);

      }

      const domainKey = normalizeAssessmentDomain(domain);

      if (!domainKey) return failure("Assessment domain is invalid.", "INVALID_DOMAIN", 400);

      const conflict = await Assessment.findOne({

        domainKey,

        status: { $in: ["draft", "published"] },

        _id: { $ne: id },

      }).select("_id").lean().exec();

      if (conflict) return failure("Another draft or published assessment already exists for this domain.", "DOMAIN_ASSESSMENT_EXISTS", 409);

      const activeCount = await Question.countDocuments({

        assessmentId: id,

        isActive: true,

        status: { $ne: "archived" },

      }).exec();

      if (activeCount > 0) {

        return failure("Remove or archive the current question bank before changing this assessment domain.", "DOMAIN_CHANGE_REQUIRES_EMPTY_QUESTION_BANK", 409);

      }

      assessment.domain = domain;

      assessment.domainKey = domainKey;

    }

    assessment.totalDurationMinutes = ASSESSMENT_CONFIG.totalDurationMinutes;

    assessment.totalQuestions = ASSESSMENT_CONFIG.totalQuestions;

    assessment.passingScore = ASSESSMENT_CONFIG.passingScore;

    assessment.sections = productionSections();

    assessment.questionSelection = productionSelection();

    await assessment.save();

    return success({

      message: "Assessment updated successfully.",

      data: serializeAssessment(assessment.toObject() as unknown as AnyRecord, await questionStats(id)),

    });

  } catch (error) {

    return handleError(error, "PUT /api/admin/assessments");

  }

}

export async function PATCH(request: NextRequest): Promise<NextResponse> {

  return PUT(request);

}

export async function DELETE(request: NextRequest): Promise<NextResponse> {

  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  try {

    await connectDB();

    const id = objectId(request.nextUrl.searchParams.get("id"));

    if (!id) return failure("A valid assessment document ID is required.", "INVALID_ASSESSMENT_ID", 400);

    const assessment = await Assessment.findById(id).select("_id assessmentId status").exec();

    if (!assessment) return failure("Assessment not found.", "ASSESSMENT_NOT_FOUND", 404);

    if (assessment.status !== "draft") {

      return failure("Only draft assessments can be permanently deleted. Archive published assessments instead.", "ASSESSMENT_DELETE_NOT_ALLOWED", 409);

    }

    const session = await mongoose.startSession();

    try {

      await session.withTransaction(async () => {

        const current = await Assessment.findOne({ _id: id, status: "draft" }).session(session).exec();

        if (!current) throw new Error("ASSESSMENT_DELETE_STATE_CHANGED");

        await Question.deleteMany({ assessmentId: id }).session(session).exec();

        const result = await Assessment.deleteOne({ _id: id, status: "draft" }).session(session).exec();

        if (result.deletedCount !== 1) throw new Error("ASSESSMENT_DELETE_STATE_CHANGED");

      });

    } catch (error) {

      if (error instanceof Error && error.message === "ASSESSMENT_DELETE_STATE_CHANGED") {

        return failure("Assessment state changed during deletion. Refresh and try again.", "ASSESSMENT_DELETE_RACE", 409);

      }

      throw error;

    } finally {

      await session.endSession();

    }

    return success({

      message: "Draft assessment and its question bank deleted successfully.",

      data: { id: String(id), assessmentId: str(assessment.assessmentId) },

    });

  } catch (error) {

    return handleError(error, "DELETE /api/admin/assessments");

  }

}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {

  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  return success({

    message: "Assessment API configuration loaded.",

    configuration: {

      ...productionConfiguration(),

      questionBank: {

        mcq: ASSESSMENT_CONFIG.mcq.minimumQuestionBankSize,

        coding: ASSESSMENT_CONFIG.coding.minimumQuestionBankSize,

      },

      questionSelection: productionSelection(),

    },

  });

}

export async function HEAD(): Promise<NextResponse> {

  return new NextResponse(null, {

    status: 405,

    headers: {

      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS",

      "Cache-Control": "no-store",

      "X-Content-Type-Options": "nosniff",

    },

  });

}
