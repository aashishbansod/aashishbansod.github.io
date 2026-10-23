// src/app/api/admin/payments/route.ts

import { NextRequest, NextResponse } from "next/server";
import mongoose, { Schema, type Model } from "mongoose";

import connectDB from "@/lib/db";
import { verifyAuthToken, type AuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUTH_COOKIE_NAME = "cybernet_auth_token";
const MAX_LIMIT = 500;
const MAX_SEARCH_LENGTH = 120;
const MAX_TEXT_LENGTH = 200;

const ALLOWED_ADMIN_ROLES = new Set([
  "Super Admin",
  "Admin",
  "HR",
  "Assessment Manager",
  "Support",
  "Student Operations Admin",
]);

type PaymentStatus = "success" | "pending" | "failed" | "refunded";

type PaymentRecord = {
  studentName: string;
  studentId: string;
  email: string;
  internship: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  paymentId: string;
  orderId: string;
  notes: string;
  archivedAt?: Date | null;
  archivedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

type PaymentInput = Partial<PaymentRecord> & {
  id?: string;
  _id?: string;
};

type AuthenticatedAdmin = AuthUser & {
  adminRole?: string;
  adminId?: string;
  role?: string;
  userType?: string;
};

const paymentSchema = new Schema<PaymentRecord>(
  {
    studentName: { type: String, trim: true, default: "", maxlength: MAX_TEXT_LENGTH },
    studentId: { type: String, trim: true, default: "", maxlength: MAX_TEXT_LENGTH, index: true },
    email: { type: String, trim: true, lowercase: true, default: "", maxlength: 254, index: true },
    internship: { type: String, trim: true, default: "", maxlength: MAX_TEXT_LENGTH },
    amount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["success", "pending", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    method: { type: String, trim: true, default: "Razorpay", maxlength: 80 },
    paymentId: { type: String, trim: true, default: "", maxlength: MAX_TEXT_LENGTH, index: true },
    orderId: { type: String, trim: true, default: "", maxlength: MAX_TEXT_LENGTH, index: true },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: "payments",
    strict: true,
  },
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ studentId: 1, createdAt: -1 });

const PaymentModel: Model<PaymentRecord> =
  (mongoose.models.Payment as Model<PaymentRecord> | undefined) ??
  mongoose.model<PaymentRecord>("Payment", paymentSchema);

function apiResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
    },
  });
}

function cleanString(value: unknown, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeStatus(value: unknown): PaymentStatus | null {
  const status = cleanString(value, 30).toLowerCase();
  return status === "success" ||
    status === "pending" ||
    status === "failed" ||
    status === "refunded"
    ? status
    : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidObjectId(value: string): boolean {
  return mongoose.isValidObjectId(value);
}

function getAdminId(user: AuthenticatedAdmin): string {
  return cleanString(user.id || user.adminId || "", 120);
}

async function requireAdmin(request: NextRequest): Promise<AuthenticatedAdmin | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const user = (await verifyAuthToken(token)) as AuthenticatedAdmin | null;
    if (!user) return null;

    // Supports the project's centralized auth shape: role="admin",
    // with the actual permission level stored in adminRole/role.
    const userType = cleanString(user.userType, 40).toLowerCase();
    const baseRole = cleanString(user.role, 80);
    const adminRole = cleanString(user.adminRole, 80);
    const isAdminAccount =
      userType === "admin" ||
      baseRole.toLowerCase() === "admin";

    const hasAllowedRole =
      !adminRole && baseRole.toLowerCase() === "admin"
        ? true
        : ALLOWED_ADMIN_ROLES.has(adminRole || baseRole);

    if (!isAdminAccount || !hasAllowedRole) return null;
    return user;
  } catch {
    return null;
  }
}

