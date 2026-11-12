import { NextRequest, NextResponse } from "next/server";
import {
  GET as approvalGET,
  POST as approvalPOST,
  PATCH as approvalPATCH,
} from "../approval/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_METHODS = "GET, POST, PATCH, OPTIONS";

function responseHeaders(input?: HeadersInit): Headers {
  const headers = new Headers(input);

  headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Allow", ALLOWED_METHODS);
  headers.set("Vary", "Cookie");

  return headers;
}

function jsonResponse(
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: responseHeaders({
      "Content-Type": "application/json; charset=utf-8",
    }),
  });
}

function normalizeDelegatedResponse(
  response: NextResponse,
): NextResponse {
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response.headers),
  });
}

function errorResponse(
  message: string,
  status: number,
  code: string,
): NextResponse {
  return jsonResponse(
    {
      success: false,
      message,
      code,
    },
    status,
  );
}

async function delegate(
  handler: (request: NextRequest) => Promise<NextResponse>,
  request: NextRequest,
  method: string,
): Promise<NextResponse> {
  try {
    const response = await handler(request);
    return normalizeDelegatedResponse(response);
  } catch (error) {
    console.error(`[ADMIN_APPLICATIONS_${method}]`, error);

    return errorResponse(
      method === "GET"
        ? "Unable to load applications right now."
        : method === "POST"
          ? "Unable to process this application action right now."
          : "Unable to update the application status right now.",
      500,
      method === "GET"
        ? "APPLICATIONS_LOAD_FAILED"
        : method === "POST"
          ? "APPLICATION_ACTION_FAILED"
          : "APPLICATION_STATUS_UPDATE_FAILED",
    );
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  return delegate(approvalGET, request, "GET");
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  return delegate(approvalPOST, request, "POST");
}

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  return delegate(approvalPATCH, request, "PATCH");
}

export async function DELETE(): Promise<NextResponse> {
  return errorResponse(
    "Permanent application deletion is disabled to preserve audit history and linked student, assessment, and payment records.",
    405,
    "APPLICATION_DELETE_DISABLED",
  );
}

export async function PUT(): Promise<NextResponse> {
  return errorResponse(
    "PUT is not supported. Use POST for approval actions or PATCH for permitted status changes.",
    405,
    "METHOD_NOT_ALLOWED",
  );
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: responseHeaders(),
  });
}
