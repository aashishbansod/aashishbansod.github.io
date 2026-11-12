import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  registerStudentAdmin,
  StudentOperationsServiceError,
  type StudentAdminRegistrationInput,
} from "@/services/student-operations.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 12 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 20;
const MAX_USERNAME_LENGTH = 30;
const MAX_PASSWORD_LENGTH = 128;
const MAX_INVITATION_KEY_LENGTH = 512;
const INVITATION_COOKIE = "cn_student_admin_invite";
const INVITATION_WINDOW_SECONDS = 30 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])$/;

type JsonRecord = Record<string, unknown>;

type ValidationResult =
  | { success: true; data: Omit<StudentAdminRegistrationInput, "invitationKey"> }
  | { success: false; message: string };

function response(body: Record<string, unknown>, status = 200): NextResponse {
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

function getRegistrationKey(): string {
  const key = process.env.STUDENT_ADMIN_REGISTRATION_KEY?.trim() ?? "";
  if (key.length < 32 || key.length > MAX_INVITATION_KEY_LENGTH) {
    throw new StudentOperationsServiceError(
      "REGISTRATION_NOT_CONFIGURED",
      "Private Student Admin registration is not configured.",
      503,
    );
  }
  return key;
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

function createInvitationCookieValue(key: string, timestamp: number): string {
  const payload = `student-admin-registration:${timestamp}`;
  const signature = createHmac("sha256", key).update(payload).digest("hex");
  return `${timestamp}.${signature}`;
}

function verifyInvitationCookie(value: string | undefined, key: string): boolean {
  if (!value) return false;

  const [timestampText, signature, extra] = value.split(".");
  if (!timestampText || !signature || extra !== undefined || !/^\d{10,13}$/.test(timestampText)) {
    return false;
  }

  const timestamp = Number(timestampText);
  const now = Date.now();
  const timestampMs = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;

  if (
    !Number.isSafeInteger(timestamp) ||
    timestampMs > now + 60_000 ||
    now - timestampMs > INVITATION_WINDOW_SECONDS * 1000
  ) {
    return false;
  }

  const expected = createHmac("sha256", key)
    .update(`student-admin-registration:${timestamp}`)
    .digest();

  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function validatePayload(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { success: false, message: "Invalid registration request." };
  }

  const fullName = cleanString(value.fullName, MAX_NAME_LENGTH);
  const email = cleanString(value.email, MAX_EMAIL_LENGTH).toLowerCase();
  const phone = cleanString(value.phone, MAX_PHONE_LENGTH);
  const username = cleanString(value.username, MAX_USERNAME_LENGTH).toLowerCase();
  const password = typeof value.password === "string" ? value.password : "";

  if (fullName.length < 2) {
    return { success: false, message: "Enter your full name." };
  }

  if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH) {
    return { success: false, message: "Enter a valid email address." };
  }

  const normalizedPhone = phone.replace(/[\s()-]/g, "");
  if (!/^\+?[1-9]\d{6,14}$/.test(normalizedPhone)) {
    return { success: false, message: "Enter a valid phone number with country code." };
  }

  if (
    username.length < 3 ||
    username.length > MAX_USERNAME_LENGTH ||
    !USERNAME_PATTERN.test(username)
  ) {
    return {
      success: false,
      message: "Username must be 3–30 characters and contain only letters, numbers, dots, underscores or hyphens.",
    };
  }

  if (
    password.length < 10 ||
    password.length > MAX_PASSWORD_LENGTH ||
    password.trim() !== password ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return {
      success: false,
      message: "Password must be 10–128 characters and include uppercase, lowercase and a number.",
    };
  }

  return {
    success: true,
    data: {
      fullName,
      email,
      phone: normalizedPhone,
      username,
      password,
    },
  };
}

function handleError(error: unknown): NextResponse {
  if (error instanceof StudentOperationsServiceError) {
    return response(
      {
        success: false,
        code: error.code,
        message: error.message,
      },
      error.statusCode,
    );
  }

  if (isRecord(error) && error.code === 11000) {
    const keyValue = isRecord(error.keyValue) ? error.keyValue : {};
    const duplicateField = Object.keys(keyValue)[0];

    return response(
      {
        success: false,
        code: "DUPLICATE_RECORD",
        message:
          duplicateField === "username"
            ? "This username is already in use."
            : "An account with these details already exists.",
      },
      409,
    );
  }

  console.error("[STUDENT ADMIN REGISTRATION] Request failed:", error);

  return response(
    {
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to complete registration right now. Please try again later.",
    },
    500,
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isValidMutationOrigin(request)) {
    return response(
      {
        success: false,
        code: "INVALID_ORIGIN",
        message: "This registration request is not allowed.",
      },
      403,
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return response(
      {
        success: false,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json.",
      },
      415,
    );
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MAX_BODY_BYTES) {
      return response(
        {
          success: false,
          code: "PAYLOAD_TOO_LARGE",
          message: "Registration request is too large.",
        },
        413,
      );
    }
  }

  let rawBody: unknown;

  try {
    const rawText = await request.text();

    if (!rawText || Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
      return response(
        {
          success: false,
          code: "INVALID_BODY_SIZE",
          message: "Registration request is empty or too large.",
        },
        413,
      );
    }

    rawBody = JSON.parse(rawText);
  } catch {
    return response(
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
    return response(
      {
        success: false,
        code: "VALIDATION_ERROR",
        message: validation.message,
      },
      400,
    );
  }

  try {
    const registrationKey = getRegistrationKey();
    const invitationCookie = request.cookies.get(INVITATION_COOKIE)?.value;

    if (!verifyInvitationCookie(invitationCookie, registrationKey)) {
      return response(
        {
          success: false,
          code: "PRIVATE_INVITATION_REQUIRED",
          message: "Open the private Student Admin invitation link before registering.",
        },
        403,
      );
    }

    const input: StudentAdminRegistrationInput = {
      ...validation.data,
      invitationKey: registrationKey,
    };

    const result = await registerStudentAdmin(input);

    const resultBody = response(
      {
        success: true,
        code: result.emailSent ? "OTP_SENT" : "OTP_EMAIL_FAILED",
        message: result.message,
        data: {
          adminId: result.adminId,
          email: result.email,
          username: result.username,
          expiresInMinutes: result.expiresInMinutes,
          emailSent: result.emailSent,
          verificationRequired: true,
        },
      },
      result.emailSent ? 201 : 502,
    );

    resultBody.cookies.set({
      name: INVITATION_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/student-admin/register",
      maxAge: 0,
    });

    return resultBody;
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const registrationKey = getRegistrationKey();
    const suppliedKey = request.nextUrl.searchParams.get("invite") ?? "";

    if (
      !suppliedKey ||
      suppliedKey.length > MAX_INVITATION_KEY_LENGTH ||
      suppliedKey.length !== registrationKey.length
    ) {
      return response(
        {
          success: false,
          code: "INVALID_INVITATION",
          message: "This private invitation link is invalid or expired.",
        },
        403,
      );
    }

    const supplied = Buffer.from(suppliedKey);
    const expected = Buffer.from(registrationKey);

    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return response(
        {
          success: false,
          code: "INVALID_INVITATION",
          message: "This private invitation link is invalid or expired.",
        },
        403,
      );
    }

    const result = response(
      {
        success: true,
        code: "PRIVATE_INVITATION_ACCEPTED",
        message: "Private registration access granted for 30 minutes. Open the Student Admin registration page.",
      },
      200,
    );

    const timestamp = Date.now();
    result.cookies.set({
      name: INVITATION_COOKIE,
      value: createInvitationCookieValue(registrationKey, timestamp),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/student-admin/register",
      maxAge: INVITATION_WINDOW_SECONDS,
    });

    return result;
  } catch (error) {
    return handleError(error);
  }
}
