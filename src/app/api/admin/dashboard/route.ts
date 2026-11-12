import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import type { Db, Document } from "mongodb";
import AdminModel from "@/models/Admin";
import connectDB from "@/lib/db";
import { AUTH_COOKIE_NAME, verifyAccessToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_VERSION = "11.0.0";
const REFRESH_INTERVAL_MS = 30_000;
const QUERY_TIMEOUT_MS = 8_000;
const RECENT_ACTIVITY_MS = 5 * 60 * 1000;
const EXPIRY_WARNING_MS = 3 * 24 * 60 * 60 * 1000;
const ALLOWED_ADMIN_ROLES = new Set(["super_admin", "admin", "hr"]);
const INACTIVE_STATUSES = new Set(["inactive", "disabled", "suspended", "blocked", "deleted"]);

const PAYMENT_PAID_STATUSES = ["paid", "captured", "success", "successful", "Paid", "CAPTURED"];
const PAYMENT_PENDING_STATUSES = ["pending", "created", "Pending", "PENDING"];
const PAYMENT_FAILED_STATUSES = ["failed", "cancelled", "canceled", "Failed", "FAILED"];

 type AuthPayload = {
  userId?: string;
  id?: string;
  sub?: string;
  role?: string;
  adminRole?: string;
  userType?: string;
  type?: string;
  sessionType?: string;
  authenticationMode?: string;
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

type PaymentStats = {
  total: number;
  pending: number;
  paid: number;
  failed: number;
  approvalPending: number;
  revenue: number;
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
      Vary: "Cookie, Authorization",
    },
  });
}

function fail(message: string, status: number, code: string): NextResponse {
  return jsonResponse({ success: false, message, code }, status);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
}

function numberOf(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; code?: number | string; message?: string };
  const name = textOf(candidate.name).toLowerCase();
  const message = textOf(candidate.message).toLowerCase();
  const code = String(candidate.code ?? "").toUpperCase();
  return (
    name.includes("mongo") ||
    name.includes("mongoose") ||
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ESERVFAIL"].includes(code) ||
    message.includes("mongo") ||
    message.includes("server selection") ||
    message.includes("connection") ||
    message.includes("timed out") ||
    message.includes("not authorized") ||
    message.includes("unauthorized") ||
    message.includes("command not found") ||
    message.includes("not supported")
  );
}

async function authenticateAdmin(request: NextRequest): Promise<AuthPayload | null> {
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value?.trim() || "";
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const token = cookieToken || bearerToken;

  if (!token) return null;

  try {
    const verified: unknown = await verifyAccessToken(token);
    if (!isRecord(verified)) return null;

    const payload = verified as AuthPayload;
    const userId = textOf(payload.userId ?? payload.id ?? payload.sub);
    const tokenRole = normalize(payload.role);
    const adminRole = normalize(payload.adminRole);
    const sessionType = normalize(payload.sessionType ?? payload.authenticationMode);
    const userType = normalize(payload.userType ?? payload.type);

    if (!userId || !mongoose.isValidObjectId(userId)) return null;
    if (["student", "student_dashboard"].includes(userType)) return null;
    if (sessionType && !["admin", "legacy"].includes(sessionType)) return null;
    if (tokenRole && tokenRole !== "admin" && !ALLOWED_ADMIN_ROLES.has(tokenRole)) return null;
    if (adminRole && !ALLOWED_ADMIN_ROLES.has(adminRole)) return null;
    if (!tokenRole && !adminRole && userType !== "admin" && sessionType !== "admin") return null;

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

  const row = admin as unknown as Record<string, unknown>;
  const role = normalize(row.role);
  const status = normalize(row.status);

  if (!ALLOWED_ADMIN_ROLES.has(role)) return null;
  if (row.isActive === false || INACTIVE_STATUSES.has(status)) return null;

  return {
    id: idString(row._id),
    adminId: textOf(row.adminId),
    fullName: textOf(row.fullName) || "CyberNet Admin",
    email: textOf(row.email).toLowerCase(),
    role: textOf(row.role),
    designation: textOf(row.designation),
    department: textOf(row.department),
  };
}

function getDatabase(): Db {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB connection is not ready.");
  }
  return db;
}

function queryOptions() {
  return { maxTimeMS: QUERY_TIMEOUT_MS };
}

