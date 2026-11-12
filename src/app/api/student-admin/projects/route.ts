import { NextRequest, NextResponse } from "next/server";
import mongoose, { type Model } from "mongoose";
import { AUTH_COOKIE_NAME, STUDENT_AUTH_COOKIE_NAME, verifyAccessToken } from "@/lib/auth";
import { connectStudentDB } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 24 * 1024;
const MAX_SEARCH_LENGTH = 120;
const MAX_LIMIT = 100;
const MAX_PAGE = 100000;
const MAX_TITLE_LENGTH = 140;
const MAX_DESCRIPTION_LENGTH = 1500;
const MAX_INSTRUCTIONS_LENGTH = 5000;
const MAX_FEEDBACK_LENGTH = 2000;
const PROJECT_TYPES = ["Major", "Minor"] as const;
const PROJECT_STATUSES = ["draft", "published", "archived"] as const;
const ASSIGNMENT_STATUSES = ["Not Started", "In Progress", "Submitted", "Under Review", "Approved", "Revision Required"] as const;

type ProjectType = (typeof PROJECT_TYPES)[number];
type ProjectStatus = (typeof PROJECT_STATUSES)[number];
type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

type Actor = {
  id: string;
  role: string;
  email: string;
};

type TokenClaims = {
  userId?: unknown;
  id?: unknown;
  adminId?: unknown;
  sub?: unknown;
  email?: unknown;
  role?: unknown;
  adminRole?: unknown;
  userType?: unknown;
  sessionType?: unknown;
};

type ProjectRecord = {
  _id: mongoose.Types.ObjectId;
  title: string;
  projectType: ProjectType;
  domain: string;
  description: string;
  instructions: string;
  requirements: string[];
  archiveFileName: string;
  archiveSize: number;
  archiveObjectKey: string;
  archiveContentType: string;
  status: ProjectStatus;
  createdBy: string;
  createdByEmail: string;
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type AssignmentRecord = {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  mainStudentId: string;
  studentOperationsId: mongoose.Types.ObjectId;
  studentName: string;
  studentEmail: string;
  studentId: string;
  dashboardStudentId: string;
  internshipTrack: string;
  projectTitle: string;
  projectType: ProjectType;
  assignedBy: string;
  assignedByEmail: string;
  dueAt?: Date | null;
  status: AssignmentStatus;
  progressPercent: number;
  studentNote: string;
  submissionFileName: string;
  submissionObjectKey: string;
  submissionNote: string;
  submittedAt?: Date | null;
  reviewFeedback: string;
  reviewedBy: string;
  reviewedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

class RouteError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "RouteError";
    this.status = status;
    this.code = code;
  }
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie, Authorization",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  });
}

