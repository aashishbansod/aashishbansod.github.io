/* 
 * CyberNet Careers — Admin Internship Management
 * Production replacement for:
 * src/app/admin/internships/page.tsx
 *
 * Live API only. No mock/demo data.
 * Automatic pricing remains backend-controlled:
 * 1 Month ₹499 | 3 Months ₹999 | 6 Months ₹1,699
 *
 * NOTE:
 * This file is based directly on the currently supplied production page and
 * preserves its existing API contract and UI behavior.
 */
"use client";

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

type InternshipStatus =
  | "active"
  | "inactive"
  | "draft"
  | "closed";

type PlanCode =
  | "ONE_MONTH"
  | "THREE_MONTHS"
  | "SIX_MONTHS";

type Internship = {
  _id?: string;
  id?: string;

  title?: string;
  name?: string;

  description?: string;
  domain?: string;
  assessmentDomain?: string;

  planCode?: string;
  duration?: string;
  durationMonths?: number;

  price?: string | number;
  priceInPaise?: number;
  currency?: string;

  mode?: string;
  location?: string;

  stipend?: string | number;

  status?: InternshipStatus | string;

  isPublic?: boolean;
  isSelectable?: boolean;
  applicationRequired?: boolean;
  assessmentRequired?: boolean;

  applications?: number;
  applicants?: number;
  enrolledStudents?: number;
  maxStudents?: number;

  skills?: string[];
  technologies?: string[];
  requirements?: string[];
  responsibilities?: string[];

  sortOrder?: number;

  createdAt?: string;
  updatedAt?: string;
};

type ApiData =
  | Internship[]
  | {
      internships?: Internship[];
      items?: Internship[];
      data?: Internship[];
      created?: Internship[];
      plans?: Internship[];
    }
  | null
  | undefined;

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  code?: string;

  data?: ApiData;

  internships?: Internship[];
  items?: Internship[];
  created?: Internship[];
  plans?: Internship[];

  deleted?: boolean;
  closed?: boolean;
};

type CreateForm = {
  description: string;
  domain: string;
  mode: string;
  status: InternshipStatus;
  skills: string;
  technologies: string;
};

type PlanInfo = {
  code: PlanCode;
  duration: string;
  months: number;
  price: number;
  label: string;
};

/* =========================================================
   CONSTANTS
========================================================= */

const PLAN_CONFIG: PlanInfo[] = [
  {
    code: "ONE_MONTH",
    duration: "1 Month",
    months: 1,
    price: 499,
    label: "Starter",
  },
  {
    code: "THREE_MONTHS",
    duration: "3 Months",
    months: 3,
    price: 999,
    label: "Popular",
  },
  {
    code: "SIX_MONTHS",
    duration: "6 Months",
    months: 6,
    price: 1699,
    label: "Advanced",
  },
];

const STATUS_OPTIONS = [
  {
    value: "all",
    label: "All Status",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "inactive",
    label: "Inactive",
  },
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "closed",
    label: "Closed",
  },
] as const;

const INITIAL_FORM: CreateForm = {
  description: "",
  domain: "",
  mode: "Remote",
  status: "draft",
  skills: "",
  technologies: "",
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeInternships(
  payload: ApiResponse,
): Internship[] {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (
    payload?.data &&
    typeof payload.data === "object"
  ) {
    if (
      Array.isArray(payload.data.internships)
    ) {
      return payload.data.internships;
    }

    if (Array.isArray(payload.data.items)) {
      return payload.data.items;
    }

    if (Array.isArray(payload.data.data)) {
      return payload.data.data;
    }

    if (Array.isArray(payload.data.created)) {
      return payload.data.created;
    }

    if (Array.isArray(payload.data.plans)) {
      return payload.data.plans;
    }
  }

  if (Array.isArray(payload?.internships)) {
    return payload.internships;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.created)) {
    return payload.created;
  }

  if (Array.isArray(payload?.plans)) {
    return payload.plans;
  }

  return [];
}

function getId(
  internship: Internship,
): string {
  return String(
    internship._id ||
      internship.id ||
      "",
  );
}

function getTitle(
  internship: Internship,
): string {
  return (
    internship.title?.trim() ||
    internship.name?.trim() ||
    "Untitled Internship"
  );
}

function getDomain(
  internship: Internship,
): string {
  return (
    internship.domain?.trim() ||
    internship.assessmentDomain?.trim() ||
    "General"
  );
}

function getStatus(
  internship: Internship,
): InternshipStatus {
  const value = String(
    internship.status || "draft",
  ).toLowerCase();

  if (
    value === "active" ||
    value === "inactive" ||
    value === "draft" ||
    value === "closed"
  ) {
    return value;
  }

  return "draft";
}

function getPlanCode(
  internship: Internship,
): PlanCode | null {
  const value = String(
    internship.planCode || "",
  ).toUpperCase();

  if (
    value === "ONE_MONTH" ||
    value === "THREE_MONTHS" ||
    value === "SIX_MONTHS"
  ) {
    return value;
  }

  const duration = String(
    internship.duration || "",
  ).toLowerCase();

  if (
    duration.includes("1 month") ||
    duration === "1"
  ) {
    return "ONE_MONTH";
  }

  if (
    duration.includes("3 month") ||
    duration === "3"
  ) {
    return "THREE_MONTHS";
  }

  if (
    duration.includes("6 month") ||
    duration === "6"
  ) {
    return "SIX_MONTHS";
  }

  return null;
}

