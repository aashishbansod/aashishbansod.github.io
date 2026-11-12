import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import {
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";
import { getStudentAdminModel } from "@/models/StudentAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_TEXT_LENGTH = 120;
const MAX_PHONE_LENGTH = 20;
const PROFILE_FIELDS = new Set(["fullName", "designation", "department", "phone"]);

type RecordValue = Record<string, unknown>;

type AuthResult =
  | { valid: true; adminId: string }
  | { valid: false; response: NextResponse };

function response(
  body: RecordValue,
  status = 200,
  requestId = crypto.randomUUID(),
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Request-ID": requestId,
      Vary: "Cookie",
    },
  });
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max = MAX_TEXT_LENGTH): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeDate(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function getRequestId(request: NextRequest): string {
  const incoming = text(request.headers.get("x-request-id"), 100);
  return /^[a-zA-Z0-9._:-]{1,100}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

async function authenticate(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_ADMIN_AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return {
      valid: false,
      response: response(
        {
          success: false,
          message: "Student Operations Admin login is required.",
          code: "UNAUTHORIZED",
        },
        401,
      ),
    };
  }

  const payload = verifyAccessToken(token);

  if (
    !payload ||
    payload.sessionType !== "student-admin" ||
    payload.role !== "admin" ||
    typeof payload.sub !== "string" ||
    !mongoose.isValidObjectId(payload.sub)
  ) {
    return {
      valid: false,
      response: response(
        {
          success: false,
          message: "Your Student Operations session is invalid or expired.",
          code: "INVALID_SESSION",
        },
        401,
      ),
    };
  }

  return { valid: true, adminId: payload.sub };
}

async function loadActiveAdmin(adminId: string) {
  const model = await getStudentAdminModel();
  const admin = await model
    .findById(adminId)
    .select(
      "_id adminId username fullName email role designation department phone registrationStatus isActive isEmailVerified emailVerifiedAt lastLoginAt loginCount permissions security createdAt updatedAt",
    )
    .lean();

  if (!admin) {
    return {
      valid: false as const,
      response: response(
        {
          success: false,
          message: "Student Operations Admin account was not found.",
          code: "ADMIN_NOT_FOUND",
        },
        404,
      ),
    };
  }

  if (
    admin.role !== "Student Operations Admin" ||
    admin.registrationStatus !== "active" ||
    admin.isActive !== true ||
    admin.isEmailVerified !== true
  ) {
    return {
      valid: false as const,
      response: response(
        {
          success: false,
          message: "Your Student Operations Admin account is not active.",
          code: "ADMIN_ACCOUNT_INACTIVE",
        },
        403,
      ),
    };
  }

  const security: RecordValue = isRecord(admin.security) ? admin.security : {};
  const lockedUntil =
    security.lockedUntil instanceof Date ? security.lockedUntil : null;

  if (
    security.accountLocked === true &&
    (!lockedUntil || lockedUntil.getTime() > Date.now())
  ) {
    return {
      valid: false as const,
      response: response(
        {
          success: false,
          message: "Your account is temporarily locked.",
          code: "ACCOUNT_TEMPORARILY_LOCKED",
          retryAt: safeDate(lockedUntil),
        },
        423,
      ),
    };
  }

  const permissions: RecordValue = isRecord(admin.permissions)
    ? admin.permissions
    : {};

  if (permissions.settings !== true) {
    return {
      valid: false as const,
      response: response(
        {
          success: false,
          message: "You do not have permission to access Student Admin settings.",
          code: "SETTINGS_PERMISSION_REQUIRED",
        },
        403,
      ),
    };
  }

  return { valid: true as const, model, admin };
}

function hasValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    return originUrl.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readJson(request: NextRequest): Promise<
  | { valid: true; body: RecordValue }
  | { valid: false; response: NextResponse }
> {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      valid: false,
      response: response(
        {
          success: false,
          message: "Content-Type must be application/json.",
          code: "INVALID_CONTENT_TYPE",
        },
        415,
      ),
    };
  }

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return {
      valid: false,
      response: response(
        {
          success: false,
          message: "Request body is too large.",
          code: "PAYLOAD_TOO_LARGE",
        },
        413,
      ),
    };
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return {
      valid: false,
      response: response(
        {
          success: false,
          message: "Request body is too large.",
          code: "PAYLOAD_TOO_LARGE",
        },
        413,
      ),
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error("Invalid JSON object.");
    return { valid: true, body: parsed };
  } catch {
    return {
      valid: false,
      response: response(
        {
          success: false,
          message: "Request body must be a valid JSON object.",
          code: "INVALID_JSON",
        },
        400,
      ),
    };
  }
}

