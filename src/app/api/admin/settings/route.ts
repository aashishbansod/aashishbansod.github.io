import { NextResponse } from "next/server";
import mongoose, {
  Schema,
  type Document,
  type Model,
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

type SettingsDocument = Document & {
  key: string;
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  officeLocation: string;
  emailNotifications: boolean;
  applicationAlerts: boolean;
  paymentAlerts: boolean;
  certificateAlerts: boolean;
  maintenanceMode: boolean;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

type AdminAuth = {
  userId: string;
  role: string;
  email?: string;
};

type AuthPayload = {
  role?: unknown;
  userId?: unknown;
  id?: unknown;
  adminId?: unknown;
  sub?: unknown;
  email?: unknown;
};

type SettingsResponse = {
  key: string;
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  officeLocation: string;
  emailNotifications: boolean;
  applicationAlerts: boolean;
  paymentAlerts: boolean;
  certificateAlerts: boolean;
  maintenanceMode: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

const SETTINGS_KEY = "admin";

const DEFAULT_SETTINGS = {
  key: SETTINGS_KEY,
  companyName: "CyberNet Technology Systems",
  supportEmail: "contact@cybernetsystems.tech",
  supportPhone: "",
  officeLocation: "Amravati, Maharashtra, India",
  emailNotifications: true,
  applicationAlerts: true,
  paymentAlerts: true,
  certificateAlerts: true,
  maintenanceMode: false,
} as const;

const settingsSchema = new Schema<SettingsDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: SETTINGS_KEY,
      trim: true,
      immutable: true,
      index: true,
    },

    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    supportEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    supportPhone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },

    officeLocation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    emailNotifications: {
      type: Boolean,
      default: true,
    },

    applicationAlerts: {
      type: Boolean,
      default: true,
    },

    paymentAlerts: {
      type: Boolean,
      default: true,
    },

    certificateAlerts: {
      type: Boolean,
      default: true,
    },

    maintenanceMode: {
      type: Boolean,
      default: false,
    },

    updatedBy: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "admin_settings",
  },
);

settingsSchema.index({ key: 1 }, { unique: true });

const AdminSettings: Model<SettingsDocument> =
  (mongoose.models.AdminSettings as Model<SettingsDocument> | undefined) ??
  mongoose.model<SettingsDocument>("AdminSettings", settingsSchema);

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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toAuthPayload(value: unknown): AuthPayload | null {
  if (!isPlainRecord(value)) return null;
  return value as AuthPayload;
}

async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const result = await verifyAccessToken(token);
    const payload = toAuthPayload(result);

    if (payload) return payload;
  } catch {
    // Fall through to the compatibility verifier.
  }

  try {
    const result = await verifyAuthToken(token);
    return toAuthPayload(result);
  } catch {
    return null;
  }
}

function getTokenFromRequest(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";

  const cookieToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);

  if (cookieToken) {
    try {
      return decodeURIComponent(cookieToken);
    } catch {
      return cookieToken;
    }
  }

  const authorization = request.headers.get("authorization") ?? "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return "";
}

