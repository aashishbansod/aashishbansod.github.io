"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

type CertificateStatus = "issued" | "pending" | "revoked" | "expired" | "unknown";

type Certificate = {
  id: string;
  certificateId: string;
  studentName: string;
  studentId: string;
  email: string;
  internship: string;
  course: string;
  issueDate: string;
  expiryDate: string;
  status: CertificateStatus;
  verificationUrl: string;
  pdfUrl: string;
  issuedBy: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  revocationReason: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  total?: number;
  stats?: {
    total?: number;
    issued?: number;
    pending?: number;
    revoked?: number;
    expired?: number;
  };
};

type Stats = {
  total: number;
  issued: number;
  pending: number;
  revoked: number;
  expired: number;
};

type IconName =
  | "certificate"
  | "users"
  | "clock"
  | "shield"
  | "search"
  | "refresh"
  | "eye"
  | "x"
  | "copy"
  | "external"
  | "calendar"
  | "mail"
  | "download"
  | "filter"
  | "file"
  | "check"
  | "alert";

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  const paths: Record<IconName, ReactNode> = {
    certificate: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 8h8M8 12h5M8 16h4" />
        <path d="m16 15 1.5 1.5L20 14" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6l8-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8.1 8.1 0 0 0-14.9-4L3 10" />
        <path d="M3 5v5h5M4 13a8.1 8.1 0 0 0 14.9 4L21 14" />
        <path d="M21 19v-5h-5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    x: <path d="m6 6 12 12M18 6 6 18" />,
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7M10 14 21 3" />
        <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5" />
        <path d="M5 17v4h14v-4" />
      </>
    ),
    filter: (
      <>
        <path d="M4 6h16M7 12h10M10 18h4" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4m0 3h.01" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizeStatus(value: unknown): CertificateStatus {
  const status = String(value ?? "").toLowerCase().trim();
  if (status === "issued" || status === "pending" || status === "revoked" || status === "expired") {
    return status;
  }
  return "unknown";
}

function stringValue(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function firstString(item: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function normalizeCertificate(item: Record<string, unknown>, index: number): Certificate {
  const certificateId = firstString(
    item,
    ["certificateId", "certificateID", "certificate_id", "serialNumber", "id"],
    "—"
  );

  return {
    id: firstString(item, ["_id", "id", "certificateId"], `certificate-${index}`),
    certificateId,
    studentName: firstString(item, ["studentName", "fullName", "name"], "Unknown Student"),
    studentId: firstString(item, ["studentId", "studentID", "dashboardStudentId"], "—"),
    email: firstString(item, ["email", "studentEmail"], "—"),
    internship: firstString(item, ["internship", "internshipTitle", "internshipTrack", "domain", "title", "course"], "—"),
    course: firstString(item, ["course", "program"], ""),
    issueDate: firstString(item, ["issueDate", "issuedAt", "createdAt"], ""),
    expiryDate: firstString(item, ["expiryDate", "expiresAt"], ""),
    status: normalizeStatus(item.status ?? item.certificateStatus),
    verificationUrl: firstString(item, ["verificationUrl", "verifyUrl", "publicVerificationUrl"], ""),
    pdfUrl: firstString(item, ["pdfUrl", "certificateUrl", "fileUrl", "downloadUrl"], ""),
    issuedBy: firstString(item, ["issuedByName", "issuedBy", "approvedBy", "createdBy"], "—"),
    source: firstString(item, ["source", "origin", "recordSource"], "Student Operations"),
    createdAt: firstString(item, ["createdAt"], ""),
    updatedAt: firstString(item, ["updatedAt"], ""),
    revocationReason: firstString(item, ["revocationReason", "revokeReason", "reason"], ""),
  };
}

function extractRows(payload: ApiResponse | null): Record<string, unknown>[] {
  const candidates: unknown[] = [
    payload?.data,
    (payload?.data as Record<string, unknown> | undefined)?.certificates,
    (payload?.data as Record<string, unknown> | undefined)?.items,
    (payload?.data as Record<string, unknown> | undefined)?.records,
    (payload?.data as Record<string, unknown> | undefined)?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && !Array.isArray(item)
      );
    }
  }
  return [];
}

function calculateStats(certificates: Certificate[]): Stats {
  return {
    total: certificates.length,
    issued: certificates.filter((item) => item.status === "issued").length,
    pending: certificates.filter((item) => item.status === "pending").length,
    revoked: certificates.filter((item) => item.status === "revoked").length,
    expired: certificates.filter((item) => item.status === "expired").length,
  };
}

function safeHttpUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function StatusBadge({ status }: { status: CertificateStatus }) {
  const config: Record<CertificateStatus, { label: string; dot: string; classes: string }> = {
    issued: { label: "Issued", dot: "bg-emerald-500", classes: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    pending: { label: "Pending", dot: "bg-amber-500", classes: "border-amber-200 bg-amber-50 text-amber-700" },
    revoked: { label: "Revoked", dot: "bg-rose-500", classes: "border-rose-200 bg-rose-50 text-rose-700" },
    expired: { label: "Expired", dot: "bg-slate-500", classes: "border-slate-200 bg-slate-100 text-slate-600" },
    unknown: { label: "Unknown", dot: "bg-slate-400", classes: "border-slate-200 bg-slate-50 text-slate-600" },
  };
  const current = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${current.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: IconName;
  tone: "blue" | "emerald" | "amber" | "rose" | "slate";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <div className={`rounded-xl p-3 ${tones[tone]}`}>
          <Icon name={icon} />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 break-words text-sm font-semibold text-slate-700 ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

export default function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverStats, setServerStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CertificateStatus>("all");
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [copied, setCopied] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCertificates = useCallback(async (isRefresh = false) => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const response = await fetch("/api/admin/certificates", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        signal: controller.signal,
      });

      let payload: ApiResponse | null = null;
      try {
        payload = (await response.json()) as ApiResponse;
      } catch {
        payload = null;
      }

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `Unable to load certificates (${response.status}).`);
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const normalized = extractRows(payload).map(normalizeCertificate);
      setCertificates(normalized);
      setServerTotal(typeof payload?.total === "number" && Number.isFinite(payload.total) ? payload.total : null);

      if (payload?.stats) {
        const calculated = calculateStats(normalized);
        setServerStats({
          total: typeof payload.stats.total === "number" ? payload.stats.total : calculated.total,
          issued: typeof payload.stats.issued === "number" ? payload.stats.issued : calculated.issued,
          pending: typeof payload.stats.pending === "number" ? payload.stats.pending : calculated.pending,
          revoked: typeof payload.stats.revoked === "number" ? payload.stats.revoked : calculated.revoked,
          expired: typeof payload.stats.expired === "number" ? payload.stats.expired : calculated.expired,
        });
      } else {
        setServerStats(null);
      }

      setLastUpdated(new Date());
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      console.error("[ADMIN CERTIFICATES]", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load certificate records.");
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchCertificates();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetchCertificates]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchCertificates(true);
    };

    const interval = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchCertificates]);

  useEffect(() => {
    if (!selectedCertificate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCertificate(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedCertificate]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const calculatedStats = useMemo(() => calculateStats(certificates), [certificates]);
  const stats = serverStats ?? calculatedStats;

  const filteredCertificates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return certificates.filter((certificate) => {
      const matchesSearch =
        !query ||
        [
          certificate.studentName,
          certificate.studentId,
          certificate.email,
          certificate.certificateId,
          certificate.internship,
          certificate.issuedBy,
        ].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all" || certificate.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [certificates, search, statusFilter]);

  const copyValue = useCallback(async (value: string, label: string) => {
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }, []);

  const exportCsv = useCallback(() => {
    if (!filteredCertificates.length || exporting) return;
    setExporting(true);
    try {
      const columns: Array<[string, keyof Certificate]> = [
        ["Certificate ID", "certificateId"],
        ["Student Name", "studentName"],
        ["Student ID", "studentId"],
        ["Email", "email"],
        ["Internship", "internship"],
        ["Status", "status"],
        ["Issue Date", "issueDate"],
        ["Expiry Date", "expiryDate"],
        ["Issued By", "issuedBy"],
        ["Verification URL", "verificationUrl"],
      ];
      const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = [
        columns.map(([label]) => escapeCell(label)).join(","),
        ...filteredCertificates.map((certificate) =>
          columns.map(([, key]) => escapeCell(certificate[key])).join(",")
        ),
      ].join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cybernet-certificates-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [exporting, filteredCertificates]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <main className="min-h-screen bg-[#f6f8fc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">CyberNet Careers · Main Admin</p>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Certificate Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Monitor certificates issued by Student Operations Admin. This workspace provides centralized visibility, verification and audit information.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Read-only issuance records
              </span>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">Source: Student Operations</span>
              {lastUpdated && <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-500">Synced {formatDateTime(lastUpdated.toISOString())}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void fetchCertificates(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!filteredCertificates.length || exporting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              {exporting ? "Preparing..." : "Export CSV"}
            </button>
          </div>
        </header>

        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-semibold text-rose-800">Unable to load certificate records</p>
                <p className="mt-1 break-words text-xs text-rose-700">{error}</p>
              </div>
            </div>
            <button type="button" onClick={() => void fetchCertificates()} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200">
              Try again
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Certificates" value={loading ? "—" : stats.total} description="All synchronized records" icon="certificate" tone="blue" />
          <StatCard label="Issued" value={loading ? "—" : stats.issued} description="Valid issued certificates" icon="shield" tone="emerald" />
          <StatCard label="Pending" value={loading ? "—" : stats.pending} description="Awaiting issuance" icon="clock" tone="amber" />
          <StatCard label="Revoked" value={loading ? "—" : stats.revoked} description="Invalidated certificates" icon="shield" tone="rose" />
          <StatCard label="Expired" value={loading ? "—" : stats.expired} description="Past validity date" icon="certificate" tone="slate" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Issued Certificate Registry</h2>
                <p className="mt-1 text-sm text-slate-500">Search and inspect certificate records received from Student Operations.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative">
                  <span className="sr-only">Search certificates</span>
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                    placeholder="Search name, ID, email..."
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 sm:w-80"
                  />
                </label>
                <label className="relative">
                  <span className="sr-only">Filter certificate status</span>
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="filter" className="h-4 w-4" /></span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as "all" | CertificateStatus)}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 sm:w-52"
                  >
                    <option value="all">All statuses</option>
                    <option value="issued">Issued</option>
                    <option value="pending">Pending</option>
                    <option value="revoked">Revoked</option>
                    <option value="expired">Expired</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>Showing <strong className="text-slate-800">{filteredCertificates.length}</strong> of <strong className="text-slate-800">{serverTotal ?? certificates.length}</strong> loaded records</span>
              {(search || statusFilter !== "all") && <button type="button" onClick={clearFilters} className="font-semibold text-blue-600 hover:text-blue-700">Clear filters</button>}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center px-6 text-center">
              <div className="rounded-2xl bg-slate-100 p-4 text-slate-400"><Icon name="certificate" className="h-7 w-7" /></div>
              <h3 className="mt-5 text-base font-bold text-slate-900">{certificates.length === 0 ? "No certificate records found" : "No matching certificates"}</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                {certificates.length === 0
                  ? "When Student Operations Admin issues a certificate and the record is synchronized, it will appear here automatically."
                  : "Try a different search term or status filter."}
              </p>
              {certificates.length > 0 && <button type="button" onClick={clearFilters} className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Clear filters</button>}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1120px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                      {["Certificate", "Student", "Internship", "Issue Date", "Issued By", "Status", "Action"].map((heading) => (
                        <th key={heading} className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCertificates.map((certificate) => (
                      <tr key={certificate.id} className="transition hover:bg-blue-50/30">
                        <td className="px-5 py-4">
                          <button type="button" onClick={() => setSelectedCertificate(certificate)} className="text-left">
                            <p className="font-mono text-sm font-bold text-blue-600 hover:text-blue-700">{certificate.certificateId}</p>
                            <p className="mt-1 text-xs text-slate-400">Student ID: {certificate.studentId}</p>
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-bold text-white">{getInitials(certificate.studentName)}</div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{certificate.studentName}</p>
                              <p className="mt-0.5 flex max-w-[220px] items-center gap-1 truncate text-xs text-slate-500"><Icon name="mail" className="h-3 w-3 shrink-0" />{certificate.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4"><p className="text-sm font-semibold text-slate-800">{certificate.internship}</p>{certificate.course && <p className="mt-1 text-xs text-slate-500">{certificate.course}</p>}</td>
                        <td className="px-5 py-4"><p className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><Icon name="calendar" className="h-4 w-4 text-slate-400" />{formatDate(certificate.issueDate)}</p></td>
                        <td className="px-5 py-4 text-sm text-slate-600">{certificate.issuedBy}</td>
                        <td className="px-5 py-4"><StatusBadge status={certificate.status} /></td>
                        <td className="px-5 py-4"><button type="button" onClick={() => setSelectedCertificate(certificate)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Icon name="eye" className="h-4 w-4" />View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {filteredCertificates.map((certificate) => (
                  <article key={certificate.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-bold text-white">{getInitials(certificate.studentName)}</div>
                        <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{certificate.studentName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{certificate.email}</p></div>
                      </div>
                      <StatusBadge status={certificate.status} />
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <Info label="Certificate ID" value={certificate.certificateId} mono />
                      <Info label="Student ID" value={certificate.studentId} mono />
                      <Info label="Internship" value={certificate.internship} />
                      <Info label="Issue Date" value={formatDate(certificate.issueDate)} />
                    </div>
                    <button type="button" onClick={() => setSelectedCertificate(certificate)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Icon name="eye" className="h-4 w-4" />View Certificate</button>
                  </article>
                ))}
              </div>
            </>
          )}
          {!loading && filteredCertificates.length > 0 && <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500">Displaying {filteredCertificates.length} certificate record{filteredCertificates.length === 1 ? "" : "s"} from the current API response.</div>}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 text-blue-600 shadow-sm"><Icon name="shield" /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Central certificate oversight</h3>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">
                Certificate issuance remains controlled by Student Operations Admin. Main Admin can inspect synchronized records, download available certificate files and verify public certificate links. Issuance or revocation actions are intentionally not exposed in this dashboard.
              </p>
            </div>
          </div>
        </section>
      </div>

      {selectedCertificate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCertificate(null);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="certificate-details-title" className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Icon name="certificate" /></div>
                <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Certificate record</p><h2 id="certificate-details-title" className="mt-1 truncate font-mono text-base font-bold text-slate-950 sm:text-lg">{selectedCertificate.certificateId}</h2></div>
              </div>
              <button type="button" onClick={() => setSelectedCertificate(null)} className="rounded-xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800" aria-label="Close certificate details"><Icon name="x" /></button>
            </div>
            <div className="max-h-[calc(92vh-145px)] overflow-y-auto p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white">{getInitials(selectedCertificate.studentName)}</div>
                  <div className="min-w-0"><h3 className="truncate font-bold text-slate-950">{selectedCertificate.studentName}</h3><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Icon name="mail" className="h-3.5 w-3.5" /><span className="truncate">{selectedCertificate.email}</span></p></div>
                </div>
                <StatusBadge status={selectedCertificate.status} />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Info label="Certificate ID" value={selectedCertificate.certificateId} mono />
                <Info label="Student ID" value={selectedCertificate.studentId} mono />
                <Info label="Student Name" value={selectedCertificate.studentName} />
                <Info label="Email" value={selectedCertificate.email} />
                <Info label="Internship" value={selectedCertificate.internship} />
                <Info label="Course" value={selectedCertificate.course || "—"} />
                <Info label="Issue Date" value={formatDate(selectedCertificate.issueDate)} />
                <Info label="Expiry Date" value={formatDate(selectedCertificate.expiryDate)} />
                <Info label="Issued By" value={selectedCertificate.issuedBy} />
                <Info label="Record Source" value={selectedCertificate.source} />
                <Info label="Created" value={formatDateTime(selectedCertificate.createdAt)} />
                <Info label="Last Updated" value={formatDateTime(selectedCertificate.updatedAt)} />
              </div>

              {selectedCertificate.revocationReason && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Revocation reason</p>
                  <p className="mt-2 break-words text-sm text-rose-800">{selectedCertificate.revocationReason}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => void copyValue(selectedCertificate.certificateId, "certificate-id")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icon name="copy" className="h-3.5 w-3.5" />{copied === "certificate-id" ? "Copied ID" : "Copy Certificate ID"}</button>
                {selectedCertificate.pdfUrl && safeHttpUrl(selectedCertificate.pdfUrl) && (
                  <a href={safeHttpUrl(selectedCertificate.pdfUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><Icon name="download" className="h-3.5 w-3.5" />Open Certificate PDF</a>
                )}
                {selectedCertificate.verificationUrl && safeHttpUrl(selectedCertificate.verificationUrl) && (
                  <>
                    <button type="button" onClick={() => void copyValue(safeHttpUrl(selectedCertificate.verificationUrl), "verification-url")} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Icon name="copy" className="h-3.5 w-3.5" />{copied === "verification-url" ? "Copied URL" : "Copy Verification URL"}</button>
                    <a href={safeHttpUrl(selectedCertificate.verificationUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icon name="external" className="h-3.5 w-3.5" />Verify Certificate</a>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <button type="button" onClick={() => setSelectedCertificate(null)} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">Close</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}
