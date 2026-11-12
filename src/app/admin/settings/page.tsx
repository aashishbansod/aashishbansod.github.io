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
  if (!input || typeof input !== "object") return { ...DEFAULT_SETTINGS };
  const value = input as Partial<SettingsState>;
  return {
    companyName: typeof value.companyName === "string" ? value.companyName : DEFAULT_SETTINGS.companyName,
    supportEmail: typeof value.supportEmail === "string" ? value.supportEmail : DEFAULT_SETTINGS.supportEmail,
    supportPhone: typeof value.supportPhone === "string" ? value.supportPhone : DEFAULT_SETTINGS.supportPhone,
    officeLocation: typeof value.officeLocation === "string" ? value.officeLocation : DEFAULT_SETTINGS.officeLocation,
    emailNotifications: typeof value.emailNotifications === "boolean" ? value.emailNotifications : DEFAULT_SETTINGS.emailNotifications,
    applicationAlerts: typeof value.applicationAlerts === "boolean" ? value.applicationAlerts : DEFAULT_SETTINGS.applicationAlerts,
    paymentAlerts: typeof value.paymentAlerts === "boolean" ? value.paymentAlerts : DEFAULT_SETTINGS.paymentAlerts,
    certificateAlerts: typeof value.certificateAlerts === "boolean" ? value.certificateAlerts : DEFAULT_SETTINGS.certificateAlerts,
    maintenanceMode: typeof value.maintenanceMode === "boolean" ? value.maintenanceMode : DEFAULT_SETTINGS.maintenanceMode,
  };
}

function sameSettings(a: SettingsState, b: SettingsState) {
  return (Object.keys(DEFAULT_SETTINGS) as Array<keyof SettingsState>).every((key) => a[key] === b[key]);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isSuperAdmin(role?: string) {
  const normalized = String(role ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return normalized === "super admin" || normalized === "superadmin";
}

async function readApi<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return { success: false, message: `Request failed with HTTP ${response.status}.`, code: `HTTP_${response.status}` };
  }
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    building: <><path d="M3 21h18"/><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.8 4L20 15"/><path d="M20 20v-5h-5"/></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    warning: <><path d="m10.3 3.2-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.7-2.8l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    phone: <path d="M7 3H5a2 2 0 0 0-2 2c0 8.8 7.2 16 16 16a2 2 0 0 0 2-2v-2l-5-2-2 2a14 14 0 0 1-6-6l2-2-3-5Z"/>,
    sliders: <><path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3"/><path d="M2 14h4m4-6h4m4 8h4"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.sliders}</svg>;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.055)] ${className}`}>{children}</section>;
}

function PanelHeading({ icon, eyebrow, title, description }: { icon: string; eyebrow: string; title: string; description: string }) {
  return <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-650 text-blue-700"><Icon name={icon} size={20}/></div><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p><h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{description}</p></div></div>;
}

function Field({ id, label, value, onChange, type = "text", placeholder, error, disabled, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; error?: string; disabled?: boolean; hint?: string }) {
  return <div className="min-w-0"><label htmlFor={id} className="mb-2 block text-[13px] font-bold text-slate-800">{label}</label><input id={id} name={id} type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" maxLength={id === "companyName" ? 120 : id === "officeLocation" ? 180 : id === "supportPhone" ? 40 : 254} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={`h-12 w-full rounded-2xl border bg-white px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${error ? "border-red-300 focus:border-red-500 focus:ring-red-50" : "border-slate-200 hover:border-slate-300"}`} />{error ? <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-red-600">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1.5 text-[11px] text-slate-400">{hint}</p> : null}</div>;
}

