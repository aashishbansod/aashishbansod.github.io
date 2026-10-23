import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose, { type SortOrder } from "mongoose";

import connectDB from "@/lib/db";
import Internship, {
  INTERNSHIP_DURATIONS,
  INTERNSHIP_MODES,
  INTERNSHIP_PLAN_CODES,
} from "@/models/Internship";
import { verifyAuthToken, type AuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUTH_COOKIE_NAME = "cybernet_auth_token";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_BODY_BYTES = 64 * 1024;

type InternshipStatus = "active" | "inactive" | "draft" | "closed";
type PlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";
type Duration = "1 Month" | "3 Months" | "6 Months";
type Mode = "Remote" | "Hybrid" | "On-site";
type RecordValue = Record<string, unknown>;

class InputError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) {
    super(message);
    this.name = "InputError";
  }
}

function respond(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function success(message: string, data: unknown, status = 200): NextResponse {
  return respond({ success: true, message, data }, status);
}

function failure(message: string, code: string, status = 400, extra: RecordValue = {}): NextResponse {
  return respond({ success: false, message, code, ...extra }, status);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numeric(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true" || value === "yes") return true;
  if (value === 0 || value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stringArray(value: unknown, maxItems = 100): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 200))
    .filter(Boolean))].slice(0, maxItems);
}

function parseDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    throw new InputError(`${field} must be a valid date.`, "INVALID_DATE");
  }
  const result = new Date(value instanceof Date ? value.getTime() : value);
  if (Number.isNaN(result.getTime())) throw new InputError(`${field} must be a valid date.`, "INVALID_DATE");
  return result;
}

function validateDateRange(startDate: Date | null, endDate: Date | null): void {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new InputError("End date cannot be earlier than start date.", "INVALID_DATE_RANGE");
  }
}

function parseStatus(value: unknown, fallback: InternshipStatus = "draft"): InternshipStatus {
  const status = text(value, fallback).toLowerCase();
  if (["active", "inactive", "draft", "closed"].includes(status)) return status as InternshipStatus;
  throw new InputError("Status must be active, inactive, draft, or closed.", "INVALID_STATUS");
}

function parsePlan(value: unknown, durationValue: unknown): { planCode: PlanCode; duration: Duration; durationMonths: number } {
  const planMap: Record<PlanCode, { duration: Duration; durationMonths: number }> = {
    ONE_MONTH: { duration: "1 Month", durationMonths: 1 },
    THREE_MONTHS: { duration: "3 Months", durationMonths: 3 },
    SIX_MONTHS: { duration: "6 Months", durationMonths: 6 },
  };
  const durationToPlan: Record<Duration, PlanCode> = {
    "1 Month": "ONE_MONTH",
    "3 Months": "THREE_MONTHS",
    "6 Months": "SIX_MONTHS",
  };
  const rawPlan = text(value).toUpperCase();
  const rawDuration = text(durationValue) as Duration;
  const plan = (INTERNSHIP_PLAN_CODES as readonly string[]).includes(rawPlan)
    ? rawPlan as PlanCode
    : durationToPlan[rawDuration];
  if (!plan || !planMap[plan]) {
    throw new InputError("Choose a valid internship plan: 1 Month, 3 Months, or 6 Months.", "INVALID_PLAN");
  }
  return { planCode: plan, ...planMap[plan] };
}

/** Trusted server-side pricing. Never use a price supplied by the browser. */
function priceForPlan(plan: PlanCode): number {
  switch (plan) {
    case "ONE_MONTH": return 499;
    case "THREE_MONTHS": return 999;
    case "SIX_MONTHS": return 1699;
  }
}

function toPlain(value: unknown): RecordValue {
  if (!value || typeof value !== "object") return {};
  const candidate = value as { toObject?: () => RecordValue };
  return typeof candidate.toObject === "function" ? candidate.toObject() : value as RecordValue;
}

