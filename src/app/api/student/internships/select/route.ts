import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
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
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  Vary: "Cookie",
};

type TokenPayload = {
  userId?: unknown;
  id?: unknown;
  identifier?: unknown;
  role?: unknown;
  sessionType?: unknown;
};

type RequestBody = {
  internshipId?: unknown;
  planCode?: unknown;
  plan?: unknown;
  dateOfBirth?: unknown;
  startPreference?: unknown;
};

type AnyRecord = Record<string, unknown>;

type RouteStudent = AnyRecord & {
  _id?: unknown;
  studentId?: unknown;
  emailVerified?: unknown;
  applicationStatus?: unknown;
  adminApprovalStatus?: unknown;
  assessmentStatus?: unknown;
  resultStatus?: unknown;
  internshipApplicationAllowed?: unknown;
  loginEnabled?: unknown;
  accountLocked?: unknown;
  lockedUntil?: unknown;
  internshipPlan?: unknown;
  internshipTrack?: unknown;
  paymentStatus?: unknown;
  internshipStatus?: unknown;
  dateOfBirth?: unknown;
  assessmentDomain?: unknown;
  selectedDomain?: unknown;
  selectedInternshipDomain?: unknown;
  domain?: unknown;
};

type PlanRecord = {
  internshipId?: unknown;
  planCode?: unknown;
  code?: unknown;
  duration?: unknown;
  durationMonths?: unknown;
  price?: unknown;
  priceInPaise?: unknown;
  currency?: unknown;
};

type RouteInternship = AnyRecord & {
  _id?: unknown;
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
  isActive?: unknown;
  isPublic?: unknown;
  isSelectable?: unknown;
  plans?: unknown;
};

class RequestBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestBodyError";
  }
}

function cleanString(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

function normalizeStatus(value: unknown): string {
  return cleanString(value, 80).toLowerCase().replace(/_/g, "-");
}

function normalizeDomain(value: unknown): string {
  return cleanString(value, 180)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function response(
  body: Record<string, unknown>,
  status = 200,
  requestId?: string,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      ...(requestId ? { "X-Request-Id": requestId } : {}),
    },
  });
}

function requestIdFor(request: NextRequest): string {
  const incoming = cleanString(request.headers.get("x-request-id"), 128);
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

function trustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  // Some same-origin clients omit Origin. Authentication and server-side
  // authorization remain mandatory in that case.
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readBody(request: NextRequest): Promise<RequestBody> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RequestBodyError("Content-Type must be application/json.");
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestBodyError("Request body is too large.");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new RequestBodyError("Request body is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RequestBodyError("Request body contains invalid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RequestBodyError("A JSON object is required.");
  }

  return parsed as RequestBody;
}

async function authenticateStudent(
  request: NextRequest,
): Promise<{ userId: string } | null> {
  const tokens = [
    request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value,
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
  ].filter((token): token is string => Boolean(token?.trim()));

  for (const token of tokens) {
    try {
      const payload = await verifyAccessToken(token);
      if (!payload || typeof payload !== "object") continue;

      const claims = payload as TokenPayload;
      const userId = cleanString(
        claims.userId ?? claims.id ?? claims.identifier,
        254,
      );
      const role = cleanString(claims.role, 40).toLowerCase();
      const sessionType = cleanString(claims.sessionType, 60).toLowerCase();

      if (!userId || role !== "student") continue;
      if (sessionType === "admin" || sessionType === "student-dashboard") continue;
      if (sessionType && !["student", "legacy"].includes(sessionType)) continue;

      return { userId };
    } catch {
      // Never return token details to the caller.
    }
  }

  return null;
}

