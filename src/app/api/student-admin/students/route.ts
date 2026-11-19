import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";
import {
  approveStudentOperations,
  generateDashboardCredentials,
  type StudentActor,
} from "@/services/student.service";
import StudentModelSource from "@/models/Student";
import connectDB from "@/lib/db";

const StudentModel: any = StudentModelSource;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 20_000;
const MAX_SEARCH_LENGTH = 120;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_REASON_LENGTH = 1_000;
const MAX_STUDENT_ID_LENGTH = 100;

const AUTHORIZED_ROLES = new Set([
  "super admin",
  "admin",
  "student operations admin",
]);

const SUPPORTED_ACTIONS = new Set([
  "approve",
  "reject",
  "generate-credentials",
  "resend-credentials",
]);



type JsonObject = Record<string, unknown>;

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

type ParsedPostBody =
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
    };

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function lowerString(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRole(value: unknown): string {
  const role = lowerString(value);

  if (role === "super admin" || role === "super_admin" || role === "super-admin") {
    return "Super Admin";
  }

  if (
    role === "student operations admin" ||
    role === "student_operations_admin" ||
    role === "student-operations-admin"
  ) {
    return "Student Operations Admin";
  }

  if (role === "admin") {
    return "Admin";
  }

  return cleanString(value);
}

function getRequestId(request: NextRequest): string {
  const incoming = cleanString(request.headers.get("x-request-id"));

  if (incoming && /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)) {
    return incoming;
  }

  return crypto.randomUUID();
}

function applySecurityHeaders(
  response: NextResponse,
  requestId: string,
): NextResponse {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("Vary", "Cookie, Origin");
  return response;
}

