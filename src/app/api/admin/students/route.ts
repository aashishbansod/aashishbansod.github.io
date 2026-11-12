import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Admin from "@/models/Admin";
import Student from "@/models/Student";
import {
  verifyAuthToken,
  ADMIN_AUTH_COOKIE_NAME,
  type AuthUser,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;
const MAX_BODY_BYTES = 16_384;

type JsonRecord = Record<string, unknown>;

const ADMIN_ROLES = new Set([
  "Super Admin",
  "Admin",
  "HR",
  "Assessment Manager",
  "Support",
  "Student Operations Admin",
]);

const PROFILE_FIELDS = new Set([
  "fullName",
  "phone",
  "dateOfBirth",
  "gender",
  "fatherName",
  "motherName",
  "parentGuardianName",
  "parentGuardianPhone",
  "emergencyContact",
  "address",
  "city",
  "state",
  "pincode",
  "collegeName",
  "university",
  "course",
  "branchStream",
  "year",
  "semester",
  "cgpa",
  "backlogStatus",
  "linkedinUrl",
  "githubUrl",
  "portfolioUrl",
  "resumeUrl",
  "collegeIdUrl",
  "photoUrl",
  "batchName",
  "batchDate",
  "notes",
]);

const SAFE_FIELDS = [
  "_id",
  "applicationId",
  "fullName",
  "email",
  "emailVerified",
  "emailVerifiedAt",
  "phone",
  "dateOfBirth",
  "gender",
  "fatherName",
  "motherName",
  "parentGuardianName",
  "parentGuardianPhone",
  "emergencyContact",
  "address",
  "city",
  "state",
  "pincode",
  "collegeName",
  "university",
  "course",
  "branchStream",
  "year",
  "semester",
  "cgpa",
  "backlogStatus",
  "linkedinUrl",
  "githubUrl",
  "portfolioUrl",
  "resumeUrl",
  "collegeIdUrl",
  "photoUrl",
  "studentId",
  "credentialsGenerated",
  "credentialsGeneratedAt",
  "credentialsExpiresAt",
  "loginEnabled",
  "loginEnabledAt",
  "lastLoginAt",
  "accountLocked",
  "mustChangePassword",
  "journeyStartedAt",
  "journeyExpiresAt",
  "journeyExpired",
  "applicationStatus",
  "adminApprovalStatus",
  "adminApprovedAt",
  "submittedAt",
  "batchName",
  "batchDate",
  "assessmentStatus",
  "assessmentScore",
  "assessmentStartedAt",
  "assessmentSubmittedAt",
  "assessmentEvaluatedAt",
  "resultDeclaredAt",
  "resultVisibleAt",
  "resultStatus",
  "internshipApplicationAllowed",
  "internshipTrack",
  "internshipPlan",
  "internshipStatus",
  "paymentStatus",
  "paymentAmount",
  "paymentCurrency",
  "dashboardStatus",
  "certificateId",
  "certificateStatus",
  "whatsappJoined",
  "consentTerms",
  "consentPrivacy",
  "consentDeclaration",
  "consentUpdates",
  "consentAcceptedAt",
  "notes",
  "createdAt",
  "updatedAt",
] as const;

const SAFE_PROJECTION = SAFE_FIELDS.join(" ");

const response = (body: JsonRecord, status = 200): NextResponse =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });

const fail = (
  message: string,
  code: string,
  status: number,
): NextResponse => response({ success: false, message, code }, status);

