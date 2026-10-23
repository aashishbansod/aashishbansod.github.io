
import { NextRequest, NextResponse } from "next/server";

import mongoose from "mongoose";

import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";
import InternshipModel from "@/models/Internship";

import {
  AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

import {
  getInternshipPlan,
  isValidInternshipPlan,
  selectInternship,
  type InternshipPlan,
} from "@/services/internship.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 12_000;

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

type TokenPayload = {
  userId?: unknown;
  id?: unknown;
  identifier?: unknown;
  role?: unknown;
  sessionType?: unknown;
};

type SelectionBody = {
  internshipId?: unknown;
  plan?: unknown;
  planCode?: unknown;
  track?: unknown;
  internshipTrack?: unknown;
  startPreference?: unknown;
  dateOfBirth?: unknown;
};

type InternshipRecord = {
  _id: unknown;
  title?: unknown;
  name?: unknown;
  domain?: unknown;
  assessmentDomain?: unknown;
  planCode?: unknown;
  duration?: unknown;
  durationMonths?: unknown;
  price?: unknown;
  priceInPaise?: unknown;
  currency?: unknown;
  status?: unknown;
  isPublic?: unknown;
  isSelectable?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

class InvalidBodyError extends Error {}
class OversizedBodyError extends Error {}

function cleanString(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function json(
  data: Record<string, unknown>,
  status = 200,
  requestId?: string,
) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    },
  });
}

function getRequestId(request: NextRequest): string {
  const value = cleanString(
    request.headers.get("x-request-id"),
    128,
  );

  return /^[a-zA-Z0-9._:-]{8,128}$/.test(value)
    ? value
    : crypto.randomUUID();
}

function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  // Requests without Origin are allowed; cookie authentication and
  // server-side eligibility checks are still required.
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function parseBody(
  request: NextRequest,
): Promise<SelectionBody> {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new InvalidBodyError("Content-Type must be application/json.");
  }

  const length = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    throw new OversizedBodyError();
  }

  if (!request.body) {
    throw new InvalidBodyError("Request body is required.");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value) continue;

      total += value.byteLength;

      if (total > MAX_BODY_BYTES) {
        throw new OversizedBodyError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decoder.decode(bytes));
  } catch {
    throw new InvalidBodyError("Request body contains invalid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InvalidBodyError("A JSON object is required.");
  }

  return parsed as SelectionBody;
}

async function authenticateMainStudent(
  request: NextRequest,
): Promise<{ userId: string } | null> {
  const candidates = [
    request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value,
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
  ].filter((token): token is string => Boolean(token?.trim()));

  for (const token of candidates) {
    try {
      const payload = await verifyAccessToken(token);

      if (!payload || typeof payload !== "object") continue;

      const claims = payload as TokenPayload;

      const userId = cleanString(
        claims.userId ?? claims.id ?? claims.identifier,
        254,
      );

      const role = cleanString(claims.role).toLowerCase();
      const sessionType = cleanString(claims.sessionType).toLowerCase();

      if (!userId || role !== "student") continue;

      if (
        sessionType === "admin" ||
        sessionType === "student-dashboard"
      ) {
        continue;
      }

      if (
        sessionType &&
        sessionType !== "student" &&
        sessionType !== "legacy"
      ) {
        continue;
      }

      return { userId };
    } catch {
      // Never expose session tokens or token-validation errors.
    }
  }

  return null;
}

async function findMainStudent(userId: string) {
  if (mongoose.isValidObjectId(userId)) {
    const byObjectId = await StudentModel.findById(userId)
      .select(
        "studentId email emailVerified applicationStatus adminApprovalStatus " +
          "assessmentStatus resultStatus internshipApplicationAllowed " +
          "loginEnabled accountLocked lockedUntil internshipPlan internshipTrack " +
          "paymentStatus internshipStatus dateOfBirth",
      )
      .lean()
      .exec();

    if (byObjectId) return byObjectId;
  }

  return StudentModel.findOne({ studentId: userId })
    .select(
      "studentId email emailVerified applicationStatus adminApprovalStatus " +
        "assessmentStatus resultStatus internshipApplicationAllowed " +
        "loginEnabled accountLocked lockedUntil",
    )
    .lean()
    .exec();
}

