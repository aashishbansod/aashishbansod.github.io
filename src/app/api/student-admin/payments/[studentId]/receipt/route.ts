
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import connectDB from "@/lib/db";
import {
  verifyAuthToken,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
} from "@/lib/auth";

import Student from "@/models/Student";
import Payment from "@/models/Payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_STUDENT_ID_LENGTH = 100;

type AnyRecord = Record<string, unknown>;

type RouteContext = {
  params: Promise<{
    studentId: string;
  }>;
};

function cleanString(
  value: unknown,
  maximum = 200,
): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maximum);
}

function requestIdFor(
  request: NextRequest,
): string {
  const supplied = cleanString(
    request.headers.get("x-request-id"),
    100,
  );

  return supplied &&
    /^[a-zA-Z0-9._:-]{8,100}$/.test(supplied)
    ? supplied
    : randomUUID();
}

function secureHeaders(
  requestId: string,
): Headers {
  const headers = new Headers();

  headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );

  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("Vary", "Cookie");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");

  headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );

  headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive",
  );

  headers.set("X-Request-Id", requestId);

  return headers;
}

function failure(
  requestId: string,
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
      requestId,
    },
    {
      status,
      headers: secureHeaders(requestId),
    },
  );
}

async function authenticate(
  request: NextRequest,
  requestId: string,
): Promise<
  | {
      success: true;
      adminId: string;
    }
  | {
      success: false;
      response: NextResponse;
    }
> {
  const token = request.cookies
    .get(STUDENT_ADMIN_AUTH_COOKIE_NAME)
    ?.value
    ?.trim();

  if (!token) {
    return {
      success: false,
      response: failure(
        requestId,
        401,
        "UNAUTHORIZED",
        "Student Operations Admin login is required.",
      ),
    };
  }

  try {
    const user = await verifyAuthToken(token);

    if (
      !user ||
      user.role !== "admin" ||
      user.adminRole !== "Student Operations Admin" ||
      user.sessionType !== "student-admin"
    ) {
      return {
        success: false,
        response: failure(
          requestId,
          403,
          "FORBIDDEN",
          "Only Student Operations Admin can access payment receipts.",
        ),
      };
    }

    const adminId = cleanString(user.id, 150);

    if (!adminId) {
      return {
        success: false,
        response: failure(
          requestId,
          401,
          "INVALID_ADMIN_ID",
          "Administrator identity is invalid.",
        ),
      };
    }

    return {
      success: true,
      adminId,
    };
  } catch (error) {
    console.error(
      "[STUDENT_ADMIN_RECEIPT_AUTH]",
      {
        requestId,
        error,
      },
    );

    return {
      success: false,
      response: failure(
        requestId,
        401,
        "INVALID_SESSION",
        "Your administrator session is invalid or expired.",
      ),
    };
  }
}

function formatDate(
  value: unknown,
): string {
  if (!value) return "Not available";

  const date = new Date(
    value as string | number | Date,
  );

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatAmount(
  amount: number,
  currency: string,
): string {
  const formatted = new Intl.NumberFormat(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(amount);

  return `${currency} ${formatted}`;
}

function pdfSafeText(
  value: unknown,
): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]/g, " ")
    .slice(0, 180);
}

