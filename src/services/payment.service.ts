import "server-only";

import crypto from "node:crypto";

import StudentModel from "@/models/Student";

import connectDB from "@/lib/db";

import {

  markPaymentPending,

  recordVerifiedPayment,

} from "@/services/student.service";

import { sendPaymentReceiptEmail } from "@/lib/email";

export type InternshipPlanCode =
  | "ONE_MONTH"
  | "THREE_MONTHS"
  | "SIX_MONTHS";

export type LegacyInternshipPlanCode =
  | "1 month"
  | "3 months"
  | "6 months";

export type InternshipPlanInput =
  | InternshipPlanCode
  | LegacyInternshipPlanCode;

export interface PaymentPlan {

  code: InternshipPlanCode;

  name: string;

  durationMonths: number;

  durationDays: number;

  amount: number;

  amountInPaise: number;

  currency: "INR";

}

export interface CreatePaymentOrderInput {

  studentId: string;

  plan: InternshipPlanInput;

  track?: string;

}

export interface VerifyPaymentInput {

  studentId: string;

  razorpayOrderId: string;

  razorpayPaymentId: string;

  razorpaySignature: string;

}

export interface PaymentSuccess<T = unknown> {

  success: true;

  message: string;

  code: string;

  data: T;

}

export interface PaymentFailure {

  success: false;

  message: string;

  code: string;

  status: number;

}

export type PaymentResult<T = unknown> =

  | PaymentSuccess<T>

  | PaymentFailure;

interface RazorpayOrder {

  id?: unknown;

  amount?: unknown;

  amount_paid?: unknown;

  amount_due?: unknown;

  currency?: unknown;

  receipt?: unknown;

  status?: unknown;

  notes?: unknown;

}

interface RazorpayPayment {

  id?: unknown;

  order_id?: unknown;

  amount?: unknown;

  currency?: unknown;

  status?: unknown;

  captured?: unknown;

}

interface ReceiptResult {

  sent: boolean;

  configured: boolean;

  messageId?: string;

  errorCode?: string;

}

class PaymentServiceError extends Error {

  readonly code: string;

  readonly status: number;

  constructor(

    code: string,

    message: string,

    status = 500,

  ) {

    super(message);

    this.name = "PaymentServiceError";

    this.code = code;

    this.status = status;

  }

}

export const PAYMENT_PLANS: Record<InternshipPlanCode, PaymentPlan> = {
  ONE_MONTH: {
    code: "ONE_MONTH",
    name: "1 Month",
    durationMonths: 1,
    durationDays: 30,
    amount: 499,
    amountInPaise: 49900,
    currency: "INR",
  },
  THREE_MONTHS: {
    code: "THREE_MONTHS",
    name: "3 Months",
    durationMonths: 3,
    durationDays: 90,
    amount: 999,
    amountInPaise: 99900,
    currency: "INR",
  },
  SIX_MONTHS: {
    code: "SIX_MONTHS",
    name: "6 Months",
    durationMonths: 6,
    durationDays: 180,
    amount: 1699,
    amountInPaise: 169900,
    currency: "INR",
  },
};

const RAZORPAY_API =

  "https://api.razorpay.com/v1";

const REQUEST_TIMEOUT =

  15_000;

const MAX_STUDENT_ID_LENGTH =

  100;

function cleanString(

  value: unknown,

): string {

  return typeof value === "string"

    ? value.trim()

    : "";

}

function getRazorpayConfig() {

  const keyId =

    cleanString(

      process.env.RAZORPAY_KEY_ID,

    ) ||

    cleanString(

      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,

    );

  const keySecret =

    cleanString(

      process.env.RAZORPAY_KEY_SECRET,

    );

  if (!keyId || !keySecret) {

    throw new PaymentServiceError(

      "RAZORPAY_CONFIGURATION_MISSING",

      "Razorpay server configuration is missing.",

      500,

    );

  }

  return {

    keyId,

    keySecret,

  };

}

function normalizeStudentId(

  value: unknown,

): string {

  return cleanString(value).slice(

    0,

    MAX_STUDENT_ID_LENGTH,

  );

}