function parseStatusSafe(value: unknown): InternshipStatus {
  const candidate = text(value, "draft").toLowerCase();
  return ["active", "inactive", "draft", "closed"].includes(candidate) ? candidate as InternshipStatus : "draft";
}

function serialize(document: unknown): RecordValue | null {
  if (!document) return null;
  const item = toPlain(document);
  const id = String(item._id ?? item.id ?? "");
  const title = text(item.title, text(item.name));
  const candidatePlan = text(item.planCode).toUpperCase() as PlanCode;
  const candidateDuration = text(item.duration) as Duration;
  const planFromDuration = (INTERNSHIP_DURATIONS as readonly string[]).includes(candidateDuration)
    ? parsePlan(undefined, candidateDuration).planCode
    : undefined;
  const planCode = (INTERNSHIP_PLAN_CODES as readonly string[]).includes(candidatePlan) ? candidatePlan : planFromDuration;
  const duration = (INTERNSHIP_DURATIONS as readonly string[]).includes(candidateDuration)
    ? candidateDuration
    : planCode ? parsePlan(planCode, undefined).duration : "";
  const price = typeof item.price === "number" ? item.price : planCode ? priceForPlan(planCode) : numeric(item.price);
  return {
    ...item,
    _id: id,
    id,
    title,
    name: text(item.name, title),
    domain: text(item.domain),
    assessmentDomain: text(item.assessmentDomain, text(item.domain)),
    planCode: planCode ?? null,
    duration,
    durationMonths: numeric(item.durationMonths, planCode ? parsePlan(planCode, undefined).durationMonths : 0) || null,
    price,
    priceInPaise: numeric(item.priceInPaise, Math.round(price * 100)),
    currency: text(item.currency, "INR"),
    status: parseStatusSafe(item.status),
    isPublic: bool(item.isPublic, false),
    isSelectable: bool(item.isSelectable, false),
    applications: Math.max(0, Math.floor(numeric(item.applications))),
    applicants: Math.max(0, Math.floor(numeric(item.applicants))),
    enrolledStudents: Math.max(0, Math.floor(numeric(item.enrolledStudents))),
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
  };
}

async function requireAdmin(): Promise<{ ok: true; user: AuthUser } | { ok: false; response: NextResponse }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return { ok: false, response: failure("Authentication required.", "UNAUTHENTICATED", 401) };

  let user: AuthUser | null = null;
  try {
    user = await verifyAuthToken(token) as AuthUser;
  } catch {
    user = null;
  }
  if (!user) return { ok: false, response: failure("Session is invalid or expired. Please sign in again.", "INVALID_SESSION", 401) };

  const role = text((user as unknown as RecordValue).role).toLowerCase().replace(/[\s_-]+/g, "");
  if (!["admin", "superadmin", "mainadmin", "owner"].includes(role)) {
    return { ok: false, response: failure("Admin access is required.", "FORBIDDEN", 403) };
  }
  return { ok: true, user };
}

async function readBody(request: Request): Promise<RecordValue> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new InputError("Request body is too large.", "BODY_TOO_LARGE", 413);
  }
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new InputError("Request body must be valid JSON.", "INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InputError("Request body must be a JSON object.", "INVALID_REQUEST_BODY");
  }
  return parsed as RecordValue;
}

function creatorId(user: AuthUser): mongoose.Types.ObjectId | undefined {
  const record = user as unknown as RecordValue;
  const candidate = text(record.id, text(record._id));
  return mongoose.Types.ObjectId.isValid(candidate) ? new mongoose.Types.ObjectId(candidate) : undefined;
}

