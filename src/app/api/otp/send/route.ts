import { NextRequest, NextResponse } from "next/server";

import connectDB from "@/lib/db";
import Student from "@/models/Student";

import {
  saveOTP,
  hasValidOTP,
  type OTPPurpose,
} from "@/lib/otp";

import { sendOTPEmail } from "@/lib/email";
import { sendOTPWhatsApp } from "@/lib/whatsapp";

// ============================================================
// NEXT.JS ROUTE CONFIG
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// ALLOWED OTP PURPOSES
// IMPORTANT:
// These values MUST match src/lib/otp.ts
// ============================================================

const ALLOWED_PURPOSES = [
  "registration",
  "login",
  "password-reset",
  "verification",
] as const;

type RouteOTPPurpose =
  (typeof ALLOWED_PURPOSES)[number];

// ============================================================
// EMAIL VALIDATION
// ============================================================

function isValidEmail(
  email: string
): boolean {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  );
}

// ============================================================
// PHONE NORMALIZATION
// ============================================================

function normalizePhone(
  phone: unknown
): string {
  if (
    typeof phone !== "string"
  ) {
    return "";
  }

  return phone
    .trim()
    .replace(/\s+/g, " ");
}

// ============================================================
// PURPOSE NORMALIZATION
// ============================================================

function normalizePurpose(
  value: unknown
): RouteOTPPurpose {
  if (
    typeof value !== "string"
  ) {
    return "registration";
  }

  // ----------------------------------------------------------
  // Current supported values
  // ----------------------------------------------------------

  if (
    ALLOWED_PURPOSES.includes(
      value as RouteOTPPurpose
    )
  ) {
    return value as RouteOTPPurpose;
  }

  // ----------------------------------------------------------
  // Backward-compatible aliases
  // ----------------------------------------------------------

  switch (value) {
    case "forgot-password":
    case "reset-password":
    case "password_reset":
    case "forgot_password":
      return "password-reset";

    case "email-verification":
    case "email_verify":
      return "verification";

    default:
      return "registration";
  }
}

// ============================================================
// JSON RESPONSE HELPER
// ============================================================

function jsonResponse(
  data: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json(
    data,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}

// ============================================================
// POST /api/otp/send
// ============================================================

export async function POST(
  req: NextRequest
): Promise<NextResponse> {
  try {
    // ========================================================
    // DATABASE CONNECTION
    // ========================================================

    await connectDB();

    // ========================================================
    // PARSE REQUEST BODY
    // ========================================================

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          message:
            "Invalid JSON request.",
          code: "INVALID_JSON",
        },
        400
      );
    }

    // ========================================================
    // VALIDATE BODY
    // ========================================================

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Invalid request body.",
          code: "INVALID_BODY",
        },
        400
      );
    }

    const data =
      body as Record<
        string,
        unknown
      >;

    // ========================================================
    // NORMALIZE INPUT
    // ========================================================

    const email =
      typeof data.email === "string"
        ? data.email
            .trim()
            .toLowerCase()
        : "";

    const phone =
      normalizePhone(
        data.phone
      );

    const purpose =
      normalizePurpose(
        data.purpose
      );

    // ========================================================
    // EMAIL REQUIRED
    // ========================================================

    if (!email) {
      return jsonResponse(
        {
          success: false,
          message:
            "Email is required.",
          code: "EMAIL_REQUIRED",
        },
        400
      );
    }

    // ========================================================
    // EMAIL VALIDATION
    // ========================================================

    if (
      email.length > 254 ||
      !isValidEmail(email)
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Please enter a valid email address.",
          code: "INVALID_EMAIL",
        },
        400
      );
    }

    // ========================================================
    // PHONE VALIDATION
    // ========================================================

    if (
      phone &&
      phone.length > 20
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Invalid phone number.",
          code: "INVALID_PHONE",
        },
        400
      );
    }

    // ========================================================
    // EXISTING STUDENT CHECK
    // ========================================================

    const existingStudent =
      await Student.findOne({
        email,
      })
        .select(
          "emailVerified"
        )
        .lean();

    // --------------------------------------------------------
    // Registration:
    // already verified email cannot register again
    // --------------------------------------------------------

    if (
      purpose ===
        "registration" &&
      existingStudent?.emailVerified ===
        true
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Email is already registered.",
          code:
            "EMAIL_ALREADY_REGISTERED",
        },
        409
      );
    }

    // ========================================================
    // CHECK EXISTING VALID OTP
    // ========================================================

    const alreadySent =
      await hasValidOTP(
        email,
        purpose as OTPPurpose
      );

    if (alreadySent) {
      return jsonResponse(
        {
          success: false,
          message:
            "OTP already sent. Please wait before requesting another OTP.",
          code:
            "OTP_RATE_LIMITED",
        },
        429
      );
    }

    // ========================================================
    // GENERATE + SAVE OTP
    // ========================================================

    const {
      otp,
      expiresAt,
    } = await saveOTP(
      email,
      purpose as OTPPurpose
    );

    // ========================================================
    // SEND OTP EMAIL
    // ========================================================
    //
    // sendOTPEmail() in the current project expects:
    //
    // email
    // otp
    // purpose
    //
    // The Parameters type keeps this compatible with the
    // exact purpose type declared in lib/email.ts.
    // ========================================================

    try {
      type EmailPurpose =
        Parameters<
          typeof sendOTPEmail
        >[2];

      await sendOTPEmail(
        email,
        otp,
        purpose as EmailPurpose
      );
    } catch (error) {
      console.error(
        "OTP email sending failed:",
        error
      );

      // ------------------------------------------------------
      // Remove OTP if email delivery failed.
      // This allows the user to request a fresh OTP.
      // ------------------------------------------------------

      try {
        const {
          deleteOTP,
        } = await import(
          "@/lib/otp"
        );

        await deleteOTP(
          email,
          purpose as OTPPurpose
        );
      } catch (cleanupError) {
        console.error(
          "OTP cleanup failed:",
          cleanupError
        );
      }

      return jsonResponse(
        {
          success: false,
          message:
            "Unable to send OTP email. Please try again later.",
          code:
            "OTP_EMAIL_FAILED",
        },
        500
      );
    }

    // ========================================================
    // SEND OTP THROUGH WHATSAPP
    // ========================================================

    let whatsappSent =
      false;

    if (phone) {
      try {
        await sendOTPWhatsApp(
          phone,
          otp
        );

        whatsappSent =
          true;
      } catch (error) {
        // ----------------------------------------------------
        // Email was already sent successfully.
        // WhatsApp failure should not fail the whole request.
        // ----------------------------------------------------

        console.error(
          "OTP WhatsApp sending failed:",
          error
        );
      }
    }

    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    return jsonResponse(
      {
        success: true,

        message:
          whatsappSent
            ? "OTP sent successfully to your email and WhatsApp."
            : "OTP sent successfully to your email.",

        purpose,

        expiresAt,

        whatsappSent,
      },
      200
    );
  } catch (error) {
    // ========================================================
    // GLOBAL ERROR HANDLER
    // ========================================================

    console.error(
      "Send OTP API Error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        message:
          "Internal Server Error. Please try again later.",
        code:
          "INTERNAL_SERVER_ERROR",
      },
      500
    );
  }
}

// ============================================================
// GET /api/otp/send
// HEALTH CHECK
// ============================================================

export async function GET(): Promise<NextResponse> {
  return jsonResponse(
    {
      success: true,

      service:
        "CyberNet Careers OTP API",

      endpoint:
        "/api/otp/send",

      method: "POST",

      status: "Running",

      timestamp:
        new Date().toISOString(),
    },
    200
  );
}