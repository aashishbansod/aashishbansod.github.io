import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaGraduationCap,
  FaTrophy,
  FaAward,
  FaStar,
  FaEdit,
  FaSave,
  FaTimes,
  FaCamera,
  FaGithub,
  FaLinkedin,
  FaCode,
  FaBriefcase,
  FaClipboardCheck,
  FaShieldAlt,
  FaChartLine,
  FaRegCalendarAlt,
  FaLink,
  FaFileAlt,
  FaRocket,
  FaSyncAlt,
  FaCheckCircle,
  FaBrain,
  FaExternalLinkAlt,
  FaCopy,
  FaSpinner,
  FaExclamationTriangle,
} from "react-icons/fa";

import api from "../../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const STORAGE_KEYS = [
  "token",
  "authToken",
  "cybernet_token",
  "student",
  "userRole",
];

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("cybernet_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("cybernet_token") ||
    ""
  );
}

function clearAuthStorage() {
  STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function clampPercent(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitSkills(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinSkills(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function StatCard({ icon: Icon, title, value, subtitle, tone = "blue" }) {
  const toneMap = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    cyan: "from-cyan-50 to-cyan-100 text-cyan-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    rose: "from-rose-50 to-rose-100 text-rose-700",
  };

  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="rounded-[30px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60"
    >
      <div
        className={[
          "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br",
          toneMap[tone] || toneMap.blue,
        ].join(" ")}
      >
        <Icon className="text-xl" />
      </div>

      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <h3 className="mt-2 text-3xl font-black text-slate-900">{value}</h3>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </motion.div>
  );
}

function InfoRow({ icon: Icon, label, value, action }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
          <Icon />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <div className="mt-2 break-words text-base font-bold text-slate-900">
            {value}
          </div>
        </div>

        {action}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div>
      <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
        {eyebrow}
      </span>
      <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
        {subtitle}
      </p>
    </div>
  );
}

function SkeletonLine({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />;
}

function StudentProfile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [stats, setStats] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [copyState, setCopyState] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    city: "",
    college: "",
    course: "",
    year: "",
    internshipDomain: "",
    githubLink: "",
    linkedinLink: "",
    profileImage: "",
    bio: "",
    resumeUrl: "",
    portfolioUrl: "",
    skills: "",
  });

  const fetchJSON = useCallback(
    async (path, options = {}) => {
      const token = getToken();

      if (!token) {
        clearAuthStorage();
        navigate("/login", { replace: true });
        throw new Error("Authentication required");
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        clearAuthStorage();
        navigate("/login", { replace: true });
        throw new Error(data.message || "Session expired");
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Request failed");
      }

      return data;
    },
    [navigate]
  );

  const hydrateFromProfile = useCallback((payload) => {
    const p = payload?.profile || payload?.student || payload?.user || null;
    if (!p) return;

    setProfile(p);
    setForm({
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      mobile: p.mobile || "",
      city: p.city || "",
      college: p.college || "",
      course: p.course || "",
      year: p.year || "",
      internshipDomain: p.internshipDomain || "",
      githubLink: p.githubLink || "",
      linkedinLink: p.linkedinLink || "",
      profileImage: p.profileImage || "",
      bio: p.bio || "",
      resumeUrl: p.resumeUrl || "",
      portfolioUrl: p.portfolioUrl || "",
      skills: joinSkills(p.skills || []),
    });
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const [profileRes, dashboardRes, statsRes] = await Promise.allSettled([
        fetchJSON("/student/profile"),
        fetchJSON("/student/dashboard"),
        fetchJSON("/student/stats"),
      ]);

      if (profileRes.status === "fulfilled") {
        hydrateFromProfile(profileRes.value);
      } else {
        throw profileRes.reason || new Error("Profile load failed");
      }

      if (dashboardRes.status === "fulfilled") {
        setDashboard(dashboardRes.value?.dashboard || null);
      }

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value?.stats || null);
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }, [fetchJSON, hydrateFromProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const profileSource = profile || dashboard?.profile || {};
  const performance = dashboard?.performance || {};
  const internship = dashboard?.internship || {};
  const certificates = dashboard?.certificates || {};
  const timeline = dashboard?.timeline || {};
  const meta = dashboard?.meta || {};

  const profileCompletion = clampPercent(
    profileSource.profileCompletion || meta.profileCompletion
  );

  const assessmentScore = clampPercent(
    performance.assessmentScore || stats?.assessmentScore
  );

  const scholarshipPercentage = clampPercent(
    performance.scholarshipPercentage || stats?.scholarshipPercentage
  );

  const leaderboardPoints = Number(
    performance.leaderboardPoints || stats?.leaderboardPoints || 0
  );

  const rank = Number(performance.rank || stats?.rank || 0);

  const unreadNotifications = Number(
    meta.unreadNotifications || stats?.unreadNotifications || 0
  );

  const tasksCompleted = Number(
    meta.completedTasks || stats?.completedTasks || 0
  );

  const tasksPending = Number(meta.pendingTasks || stats?.pendingTasks || 0);

  const skillsList = useMemo(() => splitSkills(form.skills), [form.skills]);

  const recentActivity = useMemo(() => {
    const items = [];

    if (timeline?.recentTaskCompletions?.length) {
      timeline.recentTaskCompletions.slice(0, 3).forEach((item) => {
        items.push({
          type: "task",
          title: item.title || "Task completed",
          meta: formatDateTime(item.completedDate),
        });
      });
    }

    if (timeline?.recentPendingTasks?.length) {
      timeline.recentPendingTasks.slice(0, 2).forEach((item) => {
        items.push({
          type: "pending",
          title: item.title || "Pending task",
          meta: item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date",
        });
      });
    }

    return items.slice(0, 5);
  }, [timeline]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCopy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopyState(`Copied ${label}`);
      setTimeout(() => setCopyState(""), 1500);
    } catch {
      setCopyState("Copy failed");
      setTimeout(() => setCopyState(""), 1500);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        mobile: form.mobile,
        city: form.city,
        college: form.college,
        course: form.course,
        year: form.year,
        internshipDomain: form.internshipDomain,
        githubLink: form.githubLink,
        linkedinLink: form.linkedinLink,
        profileImage: form.profileImage,
        bio: form.bio,
        resumeUrl: form.resumeUrl,
        portfolioUrl: form.portfolioUrl,
        skills: splitSkills(form.skills),
      };

      const result = await fetchJSON("/student/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      hydrateFromProfile(result);
      await loadProfile();
      setEditMode(false);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Unable to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    hydrateFromProfile({ profile: profileSource });
    setEditMode(false);
    setError("");
    setSuccess("");
  };

  const openLink = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="rounded-[36px] bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
            <SkeletonLine className="h-8 w-48" />
            <SkeletonLine className="mt-5 h-10 w-3/4" />
            <SkeletonLine className="mt-4 h-5 w-2/3" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLine key={i} className="h-32 rounded-[30px]" />
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <SkeletonLine className="h-[650px] rounded-[34px]" />
            <SkeletonLine className="h-[650px] rounded-[34px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !profileSource?.email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg rounded-[32px] border border-slate-100 bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <FaExclamationTriangle className="text-3xl" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-slate-900">
            Profile Error
          </h2>
          <p className="mt-3 text-slate-600">{error}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={loadProfile}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-bold text-white shadow-lg"
            >
              <FaSyncAlt />
              Retry
            </button>
            <button
              onClick={() => navigate("/student/dashboard")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {(error || success) && (
          <div
            className={[
              "mb-6 rounded-2xl border p-4",
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              {error ? <FaExclamationTriangle className="mt-0.5" /> : <FaCheckCircle className="mt-0.5" />}
              <div>
                <p className="font-bold">{error ? "Action failed" : "Success"}</p>
                <p className="mt-1 text-sm">{error || success}</p>
              </div>
            </div>
          </div>
        )}

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-8 lg:p-10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.14),transparent_35%)]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative">
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[32px] border-4 border-white/20 bg-white/10 shadow-2xl backdrop-blur">
                  {profileSource.profileImage ? (
                    <img
                      src={profileSource.profileImage}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FaUser className="text-5xl text-white/90" />
                  )}
                </div>

                {editMode && (
                  <div className="absolute -right-2 -bottom-2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-blue-700 shadow-xl">
                    <FaCamera />
                  </div>
                )}
              </div>

              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur">
                  <FaCheckCircle />
                  Student Profile
                </span>

                <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
                  {safeText(
                    profileSource.fullName ||
                      `${profileSource.firstName || ""} ${profileSource.lastName || ""}`.trim(),
                    "Student"
                  )}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                  Manage your personal details, links, skills, resume, portfolio and internship identity from one secure production profile.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
                    <FaTrophy className="text-amber-300" />
                    Rank {rank ? `#${rank}` : "—"}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
                    <FaChartLine className="text-cyan-200" />
                    {leaderboardPoints} XP
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
                    <FaRegCalendarAlt className="text-emerald-200" />
                    Updated {formatDateTime(meta.generatedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!editMode ? (
                <button
                  onClick={() => setEditMode(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-blue-700 shadow-xl transition hover:scale-[1.02]"
                >
                  <FaEdit />
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-blue-700 shadow-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <FaSave />
                    {saving ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    onClick={handleCancel}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    <FaTimes />
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.section>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FaTrophy}
            title="Leaderboard Points"
            value={leaderboardPoints}
            subtitle="Total XP earned"
            tone="blue"
          />
          <StatCard
            icon={FaAward}
            title="Certificates"
            value={certificates.certificateIssued ? "Issued" : "Pending"}
            subtitle={certificates.certificateId ? `ID: ${certificates.certificateId}` : "No certificate ID yet"}
            tone="amber"
          />
          <StatCard
            icon={FaStar}
            title="Tasks Completed"
            value={tasksCompleted}
            subtitle={`Pending: ${tasksPending}`}
            tone="emerald"
          />
          <StatCard
            icon={FaGraduationCap}
            title="Profile Completion"
            value={`${profileCompletion}%`}
            subtitle="Keep profile updated"
            tone="purple"
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Personal Information"
                title="Your Profile Details"
                subtitle="This information is used across your dashboard, internship records and certificate identity."
              />

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <InfoRow
                  icon={FaUser}
                  label="Full Name"
                  value={
                    editMode ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          name="firstName"
                          value={form.firstName}
                          onChange={handleChange}
                          placeholder="First name"
                          className="h-12 rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                        />
                        <input
                          name="lastName"
                          value={form.lastName}
                          onChange={handleChange}
                          placeholder="Last name"
                          className="h-12 rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                        />
                      </div>
                    ) : (
                      safeText(
                        profileSource.fullName ||
                          `${profileSource.firstName || ""} ${profileSource.lastName || ""}`.trim()
                      )
                    )
                  }
                />

                <InfoRow
                  icon={FaEnvelope}
                  label="Email"
                  value={safeText(profileSource.email)}
                  action={
                    <button
                      onClick={() => handleCopy(profileSource.email, "email")}
                      className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-blue-600"
                      title="Copy email"
                    >
                      <FaCopy />
                    </button>
                  }
                />

                <InfoRow
                  icon={FaPhone}
                  label="Mobile"
                  value={
                    editMode ? (
                      <input
                        name="mobile"
                        value={form.mobile}
                        onChange={handleChange}
                        placeholder="Mobile number"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                      />
                    ) : (
                      safeText(profileSource.mobile)
                    )
                  }
                />

                <InfoRow
                  icon={FaMapMarkerAlt}
                  label="City"
                  value={
                    editMode ? (
                      <input
                        name="city"
                        value={form.city}
                        onChange={handleChange}
                        placeholder="City"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                      />
                    ) : (
                      safeText(profileSource.city)
                    )
                  }
                />

                <InfoRow
                  icon={FaGraduationCap}
                  label="College"
                  value={
                    editMode ? (
                      <input
                        name="college"
                        value={form.college}
                        onChange={handleChange}
                        placeholder="College"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                      />
                    ) : (
                      safeText(profileSource.college)
                    )
                  }
                />

                <InfoRow
                  icon={FaBriefcase}
                  label="Course / Year"
                  value={
                    editMode ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          name="course"
                          value={form.course}
                          onChange={handleChange}
                          placeholder="Course"
                          className="h-12 rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                        />
                        <input
                          name="year"
                          value={form.year}
                          onChange={handleChange}
                          placeholder="Year"
                          className="h-12 rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                        />
                      </div>
                    ) : (
                      `${safeText(profileSource.course)} • ${safeText(profileSource.year)}`
                    )
                  }
                />

                <InfoRow
                  icon={FaClipboardCheck}
                  label="Internship Domain"
                  value={
                    editMode ? (
                      <input
                        name="internshipDomain"
                        value={form.internshipDomain}
                        onChange={handleChange}
                        placeholder="Internship Domain"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                      />
                    ) : (
                      safeText(profileSource.internshipDomain, "General")
                    )
                  }
                />

                <InfoRow
                  icon={FaLink}
                  label="GitHub"
                  value={
                    editMode ? (
                      <input
                        name="githubLink"
                        value={form.githubLink}
                        onChange={handleChange}
                        placeholder="GitHub profile link"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                      />
                    ) : (
                      safeText(profileSource.githubLink)
                    )
                  }
                  action={
                    !editMode && profileSource.githubLink ? (
                      <button
                        onClick={() => openLink(profileSource.githubLink)}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-blue-600"
                        title="Open GitHub"
                      >
                        <FaExternalLinkAlt />
                      </button>
                    ) : null
                  }
                />

                <InfoRow
                  icon={FaLinkedin}
                  label="LinkedIn"
                  value={
                    editMode ? (
                      <input
                        name="linkedinLink"
                        value={form.linkedinLink}
                        onChange={handleChange}
                        placeholder="LinkedIn profile link"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                      />
                    ) : (
                      safeText(profileSource.linkedinLink)
                    )
                  }
                  action={
                    !editMode && profileSource.linkedinLink ? (
                      <button
                        onClick={() => openLink(profileSource.linkedinLink)}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-blue-600"
                        title="Open LinkedIn"
                      >
                        <FaExternalLinkAlt />
                      </button>
                    ) : null
                  }
                />
              </div>
            </div>

            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Professional Identity"
                title="Bio, Links and Skills"
                subtitle="Keep your profile strong so recruiters and companies can see your work and tech stack clearly."
              />

              <div className="mt-8 grid gap-5">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Bio
                  </p>
                  {editMode ? (
                    <textarea
                      name="bio"
                      value={form.bio}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Write a short professional bio"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                    />
                  ) : (
                    <p className="leading-7 text-slate-700">
                      {safeText(profileSource.bio, "No bio added yet.")}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Resume URL
                    </p>
                    {editMode ? (
                      <input
                        name="resumeUrl"
                        value={form.resumeUrl}
                        onChange={handleChange}
                        placeholder="https://..."
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                      />
                    ) : (
                      <button
                        onClick={() => openLink(profileSource.resumeUrl)}
                        disabled={!profileSource.resumeUrl}
                        className="text-left font-semibold text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {safeText(profileSource.resumeUrl)}
                      </button>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Portfolio URL
                    </p>
                    {editMode ? (
                      <input
                        name="portfolioUrl"
                        value={form.portfolioUrl}
                        onChange={handleChange}
                        placeholder="https://..."
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-blue-500"
                      />
                    ) : (
                      <button
                        onClick={() => openLink(profileSource.portfolioUrl)}
                        disabled={!profileSource.portfolioUrl}
                        className="text-left font-semibold text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {safeText(profileSource.portfolioUrl)}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Skills
                  </p>
                  {editMode ? (
                    <textarea
                      name="skills"
                      value={form.skills}
                      onChange={handleChange}
                      rows={3}
                      placeholder="HTML, CSS, JavaScript, React, Node.js"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                    />
                  ) : skillsList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {skillsList.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500">No skills added yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Performance"
                title="Growth Overview"
                subtitle="These metrics are connected to your dashboard and reflect how well you are performing in the portal."
              />

              <div className="mt-8 space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      Profile Completion
                    </span>
                    <span className="font-black text-blue-700">
                      {profileCompletion}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      Assessment Score
                    </span>
                    <span className="font-black text-cyan-700">
                      {assessmentScore}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                      style={{ width: `${assessmentScore}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Scholarship
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {scholarshipPercentage}%
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Notifications
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {unreadNotifications}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Points
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {leaderboardPoints}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Rank
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {rank ? `#${rank}` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Career Data"
                title="Internship & Certificate"
                subtitle="Everything recruiters need to understand your current progress."
              />

              <div className="mt-8 space-y-4">
                <InfoRow
                  icon={FaBriefcase}
                  label="Internship Status"
                  value={safeText(internship.status, "Not Applied")}
                />
                <InfoRow
                  icon={FaFileAlt}
                  label="Certificate"
                  value={
                    certificates.certificateIssued
                      ? `Issued • ${safeText(
                          certificates.certificateId,
                          "No ID"
                        )}`
                      : "Not issued yet"
                  }
                />
                <InfoRow
                  icon={FaShieldAlt}
                  label="Verification"
                  value={
                    certificates.certificateIssued
                      ? "Available for verification"
                      : "Not available"
                  }
                />
                <InfoRow
                  icon={FaRegCalendarAlt}
                  label="Last Login"
                  value={formatDateTime(profileSource.lastLogin)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
            <SectionTitle
              eyebrow="Recent Activity"
              title="Latest Student Activity"
              subtitle="Your latest completion and pending work pulled from the dashboard timeline."
            />

            <div className="mt-8 space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((item, index) => (
                  <div
                    key={`${item.type}-${index}`}
                    className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div
                      className={[
                        "mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl",
                        item.type === "task"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700",
                      ].join(" ")}
                    >
                      {item.type === "task" ? (
                        <FaCheckCircle />
                      ) : (
                        <FaClipboardCheck />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                  No recent activity found.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
            <SectionTitle
              eyebrow="Quick Actions"
              title="Shortcuts"
              subtitle="Open important areas of the portal instantly."
            />

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Dashboard",
                  icon: FaChartLine,
                  to: "/student/dashboard",
                },
                {
                  title: "Tasks",
                  icon: FaClipboardCheck,
                  to: "/student/daily-tasks",
                },
                {
                  title: "Certificates",
                  icon: FaAward,
                  to: "/student/certificates",
                },
                {
                  title: "AI Mentor",
                  icon: FaBrain,
                  to: "/student/ai-mentor",
                },
                {
                  title: "Internships",
                  icon: FaBriefcase,
                  to: "/student/internships",
                },
                {
                  title: "Profile",
                  icon: FaUser,
                  to: "/student/profile",
                },
              ].map((item) => (
                <motion.button
                  key={item.title}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(item.to)}
                  className="rounded-[28px] border border-slate-100 bg-slate-50 p-5 text-left shadow-sm transition hover:shadow-lg"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-100 text-blue-700">
                    <item.icon className="text-lg" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Open {item.title.toLowerCase()} page
                  </p>
                </motion.button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/student/dashboard")}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-bold text-white shadow-lg transition hover:scale-[1.01]"
              >
                <FaRocket />
                Go to Dashboard
              </button>
              <button
                onClick={() => navigate("/student/certificates")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <FaExternalLinkAlt />
                Open Certificates
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {copyState && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl"
            >
              {copyState}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default StudentProfile;