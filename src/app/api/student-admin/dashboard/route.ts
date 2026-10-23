import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

import {
  getStudent,
  listStudents,
} from "@/services/student.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   CYBERNET CAREERS
   STUDENT OPERATIONS DASHBOARD API
   ============================================================

   PURPOSE
   ------------------------------------------------------------
   Read-only Student Operations dashboard endpoint.

   GET
   ------------------------------------------------------------
   /api/student-admin/dashboard

   Optional:
   /api/student-admin/dashboard?id=STUDENT_ID

   Filters:
   - search
   - applicationStatus
   - assessmentStatus
   - internshipStatus
   - paymentStatus
   - studentOpsApprovalStatus
   - studentOpsStatus
   - dashboardStatus
   - page
   - limit

   SECURITY
   ------------------------------------------------------------
   - Admin authentication required
   - Student sessions rejected
   - Student dashboard sessions rejected
   - No lifecycle mutations
   - No password exposure
   - No payment mutation
   - No dashboard activation
   - No credential generation

   Mutations belong to:
   /api/student-admin/students

   ============================================================ */

/* ============================================================
   CONFIG
   ============================================================ */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 120;
const MAX_STUDENT_ID_LENGTH = 120;

const AUTHORIZED_ROLES = new Set<string>([
  "Super Admin",
  "Admin",
  "Student Operations Admin",
]);

/* ============================================================
   TYPES
   ============================================================ */

type JsonObject = Record<string, unknown>;

type AdminTokenPayload = {
  userId?: unknown;
  id?: unknown;
  identifier?: unknown;

  role?: unknown;
  adminRole?: unknown;

  sessionType?: unknown;
  authenticationMode?: unknown;

  userType?: unknown;
  type?: unknown;

  [key: string]: unknown;
};

type AuthenticatedAdmin = {
  id: string;
  role: string;
  sessionType: string;
};

type DashboardQuery = {
  search?: string;

  applicationStatus?: string;
  assessmentStatus?: string;
  internshipStatus?: string;
  paymentStatus?: string;
  studentOpsApprovalStatus?: string;
  studentOpsStatus?: string;
  dashboardStatus?: string;

  page: number;
  limit: number;
};