async function requireAdmin(request: Request): Promise<AdminAuth> {
  const token = getTokenFromRequest(request);

  if (!token) {
    throw new AuthError(
      "Authentication required.",
      401,
      "AUTH_REQUIRED",
    );
  }

  const payload = await verifyToken(token);

  if (!payload) {
    throw new AuthError(
      "Invalid or expired authentication token.",
      401,
      "AUTH_INVALID",
    );
  }

  const tokenRole = cleanString(payload.role).toLowerCase();

  const userId = cleanString(
    payload.userId ??
      payload.id ??
      payload.adminId ??
      payload.sub,
  );

  const email = cleanString(payload.email).toLowerCase();

  // Student tokens must never reach the admin settings API.
  if (tokenRole !== "admin" || !userId) {
    throw new AuthError(
      "Admin access is required.",
      403,
      "ADMIN_REQUIRED",
    );
  }

  await connectDB();

  const lookup: Record<string, unknown>[] = [];

  if (mongoose.Types.ObjectId.isValid(userId)) {
    lookup.push({ _id: userId });
  }

  lookup.push({ adminId: userId });

  if (email) {
    lookup.push({ email });
  }

  const admin = await AdminModel.findOne({
    $or: lookup,
  })
    .select("_id adminId email role isActive active")
    .lean();

  if (!admin) {
    throw new AuthError(
      "Active admin account was not found.",
      403,
      "ADMIN_NOT_FOUND",
    );
  }

  const adminRecord = admin as {
    _id?: unknown;
    adminId?: unknown;
    email?: unknown;
    role?: unknown;
    isActive?: boolean;
    active?: boolean;
  };

  const active =
    adminRecord.isActive !== false &&
    adminRecord.active !== false;

  if (!active) {
    throw new AuthError(
      "Admin account is inactive.",
      403,
      "ADMIN_INACTIVE",
    );
  }

  return {
    userId: String(
      adminRecord.adminId ?? adminRecord._id ?? userId,
    ),
    role: String(
      adminRecord.role ?? payload.role ?? "admin",
    ),
    email:
      typeof adminRecord.email === "string"
        ? adminRecord.email
        : email || undefined,
  };
}

function isSuperAdmin(admin: AdminAuth): boolean {
  const role = admin.role.trim().toLowerCase();

  return (
    role === "super admin" ||
    role === "superadmin"
  );
}

function serializeSettings(
  settings: SettingsDocument,
): SettingsResponse {
  return {
    key: settings.key,
    companyName: settings.companyName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    officeLocation: settings.officeLocation,
    emailNotifications: settings.emailNotifications,
    applicationAlerts: settings.applicationAlerts,
    paymentAlerts: settings.paymentAlerts,
    certificateAlerts: settings.certificateAlerts,
    maintenanceMode: settings.maintenanceMode,
    createdAt: settings.createdAt?.toISOString(),
    updatedAt: settings.updatedAt?.toISOString(),
    updatedBy: settings.updatedBy,
  };
}

async function getOrCreateSettings(): Promise<SettingsDocument> {
  const existing = await AdminSettings.findOne({
    key: SETTINGS_KEY,
  });

  if (existing) {
    return existing;
  }

  try {
    return await AdminSettings.create({
      ...DEFAULT_SETTINGS,
    });
  } catch (error) {
    if (
      isPlainRecord(error) &&
      error.code === 11000
    ) {
      const createdByAnotherRequest =
        await AdminSettings.findOne({
          key: SETTINGS_KEY,
        });

      if (createdByAnotherRequest) {
        return createdByAnotherRequest;
      }
    }

    throw error;
  }
}

function validateSettingsBody(
  body: Record<string, unknown>,
): {
  updates: Partial<SettingsResponse>;
  error?: {
    message: string;
    code: string;
  };
} {
  const updates: Partial<SettingsResponse> = {};

  if (body.companyName !== undefined) {
    const value = cleanString(body.companyName);

    if (!value) {
      return {
        updates,
        error: {
          message: "Company name is required.",
          code: "INVALID_COMPANY_NAME",
        },
      };
    }

    if (value.length > 120) {
      return {
        updates,
        error: {
          message:
            "Company name must be 120 characters or less.",
          code: "INVALID_COMPANY_NAME",
        },
      };
    }

    updates.companyName = value;
  }

  if (body.supportEmail !== undefined) {
    const value = cleanString(body.supportEmail).toLowerCase();

    if (!value || !isValidEmail(value)) {
      return {
        updates,
        error: {
          message:
            "Please provide a valid support email address.",
          code: "INVALID_SUPPORT_EMAIL",
        },
      };
    }

    if (value.length > 254) {
      return {
        updates,
        error: {
          message:
            "Support email must be 254 characters or less.",
          code: "INVALID_SUPPORT_EMAIL",
        },
      };
    }

    updates.supportEmail = value;
  }

  if (body.supportPhone !== undefined) {
    const value = cleanString(body.supportPhone);

    if (value.length > 40) {
      return {
        updates,
        error: {
          message: "Support phone is too long.",
          code: "INVALID_SUPPORT_PHONE",
        },
      };
    }

    updates.supportPhone = value;
  }

  if (body.officeLocation !== undefined) {
    const value = cleanString(body.officeLocation);

    if (!value) {
      return {
        updates,
        error: {
          message: "Office location is required.",
          code: "INVALID_OFFICE_LOCATION",
        },
      };
    }

    if (value.length > 180) {
      return {
        updates,
        error: {
          message:
            "Office location must be 180 characters or less.",
          code: "INVALID_OFFICE_LOCATION",
        },
      };
    }

    updates.officeLocation = value;
  }

  const booleanFields: Array<
    keyof Pick<
      SettingsResponse,
      | "emailNotifications"
      | "applicationAlerts"
      | "paymentAlerts"
      | "certificateAlerts"
      | "maintenanceMode"
    >
  > = [
    "emailNotifications",
    "applicationAlerts",
    "paymentAlerts",
    "certificateAlerts",
    "maintenanceMode",
  ];

  for (const field of booleanFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "boolean") {
        return {
          updates,
          error: {
            message: `${field} must be a boolean.`,
            code: "INVALID_BOOLEAN_SETTING",
          },
        };
      }

      updates[field] = body[field] as boolean;
    }
  }

  return { updates };
}

