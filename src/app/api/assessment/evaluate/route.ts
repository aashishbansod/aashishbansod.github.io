import "server-only";

import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import connectDB from "@/lib/db";

import getAssessmentAttemptModel, {

  ASSESSMENT_CONSTANTS,

} from "@/models/AssessmentAttempt";

import StudentModel from "@/models/Student";

import { finalizeAssessmentAttempt } from "@/services/assessment.service";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const revalidate = 0;

const C = ASSESSMENT_CONSTANTS;

const MAX_BODY_BYTES = 8 * 1024;

const MAX_ID_LENGTH = 200;

const EVALUATOR_SECRET_HEADER = "x-assessment-evaluator-secret";

type JsonRecord = Record<string, unknown>;

type StoredAttempt = {

  attemptId?: unknown;

  studentId?: unknown;

  status?: unknown;

  mcqScore?: unknown;

  codingScore?: unknown;

  totalScore?: unknown;

  percentage?: unknown;

  passed?: unknown;

};

function json(body: unknown, status = 200): NextResponse {

  return NextResponse.json(body, {

    status,

    headers: {

      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",

      Pragma: "no-cache",

      Expires: "0",

      "X-Content-Type-Options": "nosniff",

      "X-Frame-Options": "DENY",

      "Referrer-Policy": "no-referrer",

      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",

    },

  });

}

