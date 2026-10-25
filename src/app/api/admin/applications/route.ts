import { NextRequest, NextResponse } from "next/server";
import {
  GET as approvalGET,
  POST as approvalPOST,
  PATCH as approvalPATCH,
} from "../approval/route";

import connectDB from "@/lib/db";
import Application from "@/models/Application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const MAX_APPLICATION_ID_LENGTH = 50;

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
  headers.set("Allow", ALLOWED_METHODS);
  return headers;
}

function jsonError(
  message: string,
  status: number,
  code: string,
): NextResponse {
  return NextResponse.json(
    { success: false, message, code },
    {
      status,
      headers: responseHeaders({
        "Content-Type": "application/json; charset=utf-8",
      }),
    },
  );
}

function normalizeDelegatedResponse(response: NextResponse): NextResponse {
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders(response.headers),
  });
}

function normalizeApplicationId(value: string | null): string {
  return (value ?? "").trim();
}

function isValidApplicationId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_APPLICATION_ID_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

/**
 * GET /api/admin/applications
 * Delegates listing and authentication to the canonical approval route.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return normalizeDelegatedResponse(await approvalGET(request));
  } catch (error) {
    // Keep internal database, session, and stack details out of the response.
    console.error("[ADMIN_APPLICATIONS_GET]", error);
    return jsonError(
      "Unable to load applications right now.",
      500,
      "APPLICATIONS_LOAD_FAILED",
    );
  }
}

/**
 * POST /api/admin/applications
 * Delegates approve/reject actions to the canonical approval route.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return normalizeDelegatedResponse(await approvalPOST(request));
  } catch (error) {
    console.error("[ADMIN_APPLICATIONS_POST]", error);
    return jsonError(
      "Unable to process this application action right now.",
      500,
      "APPLICATION_ACTION_FAILED",
    );
  }
}

/**
 * PATCH /api/admin/applications
 * Delegates status updates to the canonical approval route.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    return normalizeDelegatedResponse(await approvalPATCH(request));
  } catch (error) {
    console.error("[ADMIN_APPLICATIONS_PATCH]", error);
    return jsonError(
      "Unable to update the application status right now.",
      500,
      "APPLICATION_STATUS_UPDATE_FAILED",
    );
  }
}

/**
 * DELETE /api/admin/applications?applicationId=CN-...
 * Deletes only applications that have no linked student, payment, or active
 * assessment. The canonical approval endpoint is reused as the admin gate.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const authCheck = await approvalGET(request);
    if (!authCheck.ok) {
      return normalizeDelegatedResponse(authCheck);
    }

    const applicationId = normalizeApplicationId(
      request.nextUrl.searchParams.get("applicationId") ??
        request.nextUrl.searchParams.get("id"),
    );

    if (!isValidApplicationId(applicationId)) {
      return jsonError(
        "A valid applicationId query parameter is required.",
        400,
        "APPLICATION_ID_REQUIRED",
      );
    }

    await connectDB();

    const application = await Application.findOne({ applicationId })
      .select(
        "_id applicationId status studentId assessmentStatus paymentStatus paymentId",
      )
      .lean()
      .exec();

    if (!application) {
      return jsonError(
        "Application was not found.",
        404,
        "APPLICATION_NOT_FOUND",
      );
    }

    const status = String(application.status ?? "").trim().toLowerCase();
    const assessmentStatus = String(
      application.assessmentStatus ?? "not_started",
    )
      .trim()
      .toLowerCase();
    const paymentStatus = String(application.paymentStatus ?? "not_required")
      .trim()
      .toLowerCase();
    const studentId = String(application.studentId ?? "").trim();
    const paymentId = String(application.paymentId ?? "").trim();

    const hasDownstreamActivity =
      studentId.length > 0 ||
      paymentId.length > 0 ||
      paymentStatus === "pending" ||
      paymentStatus === "paid" ||
      assessmentStatus === "active" ||
      assessmentStatus === "passed" ||
      status === "approved";

    if (hasDownstreamActivity) {
      return jsonError(
        "This application is linked to an account, assessment, or payment and cannot be deleted. Keep the record for audit history.",
        409,
        "APPLICATION_HAS_DOWNSTREAM_ACTIVITY",
      );
    }

    // Guard the delete against changes made after the initial read.
    const result = await Application.deleteOne({
      _id: application._id,
      applicationId,
      status: { $in: ["pending", "rejected", "under_review"] },
      $and: [
        {
          $or: [
            { studentId: { $exists: false } },
            { studentId: null },
            { studentId: "" },
          ],
        },
        {
          $or: [
            { paymentId: { $exists: false } },
            { paymentId: null },
            { paymentId: "" },
          ],
        },
        { paymentStatus: { $nin: ["pending", "paid"] } },
        { assessmentStatus: { $nin: ["active", "passed"] } },
      ],
    })
      .exec();

    if (result.deletedCount !== 1) {
      return jsonError(
        "The application changed while the delete request was being processed. Refresh and try again.",
        409,
        "APPLICATION_DELETE_CONFLICT",
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Application deleted successfully.",
        data: { applicationId },
      },
      { headers: responseHeaders() },
    );
  } catch (error) {
    console.error("[ADMIN_APPLICATIONS_DELETE]", error);
    return jsonError(
      "Unable to delete this application right now.",
      500,
      "APPLICATION_DELETE_FAILED",
    );
  }
}

export async function PUT(): Promise<NextResponse> {
  return jsonError(
    "PUT is not supported on the admin applications endpoint.",
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
