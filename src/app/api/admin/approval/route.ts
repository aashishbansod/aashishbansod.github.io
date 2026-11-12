import "server-only";

import { NextRequest, NextResponse } from "next/server";
import mongoose, { type ClientSession } from "mongoose";
import crypto from "node:crypto";
import connectDB from "@/lib/db";
import Admin from "@/models/Admin";
import Application from "@/models/Application";
import Student from "@/models/Student";
import {
  hashPassword,
  verifyAuthToken,
  type AuthUser,
} from "@/lib/auth";
import { sendStudentCredentialsEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_COOKIE_NAME = "cybernet_admin_auth_token";
const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const MAX_APPLICATION_ID_LENGTH = 50;
const STUDENT_PASSWORD_LENGTH = 14;
const MAX_REASON_LENGTH = 1000;
const MAX_PAGE = 10000;
const MAX_LIMIT = 100;
const APPLICATION_STATUSES = ["pending", "under_review", "approved", "rejected"] as const;
const APPROVAL_ROLES = new Set(["Super Admin", "Admin", "HR"]);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SYMBOLS = "@#$%&*!";

type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
type ApprovalAction = "approve" | "reject" | "resend_credentials";

type AuthenticatedAdmin = {
  id: string;
  role: string;
  email: string;
};

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
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Robots-Tag": "noindex, nofollow",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      Vary: "Cookie",
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
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidApplicationId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_APPLICATION_ID_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function hasValidMutationOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

async function getAuthenticatedAdmin(
  request: NextRequest,
): Promise<AuthenticatedAdmin | null> {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const session = await verifyAuthToken(token);
    if (
      !session ||
      session.role !== "admin" ||
      session.sessionType !== "admin" ||
      !session.id ||
      !mongoose.isValidObjectId(session.id)
    ) {
      return null;
    }

    await connectDB();

    const admin = await Admin.findById(session.id)
      .select("email role isActive isEmailVerified security permissions")
      .lean()
      .exec();

    if (
      !admin ||
      admin.isActive !== true ||
      admin.isEmailVerified !== true ||
      !APPROVAL_ROLES.has(admin.role) ||
      session.adminRole !== admin.role ||
      admin.permissions?.applications !== true
    ) {
      return null;
    }

    const lockedUntil = admin.security?.lockedUntil
      ? new Date(admin.security.lockedUntil)
      : null;
    const isLocked =
      admin.security?.accountLocked === true &&
      (!lockedUntil || lockedUntil.getTime() > Date.now());

    if (isLocked) return null;

    return {
      id: String(admin._id),
      role: admin.role,
      email: admin.email,
    };
  } catch (error) {
    console.error("[ADMIN_APPROVAL] Authentication check failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}

function generateStudentId(): string {
  return `CN-${new Date().getFullYear()}-${crypto.randomInt(100000, 1000000)}`;
}

async function generateUniqueStudentId(session: ClientSession): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const studentId = generateStudentId();
    const existing = await Student.findOne({ studentId })
      .select({ _id: 1 })
      .session(session)
      .lean()
      .exec();

    if (!existing) return studentId;
  }

  throw new ApprovalRouteError(
    "STUDENT_ID_GENERATION_FAILED",
    "Unable to generate a unique student ID. Please try again.",
    503,
  );
}

function generateTemporaryPassword(): string {
  const characters: string[] = [];

  for (let index = 0; index < STUDENT_PASSWORD_LENGTH - 3; index += 1) {
    characters.push(ALPHABET[crypto.randomInt(0, ALPHABET.length)]);
  }

  characters.push(SYMBOLS[crypto.randomInt(0, SYMBOLS.length)]);
  characters.push(String(crypto.randomInt(0, 10)));
  characters.push(ALPHABET[crypto.randomInt(0, ALPHABET.length)]);

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}

async function readJsonObject(
  request: NextRequest,
): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BODY_BYTES
  ) {
    return null;
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return null;
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BODY_BYTES) {
    return null;
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  return body as Record<string, unknown>;
}

function validationError(
  code: string,
  message: string,
  status = 400,
): NextResponse {
  return apiResponse({ success: false, code, message }, status);
}

