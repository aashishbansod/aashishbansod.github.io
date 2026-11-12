import "server-only";

import { NextRequest, NextResponse } from "next/server";
import Admin from "@/models/Admin";
import { connectDB } from "@/lib/db";
import {
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_AUTH_COOKIE_OPTIONS,
  createAccessToken,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

type LoginBody = {
  identifier?: unknown;
  email?: unknown;
  adminId?: unknown;
  password?: unknown;
};

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
    },
  });
}

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = forwarded?.split(",")[0]?.trim() || realIp?.trim() || "";
  return candidate.slice(0, 64);
}

function isValidIdentifier(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 254 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return json({ success: false, message: "Request body is too large." }, 413);
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ success: false, message: "Content-Type must be application/json." }, 415);
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return json({ success: false, message: "Request body is too large." }, 413);
    }

    let body: LoginBody;
    try {
      body = JSON.parse(rawBody) as LoginBody;
    } catch {
      return json({ success: false, message: "Invalid request body." }, 400);
    }

    const rawIdentifier =
      typeof body.identifier === "string"
        ? body.identifier
        : typeof body.email === "string"
          ? body.email
          : typeof body.adminId === "string"
            ? body.adminId
            : "";

    const identifier = rawIdentifier.trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (
      !isValidIdentifier(identifier) ||
      password.length === 0 ||
      password.length > 1024
    ) {
      return json({ success: false, message: "Invalid email/admin ID or password." }, 400);
    }

    await connectDB();

    const admin = await Admin.findOne({
      $or: [{ email: identifier }, { adminId: identifier.toUpperCase() }],
    }).select("+password");

    if (!admin) {
      return json({ success: false, message: "Invalid email/admin ID or password." }, 401);
    }

    const now = new Date();
    const lockedUntil = admin.security?.lockedUntil
      ? new Date(admin.security.lockedUntil)
      : null;
    const isLocked =
      admin.security?.accountLocked === true &&
      (!lockedUntil || lockedUntil.getTime() > now.getTime());

    if (isLocked) {
      const retryAfterSeconds = lockedUntil
        ? Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000))
        : undefined;

      const response = json(
        {
          success: false,
          message: "Account is temporarily locked. Please contact an administrator or try again later.",
          ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
        },
        423,
      );

      if (retryAfterSeconds) {
        response.headers.set("Retry-After", String(retryAfterSeconds));
      }

      return response;
    }

    const passwordMatches = await verifyPassword(password, admin.password);

    if (!passwordMatches) {
      const nextLockUntil = new Date(Date.now() + LOCK_DURATION_MS);

      await Admin.updateOne(
        { _id: admin._id },
        [
          {
            $set: {
              "security.loginAttempts": {
                $add: [{ $ifNull: ["$security.loginAttempts", 0] }, 1],
              },
              "security.accountLocked": {
                $gte: [
                  { $add: [{ $ifNull: ["$security.loginAttempts", 0] }, 1] },
                  MAX_LOGIN_ATTEMPTS,
                ],
              },
              "security.lockedUntil": {
                $cond: [
                  {
                    $gte: [
                      { $add: [{ $ifNull: ["$security.loginAttempts", 0] }, 1] },
                      MAX_LOGIN_ATTEMPTS,
                    ],
                  },
                  nextLockUntil,
                  "$security.lockedUntil",
                ],
              },
            },
          },
        ] as never,
        { timestamps: false },
      );

      return json({ success: false, message: "Invalid email/admin ID or password." }, 401);
    }

    if (!admin.isActive) {
      return json({ success: false, message: "This admin account is inactive. Contact the Super Admin." }, 403);
    }

    if (!admin.isEmailVerified) {
      return json({ success: false, message: "Verify your admin email before signing in." }, 403);
    }

    if (admin.security?.twoFactorEnabled) {
      return json(
        {
          success: false,
          code: "TWO_FACTOR_REQUIRED",
          message: "Two-factor authentication is enabled for this account, but this login endpoint does not complete the second-factor challenge.",
        },
        403,
      );
    }

    const role = admin.role;
    const token = createAccessToken({
      id: String(admin._id),
      identifier: admin.email,
      role: "admin",
      adminRole: role,
      sessionType: "admin",
    });

    const loginUpdate = await Admin.updateOne(
      { _id: admin._id, isActive: true, isEmailVerified: true },
      {
        $set: {
          lastLogin: new Date(),
          "security.loginAttempts": 0,
          "security.accountLocked": false,
          "security.lockedUntil": null,
        },
        $inc: { loginCount: 1 },
      },
      { runValidators: true },
    );

    if (loginUpdate.matchedCount !== 1) {
      return json(
        {
          success: false,
          message: "This admin account is no longer eligible to sign in.",
        },
        403,
      );
    }

    const permissions = admin.permissions
      ? {
          dashboard: admin.permissions.dashboard === true,
          students: admin.permissions.students === true,
          applications: admin.permissions.applications === true,
          assessment: admin.permissions.assessment === true,
          certificates: admin.permissions.certificates === true,
          payments: admin.permissions.payments === true,
          internships: admin.permissions.internships === true,
          email: admin.permissions.email === true,
          whatsapp: admin.permissions.whatsapp === true,
          reports: admin.permissions.reports === true,
          settings: admin.permissions.settings === true,
          admins: admin.permissions.admins === true,
        }
      : {};

    const response = json({
      success: true,
      message: "Admin login successful.",
      user: {
        id: String(admin._id),
        adminId: admin.adminId,
        fullName: admin.fullName,
        email: admin.email,
        role,
        designation: admin.designation || "",
        department: admin.department || "",
        profilePhoto: admin.profilePhoto || "",
        permissions,
        isEmailVerified: admin.isEmailVerified,
      },
    });

    response.cookies.set(
      ADMIN_AUTH_COOKIE_NAME,
      token,
      ADMIN_AUTH_COOKIE_OPTIONS,
    );

    return response;
  } catch (error) {
    const value = error as { name?: unknown; code?: unknown };
    console.error("[AdminLogin] Request failed", {
      name: typeof value?.name === "string" ? value.name : "UnknownError",
      code:
        typeof value?.code === "string" || typeof value?.code === "number"
          ? String(value.code)
          : undefined,
      ip: getClientIdentifier(request),
    });

    return json(
      {
        success: false,
        message: "Unable to sign in right now. Please try again later.",
      },
      500,
    );
  }
}
