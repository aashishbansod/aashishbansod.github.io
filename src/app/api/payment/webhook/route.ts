
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import connectDB from "@/lib/db";
import StudentModel from "@/models/Student";
import ApplicationModel from "@/models/Application";
import Payment from "@/models/Payment";
import { getStudentOperationsModel } from "@/models/StudentOperations";
import { recordVerifiedPayment } from "@/services/student.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 512 * 1024;
const INR = "INR";

const PAYMENT_PLANS = {
  ONE_MONTH: { amount: 499, paise: 49_900, durationDays: 30, duration: "1 Month" },
  THREE_MONTHS: { amount: 999, paise: 99_900, durationDays: 90, duration: "3 Months" },
  SIX_MONTHS: { amount: 1_699, paise: 169_900, durationDays: 180, duration: "6 Months" },
} as const;

type InternshipPlanCode = keyof typeof PAYMENT_PLANS;

type JsonObject = Record<string, unknown>;
type PaymentStatus = "success" | "pending" | "failed" | "refunded";

type RazorpayPayment = {
  id?: unknown;
  order_id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
  captured?: unknown;
  notes?: unknown;
};

type RazorpayOrder = {
  id?: unknown;
  amount?: unknown;
  currency?: unknown;
  notes?: unknown;
};

type RazorpayRefund = {
  id?: unknown;
  payment_id?: unknown;
  amount?: unknown;
  status?: unknown;
};

type RazorpayRefundList = {
  items?: RazorpayRefund[];
};

type WebhookPayload = {
  event?: unknown;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    order?: { entity?: RazorpayOrder };
    refund?: { entity?: RazorpayRefund };
  };
};

type StudentRecord = {
  _id?: unknown;
  studentId?: unknown;
  applicationId?: unknown;
  name?: unknown;
  fullName?: unknown;
  studentName?: unknown;
  email?: unknown;
  internship?: unknown;
  internshipName?: unknown;
  selectedInternship?: unknown;
  paymentAmount?: unknown;
  paymentCurrency?: unknown;
  paymentStatus?: unknown;
  razorpayOrderId?: unknown;
  razorpayPaymentId?: unknown;
  dashboardStatus?: unknown;
  dashboardLoginEnabled?: unknown;
  internshipTrack?: unknown;
  internshipPlan?: unknown;
  internshipDurationDays?: unknown;
  studentOpsApprovalStatus?: unknown;
  studentOpsStatus?: unknown;
  paymentAttemptGroupId?: unknown;
};

function clean(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function normalizePlanCode(value: unknown): InternshipPlanCode | null {
  const key = clean(value, 60).toUpperCase().replace(/[\\s-]+/g, "_");

  if (["ONE_MONTH", "1_MONTH", "1M"].includes(key)) return "ONE_MONTH";
  if (["THREE_MONTHS", "3_MONTHS", "3M"].includes(key)) return "THREE_MONTHS";
  if (["SIX_MONTHS", "6_MONTHS", "6M"].includes(key)) return "SIX_MONTHS";

  return null;
}

function resolveStudentPlan(student: StudentRecord): InternshipPlanCode | null {
  return normalizePlanCode(student.internshipPlan);
}

function asObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStudentRecord(student: unknown): StudentRecord {
  if (!asObject(student)) return {} as StudentRecord;

  const document = student as {
    toObject?: () => unknown;
  };

  const value =
    typeof document.toObject === "function"
      ? document.toObject()
      : student;

  return asObject(value) ? (value as StudentRecord) : ({} as StudentRecord);
}

function textValue(value: unknown, max = 200): string {
  if (typeof value === "string") return clean(value, max);
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).slice(0, max);
  }
  return "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const result = textValue(value);
    if (result) return result;
  }
  return "";
}

function response(body: JsonObject, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function verifySignature(
  rawBody: string,
  received: string,
  secret: string
): boolean {
  if (
    !rawBody ||
    !received ||
    !secret ||
    !/^[a-f0-9]{64}$/i.test(received)
  ) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();

  const supplied = Buffer.from(received, "hex");

  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(expected, supplied)
  );
}

async function readBoundedBody(
  request: NextRequest
): Promise<
  | { success: true; rawBody: string }
  | { success: false; tooLarge: boolean }
