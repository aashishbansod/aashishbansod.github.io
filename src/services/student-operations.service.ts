import "server-only";

import { createHmac, randomInt, randomBytes, timingSafeEqual } from "node:crypto";
import { getStudentAdminModel } from "@/models/StudentAdmin";
import { hashPassword } from "@/lib/auth";
import {
  sendStudentAdminOtpEmail,
  sendStudentAdminRegistrationConfirmationEmail,
} from "@/services/email.service";

export type StudentAdminRegistrationInput = {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  invitationKey: string;
};

export type StudentAdminRegistrationResult = {
  success: true;
  message: string;
  adminId: string;
  email: string;
  username: string;
  expiresInMinutes: number;
  emailSent: boolean;
};

export type StudentAdminVerificationResult = {
  success: true;
  message: string;
  adminId: string;
  username: string;
  email: string;
  active: true;
  confirmationEmailSent: boolean;
};

export type StudentAdminResendOtpInput = {
  email: string;
};

export type StudentAdminVerifyOtpInput = {
  email: string;
  otp: string;
};

export class StudentOperationsServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "StudentOperationsServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_RESENDS = 5;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;
const MAX_INVITATION_KEY_LENGTH = 512;
const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 20;
const MAX_USERNAME_LENGTH = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/;
const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;
const LOGIN_URL = "/login?mode=student-admin";


function clean(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/\u0000/g, "").trim().slice(0, maxLength)
    : "";
}

function normalizeEmail(value: unknown): string {
  return clean(value, 254).toLowerCase();
}

function normalizeUsername(value: unknown): string {
  return clean(value, MAX_USERNAME_LENGTH).toLowerCase();
}

type PlainRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getRequiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new StudentOperationsServiceError(
      "REGISTRATION_NOT_CONFIGURED",
      "Student Admin registration is temporarily unavailable.",
      503,
    );
  }
  return value;
}

function getOtpSecret(): string {
  return getRequiredSecret("STUDENT_ADMIN_OTP_SECRET");
}

function getInvitationSecret(): string {
  return getRequiredSecret("STUDENT_ADMIN_REGISTRATION_KEY");
}