export function normalizeInternshipPlanCode(
  value: unknown,
): InternshipPlanCode | null {
  const normalized = cleanString(value).toUpperCase().replace(/[\\s-]+/g, "_");

  if (normalized === "ONE_MONTH" || normalized === "1_MONTH") {
    return "ONE_MONTH";
  }

  if (normalized === "THREE_MONTHS" || normalized === "3_MONTHS") {
    return "THREE_MONTHS";
  }

  if (normalized === "SIX_MONTHS" || normalized === "6_MONTHS") {
    return "SIX_MONTHS";
  }

  return null;
}

function getPlan(value: unknown): PaymentPlan {
  const code = normalizeInternshipPlanCode(value);

  if (!code) {
    throw new PaymentServiceError(
      "INVALID_INTERNSHIP_PLAN",
      "Invalid internship plan.",
      400,
    );
  }

  return PAYMENT_PLANS[code];
}

export function getPaymentPlan(value: unknown): PaymentPlan | null {
  const code = normalizeInternshipPlanCode(value);
  return code ? PAYMENT_PLANS[code] : null;
}

function toNumber(

  value: unknown,

): number {

  if (

    typeof value === "number" &&

    Number.isFinite(value)

  ) {

    return value;

  }

  if (

    typeof value === "string" &&

    value.trim()

  ) {

    const parsed =

      Number(value);

    if (

      Number.isFinite(parsed)

    ) {

      return parsed;

    }

  }

  return NaN;

}

function objectIdString(

  value: unknown,

): string {

  if (

    value &&

    typeof value === "object" &&

    "toString" in value

  ) {

    return String(value);

  }

  return cleanString(value);

}

function errorResult(

  error: unknown,

): PaymentFailure {

  if (

    error instanceof

    PaymentServiceError

  ) {

    return {

      success: false,

      message: error.message,

      code: error.code,

      status: error.status,

    };

  }

  console.error(

    "[PaymentService] Unexpected error:",

    error,

  );

  return {

    success: false,

    message:

      "Unable to process the payment right now. Please try again.",

    code:

      "PAYMENT_SERVICE_INTERNAL_ERROR",

    status: 500,

  };

}

async function razorpayRequest<T>(

  path: string,

  options: {

    method?: "GET" | "POST";

    body?: unknown;

  } = {},

): Promise<T> {

  const config =

    getRazorpayConfig();

  const controller =

    new AbortController();

  const timer =

    setTimeout(

      () =>

        controller.abort(),

      REQUEST_TIMEOUT,

    );

  try {

    const token =

      Buffer.from(

        `${config.keyId}:${config.keySecret}`,

        "utf8",

      ).toString("base64");

    const response =

      await fetch(

        `${RAZORPAY_API}${path}`,

        {

          method:

            options.method || "GET",

          headers: {

            Authorization:

              `Basic ${token}`,

            Accept:

              "application/json",

            "Content-Type":

              "application/json",

          },

          body:

            options.body === undefined

              ? undefined

              : JSON.stringify(

                  options.body,

                ),

          cache: "no-store",

          signal:

            controller.signal,

        },

      );

    const payload: unknown =

      await response

        .json()

        .catch(() => null);

    if (!response.ok) {

      let message =

        `Razorpay returned HTTP ${response.status}.`;

      if (

        payload &&

        typeof payload === "object" &&

        "error" in payload

      ) {

        const error =

          payload.error;

        if (

          error &&

          typeof error === "object" &&

          "description" in error

        ) {

          message =

            cleanString(

              error.description,

            ) || message;

        }

      }

      throw new PaymentServiceError(

        "RAZORPAY_API_ERROR",

        message,

        response.status >= 500

          ? 502

          : response.status,

      );

    }

    return payload as T;

  } catch (error) {

    if (

      error instanceof

      PaymentServiceError

    ) {

      throw error;

    }

    if (

      error instanceof

        DOMException &&

      error.name ===

        "AbortError"

    ) {

      throw new PaymentServiceError(

        "RAZORPAY_TIMEOUT",

        "Razorpay request timed out. Please try again.",

        504,

      );

    }

    throw new PaymentServiceError(

      "RAZORPAY_NETWORK_ERROR",

      "Unable to connect to Razorpay.",

      502,

    );

  } finally {

    clearTimeout(timer);

  }

}

