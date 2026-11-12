import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  login,
  loginStudentDashboard,
  type AuthUser,
  type LoginInput,
  type LoginResult,
} from "@/services/auth.service";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_AUTH_COOKIE_OPTIONS,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  STUDENT_ADMIN_AUTH_COOKIE_OPTIONS,
  STUDENT_AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_OPTIONS,
  STUDENT_DASHBOARD_AUTH_COOKIE_NAME,
  STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 10_000;
const MAX_IDENTIFIER_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
} as const;

const LOGIN_MODES = [
  "auto",
  "admin",
  "student",
  "student-admin",
  "student-dashboard",
] as const;

type LoginMode = (typeof LOGIN_MODES)[number];
type Portal = Exclude<LoginMode, "auto">;
type JsonRecord = Record<string, unknown>;

type CookieOptions =
  | typeof AUTH_COOKIE_OPTIONS
  | typeof ADMIN_AUTH_COOKIE_OPTIONS
  | typeof STUDENT_ADMIN_AUTH_COOKIE_OPTIONS
  | typeof STUDENT_AUTH_COOKIE_OPTIONS
  | typeof STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS;

function createRequestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();

  return supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
}

function jsonResponse(
  body: JsonRecord,
  status: number,
  requestId: string,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "X-Request-ID": requestId,
    },
  });
}

function logLoginApiFailure(requestId: string, error: unknown): void {
  const details =
    error !== null && typeof error === "object"
      ? (error as { name?: unknown; code?: unknown })
      : {};
  const errorName =
    typeof details.name === "string" ? details.name.slice(0, 80) : "UnknownError";
  const errorCode =
    typeof details.code === "string" || typeof details.code === "number"
      ? String(details.code).slice(0, 40)
      : undefined;

  console.error("[CyberNet Careers] Login API failed.", {
    requestId,
    errorName,
    ...(errorCode ? { errorCode } : {}),
  });
}

