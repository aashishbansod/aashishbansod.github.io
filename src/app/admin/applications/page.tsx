"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

const PAGE_SIZE = 25;
const STATUS_OPTIONS = [
  { value: "all", label: "All applications" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

type ApplicationStatus = (typeof STATUS_OPTIONS)[number]["value"];
type Action = "approve" | "reject" | "under_review" | "pending" | "delete";

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
  return firstText([application.collegeUniversity, application.college, application.university]);
}

function getBranch(application: ApplicationRecord): string {
  return firstText([application.branchStream, application.branch, application.stream]);
}

function getCourse(application: ApplicationRecord): string {
  return text(application.course);
}

function getStatus(application: ApplicationRecord): ApplicationStatus {
  const normalized = text(application.status, "pending").toLowerCase().replace(/[\s-]+/g, "_");
  return STATUS_OPTIONS.some((item) => item.value === normalized)
    ? (normalized as ApplicationStatus)
    : "pending";
}

function prettyStatus(value: unknown): string {
  return text(value, "Unknown").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown): string {
  if (!(typeof value === "string" || value instanceof Date) || !value) return "Date unavailable";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "Date unavailable";
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "rejected":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "under_review":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    default:
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
}

function safeSkills(value: unknown): string {
  if (Array.isArray(value)) {
    const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return values.length ? values.join(", ") : "—";
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return "—";
}

async function readJson(response: Response): Promise<ApiResponse> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" ? (value as ApiResponse) : {};
  } catch {
    return {};
  }
}