function createPdf(
  lines: string[],
): Buffer {
  const commands: string[] = [
    "BT",
    "/F1 19 Tf",
    "50 790 Td",
    `(${pdfSafeText("CYBERNET TECHNOLOGY")}) Tj`,
    "ET",
    "BT",
    "/F1 14 Tf",
    "50 755 Td",
    "(PAYMENT RECEIPT) Tj",
    "ET",
  ];

  let y = 715;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (line === "") {
      y -= 9;
      continue;
    }

    if (line.startsWith("SECTION:")) {
      y -= 5;

      commands.push(
        "BT",
        "/F1 11 Tf",
        `50 ${y} Td`,
        `(${pdfSafeText(line.slice(8))}) Tj`,
        "ET",
      );

      y -= 23;
      continue;
    }

    commands.push(
      "BT",
      "/F1 10 Tf",
      `50 ${y} Td`,
      `(${pdfSafeText(line)}) Tj`,
      "ET",
    );

    y -= 19;
  }

  commands.push(
    "BT",
    "/F1 8 Tf",
    "50 55 Td",
    "(Computer generated receipt. No physical signature required.) Tj",
    "ET",
  );

  const stream = commands.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",

    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",

    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",

    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",

    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,

    "<< /Title (CyberNet Payment Receipt) /Producer (CyberNet Technology) >>",
  ];

  let pdf = "%PDF-1.4\n";

  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index++) {
    offsets.push(
      Buffer.byteLength(pdf, "ascii"),
    );

    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(
    pdf,
    "ascii",
  );

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index++) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\n`;

  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "ascii");
}

function getSafeFilename(
  studentId: string,
): string {
  const safeId = studentId
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 60);

  return `CyberNet-Payment-Receipt-${safeId || "student"}.pdf`;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  try {
    const authentication = await authenticate(
      request,
      requestId,
    );

    if (!authentication.success) {
      return authentication.response;
    }

    const params = await context.params;

    const requestedStudentId = cleanString(
      params.studentId,
      MAX_STUDENT_ID_LENGTH,
    );

    if (
      !requestedStudentId ||
      requestedStudentId.length < 3
    ) {
      return failure(
        requestId,
        400,
        "INVALID_STUDENT_ID",
        "A valid student ID is required.",
      );
    }

    await connectDB();

    const studentConditions: AnyRecord[] = [
      {
        studentId: requestedStudentId,
      },
    ];

    if (
      mongoose.isValidObjectId(requestedStudentId)
    ) {
      studentConditions.push({
        _id: new mongoose.Types.ObjectId(
          requestedStudentId,
        ),
      });
    }

    const student = await Student.findOne({
      $or: studentConditions,
    })
      .select(
        [
          "_id",
          "studentId",
          "fullName",
          "email",
          "internshipTrack",
          "internshipPlan",
          "paymentStatus",
          "paymentAmount",
          "paymentCurrency",
          "paymentCompletedAt",
          "razorpayOrderId",
          "razorpayPaymentId",
          "studentOpsApprovalStatus",
        ].join(" "),
      )
      .lean()
      .exec();

    if (!student) {
      return failure(
        requestId,
        404,
        "STUDENT_NOT_FOUND",
        "Student record was not found.",
      );
    }

    const studentId = cleanString(
      student.studentId,
      80,
    );

    const razorpayOrderId = cleanString(
      student.razorpayOrderId,
      120,
    );

    const razorpayPaymentId = cleanString(
      student.razorpayPaymentId,
      120,
    );

    if (
      cleanString(student.paymentStatus, 30).toLowerCase() !==
      "paid"
    ) {
      return failure(
        requestId,
        409,
        "PAYMENT_NOT_VERIFIED",
        "A verified successful payment is required to generate this receipt.",
      );
    }

    if (
      !studentId ||
      !razorpayOrderId ||
      !razorpayPaymentId
    ) {
      return failure(
        requestId,
        409,
        "PAYMENT_IDENTIFIERS_MISSING",
        "Verified Razorpay payment identifiers are missing from the student record.",
      );
    }

    const payment = await Payment.findOne({
      studentId,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      status: "success",
      archivedAt: null,
    })
      .select(
        [
          "_id",
          "studentName",
          "studentId",
          "email",
          "internship",
          "amount",
          "status",
          "method",
          "paymentId",
          "orderId",
          "createdAt",
          "updatedAt",
          "archivedAt",
        ].join(" "),
      )
      .lean()
      .exec();

    if (!payment) {
      return failure(
        requestId,
        404,
        "VERIFIED_PAYMENT_NOT_FOUND",
        "A matching successful payment ledger record could not be found.",
      );
    }

    const studentAmount = Number(
      student.paymentAmount,
    );

    const ledgerAmount = Number(
      payment.amount,
    );

    if (
      !Number.isFinite(studentAmount) ||
      !Number.isFinite(ledgerAmount) ||
      studentAmount <= 0 ||
      ledgerAmount <= 0 ||
      Math.round(studentAmount * 100) !==
        Math.round(ledgerAmount * 100)
    ) {
      return failure(
        requestId,
        409,
        "PAYMENT_AMOUNT_MISMATCH",
        "Student payment amount does not match the verified payment ledger.",
      );
    }

    const studentEmail = cleanString(
      student.email,
      254,
    ).toLowerCase();

    const paymentEmail = cleanString(
      payment.email,
      254,
    ).toLowerCase();

    if (
      !studentEmail ||
      !paymentEmail ||
      studentEmail !== paymentEmail
    ) {
      return failure(
        requestId,
        409,
        "PAYMENT_OWNERSHIP_MISMATCH",
        "Student identity does not match the payment ledger.",
      );
    }

    const studentName =
      cleanString(student.fullName, 120) ||
      cleanString(payment.studentName, 120) ||
      "Student";

    const internship =
      cleanString(student.internshipTrack, 150) ||
      cleanString(payment.internship, 150) ||
      "Internship";

    const internshipPlan =
      cleanString(student.internshipPlan, 50) ||
      "Not specified";

    const currency =
      cleanString(student.paymentCurrency, 3)
        .toUpperCase() || "INR";

    const amount = formatAmount(
      ledgerAmount,
      currency,
    );

    const paymentDate = formatDate(
      student.paymentCompletedAt ||
        payment.createdAt,
    );

    const receiptNumber = cleanString(
      payment.paymentId,
      100,
    );

    const lines = [
      "SECTION:RECEIPT INFORMATION",
      `Receipt Reference: ${receiptNumber}`,
      `Generated On: ${formatDate(new Date())}`,
      "",
      "SECTION:STUDENT INFORMATION",
      `Student Name: ${studentName}`,
      `Student ID: ${studentId}`,
      `Email Address: ${studentEmail}`,
      "",
      "SECTION:INTERNSHIP INFORMATION",
      `Internship Domain: ${internship}`,
      `Internship Duration: ${internshipPlan}`,
      "",
      "SECTION:PAYMENT INFORMATION",
      `Transaction Amount: ${amount}`,
      `Payment Status: SUCCESSFUL`,
      `Payment Method: ${cleanString(payment.method, 80) || "Razorpay"}`,
      `Razorpay Payment ID: ${receiptNumber}`,
      `Razorpay Order ID: ${razorpayOrderId}`,
      `Payment Date: ${paymentDate}`,
      "",
      "SECTION:VERIFICATION",
      "Transaction matched against the CyberNet payment ledger.",
      "Payment verification and internship approval are separate processes.",
      `Student Operations Status: ${cleanString(student.studentOpsApprovalStatus, 30) || "pending"}`,
      "",
      "Thank you for choosing CyberNet Technology.",
      "This receipt confirms the recorded payment transaction.",
    ];

    const pdf = createPdf(lines);

    const filename = getSafeFilename(
      studentId,
    );

    const headers = secureHeaders(
      requestId,
    );

    headers.set(
      "Content-Type",
      "application/pdf",
    );

    headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );

    headers.set(
      "Content-Length",
      String(pdf.length),
    );

    headers.set(
      "Content-Transfer-Encoding",
      "binary",
    );

    return new NextResponse(
      new Uint8Array(pdf),
      {
        status: 200,
        headers,
      },
    );
  } catch (error) {
    console.error(
      "[GET /api/student-admin/payments/[studentId]/receipt]",
      {
        requestId,
        adminId: "authenticated",
        error,
      },
    );

    return failure(
      requestId,
      500,
      "RECEIPT_GENERATION_FAILED",
      "Unable to generate the payment receipt. Please try again.",
    );
  }
}

export async function OPTIONS(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...Object.fromEntries(
        secureHeaders(requestId).entries(),
      ),
      Allow: "GET, OPTIONS",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
