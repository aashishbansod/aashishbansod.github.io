import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Internship from "@/models/Internship";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MongoCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

type InternshipRecord = Record<string, unknown> & {
  _id?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
  domain?: unknown;
  assessmentDomain?: unknown;
  assessmentRequired?: unknown;
  applicationRequired?: unknown;
  planCode?: unknown;
  duration?: unknown;
  durationMonths?: unknown;
  sortOrder?: unknown;
  price?: unknown;
  priceInPaise?: unknown;
  currency?: unknown;
  stipend?: unknown;
  mode?: unknown;
  location?: unknown;
  skills?: unknown;
  technologies?: unknown;
  requirements?: unknown;
  responsibilities?: unknown;
  eligibility?: unknown;
  maxStudents?: unknown;
  enrolledStudents?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __internshipMongoCache?: MongoCache;
};

const mongoCache: MongoCache =
  globalForMongoose.__internshipMongoCache ??
  (globalForMongoose.__internshipMongoCache = {
    conn: null,
    promise: null,
  });

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;
const PLAN_PRICES: Record<number, number> = {
  1: 499,
  3: 999,
  6: 1699,
};

async function connectDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (mongoose.connection.readyState === 1) {
    mongoCache.conn = mongoose;
    return mongoose;
  }

  if (mongoCache.promise) {
    return mongoCache.promise;
  }

  mongoCache.promise = mongoose
    .connect(uri, {
      dbName:
        process.env.MONGODB_DB_NAME ||
        process.env.MONGODB_DATABASE ||
        undefined,
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      family: 4,
    })
    .then((connection) => {
      mongoCache.conn = connection;
      return connection;
    })
    .catch((error) => {
      mongoCache.promise = null;
      mongoCache.conn = null;
      throw error;
    });

  return mongoCache.promise;
}

