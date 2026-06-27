import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Award,
  Download,
  Search,
  Trophy,
  Star,
  Medal,
  CheckCircle,
  Calendar,
  BadgeCheck,
  ShieldAlert,
  ShieldCheck,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
  FileText,
  Hash,
  Clock3,
  AlertCircle,
  Loader2,
  Fingerprint,
  QrCode,
  Eye,
} from "lucide-react";

import api from "../../services/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
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

function safeText(value, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function clampNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getStatusTone(certificate) {
  if (certificate?.status === "Revoked") {
    return "bg-rose-100 text-rose-700";
  }
  if (certificate?.status === "Expired") {
    return "bg-slate-200 text-slate-700";
  }
  if (certificate?.isVerified === false) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-emerald-100 text-emerald-700";
}

function getStatusLabel(certificate) {
  if (certificate?.status === "Revoked") return "Revoked";
  if (certificate?.status === "Expired") return "Expired";
  if (certificate?.isVerified === false) return "Unverified";
  return "Verified";
}

function StatCard({ icon: Icon, title, value, subtitle, tone = "blue" }) {
  const toneMap = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    cyan: "from-cyan-50 to-cyan-100 text-cyan-700",
    rose: "from-rose-50 to-rose-100 text-rose-700",
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60"
    >
      <div
        className={[
          "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br",
          toneMap[tone] || toneMap.blue,
        ].join(" ")}
      >
        <Icon size={20} />
      </div>
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-xs font-medium text-slate-500">{subtitle}</p>
    </motion.div>
  );
}

