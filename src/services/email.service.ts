import crypto from "node:crypto";

/* ============================================================
   CYBERNET CAREERS
   EMAIL SERVICE
   ============================================================

   Production responsibilities:

   - Email verification
   - Main student credentials
   - Dashboard credentials
   - Application approval
   - Payment receipt
   - Assessment result
   - Student Operations approval
   - Password reset
   - Generic notification
   - Resend API integration
   - Retry + timeout handling
   - HTML escaping
   - Safe URL handling
   - Safe logging
   - Server-side environment protection

   Security:

   - Never log passwords.
   - Never expose RESEND_API_KEY.
   - Never send secrets to client-side code.
   - Email failure never rolls back a committed DB state.
   ============================================================ */


/* ============================================================
   TYPES
   ============================================================ */

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

export type SendEmailInput = {
  to:
    | string
    | EmailAddressInput
    | Array<string | EmailAddressInput>;

  subject: string;

  html: string;

  text?: string;

  replyTo?: string;

  tags?: EmailTag[];
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


/* ============================================================
   ERROR
   ============================================================ */

export class EmailServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly cause?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    cause?: unknown,
  ) {
    super(message);

    this.name = "EmailServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}


/* ============================================================
   CONSTANTS
   ============================================================ */

const PROVIDER: EmailProvider = "resend";

const RESEND_API_URL =
  "https://api.resend.com/emails";

const REQUEST_TIMEOUT_MS = 15_000;

const MAX_RETRIES = 3;

const RETRY_BASE_DELAY_MS = 700;

const MAX_EMAIL_LENGTH = 254;

const MAX_SUBJECT_LENGTH = 200;

const MAX_NAME_LENGTH = 120;

const MAX_HTML_LENGTH = 2_000_000;

const MAX_TEXT_LENGTH = 2_000_000;

const MAX_MESSAGE_LENGTH = 10_000;

const DEFAULT_CURRENCY = "INR";

const DEFAULT_BRAND_NAME =
  "CyberNet Careers";

const DEFAULT_COMPANY_NAME =
  "CyberNet Technology";

const DEFAULT_SUPPORT_EMAIL =
  "support@cybernettechnology.in";

const DEFAULT_APP_URL =
  "http://localhost:3000";


/* ============================================================
   ENVIRONMENT
   ============================================================ */

function getEnv(key: string): string {
  return (
    process.env[key]?.trim() || ""
  );
}

function getRequiredEnv(key: string): string {
  const value = getEnv(key);

  if (!value) {
    throw new EmailServiceError(
      "EMAIL_ENV_MISSING",
      `${key} is not configured.`,
      500,
    );
  }

  return value;
}

function getResendApiKey(): string {
  return getRequiredEnv(
    "RESEND_API_KEY",
  );
}

function getFromEmail(): string {
  return (
    getEnv("RESEND_FROM_EMAIL") ||
    getEnv("EMAIL_FROM") ||
    ""
  );
}

function getFromName(): string {
  return (
    getEnv("RESEND_FROM_NAME") ||
    getEnv("EMAIL_FROM_NAME") ||
    DEFAULT_BRAND_NAME
  );
}

function getAppUrl(): string {
  const url =
    getEnv("NEXT_PUBLIC_APP_URL") ||
    getEnv("APP_URL") ||
    DEFAULT_APP_URL;

  return url.replace(/\/+$/, "");
}

function getSupportEmail(): string {
  return (
    getEnv("SUPPORT_EMAIL") ||
    DEFAULT_SUPPORT_EMAIL
  );
}


/* ============================================================
   NORMALIZATION
   ============================================================ */

function cleanString(
  value: unknown,
  maxLength = 500,
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeEmail(
  email: string,
): string {
  const normalized =
    cleanString(
      email,
      MAX_EMAIL_LENGTH,
    ).toLowerCase();

  if (
    !normalized ||
    !isValidEmail(normalized)
  ) {
    throw new EmailServiceError(
      "INVALID_EMAIL",
      "A valid recipient email address is required.",
      400,
    );
  }

  return normalized;
}

function isValidEmail(
  email: string,
): boolean {
  if (
    email.length < 3 ||
    email.length > MAX_EMAIL_LENGTH
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}

function normalizeName(
  name: string,
): string {
  return (
    cleanString(
      name,
      MAX_NAME_LENGTH,
    ) || "Student"
  );
}

function normalizeSubject(
  subject: string,
): string {
  const value =
    cleanString(
      subject,
      MAX_SUBJECT_LENGTH,
    );

  if (!value) {
    throw new EmailServiceError(
      "INVALID_SUBJECT",
      "Email subject is required.",
      400,
    );
  }

  return value;
}

function normalizeStudentId(
  studentId?: string,
): string {
  return cleanString(
    studentId,
    100,
  );
}


/* ============================================================
   HTML SECURITY
   ============================================================ */

function escapeHtml(
  value: unknown,
): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(
  value?: string,
): string {
  const url =
    cleanString(
      value,
      2_000,
    );

  if (!url) {
    return getAppUrl();
  }

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return getAppUrl();
    }

    return parsed.toString();
  } catch {
    return getAppUrl();
  }
}

function requireSafeUrl(
  value: string,
  fieldName: string,
): string {
  const url =
    cleanString(
      value,
      2_000,
    );

  if (!url) {
    throw new EmailServiceError(
      "URL_MISSING",
      `${fieldName} is required.`,
      400,
    );
  }

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      throw new Error("Unsupported URL protocol.");
    }

    return parsed.toString();
  } catch {
    throw new EmailServiceError(
      "INVALID_URL",
      `${fieldName} is invalid.`,
      400,
    );
  }
}

