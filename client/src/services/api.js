import axios from "axios";

/*
|--------------------------------------------------------------------------
| API URL
|--------------------------------------------------------------------------
*/

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/*
|--------------------------------------------------------------------------
| Token Helpers
|--------------------------------------------------------------------------
*/

const TOKEN_KEYS = ["token", "authToken", "cybernet_token"];
const USER_KEYS = ["user", "student", "admin", "userRole"];

export const getAuthToken = () => {
  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (token) return token;
  }
  return "";
};

export const clearAuthStorage = () => {
  [...TOKEN_KEYS, ...USER_KEYS].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

export const setAuthStorage = ({ token, user, role, persist = true } = {}) => {
  const storage = persist ? localStorage : sessionStorage;

  if (token) {
    storage.setItem("token", token);
    storage.setItem("authToken", token);
    storage.setItem("cybernet_token", token);
  }

  if (user) {
    storage.setItem("user", JSON.stringify(user));
    storage.setItem("student", JSON.stringify(user));
  }

  if (role) {
    storage.setItem("userRole", role);
  }
};

export const getStoredRole = () => {
  return (
    localStorage.getItem("userRole") ||
    sessionStorage.getItem("userRole") ||
    ""
  );
};

export const decodeJwtPayload = (token) => {
  try {
    if (!token || typeof token !== "string") return null;
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return Date.now() >= payload.exp * 1000;
};

export const getAuthState = () => {
  const token = getAuthToken();
  const payload = decodeJwtPayload(token);

  return {
    token,
    role: payload?.role || getStoredRole() || "student",
    userId: payload?.id || payload?._id || null,
    email: payload?.email || null,
    expired: token ? isTokenExpired(token) : false,
  };
};

/*
|--------------------------------------------------------------------------
| Axios Instance
|--------------------------------------------------------------------------
*/

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: false,
});

/*
|--------------------------------------------------------------------------
| Request Interceptor
|--------------------------------------------------------------------------
*/

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/*
|--------------------------------------------------------------------------
| Response Interceptor
|--------------------------------------------------------------------------
*/

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      clearAuthStorage();

      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

/*
|--------------------------------------------------------------------------
| Auth APIs
|--------------------------------------------------------------------------
*/

export const AuthAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  profile: () => api.get("/auth/profile"),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
  status: () => api.get("/auth/status"),
  googleAuth: () => api.get("/auth/google"),
  githubAuth: () => api.get("/auth/github"),
  linkedinAuth: () => api.get("/auth/linkedin"),
};

/*
|--------------------------------------------------------------------------
| Assessment APIs
|--------------------------------------------------------------------------
*/

export const AssessmentAPI = {
  getQuestions: (limit = 30, params = {}) => {
    const query = new URLSearchParams();
    query.set("limit", String(limit));

    if (params.domain) query.set("domain", params.domain);
    if (params.questionType) query.set("questionType", params.questionType);
    if (params.search) query.set("search", params.search);

    return api.get(`/assessment/questions?${query.toString()}`);
  },
  submitAssessment: (data) => api.post("/assessment/submit", data),
  getResult: () => api.get("/assessment/result"),
  leaderboard: () => api.get("/assessment/leaderboard"),
  health: () => api.get("/assessment/health"),
  adminStats: () => api.get("/assessment/admin/stats"),
};

/*
|--------------------------------------------------------------------------
| Internship APIs
|--------------------------------------------------------------------------
*/

export const InternshipAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams();

    if (params.search) query.set("search", params.search);
    if (params.domain) query.set("domain", params.domain);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (typeof params.isActive !== "undefined") {
      query.set("isActive", String(params.isActive));
    }

    const q = query.toString();
    return api.get(q ? `/internships?${q}` : "/internships");
  },
  getFeatured: () => api.get("/internships/featured"),
  getStats: () => api.get("/internships/stats"),
  getAnalytics: () => api.get("/internships/analytics"),
  getById: (id) => api.get(`/internships/${id}`),
  apply: (id, data) => api.post(`/internships/${id}/apply`, data),
  myApplications: () => api.get("/internships/my/applications"),
  myInternships: () => api.get("/internships/my/internships"),
  create: (data) => api.post("/internships", data),
  update: (id, data) => api.put(`/internships/${id}`, data),
  remove: (id) => api.delete(`/internships/${id}`),
  applicants: (id) => api.get(`/internships/${id}/applicants`),
  selectApplicant: (id, studentId) =>
    api.patch(`/internships/${id}/applicants/${studentId}/select`),
  rejectApplicant: (id, studentId) =>
    api.patch(`/internships/${id}/applicants/${studentId}/reject`),
  completeApplicant: (id, studentId) =>
    api.patch(`/internships/${id}/applicants/${studentId}/complete`),
  featureToggle: (id) => api.patch(`/internships/${id}/feature`),
  getInternshipStats: (id) => api.get(`/internships/${id}/stats`),
  health: () => api.get("/internships/health"),
};

/*
|--------------------------------------------------------------------------
| Payment APIs
|--------------------------------------------------------------------------
*/

export const PaymentAPI = {
  createOrder: (data) => api.post("/payments/create-order", data),
  verifyPayment: (data) => api.post("/payments/verify", data),
  myPayments: () => api.get("/payments/my-payments"),
  paytmCallback: (data) => api.post("/payments/paytm/callback", data),
  adminPayments: () => api.get("/payments/admin/payments"),
  adminRevenue: () => api.get("/payments/admin/revenue"),
  adminPaymentById: (id) => api.get(`/payments/admin/payment/${id}`),
  adminSummary: () => api.get("/payments/admin/summary"),
  lookup: (id) => api.get(`/payments/lookup/${id}`),
  health: () => api.get("/payments/health"),
  status: () => api.get("/payments/status"),
};

