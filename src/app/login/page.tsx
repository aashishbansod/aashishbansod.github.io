
"use client";

import {
  type FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type LoginMode =
  | "auto"
  | "student"
  | "admin"
  | "student-admin"
  | "student-dashboard";

type LoginStatus = "idle" | "loading" | "error";

type LoginUser = {
  id?: string;
  _id?: string;
  userId?: string;
  role?: string;
  adminRole?: string;
  userType?: string;
  type?: string;
  studentId?: string;
  adminId?: string;
  fullName?: string;
  name?: string;
  email?: string;
  assessmentStatus?: string;
  resultStatus?: string;
  sessionType?: string;
  authenticationMode?: string;
};

type LoginResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  retryAfter?: number;
  user?: LoginUser;
  data?: { user?: LoginUser };
};

const LOGIN_API = "/api/auth/login";
const ADMIN_HOME = "/admin/dashboard";
const OPERATIONS_HOME = "/student-admin/dashboard";
const STUDENT_HOME = "/student";
const ASSESSMENT_HOME = "/student/assessment";
const INTERNSHIPS_HOME = "/student/internships";
const STUDENT_DASHBOARD_HOME = "/student/dashboard";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
const MAX_IDENTIFIER_LENGTH = 254;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isOperationsUser(user: LoginUser): boolean {
  const role = normalize(user.role || user.userType || user.type);
  const adminRole = normalize(user.adminRole);

  const roles = [
    "student operations admin",
    "student operations",
    "student admin",
    "student operations manager",
  ];

  return roles.includes(role) || roles.includes(adminRole);
}

function isAdminUser(user: LoginUser): boolean {
  const role = normalize(user.role || user.userType || user.type);
  const adminRole = normalize(user.adminRole);

  const roles = [
    "admin",
    "super admin",
    "superadmin",
    "hr",
    "assessment manager",
    "support",
  ];

  return roles.includes(role) || roles.includes(adminRole);
}

function isStudentUser(user: LoginUser): boolean {
  const role = normalize(user.role || user.userType || user.type);

  return (
    role === "student" ||
    role === "candidate" ||
    Boolean(cleanString(user.studentId))
  );
}

function isDashboardSession(user: LoginUser): boolean {
  return (
    normalize(user.sessionType) === "student dashboard" ||
    normalize(user.authenticationMode) === "student dashboard"
  );
}

function normalizeMode(value: string | null): LoginMode {
  switch (normalize(value)) {
    case "admin":
      return "admin";

    case "student":
      return "student";

    case "student admin":
    case "student operations":
      return "student-admin";

    case "student dashboard":
      return "student-dashboard";

    default:
      return "auto";
  }
}

function safeInternalPath(value: string | null): string | null {
  if (!value) return null;

  try {
    const decoded = decodeURIComponent(value);

    if (
      decoded.startsWith("/") &&
      !decoded.startsWith("//") &&
      !decoded.includes("\\") &&
      !decoded.includes("\r") &&
      !decoded.includes("\n")
    ) {
      return decoded;
    }
  } catch {
    return null;
  }

  return null;
}

