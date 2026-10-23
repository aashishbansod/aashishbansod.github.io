import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import AdminModel from "@/models/Admin";
import connectDB from "@/lib/db";
import { AUTH_COOKIE_NAME, verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_VERSION = "9.0.0";
const REFRESH_INTERVAL_MS = 30_000;
const RECENT_ACTIVITY_MS = 5 * 60 * 1000;
const EXPIRY_WARNING_MS = 3 * 24 * 60 * 60 * 1000;

type PlainRecord = Record<string, unknown>;

type AuthPayload = {
  userId?: string;
  sub?: string;
  role?: string;
  adminRole?: string;
  sessionType?: string;
};

type AdminDto = {
  id: string;
  adminId: string;
  fullName: string;
  email: string;
  role: string;
  designation: string;
  department: string;
};

type DatabaseUsage = {
  connected: boolean;
  databaseName: string;
  dataSizeBytes: number;
  storageSizeBytes: number;
  indexSizeBytes: number;
  totalSizeBytes: number;
  collections: number;
  objects: number;
  refreshedAt: string;
};

type DashboardStats = {
  students: number;
  applications: number;
  assessments: number;
  internships: number;
  pendingApplications: number;
  assessmentPending: number;
  payments: number;
  paymentPending: number;
  paymentPaid: number;
  paymentFailed: number;
  paymentApprovalPending: number;
  activeStudents: number;
  expiredStudents: number;
  recentlyActiveStudents: number;
  expiringWithin3Days: number;
  certificates: number;
  revenue: number;
  activeInternships: number;
  approvedApplications: number;
  rejectedApplications: number;
  passedAssessments: number;
  failedAssessments: number;
};

const EMPTY_STATS: DashboardStats = {
  students: 0,
  applications: 0,
  assessments: 0,
  internships: 0,
  pendingApplications: 0,
  assessmentPending: 0,
  payments: 0,
  paymentPending: 0,
  paymentPaid: 0,
  paymentFailed: 0,
  paymentApprovalPending: 0,
  activeStudents: 0,
  expiredStudents: 0,
  recentlyActiveStudents: 0,
  expiringWithin3Days: 0,
  certificates: 0,
  revenue: 0,
  activeInternships: 0,
  approvedApplications: 0,
  rejectedApplications: 0,
  passedAssessments: 0,
  failedAssessments: 0,
};

function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      Vary: "Cookie",
    },
  });
}

function fail(message: string, status: number, code: string): NextResponse {
  return jsonResponse({ success: false, message, code }, status);
}

function recordOf(value: unknown): PlainRecord {
  return value !== null && typeof value === "object" ? value as PlainRecord : {};
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOf(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalize(value: unknown): string {
  return textOf(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function idString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value) {
    const output = String(value);
    return output === "[object Object]" ? "" : output;
  }
  return "";
}

function isAbortOrDisconnect(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("not authorized") ||
    message.includes("unauthorized") ||
    message.includes("command not found") ||
    message.includes("not supported");
}

function isOneOf(field: string, values: string[]): PlainRecord {
  return { [field]: { $in: values } };
}

async function authenticateAdmin(request: NextRequest): Promise<AuthPayload | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token) as AuthPayload | null;
    if (!payload || payload.role !== "admin") return null;

    const userId = textOf(payload.userId) || textOf(payload.sub);
    if (!userId || (payload.userId && payload.sub && payload.userId !== payload.sub)) return null;

    // Dashboard is a main-admin surface. Reject tokens explicitly scoped to another session.
    if (payload.sessionType && !["admin", "legacy"].includes(payload.sessionType)) return null;

    return { ...payload, userId };
  } catch {
    return null;
  }
}

