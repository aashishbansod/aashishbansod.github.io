import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAuthToken,
} from "@/lib/auth";
import {
  getStudentOperationsDashboardRecord,
  listStudentOperationsDashboardRecords,
  type StudentOperationsDashboardQuery,
  type StudentOperationsDashboardStudent,
} from "@/services/student.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 120;
const MAX_STUDENT_ID_LENGTH = 150;
const MAX_FILTER_LENGTH = 80;

type JsonObject = Record<string, unknown>;

type AuthenticatedStudentAdmin = {
  id: string;
  identifier: string;
  role: "Student Operations Admin";
};

type InternshipPlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";

const INTERNSHIP_PLANS: Record<
  InternshipPlanCode,
  { name: string; durationDays: number; amountRupees: number; amountPaise: number }
> = {
  ONE_MONTH: {
    name: "1 Month",
    durationDays: 30,
    amountRupees: 499,
    amountPaise: 49900,
  },
  THREE_MONTHS: {
    name: "3 Months",
    durationDays: 90,
    amountRupees: 999,
    amountPaise: 99900,
  },
  SIX_MONTHS: {
    name: "6 Months",
    durationDays: 180,
    amountRupees: 1699,
    amountPaise: 169900,
  },
};

function normalizePlanCode(value: unknown): InternshipPlanCode | null {
  const normalized = cleanString(value, 80)
    .toUpperCase()
    .replace(/[\\s-]+/g, "_");

  if (["ONE_MONTH", "1_MONTH", "1M", "ONE", "MONTHLY"].includes(normalized)) {
    return "ONE_MONTH";
  }

  if (
    ["THREE_MONTHS", "3_MONTHS", "3M", "THREE_MONTH", "QUARTERLY"].includes(
      normalized,
    )
  ) {
    return "THREE_MONTHS";
  }

  if (
    ["SIX_MONTHS", "6_MONTHS", "6M", "SIX_MONTH", "HALF_YEARLY"].includes(
      normalized,
    )
  ) {
    return "SIX_MONTHS";
  }

  return null;
}

function resolvePlanCode(student: StudentOperationsDashboardStudent): InternshipPlanCode | null {
  const record = student as unknown as JsonObject;
  const candidates = [
    record.internshipPlanCode,
    record.planCode,
    record.internshipPlan,
    record.internshipPlanName,
  ];

  for (const candidate of candidates) {
    const direct = normalizePlanCode(candidate);
    if (direct) return direct;
  }

  const duration = safeCount(record.internshipDurationDays);
  if (duration === 30) return "ONE_MONTH";
  if (duration === 90) return "THREE_MONTHS";
  if (duration === 180) return "SIX_MONTHS";

  return null;
}

function cleanString(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRole(value: unknown): string {
  return cleanString(value, 100).toLowerCase().replace(/[\s_-]+/g, " ");
}

function requestIdFor(request: NextRequest): string {
  const supplied = cleanString(request.headers.get("x-request-id"), 128);
  return supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
}

function secure(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Vary", "Cookie");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("X-Request-Id", requestId);
  return response;
}

function reply(
  requestId: string,
  status: number,
  body: Record<string, unknown>,
): NextResponse {
  return secure(NextResponse.json(body, { status }), requestId);
}

function fail(
  requestId: string,
  status: number,
  code: string,
  message: string,
): NextResponse {
  return reply(requestId, status, {
    success: false,
    code,
    message,
    requestId,
  });
}

function validateOrigin(request: NextRequest): boolean {
  const origin = cleanString(request.headers.get("origin"), 2048);

  if (!origin) {
    return request.headers.get("sec-fetch-site")?.toLowerCase() !== "cross-site";
  }

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return (
      originUrl.protocol === requestUrl.protocol &&
      originUrl.host === requestUrl.host
    );
  } catch {
    return false;
  }
}

async function authenticateStudentAdmin(
  request: NextRequest,
  requestId: string,
): Promise<
  | { admin: AuthenticatedStudentAdmin }
  | { response: NextResponse }