function orderId(

  order: RazorpayOrder,

): string {

  return cleanString(order.id);

}

function orderAmount(

  order: RazorpayOrder,

): number {

  return toNumber(order.amount);

}

function orderCurrency(

  order: RazorpayOrder,

): string {

  return cleanString(

    order.currency,

  ).toUpperCase();

}

function paymentId(

  payment: RazorpayPayment,

): string {

  return cleanString(payment.id);

}

function paymentOrderId(

  payment: RazorpayPayment,

): string {

  return cleanString(

    payment.order_id,

  );

}

function paymentAmount(

  payment: RazorpayPayment,

): number {

  return toNumber(

    payment.amount,

  );

}

function paymentCurrency(

  payment: RazorpayPayment,

): string {

  return cleanString(

    payment.currency,

  ).toUpperCase();

}

function createReceipt(

  studentId: string,

  plan: InternshipPlanCode,

): string {

  const student =

    studentId

      .replace(

        /[^a-zA-Z0-9]/g,

        "",

      )

      .slice(-12)

      .toUpperCase();

  const planCode =

    plan

      .replace(

        /[^a-zA-Z0-9]/g,

        "",

      )

      .slice(0, 8)

      .toUpperCase();

  const random =

    crypto

      .randomBytes(5)

      .toString("hex")

      .toUpperCase();

  return `CNT-${student}-${planCode}-${random}`;

}

export function generatePaymentSignature(

  orderIdValue: string,

  paymentIdValue: string,

): string {

  const {

    keySecret,

  } = getRazorpayConfig();

  return crypto

    .createHmac(

      "sha256",

      keySecret,

    )

    .update(

      `${orderIdValue}|${paymentIdValue}`,

      "utf8",

    )

    .digest("hex");

}

function timingSafeEqual(

  expected: string,

  received: string,

): boolean {

  const a =

    Buffer.from(

      expected,

      "utf8",

    );

  const b =

    Buffer.from(

      received,

      "utf8",

    );

  return (

    a.length === b.length &&

    crypto.timingSafeEqual(

      a,

      b,

    )

  );

}

export function verifyPaymentSignature(

  orderIdValue: string,

  paymentIdValue: string,

  signature: string,

): boolean {

  if (

    !orderIdValue ||

    !paymentIdValue ||

    !signature

  ) {

    return false;

  }

  const expected =

    generatePaymentSignature(

      orderIdValue,

      paymentIdValue,

    );

  return timingSafeEqual(

    expected,

    signature,

  );

}

async function getStudent(

  studentId: string,

): Promise<any | null> {

  await connectDB();

  return StudentModel.findOne({

    studentId,

  }).exec();

}

export async function createPaymentOrder(

  input: CreatePaymentOrderInput,

): Promise<

  PaymentResult<{

    keyId: string;

    orderId: string;

    razorpayOrderId: string;

    studentId: string;

    plan: PaymentPlan;

    title: string;

    receipt: string;

    paymentStatus: string;

  }>