const succeed = (
  message: string,
  data: JsonRecord,
  status = 200,
): NextResponse =>
  response({ success: true, message, data }, status);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return stringValue(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assessmentFilter(status: "passed" | "failed"): JsonRecord {
  const variants =
    status === "passed"
      ? ["passed", "Passed", "pass", "PASS"]
      : ["failed", "Failed", "fail", "FAIL"];

  return {
    $or: [
      { assessmentStatus: { $in: variants } },
      { resultStatus: { $in: variants } },
    ],
  };
}

function buildFilter(search: string, status: string): JsonRecord | null {
  const conditions: JsonRecord[] = [];

  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    conditions.push({
      $or: [
        { fullName: regex },
        { email: regex },
        { studentId: regex },
        { applicationId: regex },
        { phone: regex },
        { collegeName: regex },
        { university: regex },
        { course: regex },
        { branchStream: regex },
        { internshipTrack: regex },
        { internshipPlan: regex },
      ],
    });
  }

  switch (status) {
    case "":
    case "all":
    case "all_students":
      break;
    case "active":
      conditions.push({ loginEnabled: true, accountLocked: { $ne: true } });
      break;
    case "inactive":
      conditions.push({
        $or: [{ loginEnabled: { $ne: true } }, { accountLocked: true }],
      });
      break;
    case "pending":
      conditions.push({
        $or: [
          { applicationStatus: "pending" },
          { adminApprovalStatus: "pending" },
        ],
      });
      break;
    case "approved":
      conditions.push({
        $or: [
          { applicationStatus: "approved" },
          { adminApprovalStatus: "approved" },
        ],
      });
      break;
    case "rejected":
      conditions.push({
        $or: [
          { applicationStatus: "rejected" },
          { adminApprovalStatus: "rejected" },
        ],
      });
      break;
    case "under_review":
      conditions.push({
        applicationStatus: { $in: ["under_review", "under-review"] },
      });
      break;
    case "verified":
      conditions.push({ emailVerified: true });
      break;
    case "unverified":
      conditions.push({ emailVerified: { $ne: true } });
      break;
    case "assessment_passed":
      conditions.push(assessmentFilter("passed"));
      break;
    case "assessment_failed":
      conditions.push(assessmentFilter("failed"));
      break;
    case "paid":
      conditions.push({ paymentStatus: "paid" });
      break;
    default:
      return null;
  }

  if (conditions.length === 0) return {};
  return conditions.length === 1 ? conditions[0] : { $and: conditions };
}

async function authenticateAdmin(
  request: NextRequest,
): Promise<{ user: AuthUser; admin: JsonRecord } | null> {
  const token = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const user = await verifyAuthToken(token);
  if (
    !user ||
    user.role !== "admin" ||
    user.sessionType !== "admin" ||
    !user.adminRole ||
    !ADMIN_ROLES.has(user.adminRole) ||
    !mongoose.isValidObjectId(user.id)
  ) {
    return null;
  }

  const adminDocument = await Admin.findById(user.id)
    .select(
      "_id adminId fullName email role isActive isEmailVerified permissions security.accountLocked security.lockedUntil",
    )
    .lean()
    .exec();

  if (!adminDocument) return null;

  const admin = adminDocument as unknown as JsonRecord;
  const security = isRecord(admin.security) ? admin.security : {};
  const permissions = isRecord(admin.permissions) ? admin.permissions : {};
  const lockedUntil =
    security.lockedUntil instanceof Date
      ? security.lockedUntil.getTime()
      : security.lockedUntil
        ? new Date(String(security.lockedUntil)).getTime()
        : 0;

  if (
    admin.isActive !== true ||
    admin.isEmailVerified !== true ||
    security.accountLocked === true ||
    (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) ||
    stringValue(admin.role) !== user.adminRole
  ) {
    return null;
  }

  if (user.adminRole !== "Super Admin" && permissions.students !== true) {
    return null;
  }

  return { user, admin };
}

function verifyMutationOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return false;

  try {
    const expected = request.nextUrl.origin;
    if (origin && new URL(origin).origin !== expected) return false;
    if (referer && new URL(referer).origin !== expected) return false;
    return true;
  } catch {
    return false;
  }
}

async function readJsonBody(
  request: NextRequest,
): Promise<{ body: JsonRecord } | { error: NextResponse }> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return {
      error: fail("Request body is too large.", "BODY_TOO_LARGE", 413),
    };
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      error: fail(
        "Content-Type must be application/json.",
        "INVALID_CONTENT_TYPE",
        415,
      ),
    };
  }

  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      return {
        error: fail("Request body is too large.", "BODY_TOO_LARGE", 413),
      };
    }
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      return {
        error: fail("Request body must be a JSON object.", "INVALID_BODY", 400),
      };
    }
    return { body: parsed };
  } catch {
    return {
      error: fail("A valid JSON request body is required.", "INVALID_JSON", 400),
    };
  }
}

function serializeStudent(raw: unknown): JsonRecord {
  if (!isRecord(raw)) return {};
  const output: JsonRecord = {};

  for (const field of SAFE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(raw, field)) {
      output[field] = raw[field];
    }
  }

  if (output._id != null) output._id = String(output._id);

  delete output.password;
  delete output.passwordHash;
  delete output.loginPasswordHash;
  delete output.dashboardPasswordHash;
  delete output.temporaryPassword;
  delete output.razorpaySignature;
  delete output.refreshToken;
  delete output.__v;

  return output;
}

