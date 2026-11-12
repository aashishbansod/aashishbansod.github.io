import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidObjectId } from "mongoose";
import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";
import {
  STUDENT_DASHBOARD_AUTH_COOKIE_NAME,
  verifyAccessToken,
  isStudentDashboardSession,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  Vary: "Cookie",
};

type RouteFailure = {
  status: number;
  code: string;
  message: string;
};

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function fail(status: number, code: string, message: string): RouteFailure {
  return { status, code, message };
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function iso(value: unknown): string | null {
  return dateValue(value)?.toISOString() ?? null;
}

function safeString(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function safeNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function percentage(value: unknown): number {
  return Math.min(100, Math.max(0, safeNumber(value)));
}

function buildProfile(student: Record<string, unknown>, now: Date) {
  const internshipStart = dateValue(student.internshipStartedAt);
  const internshipEnd = dateValue(student.internshipEndsAt);
  const credentialEnd = dateValue(student.dashboardCredentialsExpiresAt);
  const effectiveEnd =
    internshipEnd && credentialEnd
      ? new Date(Math.min(internshipEnd.getTime(), credentialEnd.getTime()))
      : internshipEnd ?? credentialEnd;
  const remainingMs = effectiveEnd
    ? Math.max(0, effectiveEnd.getTime() - now.getTime())
    : null;
  const durationDays = Math.max(0, Math.floor(safeNumber(student.internshipDurationDays)));
  const totalDays = internshipStart && effectiveEnd
    ? Math.max(1, Math.ceil((effectiveEnd.getTime() - internshipStart.getTime()) / 86400000))
    : durationDays;

  const taskProgress = percentage(student.taskCompletionPercentage);
  const learningProgress = percentage(student.learningProgressPercentage);
  const projectProgress = percentage(student.projectCompletionPercentage);
  const overallProgress = percentage(
    safeNumber(student.overallProgressPercentage,
      Math.round((taskProgress + learningProgress + projectProgress) / 3)),
  );

  return {
    id: safeString(String(student._id ?? ""), 64),
    studentId: safeString(student.studentId, 60),
    dashboardStudentId: safeString(student.dashboardStudentId, 60),
    fullName: safeString(student.fullName, 120),
    email: safeString(student.email, 254).toLowerCase(),
    phone: safeString(student.phone, 20),
    profileImage: safeString(student.profileImage, 2048),
    education: {
      collegeName: safeString(student.collegeName, 180),
      university: safeString(student.university, 180),
      course: safeString(student.course, 160),
      branchStream: safeString(student.branchStream, 160),
      year: safeString(student.year, 40),
      semester: safeString(student.semester, 40),
    },
    internship: {
      track: safeString(student.internshipTrack, 160),
      plan: safeString(student.internshipPlan, 60),
      durationDays,
      startedAt: iso(internshipStart),
      endsAt: iso(internshipEnd),
      status: safeString(student.internshipStatus, 40),
      daysRemaining: remainingMs === null ? null : Math.ceil(remainingMs / 86400000),
      totalDays,
    },
    workflow: {
      applicationStatus: safeString(student.applicationStatus, 40),
      assessmentStatus: safeString(student.assessmentStatus, 40),
      resultStatus: safeString(student.resultStatus, 40),
      paymentStatus: safeString(student.paymentStatus, 40),
      studentOpsApprovalStatus: safeString(student.studentOpsApprovalStatus, 40),
      studentOpsStatus: safeString(student.studentOpsStatus, 40),
      dashboardStatus: safeString(student.dashboardStatus, 40),
      mustChangePassword: student.dashboardMustChangePassword === true,
    },
    progress: {
      overall: overallProgress,
      tasks: taskProgress,
      learning: learningProgress,
      projects: projectProgress,
      completedLearningDays: Math.max(0, safeNumber(student.completedLearningDays)),
      currentLearningDay: Math.max(0, safeNumber(student.currentLearningDay)),
      totalLearningDays: durationDays,
    },
    attendance: {
      percentage: percentage(student.attendancePercentage),
      presentDays: Math.max(0, safeNumber(student.attendancePresentDays)),
      absentDays: Math.max(0, safeNumber(student.attendanceAbsentDays)),
      totalDays: Math.max(0, safeNumber(student.attendanceTotalDays)),
      lastMarkedAt: iso(student.lastAttendanceAt),
    },
    certificate: {
      status: safeString(student.certificateStatus, 40) || "not-eligible",
      certificateId: safeString(student.certificateId, 100),
      generatedAt: iso(student.certificateGeneratedAt),
    },
    account: {
      lastLoginAt: iso(student.dashboardLastLoginAt),
      credentialsExpiresAt: iso(credentialEnd),
      internshipEndsAt: iso(internshipEnd),
    },
  };
}

async function authenticateDashboardStudent():
  Promise<{ student: Record<string, unknown> } | { failure: RouteFailure }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_DASHBOARD_AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return {
      failure: fail(401, "DASHBOARD_AUTH_REQUIRED", "Please sign in to your student dashboard."),
    };
  }

  const payload = verifyAccessToken(token);

  if (!payload || !isStudentDashboardSession({
    id: payload.sub,
    identifier: payload.identifier,
    role: payload.role,
    adminRole: payload.adminRole,
    sessionType: payload.sessionType,
    sessionId: payload.jti,
  })) {
    return {
      failure: fail(401, "INVALID_DASHBOARD_SESSION", "Your dashboard session is invalid or expired."),
    };
  }

  if (!isValidObjectId(payload.sub)) {
    return {
      failure: fail(401, "INVALID_DASHBOARD_IDENTITY", "Your dashboard session is invalid."),
    };
  }

  await connectDB();

  const student = await StudentModel.findById(payload.sub)
    .select([
      "_id studentId dashboardStudentId fullName email phone profileImage",
      "collegeName university course branchStream year semester",
      "applicationStatus assessmentStatus resultStatus paymentStatus",
      "studentOpsApprovalStatus studentOpsStatus",
      "dashboardStatus dashboardLoginEnabled dashboardCredentialsGenerated",
      "dashboardCredentialsExpiresAt dashboardMustChangePassword",
      "dashboardAccountLocked dashboardLockedUntil dashboardDeactivatedAt",
      "dashboardLastLoginAt dashboardDeactivationReason",
      "internshipTrack internshipPlan internshipDurationDays",
      "internshipStartedAt internshipEndsAt internshipStatus",
      "taskCompletionPercentage learningProgressPercentage",
      "projectCompletionPercentage overallProgressPercentage",
      "completedLearningDays currentLearningDay",
      "attendancePercentage attendancePresentDays attendanceAbsentDays",
      "attendanceTotalDays lastAttendanceAt",
      "certificateStatus certificateId certificateGeneratedAt",
      "isActive",
    ].join(" "))
    .lean()
    .exec() as Record<string, unknown> | null;

  if (!student) {
    return {
      failure: fail(401, "STUDENT_ACCOUNT_NOT_FOUND", "Student account was not found."),
    };
  }

  const now = new Date();
  const credentialExpiry = dateValue(student.dashboardCredentialsExpiresAt);
  const internshipExpiry = dateValue(student.internshipEndsAt);
  const lockedUntil = dateValue(student.dashboardLockedUntil);

  if (student.isActive === false) {
    return {
      failure: fail(403, "STUDENT_ACCOUNT_DISABLED", "Your student account is inactive."),
    };
  }

  if (student.dashboardLoginEnabled !== true ||
      student.dashboardCredentialsGenerated !== true ||
      student.studentOpsApprovalStatus !== "approved" ||
      !["active", "completed"].includes(String(student.dashboardStatus)) ||
      !["active", "completed"].includes(String(student.studentOpsStatus))) {
    return {
      failure: fail(403, "DASHBOARD_NOT_ACTIVE", "Your student dashboard is not active. Please contact Student Operations."),
    };
  }

  if (student.dashboardDeactivatedAt) {
    return {
      failure: fail(403, "DASHBOARD_DEACTIVATED", "Your student dashboard has been deactivated."),
    };
  }

  if (student.dashboardAccountLocked === true &&
      (!lockedUntil || lockedUntil.getTime() > now.getTime())) {
    return {
      failure: fail(423, "DASHBOARD_ACCOUNT_LOCKED", "Your dashboard account is temporarily locked."),
    };
  }

  if ((credentialExpiry && credentialExpiry.getTime() <= now.getTime()) ||
      (internshipExpiry && internshipExpiry.getTime() <= now.getTime())) {
    return {
      failure: fail(403, "INTERNSHIP_EXPIRED", "Your internship access period has ended."),
    };
  }

  if (!credentialExpiry || !internshipExpiry) {
    return {
      failure: fail(403, "DASHBOARD_EXPIRY_NOT_CONFIGURED", "Dashboard access expiry is not configured. Please contact Student Operations."),
    };
  }

  if (student.applicationStatus !== "approved") {
    return {
      failure: fail(403, "APPLICATION_NOT_APPROVED", "Your application is not approved."),
    };
  }

  if (!["passed", "evaluated"].includes(String(student.assessmentStatus)) ||
      student.resultStatus !== "passed") {
    return {
      failure: fail(403, "ASSESSMENT_NOT_PASSED", "You must pass the required assessment before accessing the internship dashboard."),
    };
  }

  if (!["approved", "active", "completed"].includes(String(student.internshipStatus))) {
    return {
      failure: fail(403, "INTERNSHIP_NOT_APPROVED", "Your internship has not been approved for dashboard access."),
    };
  }

  if (student.paymentStatus !== "paid") {
    return {
      failure: fail(403, "PAYMENT_NOT_VERIFIED", "Internship payment has not been verified."),
    };
  }

  return { student };
}

export async function GET() {
  try {
    const auth = await authenticateDashboardStudent();

    if ("failure" in auth) {
      return json({
        success: false,
        message: auth.failure.message,
        code: auth.failure.code,
      }, auth.failure.status);
    }

    const now = new Date();
    const profile = buildProfile(auth.student, now);

    return json({
      success: true,
      message: "Student dashboard loaded successfully.",
      data: profile,
      meta: {
        serverTime: now.toISOString(),
        timezone: "UTC",
        accessExpiresAt: profile.account.credentialsExpiresAt,
      },
    });
  } catch (error) {
    const value = error as { name?: unknown; code?: unknown };
    console.error("[STUDENT DASHBOARD GET]", {
      name: typeof value?.name === "string" ? value.name : "Error",
      code: typeof value?.code === "string" || typeof value?.code === "number"
        ? String(value.code)
        : undefined,
    });

    return json({
      success: false,
      message: "Unable to load the student dashboard right now.",
      code: "STUDENT_DASHBOARD_LOAD_FAILED",
    }, 500);
  }
}