function publicApplication(
  application: Record<string, unknown>,
): Record<string, unknown> {
  const sensitiveKey =
    /(password|passwd|otp|token|secret|reset.?key|verification.?code|api.?key|credential|signature)/i;

  const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== "object" || value instanceof Date) {
      return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
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
      {
        success: false,
        code: error.code,
        message: error.message,
      },
      error.status,
    );
  }

  if (isDuplicateKeyError(error)) {
    return apiResponse(
      {
        success: false,
        code: "DUPLICATE_RECORD",
        message:
          "A student account or application with this email or ID already exists.",
      },
      409,
    );
  }

  const value = error as {
    name?: unknown;
    code?: unknown;
    codeName?: unknown;
    message?: unknown;
  };

  console.error(`[ADMIN_APPROVAL] ${operation} failed`, {
    name: typeof value?.name === "string" ? value.name : "UnknownError",
    code:
      typeof value?.code === "string" || typeof value?.code === "number"
        ? String(value.code)
        : undefined,
    codeName:
      typeof value?.codeName === "string" ? value.codeName : undefined,
  });

  if (
    value?.code === 20 ||
    value?.codeName === "IllegalOperation" ||
    (typeof value?.message === "string" &&
      /transaction numbers are only allowed|replica set|mongos/i.test(value.message))
  ) {
    return apiResponse(
      {
        success: false,
        code: "TRANSACTIONS_NOT_SUPPORTED",
        message:
          "The main MongoDB deployment must support transactions. Configure MongoDB Atlas or a replica set, then retry.",
      },
      503,
    );
  }

  return apiResponse(
    {
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to process the request. Please try again.",
    },
    500,
  );
}

