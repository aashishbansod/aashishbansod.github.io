import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";
import ApplicationModel from "@/models/Application";
import {
  recordVerifiedPayment,
} from "@/services/student.service";

/* ============================================================
   CYBERNET CAREERS
   RAZORPAY WEBHOOK
   PRODUCTION-GRADE PAYMENT RECONCILIATION

   IMPORTANT WORKFLOW

   Razorpay
      ↓
   Webhook signature verification
      ↓
   Order/payment ownership verification
      ↓
   Amount + currency verification
      ↓
   Student payment reconciliation
      ↓
   Student Operations pending-review
      ↓
   Student Operations approval
      ↓
   Dashboard credentials
      ↓
   Dashboard activation

   THIS WEBHOOK NEVER:
   - trusts frontend payment status
   - creates students
   - activates dashboard automatically
   - generates dashboard credentials
   - bypasses Student Operations approval
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   CONSTANTS
   ============================================================ */

const RAZORPAY_API_BASE =
  "https://api.razorpay.com/v1";

const WEBHOOK_SIGNATURE_HEADER =
  "x-razorpay-signature";

const WEBHOOK_EVENT_ID_HEADER =
  "x-razorpay-event-id";

const MAX_BODY_BYTES =
  512 * 1024;

const RAZORPAY_TIMEOUT_MS =
  15_000;

const INR =
  "INR";

/* ============================================================
   TYPES
   ============================================================ */

type JsonObject =
  Record<string, unknown>;

type RazorpayNotes =
  Record<string, unknown>;

type RazorpayPayment = {
  id?: unknown;
  entity?: unknown;

  amount?: unknown;
  currency?: unknown;

  status?: unknown;
  order_id?: unknown;
  captured?: unknown;

  email?: unknown;
  contact?: unknown;
  method?: unknown;

  notes?: unknown;

  created_at?: unknown;
};

type RazorpayOrder = {
  id?: unknown;
  entity?: unknown;

  amount?: unknown;
  amount_paid?: unknown;
  amount_due?: unknown;

  currency?: unknown;
  status?: unknown;

  receipt?: unknown;
  attempts?: unknown;

  notes?: unknown;

  created_at?: unknown;
};

type RazorpayRefund = {
  id?: unknown;
  entity?: unknown;

  amount?: unknown;
  currency?: unknown;

  payment_id?: unknown;

  status?: unknown;

  created_at?: unknown;
};

type RazorpayOrderPaymentsResponse = {
  entity?: unknown;
  count?: unknown;
  items?: RazorpayPayment[];
};

type RazorpayWebhookPayload = {
  entity?: unknown;
  account_id?: unknown;
  event?: unknown;
  contains?: unknown;

  payload?: {
    payment?: {
      entity?: RazorpayPayment;
    };

    order?: {
      entity?: RazorpayOrder;
    };

    refund?: {
      entity?: RazorpayRefund;
    };
  };

  created_at?: unknown;
};

/* ============================================================
   RESPONSE HELPERS
   ============================================================ */

function jsonResponse(
  data: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",

      "X-Content-Type-Options":
        "nosniff",

      "X-Frame-Options":
        "DENY",

      "Referrer-Policy":
        "no-referrer",
    },
  });
}

function successResponse(
  message: string,
  data: JsonObject = {},
  status = 200,
): NextResponse {
  return jsonResponse(
    {
      success: true,
      message,
      data,
    },
    status,
  );
}

function errorResponse(
  message: string,
  code: string,
  status: number,
): NextResponse {
  return jsonResponse(
    {
      success: false,
      message,
      code,
    },
    status,
  );
}

/* ============================================================
   VALUE HELPERS
   ============================================================ */

function cleanString(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function numberValue(
  value: unknown,
  fallback = 0,
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function booleanValue(
  value: unknown,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    return [
      "true",
      "1",
      "yes",
      "on",
    ].includes(
      value.trim().toLowerCase(),
    );
  }

  return false;
}

function isPlainObject(
  value: unknown,
): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function upper(
  value: unknown,
): string {
  return cleanString(value).toUpperCase();
}

function rupeesToPaise(
  amount: unknown,
): number {
  const value = numberValue(amount);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0;
  }

  return Math.round(value * 100);
}

function amountsMatch(
  receivedPaise: unknown,
  expectedRupees: unknown,
): boolean {
  const received = Math.round(
    numberValue(receivedPaise),
  );

  const expected =
    rupeesToPaise(expectedRupees);

  return (
    received > 0 &&
    expected > 0 &&
    received === expected
  );
}

/* ============================================================
   ENVIRONMENT
   ============================================================ */

function getWebhookSecret(): string {
  const secret = cleanString(
    process.env.RAZORPAY_WEBHOOK_SECRET,
  );

  if (!secret) {
    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET is not configured.",
    );
  }

  return secret;
}

function getRazorpayCredentials(): {
  keyId: string;
  keySecret: string;
} {
  const keyId = cleanString(
    process.env.RAZORPAY_KEY_ID,
  );

  const keySecret = cleanString(
    process.env.RAZORPAY_KEY_SECRET,
  );

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay API credentials are not configured.",
    );
  }

  return {
    keyId,
    keySecret,
  };
}

