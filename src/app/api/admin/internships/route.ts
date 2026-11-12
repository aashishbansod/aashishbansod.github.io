import { NextRequest, NextResponse } from "next/server";
import mongoose, { type SortOrder } from "mongoose";
import connectDB from "@/lib/db";
import Admin from "@/models/Admin";
import Internship, {
  INTERNSHIP_DURATIONS,
  INTERNSHIP_MODES,
  INTERNSHIP_PLAN_CODES,
} from "@/models/Internship";
import {
  ADMIN_AUTH_COOKIE_NAME,
  verifyAuthToken,
  type AuthUser,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SEARCH_LENGTH = 100;
const MAX_TEXT_LENGTH = 5000;

type RecordValue = Record<string, unknown>;
type InternshipStatus = "active" | "inactive" | "draft" | "closed";
type PlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";
type Duration = "1 Month" | "3 Months" | "6 Months";
type Mode = "Remote" | "Hybrid" | "On-site";

class RouteError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

const PLAN_CONFIG: Record<
  PlanCode,
  { duration: Duration; durationMonths: 1 | 3 | 6; price: number; sortOrder: 1 | 2 | 3 }
> = {
  ONE_MONTH: { duration: "1 Month", durationMonths: 1, price: 499, sortOrder: 1 },
  THREE_MONTHS: { duration: "3 Months", durationMonths: 3, price: 999, sortOrder: 2 },
  SIX_MONTHS: { duration: "6 Months", durationMonths: 6, price: 1699, sortOrder: 3 },
};

const PLAN_BY_DURATION: Record<Duration, PlanCode> = {
  "1 Month": "ONE_MONTH",
  "3 Months": "THREE_MONTHS",
  "6 Months": "SIX_MONTHS",
};

const MUTABLE_FIELDS = new Set([
  "title",
  "name",
  "description",
  "domain",
  "assessmentDomain",
  "assessmentRequired",
  "applicationRequired",
  "sortOrder",
  "stipend",
  "location",
  "skills",
  "technologies",
  "requirements",
  "responsibilities",
  "eligibility",
  "maxStudents",
  "featured",
  "certificateEligible",
  "tags",
  "notes",
  "startDate",
  "endDate",
  "mode",
  "status",
  "isPublic",
  "isSelectable",
  "planCode",
  "duration",
]);

function json(body: unknown, status = 200): NextResponse {
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

function success(message: string, data: RecordValue, status = 200) {
  return json({ success: true, message, data }, status);
}

function failure(
  message: string,
  code: string,
  status = 400,
  extra: RecordValue = {},
) {
  return json({ success: false, message, code, ...extra }, status);
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
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

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function parseStatus(
  value: unknown,
  fallback: InternshipStatus = "draft",
): InternshipStatus {
  const candidate = text(value, fallback).toLowerCase();
  if (["active", "inactive", "draft", "closed"].includes(candidate)) {
    return candidate as InternshipStatus;
  }
  throw new RouteError(
    "Status must be active, inactive, draft, or closed.",
    "INVALID_STATUS",
  );
}

function parsePlan(planValue: unknown, durationValue: unknown) {
  const rawPlan = text(planValue).toUpperCase();
  const rawDuration = text(durationValue) as Duration;

  let planCode: PlanCode | undefined;

  if (rawPlan) {
    if (!(INTERNSHIP_PLAN_CODES as readonly string[]).includes(rawPlan)) {
      throw new RouteError("Choose a valid internship plan.", "INVALID_PLAN");
    }
    planCode = rawPlan as PlanCode;
  } else if ((INTERNSHIP_DURATIONS as readonly string[]).includes(rawDuration)) {
    planCode = PLAN_BY_DURATION[rawDuration];
  }

  if (!planCode || !PLAN_CONFIG[planCode]) {
    throw new RouteError(
      "Choose a valid internship plan: 1 Month, 3 Months, or 6 Months.",
      "INVALID_PLAN",
    );
  }

  return { planCode, ...PLAN_CONFIG[planCode] };
}

function parseDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    throw new RouteError(`${field} must be a valid date.`, "INVALID_DATE");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RouteError(`${field} must be a valid date.`, "INVALID_DATE");
  }
  return date;
}

function validateDateRange(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new RouteError(
      "End date cannot be earlier than start date.",
      "INVALID_DATE_RANGE",
    );
  }
}

