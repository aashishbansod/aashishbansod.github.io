import { NextRequest, NextResponse } from "next/server";

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

/**
 * ============================================================
 * CYBERNET CAREERS
 * PRODUCTION AUTH LOGOUT API
 * ============================================================
 *
 * POST /api/auth/logout
 *
 * Supported scopes:
 *
 *   { "scope": "admin" }
 *   { "scope": "student" }
 *   { "scope": "student-dashboard" }
 *   { "scope": "all" }
 *
 * Empty body:
 *
 *   -> "all"
 *
 * Security model:
 *
 * - Does not decode JWTs.
 * - Does not return JWT contents.
 * - Does not require MongoDB.
 * - Logout is idempotent.
 * - Dedicated authentication cookies are supported.
 * - Legacy authentication cookie is always cleared.
 * - Same-origin protection is enforced.
 * - Cookies are expired using their original attributes.
 * - Responses are never cached.
 * - Request IDs are returned for observability.
 *
 * IMPORTANT:
 *
 * Cookie deletion must use compatible cookie attributes.
 * Therefore this route preserves the original cookie
 * configuration and changes only expiration.
 *
 * ============================================================
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;


/* ============================================================
   CONFIGURATION
   ============================================================ */

const ALLOWED_METHODS =
  "POST, OPTIONS";

const MAX_BODY_SIZE =
  2_048;

const LOGOUT_SCOPES = [
  "admin",
  "student",
  "student-dashboard",
  "all",
] as const;

type LogoutScope =
  (typeof LOGOUT_SCOPES)[number];

type CookieOptions =
  | typeof AUTH_COOKIE_OPTIONS
  | typeof ADMIN_AUTH_COOKIE_OPTIONS
  | typeof STUDENT_AUTH_COOKIE_OPTIONS
  | typeof STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS;


/* ============================================================
   REQUEST ID
   ============================================================ */

