import "server-only";

import {
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

/**
 * CyberNet Careers authentication core.
 *
 * Server-only primitives for password hashing, signed access tokens,
 * session separation, cookie configuration, and authorization helpers.
 *
 * Route handlers must still authorize each request and validate the
 * session type appropriate for the requested portal.
 */

export const runtime = "nodejs";

export type AuthRole = "student" | "admin";

export type AdminRole =
  | "Super Admin"
  | "Admin"
  | "HR"
  | "Assessment Manager"
  | "Support"
  | "Student Operations Admin";

export type AuthSessionType =
  | "legacy"
  | "admin"
  | "student"
  | "student-dashboard";

export interface AuthPayload {
  sub: string;
  userId: string;
  role: AuthRole;
  identifier: string;
  adminRole?: AdminRole;
  sessionType: AuthSessionType;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthUser {
  id: string;
  identifier: string;
  role: AuthRole;
  adminRole?: AdminRole;
  sessionType?: AuthSessionType;
  sessionId?: string;
}

type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

const TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const MAX_TOKEN_LENGTH = 8192;
const CLOCK_SKEW_SECONDS = 60;
const MAX_IDENTIFIER_LENGTH = 254;
const MAX_ID_LENGTH = 128;
const MAX_SCRYPT_N = 1_048_576;
const MAX_SCRYPT_R = 32;
const MAX_SCRYPT_P = 16;

const AUTH_SECRET =
  process.env.AUTH_SECRET?.trim() ||
  process.env.JWT_SECRET?.trim() ||
  "";

const JWT_HEADER = {
  alg: "HS256",
  typ: "JWT",
} as const;

const VALID_ADMIN_ROLES: readonly AdminRole[] = [
  "Super Admin",
  "Admin",
  "HR",
  "Assessment Manager",
  "Support",
  "Student Operations Admin",
];

const VALID_SESSION_TYPES: readonly AuthSessionType[] = [
  "legacy",
  "admin",
  "student",
  "student-dashboard",
];

function getAuthSecret(): string {
  if (!AUTH_SECRET) {
    throw new Error("AUTH_SECRET is missing. Add AUTH_SECRET to .env.local.");
  }

  if (AUTH_SECRET.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }

  return AUTH_SECRET;
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function isBase64Url(value: string): boolean {
  return value.length > 0 && /^[A-Za-z0-9_-]+$/.test(value);
}

function base64UrlDecode(value: string): Buffer {
  if (!isBase64Url(value)) {
    throw new Error("Invalid base64url value.");
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  if (remainder === 1) {
    throw new Error("Invalid base64url length.");
  }

  const padding = remainder === 0 ? "" : "=".repeat(4 - remainder);
  const decoded = Buffer.from(normalized + padding, "base64");

  // Reject non-canonical encodings and Node's permissive base64 parsing.
  if (base64UrlEncode(decoded) !== value) {
    throw new Error("Invalid base64url encoding.");
  }

  return decoded;
}

function signValue(value: string): Buffer {
  return createHmac("sha256", getAuthSecret()).update(value, "utf8").digest();
}

function createTokenId(): string {
  return randomBytes(24).toString("hex");
}

function validatePasswordInput(password: string): void {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password is required.");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`);
  }
}

function isValidAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === "string" &&
    VALID_ADMIN_ROLES.includes(value as AdminRole)
  );
}

function isValidSessionType(value: unknown): value is AuthSessionType {
  return (
    typeof value === "string" &&
    VALID_SESSION_TYPES.includes(value as AuthSessionType)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/**
 * Produces a salted scrypt hash in the format:
 * scrypt$N$r$p$salt$key
 */
export async function hashPassword(password: string): Promise<string> {
  validatePasswordInput(password);

  const salt = randomBytes(32);
  const derivedKey = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    base64UrlEncode(salt),
    base64UrlEncode(derivedKey),
  ].join("$");
}

/**
 * Verifies supported scrypt hashes without throwing for malformed hashes.
 * Passwords are never trimmed or normalized.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 1024 ||
    typeof storedHash !== "string" ||
    storedHash.length > 4096
  ) {
    return false;
  }

  try {
    const parts = storedHash.split("$");
    if (parts.length !== 6) return false;

    const [algorithm, nString, rString, pString, saltEncoded, hashEncoded] = parts;
    if (algorithm !== "scrypt") return false;

    const N = Number(nString);
    const r = Number(rString);
    const p = Number(pString);

    if (
      !Number.isSafeInteger(N) ||
      !Number.isSafeInteger(r) ||
      !Number.isSafeInteger(p) ||
      N < 2 ||
      (N & (N - 1)) !== 0 ||
      N > MAX_SCRYPT_N ||
      r < 1 ||
      r > MAX_SCRYPT_R ||
      p < 1 ||
      p > MAX_SCRYPT_P
    ) {
      return false;
    }

    const salt = base64UrlDecode(saltEncoded);
    const storedKey = base64UrlDecode(hashEncoded);

    if (salt.length < 16 || salt.length > 128) return false;
    if (storedKey.length < 16 || storedKey.length > 128) return false;

    // Refuse parameters whose estimated memory cost exceeds our configured cap.
    const estimatedMemory = 128 * N * r + 256 * r * p;
    if (!Number.isSafeInteger(estimatedMemory) || estimatedMemory > SCRYPT_MAXMEM) {
      return false;
    }

    const derivedKey = await scryptAsync(password, salt, storedKey.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });

    return (
      derivedKey.length === storedKey.length &&
      timingSafeEqual(derivedKey, storedKey)
    );
  } catch {
    return false;
  }
}

export function createAccessToken(input: {
  id: string;
  identifier: string;
  role: AuthRole;
  adminRole?: AdminRole;
  sessionType?: AuthSessionType;
}): string {
  if (!input || typeof input !== "object") {
    throw new Error("Authentication input is required.");
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  const identifier =
    typeof input.identifier === "string" ? input.identifier.trim() : "";

  if (!id || id.length > MAX_ID_LENGTH) {
    throw new Error("A valid authentication user ID is required.");
  }
  if (!identifier || identifier.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error("A valid authentication identifier is required.");
  }
  if (input.role !== "student" && input.role !== "admin") {
    throw new Error("Invalid authentication role.");
  }

  if (input.role === "admin") {
    if (!isValidAdminRole(input.adminRole)) {
      throw new Error("A valid admin role is required for admin sessions.");
    }
  } else if (input.adminRole !== undefined) {
    throw new Error("Student tokens cannot contain an admin role.");
  }

  const sessionType =
    input.sessionType ?? (input.role === "admin" ? "admin" : "student");

  if (!isValidSessionType(sessionType)) {
    throw new Error("Invalid authentication session type.");
  }
  if (input.role === "admin" && sessionType !== "admin" && sessionType !== "legacy") {
    throw new Error("Admin authentication must use an admin session.");
  }
  if (input.role === "student" && sessionType === "admin") {
    throw new Error("Student authentication cannot use an admin session.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: AuthPayload = {
    sub: id,
    userId: id,
    role: input.role,
    identifier,
    ...(input.role === "admin" ? { adminRole: input.adminRole } : {}),
    sessionType,
    iat: now,
    exp: now + TOKEN_EXPIRES_IN_SECONDS,
    jti: createTokenId(),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(JWT_HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlEncode(signValue(unsignedToken));

  return `${unsignedToken}.${signature}`;
}

/**
 * Validates token structure, signature, claims, session type and expiry.
 * Returns null for invalid tokens.
 */
export function verifyAccessToken(token: string): AuthPayload | null {
  try {
    if (
      typeof token !== "string" ||
      token.length === 0 ||
      token.length > MAX_TOKEN_LENGTH
    ) {
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, providedSignature] = parts;
    if (
      !isBase64Url(encodedHeader) ||
      !isBase64Url(encodedPayload) ||
      !isBase64Url(providedSignature)
    ) {
      return null;
    }

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = signValue(unsignedToken);
    const actualSignature = base64UrlDecode(providedSignature);

    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return null;
    }

    const headerValue: unknown = JSON.parse(
      base64UrlDecode(encodedHeader).toString("utf8"),
    );
    if (!isPlainObject(headerValue)) return null;
    if (headerValue.alg !== "HS256" || headerValue.typ !== "JWT") return null;

    const payloadValue: unknown = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8"),
    );
    if (!isPlainObject(payloadValue)) return null;

    const payload = payloadValue;
    const sub = payload.sub;
    const userId = payload.userId;
    const identifier = payload.identifier;
    const role = payload.role;
    const adminRole = payload.adminRole;
    const sessionTypeValue = payload.sessionType;
    const iat = payload.iat;
    const exp = payload.exp;
    const jti = payload.jti;

    if (
      typeof sub !== "string" ||
      !sub ||
      sub.length > MAX_ID_LENGTH ||
      typeof userId !== "string" ||
      userId !== sub ||
      typeof identifier !== "string" ||
      !identifier ||
      identifier.length > MAX_IDENTIFIER_LENGTH
    ) {
      return null;
    }

    if (role !== "student" && role !== "admin") return null;
    if (
      typeof iat !== "number" ||
      !Number.isSafeInteger(iat) ||
      typeof exp !== "number" ||
      !Number.isSafeInteger(exp) ||
      typeof jti !== "string" ||
      !/^[a-f0-9]{48}$/.test(jti)
    ) {
      return null;
    }

    if (role === "admin") {
      if (!isValidAdminRole(adminRole)) return null;
    } else if (adminRole !== undefined) {
      return null;
    }

    // Legacy tokens without sessionType remain readable during migration.
    const sessionType: AuthSessionType =
      sessionTypeValue === undefined
        ? role === "admin"
          ? "legacy"
          : "student"
        : isValidSessionType(sessionTypeValue)
          ? sessionTypeValue
          : (null as never);

    if (!sessionType) return null;
    if (role === "admin" && sessionType !== "admin" && sessionType !== "legacy") {
      return null;
    }
    if (role === "student" && sessionType === "admin") return null;

    const now = Math.floor(Date.now() / 1000);
    if (
      exp <= now ||
      iat > now + CLOCK_SKEW_SECONDS ||
      exp <= iat ||
      exp - iat > TOKEN_EXPIRES_IN_SECONDS
    ) {
      return null;
    }

    return {
      sub,
      userId,
      role,
      identifier,
      ...(role === "admin" ? { adminRole: adminRole as AdminRole } : {}),
      sessionType,
      iat,
      exp,
      jti,
    };
  } catch {
    return null;
  }
}

