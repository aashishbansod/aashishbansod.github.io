import crypto from "node:crypto";
import { Buffer } from "node:buffer";

export type EmailProvider = "resend";

export type EmailResult = {
  success: boolean;
  messageId?: string;
  provider: EmailProvider;
  errorCode?: string;
  errorMessage?: string;
};

export type EmailAddressInput = {
  email: string;
  name?: string;
};

export type EmailTag = {
  name: string;
  value: string;
};

export type EmailAttachmentInput = {
  filename: string;
  content: string | Uint8Array;
  contentType?: string;
};

export type SendEmailInput = {
  to: string | EmailAddressInput | Array<string | EmailAddressInput>;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: EmailTag[];
  attachments?: EmailAttachmentInput[];
  idempotencyKey?: string;
};

export type StudentCredentialsEmailInput = {
  studentEmail: string;
  studentName: string;
  studentId: string;
  password: string;
  internshipName?: string;
  loginUrl?: string;
};

export type DashboardCredentialsEmailInput = {
  email: string;
  name: string;
  dashboardStudentId: string;
  password: string;
  internship?: string;
  loginUrl?: string;
};

export type ApplicationApprovalEmailInput = {
  email: string;
  name: string;
  studentId: string;
  internship?: string;
  loginUrl?: string;
};

export type PaymentReceiptEmailInput = {
  email: string;
  name: string;
  studentId?: string;
  plan: string;
  amount: number;
  currency?: string;
  paymentId: string;
  orderId?: string;
  paymentDate?: Date | string;
  internship?: string;
};

export type AssessmentResultEmailInput = {
  email: string;
  name: string;
  studentId?: string;
  assessmentName?: string;
  score: number;
  passingScore?: number;
  passed: boolean;
  attemptNumber?: number;
  nextStep?: string;
  loginUrl?: string;
};

export type StudentOperationsApprovalEmailInput = {
  email: string;
  name: string;
  studentId: string;
  dashboardStudentId: string;
  internship?: string;
  startDate?: Date | string;
  loginUrl?: string;
};

export type CertificateEmailInput = {
  email: string;
  name: string;
  certificateId: string;
  internship?: string;
  course?: string;
  issueDate?: Date | string;
  verificationUrl: string;
  pdfBuffer?: Uint8Array;
  pdfBase64?: string;
  pdfFilename?: string;
};

export type StudentAdminOtpEmailInput = {
  email: string;
  name: string;
  otp: string;
  expiresInMinutes?: number;
};

export type StudentAdminRegistrationConfirmationEmailInput = {
  email: string;
  name: string;
  adminId: string;
  username: string;
  loginUrl?: string;
};

export class EmailServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly cause?: unknown;

  constructor(code: string, message: string, statusCode = 500, cause?: unknown) {
    super(message);
    this.name = "EmailServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

const PROVIDER: EmailProvider = "resend";
const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 700;
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 200;
const MAX_NAME_LENGTH = 120;
const MAX_HTML_LENGTH = 2_000_000;
const MAX_TEXT_LENGTH = 2_000_000;
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const DEFAULT_CURRENCY = "INR";
const DEFAULT_BRAND_NAME = "CyberNet Careers";
const DEFAULT_COMPANY_NAME = "CyberNet Technology";
const DEFAULT_SUPPORT_EMAIL = "support@cybernettechnology.in";
const DEFAULT_APP_URL = "http://localhost:3000";

function getEnv(key: string): string {
  return process.env[key]?.trim() || "";
}

function getRequiredEnv(key: string): string {
  const value = getEnv(key);
  if (!value) {
    throw new EmailServiceError("EMAIL_ENV_MISSING", `${key} is not configured.`);
  }
  return value;
}

function getFromEmail(): string {
  return getEnv("RESEND_FROM_EMAIL") || getEnv("EMAIL_FROM");
}

function parseFromAddress(value: string): { email: string; name?: string } {
  const input = cleanString(value, 320);
  const match = input.match(/^(?:"?([^"<]*)"?\s*)?<([^<>\s]+)>$/);

  if (match) {
    const email = normalizeEmail(match[2]);
    const name = cleanString(match[1], MAX_NAME_LENGTH);
    return { email, name: name || undefined };
  }

  return { email: normalizeEmail(input) };
}

function getFromName(): string {
  return getEnv("RESEND_FROM_NAME") || getEnv("EMAIL_FROM_NAME") || DEFAULT_BRAND_NAME;
}

function getAppUrl(): string {
  const value = getEnv("NEXT_PUBLIC_APP_URL") || getEnv("APP_URL") || DEFAULT_APP_URL;
  return value.replace(/\/+$/, "");
}

function getSupportEmail(): string {
  return getEnv("SUPPORT_EMAIL") || DEFAULT_SUPPORT_EMAIL;
}

function cleanString(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function isValidEmail(email: string): boolean {
  return email.length >= 3 && email.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(value: string): string {
  const email = cleanString(value, MAX_EMAIL_LENGTH).toLowerCase();
  if (!isValidEmail(email)) {
    throw new EmailServiceError("INVALID_EMAIL", "A valid recipient email address is required.", 400);
  }
  return email;
}

function normalizeName(value: string): string {
  return cleanString(value, MAX_NAME_LENGTH) || "Student";
}

function normalizeSubject(value: string): string {
  const subject = cleanString(value, MAX_SUBJECT_LENGTH);
  if (!subject) {
    throw new EmailServiceError("INVALID_SUBJECT", "Email subject is required.", 400);
  }
  return subject;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value?: string): string {
  const candidate = cleanString(value, 2000);
  if (!candidate) return getAppUrl();

  try {
    const parsed = new URL(candidate);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) {
      return getAppUrl();
    }
    return parsed.toString();
  } catch {
    return getAppUrl();
  }
}

function requireSafeUrl(value: string, fieldName: string): string {
  const candidate = cleanString(value, 2000);

  try {
    const parsed = new URL(candidate);
    const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (
      !parsed.hostname ||
      (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:"))
    ) {
      throw new Error("Invalid URL");
    }
    return parsed.toString();
  } catch {
    throw new EmailServiceError("INVALID_URL", `${fieldName} must be a valid HTTPS URL.`, 400);
  }
}

function formatDate(value?: Date | string): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatReceiptDate(value?: Date | string): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatAmount(amount: number, currency = DEFAULT_CURRENCY): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new EmailServiceError("INVALID_AMOUNT", "A valid non-negative amount is required.", 400);
  }
  const code = cleanString(currency, 10).toUpperCase() || DEFAULT_CURRENCY;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    throw new EmailServiceError("INVALID_CURRENCY", "Currency code is invalid.", 400);
  }
}