function validateProfileUpdates(
  body: RecordValue,
):
  | { valid: true; updates: Record<string, string> }
  | { valid: false; message: string } {
  const keys = Object.keys(body);

  if (keys.length === 0) {
    return { valid: false, message: "At least one profile field is required." };
  }

  const updates: Record<string, string> = {};

  for (const key of keys) {
    if (!PROFILE_FIELDS.has(key)) {
      return {
        valid: false,
        message: `The field "${key}" cannot be updated through this endpoint.`,
      };
    }

    const value = body[key];

    if (typeof value !== "string") {
      return { valid: false, message: `The field "${key}" must be text.` };
    }

    const clean = value.trim();

    if (key === "fullName") {
      if (clean.length < 2 || clean.length > MAX_NAME_LENGTH) {
        return {
          valid: false,
          message: "Full name must contain 2 to 120 characters.",
        };
      }
      if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u.test(clean)) {
        return { valid: false, message: "Full name contains invalid characters." };
      }
    }

    if (key === "designation" || key === "department") {
      if (clean.length > MAX_TEXT_LENGTH) {
        return {
          valid: false,
          message: `${key} cannot exceed ${MAX_TEXT_LENGTH} characters.`,
        };
      }
    }

    if (key === "phone") {
      if (clean.length > MAX_PHONE_LENGTH) {
        return {
          valid: false,
          message: `Phone cannot exceed ${MAX_PHONE_LENGTH} characters.`,
        };
      }
      if (clean && !/^[+0-9()\-\s]{7,20}$/.test(clean)) {
        return { valid: false, message: "Enter a valid phone number." };
      }
    }

    updates[key] = clean;
  }

  return { valid: true, updates };
}