function clean(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function recordOf(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCookieToken(request: NextRequest, name: string): string {
  return request.cookies.get(name)?.value?.trim() || "";
}

async function authenticate(request: NextRequest): Promise<Actor> {
  const tokens = [
    getCookieToken(request, AUTH_COOKIE_NAME),
    getCookieToken(request, STUDENT_AUTH_COOKIE_NAME),
  ].filter(Boolean);

  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    tokens.push(authorization.slice(7).trim());
  }

  let claims: TokenClaims | null = null;

  for (const token of [...new Set(tokens)]) {
    try {
      const payload = await verifyAccessToken(token);
      const record = recordOf(payload);
      if (record) {
        claims = record as TokenClaims;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!claims) {
    throw new RouteError("Authentication required.", 401, "AUTH_REQUIRED");
  }

  const id = clean(claims.userId ?? claims.id ?? claims.adminId ?? claims.sub, 150);
  const tokenRole = clean(claims.role, 80).toLowerCase();
  const adminRole = clean(claims.adminRole, 100).toLowerCase();
  const userType = clean(claims.userType, 50).toLowerCase();
  const sessionType = clean(claims.sessionType, 80).toLowerCase();
  const isAdminToken =
    tokenRole === "admin" ||
    userType === "admin" ||
    sessionType === "admin" ||
    sessionType === "student-admin";

  if (!id || !isAdminToken) {
    throw new RouteError("Administrator access is required.", 403, "ADMIN_REQUIRED");
  }

  const effectiveRole = adminRole || (tokenRole !== "admin" ? tokenRole : "");
  const allowedRoles = new Set(["student operations admin", "super admin", "admin"]);

  if (!allowedRoles.has(effectiveRole)) {
    throw new RouteError("Only Student Operations Admin or Super Admin can manage projects.", 403, "PROJECT_ROLE_FORBIDDEN");
  }

  return {
    id,
    role: effectiveRole,
    email: clean(claims.email, 254).toLowerCase(),
  };
}

function trustedOrigin(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return false;
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RouteError("Content-Type must be application/json.", 415, "INVALID_CONTENT_TYPE");
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new RouteError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new RouteError("Request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RouteError("Request body must contain valid JSON.", 400, "INVALID_JSON");
  }

  if (!isPlainObject(parsed)) {
    throw new RouteError("A JSON object is required.", 400, "INVALID_BODY");
  }

  return parsed;
}

function getErrorResponse(error: unknown, operation: string) {
  if (error instanceof RouteError) {
    return json({ success: false, message: error.message, code: error.code }, error.status);
  }

  const value = error as { name?: unknown; code?: unknown; codeName?: unknown } | null;
  const code = typeof value?.code === "string" || typeof value?.code === "number" ? String(value.code) : "";

  console.error(`[STUDENT ADMIN PROJECTS ${operation}]`, {
    name: typeof value?.name === "string" ? value.name : "Error",
    ...(code ? { code } : {}),
    ...(typeof value?.codeName === "string" ? { codeName: value.codeName } : {}),
  });

  if (code === "11000") {
    return json({ success: false, message: "This project is already assigned to the selected student or a duplicate project exists.", code: "PROJECT_DUPLICATE" }, 409);
  }

  return json({ success: false, message: "Unable to process project request.", code: `PROJECT_${operation.toUpperCase()}_FAILED` }, 500);
}

function serializeProject(project: ProjectRecord) {
  return {
    id: String(project._id),
    title: project.title,
    projectType: project.projectType,
    domain: project.domain,
    description: project.description,
    instructions: project.instructions,
    requirements: project.requirements || [],
    archiveFileName: project.archiveFileName,
    archiveSize: project.archiveSize,
    archiveAvailable: Boolean(project.archiveObjectKey),
    status: project.status,
    createdBy: project.createdBy,
    createdAt: project.createdAt?.toISOString() || null,
    updatedAt: project.updatedAt?.toISOString() || null,
    publishedAt: project.publishedAt?.toISOString() || null,
    archivedAt: project.archivedAt?.toISOString() || null,
  };
}

function serializeAssignment(item: AssignmentRecord) {
  return {
    id: String(item._id),
    projectId: String(item.projectId),
    mainStudentId: item.mainStudentId,
    studentOperationsId: String(item.studentOperationsId),
    studentName: item.studentName,
    studentEmail: item.studentEmail,
    studentId: item.studentId,
    dashboardStudentId: item.dashboardStudentId,
    internshipTrack: item.internshipTrack,
    projectTitle: item.projectTitle,
    projectType: item.projectType,
    dueAt: item.dueAt?.toISOString() || null,
    status: item.status,
    progressPercent: item.progressPercent,
    studentNote: item.studentNote,
    submissionFileName: item.submissionFileName,
    submissionAvailable: Boolean(item.submissionObjectKey),
    submissionNote: item.submissionNote,
    submittedAt: item.submittedAt?.toISOString() || null,
    reviewFeedback: item.reviewFeedback,
    reviewedBy: item.reviewedBy,
    reviewedAt: item.reviewedAt?.toISOString() || null,
    createdAt: item.createdAt?.toISOString() || null,
    updatedAt: item.updatedAt?.toISOString() || null,
  };
}

async function getModels() {
  const connection = await connectStudentDB();
  if (connection.readyState !== 1 || !connection.db) {
    throw new Error("Student Operations database connection is not ready.");
  }

  const projectSchema = new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true, maxlength: MAX_TITLE_LENGTH },
      projectType: { type: String, enum: PROJECT_TYPES, required: true },
      domain: { type: String, required: true, trim: true, maxlength: 100 },
      description: { type: String, trim: true, maxlength: MAX_DESCRIPTION_LENGTH, default: "" },
      instructions: { type: String, trim: true, maxlength: MAX_INSTRUCTIONS_LENGTH, default: "" },
      requirements: { type: [String], default: [] },
      archiveFileName: { type: String, trim: true, maxlength: 180, default: "" },
      archiveSize: { type: Number, min: 0, max: 104857600, default: 0 },
      archiveObjectKey: { type: String, trim: true, maxlength: 500, default: "" },
      archiveContentType: { type: String, trim: true, maxlength: 100, default: "application/zip" },
      status: { type: String, enum: PROJECT_STATUSES, default: "draft", index: true },
      createdBy: { type: String, required: true, maxlength: 150 },
      createdByEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
      publishedAt: { type: Date, default: null },
      archivedAt: { type: Date, default: null },
    },
    { timestamps: true, strict: "throw", versionKey: false, collection: "project_templates", autoIndex: process.env.NODE_ENV !== "production" },
  );

  projectSchema.index({ status: 1, projectType: 1, domain: 1, createdAt: -1 });
  projectSchema.index({ title: "text", domain: "text", description: "text" });

  const assignmentSchema = new mongoose.Schema(
    {
      projectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      mainStudentId: { type: String, required: true, trim: true, maxlength: 150 },
      studentOperationsId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      studentName: { type: String, required: true, trim: true, maxlength: 150 },
      studentEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
      studentId: { type: String, trim: true, uppercase: true, maxlength: 100, default: "" },
      dashboardStudentId: { type: String, trim: true, uppercase: true, maxlength: 100, default: "" },
      internshipTrack: { type: String, trim: true, maxlength: 200, default: "" },
      projectTitle: { type: String, required: true, trim: true, maxlength: MAX_TITLE_LENGTH },
      projectType: { type: String, enum: PROJECT_TYPES, required: true },
      assignedBy: { type: String, required: true, maxlength: 150 },
      assignedByEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
      dueAt: { type: Date, default: null },
      status: { type: String, enum: ASSIGNMENT_STATUSES, default: "Not Started", index: true },
      progressPercent: { type: Number, min: 0, max: 100, default: 0 },
      studentNote: { type: String, trim: true, maxlength: 1500, default: "" },
      submissionFileName: { type: String, trim: true, maxlength: 180, default: "" },
      submissionObjectKey: { type: String, trim: true, maxlength: 500, default: "" },
      submissionNote: { type: String, trim: true, maxlength: 2000, default: "" },
      submittedAt: { type: Date, default: null },
      reviewFeedback: { type: String, trim: true, maxlength: MAX_FEEDBACK_LENGTH, default: "" },
      reviewedBy: { type: String, trim: true, maxlength: 150, default: "" },
      reviewedAt: { type: Date, default: null },
    },
    { timestamps: true, strict: "throw", versionKey: false, collection: "project_assignments", autoIndex: process.env.NODE_ENV !== "production" },
  );

  assignmentSchema.index({ projectId: 1, mainStudentId: 1 }, { unique: true, name: "unique_project_student_assignment" });
  assignmentSchema.index({ status: 1, updatedAt: -1 });
  assignmentSchema.index({ mainStudentId: 1, status: 1, createdAt: -1 });

  const Project: Model<any, any, any, any, any, any, any> = (connection.models.ProjectTemplate as Model<any, any, any, any, any, any, any> | undefined) ||
    connection.model<any>("ProjectTemplate", projectSchema, "project_templates");
  const Assignment: Model<any, any, any, any, any, any, any> = (connection.models.ProjectAssignment as Model<any, any, any, any, any, any, any> | undefined) ||
    connection.model<any>("ProjectAssignment", assignmentSchema, "project_assignments");
  const Operations = connection.models.StudentOperations as Model<any> | undefined;
  if (!Operations) {
    const { getStudentOperationsModel } = await import("@/models/StudentOperations");
    return { Project, Assignment, Operations: await getStudentOperationsModel() };
  }
  return { Project, Assignment, Operations };
}