function normalizeRecipient(value: string | EmailAddressInput): { email: string; name?: string } {
  if (typeof value === "string") return { email: normalizeEmail(value) };
  if (!value || typeof value !== "object") {
    throw new EmailServiceError("INVALID_RECIPIENT", "Recipient is invalid.", 400);
  }
  return {
    email: normalizeEmail(value.email),
    name: value.name ? normalizeName(value.name) : undefined,
  };
}

function normalizeRecipients(
  value: string | EmailAddressInput | Array<string | EmailAddressInput>,
): Array<{ email: string; name?: string }> {
  const list = Array.isArray(value) ? value : [value];
  if (!list.length || list.length > 50) {
    throw new EmailServiceError("INVALID_RECIPIENT_COUNT", "Between 1 and 50 recipients are supported.", 400);
  }
  const recipients = list.map(normalizeRecipient);
  if (new Set(recipients.map((item) => item.email)).size !== recipients.length) {
    throw new EmailServiceError("DUPLICATE_RECIPIENT", "Duplicate recipients are not allowed.", 400);
  }
  return recipients;
}

function normalizeTags(tags?: EmailTag[]): Array<{ name: string; value: string }> | undefined {
  if (!tags?.length) return undefined;
  return tags.slice(0, 10).map((tag) => ({
    name: cleanString(tag.name, 50),
    value: cleanString(tag.value, 100),
  })).filter((tag) => /^[a-zA-Z0-9_-]+$/.test(tag.name) && /^[a-zA-Z0-9_-]+$/.test(tag.value));
}

function normalizeAttachments(
  attachments?: EmailAttachmentInput[],
): Array<{ filename: string; content: string; content_type?: string }> | undefined {
  if (!attachments?.length) return undefined;

  if (attachments.length > MAX_ATTACHMENTS) {
    throw new EmailServiceError("TOO_MANY_ATTACHMENTS", `A maximum of ${MAX_ATTACHMENTS} attachments is supported.`, 400);
  }

  let totalBytes = 0;

  const normalized = attachments.map((attachment) => {
    if (!attachment || typeof attachment !== "object") {
      throw new EmailServiceError("INVALID_ATTACHMENT", "An email attachment is invalid.", 400);
    }

    const filename = cleanString(attachment.filename, 180).replace(/[\u0000-\u001F\u007F\/<>:"|?*\\]/g, "_");
    if (!filename || filename === "." || filename === "..") {
      throw new EmailServiceError("INVALID_ATTACHMENT_FILENAME", "A valid attachment filename is required.", 400);
    }

    let content: string;
    let bytes: number;

    if (typeof attachment.content === "string") {
      const base64 = attachment.content.replace(/^data:[^,]*;base64,/i, "").replace(/\s/g, "");
      if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
        throw new EmailServiceError("INVALID_ATTACHMENT_CONTENT", "Attachment content must be valid Base64 or binary data.", 400);
      }
      content = base64;
      bytes = Buffer.from(base64, "base64").byteLength;
    } else if (attachment.content instanceof Uint8Array) {
      bytes = attachment.content.byteLength;
      content = Buffer.from(attachment.content).toString("base64");
    } else {
      throw new EmailServiceError("INVALID_ATTACHMENT_CONTENT", "Attachment content must be Base64 or Uint8Array.", 400);
    }

    if (!bytes || bytes > MAX_ATTACHMENT_BYTES) {
      throw new EmailServiceError("ATTACHMENT_SIZE_INVALID", "Each attachment must be between 1 byte and 8 MB.", 400);
    }

    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new EmailServiceError("ATTACHMENTS_TOO_LARGE", "Total attachment size must not exceed 10 MB.", 400);
    }

    const contentType = cleanString(attachment.contentType, 100).toLowerCase();
    if (contentType && !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(contentType)) {
      throw new EmailServiceError("INVALID_ATTACHMENT_CONTENT_TYPE", "Attachment content type is invalid.", 400);
    }

    return {
      filename,
      content,
      ...(contentType ? { content_type: contentType } : {}),
    };
  });

  return normalized;
}

