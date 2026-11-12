import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Admin from "@/models/Admin";
import Internship from "@/models/Internship";
import {
  ADMIN_AUTH_COOKIE_NAME,
  verifyAuthToken,
  type AuthUser,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecordValue = Record<string, unknown>;

type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function failure(message: string, code: string, status: number): NextResponse {
  return json({ success: false, message, code, data: { domains: [] } }, status);
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 150): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  return 0;
}

async function authenticateAdmin(request: NextRequest): Promise<AuthResult> {
  const token = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return {
      ok: false,
      response: failure("Authentication required.", "UNAUTHENTICATED", 401),
    };
  }

  let user: AuthUser | null = null;

  try {
    user = await verifyAuthToken(token);
  } catch {
    user = null;
  }

  if (
    !user ||
    user.role !== "admin" ||
    user.sessionType !== "admin" ||
    !user.adminRole ||
    !mongoose.isValidObjectId(user.id)
  ) {
    return {
      ok: false,
      response: failure("Admin session is invalid or expired.", "INVALID_SESSION", 401),
    };
  }

  await connectDB();

  const adminDocument = await Admin.findById(user.id)
    .select("_id role isActive isEmailVerified permissions security.accountLocked security.lockedUntil")
    .lean()
    .exec();

  if (!adminDocument) {
    return {
      ok: false,
      response: failure("Admin account was not found.", "ADMIN_NOT_FOUND", 401),
    };
  }

  const admin = adminDocument as unknown as RecordValue;
  const security = isRecord(admin.security) ? admin.security : {};
  const permissions = isRecord(admin.permissions) ? admin.permissions : {};
  const lockedUntil = security.lockedUntil
    ? new Date(String(security.lockedUntil)).getTime()
    : 0;

  if (
    admin.isActive !== true ||
    admin.isEmailVerified !== true ||
    security.accountLocked === true ||
    (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) ||
    cleanText(admin.role, 80) !== user.adminRole
  ) {
    return {
      ok: false,
      response: failure(
        "Admin account is inactive, unverified, locked, or has changed role.",
        "ADMIN_ACCESS_REVOKED",
        403,
      ),
    };
  }

  if (
    user.adminRole !== "Super Admin" &&
    permissions.assessments !== true
  ) {
    return {
      ok: false,
      response: failure(
        "You do not have permission to view assessment domains.",
        "INSUFFICIENT_PERMISSION",
        403,
      ),
    };
  }

  return { ok: true, user };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);

  if (!auth.ok) return auth.response;

  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const search = cleanText(searchParams.get("search"), 100).toLocaleLowerCase("en");
    const includeCounts = searchParams.get("includeCounts") !== "false";

    const records = await Internship.find({
      status: "active",
      isPublic: true,
      isSelectable: true,
    })
      .select("domain assessmentDomain title name planCode duration durationMonths status isPublic isSelectable")
      .sort({ domain: 1, durationMonths: 1, createdAt: 1 })
      .limit(5000)
      .lean()
      .exec();

    const grouped = new Map<
      string,
      {
        domain: string;
        domainKey: string;
        internshipCount: number;
        plans: Set<string>;
        titles: Set<string>;
      }
    >();

    for (const record of records as unknown as RecordValue[]) {
      const domain = cleanText(record.assessmentDomain) || cleanText(record.domain);

      if (!domain) continue;

      const domainKey = normalizeKey(domain);

      if (!domainKey) continue;

      if (search && !domain.toLocaleLowerCase("en").includes(search)) continue;

      const current = grouped.get(domainKey) ?? {
        domain,
        domainKey,
        internshipCount: 0,
        plans: new Set<string>(),
        titles: new Set<string>(),
      };

      current.internshipCount += 1;

      const planCode = cleanText(record.planCode, 40).toUpperCase();
      const duration = cleanText(record.duration, 40);

      if (planCode || duration) current.plans.add(planCode || duration);

      const title = cleanText(record.title) || cleanText(record.name);
      if (title) current.titles.add(title);

      grouped.set(domainKey, current);
    }

    const domains = [...grouped.values()]
      .map((item) => ({
        domain: item.domain,
        name: item.domain,
        domainKey: item.domainKey,
        value: item.domain,
        internshipCount: includeCounts ? numberValue(item.internshipCount) : undefined,
        availablePlans: [...item.plans],
        internshipTitles: [...item.titles],
        isActive: true,
        source: "main-admin-internships",
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain, "en"));

    return json({
      success: true,
      message: "Active assessment domains loaded from Main Admin internship records.",
      data: {
        domains,
        total: domains.length,
        source: "main-admin-internships",
        generatedAt: new Date().toISOString(),
      },
      domains,
      total: domains.length,
    });
  } catch (error) {
    console.error("[ADMIN_ASSESSMENT_DOMAINS_GET]", error);

    return failure(
      "Unable to load active assessment domains. Please try again.",
      "ASSESSMENT_DOMAINS_FETCH_FAILED",
      500,
    );
  }
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "GET, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