async function findStudent(userId: string): Promise<RouteStudent | null> {
  const fields =
    "studentId email emailVerified applicationStatus adminApprovalStatus " +
    "assessmentStatus resultStatus internshipApplicationAllowed loginEnabled " +
    "accountLocked lockedUntil internshipPlan internshipTrack paymentStatus " +
    "internshipStatus dateOfBirth assessmentDomain selectedDomain " +
    "selectedInternshipDomain domain";

  if (mongoose.isValidObjectId(userId)) {
    const byObjectId = await StudentModel.findById(userId)
      .select(fields)
      .lean()
      .exec();
    if (byObjectId) return byObjectId as RouteStudent;
  }

  const byStudentId = await StudentModel.findOne({ studentId: userId })
    .select(fields)
    .lean()
    .exec();

  return (byStudentId as RouteStudent | null) ?? null;
}

function assignedStudentDomain(student: RouteStudent): string {
  return (
    cleanString(student.selectedInternshipDomain, 180) ||
    cleanString(student.assessmentDomain, 180) ||
    cleanString(student.internshipTrack, 180) ||
    cleanString(student.selectedDomain, 180) ||
    cleanString(student.domain, 180)
  );
}

function validDob(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getTime() > Date.now()
  ) {
    return null;
  }

  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() &&
      now.getUTCDate() < date.getUTCDate())
  ) {
    age -= 1;
  }
  return age >= 13 && age <= 100 ? date : null;
}

function normalizedPlanCode(value: unknown): string {
  return cleanString(value, 50).toUpperCase().replace(/[\s-]+/g, "_");
}

function findMatchingPlan(
  internship: RouteInternship,
  requestedPlan: string,
  internshipId: string,
): PlanRecord | null {
  if (Array.isArray(internship.plans)) {
    for (const item of internship.plans) {
      if (!item || typeof item !== "object") continue;
      const plan = item as PlanRecord;
      if (normalizedPlanCode(plan.planCode ?? plan.code) === requestedPlan) {
        return { ...plan, internshipId: cleanString(plan.internshipId, 100) || internshipId };
      }
    }
  }

  // Legacy schema support: a program may store one plan at the document root.
  if (normalizedPlanCode(internship.planCode) === requestedPlan) {
    return {
      internshipId,
      planCode: internship.planCode,
      duration: internship.duration,
      durationMonths: internship.durationMonths,
      price: internship.price,
      priceInPaise: internship.priceInPaise,
      currency: internship.currency,
    };
  }

  return null;
}

function planAmountPaise(planRecord: PlanRecord): number | null {
  const paise = Number(planRecord.priceInPaise);
  if (Number.isFinite(paise) && paise >= 0) return Math.round(paise);

  const price = Number(planRecord.price);
  if (Number.isFinite(price) && price >= 0) return Math.round(price * 100);

  return null;
}

