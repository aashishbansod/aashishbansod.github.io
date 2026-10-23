import { NextResponse } from "next/server";

import mongoose, {

  type Model,

  type Document,

  Schema,

} from "mongoose";

import { connectDB } from "@/lib/db";

import {

  AUTH_COOKIE_NAME,

  verifyAccessToken,

  verifyAuthToken,

} from "@/lib/auth";

import AdminModel from "@/models/Admin";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const revalidate = 0;

type CertificateStatus = "issued" | "pending" | "revoked" | "expired";

interface ICertificate extends Document {

  certificateId: string;

  studentName: string;

  studentId: string;

  email: string;

  internship: string;

  course?: string;

  issueDate?: Date;

  expiryDate?: Date;

  status: CertificateStatus;

  verificationUrl?: string;

  createdAt: Date;

  updatedAt: Date;

}

const certificateSchema = new Schema<ICertificate>(

  {

    certificateId: {

      type: String,

      required: true,

      unique: true,

      trim: true,

      uppercase: true,

      minlength: 4,

      maxlength: 100,

    },

    studentName: {

      type: String,

      required: true,

      trim: true,

      maxlength: 150,

    },

    studentId: {

      type: String,

      required: true,

      trim: true,

      maxlength: 100,

    },

    email: {

      type: String,

      required: true,

      trim: true,

      lowercase: true,

      maxlength: 254,

    },

    internship: {

      type: String,

      required: true,

      trim: true,

      maxlength: 150,

    },

    course: {

      type: String,

      trim: true,

      maxlength: 150,

    },

    issueDate: {

      type: Date,

    },

    expiryDate: {

      type: Date,

    },

    status: {

      type: String,

      enum: ["issued", "pending", "revoked", "expired"],

      default: "issued",

    },

    verificationUrl: {

      type: String,

      trim: true,

      maxlength: 1000,

    },

  },

  {

    timestamps: true,

    versionKey: false,

    collection: "certificates",

  },

);

certificateSchema.index({ certificateId: 1 }, { unique: true });

certificateSchema.index({ studentId: 1, createdAt: -1 });

certificateSchema.index({ email: 1, createdAt: -1 });

certificateSchema.index({ status: 1, createdAt: -1 });

certificateSchema.index({ createdAt: -1 });

const Certificate: Model<ICertificate> =

  mongoose.models.Certificate ||

  mongoose.model<ICertificate>("Certificate", certificateSchema);

type AdminAuth = {

  userId: string;

  role: string;

  email?: string;

};