/*
|--------------------------------------------------------------------------
| Certificate APIs
|--------------------------------------------------------------------------
*/

export const CertificateAPI = {
  myCertificates: () => api.get("/certificates/my-certificates"),
  verifyCertificate: (certificateId) =>
    api.get(`/certificates/verify/${certificateId}`),
  verifyByCode: (verificationCode) =>
    api.post("/certificates/verify", { verificationCode }),
  companyVerify: (data) => api.post("/certificates/company-verify", data),
  publicCertificate: (certificateId) =>
    api.get(`/certificates/public/${certificateId}`),
  downloadCertificate: (certificateId) =>
    api.get(`/certificates/download/${certificateId}`),
  issue: (data) => api.post("/certificates/issue", data),
  revoke: (certificateId, data) =>
    api.patch(`/certificates/revoke/${certificateId}`, data),
  analytics: () => api.get("/certificates/analytics"),
  adminSummary: () => api.get("/certificates/admin/summary"),
  health: () => api.get("/certificates/health"),
  status: () => api.get("/certificates/status"),
};

/*
|--------------------------------------------------------------------------
| Student APIs
|--------------------------------------------------------------------------
*/

export const StudentAPI = {
  dashboard: () => api.get("/student/dashboard"),
  overview: () => api.get("/student/overview"),
  profile: () => api.get("/student/profile"),
  me: () => api.get("/student/me"),
  stats: () => api.get("/student/stats"),
  tasks: () => api.get("/student/tasks"),
  completeTask: (taskId) => api.patch(`/student/tasks/${taskId}/complete`),
  notifications: () => api.get("/student/notifications"),
  markNotificationRead: (id) =>
    api.patch(`/student/notifications/${id}/read`),
  leaderboard: () => api.get("/student/leaderboard"),
  summary: () => api.get("/student/summary"),
  account: () => api.get("/student/account"),
};

/*
|--------------------------------------------------------------------------
| Admin APIs
|--------------------------------------------------------------------------
*/

export const AdminAPI = {
  dashboard: () => api.get("/admin/dashboard"),
  analytics: () => api.get("/admin/analytics"),
  activity: () => api.get("/admin/activity"),
  recentActivity: () => api.get("/admin/recent-activity"),
  students: (params = {}) => {
    const query = new URLSearchParams();

    if (params.search) query.set("search", params.search);
    if (params.role) query.set("role", params.role);
    if (params.accountStatus) query.set("accountStatus", params.accountStatus);
    if (typeof params.isActive !== "undefined") {
      query.set("isActive", String(params.isActive));
    }
    if (typeof params.assessmentCompleted !== "undefined") {
      query.set("assessmentCompleted", String(params.assessmentCompleted));
    }
    if (typeof params.internshipUnlocked !== "undefined") {
      query.set("internshipUnlocked", String(params.internshipUnlocked));
    }
    if (typeof params.paymentCompleted !== "undefined") {
      query.set("paymentCompleted", String(params.paymentCompleted));
    }
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));

    const q = query.toString();
    return api.get(q ? `/admin/students?${q}` : "/admin/students");
  },
  studentById: (id) => api.get(`/admin/students/${id}`),
  updateStudentStatus: (id, data) =>
    api.patch(`/admin/students/${id}/status`, data),
  updateStudentAssessment: (id, data) =>
    api.patch(`/admin/students/${id}/assessment`, data),
  deleteStudent: (id) => api.delete(`/admin/students/${id}`),

  assessments: (params = {}) => {
    const query = new URLSearchParams();

    if (params.search) query.set("search", params.search);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));

    const q = query.toString();
    return api.get(q ? `/admin/assessments?${q}` : "/admin/assessments");
  },
  createAssessment: (data) => api.post("/admin/assessments", data),
  updateAssessment: (id, data) => api.patch(`/admin/assessments/${id}`, data),
  deleteAssessment: (id) => api.delete(`/admin/assessments/${id}`),

  internships: (params = {}) => {
    const query = new URLSearchParams();

    if (params.search) query.set("search", params.search);
    if (typeof params.isActive !== "undefined") {
      query.set("isActive", String(params.isActive));
    }
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));

    const q = query.toString();
    return api.get(q ? `/admin/internships?${q}` : "/admin/internships");
  },
  createInternship: (data) => api.post("/admin/internships", data),
  updateInternship: (id, data) => api.patch(`/admin/internships/${id}`, data),
  deleteInternship: (id) => api.delete(`/admin/internships/${id}`),

  payments: (params = {}) => {
    const query = new URLSearchParams();

    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    if (params.gateway) query.set("gateway", params.gateway);
    if (params.studentId) query.set("studentId", params.studentId);
    if (params.internshipId) query.set("internshipId", params.internshipId);

    const q = query.toString();
    return api.get(q ? `/admin/payments?${q}` : "/admin/payments");
  },
  paymentById: (id) => api.get(`/admin/payment/${id}`),
  revenue: () => api.get("/admin/revenue"),
  summary: () => api.get("/admin/summary"),

  certificates: () => api.get("/admin/certificates"),
};

/*
|--------------------------------------------------------------------------
| Scholarship API Alias
|--------------------------------------------------------------------------
*/

export const ScholarshipAPI = {
  profileScholarship: () => api.get("/student/profile"),
  studentStats: () => api.get("/student/stats"),
};

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

export default api;