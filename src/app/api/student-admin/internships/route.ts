import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Admin from "@/models/Admin";
import Internship, {
  INTERNSHIP_DURATIONS,
  INTERNSHIP_MODES,
  INTERNSHIP_PLAN_CODES,
  INTERNSHIP_PLAN_CONFIG,
} from "@/models/Internship";
import {
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAuthToken,
  isStudentAdminSession,
  type AuthUser,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_BODY_BYTES = 64 * 1024;

type Data = Record<string, unknown>;
type Status = "active" | "inactive" | "draft" | "closed";
type PlanCode = (typeof INTERNSHIP_PLAN_CODES)[number];
type Duration = (typeof INTERNSHIP_DURATIONS)[number];
type Mode = (typeof INTERNSHIP_MODES)[number];

class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function response(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function success(message: string, data: Data, status = 200) {
  return response({ success: true, message, data }, status);
}

function failure(
  message: string,
  code: string,
  status = 400,
) {
  return response({ success: false, message, code }, status);
}

function isRecord(value: unknown): value is Data {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (!value || !/^\d+$/.test(value)) return fallback;

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function parseStatus(value: unknown): Status {
  const status = text(value, "draft").toLowerCase();

  if (
    status === "active" ||
    status === "inactive" ||
    status === "draft" ||
    status === "closed"
  ) {
    return status;
  }

  throw new ApiError(
    "Choose a valid internship status.",
    "INVALID_STATUS",
  );
}

function parsePlan(
  planValue: unknown,
  durationValue: unknown,
) {
  const rawPlan = text(planValue).toUpperCase();
  const rawDuration = text(durationValue) as Duration;

  let planCode: PlanCode | undefined;

  if (rawPlan) {
    if (!(INTERNSHIP_PLAN_CODES as readonly string[]).includes(rawPlan)) {
      throw new ApiError("Invalid internship plan.", "INVALID_PLAN");
    }

    planCode = rawPlan as PlanCode;
  } else {
    const entry = Object.entries(INTERNSHIP_PLAN_CONFIG).find(
      ([, plan]) => plan.duration === rawDuration,
    );

    planCode = entry?.[0] as PlanCode | undefined;
  }

  if (!planCode) {
    throw new ApiError("Select a valid internship duration.", "INVALID_PLAN");
  }

  return INTERNSHIP_PLAN_CONFIG[planCode];
}

function parseDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    throw new ApiError(`${field} is invalid.`, "INVALID_DATE");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(`${field} is invalid.`, "INVALID_DATE");
  }

  return date;
}

function validateDateRange(
  start: Date | null,
  end: Date | null,
) {
  if (start && end && end.getTime() < start.getTime()) {
    throw new ApiError(
      "End date cannot be earlier than start date.",
      "INVALID_DATE_RANGE",
    );
  }
}

function parseArray(value: unknown, field: string): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  if (values.length > 100) {
    throw new ApiError(
      `${field} cannot contain more than 100 items.`,
      "ARRAY_TOO_LARGE",
    );
  }

  const result = values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 200))
    .filter(Boolean);

  return [...new Set(result)];
}

function parseMode(value: unknown): Mode {
  const mode = text(value, "Remote");

  if (!(INTERNSHIP_MODES as readonly string[]).includes(mode)) {
    throw new ApiError("Invalid internship mode.", "INVALID_MODE");
  }

  return mode as Mode;
}

function creatorId(user: AuthUser): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(user.id);
}

