import { NextRequest, NextResponse } from "next/server";
import {
  verifyStudentAdminRegistrationOtp,
  StudentOperationsServiceError,
  type StudentAdminVerifyOtpInput,
} from "@/services/student-operations.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 4096;
const EMAIL_MAX_LENGTH = 254;
const OTP_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type JsonRecord = Record<string, unknown>;

function apiResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Cross-Origin-Resource-Policy": "same-origin",
      Vary: "Origin",
    },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function isValidMutationOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function validatePayload(
  value: unknown,
): { success: true; data: StudentAdminVerifyOtpInput } | { success: false; message: string } {
  if (!isRecord(value)) {
    return { success: false, message: "Invalid verification request." };
  }

  const email = cleanString(value.email, EMAIL_MAX_LENGTH).toLowerCase();
  const otp = cleanString(value.otp, OTP_LENGTH);

  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    return { success: false, message: "Enter a valid email address." };
  }

  if (!/^\d{6}$/.test(otp) || otp.length !== OTP_LENGTH) {
    return { success: false, message: "Enter the six-digit verification code." };
  }

  return {
    success: true,
    data: { email, otp },
  };
}

function handleError(error: unknown): NextResponse {
  if (error instanceof StudentOperationsServiceError) {
    return apiResponse(
      {
        success: false,
        code: error.code,
        message: error.message,
      },
      error.statusCode,
    );
  }

  if (isRecord(error) && error.code === 11000) {
    return apiResponse(
      {
        success: false,
        code: "DUPLICATE_RECORD",
        message: "This Student Admin account already exists.",
      },
      409,
    );
  }

  console.error("[STUDENT ADMIN OTP VERIFICATION] Request failed:", error);

  return apiResponse(
    {
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to verify the code right now. Please try again later.",
    },
    500,
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isValidMutationOrigin(request)) {
    return apiResponse(
      {
        success: false,
        code: "INVALID_ORIGIN",
        message: "This verification request is not allowed.",
      },
      403,
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return apiResponse(
      {
        success: false,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json.",
      },
      415,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return apiResponse(
      {
        success: false,
        code: "PAYLOAD_TOO_LARGE",
        message: "Verification request is too large.",
      },
      413,
    );
  }

  let rawBody: unknown;

  try {
    const rawText = await request.text();

    if (!rawText || Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
      return apiResponse(
        {
          success: false,
          code: "INVALID_BODY_SIZE",
          message: "Verification request is empty or too large.",
        },
        413,
      );
    }

    rawBody = JSON.parse(rawText);
  } catch {
    return apiResponse(
      {
        success: false,
        code: "INVALID_JSON",
        message: "Request body must contain valid JSON.",
      },
      400,
    );
  }

  const validation = validatePayload(rawBody);

  if (!validation.success) {
    return apiResponse(
      {
        success: false,
        code: "VALIDATION_ERROR",
        message: validation.message,
      },
      400,
    );
  }

  try {
    const result = await verifyStudentAdminRegistrationOtp(validation.data);

    return apiResponse({
      success: true,
      code: "STUDENT_ADMIN_ACTIVATED",
      message: result.message,
      data: {
        adminId: result.adminId,
        username: result.username,
        email: result.email,
        active: result.active,
        confirmationEmailSent: result.confirmationEmailSent,
        loginMode: "student-admin",
        loginUrl: "/login?mode=student-admin",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(): Promise<NextResponse> {
  return apiResponse(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Use POST to verify the Student Admin email code.",
    },
    405,
  );
}