/* ============================================================
   WEBHOOK SIGNATURE
   ============================================================ */

function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string,
  secret: string,
): boolean {
  if (
    !rawBody ||
    !receivedSignature ||
    !secret
  ) {
    return false;
  }

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret,
      )
      .update(
        rawBody,
        "utf8",
      )
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8",
    );

  const receivedBuffer =
    Buffer.from(
      receivedSignature,
      "utf8",
    );

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
}

/* ============================================================
   RAZORPAY API
   ============================================================ */

async function razorpayRequest<T>(
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: JsonObject;
  },
): Promise<T> {
  const {
    keyId,
    keySecret,
  } = getRazorpayCredentials();

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => {
      controller.abort();
    },
    RAZORPAY_TIMEOUT_MS,
  );

  try {
    const auth = Buffer.from(
      `${keyId}:${keySecret}`,
      "utf8",
    ).toString("base64");

    const response = await fetch(
      `${RAZORPAY_API_BASE}${path}`,
      {
        method:
          options?.method ?? "GET",

        headers: {
          Authorization:
            `Basic ${auth}`,

          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          options?.body
            ? JSON.stringify(
                options.body,
              )
            : undefined,

        cache: "no-store",

        signal:
          controller.signal,
      },
    );

    const text =
      await response.text();

    let data: unknown = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      throw new Error(
        `Razorpay API returned HTTP ${response.status}.`,
      );
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   PAYLOAD HELPERS
   ============================================================ */

function getPaymentEntity(
  payload: RazorpayWebhookPayload,
): RazorpayPayment | null {
  const entity =
    payload.payload
      ?.payment
      ?.entity;

  return entity &&
    isPlainObject(entity)
    ? entity as RazorpayPayment
    : null;
}

function getOrderEntity(
  payload: RazorpayWebhookPayload,
): RazorpayOrder | null {
  const entity =
    payload.payload
      ?.order
      ?.entity;

  return entity &&
    isPlainObject(entity)
    ? entity as RazorpayOrder
    : null;
}

function getRefundEntity(
  payload: RazorpayWebhookPayload,
): RazorpayRefund | null {
  const entity =
    payload.payload
      ?.refund
      ?.entity;

  return entity &&
    isPlainObject(entity)
    ? entity as RazorpayRefund
    : null;
}

/* ============================================================
   EVENT HELPERS
   ============================================================ */

function normalizeEvent(
  value: unknown,
): string {
  return cleanString(
    value,
  ).toLowerCase();
}

function isSuccessfulPaymentEvent(
  event: string,
): boolean {
  return (
    event === "payment.captured" ||
    event === "order.paid"
  );
}

function isFailedPaymentEvent(
  event: string,
): boolean {
  return event === "payment.failed";
}

function isRefundCreatedEvent(
  event: string,
): boolean {
  return event === "refund.created";
}

function isRefundProcessedEvent(
  event: string,
): boolean {
  return event === "refund.processed";
}

function isRefundFailedEvent(
  event: string,
): boolean {
  return event === "refund.failed";
}

/* ============================================================
   ID EXTRACTION
   ============================================================ */

function extractOrderId(
  payload: RazorpayWebhookPayload,
): string {
  const payment =
    getPaymentEntity(payload);

  const order =
    getOrderEntity(payload);

  const paymentOrderId =
    cleanString(
      payment?.order_id,
    );

  if (paymentOrderId) {
    return paymentOrderId;
  }

  return cleanString(order?.id);
}

function extractPaymentId(
  payload: RazorpayWebhookPayload,
): string {
  return cleanString(
    getPaymentEntity(payload)?.id,
  );
}

/* ============================================================
   OWNERSHIP VALIDATION
   ============================================================ */

function notesMatchStudent(
  notes: unknown,
  student: {
    studentId?: unknown;
    applicationId?: unknown;
    _id?: unknown;
  },
): boolean {
  /*
   * For security:
   *
   * If our backend created notes, every available ownership
   * value must match.
   *
   * If old Razorpay orders have no notes, we still rely on
   * Student.razorpayOrderId as the authoritative relationship.
   */

  if (!isPlainObject(notes)) {
    return true;
  }

  const noteStudentId =
    cleanString(
      notes.studentId,
    );

  const noteApplicationId =
    cleanString(
      notes.applicationId,
    );

  const noteObjectId =
    cleanString(
      notes.studentObjectId,
    );

  const studentId =
    cleanString(
      student.studentId,
    );

  const applicationId =
    cleanString(
      student.applicationId,
    );

  const objectId =
    cleanString(
      student._id,
    );

  if (
    noteStudentId &&
    studentId &&
    noteStudentId !== studentId
  ) {
    return false;
  }

  if (
    noteApplicationId &&
    applicationId &&
    noteApplicationId !==
      applicationId
  ) {
    return false;
  }

  if (
    noteObjectId &&
    objectId &&
    noteObjectId !== objectId
  ) {
    return false;
  }

  return true;
}

/* ============================================================
   RESOLVE CAPTURED PAYMENT
   ============================================================ */

async function findCapturedPaymentForOrder(
  orderId: string,
  expectedAmountRupees: number,
): Promise<RazorpayPayment | null> {
  const response =
    await razorpayRequest<RazorpayOrderPaymentsResponse>(
      `/orders/${encodeURIComponent(
        orderId,
      )}/payments`,
      {
        method: "GET",
      },
    );

  const items =
    Array.isArray(response.items)
      ? response.items
      : [];

  const expectedPaise =
    rupeesToPaise(
      expectedAmountRupees,
    );

  const captured =
    items.find(
      (payment) => {
        const status =
          cleanString(
            payment.status,
          ).toLowerCase();

        const paymentOrderId =
          cleanString(
            payment.order_id,
          );

        const amount =
          Math.round(
            numberValue(
              payment.amount,
            ),
          );

        const captured =
          booleanValue(
            payment.captured,
          ) ||
          status === "captured";

        return (
          cleanString(
            payment.id,
          ) &&
          paymentOrderId ===
            orderId &&
          captured &&
          amount ===
            expectedPaise
        );
      },
    );

  return captured ?? null;
}

/* ============================================================
   APPLICATION SYNCHRONIZATION
   ============================================================ */

async function syncApplicationPayment(
  applicationId: string,
  status:
    | "paid"
    | "failed"
    | "refunded",
  paymentId?: string,
): Promise<void> {
  if (!applicationId) {
    return;
  }

  try {
    await ApplicationModel
      .updateOne(
        {
          applicationId,
        },
        {
          $set: {
            paymentStatus: status,

            ...(paymentId
              ? {
                  paymentId,
                }
              : {}),
          },
        },
      )
      .exec();
  } catch (error) {
    /*
     * Student is the authoritative payment record.
     *
     * Application synchronization is secondary and must not
     * turn a valid Razorpay event into a webhook failure.
     */

    console.error(
      "[RAZORPAY WEBHOOK] Application payment synchronization failed.",
      {
        applicationId,
        status,
        paymentId,
        error,
      },
    );
  }
}

/* ============================================================
   SUCCESSFUL PAYMENT
   ============================================================ */

async function handleSuccessfulPayment(
  payload: RazorpayWebhookPayload,
  event: string,
): Promise<NextResponse> {
  const payment =
    getPaymentEntity(payload);

  const order =
    getOrderEntity(payload);

  const orderId =
    extractOrderId(payload);

  if (!orderId) {
    return errorResponse(
      "Webhook order ID is missing.",
      "WEBHOOK_ORDER_ID_MISSING",
      400,
    );
  }

  /*
   * Always identify a student from our database.
   *
   * NEVER create a student from Razorpay webhook data.
   */

  const student =
    await StudentModel
      .findOne({
        razorpayOrderId:
          orderId,
      })
      .exec();

  if (!student) {
    /*
     * Unknown/old orders are acknowledged.
     * This prevents unnecessary Razorpay retries.
     */

    console.warn(
      "[RAZORPAY WEBHOOK] No student found for order.",
      {
        event,
        orderId,
      },
    );

    return successResponse(
      "Webhook received. No matching student payment order was found.",
      {
        handled: false,
        event,
        orderId,
      },
    );
  }

  const storedOrderId =
    cleanString(
      student.razorpayOrderId,
    );

  if (
    storedOrderId !== orderId
  ) {
    return errorResponse(
      "Webhook order does not match the stored student payment order.",
      "ORDER_OWNERSHIP_MISMATCH",
      409,
    );
  }

  const currentPaymentStatus =
    cleanString(
      student.paymentStatus,
    ).toLowerCase();

  const currentPaymentId =
    cleanString(
      student.razorpayPaymentId,
    );

  const webhookPaymentId =
    cleanString(
      payment?.id,
    );

  /*
   * IDEMPOTENCY
   *
   * Razorpay can deliver the same webhook more than once.
   */

  if (
    currentPaymentStatus ===
      "paid" &&
    webhookPaymentId &&
    currentPaymentId ===
      webhookPaymentId
  ) {
    return successResponse(
      "Payment webhook was already processed.",
      {
        handled: true,
        duplicate: true,
        event,
        orderId,
        paymentId:
          webhookPaymentId,
        paymentStatus:
          "paid",
        studentOpsStatus:
          cleanString(
            student.studentOpsStatus,
          ),
        dashboardStatus:
          cleanString(
            student.dashboardStatus,
          ),
      },
    );
  }

  /*
   * NEVER replace an already successful payment with another
   * payment ID for the same student/order.
   */

  if (
    currentPaymentStatus ===
      "paid" &&
    currentPaymentId &&
    webhookPaymentId &&
    currentPaymentId !==
      webhookPaymentId
  ) {
    console.error(
      "[RAZORPAY WEBHOOK] Payment overwrite attempt blocked.",
      {
        studentId:
          student.studentId,
        orderId,
        currentPaymentId,
        webhookPaymentId,
      },
    );

    return errorResponse(
      "A different payment is already completed for this order.",
      "PAYMENT_ALREADY_COMPLETED",
      409,
    );
  }

  const expectedAmount =
    numberValue(
      student.paymentAmount,
    );

  if (expectedAmount <= 0) {
    return errorResponse(
      "Stored payment amount is invalid.",
      "INVALID_STORED_PAYMENT_AMOUNT",
      409,
    );
  }

  /*
   * order.paid can contain an order without a payment entity.
   *
   * Resolve the captured payment directly from Razorpay.
   */

  let resolvedPayment =
    payment;

  if (
    !resolvedPayment ||
    !cleanString(
      resolvedPayment.id,
    )
  ) {
    try {
      resolvedPayment =
        await findCapturedPaymentForOrder(
          orderId,
          expectedAmount,
        );
    } catch (error) {
      console.error(
        "[RAZORPAY WEBHOOK] Payment reconciliation lookup failed.",
        {
          orderId,
          studentId:
            student.studentId,
          error,
        },
      );

      /*
       * 500 causes Razorpay to retry the webhook.
       */

      return errorResponse(
        "Unable to reconcile the Razorpay payment right now.",
        "PAYMENT_RECONCILIATION_FAILED",
        500,
      );
    }
  }

  const paymentId =
    cleanString(
      resolvedPayment?.id,
    );

  if (!paymentId) {
    return errorResponse(
      "Captured payment ID could not be resolved.",
      "PAYMENT_ID_MISSING",
      409,
    );
  }

  /*
   * PAYMENT MUST BELONG TO OUR ORDER
   */

  const paymentOrderId =
    cleanString(
      resolvedPayment?.order_id,
    );

  if (
    paymentOrderId &&
    paymentOrderId !== orderId
  ) {
    console.error(
      "[RAZORPAY WEBHOOK] Payment/order mismatch.",
      {
        studentId:
          student.studentId,
        orderId,
        paymentOrderId,
        paymentId,
      },
    );

    return errorResponse(
      "Razorpay payment does not belong to the stored order.",
      "PAYMENT_ORDER_MISMATCH",
      409,
    );
  }

  /*
   * PAYMENT MUST BE CAPTURED
   */

  const paymentStatus =
    cleanString(
      resolvedPayment?.status,
    ).toLowerCase();

  const paymentCaptured =
    booleanValue(
      resolvedPayment?.captured,
    ) ||
    paymentStatus ===
      "captured";

  if (!paymentCaptured) {
    console.warn(
      "[RAZORPAY WEBHOOK] Successful event received before capture.",
      {
        event,
        orderId,
        paymentId,
        paymentStatus,
      },
    );

    return errorResponse(
      "Payment is not captured yet.",
      "PAYMENT_NOT_CAPTURED",
      500,
    );
  }

  /*
   * CURRENCY
   */

  const storedCurrency =
    upper(
      student.paymentCurrency,
    ) || INR;

  const paymentCurrency =
    upper(
      resolvedPayment?.currency ||
        order?.currency,
    ) || INR;

  if (
    paymentCurrency !==
    storedCurrency
  ) {
    console.error(
      "[RAZORPAY WEBHOOK] Currency mismatch.",
      {
        studentId:
          student.studentId,
        orderId,
        paymentId,
        paymentCurrency,
        storedCurrency,
      },
    );

    return errorResponse(
      "Payment currency does not match the stored currency.",
      "PAYMENT_CURRENCY_MISMATCH",
      409,
    );
  }

  if (
    paymentCurrency !== INR
  ) {
    return errorResponse(
      "Only INR payments are supported.",
      "UNSUPPORTED_PAYMENT_CURRENCY",
      400,
    );
  }

  /*
   * PAYMENT AMOUNT
   */

  const paymentAmountPaise =
    numberValue(
      resolvedPayment?.amount,
    );

  if (
    !amountsMatch(
      paymentAmountPaise,
      expectedAmount,
    )
  ) {
    console.error(
      "[RAZORPAY WEBHOOK] Payment amount mismatch.",
      {
        studentId:
          student.studentId,
        orderId,
        paymentId,
        receivedPaise:
          paymentAmountPaise,
        expectedPaise:
          rupeesToPaise(
            expectedAmount,
          ),
      },
    );

    return errorResponse(
      "Payment amount does not match the selected internship amount.",
      "PAYMENT_AMOUNT_MISMATCH",
      409,
    );
  }

  /*
   * RAZORPAY ORDER AMOUNT
   */

  const orderAmount =
    numberValue(
      order?.amount,
    );

  if (
    orderAmount > 0 &&
    orderAmount !==
      rupeesToPaise(
        expectedAmount,
      )
  ) {
    return errorResponse(
      "Razorpay order amount does not match the stored internship amount.",
      "ORDER_AMOUNT_MISMATCH",
      409,
    );
  }

  /*
   * RAZORPAY ORDER CURRENCY
   */

  const orderCurrency =
    upper(
      order?.currency,
    );

  if (
    orderCurrency &&
    orderCurrency !==
      storedCurrency
  ) {
    return errorResponse(
      "Razorpay order currency does not match the stored currency.",
      "ORDER_CURRENCY_MISMATCH",
      409,
    );
  }

  /*
   * OWNERSHIP NOTES
   */

  if (
    !notesMatchStudent(
      resolvedPayment?.notes ||
        order?.notes,
      student,
    )
  ) {
    console.error(
      "[RAZORPAY WEBHOOK] Ownership notes mismatch.",
      {
        studentId:
          student.studentId,
        orderId,
        paymentId,
      },
    );

    return errorResponse(
      "Razorpay payment ownership validation failed.",
      "PAYMENT_OWNERSHIP_MISMATCH",
      409,
    );
  }

  /*
   * AUTHORITATIVE LIFECYCLE MUTATION
   *
   * recordVerifiedPayment() is the single student-service
   * payment commit point.
   *
   * It does NOT activate the dashboard.
   */

  const verificationResult =
    await recordVerifiedPayment({
      studentId:
        cleanString(
          student.studentId,
        ),

      razorpayOrderId:
        orderId,

      razorpayPaymentId:
        paymentId,

      amount:
        expectedAmount,

      currency:
        storedCurrency,
    });

  if (
    !verificationResult.success
  ) {
    /*
     * Safe idempotency case.
     */

    if (
      verificationResult.code ===
      "PAYMENT_ALREADY_VERIFIED"
    ) {
      return successResponse(
        "Payment webhook was already reconciled.",
        {
          handled: true,
          duplicate: true,
          event,
          orderId,
          paymentId,
        },
      );
    }

    console.error(
      "[RAZORPAY WEBHOOK] Student payment commit failed.",
      {
        studentId:
          student.studentId,
        orderId,
        paymentId,
        code:
          verificationResult.code,
        message:
          verificationResult.message,
      },
    );

    return errorResponse(
      "Payment was received but could not be committed to the student account.",
      "PAYMENT_COMMIT_FAILED",
      500,
    );
  }

  /*
   * SECONDARY APPLICATION SYNC
   */

  await syncApplicationPayment(
    cleanString(
      student.applicationId,
    ),
    "paid",
    paymentId,
  );

  console.info(
    "[RAZORPAY WEBHOOK] Payment successfully reconciled.",
    {
      event,
      studentId:
        student.studentId,
      applicationId:
        cleanString(
          student.applicationId,
        ),
      orderId,
      paymentId,
      amount:
        expectedAmount,
      currency:
        storedCurrency,
      nextWorkflow:
        "student-operations-review",
    },
  );

  /*
   * IMPORTANT:
   *
   * Payment is complete.
   * Student Operations approval is still required.
   * Dashboard remains locked.
   */

  return successResponse(
    "Razorpay payment webhook processed successfully.",
    {
      handled: true,
      duplicate: false,

      event,

      studentId:
        cleanString(
          student.studentId,
        ),

      applicationId:
        cleanString(
          student.applicationId,
        ),

      orderId,

      paymentId,

      paymentStatus:
        "paid",

      internshipStatus:
        "approved",

      studentOpsStatus:
        "pending-review",

      dashboardStatus:
        "locked",

      dashboardActivation:
        false,
    },
  );
}

/* ============================================================
   FAILED PAYMENT
   ============================================================ */

async function handleFailedPayment(
  payload: RazorpayWebhookPayload,
): Promise<NextResponse> {
  const payment =
    getPaymentEntity(payload);

  const order =
    getOrderEntity(payload);

  const orderId =
    extractOrderId(payload);

  const paymentId =
    cleanString(
      payment?.id,
    );

  if (!orderId) {
    return errorResponse(
      "Webhook order ID is missing.",
      "WEBHOOK_ORDER_ID_MISSING",
      400,
    );
  }

  const student =
    await StudentModel
      .findOne({
        razorpayOrderId:
          orderId,
      })
      .exec();

  if (!student) {
    console.warn(
      "[RAZORPAY WEBHOOK] Failed payment for unknown order.",
      {
        orderId,
        paymentId,
      },
    );

    return successResponse(
      "Failed payment webhook received.",
      {
        handled: false,
        event:
          "payment.failed",
        orderId,
        paymentId,
      },
    );
  }

  const currentStatus =
    cleanString(
      student.paymentStatus,
    ).toLowerCase();

  /*
   * NEVER downgrade a successful payment.
   */

  if (
    currentStatus === "paid"
  ) {
    return successResponse(
      "Failed payment event ignored because payment is already successful.",
      {
        handled: true,
        ignored: true,
        event:
          "payment.failed",
        orderId,
        paymentId,
        paymentStatus:
          "paid",
      },
    );
  }

  /*
   * Validate order ownership.
   */

  const paymentOrderId =
    cleanString(
      payment?.order_id,
    );

  if (
    paymentOrderId &&
    paymentOrderId !== orderId
  ) {
    return errorResponse(
      "Failed payment does not belong to the stored order.",
      "PAYMENT_ORDER_MISMATCH",
      409,
    );
  }

  /*
   * Validate currency if Razorpay supplied it.
   */

  const storedCurrency =
    upper(
      student.paymentCurrency,
    ) || INR;

  const paymentCurrency =
    upper(
      payment?.currency ||
        order?.currency,
    );

  if (
    paymentCurrency &&
    paymentCurrency !==
      storedCurrency
  ) {
    return errorResponse(
      "Failed payment currency does not match the stored currency.",
      "PAYMENT_CURRENCY_MISMATCH",
      409,
    );
  }

  /*
   * Failed checkout attempt.
   *
   * Student remains eligible for another payment attempt.
   */

  student.paymentStatus =
    "failed";

  student.internshipStatus =
    "payment-pending";

  await student.save();

  await syncApplicationPayment(
    cleanString(
      student.applicationId,
    ),
    "failed",
    paymentId || undefined,
  );

  console.warn(
    "[RAZORPAY WEBHOOK] Payment failed.",
    {
      studentId:
        student.studentId,
      applicationId:
        cleanString(
          student.applicationId,
        ),
      orderId,
      paymentId,
    },
  );

  return successResponse(
    "Failed payment webhook processed.",
    {
      handled: true,
      event:
        "payment.failed",

      studentId:
        cleanString(
          student.studentId,
        ),

      orderId,
      paymentId,

      paymentStatus:
        "failed",

      internshipStatus:
        "payment-pending",
    },
  );
}

/* ============================================================
   REFUND CREATED
   ============================================================ */

async function handleRefundCreated(
  payload: RazorpayWebhookPayload,
): Promise<NextResponse> {
  const refund =
    getRefundEntity(payload);

  const paymentId =
    cleanString(
      refund?.payment_id,
    );

  const refundId =
    cleanString(
      refund?.id,
    );

  if (!paymentId) {
    return errorResponse(
      "Refund payment ID is missing.",
      "REFUND_PAYMENT_ID_MISSING",
      400,
    );
  }

  const student =
    await StudentModel
      .findOne({
        razorpayPaymentId:
          paymentId,
      })
      .exec();

  if (!student) {
    console.warn(
      "[RAZORPAY WEBHOOK] Refund created for unknown payment.",
      {
        paymentId,
        refundId,
      },
    );

    return successResponse(
      "Refund webhook received.",
      {
        handled: false,
        event:
          "refund.created",
        paymentId,
        refundId,
      },
    );
  }

  /*
   * refund.created does NOT necessarily mean the refund is
   * completed.
   *
   * Therefore we intentionally do not change paymentStatus.
   */

  console.info(
    "[RAZORPAY WEBHOOK] Refund created.",
    {
      studentId:
        student.studentId,

      paymentId,

      refundId,

      amountPaise:
        numberValue(
          refund?.amount,
        ),
    },
  );

  return successResponse(
    "Refund creation webhook acknowledged.",
    {
      handled: true,

      event:
        "refund.created",

      studentId:
        student.studentId,

      paymentId,
      refundId,

      paymentStatus:
        cleanString(
          student.paymentStatus,
        ),
    },
  );
}

/* ============================================================
   REFUND PROCESSED
   ============================================================ */

async function handleRefundProcessed(
  payload: RazorpayWebhookPayload,
): Promise<NextResponse> {
  const refund =
    getRefundEntity(payload);

  const paymentId =
    cleanString(
      refund?.payment_id,
    );

  const refundId =
    cleanString(
      refund?.id,
    );

  if (!paymentId) {
    return errorResponse(
      "Refund payment ID is missing.",
      "REFUND_PAYMENT_ID_MISSING",
      400,
    );
  }

  const student =
    await StudentModel
      .findOne({
        razorpayPaymentId:
          paymentId,
      })
      .exec();

  if (!student) {
    console.warn(
      "[RAZORPAY WEBHOOK] Processed refund for unknown payment.",
      {
        paymentId,
        refundId,
      },
    );

    return successResponse(
      "Refund webhook received.",
      {
        handled: false,
        event:
          "refund.processed",
        paymentId,
        refundId,
      },
    );
  }

  const refundAmountPaise =
    numberValue(
      refund?.amount,
    );

  const originalAmountPaise =
    rupeesToPaise(
      student.paymentAmount,
    );

  /*
   * PARTIAL REFUND
   *
   * Current Student paymentStatus has no dedicated
   * partial-refund state.
   *
   * Therefore never incorrectly mark a partial refund as
   * a complete refund.
   */

  if (
    refundAmountPaise > 0 &&
    originalAmountPaise > 0 &&
    refundAmountPaise <
      originalAmountPaise
  ) {
    console.warn(
      "[RAZORPAY WEBHOOK] Partial refund processed.",
      {
        studentId:
          student.studentId,

        paymentId,
        refundId,

        refundAmountPaise,
        originalAmountPaise,
      },
    );

    return successResponse(
      "Partial refund webhook processed without changing full payment status.",
      {
        handled: true,
        partialRefund: true,

        event:
          "refund.processed",

        studentId:
          student.studentId,

        paymentId,
        refundId,

        paymentStatus:
          cleanString(
            student.paymentStatus,
          ),
      },
    );
  }

  /*
   * FULL REFUND
   */

  student.paymentStatus =
    "refunded";

  /*
   * A refunded internship must not remain active.
   */

  student.internshipStatus =
    "rejected";

  /*
   * Dashboard must remain locked.
   */

  student.dashboardStatus =
    "locked";

  student.dashboardLoginEnabled =
    false;

  student.dashboardActivatedAt =
    null;

  /*
   * Keep payment ID for audit/reconciliation.
   */

  await student.save();

  await syncApplicationPayment(
    cleanString(
      student.applicationId,
    ),
    "refunded",
    paymentId,
  );

  console.warn(
    "[RAZORPAY WEBHOOK] Full refund processed.",
    {
      studentId:
        student.studentId,

      applicationId:
        cleanString(
          student.applicationId,
        ),

      paymentId,
      refundId,
    },
  );

  return successResponse(
    "Refund webhook processed successfully.",
    {
      handled: true,

      event:
        "refund.processed",

      studentId:
        student.studentId,

      paymentId,
      refundId,

      paymentStatus:
        "refunded",

      internshipStatus:
        "rejected",

      dashboardStatus:
        "locked",

      dashboardActivation:
        false,
    },
  );
}

/* ============================================================
   REFUND FAILED
   ============================================================ */

async function handleRefundFailed(
  payload: RazorpayWebhookPayload,
): Promise<NextResponse> {
  const refund =
    getRefundEntity(payload);

  const paymentId =
    cleanString(
      refund?.payment_id,
    );

  const refundId =
    cleanString(
      refund?.id,
    );

  if (!paymentId) {
    return errorResponse(
      "Refund payment ID is missing.",
      "REFUND_PAYMENT_ID_MISSING",
      400,
    );
  }

  const student =
    await StudentModel
      .findOne({
        razorpayPaymentId:
          paymentId,
      })
      .exec();

  if (!student) {
    return successResponse(
      "Refund failed webhook acknowledged.",
      {
        handled: false,
        event:
          "refund.failed",
        paymentId,
        refundId,
      },
    );
  }

  /*
   * A failed refund does NOT mean that the original payment
   * failed.
   *
   * Keep the original payment state unchanged.
   */

  console.warn(
    "[RAZORPAY WEBHOOK] Refund failed.",
    {
      studentId:
        student.studentId,

      paymentId,
      refundId,

      currentPaymentStatus:
        cleanString(
          student.paymentStatus,
        ),
    },
  );

  return successResponse(
    "Refund failed webhook processed.",
    {
      handled: true,

      event:
        "refund.failed",

      studentId:
        student.studentId,

      paymentId,
      refundId,

      paymentStatus:
        cleanString(
          student.paymentStatus,
        ),
    },
  );
}

/* ============================================================
   POST
   ============================================================ */

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const startedAt =
    Date.now();

  try {
    /* --------------------------------------------------------
       BODY SIZE
       -------------------------------------------------------- */

    const contentLength =
      request.headers.get(
        "content-length",
      );

    if (contentLength) {
      const length =
        Number(contentLength);

      if (
        Number.isFinite(length) &&
        length > MAX_BODY_BYTES
      ) {
        return errorResponse(
          "Webhook payload is too large.",
          "WEBHOOK_PAYLOAD_TOO_LARGE",
          413,
        );
      }
    }

    /* --------------------------------------------------------
       SIGNATURE
       -------------------------------------------------------- */

    const receivedSignature =
      cleanString(
        request.headers.get(
          WEBHOOK_SIGNATURE_HEADER,
        ),
      );

    if (!receivedSignature) {
      console.warn(
        "[RAZORPAY WEBHOOK] Missing signature.",
      );

      return errorResponse(
        "Razorpay webhook signature is required.",
        "WEBHOOK_SIGNATURE_MISSING",
        401,
      );
    }

    /* --------------------------------------------------------
       SECRET
       -------------------------------------------------------- */

    let webhookSecret: string;

    try {
      webhookSecret =
        getWebhookSecret();
    } catch (error) {
      console.error(
        "[RAZORPAY WEBHOOK] Webhook secret configuration error.",
        error,
      );

      return errorResponse(
        "Payment webhook is not configured on the server.",
        "WEBHOOK_NOT_CONFIGURED",
        503,
      );
    }

    /* --------------------------------------------------------
       RAW BODY

       IMPORTANT:
       Razorpay signature MUST be calculated against the exact
       raw request body.

       Never stringify parsed JSON before verification.
       -------------------------------------------------------- */

    const rawBody =
      await request.text();

    if (!rawBody) {
      return errorResponse(
        "Webhook request body is empty.",
        "WEBHOOK_BODY_EMPTY",
        400,
      );
    }

    const rawBodyBytes =
      Buffer.byteLength(
        rawBody,
        "utf8",
      );

    if (
      rawBodyBytes >
      MAX_BODY_BYTES
    ) {
      return errorResponse(
        "Webhook payload is too large.",
        "WEBHOOK_PAYLOAD_TOO_LARGE",
        413,
      );
    }

    /* --------------------------------------------------------
       SIGNATURE VERIFICATION
       -------------------------------------------------------- */

    const signatureValid =
      verifyWebhookSignature(
        rawBody,
        receivedSignature,
        webhookSecret,
      );

    if (!signatureValid) {
      console.warn(
        "[RAZORPAY WEBHOOK] Invalid webhook signature.",
        {
          bodyBytes:
            rawBodyBytes,
        },
      );

      return errorResponse(
        "Invalid Razorpay webhook signature.",
        "INVALID_WEBHOOK_SIGNATURE",
        401,
      );
    }

    /* --------------------------------------------------------
       JSON PARSE
       -------------------------------------------------------- */

    let payload:
      RazorpayWebhookPayload;

    try {
      const parsed =
        JSON.parse(rawBody);

      if (
        !isPlainObject(parsed)
      ) {
        return errorResponse(
          "Invalid webhook payload.",
          "INVALID_WEBHOOK_PAYLOAD",
          400,
        );
      }

      payload =
        parsed as RazorpayWebhookPayload;
    } catch {
      return errorResponse(
        "Invalid webhook JSON.",
        "INVALID_WEBHOOK_JSON",
        400,
      );
    }

    /* --------------------------------------------------------
       EVENT
       -------------------------------------------------------- */

    const event =
      normalizeEvent(
        payload.event,
      );

    if (!event) {
      return errorResponse(
        "Webhook event is missing.",
        "WEBHOOK_EVENT_MISSING",
        400,
      );
    }

    const eventId =
      cleanString(
        request.headers.get(
          WEBHOOK_EVENT_ID_HEADER,
        ),
      );

    console.info(
      "[RAZORPAY WEBHOOK] Event received.",
      {
        event,

        eventId:
          eventId || undefined,

        bodyBytes:
          rawBodyBytes,

        elapsedMs:
          Date.now() -
          startedAt,
      },
    );

    /* --------------------------------------------------------
       DATABASE
       -------------------------------------------------------- */

    await connectDB();

    /* --------------------------------------------------------
       SUCCESSFUL PAYMENT
       -------------------------------------------------------- */

    if (
      isSuccessfulPaymentEvent(
        event,
      )
    ) {
      return await handleSuccessfulPayment(
        payload,
        event,
      );
    }

    /* --------------------------------------------------------
       FAILED PAYMENT
       -------------------------------------------------------- */

    if (
      isFailedPaymentEvent(
        event,
      )
    ) {
      return await handleFailedPayment(
        payload,
      );
    }

    /* --------------------------------------------------------
       REFUND CREATED
       -------------------------------------------------------- */

    if (
      isRefundCreatedEvent(
        event,
      )
    ) {
      return await handleRefundCreated(
        payload,
      );
    }

    /* --------------------------------------------------------
       REFUND PROCESSED
       -------------------------------------------------------- */

    if (
      isRefundProcessedEvent(
        event,
      )
    ) {
      return await handleRefundProcessed(
        payload,
      );
    }

    /* --------------------------------------------------------
       REFUND FAILED
       -------------------------------------------------------- */

    if (
      isRefundFailedEvent(
        event,
      )
    ) {
      return await handleRefundFailed(
        payload,
      );
    }

    /* --------------------------------------------------------
       UNSUPPORTED EVENT
       --------------------------------------------------------

       Acknowledge intentionally unsupported events with 200.
       This prevents unnecessary Razorpay retries.
       -------------------------------------------------------- */

    console.info(
      "[RAZORPAY WEBHOOK] Unsupported event acknowledged.",
      {
        event,
        eventId:
          eventId || undefined,
      },
    );

    return successResponse(
      "Webhook event received and acknowledged.",
      {
        handled: false,
        event,
        eventId:
          eventId || undefined,
      },
    );
  } catch (error) {
    console.error(
      "[POST /api/payment/webhook] Unexpected error.",
      error,
    );

    /*
     * HTTP 500 intentionally tells Razorpay that processing
     * failed and allows webhook retry.
     */

    return errorResponse(
      "Unable to process Razorpay webhook.",
      "WEBHOOK_INTERNAL_ERROR",
      500,
    );
  }
}

/* ============================================================
   NON-POST METHODS
   ============================================================ */

export async function GET(): Promise<NextResponse> {
  return errorResponse(
    "GET is not supported for the Razorpay webhook endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function PUT(): Promise<NextResponse> {
  return errorResponse(
    "PUT is not supported for the Razorpay webhook endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function PATCH(): Promise<NextResponse> {
  return errorResponse(
    "PATCH is not supported for the Razorpay webhook endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function DELETE(): Promise<NextResponse> {
  return errorResponse(
    "DELETE is not supported for the Razorpay webhook endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function HEAD(): Promise<NextResponse> {
  return errorResponse(
    "HEAD is not supported for the Razorpay webhook endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(
    null,
    {
      status: 204,

      headers: {
        Allow:
          "POST, OPTIONS",

        "Cache-Control":
          "no-store",

        "Access-Control-Allow-Methods":
          "POST, OPTIONS",

        "Access-Control-Allow-Headers":
          "content-type, x-razorpay-signature, x-razorpay-event-id",
      },
    },
  );
}