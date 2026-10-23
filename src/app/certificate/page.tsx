"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const VERIFY_API = "/api/certificate/verify";

type CertificateRecord = {
  certificateId?: string;
  fullName?: string;
  studentName?: string;
  internshipTrack?: string;
  internship?: string;
  issueDate?: string;
  issuedAt?: string;
  completionDate?: string;
  status?: string;
};

type VerificationResponse = {
  success?: boolean;
  valid?: boolean;
  message?: string;
  certificate?: CertificateRecord;
};

function CertificateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 8h8M8 12h5" />
      <circle cx="15.5" cy="16.5" r="2.2" />
      <path d="m17 18 1.2 2M14 18l-1.2 2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 3 19 6v5c0 4.5-2.8 8.2-7 10-4.2-1.8-7-5.5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CertificateIllustration() {
  return (
    <svg
      viewBox="0 0 280 210"
      className="mx-auto block h-auto w-full max-w-[240px] sm:max-w-[270px]"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="48"
        y="30"
        width="160"
        height="125"
        rx="12"
        className="fill-blue-50 stroke-blue-200"
        strokeWidth="2"
      />

      <rect
        x="64"
        y="46"
        width="128"
        height="86"
        rx="7"
        className="fill-white stroke-blue-100"
        strokeWidth="2"
      />

      <path
        d="M82 65h92"
        className="stroke-blue-200"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <path
        d="M82 80h65"
        className="stroke-slate-200"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <path
        d="M82 95h78"
        className="stroke-slate-200"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <circle
        cx="128"
        cy="113"
        r="10"
        className="fill-blue-600"
      />

      <path
        d="m124 113 3 3 6-7"
        className="stroke-white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="m186 125 17 9-8 30-13-18-18 10 7-31"
        className="fill-blue-600"
      />

      <circle
        cx="204"
        cy="139"
        r="18"
        className="fill-white stroke-blue-200"
        strokeWidth="3"
      />

      <path
        d="m197 139 5 5 9-10"
        className="stroke-blue-600"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx="38"
        cy="54"
        r="5"
        className="fill-blue-200"
      />

      <circle
        cx="232"
        cy="67"
        r="4"
        className="fill-cyan-200"
      />

      <path
        d="M27 88h20M37 78v20"
        className="stroke-blue-300"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M224 101h16M232 93v16"
        className="stroke-blue-300"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </span>

      <div className="min-w-0">
        <h3 className="text-sm font-extrabold text-slate-950">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function CertificatePage() {
  const [certificateId, setCertificateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] =
    useState<VerificationResponse | null>(null);

  const handleVerify = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const id = certificateId.trim();

    setError("");
    setResult(null);

    if (!id) {
      setError("Please enter your certificate ID.");
      return;
    }

    if (id.length < 4 || id.length > 100) {
      setError("Please enter a valid certificate ID.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${VERIFY_API}?certificateId=${encodeURIComponent(id)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      const data: VerificationResponse | null =
        await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Unable to verify this certificate. Please check the certificate ID.",
        );
      }

      if (!data) {
        throw new Error(
          "Invalid response received from the verification service.",
        );
      }

      setResult(data);

      if (data.valid === false || data.success === false) {
        setError(
          data.message ||
            "No matching certificate record was found.",
        );
      }
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Unable to verify the certificate right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  const certificate = result?.certificate;

  const verified =
    !error &&
    Boolean(certificate) &&
    (result?.valid === true || result?.success === true);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f6f8fc] text-slate-950">
      {/* Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-220px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/[0.06] blur-[120px]" />

        <div className="absolute -left-48 top-[42%] h-[400px] w-[400px] rounded-full bg-cyan-400/[0.04] blur-[100px]" />

        <div className="absolute -right-48 top-[18%] h-[450px] w-[450px] rounded-full bg-blue-500/[0.04] blur-[100px]" />
      </div>

      {/* Minimal Header */}
      <header className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="CyberNet Careers home"
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white shadow-lg shadow-blue-600/20"
              aria-hidden="true"
            >
              CN
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight sm:text-base">
                CyberNet Careers
              </span>

              <span className="block truncate text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Internship & Student Portal
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="shrink-0 rounded-lg px-2 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:px-3 sm:text-sm"
          >
            Back to CyberNet
          </Link>
        </div>
      </header>

      {/* Main */}
      <section
        aria-labelledby="certificate-page-title"
        className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
      >
        <div className="mx-auto w-full max-w-5xl">
          {/* Hero */}
          <div className="mx-auto w-full max-w-3xl text-center">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/20 sm:h-14 sm:w-14"
              aria-hidden="true"
            >
              <CertificateIcon />
            </div>

            <div className="mt-5">
              <span className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-blue-700 sm:px-4 sm:text-[10px] sm:tracking-[0.2em]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 sm:h-2 sm:w-2" />
                Certificate Verification
              </span>
            </div>

            <h1
              id="certificate-page-title"
              className="mx-auto mt-5 max-w-3xl text-[2.15rem] font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl lg:text-6xl"
            >
              Verify Your{" "}
              <span className="text-blue-600">
                CyberNet Certificate
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Enter the unique certificate ID to verify a CyberNet
              Careers internship certificate.
            </p>
          </div>

          {/* Verification Card */}
          <div className="mx-auto mt-9 w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.35)] sm:mt-11 sm:rounded-[2rem]">
            <div className="grid w-full lg:grid-cols-[1.08fr_0.92fr]">
              {/* Form */}
              <div className="min-w-0 p-5 sm:p-8 lg:p-10">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    aria-hidden="true"
                  >
                    <CheckIcon />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 sm:text-[10px]">
                      Verification Portal
                    </p>

                    <h2 className="mt-1 text-xl font-black leading-tight tracking-tight sm:text-2xl">
                      Certificate authenticity check
                    </h2>

                    <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
                      Enter the certificate ID exactly as printed on
                      the certificate.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleVerify}
                  noValidate
                  className="mt-7 sm:mt-8"
                >
                  <label
                    htmlFor="certificate-id"
                    className="block text-sm font-black text-slate-950"
                  >
                    Certificate ID
                  </label>

                  <p className="mt-1 text-xs text-slate-500">
                    Use the unique ID provided with the certificate.
                  </p>

                  <div className="mt-3 flex w-full flex-col gap-3 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-sm font-bold text-slate-400"
                      >
                        #
                      </span>

                      <input
                        id="certificate-id"
                        name="certificateId"
                        type="text"
                        value={certificateId}
                        onChange={(event) => {
                          setCertificateId(event.target.value);

                          if (error) {
                            setError("");
                          }

                          if (result) {
                            setResult(null);
                          }
                        }}
                        placeholder="CN-CERT-2026-0001"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        maxLength={100}
                        aria-invalid={Boolean(error)}
                        aria-describedby="certificate-help certificate-error"
                        className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto sm:min-w-[190px]"
                    >
                      {loading ? (
                        <>
                          <span
                            className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                            aria-hidden="true"
                          />
                          Verifying
                        </>
                      ) : (
                        <>
                          <SearchIcon />
                          Verify Certificate
                        </>
                      )}
                    </button>
                  </div>

                  <p
                    id="certificate-help"
                    className="mt-3 text-[11px] leading-5 text-slate-500 sm:text-xs"
                  >
                    Certificate information is displayed only when a
                    matching verification record is returned.
                  </p>

                  {/* Error */}
                  {error && (
                    <div
                      id="certificate-error"
                      role="alert"
                      className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700 sm:text-sm"
                    >
                      {error}
                    </div>
                  )}

                  {/* Verified Result */}
                  {verified && certificate && (
                    <div
                      role="status"
                      className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                          <CheckIcon />
                        </span>

                        <div className="min-w-0">
                          <p className="text-sm font-black text-emerald-900">
                            Certificate verified
                          </p>

                          <p className="mt-1 text-xs leading-5 text-emerald-700">
                            A matching certificate record was found.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {(certificate.fullName ||
                          certificate.studentName) && (
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">
                              Student
                            </p>

                            <p className="mt-1 break-words text-sm font-bold text-emerald-950">
                              {certificate.fullName ||
                                certificate.studentName}
                            </p>
                          </div>
                        )}

                        {certificate.certificateId && (
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">
                              Certificate ID
                            </p>

                            <p className="mt-1 break-all text-sm font-bold text-emerald-950">
                              {certificate.certificateId}
                            </p>
                          </div>
                        )}

                        {(certificate.internshipTrack ||
                          certificate.internship) && (
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">
                              Internship
                            </p>

                            <p className="mt-1 break-words text-sm font-bold text-emerald-950">
                              {certificate.internshipTrack ||
                                certificate.internship}
                            </p>
                          </div>
                        )}

                        {(certificate.issueDate ||
                          certificate.issuedAt ||
                          certificate.completionDate) && (
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">
                              Date
                            </p>

                            <p className="mt-1 break-words text-sm font-bold text-emerald-950">
                              {certificate.issueDate ||
                                certificate.issuedAt ||
                                certificate.completionDate}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* Information */}
              <aside className="min-w-0 border-t border-slate-200 bg-slate-50/70 p-5 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
                <div className="flex h-full flex-col justify-center">
                  <CertificateIllustration />

                  <div className="mt-5 space-y-5 sm:mt-7">
                    <InfoItem
                      icon={<ShieldIcon />}
                      title="Secure verification"
                      description="Check certificate records through the official verification portal."
                    />

                    <InfoItem
                      icon={<SearchIcon />}
                      title="Certificate lookup"
                      description="Use the unique certificate ID printed on the certificate."
                    />

                    <InfoItem
                      icon={<CheckIcon />}
                      title="Verification result"
                      description="A matching record is displayed after successful verification."
                    />
                  </div>
                </div>
              </aside>
            </div>
          </div>

          {/* Steps */}
          <section
            aria-labelledby="verification-process"
            className="mx-auto mt-5 w-full max-w-4xl rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm sm:mt-6 sm:rounded-[1.5rem] sm:p-7"
          >
            <h2
              id="verification-process"
              className="text-center text-base font-black tracking-tight sm:text-lg"
            >
              How verification works
            </h2>

            <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3">
              {[
                {
                  number: "01",
                  title: "Enter ID",
                  text: "Enter the certificate ID.",
                },
                {
                  number: "02",
                  title: "Verify",
                  text: "The portal checks the record.",
                },
                {
                  number: "03",
                  title: "View Result",
                  text: "Review the verification result.",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[11px] font-black text-blue-600">
                    {step.number}
                  </span>

                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-slate-950 sm:text-sm">
                      {step.title}
                    </h3>

                    <p className="mt-0.5 text-[11px] leading-5 text-slate-500 sm:text-xs">
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom */}
          <div className="mx-auto mt-5 flex w-full max-w-4xl flex-col items-center justify-center gap-2 px-2 text-center sm:flex-row sm:gap-3">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600"
              aria-hidden="true"
            >
              <ShieldIcon />
            </span>

            <p className="text-[11px] leading-5 text-slate-500 sm:text-xs">
              CyberNet Careers · CyberNet Technology Systems
            </p>

            <span
              aria-hidden="true"
              className="hidden text-slate-300 sm:inline"
            >
              •
            </span>

            <Link
              href="/contact"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 transition hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:text-xs"
            >
              Contact
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}