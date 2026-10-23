import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import Internship from "@/models/Internship";

import {
  AUTH_COOKIE_NAME,
  STUDENT_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";

import {
  markPaymentPending,
} from "@/services/student.service";

/* ============================================================================
   CYBERNET CAREERS
   PAYMENT - CREATE RAZORPAY ORDER API

   POST
   /api/payment/create-order

   RESPONSIBILITY

   Student authentication
          ↓
   Application approval
          ↓
   Assessment passed
          ↓
   Internship eligibility
          ↓
   Internship validation
          ↓
   Server-authoritative plan validation
          ↓
   Server-authoritative price validation
          ↓
   Razorpay order creation
          ↓
   Razorpay response validation
          ↓
   StudentService.markPaymentPending()
          ↓
   Return PUBLIC checkout data

   IMPORTANT

   - This endpoint NEVER trusts client price.
   - This endpoint NEVER accepts client studentId.
   - Student identity comes from the authenticated session.
   - Razorpay secret NEVER reaches the browser.
   - Order creation is NOT payment success.
   - Payment becomes "paid" ONLY after /api/payment/verify.
   - Student dashboard is NOT activated here.
   - Student Operations approval is NOT performed here.

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

const MAX_RECEIPT_LENGTH =
  40;

const MIN_RAZORPAY_AMOUNT_IN_PAISE =
  100;

/*
 * Server-authoritative internship pricing.
 *
 * NEVER accept amount from frontend.
 */
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

type CreateOrderBody = {
  internshipId?: unknown;
  planCode?: unknown;
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

type RazorpayErrorPayload = {
  error?: {
    code?: unknown;
    description?: unknown;
    field?: unknown;
    source?: unknown;
    step?: unknown;
    reason?: unknown;
    metadata?: unknown;
  };
};

type RazorpayNotes =
  Record<string, string>;

/* ============================================================================
   DATABASE TYPES
============================================================================ */

type StudentRecord = {
  _id: unknown;

  studentId?: unknown;
  applicationId?: unknown;

  fullName?: unknown;
  name?: unknown;
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

  paymentCompletedAt?: unknown;

  receiptEmailSent?: unknown;
  receiptEmailSentAt?: unknown;

  studentOpsStatus?: unknown;
  studentOpsApprovalStatus?: unknown;

  dashboardStatus?: unknown;
  dashboardLoginEnabled?: unknown;
};

type InternshipRecord = {
  _id: unknown;

  internshipId?: unknown;

  title?: unknown;
  name?: unknown;

  description?: unknown;

  domain?: unknown;
  assessmentDomain?: unknown;

  assessmentRequired?: unknown;
  applicationRequired?: unknown;

  planCode?: unknown;

  duration?: unknown;
  durationMonths?: unknown;

  price?: unknown;
  priceInPaise?: unknown;

  currency?: unknown;

  status?: unknown;

  isPublic?: unknown;
  isSelectable?: unknown;

  startDate?: unknown;
  endDate?: unknown;

  maxStudents?: unknown;
  enrolledStudents?: unknown;

  sortOrder?: unknown;
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

        "Content-Type":
          "application/json; charset=utf-8",

        "X-Content-Type-Options":
          "nosniff",

        "X-Frame-Options":
          "DENY",

        "Cross-Origin-Resource-Policy":
          "same-origin",

        "Referrer-Policy":
          "same-origin",

        "Permissions-Policy":
          "camera=(), microphone=(), geolocation=()",

        Allow:
          "POST, OPTIONS, HEAD",
      },
    },
  );
}

/* ============================================================================
   BASIC HELPERS
============================================================================ */

function cleanString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toNumber(
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
    const parsed =
      Number(value);

    return Number.isFinite(parsed)
      ? parsed
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

function parsePlanCode(
  value: unknown,
): PlanCode | null {
  const normalized =
    cleanString(value)
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "ONE_MONTH":
    case "1_MONTH":
    case "1M":
      return "ONE_MONTH";

    case "THREE_MONTHS":
    case "3_MONTHS":
    case "3M":
      return "THREE_MONTHS";

    case "SIX_MONTHS":
    case "6_MONTHS":
    case "6M":
      return "SIX_MONTHS";

    default:
      return null;
  }
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

  if (!keyId) {
    throw new Error(
      "RAZORPAY_KEY_ID is missing.",
    );
  }

  if (!keySecret) {
    throw new Error(
      "RAZORPAY_KEY_SECRET is missing.",
    );
  }

  return {
    keyId,
    keySecret,
  };
}

