"use client";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ApplicationRecord = {
  _id?: string;
  id?: string;
  applicationId?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  domain?: string;
  internshipDomain?: string;
  internship?: string;
  internshipTrack?: string;
  status?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  college?: string;
  collegeUniversity?: string;
  university?: string;
  course?: string;
  branch?: string;
  branchStream?: string;
  stream?: string;
  graduationYear?: string | number;
  skills?: string[] | string;
  assessmentStatus?: string;
  paymentStatus?: string;
  emailVerified?: boolean;
  internshipEligible?: boolean;
  message?: string;
  resumeUrl?: string;
  resume?: string;
  [key: string]: unknown;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: ApplicationRecord[] | ApplicationRecord;
  application?: ApplicationRecord;
  total?: number;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
};

type Status = "all" | "pending" | "under_review" | "approved" | "rejected";
type Action = "approve" | "reject" | "under_review" | "pending" | "delete";

type ActionDialog = {
  application: ApplicationRecord;
  action: "approve" | "reject" | "delete";
};

const PAGE_SIZE = 25;
const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "all", label: "All applications" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function text(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return fallback;
}

function firstText(values: unknown[], fallback = "—"): string {
  for (const value of values) {
    const result = text(value, "");
    if (result) return result;
  }
  return fallback;
}

function getId(application: ApplicationRecord): string {
  return firstText([application.applicationId, application._id, application.id], "");
}

function getName(application: ApplicationRecord): string {
  return firstText([application.fullName, application.name], "Unnamed applicant");
}

function getEmail(application: ApplicationRecord): string {
  return text(application.email);
}

function getPhone(application: ApplicationRecord): string {
  return firstText([application.phone, application.mobile]);
}

function getDomain(application: ApplicationRecord): string {
  return firstText([
    application.domain,
    application.internshipDomain,
    application.internshipTrack,
    application.internship,
  ]);
}

function getCollege(application: ApplicationRecord): string {
  return firstText([
    application.collegeUniversity,
    application.college,
    application.university,
  ]);
}

function getBranch(application: ApplicationRecord): string {
  return firstText([
    application.branchStream,
    application.branch,
    application.stream,
  ]);
}

function getCourse(application: ApplicationRecord): string {
  return text(application.course);
}

function getStatus(application: ApplicationRecord): Status {
  const normalized = text(application.status, "pending")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return STATUS_OPTIONS.some((item) => item.value === normalized)
    ? (normalized as Status)
    : "pending";
}

function prettyStatus(value: unknown): string {
  return text(value, "Unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown): string {
  if (!(typeof value === "string" || value instanceof Date) || !value) {
    return "Date unavailable";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function safeSkills(value: unknown): string {
  if (Array.isArray(value)) {
    const values = value.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    );
    return values.length ? values.join(", ") : "—";
  }

  return typeof value === "string" && value.trim()
    ? value.trim()
    : "—";
}

function statusStyles(status: Status): string {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function statusIcon(status: Status) {
  switch (status) {
    case "approved":
      return CheckCircle2;
    case "rejected":
      return XCircle;
    case "under_review":
      return Clock3;
    default:
      return Activity;
  }
}

async function readJson(response: Response): Promise<ApiResponse> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object"
      ? (value as ApiResponse)
      : {};
  } catch {
    return {};
  }
}

function errorMessage(payload: ApiResponse, fallback: string): string {
  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message
    : fallback;
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 ${
        wide ? "sm:col-span-2 lg:col-span-3" : ""
      }`}
    >
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-sm font-semibold leading-5 text-slate-800">
        {value}
      </dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  tone: "blue" | "amber" | "emerald" | "rose";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-slate-300" />
      </div>
      <p className="mt-4 text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-950 tabular-nums">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">{note}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const Icon = statusIcon(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${statusStyles(status)}`}
    >
      <Icon className="h-3 w-3" />
      {prettyStatus(status)}
    </span>
  );
}

function ApplicantAvatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white shadow-sm shadow-blue-600/15">
      {initials || "CN"}
    </span>
  );
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ApplicationRecord | null>(null);
  const [dialog, setDialog] = useState<ActionDialog | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  const loadApplications = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      requestRef.current?.abort();

      const controller = new AbortController();
      requestRef.current = controller;
      const signal = options?.signal ?? controller.signal;
      const sequence = ++requestSequence.current;

      if (!options?.silent) setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        if (statusFilter !== "all") params.set("status", statusFilter);

        const response = await fetch(
          `/api/admin/applications?${params.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal,
          },
        );

        const payload = await readJson(response);

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        if (response.status === 403) {
          throw new Error("You are not authorized to view applications.");
        }

        if (!response.ok || payload.success === false) {
          throw new Error(
            errorMessage(
              payload,
              `Unable to load applications (HTTP ${response.status}).`,
            ),
          );
        }

        if (sequence !== requestSequence.current || signal.aborted) return;

        const rows = Array.isArray(payload.data)
          ? payload.data
          : payload.data && typeof payload.data === "object"
            ? [payload.data]
            : [];

        setApplications(rows);
        setTotal(
          typeof payload.total === "number" && Number.isFinite(payload.total)
            ? Math.max(0, payload.total)
            : typeof payload.pagination?.total === "number"
              ? Math.max(0, payload.pagination.total)
              : rows.length,
        );

        const nextTotalPages =
          typeof payload.pagination?.totalPages === "number" &&
          Number.isFinite(payload.pagination.totalPages)
            ? Math.max(0, payload.pagination.totalPages)
            : rows.length
              ? 1
              : 0;

        setTotalPages(nextTotalPages);
        setSelected((current) => {
          if (!current) return null;
          const currentId = getId(current);
          return rows.find((row) => getId(row) === currentId) ?? null;
        });
      } catch (cause) {
        if (
          cause instanceof Error &&
          (cause.name === "AbortError" || signal.aborted)
        ) {
          return;
        }

        if (sequence !== requestSequence.current) return;

        setError(
          cause instanceof Error
            ? cause.message
            : "Unexpected error while loading applications.",
        );
      } finally {
        if (sequence === requestSequence.current && !signal.aborted) {
          setLoading(false);
        }
      }
    },
    [page, statusFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadApplications({ signal: controller.signal });

    return () => {
      controller.abort();
      requestRef.current?.abort();
    };
  }, [loadApplications]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setDialog(null);
        setSelected(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return applications;

    return applications.filter((application) => {
      const searchable = [
        getId(application),
        getName(application),
        getEmail(application),
        getPhone(application),
        getDomain(application),
        getCollege(application),
        getCourse(application),
        getBranch(application),
        text(application.graduationYear, ""),
        safeSkills(application.skills),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [applications, search]);

  const counts = useMemo(() => {
    const result = {
      pending: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
    };

    for (const application of applications) {
      const status = getStatus(application);
      if (status !== "all") result[status] += 1;
    }

    return result;
  }, [applications]);

  const performAction = async (
    application: ApplicationRecord,
    action: Action,
    actionReason = "",
  ) => {
    const id = getId(application);

    if (!id) {
      setError("This application has no usable ID. Refresh the list and try again.");
      return;
    }

    if (busyId) return;

    if (action === "approve" && !window.confirm(
      `Approve ${getName(application)}?\n\nContinue only after verifying the submitted application.`,
    )) {
      return;
    }

    if (action === "delete" && !window.confirm(
      `Permanently delete application ${id}?\n\nThis action may not be reversible.`,
    )) {
      return;
    }

    setBusyId(id);
    setError("");
    setNotice("");

    try {
      let response: Response;

      if (action === "delete") {
        const params = new URLSearchParams({ applicationId: id });
        response = await fetch(`/api/admin/applications?${params.toString()}`, {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
      } else if (action === "approve" || action === "reject") {
        response = await fetch("/api/admin/applications", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            action,
            applicationId: id,
            ...(action === "reject"
              ? { reason: actionReason.trim() || "Rejected by administrator" }
              : {}),
          }),
        });
      } else {
        response = await fetch("/api/admin/applications", {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ applicationId: id, status: action }),
        });
      }

      const payload = await readJson(response);

      if (!response.ok || payload.success === false) {
        if (action === "delete" && response.status === 405) {
          throw new Error(
            "The backend currently disables application deletion. The record has not been deleted.",
          );
        }

        throw new Error(
          errorMessage(
            payload,
            `Unable to ${action.replace(/_/g, " ")} this application (HTTP ${response.status}).`,
          ),
        );
      }

      const successMessage =
        action === "delete"
          ? "Application deleted successfully."
          : action === "under_review"
            ? "Application moved to review."
            : action === "pending"
              ? "Application returned to pending."
              : action === "approve"
                ? "Application approved. Check the server response for credential and email workflow status."
                : "Application rejected successfully.";

      setNotice(successMessage);
      setSelected(null);
      setDialog(null);
      setReason("");

      await loadApplications({ silent: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The requested action failed.",
      );
    } finally {
      setBusyId("");
    }
  };

  const openActionDialog = (
    application: ApplicationRecord,
    action: "approve" | "reject" | "delete",
  ) => {
    if (action === "delete") {
      void performAction(application, action);
      return;
    }

    if (action === "approve") {
      void performAction(application, action);
      return;
    }

    setReason("");
    setDialog({ application, action });
  };

  const exportCurrentPage = () => {
    const rows = filteredApplications;
    const headers = [
      "Application ID",
      "Name",
      "Email",
      "Phone",
      "Domain",
      "College",
      "Course",
      "Branch",
      "Graduation Year",
      "Status",
      "Applied At",
    ];

    const values = rows.map((application) => [
      getId(application),
      getName(application),
      getEmail(application),
      getPhone(application),
      getDomain(application),
      getCollege(application),
      getCourse(application),
      getBranch(application),
      text(application.graduationYear, ""),
      getStatus(application),
      text(application.createdAt, ""),
    ]);

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [headers, ...values]
      .map((row) => row.map((value) => escapeCsv(String(value))).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cybernet-applications-page-${page}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const startRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min((page - 1) * PAGE_SIZE + applications.length, total);

  return (
    <main className="min-h-full bg-[#f5f8fc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
              <FileCheck2 className="h-3.5 w-3.5" />
              CyberNet Careers · Admin workspace
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Applications
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Review applicant profiles, verify education details and manage each application through its approval journey.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCurrentPage}
              disabled={filteredApplications.length === 0 || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export current page
            </button>
            <button
              type="button"
              onClick={() => void loadApplications()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <section aria-label="Application overview" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Total applications"
            value={total}
            note="Matching records"
            icon={Users}
            tone="blue"
          />
          <MetricCard
            label="Pending"
            value={counts.pending}
            note="On this page"
            icon={Clock3}
            tone="amber"
          />
          <MetricCard
            label="Approved"
            value={counts.approved}
            note="On this page"
            icon={CheckCircle2}
            tone="emerald"
          />
          <MetricCard
            label="Rejected"
            value={counts.rejected}
            note="On this page"
            icon={XCircle}
            tone="rose"
          />
        </section>

        <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.03)] sm:p-5">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="application-search" className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                Search applications
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="application-search"
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, email, application ID, domain, college..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-16 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
                {!search && (
                  <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">
                    Ctrl K
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[190px] flex-1 lg:flex-none">
                <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                  Application status
                </span>
                <span className="relative block">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setPage(1);
                      setStatusFilter(event.target.value as Status);
                    }}
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
                }}
                className="h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                Clear filters
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {STATUS_OPTIONS.map((option) => {
              const active = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setStatusFilter(option.value);
                  }}
                  className={`rounded-full px-3.5 py-2 text-[11px] font-bold transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-slate-400">
            Showing {filteredApplications.length} filtered records on this page · {total.toLocaleString("en-IN")} total matching records · Search applies to the current page.
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="self-start text-xs font-bold underline sm:self-auto"
            >
              Dismiss
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <p>{notice}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotice("")}
              className="text-xs font-bold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <section
          aria-label="Applications list"
          className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.03)]"
        >
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-950">
                Application records
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Review applicant details and take controlled status actions.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500">
              <Activity className="h-3 w-3" />
              {loading ? "Synchronizing" : "Live API data"}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3 p-5" aria-live="polite" role="status">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-[68px] animate-pulse rounded-xl bg-slate-100"
                />
              ))}
              <p className="text-center text-xs text-slate-400">
                Loading application records...
              </p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Search className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-base font-black text-slate-900">
                No applications found
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                There are no records matching the selected status or search term.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
                }}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left">
                  <thead className="bg-slate-50/90 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5 font-extrabold">Applicant</th>
                      <th className="px-5 py-3.5 font-extrabold">Domain / Track</th>
                      <th className="px-5 py-3.5 font-extrabold">Education</th>
                      <th className="px-5 py-3.5 font-extrabold">Applied date</th>
                      <th className="px-5 py-3.5 font-extrabold">Status</th>
                      <th className="px-5 py-3.5 text-right font-extrabold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApplications.map((application, index) => {
                      const id = getId(application);
                      const status = getStatus(application);
                      const isBusy = busyId === id;
                      const rowKey =
                        id ||
                        `${getEmail(application)}-${text(application.createdAt, String(index))}`;

                      return (
                        <tr
                          key={rowKey}
                          className="transition hover:bg-blue-50/30"
                        >
                          <td className="px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <ApplicantAvatar name={getName(application)} />
                              <div className="min-w-0">
                                <p className="max-w-[220px] truncate text-sm font-extrabold text-slate-900">
                                  {getName(application)}
                                </p>
                                <p className="mt-1 max-w-[220px] truncate text-xs text-slate-500">
                                  {getEmail(application)}
                                </p>
                                <p className="mt-1 max-w-[220px] truncate font-mono text-[9px] text-slate-400">
                                  {id || "No application ID"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs font-bold text-slate-800">
                              {getDomain(application)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {text(application.internshipTrack, "Track not specified")}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="max-w-[220px] truncate text-xs font-semibold text-slate-800">
                              {getCollege(application)}
                            </p>
                            <p className="mt-1 max-w-[220px] truncate text-[11px] text-slate-400">
                              {getBranch(application)}
                              {getCourse(application) !== "—"
                                ? ` · ${getCourse(application)}`
                                : ""}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                            {formatDate(application.createdAt)}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={status} />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelected(application)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(busyId) || !id}
                                onClick={() => openActionDialog(application, "delete")}
                                aria-label={`Delete application ${id}`}
                                className="inline-flex items-center justify-center rounded-lg border border-rose-100 bg-white p-2 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isBusy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <p className="text-xs text-slate-500">
                  Showing <strong className="text-slate-800">{startRecord}–{endRecord}</strong> of{" "}
                  <strong className="text-slate-800">{total.toLocaleString("en-IN")}</strong> applications
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="min-w-[76px] text-center text-xs font-bold tabular-nums text-slate-500">
                    Page {page}{totalPages > 0 ? ` / ${totalPages}` : ""}
                  </span>
                  <button
                    type="button"
                    disabled={
                      loading ||
                      (totalPages > 0
                        ? page >= totalPages
                        : applications.length < PAGE_SIZE)
                    }
                    onClick={() => setPage((current) => current + 1)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {selected && (
          <div
            className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40 backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelected(null);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="application-detail-title"
              className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
                <div className="flex min-w-0 items-center gap-3">
                  <ApplicantAvatar name={getName(selected)} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-600">
                      Application details
                    </p>
                    <h2
                      id="application-detail-title"
                      className="mt-1 truncate text-lg font-black text-slate-950"
                    >
                      {getName(selected)}
                    </h2>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                      {getId(selected)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close application details"
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={getStatus(selected)} />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(selected.createdAt)}
                  </span>
                </div>

                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    <CircleUserRound className="h-4 w-4 text-blue-600" />
                    Personal information
                  </h3>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Full name" value={getName(selected)} />
                    <Detail label="Application ID" value={getId(selected)} />
                    <Detail label="Email address" value={getEmail(selected)} />
                    <Detail label="Phone number" value={getPhone(selected)} />
                    <Detail
                      label="Email verified"
                      value={text(selected.emailVerified, "Not available")}
                    />
                    <Detail
                      label="Last updated"
                      value={formatDate(selected.updatedAt)}
                    />
                  </dl>
                </section>

                <section className="border-t border-slate-100 pt-5">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    Education details
                  </h3>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Detail label="College / University" value={getCollege(selected)} />
                    <Detail label="Course" value={getCourse(selected)} />
                    <Detail label="Branch / Stream" value={getBranch(selected)} />
                    <Detail
                      label="Graduation year"
                      value={text(selected.graduationYear)}
                    />
                  </dl>
                </section>

                <section className="border-t border-slate-100 pt-5">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    <BriefcaseBusiness className="h-4 w-4 text-blue-600" />
                    Internship and progress
                  </h3>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Domain" value={getDomain(selected)} />
                    <Detail
                      label="Internship track"
                      value={text(selected.internshipTrack)}
                    />
                    <Detail label="Skills" value={safeSkills(selected.skills)} wide />
                    <Detail
                      label="Assessment status"
                      value={prettyStatus(selected.assessmentStatus)}
                    />
                    <Detail
                      label="Payment status"
                      value={prettyStatus(selected.paymentStatus)}
                    />
                    <Detail
                      label="Internship eligible"
                      value={text(selected.internshipEligible, "Not available")}
                    />
                    {typeof selected.message === "string" && selected.message.trim() ? (
                      <Detail label="Applicant message" value={selected.message} wide />
                    ) : null}
                  </dl>
                </section>

                {(typeof selected.resumeUrl === "string" && selected.resumeUrl.trim()) ||
                (typeof selected.resume === "string" && selected.resume.trim()) ? (
                  <section className="border-t border-slate-100 pt-5">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">
                      <FileCheck2 className="h-4 w-4 text-blue-600" />
                      Submitted document
                    </h3>
                    <a
                      href={
                        typeof selected.resumeUrl === "string" && selected.resumeUrl.trim()
                          ? selected.resumeUrl
                          : String(selected.resume)
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                    >
                      <Download className="h-4 w-4" />
                      Open submitted resume
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </section>
                ) : null}
              </div>

              <div className="border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void performAction(selected, "approve")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyId === getId(selected) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => setDialog({ application: selected, action: "reject" })}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyId) || getStatus(selected) === "under_review"}
                    onClick={() => void performAction(selected, "under_review")}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                  >
                    <Clock3 className="h-4 w-4" />
                    Mark review
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyId) || getStatus(selected) === "pending"}
                    onClick={() => void performAction(selected, "pending")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Return pending
                  </button>
                </div>
                <p className="mt-3 text-[10px] leading-5 text-slate-400">
                  All status changes are submitted to the secured admin API. The server remains responsible for permissions, student creation and credential delivery.
                </p>
              </div>
            </section>
          </div>
        )}

        {dialog && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="application-action-title"
              className="w-full max-w-md rounded-[22px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-rose-600">
                    Application decision
                  </p>
                  <h2
                    id="application-action-title"
                    className="mt-1 text-xl font-black text-slate-950"
                  >
                    Reject application?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {getName(dialog.application)} · {getId(dialog.application)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  aria-label="Close dialog"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Rejection reason
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Enter a clear reason for the applicant..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
                <span className="mt-1 block text-right text-[10px] text-slate-400">
                  {reason.length}/1000
                </span>
              </label>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  disabled={Boolean(busyId)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() =>
                    void performAction(
                      dialog.application,
                      "reject",
                      reason,
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busyId === getId(dialog.application) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Confirm rejection
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
