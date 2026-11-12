
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import {
  ADMIN_AUTH_COOKIE_NAME,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";
import { getStudentOperationsModel } from "@/models/StudentOperations";
import getCertificateModel from "@/models/Certificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 12 * 1024;
const MAX_SEARCH_LENGTH = 120;
const MAX_LIMIT = 100;
const MAX_PAGE = 100000;
const MAX_REASON_LENGTH = 1000;

type StudentCertificateStatus =
  | "not-eligible"
  | "eligible"
  | "generated"
  | "revoked";

type CertificateStatus = "issued" | "pending" | "revoked" | "expired";

type CertificateStats = {
  total: number;
  issued: number;
  pending: number;
  revoked: number;
  expired: number;
  emailSent: number;
  emailFailed: number;
};

const EMPTY_STATS: CertificateStats = {
  total: 0,
  issued: 0,
  pending: 0,
  revoked: 0,
  expired: 0,
  emailSent: 0,
  emailFailed: 0,
};

type Actor = {
  id: string;
  role: string;
  name: string;
};

type TokenClaims = {
  sub?: unknown;
  userId?: unknown;
  role?: unknown;
  adminRole?: unknown;
  sessionType?: unknown;
  identifier?: unknown;
};

type StudentRecord = {
  _id: mongoose.Types.ObjectId;
  mainStudentId: string;
  applicationId?: string;
  studentId?: string;
  dashboardStudentId?: string;
  fullName: string;
  email: string;
  internshipTrack?: string;
  internshipPlan?: string;
  internshipDurationDays?: number;
  internshipStartedAt?: Date | null;
  internshipEndsAt?: Date | null;
  operationsApprovalStatus?: string;
  operationsStatus?: string;
  dashboardStatus?: string;
  paymentStatus?: string;
  projectStatus?: string;
  certificateStatus?: StudentCertificateStatus;
  certificateId?: string;
  certificateGeneratedAt?: Date | null;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type CertificateDocument = {
  _id: mongoose.Types.ObjectId;
  certificateId: string;
  mainStudentId: string;
  operationsStudentId?: string;
  applicationId?: string;
  studentId: string;
  dashboardStudentId?: string;
  studentName: string;
  email: string;
  internship: string;
  course?: string;
  internshipPlan?: string;
  internshipDurationDays?: number;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  status: CertificateStatus;
  verificationUrl?: string;
  pdfUrl?: string;
  issuedById?: string;
  issuedByName?: string;
  issuedByRole?: string;
  revokedAt?: Date | null;
  revokedById?: string;
  revokedByName?: string;
  revocationReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

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

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}

function clean(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

function getCookieToken(request: NextRequest, name: string): string {
  return request.cookies.get(name)?.value?.trim() || "";
}

async function authenticate(request: NextRequest): Promise<Actor> {
  const tokens = [
    getCookieToken(request, STUDENT_ADMIN_AUTH_COOKIE_NAME),
    getCookieToken(request, ADMIN_AUTH_COOKIE_NAME),
  ].filter(Boolean);

  const authorization = request.headers.get("authorization") || "";

  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (bearerToken) {
    tokens.push(bearerToken);
  }

  let actor: Actor | null = null;

  for (const token of [...new Set(tokens)]) {
    try {
      const payload = await verifyAccessToken(token);

      if (!payload || !isPlainObject(payload)) {
        continue;
      }

      const claims = payload as TokenClaims;

      const userId = clean(
        claims.sub ?? claims.userId,
        150,
      );

      const role = clean(claims.role, 30).toLowerCase();
      const adminRole = clean(claims.adminRole, 100);
      const sessionType = clean(claims.sessionType, 80);
      const identifier = clean(claims.identifier, 254);

      if (role !== "admin" || !userId) {
        continue;
      }

      const isStudentOperationsAdmin =
        adminRole === "Student Operations Admin" &&
        sessionType === "student-admin";

      const isSuperAdmin =
        adminRole === "Super Admin" &&
        sessionType === "admin";

      if (!isStudentOperationsAdmin && !isSuperAdmin) {
        continue;
      }

      actor = {
        id: userId,
        role: adminRole,
        name: identifier || userId,
      };

      break;
    } catch {
      continue;
    }
  }

  if (!actor) {
    throw new RouteError(
      "A valid Student Admin or Super Admin session is required.",
      401,
      "AUTH_REQUIRED",
    );
  }

  return actor;
}

function trustedOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (fetchSite === "cross-site") {
    return false;
  }

  const origin = request.headers.get("origin")?.trim();

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readJson(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RouteError(
      "Content-Type must be application/json.",
      415,
      "INVALID_CONTENT_TYPE",
    );
  }

  const contentLength = Number(
    request.headers.get("content-length") || 0,
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    throw new RouteError(
      "Request body is too large.",
      413,
      "PAYLOAD_TOO_LARGE",
    );
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new RouteError(
      "Request body is too large.",
      413,
      "PAYLOAD_TOO_LARGE",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RouteError(
      "Request body must contain valid JSON.",
      400,
      "INVALID_JSON",
    );
  }

  if (!isPlainObject(parsed)) {
    throw new RouteError(
      "A JSON object is required.",
      400,
      "INVALID_BODY",
    );
  }

  return parsed;
}

function normalizeStudentStatus(
  value: unknown,
): StudentCertificateStatus {
  const status = clean(value, 40).toLowerCase();

  if (
    status === "eligible" ||
    status === "generated" ||
    status === "revoked" ||
    status === "not-eligible"
  ) {
    return status;
  }

  return "not-eligible";
}

function normalizeCertificateStatus(
  studentStatus: unknown,
  certificateStatus?: unknown,
): "issued" | "pending" | "revoked" | "expired" {
  const certificateValue = clean(
    certificateStatus,
    30,
  ).toLowerCase();

  if (
    certificateValue === "issued" ||
    certificateValue === "revoked" ||
    certificateValue === "expired" ||
    certificateValue === "pending"
  ) {
    return certificateValue;
  }

  const studentValue = normalizeStudentStatus(studentStatus);

  if (studentValue === "generated") return "issued";
  if (studentValue === "revoked") return "revoked";

  return "pending";
}

function newCertificateId(): string {
  return `CN-${new Date().getFullYear()}-${randomBytes(8)
    .toString("hex")
    .toUpperCase()}`;
}

function newVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

function iso(value: unknown): string | null {
  if (!value) return null;

  const date = value instanceof Date
    ? value
    : new Date(String(value));

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function isEligible(record: StudentRecord): boolean {
  const endDate = record.internshipEndsAt
    ? new Date(record.internshipEndsAt)
    : null;

  return (
    record.operationsApprovalStatus === "approved" &&
    record.operationsStatus === "completed" &&
    record.projectStatus === "approved" &&
    record.paymentStatus === "paid" &&
    Boolean(
      endDate &&
      !Number.isNaN(endDate.getTime()) &&
      endDate.getTime() <= Date.now(),
    ) &&
    normalizeStudentStatus(record.certificateStatus) === "eligible"
  );
}

function buildVerificationUrl(token: string): string {
  const configuredBase =
    process.env.CERTIFICATE_VERIFICATION_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim();

  if (!configuredBase) {
    throw new RouteError(
      "Certificate verification URL is not configured.",
      503,
      "CERTIFICATE_VERIFICATION_CONFIG_MISSING",
    );
  }

  try {
    const base = new URL(configuredBase);

    if (
      base.protocol !== "https:" &&
      base.hostname !== "localhost"
    ) {
      throw new Error("HTTPS is required.");
    }

    const url = new URL("/verify-certificate", base);

    url.searchParams.set("token", token);

    return url.toString();
  } catch {
    throw new RouteError(
      "Certificate verification URL configuration is invalid.",
      503,
      "CERTIFICATE_VERIFICATION_CONFIG_INVALID",
    );
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendAuditNote(
  existingNotes: unknown,
  event: Record<string, string>,
): string {
  const existing = clean(existingNotes, 2500);
  const line = JSON.stringify(event);
  const combined = existing
    ? `${existing}\n${line}`
    : line;

  return combined.slice(-3000);
}

function identityFilter(recordId: string) {
  if (isValidObjectId(recordId)) {
    return {
      _id: new mongoose.Types.ObjectId(recordId),
    };
  }

  return {
    $or: [
      { mainStudentId: recordId },
      { studentId: recordId.toUpperCase() },
      { dashboardStudentId: recordId.toUpperCase() },
      { applicationId: recordId.toUpperCase() },
    ],
  };
}

const STUDENT_SELECT = [
  "_id",
  "mainStudentId",
  "applicationId",
  "studentId",
  "dashboardStudentId",
  "fullName",
  "email",
  "internshipTrack",
  "internshipPlan",
  "internshipDurationDays",
  "internshipStartedAt",
  "internshipEndsAt",
  "operationsApprovalStatus",
  "operationsStatus",
  "dashboardStatus",
  "paymentStatus",
  "projectStatus",
  "certificateStatus",
  "certificateId",
  "certificateGeneratedAt",
  "notes",
  "createdAt",
  "updatedAt",
].join(" ");

function serializeCertificate(
  record: StudentRecord,
  certificate?: Record<string, unknown> | null,
) {
  const status = normalizeCertificateStatus(
    record.certificateStatus,
    certificate?.status,
  );

  return {
    id: String(record._id),
    mainStudentId: clean(record.mainStudentId, 100),
    operationsStudentId: clean(
      certificate?.operationsStudentId,
      100,
    ),
    applicationId: clean(record.applicationId, 80),
    certificateId:
      clean(certificate?.certificateId, 100) ||
      clean(record.certificateId, 100),
    studentName: clean(record.fullName, 150),
    studentId:
      clean(record.dashboardStudentId, 80) ||
      clean(record.studentId, 80) ||
      clean(record.applicationId, 80),
    email: clean(record.email, 254).toLowerCase(),
    internship: clean(record.internshipTrack, 500),
    course: clean(certificate?.course, 500),
    internshipPlan: clean(record.internshipPlan, 50),
    internshipDurationDays: Math.max(
      0,
      Number(record.internshipDurationDays || 0),
    ),
    internshipStartedAt: iso(record.internshipStartedAt),
    internshipEndsAt: iso(record.internshipEndsAt),
    operationsApprovalStatus: clean(
      record.operationsApprovalStatus,
      40,
    ),
    operationsStatus: clean(record.operationsStatus, 40),
    dashboardStatus: clean(record.dashboardStatus, 40),
    paymentStatus: clean(record.paymentStatus, 40),
    projectStatus: clean(record.projectStatus, 40),
    status,
    issueDate:
      iso(certificate?.issueDate) ||
      iso(record.certificateGeneratedAt),
    expiryDate: iso(certificate?.expiryDate),
    verificationUrl: clean(
      certificate?.verificationUrl,
      2048,
    ),
    pdfUrl: clean(certificate?.pdfUrl, 2048),
    issuedByName: clean(certificate?.issuedByName, 150),
    issuedByRole: clean(certificate?.issuedByRole, 100),
    revokedAt: iso(certificate?.revokedAt),
    revokedReason: clean(
      certificate?.revocationReason,
      MAX_REASON_LENGTH,
    ),
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    emailStatus: "not-sent",
    emailSentAt: null,
  };
}

function getErrorResponse(error: unknown, operation: string) {
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

  const value = error as
    | {
        name?: unknown;
        code?: unknown;
        codeName?: unknown;
      }
    | null;

  const code =
    typeof value?.code === "string" ||
    typeof value?.code === "number"
      ? String(value.code)
      : undefined;

  console.error(
    `[STUDENT ADMIN CERTIFICATES ${operation}]`,
    {
      name:
        typeof value?.name === "string"
          ? value.name
          : "Error",
      ...(code ? { code } : {}),
      ...(typeof value?.codeName === "string"
        ? { codeName: value.codeName }
        : {}),
    },
  );

  if (code === "11000") {
    return json(
      {
        success: false,
        message:
          "A certificate already exists for this student or certificate ID.",
        code: "CERTIFICATE_DUPLICATE",
      },
      409,
    );
  }

  return json(
    {
      success: false,
      message: "Unable to process certificate request.",
      code: `CERTIFICATE_${operation.toUpperCase()}_FAILED`,
    },
    500,
  );
}

async function getModels() {
  const [Operations, Certificate] = await Promise.all([
    getStudentOperationsModel(),
    getCertificateModel(),
  ]);

  return { Operations, Certificate };
}

async function revokeCertificate(
  recordId: string,
  reason: string,
  actor: Actor,
) {
  if (!recordId) {
    throw new RouteError(
      "Student Operations record ID is required.",
      400,
      "RECORD_ID_REQUIRED",
    );
  }

  if (reason.length < 10) {
    throw new RouteError(
      "A revocation reason of at least 10 characters is required.",
      400,
      "REVOCATION_REASON_REQUIRED",
    );
  }

  const { Operations, Certificate } = await getModels();

  const existingStudent = await Operations.findOne(
    identityFilter(recordId),
  )
    .select(STUDENT_SELECT)
    .lean()
    .exec();

  if (!existingStudent) {
    throw new RouteError(
      "Student record was not found.",
      404,
      "STUDENT_NOT_FOUND",
    );
  }

  const student = existingStudent as unknown as StudentRecord;

  const existingCertificate = await Certificate.findOne({
    mainStudentId: student.mainStudentId,
  })
    .select(
      "certificateId status issueDate expiryDate verificationUrl pdfUrl revokedAt revocationReason",
    )
    .lean()
    .exec();

  if (
    normalizeStudentStatus(student.certificateStatus) !== "generated" ||
    !clean(student.certificateId) ||
    !existingCertificate ||
    existingCertificate.status !== "issued" ||
    clean(existingCertificate.certificateId) !==
      clean(student.certificateId)
  ) {
    throw new RouteError(
      "Only a matching issued certificate can be revoked.",
      409,
      "CERTIFICATE_NOT_ISSUED",
    );
  }

  const revokedAt = new Date();

  const certificateUpdate = await Certificate.updateOne(
    {
      _id: existingCertificate._id,
      mainStudentId: student.mainStudentId,
      certificateId: student.certificateId,
      status: "issued",
    },
    {
      $set: {
        status: "revoked",
        revokedAt,
        revokedById: actor.id,
        revokedByName: actor.name,
        revocationReason: reason,
      },
      $push: {
        auditTrail: {
          $each: [
            {
              action: "revoked",
              actorId: actor.id,
              actorName: actor.name,
              actorRole: actor.role,
              reason,
              occurredAt: revokedAt,
            },
          ],
          $slice: -100,
        },
      },
    },
    {
      runValidators: true,
    },
  ).exec();

  if (certificateUpdate.modifiedCount !== 1) {
    throw new RouteError(
      "Certificate status changed during this request. Refresh and retry.",
      409,
      "CERTIFICATE_UPDATE_CONFLICT",
    );
  }

  const updatedStudent = await Operations.findOneAndUpdate(
    {
      _id: student._id,
      mainStudentId: student.mainStudentId,
      certificateStatus: "generated",
      certificateId: student.certificateId,
    },
    {
      $set: {
        certificateStatus: "revoked",
        notes: appendAuditNote(student.notes, {
          event: "CERTIFICATE_REVOKED",
          certificateId: clean(student.certificateId, 100),
          reason,
          actorId: actor.id,
          actorRole: actor.role,
          revokedAt: revokedAt.toISOString(),
        }),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .select(STUDENT_SELECT)
    .lean()
    .exec();

  if (!updatedStudent) {
    await Certificate.updateOne(
      {
        _id: existingCertificate._id,
        status: "revoked",
        revokedAt,
      },
      {
        $set: {
          status: "issued",
          revokedAt: null,
          revokedById: "",
          revokedByName: "",
          revocationReason: "",
        },
        $pull: {
          auditTrail: {
            action: "revoked",
            actorId: actor.id,
            occurredAt: revokedAt,
          },
        },
      },
    ).exec();

    throw new RouteError(
      "Student certificate record changed during revocation. No final status was changed.",
      409,
      "CERTIFICATE_REVOKE_CONFLICT",
    );
  }

  const certificate = await Certificate.findById(
    existingCertificate._id,
  )
    .select(
      "certificateId mainStudentId operationsStudentId course issueDate expiryDate status verificationUrl pdfUrl issuedByName issuedByRole revokedAt revocationReason createdAt updatedAt",
    )
    .lean()
    .exec();

  return serializeCertificate(
    updatedStudent as unknown as StudentRecord,
    certificate as unknown as Record<string, unknown> | null,
  );
}

export async function GET(request: NextRequest) {
  try {
    await authenticate(request);

    const { searchParams } = new URL(request.url);

    const search = clean(
      searchParams.get("search"),
      MAX_SEARCH_LENGTH,
    );

    const statusParam = clean(
      searchParams.get("status"),
      30,
    ).toLowerCase();

    const pageRaw = Number(searchParams.get("page") || 1);
    const limitRaw = Number(searchParams.get("limit") || 20);

    const page =
      Number.isSafeInteger(pageRaw) && pageRaw > 0
        ? Math.min(pageRaw, MAX_PAGE)
        : 1;

    const limit =
      Number.isSafeInteger(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : 20;

    const allowedStatuses = new Set([
      "",
      "all",
      "issued",
      "pending",
      "revoked",
      "expired",
    ]);

    if (!allowedStatuses.has(statusParam)) {
      throw new RouteError(
        "Invalid certificate status filter.",
        400,
        "INVALID_STATUS",
      );
    }

    const { Operations, Certificate } = await getModels();

    const conditions: Record<string, unknown>[] = [
      {
        certificateStatus: {
          $in: ["eligible", "generated", "revoked"],
        },
      },
    ];

    if (statusParam === "issued") {
      conditions.push({
        certificateStatus: "generated",
      });
    } else if (statusParam === "pending") {
      conditions.push({
        certificateStatus: "eligible",
      });
    } else if (statusParam === "revoked") {
      conditions.push({
        certificateStatus: "revoked",
      });
    } else if (statusParam === "expired") {
      const expiredMainStudentIds = await Certificate.distinct(
        "mainStudentId",
        {
          status: "expired",
        },
      ).exec();

      if (expiredMainStudentIds.length === 0) {
        return json({
          success: true,
          message: "Certificate records loaded successfully.",
          data: {
            certificates: [],
            records: [],
            stats: EMPTY_STATS,
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
            },
          },
        });
      }

      conditions.push({
        mainStudentId: {
          $in: expiredMainStudentIds,
        },
      });
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");

      conditions.push({
        $or: [
          { certificateId: regex },
          { fullName: regex },
          { email: regex },
          { studentId: regex },
          { dashboardStudentId: regex },
          { applicationId: regex },
        ],
      });
    }

    const filter = {
      $and: conditions,
    };

    const skip = (page - 1) * limit;

    const [
      documents,
      total,
      eligibleCount,
      generatedCount,
      revokedCount,
      expiredCount,
    ] = await Promise.all([
      Operations.find(filter)
        .select(STUDENT_SELECT)
        .sort({
          certificateGeneratedAt: -1,
          updatedAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      Operations.countDocuments(filter).exec(),

      Operations.countDocuments({
        certificateStatus: "eligible",
      }).exec(),

      Operations.countDocuments({
        certificateStatus: "generated",
      }).exec(),

      Operations.countDocuments({
        certificateStatus: "revoked",
      }).exec(),

      Certificate.countDocuments({
        status: "expired",
      }).exec(),
    ]);

    const studentRecords = documents as unknown as StudentRecord[];

    const mainStudentIds = studentRecords
      .map((item) => clean(item.mainStudentId, 100))
      .filter(Boolean);

    const certificateDocuments = mainStudentIds.length
      ? await Certificate.find({
          mainStudentId: {
            $in: mainStudentIds,
          },
        })
          .select(
            "certificateId mainStudentId operationsStudentId course issueDate expiryDate status verificationUrl pdfUrl issuedByName issuedByRole revokedAt revocationReason createdAt updatedAt",
          )
          .lean()
          .exec()
      : [];

    const certificateMap = new Map<
      string,
      Record<string, unknown>
    >();

    for (const certificate of certificateDocuments) {
      certificateMap.set(
        clean(certificate.mainStudentId, 100),
        certificate as unknown as Record<string, unknown>,
      );
    }

    const certificates = studentRecords.map((record) =>
      serializeCertificate(
        record,
        certificateMap.get(
          clean(record.mainStudentId, 100),
        ) || null,
      ),
    );

    const totalPages = Math.ceil(total / limit);

    const stats: CertificateStats = {
      total: eligibleCount + generatedCount + revokedCount,
      issued: generatedCount,
      pending: eligibleCount,
      revoked: revokedCount,
      expired: expiredCount,
      emailSent: 0,
      emailFailed: 0,
    };

    return json({
      success: true,
      message: "Certificate records loaded successfully.",
      data: {
        certificates,
        records: certificates,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
      meta: {
        source: "student_operations",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return getErrorResponse(error, "list");
  }
}

export async function POST(request: NextRequest) {
  let createdCertificateId = "";
  let createdMainStudentId = "";

  try {
    const actor = await authenticate(request);

    if (!trustedOrigin(request)) {
      throw new RouteError(
        "Cross-origin requests are not allowed.",
        403,
        "INVALID_ORIGIN",
      );
    }

    const body = await readJson(request);

    const action = clean(body.action, 40).toLowerCase();

    if (action === "revoke") {
      const recordId = clean(
        body.recordId ??
          body.id ??
          body.mainStudentId ??
          body.studentId,
        120,
      );

      const reason = clean(
        body.reason,
        MAX_REASON_LENGTH,
      );

      const data = await revokeCertificate(
        recordId,
        reason,
        actor,
      );

      return json({
        success: true,
        message: "Certificate revoked successfully.",
        data,
      });
    }

    if (action === "send-email") {
      throw new RouteError(
        "Certificate email delivery is not enabled yet. The email service must support verified PDF attachments and delivery history before sending.",
        501,
        "CERTIFICATE_EMAIL_NOT_CONFIGURED",
      );
    }

    if (action && action !== "issue") {
      throw new RouteError(
        "Unsupported certificate action.",
        400,
        "INVALID_CERTIFICATE_ACTION",
      );
    }

    const recordId = clean(
      body.recordId ??
        body.id ??
        body.mainStudentId ??
        body.studentId,
      120,
    );

    if (!recordId) {
      throw new RouteError(
        "Student Operations record ID is required.",
        400,
        "RECORD_ID_REQUIRED",
      );
    }

    const { Operations, Certificate } = await getModels();

    const student = await Operations.findOne(
      identityFilter(recordId),
    )
      .select(STUDENT_SELECT)
      .lean()
      .exec();

    if (!student) {
      throw new RouteError(
        "Student record was not found.",
        404,
        "STUDENT_NOT_FOUND",
      );
    }

    const record = student as unknown as StudentRecord;

    const existingCertificate = await Certificate.findOne({
      mainStudentId: record.mainStudentId,
    })
      .select(
        "certificateId status issueDate verificationUrl pdfUrl revokedAt",
      )
      .lean()
      .exec();

    if (
      normalizeStudentStatus(record.certificateStatus) ===
        "generated" &&
      clean(record.certificateId)
    ) {
      return json({
        success: true,
        duplicate: true,
        message: "Certificate has already been issued.",
        data: serializeCertificate(
          record,
          existingCertificate as unknown as Record<string, unknown> | null,
        ),
      });
    }

    if (
      normalizeStudentStatus(record.certificateStatus) === "revoked" ||
      existingCertificate?.status === "revoked"
    ) {
      throw new RouteError(
        "A revoked certificate cannot be issued again. Use a separate reissue workflow.",
        409,
        "CERTIFICATE_REVOKED",
      );
    }

    if (existingCertificate) {
      throw new RouteError(
        "A certificate record already exists for this student. Reconcile its status before issuing again.",
        409,
        "CERTIFICATE_RECORD_EXISTS",
      );
    }

    if (!isEligible(record)) {
      throw new RouteError(
        "Student is not eligible. Internship must be completed, project approved, payment paid and certificate status eligible.",
        409,
        "CERTIFICATE_NOT_ELIGIBLE",
      );
    }

    if (
      !clean(record.mainStudentId, 100) ||
      !clean(record.fullName, 150) ||
      !clean(record.email, 254) ||
      !clean(record.internshipTrack, 500)
    ) {
      throw new RouteError(
        "Student certificate profile is incomplete.",
        422,
        "CERTIFICATE_PROFILE_INCOMPLETE",
      );
    }

    const email = clean(record.email, 254).toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new RouteError(
        "Student email address is invalid.",
        422,
        "INVALID_STUDENT_EMAIL",
      );
    }

    let created: Record<string, unknown> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const certificateId = newCertificateId();
      const token = newVerificationToken();
      const issueDate = new Date();
      const verifyUrl = buildVerificationUrl(token);

      const duration = Math.max(
        0,
        Math.min(
          3650,
          Number(record.internshipDurationDays || 0),
        ),
      );

      try {
        const certificate = await Certificate.create({
          certificateId,
          mainStudentId: record.mainStudentId,
          operationsStudentId: String(record._id),
          applicationId: clean(record.applicationId, 80),
          studentId:
            clean(record.dashboardStudentId, 80) ||
            clean(record.studentId, 80) ||
            clean(record.applicationId, 80),
          dashboardStudentId: clean(
            record.dashboardStudentId,
            80,
          ),
          studentName: clean(record.fullName, 150),
          email,
          internship: clean(record.internshipTrack, 500),
          course: "Internship Training",
          internshipPlan: clean(record.internshipPlan, 50),
          internshipDurationDays: duration,
          issueDate,
          status: "issued",
          verificationToken: token,
          verificationUrl: verifyUrl,
          source: "student-operations",
          syncStatus: "synced",
          mainAdminSyncedAt: null,
          issuedById: actor.id,
          issuedByName: actor.name,
          issuedByRole: actor.role,
          auditTrail: [
            {
              action: "issued",
              actorId: actor.id,
              actorName: actor.name,
              actorRole: actor.role,
              reason:
                "Certificate issued after eligibility validation.",
              occurredAt: issueDate,
            },
          ],
        });

        created = certificate.toObject() as Record<string, unknown>;
        createdCertificateId = certificateId;
        createdMainStudentId = record.mainStudentId;

        break;
      } catch (error) {
        lastError = error;

        const value = error as {
          code?: unknown;
        } | null;

        if (String(value?.code ?? "") !== "11000") {
          throw error;
        }
      }
    }

    if (!created) {
      throw (
        lastError ||
        new RouteError(
          "Unable to allocate a unique certificate ID.",
          409,
          "CERTIFICATE_ID_GENERATION_FAILED",
        )
      );
    }

    const generatedAt = new Date();

    const updated = await Operations.findOneAndUpdate(
      {
        _id: record._id,
        mainStudentId: record.mainStudentId,
        certificateStatus: "eligible",
        $or: [
          { certificateId: "" },
          { certificateId: null },
          { certificateId: { $exists: false } },
        ],
        operationsApprovalStatus: "approved",
        operationsStatus: "completed",
        paymentStatus: "paid",
        projectStatus: "approved",
        internshipEndsAt: {
          $lte: generatedAt,
        },
      },
      {
        $set: {
          certificateStatus: "generated",
          certificateId: createdCertificateId,
          certificateGeneratedAt: generatedAt,
          notes: appendAuditNote(record.notes, {
            event: "CERTIFICATE_ISSUED",
            certificateId: createdCertificateId,
            actorId: actor.id,
            actorRole: actor.role,
            issuedAt: generatedAt.toISOString(),
          }),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select(STUDENT_SELECT)
      .lean()
      .exec();

    if (!updated) {
      await Certificate.deleteOne({
        mainStudentId: createdMainStudentId,
        certificateId: createdCertificateId,
      }).exec();

      createdCertificateId = "";
      createdMainStudentId = "";

      throw new RouteError(
        "Student eligibility or certificate status changed during issuance. Refresh and retry.",
        409,
        "CERTIFICATE_ISSUE_CONFLICT",
      );
    }

    return json(
      {
        success: true,
        duplicate: false,
        message: "Certificate issued successfully.",
        data: serializeCertificate(
          updated as unknown as StudentRecord,
          created,
        ),
      },
      201,
    );
  } catch (error) {
    if (createdCertificateId && createdMainStudentId) {
      try {
        const Certificate = await getCertificateModel();

        await Certificate.deleteOne({
          mainStudentId: createdMainStudentId,
          certificateId: createdCertificateId,
        }).exec();
      } catch (cleanupError) {
        console.error(
          "[CERTIFICATE ISSUE COMPENSATION]",
          {
            name:
              cleanupError instanceof Error
                ? cleanupError.name
                : "CleanupError",
          },
        );
      }
    }

    return getErrorResponse(error, "issue");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await authenticate(request);

    if (!trustedOrigin(request)) {
      throw new RouteError(
        "Cross-origin requests are not allowed.",
        403,
        "INVALID_ORIGIN",
      );
    }

    const body = await readJson(request);

    const recordId = clean(
      body.recordId ??
        body.id ??
        body.mainStudentId ??
        body.studentId,
      120,
    );

    const reason = clean(
      body.reason,
      MAX_REASON_LENGTH,
    );

    const data = await revokeCertificate(
      recordId,
      reason,
      actor,
    );

    return json({
      success: true,
      message: "Certificate revoked successfully.",
      data,
    });
  } catch (error) {
    return getErrorResponse(error, "revoke");
  }
}

export async function DELETE() {
  return json(
    {
      success: false,
      message:
        "Certificate records cannot be permanently deleted. Use the revocation workflow when required.",
      code: "METHOD_NOT_ALLOWED",
    },
    405,
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PATCH, DELETE, OPTIONS, HEAD",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(request: NextRequest) {
  try {
    await authenticate(request);
    await getModels();

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof RouteError) {
      return new NextResponse(null, {
        status: error.status,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    console.error("[STUDENT ADMIN CERTIFICATES HEAD]", {
      name: error instanceof Error ? error.name : "Error",
    });

    return new NextResponse(null, {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
