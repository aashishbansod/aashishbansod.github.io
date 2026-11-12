
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  ExternalLink,
  FileCheck2,
  FileText,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Ban,
  RotateCcw,
  Award,
  Users,
  Copy,
  Send,
} from "lucide-react";

type CertificateStatus = "issued" | "pending" | "revoked" | "expired";

type CertificateRecord = {
  id: string;
  certificateId: string;
  mainStudentId: string;
  operationsStudentId: string;
  studentId: string;
  studentName: string;
  email: string;
  internship: string;
  course: string;
  internshipPlan: string;
  internshipDurationDays: number;
  issueDate: string | null;
  expiryDate: string | null;
  status: CertificateStatus;
  verificationUrl: string;
  pdfUrl: string;
  issuedByName: string;
  issuedByRole: string;
  revokedAt: string | null;
  revokedReason: string;
  createdAt: string | null;
  updatedAt: string | null;
  emailStatus: string;
  emailSentAt: string | null;
};

type CertificateStats = {
  total: number;
  issued: number;
  pending: number;
  revoked: number;
  expired: number;
  emailSent: number;
  emailFailed: number;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: {
    certificates?: unknown[];
    records?: unknown[];
    stats?: Partial<CertificateStats>;
    pagination?: {
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
    };
  };
};

const API_URL = "/api/student-admin/certificates";
const PAGE_SIZE = 20;
const SEARCH_LIMIT = 120;

const EMPTY_STATS: CertificateStats = {
  total: 0,
  issued: 0,
  pending: 0,
  revoked: 0,
  expired: 0,
  emailSent: 0,
  emailFailed: 0,
};

