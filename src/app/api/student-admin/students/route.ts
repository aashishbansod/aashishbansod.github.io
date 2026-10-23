import {
  NextRequest,
  NextResponse,
} from "next/server";

import crypto from "node:crypto";

import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

import {
  approveStudentOperations,
  generateDashboardCredentials,
  listStudents,
  type StudentActor,
} from "@/services/student.service";

/* ============================================================
   CYBERNET CAREERS
   STUDENT OPERATIONS / STUDENT ADMIN
   STUDENTS API
   ============================================================

   GET
   ------------------------------------------------------------
   /api/student-admin/students

   Features:
   - secure admin authentication
   - pagination
   - search
   - application filters
   - assessment filters
   - internship filters
   - payment filters
   - Student Operations filters
   - dashboard filters
   - pending review queue

   POST
   ------------------------------------------------------------
   approve
   reject
   generate-credentials
   resend-credentials

   IMPORTANT WORKFLOW
   ------------------------------------------------------------

   Application
        ↓
   Main Admin Approval
        ↓
   Main Student Login
        ↓
   Assessment
        ↓
   Assessment Passed
        ↓
   Internship Selection
        ↓
   Razorpay Payment
        ↓
   Server Payment Verification
        ↓
   Student Operations Review
        ↓
   Student Operations Approval
        ↓
   Dashboard Credentials
        ↓
   Dashboard Active
        ↓
   Internship
        ↓
   Project
        ↓
   Certificate

   SECURITY
   ------------------------------------------------------------
   - Admin session required.
   - Student session rejected.
   - Dashboard session rejected.
   - Student Operations roles only.
   - Passwords never returned.
   - Password hashes never returned.
   - Payment cannot be manually marked paid.
   - Dashboard activation is handled by student.service.ts.
   - All lifecycle mutations go through student.service.ts.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   CONFIG
   ============================================================ */

const MAX_BODY_BYTES = 20_000;
const MAX_SEARCH_LENGTH = 120;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_REASON_LENGTH = 1_000;
const MAX_STUDENT_ID_LENGTH = 100;

const AUTHORIZED_ROLES = new Set<string>([
  "Super Admin",
  "Admin",
  "Student Operations Admin",
]);

