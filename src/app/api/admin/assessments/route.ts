
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/db";
import AdminModel from "@/models/Admin";
import Assessment, {
  ASSESSMENT_CONFIG,
  generateAssessmentId,
  normalizeAssessmentDomain,
  type IAssessmentQuestionSelection,
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

const CONFIG = Object.freeze({
  sections: ["easy", "medium", "hard"] as const,
  questionsPerSection: ASSESSMENT_CONFIG.sections.easy.questionCount,
  totalQuestions: ASSESSMENT_CONFIG.totalQuestions,
  durationPerSection: ASSESSMENT_CONFIG.sections.easy.durationMinutes,
  totalDurationMinutes: ASSESSMENT_CONFIG.totalDurationMinutes,
  marksPerQuestion: ASSESSMENT_CONFIG.marksPerQuestion,
  totalMarks: ASSESSMENT_CONFIG.totalMarks,
  passingPercentage: ASSESSMENT_CONFIG.passingScore,
  passingMarks: ASSESSMENT_CONFIG.passingMarks,
});

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 120;
const MAX_TITLE_LENGTH = 160;
const MAX_DOMAIN_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

type Section = (typeof CONFIG.sections)[number];
type AssessmentStatus = "draft" | "published" | "archived";
type AnyRecord = Record<string, any>;

type QuestionStats = {
  easy: number;
  medium: number;
  hard: number;
  total: number;
  activeEasy: number;
  activeMedium: number;
  activeHard: number;
  activeTotal: number;
  draft: number;
  archived: number;
  totalMarks: number;
  passingMarks: number;
  passingPercentage: number;
  complete: boolean;
  activeComplete: boolean;
  readiness: "ready" | "incomplete";
};

type PublishValidation =
  | { valid: true; stats: QuestionStats }
  | {
      valid: false;
      code: string;
      message: string;
      stats: QuestionStats;
    };

function response(
  data: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function success(
  data: AnyRecord,
  status = 200,
): NextResponse {
  return response(
    {
      success: true,
      ...data,
    },
    status,
  );
}

function failure(
  message: string,
  code: string,
  status: number,
  extra: AnyRecord = {},
): NextResponse {
  return response(
    {
      success: false,
      message,
      code,
      error: {
        code,
        message,
      },
      ...extra,
    },
    status,
  );
}

function str(value: unknown): string {
  if (typeof value === "string") {
    return value.normalize("NFKC").trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return "";
}

function positiveInt(
  value: unknown,
  fallback: number,
): number {
  const number =
    typeof value === "number" ? value : Number(value);

  return Number.isSafeInteger(number) && number > 0
    ? number
    : fallback;
}

function validStatus(
  value: unknown,
): value is AssessmentStatus {
  return (
    value === "draft" ||
    value === "published" ||
    value === "archived"
  );
}

function objectId(
  value: unknown,
): mongoose.Types.ObjectId | null {
  const valueString = str(value);

  return (
    valueString &&
    mongoose.isValidObjectId(valueString)
  )
    ? new mongoose.Types.ObjectId(valueString)
    : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is AnyRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function verifyMutationOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return true;

  try {
    const expectedOrigin = request.nextUrl.origin;
    if (origin && new URL(origin).origin !== expectedOrigin) return false;
    if (!origin && referer && new URL(referer).origin !== expectedOrigin) return false;
    return true;
  } catch {
    return false;
  }
}

const MAX_BODY_BYTES = 64 * 1024;

async function getAdmin(
  request: NextRequest,
): Promise<AuthUser | null> {
  try {
    const dedicated =
      request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;

    const legacy =
      request.cookies.get(AUTH_COOKIE_NAME)?.value;

    const token = dedicated || legacy;

    if (!token) return null;

    const user = await verifyAuthToken(token);

    if (
      !user ||
      user.role !== "admin" ||
      !str(user.id)
    ) {
      return null;
    }

    if (
      dedicated &&
      user.sessionType !== "admin"
    ) {
      return null;
    }

    if (
      !dedicated &&
      user.sessionType &&
      !["admin", "legacy"].includes(user.sessionType)
    ) {
      return null;
    }

    await connectDB();

    const adminId = objectId(user.id);

    if (!adminId) return null;

    const adminRecord = await AdminModel.findById(adminId)
      .select("_id role isActive isEmailVerified adminRole designation security")
      .lean()
      .exec();

    if (
      !adminRecord ||
      adminRecord.isActive === false ||
      adminRecord.isEmailVerified === false
    ) {
      return null;
    }

    const persisted = adminRecord as unknown as AnyRecord;
    const security = isRecord(persisted.security) ? persisted.security : {};

    if (security.accountLocked === true) return null;

    if (security.lockedUntil) {
      const lockedUntil = new Date(String(security.lockedUntil));
      if (!Number.isNaN(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now()) {
        return null;
      }
    }

    const normalizeRole = (value: unknown) =>
      str(value).toLowerCase().replace(/[^a-z]/g, "");

    const roles = [
      persisted.adminRole,
      persisted.designation,
      persisted.role,
    ].map(normalizeRole);

    const effectiveRole = roles.includes("superadmin")
      ? "Super Admin"
      : roles.includes("assessmentmanager")
        ? "Assessment Manager"
        : roles.includes("admin")
          ? "Admin"
          : roles.includes("hr")
            ? "HR"
            : roles.includes("support")
              ? "Support"
              : "";

    if (!effectiveRole) return null;

    return {
      ...user,
      adminRole: effectiveRole,
      designation: str(persisted.designation),
      persistedRole: str(persisted.role),
    } as AuthUser;
  } catch (error) {
    console.error("[ADMIN ASSESSMENTS AUTH]", error);
    return null;
  }
}

async function requireAdmin(
  request: NextRequest,
): Promise<AuthUser | NextResponse> {
  const admin = await getAdmin(request);

  return (
    admin ??
    failure(
      "Unauthorized. Admin login required.",
      "UNAUTHORIZED",
      401,
    )
  );
}

function isResponse(
  value: AuthUser | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}


function canManageAssessments(admin: AuthUser): boolean {
  const record = admin as unknown as AnyRecord;
  const roles = [record.adminRole, record.designation]
    .map((value) => str(value).toLowerCase().replace(/[^a-z]/g, ""));
  return roles.some((role) =>
    ["superadmin", "admin", "assessmentmanager"].includes(role),
  );
}

function requireAssessmentManager(admin: AuthUser): NextResponse | null {
  return canManageAssessments(admin)
    ? null
    : failure(
        "Your admin role is read-only for assessment management.",
        "FORBIDDEN",
        403,
      );
}

function isSuperAdmin(admin: AuthUser): boolean {
  const record = admin as unknown as AnyRecord;

  const roles = [
    record.adminRole,
    record.designation,
    record.role,
  ].map((value) =>
    str(value).toLowerCase().replace(/[^a-z]/g, ""),
  );

  return roles.includes("superadmin");
}

function productionSections(): IAssessmentSection[] {
  return CONFIG.sections.map((section) => ({
    section,
    title:
      section.charAt(0).toUpperCase() +
      section.slice(1),
    questionCount: CONFIG.questionsPerSection,
    durationMinutes: CONFIG.durationPerSection,
    randomizeQuestions: true,
    randomizeOptions: true,
    minimumQuestionBankSize: CONFIG.questionsPerSection,
  })) as IAssessmentSection[];
}

function productionSelection(): IAssessmentQuestionSelection {
  return {
    enabled: true,
    randomizePerAttempt: true,
    lockQuestionsOnStart: true,
    preventDuplicateQuestions: true,
  };
}

function productionConfiguration(): AnyRecord {
  return {
    totalDurationMinutes: CONFIG.totalDurationMinutes,
    totalQuestions: CONFIG.totalQuestions,
    totalMarks: CONFIG.totalMarks,
    passingScore: CONFIG.passingPercentage,
    passingPercentage: CONFIG.passingPercentage,
    passingMarks: CONFIG.passingMarks,
    marksPerQuestion: CONFIG.marksPerQuestion,
    mcqCount: CONFIG.totalQuestions,
    mcqMarksPerQuestion: CONFIG.marksPerQuestion,
    codingCount: 0,
    codingMarksPerQuestion: 0,
    sections: CONFIG.sections.map((section) => ({
      section,
      questionCount: CONFIG.questionsPerSection,
      durationMinutes: CONFIG.durationPerSection,
      marks: CONFIG.questionsPerSection,
    })),
  };
}

function emptyStats(): QuestionStats {
  return {
    easy: 0,
    medium: 0,
    hard: 0,
    total: 0,
    activeEasy: 0,
    activeMedium: 0,
    activeHard: 0,
    activeTotal: 0,
    draft: 0,
    archived: 0,
    totalMarks: 0,
    passingMarks: CONFIG.passingMarks,
    passingPercentage: CONFIG.passingPercentage,
    complete: false,
    activeComplete: false,
    readiness: "incomplete",
  };
}

function addQuestionCount(
  stats: QuestionStats,
  section: string,
  count: number,
): void {
  if (
    section === "easy" ||
    section === "medium" ||
    section === "hard"
  ) {
    stats[section] += count;
    stats.total += count;
  }
}

function addActiveCount(
  stats: QuestionStats,
  section: string,
  count: number,
): void {
  if (section === "easy") {
    stats.activeEasy += count;
  }

  if (section === "medium") {
    stats.activeMedium += count;
  }

  if (section === "hard") {
    stats.activeHard += count;
  }

  stats.activeTotal += count;
}

function finalizeStats(
  stats: QuestionStats,
): QuestionStats {
  stats.totalMarks = stats.activeTotal;
  stats.complete = CONFIG.sections.every(
    (section) =>
      stats[section] === CONFIG.questionsPerSection,
  );

  stats.activeComplete = CONFIG.sections.every(
    (section) => {
      const activeKey =
        `active${section.charAt(0).toUpperCase()}${section.slice(1)}` as
          | "activeEasy"
          | "activeMedium"
          | "activeHard";

      return (
        stats[activeKey] === CONFIG.questionsPerSection
      );
    },
  );

  stats.readiness = stats.activeComplete
    ? "ready"
    : "incomplete";

  return stats;
}

async function questionStats(
  id: mongoose.Types.ObjectId,
): Promise<QuestionStats> {
  const rows = await Question.aggregate<{
    _id: {
      section: string;
      status: string;
      isActive: boolean;
    };
    count: number;
  }>([
    {
      $match: {
        assessmentId: id,
      },
    },
    {
      $group: {
        _id: {
          section: "$section",
          status: "$status",
          isActive: "$isActive",
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]).exec();

  const stats = emptyStats();

  for (const row of rows) {
    const section = str(row._id?.section);
    const status = str(row._id?.status);
    const count = Number(row.count) || 0;

    if (status === "archived") {
      stats.archived += count;
      continue;
    }

    addQuestionCount(stats, section, count);

    if (
      status === "published" &&
      row._id.isActive !== false
    ) {
      addActiveCount(stats, section, count);
    }

    if (status === "draft") {
      stats.draft += count;
    }
  }

  return finalizeStats(stats);
}

async function statsForMany(
  ids: mongoose.Types.ObjectId[],
): Promise<Map<string, QuestionStats>> {
  const map = new Map<string, QuestionStats>();

  for (const id of ids) {
    map.set(String(id), emptyStats());
  }

  if (!ids.length) return map;

  const rows = await Question.aggregate<{
    _id: {
      assessmentId: mongoose.Types.ObjectId;
      section: string;
      status: string;
      isActive: boolean;
    };
    count: number;
  }>([
    {
      $match: {
        assessmentId: {
          $in: ids,
        },
      },
    },
    {
      $group: {
        _id: {
          assessmentId: "$assessmentId",
          section: "$section",
          status: "$status",
          isActive: "$isActive",
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]).exec();

  for (const row of rows) {
    const target = map.get(
      String(row._id?.assessmentId ?? ""),
    );

    if (!target) continue;

    const status = str(row._id?.status);
    const section = str(row._id?.section);
    const count = Number(row.count) || 0;

    if (status === "archived") {
      target.archived += count;
      continue;
    }

    addQuestionCount(target, section, count);

    if (
      status === "published" &&
      row._id.isActive !== false
    ) {
      addActiveCount(target, section, count);
    }

    if (status === "draft") {
      target.draft += count;
    }
  }

  for (const [id, stats] of map.entries()) {
    map.set(id, finalizeStats(stats));
  }

  return map;
}

function serializeAssessment(
  source: AnyRecord,
  stats: QuestionStats = emptyStats(),
): AnyRecord {
  const {
    adminNotes: _adminNotes,
    ...assessment
  } = source;

  const id =
    assessment._id == null
      ? ""
      : String(assessment._id);

  const status: AssessmentStatus =
    validStatus(assessment.status)
      ? assessment.status
      : "draft";

  const configuration = productionConfiguration();

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
    isSelectable:
      status === "published" &&
      assessment.isSelectable === true,
    ...configuration,
    durationMinutes: CONFIG.totalDurationMinutes,
    duration: CONFIG.totalDurationMinutes,
    questionStats: stats,
    configuration: {
      ...configuration,
      randomizePerAttempt: true,
      lockQuestionsOnStart: true,
      preventDuplicateQuestions: true,
      sectionWiseSelection: true,
      section1: {
        type: "mcq",
        section: "easy",
        questionCount: 30,
        durationMinutes: 30,
      },
      section2: {
        type: "mcq",
        section: "medium",
        questionCount: 30,
        durationMinutes: 30,
      },
      section3: {
        type: "mcq",
        section: "hard",
        questionCount: 30,
        durationMinutes: 30,
      },
    },
  };
}

async function validateForPublish(
  id: mongoose.Types.ObjectId,
): Promise<PublishValidation> {
  const assessment = await Assessment.findById(id)
    .select("_id domain domainKey status")
    .lean()
    .exec();

  if (!assessment) {
    return {
      valid: false,
      code: "ASSESSMENT_NOT_FOUND",
      message: "Assessment not found.",
      stats: emptyStats(),
    };
  }

  const expectedKey = normalizeAssessmentDomain(
    str(assessment.domainKey) ||
      str(assessment.domain),
  );

  if (!expectedKey) {
    return {
      valid: false,
      code: "INVALID_ASSESSMENT_DOMAIN",
      message: "Assessment domain is missing or invalid.",
      stats: emptyStats(),
    };
  }

  const candidates = await Question.find({
    assessmentId: id,
    status: "published",
    isActive: true,
  })
    .select(
      "+correctOption assessmentId domain domainKey section difficulty type question options marks negativeMarks",
    )
    .lean()
    .exec() as unknown as AnyRecord[];

  const stats = emptyStats();

  let domainMismatch = 0;
  let invalidShape = 0;
  let invalidSection = 0;

  for (const question of candidates) {
    const domain = normalizeAssessmentDomain(
      str(question.domain),
    );

    const domainKey = normalizeAssessmentDomain(
      str(question.domainKey),
    );

    if (
      !domain ||
      domain !== expectedKey ||
      domainKey !== expectedKey
    ) {
      domainMismatch++;
      continue;
    }

    const section = str(question.section).toLowerCase();
    const difficulty = str(question.difficulty).toLowerCase();

    if (
      !CONFIG.sections.includes(section as Section) ||
      section !== difficulty
    ) {
      invalidSection++;
      continue;
    }

    if (
      question.type !== "mcq" ||
      !str(question.question) ||
      Number(question.marks) !== CONFIG.marksPerQuestion ||
      Number(question.negativeMarks) !== 0
    ) {
      invalidShape++;
      continue;
    }

    const options = Array.isArray(question.options)
      ? question.options.filter(
          (option: unknown) =>
            isRecord(option),
        )
      : [];

    const ids = options.map((option: AnyRecord) =>
      str(option.optionId).toUpperCase(),
    );

    const labels = options.map((option: AnyRecord) =>
      str(option.text),
    );

    const normalizedLabels = labels.map((label: string) =>
      label.normalize("NFKC").trim().toLocaleLowerCase(),
    );

    const correct = str(
      question.correctOption,
    ).toUpperCase();

    const expectedIds = ["A", "B", "C", "D"];

    if (
      options.length !== 4 ||
      new Set(ids).size !== 4 ||
      expectedIds.some((optionId) =>
        !ids.includes(optionId),
      ) ||
      labels.some((label: string) => !label) ||
      new Set(normalizedLabels).size !== 4 ||
      !expectedIds.includes(correct)
    ) {
      invalidShape++;
      continue;
    }

    addQuestionCount(stats, section, 1);
    addActiveCount(stats, section, 1);
  }

  finalizeStats(stats);

  if (domainMismatch > 0) {
    return {
      valid: false,
      code: "QUESTION_DOMAIN_MISMATCH",
      message:
        `${domainMismatch} published question(s) have a domain that does not match this assessment. Correct the domain before publishing.`,
      stats,
    };
  }

  if (invalidSection > 0) {
    return {
      valid: false,
      code: "INVALID_QUESTION_SECTION",
      message:
        `${invalidSection} published question(s) have an invalid section or mismatched difficulty.`,
      stats,
    };
  }

  if (invalidShape > 0) {
    return {
      valid: false,
      code: "INVALID_PUBLISHED_QUESTIONS",
      message:
        `${invalidShape} published question(s) have invalid MCQ fields. Verify their four options, correct answer and marks.`,
      stats,
    };
  }

  for (const section of CONFIG.sections) {
    if (stats[section] !== CONFIG.questionsPerSection) {
      return {
        valid: false,
        code: `INVALID_${section.toUpperCase()}_COUNT`,
        message:
          `Exactly 30 valid published active ${section} MCQs are required. Currently available: ${stats[section]}.`,
        stats,
      };
    }
  }

  if (stats.total !== CONFIG.totalQuestions) {
    return {
      valid: false,
      code: "INVALID_TOTAL_QUESTION_COUNT",
      message:
        "Exactly 90 valid published active MCQs are required.",
      stats,
    };
  }

  return {
    valid: true,
    stats,
  };
}

function handleError(
  error: unknown,
  operation: string,
): NextResponse {
  console.error(`[${operation}]`, error);

  if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError
  ) {
    return failure(
      "Assessment data is invalid.",
      "VALIDATION_ERROR",
      400,
    );
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  ) {
    return failure(
      "An assessment with this ID or published domain already exists. Refresh the assessment list and try again.",
      "DUPLICATE_ASSESSMENT",
      409,
    );
  }

  return failure(
    "The assessment service could not complete the request. Check server database configuration and logs.",
    "ASSESSMENT_SERVICE_ERROR",
    500,
  );
}

async function readBody(
  request: NextRequest,
): Promise<
  | { valid: true; data: AnyRecord }
  | { valid: false; response: NextResponse }
> {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return {
      valid: false,
      response: failure("Request body exceeds the allowed size.", "REQUEST_BODY_TOO_LARGE", 413),
    };
  }

  let raw: string;

  try {
    raw = await request.text();
  } catch {
    return {
      valid: false,
      response: failure("Unable to read request body.", "INVALID_BODY", 400),
    };
  }

  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return {
      valid: false,
      response: failure("Request body exceeds the allowed size.", "REQUEST_BODY_TOO_LARGE", 413),
    };
  }

  let body: unknown;

  try {
    body = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      response: failure("Request body must contain valid JSON.", "INVALID_JSON", 400),
    };
  }

  if (!isRecord(body)) {
    return {
      valid: false,
      response: failure("Request body must be a JSON object.", "INVALID_BODY", 400),
    };
  }

  return { valid: true, data: body };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  try {
    await connectDB();

    const params = request.nextUrl.searchParams;

    const search = str(params.get("search"))
      .replace(/\s+/g, " ")
      .slice(0, MAX_SEARCH_LENGTH);

    const statusParam = str(
      params.get("status"),
    ).toLowerCase();

    if (
      statusParam &&
      !validStatus(statusParam)
    ) {
      return failure(
        "Status must be draft, published or archived.",
        "INVALID_ASSESSMENT_STATUS",
        400,
      );
    }

    const page = Math.min(
      positiveInt(params.get("page"), 1),
      MAX_PAGE,
    );

    const limit = Math.min(
      positiveInt(params.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT,
    );

    const filter: AnyRecord = {};

    if (validStatus(statusParam)) {
      filter.status = statusParam;
    }

    if (search) {
      const regex = escapeRegex(search);

      filter.$or = [
        {
          title: {
            $regex: regex,
            $options: "i",
          },
        },
        {
          domain: {
            $regex: regex,
            $options: "i",
          },
        },
        {
          assessmentId: {
            $regex: regex,
            $options: "i",
          },
        },
      ];
    }

    const skip = Math.min((page - 1) * limit, Number.MAX_SAFE_INTEGER);

    const [items, total, published, draft, archived] =
      await Promise.all([
        Assessment.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),

        Assessment.countDocuments(filter).exec(),

        Assessment.countDocuments({
          ...filter,
          status: "published",
        }).exec(),

        Assessment.countDocuments({
          ...filter,
          status: "draft",
        }).exec(),

        Assessment.countDocuments({
          ...filter,
          status: "archived",
        }).exec(),
      ]);

    const ids = items.map(
      (item) => item._id as mongoose.Types.ObjectId,
    );

    const statsMap = await statsForMany(ids);

    const data = items.map((item) =>
      serializeAssessment(
        item as unknown as AnyRecord,
        statsMap.get(String(item._id)) ?? emptyStats(),
      ),
    );

    return success({
      message: "Assessments loaded successfully.",
      data,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: total
          ? Math.ceil(total / limit)
          : 0,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
      stats: {
        total,
        published,
        active: published,
        draft,
        archived,
      },
      configuration: productionConfiguration(),
      meta: {
        generatedAt: new Date().toISOString(),
        authenticated: true,
        adminId: str(auth.id),
      },
    });
  } catch (error) {
    return handleError(
      error,
      "GET /api/admin/assessments",
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  const permissionError = requireAssessmentManager(auth);
  if (permissionError) return permissionError;
  if (!verifyMutationOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    await connectDB();

    const parsed = await readBody(request);

    if (!parsed.valid) return parsed.response;

    const title = str(parsed.data.title);
    const domain = str(parsed.data.domain);
    const description = str(parsed.data.description);

    if (
      title.length < 3 ||
      title.length > MAX_TITLE_LENGTH
    ) {
      return failure(
        `Title must contain between 3 and ${MAX_TITLE_LENGTH} characters.`,
        "INVALID_TITLE",
        400,
      );
    }

    if (
      domain.length < 2 ||
      domain.length > MAX_DOMAIN_LENGTH
    ) {
      return failure(
        `Domain must contain between 2 and ${MAX_DOMAIN_LENGTH} characters.`,
        "INVALID_DOMAIN",
        400,
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return failure(
        `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
        "DESCRIPTION_TOO_LONG",
        400,
      );
    }

    const domainKey = normalizeAssessmentDomain(domain);

    if (!domainKey) {
      return failure(
        "Assessment domain is invalid.",
        "INVALID_DOMAIN",
        400,
      );
    }

    const existing = await Assessment.findOne({
      domainKey,
      status: {
        $in: ["draft", "published"],
      },
    })
      .select("_id assessmentId status")
      .lean()
      .exec();

    if (existing) {
      const published = existing.status === "published";

      return failure(
        published
          ? "A published assessment already exists for this domain. Archive it before creating a replacement."
          : "A draft assessment already exists for this domain.",
        published
          ? "PUBLISHED_ASSESSMENT_EXISTS"
          : "DRAFT_ASSESSMENT_EXISTS",
        409,
        {
          existingAssessmentId: str(existing.assessmentId),
        },
      );
    }

    const adminId = objectId(auth.id);

    const created = await Assessment.create({
      assessmentId: generateAssessmentId(),
      title,
      domain,
      domainKey,
      description,
      totalDurationMinutes: CONFIG.totalDurationMinutes,
      passingScore: CONFIG.passingPercentage,
      totalQuestions: CONFIG.totalQuestions,
      sections: productionSections(),
      questionSelection: productionSelection(),
      status: "draft",
      isActive: true,
      isSelectable: false,
      version: 1,
      ...(adminId ? { createdBy: adminId } : {}),
    });

    return success(
      {
        message:
          "Assessment created as a draft. Add 30 Easy, 30 Medium and 30 Hard MCQs from Questions.",
        data: serializeAssessment(
          created.toObject() as unknown as AnyRecord,
          await questionStats(created._id),
        ),
      },
      201,
    );
  } catch (error) {
    return handleError(
      error,
      "POST /api/admin/assessments",
    );
  }
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse> {
  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  const permissionError = requireAssessmentManager(auth);
  if (permissionError) return permissionError;
  if (!verifyMutationOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    await connectDB();

    const parsed = await readBody(request);

    if (!parsed.valid) return parsed.response;

    const body = parsed.data;

    const id = objectId(body.id ?? body._id);

    if (!id) {
      return failure(
        "A valid assessment document ID is required.",
        "INVALID_ASSESSMENT_ID",
        400,
      );
    }

    const assessment = await Assessment.findById(id).exec();

    if (!assessment) {
      return failure(
        "Assessment not found.",
        "ASSESSMENT_NOT_FOUND",
        404,
      );
    }

    const action = str(body.action).toLowerCase();
    const requestedStatus = str(body.status).toLowerCase();

    const allowedActions = [
      "",
      "publish",
      "archive",
      "draft",
      "return_to_draft",
    ];

    if (action && !allowedActions.includes(action)) {
      return failure(
        "Unsupported assessment action.",
        "INVALID_ASSESSMENT_ACTION",
        400,
      );
    }

    if (requestedStatus && !validStatus(requestedStatus)) {
      return failure(
        "Status must be draft, published or archived.",
        "INVALID_ASSESSMENT_STATUS",
        400,
      );
    }

    if (
      assessment.status === "archived" &&
      action !== "archive" &&
      requestedStatus !== "archived"
    ) {
      return failure(
        "Archived assessments are permanently locked. Create a new assessment version.",
        "ARCHIVED_ASSESSMENT_LOCKED",
        409,
      );
    }

    if (
      action === "publish" ||
      requestedStatus === "published"
    ) {
      if (assessment.status === "archived") {
        return failure(
          "Archived assessments cannot be republished.",
          "ARCHIVED_ASSESSMENT_LOCKED",
          409,
        );
      }

      const validation = await validateForPublish(id);

      if (!validation.valid) {
        return failure(
          validation.message,
          validation.code,
          400,
          {
            questionStats: validation.stats,
          },
        );
      }

      const otherPublished = await Assessment.findOne({
        domainKey: assessment.domainKey,
        status: "published",
        _id: {
          $ne: id,
        },
      })
        .select("_id assessmentId")
        .lean()
        .exec();

      if (otherPublished) {
        return failure(
          "Another assessment is already published for this domain.",
          "PUBLISHED_ASSESSMENT_EXISTS",
          409,
        );
      }

      const previousStatus = assessment.status;

      const currentState = await Assessment.findOne({
        _id: id,
        status: { $in: ["draft", "published"] },
        domainKey: assessment.domainKey,
      })
        .select("_id status domainKey")
        .lean()
        .exec();

      if (!currentState) {
        return failure(
          "Assessment state changed while publishing. Refresh and try again.",
          "ASSESSMENT_STATE_CHANGED",
          409,
        );
      }

      assessment.status = "published";
      assessment.isActive = true;
      assessment.isSelectable = true;
      assessment.publishedAt =
        assessment.publishedAt ?? new Date();

      const adminId = objectId(auth.id);

      if (adminId) {
        assessment.publishedBy = adminId;
      }

      assessment.totalDurationMinutes =
        CONFIG.totalDurationMinutes;

      assessment.totalQuestions = CONFIG.totalQuestions;
      assessment.passingScore = CONFIG.passingPercentage;
      assessment.sections = productionSections();
      assessment.questionSelection = productionSelection();

      try {
        await assessment.save();
      } catch (error) {
        assessment.status = previousStatus;
        throw error;
      }

      return success({
        message:
          "Assessment published successfully and is now available for eligible students.",
        data: serializeAssessment(
          assessment.toObject() as unknown as AnyRecord,
          validation.stats,
        ),
      });
    }

    if (
      action === "archive" ||
      requestedStatus === "archived"
    ) {
      if (assessment.status === "archived") {
        return failure(
          "Assessment is already archived.",
          "ASSESSMENT_ALREADY_ARCHIVED",
          409,
        );
      }

      assessment.status = "archived";
      assessment.isActive = false;
      assessment.isSelectable = false;

      await assessment.save();

      return success({
        message: "Assessment archived successfully.",
        data: serializeAssessment(
          assessment.toObject() as unknown as AnyRecord,
          await questionStats(id),
        ),
      });
    }

    if (
      action === "draft" ||
      action === "return_to_draft" ||
      requestedStatus === "draft"
    ) {
      if (assessment.status === "archived") {
        return failure(
          "Archived assessments cannot be moved back to draft.",
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
            "Unpublishing immediately removes this assessment from student selection. Confirm by sending confirmUnpublish: true.",
            "UNPUBLISH_CONFIRMATION_REQUIRED",
            409,
            {
              requiresConfirmation: true,
            },
          );
        }
      }

      assessment.status = "draft";
      assessment.isActive = true;
      assessment.isSelectable = false;
      assessment.set("publishedAt", undefined);
      assessment.set("publishedBy", undefined);
    }

    if (
      assessment.status === "published" &&
      (
        body.title !== undefined ||
        body.domain !== undefined ||
        body.description !== undefined
      )
    ) {
      return failure(
        "Published assessment details are locked. Create a new version to make changes.",
        "PUBLISHED_ASSESSMENT_LOCKED",
        409,
      );
    }

    if (body.title !== undefined) {
      const title = str(body.title);

      if (
        title.length < 3 ||
        title.length > MAX_TITLE_LENGTH
      ) {
        return failure(
          `Title must contain between 3 and ${MAX_TITLE_LENGTH} characters.`,
          "INVALID_TITLE",
          400,
        );
      }

      assessment.title = title;
    }

    if (body.description !== undefined) {
      const description = str(body.description);

      if (description.length > MAX_DESCRIPTION_LENGTH) {
        return failure(
          `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
          "DESCRIPTION_TOO_LONG",
          400,
        );
      }

      assessment.description = description;
    }

    if (body.domain !== undefined) {
      const domain = str(body.domain);

      if (
        domain.length < 2 ||
        domain.length > MAX_DOMAIN_LENGTH
      ) {
        return failure(
          `Domain must contain between 2 and ${MAX_DOMAIN_LENGTH} characters.`,
          "INVALID_DOMAIN",
          400,
        );
      }

      const domainKey = normalizeAssessmentDomain(domain);

      if (!domainKey) {
        return failure(
          "Assessment domain is invalid.",
          "INVALID_DOMAIN",
          400,
        );
      }

      const conflict = await Assessment.findOne({
        domainKey,
        status: {
          $in: ["draft", "published"],
        },
        _id: {
          $ne: id,
        },
      })
        .select("_id")
        .lean()
        .exec();

      if (conflict) {
        return failure(
          "Another draft or published assessment already exists for this domain.",
          "DOMAIN_ASSESSMENT_EXISTS",
          409,
        );
      }

      const questionCount = await Question.countDocuments({
        assessmentId: id,
      }).exec();

      if (questionCount > 0) {
        return failure(
          "Changing the domain requires an empty question bank. Archive or remove existing questions first.",
          "DOMAIN_CHANGE_REQUIRES_EMPTY_QUESTION_BANK",
          409,
        );
      }

      assessment.domain = domain;
      assessment.domainKey = domainKey;
    }

    assessment.totalDurationMinutes =
      CONFIG.totalDurationMinutes;

    assessment.totalQuestions = CONFIG.totalQuestions;
    assessment.passingScore = CONFIG.passingPercentage;
    assessment.sections = productionSections();
    assessment.questionSelection = productionSelection();

    await assessment.save();

    return success({
      message: "Assessment updated successfully.",
      data: serializeAssessment(
        assessment.toObject() as unknown as AnyRecord,
        await questionStats(id),
      ),
    });
  } catch (error) {
    return handleError(
      error,
      "PUT /api/admin/assessments",
    );
  }
}

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  return PUT(request);
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  const auth = await requireAdmin(request);

  if (isResponse(auth)) return auth;

  if (!isSuperAdmin(auth)) {
    return failure(
      "Only Super Admin can permanently delete assessments.",
      "FORBIDDEN",
      403,
    );
  }
  if (!verifyMutationOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    await connectDB();

    const id = objectId(
      request.nextUrl.searchParams.get("id"),
    );

    if (!id) {
      return failure(
        "A valid assessment document ID is required.",
        "INVALID_ASSESSMENT_ID",
        400,
      );
    }

    const assessment = await Assessment.findById(id)
      .select("_id assessmentId status")
      .exec();

    if (!assessment) {
      return failure(
        "Assessment not found.",
        "ASSESSMENT_NOT_FOUND",
        404,
      );
    }

    if (assessment.status !== "draft") {
      return failure(
        "Only draft assessments can be permanently deleted. Archive published assessments instead.",
        "ASSESSMENT_DELETE_NOT_ALLOWED",
        409,
      );
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const current = await Assessment.findOne({
          _id: id,
          status: "draft",
        })
          .session(session)
          .exec();

        if (!current) {
          throw new Error(
            "ASSESSMENT_DELETE_STATE_CHANGED",
          );
        }

        await Question.deleteMany({
          assessmentId: id,
        })
          .session(session)
          .exec();

        const result = await Assessment.deleteOne({
          _id: id,
          status: "draft",
        })
          .session(session)
          .exec();

        if (result.deletedCount !== 1) {
          throw new Error(
            "ASSESSMENT_DELETE_STATE_CHANGED",
          );
        }
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "ASSESSMENT_DELETE_STATE_CHANGED"
      ) {
        return failure(
          "Assessment state changed during deletion. Refresh and try again.",
          "ASSESSMENT_DELETE_RACE",
          409,
        );
      }

      throw error;
    } finally {
      await session.endSession();
    }

    return success({
      message:
        "Draft assessment and its question bank deleted successfully.",
      data: {
        id: String(id),
        assessmentId: str(assessment.assessmentId),
      },
    });
  } catch (error) {
    return handleError(
      error,
      "DELETE /api/admin/assessments",
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
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
