import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { Schema, type Connection, type Model } from "mongoose";
import {
  ADMIN_AUTH_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  STUDENT_ADMIN_AUTH_COOKIE_NAME,
  verifyAccessToken,
} from "@/lib/auth";
import { connectStudentDB } from "@/lib/student-db";
import { getStudentOperationsModel } from "@/models/StudentOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COLLECTION_NAME = "studenttasks";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;
const MAX_PAGE = 100000;
const MAX_BODY_BYTES = 100000;
const MAX_REQUIREMENTS = 40;
const MAX_TEXT_LENGTH = 20000;
const DOMAINS = [
  "MERN Stack Developer",
  "Java Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Python Developer",
  "Data Analyst",
  "Software Developer",
] as const;

type Difficulty = "Easy" | "Medium" | "Hard";
type TaskStatus = "Draft" | "Published" | "Archived";
type JsonRecord = Record<string, unknown>;

interface StudentTaskRecord {
  title: string;
  domain: string;
  topic: string;
  dayNumber: number;
  durationDays: number;
  difficulty: Difficulty;
  estimatedMinutes: number;
  points: number;
  problemStatement: string;
  instructions: string;
  requirements: string[];
  starterHtml: string;
  starterCss: string;
  starterJs: string;
  expectedOutput: string;
  status: TaskStatus;
  createdBy: string;
  updatedBy: string;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

const taskSchema = new Schema<StudentTaskRecord>(
  {
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 180 },
    domain: { type: String, required: true, trim: true, enum: [...DOMAINS], maxlength: 120 },
    topic: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    dayNumber: { type: Number, required: true, min: 1, max: 365 },
    durationDays: { type: Number, required: true, min: 1, max: 365 },
    difficulty: { type: String, required: true, enum: ["Easy", "Medium", "Hard"] },
    estimatedMinutes: { type: Number, required: true, min: 5, max: 1440 },
    points: { type: Number, required: true, min: 1, max: 1000 },
    problemStatement: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
    instructions: { type: String, required: true, trim: true, minlength: 10, maxlength: 8000 },
    requirements: { type: [String], required: true, validate: [(value: string[]) => value.length > 0 && value.length <= MAX_REQUIREMENTS, "Invalid requirements count"] },
    starterHtml: { type: String, maxlength: 50000, default: "" },
    starterCss: { type: String, maxlength: 30000, default: "" },
    starterJs: { type: String, maxlength: 30000, default: "" },
    expectedOutput: { type: String, maxlength: 4000, default: "" },
    status: { type: String, required: true, enum: ["Draft", "Published", "Archived"], default: "Draft" },
    createdBy: { type: String, required: true, maxlength: 150 },
    updatedBy: { type: String, required: true, maxlength: 150 },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
    collection: COLLECTION_NAME,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

taskSchema.index({ status: 1, createdAt: -1 });
taskSchema.index({ domain: 1, durationDays: 1, dayNumber: 1, status: 1 });
taskSchema.index({ domain: 1, status: 1, difficulty: 1 });

function clean(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function cleanMultiline(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").slice(0, max);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function secure(body: unknown, status = 200, requestId: string = crypto.randomUUID()): NextResponse {
  const result = NextResponse.json(body, { status });
  result.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  result.headers.set("Pragma", "no-cache");
  result.headers.set("Expires", "0");
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("X-Frame-Options", "DENY");
  result.headers.set("Referrer-Policy", "no-referrer");
  result.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  result.headers.set("X-Request-Id", requestId);
  result.headers.set("Vary", "Cookie, Origin");
  return result;
}

function fail(requestId: string, status: number, code: string, message: string): NextResponse {
  return secure({ success: false, code, message, requestId }, status, requestId);
}

function normalizeRole(value: unknown): string {
  return clean(value, 100).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function authenticate(request: NextRequest, requestId: string): AuthResult {
  const names = [STUDENT_ADMIN_AUTH_COOKIE_NAME, ADMIN_AUTH_COOKIE_NAME, AUTH_COOKIE_NAME];
  const tokens = [...new Set(names.map((name) => clean(request.cookies.get(name)?.value, 8192)).filter(Boolean))];

  for (const token of tokens) {
    try {
      const payload: unknown = verifyAccessToken(token);
      if (!isRecord(payload)) continue;
      if (normalizeRole(payload.role) !== "admin") continue;
      if (normalizeRole(payload.adminRole) !== "student operations admin") continue;
      if (normalizeRole(payload.sessionType) !== "student admin") continue;
      const userId = clean(payload.userId || payload.id || payload.sub, 150);
      if (userId) return { ok: true, userId };
    } catch {
      continue;
    }
  }

  return { ok: false, response: fail(requestId, 401, "UNAUTHORIZED", "A valid Student Operations Admin session is required.") };
}

function sameOrigin(request: NextRequest): boolean {
  const origin = clean(request.headers.get("origin"), 2048);
  if (!origin) return false;
  try {
    const actual = new URL(origin);
    const expected = new URL(request.url);
    return actual.protocol === expected.protocol && actual.host.toLowerCase() === expected.host.toLowerCase();
  } catch {
    return false;
  }
}

async function readJson(request: NextRequest): Promise<JsonRecord | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0 || parsedLength > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  }
  if (!request.body) throw new Error("BODY_REQUIRED");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("INVALID_JSON");
  }
  return isRecord(parsed) ? parsed : null;
}

function serializeTask(record: Record<string, unknown>, assignedStudents = 0, submissions = 0, approved = 0) {
  return {
    id: record._id ? String(record._id) : "",
    title: clean(record.title, 180),
    domain: clean(record.domain, 120),
    topic: clean(record.topic, 120),
    dayNumber: Number(record.dayNumber) || 0,
    durationDays: Number(record.durationDays) || 0,
    difficulty: record.difficulty,
    estimatedMinutes: Number(record.estimatedMinutes) || 0,
    points: Number(record.points) || 0,
    status: record.status,
    assignedStudents,
    submissions,
    approved,
    problemStatement: cleanMultiline(record.problemStatement, 5000),
    instructions: cleanMultiline(record.instructions, 8000),
    requirements: Array.isArray(record.requirements) ? record.requirements.map((item) => clean(item, 500)).filter(Boolean) : [],
    starterHtml: cleanMultiline(record.starterHtml, 50000),
    starterCss: cleanMultiline(record.starterCss, 30000),
    starterJs: cleanMultiline(record.starterJs, 30000),
    expectedOutput: cleanMultiline(record.expectedOutput, 4000),
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt ?? null,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt ?? null,
    publishedAt: record.publishedAt instanceof Date ? record.publishedAt.toISOString() : record.publishedAt ?? null,
    archivedAt: record.archivedAt instanceof Date ? record.archivedAt.toISOString() : record.archivedAt ?? null,
  };
}

async function getTaskModel(): Promise<Model<StudentTaskRecord>> {
  const connection: Connection = await connectStudentDB();
  if (connection.readyState !== 1) throw new Error("Student Operations database connection is not ready.");
  const existing = connection.models.StudentTask as Model<StudentTaskRecord> | undefined;
  if (existing) return existing;
  return connection.model<StudentTaskRecord>("StudentTask", taskSchema, COLLECTION_NAME);
}

function normalizeRequirements(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clean(item, 500)).filter(Boolean).slice(0, MAX_REQUIREMENTS);
}