function buildCreateData(body: RecordValue, user: AuthUser, planOverride?: Duration): RecordValue {
  const title = text(body.title, text(body.name));
  const domain = text(body.domain);
  if (title.length < 3 || title.length > 200) throw new InputError("Title must contain 3–200 characters.", "TITLE_REQUIRED");
  if (!domain || domain.length > 150) throw new InputError("A valid internship domain is required.", "DOMAIN_REQUIRED");

  const plan = parsePlan(planOverride ? undefined : body.planCode, planOverride ?? body.duration);
  const status = parseStatus(body.status, "draft");
  const isPublic = bool(body.isPublic, status === "active");
  const isSelectable = status === "active" && isPublic && bool(body.isSelectable, true);
  const modeValue = text(body.mode, "Remote");
  if (!(INTERNSHIP_MODES as readonly string[]).includes(modeValue)) {
    throw new InputError("Mode must be Remote, Hybrid, or On-site.", "INVALID_MODE");
  }
  const price = priceForPlan(plan.planCode);
  const startDate = parseDate(body.startDate, "startDate");
  const endDate = parseDate(body.endDate, "endDate");
  validateDateRange(startDate, endDate);

  return {
    title,
    name: title,
    description: text(body.description).slice(0, 5000),
    domain,
    assessmentDomain: text(body.assessmentDomain, domain).slice(0, 150),
    assessmentRequired: bool(body.assessmentRequired, true),
    applicationRequired: bool(body.applicationRequired, true),
    planCode: plan.planCode,
    duration: plan.duration,
    durationMonths: plan.durationMonths,
    sortOrder: Math.max(1, Math.min(100, Math.floor(numeric(body.sortOrder, 1) || 1))),
    price,
    priceInPaise: price * 100,
    currency: "INR",
    stipend: text(body.stipend).slice(0, 200),
    mode: modeValue as Mode,
    location: text(body.location, modeValue === "Remote" ? "Remote" : "").slice(0, 200),
    skills: stringArray(body.skills),
    technologies: stringArray(body.technologies),
    requirements: stringArray(body.requirements),
    responsibilities: stringArray(body.responsibilities),
    eligibility: text(body.eligibility).slice(0, 3000),
    maxStudents: Math.max(0, Math.floor(numeric(body.maxStudents))),
    enrolledStudents: 0,
    applications: 0,
    applicants: 0,
    status,
    isPublic,
    isSelectable,
    featured: bool(body.featured, false),
    certificateEligible: bool(body.certificateEligible, true),
    tags: stringArray(body.tags),
    startDate,
    endDate,
    createdBy: creatorId(user) ?? null,
    notes: text(body.notes).slice(0, 3000),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: unknown }).code === 11000;
}

function validationResponse(error: mongoose.Error.ValidationError): NextResponse {
  const details = Object.values(error.errors).map((entry) => ({ field: entry.path, message: entry.message }));
  return failure("Internship validation failed.", "VALIDATION_ERROR", 422, { errors: details });
}

