import { randomUUID } from "node:crypto";
import { Schema, type Connection, type Model } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectDB, { connectStudentDB } from "@/lib/db";
import InternshipModel from "@/models/Internship";
import {
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAuthToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COLLECTION_NAME = "weekly_assessment_configurations";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_DOMAIN_OVERRIDES = 200;
const ALLOWED_FORMATS = new Set(["zip", "pdf", "images", "github", "multiple"]);
const DEFAULTS = {
  totalMarks: 100,
  passingMarks: 40,
  maxAttempts: 1,
  submissionWindowDays: 7,
  submissionFormat: "zip",
  lateSubmissionAllowed: false,
  lateSubmissionGraceMinutes: 0,
  timezone: "Asia/Kolkata",
};

type AnyRecord = Record<string, unknown>;
type DomainRecord = {
  name: string;
  key: string;
  isActive: true;
};

type AuthenticatedAdmin = {
  id: string;
  identifier: string;
};

class RouteError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "INVALID_CONFIGURATION") {
    super(message);
    this.name = "RouteError";
    this.status = status;
    this.code = code;
  }
}

const configurationSchema = new Schema(
  {
    configKey: { type: String, required: true, unique: true, default: "weekly-assessment-defaults" },
    globalDefaults: {
      totalMarks: { type: Number, required: true, min: 1, max: 10000, default: DEFAULTS.totalMarks },
      passingMarks: { type: Number, required: true, min: 0, max: 10000, default: DEFAULTS.passingMarks },
      maxAttempts: { type: Number, required: true, min: 1, max: 10, default: DEFAULTS.maxAttempts },
      submissionWindowDays: { type: Number, required: true, min: 1, max: 90, default: DEFAULTS.submissionWindowDays },
      submissionFormat: { type: String, required: true, enum: [...ALLOWED_FORMATS], default: DEFAULTS.submissionFormat },
      lateSubmissionAllowed: { type: Boolean, default: false },
      lateSubmissionGraceMinutes: { type: Number, min: 0, max: 10080, default: 0 },
      timezone: { type: String, required: true, trim: true, maxlength: 80, default: DEFAULTS.timezone },
    },
    domainOverrides: {
      type: [{
        domain: { type: String, required: true, trim: true, maxlength: 150 },
        domainKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
        enabled: { type: Boolean, default: true },
        totalMarks: { type: Number, min: 1, max: 10000, required: true },
        passingMarks: { type: Number, min: 0, max: 10000, required: true },
        maxAttempts: { type: Number, min: 1, max: 10, required: true },
        submissionWindowDays: { type: Number, min: 1, max: 90, required: true },
        submissionFormat: { type: String, enum: [...ALLOWED_FORMATS], required: true },
        lateSubmissionAllowed: { type: Boolean, default: false },
        lateSubmissionGraceMinutes: { type: Number, min: 0, max: 10080, default: 0 },
        timezone: { type: String, required: true, trim: true, maxlength: 80 },
        updatedAt: { type: Date, default: Date.now },
      }],
      default: [],
      validate: {
        validator: (items: unknown[]) => Array.isArray(items) && items.length <= MAX_DOMAIN_OVERRIDES,
        message: "Too many domain overrides.",
      },
    },
    version: { type: Number, min: 1, default: 1 },
    updatedByAdminId: { type: String, required: true, trim: true, maxlength: 150 },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
    collection: COLLECTION_NAME,
    minimize: false,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);


async function getConfigurationModel(): Promise<Model<any>> {
  const connection = (await connectStudentDB()) as Connection;
  const existing = connection.models.WeeklyAssessmentConfiguration as Model<any> | undefined;
  if (existing) return existing;
  return connection.model("WeeklyAssessmentConfiguration", configurationSchema, COLLECTION_NAME);
}

function cleanString(value: unknown, maximum = 200): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKey(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function secure(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Vary", "Cookie");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Request-Id", requestId);
  return response;
}

function json(requestId: string, body: unknown, status = 200): NextResponse {
  return secure(NextResponse.json(body, { status }), requestId);
}

function failure(requestId: string, status: number, code: string, message: string): NextResponse {
  return json(requestId, { success: false, code, message, requestId }, status);
}

function requestIdFor(request: NextRequest): string {
  const candidate = cleanString(request.headers.get("x-request-id"), 100);
  return candidate && /^[a-zA-Z0-9._:-]+$/.test(candidate) ? candidate : randomUUID();
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expected = new URL(request.url);
    const actual = new URL(origin);
    return expected.protocol === actual.protocol && expected.host === actual.host;
  } catch {
    return false;
  }
}