function safeHref(
  value: string,
): string {
  return escapeHtml(
    safeUrl(value),
  );
}


/* ============================================================
   DATE / CURRENCY
   ============================================================ */

function formatDate(
  value?: Date | string,
): string {
  const date =
    value instanceof Date
      ? value
      : value
        ? new Date(value)
        : new Date();

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    },
  ).format(date);
}

function formatAmount(
  amount: number,
  currency = DEFAULT_CURRENCY,
): string {
  const safeAmount =
    Number.isFinite(amount)
      ? amount
      : 0;

  const safeCurrency =
    cleanString(
      currency,
      10,
    ).toUpperCase() ||
    DEFAULT_CURRENCY;

  try {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: safeCurrency,
        maximumFractionDigits: 2,
      },
    ).format(safeAmount);
  } catch {
    return `${safeCurrency} ${safeAmount.toFixed(2)}`;
  }
}


/* ============================================================
   REQUEST ID
   ============================================================ */

function createRequestId(): string {
  return crypto.randomUUID();
}


/* ============================================================
   RECIPIENT NORMALIZATION
   ============================================================ */

function normalizeRecipient(
  value:
    | string
    | EmailAddressInput,
): {
  email: string;
  name?: string;
} {
  if (
    typeof value === "string"
  ) {
    return {
      email:
        normalizeEmail(value),
    };
  }

  return {
    email:
      normalizeEmail(value.email),
    name:
      value.name
        ? normalizeName(value.name)
        : undefined,
  };
}

function normalizeRecipients(
  value:
    | string
    | EmailAddressInput
    | Array<string | EmailAddressInput>,
): Array<{
  email: string;
  name?: string;
}> {
  const list =
    Array.isArray(value)
      ? value
      : [value];

  if (list.length === 0) {
    throw new EmailServiceError(
      "NO_RECIPIENT",
      "At least one recipient is required.",
      400,
    );
  }

  if (list.length > 50) {
    throw new EmailServiceError(
      "TOO_MANY_RECIPIENTS",
      "A maximum of 50 recipients is supported.",
      400,
    );
  }

  return list.map(
    normalizeRecipient,
  );
}


/* ============================================================
   RETRY
   ============================================================ */

function isRetryableStatus(
  status: number,
): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

function retryDelay(
  attempt: number,
): number {
  const exponential =
    RETRY_BASE_DELAY_MS *
    Math.pow(
      2,
      Math.max(
        0,
        attempt - 1,
      ),
    );

  const jitter =
    crypto.randomInt(
      0,
      250,
    );

  return (
    exponential +
    jitter
  );
}


/* ============================================================
   RESEND API
   ============================================================ */

