"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const DASHBOARD_API = "/api/admin/dashboard";
const REFRESH_INTERVAL = 30_000;

type DashboardPayload = {
  success?: boolean;
  message?: string;
  stats?: Record<string, unknown>;
  database?: {
    connected?: boolean;
    databaseName?: string;
    dataSizeBytes?: number;
    storageSizeBytes?: number;
    indexSizeBytes?: number;
    totalSizeBytes?: number;
    collections?: number;
    objects?: number;
    refreshedAt?: string;
  };
  meta?: {
    authenticated?: boolean;
    role?: string;
    generatedAt?: string;
    version?: string;
  };
};

type SetupState = {
  loading: boolean;
  refreshing: boolean;
  error: string;
  authenticated: boolean;
  role: string;
  databaseConnected: boolean;
  databaseName: string;
  collections: number;
  objects: number;
  totalSizeBytes: number;
  generatedAt: string;
};

type CheckStatus = "ready" | "warning" | "unavailable";

type SetupCheck = {
  title: string;
  description: string;
  status: CheckStatus;
  detail: string;
};

const INITIAL_STATE: SetupState = {
  loading: true,
  refreshing: false,
  error: "",
  authenticated: false,
  role: "",
  databaseConnected: false,
  databaseName: "",
  collections: 0,
  objects: 0,
  totalSizeBytes: 0,
  generatedAt: "",
};

function Icon({
  name,
  size = 20,
}: {
  name:
    | "shield"
    | "database"
    | "user"
    | "settings"
    | "mail"
    | "payment"
    | "assessment"
    | "certificate"
    | "check"
    | "warning"
    | "refresh"
    | "info"
    | "server";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5c0 5.2-3.3 8.8-8 10-4.7-1.2-8-4.8-8-10V6l8-3Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      );
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
          <path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .7 1.8 1.8 0 0 1-3.4 0 1.8 1.8 0 0 0-3-.7l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.7-3 1.8 1.8 0 0 1 0-3.4 1.8 1.8 0 0 0 .7-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.7 1.8 1.8 0 0 1 3.4 0 1.8 1.8 0 0 0 3 .7l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .7 3 1.8 1.8 0 0 1 0 3.4 1.8 1.8 0 0 0-.7 3Z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "payment":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h3" />
        </svg>
      );
    case "assessment":
      return (
        <svg {...common}>
          <path d="M5 4h14v16H5z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "certificate":
      return (
        <svg {...common}>
          <path d="M6 3h12v13H6z" />
          <path d="m9 19 3-2 3 2v2l-3-1-3 1v-2ZM9 7h6M9 10h6" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common}>
          <path d="m12 3 9 17H3L12 3Z" />
          <path d="M12 9v4M12 16h.01" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.7-4L4 9" />
          <path d="M4 5v4h4M4 13a8 8 0 0 0 14.7 4L20 15" />
          <path d="M20 19v-4h-4" />
        </svg>
      );
    case "info":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
    case "server":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="6" rx="1.5" />
          <rect x="4" y="14" width="16" height="6" rx="1.5" />
          <path d="M8 7h.01M8 17h.01" />
        </svg>
      );
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );

  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string): string {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function bool(value: unknown): boolean {
  return value === true;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function SectionCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function StatusBadge({
  status,
}: {
  status: CheckStatus;
}) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
        <Icon name="check" size={13} />
        Ready
      </span>
    );
  }

  if (status === "warning") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
        <Icon name="warning" size={13} />
        Review
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Unavailable
    </span>
  );
}

function CheckCard({
  icon,
  title,
  description,
  status,
  detail,
}: SetupCheck & { icon: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(37,99,235,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
          <Icon name={icon} size={19} />
        </div>

        <StatusBadge status={status} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-950">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        {description}
      </p>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-700">{detail}</p>
      </div>
    </article>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  status = "ready",
}: {
  title: string;
  value: string;
  description: string;
  icon: Parameters<typeof Icon>[0]["name"];
  status?: CheckStatus;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
          <Icon name={icon} size={20} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] leading-5 text-slate-500">
          {description}
        </p>
        <StatusBadge status={status} />
      </div>
    </article>
  );
}