function handleError(
  error: unknown,
  operation: "load" | "update",
) {
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

  if (
    isPlainRecord(error) &&
    error.code === 11000
  ) {
    return json(
      {
        success: false,
        message:
          "Settings record already exists. Please retry.",
        code: "SETTINGS_DUPLICATE",
      },
      409,
    );
  }

  console.error(
    `[ADMIN SETTINGS ${operation.toUpperCase()}]`,
    error,
  );

  return json(
    {
      success: false,
      message:
        `Failed to ${operation.toLowerCase()} admin settings.`,
      code:
        `ADMIN_SETTINGS_${operation.toUpperCase()}_FAILED`,
      ...(process.env.NODE_ENV === "development" &&
      error instanceof Error
        ? { detail: error.message }
        : {}),
    },
    500,
  );
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const settings = await getOrCreateSettings();

    return json({
      success: true,
      message: "Admin settings loaded successfully.",
      data: serializeSettings(settings),
      meta: {
        authenticated: true,
        adminId: admin.userId,
        role: admin.role,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleError(error, "load");
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(request);

    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (!isPlainRecord(parsed)) {
        return json(
          {
            success: false,
            message:
              "Request body must be a JSON object.",
            code: "INVALID_REQUEST_BODY",
          },
          400,
        );
      }

      body = parsed;
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

    const { updates, error } =
      validateSettingsBody(body);

    if (error) {
      return json(
        {
          success: false,
          message: error.message,
          code: error.code,
        },
        400,
      );
    }

    if (Object.keys(updates).length === 0) {
      const current = await getOrCreateSettings();

      return json({
        success: true,
        message:
          "No settings changes were requested.",
        data: serializeSettings(current),
        meta: {
          updated: false,
          adminId: admin.userId,
          role: admin.role,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // Maintenance mode is a high-impact operational setting.
    // Only Super Admin is allowed to change it.
    if (
      updates.maintenanceMode !== undefined &&
      !isSuperAdmin(admin)
    ) {
      return json(
        {
          success: false,
          message:
            "Only Super Admin can change maintenance mode.",
          code: "SUPER_ADMIN_REQUIRED",
        },
        403,
      );
    }

    const settings =
      await AdminSettings.findOneAndUpdate(
        { key: SETTINGS_KEY },
        {
          $set: {
            ...updates,
            updatedBy: admin.userId,
          },
          $setOnInsert: {
            ...DEFAULT_SETTINGS,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );

    if (!settings) {
      return json(
        {
          success: false,
          message: "Settings could not be updated.",
          code: "SETTINGS_UPDATE_FAILED",
        },
        500,
      );
    }

    return json({
      success: true,
      message:
        "Admin settings updated successfully.",
      data: serializeSettings(settings),
      meta: {
        updated: true,
        updatedBy: admin.userId,
        role: admin.role,
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, PUT, PATCH, OPTIONS, HEAD",
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

    console.error("[ADMIN SETTINGS HEAD]", error);

    return new NextResponse(null, {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