function validBodySize(request: NextRequest): boolean {
  const raw = request.headers.get("content-length");
  if (!raw) return true;
  const size = Number(raw);
  return Number.isSafeInteger(size) && size >= 0 && size <= MAX_BODY_BYTES;
}

async function authenticate(request: NextRequest, requestId: string): Promise<
  { admin: AuthenticatedAdmin } | { response: NextResponse }
> {
  const token = request.cookies.get(STUDENT_ADMIN_AUTH_COOKIE_NAME)?.value?.trim();
  if (!token) {
    return { response: failure(requestId, 401, "UNAUTHORIZED", "Student Operations Admin login is required.") };
  }

  try {
    const verified = await verifyAuthToken(token);
    if (
      !verified ||
      verified.role !== "admin" ||
      verified.adminRole !== "Student Operations Admin" ||
      verified.sessionType !== "student-admin"
    ) {
      return { response: failure(requestId, 403, "FORBIDDEN", "Only Student Operations Admin can manage this configuration.") };
    }

    const id = cleanString(verified.id, 150);
    if (!id) {
      return { response: failure(requestId, 401, "INVALID_ADMIN_ID", "Administrator identity is invalid.") };
    }

    return { admin: { id, identifier: cleanString(verified.identifier, 254) } };
  } catch (error) {
    console.error("[WEEKLY_ASSESSMENT_CONFIG_AUTH]", { requestId, error });
    return { response: failure(requestId, 401, "INVALID_SESSION", "Your session is invalid or expired. Please sign in again.") };
  }
}