function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
): NextResponse {
  return applySecurityHeaders(
    NextResponse.json(body, { status }),
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
  } = { success: true, message };

  if (code) body.code = code;
  if (typeof data !== "undefined") body.data = data;

  return jsonResponse(body, status, requestId);
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

function getExpectedRequestOrigin(request: NextRequest): string | null {
  const forwardedHost = cleanString(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || cleanString(request.headers.get("host"));
  const forwardedProto = cleanString(
    request.headers.get("x-forwarded-proto"),
  ).split(",")[0]?.trim();
  const protocol = forwardedProto || new URL(request.url).protocol.replace(":", "");

  if (!host || !["http", "https"].includes(protocol)) {
    return null;
  }

  return `${protocol}://${host}`;
}

function validateOrigin(request: NextRequest): boolean {
  const origin = cleanString(request.headers.get("origin"));

  if (!origin) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const expectedOrigin = getExpectedRequestOrigin(request);

    if (!expectedOrigin) {
      return false;
    }

    const expectedUrl = new URL(expectedOrigin);

    return (
      originUrl.origin === expectedUrl.origin &&
      (originUrl.protocol === "https:" || originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

function validateContentType(request: NextRequest): boolean {
  const contentType = lowerString(request.headers.get("content-type"));
  return /^application\/json(?:\s*;\s*charset=utf-8)?$/.test(contentType);
}

function validateContentLength(request: NextRequest): boolean {
  const value = request.headers.get("content-length");

  if (!value) return true;

  if (!/^\d+$/.test(value)) return false;

  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 && length <= MAX_BODY_BYTES;
}

async function readBoundedBody(
  request: NextRequest,
): Promise<
  | { success: true; body: string }
  | { success: false; reason: "too-large" | "unreadable" }
> {
  if (!request.body) {
    return { success: true, body: "" };
  }

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
        await reader.cancel().catch(() => undefined);
        return { success: false, reason: "too-large" };
      }

      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { success: false, reason: "unreadable" };
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
    return { success: false, reason: "unreadable" };
  }
}

async function authenticateAdmin(
  request: NextRequest,
  requestId: string,
): Promise<
  | { success: true; admin: AuthenticatedAdmin }
  | { success: false; response: NextResponse }
> {
  const adminCookie = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
  const legacyCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const token = adminCookie || legacyCookie || "";

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
    const payload = await verifyAccessToken(token);

    if (!isObject(payload)) {
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

    const sessionType = lowerString(
      payload.sessionType ?? payload.authenticationMode,
    );

    if (
      sessionType &&
      sessionType !== "admin" &&
      sessionType !== "student-admin"
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

    const userId = cleanString(
      payload.userId ?? payload.id ?? payload.identifier,
    );

    const effectiveRole = normalizeRole(
      sessionType === "student-admin"
        ? payload.adminRole ?? payload.role
        : payload.role ?? payload.adminRole,
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

    if (!AUTHORIZED_ROLES.has(effectiveRole.toLowerCase())) {
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
        role: effectiveRole,
        sessionType: sessionType || "admin",
      },
    };
  } catch (error) {
    console.error("[StudentAdminStudents] Authentication failed.", {
      requestId,
      error,
    });

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

function createActor(admin: AuthenticatedAdmin): StudentActor {
  return {
    id: admin.id,
    role: admin.role,
  };
}

function queryString(request: NextRequest, key: string): string {
  return cleanString(request.nextUrl.searchParams.get(key));
}

function positiveInteger(
  value: string,
  fallback: number,
  maximum: number,
): number {
  if (!/^\d+$/.test(value)) return fallback;

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;

  return Math.min(parsed, maximum);
}

async function parsePostBody(
  request: NextRequest,
  requestId: string,
): Promise<ParsedPostBody> {
  const readResult = await readBoundedBody(request);

  if (!readResult.success) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        readResult.reason === "too-large"
          ? "Request payload is too large."
          : "Unable to read request body.",
        readResult.reason === "too-large"
          ? "PAYLOAD_TOO_LARGE"
          : "INVALID_REQUEST_BODY",
        readResult.reason === "too-large" ? 413 : 400,
      ),
    };
  }

  const rawBody = readResult.body;

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

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
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

  const allowedKeys = new Set([
    "action",
    "studentId",
    "reason",
    "sendCredentials",
  ]);

  if (Object.keys(parsed).some((key) => !allowedKeys.has(key))) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "Request contains unsupported fields.",
        "UNKNOWN_FIELDS",
        400,
      ),
    };
  }

  const action = lowerString(parsed.action);

  if (!SUPPORTED_ACTIONS.has(action)) {
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

  const studentId = cleanString(parsed.studentId);

  if (
    !studentId ||
    studentId.length > MAX_STUDENT_ID_LENGTH ||
    !/^[a-zA-Z0-9_-]+$/.test(studentId)
  ) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "A valid student ID is required.",
        "INVALID_STUDENT_ID",
        400,
      ),
    };
  }

  const reason = cleanString(parsed.reason);

  if (action === "reject" && !reason) {
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

  if (reason.length > MAX_REASON_LENGTH) {
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

  if (
    typeof parsed.sendCredentials !== "undefined" &&
    typeof parsed.sendCredentials !== "boolean"
  ) {
    return {
      success: false,
      response: errorResponse(
        requestId,
        "sendCredentials must be a boolean.",
        "INVALID_CREDENTIALS_OPTION",
        400,
      ),
    };
  }

  return {
    success: true,
    action: action as PostAction,
    studentId,
    ...(reason ? { reason } : {}),
    ...(typeof parsed.sendCredentials === "boolean"
      ? { sendCredentials: parsed.sendCredentials }
      : {}),
  };
}

function getServiceStatus(code: string): number {
  switch (lowerString(code)) {
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
    case "invalid_transition":
      return 409;
    case "payment_not_verified":
    case "internship_not_approved":
    case "student_ops_not_approved":
    case "invalid_status":
      return 422;
    default:
      return 400;
  }
}

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

  const code = cleanString(result.code) || "STUDENT_OPERATION_FAILED";

  return errorResponse(
    requestId,
    result.message || "Student operation failed.",
    code,
    getServiceStatus(code),
  );
}

function normalizePlanCode(value: unknown): string {
  const raw = cleanString(value).toUpperCase().replace(/[\s-]+/g, "_");
  if (["ONE_MONTH", "1_MONTH", "1_MONTHS", "1 MONTH", "1 MONTHS"].includes(raw)) return "ONE_MONTH";
  if (["THREE_MONTHS", "3_MONTH", "3_MONTHS"].includes(raw)) return "THREE_MONTHS";
  if (["SIX_MONTHS", "6_MONTH", "6_MONTHS"].includes(raw)) return "SIX_MONTHS";
  return "";
}