export async function verifyAuthToken(token: string): Promise<AuthUser | null> {
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  return {
    id: payload.sub,
    identifier: payload.identifier,
    role: payload.role,
    ...(payload.adminRole ? { adminRole: payload.adminRole } : {}),
    sessionType: payload.sessionType,
    sessionId: payload.jti,
  };
}

export function getAuthUserFromToken(token: string): AuthUser | null {
  const payload = verifyAccessToken(token);
  if (!payload) return null;

  return {
    id: payload.sub,
    identifier: payload.identifier,
    role: payload.role,
    ...(payload.adminRole ? { adminRole: payload.adminRole } : {}),
    sessionType: payload.sessionType,
    sessionId: payload.jti,
  };
}

export function getTokenExpiryDate(token: string): Date | null {
  const payload = verifyAccessToken(token);
  return payload ? new Date(payload.exp * 1000) : null;
}

/** Legacy cookie retained for routes that have not yet migrated. */
export const AUTH_COOKIE_NAME = "cybernet_auth_token";

/** Dedicated cookies prevent the portals from overwriting each other's sessions. */
export const ADMIN_AUTH_COOKIE_NAME = "cybernet_admin_auth_token";
export const STUDENT_AUTH_COOKIE_NAME = "cybernet_student_auth_token";
export const STUDENT_DASHBOARD_AUTH_COOKIE_NAME =
  "cybernet_student_dashboard_token";

