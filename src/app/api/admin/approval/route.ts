import { NextRequest, NextResponse } from "next/server";
import mongoose, { type ClientSession } from "mongoose";
import crypto from "node:crypto";

import connectDB from "@/lib/db";
import Application from "@/models/Application";
import Student from "@/models/Student";
import { hashPassword, verifyAuthToken, type AuthUser } from "@/lib/auth";
import { sendStudentCredentialsEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUTH_COOKIE_NAME = "cybernet_auth_token";
const STUDENT_PASSWORD_LENGTH = 14;
const APPLICATION_STATUSES = ["pending", "under_review", "approved", "rejected"] as const;
type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
const APPROVAL_ROLES = new Set(["Super Admin", "Admin", "HR"]);
const MAX_REASON_LENGTH = 1000;

class ApprovalRouteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApprovalRouteError";
  }
}

function apiResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

async function getAuthenticatedAdmin(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const user = await verifyAuthToken(token);
    if (!user || user.role !== "admin") return null;

    // Keep compatibility with existing AuthUser payloads, but reject explicitly
    // assigned non-privileged admin roles.
    const adminRole = cleanString((user as AuthUser & { adminRole?: string }).adminRole);
    if (adminRole && !APPROVAL_ROLES.has(adminRole)) return null;

    return user;
  } catch (error) {
    console.error("[ADMIN APPROVAL] Authentication failed:", error);
    return null;
  }
}

function generateStudentId(): string {
  return `CN-${new Date().getFullYear()}-${crypto.randomInt(100000, 1000000)}`;
}

async function generateUniqueStudentId(session: ClientSession): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const studentId = generateStudentId();
    const existing = await Student.findOne({ studentId }, { _id: 1 })
      .session(session)
      .lean()
      .exec();
    if (!existing) return studentId;
  }
  throw new Error("Unable to generate a unique student ID.");
}

function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const symbols = "@#$%&*!";
  const chars: string[] = [];

  for (let i = 0; i < STUDENT_PASSWORD_LENGTH - 3; i += 1) {
    chars.push(alphabet[crypto.randomInt(0, alphabet.length)]);
  }
  chars.push(symbols[crypto.randomInt(0, symbols.length)]);
  chars.push(String(crypto.randomInt(0, 10)));
  chars.push(alphabet[crypto.randomInt(0, alphabet.length)]);

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function readJsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function validationError(code: string, message: string, status = 400): NextResponse {
  return apiResponse({ success: false, code, message }, status);
}

function publicApplication(application: Record<string, unknown>): Record<string, unknown> {
  // Preserve the existing admin UI's application fields while stripping secrets.
  const sensitiveKey = /(password|passwd|otp|token|secret|reset.?key|verification.?code|api.?key|credential)/i;
  const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== "object" || value instanceof Date) return value;
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (sensitiveKey.test(key)) continue;
      result[key] = sanitize(nestedValue);
    }
    return result;
  };
  return sanitize(application) as Record<string, unknown>;
}

async function sendCredentialsEmail(params: {
  studentEmail: string;
  studentName: string;
  studentId: string;
  password: string;
  internshipName: string;
}): Promise<void> {
  await sendStudentCredentialsEmail({
    studentEmail: params.studentEmail,
    studentName: params.studentName,
    studentId: params.studentId,
    password: params.password,
    internshipName: params.internshipName,
  });
}

function errorResponse(error: unknown, operation: string): NextResponse {
  if (error instanceof ApprovalRouteError) {
    return apiResponse(
      { success: false, code: error.code, message: error.message },
      error.status,
    );
  }

  if (isDuplicateKeyError(error)) {
    return apiResponse(
      {
        success: false,
        code: "DUPLICATE_RECORD",
        message: "A duplicate application or student account already exists.",
      },
      409,
    );
  }

  console.error(`[ADMIN APPROVAL] ${operation} failed:`, error);
  return apiResponse(
    {
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to process the request. Please try again.",
    },
    500,
  );
}

