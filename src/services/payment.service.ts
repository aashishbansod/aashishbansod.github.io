import crypto from "node:crypto";

import StudentModel from "@/models/Student";
import connectDB from "@/lib/db";

import {
  markPaymentPending,
  recordVerifiedPayment,
} from "@/services/student.service";

/**
 * ============================================================
 * CYBERNET CAREERS
 * PAYMENT SERVICE
 * ============================================================
 *
 * SERVER-SIDE ONLY
 *
 * FINAL PAYMENT FLOW:
 *
 * Internship Selection
 *        ↓
 * Server validates plan
 *        ↓
 * Razorpay Order
 *        ↓
 * paymentStatus = pending
 *        ↓
 * Razorpay Checkout
 *        ↓
 * Signature Verification
 *        ↓
 * Razorpay Order Verification
 *        ↓
 * Razorpay Payment Verification
 *        ↓
 * Amount / Currency / Ownership validation
 *        ↓
 * paymentStatus = paid
 *        ↓
 * Student Operations Review
 *        ↓
 * Receipt Email
 *
 * IMPORTANT:
 * - Never trust frontend price.
 * - Never trust frontend paymentStatus.
 * - Never expose Razorpay secret.
 * - Never activate dashboard from payment success.
 * - Dashboard activation happens only through Student Operations.
 * ============================================================
 */

/* ============================================================
   TYPES
============================================================ */

export type InternshipPlanCode =
  | "1 month"
  | "3 months"
  | "6 months";

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
  plan: InternshipPlanCode;
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

/* ============================================================
   AUTHORITATIVE INTERNSHIP PRICING
============================================================ */

export const PAYMENT_PLANS: Record<
  InternshipPlanCode,
  PaymentPlan
> = {
  "1 month": {
    code: "1 month",
    name: "1 Month",
    durationMonths: 1,
    durationDays: 30,
    amount: 499,
    amountInPaise: 49900,
    currency: "INR",
  },

  "3 months": {
    code: "3 months",
    name: "3 Months",
    durationMonths: 3,
    durationDays: 90,
    amount: 999,
    amountInPaise: 99900,
    currency: "INR",
  },

  "6 months": {
    code: "6 months",
    name: "6 Months",
    durationMonths: 6,
    durationDays: 180,
    amount: 1699,
    amountInPaise: 169900,
    currency: "INR",
  },
};

/* ============================================================
   CONFIG
============================================================ */

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

function isPlan(
  value: unknown,
): value is InternshipPlanCode {
  return (
    value === "1 month" ||
    value === "3 months" ||
    value === "6 months"
  );
}

