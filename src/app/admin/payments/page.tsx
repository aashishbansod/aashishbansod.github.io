
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type PaymentStatus = "success" | "pending" | "failed" | "refunded" | "expired";
type ApprovalStatus = "pending" | "approved" | "rejected" | "not_assigned";
type PaymentFilter = "all" | PaymentStatus;
type ApprovalFilter = "all" | ApprovalStatus;

type Payment = {
  _id?: string;
  id?: string;
  paymentId?: string;
  razorpayPaymentId?: string;
  orderId?: string;
  razorpayOrderId?: string;
  studentName?: string;
  studentId?: string;
  email?: string;
  mobile?: string;
  internship?: string;
  internshipName?: string;
  planCode?: string;
  planName?: string;
  durationDays?: number;
  checkoutExpiresAt?: string;
  selectionExpiresAt?: string;
  domain?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  paymentStatus?: string;
  method?: string;
  paymentMethod?: string;
  createdAt?: string;
  updatedAt?: string;
  enrollmentStatus?: string;
  approvalStatus?: string;
  studentAdminApprovalStatus?: string;
  assignedStudentAdmin?: string | Record<string, unknown>;
  assignedStudentAdminName?: string;
  studentAdminName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedAt?: string;
  adminRemarks?: string;
  student?: Record<string, unknown>;
  internshipDetails?: Record<string, unknown>;
  studentAdmin?: Record<string, unknown>;
  enrollment?: Record<string, unknown>;
  [key: string]: unknown;
};

type PaymentStats = {
  total: number;
  successful: number;
  pending: number;
  failed: number;
  refunded: number;
  expired: number;
  revenue: number;
};

type EnrollmentStats = {
  pending: number;
  approved: number;
  rejected: number;
  unassigned: number;
};

type ApiPayload = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: unknown;
  payments?: unknown;
  stats?: Partial<PaymentStats>;
};

const EMPTY_STATS: PaymentStats = {
  total: 0,
  successful: 0,
  pending: 0,
  failed: 0,
  refunded: 0,
  expired: 0,
  revenue: 0,
};

const PAYMENT_FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: "all", label: "All payments" },
  { value: "success", label: "Successful" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "expired", label: "Expired checkout" },
];