> {

  try {

    const studentId =

      normalizeStudentId(

        input.studentId,

      );

    if (!studentId) {

      throw new PaymentServiceError(

        "STUDENT_ID_REQUIRED",

        "Student ID is required.",

        400,

      );

    }

    const plan =

      getPlan(input.plan);

    const student =

      await getStudent(

        studentId,

      );

    if (!student) {

      throw new PaymentServiceError(

        "STUDENT_NOT_FOUND",

        "Student account was not found.",

        404,

      );

    }



    if (

      student.emailVerified !==

      true

    ) {

      throw new PaymentServiceError(

        "EMAIL_NOT_VERIFIED",

        "Email verification is required before payment.",

        403,

      );

    }

    if (

      cleanString(

        student.applicationStatus,

      ) !== "approved"

    ) {

      throw new PaymentServiceError(

        "APPLICATION_NOT_APPROVED",

        "Application approval is required before payment.",

        403,

      );

    }

    if (

      cleanString(

        student.assessmentStatus,

      ) !== "passed"

    ) {

      throw new PaymentServiceError(

        "ASSESSMENT_NOT_PASSED",

        "You must pass the assessment before payment.",

        403,

      );

    }

    if (

      student.internshipApplicationAllowed !==

      true

    ) {

      throw new PaymentServiceError(

        "INTERNSHIP_NOT_AVAILABLE",

        "Internship selection is not currently available.",

        403,

      );

    }

    if (

      cleanString(

        student.internshipStatus,

      ) !== "payment-pending"

    ) {

      throw new PaymentServiceError(

        "PAYMENT_NOT_ALLOWED",

        "Student is not currently ready for internship payment.",

        409,

      );

    }



    if (
      normalizeInternshipPlanCode(student.internshipPlan) !== plan.code
    ) {

      throw new PaymentServiceError(

        "PLAN_MISMATCH",

        "Selected internship plan does not match the student's selected plan.",

        409,

      );

    }

    if (

      toNumber(

        student.paymentAmount,

      ) !== plan.amount

    ) {

      throw new PaymentServiceError(

        "PAYMENT_AMOUNT_MISMATCH",

        "Payment amount does not match the selected internship plan.",

        409,

      );

    }

    if (

      cleanString(

        student.paymentCurrency,

      ).toUpperCase() !==

      plan.currency

    ) {

      throw new PaymentServiceError(

        "PAYMENT_CURRENCY_MISMATCH",

        "Payment currency does not match the selected internship plan.",

        409,

      );

    }

    if (

      cleanString(

        student.paymentStatus,

      ) === "paid"

    ) {

      throw new PaymentServiceError(

        "PAYMENT_ALREADY_COMPLETED",

        "This internship payment has already been completed.",

        409,

      );

    }



    const existingOrderId =

      cleanString(

        student.razorpayOrderId,

      );

    if (

      existingOrderId &&

      cleanString(

        student.paymentStatus,

      ) === "pending"

    ) {

      try {

        const existing =

          await razorpayRequest<RazorpayOrder>(

            `/orders/${encodeURIComponent(

              existingOrderId,

            )}`,

          );

        const existingAmount =

          orderAmount(existing);

        const existingCurrency =

          orderCurrency(existing);

        const existingStatus =

          cleanString(

            existing.status,

          ).toLowerCase();

        const existingNotes =
          existing.notes &&
          typeof existing.notes === "object"
            ? existing.notes as Record<string, unknown>
            : {};

        const existingStudentId = cleanString(existingNotes.studentId);
        const existingStudentObjectId = cleanString(existingNotes.studentObjectId);
        const existingPlan = cleanString(existingNotes.internshipPlan);
        const normalizedExistingPlan = existingPlan
          ? normalizeInternshipPlanCode(existingPlan)
          : null;

        const existingOwnershipValid =
          (!existingStudentId || existingStudentId === studentId) &&
          (!existingStudentObjectId ||
            existingStudentObjectId === objectIdString(student._id)) &&
          (!existingPlan || normalizedExistingPlan === plan.code);

        if (

          existingAmount ===

            plan.amountInPaise &&

          existingCurrency ===

            plan.currency &&

          existingOwnershipValid &&

          (

            existingStatus ===

              "created" ||

            existingStatus ===

              "attempted"

          )

        ) {

          return {

            success: true,

            message:

              "Existing payment order is ready for checkout.",

            code:

              "PAYMENT_ORDER_REUSED",

            data: {

              keyId:

                getRazorpayConfig()

                  .keyId,

              orderId:

                existingOrderId,

              razorpayOrderId:

                existingOrderId,

              studentId,

              plan,

              title:

                cleanString(

                  student.internshipTrack,

                ) ||

                "CyberNet Careers Internship",

              receipt:

                cleanString(

                  existing.receipt,

                ),

              paymentStatus:

                "pending",

            },

          };

        }

      } catch (error) {

        console.error(

          "[PaymentService] Existing Razorpay order lookup failed:",

          error,

        );

        throw new PaymentServiceError(

          "EXISTING_ORDER_CHECK_FAILED",

          "Unable to verify the existing payment order. Please try again shortly.",

          503,

        );

      }

    }



    const receipt =

      createReceipt(

        studentId,

        plan.code,

      );

    const razorpayOrder =

      await razorpayRequest<RazorpayOrder>(

        "/orders",

        {

          method: "POST",

          body: {

            amount:

              plan.amountInPaise,

            currency:

              plan.currency,

            receipt,

            partial_payment:

              false,

            notes: {

              studentId,

              studentObjectId:

                objectIdString(

                  student._id,

                ),

              applicationId:

                cleanString(

                  student.applicationId,

                ) || "NA",

              internshipPlan:

                plan.code,

            },

          },

        },

      );

    const newOrderId =

      orderId(

        razorpayOrder,

      );

    if (!newOrderId) {

      throw new PaymentServiceError(

        "RAZORPAY_ORDER_ID_MISSING",

        "Razorpay did not return a valid order ID.",

        502,

      );

    }

    if (

      orderAmount(

        razorpayOrder,

      ) !==

      plan.amountInPaise

    ) {

      throw new PaymentServiceError(

        "RAZORPAY_AMOUNT_MISMATCH",

        "Razorpay order amount verification failed.",

        502,

      );

    }

    if (

      orderCurrency(

        razorpayOrder,

      ) !==

      plan.currency

    ) {

      throw new PaymentServiceError(

        "RAZORPAY_CURRENCY_MISMATCH",

        "Razorpay order currency verification failed.",

        502,

      );

    }



    const pending =

      await markPaymentPending({

        studentId,

        razorpayOrderId:

          newOrderId,

        amount:

          plan.amount,

        currency:

          plan.currency,

      });

    if (!pending.success) {

      throw new PaymentServiceError(

        pending.code ||

          "PAYMENT_PENDING_SAVE_FAILED",

        pending.message ||

          "Unable to save the payment order.",

        409,

      );

    }

    return {

      success: true,

      message:

        "Payment order created successfully.",

      code:

        "PAYMENT_ORDER_CREATED",

      data: {

        keyId:

          getRazorpayConfig()

            .keyId,

        orderId:

          newOrderId,

        razorpayOrderId:

          newOrderId,

        studentId,

        plan,

        title:

          cleanString(

            student.internshipTrack,

          ) ||

          "CyberNet Careers Internship",

        receipt,

        paymentStatus:

          "pending",

      },

    };

  } catch (error) {

    return errorResult(error);

  }

}

