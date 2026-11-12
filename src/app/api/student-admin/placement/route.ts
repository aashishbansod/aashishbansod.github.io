import { NextRequest, NextResponse } from "next/server";
import mongoose, { type Connection, type Model, Schema } from "mongoose";
import {
  ADMIN_AUTH_COOKIE_NAME,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";
import { connectStudentDB } from "@/lib/student-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COLLECTION_NAME = "placement_companies";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_SEARCH_LENGTH = 120;
const MAX_LIMIT = 100;
const MAX_PAGE = 100000;
const COMPANY_STATUSES = ["active", "inactive"] as const;

type CompanyStatus = (typeof COMPANY_STATUSES)[number];

type PlacementCompanyRecord = {
  name: string;
  normalizedName: string;
  website: string;
  industry: string;
  location: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: CompanyStatus;
  isArchived: boolean;
  createdBy: string;
  createdByRole: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type Actor = {
  id: string;
  role: string;
  identifier: string;
};

class RouteError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "RouteError";
    this.status = status;
    this.code = code;
  }
}

const PlacementCompanySchema = new Schema<PlacementCompanyRecord>(
  {
    name: {
      type: String,
      required: [true, "Company name is required."],
      trim: true,
      minlength: [2, "Company name must contain at least 2 characters."],
      maxlength: [120, "Company name cannot exceed 120 characters."],
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    website: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    industry: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    contactName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
    },
    contactPhone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    status: {
      type: String,
      enum: COMPANY_STATUSES,
      default: "active",
      required: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      maxlength: 150,
    },
    createdByRole: {
      type: String,
      required: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
    strict: "throw",
    versionKey: false,
    minimize: true,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

PlacementCompanySchema.index(
  { normalizedName: 1 },
  {
    unique: true,
    partialFilterExpression: { isArchived: false },
  },
);
PlacementCompanySchema.index({ status: 1, isArchived: 1, createdAt: -1 });
PlacementCompanySchema.index({ industry: 1, status: 1 });

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie, Origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}

function clean(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function authenticate(request: NextRequest): Promise<Actor> {
  const tokens = [
    request.cookies.get(STUDENT_ADMIN_AUTH_COOKIE_NAME)?.value,
    request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value,
  ].filter((token): token is string => Boolean(token?.trim()));

  for (const token of tokens) {
    const payload = verifyAccessToken(token.trim());
    if (!payload) continue;

    const isStudentOperationsAdmin =
      payload.role === "admin" &&
      payload.adminRole === "Student Operations Admin" &&
      payload.sessionType === "student-admin";

    const isSuperAdmin =
      payload.role === "admin" &&
      payload.adminRole === "Super Admin" &&
      payload.sessionType === "admin";

    if (isStudentOperationsAdmin || isSuperAdmin) {
      return {
        id: clean(payload.sub, 150),
        role: payload.adminRole || "Admin",
        identifier: clean(payload.identifier, 254),
      };
    }
  }

  throw new RouteError(
    "A valid Student Operations Admin or Super Admin session is required.",
    401,
    "UNAUTHORIZED",
  );
}

async function getCompanyModel(): Promise<Model<PlacementCompanyRecord>> {
  const connection: Connection = await connectStudentDB();

  if (connection.readyState !== 1 || !connection.db) {
    throw new RouteError(
      "Student Operations database is unavailable.",
      503,
      "STUDENT_OPERATIONS_DATABASE_UNAVAILABLE",
    );
  }

  const existing = connection.models.PlacementCompany as
    | Model<PlacementCompanyRecord>
    | undefined;

  if (existing) return existing;

  return connection.model<PlacementCompanyRecord>(
    "PlacementCompany",
    PlacementCompanySchema,
    COLLECTION_NAME,
  );
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RouteError(
      "Content-Type must be application/json.",
      415,
      "INVALID_CONTENT_TYPE",
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw new RouteError("Request body is too large.", 413, "REQUEST_TOO_LARGE");
  }

  if (!request.body) {
    throw new RouteError("Request body is required.", 400, "EMPTY_BODY");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RouteError("Request body is too large.", 413, "REQUEST_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let text: string;
  try {
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    text = new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    throw new RouteError("Request body is not valid UTF-8.", 400, "INVALID_ENCODING");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RouteError("Request body contains invalid JSON.", 400, "INVALID_JSON");
  }

  if (!isPlainObject(parsed)) {
    throw new RouteError("Request body must be a JSON object.", 400, "INVALID_BODY");
  }

  return parsed;
}

function validateCompany(input: unknown, partial = false): Partial<PlacementCompanyRecord> {
  if (!isPlainObject(input)) {
    throw new RouteError("Company details are required.", 400, "INVALID_COMPANY");
  }

  const allowedKeys = new Set([
    "name",
    "website",
    "industry",
    "location",
    "description",
    "contactName",
    "contactEmail",
    "contactPhone",
    "status",
  ]);

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new RouteError(`Unsupported company field: ${key}.`, 400, "UNKNOWN_FIELD");
    }
  }

  const output: Partial<PlacementCompanyRecord> = {};

  if (!partial || "name" in input) {
    const name = clean(input.name, 120);
    if (name.length < 2) {
      throw new RouteError("Company name must contain at least 2 characters.", 400, "INVALID_COMPANY_NAME");
    }
    output.name = name;
    output.normalizedName = name.toLowerCase();
  }

  const fields = [
    ["website", 300],
    ["industry", 100],
    ["location", 160],
    ["description", 2000],
    ["contactName", 120],
    ["contactPhone", 30],
  ] as const;

  for (const [key, maxLength] of fields) {
    if (!partial || key in input) {
      output[key] = clean(input[key], maxLength);
    }
  }

  if (!partial || "contactEmail" in input) {
    const email = clean(input.contactEmail, 254).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new RouteError("Enter a valid contact email address.", 400, "INVALID_CONTACT_EMAIL");
    }
    output.contactEmail = email;
  }

  if (!partial || "status" in input) {
    const status = clean(input.status || "active", 20).toLowerCase();
    if (!COMPANY_STATUSES.includes(status as CompanyStatus)) {
      throw new RouteError("Company status must be active or inactive.", 400, "INVALID_STATUS");
    }
    output.status = status as CompanyStatus;
  }

  return output;
}

function serializeCompany(record: Record<string, unknown>) {
  return {
    id: String(record._id),
    name: clean(record.name, 120),
    website: clean(record.website, 300),
    industry: clean(record.industry, 100),
    location: clean(record.location, 160),
    description: clean(record.description, 2000),
    contactName: clean(record.contactName, 120),
    contactEmail: clean(record.contactEmail, 254),
    contactPhone: clean(record.contactPhone, 30),
    status: clean(record.status, 20),
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : null,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : null,
  };
}

function handleError(error: unknown, operation: string) {
  if (error instanceof RouteError) {
    return json(
      { success: false, message: error.message, code: error.code },
      error.status,
    );
  }

  const value = error as { code?: unknown; name?: unknown } | null;
  const code = value?.code === 11000 ? "DUPLICATE_COMPANY" : "PLACEMENT_REQUEST_FAILED";

  console.error(`[STUDENT ADMIN PLACEMENT ${operation}]`, {
    name: typeof value?.name === "string" ? value.name : "Error",
    code: value?.code === undefined ? undefined : String(value.code),
  });

  if (value?.code === 11000) {
    return json(
      { success: false, message: "A company with this name already exists.", code },
      409,
    );
  }

  return json(
    { success: false, message: "Unable to process placement request.", code },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    await authenticate(request);

    const { searchParams } = new URL(request.url);
    const search = clean(searchParams.get("search"), MAX_SEARCH_LENGTH);
    const status = clean(searchParams.get("status"), 20).toLowerCase();
    const pageValue = Number(searchParams.get("page") || 1);
    const limitValue = Number(searchParams.get("limit") || 20);

    const page = Number.isSafeInteger(pageValue) && pageValue > 0
      ? Math.min(pageValue, MAX_PAGE)
      : 1;
    const limit = Number.isSafeInteger(limitValue) && limitValue > 0
      ? Math.min(limitValue, MAX_LIMIT)
      : 20;

    if (status && status !== "all" && !COMPANY_STATUSES.includes(status as CompanyStatus)) {
      throw new RouteError("Invalid company status filter.", 400, "INVALID_STATUS");
    }

    const Company = await getCompanyModel();
    const filter: Record<string, unknown> = { isArchived: false };

    if (status && status !== "all") filter.status = status;

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { name: regex },
        { industry: regex },
        { location: regex },
        { contactName: regex },
        { contactEmail: regex },
      ];
    }

    const skip = (page - 1) * limit;
    const [documents, total, active, inactive] = await Promise.all([
      Company.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean().exec(),
      Company.countDocuments(filter).exec(),
      Company.countDocuments({ isArchived: false, status: "active" }).exec(),
      Company.countDocuments({ isArchived: false, status: "inactive" }).exec(),
    ]);

    const data = documents.map((item) =>
      serializeCompany(item as unknown as Record<string, unknown>),
    );
    const pages = Math.ceil(total / limit);

    return json({
      success: true,
      message: "Placement companies loaded successfully.",
      data,
      total,
      page,
      limit,
      pages,
      pagination: {
        page,
        limit,
        total,
        totalPages: pages,
        hasNextPage: page < pages,
        hasPreviousPage: page > 1,
      },
      stats: { total: active + inactive, active, inactive },
      meta: { source: "student_operations", generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    return handleError(error, "GET");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);

    if (!trustedOrigin(request)) {
      throw new RouteError("Cross-origin requests are not allowed.", 403, "INVALID_ORIGIN");
    }

    const body = await readJson(request);
    const companyInput = validateCompany(body.company ?? body);
    const Company = await getCompanyModel();

    const created = await Company.create({
      ...companyInput,
      createdBy: actor.id,
      createdByRole: actor.role,
    });

    return json({
      success: true,
      message: "Placement company created successfully.",
      data: serializeCompany(created.toObject() as unknown as Record<string, unknown>),
    }, 201);
  } catch (error) {
    return handleError(error, "POST");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await authenticate(request);

    if (!trustedOrigin(request)) {
      throw new RouteError("Cross-origin requests are not allowed.", 403, "INVALID_ORIGIN");
    }

    const body = await readJson(request);
    const companyId = clean(body.companyId ?? body.id, 64);

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new RouteError("A valid company ID is required.", 400, "INVALID_COMPANY_ID");
    }

    const updates = validateCompany(body.company, true);
    if (Object.keys(updates).length === 0) {
      throw new RouteError("At least one company field is required.", 400, "EMPTY_UPDATE");
    }

    const Company = await getCompanyModel();
    const updated = await Company.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(companyId), isArchived: false },
      { $set: updates },
      { new: true, runValidators: true, context: "query" },
    ).lean().exec();

    if (!updated) {
      throw new RouteError("Placement company was not found.", 404, "COMPANY_NOT_FOUND");
    }

    return json({
      success: true,
      message: "Placement company updated successfully.",
      data: serializeCompany(updated as unknown as Record<string, unknown>),
    });
  } catch (error) {
    return handleError(error, "PATCH");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await authenticate(request);

    if (!trustedOrigin(request)) {
      throw new RouteError("Cross-origin requests are not allowed.", 403, "INVALID_ORIGIN");
    }

    const body = await readJson(request);
    const companyId = clean(body.companyId ?? body.id, 64);

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new RouteError("A valid company ID is required.", 400, "INVALID_COMPANY_ID");
    }

    const Company = await getCompanyModel();
    const archived = await Company.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(companyId), isArchived: false },
      { $set: { isArchived: true, status: "inactive" } },
      { new: true },
    ).lean().exec();

    if (!archived) {
      throw new RouteError("Placement company was not found.", 404, "COMPANY_NOT_FOUND");
    }

    return json({
      success: true,
      message: "Placement company archived successfully.",
      data: { id: String(archived._id) },
    });
  } catch (error) {
    return handleError(error, "DELETE");
  }
}
