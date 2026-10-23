import crypto from "node:crypto";

import ApplicationModel from "@/models/Application";
import connectDB from "@/lib/db";

import {
  sendEmailVerificationEmail,
} from "@/services/email.service";

import {
  approveApplication as approveStudentApplication,
  rejectApplication as rejectStudentApplication,
  resendCredentials as resendStudentCredentials,
  type ServiceResult,
  type StudentActor,
} from "@/services/student.service";

/* ============================================================
   CYBERNET CAREERS
   APPLICATION SERVICE
   ============================================================

   RESPONSIBILITY

   Public Application
          ↓
   Email Verification
          ↓
   Application Submission
          ↓
   Main Admin Review
          ↓
      Approved / Rejected
          ↓
   Student Service
          ↓
   Main Student Credentials
          ↓
   Student Login
          ↓
   Assessment
          ↓
   Internship
          ↓
   Payment
          ↓
   Student Operations

   IMPORTANT

   - This service owns APPLICATION lifecycle only.
   - Student lifecycle belongs to student.service.ts.
   - Payment lifecycle belongs to payment.service.ts.
   - Authentication belongs to auth.service.ts.
   - Email delivery belongs to email.service.ts.
   - Client supplied approval state is never trusted.
   - Verification secrets are never stored in MongoDB.
   - Verification tokens are signed server-side.
   - Plain passwords are never handled here.
   - Student creation is never duplicated here.
   ============================================================ */

/* ============================================================
   CONSTANTS
   ============================================================ */

const APPLICATION_ID_PREFIX = "CN-APP";
const APPLICATION_ID_RANDOM_LENGTH = 10;
const APPLICATION_ID_ATTEMPTS = 40;

const VERIFICATION_TOKEN_TTL_SECONDS = 30 * 60;
const MAX_TOKEN_LENGTH = 4000;

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 30;
const MAX_FIELD_LENGTH = 250;
const MAX_TEXT_LENGTH = 500;
const MAX_REASON_LENGTH = 1000;
const MAX_SEARCH_LENGTH = 120;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/* ============================================================
   TYPES
   ============================================================ */

export interface ApplicationActor {
  id: string;
  role?: string;
}

export interface CreateApplicationInput {
  fullName: string;
  email: string;
  phone?: string;

  collegeUniversity?: string;
  course?: string;
  branchStream?: string;
  graduationYear?: string;

  internshipTrack?: string;

  consentTerms?: boolean;
  consentPrivacy?: boolean;
  consentDeclaration?: boolean;

  sendVerificationEmail?: boolean;
}

export interface SubmitApplicationInput {
  applicationId: string;
}

export interface VerifyApplicationEmailInput {
  token: string;
}

export interface ApproveApplicationInput {
  applicationId: string;
  actor: ApplicationActor;
  sendCredentials?: boolean;
}

export interface RejectApplicationInput {
  applicationId: string;
  actor: ApplicationActor;
  reason: string;
}

export interface ResendCredentialsInput {
  studentId: string;
  actor: StudentActor;
}

export interface ApplicationListInput {
  status?: string;
  emailVerified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ApplicationSummary {
  id: string;
  applicationId: string;

  fullName: string;
  email: string;
  phone: string;

  collegeUniversity: string;
  course: string;
  branchStream: string;
  graduationYear: string;

  internshipTrack: string;

  status: string;

  emailVerified: boolean;
  emailVerifiedAt?: Date;

  studentId?: string;

  submittedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApplicationStats {
  total: number;

  draft: number;
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;

  emailVerified: number;
  emailUnverified: number;
}

/* ============================================================
   ERROR
   ============================================================ */

export class ApplicationServiceError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(
    code: string,
    message: string,
    status = 400,
  ) {
    super(message);

    this.name = "ApplicationServiceError";
    this.code = code;
    this.status = status;

    Object.setPrototypeOf(
      this,
      ApplicationServiceError.prototype,
    );
  }
}

/* ============================================================
   DATABASE COMPATIBILITY
   ============================================================ */

const ApplicationDb = ApplicationModel as any;

/* ============================================================
   BASIC HELPERS
   ============================================================ */

function cleanString(
  value: unknown,
  maxLength = MAX_TEXT_LENGTH,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeEmail(
  value: unknown,
): string {
  return cleanString(
    value,
    MAX_EMAIL_LENGTH,
  ).toLowerCase();
}

function normalizeId(
  value: unknown,
): string {
  return cleanString(
    value,
    120,
  ).toUpperCase();
}

function normalizePhone(
  value: unknown,
): string {
  return cleanString(
    value,
    MAX_PHONE_LENGTH,
  );
}

function normalizeStatus(
  value: unknown,
): string {
  return cleanString(
    value,
    60,
  ).toLowerCase();
}

function asDatabaseRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return {};
  }

  return value as Record<string, unknown>;
}

function booleanValue(
  value: unknown,
): boolean {
  return value === true;
}

