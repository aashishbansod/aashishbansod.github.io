import { NextRequest, NextResponse } from "next/server";
import {
  resendStudentAdminRegistrationOtp,
  StudentOperationsServiceError,
  type StudentAdminResendOtpInput,
} from "@/services/student-operations.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 4096;
const MAX_EMAIL_LENGTH = 254;
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
): { success: true; data: StudentAdminResendOtpInput } | { success: false; message: string } {
  if (!isRecord(value)) {
    return { success: false, message: "Invalid OTP resend request." };
  }

  const email = cleanString(value.email, MAX_EMAIL_LENGTH).toLowerCase();

  if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) {
    return { success: false, message: "Enter a valid email address." };
  }

  return {
    success: true,
    data: { email },
  };
}

function handleError(error: unknown): NextResponse {
  if (error instanceof StudentOperationsServiceError) {
    return apiResponse(
      {
        success: false,
        code: error.code,
        message: error.message,
        ...(error.code === "OTP_RESEND_COOLDOWN" ? { retryable: true } : {}),
      },
      error.statusCode,
    );
  }

  if (isRecord(error) && error.code === 11000) {
    return apiResponse(
      {
        success: false,
        code: "DUPLICATE_RECORD",
        message: "Unable to process this OTP request.",
      },
      409,
    );
  }

  console.error("[STUDENT ADMIN OTP RESEND] Request failed:", error);

  return apiResponse(
    {
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to resend the verification code right now. Please try again later.",
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
        message: "This OTP request is not allowed.",
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
        message: "OTP resend request is too large.",
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
          message: "OTP resend request is empty or too large.",
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
    const result = await resendStudentAdminRegistrationOtp(validation.data);

    return apiResponse(
      {
        success: result.emailSent,
        code: result.emailSent ? "OTP_RESENT" : "OTP_EMAIL_FAILED",
        message: result.message,
        data: {
          email: result.email,
          expiresInMinutes: result.expiresInMinutes,
          emailSent: result.emailSent,
          retryAfterSeconds: result.emailSent ? 60 : null,
        },
      },
      result.emailSent ? 200 : 502,
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(): Promise<NextResponse> {
  return apiResponse(
    {
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Use POST to resend the Student Admin verification code.",
    },
    405,
  );
}