function parsePagination(url: URL) {
  const pageValue = Number(url.searchParams.get("page") || 1);
  const limitValue = Number(url.searchParams.get("limit") || 20);
  const page = Number.isInteger(pageValue) ? Math.min(Math.max(pageValue, 1), MAX_PAGE) : 1;
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), MAX_LIMIT) : 20;
  return { page, limit, skip: (page - 1) * limit };
}

export async function GET(request: NextRequest) {
  try {
    await authenticate(request);
    const url = new URL(request.url);
    const view = clean(url.searchParams.get("view") || "overview", 30).toLowerCase();
    const search = clean(url.searchParams.get("search"), MAX_SEARCH_LENGTH);
    const type = clean(url.searchParams.get("type"), 20);
    const status = clean(url.searchParams.get("status"), 40);
    const { page, limit, skip } = parsePagination(url);
    const { Project, Assignment } = await getModels();
    const regex = search ? new RegExp(escapeRegex(search), "i") : null;

    if (view === "library" || view === "projects") {
      const filter: Record<string, unknown> = {};
      if (type && PROJECT_TYPES.includes(type as ProjectType)) filter.projectType = type;
      if (status && PROJECT_STATUSES.includes(status as ProjectStatus)) filter.status = status;
      if (regex) filter.$or = [{ title: regex }, { domain: regex }, { description: regex }];
      const [records, total, counts] = await Promise.all([
        Project.find(filter as any).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean().exec(),
        Project.countDocuments(filter).exec(),
        Project.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]).exec(),
      ]);
      const stats = { total: counts.reduce((sum: number, item: any) => sum + item.count, 0), draft: 0, published: 0, archived: 0 };
      for (const item of counts) if (item._id in stats) (stats as any)[item._id] = item.count;
      const projects = records.map((item: any) => serializeProject(item as ProjectRecord));
      return json({
        success: true,
        message: "Project library loaded.",
        data: { projects, records: projects, stats, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 } },
      });
    }

    if (view === "assignments" || view === "submissions") {
      const filter: Record<string, unknown> = {};
      if (status && ASSIGNMENT_STATUSES.includes(status as AssignmentStatus)) filter.status = status;
      if (regex) filter.$or = [{ studentName: regex }, { studentEmail: regex }, { studentId: regex }, { dashboardStudentId: regex }, { projectTitle: regex }, { internshipTrack: regex }];
      if (view === "submissions" && !status) filter.status = { $in: ["Submitted", "Under Review", "Revision Required"] };
      const [records, total, counts] = await Promise.all([
        Assignment.find(filter as any).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean().exec(),
        Assignment.countDocuments(filter).exec(),
        Assignment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).exec(),
      ]);
      const assignments = records.map((item: any) => serializeAssignment(item as AssignmentRecord));
      const stats: Record<string, number> = { total: 0, pendingReview: 0, approved: 0, inProgress: 0 };
      for (const item of counts) {
        stats.total += item.count;
        if (item._id === "Submitted" || item._id === "Under Review") stats.pendingReview += item.count;
        if (item._id === "Approved") stats.approved += item.count;
        if (item._id === "In Progress") stats.inProgress += item.count;
      }
      return json({
        success: true,
        message: view === "submissions" ? "Project submissions loaded." : "Project assignments loaded.",
        data: { assignments, submissions: assignments, stats, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 } },
      });
    }

    const [projectCount, publishedCount, assignmentCount, reviewCount, approvedCount] = await Promise.all([
      Project.countDocuments({}).exec(),
      Project.countDocuments({ status: "published" }).exec(),
      Assignment.countDocuments({}).exec(),
      Assignment.countDocuments({ status: { $in: ["Submitted", "Under Review"] } }).exec(),
      Assignment.countDocuments({ status: "Approved" }).exec(),
    ]);

    return json({
      success: true,
      message: "Project management overview loaded.",
      data: {
        stats: { totalProjects: projectCount, publishedProjects: publishedCount, assignments: assignmentCount, pendingReviews: reviewCount, approvedProjects: approvedCount },
        storage: { configured: false, provider: null, message: "Configure Cloudflare R2 or another private object storage provider before enabling project archive uploads and downloads." },
        pagination: { page, limit },
      },
    });
  } catch (error) {
    return getErrorResponse(error, "list");
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    if (!trustedOrigin(request)) throw new RouteError("Cross-origin requests are not allowed.", 403, "INVALID_ORIGIN");
    const body = await readJson(request);
    const action = clean(body.action, 40).toLowerCase();
    const { Project, Assignment, Operations } = await getModels();

    if (action === "create-project") {
      const input = recordOf(body.project) || body;
      const title = clean(input.title, MAX_TITLE_LENGTH);
      const projectType = clean(input.projectType ?? input.type, 20);
      const domain = clean(input.domain ?? input.track, 100);
      const description = clean(input.description, MAX_DESCRIPTION_LENGTH);
      const instructions = clean(input.instructions, MAX_INSTRUCTIONS_LENGTH);
      const archiveFileName = clean(input.archiveFileName ?? input.fileName, 180);
      const archiveSize = Number(input.archiveSize ?? input.fileSize ?? 0);
      const requirements = Array.isArray(input.requirements)
        ? input.requirements.slice(0, 30).map((item: unknown) => clean(item, 300)).filter(Boolean)
        : [];

      if (title.length < 3) throw new RouteError("Project title must contain at least 3 characters.", 400, "INVALID_PROJECT_TITLE");
      if (!PROJECT_TYPES.includes(projectType as ProjectType)) throw new RouteError("Project type must be Major or Minor.", 400, "INVALID_PROJECT_TYPE");
      if (domain.length < 2) throw new RouteError("A valid internship domain is required.", 400, "INVALID_PROJECT_DOMAIN");
      if (archiveFileName && !archiveFileName.toLowerCase().endsWith(".zip")) throw new RouteError("Only ZIP project archives are supported.", 400, "INVALID_ARCHIVE_TYPE");
      if (!Number.isFinite(archiveSize) || archiveSize < 0 || archiveSize > 104857600) throw new RouteError("Project ZIP must be 100 MB or smaller.", 400, "INVALID_ARCHIVE_SIZE");

      const project = await Project.create({
        title,
        projectType,
        domain,
        description,
        instructions,
        requirements,
        archiveFileName,
        archiveSize,
        archiveObjectKey: "",
        archiveContentType: "application/zip",
        status: "draft",
        createdBy: actor.id,
        createdByEmail: actor.email,
      });

      return json({
        success: true,
        message: "Project draft created. Attach the archive through the configured private storage upload flow before publishing.",
        data: { project: serializeProject(project.toObject() as ProjectRecord), uploadRequired: true, storageConfigured: false },
      }, 201);
    }

    if (action === "assign-project") {
      const projectId = clean(body.projectId, 80);
      const studentRecordId = clean(body.studentOperationsId ?? body.studentRecordId, 80);
      const dueAtValue = clean(body.dueAt, 40);
      if (!isObjectId(projectId) || !isObjectId(studentRecordId)) throw new RouteError("Valid project and Student Operations record IDs are required.", 400, "INVALID_ASSIGNMENT_IDS");

      const [project, student] = await Promise.all([
        Project.findById(projectId).lean().exec(),
        (Operations as Model<any>).findById(studentRecordId).lean().exec(),
      ]);
      if (!project || project.status !== "published" || !project.archiveObjectKey) throw new RouteError("Only published projects with an uploaded ZIP archive can be assigned.", 409, "PROJECT_NOT_ASSIGNABLE");
      if (!student) throw new RouteError("Student Operations record was not found.", 404, "STUDENT_NOT_FOUND");
      if (student.isActive === false || clean(student.operationsApprovalStatus, 40).toLowerCase() !== "approved" || clean(student.operationsStatus, 40).toLowerCase() !== "active") {
        throw new RouteError("Only active and approved Student Operations students can receive projects.", 409, "STUDENT_NOT_ELIGIBLE");
      }
      const mainStudentId = clean(student.mainStudentId, 150);
      if (!mainStudentId) throw new RouteError("Student record is missing its linked main student ID.", 409, "STUDENT_LINK_MISSING");
      const dueAt = dueAtValue ? new Date(dueAtValue) : null;
      if (dueAtValue && (!dueAt || Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now())) {
        throw new RouteError("Due date must be a valid future date.", 400, "INVALID_DUE_DATE");
      }

      const assignment = await Assignment.create({
        projectId: project._id,
        mainStudentId,
        studentOperationsId: student._id,
        studentName: clean(student.fullName, 150),
        studentEmail: clean(student.email, 254).toLowerCase(),
        studentId: clean(student.studentId, 100),
        dashboardStudentId: clean(student.dashboardStudentId, 100),
        internshipTrack: clean(student.internshipTrack, 200),
        projectTitle: clean(project.title, MAX_TITLE_LENGTH),
        projectType: project.projectType,
        assignedBy: actor.id,
        assignedByEmail: actor.email,
        dueAt,
        status: "Not Started",
        progressPercent: 0,
      });

      return json({ success: true, message: "Project assigned successfully.", data: { assignment: serializeAssignment(assignment.toObject() as AssignmentRecord) } }, 201);
    }

    throw new RouteError("Unsupported project action.", 400, "INVALID_PROJECT_ACTION");
  } catch (error) {
    return getErrorResponse(error, "create");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    if (!trustedOrigin(request)) throw new RouteError("Cross-origin requests are not allowed.", 403, "INVALID_ORIGIN");
    const body = await readJson(request);
    const action = clean(body.action, 40).toLowerCase();
    const { Project, Assignment } = await getModels();

    if (action === "update-project") {
      const projectId = clean(body.projectId ?? body.id, 80);
      if (!isObjectId(projectId)) throw new RouteError("A valid project ID is required.", 400, "INVALID_PROJECT_ID");
      const updates: Record<string, unknown> = {};
      if (body.title !== undefined) {
        const value = clean(body.title, MAX_TITLE_LENGTH);
        if (value.length < 3) throw new RouteError("Project title must contain at least 3 characters.", 400, "INVALID_PROJECT_TITLE");
        updates.title = value;
      }
      if (body.projectType !== undefined) {
        const value = clean(body.projectType, 20);
        if (!PROJECT_TYPES.includes(value as ProjectType)) throw new RouteError("Project type must be Major or Minor.", 400, "INVALID_PROJECT_TYPE");
        updates.projectType = value;
      }
      if (body.domain !== undefined) {
        const value = clean(body.domain, 100);
        if (value.length < 2) throw new RouteError("A valid domain is required.", 400, "INVALID_PROJECT_DOMAIN");
        updates.domain = value;
      }
      if (body.description !== undefined) updates.description = clean(body.description, MAX_DESCRIPTION_LENGTH);
      if (body.instructions !== undefined) updates.instructions = clean(body.instructions, MAX_INSTRUCTIONS_LENGTH);
      if (body.requirements !== undefined) {
        if (!Array.isArray(body.requirements)) throw new RouteError("Requirements must be an array.", 400, "INVALID_REQUIREMENTS");
        updates.requirements = body.requirements.slice(0, 30).map((item: unknown) => clean(item, 300)).filter(Boolean);
      }
      if (!Object.keys(updates).length) throw new RouteError("No valid project fields were provided.", 400, "EMPTY_UPDATE");
      const project = await Project.findOneAndUpdate({ _id: projectId, status: { $ne: "archived" } }, { $set: updates }, { new: true, runValidators: true }).lean().exec();
      if (!project) throw new RouteError("Project was not found or is archived.", 404, "PROJECT_NOT_FOUND");
      return json({ success: true, message: "Project details updated.", data: { project: serializeProject(project as ProjectRecord) } });
    }

    if (action === "publish-project") {
      const projectId = clean(body.projectId ?? body.id, 80);
      if (!isObjectId(projectId)) throw new RouteError("A valid project ID is required.", 400, "INVALID_PROJECT_ID");
      const project = await Project.findById(projectId).lean().exec();
      if (!project) throw new RouteError("Project was not found.", 404, "PROJECT_NOT_FOUND");
      if (!clean(project.archiveObjectKey, 500) || !clean(project.archiveFileName, 180) || Number(project.archiveSize) <= 0) {
        throw new RouteError("Upload and verify the project ZIP in private cloud storage before publishing.", 409, "PROJECT_ARCHIVE_REQUIRED");
      }
      const updated = await Project.findOneAndUpdate({ _id: projectId, status: "draft" }, { $set: { status: "published", publishedAt: new Date() } }, { new: true, runValidators: true }).lean().exec();
      if (!updated) throw new RouteError("Only draft projects can be published.", 409, "PROJECT_NOT_DRAFT");
      return json({ success: true, message: "Project published and ready for assignment.", data: { project: serializeProject(updated as ProjectRecord) } });
    }

    if (action === "archive-project") {
      const projectId = clean(body.projectId ?? body.id, 80);
      if (!isObjectId(projectId)) throw new RouteError("A valid project ID is required.", 400, "INVALID_PROJECT_ID");
      const updated = await Project.findByIdAndUpdate(projectId, { $set: { status: "archived", archivedAt: new Date() } }, { new: true, runValidators: true }).lean().exec();
      if (!updated) throw new RouteError("Project was not found.", 404, "PROJECT_NOT_FOUND");
      return json({ success: true, message: "Project archived. Existing student assignment history is preserved.", data: { project: serializeProject(updated as ProjectRecord) } });
    }

    if (action === "review-submission") {
      const assignmentId = clean(body.assignmentId ?? body.id, 80);
      const decision = clean(body.decision, 30).toLowerCase();
      const feedback = clean(body.feedback, MAX_FEEDBACK_LENGTH);
      if (!isObjectId(assignmentId)) throw new RouteError("A valid assignment ID is required.", 400, "INVALID_ASSIGNMENT_ID");
      if (!["approve", "revision"].includes(decision)) throw new RouteError("Decision must be approve or revision.", 400, "INVALID_REVIEW_DECISION");
      if (decision === "revision" && feedback.length < 10) throw new RouteError("Provide at least 10 characters of revision feedback.", 400, "REVIEW_FEEDBACK_REQUIRED");

      const current = await Assignment.findById(assignmentId).lean().exec();
      if (!current) throw new RouteError("Project assignment was not found.", 404, "ASSIGNMENT_NOT_FOUND");
      if (!current.submissionObjectKey || !current.submissionFileName || !current.submittedAt) {
        throw new RouteError("This assignment has no complete student submission to review.", 409, "SUBMISSION_MISSING");
      }
      if (!["Submitted", "Under Review", "Revision Required"].includes(current.status)) {
        throw new RouteError("This project submission is not in a reviewable state.", 409, "SUBMISSION_NOT_REVIEWABLE");
      }

      const updated = await Assignment.findOneAndUpdate(
        { _id: assignmentId, status: current.status, submittedAt: current.submittedAt } as any,
        {
          $set: {
            status: decision === "approve" ? "Approved" : "Revision Required",
            reviewFeedback: feedback,
            reviewedBy: actor.id,
            reviewedAt: new Date(),
          },
        },
        { new: true, runValidators: true },
      ).lean().exec();

      if (!updated) throw new RouteError("Submission changed while it was being reviewed. Refresh and try again.", 409, "SUBMISSION_REVIEW_CONFLICT");
      return json({ success: true, message: decision === "approve" ? "Project submission approved." : "Revision requested. Student can update and resubmit.", data: { assignment: serializeAssignment(updated as AssignmentRecord) } });
    }

    throw new RouteError("Unsupported project update action.", 400, "INVALID_PROJECT_ACTION");
  } catch (error) {
    return getErrorResponse(error, "update");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await authenticate(request);
    if (!trustedOrigin(request)) throw new RouteError("Cross-origin requests are not allowed.", 403, "INVALID_ORIGIN");
    const url = new URL(request.url);
    const projectId = clean(url.searchParams.get("projectId") || url.searchParams.get("id"), 80);
    if (!isObjectId(projectId)) throw new RouteError("A valid project ID is required.", 400, "INVALID_PROJECT_ID");
    const { Project } = await getModels();
    const project = await Project.findByIdAndUpdate(
      projectId,
      { $set: { status: "archived", archivedAt: new Date() } },
      { new: true, runValidators: true, upsert: false },
    ).lean().exec();
    if (!project) throw new RouteError("Project was not found.", 404, "PROJECT_NOT_FOUND");
    return json({ success: true, message: "Project archived. Records and assignments have been retained.", data: { project: serializeProject(project as ProjectRecord) } });
  } catch (error) {
    return getErrorResponse(error, "archive");
  }
}
