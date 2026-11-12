import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB, connectStudentDB } from "@/lib/db";
import {
  AUTH_COOKIE_NAME,
  verifyAccessToken,
  verifyAuthToken,
} from "@/lib/auth";
import AdminModel from "@/models/Admin";
import { getStudentOperationsModel } from "@/models/StudentOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SEARCH_LENGTH = 120;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE_NUMBER = 100_000;
const QUERY_TIMEOUT_MS = 10_000;

type CertificateStatus = "issued" | "pending" | "revoked" | "expired" | "unknown" | "all";

type AdminAuth = {
  userId: string;
  role: string;
  email?: string;
};

type AdminRecord = {
  _id: mongoose.Types.ObjectId;
  adminId?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  active?: boolean;
};

type StudentOperationsCertificateRecord = {
  _id: mongoose.Types.ObjectId;
  mainStudentId?: string;
  applicationId?: string;
  studentId?: string;
  dashboardStudentId?: string;
  fullName?: string;
  email?: string;
  internshipTrack?: string;
  internshipPlan?: string;
  internshipDurationDays?: number;
  certificateStatus?: string;
  certificateId?: string;
  certificateGeneratedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type JsonRecord = Record<string, unknown>;

class RouteError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "RouteError";
    this.status = status;
    this.code = code;
  }
}

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    },
  });
}

