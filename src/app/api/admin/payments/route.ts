import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import {
  ADMIN_AUTH_COOKIE_NAME,
  verifyAuthToken,
  isAdminSession,
  hasAdminRole,
  type AuthUser,
} from "@/lib/auth";
import Payment, { type IPayment, type PaymentStatus } from "@/models/Payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_LIMIT = 500;
const MAX_OFFSET = 100000;
const MAX_SEARCH_LENGTH = 120;
const MAX_TEXT_LENGTH = 200;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_NOTES_LENGTH = 2000;

const PAYMENT_ADMIN_ROLES = ["Super Admin", "Admin", "HR"] as const;

type PaymentFilter = Record<string, unknown>;
type AdminUser = AuthUser;

type PlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";

type PlanInfo = {
  code: PlanCode | null;
  name: string;
  durationDays: number | null;
  expectedAmount: number | null;
};

type JsonBodyResult =
  | { success: true; body: Record<string, unknown> }
  | { success: false; response: NextResponse };

function apiResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function cleanString(value: unknown, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStatus(value: unknown): PaymentStatus | null {
  const status = cleanString(value, 30).toLowerCase();
  if (
    status === "success" ||
    status === "pending" ||
    status === "failed" ||
    status === "refunded" ||
    status === "expired"
  ) {
    return status;
  }
  return null;
}

function normalizePlan(value: unknown): PlanInfo {
  const normalized = cleanString(value, 80)
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "ONE_MONTH" || normalized === "1_MONTH") {
    return {
      code: "ONE_MONTH",
      name: "1 Month",
      durationDays: 30,
      expectedAmount: 499,
    };
  }

  if (normalized === "THREE_MONTHS" || normalized === "3_MONTHS") {
    return {
      code: "THREE_MONTHS",
      name: "3 Months",
      durationDays: 90,
      expectedAmount: 999,
    };
  }

  if (normalized === "SIX_MONTHS" || normalized === "6_MONTHS") {
    return {
      code: "SIX_MONTHS",
      name: "6 Months",
      durationDays: 180,
      expectedAmount: 1699,
    };
  }

  return {
    code: null,
    name: cleanString(value) || "Unspecified",
    durationDays: null,
    expectedAmount: null,
  };
}

function isValidObjectId(value: string): boolean {
  return mongoose.isValidObjectId(value);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(error: unknown): boolean {
  return isPlainObject(error) && error.code === 11000;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function getIdFromBody(body: Record<string, unknown>): string {
  return cleanString(body.id || body._id || "", 100);
}

function isSafeMutationOrigin(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

async function requireAdmin(request: NextRequest): Promise<AdminUser | null> {
  const token = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const user = await verifyAuthToken(token);
    if (!user || !isAdminSession(user)) return null;
    if (!hasAdminRole(user, [...PAYMENT_ADMIN_ROLES])) return null;
    return user;
  } catch {
    return null;
  }
}

async function readJsonBody(request: NextRequest): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      success: false,
      response: apiResponse(
        {
          success: false,
          message: "Content-Type must be application/json.",
          code: "INVALID_CONTENT_TYPE",
        },
        415,
      ),
    };
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return {
      success: false,
      response: apiResponse(
        {
          success: false,
          message: "Request body is too large.",
          code: "PAYLOAD_TOO_LARGE",
        },
        413,
      ),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: apiResponse(
        {
          success: false,
          message: "Request body must contain valid JSON.",
          code: "INVALID_JSON",
        },
        400,
      ),
    };
  }

  if (!isPlainObject(body)) {
    return {
      success: false,
      response: apiResponse(
        {
          success: false,
          message: "A valid JSON object is required.",
          code: "INVALID_BODY",
        },
        400,
      ),
    };
  }

  return { success: true, body };
}