function renderLayout(params: {
  title: string;
  previewText?: string;
  content: string;
  footerText?: string;
}): string {
  const brand = escapeHtml(getFromName());
  const company = escapeHtml(DEFAULT_COMPANY_NAME);
  const support = escapeHtml(getSupportEmail());
  const title = escapeHtml(params.title);
  const preview = escapeHtml(params.previewText || params.title);
  const footer = escapeHtml(params.footerText || "This is an automated message from CyberNet Careers.");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5eaf2;">
<tr><td style="padding:28px 32px;background:#101827;color:#fff;">
<div style="font-size:22px;font-weight:700;">${brand}</div>
<div style="margin-top:6px;font-size:13px;color:#b9c5d8;">${company}</div>
</td></tr>
<tr><td style="padding:34px 32px;">${params.content}</td></tr>
<tr><td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e9eef5;color:#667085;font-size:12px;line-height:1.7;">
<div>${footer}</div><div style="margin-top:8px;">Support: <a href="mailto:${support}" style="color:#3448c5;text-decoration:none;">${support}</a></div>
<div style="margin-top:8px;">© ${new Date().getFullYear()} ${company}. All rights reserved.</div>
</td></tr></table></td></tr></table></body></html>`;
}

function actionButton(label: string, url: string): string {
  return `<a href="${escapeHtml(safeUrl(url))}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#101827;color:#fff;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(label)}</a>`;
}

function textLines(...lines: Array<string | undefined>): string {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function delay(attempt: number): Promise<void> {
  const wait = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + crypto.randomInt(0, 250);
  return new Promise((resolve) => setTimeout(resolve, wait));
}

export async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  if (!input || typeof input !== "object") {
    throw new EmailServiceError("INVALID_EMAIL_INPUT", "Email input is invalid.", 400);
  }

  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const fromValue = getFromEmail();

  if (!fromValue) {
    throw new EmailServiceError(
      "EMAIL_FROM_MISSING",
      "RESEND_FROM_EMAIL or EMAIL_FROM is not configured.",
    );
  }

  if (!apiKey.startsWith("re_")) {
    throw new EmailServiceError("EMAIL_API_KEY_INVALID", "RESEND_API_KEY is not a valid Resend API key.");
  }

  const fromAddress = parseFromAddress(fromValue);
  const recipients = normalizeRecipients(input.to);
  const subject = normalizeSubject(input.subject);
  const html = cleanString(input.html, MAX_HTML_LENGTH);
  const text = cleanString(input.text, MAX_TEXT_LENGTH);

  if (!html) throw new EmailServiceError("EMAIL_HTML_MISSING", "Email HTML content is required.", 400);

  const payload: Record<string, unknown> = {
    from: `${(fromAddress.name || getFromName()).replace(/[\r\n<>]/g, "")} <${fromAddress.email}>`,
    to: recipients.map((recipient) =>
      recipient.name
        ? `${recipient.name.replace(/[\r\n<>]/g, "")} <${recipient.email}>`
        : recipient.email
    ),
    subject,
    html,
  };

  if (text) payload.text = text;
  if (input.replyTo) payload.reply_to = normalizeEmail(input.replyTo);
  const tags = normalizeTags(input.tags);
  if (tags?.length) payload.tags = tags;
  const attachments = normalizeAttachments(input.attachments);
  if (attachments?.length) payload.attachments = attachments;

  const suppliedIdempotencyKey = cleanString(input.idempotencyKey, 256);
  if (suppliedIdempotencyKey && !/^[A-Za-z0-9._:-]{1,256}$/.test(suppliedIdempotencyKey)) {
    throw new EmailServiceError("INVALID_IDEMPOTENCY_KEY", "Email idempotency key is invalid.", 400);
  }
  const requestId = suppliedIdempotencyKey || crypto.randomUUID();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      });

      const responseText = await response.text();
      let responseJson: Record<string, unknown> = {};
      if (responseText) {
        try {
          const parsed: unknown = JSON.parse(responseText);
          if (parsed && typeof parsed === "object") {
            responseJson = parsed as Record<string, unknown>;
          }
        } catch {
          responseJson = {};
        }
      }

      if (response.ok) {
        const messageId = typeof responseJson.id === "string" ? responseJson.id : undefined;
        console.info("[EmailService] Email accepted.", { provider: PROVIDER, requestId, messageId });
        return { success: true, messageId, provider: PROVIDER };
      }

      const providerMessage = typeof responseJson.message === "string"
        ? cleanString(responseJson.message, 300)
        : `Email provider returned HTTP ${response.status}.`;

      lastError = new EmailServiceError("EMAIL_PROVIDER_ERROR", providerMessage, response.status);
      if (!retryableStatus(response.status) || attempt === MAX_RETRIES) break;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
    } finally {
      clearTimeout(timeout);
    }

    await delay(attempt);
  }

  if (lastError instanceof EmailServiceError) throw lastError;
  throw new EmailServiceError(
    "EMAIL_SEND_FAILED",
    "Unable to send email through the configured provider.",
    502,
    lastError,
  );
}