function Badge({ children, tone = "slate" }) {
  const toneMap = {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    purple: "bg-purple-100 text-purple-700",
    slate: "bg-slate-100 text-slate-700",
    cyan: "bg-cyan-100 text-cyan-700",
  };

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold",
        toneMap[tone] || toneMap.slate,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function CertificateCard({ certificate, onDownload, onVerify, onCopy }) {
  const statusTone = getStatusTone(certificate);
  const statusLabel = getStatusLabel(certificate);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-lg shadow-slate-200/60"
    >
      <div className="bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/80">
              <Sparkles size={12} />
              {safeText(certificate?.certificateType, "Certificate")}
            </div>
            <h3 className="mt-4 text-2xl font-black leading-tight">
              {safeText(certificate?.internshipTitle, "Certificate")}
            </h3>
            <p className="mt-2 text-sm text-white/75">
              {safeText(certificate?.internshipDomain, "Domain")}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <Award size={36} className="text-cyan-200" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="slate">
            <Hash size={12} />
            {safeText(certificate?.certificateId)}
          </Badge>
          <Badge tone={certificate?.isVerified ? "emerald" : "amber"}>
            {certificate?.isVerified ? (
              <CheckCircle size={12} />
            ) : (
              <AlertCircle size={12} />
            )}
            {statusLabel}
          </Badge>
          {certificate?.grade ? (
            <Badge tone="purple">
              <Medal size={12} />
              Grade {safeText(certificate?.grade)}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <Calendar size={14} />
              Issue Date
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {formatDate(certificate?.issueDate)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <Clock3 size={14} />
              Last Verified
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {formatDateTime(certificate?.lastVerifiedAt)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <Fingerprint size={14} />
              Verification Code
            </div>
            <p className="mt-2 break-words text-sm font-semibold text-slate-900">
              {safeText(certificate?.verificationCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <QrCode size={14} />
              Downloads
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {clampNumber(certificate?.downloadCount, 0)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Student
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {safeText(certificate?.studentName)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {safeText(certificate?.studentEmail)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                XP Earned
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                +{clampNumber(certificate?.xpEarned, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => onVerify(certificate)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Eye size={16} />
            Verify
          </button>

          <button
            onClick={() => onDownload(certificate)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.01]"
          >
            <Download size={16} />
            Download
          </button>

          <button
            onClick={() =>
              onCopy(
                certificate?.certificateId ||
                  certificate?.verificationCode ||
                  "",
                "Certificate ID copied"
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Copy size={16} />
            Copy ID
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Badge tone={certificate?.isVerified ? "emerald" : "amber"}>
            {certificate?.isVerified ? (
              <ShieldCheck size={12} />
            ) : (
              <ShieldAlert size={12} />
            )}
            {statusLabel}
          </Badge>
          <span className="text-xs text-slate-500">
            Age: {clampNumber(certificate?.certificateAgeDays, 0)} days
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function StudentCertificates() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");

  const [certificates, setCertificates] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCertificates = useCallback(async () => {
    try {
      setError("");
      setNotice("");
      setLoading(true);

      const response = await api.get("/certificates/my-certificates");
      const list = Array.isArray(response?.data?.certificates)
        ? response.data.certificates
        : [];

      setCertificates(
        list.sort(
          (a, b) =>
            new Date(b.issueDate || b.createdAt || 0).getTime() -
            new Date(a.issueDate || a.createdAt || 0).getTime()
        )
      );

      setNotice(
        `Loaded ${list.length} certificate${list.length === 1 ? "" : "s"}`
      );
    } catch (err) {
      console.error("CERTIFICATES LOAD ERROR:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load certificates"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const filteredCertificates = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return certificates;

    return certificates.filter((item) => {
      const haystack = [
        item?.title,
        item?.internshipTitle,
        item?.internshipDomain,
        item?.certificateType,
        item?.certificateId,
        item?.verificationCode,
        item?.studentName,
        item?.grade,
        item?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [certificates, search]);

  const stats = useMemo(() => {
    const total = certificates.length;
    const verified = certificates.filter(
      (c) => c?.status === "Issued" && c?.isVerified !== false
    ).length;
    const revoked = certificates.filter((c) => c?.status === "Revoked").length;
    const totalXp = certificates.reduce(
      (sum, c) => sum + clampNumber(c?.xpEarned, 0),
      0
    );
    const totalDownloads = certificates.reduce(
      (sum, c) => sum + clampNumber(c?.downloadCount, 0),
      0
    );

    return {
      total,
      verified,
      revoked,
      totalXp,
      totalDownloads,
    };
  }, [certificates]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCertificates();
  };

  const handleCopy = async (value, message = "Copied") => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setCopied(message);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("Copy failed");
      setTimeout(() => setCopied(""), 1500);
    }
  };

  const handleDownload = async (certificate) => {
    try {
      setNotice("");
      setError("");

      const certificateId = certificate?.certificateId;
      if (!certificateId) {
        setError("Certificate ID missing");
        return;
      }

      const response = await api.get(
        `/certificates/download/${encodeURIComponent(certificateId)}`
      );

      const downloadUrl =
        response?.data?.downloadUrl ||
        response?.data?.certificate?.pdfUrl ||
        certificate?.pdfUrl ||
        "";

      if (downloadUrl) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
        setNotice("Download opened successfully");
      } else {
        setNotice("Certificate is available, but no PDF link is attached yet");
      }
    } catch (err) {
      console.error("DOWNLOAD ERROR:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to download certificate"
      );
    }
  };

  const handleVerify = (certificate) => {
    const certificateId = certificate?.certificateId;
    if (!certificateId) return;

    navigate(`/certificates?certificateId=${encodeURIComponent(certificateId)}`);
  };

  const emptyState = !loading && filteredCertificates.length === 0;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[36px] bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-8 lg:p-10"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur">
                <Award size={14} />
                Student Achievement Center
              </div>

              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
                My Certificates
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                Download and verify all earned certificates, track achievements,
                and keep your internship records in one place.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur sm:block">
                <Award size={44} className="text-cyan-200" />
              </div>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-blue-700 shadow-xl transition hover:scale-[1.01]"
              >
                {refreshing ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <RefreshCw size={18} />
                )}
                Refresh
              </button>
            </div>
          </div>
        </motion.section>

        {(error || notice) && (
          <div
            className={[
              "mt-6 rounded-2xl border p-4",
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              {error ? <AlertCircle className="mt-0.5" size={18} /> : <CheckCircle className="mt-0.5" size={18} />}
              <div>
                <p className="font-bold">{error ? "Action failed" : "Status"}</p>
                <p className="mt-1 text-sm">{error || notice}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={Award}
            title="Certificates"
            value={stats.total}
            subtitle="Total earned"
            tone="blue"
          />
          <StatCard
            icon={CheckCircle}
            title="Verified"
            value={stats.verified}
            subtitle="Active certificates"
            tone="emerald"
          />
          <StatCard
            icon={ShieldAlert}
            title="Revoked"
            value={stats.revoked}
            subtitle="No longer valid"
            tone="rose"
          />
          <StatCard
            icon={Star}
            title="Total XP"
            value={stats.totalXp}
            subtitle="Earned from achievements"
            tone="purple"
          />
          <StatCard
            icon={Download}
            title="Downloads"
            value={stats.totalDownloads}
            subtitle="PDF fetch count"
            tone="amber"
          />
        </div>

        <div className="mt-8 rounded-[32px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Your Certificates
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search, verify, and download certificates issued for your
                internships and achievements.
              </p>
            </div>

            <div className="relative w-full lg:max-w-md">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search certificates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge tone="blue">
              <FileText size={12} />
              Visible: {filteredCertificates.length}
            </Badge>
            <Badge tone="emerald">
              <BadgeCheck size={12} />
              Verified: {stats.verified}
            </Badge>
            <Badge tone="purple">
              <Fingerprint size={12} />
              IDs secured
            </Badge>
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[420px] animate-pulse rounded-[32px] bg-white shadow-lg shadow-slate-200/60"
                />
              ))}
            </div>
          ) : emptyState ? (
            <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-lg shadow-slate-200/60">
              <Award className="mx-auto text-slate-300" size={56} />
              <h3 className="mt-4 text-2xl font-black text-slate-900">
                No certificates found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {search.trim()
                  ? "Try a different search term."
                  : "Your issued certificates will appear here once available."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {filteredCertificates.map((certificate) => (
                <CertificateCard
                  key={certificate._id || certificate.certificateId}
                  certificate={certificate}
                  onDownload={handleDownload}
                  onVerify={handleVerify}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 overflow-hidden rounded-[36px] bg-gradient-to-r from-purple-600 to-pink-600 p-8 text-white shadow-xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur">
                <Medal size={14} />
                Premium Achievement Center
              </div>

              <h2 className="mt-5 text-3xl font-black sm:text-4xl">
                Complete internships, assessments, and projects to unlock
                verified certificates.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-purple-100 sm:text-base">
                Certificates carry your progress, verification code, and
                achievement details so companies can trust your portfolio.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <h3 className="text-lg font-black">Bronze</h3>
                <p className="mt-2 text-sm text-purple-100">5 certificates</p>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <h3 className="text-lg font-black">Silver</h3>
                <p className="mt-2 text-sm text-purple-100">10 certificates</p>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <h3 className="text-lg font-black">Gold</h3>
                <p className="mt-2 text-sm text-purple-100">20 certificates</p>
              </div>
            </div>
          </div>
        </div>

        {copied ? (
          <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl">
            {copied}
          </div>
        ) : null}
      </div>
    </div>
  );
}