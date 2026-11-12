import { NextResponse } from "next/server";
import mongoose, { Schema, type Document, type Model } from "mongoose";
import { connectDB } from "@/lib/db";
import {
  AUTH_COOKIE_NAME,
  verifyAccessToken,
  verifyAuthToken,
} from "@/lib/auth";
import AdminModel from "@/models/Admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

 type SettingsDocument = Document & {
  key: string;
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  officeLocation: string;
  emailNotifications: boolean;
  applicationAlerts: boolean;
  paymentAlerts: boolean;
  certificateAlerts: boolean;
  maintenanceMode: boolean;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

type AdminAuth = {
  userId: string;
  role: string;
  email?: string;
};

type AuthPayload = {
  role?: unknown;
  userType?: unknown;
  userId?: unknown;
  id?: unknown;
  adminId?: unknown;
  sub?: unknown;
  email?: unknown;
  sessionType?: unknown;
  authenticationMode?: unknown;
};

type SettingsResponse = {
  key: string;
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  officeLocation: string;
  emailNotifications: boolean;
  applicationAlerts: boolean;
  paymentAlerts: boolean;
  certificateAlerts: boolean;
  maintenanceMode: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

const SETTINGS_KEY = "admin";
const MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_SETTINGS = {
  key: SETTINGS_KEY,
  companyName: "CyberNet Technology Systems",
  supportEmail: "contact@cybernetsystems.tech",
  supportPhone: "",
  officeLocation: "Amravati, Maharashtra, India",
  emailNotifications: true,
  applicationAlerts: true,
  paymentAlerts: true,
  certificateAlerts: true,
  maintenanceMode: false,
} as const;

const settingsSchema = new Schema<SettingsDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: SETTINGS_KEY,
      trim: true,
      immutable: true,
    },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    supportEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    supportPhone: { type: String, default: "", trim: true, maxlength: 40 },
    officeLocation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    emailNotifications: { type: Boolean, default: true },
    applicationAlerts: { type: Boolean, default: true },
    paymentAlerts: { type: Boolean, default: true },
    certificateAlerts: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    updatedBy: { type: String, trim: true, maxlength: 100 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "admin_settings",
  },
);

const AdminSettings: Model<SettingsDocument> =
  (mongoose.models.AdminSettings as Model<SettingsDocument> | undefined) ??
  mongoose.model<SettingsDocument>("AdminSettings", settingsSchema);

class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie, Authorization, Origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    },
  });
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: unknown): string {
  return cleanString(value).toLowerCase().replace(/[\s_-]+/g, " ");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toAuthPayload(value: unknown): AuthPayload | null {
  return isPlainRecord(value) ? (value as AuthPayload) : null;
}

async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const payload = toAuthPayload(await verifyAccessToken(token));
    if (payload) return payload;
  } catch {}

  try {
    return toAuthPayload(await verifyAuthToken(token));
  } catch {
    return null;
  }
}

function getTokenFromRequest(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);

  if (cookieToken) {
    try {
      return decodeURIComponent(cookieToken);
    } catch {
      return cookieToken;
    }
  }

  const authorization = request.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function validateSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      throw new AuthError("Cross-site requests are not allowed.", 403, "CROSS_SITE_REQUEST");
    }
    return;
  }

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    if (originUrl.origin !== requestUrl.origin) {
      throw new AuthError("Request origin is not allowed.", 403, "INVALID_ORIGIN");
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Request origin is invalid.", 403, "INVALID_ORIGIN");
  }
}