export function getAuthCookieName(sessionType: AuthSessionType): string {
  switch (sessionType) {
    case "admin":
      return ADMIN_AUTH_COOKIE_NAME;
    case "student":
      return STUDENT_AUTH_COOKIE_NAME;
    case "student-dashboard":
      return STUDENT_DASHBOARD_AUTH_COOKIE_NAME;
    case "legacy":
    default:
      return AUTH_COOKIE_NAME;
  }
}

export function getSessionTypeFromCookieName(
  cookieName: string,
): AuthSessionType | null {
  switch (cookieName) {
    case ADMIN_AUTH_COOKIE_NAME:
      return "admin";
    case STUDENT_AUTH_COOKIE_NAME:
      return "student";
    case STUDENT_DASHBOARD_AUTH_COOKIE_NAME:
      return "student-dashboard";
    case AUTH_COOKIE_NAME:
      return "legacy";
    default:
      return null;
  }
}

function buildCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_EXPIRES_IN_SECONDS,
  };
}

export const AUTH_COOKIE_OPTIONS = buildCookieOptions();
export const ADMIN_AUTH_COOKIE_OPTIONS = buildCookieOptions();
export const STUDENT_AUTH_COOKIE_OPTIONS = buildCookieOptions();
export const STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS = buildCookieOptions();

export function getAuthCookieOptions(
  sessionType: AuthSessionType,
): CookieOptions {
  switch (sessionType) {
    case "admin":
      return ADMIN_AUTH_COOKIE_OPTIONS;
    case "student":
      return STUDENT_AUTH_COOKIE_OPTIONS;
    case "student-dashboard":
      return STUDENT_DASHBOARD_AUTH_COOKIE_OPTIONS;
    case "legacy":
    default:
      return AUTH_COOKIE_OPTIONS;
  }
}

export const AUTH_TOKEN_EXPIRES_IN_SECONDS = TOKEN_EXPIRES_IN_SECONDS;

export function isStudent(user: AuthUser | null): boolean {
  return user?.role === "student";
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

export function isStudentSession(user: AuthUser | null): boolean {
  return user?.role === "student" && user.sessionType === "student";
}

export function isStudentDashboardSession(user: AuthUser | null): boolean {
  return (
    user?.role === "student" &&
    user.sessionType === "student-dashboard"
  );
}

export function isAdminSession(user: AuthUser | null): boolean {
  return user?.role === "admin" && user.sessionType === "admin";
}

export function hasSessionType(
  user: AuthUser | null,
  sessionType: AuthSessionType,
): boolean {
  return user !== null && user.sessionType === sessionType;
}

export function isCompatibleLegacySession(user: AuthUser | null): boolean {
  return user !== null && user.sessionType === "legacy";
}

export function hasAdminRole(
  user: AuthUser | null,
  roles: AdminRole[],
): boolean {
  return (
    user !== null &&
    user.role === "admin" &&
    user.adminRole !== undefined &&
    roles.includes(user.adminRole)
  );
}

export function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin" && user.adminRole === "Super Admin";
}

export function shouldRefreshToken(token: string): boolean {
  const payload = verifyAccessToken(token);
  if (!payload) return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now <= 60 * 60 * 24;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Authentication failed.";
}
