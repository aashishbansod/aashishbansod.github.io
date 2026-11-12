"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

function safeId(value: unknown): string {
  if (typeof value !== "string") return "";
  const id = value.trim();
  return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : "";
}

export default function StudentAdminPaymentReceiptPage() {
  const params = useParams<{ studentId: string }>();
  const [loadFailed, setLoadFailed] = useState(false);
  const paymentId = safeId(params?.studentId);

  const receiptUrl = useMemo(
    () =>
      paymentId
        ? `/api/student-admin/payments/${encodeURIComponent(paymentId)}/receipt`
        : "",
    [paymentId],
  );

  function downloadReceipt() {
    if (!receiptUrl) return;
    const anchor = document.createElement("a");
    anchor.href = receiptUrl;
    anchor.download = `CyberNet-Receipt-${paymentId}.pdf`;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              CyberNet Careers · Student Operations
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Payment receipt
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Secure receipt preview for the selected payment transaction.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/student-admin/payments"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to payments
            </Link>
            <button
              type="button"
              onClick={downloadReceipt}
              disabled={!receiptUrl}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download receipt
            </button>
          </div>
        </header>

        {!paymentId ? (
          <section className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-rose-700">
              Invalid payment reference
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              The payment reference in this URL is missing or invalid.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Receipt document
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Payment reference: {paymentId}
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                Protected document
              </span>
            </div>

            {loadFailed ? (
              <div className="p-8 text-center">
                <h2 className="text-lg font-bold text-slate-900">
                  Receipt preview unavailable
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  The receipt could not be displayed. Check your Student
                  Operations session and payment access, then try again.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLoadFailed(false);
                    window.location.reload();
                  }}
                  className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Try again
                </button>
              </div>
            ) : (
              <iframe
                key={receiptUrl}
                title="Payment receipt PDF"
                src={receiptUrl}
                onError={() => setLoadFailed(true)}
                className="h-[75vh] min-h-[560px] w-full bg-slate-100"
                referrerPolicy="no-referrer"
              />
            )}
          </section>
        )}

        <footer className="flex flex-col gap-1 px-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} CyberNet Careers</span>
          <span>Receipt access is subject to server-side authorization.</span>
        </footer>
      </div>
    </main>
  );
}
