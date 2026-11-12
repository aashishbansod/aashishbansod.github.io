import "server-only";

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import StudentModel from "@/models/Student";
import AdminModel from "@/models/Admin";
import { getStudentAdminModel } from "@/models/StudentAdmin";
import connectDB from "@/lib/db";
import {
  verifyAccessToken,
  AUTH_COOKIE_NAME,
  ADMIN_AUTH_COOKIE_NAME,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_NAME,
  STUDENT_DASHBOARD_AUTH_COOKIE_NAME,
  type AuthPayload,
  type AuthSessionType,
  type AdminRole,
} from "@/lib/auth";
import { canAccessStudentDashboard } from "@/services/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  Vary: "Cookie",
} as const;

const VALID_ADMIN_ROLES: readonly AdminRole[] = [
  "Super Admin",
  "Admin",
  "HR",
  "Assessment Manager",
  "Support",
  "Student Operations Admin",
];

type RecordValue = Record<string, unknown>;
type Portal = "admin" | "student-admin" | "student" | "student-dashboard";

function asRecord(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return textValue(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function idValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return String(value);
  } catch {
    return "";
  }
}

function validAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && VALID_ADMIN_ROLES.includes(value as AdminRole);
}

function isExpired(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
}

function portalForSession(sessionType: AuthSessionType): Portal | null {
  switch (sessionType) {
    case "admin":
      return "admin";
    case "student-admin":
      return "student-admin";
    case "student":
      return "student";
    case "student-dashboard":
      return "student-dashboard";
    case "legacy":
      return "admin";
    default:
      return null;
  }
}

function expectedCookieNames(sessionType: AuthSessionType): string[] {
  switch (sessionType) {
    case "admin":
      return [ADMIN_AUTH_COOKIE_NAME, AUTH_COOKIE_NAME];
    case "student-admin":
      return [STUDENT_ADMIN_AUTH_COOKIE_NAME];
    case "student":
      return [STUDENT_AUTH_COOKIE_NAME, AUTH_COOKIE_NAME];
    case "student-dashboard":
      return [STUDENT_DASHBOARD_AUTH_COOKIE_NAME, AUTH_COOKIE_NAME];
    case "legacy":
      return [AUTH_COOKIE_NAME];
    default:
      return [];
  }
}

function requestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
}

function respond(
  body: RecordValue,
  status: number,
  id: string,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...SECURITY_HEADERS, "X-Request-ID": id },
  });
}

function unauthorized(id: string): NextResponse {
  return respond(
    { success: false, authenticated: false, message: "Authentication required.", code: "UNAUTHENTICATED", requestId: id },
    401,
    id,
  );
}

function sanitizeAdmin(record: RecordValue, sessionType: AuthSessionType): RecordValue {
  const adminId = textValue(record.adminId).toUpperCase();
  const email = textValue(record.email).toLowerCase();
  const role = textValue(record.role);
  return {
    id: idValue(record._id),
    userType: "admin",
    identifier: adminId || textValue(record.username).toLowerCase() || email,
    fullName: (textValue(record.fullName) || textValue(record.name) || "CyberNet Admin").slice(0, 120),
    email,
    ...(adminId ? { adminId } : {}),
    role,
    phone: textValue(record.phone),
    isEmailVerified: record.isEmailVerified === true,
    authenticationMode: sessionType === "student-admin" ? "student-admin" : "admin",
    sessionType,
  };
}

function sanitizeStudent(record: RecordValue, sessionType: AuthSessionType): RecordValue {
  const studentId = textValue(record.studentId).toUpperCase();
  const dashboardStudentId = textValue(record.dashboardStudentId).toUpperCase();
  const email = textValue(record.email).toLowerCase();
  const dashboard = sessionType === "student-dashboard";
  return {
    id: idValue(record._id),
    userType: "student",
    identifier: dashboard ? dashboardStudentId || email : studentId || email,
    fullName: (textValue(record.fullName) || textValue(record.name) || "Student").slice(0, 120),
    email,
    ...(studentId ? { studentId } : {}),
    ...(dashboardStudentId ? { dashboardStudentId } : {}),
    phone: textValue(record.phone),
    isEmailVerified: record.emailVerified === true,
    authenticationMode: dashboard ? "student-dashboard" : "student",
    sessionType,
    applicationStatus: textValue(record.applicationStatus),
    assessmentStatus: textValue(record.assessmentStatus),
    resultStatus: textValue(record.resultStatus),
    internshipStatus: textValue(record.internshipStatus),
    paymentStatus: textValue(record.paymentStatus),
    adminApprovalStatus: textValue(record.adminApprovalStatus),
    studentOpsApprovalStatus: textValue(record.studentOpsApprovalStatus),
    studentOpsStatus: textValue(record.studentOpsStatus),
    dashboardStatus: textValue(record.dashboardStatus),
    loginEnabled: record.loginEnabled === true,
    credentialsGenerated: record.credentialsGenerated === true,
    dashboardLoginEnabled: record.dashboardLoginEnabled === true,
    dashboardCredentialsGenerated: record.dashboardCredentialsGenerated === true,
  };
}

