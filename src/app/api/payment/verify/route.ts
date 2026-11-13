import { NextRequest, NextResponse } from "next/server";

import mongoose from "mongoose";

import crypto from "node:crypto";

import connectDB from "@/lib/mongodb";

import Student from "@/models/Student";

import Internship from "@/models/Internship";

import Application from "@/models/Application";
import Payment from "@/models/Payment";

import {

  AUTH_COOKIE_NAME,

  STUDENT_AUTH_COOKIE_NAME,

  verifyAccessToken,

} from "@/lib/auth";

import { recordVerifiedPayment } from "@/services/student.service";

import { sendPaymentReceiptEmail } from "@/services/email.service";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const revalidate = 0;

const RAZORPAY_API = "https://api.razorpay.com/v1";

const REQUEST_TIMEOUT_MS = 15_000;

const MAX_BODY_BYTES = 16 * 1024;

const MIN_AMOUNT_PAISE = 100;

const PLANS = {

  ONE_MONTH: { duration: "1 Month", months: 1, days: 30, amount: 499, paise: 49_900, studentPlan: "1 month" },

  THREE_MONTHS: { duration: "3 Months", months: 3, days: 90, amount: 999, paise: 99_900, studentPlan: "3 months" },

  SIX_MONTHS: { duration: "6 Months", months: 6, days: 180, amount: 1_699, paise: 169_900, studentPlan: "6 months" },

} as const;

type PlanCode = keyof typeof PLANS;

type VerifyBody = {

  internshipId?: unknown;

  planCode?: unknown;

  razorpayOrderId?: unknown;

  razorpayPaymentId?: unknown;

  razorpaySignature?: unknown;

};

type TokenClaims = {

  userId?: unknown;

  id?: unknown;

  identifier?: unknown;

  role?: unknown;

  sessionType?: unknown;

};

type RazorpayOrder = {

  id?: unknown;

  amount?: unknown;

  currency?: unknown;

  status?: unknown;

  notes?: unknown;

};

type RazorpayPayment = {

  id?: unknown;

  amount?: unknown;

  currency?: unknown;

  status?: unknown;

  captured?: unknown;

  order_id?: unknown;

};

type StudentRecord = {

  _id: unknown;

  studentId?: unknown;

  applicationId?: unknown;

  fullName?: unknown;

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

  internshipStatus?: unknown;

  paymentStatus?: unknown;

  paymentAmount?: unknown;

  paymentCurrency?: unknown;

  razorpayOrderId?: unknown;

  razorpayPaymentId?: unknown;

  receiptEmailSent?: unknown;

  studentOpsStatus?: unknown;

  studentOpsApprovalStatus?: unknown;

  dashboardStatus?: unknown;

  dashboardLoginEnabled?: unknown;

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

};

function json(body: Record<string, unknown>, status = 200): NextResponse {

  return NextResponse.json(body, {

    status,

    headers: {

      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",

      Pragma: "no-cache",

      Expires: "0",

      "X-Content-Type-Options": "nosniff",

      "X-Frame-Options": "DENY",

      "Referrer-Policy": "same-origin",

      "Cross-Origin-Resource-Policy": "same-origin",

      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",

      Allow: "POST, OPTIONS",

    },

  });

}

function fail(message: string, code: string, status = 400): NextResponse {

  return json({ success: false, verified: false, message, code }, status);

}

function clean(value: unknown, max = 200): string {

  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : "";

}

function numberValue(value: unknown): number | null {

  if (typeof value !== "number" && typeof value !== "string") return null;

  if (typeof value === "string" && !value.trim()) return null;

  const n = Number(value);

  return Number.isFinite(n) ? n : null;

}

function statusOf(value: unknown): string {

  return clean(value).toLowerCase().replace(/_/g, "-");

}

function normalizePlan(value: unknown): PlanCode | null {

  const key = clean(value).toUpperCase().replace(/[\s-]+/g, "_");

  if (["ONE_MONTH", "1_MONTH", "1M"].includes(key)) return "ONE_MONTH";

  if (["THREE_MONTHS", "3_MONTHS", "3M"].includes(key)) return "THREE_MONTHS";

  if (["SIX_MONTHS", "6_MONTHS", "6M"].includes(key)) return "SIX_MONTHS";

  return null;

}