> {
  const token = request.cookies
    .get(STUDENT_ADMIN_AUTH_COOKIE_NAME)
    ?.value?.trim();

  if (!token) {
    return {
      response: fail(
        requestId,
        401,
        "UNAUTHORIZED",
        "Student Operations Admin authentication is required.",
      ),
    };
  }

  try {
    const verified: unknown = await verifyAuthToken(token);

    if (!isObject(verified)) {
      return {
        response: fail(
          requestId,
          401,
          "INVALID_SESSION",
          "Student Operations Admin session is invalid or expired.",
        ),
      };
    }

    const role = normalizeRole(verified.adminRole);
    const userRole = normalizeRole(verified.role);
    const sessionType = cleanString(verified.sessionType, 80)
      .toLowerCase()
      .replace(/[\s_-]+/g, "-");
    const id = cleanString(
      verified.userId ?? verified.id ?? verified.identifier,
      150,
    );
    const identifier = cleanString(
      verified.identifier ?? verified.email ?? verified.adminId,
      254,
    );

    if (
      !id ||
      userRole !== "admin" ||
      role !== "student operations admin" ||
      sessionType !== "student-admin"
    ) {
      return {
        response: fail(
          requestId,
          403,
          "FORBIDDEN",
          "This session is not authorized for Student Operations.",
        ),
      };
    }

    return {
      admin: {
        id,
        identifier,
        role: "Student Operations Admin",
      },
    };
  } catch (error) {
    console.error(
      "[StudentAdminDashboard] Authentication verification failed.",
      { requestId, error },
    );

    return {
      response: fail(
        requestId,
        401,
        "AUTHENTICATION_ERROR",
        "Student Operations Admin session could not be verified.",
      ),
    };
  }
}

function queryValue(
  request: NextRequest,
  key: string,
  maxLength = MAX_FILTER_LENGTH,
): string {
  return cleanString(request.nextUrl.searchParams.get(key), maxLength);
}

function positiveInteger(
  value: string,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function parseQuery(request: NextRequest): StudentOperationsDashboardQuery & {
  page: number;
  limit: number;
} {
  return {
    search: queryValue(request, "search", MAX_SEARCH_LENGTH) || undefined,
    applicationStatus:
      queryValue(request, "applicationStatus") || undefined,
    assessmentStatus:
      queryValue(request, "assessmentStatus") || undefined,
    internshipStatus:
      queryValue(request, "internshipStatus") || undefined,
    paymentStatus: queryValue(request, "paymentStatus") || undefined,
    studentOpsApprovalStatus:
      queryValue(request, "studentOpsApprovalStatus") || undefined,
    studentOpsStatus: queryValue(request, "studentOpsStatus") || undefined,
    dashboardStatus: queryValue(request, "dashboardStatus") || undefined,
    page: positiveInteger(queryValue(request, "page", 16), 1, 10000),
    limit: positiveInteger(
      queryValue(request, "limit", 16),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    ),
  };
}

function extractTotal(result: unknown): number {
  if (!isObject(result) || result.success !== true || !isObject(result.data)) {
    throw new Error("A Student Operations statistics query returned an invalid response.");
  }

  const total = result.data.total;

  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
    throw new Error("A Student Operations statistics query returned an invalid total.");
  }

  return total;
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function safeDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value !== "string" && typeof value !== "number") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeStudent(
  student: StudentOperationsDashboardStudent,
): Record<string, unknown> {
  const record = student as unknown as JsonObject;
  const planCode = resolvePlanCode(student);
  const plan = planCode ? INTERNSHIP_PLANS[planCode] : null;
  const fullName = cleanString(student.fullName, 200) || "Student";
  const domain = cleanString(student.internshipTrack, 150) ||
    cleanString(student.internshipPlan, 150) ||
    "Unassigned";

  const studentOpsStatus = cleanString(student.studentOpsStatus, 80);
  const studentOpsApprovalStatus = cleanString(student.studentOpsApprovalStatus, 80);

  return {
    id: cleanString(student.id, 150),
    mainStudentId: cleanString(student.mainStudentId, 150),
    studentId: cleanString(student.studentId, 150) ||
      cleanString(student.dashboardStudentId, 150) || "—",
    dashboardStudentId: cleanString(student.dashboardStudentId, 150),
    applicationId: cleanString(student.applicationId, 150),
    fullName,
    name: fullName,
    email: cleanString(student.email, 254),
    phone: cleanString(student.phone, 40),
    domain,
    applicationStatus: cleanString(student.applicationStatus, 80),
    assessmentStatus: cleanString(student.assessmentStatus, 80),
    internshipStatus: cleanString(student.internshipStatus, 80),
    internshipPlan: cleanString(student.internshipPlan, 150),
    internshipPlanCode: planCode,
    internshipPlanName: plan?.name || cleanString(record.internshipPlanName, 150),
    internshipDurationDays: plan?.durationDays || safeCount(record.internshipDurationDays),
    internshipPlanAmount: plan?.amountRupees || safeNumber(record.internshipPlanAmount),
    internshipPlanAmountPaise: plan?.amountPaise || safeCount(record.internshipPlanAmountPaise),
    internshipTrack: cleanString(student.internshipTrack, 150),
    paymentAttemptGroupId: cleanString(record.paymentAttemptGroupId, 150),
    razorpayCheckoutExpiresAt: safeDate(record.razorpayCheckoutExpiresAt),
    paymentExpiredAt: safeDate(record.paymentExpiredAt),
    paymentVerificationSource: cleanString(record.paymentVerificationSource, 40),
    status: studentOpsStatus || studentOpsApprovalStatus || "pending",
    studentOpsApprovalStatus,
    studentOpsStatus,
    paymentStatus: cleanString(student.paymentStatus, 80),
    paymentAmount: safeNumber(student.paymentAmount),
    paymentCurrency: cleanString(student.paymentCurrency, 12),
    dashboardStatus: cleanString(student.dashboardStatus, 80),
    dashboardLoginEnabled: student.dashboardLoginEnabled === true,
    dashboardCredentialsGenerated: student.dashboardCredentialsGenerated === true,
    learningStatus: cleanString(student.learningStatus, 80),
    taskCompletionPercentage: Math.min(100, safeNumber(student.taskCompletionPercentage)),
    learningProgressPercentage: Math.min(100, safeNumber(student.learningProgressPercentage)),
    attendancePercentage: Math.min(100, safeNumber(student.attendancePercentage)),
    weeklyAssessmentStatus: cleanString(student.weeklyAssessmentStatus, 80),
    saturdayAssessmentStatus: cleanString(student.saturdayAssessmentStatus, 80),
    projectStatus: cleanString(student.projectStatus, 80),
    certificateStatus: cleanString(student.certificateStatus, 80),
    certificateId: cleanString(student.certificateId, 150),
    createdAt: safeDate(student.createdAt),
    updatedAt: safeDate(student.updatedAt),
  };
}