export async function sendStudentAdminOtpEmail(
  params: StudentAdminOtpEmailInput,
): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const otp = cleanString(params.otp, 12);

  if (!/^\d{6}$/.test(otp)) {
    throw new EmailServiceError("INVALID_OTP", "A six-digit verification code is required.", 400);
  }

  const expiresIn = Number.isInteger(params.expiresInMinutes)
    ? Math.min(30, Math.max(1, params.expiresInMinutes as number))
    : 10;

  const content = `<h1 style="margin:0 0 12px;font-size:26px;color:#101828;">Verify Student Admin Email</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475467;">Hello ${escapeHtml(name)}, use this one-time code to verify your CyberNet Student Operations Admin registration.</p>
<div style="padding:22px;text-align:center;background:#f8fafc;border:1px solid #e4eaf2;border-radius:12px;">
<div style="font-size:12px;letter-spacing:1px;color:#667085;font-weight:700;">YOUR VERIFICATION CODE</div>
<div style="margin-top:10px;font-size:34px;letter-spacing:9px;font-weight:800;color:#101828;font-family:monospace;">${escapeHtml(otp)}</div>
</div>
<div style="margin-top:22px;padding:14px 16px;background:#fff8e8;border:1px solid #f5d98b;border-radius:10px;color:#795500;font-size:13px;line-height:1.6;">This code expires in ${expiresIn} minutes. Do not share this code with anyone. CyberNet staff will never ask you to disclose it.</div>
<p style="margin:20px 0 0;font-size:13px;color:#667085;">If you did not start this registration, you can ignore this email.</p>`;

  return sendEmail({
    to: { email, name },
    subject: "Your CyberNet Student Admin Verification Code",
    html: renderLayout({
      title: "Student Admin Email Verification",
      previewText: "Your one-time verification code for Student Admin registration.",
      content,
    }),
    text: textLines(
      `Hello ${name},`,
      "",
      "Use this one-time code to verify your Student Operations Admin registration.",
      `Verification code: ${otp}`,
      `Expires in: ${expiresIn} minutes`,
      "",
      "Do not share this code with anyone.",
      DEFAULT_BRAND_NAME,
    ),
    tags: [{ name: "category", value: "student-admin-otp" }],
  });
}

export async function sendStudentAdminRegistrationConfirmationEmail(
  params: StudentAdminRegistrationConfirmationEmailInput,
): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const adminId = cleanString(params.adminId, 100);
  const username = cleanString(params.username, 30).toLowerCase();

  if (!adminId || !/^[A-Za-z0-9_-]{3,100}$/.test(adminId)) {
    throw new EmailServiceError("INVALID_ADMIN_ID", "A valid Student Admin ID is required.", 400);
  }
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/.test(username) || username.length < 3 || username.length > 30) {
    throw new EmailServiceError("INVALID_USERNAME", "A valid Student Admin username is required.", 400);
  }

  const loginUrl = safeUrl(params.loginUrl || `${getAppUrl()}/login?mode=student-admin`);
  const content = `<h1 style="margin:0 0 12px;font-size:26px;color:#101828;">Student Admin Account Activated</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475467;">Hello ${escapeHtml(name)}, your email has been verified and your Student Operations Admin account is now active.</p>
<div style="padding:20px;background:#eefbf3;border:1px solid #b7e4c7;border-radius:12px;margin-bottom:22px;">
<div style="font-size:12px;color:#176b35;font-weight:700;margin-bottom:14px;">ACCOUNT DETAILS</div>
<div style="font-size:12px;color:#667085;margin-bottom:5px;">ADMIN ID</div>
<div style="font-size:18px;font-weight:800;color:#101828;margin-bottom:16px;">${escapeHtml(adminId)}</div>
<div style="font-size:12px;color:#667085;margin-bottom:5px;">USERNAME</div>
<div style="font-size:18px;font-weight:700;color:#101828;">${escapeHtml(username)}</div>
</div>
<p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#475467;">You can now sign in using your Admin ID or username and the password you created during registration.</p>
${actionButton("Open Student Admin Login", loginUrl)}
<div style="margin-top:22px;padding:14px 16px;background:#fff8e8;border:1px solid #f5d98b;border-radius:10px;color:#795500;font-size:13px;line-height:1.6;">For your security, your password is not included in this email. Never share your password or verification codes.</div>`;

  return sendEmail({
    to: { email, name },
    subject: "Your CyberNet Student Admin Account Is Active",
    html: renderLayout({
      title: "Student Admin Account Activated",
      previewText: "Your Student Operations Admin account is verified and active.",
      content,
    }),
    text: textLines(
      `Hello ${name},`,
      "",
      "Your Student Operations Admin account is now active.",
      `Admin ID: ${adminId}`,
      `Username: ${username}`,
      `Login: ${loginUrl}`,
      "",
      "Your password is not included in this email.",
      DEFAULT_BRAND_NAME,
    ),
    tags: [{ name: "category", value: "student-admin-registration" }],
  });
}