const SUPPORTED_ACTIONS = new Set<string>([
  "approve",
  "reject",
  "generate-credentials",
  "resend-credentials",
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

  [key: string]: unknown;
};

type AuthenticatedAdmin = {
  id: string;
  role: string;
  sessionType: string;
};

type PostAction =
  | "approve"
  | "reject"
  | "generate-credentials"
  | "resend-credentials";

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

function getRequestId(request: NextRequest): string {
  const incoming = cleanString(
    request.headers.get("x-request-id"),
  );

  if (
    incoming &&
    /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)
  ) {
    return incoming;
  }

  try {
    return crypto.randomUUID();
  } catch {
    return `student-admin-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

/* ============================================================
   SECURITY HEADERS
   ============================================================ */

function applySecurityHeaders(
  response: NextResponse,
  requestId: string,
): NextResponse {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, proxy-revalidate",
  );

  response.headers.set(
    "Pragma",
    "no-cache",
  );

  response.headers.set(
    "Expires",
    "0",
  );

  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  response.headers.set(
    "X-Frame-Options",
    "DENY",
  );

  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );

  response.headers.set(
    "X-Request-Id",
    requestId,
  );

  return response;
}

/* ============================================================
   RESPONSE HELPERS
   ============================================================ */

function response(
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
  data?: unknown,
  code?: string,
  status = 200,
): NextResponse {
  const body: {
    success: true;
    message: string;
    code?: string;
    data?: unknown;
  } = {
    success: true,
    message,
  };

  if (code) {
    body.code = code;
  }

  if (typeof data !== "undefined") {
    body.data = data;
  }

  return response(
    body,
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
  return response(
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
   SAME ORIGIN
   ============================================================ */

function validateOrigin(
  request: NextRequest,
): boolean {
  const origin = cleanString(
    request.headers.get("origin"),
  );

  /*
   * Browser requests without Origin can be legitimate.
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
   CONTENT LENGTH
   ============================================================ */

function validateContentLength(
  request: NextRequest,
): boolean {
  const value = request.headers.get(
    "content-length",
  );

  if (!value) {
    return true;
  }

  const length = Number(value);

  if (!Number.isFinite(length)) {
    return false;
  }

  return length <= MAX_BODY_BYTES;
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
   * Student Operations uses the dedicated admin cookie.
   *
   * Legacy AUTH cookie remains supported because the
   * project still has legacy authentication compatibility.
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
     * verifyAccessToken may return a generic/empty object
     * depending on the current auth implementation.
     *
     * Convert it to a controlled runtime object first.
     */
    const payloadObject =
      isObject(payload)
        ? (payload as AdminTokenPayload)
        : {};

    const userId = cleanString(
      payloadObject.userId ??
        payloadObject.id ??
        payloadObject.identifier,
    );

    const role = cleanString(
      payloadObject.role ??
        payloadObject.adminRole,
    );

    const sessionType = lowerString(
      payloadObject.sessionType ??
        payloadObject.authenticationMode,
    );

    if (!userId) {
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
     * Student and student-dashboard sessions
     * must never access this endpoint.
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
        id: userId,
        role,
        sessionType:
          sessionType || "admin",
      },
    };
  } catch (error) {
    console.error(
      "[StudentAdminStudents] Authentication error.",
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
   ACTOR
   ============================================================ */

function createActor(
  admin: AuthenticatedAdmin,
): StudentActor {
  return {
    id: admin.id,
    role: admin.role,
  };
}

/* ============================================================
   QUERY HELPERS
   ============================================================ */

function queryString(
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

/* ============================================================
   STUDENT LIST QUERY
   ============================================================ */

function buildListQuery(
  request: NextRequest,
): {
  applicationStatus?: string;
  assessmentStatus?: string;
  internshipStatus?: string;
  paymentStatus?: string;
  studentOpsApprovalStatus?: string;
  studentOpsStatus?: string;
  dashboardStatus?: string;
  search?: string;
  page: number;
  limit: number;
} {
  const search = queryString(
    request,
    "search",
  ).slice(
    0,
    MAX_SEARCH_LENGTH,
  );

  const page = positiveInteger(
    queryString(
      request,
      "page",
    ),
    1,
    10_000,
  );

  const limit = positiveInteger(
    queryString(
      request,
      "limit",
    ),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  return {
    applicationStatus:
      queryString(
        request,
        "applicationStatus",
      ) || undefined,

    assessmentStatus:
      queryString(
        request,
        "assessmentStatus",
      ) || undefined,

    internshipStatus:
      queryString(
        request,
        "internshipStatus",
      ) || undefined,

    paymentStatus:
      queryString(
        request,
        "paymentStatus",
      ) || undefined,

    studentOpsApprovalStatus:
      queryString(
        request,
        "studentOpsApprovalStatus",
      ) || undefined,

    studentOpsStatus:
      queryString(
        request,
        "studentOpsStatus",
      ) || undefined,

    dashboardStatus:
      queryString(
        request,
        "dashboardStatus",
      ) || undefined,

    search:
      search || undefined,

    page,
    limit,
  };
}

/* ============================================================
   PENDING REVIEW QUEUE
   ============================================================ */

function isPendingQueue(
  request: NextRequest,
): boolean {
  const queue = lowerString(
    request.nextUrl.searchParams.get(
      "queue",
    ),
  );

  return (
    queue === "pending" ||
    queue === "review" ||
    queue === "student-operations"
  );
}

/* ============================================================
   POST BODY
   ============================================================ */

async function parsePostBody(
  request: NextRequest,
  requestId: string,
): Promise<
  | {
      success: true;
      action: PostAction;
      studentId: string;
      reason?: string;
      sendCredentials?: boolean;
    }
  | {
      success: false;
      response: NextResponse;
    }
> {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Unable to read request body.",
        "INVALID_REQUEST_BODY",
        400,
      ),
    };
  }

  if (!rawBody.trim()) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Request body is required.",
        "BODY_REQUIRED",
        400,
      ),
    };
  }

  if (
    Buffer.byteLength(
      rawBody,
      "utf8",
    ) > MAX_BODY_BYTES
  ) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Request payload is too large.",
        "PAYLOAD_TOO_LARGE",
        413,
      ),
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      rawBody,
    );
  } catch {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Request body must contain valid JSON.",
        "INVALID_JSON",
        400,
      ),
    };
  }

  if (!isObject(parsed)) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Invalid request body.",
        "INVALID_BODY",
        400,
      ),
    };
  }

  const action = lowerString(
    parsed.action,
  );

  if (
    !SUPPORTED_ACTIONS.has(action)
  ) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Invalid Student Operations action.",
        "INVALID_ACTION",
        400,
      ),
    };
  }

  const studentId = cleanString(
    parsed.studentId,
  );

  if (!studentId) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Student ID is required.",
        "STUDENT_ID_REQUIRED",
        400,
      ),
    };
  }

  if (
    studentId.length >
    MAX_STUDENT_ID_LENGTH
  ) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Student ID is invalid.",
        "INVALID_STUDENT_ID",
        400,
      ),
    };
  }

  const reason = cleanString(
    parsed.reason,
  );

  if (
    action === "reject" &&
    !reason
  ) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Rejection reason is required.",
        "REASON_REQUIRED",
        400,
      ),
    };
  }

  if (
    reason.length >
    MAX_REASON_LENGTH
  ) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Rejection reason is too long.",
        "REASON_TOO_LONG",
        400,
      ),
    };
  }

  const normalizedAction =
    action as PostAction;

  return {
    success: true,
    action:
      normalizedAction,
    studentId,
    ...(reason
      ? {
          reason,
        }
      : {}),
    ...(typeof parsed.sendCredentials ===
    "boolean"
      ? {
          sendCredentials:
            parsed.sendCredentials,
        }
      : {}),
  };
}

/* ============================================================
   SERVICE ERROR STATUS
   ============================================================ */

function getServiceStatus(
  code: string,
): number {
  switch (
    lowerString(code)
  ) {
    case "unauthorized":
    case "invalid_session":
    case "authentication_required":
      return 401;

    case "forbidden":
      return 403;

    case "student_not_found":
      return 404;

    case "already_exists":
    case "duplicate":
      return 409;

    default:
      return 400;
  }
}

/* ============================================================
   SERVICE RESULT HANDLER
   ============================================================ */

function handleServiceResult(
  result: {
    success: boolean;
    message: string;
    code?: string;
    data?: unknown;
  },
  requestId: string,
): NextResponse {
  if (result.success) {
    return successResponse(
      requestId,
      result.message,
      result.data,
      result.code,
    );
  }

  const code =
    cleanString(result.code) ||
    "STUDENT_OPERATION_FAILED";

  return errorResponse(
    requestId,
    result.message ||
      "Student operation failed.",
    code,
    getServiceStatus(code),
  );
}

/* ============================================================
   GET
   ============================================================ */

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  try {
    /*
     * Admin authentication.
     */
    const authentication =
      await authenticateAdmin(
        request,
        requestId,
      );

    if (!authentication.success) {
      return authentication.response;
    }

    /*
     * Build safe query.
     */
    const query =
      buildListQuery(request);

    /*
     * Dedicated Student Operations queue.
     *
     * This queue represents:
     *
     * Payment Verified
     *       ↓
     * Student Operations Pending Review
     */
    if (
      isPendingQueue(request)
    ) {
      query.paymentStatus =
        "paid";

      query.studentOpsApprovalStatus =
        "pending";

      query.studentOpsStatus =
        "pending-review";
    }

    const result =
      await listStudents(
        query,
      );

    return handleServiceResult(
      result,
      requestId,
    );
  } catch (error) {
    console.error(
      "[StudentAdminStudents][GET] Unexpected error.",
      {
        requestId,
        error,
      },
    );

    return errorResponse(
      requestId,
      "Unable to load Student Operations students.",
      "INTERNAL_SERVER_ERROR",
      500,
    );
  }
}

/* ============================================================
   POST
   ============================================================ */

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  try {
    /*
     * CSRF / same-origin protection.
     */
    if (
      !validateOrigin(request)
    ) {
      return errorResponse(
        requestId,
        "Cross-origin requests are not allowed.",
        "INVALID_ORIGIN",
        403,
      );
    }

    /*
     * JSON only.
     */
    const contentType =
      lowerString(
        request.headers.get(
          "content-type",
        ),
      );

    if (
      !contentType.startsWith(
        "application/json",
      )
    ) {
      return errorResponse(
        requestId,
        "Content-Type must be application/json.",
        "INVALID_CONTENT_TYPE",
        415,
      );
    }

    /*
     * Request size protection.
     */
    if (
      !validateContentLength(request)
    ) {
      return errorResponse(
        requestId,
        "Request payload is too large or invalid.",
        "PAYLOAD_TOO_LARGE",
        413,
      );
    }

    /*
     * Authenticate Student Operations admin.
     */
    const authentication =
      await authenticateAdmin(
        request,
        requestId,
      );

    if (!authentication.success) {
      return authentication.response;
    }

    const actor =
      createActor(
        authentication.admin,
      );

    /*
     * Parse and validate action.
     */
    const body =
      await parsePostBody(
        request,
        requestId,
      );

    if (!body.success) {
      return body.response;
    }

    const {
      action,
      studentId,
      reason,
      sendCredentials,
    } = body;

    /* ========================================================
       APPROVE
       ======================================================== */

    if (
      action === "approve"
    ) {
      /*
       * IMPORTANT:
       *
       * approveStudentOperations() is the authoritative
       * lifecycle mutation.
       *
       * It validates:
       * - verified payment
       * - approved internship
       * - Student Operations approval
       * - dashboard credentials
       * - dashboard activation
       * - credential email
       *
       * Do NOT manually update Student here.
       */
      const result =
        await approveStudentOperations(
          {
            studentId,
            actor,
            approved: true,
          },
        );

      return handleServiceResult(
        result,
        requestId,
      );
    }

    /* ========================================================
       REJECT
       ======================================================== */

    if (
      action === "reject"
    ) {
      const result =
        await approveStudentOperations(
          {
            studentId,
            actor,
            approved: false,
            reason,
          },
        );

      return handleServiceResult(
        result,
        requestId,
      );
    }

    /* ========================================================
       GENERATE CREDENTIALS
       ======================================================== */

    if (
      action ===
      "generate-credentials"
    ) {
      const result =
        await generateDashboardCredentials(
          {
            studentId,
            actor,
            sendCredentials:
              sendCredentials !==
              false,
          },
        );

      return handleServiceResult(
        result,
        requestId,
      );
    }

    /* ========================================================
       RESEND CREDENTIALS
       ======================================================== */

    if (
      action ===
      "resend-credentials"
    ) {
      /*
       * The service intentionally generates a new secure
       * temporary password and sends it to the student.
       *
       * The password itself is NEVER returned by this API.
       */
      const result =
        await generateDashboardCredentials(
          {
            studentId,
            actor,
            sendCredentials: true,
          },
        );

      return handleServiceResult(
        result,
        requestId,
      );
    }

    return errorResponse(
      requestId,
      "Unsupported Student Operations action.",
      "INVALID_ACTION",
      400,
    );
  } catch (error) {
    console.error(
      "[StudentAdminStudents][POST] Unexpected error.",
      {
        requestId,
        error,
      },
    );

    return errorResponse(
      requestId,
      "Unable to complete Student Operations action.",
      "INTERNAL_SERVER_ERROR",
      500,
    );
  }
}

/* ============================================================
   PATCH
   ============================================================ */

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  return errorResponse(
    requestId,
    "PATCH is not supported. Use the supported Student Operations action.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

/* ============================================================
   PUT
   ============================================================ */

export async function PUT(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  return errorResponse(
    requestId,
    "PUT is not supported for Student Operations.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

/* ============================================================
   DELETE
   ============================================================ */

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  return errorResponse(
    requestId,
    "DELETE is not supported for Student Operations.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

/* ============================================================
   HEAD
   ============================================================ */

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
            "GET, POST, OPTIONS",

          "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",

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