async function loadAdmin(userId: string): Promise<AdminDto | null> {
  if (!mongoose.isValidObjectId(userId)) return null;

  const admin = await AdminModel.findById(userId)
    .select("_id adminId fullName email role designation department isActive status")
    .lean()
    .exec();

  if (!admin) return null;
  const row = recordOf(admin);

  if (row.isActive === false || normalize(row.status) === "inactive" || normalize(row.status) === "disabled") {
    return null;
  }

  return {
    id: idString(row._id),
    adminId: textOf(row.adminId),
    fullName: textOf(row.fullName) || "CyberNet Admin",
    email: textOf(row.email),
    role: textOf(row.role) || "Administrator",
    designation: textOf(row.designation),
    department: textOf(row.department),
  };
}

function getDatabase() {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB connection is not ready.");
  }
  return db;
}

async function getApplicationStats() {
  const collection = getDatabase().collection<PlainRecord>("applications");
  const [total, pending, review, approved, rejected] = await Promise.all([
    collection.countDocuments({}, { maxTimeMS: 8_000 }),
    collection.countDocuments({ status: { $in: ["pending", "Pending", "PENDING"] } }, { maxTimeMS: 8_000 }),
    collection.countDocuments({ status: { $in: ["under_review", "under-review", "Under Review", "review"] } }, { maxTimeMS: 8_000 }),
    collection.countDocuments({ status: { $in: ["approved", "Approved", "APPROVED"] } }, { maxTimeMS: 8_000 }),
    collection.countDocuments({ status: { $in: ["rejected", "Rejected", "REJECTED"] } }, { maxTimeMS: 8_000 }),
  ]);
  return { total, pending: pending + review, approved, rejected };
}

