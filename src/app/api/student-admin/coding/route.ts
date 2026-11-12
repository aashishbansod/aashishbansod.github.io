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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COLLECTION_NAME = "codingquestions";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MAX_BODY_BYTES = 100_000;
const MAX_TEXT_LENGTH = 20_000;

type Difficulty = "easy" | "medium" | "hard";
type QuestionStatus = "draft" | "published" | "archived";
type JsonRecord = Record<string, unknown>;

interface CodingQuestionRecord {
  title: string;
  track: string;
  topic: string;
  difficulty: Difficulty;
  language: string;
  durationDays: number;
  dayNumber: number;
  points: number;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  explanation: string;
  status: QuestionStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

const questionSchema = new Schema<CodingQuestionRecord>(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    track: { type: String, required: true, trim: true, maxlength: 120 },
    topic: { type: String, required: true, trim: true, maxlength: 120 },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    language: { type: String, required: true, trim: true, maxlength: 60 },
    durationDays: { type: Number, required: true, min: 1, max: 365 },
    dayNumber: { type: Number, required: true, min: 1, max: 365 },
    points: { type: Number, required: true, min: 1, max: 1000 },
    problemStatement: { type: String, required: true, trim: true, maxlength: MAX_TEXT_LENGTH },
    inputFormat: { type: String, trim: true, maxlength: 5000, default: "" },
    outputFormat: { type: String, trim: true, maxlength: 5000, default: "" },
    constraints: { type: String, trim: true, maxlength: 5000, default: "" },
    sampleInput: { type: String, required: true, trim: true, maxlength: 10000 },
    sampleOutput: { type: String, required: true, trim: true, maxlength: 10000 },
    explanation: { type: String, trim: true, maxlength: MAX_TEXT_LENGTH, default: "" },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft", required: true },
    createdBy: { type: String, required: true, maxlength: 150 },
  },
  {
    timestamps: true,
    strict: true,
    versionKey: false,
    collection: COLLECTION_NAME,
  },
);

questionSchema.index({ status: 1, createdAt: -1 });
questionSchema.index({ track: 1, dayNumber: 1, durationDays: 1 });
questionSchema.index({ difficulty: 1, status: 1 });

