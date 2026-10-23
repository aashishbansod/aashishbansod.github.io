/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SettingsState = {
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  officeLocation: string;
  emailNotifications: boolean;
  applicationAlerts: boolean;
  paymentAlerts: boolean;
  certificateAlerts: boolean;
  maintenanceMode: boolean;
};

type ApiMeta = {
  authenticated?: boolean;
  adminId?: string;
  role?: string;
  generatedAt?: string;
  updated?: boolean;
  updatedBy?: string;
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: ApiMeta;
  code?: string;
  detail?: string;
};

type FieldErrors = Partial<Record<keyof SettingsState, string>>;

const API_URL = "/api/admin/settings";
const REFRESH_MS = 30_000;

const DEFAULT_SETTINGS: SettingsState = {
  companyName: "CyberNet Technology Systems",
  supportEmail: "contact@cybernetsystems.tech",
  supportPhone: "",
  officeLocation: "Amravati, Maharashtra, India",
  emailNotifications: true,
  applicationAlerts: true,
  paymentAlerts: true,
  certificateAlerts: true,
  maintenanceMode: false,
};

function normalizeSettings(input: unknown): SettingsState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const value = input as Partial<SettingsState>;

  return {
    companyName:
      typeof value.companyName === "string"
        ? value.companyName
        : DEFAULT_SETTINGS.companyName,
    supportEmail:
      typeof value.supportEmail === "string"
        ? value.supportEmail
        : DEFAULT_SETTINGS.supportEmail,
    supportPhone:
      typeof value.supportPhone === "string"
        ? value.supportPhone
        : DEFAULT_SETTINGS.supportPhone,
    officeLocation:
      typeof value.officeLocation === "string"
        ? value.officeLocation
        : DEFAULT_SETTINGS.officeLocation,
    emailNotifications:
      typeof value.emailNotifications === "boolean"
        ? value.emailNotifications
        : DEFAULT_SETTINGS.emailNotifications,
    applicationAlerts:
      typeof value.applicationAlerts === "boolean"
        ? value.applicationAlerts
        : DEFAULT_SETTINGS.applicationAlerts,
    paymentAlerts:
      typeof value.paymentAlerts === "boolean"
        ? value.paymentAlerts
        : DEFAULT_SETTINGS.paymentAlerts,
    certificateAlerts:
      typeof value.certificateAlerts === "boolean"
        ? value.certificateAlerts
        : DEFAULT_SETTINGS.certificateAlerts,
    maintenanceMode:
      typeof value.maintenanceMode === "boolean"
        ? value.maintenanceMode
        : DEFAULT_SETTINGS.maintenanceMode,
  };
}

function sameSettings(a: SettingsState, b: SettingsState) {
  return (
    a.companyName === b.companyName &&
    a.supportEmail === b.supportEmail &&
    a.supportPhone === b.supportPhone &&
    a.officeLocation === b.officeLocation &&
    a.emailNotifications === b.emailNotifications &&
    a.applicationAlerts === b.applicationAlerts &&
    a.paymentAlerts === b.paymentAlerts &&
    a.certificateAlerts === b.certificateAlerts &&
    a.maintenanceMode === b.maintenanceMode
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isSuperAdmin(role?: string) {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "super admin" || normalized === "superadmin";
}

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      message: `Request failed with HTTP ${response.status}.`,
      code: `HTTP_${response.status}`,
    };
  }
}

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-3xl border border-slate-200 bg-white",
        "shadow-[0_12px_40px_rgba(15,23,42,0.06)]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 text-lg font-black tracking-tight text-slate-950 sm:text-xl">
        {title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
        {description}
      </p>
    </div>
  );
}

