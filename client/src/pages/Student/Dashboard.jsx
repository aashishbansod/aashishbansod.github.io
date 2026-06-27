import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FaArrowRight,
  FaAward,
  FaBrain,
  FaBriefcase,
  FaCertificate,
  FaCheckCircle,
  FaCode,
  FaClock,
  FaEnvelope,
  FaGraduationCap,
  FaHome,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaRocket,
  FaShieldAlt,
  FaStar,
  FaSyncAlt,
  FaTrophy,
  FaUsers,
  FaBell,
  FaTasks,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaFileAlt,
  FaExternalLinkAlt,
  FaRegCalendarAlt,
  FaChartLine,
  FaLock,
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

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value) {
  const n = safeNumber(value, 0);
  return Math.max(0, Math.min(100, Math.round(n)));
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

function getInitials(name = "") {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "S";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div>
      <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
        {subtitle}
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtext, tone = "blue" }) {
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
      whileHover={{ y: -4 }}
      className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60"
    >
      <div
        className={[
          "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br",
          toneMap[tone] || toneMap.blue,
        ].join(" ")}
      >
        <Icon className="text-xl" />
      </div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <h3 className="mt-2 text-3xl font-black text-slate-900">{value}</h3>
      <p className="mt-2 text-xs font-medium text-slate-500">{subtext}</p>
    </motion.div>
  );
}

function ActionCard({ icon: Icon, title, desc, onClick, tone = "blue" }) {
  const toneMap = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    cyan: "from-cyan-50 to-cyan-100 text-cyan-700",
    slate: "from-slate-50 to-slate-100 text-slate-700",
  };

  return (
    <motion.button
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="rounded-[28px] border border-slate-100 bg-white p-5 text-left shadow-lg shadow-slate-200/60 transition hover:shadow-xl"
    >
      <div
        className={[
          "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br",
          toneMap[tone] || toneMap.blue,
        ].join(" ")}
      >
        <Icon className="text-xl" />
      </div>
      <h3 className="text-xl font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
    </motion.button>
  );
}