> {
  const reader = request.body?.getReader();

  if (!reader) {
    return { success: true, rawBody: "" };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();

      if (result.done) break;

      totalBytes += result.value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { success: false, tooLarge: true };
      }

      chunks.push(result.value);
    }

    return {
      success: true,
      rawBody: Buffer.concat(
        chunks.map((chunk) => Buffer.from(chunk))
      ).toString("utf8"),
    };
  } finally {
    reader.releaseLock();
  }
}

function paiseFromRupees(value: unknown): number {
  const amount = asNumber(value);

  return Number.isFinite(amount) && amount > 0
    ? Math.round(amount * 100)
    : 0;
}

function notesBelongToStudent(
  notes: unknown,
  student: StudentRecord
): boolean {
  if (!asObject(notes)) return true;

  const checks: Array<[string, unknown]> = [
    ["studentId", student.studentId],
    ["applicationId", student.applicationId],
    ["studentObjectId", student._id],
  ];

  for (const [key, studentValue] of checks) {
    const noteValue = clean(notes[key]);

    if (!noteValue) continue;

    const storedValue =
      key === "studentObjectId"
        ? String(studentValue ?? "")
        : textValue(studentValue);

    if (!storedValue || noteValue !== storedValue) {
      return false;
    }
  }

  return true;
}

function getPaymentStudentDetails(student: StudentRecord) {
  return {
    studentName: firstText(
      student.fullName,
      student.name,
      student.studentName
    ),
    studentId: textValue(student.studentId),
    email: clean(student.email, 254).toLowerCase(),
    internship: firstText(
      student.selectedInternship,
      student.internshipName,
      student.internship
    ),
  };
}

async function syncApplicationPayment(
  applicationId: string,
  paymentStatus: "paid" | "failed" | "refunded",
  paymentId?: string
): Promise<void> {
  if (!applicationId) return;

  await ApplicationModel.updateOne(
    { applicationId },
    {
      $set: {
        paymentStatus,
        ...(paymentId ? { paymentId } : {}),
      },
    }
  ).exec();
}

