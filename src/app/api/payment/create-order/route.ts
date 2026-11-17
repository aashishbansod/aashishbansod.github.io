import { NextRequest, NextResponse } from "next/server";

import crypto from "node:crypto";

import connectDB from "@/lib/db";

import Student from "@/models/Student";

import Internship from "@/models/Internship";

import {

  AUTH_COOKIE_NAME,

  STUDENT_AUTH_COOKIE_NAME,

  verifyAccessToken,

} from "@/lib/auth";


export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const revalidate = 0;

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

const RAZORPAY_TIMEOUT_MS = 15_000;
const CHECKOUT_SESSION_DURATION_MS = 10 * 60 * 1000;

const MAX_BODY_BYTES = 16 * 1024;

const MIN_RAZORPAY_AMOUNT_IN_PAISE = 100;

const MAX_RECEIPT_LENGTH = 40;

const PLAN_CONFIG = {

  ONE_MONTH: {

    duration: "1 Month",

    durationMonths: 1,

    durationDays: 30,

    price: 499,

    priceInPaise: 49_900,

    studentPlan: "1 month",

  },

  THREE_MONTHS: {

    duration: "3 Months",

    durationMonths: 3,

    durationDays: 90,

    price: 999,

    priceInPaise: 99_900,

    studentPlan: "3 months",

  },

  SIX_MONTHS: {

    duration: "6 Months",

    durationMonths: 6,

    durationDays: 180,

    price: 1_699,

    priceInPaise: 169_900,

    studentPlan: "6 months",

  },

} as const;

type PlanCode = keyof typeof PLAN_CONFIG;

type CreateOrderBody = { internshipId?: unknown; planCode?: unknown };

type PlainRecord = Record<string, unknown>;

type RazorpayOrder = {

  id?: unknown;

  amount?: unknown;

  currency?: unknown;

  status?: unknown;

  notes?: unknown;

};

type StudentRecord = {

  _id: unknown;

  studentId?: unknown;

  applicationId?: unknown;

  email?: unknown;

  loginEnabled?: unknown;

  accountLocked?: unknown;

  lockedUntil?: unknown;

  emailVerified?: unknown;

  applicationStatus?: unknown;

  adminApprovalStatus?: unknown;

  assessmentStatus?: unknown;

  resultStatus?: unknown;

  internshipApplicationAllowed?: unknown;

  internshipTrack?: unknown;

  internshipPlan?: unknown;

  internshipPlanCode?: unknown;

  internshipDurationDays?: unknown;

  paymentAttemptGroupId?: unknown;

  razorpayCheckoutExpiresAt?: unknown;

  internshipStatus?: unknown;

  paymentStatus?: unknown;

  paymentAmount?: unknown;

  paymentCurrency?: unknown;

  razorpayOrderId?: unknown;

  razorpayPaymentId?: unknown;

  studentOpsStatus?: unknown;

  dashboardStatus?: unknown;

  internshipSelectionDeadlineAt?: unknown;

  internshipSelectionWindowExpired?: unknown;

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

  endDate?: unknown;

  maxStudents?: unknown;

  enrolledStudents?: unknown;

};

function jsonResponse(body: PlainRecord, status = 200): NextResponse {

  return NextResponse.json(body, {

    status,

    headers: {

      "Cache-Control": "private, no-store, no-cache, must-revalidate",

      Pragma: "no-cache",

      Expires: "0",

      "X-Content-Type-Options": "nosniff",

      "X-Frame-Options": "DENY",

      "Referrer-Policy": "same-origin",

      "Cross-Origin-Resource-Policy": "same-origin",

      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",

    },

  });

}

function cleanString(value: unknown): string {

  return typeof value === "string" ? value.trim() : "";

}

function normalizeStatus(value: unknown): string {

  return cleanString(value).toLowerCase().replace(/[\s_]+/g, "-");

}

function toNumber(value: unknown): number | null {

  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (typeof value === "string" && value.trim()) {

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;

  }

  return null;

}

