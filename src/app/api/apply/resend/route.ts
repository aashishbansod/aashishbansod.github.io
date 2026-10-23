import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";

import connectDB from "@/lib/db";
import Application from "@/models/Application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   CONFIGURATION
============================================================ */

const OTP_LENGTH = 6;
const DEFAULT_OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

/* ============================================================
   OTP GENERATOR
============================================================ */

function generateOTP(): string {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
}

/* ============================================================
   OTP HASH
   IMPORTANT:
   This MUST be identical to:
   /api/apply/route.ts
   /api/apply/verify/route.ts
============================================================ */

function hashOTP(otp: string): string {
  const secret =
    process.env.JWT_SECRET ||
    "CYBERNET_OTP_SECRET_CHANGE_THIS";

  return crypto
    .createHmac("sha256", secret)
    .update(otp)
    .digest("hex");
}

/* ============================================================
   EMAIL MASK
============================================================ */

function maskEmail(email: string): string {
  const [name, domain] =
    email.split("@");

  if (!name || !domain) {
    return email;
  }

  if (name.length <= 2) {
    return `${name[0]}********@${domain}`;
  }

  return `${name.slice(
    0,
    2
  )}************@${domain}`;
}

/* ============================================================
   EMAIL VALIDATION
============================================================ */

function isValidEmail(
  email: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

/* ============================================================
   CREATE SMTP TRANSPORTER
============================================================ */

function createTransporter() {
  const host =
    process.env.SMTP_HOST ||
    "smtp.gmail.com";

  const port = Number(
    process.env.SMTP_PORT || 465
  );

  const user =
    process.env.SMTP_USER?.trim();

  const pass =
    process.env.SMTP_PASS?.trim();

  if (!user) {
    throw new Error(
      "SMTP_USER is missing."
    );
  }

  if (!pass) {
    throw new Error(
      "SMTP_PASS is missing."
    );
  }

  if (
    !Number.isFinite(port) ||
    port <= 0
  ) {
    throw new Error(
      "Invalid SMTP_PORT."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,

    auth: {
      user,
      pass,
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/* ============================================================
   HTML ESCAPE
============================================================ */

function escapeHtml(
  value: string
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ============================================================
   POST
   /api/apply/resend
============================================================ */

export async function POST(
  request: NextRequest
) {
  try {
    /* ========================================================
       CONTENT TYPE
    ======================================================== */

    const contentType =
      request.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid request format.",
        },
        {
          status: 415,
        }
      );
    }

    /* ========================================================
       PARSE BODY
    ======================================================== */

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        (await request.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid JSON request body.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================================
       APPLICATION ID
    ======================================================== */

    const applicationId =
      typeof body.applicationId ===
      "string"
        ? body.applicationId.trim()
        : "";

    /* ========================================================
       EMAIL
    ======================================================== */

    const requestedEmail =
      typeof body.email ===
      "string"
        ? body.email
            .trim()
            .toLowerCase()
        : "";

    /* ========================================================
       VALIDATE IDENTIFIER
    ======================================================== */

    if (
      !applicationId &&
      !requestedEmail
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Application ID or email is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestedEmail &&
      !isValidEmail(
        requestedEmail
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please provide a valid email address.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================================
       DATABASE CONNECTION
    ======================================================== */

    try {
      await connectDB();
    } catch (error) {
      console.error(
        "CYBERNET_RESEND_DB_CONNECTION_ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to connect to the database. Please try again.",
        },
        {
          status: 503,
        }
      );
    }

    /* ========================================================
       FIND APPLICATION
    ======================================================== */

    let application;

    if (applicationId) {
      application =
        await Application.findOne({
          applicationId,
        });
    } else {
      application =
        await Application.findOne({
          email:
            requestedEmail,
        });
    }

    /* ========================================================
       APPLICATION NOT FOUND
    ======================================================== */

    if (!application) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Application not found.",
        },
        {
          status: 404,
        }
      );
    }

    /* ========================================================
       NORMALIZE STORED EMAIL
    ======================================================== */

    const targetEmail =
      String(
        application.email || ""
      )
        .trim()
        .toLowerCase();

    /* ========================================================
       EMAIL EXISTENCE CHECK
    ======================================================== */

    if (
      !targetEmail ||
      !isValidEmail(
        targetEmail
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The application does not contain a valid email address.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================================
       REQUEST EMAIL MATCH
    ======================================================== */

    if (
      requestedEmail &&
      requestedEmail !==
        targetEmail
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email does not match the application.",
        },
        {
          status: 400,
        }
      );
    }

    /* ========================================================
       ALREADY VERIFIED
    ======================================================== */

    if (
      Boolean(
        (application as any)
          .emailVerified
      )
    ) {
      return NextResponse.json(
        {
          success: true,
          verified: true,
          message:
            "This email is already verified.",
          applicationId:
            application.applicationId,
          email:
            maskEmail(
              targetEmail
            ),
        },
        {
          status: 200,
        }
      );
    }

    /* ========================================================
       RESEND COOLDOWN
    ======================================================== */

    const previousSentAt =
      (application as any)
        .otpSentAt;

    if (previousSentAt) {
      const previousTime =
        new Date(
          previousSentAt
        ).getTime();

      if (
        Number.isFinite(
          previousTime
        )
      ) {
        const elapsedSeconds =
          Math.floor(
            (Date.now() -
              previousTime) /
              1000
          );

        if (
          elapsedSeconds <
          RESEND_COOLDOWN_SECONDS
        ) {
          const retryAfter =
            RESEND_COOLDOWN_SECONDS -
            elapsedSeconds;

          return NextResponse.json(
            {
              success: false,
              message: `Please wait ${retryAfter} seconds before requesting another OTP.`,
              retryAfter,
              email:
                maskEmail(
                  targetEmail
                ),
            },
            {
              status: 429,
              headers: {
                "Retry-After":
                  String(
                    retryAfter
                  ),
              },
            }
          );
        }
      }
    }

    /* ========================================================
       OTP CONFIGURATION
    ======================================================== */

    const expiryMinutesRaw =
      Number(
        process.env
          .OTP_EXPIRE_MINUTES ||
          DEFAULT_OTP_EXPIRY_MINUTES
      );

    const expiryMinutes =
      Number.isFinite(
        expiryMinutesRaw
      ) &&
      expiryMinutesRaw > 0
        ? Math.min(
            expiryMinutesRaw,
            60
          )
        : DEFAULT_OTP_EXPIRY_MINUTES;

    /* ========================================================
       GENERATE NEW OTP
    ======================================================== */

    const otp =
      generateOTP();

    if (
      !new RegExp(
        `^\\d{${OTP_LENGTH}}$`
      ).test(otp)
    ) {
      throw new Error(
        "OTP generation failed."
      );
    }

    const otpHash =
      hashOTP(otp);

    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime() +
          expiryMinutes *
            60 *
            1000
      );

    /* ========================================================
       SMTP TRANSPORTER
    ======================================================== */

    const transporter =
      createTransporter();

    /* ========================================================
       VERIFY SMTP CONNECTION
    ======================================================== */

    try {
      await transporter.verify();
    } catch (error) {
      console.error(
        "CYBERNET_SMTP_VERIFY_ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Email service is currently unavailable. Please try again.",
        },
        {
          status: 503,
        }
      );
    }

    /* ========================================================
       COMPANY EMAIL
    ======================================================== */

    const smtpUser =
      process.env.SMTP_USER?.trim();

    if (!smtpUser) {
      throw new Error(
        "SMTP_USER is missing."
      );
    }

    const from =
      process.env.EMAIL_FROM?.trim() ||
      `CyberNet Careers <${smtpUser}>`;

    /* ========================================================
       STUDENT NAME
    ======================================================== */

    const studentName =
      escapeHtml(
        String(
          application.fullName ||
            "Student"
        )
      );

    /* ========================================================
       SEND EMAIL
       IMPORTANT:
       Database is updated ONLY after successful send.
    ======================================================== */

    try {
      await transporter.sendMail({
        from,

        to: targetEmail,

        subject:
          "CyberNet Careers — Email Verification OTP",

        text: `
Hello ${application.fullName || "Student"},

Your CyberNet Careers email verification OTP is:

${otp}

This OTP is valid for ${expiryMinutes} minutes.

Do not share this OTP with anyone.

If you did not request this verification, you can safely ignore this email.

CyberNet Careers
CyberNet Technology Systems
        `.trim(),

        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>CyberNet Careers OTP</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f8ff;
    font-family:Arial,Helvetica,sans-serif;
    color:#111827;
  "
>

  <div
    style="
      width:100%;
      padding:40px 16px;
      box-sizing:border-box;
    "
  >

    <div
      style="
        max-width:600px;
        margin:0 auto;
        background:#ffffff;
        border:1px solid #e5e7eb;
        border-radius:20px;
        overflow:hidden;
      "
    >

      <!-- HEADER -->

      <div
        style="
          padding:28px 30px;
          border-bottom:1px solid #e5e7eb;
        "
      >

        <div
          style="
            font-size:24px;
            font-weight:800;
            color:#111827;
          "
        >
          CyberNet
        </div>

        <div
          style="
            margin-top:4px;
            font-size:12px;
            letter-spacing:3px;
            font-weight:700;
            color:#2563eb;
          "
        >
          CAREERS
        </div>

      </div>

      <!-- CONTENT -->

      <div
        style="
          padding:32px 30px;
        "
      >

        <p
          style="
            margin:0 0 10px;
            font-size:22px;
            font-weight:700;
          "
        >
          Verify your email
        </p>

        <p
          style="
            margin:0 0 24px;
            color:#6b7280;
            font-size:15px;
            line-height:1.6;
          "
        >
          Hello ${studentName}, use the verification
          code below to continue your CyberNet Careers
          application.
        </p>

        <!-- OTP BOX -->

        <div
          style="
            padding:28px 20px;
            background:#eff6ff;
            border:1px solid #dbeafe;
            border-radius:16px;
            text-align:center;
          "
        >

          <div
            style="
              margin-bottom:10px;
              font-size:12px;
              color:#64748b;
              text-transform:uppercase;
              letter-spacing:1px;
              font-weight:700;
            "
          >
            Verification OTP
          </div>

          <div
            style="
              font-size:36px;
              line-height:1.2;
              font-weight:800;
              letter-spacing:9px;
              color:#2563eb;
            "
          >
            ${otp}
          </div>

        </div>

        <p
          style="
            margin:22px 0 0;
            font-size:14px;
            color:#4b5563;
            line-height:1.6;
          "
        >
          This OTP will expire in
          <strong>${expiryMinutes} minutes</strong>.
        </p>

        <div
          style="
            margin-top:22px;
            padding:14px 16px;
            background:#fff7ed;
            border:1px solid #fed7aa;
            border-radius:12px;
            color:#9a3412;
            font-size:13px;
            line-height:1.5;
          "
        >
          Never share your OTP with anyone.
          CyberNet Careers will never ask you to share
          your verification OTP.
        </div>

        <p
          style="
            margin:24px 0 0;
            color:#6b7280;
            font-size:13px;
            line-height:1.6;
          "
        >
          If you did not request this verification,
          you can safely ignore this email.
        </p>

      </div>

      <!-- FOOTER -->

      <div
        style="
          padding:22px 30px;
          background:#f8fafc;
          border-top:1px solid #e5e7eb;
        "
      >

        <p
          style="
            margin:0;
            font-size:12px;
            color:#64748b;
            line-height:1.6;
          "
        >
          CyberNet Careers<br />
          CyberNet Technology Systems
        </p>

      </div>

    </div>

  </div>

</body>
</html>
        `.trim(),
      });
    } catch (error) {
      console.error(
        "CYBERNET_OTP_EMAIL_SEND_ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to send OTP email. Please check the email service configuration and try again.",
        },
        {
          status: 502,
        }
      );
    }

    /* ========================================================
       SAVE NEW OTP
       ONLY AFTER EMAIL WAS SENT SUCCESSFULLY
    ======================================================== */

    await Application.updateOne(
      {
        _id:
          application._id,
      },
      {
        $set: {
          otpHash,

          otpExpiresAt:
            expiresAt,

          otpAttempts: 0,

          otpSentAt: now,

          emailVerified:
            false,
        },
      }
    );

    /* ========================================================
       LOG
       NEVER LOG THE OTP
    ======================================================== */

    console.log(
      `CyberNet OTP resent successfully to ${maskEmail(
        targetEmail
      )}`
    );

    /* ========================================================
       SUCCESS RESPONSE
    ======================================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "A new OTP has been sent to your registered email.",

        applicationId:
          application.applicationId,

        email:
          maskEmail(
            targetEmail
          ),

        expiresInMinutes:
          expiryMinutes,

        resendCooldownSeconds:
          RESEND_COOLDOWN_SECONDS,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    /* ========================================================
       DATABASE / NETWORK ERRORS
    ======================================================== */

    console.error(
      "CYBERNET_RESEND_OTP_ERROR:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : "";

    if (
      errorMessage.includes(
        "querySrv"
      ) ||
      errorMessage.includes(
        "ENOTFOUND"
      ) ||
      errorMessage.includes(
        "MongoServerSelectionError"
      ) ||
      errorMessage.includes(
        "MongooseServerSelectionError"
      ) ||
      errorMessage.includes(
        "ECONNREFUSED"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Database connection failed. Please try again.",
        },
        {
          status: 503,
        }
      );
    }

    /* ========================================================
       GENERIC ERROR
    ======================================================== */

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to resend OTP. Please try again after a moment.",
      },
      {
        status: 500,
      }
    );
  }
}

/* ============================================================
   GET
============================================================ */

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Use POST /api/apply/resend to resend the OTP.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}

/* ============================================================
   PUT
============================================================ */

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      message:
        "PUT method is not allowed for this endpoint.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}

/* ============================================================
   PATCH
============================================================ */

export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      message:
        "PATCH method is not allowed for this endpoint.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}

/* ============================================================
   DELETE
============================================================ */

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      message:
        "DELETE method is not allowed for this endpoint.",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}