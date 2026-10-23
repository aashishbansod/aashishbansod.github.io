import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import AdminModel from "@/models/Admin";
import connectDB from "@/lib/db";
import { hashUserPassword } from "@/services/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
// CONFIG
// ============================================================

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const MIN_ADMIN_ID_LENGTH = 3;
const MAX_ADMIN_ID_LENGTH = 50;

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 120;

const MAX_EMAIL_LENGTH = 254;

const ALLOWED_ROLES = [
  "Super Admin",
  "Admin",
  "HR",
  "Assessment Manager",
  "Support",
] as const;

type AdminRole = (typeof ALLOWED_ROLES)[number];

// ============================================================
// RESPONSE HELPER
// ============================================================

function apiResponse(
  data: unknown,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate",

      Pragma: "no-cache",

      Expires: "0",

      "X-Content-Type-Options": "nosniff",

      "X-Frame-Options": "DENY",

      "Referrer-Policy":
        "strict-origin-when-cross-origin",

      "X-Robots-Tag":
        "noindex, nofollow, noarchive",
    },
  });
}

// ============================================================
// SECURITY
// ============================================================

function safeSecretCompare(
  provided: string,
  expected: string
): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    expectedBuffer
  );
}

// ============================================================
// VALIDATION
// ============================================================

function isString(
  value: unknown
): value is string {
  return typeof value === "string";
}

function isValidLength(
  value: string,
  min: number,
  max: number
): boolean {
  return (
    value.length >= min &&
    value.length <= max
  );
}

