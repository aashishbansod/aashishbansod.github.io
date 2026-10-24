import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";

/** CyberNet Careers email service. Email-safe table layouts are used for Gmail/Outlook compatibility. */

const SMTP_HOST = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER?.trim() || "";
const SMTP_PASS = process.env.SMTP_PASS?.trim() || "";
const OTP_EXPIRE_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.OTP_EXPIRE_MINUTES || "10", 10) || 10,
);
const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() ||
  `CyberNet Careers <${SMTP_USER || "no-reply@cybernetsystems.tech"}>`;

function getAppBaseUrl(): string {
  const configured = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).trim();

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_URL or NEXT_PUBLIC_BASE_URL must be configured in production.");
    }
    return "http://localhost:3000";
  }

  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Application base URL must use HTTP or HTTPS.");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("Application base URL must use HTTPS in production.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function getStudentLoginUrl(): string {
  const configured = process.env.STUDENT_LOGIN_URL?.trim();
  const url = configured || `${getAppBaseUrl()}/login`;
  return safeHttpUrl(url, "Student login");
}

const COMMUNITY_URL = (
  process.env.NEXT_PUBLIC_COMMUNITY_URL || process.env.COMMUNITY_URL || ""
).trim();

export type OTPPurpose = "registration" | "login" | "reset-password" | "verification";
const OTP_PURPOSES: readonly OTPPurpose[] = [
  "registration",
  "login",
  "reset-password",
  "verification",
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPurposeLabel(purpose: OTPPurpose): string {
  switch (purpose) {
    case "registration":
      return "Registration";
    case "login":
      return "Login";
    case "reset-password":
      return "Password Reset";
    default:
      return "Email Verification";
  }
}

function validateSMTPConfig(): void {
  if (!SMTP_USER) throw new Error("SMTP_USER is not configured.");
  if (!SMTP_PASS) throw new Error("SMTP_PASS is not configured.");
  if (!Number.isInteger(SMTP_PORT) || SMTP_PORT < 1 || SMTP_PORT > 65535) {
    throw new Error("SMTP_PORT must be a valid port between 1 and 65535.");
  }
}

const transporter: Transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000,
});

export async function verifyMailConnection(): Promise<void> {
  validateSMTPConfig();
  try {
    await transporter.verify();
    console.info("CyberNet Careers SMTP connection verified.");
  } catch (error) {
    console.error("CyberNet Careers SMTP verification failed:", error);
    throw new Error("Unable to connect to SMTP email server.");
  }
}

async function sendEmail(options: SendMailOptions): Promise<void> {
  validateSMTPConfig();
  if (!options.to) throw new Error("Email recipient is required.");
  try {
    const result = await transporter.sendMail({ ...options, from: options.from || EMAIL_FROM });
    // Never log OTPs, passwords, email bodies, or recipient addresses.
    console.info(`CyberNet Careers email accepted by SMTP. Message ID: ${result.messageId}`);
    if (result.rejected?.length) throw new Error("SMTP rejected one or more email recipients.");
  } catch (error) {
    console.error("CyberNet Careers email sending failed:", error);
    throw error;
  }
}

type EmailShellOptions = {
  eyebrow: string;
  title: string;
  subtitle: string;
  content: string;
  footer?: string;
};