async function requireAdmin(request: Request): Promise<AdminAuth> {
  const token = getTokenFromRequest(request);
  if (!token) {
    throw new AuthError("Authentication required.", 401, "AUTH_REQUIRED");
  }

  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthError("Invalid or expired authentication token.", 401, "AUTH_INVALID");
  }

  const userType = normalizeRole(payload.userType);
  const sessionType = normalizeRole(payload.sessionType ?? payload.authenticationMode);
  if (userType === "student" || (sessionType && sessionType !== "admin")) {
    throw new AuthError("Admin access is required.", 403, "ADMIN_REQUIRED");
  }

  const userId = cleanString(payload.userId ?? payload.id ?? payload.adminId ?? payload.sub);
  const email = cleanString(payload.email).toLowerCase();
  if (!userId && !email) {
    throw new AuthError("Invalid admin identity.", 401, "AUTH_IDENTITY_INVALID");
  }

  await connectDB();

  const lookup: Record<string, unknown>[] = [];
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    lookup.push({ _id: userId });
  }
  if (userId) lookup.push({ adminId: userId });
  if (email) lookup.push({ email });
  if (lookup.length === 0) {
    throw new AuthError("Admin account was not found.", 403, "ADMIN_NOT_FOUND");
  }

  const admin = await AdminModel.findOne({ $or: lookup })
    .select("_id adminId email role isActive active")
    .lean();

  if (!admin) {
    throw new AuthError("Active admin account was not found.", 403, "ADMIN_NOT_FOUND");
  }

  const record = admin as {
    _id?: unknown;
    adminId?: unknown;
    email?: unknown;
    role?: unknown;
    isActive?: boolean;
    active?: boolean;
  };
  if (record.isActive === false || record.active === false) {
    throw new AuthError("Admin account is inactive.", 403, "ADMIN_INACTIVE");
  }

  const role = cleanString(record.role);
  const normalizedRole = normalizeRole(role);
  const allowedRoles = new Set(["super admin", "admin", "hr"]);
  if (!allowedRoles.has(normalizedRole)) {
    throw new AuthError("You do not have permission to access admin settings.", 403, "ADMIN_ROLE_FORBIDDEN");
  }


  return {
    userId: String(record.adminId ?? record._id ?? userId ?? email),
    role,
    email: typeof record.email === "string" ? record.email : email || undefined,
  };
}

function isSuperAdmin(admin: AdminAuth): boolean {
  return normalizeRole(admin.role) === "super admin";
}

function serializeSettings(settings: SettingsDocument): SettingsResponse {
  return {
    key: settings.key,
    companyName: settings.companyName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    officeLocation: settings.officeLocation,
    emailNotifications: settings.emailNotifications,
    applicationAlerts: settings.applicationAlerts,
    paymentAlerts: settings.paymentAlerts,
    certificateAlerts: settings.certificateAlerts,
    maintenanceMode: settings.maintenanceMode,
    createdAt: settings.createdAt?.toISOString(),
    updatedAt: settings.updatedAt?.toISOString(),
    updatedBy: settings.updatedBy,
  };
}

async function getOrCreateSettings(): Promise<SettingsDocument> {
  const existing = await AdminSettings.findOne({ key: SETTINGS_KEY });
  if (existing) return existing;

  try {
    return await AdminSettings.create(DEFAULT_SETTINGS);
  } catch (error) {
    if (isPlainRecord(error) && error.code === 11000) {
      const concurrentRecord = await AdminSettings.findOne({ key: SETTINGS_KEY });
      if (concurrentRecord) return concurrentRecord;
    }
    throw error;
  }
}

