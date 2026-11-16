import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
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
import { abandonInternshipSelection } from "@/services/student.service";
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
    : randomUUID();
}
function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
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
  const allowed = new Set([
    "internshipId",
    "plan",
    "planCode",
    "track",
    "internshipTrack",
    "startPreference",
    "dateOfBirth",
  ]);
  if (Object.keys(parsed as Record<string, unknown>).some((key) => !allowed.has(key))) {
    throw new InvalidBodyError("The request contains unsupported fields.");
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
          "selectedInternshipDomain internshipDomain assessmentDomain selectedDomain " +
          "paymentStatus internshipStatus dateOfBirth razorpayOrderId " +
          "internshipSelectionWindowStartedAt internshipSelectionDeadlineAt " +
          "internshipSelectionExpiredAt internshipSelectionWindowExpired razorpayPaymentId " +
          "paymentAmount paymentCurrency",
      )
      .lean()
      .exec();
    if (byObjectId) return byObjectId;
  }
  return StudentModel.findOne({ studentId: userId })
    .select(
      "studentId email emailVerified applicationStatus adminApprovalStatus " +
        "assessmentStatus resultStatus internshipApplicationAllowed " +
        "loginEnabled accountLocked lockedUntil internshipPlan internshipTrack " +
        "selectedInternshipDomain internshipDomain assessmentDomain selectedDomain " +
        "paymentStatus internshipStatus dateOfBirth razorpayOrderId " +
          "internshipSelectionWindowStartedAt internshipSelectionDeadlineAt " +
          "internshipSelectionExpiredAt internshipSelectionWindowExpired razorpayPaymentId " +
          "paymentAmount paymentCurrency",
    )
    .lean()
    .exec();
}
function normalizeStatus(value: unknown): string {
  return cleanString(value, 80).toLowerCase().replace(/_/g, "-");
}
function normalizeDomain(value: unknown): string {
  let normalized = cleanString(value, 180)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const suffix = /\s+(developer|development|engineer|engineering)$/i;
  while (suffix.test(normalized)) normalized = normalized.replace(suffix, "").trim();
  return normalized.replace(/\s+/g, " ");
}
function getAssignedStudentDomain(student: Record<string, unknown>): string {
  return (
    cleanString(student.internshipTrack, 180) ||
    cleanString(student.selectedInternshipDomain, 180) ||
    cleanString(student.internshipDomain, 180) ||
    cleanString(student.assessmentDomain, 180) ||
    cleanString(student.selectedDomain, 180)
  );
}
function isValidDateOfBirth(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())
  ) age -= 1;
  return age >= 13 && age <= 100 && date.getTime() <= now.getTime() ? date : null;
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
    ).toUpperCase().replace(/[\s-]+/g, "_");
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
      .replace(/[\s-]+/g, "_");
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
    const assignedDomain = getAssignedStudentDomain(student as unknown as Record<string, unknown>);
    if (!assignedDomain || normalizeDomain(assignedDomain) !== normalizeDomain(track)) {
      return json(
        {
          success: false,
          code: "INTERNSHIP_DOMAIN_MISMATCH",
          message: "You can only select an internship matching your assigned assessment domain.",
        },
        403,
        requestId,
      );
    }
    const dobDate = isValidDateOfBirth(dateOfBirth);
    if (!dobDate) {
      return json(
        {
          success: false,
          code: "INVALID_DATE_OF_BIRTH",
          message: "Enter a valid date of birth. The allowed age range is 13 to 100 years.",
        },
        400,
        requestId,
      );
    }
    const storedDobValue = student.dateOfBirth;
    const storedDob =
      typeof storedDobValue === "string" || typeof storedDobValue === "number" ||
      storedDobValue instanceof Date
        ? new Date(storedDobValue)
        : null;
    if (
      storedDob &&
      Number.isFinite(storedDob.getTime()) &&
      storedDob.toISOString().slice(0, 10) !== dateOfBirth
    ) {
      return json(
        {
          success: false,
          code: "DATE_OF_BIRTH_MISMATCH",
          message: "The date of birth does not match your verified student profile. Contact support to correct it.",
        },
        409,
        requestId,
      );
    }
    const existingPaymentStatus = normalizeStatus(student.paymentStatus);
    const existingInternshipStatus = normalizeStatus(student.internshipStatus);
    const selectionDeadline = student.internshipSelectionDeadlineAt
      ? new Date(student.internshipSelectionDeadlineAt as string | number | Date)
      : null;
    const selectionDeadlineExpired =
      Boolean(
        selectionDeadline &&
        Number.isFinite(selectionDeadline.getTime()) &&
        selectionDeadline.getTime() <= Date.now()
      );

    if (
      student.internshipSelectionWindowExpired === true ||
      selectionDeadlineExpired
    ) {
      if (cleanString(student.razorpayOrderId, 100)) {
        return json(
          {
            success: false,
            code: "PAYMENT_ORDER_REQUIRES_RECONCILIATION",
            message:
              "A payment order is already associated with this selection. Its final payment status must be confirmed before the session can be expired.",
            data: {
              expired: false,
              paymentStatus: existingPaymentStatus || "pending",
              dashboardStatus: "locked",
              dashboardLoginEnabled: false,
            },
          },
          409,
          requestId,
        );
      }

      if (student.internshipSelectionWindowExpired !== true) {
        const expiryResult = await abandonInternshipSelection({
          studentId: cleanString(student.studentId, 100),
        });

        if (!expiryResult.success) {
          const expiryCode = cleanString(expiryResult.code, 100);
          return json(
            {
              success: false,
              code: expiryCode || "INTERNSHIP_SELECTION_EXPIRE_CONFLICT",
              message:
                expiryResult.message ||
                "The expired selection session could not be finalized. Refresh and contact support if the issue continues.",
            },
            expiryCode === "PAYMENT_ALREADY_VERIFIED" ||
            expiryCode === "PAYMENT_ORDER_ALREADY_CREATED" ||
            expiryCode === "INTERNSHIP_SELECTION_EXPIRE_CONFLICT"
              ? 409
              : 422,
            requestId,
          );
        }
      }

      return json(
        {
          success: false,
          code: "INTERNSHIP_SELECTION_SESSION_EXPIRED",
          message:
            "Your 72-hour internship selection session has expired. Contact support to request a new selection window.",
          data: {
            expired: true,
            deadlineAt: selectionDeadline,
            paymentStatus: existingPaymentStatus || "unpaid",
            dashboardStatus: "locked",
            dashboardLoginEnabled: false,
          },
        },
        410,
        requestId,
      );
    }
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
    const rawExistingPlan = cleanString(student.internshipPlan, 50)
      .toUpperCase()
      .replace(/[\\s-]+/g, "_");
    const existingPlanDetails = rawExistingPlan
      ? getInternshipPlan(rawExistingPlan)
      : null;
    const existingPlan = existingPlanDetails?.code || rawExistingPlan;
    const existingTrack = cleanString(student.internshipTrack, 150);
    const existingOrderId = cleanString(student.razorpayOrderId, 100);
    const terminalPaymentState =
      ["failed", "cancelled", "canceled", "expired"].includes(existingPaymentStatus) ||
      [
        "payment-failed",
        "payment-cancelled",
        "payment-canceled",
        "payment-expired",
        "cancelled",
        "canceled",
        "expired",
      ].includes(existingInternshipStatus);
    const hasPendingSelection =
      ["pending", "created", "initiated", "unpaid"].includes(existingPaymentStatus) &&
      ["payment-pending", "selected", "pending-payment"].includes(existingInternshipStatus) &&
      Boolean(existingPlan || existingTrack || existingOrderId);
    const sameStoredPlan = existingPlan === requestedPlan;
    const sameStoredTrack =
      Boolean(existingTrack) &&
      normalizeDomain(existingTrack) === normalizeDomain(track);
    const hasUnresolvedOrder =
      Boolean(existingOrderId) &&
      !terminalPaymentState &&
      existingPaymentStatus !== "paid" &&
      !cleanString(student.razorpayPaymentId, 100);

    if (hasPendingSelection && sameStoredPlan && sameStoredTrack) {
      return json(
        {
          success: true,
          code: "INTERNSHIP_SELECTION_EXISTS",
          message: "Your internship selection is already saved. Continue with the existing payment attempt.",
          data: {
            internshipId,
            existingOrderId: existingOrderId || null,
            plan: {
              code: plan.code,
              name: plan.name,
              durationMonths: plan.durationMonths,
              durationDays: plan.durationDays,
              amount: plan.amount,
              currency: plan.currency,
              amountInPaise: plan.amountInPaise,
            },
            paymentStatus: existingPaymentStatus || "pending",
            paymentAttempt: hasUnresolvedOrder ? "resume-existing-order" : "continue",
            dashboardStatus: "locked",
            dashboardLoginEnabled: false,
            nextStep: "PAYMENT",
          },
        },
        200,
        requestId,
      );
    }

    if (hasUnresolvedOrder) {
      return json(
        {
          success: false,
          code: "PAYMENT_ORDER_REQUIRES_RECONCILIATION",
          message:
            "A previous Razorpay payment is still pending for this student. Resume that payment or confirm its final status before changing the internship plan.",
          data: {
            existingOrderId,
            existingPlan: existingPlan || null,
            existingTrack: existingTrack || null,
            paymentAmount: Number(student.paymentAmount) || null,
            paymentCurrency: cleanString(student.paymentCurrency, 8).toUpperCase() || "INR",
            paymentStatus: existingPaymentStatus || "pending",
            canResumeExistingPayment: true,
            dashboardStatus: "locked",
            dashboardLoginEnabled: false,
          },
        },
        409,
        requestId,
      );
    }

    if (terminalPaymentState && cleanString(student.razorpayOrderId, 100)) {
      const clearOrderResult = await StudentModel.updateOne(
        {
          _id: (student as { _id?: unknown })._id,
          razorpayOrderId: cleanString(student.razorpayOrderId, 100),
          paymentStatus: {
            $in: ["failed", "cancelled", "canceled", "expired"],
          },
          $or: [
            { razorpayPaymentId: { $exists: false } },
            { razorpayPaymentId: null },
            { razorpayPaymentId: "" },
          ],
        },
        {
          $unset: { razorpayOrderId: 1 },
        },
      ).exec();

      if (Number(clearOrderResult.matchedCount ?? 0) !== 1) {
        return json(
          {
            success: false,
            code: "PAYMENT_ORDER_RECONCILIATION_REQUIRED",
            message:
              "The previous payment attempt could not be safely cleared. Refresh the page and check your payment status before changing the plan.",
          },
          409,
          requestId,
        );
      }
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
    if (!storedDob) {
      const dobUpdate = await StudentModel.updateOne(
        {
          _id: (student as { _id?: unknown })._id,
          dateOfBirth: { $in: [null, undefined] },
        },
        { $set: { dateOfBirth: dobDate } },
      ).exec();
      if (Number(dobUpdate.matchedCount ?? 0) !== 1) {
        return json(
          {
            success: false,
            code: "DATE_OF_BIRTH_UPDATE_CONFLICT",
            message: "Your profile changed while saving your date of birth. Refresh and try again.",
          },
          409,
          requestId,
        );
      }
    }
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
export async function DELETE(request: NextRequest) {
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

    if (student.accountLocked === true || student.loginEnabled === false) {
      return json(
        {
          success: false,
          code: "STUDENT_ACCOUNT_UNAVAILABLE",
          message: "Your student account is currently unavailable.",
        },
        403,
        requestId,
      );
    }

    const result = await abandonInternshipSelection({
      studentId: cleanString(student.studentId, 100),
    });

    if (!result.success) {
      const code = cleanString(result.code, 100);
      const status =
        code === "STUDENT_NOT_FOUND" ? 404 :
        code === "PAYMENT_ALREADY_VERIFIED" ||
        code === "PAYMENT_REFUNDED" ? 409 :
        code === "PAYMENT_ORDER_ALREADY_CREATED" ||
        code === "INTERNSHIP_SELECTION_EXPIRE_CONFLICT" ? 409 :
        code.includes("NOT_AVAILABLE") ? 403 : 422;

      return json(
        {
          success: false,
          code: code || "INTERNSHIP_SELECTION_ABANDON_FAILED",
          message: result.message || "The internship selection session could not be expired.",
        },
        status,
        requestId,
      );
    }

    return json(
      {
        success: true,
        code: cleanString(result.code, 100) || "INTERNSHIP_SELECTION_EXPIRED",
        message: result.message || "Internship selection session expired successfully.",
        data: result.data && typeof result.data === "object"
          ? result.data as Record<string, unknown>
          : { expired: true },
      },
      200,
      requestId,
    );
  } catch (error) {
    console.error("[STUDENT INTERNSHIP SELECT DELETE API]", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown server error",
    });

    return json(
      {
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to expire the internship selection session right now.",
      },
      500,
      requestId,
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: RESPONSE_HEADERS,
  });
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    ...RESPONSE_HEADERS,
    Allow: "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
  };

  if (origin && isTrustedOrigin(request)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Request-Id";
    headers.Vary = "Cookie, Origin";
  }

  return new NextResponse(null, { status: 204, headers });
}