function cleanString(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function toRecord(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

function getCookieToken(request: Request): string {
  const cookieHeader = request.headers.get("cookie") || "";
  const prefix = `${AUTH_COOKIE_NAME}=`;

  for (const part of cookieHeader.split(";")) {
    const cookie = part.trim();

    if (!cookie.startsWith(prefix)) continue;

    const rawValue = cookie.slice(prefix.length);

    try {
      return decodeURIComponent(rawValue).trim();
    } catch {
      return "";
    }
  }

  return "";
}

async function verifyToken(token: string): Promise<JsonRecord | null> {
  try {
    return toRecord(await verifyAccessToken(token));
  } catch {
    try {
      return toRecord(await verifyAuthToken(token));
    } catch {
      return null;
    }
  }
}

async function requireAdmin(request: Request): Promise<AdminAuth> {
  const cookieToken = getCookieToken(request);
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const token = cookieToken || bearerToken;

  if (!token) {
    throw new RouteError("Authentication required.", 401, "AUTH_REQUIRED");
  }

  const payload = await verifyToken(token);

  if (!payload) {
    throw new RouteError(
      "Invalid or expired authentication token.",
      401,
      "AUTH_INVALID",
    );
  }

  const tokenRole = cleanString(payload.role, 80).toLowerCase();
  const userId = cleanString(
    payload.userId ?? payload.id ?? payload.adminId ?? payload.sub,
    150,
  );
  const email = cleanString(payload.email, 254).toLowerCase();

  if (tokenRole !== "admin" || !userId) {
    throw new RouteError("Admin access is required.", 403, "ADMIN_REQUIRED");
  }

  await connectDB();

  const lookup: JsonRecord[] = [];

  if (isValidObjectId(userId)) {
    lookup.push({ _id: new mongoose.Types.ObjectId(userId) });
  }

  lookup.push({ adminId: userId });

  if (email) {
    lookup.push({ email });
  }

  const admin = await AdminModel.findOne({ $or: lookup })
    .select("_id adminId email role isActive active")
    .lean()
    .exec();

  if (!admin) {
    throw new RouteError(
      "Active admin account was not found.",
      403,
      "ADMIN_NOT_FOUND",
    );
  }

  const adminRecord = admin as unknown as AdminRecord;

  if (adminRecord.isActive === false || adminRecord.active === false) {
    throw new RouteError("Admin account is inactive.", 403, "ADMIN_INACTIVE");
  }

  const role = cleanString(adminRecord.role, 80);
  const normalizedRole = role.toLowerCase();

  const allowedRoles = new Set([
    "super admin",
    "superadmin",
    "admin",
    "hr",
    "support",
    "assessment manager",
    "student operations admin",
  ]);

  if (!allowedRoles.has(normalizedRole)) {
    throw new RouteError(
      "Your admin role cannot access certificate records.",
      403,
      "ROLE_FORBIDDEN",
    );
  }

  return {
    userId: cleanString(adminRecord.adminId, 150) || String(adminRecord._id),
    role,
    email: cleanString(adminRecord.email, 254).toLowerCase() || email || undefined,
  };
}

function parsePagination(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPage = Number(searchParams.get("page") || "1");
  const rawLimit = Number(searchParams.get("limit") || "50");

  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0
      ? Math.min(rawPage, MAX_PAGE_NUMBER)
      : 1;

  const limit =
    Number.isSafeInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_PAGE_SIZE)
      : 50;

  return { page, limit, searchParams };
}

function parseStatus(value: string): CertificateStatus | null {
  if (!value || value === "all") return "all";

  if (
    value === "issued" ||
    value === "pending" ||
    value === "revoked" ||
    value === "expired" ||
    value === "unknown"
  ) {
    return value;
  }

  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchFilter(search: string): JsonRecord {
  if (!search) return {};

  const regex = new RegExp(escapeRegex(search), "i");

  return {
    $or: [
      { certificateId: regex },
      { fullName: regex },
      { studentId: regex },
      { dashboardStudentId: regex },
      { email: regex },
      { internshipTrack: regex },
      { applicationId: regex },
      { mainStudentId: regex },
    ],
  };
}

function buildStatusFilter(status: CertificateStatus): JsonRecord {
  if (status === "all") {
    return {
      certificateStatus: {
        $in: ["generated", "eligible", "revoked"],
      },
    };
  }

  if (status === "issued") {
    return { certificateStatus: "generated" };
  }

  if (status === "pending") {
    return { certificateStatus: "eligible" };
  }

  if (status === "revoked") {
    return { certificateStatus: "revoked" };
  }

  if (status === "expired" || status === "unknown") {
    return { _id: { $exists: false } };
  }

  return { _id: { $exists: false } };
}

function buildFilter(search: string, status: CertificateStatus): JsonRecord {
  const statusFilter = buildStatusFilter(status);
  const searchFilter = buildSearchFilter(search);

  if (!Object.keys(searchFilter).length) return statusFilter;

  return {
    $and: [statusFilter, searchFilter],
  };
}

function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;

  const date = value instanceof Date ? value : new Date(String(value));

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function mapCertificateStatus(value: unknown): Exclude<CertificateStatus, "all"> {
  const status = cleanString(value, 40).toLowerCase();

  if (status === "generated" || status === "issued") return "issued";
  if (status === "eligible" || status === "pending") return "pending";
  if (status === "revoked") return "revoked";
  if (status === "expired") return "expired";

  return "unknown";
}

function serializeCertificate(record: StudentOperationsCertificateRecord) {
  const status = mapCertificateStatus(record.certificateStatus);

  return {
    id: String(record._id),
    certificateId: cleanString(record.certificateId, 100) || "—",
    studentName: cleanString(record.fullName, 150) || "Unknown Student",
    studentId:
      cleanString(record.dashboardStudentId, 60) ||
      cleanString(record.studentId, 50) ||
      cleanString(record.applicationId, 50) ||
      "—",
    email: cleanString(record.email, 254).toLowerCase() || "—",
    internship: cleanString(record.internshipTrack, 150) || "—",
    course: "",
    issueDate: toIsoString(record.certificateGeneratedAt),
    expiryDate: undefined,
    status,
    verificationUrl: undefined,
    pdfUrl: undefined,
    issuedBy: "Student Operations Admin",
    source: "Student Operations",
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
    revocationReason: "",
  };
}

function getErrorDetails(error: unknown) {
  const value = error as
    | {
        name?: unknown;
        code?: unknown;
        codeName?: unknown;
        message?: unknown;
      }
    | null
    | undefined;

  return {
    name: typeof value?.name === "string" ? value.name : "Error",
    code:
      typeof value?.code === "string" || typeof value?.code === "number"
        ? String(value.code)
        : undefined,
    codeName:
      typeof value?.codeName === "string" ? value.codeName : undefined,
    message:
      typeof value?.message === "string"
        ? value.message.slice(0, 400)
        : "Unknown error",
  };
}

function handleError(error: unknown, operation: string): NextResponse {
  if (error instanceof RouteError) {
    return json(
      {
        success: false,
        message: error.message,
        code: error.code,
      },
      error.status,
    );
  }

  const details = getErrorDetails(error);
  const isStudentDatabaseError =
    details.name === "MongoDBConnectionError" ||
    details.message.toLowerCase().includes("student operations database") ||
    details.name.toLowerCase().includes("serverselection");

  console.error(`[ADMIN CERTIFICATES ${operation}]`, {
    ...details,
    database: isStudentDatabaseError ? "student_operations" : "main_or_api",
  });

  if (isStudentDatabaseError) {
    return json(
      {
        success: false,
        message:
          "Student Operations database is temporarily unavailable. Check its MongoDB connection, credentials, network access list and cluster status, then retry.",
        code: "STUDENT_OPERATIONS_DATABASE_UNAVAILABLE",
      },
      503,
    );
  }

  return json(
    {
      success: false,
      message:
        operation === "load"
          ? "Failed to load certificate records. Please retry."
          : "Certificate request failed.",
      code: `CERTIFICATES_${operation.toUpperCase()}_FAILED`,
    },
    500,
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);

    const { page, limit, searchParams } = parsePagination(request);
    const search = cleanString(
      searchParams.get("search"),
      MAX_SEARCH_LENGTH,
    );
    const requestedStatus = cleanString(
      searchParams.get("status"),
      30,
    ).toLowerCase();
    const status = parseStatus(requestedStatus);

    if (!status) {
      return json(
        {
          success: false,
          message: "Invalid certificate status filter.",
          code: "INVALID_STATUS_FILTER",
        },
        400,
      );
    }

    await connectStudentDB();

    const StudentOperations = await getStudentOperationsModel();
    const filter = buildFilter(search, status);
    const skip = (page - 1) * limit;

    const [
      documents,
      total,
      allTotal,
      issued,
      pending,
      revoked,
    ] = await Promise.all([
      StudentOperations.find(filter)
        .select(
          "_id mainStudentId applicationId studentId dashboardStudentId fullName email internshipTrack internshipPlan internshipDurationDays certificateStatus certificateId certificateGeneratedAt createdAt updatedAt",
        )
        .sort({ certificateGeneratedAt: -1, updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean()
        .exec(),
      StudentOperations.countDocuments(filter)
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .exec(),
      StudentOperations.countDocuments({
        certificateStatus: { $in: ["generated", "eligible", "revoked"] },
      })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .exec(),
      StudentOperations.countDocuments({ certificateStatus: "generated" })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .exec(),
      StudentOperations.countDocuments({ certificateStatus: "eligible" })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .exec(),
      StudentOperations.countDocuments({ certificateStatus: "revoked" })
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .exec(),
    ]);

    const data = documents.map((document) =>
      serializeCertificate(
        document as unknown as StudentOperationsCertificateRecord,
      ),
    );

    const totalPages = Math.ceil(total / limit);

    return json({
      success: true,
      message: "Student Operations certificate records loaded successfully.",
      data,
      total,
      page,
      limit,
      pages: totalPages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      stats: {
        total: allTotal,
        issued,
        pending,
        eligible: pending,
        revoked,
        expired: 0,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        authenticated: true,
        source: "student_operations",
        readOnly: true,
        database: "student_operations",
      },
    });
  } catch (error) {
    return handleError(error, "load");
  }
}

export async function HEAD(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    await connectStudentDB();
    await getStudentOperationsModel();

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  } catch (error) {
    if (error instanceof RouteError) {
      return new NextResponse(null, {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const details = getErrorDetails(error);
    console.error("[ADMIN CERTIFICATES HEAD]", details);

    return new NextResponse(null, {
      status:
        details.name === "MongoDBConnectionError" ||
        details.name.toLowerCase().includes("serverselection")
          ? 503
          : 500,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(): Promise<NextResponse> {
  return json(
    {
      success: false,
      message: "Certificate issuance is managed by Student Operations Admin.",
      code: "METHOD_NOT_ALLOWED",
    },
    405,
  );
}

export async function PUT(): Promise<NextResponse> {
  return json(
    { success: false, message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" },
    405,
  );
}

export async function PATCH(): Promise<NextResponse> {
  return json(
    { success: false, message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" },
    405,
  );
}

export async function DELETE(): Promise<NextResponse> {
  return json(
    { success: false, message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" },
    405,
  );
}
