import crypto from "node:crypto";
import Otp from "@/models/Otp";

// ============================================================
// CYBERNET CAREERS
// OTP SERVICE
// ============================================================
//
// Supported purposes:
//
// registration
// login
// password-reset
// verification
//
// IMPORTANT:
// These values must remain consistent throughout the OTP flow.
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_OTP_EXPIRE_MINUTES = 10;

const parsedOtpLength = Number(
  process.env.OTP_LENGTH
);

const parsedExpireMinutes = Number(
  process.env.OTP_EXPIRE_MINUTES
);

export const OTP_LENGTH =
  Number.isInteger(parsedOtpLength) &&
  parsedOtpLength >= 4 &&
  parsedOtpLength <= 10
    ? parsedOtpLength
    : DEFAULT_OTP_LENGTH;

export const OTP_EXPIRE_MINUTES =
  Number.isFinite(parsedExpireMinutes) &&
  parsedExpireMinutes > 0 &&
  parsedExpireMinutes <= 60
    ? parsedExpireMinutes
    : DEFAULT_OTP_EXPIRE_MINUTES;

// ============================================================
// OTP PURPOSES
// ============================================================

export const OTP_PURPOSES = [
  "registration",
  "login",
  "password-reset",
  "verification",
] as const;

export type OTPPurpose =
  (typeof OTP_PURPOSES)[number];

// ============================================================
// INTERNAL OTP DOCUMENT TYPE
// ============================================================

interface OTPDocumentData {
  email: string;
  otp: string;
  purpose: OTPPurpose;
  expiresAt: Date;
  verified: boolean;
}

// ============================================================
// EMAIL NORMALIZATION
// ============================================================

function normalizeEmail(
  email: string
): string {
  if (
    typeof email !== "string" ||
    !email.trim()
  ) {
    throw new Error(
      "Email is required."
    );
  }

  return email
    .trim()
    .toLowerCase();
}

// ============================================================
// PURPOSE VALIDATION
// ============================================================

function normalizePurpose(
  purpose: OTPPurpose
): OTPPurpose {
  if (
    !OTP_PURPOSES.includes(
      purpose
    )
  ) {
    throw new Error(
      "Invalid OTP purpose."
    );
  }

  return purpose;
}

// ============================================================
// GENERATE OTP
// ============================================================

export function generateOTP(
  length: number = OTP_LENGTH
): string {
  if (
    !Number.isInteger(length) ||
    length < 4 ||
    length > 10
  ) {
    throw new Error(
      "OTP length must be between 4 and 10."
    );
  }

  let otp = "";

  while (
    otp.length < length
  ) {
    otp += crypto
      .randomInt(0, 10)
      .toString();
  }

  return otp.slice(
    0,
    length
  );
}

// ============================================================
// HASH OTP
// ============================================================

export function hashOTP(
  otp: string
): string {
  if (
    typeof otp !== "string" ||
    !otp.trim()
  ) {
    throw new Error(
      "OTP is required."
    );
  }

  return crypto
    .createHash("sha256")
    .update(otp.trim())
    .digest("hex");
}

// ============================================================
// SAVE OTP
// ============================================================

export async function saveOTP(
  email: string,
  purpose: OTPPurpose
): Promise<{
  otp: string;
  expiresAt: Date;
}> {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedPurpose =
    normalizePurpose(purpose);

  // ----------------------------------------------------------
  // Remove previous OTP
  // ----------------------------------------------------------

  await Otp.deleteMany(
    {
      email: normalizedEmail,
      purpose: normalizedPurpose,
    } as any
  );

  // ----------------------------------------------------------
  // Generate OTP
  // ----------------------------------------------------------

  const otp =
    generateOTP();

  const hashedOTP =
    hashOTP(otp);

  // ----------------------------------------------------------
  // Expiration
  // ----------------------------------------------------------

  const expiresAt =
    new Date(
      Date.now() +
        OTP_EXPIRE_MINUTES *
          60 *
          1000
    );

  // ----------------------------------------------------------
  // Create OTP document
  // ----------------------------------------------------------

  const otpData: OTPDocumentData = {
    email: normalizedEmail,
    otp: hashedOTP,
    purpose: normalizedPurpose,
    expiresAt,
    verified: false,
  };

  await Otp.create(
    otpData as any
  );

  return {
    otp,
    expiresAt,
  };
}

// ============================================================
// VERIFY OTP
// ============================================================

