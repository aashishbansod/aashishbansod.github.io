import mongoose, {
  Schema,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * CyberNet Careers — Main Admin model
 *
 * Database ownership:
 * - This model belongs to the MAIN Careers database connection.
 * - Call connectDB() before using this model.
 * - Student Operations Admin is an admin identity/role in this collection.
 * - Student Operations student/task records belong to the separate Student
 *   Operations database and must be accessed through its own connection/models.
 *
 * Security:
 * - `password` stores a password hash only, never a plaintext password.
 * - Password and refreshToken are excluded from normal query projections.
 * - Authorization must be enforced by server-side services, not this schema.
 * - Do not accept role/permissions supplied by a client during admin creation.
 */

export const ADMIN_ROLES = [
  "Super Admin",
  "Admin",
  "Student Operations Admin",
  "HR",
  "Assessment Manager",
  "Support",
] as const;

export type AdminRoleName = (typeof ADMIN_ROLES)[number];

const ADMIN_PERMISSION_KEYS = [
  "dashboard",
  "students",
  "applications",
  "assessment",
  "certificates",
  "payments",
  "internships",
  "email",
  "whatsapp",
  "reports",
  "settings",
  "admins",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

const AdminSchema = new Schema(
  {
    adminId: {
      type: String,
      required: [true, "Admin ID is required."],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, "Admin ID must contain at least 3 characters."],
      maxlength: [50, "Admin ID cannot exceed 50 characters."],
      immutable: true,
    },

    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      minlength: [2, "Full name must contain at least 2 characters."],
      maxlength: [120, "Full name cannot exceed 120 characters."],
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [254, "Email cannot exceed 254 characters."],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid email address.",
      ],
    },

    // Authentication services must explicitly select("+password").
    password: {
      type: String,
      required: [true, "Password hash is required."],
      minlength: [
        20,
        "Password value does not look like a supported password hash.",
      ],
      maxlength: [255, "Password hash cannot exceed 255 characters."],
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: [...ADMIN_ROLES],
        message: "Unsupported admin role: {VALUE}.",
      },
      required: [true, "Admin role is required."],
      default: "Admin",
    },

    designation: {
      type: String,
      trim: true,
      maxlength: [120, "Designation cannot exceed 120 characters."],
      default: "",
    },

    department: {
      type: String,
      trim: true,
      maxlength: [120, "Department cannot exceed 120 characters."],
      default: "",
    },

    employeeCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [50, "Employee code cannot exceed 50 characters."],
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone cannot exceed 20 characters."],
      default: "",
    },

    profilePhoto: {
      type: String,
      trim: true,
      maxlength: [1000, "Profile photo URL cannot exceed 1000 characters."],
      default: "",
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
      required: true,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      required: true,
      index: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    loginCount: {
      type: Number,
      default: 0,
      min: [0, "Login count cannot be negative."],
    },

    // Kept for compatibility with existing services; never return it publicly.
    refreshToken: {
      type: String,
      default: "",
      select: false,
      maxlength: [2000, "Refresh token value cannot exceed 2000 characters."],
    },

    permissions: {
      dashboard: { type: Boolean, default: true },
      students: { type: Boolean, default: true },
      applications: { type: Boolean, default: true },
      assessment: { type: Boolean, default: true },
      certificates: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      internships: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      reports: { type: Boolean, default: true },
      settings: { type: Boolean, default: false },
      admins: { type: Boolean, default: false },
    },

    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      loginAttempts: {
        type: Number,
        default: 0,
        min: [0, "Login attempts cannot be negative."],
      },
      accountLocked: { type: Boolean, default: false },
      lockedUntil: { type: Date, default: null },
      passwordChangedAt: { type: Date, default: Date.now },
    },

    notifications: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      browser: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    collection: "admins",
    strict: "throw",
    versionKey: false,
    minimize: false,
    // In production, create indexes with a deliberate deployment/migration.
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

/**
 * Query indexes only. `unique: true` above declares the unique indexes for
 * adminId and email; do not declare duplicate unique indexes here.
 */
AdminSchema.index({ role: 1, isActive: 1 });
AdminSchema.index({
  "security.accountLocked": 1,
  "security.lockedUntil": 1,
});
AdminSchema.index({ createdAt: -1 });
AdminSchema.index({
  role: 1,
  "permissions.dashboard": 1,
  "permissions.students": 1,
  isActive: 1,
});

/**
 * Keep the schema defensive on document saves. Query updates should still be
 * validated by callers with `runValidators: true` when appropriate.
 */
AdminSchema.pre("validate", function validateAdminSecurity() {
  if (this.isModified("password")) {
    const passwordHash = this.password;
    if (
      typeof passwordHash !== "string" ||
      !passwordHash.startsWith("scrypt$")
    ) {
      this.invalidate(
        "password",
        "Password must be stored as a supported scrypt password hash.",
      );
    }
  }

  if (this.isModified("email") && typeof this.email === "string") {
    this.email = this.email.trim().toLowerCase();
  }

  if (this.isModified("adminId") && typeof this.adminId === "string") {
    this.adminId = this.adminId.trim().toUpperCase();
  }
});

export type AdminDocument = InferSchemaType<typeof AdminSchema>;

const existingAdminModel = mongoose.models.Admin as
  | Model<AdminDocument>
  | undefined;

const AdminModel: Model<AdminDocument> =
  existingAdminModel ??
  mongoose.model<AdminDocument>("Admin", AdminSchema);

export default AdminModel;
