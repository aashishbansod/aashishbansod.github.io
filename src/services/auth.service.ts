import "server-only";

import StudentModel from "@/models/Student";
import AdminModel from "@/models/Admin";
import connectDB from "@/lib/db";
import {
  createAccessToken,
  verifyAccessToken,
  verifyPassword,
  hashPassword,
  AUTH_TOKEN_EXPIRES_IN_SECONDS,
  type AuthUser as CoreAuthUser,
  type AdminRole,
  type AuthSessionType,
} from "@/lib/auth";

export interface LoginInput {
  identifier: string;
  password: string;
}

export type AuthenticationMode = "admin" | "student" | "student-dashboard";

export interface AuthUser {
  id: string;
  userType: "student" | "admin";
  identifier: string;
  fullName: string;
  email: string;
  role?: string;
  studentId?: string;
  dashboardStudentId?: string;
  adminId?: string;
  phone?: string;
  isEmailVerified?: boolean;
  authenticationMode?: AuthenticationMode;
  applicationStatus?: string;
  assessmentStatus?: string;
  resultStatus?: string;
  internshipStatus?: string;
  paymentStatus?: string;
  adminApprovalStatus?: string;
  studentOpsApprovalStatus?: string;
  studentOpsStatus?: string;
  dashboardStatus?: string;
  loginEnabled?: boolean;
  credentialsGenerated?: boolean;
  dashboardLoginEnabled?: boolean;
  dashboardCredentialsGenerated?: boolean;
}

export interface LoginSuccess {
  success: true;
  message: string;
  user: AuthUser;
  token: string;
  expiresIn: number;
}

export interface LoginFailure {
  success: false;
  message: string;
  code: string;
  retryAfter?: number;
}

export type LoginResult = LoginSuccess | LoginFailure;

export const AUTH_SESSION_MAX_AGE = AUTH_TOKEN_EXPIRES_IN_SECONDS;

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;
const MAX_IDENTIFIER_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 120;
const REQUIRE_EMAIL_VERIFICATION =
  process.env.REQUIRE_EMAIL_VERIFICATION === "true";

type DatabaseRecord = Record<string, unknown>;

const VALID_ADMIN_ROLES: readonly AdminRole[] = [
  "Super Admin",
  "Admin",
  "HR",
  "Assessment Manager",
  "Support",
  "Student Operations Admin",
];

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeString(value: unknown, fallback = ""): string {
  return stringValue(value) || fallback;
}