/* ============================================================================
   RAZORPAY AUTH
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
   RAZORPAY ERROR EXTRACTION
============================================================================ */

function getRazorpayError(
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
    payload as RazorpayErrorPayload;

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

    body?: unknown;
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
      options.body !== undefined
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
      const description =
        getRazorpayError(
          payload,
        ) ||
        `Razorpay API returned HTTP ${response.status}.`;

      /*
       * IMPORTANT:
       *
       * Never log keyId/keySecret,
       * Authorization header,
       * full request body,
       * customer credentials.
       */
      console.error(
        "[PAYMENT CREATE ORDER] Razorpay API error.",
        {
          path,
          status:
            response.status,
          description,
        },
      );

      const error =
        new Error(
          description,
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
      error instanceof Error &&
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        "Payment gateway request timed out.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================================
   RAZORPAY RESPONSE HELPERS
============================================================================ */

function getOrderId(
  order: RazorpayOrder,
): string {
  return cleanString(
    order.id,
  );
}

function getOrderAmount(
  order: RazorpayOrder,
): number {
  return Math.round(
    toNumber(
      order.amount,
    ) ?? 0,
  );
}

function getOrderCurrency(
  order: RazorpayOrder,
): string {
  return cleanString(
    order.currency,
  ).toUpperCase();
}

function getOrderStatus(
  order: RazorpayOrder,
): string {
  return normalizeStatus(
    order.status,
  );
}

function getOrderNotes(
  order: RazorpayOrder,
): RazorpayNotes {
  if (
    !order.notes ||
    typeof order.notes !==
      "object" ||
    Array.isArray(
      order.notes,
    )
  ) {
    return {};
  }

  const notes =
    order.notes as Record<
      string,
      unknown
    >;

  const result: RazorpayNotes =
    {};

  for (
    const [key, value]
    of Object.entries(
      notes,
    )
  ) {
    const stringValue =
      cleanString(value);

    if (stringValue) {
      result[key] =
        stringValue;
    }
  }

  return result;
}

/* ============================================================================
   ORDER OWNERSHIP
============================================================================ */

function isOrderOwnedByStudent(
  order: RazorpayOrder,
  studentId: string,
  internshipId: string,
  planCode: PlanCode,
): boolean {
  const notes =
    getOrderNotes(order);

  return (
    notes.studentId ===
      studentId &&
    notes.internshipId ===
      internshipId &&
    parsePlanCode(
      notes.planCode,
    ) === planCode
  );
}

/* ============================================================================
   RECEIPT
============================================================================ */

function generateReceipt(
  studentId: string,
  planCode: PlanCode,
): string {
  const safeStudent =
    studentId
      .replace(
        /[^a-zA-Z0-9]/g,
        "",
      )
      .slice(-10);

  const timestamp =
    Date.now().toString(36);

  const random =
    crypto
      .randomBytes(5)
      .toString("hex");

  return (
    `CN-${safeStudent}-${planCode}-${timestamp}-${random}`
  ).slice(
    0,
    MAX_RECEIPT_LENGTH,
  );
}

/* ============================================================================
   REQUEST ORIGIN
============================================================================ */

function isTrustedRequestOrigin(
  request: NextRequest,
): boolean {
  const origin =
    request.headers
      .get("origin")
      ?.trim();

  /*
   * Browsers normally send Origin for POST requests. Some legitimate
   * same-origin clients omit it, so use Fetch Metadata as a fallback.
   * Explicit cross-site requests are never accepted.
   */
  if (!origin) {
    const fetchSite = request.headers
      .get("sec-fetch-site")
      ?.trim()
      .toLowerCase();

    return fetchSite !== "cross-site";
  }

  try {
    const originUrl =
      new URL(origin);

    const requestUrl =
      new URL(
        request.url,
      );

    return (
      originUrl.protocol ===
        requestUrl.protocol &&
      originUrl.host ===
        requestUrl.host
    );
  } catch {
    return false;
  }
}

/* ============================================================================
   AUTHENTICATED STUDENT
============================================================================ */

async function getAuthenticatedStudent(
  request: NextRequest,
): Promise<{
  userId: string;
  role: string;
} | null> {
  const dedicatedToken =
    request.cookies.get(
      STUDENT_AUTH_COOKIE_NAME,
    )?.value?.trim() || "";

  const legacyToken =
    request.cookies.get(
      AUTH_COOKIE_NAME,
    )?.value?.trim() || "";

  const candidates = [
    dedicatedToken,
    legacyToken,
  ].filter(Boolean);

  for (
    const token of candidates
  ) {
    try {
      const payload =
        await verifyAccessToken(
          token,
        );

      if (!payload) {
        continue;
      }

      const userId =
        cleanString(
          payload.userId,
        );

      const role =
        cleanString(
          payload.role,
        ).toLowerCase();

      const sessionType =
        cleanString(
          payload.sessionType,
        ).toLowerCase();

      if (
        !userId ||
        !/^[a-f\\d]{24}$/i.test(userId) ||
        role !== "student"
      ) {
        continue;
      }

      /*
       * Only the normal Student portal
       * may create a payment checkout.
       */
      if (
        sessionType ===
          "admin" ||
        sessionType ===
          "student-dashboard"
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
      };
    } catch {
      /*
       * Ignore invalid token candidate.
       * Never expose JWT parsing details.
       */
      continue;
    }
  }

  return null;
}

/* ============================================================================
   BODY LIMIT
============================================================================ */

class RequestBodyTooLargeError
  extends Error {
  constructor() {
    super(
      "Request body is too large.",
    );

    this.name =
      "RequestBodyTooLargeError";
  }
}

class InvalidJsonBodyError
  extends Error {
  constructor() {
    super(
      "Invalid JSON request body.",
    );

    this.name =
      "InvalidJsonBodyError";
  }
}

/* ============================================================================
   BODY PARSER
============================================================================ */

async function parseRequestBody(
  request: NextRequest,
): Promise<CreateOrderBody | null> {
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
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) {
    return null;
  }

  const reader =
    request.body.getReader();

  const decoder =
    new TextDecoder("utf-8", { fatal: true });

  const chunks: Uint8Array[] =
    [];

  let totalBytes = 0;

  try {
    while (true) {
      const {
        done,
        value,
      } =
        await reader.read();

      if (done) {
        break;
      }

      if (value) {
        totalBytes +=
          value.byteLength;

        if (
          totalBytes >
          MAX_BODY_BYTES
        ) {
          throw new RequestBodyTooLargeError();
        }

        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const bytes =
    new Uint8Array(
      totalBytes,
    );

  let offset = 0;

  for (
    const chunk of chunks
  ) {
    bytes.set(
      chunk,
      offset,
    );

    offset +=
      chunk.byteLength;
  }

  let raw: string;

  try {
    raw = decoder.decode(bytes);
  } catch {
    throw new InvalidJsonBodyError();
  }

  if (!raw.trim()) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(raw);
  } catch {
    throw new InvalidJsonBodyError();
  }

  if (
    !parsed ||
    typeof parsed !==
      "object" ||
    Array.isArray(
      parsed,
    )
  ) {
    return null;
  }

  return parsed as CreateOrderBody;
}

/* ============================================================================
   INTERNSHIP TITLE
============================================================================ */

function getInternshipTitle(
  internship: InternshipRecord,
): string {
  return (
    cleanString(
      internship.title,
    ) ||
    cleanString(
      internship.name,
    ) ||
    "Internship Program"
  );
}

/* ============================================================================
   POST
============================================================================ */

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    /* ========================================================================
       ORIGIN SECURITY
    ======================================================================== */

    if (
      !isTrustedRequestOrigin(
        request,
      )
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Cross-origin payment requests are not allowed.",

          code:
            "UNTRUSTED_ORIGIN",
        },
        403,
      );
    }

    /* ========================================================================
       AUTHENTICATION
    ======================================================================== */

    const auth =
      await getAuthenticatedStudent(
        request,
      );

    if (!auth) {
      return jsonResponse(
        {
          success: false,

          message:
            "Student login is required.",

          code:
            "UNAUTHORIZED",
        },
        401,
      );
    }

    /* ========================================================================
       REQUEST BODY
    ======================================================================== */

    let body:
      | CreateOrderBody
      | null;

    try {
      body =
        await parseRequestBody(
          request,
        );
    } catch (error) {
      if (
        error instanceof
        RequestBodyTooLargeError
      ) {
        return jsonResponse(
          {
            success: false,

            message:
              error.message,

            code:
              "REQUEST_TOO_LARGE",
          },
          413,
        );
      }

      if (
        error instanceof
        InvalidJsonBodyError
      ) {
        return jsonResponse(
          {
            success: false,

            message:
              error.message,

            code:
              "INVALID_JSON",
          },
          400,
        );
      }

      return jsonResponse(
        {
          success: false,

          message:
            "Unable to read the request body.",

          code:
            "REQUEST_BODY_READ_FAILED",
        },
        400,
      );
    }

    if (!body) {
      return jsonResponse(
        {
          success: false,

          message:
            "Request body must be a JSON object.",

          code:
            "INVALID_REQUEST_BODY",
        },
        400,
      );
    }

    /* ========================================================================
       INPUT
    ======================================================================== */

    const internshipId =
      cleanString(
        body.internshipId,
      );

    const planCode =
      parsePlanCode(
        body.planCode,
      );

    if (!internshipId) {
      return jsonResponse(
        {
          success: false,

          message:
            "Internship ID is required.",

          code:
            "INTERNSHIP_ID_REQUIRED",
        },
        400,
      );
    }

    /*
     * Mongo ObjectId validation without
     * importing mongoose solely for this.
     */
    if (
      !/^[a-f\d]{24}$/i.test(
        internshipId,
      )
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Invalid internship ID.",

          code:
            "INVALID_INTERNSHIP_ID",
        },
        400,
      );
    }

    if (!planCode) {
      return jsonResponse(
        {
          success: false,

          message:
            "Invalid internship plan.",

          code:
            "INVALID_PLAN",
        },
        400,
      );
    }

    const plan =
      PLAN_CONFIG[
        planCode
      ];

    /* ========================================================================
       SERVER DATABASE
    ======================================================================== */

    try {
      await connectDB();
    } catch (error) {
      console.error(
        "[PAYMENT CREATE ORDER] Database connection failed.",
        error,
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Database is temporarily unavailable. Please try again.",

          code:
            "DATABASE_UNAVAILABLE",
        },
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
        | StudentRecord
        | null;

    if (!student) {
      return jsonResponse(
        {
          success: false,

          message:
            "Student account was not found.",

          code:
            "STUDENT_NOT_FOUND",
        },
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
      return jsonResponse(
        {
          success: false,

          message:
            "Your student account is disabled.",

          code:
            "STUDENT_ACCOUNT_DISABLED",
        },
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
        return jsonResponse(
          {
            success: false,

            message:
              "Your student account is temporarily locked.",

            code:
              "STUDENT_ACCOUNT_LOCKED",
          },
          423,
        );
      }
    }

    /* ========================================================================
       EMAIL VERIFICATION
    ======================================================================== */

    if (
      student.emailVerified !==
      true
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Please verify your email before making a payment.",

          code:
            "EMAIL_NOT_VERIFIED",
        },
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
      return jsonResponse(
        {
          success: false,

          message:
            "Your application has not been approved yet.",

          code:
            "APPLICATION_NOT_APPROVED",
        },
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
      return jsonResponse(
        {
          success: false,

          message:
            "You must pass the assessment before selecting an internship plan.",

          code:
            "ASSESSMENT_NOT_PASSED",
        },
        403,
      );
    }

    if (
      normalizeStatus(
        student.resultStatus,
      ) !== "passed"
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Your assessment result has not been confirmed as passed.",

          code:
            "ASSESSMENT_RESULT_NOT_PASSED",
        },
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
      return jsonResponse(
        {
          success: false,

          message:
            "Internship selection is not available for your account.",

          code:
            "INTERNSHIP_SELECTION_NOT_ALLOWED",
        },
        403,
      );
    }

    /* ========================================================================
       PAYMENT STATUS
    ======================================================================== */

    const existingPaymentStatus =
      normalizeStatus(
        student.paymentStatus,
      );

    if (
      existingPaymentStatus ===
      "paid"
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Your internship payment has already been completed.",

          code:
            "PAYMENT_ALREADY_COMPLETED",

          data: {
            paymentStatus:
              "paid",

            razorpayPaymentId:
              cleanString(
                student.razorpayPaymentId,
              ),

            dashboardStatus:
              cleanString(
                student.dashboardStatus,
              ),
          },
        },
        409,
      );
    }

    if (
      existingPaymentStatus ===
      "refunded"
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Your previous internship payment was refunded. Please contact support.",

          code:
            "PAYMENT_REFUNDED",
        },
        409,
      );
    }

    /* ========================================================================
       STUDENT SELECTED PLAN VALIDATION
    ======================================================================== */

    const selectedStudentPlan =
      cleanString(
        student.internshipPlan,
      ).toLowerCase();

    if (
      selectedStudentPlan !==
      plan.studentPlan
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Selected payment plan does not match your internship selection.",

          code:
            "STUDENT_PLAN_MISMATCH",
        },
        409,
      );
    }

    if (
      normalizeStatus(
        student.internshipStatus,
      ) !==
      "payment-pending"
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Your internship is not currently ready for payment.",

          code:
            "PAYMENT_NOT_READY",
        },
        409,
      );
    }

    /* ========================================================================
       LOAD INTERNSHIP
    ======================================================================== */

    const internship =
      (
        await Internship.findById(
          internshipId,
        )
          .select({
            _id: 1,

            internshipId: 1,

            title: 1,
            name: 1,

            description: 1,

            domain: 1,
            assessmentDomain: 1,

            assessmentRequired: 1,
            applicationRequired: 1,

            planCode: 1,

            duration: 1,
            durationMonths: 1,

            price: 1,
            priceInPaise: 1,

            currency: 1,

            status: 1,

            isPublic: 1,
            isSelectable: 1,

            startDate: 1,
            endDate: 1,

            maxStudents: 1,
            enrolledStudents: 1,

            sortOrder: 1,
          })
          .lean()
          .exec()
      ) as unknown as
        | InternshipRecord
        | null;

    if (!internship) {
      return jsonResponse(
        {
          success: false,

          message:
            "Selected internship plan was not found.",

          code:
            "INTERNSHIP_NOT_FOUND",
        },
        404,
      );
    }

    /* ========================================================================
       INTERNSHIP AVAILABILITY
    ======================================================================== */

    if (
      normalizeStatus(
        internship.status,
      ) !== "active"
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "This internship plan is not currently active.",

          code:
            "INTERNSHIP_INACTIVE",
        },
        409,
      );
    }

    /*
     * undefined is allowed for legacy records.
     * Explicit false blocks checkout.
     */
    if (
      internship.isPublic ===
      false
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "This internship plan is not publicly available.",

          code:
            "INTERNSHIP_NOT_PUBLIC",
        },
        409,
      );
    }

    if (
      internship.isSelectable ===
      false
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "This internship plan is not currently selectable.",

          code:
            "INTERNSHIP_NOT_SELECTABLE",
        },
        409,
      );
    }

    /* ========================================================================
       END DATE
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
        return jsonResponse(
          {
            success: false,

            message:
              "This internship program has ended.",

            code:
              "INTERNSHIP_ENDED",
          },
          409,
        );
      }
    }

    /* ========================================================================
       SERVER PLAN VALIDATION
    ======================================================================== */

    const databasePlanCode =
      parsePlanCode(
        internship.planCode,
      );

    if (
      databasePlanCode !==
      planCode
    ) {
      console.error(
        "[PAYMENT CREATE ORDER] Internship plan mismatch.",
        {
          internshipId,
          requestedPlan:
            planCode,
          databasePlan:
            databasePlanCode,
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Selected plan does not match the server internship record.",

          code:
            "PLAN_MISMATCH",
        },
        409,
      );
    }

    /* ========================================================================
       DURATION VALIDATION
    ======================================================================== */

    const databaseDuration =
      cleanString(
        internship.duration,
      );

    const databaseDurationMonths =
      toNumber(
        internship.durationMonths,
      );

    if (
      databaseDuration !==
        plan.duration ||
      databaseDurationMonths !==
        plan.durationMonths
    ) {
      console.error(
        "[PAYMENT CREATE ORDER] Invalid internship duration configuration.",
        {
          internshipId,
          planCode,
          databaseDuration,
          databaseDurationMonths,
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Internship plan duration configuration is invalid.",

          code:
            "INVALID_PLAN_DURATION",
        },
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
      console.error(
        "[PAYMENT CREATE ORDER] Domain mismatch.",
        {
          studentId:
            auth.userId,

          studentDomain:
            cleanString(
              student.internshipTrack,
            ),

          internshipDomain:
            cleanString(
              internship.domain,
            ),

          assessmentDomain:
            cleanString(
              internship.assessmentDomain,
            ),
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            "This internship plan does not belong to your approved internship domain.",

          code:
            "DOMAIN_MISMATCH",
        },
        403,
      );
    }

    /* ========================================================================
       PRICE VALIDATION
    ======================================================================== */

    const databasePrice =
      toNumber(
        internship.price,
      );

    const databasePriceInPaise =
      toNumber(
        internship.priceInPaise,
      );

    if (
      databasePrice ===
        null ||
      databasePriceInPaise ===
        null
    ) {
      console.error(
        "[PAYMENT CREATE ORDER] Missing internship pricing.",
        {
          internshipId,
          planCode,
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Internship payment configuration is invalid.",

          code:
            "INVALID_PLAN_PRICING",
        },
        503,
      );
    }

    if (
      Math.round(
        databasePrice * 100,
      ) !==
        plan.priceInPaise ||
      Math.round(
        databasePriceInPaise,
      ) !==
        plan.priceInPaise
    ) {
      console.error(
        "[PAYMENT CREATE ORDER] Price mismatch.",
        {
          internshipId,
          planCode,

          databasePrice,
          databasePriceInPaise,

          expectedPrice:
            plan.price,

          expectedPriceInPaise:
            plan.priceInPaise,
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Internship pricing configuration is inconsistent. Please contact support.",

          code:
            "PLAN_PRICE_MISMATCH",
        },
        503,
      );
    }

    /* ========================================================================
       MINIMUM RAZORPAY AMOUNT
    ======================================================================== */

    if (
      plan.priceInPaise <
      MIN_RAZORPAY_AMOUNT_IN_PAISE
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Payment amount is below the Razorpay minimum amount.",

          code:
            "AMOUNT_BELOW_GATEWAY_MINIMUM",
        },
        503,
      );
    }

    /* ========================================================================
       CURRENCY
    ======================================================================== */

    const currency =
      cleanString(
        internship.currency,
      ).toUpperCase();

    if (
      currency !==
      "INR"
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "Only INR payments are supported.",

          code:
            "UNSUPPORTED_CURRENCY",
        },
        503,
      );
    }

    /* ========================================================================
       CAPACITY
    ======================================================================== */

    const maxStudents =
      toNumber(
        internship.maxStudents,
      ) ?? 0;

    const enrolledStudents =
      toNumber(
        internship.enrolledStudents,
      ) ?? 0;

    if (
      maxStudents > 0 &&
      enrolledStudents >=
        maxStudents
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "This internship has reached its maximum capacity.",

          code:
            "INTERNSHIP_CAPACITY_FULL",
        },
        409,
      );
    }

    /* ========================================================================
       RAZORPAY CONFIGURATION
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
        "[PAYMENT CREATE ORDER] Razorpay configuration error.",
        error,
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Payment gateway is not configured on the server.",

          code:
            "RAZORPAY_NOT_CONFIGURED",
        },
        503,
      );
    }

    /* ========================================================================
       STUDENT IDENTIFIERS
    ======================================================================== */

    const databaseStudentId =
      String(
        student._id,
      );

    const publicStudentId =
      cleanString(
        student.studentId,
      ) ||
      databaseStudentId;

    const applicationId =
      cleanString(
        student.applicationId,
      );

    /* ========================================================================
       EXISTING ORDER REUSE
    ======================================================================== */

    let razorpayOrder:
      | RazorpayOrder
      | null = null;

    const existingOrderId =
      cleanString(
        student.razorpayOrderId,
      );

    if (
      existingOrderId &&
      existingPaymentStatus ===
        "pending"
    ) {
      try {
        const existingOrder =
          await razorpayRequest<RazorpayOrder>(
            `/orders/${encodeURIComponent(
              existingOrderId,
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

        const existingId =
          getOrderId(
            existingOrder,
          );

        const existingAmount =
          getOrderAmount(
            existingOrder,
          );

        const existingCurrency =
          getOrderCurrency(
            existingOrder,
          );

        const existingStatus =
          getOrderStatus(
            existingOrder,
          );

        const owned =
          isOrderOwnedByStudent(
            existingOrder,
            publicStudentId,
            internshipId,
            planCode,
          );

        /*
         * Reuse only a valid active order.
         */
        if (
          existingId ===
            existingOrderId &&
          existingAmount ===
            plan.priceInPaise &&
          existingCurrency ===
            currency &&
          owned &&
          (
            existingStatus ===
              "created" ||
            existingStatus ===
              "attempted"
          )
        ) {
          razorpayOrder =
            existingOrder;
        } else if (
          existingId ===
            existingOrderId &&
          existingStatus ===
            "paid"
        ) {
          /*
           * Do NOT create another order.
           * The verification endpoint must finish
           * the payment lifecycle.
           */
          return jsonResponse(
            {
              success: false,

              message:
                "This payment order has already been paid. Please complete payment verification.",

              code:
                "ORDER_ALREADY_PAID",

              data: {
                orderId:
                  existingOrderId,

                razorpayOrderId:
                  existingOrderId,

                internshipId,

                planCode,

                amount:
                  plan.price,

                amountInPaise:
                  plan.priceInPaise,

                currency,

                title:
                  getInternshipTitle(
                    internship,
                  ),

                duration:
                  plan.duration,

                durationMonths:
                  plan.durationMonths,

                paymentStatus:
                  "pending",
              },
            },
            409,
          );
        }
      } catch (error) {
        /*
         * IMPORTANT:
         *
         * Never silently create a second order when an
         * existing database order cannot be verified.
         */
        console.error(
          "[PAYMENT CREATE ORDER] Existing Razorpay order lookup failed.",
          error,
        );

        return jsonResponse(
          {
            success: false,

            message:
              "Unable to verify your existing payment order. Please try again shortly.",

            code:
              "EXISTING_ORDER_CHECK_FAILED",
          },
          503,
        );
      }
    }

    /* ========================================================================
       CREATE NEW RAZORPAY ORDER
    ======================================================================== */

    if (!razorpayOrder) {
      const receipt =
        generateReceipt(
          publicStudentId,
          planCode,
        );

      const notes:
        RazorpayNotes = {
        studentId:
          publicStudentId,

        studentObjectId:
          databaseStudentId,

        internshipId,

        planCode,

        applicationId:
          applicationId ||
          "NA",
      };

      try {
        razorpayOrder =
          await razorpayRequest<RazorpayOrder>(
            "/orders",
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

                currency,

                receipt,

                partial_payment:
                  false,

                notes,
              },
            },
          );
      } catch (error) {
        const gatewayStatus =
          error instanceof
            Error
            ? (
                error as Error & {
                  status?: number;
                }
              ).status
            : undefined;

        /*
         * Do not expose Razorpay credentials
         * or raw gateway internals.
         */
        console.error(
          "[PAYMENT CREATE ORDER] Razorpay order creation failed.",
          {
            status:
              gatewayStatus,
          },
        );

        if (
          gatewayStatus ===
          401
        ) {
          return jsonResponse(
            {
              success: false,

              message:
                "Payment gateway authentication failed. Please contact support.",

              code:
                "RAZORPAY_AUTH_FAILED",
            },
            502,
          );
        }

        return jsonResponse(
          {
            success: false,

            message:
              "Unable to create the payment order. Please try again.",

            code:
              "RAZORPAY_ORDER_CREATE_FAILED",
          },
          502,
        );
      }
    }

    /* ========================================================================
       VALIDATE RAZORPAY ORDER
    ======================================================================== */

    const orderId =
      getOrderId(
        razorpayOrder,
      );

    const orderAmount =
      getOrderAmount(
        razorpayOrder,
      );

    const orderCurrency =
      getOrderCurrency(
        razorpayOrder,
      );

    const orderStatus =
      getOrderStatus(
        razorpayOrder,
      );

    if (!orderId) {
      return jsonResponse(
        {
          success: false,

          message:
            "Payment gateway returned an invalid order.",

          code:
            "RAZORPAY_ORDER_ID_MISSING",
        },
        502,
      );
    }

    if (
      orderAmount !==
      plan.priceInPaise
    ) {
      console.error(
        "[PAYMENT CREATE ORDER] Razorpay order amount mismatch.",
        {
          orderId,

          received:
            orderAmount,

          expected:
            plan.priceInPaise,
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Payment gateway amount verification failed.",

          code:
            "RAZORPAY_AMOUNT_MISMATCH",
        },
        502,
      );
    }

    if (
      orderCurrency !==
      currency
    ) {
      console.error(
        "[PAYMENT CREATE ORDER] Razorpay currency mismatch.",
        {
          orderId,

          received:
            orderCurrency,

          expected:
            currency,
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Payment gateway currency verification failed.",

          code:
            "RAZORPAY_CURRENCY_MISMATCH",
        },
        502,
      );
    }

    if (
      orderStatus !==
        "created" &&
      orderStatus !==
        "attempted"
    ) {
      return jsonResponse(
        {
          success: false,

          message:
            "This Razorpay order is not available for checkout.",

          code:
            "RAZORPAY_ORDER_UNAVAILABLE",
        },
        409,
      );
    }

    /* ========================================================================
       OWNERSHIP VALIDATION
    ======================================================================== */

    if (
      !isOrderOwnedByStudent(
        razorpayOrder,
        publicStudentId,
        internshipId,
        planCode,
      )
    ) {
      console.error(
        "[PAYMENT CREATE ORDER] Razorpay order ownership verification failed.",
        {
          orderId,

          studentId:
            publicStudentId,

          internshipId,

          planCode,
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            "Payment order ownership verification failed.",

          code:
            "ORDER_OWNERSHIP_VERIFICATION_FAILED",
        },
        403,
      );
    }

    /* ========================================================================
       PERSIST PENDING PAYMENT THROUGH STUDENT SERVICE
    ======================================================================== */

    /*
     * IMPORTANT:
     *
     * Creating a Razorpay order is NOT payment success.
     *
     * We only record:
     *
     * paymentStatus = pending
     *
     * Final "paid" transition belongs to
     * /api/payment/verify after server-side verification.
     */
    const pendingResult =
      await markPaymentPending(
        {
          studentId:
            databaseStudentId,

          razorpayOrderId:
            orderId,

          amount:
            plan.price,

          currency,
        },
      );

    if (
      !pendingResult.success
    ) {
      console.error(
        "[PAYMENT CREATE ORDER] Student payment state could not be recorded.",
        {
          studentId:
            databaseStudentId,

          orderId,

          code:
            pendingResult.code,
        },
      );

      return jsonResponse(
        {
          success: false,

          message:
            pendingResult.message ||
            "Unable to save pending payment state.",

          code:
            pendingResult.code ||
            "PENDING_PAYMENT_SAVE_FAILED",
        },
        503,
      );
    }

    /* ========================================================================
       PUBLIC RESPONSE
    ======================================================================== */

    const internshipTitle =
      getInternshipTitle(
        internship,
      );

    /*
     * ONLY public Razorpay data is returned.
     *
     * NEVER return:
     * - keySecret
     * - Authorization header
     * - database internals
     * - password hashes
     * - JWT
     */
    return jsonResponse(
      {
        success: true,

        message:
          "Payment order created successfully.",

        data: {
          keyId:
            razorpayConfig.keyId,

          orderId,

          razorpayOrderId:
            orderId,

          amount:
            orderAmount / 100,

          amountInPaise:
            orderAmount,

          currency,

          internshipId,

          planCode,

          title:
            internshipTitle,

          internshipTitle,

          duration:
            plan.duration,

          durationMonths:
            plan.durationMonths,

          durationDays:
            plan.durationDays,

          studentPlan:
            plan.studentPlan,

          applicationId,

          studentId:
            cleanString(
              student.studentId,
            ),

          receiptEmail:
            cleanString(
              student.email,
            ),

          receipt: {
            email:
              cleanString(
                student.email,
              ),

            sendAfterVerification:
              true,

            sent:
              false,
          },

          paymentStatus:
            "pending",

          internshipStatus:
            "payment-pending",

          studentOpsStatus:
            cleanString(
              student.studentOpsStatus,
            ) ||
            "not-ready",

          dashboardStatus:
            cleanString(
              student.dashboardStatus,
            ) ||
            "locked",

          dashboardLoginEnabled:
            false,
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      "[POST /api/payment/create-order] Unexpected error.",
      error,
    );

    return jsonResponse(
      {
        success: false,

        message:
          "Unable to prepare the payment right now. Please try again.",

        code:
          "PAYMENT_ORDER_INTERNAL_ERROR",
      },
      500,
    );
  }
}

/* ============================================================================
   METHOD HANDLERS
============================================================================ */

export async function GET(): Promise<NextResponse> {
  return jsonResponse(
    {
      success: false,

      message:
        "GET is not supported for this endpoint.",

      code:
        "METHOD_NOT_ALLOWED",

      allow:
        "POST",
    },
    405,
  );
}

export async function PUT(): Promise<NextResponse> {
  return jsonResponse(
    {
      success: false,

      message:
        "PUT is not supported for this endpoint.",

      code:
        "METHOD_NOT_ALLOWED",

      allow:
        "POST",
    },
    405,
  );
}

export async function PATCH(): Promise<NextResponse> {
  return jsonResponse(
    {
      success: false,

      message:
        "PATCH is not supported for this endpoint.",

      code:
        "METHOD_NOT_ALLOWED",

      allow:
        "POST",
    },
    405,
  );
}

export async function DELETE(): Promise<NextResponse> {
  return jsonResponse(
    {
      success: false,

      message:
        "DELETE is not supported for this endpoint.",

      code:
        "METHOD_NOT_ALLOWED",

      allow:
        "POST",
    },
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

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export async function HEAD(): Promise<NextResponse> {
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