/**
 * GET /api/admin/approval?status=pending&page=1&limit=50
 * Returns a paginated, allow-listed view of application data.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) {
    return apiResponse(
      { success: false, code: "UNAUTHORIZED", message: "Admin login required." },
      401,
    );
  }

  try {
    await connectDB();

    const params = request.nextUrl.searchParams;
    const requestedStatus = cleanString(params.get("status")).toLowerCase();
    if (requestedStatus && !APPLICATION_STATUSES.includes(requestedStatus as ApplicationStatus)) {
      return validationError("INVALID_STATUS", "Unsupported application status.");
    }

    const requestedPage = Number(params.get("page") ?? 1);
    const requestedLimit = Number(params.get("limit") ?? 50);
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, 10000)
        : 1;
    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 50;
    const filter: Record<string, unknown> = {};
    if (requestedStatus) filter.status = requestedStatus;

    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      Application.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      Application.countDocuments(filter).exec(),
    ]);

    const data = documents.map((item) =>
      publicApplication(item as unknown as Record<string, unknown>),
    );

    return apiResponse({
      success: true,
      message: "Applications fetched successfully.",
      data,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return errorResponse(error, "GET");
  }
}

/**
 * POST /api/admin/approval
 * { action: "approve" | "reject" | "resend_credentials", applicationId, reason? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) {
    return apiResponse(
      { success: false, code: "UNAUTHORIZED", message: "Admin login required." },
      401,
    );
  }

  try {
    await connectDB();
    const body = await readJsonObject(request);
    if (!body) return validationError("INVALID_BODY", "Request body must be a valid JSON object.");

    const action = cleanString(body.action).toLowerCase();
    const applicationId = cleanString(body.applicationId);
    const reason = cleanString(body.reason);

    if (!applicationId) {
      return validationError("APPLICATION_ID_REQUIRED", "Application ID is required.");
    }
    if (!["approve", "reject", "resend_credentials"].includes(action)) {
      return validationError(
        "INVALID_ACTION",
        "Use approve, reject, or resend_credentials.",
      );
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return validationError("INVALID_REASON", "Reason cannot exceed 1000 characters.");
    }

    if (action === "reject") {
      const application = await Application.findOne({ applicationId }).exec();
      if (!application) {
        return apiResponse(
          { success: false, code: "APPLICATION_NOT_FOUND", message: "Application not found." },
          404,
        );
      }
      if (application.status === "approved") {
        return apiResponse(
          {
            success: false,
            code: "APPLICATION_ALREADY_APPROVED",
            message: "An approved application cannot be rejected.",
          },
          409,
        );
      }

      application.status = "rejected";
      // Persist the reason when the schema supports this field.
      if ("adminRejectionReason" in application) {
        (application as typeof application & { adminRejectionReason?: string }).adminRejectionReason =
          reason;
      }
      await application.save();

      return apiResponse({
        success: true,
        message: "Application rejected successfully.",
        data: {
          applicationId: application.applicationId,
          status: application.status,
          rejectionReason: reason || null,
          updatedBy: admin.id,
        },
      });
    }

    if (action === "resend_credentials") {
      const application = await Application.findOne({ applicationId }).exec();
      if (!application) {
        return apiResponse(
          { success: false, code: "APPLICATION_NOT_FOUND", message: "Application not found." },
          404,
        );
      }
      if (application.status !== "approved") {
        return apiResponse(
          {
            success: false,
            code: "APPLICATION_NOT_APPROVED",
            message: "Credentials can only be sent for an approved application.",
          },
          409,
        );
      }

      const student = await Student.findOne({ applicationId: application.applicationId }).exec();
      if (!student) {
        return apiResponse(
          {
            success: false,
            code: "STUDENT_NOT_FOUND",
            message: "Student account was not found for this application.",
          },
          404,
        );
      }

      const studentId = cleanString(student.studentId);
      const studentEmail = normalizeEmail(student.email);
      const studentName = cleanString(student.fullName);
      if (!studentId || !isValidEmail(studentEmail) || !studentName) {
        return apiResponse(
          {
            success: false,
            code: "STUDENT_DATA_INCOMPLETE",
            message: "Student account has incomplete credential information.",
          },
          500,
        );
      }

      const temporaryPassword = generateTemporaryPassword();
      student.loginPasswordHash = await hashPassword(temporaryPassword);
      student.credentialsGenerated = true;
      student.credentialsGeneratedAt = new Date();
      student.credentialsExpiresAt = null;
      student.loginEnabled = true;
      student.loginEnabledAt = student.loginEnabledAt || new Date();
      student.mustChangePassword = true;
      student.passwordChangedAt = null;
      student.loginAttempts = 0;
      student.accountLocked = false;
      student.lockedUntil = null;
      await student.save();

      try {
        await sendCredentialsEmail({
          studentEmail,
          studentName,
          studentId,
          password: temporaryPassword,
          internshipName:
            cleanString(application.internshipTrack) || "CyberNet Careers Internship",
        });
      } catch (emailError) {
        // Never return a password, hash, or token in an API response.
        console.error("[ADMIN APPROVAL] Resend credential email failed:", emailError);
        return apiResponse(
          {
            success: false,
            code: "CREDENTIAL_EMAIL_FAILED",
            message:
              "A new temporary password was generated, but email delivery failed. Retry Resend Credentials to generate and send another password.",
            data: {
              applicationId,
              studentId,
              email: studentEmail,
              credentialsGenerated: true,
              credentialsSent: false,
            },
          },
          502,
        );
      }

      return apiResponse({
        success: true,
        message: "Student credentials regenerated and sent successfully.",
        data: {
          applicationId,
          studentId,
          email: studentEmail,
          credentialsGenerated: true,
          credentialsSent: true,
        },
      });
    }

    // APPROVE: only application approval; never mark payment as paid or unlock dashboard.
    const temporaryPassword = generateTemporaryPassword();
    const loginPasswordHash = await hashPassword(temporaryPassword);
    const session = await mongoose.startSession();

    let createdStudentId = "";
    let createdStudentEmail = "";
    let createdStudentName = "";
    let createdInternshipTrack = "";

    try {
      await session.withTransaction(async () => {
        const application = await Application.findOne({ applicationId })
          .session(session)
          .exec();

        if (!application) {
          throw new ApprovalRouteError("APPLICATION_NOT_FOUND", "Application not found.", 404);
        }
        if (application.status === "approved") {
          throw new ApprovalRouteError(
            "APPLICATION_ALREADY_APPROVED",
            "Application is already approved. Use Resend Credentials if required.",
            409,
          );
        }
        if (application.status === "rejected") {
          throw new ApprovalRouteError(
            "APPLICATION_REJECTED",
            "A rejected application cannot be approved directly.",
            409,
          );
        }
        if (application.emailVerified !== true) {
          throw new ApprovalRouteError(
            "EMAIL_NOT_VERIFIED",
            "Student email must be verified before approval.",
            403,
          );
        }

        const email = normalizeEmail(application.email);
        const fullName = cleanString(application.fullName);
        const phone = cleanString(application.phone);
        const collegeUniversity = cleanString(application.collegeUniversity);
        const course = cleanString(application.course);
        const branchStream = cleanString(application.branchStream);
        const graduationYear = cleanString(application.graduationYear);
        const internshipTrack = cleanString(application.internshipTrack);
        const skills = Array.isArray(application.skills)
          ? application.skills.map(cleanString).filter(Boolean)
          : [];

        if (!isValidEmail(email)) {
          throw new ApprovalRouteError(
            "APPLICATION_EMAIL_INVALID",
            "A valid applicant email is required.",
            400,
          );
        }
        if (!fullName || !phone || !collegeUniversity || !course || !branchStream ||
            !graduationYear || !internshipTrack || skills.length === 0) {
          throw new ApprovalRouteError(
            "APPLICATION_DATA_INCOMPLETE",
            "Applicant profile is incomplete. Check name, phone, education, graduation year, internship domain, and skills.",
            400,
          );
        }
        if (
          application.consentTerms !== true ||
          application.consentPrivacy !== true ||
          application.consentDeclaration !== true
        ) {
          throw new ApprovalRouteError(
            "CONSENT_REQUIRED",
            "Terms, privacy, and declaration consent are required.",
            403,
          );
        }

        const existingStudent = await Student.findOne({
          $or: [{ email }, { applicationId: application.applicationId }],
        })
          .select({ _id: 1, studentId: 1 })
          .session(session)
          .lean()
          .exec();

        if (existingStudent) {
          throw new ApprovalRouteError(
            "STUDENT_ALREADY_EXISTS",
            "A student account already exists for this application or email address.",
            409,
          );
        }

        const studentId = await generateUniqueStudentId(session);
        const now = new Date();
        const adminObjectId = mongoose.isValidObjectId(admin.id)
          ? new mongoose.Types.ObjectId(admin.id)
          : undefined;

        await Student.create(
          [
            {
              applicationId: application.applicationId,
              fullName,
              email,
              emailVerified: true,
              emailVerifiedAt: application.emailVerifiedAt || now,
              phone,
              collegeName: collegeUniversity,
              university: collegeUniversity,
              course,
              branchStream,
              year: "",
              semester: "",
              cgpa: "",
              skills,
              internshipTrack,
              internshipPlan: "",
              internshipSelectionAt: null,
              internshipApplicationAllowed: false,
              internshipStatus: "locked",
              startPreference: "",
              studentId,
              loginPasswordHash,
              credentialsGenerated: true,
              credentialsGeneratedAt: now,
              credentialsExpiresAt: null,
              loginEnabled: true,
              loginEnabledAt: now,
              loginAttempts: 0,
              accountLocked: false,
              lockedUntil: null,
              mustChangePassword: true,
              passwordChangedAt: null,
              applicationStatus: "approved",
              submittedAt: application.createdAt,
              assessmentStatus: "not-started",
              assessmentScore: null,
              assessmentStartedAt: null,
              assessmentSubmittedAt: null,
              assessmentEvaluatedAt: null,
              resultDeclaredAt: null,
              resultVisibleAt: null,
              resultStatus: "pending",
              paymentStatus: "unpaid",
              paymentAmount: 0,
              paymentCurrency: "INR",
              razorpayOrderId: "",
              razorpayPaymentId: "",
              razorpaySignature: "",
              paymentCompletedAt: null,
              receiptEmailSent: false,
              adminApprovalStatus: "approved",
              adminApprovedBy: adminObjectId,
              adminApprovedAt: now,
              adminRejectionReason: "",
              approvedAt: now,
              dashboardStatus: "locked",
              dashboardActivatedAt: null,
              certificateStatus: "not-eligible",
              certificateId: "",
              whatsappJoined: false,
              consentTerms: application.consentTerms,
              consentPrivacy: application.consentPrivacy,
              consentDeclaration: application.consentDeclaration,
              consentUpdates: false,
              consentAcceptedAt: now,
              notes: "",
            },
          ],
          { session },
        );

        application.status = "approved";
        application.studentId = studentId;
        // This endpoint does not collect or approve payment.
        application.paymentStatus = "not_required";
        application.paymentId = undefined;
        application.selectedDuration = undefined;
        await application.save({ session });

        createdStudentId = studentId;
        createdStudentEmail = email;
        createdStudentName = fullName;
        createdInternshipTrack = internshipTrack;
      });
    } finally {
      await session.endSession();
    }

    // Email is sent only after the database transaction commits.
    try {
      await sendCredentialsEmail({
        studentEmail: createdStudentEmail,
        studentName: createdStudentName,
        studentId: createdStudentId,
        password: temporaryPassword,
        internshipName: createdInternshipTrack,
      });
    } catch (emailError) {
      console.error("[ADMIN APPROVAL] Credential email failed:", emailError);
      return apiResponse(
        {
          success: false,
          code: "CREDENTIAL_EMAIL_FAILED",
          message:
            "Application approved and student account created, but credential email delivery failed. Use Resend Credentials.",
          data: {
            applicationId,
            studentId: createdStudentId,
            email: createdStudentEmail,
            applicationStatus: "approved",
            credentialsGenerated: true,
            credentialsSent: false,
            paymentStatus: "unpaid",
            internshipStatus: "locked",
            dashboardStatus: "locked",
          },
        },
        502,
      );
    }

    return apiResponse(
      {
        success: true,
        message: "Application approved, student account created, and credentials emailed.",
        data: {
          applicationId,
          studentId: createdStudentId,
          email: createdStudentEmail,
          fullName: createdStudentName,
          internshipTrack: createdInternshipTrack,
          applicationStatus: "approved",
          loginEnabled: true,
          credentialsGenerated: true,
          credentialsSent: true,
          assessmentStatus: "not-started",
          internshipApplicationAllowed: false,
          internshipStatus: "locked",
          paymentStatus: "unpaid",
          dashboardStatus: "locked",
          nextStep: "Student logs in and completes the selected-domain assessment.",
        },
      },
      201,
    );
  } catch (error) {
    return errorResponse(error, "POST");
  }
}

/**
 * PATCH /api/admin/approval
 * Allowed status transitions: pending, under_review, rejected.
 * Approval must use POST { action: "approve", applicationId }.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) {
    return apiResponse(
      { success: false, code: "UNAUTHORIZED", message: "Admin login required." },
      401,
    );
  }

  try {
    await connectDB();
    const body = await readJsonObject(request);
    if (!body) return validationError("INVALID_BODY", "Request body must be a valid JSON object.");

    const applicationId = cleanString(body.applicationId);
    const status = cleanString(body.status).toLowerCase();
    const reason = cleanString(body.reason);

    if (!applicationId) {
      return validationError("APPLICATION_ID_REQUIRED", "Application ID is required.");
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return validationError("INVALID_REASON", "Reason cannot exceed 1000 characters.");
    }
    if (!["pending", "under_review", "rejected"].includes(status)) {
      return validationError(
        "INVALID_STATUS",
        "Use pending, under_review, or rejected. Use POST action approve for approval.",
      );
    }

    const application = await Application.findOne({ applicationId }).exec();
    if (!application) {
      return apiResponse(
        { success: false, code: "APPLICATION_NOT_FOUND", message: "Application not found." },
        404,
      );
    }
    if (application.status === "approved") {
      return apiResponse(
        {
          success: false,
          code: "APPLICATION_ALREADY_APPROVED",
          message: "Approved applications cannot be moved back to another status.",
        },
        409,
      );
    }

    application.status = status as "pending" | "under_review" | "rejected";
    if ("adminRejectionReason" in application && status === "rejected") {
      (application as typeof application & { adminRejectionReason?: string }).adminRejectionReason =
        reason;
    }
    await application.save();

    return apiResponse({
      success: true,
      message: "Application status updated successfully.",
      data: {
        applicationId: application.applicationId,
        status: application.status,
        rejectionReason: status === "rejected" ? reason || null : null,
        updatedBy: admin.id,
      },
    });
  } catch (error) {
    return errorResponse(error, "PATCH");
  }
}