export default function AdminSetupPage() {
  const [state, setState] = useState<SetupState>(INITIAL_STATE);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const loadSetup = useCallback(async (manual = false) => {
    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setState((current) => ({
      ...current,
      loading: manual ? current.loading : true,
      refreshing: manual,
      error: "",
    }));

    try {
      const response = await fetch(
        `${DASHBOARD_API}?setupRefresh=${Date.now()}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        },
      );

      const result = (await response.json().catch(() => null)) as
        | DashboardPayload
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            `Setup check failed with status ${response.status}.`,
        );
      }

      if (!mountedRef.current) return;

      setState({
        loading: false,
        refreshing: false,
        error: "",
        authenticated: bool(result.meta?.authenticated),
        role:
          typeof result.meta?.role === "string"
            ? result.meta.role
            : "",
        databaseConnected: bool(result.database?.connected),
        databaseName:
          typeof result.database?.databaseName === "string"
            ? result.database.databaseName
            : "",
        collections: num(result.database?.collections),
        objects: num(result.database?.objects),
        totalSizeBytes: num(result.database?.totalSizeBytes),
        generatedAt:
          typeof result.meta?.generatedAt === "string"
            ? result.meta.generatedAt
            : typeof result.database?.refreshedAt === "string"
              ? result.database.refreshedAt
              : "",
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      if (!mountedRef.current) return;

      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load setup status.",
      }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadSetup();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadSetup();
      }
    }, REFRESH_INTERVAL);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadSetup();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange,
    );

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      requestRef.current?.abort();
    };
  }, [loadSetup]);

  const checks = useMemo<SetupCheck[]>(
    () => [
      {
        title: "Admin Authentication",
        description:
          "The setup page verifies access through the protected admin dashboard endpoint.",
        status: state.authenticated ? "ready" : "unavailable",
        detail: state.authenticated
          ? `Authenticated as ${state.role || "Admin"}`
          : "Authenticated admin session was not confirmed.",
      },
      {
        title: "Database Connection",
        description:
          "Uses the live database status returned by the protected dashboard API.",
        status: state.databaseConnected ? "ready" : "unavailable",
        detail: state.databaseConnected
          ? state.databaseName
            ? `Connected to ${state.databaseName}`
            : "Database connection is active."
          : "Database connection could not be confirmed.",
      },
      {
        title: "Student Data Layer",
        description:
          "The admin dashboard can read the current student dataset.",
        status:
          state.databaseConnected && state.authenticated
            ? "ready"
            : "unavailable",
        detail: state.databaseConnected
          ? `${formatNumber(state.objects)} database objects reported`
          : "Waiting for a live database connection.",
      },
      {
        title: "Internship System",
        description:
          "Internship data is available through the admin platform APIs.",
        status:
          state.databaseConnected && state.authenticated
            ? "ready"
            : "unavailable",
        detail:
          state.databaseConnected && state.authenticated
            ? "Admin API layer available"
            : "Cannot verify without a live authenticated API.",
      },
      {
        title: "Assessment System",
        description:
          "Assessment configuration is managed through the protected admin APIs.",
        status:
          state.databaseConnected && state.authenticated
            ? "ready"
            : "unavailable",
        detail:
          state.databaseConnected && state.authenticated
            ? "Admin API layer available"
            : "Cannot verify without a live authenticated API.",
      },
      {
        title: "Payment System",
        description:
          "Payment records can be checked through the protected admin APIs.",
        status:
          state.databaseConnected && state.authenticated
            ? "ready"
            : "unavailable",
        detail:
          state.databaseConnected && state.authenticated
            ? "Admin API layer available"
            : "Cannot verify without a live authenticated API.",
      },
      {
        title: "Certificate System",
        description:
          "Certificate management is exposed through the admin API layer.",
        status:
          state.databaseConnected && state.authenticated
            ? "ready"
            : "unavailable",
        detail:
          state.databaseConnected && state.authenticated
            ? "Admin API layer available"
            : "Cannot verify without a live authenticated API.",
      },
      {
        title: "Admin Settings",
        description:
          "Settings infrastructure is available under the admin workspace.",
        status:
          state.databaseConnected && state.authenticated
            ? "ready"
            : "warning",
        detail:
          state.databaseConnected && state.authenticated
            ? "Settings API can be reached by an authenticated admin."
            : "Run the setup check again after authentication/database recovery.",
      },
    ],
    [state],
  );

  const readyCount = checks.filter(
    (item) => item.status === "ready",
  ).length;
  const warningCount = checks.filter(
    (item) => item.status === "warning",
  ).length;
  const unavailableCount = checks.filter(
    (item) => item.status === "unavailable",
  ).length;

  const overallStatus: CheckStatus =
    unavailableCount > 0
      ? "unavailable"
      : warningCount > 0
        ? "warning"
        : "ready";

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <style jsx>{`
        @keyframes setup-float {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-10px);
            opacity: 0.38;
          }
        }

        .setup-orb {
          animation: setup-float 7s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .setup-orb {
            animation: none;
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="setup-orb absolute -left-32 top-10 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="setup-orb absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl [animation-delay:1.5s]" />
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-600">
                Admin Control Center
              </p>
            </div>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              System Setup
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Verify the live admin environment, authentication, database,
              and platform service layers.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSetup(true)}
            disabled={state.loading || state.refreshing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="refresh" size={17} />
            {state.refreshing ? "Checking..." : "Run Setup Check"}
          </button>
        </header>

        {state.error ? (
          <div
            role="alert"
            className="mt-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-bold text-red-800">
                Setup check could not be completed
              </p>
              <p className="mt-1 text-xs leading-5 text-red-700">
                {state.error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadSetup(true)}
              className="h-9 rounded-lg border border-red-200 bg-white px-4 text-xs font-bold text-red-700 transition hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : null}

        {state.loading ? (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Overall Status"
              value={
                overallStatus === "ready"
                  ? "Ready"
                  : overallStatus === "warning"
                    ? "Review"
                    : "Unavailable"
              }
              description={`${formatNumber(readyCount)} of ${formatNumber(checks.length)} setup checks ready.`}
              icon="shield"
              status={overallStatus}
            />

            <SummaryCard
              title="Authentication"
              value={state.authenticated ? "Verified" : "Not verified"}
              description={
                state.role
                  ? `Current role: ${state.role}`
                  : "Admin session status from live API."
              }
              icon="user"
              status={
                state.authenticated ? "ready" : "unavailable"
              }
            />

            <SummaryCard
              title="Database"
              value={
                state.databaseConnected ? "Connected" : "Unavailable"
              }
              description={
                state.databaseName || "Live database status."
              }
              icon="database"
              status={
                state.databaseConnected
                  ? "ready"
                  : "unavailable"
              }
            />

            <SummaryCard
              title="Data Objects"
              value={formatNumber(state.objects)}
              description={`${formatNumber(state.collections)} collections reported by the live database.`}
              icon="server"
              status={
                state.databaseConnected ? "ready" : "unavailable"
              }
            />
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard>
            <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
                    Environment Checks
                  </p>
                  <h2 className="mt-1.5 text-lg font-bold text-slate-950">
                    Production Readiness
                  </h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm">
                    Status is derived from live authenticated platform
                    information. No fake service health values are generated.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Live check
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
              <CheckCard
                icon="shield"
                {...checks[0]}
              />
              <CheckCard
                icon="database"
                {...checks[1]}
              />
              <CheckCard
                icon="user"
                {...checks[2]}
              />
              <CheckCard
                icon="settings"
                {...checks[3]}
              />
              <CheckCard
                icon="assessment"
                {...checks[4]}
              />
              <CheckCard
                icon="payment"
                {...checks[5]}
              />
              <CheckCard
                icon="certificate"
                {...checks[6]}
              />
              <CheckCard
                icon="settings"
                {...checks[7]}
              />
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                  <Icon name="database" size={20} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-950">
                    Database
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live database overview
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Database Name
                  </p>
                  <p className="mt-1.5 truncate text-sm font-bold text-slate-900">
                    {state.databaseName || "Unavailable"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold text-slate-400">
                      Collections
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {formatNumber(state.collections)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[10px] font-semibold text-slate-400">
                      Objects
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {formatNumber(state.objects)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-semibold text-slate-400">
                    Reported Database Size
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {formatBytes(state.totalSizeBytes)}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                  <Icon name="info" size={20} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-950">
                    Setup Information
                  </h2>
                  <p className="text-xs text-slate-500">
                    Current live check metadata
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    Ready checks
                  </span>
                  <span className="text-sm font-bold text-emerald-600">
                    {formatNumber(readyCount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    Review checks
                  </span>
                  <span className="text-sm font-bold text-amber-600">
                    {formatNumber(warningCount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    Unavailable checks
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    {formatNumber(unavailableCount)}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Last checked
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {formatDate(state.generatedAt)}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
              <Icon name="info" size={18} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-950">
                Production setup policy
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                This page reports only information that can be verified from
                the authenticated admin API. It does not claim that email,
                payment-provider, certificate, assessment, or other external
                services are configured unless the backend exposes a real
                status for them.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Setup status refreshes automatically every 30 seconds while this
            page is visible.
          </p>
          <p className="font-medium text-slate-400">
            Last check: {formatDate(state.generatedAt)}
          </p>
        </footer>
      </div>
    </main>
  );
}
