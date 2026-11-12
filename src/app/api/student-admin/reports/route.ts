import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { connectStudentDB } from "@/lib/student-db";
import {
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAuthToken,
} from "@/lib/auth";
import Payment from "@/models/Payment";
import { getStudentOperationsModel } from "@/models/StudentOperations";
import getCertificateModel from "@/models/Certificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_RANGE_DAYS = 365;
const MAX_SEARCH_LENGTH = 120;

type PlainRecord = Record<string, unknown>;
type AdminIdentity = {
  id: string;
  identifier: string;
  role: "Student Operations Admin";
};

class ReportError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ReportError";
    this.status = status;
    this.code = code;
  }
}

function clean(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function requestIdFor(request: NextRequest): string {
  const supplied = clean(request.headers.get("x-request-id"), 100);
  return /^[a-zA-Z0-9._:-]{8,100}$/.test(supplied) ? supplied : randomUUID();
}

function secure(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Vary", "Cookie, Authorization");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Request-Id", requestId);
  return response;
}

function json(requestId: string, body: unknown, status = 200): NextResponse {
  return secure(NextResponse.json(body, { status }), requestId);
}

function fail(requestId: string, status: number, code: string, message: string): NextResponse {
  return json(requestId, { success: false, code, message, requestId }, status);
}

async function authenticate(request: NextRequest): Promise<AdminIdentity> {
  const token = clean(request.cookies.get(STUDENT_ADMIN_AUTH_COOKIE_NAME)?.value, 8192);
  if (!token) throw new ReportError("Student Operations Admin login is required.", 401, "UNAUTHORIZED");

  let payload: unknown;
  try {
    payload = await verifyAuthToken(token);
  } catch {
    throw new ReportError("Your Student Operations session is invalid or expired.", 401, "INVALID_SESSION");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ReportError("Your Student Operations session is invalid.", 401, "INVALID_SESSION");
  }

  const claims = payload as PlainRecord;
  if (
    clean(claims.role, 30) !== "admin" ||
    clean(claims.adminRole, 100) !== "Student Operations Admin" ||
    clean(claims.sessionType, 80) !== "student-admin"
  ) {
    throw new ReportError("Only an authenticated Student Operations Admin can access reports.", 403, "FORBIDDEN");
  }

  const id = clean(claims.id, 150);
  if (!id) throw new ReportError("Administrator identity is invalid.", 401, "INVALID_ADMIN_ID");

  return {
    id,
    identifier: clean(claims.identifier, 254),
    role: "Student Operations Admin",
  };
}

function parseRange(value: string | null): number {
  if (!value) return 30;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_RANGE_DAYS) {
    throw new ReportError(`Range must be between 1 and ${MAX_RANGE_DAYS} days.`, 400, "INVALID_RANGE");
  }
  return parsed;
}

function safeCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function safeAmount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadReport(rangeDays: number, search: string) {
  const [Operations, Certificate, studentConnection] = await Promise.all([
    getStudentOperationsModel(),
    getCertificateModel(),
    connectStudentDB(),
    connectDB(),
  ]).then(([operations, certificate, connection]) => [operations, certificate, connection] as const);

  if (studentConnection.readyState !== 1 || !studentConnection.db) {
    throw new Error("Student Operations database connection is not ready.");
  }

  const now = new Date();
  const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const searchFilter: PlainRecord = search
    ? {
        $or: [
          { fullName: new RegExp(escapeRegex(search), "i") },
          { email: new RegExp(escapeRegex(search), "i") },
          { studentId: new RegExp(escapeRegex(search), "i") },
          { dashboardStudentId: new RegExp(escapeRegex(search), "i") },
          { applicationId: new RegExp(escapeRegex(search), "i") },
        ],
      }
    : {};

  const studentCollection = Operations.collection;
  const certificateCollection = Certificate.collection;
  const codingCollection = studentConnection.collection("codingquestions");
  const paymentFilter: PlainRecord = { archivedAt: null };

  const [
    totalStudents,
    newStudents,
    activeStudents,
    approvedStudents,
    pendingApprovals,
    completedInternships,
    studentsByTrack,
    studentTrend,
    totalPayments,
    successfulPayments,
    pendingPayments,
    failedPayments,
    refundedPayments,
    revenueResult,
    monthlyRevenue,
    totalCertificates,
    issuedCertificates,
    pendingCertificates,
    revokedCertificates,
    expiredCertificates,
    codingTotal,
    codingPublished,
    codingDraft,
    codingArchived,
    codingByDifficulty,
  ] = await Promise.all([
    studentCollection.countDocuments(searchFilter),
    studentCollection.countDocuments({ ...searchFilter, createdAt: { $gte: rangeStart, $lte: now } }),
    studentCollection.countDocuments({ ...searchFilter, dashboardStatus: "active", dashboardLoginEnabled: true }),
    studentCollection.countDocuments({ ...searchFilter, operationsApprovalStatus: "approved" }),
    studentCollection.countDocuments({ ...searchFilter, operationsApprovalStatus: { $in: ["pending", "pending-review"] } }),
    studentCollection.countDocuments({ ...searchFilter, operationsStatus: "completed" }),
    studentCollection.aggregate([
      { $match: searchFilter },
      { $group: { _id: { $ifNull: ["$internshipTrack", "Unassigned"] }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]).toArray(),
    studentCollection.aggregate([
      { $match: { ...searchFilter, createdAt: { $gte: rangeStart, $lte: now } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    Payment.countDocuments(paymentFilter).exec(),
    Payment.countDocuments({ ...paymentFilter, status: "success" }).exec(),
    Payment.countDocuments({ ...paymentFilter, status: "pending" }).exec(),
    Payment.countDocuments({ ...paymentFilter, status: "failed" }).exec(),
    Payment.countDocuments({ ...paymentFilter, status: "refunded" }).exec(),
    Payment.aggregate([
      { $match: { ...paymentFilter, status: "success" } },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]).exec(),
    Payment.aggregate([
      { $match: { ...paymentFilter, status: "success", createdAt: { $gte: rangeStart, $lte: now } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).exec(),
    certificateCollection.countDocuments({}),
    certificateCollection.countDocuments({ status: "issued" }),
    certificateCollection.countDocuments({ status: "pending" }),
    certificateCollection.countDocuments({ status: "revoked" }),
    certificateCollection.countDocuments({ status: "expired" }),
    codingCollection.countDocuments({}),
    codingCollection.countDocuments({ status: "published" }),
    codingCollection.countDocuments({ status: "draft" }),
    codingCollection.countDocuments({ status: "archived" }),
    codingCollection.aggregate([
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
  ]);

  const studentStatsByCertificate = await studentCollection.aggregate([
    { $match: searchFilter },
    { $group: { _id: "$certificateStatus", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  const paymentRevenue = safeAmount(revenueResult[0]?.revenue);
  const codingDifficulty = Object.fromEntries(
    codingByDifficulty.map((item: PlainRecord) => [clean(item._id, 30) || "unknown", safeCount(item.count)]),
  );

  return {
    overview: {
      totalStudents: safeCount(totalStudents),
      newStudentsInRange: safeCount(newStudents),
      activeStudents: safeCount(activeStudents),
      approvedStudents: safeCount(approvedStudents),
      pendingApprovals: safeCount(pendingApprovals),
      completedInternships: safeCount(completedInternships),
    },
    payments: {
      total: safeCount(totalPayments),
      successful: safeCount(successfulPayments),
      pending: safeCount(pendingPayments),
      failed: safeCount(failedPayments),
      refunded: safeCount(refundedPayments),
      revenue: paymentRevenue,
      currency: "INR",
      revenueInRange: monthlyRevenue.reduce((sum: number, item: PlainRecord) => sum + safeAmount(item.revenue), 0),
      monthlyRevenue: monthlyRevenue.map((item: PlainRecord) => ({ month: clean(item._id, 7), revenue: safeAmount(item.revenue), payments: safeCount(item.count) })),
    },
    certificates: {
      total: safeCount(totalCertificates),
      issued: safeCount(issuedCertificates),
      pending: safeCount(pendingCertificates),
      revoked: safeCount(revokedCertificates),
      expired: safeCount(expiredCertificates),
      studentStatusBreakdown: studentStatsByCertificate.map((item: PlainRecord) => ({ status: clean(item._id, 40) || "not-set", count: safeCount(item.count) })),
    },
    coding: {
      totalQuestions: safeCount(codingTotal),
      publishedQuestions: safeCount(codingPublished),
      draftQuestions: safeCount(codingDraft),
      archivedQuestions: safeCount(codingArchived),
      byDifficulty: codingDifficulty,
      submissions: null,
      submissionStatsAvailable: false,
    },
    tasks: {
      available: false,
      totalTasks: null,
      publishedTasks: null,
      pendingReviews: null,
      approvedSubmissions: null,
      totalSubmissions: null,
      message: "Task and submission collections are not configured. Task statistics are intentionally omitted until their actual models are available.",
    },
    charts: {
      studentRegistrations: studentTrend.map((item: PlainRecord) => ({ date: clean(item._id, 10), count: safeCount(item.count) })),
      trackDistribution: studentsByTrack.map((item: PlainRecord) => ({ track: clean(item._id, 120) || "Unassigned", count: safeCount(item.count) })),
    },
    range: { days: rangeDays, from: rangeStart.toISOString(), to: now.toISOString() },
    generatedAt: now.toISOString(),
    sources: {
      students: "student_operations",
      payments: "main_careers",
      certificates: "student_operations",
      codingQuestions: "student_operations.codingquestions",
      tasks: "not_configured",
      codingSubmissions: "not_configured",
    },
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  try {
    const admin = await authenticate(request);
    const params = request.nextUrl.searchParams;
    const rangeDays = parseRange(params.get("range"));
    const search = clean(params.get("search"), MAX_SEARCH_LENGTH);
    const report = await loadReport(rangeDays, search);

    return json(requestId, {
      success: true,
      message: "Student Operations reports loaded successfully.",
      data: report,
      viewer: admin,
      requestId,
    });
  } catch (error) {
    if (error instanceof ReportError) {
      return fail(requestId, error.status, error.code, error.message);
    }

    console.error("[STUDENT_ADMIN_REPORTS_GET]", {
      requestId,
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return fail(requestId, 500, "REPORTS_LOAD_FAILED", "Unable to load Student Operations reports.");
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  const response = new NextResponse(null, {
    status: 204,
    headers: { Allow: "GET, OPTIONS" },
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return fail(requestIdFor(request), 405, "METHOD_NOT_ALLOWED", "Reports are read-only.");
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return fail(requestIdFor(request), 405, "METHOD_NOT_ALLOWED", "Reports are read-only.");
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return fail(requestIdFor(request), 405, "METHOD_NOT_ALLOWED", "Reports are read-only.");
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return fail(requestIdFor(request), 405, "METHOD_NOT_ALLOWED", "Reports are read-only.");
}
