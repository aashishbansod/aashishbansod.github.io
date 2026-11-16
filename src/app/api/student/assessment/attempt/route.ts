import "server-only";

import mongoose, { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  STUDENT_AUTH_COOKIE_NAME,
  verifyAuthToken,
} from "@/lib/auth";
import StudentModel from "@/models/Student";
import getAssessmentAttemptModel from "@/models/AssessmentAttempt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;
const MAX_COUNTER = 1000;
const ACTIVE_STATUS = "in-progress";

const EVENT_FIELDS = {
  "tab-switch": "tabSwitches",
  "fullscreen-exit": "fullscreenExitCount",
  copy: "copyAttempts",
  paste: "pasteAttempts",
  shortcut: "shortcutAttempts",
} as const;

type EventType = keyof typeof EVENT_FIELDS;
type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maximum = 200): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).normalize("NFKC").trim().slice(0, maximum);
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function json(
  payload: AnyRecord,
  status = 200,
): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie, Origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}

function fail(message: string, code: string, status: number): NextResponse {
  return json(
    {
      success: false,
      message,
      code,
      error: { code, message },
    },
    status,
  );
}

function ok(data: AnyRecord, message = "Success."): NextResponse {
  return json({ success: true, message, data });
}

function sameOrigin(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    return false;
  }

  const expectedOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      if (new URL(origin).origin !== expectedOrigin) return false;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");

  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== expectedOrigin) return false;
    } catch {
      return false;
    }
  }

  return true;
}

async function authenticateStudent(
  request: NextRequest,
): Promise<
  | { valid: true; studentId: Types.ObjectId }
  | { valid: false; response: NextResponse }
> {
  const token = request.cookies.get(STUDENT_AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return {
      valid: false,
      response: fail("Student login is required.", "UNAUTHORIZED", 401),
    };
  }

  const user = await verifyAuthToken(token);

  if (
    !user ||
    user.role !== "student" ||
    user.sessionType !== "student" ||
    !mongoose.isValidObjectId(user.id)
  ) {
    return {
      valid: false,
      response: fail("A valid student portal session is required.", "INVALID_STUDENT_SESSION", 401),
    };
  }

  await connectDB();

  const student = await StudentModel.findById(user.id)
    .select("_id loginEnabled credentialsGenerated accountLocked lockedUntil credentialsExpiresAt journeyExpired journeyExpiresAt applicationStatus adminApprovalStatus")
    .lean()
    .exec() as unknown as AnyRecord | null;

  if (!student) {
    return {
      valid: false,
      response: fail("Student account was not found.", "STUDENT_NOT_FOUND", 404),
    };
  }

  const now = new Date();
  const lockedUntil = safeDate(student.lockedUntil);
  const credentialsExpiresAt = safeDate(student.credentialsExpiresAt);
  const journeyExpiresAt = safeDate(student.journeyExpiresAt);

  if (student.loginEnabled !== true) {
    return {
      valid: false,
      response: fail("Your student account is not enabled.", "STUDENT_LOGIN_DISABLED", 403),
    };
  }

  if (student.credentialsGenerated !== true) {
    return {
      valid: false,
      response: fail("Your student login credentials are not active.", "STUDENT_CREDENTIALS_NOT_ACTIVE", 403),
    };
  }

  if (
    student.adminApprovalStatus !== "approved" ||
    student.applicationStatus !== "approved"
  ) {
    return {
      valid: false,
      response: fail("Your application is not approved.", "APPLICATION_NOT_APPROVED", 403),
    };
  }

  if (student.accountLocked === true && (!lockedUntil || lockedUntil > now)) {
    return {
      valid: false,
      response: fail("Your student account is temporarily locked.", "STUDENT_ACCOUNT_LOCKED", 403),
    };
  }

  if (credentialsExpiresAt && credentialsExpiresAt <= now) {
    return {
      valid: false,
      response: fail("Your student credentials have expired.", "STUDENT_CREDENTIALS_EXPIRED", 403),
    };
  }

  if (student.journeyExpired === true || (journeyExpiresAt && journeyExpiresAt <= now)) {
    return {
      valid: false,
      response: fail("Your application journey has expired.", "STUDENT_JOURNEY_EXPIRED", 403),
    };
  }

  return {
    valid: true,
    studentId: new Types.ObjectId(user.id),
  };
}

function serializeAttempt(attempt: AnyRecord): AnyRecord {
  return {
    attemptId: cleanText(attempt.attemptId, 100),
    status: cleanText(attempt.status, 40),
    currentPhase: cleanText(attempt.currentPhase, 30),
    startedAt: safeDate(attempt.startedAt)?.toISOString() ?? null,
    deadline: safeDate(attempt.finalDeadline)?.toISOString() ?? null,
    lastActivityAt: safeDate(attempt.lastActivityAt)?.toISOString() ?? null,
    activity: {
      tabSwitches: Number(attempt.tabSwitches) || 0,
      fullscreenExitCount: Number(attempt.fullscreenExitCount) || 0,
      copyAttempts: Number(attempt.copyAttempts) || 0,
      pasteAttempts: Number(attempt.pasteAttempts) || 0,
      shortcutAttempts: Number(attempt.shortcutAttempts) || 0,
    },
  };
}