function serializePayment(payment: Record<string, unknown>) {
  const id = String(payment._id ?? payment.id ?? "");
  return {
    id,
    _id: id,
    paymentId: cleanString(payment.paymentId),
    orderId: cleanString(payment.orderId),
    studentName: cleanString(payment.studentName),
    studentId: cleanString(payment.studentId),
    email: cleanString(payment.email, 254),
    internship: cleanString(payment.internship),
    amount: Number.isFinite(Number(payment.amount)) ? Number(payment.amount) : 0,
    status: normalizeStatus(payment.status) ?? "pending",
    method: cleanString(payment.method) || "Razorpay",
    notes: cleanString(payment.notes, 2000),
    createdAt: payment.createdAt ?? null,
    updatedAt: payment.updatedAt ?? null,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected server error.";
}

function getIdFromBody(body: PaymentInput): string {
  return cleanString(body.id || body._id || "", 100);
}

/**
 * GET /api/admin/payments
 * Supports status, search, limit, and includeArchived=false by default.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return apiResponse(
      { success: false, message: "Admin authentication required.", code: "UNAUTHORIZED" },
      401,
    );
  }

  try {
    await connectDB();

    const params = request.nextUrl.searchParams;
    const requestedLimit = Number(params.get("limit") ?? 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(requestedLimit)))
      : 100;
    const statusParam = params.get("status");
    const status = statusParam && statusParam !== "all"
      ? normalizeStatus(statusParam)
      : null;
    const search = cleanString(params.get("search"), MAX_SEARCH_LENGTH);
    const includeArchived = params.get("includeArchived") === "true";

    if (statusParam && statusParam !== "all" && !status) {
      return apiResponse(
        { success: false, message: "Invalid payment status filter.", code: "INVALID_STATUS" },
        400,
      );
    }

    const filter: Record<string, unknown> = {};
    if (!includeArchived) filter.archivedAt = null;
    if (status) filter.status = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
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

    const [records, total, successful, pending, failed, refunded, revenueAggregate] =
      await Promise.all([
        PaymentModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).lean(),
        PaymentModel.countDocuments(filter),
        PaymentModel.countDocuments({ ...filter, status: "success" }),
        PaymentModel.countDocuments({ ...filter, status: "pending" }),
        PaymentModel.countDocuments({ ...filter, status: "failed" }),
        PaymentModel.countDocuments({ ...filter, status: "refunded" }),
        PaymentModel.aggregate([
          { $match: { ...filter, status: "success" } },
          { $group: { _id: null, revenue: { $sum: "$amount" } } },
        ]),
      ]);

    return apiResponse({
      success: true,
      message: "Payment records loaded successfully.",
      data: records.map((record) => serializePayment(record as Record<string, unknown>)),
      total,
      limit,
      stats: {
        total,
        successful,
        pending,
        failed,
        refunded,
        revenue: Number(revenueAggregate[0]?.revenue ?? 0),
      },
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS GET]", errorMessage(error));
    return apiResponse(
      { success: false, message: "Unable to load payment records.", code: "PAYMENTS_FETCH_FAILED" },
      500,
    );
  }
}

/**
 * POST /api/admin/payments
 * Creates an internal record. This endpoint does NOT verify Razorpay payment.
 * Never use it as proof of payment or to unlock an internship.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return apiResponse(
      { success: false, message: "Admin authentication required.", code: "UNAUTHORIZED" },
      401,
    );
  }

  try {
    await connectDB();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiResponse(
        { success: false, message: "Request body must be valid JSON.", code: "INVALID_JSON" },
        400,
      );
    }
    if (!isPlainObject(rawBody)) {
      return apiResponse(
        { success: false, message: "A JSON object is required.", code: "INVALID_BODY" },
        400,
      );
    }

    const body = rawBody as PaymentInput;
    const studentName = cleanString(body.studentName);
    const studentId = cleanString(body.studentId);
    const email = cleanString(body.email, 254).toLowerCase();
    const internship = cleanString(body.internship);
    const amount = Number(body.amount);
    const status = normalizeStatus(body.status) ?? "pending";
    const method = cleanString(body.method, 80) || "Razorpay";
    const paymentId = cleanString(body.paymentId);
    const orderId = cleanString(body.orderId);
    const notes = cleanString(body.notes, 2000);

    if (!studentName || !studentId || !email || !internship) {
      return apiResponse({
        success: false,
        message: "Student name, student ID, email and internship are required.",
        code: "MISSING_REQUIRED_FIELDS",
      }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiResponse(
        { success: false, message: "A valid email address is required.", code: "INVALID_EMAIL" },
        400,
      );
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      return apiResponse(
        { success: false, message: "Amount must be greater than zero and within the permitted limit.", code: "INVALID_AMOUNT" },
        400,
      );
    }

    // A manual API call must not be able to declare a transaction successful.
    // Successful status is set only by the verified payment provider flow.
    if (status === "success") {
      return apiResponse({
        success: false,
        message: "Successful status can only be set by the verified payment-provider flow.",
        code: "PAYMENT_VERIFICATION_REQUIRED",
      }, 403);
    }

    if (paymentId) {
      const duplicate = await PaymentModel.findOne({ paymentId, archivedAt: null }).lean();
      if (duplicate) {
        return apiResponse(
          { success: false, message: "A record with this payment ID already exists.", code: "DUPLICATE_PAYMENT_ID" },
          409,
        );
      }
    }
    if (orderId) {
      const duplicateOrder = await PaymentModel.findOne({ orderId, archivedAt: null }).lean();
      if (duplicateOrder) {
        return apiResponse(
          { success: false, message: "A record with this order ID already exists.", code: "DUPLICATE_ORDER_ID" },
          409,
        );
      }
    }

    const payment = await PaymentModel.create({
      studentName,
      studentId,
      email,
      internship,
      amount,
      status,
      method,
      paymentId,
      orderId,
      notes,
    });

    return apiResponse({
      success: true,
      message: "Payment record created successfully.",
      data: serializePayment(payment.toObject() as Record<string, unknown>),
    }, 201);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return apiResponse(
        { success: false, message: "A transaction with these identifiers already exists.", code: "DUPLICATE_PAYMENT" },
        409,
      );
    }
    console.error("[ADMIN PAYMENTS POST]", errorMessage(error));
    return apiResponse(
      { success: false, message: "Unable to create payment record.", code: "PAYMENT_CREATE_FAILED" },
      500,
    );
  }
}

/**
 * PUT /api/admin/payments
 * Updates non-financial metadata only. Payment status/amount/IDs are immutable
 * here so this route cannot fabricate a successful transaction.
 */
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return apiResponse(
      { success: false, message: "Admin authentication required.", code: "UNAUTHORIZED" },
      401,
    );
  }

  try {
    await connectDB();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiResponse(
        { success: false, message: "Request body must be valid JSON.", code: "INVALID_JSON" },
        400,
      );
    }
    if (!isPlainObject(rawBody)) {
      return apiResponse(
        { success: false, message: "A JSON object is required.", code: "INVALID_BODY" },
        400,
      );
    }

    const body = rawBody as PaymentInput;
    const id = getIdFromBody(body);
    const paymentId = cleanString(body.paymentId);

    if (!id && !paymentId) {
      return apiResponse(
        { success: false, message: "Provide a database id or paymentId.", code: "IDENTIFIER_REQUIRED" },
        400,
      );
    }
    if (id && !isValidObjectId(id)) {
      return apiResponse(
        { success: false, message: "Invalid database record ID.", code: "INVALID_ID" },
        400,
      );
    }

    const filter = id ? { _id: new mongoose.Types.ObjectId(id), archivedAt: null } : { paymentId, archivedAt: null };
    const updates: Record<string, unknown> = {};
    if (body.studentName !== undefined) updates.studentName = cleanString(body.studentName);
    if (body.studentId !== undefined) updates.studentId = cleanString(body.studentId);
    if (body.email !== undefined) {
      const email = cleanString(body.email, 254).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return apiResponse(
          { success: false, message: "Invalid email address.", code: "INVALID_EMAIL" },
          400,
        );
      }
      updates.email = email;
    }
    if (body.internship !== undefined) updates.internship = cleanString(body.internship);
    if (body.method !== undefined) updates.method = cleanString(body.method, 80);
    if (body.notes !== undefined) updates.notes = cleanString(body.notes, 2000);

    if (
      body.status !== undefined ||
      body.amount !== undefined ||
      body.paymentId !== undefined ||
      body.orderId !== undefined
    ) {
      return apiResponse({
        success: false,
        message: "Financial fields cannot be edited through this endpoint. Use the verified payment/refund workflow.",
        code: "FINANCIAL_FIELDS_LOCKED",
      }, 403);
    }
    if (Object.keys(updates).length === 0) {
      return apiResponse(
        { success: false, message: "No editable fields were provided.", code: "NO_UPDATES" },
        400,
      );
    }

    const updated = await PaymentModel.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!updated) {
      return apiResponse(
        { success: false, message: "Payment record not found.", code: "PAYMENT_NOT_FOUND" },
        404,
      );
    }

    return apiResponse({
      success: true,
      message: "Payment record updated successfully.",
      data: serializePayment(updated as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS PUT]", errorMessage(error));
    return apiResponse(
      { success: false, message: "Unable to update payment record.", code: "PAYMENT_UPDATE_FAILED" },
      500,
    );
  }
}