async function requireAdmin(
  request: NextRequest,
): Promise<AuthenticatedAdmin | NextResponse> {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) {
    return apiResponse(
      {
        success: false,
        code: "UNAUTHORIZED",
        message:
          "A valid, active, verified admin session with application permission is required.",
      },
      401,
    );
  }
  return admin;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    await connectDB();

    const params = request.nextUrl.searchParams;
    const requestedStatus = cleanString(params.get("status")).toLowerCase();

    if (
      requestedStatus &&
      !APPLICATION_STATUSES.includes(requestedStatus as ApplicationStatus)
    ) {
      return validationError(
        "INVALID_STATUS",
        "Unsupported application status.",
      );
    }

    const requestedPage = Number(params.get("page") ?? 1);
    const requestedLimit = Number(params.get("limit") ?? 50);

    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, MAX_PAGE)
        : 1;
    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_LIMIT)
        : 50;

    const filter: Record<string, unknown> = {};
    if (requestedStatus) filter.status = requestedStatus;

    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      Application.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Application.countDocuments(filter).exec(),
    ]);

    const data = documents.map((document) =>
      publicApplication(document as unknown as Record<string, unknown>),
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasValidMutationOrigin(request)) {
    return validationError(
      "INVALID_ORIGIN",
      "Request origin is not allowed.",
      403,
    );
  }

  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    await connectDB();

    const body = await readJsonObject(request);
    if (!body) {
      return validationError(
        "INVALID_BODY",
        "Request body must be a valid JSON object within the allowed size.",
      );
    }

    const action = cleanString(body.action).toLowerCase() as ApprovalAction;
    const applicationId = cleanString(body.applicationId);
    const reason = cleanString(body.reason);

    if (!isValidApplicationId(applicationId)) {
      return validationError(
        "APPLICATION_ID_INVALID",
        "A valid application ID is required.",
      );
    }

    if (!["approve", "reject", "resend_credentials"].includes(action)) {
      return validationError(
        "INVALID_ACTION",
        "Use approve, reject, or resend_credentials.",
      );
    }

    if (reason.length > MAX_REASON_LENGTH) {
      return validationError(
        "INVALID_REASON",
        "Reason cannot exceed 1000 characters.",
      );
    }

    if (action === "reject") {
      const rejectionUpdate: Record<string, unknown> = {
        status: "rejected",
      };
      if (Application.schema.path("adminRejectionReason")) {
        rejectionUpdate.adminRejectionReason = reason;
      }

      const application = await Application.findOneAndUpdate(
        {
          applicationId,
          status: { $in: ["pending", "under_review"] },
        },
        { $set: rejectionUpdate },
        {
          new: true,
          runValidators: true,
        },
      )
        .lean()
        .exec();

      if (!application) {
        const current = await Application.findOne({ applicationId })
          .select("status")
          .lean()
          .exec();

        if (!current) {
          return apiResponse(
            {
              success: false,
              code: "APPLICATION_NOT_FOUND",
              message: "Application not found.",
            },
            404,
          );
        }

        return apiResponse(
          {
            success: false,
            code:
              current.status === "approved"
                ? "APPLICATION_ALREADY_APPROVED"
                : "APPLICATION_STATUS_CONFLICT",
            message:
              current.status === "approved"
                ? "An approved application cannot be rejected."
                : "The application status changed. Refresh and try again.",
          },
          409,
        );
      }

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
      const application = await Application.findOne({
        applicationId,
        status: "approved",
      })
        .select("applicationId internshipTrack")
        .lean()
        .exec();

      if (!application) {
        const exists = await Application.exists({ applicationId });
        return apiResponse(
          {
            success: false,
            code: exists
              ? "APPLICATION_NOT_APPROVED"
              : "APPLICATION_NOT_FOUND",
            message: exists
              ? "Credentials can only be sent for an approved application."
              : "Application not found.",
          },
          exists ? 409 : 404,
        );
      }

      const student = await Student.findOne({
        applicationId: application.applicationId,
      })
        .select("+loginPasswordHash")
        .exec();

      if (!student) {
        return apiResponse(
          {
            success: false,
            code: "STUDENT_NOT_FOUND",
            message:
              "Student account was not found for this approved application.",
          },
          404,
        );
      }

      const studentId = cleanString(student.studentId);
      const studentEmail = normalizeEmail(student.email);
      const studentName = cleanString(student.fullName);

      if (
        !studentId ||
        !isValidEmail(studentEmail) ||
        !studentName ||
        student.loginEnabled !== true
      ) {
        return apiResponse(
          {
            success: false,
            code: "STUDENT_DATA_INCOMPLETE",
            message:
              "Student account is incomplete or login is disabled. Review the student record before resending credentials.",
          },
          409,
        );
      }

      const temporaryPassword = generateTemporaryPassword();
      const previousHash = student.loginPasswordHash;
      const temporaryHash = await hashPassword(temporaryPassword);
      const now = new Date();

      student.loginPasswordHash = temporaryHash;
      student.credentialsGenerated = true;
      student.credentialsGeneratedAt = now;
      student.credentialsExpiresAt = null;
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
            cleanString(application.internshipTrack) ||
            "CyberNet Careers Internship",
        });
      } catch (emailError) {
        try {
          await Student.updateOne(
            {
              _id: student._id,
              loginPasswordHash: temporaryHash,
            },
            {
              $set: {
                loginPasswordHash: previousHash || "",
              },
            },
          );
        } catch (rollbackError) {
          console.error("[ADMIN_APPROVAL] Credential rollback failed", {
            name:
              rollbackError instanceof Error
                ? rollbackError.name
                : "UnknownError",
          });
        }

        console.error("[ADMIN_APPROVAL] Credential email failed", {
          name:
            emailError instanceof Error
              ? emailError.name
              : "EmailDeliveryError",
        });

        return apiResponse(
          {
            success: false,
            code: "CREDENTIAL_EMAIL_FAILED",
            message:
              "Credential email could not be delivered. The previous password was preserved when rollback succeeded. Retry after checking email configuration.",
            data: {
              applicationId,
              studentId,
              email: studentEmail,
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

    const temporaryPassword = generateTemporaryPassword();
    const loginPasswordHash = await hashPassword(temporaryPassword);
    const session = await mongoose.startSession();

    let createdStudentId = "";
    let createdStudentEmail = "";
    let createdStudentName = "";
    let createdInternshipTrack = "";

    try {
      await session.withTransaction(
        async () => {
          const application = await Application.findOne({ applicationId })
            .session(session)
            .exec();

          if (!application) {
            throw new ApprovalRouteError(
              "APPLICATION_NOT_FOUND",
              "Application not found.",
              404,
            );
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
          const collegeUniversity = cleanString(
            application.collegeUniversity,
          );
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

          if (
            !fullName ||
            !phone ||
            !collegeUniversity ||
            !course ||
            !branchStream ||
            !graduationYear ||
            !internshipTrack ||
            skills.length === 0
          ) {
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
            $or: [
              { email },
              { applicationId: application.applicationId },
            ],
          })
            .select({ _id: 1 })
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
          const adminObjectId = new mongoose.Types.ObjectId(admin.id);

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

          const applicationUpdate = await Application.updateOne(
            {
              _id: application._id,
              status: { $in: ["pending", "under_review"] },
            },
            {
              $set: {
                status: "approved",
                studentId,
              },
            },
            { session, runValidators: true },
          );

          if (applicationUpdate.modifiedCount !== 1) {
            throw new ApprovalRouteError(
              "APPLICATION_STATUS_CONFLICT",
              "The application status changed during approval. Refresh and try again.",
              409,
            );
          }

          createdStudentId = studentId;
          createdStudentEmail = email;
          createdStudentName = fullName;
          createdInternshipTrack = internshipTrack;
        },
        {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          readPreference: "primary",
        },
      );
    } finally {
      await session.endSession();
    }

    try {
      await sendCredentialsEmail({
        studentEmail: createdStudentEmail,
        studentName: createdStudentName,
        studentId: createdStudentId,
        password: temporaryPassword,
        internshipName: createdInternshipTrack,
      });
    } catch (emailError) {
      console.error("[ADMIN_APPROVAL] Initial credential email failed", {
        name:
          emailError instanceof Error
            ? emailError.name
            : "EmailDeliveryError",
      });

      return apiResponse(
        {
          success: false,
          code: "CREDENTIAL_EMAIL_FAILED",
          message:
            "Application approved and student account created, but credential email delivery failed. Use Resend Credentials after checking email configuration.",
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
        message:
          "Application approved, student account created, and credentials emailed.",
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
          nextStep:
            "Student logs in and completes the selected-domain assessment.",
        },
      },
      201,
    );
  } catch (error) {
    return errorResponse(error, "POST");
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!hasValidMutationOrigin(request)) {
    return validationError(
      "INVALID_ORIGIN",
      "Request origin is not allowed.",
      403,
    );
  }

  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;

    await connectDB();

    const body = await readJsonObject(request);
    if (!body) {
      return validationError(
        "INVALID_BODY",
        "Request body must be a valid JSON object within the allowed size.",
      );
    }

    const applicationId = cleanString(body.applicationId);
    const status = cleanString(body.status).toLowerCase();
    const reason = cleanString(body.reason);

    if (!isValidApplicationId(applicationId)) {
      return validationError(
        "APPLICATION_ID_INVALID",
        "A valid application ID is required.",
      );
    }

    if (reason.length > MAX_REASON_LENGTH) {
      return validationError(
        "INVALID_REASON",
        "Reason cannot exceed 1000 characters.",
      );
    }

    if (!["pending", "under_review", "rejected"].includes(status)) {
      return validationError(
        "INVALID_STATUS",
        "Use pending, under_review, or rejected. Use POST action approve for approval.",
      );
    }

    const statusUpdate: Record<string, unknown> = { status };
    if (
      status === "rejected" &&
      Application.schema.path("adminRejectionReason")
    ) {
      statusUpdate.adminRejectionReason = reason;
    }

    const application = await Application.findOneAndUpdate(
      {
        applicationId,
        status: { $in: ["pending", "under_review", "rejected"] },
      },
      { $set: statusUpdate },
      { new: true, runValidators: true },
    )
      .select("applicationId status")
      .lean()
      .exec();

    if (!application) {
      const current = await Application.findOne({ applicationId })
        .select("status")
        .lean()
        .exec();

      if (!current) {
        return apiResponse(
          {
            success: false,
            code: "APPLICATION_NOT_FOUND",
            message: "Application not found.",
          },
          404,
        );
      }

      return apiResponse(
        {
          success: false,
          code: "APPLICATION_STATUS_CONFLICT",
          message:
            "The application status cannot be changed through this action. Refresh and try again.",
        },
        409,
      );
    }

    return apiResponse({
      success: true,
      message: "Application status updated successfully.",
      data: {
        applicationId: application.applicationId,
        status: application.status,
        rejectionReason:
          status === "rejected" ? reason || null : null,
        updatedBy: admin.id,
      },
    });
  } catch (error) {
    return errorResponse(error, "PATCH");
  }
}
