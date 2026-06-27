import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaTrophy,
  FaFire,
  FaBullseye,
  FaStar,
  FaBolt,
  FaSearch,
  FaFilter,
  FaSyncAlt,
  FaBrain,
  FaCertificate,
  FaGraduationCap,
  FaClipboardCheck,
  FaRegCalendarAlt,
  FaChartLine,
  FaExclamationCircle,
  FaInfoCircle,
  FaArrowRight,
  FaFlagCheckered,
  FaLayerGroup,
  FaRoute,
  FaLightbulb,
  FaRocket,
  FaBars,
  FaList,
} from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const STORAGE_KEYS = [
  "token",
  "authToken",
  "cybernet_token",
  "student",
  "userRole",
];

function getToken() {
  if (typeof window === "undefined") return "";
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

function clampPercent(value) {
  const n = Number(value || 0);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeString(value, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function toneClasses(status = "") {
  const value = String(status).toLowerCase();

  if (value.includes("completed")) {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  if (value.includes("pending")) {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  if (value.includes("in progress")) {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }

  if (value.includes("rejected") || value.includes("blocked")) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
}

function normalizeTask(task) {
  return {
    id: task?._id || task?.id || "",
    title: task?.title || "Untitled Task",
    description:
      task?.description ||
      task?.details ||
      task?.summary ||
      "No description available.",
    category: task?.category || task?.type || "General",
    xp: Number(task?.points || task?.xp || 10),
    completed:
      String(task?.status || "").toLowerCase() === "completed" ||
      Boolean(task?.completed),
    status: task?.status || (task?.completed ? "Completed" : "Pending"),
    dueDate: task?.dueDate || task?.deadline || null,
    assignedDate: task?.assignedDate || task?.createdAt || null,
    completedDate: task?.completedDate || null,
    priority: task?.priority || "Medium",
  };
}

function TaskCard({ task, onComplete, busy }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-[30px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <FaBullseye />
              {safeString(task.category)}
            </span>

            <span
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
                toneClasses(task.status),
              ].join(" ")}
            >
              {task.completed ? <FaCheckCircle /> : <FaClock />}
              {task.completed ? "Completed" : safeString(task.status, "Pending")}
            </span>

            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Priority: {safeString(task.priority)}
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-900">
            {task.title}
          </h3>

          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            {task.description}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <FaRegCalendarAlt className="text-slate-400" />
              Due {formatDate(task.dueDate)}
            </span>

            <span className="inline-flex items-center gap-2">
              <FaClipboardCheck className="text-slate-400" />
              Assigned {formatDate(task.assignedDate)}
            </span>

            {task.completedDate && (
              <span className="inline-flex items-center gap-2">
                <FaCheckCircle className="text-emerald-500" />
                Completed {formatDateTime(task.completedDate)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-4 text-white shadow-lg shadow-blue-600/20">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
              XP Reward
            </div>
            <div className="mt-1 text-3xl font-black">+{task.xp}</div>
          </div>

          {!task.completed ? (
            <button
              onClick={() => onComplete(task.id)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? (
                <>
                  <FaSyncAlt className="animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <FaCheckCircle />
                  Mark Complete
                </>
              )}
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-5 py-3 font-bold text-emerald-700">
              <FaCheckCircle />
              Completed
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone = "blue" }) {
  const map = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    cyan: "from-cyan-50 to-cyan-100 text-cyan-700",
    red: "from-red-50 to-red-100 text-red-700",
    slate: "from-slate-50 to-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50">
      <div
        className={[
          "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br",
          map[tone] || map.blue,
        ].join(" ")}
      >
        <Icon className="text-xl" />
      </div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-xs font-medium text-slate-500">{hint}</p>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
          <FaBars size={12} />
          CyberNet Student Portal
        </div>
        <h2 className="mt-4 text-2xl font-black text-slate-900 sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          {subtitle}
        </p>
      </div>
      {action}
    </div>
  );
}

export default function StudentDailyTasks() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState("");
  const [error, setError] = useState("");

  const [dashboard, setDashboard] = useState(null);
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [category, setCategory] = useState("All");

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

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const [dashboardRes, tasksRes, statsRes] = await Promise.allSettled([
          fetchJSON("/student/dashboard"),
          fetchJSON("/student/tasks"),
          fetchJSON("/student/stats"),
        ]);

        if (dashboardRes.status === "fulfilled") {
          setDashboard(dashboardRes.value?.dashboard || null);
        }

        if (tasksRes.status === "fulfilled") {
          const rawTasks = Array.isArray(tasksRes.value?.tasks)
            ? tasksRes.value.tasks
            : Array.isArray(tasksRes.value?.data?.tasks)
            ? tasksRes.value.data.tasks
            : [];
          setTasks(rawTasks.map(normalizeTask));
        } else if (dashboardRes.status === "fulfilled") {
          const fallbackTasks = Array.isArray(
            dashboardRes.value?.dashboard?.tasks?.items
          )
            ? dashboardRes.value.dashboard.tasks.items
            : [];
          setTasks(fallbackTasks.map(normalizeTask));
        }

        if (statsRes.status === "fulfilled") {
          setStats(statsRes.value?.stats || null);
        }
      } catch (err) {
        console.error(err);
        setError(err?.message || "Unable to load tasks");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchJSON]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks]
  );

  const pendingCount = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks]
  );

  const totalXP = useMemo(
    () =>
      tasks
        .filter((task) => task.completed)
        .reduce((sum, task) => sum + Number(task.xp || 0), 0),
    [tasks]
  );

  const totalTasks = tasks.length;
  const progress = clampPercent(
    totalTasks ? (completedCount / totalTasks) * 100 : 0
  );

  const streakDays = Number(
    stats?.streakDays || dashboard?.meta?.streakDays || 0
  );
  const leaderboardPoints = Number(
    stats?.leaderboardPoints || dashboard?.performance?.leaderboardPoints || 0
  );
  const rank = Number(stats?.rank || dashboard?.performance?.rank || 0);
  const assessmentScore = clampPercent(
    stats?.assessmentScore || dashboard?.performance?.assessmentScore
  );
  const scholarshipPercentage = clampPercent(
    stats?.scholarshipPercentage || dashboard?.performance?.scholarshipPercentage
  );
  const unreadNotifications = Number(
    stats?.unreadNotifications || dashboard?.meta?.unreadNotifications || 0
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks
      .filter((task) => {
        const matchesSearch =
          !query ||
          task.title.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.category.toLowerCase().includes(query);

        const matchesFilter =
          filter === "All"
            ? true
            : filter === "Completed"
            ? task.completed
            : !task.completed;

        const matchesCategory =
          category === "All" ? true : task.category === category;

        return matchesSearch && matchesFilter && matchesCategory;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const aDate = new Date(a.dueDate || a.assignedDate || 0).getTime();
        const bDate = new Date(b.dueDate || b.assignedDate || 0).getTime();
        return aDate - bDate;
      });
  }, [tasks, search, filter, category]);

  const categories = useMemo(() => {
    const values = new Set(tasks.map((task) => task.category).filter(Boolean));
    return ["All", ...Array.from(values)];
  }, [tasks]);

  const handleRefresh = async () => {
    await loadData({ silent: true });
  };

  const handleCompleteTask = async (taskId) => {
    if (!taskId) return;

    try {
      setBusyTaskId(taskId);
      await fetchJSON(`/student/tasks/${taskId}/complete`, {
        method: "PATCH",
      });
      await loadData({ silent: true });
    } catch (err) {
      setError(err?.message || "Unable to complete task");
    } finally {
      setBusyTaskId("");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilter("All");
    setCategory("All");
  };

  const heroName = dashboard?.profile?.firstName
    ? `Good ${
        new Date().getHours() < 12
          ? "Morning"
          : new Date().getHours() < 17
          ? "Afternoon"
          : "Evening"
      }, ${dashboard.profile.firstName}`
    : "Daily Tasks";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <h2 className="mt-6 text-2xl font-black text-slate-800">
            Loading Daily Tasks...
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Syncing with CyberNet backend
          </p>
        </div>
      </div>
    );
  }

  if (error && !tasks.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg rounded-[32px] border border-slate-100 bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <FaExclamationCircle className="text-3xl" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-slate-900">
            Tasks Error
          </h2>
          <p className="mt-3 text-slate-600">{error}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-bold text-white shadow-lg"
            >
              <FaSyncAlt className={refreshing ? "animate-spin" : ""} />
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

  const quickStats = [
    {
      icon: FaFire,
      label: "Streak Days",
      value: streakDays || 0,
      hint: "Keep consistency",
      tone: "amber",
    },
    {
      icon: FaBolt,
      label: "XP Earned",
      value: totalXP,
      hint: "Completed tasks only",
      tone: "blue",
    },
    {
      icon: FaCheckCircle,
      label: "Completed",
      value: completedCount,
      hint: `Out of ${totalTasks} tasks`,
      tone: "emerald",
    },
    {
      icon: FaTrophy,
      label: "Current Rank",
      value: rank ? `#${rank}` : "—",
      hint: `Points: ${leaderboardPoints}`,
      tone: "purple",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-8 lg:p-10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.14),transparent_35%)]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur">
                <FaTasks />
                Student Daily Missions
              </span>

              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                {heroName}
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                Complete your daily tasks, build discipline, earn XP and keep your
                internship journey moving inside the CyberNet platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/student/ai-mentor")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-blue-700 shadow-lg shadow-black/10 transition hover:scale-[1.02]"
                >
                  <FaBrain />
                  Ask AI Mentor
                </button>

                <button
                  onClick={() => navigate("/student/assessment")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  <FaGraduationCap />
                  Open Assessment
                </button>

                <button
                  onClick={() => navigate("/student/certificates")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  <FaCertificate />
                  Certificates
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:min-w-[420px] xl:max-w-[520px]">
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">
                    Completion
                  </span>
                  <FaFlagCheckered className="text-cyan-200" />
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-black">{progress}%</span>
                  <span className="pb-1 text-sm text-slate-200">of today’s tasks</span>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">Streak</span>
                  <FaFire className="text-orange-300" />
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-black">{streakDays || 0}</span>
                  <span className="pb-1 text-sm text-slate-200">days</span>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">XP Earned</span>
                  <FaBolt className="text-amber-300" />
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-black">{totalXP}</span>
                  <span className="pb-1 text-sm text-slate-200">points today</span>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">Rank</span>
                  <FaTrophy className="text-amber-300" />
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-4xl font-black">
                    {rank ? `#${rank}` : "—"}
                  </span>
                  <span className="pb-1 text-sm text-slate-200">leaderboard</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((item) => (
            <MetricCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              hint={item.hint}
              tone={item.tone}
            />
          ))}
        </div>

        <div className="mt-8 rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">
                Today’s Progress
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Finish all tasks to unlock daily bonus XP and maintain your streak.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <FaSyncAlt className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="mt-6 h-4 rounded-full bg-slate-100">
            <div
              className="h-4 rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span>
              {completedCount} / {totalTasks} tasks completed
            </span>
            <span>{totalXP} XP earned today</span>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-[30px] bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-white shadow-xl">
            <FaStar className="text-3xl" />
            <h3 className="mt-4 text-2xl font-black">Daily Bonus</h3>
            <p className="mt-2 text-sm leading-6 text-white/90">
              Complete every task and unlock extra XP rewards for the day.
            </p>
          </div>

          <div className="rounded-[30px] bg-gradient-to-r from-purple-600 to-pink-500 p-6 text-white shadow-xl">
            <FaTrophy className="text-3xl" />
            <h3 className="mt-4 text-2xl font-black">Achievement</h3>
            <p className="mt-2 text-sm leading-6 text-white/90">
              Build consistency and unlock badges as you progress.
            </p>
          </div>

          <div className="rounded-[30px] bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white shadow-xl">
            <FaFire className="text-3xl" />
            <h3 className="mt-4 text-2xl font-black">Streak Reward</h3>
            <p className="mt-2 text-sm leading-6 text-white/90">
              Maintain your streak for premium reward access and momentum.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[34px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px_220px]">
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks, categories, descriptions..."
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="relative">
              <FaFilter className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="All">All Tasks</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="flex items-center justify-center rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {filteredTasks.length} visible tasks
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={[
                  "rounded-full px-4 py-2 text-xs font-bold transition",
                  category === cat
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700",
                ].join(" ")}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">
                Today’s Tasks
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Complete tasks to earn XP and move ahead in the leaderboard.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <FaInfoCircle className="text-blue-500" />
              Backend connected
            </div>
          </div>

          <div className="space-y-5">
            <AnimatePresence mode="popLayout">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                  >
                    <TaskCard
                      task={task}
                      busy={busyTaskId === task.id}
                      onComplete={handleCompleteTask}
                    />
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[34px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-lg shadow-slate-200/60"
                >
                  <FaClipboardCheck className="mx-auto text-4xl text-slate-400" />
                  <h3 className="mt-4 text-2xl font-black text-slate-900">
                    No tasks found
                  </h3>
                  <p className="mt-3 text-slate-600">
                    Try changing your search, task filter or category.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  Task Summary
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Your current task status and progress overview.
                </p>
              </div>
              <FaChartLine className="text-3xl text-blue-600" />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Total
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">{totalTasks}</p>
              </div>

              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-500">
                  Completed
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-700">
                  {completedCount}
                </p>
              </div>

              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-500">
                  Pending
                </p>
                <p className="mt-2 text-3xl font-black text-amber-700">{pendingCount}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 p-5 text-white">
              <div className="flex items-center gap-3">
                <FaBolt className="text-2xl" />
                <div>
                  <h4 className="font-black">Daily Focus</h4>
                  <p className="mt-1 text-sm text-white/85">
                    Stay consistent, finish your tasks, and keep your streak active.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[34px] border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  Growth Snapshot
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Scores and platform metrics connected to your student account.
                </p>
              </div>
              <FaGraduationCap className="text-3xl text-cyan-600" />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Assessment Score
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {assessmentScore}%
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Scholarship
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {scholarshipPercentage}%
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Leaderboard Points
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {leaderboardPoints}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Unread Alerts
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {unreadNotifications}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/student/leaderboard")}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-bold text-white shadow-lg transition hover:scale-[1.01]"
              >
                <FaTrophy />
                Open Leaderboard
              </button>

              <button
                onClick={() => navigate("/student/dashboard")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <FaArrowRight />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>

        <footer className="py-8 text-center text-sm text-slate-500">
          <h3 className="font-bold text-slate-700">
            CyberNet Technology Systems
          </h3>
          <p className="mt-1">Internship Management Platform</p>
          <p className="mt-1">© {new Date().getFullYear()} All Rights Reserved</p>
        </footer>
      </div>

      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => navigate("/student/ai-mentor")}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-2xl shadow-blue-600/30"
        aria-label="Open AI Mentor"
      >
        <FaBrain className="text-2xl" />
      </motion.button>
    </div>
  );
}