export async function sendStudentCredentialsEmail(
  params: StudentCredentialsEmailInput,
): Promise<EmailResult> {
  const email = normalizeEmail(params.studentEmail);
  const name = normalizeName(params.studentName);
  const studentId = cleanString(params.studentId, 100);
  const password = cleanString(params.password, 200);
  const internship = cleanString(params.internshipName, 200) || "CyberNet Careers Internship";
  const loginUrl = safeUrl(params.loginUrl || `${getAppUrl()}/student`);

  if (!studentId || !password) {
    throw new EmailServiceError("CREDENTIALS_MISSING", "Student ID and temporary password are required.", 400);
  }

  const content = `<h1 style="margin:0 0 12px;font-size:26px;color:#101828;">Welcome to CyberNet Careers</h1>
<p>Hello ${escapeHtml(name)}, your student account has been created successfully.</p>
<div style="padding:20px;background:#f8fafc;border:1px solid #e4eaf2;border-radius:12px;">
<p><strong>Student ID</strong><br>${escapeHtml(studentId)}</p>
<p><strong>Temporary Password</strong><br>${escapeHtml(password)}</p>
<p><strong>Internship</strong><br>${escapeHtml(internship)}</p>
</div>
<p style="margin:22px 0;">${actionButton("Open Student Portal", loginUrl)}</p>
<p style="font-size:13px;color:#795500;">Change your temporary password after your first login.</p>`;

  return sendEmail({
    to: { email, name },
    subject: "Your CyberNet Careers Student Credentials",
    html: renderLayout({ title: "Student Credentials", content }),
    text: textLines(`Hello ${name},`, `Student ID: ${studentId}`, `Temporary password: ${password}`, `Internship: ${internship}`, `Login: ${loginUrl}`, "Change your temporary password after your first login."),
    tags: [{ name: "category", value: "student-credentials" }],
  });
}

export async function sendDashboardCredentialsEmail(
  params: DashboardCredentialsEmailInput,
): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const studentId = cleanString(params.dashboardStudentId, 100);
  const password = cleanString(params.password, 200);
  const internship = cleanString(params.internship, 200) || "CyberNet Careers Internship";
  const loginUrl = safeUrl(params.loginUrl || `${getAppUrl()}/student/dashboard`);

  if (!studentId || !password) {
    throw new EmailServiceError("CREDENTIALS_MISSING", "Dashboard ID and temporary password are required.", 400);
  }

  const content = `<h1 style="margin:0 0 12px;font-size:26px;color:#101828;">Your Internship Dashboard Is Ready</h1>
<p>Hello ${escapeHtml(name)}, your Student Operations account is ready.</p>
<div style="padding:20px;background:#f8fafc;border:1px solid #e4eaf2;border-radius:12px;">
<p><strong>Dashboard Student ID</strong><br>${escapeHtml(studentId)}</p>
<p><strong>Temporary Password</strong><br>${escapeHtml(password)}</p>
<p><strong>Internship</strong><br>${escapeHtml(internship)}</p>
</div>
<p style="margin:22px 0;">${actionButton("Open Internship Dashboard", loginUrl)}</p>`;

  return sendEmail({
    to: { email, name },
    subject: "Your CyberNet Internship Dashboard Is Ready",
    html: renderLayout({ title: "Dashboard Credentials", content }),
    text: textLines(`Hello ${name},`, `Dashboard ID: ${studentId}`, `Temporary password: ${password}`, `Internship: ${internship}`, `Login: ${loginUrl}`),
    tags: [{ name: "category", value: "dashboard-credentials" }],
  });
}

export async function sendApplicationApprovalEmail(
  params: ApplicationApprovalEmailInput,
): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const studentId = cleanString(params.studentId, 100);
  if (!studentId) throw new EmailServiceError("STUDENT_ID_MISSING", "Student ID is required.", 400);
  const internship = cleanString(params.internship, 200) || "CyberNet Careers Internship";
  const loginUrl = safeUrl(params.loginUrl || `${getAppUrl()}/student`);
  const content = `<h1 style="color:#101828;">Application Approved</h1><p>Hello ${escapeHtml(name)}, your application has been approved by the Main Admin.</p><p><strong>Student ID:</strong> ${escapeHtml(studentId)}</p><p><strong>Internship:</strong> ${escapeHtml(internship)}</p><p>You can now sign in and complete the required assessment.</p>${actionButton("Open Student Portal", loginUrl)}`;

  return sendEmail({
    to: { email, name },
    subject: "CyberNet Careers Application Approved",
    html: renderLayout({ title: "Application Approved", content }),
    text: textLines(`Hello ${name},`, "Your application has been approved.", `Student ID: ${studentId}`, `Internship: ${internship}`, `Student Portal: ${loginUrl}`),
    tags: [{ name: "category", value: "application-approval" }],
  });
}