async function getAssessmentStats() {
  const db = getDatabase();
  const [total, studentPending, studentActive, studentPassed, studentFailed, appPending, appActive, appPassed, appFailed] = await Promise.all([
    db.collection<PlainRecord>("assessments").countDocuments({}, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("students").countDocuments({ assessmentStatus: { $in: ["not-started", "not_started", "scheduled", "submitted", "evaluated"] } }, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("students").countDocuments({ assessmentStatus: { $in: ["in-progress", "in_progress", "active"] } }, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("students").countDocuments({ assessmentStatus: { $in: ["passed", "Pass", "PASSED"] } }, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("students").countDocuments({ assessmentStatus: { $in: ["failed", "Fail", "FAILED"] } }, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("applications").countDocuments({ assessmentStatus: { $in: ["not-started", "not_started", "pending"] } }, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("applications").countDocuments({ assessmentStatus: { $in: ["active", "in-progress", "in_progress"] } }, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("applications").countDocuments({ assessmentStatus: { $in: ["passed", "Pass", "PASSED"] } }, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("applications").countDocuments({ assessmentStatus: { $in: ["failed", "Fail", "FAILED"] } }, { maxTimeMS: 8_000 }),
  ]);

  const passed = Math.max(studentPassed, appPassed);
  const failed = Math.max(studentFailed, appFailed);
  return {
    total,
    pending: studentPending + appPending,
    active: Math.max(studentActive, appActive),
    passed,
    failed,
  };
}

async function getInternshipStats() {
  const db = getDatabase();
  const [total, active] = await Promise.all([
    db.collection<PlainRecord>("internships").countDocuments({}, { maxTimeMS: 8_000 }),
    db.collection<PlainRecord>("internships").countDocuments({ status: { $in: ["active", "Active", "published", "Published"] } }, { maxTimeMS: 8_000 }),
  ]);
  return { total, active };
}

async function getStudentStats(now: Date) {
  const students = getDatabase().collection<PlainRecord>("students");
  const recentSince = new Date(now.getTime() - RECENT_ACTIVITY_MS);
  const expiryEnd = new Date(now.getTime() + EXPIRY_WARNING_MS);

  const [total, active, expired, recentlyActive, expiring] = await Promise.all([
    students.countDocuments({}, { maxTimeMS: 8_000 }),
    students.countDocuments({
      dashboardStatus: { $in: ["active", "Active"] },
      journeyExpired: { $ne: true },
      $or: [{ journeyExpiresAt: { $exists: false } }, { journeyExpiresAt: null }, { journeyExpiresAt: { $gt: now } }],
    }, { maxTimeMS: 8_000 }),
    students.countDocuments({
      $or: [
        { journeyExpired: true },
        { journeyExpiresAt: { $type: "date", $lte: now } },
      ],
    }, { maxTimeMS: 8_000 }),
    students.countDocuments({
      loginEnabled: true,
      lastLoginAt: { $gte: recentSince },
    }, { maxTimeMS: 8_000 }),
    students.countDocuments({
      journeyExpired: { $ne: true },
      journeyExpiresAt: { $gt: now, $lte: expiryEnd },
    }, { maxTimeMS: 8_000 }),
  ]);

  return { total, active, expired, recentlyActive, expiring };
}

async function getPaymentStats() {
  const db = getDatabase();
  const payments = db.collection<PlainRecord>("payments");
  const paymentCollectionCount = await payments.estimatedDocumentCount().catch(() => 0);

  if (paymentCollectionCount > 0) {
    const [total, pending, paid, failed, approvalPending, revenueResult] = await Promise.all([
      payments.countDocuments({}, { maxTimeMS: 8_000 }),
      payments.countDocuments({ status: { $in: ["pending", "created", "Pending", "PENDING"] } }, { maxTimeMS: 8_000 }),
      payments.countDocuments({ status: { $in: ["paid", "captured", "success", "successful", "Paid"] } }, { maxTimeMS: 8_000 }),
      payments.countDocuments({ status: { $in: ["failed", "cancelled", "canceled", "Failed"] } }, { maxTimeMS: 8_000 }),
      payments.countDocuments({
        status: { $in: ["paid", "captured", "success", "successful", "Paid"] },
        adminApprovalStatus: { $in: ["pending", "Pending"] },
      }, { maxTimeMS: 8_000 }),
      payments.aggregate<{ total: number }>([
        { $match: { status: { $in: ["paid", "captured", "success", "successful", "Paid"] } } },
        { $group: { _id: null, total: { $sum: { $convert: { input: { $ifNull: ["$amount", "$paymentAmount"] }, to: "double", onError: 0, onNull: 0 } } } } },
      ], { maxTimeMS: 8_000 }).toArray(),
    ]);
    return { total, pending, paid, failed, approvalPending, revenue: numberOf(revenueResult[0]?.total) };
  }

  // Legacy fallback: older installations stored payment state on student documents.
  const students = db.collection<PlainRecord>("students");
  const [pending, paid, failed, approvalPending, revenueResult] = await Promise.all([
    students.countDocuments({ paymentStatus: { $in: ["pending", "Pending"] } }, { maxTimeMS: 8_000 }),
    students.countDocuments({ paymentStatus: { $in: ["paid", "Paid"] } }, { maxTimeMS: 8_000 }),
    students.countDocuments({ paymentStatus: { $in: ["failed", "Failed"] } }, { maxTimeMS: 8_000 }),
    students.countDocuments({ paymentStatus: { $in: ["paid", "Paid"] }, adminApprovalStatus: { $in: ["pending", "Pending"] } }, { maxTimeMS: 8_000 }),
    students.aggregate<{ total: number }>([
      { $match: { paymentStatus: { $in: ["paid", "Paid"] } } },
      { $group: { _id: null, total: { $sum: { $convert: { input: "$paymentAmount", to: "double", onError: 0, onNull: 0 } } } } },
    ], { maxTimeMS: 8_000 }).toArray(),
  ]);
  return { total: pending + paid + failed, pending, paid, failed, approvalPending, revenue: numberOf(revenueResult[0]?.total) };
}

async function getCertificateCount() {
  const db = getDatabase();
  const certificates = db.collection<PlainRecord>("certificates");
  const count = await certificates.estimatedDocumentCount().catch(() => 0);
  if (count > 0) return certificates.countDocuments({}, { maxTimeMS: 8_000 });
  return db.collection<PlainRecord>("students").countDocuments({
    certificateStatus: { $in: ["generated", "verified", "issued", "Generated", "Verified"] },
  }, { maxTimeMS: 8_000 });
}

async function getDatabaseUsage(): Promise<DatabaseUsage> {
  const refreshedAt = new Date().toISOString();
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    return {
      connected: false, databaseName: "", dataSizeBytes: 0, storageSizeBytes: 0,
      indexSizeBytes: 0, totalSizeBytes: 0, collections: 0, objects: 0, refreshedAt,
    };
  }

  try {
    const stats = await db.command({ dbStats: 1, scale: 1 });
    const dataSizeBytes = numberOf(stats.dataSize);
    const indexSizeBytes = numberOf(stats.indexSize);
    return {
      connected: true,
      databaseName: db.databaseName,
      dataSizeBytes,
      storageSizeBytes: numberOf(stats.storageSize),
      indexSizeBytes,
      totalSizeBytes: dataSizeBytes + indexSizeBytes,
      collections: numberOf(stats.collections),
      objects: numberOf(stats.objects),
      refreshedAt,
    };
  } catch (error) {
    console.warn("[ADMIN DASHBOARD] Database usage metrics unavailable.", error);
    return {
      connected: true,
      databaseName: db.databaseName,
      dataSizeBytes: 0, storageSizeBytes: 0, indexSizeBytes: 0,
      totalSizeBytes: 0, collections: 0, objects: 0, refreshedAt,
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await authenticateAdmin(request);
    if (!payload?.userId) {
      return fail("Admin authentication required.", 401, "UNAUTHORIZED");
    }

    await connectDB();

    const admin = await loadAdmin(payload.userId);
    if (!admin) {
      return fail("Admin account is unavailable or inactive.", 403, "ADMIN_FORBIDDEN");
    }

    // Confirm the shared Mongoose connection is available before running live queries.
    getDatabase();
    const now = new Date();

    const [
      applications,
      assessments,
      internships,
      payments,
      students,
      certificates,
      database,
    ] = await Promise.all([
      getApplicationStats(),
      getAssessmentStats(),
      getInternshipStats(),
      getPaymentStats(),
      getStudentStats(now),
      getCertificateCount(),
      getDatabaseUsage(),
    ]);

    const stats: DashboardStats = {
      ...EMPTY_STATS,
      students: students.total,
      applications: applications.total,
      assessments: assessments.total,
      internships: internships.total,
      pendingApplications: applications.pending,
      assessmentPending: assessments.pending + assessments.active,
      payments: payments.total,
      paymentPending: payments.pending,
      paymentPaid: payments.paid,
      paymentFailed: payments.failed,
      paymentApprovalPending: payments.approvalPending,
      activeStudents: students.active,
      expiredStudents: students.expired,
      recentlyActiveStudents: students.recentlyActive,
      expiringWithin3Days: students.expiring,
      certificates,
      revenue: payments.revenue,
      activeInternships: internships.active,
      approvedApplications: applications.approved,
      rejectedApplications: applications.rejected,
      passedAssessments: assessments.passed,
      failedAssessments: assessments.failed,
    };

    return jsonResponse({
      success: true,
      message: "Admin dashboard synchronized successfully.",
      admin,
      stats,
      database,
      meta: {
        generatedAt: now.toISOString(),
        authenticated: true,
        role: textOf(payload.role),
        version: API_VERSION,
        refreshIntervalMs: REFRESH_INTERVAL_MS,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/dashboard]", error);
    if (isAbortOrDisconnect(error)) {
      return fail("Dashboard database metrics are temporarily unavailable.", 503, "DATABASE_UNAVAILABLE");
    }
    return fail("Unable to load the admin dashboard right now.", 500, "INTERNAL_SERVER_ERROR");
  }
}

function methodNotAllowed(method: string): NextResponse {
  return jsonResponse(
    { success: false, message: `${method} method is not allowed.`, code: "METHOD_NOT_ALLOWED" },
    405,
  );
}

export async function POST() { return methodNotAllowed("POST"); }
export async function PUT() { return methodNotAllowed("PUT"); }
export async function PATCH() { return methodNotAllowed("PATCH"); }
export async function DELETE() { return methodNotAllowed("DELETE"); }

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