async function syncPaymentLedger(
  student: StudentRecord,
  orderId: string,
  paymentId: string,
  status: PaymentStatus,
  notes: string
): Promise<void> {
  const amount = asNumber(student.paymentAmount);
  const planCode = resolveStudentPlan(student);
  const plan = planCode ? PAYMENT_PLANS[planCode] : null;

  if (!orderId || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment ledger data is invalid.");
  }

  const details = getPaymentStudentDetails(student);

  const existingPayment = await Payment.findOne({
    paymentId,
    orderId: { $ne: orderId },
  })
    .select("_id")
    .lean()
    .exec();

  if (existingPayment) {
    throw new Error("Payment ID is already linked to another order.");
  }

  const ledgerFilter: JsonObject = {
    orderId,
    ...(status === "failed"
      ? {
          status: { $nin: ["success", "refunded"] },
          $or: [
            { paymentId: "" },
            { paymentId },
            { paymentId: { $exists: false } },
            { paymentId: null },
          ],
        }
      : {
          status: { $ne: "refunded" },
          $or: [
            { paymentId: "" },
            { paymentId },
            { paymentId: { $exists: false } },
            { paymentId: null },
          ],
        }),
  };

  try {
    const ledger = await Payment.findOneAndUpdate(
      ledgerFilter,
      {
        $set: {
          ...details,
          amount,
          currency: INR,
          status,
          method: "Razorpay",
          paymentId,
          orderId,
          notes,
          ...(planCode ? {
            planCode,
            planName: plan?.duration,
            planDurationDays: plan?.durationDays,
          } : {}),
          attemptGroupId: textValue(student.paymentAttemptGroupId, 120),
          checkoutExpiresAt: null,
          expiredAt: null,
          verifiedAt: status === "success" ? new Date() : null,
          verificationSource: status === "success" ? "razorpay_webhook" : undefined,
          archivedAt: null,
          archivedBy: "",
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).select("_id paymentId status").lean().exec();

    if (
      !ledger ||
      clean(ledger.paymentId) !== paymentId ||
      clean(ledger.status).toLowerCase() !== status
    ) {
      throw new Error("Payment ledger state could not be safely reconciled.");
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? Number((error as { code?: unknown }).code)
        : 0;

    if (code === 11000) {
      const existing = await Payment.findOne({ orderId })
        .select("_id paymentId status")
        .lean()
        .exec();

      if (
        existing &&
        clean(existing.paymentId) === paymentId &&
        (
          clean(existing.status).toLowerCase() === status ||
          (status === "failed" && ["success", "refunded"].includes(clean(existing.status).toLowerCase()))
        )
      ) {
        return;
      }
    }

    throw error;
  }
}


async function syncStudentOperationsRefund(student: StudentRecord): Promise<void> {
  const mainStudentId = textValue(student._id, 100);
  const fullName = firstText(student.fullName, student.name, student.studentName);
  const email = clean(student.email, 254).toLowerCase();

  if (!mainStudentId || fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Student Operations refund sync data is incomplete.");
  }

  const OperationsModel = await getStudentOperationsModel();

  await OperationsModel.updateOne(
    { mainStudentId },
    {
      $set: {
        mainStudentId,
        applicationId: textValue(student.applicationId, 50),
        studentId: textValue(student.studentId, 50),
        fullName,
        email,
        internshipTrack: textValue(student.internshipTrack, 150),
        internshipPlan: textValue(student.internshipPlan, 30),
        internshipDurationDays: Math.max(0, asNumber(student.internshipDurationDays)),
        operationsApprovalStatus: "rejected",
        operationsReviewedAt: new Date(),
        operationsRejectionReason: "Payment fully refunded.",
        operationsStatus: "suspended",
        dashboardStatus: "locked",
        dashboardLoginEnabled: false,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    {
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).exec();
}

async function fetchProcessedRefundTotal(paymentId: string): Promise<number> {
  const keyId = clean(process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY, 200);
  const keySecret = clean(process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET, 500);

  if (!keyId || !keySecret) {
    throw new Error("Razorpay API credentials are not configured for refund reconciliation.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refunds?count=100`,
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64")}`,
        },
      }
    );

    const result: unknown = await response.json().catch(() => null);

    if (!response.ok || !asObject(result)) {
      throw new Error(`Razorpay refund lookup failed with status ${response.status}.`);
    }

    const items = Array.isArray(result.items) ? result.items as RazorpayRefund[] : [];
    return items.reduce((total, item) => {
      const status = clean(item.status).toLowerCase();
      return status === "processed" ? total + Math.max(0, Math.round(asNumber(item.amount))) : total;
    }, 0);
  } finally {
    clearTimeout(timeout);
  }
}

async function handleCapturedPayment(
  payload: WebhookPayload,
  event: string
): Promise<NextResponse> {
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;

  const paymentOrderId = clean(payment?.order_id);
  const eventOrderId = clean(order?.id);
  const orderId = paymentOrderId || eventOrderId;
  const paymentId = clean(payment?.id);

  if (paymentOrderId && eventOrderId && paymentOrderId !== eventOrderId) {
    return response(
      {
        success: false,
        code: "EVENT_ORDER_ID_MISMATCH",
        message: "Payment and order entities refer to different orders.",
      },
      409
    );
  }

  if (!orderId || !paymentId) {
    return response(
      {
        success: false,
        code: "PAYMENT_IDENTIFIERS_MISSING",
        message: "Payment/order identifiers are missing.",
      },
      400
    );
  }

  const studentDocument = await StudentModel.findOne({
    razorpayOrderId: orderId,
  }).exec();

  if (!studentDocument) {
    console.warn("[RAZORPAY WEBHOOK] Unknown order; retry required", { event, orderId });

    return response(
      {
        success: false,
        handled: false,
        code: "STUDENT_ORDER_NOT_FOUND",
        message: "The student order is not available yet. Razorpay should retry this webhook.",
      },
      500
    );
  }

  const student = getStudentRecord(studentDocument);

  if (textValue(student.razorpayOrderId) !== orderId) {
    return response(
      {
        success: false,
        code: "ORDER_OWNERSHIP_MISMATCH",
        message: "Order does not match the student record.",
      },
      409
    );
  }

  const currentStatus = clean(student.paymentStatus).toLowerCase();
  const currentPaymentId = textValue(student.razorpayPaymentId);

  if (
    currentStatus === "paid" &&
    currentPaymentId &&
    currentPaymentId !== paymentId
  ) {
    console.error(
      "[RAZORPAY WEBHOOK] Different payment for an already-paid order",
      {
        studentId: textValue(student.studentId),
        orderId,
        currentPaymentId,
        paymentId,
      }
    );

    return response(
      {
        success: false,
        code: "PAYMENT_ALREADY_COMPLETED",
        message: "A different payment is already recorded for this order.",
      },
      409
    );
  }

  const storedCurrency = clean(student.paymentCurrency).toUpperCase();
  if (storedCurrency && storedCurrency !== INR) {
    return response(
      {
        success: false,
        code: "STUDENT_PAYMENT_CURRENCY_MISMATCH",
        message: "Stored student payment currency is not INR.",
      },
      409
    );
  }

  const planCode = resolveStudentPlan(student);
  if (!planCode) {
    return response(
      {
        success: false,
        code: "STUDENT_PLAN_CODE_INVALID",
        message: "The student's selected internship plan is missing or invalid. Payment requires reconciliation.",
      },
      409
    );
  }

  const selectedPlan = PAYMENT_PLANS[planCode];
  const expectedAmountPaise = paiseFromRupees(student.paymentAmount);
  if (
    expectedAmountPaise !== selectedPlan.paise ||
    Math.round(asNumber(student.internshipDurationDays)) !== selectedPlan.durationDays
  ) {
    return response(
      {
        success: false,
        code: "STUDENT_PLAN_CONFIGURATION_MISMATCH",
        message: "Stored internship plan amount or duration does not match the approved plan configuration.",
      },
      409
    );
  }

  const paymentNotes = asObject(payment?.notes) ? payment?.notes : null;
  const orderNotes = asObject(order?.notes) ? order?.notes : null;
  const notesPlanCode = normalizePlanCode(
    paymentNotes?.planCode ?? orderNotes?.planCode
  );
  if (notesPlanCode && notesPlanCode !== planCode) {
    return response(
      {
        success: false,
        code: "RAZORPAY_PLAN_MISMATCH",
        message: "Razorpay payment metadata does not match the student's selected plan.",
      },
      409
    );
  }

  const expectedAmountPaiseFromPlan = selectedPlan.paise;
  const receivedAmountPaise = Math.round(asNumber(payment?.amount));
  const paymentCurrency = clean(
    payment?.currency || order?.currency
  ).toUpperCase();
  const orderAmountPaise = Math.round(asNumber(order?.amount));
  const orderCurrency = clean(order?.currency).toUpperCase();

  if (
    expectedAmountPaiseFromPlan < 100 ||
    receivedAmountPaise <= 0 ||
    receivedAmountPaise !== expectedAmountPaiseFromPlan
  ) {
    console.error("[RAZORPAY WEBHOOK] Amount mismatch", {
      orderId,
      paymentId,
      expectedAmountPaise,
      receivedAmountPaise,
    });

    return response(
      {
        success: false,
        code: "PAYMENT_AMOUNT_MISMATCH",
        message: "Payment amount does not match the selected plan.",
      },
      409
    );
  }

  if (
    paymentCurrency !== INR ||
    (orderCurrency && orderCurrency !== INR)
  ) {
    return response(
      {
        success: false,
        code: "PAYMENT_CURRENCY_MISMATCH",
        message: "Payment currency does not match the expected currency.",
      },
      409
    );
  }

  if (
    order &&
    (!orderAmountPaise || orderAmountPaise !== expectedAmountPaiseFromPlan)
  ) {
    return response(
      {
        success: false,
        code: "ORDER_AMOUNT_MISMATCH",
        message: "Razorpay order amount does not match the stored amount.",
      },
      409
    );
  }

  const paymentStatus = clean(payment?.status).toLowerCase();
  const captured =
    payment?.captured === true || paymentStatus === "captured";

  if (!captured) {
    return response(
      {
        success: false,
        code: "PAYMENT_NOT_CAPTURED",
        message: "Payment has not been confirmed as captured.",
      },
      409
    );
  }

  if (
    !notesBelongToStudent(payment?.notes || order?.notes, student)
  ) {
    return response(
      {
        success: false,
        code: "PAYMENT_OWNERSHIP_MISMATCH",
        message: "Payment ownership validation failed.",
      },
      409
    );
  }

  const paymentIdConflict = await Payment.findOne({
    paymentId,
    orderId: { $ne: orderId },
  }).select("_id").lean().exec();

  if (paymentIdConflict) {
    return response(
      {
        success: false,
        code: "PAYMENT_ID_ALREADY_LINKED",
        message: "This Razorpay payment is already linked to another order.",
      },
      409
    );
  }

  let duplicate = false;

  if (currentStatus === "paid" && currentPaymentId === paymentId) {
    duplicate = true;
  } else {
    const result = await recordVerifiedPayment({
      studentId: String(student._id ?? ""),
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      amount: asNumber(student.paymentAmount),
      currency: INR,
    });

    if (!result.success) {
      if (result.code === "PAYMENT_ALREADY_VERIFIED") {
        duplicate = true;
      } else if (result.code === "INTERNSHIP_SELECTION_WINDOW_EXPIRED") {
        const reconciliationAt = new Date();
        const reconciliation = await StudentModel.updateOne(
          {
            _id: student._id,
            razorpayOrderId: orderId,
            paymentStatus: { $in: ["pending", "paid"] },
            $or: [
              { razorpayPaymentId: "" },
              { razorpayPaymentId: paymentId },
              { razorpayPaymentId: { $exists: false } },
              { razorpayPaymentId: null },
            ],
          },
          {
            $set: {
              paymentStatus: "paid",
              razorpayPaymentId: paymentId,
              paymentCompletedAt: reconciliationAt,
              internshipStatus: "pending-review",
              studentOpsApprovalStatus: "pending",
              studentOpsStatus: "pending-review",
              dashboardStatus: "locked",
              dashboardLoginEnabled: false,
              dashboardCredentialsGenerated: false,
              operationsSyncStatus: "pending",
              operationsSyncError:
                "Captured payment requires manual reconciliation because the internship selection window expired.",
            },
          },
        ).exec();

        if (reconciliation.matchedCount === 0) {
          const latest = await StudentModel.findById(student._id)
            .select("paymentStatus razorpayOrderId razorpayPaymentId")
            .lean()
            .exec();

          const alreadyReconciled =
            clean(latest?.paymentStatus).toLowerCase() === "paid" &&
            clean(latest?.razorpayOrderId) === orderId &&
            clean(latest?.razorpayPaymentId) === paymentId;

          if (!alreadyReconciled) {
            console.error("[RAZORPAY WEBHOOK] Captured payment reconciliation failed", {
              studentId: textValue(student.studentId),
              orderId,
              paymentId,
            });

            return response(
              {
                success: false,
                code: "CAPTURED_PAYMENT_RECONCILIATION_REQUIRED",
                message:
                  "Razorpay captured the payment, but the student payment record requires manual reconciliation.",
              },
              500,
            );
          }
        }

        duplicate = false;
      } else {
        console.error("[RAZORPAY WEBHOOK] Payment commit failed", {
          studentId: textValue(student.studentId),
          orderId,
          paymentId,
          code: result.code,
          message: result.message,
        });

        return response(
          {
            success: false,
            code: "PAYMENT_COMMIT_FAILED",
            message:
              "Payment could not be reconciled. Razorpay may retry this webhook.",
          },
          500
        );
      }
    }
  }

  await syncApplicationPayment(
    textValue(student.applicationId),
    "paid",
    paymentId
  );

  await syncPaymentLedger(
    student,
    orderId,
    paymentId,
    "success",
    "Verified through Razorpay webhook."
  );

  return response({
    success: true,
    handled: true,
    duplicate,
    event,
    studentId: textValue(student.studentId),
    orderId,
    paymentId,
    paymentStatus: "paid",
    planCode,
    planName: selectedPlan.duration,
    durationDays: selectedPlan.durationDays,
    amount: selectedPlan.amount,
    currency: INR,
    studentOperationsStatus: "pending-review",
    dashboardStatus: "locked",
  });
}

async function handleFailedPayment(
  payload: WebhookPayload
): Promise<NextResponse> {
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;

  const orderId =
    clean(payment?.order_id) || clean(order?.id);

  const paymentId = clean(payment?.id);

  if (!orderId) {
    return response(
      {
        success: false,
        code: "ORDER_ID_MISSING",
        message: "Failed payment order ID is missing.",
      },
      400
    );
  }

  const studentDocument = await StudentModel.findOne({
    razorpayOrderId: orderId,
  }).exec();

  if (!studentDocument) {
    return response(
      {
        success: false,
        handled: false,
        code: "STUDENT_ORDER_NOT_FOUND",
        message: "The student order is not available yet. Razorpay should retry this webhook.",
      },
      500
    );
  }

  const student = getStudentRecord(studentDocument);

  if (clean(student.paymentStatus).toLowerCase() === "paid") {
    return response({
      success: true,
      handled: true,
      ignored: true,
      paymentStatus: "paid",
    });
  }

  const failedStatus = clean(payment?.status).toLowerCase();
  if (payment && failedStatus && failedStatus !== "failed") {
    return response(
      {
        success: false,
        code: "INVALID_FAILED_PAYMENT_STATUS",
        message: "Razorpay payment entity is not marked as failed.",
      },
      409
    );
  }

  const paymentOrderId = clean(payment?.order_id);
  const eventOrderId = clean(order?.id);

  if (
    (paymentOrderId && paymentOrderId !== orderId) ||
    (eventOrderId && eventOrderId !== orderId) ||
    (paymentOrderId && eventOrderId && paymentOrderId !== eventOrderId)
  ) {
    return response(
      {
        success: false,
        code: "PAYMENT_ORDER_MISMATCH",
        message: "Failed payment does not belong to the stored order.",
      },
      409
    );
  }

  const currency = clean(
    payment?.currency || order?.currency
  ).toUpperCase();

  const storedCurrency =
    clean(student.paymentCurrency).toUpperCase() || INR;

  if (currency && currency !== storedCurrency) {
    return response(
      {
        success: false,
        code: "PAYMENT_CURRENCY_MISMATCH",
        message: "Failed payment currency mismatch.",
      },
      409
    );
  }

  const expectedAmountPaise = paiseFromRupees(student.paymentAmount);
  const failedAmountPaise = Math.round(asNumber(payment?.amount));

  if (
    failedAmountPaise > 0 &&
    expectedAmountPaise > 0 &&
    failedAmountPaise !== expectedAmountPaise
  ) {
    return response(
      {
        success: false,
        code: "PAYMENT_AMOUNT_MISMATCH",
        message: "Failed payment amount does not match the stored order.",
      },
      409
    );
  }

  const updated = await StudentModel.updateOne(
    {
      _id: student._id,
      razorpayOrderId: orderId,
      paymentStatus: { $nin: ["paid", "refunded"] },
    },
    {
      $set: {
        paymentStatus: "failed",
        internshipStatus: "payment-pending",
      },
    }
  ).exec();

  if (updated.matchedCount === 0) {
    const latest = await StudentModel.findById(student._id)
      .select("paymentStatus")
      .lean()
      .exec();

    if (["paid", "refunded"].includes(clean(latest?.paymentStatus).toLowerCase())) {
      return response({
        success: true,
        handled: true,
        ignored: true,
        paymentStatus: clean(latest?.paymentStatus).toLowerCase(),
      });
    }

    return response(
      {
        success: false,
        code: "FAILED_PAYMENT_UPDATE_FAILED",
        message: "Unable to update failed payment status.",
      },
      500
    );
  }

  const latestAfterFailure = await StudentModel.findById(student._id)
    .select("paymentStatus")
    .lean()
    .exec();

  if (clean(latestAfterFailure?.paymentStatus).toLowerCase() !== "failed") {
    return response({
      success: true,
      handled: true,
      ignored: true,
      paymentStatus: clean(latestAfterFailure?.paymentStatus).toLowerCase() || "pending",
    });
  }

  await syncApplicationPayment(
    textValue(student.applicationId),
    "failed",
    paymentId || undefined
  );

  if (paymentId) {
    await syncPaymentLedger(
      student,
      orderId,
      paymentId,
      "failed",
      "Razorpay payment failed."
    );
  }

  return response({
    success: true,
    handled: true,
    event: "payment.failed",
    orderId,
    paymentId,
    paymentStatus: "failed",
  });
}

async function handleRefund(
  payload: WebhookPayload,
  event: string
): Promise<NextResponse> {
  const refund = payload.payload?.refund?.entity;
  const paymentId = clean(refund?.payment_id);
  const refundId = clean(refund?.id);
  const refundStatus = clean(refund?.status).toLowerCase();

  if (!paymentId) {
    return response(
      {
        success: false,
        code: "REFUND_PAYMENT_ID_MISSING",
        message: "Refund payment ID is missing.",
      },
      400
    );
  }

  const studentDocument = await StudentModel.findOne({
    razorpayPaymentId: paymentId,
  }).exec();

  if (!studentDocument) {
    return response({
      success: true,
      handled: false,
      event,
      paymentId,
      refundId,
    });
  }

  const student = getStudentRecord(studentDocument);
  const currentPaymentStatus = clean(student.paymentStatus).toLowerCase();

  if (event === "refund.created" || event === "refund.failed" || refundStatus !== "processed") {
    return response({
      success: true,
      handled: true,
      event,
      paymentId,
      refundId,
      refundStatus,
      paymentStatus: currentPaymentStatus,
    });
  }

  const originalAmountPaise = paiseFromRupees(student.paymentAmount);

  if (originalAmountPaise < 100) {
    return response(
      {
        success: false,
        code: "INVALID_ORIGINAL_PAYMENT_AMOUNT",
        message: "Original payment amount could not be validated.",
      },
      409
    );
  }

  let totalProcessedRefundPaise: number;

  try {
    totalProcessedRefundPaise = await fetchProcessedRefundTotal(paymentId);
  } catch (error) {
    console.error("[RAZORPAY WEBHOOK] Refund reconciliation lookup failed", {
      paymentId,
      refundId,
      error: error instanceof Error ? error.message : "unknown",
    });

    return response(
      {
        success: false,
        code: "REFUND_RECONCILIATION_UNAVAILABLE",
        message: "Refund status could not be reconciled. Razorpay should retry this webhook.",
      },
      500
    );
  }

  if (
    totalProcessedRefundPaise <= 0 ||
    totalProcessedRefundPaise > originalAmountPaise
  ) {
    return response(
      {
        success: false,
        code: "INVALID_REFUND_TOTAL",
        message: "Processed refund total does not match the original payment.",
      },
      409
    );
  }

  const isFullyRefunded = totalProcessedRefundPaise >= originalAmountPaise;
  const orderId = textValue(student.razorpayOrderId);
  const refundNote = isFullyRefunded
    ? `Full refund processed${refundId ? ` (${refundId})` : ""}.`
    : `Partial refund processed; total refunded INR ${(totalProcessedRefundPaise / 100).toFixed(2)}${refundId ? ` (${refundId})` : ""}.`;

  if (!isFullyRefunded) {
    await Payment.updateOne(
      { orderId, paymentId },
      { $set: { notes: refundNote } }
    ).exec();

    return response({
      success: true,
      handled: true,
      partialRefund: true,
      event,
      paymentId,
      refundId,
      refundedAmount: totalProcessedRefundPaise / 100,
      paymentStatus: currentPaymentStatus || "paid",
    });
  }

  if (currentPaymentStatus !== "refunded") {
    const updated = await StudentModel.updateOne(
      {
        _id: student._id,
        razorpayPaymentId: paymentId,
        paymentStatus: { $in: ["paid", "refunded"] },
      },
      {
        $set: {
          paymentStatus: "refunded",
          internshipStatus: "rejected",
          studentOpsApprovalStatus: "rejected",
          studentOpsStatus: "suspended",
          dashboardStatus: "locked",
          dashboardLoginEnabled: false,
          dashboardActivatedAt: null,
          studentOpsRejectionReason: "Payment fully refunded.",
        },
      }
    ).exec();

    if (updated.matchedCount === 0) {
      const latest = await StudentModel.findById(student._id)
        .select("paymentStatus")
        .lean()
        .exec();

      if (clean(latest?.paymentStatus).toLowerCase() !== "refunded") {
        return response(
          {
            success: false,
            code: "FULL_REFUND_STUDENT_UPDATE_FAILED",
            message: "Unable to update the student after full refund.",
          },
          500
        );
      }
    }
  }

  await syncApplicationPayment(
    textValue(student.applicationId),
    "refunded",
    paymentId
  );

  await Payment.updateOne(
    { orderId, paymentId },
    {
      $set: {
        status: "refunded",
        notes: refundNote,
      },
    }
  ).exec();

  try {
    await syncStudentOperationsRefund({
      ...student,
      paymentStatus: "refunded",
      studentOpsApprovalStatus: "rejected",
      studentOpsStatus: "suspended",
      dashboardStatus: "locked",
      dashboardLoginEnabled: false,
    });
  } catch (error) {
    console.error("[RAZORPAY WEBHOOK] Student Operations refund sync failed", {
      studentId: textValue(student.studentId),
      paymentId,
      error: error instanceof Error ? error.message : "unknown",
    });

    return response(
      {
        success: false,
        code: "STUDENT_OPERATIONS_REFUND_SYNC_FAILED",
        message: "Refund was recorded, but Student Operations sync is pending. Webhook retry is required.",
      },
      500
    );
  }

  return response({
    success: true,
    handled: true,
    event,
    paymentId,
    refundId,
    paymentStatus: "refunded",
    refundedAmount: totalProcessedRefundPaise / 100,
    studentOperationsStatus: "suspended",
    dashboardStatus: "locked",
  });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const contentType = clean(request.headers.get("content-type"), 100).toLowerCase();

    if (contentType && !contentType.includes("application/json")) {
      return response(
        {
          success: false,
          code: "INVALID_WEBHOOK_CONTENT_TYPE",
          message: "Webhook content type must be application/json.",
        },
        415
      );
    }

    const contentLengthHeader = request.headers.get("content-length");

    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);

      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_BODY_BYTES
      ) {
        return response(
          {
            success: false,
            code: "WEBHOOK_PAYLOAD_TOO_LARGE",
            message: "Webhook payload is too large.",
          },
          413
        );
      }
    }

    const receivedSignature = clean(
      request.headers.get("x-razorpay-signature"),
      256
    );

    if (!receivedSignature) {
      return response(
        {
          success: false,
          code: "WEBHOOK_SIGNATURE_MISSING",
          message: "Razorpay webhook signature is required.",
        },
        401
      );
    }

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

    if (!webhookSecret) {
      console.error(
        "[RAZORPAY WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not configured."
      );

      return response(
        {
          success: false,
          code: "WEBHOOK_NOT_CONFIGURED",
          message: "Payment webhook is not configured.",
        },
        503
      );
    }

    const bodyResult = await readBoundedBody(request);

    if (!bodyResult.success) {
      return response(
        {
          success: false,
          code: "WEBHOOK_PAYLOAD_TOO_LARGE",
          message: "Webhook payload is too large.",
        },
        413
      );
    }

    const rawBody = bodyResult.rawBody;

    if (!rawBody) {
      return response(
        {
          success: false,
          code: "WEBHOOK_BODY_EMPTY",
          message: "Webhook body is empty.",
        },
        400
      );
    }

    if (
      !verifySignature(
        rawBody,
        receivedSignature,
        webhookSecret
      )
    ) {
      console.warn("[RAZORPAY WEBHOOK] Invalid signature rejected.");

      return response(
        {
          success: false,
          code: "INVALID_WEBHOOK_SIGNATURE",
          message: "Invalid Razorpay webhook signature.",
        },
        401
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return response(
        {
          success: false,
          code: "INVALID_WEBHOOK_JSON",
          message: "Invalid webhook JSON.",
        },
        400
      );
    }

    if (!asObject(parsed)) {
      return response(
        {
          success: false,
          code: "INVALID_WEBHOOK_PAYLOAD",
          message: "Invalid webhook payload.",
        },
        400
      );
    }

    const payload = parsed as WebhookPayload;
    const event = clean(payload.event, 100).toLowerCase();

    if (!event) {
      return response(
        {
          success: false,
          code: "WEBHOOK_EVENT_MISSING",
          message: "Webhook event is missing.",
        },
        400
      );
    }

    await connectDB();

    if (event === "payment.captured" || event === "order.paid") {
      return await handleCapturedPayment(payload, event);
    }

    if (event === "payment.failed") {
      return await handleFailedPayment(payload);
    }

    if (
      event === "refund.created" ||
      event === "refund.processed" ||
      event === "refund.failed"
    ) {
      return await handleRefund(payload, event);
    }

    return response({
      success: true,
      handled: false,
      event,
    });
  } catch (error) {
    console.error("[RAZORPAY WEBHOOK] Processing failed", {
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });

    return response(
      {
        success: false,
        code: "WEBHOOK_INTERNAL_ERROR",
        message: "Unable to process Razorpay webhook. Retry later.",
      },
      500
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return response(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "GET is not supported.",
    },
    405
  );
}

export async function PUT(): Promise<NextResponse> {
  return response(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "PUT is not supported.",
    },
    405
  );
}

export async function PATCH(): Promise<NextResponse> {
  return response(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "PATCH is not supported.",
    },
    405
  );
}

export async function DELETE(): Promise<NextResponse> {
  return response(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "DELETE is not supported.",
    },
    405
  );
}

export async function HEAD(): Promise<NextResponse> {
  return response(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "HEAD is not supported.",
    },
    405
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
