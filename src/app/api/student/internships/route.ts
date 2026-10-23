
import { NextRequest, NextResponse } from "next/server";
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
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};

type TokenPayload = {
  userId?: unknown;
  id?: unknown;
  identifier?: unknown;
  role?: unknown;
  sessionType?: unknown;
};

function cleanString(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function json(
  body: Record<string, unknown>,
  status = 200,
  requestId?: string,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...NO_CACHE_HEADERS,
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    },
  });
}

function getRequestId(request: NextRequest): string {
  const incoming = cleanString(
    request.headers.get("x-request-id"),
    128,
  );

  if (/^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)) {
    return incoming;
  }

  return crypto.randomUUID();
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
      );
      const role = cleanString(claims.role).toLowerCase();
      const sessionType = cleanString(claims.sessionType).toLowerCase();

      if (!userId || role !== "student") continue;

      // Main student login only. Reject admin and dashboard sessions.
      if (
        sessionType === "admin" ||
        sessionType === "student-dashboard"
      ) {
        continue;
      }

      if (
        sessionType &&
        sessionType !== "student" &&
        sessionType !== "legacy"
      ) {
        continue;
      }

      return { userId };
    } catch {
      // Try the next supported cookie; never log or expose the token.
    }
  }

  return null;
}

async function resolveStudentId(userId: string): Promise<string | null> {
  let student:
    | {
        studentId?: unknown;
        dashboardStudentId?: unknown;
      }
    | null = null;

  if (mongoose.isValidObjectId(userId)) {
    student = await StudentModel.findById(userId)
      .select("studentId dashboardStudentId")
      .lean()
      .exec();
  }

  if (!student) {
    student = await StudentModel.findOne({
      $or: [
        { studentId: userId },
        { dashboardStudentId: userId },
      ],
    })
      .select("studentId dashboardStudentId")
      .lean()
      .exec();
  }

  if (!student) return null;

  // Internship selection is only for the main student account.
  // A dashboard credential must never become a main student identity.
  const studentId = cleanString(student.studentId, 100);
  return studentId || null;
}

export async function GET(request: NextRequest) {
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
              status.dashboardLoginEnabled,
          },
        },
      },
      200,
      requestId,
    );
  } catch (error) {
    console.error("[STUDENT INTERNSHIPS API]", {
      requestId,
      error:
        error instanceof Error
          ? error.message
          : "Unknown server error",
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

export async function POST() {
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

export async function PUT() {
  return json(
    { success: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
    405,
  );
}

export async function PATCH() {
  return json(
    { success: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
    405,
  );
}

export async function DELETE() {
  return json(
    { success: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
    405,
  );
}