function fail(

  message: string,

  code: string,

  status: number,

): NextResponse {

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

function isRecord(value: unknown): value is JsonRecord {

  return (

    typeof value === "object" &&

    value !== null &&

    !Array.isArray(value)

  );

}

function cleanString(value: unknown, max = MAX_ID_LENGTH): string {

  if (typeof value !== "string") return "";

  const result = value.trim();

  if (!result || result.length > max) return "";

  return result;

}

function finiteScore(value: unknown): number | null {

  return typeof value === "number" && Number.isSafeInteger(value)

    ? value

    : null;

}

function constantTimeEqual(

  received: string,

  expected: string,

): boolean {

  const a = Buffer.from(received, "utf8");

  const b = Buffer.from(expected, "utf8");

  if (a.length === 0 || a.length !== b.length) {

    return false;

  }

  return timingSafeEqual(a, b);

}

async function readLimitedJson(

  request: NextRequest,

): Promise<JsonRecord | null> {

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {

    return null;

  }

  const rawLength = request.headers.get("content-length");

  if (rawLength !== null) {

    const contentLength = Number(rawLength);

    if (

      !Number.isSafeInteger(contentLength) ||

      contentLength < 0 ||

      contentLength > MAX_BODY_BYTES

    ) {

      throw new Error("BODY_TOO_LARGE");

    }

  }

  if (!request.body) return null;

  const reader = request.body.getReader();

  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  try {

    while (true) {

      const { done, value } = await reader.read();

      if (done) break;

      if (!value) continue;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {

        await reader.cancel().catch(() => undefined);

        throw new Error("BODY_TOO_LARGE");

      }

      chunks.push(value);

    }

  } finally {

    reader.releaseLock();

  }

  const bytes = new Uint8Array(totalBytes);

  let offset = 0;

  for (const chunk of chunks) {

    bytes.set(chunk, offset);

    offset += chunk.byteLength;

  }

  let parsed: unknown;

  try {

    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

    parsed = JSON.parse(text);

  } catch {

    return null;

  }

  return isRecord(parsed) ? parsed : null;

}

function normalizedStatus(value: unknown): string {

  return typeof value === "string" ? value.trim().toLowerCase() : "";

}

function resultSnapshot(attempt: StoredAttempt) {

  const score = finiteScore(attempt.totalScore) ?? 0;

  const percentage =

    typeof attempt.percentage === "number" &&

    Number.isFinite(attempt.percentage)

      ? attempt.percentage

      : Number(((score / C.TOTAL_MARKS) * 100).toFixed(2));

  return {

    attemptId: String(attempt.attemptId ?? ""),

    status: normalizedStatus(attempt.status),

    mcqScore: finiteScore(attempt.mcqScore) ?? 0,

    codingScore: finiteScore(attempt.codingScore) ?? 0,

    score,

    percentage,

    passed: attempt.passed === true,

    passingMarks: C.PASSING_MARKS,

    totalMarks: C.TOTAL_MARKS,

  };

}

export async function POST(

  request: NextRequest,

): Promise<NextResponse> {

  try {

    const configuredSecret =

      process.env.ASSESSMENT_EVALUATOR_SECRET?.trim() ?? "";

    if (configuredSecret.length < 32) {

      console.error(

        "[assessment/evaluate] Evaluator secret is missing or too short.",

      );

      return fail(

        "Assessment evaluator integration is not configured.",

        "EVALUATOR_NOT_CONFIGURED",

        503,

      );

    }

    const suppliedSecret =

      request.headers.get(EVALUATOR_SECRET_HEADER)?.trim() ?? "";

    if (!constantTimeEqual(suppliedSecret, configuredSecret)) {

      return fail(

        "Evaluator authentication failed.",

        "EVALUATOR_UNAUTHORIZED",

        401,

      );

    }

    const body = await readLimitedJson(request);

    if (!body) {

      return fail(

        "A valid JSON request body is required.",

        "INVALID_REQUEST_BODY",

        400,

      );

    }

    const attemptId = cleanString(body.attemptId);

    const studentId = cleanString(body.studentId);

    const codingScore = finiteScore(body.codingScore);

    if (!attemptId || !studentId) {

      return fail(

        "attemptId and studentId are required.",

        "MISSING_REQUIRED_FIELDS",

        400,

      );

    }

    if (

      codingScore === null ||

      codingScore < 0 ||

      codingScore > C.CODING_TOTAL_MARKS

    ) {

      return fail(

        `codingScore must be an integer between 0 and ${C.CODING_TOTAL_MARKS}.`,

        "INVALID_CODING_SCORE",

        400,

      );

    }

    await connectDB();

    const student = await StudentModel.findOne({ studentId }).select("_id studentId").lean().exec();

    if (!student) {
      return fail(
        "Student account was not found.",
        "STUDENT_NOT_FOUND",
        404,
      );
    }

    const Attempt = await getAssessmentAttemptModel();

    const attempt = (await Attempt.findOne({ attemptId })
      .lean()
      .exec()) as StoredAttempt | null;

    // AssessmentAttempt.studentId is the Student MongoDB ObjectId, not the public studentId.
    if (!attempt || String(attempt.studentId ?? "") !== String(student._id)) {

      return fail(

        "Assessment attempt was not found.",

        "ATTEMPT_NOT_FOUND",

        404,

      );

    }

    const status = normalizedStatus(attempt.status);

    // Idempotent response: retries must not finalize the same result again.

    if (status === "passed" || status === "failed") {

      return json({

        success: true,

        message: "Assessment attempt has already been finalized.",

        code: "ASSESSMENT_ALREADY_FINALIZED",

        data: resultSnapshot(attempt),

      });

    }

    if (status !== "submitted" && status !== "evaluating") {

      return fail(

        "Assessment attempt is not awaiting evaluation.",

        "ATTEMPT_NOT_EVALUATING",

        409,

      );

    }

    // MCQ marks must come from trusted stored data, never from this request.

    const mcqScore = finiteScore(attempt.mcqScore);

    if (

      mcqScore === null ||

      mcqScore < 0 ||

      mcqScore > C.MCQ_TOTAL_MARKS

    ) {

      console.error(

        "[assessment/evaluate] Invalid stored MCQ score.",

        { attemptId },

      );

      return fail(

        "The stored MCQ score is invalid; manual reconciliation is required.",

        "INVALID_STORED_MCQ_SCORE",

        409,

      );

    }

    const totalScore = mcqScore + codingScore;

    if (

      !Number.isSafeInteger(totalScore) ||

      totalScore < 0 ||

      totalScore > C.TOTAL_MARKS

    ) {

      return fail(

        "The calculated total score is outside the assessment limits.",

        "TOTAL_SCORE_OUT_OF_RANGE",

        409,

      );

    }

    const passed = totalScore >= C.PASSING_MARKS;

    const result = await finalizeAssessmentAttempt({

      studentId,

      attemptId,

      score: totalScore,

      mcqScore,

      codingScore,

      passed,

    } as Parameters<typeof finalizeAssessmentAttempt>[0]);

    if (!result.success) {

      const resultCode = String(

        result.code ?? "EVALUATION_FINALIZATION_FAILED",

      );

      const conflict = /CONFLICT|ALREADY|NOT_EVALUATING/i.test(resultCode);

      return fail(

        result.message || "Assessment result could not be finalized.",

        resultCode,

        conflict ? 409 : 422,

      );

    }

    const percentage = Number(

      ((totalScore / C.TOTAL_MARKS) * 100).toFixed(2),

    );

    return json({

      success: true,

      message: result.message,

      code: result.code,

      data: {

        attemptId,

        status: passed ? "passed" : "failed",

        mcqScore,

        codingScore,

        totalScore,

        percentage,

        passed,

        passingMarks: C.PASSING_MARKS,

        totalMarks: C.TOTAL_MARKS,

        studentSyncPending:

          result.code === "ASSESSMENT_FINALIZED_SYNC_PENDING",

      },

    });

  } catch (error) {

    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {

      return fail(

        "Request body is too large.",

        "BODY_TOO_LARGE",

        413,

      );

    }

    // Keep sensitive request data and secrets out of logs.

    console.error("[assessment/evaluate] Request failed.", {

      errorType:

        error instanceof Error ? error.name : "UnknownError",

    });

    return fail(

      "Assessment evaluation could not be completed.",

      "ASSESSMENT_EVALUATION_ERROR",

      500,

    );

  }

}

export function GET(): NextResponse {

  return fail("Method not allowed.", "METHOD_NOT_ALLOWED", 405);

}

export function PUT(): NextResponse {

  return fail("Method not allowed.", "METHOD_NOT_ALLOWED", 405);

}

export function PATCH(): NextResponse {

  return fail("Method not allowed.", "METHOD_NOT_ALLOWED", 405);

}

export function DELETE(): NextResponse {

  return fail("Method not allowed.", "METHOD_NOT_ALLOWED", 405);

}