async function findStudentAttempt(
  attemptId: string,
  studentId: Types.ObjectId,
): Promise<AnyRecord | null> {
  const Attempt = await getAssessmentAttemptModel();

  const attempt = await Attempt.findOne({
    attemptId,
    studentId,
  })
    .select("attemptId status currentPhase startedAt finalDeadline lastActivityAt tabSwitches fullscreenExitCount copyAttempts pasteAttempts shortcutAttempts")
    .lean()
    .exec();

  return attempt as unknown as AnyRecord | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateStudent(request);
    if (!auth.valid) return auth.response;

    const attemptId = cleanText(request.nextUrl.searchParams.get("attemptId"), 100);

    if (!attemptId) {
      return fail("A valid attemptId query parameter is required.", "ATTEMPT_ID_REQUIRED", 400);
    }

    await connectDB();

    const attempt = await findStudentAttempt(attemptId, auth.studentId);

    if (!attempt) {
      return fail("Assessment attempt was not found.", "ATTEMPT_NOT_FOUND", 404);
    }

    return ok(
      { attempt: serializeAttempt(attempt) },
      "Assessment attempt status retrieved successfully.",
    );
  } catch (error) {
    console.error("[student/assessment/attempt] GET failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: isRecord(error) ? cleanText(error.code, 40) : "",
    });
    return fail("Unable to retrieve assessment attempt. Please try again.", "ATTEMPT_READ_FAILED", 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!sameOrigin(request)) {
      return fail("Cross-origin requests are not allowed.", "CROSS_ORIGIN_REQUEST", 403);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return fail("Content-Type must be application/json.", "UNSUPPORTED_CONTENT_TYPE", 415);
    }

    const contentLengthHeader = request.headers.get("content-length");
    const declaredLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
    if (declaredLength !== null && (!Number.isSafeInteger(declaredLength) || declaredLength < 0)) {
      return fail("Invalid Content-Length header.", "INVALID_CONTENT_LENGTH", 400);
    }

    if (declaredLength !== null && declaredLength > MAX_BODY_BYTES) {
      return fail("Request body is too large.", "REQUEST_TOO_LARGE", 413);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return fail("Request body is too large.", "REQUEST_TOO_LARGE", 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("A valid JSON request body is required.", "INVALID_JSON", 400);
    }

    if (!isRecord(body)) {
      return fail("Request body must be a JSON object.", "INVALID_BODY", 400);
    }

    const allowedKeys = new Set(["attemptId", "event"]);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      return fail("The request contains unsupported fields.", "UNSUPPORTED_PAYLOAD", 400);
    }

    const attemptId = cleanText(body.attemptId, 100);
    const event = cleanText(body.event, 40).toLowerCase() as EventType;

    if (!attemptId || attemptId.length < 16) {
      return fail("A valid attemptId is required.", "ATTEMPT_ID_REQUIRED", 400);
    }

    if (!Object.prototype.hasOwnProperty.call(EVENT_FIELDS, event)) {
      return fail("Event must be tab-switch, fullscreen-exit, copy, paste or shortcut.", "INVALID_EVENT", 400);
    }

    const auth = await authenticateStudent(request);
    if (!auth.valid) return auth.response;

    const Attempt = await getAssessmentAttemptModel();
    const field = EVENT_FIELDS[event];
    const now = new Date();

    const updated = await Attempt.findOneAndUpdate(
      {
        attemptId,
        studentId: auth.studentId,
        status: ACTIVE_STATUS,
        finalDeadline: { $gt: now },
        [field]: { $lt: MAX_COUNTER },
      },
      {
        $inc: { [field]: 1 },
        $set: { lastActivityAt: now },
      },
      {
        new: true,
        projection: "attemptId status currentPhase startedAt finalDeadline lastActivityAt tabSwitches fullscreenExitCount copyAttempts pasteAttempts shortcutAttempts",
        runValidators: true,
      },
    )
      .lean()
      .exec();

    if (!updated) {
      const existing = await Attempt.findOne({
        attemptId,
        studentId: auth.studentId,
      })
        .select("status finalDeadline")
        .lean()
        .exec() as unknown as AnyRecord | null;

      if (!existing) {
        return fail("Assessment attempt was not found.", "ATTEMPT_NOT_FOUND", 404);
      }

      if (existing.status !== ACTIVE_STATUS) {
        return fail("This assessment attempt is no longer active.", "ATTEMPT_NOT_ACTIVE", 409);
      }

      if (!safeDate(existing.finalDeadline) || (safeDate(existing.finalDeadline) as Date) <= now) {
        return fail("The assessment deadline has passed.", "ATTEMPT_EXPIRED", 409);
      }

      return fail("The activity counter has reached its maximum allowed value.", "ACTIVITY_LIMIT_REACHED", 409);
    }

    return ok(
      { attempt: serializeAttempt(updated as unknown as AnyRecord) },
      "Assessment activity recorded successfully.",
    );
  } catch (error) {
    console.error("[student/assessment/attempt] POST failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: isRecord(error) ? cleanText(error.code, 40) : "",
    });
    return fail("Unable to record assessment activity. Please try again.", "ATTEMPT_ACTIVITY_FAILED", 500);
  }
}
