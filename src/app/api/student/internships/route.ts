import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";

import {
  AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

import {
  getInternshipSummary,
  getPublicInternshipPlans,
} from "@/services/internship.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
} as const;

type TokenPayload = {
  userId?: unknown;
  id?: unknown;
  identifier?: unknown;
  role?: unknown;
  sessionType?: unknown;
};

type StudentIdentityRecord = {
  studentId?: unknown;
  dashboardStudentId?: unknown;
};

function cleanString(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function json(
  body: Record<string, unknown>,
  status = 200,
  requestId?: string,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...NO_CACHE_HEADERS,
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    },
  });
}

function getRequestId(request: NextRequest): string {
  const incoming = cleanString(request.headers.get("x-request-id"), 128);

  // Accept a caller-provided ID only if it is a short, safe correlation value.
  if (/^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)) return incoming;

  return randomUUID();
}

async function authenticateStudent(
  request: NextRequest,
): Promise<{ userId: string } | null> {
  const tokens = [
    request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value,
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const token of tokens) {
    try {
      const payload = await verifyAccessToken(token);
      if (!payload || typeof payload !== "object") continue;

      const claims = payload as TokenPayload;
      const userId = cleanString(
        claims.userId ?? claims.id ?? claims.identifier,
        200,
      );
      const role = cleanString(claims.role, 40).toLowerCase();
      const sessionType = cleanString(claims.sessionType, 60)
        .toLowerCase()
        .replace(/[\s_]+/g, "-");

      if (!userId || role !== "student") continue;

      // This endpoint is for the main student account, not dashboard or admin sessions.
      if (
        sessionType === "admin" ||
        sessionType === "student-dashboard" ||
        sessionType === "dashboard"
      ) {
        continue;
      }

      // Permit only explicitly recognized student session types.
      if (
        sessionType &&
        sessionType !== "student" &&
        sessionType !== "legacy"
      ) {
        continue;
      }

      return { userId };
    } catch {
      // Try the next supported cookie. Never log or expose token contents.
    }
  }

  return null;
}

async function resolveStudentId(userId: string): Promise<string | null> {
  let student: StudentIdentityRecord | null = null;

  if (mongoose.isValidObjectId(userId)) {
    student = (await StudentModel.findById(userId)
      .select("studentId dashboardStudentId")
      .lean()
      .exec()) as StudentIdentityRecord | null;
  }

  if (!student) {
    student = (await StudentModel.findOne({
      $or: [{ studentId: userId }, { dashboardStudentId: userId }],
    })
      .select("studentId dashboardStudentId")
      .lean()
      .exec()) as StudentIdentityRecord | null;
  }

  if (!student) return null;

  // Always resolve to the canonical main-student ID.
  // A dashboard ID alone must never be used as a main-student identity.
  const canonicalStudentId = cleanString(student.studentId, 100);
  return canonicalStudentId || null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const authenticated = await authenticateStudent(request);

    if (!authenticated) {
      return json(
        {
          success: false,
          code: "STUDENT_AUTH_REQUIRED",
          message: "Please log in using your main student credentials.",
        },
        401,
        requestId,
      );
    }

    await connectDB();

    const studentId = await resolveStudentId(authenticated.userId);

    if (!studentId) {
      return json(
        {
          success: false,
          code: "STUDENT_NOT_FOUND",
          message: "Your student account could not be found.",
        },
        404,
        requestId,
      );
    }

    const result = await getInternshipSummary(studentId);

    if (!result.success || !result.data) {
      return json(
        {
          success: false,
          code: result.code || "INTERNSHIP_DATA_UNAVAILABLE",
          message:
            result.message ||
            "Unable to load internship details. Please try again.",
        },
        422,
        requestId,
      );
    }

    const { status, eligibility, plans } = result.data;

    return json(
      {
        success: true,
        message: "Internship details loaded successfully.",
        data: {
          student: {
            studentId: status.studentId,
            applicationId: status.applicationId,
            fullName: status.fullName,
            email: status.email,
          },
          internship: status,
          eligibility,
          plans,
          pricing: getPublicInternshipPlans(),
          workflow: {
            applicationApproved: eligibility.applicationApproved,
            assessmentPassed: eligibility.assessmentPassed,
            canSelectInternship: eligibility.eligible,
            paymentVerified: status.paymentStatus === "paid",
            studentOperationsApproved:
              status.studentOpsApprovalStatus === "approved",
            dashboardActive:
              status.dashboardStatus === "active" &&
              status.dashboardLoginEnabled === true,
          },
        },
      },
      200,
      requestId,
    );
  } catch (error) {
    // Keep logs useful for operators without leaking tokens or private student data.
    console.error("[STUDENT INTERNSHIPS API]", {
      requestId,
      error:
        error instanceof Error ? error.message : "Unknown server error",
    });

    return json(
      {
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to load internship details right now.",
      },
      500,
      requestId,
    );
  }
}

export async function POST(): Promise<NextResponse> {
  return json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message:
        "Use the dedicated internship selection endpoint to select a plan.",
    },
    405,
  );
}

export async function PUT(): Promise<NextResponse> {
  return json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    },
    405,
  );
}

export async function PATCH(): Promise<NextResponse> {
  return json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    },
    405,
  );
}

export async function DELETE(): Promise<NextResponse> {
  return json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    },
    405,
  );
}
