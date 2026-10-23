import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import crypto from "node:crypto";

import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import Internship from "@/models/Internship";
import Application from "@/models/Application";

import {
  AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

import {
  recordVerifiedPayment,
} from "@/services/student.service";

import {
  sendPaymentReceiptEmail,
} from "@/services/email.service";

/* ============================================================================
   CYBERNET CAREERS
   PAYMENT VERIFICATION API
   ============================================================================

   FINAL PAYMENT FLOW

   Student Login
        ↓
   Internship Selected
        ↓
   Razorpay Order Created
        ↓
   Razorpay Checkout
        ↓
   POST /api/payment/verify
        ↓
   Authenticate Student
        ↓
   Validate Request
        ↓
   Validate Student Order Ownership
        ↓
   Validate Server Plan / Price
        ↓
   Verify Razorpay HMAC Signature
        ↓
   Fetch Razorpay Order
        ↓
   Fetch Razorpay Payment
        ↓
   Validate Order / Payment / Amount / Currency
        ↓
   Capture authorized payment if required
        ↓
   Re-fetch final payment state
        ↓
   Require captured state
        ↓
   student.service.recordVerifiedPayment()
        ↓
   paymentStatus = paid
        ↓
   internshipStatus = approved
        ↓
   Student Operations = pending-review
        ↓
   Dashboard remains locked
        ↓
   Payment Receipt Email
        ↓
   Student Operations Approval
        ↓
   Dashboard Credentials
        ↓
   Dashboard Active

   IMPORTANT

   - Client cannot declare payment successful.
   - Client cannot choose the payment amount.
   - Client cannot choose another student's order.
   - Razorpay signature is verified server-side.
   - Razorpay payment is fetched server-side.
   - Amount is validated server-side.
   - Currency is validated server-side.
   - Payment must be captured.
   - Dashboard is NOT activated by this route.
   - Student Operations approval is mandatory.
   - Receipt email failure does NOT roll back a verified payment.

============================================================================ */

/* ============================================================================
   ROUTE CONFIG
============================================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================================
   CONSTANTS
============================================================================ */

const RAZORPAY_API_BASE =
  "https://api.razorpay.com/v1";

const RAZORPAY_TIMEOUT_MS =
  15_000;

const MAX_BODY_BYTES =
  16 * 1024;

const MAX_ID_LENGTH =
  150;

const MIN_AMOUNT_IN_PAISE =
  100;

/* ============================================================================
   AUTHORITATIVE PLANS
============================================================================ */

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

type PlanCode =
  keyof typeof PLAN_CONFIG;

/* ============================================================================
   REQUEST TYPES
============================================================================ */

type VerifyBody = {
  internshipId?: unknown;
  planCode?: unknown;

  razorpayOrderId?: unknown;
  razorpayPaymentId?: unknown;
  razorpaySignature?: unknown;
};

/* ============================================================================
   RAZORPAY TYPES
============================================================================ */

type RazorpayOrder = {
  id?: unknown;
  entity?: unknown;

  amount?: unknown;
  amount_paid?: unknown;
  amount_due?: unknown;

  currency?: unknown;

  receipt?: unknown;

  status?: unknown;

  attempts?: unknown;

  created_at?: unknown;

  notes?: unknown;
};

type RazorpayPayment = {
  id?: unknown;

  entity?: unknown;

  amount?: unknown;

  currency?: unknown;

  status?: unknown;

  order_id?: unknown;

  invoice_id?: unknown;

  international?: unknown;

  method?: unknown;

  amount_refunded?: unknown;

  refund_status?: unknown;

  captured?: unknown;

  description?: unknown;

  card_id?: unknown;

  bank?: unknown;

  wallet?: unknown;

  vpa?: unknown;

  email?: unknown;

  contact?: unknown;

  notes?: unknown;

  fee?: unknown;

  tax?: unknown;

  error_code?: unknown;

  error_description?: unknown;

  created_at?: unknown;
};

/* ============================================================================
   STUDENT TYPE
============================================================================ */

type StudentSnapshot = {
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
  razorpaySignature?: unknown;

  paymentCompletedAt?: unknown;
  paymentVerifiedAt?: unknown;

  receiptEmailSent?: unknown;
  receiptEmailSentAt?: unknown;

  studentOpsStatus?: unknown;
  studentOpsApprovalStatus?: unknown;

  dashboardStatus?: unknown;
  dashboardLoginEnabled?: unknown;
};

/* ============================================================================
   INTERNSHIP TYPE
============================================================================ */

type InternshipSnapshot = {
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

/* ============================================================================
   AUTH TYPE
============================================================================ */

type AuthResult = {
  userId: string;
  role: string;
  sessionType?: string;
};

/* ============================================================================
   RESPONSE HELPERS
============================================================================ */

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, no-cache, must-revalidate, proxy-revalidate",

        Pragma:
          "no-cache",

        Expires:
          "0",

        "X-Content-Type-Options":
          "nosniff",

        "X-Frame-Options":
          "DENY",

        "Referrer-Policy":
          "same-origin",

        "Permissions-Policy":
          "camera=(), microphone=(), geolocation=()",

        Allow:
          "POST, OPTIONS",
      },
    },
  );
}

function successResponse(
  message: string,
  data: Record<string, unknown>,
): NextResponse {
  return jsonResponse(
    {
      success: true,
      verified: true,
      message,
      data,
    },
    200,
  );
}

function errorResponse(
  message: string,
  code: string,
  status = 400,
  extra: Record<string, unknown> = {},
): NextResponse {
  return jsonResponse(
    {
      success: false,
      verified: false,
      message,
      code,
      ...extra,
    },
    status,
  );
}

/* ============================================================================
   BASIC HELPERS
============================================================================ */