function errorFrom(error: unknown, fallbackMessage: string, fallbackCode: string): NextResponse {
  if (error instanceof InputError) return failure(error.message, error.code, error.status);
  if (error instanceof mongoose.Error.ValidationError) return validationResponse(error);
  if (isDuplicateKeyError(error)) {
    return failure("An internship with the same domain and plan or unique ID already exists.", "DUPLICATE_DOMAIN_PLAN", 409);
  }
  console.error(`[${fallbackCode}]`, error);
  return failure(fallbackMessage, fallbackCode, 500);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    await connectDB();
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Math.min(10_000, Math.floor(numeric(params.get("page"), 1))));
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(numeric(params.get("limit"), DEFAULT_LIMIT))));
    const search = text(params.get("search") ?? params.get("q")).slice(0, 100);
    const statusParam = text(params.get("status")).toLowerCase();
    const domain = text(params.get("domain")).slice(0, 150);
    const planCode = text(params.get("planCode")).toUpperCase();
    const filter: Record<string, unknown> = {};

    if (["active", "inactive", "draft", "closed"].includes(statusParam)) filter.status = statusParam;
    if (domain) filter.domain = { $regex: escapeRegex(domain), $options: "i" };
    if ((INTERNSHIP_PLAN_CODES as readonly string[]).includes(planCode)) filter.planCode = planCode;
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { name: { $regex: escaped, $options: "i" } },
        { domain: { $regex: escaped, $options: "i" } },
        { assessmentDomain: { $regex: escaped, $options: "i" } },
        { internshipId: { $regex: escaped, $options: "i" } },
      ];
    }

    const sortParam = text(params.get("sort"), "newest");
    const sortBy: Record<string, SortOrder> = sortParam === "oldest"
      ? { createdAt: 1 }
      : sortParam === "title" ? { title: 1 } : { createdAt: -1 };

    const [documents, total, statusRows, domainRows, totalsRows] = await Promise.all([
      Internship.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit).lean().exec(),
      Internship.countDocuments(filter).exec(),
      Internship.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).exec(),
      Internship.aggregate([{ $group: { _id: "$domain", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 50 }]).exec(),
      Internship.aggregate([{ $group: {
        _id: null,
        totalApplications: { $sum: { $ifNull: ["$applications", 0] } },
        totalApplicants: { $sum: { $ifNull: ["$applicants", 0] } },
        totalEnrolled: { $sum: { $ifNull: ["$enrolledStudents", 0] } },
      } }]).exec(),
    ]);

    const internships = documents.map(serialize).filter((item): item is RecordValue => item !== null);
    const statusCounts: Record<InternshipStatus, number> = { active: 0, inactive: 0, draft: 0, closed: 0 };
    for (const row of statusRows as Array<{ _id?: unknown; count?: unknown }>) {
      const key = text(row._id) as InternshipStatus;
      if (Object.prototype.hasOwnProperty.call(statusCounts, key)) statusCounts[key] = numeric(row.count);
    }
    const totals = (totalsRows as Array<RecordValue>)[0] ?? {};
    const domains = (domainRows as Array<{ _id?: unknown; count?: unknown }>).map((row) => ({ domain: text(row._id), count: numeric(row.count) }));
    const pagination = {
      page, limit, total,
      totalPages: total ? Math.ceil(total / limit) : 0,
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    };
    const stats = {
      total,
      active: statusCounts.active,
      inactive: statusCounts.inactive,
      draft: statusCounts.draft,
      closed: statusCounts.closed,
      applications: numeric(totals.totalApplications),
      applicants: numeric(totals.totalApplicants),
      enrolled: numeric(totals.totalEnrolled),
    };
    // Retain response aliases used by existing dashboard versions.
    return success("Internships fetched successfully.", { internships, data: internships, pagination, stats, domains, ...pagination, ...stats });
  } catch (error) {
    return errorFrom(error, "Unable to fetch internships.", "INTERNSHIPS_FETCH_FAILED");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    await connectDB();
    const body = await readBody(request);
    const domain = text(body.domain);
    const createAllPlans = bool(body.createAllPlans, false);
    const durations: Duration[] = createAllPlans
      ? ["1 Month", "3 Months", "6 Months"]
      : [parsePlan(body.planCode, body.duration).duration];

    const existing = await Internship.find({ domain: { $regex: `^${escapeRegex(domain)}$`, $options: "i" } })
      .select("planCode duration").lean().exec();
    const existingPlans = new Set(existing.map((item) => text(item.planCode).toUpperCase() || parsePlan(undefined, item.duration).planCode));
    const requestedPlans = durations.map((duration) => parsePlan(undefined, duration));
    const duplicate = requestedPlans.find((plan) => existingPlans.has(plan.planCode));
    if (duplicate) return failure(`A ${duplicate.duration} internship plan already exists for ${domain}.`, "DUPLICATE_DOMAIN_PLAN", 409);

    // Create the requested plans as one logical operation; roll back newly created rows if a later insert fails.
    const createdIds: mongoose.Types.ObjectId[] = [];
    try {
      for (const duration of durations) {
        const data = buildCreateData(body, auth.user, duration);
        const created = await Internship.create(data as any);
        createdIds.push(created._id as mongoose.Types.ObjectId);
      }
    } catch (createError) {
      if (createdIds.length) await Internship.deleteMany({ _id: { $in: createdIds } }).exec();
      throw createError;
    }

    const createdDocuments = await Internship.find({ _id: { $in: createdIds } }).sort({ durationMonths: 1 }).lean().exec();
    const internships = createdDocuments.map(serialize).filter((item): item is RecordValue => item !== null);
    return success("Internship plan(s) created successfully.", {
      internship: internships[0] ?? null,
      internships,
      data: internships,
      createdCount: internships.length,
    }, 201);
  } catch (error) {
    return errorFrom(error, "Unable to create internship.", "INTERNSHIP_CREATE_FAILED");
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return updateInternship(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return updateInternship(request);
}

async function updateInternship(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    await connectDB();
    const body = await readBody(request);
    const id = text(body.id, text(body._id, text(body.internshipId)));
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return failure("A valid internship ID is required.", "INVALID_INTERNSHIP_ID", 400);

    const existing = await Internship.findById(id).exec();
    if (!existing) return failure("Internship not found.", "INTERNSHIP_NOT_FOUND", 404);

    const update: RecordValue = {};
    const fields = [
      "title", "name", "description", "domain", "assessmentDomain", "assessmentRequired",
      "applicationRequired", "sortOrder", "stipend", "location", "skills", "technologies",
      "requirements", "responsibilities", "eligibility", "maxStudents", "featured",
      "certificateEligible", "tags", "notes", "startDate", "endDate", "mode", "status",
      "isPublic", "isSelectable", "planCode", "duration",
    ] as const;

    for (const field of fields) {
      if (body[field] === undefined) continue;
      const value = body[field];
      switch (field) {
        case "title": {
          const title = text(value, text(body.name));
          if (title.length < 3 || title.length > 200) throw new InputError("Title must contain 3–200 characters.", "TITLE_REQUIRED");
          update.title = title;
          update.name = title;
          break;
        }
        case "name":
          update.name = text(value).slice(0, 200);
          break;
        case "domain": {
          const nextDomain = text(value);
          if (!nextDomain || nextDomain.length > 150) throw new InputError("A valid domain is required.", "DOMAIN_REQUIRED");
          update.domain = nextDomain;
          break;
        }
        case "assessmentDomain":
          update.assessmentDomain = text(value).slice(0, 150);
          break;
        case "description":
          update.description = text(value).slice(0, 5000);
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
        case "mode": {
          const mode = text(value);
          if (!(INTERNSHIP_MODES as readonly string[]).includes(mode)) throw new InputError("Invalid internship mode.", "INVALID_MODE");
          update.mode = mode;
          break;
        }
        case "status":
          update.status = parseStatus(value);
          break;
        case "isPublic":
        case "isSelectable":
        case "assessmentRequired":
        case "applicationRequired":
        case "featured":
        case "certificateEligible":
          if (typeof value !== "boolean") throw new InputError(`${field} must be true or false.`, "INVALID_BOOLEAN");
          update[field] = value;
          break;
        case "skills":
        case "technologies":
        case "requirements":
        case "responsibilities":
        case "tags":
          update[field] = stringArray(value);
          break;
        case "startDate":
        case "endDate":
          update[field] = parseDate(value, field);
          break;
        case "planCode":
        case "duration": {
          const plan = parsePlan(body.planCode ?? existing.planCode, body.duration ?? existing.duration);
          update.planCode = plan.planCode;
          update.duration = plan.duration;
          update.durationMonths = plan.durationMonths;
          update.price = priceForPlan(plan.planCode);
          update.priceInPaise = priceForPlan(plan.planCode) * 100;
          update.currency = "INR";
          break;
        }
        case "sortOrder": {
          const n = numeric(value, Number.NaN);
          if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 100) throw new InputError("sortOrder must be an integer from 1 to 100.", "INVALID_SORT_ORDER");
          update.sortOrder = n;
          break;
        }
        case "maxStudents": {
          const n = numeric(value, Number.NaN);
          if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new InputError("maxStudents must be a non-negative integer.", "INVALID_CAPACITY");
          update.maxStudents = n;
          break;
        }
        default:
          break;
      }
    }

    // Status action compatibility with the admin page's activate/deactivate controls.
    const action = text(body.action).toLowerCase();
    if (action) {
      const actionStatus: Record<string, InternshipStatus> = {
        activate: "active", deactivate: "inactive", draft: "draft", close: "closed",
      };
      if (!actionStatus[action]) throw new InputError("Unsupported internship action.", "INVALID_ACTION");
      update.status = actionStatus[action];
      if (action === "activate") {
        update.isPublic = true;
        update.isSelectable = true;
      }
      if (["deactivate", "draft", "close"].includes(action)) {
        update.isPublic = false;
        update.isSelectable = false;
      }
    }

    if (Object.keys(update).length === 0) return failure("No supported fields were supplied for update.", "NO_UPDATE_FIELDS", 400);

    const nextStatus = (update.status ?? existing.status) as InternshipStatus;
    const nextPublic = update.isPublic === undefined ? bool(existing.isPublic, false) : bool(update.isPublic, false);
    const requestedSelectable = update.isSelectable === undefined ? bool(existing.isSelectable, false) : bool(update.isSelectable, false);
    update.isSelectable = nextStatus === "active" && nextPublic && requestedSelectable;

    const nextStart = (update.startDate === undefined ? existing.startDate : update.startDate) as Date | null;
    const nextEnd = (update.endDate === undefined ? existing.endDate : update.endDate) as Date | null;
    validateDateRange(nextStart, nextEnd);

    // These counters and pricing are server-owned; ignore any extra browser fields.
    delete update.applications;
    delete update.applicants;
    delete update.enrolledStudents;

    const resultingDomain = text(update.domain, text(existing.domain));
    const resultingPlan = text(update.planCode, text(existing.planCode)).toUpperCase();
    const duplicate = await Internship.findOne({
      _id: { $ne: id },
      domain: { $regex: `^${escapeRegex(resultingDomain)}$`, $options: "i" },
      planCode: resultingPlan as PlanCode,
    }).select("_id").lean().exec();
    if (duplicate) return failure("An internship with the same domain and plan already exists.", "DUPLICATE_DOMAIN_PLAN", 409);

    const updated = await Internship.findByIdAndUpdate(id, { $set: update }, {
      new: true,
      runValidators: true,
      context: "query",
    }).exec();
    if (!updated) return failure("Internship not found.", "INTERNSHIP_NOT_FOUND", 404);
    const serialized = serialize(updated);
    return success("Internship updated successfully.", { internship: serialized, data: serialized });
  } catch (error) {
    return errorFrom(error, "Unable to update internship.", "INTERNSHIP_UPDATE_FAILED");
  }
}

