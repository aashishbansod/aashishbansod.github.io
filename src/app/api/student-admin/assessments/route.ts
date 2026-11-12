
import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import InternshipModel from "@/models/Internship";
import {
  verifyAuthToken,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
} from "@/lib/auth";
import { getWeeklyAssessmentModel } from "@/models/WeeklyAssessment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 256 * 1024;
const MAX_PAGE = 10000;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;
const MAX_SEARCH_LENGTH = 120;

const ASSESSMENT_STATUSES = [
  "draft",
  "published",
  "locked",
  "archived",
] as const;

type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

const ALLOWED_STATUSES = new Set<string>(ASSESSMENT_STATUSES);

const ALLOWED_FORMATS = new Set([
  "zip",
  "pdf",
  "images",
  "github",
  "multiple",
]);

type AnyRecord = Record<string, unknown>;

type AuthenticatedAdmin = {
  id: string;
  identifier: string;
};

type AssessmentTaskInput = {
  taskId: string;
  title: string;
  instructions: string;
  topic: string;
  learningOutcome: string;
  marks: number;
  submissionType: "file" | "link" | "any";
  allowedFileTypes: string[];
  maxFileSizeMB: number;
  position: number;
  isRequired: boolean;
};

type ParsedAssessment = {
  title: string;
  description: string;
  domain: string;
  domainKey: string;
  module: string;
  weekNumber: number;
  topics: string[];
  tasks: AssessmentTaskInput[];
  totalMarks: number;
  passingMarks: number;
  startAt: Date;
  dueAt: Date;
  timezone: string;
  status: AssessmentStatus;
  isLocked: boolean;
  publishedAt: Date | null;
  lockedAt: Date | null;
  createdByAdminId: string;
  updatedByAdminId: string;
  publishedByAdminId: string;
  lockedByAdminId: string;
};

class RouteError extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 400,
    code = "INVALID_REQUEST",
  ) {
    super(message);
    this.name = "RouteError";
    this.status = status;
    this.code = code;
  }
}

function cleanString(value: unknown, maximum = 500): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function isRecord(value: unknown): value is AnyRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isAssessmentStatus(
  value: string,
): value is AssessmentStatus {
  return ALLOWED_STATUSES.has(value);
}

function secure(
  response: NextResponse,
  requestId: string,
): NextResponse {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );
  response.headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive",
  );
  response.headers.set("X-Request-Id", requestId);

  return response;
}

function json(
  requestId: string,
  body: unknown,
  status = 200,
): NextResponse {
  return secure(
    NextResponse.json(body, { status }),
    requestId,
  );
}

function failure(
  requestId: string,
  status: number,
  code: string,
  message: string,
): NextResponse {
  return json(
    requestId,
    {
      success: false,
      code,
      message,
      requestId,
    },
    status,
  );
}

function getRequestId(request: NextRequest): string {
  const supplied = cleanString(
    request.headers.get("x-request-id"),
    100,
  );

  return supplied &&
    /^[a-zA-Z0-9._:-]+$/.test(supplied)
    ? supplied
    : randomUUID();
}

function validSameOrigin(request: NextRequest): boolean {
  const origin = cleanString(
    request.headers.get("origin"),
    500,
  );

  if (!origin) return true;

  try {
    const expected = new URL(request.url);
    const actual = new URL(origin);

    return (
      expected.protocol === actual.protocol &&
      expected.host === actual.host
    );
  } catch {
    return false;
  }
}

function validContentLength(request: NextRequest): boolean {
  const raw = request.headers.get("content-length");

  if (!raw) return true;

  const length = Number(raw);

  return (
    Number.isSafeInteger(length) &&
    length >= 0 &&
    length <= MAX_BODY_BYTES
  );
}

async function authenticate(
  request: NextRequest,
  requestId: string,
): Promise<
  | { admin: AuthenticatedAdmin }
  | { response: NextResponse }