function isValidEmail(
  email: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function isValidAdminId(
  adminId: string
): boolean {
  return /^[A-Z0-9_-]+$/.test(adminId);
}

// ============================================================
// POST /api/auth/setup-admin
// ============================================================

export async function POST(
  request: NextRequest
) {
  try {
    // ========================================================
    // 1. CHECK SETUP SECRET
    // ========================================================

    const setupSecret =
      process.env.ADMIN_SETUP_SECRET;

    if (
      !setupSecret ||
      setupSecret.length < 32
    ) {
      console.error(
        "[SETUP-ADMIN] ADMIN_SETUP_SECRET is missing or too short."
      );

      return apiResponse(
        {
          success: false,
          message:
            "Admin setup is not securely configured.",
          code:
            "SETUP_SECRET_NOT_CONFIGURED",
        },
        503
      );
    }

    const providedSecret =
      request.headers.get(
        "x-admin-setup-secret"
      );

    if (
      !providedSecret ||
      !safeSecretCompare(
        providedSecret,
        setupSecret
      )
    ) {
      return apiResponse(
        {
          success: false,
          message: "Unauthorized.",
          code: "UNAUTHORIZED",
        },
        401
      );
    }

    // ========================================================
    // 2. CHECK CONTENT TYPE
    // ========================================================

    const contentType =
      request.headers.get("content-type") || "";

    if (
      !contentType
        .toLowerCase()
        .includes("application/json")
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "Content-Type must be application/json.",
          code:
            "INVALID_CONTENT_TYPE",
        },
        415
      );
    }

    // ========================================================
    // 3. READ JSON BODY
    // ========================================================

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return apiResponse(
        {
          success: false,
          message:
            "Invalid JSON request body.",
          code: "INVALID_JSON",
        },
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "Invalid request body.",
          code: "INVALID_BODY",
        },
        400
      );
    }

    const data =
      body as Record<string, unknown>;

    // ========================================================
    // 4. READ INPUT
    // ========================================================

    const adminId = isString(data.adminId)
      ? data.adminId
          .trim()
          .toUpperCase()
      : "";

    const fullName = isString(data.fullName)
      ? data.fullName.trim()
      : "";

    const email = isString(data.email)
      ? data.email
          .trim()
          .toLowerCase()
      : "";

    const password = isString(data.password)
      ? data.password
      : "";

    const designation =
      isString(data.designation)
        ? data.designation.trim()
        : "Founder / Administrator";

    const department =
      isString(data.department)
        ? data.department.trim()
        : "Administration";

    const employeeCode =
      isString(data.employeeCode)
        ? data.employeeCode
            .trim()
            .toUpperCase()
        : adminId;

    const phone = isString(data.phone)
      ? data.phone.trim()
      : "";

    // ========================================================
    // 5. VALIDATE ADMIN ID
    // ========================================================

    if (
      !isValidLength(
        adminId,
        MIN_ADMIN_ID_LENGTH,
        MAX_ADMIN_ID_LENGTH
      ) ||
      !isValidAdminId(adminId)
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "Admin ID must contain only letters, numbers, hyphens or underscores.",
          code:
            "INVALID_ADMIN_ID",
        },
        400
      );
    }

    // ========================================================
    // 6. VALIDATE NAME
    // ========================================================

    if (
      !isValidLength(
        fullName,
        MIN_NAME_LENGTH,
        MAX_NAME_LENGTH
      )
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "Invalid admin name.",
          code: "INVALID_NAME",
        },
        400
      );
    }

    // ========================================================
    // 7. VALIDATE EMAIL
    // ========================================================

    if (
      !isValidLength(
        email,
        5,
        MAX_EMAIL_LENGTH
      ) ||
      !isValidEmail(email)
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "Invalid email address.",
          code: "INVALID_EMAIL",
        },
        400
      );
    }

    // ========================================================
    // 8. VALIDATE PASSWORD
    // ========================================================

    if (
      password.length <
        MIN_PASSWORD_LENGTH ||
      password.length >
        MAX_PASSWORD_LENGTH
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "Password must contain 8-128 characters.",
          code: "INVALID_PASSWORD",
        },
        400
      );
    }

    // ========================================================
    // 9. VALIDATE OPTIONAL FIELDS
    // ========================================================

    if (
      designation.length > 120 ||
      department.length > 120 ||
      employeeCode.length > 50 ||
      phone.length > 20
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "One or more fields exceed the allowed length.",
          code:
            "FIELD_TOO_LONG",
        },
        400
      );
    }

    // ========================================================
    // 10. FIRST ADMIN IS ALWAYS SUPER ADMIN
    // ========================================================

    const role: AdminRole =
      "Super Admin";

    // ========================================================
    // 11. CONNECT DATABASE
    // ========================================================

    await connectDB();

    // ========================================================
    // 12. ONLY ALLOW INITIAL ADMIN
    // ========================================================

    const existingAdmin =
      await AdminModel.exists({});

    if (existingAdmin) {
      return apiResponse(
        {
          success: false,
          message:
            "Initial admin setup has already been completed.",
          code:
            "ADMIN_SETUP_ALREADY_COMPLETED",
        },
        403
      );
    }

    // ========================================================
    // 13. CHECK DUPLICATES
    // ========================================================

    const duplicate =
      await AdminModel.findOne({
        $or: [
          { adminId },
          { email },
        ],
      })
        .select("_id adminId email")
        .lean()
        .exec();

    if (duplicate) {
      if (
        duplicate.adminId === adminId
      ) {
        return apiResponse(
          {
            success: false,
            message:
              "Admin ID already exists.",
            code:
              "ADMIN_ID_ALREADY_EXISTS",
          },
          409
        );
      }

      return apiResponse(
        {
          success: false,
          message:
            "Admin email already exists.",
          code:
            "ADMIN_EMAIL_ALREADY_EXISTS",
        },
        409
      );
    }

    // ========================================================
    // 14. HASH PASSWORD
    // ========================================================

    const passwordHash =
      await hashUserPassword(password);

    if (
      !passwordHash ||
      passwordHash.length < 20
    ) {
      console.error(
        "[SETUP-ADMIN] Password hashing failed."
      );

      return apiResponse(
        {
          success: false,
          message:
            "Unable to securely process password.",
          code:
            "PASSWORD_HASH_FAILED",
        },
        500
      );
    }

    // ========================================================
    // 15. CREATE SUPER ADMIN
    // ========================================================

    const admin =
      await AdminModel.create({
        adminId,

        fullName,

        email,

        password: passwordHash,

        role,

        designation,

        department,

        employeeCode,

        phone,

        profilePhoto: "",

        isEmailVerified: true,

        emailVerifiedAt:
          new Date(),

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

          passwordChangedAt:
            new Date(),
        },

        notifications: {
          email: true,
          whatsapp: true,
          browser: true,
        },
      });

    // ========================================================
    // 16. SUCCESS RESPONSE
    // ========================================================

    return apiResponse(
      {
        success: true,

        message:
          "Initial Super Admin account created successfully.",

        admin: {
          id: String(admin._id),

          adminId: admin.adminId,

          fullName: admin.fullName,

          email: admin.email,

          role: admin.role,

          isActive: admin.isActive,

          isEmailVerified:
            admin.isEmailVerified,
        },
      },
      201
    );
  } catch (error: unknown) {
    // ========================================================
    // ERROR HANDLING
    // ========================================================

    console.error(
      "[SETUP-ADMIN ERROR]",
      error
    );

    // MongoDB duplicate key
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code ===
        11000
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "An admin with the same unique information already exists.",
          code:
            "DUPLICATE_ADMIN",
        },
        409
      );
    }

    return apiResponse(
      {
        success: false,
        message:
          "Unable to create the initial admin account.",
        code:
          "INTERNAL_SERVER_ERROR",
      },
      500
    );
  }
}

// ============================================================
// DISABLE OTHER METHODS
// ============================================================

function methodNotAllowed() {
  return apiResponse(
    {
      success: false,
      message: "Method not allowed.",
      code: "METHOD_NOT_ALLOWED",
    },
    405
  );
}

export async function GET() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}