function Toggle({
  enabled,
  disabled = false,
  onChange,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={[
        "relative h-7 w-12 shrink-0 rounded-full border transition-all duration-200",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
        enabled
          ? "border-blue-600 bg-blue-600 shadow-[0_4px_16px_rgba(37,99,235,0.25)]"
          : "border-slate-300 bg-slate-200",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200",
          enabled ? "translate-x-6" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-bold text-slate-800"
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={[
          "h-11 w-full rounded-xl border bg-white px-4 text-sm text-slate-900",
          "outline-none transition placeholder:text-slate-400",
          "focus:border-blue-500 focus:ring-4 focus:ring-blue-50",
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-50"
            : "border-slate-200",
          disabled ? "cursor-not-allowed bg-slate-50 opacity-60" : "",
        ].join(" ")}
      />

      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

function NotificationRow({
  title,
  description,
  enabled,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5 px-5 py-5 transition hover:bg-slate-50 sm:px-7">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <Toggle
        enabled={enabled}
        disabled={disabled}
        onChange={onChange}
        label={`Toggle ${title}`}
      />
    </div>
  );
}

function StatusBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
        "text-[10px] font-black uppercase tracking-wider",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-slate-300",
        ].join(" ")}
      />
      {label}
    </span>
  );
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | "save"
    | "refresh"
    | "shield"
    | "building"
    | "bell"
    | "settings"
    | "warning"
    | "check";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "save") {
    return (
      <svg {...common}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v5h8" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 11a8.1 8.1 0 0 0-15.5-3M4 4v4h4" />
        <path d="M4 13a8.1 8.1 0 0 0 15.5 3M20 20v-4h-4" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (name === "building") {
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" />
        <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg {...common}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    );
  }

  if (name === "warning") {
    return (
      <svg {...common}>
        <path d="m10.3 3.2-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.7-2.8l-8-14a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 8V4" />
      <path d="M8 12H4" />
      <path d="M12 16v4" />
      <path d="M16 12h4" />
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] =
    useState<SettingsState>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<SettingsState>(DEFAULT_SETTINGS);

  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [meta, setMeta] = useState<ApiMeta>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const [loadRequestId, setLoadRequestId] = useState(0);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const role = meta.role ?? "Admin";
  const canChangeMaintenance = isSuperAdmin(role);

  const hasChanges = useMemo(
    () => !sameSettings(settings, savedSettings),
    [settings, savedSettings],
  );

  const updateSetting = useCallback(
    <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
      setSaved(false);
      setError("");
    },
    [],
  );

  const validate = useCallback(() => {
    const nextErrors: FieldErrors = {};

    const companyName = settings.companyName.trim();
    const supportEmail = settings.supportEmail.trim();
    const supportPhone = settings.supportPhone.trim();
    const officeLocation = settings.officeLocation.trim();

    if (!companyName) {
      nextErrors.companyName = "Company name is required.";
    } else if (companyName.length > 120) {
      nextErrors.companyName =
        "Company name must be 120 characters or less.";
    }

    if (!supportEmail) {
      nextErrors.supportEmail = "Support email is required.";
    } else if (!isValidEmail(supportEmail)) {
      nextErrors.supportEmail = "Enter a valid email address.";
    }

    if (supportPhone.length > 40) {
      nextErrors.supportPhone = "Phone number is too long.";
    }

    if (!officeLocation) {
      nextErrors.officeLocation = "Office location is required.";
    } else if (officeLocation.length > 180) {
      nextErrors.officeLocation =
        "Office location must be 180 characters or less.";
    }

    if (!canChangeMaintenance && settings.maintenanceMode !== savedSettings.maintenanceMode) {
      nextErrors.maintenanceMode =
        "Only Super Admin can change maintenance mode.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [canChangeMaintenance, savedSettings.maintenanceMode, settings]);

  const loadSettings = useCallback(
    async (silent = false) => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");

      try {
        const response = await fetch(`${API_URL}?refresh=${Date.now()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        });

        const result = await readApi<SettingsState>(response);

        if (!response.ok || result.success === false) {
          throw new Error(
            result.message ||
              `Unable to load settings. HTTP ${response.status}.`,
          );
        }

        const normalized = normalizeSettings(result.data);

        if (!mountedRef.current || controller.signal.aborted) return;

        setSettings(normalized);
        setSavedSettings(normalized);
        setMeta(result.meta ?? {});
        setLastSyncedAt(
          result.meta?.generatedAt ?? new Date().toISOString(),
        );
        setFieldErrors({});
        setSaved(false);
        setHydrated(true);
        setLoadRequestId((value) => value + 1);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        if (!mountedRef.current) return;

        setHydrated(true);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load admin settings.",
        );
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadSettings();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [loadSettings]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !hasChanges && !saving) {
        void loadSettings(true);
      }
    }, REFRESH_MS);

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        !hasChanges &&
        !saving
      ) {
        void loadSettings(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
    };
  }, [hasChanges, loadSettings, saving]);

  const handleSave = useCallback(async () => {
    if (!validate()) {
      setError("Please fix the highlighted fields before saving.");
      return;
    }

    if (!hydrated || saving) return;

    setSaving(true);
    setSaved(false);
    setError("");

    const payload = normalizeSettings({
      ...settings,
      companyName: settings.companyName.trim(),
      supportEmail: settings.supportEmail.trim().toLowerCase(),
      supportPhone: settings.supportPhone.trim(),
      officeLocation: settings.officeLocation.trim(),
    });

    try {
      const response = await fetch(API_URL, {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await readApi<SettingsState>(response);

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message ||
            `Unable to save settings. HTTP ${response.status}.`,
        );
      }

      const normalized = normalizeSettings(result.data);

      if (!mountedRef.current) return;

      setSettings(normalized);
      setSavedSettings(normalized);
      setMeta((current) => ({
        ...current,
        ...(result.meta ?? {}),
      }));
      setLastSyncedAt(
        result.meta?.generatedAt ?? new Date().toISOString(),
      );
      setFieldErrors({});
      setSaved(true);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setSaved(false);
        saveTimerRef.current = null;
      }, 3500);
    } catch (requestError) {
      if (!mountedRef.current) return;

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Settings could not be saved.",
      );
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [hydrated, saving, settings, validate]);

  const handleDiscard = useCallback(() => {
    setSettings({ ...savedSettings });
    setFieldErrors({});
    setSaved(false);
    setError("");
  }, [savedSettings]);

  const handleRestoreDefaults = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS };

    if (!canChangeMaintenance) {
      next.maintenanceMode = savedSettings.maintenanceMode;
    }

    setSettings(next);
    setFieldErrors({});
    setSaved(false);
    setError("");
  }, [canChangeMaintenance, savedSettings.maintenanceMode]);

  const handleRefresh = useCallback(() => {
    if (hasChanges || saving) {
      setError("Save or discard your unsaved changes before refreshing.");
      return;
    }

    void loadSettings(true);
  }, [hasChanges, loadSettings, saving]);

  const persistenceReady = hydrated && !loading && !error;
  const changedCount = useMemo(() => {
    let count = 0;

    (Object.keys(settings) as Array<keyof SettingsState>).forEach((key) => {
      if (settings[key] !== savedSettings[key]) count += 1;
    });

    return count;
  }, [savedSettings, settings]);

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <style jsx>{`
        @keyframes settings-float {
          0%, 100% { transform: translateY(0); opacity: .22; }
          50% { transform: translateY(-10px); opacity: .38; }
        }

        @keyframes settings-pulse {
          0%, 100% { opacity: .65; }
          50% { opacity: 1; }
        }

        .settings-orb {
          animation: settings-float 7s ease-in-out infinite;
        }

        .settings-pulse {
          animation: settings-pulse 2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .settings-orb,
          .settings-pulse {
            animation: none;
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="settings-orb absolute -left-32 top-16 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="settings-orb absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl [animation-delay:1.5s]" />
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">
                Admin Control Center
              </p>
            </div>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Settings
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage the live CyberNet Careers admin configuration stored by
              the protected settings API.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading || saving || hasChanges}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className={refreshing ? "settings-pulse" : ""}>
                <Icon name="refresh" size={16} />
              </span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={handleDiscard}
              disabled={!hasChanges || saving || !hydrated}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Discard
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving || !hydrated}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-[0_8px_22px_rgba(37,99,235,0.2)] transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="save" size={16} />
              {saving ? "Saving..." : saved ? "Changes Saved" : "Save Changes"}
            </button>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700"
          >
            <Icon name="warning" size={18} />
            <div className="min-w-0">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadSettings()}
                className="mt-2 text-xs font-black underline underline-offset-4"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {saved ? (
          <div
            role="status"
            className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700"
          >
            <Icon name="check" size={18} />
            Settings were saved successfully to the admin backend.
          </div>
        ) : null}

        {settings.maintenanceMode ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-start gap-3 text-amber-800">
              <Icon name="warning" size={18} />
              <div>
                <p className="text-sm font-black">
                  Maintenance Mode is enabled.
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-700">
                  This setting is persisted server-side. Its actual effect on
                  public routes depends on the application&apos;s protected
                  maintenance enforcement.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card>
              <SectionHeader
                eyebrow="Workspace"
                title="Company Information"
                description="Keep the public-facing support and company information used by the admin configuration accurate."
              />

              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
                <div className="sm:col-span-2">
                  <Field
                    id="companyName"
                    label="Company Name"
                    value={settings.companyName}
                    onChange={(value) => updateSetting("companyName", value)}
                    placeholder="Company name"
                    error={fieldErrors.companyName}
                    disabled={loading || saving || !hydrated}
                  />
                </div>

                <Field
                  id="supportEmail"
                  label="Support Email"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(value) => updateSetting("supportEmail", value)}
                  placeholder="support@example.com"
                  error={fieldErrors.supportEmail}
                  disabled={loading || saving || !hydrated}
                />

                <Field
                  id="supportPhone"
                  label="Support Phone"
                  type="tel"
                  value={settings.supportPhone}
                  onChange={(value) => updateSetting("supportPhone", value)}
                  placeholder="+91 XXXXX XXXXX"
                  error={fieldErrors.supportPhone}
                  disabled={loading || saving || !hydrated}
                />

                <div className="sm:col-span-2">
                  <Field
                    id="officeLocation"
                    label="Office Location"
                    value={settings.officeLocation}
                    onChange={(value) =>
                      updateSetting("officeLocation", value)
                    }
                    placeholder="City, State, Country"
                    error={fieldErrors.officeLocation}
                    disabled={loading || saving || !hydrated}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Notifications"
                title="Alert Preferences"
                description="These preferences are stored in the authenticated admin settings record and can be changed without using browser localStorage."
              />

              <div className="divide-y divide-slate-100">
                <NotificationRow
                  title="Email Notifications"
                  description="Enable important platform email notification preferences."
                  enabled={settings.emailNotifications}
                  disabled={loading || saving || !hydrated}
                  onChange={(value) =>
                    updateSetting("emailNotifications", value)
                  }
                />

                <NotificationRow
                  title="Application Alerts"
                  description="Enable alerts related to internship applications."
                  enabled={settings.applicationAlerts}
                  disabled={loading || saving || !hydrated}
                  onChange={(value) =>
                    updateSetting("applicationAlerts", value)
                  }
                />

                <NotificationRow
                  title="Payment Alerts"
                  description="Enable payment-related alert preferences."
                  enabled={settings.paymentAlerts}
                  disabled={loading || saving || !hydrated}
                  onChange={(value) => updateSetting("paymentAlerts", value)}
                />

                <NotificationRow
                  title="Certificate Alerts"
                  description="Enable certificate activity alert preferences."
                  enabled={settings.certificateAlerts}
                  disabled={loading || saving || !hydrated}
                  onChange={(value) =>
                    updateSetting("certificateAlerts", value)
                  }
                />
              </div>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Operations"
                title="Platform Controls"
                description="Operational settings are protected by the admin API. Maintenance mode is restricted to Super Admin accounts."
              />

              <div className="flex items-center justify-between gap-5 px-5 py-5 sm:px-7">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    Maintenance Mode
                  </p>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    Persist the platform maintenance preference. Only Super
                    Admin can modify this value.
                  </p>

                  {!canChangeMaintenance ? (
                    <p className="mt-2 text-[11px] font-bold text-amber-600">
                      Super Admin permission required.
                    </p>
                  ) : null}

                  {fieldErrors.maintenanceMode ? (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      {fieldErrors.maintenanceMode}
                    </p>
                  ) : null}
                </div>

                <Toggle
                  enabled={settings.maintenanceMode}
                  disabled={
                    !canChangeMaintenance ||
                    loading ||
                    saving ||
                    !hydrated
                  }
                  onChange={(value) =>
                    updateSetting("maintenanceMode", value)
                  }
                  label="Toggle Maintenance Mode"
                />
              </div>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Actions"
                title="Configuration Recovery"
                description="Restore the application defaults locally in the form, then review them before saving to the backend."
              />

              <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Restore default configuration
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    This does not write to the database until you select Save
                    Changes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRestoreDefaults}
                  disabled={loading || saving || !hydrated}
                  className="h-11 shrink-0 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Restore Defaults
                </button>
              </div>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_8px_22px_rgba(37,99,235,0.2)]">
                  <Icon name="building" size={24} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-950">
                    Admin Workspace
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Live settings configuration
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Persistence
                </p>

                <div className="mt-3">
                  <StatusBadge
                    active={persistenceReady}
                    label={
                      persistenceReady
                        ? "Backend synchronized"
                        : loading
                          ? "Loading"
                          : "Needs attention"
                    }
                  />
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Settings are read and written through the protected admin
                  settings API.
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-black text-slate-950">
                  Current Configuration
                </h2>
                <span className="rounded-lg bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">
                  LIVE
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Unsaved changes
                  </span>
                  <span
                    className={[
                      "text-xs font-black",
                      hasChanges ? "text-amber-600" : "text-emerald-600",
                    ].join(" ")}
                  >
                    {hasChanges ? `${changedCount} pending` : "No"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">Admin role</span>
                  <span className="max-w-[150px] truncate text-xs font-black text-slate-700">
                    {role}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">Maintenance</span>
                  <span
                    className={[
                      "text-xs font-black",
                      settings.maintenanceMode
                        ? "text-amber-600"
                        : "text-emerald-600",
                    ].join(" ")}
                  >
                    {settings.maintenanceMode ? "Enabled" : "Disabled"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Email alerts
                  </span>
                  <span className="text-xs font-black text-slate-700">
                    {settings.emailNotifications ? "On" : "Off"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Application alerts
                  </span>
                  <span className="text-xs font-black text-slate-700">
                    {settings.applicationAlerts ? "On" : "Off"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Last synchronized
                  </span>
                  <span className="max-w-[155px] text-right text-[10px] font-bold text-slate-600">
                    {formatDate(lastSyncedAt)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="border-blue-100 bg-blue-50/70 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                <Icon name="shield" size={19} />
              </div>

              <h2 className="mt-4 text-base font-black text-slate-950">
                Protected admin configuration
              </h2>

              <p className="mt-2 text-xs leading-5 text-slate-600">
                This page does not expose database credentials or fabricate
                server-health information. Authentication and authorization
                remain enforced by the backend settings endpoint.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <StatusBadge
                  active={Boolean(meta.authenticated)}
                  label={
                    meta.authenticated
                      ? "Authenticated"
                      : "Authentication pending"
                  }
                />
              </div>
            </Card>
          </aside>
        </div>

        <footer className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-blue-600">
              <Icon name="settings" size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">
                Settings configuration
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Review your changes before saving. Discard returns to the last
                synchronized server configuration.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!hasChanges || saving || !hydrated}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Discard
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || saving || !hydrated}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-[0_8px_22px_rgba(37,99,235,0.2)] transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="save" size={16} />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </footer>

        <div className="h-4" />
      </div>

      {/* Keeps the dependency on the latest successful load explicit without
          adding visible mock/demo data. */}
      <span className="sr-only" aria-live="polite">
        Settings request cycle {loadRequestId}
      </span>
    </main>
  );
}