> {
  const token = request.cookies
    .get(STUDENT_ADMIN_AUTH_COOKIE_NAME)
    ?.value?.trim();

  if (!token) {
    return {
      response: failure(
        requestId,
        401,
        "UNAUTHORIZED",
        "Student Operations Admin login is required.",
      ),
    };
  }

  try {
    const verified = await verifyAuthToken(token);

    if (
      !verified ||
      verified.role !== "admin" ||
      verified.adminRole !== "Student Operations Admin" ||
      verified.sessionType !== "student-admin"
    ) {
      return {
        response: failure(
          requestId,
          403,
          "FORBIDDEN",
          "Only an authenticated Student Operations Admin can manage weekly assessments.",
        ),
      };
    }

    const id = cleanString(verified.id, 150);
    const identifier = cleanString(
      verified.identifier,
      254,
    );

    if (!id) {
      return {
        response: failure(
          requestId,
          401,
          "INVALID_ADMIN_ID",
          "The administrator identity is invalid.",
        ),
      };
    }

    return {
      admin: {
        id,
        identifier,
      },
    };
  } catch (error) {
    console.error(
      "[STUDENT_ADMIN_ASSESSMENTS_AUTH]",
      { requestId, error },
    );

    return {
      response: failure(
        requestId,
        401,
        "INVALID_SESSION",
        "Your Student Operations session is invalid or expired. Please sign in again.",
      ),
    };
  }
}

function positiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  if (value === null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function normalizeDomainKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getActiveMainAdminDomains(): Promise<
  Array<{
    name: string;
    key: string;
    isActive: true;
  }>
> {
  await connectDB();

  const records = await InternshipModel.find({
    status: "active",
    domain: {
      $type: "string",
      $ne: "",
    },
  })
    .select(
      "domain assessmentDomain status isPublic isSelectable",
    )
    .lean()
    .exec();

  const unique = new Map<
    string,
    {
      name: string;
      key: string;
      isActive: true;
    }
  >();

  for (const record of records) {
    const candidates = [
      record.domain,
      record.assessmentDomain,
    ];

    for (const candidate of candidates) {
      const name = cleanString(candidate, 150);
      const key = normalizeDomainKey(name);

      if (!name || !key) continue;

      const normalized = name.toLowerCase();

      if (!unique.has(normalized)) {
        unique.set(normalized, {
          name,
          key,
          isActive: true,
        });
      }
    }
  }

  return Array.from(unique.values()).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
}

function splitLines(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, maximumItems)
    .map((item) => cleanString(item, maximumLength))
    .filter(Boolean);
}

function parseDate(
  value: unknown,
  label: string,
): Date {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    throw new RouteError(
      `${label} must be a valid date and time.`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RouteError(
      `${label} must be a valid date and time.`,
    );
  }

  return date;
}