function numberValue(
  value: unknown,
  fallback = 0,
): number {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : fallback;
}

function objectIdString(
  value: unknown,
): string {
  if (!value) {
    return "";
  }

  try {
    return String(value);
  } catch {
    return "";
  }
}

function dateOrUndefined(
  value: unknown,
): Date | undefined {
  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
}

function isValidEmail(
  email: string,
): boolean {
  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}

function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function isDuplicateKeyError(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return false;
  }

  return Number(
    (error as { code?: unknown }).code,
  ) === 11000;
}

/* ============================================================
   DATABASE
   ============================================================ */

async function ensureDatabase(): Promise<void> {
  await connectDB();
}

/* ============================================================
   APPLICATION ID
   ============================================================ */

function randomApplicationPart(): string {
  return crypto
    .randomBytes(
      Math.ceil(
        APPLICATION_ID_RANDOM_LENGTH / 2,
      ),
    )
    .toString("hex")
    .slice(
      0,
      APPLICATION_ID_RANDOM_LENGTH,
    )
    .toUpperCase();
}

function createApplicationId(): string {
  const year = new Date().getFullYear();

  return [
    APPLICATION_ID_PREFIX,
    year,
    randomApplicationPart(),
  ].join("-");
}

async function generateUniqueApplicationId(): Promise<string> {
  for (
    let attempt = 0;
    attempt < APPLICATION_ID_ATTEMPTS;
    attempt += 1
  ) {
    const applicationId =
      createApplicationId();

    const exists =
      await ApplicationDb.exists({
        applicationId,
      });

    if (!exists) {
      return applicationId;
    }
  }

  throw new ApplicationServiceError(
    "APPLICATION_ID_GENERATION_FAILED",
    "Unable to generate a unique application ID.",
    500,
  );
}

/* ============================================================
   VERIFICATION SECRET
   ============================================================ */

function getVerificationSecret(): string {
  const secret =
    process.env.APPLICATION_VERIFICATION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    "";

  if (secret.length < 32) {
    throw new ApplicationServiceError(
      "VERIFICATION_SECRET_NOT_CONFIGURED",
      "Application verification secret is not configured correctly.",
      500,
    );
  }

  return secret;
}

/* ============================================================
   BASE64URL
   ============================================================ */

