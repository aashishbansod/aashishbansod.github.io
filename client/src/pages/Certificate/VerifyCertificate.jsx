import React, { useMemo, useState } from "react";
import axios from "../../api/axios";
import {
  FaShieldAlt,
  FaSearch,
  FaCheckCircle,
  FaCertificate,
  FaDownload,
  FaQrcode,
  FaFilePdf,
  FaBuilding,
  FaUserGraduate,
  FaTimesCircle,
  FaSpinner,
  FaClipboard,
} from "react-icons/fa";

const VerifyCertificate = () => {
  const [certificateId, setCertificateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const normalizedId = useMemo(
    () => certificateId.trim().toUpperCase(),
    [certificateId]
  );

  const formatDate = (dateValue) => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const verifyCertificate = async () => {
    const id = certificateId.trim();

    if (!id) {
      setError("Certificate ID required");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setCertificate(null);
      setCopied(false);

      const { data } = await axios.get(
        `/certificates/verify/${encodeURIComponent(id)}`
      );

      if (data?.success && data?.certificate) {
        setCertificate(data.certificate);
      } else {
        setError(data?.message || "Certificate not found");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Certificate not found"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      verifyCertificate();
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(normalizedId || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-900 py-20">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.35),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.3),transparent_35%)]" />
        <div className="relative max-w-6xl mx-auto px-6 text-center text-white">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white/10 border border-white/15 backdrop-blur">
            <FaShieldAlt />
            <span className="text-sm sm:text-base font-medium">
              Official Certificate Verification Portal
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black mt-8 leading-tight">
            Verify
            <span className="block text-cyan-300">Internship Certificates</span>
          </h1>

          <p className="mt-6 text-slate-300 max-w-3xl mx-auto text-base sm:text-lg leading-7">
            Check certificates issued by CyberNet Technology Systems using the
            certificate ID. The verification result will show student details,
            issue information, and authenticity status.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-10 relative z-10 pb-14">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-8">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-black">
              Certificate Verification
            </h2>
            <p className="mt-2 text-slate-500">
              Enter the certificate ID exactly as printed on the document.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-12 mt-8">
            <div className="md:col-span-8">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Certificate ID
              </label>
              <div className="relative">
                <input
                  value={certificateId}
                  onChange={(e) => setCertificateId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="CNTS-2026-ABC123"
                  autoComplete="off"
                  className="w-full h-14 pl-5 pr-14 rounded-2xl border border-slate-300 bg-slate-50 focus:bg-white outline-none focus:ring-4 focus:ring-cyan-100 focus:border-cyan-500 transition"
                />
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition"
                  title="Copy typed ID"
                >
                  <FaClipboard />
                </button>
              </div>
              {copied && (
                <p className="mt-2 text-sm text-emerald-600 font-medium">
                  Certificate ID copied.
                </p>
              )}
            </div>

            <div className="md:col-span-4 flex items-end">
              <button
                type="button"
                onClick={verifyCertificate}
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-blue-200/60 transition flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <FaSearch />
                    Verify
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 font-medium flex items-start gap-3">
              <FaTimesCircle className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {certificate && (
          <div className="bg-white mt-8 rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <FaCheckCircle size={42} className="shrink-0 mt-1" />
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black">
                    Certificate Verified
                  </h2>
                  <p className="text-white/90 mt-1">
                    Authentic CyberNet record found and validated successfully.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8 grid lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <InfoRow
                  label="Student Name"
                  value={certificate.studentName || "-"}
                  icon={<FaUserGraduate />}
                />
                <InfoRow
                  label="Certificate ID"
                  value={certificate.certificateId || "-"}
                  icon={<FaCertificate />}
                />
                <InfoRow
                  label="Verification Code"
                  value={certificate.verificationCode || "-"}
                  icon={<FaShieldAlt />}
                />
                <InfoRow
                  label="Internship Domain"
                  value={certificate.internshipDomain || "-"}
                  icon={<FaBuilding />}
                />
                <InfoRow
                  label="Internship Title"
                  value={certificate.internshipTitle || "-"}
                />
                <InfoRow
                  label="Duration"
                  value={certificate.internshipDuration || "-"}
                />
                <InfoRow
                  label="Issue Date"
                  value={formatDate(certificate.issueDate)}
                />
                <InfoRow
                  label="Status"
                  value={certificate.status || "Issued"}
                />
              </div>

              <div className="bg-slate-50 rounded-3xl p-5 sm:p-8 border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <FaCertificate className="text-blue-600" />
                  <h3 className="text-xl sm:text-2xl font-black">
                    Verification Status
                  </h3>
                </div>

                <div
                  className={`p-4 rounded-2xl font-bold border ${
                    certificate.status === "Issued"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                  }`}
                >
                  {certificate.status === "Issued" ? "VERIFIED" : certificate.status}
                </div>

                <div className="mt-6 space-y-4 text-slate-700">
                  <DetailLine
                    icon={<FaUserGraduate />}
                    text={`Score: ${certificate.score ?? 0}`}
                  />
                  <DetailLine
                    icon={<FaBuilding />}
                    text={`Issued By: ${certificate.issuedBy || "CyberNet Technology Systems"}`}
                  />
                  <DetailLine
                    icon={<FaQrcode />}
                    text={`Verification Count: ${certificate.verificationCount ?? 0}`}
                  />
                  <DetailLine
                    icon={<FaFilePdf />}
                    text={`Downloads: ${certificate.downloadCount ?? 0}`}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  {certificate.pdfUrl ? (
                    <a
                      href={certificate.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-semibold transition"
                    >
                      <FaDownload />
                      Download PDF
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center gap-2 bg-slate-200 text-slate-500 px-5 py-3 rounded-2xl font-semibold cursor-not-allowed"
                    >
                      <FaDownload />
                      Download PDF
                    </button>
                  )}

                  {certificate.verificationUrl ? (
                    <a
                      href={certificate.verificationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 px-5 py-3 rounded-2xl font-semibold transition"
                    >
                      <FaFilePdf />
                      Public Record
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-5 py-3 rounded-2xl font-semibold text-slate-400 cursor-not-allowed"
                    >
                      <FaFilePdf />
                      Public Record
                    </button>
                  )}
                </div>

                <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Note</p>
                  <p className="mt-1 leading-6">
                    This verification confirms that the certificate exists in the
                    CyberNet records and is currently marked as issued.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InfoRow = ({ label, value, icon = null }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500 flex items-center gap-2">
        {icon ? <span className="text-blue-600">{icon}</span> : null}
        <span>{label}</span>
      </p>
      <p className="mt-1 font-bold text-slate-900 break-words">{value}</p>
    </div>
  );
};

const DetailLine = ({ icon, text }) => {
  return (
    <div className="flex items-center gap-3">
      <span className="text-blue-600">{icon}</span>
      <span>{text}</span>
    </div>
  );
};

export default VerifyCertificate;