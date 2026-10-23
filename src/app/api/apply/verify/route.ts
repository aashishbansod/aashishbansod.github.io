import { NextResponse } from "next/server";
import crypto from "node:crypto";

import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import EmailVerification from "@/models/EmailVerification";
import Internship from "@/models/Internship";

/* ============================================================================
   CYBERNET CAREERS
   POST /api/apply/verify

   PURPOSE
   ----------------------------------------------------------------------------
   Verifies the applicant's email OTP and creates the final Application.

   IMPORTANT BUSINESS FLOW
   ----------------------------------------------------------------------------
   1. Student submits application.
   2. /api/apply creates temporary OTP verification session.
   3. Student verifies OTP here.
   4. Final Application is created with status = pending.
   5. Admin reviews / approves application.
   6. Admin creates Student ID + password.
   7. Student logs in.
   8. Student completes selected-domain assessment.
   9. Only after passing assessment can student select:
        - 1 Month
        - 3 Months
        - 6 Months
   10. Payment happens after plan selection.

   THIS ROUTE DOES NOT:
   ----------------------------------------------------------------------------
   - select an internship plan
   - select duration
   - calculate price
   - create payment
   - create student account
   - approve application

   OTP verification only creates the application.

   SECURITY
   ----------------------------------------------------------------------------
   - OTP is never stored in plain text.
   - otpHash is explicitly selected because the model uses select:false.
   - OTP expires.
   - Failed attempts are limited.
   - OTP is single-use.
   - Final application data comes only from the server-side OTP session.
   - Duplicate email applications are blocked by database uniqueness.
   - Internship availability is rechecked before final application creation.
============================================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================================
   CONFIGURATION
============================================================================ */

const OTP_LENGTH = 6;
const DEFAULT_OTP_EXPIRE_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const MAX_APPLICATION_ID_ATTEMPTS = 10;

/* ============================================================================
   TYPES
============================================================================ */

type PendingApplication = {
  fullName: string;
  email: string;
  phone: string;

  collegeUniversity: string;
  course: string;
  branchStream: string;
  graduationYear: string;

  internshipTrack: string;
  skills: string[];

  consentTerms: boolean;
  consentPrivacy: boolean;
  consentDeclaration: boolean;
};

type VerifyBody = {
  email?: unknown;
  otp?: unknown;
  action?: unknown;
};

type RouteErrorCode =
  | "INVALID_JSON"
  | "EMAIL_REQUIRED"
  | "INVALID_EMAIL"
  | "OTP_REQUIRED"
  | "INVALID_OTP"
  | "OTP_SESSION_NOT_FOUND"
  | "OTP_HASH_MISSING"
  | "OTP_EXPIRED"
  | "OTP_ATTEMPTS_EXCEEDED"
  | "INVALID_APPLICATION_SESSION"
  | "INTERNSHIP_NOT_FOUND"
  | "INTERNSHIP_UNAVAILABLE"
  | "APPLICATION_ALREADY_EXISTS"
  | "APPLICATION_CREATE_FAILED"
  | "VERIFICATION_FAILED"
  | "METHOD_NOT_ALLOWED";

class RouteError extends Error {
  public readonly code: RouteErrorCode;
  public readonly status: number;

  constructor(
    message: string,
    code: RouteErrorCode,
    status: number,
  ) {
    super(message);

    this.name = "RouteError";
    this.code = code;
    this.status = status;
  }
}

/* ============================================================================
   CONFIG
============================================================================ */

const OTP_EXPIRE_MINUTES = Math.max(
  1,
  Math.min(
    60,
    Number(
      process.env.OTP_EXPIRE_MINUTES ??
        DEFAULT_OTP_EXPIRE_MINUTES,
    ),
  ),
);

/* ============================================================================
   RESPONSE HELPERS
============================================================================ */

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      ...headers,
    },
  });
}

function errorResponse(
  message: string,
  code: RouteErrorCode,
  status: number,
  extra: Record<string, unknown> = {},
): NextResponse {
  return jsonResponse(
    {
      success: false,
      verified: false,
      message,
      code,
      ...extra,
    },
    status,
  );
}

/* ============================================================================
   NORMALIZATION
============================================================================ */

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function normalizeOtp(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\D/g, "")
    .slice(0, OTP_LENGTH);
}

function normalizeSkills(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (
            skill,
          ): skill is string =>
            typeof skill === "string",
        )
        .map((skill) => skill.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  );
}