function validateSettingsBody(body: Record<string, unknown>): {
  updates: Partial<SettingsResponse>;
  error?: { message: string; code: string };
} {
  const allowedFields = new Set([
    "companyName",
    "supportEmail",
    "supportPhone",
    "officeLocation",
    "emailNotifications",
    "applicationAlerts",
    "paymentAlerts",
    "certificateAlerts",
    "maintenanceMode",
  ]);
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    return {
      updates: {},
      error: { message: `Unsupported settings field: ${unknownFields[0]}.`, code: "UNKNOWN_SETTINGS_FIELD" },
    };
  }

  const updates: Partial<SettingsResponse> = {};
  if (Object.prototype.hasOwnProperty.call(body, "companyName")) {
    if (typeof body.companyName !== "string") {
      return { updates, error: { message: "Company name must be text.", code: "INVALID_COMPANY_NAME" } };
    }
    const value = body.companyName.trim();
    if (!value || value.length > 120) {
      return { updates, error: { message: "Company name is required and must be 120 characters or less.", code: "INVALID_COMPANY_NAME" } };
    }
    updates.companyName = value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "supportEmail")) {
    if (typeof body.supportEmail !== "string") {
      return { updates, error: { message: "Support email must be text.", code: "INVALID_SUPPORT_EMAIL" } };
    }
    const value = body.supportEmail.trim().toLowerCase();
    if (!value || value.length > 254 || !isValidEmail(value)) {
      return { updates, error: { message: "Please provide a valid support email address.", code: "INVALID_SUPPORT_EMAIL" } };
    }
    updates.supportEmail = value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "supportPhone")) {
    if (typeof body.supportPhone !== "string") {
      return { updates, error: { message: "Support phone must be text.", code: "INVALID_SUPPORT_PHONE" } };
    }
    const value = body.supportPhone.trim();
    if (value.length > 40) {
      return { updates, error: { message: "Support phone must be 40 characters or less.", code: "INVALID_SUPPORT_PHONE" } };
    }
    updates.supportPhone = value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "officeLocation")) {
    if (typeof body.officeLocation !== "string") {
      return { updates, error: { message: "Office location must be text.", code: "INVALID_OFFICE_LOCATION" } };
    }
    const value = body.officeLocation.trim();
    if (!value || value.length > 180) {
      return { updates, error: { message: "Office location is required and must be 180 characters or less.", code: "INVALID_OFFICE_LOCATION" } };
    }
    updates.officeLocation = value;
  }

  const booleanFields = [
    "emailNotifications",
    "applicationAlerts",
    "paymentAlerts",
    "certificateAlerts",
    "maintenanceMode",
  ] as const;
  for (const field of booleanFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      if (typeof body[field] !== "boolean") {
        return { updates, error: { message: `${field} must be a boolean.`, code: "INVALID_BOOLEAN_SETTING" } };
      }
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return { updates, error: { message: "No valid settings fields were provided.", code: "EMPTY_SETTINGS_UPDATE" } };
  }

  return { updates };
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new AuthError("Content-Type must be application/json.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new AuthError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new AuthError("Invalid JSON request body.", 400, "INVALID_REQUEST_BODY");
  }

  if (!isPlainRecord(parsed)) {
    throw new AuthError("Request body must be a JSON object.", 400, "INVALID_REQUEST_BODY");
  }

  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > MAX_BODY_BYTES) {
    throw new AuthError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  }

  return parsed;
}

function handleError(error: unknown, operation: "load" | "update") {
  if (error instanceof AuthError) {
    return json({ success: false, message: error.message, code: error.code }, error.status);
  }

  if (isPlainRecord(error) && error.code === 11000) {
    return json({ success: false, message: "Settings record already exists. Please retry.", code: "SETTINGS_DUPLICATE" }, 409);
  }

  console.error(`[ADMIN SETTINGS ${operation.toUpperCase()}]`, error);
  return json(
    {
      success: false,
      message: `Failed to ${operation} admin settings.`,
      code: `ADMIN_SETTINGS_${operation.toUpperCase()}_FAILED`,
      ...(process.env.NODE_ENV === "development" && error instanceof Error
        ? { detail: error.message }
        : {}),
    },
    500,
  );
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const settings = await getOrCreateSettings();
    return json({
      success: true,
      message: "Admin settings loaded successfully.",
      data: serializeSettings(settings),
      meta: {
        authenticated: true,
        adminId: admin.userId,
        role: admin.role,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleError(error, "load");
  }
}

export async function PUT(request: Request) {
  try {
    validateSameOrigin(request);
    const admin = await requireAdmin(request);
    const body = await readJsonBody(request);
    const { updates, error } = validateSettingsBody(body);

    if (error) {
      return json({ success: false, message: error.message, code: error.code }, 400);
    }

    if (updates.maintenanceMode !== undefined && !isSuperAdmin(admin)) {
      return json(
        {
          success: false,
          message: "Only Super Admin can change maintenance mode.",
          code: "SUPER_ADMIN_REQUIRED",
        },
        403,
      );
    }

    await connectDB();
    await getOrCreateSettings();
    const settings = await AdminSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { ...updates, updatedBy: admin.userId } },
      { new: true, upsert: false, runValidators: true },
    );

    if (!settings) {
      return json({ success: false, message: "Settings could not be updated.", code: "SETTINGS_UPDATE_FAILED" }, 500);
    }

    return json({
      success: true,
      message: "Admin settings updated successfully.",
      data: serializeSettings(settings),
      meta: {
        updated: true,
        updatedBy: admin.userId,
        role: admin.role,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleError(error, "update");
  }
}

export async function PATCH(request: Request) {
  return PUT(request);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, PUT, PATCH, OPTIONS, HEAD",
      "Cache-Control": "no-store",
    },
  });
}

export async function HEAD(request: Request) {
  try {
    await requireAdmin(request);
    await connectDB();
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return new NextResponse(null, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("[ADMIN SETTINGS HEAD]", error);
    return new NextResponse(null, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
