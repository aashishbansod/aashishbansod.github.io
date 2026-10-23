 "use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type PaymentStatus = "success" | "pending" | "failed" | "refunded";

type Payment = {
  _id?: string;
  id?: string;
  paymentId?: string;
  orderId?: string;
  studentName?: string;
  studentId?: string;
  email?: string;
  internship?: string;
  amount?: number | string;
  status?: string;
  method?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PaymentStats = {
  total: number;
  successful: number;
  pending: number;
  failed: number;
  refunded: number;
  revenue: number;
};

type ApiPayload = {
  success?: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: unknown;
  payments?: unknown;
  stats?: Partial<PaymentStats>;
  deleted?: boolean;
  archived?: boolean;
  closed?: boolean;
};

const EMPTY_STATS: PaymentStats = {
  total: 0,
  successful: 0,
  pending: 0,
  failed: 0,
  refunded: 0,
  revenue: 0,
};

const STATUS_OPTIONS: { value: "all" | PaymentStatus; label: string }[] = [
  { value: "all", label: "All payments" },
  { value: "success", label: "Successful" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

function getPaymentId(payment: Payment): string {
  return String(payment._id || payment.id || payment.paymentId || "");
}

function getStatus(payment: Payment): PaymentStatus {
  const value = String(payment.status || "pending").toLowerCase().trim();
  if (["success", "successful", "paid", "captured", "completed"].includes(value)) return "success";
  if (["failed", "failure", "cancelled", "canceled"].includes(value)) return "failed";
  if (["refunded", "refund", "partially_refunded"].includes(value)) return "refunded";
  return "pending";
}

function getAmount(payment: Payment): number {
  const raw = typeof payment.amount === "string"
    ? Number(payment.amount.replace(/[₹,\s]/g, ""))
    : Number(payment.amount ?? 0);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
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

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
  }
  return fallback;
}

function extractPayments(payload: ApiPayload | null): Payment[] {
  if (!payload) return [];
  if (Array.isArray(payload.payments)) return payload.payments as Payment[];
  if (Array.isArray(payload.data)) return payload.data as Payment[];
  if (payload.data && typeof payload.data === "object") {
    const data = payload.data as Record<string, unknown>;
    if (Array.isArray(data.payments)) return data.payments as Payment[];
    if (Array.isArray(data.items)) return data.items as Payment[];
    if (Array.isArray(data.records)) return data.records as Payment[];
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
    } else if (status === "pending") stats.pending += 1;
    else if (status === "failed") stats.failed += 1;
    else stats.refunded += 1;
    return stats;
  }, { ...EMPTY_STATS });
}

function resolveStats(serverStats: Partial<PaymentStats> | undefined, payments: Payment[]): PaymentStats {
  const calculated = calculateStats(payments);
  if (!serverStats) return calculated;
  const numberOr = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    total: numberOr(serverStats.total, calculated.total),
    successful: numberOr(serverStats.successful, calculated.successful),
    pending: numberOr(serverStats.pending, calculated.pending),
    failed: numberOr(serverStats.failed, calculated.failed),
    refunded: numberOr(serverStats.refunded, calculated.refunded),
    revenue: numberOr(serverStats.revenue, calculated.revenue),
  };
}

function initials(name?: string): string {
  const parts = (name || "Student").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] || "ST").slice(0, 2).toUpperCase();
}