function validateTask(input: JsonRecord) {
  const title = clean(input.title, 180);
  const domain = clean(input.domain, 120);
  const topic = clean(input.topic, 120);
  const dayNumber = Number(input.dayNumber);
  const durationDays = Number(input.durationDays);
  const difficulty = clean(input.difficulty, 20) as Difficulty;
  const estimatedMinutes = Number(input.estimatedMinutes);
  const points = Number(input.points);
  const problemStatement = cleanMultiline(input.problemStatement, 5000).trim();
  const instructions = cleanMultiline(input.instructions, 8000).trim();
  const requirements = normalizeRequirements(input.requirements);
  const starterHtml = cleanMultiline(input.starterHtml, 50000);
  const starterCss = cleanMultiline(input.starterCss, 30000);
  const starterJs = cleanMultiline(input.starterJs, 30000);
  const expectedOutput = cleanMultiline(input.expectedOutput, 4000).trim();

  if (title.length < 5 || topic.length < 2 || problemStatement.length < 20 || instructions.length < 10 || requirements.length === 0) throw new Error("VALIDATION_FAILED");
  if (!(DOMAINS as readonly string[]).includes(domain)) throw new Error("INVALID_DOMAIN");
  if (!Number.isInteger(dayNumber) || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365 || dayNumber < 1 || dayNumber > durationDays) throw new Error("INVALID_DAY_RANGE");
  if (!["Easy", "Medium", "Hard"].includes(difficulty)) throw new Error("INVALID_DIFFICULTY");
  if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 1440) throw new Error("INVALID_ESTIMATED_MINUTES");
  if (!Number.isInteger(points) || points < 1 || points > 1000) throw new Error("INVALID_POINTS");
  if (starterHtml.length > 50000 || starterCss.length > 30000 || starterJs.length > 30000) throw new Error("STARTER_CODE_TOO_LARGE");

  return { title, domain, topic, dayNumber, durationDays, difficulty, estimatedMinutes, points, problemStatement, instructions, requirements, starterHtml, starterCss, starterJs, expectedOutput };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  try {
    const auth = authenticate(request, requestId);
    if (!auth.ok) return auth.response;

    const params = request.nextUrl.searchParams;
    const view = clean(params.get("view"), 30) || "overview";
    if (!["overview", "library", "submissions"].includes(view)) return fail(requestId, 400, "INVALID_VIEW", "The requested task view is invalid.");

    const page = positiveInteger(params.get("page"), 1, MAX_PAGE);
    const limit = positiveInteger(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const search = clean(params.get("search"), 120);
    const domain = clean(params.get("domain"), 120);
    const status = clean(params.get("status"), 20);

    if (domain && !(DOMAINS as readonly string[]).includes(domain)) return fail(requestId, 400, "INVALID_DOMAIN", "The selected domain is invalid.");
    if (status && !["Draft", "Published", "Archived"].includes(status)) return fail(requestId, 400, "INVALID_STATUS", "The selected task status is invalid.");

    const filter: Record<string, unknown> = {};
    if (domain) filter.domain = domain;
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ title: regex }, { topic: regex }, { domain: regex }, { problemStatement: regex }];
    }

    const Task = await getTaskModel();
    const StudentOperations = await getStudentOperationsModel();
    const skip = (page - 1) * limit;

    const [records, total, totalTasks, publishedTasks, draftTasks, assignedStudents] = await Promise.all([
      Task.find(view === "submissions" ? {} : filter).sort({ createdAt: -1, _id: -1 }).skip(view === "submissions" ? 0 : skip).limit(view === "submissions" ? 1 : limit).lean().exec(),
      Task.countDocuments(view === "submissions" ? {} : filter).exec(),
      Task.countDocuments({}).exec(),
      Task.countDocuments({ status: "Published" }).exec(),
      Task.countDocuments({ status: "Draft" }).exec(),
      StudentOperations.countDocuments({ operationsApprovalStatus: "approved", dashboardLoginEnabled: true }).exec(),
    ]);

    const tasks = view === "submissions" ? [] : records.map((record) => serializeTask(record as unknown as Record<string, unknown>));
    const enrichedTasks = await Promise.all(tasks.map(async (task) => {
      const count = await StudentOperations.countDocuments({
        operationsApprovalStatus: "approved",
        dashboardLoginEnabled: true,
        internshipTrack: task.domain,
        internshipDurationDays: { $gte: task.durationDays },
      }).exec();
      return { ...task, assignedStudents: count };
    }));

    return secure({
      success: true,
      data: {
        tasks: enrichedTasks,
        records: enrichedTasks,
        submissions: [],
        stats: {
          totalTasks,
          publishedTasks,
          draftTasks,
          assignedStudents,
          pendingReviews: null,
          approvedSubmissions: null,
          submissionTrackingAvailable: false,
        },
        pagination: {
          page,
          limit,
          total: view === "submissions" ? 0 : total,
          totalPages: view === "submissions" ? 0 : Math.ceil(total / limit),
        },
        capabilities: {
          taskLibrary: true,
          taskPublishing: true,
          taskArchiving: true,
          submissionReview: false,
          submissionMessage: "A task submission model and student submission API are not present in the supplied project sources. Submission records are not fabricated.",
        },
        viewer: { id: auth.userId, role: "Student Operations Admin" },
        generatedAt: new Date().toISOString(),
      },
      requestId,
    }, 200, requestId);
  } catch (error) {
    console.error("[StudentAdminTasks][GET]", { requestId, error });
    return fail(requestId, 500, "TASKS_LOAD_FAILED", "Unable to load task management data.");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  try {
    if (!sameOrigin(request)) return fail(requestId, 403, "INVALID_ORIGIN", "Cross-origin requests are not allowed.");
    const contentType = clean(request.headers.get("content-type"), 120).toLowerCase();
    if (!/^application\/json(?:\s*;|$)/.test(contentType)) return fail(requestId, 415, "INVALID_CONTENT_TYPE", "Content-Type must be application/json.");
    const auth = authenticate(request, requestId);
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (!body) return fail(requestId, 400, "INVALID_BODY", "A JSON object is required.");
    if (Object.keys(body).some((key) => !["action", "task"].includes(key))) return fail(requestId, 400, "UNSUPPORTED_FIELDS", "The request contains unsupported fields.");
    if (clean(body.action, 40) !== "create-task" || !isRecord(body.task)) return fail(requestId, 400, "INVALID_ACTION", "Only create-task is supported.");

    const allowed = new Set(["title", "domain", "topic", "dayNumber", "durationDays", "difficulty", "estimatedMinutes", "points", "problemStatement", "instructions", "requirements", "starterHtml", "starterCss", "starterJs", "expectedOutput"]);
    if (Object.keys(body.task).some((key) => !allowed.has(key))) return fail(requestId, 400, "UNSUPPORTED_TASK_FIELDS", "The task contains unsupported fields.");
    const input = validateTask(body.task);
    const Task = await getTaskModel();
    const created = await Task.create({ ...input, status: "Draft", createdBy: auth.userId, updatedBy: auth.userId });
    return secure({ success: true, message: "Task saved as draft successfully.", data: { task: serializeTask(created.toObject() as unknown as Record<string, unknown>) }, requestId }, 201, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const validationMessages: Record<string, string> = {
      VALIDATION_FAILED: "Required task fields are missing or invalid.",
      INVALID_DOMAIN: "Select a supported internship domain.",
      INVALID_DAY_RANGE: "Day number must be within the program duration.",
      INVALID_DIFFICULTY: "Difficulty must be Easy, Medium or Hard.",
      INVALID_ESTIMATED_MINUTES: "Estimated time must be between 5 and 1440 minutes.",
      INVALID_POINTS: "Points must be between 1 and 1000.",
      STARTER_CODE_TOO_LARGE: "Starter code exceeds the allowed size.",
      PAYLOAD_TOO_LARGE: "The request payload is too large.",
      BODY_REQUIRED: "A JSON request body is required.",
      INVALID_JSON: "The request body must contain valid JSON.",
    };
    if (validationMessages[message]) return fail(requestId, message === "PAYLOAD_TOO_LARGE" ? 413 : 422, message, validationMessages[message]);
    console.error("[StudentAdminTasks][POST]", { requestId, error });
    return fail(requestId, 500, "TASK_CREATE_FAILED", "Unable to create the task.");
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  try {
    if (!sameOrigin(request)) return fail(requestId, 403, "INVALID_ORIGIN", "Cross-origin requests are not allowed.");
    const contentType = clean(request.headers.get("content-type"), 120).toLowerCase();
    if (!/^application\/json(?:\s*;|$)/.test(contentType)) return fail(requestId, 415, "INVALID_CONTENT_TYPE", "Content-Type must be application/json.");
    const auth = authenticate(request, requestId);
    if (!auth.ok) return auth.response;
    const body = await readJson(request);
    if (!body) return fail(requestId, 400, "INVALID_BODY", "A JSON object is required.");
    if (Object.keys(body).some((key) => !["action", "taskId"].includes(key))) return fail(requestId, 400, "UNSUPPORTED_FIELDS", "The request contains unsupported fields.");
    const action = clean(body.action, 40);
    const taskId = clean(body.taskId, 64);
    if (!/^[a-f\d]{24}$/i.test(taskId)) return fail(requestId, 422, "INVALID_TASK_ID", "A valid task ID is required.");
    if (!["publish-task", "archive-task"].includes(action)) return fail(requestId, 400, "INVALID_ACTION", "Only publish-task and archive-task are supported.");

    const Task = await getTaskModel();
    const current = await Task.findById(taskId).select("status title").lean().exec();
    if (!current) return fail(requestId, 404, "TASK_NOT_FOUND", "The requested task was not found.");
    if (action === "publish-task" && current.status !== "Draft") return fail(requestId, 409, "TASK_STATE_CONFLICT", "Only draft tasks can be published.");
    if (action === "archive-task" && current.status !== "Published") return fail(requestId, 409, "TASK_STATE_CONFLICT", "Only published tasks can be archived.");

    const now = new Date();
    const update = action === "publish-task"
      ? { status: "Published", publishedAt: now, archivedAt: null, updatedBy: auth.userId }
      : { status: "Archived", archivedAt: now, updatedBy: auth.userId };
    const updated = await Task.findOneAndUpdate(
      { _id: taskId, status: current.status },
      { $set: update },
      { new: true, runValidators: true },
    ).lean().exec();
    if (!updated) return fail(requestId, 409, "TASK_STATE_CONFLICT", "The task changed while this action was being processed. Refresh and try again.");
    return secure({ success: true, message: action === "publish-task" ? "Task published successfully." : "Task archived successfully.", data: { task: serializeTask(updated as unknown as Record<string, unknown>) }, requestId }, 200, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PAYLOAD_TOO_LARGE") return fail(requestId, 413, message, "The request payload is too large.");
    if (message === "BODY_REQUIRED") return fail(requestId, 400, message, "A JSON request body is required.");
    if (message === "INVALID_JSON") return fail(requestId, 400, message, "The request body must contain valid JSON.");
    console.error("[StudentAdminTasks][PATCH]", { requestId, error });
    return fail(requestId, 500, "TASK_UPDATE_FAILED", "Unable to update the task status.");
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  const result = new NextResponse(null, { status: 204, headers: { Allow: "GET, POST, PATCH, OPTIONS" } });
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("X-Frame-Options", "DENY");
  return result;
}