function getPlan(
  value: unknown,
): PaymentPlan {
  if (!isPlan(value)) {
    throw new PaymentServiceError(
      "INVALID_INTERNSHIP_PLAN",
      "Invalid internship plan.",
      400,
    );
  }

  return PAYMENT_PLANS[value];
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

/* ============================================================
   RAZORPAY HTTP CLIENT
============================================================ */

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

/* ============================================================
   RAZORPAY HELPERS
============================================================ */

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

/* ============================================================
   SIGNATURE VERIFICATION
============================================================ */

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

/* ============================================================
   STUDENT
============================================================ */

async function getStudent(
  studentId: string,
): Promise<any | null> {
  await connectDB();

  return StudentModel.findOne({
    studentId,
  }).exec();
}

/* ============================================================
   CREATE RAZORPAY ORDER
============================================================ */

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

    /* -----------------------------------------
       WORKFLOW GATES
    ----------------------------------------- */

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

    /* -----------------------------------------
       SERVER PRICE CHECK
    ----------------------------------------- */

    if (
      cleanString(
        student.internshipPlan,
      ) !== plan.code
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

    /* -----------------------------------------
       REUSE EXISTING PENDING ORDER
    ----------------------------------------- */

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

        if (
          existingAmount ===
            plan.amountInPaise &&
          existingCurrency ===
            plan.currency &&
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

    /* -----------------------------------------
       CREATE ORDER
    ----------------------------------------- */

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

    /* -----------------------------------------
       SAVE PENDING ORDER
    ----------------------------------------- */

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

/* ============================================================
   VERIFY PAYMENT
============================================================ */

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

    /* -----------------------------------------
       DATABASE ORDER OWNERSHIP
    ----------------------------------------- */

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

    /* -----------------------------------------
       HMAC SIGNATURE
    ----------------------------------------- */

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

    /* -----------------------------------------
       SERVER-SIDE RAZORPAY VERIFICATION
    ----------------------------------------- */

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
      status !== "captured" &&
      !captured
    ) {
      throw new PaymentServiceError(
        "PAYMENT_NOT_CAPTURED",
        "Payment has not been captured yet. Please try again after the payment is captured.",
        409,
      );
    }

    /* -----------------------------------------
       IDEMPOTENCY
    ----------------------------------------- */

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

    /* -----------------------------------------
       COMMIT VERIFIED PAYMENT
    ----------------------------------------- */

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

    /* -----------------------------------------
       REFRESH DATABASE STATE
    ----------------------------------------- */

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

    /* -----------------------------------------
       RECEIPT
    ----------------------------------------- */

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

/* ============================================================
   PAYMENT STATUS
============================================================ */

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
          cleanString(
            student.internshipPlan,
          ),

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

/* ============================================================
   RECEIPT EMAIL
============================================================ */

function getEmailConfig() {
  const apiKey =
    cleanString(
      process.env.RESEND_API_KEY,
    );

  const from =
    cleanString(
      process.env.RESEND_FROM_EMAIL,
    ) ||
    cleanString(
      process.env.EMAIL_FROM,
    );

  if (!apiKey || !from) {
    return null;
  }

  return {
    apiKey,
    from,
    fromName:
      cleanString(
        process.env.RESEND_FROM_NAME,
      ) ||
      "CyberNet Careers",
  };
}

function escapeHtml(
  value: unknown,
): string {
  return cleanString(value)
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

function formatINR(
  amount: number,
): string {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    },
  ).format(amount);
}

async function sendPaymentReceipt(
  student: any,
  plan: PaymentPlan,
  order: string,
  payment: string,
): Promise<ReceiptResult> {
  const email =
    cleanString(
      student.email,
    ).toLowerCase();

  const config =
    getEmailConfig();

  if (!email) {
    return {
      sent: false,
      configured:
        config !== null,
      errorCode:
        "STUDENT_EMAIL_MISSING",
    };
  }

  if (!config) {
    return {
      sent: false,
      configured: false,
      errorCode:
        "RECEIPT_EMAIL_NOT_CONFIGURED",
    };
  }

  if (
    student.receiptEmailSent ===
      true &&
    cleanString(
      student.razorpayPaymentId,
    ) === payment
  ) {
    return {
      sent: true,
      configured: true,
    };
  }

  const paidAt =
    (
      student.paymentVerifiedAt ||
      student.paymentCompletedAt ||
      new Date()
    ).toLocaleString(
      "en-IN",
      {
        timeZone:
          "Asia/Kolkata",
        dateStyle:
          "medium",
        timeStyle:
          "short",
      },
    );

  const receiptNumber =
    `CNT-${order
      .replace(
        /[^a-zA-Z0-9]/g,
        "",
      )
      .slice(-16)
      .toUpperCase()}`;

  const name =
    escapeHtml(
      student.fullName ||
        "Student",
    );

  const internship =
    escapeHtml(
      student.internshipTrack ||
        "CyberNet Careers Internship",
    );

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
<title>Payment Receipt - CyberNet Careers</title>
</head>

<body style="
margin:0;
background:#f4f7fb;
font-family:Arial,Helvetica,sans-serif;
color:#172033;
">

<div style="
max-width:680px;
margin:32px auto;
padding:0 16px;
">

<div style="
background:#fff;
border:1px solid #e4e9f2;
border-radius:18px;
overflow:hidden;
">

<div style="
padding:28px;
background:#0b63f6;
color:#fff;
">

<div style="
font-size:22px;
font-weight:700;
">
CyberNet Careers
</div>

<div style="
margin-top:7px;
font-size:14px;
opacity:.92;
">
Official Payment Receipt
</div>

</div>

<div style="padding:30px">

<h2>
Payment received successfully
</h2>

<p style="
line-height:1.6;
color:#526071;
">
Hello ${name}, your internship payment
has been successfully verified.
</p>

<table style="
width:100%;
border-collapse:collapse;
margin-top:20px;
">

<tr>
<td style="padding:10px 0;color:#697586">
Receipt
</td>
<td style="
padding:10px 0;
text-align:right;
font-weight:700;
">
${escapeHtml(receiptNumber)}
</td>
</tr>

<tr>
<td style="padding:10px 0;color:#697586">
Internship
</td>
<td style="
padding:10px 0;
text-align:right;
font-weight:700;
">
${internship}
</td>
</tr>

<tr>
<td style="padding:10px 0;color:#697586">
Plan
</td>
<td style="
padding:10px 0;
text-align:right;
font-weight:700;
">
${escapeHtml(plan.name)}
</td>
</tr>

<tr>
<td style="padding:10px 0;color:#697586">
Amount
</td>
<td style="
padding:10px 0;
text-align:right;
font-weight:700;
">
${formatINR(plan.amount)}
</td>
</tr>

<tr>
<td style="padding:10px 0;color:#697586">
Currency
</td>
<td style="
padding:10px 0;
text-align:right;
font-weight:700;
">
INR
</td>
</tr>

<tr>
<td style="padding:10px 0;color:#697586">
Razorpay Order ID
</td>
<td style="
padding:10px 0;
text-align:right;
font-size:12px;
font-weight:700;
">
${escapeHtml(order)}
</td>
</tr>

<tr>
<td style="padding:10px 0;color:#697586">
Razorpay Payment ID
</td>
<td style="
padding:10px 0;
text-align:right;
font-size:12px;
font-weight:700;
">
${escapeHtml(payment)}
</td>
</tr>

<tr>
<td style="padding:10px 0;color:#697586">
Paid At
</td>
<td style="
padding:10px 0;
text-align:right;
font-weight:700;
">
${escapeHtml(paidAt)}
</td>
</tr>

</table>

<div style="
margin-top:25px;
padding:16px;
border-radius:12px;
background:#eef8f2;
color:#17663a;
line-height:1.5;
">

Payment is complete.
Your account is now waiting for
Student Operations approval before
dashboard activation.

</div>

<p style="
margin-top:25px;
font-size:13px;
color:#7b8794;
line-height:1.6;
">

This is an electronically generated
receipt from CyberNet Careers.
Please keep this email for your records.

</p>

</div>
</div>
</div>

</body>
</html>
`;

  try {
    const response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${config.apiKey}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              from:
                `${config.fromName} <${config.from}>`,

              to: [email],

              subject:
                `Payment Receipt - CyberNet Careers`,

              html,
            }),

          cache: "no-store",
        },
      );

    const payload: unknown =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      console.error(
        "[PaymentService] Receipt email failed:",
        response.status,
        payload,
      );

      return {
        sent: false,
        configured: true,
        errorCode:
          "RECEIPT_EMAIL_SEND_FAILED",
      };
    }

    const messageId =
      payload &&
      typeof payload === "object" &&
      "id" in payload
        ? cleanString(
            payload.id,
          )
        : "";

    /*
     * Mark receipt sent only after provider
     * successfully accepts the email.
     */
    await StudentModel.updateOne(
      {
        _id:
          student._id,

        paymentStatus:
          "paid",

        razorpayPaymentId:
          payment,
      },

      {
        $set: {
          receiptEmailSent:
            true,

          receiptEmailSentAt:
            new Date(),
        },
      },
    ).exec();

    return {
      sent: true,
      configured: true,
      messageId:
        messageId ||
        undefined,
    };
  } catch (error) {
    console.error(
      "[PaymentService] Receipt exception:",
      error,
    );

    return {
      sent: false,
      configured: true,
      errorCode:
        "RECEIPT_EMAIL_SEND_FAILED",
    };
  }
}

/* ============================================================
   DEFAULT EXPORT
============================================================ */

const paymentService = {
  PAYMENT_PLANS,
  createPaymentOrder,
  verifyPayment,
  getPaymentStatus,
  generatePaymentSignature,
  verifyPaymentSignature,
};

export default paymentService;