function TaskRow({ task, onOpen }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">{safeText(task.title)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {safeText(task.description || task.desc || "Daily portal task")}
          </p>
        </div>

        <span
          className={[
            "shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold",
            String(task.status || "").toLowerCase().includes("completed")
              ? "border-emerald-200 bg-emerald-100 text-emerald-700"
              : String(task.status || "").toLowerCase().includes("pending")
              ? "border-amber-200 bg-amber-100 text-amber-700"
              : "border-blue-200 bg-blue-100 text-blue-700",
          ].join(" ")}
        >
          {safeText(task.status, "Pending")}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <FaRegCalendarAlt />
            {formatDate(task.dueDate || task.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <FaChartLine />
            {safeNumber(task.points || task.xp || 0)} XP
          </span>
        </div>

        <button
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
        >
          Open
          <FaArrowRight className="text-xs" />
        </button>
      </div>
    </div>
  );
}

function NotificationRow({ item }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
        <FaInfoCircle />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-900">
          {safeText(item.title || item.subject || item.message)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {safeText(item.message || item.desc || "Notification")}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {formatDateTime(item.createdAt || item.date)}
        </p>
      </div>
    </div>
  );
}

function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-[28px] bg-slate-200/80 ${className}`}
    />
  );
}

function StudentDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [currentTime, setCurrentTime] = useState(new Date());

  const [student, setStudent] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    college: "",
    course: "",
    year: "",
    city: "",
    profileImage: "",
    internshipStatus: "Not Applied",
    internshipProgress: 0,
    assessmentScore: 0,
    scholarshipPercentage: 0,
    leaderboardPoints: 0,
    profileCompletion: 0,
    certificates: 0,
    rank: 0,
    placementStatus: "Not Eligible",
    currentInternship: null,
  });

  const [dashboard, setDashboard] = useState({});
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activities, setActivities] = useState([]);

  const authCheck = useCallback(() => {
    const token = getToken();
    if (!token) {
      clearAuthStorage();
      navigate("/login", { replace: true });
      return false;
    }
    return true;
  }, [navigate]);

  const loadDashboard = useCallback(async () => {
    if (!authCheck()) return;

    try {
      setLoading(true);
      setError("");

      const [dashRes, tasksRes, notifRes, statsRes, profileRes] =
        await Promise.allSettled([
          api.get("/student/dashboard"),
          api.get("/student/tasks"),
          api.get("/student/notifications"),
          api.get("/student/stats"),
          api.get("/student/profile"),
        ]);

      const dashData = dashRes.status === "fulfilled" ? dashRes.value?.data || {} : {};
      const taskData = tasksRes.status === "fulfilled" ? tasksRes.value?.data || {} : {};
      const notifData = notifRes.status === "fulfilled" ? notifRes.value?.data || {} : {};
      const statsData = statsRes.status === "fulfilled" ? statsRes.value?.data || {} : {};
      const profileData = profileRes.status === "fulfilled" ? profileRes.value?.data || {} : {};

      const studentSource =
        dashData.student ||
        dashData.profile ||
        profileData.student ||
        profileData.profile ||
        profileData.user ||
        statsData.student ||
        {};

      setStudent((prev) => ({
        ...prev,
        firstName: studentSource.firstName || prev.firstName,
        lastName: studentSource.lastName || prev.lastName,
        email: studentSource.email || prev.email,
        mobile: studentSource.mobile || prev.mobile,
        college: studentSource.college || prev.college,
        course: studentSource.course || prev.course,
        year: studentSource.year || prev.year,
        city: studentSource.city || prev.city,
        profileImage: studentSource.profileImage || prev.profileImage,
        internshipStatus: studentSource.internshipStatus || dashData.internshipStatus || prev.internshipStatus,
        internshipProgress: safeNumber(
          studentSource.internshipProgress ||
            dashData.internshipProgress ||
            dashData.progress ||
            prev.internshipProgress,
          0
        ),
        assessmentScore: safeNumber(
          studentSource.assessmentScore ||
            dashData.assessmentScore ||
            statsData.assessmentScore ||
            prev.assessmentScore,
          0
        ),
        scholarshipPercentage: safeNumber(
          studentSource.scholarshipPercentage ||
            dashData.scholarshipPercentage ||
            statsData.scholarshipPercentage ||
            prev.scholarshipPercentage,
          0
        ),
        leaderboardPoints: safeNumber(
          studentSource.leaderboardPoints ||
            dashData.leaderboardPoints ||
            statsData.leaderboardPoints ||
            statsData.totalXP ||
            prev.leaderboardPoints,
          0
        ),
        profileCompletion: safeNumber(
          studentSource.profileCompletion ||
            dashData.profileCompletion ||
            statsData.profileCompletion ||
            prev.profileCompletion,
          0
        ),
        certificates: safeNumber(
          studentSource.certificates ||
            dashData.certificates ||
            statsData.certificates ||
            prev.certificates,
          0
        ),
        rank: safeNumber(
          studentSource.rank ||
            dashData.rank ||
            statsData.rank ||
            prev.rank,
          0
        ),
        placementStatus:
          studentSource.placementStatus ||
          dashData.placementStatus ||
          prev.placementStatus,
        currentInternship:
          studentSource.currentInternship ||
          dashData.currentInternship ||
          prev.currentInternship,
      }));

      setDashboard(dashData);
      setTasks(
        Array.isArray(taskData.tasks)
          ? taskData.tasks
          : Array.isArray(dashData.tasks)
          ? dashData.tasks
          : Array.isArray(statsData.tasks)
          ? statsData.tasks
          : []
      );
      setNotifications(
        Array.isArray(notifData.notifications)
          ? notifData.notifications
          : Array.isArray(dashData.notifications)
          ? dashData.notifications
          : []
      );
      setActivities(
        Array.isArray(dashData.activities)
          ? dashData.activities
          : Array.isArray(dashData.timeline)
          ? dashData.timeline
          : []
      );

      setToast("Dashboard loaded successfully");
      setTimeout(() => setToast(""), 1400);
    } catch (err) {
      console.error("DASHBOARD LOAD ERROR:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load dashboard"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authCheck]);

  useEffect(() => {
    loadDashboard();

    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const handleQuickAction = (path) => {
    navigate(path);
  };

  const profileCompletion = clampPercent(student.profileCompletion);
  const assessmentScore = clampPercent(student.assessmentScore);
  const scholarshipPercentage = clampPercent(student.scholarshipPercentage);
  const internshipProgress = clampPercent(student.internshipProgress);
  const certificatesCount = safeNumber(student.certificates, 0);
  const leaderboardPoints = safeNumber(student.leaderboardPoints, 0);
  const rank = safeNumber(student.rank, 0);

  const quickActions = useMemo(
    () => [
      {
        title: "Open Tasks",
        desc: "Check pending and completed work",
        icon: FaTasks,
        path: "/student/daily-tasks",
        tone: "blue",
      },
      {
        title: "Assessment",
        desc: "View your latest score",
        icon: FaGraduationCap,
        path: "/student/assessment",
        tone: "emerald",
      },
      {
        title: "Certificates",
        desc: "Download your documents",
        icon: FaCertificate,
        path: "/student/certificates",
        tone: "amber",
      },
      {
        title: "AI Mentor",
        desc: "Get guidance and support",
        icon: FaBrain,
        path: "/student/ai-mentor",
        tone: "purple",
      },
      {
        title: "Internships",
        desc: "Track your internship journey",
        icon: FaBriefcase,
        path: "/student/internships",
        tone: "cyan",
      },
      {
        title: "Leaderboard",
        desc: "See your ranking",
        icon: FaTrophy,
        path: "/student/leaderboard",
        tone: "rose",
      },
    ],
    []
  );

  const systemStatus = useMemo(
    () => [
      { label: "Backend Connected", tone: "green" },
      { label: "MongoDB Online", tone: "green" },
      { label: "Student API Active", tone: "green" },
      { label: "CyberNet Cloud Ready", tone: "green" },
    ],
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <SkeletonBlock className="h-56 w-full rounded-[36px]" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-36" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <SkeletonBlock className="h-[560px]" />
            <SkeletonBlock className="h-[560px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-xl rounded-[32px] border border-slate-100 bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <FaExclamationTriangle className="text-3xl" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-slate-900">
            Dashboard Error
          </h2>
          <p className="mt-3 text-slate-600">{error}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-bold text-white shadow-lg"
            >
              <FaSyncAlt />
              Retry
            </button>

            <button
              onClick={() => navigate("/student/profile")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50"
            >
              Open Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  const studentName =
    `${student.firstName || ""} ${student.lastName || ""}`.trim() || "Student";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[36px] bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-8 lg:p-10"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[30px] border-4 border-white/20 bg-white/10 shadow-2xl backdrop-blur">
                  {student.profileImage ? (
                    <img
                      src={student.profileImage}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-black text-white/90">
                      {getInitials(studentName)}
                    </span>
                  )}
                </div>
                <div className="absolute -right-2 -bottom-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-700 shadow-xl">
                  <FaCheckCircle />
                </div>
              </div>

              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] backdrop-blur">
                  <FaHome />
                  Student Dashboard
                </span>

                <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
                  Welcome back, {student.firstName || "Student"} 👋
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                  CyberNet Internship Portal is live with assessment tracking,
                  internship application flow, certificates, leaderboard, and
                  AI mentor support.
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
                    <FaClock className="text-emerald-200" />
                    {currentTime.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-blue-700 shadow-xl transition hover:scale-[1.02]"
              >
                <FaSyncAlt className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={() => navigate("/student/profile")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur transition hover:bg-white/15"
              >
                <FaExternalLinkAlt />
                Open Profile
              </button>
            </div>
          </div>
        </motion.section>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FaGraduationCap}
            label="Assessment Score"
            value={`${assessmentScore}%`}
            subtext="Latest attempt"
            tone="blue"
          />
          <StatCard
            icon={FaBriefcase}
            label="Internship Progress"
            value={`${internshipProgress}%`}
            subtext={safeText(student.internshipStatus, "Not Applied")}
            tone="emerald"
          />
          <StatCard
            icon={FaCertificate}
            label="Certificates"
            value={certificatesCount}
            subtext="Issued to your account"
            tone="amber"
          />
          <StatCard
            icon={FaAward}
            label="Scholarship"
            value={`${scholarshipPercentage}%`}
            subtext="Discount eligibility"
            tone="purple"
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Quick Actions"
                title="Open your most important pages"
                subtitle="Everything a student needs is just one click away."
              />

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {quickActions.map((action) => (
                  <ActionCard
                    key={action.title}
                    icon={action.icon}
                    title={action.title}
                    desc={action.desc}
                    tone={action.tone}
                    onClick={() => handleQuickAction(action.path)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Today’s Tasks"
                title="Your latest work items"
                subtitle="Track progress, due dates, and task completion from the backend."
              />

              <div className="mt-8 space-y-4">
                {tasks.length > 0 ? (
                  tasks.slice(0, 5).map((task, index) => (
                    <TaskRow
                      key={task._id || task.id || index}
                      task={task}
                      onOpen={() => navigate("/student/daily-tasks")}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                    No tasks available yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Recent Activity"
                title="Latest notifications and updates"
                subtitle="Important portal updates, tasks, assessments, and internship messages."
              />

              <div className="mt-8 space-y-4">
                {notifications.length > 0 ? (
                  notifications.slice(0, 5).map((item, index) => (
                    <NotificationRow key={item._id || index} item={item} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                    No notifications right now.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Profile Overview"
                title="Your student summary"
                subtitle="These values are pulled from the backend and reflect your current portal status."
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
                    <span className="font-black text-emerald-700">
                      {assessmentScore}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                      style={{ width: `${assessmentScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      Internship Progress
                    </span>
                    <span className="font-black text-purple-700">
                      {internshipProgress}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${internshipProgress}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Notifications
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {notifications.length}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Current Rank
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {rank ? `#${rank}` : "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Placement
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {safeText(student.placementStatus, "Not Eligible")}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Last Updated
                    </p>
                    <p className="mt-2 text-lg font-black text-slate-900">
                      {formatDateTime(dashboard.updatedAt || dashboard.lastUpdatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
              <SectionTitle
                eyebrow="Career Identity"
                title="Your current profile"
                subtitle="This is the student data used throughout the CyberNet portal."
              />

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Student Name
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {studentName}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Email
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {safeText(student.email)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    College
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {safeText(student.college)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Course / Year
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {safeText(student.course)} • {safeText(student.year)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Internship Status
                  </p>
                  <p className="mt-2 text-base font-bold text-slate-900">
                    {safeText(student.internshipStatus, "Not Applied")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
          <SectionTitle
            eyebrow="System Status"
            title="Portal health"
            subtitle="Key backend and platform indicators for quick launch confidence."
          />

          <div className="mt-8 flex flex-wrap gap-4">
            {systemStatus.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700"
              >
                <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-[34px] bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-8 text-white shadow-2xl shadow-blue-950/20">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur">
                <FaRocket />
                CyberNet Student Portal
              </div>

              <h2 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">
                Everything you need in one dashboard
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                Move between tasks, assessments, internships, certificates, and
                mentor guidance without leaving the platform.
              </p>

              <div className="mt-7 flex flex-wrap gap-4">
                <button
                  onClick={() => navigate("/student/internships")}
                  className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 font-bold text-blue-700 shadow-lg transition hover:scale-[1.02]"
                >
                  Explore Internships
                  <FaArrowRight />
                </button>

                <button
                  onClick={() => navigate("/student/assessment")}
                  className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-6 py-4 font-bold text-white transition hover:bg-white/15"
                >
                  Take Assessment
                  <FaClipboardCheck />
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <FaUsers className="text-3xl text-cyan-300" />
                <h3 className="mt-4 text-xl font-black">Student Growth</h3>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Track your learning, progress, and reward status.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <FaShieldAlt className="text-3xl text-emerald-300" />
                <h3 className="mt-4 text-xl font-black">Secure Workflow</h3>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Role-based portal access and protected student data.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <FaBrain className="text-3xl text-purple-300" />
                <h3 className="mt-4 text-xl font-black">AI Mentor</h3>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Get help with career, skill growth, and next steps.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <FaCertificate className="text-3xl text-amber-300" />
                <h3 className="mt-4 text-xl font-black">Verified Certificates</h3>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Download and verify your achievements when issued.
                </p>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {toast ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl"
            >
              {toast}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate("/student/ai-mentor")}
          className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-2xl shadow-blue-600/30"
          aria-label="Open AI mentor"
        >
          <FaBrain className="text-2xl" />
        </motion.button>
      </div>
    </div>
  );
}

export default StudentDashboard;