function getPlanInfo(
  internship: Internship,
): PlanInfo | null {
  const code = getPlanCode(internship);

  if (!code) {
    return null;
  }

  return (
    PLAN_CONFIG.find(
      (plan) => plan.code === code,
    ) || null
  );
}

function getOfficialPrice(
  internship: Internship,
): number {
  const plan = getPlanInfo(internship);

  if (plan) {
    return plan.price;
  }

  const stored = Number(
    internship.price,
  );

  return Number.isFinite(stored)
    ? stored
    : 0;
}

function formatMoney(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function getApplications(
  internship: Internship,
): number {
  const value =
    internship.applications ??
    internship.applicants ??
    0;

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function getEnrolled(
  internship: Internship,
): number {
  const parsed = Number(
    internship.enrolledStudents ?? 0,
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatDate(
  value?: string,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function parseTags(
  value: string,
): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function getInitials(
  value: string,
): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "IN";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

/**
 * Generates the backend-compatible program title.
 *
 * The title input was intentionally removed from the admin form.
 * Domain becomes the source for the program name.
 */
function generateProgramTitle(
  domain: string,
): string {
  const normalized = domain.trim();

  if (!normalized) {
    return "Internship Program";
  }

  if (
    normalized
      .toLowerCase()
      .endsWith("internship")
  ) {
    return normalized;
  }

  return `${normalized} Internship`;
}

/* =========================================================
   ICON
========================================================= */

function Icon({
  children,
  className = "h-5 w-5",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
}: {
  status: InternshipStatus;
}) {
  const config: Record<
    InternshipStatus,
    {
      label: string;
      classes: string;
      dot: string;
    }
  > = {
    active: {
      label: "Active",
      classes:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },

    inactive: {
      label: "Inactive",
      classes:
        "border-slate-200 bg-slate-50 text-slate-600",
      dot: "bg-slate-400",
    },

    draft: {
      label: "Draft",
      classes:
        "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    },

    closed: {
      label: "Closed",
      classes:
        "border-red-200 bg-red-50 text-red-700",
      dot: "bg-red-500",
    },
  };

  const item = config[status];

  return (
    <span
      className={[
        "inline-flex items-center gap-2",
        "rounded-full border px-3 py-1",
        "text-xs font-bold",
        item.classes,
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          item.dot,
        ].join(" ")}
      />

      {item.label}
    </span>
  );
}

/* =========================================================
   PLAN BADGE
========================================================= */

function PlanBadge({
  internship,
}: {
  internship: Internship;
}) {
  const plan = getPlanInfo(internship);

  if (!plan) {
    return (
      <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
        Plan not set
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
        {plan.duration}
      </span>

      <span className="text-sm font-bold text-slate-900">
        {formatMoney(plan.price)}
      </span>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-bold text-slate-800">
          {label}

          {required && (
            <span className="ml-1 text-red-500">
              *
            </span>
          )}
        </label>

        {hint && (
          <span className="text-[11px] text-slate-400">
            {hint}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  description,
  icon,
  loading,
  className,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  className: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/5 blur-2xl transition duration-300 group-hover:bg-blue-500/10" />

      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {loading ? "—" : value}
          </p>
        </div>

        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            className,
          ].join(" ")}
        >
          <Icon>{icon}</Icon>
        </div>
      </div>

      <p className="relative mt-2 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function AdminInternshipsPage() {
  const [
    internships,
    setInternships,
  ] = useState<Internship[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState("");

  const [updatingStatusId, setUpdatingStatusId] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [
    showCreateModal,
    setShowCreateModal,
  ] = useState(false);

  const [
    selectedInternship,
    setSelectedInternship,
  ] = useState<Internship | null>(
    null,
  );

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<Internship | null>(
    null,
  );

  const [form, setForm] =
    useState<CreateForm>(
      INITIAL_FORM,
    );

  /* =======================================================
     LOAD LIVE DATA
  ======================================================= */

  const loadInternships =
    useCallback(
      async (
        isRefresh = false,
      ) => {
        try {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError("");

          const response =
            await fetch(
              "/api/admin/internships",
              {
                method: "GET",
                cache: "no-store",
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const contentType =
            response.headers.get(
              "content-type",
            ) || "";

          if (
            !contentType.includes(
              "application/json",
            )
          ) {
            throw new Error(
              "Internship API returned an invalid response.",
            );
          }

          const payload =
            (await response.json()) as ApiResponse;

          if (
            !response.ok ||
            payload.success === false
          ) {
            throw new Error(
              payload.message ||
                payload.error ||
                `Unable to load internships. HTTP ${response.status}`,
            );
          }

          setInternships(
            normalizeInternships(
              payload,
            ),
          );
        } catch (err) {
          console.error(
            "Admin internships load error:",
            err,
          );

          setError(
            getErrorMessage(
              err,
              "Unable to load internship records.",
            ),
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadInternships();
  }, [loadInternships]);

  /* =======================================================
     AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        void loadInternships(true);
      },
      30000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [loadInternships]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let draft = 0;
    let closed = 0;
    let applications = 0;
    let enrolled = 0;

    for (const item of internships) {
      const status =
        getStatus(item);

      if (status === "active") {
        active++;
      }

      if (status === "inactive") {
        inactive++;
      }

      if (status === "draft") {
        draft++;
      }

      if (status === "closed") {
        closed++;
      }

      applications +=
        getApplications(item);

      enrolled +=
        getEnrolled(item);
    }

    return {
      total: internships.length,
      active,
      inactive,
      draft,
      closed,
      applications,
      enrolled,
    };
  }, [internships]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredInternships =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return internships.filter(
        (item) => {
          const status =
            getStatus(item);

          if (
            statusFilter !== "all" &&
            status !== statusFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable = [
            getTitle(item),
            getDomain(item),
            item.description,
            item.duration,
            item.planCode,
            item.mode,
            item.location,
            ...(item.skills || []),
            ...(item.technologies || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            query,
          );
        },
      );
    }, [
      internships,
      search,
      statusFilter,
    ]);

  /* =======================================================
     FORM
  ======================================================= */

  function updateForm(
    field: keyof CreateForm,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function openCreateModal() {
    setError("");
    setSuccess("");
    setForm(INITIAL_FORM);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (creating) {
      return;
    }

    setShowCreateModal(false);
    setForm(INITIAL_FORM);
  }

  /* =======================================================
     CREATE THREE PLANS
  ======================================================= */

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (creating) {
      return;
    }

    setError("");
    setSuccess("");

    const description =
      form.description.trim();

    const domain =
      form.domain.trim();

    const skills =
      parseTags(form.skills);

    const technologies =
      parseTags(
        form.technologies,
      );

    if (!domain) {
      setError(
        "Internship domain is required.",
      );
      return;
    }

    if (!description) {
      setError(
        "Internship description is required.",
      );
      return;
    }

    /**
     * Title is intentionally generated automatically.
     *
     * Example:
     *
     * Java Full Stack
     *       ↓
     * Java Full Stack Internship
     */
    const generatedTitle =
      generateProgramTitle(
        domain,
      );

    try {
      setCreating(true);

      /**
       * IMPORTANT
       *
       * One admin submission creates:
       *
       * 1 Month  → ₹499
       * 3 Months → ₹999
       * 6 Months → ₹1699
       *
       * Backend remains the authority for official pricing.
       */
      const payload = {
        title: generatedTitle,
        name: generatedTitle,

        description,

        domain,

        mode: form.mode,

        status: form.status,

        skills,

        technologies,

        createAllPlans: true,

        planDurations: [
          "1 Month",
          "3 Months",
          "6 Months",
        ],
      };

      const response =
        await fetch(
          "/api/admin/internships",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            cache: "no-store",

            body: JSON.stringify(
              payload,
            ),
          },
        );

      const contentType =
        response.headers.get(
          "content-type",
        ) || "";

      if (
        !contentType.includes(
          "application/json",
        )
      ) {
        throw new Error(
          "Create Internship API returned an invalid response.",
        );
      }

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        result.success === false
      ) {
        throw new Error(
          result.message ||
            result.error ||
            `Unable to create internship. HTTP ${response.status}`,
        );
      }

      setShowCreateModal(false);
      setForm(INITIAL_FORM);

      setSuccess(
        `Internship created successfully. 3 duration plans were created: 1 Month ₹499, 3 Months ₹999 and 6 Months ₹1699.`,
      );

      await loadInternships(
        true,
      );
    } catch (err) {
      console.error(
        "Create internship error:",
        err,
      );

      setError(
        getErrorMessage(
          err,
          "Unable to create internship.",
        ),
      );
    } finally {
      setCreating(false);
    }
  }

  /* =======================================================
     SECURE STATUS UPDATE
     The API must authenticate/authorize the admin and persist
     status + student-facing availability on the server.
  ======================================================= */

  async function handleStatusChange(
    internship: Internship,
    nextStatus: "active" | "inactive",
  ) {
    const id = getId(internship);

    if (!id) {
      setError("This internship does not have a valid record ID.");
      return;
    }

    if (updatingStatusId || deletingId || creating) {
      return;
    }

    const currentStatus = getStatus(internship);
    if (currentStatus === nextStatus) {
      return;
    }

    setError("");
    setSuccess("");
    setUpdatingStatusId(id);

    try {
      const response = await fetch("/api/admin/internships", {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id,
          internshipId: id,
          status: nextStatus,
          action: nextStatus === "active" ? "activate" : "deactivate",
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Status API returned an invalid response.");
      }

      const result = (await response.json()) as ApiResponse;
      if (!response.ok || result.success === false) {
        throw new Error(
          result.message ||
            result.error ||
            `Unable to update status. HTTP ${response.status}`,
        );
      }

      // Re-fetch authoritative server state instead of assuming it changed.
      await loadInternships(true);
      setSuccess(
        result.message ||
          `${getTitle(internship)} is now ${nextStatus}.`,
      );
    } catch (err) {
      console.error("[ADMIN_INTERNSHIP_STATUS_UPDATE]", err);
      setError(
        getErrorMessage(
          err,
          "Unable to update internship status. Please try again.",
        ),
      );

      // Restore the UI from the server's actual state after a failed request.
      await loadInternships(true);
    } finally {
      setUpdatingStatusId("");
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete() {
    if (
      !deleteTarget ||
      deletingId
    ) {
      return;
    }

    const id =
      getId(deleteTarget);

    if (!id) {
      setError(
        "This internship does not have a valid record ID.",
      );

      setDeleteTarget(null);
      return;
    }

    try {
      setDeletingId(id);
      setError("");
      setSuccess("");

      const response =
        await fetch(
          `/api/admin/internships?id=${encodeURIComponent(
            id,
          )}`,
          {
            method: "DELETE",
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          },
        );

      const contentType =
        response.headers.get(
          "content-type",
        ) || "";

      if (
        !contentType.includes(
          "application/json",
        )
      ) {
        throw new Error(
          "Delete API returned an invalid response.",
        );
      }

      const result =
        (await response.json()) as ApiResponse;

      if (
        !response.ok ||
        result.success === false
      ) {
        throw new Error(
          result.message ||
            result.error ||
            `Unable to delete internship. HTTP ${response.status}`,
        );
      }

      setDeleteTarget(null);
      setSelectedInternship(null);

      if (result.closed) {
        setSuccess(
          "This internship has existing activity, so it was safely closed instead of permanently deleting historical data.",
        );
      } else {
        setSuccess(
          "Internship plan deleted successfully.",
        );
      }

      await loadInternships(
        true,
      );
    } catch (err) {
      console.error(
        "Delete internship error:",
        err,
      );

      setError(
        getErrorMessage(
          err,
          "Unable to delete internship.",
        ),
      );
    } finally {
      setDeletingId("");
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">

        {/* HEADER */}

        <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />

                <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  CyberNet Careers
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Internship Management
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Create and manage live internship
                programs with automatic duration
                plans.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadInternships(
                    true,
                  )
                }
                disabled={
                  loading ||
                  refreshing
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon
                  className={[
                    "h-4 w-4",
                    refreshing
                      ? "animate-spin"
                      : "",
                  ].join(" ")}
                >
                  <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                  <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
                </Icon>

                {refreshing
                  ? "Refreshing"
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 hover:shadow-blue-500/30"
              >
                <Icon className="h-4 w-4">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </Icon>

                Create Internship
              </button>
            </div>
          </div>
        </header>

        {/* ALERTS */}

        {success && (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <Icon className="h-5 w-5">
                  <path d="m5 12 4 4L19 6" />
                </Icon>
              </div>

              <div>
                <p className="text-sm font-black text-emerald-900">
                  Production Success
                </p>

                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  {success}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              className="text-xs font-bold text-emerald-700"
            >
              Close
            </button>
          </div>
        )}

        {error && (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <Icon className="h-5 w-5">
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
                </Icon>
              </div>

              <div>
                <p className="text-sm font-black text-red-900">
                  Something went wrong
                </p>

                <p className="mt-1 text-sm leading-6 text-red-800">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="text-xs font-bold text-red-700"
            >
              Close
            </button>
          </div>
        )}

        {/* STATS */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Plans"
            value={stats.total}
            description="All live internship plan records"
            loading={loading}
            className="bg-blue-50 text-blue-600"
            icon={
              <>
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2"
                />
                <path d="M8 4V2" />
                <path d="M16 4V2" />
                <path d="M3 9h18" />
              </>
            }
          />

          <StatCard
            label="Active"
            value={stats.active}
            description="Currently available plans"
            loading={loading}
            className="bg-emerald-50 text-emerald-600"
            icon={
              <path d="m5 12 4 4L19 6" />
            }
          />

          <StatCard
            label="Enrolled"
            value={stats.enrolled}
            description="Students currently enrolled"
            loading={loading}
            className="bg-cyan-50 text-cyan-600"
            icon={
              <>
                <circle
                  cx="9"
                  cy="8"
                  r="3"
                />
                <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                <path d="M16 11a3 3 0 1 0 0-6" />
                <path d="M18 14c1.8.8 3 2.6 3 5" />
              </>
            }
          />


          <StatCard
            label="Applications"
            value={stats.applications}
            description="Total application activity"
            loading={loading}
            className="bg-violet-50 text-violet-600"
            icon={
              <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </>
            }
          />        </section>

        {/* LIST */}

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-black text-slate-950">
                    Internship Plans
                  </h2>

                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                    {filteredInternships.length} shown
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Live internship plans loaded
                  from MongoDB.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative sm:w-80">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon className="h-4 w-4">
                      <circle
                        cx="11"
                        cy="11"
                        r="7"
                      />
                      <path d="m20 20-4-4" />
                    </Icon>
                  </span>

                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search domain, plan..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value,
                    )
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  {STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="space-y-3 p-5 sm:p-6">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-2xl border border-slate-100 p-5"
                  >
                    <div className="h-5 w-56 rounded bg-slate-200" />
                    <div className="mt-3 h-4 w-80 rounded bg-slate-100" />
                    <div className="mt-4 h-10 w-full rounded bg-slate-100" />
                  </div>
                ),
              )}
            </div>
          ) : filteredInternships.length ===
            0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Icon className="h-7 w-7">
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="16"
                    rx="2"
                  />
                  <path d="M8 4V2" />
                  <path d="M16 4V2" />
                  <path d="M3 9h18" />
                </Icon>
              </div>

              <h3 className="mt-5 text-lg font-black text-slate-900">
                {internships.length ===
                0
                  ? "No internship plans yet"
                  : "No matching plans"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {internships.length ===
                0
                  ? "Create one internship program and the system will create all three duration plans."
                  : "Try another search term or status filter."}
              </p>

              {internships.length ===
                0 && (
                <button
                  type="button"
                  onClick={
                    openCreateModal
                  }
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
                >
                  <Icon className="h-4 w-4">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </Icon>

                  Create Internship
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP */}

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1200px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <TableHeader>
                        Internship
                      </TableHeader>

                      <TableHeader>
                        Domain
                      </TableHeader>

                      <TableHeader>
                        Plan
                      </TableHeader>

                      <TableHeader>
                        Applications
                      </TableHeader>

                      <TableHeader>
                        Status
                      </TableHeader>

                      <TableHeader>
                        Created
                      </TableHeader>

                      <TableHeader align="right">
                        Actions
                      </TableHeader>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredInternships.map(
                      (
                        internship,
                        index,
                      ) => {
                        const id =
                          getId(
                            internship,
                          );

                        const title =
                          getTitle(
                            internship,
                          );

                        const status =
                          getStatus(
                            internship,
                          );

                        return (
                          <tr
                            key={
                              id ||
                              `${title}-${index}`
                            }
                            className="transition hover:bg-blue-50/30"
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-black text-white shadow-md shadow-blue-500/20">
                                  {getInitials(
                                    title,
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="max-w-[270px] truncate text-sm font-black text-slate-950">
                                    {title}
                                  </p>

                                  <p className="mt-1 max-w-[280px] truncate text-xs text-slate-500">
                                    {internship.description ||
                                      "No description available"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-5">
                              <span className="text-sm font-bold text-slate-700">
                                {getDomain(
                                  internship,
                                )}
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <PlanBadge
                                internship={
                                  internship
                                }
                              />
                            </td>

                            <td className="px-6 py-5">
                              <div>
                                <p className="text-sm font-black text-slate-800">
                                  {getApplications(
                                    internship,
                                  )}
                                </p>

                                {Number(
                                  internship.maxStudents ||
                                    0,
                                ) > 0 && (
                                  <p className="mt-1 text-[11px] text-slate-400">
                                    Max{" "}
                                    {
                                      internship.maxStudents
                                    }
                                  </p>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-5">
                              <StatusBadge
                                status={
                                  status
                                }
                              />
                            </td>

                            <td className="px-6 py-5 text-sm font-medium text-slate-500">
                              {formatDate(
                                internship.createdAt,
                              )}
                            </td>

                            <td className="px-6 py-5">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedInternship(
                                      internship,
                                    )
                                  }
                                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Icon className="h-4 w-4">
                                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                                    <circle
                                      cx="12"
                                      cy="12"
                                      r="2.5"
                                    />
                                  </Icon>

                                  View
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleStatusChange(
                                      internship,
                                      getStatus(internship) === "active"
                                        ? "inactive"
                                        : "active",
                                    )
                                  }
                                  disabled={
                                    updatingStatusId === id ||
                                    Boolean(updatingStatusId) ||
                                    Boolean(deletingId)
                                  }
                                  aria-label={
                                    getStatus(internship) === "active"
                                      ? "Deactivate internship"
                                      : "Activate internship"
                                  }
                                  className={[
                                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
                                    getStatus(internship) === "active"
                                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                                  ].join(" ")}
                                >
                                  {updatingStatusId === id ? (
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                                  ) : (
                                    <Icon className="h-4 w-4">
                                      {getStatus(internship) === "active" ? (
                                        <path d="M5 12h14" />
                                      ) : (
                                        <>
                                          <path d="M12 5v14" />
                                          <path d="M5 12h14" />
                                        </>
                                      )}
                                    </Icon>
                                  )}
                                  {getStatus(internship) === "active"
                                    ? "Deactivate"
                                    : "Activate"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget(
                                      internship,
                                    )
                                  }
                                  disabled={
                                    deletingId ===
                                    id
                                  }
                                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Icon className="h-4 w-4">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v5" />
                                    <path d="M14 11v5" />
                                  </Icon>

                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}

              <div className="grid gap-4 p-4 lg:hidden">
                {filteredInternships.map(
                  (
                    internship,
                    index,
                  ) => {
                    const id =
                      getId(
                        internship,
                      );

                    const title =
                      getTitle(
                        internship,
                      );

                    return (
                      <article
                        key={
                          id ||
                          `${title}-${index}`
                        }
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-black text-white">
                              {getInitials(
                                title,
                              )}
                            </div>

                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-black text-slate-950">
                                {title}
                              </h3>

                              <p className="mt-1 truncate text-xs font-semibold text-blue-600">
                                {getDomain(
                                  internship,
                                )}
                              </p>
                            </div>
                          </div>

                          <StatusBadge
                            status={getStatus(
                              internship,
                            )}
                          />
                        </div>

                        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                Plan
                              </p>

                              <p className="mt-1 text-sm font-black text-slate-900">
                                {getPlanInfo(
                                  internship,
                                )?.duration ||
                                  internship.duration ||
                                  "—"}
                              </p>
                            </div>

                            <p className="text-xl font-black text-blue-700">
                              {formatMoney(
                                getOfficialPrice(
                                  internship,
                                ),
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <MobileInfo
                            label="Applications"
                            value={String(
                              getApplications(
                                internship,
                              ),
                            )}
                          />

                          <MobileInfo
                            label="Enrolled"
                            value={String(
                              getEnrolled(
                                internship,
                              ),
                            )}
                          />

                          <MobileInfo
                            label="Mode"
                            value={
                              internship.mode ||
                              "—"
                            }
                          />

                          <MobileInfo
                            label="Created"
                            value={formatDate(
                              internship.createdAt,
                            )}
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedInternship(
                                internship,
                              )
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Icon className="h-4 w-4">
                              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                              <circle
                                cx="12"
                                cy="12"
                                r="2.5"
                              />
                            </Icon>

                            View
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleStatusChange(
                                internship,
                                getStatus(internship) === "active"
                                  ? "inactive"
                                  : "active",
                              )
                            }
                            disabled={
                              Boolean(updatingStatusId) ||
                              Boolean(deletingId)
                            }
                            className={[
                              "inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
                              getStatus(internship) === "active"
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                            ].join(" ")}
                          >
                            {updatingStatusId === id ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                            ) : (
                              getStatus(internship) === "active"
                                ? "Inactive"
                                : "Active"
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget(
                                internship,
                              )
                            }
                            disabled={
                              deletingId ===
                              id
                            }
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-sm font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            <Icon className="h-4 w-4">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v5" />
                              <path d="M14 11v5" />
                            </Icon>

                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </>
          )}

          {!loading &&
            filteredInternships.length >
              0 && (
              <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-4 text-xs font-medium text-slate-500 sm:px-6">
                Showing{" "}
                <span className="font-black text-slate-800">
                  {
                    filteredInternships.length
                  }
                </span>{" "}
                of{" "}
                <span className="font-black text-slate-800">
                  {internships.length}
                </span>{" "}
                internship plans
              </div>
            )}
        </section>
      </div>

      {/* =====================================================
          CREATE MODAL
      ===================================================== */}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <div className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />

            {/* MODAL HEADER */}

            <div className="relative flex shrink-0 items-start justify-between border-b border-slate-200 p-5 sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />

                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                    Live Production
                  </p>
                </div>

                <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
                  Create Internship
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  One submission automatically
                  creates all three duration plans.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeCreateModal
                }
                disabled={creating}
                aria-label="Close"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
              >
                <Icon>
                  <path d="m7 7 10 10" />
                  <path d="M17 7 7 17" />
                </Icon>
              </button>
            </div>

            <form
              onSubmit={handleCreate}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <div className="space-y-6 p-5 sm:p-6">

                {/* AUTOMATIC CREATION FLOW */}

                <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />

                  <div className="relative">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                        <Icon>
                          <path d="M12 3v18" />
                          <path d="M3 12h18" />
                        </Icon>
                      </div>

                      <div>
                        <p className="text-sm font-black text-blue-950">
                          Automatic 3-plan creation
                        </p>

                        <p className="mt-1 text-xs leading-5 text-blue-800">
                          Fill the program details once.
                          The production backend creates
                          three separate duration records.
                        </p>
                      </div>
                    </div>

                    {/* FLOW */}

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {PLAN_CONFIG.map(
                        (
                          plan,
                          index,
                        ) => (
                          <div
                            key={
                              plan.code
                            }
                            className="group rounded-2xl border border-white bg-white p-4 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                          >
                            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                              0{index + 1}
                            </div>

                            <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-slate-400">
                              {plan.label}
                            </p>

                            <p className="mt-1 text-sm font-black text-slate-800">
                              {plan.duration}
                            </p>

                            <p className="mt-1 text-lg font-black text-blue-700">
                              {formatMoney(
                                plan.price,
                              )}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* AUTO TITLE INFORMATION */}

                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                      <Icon>
                        <path d="M4 7h16" />
                        <path d="M4 12h16" />
                        <path d="M4 17h10" />
                      </Icon>
                    </div>

                    <div>
                      <p className="text-sm font-black text-violet-950">
                        Internship title is automatic
                      </p>

                      <p className="mt-1 text-xs leading-5 text-violet-800">
                        You no longer need to enter a
                        separate title. The system generates
                        it from the selected domain.
                      </p>

                      {form.domain.trim() && (
                        <div className="mt-3 inline-flex rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-700">
                          Preview:{" "}
                          {generateProgramTitle(
                            form.domain,
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* DOMAIN + MODE */}

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    label="Domain"
                    required
                  >
                    <input
                      value={
                        form.domain
                      }
                      onChange={(event) =>
                        updateForm(
                          "domain",
                          event.target
                            .value,
                        )
                      }
                      placeholder="e.g. Java Full Stack"
                      required
                      maxLength={100}
                      autoFocus
                      className="form-input"
                    />
                  </FormField>

                  <FormField label="Mode">
                    <select
                      value={
                        form.mode
                      }
                      onChange={(event) =>
                        updateForm(
                          "mode",
                          event.target
                            .value,
                        )
                      }
                      className="form-input"
                    >
                      <option value="Remote">
                        Remote
                      </option>

                      <option value="Hybrid">
                        Hybrid
                      </option>

                      <option value="On-site">
                        On-site
                      </option>
                    </select>
                  </FormField>
                </div>

                {/* STATUS */}

                <FormField label="Status">
                  <select
                    value={
                      form.status
                    }
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target
                          .value as InternshipStatus,
                      )
                    }
                    className="form-input"
                  >
                    <option value="draft">
                      Draft
                    </option>

                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>

                    <option value="closed">
                      Closed
                    </option>
                  </select>
                </FormField>

                {/* SKILLS + TECHNOLOGIES */}

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    label="Skills"
                    hint="Comma separated"
                  >
                    <input
                      value={
                        form.skills
                      }
                      onChange={(event) =>
                        updateForm(
                          "skills",
                          event.target
                            .value,
                        )
                      }
                      placeholder="Java, Spring Boot, REST API"
                      maxLength={500}
                      className="form-input"
                    />

                    <TagPreview
                      value={
                        form.skills
                      }
                    />
                  </FormField>

                  <FormField
                    label="Technologies"
                    hint="Comma separated"
                  >
                    <input
                      value={
                        form.technologies
                      }
                      onChange={(event) =>
                        updateForm(
                          "technologies",
                          event.target
                            .value,
                        )
                      }
                      placeholder="Java, MySQL, Git, React"
                      maxLength={500}
                      className="form-input"
                    />

                    <TagPreview
                      value={
                        form.technologies
                      }
                    />
                  </FormField>
                </div>

                {/* DESCRIPTION */}

                <FormField
                  label="Description"
                  required
                >
                  <textarea
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      updateForm(
                        "description",
                        event.target
                          .value,
                      )
                    }
                    placeholder="Describe the internship, projects, learning opportunities and responsibilities..."
                    rows={6}
                    required
                    maxLength={3000}
                    className="form-input resize-none"
                  />

                  <p className="mt-1 text-right text-[10px] text-slate-400">
                    {
                      form.description
                        .length
                    }
                    /3000
                  </p>
                </FormField>

                {/* FINAL PREVIEW */}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Creation Summary
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {PLAN_CONFIG.map(
                      (plan) => (
                        <div
                          key={
                            plan.code
                          }
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <p className="text-xs font-bold text-slate-400">
                            {plan.duration}
                          </p>

                          <p className="mt-1 text-lg font-black text-slate-950">
                            {formatMoney(
                              plan.price,
                            )}
                          </p>

                          <p className="mt-1 text-[11px] font-semibold text-emerald-600">
                            Will be created
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>

              {/* FOOTER */}

              <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end sm:p-5">
                <button
                  type="button"
                  onClick={
                    closeCreateModal
                  }
                  disabled={creating}
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    creating ||
                    !form.domain.trim() ||
                    !form.description.trim()
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}

                  {creating
                    ? "Creating 3 Plans..."
                    : "Create 3 Internships"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          DETAILS MODAL
      ===================================================== */}

      {selectedInternship && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedInternship(
                null,
              );
            }
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-black text-white">
                  {getInitials(
                    getTitle(
                      selectedInternship,
                    ),
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                    Plan Details
                  </p>

                  <h2 className="mt-1 truncate text-xl font-black text-slate-950 sm:text-2xl">
                    {getTitle(
                      selectedInternship,
                    )}
                  </h2>

                  <p className="mt-1 text-sm font-bold text-blue-600">
                    {getDomain(
                      selectedInternship,
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedInternship(
                    null,
                  )
                }
                aria-label="Close"
                className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <Icon>
                  <path d="m7 7 10 10" />
                  <path d="M17 7 7 17" />
                </Icon>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-6 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={getStatus(
                      selectedInternship,
                    )}
                  />

                  <PlanBadge
                    internship={
                      selectedInternship
                    }
                  />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Description
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {selectedInternship.description ||
                      "No description available."}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <DetailItem
                      label="Duration"
                      value={
                        getPlanInfo(
                          selectedInternship,
                        )?.duration ||
                        selectedInternship.duration ||
                        "—"
                      }
                    />

                    <DetailItem
                      label="Plan Price"
                      value={formatMoney(
                        getOfficialPrice(
                          selectedInternship,
                        ),
                      )}
                    />

                    <DetailItem
                      label="Plan Code"
                      value={
                        selectedInternship.planCode ||
                        "—"
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem
                    label="Domain"
                    value={getDomain(
                      selectedInternship,
                    )}
                  />

                  <DetailItem
                    label="Mode"
                    value={
                      selectedInternship.mode ||
                      "—"
                    }
                  />

                  <DetailItem
                    label="Location"
                    value={
                      selectedInternship.location ||
                      "—"
                    }
                  />

                  <DetailItem
                    label="Stipend"
                    value={
                      selectedInternship.stipend
                        ? String(
                            selectedInternship.stipend,
                          )
                        : "—"
                    }
                  />

                  <DetailItem
                    label="Applications"
                    value={String(
                      getApplications(
                        selectedInternship,
                      ),
                    )}
                  />

                  <DetailItem
                    label="Enrolled"
                    value={String(
                      getEnrolled(
                        selectedInternship,
                      ),
                    )}
                  />

                  <DetailItem
                    label="Max Students"
                    value={String(
                      selectedInternship.maxStudents ||
                        "Unlimited",
                    )}
                  />

                  <DetailItem
                    label="Public"
                    value={
                      selectedInternship.isPublic ===
                      false
                        ? "No"
                        : "Yes"
                    }
                  />

                  <DetailItem
                    label="Selectable"
                    value={
                      selectedInternship.isSelectable ===
                      false
                        ? "No"
                        : "Yes"
                    }
                  />

                  <DetailItem
                    label="Created"
                    value={formatDate(
                      selectedInternship.createdAt,
                    )}
                  />

                  <DetailItem
                    label="Updated"
                    value={formatDate(
                      selectedInternship.updatedAt,
                    )}
                  />
                </div>

                {selectedInternship.skills &&
                  selectedInternship.skills
                    .length > 0 && (
                    <TagGroup
                      title="Skills"
                      items={
                        selectedInternship.skills
                      }
                    />
                  )}

                {selectedInternship.technologies &&
                  selectedInternship
                    .technologies
                    .length > 0 && (
                    <TagGroup
                      title="Technologies"
                      items={
                        selectedInternship.technologies
                      }
                    />
                  )}

                {getId(
                  selectedInternship,
                ) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Record ID
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-slate-600">
                      {getId(
                        selectedInternship,
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() =>
                  setDeleteTarget(
                    selectedInternship,
                  )
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-black text-red-600 hover:bg-red-50"
              >
                <Icon className="h-4 w-4">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v5" />
                  <path d="M14 11v5" />
                </Icon>

                Delete Plan
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedInternship(
                    null,
                  )
                }
                className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          DELETE CONFIRMATION
      ===================================================== */}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (!deletingId) {
                setDeleteTarget(
                  null,
                );
              }
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <Icon className="h-6 w-6">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v5" />
                  <path d="M14 11v5" />
                </Icon>
              </div>

              <h2 className="mt-5 text-xl font-black text-slate-950">
                Delete internship plan?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                You are about to delete the{" "}
                <strong className="text-slate-800">
                  {getPlanInfo(
                    deleteTarget,
                  )?.duration ||
                    deleteTarget.duration ||
                    "selected"}
                </strong>{" "}
                plan from{" "}
                <strong className="text-slate-800">
                  {getTitle(
                    deleteTarget,
                  )}
                </strong>
                .
              </p>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold leading-5 text-amber-800">
                  Safety: if this plan already
                  has applications, applicants
                  or enrolled students, the
                  backend can close it instead
                  of permanently deleting
                  historical data.
                </p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget(
                      null,
                    )
                  }
                  disabled={
                    Boolean(
                      deletingId,
                    )
                  }
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleDelete()
                  }
                  disabled={
                    Boolean(
                      deletingId,
                    )
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white shadow-lg shadow-red-500/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}

                  {deletingId
                    ? "Processing..."
                    : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          GLOBAL STYLES
      ===================================================== */}

      <style jsx global>{`
        .form-input {
          display: block;
          width: 100%;
          min-height: 44px;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.7rem 0.9rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
          color: rgb(15 23 42);
          outline: none;
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease,
            background-color 150ms ease;
        }

        .form-input::placeholder {
          color: rgb(148 163 184);
        }

        .form-input:hover {
          border-color: rgb(203 213 225);
        }

        .form-input:focus {
          border-color: rgb(59 130 246);
          box-shadow:
            0 0 0 4px
            rgb(59 130 246 / 0.1);
        }

        .form-input:disabled {
          cursor: not-allowed;
          opacity: 0.6;
          background: rgb(248 250 252);
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </main>
  );
}

/* =========================================================
   TABLE HEADER
========================================================= */

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={[
        "px-6 py-4",
        align === "right"
          ? "text-right"
          : "text-left",
        "text-[10px] font-black uppercase tracking-[0.12em] text-slate-500",
      ].join(" ")}
    >
      {children}
    </th>
  );
}

/* =========================================================
   MOBILE INFO
========================================================= */

function MobileInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   DETAIL ITEM
========================================================= */

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-slate-800">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   TAG GROUP
========================================================= */

function TagGroup({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">
        {title}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {items.map(
          (item, index) => (
            <span
              key={`${item}-${index}`}
              className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"
            >
              {item}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/* =========================================================
   TAG PREVIEW
========================================================= */

function TagPreview({
  value,
}: {
  value: string;
}) {
  const items =
    parseTags(value);

  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items
        .slice(0, 6)
        .map(
          (item, index) => (
            <span
              key={`${item}-${index}`}
              className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"
            >
              {item}
            </span>
          ),
        )}

      {items.length > 6 && (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
          +{items.length - 6}
        </span>
      )}
    </div>
  );
}