const APPROVAL_FILTERS: { value: ApprovalFilter; label: string }[] = [
  { value: "all", label: "All enrollments" },
  { value: "pending", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "not_assigned", label: "Not assigned" },
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function getPaymentId(payment: Payment): string {
  return text(payment._id, payment.id, payment.paymentId);
}

function getStudentName(payment: Payment): string {
  const student = record(payment.student);
  return text(payment.studentName, student.name, student.fullName, "Unknown student");
}

function getStudentEmail(payment: Payment): string {
  const student = record(payment.student);
  return text(payment.email, student.email);
}

function getStudentId(payment: Payment): string {
  const student = record(payment.student);
  return text(payment.studentId, student.studentId, student._id, student.id);
}

function getPlanCode(payment: Payment): string {
  const raw = text(payment.planCode, payment.planName).toUpperCase().replace(/[\s-]+/g, "_");
  if (["ONE_MONTH", "THREE_MONTHS", "SIX_MONTHS"].includes(raw)) return raw;
  if (raw.includes("SIX") || raw.includes("6_MONTH")) return "SIX_MONTHS";
  if (raw.includes("THREE") || raw.includes("3_MONTH")) return "THREE_MONTHS";
  if (raw.includes("ONE") || raw.includes("1_MONTH")) return "ONE_MONTH";
  return raw || "PLAN_NOT_REPORTED";
}

function getPlanLabel(payment: Payment): string {
  const code = getPlanCode(payment);
  const labels: Record<string, string> = {
    ONE_MONTH: "One Month · 30 Days · ₹499",
    THREE_MONTHS: "Three Months · 90 Days · ₹999",
    SIX_MONTHS: "Six Months · 180 Days · ₹1,699",
  };
  return labels[code] || text(payment.planName, payment.planCode, "Plan not reported");
}

function getInternship(payment: Payment): string {
  const internship = record(payment.internshipDetails);
  return text(
    payment.internship,
    payment.internshipName,
    internship.title,
    internship.name,
    payment.domain,
    "Internship not specified"
  );
}

function getAmount(payment: Payment): number {
  const raw = typeof payment.amount === "string"
    ? Number(payment.amount.replace(/[₹,\s]/g, ""))
    : Number(payment.amount ?? 0);

  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function getStatus(payment: Payment): PaymentStatus {
  const value = text(payment.paymentStatus, payment.status)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (["success", "successful", "paid", "captured", "completed"].includes(value)) {
    return "success";
  }

  if (["failed", "failure", "cancelled", "canceled"].includes(value)) {
    return "failed";
  }

  if (["refunded", "refund", "partially_refunded"].includes(value)) {
    return "refunded";
  }

  if (["expired", "checkout_expired", "order_expired", "session_expired"].includes(value)) {
    return "expired";
  }

  return "pending";
}

function getApprovalStatus(payment: Payment): ApprovalStatus {
  const enrollment = record(payment.enrollment);
  const admin = record(payment.studentAdmin);

  const value = text(
    payment.studentAdminApprovalStatus,
    payment.approvalStatus,
    enrollment.approvalStatus,
    enrollment.status,
    admin.approvalStatus
  ).toLowerCase().replace(/[\s-]+/g, "_");

  if (["approved", "accepted", "active", "activated"].includes(value)) {
    return "approved";
  }

  if (["rejected", "declined"].includes(value)) {
    return "rejected";
  }

  if (["pending", "under_review", "submitted"].includes(value)) {
    return "pending";
  }

  if (["not_assigned", "unassigned"].includes(value)) {
    return "not_assigned";
  }

  return "not_assigned";
}

function getAssignedAdmin(payment: Payment): string {
  const admin = record(payment.assignedStudentAdmin);
  const studentAdmin = record(payment.studentAdmin);

  return text(
    payment.assignedStudentAdminName,
    payment.studentAdminName,
    admin.name,
    admin.fullName,
    admin.email,
    studentAdmin.name,
    studentAdmin.email,
    typeof payment.assignedStudentAdmin === "string"
      ? payment.assignedStudentAdmin
      : ""
  );
}

function getApprovedBy(payment: Payment): string {
  const enrollment = record(payment.enrollment);

  return text(
    payment.approvedByName,
    payment.approvedBy,
    enrollment.approvedByName,
    enrollment.approvedBy
  );
}

function getPaymentDate(payment: Payment): string {
  return text(payment.createdAt, payment.updatedAt);
}

function currency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function dateTime(value?: string): string {
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
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return (parts[0] || "ST").slice(0, 2).toUpperCase();
}

function messageFrom(payload: unknown, fallback: string): string {
  const data = record(payload);

  return text(data.message, data.error, fallback);
}

function extractPayments(payload: ApiPayload | null): Payment[] {
  if (!payload) return [];

  const data = record(payload.data);

  const candidates = [
    payload.payments,
    Array.isArray(payload.data) ? payload.data : undefined,
    data.payments,
    data.items,
    data.records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Payment =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      );
    }
  }

  return [];
}

function calculateStats(payments: Payment[]): PaymentStats {
  return payments.reduce<PaymentStats>((stats, payment) => {
    stats.total += 1;

    const status = getStatus(payment);

    if (status === "success") {
      stats.successful += 1;
      stats.revenue += getAmount(payment);
    } else if (status === "pending") {
      stats.pending += 1;
    } else if (status === "failed") {
      stats.failed += 1;
    } else if (status === "refunded") {
      stats.refunded += 1;
    } else {
      stats.expired += 1;
    }

    return stats;
  }, { ...EMPTY_STATS });
}