function parseAssessmentBody(
  body: AnyRecord,
  admin: AuthenticatedAdmin,
): ParsedAssessment {
  const title = cleanString(body.title, 180);
  const domain = cleanString(body.domain, 120);
  const week = Number(
    body.week ?? body.weekNumber,
  );
  const totalMarks = Number(body.totalMarks);
  const passingMarks = Number(body.passingMarks);

  const statusValue = cleanString(
    body.status || "draft",
    20,
  ).toLowerCase();

  if (!isAssessmentStatus(statusValue)) {
    throw new RouteError(
      "Assessment status is invalid.",
    );
  }

  const status: AssessmentStatus = statusValue;

  const topics = splitLines(
    body.topics,
    40,
    160,
  );

  const rawTasks = Array.isArray(body.tasks)
    ? body.tasks
    : [];

  if (title.length < 4) {
    throw new RouteError(
      "Assessment title must contain at least 4 characters.",
    );
  }

  if (domain.length < 2) {
    throw new RouteError(
      "Select a valid active Main Admin domain.",
    );
  }

  if (
    !Number.isSafeInteger(week) ||
    week < 1 ||
    week > 104
  ) {
    throw new RouteError(
      "Week number must be between 1 and 104.",
    );
  }

  if (!topics.length) {
    throw new RouteError(
      "Add at least one topic covered in the weekly tasks.",
    );
  }

  if (
    !rawTasks.length ||
    rawTasks.length > 30
  ) {
    throw new RouteError(
      "Add between 1 and 30 weekly tasks.",
    );
  }

  if (
    !Number.isFinite(totalMarks) ||
    totalMarks < 1 ||
    totalMarks > 10000
  ) {
    throw new RouteError(
      "Total marks must be between 1 and 10000.",
    );
  }

  if (
    !Number.isFinite(passingMarks) ||
    passingMarks < 0 ||
    passingMarks > totalMarks
  ) {
    throw new RouteError(
      "Passing marks must be between zero and total marks.",
    );
  }

  const startAt = parseDate(
    body.startAt,
    "Start date",
  );

  const dueAt = parseDate(
    body.deadline ?? body.dueAt,
    "Submission deadline",
  );

  if (dueAt.getTime() <= startAt.getTime()) {
    throw new RouteError(
      "Submission deadline must be later than the start date.",
    );
  }

  const submissionFormat = cleanString(
    body.submissionFormat || "zip",
    20,
  );

  if (!ALLOWED_FORMATS.has(submissionFormat)) {
    throw new RouteError(
      "Submission format is not supported.",
    );
  }

  const submissionType: AssessmentTaskInput["submissionType"] =
    submissionFormat === "github"
      ? "link"
      : submissionFormat === "multiple"
        ? "any"
        : "file";

  const allowedFileTypes =
    submissionFormat === "zip"
      ? ["zip"]
      : submissionFormat === "pdf"
        ? ["pdf"]
        : submissionFormat === "images"
          ? ["png", "jpg", "jpeg", "webp"]
          : submissionFormat === "github"
            ? []
            : [
                "zip",
                "pdf",
                "png",
                "jpg",
                "jpeg",
                "webp",
              ];

  const tasks: AssessmentTaskInput[] =
    rawTasks.map((rawTask, index) => {
      if (!isRecord(rawTask)) {
        throw new RouteError(
          `Task ${index + 1} is invalid.`,
        );
      }

      const taskTitle = cleanString(
        rawTask.title,
        160,
      );

      const instructions = cleanString(
        rawTask.instructions,
        8000,
      );

      const taskTopics = splitLines(
        rawTask.topics,
        20,
        160,
      );

      const marks = Number(rawTask.marks);
      const topic = taskTopics[0] || topics[0];

      if (taskTitle.length < 3) {
        throw new RouteError(
          `Task ${index + 1} needs a title of at least 3 characters.`,
        );
      }

      if (instructions.length < 10) {
        throw new RouteError(
          `Task ${index + 1} instructions must contain at least 10 characters.`,
        );
      }

      if (
        !Number.isFinite(marks) ||
        marks < 1 ||
        marks > 1000
      ) {
        throw new RouteError(
          `Task ${index + 1} marks must be between 1 and 1000.`,
        );
      }

      return {
        taskId: randomUUID(),
        title: taskTitle,
        instructions,
        topic,
        learningOutcome: taskTopics
          .slice(1)
          .join(", "),
        marks,
        submissionType,
        allowedFileTypes,
        maxFileSizeMB: 10,
        position: index,
        isRequired: true,
      };
    });

  const calculatedMarks = tasks.reduce(
    (sum, task) => sum + task.marks,
    0,
  );

  if (calculatedMarks !== totalMarks) {
    throw new RouteError(
      `Task marks total (${calculatedMarks}) must equal assessment total marks (${totalMarks}).`,
    );
  }

  const isLocked = status !== "published";

  return {
    title,
    description: cleanString(
      body.description,
      4000,
    ),
    domain,
    domainKey: normalizeDomainKey(domain),
    module:
      cleanString(body.module || title, 160) ||
      title,
    weekNumber: week,
    topics,
    tasks,
    totalMarks,
    passingMarks,
    startAt,
    dueAt,
    timezone: "Asia/Kolkata",
    status,
    isLocked,
    publishedAt:
      status === "published" ? new Date() : null,
    lockedAt:
      status === "locked" ? new Date() : null,
    createdByAdminId: admin.id,
    updatedByAdminId: admin.id,
    publishedByAdminId:
      status === "published" ? admin.id : "",
    lockedByAdminId:
      status === "locked" ? admin.id : "",
  };
}