export async function sendPaymentReceiptEmail(
  params: PaymentReceiptEmailInput,
): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const paymentId = cleanString(params.paymentId, 150);
  if (!paymentId) throw new EmailServiceError("PAYMENT_ID_MISSING", "Payment ID is required.", 400);
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new EmailServiceError("INVALID_AMOUNT", "A positive payment amount is required for a receipt.", 400);
  }
  const amount = formatAmount(params.amount, params.currency);
  const studentId = cleanString(params.studentId, 100) || "—";
  const plan = cleanString(params.plan, 100) || "Internship Plan";
  const internship = cleanString(params.internship, 200) || "CyberNet Careers Internship";
  const orderId = cleanString(params.orderId, 150) || "—";
  const paymentDate = formatReceiptDate(params.paymentDate);
  const idempotencyKey = `payment-receipt-${crypto.createHash("sha256").update(paymentId, "utf8").digest("hex")}`;
  const content = `<h1 style="color:#101828;">Payment Successful</h1><p>Hello ${escapeHtml(name)}, your payment has been verified.</p><div style="padding:20px;background:#eefbf3;border:1px solid #b7e4c7;border-radius:12px;"><strong>Amount Paid</strong><div style="font-size:26px;font-weight:800;">${escapeHtml(amount)}</div></div><p>Student ID: ${escapeHtml(studentId)}</p><p>Plan: ${escapeHtml(plan)}</p><p>Internship: ${escapeHtml(internship)}</p><p>Payment ID: ${escapeHtml(paymentId)}</p><p>Order ID: ${escapeHtml(orderId)}</p><p>Date: ${escapeHtml(paymentDate)}</p><p>Dashboard access is activated separately after Student Operations approval.</p>`;

  return sendEmail({
    to: { email, name },
    subject: `CyberNet Careers Payment Receipt - ${amount}`,
    html: renderLayout({ title: "Payment Receipt", content }),
    text: textLines(`Hello ${name},`, "Your payment has been verified.", `Amount: ${amount}`, `Plan: ${plan}`, `Internship: ${internship}`, `Payment ID: ${paymentId}`, `Order ID: ${orderId}`, `Date: ${paymentDate}`),
    tags: [{ name: "category", value: "payment-receipt" }],
    idempotencyKey,
  });
}

export async function sendAssessmentResultEmail(
  params: AssessmentResultEmailInput,
): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  if (!Number.isFinite(params.score) || params.score < 0) {
    throw new EmailServiceError("INVALID_SCORE", "Assessment score must be a valid non-negative number.", 400);
  }
  const passingScore = Number.isFinite(params.passingScore) && (params.passingScore as number) >= 0
    ? params.passingScore as number
    : 60;
  const passed = params.passed === true;
  const assessment = cleanString(params.assessmentName, 200) || "Main Assessment";
  const nextStep = cleanString(params.nextStep, 500) ||
    (passed ? "You can continue to internship selection." : "Please review your result and follow the available assessment instructions.");
  const loginUrl = safeUrl(params.loginUrl || `${getAppUrl()}/student`);
  const status = passed ? "Assessment Passed" : "Assessment Not Passed";
  const content = `<h1 style="color:#101828;">${escapeHtml(status)}</h1><p>Hello ${escapeHtml(name)}, your result has been recorded.</p><div style="padding:22px;background:${passed ? "#eefbf3" : "#fff5f5"};border-radius:12px;"><div>${escapeHtml(assessment)}</div><div style="font-size:34px;font-weight:800;">${escapeHtml(params.score)}</div><div>Passing score: ${escapeHtml(passingScore)}</div></div><p>${escapeHtml(nextStep)}</p>${actionButton("Open Student Portal", loginUrl)}`;

  return sendEmail({
    to: { email, name },
    subject: `CyberNet Careers - ${status}`,
    html: renderLayout({ title: status, content }),
    text: textLines(`Hello ${name},`, status, `Assessment: ${assessment}`, `Score: ${params.score}`, `Passing score: ${passingScore}`, nextStep, `Student Portal: ${loginUrl}`),
    tags: [
      { name: "category", value: "assessment-result" },
      { name: "result", value: passed ? "passed" : "failed" },
    ],
  });
}

export async function sendStudentOperationsApprovalEmail(
  params: StudentOperationsApprovalEmailInput,
): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const dashboardStudentId = cleanString(params.dashboardStudentId, 100);
  if (!dashboardStudentId) {
    throw new EmailServiceError("DASHBOARD_ID_MISSING", "Dashboard Student ID is required.", 400);
  }
  const studentId = cleanString(params.studentId, 100) || "—";
  const internship = cleanString(params.internship, 200) || "CyberNet Careers Internship";
  const startDate = params.startDate ? formatDate(params.startDate) : "To be announced";
  const loginUrl = safeUrl(params.loginUrl || `${getAppUrl()}/student/dashboard`);
  const content = `<h1 style="color:#101828;">Internship Account Activated</h1><p>Hello ${escapeHtml(name)}, your Student Operations approval is complete.</p><p><strong>Student ID:</strong> ${escapeHtml(studentId)}</p><p><strong>Dashboard ID:</strong> ${escapeHtml(dashboardStudentId)}</p><p><strong>Internship:</strong> ${escapeHtml(internship)}</p><p><strong>Start:</strong> ${escapeHtml(startDate)}</p>${actionButton("Open Internship Dashboard", loginUrl)}`;

  return sendEmail({
    to: { email, name },
    subject: "CyberNet Careers Internship Account Activated",
    html: renderLayout({ title: "Internship Activated", content }),
    text: textLines(`Hello ${name},`, "Your Student Operations approval is complete.", `Student ID: ${studentId}`, `Dashboard ID: ${dashboardStudentId}`, `Internship: ${internship}`, `Start: ${startDate}`, `Dashboard: ${loginUrl}`),
    tags: [{ name: "category", value: "student-operations-approval" }],
  });
}

