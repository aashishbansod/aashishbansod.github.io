import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";
import {
  approveStudentOperations,
  listStudents,
  type StudentActor,
} from "@/services/student.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 120;
const MAX_BODY_BYTES = 12000;
const MAX_STUDENT_ID_LENGTH = 150;
const MAX_REASON_LENGTH = 1000;
const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected"]);

type JsonObject = Record<string, unknown>;
type AuthenticatedAdmin = {
  id: string;
  role: "Student Operations Admin";
};
type AuthResult =
  | { admin: AuthenticatedAdmin }
  | { response: NextResponse };
type ActionBody =
  | { action: "approve"; studentId: string }
  | { action: "reject"; studentId: string; reason: string }
  | { response: NextResponse };

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim()
    : "";
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRole(value: unknown): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function requestIdFor(request: NextRequest): string {
  const incoming = cleanString(request.headers.get("x-request-id"));
  return incoming && /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

function secure(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Vary", "Cookie, Origin");
  response.headers.set("X-Request-Id", requestId);
  return response;
}

function json(body: unknown, status: number, requestId: string): NextResponse {
  return secure(NextResponse.json(body, { status }), requestId);
}

function failure(
  requestId: string,
  status: number,
  code: string,
  message: string
): NextResponse {
  return json({ success: false, code, message, requestId }, status, requestId);
}

function validSameOrigin(request: NextRequest): boolean {
  const origin = cleanString(request.headers.get("origin"));
  if (!origin) return false;

  try {
    const expected = new URL(request.url);
    const actual = new URL(origin);
    return expected.protocol === actual.protocol &&
      expected.host.toLowerCase() === actual.host.toLowerCase();
  } catch {
    return false;
  }
}

function validContentLength(request: NextRequest): boolean {
  const header = request.headers.get("content-length");
  if (!header) return true;
  const length = Number(header);
  return Number.isSafeInteger(length) && length >= 0 && length <= MAX_BODY_BYTES;
}

function getSessionPayloads(request: NextRequest): JsonObject[] {
  const cookieNames = [
    STUDENT_ADMIN_AUTH_COOKIE_NAME,
    ADMIN_AUTH_COOKIE_NAME,
    AUTH_COOKIE_NAME,
  ];
  const tokens = [...new Set(
    cookieNames
      .map((name) => cleanString(request.cookies.get(name)?.value))
      .filter(Boolean)
  )];
  const payloads: JsonObject[] = [];

  for (const token of tokens) {
    try {
      const payload = verifyAccessToken(token);
      if (isObject(payload)) payloads.push(payload);
    } catch {
      continue;
    }
  }

  return payloads;
}

async function authenticate(
  request: NextRequest,
  requestId: string
): Promise<AuthResult> {
  const payloads = getSessionPayloads(request);

  if (payloads.length === 0) {
    return {
      response: failure(
        requestId,
        401,
        "UNAUTHORIZED",
        "A valid Student Operations Admin session is required."
      ),
    };
  }

  const payload = payloads.find((candidate) =>
    normalizeRole(candidate.role) === "admin" &&
    normalizeRole(candidate.adminRole) === "student operations admin" &&
    normalizeRole(candidate.sessionType) === "student admin"
  );

  if (!payload) {
    return {
      response: failure(
        requestId,
        403,
        "FORBIDDEN",
        "Only an authenticated Student Operations Admin can access this application review queue."
      ),
    };
  }

  const id = cleanString(payload.userId || payload.id || payload.sub);
  if (!id || id.length > 150) {
    return {
      response: failure(
        requestId,
        401,
        "INVALID_ADMIN_SESSION",
        "The administrator identity in this session is invalid."
      ),
    };
  }

  return { admin: { id, role: "Student Operations Admin" } };
}

function queryValue(request: NextRequest, key: string): string {
  return cleanString(request.nextUrl.searchParams.get(key));
}

function parsePositiveInteger(
  raw: string,
  fallback: number,
  maximum: number
): number | null {
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, maximum);
}

