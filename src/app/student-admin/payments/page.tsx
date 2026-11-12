
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
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  CircleAlert,
  ReceiptText,
  Wallet,
  RotateCcw,
  CalendarDays,
  FileText,
  IndianRupee,
  Info,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

type PaymentStatus = "success" | "pending" | "failed" | "refunded";

type PaymentRecord = {
  id: string;
  studentId: string;
  studentObjectId: string;
  fullName: string;
  email: string;
  internship: string;
  internshipPlan: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  paymentId: string;
  orderId: string;
  paymentCompletedAt: string | null;
  createdAt: string | null;
  studentOpsApprovalStatus: string;
  receiptAvailable: boolean;
};

type PaymentStats = {
  total: number;
  successful: number;
  pending: number;
  failed: number;
  refunded: number;
  revenue: number;
};

type ApiRecord = Record<string, unknown>;

type ApiPayload = {
  payments?: unknown;
  records?: unknown;
  stats?: Partial<PaymentStats>;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  total?: number;
  limit?: number;
  offset?: number;
};

type PaymentsResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: ApiPayload | unknown[];
  stats?: Partial<PaymentStats>;
  pagination?: ApiPayload["pagination"];
  total?: number;
};

const API_URL = "/api/student-admin/payments";
const PAGE_SIZE = 25;
const SEARCH_LIMIT = 120;

const EMPTY_STATS: PaymentStats = {
  total: 0,
  successful: 0,
  pending: 0,
  failed: 0,
  refunded: 0,
  revenue: 0,
};

const STATUS_OPTIONS = [
  { label: "All payments", value: "" },
  { label: "Successful", value: "success" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
];

function isRecord(value: unknown): value is ApiRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function cleanText(
  value: unknown,
  fallback = "—",
  maxLength = 250,
): string {
  if (typeof value !== "string") return fallback;

  const result = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);

  return result || fallback;
}

function safeNumber(value: unknown): number {
  const result = Number(value);

  return Number.isFinite(result) && result >= 0
    ? result
    : 0;
}

function normalizeStatus(value: unknown): PaymentStatus {
  const status = cleanText(
    value,
    "pending",
    30,
  ).toLowerCase();

  if (
    status === "success" ||
    status === "paid" ||
    status === "captured"
  ) {
    return "success";
  }

  if (status === "failed") return "failed";
  if (status === "refunded") return "refunded";

  return "pending";
}

function formatMoney(
  amount: number,
  currency = "INR",
): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

function formatDate(value?: string | null): string {
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
    .map((part) => part[0].toUpperCase())
    .join("") || "ST";
}

function normalizePayment(value: unknown): PaymentRecord {
  const input = isRecord(value) ? value : {};

  const id = cleanText(
    input.id ?? input._id,
    "",
    100,
  );

  const studentId = cleanText(
    input.studentId,
    "",
    100,
  );

  return {
    id,
    studentId,
    studentObjectId: cleanText(
      input.studentObjectId,
      "",
      100,
    ),
    fullName: cleanText(
      input.fullName ?? input.studentName,
      "Student",
      120,
    ),
    email: cleanText(
      input.email,
      "—",
      254,
    ),
    internship: cleanText(
      input.internship ?? input.internshipTrack,
      "Internship",
      150,
    ),
    internshipPlan: cleanText(
      input.internshipPlan ?? input.plan,
      "Not specified",
      100,
    ),
    amount: safeNumber(input.amount),
    currency: cleanText(
      input.currency,
      "INR",
      3,
    ).toUpperCase(),
    status: normalizeStatus(input.status),
    method: cleanText(
      input.method,
      "Razorpay",
      80,
    ),
    paymentId: cleanText(
      input.paymentId,
      "",
      120,
    ),
    orderId: cleanText(
      input.orderId,
      "",
      120,
    ),
    paymentCompletedAt:
      typeof input.paymentCompletedAt === "string"
        ? input.paymentCompletedAt
        : null,
    createdAt:
      typeof input.createdAt === "string"
        ? input.createdAt
        : null,
    studentOpsApprovalStatus: cleanText(
      input.studentOpsApprovalStatus,
      "pending",
      50,
    ),
    receiptAvailable: input.receiptAvailable !== false,
  };
}