/* ============================================================
   BASIC HELPERS
   ============================================================ */

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function lowerString(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function isObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/* ============================================================
   REQUEST ID
   ============================================================ */

function getRequestId(
  request: NextRequest,
): string {
  const incoming = cleanString(
    request.headers.get("x-request-id"),
  );

  if (
    incoming &&
    /^[a-zA-Z0-9._:-]{8,128}$/.test(
      incoming,
    )
  ) {
    return incoming;
  }

  try {
    return crypto.randomUUID();
  } catch {
    return `student-ops-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

/* ============================================================
   SECURITY HEADERS
   ============================================================ */

function applySecurityHeaders(
  result: NextResponse,
  requestId: string,
): NextResponse {
  result.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, proxy-revalidate",
  );

  result.headers.set(
    "Pragma",
    "no-cache",
  );

  result.headers.set(
    "Expires",
    "0",
  );

  result.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  result.headers.set(
    "X-Frame-Options",
    "DENY",
  );

  result.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );

  result.headers.set(
    "X-Request-Id",
    requestId,
  );

  return result;
}

/* ============================================================
   RESPONSE HELPERS
   ============================================================ */

function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
): NextResponse {
  return applySecurityHeaders(
    NextResponse.json(
      body,
      {
        status,
      },
    ),
    requestId,
  );
}

function successResponse(
  requestId: string,
  message: string,
  data: unknown,
  status = 200,
): NextResponse {
  return jsonResponse(
    {
      success: true,
      message,
      data,
    },
    status,
    requestId,
  );
}

function errorResponse(
  requestId: string,
  message: string,
  code: string,
  status: number,
): NextResponse {
  return jsonResponse(
    {
      success: false,
      message,
      code,
      requestId,
    },
    status,
    requestId,
  );
}

/* ============================================================
   SAME-ORIGIN VALIDATION
   ============================================================ */

function validateOrigin(
  request: NextRequest,
): boolean {
  const origin = cleanString(
    request.headers.get("origin"),
  );

  /*
   * Normal GET requests may not include Origin.
   */
  if (!origin) {
    return true;
  }

  try {
    const requestUrl = new URL(
      request.url,
    );

    const originUrl = new URL(
      origin,
    );

    return (
      requestUrl.protocol ===
        originUrl.protocol &&
      requestUrl.host ===
        originUrl.host
    );
  } catch {
    return false;
  }
}

/* ============================================================
   ADMIN AUTHENTICATION
   ============================================================ */

async function authenticateAdmin(
  request: NextRequest,
  requestId: string,
): Promise<
  | {
      success: true;
      admin: AuthenticatedAdmin;
    }
  | {
      success: false;
      response: NextResponse;
    }
> {
  /*
   * Prefer dedicated admin cookie.
   * Keep legacy cookie compatibility.
   */
  const token =
    request.cookies.get(
      ADMIN_AUTH_COOKIE_NAME,
    )?.value ||
    request.cookies.get(
      AUTH_COOKIE_NAME,
    )?.value ||
    "";

  if (!token) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Administrator authentication is required.",
        "UNAUTHORIZED",
        401,
      ),
    };
  }

  try {
    const payload =
      await verifyAccessToken(
        token,
      );

    if (!payload) {
      return {
        success: false,
        response: errorResponse(
          requestId,
          "Administrator session is invalid or expired.",
          "INVALID_SESSION",
          401,
        ),
      };
    }

    /*
     * Keep runtime access safe even if the auth helper
     * returns a generic object.
     */
    const source = isObject(payload)
      ? (payload as AdminTokenPayload)
      : {};

    const id = cleanString(
      source.userId ??
        source.id ??
        source.identifier,
    );

    const role = cleanString(
      source.role ??
        source.adminRole,
    );

    const sessionType = lowerString(
      source.sessionType ??
        source.authenticationMode,
    );

    const userType = lowerString(
      source.userType ??
        source.type,
    );

    if (!id) {
      return {
        success: false,
        response: errorResponse(
          requestId,
          "Administrator session is invalid.",
          "INVALID_ADMIN_SESSION",
          401,
        ),
      };
    }

    /*
     * Only admin sessions are allowed.
     */
    if (
      sessionType &&
      sessionType !== "admin"
    ) {
      return {
        success: false,
        response: errorResponse(
          requestId,
          "This session cannot access Student Operations.",
          "INVALID_SESSION_TYPE",
          403,
        ),
      };
    }

    /*
     * Explicit student protection.
     */
    if (
      userType === "student" ||
      userType === "student-dashboard" ||
      userType === "student_dashboard"
    ) {
      return {
        success: false,
        response: errorResponse(
          requestId,
          "Student accounts cannot access Student Operations.",
          "FORBIDDEN",
          403,
        ),
      };
    }

    if (!role) {
      return {
        success: false,
        response: errorResponse(
          requestId,
          "Administrator role information is missing.",
          "ADMIN_ROLE_MISSING",
          403,
        ),
      };
    }

    if (
      !AUTHORIZED_ROLES.has(role)
    ) {
      return {
        success: false,
        response: errorResponse(
          requestId,
          "You are not authorized to access Student Operations.",
          "FORBIDDEN",
          403,
        ),
      };
    }

    return {
      success: true,
      admin: {
        id,
        role,
        sessionType:
          sessionType || "admin",
      },
    };
  } catch (error) {
    console.error(
      "[StudentAdminDashboard] Authentication failed.",
      {
        requestId,
        error,
      },
    );

    return {
      success: false,
      response: errorResponse(
        requestId,
        "Administrator session could not be verified.",
        "AUTHENTICATION_ERROR",
        401,
      ),
    };
  }
}

/* ============================================================
   QUERY HELPERS
   ============================================================ */

function getQuery(
  request: NextRequest,
  key: string,
): string {
  return cleanString(
    request.nextUrl.searchParams.get(
      key,
    ),
  );
}

function positiveInteger(
  value: string,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum,
  );
}

function parseDashboardQuery(
  request: NextRequest,
): DashboardQuery {
  const search = getQuery(
    request,
    "search",
  ).slice(
    0,
    MAX_SEARCH_LENGTH,
  );

  const page = positiveInteger(
    getQuery(
      request,
      "page",
    ),
    1,
    10_000,
  );

  const limit = positiveInteger(
    getQuery(
      request,
      "limit",
    ),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  return {
    search:
      search || undefined,

    applicationStatus:
      getQuery(
        request,
        "applicationStatus",
      ) || undefined,

    assessmentStatus:
      getQuery(
        request,
        "assessmentStatus",
      ) || undefined,

    internshipStatus:
      getQuery(
        request,
        "internshipStatus",
      ) || undefined,

    paymentStatus:
      getQuery(
        request,
        "paymentStatus",
      ) || undefined,

    studentOpsApprovalStatus:
      getQuery(
        request,
        "studentOpsApprovalStatus",
      ) || undefined,

    studentOpsStatus:
      getQuery(
        request,
        "studentOpsStatus",
      ) || undefined,

    dashboardStatus:
      getQuery(
        request,
        "dashboardStatus",
      ) || undefined,

    page,
    limit,
  };
}

/* ============================================================
   SAFE TOTAL EXTRACTION
   ============================================================ */

function extractTotal(
  result: unknown,
): number {
  if (!isObject(result)) {
    return 0;
  }

  const data = result.data;

  if (!isObject(data)) {
    return 0;
  }

  const total = data.total;

  if (
    typeof total === "number" &&
    Number.isFinite(total) &&
    total >= 0
  ) {
    return total;
  }

  return 0;
}

/* ============================================================
   SINGLE STUDENT
   ============================================================ */

async function getSingleStudent(
  request: NextRequest,
  requestId: string,
): Promise<NextResponse | null> {
  const id = getQuery(
    request,
    "id",
  );

  if (!id) {
    return null;
  }

  if (
    id.length >
    MAX_STUDENT_ID_LENGTH
  ) {
    return errorResponse(
      requestId,
      "Student ID is invalid.",
      "INVALID_STUDENT_ID",
      400,
    );
  }

  try {
    const result =
      await getStudent(id);

    if (!result.success) {
      return errorResponse(
        requestId,
        result.message,
        result.code ||
          "STUDENT_NOT_FOUND",
        result.code ===
          "STUDENT_NOT_FOUND"
          ? 404
          : 400,
      );
    }

    return successResponse(
      requestId,
      "Student loaded successfully.",
      {
        student:
          result.data,
      },
    );
  } catch (error) {
    console.error(
      "[StudentAdminDashboard] Single student error.",
      {
        requestId,
        error,
      },
    );

    return errorResponse(
      requestId,
      "Unable to load student.",
      "STUDENT_LOAD_FAILED",
      500,
    );
  }
}

/* ============================================================
   DASHBOARD STATISTICS
   ============================================================ */

async function getStatistics() {
  /*
   * All statistics come from the authoritative
   * student.service.ts.
   *
   * No duplicate MongoDB schema logic here.
   */

  const [
    totalResult,
    approvedResult,
    assessmentPassedResult,
    paidResult,
    pendingReviewResult,
    activeOperationsResult,
    dashboardActiveResult,
    dashboardLockedResult,
    completedResult,
    rejectedResult,
  ] = await Promise.all([
    listStudents({
      page: 1,
      limit: 1,
    }),

    listStudents({
      applicationStatus:
        "approved",
      page: 1,
      limit: 1,
    }),

    listStudents({
      assessmentStatus:
        "passed",
      page: 1,
      limit: 1,
    }),

    listStudents({
      paymentStatus:
        "paid",
      page: 1,
      limit: 1,
    }),

    listStudents({
      paymentStatus:
        "paid",
      studentOpsApprovalStatus:
        "pending",
      studentOpsStatus:
        "pending-review",
      page: 1,
      limit: 1,
    }),

    listStudents({
      studentOpsStatus:
        "active",
      page: 1,
      limit: 1,
    }),

    listStudents({
      dashboardStatus:
        "active",
      page: 1,
      limit: 1,
    }),

    listStudents({
      dashboardStatus:
        "locked",
      page: 1,
      limit: 1,
    }),

    listStudents({
      internshipStatus:
        "completed",
      page: 1,
      limit: 1,
    }),

    listStudents({
      applicationStatus:
        "rejected",
      page: 1,
      limit: 1,
    }),
  ]);

  const results = [
    totalResult,
    approvedResult,
    assessmentPassedResult,
    paidResult,
    pendingReviewResult,
    activeOperationsResult,
    dashboardActiveResult,
    dashboardLockedResult,
    completedResult,
    rejectedResult,
  ];

  const failed = results.find(
    (item) =>
      !item.success,
  );

  if (failed) {
    throw new Error(
      failed.message ||
        "Unable to build Student Operations statistics.",
    );
  }

  return {
    totalStudents:
      extractTotal(
        totalResult,
      ),

    approvedStudents:
      extractTotal(
        approvedResult,
      ),

    assessmentPassedStudents:
      extractTotal(
        assessmentPassedResult,
      ),

    paidStudents:
      extractTotal(
        paidResult,
      ),

    pendingReviewStudents:
      extractTotal(
        pendingReviewResult,
      ),

    activeOperationsStudents:
      extractTotal(
        activeOperationsResult,
      ),

    dashboardActiveStudents:
      extractTotal(
        dashboardActiveResult,
      ),

    dashboardLockedStudents:
      extractTotal(
        dashboardLockedResult,
      ),

    completedStudents:
      extractTotal(
        completedResult,
      ),

    rejectedStudents:
      extractTotal(
        rejectedResult,
      ),
  };
}

/* ============================================================
   GET DASHBOARD
   ============================================================ */

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  try {
    /*
     * Same-origin protection.
     */
    if (
      !validateOrigin(request)
    ) {
      return errorResponse(
        requestId,
        "Cross-origin dashboard requests are not allowed.",
        "INVALID_ORIGIN",
        403,
      );
    }

    /*
     * Admin authentication.
     */
    const authentication =
      await authenticateAdmin(
        request,
        requestId,
      );

    if (
      !authentication.success
    ) {
      return authentication.response;
    }

    /*
     * Optional single student lookup.
     *
     * /api/student-admin/dashboard?id=STU-XXXX
     */
    const singleStudent =
      await getSingleStudent(
        request,
        requestId,
      );

    if (singleStudent) {
      return singleStudent;
    }

    /*
     * Main dashboard query.
     */
    const query =
      parseDashboardQuery(
        request,
      );

    /*
     * Student list and statistics can
     * safely execute in parallel.
     */
    const [
      studentsResult,
      statistics,
    ] = await Promise.all([
      listStudents(
        query,
      ),
      getStatistics(),
    ]);

    if (
      !studentsResult.success
    ) {
      return errorResponse(
        requestId,
        studentsResult.message,
        studentsResult.code ||
          "STUDENTS_LOAD_FAILED",
        400,
      );
    }

    const data =
      studentsResult.data;

    return successResponse(
      requestId,
      "Student Operations dashboard loaded successfully.",
      {
        statistics,

        students:
          data?.students ?? [],

        pagination: {
          page:
            data?.page ??
            query.page,

          limit:
            data?.limit ??
            query.limit,

          total:
            data?.total ??
            0,

          totalPages:
            data?.totalPages ??
            0,
        },

        filters: {
          search:
            query.search ??
            null,

          applicationStatus:
            query.applicationStatus ??
            null,

          assessmentStatus:
            query.assessmentStatus ??
            null,

          internshipStatus:
            query.internshipStatus ??
            null,

          paymentStatus:
            query.paymentStatus ??
            null,

          studentOpsApprovalStatus:
            query.studentOpsApprovalStatus ??
            null,

          studentOpsStatus:
            query.studentOpsStatus ??
            null,

          dashboardStatus:
            query.dashboardStatus ??
            null,
        },

        viewer: {
          id:
            authentication.admin.id,

          role:
            authentication.admin.role,
        },

        generatedAt:
          new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error(
      "[GET /api/student-admin/dashboard] Unexpected error.",
      {
        requestId,
        error,
      },
    );

    return errorResponse(
      requestId,
      "Unable to load Student Operations dashboard.",
      "INTERNAL_SERVER_ERROR",
      500,
    );
  }
}

/* ============================================================
   UNSUPPORTED METHODS
   ============================================================ */

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  return errorResponse(
    requestId,
    "POST is not supported on the dashboard endpoint. Use /api/student-admin/students for Student Operations actions.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  return errorResponse(
    requestId,
    "PUT is not supported on the dashboard endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  return errorResponse(
    requestId,
    "PATCH is not supported on the dashboard endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  return errorResponse(
    requestId,
    "DELETE is not supported on the dashboard endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function HEAD(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  return errorResponse(
    requestId,
    "HEAD is not supported.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

/* ============================================================
   OPTIONS
   ============================================================ */

export async function OPTIONS(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  const result =
    new NextResponse(
      null,
      {
        status: 204,
        headers: {
          Allow:
            "GET, OPTIONS",

          "Access-Control-Allow-Methods":
            "GET, OPTIONS",

          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With, X-Request-Id",

          "Cache-Control":
            "no-store",
        },
      },
    );

  return applySecurityHeaders(
    result,
    requestId,
  );
}