async function getActiveDomains(): Promise<DomainRecord[]> {
  await connectDB();
  const records = await InternshipModel.find({
    status: "active",
    domain: { $type: "string", $ne: "" },
  })
    .select("domain assessmentDomain status")
    .lean()
    .exec() as unknown as AnyRecord[];

  const unique = new Map<string, DomainRecord>();
  for (const record of records) {
    for (const candidate of [record.domain, record.assessmentDomain]) {
      const name = cleanString(candidate, 150);
      const key = normalizeKey(name);
      if (!name || !key) continue;
      const normalized = name.toLowerCase();
      if (!unique.has(normalized)) unique.set(normalized, { name, key, isActive: true });
    }
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function parseSettings(value: unknown) {
  if (!isRecord(value)) throw new RouteError("Settings payload is invalid.");
  const totalMarks = Number(value.totalMarks);
  const passingMarks = Number(value.passingMarks);
  const maxAttempts = Number(value.maxAttempts);
  const submissionWindowDays = Number(value.submissionWindowDays);
  const submissionFormat = cleanString(value.submissionFormat, 20);
  const lateSubmissionAllowed = value.lateSubmissionAllowed === true;
  const lateSubmissionGraceMinutes = Number(value.lateSubmissionGraceMinutes);
  const timezone = cleanString(value.timezone, 80);

  if (!Number.isInteger(totalMarks) || totalMarks < 1 || totalMarks > 10000) {
    throw new RouteError("Total marks must be an integer between 1 and 10000.");
  }
  if (!Number.isInteger(passingMarks) || passingMarks < 0 || passingMarks > totalMarks) {
    throw new RouteError("Passing marks must be between zero and total marks.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new RouteError("Maximum attempts must be between 1 and 10.");
  }
  if (!Number.isInteger(submissionWindowDays) || submissionWindowDays < 1 || submissionWindowDays > 90) {
    throw new RouteError("Submission window must be between 1 and 90 days.");
  }
  if (!ALLOWED_FORMATS.has(submissionFormat)) {
    throw new RouteError("Select a supported submission format.");
  }
  if (!Number.isInteger(lateSubmissionGraceMinutes) || lateSubmissionGraceMinutes < 0 || lateSubmissionGraceMinutes > 10080) {
    throw new RouteError("Late submission grace must be between 0 and 10080 minutes.");
  }
  if (!timezone || timezone.length > 80) throw new RouteError("A valid timezone is required.");

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new RouteError("Timezone is not recognized.");
  }

  return {
    totalMarks,
    passingMarks,
    maxAttempts,
    submissionWindowDays,
    submissionFormat,
    lateSubmissionAllowed,
    lateSubmissionGraceMinutes: lateSubmissionAllowed ? lateSubmissionGraceMinutes : 0,
    timezone,
  };
}

function serializeConfiguration(record: AnyRecord | null, domains: DomainRecord[]) {
  const defaults = isRecord(record?.globalDefaults)
    ? { ...DEFAULTS, ...record.globalDefaults }
    : { ...DEFAULTS };
  const activeKeys = new Set(domains.map((domain) => domain.key));
  const storedOverrides = Array.isArray(record?.domainOverrides) ? record.domainOverrides : [];
  const overrides = storedOverrides
    .filter((item): item is AnyRecord => isRecord(item) && activeKeys.has(cleanString(item.domainKey, 160)))
    .map((item) => ({
      domain: cleanString(item.domain, 150),
      domainKey: cleanString(item.domainKey, 160),
      enabled: item.enabled !== false,
      ...parseStoredSettings(item),
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt ?? null,
    }));

  return {
    globalDefaults: defaults,
    domainOverrides: overrides,
    domains,
    version: Number(record?.version ?? 1),
    updatedAt: record?.updatedAt instanceof Date ? record.updatedAt.toISOString() : record?.updatedAt ?? null,
    updatedByAdminId: cleanString(record?.updatedByAdminId, 150),
  };
}

function parseStoredSettings(value: AnyRecord) {
  return {
    totalMarks: Number(value.totalMarks ?? DEFAULTS.totalMarks),
    passingMarks: Number(value.passingMarks ?? DEFAULTS.passingMarks),
    maxAttempts: Number(value.maxAttempts ?? DEFAULTS.maxAttempts),
    submissionWindowDays: Number(value.submissionWindowDays ?? DEFAULTS.submissionWindowDays),
    submissionFormat: cleanString(value.submissionFormat, 20) || DEFAULTS.submissionFormat,
    lateSubmissionAllowed: value.lateSubmissionAllowed === true,
    lateSubmissionGraceMinutes: Number(value.lateSubmissionGraceMinutes ?? 0),
    timezone: cleanString(value.timezone, 80) || DEFAULTS.timezone,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFor(request);
  const auth = await authenticate(request, requestId);
  if ("response" in auth) return auth.response;

  try {
    const [domains, Configuration] = await Promise.all([
      getActiveDomains(),
      getConfigurationModel(),
    ]);
    const record = await Configuration.findOne({ configKey: "weekly-assessment-defaults" }).lean().exec() as AnyRecord | null;
    const data = serializeConfiguration(record, domains);
    return json(requestId, {
      success: true,
      message: "Weekly assessment configuration loaded.",
      data,
    });
  } catch (error) {
    console.error("[WEEKLY_ASSESSMENT_CONFIG_GET]", { requestId, error });
    return failure(requestId, 500, "CONFIGURATION_FETCH_FAILED", "Unable to load configuration. Check Main DB and Student Operations DB connections.");
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  if (!sameOrigin(request)) return failure(requestId, 403, "INVALID_ORIGIN", "Request origin is not allowed.");
  if (!validBodySize(request)) return failure(requestId, 413, "PAYLOAD_TOO_LARGE", "Configuration payload is too large.");

  const auth = await authenticate(request, requestId);
  if ("response" in auth) return auth.response;

  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return failure(requestId, 415, "UNSUPPORTED_MEDIA_TYPE", "Send configuration as JSON.");
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || !isRecord(body.globalDefaults) || !Array.isArray(body.domainOverrides)) {
      return failure(requestId, 400, "INVALID_BODY", "Provide globalDefaults and domainOverrides.");
    }

    if (body.domainOverrides.length > MAX_DOMAIN_OVERRIDES) {
      return failure(requestId, 400, "TOO_MANY_OVERRIDES", "Too many domain overrides.");
    }

    const [domains, Configuration] = await Promise.all([
      getActiveDomains(),
      getConfigurationModel(),
    ]);
    const activeByKey = new Map(domains.map((item) => [item.key, item]));
    const globalDefaults = parseSettings(body.globalDefaults);
    const seen = new Set<string>();

    const domainOverrides = body.domainOverrides.map((raw) => {
      if (!isRecord(raw)) throw new RouteError("A domain override is invalid.");
      const domainKey = normalizeKey(cleanString(raw.domainKey, 160));
      const activeDomain = activeByKey.get(domainKey);
      if (!activeDomain) throw new RouteError("A selected domain is no longer active in Main Admin internships.", 409, "DOMAIN_NOT_ACTIVE");
      if (seen.has(domainKey)) throw new RouteError(`Duplicate override for ${activeDomain.name}.`);
      seen.add(domainKey);
      const settings = parseSettings(raw);
      return {
        domain: activeDomain.name,
        domainKey: activeDomain.key,
        enabled: raw.enabled !== false,
        ...settings,
        updatedAt: new Date(),
      };
    });

    const current = await Configuration.findOne({ configKey: "weekly-assessment-defaults" }).lean().exec() as AnyRecord | null;
    const expectedVersion = Number(body.version ?? 0);
    const currentVersion = Number(current?.version ?? 0);

    if (current && expectedVersion !== currentVersion) {
      return failure(requestId, 409, "CONFIGURATION_CONFLICT", "Configuration changed in another session. Refresh before saving.");
    }

    const update = {
      globalDefaults,
      domainOverrides,
      version: currentVersion + 1,
      updatedByAdminId: auth.admin.id,
    };

    const saved = await Configuration.findOneAndUpdate(
      { configKey: "weekly-assessment-defaults", version: currentVersion },
      { $set: update, $setOnInsert: { configKey: "weekly-assessment-defaults" } },
      { new: true, upsert: !current, runValidators: true, setDefaultsOnInsert: true },
    ).lean().exec() as AnyRecord | null;

    if (!saved) {
      return failure(requestId, 409, "CONFIGURATION_CONFLICT", "Configuration changed while saving. Refresh and try again.");
    }

    return json(requestId, {
      success: true,
      message: "Global defaults and domain overrides saved successfully.",
      data: serializeConfiguration(saved, domains),
    });
  } catch (error) {
    if (error instanceof RouteError) {
      return failure(requestId, error.status, error.code, error.message);
    }
    if (isRecord(error) && error.code === 11000) {
      return failure(requestId, 409, "CONFIGURATION_CONFLICT", "Configuration already exists. Refresh and try again.");
    }
    console.error("[WEEKLY_ASSESSMENT_CONFIG_PUT]", { requestId, error });
    return failure(requestId, 500, "CONFIGURATION_SAVE_FAILED", "Unable to save configuration. Check the Student Operations database connection.");
  }
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFor(request);
  return json(requestId, { success: true, methods: ["GET", "PUT", "OPTIONS"] });
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "GET, PUT, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