function serializeAdmin(admin: RecordValue) {
  const permissions = isRecord(admin.permissions) ? admin.permissions : {};
  const security = isRecord(admin.security) ? admin.security : {};

  return {
    id: String(admin._id ?? ""),
    adminId: text(admin.adminId, 40),
    username: text(admin.username, 30),
    fullName: text(admin.fullName, MAX_NAME_LENGTH),
    email: text(admin.email, 254).toLowerCase(),
    role: text(admin.role, 80),
    designation: text(admin.designation, MAX_TEXT_LENGTH),
    department: text(admin.department, MAX_TEXT_LENGTH),
    phone: text(admin.phone, MAX_PHONE_LENGTH),
    registrationStatus: text(admin.registrationStatus, 40),
    isActive: admin.isActive === true,
    isEmailVerified: admin.isEmailVerified === true,
    emailVerifiedAt: safeDate(admin.emailVerifiedAt),
    lastLoginAt: safeDate(admin.lastLoginAt),
    loginCount:
      typeof admin.loginCount === "number" && Number.isFinite(admin.loginCount)
        ? admin.loginCount
        : 0,
    permissions: {
      dashboard: permissions.dashboard === true,
      students: permissions.students === true,
      applications: permissions.applications === true,
      internships: permissions.internships === true,
      payments: permissions.payments === true,
      certificates: permissions.certificates === true,
      reports: permissions.reports === true,
      settings: permissions.settings === true,
    },
    security: {
      twoFactorEnabled: security.twoFactorEnabled === true,
      accountLocked: security.accountLocked === true,
      lockedUntil: safeDate(security.lockedUntil),
      passwordChangedAt: safeDate(security.passwordChangedAt),
      lastPasswordResetAt: safeDate(security.lastPasswordResetAt),
      lastSuccessfulLoginAt: safeDate(security.lastSuccessfulLoginAt),
      lastFailedLoginAt: safeDate(security.lastFailedLoginAt),
    },
    createdAt: safeDate(admin.createdAt),
    updatedAt: safeDate(admin.updatedAt),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const auth = await authenticate();

    if (!auth.valid) return auth.response;

    const loaded = await loadActiveAdmin(auth.adminId);

    if (!loaded.valid) return loaded.response;

    return response(
      {
        success: true,
        message: "Student Operations settings loaded successfully.",
        settings: serializeAdmin(loaded.admin as unknown as RecordValue),
        data: serializeAdmin(loaded.admin as unknown as RecordValue),
      },
      200,
      requestId,
    );
  } catch (error) {
    console.error("[Student Admin Settings GET]", {
      requestId,
      name: error instanceof Error ? error.name : "UnknownError",
      code:
        isRecord(error) &&
        (typeof error.code === "string" || typeof error.code === "number")
          ? String(error.code).slice(0, 40)
          : undefined,
    });

    return response(
      {
        success: false,
        message: "Unable to load Student Operations settings.",
        code: "SETTINGS_LOAD_FAILED",
      },
      500,
      requestId,
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    if (!hasValidOrigin(request)) {
      return response(
        {
          success: false,
          message: "Request origin could not be verified.",
          code: "INVALID_ORIGIN",
        },
        403,
        requestId,
      );
    }

    const auth = await authenticate();

    if (!auth.valid) return auth.response;

    const loaded = await loadActiveAdmin(auth.adminId);

    if (!loaded.valid) return loaded.response;

    const parsed = await readJson(request);

    if (!parsed.valid) return parsed.response;

    const validation = validateProfileUpdates(parsed.body);

    if (!validation.valid) {
      return response(
        {
          success: false,
          message: validation.message,
          code: "INVALID_PROFILE_UPDATE",
        },
        400,
        requestId,
      );
    }

    const admin = await loaded.model.findOne({
      _id: auth.adminId,
      role: "Student Operations Admin",
      registrationStatus: "active",
      isActive: true,
      isEmailVerified: true,
      "permissions.settings": true,
    });

    if (!admin) {
      return response(
        {
          success: false,
          message: "Your account or settings permission changed. Reload and try again.",
          code: "ADMIN_STATE_CHANGED",
        },
        409,
        requestId,
      );
    }

    for (const [key, value] of Object.entries(validation.updates)) {
      admin.set(key, value);
    }

    await admin.save();

    const updated = await loaded.model
      .findById(auth.adminId)
      .select(
        "_id adminId username fullName email role designation department phone registrationStatus isActive isEmailVerified emailVerifiedAt lastLoginAt loginCount permissions security createdAt updatedAt",
      )
      .lean();

    if (!updated) {
      return response(
        {
          success: false,
          message: "Settings were saved but the account could not be reloaded.",
          code: "SETTINGS_RELOAD_FAILED",
        },
        500,
        requestId,
      );
    }

    const settings = serializeAdmin(updated as unknown as RecordValue);

    return response(
      {
        success: true,
        message: "Student Operations profile settings saved successfully.",
        settings,
        data: settings,
      },
      200,
      requestId,
    );
  } catch (error) {
    const duplicate =
      isRecord(error) && Number(error.code) === 11000;

    console.error("[Student Admin Settings PATCH]", {
      requestId,
      name: error instanceof Error ? error.name : "UnknownError",
      code:
        isRecord(error) &&
        (typeof error.code === "string" || typeof error.code === "number")
          ? String(error.code).slice(0, 40)
          : undefined,
    });

    return response(
      {
        success: false,
        message: duplicate
          ? "A record with this information already exists."
          : error instanceof mongoose.Error.ValidationError
            ? "One or more profile fields are invalid."
            : "Unable to save Student Operations settings.",
        code: duplicate
          ? "DUPLICATE_VALUE"
          : error instanceof mongoose.Error.ValidationError
            ? "VALIDATION_FAILED"
            : "SETTINGS_UPDATE_FAILED",
      },
      duplicate ? 409 : error instanceof mongoose.Error.ValidationError ? 400 : 500,
      requestId,
    );
  }
}

export async function POST(): Promise<NextResponse> {
  return response(
    {
      success: false,
      message: "Use PATCH to update allowed profile settings.",
      code: "METHOD_NOT_ALLOWED",
    },
    405,
  );
}

export async function PUT(): Promise<NextResponse> {
  return response(
    {
      success: false,
      message: "Use PATCH to update allowed profile settings.",
      code: "METHOD_NOT_ALLOWED",
    },
    405,
  );
}

export async function DELETE(): Promise<NextResponse> {
  return response(
    {
      success: false,
      message: "Settings cannot be deleted.",
      code: "METHOD_NOT_ALLOWED",
    },
    405,
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, PATCH, OPTIONS",
      "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Request-ID",
      "Cache-Control": "no-store",
    },
  });
}