function serializePayment(payment: Record<string, unknown>) {
  const id = String(payment._id ?? payment.id ?? "");
  const amount = Number(payment.amount);
  const plan = normalizePlan(payment.planCode || payment.internship);

  return {
    id,
    _id: id,
    paymentId: cleanString(payment.paymentId),
    orderId: cleanString(payment.orderId),
    attemptGroupId: cleanString(payment.attemptGroupId, 120),
    checkoutExpiresAt: payment.checkoutExpiresAt ?? null,
    expiredAt: payment.expiredAt ?? null,
    verifiedAt: payment.verifiedAt ?? null,
    verificationSource: cleanString(payment.verificationSource, 40),
    studentName: cleanString(payment.studentName),
    studentId: cleanString(payment.studentId),
    email: cleanString(payment.email, 254),
    internship: cleanString(payment.internship),
    planCode: plan.code,
    planName: cleanString(payment.planName) || plan.name,
    planDurationDays:
      Number.isFinite(Number(payment.planDurationDays)) && Number(payment.planDurationDays) > 0
        ? Number(payment.planDurationDays)
        : plan.durationDays,
    expectedPlanAmount: plan.expectedAmount,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: cleanString(payment.currency, 3).toUpperCase() || "INR",
    status: normalizeStatus(payment.status) ?? "pending",
    method: cleanString(payment.method, 80) || "Razorpay",
    notes: cleanString(payment.notes, MAX_NOTES_LENGTH),
    receiptEmailStatus: cleanString(payment.receiptEmailStatus, 30) || "not_required",
    receiptEmailSentAt: payment.receiptEmailSentAt ?? null,
    receiptEmailAttempts: Number(payment.receiptEmailAttempts) || 0,
    isManuallyEdited: payment.isManuallyEdited === true,
    lastEditedAt: payment.lastEditedAt ?? null,
    lastEditedBy: cleanString(payment.lastEditedBy, 120),
    archivedAt: payment.archivedAt ?? null,
    archivedBy: cleanString(payment.archivedBy, 120),
    createdAt: payment.createdAt ?? null,
    updatedAt: payment.updatedAt ?? null,
  };
}

function parseLimit(value: string | null): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 100;
  return Math.min(parsed, MAX_LIMIT);
}

function parseOffset(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_OFFSET
  ) {
    return 0;
  }
  return parsed;
}