function getErrorMessage(payload: ApiResponse, fallback: string): string {
  return typeof payload.message === "string" && payload.message.trim() ? payload.message : fallback;
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl bg-slate-50 p-3 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/admin/applications?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      const payload = await readJson(response);
      if (response.status === 401 || response.status === 403) {
        throw new Error(response.status === 401 ? "Your admin session has expired. Please sign in again." : "You are not authorized to view applications.");
      }
      if (!response.ok || payload.success === false) {
        throw new Error(getErrorMessage(payload, `Unable to load applications (HTTP ${response.status}).`));
      }
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setApplications(rows);
      setTotal(typeof payload.total === "number" && Number.isFinite(payload.total) ? payload.total : rows.length);
      setTotalPages(
        typeof payload.pagination?.totalPages === "number" && Number.isFinite(payload.pagination.totalPages)
          ? Math.max(0, payload.pagination.totalPages)
          : rows.length ? 1 : 0,
      );
      setSelected((current) => {
        if (!current) return null;
        const currentId = getId(current);
        return rows.find((row) => getId(row) === currentId) ?? null;
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unexpected error while loading applications.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void loadApplications(controller.signal);
    return () => controller.abort();
  }, [loadApplications]);

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return applications;
    return applications.filter((application) => {
      const searchable = [
        getId(application), getName(application), getEmail(application), getPhone(application),
        getDomain(application), getCollege(application), getCourse(application), getBranch(application),
        text(application.graduationYear, ""), safeSkills(application.skills),
      ].join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [applications, search]);

  const counts = useMemo(() => {
    const result = { pending: 0, under_review: 0, approved: 0, rejected: 0 };
    for (const application of applications) {
      const status = getStatus(application);
      if (status !== "all") result[status] += 1;
    }
    return result;
  }, [applications]);

  const performAction = async (application: ApplicationRecord, action: Action) => {
    const id = getId(application);
    if (!id) {
      setError("This application has no usable ID. Refresh the list and try again.");
      return;
    }
    if (busyId) return;
    if (action === "delete" && !window.confirm(`Delete application ${id}?\n\nThis may be permanent and cannot be undone.`)) return;

    setBusyId(id);
    setError("");
    setNotice("");
    try {
      let response: Response;
      if (action === "delete") {
        const params = new URLSearchParams({ applicationId: id });
        response = await fetch(`/api/admin/applications?${params.toString()}`, {
          method: "DELETE", credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" },
        });
      } else if (action === "approve" || action === "reject") {
        response = await fetch("/api/admin/applications", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ action, applicationId: id, ...(action === "reject" ? { reason: "Rejected by administrator" } : {}) }),
        });
      } else {
        response = await fetch("/api/admin/applications", {
          method: "PATCH", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ applicationId: id, status: action }),
        });
      }
      const payload = await readJson(response);
      if (!response.ok || payload.success === false) {
        if (action === "delete" && response.status === 405) {
          throw new Error("The API currently disables deletion (HTTP 405). Update the admin applications API before enabling this action.");
        }
        throw new Error(getErrorMessage(payload, `Unable to ${action.replace(/_/g, " ")} this application (HTTP ${response.status}).`));
      }
      setNotice(action === "delete" ? "Application deleted." : action === "under_review" ? "Application moved to review." : action === "pending" ? "Application returned to pending." : `Application ${action === "approve" ? "approved" : "rejected"} successfully.`);
      setSelected(null);
      await loadApplications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The requested action failed.");
    } finally {
      setBusyId("");
    }
  };

  const metrics = [
    { label: "Total applications", value: total, tone: "text-slate-950", note: "Matching records" },
    { label: "Pending", value: counts.pending, tone: "text-blue-700", note: "Current page results" },
    { label: "Under review", value: counts.under_review, tone: "text-amber-700", note: "Current page results" },
    { label: "Approved / Rejected", value: `${counts.approved} / ${counts.rejected}`, tone: "text-emerald-700", note: "Current page results" },
  ];

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">CyberNet Careers · Admin</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Applications</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Review student applications, verify education and internship details, and manage application status.</p>
          </div>
          <button type="button" onClick={() => void loadApplications()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
            <span aria-hidden="true">{loading ? "…" : "↻"}</span> Refresh
          </button>
        </header>

        <section aria-label="Application overview" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
              <p className={`mt-2 text-2xl font-black tracking-tight ${metric.tone}`}>{metric.value}</p>
              <p className="mt-1 text-xs text-slate-500">{metric.note}</p>
            </article>
          ))}
        </section>

        <section aria-label="Search and filters" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Search this page</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, application ID, domain, college, branch…" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Application status</span>
              <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 md:w-auto">Clear filters</button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Showing {filteredApplications.length} visible on this page · {total} total matching records · Search is limited to the current page.</p>
        </section>

        {error && <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-start sm:justify-between"><p>{error}</p><button type="button" onClick={() => setError("")} className="self-start font-bold underline">Dismiss</button></div>}
        {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><p>{notice}</p><button type="button" onClick={() => setNotice("")} className="font-bold underline">Dismiss</button></div>}

        <section aria-label="Applications list" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="font-extrabold text-slate-950">Application records</h2><p className="text-xs text-slate-500">Newest applications first. Select View to inspect the full submitted profile.</p></div>
          {loading ? (
            <div className="space-y-3 p-5" aria-live="polite">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}<p className="text-center text-sm text-slate-500">Loading applications…</p></div>
          ) : filteredApplications.length === 0 ? (
            <div className="px-5 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl" aria-hidden="true">⌕</div><h3 className="mt-3 font-bold text-slate-900">No applications found</h3><p className="mt-1 text-sm text-slate-500">Try changing the status filter or search term.</p></div>
          ) : (
            <>
              <div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-bold">Applicant</th><th className="px-5 py-3 font-bold">Domain / Track</th><th className="px-5 py-3 font-bold">College / Branch</th><th className="px-5 py-3 font-bold">Applied</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3 text-right font-bold">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{filteredApplications.map((application, index) => {
                  const id = getId(application);
                  const status = getStatus(application);
                  const isBusy = busyId === id;
                  const isSelected = Boolean(selected && getId(selected) === id);
                  return <tr key={id || `${getName(application)}-${text(application.createdAt, String(index))}`} className={isSelected ? "bg-blue-50/60" : "hover:bg-slate-50"}>
                    <td className="px-5 py-4"><button type="button" onClick={() => setSelected(application)} className="text-left"><span className="block font-bold text-slate-900 hover:text-blue-700">{getName(application)}</span><span className="mt-1 block text-xs text-slate-500">{getEmail(application)}</span><span className="mt-1 block font-mono text-[10px] text-slate-400">{id || "No ID"}</span></button></td>
                    <td className="px-5 py-4 text-sm text-slate-700"><span className="block font-semibold">{getDomain(application)}</span><span className="mt-1 block text-xs text-slate-500">{text(application.internshipTrack, "Track not specified")}</span></td>
                    <td className="px-5 py-4 text-sm text-slate-700"><span className="block font-semibold">{getCollege(application)}</span><span className="mt-1 block text-xs text-slate-500">{getBranch(application)}{getCourse(application) !== "—" ? ` · ${getCourse(application)}` : ""}</span></td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatDate(application.createdAt)}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusClass(status)}`}>{prettyStatus(status)}</span></td>
                    <td className="px-5 py-4 text-right"><div className="inline-flex items-center gap-2"><button type="button" onClick={() => setSelected(application)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">View</button><button type="button" disabled={Boolean(busyId)} onClick={() => void performAction(application, "delete")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Delete application ${id}`}>{isBusy ? "Working…" : "Delete"}</button></div></td>
                  </tr>;
                })}</tbody>
              </table></div>
              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-xs text-slate-500">Page {page}{totalPages ? ` of ${totalPages}` : ""}</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button type="button" disabled={loading || (totalPages > 0 ? page >= totalPages : applications.length < PAGE_SIZE)} onClick={() => setPage((current) => current + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>
            </>
          )}
        </section>

        {selected && (
          <section aria-label="Selected application details" className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Selected application</p><h2 className="mt-1 text-xl font-black text-slate-950">{getName(selected)}</h2><p className="mt-1 font-mono text-xs text-slate-500">{getId(selected) || "No application ID"}</p></div><button type="button" onClick={() => setSelected(null)} className="self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Close details</button></div>
            <div className="py-5"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Student information</p><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Full name" value={getName(selected)} /><Detail label="Email" value={getEmail(selected)} /><Detail label="Phone" value={getPhone(selected)} />
              <Detail label="Application ID" value={getId(selected) || "—"} /><Detail label="Email verified" value={text(selected.emailVerified, "Not available")} /><Detail label="Applied on" value={formatDate(selected.createdAt)} />
            </dl></div>
            <div className="border-t border-slate-100 py-5"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Education details</p><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="College / University" value={getCollege(selected)} /><Detail label="Course" value={getCourse(selected)} /><Detail label="Branch / Stream" value={getBranch(selected)} /><Detail label="Graduation year" value={text(selected.graduationYear)} />
            </dl></div>
            <div className="border-t border-slate-100 py-5"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Internship & progress</p><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Domain" value={getDomain(selected)} /><Detail label="Internship track" value={text(selected.internshipTrack)} /><Detail label="Skills" value={safeSkills(selected.skills)} wide /><Detail label="Application status" value={prettyStatus(getStatus(selected))} /><Detail label="Assessment status" value={prettyStatus(selected.assessmentStatus)} /><Detail label="Payment status" value={prettyStatus(selected.paymentStatus)} /><Detail label="Internship eligible" value={text(selected.internshipEligible, "Not available")} />
              {typeof selected.message === "string" && selected.message.trim() ? <Detail label="Applicant message" value={selected.message} wide /> : null}
            </dl></div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button type="button" disabled={Boolean(busyId)} onClick={() => void performAction(selected, "approve")} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Approve</button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => void performAction(selected, "under_review")} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">Mark under review</button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => void performAction(selected, "reject")} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">Reject</button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => void performAction(selected, "pending")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Return to pending</button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => void performAction(selected, "delete")} className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">Delete application</button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Actions use the existing admin applications API. Deletion will only work if the backend explicitly permits DELETE requests.</p>
          </section>
        )}
      </div>
    </main>
  );
}