function serializeAssessment(record: AnyRecord) {
  const tasks = Array.isArray(record.tasks)
    ? record.tasks
    : [];

  const firstTask = isRecord(tasks[0])
    ? tasks[0]
    : {};

  const firstSubmissionType = cleanString(
    firstTask.submissionType,
    20,
  );

  const submissionFormat =
    firstSubmissionType === "link"
      ? "github"
      : firstSubmissionType === "any"
        ? "multiple"
        : Array.isArray(firstTask.allowedFileTypes) &&
            firstTask.allowedFileTypes.includes("pdf")
          ? "pdf"
          : Array.isArray(firstTask.allowedFileTypes) &&
              firstTask.allowedFileTypes.includes("png")
            ? "images"
            : "zip";

  return {
    id: String(record._id ?? ""),
    assessmentCode: cleanString(
      record.assessmentCode,
      40,
    ),
    title: cleanString(record.title, 180),
    description: cleanString(
      record.description,
      4000,
    ),
    domain: cleanString(record.domain, 120),
    domainKey: cleanString(
      record.domainKey,
      140,
    ),
    week: Number(record.weekNumber ?? 1),
    topics: Array.isArray(record.topics)
      ? record.topics
      : [],
    tasks: tasks.map((task) => {
      const value = isRecord(task)
        ? task
        : {};

      const relatedTopics = [
        cleanString(value.topic, 160),
        ...cleanString(
          value.learningOutcome,
          2000,
        )
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ].filter(Boolean);

      return {
        id: cleanString(value.taskId, 80),
        title: cleanString(value.title, 160),
        instructions: cleanString(
          value.instructions,
          8000,
        ),
        topics: relatedTopics,
        marks: Number(value.marks ?? 0),
        submissionType: cleanString(
          value.submissionType,
          20,
        ),
      };
    }),
    totalMarks: Number(
      record.totalMarks ?? 0,
    ),
    passingMarks: Number(
      record.passingMarks ?? 0,
    ),
    startAt:
      record.startAt instanceof Date
        ? record.startAt.toISOString()
        : record.startAt,
    deadline:
      record.dueAt instanceof Date
        ? record.dueAt.toISOString()
        : record.dueAt,
    submissionFormat,
    status: cleanString(record.status, 20),
    isLocked: record.isLocked === true,
    assignedCount: 0,
    submittedCount: 0,
    reviewedCount: 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
    lockedAt: record.lockedAt,
  };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  const auth = await authenticate(
    request,
    requestId,
  );

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const page = positiveInteger(
      request.nextUrl.searchParams.get("page"),
      1,
      MAX_PAGE,
    );

    const limit = positiveInteger(
      request.nextUrl.searchParams.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    const search = cleanString(
      request.nextUrl.searchParams.get("search"),
      MAX_SEARCH_LENGTH,
    );

    const status = cleanString(
      request.nextUrl.searchParams.get("status"),
      20,
    ).toLowerCase();

    const domain = cleanString(
      request.nextUrl.searchParams.get("domain"),
      120,
    );

    if (
      status &&
      status !== "all" &&
      !ALLOWED_STATUSES.has(status)
    ) {
      return failure(
        requestId,
        400,
        "INVALID_STATUS_FILTER",
        "Assessment status filter is invalid.",
      );
    }

    const Assessment =
      await getWeeklyAssessmentModel();

    const filter: AnyRecord = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (domain && domain !== "all") {
      filter.domain = domain;
    }

    if (search) {
      const escaped = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      const regex = new RegExp(
        escaped,
        "i",
      );

      filter.$or = [
        { title: regex },
        { domain: regex },
        { assessmentCode: regex },
        { topics: regex },
        { "tasks.title": regex },
        { "tasks.instructions": regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [
      records,
      total,
      statusCounts,
    ] = await Promise.all([
      Assessment.find(filter)
        .select("-metadata")
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      Assessment.countDocuments(filter).exec(),

      Assessment.aggregate([
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
          },
        },
      ]).exec(),
    ]);

    const stats = {
      total: statusCounts.reduce(
        (sum, item) =>
          sum + Number(item.count || 0),
        0,
      ),
      draft: 0,
      published: 0,
      locked: 0,
      archived: 0,
    };

    for (const item of statusCounts) {
      const key = cleanString(
        item._id,
        20,
      );

      if (
        key in stats &&
        key !== "total"
      ) {
        stats[
          key as
            | "draft"
            | "published"
            | "locked"
            | "archived"
        ] = Number(item.count || 0);
      }
    }

    const assessments = records.map(
      (record) =>
        serializeAssessment(
          record as unknown as AnyRecord,
        ),
    );

    return json(requestId, {
      success: true,
      message:
        "Weekly task assessments loaded successfully.",
      assessments,
      items: assessments,
      data: assessments,
      pagination: {
        page,
        limit,
        total,
        totalPages:
          total === 0
            ? 0
            : Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
      stats,
    });
  } catch (error) {
    console.error(
      "[STUDENT_ADMIN_ASSESSMENTS_GET]",
      {
        requestId,
        error,
      },
    );

    return failure(
      requestId,
      500,
      "ASSESSMENTS_FETCH_FAILED",
      "Unable to load weekly assessments. Check the Student Operations database connection.",
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  if (!validSameOrigin(request)) {
    return failure(
      requestId,
      403,
      "INVALID_ORIGIN",
      "Request origin is not allowed.",
    );
  }

  if (!validContentLength(request)) {
    return failure(
      requestId,
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body is too large.",
    );
  }

  const auth = await authenticate(
    request,
    requestId,
  );

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const contentType =
      request.headers.get("content-type") || "";

    if (
      !contentType
        .toLowerCase()
        .includes("application/json")
    ) {
      return failure(
        requestId,
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Send assessment data as JSON.",
      );
    }

    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return failure(
        requestId,
        400,
        "INVALID_BODY",
        "Assessment request body is invalid.",
      );
    }

    const parsed = parseAssessmentBody(
      body,
      auth.admin,
    );

    const domains =
      await getActiveMainAdminDomains();

    const activeDomain = domains.find(
      (item) =>
        item.name.toLowerCase() ===
          parsed.domain.toLowerCase() ||
        item.key === parsed.domainKey,
    );

    if (!activeDomain) {
      return failure(
        requestId,
        409,
        "DOMAIN_NOT_ACTIVE",
        "This domain is not currently active in Main Admin internships. Refresh the domain list and select an active domain.",
      );
    }

    parsed.domain = activeDomain.name;
    parsed.domainKey = activeDomain.key;

    const Assessment =
      await getWeeklyAssessmentModel();

    const assessmentCode =
      `WKA-${Date.now()
        .toString(36)
        .toUpperCase()}-${randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

    const assessmentPayload = {
      ...parsed,
      assessmentCode,
    };

    const created = await Assessment.create(
      assessmentPayload,
    );

    const serialized = serializeAssessment(
      created.toObject() as unknown as AnyRecord,
    );

    return json(
      requestId,
      {
        success: true,
        message:
          created.status === "published"
            ? "Weekly assessment published successfully."
            : "Weekly assessment saved successfully.",
        assessment: serialized,
        data: serialized,
      },
      201,
    );
  } catch (error) {
    if (error instanceof RouteError) {
      return failure(
        requestId,
        error.status,
        error.code,
        error.message,
      );
    }

    if (
      isRecord(error) &&
      error.code === 11000
    ) {
      return failure(
        requestId,
        409,
        "DUPLICATE_WEEKLY_ASSESSMENT",
        "An assessment with this title already exists for this domain and week.",
      );
    }

    console.error(
      "[STUDENT_ADMIN_ASSESSMENTS_POST]",
      {
        requestId,
        error,
      },
    );

    return failure(
      requestId,
      500,
      "ASSESSMENT_CREATE_FAILED",
      "Unable to create the weekly assessment. Verify the database connection and submitted fields.",
    );
  }
}

export async function OPTIONS(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  return json(
    requestId,
    {
      success: true,
      methods: [
        "GET",
        "POST",
        "OPTIONS",
      ],
    },
    200,
  );
}
