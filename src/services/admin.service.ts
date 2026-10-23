import mongoose from "mongoose";

import Student from "@/models/Student";
import Admin from "@/models/Admin";

import {
  createAccessToken,
  verifyAccessToken,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

// ============================================================
// CYBERNET CAREERS
// AUTHENTICATION SERVICE
// ============================================================
//
// ONE LOGIN SYSTEM
//
// Student:
//   Student ID / Email + Password
//
// Admin:
//   Admin ID / Email + Password
//
// Security:
//   - scrypt password hashing
//   - admin password explicitly selected
//   - no password returned to client
//   - signed JWT access token
//   - admin failed-login lock
//   - account status verification
//   - student journey expiry
// ============================================================

// ============================================================
// TYPES
// ============================================================

export type AuthRole = "student" | "admin";

export type AdminRole =
  | "Super Admin"
  | "Admin"
  | "HR"
  | "Assessment Manager"
  | "Support";

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface AuthUser {
  id: string;
  role: AuthRole;
  email: string;
  name: string;
  identifier: string;

  adminRole?: AdminRole;

  studentId?: string;
  applicationId?: string;

  emailVerified?: boolean;
  loginEnabled?: boolean;

  applicationStatus?: string;
  assessmentStatus?: string;
  resultStatus?: string;
  internshipStatus?: string;
  paymentStatus?: string;
  adminApprovalStatus?: string;
  dashboardStatus?: string;

  permissions?: Record<string, boolean>;

  profilePhoto?: string;
}

export interface LoginSuccess {
  success: true;
  message: string;
  token: string;
  expiresIn: number;
  user: AuthUser;
}

export interface LoginFailure {
  success: false;
  message: string;
  code: string;
  retryAfter?: number;
}

export type LoginResult =
  | LoginSuccess
  | LoginFailure;

// ============================================================
// CONFIGURATION
// ============================================================

const SESSION_DURATION_SECONDS =
  60 * 60 * 24 * 7;

const MAX_ADMIN_LOGIN_ATTEMPTS = 5;

const ADMIN_LOCK_DURATION_MS =
  15 * 60 * 1000;

const MAX_IDENTIFIER_LENGTH = 254;

const MAX_PASSWORD_LENGTH = 200;

// ============================================================
// DATABASE
// ============================================================

function getMongoUri(): string {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI or MONGO_URI is missing from environment variables."
    );
  }

  return uri;
}

async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }

  await mongoose.connect(getMongoUri(), {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
  });
}

// ============================================================
// INPUT HELPERS
// ============================================================

function normalizeIdentifier(
  identifier: string
): string {
  return identifier.trim();
}

function normalizeEmail(
  email: string
): string {
  return email.trim().toLowerCase();
}

function isValidIdentifier(
  identifier: unknown
): identifier is string {
  return (
    typeof identifier === "string" &&
    identifier.trim().length > 0 &&
    identifier.trim().length <=
      MAX_IDENTIFIER_LENGTH
  );
}

function isValidPassword(
  password: unknown
): password is string {
  return (
    typeof password === "string" &&
    password.length > 0 &&
    password.length <=
      MAX_PASSWORD_LENGTH
  );
}

// ============================================================
// PASSWORD HELPERS
// ============================================================

export async function createPasswordHash(
  password: string
): Promise<string> {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error(
      "Password must contain 8-200 characters."
    );
  }

  return hashPassword(password);
}

export async function checkPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    typeof storedHash !== "string" ||
    !storedHash
  ) {
    return false;
  }

  return verifyPassword(
    password,
    storedHash
  );
}

// Backward-compatible helper.
// Existing setup-admin code can continue using it.
export async function hashUserPassword(
  password: string
): Promise<string> {
  return createPasswordHash(password);
}

export async function createAdminPasswordHash(
  password: string
): Promise<string> {
  return createPasswordHash(password);
}

export async function createStudentPasswordHash(
  password: string
): Promise<string> {
  return createPasswordHash(password);
}

// ============================================================
// STUDENT FINDER
// ============================================================

async function findStudent(
  identifier: string
): Promise<any | null> {
  const value =
    normalizeIdentifier(identifier);

  const email =
    normalizeEmail(identifier);

  const studentId =
    value.toUpperCase();

  return Student.findOne({
    $or: [
      {
        email,
      },
      {
        studentId,
      },
    ],
  })
    .select("+loginPasswordHash")
    .lean()
    .exec();
}

// ============================================================
// ADMIN FINDER
// ============================================================

async function findAdmin(
  identifier: string
): Promise<any | null> {
  const value =
    normalizeIdentifier(identifier);

  const email =
    normalizeEmail(identifier);

  const adminId =
    value.toUpperCase();

  return Admin.findOne({
    $or: [
      {
        email,
      },
      {
        adminId,
      },
    ],
  })
    .select("+password")
    .lean()
    .exec();
}