function safeSecretCompare(provided: string, expected: string): boolean {
  const left = Buffer.from(provided, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function createOtp(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function hashOtp(email: string, otp: string): string {
  return createHmac("sha256", getOtpSecret())
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest("hex");
}

function isMatchingOtp(providedHash: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(providedHash) || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(providedHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function generateAdminId(): string {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `CN-OPS-ADMIN-${year}-${suffix}`;
}

function validateRegistration(input: StudentAdminRegistrationInput): {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
} {
  if (!isRecord(input)) {
    throw new StudentOperationsServiceError("INVALID_INPUT", "Registration details are invalid.");
  }

  const fullName = clean(input.fullName, MAX_NAME_LENGTH);
  const email = normalizeEmail(input.email);
  const phone = clean(input.phone, MAX_PHONE_LENGTH);
  const username = normalizeUsername(input.username);
  const password = typeof input.password === "string" ? input.password : "";

  if (fullName.length < 2) {
    throw new StudentOperationsServiceError("INVALID_NAME", "Enter a valid full name.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new StudentOperationsServiceError("INVALID_EMAIL", "Enter a valid email address.");
  }
  if (!PHONE_PATTERN.test(phone.replace(/[\s()-]/g, ""))) {
    throw new StudentOperationsServiceError("INVALID_PHONE", "Enter a valid phone number with country code.");
  }
  if (
    username.length < 3 ||
    username.length > MAX_USERNAME_LENGTH ||
    !USERNAME_PATTERN.test(username)
  ) {
    throw new StudentOperationsServiceError(
      "INVALID_USERNAME",
      "Username must be 3–30 characters and use lowercase letters, numbers, dots, underscores or hyphens.",
    );
  }
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH ||
    password.trim() !== password ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new StudentOperationsServiceError(
      "WEAK_PASSWORD",
      "Password must be 10–128 characters and include uppercase, lowercase and a number.",
    );
  }

  return {
    fullName,
    email,
    phone: phone.replace(/[\s()-]/g, ""),
    username,
    password,
  };
}

function getEmailDeliveryError(): StudentOperationsServiceError {
  return new StudentOperationsServiceError(
    "OTP_EMAIL_DELIVERY_FAILED",
    "Registration was saved, but the verification email could not be delivered. Use resend OTP after the cooldown.",
    502,
  );
}

async function sendOtp(email: string, name: string, otp: string): Promise<boolean> {
  try {
    await sendStudentAdminOtpEmail({
      email,
      name,
      otp,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
    return true;
  } catch {
    return false;
  }
}

export async function registerStudentAdmin(
  input: StudentAdminRegistrationInput,
): Promise<StudentAdminRegistrationResult> {
  const normalized = validateRegistration(input);
  const invitationKey = clean(input.invitationKey, MAX_INVITATION_KEY_LENGTH);
  const expectedInvitationKey = getInvitationSecret();

  if (!invitationKey || !safeSecretCompare(invitationKey, expectedInvitationKey)) {
    throw new StudentOperationsServiceError(
      "INVALID_INVITATION",
      "Registration invitation is invalid or expired.",
      403,
    );
  }

  const StudentAdmin = await getStudentAdminModel();

  const existing = await StudentAdmin.findOne({
    $or: [
      { email: normalized.email },
      { username: normalized.username },
    ],
  })
    .select("_id email username registrationStatus")
    .lean()
    .exec();

  if (existing) {
    const existingEmail = clean(existing.email, 254).toLowerCase();
    const existingUsername = clean(existing.username, MAX_USERNAME_LENGTH).toLowerCase();
    if (existingEmail === normalized.email) {
      throw new StudentOperationsServiceError(
        "EMAIL_ALREADY_REGISTERED",
        "An account with this email already exists. Sign in or request OTP resend.",
        409,
      );
    }
    if (existingUsername === normalized.username) {
      throw new StudentOperationsServiceError(
        "USERNAME_UNAVAILABLE",
        "This username is already in use. Choose another username.",
        409,
      );
    }
  }

  const now = new Date();
  const otp = createOtp();
  const otpHash = hashOtp(normalized.email, otp);
  const passwordHash = await hashPassword(normalized.password);
  let adminId = "";
  let created = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    adminId = generateAdminId();
    try {
      await StudentAdmin.create({
        adminId,
        username: normalized.username,
        fullName: normalized.fullName,
        email: normalized.email,
        phone: normalized.phone,
        password: passwordHash,
        role: "Student Operations Admin",
        designation: "Student Operations Administrator",
        department: "Student Operations",
        registrationSource: "private-self-registration",
        registrationStatus: "pending-verification",
        isActive: false,
        isEmailVerified: false,
        emailOtpHash: otpHash,
        emailOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        emailOtpAttempts: 0,
        emailOtpSentAt: now,
        emailOtpResendCount: 0,
        createdBy: "private-self-registration",
        updatedBy: "private-self-registration",
      });
      created = true;
      break;
    } catch (error) {
      const duplicate = isRecord(error) && error.code === 11000;
      if (!duplicate) throw error;
      const duplicateKey = isRecord(error) && isRecord(error.keyValue)
        ? error.keyValue
        : {};
      if (duplicateKey.email || duplicateKey.username) {
        throw new StudentOperationsServiceError(
          duplicateKey.email ? "EMAIL_ALREADY_REGISTERED" : "USERNAME_UNAVAILABLE",
          duplicateKey.email
            ? "An account with this email already exists."
            : "This username is already in use.",
          409,
        );
      }
    }
  }

  if (!created) {
    throw new StudentOperationsServiceError(
      "ADMIN_ID_GENERATION_FAILED",
      "Unable to create the Student Admin account. Please try again.",
      503,
    );
  }

  const emailSent = await sendOtp(normalized.email, normalized.fullName, otp);

  return {
    success: true,
    message: emailSent
      ? "Registration saved. Check your email for the verification code."
      : getEmailDeliveryError().message,
    adminId,
    email: normalized.email,
    username: normalized.username,
    expiresInMinutes: OTP_TTL_MINUTES,
    emailSent,
  };
}

export async function verifyStudentAdminRegistrationOtp(
  input: StudentAdminVerifyOtpInput,
): Promise<StudentAdminVerificationResult> {
  const email = normalizeEmail(input?.email);
  const otp = clean(input?.otp, OTP_LENGTH);

  if (!EMAIL_PATTERN.test(email)) {
    throw new StudentOperationsServiceError("INVALID_EMAIL", "Enter a valid email address.");
  }
  if (!/^\d{6}$/.test(otp)) {
    throw new StudentOperationsServiceError("INVALID_OTP", "Enter the six-digit verification code.");
  }

  const StudentAdmin = await getStudentAdminModel();
  const admin = await StudentAdmin.findOne({ email })
    .select("+emailOtpHash")
    .exec();

  if (!admin) {
    throw new StudentOperationsServiceError("REGISTRATION_NOT_FOUND", "Registration was not found.", 404);
  }
  if (admin.registrationStatus === "active" && admin.isEmailVerified === true && admin.isActive === true) {
    throw new StudentOperationsServiceError("ALREADY_VERIFIED", "This Student Admin account is already active.", 409);
  }
  if (admin.registrationStatus !== "pending-verification") {
    throw new StudentOperationsServiceError("REGISTRATION_NOT_PENDING", "This registration cannot be verified.", 409);
  }

  const now = new Date();
  const expiresAt = admin.emailOtpExpiresAt instanceof Date
    ? admin.emailOtpExpiresAt
    : admin.emailOtpExpiresAt
      ? new Date(String(admin.emailOtpExpiresAt))
      : null;
  if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
    throw new StudentOperationsServiceError("OTP_EXPIRED", "Verification code expired. Request a new code.", 410);
  }
  if (admin.emailOtpAttempts >= MAX_OTP_ATTEMPTS) {
    throw new StudentOperationsServiceError("OTP_ATTEMPTS_EXCEEDED", "Too many incorrect codes. Request a new code.", 429);
  }

  const storedHash = clean(admin.emailOtpHash, 256);
  const suppliedHash = hashOtp(email, otp);

  if (!isMatchingOtp(suppliedHash, storedHash)) {
    const updated = await StudentAdmin.updateOne(
      {
        _id: admin._id,
        registrationStatus: "pending-verification",
        emailOtpHash: storedHash,
        emailOtpExpiresAt: { $gt: now },
        emailOtpAttempts: { $lt: MAX_OTP_ATTEMPTS },
      },
      { $inc: { emailOtpAttempts: 1 }, $set: { updatedBy: "private-self-registration" } },
    ).exec();

    if (updated.matchedCount === 0) {
      throw new StudentOperationsServiceError("OTP_INVALID_OR_EXPIRED", "Verification code is invalid or expired.", 409);
    }
    throw new StudentOperationsServiceError("OTP_INVALID", "Verification code is incorrect.", 400);
  }

  const activation = await StudentAdmin.updateOne(
    {
      _id: admin._id,
      registrationStatus: "pending-verification",
      isEmailVerified: false,
      isActive: false,
      emailOtpHash: storedHash,
      emailOtpExpiresAt: { $gt: now },
      emailOtpAttempts: { $lt: MAX_OTP_ATTEMPTS },
    },
    {
      $set: {
        registrationStatus: "active",
        isEmailVerified: true,
        isActive: true,
        emailVerifiedAt: now,
        registrationCompletedAt: now,
        emailOtpHash: null,
        emailOtpExpiresAt: null,
        emailOtpAttempts: 0,
        updatedBy: "private-self-registration",
      },
    },
  ).exec();

  if (activation.modifiedCount !== 1) {
    throw new StudentOperationsServiceError(
      "VERIFICATION_CONFLICT",
      "This verification request has expired or already been completed. Please sign in or request a new code.",
      409,
    );
  }

  let confirmationEmailSent = false;
  try {
    await sendStudentAdminRegistrationConfirmationEmail({
      email,
      name: admin.fullName,
      adminId: admin.adminId,
      username: admin.username,
      loginUrl: LOGIN_URL,
    });
    confirmationEmailSent = true;
  } catch {
    confirmationEmailSent = false;
  }

  return {
    success: true,
    message: confirmationEmailSent
      ? "Email verified. Your Student Operations Admin account is now active."
      : "Email verified and account activated. Confirmation email delivery failed; you can still sign in.",
    adminId: admin.adminId,
    username: admin.username,
    email,
    active: true,
    confirmationEmailSent,
  };
}

export async function resendStudentAdminRegistrationOtp(
  input: StudentAdminResendOtpInput,
): Promise<{
  success: true;
  message: string;
  email: string;
  expiresInMinutes: number;
  emailSent: boolean;
}> {
  const email = normalizeEmail(input?.email);
  if (!EMAIL_PATTERN.test(email)) {
    throw new StudentOperationsServiceError("INVALID_EMAIL", "Enter a valid email address.");
  }

  const StudentAdmin = await getStudentAdminModel();
  const admin = await StudentAdmin.findOne({ email })
    .select("_id fullName email registrationStatus emailOtpSentAt emailOtpResendCount")
    .exec();

  if (!admin || admin.registrationStatus !== "pending-verification") {
    throw new StudentOperationsServiceError(
      "REGISTRATION_NOT_PENDING",
      "A pending Student Admin registration was not found for this email.",
      404,
    );
  }

  const now = new Date();
  const lastSentAt = admin.emailOtpSentAt instanceof Date
    ? admin.emailOtpSentAt
    : admin.emailOtpSentAt
      ? new Date(String(admin.emailOtpSentAt))
      : null;
  if (lastSentAt && now.getTime() - lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (now.getTime() - lastSentAt.getTime())) / 1000,
    );
    throw new StudentOperationsServiceError(
      "OTP_RESEND_COOLDOWN",
      `Please wait ${retryAfter} seconds before requesting another code.`,
      429,
    );
  }

  if (admin.emailOtpResendCount >= MAX_OTP_RESENDS) {
    throw new StudentOperationsServiceError(
      "OTP_RESEND_LIMIT",
      "Maximum OTP resend limit reached. Contact support.",
      429,
    );
  }

  const otp = createOtp();
  const otpHash = hashOtp(email, otp);
  const updated = await StudentAdmin.updateOne(
    {
      _id: admin._id,
      registrationStatus: "pending-verification",
      emailOtpResendCount: { $lt: MAX_OTP_RESENDS },
      $or: [
        { emailOtpSentAt: null },
        { emailOtpSentAt: { $lte: new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS) } },
      ],
    },
    {
      $set: {
        emailOtpHash: otpHash,
        emailOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        emailOtpSentAt: now,
        emailOtpAttempts: 0,
        updatedBy: "private-self-registration",
      },
      $inc: { emailOtpResendCount: 1 },
    },
  ).exec();

  if (updated.modifiedCount !== 1) {
    throw new StudentOperationsServiceError(
      "OTP_RESEND_CONFLICT",
      "A verification code was recently sent. Please wait before trying again.",
      409,
    );
  }

  const emailSent = await sendOtp(email, admin.fullName, otp);

  return {
    success: true,
    message: emailSent
      ? "A new verification code has been sent."
      : getEmailDeliveryError().message,
    email,
    expiresInMinutes: OTP_TTL_MINUTES,
    emailSent,
  };
}


export const studentOperationsService = {
  registerStudentAdmin,
  verifyStudentAdminRegistrationOtp,
  resendStudentAdminRegistrationOtp,
};

export default studentOperationsService;