function parseListQuery(request: NextRequest):
  | {
      page: number;
      limit: number;
      paymentStatus: string;
      internshipStatus: string;
      studentOpsApprovalStatus?: string;
      search?: string;
    }
  | { error: string } {
  const page = parsePositiveInteger(queryValue(request, "page"), 1, 10000);
  const limit = parsePositiveInteger(
    queryValue(request, "limit"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  if (page === null || limit === null) {
    return { error: "Page and limit must be positive integers." };
  }

  const rawStatus = queryValue(request, "studentOpsApprovalStatus").toLowerCase();
  if (rawStatus && !ALLOWED_STATUSES.has(rawStatus)) {
    return { error: "Unsupported Operations approval status." };
  }

  const search = queryValue(request, "search");
  if (search.length > MAX_SEARCH_LENGTH) {
    return { error: `Search cannot exceed ${MAX_SEARCH_LENGTH} characters.` };
  }

  return {
    page,
    limit,
    paymentStatus: "paid",
    internshipStatus: "approved",
    ...(rawStatus ? { studentOpsApprovalStatus: rawStatus } : {}),
    ...(search ? { search } : {}),
  };
}

async function readActionBody(
  request: NextRequest,
  requestId: string
): Promise<ActionBody> {
  if (!request.body) {
    return {
      response: failure(requestId, 400, "BODY_REQUIRED", "A JSON request body is required."),
    };
  }

  let raw: string;
  try {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return {
          response: failure(
            requestId,
            413,
            "PAYLOAD_TOO_LARGE",
            "The request payload is too large."
          ),
        };
      }
      chunks.push(chunk.value);
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    raw = new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    return {
      response: failure(
        requestId,
        400,
        "INVALID_REQUEST_BODY",
        "Unable to read a valid UTF-8 request body."
      ),
    };
  }

  if (!raw.trim()) {
    return {
      response: failure(requestId, 400, "BODY_REQUIRED", "A JSON request body is required."),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      response: failure(requestId, 400, "INVALID_JSON", "The request body must contain valid JSON."),
    };
  }

  if (!isObject(parsed)) {
    return {
      response: failure(requestId, 400, "INVALID_BODY", "The request body must be a JSON object."),
    };
  }

  if (Object.keys(parsed).some((key) => !["action", "studentId", "reason"].includes(key))) {
    return {
      response: failure(
        requestId,
        400,
        "UNSUPPORTED_FIELDS",
        "The request contains unsupported fields."
      ),
    };
  }

  const action = cleanString(parsed.action).toLowerCase();
  if (action !== "approve" && action !== "reject") {
    return {
      response: failure(
        requestId,
        400,
        "INVALID_ACTION",
        "Only approve and reject actions are supported."
      ),
    };
  }

  const studentId = cleanString(parsed.studentId);
  if (!studentId || studentId.length > MAX_STUDENT_ID_LENGTH) {
    return {
      response: failure(
        requestId,
        400,
        "INVALID_STUDENT_ID",
        "A valid student record ID is required."
      ),
    };
  }

  const reason = cleanString(parsed.reason);
  if (action === "reject" && !reason) {
    return {
      response: failure(
        requestId,
        400,
        "REASON_REQUIRED",
        "A rejection reason is required."
      ),
    };
  }

  if (reason.length > MAX_REASON_LENGTH) {
    return {
      response: failure(
        requestId,
        400,
        "REASON_TOO_LONG",
        "The rejection reason cannot exceed 1000 characters."
      ),
    };
  }

  return action === "approve"
    ? { action, studentId }
    : { action, studentId, reason };
}

function serviceStatus(code?: string): number {
  switch ((code || "").toUpperCase()) {
    case "STUDENT_NOT_FOUND":
      return 404;
    case "PAYMENT_NOT_VERIFIED":
    case "INTERNSHIP_NOT_APPROVED":
    case "INVALID_STATUS":
    case "INVALID_TRANSITION":
    case "INVALID_PLAN":
    case "ASSESSMENT_NOT_PASSED":
      return 422;
    case "DUPLICATE_RECORD":
    case "ALREADY_APPROVED":
      return 409;
    case "INTERNAL_SERVER_ERROR":
    case "DATABASE_UNAVAILABLE":
      return 500;
    default:
      return 400;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  try {
    const authentication = await authenticate(request, requestId);
    if ("response" in authentication) return authentication.response;

    const query = parseListQuery(request);
    if ("error" in query) {
      return failure(requestId, 400, "INVALID_QUERY", query.error);
    }

    const result = await listStudents(query);
    if (!result.success) {
      return failure(
        requestId,
        serviceStatus(result.code),
        result.code || "APPLICATIONS_LOAD_FAILED",
        result.message || "Unable to load student applications."
      );
    }

    return json({ ...result, requestId }, 200, requestId);
  } catch (error) {
    console.error("[StudentAdminApplications][GET]", { requestId, error });
    return failure(
      requestId,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load Student Operations applications."
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFor(request);

  try {
    if (!validSameOrigin(request)) {
      return failure(
        requestId,
        403,
        "INVALID_ORIGIN",
        "Cross-origin requests are not allowed."
      );
    }

    if (!validContentLength(request)) {
      return failure(
        requestId,
        413,
        "PAYLOAD_TOO_LARGE",
        "The request payload is too large or invalid."
      );
    }

    const contentType = cleanString(request.headers.get("content-type")).toLowerCase();
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return failure(
        requestId,
        415,
        "INVALID_CONTENT_TYPE",
        "Content-Type must be application/json."
      );
    }

    const authentication = await authenticate(request, requestId);
    if ("response" in authentication) return authentication.response;

    const body = await readActionBody(request, requestId);
    if ("response" in body) return body.response;

    const actor: StudentActor = {
      id: authentication.admin.id,
      role: authentication.admin.role,
    };

    const result = await approveStudentOperations({
      studentId: body.studentId,
      actor,
      approved: body.action === "approve",
      ...(body.action === "reject" ? { reason: body.reason } : {}),
    });

    if (!result.success) {
      return failure(
        requestId,
        serviceStatus(result.code),
        result.code || "APPLICATION_REVIEW_FAILED",
        result.message || "The application review could not be completed."
      );
    }

    const emailFailed = result.code === "DASHBOARD_CREDENTIAL_EMAIL_FAILED";
    return json(
      {
        ...result,
        requestId,
        ...(emailFailed
          ? {
              warning:
                "Student Operations approval was saved, but credential email delivery failed. Dashboard access remains locked until credentials are securely resent.",
              credentialsSent: false,
            }
          : {}),
      },
      emailFailed ? 202 : 200,
      requestId
    );
  } catch (error) {
    console.error("[StudentAdminApplications][POST]", { requestId, error });
    return failure(
      requestId,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to complete the Student Operations review."
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  return secure(
    new NextResponse(null, {
      status: 204,
      headers: { Allow: "GET, POST, OPTIONS" },
    }),
    requestId
  );
}