function parsePlanCode(value: unknown): PlanCode | null {

  const normalized = cleanString(value).toUpperCase().replace(/[\s-]+/g, "_");

  if (["ONE_MONTH", "1_MONTH", "1M"].includes(normalized)) return "ONE_MONTH";

  if (["THREE_MONTHS", "3_MONTHS", "3M"].includes(normalized)) return "THREE_MONTHS";

  if (["SIX_MONTHS", "6_MONTHS", "6M"].includes(normalized)) return "SIX_MONTHS";

  return null;

}

function normalizeDomain(value: unknown): string {

  return cleanString(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

}

function domainsMatch(studentDomain: unknown, internshipDomain: unknown): boolean {

  const student = normalizeDomain(studentDomain);

  const internship = normalizeDomain(internshipDomain);

  return Boolean(student && internship && student === internship);

}

function getRazorpayConfig(): { keyId: string; keySecret: string } {

  const keyId = cleanString(process.env.RAZORPAY_KEY_ID) || cleanString(process.env.RAZORPAY_KEY);

  const keySecret = cleanString(process.env.RAZORPAY_KEY_SECRET) || cleanString(process.env.RAZORPAY_SECRET);

  if (!keyId || !keySecret) throw new Error("Razorpay server configuration is missing.");

  return { keyId, keySecret };

}

function createBasicAuth(keyId: string, keySecret: string): string {

  return Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64");

}

async function razorpayRequest<T>(

  path: string,

  config: { keyId: string; keySecret: string },

  method: "GET" | "POST",

  body?: unknown,

): Promise<T> {

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), RAZORPAY_TIMEOUT_MS);

  try {

    const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {

      method,

      cache: "no-store",

      signal: controller.signal,

      headers: {

        Accept: "application/json",

        Authorization: `Basic ${createBasicAuth(config.keyId, config.keySecret)}`,

        ...(body === undefined ? {} : { "Content-Type": "application/json" }),

      },

      ...(body === undefined ? {} : { body: JSON.stringify(body) }),

    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {

      const errorObject =

        payload && typeof payload === "object" && !Array.isArray(payload)

          ? (payload as { error?: { description?: unknown } }).error

          : undefined;

      const description = cleanString(errorObject?.description);

      const error = new Error(description || `Razorpay request failed (${response.status}).`) as Error & {

        status?: number;

      };

      error.status = response.status;

      throw error;

    }

    return payload as T;

  } catch (error) {

    if (error instanceof Error && error.name === "AbortError") {

      throw new Error("Payment gateway request timed out.");

    }

    throw error;

  } finally {

    clearTimeout(timeout);

  }

}

function isTrustedRequestOrigin(request: NextRequest): boolean {

  const origin = request.headers.get("origin")?.trim();

  if (!origin) {

    return request.headers.get("sec-fetch-site")?.toLowerCase() !== "cross-site";

  }

  try {

    const originUrl = new URL(origin);

    const requestUrl = new URL(request.url);

    return originUrl.protocol === requestUrl.protocol && originUrl.host === requestUrl.host;

  } catch {

    return false;

  }

}

async function getAuthenticatedStudent(request: NextRequest): Promise<{ userId: string } | null> {

  const tokens = [

    request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value?.trim() || "",

    request.cookies.get(AUTH_COOKIE_NAME)?.value?.trim() || "",

  ].filter(Boolean);

  for (const token of tokens) {

    try {

      const payload = await verifyAccessToken(token);

      if (!payload) continue;

      const userId = cleanString(payload.userId);

      const role = cleanString(payload.role).toLowerCase();

      const sessionType = cleanString(payload.sessionType).toLowerCase();

      if (!/^[a-f\d]{24}$/i.test(userId) || role !== "student") continue;

      if (["admin", "student-dashboard"].includes(sessionType)) continue;

      if (sessionType && !["student", "legacy"].includes(sessionType)) continue;

      return { userId };

    } catch {

    }

  }

  return null;

}

