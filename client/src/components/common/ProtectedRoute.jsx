import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/*
|--------------------------------------------------------------------------
| Storage Keys
|--------------------------------------------------------------------------
*/

const TOKEN_KEYS = [
  "token",
  "authToken",
  "cybernet_token",
];

const USER_KEYS = [
  "user",
  "student",
  "admin",
];

const ROLE_KEYS = [
  "userRole",
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const getStorageValue = (key) =>
  sessionStorage.getItem(key) ||
  localStorage.getItem(key);

const getToken = () => {
  for (const key of TOKEN_KEYS) {
    const token = getStorageValue(key);
    if (token) return token;
  }
  return null;
};

const clearAuthStorage = () => {
  [...TOKEN_KEYS, ...USER_KEYS, ...ROLE_KEYS].forEach(
    (key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  );
};

const decodeToken = (token) => {
  try {
    if (!token) return null;

    const payload = token.split(".")[1];

    if (!payload) return null;

    const base64 =
      payload.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (payload.length % 4)) % 4);

    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

const isTokenExpired = (payload) => {
  if (!payload?.exp) return false;
  return Date.now() >= payload.exp * 1000;
};

const getRole = (payload) => {
  return (
    payload?.role ||
    getStorageValue("userRole") ||
    "student"
  );
};

/*
|--------------------------------------------------------------------------
| Loader
|--------------------------------------------------------------------------
*/

export function AuthLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-12 w-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-slate-500">
          Verifying Session...
        </p>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Protected Route
|--------------------------------------------------------------------------
*/

function ProtectedRoute({
  children,
  allowedRoles = ["student", "admin", "mentor"],
  redirectTo = "/login",
}) {
  const location = useLocation();

  const token = getToken();

  if (!token) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location }}
      />
    );
  }

  const payload = decodeToken(token);

  if (!payload) {
    clearAuthStorage();

    return (
      <Navigate
        to={redirectTo}
        replace
      />
    );
  }

  if (isTokenExpired(payload)) {
    clearAuthStorage();

    return (
      <Navigate
        to={redirectTo}
        replace
      />
    );
  }

  const role = getRole(payload);

  if (
    allowedRoles.length &&
    !allowedRoles.includes(role)
  ) {
    return (
      <Navigate
        to={
          role === "admin"
            ? "/admin/dashboard"
            : "/student/dashboard"
        }
        replace
      />
    );
  }

  return children;
}

/*
|--------------------------------------------------------------------------
| Role Wrappers
|--------------------------------------------------------------------------
*/

export const AdminRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={["admin"]}>
    {children}
  </ProtectedRoute>
);

export const StudentRoute = ({
  children,
}) => (
  <ProtectedRoute allowedRoles={["student"]}>
    {children}
  </ProtectedRoute>
);

export const MentorRoute = ({
  children,
}) => (
  <ProtectedRoute allowedRoles={["mentor"]}>
    {children}
  </ProtectedRoute>
);

export default ProtectedRoute;