export async function verifyPayment(

  input: VerifyPaymentInput,

): Promise<

  PaymentResult<{

    studentId: string;

    paymentStatus: "paid";

    internshipStatus: string;

    studentOpsStatus: string;

    razorpayOrderId: string;

    razorpayPaymentId: string;

    amount: number;

    currency: string;

    verifiedAt: string;

    receiptEmailSent: boolean;

  }>

> {

  try {

    const studentId =

      normalizeStudentId(

        input.studentId,

      );

    const order =

      cleanString(

        input.razorpayOrderId,

      );

    const payment =

      cleanString(

        input.razorpayPaymentId,

      );

    const signature =

      cleanString(

        input.razorpaySignature,

      );

    if (!studentId) {

      throw new PaymentServiceError(

        "STUDENT_ID_REQUIRED",

        "Student ID is required.",

        400,

      );

    }

    if (!order) {

      throw new PaymentServiceError(

        "RAZORPAY_ORDER_ID_REQUIRED",

        "Razorpay Order ID is required.",

        400,

      );

    }

    if (!payment) {

      throw new PaymentServiceError(

        "RAZORPAY_PAYMENT_ID_REQUIRED",

        "Razorpay Payment ID is required.",

        400,

      );

    }

    if (!signature) {

      throw new PaymentServiceError(

        "RAZORPAY_SIGNATURE_REQUIRED",

        "Razorpay payment signature is required.",

        400,

      );

    }

    const student =

      await getStudent(

        studentId,

      );

    if (!student) {

      throw new PaymentServiceError(

        "STUDENT_NOT_FOUND",

        "Student account was not found.",

        404,

      );

    }



    const storedOrder =

      cleanString(

        student.razorpayOrderId,

      );

    if (

      !storedOrder ||

      storedOrder !== order

    ) {

      throw new PaymentServiceError(

        "PAYMENT_ORDER_MISMATCH",

        "Razorpay Order ID does not match the student's payment order.",

        409,

      );

    }



    if (

      !verifyPaymentSignature(

        storedOrder,

        payment,

        signature,

      )

    ) {

      throw new PaymentServiceError(

        "INVALID_PAYMENT_SIGNATURE",

        "Razorpay payment signature verification failed.",

        400,

      );

    }



    const [

      razorpayOrder,

      razorpayPayment,

    ] =

      await Promise.all([

        razorpayRequest<RazorpayOrder>(

          `/orders/${encodeURIComponent(

            storedOrder,

          )}`,

        ),

        razorpayRequest<RazorpayPayment>(

          `/payments/${encodeURIComponent(

            payment,

          )}`,

        ),

      ]);

    const plan =

      getPlan(

        student.internshipPlan,

      );

    const orderNotes =
      razorpayOrder.notes &&
      typeof razorpayOrder.notes === "object"
        ? razorpayOrder.notes as Record<string, unknown>
        : {};

    const notesStudentId = cleanString(orderNotes.studentId);
    const notesStudentObjectId = cleanString(orderNotes.studentObjectId);
    const notesPlan = cleanString(orderNotes.internshipPlan);

    if (notesStudentId && notesStudentId !== studentId) {
      throw new PaymentServiceError(
        "RAZORPAY_ORDER_STUDENT_MISMATCH",
        "Razorpay order does not belong to this student.",
        403,
      );
    }

    if (
      notesStudentObjectId &&
      notesStudentObjectId !== objectIdString(student._id)
    ) {
      throw new PaymentServiceError(
        "RAZORPAY_ORDER_OWNER_MISMATCH",
        "Razorpay order ownership could not be verified.",
        403,
      );
    }

    if (
      notesPlan &&
      normalizeInternshipPlanCode(notesPlan) !== plan.code
    ) {
      throw new PaymentServiceError(
        "RAZORPAY_ORDER_PLAN_MISMATCH",
        "Razorpay order does not match the selected internship plan.",
        409,
      );
    }

    if (

      orderAmount(

        razorpayOrder,

      ) !==

      plan.amountInPaise

    ) {

      throw new PaymentServiceError(

        "RAZORPAY_ORDER_AMOUNT_MISMATCH",

        "Razorpay order amount does not match the selected plan.",

        409,

      );

    }

    if (

      orderCurrency(

        razorpayOrder,

      ) !==

      plan.currency

    ) {

      throw new PaymentServiceError(

        "RAZORPAY_ORDER_CURRENCY_MISMATCH",

        "Razorpay order currency does not match the selected plan.",

        409,

      );

    }

    if (

      paymentOrderId(

        razorpayPayment,

      ) !==

      storedOrder

    ) {

      throw new PaymentServiceError(

        "PAYMENT_OWNERSHIP_MISMATCH",

        "Razorpay payment does not belong to this order.",

        409,

      );

    }

    if (

      paymentAmount(

        razorpayPayment,

      ) !==

      plan.amountInPaise

    ) {

      throw new PaymentServiceError(

        "PAYMENT_AMOUNT_MISMATCH",

        "Captured payment amount does not match the selected plan.",

        409,

      );

    }

    if (

      paymentCurrency(

        razorpayPayment,

      ) !==

      plan.currency

    ) {

      throw new PaymentServiceError(

        "PAYMENT_CURRENCY_MISMATCH",

        "Captured payment currency does not match the selected plan.",

        409,

      );

    }

    const status =

      cleanString(

        razorpayPayment.status,

      ).toLowerCase();

    const captured =

      razorpayPayment.captured ===

      true;

    if (

      status !== "captured" ||

      !captured

    ) {

      throw new PaymentServiceError(

        "PAYMENT_NOT_CAPTURED",

        "Payment has not been captured yet. Please try again after the payment is captured.",

        409,

      );

    }



    if (
      cleanString(student.paymentStatus) === "paid" &&
      cleanString(student.razorpayPaymentId) !== payment
    ) {
      throw new PaymentServiceError(
        "ANOTHER_PAYMENT_ALREADY_COMMITTED",
        "A different payment has already been confirmed for this internship.",
        409,
      );
    }

    if (

      cleanString(

        student.paymentStatus,

      ) === "paid" &&

      cleanString(

        student.razorpayPaymentId,

      ) === payment

    ) {

      const latest =

        await getStudent(

          studentId,

        );

      if (!latest) {

        throw new PaymentServiceError(

          "STUDENT_REFRESH_FAILED",

          "Unable to refresh payment state.",

          500,

        );

      }

      const receipt =

        await sendPaymentReceipt(

          latest,

          plan,

          storedOrder,

          payment,

        );

      return {

        success: true,

        message:

          receipt.sent

            ? "Payment was already verified and the receipt is available."

            : "Payment was already verified successfully.",

        code:

          "PAYMENT_ALREADY_VERIFIED",

        data: {

          studentId,

          paymentStatus:

            "paid",

          internshipStatus:

            cleanString(

              latest.internshipStatus,

            ),

          studentOpsStatus:

            cleanString(

              latest.studentOpsStatus,

            ),

          razorpayOrderId:

            storedOrder,

          razorpayPaymentId:

            payment,

          amount:

            plan.amount,

          currency:

            plan.currency,

          verifiedAt:

            (

              latest.paymentVerifiedAt ||

              new Date()

            ).toISOString(),

          receiptEmailSent:

            receipt.sent,

        },

      };

    }



    const committed =

      await recordVerifiedPayment({

        studentId,

        razorpayOrderId:

          storedOrder,

        razorpayPaymentId:

          payment,

        razorpaySignature:

          signature,

        amount:

          plan.amount,

        currency:

          plan.currency,

      });

    if (!committed.success) {

      throw new PaymentServiceError(

        committed.code ||

          "PAYMENT_COMMIT_FAILED",

        committed.message ||

          "Verified payment could not be committed.",

        409,

      );

    }



    const updated =

      await getStudent(

        studentId,

      );

    if (!updated) {

      throw new PaymentServiceError(

        "STUDENT_REFRESH_FAILED",

        "Payment was committed but the student could not be refreshed.",

        500,

      );

    }



    const receipt =

      await sendPaymentReceipt(

        updated,

        plan,

        storedOrder,

        payment,

      );

    return {

      success: true,

      message:

        receipt.sent

          ? "Payment verified successfully. Payment receipt has been sent."

          : "Payment verified successfully. Student is now waiting for Student Operations approval.",

      code:

        "PAYMENT_VERIFIED",

      data: {

        studentId,

        paymentStatus:

          "paid",

        internshipStatus:

          cleanString(

            updated.internshipStatus,

          ),

        studentOpsStatus:

          cleanString(

            updated.studentOpsStatus,

          ),

        razorpayOrderId:

          storedOrder,

        razorpayPaymentId:

          payment,

        amount:

          plan.amount,

        currency:

          plan.currency,

        verifiedAt:

          (

            updated.paymentVerifiedAt ||

            new Date()

          ).toISOString(),

        receiptEmailSent:

          receipt.sent,

      },

    };

  } catch (error) {

    return errorResult(error);

  }

}