function idString(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return String(value);
  } catch {
    return "";
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAdminId(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeStudentId(value: string): string {
  return value.trim().toUpperCase();
}

function asRecord(value: unknown): DatabaseRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as DatabaseRecord)
    : {};
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedStatus(value: unknown): string {
  return stringValue(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function isStatus(value: unknown, ...allowed: string[]): boolean {
  const status = normalizedStatus(value);
  return allowed.some((candidate) => normalizedStatus(candidate) === status);
}

function normalizeAdminRole(value: unknown): AdminRole {
  const role = stringValue(value);
  return VALID_ADMIN_ROLES.includes(role as AdminRole)
    ? (role as AdminRole)
    : "Admin";
}

function isStudentOperationsAdmin(value: unknown): boolean {
  return normalizeAdminRole(value) === "Student Operations Admin";
}

export async function hashUserPassword(password: string): Promise<string> {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error(
      `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
    );
  }
  return hashPassword(password);
}

export async function verifyUserPassword(
  password: string,
  storedPassword: string,
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH ||
    typeof storedPassword !== "string" ||
    !storedPassword
  ) {
    return false;
  }

  try {
    return await verifyPassword(password, storedPassword);
  } catch {
    // Never log passwords, password hashes, or raw authentication input.
    return false;
  }
}

function getAdminSecurity(admin: DatabaseRecord): DatabaseRecord {
  return asRecord(admin.security);
}

function isLocked(lockedFlag: unknown, lockedUntilValue: unknown): boolean {
  if (lockedFlag !== true) return false;
  const lockedUntil = dateValue(lockedUntilValue);
  // A lock without a valid expiry remains locked until safely cleared.
  return !lockedUntil || lockedUntil.getTime() > Date.now();
}

function lockRemaining(lockedUntilValue: unknown): number {
  const lockedUntil = dateValue(lockedUntilValue);
  if (!lockedUntil) return Math.ceil(LOCK_TIME_MS / 1000);
  return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
}

function adminIsLocked(admin: DatabaseRecord): boolean {
  const security = getAdminSecurity(admin);
  return isLocked(security.accountLocked, security.lockedUntil);
}

function studentMainIsLocked(student: DatabaseRecord): boolean {
  return isLocked(student.accountLocked, student.lockedUntil);
}

function dashboardIsLocked(student: DatabaseRecord): boolean {
  return isLocked(student.dashboardAccountLocked, student.dashboardLockedUntil);
}

async function clearExpiredAdminLock(admin: DatabaseRecord): Promise<void> {
  const security = getAdminSecurity(admin);
  if (security.accountLocked !== true) return;
  const until = dateValue(security.lockedUntil);
  if (until && until.getTime() > Date.now()) return;

  await AdminModel.updateOne(
    { _id: admin._id, "security.accountLocked": true },
    {
      $set: {
        "security.accountLocked": false,
        "security.lockedUntil": null,
        "security.loginAttempts": 0,
      },
    },
    { runValidators: true },
  ).exec();
}

async function clearExpiredStudentMainLock(
  student: DatabaseRecord,
): Promise<void> {
  if (student.accountLocked !== true) return;
  const until = dateValue(student.lockedUntil);
  if (until && until.getTime() > Date.now()) return;

  await StudentModel.updateOne(
    { _id: student._id, accountLocked: true },
    { $set: { accountLocked: false, lockedUntil: null, loginAttempts: 0 } },
    { runValidators: true },
  ).exec();
}

async function clearExpiredDashboardLock(
  student: DatabaseRecord,
): Promise<void> {
  if (student.dashboardAccountLocked !== true) return;
  const until = dateValue(student.dashboardLockedUntil);
  if (until && until.getTime() > Date.now()) return;

  await StudentModel.updateOne(
    { _id: student._id, dashboardAccountLocked: true },
    {
      $set: {
        dashboardAccountLocked: false,
        dashboardLockedUntil: null,
        dashboardLoginAttempts: 0,
      },
    },
    { runValidators: true },
  ).exec();
}

function sanitizeAdmin(admin: DatabaseRecord): AuthUser {
  const adminId = normalizeAdminId(stringValue(admin.adminId));
  const email = normalizeEmail(stringValue(admin.email));
  return {
    id: idString(admin._id),
    userType: "admin",
    identifier: adminId || email,
    fullName: safeString(admin.fullName || admin.name, "CyberNet Admin").slice(
      0,
      MAX_NAME_LENGTH,
    ),
    email,
    ...(adminId ? { adminId } : {}),
    role: normalizeAdminRole(admin.role),
    ...(stringValue(admin.phone) ? { phone: stringValue(admin.phone) } : {}),
    isEmailVerified: admin.isEmailVerified === true,
    authenticationMode: "admin",
  };
}

function sanitizeStudent(
  student: DatabaseRecord,
  mode: "student" | "student-dashboard",
): AuthUser {
  const studentId = normalizeStudentId(stringValue(student.studentId));
  const dashboardStudentId = normalizeStudentId(
    stringValue(student.dashboardStudentId),
  );
  const email = normalizeEmail(stringValue(student.email));

  return {
    id: idString(student._id),
    userType: "student",
    identifier:
      mode === "student-dashboard"
        ? dashboardStudentId || email
        : studentId || email,
    fullName: safeString(student.fullName || student.name, "Student").slice(
      0,
      MAX_NAME_LENGTH,
    ),
    email,
    ...(studentId ? { studentId } : {}),
    ...(dashboardStudentId ? { dashboardStudentId } : {}),
    ...(stringValue(student.phone) ? { phone: stringValue(student.phone) } : {}),
    isEmailVerified: student.emailVerified === true,
    authenticationMode: mode,
    applicationStatus: stringValue(student.applicationStatus),
    assessmentStatus: stringValue(student.assessmentStatus),
    resultStatus: stringValue(student.resultStatus),
    internshipStatus: stringValue(student.internshipStatus),
    paymentStatus: stringValue(student.paymentStatus),
    adminApprovalStatus: stringValue(student.adminApprovalStatus),
    studentOpsApprovalStatus: stringValue(student.studentOpsApprovalStatus),
    studentOpsStatus: stringValue(student.studentOpsStatus),
    dashboardStatus: stringValue(student.dashboardStatus),
    loginEnabled: student.loginEnabled === true,
    credentialsGenerated: student.credentialsGenerated === true,
    dashboardLoginEnabled: student.dashboardLoginEnabled === true,
    dashboardCredentialsGenerated: student.dashboardCredentialsGenerated === true,
  };
}

async function findAdmin(identifier: string): Promise<DatabaseRecord | null> {
  const email = normalizeEmail(identifier);
  const adminId = normalizeAdminId(identifier);
  const admin = await AdminModel.findOne({ $or: [{ adminId }, { email }] })
    .select("+password")
    .lean()
    .exec();
  return admin ? asRecord(admin) : null;
}

async function findStudentForMainLogin(
  identifier: string,
): Promise<DatabaseRecord | null> {
  const email = normalizeEmail(identifier);
  const studentId = normalizeStudentId(identifier);
  const student = await StudentModel.findOne({ $or: [{ studentId }, { email }] })
    .select("+loginPasswordHash")
    .lean()
    .exec();
  return student ? asRecord(student) : null;
}

async function findStudentForDashboardLogin(
  identifier: string,
): Promise<DatabaseRecord | null> {
  const email = normalizeEmail(identifier);
  const dashboardStudentId = normalizeStudentId(identifier);
  const student = await StudentModel.findOne({
    $or: [{ dashboardStudentId }, { email }],
  })
    .select("+dashboardPasswordHash")
    .lean()
    .exec();
  return student ? asRecord(student) : null;
}

function getAdminPasswordHash(admin: DatabaseRecord): string {
  return stringValue(admin.password);
}

function getStudentMainPasswordHash(student: DatabaseRecord): string {
  return stringValue(student.loginPasswordHash);
}

function getStudentDashboardPasswordHash(student: DatabaseRecord): string {
  return stringValue(student.dashboardPasswordHash);
}

async function updateAdminLogin(admin: DatabaseRecord): Promise<void> {
  await AdminModel.updateOne(
    { _id: admin._id },
    {
      $set: {
        lastLogin: new Date(),
        "security.loginAttempts": 0,
        "security.accountLocked": false,
        "security.lockedUntil": null,
      },
      $inc: { loginCount: 1 },
    },
    { runValidators: true },
  ).exec();
}

async function updateStudentMainLogin(student: DatabaseRecord): Promise<void> {
  await StudentModel.updateOne(
    { _id: student._id },
    {
      $set: {
        lastLoginAt: new Date(),
        loginAttempts: 0,
        accountLocked: false,
        lockedUntil: null,
      },
    },
    { runValidators: true },
  ).exec();
}

async function updateStudentDashboardLogin(
  student: DatabaseRecord,
): Promise<void> {
  await StudentModel.updateOne(
    { _id: student._id },
    {
      $set: {
        dashboardLastLoginAt: new Date(),
        dashboardLoginAttempts: 0,
        dashboardAccountLocked: false,
        dashboardLockedUntil: null,
      },
    },
    { runValidators: true },
  ).exec();
}

async function registerFailedLogin(
  kind: "admin" | "student" | "dashboard",
  record: DatabaseRecord,
): Promise<{ locked: boolean; retryAfter: number }> {
  const attemptsField =
    kind === "admin"
      ? "security.loginAttempts"
      : kind === "dashboard"
        ? "dashboardLoginAttempts"
        : "loginAttempts";
  const lockField =
    kind === "admin"
      ? "security.accountLocked"
      : kind === "dashboard"
        ? "dashboardAccountLocked"
        : "accountLocked";
  const untilField =
    kind === "admin"
      ? "security.lockedUntil"
      : kind === "dashboard"
        ? "dashboardLockedUntil"
        : "lockedUntil";

  const security = getAdminSecurity(record);
  const currentAttempts = numberValue(
    kind === "admin" ? security.loginAttempts : record[attemptsField],
  );
  const nextAttempts = Math.max(0, Math.floor(currentAttempts)) + 1;
  const locked = nextAttempts >= MAX_LOGIN_ATTEMPTS;
  const update = {
    $set: {
      [attemptsField]: nextAttempts,
      ...(locked
        ? {
            [lockField]: true,
            [untilField]: new Date(Date.now() + LOCK_TIME_MS),
          }
        : {}),
    },
  };

  if (kind === "admin") {
    await AdminModel.updateOne({ _id: record._id }, update).exec();
  } else {
    await StudentModel.updateOne({ _id: record._id }, update).exec();
  }

  return {
    locked,
    retryAfter: locked ? Math.ceil(LOCK_TIME_MS / 1000) : 0,
  };
}

function invalidCredentials(): LoginFailure {
  return {
    success: false,
    message: "Invalid credentials.",
    code: "INVALID_CREDENTIALS",
  };
}

function validateLoginInput(
  input: LoginInput,
):
  | { valid: true; identifier: string; password: string }
  | { valid: false; result: LoginFailure } {
  const identifier =
    typeof input?.identifier === "string" ? input.identifier.trim() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  if (!identifier || !password) {
    return {
      valid: false,
      result: {
        success: false,
        message: "Login identifier and password are required.",
        code: "INVALID_INPUT",
      },
    };
  }

  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    return {
      valid: false,
      result: {
        success: false,
        message: "Invalid login identifier.",
        code: "INVALID_IDENTIFIER",
      },
    };
  }

  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return {
      valid: false,
      result: {
        success: false,
        message: "Invalid password.",
        code: "INVALID_PASSWORD",
      },
    };
  }

  return { valid: true, identifier, password };
}

function failure(message: string, code: string): LoginFailure {
  return { success: false, message, code };
}

function getSessionTypeForUser(user: AuthUser): AuthSessionType {
  if (user.userType === "admin") return "admin";
  return user.authenticationMode === "student-dashboard"
    ? "student-dashboard"
    : "student";
}

function createUserToken(user: AuthUser): string {
  if (!user.id || !user.identifier) {
    throw new Error("Cannot create a session without a user ID and identifier.");
  }

  const coreUser: CoreAuthUser = {
    id: user.id,
    identifier: user.identifier,
    role: user.userType,
    ...(user.userType === "admin"
      ? { adminRole: normalizeAdminRole(user.role) }
      : {}),
    sessionType: getSessionTypeForUser(user),
  };

  return createAccessToken(coreUser);
}

async function authenticateAdmin(
  admin: DatabaseRecord,
  password: string,
): Promise<LoginResult> {
  await clearExpiredAdminLock(admin);

  if (admin.isActive === false) {
    return failure("This admin account is inactive.", "ACCOUNT_DISABLED");
  }

  if (adminIsLocked(admin)) {
    const security = getAdminSecurity(admin);
    return {
      success: false,
      message: "Admin account is temporarily locked.",
      code: "ACCOUNT_TEMPORARILY_LOCKED",
      retryAfter: lockRemaining(security.lockedUntil),
    };
  }

  const storedPassword = getAdminPasswordHash(admin);
  if (!storedPassword) {
    return failure(
      "Admin account credentials are not configured correctly.",
      "AUTHENTICATION_ERROR",
    );
  }

  if (!(await verifyUserPassword(password, storedPassword))) {
    const failed = await registerFailedLogin("admin", admin);
    if (failed.locked) {
      return {
        success: false,
        message: "Admin account locked after multiple failed attempts.",
        code: "ACCOUNT_TEMPORARILY_LOCKED",
        retryAfter: failed.retryAfter,
      };
    }
    return invalidCredentials();
  }

  const user = sanitizeAdmin(admin);
  if (!user.id || !user.identifier || !user.email) {
    return failure("Admin account is not configured correctly.", "AUTHENTICATION_ERROR");
  }

  await updateAdminLogin(admin);
  return {
    success: true,
    message: isStudentOperationsAdmin(user.role)
      ? "Student Operations Admin login successful."
      : "Admin login successful.",
    user,
    token: createUserToken(user),
    expiresIn: AUTH_SESSION_MAX_AGE,
  };
}

function validateMainStudentWorkflow(student: DatabaseRecord): LoginFailure | null {
  if (REQUIRE_EMAIL_VERIFICATION && student.emailVerified !== true) {
    return failure("Please verify your email before signing in.", "EMAIL_NOT_VERIFIED");
  }

  if (student.applicationStatus && !isStatus(student.applicationStatus, "approved")) {
    if (isStatus(student.applicationStatus, "pending", "submitted", "under review")) {
      return failure(
        "Your application is still awaiting Main Admin approval.",
        "APPLICATION_PENDING",
      );
    }
    if (isStatus(student.applicationStatus, "rejected")) {
      return failure("Your application has been rejected.", "APPLICATION_REJECTED");
    }
    return failure("Your application is not approved yet.", "APPLICATION_NOT_APPROVED");
  }

  if (student.credentialsGenerated !== true) {
    return failure("Student credentials have not been generated yet.", "CREDENTIALS_NOT_GENERATED");
  }
  if (student.loginEnabled !== true) {
    return failure("Student login is currently disabled.", "LOGIN_DISABLED");
  }

  const expiresAt = dateValue(student.credentialsExpiresAt);
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return failure(
      "Your student credentials have expired. Please contact the administration.",
      "CREDENTIALS_EXPIRED",
    );
  }
  return null;
}

async function authenticateStudentMain(
  student: DatabaseRecord,
  password: string,
): Promise<LoginResult> {
  await clearExpiredStudentMainLock(student);

  if (student.isActive === false) {
    return failure("This student account is inactive.", "ACCOUNT_DISABLED");
  }
  if (studentMainIsLocked(student)) {
    return {
      success: false,
      message: "Student account is temporarily locked.",
      code: "ACCOUNT_TEMPORARILY_LOCKED",
      retryAfter: lockRemaining(student.lockedUntil),
    };
  }

  const storedPassword = getStudentMainPasswordHash(student);
  if (!storedPassword) {
    return failure("Student account credentials are not configured correctly.", "AUTHENTICATION_ERROR");
  }

  if (!(await verifyUserPassword(password, storedPassword))) {
    const failed = await registerFailedLogin("student", student);
    if (failed.locked) {
      return {
        success: false,
        message: "Student account locked after multiple failed attempts.",
        code: "ACCOUNT_TEMPORARILY_LOCKED",
        retryAfter: failed.retryAfter,
      };
    }
    return invalidCredentials();
  }

  // Check workflow only after password verification to avoid exposing account state.
  const workflowError = validateMainStudentWorkflow(student);
  if (workflowError) return workflowError;

  const user = sanitizeStudent(student, "student");
  if (!user.id || !user.identifier) {
    return failure("Student account is not configured correctly.", "AUTHENTICATION_ERROR");
  }

  await updateStudentMainLogin(student);
  return {
    success: true,
    message: "Student login successful.",
    user,
    token: createUserToken(user),
    expiresIn: AUTH_SESSION_MAX_AGE,
  };
}

async function validateDashboardWorkflow(
  student: DatabaseRecord,
): Promise<LoginFailure | null> {
  if (REQUIRE_EMAIL_VERIFICATION && student.emailVerified !== true) {
    return failure("Please verify your email before accessing the dashboard.", "EMAIL_NOT_VERIFIED");
  }
  if (!isStatus(student.applicationStatus, "approved")) {
    return failure("Your application is not approved.", "APPLICATION_NOT_APPROVED");
  }
  if (
    !isStatus(student.assessmentStatus, "passed", "evaluated") ||
    !isStatus(student.resultStatus, "passed")
  ) {
    return failure(
      "You must pass the required assessment before accessing the internship dashboard.",
      "ASSESSMENT_NOT_PASSED",
    );
  }
  if (!isStatus(student.internshipStatus, "approved", "active", "completed")) {
    return failure("Your internship has not been approved for dashboard access.", "INTERNSHIP_NOT_APPROVED");
  }
  if (!isStatus(student.paymentStatus, "paid")) {
    return failure("Internship payment has not been verified.", "PAYMENT_NOT_VERIFIED");
  }
  if (!isStatus(student.studentOpsApprovalStatus, "approved")) {
    return failure("Student Operations approval is still pending.", "STUDENT_OPS_NOT_APPROVED");
  }
  if (!isStatus(student.studentOpsStatus, "active", "completed", "approved")) {
    return failure("Student Operations account is not active.", "STUDENT_OPS_NOT_ACTIVE");
  }
  if (!isStatus(student.dashboardStatus, "active", "completed")) {
    return failure("Student dashboard is not active.", "DASHBOARD_NOT_ACTIVE");
  }
  if (student.dashboardLoginEnabled !== true) {
    return failure("Dashboard login is disabled.", "DASHBOARD_LOGIN_NOT_ENABLED");
  }
  if (student.dashboardCredentialsGenerated !== true) {
    return failure("Dashboard credentials have not been generated yet.", "DASHBOARD_CREDENTIALS_NOT_GENERATED");
  }

  const expiresAt = dateValue(student.dashboardCredentialsExpiresAt);
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return failure(
      "Dashboard credentials have expired. Please contact Student Operations.",
      "DASHBOARD_CREDENTIALS_EXPIRED",
    );
  }
  return null;
}

export async function loginStudentDashboard(
  input: LoginInput,
): Promise<LoginResult> {
  try {
    const validation = validateLoginInput(input);
    if (!validation.valid) return validation.result;

    await connectDB();
    const student = await findStudentForDashboardLogin(validation.identifier);
    if (!student) return invalidCredentials();

    await clearExpiredDashboardLock(student);
    if (student.isActive === false) {
      return failure("This student account is inactive.", "ACCOUNT_DISABLED");
    }
    if (dashboardIsLocked(student)) {
      return {
        success: false,
        message: "Dashboard account is temporarily locked.",
        code: "DASHBOARD_ACCOUNT_TEMPORARILY_LOCKED",
        retryAfter: lockRemaining(student.dashboardLockedUntil),
      };
    }

    const storedPassword = getStudentDashboardPasswordHash(student);
    if (!storedPassword) {
      return failure("Dashboard credentials are not configured correctly.", "AUTHENTICATION_ERROR");
    }

    if (!(await verifyUserPassword(validation.password, storedPassword))) {
      const failed = await registerFailedLogin("dashboard", student);
      if (failed.locked) {
        return {
          success: false,
          message: "Dashboard account locked after multiple failed attempts.",
          code: "DASHBOARD_ACCOUNT_TEMPORARILY_LOCKED",
          retryAfter: failed.retryAfter,
        };
      }
      return invalidCredentials();
    }

    // Only reveal workflow-specific status after the password is proven.
    const workflowError = await validateDashboardWorkflow(student);
    if (workflowError) return workflowError;

    const user = sanitizeStudent(student, "student-dashboard");
    if (!user.id || !user.identifier) {
      return failure("Student dashboard account is not configured correctly.", "AUTHENTICATION_ERROR");
    }

    await updateStudentDashboardLogin(student);
    return {
      success: true,
      message: "Student dashboard login successful.",
      user,
      token: createUserToken(user),
      expiresIn: AUTH_SESSION_MAX_AGE,
    };
  } catch (error) {
    console.error("[CyberNet Auth] Dashboard login failed.", error);
    return failure("Unable to complete dashboard login.", "INTERNAL_SERVER_ERROR");
  }
}

export async function login(input: LoginInput): Promise<LoginResult> {
  try {
    const validation = validateLoginInput(input);
    if (!validation.valid) return validation.result;

    await connectDB();

    // Admin identities (including Student Operations Admin) are resolved first.
    const admin = await findAdmin(validation.identifier);
    if (admin) return authenticateAdmin(admin, validation.password);

    const student = await findStudentForMainLogin(validation.identifier);
    if (student) {
      const mainHash = getStudentMainPasswordHash(student);
      if (mainHash && (await verifyUserPassword(validation.password, mainHash))) {
        // The password is verified here; authenticateStudentMain re-verifies to
        // keep one self-contained code path and avoid accepting an unverified flag.
        return authenticateStudentMain(student, validation.password);
      }

      // If the main credential didn't match, try the separate dashboard credential.
      // The dashboard service only returns workflow status after password verification.
      const dashboardResult = await loginStudentDashboard(validation);
      if (dashboardResult.success) return dashboardResult;

      await clearExpiredStudentMainLock(student);
      if (studentMainIsLocked(student)) {
        return {
          success: false,
          message: "Student account is temporarily locked.",
          code: "ACCOUNT_TEMPORARILY_LOCKED",
          retryAfter: lockRemaining(student.lockedUntil),
        };
      }

      // Only these results are emitted after the dashboard password has been
      // verified. Other failures (for example, a missing dashboard hash) do not
      // prove that the submitted password was valid for either account.
      const verifiedDashboardWorkflowCodes = new Set([
        "EMAIL_NOT_VERIFIED",
        "APPLICATION_NOT_APPROVED",
        "ASSESSMENT_NOT_PASSED",
        "INTERNSHIP_NOT_APPROVED",
        "PAYMENT_NOT_VERIFIED",
        "STUDENT_OPS_NOT_APPROVED",
        "STUDENT_OPS_NOT_ACTIVE",
        "DASHBOARD_NOT_ACTIVE",
        "DASHBOARD_LOGIN_NOT_ENABLED",
        "DASHBOARD_CREDENTIALS_NOT_GENERATED",
        "DASHBOARD_CREDENTIALS_EXPIRED",
      ]);
      if (verifiedDashboardWorkflowCodes.has(dashboardResult.code)) {
        return dashboardResult;
      }

      const failed = await registerFailedLogin("student", student);
      if (failed.locked) {
        return {
          success: false,
          message: "Student account locked after multiple failed attempts.",
          code: "ACCOUNT_TEMPORARILY_LOCKED",
          retryAfter: failed.retryAfter,
        };
      }
      return invalidCredentials();
    }

    return loginStudentDashboard(validation);
  } catch (error) {
    console.error("[CyberNet Auth] Login failed.", error);
    return failure("Unable to complete login.", "INTERNAL_SERVER_ERROR");
  }
}

export async function canAccessStudentDashboard(
  studentId: string,
): Promise<{ allowed: boolean; code: string; message: string }> {
  try {
    const normalizedId = normalizeStudentId(studentId);
    if (!normalizedId) {
      return {
        allowed: false,
        code: "INVALID_STUDENT_ID",
        message: "Student ID is required.",
      };
    }

    await connectDB();
    const student = await StudentModel.findOne({ studentId: normalizedId })
      .lean()
      .exec();

    if (!student) {
      return {
        allowed: false,
        code: "STUDENT_NOT_FOUND",
        message: "Student account was not found.",
      };
    }

    const record = asRecord(student);
    if (record.isActive === false) {
      return {
        allowed: false,
        code: "ACCOUNT_DISABLED",
        message: "This student account is inactive.",
      };
    }

    const workflowError = await validateDashboardWorkflow(record);
    if (workflowError) {
      return {
        allowed: false,
        code: workflowError.code,
        message: workflowError.message,
      };
    }

    return {
      allowed: true,
      code: "DASHBOARD_ACCESS_GRANTED",
      message: "Student dashboard access granted.",
    };
  } catch (error) {
    console.error("[CyberNet Auth] Dashboard access check failed.", error);
    return {
      allowed: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to verify dashboard access.",
    };
  }
}

export { verifyAccessToken as verifySessionToken };

export function createSessionToken(user: AuthUser): string {
  return createUserToken(user);
}

export function createUserSession(user: AuthUser): {
  token: string;
  expiresIn: number;
} {
  return {
    token: createUserToken(user),
    expiresIn: AUTH_SESSION_MAX_AGE,
  };
}

const authService = {
  login,
  loginStudentDashboard,
  canAccessStudentDashboard,
  createSessionToken,
  createUserSession,
  hashUserPassword,
  verifyUserPassword,
  verifySessionToken: verifyAccessToken,
};

export default authService;