async function loadStats() {
  const requests = [
    listStudentOperationsDashboardRecords({ page: 1, limit: 1 }),
    listStudentOperationsDashboardRecords({
      studentOpsStatus: "active",
      page: 1,
      limit: 1,
    }),
    listStudentOperationsDashboardRecords({
      applicationStatus: "pending",
      page: 1,
      limit: 1,
    }),
    listStudentOperationsDashboardRecords({
      paymentStatus: "paid",
      studentOpsApprovalStatus: "pending",
      page: 1,
      limit: 1,
    }),
    listStudentOperationsDashboardRecords({
      applicationStatus: "rejected",
      page: 1,
      limit: 1,
    }),
    listStudentOperationsDashboardRecords({
      paymentStatus: "paid",
      page: 1,
      limit: 1,
    }),
    listStudentOperationsDashboardRecords({
      paymentStatus: "pending",
      page: 1,
      limit: 1,
    }),
    listStudentOperationsDashboardRecords({
      paymentStatus: "failed",
      page: 1,
      limit: 1,
    }),
    listStudentOperationsDashboardRecords({
      paymentStatus: "expired",
      page: 1,
      limit: 1,
    }),
    listStudentOperationsDashboardRecords({
      paymentStatus: "refunded",
      page: 1,
      limit: 1,
    }),
  ] as const;

  const results = await Promise.all(requests);
  const failed = results.find((result) => !result.success);

  if (failed) {
    throw new Error(
      failed.message || "Unable to build Student Operations statistics.",
    );
  }

  return {
    totalStudents: extractTotal(results[0]),
    activeStudents: extractTotal(results[1]),
    pendingApplications: extractTotal(results[2]),
    pendingOperationsApprovals: extractTotal(results[3]),
    failedStudents: extractTotal(results[4]),
    paidEnrollments: extractTotal(results[5]),
    pendingPayments: extractTotal(results[6]),
    failedPayments: extractTotal(results[7]),
    expiredPayments: extractTotal(results[8]),
    refundedPayments: extractTotal(results[9]),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  try {
    if (!validateOrigin(request)) {
      return fail(
        requestId,
        403,
        "INVALID_ORIGIN",
        "Cross-origin dashboard requests are not allowed.",
      );
    }

    const authentication = await authenticateStudentAdmin(request, requestId);
    if ("response" in authentication) return authentication.response;

    const id = queryValue(request, "id", MAX_STUDENT_ID_LENGTH);

    if (id) {
      const result = await getStudentOperationsDashboardRecord(id);

      if (!result.success || !result.data) {
        const status =
          result.code === "STUDENT_NOT_FOUND"
            ? 404
            : result.code === "INTERNAL_SERVER_ERROR"
              ? 500
              : 400;

        return fail(
          requestId,
          status,
          result.code || "STUDENT_LOAD_FAILED",
          result.message || "Student Operations record could not be loaded.",
        );
      }

      return reply(requestId, 200, {
        success: true,
        message: "Student Operations record loaded successfully.",
        data: { student: normalizeStudent(result.data) },
        requestId,
      });
    }

    const query = parseQuery(request);
    const [studentsResult, stats] = await Promise.all([
      listStudentOperationsDashboardRecords(query),
      loadStats(),
    ]);

    if (!studentsResult.success || !studentsResult.data) {
      const status =
        studentsResult.code === "INTERNAL_SERVER_ERROR"
          ? 500
          : studentsResult.code === "STUDENT_NOT_FOUND"
            ? 404
            : 400;

      return fail(
        requestId,
        status,
        studentsResult.code || "STUDENTS_LOAD_FAILED",
        studentsResult.message || "Unable to load Student Operations records.",
      );
    }

    const resultData = studentsResult.data;

    if (
      !Array.isArray(resultData.students) ||
      !Number.isSafeInteger(resultData.total) ||
      resultData.total < 0 ||
      !Number.isSafeInteger(resultData.page) ||
      resultData.page < 1 ||
      !Number.isSafeInteger(resultData.limit) ||
      resultData.limit < 1 ||
      !Number.isSafeInteger(resultData.totalPages) ||
      resultData.totalPages < 0
    ) {
      throw new Error("Student Operations returned an invalid dashboard result.");
    }

    const students = resultData.students.map(normalizeStudent);
    const total = resultData.total;
    const page = resultData.page;
    const limit = resultData.limit;
    const totalPages = resultData.totalPages;

    return reply(requestId, 200, {
      success: true,
      message: "Student Operations dashboard loaded successfully.",
      data: {
        stats,
        internshipPlans: Object.entries(INTERNSHIP_PLANS).map(([code, plan]) => ({
          code,
          name: plan.name,
          durationDays: plan.durationDays,
          amountRupees: plan.amountRupees,
          amountPaise: plan.amountPaise,
          currency: "INR",
        })),
        recentStudents: students,
        generatedAt: new Date().toISOString(),
        statistics: {
          totalStudents: stats.totalStudents,
          activeOperationsStudents: stats.activeStudents,
          pendingReviewStudents: stats.pendingOperationsApprovals,
          paidStudents: stats.paidEnrollments,
          rejectedStudents: stats.failedStudents,
        },
        students,
        pagination: { page, limit, total, totalPages },
        filters: query,
        viewer: {
          id: authentication.admin.id,
          identifier: authentication.admin.identifier,
          role: authentication.admin.role,
        },
      },
      requestId,
    });
  } catch (error) {
    console.error(
      "[GET /api/student-admin/dashboard] Unexpected error.",
      { requestId, error },
    );

    return fail(
      requestId,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load Student Operations dashboard.",
    );
  }
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFor(request);
  const response = new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });

  return secure(response, requestId);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return fail(
    requestIdFor(request),
    405,
    "METHOD_NOT_ALLOWED",
    "POST is not supported on the dashboard endpoint.",
  );
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return fail(
    requestIdFor(request),
    405,
    "METHOD_NOT_ALLOWED",
    "PUT is not supported on the dashboard endpoint.",
  );
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return fail(
    requestIdFor(request),
    405,
    "METHOD_NOT_ALLOWED",
    "PATCH is not supported on the dashboard endpoint.",
  );
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return fail(
    requestIdFor(request),
    405,
    "METHOD_NOT_ALLOWED",
    "DELETE is not supported on the dashboard endpoint.",
  );
}