function stringArray(value: unknown, field: string): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  if (values.length > 100) {
    throw new RouteError(
      `${field} cannot contain more than 100 items.`,
      "ARRAY_TOO_LARGE",
    );
  }

  const normalized = values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 200))
    .filter(Boolean);

  return [...new Set(normalized)];
}

function parseMode(value: unknown): Mode {
  const mode = text(value, "Remote");
  if (!(INTERNSHIP_MODES as readonly string[]).includes(mode)) {
    throw new RouteError(
      "Mode must be Remote, Hybrid, or On-site.",
      "INVALID_MODE",
    );
  }
  return mode as Mode;
}

function serialize(document: unknown): RecordValue | null {
  if (!document || !isRecord(document)) return null;

  const raw = document;
  const id = String(raw._id ?? raw.id ?? "");
  const title = text(raw.title, text(raw.name));
  const rawPlan = text(raw.planCode).toUpperCase();
  const rawDuration = text(raw.duration) as Duration;

  const planCode = (INTERNSHIP_PLAN_CODES as readonly string[]).includes(rawPlan)
    ? (rawPlan as PlanCode)
    : (INTERNSHIP_DURATIONS as readonly string[]).includes(rawDuration)
      ? PLAN_BY_DURATION[rawDuration]
      : null;

  const plan = planCode ? PLAN_CONFIG[planCode] : null;
  const price = plan?.price ?? numberValue(raw.price);

  return {
    ...raw,
    _id: id,
    id,
    title,
    name: text(raw.name, title),
    domain: text(raw.domain),
    assessmentDomain: text(raw.assessmentDomain, text(raw.domain)),
    planCode,
    duration: plan?.duration ?? raw.duration ?? "",
    durationMonths: plan?.durationMonths ?? numberValue(raw.durationMonths),
    price,
    priceInPaise: plan
      ? plan.price * 100
      : numberValue(raw.priceInPaise, Math.round(price * 100)),
    currency: "INR",
    status: ["active", "inactive", "draft", "closed"].includes(text(raw.status))
      ? text(raw.status)
      : "draft",
    isPublic: raw.isPublic === true,
    isSelectable: raw.isSelectable === true,
    applications: Math.max(0, Math.floor(numberValue(raw.applications))),
    applicants: Math.max(0, Math.floor(numberValue(raw.applicants))),
    enrolledStudents: Math.max(0, Math.floor(numberValue(raw.enrolledStudents))),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

async function authenticateAdmin(
  request: NextRequest,
): Promise<
  | { ok: true; user: AuthUser; role: string }
  | { ok: false; response: NextResponse }
> {
  const token = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return {
      ok: false,
      response: failure("Authentication required.", "UNAUTHENTICATED", 401),
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
    user.role !== "admin" ||
    user.sessionType !== "admin" ||
    !user.adminRole ||
    !mongoose.isValidObjectId(user.id)
  ) {
    return {
      ok: false,
      response: failure(
        "Admin session is invalid or expired.",
        "INVALID_SESSION",
        401,
      ),
    };
  }

  await connectDB();

  const adminDoc = await Admin.findById(user.id)
    .select(
      "_id role isActive isEmailVerified permissions security.accountLocked security.lockedUntil",
    )
    .lean()
    .exec();

  if (!adminDoc) {
    return {
      ok: false,
      response: failure("Admin account was not found.", "ADMIN_NOT_FOUND", 401),
    };
  }

  const admin = adminDoc as unknown as RecordValue;
  const security = isRecord(admin.security) ? admin.security : {};
  const permissions = isRecord(admin.permissions) ? admin.permissions : {};
  const lockedUntilValue = security.lockedUntil;
  const lockedUntil = lockedUntilValue
    ? new Date(String(lockedUntilValue)).getTime()
    : 0;

  if (
    admin.isActive !== true ||
    admin.isEmailVerified !== true ||
    security.accountLocked === true ||
    (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) ||
    text(admin.role) !== user.adminRole
  ) {
    return {
      ok: false,
      response: failure(
        "Admin account is inactive, unverified, locked, or has changed role.",
        "ADMIN_ACCESS_REVOKED",
        403,
      ),
    };
  }

  if (user.adminRole !== "Super Admin" && permissions.internships !== true) {
    return {
      ok: false,
      response: failure(
        "You do not have permission to manage internships.",
        "INSUFFICIENT_PERMISSION",
        403,
      ),
    };
  }

  return { ok: true, user, role: user.adminRole };
}

function verifyMutationOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return false;

  try {
    const expected = request.nextUrl.origin;
    if (origin && new URL(origin).origin !== expected) return false;
    if (referer && new URL(referer).origin !== expected) return false;
    return true;
  } catch {
    return false;
  }
}

async function readBody(request: NextRequest): Promise<RecordValue> {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new RouteError("Request body is too large.", "BODY_TOO_LARGE", 413);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RouteError(
      "Content-Type must be application/json.",
      "INVALID_CONTENT_TYPE",
      415,
    );
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new RouteError("Request body is too large.", "BODY_TOO_LARGE", 413);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RouteError("Request body must be valid JSON.", "INVALID_JSON");
  }

  if (!isRecord(parsed)) {
    throw new RouteError("Request body must be a JSON object.", "INVALID_BODY");
  }

  return parsed;
}

