import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidObjectId } from "mongoose";

import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";
import {
  AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type SafeRecord = Record<string, unknown>;

type ProfileUpdatePayload = {
  phone?: string;
  collegeName?: string;
  university?: string;
  course?: string;
  branchStream?: string;
  year?: string;
  semester?: string;
  cgpa?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

const ALLOWED_UPDATE_FIELDS = new Set<keyof ProfileUpdatePayload>([
  "phone",
  "collegeName",
  "university",
  "course",
  "branchStream",
  "year",
  "semester",
  "cgpa",
  "linkedinUrl",
  "githubUrl",
  "portfolioUrl",
  "address",
  "city",
  "state",
  "pincode",
]);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return stringValue(value);
}

function dateValue(value: unknown): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(
    value instanceof Date ? value : String(value)
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function normalizeAssessmentStatus(value: unknown): string {
  const status = stringValue(value)
    .toLowerCase()
    .replace(/_/g, "-");

  switch (status) {
    case "not-started":
    case "scheduled":
    case "in-progress":
    case "submitted":
    case "evaluated":
    case "passed":
    case "failed":
      return status;

    case "active":
      return "in-progress";

    case "not_started":
      return "not-started";

    default:
      return "not-started";
  }
}

function normalizePaymentStatus(value: unknown): string {
  const status = stringValue(value).toLowerCase();

  switch (status) {
    case "paid":
      return "paid";

    case "pending":
      return "pending";

    case "failed":
      return "failed";

    case "refunded":
      return "refunded";

    case "unpaid":
    case "not_required":
    case "":
      return "pending";

    default:
      return "pending";
  }
}

function normalizeInternshipStatus(value: unknown): string {
  const status = stringValue(value)
    .toLowerCase()
    .replace(/_/g, "-");

  switch (status) {
    case "locked":
      return "locked";

    case "available":
      return "available";

    case "selected":
      return "selected";

    case "payment-pending":
      return "payment-pending";

    case "payment-completed":
      return "payment-completed";

    case "approved":
      return "approved";

    case "rejected":
      return "rejected";

    default:
      return "locked";
  }
}

function normalizePlan(
  internshipPlan: unknown,
  selectedDuration?: unknown
): string {
  const direct = stringValue(selectedDuration);

  if (
    direct === "1 Month" ||
    direct === "3 Months" ||
    direct === "6 Months"
  ) {
    return direct;
  }

  const plan = stringValue(internshipPlan).toLowerCase();

  if (plan === "1 month") {
    return "1 Month";
  }

  if (plan === "3 months") {
    return "3 Months";
  }

  if (plan === "6 months") {
    return "6 Months";
  }

  return "";
}

function getPlanPrice(plan: string): number {
  switch (plan) {
    case "1 Month":
      return 499;

    case "3 Months":
      return 999;

    case "6 Months":
      return 1699;

    default:
      return 0;
  }
}

function isStudentAccountLocked(student: SafeRecord): boolean {
  if (student.accountLocked !== true) {
    return false;
  }

  const lockedUntil = student.lockedUntil;

  if (!lockedUntil) {
    return true;
  }

  const timestamp = new Date(
    lockedUntil instanceof Date
      ? lockedUntil
      : String(lockedUntil)
  ).getTime();

  if (Number.isNaN(timestamp)) {
    return true;
  }

  return timestamp > Date.now();
}

function sanitizeUrl(value: unknown): string {
  const url = stringValue(value);

  if (!url) {
    return "";
  }

  if (url.length > 500) {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

async function getAuthenticatedStudentId(): Promise<{
  userId: string;
} | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  if (payload.role !== "student") {
    return null;
  }

  if (!payload.userId || !isValidObjectId(payload.userId)) {
    return null;
  }

  return {
    userId: payload.userId,
  };
}

/* -------------------------------------------------------------------------- */
/* Student Response                                                           */
/* -------------------------------------------------------------------------- */

function buildStudentProfile(
  student: SafeRecord
): SafeRecord {
  const assessmentStatus = normalizeAssessmentStatus(
    student.assessmentStatus
  );

  const score = numberValue(student.assessmentScore);

  const internshipEligible =
    student.internshipApplicationAllowed === true ||
    student.internshipEligible === true ||
    student.resultStatus === "passed" ||
    assessmentStatus === "passed";

  const selectedDuration = normalizePlan(
    student.internshipPlan,
    student.selectedDuration
  );

  const paymentStatus = normalizePaymentStatus(
    student.paymentStatus
  );

  const internshipStatus = normalizeInternshipStatus(
    student.internshipStatus
  );

  const paymentAmount = numberValue(
    student.paymentAmount
  );

  const journeyExpired =
    student.journeyExpired === true ||
    Boolean(
      student.journeyExpiresAt &&
        new Date(
          String(student.journeyExpiresAt)
        ).getTime() < Date.now()
    );

  return {
    id: String(student._id ?? ""),

    studentId:
      stringValue(student.studentId) || "",

    applicationId:
      stringValue(student.applicationId) || "",

    fullName:
      stringValue(student.fullName) || "Student",

    email:
      stringValue(student.email).toLowerCase(),

    emailVerified:
      student.emailVerified === true,

    phone:
      stringValue(student.phone),

    /* Education */
    collegeName:
      stringValue(student.collegeName),

    collegeUniversity:
      stringValue(student.collegeName) ||
      stringValue(student.university),

    university:
      stringValue(student.university),

    course:
      stringValue(student.course),

    branchStream:
      stringValue(student.branchStream),

    graduationYear:
      stringValue(student.year),

    year:
      stringValue(student.year),

    semester:
      stringValue(student.semester),

    cgpa:
      stringValue(student.cgpa),

    /* Professional */
    linkedinUrl:
      stringValue(student.linkedinUrl),

    githubUrl:
      stringValue(student.githubUrl),

    portfolioUrl:
      stringValue(student.portfolioUrl),

    /* Application */
    applicationStatus:
      stringValue(student.applicationStatus) || "pending",

    submittedAt:
      dateValue(student.submittedAt),

    approvedAt:
      dateValue(student.approvedAt),

    /* Assessment */
    assessmentStatus,

    assessmentScore:
      score,

    assessmentPercentage:
      score,

    assessmentPassed:
      assessmentStatus === "passed" ||
      student.resultStatus === "passed",

    assessmentStartedAt:
      dateValue(student.assessmentStartedAt),

    assessmentSubmittedAt:
      dateValue(student.assessmentSubmittedAt),

    assessmentEvaluatedAt:
      dateValue(student.assessmentEvaluatedAt),

    resultDeclaredAt:
      dateValue(student.resultDeclaredAt),

    resultVisibleAt:
      dateValue(student.resultVisibleAt),

    resultStatus:
      stringValue(student.resultStatus) || "pending",

    /* Internship eligibility */
    internshipEligible,

    internshipApplicationAllowed:
      student.internshipApplicationAllowed === true,

    /* Internship */
    internshipTrack:
      stringValue(student.internshipTrack),

    internshipPlan:
      stringValue(student.internshipPlan),

    selectedDuration,

    internshipSelectionAt:
      dateValue(student.internshipSelectionAt),

    internshipStatus,

    startPreference:
      stringValue(student.startPreference),

    /* Payment */
    paymentStatus,

    paymentAmount,

    paymentCurrency:
      stringValue(student.paymentCurrency).toUpperCase() || "INR",

    paymentId:
      stringValue(student.razorpayPaymentId) ||
      stringValue(student.paymentId) ||
      null,

    razorpayOrderId:
      stringValue(student.razorpayOrderId) || null,

    paymentCompletedAt:
      dateValue(student.paymentCompletedAt),

    /* Admin approval */
    adminApprovalStatus:
      stringValue(student.adminApprovalStatus) || "pending",

    adminApprovedAt:
      dateValue(student.adminApprovedAt),

    /* Dashboard */
    dashboardStatus:
      stringValue(student.dashboardStatus) || "locked",

    dashboardActivatedAt:
      dateValue(student.dashboardActivatedAt),

    /* Certificate */
    certificateStatus:
      stringValue(student.certificateStatus) ||
      "not-eligible",

    certificateId:
      stringValue(student.certificateId) || null,

    /* Account */
    credentialsGenerated:
      student.credentialsGenerated === true,

    credentialsGeneratedAt:
      dateValue(student.credentialsGeneratedAt),

    loginEnabled:
      student.loginEnabled !== false,

    lastLoginAt:
      dateValue(
        student.lastLoginAt
      ),

    /* Journey */
    journeyStartedAt:
      dateValue(student.journeyStartedAt),

    journeyExpiresAt:
      dateValue(student.journeyExpiresAt),

    journeyExpired,

    /* Dates */
    createdAt:
      dateValue(student.createdAt),

    updatedAt:
      dateValue(student.updatedAt),
  };
}

/* -------------------------------------------------------------------------- */
/* GET /api/student/profile                                                   */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
    const auth = await getAuthenticatedStudentId();

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Authentication required. Please login as a student.",
          code: "UNAUTHORIZED",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );
    }

    await connectDB();

    const student = await StudentModel.findById(
      auth.userId
    )
      .select(
        [
          "_id",
          "applicationId",
          "fullName",
          "email",
          "emailVerified",
          "phone",

          "collegeName",
          "university",
          "course",
          "branchStream",
          "year",
          "semester",
          "cgpa",

          "linkedinUrl",
          "githubUrl",
          "portfolioUrl",

          "studentId",
          "credentialsGenerated",
          "credentialsGeneratedAt",
          "loginEnabled",
          "lastLoginAt",

          "accountLocked",
          "lockedUntil",

          "applicationStatus",
          "submittedAt",
          "approvedAt",

          "assessmentStatus",
          "assessmentScore",
          "assessmentStartedAt",
          "assessmentSubmittedAt",
          "assessmentEvaluatedAt",
          "resultDeclaredAt",
          "resultVisibleAt",
          "resultStatus",

          "internshipApplicationAllowed",
          "internshipEligible",

          "internshipTrack",
          "internshipPlan",
          "selectedDuration",
          "internshipSelectionAt",
          "internshipStatus",
          "startPreference",

          "paymentStatus",
          "paymentAmount",
          "paymentCurrency",
          "paymentId",
          "razorpayOrderId",
          "razorpayPaymentId",
          "paymentCompletedAt",

          "adminApprovalStatus",
          "adminApprovedAt",

          "dashboardStatus",
          "dashboardActivatedAt",

          "certificateStatus",
          "certificateId",

          "journeyStartedAt",
          "journeyExpiresAt",
          "journeyExpired",

          "createdAt",
          "updatedAt",
        ].join(" ")
      )
      .lean()
      .exec();

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student account could not be found.",
          code: "STUDENT_NOT_FOUND",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const studentRecord =
      student as unknown as SafeRecord;

    /* --------------------------------------------------------------
       Account security checks
    -------------------------------------------------------------- */

    if (studentRecord.accountLocked === true) {
      if (isStudentAccountLocked(studentRecord)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Your student account is temporarily locked.",
            code: "ACCOUNT_TEMPORARILY_LOCKED",
          },
          {
            status: 423,
            headers: {
              "Cache-Control": "no-store",
            },
          }
        );
      }
    }

    if (studentRecord.loginEnabled === false) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student login is currently disabled for this account.",
          code: "LOGIN_DISABLED",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const profile =
      buildStudentProfile(studentRecord);

    return NextResponse.json(
      {
        success: true,
        message:
          "Student profile loaded successfully.",
        student: profile,
        profile,
        data: profile,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "private, no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Vary: "Cookie",
        },
      }
    );
  } catch (error) {
    console.error(
      "[Student Profile GET] Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load student profile right now.",
        code: "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* PUT validation                                                             */
/* -------------------------------------------------------------------------- */

function validateUpdatePayload(
  payload: unknown
): {
  success: true;
  updates: Record<string, string>;
} | {
  success: false;
  message: string;
} {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return {
      success: false,
      message: "Request body must be a JSON object.",
    };
  }

  const source =
    payload as Record<string, unknown>;

  const incomingKeys =
    Object.keys(source);

  if (incomingKeys.length === 0) {
    return {
      success: false,
      message:
        "At least one profile field is required.",
    };
  }

  const updates: Record<string, string> = {};

  for (const key of incomingKeys) {
    if (
      !ALLOWED_UPDATE_FIELDS.has(
        key as keyof ProfileUpdatePayload
      )
    ) {
      return {
        success: false,
        message:
          `The field "${key}" cannot be updated from the student profile API.`,
      };
    }

    const value = source[key];

    if (typeof value !== "string") {
      return {
        success: false,
        message:
          `The field "${key}" must be a string.`,
      };
    }

    const cleanValue = value.trim();

    if (cleanValue.length > 1000) {
      return {
        success: false,
        message:
          `The field "${key}" is too long.`,
      };
    }

    updates[key] = cleanValue;
  }

  /* --------------------------------------------------------------
     Field-specific limits
  -------------------------------------------------------------- */

  const maxLengths: Record<string, number> = {
    phone: 20,
    collegeName: 200,
    university: 200,
    course: 120,
    branchStream: 120,
    year: 50,
    semester: 50,
    cgpa: 20,
    linkedinUrl: 500,
    githubUrl: 500,
    portfolioUrl: 500,
    address: 500,
    city: 100,
    state: 100,
    pincode: 10,
  };

  for (const [field, value] of Object.entries(updates)) {
    const maxLength = maxLengths[field];

    if (
      maxLength !== undefined &&
      value.length > maxLength
    ) {
      return {
        success: false,
        message:
          `${field} cannot exceed ${maxLength} characters.`,
      };
    }
  }

  /* --------------------------------------------------------------
     Phone
  -------------------------------------------------------------- */

  if (updates.phone) {
    const phoneRegex =
      /^\+?[1-9]\d{6,19}$/;

    if (!phoneRegex.test(updates.phone)) {
      return {
        success: false,
        message:
          "Please provide a valid phone number.",
      };
    }
  }

  /* --------------------------------------------------------------
     Graduation year
  -------------------------------------------------------------- */

  if (updates.year) {
    const year = Number(updates.year);

    if (
      !Number.isInteger(year) ||
      year < 2020 ||
      year > 2050
    ) {
      return {
        success: false,
        message:
          "Year must be between 2020 and 2050.",
      };
    }
  }

  /* --------------------------------------------------------------
     CGPA
  -------------------------------------------------------------- */

  if (updates.cgpa) {
    const cgpa = Number(updates.cgpa);

    if (
      !Number.isFinite(cgpa) ||
      cgpa < 0 ||
      cgpa > 10
    ) {
      return {
        success: false,
        message:
          "CGPA must be between 0 and 10.",
      };
    }
  }

  /* --------------------------------------------------------------
     Pincode
  -------------------------------------------------------------- */

  if (updates.pincode) {
    if (!/^\d{4,10}$/.test(updates.pincode)) {
      return {
        success: false,
        message:
          "Please provide a valid pincode.",
      };
    }
  }

  /* --------------------------------------------------------------
     URLs
  -------------------------------------------------------------- */

  for (
    const field of [
      "linkedinUrl",
      "githubUrl",
      "portfolioUrl",
    ]
  ) {
    if (updates[field]) {
      const safeUrl =
        sanitizeUrl(updates[field]);

      if (!safeUrl) {
        return {
          success: false,
          message:
            `${field} must be a valid HTTP or HTTPS URL.`,
        };
      }

      updates[field] = safeUrl;
    }
  }

  return {
    success: true,
    updates,
  };
}

/* -------------------------------------------------------------------------- */
/* PUT /api/student/profile                                                   */
/* -------------------------------------------------------------------------- */

export async function PUT(
  request: Request
) {
  try {
    const auth =
      await getAuthenticatedStudentId();

    if (!auth) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Authentication required. Please login as a student.",
          code: "UNAUTHORIZED",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    await connectDB();

    const existingStudent =
      await StudentModel.findById(
        auth.userId
      )
        .select(
          "_id accountLocked lockedUntil loginEnabled applicationStatus studentId"
        )
        .lean()
        .exec();

    if (!existingStudent) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student account could not be found.",
          code: "STUDENT_NOT_FOUND",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const studentRecord =
      existingStudent as unknown as SafeRecord;

    if (
      studentRecord.loginEnabled === false
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student profile updates are currently disabled.",
          code: "LOGIN_DISABLED",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (
      isStudentAccountLocked(
        studentRecord
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your student account is temporarily locked.",
          code: "ACCOUNT_TEMPORARILY_LOCKED",
        },
        {
          status: 423,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const body: unknown =
      await request.json();

    const validation =
      validateUpdatePayload(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.message,
          code: "VALIDATION_ERROR",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const updates =
      validation.updates;

    const updateResult =
      await StudentModel.updateOne(
        {
          _id: auth.userId,
        },
        {
          $set: updates,
        },
        {
          runValidators: true,
        }
      ).exec();

    if (
      updateResult.matchedCount === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student account could not be updated.",
          code: "STUDENT_NOT_FOUND",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const updatedStudent =
      await StudentModel.findById(
        auth.userId
      )
        .select(
          [
            "_id",
            "applicationId",
            "fullName",
            "email",
            "emailVerified",
            "phone",

            "collegeName",
            "university",
            "course",
            "branchStream",
            "year",
            "semester",
            "cgpa",

            "linkedinUrl",
            "githubUrl",
            "portfolioUrl",

            "studentId",
            "credentialsGenerated",
            "credentialsGeneratedAt",
            "loginEnabled",
            "lastLoginAt",

            "applicationStatus",
            "submittedAt",
            "approvedAt",

            "assessmentStatus",
            "assessmentScore",
            "assessmentStartedAt",
            "assessmentSubmittedAt",
            "assessmentEvaluatedAt",
            "resultDeclaredAt",
            "resultVisibleAt",
            "resultStatus",

            "internshipApplicationAllowed",
            "internshipEligible",

            "internshipTrack",
            "internshipPlan",
            "selectedDuration",
            "internshipSelectionAt",
            "internshipStatus",
            "startPreference",

            "paymentStatus",
            "paymentAmount",
            "paymentCurrency",
            "paymentId",
            "razorpayOrderId",
            "razorpayPaymentId",
            "paymentCompletedAt",

            "adminApprovalStatus",
            "adminApprovedAt",

            "dashboardStatus",
            "dashboardActivatedAt",

            "certificateStatus",
            "certificateId",

            "journeyStartedAt",
            "journeyExpiresAt",
            "journeyExpired",

            "createdAt",
            "updatedAt",
          ].join(" ")
        )
        .lean()
        .exec();

    if (!updatedStudent) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Profile was updated, but the updated record could not be loaded.",
          code: "PROFILE_REFRESH_FAILED",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const profile =
      buildStudentProfile(
        updatedStudent as unknown as SafeRecord
      );

    return NextResponse.json(
      {
        success: true,
        message:
          "Student profile updated successfully.",
        student: profile,
        profile,
        data: profile,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "private, no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Vary: "Cookie",
        },
      }
    );
  } catch (error) {
    console.error(
      "[Student Profile PUT] Error:",
      error
    );

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ValidationError"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more profile fields are invalid.",
          code: "VALIDATION_ERROR",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update student profile right now.",
        code: "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Unsupported methods                                                        */
/* -------------------------------------------------------------------------- */

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Method not allowed. Use GET to read the profile or PUT to update allowed profile fields.",
      code: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: {
        Allow: "GET, PUT",
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Method not allowed. Use PUT for student profile updates.",
      code: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: {
        Allow: "GET, PUT",
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Student accounts cannot be deleted through this endpoint.",
      code: "METHOD_NOT_ALLOWED",
    },
    {
      status: 405,
      headers: {
        Allow: "GET, PUT",
        "Cache-Control": "no-store",
      },
    }
  );
}