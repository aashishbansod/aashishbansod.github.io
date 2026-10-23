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

function createRequestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  if (supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied)) {
    return supplied;
  }
  return randomUUID();
}

function jsonResponse(
  body: JsonRecord,
  status: number,
  id: string,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Request-ID": id,
    },
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
  return String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function detectPortal(user: AuthUser, requestedMode: LoginMode): Portal | null {
  const record = user as unknown as JsonRecord;
  const userType = normalize(record.userType ?? record.type);
  const role = normalize(record.role);
  const adminRole = normalize(record.adminRole);
  const sessionType = normalize(record.sessionType);
  const authenticationMode = normalize(record.authenticationMode);

  if (
    requestedMode === "student-dashboard" ||
    sessionType === "student-dashboard" ||
    authenticationMode === "student-dashboard"
  ) {
    return "student-dashboard";
  }

  if (
    ["student-admin", "student-operations-admin", "studentadmin"].includes(userType) ||
    ["student-admin", "student-operations-admin", "studentadmin"].includes(adminRole) ||
    ["student-admin", "student-operations-admin", "studentadmin"].includes(role)
  ) {
    return "student-admin";
  }

  if (
    ["admin", "super-admin"].includes(userType) ||
    ["admin", "super-admin"].includes(role) ||
    Boolean(adminRole)
  ) {
    return "admin";
  }

  if (userType === "student" || role === "student" || sessionType === "student") {
    return "student";
  }

  return null;
}

function isModeAllowed(portal: Portal, mode: LoginMode): boolean {
  if (mode === "auto") return true;
  return portal === mode;
}

function getCookieConfig(portal: Portal): {
  name: string;
  options: typeof AUTH_COOKIE_OPTIONS;
} {
  switch (portal) {
    case "admin":
    case "student-admin":
      return {
        name: ADMIN_AUTH_COOKIE_NAME,
        options: ADMIN_AUTH_COOKIE_OPTIONS,
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

/**
 * Explicit allowlist: never serialize password hashes, tokens, lockout internals,
 * MFA secrets, recovery codes, or database documents wholesale.
 */
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
    "fullName",
    "name",
    "role",
    "adminRole",
    "userType",
    "type",
    "sessionType",
    "emailVerified",
    "isEmailVerified",
    "isActive",
    "loginEnabled",
    "applicationId",
    "applicationStatus",
    "assessmentStatus",
    "resultStatus",
    "internshipStatus",
    "paymentStatus",
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
    if (value !== undefined && value !== null) output[key] = value;
  }
  return output;
}

function getNextStep(user: AuthUser, portal: Portal): string {
  if (portal === "admin") return "admin-dashboard";
  if (portal === "student-admin") return "student-admin-review";
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
  options: typeof AUTH_COOKIE_OPTIONS,
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

  // Non-browser clients may omit Origin. If supplied, it must match exactly.
  if (!origin) {
    const fetchSite = request.headers.get("sec-fetch-site");
    return fetchSite !== "cross-site";
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function statusForError(code: string): number {
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
  id: string,
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
      requestId: id,
    },
    status,
    id,
  );

  if (typeof result.retryAfter === "number" && result.retryAfter > 0) {
    response.headers.set("Retry-After", String(result.retryAfter));
  }

  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const id = createRequestId(request);

  try {
    if (!isSameOriginRequest(request)) {
      return jsonResponse(
        {
          success: false,
          message: "Cross-origin login requests are not allowed.",
          code: "INVALID_ORIGIN",
          requestId: id,
        },
        403,
        id,
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
          requestId: id,
        },
        415,
        id,
      );
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return jsonResponse(
        {
          success: false,
          message: "Request body is too large.",
          code: "REQUEST_TOO_LARGE",
          requestId: id,
        },
        413,
        id,
      );
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return jsonResponse(
        {
          success: false,
          message: "Request body is too large.",
          code: "REQUEST_TOO_LARGE",
          requestId: id,
        },
        413,
        id,
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Invalid JSON request body.",
          code: "INVALID_JSON",
          requestId: id,
        },
        400,
        id,
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid login request.",
          code: "INVALID_REQUEST",
          requestId: id,
        },
        400,
        id,
      );
    }

    const data = body as JsonRecord;
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
          requestId: id,
        },
        400,
        id,
      );
    }

    if (identifier.length > MAX_IDENTIFIER_LENGTH) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid login identifier.",
          code: "INVALID_IDENTIFIER",
          requestId: id,
        },
        400,
        id,
      );
    }

    if (!password) {
      return jsonResponse(
        {
          success: false,
          message: "Password is required.",
          code: "PASSWORD_REQUIRED",
          requestId: id,
        },
        400,
        id,
      );
    }

    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid password length.",
          code: "INVALID_PASSWORD",
          requestId: id,
        },
        400,
        id,
      );
    }

    if (!mode) {
      return jsonResponse(
        {
          success: false,
          message: "Invalid authentication mode.",
          code: "INVALID_AUTH_MODE",
          requestId: id,
        },
        400,
        id,
      );
    }

    const input: LoginInput = { identifier, password };
    const result: LoginResult =
      mode === "student-dashboard"
        ? await loginStudentDashboard(input)
        : await login(input);

    if (!result.success) {
      return failureResponse(result, id);
    }

    const portal = detectPortal(result.user, mode);
    if (!portal) {
      return jsonResponse(
        {
          success: false,
          message:
            "Account role is not configured. Please contact the administrator.",
          code: "ACCOUNT_ROLE_NOT_CONFIGURED",
          requestId: id,
        },
        403,
        id,
      );
    }

    if (!isModeAllowed(portal, mode)) {
      return jsonResponse(
        {
          success: false,
          message: "This account cannot sign in through the selected portal.",
          code: "AUTH_MODE_MISMATCH",
          requestId: id,
        },
        403,
        id,
      );
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
        requestId: id,
      },
      200,
      id,
    );

    clearAuthenticationCookies(response);
    setSessionCookie(response, cookie.name, cookie.options, result.token);

    // Keep the legacy cookie until all older protected routes have migrated.
    setSessionCookie(
      response,
      AUTH_COOKIE_NAME,
      AUTH_COOKIE_OPTIONS,
      result.token,
    );

    response.headers.set("Vary", "Cookie");
    return response;
  } catch (error) {
    console.error("[CyberNet Careers] Login API failed", {
      requestId: id,
      error,
    });

    return jsonResponse(
      {
        success: false,
        message: "Unable to process login right now. Please try again later.",
        code: "INTERNAL_SERVER_ERROR",
        requestId: id,
      },
      500,
      id,
    );
  }
}

function methodNotAllowed(request: NextRequest): NextResponse {
  const id = createRequestId(request);
  const response = jsonResponse(
    {
      success: false,
      message: "Method not allowed.",
      code: "METHOD_NOT_ALLOWED",
      requestId: id,
    },
    405,
    id,
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
  const id = createRequestId(request);
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-ID": id,
      Allow: "POST, OPTIONS",
    },
  });
}
