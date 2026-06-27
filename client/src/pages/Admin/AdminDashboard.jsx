import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import {
  Users,
  Briefcase,
  ClipboardList,
  CreditCard,
  Award,
  BarChart3,
  Bell,
  Search,
  Menu,
  X,
  Activity,
  TrendingUp,
  DollarSign,
  BookOpen,
  Settings,
  LogOut,
  Eye,
  ShieldCheck,
  Sparkles,
  Target,
  RefreshCw,
  Plus,
  ArrowRight,
  AlertCircle,
  Coins,
  CalendarDays,
  Building2,
  BadgeCheck,
  PieChart as PieChartIcon,
  CheckCircle2,
  Trash2,
  Pin,
  Send,
  LayoutDashboard,
  FileText,
  BadgeIndianRupee,
  Loader2,
  Save,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const STORAGE_KEYS = ["token", "authToken", "cybernet_token", "userRole", "student", "user", "admin"];

const COLORS = ["#2563EB", "#14B8A6", "#8B5CF6", "#F59E0B", "#22C55E", "#EF4444"];

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const text = (value, fallback = "—") => {
  if (value === null || value === undefined) return fallback;
  const v = String(value).trim();
  return v || fallback;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const safeObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} • ${d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const dayKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const shortDayLabel = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("cybernet_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    sessionStorage.getItem("cybernet_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
};

const cleanupAuth = () => {
  STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

const pickFirstArray = (...values) => {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

const flattenStudents = (payload) => {
  const raw = pickFirstArray(
    payload?.students,
    payload?.users,
    payload?.data,
    payload?.items,
    payload?.results,
    payload?.records,
    payload?.dashboard?.recentStudents,
    payload?.dashboard?.topStudents
  );

  return raw.map((item) => ({
    _id: item._id || item.id || "",
    name:
      item.fullName ||
      `${text(item.firstName, "")} ${text(item.lastName, "")}`.trim() ||
      item.name ||
      item.email ||
      "Student",
    email: item.email || "",
    course: item.course || item.internshipDomain || item.domain || "—",
    status:
      item.accountStatus ||
      item.status ||
      (item.assessmentPassed ? "active" : "pending"),
    createdAt: item.createdAt || item.created_at || item.created || null,
    assessmentScore: num(item.assessmentScore),
    scholarshipPercentage: num(item.scholarshipPercentage),
    paymentCompleted: Boolean(item.paymentCompleted),
    internshipUnlocked: Boolean(item.internshipUnlocked),
    assessmentCompleted: Boolean(item.assessmentCompleted),
    certificateIssued: Boolean(item.certificateIssued),
    certificateEligible: Boolean(item.certificateEligible),
    leaderboardPoints: num(item.leaderboardPoints),
    mobile: item.mobile || "",
    college: item.college || "",
    internshipStatus: item.internshipStatus || "Not Applied",
    isActive: item.isActive !== false,
  }));
};

const flattenPayments = (payload) => {
  const raw = pickFirstArray(
    payload?.payments,
    payload?.data,
    payload?.items,
    payload?.transactions,
    payload?.results
  );

  return raw.map((item) => ({
    _id: item._id || item.id || "",
    student:
      item.student?.fullName ||
      `${text(item.student?.firstName, "")} ${text(item.student?.lastName, "")}`.trim() ||
      item.student?.name ||
      item.studentName ||
      "Student",
    studentEmail: item.student?.email || item.studentEmail || "",
    internship:
      item.internship?.title ||
      item.internshipTitle ||
      item.internship?.internshipCode ||
      "Internship",
    amount: num(item.finalAmount, item.amount),
    originalAmount: num(item.amount),
    scholarshipDiscount: num(item.scholarshipDiscount, item.couponDiscount),
    status: item.paymentStatus || "PENDING",
    gateway: item.paymentGateway || item.gateway || "RAZORPAY",
    createdAt: item.createdAt || item.paymentDate || null,
    transactionId: item.transactionId || item.gatewayTransactionId || "",
    orderId: item.orderId || "",
  }));
};

const flattenInternships = (payload) => {
  const raw = pickFirstArray(
    payload?.internships,
    payload?.data,
    payload?.items,
    payload?.records
  );

  return raw.map((item) => ({
    _id: item._id || item.id || "",
    title: item.title || item.internshipTitle || "Internship",
    companyName: item.companyName || "CyberNet Technology Systems",
    internshipType: item.internshipType || "Remote",
    status: item.status || "ACTIVE",
    availableSeats: num(item.availableSeats, item.seats),
    seats: num(item.seats),
    totalApplications: num(item.totalApplications),
    isFeatured: Boolean(item.isFeatured),
    createdAt: item.createdAt || null,
    applicationDeadline: item.applicationDeadline || null,
    internshipFee: num(item.internshipFee),
    applications: safeArray(item.applications).map((app) => ({
      studentName:
        app.student?.fullName ||
        `${text(app.student?.firstName, "")} ${text(app.student?.lastName, "")}`.trim() ||
        app.student?.name ||
        app.studentName ||
        "Student",
      studentEmail: app.student?.email || app.studentEmail || "",
      status: app.status || "Applied",
      paymentCompleted: Boolean(app.paymentCompleted),
      assessmentScore: num(app.assessmentScore),
      scholarshipPercentage: num(app.scholarshipPercentage),
      appliedAt: app.appliedAt || item.createdAt || null,
      internshipTitle: item.title || "Internship",
    })),
  }));
};

const flattenResults = (payload) => {
  const raw = pickFirstArray(payload?.results, payload?.data, payload?.items, payload?.records);
  return raw.map((item) => ({
    _id: item._id || item.id || "",
    resultId: item.resultId || item._id || "",
    student:
      item.student?.fullName ||
      `${text(item.student?.firstName, "")} ${text(item.student?.lastName, "")}`.trim() ||
      item.student?.name ||
      item.studentEmail ||
      "Student",
    studentEmail: item.student?.email || item.studentEmail || "",
    assessment: item.assessment?.assessmentName || item.assessment?.title || item.assessmentName || "Assessment",
    percentage: num(item.percentage),
    createdAt: item.createdAt || null,
  }));
};

const flattenAssessments = (payload) => {
  const raw = pickFirstArray(payload?.assessments, payload?.data, payload?.items, payload?.records);
  return raw.map((item) => ({
    _id: item._id || item.id || "",
    name: item.assessmentName || item.title || "Assessment",
    domain: item.domain || "General",
    status: item.status || (item.isActive ? "ACTIVE" : "DRAFT"),
    createdAt: item.createdAt || null,
    duration: num(item.duration, 0),
    totalQuestions: num(item.totalQuestions, 0),
  }));
};

const buildTrendData = ({ students = [], payments = [], applications = [] }) => {
  const days = Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return d;
  });

  const map = new Map(
    days.map((d) => [
      dayKey(d),
      {
        name: shortDayLabel(d),
        Students: 0,
        Applications: 0,
        Payments: 0,
        Revenue: 0,
      },
    ])
  );

  students.forEach((s) => {
    const key = dayKey(s.createdAt);
    if (map.has(key)) map.get(key).Students += 1;
  });

  applications.forEach((a) => {
    const key = dayKey(a.appliedAt);
    if (map.has(key)) map.get(key).Applications += 1;
  });

  payments.forEach((p) => {
    const key = dayKey(p.createdAt);
    if (map.has(key)) {
      map.get(key).Payments += 1;
      if (String(p.status).toUpperCase() === "SUCCESS") {
        map.get(key).Revenue += num(p.amount);
      }
    }
  });

  return Array.from(map.values());
};

const buildStatusPie = (items = [], accessor = (x) => x.status) => {
  const counts = items.reduce((acc, item) => {
    const key = String(accessor(item) || "Unknown").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
};

function StatusPill({ value }) {
  const v = String(value || "").toUpperCase();
  let classes = "bg-slate-100 text-slate-700";

  if (
    v.includes("SUCCESS") ||
    v.includes("ACTIVE") ||
    v.includes("PAID") ||
    v.includes("PASS") ||
    v.includes("SELECTED") ||
    v.includes("ISSUED")
  ) {
    classes = "bg-emerald-100 text-emerald-700";
  } else if (v.includes("PENDING") || v.includes("APPLIED") || v.includes("READY")) {
    classes = "bg-amber-100 text-amber-700";
  } else if (v.includes("FAILED") || v.includes("BLOCKED") || v.includes("REJECT")) {
    classes = "bg-rose-100 text-rose-700";
  } else if (v.includes("PROCESSING") || v.includes("IN PROGRESS")) {
    classes = "bg-blue-100 text-blue-700";
  }

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${classes}`}>{value}</span>;
}

function StatCard({ title, value, helper, icon: Icon, tone = "blue" }) {
  const toneMap = {
    blue: "from-blue-600 to-cyan-500",
    emerald: "from-emerald-600 to-emerald-400",
    violet: "from-violet-600 to-fuchsia-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-600 to-pink-500",
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-4xl font-black text-slate-900">{value}</h3>
          {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
        </div>
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r ${
            toneMap[tone] || toneMap.blue
          } text-white shadow-lg`}
        >
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-3xl font-black text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-2 text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-slate-100 lg:p-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Icon size={20} />
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="fixed right-4 top-4 z-[100] space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`w-[320px] rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : toast.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{toast.title}</p>
              <p className="mt-1 text-sm opacity-90">{toast.message}</p>
            </div>
            <button onClick={() => onDismiss(toast.id)} className="rounded-lg p-1 hover:bg-black/5">
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, description, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900">{title}</h3>
            <p className="mt-2 text-slate-500">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-100 p-3 text-slate-600 hover:bg-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}

function InlineActionButton({ children, onClick, tone = "default", disabled = false, icon: Icon }) {
  const toneMap = {
    default: "bg-slate-950 text-white hover:bg-slate-800",
    blue: "bg-blue-600 text-white hover:bg-blue-700",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-700",
    rose: "bg-rose-600 text-white hover:bg-rose-700",
    light: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        toneMap[tone] || toneMap.default
      }`}
    >
      {Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [studentActionLoading, setStudentActionLoading] = useState(null);
  const [submittingStatusId, setSubmittingStatusId] = useState(null);

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    liveInternships: 0,
    assessments: 0,
    certificates: 0,
    paymentsToday: 0,
    revenueToday: 0,
    scholarshipEligible: 0,
    assessmentPassRate: 0,
    placementRate: 0,
    totalRevenue: 0,
    totalResults: 0,
    totalPayments: 0,
    totalApplications: 0,
  });

  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [internships, setInternships] = useState([]);
  const [results, setResults] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [health, setHealth] = useState({
    api: "Online",
    database: "Connected",
    payments: "Active",
    certificates: "Running",
    assessment: "Ready",
  });

  const [form, setForm] = useState({
    title: "",
    domain: "",
    description: "",
    companyName: "CyberNet Technology Systems",
    internshipType: "Remote",
    internshipFee: 0,
    seats: 50,
    applicationDeadline: "",
    assessmentName: "",
    duration: 30,
    totalQuestions: 10,
    passMarks: 40,
    questionType: "MCQ",
    difficulty: "Easy",
    question: "",
    options: "Option 1, Option 2, Option 3, Option 4",
    correctAnswer: "",
    studentId: "",
    internshipTitle: "",
    internshipDomain: "",
    internshipDuration: "1 Month",
    certificateType: "Internship",
    grade: "A",
    score: 100,
    xpEarned: 100,
    status: "active",
    isActive: true,
  });

  const notify = (title, message, type = "info") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  };

  const sidebarItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "students", label: "Students", icon: Users },
    { id: "internships", label: "Internships", icon: Briefcase },
    { id: "applications", label: "Applications", icon: ClipboardList },
    { id: "assessments", label: "Assessments", icon: Target },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "certificates", label: "Certificates", icon: Award },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const quickActions = [
    { title: "Create Assessment", icon: ClipboardList, action: () => setModalType("assessment") },
    { title: "Add Internship", icon: Plus, action: () => setModalType("internship") },
    { title: "Issue Certificate", icon: Award, action: () => setModalType("certificate") },
    { title: "Manage Students", icon: Users, action: () => document.getElementById("students")?.scrollIntoView({ behavior: "smooth" }) },
    { title: "Review Payments", icon: CreditCard, action: () => document.getElementById("payments")?.scrollIntoView({ behavior: "smooth" }) },
    { title: "Open Activity", icon: Activity, action: () => document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" }) },
  ];

  const loadDashboard = async () => {
    setRefreshing(true);
    setError("");

    try {
      const headers = getAuthHeaders();

      const [
        dashboardRes,
        analyticsRes,
        activityRes,
        studentsRes,
        internshipsRes,
        paymentsRes,
        resultsRes,
        assessmentsRes,
        certAnalyticsRes,
        healthRes,
      ] = await Promise.allSettled([
        api.get("/admin/dashboard", { headers }),
        api.get("/admin/analytics", { headers }),
        api.get("/admin/activity", { headers }),
        api.get("/admin/students?limit=100", { headers }),
        api.get("/admin/internships?limit=100", { headers }),
        api.get("/admin/payments?limit=100", { headers }),
        api.get("/admin/results?limit=100", { headers }),
        api.get("/admin/assessments?limit=100", { headers }),
        api.get("/certificates/analytics", { headers }),
        api.get("/health", { headers }),
      ]);

      const getData = (settled) => (settled.status === "fulfilled" ? settled.value?.data : null);

      const dashboard = safeObject(getData(dashboardRes));
      const analytics = safeObject(getData(analyticsRes));
      const activityPayload = safeObject(getData(activityRes));
      const studentsPayload = safeObject(getData(studentsRes));
      const internshipsPayload = safeObject(getData(internshipsRes));
      const paymentsPayload = safeObject(getData(paymentsRes));
      const resultsPayload = safeObject(getData(resultsRes));
      const assessmentsPayload = safeObject(getData(assessmentsRes));
      const certificatesAnalytics = safeObject(getData(certAnalyticsRes)?.analytics || getData(certAnalyticsRes) || {});
      const healthPayload = safeObject(getData(healthRes));

      const studentList = flattenStudents(studentsPayload);
      const internshipList = flattenInternships(internshipsPayload);
      const paymentList = flattenPayments(paymentsPayload);
      const resultList = flattenResults(resultsPayload);
      const assessmentList = flattenAssessments(assessmentsPayload);

      const allApplications = internshipList.flatMap((internship) =>
        safeArray(internship.applications).map((app) => ({
          ...app,
          internshipTitle: internship.title,
        }))
      );

      const successfulPayments = paymentList.filter((payment) => String(payment.status).toUpperCase() === "SUCCESS");
      const todaysPayments = successfulPayments.filter((p) => {
        const d = new Date(p.createdAt);
        if (Number.isNaN(d.getTime())) return false;
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      });

      const totalStudents = num(dashboard?.dashboard?.totals?.students, studentList.length);
      const activeStudents = num(dashboard?.dashboard?.totals?.activeStudents, studentList.filter((s) => s.isActive && String(s.status).toLowerCase() === "active").length);
      const liveInternships = num(dashboard?.dashboard?.totals?.activeInternships, internshipList.filter((i) => String(i.status).toUpperCase() === "ACTIVE").length);
      const assessmentsCount = num(dashboard?.dashboard?.totals?.assessments, assessmentList.length);
      const certificatesCount = num(certificatesAnalytics.totalCertificates, studentList.filter((s) => s.certificateIssued).length);
      const totalRevenue = num(dashboard?.dashboard?.revenue?.total, successfulPayments.reduce((sum, p) => sum + num(p.amount), 0));
      const revenueToday = num(todaysPayments.reduce((sum, p) => sum + num(p.amount), 0));
      const totalResults = num(dashboard?.dashboard?.totals?.results, resultList.length);
      const totalPayments = num(dashboard?.dashboard?.totals?.payments, paymentList.length);
      const totalApplications = allApplications.length;
      const scholarshipEligible = studentList.filter((s) => num(s.scholarshipPercentage) > 0).length;
      const placementRate = studentList.length
        ? Math.round((studentList.filter((s) => String(s.status).toLowerCase() === "placed").length / studentList.length) * 100)
        : 0;
      const assessmentPassRate = num(
        dashboard?.dashboard?.performance?.passRate,
        assessmentsCount ? Math.round((studentList.filter((s) => s.assessmentCompleted && s.assessmentScore >= 40).length / studentList.length) * 100) : 0
      );

      setStats({
        totalStudents,
        activeStudents,
        liveInternships,
        assessments: assessmentsCount,
        certificates: certificatesCount,
        paymentsToday: todaysPayments.length,
        revenueToday,
        scholarshipEligible,
        assessmentPassRate,
        placementRate,
        totalRevenue,
        totalResults,
        totalPayments,
        totalApplications,
      });

      setStudents(studentList);
      setInternships(internshipList);
      setPayments(paymentList);
      setResults(resultList);
      setAssessments(assessmentList);

      setActivityFeed(
        buildActivityFeed({
          students: studentList,
          payments: paymentList,
          internships: internshipList,
          applications: allApplications,
          results: resultList,
        }, activityPayload)
      );

      setHealth({
        api: healthPayload?.success ? "Online" : "Degraded",
        database: healthPayload?.success ? "Connected" : "Unknown",
        payments: totalPayments > 0 ? "Active" : "Idle",
        certificates: certificatesCount > 0 ? "Running" : "Pending",
        assessment: assessmentsCount > 0 ? "Ready" : "Pending",
      });

      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error(err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to load dashboard.";
      setError(message);
      notify("Dashboard Error", message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const buildActivityFeed = ({ students = [], payments = [], internships = [], applications = [], results = [] }, activityPayload) => {
    const feed = [];

    const apiFeed = safeArray(activityPayload?.activity);
    if (apiFeed.length > 0) {
      apiFeed.forEach((item) => {
        feed.push({
          title: item.title || "Activity",
          detail: item.description || "",
          time: item.createdAt || new Date().toISOString(),
          icon:
            item.type === "student"
              ? Users
              : item.type === "payment"
              ? CreditCard
              : item.type === "internship"
              ? Briefcase
              : item.type === "assessment"
              ? ClipboardList
              : Activity,
          tone:
            item.type === "student"
              ? "blue"
              : item.type === "payment"
              ? "emerald"
              : item.type === "internship"
              ? "violet"
              : item.type === "assessment"
              ? "amber"
              : "blue",
        });
      });
    } else {
      students.slice(0, 4).forEach((student) => {
        feed.push({
          title: `New student registered: ${student.name}`,
          detail: student.course || "Student account",
          time: student.createdAt || new Date().toISOString(),
          icon: Users,
          tone: "blue",
        });
      });

      applications.slice(0, 4).forEach((application) => {
        feed.push({
          title: `Application received: ${application.studentName}`,
          detail: application.internshipTitle || "Internship application",
          time: application.appliedAt || new Date().toISOString(),
          icon: ClipboardList,
          tone: "amber",
        });
      });

      payments
        .filter((payment) => String(payment.status).toUpperCase() === "SUCCESS")
        .slice(0, 4)
        .forEach((payment) => {
          feed.push({
            title: `Payment received from ${payment.student}`,
            detail: `${payment.internship} • ${money(payment.amount)}`,
            time: payment.createdAt || new Date().toISOString(),
            icon: CreditCard,
            tone: "emerald",
          });
        });

      internships.slice(0, 4).forEach((internship) => {
        feed.push({
          title: `Internship active: ${internship.title}`,
          detail: internship.companyName,
          time: internship.createdAt || new Date().toISOString(),
          icon: Briefcase,
          tone: "violet",
        });
      });

      results.slice(0, 4).forEach((result) => {
        feed.push({
          title: `Assessment result: ${result.student}`,
          detail: `${result.assessment} • ${result.percentage}%`,
          time: result.createdAt || new Date().toISOString(),
          icon: ClipboardList,
          tone: "amber",
        });
      });
    }

    return feed
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      [
        student.name,
        student.email,
        student.course,
        student.status,
        student.assessmentScore,
        student.scholarshipPercentage,
        student.leaderboardPoints,
        student.college,
        student.mobile,
        student.internshipStatus,
        student.certificateIssued,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [students, search]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((payment) =>
      [payment.student, payment.internship, payment.status, payment.gateway, payment.amount, payment.transactionId, payment.orderId]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [payments, search]);

  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return internships.flatMap((internship) =>
      safeArray(internship.applications).map((app) => ({
        ...app,
        internshipTitle: internship.title,
      }))
    );
    return internships
      .flatMap((internship) =>
        safeArray(internship.applications).map((app) => ({
          ...app,
          internshipTitle: internship.title,
        }))
      )
      .filter((app) =>
        [app.studentName, app.studentEmail, app.internshipTitle, app.status].join(" ").toLowerCase().includes(q)
      );
  }, [internships, search]);

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activityFeed;
    return activityFeed.filter((item) => [item.title, item.detail].join(" ").toLowerCase().includes(q));
  }, [activityFeed, search]);

  const filteredAssessments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assessments;
    return assessments.filter((assessment) =>
      [assessment.name, assessment.domain, assessment.status, assessment.totalQuestions]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [assessments, search]);

  const certificatesList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students
      .filter((student) => student.certificateIssued || student.certificateEligible)
      .map((student) => ({
        certificateId: student.certificateIssued ? `CERT-${String(student._id || student.email || "").slice(-8).toUpperCase()}` : "PENDING",
        student: student.name,
        title: student.course || student.internshipStatus || "Certificate",
        status: student.certificateIssued ? "Issued" : "Eligible",
        createdAt: student.createdAt,
      }));

    if (!q) return list;
    return list.filter((item) =>
      [item.certificateId, item.student, item.title, item.status].join(" ").toLowerCase().includes(q)
    );
  }, [students, search]);

  const applicationsList = useMemo(() => {
    return internships.flatMap((internship) =>
      safeArray(internship.applications).map((app) => ({
        ...app,
        internshipTitle: internship.title,
      }))
    );
  }, [internships]);

  const trendData = useMemo(
    () =>
      buildTrendData({
        students,
        payments,
        applications: applicationsList,
      }),
    [students, payments, applicationsList]
  );

  const paymentStatusData = useMemo(() => buildStatusPie(payments), [payments]);
  const applicationStatusData = useMemo(() => buildStatusPie(applicationsList), [applicationsList]);
  const internshipApplicationsData = useMemo(
    () =>
      internships.map((internship) => ({
        name: internship.title.length > 18 ? `${internship.title.slice(0, 18)}...` : internship.title,
        value: internship.totalApplications,
      })),
    [internships]
  );

  const handleLogout = () => {
    cleanupAuth();
    navigate("/login", { replace: true });
  };

  const handleViewRecord = (type, data) => {
    setSelectedRecord({ type, data });
  };

  const handleDeleteStudent = async (student) => {
    if (!student?._id) return;
    if (!window.confirm(`Delete ${student.name}?`)) return;

    try {
      setStudentActionLoading(student._id);
      await api.delete(`/admin/students/${student._id}`, { headers: getAuthHeaders() });
      notify("Student Deleted", `${student.name} removed successfully.`, "success");
      loadDashboard();
    } catch (err) {
      notify("Delete Failed", err?.response?.data?.message || err?.message || "Unable to delete student.", "error");
    } finally {
      setStudentActionLoading(null);
    }
  };

  const handleStudentStatus = async (student, nextStatus) => {
    if (!student?._id) return;

    try {
      setSubmittingStatusId(student._id);
      await api.patch(
        `/admin/students/${student._id}/status`,
        {
          accountStatus: nextStatus,
          isActive: nextStatus === "active",
          reason: nextStatus === "blocked" ? "Blocked by admin" : "Activated by admin",
        },
        { headers: getAuthHeaders() }
      );
      notify("Student Updated", `${student.name} is now ${nextStatus}.`, "success");
      loadDashboard();
    } catch (err) {
      notify("Update Failed", err?.response?.data?.message || err?.message || "Unable to update student.", "error");
    } finally {
      setSubmittingStatusId(null);
    }
  };

  const handleToggleInternshipStatus = async (internship) => {
    if (!internship?._id) return;

    try {
      await api.patch(
        `/admin/internships/${internship._id}`,
        {
          status: internship.status === "ACTIVE" ? "CLOSED" : "ACTIVE",
          isActive: internship.status !== "ACTIVE",
        },
        { headers: getAuthHeaders() }
      );
      notify("Internship Updated", `${internship.title} status changed.`, "success");
      loadDashboard();
    } catch (err) {
      notify("Update Failed", err?.response?.data?.message || err?.message || "Unable to update internship.", "error");
    }
  };

  const handleDeleteInternship = async (internship) => {
    if (!internship?._id) return;
    if (!window.confirm(`Delete internship "${internship.title}"?`)) return;

    try {
      await api.delete(`/admin/internships/${internship._id}`, { headers: getAuthHeaders() });
      notify("Internship Deleted", `${internship.title} removed successfully.`, "success");
      loadDashboard();
    } catch (err) {
      notify("Delete Failed", err?.response?.data?.message || err?.message || "Unable to delete internship.", "error");
    }
  };

  const closeModal = () => {
    setModalType(null);
    setModalLoading(false);
  };

  const handleCreateInternship = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      await api.post(
        "/admin/internships",
        {
          title: form.title.trim(),
          domain: form.domain.trim(),
          companyName: form.companyName.trim(),
          internshipType: form.internshipType,
          internshipFee: num(form.internshipFee),
          seats: num(form.seats),
          applicationDeadline: form.applicationDeadline || null,
          description: form.description.trim() || `${form.title} internship`,
          shortDescription: form.description.trim().slice(0, 140),
          status: "ACTIVE",
          isActive: true,
          isFeatured: false,
        },
        { headers: getAuthHeaders() }
      );
      notify("Internship Created", "New internship saved successfully.", "success");
      closeModal();
      loadDashboard();
    } catch (err) {
      notify("Create Failed", err?.response?.data?.message || err?.message || "Unable to save internship.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      await api.post(
        "/admin/assessments",
        {
          assessmentName: form.assessmentName.trim(),
          title: form.assessmentName.trim(),
          domain: form.domain.trim() || "General",
          description: form.description.trim(),
          duration: num(form.duration, 30),
          totalQuestions: num(form.totalQuestions, 10),
          passMarks: num(form.passMarks, 40),
          status: "ACTIVE",
          isActive: true,
        },
        { headers: getAuthHeaders() }
      );
      notify("Assessment Created", "Assessment saved successfully.", "success");
      closeModal();
      loadDashboard();
    } catch (err) {
      notify("Create Failed", err?.response?.data?.message || err?.message || "Unable to save assessment.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const handleIssueCertificate = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      await api.post(
        "/certificates/issue",
        {
          studentId: form.studentId.trim(),
          internshipTitle: form.internshipTitle.trim() || "Internship Certificate",
          internshipDomain: form.internshipDomain.trim() || "General",
          internshipDuration: form.internshipDuration.trim() || "1 Month",
          certificateType: form.certificateType,
          grade: form.grade,
          score: num(form.score, 100),
          xpEarned: num(form.xpEarned, 100),
        },
        { headers: getAuthHeaders() }
      );
      notify("Certificate Issued", "Certificate generated successfully.", "success");
      closeModal();
      loadDashboard();
    } catch (err) {
      notify("Certificate Error", err?.response?.data?.message || err?.message || "Unable to issue certificate.", "error");
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <h2 className="mt-6 text-2xl font-black">Loading Admin Dashboard</h2>
          <p className="mt-2 text-slate-300">Fetching live portal data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <aside
        className={`sticky top-0 h-screen shrink-0 overflow-hidden border-r border-slate-800 bg-slate-950 text-white transition-all duration-300 ${
          sidebarOpen ? "w-[310px]" : "w-[88px]"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-xl font-black">
                  CN
                </div>
                {sidebarOpen && (
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-black">CyberNet</h1>
                    <p className="truncate text-sm text-slate-400">Enterprise Admin Portal</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="rounded-xl bg-slate-900 p-2 hover:bg-slate-800"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="flex w-full items-center gap-4 rounded-2xl bg-slate-900 px-4 py-4 text-left transition-all hover:bg-slate-800"
                >
                  <Icon size={20} className="shrink-0" />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </button>
              );
            })}
          </div>

          {sidebarOpen && (
            <div className="p-4">
              <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} />
                  <span className="font-semibold">System Healthy</span>
                </div>
                <p className="mt-3 text-sm text-blue-100">
                  API: {health.api} • DB: {health.database}
                </p>
              </div>
            </div>
          )}

          <div className="mt-auto border-t border-slate-800 bg-slate-950 p-4">
            <button
              onClick={handleLogout}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 py-4 font-semibold hover:bg-red-700 ${
                sidebarOpen ? "" : "px-0"
              }`}
            >
              <LogOut size={18} />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-hidden">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white px-6 py-5 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div id="overview">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                <Sparkles size={16} />
                Enterprise Control Center
              </div>
              <h2 className="mt-4 text-3xl font-black text-slate-900 sm:text-5xl">
                Welcome Back Admin 👋
              </h2>
              <p className="mt-2 text-slate-500">
                CyberNet Technology Systems — Internship, Assessment, Payment and Certificate Management
              </p>
              {lastUpdated && (
                <p className="mt-2 text-xs text-slate-400">Last synced: {formatDateTime(lastUpdated)}</p>
              )}
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="relative">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students, internships, payments, activity..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none focus:border-blue-500 focus:bg-white xl:w-[420px]"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadDashboard}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
                <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                  <Bell size={20} />
                </button>
                <button className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 font-black text-white">
                  A
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-8">
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5" size={20} />
                <div>
                  <p className="font-bold">Dashboard sync issue</p>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <section className="rounded-[32px] bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-2xl lg:p-10">
            <div className="grid gap-8 xl:grid-cols-2">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
                  <Sparkles size={16} />
                  Production Admin Dashboard
                </div>

                <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl xl:text-6xl">
                  CyberNet Admin Portal
                </h1>

                <p className="mt-5 max-w-3xl text-base text-blue-100 sm:text-lg">
                  Manage students, internships, assessments, payments, scholarships and certificates from one control panel.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <InlineActionButton tone="light" icon={ClipboardList} onClick={() => setModalType("assessment")}>
                    Create Assessment
                  </InlineActionButton>
                  <InlineActionButton tone="light" icon={Plus} onClick={() => setModalType("internship")}>
                    Add Internship
                  </InlineActionButton>
                  <InlineActionButton tone="light" icon={Award} onClick={() => setModalType("certificate")}>
                    Issue Certificate
                  </InlineActionButton>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
                  <p className="text-sm text-blue-100">Active Students</p>
                  <h2 className="mt-3 text-5xl font-black">{stats.activeStudents}</h2>
                  <p className="mt-2 text-sm text-blue-100">of {stats.totalStudents} total</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
                  <p className="text-sm text-blue-100">Revenue Today</p>
                  <h2 className="mt-3 text-4xl font-black">{money(stats.revenueToday)}</h2>
                  <p className="mt-2 text-sm text-blue-100">Total revenue: {money(stats.totalRevenue)}</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
                  <p className="text-sm text-blue-100">Assessments</p>
                  <h2 className="mt-3 text-5xl font-black">{stats.assessments}</h2>
                  <p className="mt-2 text-sm text-blue-100">Pass rate: {stats.assessmentPassRate}%</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
                  <p className="text-sm text-blue-100">Certificates</p>
                  <h2 className="mt-3 text-5xl font-black">{stats.certificates}</h2>
                  <p className="mt-2 text-sm text-blue-100">Eligible students: {stats.scholarshipEligible}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-4 md:grid-cols-2">
            <StatCard title="Total Students" value={stats.totalStudents} helper="Registered learners in the portal" icon={Users} tone="blue" />
            <StatCard title="Live Internships" value={stats.liveInternships} helper="Currently active internship programs" icon={Briefcase} tone="emerald" />
            <StatCard title="Total Payments" value={stats.totalPayments} helper={money(stats.totalRevenue)} icon={DollarSign} tone="violet" />
            <StatCard title="Results" value={stats.totalResults} helper="Assessment outputs recorded" icon={BarChart3} tone="amber" />
          </section>

          <section className="mt-10">
            <SectionTitle title="Quick Actions" subtitle="Common admin workflows ready for one-click access." />
            <div className="grid gap-5 xl:grid-cols-3 md:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.title}
                    onClick={action.action}
                    className="rounded-3xl bg-white p-6 text-left shadow-lg ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <Icon size={26} className="text-blue-600" />
                    <h3 className="mt-4 text-lg font-bold text-slate-900">{action.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">Open workflow</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-10 grid gap-6 xl:grid-cols-3">
            <ChartCard title="Live Activity Trend" subtitle="Student registrations, applications and payments across the last 7 days." icon={TrendingUp}>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Students" stroke="#2563EB" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Applications" stroke="#F59E0B" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Payments" stroke="#14B8A6" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Payment Status" subtitle="Distribution of recent payment states." icon={CreditCard}>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusData.length ? paymentStatusData : [{ name: "NO DATA", value: 1 }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      innerRadius={65}
                      paddingAngle={4}
                    >
                      {(paymentStatusData.length ? paymentStatusData : [{ name: "NO DATA", value: 1 }]).map((entry, index) => (
                        <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Internship Applications" subtitle="Applications per live internship program." icon={Briefcase}>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={internshipApplicationsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563EB" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </section>

          <section id="students" className="mt-10 rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-slate-100 lg:p-8">
            <SectionTitle
              title="Recent Students"
              subtitle="Latest registrations and account states."
            />

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-slate-500">
                    <th className="py-4">Student</th>
                    <th className="py-4">Course</th>
                    <th className="py-4">Status</th>
                    <th className="py-4">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        No students found for the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.slice(0, 20).map((student) => (
                      <tr key={student._id || student.email} className="border-b last:border-0">
                        <td className="py-5">
                          <div className="font-semibold text-slate-900">{student.name}</div>
                          <div className="text-sm text-slate-500">{student.email}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {student.assessmentCompleted && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                                <ClipboardList size={12} />
                                Assessment
                              </span>
                            )}
                            {student.internshipUnlocked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                                <BadgeCheck size={12} />
                                Unlocked
                              </span>
                            )}
                            {student.paymentCompleted && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                                <CreditCard size={12} />
                                Paid
                              </span>
                            )}
                            {student.certificateIssued && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">
                                <Award size={12} />
                                Certificate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-5 text-slate-700">{student.course}</td>
                        <td className="py-5">
                          <StatusPill value={student.status} />
                        </td>
                        <td className="py-5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewRecord("student", student)}
                              className="inline-flex items-center rounded-xl bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleStudentStatus(student, "active")}
                              disabled={submittingStatusId === student._id}
                              className="inline-flex items-center rounded-xl bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                            >
                              {submittingStatusId === student._id ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                            </button>
                            <button
                              onClick={() => handleStudentStatus(student, "blocked")}
                              disabled={submittingStatusId === student._id}
                              className="inline-flex items-center rounded-xl bg-amber-50 p-2 text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                            >
                              <Pin size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student)}
                              disabled={studentActionLoading === student._id}
                              className="inline-flex items-center rounded-xl bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="applications" className="mt-10 grid gap-6 xl:grid-cols-2">
            <div className="rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-slate-100 lg:p-8">
              <SectionTitle title="Recent Applications" subtitle="Live student applications against internships." />
              <div className="space-y-4">
                {filteredApplications.length === 0 ? (
                  <EmptyState title="No applications found" description="Applications will appear here once students apply." />
                ) : (
                  filteredApplications.slice(0, 10).map((application, index) => (
                    <div key={`${application.studentEmail || application.studentName}-${index}`} className="rounded-2xl bg-slate-50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{application.studentName}</p>
                          <p className="mt-1 text-sm text-slate-500">{application.internshipTitle}</p>
                        </div>
                        <StatusPill value={application.status} />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1">
                          <CalendarDays size={12} />
                          {formatDate(application.appliedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1">
                          <ClipboardList size={12} />
                          Score {num(application.assessmentScore)}%
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
                            application.paymentCompleted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          <CreditCard size={12} />
                          {application.paymentCompleted ? "Payment Done" : "Payment Pending"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-slate-100 lg:p-8">
              <SectionTitle title="Assessment Results" subtitle="Score records and assessment performance." />
              <div className="space-y-4">
                {results.length === 0 ? (
                  <EmptyState title="No results yet" description="Assessment results will show up here." />
                ) : (
                  results.slice(0, 10).map((result, index) => (
                    <div key={`${result.resultId || result._id || index}`} className="rounded-2xl bg-slate-50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{result.student}</p>
                          <p className="mt-1 text-sm text-slate-500">{result.assessment}</p>
                        </div>
                        <StatusPill value={`${num(result.percentage)}%`} />
                      </div>
                      <div className="mt-3 text-sm text-slate-600">
                        Created: {formatDate(result.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section id="payments" className="mt-10 grid gap-6 xl:grid-cols-2">
            <div className="rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-slate-100 lg:p-8">
              <SectionTitle title="Recent Payments" subtitle="Latest payment transactions and statuses." />
              <div className="space-y-4">
                {filteredPayments.length === 0 ? (
                  <EmptyState title="No payment transactions available" description="Payments will show here when students pay." />
                ) : (
                  filteredPayments.slice(0, 10).map((payment) => (
                    <div key={payment._id || `${payment.student}-${payment.createdAt}`} className="rounded-2xl bg-slate-50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{payment.student}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {payment.internship} • {payment.gateway}
                          </p>
                        </div>
                        <StatusPill value={payment.status} />
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <span>{formatDate(payment.createdAt)}</span>
                        <span className="font-bold text-slate-900">{money(payment.amount)}</span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => handleViewRecord("payment", payment)}
                          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          onClick={() =>
                            notify("Payment Verified", "Payment has been manually verified in the admin panel.", "success")
                          }
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <CheckCircle2 size={14} />
                          Verify
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div id="activity" className="rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-slate-100 lg:p-8">
              <SectionTitle
                title="Live Activity Feed"
                subtitle="Recent actions across students, assessments, payments and certificates."
                action={
                  <button
                    onClick={loadDashboard}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                    Refresh
                  </button>
                }
              />

              <div className="space-y-4">
                {filteredActivities.length === 0 ? (
                  <EmptyState title="No activity yet" description="This feed will populate as portal events occur." />
                ) : (
                  filteredActivities.map((item, index) => {
                    const Icon = item.icon || Activity;
                    const toneStyles = {
                      blue: "bg-blue-100 text-blue-600",
                      emerald: "bg-emerald-100 text-emerald-600",
                      violet: "bg-violet-100 text-violet-600",
                      orange: "bg-orange-100 text-orange-600",
                      green: "bg-green-100 text-green-600",
                      amber: "bg-amber-100 text-amber-600",
                    };

                    return (
                      <div
                        key={`${item.title}-${index}`}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-5 transition hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneStyles[item.tone] || toneStyles.blue}`}>
                            <Icon size={18} />
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">{item.title}</p>
                            <p className="text-sm text-slate-500">{item.detail}</p>
                          </div>
                        </div>

                        <div className="text-right text-sm text-slate-500">
                          {formatDate(item.time)}
                          <div className="mt-1">
                            {new Date(item.time).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section id="assessments" className="mt-10 grid gap-6 lg:grid-cols-3">
            <ChartCard title="Assessment Analytics" subtitle="Pass rate and completion snapshot from current portal data." icon={ClipboardList}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total Assessments</span>
                  <span className="font-black text-slate-900">{stats.assessments}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.max(5, Math.min(stats.assessmentPassRate, 100))}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Pass Rate</span>
                  <span className="font-black text-emerald-600">{stats.assessmentPassRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Eligible Students</span>
                  <span className="font-black text-slate-900">{stats.scholarshipEligible}</span>
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Internship Analytics" subtitle="Live programs and application volume." icon={Briefcase}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Live Programs</span>
                  <span className="font-black text-slate-900">{stats.liveInternships}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${Math.min(stats.liveInternships * 5, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Placement Rate</span>
                  <span className="font-black text-violet-600">{stats.placementRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total Applications</span>
                  <span className="font-black text-slate-900">{stats.totalApplications}</span>
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Revenue Analytics" subtitle="Payments and revenue snapshot." icon={BadgeIndianRupee}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Today</span>
                  <span className="font-black text-slate-900">{money(stats.revenueToday)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total</span>
                  <span className="font-black text-slate-900">{money(stats.totalRevenue)}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-orange-500" style={{ width: `${Math.min(num(stats.revenueToday) / 1000, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Successful Payments</span>
                  <span className="font-black text-emerald-600">
                    {payments.filter((p) => String(p.status).toUpperCase() === "SUCCESS").length}
                  </span>
                </div>
              </div>
            </ChartCard>
          </section>

          <section className="mt-10 grid gap-6 xl:grid-cols-3">
            <ChartCard title="Analytics Timeline" subtitle="Daily trend based on the latest live records." icon={TrendingUp}>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="Students" stroke="#2563EB" fill="#DBEAFE" strokeWidth={3} />
                    <Area type="monotone" dataKey="Applications" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Payment Distribution" subtitle="Recent payment status breakdown." icon={PieChartIcon}>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusData.length ? paymentStatusData : [{ name: "NO DATA", value: 1 }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      innerRadius={65}
                      paddingAngle={4}
                    >
                      {(paymentStatusData.length ? paymentStatusData : [{ name: "NO DATA", value: 1 }]).map((entry, index) => (
                        <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Application Status" subtitle="Current application pipeline across live internships." icon={ClipboardList}>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={applicationStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </section>

          <section id="internships" className="mt-10 rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-slate-100 lg:p-8">
            <SectionTitle
              title="Live Internships"
              subtitle="Admin-created internship programs currently visible to students."
              action={
                <InlineActionButton tone="default" icon={Plus} onClick={() => setModalType("internship")}>
                  Add Internship
                </InlineActionButton>
              }
            />

            <div className="grid gap-5 xl:grid-cols-3 md:grid-cols-2">
              {internships.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-slate-500 xl:col-span-3">
                  No internships found yet.
                </div>
              ) : (
                internships.slice(0, 12).map((internship) => (
                  <div
                    key={internship._id || internship.title}
                    className="rounded-3xl border border-slate-100 p-5 transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                          <Building2 size={14} />
                          {text(internship.companyName, "CyberNet")}
                        </div>
                        <h4 className="mt-4 text-xl font-black text-slate-900">{text(internship.title, "Internship")}</h4>
                        <p className="mt-2 text-sm text-slate-500">{text(internship.internshipType, "Remote")}</p>
                      </div>

                      <StatusPill value={internship.status} />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                        <CalendarDays size={14} />
                        Seats: {internship.availableSeats}/{internship.seats || internship.availableSeats}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                        <Coins size={14} />
                        Apps: {internship.totalApplications}
                      </span>
                      {internship.isFeatured && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                          <Sparkles size={14} />
                          Featured
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleViewRecord("internship", internship)}
                        className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <Eye size={14} />
                        View
                      </button>
                      <button
                        onClick={() => handleToggleInternshipStatus(internship)}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Pin size={14} />
                        Toggle
                      </button>
                      <button
                        onClick={() => handleDeleteInternship(internship)}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section id="certificates" className="mt-10 rounded-[32px] bg-white p-6 shadow-lg ring-1 ring-slate-100 lg:p-8">
            <SectionTitle
              title="Certificates"
              subtitle="Certificate activity and issued records from eligible students."
              action={
                <InlineActionButton tone="blue" icon={Send} onClick={() => setModalType("certificate")}>
                  Generate
                </InlineActionButton>
              }
            />

            <div className="grid gap-5 xl:grid-cols-4 md:grid-cols-2">
              {certificatesList.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-slate-500 xl:col-span-4">
                  No certificate records available yet.
                </div>
              ) : (
                certificatesList.slice(0, 8).map((item) => (
                  <div key={item.certificateId || item.student} className="rounded-3xl border border-slate-100 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Award size={20} />
                      </div>
                      <StatusPill value={item.status} />
                    </div>

                    <h4 className="mt-4 text-lg font-black text-slate-900">{item.title}</h4>
                    <p className="mt-2 text-sm text-slate-500">{item.student}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {item.certificateId ? `ID: ${item.certificateId}` : "Certificate record"}
                    </p>

                    <button
                      onClick={() => handleViewRecord("certificate", item)}
                      className="mt-4 inline-flex items-center gap-1 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="mt-10 rounded-[32px] bg-slate-950 p-8 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-2xl font-black">CyberNet Technology Systems</h3>
                <p className="mt-2 text-slate-400">Enterprise Internship & Assessment Management Platform</p>
              </div>
              <div className="text-slate-400">© 2026 CyberNet. All Rights Reserved.</div>
            </div>
          </section>
        </main>
      </div>

      {selectedRecord && (
        <Modal
          title={
            selectedRecord.type === "student"
              ? "Student Details"
              : selectedRecord.type === "payment"
              ? "Payment Details"
              : selectedRecord.type === "internship"
              ? "Internship Details"
              : "Certificate Details"
          }
          description="Live admin record preview"
          onClose={() => setSelectedRecord(null)}
        >
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Object.entries(selectedRecord.data || {}).map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{key}</p>
                <p className="mt-2 break-words text-sm font-semibold text-slate-900">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </p>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modalType && (
        <Modal
          title={
            modalType === "internship"
              ? "Create Internship"
              : modalType === "assessment"
              ? "Create Assessment"
              : "Generate Certificate"
          }
          description={
            modalType === "internship"
              ? "Create a live internship visible to students."
              : modalType === "assessment"
              ? "Create a new assessment / question set."
              : "Generate certificate for a selected student."
          }
          onClose={closeModal}
        >
          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={modalType === "internship" ? handleCreateInternship : modalType === "assessment" ? handleCreateAssessment : handleIssueCertificate}
          >
            {modalType === "internship" && (
              <>
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Domain"
                  value={form.domain}
                  onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 md:col-span-2"
                  placeholder="Company Name"
                  value={form.companyName}
                  onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                />
                <textarea
                  rows={4}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 md:col-span-2"
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  value={form.internshipType}
                  onChange={(e) => setForm((p) => ({ ...p, internshipType: e.target.value }))}
                >
                  <option>Remote</option>
                  <option>Hybrid</option>
                  <option>Onsite</option>
                </select>
                <input
                  type="number"
                  min="0"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Fee"
                  value={form.internshipFee}
                  onChange={(e) => setForm((p) => ({ ...p, internshipFee: e.target.value }))}
                />
                <input
                  type="number"
                  min="1"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Seats"
                  value={form.seats}
                  onChange={(e) => setForm((p) => ({ ...p, seats: e.target.value }))}
                />
                <input
                  type="date"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  value={form.applicationDeadline}
                  onChange={(e) => setForm((p) => ({ ...p, applicationDeadline: e.target.value }))}
                />
                <div />
              </>
            )}

            {modalType === "assessment" && (
              <>
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 md:col-span-2"
                  placeholder="Assessment Name"
                  value={form.assessmentName}
                  onChange={(e) => setForm((p) => ({ ...p, assessmentName: e.target.value }))}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Domain"
                  value={form.domain}
                  onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
                />
                <input
                  type="number"
                  min="1"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Duration (minutes)"
                  value={form.duration}
                  onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                />
                <input
                  type="number"
                  min="1"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Total Questions"
                  value={form.totalQuestions}
                  onChange={(e) => setForm((p) => ({ ...p, totalQuestions: e.target.value }))}
                />
                <input
                  type="number"
                  min="1"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Pass Marks"
                  value={form.passMarks}
                  onChange={(e) => setForm((p) => ({ ...p, passMarks: e.target.value }))}
                />
                <textarea
                  rows={4}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 md:col-span-2"
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </>
            )}

            {modalType === "certificate" && (
              <>
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Student ID"
                  value={form.studentId}
                  onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Internship Title"
                  value={form.internshipTitle}
                  onChange={(e) => setForm((p) => ({ ...p, internshipTitle: e.target.value }))}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Internship Domain"
                  value={form.internshipDomain}
                  onChange={(e) => setForm((p) => ({ ...p, internshipDomain: e.target.value }))}
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Duration"
                  value={form.internshipDuration}
                  onChange={(e) => setForm((p) => ({ ...p, internshipDuration: e.target.value }))}
                />
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  value={form.certificateType}
                  onChange={(e) => setForm((p) => ({ ...p, certificateType: e.target.value }))}
                >
                  <option>Internship</option>
                  <option>Training</option>
                  <option>Workshop</option>
                  <option>Project</option>
                  <option>Assessment</option>
                  <option>Achievement</option>
                </select>
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Grade"
                  value={form.grade}
                  onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="Score"
                  value={form.score}
                  onChange={(e) => setForm((p) => ({ ...p, score: e.target.value }))}
                />
                <input
                  type="number"
                  min="0"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500"
                  placeholder="XP Earned"
                  value={form.xpEarned}
                  onChange={(e) => setForm((p) => ({ ...p, xpEarned: e.target.value }))}
                />
              </>
            )}

            <div className="md:col-span-2 mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {modalLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {modalLoading ? "Saving..." : modalType === "certificate" ? "Generate" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}