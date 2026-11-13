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

  "address",
            "city",
            "state",
            "pincode",
            "linkedinUrl",

  "githubUrl",

  "portfolioUrl",

  "address",

  "city",

  "state",

  "pincode",

]);

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

    address: stringValue(student.address),
    city: stringValue(student.city),
    state: stringValue(student.state),
    pincode: stringValue(student.pincode),

    linkedinUrl:

      stringValue(student.linkedinUrl),

    githubUrl:

      stringValue(student.githubUrl),

    portfolioUrl:

      stringValue(student.portfolioUrl),

    applicationStatus:

      stringValue(student.applicationStatus) || "pending",

    submittedAt:

      dateValue(student.submittedAt),

    approvedAt:

      dateValue(student.approvedAt),

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

    internshipEligible,

    internshipApplicationAllowed:

      student.internshipApplicationAllowed === true,

    internshipTrack:
      stringValue(student.internshipTrack),
    selectedInternshipDomain:
      stringValue(student.selectedInternshipDomain),
    internshipDomain:
      stringValue(student.internshipDomain),
    assessmentDomain:
      stringValue(student.assessmentDomain),
    selectedDomain:
      stringValue(student.selectedDomain),
    domain:
      stringValue(student.domain),

    internshipPlan:
      stringValue(student.internshipPlan),

    selectedDuration,
    internshipSelectionAt:
      dateValue(student.internshipSelectionAt),
    internshipSelectionWindowStartedAt:
      dateValue(student.internshipSelectionWindowStartedAt),
    internshipSelectionDeadlineAt:
      dateValue(student.internshipSelectionDeadlineAt),
    internshipSelectionExpiredAt:
      dateValue(student.internshipSelectionExpiredAt),
    internshipSelectionWindowExpired:
      student.internshipSelectionWindowExpired === true ||
      Boolean(
        student.internshipSelectionDeadlineAt &&
        new Date(String(student.internshipSelectionDeadlineAt)).getTime() <= Date.now()
      ),

    internshipDurationDays: numberValue(student.internshipDurationDays),
    internshipStartedAt: dateValue(student.internshipStartedAt),
    internshipEndsAt: dateValue(student.internshipEndsAt),
    studentOpsApprovalStatus: stringValue(student.studentOpsApprovalStatus) || "pending",
    dashboardLoginEnabled: student.dashboardLoginEnabled === true,
    dashboardCredentialsExpiresAt: dateValue(student.dashboardCredentialsExpiresAt),

    internshipStatus,

    startPreference:

      stringValue(student.startPreference),

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
    razorpayPaymentId:
      stringValue(student.razorpayPaymentId) || null,

    paymentCompletedAt:

      dateValue(student.paymentCompletedAt),

    adminApprovalStatus:

      stringValue(student.adminApprovalStatus) || "pending",

    adminApprovedAt:

      dateValue(student.adminApprovedAt),

    dashboardStatus:

      stringValue(student.dashboardStatus) || "locked",

    dashboardActivatedAt:

      dateValue(student.dashboardActivatedAt),

    certificateStatus:

      stringValue(student.certificateStatus) ||

      "not-eligible",

    certificateId:

      stringValue(student.certificateId) || null,

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

    journeyStartedAt:

      dateValue(student.journeyStartedAt),

    journeyExpiresAt:

      dateValue(student.journeyExpiresAt),

    journeyExpired,

    createdAt:

      dateValue(student.createdAt),

    updatedAt:

      dateValue(student.updatedAt),

  };

}

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

          "address",
            "city",
            "state",
            "pincode",
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
          "selectedInternshipDomain",
          "internshipDomain",
          "assessmentDomain",
          "selectedDomain",
          "domain",
          "internshipPlan",
          "selectedDuration",
          "internshipSelectionAt",
          "internshipSelectionWindowStartedAt",
          "internshipSelectionDeadlineAt",
          "internshipSelectionExpiredAt",
          "internshipSelectionWindowExpired",

          "internshipDurationDays",
            "internshipStartedAt",
            "internshipEndsAt",
            "studentOpsApprovalStatus",
            "dashboardLoginEnabled",
            "dashboardCredentialsExpiresAt",
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

const MAX_PROFILE_BODY_BYTES = 16 * 1024;

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0]?.trim() || new URL(request.url).protocol.replace(":", "");
  if (!origin || !host) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host.toLowerCase() === host.split(",")[0].trim().toLowerCase()
      && parsedOrigin.protocol.replace(":", "").toLowerCase() === protocol.toLowerCase();
  } catch { return false; }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("UNSUPPORTED_CONTENT_TYPE");
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROFILE_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  if (!request.body) throw new Error("EMPTY_BODY");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROFILE_BODY_BYTES) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

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

  if (updates.phone) {

    const phoneRegex =

      /^\\+?[1-9]\d{6,19}$/;

    if (!phoneRegex.test(updates.phone)) {

      return {

        success: false,

        message:

          "Please provide a valid phone number.",

      };

    }

  }

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

  if (updates.pincode) {

    if (!/^\d{4,10}$/.test(updates.pincode)) {

      return {

        success: false,

        message:

          "Please provide a valid pincode.",

      };

    }

  }

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

    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { success: false, message: "Request origin could not be verified.", code: "INVALID_ORIGIN" },
        { status: 403, headers: { "Cache-Control": "no-store", "Vary": "Cookie, Origin" } }
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

    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_BODY";
      const status = code === "BODY_TOO_LARGE" ? 413 : 400;
      return NextResponse.json(
        {
          success: false,
          message: code === "BODY_TOO_LARGE" ? "Profile update request is too large." : code === "UNSUPPORTED_CONTENT_TYPE" ? "Content-Type must be application/json." : "Request body must contain valid JSON.",
          code,
        },
        { status, headers: { "Cache-Control": "no-store" } }
      );
    }

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

            "address",
            "city",
            "state",
            "pincode",
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
            "selectedInternshipDomain",
            "internshipDomain",
            "assessmentDomain",
            "selectedDomain",
            "domain",
            "internshipPlan",
            "selectedDuration",
            "internshipSelectionAt",
            "internshipSelectionWindowStartedAt",
            "internshipSelectionDeadlineAt",
            "internshipSelectionExpiredAt",
            "internshipSelectionWindowExpired",

            "internshipDurationDays",
            "internshipStartedAt",
            "internshipEndsAt",
            "studentOpsApprovalStatus",
            "dashboardLoginEnabled",
            "dashboardCredentialsExpiresAt",
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