function isDuplicateKey(error: unknown): boolean {
  return isRecord(error) && Number(error.code) === 11000;
}

function isValidationError(error: unknown): boolean {
  return isRecord(error) && error.name === "ValidationError";
}

function getIdentifierFilter(identifier: string): JsonRecord | null {
  const alternatives: JsonRecord[] = [
    { studentId: identifier },
    { applicationId: identifier },
  ];

  if (mongoose.isValidObjectId(identifier)) {
    alternatives.push({ _id: new mongoose.Types.ObjectId(identifier) });
  }

  return { $or: alternatives };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await authenticateAdmin(request);
    if (!authenticated) {
      return fail(
        "Your admin session is invalid or does not have Students permission.",
        "UNAUTHORIZED",
        401,
      );
    }

    await connectDB();

    const params = request.nextUrl.searchParams;
    const page = positiveInteger(params.get("page"), 1);
    const limit = Math.min(
      positiveInteger(params.get("limit"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const search = stringValue(params.get("search")).slice(
      0,
      MAX_SEARCH_LENGTH,
    );
    const status = normalize(params.get("status"));
    const filter = buildFilter(search, status);

    if (!filter) {
      return fail("Unsupported student status filter.", "INVALID_FILTER", 400);
    }

    const [
      total,
      totalStudents,
      activeStudents,
      pendingStudents,
      verifiedStudents,
      approvedStudents,
      rejectedStudents,
      paidStudents,
      assessmentPassed,
      assessmentFailed,
    ] = await Promise.all([
      Student.countDocuments(filter).exec(),
      Student.countDocuments({}).exec(),
      Student.countDocuments({
        loginEnabled: true,
        accountLocked: { $ne: true },
      }).exec(),
      Student.countDocuments({
        $or: [
          { applicationStatus: "pending" },
          { adminApprovalStatus: "pending" },
        ],
      }).exec(),
      Student.countDocuments({ emailVerified: true }).exec(),
      Student.countDocuments({
        $or: [
          { applicationStatus: "approved" },
          { adminApprovalStatus: "approved" },
        ],
      }).exec(),
      Student.countDocuments({
        $or: [
          { applicationStatus: "rejected" },
          { adminApprovalStatus: "rejected" },
        ],
      }).exec(),
      Student.countDocuments({ paymentStatus: "paid" }).exec(),
      Student.countDocuments(assessmentFilter("passed")).exec(),
      Student.countDocuments(assessmentFilter("failed")).exec(),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const effectivePage =
      totalPages > 0 ? Math.min(page, totalPages) : 1;

    const studentDocuments = await Student.find(filter)
      .select(SAFE_PROJECTION)
      .sort({ createdAt: -1, _id: -1 })
      .skip((effectivePage - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const students = studentDocuments.map(serializeStudent);
    const pagination = {
      page: effectivePage,
      requestedPage: page,
      limit,
      total,
      totalPages,
      hasNextPage: effectivePage < totalPages,
      hasPreviousPage: effectivePage > 1,
    };

    const stats = {
      totalStudents,
      activeStudents,
      pending: pendingStudents,
      verified: verifiedStudents,
      approved: approvedStudents,
      rejected: rejectedStudents,
      paid: paidStudents,
      assessmentPassed,
      assessmentFailed,
    };

    return succeed("Students fetched successfully.", {
      students,
      records: students,
      pagination,
      filters: { search: search || null, status: status || "all" },
      stats,
      totalStudents,
      activeStudents,
      applications: approvedStudents,
      pending: pendingStudents,
    });
  } catch (error) {
    console.error("[ADMIN STUDENTS] GET failed:", error);
    return fail(
      "Unable to fetch student records.",
      "STUDENTS_FETCH_FAILED",
      500,
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyMutationOrigin(request)) {
      return fail("Request origin could not be verified.", "INVALID_ORIGIN", 403);
    }

    const authenticated = await authenticateAdmin(request);
    if (!authenticated) {
      return fail(
        "Your admin session is invalid or does not have Students permission.",
        "UNAUTHORIZED",
        401,
      );
    }

    if (
      authenticated.user.adminRole !== "Super Admin" &&
      authenticated.user.adminRole !== "Admin" &&
      authenticated.user.adminRole !== "HR"
    ) {
      return fail(
        "Your admin role cannot modify student profiles.",
        "FORBIDDEN",
        403,
      );
    }

    const parsed = await readJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.body;
    const studentId = stringValue(body.studentId);
    const applicationId = stringValue(body.applicationId);
    const id = stringValue(body.id);
    const filter: JsonRecord | null = studentId
      ? { studentId }
      : applicationId
        ? { applicationId }
        : mongoose.isValidObjectId(id)
          ? { _id: new mongoose.Types.ObjectId(id) }
          : null;

    if (!filter) {
      return fail(
        "A valid studentId, applicationId or id is required.",
        "IDENTIFIER_REQUIRED",
        400,
      );
    }

    if (!isRecord(body.updates)) {
      return fail(
        "A valid updates object is required.",
        "UPDATES_REQUIRED",
        400,
      );
    }

    const updates: JsonRecord = {};
    const ignoredFields: string[] = [];

    for (const [key, value] of Object.entries(body.updates)) {
      if (!PROFILE_FIELDS.has(key)) {
        ignoredFields.push(key);
        continue;
      }

      if (
        value !== null &&
        typeof value !== "string" &&
        key !== "batchDate" &&
        key !== "dateOfBirth"
      ) {
        return fail(
          `Field "${key}" must be a string or null.`,
          "INVALID_FIELD_TYPE",
          400,
        );
      }

      if (typeof value === "string" && value.length > 2000) {
        return fail(
          `Field "${key}" exceeds the allowed length.`,
          "FIELD_TOO_LONG",
          400,
        );
      }

      updates[key] = typeof value === "string" ? value.trim() : value;
    }

    if (Object.keys(updates).length === 0) {
      return response(
        {
          success: false,
          message: "No permitted student fields were provided for update.",
          code: "NO_VALID_FIELDS",
          ...(ignoredFields.length ? { ignoredFields } : {}),
        },
        400,
      );
    }

    if (
      typeof updates.fullName === "string" &&
      (updates.fullName.length < 2 || updates.fullName.length > 120)
    ) {
      return fail(
        "Full name must contain between 2 and 120 characters.",
        "INVALID_FULL_NAME",
        400,
      );
    }

    if (
      typeof updates.phone === "string" &&
      updates.phone.length > 20
    ) {
      return fail("Phone number is too long.", "INVALID_PHONE", 400);
    }

    if (
      typeof updates.email !== "undefined" ||
      typeof updates.loginEnabled !== "undefined" ||
      typeof updates.accountLocked !== "undefined"
    ) {
      return fail(
        "Email and account security fields cannot be changed through profile editing.",
        "PROTECTED_FIELD",
        400,
      );
    }

    for (const field of [
      "linkedinUrl",
      "githubUrl",
      "portfolioUrl",
      "resumeUrl",
      "collegeIdUrl",
      "photoUrl",
    ]) {
      const value = updates[field];
      if (typeof value === "string" && value && !isValidHttpUrl(value)) {
        return fail(
          `${field} must be a valid HTTP or HTTPS URL.`,
          "INVALID_URL",
          400,
        );
      }
    }

    for (const field of ["batchDate", "dateOfBirth"]) {
      const value = updates[field];
      if (typeof value === "string" && value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return fail(
            `Invalid ${field} value.`,
            "INVALID_DATE",
            400,
          );
        }
        updates[field] = date;
      }
    }

    if (
      typeof updates.cgpa === "string" &&
      updates.cgpa.trim() !== "" &&
      !Number.isFinite(Number(updates.cgpa))
    ) {
      return fail("CGPA must be a valid number.", "INVALID_CGPA", 400);
    }

    const updated = await Student.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true, runValidators: true, context: "query" },
    )
      .select(SAFE_PROJECTION)
      .lean()
      .exec();

    if (!updated) {
      return fail("Student record not found.", "STUDENT_NOT_FOUND", 404);
    }

    return response({
      success: true,
      message: "Student profile updated successfully.",
      data: { student: serializeStudent(updated) },
      ...(ignoredFields.length ? { ignoredFields } : {}),
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      return fail(
        "A student with the same unique information already exists.",
        "DUPLICATE_STUDENT",
        409,
      );
    }

    if (isValidationError(error)) {
      return fail(
        "Student data validation failed.",
        "VALIDATION_ERROR",
        400,
      );
    }

    console.error("[ADMIN STUDENTS] PUT failed:", error);
    return fail(
      "Unable to update student profile.",
      "STUDENT_UPDATE_FAILED",
      500,
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return PUT(request);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyMutationOrigin(request)) {
      return fail("Request origin could not be verified.", "INVALID_ORIGIN", 403);
    }

    const authenticated = await authenticateAdmin(request);
    if (!authenticated) {
      return fail(
        "Your admin session is invalid or does not have Students permission.",
        "UNAUTHORIZED",
        401,
      );
    }

    if (authenticated.user.adminRole !== "Super Admin") {
      return fail(
        "Only Super Admin can delete a failed student record.",
        "FORBIDDEN",
        403,
      );
    }

    const parsed = await readJsonBody(request);
    if ("error" in parsed) return parsed.error;

    const body = parsed.body;
    const identifier =
      stringValue(body.studentId) ||
      stringValue(body.applicationId) ||
      stringValue(body.id);

    if (!identifier || identifier.length > 128) {
      return fail(
        "A valid studentId, applicationId or id is required.",
        "IDENTIFIER_REQUIRED",
        400,
      );
    }

    if (body.onlyIfAssessmentFailed !== true) {
      return fail(
        "Deletion requires onlyIfAssessmentFailed: true.",
        "FAILED_ASSESSMENT_GUARD_REQUIRED",
        400,
      );
    }

    await connectDB();

    const filter = getIdentifierFilter(identifier);
    if (!filter) {
      return fail("Invalid student identifier.", "INVALID_IDENTIFIER", 400);
    }

    const student = await Student.findOne(filter).lean().exec();
    if (!student) {
      return fail("Student record not found.", "STUDENT_NOT_FOUND", 404);
    }

    const raw = student as unknown as JsonRecord;
    const failedStatuses = new Set(["failed", "fail"]);
    const assessmentStatus = normalize(raw.assessmentStatus);
    const resultStatus = normalize(raw.resultStatus);

    if (
      !failedStatuses.has(assessmentStatus) &&
      !failedStatuses.has(resultStatus)
    ) {
      return fail(
        "Only a student with a recorded failed assessment can be deleted.",
        "ASSESSMENT_NOT_FAILED",
        409,
      );
    }

    const paymentStatus = normalize(raw.paymentStatus);
    if (
      ["paid", "captured", "success", "completed", "refunded"].includes(
        paymentStatus,
      )
    ) {
      return fail(
        "This student has payment history. Deletion is blocked to preserve financial records.",
        "PAYMENT_HISTORY_PROTECTED",
        409,
      );
    }

    const certificateStatus = normalize(raw.certificateStatus);
    if (
      raw.certificateId ||
      ["issued", "generated", "active"].includes(certificateStatus)
    ) {
      return fail(
        "This student has certificate records. Deletion is blocked.",
        "CERTIFICATE_HISTORY_PROTECTED",
        409,
      );
    }

    if (
      normalize(raw.dashboardStatus) === "active" ||
      normalize(raw.operationsSyncStatus) === "synced"
    ) {
      return fail(
        "An activated or synchronized student cannot be deleted from this endpoint.",
        "ACTIVE_WORKFLOW_PROTECTED",
        409,
      );
    }

    const deleteResult = await Student.deleteOne({
      _id: raw._id,
      assessmentStatus: raw.assessmentStatus,
      resultStatus: raw.resultStatus,
    }).exec();

    if (deleteResult.deletedCount !== 1) {
      return fail(
        "Student record changed before deletion. Refresh and try again.",
        "DELETE_CONFLICT",
        409,
      );
    }

    console.info("[ADMIN STUDENTS] Failed student record deleted", {
      studentId: stringValue(raw.studentId) || identifier,
      adminId: authenticated.user.id,
    });

    return succeed("Failed student record deleted successfully.", {
      deleted: true,
      studentId: stringValue(raw.studentId) || identifier,
      applicationId: stringValue(raw.applicationId),
    });
  } catch (error) {
    console.error("[ADMIN STUDENTS] DELETE failed:", error);
    return fail(
      "Unable to delete this student record.",
      "STUDENT_DELETE_FAILED",
      500,
    );
  }
}