function normalizeStatus(value: unknown): string {
  return cleanString(value, 80).toLowerCase().replace(/_/g, "-");
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    if (!isTrustedOrigin(request)) {
      return json(
        {
          success: false,
          code: "UNTRUSTED_ORIGIN",
          message: "Request origin could not be verified.",
        },
        403,
        requestId,
      );
    }

    const authenticated = await authenticateMainStudent(request);

    if (!authenticated) {
      return json(
        {
          success: false,
          code: "STUDENT_AUTH_REQUIRED",
          message: "Please log in using your main student credentials.",
        },
        401,
        requestId,
      );
    }

    const body = await parseBody(request);

    const requestedPlan = cleanString(
      body.planCode ?? body.plan,
      50,
    ).toUpperCase().replace(/[\\s-]+/g, "_");

    const internshipId = cleanString(body.internshipId, 100);
    const dateOfBirth = cleanString(body.dateOfBirth, 20);
    const startPreference = cleanString(body.startPreference, 100);

    if (!requestedPlan || !isValidInternshipPlan(requestedPlan)) {
      return json(
        {
          success: false,
          code: "INVALID_INTERNSHIP_PLAN",
          message: "Choose a valid internship plan.",
        },
        400,
        requestId,
      );
    }

    await connectDB();

    const student = await findMainStudent(authenticated.userId);

    if (!student || !cleanString(student.studentId, 100)) {
      return json(
        {
          success: false,
          code: "STUDENT_NOT_FOUND",
          message: "Your student account could not be found.",
        },
        404,
        requestId,
      );
    }

    if (student.accountLocked === true) {
      return json(
        {
          success: false,
          code: "ACCOUNT_LOCKED",
          message: "Your account is locked. Please contact support.",
        },
        403,
        requestId,
      );
    }

    if (student.loginEnabled === false) {
      return json(
        {
          success: false,
          code: "STUDENT_LOGIN_DISABLED",
          message: "Your student login is currently disabled.",
        },
        403,
        requestId,
      );
    }

    if (student.emailVerified !== true) {
      return json(
        {
          success: false,
          code: "EMAIL_VERIFICATION_REQUIRED",
          message: "Verify your email before selecting an internship.",
        },
        403,
        requestId,
      );
    }

    const applicationApproved =
      normalizeStatus(student.applicationStatus) === "approved" ||
      normalizeStatus(student.adminApprovalStatus) === "approved";

    if (!applicationApproved) {
      return json(
        {
          success: false,
          code: "APPLICATION_NOT_APPROVED",
          message: "Main Admin approval is required first.",
        },
        403,
        requestId,
      );
    }

    const assessmentPassed =
      normalizeStatus(student.assessmentStatus) === "passed" &&
      normalizeStatus(student.resultStatus) === "passed";

    if (!assessmentPassed) {
      return json(
        {
          success: false,
          code: "ASSESSMENT_NOT_PASSED",
          message: "Pass the main assessment before selecting an internship.",
        },
        403,
        requestId,
      );
    }

    if (student.internshipApplicationAllowed !== true) {
      return json(
        {
          success: false,
          code: "INTERNSHIP_SELECTION_NOT_ALLOWED",
          message: "Internship selection is not enabled for your account.",
        },
        403,
        requestId,
      );
    }

    const plan = getInternshipPlan(requestedPlan);

    if (!plan) {
      return json(
        {
          success: false,
          code: "PLAN_NOT_AVAILABLE",
          message: "The selected internship plan is unavailable.",
        },
        400,
        requestId,
      );
    }

    // The selected program must come from the server database; never trust
    // a client-supplied title, domain, or price.
    if (!mongoose.isValidObjectId(internshipId)) {
      return json(
        {
          success: false,
          code: "INVALID_INTERNSHIP_ID",
          message: "Choose a valid internship program.",
        },
        400,
        requestId,
      );
    }

    const internship = await InternshipModel.findById(internshipId)
      .select(
        "_id title name domain assessmentDomain planCode duration durationMonths " +
          "price priceInPaise currency status isPublic isSelectable startDate endDate",
      )
      .lean()
      .exec() as InternshipRecord | null;

    if (!internship) {
      return json(
        {
          success: false,
          code: "INTERNSHIP_NOT_FOUND",
          message: "The selected internship program was not found.",
        },
        404,
        requestId,
      );
    }

    if (
      normalizeStatus(internship.status) !== "active" ||
      internship.isPublic === false ||
      internship.isSelectable === false
    ) {
      return json(
        {
          success: false,
          code: "INTERNSHIP_UNAVAILABLE",
          message: "This internship program is not currently available.",
        },
        409,
        requestId,
      );
    }

    const storedPlanCode = cleanString(internship.planCode, 50)
      .toUpperCase()
      .replace(/[\\s-]+/g, "_");
    const storedMonths = Number(internship.durationMonths);
    const storedCurrency = cleanString(internship.currency, 8).toUpperCase() || "INR";
    const storedPrice = Number(internship.price);
    const storedPriceInPaise = Number(internship.priceInPaise);
    const authoritativePaise =
      Number.isFinite(storedPriceInPaise) && storedPriceInPaise > 0
        ? storedPriceInPaise
        : Number.isFinite(storedPrice) && storedPrice > 0
          ? Math.round(storedPrice * 100)
          : null;

    if (
      storedPlanCode !== requestedPlan ||
      storedMonths !== plan.durationMonths ||
      storedCurrency !== plan.currency ||
      authoritativePaise === null ||
      authoritativePaise !== plan.amountInPaise
    ) {
      console.error("[STUDENT INTERNSHIP SELECT] Internship plan configuration mismatch", {
        requestId,
        internshipId,
        requestedPlan,
      });

      return json(
        {
          success: false,
          code: "INTERNSHIP_PLAN_CONFIGURATION_MISMATCH",
          message: "This plan is temporarily unavailable. Please contact support.",
        },
        409,
        requestId,
      );
    }

    const track = cleanString(internship.domain, 150) ||
      cleanString(internship.assessmentDomain, 150);

    if (!track) {
      return json(
        {
          success: false,
          code: "INTERNSHIP_DOMAIN_MISSING",
          message: "This internship is not configured correctly. Please contact support.",
        },
        503,
        requestId,
      );
    }

    // Validate DOB as a real calendar date. It is never accepted as an identity
    // field and is only saved after the selection service succeeds.
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateOfBirth)) {
      return json(
        {
          success: false,
          code: "DATE_OF_BIRTH_REQUIRED",
          message: "Enter your date of birth to continue.",
        },
        400,
        requestId,
      );
    }

    const dobDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (
      !Number.isFinite(dobDate.getTime()) ||
      dobDate.toISOString().slice(0, 10) !== dateOfBirth ||
      dobDate.getTime() > Date.now()
    ) {
      return json(
        {
          success: false,
          code: "INVALID_DATE_OF_BIRTH",
          message: "Enter a valid date of birth.",
        },
        400,
        requestId,
      );
    }

    const today = new Date();
    let age = today.getUTCFullYear() - dobDate.getUTCFullYear();
    const beforeBirthday =
      today.getUTCMonth() < dobDate.getUTCMonth() ||
      (today.getUTCMonth() === dobDate.getUTCMonth() &&
        today.getUTCDate() < dobDate.getUTCDate());
    if (beforeBirthday) age -= 1;

    if (age < 13 || age > 100) {
      return json(
        {
          success: false,
          code: "DOB_AGE_OUT_OF_RANGE",
          message: "Your date of birth is outside the allowed range.",
        },
        400,
        requestId,
      );
    }

    const existingPaymentStatus = normalizeStatus(student.paymentStatus);
    const existingInternshipStatus = normalizeStatus(student.internshipStatus);

    if (
      existingPaymentStatus === "paid" ||
      [
        "payment-completed",
        "approved",
        "active",
        "completed",
        "pending-review",
        "under-review",
      ].includes(existingInternshipStatus)
    ) {
      return json(
        {
          success: false,
          code: "INTERNSHIP_ALREADY_SELECTED",
          message:
            "Your internship selection or payment is already in progress. " +
            "Please open your internship status instead of creating another selection.",
        },
        409,
        requestId,
      );
    }

    const existingPlan = cleanString(student.internshipPlan, 50)
      .toUpperCase()
      .replace(/[\\s-]+/g, "_");
    const existingTrack = cleanString(student.internshipTrack, 150);

    // A repeated request for the same unpaid selection is idempotent and can
    // return the student to payment. A different selection must not overwrite
    // an existing pending payment attempt.
    const hasPendingSelection =
      ["pending", "created", "initiated", "unpaid"].includes(existingPaymentStatus) &&
      ["payment-pending", "selected", "pending-payment"].includes(existingInternshipStatus) &&
      Boolean(existingPlan || existingTrack);

    if (
      hasPendingSelection &&
      existingPlan === requestedPlan &&
      existingTrack.toLowerCase() === track.toLowerCase()
    ) {
      return json(
        {
          success: true,
          code: "INTERNSHIP_SELECTION_EXISTS",
          message: "Your selection is already saved. Continue to secure payment.",
          data: {
            internshipId,
            plan: {
              code: plan.code,
              name: plan.name,
              durationMonths: plan.durationMonths,
              durationDays: plan.durationDays,
              amount: plan.amount,
              currency: plan.currency,
              amountInPaise: plan.amountInPaise,
            },
            paymentStatus: "pending",
            dashboardStatus: "locked",
            dashboardLoginEnabled: false,
            nextStep: "PAYMENT",
          },
        },
        200,
        requestId,
      );
    }

    if (hasPendingSelection) {
      return json(
        {
          success: false,
          code: "PENDING_SELECTION_EXISTS",
          message: "You already have a pending selection. Continue or resolve that payment before changing plans.",
        },
        409,
        requestId,
      );
    }

    const result = await selectInternship({
      studentId: cleanString(student.studentId, 100),
      plan: requestedPlan as InternshipPlan,
      track,
      ...(startPreference ? { startPreference } : {}),
    });

    if (!result.success) {
      const failureCode = cleanString(result.code, 100);
      const statusCode =
        failureCode.includes("NOT_FOUND")
          ? 404
          : failureCode.includes("ELIGIBLE") ||
              failureCode.includes("APPROVAL") ||
              failureCode.includes("ASSESSMENT")
            ? 403
            : 422;

      return json(
        {
          success: false,
          code: failureCode || "INTERNSHIP_SELECTION_FAILED",
          message:
            result.message ||
            "Internship selection could not be completed.",
        },
        statusCode,
        requestId,
      );
    }

    await StudentModel.updateOne(
      { _id: (student as { _id?: unknown })._id },
      { $set: { dateOfBirth: dobDate } },
    ).exec();

    return json(
      {
        success: true,
        code: "INTERNSHIP_SELECTED",
        message:
          "Internship selected successfully. Continue to secure payment.",
        data: {
          ...(result.data && typeof result.data === "object"
            ? result.data
            : {}),
          internshipId,
          plan: {
            code: plan.code,
            name: plan.name,
            durationMonths: plan.durationMonths,
            durationDays: plan.durationDays,
            amount: plan.amount,
            currency: plan.currency,
            amountInPaise: plan.amountInPaise,
          },
          paymentStatus: "pending",
          dashboardStatus: "locked",
          dashboardLoginEnabled: false,
          nextStep: "PAYMENT",
        },
      },
      200,
      requestId,
    );
  } catch (error) {
    if (error instanceof OversizedBodyError) {
      return json(
        {
          success: false,
          code: "REQUEST_TOO_LARGE",
          message: "Request body is too large.",
        },
        413,
        requestId,
      );
    }

    if (error instanceof InvalidBodyError) {
      return json(
        {
          success: false,
          code: "INVALID_REQUEST_BODY",
          message: error.message,
        },
        400,
        requestId,
      );
    }

    console.error("[STUDENT INTERNSHIP SELECT API]", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown server error",
    });

    return json(
      {
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to select this internship right now.",
      },
      500,
      requestId,
    );
  }
}

export async function GET() {
  return json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Use POST to select an internship.",
    },
    405,
  );
}

export async function PUT() {
  return json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    },
    405,
  );
}

export async function PATCH() {
  return json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    },
    405,
  );
}

export async function DELETE() {
  return json(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    },
    405,
  );
}