function json(data: unknown, status = 200) {

  return NextResponse.json(data, {

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

function optionalString(value: unknown): string | undefined {

  const result = cleanString(value);

  return result || undefined;

}

function parseDate(value: unknown): Date | undefined {

  if (value === undefined || value === null || value === "") return undefined;

  const date = value instanceof Date ? value : new Date(String(value));

  return Number.isNaN(date.getTime()) ? undefined : date;

}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidObjectId(value: string) {

  return mongoose.Types.ObjectId.isValid(value);

}

function isValidStatus(value: unknown): value is CertificateStatus {

  return (

    value === "issued" ||

    value === "pending" ||

    value === "revoked" ||

    value === "expired"

  );

}

function serializeCertificate(certificate: ICertificate) {

  return {

    id: certificate._id.toString(),

    certificateId: certificate.certificateId,

    studentName: certificate.studentName,

    studentId: certificate.studentId,

    email: certificate.email,

    internship: certificate.internship,

    course: certificate.course,

    issueDate: certificate.issueDate?.toISOString(),

    expiryDate: certificate.expiryDate?.toISOString(),

    status: certificate.status,

    verificationUrl: certificate.verificationUrl,

    createdAt: certificate.createdAt?.toISOString(),

    updatedAt: certificate.updatedAt?.toISOString(),

  };

}

function errorMessage(error: unknown) {

  return error instanceof Error ? error.message : "Unknown error";

}

/**
 * Admin authentication.
 *
 * Uses the project's existing auth helpers and Admin model.
 * No database credentials are hardcoded in this route.
 */

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function requireAdmin(request: Request): Promise<AdminAuth> {

  const cookieHeader = request.headers.get("cookie") || "";

  const cookieToken = cookieHeader

    .split(";")

    .map((part) => part.trim())

    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))

    ?.split("=")

    .slice(1)

    .join("=");

  const authorization = request.headers.get("authorization") || "";

  const bearerToken = authorization.toLowerCase().startsWith("bearer ")

    ? authorization.slice(7).trim()

    : "";

  const token = cookieToken || bearerToken;

  if (!token) {

    throw new AuthError("Authentication required.", 401, "AUTH_REQUIRED");

  }

  let payload: Record<string, unknown> | null = null;

  try {
    const accessPayload = await verifyAccessToken(token);
    payload = toRecord(accessPayload);

    if (!payload) {
      const legacyPayload = await verifyAuthToken(token);
      payload = toRecord(legacyPayload);
    }
  } catch {
    try {
      const legacyPayload = await verifyAuthToken(token);
      payload = toRecord(legacyPayload);
    } catch {
      payload = null;
    }
  }

  if (!payload) {

    throw new AuthError("Invalid or expired authentication token.", 401, "AUTH_INVALID");

  }

  const role = cleanString(payload.role).toLowerCase();

  const userId = cleanString(

    payload.userId ?? payload.id ?? payload.adminId ?? payload.sub,

  );

  const email = cleanString(payload.email).toLowerCase();

  if (role !== "admin" || !userId) {

    throw new AuthError("Admin access is required.", 403, "ADMIN_REQUIRED");

  }

  await connectDB();

  const lookup: Record<string, unknown>[] = [];

  if (isValidObjectId(userId)) {

    lookup.push({ _id: userId });

  }

  lookup.push({ adminId: userId });

  if (email) {

    lookup.push({ email });

  }

  const admin = await AdminModel.findOne({ $or: lookup })

    .select("_id adminId email role isActive active")

    .lean();

  if (!admin) {

    throw new AuthError("Active admin account was not found.", 403, "ADMIN_NOT_FOUND");

  }

  const active =

    (admin as { isActive?: boolean }).isActive !== false &&

    (admin as { active?: boolean }).active !== false;

  if (!active) {

    throw new AuthError("Admin account is inactive.", 403, "ADMIN_INACTIVE");

  }

  return {

    userId: String(

      (admin as { adminId?: unknown }).adminId ??

        (admin as { _id: unknown })._id,

    ),

    role: String((admin as { role?: unknown }).role ?? payload.role),

    email:

      typeof (admin as { email?: unknown }).email === "string"

        ? String((admin as { email?: unknown }).email)

        : email || undefined,

  };

}

class AuthError extends Error {

  status: number;

  code: string;

  constructor(message: string, status: number, code: string) {

    super(message);

    this.name = "AuthError";

    this.status = status;

    this.code = code;

  }

}

function handleError(error: unknown, operation: string) {

  if (error instanceof AuthError) {

    return json(

      {

        success: false,

        message: error.message,

        code: error.code,

      },

      error.status,

    );

  }

  console.error(`[ADMIN CERTIFICATES ${operation}]`, error);

  if (

    typeof error === "object" &&

    error !== null &&

    "code" in error &&

    (error as { code?: unknown }).code === 11000

  ) {

    return json(

      {

        success: false,

        message: "Certificate ID already exists.",

        code: "DUPLICATE_CERTIFICATE_ID",

      },

      409,

    );

  }

  return json(

    {

      success: false,

      message: `Failed to ${operation.toLowerCase()} certificate records.`,

      code: `CERTIFICATES_${operation.toUpperCase()}_FAILED`,

      ...(process.env.NODE_ENV === "development"

        ? { detail: errorMessage(error) }

        : {}),

    },

    500,

  );

}

function buildSearchFilter(search: string) {
  if (!search) return {};

  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  return {
    $or: [
      { certificateId: regex },
      { studentName: regex },
      { studentId: regex },
      { email: regex },
      { internship: regex },
      { course: regex },
    ],
  };
}

function parsePagination(request: Request) {

  const { searchParams } = new URL(request.url);

  const rawPage = Number(searchParams.get("page") || "1");

  const rawLimit = Number(searchParams.get("limit") || "50");

  const page =

    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const limit =

    Number.isFinite(rawLimit) && rawLimit > 0

      ? Math.min(Math.floor(rawLimit), 100)

      : 50;

  return { page, limit };

}

export async function GET(request: Request) {

  try {

    await requireAdmin(request);

    const { searchParams } = new URL(request.url);

    const search = cleanString(searchParams.get("search"));

    const status = cleanString(searchParams.get("status")).toLowerCase();

    const { page, limit } = parsePagination(request);

    const filter: Record<string, unknown> = {

      ...buildSearchFilter(search),

    };

    if (status && status !== "all") {

      if (!isValidStatus(status)) {

        return json(

          {

            success: false,

            message: "Invalid certificate status filter.",

            code: "INVALID_STATUS_FILTER",

          },

          400,

        );

      }

      filter.status = status;

    }

    const skip = (page - 1) * limit;

    const [

      documents,

      total,

      allTotal,

      issued,

      pending,

      revoked,

      expired,

    ] = await Promise.all([

      Certificate.find(filter)

        .sort({ createdAt: -1, _id: -1 })

        .skip(skip)

        .limit(limit)

        .lean(),

      Certificate.countDocuments(filter),

      Certificate.countDocuments({}),

      Certificate.countDocuments({ status: "issued" }),

      Certificate.countDocuments({ status: "pending" }),

      Certificate.countDocuments({ status: "revoked" }),

      Certificate.countDocuments({ status: "expired" }),

    ]);

    const data = documents.map((certificate) => ({

      id: String(certificate._id),

      certificateId: certificate.certificateId,

      studentName: certificate.studentName,

      studentId: certificate.studentId,

      email: certificate.email,

      internship: certificate.internship,

      course: certificate.course,

      issueDate: certificate.issueDate?.toISOString(),

      expiryDate: certificate.expiryDate?.toISOString(),

      status: certificate.status,

      verificationUrl: certificate.verificationUrl,

      createdAt: certificate.createdAt?.toISOString(),

      updatedAt: certificate.updatedAt?.toISOString(),

    }));

    return json({

      success: true,

      message: "Certificates loaded successfully.",

      data,

      total,

      page,

      limit,

      pages: Math.ceil(total / limit),

      pagination: {

        page,

        limit,

        total,

        totalPages: Math.ceil(total / limit),

        hasNextPage: page * limit < total,

        hasPreviousPage: page > 1,

      },

      stats: {

        total: allTotal,

        issued,

        pending,

        revoked,

        expired,

      },

      meta: {

        generatedAt: new Date().toISOString(),

        authenticated: true,

      },

    });

  } catch (error) {

    return handleError(error, "load");

  }

}

export async function POST(request: Request) {

  try {

    const admin = await requireAdmin(request);

    let body: Record<string, unknown>;

    try {

      body = (await request.json()) as Record<string, unknown>;

    } catch {

      return json(

        {

          success: false,

          message: "Invalid JSON request body.",

          code: "INVALID_REQUEST_BODY",

        },

        400,

      );

    }

    const certificateId = cleanString(body.certificateId).toUpperCase();

    const studentName = cleanString(body.studentName);

    const studentId = cleanString(body.studentId);

    const email = cleanString(body.email).toLowerCase();

    const internship = cleanString(body.internship);

    const course = optionalString(body.course);

    const issueDateProvided = body.issueDate !== undefined;

    const expiryDateProvided = body.expiryDate !== undefined;

    const issueDate = parseDate(body.issueDate);

    const expiryDate = parseDate(body.expiryDate);

    const verificationUrl = optionalString(body.verificationUrl);

    const requestedStatus = cleanString(body.status).toLowerCase();

    const status: CertificateStatus =

      requestedStatus && isValidStatus(requestedStatus)

        ? requestedStatus

        : "issued";

    if (

      !certificateId ||

      !studentName ||

      !studentId ||

      !email ||

      !internship

    ) {

      return json(

        {

          success: false,

          message:

            "certificateId, studentName, studentId, email and internship are required.",

          code: "VALIDATION_ERROR",

        },

        400,

      );

    }

    if (!isValidEmail(email)) {

      return json(

        {

          success: false,

          message: "Please provide a valid email address.",

          code: "INVALID_EMAIL",

        },

        400,

      );

    }

    if (issueDateProvided && !issueDate) {

      return json(

        {

          success: false,

          message: "Invalid issueDate.",

          code: "INVALID_ISSUE_DATE",

        },

        400,

      );

    }

    if (expiryDateProvided && body.expiryDate !== "" && !expiryDate) {

      return json(

        {

          success: false,

          message: "Invalid expiryDate.",

          code: "INVALID_EXPIRY_DATE",

        },

        400,

      );

    }

    if (issueDate && expiryDate && expiryDate <= issueDate) {

      return json(

        {

          success: false,

          message: "Expiry date must be after issue date.",

          code: "INVALID_DATE_RANGE",

        },

        400,

      );

    }

    if (body.status !== undefined && !isValidStatus(requestedStatus)) {

      return json(

        {

          success: false,

          message: "Invalid certificate status.",

          code: "INVALID_STATUS",

        },

        400,

      );

    }

    const existing = await Certificate.exists({ certificateId });

    if (existing) {

      return json(

        {

          success: false,

          message: "A certificate with this certificate ID already exists.",

          code: "CERTIFICATE_ALREADY_EXISTS",

        },

        409,

      );

    }

    const certificate = await Certificate.create({

      certificateId,

      studentName,

      studentId,

      email,

      internship,

      course,

      issueDate: issueDate ?? (status === "issued" ? new Date() : undefined),

      expiryDate,

      status,

      verificationUrl,

    });

    return json(

      {

        success: true,

        message: "Certificate created successfully.",

        data: serializeCertificate(certificate),

        meta: {

          createdBy: admin.userId,

          generatedAt: new Date().toISOString(),

        },

      },

      201,

    );

  } catch (error) {

    return handleError(error, "create");

  }

}

export async function PUT(request: Request) {

  try {

    const admin = await requireAdmin(request);

    let body: Record<string, unknown>;

    try {

      body = (await request.json()) as Record<string, unknown>;

    } catch {

      return json(

        {

          success: false,

          message: "Invalid JSON request body.",

          code: "INVALID_REQUEST_BODY",

        },

        400,

      );

    }

    const id = cleanString(body.id);

    const certificateIdInput = cleanString(body.certificateId).toUpperCase();

    if (!id && !certificateIdInput) {

      return json(

        {

          success: false,

          message: "Certificate id or certificateId is required.",

          code: "IDENTIFIER_REQUIRED",

        },

        400,

      );

    }

    let existing: ICertificate | null = null;

    if (id && isValidObjectId(id)) {

      existing = await Certificate.findById(id);

    }

    if (!existing && certificateIdInput) {

      existing = await Certificate.findOne({

        certificateId: certificateIdInput,

      });

    }

    if (!existing) {

      return json(

        {

          success: false,

          message: "Certificate not found.",

          code: "CERTIFICATE_NOT_FOUND",

        },

        404,

      );

    }

    const updates: Record<string, unknown> = {};

    if (body.studentName !== undefined) {

      const value = cleanString(body.studentName);

      if (!value) {

        return json(

          {

            success: false,

            message: "studentName cannot be empty.",

            code: "VALIDATION_ERROR",

          },

          400,

        );

      }

      updates.studentName = value;

    }

    if (body.studentId !== undefined) {

      const value = cleanString(body.studentId);

      if (!value) {

        return json(

          {

            success: false,

            message: "studentId cannot be empty.",

            code: "VALIDATION_ERROR",

          },

          400,

        );

      }

      updates.studentId = value;

    }

    if (body.email !== undefined) {

      const value = cleanString(body.email).toLowerCase();

      if (!isValidEmail(value)) {

        return json(

          {

            success: false,

            message: "Please provide a valid email address.",

            code: "INVALID_EMAIL",

          },

          400,

        );

      }

      updates.email = value;

    }

    if (body.internship !== undefined) {

      const value = cleanString(body.internship);

      if (!value) {

        return json(

          {

            success: false,

            message: "internship cannot be empty.",

            code: "VALIDATION_ERROR",

          },

          400,

        );

      }

      updates.internship = value;

    }

    if (body.course !== undefined) {

      updates.course = optionalString(body.course);

    }

    if (body.status !== undefined) {

      const value = cleanString(body.status).toLowerCase();

      if (!isValidStatus(value)) {

        return json(

          {

            success: false,

            message: "Invalid certificate status.",

            code: "INVALID_STATUS",

          },

          400,

        );

      }

      updates.status = value;

    }

    if (body.issueDate !== undefined) {

      const value = parseDate(body.issueDate);

      if (!value) {

        return json(

          {

            success: false,

            message: "Invalid issueDate.",

            code: "INVALID_ISSUE_DATE",

          },

          400,

        );

      }

      updates.issueDate = value;

    }

    if (body.expiryDate !== undefined) {

      const value = parseDate(body.expiryDate);

      if (body.expiryDate !== "" && !value) {

        return json(

          {

            success: false,

            message: "Invalid expiryDate.",

            code: "INVALID_EXPIRY_DATE",

          },

          400,

        );

      }

      updates.expiryDate = value;

    }

    if (body.verificationUrl !== undefined) {

      updates.verificationUrl = optionalString(body.verificationUrl);

    }

    if (body.certificateId !== undefined) {

      const newCertificateId = cleanString(body.certificateId).toUpperCase();

      if (!newCertificateId) {

        return json(

          {

            success: false,

            message: "certificateId cannot be empty.",

            code: "VALIDATION_ERROR",

          },

          400,

        );

      }

      if (newCertificateId !== existing.certificateId) {

        const duplicate = await Certificate.exists({

          certificateId: newCertificateId,

          _id: { $ne: existing._id },

        });

        if (duplicate) {

          return json(

            {

              success: false,

              message: "Another certificate already uses this certificate ID.",

              code: "CERTIFICATE_ID_EXISTS",

            },

            409,

          );

        }

      }

      updates.certificateId = newCertificateId;

    }

    const nextIssueDate =

      (updates.issueDate as Date | undefined) ?? existing.issueDate;

    const nextExpiryDate =

      updates.expiryDate === undefined

        ? existing.expiryDate

        : (updates.expiryDate as Date | undefined);

    if (nextIssueDate && nextExpiryDate && nextExpiryDate <= nextIssueDate) {

      return json(

        {

          success: false,

          message: "Expiry date must be after issue date.",

          code: "INVALID_DATE_RANGE",

        },

        400,

      );

    }

    if (Object.keys(updates).length === 0) {

      return json({

        success: true,

        message: "No certificate changes were requested.",

        data: serializeCertificate(existing),

      });

    }

    const updated = await Certificate.findByIdAndUpdate(

      existing._id,

      {

        $set: updates,

      },

      {

        new: true,

        runValidators: true,

      },

    );

    if (!updated) {

      return json(

        {

          success: false,

          message: "Certificate could not be updated.",

          code: "UPDATE_FAILED",

        },

        500,

      );

    }

    return json({

      success: true,

      message: "Certificate updated successfully.",

      data: serializeCertificate(updated),

      meta: {

        updatedBy: admin.userId,

        generatedAt: new Date().toISOString(),

      },

    });

  } catch (error) {

    return handleError(error, "update");

  }

}

export async function PATCH(request: Request) {

  return PUT(request);

}

export async function DELETE(request: Request) {

  try {

    const admin = await requireAdmin(request);

    const role = admin.role.toLowerCase();

    if (role !== "super admin" && role !== "superadmin") {

      return json(

        {

          success: false,

          message: "Only Super Admin can permanently delete certificates.",

          code: "SUPER_ADMIN_REQUIRED",

        },

        403,

      );

    }

    const { searchParams } = new URL(request.url);

    const id = cleanString(searchParams.get("id"));

    const certificateId = cleanString(

      searchParams.get("certificateId"),

    ).toUpperCase();

    if (!id && !certificateId) {

      return json(

        {

          success: false,

          message: "id or certificateId is required.",

          code: "IDENTIFIER_REQUIRED",

        },

        400,

      );

    }

    let deleted: ICertificate | null = null;

    if (id && isValidObjectId(id)) {

      deleted = await Certificate.findByIdAndDelete(id);

    }

    if (!deleted && certificateId) {

      deleted = await Certificate.findOneAndDelete({

        certificateId,

      });

    }

    if (!deleted) {

      return json(

        {

          success: false,

          message: "Certificate not found.",

          code: "CERTIFICATE_NOT_FOUND",

        },

        404,

      );

    }

    return json({

      success: true,

      message: "Certificate deleted successfully.",

      data: {

        id: deleted._id.toString(),

        certificateId: deleted.certificateId,

      },

      meta: {

        deletedBy: admin.userId,

        generatedAt: new Date().toISOString(),

      },

    });

  } catch (error) {

    return handleError(error, "delete");

  }

}

export async function OPTIONS() {

  return new NextResponse(null, {

    status: 204,

    headers: {

      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS",

      "Cache-Control": "no-store",

    },

  });

}

export async function HEAD(request: Request) {

  try {

    await requireAdmin(request);

    await connectDB();

    return new NextResponse(null, {

      status: 204,

      headers: {

        "Cache-Control": "no-store",

      },

    });

  } catch (error) {

    if (error instanceof AuthError) {

      return new NextResponse(null, {

        status: error.status,

        headers: {

          "Cache-Control": "no-store",

        },

      });

    }

    console.error("[ADMIN CERTIFICATES HEAD]", error);

    return new NextResponse(null, {

      status: 500,

      headers: {

        "Cache-Control": "no-store",

      },

    });

  }

}