import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Student from "@/models/Student";
import { verifyAuthToken, type AuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUTH_COOKIE_NAME = "cybernet_auth_token";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

const ADMIN_ROLES = new Set([
  "Super Admin",
  "Admin",
  "HR",
  "Assessment Manager",
  "Support",
]);

const PROFILE_FIELDS = [
  "fullName", "phone", "dateOfBirth", "gender", "fatherName",
  "motherName", "parentGuardianName", "parentGuardianPhone",
  "emergencyContact", "address", "city", "state", "pincode",
  "collegeName", "university", "course", "branchStream", "year",
  "semester", "cgpa", "backlogStatus", "linkedinUrl", "githubUrl",
  "portfolioUrl", "resumeUrl", "collegeIdUrl", "photoUrl",
  "batchName", "batchDate", "notes",
] as const;

const SAFE_FIELDS = [
  "_id", "applicationId", "fullName", "name", "email", "emailVerified",
  "emailVerifiedAt", "phone", "dateOfBirth", "gender", "fatherName",
  "motherName", "parentGuardianName", "parentGuardianPhone",
  "emergencyContact", "address", "city", "state", "pincode",
  "collegeName", "university", "course", "branchStream", "year",
  "semester", "cgpa", "backlogStatus", "linkedinUrl", "githubUrl",
  "portfolioUrl", "resumeUrl", "collegeIdUrl", "photoUrl", "studentId",
  "credentialsGenerated", "credentialsGeneratedAt", "credentialsExpiresAt",
  "loginEnabled", "loginEnabledAt", "lastLoginAt", "journeyStartedAt",
  "journeyExpiresAt", "journeyExpired", "applicationStatus", "submittedAt",
  "batchName", "batchDate", "assessmentStatus", "assessmentScore",
  "assessmentStartedAt", "assessmentSubmittedAt", "assessmentEvaluatedAt",
  "resultDeclaredAt", "resultVisibleAt", "resultStatus",
  "internshipApplicationAllowed", "internshipTrack", "internshipPlan",
  "internshipStatus", "paymentStatus", "paymentId", "adminApprovalStatus",
  "approvedAt", "dashboardStatus", "certificateId", "certificateStatus",
  "whatsappJoined", "consentTerms", "consentPrivacy", "consentDeclaration",
  "consentUpdates", "consentAcceptedAt", "notes", "createdAt", "updatedAt",
] as const;

const SAFE_PROJECTION = SAFE_FIELDS.join(" ");

type JsonRecord = Record<string, unknown>;

function response(body: JsonRecord, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
    },
  });
}

function fail(message: string, code: string, status: number): NextResponse {
  return response({ success: false, message, code }, status);
}