function getRequestId(
  request: NextRequest,
): string {
  const incoming =
    request.headers
      .get("x-request-id")
      ?.trim();

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
    return `logout-${Date.now()}-${Math.random()
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
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  response.headers.set(
    "Cross-Origin-Resource-Policy",
    "same-origin",
  );

  response.headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive",
  );

  response.headers.set(
    "Vary",
    "Cookie",
  );

  response.headers.set(
    "X-Request-ID",
    requestId,
  );

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return response;
}


/* ============================================================
   JSON RESPONSE
   ============================================================ */

function jsonResponse(
  data: unknown,
  status: number,
  requestId: string,
): NextResponse {
  return applySecurityHeaders(
    NextResponse.json(
      data,
      {
        status,
      },
    ),
    requestId,
  );
}


/* ============================================================
   EMPTY RESPONSE
   ============================================================ */

function emptyResponse(
  status: number,
  requestId: string,
): NextResponse {
  return applySecurityHeaders(
    new NextResponse(
      null,
      {
        status,
      },
    ),
    requestId,
  );
}


/* ============================================================
   SAME-ORIGIN / CSRF PROTECTION
   ============================================================ */

function isSameOriginRequest(
  request: NextRequest,
): boolean {
  const origin =
    request.headers
      .get("origin")
      ?.trim();

  /*
   * Some legitimate same-origin requests may not
   * include Origin.
   */
  if (!origin) {
    return true;
  }

  try {
    const requestOrigin =
      request.nextUrl.origin;

    return (
      new URL(origin).origin ===
      requestOrigin
    );
  } catch {
    return false;
  }
}


/* ============================================================
   BODY SIZE VALIDATION
   ============================================================ */

function isBodyTooLarge(
  request: NextRequest,
): boolean {
  const contentLength =
    request.headers.get(
      "content-length",
    );

  if (!contentLength) {
    return false;
  }

  const length =
    Number(contentLength);

  if (
    !Number.isFinite(length) ||
    length < 0
  ) {
    return false;
  }

  return (
    length >
    MAX_BODY_SIZE
  );
}


/* ============================================================
   CONTENT TYPE VALIDATION
   ============================================================ */

function isJsonContentType(
  request: NextRequest,
): boolean {
  const contentType =
    request.headers.get(
      "content-type",
    );

  /*
   * Empty body is supported for backwards compatibility.
   */
  if (!contentType) {
    return true;
  }

  return (
    contentType
      .toLowerCase()
      .split(";", 1)[0]
      .trim() ===
    "application/json"
  );
}


/* ============================================================
   LOGOUT SCOPE NORMALIZATION
   ============================================================ */

function normalizeScope(
  value: unknown,
): LogoutScope | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "all";
  }

  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    !normalized
  ) {
    return "all";
  }

  return (
    LOGOUT_SCOPES as readonly string[]
  ).includes(
    normalized,
  )
    ? (normalized as LogoutScope)
    : null;
}


/* ============================================================
   PARSE LOGOUT REQUEST
   ============================================================ */

async function parseScope(
  request: NextRequest,
  requestId: string,
): Promise<
  | {
      success: true;
      scope: LogoutScope;
    }
  | {
      success: false;
      response: NextResponse;
    }
> {
  /*
   * ----------------------------------------------------------
   * BODY SIZE
   * ----------------------------------------------------------
   */

  if (
    isBodyTooLarge(request)
  ) {
    return {
      success: false,

      response:
        jsonResponse(
          {
            success: false,
            message:
              "Logout request body is too large.",
            code:
              "REQUEST_TOO_LARGE",
          },
          413,
          requestId,
        ),
    };
  }

  /*
   * ----------------------------------------------------------
   * CONTENT TYPE
   * ----------------------------------------------------------
   */

  if (
    !isJsonContentType(
      request,
    )
  ) {
    return {
      success: false,

      response:
        jsonResponse(
          {
            success: false,
            message:
              "Request must use application/json.",
            code:
              "INVALID_CONTENT_TYPE",
          },
          415,
          requestId,
        ),
    };
  }

  /*
   * ----------------------------------------------------------
   * EMPTY BODY
   * ----------------------------------------------------------
   *
   * Empty logout request means full logout.
   */

  const contentLength =
    request.headers.get(
      "content-length",
    );

  if (
    contentLength &&
    Number(contentLength) === 0
  ) {
    return {
      success: true,
      scope: "all",
    };
  }

  /*
   * ----------------------------------------------------------
   * READ BODY
   * ----------------------------------------------------------
   */

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    /*
     * Some clients do not send a body or a reliable
     * content-length header.
     *
     * Preserve backwards compatibility:
     * invalid/empty body -> all.
     */
    return {
      success: true,
      scope: "all",
    };
  }

  /*
   * ----------------------------------------------------------
   * BODY OBJECT
   * ----------------------------------------------------------
   */

  if (
    !body ||
    typeof body !==
      "object" ||
    Array.isArray(body)
  ) {
    return {
      success: false,

      response:
        jsonResponse(
          {
            success: false,
            message:
              "Invalid logout request.",
            code:
              "INVALID_REQUEST",
          },
          400,
          requestId,
        ),
    };
  }

  const value =
    (
      body as Record<
        string,
        unknown
      >
    ).scope;

  const scope =
    normalizeScope(value);

  if (!scope) {
    return {
      success: false,

      response:
        jsonResponse(
          {
            success: false,

            message:
              "Invalid logout scope. Use admin, student, student-dashboard or all.",

            code:
              "INVALID_LOGOUT_SCOPE",
          },
          400,
          requestId,
        ),
    };
  }

  return {
    success: true,
    scope,
  };
}


/* ============================================================
   COOKIE EXPIRATION
   ============================================================ */

function expireCookie(
  response: NextResponse,
  name: string,
  options: CookieOptions,
): void {
  /*
   * IMPORTANT:
   *
   * Keep the original cookie attributes.
   *
   * Only expiration is changed.
   *
   * This makes deletion reliable when the original
   * cookie was created with:
   *
   * - httpOnly
   * - secure
   * - sameSite
   * - path
   * - maxAge
   */

  response.cookies.set(
    name,
    "",
    {
      ...options,

      maxAge: 0,

      expires:
        new Date(0),

      path:
        options.path ??
        "/",
    },
  );
}


/* ============================================================
   LEGACY COOKIE
   ============================================================ */

function expireLegacyCookie(
  response: NextResponse,
): void {
  expireCookie(
    response,
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_OPTIONS,
  );
}


/* ============================================================
   ADMIN COOKIE
   ============================================================ */

function expireAdminCookie(
  response: NextResponse,
): void {
  expireCookie(
    response,
    ADMIN_AUTH_COOKIE_NAME,
    ADMIN_AUTH_COOKIE_OPTIONS,
  );
}


/* ============================================================
   MAIN STUDENT COOKIE
   ============================================================ */

function expireStudentCookie(
  response: NextResponse,
): void {
  expireCookie(
    response,
    STUDENT_AUTH_COOKIE_NAME,
    STUDENT_AUTH_COOKIE_OPTIONS,
  );
}


/* ============================================================
   STUDENT DASHBOARD COOKIE
   ============================================================ */

function expireDashboardCookie(
  response: NextResponse,
): void {
  expireCookie(
    response,
    STUDENT_DASHBOARD_AUTH_COOKIE_NAME,
    STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS,
  );
}


/* ============================================================
   APPLY LOGOUT SCOPE
   ============================================================ */

function applyLogoutScope(
  response: NextResponse,
  scope: LogoutScope,
): void {
  switch (scope) {
    /*
     * --------------------------------------------------------
     * ADMIN
     * --------------------------------------------------------
     */

    case "admin":
      expireAdminCookie(
        response,
      );
      break;

    /*
     * --------------------------------------------------------
     * MAIN STUDENT
     * --------------------------------------------------------
     */

    case "student":
      expireStudentCookie(
        response,
      );
      break;

    /*
     * --------------------------------------------------------
     * STUDENT DASHBOARD
     * --------------------------------------------------------
     */

    case "student-dashboard":
      expireDashboardCookie(
        response,
      );
      break;

    /*
     * --------------------------------------------------------
     * EVERYTHING
     * --------------------------------------------------------
     */

    case "all":
      expireAdminCookie(
        response,
      );

      expireStudentCookie(
        response,
      );

      expireDashboardCookie(
        response,
      );

      break;
  }

  /*
   * ----------------------------------------------------------
   * LEGACY COOKIE
   * ----------------------------------------------------------
   *
   * The legacy cookie is not session-specific.
   *
   * It is therefore always cleared during logout.
   *
   * This prevents an older route from restoring a stale
   * authentication state after the user has logged out.
   */

  expireLegacyCookie(
    response,
  );
}


/* ============================================================
   METHOD NOT ALLOWED
   ============================================================ */

function methodNotAllowed(
  request: NextRequest,
): NextResponse {
  const requestId =
    getRequestId(request);

  const response =
    jsonResponse(
      {
        success: false,

        message:
          "Method not allowed.",

        code:
          "METHOD_NOT_ALLOWED",
      },
      405,
      requestId,
    );

  response.headers.set(
    "Allow",
    ALLOWED_METHODS,
  );

  return response;
}


/* ============================================================
   POST /api/auth/logout
   ============================================================ */

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  try {
    /*
     * --------------------------------------------------------
     * SAME-ORIGIN PROTECTION
     * --------------------------------------------------------
     */

    if (
      !isSameOriginRequest(
        request,
      )
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Cross-origin logout requests are not allowed.",

          code:
            "INVALID_ORIGIN",
        },
        403,
        requestId,
      );
    }

    /*
     * --------------------------------------------------------
     * PARSE SCOPE
     * --------------------------------------------------------
     */

    const parsed =
      await parseScope(
        request,
        requestId,
      );

    if (
      !parsed.success
    ) {
      return parsed.response;
    }

    /*
     * --------------------------------------------------------
     * CREATE RESPONSE
     * --------------------------------------------------------
     *
     * Logout is intentionally idempotent.
     *
     * We do NOT:
     *
     * - decode JWT
     * - query MongoDB
     * - validate session
     * - check password
     * - check account status
     *
     * A missing or already expired cookie should still
     * result in a successful logout operation.
     */

    const response =
      jsonResponse(
        {
          success: true,

          message:
            parsed.scope ===
            "all"
              ? "You have been logged out successfully."
              : "The selected session has been logged out successfully.",

          code:
            "LOGOUT_SUCCESS",

          scope:
            parsed.scope,

          requestId,
        },
        200,
        requestId,
      );

    /*
     * --------------------------------------------------------
     * EXPIRE SESSION COOKIE(S)
     * --------------------------------------------------------
     */

    applyLogoutScope(
      response,
      parsed.scope,
    );

    return response;
  } catch (error) {
    /*
     * Never expose internal errors to the browser.
     */

    console.error(
      "[CyberNet Careers] POST /api/auth/logout failed:",
      {
        requestId,
        error,
      },
    );

    return jsonResponse(
      {
        success: false,

        message:
          "Unable to complete logout. Please try again.",

        code:
          "LOGOUT_ERROR",

        requestId,
      },
      500,
      requestId,
    );
  }
}


/* ============================================================
   GET /api/auth/logout
   ============================================================ */

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  return methodNotAllowed(
    request,
  );
}


/* ============================================================
   HEAD /api/auth/logout
   ============================================================ */

export async function HEAD(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  const response =
    emptyResponse(
      405,
      requestId,
    );

  response.headers.set(
    "Allow",
    ALLOWED_METHODS,
  );

  return response;
}


/* ============================================================
   PUT /api/auth/logout
   ============================================================ */

export async function PUT(
  request: NextRequest,
): Promise<NextResponse> {
  return methodNotAllowed(
    request,
  );
}


/* ============================================================
   PATCH /api/auth/logout
   ============================================================ */

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  return methodNotAllowed(
    request,
  );
}


/* ============================================================
   DELETE /api/auth/logout
   ============================================================ */

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  return methodNotAllowed(
    request,
  );
}


/* ============================================================
   OPTIONS /api/auth/logout
   ============================================================ */

export async function OPTIONS(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId =
    getRequestId(request);

  const response =
    emptyResponse(
      204,
      requestId,
    );

  response.headers.set(
    "Allow",
    ALLOWED_METHODS,
  );

  return response;
}