// ============================================================
// ADMIN LOCK
// ============================================================

function isAdminLocked(
  admin: any
): boolean {
  const security =
    admin?.security;

  if (
    security?.accountLocked !== true
  ) {
    return false;
  }

  const lockedUntil =
    security?.lockedUntil;

  // Permanent lock
  if (!lockedUntil) {
    return true;
  }

  const expiry =
    new Date(
      lockedUntil
    ).getTime();

  if (Number.isNaN(expiry)) {
    return true;
  }

  return expiry > Date.now();
}

function getRetryAfter(
  lockedUntil:
    | Date
    | string
    | null
    | undefined
): number {
  if (!lockedUntil) {
    return 0;
  }

  const remaining =
    new Date(
      lockedUntil
    ).getTime() -
    Date.now();

  if (remaining <= 0) {
    return 0;
  }

  return Math.ceil(
    remaining / 1000
  );
}

// ============================================================
// STUDENT EXPIRY
// ============================================================

function isStudentExpired(
  student: any
): boolean {
  if (
    student?.journeyExpired === true
  ) {
    return true;
  }

  const now = Date.now();

  if (student?.journeyExpiresAt) {
    const expiresAt =
      new Date(
        student.journeyExpiresAt
      ).getTime();

    if (
      !Number.isNaN(expiresAt) &&
      expiresAt <= now
    ) {
      return true;
    }
  }

  if (
    student?.credentialsExpiresAt
  ) {
    const expiresAt =
      new Date(
        student.credentialsExpiresAt
      ).getTime();

    if (
      !Number.isNaN(expiresAt) &&
      expiresAt <= now
    ) {
      return true;
    }
  }

  return false;
}

// ============================================================
// STUDENT SANITIZER
// ============================================================

function sanitizeStudent(
  student: any
): AuthUser {
  return {
    id: String(student._id),

    role: "student",

    email:
      student.email || "",

    name:
      student.fullName ||
      student.name ||
      "Student",

    identifier:
      student.studentId ||
      student.email ||
      "",

    studentId:
      student.studentId ||
      undefined,

    applicationId:
      student.applicationId ||
      undefined,

    emailVerified:
      student.emailVerified === true,

    loginEnabled:
      student.loginEnabled === true,

    applicationStatus:
      student.applicationStatus,

    assessmentStatus:
      student.assessmentStatus,

    resultStatus:
      student.resultStatus,

    internshipStatus:
      student.internshipStatus,

    paymentStatus:
      student.paymentStatus,

    adminApprovalStatus:
      student.adminApprovalStatus,

    dashboardStatus:
      student.dashboardStatus,

    profilePhoto:
      student.photoUrl ||
      student.profilePhoto ||
      undefined,
  };
}

// ============================================================
// ADMIN SANITIZER
// ============================================================

function sanitizeAdmin(
  admin: any
): AuthUser {
  const permissions =
    admin?.permissions || {};

  return {
    id: String(admin._id),

    role: "admin",

    email:
      admin.email || "",

    name:
      admin.fullName ||
      "Administrator",

    identifier:
      admin.adminId ||
      admin.email ||
      "",

    adminRole:
      admin.role as AdminRole,

    profilePhoto:
      admin.profilePhoto ||
      undefined,

    permissions: {
      dashboard:
        permissions.dashboard === true,

      students:
        permissions.students === true,

      applications:
        permissions.applications === true,

      assessment:
        permissions.assessment === true,

      certificates:
        permissions.certificates === true,

      payments:
        permissions.payments === true,

      internships:
        permissions.internships === true,

      email:
        permissions.email === true,

      whatsapp:
        permissions.whatsapp === true,

      reports:
        permissions.reports === true,

      settings:
        permissions.settings === true,

      admins:
        permissions.admins === true,
    },
  };
}

// ============================================================
// STUDENT LOGIN
// ============================================================