/** Shared centered blue-and-white email layout, using inline styles for email-client support. */
function emailShell({
  eyebrow,
  title,
  subtitle,
  content,
  footer = "Automated message from CyberNet Careers. Please do not reply.",
}: EmailShellOptions): string {
  const safeEyebrow = escapeHtml(eyebrow.toUpperCase());
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeFooter = escapeHtml(footer);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${safeTitle} | CyberNet Careers</title>
  <style>
    @media screen and (max-width:620px) {
      .outer-pad{padding:12px 8px!important}
      .card-pad{padding:22px 18px!important}
      .brand-pad{padding:16px 14px!important}
      .mail-title{font-size:23px!important}
      .otp-code{font-size:27px!important;letter-spacing:4px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f1f5fb;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none!important;max-height:0;overflow:hidden;opacity:0;">${safeSubtitle}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f1f5fb;border-collapse:collapse;">
    <tr><td align="center" class="outer-pad" style="padding:24px 12px;">
      <table role="presentation" width="440" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:440px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dce5f2;border-radius:14px;overflow:hidden;table-layout:fixed;">
        <tr><td align="center" class="brand-pad" style="padding:22px 24px;background:#163b8c;background-image:linear-gradient(120deg,#10254a,#245be8);text-align:center;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;"><tr>
            <td align="center" valign="middle" style="width:38px;height:38px;border-radius:10px;background:#ffffff;color:#245be8;font-size:20px;line-height:38px;font-weight:800;">C</td>
            <td align="left" valign="middle" style="padding-left:11px;">
              <div style="font-size:18px;line-height:1.3;font-weight:700;color:#ffffff;">CyberNet Careers</div>
              <div style="margin-top:4px;font-size:9px;line-height:1.4;font-weight:700;letter-spacing:1.5px;color:#dbeafe;">${safeEyebrow}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" class="card-pad" style="padding:30px 34px;background:#ffffff;color:#0f172a;text-align:center;">
          <h1 class="mail-title" style="margin:0 0 10px;font-size:28px;line-height:1.25;font-weight:750;letter-spacing:-.4px;color:#163b8c;text-align:center;">${safeTitle}</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#52627a;text-align:center;">${safeSubtitle}</p>
          ${content}
        </td></tr>
        <tr><td align="center" style="padding:16px 22px;background:#f8faff;border-top:1px solid #e5edf7;text-align:center;font-size:10px;line-height:1.7;color:#738198;">
          <strong style="color:#425574;">CyberNet Careers · CyberNet Technology</strong><br>${safeFooter}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailPanel(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 12px;border-collapse:separate;border-spacing:0;background:#f3f7ff;border:1px solid #d7e4fb;border-radius:10px;">
    <tr><td align="center" style="padding:13px 15px;text-align:center;">
      <div style="margin:0 0 5px;font-size:9px;line-height:1.5;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#607697;">${escapeHtml(label)}</div>
      <div style="font-size:14px;line-height:1.6;font-weight:700;overflow-wrap:anywhere;color:#163b8c;">${escapeHtml(value)}</div>
    </td></tr>
  </table>`;
}

function safeHttpUrl(rawUrl: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} URL is invalid.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} URL must use HTTP or HTTPS.`);
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error(`${label} URL must use HTTPS in production.`);
  }
  return parsed.toString();
}

function communityButton(rawUrl = COMMUNITY_URL): string {
  if (!rawUrl) return "";
  const url = escapeHtml(safeHttpUrl(rawUrl, "Community"));
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:16px auto 8px;"><tr><td align="center" bgcolor="#245be8" style="border-radius:8px;">
    <a href="${url}" style="display:inline-block;padding:12px 20px;border:1px solid #245be8;border-radius:8px;background:#245be8;color:#ffffff;text-decoration:none;font-size:13px;line-height:1.3;font-weight:700;">Join Our Community</a>
  </td></tr></table>`;
}

/** Supported patterns: sendOTPEmail(email, studentName, otp),
 * sendOTPEmail(email, otp, purpose), sendOTPEmail(email, otp, purpose, domain),
 * sendOTPEmail(email, studentName, otp, domain).
 */
export async function sendOTPEmail(
  studentEmail: string,
  secondValue: string,
  thirdValue: string,
  selectedDomain?: string,
): Promise<void> {
  const email = normalizeEmail(studentEmail || "");
  if (!email || !isValidEmail(email)) throw new Error("A valid student email address is required.");
  if (!secondValue?.trim() || !thirdValue?.trim()) throw new Error("OTP information is incomplete.");

  let studentName = "Student";
  let otp = "";
  let purpose: OTPPurpose = "registration";
  const second = secondValue.trim();
  const third = thirdValue.trim();

  if (/^\d{4,8}$/.test(second) && OTP_PURPOSES.includes(third as OTPPurpose)) {
    otp = second;
    purpose = third as OTPPurpose;
  } else {
    studentName = second;
    otp = third;
  }
  if (!/^\d{4,8}$/.test(otp)) throw new Error("Invalid OTP format.");

  const purposeLabel = getPurposeLabel(purpose);
  const domain = selectedDomain?.trim();
  const domainHtml = domain ? detailPanel("Internship domain", domain) : "";
  const domainText = domain ? `\nInternship domain: ${domain}` : "";
  const content = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;text-align:center;">Hello <strong>${escapeHtml(studentName)}</strong>,</p>
    <p style="margin:0 0 14px;font-size:13px;line-height:1.7;color:#52627a;text-align:center;">Enter this one-time code on CyberNet Careers to verify your email. Never share it with anyone.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:16px 0;border-collapse:separate;border-spacing:0;table-layout:fixed;"><tr><td align="center" style="padding:16px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;text-align:center;">
      <div style="margin-bottom:8px;font-size:9px;line-height:1.4;font-weight:700;letter-spacing:1.4px;color:#627694;">VERIFICATION CODE</div>
      <div class="otp-code" style="font-family:Consolas,'Courier New',monospace;font-size:32px;line-height:1.3;font-weight:700;letter-spacing:7px;color:#245be8;overflow-wrap:anywhere;">${escapeHtml(otp)}</div>
    </td></tr></table>
    <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#52627a;text-align:center;">This code expires in <strong>${OTP_EXPIRE_MINUTES} minutes</strong>.</p>
    ${domainHtml}
    <p style="margin:0;padding:11px 12px;background:#f3f7ff;border:1px solid #d7e4fb;border-radius:8px;color:#163b8c;font-size:11px;line-height:1.6;text-align:center;"><strong>Security:</strong> Never share this OTP.</p>`;
  const text = `Hello ${studentName},\n\nYour CyberNet Careers ${purposeLabel.toLowerCase()} code is: ${otp}${domainText}\n\nThis code expires in ${OTP_EXPIRE_MINUTES} minutes. Never share it with anyone.\n\nCyberNet Careers · CyberNet Technology`;

  await sendEmail({
    to: email,
    subject: `CyberNet Careers — ${purposeLabel} code`,
    text,
    html: emailShell({
      eyebrow: purposeLabel,
      title: "Verify your email",
      subtitle: "Enter the one-time code below to continue your application.",
      content,
      footer: `OTP expires in ${OTP_EXPIRE_MINUTES} minutes. If you did not request it, ignore this email.`,
    }),
  });
}

export async function sendApplicationOTP(
  studentEmail: string,
  studentName: string,
  otp: string,
  selectedDomain?: string,
): Promise<void> {
  await sendOTPEmail(studentEmail, studentName, otp, selectedDomain);
}

export interface StudentCredentialsEmailData {
  studentEmail: string;
  studentName: string;
  studentId: string;
  password: string;
  internshipName?: string;
  selectedDomain?: string;
  loginUrl?: string;
  communityUrl?: string;
}

export async function sendStudentCredentialsEmail(data: StudentCredentialsEmailData): Promise<void> {
  const email = normalizeEmail(data.studentEmail || "");
  const studentName = data.studentName?.trim();
  const studentId = data.studentId?.trim();
  const password = data.password?.trim();
  const internshipName = data.selectedDomain?.trim() || data.internshipName?.trim() || "CyberNet Careers Internship";

  if (!email || !isValidEmail(email)) throw new Error("A valid student email address is required.");
  if (!studentName) throw new Error("Student name is required.");
  if (!studentId) throw new Error("Student ID is required.");
  if (!password) throw new Error("Student temporary password is required.");

  const loginUrl = safeHttpUrl(data.loginUrl?.trim() || getStudentLoginUrl(), "Student login");
  const communityUrl = (data.communityUrl || COMMUNITY_URL).trim();
  const safeLoginUrl = escapeHtml(loginUrl);
  const communityHtml = communityButton(communityUrl);
  const communityText = communityUrl ? `\nCommunity: ${safeHttpUrl(communityUrl, "Community")}` : "";

  const content = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;text-align:center;">Hello <strong>${escapeHtml(studentName)}</strong>,</p>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#52627a;text-align:center;">Your CyberNet Careers application has been approved. Your student access details are below.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 13px;border-collapse:separate;border-spacing:0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;"><tr><td align="center" style="padding:13px;text-align:center;">
      <div style="font-size:9px;line-height:1.5;font-weight:700;letter-spacing:.9px;color:#245be8;">APPLICATION STATUS</div>
      <div style="margin-top:4px;font-size:18px;line-height:1.4;font-weight:700;color:#163b8c;">Approved</div>
    </td></tr></table>
    ${detailPanel("Selected internship domain", internshipName)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 14px;border-collapse:separate;border-spacing:0;background:#f3f7ff;border:1px solid #d7e4fb;border-radius:10px;"><tr><td align="center" style="padding:14px 15px;text-align:center;">
      <div style="margin-bottom:5px;font-size:9px;line-height:1.5;font-weight:700;letter-spacing:.9px;color:#607697;">STUDENT ID</div>
      <div style="font-family:Consolas,'Courier New',monospace;font-size:14px;line-height:1.6;font-weight:700;color:#245be8;overflow-wrap:anywhere;">${escapeHtml(studentId)}</div>
      <div style="height:1px;margin:12px 0;background:#d7e4fb;font-size:1px;line-height:1px;">&nbsp;</div>
      <div style="margin-bottom:5px;font-size:9px;line-height:1.5;font-weight:700;letter-spacing:.9px;color:#607697;">TEMPORARY PASSWORD</div>
      <div style="font-family:Consolas,'Courier New',monospace;font-size:13px;line-height:1.6;font-weight:700;color:#163b8c;overflow-wrap:anywhere;">${escapeHtml(password)}</div>
    </td></tr></table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:18px auto 8px;"><tr><td align="center" bgcolor="#245be8" style="border-radius:8px;">
      <a href="${safeLoginUrl}" style="display:inline-block;padding:13px 24px;border:1px solid #245be8;border-radius:8px;background:#245be8;color:#ffffff;text-decoration:none;font-size:13px;line-height:1.4;font-weight:700;">Open Student Login</a>
    </td></tr></table>
    ${communityHtml}
    <p style="margin:18px 0 0;padding:11px 13px;background:#f3f7ff;border:1px solid #d7e4fb;border-radius:8px;color:#425574;font-size:11px;line-height:1.6;text-align:center;"><strong>Security reminder:</strong> Keep your credentials private and change the temporary password after signing in, if that option is available.</p>`;

  const text = `Hello ${studentName},\n\nYour CyberNet Careers application has been approved.\n\nSelected internship domain: ${internshipName}\nStudent ID: ${studentId}\nTemporary password: ${password}\nStudent login: ${loginUrl}${communityText}\n\nKeep your credentials private and change the temporary password after signing in, if available.\n\nCyberNet Careers · CyberNet Technology`;

  await sendEmail({
    to: email,
    subject: "CyberNet Careers — Application approved",
    text,
    html: emailShell({
      eyebrow: "Application update",
      title: "Your application is approved",
      subtitle: "Congratulations! Your application has been approved.",
      content,
      // The unwanted support/footer sentence is intentionally omitted.
      footer: "Your student access details are ready.",
    }),
  });
}

export async function sendApprovalEmail(data: StudentCredentialsEmailData): Promise<void> {
  await sendStudentCredentialsEmail(data);
}

export async function sendApplicationApprovalEmail(data: StudentCredentialsEmailData): Promise<void> {
  await sendStudentCredentialsEmail(data);
}

export async function sendStudentLoginCredentials(
  studentEmail: string,
  studentName: string,
  studentId: string,
  password: string,
): Promise<void> {
  await sendStudentCredentialsEmail({ studentEmail, studentName, studentId, password });
}

export async function sendTestEmail(studentEmail: string): Promise<void> {
  const email = normalizeEmail(studentEmail || "");
  if (!email || !isValidEmail(email)) throw new Error("A valid email address is required.");
  const content = `
    <p style="margin:0 0 12px;font-size:13px;line-height:1.7;color:#334155;text-align:center;">Your CyberNet Careers email service is working.</p>
    <p style="margin:0;padding:12px 13px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#163b8c;font-size:12px;line-height:1.6;font-weight:700;text-align:center;">Email delivery test successful.</p>`;

  await sendEmail({
    to: email,
    subject: "CyberNet Careers — Email service test",
    text: "CyberNet Careers email service test successful.",
    html: emailShell({
      eyebrow: "System test",
      title: "Email service is working",
      subtitle: "This is a test message to verify email delivery.",
      content,
      footer: "This is an automated test message.",
    }),
  });
}

export default transporter;
