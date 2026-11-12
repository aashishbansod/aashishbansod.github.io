import "server-only";

import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { getStudentConnection } from "@/lib/student-db";

const COLLECTION_NAME = "studentadmins";
const MODEL_NAME = "StudentAdmin";
const STUDENT_ADMIN_ROLE = "Student Operations Admin";
const CONNECTED_STATE = 1;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const PermissionSchema = new Schema(
  {
    dashboard: { type: Boolean, default: true },
    students: { type: Boolean, default: true },
    applications: { type: Boolean, default: true },
    internships: { type: Boolean, default: true },
    payments: { type: Boolean, default: true },
    certificates: { type: Boolean, default: true },
    reports: { type: Boolean, default: true },
    settings: { type: Boolean, default: false },
  },
  {
    _id: false,
    strict: "throw",
  },
);

const SecuritySchema = new Schema(
  {
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      validate: {
        validator: Number.isSafeInteger,
        message: "Login attempts must be a whole number.",
      },
    },
    accountLocked: { type: Boolean, default: false },
    lockedUntil: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    lastPasswordResetAt: { type: Date, default: null },
    lastFailedLoginAt: { type: Date, default: null },
    lastSuccessfulLoginAt: { type: Date, default: null },
  },
  {
    _id: false,
    strict: "throw",
  },
);

const StudentAdminSchema = new Schema(
  {
    adminId: {
      type: String,
      required: [true, "Student Admin ID is required."],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 4,
      maxlength: 40,
      match: /^[A-Z0-9][A-Z0-9_-]*$/,
      immutable: true,
    },
    username: {
      type: String,
      required: [true, "Username is required."],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/,
      immutable: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, "Email address is required."],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      immutable: true,
    },
    password: {
      type: String,
      required: [true, "Password hash is required."],
      select: false,
      minlength: 20,
      maxlength: 4096,
      validate: {
        validator: (value: string) =>
          typeof value === "string" && value.startsWith("scrypt$"),
        message: "Password must be stored as a supported scrypt hash.",
      },
    },
    role: {
      type: String,
      required: true,
      enum: [STUDENT_ADMIN_ROLE],
      default: STUDENT_ADMIN_ROLE,
      immutable: true,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "Student Operations Administrator",
    },
    department: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "Student Operations",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },
    registrationSource: {
      type: String,
      enum: ["private-self-registration"],
      default: "private-self-registration",
      immutable: true,
    },
    registrationStatus: {
      type: String,
      enum: ["pending-verification", "active", "suspended"],
      default: "pending-verification",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    registrationCompletedAt: {
      type: Date,
      default: null,
    },
    emailOtpHash: {
      type: String,
      default: null,
      select: false,
      maxlength: 256,
    },
    emailOtpExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    emailOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
      validate: {
        validator: Number.isSafeInteger,
        message: "Email OTP attempts must be a whole number.",
      },
    },
    emailOtpSentAt: {
      type: Date,
      default: null,
    },
    emailOtpResendCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 20,
      validate: {
        validator: Number.isSafeInteger,
        message: "Email OTP resend count must be a whole number.",
      },
    },
    permissions: {
      type: PermissionSchema,
      default: () => ({}),
    },
    security: {
      type: SecuritySchema,
      default: () => ({}),
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    loginCount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Login count must be a whole number.",
      },
    },
    createdBy: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "private-self-registration",
      immutable: true,
    },
    updatedBy: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "private-self-registration",
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
    strict: "throw",
    versionKey: false,
    minimize: false,
    autoIndex: !IS_PRODUCTION,
  },
);

StudentAdminSchema.index(
  { role: 1, isActive: 1, registrationStatus: 1 },
  { name: "student_admin_role_status" },
);

StudentAdminSchema.index(
  { "security.accountLocked": 1, "security.lockedUntil": 1 },
  { name: "student_admin_lock_lookup" },
);

StudentAdminSchema.index(
  { emailOtpExpiresAt: 1, registrationStatus: 1 },
  { name: "student_admin_otp_expiry_status" },
);

StudentAdminSchema.index(
  { createdAt: -1 },
  { name: "student_admin_created_at" },
);

StudentAdminSchema.pre("validate", function normalizeStudentAdmin() {
  if (typeof this.adminId === "string") {
    this.adminId = this.adminId.trim().toUpperCase();
  }

  if (typeof this.username === "string") {
    this.username = this.username.trim().toLowerCase();
  }

  if (typeof this.email === "string") {
    this.email = this.email.trim().toLowerCase();
  }

  if (typeof this.phone === "string") {
    this.phone = this.phone.trim();
  }

  if (
    this.isModified("password") &&
    (typeof this.password !== "string" ||
      !this.password.startsWith("scrypt$"))
  ) {
    this.invalidate(
      "password",
      "Password must be stored as a supported scrypt hash.",
    );
  }

  if (this.isModified("role") && this.role !== STUDENT_ADMIN_ROLE) {
    this.invalidate("role", "Student Admin role cannot be changed.");
  }

  if (
    this.registrationStatus === "active" &&
    (this.isEmailVerified !== true || this.isActive !== true)
  ) {
    this.invalidate(
      "registrationStatus",
      "An active Student Admin must have a verified email and an active account.",
    );
  }

  if (this.isEmailVerified === false && this.isActive === true) {
    this.invalidate(
      "isActive",
      "A Student Admin cannot be active before email verification.",
    );
  }

  if (this.registrationStatus === "suspended" && this.isActive === true) {
    this.invalidate(
      "isActive",
      "A suspended Student Admin cannot have an active account.",
    );
  }

  if (this.emailOtpAttempts > 10) {
    this.invalidate("emailOtpAttempts", "Email OTP attempt limit exceeded.");
  }

  if (this.emailOtpResendCount > 20) {
    this.invalidate(
      "emailOtpResendCount",
      "Email OTP resend limit exceeded.",
    );
  }
});

export type StudentAdminDocument = InferSchemaType<
  typeof StudentAdminSchema
>;

function assertStudentOperationsConnection(
  connection: Connection,
): void {
  if (
    connection.readyState !== CONNECTED_STATE ||
    connection.db == null
  ) {
    throw new Error(
      "Student Operations database connection is not ready.",
    );
  }
}

export async function getStudentAdminModel(
  connection?: Connection,
): Promise<Model<StudentAdminDocument>> {
  const studentConnection = connection ?? (await getStudentConnection());

  assertStudentOperationsConnection(studentConnection);

  const existing = studentConnection.models[
    MODEL_NAME
  ] as Model<StudentAdminDocument> | undefined;

  if (existing) {
    return existing;
  }

  return studentConnection.model<StudentAdminDocument>(
    MODEL_NAME,
    StudentAdminSchema,
    COLLECTION_NAME,
  );
}

export async function ensureStudentAdminIndexes(): Promise<void> {
  const model = await getStudentAdminModel();
  await model.createIndexes();
}

export default getStudentAdminModel;