function serialize(document: unknown): Data | null {
  if (!document || !isRecord(document)) return null;

  const raw = document;
  const id = String(raw._id ?? raw.id ?? "");
  const title = text(raw.title, text(raw.name));
  const planCode = text(raw.planCode).toUpperCase() as PlanCode;

  const plan = Object.prototype.hasOwnProperty.call(
    INTERNSHIP_PLAN_CONFIG,
    planCode,
  )
    ? INTERNSHIP_PLAN_CONFIG[planCode]
    : null;

  const price = plan?.price ?? numberValue(raw.price);

  return {
    _id: id,
    id,
    internshipId: raw.internshipId ?? "",
    title,
    name: text(raw.name, title),
    description: text(raw.description),
    domain: text(raw.domain),
    assessmentDomain: text(raw.assessmentDomain, text(raw.domain)),
    assessmentRequired: raw.assessmentRequired !== false,
    applicationRequired: raw.applicationRequired !== false,
    planCode: plan?.planCode ?? raw.planCode ?? null,
    duration: plan?.duration ?? raw.duration ?? "",
    durationMonths: plan?.durationMonths ?? numberValue(raw.durationMonths),
    sortOrder: plan?.sortOrder ?? numberValue(raw.sortOrder),
    price,
    priceInPaise: plan?.priceInPaise ?? numberValue(raw.priceInPaise),
    currency: "INR",
    stipend: text(raw.stipend),
    mode: text(raw.mode, "Remote"),
    location: text(raw.location),
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    technologies: Array.isArray(raw.technologies) ? raw.technologies : [],
    requirements: Array.isArray(raw.requirements) ? raw.requirements : [],
    responsibilities: Array.isArray(raw.responsibilities)
      ? raw.responsibilities
      : [],
    eligibility: text(raw.eligibility),
    maxStudents: numberValue(raw.maxStudents),
    enrolledStudents: numberValue(raw.enrolledStudents),
    applications: numberValue(raw.applications),
    applicants: numberValue(raw.applicants),
    status: text(raw.status, "draft"),
    isPublic: raw.isPublic === true,
    isSelectable: raw.isSelectable === true,
    featured: raw.featured === true,
    certificateEligible: raw.certificateEligible !== false,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    notes: text(raw.notes),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

async function authenticate(request: NextRequest) {
  const token = request.cookies.get(
    STUDENT_ADMIN_AUTH_COOKIE_NAME,
  )?.value;

  if (!token) {
    return {
      ok: false as const,
      result: failure("Student Admin login required.", "UNAUTHENTICATED", 401),
    };
  }

  let user: AuthUser | null = null;

  try {
    user = await verifyAuthToken(token);
  } catch {
    user = null;
  }

  if (
    !user ||
    !isStudentAdminSession(user) ||
    !mongoose.isValidObjectId(user.id)
  ) {
    return {
      ok: false as const,
      result: failure("Invalid or expired Student Admin session.", "INVALID_SESSION", 401),
    };
  }

  await connectDB();

  const adminDocument = await Admin.findById(user.id)
    .select(
      "_id role isActive isEmailVerified security.accountLocked security.lockedUntil",
    )
    .lean()
    .exec();

  if (!adminDocument) {
    return {
      ok: false as const,
      result: failure("Student Admin account not found.", "ADMIN_NOT_FOUND", 401),
    };
  }

  const admin = adminDocument as unknown as Data;
  const security = isRecord(admin.security) ? admin.security : {};

  const lockedUntil = security.lockedUntil
    ? new Date(String(security.lockedUntil)).getTime()
    : 0;

  if (
    admin.isActive !== true ||
    admin.isEmailVerified !== true ||
    security.accountLocked === true ||
    (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) ||
    text(admin.role) !== "Student Operations Admin"
  ) {
    return {
      ok: false as const,
      result: failure(
        "Student Admin access has been revoked or suspended.",
        "ACCESS_REVOKED",
        403,
      ),
    };
  }

  return { ok: true as const, user };
}

function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return false;

  try {
    const expected = request.nextUrl.origin;

    if (origin && new URL(origin).origin !== expected) {
      return false;
    }

    if (referer && new URL(referer).origin !== expected) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function readBody(request: NextRequest): Promise<Data> {
  const contentLength = Number(
    request.headers.get("content-length") || 0,
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    throw new ApiError("Request body is too large.", "BODY_TOO_LARGE", 413);
  }

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      "Content-Type must be application/json.",
      "INVALID_CONTENT_TYPE",
      415,
    );
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new ApiError("Request body is too large.", "BODY_TOO_LARGE", 413);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError("Invalid JSON request body.", "INVALID_JSON");
  }

  if (!isRecord(parsed)) {
    throw new ApiError("Request body must be an object.", "INVALID_BODY");
  }

  return parsed;
}

function buildCreateData(
  body: Data,
  user: AuthUser,
  durationOverride?: Duration,
): Data {
  const title = text(body.title, text(body.name));
  const domain = text(body.domain);

  if (title.length < 3 || title.length > 200) {
    throw new ApiError(
      "Title must contain 3–200 characters.",
      "INVALID_TITLE",
    );
  }

  if (!domain || domain.length > 150) {
    throw new ApiError("Valid domain is required.", "INVALID_DOMAIN");
  }

  const plan = parsePlan(
    durationOverride ? undefined : body.planCode,
    durationOverride ?? body.duration,
  );

  const status = parseStatus(body.status);
  const isPublic = status === "active" && booleanValue(body.isPublic, true);
  const isSelectable =
    isPublic && status === "active" && booleanValue(body.isSelectable, true);

  const startDate = parseDate(body.startDate, "startDate");
  const endDate = parseDate(body.endDate, "endDate");

  validateDateRange(startDate, endDate);

  const maxStudents = numberValue(body.maxStudents);

  if (
    !Number.isInteger(maxStudents) ||
    maxStudents < 0 ||
    maxStudents > 100000000
  ) {
    throw new ApiError("Invalid maximum student capacity.", "INVALID_CAPACITY");
  }

  return {
    title,
    name: title,
    description: text(body.description).slice(0, 5000),
    domain,
    assessmentDomain: text(body.assessmentDomain, domain).slice(0, 150),
    assessmentRequired: booleanValue(body.assessmentRequired, true),
    applicationRequired: booleanValue(body.applicationRequired, true),
    planCode: plan.planCode,
    duration: plan.duration,
    durationMonths: plan.durationMonths,
    sortOrder: plan.sortOrder,
    price: plan.price,
    priceInPaise: plan.priceInPaise,
    currency: "INR",
    stipend: text(body.stipend).slice(0, 200),
    mode: parseMode(body.mode),
    location: text(body.location).slice(0, 200),
    skills: parseArray(body.skills, "skills"),
    technologies: parseArray(body.technologies, "technologies"),
    requirements: parseArray(body.requirements, "requirements"),
    responsibilities: parseArray(body.responsibilities, "responsibilities"),
    eligibility: text(body.eligibility).slice(0, 3000),
    maxStudents,
    enrolledStudents: 0,
    applications: 0,
    applicants: 0,
    status,
    isPublic,
    isSelectable,
    featured: booleanValue(body.featured, false),
    certificateEligible: booleanValue(body.certificateEligible, true),
    tags: parseArray(body.tags, "tags"),
    startDate,
    endDate,
    createdBy: creatorId(user),
    notes: text(body.notes).slice(0, 3000),
  };
}

function handleError(error: unknown, fallback: string, code: string) {
  if (error instanceof ApiError) {
    return failure(error.message, error.code, error.status);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return response(
      {
        success: false,
        message: "Internship validation failed.",
        code: "VALIDATION_ERROR",
        errors: Object.values(error.errors).map((item) => ({
          field: item.path,
          message: item.message,
        })),
      },
      422,
    );
  }

  if (isRecord(error) && Number(error.code) === 11000) {
    return failure(
      "An internship with this domain and plan already exists.",
      "DUPLICATE_DOMAIN_PLAN",
      409,
    );
  }

  console.error(`[StudentAdmin:${code}]`, error);
  return failure(fallback, code, 500);
}

async function findConflict(
  domain: string,
  planCode: PlanCode,
  excludedId?: string,
) {
  const filter: Data = {
    domain: { $regex: `^${escapeRegex(domain)}$`, $options: "i" },
    planCode,
  };

  if (excludedId) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludedId) };
  }

  return Internship.findOne(filter).select("_id").lean().exec();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.result;

    const params = request.nextUrl.searchParams;

    const requestedPage = parseInteger(params.get("page"), 1, 100000);
    const limit = parseInteger(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const search = text(params.get("search") ?? params.get("q")).slice(0, 100);
    const status = text(params.get("status")).toLowerCase();
    const domain = text(params.get("domain")).slice(0, 150);
    const planCode = text(params.get("planCode")).toUpperCase();

    const filter: Data = {};

    if (status && status !== "all") {
      if (!["active", "inactive", "draft", "closed"].includes(status)) {
        throw new ApiError("Invalid status filter.", "INVALID_STATUS_FILTER");
      }

      filter.status = status;
    }

    if (domain) {
      filter.domain = { $regex: escapeRegex(domain), $options: "i" };
    }

    if (planCode) {
      if (!(INTERNSHIP_PLAN_CODES as readonly string[]).includes(planCode)) {
        throw new ApiError("Invalid plan filter.", "INVALID_PLAN_FILTER");
      }

      filter.planCode = planCode;
    }

    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };

      filter.$or = [
        { title: regex },
        { name: regex },
        { domain: regex },
        { assessmentDomain: regex },
        { internshipId: regex },
      ];
    }

    const sort = text(params.get("sort"), "newest");

    const sortOrder: Record<string, 1 | -1> =
      sort === "oldest"
        ? { createdAt: 1 as const, _id: 1 as const }
        : sort === "title"
          ? { title: 1 as const, _id: 1 as const }
          : { createdAt: -1 as const, _id: -1 as const };

    const [total, documents, statusRows, domainRows, totalsRows] =
      await Promise.all([
        Internship.countDocuments(filter).exec(),
        Internship.find(filter)
          .sort(sortOrder)
          .skip((requestedPage - 1) * limit)
          .limit(limit)
          .lean()
          .exec(),
        Internship.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]).exec(),
        Internship.aggregate([
          { $group: { _id: "$domain", count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 50 },
        ]).exec(),
        Internship.aggregate([
          {
            $group: {
              _id: null,
              applications: { $sum: { $ifNull: ["$applications", 0] } },
              applicants: { $sum: { $ifNull: ["$applicants", 0] } },
              enrolled: { $sum: { $ifNull: ["$enrolledStudents", 0] } },
            },
          },
        ]).exec(),
      ]);

    const totalPages = total ? Math.ceil(total / limit) : 0;
    const page = totalPages ? Math.min(requestedPage, totalPages) : 1;

    const internships = documents
      .map(serialize)
      .filter((item): item is Data => item !== null);

    const counts: Record<Status, number> = {
      active: 0,
      inactive: 0,
      draft: 0,
      closed: 0,
    };

    for (const row of statusRows as Array<{ _id: string; count: number }>) {
      if (Object.prototype.hasOwnProperty.call(counts, row._id)) {
        counts[row._id as Status] = numberValue(row.count);
      }
    }

    const totals = (totalsRows as Data[])[0] ?? {};

    const pagination = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    const stats = {
      total,
      active: counts.active,
      inactive: counts.inactive,
      draft: counts.draft,
      closed: counts.closed,
      applications: numberValue(totals.applications),
      applicants: numberValue(totals.applicants),
      enrolled: numberValue(totals.enrolled),
    };

    const domains = (
      domainRows as Array<{ _id?: unknown; count?: unknown }>
    )
      .map((item) => ({
        domain: text(item._id),
        count: numberValue(item.count),
      }))
      .filter((item) => item.domain);

    return success("Internships fetched successfully.", {
      internships,
      data: internships,
      pagination,
      stats,
      domains,
      ...pagination,
      ...stats,
    });
  } catch (error) {
    return handleError(error, "Unable to fetch internships.", "FETCH_FAILED");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.result;

    const body = await readBody(request);
    const domain = text(body.domain);

    if (!domain || domain.length > 150) {
      throw new ApiError("Valid internship domain is required.", "INVALID_DOMAIN");
    }

    const createAllPlans = body.createAllPlans === true;

    const durations: Duration[] = createAllPlans
      ? ["1 Month", "3 Months", "6 Months"]
      : [parsePlan(body.planCode, body.duration).duration];

    const plans = durations.map((duration) => parsePlan(undefined, duration));

    const existing = await Internship.find({
      domain: { $regex: `^${escapeRegex(domain)}$`, $options: "i" },
      planCode: { $in: plans.map((plan) => plan.planCode) },
    })
      .select("planCode")
      .lean()
      .exec();

    const existingCodes = new Set(existing.map((item) => item.planCode));

    const duplicate = plans.find((plan) => existingCodes.has(plan.planCode));

    if (duplicate) {
      return failure(
        `A ${duplicate.duration} plan already exists for ${domain}.`,
        "DUPLICATE_DOMAIN_PLAN",
        409,
      );
    }

    const createdIds: mongoose.Types.ObjectId[] = [];

    try {
      for (const duration of durations) {
        const created = await Internship.create(
          buildCreateData(body, auth.user, duration),
        );

        createdIds.push(created._id);
      }
    } catch (error) {
      if (createdIds.length) {
        await Internship.deleteMany({
          _id: { $in: createdIds },
          applications: { $in: [0, null] },
          applicants: { $in: [0, null] },
          enrolledStudents: { $in: [0, null] },
        }).exec();
      }

      throw error;
    }

    const documents = await Internship.find({
      _id: { $in: createdIds },
    })
      .sort({ durationMonths: 1 })
      .lean()
      .exec();

    const internships = documents
      .map(serialize)
      .filter((item): item is Data => item !== null);

    return success(
      "Internship plan(s) created successfully.",
      {
        internship: internships[0] ?? null,
        internships,
        data: internships,
        createdCount: internships.length,
      },
      201,
    );
  } catch (error) {
    return handleError(error, "Unable to create internship.", "CREATE_FAILED");
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return updateInternship(request);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return updateInternship(request);
}