async function loginStudent(
  student: any,
  password: string
): Promise<LoginResult> {
  if (!student) {
    return {
      success: false,
      message:
        "Invalid login credentials.",
      code:
        "INVALID_CREDENTIALS",
    };
  }

  if (
    student.loginEnabled !== true
  ) {
    return {
      success: false,
      message:
        "Your student login is not active yet. Please wait for admin approval.",
      code:
        "LOGIN_DISABLED",
    };
  }

  if (
    student.emailVerified !== true
  ) {
    return {
      success: false,
      message:
        "Please verify your email address before logging in.",
      code:
        "EMAIL_NOT_VERIFIED",
    };
  }

  if (
    isStudentExpired(student)
  ) {
    await Student.updateOne(
      {
        _id: student._id,
      },
      {
        $set: {
          journeyExpired: true,
          loginEnabled: false,
          applicationStatus:
            "expired",
        },
      }
    ).exec();

    return {
      success: false,
      message:
        "Your student login period has expired.",
      code:
        "JOURNEY_EXPIRED",
    };
  }

  const passwordHash =
    student.loginPasswordHash;

  if (
    !passwordHash ||
    typeof passwordHash !== "string"
  ) {
    return {
      success: false,
      message:
        "Your login credentials have not been generated yet.",
      code:
        "CREDENTIALS_NOT_GENERATED",
    };
  }

  const valid =
    await verifyPassword(
      password,
      passwordHash
    );

  if (!valid) {
    return {
      success: false,
      message:
        "Invalid login credentials.",
      code:
        "INVALID_CREDENTIALS",
    };
  }

  try {
    await Student.updateOne(
      {
        _id: student._id,
      },
      {
        $set: {
          lastLoginAt:
            new Date(),
        },
      }
    ).exec();
  } catch (error) {
    console.error(
      "[AUTH] Student login metadata update failed:",
      error
    );
  }

  const user =
    sanitizeStudent(student);

  const token =
    createAccessToken({
      id: user.id,
      identifier:
        user.identifier,
      role: "student",
    });

  return {
    success: true,
    message:
      "Student login successful.",
    token,
    expiresIn:
      SESSION_DURATION_SECONDS,
    user,
  };
}

// ============================================================
// ADMIN LOGIN
// ============================================================

async function loginAdmin(
  admin: any,
  password: string
): Promise<LoginResult> {
  if (!admin) {
    return {
      success: false,
      message:
        "Invalid login credentials.",
      code:
        "INVALID_CREDENTIALS",
    };
  }

  if (
    admin.isActive !== true
  ) {
    return {
      success: false,
      message:
        "Your admin account is inactive. Please contact the Super Admin.",
      code:
        "ACCOUNT_INACTIVE",
    };
  }

  if (
    isAdminLocked(admin)
  ) {
    const retryAfter =
      getRetryAfter(
        admin?.security?.lockedUntil
      );

    return {
      success: false,
      message:
        "Too many failed login attempts. Your admin account is temporarily locked.",
      code:
        "ACCOUNT_TEMPORARILY_LOCKED",
      retryAfter,
    };
  }

  const passwordHash =
    admin.password;

  if (
    !passwordHash ||
    typeof passwordHash !== "string"
  ) {
    return {
      success: false,
      message:
        "Admin credentials are not configured correctly.",
      code:
        "ADMIN_PASSWORD_NOT_CONFIGURED",
    };
  }

  const valid =
    await verifyPassword(
      password,
      passwordHash
    );

  if (!valid) {
    const currentAttempts =
      Number(
        admin?.security?.loginAttempts ||
          0
      );

    const nextAttempts =
      currentAttempts + 1;

    if (
      nextAttempts >=
      MAX_ADMIN_LOGIN_ATTEMPTS
    ) {
      const lockedUntil =
        new Date(
          Date.now() +
            ADMIN_LOCK_DURATION_MS
        );

      await Admin.updateOne(
        {
          _id: admin._id,
        },
        {
          $set: {
            "security.loginAttempts":
              nextAttempts,

            "security.accountLocked":
              true,

            "security.lockedUntil":
              lockedUntil,
          },
        }
      ).exec();

      return {
        success: false,
        message:
          "Too many failed login attempts. Your admin account has been temporarily locked.",
        code:
          "ACCOUNT_TEMPORARILY_LOCKED",
        retryAfter:
          Math.ceil(
            ADMIN_LOCK_DURATION_MS /
              1000
          ),
      };
    }

    await Admin.updateOne(
      {
        _id: admin._id,
      },
      {
        $set: {
          "security.loginAttempts":
            nextAttempts,
        },
      }
    ).exec();

    return {
      success: false,
      message:
        "Invalid login credentials.",
      code:
        "INVALID_CREDENTIALS",
    };
  }

  // Successful login
  try {
    await Admin.updateOne(
      {
        _id: admin._id,
      },
      {
        $set: {
          lastLogin:
            new Date(),

          "security.loginAttempts":
            0,

          "security.accountLocked":
            false,

          "security.lockedUntil":
            null,
        },

        $inc: {
          loginCount: 1,
        },
      }
    ).exec();
  } catch (error) {
    console.error(
      "[AUTH] Admin login metadata update failed:",
      error
    );
  }

  const user =
    sanitizeAdmin(admin);

  const token =
    createAccessToken({
      id: user.id,
      identifier:
        user.identifier,
      role: "admin",
      adminRole:
        user.adminRole,
    });

  return {
    success: true,
    message:
      "Admin login successful.",
    token,
    expiresIn:
      SESSION_DURATION_SECONDS,
    user,
  };
}

// ============================================================
// MAIN LOGIN
// ============================================================

