import { NextRequest, NextResponse } from "next/server";

/**
 * CyberNet Careers - Production Authentication Middleware
 *
 * Session cookies:
 *   admin              -> cybernet_admin_auth_token
 *   student            -> cybernet_student_auth_token
 *   student-dashboard  -> cybernet_student_dashboard_token
 *   legacy             -> cybernet_auth_token (backward compatibility)
 *
 * IMPORTANT:
 * - This layer verifies JWT integrity/expiry and route/session boundaries.
 * - Database/workflow authorization remains authoritative in API/services.
 * - HttpOnly cookies are browser-profile scoped, not tab scoped. Multiple
 *   tabs in one browser profile therefore share the same cookie jar.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOGIN_PATH = "/login";
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "";

const MAX_TOKEN_LENGTH = 8192;
const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

const ADMIN_COOKIE = "cybernet_admin_auth_token";
const STUDENT_COOKIE = "cybernet_student_auth_token";
const DASHBOARD_COOKIE = "cybernet_student_dashboard_token";
const LEGACY_COOKIE = "cybernet_auth_token";

type SessionType = "legacy" | "admin" | "student" | "student-dashboard";

type JwtHeader = {
  alg?: unknown;
  typ?: unknown;
};

type JwtPayload = {
  sub?: unknown;
  userId?: unknown;
  studentId?: unknown;
  email?: unknown;
  identifier?: unknown;
  role?: unknown;
  userType?: unknown;
  type?: unknown;
  adminRole?: unknown;
  sessionType?: unknown;
  session?: unknown;
  jti?: unknown;
  iat?: unknown;
  exp?: unknown;
};

type VerifiedSession = {
  payload: JwtPayload;
  sessionType: SessionType;
  cookieName: string;
};

function getRequestId(request: NextRequest): string {
  const incoming = request.headers.get("x-request-id");
  if (incoming && /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)) return incoming;

  try {
    return crypto.randomUUID();
  } catch {
    return `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function applySecurityHeaders(response: NextResponse, requestId?: string): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (requestId) response.headers.set("X-Request-ID", requestId);
  return response;
}

function base64UrlToString(value: string): string | null {
  try {
    if (!value || value.length > MAX_TOKEN_LENGTH) return null;
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const remainder = normalized.length % 4;
    const padding = remainder === 0 ? "" : "=".repeat(4 - remainder);
    return atob(normalized + padding);
  } catch {
    return null;
  }
}

function base64UrlToBytes(value: string): Uint8Array | null {
  const decoded = base64UrlToString(value);
  if (decoded === null) return null;

  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function verifySignature(unsignedToken: string, signature: string): Promise<boolean> {
  try {
    if (!AUTH_SECRET || AUTH_SECRET.length < 32) return false;

    const signatureBytes = base64UrlToBytes(signature);
    if (!signatureBytes) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(new TextEncoder().encode(AUTH_SECRET)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(new TextEncoder().encode(unsignedToken)),
    );
  } catch {
    return false;
  }
}

async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    if (!AUTH_SECRET || AUTH_SECRET.length < 32) return null;
    if (!token || token.length > MAX_TOKEN_LENGTH) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

    const headerText = base64UrlToString(encodedHeader);
    const payloadText = base64UrlToString(encodedPayload);
    if (!headerText || !payloadText) return null;

    const header = parseJson<JwtHeader>(headerText);
    const payload = parseJson<JwtPayload>(payloadText);
    if (!header || !payload) return null;

    if (header.alg !== "HS256") return null;
    if (header.typ !== undefined && header.typ !== "JWT") return null;

    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;

    if (payload.iat !== undefined) {
      if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) return null;
      if (payload.iat > now + CLOCK_SKEW_SECONDS) return null;
      if (payload.exp <= payload.iat) return null;
      if (payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SECONDS) return null;
    }

    const valid = await verifySignature(
      `${encodedHeader}.${encodedPayload}`,
      encodedSignature,
    );

    return valid ? payload : null;
  } catch {
    return null;
  }
}

function isAdminPayload(payload: JwtPayload): boolean {
  return (
    payload.sessionType === "admin" ||
    payload.role === "admin" ||
    payload.userType === "admin" ||
    payload.type === "admin" ||
    payload.adminRole === "Super Admin" ||
    payload.adminRole === "Admin" ||
    payload.adminRole === "HR" ||
    payload.adminRole === "Assessment Manager" ||
    payload.adminRole === "Support" ||
    payload.adminRole === "Student Operations Admin"
  );
}

function isStudentPayload(payload: JwtPayload): boolean {
  return (
    payload.sessionType === "student" ||
    payload.sessionType === "student-dashboard" ||
    payload.role === "student" ||
    payload.userType === "student" ||
    payload.type === "student"
  );
}

function getPayloadSessionType(payload: JwtPayload): SessionType | null {
  const raw = payload.sessionType ?? payload.session;
  if (typeof raw !== "string") return null;

  const value = raw.trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "student") return "student";
  if (value === "student-dashboard" || value === "dashboard") return "student-dashboard";
  if (value === "legacy") return "legacy";
  return null;
}

function getCookie(request: NextRequest, name: string): string | null {
  const value = request.cookies.get(name)?.value;
  return value && value.length <= MAX_TOKEN_LENGTH ? value : null;
}

function cookieForSession(type: SessionType): string {
  switch (type) {
    case "admin":
      return ADMIN_COOKIE;
    case "student":
      return STUDENT_COOKIE;
    case "student-dashboard":
      return DASHBOARD_COOKIE;
    case "legacy":
    default:
      return LEGACY_COOKIE;
  }
}

async function verifyCookieSession(
  request: NextRequest,
  sessionType: SessionType,
): Promise<VerifiedSession | null> {
  const cookieName = cookieForSession(sessionType);
  const token = getCookie(request, cookieName);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const payloadType = getPayloadSessionType(payload);

  if (sessionType === "admin") {
    if (!isAdminPayload(payload)) return null;
    if (payloadType !== null && payloadType !== "admin") return null;
  }

  if (sessionType === "student") {
    if (!isStudentPayload(payload) || isAdminPayload(payload)) return null;
    if (payloadType !== null && payloadType !== "student") return null;
  }

  if (sessionType === "student-dashboard") {
    if (!isStudentPayload(payload) || isAdminPayload(payload)) return null;
    if (payloadType !== "student-dashboard") return null;
  }

  if (sessionType === "legacy") {
    // Legacy tokens may omit sessionType. Their role/type is checked by route.
    if (payloadType !== null && payloadType !== "legacy" && !isAdminPayload(payload) && !isStudentPayload(payload)) {
      return null;
    }
  }

  return { payload, sessionType, cookieName };
}

async function getVerifiedSession(
  request: NextRequest,
  preferredTypes: readonly SessionType[],
): Promise<VerifiedSession | null> {
  for (const sessionType of preferredTypes) {
    const session = await verifyCookieSession(request, sessionType);
    if (session) return session;
  }
  return null;
}

function clearCookie(response: NextResponse, cookieName: string): void {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

function clearAllAuthCookies(response: NextResponse): void {
  clearCookie(response, ADMIN_COOKIE);
  clearCookie(response, STUDENT_COOKIE);
  clearCookie(response, DASHBOARD_COOKIE);
  clearCookie(response, LEGACY_COOKIE);
}

function isAdminPage(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminApi(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

function isStudentDashboardPage(pathname: string): boolean {
  return pathname === "/student/dashboard" || pathname.startsWith("/student/dashboard/");
}

function isStudentDashboardApi(pathname: string): boolean {
  return pathname === "/api/student/dashboard" || pathname.startsWith("/api/student/dashboard/");
}

function isStudentPage(pathname: string): boolean {
  return pathname === "/student" || pathname.startsWith("/student/");
}

function isStudentApi(pathname: string): boolean {
  return pathname === "/api/student" || pathname.startsWith("/api/student/");
}

function isPublicAuthApi(pathname: string): boolean {
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
}

function isPublicAdminSetup(pathname: string): boolean {
  return pathname === "/admin/setup" || pathname.startsWith("/admin/setup/");
}

function isPublicPage(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/apply" ||
    pathname.startsWith("/apply/") ||
    pathname === "/internships" ||
    pathname.startsWith("/internships/") ||
    pathname === "/contact" ||
    pathname.startsWith("/contact/") ||
    pathname === "/certificate" ||
    pathname.startsWith("/certificate/") ||
    pathname === "/privacy-policy" ||
    pathname === "/terms-and-conditions"
  );
}

function apiError(id: string, status: 401 | 403, clearCookies: boolean): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      message: status === 401 ? "Authentication required." : "You are not authorized to access this resource.",
      code: status === 401 ? "AUTHENTICATION_REQUIRED" : "FORBIDDEN",
    },
    { status, headers: { "Content-Type": "application/json" } },
  );

  applySecurityHeaders(response, id);
  if (clearCookies) clearAllAuthCookies(response);
  return response;
}

function redirectToLogin(request: NextRequest, clearCookies: boolean): NextResponse {
  const loginUrl = new URL(LOGIN_PATH, request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
    loginUrl.searchParams.set("next", nextPath);
  }

  const response = NextResponse.redirect(loginUrl);
  applySecurityHeaders(response);
  if (clearCookies) clearAllAuthCookies(response);
  return response;
}

function protectedResponse(id: string): NextResponse {
  return applySecurityHeaders(NextResponse.next(), id);
}

async function authorizeAdmin(request: NextRequest, id: string): Promise<NextResponse> {
  const session = await getVerifiedSession(request, ["admin", "legacy"]);

  if (!session) {
    return isAdminApi(request.nextUrl.pathname)
      ? apiError(id, 401, true)
      : redirectToLogin(request, true);
  }

  if (!isAdminPayload(session.payload)) {
    return isAdminApi(request.nextUrl.pathname)
      ? apiError(id, 403, true)
      : redirectToLogin(request, true);
  }

  return protectedResponse(id);
}

async function authorizeStudent(
  request: NextRequest,
  id: string,
  dashboardOnly: boolean,
): Promise<NextResponse> {
  const types: readonly SessionType[] = dashboardOnly
    ? ["student-dashboard"]
    : ["student", "legacy"];

  const session = await getVerifiedSession(request, types);

  if (!session) {
    return isStudentApi(request.nextUrl.pathname)
      ? apiError(id, 401, true)
      : redirectToLogin(request, true);
  }

  if (!isStudentPayload(session.payload) || isAdminPayload(session.payload)) {
    return isStudentApi(request.nextUrl.pathname)
      ? apiError(id, 403, true)
      : redirectToLogin(request, true);
  }

  if (dashboardOnly && session.sessionType !== "student-dashboard") {
    return isStudentApi(request.nextUrl.pathname)
      ? apiError(id, 403, true)
      : redirectToLogin(request, true);
  }

  return protectedResponse(id);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const id = getRequestId(request);

  if (isPublicAuthApi(pathname) || isPublicAdminSetup(pathname)) {
    return applySecurityHeaders(NextResponse.next(), id);
  }

  if (isAdminApi(pathname) || isAdminPage(pathname)) {
    return authorizeAdmin(request, id);
  }

  if (isStudentDashboardApi(pathname) || isStudentDashboardPage(pathname)) {
    return authorizeStudent(request, id, true);
  }

  if (isStudentApi(pathname) || isStudentPage(pathname)) {
    return authorizeStudent(request, id, false);
  }

  if (isPublicPage(pathname)) {
    return applySecurityHeaders(NextResponse.next(), id);
  }

  return applySecurityHeaders(NextResponse.next(), id);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf|eot)$).*)",
  ],
};