async function updateInternship(
  request: NextRequest,
): Promise<NextResponse> {
  if (!verifyOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.result;

    const body = await readBody(request);
    const id = text(body.id, text(body._id, text(body.internshipId)));

    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError("Valid internship ID is required.", "INVALID_ID");
    }

    const existing = await Internship.findById(id).exec();

    if (!existing) {
      return failure("Internship not found.", "NOT_FOUND", 404);
    }

    const update: Data = {};

    for (const [field, value] of Object.entries(body)) {
      switch (field) {
        case "title":
        case "name": {
          const title = text(value);

          if (title.length < 3 || title.length > 200) {
            throw new ApiError("Invalid internship title.", "INVALID_TITLE");
          }

          update.title = title;
          update.name = title;
          break;
        }

        case "domain": {
          const domain = text(value);

          if (!domain || domain.length > 150) {
            throw new ApiError("Invalid internship domain.", "INVALID_DOMAIN");
          }

          update.domain = domain;

          if (body.assessmentDomain === undefined) {
            update.assessmentDomain = domain;
          }

          break;
        }

        case "assessmentDomain":
          update.assessmentDomain = text(value).slice(0, 150);
          break;

        case "description":
          update.description = text(value).slice(0, 5000);
          break;

        case "stipend":
          update.stipend = text(value).slice(0, 200);
          break;

        case "location":
          update.location = text(value).slice(0, 200);
          break;

        case "eligibility":
          update.eligibility = text(value).slice(0, 3000);
          break;

        case "notes":
          update.notes = text(value).slice(0, 3000);
          break;

        case "mode":
          update.mode = parseMode(value);
          break;

        case "status":
          update.status = parseStatus(value);
          break;

        case "isPublic":
        case "isSelectable":
        case "assessmentRequired":
        case "applicationRequired":
        case "featured":
        case "certificateEligible":
          if (typeof value !== "boolean") {
            throw new ApiError(`${field} must be boolean.`, "INVALID_BOOLEAN");
          }

          update[field] = value;
          break;

        case "skills":
        case "technologies":
        case "requirements":
        case "responsibilities":
        case "tags":
          update[field] = parseArray(value, field);
          break;

        case "startDate":
        case "endDate":
          update[field] = parseDate(value, field);
          break;

        case "planCode":
        case "duration": {
          const plan = parsePlan(
            body.planCode ?? existing.planCode,
            body.duration ?? existing.duration,
          );

          update.planCode = plan.planCode;
          update.duration = plan.duration;
          update.durationMonths = plan.durationMonths;
          update.sortOrder = plan.sortOrder;
          update.price = plan.price;
          update.priceInPaise = plan.priceInPaise;
          update.currency = "INR";
          break;
        }

        case "maxStudents": {
          const capacity = numberValue(value, Number.NaN);

          if (
            !Number.isInteger(capacity) ||
            capacity < 0 ||
            capacity > 100000000
          ) {
            throw new ApiError("Invalid student capacity.", "INVALID_CAPACITY");
          }

          update.maxStudents = capacity;
          break;
        }

        case "action": {
          const actions: Record<string, Status> = {
            activate: "active",
            deactivate: "inactive",
            draft: "draft",
            close: "closed",
          };

          const nextStatus = actions[text(value).toLowerCase()];

          if (!nextStatus) {
            throw new ApiError("Invalid internship action.", "INVALID_ACTION");
          }

          update.status = nextStatus;
          update.isPublic = nextStatus === "active";
          update.isSelectable = nextStatus === "active";
          break;
        }
      }
    }

    if (Object.keys(update).length === 0) {
      throw new ApiError("No valid update fields supplied.", "NO_UPDATE_FIELDS");
    }

    const nextStatus = (update.status ?? existing.status) as Status;
    const nextPublic =
      update.isPublic === undefined
        ? existing.isPublic === true
        : update.isPublic === true;

    const nextSelectable =
      update.isSelectable === undefined
        ? existing.isSelectable === true
        : update.isSelectable === true;

    update.isPublic = nextStatus === "active" && nextPublic;
    update.isSelectable =
      nextStatus === "active" && nextPublic && nextSelectable;

    const startDate =
      update.startDate === undefined
        ? existing.startDate ?? null
        : update.startDate as Date | null;

    const endDate =
      update.endDate === undefined
        ? existing.endDate ?? null
        : update.endDate as Date | null;

    validateDateRange(startDate, endDate);

    const nextDomain = text(update.domain, text(existing.domain));
    const nextPlanCode = text(
      update.planCode,
      text(existing.planCode),
    ).toUpperCase() as PlanCode;

    if (
      (INTERNSHIP_PLAN_CODES as readonly string[]).includes(nextPlanCode)
    ) {
      const conflict = await findConflict(nextDomain, nextPlanCode, id);

      if (conflict) {
        return failure(
          "An internship with this domain and plan already exists.",
          "DUPLICATE_DOMAIN_PLAN",
          409,
        );
      }
    }

    update.updatedBy = creatorId(auth.user);

    const updated = await Internship.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { new: true, runValidators: true, context: "query" },
    )
      .lean()
      .exec();

    if (!updated) {
      return failure("Internship not found.", "NOT_FOUND", 404);
    }

    return success("Internship updated successfully.", {
      internship: serialize(updated),
      data: serialize(updated),
    });
  } catch (error) {
    return handleError(error, "Unable to update internship.", "UPDATE_FAILED");
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!verifyOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.result;

    const id = text(
      request.nextUrl.searchParams.get("id"),
      text(
        request.nextUrl.searchParams.get("_id"),
        text(request.nextUrl.searchParams.get("internshipId")),
      ),
    );

    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError("Valid internship ID is required.", "INVALID_ID");
    }

    const internship = await Internship.findById(id).exec();

    if (!internship) {
      return failure("Internship not found.", "NOT_FOUND", 404);
    }

    const hasActivity =
      numberValue(internship.applications) > 0 ||
      numberValue(internship.applicants) > 0 ||
      numberValue(internship.enrolledStudents) > 0;

    if (hasActivity) {
      const closed = await Internship.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(id),
          applications: internship.applications,
          applicants: internship.applicants,
          enrolledStudents: internship.enrolledStudents,
        },
        {
          $set: {
            status: "closed",
            isPublic: false,
            isSelectable: false,
            updatedBy: creatorId(auth.user),
          },
        },
        { new: true, runValidators: true },
      )
        .lean()
        .exec();

      if (!closed) {
        return failure(
          "Internship changed during deletion. Refresh and retry.",
          "DELETE_CONFLICT",
          409,
        );
      }

      return success(
        "Internship closed to preserve student and payment history.",
        {
          deleted: false,
          closed: true,
          internship: serialize(closed),
        },
      );
    }

    const deleted = await Internship.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      applications: { $in: [0, null] },
      applicants: { $in: [0, null] },
      enrolledStudents: { $in: [0, null] },
    }).exec();

    if (!deleted) {
      return failure(
        "Internship activity changed. Refresh and retry.",
        "DELETE_CONFLICT",
        409,
      );
    }

    return success("Internship deleted successfully.", {
      deleted: true,
      closed: false,
      id,
    });
  } catch (error) {
    return handleError(error, "Unable to delete internship.", "DELETE_FAILED");
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}