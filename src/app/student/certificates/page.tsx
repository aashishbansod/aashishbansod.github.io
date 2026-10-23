"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Certificate = {
  _id?: string;
  id?: string;
  title?: string;
  internshipTitle?: string;
  domain?: string;
  issuedAt?: string;
  certificateUrl?: string;
  status?: string;
};

export default function StudentCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadCertificates() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/student/certificates", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.message || "Unable to load certificates."
          );
        }

        const items =
          data?.certificates ??
          data?.data?.certificates ??
          data?.data ??
          [];

        if (mounted) {
          setCertificates(Array.isArray(items) ? items : []);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load certificates."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCertificates();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-400">
              Student Portal
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              My Certificates
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              View and access your internship certificates.
            </p>
          </div>

          <Link
            href="/student/dashboard"
            className="inline-flex w-fit items-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500 hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />

            <p className="text-sm text-slate-400">
              Loading certificates...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-6">
            <h2 className="font-semibold text-red-300">
              Unable to load certificates
            </h2>

            <p className="mt-2 text-sm text-red-200/70">
              {error}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && certificates.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-2xl">
              🎓
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              No certificates yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Your certificate will appear here after you successfully
              complete an eligible internship or program.
            </p>
          </div>
        )}

        {!loading && !error && certificates.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {certificates.map((certificate, index) => {
              const certificateId =
                certificate._id ||
                certificate.id ||
                String(index);

              const title =
                certificate.title ||
                certificate.internshipTitle ||
                "Internship Certificate";

              return (
                <article
                  key={certificateId}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-black/10"
                >
                  <div className="border-b border-slate-800 bg-gradient-to-br from-blue-600/20 via-slate-900 to-slate-900 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-2xl">
                        🏆
                      </div>

                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                        {certificate.status || "Issued"}
                      </span>
                    </div>

                    <h2 className="mt-5 text-lg font-bold">
                      {title}
                    </h2>

                    {certificate.domain && (
                      <p className="mt-1 text-sm text-slate-400">
                        Domain: {certificate.domain}
                      </p>
                    )}
                  </div>

                  <div className="p-6">
                    {certificate.issuedAt && (
                      <div className="mb-5">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Issued
                        </p>

                        <p className="mt-1 text-sm text-slate-300">
                          {new Date(
                            certificate.issuedAt
                          ).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    )}

                    {certificate.certificateUrl ? (
                      <a
                        href={certificate.certificateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
                      >
                        View Certificate
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-500"
                      >
                        Certificate Unavailable
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}