function getAdminActor(admin: AdminUser): string {
  return cleanString(admin.id, 128) || "admin";
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return apiResponse(
      {
        success: false,
        message: "Main Admin authentication required.",
        code: "UNAUTHORIZED",
      },
      401,
    );
  }

  try {
    await connectDB();

    const params = request.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const offset = parseOffset(params.get("offset"));
    const statusParam = cleanString(params.get("status"), 30).toLowerCase();
    const search = cleanString(params.get("search"), MAX_SEARCH_LENGTH);
    const includeArchived = params.get("includeArchived") === "true";

    const status =
      statusParam && statusParam !== "all"
        ? normalizeStatus(statusParam)
        : null;

    if (statusParam && statusParam !== "all" && !status) {
      return apiResponse(
        {
          success: false,
          message: "Invalid payment status filter.",
          code: "INVALID_STATUS",
        },
        400,
      );
    }

    const filter: PaymentFilter = {};
    if (!includeArchived) filter.archivedAt = null;
    if (status) filter.status = status;

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { studentName: regex },
        { studentId: regex },
        { email: regex },
        { paymentId: regex },
        { orderId: regex },
        { internship: regex },
        { method: regex },
      ];
    }

    const [
      records,
      total,
      successful,
      pending,
      failed,
      refunded,
      expired,
      revenueAggregate,
    ] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      Payment.countDocuments(filter).exec(),
      Payment.countDocuments({ ...filter, status: "success" }).exec(),
      Payment.countDocuments({ ...filter, status: "pending" }).exec(),
      Payment.countDocuments({ ...filter, status: "failed" }).exec(),
      Payment.countDocuments({ ...filter, status: "refunded" }).exec(),
      Payment.countDocuments({ ...filter, status: "expired" }).exec(),
      Payment.aggregate([
        { $match: { ...filter, status: "success" } },
        { $group: { _id: null, revenue: { $sum: "$amount" } } },
      ]).exec(),
    ]);

    return apiResponse({
      success: true,
      message: "Payment records loaded successfully.",
      data: records.map((payment) =>
        serializePayment(payment as unknown as Record<string, unknown>),
      ),
      total,
      limit,
      offset,
      hasMore: offset + records.length < total,
      stats: {
        total,
        successful,
        pending,
        failed,
        refunded,
        expired,
        revenue: Number(revenueAggregate[0]?.revenue ?? 0),
      },
      planCatalog: [
        { code: "ONE_MONTH", name: "1 Month", durationDays: 30, amount: 499, currency: "INR" },
        { code: "THREE_MONTHS", name: "3 Months", durationDays: 90, amount: 999, currency: "INR" },
        { code: "SIX_MONTHS", name: "6 Months", durationDays: 180, amount: 1699, currency: "INR" },
      ],
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS GET]", getErrorMessage(error));
    return apiResponse(
      {
        success: false,
        message: "Unable to load payment records.",
        code: "PAYMENTS_FETCH_FAILED",
      },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return apiResponse(
      {
        success: false,
        message: "Main Admin authentication required.",
        code: "UNAUTHORIZED",
      },
      401,
    );
  }

  if (!isSafeMutationOrigin(request)) {
    return apiResponse(
      {
        success: false,
        message: "Cross-origin requests are not permitted.",
        code: "INVALID_ORIGIN",
      },
      403,
    );
  }

  const parsed = await readJsonBody(request);
  if (!parsed.success) return parsed.response;

  const action = cleanString(parsed.body.action, 50).toLowerCase();

  if (action === "create" || action === "create-payment") {
    return apiResponse(
      {
        success: false,
        message:
          "Manual payment creation is disabled. Payment records must be created by the verified Razorpay payment workflow.",
        code: "VERIFIED_PAYMENT_REQUIRED",
      },
      409,
    );
  }

  return apiResponse(
    {
      success: false,
      message:
        "Unsupported payment action. Use the student checkout and verified Razorpay workflow for payment creation.",
      code: "UNSUPPORTED_ACTION",
    },
    400,
  );
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return apiResponse(
      {
        success: false,
        message: "Main Admin authentication required.",
        code: "UNAUTHORIZED",
      },
      401,
    );
  }

  if (!isSafeMutationOrigin(request)) {
    return apiResponse(
      {
        success: false,
        message: "Cross-origin requests are not permitted.",
        code: "INVALID_ORIGIN",
      },
      403,
    );
  }

  try {
    await connectDB();

    const parsed = await readJsonBody(request);
    if (!parsed.success) return parsed.response;

    const body = parsed.body;
    const id = getIdFromBody(body);
    const paymentIdLookup = cleanString(body.lookupPaymentId, MAX_TEXT_LENGTH);

    if (!id && !paymentIdLookup) {
      return apiResponse(
        {
          success: false,
          message: "Provide a database record ID.",
          code: "IDENTIFIER_REQUIRED",
        },
        400,
      );
    }

    if (id && !isValidObjectId(id)) {
      return apiResponse(
        {
          success: false,
          message: "Invalid database record ID.",
          code: "INVALID_ID",
        },
        400,
      );
    }

    const protectedFields = [
      "status",
      "paymentStatus",
      "amount",
      "paymentId",
      "lookupPaymentId",
      "razorpayPaymentId",
      "orderId",
      "razorpayOrderId",
      "method",
      "paymentMethod",
      "currency",
      "archivedAt",
      "archivedBy",
      "planCode",
      "planName",
      "planDurationDays",
      "expectedPlanAmount",
    ];

    if (
      protectedFields.some((field) =>
        Object.prototype.hasOwnProperty.call(body, field),
      )
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "Financial identifiers, payment status, plan pricing and archive fields are locked.",
          code: "FINANCIAL_FIELDS_LOCKED",
        },
        403,
      );
    }

    const updates: Partial<
      Pick<IPayment, "studentName" | "studentId" | "email" | "internship" | "notes">
    > = {};

    if (body.studentName !== undefined) {
      const value = cleanString(body.studentName);
      if (!value) {
        return apiResponse(
          { success: false, message: "Student name cannot be empty.", code: "INVALID_STUDENT_NAME" },
          400,
        );
      }
      updates.studentName = value;
    }

    if (body.studentId !== undefined) {
      const value = cleanString(body.studentId);
      if (!value) {
        return apiResponse(
          { success: false, message: "Student ID cannot be empty.", code: "INVALID_STUDENT_ID" },
          400,
        );
      }
      updates.studentId = value;
    }

    if (body.email !== undefined) {
      const value = cleanString(body.email, 254).toLowerCase();
      if (!isValidEmail(value)) {
        return apiResponse(
          { success: false, message: "Invalid email address.", code: "INVALID_EMAIL" },
          400,
        );
      }
      updates.email = value;
    }

    if (body.internship !== undefined) {
      const value = cleanString(body.internship);
      const plan = normalizePlan(value);
      if (!value || !plan.code) {
        return apiResponse(
          {
            success: false,
            message: "Internship plan must be ONE_MONTH, THREE_MONTHS or SIX_MONTHS.",
            code: "INVALID_PLAN",
          },
          400,
        );
      }
      updates.internship = plan.name;
    }

    if (body.notes !== undefined) {
      if (typeof body.notes !== "string") {
        return apiResponse(
          { success: false, message: "Notes must be a text value.", code: "INVALID_NOTES" },
          400,
        );
      }
      updates.notes = cleanString(body.notes, MAX_NOTES_LENGTH);
    }

    if (Object.keys(updates).length === 0) {
      return apiResponse(
        { success: false, message: "No editable fields were provided.", code: "NO_UPDATES" },
        400,
      );
    }

    const filter: PaymentFilter = id
      ? { _id: new mongoose.Types.ObjectId(id), archivedAt: null }
      : { paymentId: paymentIdLookup, archivedAt: null };

    const existing = await Payment.findOne(filter).lean().exec();
    if (!existing) {
      return apiResponse(
        { success: false, message: "Payment record not found.", code: "PAYMENT_NOT_FOUND" },
        404,
      );
    }

    if (updates.internship && updates.internship !== existing.internship) {
      return apiResponse(
        {
          success: false,
          message:
            "The plan attached to a payment is immutable. Correct plan selection on the student record and create a new verified checkout attempt.",
          code: "PAYMENT_PLAN_IMMUTABLE",
        },
        409,
      );
    }

    const actorId = getAdminActor(admin);
    const actorRole = cleanString(admin.adminRole, 80);
    const previousValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
      previousValue[key] = existing[key] ?? "";
      newValue[key] = updates[key] ?? "";
    }

    const updated = await Payment.findOneAndUpdate(
      filter,
      {
        $set: {
          ...updates,
          isManuallyEdited: true,
          lastEditedAt: new Date(),
          lastEditedBy: actorId,
        },
        $push: {
          auditHistory: {
            $each: [
              {
                action: "metadata_updated",
                performedBy: actorId,
                performedByRole: actorRole,
                reason: cleanString(body.reason, 500),
                previousValue,
                newValue,
                createdAt: new Date(),
              },
            ],
            $slice: -100,
          },
        },
      },
      { new: true, runValidators: true, context: "query" },
    )
      .lean()
      .exec();

    if (!updated) {
      return apiResponse(
        { success: false, message: "Payment record not found.", code: "PAYMENT_NOT_FOUND" },
        404,
      );
    }

    return apiResponse({
      success: true,
      message: "Payment metadata updated successfully.",
      data: serializePayment(updated as unknown as Record<string, unknown>),
      audit: {
        actorId: getAdminActor(admin),
        actorRole: admin.adminRole ?? "",
        occurredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS PUT]", getErrorMessage(error));
    return apiResponse(
      {
        success: false,
        message: "Unable to update payment record.",
        code: "PAYMENT_UPDATE_FAILED",
      },
      isDuplicateKeyError(error) ? 409 : 500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return apiResponse(
      {
        success: false,
        message: "Main Admin authentication required.",
        code: "UNAUTHORIZED",
      },
      401,
    );
  }

  if (!isSafeMutationOrigin(request)) {
    return apiResponse(
      {
        success: false,
        message: "Cross-origin requests are not permitted.",
        code: "INVALID_ORIGIN",
      },
      403,
    );
  }

  try {
    await connectDB();

    const id = cleanString(request.nextUrl.searchParams.get("id"), 100);
    if (!id || !isValidObjectId(id)) {
      return apiResponse(
        {
          success: false,
          message: "A valid payment record ID is required.",
          code: "INVALID_ID",
        },
        400,
      );
    }

    const actorId = getAdminActor(admin);
    const actorRole = cleanString(admin.adminRole, 80);
    const archiveTime = new Date();

    const archived = await Payment.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), archivedAt: null },
      {
        $set: {
          archivedAt: archiveTime,
          archivedBy: actorId,
        },
        $push: {
          auditHistory: {
            $each: [
              {
                action: "archived",
                performedBy: actorId,
                performedByRole: actorRole,
                reason: "Payment record archived from Main Admin.",
                previousValue: { archivedAt: null },
                newValue: { archivedAt: archiveTime.toISOString() },
                createdAt: archiveTime,
              },
            ],
            $slice: -100,
          },
        },
      },
      { new: true, runValidators: true, context: "query" },
    )
      .lean()
      .exec();

    if (!archived) {
      return apiResponse(
        {
          success: false,
          message: "Payment record was not found or is already archived.",
          code: "PAYMENT_NOT_FOUND",
        },
        404,
      );
    }

    return apiResponse({
      success: true,
      archived: true,
      message: "Payment record archived successfully. Financial history is preserved.",
      data: serializePayment(archived as unknown as Record<string, unknown>),
      audit: {
        actorId: getAdminActor(admin),
        actorRole: admin.adminRole ?? "",
        occurredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS DELETE]", getErrorMessage(error));
    return apiResponse(
      {
        success: false,
        message: "Unable to archive payment record.",
        code: "PAYMENT_ARCHIVE_FAILED",
      },
      500,
    );
  }
}