export async function getPaymentStatus(

  studentIdInput: string,

): Promise<

  PaymentResult<{

    studentId: string;

    paymentStatus: string;

    paymentAmount: number;

    paymentCurrency: string;

    razorpayOrderId: string;

    razorpayPaymentId: string;

    internshipPlan: string;

    internshipStatus: string;

    studentOpsStatus: string;

    receiptEmailSent: boolean;

  }>

> {

  try {

    const studentId =

      normalizeStudentId(

        studentIdInput,

      );

    if (!studentId) {

      throw new PaymentServiceError(

        "STUDENT_ID_REQUIRED",

        "Student ID is required.",

        400,

      );

    }

    const student =

      await getStudent(

        studentId,

      );

    if (!student) {

      throw new PaymentServiceError(

        "STUDENT_NOT_FOUND",

        "Student account was not found.",

        404,

      );

    }

    return {

      success: true,

      message:

        "Payment status fetched successfully.",

      code:

        "PAYMENT_STATUS_FETCHED",

      data: {

        studentId,

        paymentStatus:

          cleanString(

            student.paymentStatus,

          ),

        paymentAmount:

          toNumber(

            student.paymentAmount,

          ) || 0,

        paymentCurrency:

          cleanString(

            student.paymentCurrency,

          ).toUpperCase(),

        razorpayOrderId:

          cleanString(

            student.razorpayOrderId,

          ),

        razorpayPaymentId:

          cleanString(

            student.razorpayPaymentId,

          ),

        internshipPlan:
          normalizeInternshipPlanCode(student.internshipPlan) ||
          cleanString(student.internshipPlan),

        internshipStatus:

          cleanString(

            student.internshipStatus,

          ),

        studentOpsStatus:

          cleanString(

            student.studentOpsStatus,

          ),

        receiptEmailSent:

          student.receiptEmailSent ===

          true,

      },

    };

  } catch (error) {

    return errorResult(error);

  }

}