async function getApplicationStats(db: Db) {
  const applications = db.collection<Document>("applications");
  const [total, pending, review, approved, rejected] = await Promise.all([
    applications.countDocuments({}, queryOptions()),
    applications.countDocuments({ status: { $in: ["pending", "Pending", "PENDING"] } }, queryOptions()),
    applications.countDocuments({ status: { $in: ["under_review", "under-review", "Under Review", "review"] } }, queryOptions()),
    applications.countDocuments({ status: { $in: ["approved", "Approved", "APPROVED"] } }, queryOptions()),
    applications.countDocuments({ status: { $in: ["rejected", "Rejected", "REJECTED"] } }, queryOptions()),
  ]);
  return { total, pending: pending + review, approved, rejected };
}

async function getAssessmentStats(db: Db) {
  const students = db.collection<Document>("students");
  const [total, pending, active, passed, failed] = await Promise.all([
    db.collection<Document>("assessments").countDocuments({}, queryOptions()),
    students.countDocuments({ assessmentStatus: { $in: ["not-started", "not_started", "scheduled", "submitted", "evaluated"] } }, queryOptions()),
    students.countDocuments({ assessmentStatus: { $in: ["in-progress", "in_progress", "active"] } }, queryOptions()),
    students.countDocuments({ assessmentStatus: { $in: ["passed", "Pass", "PASSED"] } }, queryOptions()),
    students.countDocuments({ assessmentStatus: { $in: ["failed", "Fail", "FAILED"] } }, queryOptions()),
  ]);
  return { total, pending, active, passed, failed };
}

async function getInternshipStats(db: Db) {
  const internships = db.collection<Document>("internships");
  const [total, active] = await Promise.all([
    internships.countDocuments({}, queryOptions()),
    internships.countDocuments({ status: { $in: ["active", "Active", "published", "Published"] } }, queryOptions()),
  ]);
  return { total, active };
}

async function getStudentStats(db: Db, now: Date) {
  const students = db.collection<Document>("students");
  const recentSince = new Date(now.getTime() - RECENT_ACTIVITY_MS);
  const expiryEnd = new Date(now.getTime() + EXPIRY_WARNING_MS);
  const [total, active, expired, recentlyActive, expiring] = await Promise.all([
    students.countDocuments({}, queryOptions()),
    students.countDocuments({
      dashboardStatus: { $in: ["active", "Active"] },
      journeyExpired: { $ne: true },
      $or: [
        { journeyExpiresAt: { $exists: false } },
        { journeyExpiresAt: null },
        { journeyExpiresAt: { $gt: now } },
      ],
    }, queryOptions()),
    students.countDocuments({
      $or: [
        { journeyExpired: true },
        { journeyExpiresAt: { $type: "date", $lte: now } },
      ],
    }, queryOptions()),
    students.countDocuments({
      loginEnabled: true,
      $or: [
        { lastLoginAt: { $gte: recentSince } },
        { dashboardLastLoginAt: { $gte: recentSince } },
      ],
    }, queryOptions()),
    students.countDocuments({
      journeyExpired: { $ne: true },
      journeyExpiresAt: { $gt: now, $lte: expiryEnd },
    }, queryOptions()),
  ]);
  return { total, active, expired, recentlyActive, expiring };
}