export async function POST(request: NextRequest) {
  const requestId = requestIdFor(request);

  try {
    if (!trustedOrigin(request)) {
      return response(
        {
          success: false,
          code: "UNTRUSTED_ORIGIN",
          message: "Request origin could not be verified.",
        },
        403,
        requestId,
      );
    }

    const auth = await authenticateStudent(request);
    if (!auth) {
      return response(
        {
          success: false,
          code: "STUDENT_AUTH_REQUIRED",
          message: "Please log in using your main student credentials.",
        },
        401,
        requestId,
      );
    }

    const body = await readBody(request);
    const internshipId = cleanString(body.internshipId, 100);
    const planCode = normalizedPlanCode(body.planCode ?? body.plan);
    const dateOfBirth = cleanString(body.dateOfBirth, 20);
    const startPreference = cleanString(body.startPreference, 100);

    if (!internshipId || !mongoose.isValidObjectId(internshipId)) {
      return response(
        {
          success: false,
          code: "INVALID_INTERNSHIP_ID",
          message: "Choose a valid internship program.",
        },
        400,
        requestId,
      );
    }

    if (!planCode || !isValidInternshipPlan(planCode)) {
      return response(
        {
          success: false,
          code: "INVALID_INTERNSHIP_PLAN",
          message: "Choose a valid internship plan.",
        },
        400,
        requestId,
      );
    }

    const dob = validDob(dateOfBirth);
    if (!dob) {
      return response(
        {
          success: false,
          code: "INVALID_DATE_OF_BIRTH",
          message: "Enter a valid date of birth.",
        },
        400,
        requestId,
      );
    }

    await connectDB();

    const student = await findStudent(auth.userId);
    if (!student || !cleanString(student.studentId, 100)) {
      return response(
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
      return response(
        { success: false, code: "ACCOUNT_LOCKED", message: "Your account is locked. Please contact support." },
        403,
        requestId,
      );
    }

    if (student.loginEnabled === false) {
      return response(
        { success: false, code: "STUDENT_LOGIN_DISABLED", message: "Your student login is currently disabled." },
        403,
        requestId,
      );
    }

    if (student.emailVerified !== true) {
      return response(
        { success: false, code: "EMAIL_VERIFICATION_REQUIRED", message: "Verify your email before selecting an internship." },
        403,
        requestId,
      );
    }

    const applicationApproved =
      normalizeStatus(student.applicationStatus) === "approved" ||
      normalizeStatus(student.adminApprovalStatus) === "approved";

    if (!applicationApproved) {
      return response(
        { success: false, code: "APPLICATION_NOT_APPROVED", message: "Main Admin approval is required first." },
        403,
        requestId,
      );
    }

    const assessmentPassed =
      normalizeStatus(student.assessmentStatus) === "passed" &&
      normalizeStatus(student.resultStatus) === "passed";

    if (!assessmentPassed) {
      return response(
        { success: false, code: "ASSESSMENT_NOT_PASSED", message: "Pass the main assessment before selecting an internship." },
        403,
        requestId,
      );
    }

    if (student.internshipApplicationAllowed !== true) {
      return response(
        { success: false, code: "INTERNSHIP_SELECTION_NOT_ALLOWED", message: "Internship selection is not enabled for your account." },
        403,
        requestId,
      );
    }

    const plan = getInternshipPlan(planCode);
    if (!plan) {
      return response(
        { success: false, code: "PLAN_NOT_AVAILABLE", message: "The selected internship plan is unavailable." },
        400,
        requestId,
      );
    }

    const internship = (await InternshipModel.findById(internshipId)
      .select(
        "_id title name domain assessmentDomain planCode duration durationMonths " +
          "price priceInPaise currency status isActive isPublic isSelectable plans",
      )
      .lean()
      .exec()) as RouteInternship | null;

    if (!internship) {
      return response(
        { success: false, code: "INTERNSHIP_NOT_FOUND", message: "The selected internship program was not found." },
        404,
        requestId,
      );
    }

    const internshipStatus = normalizeStatus(internship.status);
    if (
      (internshipStatus && internshipStatus !== "active") ||
      internship.isActive === false ||
      internship.isPublic === false ||
      internship.isSelectable === false
    ) {
      return response(
        { success: false, code: "INTERNSHIP_UNAVAILABLE", message: "This internship program is not currently available." },
        409,
        requestId,
      );
    }

    const studentDomain = assignedStudentDomain(student);
    const programDomain =
      cleanString(internship.domain, 180) ||
      cleanString(internship.assessmentDomain, 180);

    if (!studentDomain) {
      return response(
        { success: false, code: "STUDENT_DOMAIN_NOT_ASSIGNED", message: "Your internship domain is not assigned. Contact Student Operations." },
        403,
        requestId,
      );
    }

    if (!programDomain || normalizeDomain(studentDomain) !== normalizeDomain(programDomain)) {
      return response(
        { success: false, code: "DOMAIN_MISMATCH", message: "This internship does not belong to your assigned assessment domain." },
        403,
        requestId,
      );
    }

    const databasePlan = findMatchingPlan(internship, planCode, internshipId);
    if (!databasePlan) {
      return response(
        { success: false, code: "PLAN_NOT_CONFIGURED", message: "This duration is not configured for the selected internship." },
        409,
        requestId,
      );
    }

    const databaseMonths = Number(databasePlan.durationMonths);
    const databaseCurrency = cleanString(databasePlan.currency ?? internship.currency, 8).toUpperCase() || "INR";
    const databasePaise = planAmountPaise(databasePlan);

    if (
      databaseMonths !== plan.durationMonths ||
      databaseCurrency !== plan.currency ||
      databasePaise === null ||
      databasePaise !== plan.amountInPaise
    ) {
      console.error("[STUDENT INTERNSHIP SELECT] Plan configuration mismatch", {
        requestId,
        internshipId,
        planCode,
      });
      return response(
        { success: false, code: "PLAN_CONFIGURATION_MISMATCH", message: "This plan is temporarily unavailable. Please contact support." },
        409,
        requestId,
      );
    }

    const paymentStatus = normalizeStatus(student.paymentStatus);
    const currentInternshipStatus = normalizeStatus(student.internshipStatus);
    const completedOrInProgress = [
      "paid",
      "payment-completed",
      "approved",
      "active",
      "completed",
      "pending-review",
      "under-review",
    ].includes(paymentStatus) || [
      "payment-completed",
      "approved",
      "active",
      "completed",
      "pending-review",
      "under-review",
    ].includes(currentInternshipStatus);

    if (completedOrInProgress) {
      return response(
        {
          success: false,
          code: "INTERNSHIP_ALREADY_SELECTED",
          message: "Your internship selection or payment is already in progress. Open your internship status instead.",
        },
        409,
        requestId,
      );
    }

    const existingPlan = normalizedPlanCode(student.internshipPlan);
    const existingTrack = cleanString(student.internshipTrack, 180);
    const pendingPayment = ["pending", "created", "initiated", "unpaid"].includes(paymentStatus) &&
      ["payment-pending", "selected", "pending-payment"].includes(currentInternshipStatus);

    if (pendingPayment) {
      if (
        existingPlan === planCode &&
        normalizeDomain(existingTrack) === normalizeDomain(programDomain)
      ) {
        return response(
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

      return response(
        { success: false, code: "PENDING_SELECTION_EXISTS", message: "You already have a pending selection. Continue or resolve that payment before changing plans." },
        409,
        requestId,
      );
    }

    const result = await selectInternship({
      studentId: cleanString(student.studentId, 100),
      plan: planCode as InternshipPlan,
      track: programDomain,
      ...(startPreference ? { startPreference } : {}),
    });

    if (!result.success) {
      const code = cleanString(result.code, 100) || "INTERNSHIP_SELECTION_FAILED";
      const httpStatus =
        code.includes("NOT_FOUND") ? 404 :
        code.includes("ELIGIBLE") || code.includes("APPROVAL") || code.includes("ASSESSMENT") ? 403 :
        code.includes("ALREADY") || code.includes("PENDING") ? 409 : 422;

      return response(
        { success: false, code, message: result.message || "Internship selection could not be completed." },
        httpStatus,
        requestId,
      );
    }

    await StudentModel.updateOne(
      { _id: student._id },
      { $set: { dateOfBirth: dob } },
    ).exec();

    return response(
      {
        success: true,
        code: "INTERNSHIP_SELECTED",
        message: "Internship selected successfully. Continue to secure payment.",
        data: {
          ...(result.data && typeof result.data === "object" ? result.data : {}),
          internshipId,
          internshipTitle: cleanString(internship.title ?? internship.name, 200),
          internshipDomain: programDomain,
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
    if (error instanceof RequestBodyError) {
      const tooLarge = error.message === "Request body is too large.";
      return response(
        {
          success: false,
          code: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST_BODY",
          message: error.message,
        },
        tooLarge ? 413 : 400,
        requestId,
      );
    }

    console.error("[STUDENT INTERNSHIP SELECT API]", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown server error",
    });

    return response(
      { success: false, code: "INTERNAL_SERVER_ERROR", message: "Unable to select this internship right now." },
      500,
      requestId,
    );
  }
}

export async function GET() {
  return response(
    { success: false, code: "METHOD_NOT_ALLOWED", message: "Use POST to select an internship." },
    405,
  );
}

export async function PUT() {
  return response({ success: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, 405);
}

export async function PATCH() {
  return response({ success: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, 405);
}

export async function DELETE() {
  return response({ success: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, 405);
}
