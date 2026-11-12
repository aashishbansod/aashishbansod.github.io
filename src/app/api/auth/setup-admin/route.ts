import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import AdminModel from "@/models/Admin";
import connectDB from "@/lib/db";
import { hashUserPassword } from "@/services/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 8_192;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_ADMIN_ID_LENGTH = 3;
const MAX_ADMIN_ID_LENGTH = 50;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_OPTIONAL_FIELD_LENGTH = 120;
const SETUP_LOCK_ID = "cybernet-initial-super-admin";
const ALLOWED_BODY_KEYS = [
  "adminId",
  "fullName",
  "email",
  "password",
  "designation",
  "department",
  "employeeCode",
  "phone",
] as const;

type JsonRecord = Record<string, unknown>;

type BodyResult =
  | { success: true; body: string }
  | { success: false; reason: "too-large" | "invalid-encoding" };

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

function getRequestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();

  return supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
}

function jsonResponse(
  body: JsonRecord,
  status: number,
  requestId: string,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "X-Request-ID": requestId,
      ...(process.env.NODE_ENV === "production"
        ? { "Strict-Transport-Security": "max-age=31536000" }
        : {}),
    },
  });
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin")?.trim();

  if (origin) {
    try {
      return new URL(origin).origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  return fetchSite === "same-origin" || fetchSite === "none";
}

function safeSecretCompare(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    providedBuffer.length === 0 ||
    providedBuffer.length !== expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

async function readRequestBody(request: NextRequest): Promise<BodyResult> {
  const lengthHeader = request.headers.get("content-length");
  const declaredLength =
    lengthHeader && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : 0;

  if (
    Number.isSafeInteger(declaredLength) &&
    declaredLength > MAX_BODY_BYTES
  ) {
    return { success: false, reason: "too-large" };
  }

  if (!request.body) return { success: true, body: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { success: false, reason: "too-large" };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      success: true,
      body: new TextDecoder("utf-8", { fatal: true }).decode(combined),
    };
  } catch {
    return { success: false, reason: "invalid-encoding" };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasControlCharacters(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidAdminId(adminId: string): boolean {
  return /^[A-Z0-9_-]+$/.test(adminId);
}

function isValidOptionalText(value: string, maxLength: number): boolean {
  return value.length <= maxLength && !hasControlCharacters(value);
}

function logSetupFailure(requestId: string, error: unknown): void {
  const details =
    error !== null && typeof error === "object"
      ? (error as { name?: unknown; code?: unknown })
      : {};

  console.error("[CyberNet Careers] Initial admin setup failed.", {
    requestId,
    errorName:
      typeof details.name === "string"
        ? details.name.slice(0, 80)
        : "UnknownError",
    ...(typeof details.code === "string" || typeof details.code === "number"
      ? { errorCode: String(details.code).slice(0, 40) }
      : {}),
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function methodNotAllowed(request: NextRequest): NextResponse {
  const requestId = getRequestId(request);
  const response = jsonResponse(
    {
      success: false,
      message: "Method not allowed.",
      code: "METHOD_NOT_ALLOWED",
      requestId,
    },
    405,
    requestId,
  );

  response.headers.set("Allow", "POST, OPTIONS");
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);
  let lockOwner: string | null = null;
  let adminCreated = false;

  try {
    if (!isSameOriginRequest(request)) {
      return jsonResponse(
        {
          success: false,
          message: "Cross-origin setup requests are not allowed.",
          code: "INVALID_ORIGIN",
          requestId,
        },
        403,
        requestId,
      );
    }

    const setupSecret = process.env.ADMIN_SETUP_SECRET?.trim() || "";

    if (Buffer.byteLength(setupSecret, "utf8") < 32) {
      return jsonResponse(
        {
          success: false,
          message: "Admin setup is not securely configured.",
          code: "SETUP_SECRET_NOT_CONFIGURED",
          requestId,
        },
        503,
        requestId,
      );
    }

    const providedSecret = request.headers.get("x-admin-setup-secret") || "";

    if (!safeSecretCompare(providedSecret, setupSecret)) {
      return jsonResponse(
        {
          success: false,
          message: "Unauthorized.",
          code: "UNAUTHORIZED",
          requestId,
        },
        401,
        requestId,
      );
    }

    const contentType = (request.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();

    if (contentType !== "application/json") {
      return jsonResponse(
        {
          success: false,
          message: "Content-Type must be application/json.",
          code: "INVALID_CONTENT_TYPE",
          requestId,
        },
        415,
        requestId,
      );
    }

    const bodyResult = await readRequestBody(request);

    if (!bodyResult.success) {
      return jsonResponse(
        {
          success: false,
          message:
            bodyResult.reason === "too-large"
              ? "Request body is too large."
              : "Request body contains invalid text encoding.",
          code:
            bodyResult.reason === "too-large"
              ? "REQUEST_TOO_LARGE"
              : "INVALID_ENCODING",
          requestId,
        },
        bodyResult.reason === "too-large" ? 413 : 400,
        requestId,
      );
    }

    if (!bodyResult.body.trim()) {
      return jsonResponse(
        {
          success: false,
          message: "Request body is required.",
          code: "INVALID_BODY",
          requestId,
        },
        400,
        requestId,
      );
    }

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(bodyResult.body);
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Invalid JSON request body.",
          code: "INVALID_JSON",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (!isRecord(parsedBody)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid request body.",
          code: "INVALID_BODY",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (Object.keys(parsedBody).some((key) => !ALLOWED_BODY_KEYS.includes(key as (typeof ALLOWED_BODY_KEYS)[number]))) {
      return jsonResponse(
        {
          success: false,
          message: "Request contains unsupported fields.",
          code: "UNSUPPORTED_FIELDS",
          requestId,
        },
        400,
        requestId,
      );
    }

    const adminId = stringValue(parsedBody.adminId).toUpperCase();
    const fullName = stringValue(parsedBody.fullName);
    const email = stringValue(parsedBody.email).toLowerCase();
    const password =
      typeof parsedBody.password === "string" ? parsedBody.password : "";
    const designation =
      stringValue(parsedBody.designation) || "Founder / Administrator";
    const department =
      stringValue(parsedBody.department) || "Administration";
    const employeeCode =
      stringValue(parsedBody.employeeCode).toUpperCase() || adminId;
    const phone = stringValue(parsedBody.phone);

    if (
      adminId.length < MIN_ADMIN_ID_LENGTH ||
      adminId.length > MAX_ADMIN_ID_LENGTH ||
      !isValidAdminId(adminId)
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Admin ID must contain 3-50 letters, numbers, hyphens or underscores.",
          code: "INVALID_ADMIN_ID",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (
      fullName.length < MIN_NAME_LENGTH ||
      fullName.length > MAX_NAME_LENGTH ||
      hasControlCharacters(fullName)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Admin name must contain 2-120 valid characters.",
          code: "INVALID_NAME",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (
      email.length < 5 ||
      email.length > MAX_EMAIL_LENGTH ||
      !isValidEmail(email)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid email address.",
          code: "INVALID_EMAIL",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH ||
      password.includes("\u0000")
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Password must contain 8-128 characters.",
          code: "INVALID_PASSWORD",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (
      !isValidOptionalText(designation, MAX_OPTIONAL_FIELD_LENGTH) ||
      !isValidOptionalText(department, MAX_OPTIONAL_FIELD_LENGTH) ||
      !isValidOptionalText(employeeCode, 50) ||
      !isValidOptionalText(phone, 20)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "One or more fields contain invalid or excessive text.",
          code: "INVALID_OPTIONAL_FIELD",
          requestId,
        },
        400,
        requestId,
      );
    }

    await connectDB();

    const existingAdmin = await AdminModel.exists({});

    if (existingAdmin) {
      return jsonResponse(
        {
          success: false,
          message: "Initial admin setup has already been completed.",
          code: "ADMIN_SETUP_ALREADY_COMPLETED",
          requestId,
        },
        403,
        requestId,
      );
    }

    lockOwner = randomUUID();
    const lockCollection = AdminModel.db.collection("cybernet_setup_locks");

    try {
      await lockCollection.insertOne({
        _id: SETUP_LOCK_ID as unknown as Types.ObjectId,
        owner: lockOwner,
        createdAt: new Date(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return jsonResponse(
          {
            success: false,
            message: "Initial admin setup is already in progress or completed.",
            code: "ADMIN_SETUP_LOCKED",
            requestId,
          },
          409,
          requestId,
        );
      }

      throw error;
    }

    const adminCreatedAfterLock = await AdminModel.exists({});

    if (adminCreatedAfterLock) {
      return jsonResponse(
        {
          success: false,
          message: "Initial admin setup has already been completed.",
          code: "ADMIN_SETUP_ALREADY_COMPLETED",
          requestId,
        },
        403,
        requestId,
      );
    }

    const duplicate = await AdminModel.findOne({
      $or: [{ adminId }, { email }],
    })
      .select("_id adminId email")
      .lean()
      .exec();

    if (duplicate) {
      const duplicateRecord = duplicate as {
        adminId?: string;
        email?: string;
      };

      return jsonResponse(
        {
          success: false,
          message:
            duplicateRecord.adminId === adminId
              ? "Admin ID already exists."
              : "Admin email already exists.",
          code:
            duplicateRecord.adminId === adminId
              ? "ADMIN_ID_ALREADY_EXISTS"
              : "ADMIN_EMAIL_ALREADY_EXISTS",
          requestId,
        },
        409,
        requestId,
      );
    }

    const passwordHash = await hashUserPassword(password);

    if (
      typeof passwordHash !== "string" ||
      !passwordHash.startsWith("scrypt$") ||
      passwordHash.length < 20
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Unable to securely process password.",
          code: "PASSWORD_HASH_FAILED",
          requestId,
        },
        500,
        requestId,
      );
    }

    const admin = await AdminModel.create({
      adminId,
      fullName,
      email,
      password: passwordHash,
      role: "Super Admin",
      designation,
      department,
      employeeCode,
      phone,
      profilePhoto: "",
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
      lastLogin: null,
      loginCount: 0,
      refreshToken: "",
      permissions: {
        dashboard: true,
        students: true,
        applications: true,
        assessment: true,
        certificates: true,
        payments: true,
        internships: true,
        email: true,
        whatsapp: true,
        reports: true,
        settings: true,
        admins: true,
      },
      security: {
        twoFactorEnabled: false,
        loginAttempts: 0,
        accountLocked: false,
        lockedUntil: null,
        passwordChangedAt: new Date(),
      },
      notifications: {
        email: true,
        whatsapp: true,
        browser: true,
      },
    });

    adminCreated = true;

    return jsonResponse(
      {
        success: true,
        message: "Initial Super Admin account created successfully.",
        admin: {
          id: String(admin._id),
          adminId: admin.adminId,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          isActive: admin.isActive,
          isEmailVerified: admin.isEmailVerified,
        },
        requestId,
      },
      201,
      requestId,
    );
  } catch (error: unknown) {
    logSetupFailure(requestId, error);

    if (isDuplicateKeyError(error)) {
      return jsonResponse(
        {
          success: false,
          message:
            "An admin with the same unique information already exists, or initial setup was completed by another request.",
          code: "DUPLICATE_ADMIN",
          requestId,
        },
        409,
        requestId,
      );
    }

    return jsonResponse(
      {
        success: false,
        message: "Unable to create the initial admin account.",
        code: "INTERNAL_SERVER_ERROR",
        requestId,
      },
      500,
      requestId,
    );
  } finally {
    if (lockOwner && !adminCreated) {
      try {
        await AdminModel.db
          .collection("cybernet_setup_locks")
          .deleteOne({ id: SETUP_LOCK_ID, owner: lockOwner });
      } catch (error) {
        logSetupFailure(requestId, error);
      }
    }
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      "X-Request-ID": requestId,
      Allow: "POST, OPTIONS",
    },
  });
}
