
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import {
  verifyAuthToken,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
} from "@/lib/auth";

import Payment, {
  type PaymentStatus,
} from "@/models/Payment";

import Student from "@/models/Student";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 120;

type AnyRecord = Record<string, unknown>;
type PaymentFilter = Record<string, any>;

type AuthenticatedAdmin = {
  id: string;
  identifier: string;
  role: "Student Operations Admin";
};

type PaymentStats = {
  total: number;
  successful: number;
  pending: number;
  failed: number;
  refunded: number;
  revenue: number;
};

type PaymentStatusValue =
  | "success"
  | "pending"
  | "failed"
  | "refunded";

function cleanString(
  value: unknown,
  maximum = 200,
): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maximum);
}

function normalizeSearch(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPlainObject(
  value: unknown,
): value is AnyRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeStatus(
  value: unknown,
): PaymentStatusValue | null {
  const status = cleanString(value, 30).toLowerCase();

  if (status === "paid" || status === "captured") {
    return "success";
  }

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

function positiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (!value) return fallback;

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function requestIdFor(
  request: NextRequest,
): string {
  const supplied = cleanString(
    request.headers.get("x-request-id"),
    100,
  );

  return supplied &&
    /^[a-zA-Z0-9._:-]{8,100}$/.test(supplied)
    ? supplied
    : randomUUID();
}

function secure(
  response: NextResponse,
  requestId: string,
): NextResponse {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );

  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Vary", "Cookie");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");

  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );

  response.headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive",
  );

  response.headers.set("X-Request-Id", requestId);

  return response;
}

function json(
  requestId: string,
  body: unknown,
  status = 200,
): NextResponse {
  return secure(
    NextResponse.json(body, { status }),
    requestId,
  );
}

function failure(
  requestId: string,
  status: number,
  code: string,
  message: string,
): NextResponse {
  return json(
    requestId,
    {
      success: false,
      code,
      message,
      requestId,
    },
    status,
  );
}

async function authenticate(
  request: NextRequest,
  requestId: string,
): Promise<
  | { admin: AuthenticatedAdmin }
  | { response: NextResponse }
> {
  const token = request.cookies
    .get(STUDENT_ADMIN_AUTH_COOKIE_NAME)
    ?.value
    ?.trim();

  if (!token) {
    return {
      response: failure(
        requestId,
        401,
        "UNAUTHORIZED",
        "Student Operations Admin login is required.",
      ),
    };
  }

  try {
    const verified = await verifyAuthToken(token);

    if (
      !verified ||
      verified.role !== "admin" ||
      verified.adminRole !== "Student Operations Admin" ||
      verified.sessionType !== "student-admin"
    ) {
      return {
        response: failure(
          requestId,
          403,
          "FORBIDDEN",
          "Only an authenticated Student Operations Admin can access payment records.",
        ),
      };
    }

    const id = cleanString(verified.id, 150);
    const identifier = cleanString(
      verified.identifier,
      254,
    );

    if (!id) {
      return {
        response: failure(
          requestId,
          401,
          "INVALID_ADMIN_ID",
          "The administrator identity is invalid.",
        ),
      };
    }

    return {
      admin: {
        id,
        identifier,
        role: "Student Operations Admin",
      },
    };
  } catch (error) {
    console.error(
      "[STUDENT_ADMIN_PAYMENTS_AUTH]",
      { requestId, error },
    );

    return {
      response: failure(
        requestId,
        401,
        "INVALID_SESSION",
        "Your Student Operations session is invalid or expired.",
      ),
    };
  }
}