/**
 * DELETE /api/admin/payments?id=<MongoDB ObjectId>
 * Soft-archives the record; no financial row is physically deleted.
 */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return apiResponse(
      { success: false, message: "Admin authentication required.", code: "UNAUTHORIZED" },
      401,
    );
  }

  try {
    await connectDB();

    const id = cleanString(request.nextUrl.searchParams.get("id"), 100);
    if (!id || !isValidObjectId(id)) {
      return apiResponse(
        { success: false, message: "A valid payment record ID is required.", code: "INVALID_ID" },
        400,
      );
    }

    const archived = await PaymentModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), archivedAt: null },
      {
        $set: {
          archivedAt: new Date(),
          archivedBy: getAdminId(admin) || "admin",
        },
      },
      { new: true },
    ).lean();

    if (!archived) {
      return apiResponse(
        { success: false, message: "Payment record was not found or is already archived.", code: "PAYMENT_NOT_FOUND" },
        404,
      );
    }

    return apiResponse({
      success: true,
      archived: true,
      message: "Payment record archived. The financial record remains in the database for audit purposes.",
      data: serializePayment(archived as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS DELETE]", errorMessage(error));
    return apiResponse(
      { success: false, message: "Unable to archive payment record.", code: "PAYMENT_ARCHIVE_FAILED" },
      500,
    );
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return isPlainObject(error) && error.code === 11000;
}