function json(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInteger(
  value: string | null,
  fallback: number,
  max?: number
): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return typeof max === "number" ? Math.min(parsed, max) : parsed;
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

function normalizeDurationMonths(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function normalizePlanCode(value: unknown, durationMonths: number): string {
  const existing = cleanString(value);

  if (existing) {
    return existing;
  }

  switch (durationMonths) {
    case 1:
      return "ONE_MONTH";
    case 3:
      return "THREE_MONTHS";
    case 6:
      return "SIX_MONTHS";
    default:
      return "";
  }
}

function normalizeObjectId(value: unknown): string {
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  return String(value ?? "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeInternship(document: InternshipRecord): Record<string, unknown> {
  const id = normalizeObjectId(document._id);
  const durationMonths = normalizeDurationMonths(document.durationMonths);
  const canonicalPrice = PLAN_PRICES[durationMonths];
  const storedPrice = Number(document.price ?? 0);
  const price =
    canonicalPrice ??
    (Number.isFinite(storedPrice) && storedPrice >= 0 ? storedPrice : 0);
  const skills = normalizeArray(document.skills);
  const technologies = normalizeArray(document.technologies);
  const requirements = normalizeArray(document.requirements);
  const responsibilities = normalizeArray(document.responsibilities);
  const enrolledStudents = Math.max(0, Number(document.enrolledStudents ?? 0));
  const maxStudents =
    document.maxStudents === null ||
    document.maxStudents === undefined ||
    document.maxStudents === ""
      ? null
      : Math.max(0, Number(document.maxStudents));
  const availableSeats =
    maxStudents === null ? null : Math.max(0, maxStudents - enrolledStudents);

  return {
    id,
    _id: id,
    title: cleanString(document.title) || cleanString(document.name) || "Internship",
    name: cleanString(document.name) || cleanString(document.title) || "Internship",
    description: cleanString(document.description),
    domain: cleanString(document.domain),
    assessmentDomain: cleanString(document.assessmentDomain),
    assessmentRequired: document.assessmentRequired === true,
    applicationRequired: document.applicationRequired !== false,
    planCode: normalizePlanCode(document.planCode, durationMonths),
    duration:
      cleanString(document.duration) ||
      (durationMonths > 0
        ? `${durationMonths} Month${durationMonths === 1 ? "" : "s"}`
        : ""),
    durationMonths,
    sortOrder: Number(document.sortOrder ?? 0),
    price,
    priceInPaise: price * 100,
    configuredPrice: canonicalPrice ?? price,
    currency: cleanString(document.currency) || "INR",
    stipend: cleanString(document.stipend),
    mode: cleanString(document.mode),
    location: cleanString(document.location),
    skills,
    technologies,
    requirements,
    responsibilities,
    eligibility: cleanString(document.eligibility),
    maxStudents,
    enrolledStudents,
    availableSeats,
    status: cleanString(document.status) || "active",
    createdAt:
      document.createdAt instanceof Date
        ? document.createdAt.toISOString()
        : document.createdAt ?? null,
    updatedAt:
      document.updatedAt instanceof Date
        ? document.updatedAt.toISOString()
        : document.updatedAt ?? null,
  };
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    await connectDatabase();

    const url = new URL(request.url);
    const rawSearch = url.searchParams.get("search") ?? url.searchParams.get("q") ?? "";
    const search = rawSearch.trim().slice(0, MAX_SEARCH_LENGTH);
    const domain = cleanString(url.searchParams.get("domain")).slice(0, 120);
    const mode = cleanString(url.searchParams.get("mode")).slice(0, 60);
    const durationRaw =
      url.searchParams.get("durationMonths") ??
      url.searchParams.get("duration") ??
      "";
    const durationMonths = durationRaw === "" ? 0 : Number(durationRaw);

    if (
      durationRaw !== "" &&
      (!Number.isInteger(durationMonths) || ![1, 3, 6].includes(durationMonths))
    ) {
      return json(
        {
          success: false,
          message: "Invalid duration. Allowed durations are 1, 3 and 6 months.",
          code: "INVALID_DURATION",
        },
        400
      );
    }

    const page = toPositiveInteger(url.searchParams.get("page"), DEFAULT_PAGE);
    const limit = toPositiveInteger(
      url.searchParams.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const skip = (page - 1) * limit;
    const conditions: Record<string, unknown>[] = [{ status: "active" }];

    if (search) {
      const safeSearch = escapeRegex(search);
      conditions.push({
        $or: [
          { title: { $regex: safeSearch, $options: "i" } },
          { name: { $regex: safeSearch, $options: "i" } },
          { description: { $regex: safeSearch, $options: "i" } },
          { domain: { $regex: safeSearch, $options: "i" } },
          { assessmentDomain: { $regex: safeSearch, $options: "i" } },
          { skills: { $regex: safeSearch, $options: "i" } },
          { technologies: { $regex: safeSearch, $options: "i" } },
          { requirements: { $regex: safeSearch, $options: "i" } },
        ],
      });
    }

    if (domain && domain.toLowerCase() !== "all") {
      conditions.push({
        domain: { $regex: `^${escapeRegex(domain)}$`, $options: "i" },
      });
    }

    if (mode && mode.toLowerCase() !== "all") {
      conditions.push({
        mode: { $regex: `^${escapeRegex(mode)}$`, $options: "i" },
      });
    }

    if (durationMonths > 0) {
      conditions.push({
        $or: [
          { durationMonths },
          {
            duration: {
              $regex: `^${durationMonths}\\s*Month`,
              $options: "i",
            },
          },
        ],
      });
    }

    const filter = { $and: conditions };
    const [documents, total] = await Promise.all([
      Internship.find(filter)
        .sort({ sortOrder: 1, durationMonths: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Internship.countDocuments(filter).exec(),
    ]);

    const data = (documents as unknown as InternshipRecord[]).map(
      normalizeInternship
    );
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const availableDurations = Array.from(
      new Set(
        data
          .map((item) => Number(item.durationMonths ?? 0))
          .filter((months) => [1, 3, 6].includes(months))
      )
    ).sort((a, b) => a - b);

    const durationPlans = [1, 3, 6].map((months) => ({
      durationMonths: months,
      duration: months === 1 ? "1 Month" : `${months} Months`,
      planCode:
        months === 1
          ? "ONE_MONTH"
          : months === 3
            ? "THREE_MONTHS"
            : "SIX_MONTHS",
      price: PLAN_PRICES[months],
      priceInPaise: PLAN_PRICES[months] * 100,
      currency: "INR",
      available: availableDurations.includes(months),
    }));

    return json(
      {
        success: true,
        message:
          data.length > 0
            ? "Internships fetched successfully."
            : "No active internships found.",
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1 && totalPages > 0,
          returned: data.length,
          availablePrograms: total,
          availableDurations,
          durationPlans,
          filters: {
            search,
            domain,
            mode,
            durationMonths: durationMonths || null,
          },
        },
        performance: {
          durationMs: Date.now() - startedAt,
        },
      },
      200
    );
  } catch (error) {
    console.error("[GET /api/internships]", error);

    const message =
      error instanceof Error ? error.message : "Unknown server error.";

    if (message.includes("MONGODB_URI")) {
      return json(
        {
          success: false,
          message: "Database configuration is missing.",
          code: "DATABASE_CONFIGURATION_ERROR",
        },
        500
      );
    }

    return json(
      {
        success: false,
        message: "Unable to fetch internships right now.",
        code: "INTERNSHIPS_FETCH_FAILED",
      },
      500
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, HEAD, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST() {
  return json(
    {
      success: false,
      message:
        "POST is not allowed on the public internships endpoint. Use the admin internship API.",
      code: "METHOD_NOT_ALLOWED",
    },
    405
  );
}

export async function PUT() {
  return json(
    {
      success: false,
      message: "PUT is not allowed on the public internships endpoint.",
      code: "METHOD_NOT_ALLOWED",
    },
    405
  );
}

export async function PATCH() {
  return json(
    {
      success: false,
      message: "PATCH is not allowed on the public internships endpoint.",
      code: "METHOD_NOT_ALLOWED",
    },
    405
  );
}

export async function DELETE() {
  return json(
    {
      success: false,
    message: "DELETE is not allowed on the public internships endpoint.",
      code: "METHOD_NOT_ALLOWED",
    },
    405
  );
}