export async function verifyOTP(
  email: string,
  otp: string,
  purpose: OTPPurpose
): Promise<boolean> {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedPurpose =
    normalizePurpose(purpose);

  const normalizedOTP =
    typeof otp === "string"
      ? otp.trim()
      : "";

  // ----------------------------------------------------------
  // Validate submitted OTP
  // ----------------------------------------------------------

  if (
    !normalizedOTP ||
    !/^\d+$/.test(
      normalizedOTP
    )
  ) {
    return false;
  }

  // ----------------------------------------------------------
  // Find active OTP
  // ----------------------------------------------------------

  const record =
    await Otp.findOne(
      {
        email: normalizedEmail,
        purpose: normalizedPurpose,
        verified: false,
      } as any
    );

  if (!record) {
    return false;
  }

  // ----------------------------------------------------------
  // Check expiration
  // ----------------------------------------------------------

  if (
    !record.expiresAt ||
    record.expiresAt.getTime() <=
      Date.now()
  ) {
    await record.deleteOne();

    return false;
  }

  // ----------------------------------------------------------
  // Hash submitted OTP
  // ----------------------------------------------------------

  const submittedHash =
    hashOTP(
      normalizedOTP
    );

  const storedHash =
    String(record.otp);

  // ----------------------------------------------------------
  // Timing-safe comparison
  // ----------------------------------------------------------

  if (
    storedHash.length !==
    submittedHash.length
  ) {
    return false;
  }

  const isMatch =
    crypto.timingSafeEqual(
      Buffer.from(
        storedHash,
        "utf8"
      ),
      Buffer.from(
        submittedHash,
        "utf8"
      )
    );

  if (!isMatch) {
    return false;
  }

  // ----------------------------------------------------------
  // Mark OTP as verified
  // ----------------------------------------------------------

  record.verified = true;

  await record.save();

  return true;
}

// ============================================================
// CHECK VALID OTP
// ============================================================

export async function hasValidOTP(
  email: string,
  purpose: OTPPurpose
): Promise<boolean> {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedPurpose =
    normalizePurpose(purpose);

  const otp =
    await Otp.findOne(
      {
        email: normalizedEmail,
        purpose: normalizedPurpose,
        verified: false,
      } as any
    );

  if (!otp) {
    return false;
  }

  // ----------------------------------------------------------
  // Delete expired OTP
  // ----------------------------------------------------------

  if (
    !otp.expiresAt ||
    otp.expiresAt.getTime() <=
      Date.now()
  ) {
    await otp.deleteOne();

    return false;
  }

  return true;
}

// ============================================================
// DELETE OTP
// ============================================================

export async function deleteOTP(
  email: string,
  purpose: OTPPurpose
): Promise<void> {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedPurpose =
    normalizePurpose(purpose);

  await Otp.deleteMany(
    {
      email: normalizedEmail,
      purpose: normalizedPurpose,
    } as any
  );
}

// ============================================================
// GET REMAINING TIME
// ============================================================

export async function getRemainingTime(
  email: string,
  purpose: OTPPurpose
): Promise<number> {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedPurpose =
    normalizePurpose(purpose);

  const otp =
    await Otp.findOne(
      {
        email: normalizedEmail,
        purpose: normalizedPurpose,
        verified: false,
      } as any
    );

  if (!otp) {
    return 0;
  }

  if (!otp.expiresAt) {
    await otp.deleteOne();

    return 0;
  }

  const difference =
    otp.expiresAt.getTime() -
    Date.now();

  if (difference <= 0) {
    await otp.deleteOne();

    return 0;
  }

  return Math.ceil(
    difference / 1000
  );
}

// ============================================================
// CLEANUP EXPIRED OTPs
// ============================================================

export async function cleanupExpiredOTPs(): Promise<{
  deletedCount: number;
}> {
  const result =
    await Otp.deleteMany(
      {
        expiresAt: {
          $lt: new Date(),
        },
      } as any
    );

  return {
    deletedCount:
      result.deletedCount ?? 0,
  };
}

// ============================================================
// CHECK OTP PURPOSE
// ============================================================

export function isValidOTPPurpose(
  value: unknown
): value is OTPPurpose {
  return (
    typeof value === "string" &&
    OTP_PURPOSES.includes(
      value as OTPPurpose
    )
  );
}

// ============================================================
// NORMALIZE EXTERNAL PURPOSE
// ============================================================
//
// Allows older frontend/API values without changing the
// internal canonical values.
// ============================================================

export function normalizeOTPPurpose(
  value: unknown
): OTPPurpose {
  if (
    typeof value !== "string"
  ) {
    return "registration";
  }

  if (
    OTP_PURPOSES.includes(
      value as OTPPurpose
    )
  ) {
    return value as OTPPurpose;
  }

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
// OTP CONFIGURATION
// ============================================================

export function getOTPConfiguration() {
  return {
    length: OTP_LENGTH,
    expireMinutes:
      OTP_EXPIRE_MINUTES,
    purposes: OTP_PURPOSES,
  };
}