function normalizeStudentRecord(record: JsonObject): JsonObject {
  const planCode = normalizePlanCode(record.internshipPlanCode || record.internshipPlan);
  const plan = planCode === "ONE_MONTH"
    ? { durationMonths: 1, durationDays: 30, amount: 499, name: "1 Month" }
    : planCode === "THREE_MONTHS"
      ? { durationMonths: 3, durationDays: 90, amount: 999, name: "3 Months" }
      : planCode === "SIX_MONTHS"
        ? { durationMonths: 6, durationDays: 180, amount: 1699, name: "6 Months" }
        : null;
  const id = record._id && typeof record._id === "object" && "toString" in record._id
    ? String(record._id)
    : cleanString(record._id);
  const iso = (value: unknown) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };
  return {
    id,
    studentId: cleanString(record.studentId),
    dashboardStudentId: cleanString(record.dashboardStudentId),
    applicationId: cleanString(record.applicationId),
    fullName: cleanString(record.fullName),
    email: cleanString(record.email).toLowerCase(),
    phone: cleanString(record.phone),
    applicationStatus: cleanString(record.applicationStatus),
    adminApprovalStatus: cleanString(record.adminApprovalStatus),
    assessmentStatus: cleanString(record.assessmentStatus),
    resultStatus: cleanString(record.resultStatus),
    internshipStatus: cleanString(record.internshipStatus),
    internshipPlan: cleanString(record.internshipPlan) || plan?.name || "",
    internshipPlanCode: planCode,
    internshipDurationMonths: Number(record.internshipDurationMonths) || plan?.durationMonths || 0,
    internshipDurationDays: Number(record.internshipDurationDays) || plan?.durationDays || 0,
    internshipTrack: cleanString(record.internshipTrack),
    internshipStartedAt: iso(record.internshipStartedAt),
    internshipEndsAt: iso(record.internshipEndsAt),
    paymentStatus: cleanString(record.paymentStatus),
    paymentAmount: Number(record.paymentAmount) || plan?.amount || 0,
    paymentCurrency: cleanString(record.paymentCurrency) || "INR",
    paymentAttemptGroupId: cleanString(record.paymentAttemptGroupId),
    razorpayOrderId: cleanString(record.razorpayOrderId),
    razorpayPaymentId: cleanString(record.razorpayPaymentId),
    razorpayCheckoutExpiresAt: iso(record.razorpayCheckoutExpiresAt),
    paymentExpiredAt: iso(record.paymentExpiredAt),
    paymentCompletedAt: iso(record.paymentCompletedAt),
    paymentVerifiedAt: iso(record.paymentVerifiedAt),
    paymentVerificationSource: cleanString(record.paymentVerificationSource),
    studentOpsApprovalStatus: cleanString(record.studentOpsApprovalStatus),
    studentOpsStatus: cleanString(record.studentOpsStatus),
    dashboardStatus: cleanString(record.dashboardStatus),
    dashboardLoginEnabled: record.dashboardLoginEnabled === true,
    dashboardCredentialsGenerated: record.dashboardCredentialsGenerated === true,
    dashboardCredentialsGeneratedAt: iso(record.dashboardCredentialsGeneratedAt),
    dashboardCredentialsExpiresAt: iso(record.dashboardCredentialsExpiresAt),
    dashboardLoginEnabledAt: iso(record.dashboardLoginEnabledAt),
    dashboardAccountLocked: record.dashboardAccountLocked === true,
    dashboardLockedUntil: iso(record.dashboardLockedUntil),
    learningStatus: cleanString(record.learningStatus),
    taskCompletionPercentage: Number(record.taskCompletionPercentage) || 0,
    learningProgressPercentage: Number(record.learningProgressPercentage) || 0,
    attendancePercentage: Number(record.attendancePercentage) || 0,
    weeklyAssessmentStatus: cleanString(record.weeklyAssessmentStatus),
    saturdayAssessmentStatus: cleanString(record.saturdayAssessmentStatus),
    projectStatus: cleanString(record.projectStatus),
    projectCompletionPercentage: Number(record.projectCompletionPercentage) || 0,
    certificateStatus: cleanString(record.certificateStatus),
    certificateId: cleanString(record.certificateId),
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
  };
}