function statusLabel(status: PaymentStatus): string {
  return ({ success: "Successful", pending: "Pending", failed: "Failed", refunded: "Refunded" })[status];
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const style: Record<PaymentStatus, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
    refunded: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${style[status]}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${status === "success" ? "bg-emerald-500" : status === "pending" ? "bg-amber-500" : status === "failed" ? "bg-rose-500" : "bg-violet-500"}`} />
    {statusLabel(status)}
  </span>;
}

function Icon({ name, className = "h-5 w-5" }: { name: "payments" | "check" | "clock" | "failed" | "revenue" | "search" | "refresh" | "eye" | "trash" | "close" | "alert"; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<typeof name, ReactNode> = {
    payments: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    failed: <><circle cx="12" cy="12" r="9" /><path d="m8 8 8 8M16 8l-8 8" /></>,
    revenue: <><path d="M12 3v18" /><path d="M17 7.5c0-1.7-1.9-3-5-3s-5 1.3-5 3 1.9 3 5 3 5 1.3 5 3-1.9 3-5 3-5-1.3-5-3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-4.5L3 9" /><path d="M3 4v5h5M4 13a8 8 0 0 0 14.8 4.5L21 15" /><path d="M21 20v-5h-5" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function StatCard({ label, value, description, icon, tone, loading }: {
  label: string; value: string | number; description: string; icon: ReactNode; tone: string; loading: boolean;
}) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={`mt-2 truncate text-2xl font-black sm:text-3xl ${tone}`}>{loading ? "—" : value}</p>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-700">{icon}</div>
    </div>
  </div>;
}

function DetailItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-2 break-words text-sm font-bold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</p>
  </div>;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deletingId, setDeletingId] = useState("");

  const loadPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok) throw new Error(messageFrom(payload, `Unable to load payments (HTTP ${response.status}).`));
      if (payload?.success === false) throw new Error(messageFrom(payload, "The payments API returned an unsuccessful response."));
      const list = extractPayments(payload);
      setPayments(list);
      setStats(resolveStats(payload?.stats, list));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadPayments(true);
    }, 30000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadPayments(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const status = getStatus(payment);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!query) return true;
      return [
        payment.studentName, payment.studentId, payment.email, payment.paymentId,
        payment.orderId, payment.internship, payment.method, status,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [payments, search, statusFilter]);

  async function handleDelete() {
    if (!deleteTarget || deletingId) return;
    const id = getPaymentId(deleteTarget);
    if (!id) {
      setError("This record has no usable ID. It cannot be deleted from this screen.");
      setDeleteTarget(null);
      return;
    }
    setDeletingId(id);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/admin/payments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok) throw new Error(messageFrom(payload, `Unable to delete/archive payment (HTTP ${response.status}).`));
      if (payload?.success === false) throw new Error(messageFrom(payload, "The payment operation was not completed."));
      setDeleteTarget(null);
      setSelectedPayment(null);
      setSuccessMessage(payload?.archived || payload?.closed
        ? "Payment record was safely archived/closed by the server."
        : "Payment record removal was confirmed by the server.");
      await loadPayments(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete/archive payment.");
    } finally {
      setDeletingId("");
    }
  }

  const hasFilters = Boolean(search.trim()) || statusFilter !== "all";

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> CyberNet Careers
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Payment Management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Monitor internship payments, transaction status, revenue and individual payment records from one central admin workspace.
            </p>
          </div>
          <button type="button" onClick={() => void loadPayments(true)} disabled={loading || refreshing}
            className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 lg:self-auto">
            <Icon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {(error || successMessage) && <div className={`mt-5 flex items-start justify-between gap-4 rounded-2xl border p-4 ${error ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="flex items-start gap-3">
          <span className={error ? "text-rose-600" : "text-emerald-600"}><Icon name={error ? "alert" : "check"} /></span>
          <div>
            <p className={`text-sm font-black ${error ? "text-rose-900" : "text-emerald-900"}`}>{error ? "Payment operation failed" : "Action completed"}</p>
            <p className={`mt-1 text-sm ${error ? "text-rose-700" : "text-emerald-700"}`}>{error || successMessage}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setError(""); setSuccessMessage(""); }} className="text-xs font-black text-slate-600">Close</button>
      </div>}

      <section aria-label="Payment overview" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Payments" value={stats.total} description="All transaction records" icon={<Icon name="payments" />} tone="text-slate-950" loading={loading} />
        <StatCard label="Successful" value={stats.successful} description="Completed payments" icon={<Icon name="check" />} tone="text-emerald-600" loading={loading} />
        <StatCard label="Pending" value={stats.pending} description="Awaiting confirmation" icon={<Icon name="clock" />} tone="text-amber-600" loading={loading} />
        <StatCard label="Failed" value={stats.failed} description="Unsuccessful transactions" icon={<Icon name="failed" />} tone="text-rose-600" loading={loading} />
        <StatCard label="Revenue" value={currency(stats.revenue)} description="Successful payments reported by API" icon={<Icon name="revenue" />} tone="text-violet-600" loading={loading} />
      </section>

      <section aria-label="Transaction records" className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Transaction Records</h2>
              <p className="mt-1 text-sm text-slate-500">Search, inspect and manage payment records.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block sm:w-80">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, payment ID..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
              </label>
              <label>
                <span className="sr-only">Filter payment status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | PaymentStatus)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-auto">
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredPayments.length}</strong> of <strong className="text-slate-800">{payments.length}</strong> loaded payment records.
          </p>
        </div>

        {loading ? <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl bg-slate-100" />)}
        </div> : filteredPayments.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon name="payments" className="h-7 w-7" /></div>
          <h3 className="mt-5 text-lg font-black text-slate-950">{hasFilters ? "No matching payments" : "No payment records yet"}</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{hasFilters ? "Try another search term or change the payment status filter." : "Payment transactions will appear here when the payments API returns records."}</p>
          {hasFilters && <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }} className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800">Clear filters</button>}
        </div> : <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1050px]">
              <thead><tr className="border-b border-slate-200 bg-slate-50/70">
                {["Student", "Transaction", "Internship", "Amount", "Status", "Date", "Actions"].map((heading) =>
                  <th key={heading} className={`px-5 py-4 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 ${heading === "Actions" ? "text-right" : ""}`}>{heading}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((payment, index) => {
                  const id = getPaymentId(payment) || `payment-${index}`;
                  return <tr key={id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4"><div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white">{initials(payment.studentName)}</div>
                      <div className="min-w-0"><p className="max-w-[190px] truncate text-sm font-black text-slate-900">{payment.studentName || "Unknown student"}</p><p className="mt-0.5 max-w-[190px] truncate text-xs text-slate-500">{payment.email || "—"}</p><p className="mt-0.5 text-[11px] font-bold text-blue-600">{payment.studentId || "—"}</p></div>
                    </div></td>
                    <td className="px-5 py-4"><p className="max-w-[180px] truncate font-mono text-xs font-bold text-slate-800">{payment.paymentId || "—"}</p><p className="mt-1 max-w-[180px] truncate font-mono text-[10px] text-slate-400">{payment.orderId || "No order ID"}</p></td>
                    <td className="px-5 py-4"><p className="max-w-[190px] truncate text-sm font-bold text-slate-800">{payment.internship || "—"}</p></td>
                    <td className="px-5 py-4"><p className="text-sm font-black text-slate-950">{currency(getAmount(payment))}</p><p className="mt-1 text-[10px] text-slate-400">{payment.method || "Payment"}</p></td>
                    <td className="px-5 py-4"><StatusBadge status={getStatus(payment)} /></td>
                    <td className="px-5 py-4"><p className="text-sm font-medium text-slate-600">{dateTime(payment.createdAt)}</p></td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setSelectedPayment(payment)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Icon name="eye" className="h-4 w-4" /> View</button>
                      <button type="button" onClick={() => setDeleteTarget(payment)} disabled={!getPaymentId(payment) || deletingId === getPaymentId(payment)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><Icon name="trash" className="h-4 w-4" /> Delete</button>
                    </div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:hidden">
            {filteredPayments.map((payment, index) => {
              const id = getPaymentId(payment) || `payment-card-${index}`;
              return <article key={id} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white">{initials(payment.studentName)}</div><div className="min-w-0"><h3 className="truncate text-sm font-black text-slate-950">{payment.studentName || "Unknown student"}</h3><p className="truncate text-xs text-slate-500">{payment.email || "No email"}</p></div></div>
                  <StatusBadge status={getStatus(payment)} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <DetailItem label="Amount" value={currency(getAmount(payment))} />
                  <DetailItem label="Method" value={payment.method || "—"} />
                  <DetailItem label="Payment ID" value={payment.paymentId || "—"} mono />
                  <DetailItem label="Date" value={dateTime(payment.createdAt)} />
                </div>
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Internship</p><p className="mt-1 truncate text-sm font-bold text-slate-800">{payment.internship || "—"}</p></div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSelectedPayment(payment)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-blue-50"><Icon name="eye" className="h-4 w-4" /> View</button>
                  <button type="button" onClick={() => setDeleteTarget(payment)} disabled={!getPaymentId(payment) || deletingId === getPaymentId(payment)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"><Icon name="trash" className="h-4 w-4" /> Delete</button>
                </div>
              </article>;
            })}
          </div>
        </>}
      </section>
    </div>

    {selectedPayment && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPayment(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="payment-details-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-5 sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Payment details</p><h2 id="payment-details-title" className="mt-1 text-xl font-black text-slate-950">Transaction information</h2></div><button type="button" onClick={() => setSelectedPayment(null)} aria-label="Close payment details" className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><Icon name="close" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Payment status</p><div className="mt-2"><StatusBadge status={getStatus(selectedPayment)} /></div></div><div className="sm:text-right"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Amount</p><p className="mt-1 text-2xl font-black text-slate-950">{currency(getAmount(selectedPayment))}</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <DetailItem label="Student name" value={selectedPayment.studentName || "—"} />
            <DetailItem label="Student ID" value={selectedPayment.studentId || "—"} />
            <DetailItem label="Email" value={selectedPayment.email || "—"} />
            <DetailItem label="Internship" value={selectedPayment.internship || "—"} />
            <DetailItem label="Payment ID" value={selectedPayment.paymentId || "—"} mono />
            <DetailItem label="Order ID" value={selectedPayment.orderId || "—"} mono />
            <DetailItem label="Payment method" value={selectedPayment.method || "—"} />
            <DetailItem label="Transaction date" value={dateTime(selectedPayment.createdAt)} />
            <DetailItem label="Last updated" value={dateTime(selectedPayment.updatedAt)} />
            <DetailItem label="Database record ID" value={getPaymentId(selectedPayment) || "—"} mono />
          </div>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-900">Financial record safety</p><p className="mt-1 text-xs leading-5 text-amber-800">Successful transactions should be retained or safely archived by the backend. This page never changes a payment's financial status.</p></div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <button type="button" onClick={() => setDeleteTarget(selectedPayment)} disabled={!getPaymentId(selectedPayment)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-50"><Icon name="trash" className="h-4 w-4" /> Delete / archive</button>
          <button type="button" onClick={() => setSelectedPayment(null)} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800">Close</button>
        </div>
      </div>
    </div>}

    {deleteTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingId) setDeleteTarget(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="delete-payment-title" className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Icon name="trash" /></div>
          <h2 id="delete-payment-title" className="mt-5 text-xl font-black text-slate-950">Delete or archive payment?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">This requests the existing admin payments API to remove or archive this record. The server decides which operation is permitted.</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{deleteTarget.studentName || "Unknown student"}</p><p className="mt-1 truncate font-mono text-[11px] text-slate-500">{deleteTarget.paymentId || getPaymentId(deleteTarget) || "No payment ID"}</p></div><StatusBadge status={getStatus(deleteTarget)} /></div><div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3"><span className="text-xs font-semibold text-slate-500">Amount</span><span className="text-sm font-black text-slate-950">{currency(getAmount(deleteTarget))}</span></div></div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-900">Important</p><p className="mt-1 text-xs leading-5 text-amber-800">Do not permanently erase a successful financial transaction unless your retention and audit policies explicitly allow it.</p></div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingId)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void handleDelete()} disabled={Boolean(deletingId)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
              {deletingId && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {deletingId ? "Processing..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>}
  </main>;
}