function cleanString(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

function limitedString(
  value: unknown,
  maxLength = MAX_ID_LENGTH,
): string {
  const valueString =
    cleanString(value);

  if (
    valueString.length >
    maxLength
  ) {
    return "";
  }

  return valueString;
}

function toFiniteNumber(
  value: unknown,
): number | null {
  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  return null;
}

function normalizeStatus(
  value: unknown,
): string {
  return cleanString(value)
    .toLowerCase();
}

/* ============================================================================
   PLAN NORMALIZATION
============================================================================ */

function normalizePlanCode(
  value: unknown,
): PlanCode | null {
  const normalized =
    cleanString(value)
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_",
      );

  if (
    normalized ===
      "ONE_MONTH" ||
    normalized ===
      "1_MONTH" ||
    normalized ===
      "1M"
  ) {
    return "ONE_MONTH";
  }

  if (
    normalized ===
      "THREE_MONTHS" ||
    normalized ===
      "3_MONTHS" ||
    normalized ===
      "3M"
  ) {
    return "THREE_MONTHS";
  }

  if (
    normalized ===
      "SIX_MONTHS" ||
    normalized ===
      "6_MONTHS" ||
    normalized ===
      "6M"
  ) {
    return "SIX_MONTHS";
  }

  return null;
}

/* ============================================================================
   DOMAIN VALIDATION
============================================================================ */

function normalizeDomain(
  value: unknown,
): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function domainMatches(
  studentDomain: unknown,
  internshipDomain: unknown,
  assessmentDomain: unknown,
): boolean {
  const student =
    normalizeDomain(
      studentDomain,
    );

  const internship =
    normalizeDomain(
      internshipDomain,
    );

  const assessment =
    normalizeDomain(
      assessmentDomain,
    );

  if (!student) {
    return false;
  }

  if (
    internship &&
    student === internship
  ) {
    return true;
  }

  if (
    assessment &&
    student === assessment
  ) {
    return true;
  }

  return false;
}

/* ============================================================================
   INTERNSHIP TITLE
============================================================================ */

function getInternshipTitle(
  internship:
    | InternshipSnapshot
    | null,
): string {
  return (
    cleanString(
      internship?.title,
    ) ||
    cleanString(
      internship?.name,
    ) ||
    "CyberNet Careers Internship"
  );
}

/* ============================================================================
   RAZORPAY CONFIG
============================================================================ */

function getRazorpayConfig(): {
  keyId: string;
  keySecret: string;
} {
  const keyId =
    cleanString(
      process.env.RAZORPAY_KEY_ID,
    ) ||
    cleanString(
      process.env.RAZORPAY_KEY,
    );

  const keySecret =
    cleanString(
      process.env.RAZORPAY_KEY_SECRET,
    ) ||
    cleanString(
      process.env.RAZORPAY_SECRET,
    );

  if (
    !keyId ||
    !keySecret
  ) {
    throw new Error(
      "Razorpay server credentials are not configured.",
    );
  }

  return {
    keyId,
    keySecret,
  };
}

/* ============================================================================
   RAZORPAY BASIC AUTH
============================================================================ */

function createBasicAuth(
  keyId: string,
  keySecret: string,
): string {
  return Buffer
    .from(
      `${keyId}:${keySecret}`,
      "utf8",
    )
    .toString("base64");
}

/* ============================================================================
   RAZORPAY ERROR
============================================================================ */

function getGatewayErrorMessage(
  payload: unknown,
): string {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return "";
  }

  const data =
    payload as {
      error?: {
        description?: unknown;
      };
    };

  return cleanString(
    data.error?.description,
  );
}

/* ============================================================================
   RAZORPAY REQUEST
============================================================================ */

