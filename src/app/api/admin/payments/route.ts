import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { verifyAuthToken, type AuthUser } from "@/lib/auth";
import Payment, { type IPayment, type PaymentStatus } from "@/models/Payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUTH_COOKIE_NAME = "cybernet_auth_token";
const MAX_LIMIT = 500;
const MAX_OFFSET = 100000;
const MAX_SEARCH_LENGTH = 120;
const MAX_TEXT_LENGTH = 200;
const MAX_AMOUNT = 10_000_000;
const MAX_BODY_BYTES = 16 * 1024;

type PaymentFilter = Record<string, any>;

const ALLOWED_ADMIN_ROLES = new Set([
  "super admin",
  "admin",
  "hr",
  "assessment manager",
  "support",
  "student operations admin",
]);

type AuthenticatedAdmin = AuthUser & {
  adminRole?: string;
  adminId?: string;
  role?: string;
  userType?: string;
};

type PaymentStats = {
  total: number;
  successful: number;
  pending: number;
  failed: number;
  refunded: number;
  revenue: number;
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
    status === "refunded"
  ) {
    return status;
  }

  return null;
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

function getAdminId(user: AuthenticatedAdmin): string {
  return cleanString(user.id || user.adminId || "", 120);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function getIdFromBody(body: Record<string, unknown>): string {
  return cleanString(body.id || body._id || "", 100);
}

function isSafeMutationOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

async function requireAdmin(
  request: NextRequest
): Promise<AuthenticatedAdmin | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const user = (await verifyAuthToken(token)) as AuthenticatedAdmin | null;
    if (!user) return null;

    const userType = cleanString(user.userType, 40).toLowerCase();
    const baseRole = cleanString(user.role, 80).toLowerCase();
    const adminRole = cleanString(user.adminRole, 80).toLowerCase();

    const isAdminAccount =
      userType === "admin" ||
      baseRole === "admin" ||
      ALLOWED_ADMIN_ROLES.has(baseRole);

    const effectiveRole = adminRole || baseRole;
    const hasAllowedRole =
      effectiveRole === "admin" || ALLOWED_ADMIN_ROLES.has(effectiveRole);

    if (!isAdminAccount || !hasAllowedRole) return null;
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
        415
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
        413
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
        400
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
        400
      ),
    };
  }

  return { success: true, body };
}