function statusStyle(status: string): string {
  switch (
    status.toLowerCase().replace(/[_\s-]+/g, "")
  ) {
    case "success":
    case "paid":
    case "captured":
    case "approved":
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "failed":
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";

    case "refunded":
      return "border-violet-200 bg-violet-50 text-violet-700";

    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function StatusBadge({
  value,
}: {
  value: string;
}) {
  const label = cleanText(value, "pending", 50)
    .replace(/[_-]+/g, " ");

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${statusStyle(label)}`}
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
  icon: typeof CreditCard;
  iconStyle: string;
  loading: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950">
              {value}
            </p>
          )}
        </div>

        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}
        >
          <Icon size={20} />
        </span>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        {description}
      </p>
    </article>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-4 gap-4"
        >
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

function EmptyState({
  hasFilters,
  onReset,
}: {
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div className="px-5 py-14 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <ReceiptText size={22} />
      </span>

      <h3 className="mt-4 text-sm font-bold text-slate-800">
        {hasFilters
          ? "No matching transactions"
          : "No payment records yet"}
      </h3>

      <p className="mt-1 text-xs text-slate-500">
        {hasFilters
          ? "Try changing your search or filters."
          : "Student payment records will appear here."}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export default function StudentAdminPaymentsPage() {
  const abortRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState<PaymentStats>(EMPTY_STATS);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [selectedPayment, setSelectedPayment] =
    useState<PaymentRecord | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [receiptBusyId, setReceiptBusyId] = useState("");

  const activeFilterCount = useMemo(
    () => Number(Boolean(status)) + Number(Boolean(search)),
    [status, search],
  );

  const canGenerateReceipt = useCallback(
    (payment: PaymentRecord) =>
      payment.status === "success" &&
      payment.receiptAvailable &&
      Boolean(payment.studentId),
    [],
  );

  const loadPayments = useCallback(
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
      setActionMessage("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (search) params.set("search", search);
      if (status) params.set("status", status);

      try {
        const response = await fetch(
          `${API_URL}?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        const result = (
          await response.json().catch(() => null)
        ) as PaymentsResponse | null;

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          window.location.replace(
            "/login?mode=student-admin&next=%2Fstudent-admin%2Fpayments",
          );
          return;
        }

        if (
          !response.ok ||
          result?.success !== true
        ) {
          throw new Error(
            result?.message ||
              `Unable to load payment records (${response.status}).`,
          );
        }

        if (sequence !== requestSequence.current) return;

        const rawData = result.data;

        const data: ApiPayload = Array.isArray(rawData)
          ? { payments: rawData }
          : isRecord(rawData)
            ? rawData as ApiPayload
            : {};

        const records = Array.isArray(data.payments)
          ? data.payments
          : Array.isArray(data.records)
            ? data.records
            : [];

        const normalized = records.map(normalizePayment);

        setPayments(normalized);

        const responseStats =
          data.stats ?? result.stats ?? {};

        setStats({
          total: safeNumber(responseStats.total),
          successful: safeNumber(responseStats.successful),
          pending: safeNumber(responseStats.pending),
          failed: safeNumber(responseStats.failed),
          refunded: safeNumber(responseStats.refunded),
          revenue: safeNumber(responseStats.revenue),
        });

        const responsePagination =
          data.pagination ?? result.pagination ?? {};

        const responseTotal = safeNumber(
          responsePagination.total ??
          data.total ??
          result.total,
        );

        const responseTotalPages = safeNumber(
          responsePagination.totalPages,
        );

        setTotal(responseTotal);

        setTotalPages(
          responseTotalPages ||
            Math.ceil(responseTotal / PAGE_SIZE),
        );

        setLastUpdated(new Date().toISOString());
      } catch (requestError) {
        if (
          requestError instanceof Error &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        if (sequence !== requestSequence.current) return;

        console.error(
          "[STUDENT ADMIN PAYMENTS]",
          requestError,
        );

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Payment records could not be loaded.",
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
    void loadPayments(true);

    return () => {
      abortRef.current?.abort();
    };
  }, [loadPayments]);

  useEffect(() => {
    if (!selectedPayment) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPayment(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPayment]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPage(1);
    setSearch(
      searchInput.trim().slice(0, SEARCH_LIMIT),
    );
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

  async function handleReceipt(
    payment: PaymentRecord,
    mode: "view" | "download",
  ) {
    if (!canGenerateReceipt(payment)) {
      setActionMessage(
        "A verified successful payment with a valid student ID is required.",
      );
      return;
    }

    const busyId = payment.id || payment.studentId;

    if (receiptBusyId) return;

    const previewWindow =
      mode === "view"
        ? window.open("about:blank", "_blank")
        : null;

    setReceiptBusyId(busyId);
    setActionMessage("");

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(payment.studentId)}/receipt`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/pdf, application/json",
          },
        },
      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        previewWindow?.close();

        window.location.replace(
          "/login?mode=student-admin&next=%2Fstudent-admin%2Fpayments",
        );

        return;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => null);

        throw new Error(
          isRecord(result) &&
          typeof result.message === "string"
            ? result.message
            : `Receipt request failed (${response.status}).`,
        );
      }

      const contentType = response.headers
        .get("content-type")
        ?.toLowerCase() || "";

      if (!contentType.includes("application/pdf")) {
        throw new Error(
          "The server did not return a valid PDF receipt.",
        );
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The generated receipt is empty.");
      }

      const objectUrl = URL.createObjectURL(blob);

      const safeStudentId = payment.studentId.replace(
        /[^a-zA-Z0-9_-]/g,
        "",
      );

      const filename =
        `CyberNet-Receipt-${safeStudentId || "student"}.pdf`;

      if (mode === "view" && previewWindow && !previewWindow.closed) {
        previewWindow.location.href = objectUrl;
      } else {
        if (previewWindow && !previewWindow.closed) {
          previewWindow.close();
        }

        const anchor = document.createElement("a");

        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = "noopener noreferrer";

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        if (mode === "view") {
          setActionMessage(
            "Popup was blocked. The receipt was downloaded instead.",
          );
        }
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
    } catch (requestError) {
      previewWindow?.close();

      console.error(
        "[STUDENT ADMIN RECEIPT]",
        requestError,
      );

      setActionMessage(
        requestError instanceof Error
          ? requestError.message
          : "Unable to process the payment receipt.",
      );
    } finally {
      setReceiptBusyId("");
    }
  }

  function exportCurrentPage() {
    if (payments.length === 0) return;

    const columns = [
      "Student ID",
      "Student Name",
      "Email",
      "Internship",
      "Plan",
      "Amount",
      "Currency",
      "Status",
      "Payment Method",
      "Payment ID",
      "Order ID",
      "Payment Date",
      "Operations Approval",
    ];

    const rows = payments.map((payment) => [
      payment.studentId,
      payment.fullName,
      payment.email,
      payment.internship,
      payment.internshipPlan,
      String(payment.amount),
      payment.currency,
      payment.status,
      payment.method,
      payment.paymentId,
      payment.orderId,
      payment.paymentCompletedAt || "",
      payment.studentOpsApprovalStatus,
    ]);

    const escapeCsv = (value: string) => {
      const safeValue = /^[=+\-@\t\r]/.test(value)
        ? `'${value}`
        : value;

      return `"${safeValue.replace(/"/g, '""')}"`;
    };

    const csv = [
      columns,
      ...rows,
    ]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(
      ["\uFEFF", csv],
      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `cybernet-payments-page-${page}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  const updatedLabel = lastUpdated
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      }).format(new Date(lastUpdated))
    : "Not synchronized";

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">

        <section className="relative overflow-hidden rounded-[26px] border border-blue-100 bg-white p-5 shadow-[0_8px_35px_rgba(15,23,42,0.045)] sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-100/70 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-blue-700">
                <CreditCard size={13} />
                Student Operations / Finance
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                Payments Management
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Monitor student transactions, review payment
                verification and access verified payment receipts.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                  <Activity size={13} />
                  Secure payment workspace
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  Updated {updatedLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadPayments(false)}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={exportCurrentPage}
                disabled={payments.length === 0 || loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet size={15} />
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
              <CircleAlert
                size={19}
                className="mt-0.5 shrink-0 text-rose-600"
              />

              <div>
                <p className="text-sm font-bold text-rose-800">
                  Payment records could not be loaded
                </p>

                <p className="mt-1 break-words text-xs text-rose-700">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadPayments(true)}
              className="h-9 shrink-0 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"
            >
              Try again
            </button>
          </section>
        )}

        {actionMessage && (
          <section
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          >
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0" />
              <p>{actionMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => setActionMessage("")}
              aria-label="Dismiss message"
              className="shrink-0"
            >
              <X size={15} />
            </button>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total payment records"
            value={stats.total.toLocaleString("en-IN")}
            description="All recorded payment transactions"
            icon={ReceiptText}
            iconStyle="bg-blue-50 text-blue-600"
            loading={loading}
          />

          <SummaryCard
            title="Successful payments"
            value={stats.successful.toLocaleString("en-IN")}
            description="Successfully verified transactions"
            icon={CheckCircle2}
            iconStyle="bg-emerald-50 text-emerald-600"
            loading={loading}
          />

          <SummaryCard
            title="Pending payments"
            value={stats.pending.toLocaleString("en-IN")}
            description="Transactions awaiting final status"
            icon={Clock3}
            iconStyle="bg-amber-50 text-amber-600"
            loading={loading}
          />

          <SummaryCard
            title="Verified revenue"
            value={formatMoney(stats.revenue)}
            description="Based on successful transactions"
            icon={Wallet}
            iconStyle="bg-violet-50 text-violet-600"
            loading={loading}
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">
                Failed transactions
              </p>

              <p className="mt-1 text-xl font-black text-slate-950">
                {stats.failed.toLocaleString("en-IN")}
              </p>
            </div>

            <span className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <CircleAlert size={18} />
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">
                Refunded transactions
              </p>

              <p className="mt-1 text-xl font-black text-slate-950">
                {stats.refunded.toLocaleString("en-IN")}
              </p>
            </div>

            <span className="rounded-xl bg-violet-50 p-3 text-violet-600">
              <RotateCcw size={18} />
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">
                Current page records
              </p>

              <p className="mt-1 text-xl font-black text-slate-950">
                {payments.length}
              </p>
            </div>

            <span className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Users size={18} />
            </span>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_5px_25px_rgba(15,23,42,0.035)]">

          <div className="border-b border-slate-100 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black tracking-tight text-slate-950">
                    Transaction records
                  </h2>

                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                    {total.toLocaleString("en-IN")} records
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Review student payments and access verified receipts.
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="flex w-full gap-2 xl:max-w-[460px]"
              >
                <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
                  <Search
                    size={16}
                    className="shrink-0 text-slate-400"
                  />

                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) =>
                      setSearchInput(event.target.value)
                    }
                    maxLength={SEARCH_LIMIT}
                    placeholder="Student, email, payment ID..."
                    aria-label="Search payment records"
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
                onClick={() =>
                  setFiltersOpen((value) => !value)
                }
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

                <ChevronDown
                  size={13}
                  className={`transition ${
                    filtersOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                <ShieldCheck
                  size={13}
                  className="text-emerald-600"
                />
                Protected financial records
              </span>
            </div>

            {filtersOpen && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Payment status
                  </span>

                  <select
                    value={status}
                    onChange={(event) =>
                      handleStatusChange(event.target.value)
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option
                        key={option.value || "all"}
                        value={option.value}
                      >
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

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1250px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">
                  <th className="px-5 py-4">Student</th>
                  <th className="px-4 py-4">Student ID</th>
                  <th className="px-4 py-4">Internship</th>
                  <th className="px-4 py-4">Amount</th>
                  <th className="px-4 py-4">Payment status</th>
                  <th className="px-4 py-4">Payment date</th>
                  <th className="px-4 py-4">Payment reference</th>
                  <th className="px-4 py-4">Operations</th>
                  <th className="px-5 py-4 text-right">Receipt</th>
                </tr>
              </thead>

              {!loading && payments.length > 0 && (
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => {
                    const receiptAllowed =
                      canGenerateReceipt(payment);

                    const busy =
                      receiptBusyId ===
                      (payment.id || payment.studentId);

                    return (
                      <tr
                        key={payment.id || payment.studentId}
                        className="transition hover:bg-blue-50/30"
                      >
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 text-[10px] font-black text-blue-700">
                              {initials(payment.fullName)}
                            </span>

                            <div className="min-w-0">
                              <p className="max-w-[170px] truncate text-xs font-bold text-slate-900">
                                {payment.fullName}
                              </p>

                              <p className="mt-1 flex max-w-[180px] items-center gap-1 truncate text-[10px] text-slate-500">
                                <Mail size={10} />
                                {payment.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-[11px] font-bold text-slate-700">
                          {payment.studentId}
                        </td>

                        <td className="px-4 py-4">
                          <p className="max-w-[160px] truncate text-[11px] font-semibold text-slate-700">
                            {payment.internship}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {payment.internshipPlan}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-xs font-black text-slate-900">
                          {formatMoney(
                            payment.amount,
                            payment.currency,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge value={payment.status} />
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-[10px] text-slate-500">
                          {formatDate(
                            payment.paymentCompletedAt,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="max-w-[150px] truncate text-[10px] font-semibold text-slate-700">
                            {payment.paymentId || "—"}
                          </p>

                          <p className="mt-1 max-w-[150px] truncate text-[9px] text-slate-400">
                            {payment.orderId || "—"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            value={payment.studentOpsApprovalStatus}
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPayment(payment)
                              }
                              title="View payment details"
                              aria-label={`View details for ${payment.fullName}`}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Eye size={13} />
                              Details
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleReceipt(
                                  payment,
                                  "download",
                                )
                              }
                              disabled={!receiptAllowed || busy}
                              title="Download verified PDF receipt"
                              aria-label={`Download receipt for ${payment.fullName}`}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2 text-[10px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              {busy ? (
                                <RefreshCw
                                  size={13}
                                  className="animate-spin"
                                />
                              ) : (
                                <Download size={13} />
                              )}
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>

            {loading && <LoadingRows />}

            {!loading && payments.length === 0 && (
              <EmptyState
                hasFilters={Boolean(search || status)}
                onReset={clearFilters}
              />
            )}
          </div>

          <div className="space-y-3 p-3 lg:hidden">
            {loading && <LoadingRows />}

            {!loading && payments.map((payment) => {
              const receiptAllowed =
                canGenerateReceipt(payment);

              const busy =
                receiptBusyId ===
                (payment.id || payment.studentId);

              return (
                <article
                  key={payment.id || payment.studentId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">
                      {initials(payment.fullName)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-950">
                        {payment.fullName}
                      </p>

                      <p className="mt-1 truncate text-[10px] text-slate-500">
                        {payment.email}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-blue-700">
                        {payment.studentId}
                      </p>
                    </div>

                    <StatusBadge value={payment.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Amount
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-950">
                        {formatMoney(
                          payment.amount,
                          payment.currency,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Payment date
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-slate-700">
                        {formatDate(payment.paymentCompletedAt)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Internship
                      </p>

                      <p className="mt-1 truncate text-[11px] font-semibold text-slate-700">
                        {payment.internship}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Plan
                      </p>

                      <p className="mt-1 text-[11px] font-semibold text-slate-700">
                        {payment.internshipPlan}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Razorpay payment ID
                    </p>

                    <p className="mt-1 break-all text-[10px] font-semibold text-slate-700">
                      {payment.paymentId || "—"}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold text-slate-400">
                        Operations approval
                      </p>

                      <div className="mt-1">
                        <StatusBadge
                          value={payment.studentOpsApprovalStatus}
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPayment(payment)
                        }
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-700"
                      >
                        <Eye size={13} />
                        Details
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleReceipt(
                            payment,
                            "download",
                          )
                        }
                        disabled={!receiptAllowed || busy}
                        className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-35"
                      >
                        {busy ? (
                          <RefreshCw
                            size={13}
                            className="animate-spin"
                          />
                        ) : (
                          <Download size={13} />
                        )}
                        PDF
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {!loading && payments.length === 0 && (
              <EmptyState
                hasFilters={Boolean(search || status)}
                onReset={clearFilters}
              />
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-[10px] text-slate-500">
              {loading
                ? "Loading payment records..."
                : total === 0
                  ? "No payment records"
                  : `Showing ${
                      ((page - 1) * PAGE_SIZE) + 1
                    }–${Math.min(
                      page * PAGE_SIZE,
                      total,
                    )} of ${total.toLocaleString("en-IN")} transactions`}
            </p>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1),
                  )
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={13} />
                Previous
              </button>

              <span className="min-w-[70px] text-center text-[10px] font-bold text-slate-600">
                {totalPages > 0
                  ? `${page} / ${totalPages}`
                  : "0 / 0"}
              </span>

              <button
                type="button"
                disabled={
                  loading ||
                  totalPages === 0 ||
                  page >= totalPages
                }
                onClick={() =>
                  setPage((current) =>
                    Math.min(totalPages, current + 1),
                  )
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 py-4 text-[10px] text-slate-400 sm:flex-row sm:items-center">
          <span>
            © {new Date().getFullYear()} CyberNet Careers · Student Operations
          </span>

          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} />
            Authorized financial workspace
          </span>
        </footer>
      </div>

      {selectedPayment && (
        <PaymentDetails
          payment={selectedPayment}
          receiptBusy={
            receiptBusyId ===
            (selectedPayment.id || selectedPayment.studentId)
          }
          onClose={() => setSelectedPayment(null)}
          onDownload={() =>
            void handleReceipt(selectedPayment, "download")
          }
          onView={() =>
            void handleReceipt(selectedPayment, "view")
          }
          canGenerateReceipt={canGenerateReceipt(
            selectedPayment,
          )}
        />
      )}
    </main>
  );
}

function PaymentDetails({
  payment,
  receiptBusy,
  onClose,
  onDownload,
  onView,
  canGenerateReceipt,
}: {
  payment: PaymentRecord;
  receiptBusy: boolean;
  onClose: () => void;
  onDownload: () => void;
  onView: () => void;
  canGenerateReceipt: boolean;
}) {
  const details = [
    { label: "Student ID", value: payment.studentId },
    { label: "Student name", value: payment.fullName },
    { label: "Email", value: payment.email },
    { label: "Internship", value: payment.internship },
    { label: "Selected plan", value: payment.internshipPlan },
    { label: "Payment method", value: payment.method },
    { label: "Payment ID", value: payment.paymentId },
    { label: "Order ID", value: payment.orderId },
    {
      label: "Payment date",
      value: formatDate(payment.paymentCompletedAt),
    },
    {
      label: "Operations approval",
      value: payment.studentOpsApprovalStatus,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-detail-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">
              Payment information
            </p>

            <h2
              id="payment-detail-title"
              className="mt-1 text-lg font-black text-slate-950"
            >
              Transaction details
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment details"
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Amount
            </p>

            <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {formatMoney(
                payment.amount,
                payment.currency,
              )}
            </p>

            <div className="mt-3">
              <StatusBadge value={payment.status} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="min-w-0 rounded-xl border border-slate-100 p-3"
              >
                <p className="text-[10px] font-semibold text-slate-400">
                  {detail.label}
                </p>

                <p className="mt-2 break-all text-xs font-bold text-slate-800">
                  {cleanText(detail.value)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <ShieldCheck
                size={16}
                className="text-emerald-600"
              />
              Receipt verification
            </div>

            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Receipts are generated by the secured server endpoint
              after matching the student and successful payment
              transaction against the payment ledger.
            </p>
          </div>

          {canGenerateReceipt && (
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onView}
                disabled={receiptBusy}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <ExternalLink size={15} />
                View receipt
              </button>

              <button
                type="button"
                onClick={onDownload}
                disabled={receiptBusy}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {receiptBusy ? (
                  <RefreshCw
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Download size={15} />
                )}
                Download PDF
              </button>
            </div>
          )}

          {!canGenerateReceipt && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Receipt is unavailable until the payment is successfully
              verified and the student identity is available.
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white transition hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