async function razorpayRequest<T>(
  path: string,
  options: {
    method: "GET" | "POST";
    keyId: string;
    keySecret: string;
    body?: Record<
      string,
      unknown
    >;
  },
): Promise<T> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      RAZORPAY_TIMEOUT_MS,
    );

  try {
    const headers: HeadersInit = {
      Accept:
        "application/json",

      Authorization:
        `Basic ${createBasicAuth(
          options.keyId,
          options.keySecret,
        )}`,
    };

    if (
      options.body !==
      undefined
    ) {
      headers[
        "Content-Type"
      ] =
        "application/json";
    }

    const response =
      await fetch(
        `${RAZORPAY_API_BASE}${path}`,
        {
          method:
            options.method,

          headers,

          body:
            options.body !==
            undefined
              ? JSON.stringify(
                  options.body,
                )
              : undefined,

          cache:
            "no-store",

          signal:
            controller.signal,
        },
      );

    const payload: unknown =
      await response
        .json()
        .catch(
          () => null,
        );

    if (
      !response.ok
    ) {
      const gatewayMessage =
        getGatewayErrorMessage(
          payload,
        );

      const error =
        new Error(
          gatewayMessage ||
            `Razorpay returned HTTP ${response.status}.`,
        );

      (
        error as Error & {
          status?: number;
        }
      ).status =
        response.status;

      throw error;
    }

    return payload as T;
  } catch (error) {
    if (
      error instanceof
        Error &&
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        "Razorpay request timed out.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================================
   SIGNATURE
============================================================================ */

function generateSignature(
  orderId: string,
  paymentId: string,
  secret: string,
): string {
  return crypto
    .createHmac(
      "sha256",
      secret,
    )
    .update(
      `${orderId}|${paymentId}`,
      "utf8",
    )
    .digest("hex");
}

function timingSafeEqualHex(
  expected: string,
  received: string,
): boolean {
  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8",
    );

  const receivedBuffer =
    Buffer.from(
      received,
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

/* ============================================================================
   AUTHENTICATION
============================================================================ */

async function authenticateStudent(
  request: NextRequest,
): Promise<AuthResult | null> {
  const dedicatedToken =
    request.cookies.get(
      STUDENT_AUTH_COOKIE_NAME,
    )?.value || "";

  const legacyToken =
    request.cookies.get(
      AUTH_COOKIE_NAME,
    )?.value || "";

  const tokens = [
    dedicatedToken,
    legacyToken,
  ].filter(Boolean);

  for (
    const token of tokens
  ) {
    try {
      const payload =
        await verifyAccessToken(
          token,
        );

      if (!payload) {
        continue;
      }

      const payloadObject =
        typeof payload ===
          "object" &&
        payload !== null
          ? (payload as {
              userId?: unknown;
              id?: unknown;
              identifier?: unknown;
              role?: unknown;
              sessionType?: unknown;
            })
          : null;

      const userId =
        cleanString(
          payloadObject?.userId ??
            payloadObject?.id ??
            payloadObject?.identifier,
        );

      const role =
        cleanString(
          payloadObject?.role,
        ).toLowerCase();

      const sessionType =
        cleanString(
          payloadObject?.sessionType,
        ).toLowerCase();

      if (
        !userId ||
        role !== "student"
      ) {
        continue;
      }

      /*
       * Payment verification must only be
       * performed from the normal student portal.
       */
      if (
        sessionType ===
          "student-dashboard" ||
        sessionType ===
          "admin"
      ) {
        continue;
      }

      if (
        sessionType &&
        sessionType !==
          "student" &&
        sessionType !==
          "legacy"
      ) {
        continue;
      }

      return {
        userId,
        role,
        sessionType,
      };
    } catch {
      /*
       * Do not expose token parsing details.
       */
      continue;
    }
  }

  return null;
}

/* ============================================================================
   REQUEST BODY
============================================================================ */

async function parseBody(
  request: NextRequest,
): Promise<
  VerifyBody | null
> {
  const contentLengthHeader =
    request.headers.get(
      "content-length",
    );

  const contentLength =
    contentLengthHeader
      ? Number(
          contentLengthHeader,
        )
      : 0;

  if (
    Number.isFinite(
      contentLength,
    ) &&
    contentLength >
      MAX_BODY_BYTES
  ) {
    throw new Error(
      "REQUEST_TOO_LARGE",
    );
  }

  const raw =
    await request.text();

  if (
    Buffer.byteLength(
      raw,
      "utf8",
    ) >
    MAX_BODY_BYTES
  ) {
    throw new Error(
      "REQUEST_TOO_LARGE",
    );
  }

  if (!raw.trim()) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(raw);
  } catch {
    throw new Error(
      "INVALID_JSON",
    );
  }

  if (
    !parsed ||
    typeof parsed !==
      "object" ||
    Array.isArray(
      parsed,
    )
  ) {
    throw new Error(
      "INVALID_REQUEST_BODY",
    );
  }

  return parsed as VerifyBody;
}

/* ============================================================================
   POST
============================================================================ */

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    /* ========================================================================
       CONTENT TYPE
    ======================================================================== */

    const contentType =
      request.headers.get(
        "content-type",
      ) || "";

    if (
      !contentType
        .toLowerCase()
        .startsWith(
          "application/json",
        )
    ) {
      return errorResponse(
        "Content-Type must be application/json.",
        "INVALID_CONTENT_TYPE",
        415,
      );
    }

    /* ========================================================================
       AUTH
    ======================================================================== */

    const auth =
      await authenticateStudent(
        request,
      );

    if (!auth) {
      return errorResponse(
        "Student login is required.",
        "UNAUTHORIZED",
        401,
      );
    }

    if (
      !mongoose.isValidObjectId(
        auth.userId,
      )
    ) {
      return errorResponse(
        "Invalid student session.",
        "INVALID_STUDENT_SESSION",
        401,
      );
    }

    /* ========================================================================
       BODY
    ======================================================================== */

    let body:
      | VerifyBody
      | null;

    try {
      body =
        await parseBody(
          request,
        );
    } catch (error) {
      const code =
        error instanceof Error
          ? error.message
          : "";

      if (
        code ===
        "REQUEST_TOO_LARGE"
      ) {
        return errorResponse(
          "Request body is too large.",
          "REQUEST_TOO_LARGE",
          413,
        );
      }

      if (
        code ===
        "INVALID_JSON"
      ) {
        return errorResponse(
          "Invalid JSON request body.",
          "INVALID_JSON",
          400,
        );
      }

      return errorResponse(
        "Request body must be a JSON object.",
        "INVALID_REQUEST_BODY",
        400,
      );
    }

    if (!body) {
      return errorResponse(
        "Payment verification data is required.",
        "INVALID_REQUEST_BODY",
        400,
      );
    }

    /* ========================================================================
       INPUT
    ======================================================================== */

    const internshipId =
      limitedString(
        body.internshipId,
      );

    const planCode =
      normalizePlanCode(
        body.planCode,
      );

    const razorpayOrderId =
      limitedString(
        body.razorpayOrderId,
      );

    const razorpayPaymentId =
      limitedString(
        body.razorpayPaymentId,
      );

    const razorpaySignature =
      limitedString(
        body.razorpaySignature,
      );

    /* ========================================================================
       VALIDATE INTERNSHIP ID
    ======================================================================== */

    if (
      !internshipId ||
      !mongoose.isValidObjectId(
        internshipId,
      )
    ) {
      return errorResponse(
        "A valid internship ID is required.",
        "INVALID_INTERNSHIP_ID",
        400,
      );
    }

    /* ========================================================================
       VALIDATE PLAN
    ======================================================================== */

    if (!planCode) {
      return errorResponse(
        "A valid internship plan is required.",
        "INVALID_PLAN",
        400,
      );
    }

    const plan =
      PLAN_CONFIG[
        planCode
      ];

    /* ========================================================================
       VALIDATE RAZORPAY ORDER ID
    ======================================================================== */

    if (
      !razorpayOrderId ||
      !/^order_[A-Za-z0-9]+$/.test(
        razorpayOrderId,
      )
    ) {
      return errorResponse(
        "A valid Razorpay order ID is required.",
        "INVALID_ORDER_ID",
        400,
      );
    }

    /* ========================================================================
       VALIDATE RAZORPAY PAYMENT ID
    ======================================================================== */

    if (
      !razorpayPaymentId ||
      !/^pay_[A-Za-z0-9]+$/.test(
        razorpayPaymentId,
      )
    ) {
      return errorResponse(
        "A valid Razorpay payment ID is required.",
        "INVALID_PAYMENT_ID",
        400,
      );
    }

    /* ========================================================================
       VALIDATE SIGNATURE
    ======================================================================== */

    if (
      !razorpaySignature ||
      !/^[a-fA-F0-9]{64}$/.test(
        razorpaySignature,
      )
    ) {
      return errorResponse(
        "A valid Razorpay payment signature is required.",
        "INVALID_SIGNATURE_FORMAT",
        400,
      );
    }

    /* ========================================================================
       DATABASE
    ======================================================================== */

    try {
      await connectDB();
    } catch (error) {
      console.error(
        "[PAYMENT VERIFY] Database connection failed.",
        error,
      );

      return errorResponse(
        "Database is temporarily unavailable. Please try again.",
        "DATABASE_UNAVAILABLE",
        503,
      );
    }

    /* ========================================================================
       LOAD STUDENT
    ======================================================================== */

    const student =
      (
        await Student.findById(
          auth.userId,
        )
          .lean()
          .exec()
      ) as unknown as
        | StudentSnapshot
        | null;

    if (!student) {
      return errorResponse(
        "Student account was not found.",
        "STUDENT_NOT_FOUND",
        404,
      );
    }

    /* ========================================================================
       ACCOUNT SECURITY
    ======================================================================== */

    if (
      student.loginEnabled !==
      true
    ) {
      return errorResponse(
        "Your student account is disabled.",
        "STUDENT_ACCOUNT_DISABLED",
        403,
      );
    }

    if (
      student.accountLocked ===
      true
    ) {
      const lockedUntil =
        student.lockedUntil
          ? new Date(
              String(
                student.lockedUntil,
              ),
            )
          : null;

      if (
        lockedUntil &&
        !Number.isNaN(
          lockedUntil.getTime(),
        ) &&
        lockedUntil.getTime() >
          Date.now()
      ) {
        return errorResponse(
          "Your student account is temporarily locked.",
          "STUDENT_ACCOUNT_LOCKED",
          423,
        );
      }
    }

    /* ========================================================================
       EMAIL
    ======================================================================== */

    if (
      student.emailVerified !==
      true
    ) {
      return errorResponse(
        "Please verify your email before completing payment.",
        "EMAIL_NOT_VERIFIED",
        403,
      );
    }

    /* ========================================================================
       MAIN ADMIN APPROVAL
    ======================================================================== */

    if (
      normalizeStatus(
        student.applicationStatus,
      ) !== "approved"
    ) {
      return errorResponse(
        "Your student application has not been approved.",
        "APPLICATION_NOT_APPROVED",
        403,
      );
    }

    /* ========================================================================
       ASSESSMENT
    ======================================================================== */

    if (
      normalizeStatus(
        student.assessmentStatus,
      ) !== "passed"
    ) {
      return errorResponse(
        "You must pass the required assessment before payment.",
        "ASSESSMENT_NOT_PASSED",
        403,
      );
    }

    if (
      normalizeStatus(
        student.resultStatus,
      ) !== "passed"
    ) {
      return errorResponse(
        "Your assessment result has not been confirmed as passed.",
        "ASSESSMENT_RESULT_NOT_PASSED",
        403,
      );
    }

    /* ========================================================================
       INTERNSHIP ELIGIBILITY
    ======================================================================== */

    if (
      student.internshipApplicationAllowed !==
      true
    ) {
      return errorResponse(
        "Internship payment is not allowed for this account.",
        "INTERNSHIP_PAYMENT_NOT_ALLOWED",
        403,
      );
    }

    /* ========================================================================
       ORDER OWNERSHIP
    ======================================================================== */

    const storedOrderId =
      cleanString(
        student.razorpayOrderId,
      );

    if (!storedOrderId) {
      return errorResponse(
        "No active payment order was found.",
        "PAYMENT_ORDER_NOT_FOUND",
        404,
      );
    }

    if (
      storedOrderId !==
      razorpayOrderId
    ) {
      return errorResponse(
        "Payment order does not belong to this student.",
        "ORDER_OWNERSHIP_MISMATCH",
        403,
      );
    }

    /* ========================================================================
       ALREADY VERIFIED
    ======================================================================== */

    const existingPaymentId =
      cleanString(
        student.razorpayPaymentId,
      );

    const existingPaymentStatus =
      normalizeStatus(
        student.paymentStatus,
      );

    if (
      existingPaymentStatus ===
        "paid" &&
      existingPaymentId ===
        razorpayPaymentId
    ) {
      return successResponse(
        "Payment was already verified successfully.",
        {
          paymentStatus:
            "paid",

          internshipStatus:
            normalizeStatus(
              student.internshipStatus,
            ),

          studentOpsStatus:
            cleanString(
              student.studentOpsStatus,
            ) ||
            "pending-review",

          studentOpsApprovalStatus:
            cleanString(
              student.studentOpsApprovalStatus,
            ) ||
            "pending",

          dashboardStatus:
            cleanString(
              student.dashboardStatus,
            ) ||
            "locked",

          dashboardLoginEnabled:
            false,

          studentId:
            auth.userId,

          applicationId:
            cleanString(
              student.applicationId,
            ),

          internshipId,

          planCode,

          amount:
            plan.price,

          amountInPaise:
            plan.priceInPaise,

          currency:
            "INR",

          razorpayOrderId:
            storedOrderId,

          razorpayPaymentId,

          receiptEmailSent:
            student.receiptEmailSent ===
            true,
        },
      );
    }

    if (
      existingPaymentStatus ===
        "paid" &&
      existingPaymentId &&
      existingPaymentId !==
        razorpayPaymentId
    ) {
      return errorResponse(
        "An internship payment has already been completed for this account.",
        "PAYMENT_ALREADY_COMPLETED",
        409,
      );
    }

    /* ========================================================================
       STUDENT SELECTED PLAN
    ======================================================================== */

    const storedStudentPlan =
      cleanString(
        student.internshipPlan,
      ).toLowerCase();

    if (
      storedStudentPlan !==
      plan.studentPlan
    ) {
      return errorResponse(
        "Selected internship duration does not match the payment order.",
        "STUDENT_PLAN_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       PAYMENT STATUS
    ======================================================================== */

    if (
      existingPaymentStatus !==
        "pending"
    ) {
      return errorResponse(
        "This payment is not currently pending verification.",
        "PAYMENT_NOT_PENDING",
        409,
      );
    }

    /* ========================================================================
       STUDENT PAYMENT AMOUNT
    ======================================================================== */

    const studentPaymentAmount =
      toFiniteNumber(
        student.paymentAmount,
      );

    if (
      studentPaymentAmount ===
        null ||
      Math.round(
        studentPaymentAmount *
          100,
      ) !==
        plan.priceInPaise
    ) {
      return errorResponse(
        "Student payment amount does not match the selected internship plan.",
        "STUDENT_PAYMENT_AMOUNT_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       INTERNSHIP
    ======================================================================== */

    const internship =
      (
        await Internship.findById(
          internshipId,
        )
          .select({
            _id: 1,

            title: 1,
            name: 1,

            domain: 1,
            assessmentDomain: 1,

            planCode: 1,

            duration: 1,
            durationMonths: 1,

            price: 1,
            priceInPaise: 1,

            currency: 1,

            status: 1,

            isPublic: 1,
            isSelectable: 1,

            endDate: 1,
          })
          .lean()
          .exec()
      ) as unknown as
        | InternshipSnapshot
        | null;

    if (!internship) {
      return errorResponse(
        "Selected internship plan was not found.",
        "INTERNSHIP_NOT_FOUND",
        404,
      );
    }

    /* ========================================================================
       INTERNSHIP STATUS
    ======================================================================== */

    if (
      normalizeStatus(
        internship.status,
      ) !== "active"
    ) {
      return errorResponse(
        "This internship plan is no longer active.",
        "INTERNSHIP_INACTIVE",
        409,
      );
    }

    if (
      internship.isPublic ===
      false
    ) {
      return errorResponse(
        "This internship plan is not publicly available.",
        "INTERNSHIP_NOT_PUBLIC",
        409,
      );
    }

    if (
      internship.isSelectable ===
      false
    ) {
      return errorResponse(
        "This internship plan is no longer selectable.",
        "INTERNSHIP_NOT_SELECTABLE",
        409,
      );
    }

    /* ========================================================================
       INTERNSHIP END DATE
    ======================================================================== */

    if (
      internship.endDate
    ) {
      const endDate =
        new Date(
          String(
            internship.endDate,
          ),
        );

      if (
        !Number.isNaN(
          endDate.getTime(),
        ) &&
        Date.now() >
          endDate.getTime()
      ) {
        return errorResponse(
          "This internship program has ended.",
          "INTERNSHIP_ENDED",
          409,
        );
      }
    }

    /* ========================================================================
       PLAN VALIDATION
    ======================================================================== */

    const storedPlanCode =
      normalizePlanCode(
        internship.planCode,
      );

    if (
      storedPlanCode !==
      planCode
    ) {
      return errorResponse(
        "Selected internship plan does not match the server record.",
        "PLAN_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       DURATION VALIDATION
    ======================================================================== */

    const storedDuration =
      cleanString(
        internship.duration,
      );

    const storedDurationMonths =
      toFiniteNumber(
        internship.durationMonths,
      );

    if (
      storedDuration !==
        plan.duration ||
      storedDurationMonths !==
        plan.durationMonths
    ) {
      return errorResponse(
        "Internship plan duration configuration is invalid.",
        "INVALID_PLAN_DURATION",
        503,
      );
    }

    /* ========================================================================
       DOMAIN VALIDATION
    ======================================================================== */

    if (
      !domainMatches(
        student.internshipTrack,
        internship.domain,
        internship.assessmentDomain,
      )
    ) {
      return errorResponse(
        "This internship does not belong to your approved internship domain.",
        "DOMAIN_MISMATCH",
        403,
      );
    }

    /* ========================================================================
       PRICE VALIDATION
    ======================================================================== */

    const storedPrice =
      toFiniteNumber(
        internship.price,
      );

    const storedPriceInPaise =
      toFiniteNumber(
        internship.priceInPaise,
      );

    if (
      storedPrice ===
        null ||
      storedPriceInPaise ===
        null ||
      Math.round(
        storedPrice * 100,
      ) !==
        plan.priceInPaise ||
      Math.round(
        storedPriceInPaise,
      ) !==
        plan.priceInPaise
    ) {
      return errorResponse(
        "Internship pricing configuration is inconsistent.",
        "PLAN_PRICE_MISMATCH",
        503,
      );
    }

    if (
      plan.priceInPaise <
      MIN_AMOUNT_IN_PAISE
    ) {
      return errorResponse(
        "Payment amount is below the supported payment gateway minimum.",
        "INVALID_PAYMENT_AMOUNT",
        503,
      );
    }

    /* ========================================================================
       CURRENCY
    ======================================================================== */

    const internshipCurrency =
      cleanString(
        internship.currency,
      ).toUpperCase();

    if (
      internshipCurrency !==
      "INR"
    ) {
      return errorResponse(
        "Only INR payments are supported.",
        "UNSUPPORTED_CURRENCY",
        503,
      );
    }

    if (
      cleanString(
        student.paymentCurrency,
      ).toUpperCase() !==
      "INR"
    ) {
      return errorResponse(
        "Student payment currency is invalid.",
        "STUDENT_PAYMENT_CURRENCY_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       RAZORPAY SERVER CONFIG
    ======================================================================== */

    let razorpayConfig: {
      keyId: string;
      keySecret: string;
    };

    try {
      razorpayConfig =
        getRazorpayConfig();
    } catch (error) {
      console.error(
        "[PAYMENT VERIFY] Razorpay configuration error.",
        error,
      );

      return errorResponse(
        "Payment gateway is not configured on the server.",
        "RAZORPAY_NOT_CONFIGURED",
        503,
      );
    }

    /* ========================================================================
       SIGNATURE VERIFICATION
    ======================================================================== */

    const expectedSignature =
      generateSignature(
        storedOrderId,
        razorpayPaymentId,
        razorpayConfig.keySecret,
      );

    if (
      !timingSafeEqualHex(
        expectedSignature,
        razorpaySignature,
      )
    ) {
      return errorResponse(
        "Payment signature verification failed.",
        "INVALID_PAYMENT_SIGNATURE",
        400,
      );
    }

    /* ========================================================================
       FETCH RAZORPAY ORDER
    ======================================================================== */

    let razorpayOrder:
      | RazorpayOrder
      | null = null;

    try {
      razorpayOrder =
        await razorpayRequest<RazorpayOrder>(
          `/orders/${encodeURIComponent(
            storedOrderId,
          )}`,
          {
            method:
              "GET",

            keyId:
              razorpayConfig.keyId,

            keySecret:
              razorpayConfig.keySecret,
          },
        );
    } catch (error) {
      console.error(
        "[PAYMENT VERIFY] Razorpay order lookup failed.",
        error,
      );

      return errorResponse(
        "Unable to verify the Razorpay order right now. Please try again.",
        "RAZORPAY_ORDER_LOOKUP_FAILED",
        502,
      );
    }

    /* ========================================================================
       ORDER ID
    ======================================================================== */

    if (
      cleanString(
        razorpayOrder.id,
      ) !==
      storedOrderId
    ) {
      return errorResponse(
        "Razorpay order ID verification failed.",
        "RAZORPAY_ORDER_ID_MISMATCH",
        502,
      );
    }

    /* ========================================================================
       ORDER AMOUNT
    ======================================================================== */

    const razorpayOrderAmount =
      Math.round(
        toFiniteNumber(
          razorpayOrder.amount,
        ) ?? 0,
      );

    if (
      razorpayOrderAmount !==
      plan.priceInPaise
    ) {
      return errorResponse(
        "Razorpay order amount does not match the internship price.",
        "RAZORPAY_ORDER_AMOUNT_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       ORDER CURRENCY
    ======================================================================== */

    const razorpayOrderCurrency =
      cleanString(
        razorpayOrder.currency,
      ).toUpperCase();

    if (
      razorpayOrderCurrency !==
      "INR"
    ) {
      return errorResponse(
        "Razorpay order currency is invalid.",
        "RAZORPAY_ORDER_CURRENCY_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       ORDER OWNERSHIP VIA NOTES
    ======================================================================== */

    const orderNotes =
      razorpayOrder.notes;

    if (
      orderNotes &&
      typeof orderNotes ===
        "object" &&
      !Array.isArray(
        orderNotes,
      )
    ) {
      const notes =
        orderNotes as Record<
          string,
          unknown
        >;

      const noteStudentId =
        cleanString(
          notes.studentId,
        );

      const noteInternshipId =
        cleanString(
          notes.internshipId,
        );

      const notePlanCode =
        normalizePlanCode(
          notes.planCode,
        );

      const publicStudentId =
        cleanString(
          student.studentId,
        );

      if (
        noteStudentId &&
        publicStudentId &&
        noteStudentId !==
          publicStudentId
      ) {
        return errorResponse(
          "Razorpay order ownership verification failed.",
          "RAZORPAY_ORDER_OWNER_MISMATCH",
          403,
        );
      }

      if (
        noteInternshipId &&
        noteInternshipId !==
          internshipId
      ) {
        return errorResponse(
          "Razorpay order internship verification failed.",
          "RAZORPAY_ORDER_INTERNSHIP_MISMATCH",
          409,
        );
      }

      if (
        notePlanCode &&
        notePlanCode !==
          planCode
      ) {
        return errorResponse(
          "Razorpay order plan verification failed.",
          "RAZORPAY_ORDER_PLAN_MISMATCH",
          409,
        );
      }
    }

    /* ========================================================================
       FETCH RAZORPAY PAYMENT
    ======================================================================== */

    let razorpayPayment:
      | RazorpayPayment
      | null = null;

    try {
      razorpayPayment =
        await razorpayRequest<RazorpayPayment>(
          `/payments/${encodeURIComponent(
            razorpayPaymentId,
          )}`,
          {
            method:
              "GET",

            keyId:
              razorpayConfig.keyId,

            keySecret:
              razorpayConfig.keySecret,
          },
        );
    } catch (error) {
      console.error(
        "[PAYMENT VERIFY] Razorpay payment lookup failed.",
        error,
      );

      return errorResponse(
        "Unable to verify the Razorpay payment right now. Please try again.",
        "RAZORPAY_PAYMENT_LOOKUP_FAILED",
        502,
      );
    }

    /* ========================================================================
       PAYMENT ID
    ======================================================================== */

    if (
      cleanString(
        razorpayPayment.id,
      ) !==
      razorpayPaymentId
    ) {
      return errorResponse(
        "Razorpay payment ID verification failed.",
        "RAZORPAY_PAYMENT_ID_MISMATCH",
        502,
      );
    }

    /* ========================================================================
       PAYMENT → ORDER
    ======================================================================== */

    if (
      cleanString(
        razorpayPayment.order_id,
      ) !==
      storedOrderId
    ) {
      return errorResponse(
        "This payment does not belong to the selected Razorpay order.",
        "PAYMENT_ORDER_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       PAYMENT AMOUNT
    ======================================================================== */

    const razorpayPaymentAmount =
      Math.round(
        toFiniteNumber(
          razorpayPayment.amount,
        ) ?? 0,
      );

    if (
      razorpayPaymentAmount !==
      plan.priceInPaise
    ) {
      return errorResponse(
        "Payment amount does not match the internship price.",
        "PAYMENT_AMOUNT_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       PAYMENT CURRENCY
    ======================================================================== */

    const razorpayPaymentCurrency =
      cleanString(
        razorpayPayment.currency,
      ).toUpperCase();

    if (
      razorpayPaymentCurrency !==
      "INR"
    ) {
      return errorResponse(
        "Payment currency does not match INR.",
        "PAYMENT_CURRENCY_MISMATCH",
        409,
      );
    }

    /* ========================================================================
       PAYMENT STATUS
    ======================================================================== */

    let paymentStatus =
      normalizeStatus(
        razorpayPayment.status,
      );

    let captured =
      razorpayPayment.captured ===
      true;

    /* ========================================================================
       FAILED
    ======================================================================== */

    if (
      paymentStatus ===
      "failed"
    ) {
      return errorResponse(
        "Razorpay reports that this payment failed.",
        "PAYMENT_FAILED",
        402,
      );
    }

    /* ========================================================================
       REFUNDED
    ======================================================================== */

    if (
      paymentStatus ===
      "refunded"
    ) {
      return errorResponse(
        "This payment has been refunded.",
        "PAYMENT_REFUNDED",
        409,
      );
    }

    /* ========================================================================
       CAPTURE AUTHORIZED PAYMENT
    ======================================================================== */

    if (
      paymentStatus ===
        "authorized" &&
      !captured
    ) {
      try {
        await razorpayRequest<RazorpayPayment>(
          `/payments/${encodeURIComponent(
            razorpayPaymentId,
          )}/capture`,
          {
            method:
              "POST",

            keyId:
              razorpayConfig.keyId,

            keySecret:
              razorpayConfig.keySecret,

            body: {
              amount:
                plan.priceInPaise,

              currency:
                "INR",
            },
          },
        );
      } catch (captureError) {
        /*
         * Capture may race with an automatic-capture
         * configuration. Therefore we re-fetch before
         * deciding that payment failed.
         */
        console.warn(
          "[PAYMENT VERIFY] Payment capture returned an error; rechecking payment state.",
          captureError,
        );
      }

      try {
        razorpayPayment =
          await razorpayRequest<RazorpayPayment>(
            `/payments/${encodeURIComponent(
              razorpayPaymentId,
            )}`,
            {
              method:
                "GET",

              keyId:
                razorpayConfig.keyId,

              keySecret:
                razorpayConfig.keySecret,
            },
          );

        paymentStatus =
          normalizeStatus(
            razorpayPayment.status,
          );

        captured =
          razorpayPayment.captured ===
          true;
      } catch (error) {
        console.error(
          "[PAYMENT VERIFY] Final Razorpay payment lookup failed.",
          error,
        );

        return errorResponse(
          "Payment is being processed, but final verification is temporarily unavailable. Please try again.",
          "PAYMENT_FINAL_STATE_UNAVAILABLE",
          503,
        );
      }
    }

    /* ========================================================================
       FINAL CAPTURE CHECK
    ======================================================================== */

    if (
      paymentStatus !==
        "captured" ||
      captured !== true
    ) {
      if (
        paymentStatus ===
        "authorized"
      ) {
        return errorResponse(
          "Payment is authorized but has not been captured yet. Please try again shortly.",
          "PAYMENT_NOT_CAPTURED",
          409,
        );
      }

      return errorResponse(
        "Payment has not reached the captured state.",
        "PAYMENT_NOT_CAPTURED",
        409,
      );
    }

    /* ========================================================================
       FINAL PAYMENT VALIDATION
    ======================================================================== */

    const finalPaymentId =
      cleanString(
        razorpayPayment.id,
      );

    const finalPaymentOrderId =
      cleanString(
        razorpayPayment.order_id,
      );

    const finalPaymentAmount =
      Math.round(
        toFiniteNumber(
          razorpayPayment.amount,
        ) ?? 0,
      );

    const finalPaymentCurrency =
      cleanString(
        razorpayPayment.currency,
      ).toUpperCase();

    if (
      finalPaymentId !==
        razorpayPaymentId ||
      finalPaymentOrderId !==
        storedOrderId ||
      finalPaymentAmount !==
        plan.priceInPaise ||
      finalPaymentCurrency !==
        "INR"
    ) {
      return errorResponse(
        "Final payment verification failed.",
        "FINAL_PAYMENT_VALIDATION_FAILED",
        409,
      );
    }

    /* ========================================================================
       FINAL SERVICE-LEVEL COMMIT
    ======================================================================== */

    /*
     * IMPORTANT:
     *
     * We intentionally do NOT directly mutate the Student document here.
     *
     * student.service.ts owns the authoritative lifecycle mutation.
     *
     * recordVerifiedPayment() validates:
     * - student
     * - order
     * - amount
     * - currency
     * - idempotency
     *
     * and moves the student to Student Operations review.
     */
    const verifiedResult =
      await recordVerifiedPayment(
        {
          studentId:
            auth.userId,

          razorpayOrderId:
            storedOrderId,

          razorpayPaymentId:
            razorpayPaymentId,

          razorpaySignature:
            razorpaySignature,

          amount:
            plan.price,

          currency:
            "INR",
        },
      );

    if (
      !verifiedResult.success
    ) {
      console.error(
        "[PAYMENT VERIFY] Student payment commit rejected.",
        {
          studentId:
            auth.userId,

          orderId:
            storedOrderId,

          paymentId:
            razorpayPaymentId,

          code:
            verifiedResult.code,
        },
      );

      return errorResponse(
        verifiedResult.message ||
          "Verified payment could not be committed.",
        verifiedResult.code ||
          "PAYMENT_COMMIT_FAILED",
        409,
      );
    }

    /* ========================================================================
       APPLICATION SYNCHRONIZATION
    ======================================================================== */

    const applicationId =
      cleanString(
        student.applicationId,
      );

    if (
      applicationId
    ) {
      try {
        await Application.updateOne(
          {
            applicationId,
          },
          {
            $set: {
              paymentStatus:
                "paid",

              paymentId:
                razorpayPaymentId,

              selectedDuration:
                plan.duration,
            },
          },
        ).exec();
      } catch (applicationError) {
        /*
         * Payment is already committed.
         * Application synchronization is secondary.
         */
        console.error(
          "[PAYMENT VERIFY] Application synchronization failed.",
          applicationError,
        );
      }
    }

    /* ========================================================================
       PAYMENT RECEIPT
    ======================================================================== */

    let receiptEmailSent =
      false;

    let receiptEmailConfigured =
      false;

    let receiptEmailErrorCode:
      | string
      | null =
      null;

    const studentEmail =
      cleanString(
        student.email,
      ).toLowerCase();

    const studentName =
      cleanString(
        student.fullName,
      ) ||
      "Student";

    if (
      studentEmail
    ) {
      try {
        const emailResult =
          await sendPaymentReceiptEmail(
            {
              email:
                studentEmail,

              name:
                studentName,

              studentId:
                cleanString(
                  student.studentId,
                ) ||
                auth.userId,

              plan:
                plan.duration,

              amount:
                plan.price,

              currency:
                "INR",

              paymentId:
                razorpayPaymentId,

              orderId:
                storedOrderId,

              paymentDate:
                new Date(),

              internship:
                getInternshipTitle(
                  internship,
                ),
            },
          );

        receiptEmailConfigured =
          true;

        receiptEmailSent =
          Boolean(
            emailResult,
          );

        if (
          !receiptEmailSent
        ) {
          receiptEmailErrorCode =
            "RECEIPT_EMAIL_NOT_SENT";
        }
      } catch (emailError) {
        /*
         * DO NOT rollback payment.
         *
         * Payment verification is authoritative.
         * Email delivery is a secondary operation.
         */
        console.error(
          "[PAYMENT VERIFY] Payment receipt email failed.",
          emailError,
        );

        receiptEmailErrorCode =
          "RECEIPT_EMAIL_SEND_FAILED";
      }
    } else {
      receiptEmailErrorCode =
        "STUDENT_EMAIL_MISSING";
    }

    /* ========================================================================
       MARK RECEIPT SENT
    ======================================================================== */

    if (
      receiptEmailSent
    ) {
      try {
        await Student.updateOne(
          {
            _id:
              new mongoose.Types.ObjectId(
                auth.userId,
              ),

            paymentStatus:
              "paid",

            razorpayPaymentId:
              razorpayPaymentId,
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
      } catch (receiptStateError) {
        /*
         * Receipt was sent, but receipt state could not be saved.
         * Do not change payment state.
         */
        console.error(
          "[PAYMENT VERIFY] Receipt state update failed.",
          receiptStateError,
        );
      }
    }

    /* ========================================================================
       FINAL RESPONSE
    ======================================================================== */

    return successResponse(
      receiptEmailSent
        ? "Payment verified successfully. Your payment receipt has been sent to your registered email. Your account is now waiting for Student Operations approval."
        : "Payment verified successfully. Your account is now waiting for Student Operations approval. The payment receipt could not be sent at this time.",
      {
        paymentStatus:
          "paid",

        verified:
          true,

        internshipStatus:
          "approved",

        studentOpsApprovalStatus:
          "pending",

        studentOpsStatus:
          "pending-review",

        dashboardStatus:
          "locked",

        dashboardLoginEnabled:
          false,

        studentId:
          auth.userId,

        applicationId,

        internshipId,

        planCode,

        title:
          getInternshipTitle(
            internship,
          ),

        duration:
          plan.duration,

        durationMonths:
          plan.durationMonths,

        durationDays:
          plan.durationDays,

        amount:
          plan.price,

        amountInPaise:
          plan.priceInPaise,

        currency:
          "INR",

        razorpayOrderId:
          storedOrderId,

        razorpayPaymentId,

        verifiedAt:
          new Date().toISOString(),

        receiptEmailSent,

        receiptEmailConfigured,

        receiptEmailErrorCode,
      },
    );
  } catch (error) {
    console.error(
      "[POST /api/payment/verify] Unexpected error.",
      error,
    );

    return errorResponse(
      "Unable to verify the payment right now. Please try again.",
      "PAYMENT_VERIFICATION_INTERNAL_ERROR",
      500,
    );
  }
}

/* ============================================================================
   METHOD HANDLERS
============================================================================ */

function methodNotAllowed():
  NextResponse {
  return errorResponse(
    "This HTTP method is not supported for this payment verification endpoint.",
    "METHOD_NOT_ALLOWED",
    405,
    {
      allow:
        "POST, OPTIONS",
    },
  );
}

export async function GET():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PUT():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PATCH():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function DELETE():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function OPTIONS():
  Promise<NextResponse> {
  return new NextResponse(
    null,
    {
      status: 204,

      headers: {
        Allow:
          "POST, OPTIONS",

        "Access-Control-Allow-Methods":
          "POST, OPTIONS",

        "Access-Control-Allow-Headers":
          "Content-Type",

        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export async function HEAD():
  Promise<NextResponse> {
  return new NextResponse(
    null,
    {
      status: 405,

      headers: {
        Allow:
          "POST, OPTIONS",

        "Cache-Control":
          "private, no-store, no-cache, must-revalidate",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}