async function parseRequestBody(request: NextRequest): Promise<CreateOrderBody | null> {

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {

    throw Object.assign(new Error("Request body is too large."), { status: 413 });

  }

  if (!request.body) return null;

  const reader = request.body.getReader();

  const decoder = new TextDecoder("utf-8", { fatal: true });

  const chunks: Uint8Array[] = [];

  let total = 0;

  try {

    while (true) {

      const { done, value } = await reader.read();

      if (done) break;

      if (!value) continue;

      total += value.byteLength;

      if (total > MAX_BODY_BYTES) throw Object.assign(new Error("Request body is too large."), { status: 413 });

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

    throw Object.assign(new Error("Invalid JSON request body."), { status: 400 });

  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const allowedFields = new Set(["internshipId", "planCode"]);
  if (Object.keys(record).some((key) => !allowedFields.has(key))) {
    throw Object.assign(new Error("Request contains unsupported fields."), { status: 400 });
  }

  return record as CreateOrderBody;

}

function orderNotes(order: RazorpayOrder): Record<string, string> {

  if (!order.notes || typeof order.notes !== "object" || Array.isArray(order.notes)) return {};

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(order.notes as Record<string, unknown>)) {

    if (typeof value === "string") result[key] = value.trim();

  }

  return result;

}

function orderMatches(

  order: RazorpayOrder,

  studentId: string,

  internshipId: string,

  planCode: PlanCode,

): boolean {

  const notes = orderNotes(order);

  return (

    notes.studentId === studentId &&

    notes.internshipId === internshipId &&

    parsePlanCode(notes.planCode) === planCode

  );

}

function internshipTitle(internship: InternshipRecord): string {

  return cleanString(internship.title) || cleanString(internship.name) || "Internship Program";

}

function methodNotAllowed(): NextResponse {

  return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED", message: "Only POST is supported." }, 405);

}

export async function POST(request: NextRequest): Promise<NextResponse> {

  try {

    if (!isTrustedRequestOrigin(request)) {

      return jsonResponse({ success: false, code: "UNTRUSTED_ORIGIN", message: "Cross-origin payment requests are not allowed." }, 403);

    }

    const auth = await getAuthenticatedStudent(request);

    if (!auth) {

      return jsonResponse({ success: false, code: "UNAUTHORIZED", message: "Please log in to continue." }, 401);

    }

    const contentType = cleanString(request.headers.get("content-type")).toLowerCase();

    if (!contentType.startsWith("application/json")) {

      return jsonResponse(

        { success: false, code: "UNSUPPORTED_CONTENT_TYPE", message: "Send payment requests as application/json." },

        415,

      );

    }

    let body: CreateOrderBody | null;

    try {

      body = await parseRequestBody(request);

    } catch (error) {

      const status = typeof error === "object" && error !== null && "status" in error

        ? Number((error as { status?: unknown }).status) : 400;

      return jsonResponse({

        success: false,

        code: status === 413 ? "REQUEST_TOO_LARGE" : "INVALID_JSON",

        message: error instanceof Error ? error.message : "Invalid request body.",

      }, status === 413 ? 413 : 400);

    }

    if (!body) {

      return jsonResponse({ success: false, code: "INVALID_REQUEST_BODY", message: "Request body must be a JSON object." }, 400);

    }

    const internshipId = cleanString(body.internshipId);

    const planCode = parsePlanCode(body.planCode);

    if (!/^[a-f\d]{24}$/i.test(internshipId)) {

      return jsonResponse({ success: false, code: "INVALID_INTERNSHIP_ID", message: "A valid internship ID is required." }, 400);

    }

    if (!planCode) {

      return jsonResponse({ success: false, code: "INVALID_PLAN", message: "Choose a valid internship plan." }, 400);

    }

    await connectDB();

    const student = (await Student.findById(auth.userId).lean().exec()) as unknown as StudentRecord | null;

    if (!student) {

      return jsonResponse({ success: false, code: "STUDENT_NOT_FOUND", message: "Student account was not found." }, 404);

    }

    if (student.loginEnabled !== true) {

      return jsonResponse({ success: false, code: "STUDENT_ACCOUNT_DISABLED", message: "Your student account is disabled." }, 403);

    }

    if (student.accountLocked === true) {

      const lockedUntil = student.lockedUntil ? new Date(String(student.lockedUntil)) : null;

      if (!lockedUntil || Number.isNaN(lockedUntil.getTime()) || lockedUntil.getTime() > Date.now()) {

        return jsonResponse({ success: false, code: "STUDENT_ACCOUNT_LOCKED", message: "Your student account is locked." }, 423);

      }

    }

    if (student.emailVerified !== true) {

      return jsonResponse({ success: false, code: "EMAIL_NOT_VERIFIED", message: "Verify your email before payment." }, 403);

    }

    if (
      normalizeStatus(student.applicationStatus) !== "approved" &&
      normalizeStatus(student.adminApprovalStatus) !== "approved"
    ) {
      return jsonResponse({ success: false, code: "APPLICATION_NOT_APPROVED", message: "Your application must be approved first." }, 403);
    }

    if (normalizeStatus(student.assessmentStatus) !== "passed" || normalizeStatus(student.resultStatus) !== "passed") {

      return jsonResponse({ success: false, code: "ASSESSMENT_NOT_PASSED", message: "Your assessment result must be confirmed as passed." }, 403);

    }

    if (student.internshipApplicationAllowed !== true) {

      return jsonResponse({ success: false, code: "INTERNSHIP_SELECTION_NOT_ALLOWED", message: "Internship selection is not enabled for your account." }, 403);

    }

    const paymentStatus = normalizeStatus(student.paymentStatus);

    if (paymentStatus === "paid") {

      return jsonResponse({ success: false, code: "PAYMENT_ALREADY_COMPLETED", message: "Your internship payment is already completed." }, 409);

    }

    if (paymentStatus === "refunded") {

      return jsonResponse({ success: false, code: "PAYMENT_REFUNDED", message: "The previous payment was refunded. Contact support." }, 409);

    }

    const plan = PLAN_CONFIG[planCode];

    const storedPlanCode = parsePlanCode(student.internshipPlanCode) || parsePlanCode(student.internshipPlan);

    if (storedPlanCode !== planCode || (cleanString(student.internshipPlan).toLowerCase() !== plan.studentPlan && !parsePlanCode(student.internshipPlan))) {

      return jsonResponse({ success: false, code: "STUDENT_PLAN_MISMATCH", message: "Payment plan does not match your selected internship plan." }, 409);

    }

    if (normalizeStatus(student.internshipStatus) !== "payment-pending") {

      return jsonResponse({ success: false, code: "PAYMENT_NOT_READY", message: "Your internship selection is not ready for payment." }, 409);

    }

    const existingOrderId = cleanString(student.razorpayOrderId);
    const selectionDeadlineValue = student.internshipSelectionDeadlineAt;
    const selectionDeadline = selectionDeadlineValue
      ? new Date(String(selectionDeadlineValue))
      : null;

    if (!selectionDeadline || Number.isNaN(selectionDeadline.getTime())) {
      return jsonResponse({
        success: false,
        code: "SELECTION_SESSION_NOT_INITIALIZED",
        message: "Your internship selection session is not initialized. Return to internship selection or contact support.",
      }, 409);
    }

    const selectionWindowExpired =
      student.internshipSelectionWindowExpired === true ||
      selectionDeadline.getTime() <= Date.now();

    if (selectionWindowExpired && !existingOrderId) {
      return jsonResponse({
        success: false,
        code: "INTERNSHIP_SELECTION_WINDOW_EXPIRED",
        message: "The 72-hour internship selection window has expired. A new payment order cannot be created. Contact support for assistance.",
      }, 409);
    }

    const internship = (await Internship.findById(internshipId)

      .select({

        _id: 1, title: 1, name: 1, domain: 1, assessmentDomain: 1,

        planCode: 1, duration: 1, durationMonths: 1, price: 1, priceInPaise: 1,

        currency: 1, status: 1, isPublic: 1, isSelectable: 1, endDate: 1,

        maxStudents: 1, enrolledStudents: 1,

      })

      .lean()

      .exec()) as unknown as InternshipRecord | null;

    if (!internship) {

      return jsonResponse({ success: false, code: "INTERNSHIP_NOT_FOUND", message: "Selected internship was not found." }, 404);

    }

    if (normalizeStatus(internship.status) !== "active" || internship.isPublic === false || internship.isSelectable === false) {

      return jsonResponse({ success: false, code: "INTERNSHIP_UNAVAILABLE", message: "This internship is not currently available for selection." }, 409);

    }

    if (internship.endDate) {

      const endDate = new Date(String(internship.endDate));

      if (!Number.isNaN(endDate.getTime()) && Date.now() > endDate.getTime()) {

        return jsonResponse({ success: false, code: "INTERNSHIP_ENDED", message: "This internship program has ended." }, 409);

      }

    }

    if (parsePlanCode(internship.planCode) !== planCode) {

      return jsonResponse({ success: false, code: "PLAN_MISMATCH", message: "The selected plan does not match the internship record." }, 409);

    }

    if (cleanString(internship.duration) !== plan.duration || toNumber(internship.durationMonths) !== plan.durationMonths) {

      return jsonResponse({ success: false, code: "INVALID_PLAN_DURATION", message: "Internship plan configuration is invalid. Contact support." }, 503);

    }

    if (!domainsMatch(student.internshipTrack, internship.domain || internship.assessmentDomain)) {

      return jsonResponse({ success: false, code: "DOMAIN_MISMATCH", message: "This internship does not match your assigned domain." }, 403);

    }

    const dbPrice = toNumber(internship.price);

    const dbPriceInPaise = toNumber(internship.priceInPaise);

    if (

      dbPrice === null || dbPriceInPaise === null ||

      Math.round(dbPrice * 100) !== plan.priceInPaise ||

      Math.round(dbPriceInPaise) !== plan.priceInPaise

    ) {

      return jsonResponse({ success: false, code: "INVALID_PLAN_PRICING", message: "Internship pricing is not configured correctly. Contact support." }, 503);

    }

    if (plan.priceInPaise < MIN_RAZORPAY_AMOUNT_IN_PAISE) {

      return jsonResponse({ success: false, code: "AMOUNT_BELOW_GATEWAY_MINIMUM", message: "Payment amount is below the gateway minimum." }, 503);

    }

    if (cleanString(internship.currency).toUpperCase() !== "INR") {

      return jsonResponse({ success: false, code: "UNSUPPORTED_CURRENCY", message: "Only INR payments are supported." }, 503);

    }

    const maxStudents = toNumber(internship.maxStudents) ?? 0;

    const enrolledStudents = toNumber(internship.enrolledStudents) ?? 0;

    if (maxStudents > 0 && enrolledStudents >= maxStudents) {

      return jsonResponse({ success: false, code: "INTERNSHIP_CAPACITY_FULL", message: "This internship has reached its capacity." }, 409);

    }

    let config: { keyId: string; keySecret: string };

    try {

      config = getRazorpayConfig();

    } catch {

      return jsonResponse({ success: false, code: "RAZORPAY_NOT_CONFIGURED", message: "Payment gateway is not configured on the server." }, 503);

    }

    const dbStudentId = String(student._id);

    const publicStudentId = cleanString(student.studentId) || dbStudentId;

    let order: RazorpayOrder | null = null;
    let reusingExistingOrder = false;
    if (existingOrderId) {

      try {

        const existing = await razorpayRequest<RazorpayOrder>(

          `/orders/${encodeURIComponent(existingOrderId)}`, config, "GET",

        );

        const existingId = cleanString(existing.id);

        const existingAmount = toNumber(existing.amount);

        const existingCurrency = cleanString(existing.currency).toUpperCase();

        const existingStatus = normalizeStatus(existing.status);

        if (existingStatus === "paid") {
          return jsonResponse({
            success: false,
            code: "ORDER_ALREADY_PAID",
            message: "This order is already paid. Please complete payment verification before creating another order.",
          }, 409);
        }

        if (
          existingId === existingOrderId &&
          existingAmount === plan.priceInPaise &&
          existingCurrency === "INR" &&
          orderMatches(existing, publicStudentId, internshipId, planCode) &&
          ["created", "attempted"].includes(existingStatus)
        ) {
          if (paymentStatus !== "pending") {
            return jsonResponse({
              success: false,
              code: "PAYMENT_STATE_RECONCILIATION_REQUIRED",
              message: "The existing payment order is still active but the student payment state is inconsistent. Contact support before retrying.",
            }, 409);
          }
          order = existing;
          reusingExistingOrder = true;
        } else if (!["failed", "cancelled", "canceled", "expired"].includes(existingStatus)) {
          return jsonResponse({
            success: false,
            code: "EXISTING_ORDER_REQUIRES_RECONCILIATION",
            message: "The previous payment order is not in a safely replaceable state. Please contact support before retrying.",
          }, 409);
        }

      } catch (error) {

        console.error("[PAYMENT CREATE ORDER] Existing order lookup failed.", {

          status: error instanceof Error && "status" in error ? (error as Error & { status?: number }).status : undefined,

        });

        return jsonResponse({ success: false, code: "EXISTING_ORDER_CHECK_FAILED", message: "Unable to verify your existing payment order. Please try again." }, 503);

      }

    }

    if (!order && selectionWindowExpired) {
      return jsonResponse({
        success: false,
        code: "INTERNSHIP_SELECTION_WINDOW_EXPIRED",
        message: "The original payment order is no longer active and the 72-hour selection window has expired. Contact support for payment reconciliation.",
      }, 409);
    }

    if (!order) {

      const receipt = `CN-${publicStudentId.replace(/[^a-zA-Z0-9]/g, "").slice(-10)}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`.slice(0, MAX_RECEIPT_LENGTH);

      try {

        order = await razorpayRequest<RazorpayOrder>("/orders", config, "POST", {

          amount: plan.priceInPaise,

          currency: "INR",

          receipt,

          partial_payment: false,

          notes: {

            studentId: publicStudentId,

            studentObjectId: dbStudentId,

            internshipId,

            planCode,

            applicationId: cleanString(student.applicationId) || "NA",

          },

        });

      } catch (error) {

        const status = error instanceof Error && "status" in error

          ? (error as Error & { status?: number }).status : undefined;

        console.error("[PAYMENT CREATE ORDER] Razorpay order creation failed.", { status });

        return jsonResponse({

          success: false,

          code: status === 401 ? "RAZORPAY_AUTH_FAILED" : "RAZORPAY_ORDER_CREATE_FAILED",

          message: status === 401

            ? "Payment gateway authentication failed. Contact support."

            : "Unable to create the payment order. Please try again.",

        }, 502);

      }

    }

    const orderId = cleanString(order.id);

    const orderAmount = toNumber(order.amount);

    const orderCurrency = cleanString(order.currency).toUpperCase();

    const orderStatus = normalizeStatus(order.status);

    if (!orderId || orderAmount !== plan.priceInPaise || orderCurrency !== "INR") {

      return jsonResponse({ success: false, code: "RAZORPAY_ORDER_INVALID", message: "Payment gateway returned an invalid order." }, 502);

    }

    if (!["created", "attempted"].includes(orderStatus)) {

      return jsonResponse({ success: false, code: "RAZORPAY_ORDER_UNAVAILABLE", message: "This payment order is not available for checkout." }, 409);

    }

    if (!orderMatches(order, publicStudentId, internshipId, planCode)) {

      return jsonResponse({ success: false, code: "ORDER_OWNERSHIP_VERIFICATION_FAILED", message: "Payment order ownership verification failed." }, 403);

    }

    const attemptGroupId = crypto.randomUUID();
    const checkoutSessionStartedAt = new Date();
    const checkoutSessionExpiresAt = new Date(checkoutSessionStartedAt.getTime() + CHECKOUT_SESSION_DURATION_MS);
    if (!reusingExistingOrder) {
      const primaryPersistResult = await Student.updateOne(
        {
          _id: student._id,
          paymentStatus: { $nin: ["paid", "refunded"] },
          internshipStatus: student.internshipStatus,
          internshipPlan: student.internshipPlan,
          internshipPlanCode: student.internshipPlanCode ?? { $in: [null, ""] },
          paymentAmount: student.paymentAmount,
          paymentCurrency: student.paymentCurrency,
          razorpayOrderId: existingOrderId || { $in: ["", null] },
          internshipSelectionWindowExpired: { $ne: true },
          internshipSelectionDeadlineAt: { $gt: new Date() },
        },
        {
          $set: {
            razorpayOrderId: orderId,
            paymentStatus: "pending",
            paymentAmount: plan.price,
            paymentCurrency: "INR",
            internshipPlanCode: planCode,
            internshipDurationDays: plan.durationDays,
            paymentAttemptGroupId: attemptGroupId,
            razorpayCheckoutExpiresAt: checkoutSessionExpiresAt,
            paymentExpiredAt: null,
          },
        },
      ).exec();

      if (primaryPersistResult.matchedCount !== 1) {
        return jsonResponse({
          success: false,
          code: "PAYMENT_STATE_CHANGED",
          message: "Your payment state changed while preparing checkout. Refresh the page and verify your payment status before retrying.",
        }, 409);
      }
    }

    if (reusingExistingOrder) {
      await Student.updateOne(
        { _id: student._id, razorpayOrderId: orderId, paymentStatus: "pending" },
        { $set: { internshipPlanCode: planCode, internshipDurationDays: plan.durationDays, paymentAttemptGroupId: attemptGroupId, razorpayCheckoutExpiresAt: checkoutSessionExpiresAt, paymentExpiredAt: null } },
      ).exec();
    }

    return jsonResponse({

      success: true,

      message: selectionWindowExpired
        ? "Your original payment order is available to resume. The 72-hour selection window does not cancel an existing Razorpay order."
        : "Payment order prepared. Complete checkout within the displayed session or reopen checkout to continue with the same order.",

      data: {

        keyId: config.keyId,

        orderId,

        razorpayOrderId: orderId,

        amount: orderAmount / 100,

        amountInPaise: orderAmount,

        currency: "INR",

        internshipId,

        planCode,

        title: internshipTitle(internship),

        internshipTitle: internshipTitle(internship),

        duration: plan.duration,

        durationMonths: plan.durationMonths,

        durationDays: plan.durationDays,

        studentPlan: plan.studentPlan,

        applicationId: cleanString(student.applicationId),

        studentId: cleanString(student.studentId),

        receiptEmail: cleanString(student.email),

        paymentStatus: "pending",

        checkoutSession: {
          mode: "website-session",
          durationSeconds: Math.floor(CHECKOUT_SESSION_DURATION_MS / 1000),
          startedAt: checkoutSessionStartedAt.toISOString(),
          expiresAt: checkoutSessionExpiresAt.toISOString(),
          gatewayOrderExpires: false,
        },

        checkoutSessionDurationSeconds: Math.floor(CHECKOUT_SESSION_DURATION_MS / 1000),
        checkoutSessionStartedAt: checkoutSessionStartedAt.toISOString(),
        checkoutSessionExpiresAt: checkoutSessionExpiresAt.toISOString(),
        gatewayOrderExpires: false,
        selectionWindowExpired,

        internshipStatus: "payment-pending",

        studentOpsStatus: cleanString(student.studentOpsStatus) || "not-ready",

        dashboardStatus: cleanString(student.dashboardStatus) || "locked",

        dashboardLoginEnabled: false,

      },

    });

  } catch (error) {

    console.error("[POST /api/payment/create-order] Unexpected error.", {

      name: error instanceof Error ? error.name : "UnknownError",

    });

    return jsonResponse({ success: false, code: "PAYMENT_ORDER_INTERNAL_ERROR", message: "Unable to prepare payment right now. Please try again." }, 500);

  }

}

export async function GET(): Promise<NextResponse> {

  return methodNotAllowed();

}

export async function PUT(): Promise<NextResponse> {

  return methodNotAllowed();

}

export async function PATCH(): Promise<NextResponse> {

  return methodNotAllowed();

}

export async function DELETE(): Promise<NextResponse> {

  return methodNotAllowed();

}

export async function HEAD(): Promise<NextResponse> {

  return new NextResponse(null, {

    status: 405,

    headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },

  });

}

export async function OPTIONS(): Promise<NextResponse> {

  return new NextResponse(null, {

    status: 204,

    headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },

  });

}