function base64UrlEncode(
  value: string,
): string {
  return Buffer
    .from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(
  value: string,
): string {
  return Buffer
    .from(
      value
        .replace(/-/g, "+")
        .replace(/_/g, "/"),
      "base64",
    )
    .toString("utf8");
}

/* ============================================================
   VERIFICATION TOKEN
   ============================================================ */

function createVerificationToken(
  applicationId: string,
  email: string,
): string {
  const issuedAt = Math.floor(
    Date.now() / 1000,
  );

  const expiresAt =
    issuedAt +
    VERIFICATION_TOKEN_TTL_SECONDS;

  const payload = [
    normalizeId(applicationId),
    normalizeEmail(email),
    issuedAt,
    expiresAt,
  ].join(".");

  const payloadEncoded =
    base64UrlEncode(payload);

  const signature =
    crypto
      .createHmac(
        "sha256",
        getVerificationSecret(),
      )
      .update(
        payloadEncoded,
        "utf8",
      )
      .digest("base64url");

  return [
    payloadEncoded,
    signature,
  ].join(".");
}

function verifyVerificationToken(
  token: string,
): {
  applicationId: string;
  email: string;
} {
  const value = cleanString(
    token,
    MAX_TOKEN_LENGTH,
  );

  if (!value) {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  const parts = value.split(".");

  if (parts.length !== 2) {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  const [
    encodedPayload,
    signature,
  ] = parts;

  if (
    !encodedPayload ||
    !signature
  ) {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        getVerificationSecret(),
      )
      .update(
        encodedPayload,
        "utf8",
      )
      .digest("base64url");

  const receivedBuffer =
    Buffer.from(
      signature,
      "utf8",
    );

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8",
    );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  if (
    !crypto.timingSafeEqual(
      receivedBuffer,
      expectedBuffer,
    )
  ) {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  let decoded: string;

  try {
    decoded =
      base64UrlDecode(
        encodedPayload,
      );
  } catch {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  const [
    applicationId,
    email,
    issuedAtString,
    expiresAtString,
  ] = decoded.split(".");

  const issuedAt =
    Number(issuedAtString);

  const expiresAt =
    Number(expiresAtString);

  if (
    !applicationId ||
    !email ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt)
  ) {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  const now = Math.floor(
    Date.now() / 1000,
  );

  if (expiresAt <= now) {
    throw new ApplicationServiceError(
      "VERIFICATION_TOKEN_EXPIRED",
      "Email verification link has expired.",
      400,
    );
  }

  /*
   * Prevent tokens with an impossible future issue time.
   */
  if (issuedAt > now + 60) {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  /*
   * Protect against malformed lifetime values.
   */
  if (
    expiresAt <= issuedAt ||
    expiresAt - issuedAt >
      VERIFICATION_TOKEN_TTL_SECONDS
  ) {
    throw new ApplicationServiceError(
      "INVALID_VERIFICATION_TOKEN",
      "Invalid email verification token.",
      400,
    );
  }

  return {
    applicationId:
      normalizeId(applicationId),

    email:
      normalizeEmail(email),
  };
}

/* ============================================================
   VERIFICATION URL
   ============================================================ */

function getApplicationBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  return configured.replace(
    /\/+$/,
    "",
  );
}

function createVerificationUrl(
  token: string,
): string {
  return (
    `${getApplicationBaseUrl()}` +
    `/api/applications/verify-email` +
    `?token=${encodeURIComponent(token)}`
  );
}

/* ============================================================
   SANITIZATION
   ============================================================ */

function sanitizeApplication(
  application: Record<string, unknown>,
): ApplicationSummary {
  return {
    id:
      objectIdString(
        application._id,
      ),

    applicationId:
      normalizeId(
        application.applicationId,
      ),

    fullName:
      cleanString(
        application.fullName,
        MAX_NAME_LENGTH,
      ),

    email:
      normalizeEmail(
        application.email,
      ),

    phone:
      normalizePhone(
        application.phone,
      ),

    collegeUniversity:
      cleanString(
        application.collegeUniversity,
        MAX_FIELD_LENGTH,
      ),

    course:
      cleanString(
        application.course,
        MAX_FIELD_LENGTH,
      ),

    branchStream:
      cleanString(
        application.branchStream,
        MAX_FIELD_LENGTH,
      ),

    graduationYear:
      cleanString(
        application.graduationYear,
        30,
      ),

    internshipTrack:
      cleanString(
        application.internshipTrack,
        MAX_FIELD_LENGTH,
      ),

    status:
      normalizeStatus(
        application.status,
      ),

    emailVerified:
      booleanValue(
        application.emailVerified,
      ),

    emailVerifiedAt:
      dateOrUndefined(
        application.emailVerifiedAt,
      ),

    studentId:
      cleanString(
        application.studentId,
        100,
      ) || undefined,

    submittedAt:
      dateOrUndefined(
        application.submittedAt,
      ),

    createdAt:
      dateOrUndefined(
        application.createdAt,
      ),

    updatedAt:
      dateOrUndefined(
        application.updatedAt,
      ),
  };
}

/* ============================================================
   ACTOR AUTHORIZATION
   ============================================================ */

function requireActor(
  actor: ApplicationActor | undefined,
): ApplicationActor {
  if (
    !actor ||
    !cleanString(
      actor.id,
      200,
    )
  ) {
    throw new ApplicationServiceError(
      "UNAUTHORIZED",
      "Authenticated administrator is required.",
      401,
    );
  }

  return {
    id:
      cleanString(
        actor.id,
        200,
      ),

    role:
      cleanString(
        actor.role,
        100,
      ),
  };
}

function isMainAdminRole(
  role: string | undefined,
): boolean {
  const normalized =
    cleanString(
      role,
      100,
    ).toLowerCase();

  return [
    "super admin",
    "admin",
    "main admin",
    "main_admin",
    "super_admin",
    "superadmin",
  ].includes(
    normalized,
  );
}

function requireMainAdmin(
  actor: ApplicationActor | undefined,
): ApplicationActor {
  const safeActor =
    requireActor(actor);

  if (
    !isMainAdminRole(
      safeActor.role,
    )
  ) {
    throw new ApplicationServiceError(
      "FORBIDDEN",
      "Main Admin permission is required.",
      403,
    );
  }

  return safeActor;
}

/* ============================================================
   CREATE APPLICATION
   ============================================================ */

export async function createApplication(
  input: CreateApplicationInput,
): Promise<
  ServiceResult<{
    application: ApplicationSummary;
    verificationRequired: boolean;
  }>
> {
  try {
    await ensureDatabase();

    const fullName =
      cleanString(
        input?.fullName,
        MAX_NAME_LENGTH,
      );

    const email =
      normalizeEmail(
        input?.email,
      );

    const phone =
      normalizePhone(
        input?.phone,
      );

    if (fullName.length < 2) {
      return {
        success: false,
        message:
          "Full name is required.",
        code:
          "INVALID_FULL_NAME",
      };
    }

    if (!isValidEmail(email)) {
      return {
        success: false,
        message:
          "A valid email address is required.",
        code:
          "INVALID_EMAIL",
      };
    }

    if (
      !input?.consentTerms ||
      !input?.consentPrivacy ||
      !input?.consentDeclaration
    ) {
      return {
        success: false,
        message:
          "Terms, privacy and declaration consent are required.",
        code:
          "CONSENT_REQUIRED",
      };
    }

    /*
     * Prevent duplicate active applications.
     *
     * Historical rejected/expired applications
     * are allowed to remain as history.
     */
    const existing =
      await ApplicationDb
        .findOne({
          email,
        })
        .sort({
          createdAt: -1,
        })
        .exec();

    if (existing) {
      const existingRecord =
        asDatabaseRecord(
          existing.toObject(),
        );

      const existingStatus =
        normalizeStatus(
          existingRecord.status,
        );

      if (
        existingStatus === "approved" ||
        existingStatus === "pending" ||
        existingStatus === "submitted"
      ) {
        return {
          success: false,
          message:
            "An application already exists for this email address.",
          code:
            "APPLICATION_ALREADY_EXISTS",
          data: {
            application:
              sanitizeApplication(
                existingRecord,
              ),
            verificationRequired:
              existingRecord.emailVerified !==
              true,
          },
        };
      }

      if (
        existingStatus === "draft" &&
        existingRecord.emailVerified !== true
      ) {
        return {
          success: false,
          message:
            "A draft application already exists for this email address. Please verify your email or request verification again.",
          code:
            "APPLICATION_ALREADY_EXISTS",
          data: {
            application:
              sanitizeApplication(
                existingRecord,
              ),
            verificationRequired: true,
          },
        };
      }

      /*
       * Rejected and expired applications can
       * be replaced by a new application.
       */
    }

    const applicationId =
      await generateUniqueApplicationId();

    const now = new Date();

    const application =
      new ApplicationDb({
        applicationId,

        fullName,

        email,

        phone,

        collegeUniversity:
          cleanString(
            input?.collegeUniversity,
            MAX_FIELD_LENGTH,
          ),

        course:
          cleanString(
            input?.course,
            MAX_FIELD_LENGTH,
          ),

        branchStream:
          cleanString(
            input?.branchStream,
            MAX_FIELD_LENGTH,
          ),

        graduationYear:
          cleanString(
            input?.graduationYear,
            30,
          ),

        internshipTrack:
          cleanString(
            input?.internshipTrack,
            MAX_FIELD_LENGTH,
          ),

        status:
          "draft",

        emailVerified:
          false,

        emailVerifiedAt:
          null,

        consentTerms:
          true,

        consentPrivacy:
          true,

        consentDeclaration:
          true,

        consentAcceptedAt:
          now,

        studentId:
          "",

        createdAt:
          now,

        updatedAt:
          now,
      });

    await application.save();

    const verificationRequired =
      true;

    /*
     * Email sending is intentionally outside the
     * database save operation.
     *
     * A provider failure must never silently delete
     * a valid application.
     */
    if (
      input?.sendVerificationEmail !== false
    ) {
      const token =
        createVerificationToken(
          applicationId,
          email,
        );

      const verificationUrl =
        createVerificationUrl(
          token,
        );

      try {
        await sendEmailVerificationEmail({
          email,
          name: fullName,
          verificationUrl,
          expiresInMinutes: 30,
        });
      } catch (emailError) {
        console.error(
          "[ApplicationService] Verification email failed:",
          emailError,
        );

        return {
          success: true,
          message:
            "Application created, but the verification email could not be sent. Please request verification again.",
          code:
            "VERIFICATION_EMAIL_FAILED",
          data: {
            application:
              sanitizeApplication(
                asDatabaseRecord(
                  application.toObject(),
                ),
              ),
            verificationRequired,
          },
        };
      }
    }

    return {
      success: true,
      message:
        "Application created successfully. Please verify your email.",
      code:
        "APPLICATION_CREATED",
      data: {
        application:
          sanitizeApplication(
            asDatabaseRecord(
              application.toObject(),
            ),
          ),
        verificationRequired,
      },
    };
  } catch (error) {
    return handleApplicationError<{
      application: ApplicationSummary;
      verificationRequired: boolean;
    }>(
      "[ApplicationService] createApplication",
      error,
    );
  }
}

/* ============================================================
   SUBMIT APPLICATION
   ============================================================ */

export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<
  ServiceResult<ApplicationSummary>
> {
  try {
    await ensureDatabase();

    const applicationId =
      normalizeId(
        input?.applicationId,
      );

    if (!applicationId) {
      return {
        success: false,
        message:
          "Application ID is required.",
        code:
          "INVALID_APPLICATION_ID",
      };
    }

    const application =
      await ApplicationDb
        .findOne({
          applicationId,
        })
        .exec();

    if (!application) {
      return {
        success: false,
        message:
          "Application was not found.",
        code:
          "APPLICATION_NOT_FOUND",
      };
    }

    if (
      application.emailVerified !== true
    ) {
      return {
        success: false,
        message:
          "Please verify your email before submitting the application.",
        code:
          "EMAIL_NOT_VERIFIED",
      };
    }

    const status =
      normalizeStatus(
        application.status,
      );

    if (status === "approved") {
      return {
        success: false,
        message:
          "Application is already approved.",
        code:
          "APPLICATION_ALREADY_APPROVED",
      };
    }

    if (status === "rejected") {
      return {
        success: false,
        message:
          "Application is already rejected.",
        code:
          "APPLICATION_ALREADY_REJECTED",
      };
    }

    if (status === "submitted") {
      return {
        success: true,
        message:
          "Application has already been submitted and is awaiting review.",
        code:
          "APPLICATION_ALREADY_SUBMITTED",
        data:
          sanitizeApplication(
            asDatabaseRecord(
              application.toObject(),
            ),
          ),
      };
    }

    if (
      status !== "draft" &&
      status !== "pending"
    ) {
      return {
        success: false,
        message:
          "Application is not in a valid submission state.",
        code:
          "INVALID_APPLICATION_STATE",
      };
    }

    if (
      !application.consentTerms ||
      !application.consentPrivacy ||
      !application.consentDeclaration
    ) {
      return {
        success: false,
        message:
          "Required consent is missing.",
        code:
          "CONSENT_REQUIRED",
      };
    }

    const now = new Date();

    application.status =
      "submitted";

    application.submittedAt =
      now;

    application.updatedAt =
      now;

    await application.save();

    return {
      success: true,
      message:
        "Application submitted successfully.",
      code:
        "APPLICATION_SUBMITTED",
      data:
        sanitizeApplication(
          asDatabaseRecord(
            application.toObject(),
          ),
        ),
    };
  } catch (error) {
    return handleApplicationError<ApplicationSummary>(
      "[ApplicationService] submitApplication",
      error,
    );
  }
}

/* ============================================================
   VERIFY EMAIL
   ============================================================ */

export async function verifyApplicationEmail(
  input: VerifyApplicationEmailInput,
): Promise<
  ServiceResult<ApplicationSummary>
> {
  try {
    await ensureDatabase();

    const verified =
      verifyVerificationToken(
        input?.token,
      );

    const application =
      await ApplicationDb
        .findOne({
          applicationId:
            verified.applicationId,
        })
        .exec();

    if (!application) {
      return {
        success: false,
        message:
          "Application was not found.",
        code:
          "APPLICATION_NOT_FOUND",
      };
    }

    const applicationEmail =
      normalizeEmail(
        application.email,
      );

    if (
      applicationEmail !==
      verified.email
    ) {
      return {
        success: false,
        message:
          "Verification token does not match the application.",
        code:
          "VERIFICATION_EMAIL_MISMATCH",
      };
    }

    if (
      application.emailVerified === true
    ) {
      return {
        success: true,
        message:
          "Email is already verified.",
        code:
          "EMAIL_ALREADY_VERIFIED",
        data:
          sanitizeApplication(
            asDatabaseRecord(
              application.toObject(),
            ),
          ),
      };
    }

    const currentStatus =
      normalizeStatus(
        application.status,
      );

    if (currentStatus === "approved") {
      return {
        success: true,
        message:
          "Email is already associated with an approved application.",
        code:
          "EMAIL_ALREADY_VERIFIED",
        data:
          sanitizeApplication(
            asDatabaseRecord(
              application.toObject(),
            ),
          ),
      };
    }

    if (currentStatus === "rejected") {
      return {
        success: false,
        message:
          "This application has already been rejected.",
        code:
          "APPLICATION_REJECTED",
      };
    }

    application.emailVerified =
      true;

    application.emailVerifiedAt =
      new Date();

    /*
     * Email verification moves an untouched draft
     * into pending review.
     */
    if (currentStatus === "draft") {
      application.status =
        "pending";
    }

    application.updatedAt =
      new Date();

    await application.save();

    return {
      success: true,
      message:
        "Email verified successfully. Your application is now ready for review.",
      code:
        "EMAIL_VERIFIED",
      data:
        sanitizeApplication(
          asDatabaseRecord(
            application.toObject(),
          ),
        ),
    };
  } catch (error) {
    return handleApplicationError<ApplicationSummary>(
      "[ApplicationService] verifyApplicationEmail",
      error,
    );
  }
}

/* ============================================================
   RESEND VERIFICATION EMAIL
   ============================================================ */

export async function resendVerificationEmail(
  applicationId: string,
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const id =
      normalizeId(
        applicationId,
      );

    if (!id) {
      return {
        success: false,
        message:
          "Application ID is required.",
        code:
          "INVALID_APPLICATION_ID",
      };
    }

    const application =
      await ApplicationDb
        .findOne({
          applicationId: id,
        })
        .exec();

    if (!application) {
      return {
        success: false,
        message:
          "Application was not found.",
        code:
          "APPLICATION_NOT_FOUND",
      };
    }

    if (
      application.emailVerified === true
    ) {
      return {
        success: true,
        message:
          "Email is already verified.",
        code:
          "EMAIL_ALREADY_VERIFIED",
      };
    }

    const status =
      normalizeStatus(
        application.status,
      );

    if (status === "approved") {
      return {
        success: false,
        message:
          "This application has already been approved.",
        code:
          "APPLICATION_ALREADY_APPROVED",
      };
    }

    if (status === "rejected") {
      return {
        success: false,
        message:
          "This application has already been rejected.",
        code:
          "APPLICATION_REJECTED",
      };
    }

    const email =
      normalizeEmail(
        application.email,
      );

    const token =
      createVerificationToken(
        application.applicationId,
        email,
      );

    const verificationUrl =
      createVerificationUrl(
        token,
      );

    try {
      await sendEmailVerificationEmail({
        email,
        name:
          cleanString(
            application.fullName,
            MAX_NAME_LENGTH,
          ),
        verificationUrl,
        expiresInMinutes: 30,
      });

      return {
        success: true,
        message:
          "Verification email sent successfully.",
        code:
          "VERIFICATION_EMAIL_SENT",
      };
    } catch (emailError) {
      console.error(
        "[ApplicationService] Resend verification email failed:",
        emailError,
      );

      return {
        success: false,
        message:
          "Unable to send verification email right now.",
        code:
          "VERIFICATION_EMAIL_FAILED",
      };
    }
  } catch (error) {
    return handleApplicationError(
      "[ApplicationService] resendVerificationEmail",
      error,
    );
  }
}

/* ============================================================
   GET APPLICATION
   ============================================================ */

export async function getApplication(
  applicationId: string,
): Promise<
  ServiceResult<ApplicationSummary>
> {
  try {
    await ensureDatabase();

    const id =
      normalizeId(
        applicationId,
      );

    if (!id) {
      return {
        success: false,
        message:
          "Application ID is required.",
        code:
          "INVALID_APPLICATION_ID",
      };
    }

    const application =
      await ApplicationDb
        .findOne({
          applicationId: id,
        })
        .lean()
        .exec();

    if (!application) {
      return {
        success: false,
        message:
          "Application was not found.",
        code:
          "APPLICATION_NOT_FOUND",
      };
    }

    return {
      success: true,
      message:
        "Application loaded successfully.",
      data:
        sanitizeApplication(
          asDatabaseRecord(
            application,
          ),
        ),
    };
  } catch (error) {
    return handleApplicationError<ApplicationSummary>(
      "[ApplicationService] getApplication",
      error,
    );
  }
}

export const getApplicationById =
  getApplication;

/* ============================================================
   LIST APPLICATIONS
   ============================================================ */

export async function listApplications(
  input: ApplicationListInput = {},
): Promise<
  ServiceResult<{
    applications: ApplicationSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>
> {
  try {
    await ensureDatabase();

    const requestedPage =
      Math.floor(
        numberValue(
          input?.page,
          DEFAULT_PAGE,
        ),
      );

    const page =
      Math.max(
        DEFAULT_PAGE,
        requestedPage,
      );

    const requestedLimit =
      Math.floor(
        numberValue(
          input?.limit,
          DEFAULT_LIMIT,
        ),
      );

    const limit =
      Math.min(
        MAX_LIMIT,
        Math.max(
          1,
          requestedLimit,
        ),
      );

    const filter:
      Record<string, unknown> = {};

    const status =
      normalizeStatus(
        input?.status,
      );

    if (status) {
      filter.status =
        status;
    }

    if (
      typeof input?.emailVerified ===
      "boolean"
    ) {
      filter.emailVerified =
        input.emailVerified;
    }

    const search =
      cleanString(
        input?.search,
        MAX_SEARCH_LENGTH,
      );

    if (search) {
      const escaped =
        escapeRegex(search);

      const regex =
        new RegExp(
          escaped,
          "i",
        );

      filter.$or = [
        {
          applicationId:
            regex,
        },
        {
          fullName:
            regex,
        },
        {
          email:
            regex,
        },
        {
          phone:
            regex,
        },
        {
          studentId:
            regex,
        },
        {
          internshipTrack:
            regex,
        },
      ];
    }

    const skip =
      (page - 1) *
      limit;

    const [
      applications,
      total,
    ] = await Promise.all([
      ApplicationDb
        .find(filter)
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      ApplicationDb
        .countDocuments(filter)
        .exec(),
    ]);

    const sanitized =
      (applications as unknown[])
        .map(
          (
            application: unknown,
          ) =>
            sanitizeApplication(
              asDatabaseRecord(
                application,
              ),
            ),
        );

    return {
      success: true,
      message:
        "Applications loaded successfully.",
      data: {
        applications:
          sanitized,

        total,

        page,

        limit,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  } catch (error) {
    return handleApplicationError<{
      applications: ApplicationSummary[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(
      "[ApplicationService] listApplications",
      error,
    );
  }
}

/* ============================================================
   APPLICATION STATISTICS
   ============================================================ */

export async function getApplicationStats():
  Promise<
    ServiceResult<ApplicationStats>
  > {
  try {
    await ensureDatabase();

    const [
      total,
      draft,
      submitted,
      pending,
      approved,
      rejected,
      expired,
      emailVerified,
      emailUnverified,
    ] = await Promise.all([
      ApplicationDb
        .countDocuments({})
        .exec(),

      ApplicationDb
        .countDocuments({
          status: "draft",
        })
        .exec(),

      ApplicationDb
        .countDocuments({
          status: "submitted",
        })
        .exec(),

      ApplicationDb
        .countDocuments({
          status: "pending",
        })
        .exec(),

      ApplicationDb
        .countDocuments({
          status: "approved",
        })
        .exec(),

      ApplicationDb
        .countDocuments({
          status: "rejected",
        })
        .exec(),

      ApplicationDb
        .countDocuments({
          status: "expired",
        })
        .exec(),

      ApplicationDb
        .countDocuments({
          emailVerified: true,
        })
        .exec(),

      ApplicationDb
        .countDocuments({
          emailVerified: {
            $ne: true,
          },
        })
        .exec(),
    ]);

    return {
      success: true,
      message:
        "Application statistics loaded successfully.",
      data: {
        total,

        draft,

        submitted,

        pending,

        approved,

        rejected,

        expired,

        emailVerified,

        emailUnverified,
      },
    };
  } catch (error) {
    return handleApplicationError<ApplicationStats>(
      "[ApplicationService] getApplicationStats",
      error,
    );
  }
}

/* ============================================================
   MAIN ADMIN APPROVAL
   ============================================================

   IMPORTANT:

   This method NEVER creates student credentials itself.

   student.service.ts remains authoritative for:

   - Student account creation
   - Student ID
   - Main password
   - Credential expiry
   - Student approval
   - Credential email

   ============================================================ */

export async function approveApplication(
  input: ApproveApplicationInput,
): Promise<ServiceResult> {
  try {
    const safeActor =
      requireMainAdmin(
        input?.actor,
      );

    const applicationId =
      normalizeId(
        input?.applicationId,
      );

    if (!applicationId) {
      return {
        success: false,
        message:
          "Application ID is required.",
        code:
          "INVALID_APPLICATION_ID",
      };
    }

    await ensureDatabase();

    const application =
      await ApplicationDb
        .findOne({
          applicationId,
        })
        .lean()
        .exec();

    if (!application) {
      return {
        success: false,
        message:
          "Application was not found.",
        code:
          "APPLICATION_NOT_FOUND",
      };
    }

    const record =
      asDatabaseRecord(
        application,
      );

    const status =
      normalizeStatus(
        record.status,
      );

    if (status === "approved") {
      return {
        success: false,
        message:
          "Application is already approved. Use resend credentials if required.",
        code:
          "APPLICATION_ALREADY_APPROVED",
      };
    }

    if (status === "rejected") {
      return {
        success: false,
        message:
          "A rejected application cannot be approved directly.",
        code:
          "APPLICATION_REJECTED",
      };
    }

    if (
      record.emailVerified !== true
    ) {
      return {
        success: false,
        message:
          "Student email must be verified before approval.",
        code:
          "EMAIL_NOT_VERIFIED",
      };
    }

    if (
      status !== "pending" &&
      status !== "submitted"
    ) {
      return {
        success: false,
        message:
          "Application is not in an approvable state.",
        code:
          "INVALID_APPLICATION_STATE",
      };
    }

    const actor: StudentActor = {
      id:
        safeActor.id,

      role:
        safeActor.role,
    };

    /*
     * Student service performs the authoritative
     * transaction and creates the student account.
     */
    return await approveStudentApplication({
      applicationId,

      actor,

      sendCredentials:
        input?.sendCredentials !== false,
    });
  } catch (error) {
    return handleApplicationError(
      "[ApplicationService] approveApplication",
      error,
    );
  }
}

/* ============================================================
   REJECT APPLICATION
   ============================================================ */

export async function rejectApplication(
  input: RejectApplicationInput,
): Promise<ServiceResult> {
  try {
    const safeActor =
      requireMainAdmin(
        input?.actor,
      );

    const applicationId =
      normalizeId(
        input?.applicationId,
      );

    const reason =
      cleanString(
        input?.reason,
        MAX_REASON_LENGTH,
      );

    if (!applicationId) {
      return {
        success: false,
        message:
          "Application ID is required.",
        code:
          "INVALID_APPLICATION_ID",
      };
    }

    if (reason.length < 3) {
      return {
        success: false,
        message:
          "A valid rejection reason is required.",
        code:
          "REJECTION_REASON_REQUIRED",
      };
    }

    await ensureDatabase();

    const application =
      await ApplicationDb
        .findOne({
          applicationId,
        })
        .exec();

    if (!application) {
      return {
        success: false,
        message:
          "Application was not found.",
        code:
          "APPLICATION_NOT_FOUND",
      };
    }

    const currentStatus =
      normalizeStatus(
        application.status,
      );

    if (
      currentStatus === "approved"
    ) {
      return {
        success: false,
        message:
          "An approved application cannot be rejected.",
        code:
          "APPLICATION_ALREADY_APPROVED",
      };
    }

    if (
      currentStatus === "rejected"
    ) {
      return {
        success: false,
        message:
          "Application is already rejected.",
        code:
          "APPLICATION_ALREADY_REJECTED",
      };
    }

    if (
      application.emailVerified !== true
    ) {
      return {
        success: false,
        message:
          "Student email must be verified before application review.",
        code:
          "EMAIL_NOT_VERIFIED",
      };
    }

    if (
      currentStatus !== "pending" &&
      currentStatus !== "submitted"
    ) {
      return {
        success: false,
        message:
          "Application is not in a reviewable state.",
        code:
          "INVALID_APPLICATION_STATE",
      };
    }

    const actor: StudentActor = {
      id:
        safeActor.id,

      role:
        safeActor.role,
    };

    const result =
      await rejectStudentApplication({
        applicationId,

        actor,

        reason,
      });

    /*
     * Student service remains authoritative for
     * the rejection state transition.
     *
     * This application-level metadata is only audit
     * information and never overrides student service.
     */
    if (result.success) {
      try {
        await ApplicationDb
          .updateOne(
            {
              applicationId,
            },
            {
              $set: {
                rejectionReason:
                  reason,

                rejectedAt:
                  new Date(),

                rejectedBy:
                  actor.id,

                updatedAt:
                  new Date(),
              },
            },
          )
          .exec();
      } catch (auditError) {
        console.error(
          "[ApplicationService] Rejection audit update failed:",
          auditError,
        );
      }
    }

    return result;
  } catch (error) {
    return handleApplicationError(
      "[ApplicationService] rejectApplication",
      error,
    );
  }
}

/* ============================================================
   RESEND MAIN STUDENT CREDENTIALS
   ============================================================ */

export async function resendCredentials(
  input: ResendCredentialsInput,
): Promise<ServiceResult> {
  try {
    const safeActor =
      requireMainAdmin(
        input?.actor,
      );

    const studentId =
      normalizeId(
        input?.studentId,
      );

    if (!studentId) {
      return {
        success: false,
        message:
          "Student ID is required.",
        code:
          "INVALID_STUDENT_ID",
      };
    }

    const actor: StudentActor = {
      id:
        safeActor.id,

      role:
        safeActor.role,
    };

    return await resendStudentCredentials({
      studentId,

      actor,
    });
  } catch (error) {
    return handleApplicationError(
      "[ApplicationService] resendCredentials",
      error,
    );
  }
}

/* ============================================================
   APPLICATION STATUS
   ============================================================ */

export async function getApplicationStatus(
  applicationId: string,
): Promise<
  ServiceResult<{
    applicationId: string;
    status: string;
    emailVerified: boolean;
    studentId?: string;
  }>
> {
  try {
    await ensureDatabase();

    const id =
      normalizeId(
        applicationId,
      );

    if (!id) {
      return {
        success: false,
        message:
          "Application ID is required.",
        code:
          "INVALID_APPLICATION_ID",
      };
    }

    const application =
      await ApplicationDb
        .findOne({
          applicationId: id,
        })
        .select(
          "applicationId status emailVerified emailVerifiedAt studentId",
        )
        .lean()
        .exec();

    if (!application) {
      return {
        success: false,
        message:
          "Application was not found.",
        code:
          "APPLICATION_NOT_FOUND",
      };
    }

    return {
      success: true,
      message:
        "Application status loaded successfully.",
      data: {
        applicationId:
          normalizeId(
            application.applicationId,
          ),

        status:
          normalizeStatus(
            application.status,
          ),

        emailVerified:
          application.emailVerified ===
          true,

        studentId:
          cleanString(
            application.studentId,
            100,
          ) || undefined,
      },
    };
  } catch (error) {
    return handleApplicationError<{
      applicationId: string;
      status: string;
      emailVerified: boolean;
      studentId?: string;
    }>(
      "[ApplicationService] getApplicationStatus",
      error,
    );
  }
}

/* ============================================================
   GENERIC ERROR HANDLER
   ============================================================ */

function handleApplicationError<
  T = unknown,
>(
  context: string,
  error: unknown,
): ServiceResult<T> {
  if (
    error instanceof
    ApplicationServiceError
  ) {
    return {
      success: false,
      message:
        error.message,
      code:
        error.code,
    };
  }

  if (
    isDuplicateKeyError(
      error,
    )
  ) {
    console.error(
      context,
      error,
    );

    return {
      success: false,
      message:
        "A duplicate application already exists.",
      code:
        "DUPLICATE_APPLICATION",
    };
  }

  console.error(
    context,
    error,
  );

  return {
    success: false,
    message:
      "Unable to process application request right now. Please try again later.",
    code:
      "INTERNAL_SERVER_ERROR",
  };
}

/* ============================================================
   DEFAULT EXPORT
   ============================================================ */

const applicationService = {
  createApplication,

  submitApplication,

  verifyApplicationEmail,

  resendVerificationEmail,

  getApplication,

  getApplicationById,

  getApplicationStatus,

  listApplications,

  getApplicationStats,

  approveApplication,

  rejectApplication,

  resendCredentials,
};

export default applicationService;