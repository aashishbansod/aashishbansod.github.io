import { NextResponse } from "next/server";
import mongoose from "mongoose";

import Internship from "@/models/Internship";

/* ============================================================
   ROUTE CONFIG
============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   TYPES
============================================================ */

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

/* ============================================================
   GLOBAL MONGOOSE CACHE
============================================================ */

/**
 * Next.js development / hot reload can execute this module
 * multiple times. Keeping the connection on globalThis prevents
 * unnecessary MongoDB connections.
 */
const globalForMongoose = globalThis as typeof globalThis & {
  __internshipMongoCache?: MongoCache;
};

const mongoCache: MongoCache =
  globalForMongoose.__internshipMongoCache ??
  (globalForMongoose.__internshipMongoCache = {
    conn: null,
    promise: null,
  });

/* ============================================================
   CONSTANTS
============================================================ */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const MAX_SEARCH_LENGTH = 100;

const PLAN_PRICES: Record<number, number> = {
  1: 499,
  3: 999,
  6: 1699,
};

/* ============================================================
   DATABASE CONNECTION
============================================================ */

async function connectDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not configured. Add MONGODB_URI to .env.local."
    );
  }

  /**
   * Already connected.
   */
  if (mongoose.connection.readyState === 1) {
    mongoCache.conn = mongoose;
    return mongoose;
  }

  /**
   * Reuse an existing connection promise.
   */
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

      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS: 15_000,

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

/* ============================================================
   HELPERS
============================================================ */

function json(
  body: Record<string, unknown>,
  status = 200
): NextResponse {
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
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function toPositiveInteger(
  value: string | null,
  fallback: number,
  max?: number
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      return String(item ?? "").trim();
    })
    .filter(Boolean);
}

function normalizeDurationMonths(value: unknown): number {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return 0;
}

function getCanonicalPrice(durationMonths: number): number | null {
  return PLAN_PRICES[durationMonths] ?? null;
}