function getErrorMessage(
  result: LoginResponse | null,
  status: number,
): string {
  const code = cleanString(result?.code);

  const messages: Record<string, string> = {
    IDENTIFIER_REQUIRED:
      "Student ID, Admin ID or email is required.",
    PASSWORD_REQUIRED: "Password is required.",
    INVALID_IDENTIFIER: "Please enter a valid login identifier.",
    INVALID_PASSWORD: "Please enter a valid password.",
    INVALID_AUTH_MODE: "The selected login portal is invalid.",
    INVALID_CREDENTIALS: "Invalid ID, email or password.",
    EMAIL_NOT_VERIFIED:
      "Please verify your email before logging in.",
    ACCOUNT_INACTIVE: "Your account is currently inactive.",
    LOGIN_NOT_ENABLED: "Login is disabled for this account.",
    LOGIN_DISABLED: "Login is disabled for this account.",
    CREDENTIALS_NOT_GENERATED:
      "Your student credentials have not been generated yet.",
    CREDENTIALS_EXPIRED:
      "Your credentials have expired. Please contact support.",
    APPLICATION_REJECTED: "Your application was rejected.",
    APPLICATION_NOT_APPROVED:
      "Your application has not been approved yet.",
    ASSESSMENT_NOT_PASSED:
      "You have not passed the required assessment yet.",
    ASSESSMENT_RESULT_NOT_PASSED:
      "Your assessment result is not marked as passed.",
    INTERNSHIP_NOT_APPROVED:
      "Your internship has not been approved yet.",
    PAYMENT_NOT_VERIFIED:
      "Payment verification is required for dashboard access.",
    STUDENT_OPS_NOT_APPROVED:
      "Student Operations approval is still pending.",
    STUDENT_OPS_NOT_ACTIVE:
      "Your internship account is not active yet.",
    DASHBOARD_NOT_ACTIVE:
      "Your student dashboard is not active yet.",
    DASHBOARD_LOGIN_NOT_ENABLED:
      "Student dashboard login is not enabled yet.",
    DASHBOARD_CREDENTIALS_NOT_GENERATED:
      "Dashboard credentials have not been generated yet.",
    DASHBOARD_CREDENTIALS_EXPIRED:
      "Your dashboard credentials have expired.",
    ACCOUNT_TEMPORARILY_LOCKED:
      "Too many failed attempts. Please try again later.",
    DASHBOARD_ACCOUNT_TEMPORARILY_LOCKED:
      "Too many dashboard login attempts. Please try again later.",
    RATE_LIMITED:
      "Too many login attempts. Please try again later.",
    ADMIN_PASSWORD_NOT_CONFIGURED:
      "Administrator login is not configured correctly.",
    AUTH_SECRET_NOT_CONFIGURED:
      "Authentication is not configured on the server.",
    AUTHENTICATION_ERROR:
      "Unable to process login right now. Please try again.",
  };

  if (messages[code]) {
    const retry = result?.retryAfter;

    if (typeof retry === "number" && retry > 0) {
      return `${messages[code]} Retry in about ${Math.ceil(retry)} seconds.`;
    }

    return messages[code];
  }

  if (status === 429) {
    return "Too many login attempts. Please try again later.";
  }

  if (status === 401) {
    return "Invalid ID, email or password.";
  }

  if (status === 403) {
    return (
      cleanString(result?.message) ||
      "You are not authorized to access this portal."
    );
  }

  if (status >= 500) {
    return "Server error. Please try again later.";
  }

  return (
    cleanString(result?.message) ||
    "Unable to log in. Check your details and try again."
  );
}

