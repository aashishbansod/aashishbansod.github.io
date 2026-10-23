/**
 * ============================================================
 * CYBERNET CAREERS
 * JWT COMPATIBILITY LAYER
 * ============================================================
 *
 * The actual authentication implementation lives in:
 *
 *     src/lib/auth.ts
 *
 * This file exists so existing imports such as:
 *
 *     @/lib/jwt
 *
 * continue to work without maintaining two JWT systems.
 * ============================================================
 */

export {
  createAccessToken,
  verifyAccessToken,
  getAuthUserFromToken,
  getTokenExpiryDate,
  shouldRefreshToken,
  isStudent,
  isAdmin,
  isSuperAdmin,
  hasAdminRole,
  getAuthErrorMessage,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  AUTH_TOKEN_EXPIRES_IN_SECONDS,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export type {
  AuthPayload,
  AuthUser,
  AuthRole,
  AdminRole,
} from "@/lib/auth";