function clean(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function response(
  body: unknown,
  status = 200,
  requestId: string = crypto.randomUUID(),
): NextResponse {
  const result = NextResponse.json(body, { status });
  result.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  result.headers.set("Pragma", "no-cache");
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("X-Frame-Options", "DENY");
  result.headers.set("Referrer-Policy", "no-referrer");
  result.headers.set("X-Request-Id", requestId);
  result.headers.set("Vary", "Cookie, Origin");
  return result;
}

function fail(
  requestId: string,
  status: number,
  code: string,
  message: string,
): NextResponse {
  return response({ success: false, code, message, requestId }, status, requestId);
}

async function authenticate(request: NextRequest, requestId: string): Promise<AuthResult> {
  const names = [
    STUDENT_ADMIN_AUTH_COOKIE_NAME,
    ADMIN_AUTH_COOKIE_NAME,
    AUTH_COOKIE_NAME,
  ];
  const tokens = [...new Set(names.map((name) => clean(request.cookies.get(name)?.value, 8192)).filter(Boolean))];

  for (const token of tokens) {
    try {
      const payload: unknown = await verifyAccessToken(token);
      if (!isRecord(payload)) continue;

      const role = clean(payload.role, 80).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
      const adminRole = clean(payload.adminRole, 100).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
      const sessionType = clean(payload.sessionType, 80).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

      if (
        role !== "admin" ||
        adminRole !== "student operations admin" ||
        sessionType !== "student admin"
      ) continue;

      const userId = clean(payload.userId || payload.id || payload.sub, 150);
      if (userId) return { ok: true, userId };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    response: fail(requestId, 401, "UNAUTHORIZED", "A valid Student Operations Admin session is required."),
  };
}

async function getQuestionModel(): Promise<Model<CodingQuestionRecord>> {
  const connection: Connection = await connectStudentDB();
  const existing = connection.models.CodingQuestion as Model<CodingQuestionRecord> | undefined;
  if (existing) return existing;
  return connection.model<CodingQuestionRecord>("CodingQuestion", questionSchema, COLLECTION_NAME);
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
  const header = request.headers.get("content-length");
  if (header !== null) {
    const length = Number(header);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY_BYTES) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
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

function serializeQuestion(record: Record<string, unknown>) {
  const id = record._id ? String(record._id) : "";
  return {
    id,
    title: clean(record.title, 180),
    track: clean(record.track, 120),
    topic: clean(record.topic, 120),
    difficulty: record.difficulty,
    dayNumber: Number(record.dayNumber) || 0,
    durationDays: Number(record.durationDays) || 0,
    points: Number(record.points) || 0,
    status: record.status,
    language: clean(record.language, 60),
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt ?? null,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt ?? null,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const auth = await authenticate(request, requestId);
    if (!auth.ok) return auth.response;

    const pageRaw = Number(request.nextUrl.searchParams.get("page") || 1);
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") || DEFAULT_LIMIT);
    const page = Number.isSafeInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 10000) : 1;
    const limit = Number.isSafeInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT;

    const search = clean(request.nextUrl.searchParams.get("search"), 120);
    const difficulty = clean(request.nextUrl.searchParams.get("difficulty"), 20).toLowerCase();
    const status = clean(request.nextUrl.searchParams.get("status"), 20).toLowerCase();
    const track = clean(request.nextUrl.searchParams.get("track"), 120);

    if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
      return fail(requestId, 400, "INVALID_DIFFICULTY", "Difficulty filter is invalid.");
    }
    if (status && !["draft", "published", "archived"].includes(status)) {
      return fail(requestId, 400, "INVALID_STATUS", "Status filter is invalid.");
    }

    const filter: Record<string, unknown> = {};
    if (difficulty) filter.difficulty = difficulty;
    if (status) filter.status = status;
    if (track) filter.track = track;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ title: regex }, { topic: regex }, { track: regex }, { problemStatement: regex }];
    }

    const Question = await getQuestionModel();
    const skip = (page - 1) * limit;

    const [records, total, totalQuestions, publishedQuestions, draftQuestions] = await Promise.all([
      Question.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean().exec(),
      Question.countDocuments(filter).exec(),
      Question.countDocuments({}).exec(),
      Question.countDocuments({ status: "published" }).exec(),
      Question.countDocuments({ status: "draft" }).exec(),
    ]);

    const questions = records.map((record) => serializeQuestion(record as unknown as Record<string, unknown>));

    return response({
      success: true,
      data: {
        questions,
        records: questions,
        students: [],
        stats: {
          totalQuestions,
          publishedQuestions,
          draftQuestions,
          totalStudents: 0,
          activeStudents: 0,
          submissionsToday: 0,
          completedToday: 0,
          attendanceToday: 0,
          averageProgress: 0,
          totalSubmissions: 0,
          passedSubmissions: 0,
          pendingSubmissions: 0,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      requestId,
    }, 200, requestId);
  } catch (error) {
    console.error("[StudentAdminCoding][GET]", { requestId, error });
    return fail(requestId, 500, "CODING_LOAD_FAILED", "Unable to load coding questions.");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    if (!sameOrigin(request)) {
      return fail(requestId, 403, "INVALID_ORIGIN", "Cross-origin requests are not allowed.");
    }

    const contentType = clean(request.headers.get("content-type"), 120).toLowerCase();
    if (!contentType.startsWith("application/json")) {
      return fail(requestId, 415, "INVALID_CONTENT_TYPE", "Content-Type must be application/json.");
    }

    const auth = await authenticate(request, requestId);
    if (!auth.ok) return auth.response;

    const body = await readJson(request);
    if (!body) return fail(requestId, 400, "INVALID_BODY", "A JSON object is required.");

    if (Object.keys(body).some((key) => !["action", "question"].includes(key))) {
      return fail(requestId, 400, "UNSUPPORTED_FIELDS", "The request contains unsupported fields.");
    }

    if (clean(body.action, 40) !== "create-question" || !isRecord(body.question)) {
      return fail(requestId, 400, "INVALID_ACTION", "Only create-question is supported.");
    }

    const input = body.question;
    const allowed = new Set([
      "title", "track", "topic", "difficulty", "language", "durationDays",
      "dayNumber", "points", "problemStatement", "inputFormat", "outputFormat",
      "constraints", "sampleInput", "sampleOutput", "explanation",
    ]);

    if (Object.keys(input).some((key) => !allowed.has(key))) {
      return fail(requestId, 400, "UNSUPPORTED_QUESTION_FIELDS", "The question contains unsupported fields.");
    }

    const title = clean(input.title, 180);
    const track = clean(input.track, 120);
    const topic = clean(input.topic, 120);
    const difficulty = clean(input.difficulty, 20).toLowerCase() as Difficulty;
    const language = clean(input.language, 60);
    const problemStatement = clean(input.problemStatement, MAX_TEXT_LENGTH);
    const inputFormat = clean(input.inputFormat, 5000);
    const outputFormat = clean(input.outputFormat, 5000);
    const constraints = clean(input.constraints, 5000);
    const sampleInput = clean(input.sampleInput, 10000);
    const sampleOutput = clean(input.sampleOutput, 10000);
    const explanation = clean(input.explanation, MAX_TEXT_LENGTH);
    const durationDays = Number(input.durationDays);
    const dayNumber = Number(input.dayNumber);
    const points = Number(input.points);

    if (title.length < 5 || !track || topic.length < 2 || !language || problemStatement.length < 20 || !sampleInput || !sampleOutput) {
      return fail(requestId, 422, "VALIDATION_FAILED", "Required question fields are missing or invalid.");
    }
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return fail(requestId, 422, "INVALID_DIFFICULTY", "Difficulty must be easy, medium or hard.");
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
      return fail(requestId, 422, "INVALID_DURATION", "Duration must be between 1 and 365 days.");
    }
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > durationDays) {
      return fail(requestId, 422, "INVALID_DAY", "Day number must be within the selected duration.");
    }
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      return fail(requestId, 422, "INVALID_POINTS", "Points must be between 1 and 1000.");
    }

    const Question = await getQuestionModel();
    const created = await Question.create({
      title,
      track,
      topic,
      difficulty,
      language,
      durationDays,
      dayNumber,
      points,
      problemStatement,
      inputFormat,
      outputFormat,
      constraints,
      sampleInput,
      sampleOutput,
      explanation,
      status: "draft",
      createdBy: auth.userId,
    });

    return response({
      success: true,
      message: "Coding question saved as draft successfully.",
      data: { question: serializeQuestion(created.toObject() as unknown as Record<string, unknown>) },
      requestId,
    }, 201, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PAYLOAD_TOO_LARGE") {
      return fail(requestId, 413, "PAYLOAD_TOO_LARGE", "The request payload is too large.");
    }
    if (message === "BODY_REQUIRED") {
      return fail(requestId, 400, "BODY_REQUIRED", "A JSON request body is required.");
    }
    if (message === "INVALID_JSON") {
      return fail(requestId, 400, "INVALID_JSON", "The request body must contain valid JSON.");
    }
    console.error("[StudentAdminCoding][POST]", { requestId, error });
    return fail(requestId, 500, "CODING_CREATE_FAILED", "Unable to create the coding question.");
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  const result = new NextResponse(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("X-Content-Type-Options", "nosniff");
  return result;
}