function serializePayment(payment: Record<string, unknown>) {
  const id = String(payment._id ?? payment.id ?? "");
  const amount = Number(payment.amount);

  return {
    id,
    _id: id,
    paymentId: cleanString(payment.paymentId),
    orderId: cleanString(payment.orderId),
    studentName: cleanString(payment.studentName),
    studentId: cleanString(payment.studentId),
    email: cleanString(payment.email, 254),
    internship: cleanString(payment.internship),
    amount: Number.isFinite(amount) ? amount : 0,
    status: normalizeStatus(payment.status) ?? "pending",
    method: cleanString(payment.method, 80) || "Razorpay",
    notes: cleanString(payment.notes, 2000),
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

function buildStatsFilter(
  filter: PaymentFilter
): PaymentFilter {
  return { ...filter };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return apiResponse(
      {
        success: false,
        message: "Admin authentication required.",
        code: "UNAUTHORIZED",
      },
      401
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
        400
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

    const statsFilter = buildStatsFilter(filter);

    const [
      records,
      total,
      successful,
      pending,
      failed,
      refunded,
      revenueAggregate,
    ] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      Payment.countDocuments(filter).exec(),
      Payment.countDocuments({ ...statsFilter, status: "success" }).exec(),
      Payment.countDocuments({ ...statsFilter, status: "pending" }).exec(),
      Payment.countDocuments({ ...statsFilter, status: "failed" }).exec(),
      Payment.countDocuments({ ...statsFilter, status: "refunded" }).exec(),
      Payment.aggregate([
        {
          $match: {
            ...statsFilter,
            status: "success",
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$amount" },
          },
        },
      ]).exec(),
    ]);

    const stats: PaymentStats = {
      total,
      successful,
      pending,
      failed,
      refunded,
      revenue: Number(revenueAggregate[0]?.revenue ?? 0),
    };

    return apiResponse({
      success: true,
      message: "Payment records loaded successfully.",
      data: records.map((payment) =>
        serializePayment(payment as unknown as Record<string, unknown>)
      ),
      total,
      limit,
      offset,
      hasMore: offset + records.length < total,
      stats,
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS GET]", getErrorMessage(error));

    return apiResponse(
      {
        success: false,
        message: "Unable to load payment records.",
        code: "PAYMENTS_FETCH_FAILED",
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return apiResponse(
      {
        success: false,
        message: "Admin authentication required.",
        code: "UNAUTHORIZED",
      },
      401
    );
  }

  if (!isSafeMutationOrigin(request)) {
    return apiResponse(
      {
        success: false,
        message: "Cross-origin requests are not permitted.",
        code: "INVALID_ORIGIN",
      },
      403
    );
  }

  try {
    await connectDB();

    const parsed = await readJsonBody(request);
    if (!parsed.success) return parsed.response;

    const body = parsed.body;
    const studentName = cleanString(body.studentName);
    const studentId = cleanString(body.studentId);
    const email = cleanString(body.email, 254).toLowerCase();
    const internship = cleanString(body.internship);
    const amount = Number(body.amount);
    const method = cleanString(body.method, 80) || "Razorpay";
    const paymentId = cleanString(body.paymentId);
    const orderId = cleanString(body.orderId);
    const notes = cleanString(body.notes, 2000);

    if (!studentName || !studentId || !email || !internship) {
      return apiResponse(
        {
          success: false,
          message:
            "Student name, student ID, email and internship are required.",
          code: "MISSING_REQUIRED_FIELDS",
        },
        400
      );
    }

    if (!isValidEmail(email)) {
      return apiResponse(
        {
          success: false,
          message: "A valid email address is required.",
          code: "INVALID_EMAIL",
        },
        400
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_AMOUNT ||
      Math.round(amount * 100) !== amount * 100
    ) {
      return apiResponse(
        {
          success: false,
          message: "Invalid payment amount.",
          code: "INVALID_AMOUNT",
        },
        400
      );
    }

    if (body.status !== undefined && normalizeStatus(body.status) !== "pending") {
      return apiResponse(
        {
          success: false,
          message:
            "Payment status can only be changed by the verified payment-provider workflow.",
          code: "PAYMENT_VERIFICATION_REQUIRED",
        },
        403
      );
    }

    if (paymentId) {
      const duplicate = await Payment.findOne({ paymentId })
        .select("_id")
        .lean()
        .exec();

      if (duplicate) {
        return apiResponse(
          {
            success: false,
            message: "This payment ID already exists.",
            code: "DUPLICATE_PAYMENT_ID",
          },
          409
        );
      }
    }

    if (orderId) {
      const duplicateOrder = await Payment.findOne({ orderId })
        .select("_id")
        .lean()
        .exec();

      if (duplicateOrder) {
        return apiResponse(
          {
            success: false,
            message: "This order ID already exists.",
            code: "DUPLICATE_ORDER_ID",
          },
          409
        );
      }
    }

    const payment = await Payment.create({
      studentName,
      studentId,
      email,
      internship,
      amount,
      status: "pending",
      method,
      paymentId,
      orderId,
      notes,
    });

    return apiResponse(
      {
        success: true,
        message: "Pending payment record created successfully.",
        data: serializePayment(
          payment.toObject() as unknown as Record<string, unknown>
        ),
      },
      201
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return apiResponse(
        {
          success: false,
          message: "A transaction with these identifiers already exists.",
          code: "DUPLICATE_PAYMENT",
        },
        409
      );
    }

    console.error("[ADMIN PAYMENTS POST]", getErrorMessage(error));

    return apiResponse(
      {
        success: false,
        message: "Unable to create payment record.",
        code: "PAYMENT_CREATE_FAILED",
      },
      500
    );
  }
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return apiResponse(
      {
        success: false,
        message: "Admin authentication required.",
        code: "UNAUTHORIZED",
      },
      401
    );
  }

  if (!isSafeMutationOrigin(request)) {
    return apiResponse(
      {
        success: false,
        message: "Cross-origin requests are not permitted.",
        code: "INVALID_ORIGIN",
      },
      403
    );
  }

  try {
    await connectDB();

    const parsed = await readJsonBody(request);
    if (!parsed.success) return parsed.response;

    const body = parsed.body;
    const id = getIdFromBody(body);
    const paymentId = cleanString(body.paymentId);

    if (!id && !paymentId) {
      return apiResponse(
        {
          success: false,
          message: "Provide a database ID or payment ID.",
          code: "IDENTIFIER_REQUIRED",
        },
        400
      );
    }

    if (id && !isValidObjectId(id)) {
      return apiResponse(
        {
          success: false,
          message: "Invalid database record ID.",
          code: "INVALID_ID",
        },
        400
      );
    }

    const protectedFields = [
      "status",
      "paymentStatus",
      "amount",
      "paymentId",
      "razorpayPaymentId",
      "orderId",
      "razorpayOrderId",
      "method",
      "paymentMethod",
      "currency",
      "archivedAt",
      "archivedBy",
    ];

    if (
      protectedFields.some((field) =>
        Object.prototype.hasOwnProperty.call(body, field)
      )
    ) {
      return apiResponse(
        {
          success: false,
          message:
            "Financial and archive fields cannot be modified through this endpoint.",
          code: "FINANCIAL_FIELDS_LOCKED",
        },
        403
      );
    }

    const updates: Partial<
      Pick<
        IPayment,
        "studentName" | "studentId" | "email" | "internship" | "notes"
      >
    > = {};

    if (body.studentName !== undefined) {
      const studentName = cleanString(body.studentName);
      if (!studentName) {
        return apiResponse(
          {
            success: false,
            message: "Student name cannot be empty.",
            code: "INVALID_STUDENT_NAME",
          },
          400
        );
      }
      updates.studentName = studentName;
    }

    if (body.studentId !== undefined) {
      const studentId = cleanString(body.studentId);
      if (!studentId) {
        return apiResponse(
          {
            success: false,
            message: "Student ID cannot be empty.",
            code: "INVALID_STUDENT_ID",
          },
          400
        );
      }
      updates.studentId = studentId;
    }

    if (body.email !== undefined) {
      const email = cleanString(body.email, 254).toLowerCase();
      if (!isValidEmail(email)) {
        return apiResponse(
          {
            success: false,
            message: "Invalid email address.",
            code: "INVALID_EMAIL",
          },
          400
        );
      }
      updates.email = email;
    }

    if (body.internship !== undefined) {
      const internship = cleanString(body.internship);
      if (!internship) {
        return apiResponse(
          {
            success: false,
            message: "Internship cannot be empty.",
            code: "INVALID_INTERNSHIP",
          },
          400
        );
      }
      updates.internship = internship;
    }

    if (body.notes !== undefined) {
      if (typeof body.notes !== "string") {
        return apiResponse(
          {
            success: false,
            message: "Notes must be a text value.",
            code: "INVALID_NOTES",
          },
          400
        );
      }
      updates.notes = cleanString(body.notes, 2000);
    }

    if (Object.keys(updates).length === 0) {
      return apiResponse(
        {
          success: false,
          message: "No editable fields were provided.",
          code: "NO_UPDATES",
        },
        400
      );
    }

    const filter: PaymentFilter = id
      ? {
          _id: new mongoose.Types.ObjectId(id),
          archivedAt: null,
        }
      : {
          paymentId,
          archivedAt: null,
        };

    const updated = await Payment.findOneAndUpdate(
      filter,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    )
      .lean()
      .exec();

    if (!updated) {
      return apiResponse(
        {
          success: false,
          message: "Payment record not found.",
          code: "PAYMENT_NOT_FOUND",
        },
        404
      );
    }

    return apiResponse({
      success: true,
      message: "Payment metadata updated successfully.",
      data: serializePayment(updated as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS PUT]", getErrorMessage(error));

    return apiResponse(
      {
        success: false,
        message: "Unable to update payment record.",
        code: "PAYMENT_UPDATE_FAILED",
      },
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return apiResponse(
      {
        success: false,
        message: "Admin authentication required.",
        code: "UNAUTHORIZED",
      },
      401
    );
  }

  if (!isSafeMutationOrigin(request)) {
    return apiResponse(
      {
        success: false,
        message: "Cross-origin requests are not permitted.",
        code: "INVALID_ORIGIN",
      },
      403
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
        400
      );
    }

    const archived = await Payment.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        archivedAt: null,
      },
      {
        $set: {
          archivedAt: new Date(),
          archivedBy: getAdminId(admin) || "admin",
        },
      },
      {
        new: true,
        runValidators: true,
      }
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
        404
      );
    }

    return apiResponse({
      success: true,
      archived: true,
      message:
        "Payment record archived successfully. Financial history is preserved.",
      data: serializePayment(archived as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[ADMIN PAYMENTS DELETE]", getErrorMessage(error));

    return apiResponse(
      {
        success: false,
        message: "Unable to archive payment record.",
        code: "PAYMENT_ARCHIVE_FAILED",
      },
      500
    );
  }
}
