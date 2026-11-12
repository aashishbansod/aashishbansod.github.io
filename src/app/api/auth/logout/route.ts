import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
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

const MAX_BODY_BYTES = 2_048;
const ALLOWED_METHODS = "POST, OPTIONS";
const LOGOUT_SCOPES = [
  "admin",
  "student-admin",
  "student",
  "student-dashboard",
  "all",
] as const;

type LogoutScope = (typeof LOGOUT_SCOPES)[number];
type CookieOptions =
  | typeof AUTH_COOKIE_OPTIONS
  | typeof ADMIN_AUTH_COOKIE_OPTIONS
  | typeof STUDENT_ADMIN_AUTH_COOKIE_OPTIONS
  | typeof STUDENT_AUTH_COOKIE_OPTIONS
  | typeof STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS;

type JsonRecord = Record<string, unknown>;

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Cookie",
} as const;

function getRequestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();

  return supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
}

function applySecurityHeaders(
  response: NextResponse,
  requestId: string,
): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }

  response.headers.set("X-Request-ID", requestId);

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  return response;
}

function jsonResponse(
  body: JsonRecord,
  status: number,
  requestId: string,
): NextResponse {
  return applySecurityHeaders(
    NextResponse.json(body, { status }),
    requestId,
  );
}

function emptyResponse(status: number, requestId: string): NextResponse {
  return applySecurityHeaders(new NextResponse(null, { status }), requestId);
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin")?.trim();

  if (origin) {
    try {
      return new URL(origin).origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  return fetchSite === "same-origin" || fetchSite === "same-site";
}

async function readBody(
  request: NextRequest,
): Promise<{ kind: "empty" } | { kind: "body"; value: string } | { kind: "too-large" } | { kind: "invalid-encoding" }> {
  const lengthHeader = request.headers.get("content-length");
  const declaredLength =
    lengthHeader && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : 0;

  if (
    Number.isSafeInteger(declaredLength) &&
    declaredLength > MAX_BODY_BYTES
  ) {
    return { kind: "too-large" };
  }

  if (!request.body) return { kind: "empty" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;

      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return { kind: "too-large" };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) return { kind: "empty" };

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      kind: "body",
      value: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return { kind: "invalid-encoding" };
  }
}

function normalizeScope(value: unknown): LogoutScope | null {
  if (value === undefined || value === null || value === "") return "all";
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return "all";

  return (LOGOUT_SCOPES as readonly string[]).includes(normalized)
    ? (normalized as LogoutScope)
    : null;
}

function expireCookie(
  response: NextResponse,
  name: string,
  options: CookieOptions,
): void {
  response.cookies.set(name, "", {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: options.path || "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

function expireLegacyCookie(response: NextResponse): void {
  expireCookie(response, AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
}

function applyLogoutScope(
  response: NextResponse,
  scope: LogoutScope,
): void {
  if (scope === "admin" || scope === "all") {
    expireCookie(response, ADMIN_AUTH_COOKIE_NAME, ADMIN_AUTH_COOKIE_OPTIONS);
  }

  if (scope === "student-admin" || scope === "all") {
    expireCookie(
      response,
      STUDENT_ADMIN_AUTH_COOKIE_NAME,
      STUDENT_ADMIN_AUTH_COOKIE_OPTIONS,
    );
  }

  if (scope === "student" || scope === "all") {
    expireCookie(response, STUDENT_AUTH_COOKIE_NAME, STUDENT_AUTH_COOKIE_OPTIONS);
  }

  if (scope === "student-dashboard" || scope === "all") {
    expireCookie(
      response,
      STUDENT_DASHBOARD_AUTH_COOKIE_NAME,
      STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS,
    );
  }

  expireLegacyCookie(response);
}

function methodNotAllowed(request: NextRequest): NextResponse {
  const requestId = getRequestId(request);
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

  response.headers.set("Allow", ALLOWED_METHODS);
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);

  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      {
        success: false,
        message: "Cross-origin logout requests are not allowed.",
        code: "INVALID_ORIGIN",
        requestId,
      },
      403,
      requestId,
    );
  }

  const contentType = request.headers.get("content-type");
  const hasBody = request.body !== null;

  if (
    (contentType && contentType.split(";", 1)[0].trim().toLowerCase() !== "application/json") ||
    (hasBody && !contentType)
  ) {
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

  try {
    const bodyResult = await readBody(request);

    if (bodyResult.kind === "too-large") {
      return jsonResponse(
        {
          success: false,
          message: "Logout request body is too large.",
          code: "REQUEST_TOO_LARGE",
          requestId,
        },
        413,
        requestId,
      );
    }

    if (bodyResult.kind === "invalid-encoding") {
      return jsonResponse(
        {
          success: false,
          message: "Invalid request encoding.",
          code: "INVALID_REQUEST",
          requestId,
        },
        400,
        requestId,
      );
    }

    let scope: LogoutScope = "all";

    if (bodyResult.kind === "body") {
      let parsed: unknown;

      try {
        parsed = JSON.parse(bodyResult.value);
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

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return jsonResponse(
          {
            success: false,
            message: "Invalid logout request.",
            code: "INVALID_REQUEST",
            requestId,
          },
          400,
          requestId,
        );
      }

      const data = parsed as JsonRecord;
      const unknownKeys = Object.keys(data).filter((key) => key !== "scope");

      if (unknownKeys.length > 0) {
        return jsonResponse(
          {
            success: false,
            message: "Logout request contains unsupported fields.",
            code: "INVALID_REQUEST_FIELDS",
            requestId,
          },
          400,
          requestId,
        );
      }

      scope = normalizeScope(data.scope) ?? "all";

      if (!normalizeScope(data.scope)) {
        return jsonResponse(
          {
            success: false,
            message:
              "Invalid logout scope. Use admin, student-admin, student, student-dashboard or all.",
            code: "INVALID_LOGOUT_SCOPE",
            requestId,
          },
          400,
          requestId,
        );
      }
    }

    const response = jsonResponse(
      {
        success: true,
        message:
          scope === "all"
            ? "You have been logged out successfully."
            : "The selected session has been logged out successfully.",
        code: "LOGOUT_SUCCESS",
        scope,
        requestId,
      },
      200,
      requestId,
    );

    applyLogoutScope(response, scope);
    return response;
  } catch (error) {
    const details =
      error !== null && typeof error === "object"
        ? (error as { name?: unknown; code?: unknown })
        : {};

    console.error("[CyberNet Careers] Logout API failed.", {
      requestId,
      errorName:
        typeof details.name === "string"
          ? details.name.slice(0, 80)
          : "UnknownError",
      ...(typeof details.code === "string" ||
      typeof details.code === "number"
        ? { errorCode: String(details.code).slice(0, 40) }
        : {}),
    });

    return jsonResponse(
      {
        success: false,
        message: "Unable to complete logout. Please try again.",
        code: "LOGOUT_ERROR",
        requestId,
      },
      500,
      requestId,
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return methodNotAllowed(request);
}

export async function HEAD(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const response = emptyResponse(405, requestId);
  response.headers.set("Allow", ALLOWED_METHODS);
  return response;
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
  const requestId = getRequestId(request);
  const response = emptyResponse(204, requestId);
  response.headers.set("Allow", ALLOWED_METHODS);
  return response;
}