function Toggle({ enabled, disabled = false, onChange, label }: { enabled: boolean; disabled?: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={enabled} aria-label={label} disabled={disabled} onClick={() => onChange(!enabled)} className={`relative h-7 w-12 shrink-0 rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${enabled ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-200"} ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? "translate-x-6" : "translate-x-1"}`}/></button>;
}

function PreferenceRow({ title, description, enabled, onChange, disabled, icon }: { title: string; description: string; enabled: boolean; onChange: (value: boolean) => void; disabled?: boolean; icon: string }) {
  return <div className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80 sm:px-7"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon name={icon} size={18}/></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p></div><span className={`hidden text-[10px] font-bold uppercase tracking-wider sm:block ${enabled ? "text-emerald-600" : "text-slate-400"}`}>{enabled ? "Enabled" : "Disabled"}</span><Toggle enabled={enabled} disabled={disabled} onChange={onChange} label={`Toggle ${title}`}/></div>;
}

function StatusPill({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}/>{children}</span>;
}

function SummaryRow({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "good" | "warning" }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-xs text-slate-500">{label}</span><span className={`max-w-[58%] break-words text-right text-xs font-extrabold ${tone === "good" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-slate-800"}`}>{value}</span></div>;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [meta, setMeta] = useState<ApiMeta>({});
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const mountedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const hasChanges = useMemo(() => !sameSettings(settings, savedSettings), [settings, savedSettings]);
  const role = meta.role ?? "Admin";
  const canChangeMaintenance = isSuperAdmin(role);
  const changedCount = useMemo(() => (Object.keys(DEFAULT_SETTINGS) as Array<keyof SettingsState>).filter((key) => settings[key] !== savedSettings[key]).length, [settings, savedSettings]);

  const updateSetting = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }, []);

  const validate = useCallback(() => {
    const nextErrors: FieldErrors = {};
    const companyName = settings.companyName.trim();
    const supportEmail = settings.supportEmail.trim();
    const supportPhone = settings.supportPhone.trim();
    const officeLocation = settings.officeLocation.trim();
    if (!companyName) nextErrors.companyName = "Company name is required.";
    else if (companyName.length > 120) nextErrors.companyName = "Company name must be 120 characters or less.";
    if (!supportEmail) nextErrors.supportEmail = "Support email is required.";
    else if (!isValidEmail(supportEmail)) nextErrors.supportEmail = "Enter a valid email address.";
    if (supportPhone.length > 40) nextErrors.supportPhone = "Phone number is too long.";
    if (!officeLocation) nextErrors.officeLocation = "Office location is required.";
    else if (officeLocation.length > 180) nextErrors.officeLocation = "Office location must be 180 characters or less.";
    if (!canChangeMaintenance && settings.maintenanceMode !== savedSettings.maintenanceMode) nextErrors.maintenanceMode = "Only Super Admin can change maintenance mode.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [canChangeMaintenance, savedSettings.maintenanceMode, settings]);

  const loadSettings = useCallback(async (silent = false) => {
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
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        signal: controller.signal,
      });
      const result = await readApi<SettingsState>(response);
      if (!response.ok || result.success === false) throw new Error(result.message || `Unable to load settings. HTTP ${response.status}.`);
      const normalized = normalizeSettings(result.data);
      if (!mountedRef.current || controller.signal.aborted) return;
      setSettings(normalized);
      setSavedSettings(normalized);
      setMeta(result.meta ?? {});
      setLastSyncedAt(result.meta?.generatedAt ?? new Date().toISOString());
      setFieldErrors({});
      setSaved(false);
      setHydrated(true);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      if (!mountedRef.current) return;
      setHydrated(true);
      setError(requestError instanceof Error ? requestError.message : "Unable to load admin settings.");
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadSettings();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [loadSettings]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !hasChanges && !savingRef.current) void loadSettings(true);
    }, REFRESH_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !hasChanges && !savingRef.current) void loadSettings(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hasChanges, loadSettings]);

  const handleSave = useCallback(async () => {
    if (!hydrated || savingRef.current || !validate()) {
      if (hydrated && !savingRef.current) setError("Please fix the highlighted fields before saving.");
      return;
    }
    savingRef.current = true;
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
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readApi<SettingsState>(response);
      if (!response.ok || result.success === false) throw new Error(result.message || `Unable to save settings. HTTP ${response.status}.`);
      const normalized = normalizeSettings(result.data ?? payload);
      if (!mountedRef.current) return;
      setSettings(normalized);
      setSavedSettings(normalized);
      setMeta((current) => ({ ...current, ...(result.meta ?? {}) }));
      setLastSyncedAt(result.meta?.generatedAt ?? new Date().toISOString());
      setFieldErrors({});
      setSaved(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setSaved(false);
        saveTimerRef.current = null;
      }, 4000);
    } catch (requestError) {
      if (mountedRef.current) setError(requestError instanceof Error ? requestError.message : "Settings could not be saved.");
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [hydrated, settings, validate]);

  const handleDiscard = useCallback(() => {
    setSettings({ ...savedSettings });
    setFieldErrors({});
    setSaved(false);
    setError("");
  }, [savedSettings]);

  const handleRestoreDefaults = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS };
    if (!canChangeMaintenance) next.maintenanceMode = savedSettings.maintenanceMode;
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
  const controlsDisabled = loading || saving || !hydrated;

  return (
    <main className="min-h-full bg-[#f4f7fc] px-3 py-5 text-slate-900 sm:px-6 sm:py-7 lg:px-8">
      <style jsx>{`
        @keyframes settings-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .settings-enter { animation: settings-enter .45s ease both; }
        @media (prefers-reduced-motion: reduce) { .settings-enter { animation: none; } }
      `}</style>
      <div className="mx-auto w-full max-w-[1440px] settings-enter">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-600"/><p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-700">CyberNet Careers · Admin workspace</p></div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-[38px]">Settings <span className="text-blue-600">&</span> Controls</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage company information, notification preferences and protected platform controls.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-extrabold tracking-wider text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500"/> {persistenceReady ? "CONNECTED" : loading ? "CONNECTING" : "CHECK STATUS"}</div>
            <button type="button" onClick={handleRefresh} disabled={refreshing || loading || saving || hasChanges} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><span className={refreshing ? "animate-spin" : ""}><Icon name="refresh" size={15}/></span>{refreshing ? "Refreshing" : "Refresh"}</button>
            <button type="button" onClick={handleDiscard} disabled={!hasChanges || saving || !hydrated} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Discard</button>
            <button type="button" onClick={handleSave} disabled={!hasChanges || saving || !hydrated} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="save" size={15}/>{saving ? "Saving..." : saved ? "Saved" : "Save changes"}</button>
          </div>
        </header>

        {error ? <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700"><Icon name="warning" size={18}/><div className="min-w-0 flex-1"><p>{error}</p><button type="button" onClick={() => void loadSettings()} className="mt-2 text-xs font-black underline underline-offset-4">Retry loading settings</button></div></div> : null}
        {saved ? <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><Icon name="check" size={18}/> Your settings have been saved to the admin backend.</div> : null}
        {settings.maintenanceMode ? <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800"><Icon name="warning" size={19}/><div><p className="text-sm font-extrabold">Maintenance Mode is enabled</p><p className="mt-1 text-xs leading-5 text-amber-700">This preference is stored server-side. Its effect on public routes depends on the application&apos;s maintenance enforcement.</p></div></div> : null}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-5">
            <Panel>
              <PanelHeading icon="building" eyebrow="Workspace profile" title="Company information" description="Keep your public-facing company and support details accurate."/>
              <div className="grid gap-x-5 gap-y-5 p-5 sm:grid-cols-2 sm:p-7">
                <div className="sm:col-span-2"><Field id="companyName" label="Company name" value={settings.companyName} onChange={(value) => updateSetting("companyName", value)} placeholder="Enter company name" error={fieldErrors.companyName} disabled={controlsDisabled}/></div>
                <Field id="supportEmail" label="Support email" type="email" value={settings.supportEmail} onChange={(value) => updateSetting("supportEmail", value)} placeholder="support@example.com" error={fieldErrors.supportEmail} disabled={controlsDisabled} hint="Used as the public support contact."/>
                <Field id="supportPhone" label="Support phone" type="tel" value={settings.supportPhone} onChange={(value) => updateSetting("supportPhone", value)} placeholder="+91 XXXXX XXXXX" error={fieldErrors.supportPhone} disabled={controlsDisabled}/>
                <div className="sm:col-span-2"><Field id="officeLocation" label="Office location" value={settings.officeLocation} onChange={(value) => updateSetting("officeLocation", value)} placeholder="City, State, Country" error={fieldErrors.officeLocation} disabled={controlsDisabled}/></div>
              </div>
            </Panel>

            <Panel>
              <PanelHeading icon="bell" eyebrow="Communication center" title="Notification preferences" description="Choose which platform activity categories should generate notification preferences."/>
              <div className="divide-y divide-slate-100">
                <PreferenceRow icon="mail" title="Email notifications" description="Enable important platform email notification preferences." enabled={settings.emailNotifications} disabled={controlsDisabled} onChange={(value) => updateSetting("emailNotifications", value)}/>
                <PreferenceRow icon="building" title="Application alerts" description="Receive alerts related to internship applications." enabled={settings.applicationAlerts} disabled={controlsDisabled} onChange={(value) => updateSetting("applicationAlerts", value)}/>
                <PreferenceRow icon="sliders" title="Payment alerts" description="Enable payment-related alert preferences." enabled={settings.paymentAlerts} disabled={controlsDisabled} onChange={(value) => updateSetting("paymentAlerts", value)}/>
                <PreferenceRow icon="shield" title="Certificate alerts" description="Enable certificate activity alert preferences." enabled={settings.certificateAlerts} disabled={controlsDisabled} onChange={(value) => updateSetting("certificateAlerts", value)}/>
              </div>
            </Panel>

            <Panel>
              <PanelHeading icon="sliders" eyebrow="Platform operations" title="Platform controls" description="Manage protected operational preferences for the CyberNet Careers platform."/>
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
                <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Icon name="warning" size={19}/></div><div><p className="text-sm font-extrabold text-slate-900">Maintenance mode</p><p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Persist the platform maintenance preference. Only Super Admin can modify this value.</p>{!canChangeMaintenance ? <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700"><Icon name="lock" size={12}/> Super Admin permission required</p> : null}{fieldErrors.maintenanceMode ? <p className="mt-2 text-xs font-semibold text-red-600">{fieldErrors.maintenanceMode}</p> : null}</div></div>
                <div className="flex items-center gap-3 self-end sm:self-center"><span className={`text-[10px] font-extrabold uppercase tracking-wider ${settings.maintenanceMode ? "text-amber-600" : "text-emerald-600"}`}>{settings.maintenanceMode ? "Enabled" : "Disabled"}</span><Toggle enabled={settings.maintenanceMode} disabled={!canChangeMaintenance || controlsDisabled} onChange={(value) => updateSetting("maintenanceMode", value)} label="Toggle Maintenance Mode"/></div>
              </div>
            </Panel>

            <Panel>
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Configuration recovery</p><h2 className="mt-1 text-base font-extrabold text-slate-950">Restore default configuration</h2><p className="mt-1 text-xs leading-5 text-slate-500">Defaults are applied to this form only. Review and save to persist them.</p></div><button type="button" onClick={handleRestoreDefaults} disabled={controlsDisabled} className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Restore defaults</button></div>
            </Panel>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-5">
            <Panel className="p-5 sm:p-6">
              <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><Icon name="building" size={23}/></div><div><p className="text-sm font-extrabold text-slate-950">Admin workspace</p><p className="mt-0.5 text-xs text-slate-500">Live settings configuration</p></div></div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Persistence</p><StatusPill active={persistenceReady}>{persistenceReady ? "Synchronized" : loading ? "Loading" : "Attention needed"}</StatusPill></div><p className="mt-3 text-xs leading-5 text-slate-500">Settings are read and written through the protected admin settings API.</p></div>
            </Panel>

            <Panel className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Overview</p><h2 className="mt-1 text-base font-extrabold text-slate-950">Current configuration</h2></div><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[9px] font-black tracking-wider text-blue-700">LIVE</span></div>
              <div className="mt-5 space-y-4">
                <SummaryRow label="Unsaved changes" value={hasChanges ? `${changedCount} pending` : "No"} tone={hasChanges ? "warning" : "good"}/>
                <SummaryRow label="Admin role" value={role}/>
                <SummaryRow label="Maintenance" value={settings.maintenanceMode ? "Enabled" : "Disabled"} tone={settings.maintenanceMode ? "warning" : "good"}/>
                <SummaryRow label="Email alerts" value={settings.emailNotifications ? "On" : "Off"}/>
                <SummaryRow label="Application alerts" value={settings.applicationAlerts ? "On" : "Off"}/>
                <SummaryRow label="Payment alerts" value={settings.paymentAlerts ? "On" : "Off"}/>
                <SummaryRow label="Certificate alerts" value={settings.certificateAlerts ? "On" : "Off"}/>
                <div className="border-t border-slate-100 pt-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Last synchronized</p><p className="mt-1.5 text-xs font-bold text-slate-700">{formatDate(lastSyncedAt)}</p></div>
              </div>
            </Panel>

            <Panel className="border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><Icon name="shield" size={19}/></div>
              <h2 className="mt-4 text-sm font-extrabold text-slate-950">Protected configuration</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">Database credentials and private server details are not exposed in this interface. Authentication and authorization remain enforced by the backend settings endpoint.</p>
              <div className="mt-4"><StatusPill active={Boolean(meta.authenticated)}>{meta.authenticated ? "Authenticated" : "Authentication pending"}</StatusPill></div>
            </Panel>
          </aside>
        </div>

        <footer className="mt-5 flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-start gap-3"><div className="mt-0.5 text-blue-600"><Icon name="shield" size={19}/></div><div><p className="text-sm font-extrabold text-slate-900">Settings configuration</p><p className="mt-1 text-xs leading-5 text-slate-500">{hasChanges ? `${changedCount} unsaved change${changedCount === 1 ? "" : "s"}. Save to synchronize with the backend.` : "All changes are synchronized with the saved configuration."}</p></div></div>
          <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={handleDiscard} disabled={!hasChanges || saving || !hydrated} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Discard changes</button><button type="button" onClick={handleSave} disabled={!hasChanges || saving || !hydrated} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-xs font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="save" size={15}/>{saving ? "Saving..." : "Save settings"}</button></div>
        </footer>
      </div>
    </main>
  );
}