function normalizeDomain(value: unknown): string {

  return clean(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

}

function sameDomain(studentDomain: unknown, domain: unknown, assessmentDomain: unknown): boolean {

  const student = normalizeDomain(studentDomain);

  return Boolean(student && (student === normalizeDomain(domain) || student === normalizeDomain(assessmentDomain)));

}

function getTitle(internship: InternshipRecord): string {

  return clean(internship.title) || clean(internship.name) || "CyberNet Careers Internship";

}

function razorpayConfig(): { keyId: string; keySecret: string } {

  const keyId = clean(process.env.RAZORPAY_KEY_ID) || clean(process.env.RAZORPAY_KEY);

  const keySecret = clean(process.env.RAZORPAY_KEY_SECRET) || clean(process.env.RAZORPAY_SECRET);

  if (!keyId || !keySecret) throw new Error("RAZORPAY_NOT_CONFIGURED");

  return { keyId, keySecret };

}

function signature(orderId: string, paymentId: string, secret: string): string {

  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`, "utf8").digest("hex");

}

function safeHexEqual(a: string, b: string): boolean {

  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;

  const aa = Buffer.from(a, "hex");

  const bb = Buffer.from(b, "hex");

  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);

}

function basicAuth(keyId: string, keySecret: string): string {

  return Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64");

}

async function razorpayFetch<T>(

  path: string,

  config: { keyId: string; keySecret: string },

  method: "GET" | "POST",

  body?: Record<string, unknown>,

): Promise<T> {

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {

    const response = await fetch(`${RAZORPAY_API}${path}`, {

      method,

      cache: "no-store",

      signal: controller.signal,

      headers: {

        Accept: "application/json",

        Authorization: `Basic ${basicAuth(config.keyId, config.keySecret)}`,

        ...(body ? { "Content-Type": "application/json" } : {}),

      },

      ...(body ? { body: JSON.stringify(body) } : {}),

    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {

      const message =

        payload && typeof payload === "object" && "error" in payload

          ? clean((payload as { error?: { description?: unknown } }).error?.description)

          : "";

      const error = new Error(message || `Razorpay API returned ${response.status}`);

      (error as Error & { status?: number }).status = response.status;

      throw error;

    }

    return payload as T;

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

async function authenticate(request: NextRequest): Promise<{ userId: string } | null> {

  const tokens = [

    request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value,

    request.cookies.get(AUTH_COOKIE_NAME)?.value,

  ].filter((v): v is string => Boolean(v?.trim()));

  for (const token of tokens) {

    try {

      const payload = await verifyAccessToken(token);

      if (!payload || typeof payload !== "object") continue;

      const claims = payload as TokenClaims;

      const userId = clean(claims.userId ?? claims.id ?? claims.identifier);

      const role = clean(claims.role).toLowerCase();

      const session = clean(claims.sessionType).toLowerCase();

      if (!userId || role !== "student") continue;

      if (session === "admin" || session === "student-dashboard") continue;

      if (session && !["student", "legacy"].includes(session)) continue;

      return { userId };

    } catch {

      continue;

    }

  }

  return null;

}

async function parseBody(request: NextRequest): Promise<VerifyBody | null> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
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
      if (total > MAX_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
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
  const raw = decoder.decode(bytes);
  if (!raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("INVALID_BODY");
  }

  const record = parsed as Record<string, unknown>;
  const allowedFields = new Set([
    "internshipId",
    "planCode",
    "razorpayOrderId",
    "razorpayPaymentId",
    "razorpaySignature",
  ]);

  if (Object.keys(record).some((key) => !allowedFields.has(key))) {
    throw new Error("UNSUPPORTED_FIELDS");
  }

  return record as VerifyBody;
}


async function upsertVerifiedPaymentLedger(input: {
  student: StudentRecord;
  internship: InternshipRecord;
  amount: number;
  orderId: string;
  paymentId: string;
  email: string;
  plan: { duration: string };
}): Promise<boolean> {
  const existingByPayment = await Payment.findOne({
    paymentId: input.paymentId,
    orderId: { $ne: input.orderId },
  }).select({ _id: 1 }).lean().exec();

  if (existingByPayment) return false;

  const existingOrder = await Payment.findOne({ orderId: input.orderId })
    .select({ paymentId: 1, status: 1 })
    .lean()
    .exec();

  if (existingOrder) {
    if (statusOf(existingOrder.status) === "refunded") return false;
    const existingPaymentId = clean(existingOrder.paymentId);
    if (existingPaymentId && existingPaymentId !== input.paymentId) return false;
  }

  const update = {
    $set: {
      studentName: clean(input.student.fullName) || "Student",
      studentId: clean(input.student.studentId) || clean(input.student._id),
      email: input.email,
      internship: getTitle(input.internship),
      amount: input.amount,
      status: "success",
      method: "Razorpay",
      paymentId: input.paymentId,
      orderId: input.orderId,
      archivedAt: null,
      archivedBy: "",
    },
    $setOnInsert: {
      notes: `Plan: ${input.plan.duration}`,
      receiptEmailStatus: "pending",
      receiptEmailSentAt: null,
      receiptEmailLastAttemptAt: null,
      receiptEmailAttempts: 0,
      receiptEmailError: "",
    },
  };

  try {
    const ledger = await Payment.findOneAndUpdate(
      {
        orderId: input.orderId,
        status: { $ne: "refunded" },
        $or: [
          { paymentId: "" },
          { paymentId: input.paymentId },
          { paymentId: { $exists: false } },
        ],
      },
      update,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    ).select({ paymentId: 1, status: 1 }).lean().exec();

    return Boolean(
      ledger &&
      clean(ledger.paymentId) === input.paymentId &&
      statusOf(ledger.status) === "success",
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      Number((error as { code?: unknown }).code) === 11000
    ) {
      const ledger = await Payment.findOne({ orderId: input.orderId })
        .select({ paymentId: 1, status: 1 })
        .lean()
        .exec();

      return Boolean(
        ledger &&
        clean(ledger.paymentId) === input.paymentId &&
        statusOf(ledger.status) === "success",
      );
    }
    throw error;
  }
}

async function claimReceiptEmail(orderId: string, paymentId: string): Promise<"claimed" | "sent" | "busy" | "missing"> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1000);

  const claimed = await Payment.findOneAndUpdate(
    {
      orderId,
      paymentId,
      status: "success",
      $or: [
        { receiptEmailStatus: "failed" },
        {
          receiptEmailStatus: "pending",
          $or: [
            { receiptEmailLastAttemptAt: null },
            { receiptEmailLastAttemptAt: { $lte: staleBefore } },
            { receiptEmailLastAttemptAt: { $exists: false } },
          ],
        },
      ],
    },
    {
      $set: {
        receiptEmailStatus: "pending",
        receiptEmailLastAttemptAt: now,
        receiptEmailError: "",
      },
      $inc: { receiptEmailAttempts: 1 },
    },
    { new: true, runValidators: true },
  ).select({ _id: 1 }).lean().exec();

  if (claimed) return "claimed";

  const current = await Payment.findOne({ orderId, paymentId })
    .select({ receiptEmailStatus: 1, status: 1 })
    .lean()
    .exec();

  if (!current) return "missing";
  if (statusOf(current.status) !== "success") return "missing";
  if (current.receiptEmailStatus === "sent") return "sent";
  return "busy";
}

async function updateReceiptEmailLedger(
  orderId: string,
  paymentId: string,
  sent: boolean,
  errorCode: string | null,
): Promise<void> {
  await Payment.updateOne(
    { orderId, paymentId, status: "success" },
    {
      $set: {
        receiptEmailStatus: sent ? "sent" : "failed",
        receiptEmailSentAt: sent ? new Date() : null,
        receiptEmailError: sent ? "" : clean(errorCode || "RECEIPT_EMAIL_SEND_FAILED", 500),
      },
    },
  ).exec();
}


export async function POST(request: NextRequest): Promise<NextResponse> {

  try {

    if (!isTrustedRequestOrigin(request)) {
      return fail("Cross-origin payment verification requests are not allowed.", "UNTRUSTED_ORIGIN", 403);
    }

    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {

      return fail("Content-Type must be application/json.", "INVALID_CONTENT_TYPE", 415);

    }

    const auth = await authenticate(request);

    if (!auth) return fail("Please log in with your main student account.", "UNAUTHORIZED", 401);

    if (!mongoose.isValidObjectId(auth.userId)) return fail("Invalid student session.", "INVALID_STUDENT_SESSION", 401);

    let body: VerifyBody | null;

    try {

      body = await parseBody(request);

    } catch (error) {

      const code = error instanceof Error ? error.message : "";

      if (code === "REQUEST_TOO_LARGE") return fail("Request body is too large.", code, 413);

      return fail(
        code === "INVALID_JSON"
          ? "Invalid JSON request body."
          : code === "UNSUPPORTED_FIELDS"
            ? "Request contains unsupported fields."
            : "Request body must be a JSON object.",
        code || "INVALID_BODY",
        400,
      );

    }

    if (!body) return fail("Payment verification data is required.", "INVALID_BODY", 400);

    const internshipId = clean(body.internshipId, 100);

    const planCode = normalizePlan(body.planCode);

    const orderId = clean(body.razorpayOrderId, 100);

    const paymentId = clean(body.razorpayPaymentId, 100);

    const receivedSignature = clean(body.razorpaySignature, 128);

    if (!mongoose.isValidObjectId(internshipId)) return fail("A valid internship ID is required.", "INVALID_INTERNSHIP_ID");

    if (!planCode) return fail("A valid internship plan is required.", "INVALID_PLAN");

    if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return fail("A valid Razorpay order ID is required.", "INVALID_ORDER_ID");

    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return fail("A valid Razorpay payment ID is required.", "INVALID_PAYMENT_ID");

    if (!/^[a-f0-9]{64}$/i.test(receivedSignature)) return fail("A valid Razorpay signature is required.", "INVALID_SIGNATURE_FORMAT");

    await connectDB();

    const student = (await Student.findById(auth.userId).lean().exec()) as unknown as StudentRecord | null;

    if (!student) return fail("Student account was not found.", "STUDENT_NOT_FOUND", 404);

    if (student.loginEnabled !== true) return fail("Your student account is disabled.", "STUDENT_ACCOUNT_DISABLED", 403);

    if (student.accountLocked === true) {

      const lockedUntil = student.lockedUntil ? new Date(String(student.lockedUntil)) : null;

      if (!lockedUntil || Number.isNaN(lockedUntil.getTime()) || lockedUntil.getTime() > Date.now()) {

        return fail("Your student account is temporarily locked.", "STUDENT_ACCOUNT_LOCKED", 423);

      }

    }

    if (student.emailVerified !== true) return fail("Please verify your email before payment.", "EMAIL_NOT_VERIFIED", 403);

    if (
      statusOf(student.applicationStatus) !== "approved" &&
      statusOf(student.adminApprovalStatus) !== "approved"
    ) {
      return fail("Your application has not been approved.", "APPLICATION_NOT_APPROVED", 403);
    }

    if (statusOf(student.assessmentStatus) !== "passed" || statusOf(student.resultStatus) !== "passed") {

      return fail("You must pass the required assessment before payment.", "ASSESSMENT_NOT_PASSED", 403);

    }

    if (student.internshipApplicationAllowed !== true) return fail("Internship payment is not enabled for this account.", "INTERNSHIP_PAYMENT_NOT_ALLOWED", 403);

    const storedOrderId = clean(student.razorpayOrderId, 100);

    if (!storedOrderId) return fail("No active payment order was found.", "PAYMENT_ORDER_NOT_FOUND", 404);

    if (storedOrderId !== orderId) return fail("Payment order does not belong to this student.", "ORDER_OWNERSHIP_MISMATCH", 403);

    const plan = PLANS[planCode];

    const paymentStatusStored = statusOf(student.paymentStatus);

    const isSameCompletedPayment =
      paymentStatusStored === "paid" &&
      clean(student.razorpayPaymentId) === paymentId;

    if (paymentStatusStored === "paid" && !isSameCompletedPayment) {
      return fail("A different payment has already been completed for this account.", "PAYMENT_ALREADY_COMPLETED", 409);
    }

    if (paymentStatusStored !== "pending" && !isSameCompletedPayment) {
      return fail("This payment is not pending verification.", "PAYMENT_NOT_PENDING", 409);
    }

    if (
      !isSameCompletedPayment &&
      statusOf(student.internshipStatus) !== "payment-pending"
    ) {
      return fail("Your internship selection is not awaiting payment.", "INTERNSHIP_NOT_PAYMENT_PENDING", 409);
    }

    if (clean(student.internshipPlan).toLowerCase() !== plan.studentPlan) {

      return fail("Selected internship duration does not match this payment.", "STUDENT_PLAN_MISMATCH", 409);

    }

    const studentAmount = numberValue(student.paymentAmount);

    if (studentAmount === null || Math.round(studentAmount * 100) !== plan.paise) {

      return fail("Student payment amount does not match the selected plan.", "STUDENT_PAYMENT_AMOUNT_MISMATCH", 409);

    }

    if (clean(student.paymentCurrency).toUpperCase() !== "INR") {

      return fail("Student payment currency is invalid.", "STUDENT_PAYMENT_CURRENCY_MISMATCH", 409);

    }

    const internship = (await Internship.findById(internshipId).select({

      _id: 1, title: 1, name: 1, domain: 1, assessmentDomain: 1, planCode: 1,

      duration: 1, durationMonths: 1, price: 1, priceInPaise: 1, currency: 1,

      status: 1, isPublic: 1, isSelectable: 1, endDate: 1,

    }).lean().exec()) as unknown as InternshipRecord | null;

    if (!internship) return fail("Selected internship plan was not found.", "INTERNSHIP_NOT_FOUND", 404);

    if (statusOf(internship.status) !== "active") return fail("This internship is no longer active.", "INTERNSHIP_INACTIVE", 409);

    if (internship.isPublic === false || internship.isSelectable === false) return fail("This internship is not selectable.", "INTERNSHIP_NOT_SELECTABLE", 409);

    if (internship.endDate) {

      const endDate = new Date(String(internship.endDate));

      if (!Number.isNaN(endDate.getTime()) && Date.now() > endDate.getTime()) return fail("This internship program has ended.", "INTERNSHIP_ENDED", 409);

    }

    if (normalizePlan(internship.planCode) !== planCode) return fail("Internship plan does not match the server record.", "PLAN_MISMATCH", 409);

    if (clean(internship.duration) !== plan.duration || numberValue(internship.durationMonths) !== plan.months) {

      return fail("Internship duration configuration is invalid.", "INVALID_PLAN_DURATION", 503);

    }

    if (!sameDomain(student.internshipTrack, internship.domain, internship.assessmentDomain)) {

      return fail("This internship is outside your approved domain.", "DOMAIN_MISMATCH", 403);

    }

    const price = numberValue(internship.price);

    const pricePaise = numberValue(internship.priceInPaise);

    if (price === null || pricePaise === null || Math.round(price * 100) !== plan.paise || Math.round(pricePaise) !== plan.paise || plan.paise < MIN_AMOUNT_PAISE) {

      return fail("Internship pricing configuration is inconsistent.", "PLAN_PRICE_MISMATCH", 503);

    }

    if (clean(internship.currency).toUpperCase() !== "INR") return fail("Only INR payments are supported.", "UNSUPPORTED_CURRENCY", 503);

    let config: { keyId: string; keySecret: string };

    try {

      config = razorpayConfig();

    } catch {

      return fail("Payment gateway is not configured on the server.", "RAZORPAY_NOT_CONFIGURED", 503);

    }

    const expected = signature(orderId, paymentId, config.keySecret);

    if (!safeHexEqual(expected, receivedSignature)) return fail("Payment signature verification failed.", "INVALID_PAYMENT_SIGNATURE", 400);

    let order: RazorpayOrder;

    try {

      order = await razorpayFetch<RazorpayOrder>(`/orders/${encodeURIComponent(orderId)}`, config, "GET");

    } catch (error) {

      console.error("[PAYMENT VERIFY] Order lookup failed:", error instanceof Error ? error.message : "unknown");

      return fail("Unable to verify the Razorpay order. Please retry.", "RAZORPAY_ORDER_LOOKUP_FAILED", 502);

    }

    if (clean(order.id) !== orderId) return fail("Razorpay order ID mismatch.", "RAZORPAY_ORDER_ID_MISMATCH", 409);

    if (Math.round(numberValue(order.amount) ?? 0) !== plan.paise) return fail("Razorpay order amount mismatch.", "RAZORPAY_ORDER_AMOUNT_MISMATCH", 409);

    if (clean(order.currency).toUpperCase() !== "INR") return fail("Razorpay order currency mismatch.", "RAZORPAY_ORDER_CURRENCY_MISMATCH", 409);
    const razorpayOrderStatus = statusOf(order.status);
    if (razorpayOrderStatus && !["created", "attempted", "paid"].includes(razorpayOrderStatus)) {
      return fail("Razorpay order is not in a payable state.", "RAZORPAY_ORDER_NOT_PAYABLE", 409);
    }

    if (!order.notes || typeof order.notes !== "object" || Array.isArray(order.notes)) {
      return fail("Razorpay order metadata is missing.", "RAZORPAY_ORDER_METADATA_MISSING", 409);
    }

    const notes = order.notes as Record<string, unknown>;
    const noteStudentId = clean(notes.studentId);
    const noteStudentObjectId = clean(notes.studentObjectId);
    const noteInternshipId = clean(notes.internshipId);
    const notePlan = normalizePlan(notes.planCode);
    const studentPublicId = clean(student.studentId) || auth.userId;

    if (noteStudentId !== studentPublicId || noteStudentObjectId !== auth.userId) {
      return fail("Razorpay order ownership mismatch.", "RAZORPAY_ORDER_OWNER_MISMATCH", 403);
    }
    if (noteInternshipId !== internshipId) {
      return fail("Razorpay order internship mismatch.", "RAZORPAY_ORDER_INTERNSHIP_MISMATCH", 409);
    }
    if (notePlan !== planCode) {
      return fail("Razorpay order plan mismatch.", "RAZORPAY_ORDER_PLAN_MISMATCH", 409);
    }

    let payment: RazorpayPayment;

    try {

      payment = await razorpayFetch<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`, config, "GET");

    } catch (error) {

      console.error("[PAYMENT VERIFY] Payment lookup failed:", error instanceof Error ? error.message : "unknown");

      return fail("Unable to verify the Razorpay payment. Please retry.", "RAZORPAY_PAYMENT_LOOKUP_FAILED", 502);

    }

    if (clean(payment.id) !== paymentId || clean(payment.order_id) !== orderId) return fail("Payment does not belong to this order.", "PAYMENT_ORDER_MISMATCH", 409);

    if (Math.round(numberValue(payment.amount) ?? 0) !== plan.paise) return fail("Payment amount mismatch.", "PAYMENT_AMOUNT_MISMATCH", 409);

    if (clean(payment.currency).toUpperCase() !== "INR") return fail("Payment currency mismatch.", "PAYMENT_CURRENCY_MISMATCH", 409);

    if (statusOf(payment.status) === "failed") return fail("Razorpay reports that this payment failed.", "PAYMENT_FAILED", 402);

    if (statusOf(payment.status) === "refunded") return fail("This payment has been refunded.", "PAYMENT_REFUNDED", 409);

    if (statusOf(payment.status) === "authorized" && payment.captured !== true) {

      try {

        await razorpayFetch<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, config, "POST", {

          amount: plan.paise, currency: "INR",

        });

      } catch (error) {

        console.warn("[PAYMENT VERIFY] Capture request returned an error; rechecking state.");

      }

      try {

        payment = await razorpayFetch<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`, config, "GET");

      } catch {

        return fail("Payment state is temporarily unavailable. Please retry.", "PAYMENT_FINAL_STATE_UNAVAILABLE", 503);

      }

    }

    if (statusOf(payment.status) !== "captured" || payment.captured !== true) {

      return fail("Payment has not been captured yet. Please retry shortly.", "PAYMENT_NOT_CAPTURED", 409);

    }

    if (clean(payment.id) !== paymentId || clean(payment.order_id) !== orderId ||

        Math.round(numberValue(payment.amount) ?? 0) !== plan.paise ||

        clean(payment.currency).toUpperCase() !== "INR") {

      return fail("Final payment validation failed.", "FINAL_PAYMENT_VALIDATION_FAILED", 409);

    }

    const committed = await recordVerifiedPayment({

      studentId: auth.userId,

      razorpayOrderId: orderId,

      razorpayPaymentId: paymentId,

      razorpaySignature: receivedSignature,

      amount: plan.amount,

      currency: "INR",

    });

    if (!committed.success && committed.code === "INTERNSHIP_SELECTION_WINDOW_EXPIRED") {
      const reconciliationAt = new Date();
      const reconciliation = await Student.updateOne(
        {
          _id: new mongoose.Types.ObjectId(auth.userId),
          razorpayOrderId: orderId,
          paymentStatus: { $in: ["pending", "paid"] },
          $or: [
            { razorpayPaymentId: "" },
            { razorpayPaymentId: paymentId },
            { razorpayPaymentId: { $exists: false } },
          ],
        },
        {
          $set: {
            paymentStatus: "paid",
            razorpayPaymentId: paymentId,
            razorpaySignature: receivedSignature,
            paymentCompletedAt: reconciliationAt,
            internshipStatus: "approved",
            studentOpsApprovalStatus: "pending",
            studentOpsStatus: "pending-review",
            dashboardStatus: "locked",
            dashboardLoginEnabled: false,
            dashboardCredentialsGenerated: false,
            operationsSyncStatus: "pending",
            operationsSyncError: "Captured payment requires manual reconciliation because the 72-hour selection window expired.",
          },
        },
      ).exec();

      if (!reconciliation.matchedCount) {
        const latest = (await Student.findById(auth.userId).select({
          paymentStatus: 1,
          razorpayOrderId: 1,
          razorpayPaymentId: 1,
        }).lean().exec()) as Record<string, unknown> | null;

        if (
          statusOf(latest?.paymentStatus) !== "paid" ||
          clean(latest?.razorpayOrderId) !== orderId ||
          clean(latest?.razorpayPaymentId) !== paymentId
        ) {
          console.error("[PAYMENT VERIFY] Captured payment reconciliation could not be persisted.");
          return fail("Payment was captured by Razorpay but could not be safely recorded. Contact support with your payment ID.", "CAPTURED_PAYMENT_RECONCILIATION_REQUIRED", 202);
        }
      }

      console.error("[PAYMENT VERIFY] Captured payment saved for manual reconciliation after selection deadline.");
    } else if (!committed.success) {
      console.error("[PAYMENT VERIFY] Payment commit rejected:", committed.code || "unknown");
      return fail(committed.message || "Verified payment could not be saved.", committed.code || "PAYMENT_COMMIT_FAILED", 409);
    }

    const manualReconciliationRequired = !committed.success;

    const applicationId = clean(student.applicationId);

    if (applicationId) {

      try {

        await Application.updateOne(

          { applicationId },

          { $set: { paymentStatus: "paid", paymentId, selectedDuration: plan.duration } },

        ).exec();

      } catch (error) {

        console.error("[PAYMENT VERIFY] Application sync failed:", error instanceof Error ? error.message : "unknown");

      }

    }

    const email = clean(student.email).toLowerCase();
    let receiptEmailSent = false;
    let receiptEmailErrorCode: string | null = null;
    let receiptEmailPending = false;

    const ledgerSaved = await upsertVerifiedPaymentLedger({
      student,
      internship,
      amount: plan.amount,
      orderId,
      paymentId,
      email,
      plan,
    });

    if (!ledgerSaved) {
      console.error("[PAYMENT VERIFY] Payment ledger could not be safely reconciled.");
      return fail(
        "Payment was captured, but its ledger record needs support reconciliation. Keep your payment ID.",
        "PAYMENT_LEDGER_RECONCILIATION_REQUIRED",
        202,
      );
    }

    if (!email) {
      receiptEmailErrorCode = "STUDENT_EMAIL_MISSING";
      await updateReceiptEmailLedger(orderId, paymentId, false, receiptEmailErrorCode);
    } else if (student.receiptEmailSent === true) {
      receiptEmailSent = true;
      await updateReceiptEmailLedger(orderId, paymentId, true, null);
    } else {
      const claim = await claimReceiptEmail(orderId, paymentId);

      if (claim === "sent") {
        receiptEmailSent = true;
      } else if (claim === "busy") {
        receiptEmailPending = true;
        receiptEmailErrorCode = "RECEIPT_EMAIL_ALREADY_IN_PROGRESS";
      } else if (claim === "missing") {
        receiptEmailErrorCode = "RECEIPT_EMAIL_CLAIM_FAILED";
      } else {
        try {
          receiptEmailSent = Boolean(await sendPaymentReceiptEmail({
            email,
            name: clean(student.fullName) || "Student",
            studentId: clean(student.studentId) || auth.userId,
            plan: plan.duration,
            amount: plan.amount,
            currency: "INR",
            paymentId,
            orderId,
            paymentDate: new Date(),
            internship: getTitle(internship),
          }));

          if (!receiptEmailSent) {
            receiptEmailErrorCode = "RECEIPT_EMAIL_NOT_SENT";
          }
        } catch (error) {
          receiptEmailErrorCode = "RECEIPT_EMAIL_SEND_FAILED";
          console.error("[PAYMENT VERIFY] Receipt email failed:", error instanceof Error ? error.message : "unknown");
        }

        try {
          await updateReceiptEmailLedger(
            orderId,
            paymentId,
            receiptEmailSent,
            receiptEmailErrorCode,
          );
        } catch (error) {
          console.error("[PAYMENT VERIFY] Receipt ledger update failed:", error instanceof Error ? error.message : "unknown");
          if (receiptEmailSent) receiptEmailErrorCode = "RECEIPT_EMAIL_STATE_UPDATE_FAILED";
        }
      }
    }

    if (receiptEmailSent && student.receiptEmailSent !== true) {
      try {
        await Student.updateOne(
          { _id: new mongoose.Types.ObjectId(auth.userId), paymentStatus: "paid", razorpayPaymentId: paymentId },
          { $set: { receiptEmailSent: true, receiptEmailSentAt: new Date() } },
        ).exec();
      } catch (error) {
        console.error("[PAYMENT VERIFY] Student receipt state update failed:", error instanceof Error ? error.message : "unknown");
      }
    }
    return json({

      success: true,

      verified: true,

      message: !manualReconciliationRequired

        ? receiptEmailSent
          ? "Payment verified. Receipt emailed. Your profile is awaiting Student Operations approval."
          : receiptEmailPending
            ? "Payment verified. Receipt email delivery is already in progress. Your profile is awaiting Student Operations approval."
            : "Payment verified. Your profile is awaiting Student Operations approval; receipt email could not be sent."

        : "Payment captured and recorded. Your selection window had expired, so your payment is flagged for manual reconciliation before Student Operations approval.",

      data: {

        paymentStatus: "paid",

        internshipStatus: "pending-review",

        studentOpsStatus: "pending-review",

        studentOpsApprovalStatus: "pending",

        dashboardStatus: "locked",

        dashboardLoginEnabled: false,

        studentId: auth.userId,

        applicationId,

        internshipId,

        planCode,

        title: getTitle(internship),

        duration: plan.duration,

        durationMonths: plan.months,

        durationDays: plan.days,

        amount: plan.amount,

        amountInPaise: plan.paise,

        currency: "INR",

        razorpayOrderId: orderId,

        razorpayPaymentId: paymentId,

        verifiedAt: new Date().toISOString(),

        receiptEmailSent,

        receiptEmailErrorCode,

        manualReconciliationRequired,

      },

    });

  } catch (error) {

    console.error("[POST /api/payment/verify] Unexpected error:", error instanceof Error ? error.message : "unknown");

    return fail("Unable to verify the payment right now. Please try again.", "PAYMENT_VERIFICATION_INTERNAL_ERROR", 500);

  }

}

function methodNotAllowed(): NextResponse {

  return fail("This HTTP method is not supported.", "METHOD_NOT_ALLOWED", 405);

}

export async function GET(): Promise<NextResponse> { return methodNotAllowed(); }

export async function PUT(): Promise<NextResponse> { return methodNotAllowed(); }

export async function PATCH(): Promise<NextResponse> { return methodNotAllowed(); }

export async function DELETE(): Promise<NextResponse> { return methodNotAllowed(); }

export async function HEAD(): Promise<NextResponse> {

  return new NextResponse(null, {

    status: 405,

    headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },

  });

}

export async function OPTIONS(): Promise<NextResponse> {

  return new NextResponse(null, {

    status: 204,

    headers: {

      Allow: "POST, OPTIONS",

      "Access-Control-Allow-Methods": "POST, OPTIONS",

      "Access-Control-Allow-Headers": "Content-Type",

      "Cache-Control": "no-store",

      "X-Content-Type-Options": "nosniff",

    },

  });

}