export async function sendCertificateEmail(
  params: CertificateEmailInput,
): Promise<EmailResult> {
  if (!params || typeof params !== "object") {
    throw new EmailServiceError("INVALID_CERTIFICATE_EMAIL_INPUT", "Certificate email details are invalid.", 400);
  }

  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const certificateId = cleanString(params.certificateId, 120);

  if (!certificateId || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(certificateId)) {
    throw new EmailServiceError("INVALID_CERTIFICATE_ID", "A valid certificate ID is required.", 400);
  }

  const verificationUrl = requireSafeUrl(params.verificationUrl, "Certificate verification URL");
  const internship = cleanString(params.internship, 200) || "CyberNet Careers Internship";
  const course = cleanString(params.course, 200);
  const issueDate = params.issueDate ? formatDate(params.issueDate) : "—";
  const filename = cleanString(params.pdfFilename, 150)
    .replace(/[\u0000-\u001F\u007F\/<>:"|?*\\]/g, "_") || `CyberNet-Certificate-${certificateId}.pdf`;

  let pdf: Buffer;

  if (params.pdfBuffer instanceof Uint8Array) {
    pdf = Buffer.from(params.pdfBuffer);
  } else if (typeof params.pdfBase64 === "string") {
    const base64 = params.pdfBase64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s/g, "");
    if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
      throw new EmailServiceError("INVALID_CERTIFICATE_PDF", "Certificate PDF data is invalid.", 400);
    }
    pdf = Buffer.from(base64, "base64");
  } else {
    throw new EmailServiceError("CERTIFICATE_PDF_MISSING", "A certificate PDF buffer or Base64 value is required.", 400);
  }

  if (!pdf.length || pdf.length > MAX_ATTACHMENT_BYTES) {
    throw new EmailServiceError("CERTIFICATE_PDF_SIZE_INVALID", "Certificate PDF must be between 1 byte and 8 MB.", 400);
  }

  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new EmailServiceError("CERTIFICATE_PDF_INVALID", "The supplied attachment is not a valid PDF file.", 400);
  }

  const courseLine = course
    ? `<tr><td style="padding:10px 0;color:#667085;font-size:13px;">Course</td><td style="padding:10px 0;text-align:right;color:#101828;font-weight:700;">${escapeHtml(course)}</td></tr>`
    : "";

  const content = `<div style="text-align:center;">
    <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#ecfdf3;color:#027a48;font-size:12px;font-weight:700;letter-spacing:.4px;">CERTIFICATE ISSUED</div>
    <h1 style="margin:18px 0 10px;font-size:28px;line-height:1.25;color:#101828;">Congratulations, ${escapeHtml(name)}!</h1>
    <p style="margin:0 auto 24px;max-width:480px;font-size:15px;line-height:1.8;color:#475467;">Your CyberNet Careers certificate has been issued. Your official certificate PDF is attached to this email.</p>
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e4eaf2;border-radius:12px;padding:8px 18px;margin:0 0 24px;">
    <tr><td style="padding:10px 0;color:#667085;font-size:13px;">Certificate ID</td><td style="padding:10px 0;text-align:right;color:#101828;font-weight:700;">${escapeHtml(certificateId)}</td></tr>
    <tr><td style="padding:10px 0;color:#667085;font-size:13px;">Internship</td><td style="padding:10px 0;text-align:right;color:#101828;font-weight:700;">${escapeHtml(internship)}</td></tr>
    ${courseLine}
    <tr><td style="padding:10px 0;color:#667085;font-size:13px;">Issue Date</td><td style="padding:10px 0;text-align:right;color:#101828;font-weight:700;">${escapeHtml(issueDate)}</td></tr>
  </table>
  <div style="text-align:center;margin:0 0 20px;">${actionButton("Verify Certificate", verificationUrl)}</div>
  <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e4eaf2;border-radius:10px;color:#475467;font-size:13px;line-height:1.7;text-align:left;">Keep the attached PDF for your records. Anyone can verify the certificate using the official verification link above. If you believe this email was sent to you by mistake, contact our support team.</div>`;

  return sendEmail({
    to: { email, name },
    subject: `Your CyberNet Careers Certificate - ${certificateId}`,
    html: renderLayout({
      title: "Your Certificate Has Been Issued",
      previewText: "Your official CyberNet Careers certificate PDF is attached.",
      content,
      footerText: "This is an official certificate notification from CyberNet Careers.",
    }),
    text: textLines(
      `Hello ${name},`,
      "",
      "Congratulations! Your CyberNet Careers certificate has been issued.",
      `Certificate ID: ${certificateId}`,
      `Internship: ${internship}`,
      course ? `Course: ${course}` : undefined,
      `Issue Date: ${issueDate}`,
      `Verify certificate: ${verificationUrl}`,
      "",
      "Your official certificate PDF is attached to this email.",
      `Support: ${getSupportEmail()}`,
    ),
    attachments: [{
      filename: filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`,
      content: pdf,
      contentType: "application/pdf",
    }],
    tags: [
      { name: "category", value: "certificate-issued" },
      { name: "certificate", value: "issued" },
    ],
  });
}

export async function sendPasswordResetEmail(params: {
  email: string;
  name: string;
  resetUrl: string;
  expiresInMinutes?: number;
  accountType?: "student" | "dashboard" | "admin";
}): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const resetUrl = requireSafeUrl(params.resetUrl, "Password reset URL");
  const expiresIn = Number.isInteger(params.expiresInMinutes)
    ? Math.min(1440, Math.max(1, params.expiresInMinutes as number))
    : 30;
  const accountType = params.accountType || "student";
  const content = `<h1 style="color:#101828;">Password Reset Request</h1><p>Hello ${escapeHtml(name)}, we received a request to reset your ${escapeHtml(accountType)} account password.</p>${actionButton("Reset Password", resetUrl)}<p style="margin-top:20px;">This link expires in ${expiresIn} minutes. If you did not request this reset, ignore this email.</p>`;

  return sendEmail({
    to: { email, name },
    subject: "CyberNet Careers Password Reset",
    html: renderLayout({ title: "Password Reset", content }),
    text: textLines(`Hello ${name},`, "A password reset was requested.", `Reset password: ${resetUrl}`, `Expires in: ${expiresIn} minutes`, "If you did not request this, ignore this email."),
    tags: [
      { name: "category", value: "password-reset" },
      { name: "account", value: accountType },
    ],
  });
}

export async function sendEmailVerificationEmail(params: {
  email: string;
  name: string;
  verificationUrl: string;
  expiresInMinutes?: number;
}): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name);
  const verificationUrl = requireSafeUrl(params.verificationUrl, "Verification URL");
  const expiresIn = Number.isInteger(params.expiresInMinutes)
    ? Math.min(1440, Math.max(1, params.expiresInMinutes as number))
    : 30;
  const content = `<h1 style="color:#101828;">Verify Your Email</h1><p>Hello ${escapeHtml(name)}, verify your email address to continue.</p>${actionButton("Verify Email", verificationUrl)}<p style="margin-top:20px;">This verification link expires in ${expiresIn} minutes.</p>`;

  return sendEmail({
    to: { email, name },
    subject: "Verify Your CyberNet Careers Email",
    html: renderLayout({ title: "Email Verification", content }),
    text: textLines(`Hello ${name},`, "Please verify your email address.", `Verification link: ${verificationUrl}`, `Expires in: ${expiresIn} minutes`),
    tags: [{ name: "category", value: "email-verification" }],
  });
}

export async function sendNotificationEmail(params: {
  email: string;
  name?: string;
  subject: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}): Promise<EmailResult> {
  const email = normalizeEmail(params.email);
  const name = normalizeName(params.name || "Student");
  const title = cleanString(params.title, 200) || "CyberNet Careers Update";
  const message = cleanString(params.message, MAX_MESSAGE_LENGTH);
  if (!message) throw new EmailServiceError("MESSAGE_MISSING", "Notification message is required.", 400);
  const subject = normalizeSubject(params.subject);
  const actionUrl = params.actionUrl ? requireSafeUrl(params.actionUrl, "Action URL") : "";
  const action = actionUrl ? actionButton(params.actionLabel || "Open", actionUrl) : "";
  const content = `<h1 style="color:#101828;">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.8;white-space:pre-line;">Hello ${escapeHtml(name)},<br><br>${escapeHtml(message)}</p>${action ? `<div style="margin-top:20px;">${action}</div>` : ""}`;

  return sendEmail({
    to: { email, name },
    subject,
    html: renderLayout({ title, previewText: title, content }),
    text: textLines(`Hello ${name},`, "", message, actionUrl ? `${params.actionLabel || "Open"}: ${actionUrl}` : ""),
    tags: [{ name: "category", value: "notification" }],
  });
}

export function getEmailServiceStatus(): {
  provider: EmailProvider;
  configured: boolean;
  fromConfigured: boolean;
} {
  const apiKey = getEnv("RESEND_API_KEY");
  const fromValue = getFromEmail();
  let fromConfigured = false;

  if (fromValue) {
    try {
      parseFromAddress(fromValue);
      fromConfigured = true;
    } catch {
      fromConfigured = false;
    }
  }

  return {
    provider: PROVIDER,
    configured: apiKey.startsWith("re_"),
    fromConfigured,
  };
}

const emailService = {
  sendEmail,
  sendStudentAdminOtpEmail,
  sendStudentAdminRegistrationConfirmationEmail,
  sendStudentCredentialsEmail,
  sendDashboardCredentialsEmail,
  sendApplicationApprovalEmail,
  sendPaymentReceiptEmail,
  sendAssessmentResultEmail,
  sendStudentOperationsApprovalEmail,
  sendCertificateEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendNotificationEmail,
  getEmailServiceStatus,
};

export default emailService;