function succeed(message: string, data: JsonRecord, status = 200): NextResponse {
  return response({ success: true, message, data }, status);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return str(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function positiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assessmentFailedFilter(): JsonRecord {
  return {
    $or: [
      { assessmentStatus: { $in: ["failed", "Failed", "fail", "FAIL"] } },
      { resultStatus: { $in: ["failed", "Failed", "fail", "FAIL"] } },
    ],
  };
}

function assessmentPassedFilter(): JsonRecord {
  return {
    $or: [
      { assessmentStatus: { $in: ["passed", "Passed", "pass", "PASS"] } },
      { resultStatus: { $in: ["passed", "Passed", "pass", "PASS"] } },
    ],
  };
}

function buildFilter(search: string, status: string): JsonRecord {
  const conditions: JsonRecord[] = [];
  if (search) {
    const regex = new RegExp(escapeRegExp(search.slice(0, MAX_SEARCH_LENGTH)), "i");
    conditions.push({
      $or: [
        { fullName: regex }, { name: regex }, { email: regex },
        { studentId: regex }, { applicationId: regex }, { phone: regex },
        { collegeName: regex }, { university: regex }, { course: regex },
        { branchStream: regex }, { internshipTrack: regex }, { internshipPlan: regex },
      ],
    });
  }

  switch (status) {
    case "":
    case "all":
    case "all_students":
      break;
    case "active":
      conditions.push({ loginEnabled: true });
      break;
    case "inactive":
      conditions.push({ loginEnabled: { $ne: true } });
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
        $or: [{ applicationStatus: "approved" }, { adminApprovalStatus: "approved" }],
      });
      break;
    case "rejected":
      conditions.push({
        $or: [{ applicationStatus: "rejected" }, { adminApprovalStatus: "rejected" }],
      });
      break;
    case "under_review":
      conditions.push({ applicationStatus: { $in: ["under_review", "under-review"] } });
      break;
    case "verified":
      conditions.push({ emailVerified: true });
      break;
    case "unverified":
      conditions.push({ emailVerified: { $ne: true } });
      break;
    case "assessment_passed":
      conditions.push(assessmentPassedFilter());
      break;
    case "assessment_failed":
      conditions.push(assessmentFailedFilter());
      break;
    case "paid":
      conditions.push({ paymentStatus: "paid" });
      break;
    default:
      // Unknown filters intentionally return all matching search results.
      break;
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

async function authenticatedAdmin(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const user = await verifyAuthToken(token);
    if (!user || user.role !== "admin") return null;
    if (user.adminRole && !ADMIN_ROLES.has(user.adminRole)) return null;
    return user;
  } catch (error) {
    console.error("[ADMIN STUDENTS] Auth verification failed:", error);
    return null;
  }
}

function serializeStudent(raw: unknown): JsonRecord {
  const student = raw as JsonRecord;
  const output: JsonRecord = {};
  for (const field of SAFE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(student, field)) {
      output[field] = student[field];
    }
  }
  if (output._id != null) output._id = String(output._id);
  // Never expose credential material, even if the schema changes later.
  delete output.password;
  delete output.passwordHash;
  delete output.loginPasswordHash;
  delete output.temporaryPassword;
  delete output.__v;
  return output;
}

function isObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDuplicateKey(error: unknown): boolean {
  return isObject(error) && Number(error.code) === 11000;
}

function isValidationError(error: unknown): boolean {
  return isObject(error) && error.name === "ValidationError";
}