async function sendPaymentReceipt(
  student: any,
  plan: PaymentPlan,
  order: string,
  payment: string,
): Promise<ReceiptResult> {
  const email = cleanString(student.email).toLowerCase();

  if (!email) {
    return {
      sent: false,
      configured: true,
      errorCode: "STUDENT_EMAIL_MISSING",
    };
  }

  if (
    student.receiptEmailSent === true &&
    cleanString(student.razorpayPaymentId) === payment
  ) {
    return {
      sent: true,
      configured: true,
    };
  }

  const paidAtValue =
    student.paymentVerifiedAt ||
    student.paymentCompletedAt ||
    new Date();

  const paidAt =
    paidAtValue instanceof Date
      ? paidAtValue
      : new Date(paidAtValue);

  try {
    await sendPaymentReceiptEmail({
      studentEmail: email,
      studentName: cleanString(student.fullName) || "Student",
      studentId: cleanString(student.studentId) || undefined,
      paymentId: payment,
      orderId: order,
      amount: plan.amount,
      currency: plan.currency,
      planName: plan.name,
      planDuration: `${plan.durationDays} days`,
      paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
    });

    const updateResult = await StudentModel.updateOne(
      {
        _id: student._id,
        paymentStatus: "paid",
        razorpayPaymentId: payment,
      },
      {
        $set: {
          receiptEmailSent: true,
          receiptEmailSentAt: new Date(),
        },
      },
    ).exec();

    if (updateResult.matchedCount === 0) {
      console.error(
        "[PaymentService] Receipt was sent but receipt status could not be matched to the verified payment.",
      );

      return {
        sent: true,
        configured: true,
        errorCode: "RECEIPT_STATUS_UPDATE_MISSED",
      };
    }

    return {
      sent: true,
      configured: true,
    };
  } catch (error) {
    console.error(
      "[PaymentService] Gmail SMTP receipt delivery failed:",
      error instanceof Error ? error.message : "Unknown email error",
    );

    return {
      sent: false,
      configured: true,
      errorCode: "RECEIPT_EMAIL_SEND_FAILED",
    };
  }
}

const paymentService = {

  PAYMENT_PLANS,

  normalizeInternshipPlanCode,

  getPaymentPlan,

  createPaymentOrder,

  verifyPayment,

  getPaymentStatus,

  generatePaymentSignature,

  verifyPaymentSignature,

};

export default paymentService;