function creatorId(user: AuthUser): mongoose.Types.ObjectId | null {
  return mongoose.isValidObjectId(user.id)
    ? new mongoose.Types.ObjectId(user.id)
    : null;
}

function buildCreateData(
  body: RecordValue,
  user: AuthUser,
  durationOverride?: Duration,
): RecordValue {
  const title = text(body.title, text(body.name));
  const domain = text(body.domain);

  if (title.length < 3 || title.length > 200) {
    throw new RouteError(
      "Title must contain 3–200 characters.",
      "INVALID_TITLE",
    );
  }

  if (!domain || domain.length > 150) {
    throw new RouteError("A valid internship domain is required.", "INVALID_DOMAIN");
  }

  const plan = parsePlan(
    durationOverride ? undefined : body.planCode,
    durationOverride ?? body.duration,
  );
  const status = parseStatus(body.status, "draft");
  const isPublic = status === "active" && booleanValue(body.isPublic, true);
  const isSelectable =
    status === "active" && isPublic && booleanValue(body.isSelectable, true);
  const mode = parseMode(body.mode);
  const startDate = parseDate(body.startDate, "startDate");
  const endDate = parseDate(body.endDate, "endDate");
  validateDateRange(startDate, endDate);

  const maxStudents = numberValue(body.maxStudents);
  if (
    !Number.isInteger(maxStudents) ||
    maxStudents < 0 ||
    maxStudents > 1_000_000
  ) {
    throw new RouteError(
      "Maximum students must be a non-negative integer.",
      "INVALID_CAPACITY",
    );
  }

  const sortOrder = numberValue(body.sortOrder, plan.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 100) {
    throw new RouteError(
      "Sort order must be an integer from 1 to 100.",
      "INVALID_SORT_ORDER",
    );
  }

  return {
    title,
    name: title,
    description: text(body.description).slice(0, MAX_TEXT_LENGTH),
    domain,
    assessmentDomain: text(body.assessmentDomain, domain).slice(0, 150),
    assessmentRequired: booleanValue(body.assessmentRequired, true),
    applicationRequired: booleanValue(body.applicationRequired, true),
    planCode: plan.planCode,
    duration: plan.duration,
    durationMonths: plan.durationMonths,
    sortOrder,
    price: plan.price,
    priceInPaise: plan.price * 100,
    currency: "INR",
    stipend: text(body.stipend).slice(0, 200),
    mode,
    location: text(body.location, mode === "Remote" ? "Remote" : "").slice(0, 200),
    skills: stringArray(body.skills, "skills"),
    technologies: stringArray(body.technologies, "technologies"),
    requirements: stringArray(body.requirements, "requirements"),
    responsibilities: stringArray(body.responsibilities, "responsibilities"),
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
    tags: stringArray(body.tags, "tags"),
    startDate,
    endDate,
    createdBy: creatorId(user),
    notes: text(body.notes).slice(0, 3000),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return isRecord(error) && Number(error.code) === 11000;
}

function handleError(
  error: unknown,
  fallback: string,
  code: string,
): NextResponse {
  if (error instanceof RouteError) {
    return failure(error.message, error.code, error.status);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return failure("Internship validation failed.", "VALIDATION_ERROR", 422, {
      errors: Object.values(error.errors).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }

  if (isDuplicateKeyError(error)) {
    return failure(
      "An internship with this domain and plan already exists.",
      "DUPLICATE_DOMAIN_PLAN",
      409,
    );
  }

  console.error(`[${code}]`, error);
  return failure(fallback, code, 500);
}

async function findDomainPlanConflict(
  domain: string,
  planCode: PlanCode,
  excludedId?: string,
) {
  const filter: RecordValue = {
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
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;

    const params = request.nextUrl.searchParams;
    const requestedPage = parsePositiveInteger(params.get("page"), 1, 100_000);
    const limit = parsePositiveInteger(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const search = text(params.get("search") ?? params.get("q")).slice(
      0,
      MAX_SEARCH_LENGTH,
    );
    const statusParam = text(params.get("status")).toLowerCase();
    const domain = text(params.get("domain")).slice(0, 150);
    const planParam = text(params.get("planCode")).toUpperCase();

    const filter: RecordValue = {};

    if (statusParam && statusParam !== "all") {
      if (!["active", "inactive", "draft", "closed"].includes(statusParam)) {
        return failure(
          "Unsupported internship status filter.",
          "INVALID_STATUS_FILTER",
          400,
        );
      }
      filter.status = statusParam;
    }

    if (domain) {
      filter.domain = { $regex: escapeRegex(domain), $options: "i" };
    }

    if (planParam) {
      if (!(INTERNSHIP_PLAN_CODES as readonly string[]).includes(planParam)) {
        return failure(
          "Unsupported internship plan filter.",
          "INVALID_PLAN_FILTER",
          400,
        );
      }
      filter.planCode = planParam;
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

    const sortParam = text(params.get("sort"), "newest");
    const sortBy: Record<string, SortOrder> =
      sortParam === "oldest"
        ? { createdAt: 1, _id: 1 }
        : sortParam === "title"
          ? { title: 1, _id: 1 }
          : { createdAt: -1, _id: -1 };

    const [total, statusRows, domainRows, totalsRows] = await Promise.all([
      Internship.countDocuments(filter).exec(),
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
            totalApplications: { $sum: { $ifNull: ["$applications", 0] } },
            totalApplicants: { $sum: { $ifNull: ["$applicants", 0] } },
            totalEnrolled: { $sum: { $ifNull: ["$enrolledStudents", 0] } },
          },
        },
      ]).exec(),
    ]);

    const totalPages = total ? Math.ceil(total / limit) : 0;
    const page = totalPages ? Math.min(requestedPage, totalPages) : 1;

    const documents = await Internship.find(filter)
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const internships = documents
      .map(serialize)
      .filter((item): item is RecordValue => item !== null);

    const statusCounts: Record<InternshipStatus, number> = {
      active: 0,
      inactive: 0,
      draft: 0,
      closed: 0,
    };

    for (const row of statusRows as Array<{ _id?: unknown; count?: unknown }>) {
      const key = text(row._id) as InternshipStatus;
      if (Object.prototype.hasOwnProperty.call(statusCounts, key)) {
        statusCounts[key] = numberValue(row.count);
      }
    }

    const totals = (totalsRows as Array<RecordValue>)[0] ?? {};
    const domains = (
      domainRows as Array<{ _id?: unknown; count?: unknown }>
    )
      .map((row) => ({
        domain: text(row._id),
        count: numberValue(row.count),
      }))
      .filter((row) => row.domain);

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
      active: statusCounts.active,
      inactive: statusCounts.inactive,
      draft: statusCounts.draft,
      closed: statusCounts.closed,
      applications: numberValue(totals.totalApplications),
      applicants: numberValue(totals.totalApplicants),
      enrolled: numberValue(totals.totalEnrolled),
    };

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
    return handleError(error, "Unable to fetch internships.", "INTERNSHIPS_FETCH_FAILED");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyMutationOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;

    if (!["Super Admin", "Admin"].includes(auth.role)) {
      return failure("Your admin role cannot create internships.", "FORBIDDEN", 403);
    }

    const body = await readBody(request);
    const domain = text(body.domain);

    if (!domain || domain.length > 150) {
      throw new RouteError("A valid internship domain is required.", "INVALID_DOMAIN");
    }

    const createAllPlans = body.createAllPlans === true;
    const durations: Duration[] = createAllPlans
      ? ["1 Month", "3 Months", "6 Months"]
      : [parsePlan(body.planCode, body.duration).duration];

    const requestedPlans = durations.map((duration) =>
      parsePlan(undefined, duration),
    );
    const planCodes = requestedPlans.map((plan) => plan.planCode);

    if (new Set(planCodes).size !== planCodes.length) {
      throw new RouteError(
        "Duplicate plans were requested.",
        "DUPLICATE_REQUESTED_PLAN",
      );
    }

    const existing = await Internship.find({
      domain: { $regex: `^${escapeRegex(domain)}$`, $options: "i" },
      planCode: { $in: planCodes },
    })
      .select("planCode")
      .lean()
      .exec();

    const existingPlans = new Set(
      existing.map((item) => text(item.planCode).toUpperCase()),
    );
    const duplicatePlan = requestedPlans.find((plan) =>
      existingPlans.has(plan.planCode),
    );

    if (duplicatePlan) {
      return failure(
        `A ${duplicatePlan.duration} internship plan already exists for ${domain}.`,
        "DUPLICATE_DOMAIN_PLAN",
        409,
      );
    }

    const createdIds: mongoose.Types.ObjectId[] = [];

    try {
      for (const duration of durations) {
        const data = buildCreateData(body, auth.user, duration);
        const created = await Internship.create(data);
        createdIds.push(created._id as mongoose.Types.ObjectId);
      }
    } catch (createError) {
      if (createdIds.length) {
        await Internship.deleteMany({ _id: { $in: createdIds } }).exec();
      }
      throw createError;
    }

    const createdDocuments = await Internship.find({ _id: { $in: createdIds } })
      .sort({ durationMonths: 1 })
      .lean()
      .exec();

    const internships = createdDocuments
      .map(serialize)
      .filter((item): item is RecordValue => item !== null);

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
    return handleError(error, "Unable to create internship.", "INTERNSHIP_CREATE_FAILED");
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return updateInternship(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return updateInternship(request);
}

async function updateInternship(request: NextRequest): Promise<NextResponse> {
  if (!verifyMutationOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;

    if (!["Super Admin", "Admin"].includes(auth.role)) {
      return failure("Your admin role cannot modify internships.", "FORBIDDEN", 403);
    }

    const body = await readBody(request);
    const id = text(body.id, text(body._id, text(body.internshipId)));

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError("A valid internship ID is required.", "INVALID_INTERNSHIP_ID");
    }

    const existing = await Internship.findById(id).exec();

    if (!existing) {
      return failure("Internship not found.", "INTERNSHIP_NOT_FOUND", 404);
    }

    const update: RecordValue = {};

    for (const [field, value] of Object.entries(body)) {
      if (["id", "_id", "internshipId", "action"].includes(field)) continue;
      if (!MUTABLE_FIELDS.has(field)) continue;

      switch (field) {
        case "title":
        case "name": {
          const title = text(value);
          if (title.length < 3 || title.length > 200) {
            throw new RouteError(
              "Title must contain 3–200 characters.",
              "INVALID_TITLE",
            );
          }
          update.title = title;
          update.name = title;
          break;
        }
        case "domain": {
          const domain = text(value);
          if (!domain || domain.length > 150) {
            throw new RouteError(
              "A valid internship domain is required.",
              "INVALID_DOMAIN",
            );
          }
          update.domain = domain;
          if (
            body.assessmentDomain === undefined &&
            (!text(existing.assessmentDomain) ||
              text(existing.assessmentDomain).toLowerCase() ===
                text(existing.domain).toLowerCase())
          ) {
            update.assessmentDomain = domain;
          }
          break;
        }
        case "assessmentDomain":
          update.assessmentDomain = text(value).slice(0, 150);
          break;
        case "description":
          update.description = text(value).slice(0, MAX_TEXT_LENGTH);
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
            throw new RouteError(`${field} must be true or false.`, "INVALID_BOOLEAN");
          }
          update[field] = value;
          break;
        case "skills":
        case "technologies":
        case "requirements":
        case "responsibilities":
        case "tags":
          update[field] = stringArray(value, field);
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
          update.priceInPaise = plan.price * 100;
          update.currency = "INR";
          break;
        }
        case "sortOrder": {
          const valueNumber = numberValue(value, Number.NaN);
          if (!Number.isInteger(valueNumber) || valueNumber < 1 || valueNumber > 100) {
            throw new RouteError(
              "Sort order must be an integer from 1 to 100.",
              "INVALID_SORT_ORDER",
            );
          }
          update.sortOrder = valueNumber;
          break;
        }
        case "maxStudents": {
          const valueNumber = numberValue(value, Number.NaN);
          if (
            !Number.isInteger(valueNumber) ||
            valueNumber < 0 ||
            valueNumber > 1_000_000
          ) {
            throw new RouteError(
              "Maximum students must be a non-negative integer.",
              "INVALID_CAPACITY",
            );
          }
          update.maxStudents = valueNumber;
          break;
        }
      }
    }

    const action = text(body.action).toLowerCase();

    if (action) {
      const actions: Record<string, InternshipStatus> = {
        activate: "active",
        deactivate: "inactive",
        draft: "draft",
        close: "closed",
      };
      const nextStatus = actions[action];

      if (!nextStatus) {
        throw new RouteError("Unsupported internship action.", "INVALID_ACTION");
      }

      update.status = nextStatus;
      update.isPublic = nextStatus === "active";
      update.isSelectable = nextStatus === "active";
    }

    if (Object.keys(update).length === 0) {
      throw new RouteError(
        "No supported fields were supplied for update.",
        "NO_UPDATE_FIELDS",
      );
    }

    const nextStatus = (update.status ?? existing.status) as InternshipStatus;
    const nextPublic =
      update.isPublic === undefined
        ? existing.isPublic === true
        : update.isPublic === true;
    const requestedSelectable =
      update.isSelectable === undefined
        ? existing.isSelectable === true
        : update.isSelectable === true;

    update.isSelectable =
      nextStatus === "active" && nextPublic && requestedSelectable;

    if (nextStatus !== "active") {
      update.isPublic = false;
    }

    const nextStart =
      update.startDate === undefined ? existing.startDate : update.startDate;
    const nextEnd =
      update.endDate === undefined ? existing.endDate : update.endDate;

    validateDateRange(
      nextStart instanceof Date
        ? nextStart
        : nextStart
          ? new Date(String(nextStart))
          : null,
      nextEnd instanceof Date
        ? nextEnd
        : nextEnd
          ? new Date(String(nextEnd))
          : null,
    );

    const resultingDomain = text(update.domain, text(existing.domain));
    const resultingPlan = text(
      update.planCode,
      text(existing.planCode),
    ).toUpperCase();

    if ((INTERNSHIP_PLAN_CODES as readonly string[]).includes(resultingPlan)) {
      const duplicate = await findDomainPlanConflict(
        resultingDomain,
        resultingPlan as PlanCode,
        id,
      );

      if (duplicate) {
        return failure(
          "An internship with the same domain and plan already exists.",
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
    ).exec();

    if (!updated) {
      return failure("Internship not found.", "INTERNSHIP_NOT_FOUND", 404);
    }

    const serialized = serialize(updated);

    return success("Internship updated successfully.", {
      internship: serialized,
      data: serialized,
    });
  } catch (error) {
    return handleError(error, "Unable to update internship.", "INTERNSHIP_UPDATE_FAILED");
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!verifyMutationOrigin(request)) {
    return failure("Request origin could not be verified.", "INVALID_ORIGIN", 403);
  }

  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;

    if (auth.role !== "Super Admin") {
      return failure(
        "Only Super Admin can delete or close internship plans.",
        "FORBIDDEN",
        403,
      );
    }

    const id = text(
      request.nextUrl.searchParams.get("id"),
      text(
        request.nextUrl.searchParams.get("_id"),
        text(request.nextUrl.searchParams.get("internshipId")),
      ),
    );

    if (!mongoose.isValidObjectId(id)) {
      throw new RouteError("A valid internship ID is required.", "INVALID_INTERNSHIP_ID");
    }

    const internship = await Internship.findById(id).exec();

    if (!internship) {
      return failure("Internship not found.", "INTERNSHIP_NOT_FOUND", 404);
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
      ).exec();

      if (!closed) {
        return failure(
          "Internship changed while processing. Refresh and try again.",
          "DELETE_CONFLICT",
          409,
        );
      }

      return success(
        "This internship has activity, so it was closed to preserve student and payment history.",
        { deleted: false, closed: true, internship: serialize(closed) },
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
        "Internship activity changed before deletion. Refresh and try again.",
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
    return handleError(error, "Unable to delete internship.", "INTERNSHIP_DELETE_FAILED");
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