async function loadCurrentUser(payload: AuthPayload): Promise<RecordValue | null> {
  await connectDB();

  if (payload.role === "student") {
    const student = await StudentModel.findById(payload.sub).lean().exec();
    if (!student) return null;
    const record = asRecord(student);
    if (record.isActive === false) return null;

    if (payload.sessionType === "student") {
      if (record.loginEnabled !== true || record.credentialsGenerated !== true) return null;
      if (isExpired(record.credentialsExpiresAt)) return null;
      return sanitizeStudent(record, "student");
    }

    if (payload.sessionType === "student-dashboard") {
      if (record.dashboardLoginEnabled !== true || record.dashboardCredentialsGenerated !== true) return null;
      const access = await canAccessStudentDashboard(textValue(record.studentId));
      if (!access.allowed) return null;
      if (isExpired(record.dashboardCredentialsExpiresAt)) return null;
      return sanitizeStudent(record, "student-dashboard");
    }
    return null;
  }

  if (payload.role !== "admin") return null;

  if (payload.sessionType === "student-admin") {
    const model = await getStudentAdminModel();
    const admin = await model.findById(payload.sub).lean().exec();
    if (!admin) return null;
    const record = asRecord(admin);
    if (
      record.isActive !== true ||
      record.isEmailVerified !== true ||
      record.registrationStatus !== "active" ||
      record.role !== "Student Operations Admin" ||
      payload.adminRole !== "Student Operations Admin"
    ) {
      return null;
    }
    const permissionsRecord = asRecord(record.permissions);
    const permissions: Record<string, boolean> = {};
    for (const key of ["dashboard", "students", "applications", "internships", "payments", "certificates", "reports", "settings"]) {
      if (typeof permissionsRecord[key] === "boolean") permissions[key] = permissionsRecord[key] as boolean;
    }
    return { ...sanitizeAdmin(record, "student-admin"), role: "Student Operations Admin", permissions };
  }

  if (payload.sessionType === "admin" || payload.sessionType === "legacy") {
    const admin = await AdminModel.findById(payload.sub).lean().exec();
    if (!admin) return null;
    const record = asRecord(admin);
    if (record.isActive === false || !validAdminRole(record.role)) return null;
    if (record.role !== payload.adminRole) return null;
    if (record.role === "Student Operations Admin") return null;
    return sanitizeAdmin(record, payload.sessionType);
  }

  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const id = requestId(request);

  try {
    const cookieEntries = [
      [ADMIN_AUTH_COOKIE_NAME, "admin"],
      [STUDENT_ADMIN_AUTH_COOKIE_NAME, "student-admin"],
      [STUDENT_DASHBOARD_AUTH_COOKIE_NAME, "student-dashboard"],
      [STUDENT_AUTH_COOKIE_NAME, "student"],
      [AUTH_COOKIE_NAME, "legacy"],
    ] as const;

    let payload: AuthPayload | null = null;
    let matchedSessionType: AuthSessionType | null = null;

    for (const [cookieName, cookieSession] of cookieEntries) {
      const token = request.cookies.get(cookieName)?.value;
      if (!token) continue;
      const verified = verifyAccessToken(token);
      if (!verified) continue;
      const allowedNames = expectedCookieNames(verified.sessionType);
      if (!allowedNames.includes(cookieName)) continue;
      if (cookieSession === "legacy" && verified.sessionType !== "legacy" && !allowedNames.includes(AUTH_COOKIE_NAME)) continue;
      payload = verified;
      matchedSessionType = verified.sessionType;
      break;
    }

    if (!payload || !matchedSessionType || !portalForSession(matchedSessionType)) {
      return unauthorized(id);
    }

    const user = await loadCurrentUser(payload);
    if (!user) return unauthorized(id);

    return respond(
      {
        success: true,
        authenticated: true,
        user,
        portal: portalForSession(matchedSessionType),
        sessionType: matchedSessionType,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        requestId: id,
      },
      200,
      id,
    );
  } catch (error) {
    const details = asRecord(error);
    console.error("[CyberNet Careers] Session verification failed.", {
      requestId: id,
      errorName: textValue(details.name).slice(0, 80) || "UnknownError",
      errorCode: textValue(details.code).slice(0, 40) || undefined,
    });
    return respond(
      { success: false, authenticated: false, message: "Unable to verify the current session.", code: "SESSION_VERIFICATION_FAILED", requestId: id },
      500,
      id,
    );
  }
}

function methodNotAllowed(request: NextRequest): NextResponse {
  const id = requestId(request);
  const response = respond(
    { success: false, authenticated: false, message: "Method not allowed.", code: "METHOD_NOT_ALLOWED", requestId: id },
    405,
    id,
  );
  response.headers.set("Allow", "GET, HEAD, OPTIONS");
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
  const id = requestId(request);
  return new NextResponse(null, {
    status: 204,
    headers: { ...SECURITY_HEADERS, "X-Request-ID": id, Allow: "GET, HEAD, OPTIONS" },
  });
}