function resolveStats(
  serverStats: Partial<PaymentStats> | undefined,
  payments: Payment[]
): PaymentStats {
  const calculated = calculateStats(payments);

  if (!serverStats) return calculated;

  const numberOr = (value: unknown, fallback: number) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : fallback;
  };

  return {
    total: numberOr(serverStats.total, calculated.total),
    successful: numberOr(serverStats.successful, calculated.successful),
    pending: numberOr(serverStats.pending, calculated.pending),
    failed: numberOr(serverStats.failed, calculated.failed),
    refunded: numberOr(serverStats.refunded, calculated.refunded),
    expired: numberOr(serverStats.expired, calculated.expired),
    revenue: numberOr(serverStats.revenue, calculated.revenue),
  };
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<PaymentStatus, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
    refunded: "border-violet-200 bg-violet-50 text-violet-700",
    expired: "border-slate-200 bg-slate-100 text-slate-700",
  };

  const labels: Record<PaymentStatus, string> = {
    success: "Successful",
    pending: "Pending",
    failed: "Failed",
    refunded: "Refunded",
    expired: "Expired checkout",
  };

  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status]}
    </span>
  );
}

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const styles: Record<ApprovalStatus, string> = {
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rejected: "border-rose-200 bg-rose-50 text-rose-700",
    not_assigned: "border-slate-200 bg-slate-100 text-slate-600",
  };

  const labels: Record<ApprovalStatus, string> = {
    pending: "Pending approval",
    approved: "Approved",
    rejected: "Rejected",
    not_assigned: "Not assigned",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const paths: Record<string, ReactNode> = {
    payments: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    failed: <><circle cx="12" cy="12" r="9" /><path d="m8 8 8 8M16 8l-8 8" /></>,
    revenue: <><path d="M12 3v18M17 7.5c0-1.7-1.9-3-5-3s-5 1.3-5 3 1.9 3 5 3 5 1.3 5 3-1.9 3-5 3-5-1.3-5-3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14.8 4.5L21 15M21 20v-5h-5" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  };

  return <svg {...common}>{paths[name] || paths.payments}</svg>;
}

