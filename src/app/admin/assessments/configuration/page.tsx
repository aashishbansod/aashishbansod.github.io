"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Globe2,
  LoaderCircle,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

type Settings = {
  totalMarks: number;
  passingMarks: number;
  maxAttempts: number;
  submissionWindowDays: number;
  submissionFormat: string;
  lateSubmissionAllowed: boolean;
  lateSubmissionGraceMinutes: number;
  timezone: string;
};

type Domain = {
  name: string;
  key: string;
  isActive: boolean;
};

type Override = Settings & {
  domain: string;
  domainKey: string;
  enabled: boolean;
  updatedAt?: string | null;
};

type ConfigurationPayload = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: {
    globalDefaults?: Partial<Settings>;
    domainOverrides?: Override[];
    domains?: Domain[];
    version?: number;
    updatedAt?: string | null;
    updatedByAdminId?: string;
  };
};

const API_URL = "/api/student-admin/assessments/configuration";

const DEFAULT_SETTINGS: Settings = {
  totalMarks: 100,
  passingMarks: 40,
  maxAttempts: 1,
  submissionWindowDays: 7,
  submissionFormat: "zip",
  lateSubmissionAllowed: false,
  lateSubmissionGraceMinutes: 0,
  timezone: "Asia/Kolkata",
};

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50";
const selectClass = inputClass;
const cardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMessage(payload: unknown, fallback: string): string {
  if (isObject(payload) && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return fallback;
}

function normalizeSettings(value: Partial<Settings> | undefined): Settings {
  return {
    totalMarks: Number(value?.totalMarks ?? DEFAULT_SETTINGS.totalMarks),
    passingMarks: Number(value?.passingMarks ?? DEFAULT_SETTINGS.passingMarks),
    maxAttempts: Number(value?.maxAttempts ?? DEFAULT_SETTINGS.maxAttempts),
    submissionWindowDays: Number(value?.submissionWindowDays ?? DEFAULT_SETTINGS.submissionWindowDays),
    submissionFormat: String(value?.submissionFormat ?? DEFAULT_SETTINGS.submissionFormat),
    lateSubmissionAllowed: value?.lateSubmissionAllowed === true,
    lateSubmissionGraceMinutes: Number(value?.lateSubmissionGraceMinutes ?? DEFAULT_SETTINGS.lateSubmissionGraceMinutes),
    timezone: String(value?.timezone ?? DEFAULT_SETTINGS.timezone),
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-bold text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function SettingsFields({
  value,
  onChange,
  disabled,
}: {
  value: Settings;
  onChange: (next: Settings) => void;
  disabled?: boolean;
}) {
  const update = <K extends keyof Settings>(key: K, next: Settings[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Field label="Total marks" hint="Maximum marks for each weekly assessment.">
        <input className={inputClass} type="number" min={1} max={10000} step={1} value={value.totalMarks} disabled={disabled} onChange={(event) => update("totalMarks", Number(event.target.value))} />
      </Field>
      <Field label="Passing marks" hint="Must not exceed total marks.">
        <input className={inputClass} type="number" min={0} max={value.totalMarks} step={1} value={value.passingMarks} disabled={disabled} onChange={(event) => update("passingMarks", Number(event.target.value))} />
      </Field>
      <Field label="Maximum attempts" hint="Allowed attempts per student for an assessment.">
        <select className={selectClass} value={value.maxAttempts} disabled={disabled} onChange={(event) => update("maxAttempts", Number(event.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => <option key={number} value={number}>{number} {number === 1 ? "attempt" : "attempts"}</option>)}
        </select>
      </Field>
      <Field label="Submission window" hint="Default number of days available to submit weekly work.">
        <input className={inputClass} type="number" min={1} max={90} step={1} value={value.submissionWindowDays} disabled={disabled} onChange={(event) => update("submissionWindowDays", Number(event.target.value))} />
      </Field>
      <Field label="Submission format" hint="Students will submit work using this format by default.">
        <select className={selectClass} value={value.submissionFormat} disabled={disabled} onChange={(event) => update("submissionFormat", event.target.value)}>
          <option value="zip">ZIP archive</option>
          <option value="pdf">PDF document</option>
          <option value="images">Images</option>
          <option value="github">GitHub / repository link</option>
          <option value="multiple">Multiple formats</option>
        </select>
      </Field>
      <Field label="Timezone" hint="Used when scheduling weekly assessment deadlines.">
        <select className={selectClass} value={value.timezone} disabled={disabled} onChange={(event) => update("timezone", event.target.value)}>
          <option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option>
          <option value="UTC">UTC</option>
          <option value="Asia/Dubai">Gulf Standard Time (Asia/Dubai)</option>
          <option value="Europe/London">United Kingdom (Europe/London)</option>
          <option value="America/New_York">US Eastern (America/New_York)</option>
        </select>
      </Field>
      <div className="sm:col-span-2 xl:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={value.lateSubmissionAllowed} disabled={disabled} onChange={(event) => update("lateSubmissionAllowed", event.target.checked)} />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-900">Allow late submissions</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">Allow students to submit after the deadline within a configured grace period.</span>
          </span>
        </label>
        {value.lateSubmissionAllowed ? (
          <div className="mt-4 max-w-xs">
            <Field label="Grace period (minutes)" hint="Maximum 7 days (10,080 minutes).">
              <input className={inputClass} type="number" min={0} max={10080} step={5} value={value.lateSubmissionGraceMinutes} disabled={disabled} onChange={(event) => update("lateSubmissionGraceMinutes", Number(event.target.value))} />
            </Field>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function StudentAssessmentConfigurationPage() {
  const [globalDefaults, setGlobalDefaults] = useState<Settings>(DEFAULT_SETTINGS);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadConfiguration = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as ConfigurationPayload | null;
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(getMessage(payload, `Unable to load configuration (HTTP ${response.status}).`));
      }

      const data = payload.data;
      const nextDomains = Array.isArray(data.domains) ? data.domains.filter((item) => item && typeof item.key === "string" && typeof item.name === "string") : [];
      const nextOverrides: Record<string, Override> = {};

      for (const item of Array.isArray(data.domainOverrides) ? data.domainOverrides : []) {
        if (item && typeof item.domainKey === "string") {
          nextOverrides[item.domainKey] = {
            ...normalizeSettings(item),
            domain: item.domain,
            domainKey: item.domainKey,
            enabled: item.enabled !== false,
            updatedAt: item.updatedAt ?? null,
          };
        }
      }

      setGlobalDefaults(normalizeSettings(data.globalDefaults));
      setDomains(nextDomains);
      setOverrides(nextOverrides);
      setVersion(Number(data.version ?? 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load configuration.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  const visibleDomains = useMemo(() => {
    const query = search.trim().toLowerCase();
    return domains.filter((domain) => !query || domain.name.toLowerCase().includes(query));
  }, [domains, search]);

  const activeOverrideCount = useMemo(
    () => Object.values(overrides).filter((item) => item.enabled).length,
    [overrides],
  );

  const updateOverride = (domain: Domain, patch: Partial<Override>) => {
    setOverrides((current) => {
      const existing = current[domain.key] ?? {
        ...globalDefaults,
        domain: domain.name,
        domainKey: domain.key,
        enabled: true,
      };
      return {
        ...current,
        [domain.key]: {
          ...existing,
          ...patch,
          domain: domain.name,
          domainKey: domain.key,
        },
      };
    });
  };

  const toggleOverride = (domain: Domain, enabled: boolean) => {
    updateOverride(domain, { enabled });
  };

  const saveConfiguration = async () => {
    setError("");
    setNotice("");

    if (globalDefaults.passingMarks > globalDefaults.totalMarks) {
      setError("Global passing marks cannot exceed total marks.");
      return;
    }

    for (const item of Object.values(overrides)) {
      if (item.passingMarks > item.totalMarks) {
        setError(`Passing marks cannot exceed total marks for ${item.domain}.`);
        setExpandedDomain(item.domainKey);
        return;
      }
    }

    setSaving(true);
    try {
      const domainOverrides = Object.values(overrides).map((item) => ({
        ...item,
        enabled: item.enabled,
      }));
      const response = await fetch(API_URL, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          version,
          globalDefaults,
          domainOverrides,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ConfigurationPayload | null;

      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(getMessage(payload, `Unable to save configuration (HTTP ${response.status}).`));
      }

      setVersion(Number(payload.data.version ?? version + 1));
      setNotice("Global defaults and domain overrides saved successfully.");
      await loadConfiguration(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-sm font-semibold text-slate-600 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
          Loading weekly assessment configuration…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/student-admin/assessments" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back to assessments
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadConfiguration(true)} disabled={refreshing || saving} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button type="button" onClick={() => void saveConfiguration()} disabled={saving || loading} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save configuration"}
            </button>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
                <Sparkles className="h-3.5 w-3.5" />
                Learning operations / weekly assessment setup
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Assessment configuration</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Set workspace-wide weekly assessment defaults and customize rules for each active internship domain.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure Student Operations session
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <Globe2 className="h-3.5 w-3.5" />
                  Main Admin active domains
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active domains</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-slate-950">{domains.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Overrides on</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-slate-950">{activeOverrideCount}</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}

        <section className={`${cardClass} p-5 sm:p-7`}>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-blue-700">
                <Settings2 className="h-5 w-5" />
                <span className="text-xs font-extrabold uppercase tracking-[0.15em]">Level 01 / Global defaults</span>
              </div>
              <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Default weekly assessment rules</h2>
              <p className="mt-1 text-sm text-slate-500">Applied to every domain unless a domain override is enabled.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Workspace default</span>
          </div>
          <SettingsFields value={globalDefaults} onChange={setGlobalDefaults} disabled={saving} />
        </section>

        <section className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-slate-100 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-violet-700">
                  <SlidersHorizontal className="h-5 w-5" />
                  <span className="text-xs font-extrabold uppercase tracking-[0.15em]">Level 02 / Domain overrides</span>
                </div>
                <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Customize by active domain</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Enable an override to use separate assessment rules for that domain. Disabled overrides inherit global defaults.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search active domains…" className={inputClass} />
              </div>
            </div>
          </div>

          {domains.length === 0 ? (
            <div className="p-10 text-center">
              <Globe2 className="mx-auto h-8 w-8 text-slate-300" />
              <h3 className="mt-3 text-base font-bold text-slate-800">No active domains found</h3>
              <p className="mt-1 text-sm text-slate-500">Create and activate internship domains in Main Admin first.</p>
            </div>
          ) : visibleDomains.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No domains match your search.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleDomains.map((domain) => {
                const override = overrides[domain.key];
                const enabled = override?.enabled === true;
                const expanded = expandedDomain === domain.key;
                const effective = enabled && override ? override : globalDefaults;

                return (
                  <div key={domain.key} className="p-5 sm:px-7">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                          <Globe2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-extrabold text-slate-900">{domain.name}</h3>
                          <p className="mt-1 text-xs text-slate-500">{enabled ? "Custom domain rules enabled" : "Using global defaults"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${enabled ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                          {enabled ? "Override active" : "Global defaults"}
                        </span>
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                          <input type="checkbox" checked={enabled} disabled={saving} onChange={(event) => toggleOverride(domain, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          Enable override
                        </label>
                        <button type="button" onClick={() => setExpandedDomain(expanded ? null : domain.key)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          {expanded ? "Hide settings" : "View settings"}
                          <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total marks</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{effective.totalMarks}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Passing marks</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{effective.passingMarks}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Attempts</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{effective.maxAttempts}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Window</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{effective.submissionWindowDays} days</p>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 sm:p-5">
                        {!enabled ? (
                          <div className="flex items-start gap-2 text-sm text-slate-600">
                            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                            Enable the override to edit these settings. Until then, this domain inherits the global defaults.
                          </div>
                        ) : null}
                        <SettingsFields
                          value={override ?? { ...globalDefaults, domain: domain.name, domainKey: domain.key, enabled: true }}
                          onChange={(next) => updateOverride(domain, next)}
                          disabled={!enabled || saving}
                        />
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[11px] text-slate-500">Domain settings are saved with the global configuration.</p>
                          <button type="button" onClick={() => updateOverride(domain, { ...globalDefaults })} disabled={!enabled || saving} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                            Copy global defaults
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div>
              <p className="text-sm font-extrabold text-slate-900">Configuration version {version}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Changes are stored separately from assessment tasks. New defaults apply when creating future weekly assessments; existing assessments are not silently rewritten.</p>
            </div>
          </div>
          <button type="button" onClick={() => void saveConfiguration()} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save all settings
          </button>
        </section>
      </div>
    </main>
  );
}