export async function login(
  input: LoginInput
): Promise<LoginResult> {
  try {
    if (
      !input ||
      typeof input !== "object"
    ) {
      return {
        success: false,
        message:
          "Login information is required.",
        code:
          "INVALID_INPUT",
      };
    }

    if (
      !isValidIdentifier(
        input.identifier
      )
    ) {
      return {
        success: false,
        message:
          "Email or ID is required.",
        code:
          "IDENTIFIER_REQUIRED",
      };
    }

    if (
      !isValidPassword(
        input.password
      )
    ) {
      return {
        success: false,
        message:
          "Password is required.",
        code:
          "PASSWORD_REQUIRED",
      };
    }

    const identifier =
      normalizeIdentifier(
        input.identifier
      );

    const password =
      input.password;

    await connectDatabase();

    // --------------------------------------------------------
    // ADMIN FIRST
    // --------------------------------------------------------

    const admin =
      await findAdmin(
        identifier
      );

    if (admin) {
      return loginAdmin(
        admin,
        password
      );
    }

    // --------------------------------------------------------
    // STUDENT
    // --------------------------------------------------------

    const student =
      await findStudent(
        identifier
      );

    if (student) {
      return loginStudent(
        student,
        password
      );
    }

    return {
      success: false,
      message:
        "Invalid login credentials.",
      code:
        "INVALID_CREDENTIALS",
    };
  } catch (error) {
    console.error(
      "[CyberNet Auth] Login error:",
      error
    );

    return {
      success: false,
      message:
        "Unable to process login right now. Please try again later.",
      code:
        "AUTHENTICATION_ERROR",
    };
  }
}

// ============================================================
// AUTHENTICATED USER
// ============================================================

export async function getAuthenticatedUser(
  token: string
): Promise<AuthUser | null> {
  try {
    if (
      typeof token !== "string" ||
      !token.trim()
    ) {
      return null;
    }

    const payload =
      verifyAccessToken(token);

    if (!payload) {
      return null;
    }

    await connectDatabase();

    // --------------------------------------------------------
    // STUDENT
    // --------------------------------------------------------

    if (
      payload.role === "student"
    ) {
      const student =
        await Student.findById(
          payload.sub
        )
          .lean()
          .exec();

      if (!student) {
        return null;
      }

      if (
        student.loginEnabled !== true
      ) {
        return null;
      }

      if (
        student.emailVerified !== true
      ) {
        return null;
      }

      if (
        isStudentExpired(student)
      ) {
        return null;
      }

      return sanitizeStudent(
        student
      );
    }

    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    if (
      payload.role === "admin"
    ) {
      const admin =
        await Admin.findById(
          payload.sub
        )
          .lean()
          .exec();

      if (!admin) {
        return null;
      }

      if (
        admin.isActive !== true
      ) {
        return null;
      }

      if (
        isAdminLocked(admin)
      ) {
        return null;
      }

      return sanitizeAdmin(
        admin
      );
    }

    return null;
  } catch (error) {
    console.error(
      "[CyberNet Auth] Session verification error:",
      error
    );

    return null;
  }
}

// ============================================================
// TOKEN
// ============================================================

export function verifyAuthToken(
  token: string
) {
  return verifyAccessToken(token);
}

// ============================================================
// ROLE HELPERS
// ============================================================

export function isAdminUser(
  user: AuthUser | null
): boolean {
  return user?.role === "admin";
}

export function isStudentUser(
  user: AuthUser | null
): boolean {
  return user?.role === "student";
}

export function isSuperAdmin(
  user: AuthUser | null
): boolean {
  return (
    user?.role === "admin" &&
    user.adminRole === "Super Admin"
  );
}

export function hasAdminRole(
  user: AuthUser | null,
  roles: AdminRole[]
): boolean {
  if (
    !user ||
    user.role !== "admin" ||
    !user.adminRole
  ) {
    return false;
  }

  return roles.includes(
    user.adminRole
  );
}

// ============================================================
// PERMISSIONS
// ============================================================

export function hasPermission(
  user: AuthUser | null,
  permission: string
): boolean {
  if (
    !user ||
    user.role !== "admin"
  ) {
    return false;
  }

  if (
    user.adminRole ===
    "Super Admin"
  ) {
    return true;
  }

  return (
    user.permissions?.[
      permission
    ] === true
  );
}

// ============================================================
// LOGOUT
// ============================================================

export async function logout(): Promise<{
  success: true;
  message: string;
}> {
  return {
    success: true,
    message:
      "Logout successful.",
  };
}

// ============================================================
// CONFIG
// ============================================================

export const AUTH_CONFIG = {
  sessionDurationSeconds:
    SESSION_DURATION_SECONDS,

  maxAdminLoginAttempts:
    MAX_ADMIN_LOGIN_ATTEMPTS,

  adminLockDurationMs:
    ADMIN_LOCK_DURATION_MS,
} as const;