function StatCard({
  label,
  value,
  description,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  tone: string;
  loading: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className={`mt-3 truncate text-2xl font-black tracking-tight sm:text-3xl ${tone}`}>
            {loading ? "—" : value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700">
          {icon}
        </div>
      </div>
    </article>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className={`mt-2 break-words text-sm font-bold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function exportPayments(payments: Payment[]) {
  const headers = [
    "Student Name",
    "Student ID",
    "Email",
    "Internship",
    "Plan",
    "Amount",
    "Payment Status",
    "Payment ID",
    "Order ID",
    "Payment Method",
    "Approval Status",
    "Student Admin",
    "Approved By",
    "Date",
  ];

  const rows = payments.map((payment) => [
    getStudentName(payment),
    getStudentId(payment),
    getStudentEmail(payment),
    getInternship(payment),
    getPlanCode(payment),
    getAmount(payment),
    getStatus(payment),
    text(payment.paymentId, payment.razorpayPaymentId),
    text(payment.orderId, payment.razorpayOrderId),
    text(payment.method, payment.paymentMethod),
    getApprovalStatus(payment),
    getAssignedAdmin(payment),
    getApprovedBy(payment),
    getPaymentDate(payment),
  ]);

  const escapeCsv = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `cybernet-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>(EMPTY_STATS);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const requestInProgress = useRef(false);

  const loadPayments = useCallback(async (isRefresh = false) => {
    if (requestInProgress.current) return;

    requestInProgress.current = true;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/admin/payments", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json().catch(() => null) as ApiPayload | null;

      if (!response.ok) {
        throw new Error(
          messageFrom(payload, `Unable to load payments. HTTP ${response.status}.`)
        );
      }

      if (!payload || payload.success === false) {
        throw new Error(
          messageFrom(payload, "The payment service returned an invalid response.")
        );
      }

      const list = extractPayments(payload);

      setPayments(list);
      setStats(resolveStats(payload.stats, list));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load payment records."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    void loadPayments();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadPayments(true);
      }
    }, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadPayments(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadPayments]);

  useEffect(() => {
    setPage(1);
  }, [search, paymentFilter, approvalFilter, pageSize]);

  useEffect(() => {
    if (!selectedPayment) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPayment(null);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedPayment]);

  const enrollmentStats = useMemo<EnrollmentStats>(() => {
    return payments.reduce<EnrollmentStats>(
      (result, payment) => {
        if (getStatus(payment) !== "success") return result;

        const approval = getApprovalStatus(payment);

        if (approval === "pending") result.pending += 1;
        else if (approval === "approved") result.approved += 1;
        else if (approval === "rejected") result.rejected += 1;
        else result.unassigned += 1;

        return result;
      },
      {
        pending: 0,
        approved: 0,
        rejected: 0,
        unassigned: 0,
      }
    );
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const paymentStatus = getStatus(payment);
      const approvalStatus = getApprovalStatus(payment);

      if (paymentFilter !== "all" && paymentStatus !== paymentFilter) {
        return false;
      }

      if (approvalFilter !== "all" && approvalStatus !== approvalFilter) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        getStudentName(payment),
        getStudentId(payment),
        getStudentEmail(payment),
        getInternship(payment),
        payment.paymentId,
        payment.razorpayPaymentId,
        payment.orderId,
        payment.razorpayOrderId,
        payment.method,
        payment.paymentMethod,
        getAssignedAdmin(payment),
        getApprovedBy(payment),
        paymentStatus,
        approvalStatus,
      ];

      return searchable.some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    });
  }, [payments, search, paymentFilter, approvalFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / pageSize)
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  const hasFilters =
    Boolean(search.trim()) ||
    paymentFilter !== "all" ||
    approvalFilter !== "all";

  const firstRecord = filteredPayments.length
    ? (currentPage - 1) * pageSize + 1
    : 0;

  const lastRecord = Math.min(
    currentPage * pageSize,
    filteredPayments.length
  );

  return (
    <main className="min-h-screen bg-[#f5f8fc] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                CyberNet Careers
                <span className="text-slate-300">/</span>
                Main Admin
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Payment & Enrollment
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Manage student transactions, internship enrollment,
                payment verification and Student Admin approval visibility
                from one central workspace.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Payment API
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                  <Icon name="shield" className="h-3.5 w-3.5" />
                  Main Admin View
                </span>

                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
                  Auto refresh · 30 seconds
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadPayments(true)}
                disabled={loading || refreshing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon
                  name="refresh"
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() => exportPayments(filteredPayments)}
                disabled={filteredPayments.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="download" className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
        </header>

        {(error || successMessage) && (
          <div
            role="alert"
            className={`flex items-start justify-between gap-4 rounded-2xl border p-4 ${
              error
                ? "border-rose-200 bg-rose-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                name={error ? "alert" : "check"}
                className={`h-5 w-5 shrink-0 ${
                  error ? "text-rose-600" : "text-emerald-600"
                }`}
              />

              <div>
                <p className={`text-sm font-black ${error ? "text-rose-900" : "text-emerald-900"}`}>
                  {error ? "Unable to load payment information" : "Success"}
                </p>
                <p className={`mt-1 text-sm ${error ? "text-rose-700" : "text-emerald-700"}`}>
                  {error || successMessage}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
          </div>
        )}

        <section
          aria-label="Financial overview"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
        >
          <StatCard
            label="Total Payments"
            value={stats.total.toLocaleString("en-IN")}
            description="All transaction records"
            icon={<Icon name="payments" />}
            tone="text-slate-950"
            loading={loading}
          />

          <StatCard
            label="Successful"
            value={stats.successful.toLocaleString("en-IN")}
            description="Verified successful transactions"
            icon={<Icon name="check" />}
            tone="text-emerald-600"
            loading={loading}
          />

          <StatCard
            label="Pending"
            value={stats.pending.toLocaleString("en-IN")}
            description="Awaiting payment confirmation"
            icon={<Icon name="clock" />}
            tone="text-amber-600"
            loading={loading}
          />

          <StatCard
            label="Failed / Refunded"
            value={(stats.failed + stats.refunded).toLocaleString("en-IN")}
            description={`${stats.failed} failed · ${stats.refunded} refunded`}
            icon={<Icon name="failed" />}
            tone="text-rose-600"
            loading={loading}
          />

          <StatCard
            label="Expired Checkouts"
            value={stats.expired.toLocaleString("en-IN")}
            description="Expired unpaid checkout sessions"
            icon={<Icon name="clock" />}
            tone="text-slate-700"
            loading={loading}
          />

          <StatCard
            label="Total Revenue"
            value={currency(stats.revenue)}
            description="Successful payments reported by API"
            icon={<Icon name="revenue" />}
            tone="text-violet-600"
            loading={loading}
          />
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-950">
                  Student Admin Approval Overview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enrollment approval information associated with successful payments.
                </p>
              </div>

              <span className="inline-flex items-center gap-2 self-start rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                <Icon name="users" className="h-4 w-4" />
                Enrollment tracking
              </span>
            </div>
          </div>

          <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setApprovalFilter("pending")}
              className={`border-b border-slate-100 p-5 text-left transition hover:bg-amber-50/60 sm:border-r ${
                approvalFilter === "pending" ? "bg-amber-50" : ""
              }`}
            >
              <p className="text-xs font-bold text-slate-500">
                Pending Approval
              </p>
              <p className="mt-2 text-3xl font-black text-amber-600">
                {loading ? "—" : enrollmentStats.pending}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Awaiting Student Admin review
              </p>
            </button>

            <button
              type="button"
              onClick={() => setApprovalFilter("approved")}
              className={`border-b border-slate-100 p-5 text-left transition hover:bg-emerald-50/60 xl:border-r ${
                approvalFilter === "approved" ? "bg-emerald-50" : ""
              }`}
            >
              <p className="text-xs font-bold text-slate-500">
                Approved Students
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-600">
                {loading ? "—" : enrollmentStats.approved}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Approved enrollment records
              </p>
            </button>

            <button
              type="button"
              onClick={() => setApprovalFilter("rejected")}
              className={`border-b border-slate-100 p-5 text-left transition hover:bg-rose-50/60 sm:border-r xl:border-r ${
                approvalFilter === "rejected" ? "bg-rose-50" : ""
              }`}
            >
              <p className="text-xs font-bold text-slate-500">
                Rejected
              </p>
              <p className="mt-2 text-3xl font-black text-rose-600">
                {loading ? "—" : enrollmentStats.rejected}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Rejected enrollment records
              </p>
            </button>

            <button
              type="button"
              onClick={() => setApprovalFilter("not_assigned")}
              className={`p-5 text-left transition hover:bg-slate-100 ${
                approvalFilter === "not_assigned" ? "bg-slate-100" : ""
              }`}
            >
              <p className="text-xs font-bold text-slate-500">
                Not Assigned
              </p>
              <p className="mt-2 text-3xl font-black text-slate-700">
                {loading ? "—" : enrollmentStats.unassigned}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                No approval assignment returned
              </p>
            </button>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
            <p className="text-xs leading-5 text-slate-500">
              Approval counts are calculated from enrollment and Student Admin
              fields returned by the existing payment API. Missing approval
              information is shown as Not Assigned, not as approved.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-950">
                  Transaction & Student Records
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search transactions, inspect student profiles and review approval information.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
                <label className="relative block flex-1 xl:w-80">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon name="search" className="h-4 w-4" />
                  </span>

                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search student, ID, transaction..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>

                <select
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
                  aria-label="Filter payment status"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  {PAYMENT_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={approvalFilter}
                  onChange={(event) => setApprovalFilter(event.target.value as ApprovalFilter)}
                  aria-label="Filter enrollment approval"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  {APPROVAL_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Showing{" "}
                <strong className="text-slate-900">{filteredPayments.length}</strong>{" "}
                matching records out of{" "}
                <strong className="text-slate-900">{payments.length}</strong>
              </p>

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPaymentFilter("all");
                    setApprovalFilter("all");
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="h-48 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Icon name="payments" className="h-8 w-8" />
              </div>

              <h3 className="mt-5 text-lg font-black text-slate-950">
                {hasFilters ? "No matching records found" : "No payment records yet"}
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                {hasFilters
                  ? "Try changing the search term or payment and approval filters."
                  : "Student transactions will appear here when the payment API returns records."}
              </p>

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPaymentFilter("all");
                    setApprovalFilter("all");
                  }}
                  className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto 2xl:block">
                <table className="w-full min-w-[1450px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {[
                        "Student",
                        "Internship",
                        "Transaction",
                        "Amount",
                        "Payment",
                        "Student Admin",
                        "Approval",
                        "Date",
                        "Action",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`px-4 py-4 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 ${
                            heading === "Action" ? "text-right" : ""
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {paginatedPayments.map((payment, index) => {
                      const id = getPaymentId(payment) || `payment-${index}`;

                      return (
                        <tr key={id} className="transition hover:bg-blue-50/40">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white">
                                {initials(getStudentName(payment))}
                              </div>

                              <div className="min-w-0">
                                <p className="max-w-[175px] truncate text-sm font-black text-slate-900">
                                  {getStudentName(payment)}
                                </p>
                                <p className="max-w-[175px] truncate text-xs text-slate-500">
                                  {getStudentEmail(payment) || "No email"}
                                </p>
                                <p className="mt-0.5 text-[10px] font-bold text-blue-600">
                                  {getStudentId(payment) || "No student ID"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <p className="max-w-[160px] truncate text-sm font-bold text-slate-800">
                              {getInternship(payment)}
                            </p>
                            <p className="mt-1 max-w-[160px] truncate text-[10px] font-bold text-blue-600">
                              {getPlanLabel(payment)}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <p className="max-w-[165px] truncate font-mono text-xs font-bold text-slate-800">
                              {text(payment.paymentId, payment.razorpayPaymentId) || "—"}
                            </p>
                            <p className="mt-1 max-w-[165px] truncate font-mono text-[10px] text-slate-400">
                              {text(payment.orderId, payment.razorpayOrderId) || "No order ID"}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <p className="text-sm font-black text-slate-950">
                              {currency(getAmount(payment))}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {text(payment.currency, "INR")}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge status={getStatus(payment)} />
                          </td>

                          <td className="px-4 py-4">
                            <p className="max-w-[140px] truncate text-xs font-bold text-slate-700">
                              {getAssignedAdmin(payment) || "Not assigned"}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <ApprovalBadge status={getApprovalStatus(payment)} />
                          </td>

                          <td className="px-4 py-4">
                            <p className="whitespace-nowrap text-xs font-medium text-slate-600">
                              {dateTime(getPaymentDate(payment))}
                            </p>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedPayment(payment)}
                              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Icon name="eye" className="h-4 w-4" />
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2 2xl:hidden">
                {paginatedPayments.map((payment, index) => (
                  <article
                    key={getPaymentId(payment) || `mobile-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white">
                          {initials(getStudentName(payment))}
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black text-slate-950">
                            {getStudentName(payment)}
                          </h3>
                          <p className="truncate text-xs text-slate-500">
                            {getStudentEmail(payment)}
                          </p>
                          <p className="mt-0.5 text-[10px] font-bold text-blue-600">
                            {getStudentId(payment) || "No student ID"}
                          </p>
                        </div>
                      </div>

                      <StatusBadge status={getStatus(payment)} />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <DetailItem
                        label="Amount"
                        value={currency(getAmount(payment))}
                      />

                      <DetailItem
                        label="Internship"
                        value={getInternship(payment)}
                      />

                      <DetailItem
                        label="Internship Plan"
                        value={getPlanLabel(payment)}
                      />

                      <DetailItem
                        label="Payment ID"
                        value={text(payment.paymentId, payment.razorpayPaymentId) || "—"}
                        mono
                      />

                      <DetailItem
                        label="Payment Date"
                        value={dateTime(getPaymentDate(payment))}
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Student Admin
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-800">
                        {getAssignedAdmin(payment) || "Not assigned"}
                      </p>
                      <div className="mt-3">
                        <ApprovalBadge status={getApprovalStatus(payment)} />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedPayment(payment)}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-xs font-bold text-white transition hover:bg-blue-700"
                    >
                      <Icon name="eye" className="h-4 w-4" />
                      View Complete Student & Payment Details
                    </button>
                  </article>
                ))}
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs text-slate-500">
                    Showing{" "}
                    <strong className="text-slate-900">{firstRecord}–{lastRecord}</strong>{" "}
                    of{" "}
                    <strong className="text-slate-900">{filteredPayments.length}</strong>
                  </p>

                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    aria-label="Records per page"
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={currentPage <= 1}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="min-w-20 text-center text-xs font-bold text-slate-600">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    disabled={currentPage >= totalPages}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <div className="flex items-start gap-3">
            <Icon name="shield" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

            <div>
              <h3 className="text-sm font-black text-slate-900">
                Payment & Approval Security
              </h3>

              <p className="mt-1 text-xs leading-6 text-slate-600">
                Payment verification and Student Admin approval are separate
                operations. This dashboard is read-only for financial status.
                Payment confirmation must come from the secured backend and
                verified Razorpay webhook. Internship activation must depend
                on the server-side approval workflow.
              </p>
            </div>
          </div>
        </section>
      </div>

      {selectedPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPayment(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-details-title"
            className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  CyberNet Careers · Main Admin
                </p>

                <h2
                  id="payment-details-title"
                  className="mt-1 text-xl font-black text-slate-950 sm:text-2xl"
                >
                  Student & Payment Profile
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Complete transaction and enrollment information
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                aria-label="Close payment details"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-black text-white">
                      {initials(getStudentName(selectedPayment))}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black text-slate-950">
                        {getStudentName(selectedPayment)}
                      </h3>
                      <p className="truncate text-sm text-slate-500">
                        {getStudentEmail(selectedPayment) || "No email available"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-blue-600">
                        {getStudentId(selectedPayment) || "No student ID"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <StatusBadge status={getStatus(selectedPayment)} />
                    <ApprovalBadge status={getApprovalStatus(selectedPayment)} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black text-slate-950">
                  Payment Information
                </h3>

                <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-xs font-bold text-emerald-700">
                    Transaction Amount
                  </p>
                  <p className="mt-1 text-3xl font-black text-emerald-700">
                    {currency(getAmount(selectedPayment))}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {getStatus(selectedPayment) === "success"
                      ? "Payment reported as successful by the payment API"
                      : "Payment is not confirmed as successful"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem
                    label="Razorpay Payment ID"
                    value={text(selectedPayment.razorpayPaymentId, selectedPayment.paymentId) || "—"}
                    mono
                  />

                  <DetailItem
                    label="Razorpay Order ID"
                    value={text(selectedPayment.razorpayOrderId, selectedPayment.orderId) || "—"}
                    mono
                  />

                  <DetailItem
                    label="Payment Method"
                    value={text(selectedPayment.paymentMethod, selectedPayment.method) || "—"}
                  />

                  <DetailItem
                    label="Payment Currency"
                    value={text(selectedPayment.currency, "INR")}
                  />

                  <DetailItem
                    label="Transaction Date"
                    value={dateTime(getPaymentDate(selectedPayment))}
                  />

                  <DetailItem
                    label="Last Updated"
                    value={dateTime(selectedPayment.updatedAt)}
                  />

                  <DetailItem
                    label="Database Record ID"
                    value={getPaymentId(selectedPayment) || "—"}
                    mono
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black text-slate-950">
                  Internship Information
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem
                    label="Selected Internship"
                    value={getInternship(selectedPayment)}
                  />

                  <DetailItem
                    label="Domain"
                    value={text(selectedPayment.domain) || "—"}
                  />
                  <DetailItem
                    label="Internship Plan"
                    value={getPlanLabel(selectedPayment)}
                  />
                  <DetailItem
                    label="Plan Code"
                    value={getPlanCode(selectedPayment)}
                    mono
                  />
                  <DetailItem
                    label="Checkout Expires At"
                    value={dateTime(text(selectedPayment.checkoutExpiresAt, selectedPayment.selectionExpiresAt))}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black text-slate-950">
                  Student Admin Approval
                </h3>

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem
                    label="Assigned Student Admin"
                    value={getAssignedAdmin(selectedPayment) || "Not assigned"}
                  />

                  <DetailItem
                    label="Approval Status"
                    value={getApprovalStatus(selectedPayment).replace("_", " ").toUpperCase()}
                  />

                  <DetailItem
                    label="Approved By"
                    value={getApprovedBy(selectedPayment) || "Not available"}
                  />

                  <DetailItem
                    label="Approved At"
                    value={dateTime(text(
                      selectedPayment.approvedAt,
                      record(selectedPayment.enrollment).approvedAt as string
                    ))}
                  />

                  <DetailItem
                    label="Rejected At"
                    value={dateTime(selectedPayment.rejectedAt)}
                  />

                  <DetailItem
                    label="Student Mobile"
                    value={text(
                      selectedPayment.mobile,
                      record(selectedPayment.student).mobile as string
                    ) || "—"}
                  />
                </div>

                {selectedPayment.adminRemarks && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Admin Remarks
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedPayment.adminRemarks}
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                  <div>
                    <h3 className="text-xs font-black text-amber-900">
                      Approval and payment are independent
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      A successful payment does not automatically mean that
                      the student is approved. Only the authorized Student
                      Admin approval workflow can change the enrollment
                      status. Missing server data is not treated as approval.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
