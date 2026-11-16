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

  "Cache-Control":

    "private, no-store, no-cache, max-age=0, must-revalidate",

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
  accountLocked?: unknown;
  loginEnabled?: unknown;
  applicationStatus?: unknown;
  adminApprovalStatus?: unknown;
  assessmentStatus?: unknown;
  resultStatus?: unknown;
  assessmentScore?: unknown;
  internshipApplicationAllowed?: unknown;
  internshipStatus?: unknown;
  paymentStatus?: unknown;
};

type AuthenticatedStudent = {

  userId: string;

};

function cleanString(value: unknown, maxLength = 200): string {

  if (typeof value !== "string") return "";

  return value

    .replace(/\u0000/g, "")

    .trim()

    .slice(0, maxLength);

}

function json(

  body: Record<string, unknown>,

  statusCode = 200,

  requestId?: string,

): NextResponse {

  return NextResponse.json(body, {

    status: statusCode,

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

  return randomUUID();

}

function normalizeSessionType(value: unknown): string {

  return cleanString(value, 60)

    .toLowerCase()

    .replace(/[\s_]+/g, "-");

}

async function authenticateStudent(

  request: NextRequest,

): Promise<AuthenticatedStudent | null> {

  const tokens = [

    request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value,

    request.cookies.get(AUTH_COOKIE_NAME)?.value,

  ].filter((value): value is string => Boolean(value?.trim()));

  for (const token of tokens) {

    try {

      const payload = await verifyAccessToken(token);

      if (!payload || typeof payload !== "object") {

        continue;

      }

      const claims = payload as TokenPayload;

      const userId = cleanString(

        claims.userId ?? claims.id ?? claims.identifier,

        200,

      );

      const role = cleanString(claims.role, 40).toLowerCase();

      const sessionType = normalizeSessionType(claims.sessionType);

      if (!userId || role !== "student") {

        continue;

      }

      if (

        sessionType === "admin" ||

        sessionType === "student-dashboard" ||

        sessionType === "dashboard"

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

    } catch {}

  }

  return null;

}

async function resolveStudent(

  userId: string,

): Promise<StudentIdentityRecord | null> {

  const fields =
    "studentId dashboardStudentId accountLocked loginEnabled applicationStatus adminApprovalStatus assessmentStatus resultStatus assessmentScore internshipApplicationAllowed internshipStatus paymentStatus";

  if (mongoose.isValidObjectId(userId)) {

    const byObjectId = await StudentModel.findById(userId)

      .select(fields)

      .lean()

      .exec();

    if (byObjectId) {

      return byObjectId as StudentIdentityRecord;

    }

  }

  const byIdentifier = await StudentModel.findOne({

    $or: [

      { studentId: userId },

      { dashboardStudentId: userId },

    ],

  })

    .select(fields)

    .lean()

    .exec();

  return (byIdentifier as StudentIdentityRecord | null) ?? null;

}

function isOperationsApproved(value: unknown): boolean {

  return cleanString(value, 40).toLowerCase() === "approved";

}

export async function GET(

  request: NextRequest,

): Promise<NextResponse> {

  const requestId = getRequestId(request);

  try {

    const authenticated = await authenticateStudent(request);

    if (!authenticated) {

      return json(

        {

          success: false,

          code: "STUDENT_AUTH_REQUIRED",

          message:

            "Please log in using your main student credentials.",

        },

        401,

        requestId,

      );

    }

    await connectDB();

    const student = await resolveStudent(authenticated.userId);

    if (!student || !cleanString(student.studentId, 100)) {

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

    if (student.accountLocked === true) {

      return json(

        {

          success: false,

          code: "ACCOUNT_LOCKED",

          message:

            "Your account is locked. Please contact support.",

        },

        403,

        requestId,

      );

    }

    if (student.loginEnabled === false) {

      return json(

        {

          success: false,

          code: "STUDENT_LOGIN_DISABLED",

          message: "Your student login is currently disabled.",

        },

        403,

        requestId,

      );

    }

    const studentId = cleanString(student.studentId, 100);
    const eligibilityRepairApplicationApproved =
      cleanString(student.applicationStatus, 40).toLowerCase() === "approved" &&
      cleanString(student.adminApprovalStatus, 40).toLowerCase() === "approved";
    const eligibilityRepairAssessmentPassed =
      cleanString(student.assessmentStatus, 40).toLowerCase() === "passed" &&
      cleanString(student.resultStatus, 40).toLowerCase() === "passed" &&
      Number.isFinite(Number(student.assessmentScore)) &&
      Number(student.assessmentScore) >= 36;
    const paymentStatus = cleanString(student.paymentStatus, 40).toLowerCase();
    const internshipStatus = cleanString(student.internshipStatus, 40).toLowerCase();
    const terminalInternshipState = ["completed", "expired", "rejected"].includes(internshipStatus);

    if (
      eligibilityRepairApplicationApproved &&
      eligibilityRepairAssessmentPassed &&
      student.internshipApplicationAllowed !== true &&
      paymentStatus !== "paid" &&
      paymentStatus !== "refunded" &&
      !terminalInternshipState
    ) {
      const repaired = await StudentModel.updateOne(
        {
          studentId,
          applicationStatus: "approved",
          adminApprovalStatus: "approved",
          assessmentStatus: "passed",
          resultStatus: "passed",
          assessmentScore: { $gte: 36 },
          paymentStatus: { $nin: ["paid", "refunded"] },
          internshipStatus: { $nin: ["completed", "expired", "rejected"] },
          internshipApplicationAllowed: { $ne: true },
        },
        {
          $set: {
            internshipApplicationAllowed: true,
          },
        },
      ).exec();

      if (Number(repaired.matchedCount ?? 0) === 1) {
        student.internshipApplicationAllowed = true;
      }
    }

    const result = await getInternshipSummary(studentId);

    if (!result.success || !result.data) {

      const serviceCode =

        cleanString(result.code, 100) ||

        "INTERNSHIP_DATA_UNAVAILABLE";

      console.warn("[STUDENT INTERNSHIPS API] Summary unavailable", {

        requestId,

        code: serviceCode,

      });

      const statusCode =

        serviceCode === "STUDENT_NOT_FOUND" ? 404 :

        serviceCode.includes("NOT_ELIGIBLE") ||

        serviceCode.includes("NOT_ALLOWED") ? 403 :

        422;

      return json(

        {

          success: false,

          code: serviceCode,

          message:

            result.message ||

            "Unable to load internship details. Please try again.",

        },

        statusCode,

        requestId,

      );

    }

    const { status, eligibility, plans } = result.data;

    const applicationApproved =

      eligibility.applicationApproved === true;

    const assessmentPassed =

      eligibility.assessmentPassed === true;

    const canSelectInternship =

      eligibility.eligible === true &&

      applicationApproved &&

      assessmentPassed;

    const paymentVerified =

      cleanString(status.paymentStatus, 40).toLowerCase() === "paid";

    const operationsApproved = isOperationsApproved(

      status.studentOpsApprovalStatus,

    );

    const dashboardActive =

      paymentVerified &&

      operationsApproved &&

      cleanString(status.dashboardStatus, 40).toLowerCase() === "active" &&

      status.dashboardLoginEnabled === true;

    const publicPricing = getPublicInternshipPlans();

    return json(

      {

        success: true,

        code: "INTERNSHIP_SUMMARY_LOADED",

        message: "Internship details loaded successfully.",

        data: {

          student: {

            studentId: status.studentId,

            applicationId: status.applicationId,

            fullName: status.fullName,

            email: status.email,

          },

          internship: status,

          eligibility: {

            ...eligibility,

            applicationApproved,

            assessmentPassed,

            eligible: canSelectInternship,

          },

          plans,

          pricing: publicPricing,

          workflow: {

            applicationApproved,

            assessmentPassed,

            canSelectInternship,

            paymentVerified,

            studentOperationsApproved: operationsApproved,

            dashboardActive,

            dashboardAccessAllowed: dashboardActive,

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

        message:

          "Unable to load internship details right now.",

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