function getStudentDestination(
  user: LoginUser,
  nextPath: string | null,
): string {
  if (
    nextPath &&
    (nextPath === STUDENT_HOME ||
      nextPath.startsWith(`${STUDENT_HOME}/`))
  ) {
    return nextPath;
  }

  if (isDashboardSession(user)) {
    return STUDENT_DASHBOARD_HOME;
  }

  const assessmentStatus = normalize(user.assessmentStatus);
  const resultStatus = normalize(user.resultStatus);

  const assessmentPassed =
    assessmentStatus === "passed" || resultStatus === "passed";

  return assessmentPassed
    ? INTERNSHIPS_HOME
    : ASSESSMENT_HOME;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);

  const mode = useMemo(
    () => normalizeMode(searchParams.get("mode")),
    [searchParams],
  );

  const nextPath = useMemo(
    () => safeInternalPath(searchParams.get("next")),
    [searchParams],
  );

  const pageTitle =
    mode === "admin"
      ? "Admin Sign In"
      : mode === "student-admin"
        ? "Student Operations"
        : mode === "student-dashboard"
          ? "Student Dashboard"
          : "Welcome";

  const subtitle =
    mode === "admin"
      ? "Sign in with your Admin ID or email."
      : mode === "student-admin"
        ? "Manage student approvals and internship operations."
        : mode === "student-dashboard"
          ? "Access your approved internship dashboard."
          : "Sign in with your Student ID, Admin ID or email.";

  useEffect(() => {
    setMounted(true);

    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const clearError = useCallback(() => {
    setError("");
    setStatus((current) =>
      current === "error" ? "idle" : current,
    );
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submittingRef.current || status === "loading") {
      return;
    }

    const cleanIdentifier = identifier.trim();

    // Do not trim passwords; whitespace can be part of a password.
    const loginPassword = password;

    if (!cleanIdentifier) {
      setStatus("error");
      setError("Student ID, Admin ID or email is required.");
      return;
    }

    if (cleanIdentifier.length > MAX_IDENTIFIER_LENGTH) {
      setStatus("error");
      setError("Please enter a valid login identifier.");
      return;
    }

    if (
      loginPassword.length < MIN_PASSWORD_LENGTH ||
      loginPassword.length > MAX_PASSWORD_LENGTH
    ) {
      setStatus("error");
      setError("Password must contain 8–200 characters.");
      return;
    }

    submittingRef.current = true;
    setStatus("loading");
    setError("");

    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(LOGIN_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: loginPassword,
          mode,
        }),
      });

      let result: LoginResponse | null = null;

      try {
        result = (await response.json()) as LoginResponse;
      } catch {
        result = null;
      }

      if (!response.ok || result?.success !== true) {
        setStatus("error");
        setError(getErrorMessage(result, response.status));
        return;
      }

      const user = result.user ?? result.data?.user;

      if (!user) {
        setStatus("error");
        setError(
          "Login succeeded, but account information was not returned.",
        );
        return;
      }

      // Session cookies are managed by the server.
      // Never store authentication tokens in browser storage.

      if (isOperationsUser(user)) {
        if (
          mode === "student" ||
          mode === "student-dashboard" ||
          mode === "admin"
        ) {
          setStatus("error");
          setError(
            "Use the dedicated Student Operations login portal.",
          );
          return;
        }

        setStatus("idle");

        router.replace(
          nextPath?.startsWith("/student-admin")
            ? nextPath
            : OPERATIONS_HOME,
        );

        router.refresh();
        return;
      }

      if (isAdminUser(user)) {
        if (
          mode === "student" ||
          mode === "student-admin" ||
          mode === "student-dashboard"
        ) {
          setStatus("error");
          setError(
            "This administrator account cannot use the selected student portal.",
          );
          return;
        }

        setStatus("idle");

        router.replace(
          nextPath?.startsWith("/admin")
            ? nextPath
            : ADMIN_HOME,
        );

        router.refresh();
        return;
      }

      if (isStudentUser(user)) {
        if (mode === "admin" || mode === "student-admin") {
          setStatus("error");
          setError("This is not an administrator account.");
          return;
        }

        setStatus("idle");

        const destination =
          mode === "student-dashboard"
            ? nextPath?.startsWith("/student/dashboard")
              ? nextPath
              : STUDENT_DASHBOARD_HOME
            : getStudentDestination(user, nextPath);

        router.replace(destination);
        router.refresh();
        return;
      }

      setStatus("error");
      setError(
        "Your account role could not be identified. Contact support.",
      );
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "[CyberNet Careers] Login request failed.",
      );

      setStatus("error");
      setError(
        "Unable to connect to the server. Please try again.",
      );
    } finally {
      submittingRef.current = false;

      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      setStatus((current) =>
        current === "loading" ? "idle" : current,
      );
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-8 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-400/15 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl"
      />

      <section
        aria-labelledby="login-title"
        className={`relative w-full max-w-md transition-all duration-300 ${
          mounted
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0"
        }`}
      >
        <div className="rounded-[30px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <header className="text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-extrabold tracking-wide text-blue-700">
              <ShieldCheck
                aria-hidden="true"
                className="h-4 w-4"
              />
              CyberNet Careers
            </div>

            <h1
              id="login-title"
              className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl"
            >
              {pageTitle}
            </h1>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {subtitle}
            </p>
          </header>

          {mode !== "auto" && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700"
            >
              {mode === "admin"
                ? "Administrator authentication"
                : mode === "student-admin"
                  ? "Student Operations authentication"
                  : mode === "student-dashboard"
                    ? "Student Dashboard authentication"
                    : "Main Student authentication"}
            </div>
          )}

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
          >
            <div>
              <label
                htmlFor="identifier"
                className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
              >
                <UserRound
                  aria-hidden="true"
                  className="h-4 w-4 text-blue-600"
                />

                {mode === "admin"
                  ? "Admin ID / Email"
                  : mode === "student-admin"
                    ? "Operations Admin ID / Email"
                    : mode === "student-dashboard"
                      ? "Dashboard Student ID / Email"
                      : "Student ID / Admin ID / Email"}
              </label>

              <input
                id="identifier"
                name="identifier"
                type="text"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  clearError();
                }}
                placeholder={
                  mode === "admin"
                    ? "Enter Admin ID or email"
                    : mode === "student-admin"
                      ? "Enter Operations Admin ID or email"
                      : mode === "student-dashboard"
                        ? "Enter dashboard Student ID or email"
                        : "Enter Student ID, Admin ID or email"
                }
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={MAX_IDENTIFIER_LENGTH}
                disabled={status === "loading"}
                required
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"
              >
                <LockKeyhole
                  aria-hidden="true"
                  className="h-4 w-4 text-blue-600"
                />
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearError();
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  maxLength={MAX_PASSWORD_LENGTH}
                  disabled={status === "loading"}
                  required
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                  disabled={status === "loading"}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 transition hover:text-blue-600 disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff
                      aria-hidden="true"
                      className="h-5 w-5"
                    />
                  ) : (
                    <Eye
                      aria-hidden="true"
                      className="h-5 w-5"
                    />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70"
            >
              {status === "loading" ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                  Authenticating…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          <footer className="mt-6 text-center">
            <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <ShieldCheck
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-emerald-500"
              />

              <p className="text-[11px] leading-5 text-slate-500">
                Secure sign-in using server-managed HttpOnly cookies.
              </p>
            </div>
          </footer>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} CyberNet Careers
        </p>
      </section>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-md items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-8 text-sm font-semibold text-slate-600 shadow-xl"
      >
        <Loader2
          aria-hidden="true"
          className="h-5 w-5 animate-spin text-blue-600"
        />
        Loading secure login…
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