function identifierFilter(identifier: string): JsonRecord | null {
  const alternatives: JsonRecord[] = [
    { studentId: identifier },
    { applicationId: identifier },
  ];
  if (mongoose.isValidObjectId(identifier)) {
    alternatives.push({ _id: new mongoose.Types.ObjectId(identifier) });
  }
  return { $or: alternatives };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await authenticatedAdmin(request);
    if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);

    await connectDB();
    const params = request.nextUrl.searchParams;
    const page = positiveInt(params.get("page"), 1);
    const limit = Math.min(positiveInt(params.get("limit"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const search = str(params.get("search")).slice(0, MAX_SEARCH_LENGTH);
    const status = normalize(params.get("status"));
    const filter = buildFilter(search, status);

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
      Student.countDocuments({ loginEnabled: true }).exec(),
      Student.countDocuments({
        $or: [{ applicationStatus: "pending" }, { adminApprovalStatus: "pending" }],
      }).exec(),
      Student.countDocuments({ emailVerified: true }).exec(),
      Student.countDocuments({
        $or: [{ applicationStatus: "approved" }, { adminApprovalStatus: "approved" }],
      }).exec(),
      Student.countDocuments({
        $or: [{ applicationStatus: "rejected" }, { adminApprovalStatus: "rejected" }],
      }).exec(),
      // Student.paymentStatus is a schema enum; "paid" is the canonical paid value.
      Student.countDocuments({ paymentStatus: "paid" }).exec(),
      Student.countDocuments(assessmentPassedFilter()).exec(),
      Student.countDocuments(assessmentFailedFilter()).exec(),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const effectivePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
    const students = await Student.find(filter)
      .select(SAFE_PROJECTION)
      .sort({ createdAt: -1, _id: -1 })
      .skip((effectivePage - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const serialized = students.map((student) => serializeStudent(student));
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
      students: serialized,
      records: serialized,
      pagination,
      filters: { search: search || null, status: status || "all" },
      stats,
      // Backward compatibility for older dashboard consumers.
      totalStudents,
      activeStudents,
      applications: approvedStudents,
      pending: pendingStudents,
    });
  } catch (error) {
    console.error("GET /api/admin/students failed:", error);
    return fail("Unable to fetch student records.", "STUDENTS_FETCH_FAILED", 500);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await authenticatedAdmin(request);
    if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);

    // Deletion is a destructive operation; only top-level admin roles may do it.
    if (admin.adminRole && !["Super Admin", "Admin"].includes(admin.adminRole)) {
      return fail("Only Super Admin or Admin can delete failed student records.", "FORBIDDEN", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("A valid JSON request body is required.", "INVALID_JSON", 400);
    }
    if (!isObject(body)) return fail("Request body must be a JSON object.", "INVALID_BODY", 400);

    const identifier = str(body.studentId) || str(body.applicationId) || str(body.id);
    if (!identifier || identifier.length > 128) {
      return fail("A valid studentId, applicationId or id is required.", "IDENTIFIER_REQUIRED", 400);
    }
    if (body.onlyIfAssessmentFailed !== true) {
      return fail("Deletion requires onlyIfAssessmentFailed: true.", "FAILED_ASSESSMENT_GUARD_REQUIRED", 400);
    }

    await connectDB();
    const filter = identifierFilter(identifier);
    if (!filter) return fail("Invalid student identifier.", "INVALID_IDENTIFIER", 400);

    const student = await Student.findOne(filter).lean().exec();
    if (!student) return fail("Student record not found.", "STUDENT_NOT_FOUND", 404);

    const raw = student as unknown as JsonRecord;
    const failedStatuses = new Set(["failed", "fail"]);
    const assessmentStatus = normalize(raw.assessmentStatus);
    const resultStatus = normalize(raw.resultStatus);
    if (!failedStatuses.has(assessmentStatus) && !failedStatuses.has(resultStatus)) {
      return fail("Only a student with a recorded failed assessment can be deleted.", "ASSESSMENT_NOT_FAILED", 409);
    }

    const paymentStatus = normalize(raw.paymentStatus);
    if (["paid", "captured", "success", "completed", "refunded_pending"].includes(paymentStatus)) {
      return fail("This student has payment records. Deletion is blocked to protect payment/audit history.", "PAYMENT_HISTORY_PROTECTED", 409);
    }
    if (raw.certificateId || ["issued", "generated", "active"].includes(normalize(raw.certificateStatus))) {
      return fail("This student has certificate records. Deletion is blocked to protect certificate history.", "CERTIFICATE_HISTORY_PROTECTED", 409);
    }

    // Delete only the Student document. Related assessment/payment collections are
    // intentionally not cascaded because their schemas and audit requirements vary.
    const deleteResult = await Student.deleteOne({ _id: raw._id }).exec();
    if (deleteResult.deletedCount !== 1) {
      return fail("Student record changed before deletion. Refresh and try again.", "DELETE_CONFLICT", 409);
    }

    console.info("[ADMIN STUDENTS] Failed student record deleted", {
      studentId: str(raw.studentId) || identifier,
      adminId: str((admin as unknown as JsonRecord).id) || str((admin as unknown as JsonRecord)._id) || "admin",
    });

    return succeed("Failed student record deleted successfully.", {
      deleted: true,
      studentId: str(raw.studentId) || identifier,
      applicationId: str(raw.applicationId),
    });
  } catch (error) {
    console.error("DELETE /api/admin/students failed:", error);
    return fail("Unable to delete this student record.", "STUDENT_DELETE_FAILED", 500);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await authenticatedAdmin(request);
    if (!admin) return fail("Unauthorized. Admin login required.", "UNAUTHORIZED", 401);
    if (admin.adminRole && !["Super Admin", "Admin", "HR"].includes(admin.adminRole)) {
      return fail("You do not have permission to modify student records.", "FORBIDDEN", 403);
    }

    await connectDB();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON request body.", "INVALID_JSON", 400);
    }
    if (!isObject(body)) return fail("Request body must be a JSON object.", "INVALID_BODY", 400);

    const studentId = str(body.studentId);
    const applicationId = str(body.applicationId);
    const id = str(body.id);
    const filter = studentId
      ? { studentId }
      : applicationId
        ? { applicationId }
        : mongoose.isValidObjectId(id)
          ? { _id: new mongoose.Types.ObjectId(id) }
          : null;

    if (!filter) return fail("studentId, applicationId or a valid id is required.", "IDENTIFIER_REQUIRED", 400);
    if (!isObject(body.updates)) return fail("A valid updates object is required.", "UPDATES_REQUIRED", 400);

    const updates: JsonRecord = {};
    const ignoredFields: string[] = [];
    const allowed = new Set<string>(PROFILE_FIELDS);
    for (const [key, value] of Object.entries(body.updates)) {
      if (!allowed.has(key)) {
        ignoredFields.push(key);
        continue;
      }
      if (value !== null && typeof value !== "string" && key !== "batchDate") {
        return fail(`Field "${key}" must be a string or null.`, "INVALID_FIELD_TYPE", 400);
      }
      updates[key] = typeof value === "string" ? value.trim() : value;
    }
    if (Object.keys(updates).length === 0) {
      return response({
        success: false,
        message: "No permitted student fields were provided for update.",
        code: "NO_VALID_FIELDS",
        ...(ignoredFields.length ? { ignoredFields } : {}),
      }, 400);
    }

    if (typeof updates.fullName === "string" && (updates.fullName.length < 3 || updates.fullName.length > 120)) {
      return fail("Full name must contain between 3 and 120 characters.", "INVALID_FULL_NAME", 400);
    }
    if (typeof updates.phone === "string" && updates.phone.length > 16) {
      return fail("Phone number is too long.", "INVALID_PHONE", 400);
    }
    for (const field of ["linkedinUrl", "githubUrl", "portfolioUrl", "resumeUrl", "collegeIdUrl", "photoUrl"]) {
      const value = updates[field];
      if (typeof value === "string" && value) {
        try {
          const url = new URL(value);
          if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
        } catch {
          return fail(`${field} must be a valid HTTP or HTTPS URL.`, "INVALID_URL", 400);
        }
      }
    }
    if (typeof updates.batchDate === "string" && updates.batchDate) {
      const date = new Date(updates.batchDate);
      if (Number.isNaN(date.getTime())) return fail("Invalid batchDate value.", "INVALID_BATCH_DATE", 400);
      updates.batchDate = date;
    }
    if (typeof updates.dateOfBirth === "string" && updates.dateOfBirth) {
      const date = new Date(updates.dateOfBirth);
      if (Number.isNaN(date.getTime())) return fail("Invalid dateOfBirth value.", "INVALID_DATE_OF_BIRTH", 400);
      updates.dateOfBirth = date;
    }

    const updated = await Student.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true, runValidators: true, context: "query" },
    ).select(SAFE_PROJECTION).lean().exec();

    if (!updated) return fail("Student record not found.", "STUDENT_NOT_FOUND", 404);
    return response({
      success: true,
      message: "Student record updated successfully.",
      data: { student: serializeStudent(updated) },
      ...(ignoredFields.length ? { ignoredFields } : {}),
    });
  } catch (error) {
    if (isDuplicateKey(error)) return fail("A student with the same unique information already exists.", "DUPLICATE_STUDENT", 409);
    if (isValidationError(error)) return fail("Student data validation failed.", "VALIDATION_ERROR", 400);
    console.error("PUT /api/admin/students failed:", error);
    return fail("Unable to update student record.", "STUDENT_UPDATE_FAILED", 500);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return PUT(request);
}