function buildMongoStudentFilter(request: NextRequest): JsonObject {
  const filter: JsonObject = {};
  const statusFields = [
    "applicationStatus",
    "assessmentStatus",
    "internshipStatus",
    "paymentStatus",
    "studentOpsApprovalStatus",
    "studentOpsStatus",
    "dashboardStatus",
  ] as const;

  for (const field of statusFields) {
    const value = queryString(request, field).slice(0, 80);
    if (value) filter[field] = value;
  }

  const planCode = queryString(request, "internshipPlanCode");
  if (planCode) {
    const normalized = normalizePlanCode(planCode);
    if (normalized) filter.internshipPlanCode = normalized;
    else filter.internshipPlanCode = "__unsupported_plan__";
  }

  const clauses: JsonObject[] = [];
  const login = lowerString(queryString(request, "dashboardLogin"));
  const activeLogin: JsonObject = {
    dashboardLoginEnabled: true,
    dashboardCredentialsGenerated: true,
    dashboardStatus: "active",
    dashboardAccountLocked: { $ne: true },
    $or: [
      { dashboardCredentialsExpiresAt: null },
      { dashboardCredentialsExpiresAt: { $exists: false } },
      { dashboardCredentialsExpiresAt: { $gt: new Date() } },
    ],
  };

  if (login === "active") clauses.push(activeLogin);
  if (login === "off") clauses.push({ $nor: [activeLogin] });

  const search = queryString(request, "search").slice(0, MAX_SEARCH_LENGTH);
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
    const regex = new RegExp(escaped, "i");
    clauses.push({
      $or: [
        { studentId: regex },
        { dashboardStudentId: regex },
        { applicationId: regex },
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { internshipTrack: regex },
      ],
    });
  }

  if (clauses.length) filter.$and = clauses;
  return filter;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const authentication = await authenticateAdmin(request, requestId);
    if (!authentication.success) return authentication.response;

    await connectDB();

    const page = positiveInteger(queryString(request, "page"), 1, 100_000);
    const limit = positiveInteger(queryString(request, "limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;
    const filter = buildMongoStudentFilter(request);
    const now = new Date();

    const activeLoginFilter: JsonObject = {
      dashboardLoginEnabled: true,
      dashboardCredentialsGenerated: true,
      dashboardStatus: "active",
      dashboardAccountLocked: { $ne: true },
      $or: [
        { dashboardCredentialsExpiresAt: null },
        { dashboardCredentialsExpiresAt: { $exists: false } },
        { dashboardCredentialsExpiresAt: { $gt: now } },
      ],
    };

    const [
      records,
      total,
      totalStudents,
      activeLoginCount,
      paidCount,
      pendingPaymentCount,
      expiredPaymentCount,
      refundedPaymentCount,
      oneMonthCount,
      threeMonthCount,
      sixMonthCount,
      pendingOperationsCount,
      activeOperationsCount,
    ] = await Promise.all([
      StudentModel.find(filter)
        .select([
          "studentId dashboardStudentId applicationId fullName email phone",
          "applicationStatus adminApprovalStatus assessmentStatus resultStatus",
          "internshipStatus internshipPlan internshipPlanCode internshipDurationMonths internshipDurationDays",
          "internshipTrack internshipStartedAt internshipEndsAt paymentStatus paymentAmount paymentCurrency",
          "paymentAttemptGroupId razorpayOrderId razorpayPaymentId razorpayCheckoutExpiresAt paymentExpiredAt",
          "paymentCompletedAt paymentVerifiedAt paymentVerificationSource",
          "studentOpsApprovalStatus studentOpsStatus dashboardStatus dashboardLoginEnabled",
          "dashboardCredentialsGenerated dashboardCredentialsGeneratedAt dashboardCredentialsExpiresAt",
          "dashboardLoginEnabledAt dashboardAccountLocked dashboardLockedUntil",
          "learningStatus taskCompletionPercentage learningProgressPercentage attendancePercentage",
          "weeklyAssessmentStatus saturdayAssessmentStatus projectStatus projectCompletionPercentage",
          "certificateStatus certificateId createdAt updatedAt",
        ].join(" "))
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      StudentModel.countDocuments(filter).exec(),
      StudentModel.countDocuments({}).exec(),
      StudentModel.countDocuments(activeLoginFilter).exec(),
      StudentModel.countDocuments({ paymentStatus: "paid" }).exec(),
      StudentModel.countDocuments({ paymentStatus: "pending" }).exec(),
      StudentModel.countDocuments({ paymentStatus: "expired" }).exec(),
      StudentModel.countDocuments({ paymentStatus: "refunded" }).exec(),
      StudentModel.countDocuments({ internshipPlanCode: "ONE_MONTH" }).exec(),
      StudentModel.countDocuments({ internshipPlanCode: "THREE_MONTHS" }).exec(),
      StudentModel.countDocuments({ internshipPlanCode: "SIX_MONTHS" }).exec(),
      StudentModel.countDocuments({ studentOpsApprovalStatus: "pending", paymentStatus: "paid" }).exec(),
      StudentModel.countDocuments({ studentOpsStatus: "active" }).exec(),
    ]);

    const students = records.map((record: JsonObject) => normalizeStudentRecord(record));
    const activeLogin = Math.max(0, Number(activeLoginCount) || 0);
    const inactiveLogin = Math.max(0, Number(totalStudents) - activeLogin);

    return successResponse(
      requestId,
      "Student records and live statistics loaded successfully.",
      {
        students,
        total: Math.max(0, Number(total) || 0),
        page,
        limit,
        totalPages: Math.ceil(Math.max(0, Number(total) || 0) / limit),
        statistics: {
          totalStudents: Number(totalStudents) || 0,
          dashboardLoginEnabled: activeLogin,
          dashboardLoginDisabled: inactiveLogin,
          activeStudents: Number(activeOperationsCount) || 0,
          paidStudents: Number(paidCount) || 0,
          pendingPayments: Number(pendingPaymentCount) || 0,
          expiredPayments: Number(expiredPaymentCount) || 0,
          refundedPayments: Number(refundedPaymentCount) || 0,
          pendingOperationsApprovals: Number(pendingOperationsCount) || 0,
          internshipPlans: {
            ONE_MONTH: Number(oneMonthCount) || 0,
            THREE_MONTHS: Number(threeMonthCount) || 0,
            SIX_MONTHS: Number(sixMonthCount) || 0,
          },
        },
        generatedAt: now.toISOString(),
        viewer: {
          id: authentication.admin.id,
          role: authentication.admin.role,
          sessionType: authentication.admin.sessionType,
        },
      },
    );
  } catch (error) {
    console.error("[StudentAdminStudents][GET] Request failed.", { requestId, error });
    return errorResponse(
      requestId,
      "Unable to load Student Operations students.",
      "INTERNAL_SERVER_ERROR",
      500,
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    if (!validateOrigin(request)) {
      return errorResponse(
        requestId,
        "A valid same-origin request is required.",
        "INVALID_ORIGIN",
        403,
      );
    }

    if (!validateContentType(request)) {
      return errorResponse(
        requestId,
        "Content-Type must be application/json.",
        "INVALID_CONTENT_TYPE",
        415,
      );
    }

    if (!validateContentLength(request)) {
      return errorResponse(
        requestId,
        "Request payload is too large or invalid.",
        "PAYLOAD_TOO_LARGE",
        413,
      );
    }

    const authentication = await authenticateAdmin(request, requestId);

    if (!authentication.success) return authentication.response;

    const body = await parsePostBody(request, requestId);

    if (!body.success) return body.response;

    const actor = createActor(authentication.admin);

    if (body.action === "approve") {
      const result = await approveStudentOperations({
        studentId: body.studentId,
        actor,
        approved: true,
      });

      return handleServiceResult(result, requestId);
    }

    if (body.action === "reject") {
      const result = await approveStudentOperations({
        studentId: body.studentId,
        actor,
        approved: false,
        reason: body.reason,
      });

      return handleServiceResult(result, requestId);
    }

    if (body.action === "generate-credentials") {
      const result = await generateDashboardCredentials({
        studentId: body.studentId,
        actor,
        sendCredentials: body.sendCredentials !== false,
      });

      return handleServiceResult(result, requestId);
    }

    if (body.action === "resend-credentials") {
      const result = await generateDashboardCredentials({
        studentId: body.studentId,
        actor,
        sendCredentials: true,
      });

      return handleServiceResult(result, requestId);
    }

    return errorResponse(
      requestId,
      "Unsupported Student Operations action.",
      "INVALID_ACTION",
      400,
    );
  } catch (error) {
    console.error("[StudentAdminStudents][POST] Request failed.", {
      requestId,
      error,
    });

    return errorResponse(
      requestId,
      "Unable to complete Student Operations action.",
      "INTERNAL_SERVER_ERROR",
      500,
    );
  }
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);

  if (!validateOrigin(request)) {
    return errorResponse(
      requestId,
      "Cross-origin requests are not allowed.",
      "INVALID_ORIGIN",
      403,
    );
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Requested-With, X-Request-Id",
    },
  });

  return applySecurityHeaders(response, requestId);
}