function normalizePlanCode(
  planCode: unknown,
  durationMonths: number
): string {
  const existing = cleanString(planCode);

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

/* ============================================================
   DOCUMENT NORMALIZER
============================================================ */

function normalizeInternship(
  document: InternshipRecord
): Record<string, unknown> {
  const id = normalizeObjectId(document._id);

  const durationMonths = normalizeDurationMonths(
    document.durationMonths
  );

  const storedPrice =
    typeof document.price === "number"
      ? document.price
      : Number(document.price ?? 0);

  const canonicalPrice = getCanonicalPrice(durationMonths);

  /**
   * The database is the source of truth.
   *
   * canonicalPrice is exposed separately so the frontend can
   * understand the configured 1/3/6-month pricing without
   * silently modifying the stored database value.
   */
  const price =
    Number.isFinite(storedPrice) && storedPrice >= 0
      ? storedPrice
      : canonicalPrice ?? 0;

  const priceInPaise =
    typeof document.priceInPaise === "number"
      ? document.priceInPaise
      : price * 100;

  const skills = normalizeArray(document.skills);
  const technologies = normalizeArray(document.technologies);
  const requirements = normalizeArray(document.requirements);
  const responsibilities = normalizeArray(
    document.responsibilities
  );

  const enrolledStudents = Math.max(
    0,
    Number(document.enrolledStudents ?? 0)
  );

  const maxStudents =
    document.maxStudents === null ||
    document.maxStudents === undefined ||
    document.maxStudents === ""
      ? null
      : Math.max(0, Number(document.maxStudents));

  const availableSeats =
    maxStudents === null
      ? null
      : Math.max(0, maxStudents - enrolledStudents);

  return {
    id,

    _id: id,

    title:
      cleanString(document.title) ||
      cleanString(document.name) ||
      "Internship",

    name:
      cleanString(document.name) ||
      cleanString(document.title) ||
      "Internship",

    description: cleanString(document.description),

    domain: cleanString(document.domain),

    assessmentDomain: cleanString(
      document.assessmentDomain
    ),

    assessmentRequired:
      document.assessmentRequired === true,

    applicationRequired:
      document.applicationRequired !== false,

    planCode: normalizePlanCode(
      document.planCode,
      durationMonths
    ),

    duration:
      cleanString(document.duration) ||
      (durationMonths > 0
        ? `${durationMonths} Month${
            durationMonths === 1 ? "" : "s"
          }`
        : ""),

    durationMonths,

    sortOrder: Number(document.sortOrder ?? 0),

    /**
     * Existing DB price.
     */
    price,

    /**
     * Price represented in paise.
     */
    priceInPaise,

    /**
     * Canonical project pricing:
     *
     * 1 Month  = ₹499
     * 3 Months = ₹999
     * 6 Months = ₹1699
     */
    configuredPrice:
      canonicalPrice ?? price,

    currency:
      cleanString(document.currency) || "INR",

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

    status:
      cleanString(document.status) || "active",

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

/* ============================================================
   GET /api/internships
============================================================ */

/**
 * Public internship listing endpoint.
 *
 * Supported query parameters:
 *
 * ?page=1
 * ?limit=20
 * ?search=react
 * ?q=react
 * ?domain=Frontend Development
 * ?mode=Remote
 * ?duration=1
 * ?durationMonths=3
 *
 * Examples:
 *
 * /api/internships
 * /api/internships?search=javascript
 * /api/internships?domain=Frontend%20Development
 * /api/internships?mode=Remote
 * /api/internships?duration=3
 * /api/internships?page=1&limit=20
 */
export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    /* ========================================================
       DATABASE
    ======================================================== */

    await connectDatabase();

    /* ========================================================
       URL / QUERY PARAMETERS
    ======================================================== */

    const url = new URL(request.url);

    const rawSearch =
      url.searchParams.get("search") ??
      url.searchParams.get("q") ??
      "";

    const search = rawSearch
      .trim()
      .slice(0, MAX_SEARCH_LENGTH);

    const domain = cleanString(
      url.searchParams.get("domain")
    ).slice(0, 120);

    const mode = cleanString(
      url.searchParams.get("mode")
    ).slice(0, 60);

    const durationRaw =
      url.searchParams.get("durationMonths") ??
      url.searchParams.get("duration") ??
      "";

    const durationMonths =
      durationRaw === ""
        ? 0
        : Number(durationRaw);

    if (
      durationRaw !== "" &&
      (!Number.isInteger(durationMonths) ||
        ![1, 3, 6].includes(durationMonths))
    ) {
      return json(
        {
          success: false,
          message:
            "Invalid duration. Allowed durations are 1, 3 and 6 months.",
          code: "INVALID_DURATION",
        },
        400
      );
    }

    const page = toPositiveInteger(
      url.searchParams.get("page"),
      DEFAULT_PAGE
    );

    const limit = toPositiveInteger(
      url.searchParams.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const skip = (page - 1) * limit;

    /* ========================================================
       DATABASE FILTER
    ======================================================== */

    const filter: Record<string, unknown> = {
      /**
       * Only active internships are public.
       */
      status: "active",
    };

    /* ========================================================
       SEARCH
    ======================================================== */

    if (search) {
      const safeSearch = escapeRegex(search);

      filter.$or = [
        {
          title: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          name: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          description: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          domain: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          assessmentDomain: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          skills: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          technologies: {
            $regex: safeSearch,
            $options: "i",
          },
        },

        {
          requirements: {
            $regex: safeSearch,
            $options: "i",
          },
        },
      ];
    }

    /* ========================================================
       DOMAIN FILTER
    ======================================================== */

    if (domain && domain.toLowerCase() !== "all") {
      filter.domain = {
        $regex: `^${escapeRegex(domain)}$`,
        $options: "i",
      };
    }

    /* ========================================================
       MODE FILTER
    ======================================================== */

    if (mode && mode.toLowerCase() !== "all") {
      filter.mode = {
        $regex: `^${escapeRegex(mode)}$`,
        $options: "i",
      };
    }

    /* ========================================================
       DURATION FILTER
    ======================================================== */

    if (durationMonths > 0) {
      filter.$or = [
        ...(Array.isArray(filter.$or)
          ? filter.$or
          : []),

        {
          durationMonths,
        },

        {
          duration: {
            $regex: `^${durationMonths}\\s*Month`,
            $options: "i",
          },
        },
      ];
    }

    /* ========================================================
       QUERY
    ======================================================== */

    const query = Internship.find(filter)
      .sort({
        sortOrder: 1,
        durationMonths: 1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean();

    const countQuery =
      Internship.countDocuments(filter);

    const [documents, total] = await Promise.all([
      query.exec(),
      countQuery.exec(),
    ]);

    /* ========================================================
       NORMALIZE
    ======================================================== */

    const data = (
      documents as unknown as InternshipRecord[]
    ).map(normalizeInternship);

    /* ========================================================
       PAGINATION
    ======================================================== */

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / limit);

    const hasNextPage =
      page < totalPages;

    const hasPreviousPage =
      page > 1 && totalPages > 0;

    /* ========================================================
       AVAILABLE PLAN INFORMATION
    ======================================================== */

    const availableDurations = Array.from(
      new Set(
        data
          .map((item) =>
            Number(item.durationMonths ?? 0)
          )
          .filter((months) =>
            [1, 3, 6].includes(months)
          )
      )
    ).sort((a, b) => a - b);

    const durationPlans = [1, 3, 6].map(
      (months) => ({
        durationMonths: months,

        duration:
          months === 1
            ? "1 Month"
            : `${months} Months`,

        planCode:
          months === 1
            ? "ONE_MONTH"
            : months === 3
              ? "THREE_MONTHS"
              : "SIX_MONTHS",

        price: PLAN_PRICES[months],

        priceInPaise:
          PLAN_PRICES[months] * 100,

        currency: "INR",

        available:
          availableDurations.includes(months),
      })
    );

    /* ========================================================
       RESPONSE
    ======================================================== */

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

          hasNextPage,

          hasPreviousPage,

          returned:
            data.length,

          availablePrograms:
            total,

          availableDurations,

          durationPlans,

          filters: {
            search,
            domain,
            mode,
            durationMonths:
              durationMonths || null,
          },
        },

        performance: {
          durationMs:
            Date.now() - startedAt,
        },
      },
      200
    );
  } catch (error) {
    /* ========================================================
       ERROR LOGGING
    ======================================================== */

    console.error(
      "[GET /api/internships] Error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error.";

    /* ========================================================
       DATABASE CONFIG ERROR
    ======================================================== */

    if (
      message.includes("MONGODB_URI") ||
      message.includes(
        "MONGODB_URI is not configured"
      )
    ) {
      return json(
        {
          success: false,

          message:
            "Database configuration is missing.",

          code:
            "DATABASE_CONFIGURATION_ERROR",
        },
        500
      );
    }

    /* ========================================================
       GENERIC SERVER ERROR
    ======================================================== */

    return json(
      {
        success: false,

        message:
          "Unable to fetch internships right now.",

        code:
          "INTERNSHIPS_FETCH_FAILED",
      },
      500
    );
  }
}

/* ============================================================
   HEAD
============================================================ */

/**
 * Lightweight health check for clients/load balancers.
 */
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

/* ============================================================
   OPTIONS
============================================================ */

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,

    headers: {
      Allow: "GET, HEAD, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

/* ============================================================
   UNSUPPORTED METHODS
============================================================ */

/**
 * POST intentionally is NOT implemented here.
 *
 * Internship creation belongs to:
 *
 * /api/admin/internships
 *
 * Student applications belong to:
 *
 * /api/apply
 *
 * Keeping this public endpoint read-only prevents accidental
 * creation/modification of internship records.
 */
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

      message:
        "PUT is not allowed on the public internships endpoint.",

      code: "METHOD_NOT_ALLOWED",
    },
    405
  );
}

export async function PATCH() {
  return json(
    {
      success: false,

      message:
        "PATCH is not allowed on the public internships endpoint.",

      code: "METHOD_NOT_ALLOWED",
    },
    405
  );
}

export async function DELETE() {
  return json(
    {
      success: false,

      message:
        "DELETE is not allowed on the public internships endpoint.",

      code: "METHOD_NOT_ALLOWED",
    },
    405
  );
}