async function getPaymentStats(db: Db): Promise<PaymentStats> {
  const payments = db.collection<Document>("payments");
  const paymentCollectionCount = await payments.estimatedDocumentCount().catch(() => 0);

  if (paymentCollectionCount > 0) {
    const [total, pending, paid, failed, approvalPending, revenueResult] = await Promise.all([
      payments.countDocuments({}, queryOptions()),
      payments.countDocuments({ status: { $in: PAYMENT_PENDING_STATUSES } }, queryOptions()),
      payments.countDocuments({ status: { $in: PAYMENT_PAID_STATUSES } }, queryOptions()),
      payments.countDocuments({ status: { $in: PAYMENT_FAILED_STATUSES } }, queryOptions()),
      payments.countDocuments({
        status: { $in: PAYMENT_PAID_STATUSES },
        adminApprovalStatus: { $in: ["pending", "Pending"] },
      }, queryOptions()),
      payments.aggregate<{ total: number }>([
        { $match: { status: { $in: PAYMENT_PAID_STATUSES } } },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $convert: {
                  input: { $ifNull: ["$amount", "$paymentAmount"] },
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
      ], { maxTimeMS: QUERY_TIMEOUT_MS }).toArray(),
    ]);

    return {
      total,
      pending,
      paid,
      failed,
      approvalPending,
      revenue: numberOf(revenueResult[0]?.total),
    };
  }

  const students = db.collection<Document>("students");
  const [pending, paid, failed, approvalPending, revenueResult] = await Promise.all([
    students.countDocuments({ paymentStatus: { $in: ["pending", "Pending"] } }, queryOptions()),
    students.countDocuments({ paymentStatus: { $in: ["paid", "Paid"] } }, queryOptions()),
    students.countDocuments({ paymentStatus: { $in: ["failed", "Failed"] } }, queryOptions()),
    students.countDocuments({
      paymentStatus: { $in: ["paid", "Paid"] },
      adminApprovalStatus: { $in: ["pending", "Pending"] },
    }, queryOptions()),
    students.aggregate<{ total: number }>([
      { $match: { paymentStatus: { $in: ["paid", "Paid"] } } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $convert: {
                input: "$paymentAmount",
                to: "double",
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ], { maxTimeMS: QUERY_TIMEOUT_MS }).toArray(),
  ]);

  return {
    total: pending + paid + failed,
    pending,
    paid,
    failed,
    approvalPending,
    revenue: numberOf(revenueResult[0]?.total),
  };
}

async function getCertificateCount(db: Db): Promise<number> {
  const certificates = db.collection<Document>("certificates");
  const count = await certificates.estimatedDocumentCount().catch(() => 0);
  if (count > 0) return certificates.countDocuments({}, queryOptions());
  return db.collection<Document>("students").countDocuments({
    certificateStatus: { $in: ["generated", "verified", "issued", "Generated", "Verified"] },
  }, queryOptions());
}

async function getDatabaseUsage(): Promise<DatabaseUsage> {
  const refreshedAt = new Date().toISOString();
  const db = mongoose.connection.db;

  if (!db || mongoose.connection.readyState !== 1) {
    return {
      connected: false,
      databaseName: "",
      dataSizeBytes: 0,
      storageSizeBytes: 0,
      indexSizeBytes: 0,
      totalSizeBytes: 0,
      collections: 0,
      objects: 0,
      refreshedAt,
    };
  }

  try {
    const stats = await db.command({ dbStats: 1, scale: 1, maxTimeMS: QUERY_TIMEOUT_MS });
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
      dataSizeBytes: 0,
      storageSizeBytes: 0,
      indexSizeBytes: 0,
      totalSizeBytes: 0,
      collections: 0,
      objects: 0,
      refreshedAt,
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await authenticateAdmin(request);
    if (!payload?.userId) return fail("Admin authentication required.", 401, "UNAUTHORIZED");

    await connectDB();

    const admin = await loadAdmin(payload.userId);
    if (!admin) return fail("Admin account is unavailable, inactive, or not authorized for Main Admin analytics.", 403, "ADMIN_FORBIDDEN");

    const db = getDatabase();
    const now = new Date();

    const [applications, assessments, internships, payments, students, certificates, database] = await Promise.all([
      getApplicationStats(db),
      getAssessmentStats(db),
      getInternshipStats(db),
      getPaymentStats(db),
      getStudentStats(db, now),
      getCertificateCount(db),
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
      message: "Main Admin dashboard analytics loaded successfully.",
      admin,
      stats,
      database,
      meta: {
        generatedAt: now.toISOString(),
        authenticated: true,
        role: admin.role,
        version: API_VERSION,
        refreshIntervalMs: REFRESH_INTERVAL_MS,
        dataSources: ["main_database.students", "main_database.applications", "main_database.assessments", "main_database.internships", "main_database.payments", "main_database.certificates"],
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/dashboard]", error);
    if (isDatabaseUnavailable(error)) {
      return fail("Dashboard database is temporarily unavailable. Please try again shortly.", 503, "DATABASE_UNAVAILABLE");
    }
    return fail("Unable to load the Main Admin dashboard right now.", 500, "INTERNAL_SERVER_ERROR");
  }
}

function methodNotAllowed(method: string): NextResponse {
  return jsonResponse({ success: false, message: `${method} method is not allowed.`, code: "METHOD_NOT_ALLOWED" }, 405);
}

export async function POST(): Promise<NextResponse> {
  return methodNotAllowed("POST");
}

export async function PUT(): Promise<NextResponse> {
  return methodNotAllowed("PUT");
}

export async function PATCH(): Promise<NextResponse> {
  return methodNotAllowed("PATCH");
}

export async function DELETE(): Promise<NextResponse> {
  return methodNotAllowed("DELETE");
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