const STATUS_OPTIONS = [
  { label: "All certificates", value: "" },
  { label: "Issued", value: "issued" },
  { label: "Pending", value: "pending" },
  { label: "Revoked", value: "revoked" },
  { label: "Expired", value: "expired" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, fallback = "—"): string {
  if (typeof value !== "string") return fallback;

  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  return cleaned || fallback;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeStatus(value: unknown): CertificateStatus {
  const status = cleanText(value, "pending").toLowerCase();

  if (status === "issued") return "issued";
  if (status === "revoked") return "revoked";
  if (status === "expired") return "expired";

  return "pending";
}

function normalizeCertificate(value: unknown): CertificateRecord {
  const raw = isRecord(value) ? value : {};

  return {
    id: cleanText(raw.id ?? raw._id, ""),
    certificateId: cleanText(raw.certificateId, "Not assigned"),
    mainStudentId: cleanText(raw.mainStudentId, ""),
    operationsStudentId: cleanText(raw.operationsStudentId, ""),
    studentId: cleanText(
      raw.studentId ?? raw.dashboardStudentId,
      "—",
    ),
    studentName: cleanText(raw.studentName, "Student"),
    email: cleanText(raw.email),
    internship: cleanText(raw.internship, "Internship"),
    course: cleanText(raw.course),
    internshipPlan: cleanText(raw.internshipPlan),
    internshipDurationDays: safeNumber(raw.internshipDurationDays),
    issueDate: typeof raw.issueDate === "string" ? raw.issueDate : null,
    expiryDate: typeof raw.expiryDate === "string" ? raw.expiryDate : null,
    status: normalizeStatus(raw.status),
    verificationUrl: cleanText(raw.verificationUrl, ""),
    pdfUrl: cleanText(raw.pdfUrl, ""),
    issuedByName: cleanText(raw.issuedByName),
    issuedByRole: cleanText(raw.issuedByRole),
    revokedAt: typeof raw.revokedAt === "string" ? raw.revokedAt : null,
    revokedReason: cleanText(raw.revokedReason, ""),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    emailStatus: cleanText(raw.emailStatus, "not-sent").toLowerCase(),
    emailSentAt: typeof raw.emailSentAt === "string" ? raw.emailSentAt : null,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "ST";
}

function statusClass(status: string): string {
  switch (status) {
    case "issued":
    case "sent":
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "revoked":
    case "failed":
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "expired":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function StatusBadge({ value }: { value: string }) {
  const label = value.replace(/[_-]+/g, " ");

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${statusClass(value)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconStyle,
  loading,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof Award;
  iconStyle: string;
  loading: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          {loading ? (
            <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950">
              {value}
            </p>
          )}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{description}</p>
    </article>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((__, cell) => (
            <div
              key={cell}
              className="h-12 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="break-all text-right text-xs font-bold text-slate-800">
        {value || "—"}
      </span>
    </div>
  );
}

export default function StudentAdminCertificatesPage() {
  const abortRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [stats, setStats] = useState<CertificateStats>(EMPTY_STATS);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [selectedCertificate, setSelectedCertificate] =
    useState<CertificateRecord | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeTarget, setRevokeTarget] =
    useState<CertificateRecord | null>(null);

  const activeFilterCount = useMemo(
    () => Number(Boolean(status)) + Number(Boolean(search)),
    [status, search],
  );

  const loadCertificates = useCallback(
    async (initial = false) => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      const sequence = ++requestSequence.current;

      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (search) params.set("search", search);
      if (status) params.set("status", status);

      try {
        const response = await fetch(`${API_URL}?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        const result = (await response.json().catch(() => null)) as ApiResponse | null;

        if (response.status === 401 || response.status === 403) {
          window.location.replace(
            "/login?mode=student-admin&next=%2Fstudent-admin%2Fcertificates",
          );
          return;
        }

        if (!response.ok || result?.success !== true || !result.data) {
          throw new Error(
            result?.message ||
              (response.status === 404
                ? "Certificate API route is not available yet."
                : `Unable to load certificate records (${response.status}).`),
          );
        }

        if (sequence !== requestSequence.current) return;

        const data = result.data;
        const records = Array.isArray(data.certificates)
          ? data.certificates
          : Array.isArray(data.records)
            ? data.records
            : [];

        setCertificates(records.map(normalizeCertificate));

        setStats({
          total: safeNumber(data.stats?.total),
          issued: safeNumber(data.stats?.issued),
          pending: safeNumber(data.stats?.pending),
          revoked: safeNumber(data.stats?.revoked),
          expired: safeNumber(data.stats?.expired),
          emailSent: safeNumber(data.stats?.emailSent),
          emailFailed: safeNumber(data.stats?.emailFailed),
        });

        setTotal(safeNumber(data.pagination?.total));
        setTotalPages(safeNumber(data.pagination?.totalPages));
        setLastUpdated(new Date().toISOString());
      } catch (requestError) {
        if (
          requestError instanceof Error &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        if (sequence !== requestSequence.current) return;

        console.error("[STUDENT ADMIN CERTIFICATES]", requestError);

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Certificate records could not be loaded.",
        );
      } finally {
        if (sequence === requestSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, search, status],
  );

  useEffect(() => {
    void loadCertificates(true);

    return () => {
      abortRef.current?.abort();
    };
  }, [loadCertificates]);

  useEffect(() => {
    if (!selectedCertificate) return;

    const updated = certificates.find(
      (item) => item.id === selectedCertificate.id,
    );

    if (updated) setSelectedCertificate(updated);
  }, [certificates, selectedCertificate]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim().slice(0, SEARCH_LIMIT));
  }

  function clearFilters() {
    setSearch("");
    setSearchInput("");
    setStatus("");
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  async function runCertificateAction(
    action: "send-email" | "revoke",
    certificate: CertificateRecord,
    reason?: string,
  ) {
    if (!certificate.id) {
      setActionError("Certificate record ID is missing.");
      return;
    }

    if (action === "revoke" && !reason?.trim()) {
      setActionError("A revocation reason is required.");
      return;
    }

    setActionLoading(`${action}:${certificate.id}`);
    setActionError("");
    setActionMessage("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          certificateId: certificate.certificateId,
          recordId: certificate.id,
          ...(action === "revoke" ? { reason: reason?.trim() } : {}),
        }),
      });

      const result = (await response.json().catch(() => null)) as ApiResponse | null;

      if (response.status === 401 || response.status === 403) {
        window.location.replace(
          "/login?mode=student-admin&next=%2Fstudent-admin%2Fcertificates",
        );
        return;
      }

      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.message || `Certificate action failed (${response.status}).`,
        );
      }

      setActionMessage(
        result.message ||
          (action === "send-email"
            ? "Certificate email request completed."
            : "Certificate has been revoked."),
      );

      setRevokeTarget(null);
      setRevokeReason("");

      await loadCertificates(false);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "The requested action could not be completed.",
      );
    } finally {
      setActionLoading("");
    }
  }

  function exportCurrentPage() {
    if (certificates.length === 0) return;

    const columns = [
      "Certificate ID",
      "Student Name",
      "Student ID",
      "Email",
      "Internship",
      "Course",
      "Status",
      "Issue Date",
      "Expiry Date",
      "Email Status",
    ];

    const rows = certificates.map((certificate) => [
      certificate.certificateId,
      certificate.studentName,
      certificate.studentId,
      certificate.email,
      certificate.internship,
      certificate.course,
      certificate.status,
      certificate.issueDate || "",
      certificate.expiryDate || "",
      certificate.emailStatus,
    ]);

    const escapeCsv = (value: string) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csv = [columns, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `cybernet-certificates-page-${page}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  async function copyValue(value: string) {
    if (!value || value === "—") return;

    try {
      await navigator.clipboard.writeText(value);
      setActionMessage("Copied to clipboard.");
    } catch {
      setActionError("Clipboard access is unavailable in this browser.");
    }
  }

  const updatedLabel = lastUpdated
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      }).format(new Date(lastUpdated))
    : "Not synchronized";

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <section className="relative overflow-hidden rounded-[26px] border border-blue-100 bg-white p-5 shadow-[0_8px_35px_rgba(15,23,42,0.045)] sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-52 w-52 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-blue-700">
                <Award size={13} />
                Student Operations / Credentials
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                Certificate Management
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Manage student certificates, monitor issue and expiry status,
                review verification records and track certificate email activity.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                  <ShieldCheck size={13} />
                  Secure certificate workspace
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  Updated {updatedLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadCertificates(false)}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>

              <button
                type="button"
                onClick={exportCurrentPage}
                disabled={certificates.length === 0 || loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>
        </section>

        {error && (
          <section
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <CircleAlert size={19} className="mt-0.5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-bold text-rose-800">
                  Certificate records could not be loaded
                </p>
                <p className="mt-1 break-words text-xs text-rose-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadCertificates(true)}
              className="h-9 shrink-0 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"
            >
              Try again
            </button>
          </section>
        )}

        {actionMessage && (
          <section
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              {actionMessage}
            </span>
            <button
              type="button"
              onClick={() => setActionMessage("")}
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </section>
        )}

        {actionError && (
          <section
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800"
          >
            <span className="flex items-center gap-2">
              <CircleAlert size={16} />
              {actionError}
            </span>
            <button
              type="button"
              onClick={() => setActionError("")}
              aria-label="Dismiss error"
            >
              <X size={15} />
            </button>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total certificates"
            value={stats.total.toLocaleString("en-IN")}
            description="All certificate records"
            icon={FileText}
            iconStyle="bg-blue-50 text-blue-600"
            loading={loading}
          />
          <SummaryCard
            title="Issued certificates"
            value={stats.issued.toLocaleString("en-IN")}
            description="Certificates officially issued"
            icon={BadgeCheck}
            iconStyle="bg-emerald-50 text-emerald-600"
            loading={loading}
          />
          <SummaryCard
            title="Pending certificates"
            value={stats.pending.toLocaleString("en-IN")}
            description="Records awaiting processing"
            icon={Clock3}
            iconStyle="bg-amber-50 text-amber-600"
            loading={loading}
          />
          <SummaryCard
            title="Revoked certificates"
            value={stats.revoked.toLocaleString("en-IN")}
            description="Certificates marked invalid"
            icon={Ban}
            iconStyle="bg-rose-50 text-rose-600"
            loading={loading}
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">Expired certificates</p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {loading ? "—" : stats.expired.toLocaleString("en-IN")}
              </p>
            </div>
            <span className="rounded-xl bg-violet-50 p-3 text-violet-600">
              <CalendarDays size={18} />
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">Emails sent</p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {loading ? "—" : stats.emailSent.toLocaleString("en-IN")}
              </p>
            </div>
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <Mail size={18} />
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">Email failures</p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {loading ? "—" : stats.emailFailed.toLocaleString("en-IN")}
              </p>
            </div>
            <span className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <CircleAlert size={18} />
            </span>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_5px_25px_rgba(15,23,42,0.035)]">
          <div className="border-b border-slate-100 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-slate-950">
                    Certificate records
                  </h2>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                    {total.toLocaleString("en-IN")} records
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Search, filter and inspect student certificate records.
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="flex w-full gap-2 xl:max-w-[460px]"
              >
                <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
                  <Search size={16} className="shrink-0 text-slate-400" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    maxLength={SEARCH_LIMIT}
                    placeholder="Certificate ID, student, email..."
                    className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-slate-400"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearchInput("");
                        setSearch("");
                        setPage(1);
                      }}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-expanded={filtersOpen}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <SlidersHorizontal size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] text-white">
                    {activeFilterCount}
                  </span>
                )}
                <ArrowDown
                  size={13}
                  className={`transition ${filtersOpen ? "rotate-180" : ""}`}
                />
              </button>

              <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                <ShieldCheck size={13} className="text-emerald-600" />
                Protected certificate records
              </span>
            </div>

            {filtersOpen && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Certificate status
                  </span>
                  <select
                    value={status}
                    onChange={(event) => handleStatusChange(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!activeFilterCount}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}

            {(search || status) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-500">
                  Active filters:
                </span>
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSearchInput("");
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700"
                  >
                    Search: {search}
                    <X size={11} />
                  </button>
                )}
                {status && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange("")}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold capitalize text-slate-700"
                  >
                    Status: {status}
                    <X size={11} />
                  </button>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <LoadingRows />
          ) : certificates.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FileCheck2 size={28} />
              </span>
              <h3 className="mt-4 text-base font-black text-slate-900">
                No certificate records found
              </h3>
              <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">
                {search || status
                  ? "Try changing your search or filters to find certificate records."
                  : "Certificate records will appear here when they are created and saved in the certificate database."}
              </p>
              {(search || status) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1250px] border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">
                      <th className="px-5 py-4">Student</th>
                      <th className="px-4 py-4">Certificate ID</th>
                      <th className="px-4 py-4">Internship</th>
                      <th className="px-4 py-4">Issue date</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Email</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {certificates.map((certificate) => (
                      <tr
                        key={certificate.id || certificate.certificateId}
                        className="transition hover:bg-blue-50/30"
                      >
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-[10px] font-black text-blue-700">
                              {initials(certificate.studentName)}
                            </span>
                            <div className="min-w-0">
                              <p className="max-w-[170px] truncate text-xs font-bold text-slate-900">
                                {certificate.studentName}
                              </p>
                              <p className="mt-1 max-w-[180px] truncate text-[10px] text-slate-500">
                                {certificate.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-[11px] font-black text-slate-800">
                            {certificate.certificateId}
                          </p>
                          <button
                            type="button"
                            onClick={() => void copyValue(certificate.certificateId)}
                            className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-blue-600 hover:text-blue-800"
                          >
                            <Copy size={10} />
                            Copy ID
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <p className="max-w-[170px] truncate text-[11px] font-semibold text-slate-700">
                            {certificate.internship}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {certificate.internshipPlan || certificate.course}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-[10px] text-slate-500">
                          {formatDate(certificate.issueDate)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge value={certificate.status} />
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge value={certificate.emailStatus} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActionError("");
                                setActionMessage("");
                                setSelectedCertificate(certificate);
                              }}
                              title="View certificate details"
                              aria-label={`View ${certificate.certificateId}`}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Eye size={13} />
                              Details
                            </button>
                            {certificate.status === "issued" && certificate.pdfUrl && (
                              <a
                                href={certificate.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <ExternalLink size={12} />
                                PDF
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-3 lg:hidden">
                {certificates.map((certificate) => (
                  <article
                    key={certificate.id || certificate.certificateId}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">
                          {initials(certificate.studentName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {certificate.studentName}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-slate-500">
                            {certificate.email}
                          </p>
                        </div>
                      </div>
                      <StatusBadge value={certificate.status} />
                    </div>

                    <div className="mt-4 rounded-xl bg-slate-50 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Certificate ID
                      </p>
                      <p className="mt-1 break-all text-xs font-black text-slate-800">
                        {certificate.certificateId}
                      </p>
                      <p className="mt-2 truncate text-[10px] text-slate-500">
                        {certificate.internship}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-semibold text-slate-400">
                          Issue date
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-slate-700">
                          {formatDate(certificate.issueDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold text-slate-400">
                          Email status
                        </p>
                        <div className="mt-1">
                          <StatusBadge value={certificate.emailStatus} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActionError("");
                          setActionMessage("");
                          setSelectedCertificate(certificate);
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-bold text-white hover:bg-blue-700"
                      >
                        <Eye size={13} />
                        Details
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-[10px] text-slate-500">
              Showing <span className="font-bold text-slate-800">{pageStart}</span>
              {" "}to{" "}
              <span className="font-bold text-slate-800">{pageEnd}</span>
              {" "}of{" "}
              <span className="font-bold text-slate-800">{total}</span>
              {" "}records
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={13} />
                Previous
              </button>
              <span className="min-w-20 text-center text-[10px] font-bold text-slate-600">
                Page {page} of {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages || loading || totalPages === 0}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-blue-700" />
            <div>
              <h3 className="text-xs font-black text-blue-950">
                Certificate verification and data protection
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-blue-800/80">
                Public verification should expose only certificate ID, student
                name, internship or course, issue date and current validity.
                Keep student email, internal database IDs, private tokens and
                administrative audit details restricted to authorized staff.
              </p>
            </div>
          </div>
        </section>
      </div>

      {selectedCertificate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCertificate(null);
              setActionError("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-detail-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-600">
                  <FileCheck2 size={13} />
                  Certificate record
                </div>
                <h2
                  id="certificate-detail-title"
                  className="mt-1 text-lg font-black text-slate-950"
                >
                  Certificate details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCertificate(null);
                  setActionError("");
                }}
                aria-label="Close details"
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">
                      Certificate identification
                    </p>
                    <p className="mt-2 break-all text-lg font-black tracking-tight text-slate-950">
                      {selectedCertificate.certificateId}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={selectedCertificate.status} />
                    <button
                      type="button"
                      onClick={() => void copyValue(selectedCertificate.certificateId)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50"
                    >
                      <Copy size={12} />
                      Copy ID
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-black text-slate-900">
                  Student information
                </h3>
                <div className="rounded-xl border border-slate-200 px-4">
                  <DetailRow label="Student name" value={selectedCertificate.studentName} />
                  <DetailRow label="Student ID" value={selectedCertificate.studentId} />
                  <DetailRow label="Email" value={selectedCertificate.email} />
                  <DetailRow label="Main student reference" value={selectedCertificate.mainStudentId} />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-black text-slate-900">
                  Internship information
                </h3>
                <div className="rounded-xl border border-slate-200 px-4">
                  <DetailRow label="Internship" value={selectedCertificate.internship} />
                  <DetailRow label="Course" value={selectedCertificate.course} />
                  <DetailRow label="Plan" value={selectedCertificate.internshipPlan} />
                  <DetailRow
                    label="Duration"
                    value={
                      selectedCertificate.internshipDurationDays
                        ? `${selectedCertificate.internshipDurationDays} days`
                        : "—"
                    }
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-black text-slate-900">
                  Issue and verification
                </h3>
                <div className="rounded-xl border border-slate-200 px-4">
                  <DetailRow label="Status" value={selectedCertificate.status} />
                  <DetailRow label="Issue date" value={formatDate(selectedCertificate.issueDate)} />
                  <DetailRow label="Expiry date" value={formatDate(selectedCertificate.expiryDate)} />
                  <DetailRow label="Issued by" value={selectedCertificate.issuedByName} />
                  <DetailRow label="Issued by role" value={selectedCertificate.issuedByRole} />
                  <DetailRow label="Last updated" value={formatDateTime(selectedCertificate.updatedAt)} />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-black text-slate-900">
                  Email delivery
                </h3>
                <div className="rounded-xl border border-slate-200 px-4">
                  <DetailRow label="Email status" value={selectedCertificate.emailStatus} />
                  <DetailRow label="Last sent" value={formatDateTime(selectedCertificate.emailSentAt)} />
                </div>
              </div>

              {selectedCertificate.status === "revoked" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-black text-rose-800">
                    Certificate revoked
                  </p>
                  <p className="mt-1 text-[11px] text-rose-700">
                    Revoked on {formatDateTime(selectedCertificate.revokedAt)}
                  </p>
                  {selectedCertificate.revokedReason && (
                    <p className="mt-2 break-words text-[11px] leading-5 text-rose-700">
                      Reason: {selectedCertificate.revokedReason}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {selectedCertificate.pdfUrl && (
                  <a
                    href={selectedCertificate.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileText size={15} />
                    Open certificate PDF
                    <ExternalLink size={12} />
                  </a>
                )}

                {selectedCertificate.verificationUrl && (
                  <a
                    href={selectedCertificate.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                  >
                    <ShieldCheck size={15} />
                    Open verification
                    <ExternalLink size={12} />
                  </a>
                )}

                {selectedCertificate.status === "issued" && (
                  <button
                    type="button"
                    onClick={() =>
                      void runCertificateAction("send-email", selectedCertificate)
                    }
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading === `send-email:${selectedCertificate.id}` ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    Send certificate email
                  </button>
                )}

                {selectedCertificate.status === "issued" && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevokeTarget(selectedCertificate);
                      setRevokeReason("");
                      setActionError("");
                    }}
                    disabled={Boolean(actionLoading)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Ban size={14} />
                    Revoke certificate
                  </button>
                )}
              </div>

              {actionError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
                >
                  {actionError}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {revokeTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-certificate-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
                <Ban size={20} />
              </span>
              <div className="min-w-0">
                <h2
                  id="revoke-certificate-title"
                  className="text-base font-black text-slate-950"
                >
                  Revoke certificate?
                </h2>
                <p className="mt-1 break-all text-[11px] text-slate-500">
                  {revokeTarget.certificateId}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-600">
              Revocation should invalidate public verification. This action
              should only be completed after the reason has been reviewed.
            </p>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Reason for revocation
              </span>
              <textarea
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Enter a clear reason..."
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-50"
              />
              <span className="mt-1 block text-right text-[9px] text-slate-400">
                {revokeReason.length}/500
              </span>
            </label>

            {actionError && (
              <p role="alert" className="mt-2 text-[11px] font-semibold text-rose-700">
                {actionError}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setRevokeTarget(null);
                  setRevokeReason("");
                  setActionError("");
                }}
                disabled={Boolean(actionLoading)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  void runCertificateAction(
                    "revoke",
                    revokeTarget,
                    revokeReason,
                  )
                }
                disabled={!revokeReason.trim() || Boolean(actionLoading)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading === `revoke:${revokeTarget.id}` ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Ban size={14} />
                )}
                Confirm revocation
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