function isValidEmail(
  email: string,
): boolean {
  return (
    email.length > 0 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  );
}

function isValidGraduationYear(
  value: string,
): boolean {
  const year = Number(value);

  return (
    Number.isInteger(year) &&
    year >= 2020 &&
    year <= 2050
  );
}

function isValidPhone(
  value: string,
): boolean {
  return /^\+[1-9]\d{6,14}$/.test(
    value.replace(/\s+/g, ""),
  );
}

/* ============================================================================
   OTP SECURITY
============================================================================ */

/**
 * Hash OTP using SHA-256.
 *
 * Plain OTP is never stored in MongoDB.
 */
function hashOtp(
  otp: string,
): string {
  return crypto
    .createHash("sha256")
    .update(otp, "utf8")
    .digest("hex");
}

/**
 * Timing-safe hash comparison.
 */
function timingSafeCompare(
  first: string,
  second: string,
): boolean {
  const firstBuffer =
    Buffer.from(first, "utf8");

  const secondBuffer =
    Buffer.from(second, "utf8");

  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    firstBuffer,
    secondBuffer,
  );
}

/* ============================================================================
   APPLICATION ID
============================================================================ */

function generateApplicationId(): string {
  const year =
    new Date().getFullYear();

  const randomNumber =
    crypto.randomInt(
      100000,
      1000000,
    );

  return `CN-${year}-${randomNumber}`;
}

function isDuplicateKeyError(
  error: unknown,
): boolean {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  if (!("code" in error)) {
    return false;
  }

  return (
    Number(
      (
        error as {
          code?: unknown;
        }
      ).code,
    ) === 11000
  );
}

async function generateUniqueApplicationId(): Promise<string> {
  for (
    let attempt = 0;
    attempt <
    MAX_APPLICATION_ID_ATTEMPTS;
    attempt += 1
  ) {
    const candidate =
      generateApplicationId();

    const exists =
      await Application.exists({
        applicationId:
          candidate,
      });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to generate a unique application ID.",
  );
}

/* ============================================================================
   INTERNSHIP AVAILABILITY
============================================================================ */

/**
 * The application itself does not select a plan.
 *
 * We only verify that the student's selected domain still has
 * at least one active/public/selectable internship record.
 *
 * This prevents applications being completed against a domain that
 * was removed or disabled while the applicant was entering the OTP.
 */