async function sendViaResend(
  input: SendEmailInput,
): Promise<EmailResult> {
  const apiKey =
    getResendApiKey();

  const fromEmail =
    getFromEmail();

  if (!fromEmail) {
    throw new EmailServiceError(
      "EMAIL_FROM_MISSING",
      "RESEND_FROM_EMAIL or EMAIL_FROM is not configured.",
      500,
    );
  }

  const normalizedFrom =
    normalizeEmail(fromEmail);

  const recipients =
    normalizeRecipients(
      input.to,
    );

  const subject =
    normalizeSubject(
      input.subject,
    );

  const html =
    cleanString(
      input.html,
      MAX_HTML_LENGTH,
    );

  if (!html) {
    throw new EmailServiceError(
      "EMAIL_HTML_MISSING",
      "Email HTML content is required.",
      400,
    );
  }

  const text =
    input.text
      ? cleanString(
          input.text,
          MAX_TEXT_LENGTH,
        )
      : "";

  const requestId =
    createRequestId();

  const payload: Record<
    string,
    unknown
  > = {
    from:
      `${getFromName()} <${normalizedFrom}>`,

    to:
      recipients.map(
        (recipient) =>
          recipient.name
            ? `${recipient.name} <${recipient.email}>`
            : recipient.email,
      ),

    subject,

    html,
  };

  if (text) {
    payload.text = text;
  }

  if (
    input.replyTo &&
    isValidEmail(
      input.replyTo.trim().toLowerCase(),
    )
  ) {
    payload.reply_to =
      input.replyTo
        .trim()
        .toLowerCase();
  }

  if (
    input.tags &&
    input.tags.length > 0
  ) {
    payload.tags =
      input.tags
        .slice(0, 10)
        .map((tag) => ({
          name:
            cleanString(
              tag.name,
              50,
            ),
          value:
            cleanString(
              tag.value,
              100,
            ),
        }))
        .filter(
          (tag) =>
            Boolean(
              tag.name &&
              tag.value,
            ),
        );
  }

  let lastError:
    | unknown
    | undefined;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

    try {
      const response =
        await fetch(
          RESEND_API_URL,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${apiKey}`,

              "Content-Type":
                "application/json",

              Accept:
                "application/json",

              "X-Client-Request-Id":
                requestId,
            },

            body:
              JSON.stringify(
                payload,
              ),

            signal:
              controller.signal,
          },
        );

      const responseText =
        await response.text();

      let responseJson:
        Record<string, unknown> = {};

      if (responseText) {
        try {
          responseJson =
            JSON.parse(
              responseText,
            );
        } catch {
          responseJson = {};
        }
      }

      if (response.ok) {
        const messageId =
          typeof responseJson.id ===
          "string"
            ? responseJson.id
            : undefined;

        console.info(
          "[EmailService] Email sent.",
          {
            provider: PROVIDER,
            requestId,
            messageId,
          },
        );

        return {
          success: true,
          messageId,
          provider: PROVIDER,
        };
      }

      const providerMessage =
        typeof responseJson.message ===
        "string"
          ? responseJson.message
          : `Resend request failed with HTTP ${response.status}.`;

      lastError =
        new EmailServiceError(
          "EMAIL_PROVIDER_ERROR",
          providerMessage,
          response.status,
        );

      if (
        !isRetryableStatus(
          response.status,
        ) ||
        attempt >= MAX_RETRIES
      ) {
        break;
      }

      await sleep(
        retryDelay(attempt),
      );
    } catch (error) {
      lastError = error;

      const isAbort =
        error instanceof Error &&
        error.name === "AbortError";

      if (
        attempt >= MAX_RETRIES
      ) {
        break;
      }

      if (
        !isAbort &&
        error instanceof
          EmailServiceError
      ) {
        break;
      }

      await sleep(
        retryDelay(attempt),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  if (
    lastError instanceof
    EmailServiceError
  ) {
    throw lastError;
  }

  throw new EmailServiceError(
    "EMAIL_SEND_FAILED",
    "Unable to send email through the configured provider.",
    502,
    lastError,
  );
}


/* ============================================================
   PUBLIC GENERIC SEND
   ============================================================ */

export async function sendEmail(
  input: SendEmailInput,
): Promise<EmailResult> {
  if (
    !input ||
    typeof input !== "object"
  ) {
    throw new EmailServiceError(
      "INVALID_EMAIL_INPUT",
      "Email input is invalid.",
      400,
    );
  }

  return sendViaResend(
    input,
  );
}


/* ============================================================
   BRAND LAYOUT
   ============================================================ */

function renderLayout(
  params: {
    title: string;
    previewText?: string;
    content: string;
    footerText?: string;
  },
): string {
  const brand =
    escapeHtml(
      DEFAULT_BRAND_NAME,
    );

  const company =
    escapeHtml(
      DEFAULT_COMPANY_NAME,
    );

  const support =
    escapeHtml(
      getSupportEmail(),
    );

  const title =
    escapeHtml(
      params.title,
    );

  const preview =
    escapeHtml(
      params.previewText ||
        params.title,
    );

  const footer =
    escapeHtml(
      params.footerText ||
        "This is an automated message from CyberNet Careers.",
    );

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>${title}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f7fb;
    font-family:Arial,Helvetica,sans-serif;
    color:#172033;
  "
>
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
    "
  >
    ${preview}
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background:#f4f7fb;padding:32px 12px;"
  >
    <tr>
      <td align="center">

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            max-width:640px;
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
            border:1px solid #e5eaf2;
          "
        >

          <tr>
            <td
              style="
                padding:28px 32px;
                background:#101827;
                color:#ffffff;
              "
            >
              <div
                style="
                  font-size:22px;
                  font-weight:700;
                  letter-spacing:.2px;
                "
              >
                ${brand}
              </div>

              <div
                style="
                  margin-top:6px;
                  font-size:13px;
                  color:#b9c5d8;
                "
              >
                ${company}
              </div>
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:34px 32px;
              "
            >
              ${params.content}
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:24px 32px;
                background:#f8fafc;
                border-top:1px solid #e9eef5;
                color:#667085;
                font-size:12px;
                line-height:1.7;
              "
            >
              <div>
                ${footer}
              </div>

              <div
                style="
                  margin-top:8px;
                "
              >
                Support:
                <a
                  href="mailto:${support}"
                  style="
                    color:#3448c5;
                    text-decoration:none;
                  "
                >
                  ${support}
                </a>
              </div>

              <div
                style="
                  margin-top:8px;
                "
              >
                © ${new Date().getFullYear()}
                ${company}. All rights reserved.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
}


/* ============================================================
   COMMON HELPERS
   ============================================================ */

function credentialsText(
  params: {
    name: string;
    studentId: string;
    password: string;
    internship: string;
    loginUrl: string;
    dashboard: boolean;
  },
): string {
  const portal =
    params.dashboard
      ? "Student Dashboard"
      : "Student Portal";

  return [
    `Hello ${params.name},`,
    "",
    `Your ${portal} credentials have been generated.`,
    "",
    `Student ID: ${params.studentId}`,
    `Password: ${params.password}`,
    `Internship: ${params.internship}`,
    "",
    `Login: ${params.loginUrl}`,
    "",
    "Please change your temporary password after your first login.",
    "",
    "Regards,",
    DEFAULT_BRAND_NAME,
  ].join("\n");
}

function button(
  label: string,
  url: string,
): string {
  return `
<a
  href="${safeHref(url)}"
  style="
    display:inline-block;
    padding:13px 22px;
    border-radius:10px;
    background:#101827;
    color:#ffffff;
    text-decoration:none;
    font-weight:700;
    font-size:14px;
  "
>
  ${escapeHtml(label)}
</a>
`;
}


/* ============================================================
   MAIN STUDENT CREDENTIALS
   ============================================================ */

export async function sendStudentCredentialsEmail(
  params: StudentCredentialsEmailInput,
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.studentEmail,
    );

  const name =
    normalizeName(
      params.studentName,
    );

  const studentId =
    normalizeStudentId(
      params.studentId,
    );

  const password =
    cleanString(
      params.password,
      200,
    );

  if (!studentId) {
    throw new EmailServiceError(
      "STUDENT_ID_MISSING",
      "Student ID is required.",
      400,
    );
  }

  if (!password) {
    throw new EmailServiceError(
      "PASSWORD_MISSING",
      "Temporary password is required.",
      400,
    );
  }

  const internship =
    cleanString(
      params.internshipName,
      200,
    ) ||
    "CyberNet Careers Internship";

  const loginUrl =
    safeUrl(
      params.loginUrl ||
        `${getAppUrl()}/student`,
    );

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    line-height:1.3;
    color:#101828;
  "
>
  Welcome to CyberNet Careers
</h1>

<p
  style="
    margin:0 0 24px;
    font-size:15px;
    line-height:1.7;
    color:#475467;
  "
>
  Hello ${escapeHtml(name)}, your main student account
  has been created successfully.
</p>

<div
  style="
    padding:20px;
    background:#f8fafc;
    border:1px solid #e4eaf2;
    border-radius:12px;
  "
>
  <div
    style="
      font-size:12px;
      color:#667085;
      margin-bottom:6px;
    "
  >
    STUDENT ID
  </div>

  <div
    style="
      font-size:18px;
      font-weight:700;
      color:#101828;
      margin-bottom:18px;
    "
  >
    ${escapeHtml(studentId)}
  </div>

  <div
    style="
      font-size:12px;
      color:#667085;
      margin-bottom:6px;
    "
  >
    TEMPORARY PASSWORD
  </div>

  <div
    style="
      font-size:18px;
      font-weight:700;
      color:#101828;
      font-family:monospace;
      word-break:break-all;
    "
  >
    ${escapeHtml(password)}
  </div>
</div>

<p
  style="
    margin:22px 0 8px;
    font-size:14px;
    color:#475467;
  "
>
  Internship
</p>

<p
  style="
    margin:0 0 24px;
    font-size:16px;
    font-weight:600;
    color:#101828;
  "
>
  ${escapeHtml(internship)}
</p>

${button(
  "Open Student Portal",
  loginUrl,
)}

<div
  style="
    margin-top:24px;
    padding:14px 16px;
    background:#fff8e8;
    border:1px solid #f5d98b;
    border-radius:10px;
    color:#795500;
    font-size:13px;
    line-height:1.6;
  "
>
  For security, change this temporary password after
  your first successful login.
</div>
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject:
      "Your CyberNet Careers Student Credentials",

    html:
      renderLayout({
        title:
          "Student Credentials",
        previewText:
          "Your CyberNet Careers student account is ready.",
        content,
      }),

    text:
      credentialsText({
        name,
        studentId,
        password,
        internship,
        loginUrl,
        dashboard: false,
      }),

    tags: [
      {
        name: "category",
        value: "student-credentials",
      },
    ],
  });
}


/* ============================================================
   DASHBOARD CREDENTIALS
   ============================================================ */

export async function sendDashboardCredentialsEmail(
  params: DashboardCredentialsEmailInput,
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.email,
    );

  const name =
    normalizeName(
      params.name,
    );

  const dashboardStudentId =
    normalizeStudentId(
      params.dashboardStudentId,
    );

  const password =
    cleanString(
      params.password,
      200,
    );

  if (!dashboardStudentId) {
    throw new EmailServiceError(
      "DASHBOARD_ID_MISSING",
      "Dashboard Student ID is required.",
      400,
    );
  }

  if (!password) {
    throw new EmailServiceError(
      "PASSWORD_MISSING",
      "Dashboard temporary password is required.",
      400,
    );
  }

  const internship =
    cleanString(
      params.internship,
      200,
    ) ||
    "CyberNet Careers Internship";

  const loginUrl =
    safeUrl(
      params.loginUrl ||
        `${getAppUrl()}/student/dashboard`,
    );

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    line-height:1.3;
    color:#101828;
  "
>
  Your Internship Dashboard Is Ready
</h1>

<p
  style="
    margin:0 0 24px;
    font-size:15px;
    line-height:1.7;
    color:#475467;
  "
>
  Hello ${escapeHtml(name)}, Student Operations has
  approved your internship account and your new
  dashboard credentials are now active.
</p>

<div
  style="
    padding:20px;
    background:#f8fafc;
    border:1px solid #e4eaf2;
    border-radius:12px;
  "
>
  <div
    style="
      font-size:12px;
      color:#667085;
      margin-bottom:6px;
    "
  >
    DASHBOARD STUDENT ID
  </div>

  <div
    style="
      font-size:18px;
      font-weight:700;
      color:#101828;
      margin-bottom:18px;
    "
  >
    ${escapeHtml(dashboardStudentId)}
  </div>

  <div
    style="
      font-size:12px;
      color:#667085;
      margin-bottom:6px;
    "
  >
    TEMPORARY PASSWORD
  </div>

  <div
    style="
      font-size:18px;
      font-weight:700;
      color:#101828;
      font-family:monospace;
      word-break:break-all;
    "
  >
    ${escapeHtml(password)}
  </div>
</div>

<p
  style="
    margin:22px 0 8px;
    font-size:14px;
    color:#475467;
  "
>
  Internship
</p>

<p
  style="
    margin:0 0 24px;
    font-size:16px;
    font-weight:600;
    color:#101828;
  "
>
  ${escapeHtml(internship)}
</p>

${button(
  "Open Internship Dashboard",
  loginUrl,
)}

<div
  style="
    margin-top:24px;
    padding:14px 16px;
    background:#eefbf3;
    border:1px solid #b7e4c7;
    border-radius:10px;
    color:#176b35;
    font-size:13px;
    line-height:1.6;
  "
>
  Your dashboard is now ready for internship tasks,
  daily coding, assessments, progress tracking and projects.
</div>
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject:
      "Your CyberNet Internship Dashboard Is Ready",

    html:
      renderLayout({
        title:
          "Dashboard Credentials",
        previewText:
          "Your CyberNet internship dashboard credentials are ready.",
        content,
      }),

    text:
      credentialsText({
        name,
        studentId:
          dashboardStudentId,
        password,
        internship,
        loginUrl,
        dashboard: true,
      }),

    tags: [
      {
        name: "category",
        value: "dashboard-credentials",
      },
    ],
  });
}


/* ============================================================
   APPLICATION APPROVAL
   ============================================================ */

export async function sendApplicationApprovalEmail(
  params: ApplicationApprovalEmailInput,
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.email,
    );

  const name =
    normalizeName(
      params.name,
    );

  const studentId =
    normalizeStudentId(
      params.studentId,
    );

  if (!studentId) {
    throw new EmailServiceError(
      "STUDENT_ID_MISSING",
      "Student ID is required.",
      400,
    );
  }

  const internship =
    cleanString(
      params.internship,
      200,
    ) ||
    "CyberNet Careers Internship";

  const loginUrl =
    safeUrl(
      params.loginUrl ||
        `${getAppUrl()}/student`,
    );

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    color:#101828;
  "
>
  Application Approved
</h1>

<p
  style="
    margin:0 0 20px;
    font-size:15px;
    line-height:1.7;
    color:#475467;
  "
>
  Hello ${escapeHtml(name)}, your CyberNet Careers
  application has been approved by the Main Admin.
</p>

<div
  style="
    padding:18px;
    background:#eefbf3;
    border:1px solid #b7e4c7;
    border-radius:12px;
    margin-bottom:22px;
  "
>
  <strong style="color:#176b35;">
    Application approved successfully.
  </strong>

  <div
    style="
      margin-top:8px;
      color:#475467;
      font-size:13px;
    "
  >
    Student ID:
    <strong>
      ${escapeHtml(studentId)}
    </strong>
  </div>

  <div
    style="
      margin-top:6px;
      color:#475467;
      font-size:13px;
    "
  >
    Internship:
    <strong>
      ${escapeHtml(internship)}
    </strong>
  </div>
</div>

<p
  style="
    margin:0 0 20px;
    font-size:14px;
    line-height:1.7;
    color:#475467;
  "
>
  You can now sign in to the student portal and
  complete the required assessment.
</p>

${button(
  "Open Student Portal",
  loginUrl,
)}
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject:
      "CyberNet Careers Application Approved",

    html:
      renderLayout({
        title:
          "Application Approved",
        previewText:
          "Your CyberNet Careers application has been approved.",
        content,
      }),

    text: [
      `Hello ${name},`,
      "",
      "Your CyberNet Careers application has been approved.",
      `Student ID: ${studentId}`,
      `Internship: ${internship}`,
      "",
      `Student Portal: ${loginUrl}`,
      "",
      DEFAULT_BRAND_NAME,
    ].join("\n"),

    tags: [
      {
        name: "category",
        value: "application-approval",
      },
    ],
  });
}


/* ============================================================
   PAYMENT RECEIPT
   ============================================================ */

export async function sendPaymentReceiptEmail(
  params: PaymentReceiptEmailInput,
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.email,
    );

  const name =
    normalizeName(
      params.name,
    );

  const studentId =
    normalizeStudentId(
      params.studentId,
    );

  const plan =
    cleanString(
      params.plan,
      100,
    ) ||
    "Internship Plan";

  const paymentId =
    cleanString(
      params.paymentId,
      150,
    );

  if (!paymentId) {
    throw new EmailServiceError(
      "PAYMENT_ID_MISSING",
      "Payment ID is required for receipt email.",
      400,
    );
  }

  const orderId =
    cleanString(
      params.orderId,
      150,
    );

  const currency =
    cleanString(
      params.currency,
      10,
    ).toUpperCase() ||
    DEFAULT_CURRENCY;

  const amount =
    Number.isFinite(
      params.amount,
    )
      ? params.amount
      : 0;

  const internship =
    cleanString(
      params.internship,
      200,
    ) ||
    "CyberNet Careers Internship";

  const paymentDate =
    formatDate(
      params.paymentDate,
    );

  const receiptAmount =
    formatAmount(
      amount,
      currency,
    );

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    color:#101828;
  "
>
  Payment Successful
</h1>

<p
  style="
    margin:0 0 22px;
    font-size:15px;
    line-height:1.7;
    color:#475467;
  "
>
  Hello ${escapeHtml(name)}, your internship payment
  has been successfully verified.
</p>

<div
  style="
    padding:20px;
    background:#eefbf3;
    border:1px solid #b7e4c7;
    border-radius:12px;
    margin-bottom:22px;
  "
>
  <div
    style="
      font-size:13px;
      color:#176b35;
      font-weight:700;
      margin-bottom:6px;
    "
  >
    PAYMENT VERIFIED
  </div>

  <div
    style="
      font-size:26px;
      font-weight:800;
      color:#101828;
    "
  >
    ${escapeHtml(receiptAmount)}
  </div>
</div>

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    border-collapse:collapse;
    font-size:14px;
  "
>
  <tr>
    <td
      style="
        padding:10px 0;
        color:#667085;
        border-bottom:1px solid #eaecf0;
      "
    >
      Student ID
    </td>

    <td
      align="right"
      style="
        padding:10px 0;
        color:#101828;
        font-weight:600;
        border-bottom:1px solid #eaecf0;
      "
    >
      ${escapeHtml(studentId || "—")}
    </td>
  </tr>

  <tr>
    <td
      style="
        padding:10px 0;
        color:#667085;
        border-bottom:1px solid #eaecf0;
      "
    >
      Internship
    </td>

    <td
      align="right"
      style="
        padding:10px 0;
        color:#101828;
        font-weight:600;
        border-bottom:1px solid #eaecf0;
      "
    >
      ${escapeHtml(internship)}
    </td>
  </tr>

  <tr>
    <td
      style="
        padding:10px 0;
        color:#667085;
        border-bottom:1px solid #eaecf0;
      "
    >
      Plan
    </td>

    <td
      align="right"
      style="
        padding:10px 0;
        color:#101828;
        font-weight:600;
        border-bottom:1px solid #eaecf0;
      "
    >
      ${escapeHtml(plan)}
    </td>
  </tr>

  <tr>
    <td
      style="
        padding:10px 0;
        color:#667085;
        border-bottom:1px solid #eaecf0;
      "
    >
      Payment ID
    </td>

    <td
      align="right"
      style="
        padding:10px 0;
        color:#101828;
        font-weight:600;
        word-break:break-all;
        border-bottom:1px solid #eaecf0;
      "
    >
      ${escapeHtml(paymentId)}
    </td>
  </tr>

  <tr>
    <td
      style="
        padding:10px 0;
        color:#667085;
        border-bottom:1px solid #eaecf0;
      "
    >
      Order ID
    </td>

    <td
      align="right"
      style="
        padding:10px 0;
        color:#101828;
        font-weight:600;
        word-break:break-all;
        border-bottom:1px solid #eaecf0;
      "
    >
      ${escapeHtml(orderId || "—")}
    </td>
  </tr>

  <tr>
    <td
      style="
        padding:10px 0;
        color:#667085;
      "
    >
      Date
    </td>

    <td
      align="right"
      style="
        padding:10px 0;
        color:#101828;
        font-weight:600;
      "
    >
      ${escapeHtml(paymentDate)}
    </td>
  </tr>
</table>

<div
  style="
    margin-top:24px;
    padding:14px 16px;
    background:#fff8e8;
    border:1px solid #f5d98b;
    border-radius:10px;
    color:#795500;
    font-size:13px;
    line-height:1.6;
  "
>
  Payment verification completes the payment stage.
  Student Dashboard access is activated separately after
  Student Operations approval.
</div>
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject:
      `CyberNet Careers Payment Receipt - ${receiptAmount}`,

    html:
      renderLayout({
        title:
          "Payment Receipt",
        previewText:
          `Payment of ${receiptAmount} was successfully verified.`,
        content,
      }),

    text: [
      `Hello ${name},`,
      "",
      "Your internship payment has been successfully verified.",
      "",
      `Amount: ${receiptAmount}`,
      `Plan: ${plan}`,
      `Internship: ${internship}`,
      `Payment ID: ${paymentId}`,
      `Order ID: ${orderId || "—"}`,
      `Date: ${paymentDate}`,
      "",
      DEFAULT_BRAND_NAME,
    ].join("\n"),

    tags: [
      {
        name: "category",
        value: "payment-receipt",
      },
    ],
  });
}


/* ============================================================
   ASSESSMENT RESULT
   ============================================================ */

export async function sendAssessmentResultEmail(
  params: AssessmentResultEmailInput,
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.email,
    );

  const name =
    normalizeName(
      params.name,
    );

  const studentId =
    normalizeStudentId(
      params.studentId,
    );

  const assessmentName =
    cleanString(
      params.assessmentName,
      200,
    ) ||
    "Main Assessment";

  const score =
    Number.isFinite(
      params.score,
    )
      ? params.score
      : 0;

  const passingScore =
    Number.isFinite(
      params.passingScore,
    )
      ? params.passingScore
      : 60;

  const passed =
    params.passed === true;

  const attemptNumber =
    Number.isFinite(
      params.attemptNumber,
    )
      ? Math.max(
          1,
          Math.floor(
            params.attemptNumber as number,
          ),
        )
      : undefined;

  const nextStep =
    cleanString(
      params.nextStep,
      500,
    ) ||
    (
      passed
        ? "You can continue to internship selection."
        : "Please review the result and follow the next available assessment instructions."
    );

  const loginUrl =
    safeUrl(
      params.loginUrl ||
        `${getAppUrl()}/student`,
    );

  const statusText =
    passed
      ? "Assessment Passed"
      : "Assessment Not Passed";

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    color:#101828;
  "
>
  ${escapeHtml(statusText)}
</h1>

<p
  style="
    margin:0 0 22px;
    font-size:15px;
    line-height:1.7;
    color:#475467;
  "
>
  Hello ${escapeHtml(name)}, your assessment result
  has been recorded successfully.
</p>

<div
  style="
    padding:22px;
    background:${passed ? "#eefbf3" : "#fff5f5"};
    border:1px solid ${passed ? "#b7e4c7" : "#f3c2c2"};
    border-radius:12px;
    margin-bottom:22px;
  "
>
  <div
    style="
      font-size:12px;
      font-weight:700;
      color:#667085;
      margin-bottom:8px;
    "
  >
    ${escapeHtml(assessmentName)}
  </div>

  <div
    style="
      font-size:34px;
      line-height:1;
      font-weight:800;
      color:#101828;
    "
  >
    ${escapeHtml(score)}
  </div>

  <div
    style="
      margin-top:8px;
      font-size:13px;
      color:#667085;
    "
  >
    Passing score: ${escapeHtml(passingScore)}
  </div>

  ${
    attemptNumber
      ? `
  <div
    style="
      margin-top:8px;
      font-size:13px;
      color:#667085;
    "
  >
    Attempt: ${escapeHtml(attemptNumber)}
  </div>
  `
      : ""
  }
</div>

<p
  style="
    margin:0 0 20px;
    font-size:14px;
    line-height:1.7;
    color:#475467;
  "
>
  ${escapeHtml(nextStep)}
</p>

${button(
  "Open Student Portal",
  loginUrl,
)}
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject:
      `CyberNet Careers - ${statusText}`,

    html:
      renderLayout({
        title:
          statusText,
        previewText:
          `Your ${assessmentName} result has been recorded.`,
        content,
      }),

    text: [
      `Hello ${name},`,
      "",
      statusText,
      `Assessment: ${assessmentName}`,
      `Score: ${score}`,
      `Passing Score: ${passingScore}`,
      attemptNumber
        ? `Attempt: ${attemptNumber}`
        : "",
      "",
      nextStep,
      "",
      `Student Portal: ${loginUrl}`,
      "",
      DEFAULT_BRAND_NAME,
    ].join("\n"),

    tags: [
      {
        name: "category",
        value: "assessment-result",
      },
      {
        name: "result",
        value:
          passed
            ? "passed"
            : "failed",
      },
    ],
  });
}


/* ============================================================
   STUDENT OPERATIONS APPROVAL
   ============================================================ */

export async function sendStudentOperationsApprovalEmail(
  params: StudentOperationsApprovalEmailInput,
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.email,
    );

  const name =
    normalizeName(
      params.name,
    );

  const studentId =
    normalizeStudentId(
      params.studentId,
    );

  const dashboardStudentId =
    normalizeStudentId(
      params.dashboardStudentId,
    );

  if (!dashboardStudentId) {
    throw new EmailServiceError(
      "DASHBOARD_ID_MISSING",
      "Dashboard Student ID is required.",
      400,
    );
  }

  const internship =
    cleanString(
      params.internship,
      200,
    ) ||
    "CyberNet Careers Internship";

  const loginUrl =
    safeUrl(
      params.loginUrl ||
        `${getAppUrl()}/student/dashboard`,
    );

  const startDate =
    params.startDate
      ? formatDate(
          params.startDate,
        )
      : "To be announced";

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    color:#101828;
  "
>
  Internship Account Activated
</h1>

<p
  style="
    margin:0 0 22px;
    font-size:15px;
    line-height:1.7;
    color:#475467;
  "
>
  Hello ${escapeHtml(name)}, your Student Operations
  approval has been completed successfully.
</p>

<div
  style="
    padding:20px;
    background:#eefbf3;
    border:1px solid #b7e4c7;
    border-radius:12px;
    margin-bottom:22px;
  "
>
  <div
    style="
      color:#176b35;
      font-size:13px;
      font-weight:700;
      margin-bottom:12px;
    "
  >
    INTERNSHIP ACTIVATED
  </div>

  <div
    style="
      color:#475467;
      font-size:14px;
      line-height:1.8;
    "
  >
    <strong>Student ID:</strong>
    ${escapeHtml(studentId || "—")}
    <br />

    <strong>Dashboard ID:</strong>
    ${escapeHtml(dashboardStudentId)}
    <br />

    <strong>Internship:</strong>
    ${escapeHtml(internship)}
    <br />

    <strong>Start:</strong>
    ${escapeHtml(startDate)}
  </div>
</div>

<p
  style="
    margin:0 0 20px;
    font-size:14px;
    line-height:1.7;
    color:#475467;
  "
>
  Your dashboard can now be used for daily tasks,
  coding problems, weekly assessments, projects and
  internship progress tracking.
</p>

${button(
  "Open Internship Dashboard",
  loginUrl,
)}
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject:
      "CyberNet Careers Internship Account Activated",

    html:
      renderLayout({
        title:
          "Internship Activated",
        previewText:
          "Your CyberNet internship account has been activated.",
        content,
      }),

    text: [
      `Hello ${name},`,
      "",
      "Your Student Operations approval has been completed.",
      "",
      `Student ID: ${studentId || "—"}`,
      `Dashboard ID: ${dashboardStudentId}`,
      `Internship: ${internship}`,
      `Start: ${startDate}`,
      "",
      `Dashboard: ${loginUrl}`,
      "",
      DEFAULT_BRAND_NAME,
    ].join("\n"),

    tags: [
      {
        name: "category",
        value:
          "student-operations-approval",
      },
    ],
  });
}


/* ============================================================
   PASSWORD RESET
   ============================================================ */

export async function sendPasswordResetEmail(
  params: {
    email: string;
    name: string;
    resetUrl: string;
    expiresInMinutes?: number;
    accountType?:
      | "student"
      | "dashboard"
      | "admin";
  },
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.email,
    );

  const name =
    normalizeName(
      params.name,
    );

  const resetUrl =
    requireSafeUrl(
      params.resetUrl,
      "Password reset URL",
    );

  const expiresIn =
    Number.isFinite(
      params.expiresInMinutes,
    )
      ? Math.max(
          1,
          Math.floor(
            params.expiresInMinutes as number,
          ),
        )
      : 30;

  const accountType =
    params.accountType ||
    "student";

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    color:#101828;
  "
>
  Password Reset Request
</h1>

<p
  style="
    margin:0 0 22px;
    font-size:15px;
    line-height:1.7;
    color:#475467;
  "
>
  Hello ${escapeHtml(name)}, we received a request
  to reset your ${escapeHtml(accountType)} account password.
</p>

${button(
  "Reset Password",
  resetUrl,
)}

<div
  style="
    margin-top:24px;
    padding:14px 16px;
    background:#fff8e8;
    border:1px solid #f5d98b;
    border-radius:10px;
    color:#795500;
    font-size:13px;
    line-height:1.6;
  "
>
  This reset link expires in
  ${escapeHtml(expiresIn)} minutes.
  If you did not request this reset, you can safely ignore
  this email.
</div>
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject:
      "CyberNet Careers Password Reset",

    html:
      renderLayout({
        title:
          "Password Reset",
        previewText:
          "A password reset was requested for your account.",
        content,
      }),

    text: [
      `Hello ${name},`,
      "",
      "A password reset was requested for your account.",
      "",
      `Reset password: ${resetUrl}`,
      `Expires in: ${expiresIn} minutes`,
      "",
      "If you did not request this, ignore this email.",
      "",
      DEFAULT_BRAND_NAME,
    ].join("\n"),

    tags: [
      {
        name: "category",
        value: "password-reset",
      },
      {
        name: "account",
        value: accountType,
      },
    ],
  });
}


/* ============================================================
   EMAIL VERIFICATION
   ============================================================ */

export async function sendEmailVerificationEmail(
  params: {
    email: string;
    name: string;
    verificationUrl: string;
    expiresInMinutes?: number;
  },
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.email,
    );

  const name =
    normalizeName(
      params.name,
    );

  const verificationUrl =
    requireSafeUrl(
      params.verificationUrl,
      "Verification URL",
    );

  const expiresIn =
    Number.isFinite(
      params.expiresInMinutes,
    )
      ? Math.max(
          1,
          Math.floor(
            params.expiresInMinutes as number,
          ),
        )
      : 30;

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    color:#101828;
  "
>
  Verify Your Email
</h1>

<p
  style="
    margin:0 0 22px;
    font-size:15px;
    line-height:1.7;
    color:#475467;
  "
>
  Hello ${escapeHtml(name)}, please verify your email
  address to continue with your CyberNet Careers application.
</p>

${button(
  "Verify Email",
  verificationUrl,
)}

<div
  style="
    margin-top:24px;
    padding:14px 16px;
    background:#f8fafc;
    border:1px solid #e4eaf2;
    border-radius:10px;
    color:#475467;
    font-size:13px;
    line-height:1.6;
  "
>
  This verification link expires in
  ${escapeHtml(expiresIn)} minutes.
</div>
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject:
      "Verify Your CyberNet Careers Email",

    html:
      renderLayout({
        title:
          "Email Verification",
        previewText:
          "Verify your email to continue your application.",
        content,
      }),

    text: [
      `Hello ${name},`,
      "",
      "Please verify your email address.",
      "",
      `Verification link: ${verificationUrl}`,
      `Expires in: ${expiresIn} minutes`,
      "",
      DEFAULT_BRAND_NAME,
    ].join("\n"),

    tags: [
      {
        name: "category",
        value: "email-verification",
      },
    ],
  });
}


/* ============================================================
   GENERIC NOTIFICATION
   ============================================================ */

export async function sendNotificationEmail(
  params: {
    email: string;
    name?: string;
    subject: string;
    title: string;
    message: string;
    actionLabel?: string;
    actionUrl?: string;
  },
): Promise<EmailResult> {
  const email =
    normalizeEmail(
      params.email,
    );

  const name =
    normalizeName(
      params.name || "Student",
    );

  const title =
    cleanString(
      params.title,
      200,
    ) ||
    "CyberNet Careers Update";

  const message =
    cleanString(
      params.message,
      MAX_MESSAGE_LENGTH,
    );

  if (!message) {
    throw new EmailServiceError(
      "MESSAGE_MISSING",
      "Notification message is required.",
      400,
    );
  }

  const subject =
    normalizeSubject(
      params.subject,
    );

  const actionUrl =
    params.actionUrl
      ? requireSafeUrl(
          params.actionUrl,
          "Action URL",
        )
      : "";

  const action =
    params.actionLabel &&
    actionUrl
      ? button(
          params.actionLabel,
          actionUrl,
        )
      : "";

  const content = `
<h1
  style="
    margin:0 0 12px;
    font-size:26px;
    color:#101828;
  "
>
  ${escapeHtml(title)}
</h1>

<p
  style="
    margin:0;
    font-size:15px;
    line-height:1.8;
    color:#475467;
    white-space:pre-line;
  "
>
  Hello ${escapeHtml(name)},<br /><br />
  ${escapeHtml(message)}
</p>

<div style="margin-top:20px;">
  ${action}
</div>
`;

  return sendEmail({
    to: {
      email,
      name,
    },

    subject,

    html:
      renderLayout({
        title,
        previewText: title,
        content,
      }),

    text: [
      `Hello ${name},`,
      "",
      message,
      "",
      actionUrl
        ? `${params.actionLabel || "Open"}: ${actionUrl}`
        : "",
      "",
      DEFAULT_BRAND_NAME,
    ].join("\n"),

    tags: [
      {
        name: "category",
        value: "notification",
      },
    ],
  });
}


/* ============================================================
   HEALTH CHECK
   ============================================================ */

export function getEmailServiceStatus(): {
  provider: EmailProvider;
  configured: boolean;
  fromConfigured: boolean;
} {
  return {
    provider: PROVIDER,

    configured:
      Boolean(
        getEnv(
          "RESEND_API_KEY",
        ),
      ),

    fromConfigured:
      Boolean(
        getFromEmail(),
      ),
  };
}


/* ============================================================
   DEFAULT EXPORT
   ============================================================ */

const emailService = {
  sendEmail,

  sendStudentCredentialsEmail,

  sendDashboardCredentialsEmail,

  sendApplicationApprovalEmail,

  sendPaymentReceiptEmail,

  sendAssessmentResultEmail,

  sendStudentOperationsApprovalEmail,

  sendPasswordResetEmail,

  sendEmailVerificationEmail,

  sendNotificationEmail,

  getEmailServiceStatus,
};

export default emailService;