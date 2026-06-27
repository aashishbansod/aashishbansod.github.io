import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  Ban,
  CheckCircle2,
  Clock3,
  GraduationCap,
  IndianRupee,
  Mail,
  Phone,
  Building2,
  BookOpen,
  Award,
  X,
  Save,
  Loader2,
  BadgeCheck,
  Sparkles,
  Star,
  Target,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const getFullName = (student) => {
  const first = normalizeText(student?.firstName);
  const last = normalizeText(student?.lastName);
  const full = `${first} ${last}`.trim();

  return (
    student?.fullName ||
    full ||
    normalizeText(student?.email) ||
    "Student"
  );
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0";
};

const downloadCSV = (filename, rows) => {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const safe = String(cell ?? "");
          return `"${safe.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const getStatusTone = (status) => {
  const value = String(status || "active").toLowerCase();

  if (value === "active") return "bg-emerald-100 text-emerald-700";
  if (value === "blocked") return "bg-rose-100 text-rose-700";
  if (value === "suspended") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

const getBooleanTone = (value) =>
  value
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-700";

const getAssessmentTone = (score) => {
  const value = Number(score || 0);

  if (value >= 90) return "bg-emerald-100 text-emerald-700";
  if (value >= 80) return "bg-blue-100 text-blue-700";
  if (value >= 60) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

const getScholarshipLabel = (value) => {
  const score = Number(value || 0);
  if (score >= 50) return "Elite";
  if (score >= 30) return "Premium";
  if (score >= 20) return "Strong";
  if (score >= 10) return "Good";
  if (score > 0) return "Starter";
  return "No Scholarship";
};

const getInternshipTone = (value) => {
  const text = String(value || "Not Applied");
  if (text === "Selected" || text === "In Progress" || text === "Completed") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (text === "Applied") return "bg-blue-100 text-blue-700";
  if (text === "Rejected") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
};

const toSafeBool = (value) =>
  String(value).toLowerCase() === "true" || value === true;

/*
|--------------------------------------------------------------------------
| UI Pieces
|--------------------------------------------------------------------------
*/

function StatCard({ icon: Icon, title, value, hint, tone = "blue" }) {
  const toneMap = {
    blue: "from-blue-50 to-blue-100 text-blue-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
    rose: "from-rose-50 to-rose-100 text-rose-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    slate: "from-slate-50 to-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
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
      <p className="mt-2 text-xs font-medium text-slate-500">{hint}</p>
    </div>
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

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
          <Sparkles size={14} />
          Admin Control Center
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
          {subtitle}
        </p>
      </div>

      {action}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Main Component
|--------------------------------------------------------------------------
*/

export default function AdminStudents() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const [dashboard, setDashboard] = useState(null);
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [assessmentFilter, setAssessmentFilter] = useState("All");
  const [internshipFilter, setInternshipFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [activeOnly, setActiveOnly] = useState("All");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editScore, setEditScore] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editReason, setEditReason] = useState("");

  const [pageInput, setPageInput] = useState("1");

  const loadStudents = useCallback(
    async (opts = {}) => {
      const nextPage = Number(opts.page || page);
      const nextLimit = Number(opts.limit || limit);

      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", String(nextLimit));

      const trimmedSearch = normalizeText(search);
      if (trimmedSearch) params.set("search", trimmedSearch);
      if (roleFilter !== "All") params.set("role", roleFilter);
      if (statusFilter !== "All") params.set("accountStatus", statusFilter);
      if (assessmentFilter !== "All")
        params.set("assessmentCompleted", assessmentFilter);
      if (internshipFilter !== "All")
        params.set("internshipUnlocked", internshipFilter);
      if (paymentFilter !== "All")
        params.set("paymentCompleted", paymentFilter);
      if (activeOnly !== "All") params.set("isActive", activeOnly);

      setError("");
      setNotice("");
      setLoading(true);

      try {
        const [dashboardRes, studentsRes] = await Promise.all([
          api.get("/admin/dashboard"),
          api.get(`/admin/students?${params.toString()}`),
        ]);

        setDashboard(dashboardRes?.data?.dashboard || null);

        const payload = studentsRes?.data || {};
        setStudents(Array.isArray(payload.students) ? payload.students : []);
        setTotal(Number(payload.total || 0));
        setPage(Number(payload.page || nextPage));
        setLimit(Number(payload.limit || nextLimit));
        setTotalPages(Number(payload.totalPages || 1));
        setPageInput(String(payload.page || nextPage));

        setNotice(
          `Loaded ${payload.count || 0} students from ${payload.total || 0} total records.`
        );
      } catch (err) {
        console.error("ADMIN STUDENTS LOAD ERROR:", err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load students"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      activeOnly,
      assessmentFilter,
      internshipFilter,
      limit,
      page,
      paymentFilter,
      roleFilter,
      search,
      statusFilter,
    ]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents({ page: 1 });
    }, 250);

    return () => clearTimeout(timer);
  }, [
    search,
    roleFilter,
    statusFilter,
    assessmentFilter,
    internshipFilter,
    paymentFilter,
    activeOnly,
    limit,
    loadStudents,
  ]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const computedCards = useMemo(() => {
    const totals = dashboard?.totals || {};
    const performance = dashboard?.performance || {};

    return {
      totalStudents: totals.students ?? total,
      activeStudents: totals.activeStudents ?? 0,
      blockedStudents: totals.blockedStudents ?? 0,
      suspendedStudents: totals.suspendedStudents ?? 0,
      assessments: totals.assessments ?? 0,
      internships: totals.internships ?? 0,
      activeInternships: totals.activeInternships ?? 0,
      payments: totals.payments ?? 0,
      successfulPayments: totals.successfulPayments ?? 0,
      results: totals.results ?? 0,
      averageScore: performance.averageScore ?? 0,
      passRate: performance.passRate ?? 0,
      revenue: dashboard?.revenue?.total ?? 0,
    };
  }, [dashboard, total]);

  const filteredSummary = useMemo(() => {
    const active = students.filter(
      (student) =>
        toSafeBool(student?.isActive) &&
        String(student?.accountStatus || "active").toLowerCase() === "active"
    ).length;

    const assessmentCompleted = students.filter((student) =>
      toSafeBool(student?.assessmentCompleted)
    ).length;

    const internshipUnlocked = students.filter((student) =>
      toSafeBool(student?.internshipUnlocked)
    ).length;

    const paymentCompleted = students.filter((student) =>
      toSafeBool(student?.paymentCompleted)
    ).length;

    return {
      active,
      assessmentCompleted,
      internshipUnlocked,
      paymentCompleted,
    };
  }, [students]);

  const openStudent = useCallback((student) => {
    setSelectedStudent(student);
    setEditScore(String(student?.assessmentScore ?? 0));
    setEditStatus(String(student?.accountStatus || "active"));
    setEditReason("");
  }, []);

  const closeModal = useCallback(() => {
    setSelectedStudent(null);
    setEditScore("");
    setEditStatus("");
    setEditReason("");
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadStudents({ page });
  }, [loadStudents, page]);

  const handleUpdateStatus = async (studentId, nextStatus, isActiveValue = true) => {
    setUpdatingId(studentId);
    setError("");
    setNotice("");

    try {
      const res = await api.patch(`/admin/students/${studentId}/status`, {
        accountStatus: nextStatus,
        isActive: isActiveValue,
        reason: editReason,
      });

      const updated = res?.data?.student;
      if (updated) {
        setStudents((prev) =>
          prev.map((student) =>
            String(student._id) === String(studentId) ? updated : student
          )
        );

        if (
          selectedStudent &&
          String(selectedStudent._id) === String(studentId)
        ) {
          setSelectedStudent(updated);
          setEditStatus(String(updated?.accountStatus || nextStatus));
        }
      }

      setNotice("Student status updated successfully.");
      await loadStudents({ page });
    } catch (err) {
      console.error("STATUS UPDATE ERROR:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to update student status"
      );
    } finally {
      setUpdatingId("");
    }
  };

  const handleUpdateAssessment = async () => {
    if (!selectedStudent) return;

    const score = Number(editScore);

    if (Number.isNaN(score) || score < 0 || score > 100) {
      setError("Assessment score must be between 0 and 100.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const res = await api.patch(
        `/admin/students/${selectedStudent._id}/assessment`,
        {
          assessmentScore: score,
          leaderboardPoints: selectedStudent.leaderboardPoints || 0,
        }
      );

      const updated = res?.data?.student;
      if (updated) {
        setStudents((prev) =>
          prev.map((student) =>
            String(student._id) === String(selectedStudent._id) ? updated : student
          )
        );
        setSelectedStudent(updated);
        setEditScore(String(updated?.assessmentScore ?? 0));
      }

      setNotice("Assessment data updated successfully.");
      await loadStudents({ page });
    } catch (err) {
      console.error("ASSESSMENT UPDATE ERROR:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to update assessment data"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (studentId) => {
    const student = students.find((item) => String(item._id) === String(studentId));
    const name = getFullName(student);

    const ok = window.confirm(
      `Delete ${name}? This action cannot be undone.`
    );

    if (!ok) return;

    setDeletingId(studentId);
    setError("");
    setNotice("");

    try {
      await api.delete(`/admin/students/${studentId}`);
      setStudents((prev) =>
        prev.filter((student) => String(student._id) !== String(studentId))
      );
      setTotal((prev) => Math.max(0, prev - 1));
      setNotice(`${name} deleted successfully.`);
      await loadStudents({ page });
    } catch (err) {
      console.error("DELETE ERROR:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to delete student"
      );
    } finally {
      setDeletingId("");
    }
  };

  const exportCSV = () => {
    const rows = [
      [
        "Name",
        "Email",
        "Mobile",
        "College",
        "Course",
        "Year",
        "Role",
        "Account Status",
        "Assessment Completed",
        "Assessment Score",
        "Scholarship %",
        "Internship Status",
        "Internship Unlocked",
        "Payment Completed",
        "Certificate Eligible",
        "Leaderboard Points",
        "Login Count",
        "Last Login",
        "Created At",
      ],
      ...students.map((student) => [
        getFullName(student),
        student?.email || "",
        student?.mobile || "",
        student?.college || student?.collegeName || "",
        student?.course || "",
        student?.year || "",
        student?.role || "",
        student?.accountStatus || "",
        student?.assessmentCompleted ? "Yes" : "No",
        student?.assessmentScore ?? 0,
        student?.scholarshipPercentage ?? 0,
        student?.internshipStatus || "",
        student?.internshipUnlocked ? "Yes" : "No",
        student?.paymentCompleted ? "Yes" : "No",
        student?.certificateEligible ? "Yes" : "No",
        student?.leaderboardPoints ?? 0,
        student?.loginCount ?? 0,
        student?.lastLogin ? formatDate(student.lastLogin) : "",
        formatDate(student?.createdAt),
      ]),
    ];

    downloadCSV(`cybernet_students_page_${page}.csv`, rows);
  };

  const goToPage = (nextPage) => {
    const pageNum = Math.max(1, Math.min(Number(nextPage || 1), totalPages));
    setPage(pageNum);
    setPageInput(String(pageNum));
    loadStudents({ page: pageNum });
  };

  const handlePageInputSubmit = (event) => {
    event.preventDefault();
    goToPage(pageInput);
  };

  const renderStudentName = (student) => (
    <div>
      <p className="font-semibold text-slate-900">{getFullName(student)}</p>
      <p className="text-xs text-slate-500">{student?.email || "—"}</p>
    </div>
  );

  const renderStatusCell = (student) => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="slate">
        {student?.role || "student"}
      </Badge>
      <Badge tone={String(student?.accountStatus || "active").toLowerCase()}>
        {student?.accountStatus || "active"}
      </Badge>
      <Badge tone={student?.isActive ? "emerald" : "rose"}>
        {student?.isActive ? "Active" : "Inactive"}
      </Badge>
    </div>
  );

  const renderDetailItem = (label, value, icon) => (
    <div className="rounded-[22px] bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <SectionTitle
          title="Student Management"
          subtitle="Search, filter, inspect, update, block/unblock, and remove students from the CyberNet admin portal."
          action={
            <div className="flex flex-wrap gap-3">
              <button
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                {refreshing ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <RefreshCw size={18} />
                )}
                Refresh
              </button>
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.01]"
              >
                <Download size={18} />
                Export CSV
              </button>
            </div>
          }
        />

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
              {error ? (
                <ShieldAlert className="mt-0.5" size={20} />
              ) : (
                <CheckCircle2 className="mt-0.5" size={20} />
              )}
              <div>
                <p className="font-bold">{error ? "Action failed" : "Status"}</p>
                <p className="mt-1 text-sm">{error || notice}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            title="Total Students"
            value={formatNumber(computedCards.totalStudents)}
            hint="All registered learners"
            tone="blue"
          />
          <StatCard
            icon={UserCheck}
            title="Active Students"
            value={formatNumber(computedCards.activeStudents)}
            hint="Currently active accounts"
            tone="emerald"
          />
          <StatCard
            icon={BadgeCheck}
            title="Assessment Passed"
            value={formatNumber(computedCards.assessmentPassed ?? 0)}
            hint="Students who cleared assessment"
            tone="purple"
          />
          <StatCard
            icon={IndianRupee}
            title="Revenue"
            value={`₹${formatNumber(computedCards.revenue)}`}
            hint="Successful payment revenue"
            tone="amber"
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Blocked</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {formatNumber(computedCards.blockedStudents)}
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Suspended</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {formatNumber(computedCards.suspendedStudents)}
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Assessments</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {formatNumber(computedCards.assessments)}
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Internships</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {formatNumber(computedCards.internships)}
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Avg Score</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {Number(computedCards.averageScore || 0).toFixed(2)}%
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Pass Rate</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {Number(computedCards.passRate || 0).toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[32px] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.7fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search students by name, email, college, course..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="All">All Roles</option>
                <option value="student">Student</option>
                <option value="mentor">Mentor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="All">All Status</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={assessmentFilter}
                onChange={(e) => {
                  setAssessmentFilter(e.target.value);
                  setPage(1);
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="All">Assessment: All</option>
                <option value="true">Completed</option>
                <option value="false">Not Completed</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={internshipFilter}
                onChange={(e) => {
                  setInternshipFilter(e.target.value);
                  setPage(1);
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="All">Internship: All</option>
                <option value="true">Unlocked</option>
                <option value="false">Locked</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="All">Payment: All</option>
                <option value="true">Paid</option>
                <option value="false">Pending</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-900">{students.length}</span> of{" "}
              <span className="font-semibold text-slate-900">{formatNumber(total)}</span> records
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-3">
              <Badge tone="blue">
                Total: {formatNumber(total)}
              </Badge>
              <Badge tone="emerald">
                Active: {formatNumber(filteredSummary.active)}
              </Badge>
              <Badge tone="purple">
                Passed: {formatNumber(filteredSummary.assessmentCompleted)}
              </Badge>
              <Badge tone="amber">
                Unlocked: {formatNumber(filteredSummary.internshipUnlocked)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[32px] border border-slate-100 bg-white shadow-lg shadow-slate-200/60">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Student Records
              </h2>
              <p className="text-sm text-slate-500">
                Manage student status, assessment score, and profile details.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <select
                  value={limit}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setLimit(next);
                    setPage(1);
                  }}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
                <input
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  className="h-11 w-20 rounded-2xl border border-slate-200 bg-slate-50 text-center outline-none"
                  inputMode="numeric"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-4 font-semibold text-white transition hover:bg-slate-800"
                >
                  Go
                </button>
              </form>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-[24px] bg-slate-100"
                />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto text-slate-300" size={48} />
              <h3 className="mt-4 text-2xl font-black text-slate-900">
                No students found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Try changing your filters or search query.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">College / Course</th>
                    <th className="px-5 py-4">Assessment</th>
                    <th className="px-5 py-4">Internship</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {students.map((student) => {
                    const studentId = String(student._id);
                    const assessmentScore = Number(student?.assessmentScore || 0);
                    const scholarship = Number(student?.scholarshipPercentage || 0);
                    const assessmentCompleted = toSafeBool(
                      student?.assessmentCompleted
                    );
                    const internshipUnlocked = toSafeBool(
                      student?.internshipUnlocked
                    );
                    const paymentCompleted = toSafeBool(student?.paymentCompleted);
                    const certificateEligible = toSafeBool(
                      student?.certificateEligible
                    );

                    return (
                      <tr
                        key={studentId}
                        className="transition hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-5 align-top">
                          {renderStudentName(student)}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone={assessmentCompleted ? "emerald" : "slate"}>
                              {assessmentCompleted ? "Assessment Done" : "Assessment Pending"}
                            </Badge>
                            <Badge tone={certificateEligible ? "blue" : "slate"}>
                              {certificateEligible ? "Certificate Eligible" : "Not Eligible"}
                            </Badge>
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Building2 size={16} className="text-slate-400" />
                              <span>{student?.college || student?.collegeName || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <GraduationCap size={16} className="text-slate-400" />
                              <span>{student?.course || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <BookOpen size={16} className="text-slate-400" />
                              <span>Year: {student?.year || "—"}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge tone={getAssessmentTone(assessmentScore)}>
                                Score {assessmentScore}%
                              </Badge>
                              <Badge tone={scholarship > 0 ? "purple" : "slate"}>
                                {scholarship}% scholarship
                              </Badge>
                            </div>
                            <div className="text-sm text-slate-500">
                              Completed:{" "}
                              <span className="font-semibold text-slate-900">
                                {assessmentCompleted ? "Yes" : "No"}
                              </span>
                            </div>
                            <div className="text-sm text-slate-500">
                              Points:{" "}
                              <span className="font-semibold text-slate-900">
                                {formatNumber(student?.leaderboardPoints || 0)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="space-y-2">
                            <Badge tone={internshipUnlocked ? "emerald" : "amber"}>
                              {internshipUnlocked ? "Unlocked" : "Locked"}
                            </Badge>
                            <Badge tone={getInternshipTone(student?.internshipStatus)}>
                              {student?.internshipStatus || "Not Applied"}
                            </Badge>
                            <div className="text-sm text-slate-500">
                              Progress:{" "}
                              <span className="font-semibold text-slate-900">
                                {Number(student?.internshipProgress || 0)}%
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="space-y-2">
                            <Badge tone={paymentCompleted ? "emerald" : "slate"}>
                              {paymentCompleted ? "Paid" : "Pending"}
                            </Badge>
                            <Badge tone={getStatusTone(student?.paymentStatus)}>
                              {student?.paymentStatus || "PENDING"}
                            </Badge>
                            <div className="text-sm text-slate-500">
                              Amount:{" "}
                              <span className="font-semibold text-slate-900">
                                ₹{formatNumber(student?.paidAmount || 0)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          {renderStatusCell(student)}
                          <div className="mt-3 text-xs text-slate-500">
                            Login count:{" "}
                            <span className="font-semibold text-slate-900">
                              {formatNumber(student?.loginCount || 0)}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openStudent(student)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Eye size={16} />
                              View
                            </button>

                            {String(student?.accountStatus || "active").toLowerCase() ===
                            "blocked" ? (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(studentId, "active", true)
                                }
                                disabled={updatingId === studentId}
                                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {updatingId === studentId ? (
                                  <Loader2 className="animate-spin" size={16} />
                                ) : (
                                  <UserCheck size={16} />
                                )}
                                Unblock
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(studentId, "blocked", true)
                                }
                                disabled={updatingId === studentId}
                                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {updatingId === studentId ? (
                                  <Loader2 className="animate-spin" size={16} />
                                ) : (
                                  <Ban size={16} />
                                )}
                                Block
                              </button>
                            )}

                            <button
                              onClick={() => handleDelete(studentId)}
                              disabled={deletingId === studentId}
                              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {deletingId === studentId ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Trash2 size={16} />
                              )}
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                onClick={() => goToPage(1)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                1
              </button>

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Student Details
                  </h2>
                  <p className="text-sm text-slate-500">
                    View and update account, assessment, and internship status.
                  </p>
                </div>

                <button
                  onClick={closeModal}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 transition hover:bg-slate-50"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                  <div className="rounded-[28px] bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 p-6 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/90">
                          <Sparkles size={12} />
                          Profile Snapshot
                        </div>
                        <h3 className="mt-4 text-3xl font-black">
                          {getFullName(selectedStudent)}
                        </h3>
                        <p className="mt-2 text-sm text-white/80">
                          {selectedStudent?.email || "—"}
                        </p>
                      </div>

                      <Badge tone="slate">
                        {selectedStudent?.role || "student"}
                      </Badge>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge tone={getStatusTone(selectedStudent?.accountStatus)}>
                        {selectedStudent?.accountStatus || "active"}
                      </Badge>
                      <Badge tone={selectedStudent?.isActive ? "emerald" : "rose"}>
                        {selectedStudent?.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge tone={getAssessmentTone(selectedStudent?.assessmentScore)}>
                        Score {Number(selectedStudent?.assessmentScore || 0)}%
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {renderDetailItem(
                      "Mobile",
                      selectedStudent?.mobile || "—",
                      <Phone size={14} />
                    )}
                    {renderDetailItem(
                      "College",
                      selectedStudent?.college || selectedStudent?.collegeName || "—",
                      <Building2 size={14} />
                    )}
                    {renderDetailItem(
                      "Course",
                      selectedStudent?.course || "—",
                      <GraduationCap size={14} />
                    )}
                    {renderDetailItem(
                      "Year",
                      selectedStudent?.year || "—",
                      <BookOpen size={14} />
                    )}
                    {renderDetailItem(
                      "Assessment Score",
                      `${Number(selectedStudent?.assessmentScore || 0)}%`,
                      <Target size={14} />
                    )}
                    {renderDetailItem(
                      "Scholarship",
                      `${Number(selectedStudent?.scholarshipPercentage || 0)}%`,
                      <Award size={14} />
                    )}
                    {renderDetailItem(
                      "Internship Status",
                      selectedStudent?.internshipStatus || "Not Applied",
                      <BadgeCheck size={14} />
                    )}
                    {renderDetailItem(
                      "Payment Status",
                      selectedStudent?.paymentStatus || "PENDING",
                      <IndianRupee size={14} />
                    )}
                    {renderDetailItem(
                      "Created At",
                      formatDate(selectedStudent?.createdAt),
                      <Clock3 size={14} />
                    )}
                  </div>

                  <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5">
                    <h4 className="text-lg font-black text-slate-900">
                      Quick Actions
                    </h4>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <button
                        onClick={() =>
                          handleUpdateStatus(selectedStudent._id, "active", true)
                        }
                        disabled={updatingId === selectedStudent._id}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {updatingId === selectedStudent._id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <UserCheck size={16} />
                        )}
                        Activate
                      </button>

                      <button
                        onClick={() =>
                          handleUpdateStatus(selectedStudent._id, "blocked", true)
                        }
                        disabled={updatingId === selectedStudent._id}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {updatingId === selectedStudent._id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Ban size={16} />
                        )}
                        Block
                      </button>

                      <button
                        onClick={() =>
                          handleUpdateStatus(selectedStudent._id, "suspended", false)
                        }
                        disabled={updatingId === selectedStudent._id}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {updatingId === selectedStudent._id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <ShieldAlert size={16} />
                        )}
                        Suspend
                      </button>

                      <button
                        onClick={() => handleDelete(selectedStudent._id)}
                        disabled={deletingId === selectedStudent._id}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deletingId === selectedStudent._id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm">
                    <h4 className="text-lg font-black text-slate-900">
                      Assessment Update
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Update score and recompute scholarship / internship access.
                    </p>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Assessment Score
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editScore}
                          onChange={(e) => setEditScore(e.target.value)}
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                      </div>

                      <div className="rounded-[22px] bg-slate-50 p-4">
                        <div className="flex items-center justify-between text-sm text-slate-500">
                          <span>Scholarship Preview</span>
                          <Award size={16} />
                        </div>
                        <div className="mt-2 text-2xl font-black text-slate-900">
                          {getScholarshipLabel(selectedStudent?.scholarshipPercentage)}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {Number(selectedStudent?.scholarshipPercentage || 0)}%
                        </div>
                      </div>

                      <button
                        onClick={handleUpdateAssessment}
                        disabled={saving}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {saving ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Save size={16} />
                        )}
                        Save Assessment
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5">
                    <h4 className="text-lg font-black text-slate-900">
                      Current Flags
                    </h4>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Assessment Completed</span>
                        <Badge tone={selectedStudent?.assessmentCompleted ? "emerald" : "slate"}>
                          {selectedStudent?.assessmentCompleted ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Assessment Passed</span>
                        <Badge tone={selectedStudent?.assessmentPassed ? "emerald" : "rose"}>
                          {selectedStudent?.assessmentPassed ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Internship Unlocked</span>
                        <Badge tone={selectedStudent?.internshipUnlocked ? "emerald" : "amber"}>
                          {selectedStudent?.internshipUnlocked ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Payment Completed</span>
                        <Badge tone={selectedStudent?.paymentCompleted ? "emerald" : "slate"}>
                          {selectedStudent?.paymentCompleted ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Certificate Eligible</span>
                        <Badge tone={selectedStudent?.certificateEligible ? "emerald" : "slate"}>
                          {selectedStudent?.certificateEligible ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 px-6 py-4 text-right">
                <button
                  onClick={closeModal}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <X size={16} />
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}