function buildPaymentFilter(
  search: string,
  status: PaymentStatusValue | null,
): PaymentFilter {
  const filter: PaymentFilter = {
    archivedAt: null,
  };

  if (status) {
    filter.status = status as PaymentStatus;
  }

  if (search) {
    const regex = new RegExp(
      escapeRegex(search),
      "i",
    );

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

  return filter;
}

function serializePayment(
  payment: AnyRecord,
  student?: AnyRecord,
): AnyRecord {
  const paymentId = cleanString(payment.paymentId);
  const orderId = cleanString(payment.orderId);

  const amount = Number(payment.amount);

  const status =
    normalizeStatus(payment.status) ?? "pending";

  const studentName = cleanString(
    student?.fullName || payment.studentName,
    120,
  ) || "Student";

  const studentId = cleanString(
    payment.studentId || student?.studentId,
    80,
  );

  const email = cleanString(
    student?.email || payment.email,
    254,
  ).toLowerCase();

  const completedAt =
    student?.paymentCompletedAt ||
    (status === "success" ? payment.createdAt : null);

  return {
    id: cleanString(payment._id?.toString?.() || payment._id, 100),

    studentObjectId: cleanString(
      student?._id?.toString?.() || student?._id,
      100,
    ),

    studentId,

    fullName: studentName,

    email,

    internship: cleanString(
      payment.internship || student?.internshipTrack,
      200,
    ) || "Internship",

    internshipPlan: cleanString(
      student?.internshipPlan,
      50,
    ),

    amount:
      Number.isFinite(amount) && amount >= 0
        ? amount
        : 0,

    currency: cleanString(
      student?.paymentCurrency,
      3,
    ).toUpperCase() || "INR",

    status,

    method: cleanString(
      payment.method,
      80,
    ) || "Razorpay",

    paymentId,

    orderId,

    paymentCompletedAt: completedAt || null,

    createdAt: payment.createdAt || null,

    studentOpsApprovalStatus: cleanString(
      student?.studentOpsApprovalStatus,
      30,
    ) || "pending",

    receiptAvailable:
      status === "success" &&
      Boolean(payment._id),
  };
}

async function loadStudentRecords(
  payments: AnyRecord[],
): Promise<Map<string, AnyRecord>> {
  const conditions: Array<Record<string, string>> = [];

  const studentIds = new Set<string>();
  const emails = new Set<string>();

  for (const payment of payments) {
    const studentId = cleanString(
      payment.studentId,
      80,
    ).toUpperCase();

    const email = cleanString(
      payment.email,
      254,
    ).toLowerCase();

    if (studentId) studentIds.add(studentId);
    if (email) emails.add(email);
  }

  if (studentIds.size > 0) {
    conditions.push({
      studentId: { $in: Array.from(studentIds) },
    } as unknown as Record<string, string>);
  }

  if (emails.size > 0) {
    conditions.push({
      email: { $in: Array.from(emails) },
    } as unknown as Record<string, string>);
  }

  if (conditions.length === 0) {
    return new Map();
  }

  const students = await Student.find({
    $or: conditions,
  } as never)
    .select(
      [
        "_id",
        "studentId",
        "fullName",
        "email",
        "internshipTrack",
        "internshipPlan",
        "paymentStatus",
        "paymentAmount",
        "paymentCurrency",
        "paymentCompletedAt",
        "studentOpsApprovalStatus",
        "studentOpsStatus",
      ].join(" "),
    )
    .lean()
    .exec();

  const records = students as unknown as AnyRecord[];

  const studentMap = new Map<string, AnyRecord>();

  for (const student of records) {
    const studentId = cleanString(
      student.studentId,
      80,
    ).toUpperCase();

    const email = cleanString(
      student.email,
      254,
    ).toLowerCase();

    if (studentId) {
      studentMap.set(`id:${studentId}`, student);
    }

    if (email) {
      studentMap.set(`email:${email}`, student);
    }
  }

  return studentMap;
}

function findStudent(
  payment: AnyRecord,
  students: Map<string, AnyRecord>,
): AnyRecord | undefined {
  const studentId = cleanString(
    payment.studentId,
    80,
  ).toUpperCase();

  const email = cleanString(
    payment.email,
    254,
  ).toLowerCase();

  if (studentId) {
    const student = students.get(`id:${studentId}`);

    if (student) return student;
  }

  if (email) {
    return students.get(`email:${email}`);
  }

  return undefined;
}

async function getPaymentStats(
  filter: PaymentFilter,
): Promise<PaymentStats> {
  const [
    total,
    successful,
    pending,
    failed,
    refunded,
    revenueResult,
  ] = await Promise.all([
    Payment.countDocuments(filter).exec(),

    Payment.countDocuments({
      ...filter,
      status: "success",
    }).exec(),

    Payment.countDocuments({
      ...filter,
      status: "pending",
    }).exec(),

    Payment.countDocuments({
      ...filter,
      status: "failed",
    }).exec(),

    Payment.countDocuments({
      ...filter,
      status: "refunded",
    }).exec(),

    Payment.aggregate([
      {
        $match: {
          ...filter,
          status: "success",
        },
      },
      {
        $group: {
          _id: null,
          revenue: {
            $sum: "$amount",
          },
        },
      },
    ]).exec(),
  ]);

  return {
    total,
    successful,
    pending,
    failed,
    refunded,
    revenue: Number(revenueResult[0]?.revenue ?? 0),
  };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  try {
    const authentication = await authenticate(
      request,
      requestId,
    );

    if ("response" in authentication) {
      return authentication.response;
    }

    await connectDB();

    const params = request.nextUrl.searchParams;

    const page = positiveInteger(
      params.get("page"),
      1,
      MAX_PAGE,
    );

    const limit = positiveInteger(
      params.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    const skip = (page - 1) * limit;

    const search = normalizeSearch(
      params.get("search") || "",
    );

    const statusParam = cleanString(
      params.get("status"),
      30,
    ).toLowerCase();

    let status: PaymentStatusValue | null = null;

    if (
      statusParam &&
      statusParam !== "all"
    ) {
      status = normalizeStatus(statusParam);

      if (!status) {
        return failure(
          requestId,
          400,
          "INVALID_PAYMENT_STATUS",
          "The requested payment status is invalid.",
        );
      }
    }

    const filter = buildPaymentFilter(
      search,
      status,
    );

    const [
      records,
      total,
      stats,
    ] = await Promise.all([
      Payment.find(filter)
        .select(
          [
            "_id",
            "studentName",
            "studentId",
            "email",
            "internship",
            "amount",
            "status",
            "method",
            "paymentId",
            "orderId",
            "createdAt",
            "updatedAt",
            "archivedAt",
          ].join(" "),
        )
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      Payment.countDocuments(filter).exec(),

      getPaymentStats(filter),
    ]);

    const paymentRecords =
      records as unknown as AnyRecord[];

    const students = await loadStudentRecords(
      paymentRecords,
    );

    const payments = paymentRecords.map(
      (payment) => {
        const student = findStudent(
          payment,
          students,
        );

        return serializePayment(
          payment,
          student,
        );
      },
    );

    const totalPages = Math.ceil(
      total / limit,
    );

    return json(
      requestId,
      {
        success: true,
        message: "Payment records loaded successfully.",

        data: {
          payments,

          stats,

          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
          },

          viewer: {
            id: authentication.admin.id,
            identifier: authentication.admin.identifier,
            role: authentication.admin.role,
          },

          filters: {
            search,
            status: status || "all",
          },

          generatedAt: new Date().toISOString(),
        },

        requestId,
      },
    );
  } catch (error) {
    console.error(
      "[GET /api/student-admin/payments]",
      {
        requestId,
        error,
      },
    );

    return failure(
      requestId,
      500,
      "PAYMENTS_FETCH_FAILED",
      "Unable to load Student Operations payment records.",
    );
  }
}

export async function OPTIONS(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  return secure(
    new NextResponse(null, {
      status: 204,
      headers: {
        Allow: "GET, OPTIONS",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    }),
    requestId,
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  return failure(
    requestIdFor(request),
    405,
    "METHOD_NOT_ALLOWED",
    "Payment records cannot be created through Student Operations.",
  );
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse> {
  return failure(
    requestIdFor(request),
    405,
    "METHOD_NOT_ALLOWED",
    "Payment verification and status updates are restricted to the verified payment-provider workflow.",
  );
}

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  return failure(
    requestIdFor(request),
    405,
    "METHOD_NOT_ALLOWED",
    "Payment records cannot be modified through this endpoint.",
  );
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  return failure(
    requestIdFor(request),
    405,
    "METHOD_NOT_ALLOWED",
    "Payment records cannot be deleted through Student Operations.",
  );
}
