import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import connectDB from "@/lib/db";
import getAssessmentAttemptModel, {
  ASSESSMENT_CONSTANTS,
} from "@/models/AssessmentAttempt";
import { finalizeAssessmentAttempt } from "@/services/assessment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const C = ASSESSMENT_CONSTANTS;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_ID_LENGTH = 200;

type JsonRecord = Record<string, unknown>;

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

function fail(message: string, code: string, status: number): NextResponse {
  return json({ success: false, message, code, error: { code, message } }, status);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, max = MAX_ID_LENGTH): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function finiteScore(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function constantTimeEqual(received: string, expected: string): boolean {
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function readLimitedJson(request: NextRequest): Promise<JsonRecord | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isRecord(parsed) ? parsed : null;
}

/**
 * Trusted evaluator callback.
 * This route never executes submitted code. An isolated evaluator must calculate
 * codingScore and call this endpoint with ASSESSMENT_EVALUATOR_SECRET.
 * Never expose that secret in browser/client code.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const configuredSecret = process.env.ASSESSMENT_EVALUATOR_SECRET?.trim();
    if (!configuredSecret || configuredSecret.length < 32) {
      console.error("[assessment/evaluate] Evaluator secret is missing or too short.");
      return fail("Assessment evaluator integration is not configured.", "EVALUATOR_NOT_CONFIGURED", 503);
    }

    const suppliedSecret = request.headers.get("x-assessment-evaluator-secret")?.trim() ?? "";
    if (!constantTimeEqual(suppliedSecret, configuredSecret)) {
      return fail("Evaluator authentication failed.", "EVALUATOR_UNAUTHORIZED", 401);
    }

    const body = await readLimitedJson(request);
    if (!body) return fail("A valid JSON request body is required.", "INVALID_REQUEST_BODY", 400);

    const attemptId = cleanString(body.attemptId);
    const studentId = cleanString(body.studentId);
    const codingScore = finiteScore(body.codingScore);

    if (!attemptId || !studentId) {
      return fail("attemptId and studentId are required.", "MISSING_REQUIRED_FIELDS", 400);
    }

    if (codingScore === null || codingScore < 0 || codingScore > C.CODING_TOTAL_MARKS) {
      return fail(
        `codingScore must be an integer between 0 and ${C.CODING_TOTAL_MARKS}.`,
        "INVALID_CODING_SCORE",
        400,
      );
    }

    await connectDB();
    const Attempt = await getAssessmentAttemptModel();
    const attempt = await Attempt.findOne({ attemptId }).lean().exec() as Record<string, unknown> | null;

    if (!attempt) return fail("Assessment attempt was not found.", "ATTEMPT_NOT_FOUND", 404);

    if (String(attempt.studentId ?? "") !== studentId) {
      return fail("Assessment attempt was not found.", "ATTEMPT_NOT_FOUND", 404);
    }

    const status = String(attempt.status ?? "").toLowerCase();
    if (status === "passed" || status === "failed") {
      return json({
        success: true,
        message: "Assessment attempt has already been finalized.",
        code: "ASSESSMENT_ALREADY_FINALIZED",
        data: {
          attemptId,
          status,
          score: Number(attempt.totalScore ?? 0),
          percentage: Number(attempt.percentage ?? 0),
          passed: attempt.passed === true,
        },
      });
    }

    if (status !== "submitted" && status !== "evaluating") {
      return fail("Assessment attempt is not awaiting evaluation.", "ATTEMPT_NOT_EVALUATING", 409);
    }

    // MCQ score comes from the database, not from the evaluator request.
    const mcqScore = Number(attempt.mcqScore ?? 0);
    if (!Number.isInteger(mcqScore) || mcqScore < 0 || mcqScore > C.MCQ_TOTAL_MARKS) {
      console.error("[assessment/evaluate] Invalid stored MCQ score.", { attemptId });
      return fail(
        "The stored MCQ score is invalid; manual reconciliation is required.",
        "INVALID_STORED_MCQ_SCORE",
        409,
      );
    }

    const totalScore = mcqScore + codingScore;
    if (totalScore > C.TOTAL_MARKS) {
      return fail("The calculated total score exceeds the assessment maximum.", "TOTAL_SCORE_OUT_OF_RANGE", 409);
    }

    const result = await finalizeAssessmentAttempt({
      studentId,
      attemptId,
      score: totalScore,
      mcqScore,
      codingScore,
      passed: totalScore >= C.PASSING_MARKS,
    } as Parameters<typeof finalizeAssessmentAttempt>[0]);

    if (!result.success) {
      const resultCode = String(result.code ?? "EVALUATION_FINALIZATION_FAILED");
      const conflict = /CONFLICT|ALREADY|NOT_EVALUATING/i.test(resultCode);
      return fail(result.message || "Assessment result could not be finalized.", resultCode, conflict ? 409 : 422);
    }

    return json({
      success: true,
      message: result.message,
      code: result.code,
      data: {
        attemptId,
        mcqScore,
        codingScore,
        totalScore,
        percentage: Number(((totalScore / C.TOTAL_MARKS) * 100).toFixed(2)),
        passed: totalScore >= C.PASSING_MARKS,
        passingMarks: C.PASSING_MARKS,
        totalMarks: C.TOTAL_MARKS,
        studentSyncPending: result.code === "ASSESSMENT_FINALIZED_SYNC_PENDING",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return fail("Request body is too large.", "BODY_TOO_LARGE", 413);
    }

    console.error("[assessment/evaluate] Request failed.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return fail("Assessment evaluation could not be completed.", "ASSESSMENT_EVALUATION_ERROR", 500);
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