async function validateInternshipDomain(
  internshipTrack: string,
): Promise<{
  title: string;
  domain: string;
}> {
  const track =
    cleanString(
      internshipTrack,
    );

  if (!track) {
    throw new RouteError(
      "Selected internship domain is missing.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  const escapedTrack =
    track.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const internship =
    await Internship.findOne({
      $or: [
        {
          domain: {
            $regex: `^${escapedTrack}$`,
            $options: "i",
          },
        },
        {
          assessmentDomain: {
            $regex: `^${escapedTrack}$`,
            $options: "i",
          },
        },
      ],

      status: "active",
      isPublic: true,
      isSelectable: true,
    })
      .select({
        title: 1,
        name: 1,
        domain: 1,
        assessmentDomain: 1,
      })
      .sort({
        sortOrder: 1,
        createdAt: -1,
      })
      .lean()
      .exec();

  if (!internship) {
    throw new RouteError(
      "The selected internship domain is no longer available. Please submit the application again.",
      "INTERNSHIP_UNAVAILABLE",
      409,
    );
  }

  const title =
    cleanString(
      (internship as Record<string, unknown>)
        .title,
    ) ||
    cleanString(
      (internship as Record<string, unknown>)
        .name,
    ) ||
    track;

  const domain =
    cleanString(
      (internship as Record<string, unknown>)
        .domain,
    ) ||
    cleanString(
      (internship as Record<string, unknown>)
        .assessmentDomain,
    ) ||
    track;

  return {
    title,
    domain,
  };
}

/* ============================================================================
   PENDING APPLICATION VALIDATION
============================================================================ */

function normalizePendingApplication(
  value: unknown,
): PendingApplication {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new RouteError(
      "The application verification session is invalid. Please submit the application again.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  const pending =
    value as Record<string, unknown>;

  const fullName =
    cleanString(
      pending.fullName,
    );

  const email =
    normalizeEmail(
      pending.email,
    );

  const phone =
    cleanString(
      pending.phone,
    ).replace(/\s+/g, "");

  const collegeUniversity =
    cleanString(
      pending.collegeUniversity,
    );

  const course =
    cleanString(
      pending.course,
    );

  const branchStream =
    cleanString(
      pending.branchStream,
    );

  const graduationYear =
    cleanString(
      pending.graduationYear,
    );

  const internshipTrack =
    cleanString(
      pending.internshipTrack,
    );

  const skills =
    normalizeSkills(
      pending.skills,
    );

  const consentTerms =
    pending.consentTerms === true;

  const consentPrivacy =
    pending.consentPrivacy === true;

  const consentDeclaration =
    pending.consentDeclaration === true;

  /* --------------------------------------------------------------------------
     Required field validation
  -------------------------------------------------------------------------- */

  if (
    fullName.length < 3 ||
    fullName.length > 120
  ) {
    throw new RouteError(
      "The application name is invalid. Please submit the application again.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  if (!isValidEmail(email)) {
    throw new RouteError(
      "The application email is invalid. Please submit the application again.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  if (!isValidPhone(phone)) {
    throw new RouteError(
      "The application phone number is invalid. Please submit the application again.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  if (
    collegeUniversity.length < 2 ||
    collegeUniversity.length > 200
  ) {
    throw new RouteError(
      "The college / university information is invalid.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  if (
    course.length < 2 ||
    course.length > 120
  ) {
    throw new RouteError(
      "The course information is invalid.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  if (
    branchStream.length < 2 ||
    branchStream.length > 120
  ) {
    throw new RouteError(
      "The branch / stream information is invalid.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  if (
    !isValidGraduationYear(
      graduationYear,
    )
  ) {
    throw new RouteError(
      "The graduation year is invalid.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  if (
    internshipTrack.length < 2 ||
    internshipTrack.length > 120
  ) {
    throw new RouteError(
      "The selected internship domain is invalid.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  if (
    skills.length < 1 ||
    skills.length > 20
  ) {
    throw new RouteError(
      "At least one valid skill is required.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  /* --------------------------------------------------------------------------
     Consent validation
  -------------------------------------------------------------------------- */

  if (
    !consentTerms ||
    !consentPrivacy ||
    !consentDeclaration
  ) {
    throw new RouteError(
      "Required application confirmations are missing. Please submit the application again.",
      "INVALID_APPLICATION_SESSION",
      400,
    );
  }

  return {
    fullName,
    email,
    phone,
    collegeUniversity,
    course,
    branchStream,
    graduationYear,
    internshipTrack,
    skills,
    consentTerms,
    consentPrivacy,
    consentDeclaration,
  };
}

/* ============================================================================
   POST
============================================================================ */

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    /* ------------------------------------------------------------------------
       Parse request body
    ------------------------------------------------------------------------ */

    let body: VerifyBody;

    try {
      body =
        (await request.json()) as VerifyBody;
    } catch {
      return errorResponse(
        "Invalid JSON request.",
        "INVALID_JSON",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       Only verification is supported here.
    ------------------------------------------------------------------------ */

    const action =
      typeof body.action === "string"
        ? body.action
            .trim()
            .toLowerCase()
        : "verify";

    if (
      action !== "verify"
    ) {
      return errorResponse(
        "Unsupported verification action. Please use the application endpoint to request a new OTP.",
        "VERIFICATION_FAILED",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       Email
    ------------------------------------------------------------------------ */

    const email =
      normalizeEmail(
        body.email,
      );

    if (!email) {
      return errorResponse(
        "Email is required.",
        "EMAIL_REQUIRED",
        400,
      );
    }

    if (
      !isValidEmail(email)
    ) {
      return errorResponse(
        "Please enter a valid email address.",
        "INVALID_EMAIL",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       OTP
    ------------------------------------------------------------------------ */

    const otp =
      normalizeOtp(
        body.otp,
      );

    if (!otp) {
      return errorResponse(
        "OTP is required.",
        "OTP_REQUIRED",
        400,
      );
    }

    if (
      otp.length !== OTP_LENGTH
    ) {
      return errorResponse(
        "Please enter the 6-digit OTP sent to your email.",
        "INVALID_OTP",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       Database
    ------------------------------------------------------------------------ */

    try {
      await connectDB();
    } catch (error) {
      console.error(
        "[APPLY/VERIFY] Database connection error:",
        error,
      );

      return errorResponse(
        "Unable to connect to the database. Please try again.",
        "VERIFICATION_FAILED",
        503,
      );
    }

    /* ------------------------------------------------------------------------
       Prevent verification for an already submitted application.
    ------------------------------------------------------------------------ */

    const existingApplication =
      await Application.findOne({
        email,
      })
        .select({
          _id: 1,
          applicationId: 1,
          status: 1,
        })
        .lean()
        .exec();

    if (
      existingApplication
    ) {
      return errorResponse(
        "An application with this email address already exists.",
        "APPLICATION_ALREADY_EXISTS",
        409,
        {
          applicationId:
            cleanString(
              existingApplication.applicationId,
            ),

          status:
            cleanString(
              existingApplication.status,
            ),
        },
      );
    }

    /* ------------------------------------------------------------------------
       Load OTP verification session.

       otpHash is select:false in the model, so it MUST be explicitly selected.
    ------------------------------------------------------------------------ */

    const verification =
      await EmailVerification.findOne({
        email,
      })
        .select("+otpHash")
        .exec();

    if (!verification) {
      return errorResponse(
        "OTP session not found or already expired. Please submit the application again.",
        "OTP_SESSION_NOT_FOUND",
        404,
      );
    }

    /* ------------------------------------------------------------------------
       OTP hash
    ------------------------------------------------------------------------ */

    const storedOtpHash =
      cleanString(
        verification.otpHash,
      );

    if (!storedOtpHash) {
      console.error(
        "[APPLY/VERIFY] OTP hash missing.",
        {
          email,
        },
      );

      await EmailVerification.deleteOne({
        _id: verification._id,
      }).exec();

      return errorResponse(
        "The OTP session is invalid. Please request a new OTP.",
        "OTP_HASH_MISSING",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       Expiration
    ------------------------------------------------------------------------ */

    const now =
      new Date();

    const expiresAt =
      verification.expiresAt;

    if (
      !expiresAt ||
      expiresAt.getTime() <=
        now.getTime()
    ) {
      await EmailVerification.deleteOne({
        _id: verification._id,
      }).exec();

      return errorResponse(
        "This OTP has expired. Please request a new OTP.",
        "OTP_EXPIRED",
        410,
      );
    }

    /* ------------------------------------------------------------------------
       Attempt protection
    ------------------------------------------------------------------------ */

    const attempts = Math.max(
      0,
      Number(
        verification.attempts ?? 0,
      ),
    );

    const configuredMaxAttempts =
      Number(
        verification.maxAttempts ??
          MAX_OTP_ATTEMPTS,
      );

    const maxAttempts =
      Math.min(
        MAX_OTP_ATTEMPTS,
        Math.max(
          1,
          Number.isFinite(
            configuredMaxAttempts,
          )
            ? configuredMaxAttempts
            : MAX_OTP_ATTEMPTS,
        ),
      );

    if (
      attempts >= maxAttempts
    ) {
      await EmailVerification.deleteOne({
        _id: verification._id,
      }).exec();

      return errorResponse(
        "Too many incorrect OTP attempts. Please request a new OTP.",
        "OTP_ATTEMPTS_EXCEEDED",
        429,
      );
    }

    /* ------------------------------------------------------------------------
       Compare submitted OTP
    ------------------------------------------------------------------------ */

    const submittedOtpHash =
      hashOtp(otp);

    const otpMatches =
      timingSafeCompare(
        submittedOtpHash,
        storedOtpHash,
      );

    if (!otpMatches) {
      const nextAttempts =
        attempts + 1;

      /* ----------------------------------------------------------------------
         Last attempt consumed
      ---------------------------------------------------------------------- */

      if (
        nextAttempts >=
        maxAttempts
      ) {
        await EmailVerification.deleteOne({
          _id: verification._id,
        }).exec();

        return errorResponse(
          "Invalid OTP. Maximum attempts reached. Please request a new OTP.",
          "OTP_ATTEMPTS_EXCEEDED",
          429,
        );
      }

      await EmailVerification.updateOne(
        {
          _id:
            verification._id,

          attempts: {
            $lt: maxAttempts,
          },
        },
        {
          $set: {
            attempts:
              nextAttempts,
          },
        },
      ).exec();

      return errorResponse(
        `Invalid OTP. ${
          maxAttempts -
          nextAttempts
        } attempt(s) remaining.`,
        "INVALID_OTP",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       Normalize pending application data
    ------------------------------------------------------------------------ */

    const pending =
      normalizePendingApplication(
        verification.pendingApplication,
      );

    /* ------------------------------------------------------------------------
       Verify email consistency
    ------------------------------------------------------------------------ */

    if (
      pending.email !==
      email
    ) {
      console.error(
        "[APPLY/VERIFY] Verification email mismatch.",
        {
          email,
          pendingEmail:
            pending.email,
        },
      );

      await EmailVerification.deleteOne({
        _id: verification._id,
      }).exec();

      return errorResponse(
        "The verification session does not match this email address.",
        "INVALID_APPLICATION_SESSION",
        400,
      );
    }

    /* ------------------------------------------------------------------------
       Re-check internship domain availability.

       IMPORTANT:
       No plan or price is selected here.
    ------------------------------------------------------------------------ */

    const internship =
      await validateInternshipDomain(
        pending.internshipTrack,
      );

    /* ------------------------------------------------------------------------
       Final duplicate protection.

       The first duplicate check happened before OTP lookup.
       This second check protects against an application being created
       between the first check and this point.
    ------------------------------------------------------------------------ */

    const duplicateBeforeCreate =
      await Application.findOne({
        email,
      })
        .select({
          _id: 1,
          applicationId: 1,
          status: 1,
        })
        .lean()
        .exec();

    if (
      duplicateBeforeCreate
    ) {
      await EmailVerification.deleteOne({
        _id: verification._id,
      }).exec();

      return errorResponse(
        "An application with this email address already exists.",
        "APPLICATION_ALREADY_EXISTS",
        409,
        {
          applicationId:
            cleanString(
              duplicateBeforeCreate.applicationId,
            ),

          status:
            cleanString(
              duplicateBeforeCreate.status,
            ),
        },
      );
    }

    /* ------------------------------------------------------------------------
       Generate unique application ID
    ------------------------------------------------------------------------ */

    const applicationId =
      await generateUniqueApplicationId();

    /* ------------------------------------------------------------------------
       Create FINAL Application.

       IMPORTANT:
       There is intentionally NO:
         - internshipId
         - planCode
         - duration
         - price
         - priceInPaise

       Those belong to the post-assessment internship selection/payment stage.
    ------------------------------------------------------------------------ */

    let application;

    try {
      application =
        await Application.create({
          applicationId,

          /* --------------------------------------------------------------
             Personal
          -------------------------------------------------------------- */

          fullName:
            pending.fullName,

          email:
            pending.email,

          phone:
            pending.phone,

          /* --------------------------------------------------------------
             Education
          -------------------------------------------------------------- */

          collegeUniversity:
            pending.collegeUniversity,

          course:
            pending.course,

          branchStream:
            pending.branchStream,

          graduationYear:
            pending.graduationYear,

          /* --------------------------------------------------------------
             Internship Domain
          -------------------------------------------------------------- */

          internshipTrack:
            pending.internshipTrack,

          skills:
            pending.skills,

          /* --------------------------------------------------------------
             Consents
          -------------------------------------------------------------- */

          consentTerms:
            true,

          consentPrivacy:
            true,

          consentDeclaration:
            true,

          /* --------------------------------------------------------------
             Email verification
          -------------------------------------------------------------- */

          emailVerified:
            true,

          emailVerifiedAt:
            now,

          /* --------------------------------------------------------------
             Application status

             New verified application:
             pending

             Admin approval happens later.
          -------------------------------------------------------------- */

          status:
            "pending",

          /* --------------------------------------------------------------
             Assessment

             Assessment is NOT completed at application stage.
          -------------------------------------------------------------- */

          assessmentStatus:
            "not_started",

          /* --------------------------------------------------------------
             Internship eligibility

             Student becomes eligible only after required assessment flow.
          -------------------------------------------------------------- */

          internshipEligible:
            false,

          /* --------------------------------------------------------------
             Plan

             Intentionally not selected here.
          -------------------------------------------------------------- */

          selectedDuration:
            undefined,

          /* --------------------------------------------------------------
             Payment

             No payment exists at application stage.
          -------------------------------------------------------------- */

          paymentStatus:
            "not_required",

          paymentId:
            undefined,
        });
    } catch (error) {
      /* ----------------------------------------------------------------------
         MongoDB duplicate protection
      ---------------------------------------------------------------------- */

      if (
        isDuplicateKeyError(
          error,
        )
      ) {
        const duplicate =
          await Application.findOne({
            email,
          })
            .select({
              applicationId: 1,
              status: 1,
            })
            .lean()
            .exec();

        return errorResponse(
          "An application with this email address already exists.",
          "APPLICATION_ALREADY_EXISTS",
          409,
          {
            applicationId:
              cleanString(
                duplicate?.applicationId,
              ),

            status:
              cleanString(
                duplicate?.status,
              ),
          },
        );
      }

      console.error(
        "[APPLY/VERIFY] Application creation failed:",
        error,
      );

      return errorResponse(
        "Unable to create your application right now. Please try again.",
        "APPLICATION_CREATE_FAILED",
        500,
      );
    }

    /* ------------------------------------------------------------------------
       OTP is single-use.

       Delete only AFTER the final application has been created successfully.
    ------------------------------------------------------------------------ */

    try {
      await EmailVerification.deleteOne({
        _id: verification._id,
      }).exec();
    } catch (cleanupError) {
      /*
       * The application already exists.
       *
       * Do not tell the student the application failed merely because
       * temporary OTP cleanup failed.
       *
       * TTL index will eventually remove the verification document.
       */
      console.error(
        "[APPLY/VERIFY] OTP cleanup failed:",
        cleanupError,
      );
    }

    /* ------------------------------------------------------------------------
       SUCCESS
    ------------------------------------------------------------------------ */

    return jsonResponse(
      {
        success: true,

        verified: true,

        applicationCreated:
          true,

        message:
          "Email verified successfully. Your application has been submitted and is pending admin review.",

        applicationId:
          application.applicationId,

        email:
          application.email,

        status:
          application.status,

        internship: {
          title:
            internship.title,

          domain:
            internship.domain,
        },

        nextStep:
          "Your application will be reviewed by the admin team. If approved, your Student ID and login password will be sent to your email.",

        workflow: {
          emailVerified:
            true,

          applicationStatus:
            "pending",

          assessmentStatus:
            "not_started",

          internshipEligible:
            false,

          planSelected:
            false,

          paymentRequired:
            false,

          studentAccountCreated:
            false,
        },

        submittedAt:
          application.createdAt,
      },
      201,
    );
  } catch (error) {
    /* =========================================================================
       EXPECTED ROUTE ERROR
    ========================================================================= */

    if (
      error instanceof RouteError
    ) {
      return errorResponse(
        error.message,
        error.code,
        error.status,
      );
    }

    /* =========================================================================
       UNKNOWN ERROR
    ========================================================================= */

    console.error(
      "[POST /api/apply/verify] Unexpected error:",
      error,
    );

    return errorResponse(
      "Unable to verify OTP and complete your application. Please try again.",
      "VERIFICATION_FAILED",
      500,
    );
  }
}

/* ============================================================================
   GET
============================================================================ */

export async function GET(): Promise<NextResponse> {
  return errorResponse(
    "Use POST /api/apply/verify to verify the email OTP.",
    "METHOD_NOT_ALLOWED",
    405,
    {
      allow:
        "POST, OPTIONS",
    },
  );
}

/* ============================================================================
   PUT
============================================================================ */

export async function PUT(): Promise<NextResponse> {
  return errorResponse(
    "PUT is not supported for OTP verification.",
    "METHOD_NOT_ALLOWED",
    405,
    {
      allow:
        "POST, OPTIONS",
    },
  );
}

/* ============================================================================
   PATCH
============================================================================ */

export async function PATCH(): Promise<NextResponse> {
  return errorResponse(
    "PATCH is not supported for OTP verification.",
    "METHOD_NOT_ALLOWED",
    405,
    {
      allow:
        "POST, OPTIONS",
    },
  );
}

/* ============================================================================
   DELETE
============================================================================ */

export async function DELETE(): Promise<NextResponse> {
  return errorResponse(
    "DELETE is not supported for OTP verification.",
    "METHOD_NOT_ALLOWED",
    405,
    {
      allow:
        "POST, OPTIONS",
    },
  );
}

/* ============================================================================
   OPTIONS
============================================================================ */

export async function OPTIONS(): Promise<NextResponse> {
  return jsonResponse(
    {
      success: true,
      message:
        "API methods available.",
      methods: [
        "POST",
        "OPTIONS",
      ],
    },
    200,
    {
      Allow:
        "POST, OPTIONS",
    },
  );
}