/** Preserve activity history: close records that have applications/enrolments. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    await connectDB();
    const id = text(request.nextUrl.searchParams.get("id"), text(request.nextUrl.searchParams.get("_id"), text(request.nextUrl.searchParams.get("internshipId"))));
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return failure("A valid internship ID is required.", "INVALID_INTERNSHIP_ID", 400);
    const internship = await Internship.findById(id).exec();
    if (!internship) return failure("Internship not found.", "INTERNSHIP_NOT_FOUND", 404);

    const hasActivity = numeric(internship.applications) > 0 || numeric(internship.applicants) > 0 || numeric(internship.enrolledStudents) > 0;
    if (hasActivity) {
      const closed = await Internship.findByIdAndUpdate(id, {
        $set: { status: "closed", isPublic: false, isSelectable: false },
      }, { new: true, runValidators: true }).exec();
      return success("This internship has activity, so it was closed to preserve student and payment history.", {
        deleted: false, closed: true, internship: serialize(closed),
      });
    }

    await Internship.findByIdAndDelete(id).exec();
    return success("Internship deleted successfully.", { deleted: true, closed: false, id });
  } catch (error) {
    return errorFrom(error, "Unable to delete internship.", "INTERNSHIP_DELETE_FAILED");
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return respond(null, 204);
}