function getLoginMode(value: unknown): LoginMode | null {
  if (value === undefined || value === null || value === "") return "auto";
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();

  return (LOGIN_MODES as readonly string[]).includes(normalized)
    ? (normalized as LoginMode)
    : null;
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function detectPortal(user: AuthUser): Portal | null {
  const record = user as unknown as JsonRecord;
  const userType = normalize(record.userType ?? record.type);
  const role = normalize(record.role);
  const adminRole = normalize(record.adminRole);
  const authenticationMode = normalize(record.authenticationMode);

  if (authenticationMode === "student-dashboard") {
    return "student-dashboard";
  }

  if (authenticationMode === "student-admin") {
    return "student-admin";
  }

  if (authenticationMode === "student") {
    return "student";
  }

  if (authenticationMode === "admin") {
    return "admin";
  }

  if (
    ["student-admin", "student-operations-admin", "studentadmin"].includes(role) ||
    ["student-admin", "student-operations-admin", "studentadmin"].includes(adminRole)
  ) {
    return "student-admin";
  }

  if (userType === "admin" || ["admin", "super-admin"].includes(role) || Boolean(adminRole)) {
    return "admin";
  }

  if (userType === "student" || role === "student") {
    return "student";
  }

  return null;
}
function isModeAllowed(portal: Portal, mode: LoginMode): boolean {
  return mode === "auto" || portal === mode;
}

function getCookieConfig(portal: Portal): {
  name: string;
  options: CookieOptions;
} {
  switch (portal) {
    case "admin":
      return {
        name: ADMIN_AUTH_COOKIE_NAME,
        options: ADMIN_AUTH_COOKIE_OPTIONS,
      };
    case "student-admin":
      return {
        name: STUDENT_ADMIN_AUTH_COOKIE_NAME,
        options: STUDENT_ADMIN_AUTH_COOKIE_OPTIONS,
      };
    case "student-dashboard":
      return {
        name: STUDENT_DASHBOARD_AUTH_COOKIE_NAME,
        options: STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS,
      };
    case "student":
    default:
      return {
        name: STUDENT_AUTH_COOKIE_NAME,
        options: STUDENT_AUTH_COOKIE_OPTIONS,
      };
  }
}

function serializePublicUser(user: AuthUser): JsonRecord {
  const source = user as unknown as JsonRecord;
  const allowedKeys = [
    "id",
    "userId",
    "identifier",
    "studentId",
    "dashboardStudentId",
    "adminId",
    "email",
    "phone",
    "fullName",
    "name",
    "role",
    "adminRole",
    "userType",
    "type",
    "sessionType",
    "authenticationMode",
    "emailVerified",
    "isEmailVerified",
    "isActive",
    "loginEnabled",
    "applicationId",
    "applicationStatus",
    "assessmentStatus",
    "assessmentScore",
    "resultStatus",
    "internshipStatus",
    "internshipPlan",
    "internshipTrack",
    "paymentStatus",
    "paymentAmount",
    "paymentCurrency",
    "adminApprovalStatus",
    "studentOpsApprovalStatus",
    "studentOpsStatus",
    "dashboardStatus",
    "dashboardLoginEnabled",
    "dashboardCredentialsGenerated",
    "permissions",
  ] as const;

  const output: JsonRecord = {};

  for (const key of allowedKeys) {
    const value = source[key];

    if (value !== undefined && value !== null) {
      output[key] = value;
    }
  }

  return output;
}

function getNextStep(user: AuthUser, portal: Portal): string {
  if (portal === "admin") return "admin-dashboard";
  if (portal === "student-admin") return "student-admin-dashboard";
  if (portal === "student-dashboard") return "student-dashboard";

  const record = user as unknown as JsonRecord;
  const status = (key: string) => normalize(record[key]);

  if (
    record.dashboardLoginEnabled === true &&
    ["active", "completed"].includes(status("dashboardStatus"))
  ) {
    return "student-dashboard";
  }

  if (
    status("studentOpsApprovalStatus") === "pending" ||
    status("studentOpsStatus") === "pending-review"
  ) {
    return "student-admin-review";
  }

  if (
    status("paymentStatus") === "paid" &&
    (status("studentOpsApprovalStatus") !== "approved" ||
      !["active", "completed"].includes(status("studentOpsStatus")))
  ) {
    return "student-admin-review";
  }

  if (
    status("assessmentStatus") !== "passed" &&
    status("resultStatus") !== "passed"
  ) {
    return "assessment";
  }

  if (
    status("applicationStatus") !== "approved" &&
    status("adminApprovalStatus") !== "approved"
  ) {
    return "assessment";
  }

  if (["available", "locked"].includes(status("internshipStatus"))) {
    return "internships";
  }

  if (
    status("internshipStatus") === "payment-pending" ||
    ["pending", "failed", "unpaid"].includes(status("paymentStatus"))
  ) {
    return "payment";
  }

  if (["selected", "approved"].includes(status("internshipStatus"))) {
    return status("paymentStatus") === "paid"
      ? "student-admin-review"
      : "payment";
  }

  return "assessment";
}

function clearAuthenticationCookies(response: NextResponse): void {
  const names = [
    AUTH_COOKIE_NAME,
    ADMIN_AUTH_COOKIE_NAME,
    STUDENT_ADMIN_AUTH_COOKIE_NAME,
    STUDENT_AUTH_COOKIE_NAME,
    STUDENT_DASHBOARD_AUTH_COOKIE_NAME,
  ];

  for (const name of names) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

function setSessionCookie(
  response: NextResponse,
  name: string,
  options: CookieOptions,
  token: string,
): void {
  response.cookies.set(name, token, {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return request.headers.get("sec-fetch-site") !== "cross-site";
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

async function readRequestBody(
  request: NextRequest,
): Promise<{ body: string } | { tooLarge: true }> {
  const declaredLengthHeader = request.headers.get("content-length");
  const declaredLength =
    declaredLengthHeader && /^\\d+$/.test(declaredLengthHeader)
      ? Number(declaredLengthHeader)
      : 0;

  if (
    Number.isSafeInteger(declaredLength) &&
    declaredLength > MAX_BODY_BYTES
  ) {
    return { tooLarge: true };
  }

  if (!request.body) return { body: "" };

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
        await reader.cancel();
        return { tooLarge: true };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { body: new TextDecoder("utf-8", { fatal: true }).decode(combined) };
  } catch {
    return { body: "" };
  }
}

function statusForError(code: string): number {
  if (code === "INVALID_CONTENT_TYPE") return 415;
  if (code === "REQUEST_TOO_LARGE") return 413;

  if (
    [
      "INVALID_INPUT",
      "INVALID_REQUEST",
      "INVALID_JSON",
      "INVALID_CONTENT_TYPE",
      "REQUEST_TOO_LARGE",
      "IDENTIFIER_REQUIRED",
      "PASSWORD_REQUIRED",
      "INVALID_IDENTIFIER",
      "INVALID_PASSWORD",
      "INVALID_AUTH_MODE",
    ].includes(code)
  ) {
    return 400;
  }

  if (
    [
      "INVALID_ORIGIN",
      "AUTH_MODE_MISMATCH",
      "ACCOUNT_ROLE_NOT_CONFIGURED",
      "REGISTRATION_NOT_ACTIVE",
      "ACCOUNT_NOT_ACTIVE",
      "EMAIL_NOT_VERIFIED",
      "APPLICATION_PENDING",
      "APPLICATION_REJECTED",
      "APPLICATION_NOT_APPROVED",
      "CREDENTIALS_NOT_GENERATED",
      "CREDENTIALS_EXPIRED",
      "LOGIN_DISABLED",
      "ASSESSMENT_NOT_PASSED",
      "INTERNSHIP_NOT_APPROVED",
      "PAYMENT_NOT_VERIFIED",
      "STUDENT_OPS_NOT_APPROVED",
      "STUDENT_OPS_NOT_ACTIVE",
      "DASHBOARD_NOT_ACTIVE",
      "DASHBOARD_CREDENTIALS_NOT_GENERATED",
      "DASHBOARD_CREDENTIALS_EXPIRED",
      "ACCOUNT_DISABLED",
      "DASHBOARD_LOGIN_NOT_ENABLED",
    ].includes(code)
  ) {
    return 403;
  }

  if (
    [
      "ACCOUNT_TEMPORARILY_LOCKED",
      "DASHBOARD_ACCOUNT_TEMPORARILY_LOCKED",
      "RATE_LIMITED",
    ].includes(code)
  ) {
    return 429;
  }

  if (
    [
      "AUTHENTICATION_ERROR",
      "INTERNAL_SERVER_ERROR",
      "AUTH_SECRET_NOT_CONFIGURED",
      "ADMIN_PASSWORD_NOT_CONFIGURED",
    ].includes(code)
  ) {
    return 500;
  }

  return 401;
}

function failureResponse(
  result: Extract<LoginResult, { success: false }>,
  requestId: string,
): NextResponse {
  const status = statusForError(result.code);
  const response = jsonResponse(
    {
      success: false,
      message: result.message || "Unable to sign in.",
      code: result.code,
      ...(typeof result.retryAfter === "number"
        ? { retryAfter: result.retryAfter }
        : {}),
      requestId,
    },
    status,
    requestId,
  );

  if (typeof result.retryAfter === "number" && result.retryAfter > 0) {
    response.headers.set("Retry-After", String(result.retryAfter));
  }

  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId(request);

  try {
    if (!isSameOriginRequest(request)) {
      return jsonResponse(
        {
          success: false,
          message: "Cross-origin login requests are not allowed.",
          code: "INVALID_ORIGIN",
          requestId,
        },
        403,
        requestId,
      );
    }

    const contentType = (request.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();

    if (contentType !== "application/json") {
      return jsonResponse(
        {
          success: false,
          message: "Request must use application/json.",
          code: "INVALID_CONTENT_TYPE",
          requestId,
        },
        415,
        requestId,
      );
    }

    const bodyResult = await readRequestBody(request);

    if ("tooLarge" in bodyResult) {
      return jsonResponse(
        {
          success: false,
          message: "Request body is too large.",
          code: "REQUEST_TOO_LARGE",
          requestId,
        },
        413,
        requestId,
      );
    }

    if (!bodyResult.body.trim()) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid JSON request body.",
          code: "INVALID_JSON",
          requestId,
        },
        400,
        requestId,
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(bodyResult.body);
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Invalid JSON request body.",
          code: "INVALID_JSON",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid login request.",
          code: "INVALID_REQUEST",
          requestId,
        },
        400,
        requestId,
      );
    }

    const data = body as JsonRecord;
    const allowedBodyKeys = new Set(["identifier", "password", "mode"]);
    if (Object.keys(data).some((key) => !allowedBodyKeys.has(key))) {
      return jsonResponse(
        {
          success: false,
          message: "Login request contains unsupported fields.",
          code: "INVALID_REQUEST",
          requestId,
        },
        400,
        requestId,
      );
    }
    const identifier =
      typeof data.identifier === "string" ? data.identifier.trim() : "";
    const password = typeof data.password === "string" ? data.password : "";
    const mode = getLoginMode(data.mode);

    if (!identifier) {
      return jsonResponse(
        {
          success: false,
          message: "Email, Student ID, or Admin ID is required.",
          code: "IDENTIFIER_REQUIRED",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (
      identifier.length > MAX_IDENTIFIER_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(identifier)
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid login identifier.",
          code: "INVALID_IDENTIFIER",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (!password) {
      return jsonResponse(
        {
          success: false,
          message: "Password is required.",
          code: "PASSWORD_REQUIRED",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH ||
      password.includes("\u0000")
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid password length.",
          code: "INVALID_PASSWORD",
          requestId,
        },
        400,
        requestId,
      );
    }

    if (!mode) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid authentication mode.",
          code: "INVALID_AUTH_MODE",
          requestId,
        },
        400,
        requestId,
      );
    }

    const input: LoginInput = { identifier, password, mode };
    const result: LoginResult =
      mode === "student-dashboard"
        ? await loginStudentDashboard(input)
        : await login(input);

    if (!result.success) {
      return failureResponse(result, requestId);
    }

    const portal = detectPortal(result.user);

    if (!portal) {
      const response = jsonResponse(
        {
          success: false,
          message:
            "Account role is not configured. Please contact the administrator.",
          code: "ACCOUNT_ROLE_NOT_CONFIGURED",
          requestId,
        },
        403,
        requestId,
      );
      return response;
    }

    if (!isModeAllowed(portal, mode)) {
      const response = jsonResponse(
        {
          success: false,
          message: "This account cannot sign in through the selected portal.",
          code: "AUTH_MODE_MISMATCH",
          requestId,
        },
        403,
        requestId,
      );
      return response;
    }

    const cookie = getCookieConfig(portal);
    const response = jsonResponse(
      {
        success: true,
        message: result.message || "Login successful.",
        user: serializePublicUser(result.user),
        portal,
        sessionType: portal,
        nextStep: getNextStep(result.user, portal),
        expiresIn: result.expiresIn,
        requestId,
      },
      200,
      requestId,
    );

    clearAuthenticationCookies(response);
    setSessionCookie(response, cookie.name, cookie.options, result.token);

    if (portal === "student-admin") {
      setSessionCookie(
        response,
        ADMIN_AUTH_COOKIE_NAME,
        ADMIN_AUTH_COOKIE_OPTIONS,
        result.token,
      );
    } else {
      setSessionCookie(
        response,
        AUTH_COOKIE_NAME,
        AUTH_COOKIE_OPTIONS,
        result.token,
      );
    }

    response.headers.set("Vary", "Cookie");
    return response;
  } catch (error) {
    logLoginApiFailure(requestId, error);

    const response = jsonResponse(
      {
        success: false,
        message: "Unable to process login right now. Please try again later.",
        code: "INTERNAL_SERVER_ERROR",
        requestId,
      },
      500,
      requestId,
    );
    return response;
  }
}

function methodNotAllowed(request: NextRequest): NextResponse {
  const requestId = createRequestId(request);
  const response = jsonResponse(
    {
      success: false,
      message: "Method not allowed.",
      code: "METHOD_NOT_ALLOWED",
      requestId,
    },
    405,
    requestId,
  );

  response.headers.set("Allow", "POST, OPTIONS");
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId(request);

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      "X-Request-ID": requestId,
      Allow: "POST, OPTIONS",
    },
  });
}
