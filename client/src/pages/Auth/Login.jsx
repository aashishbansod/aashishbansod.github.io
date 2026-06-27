import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowRight,
  FaBrain,
  FaCertificate,
  FaCheckCircle,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaKey,
  FaLaptopCode,
  FaLock,
  FaRocket,
  FaShieldAlt,
  FaSpinner,
  FaTimes,
  FaUserGraduate,
  FaUserShield,
} from "react-icons/fa";

const AUTH_API =
  import.meta.env.VITE_AUTH_API_URL ||
  "http://localhost:5000/api/auth";

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem("cybernet_token") ||
    sessionStorage.getItem("cybernet_token") ||
    ""
  );
}

function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function storeAuthData({ token, user, rememberMe }) {
  const primaryStorage = rememberMe ? localStorage : sessionStorage;
  const secondaryStorage = rememberMe ? sessionStorage : localStorage;

  primaryStorage.setItem("token", token);
  primaryStorage.setItem("authToken", token);
  primaryStorage.setItem("cybernet_token", token);

  secondaryStorage.removeItem("token");
  secondaryStorage.removeItem("authToken");
  secondaryStorage.removeItem("cybernet_token");

  if (user) {
    primaryStorage.setItem("user", JSON.stringify(user));
    primaryStorage.setItem("userRole", user.role || "student");
    secondaryStorage.removeItem("user");
    secondaryStorage.removeItem("userRole");
  }
}

function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialRole = useMemo(() => {
    const role = String(searchParams.get("role") || "").toLowerCase();
    return role === "admin" ? "admin" : "student";
  }, [searchParams]);

  const [role, setRole] = useState(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [forgotData, setForgotData] = useState({
    email: "",
  });

  const hero = useMemo(() => {
    if (role === "admin") {
      return {
        badge: "CyberNet Admin Control Center",
        title: "Secure Admin Access",
        subtitle:
          "Manage students, internships, assessments, payments, certificates and reports from one powerful dashboard.",
        points: [
          "Student management and moderation",
          "Assessment and question control",
          "Payments and certificate analytics",
          "Internship publishing and monitoring",
        ],
        accent: "from-slate-950 via-blue-950 to-cyan-900",
        icon: FaUserShield,
        cta: "Login To Admin Dashboard",
      };
    }

    return {
      badge: "CyberNet Internship Portal",
      title: "Welcome Back To",
      subtitle:
        "Access your internship dashboard, complete assessments, earn certificates, and unlock scholarship opportunities.",
      points: [
        "AI powered assessment system",
        "Internship progress tracking",
        "Verified digital certificates",
        "Secure student dashboard",
      ],
      accent: "from-blue-950 via-sky-900 to-cyan-700",
      icon: FaShieldAlt,
      cta: "Login To Dashboard",
    };
  }, [role]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const payload = decodeJwtPayload(token);
    const savedRole =
      payload?.role ||
      localStorage.getItem("userRole") ||
      sessionStorage.getItem("userRole") ||
      "student";

    navigate(
      String(savedRole).toLowerCase() === "admin"
        ? "/admin/dashboard"
        : "/student/dashboard",
      { replace: true }
    );
  }, [navigate]);

  useEffect(() => {
    const currentRole = String(searchParams.get("role") || "").toLowerCase();
    const nextRole = currentRole === "admin" ? "admin" : "student";
    setRole(nextRole);
  }, [searchParams]);

  const updateRole = (nextRole) => {
    const normalized = nextRole === "admin" ? "admin" : "student";
    setRole(normalized);
    setSearchParams({ role: normalized });
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleForgotChange = (e) => {
    const { name, value } = e.target;
    setForgotData((prev) => ({ ...prev, [name]: value }));
  };

  const redirectToDashboard = (token, user) => {
    const payload = decodeJwtPayload(token);
    const resolvedRole = String(
      payload?.role || user?.role || role || "student"
    ).toLowerCase();

    navigate(
      resolvedRole === "admin"
        ? "/admin/dashboard"
        : "/student/dashboard",
      { replace: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = formData.email.trim();
    const password = formData.password.trim();

    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(`${AUTH_API}/login`, {
        email,
        password,
        role,
      });

      if (!response.data?.success) {
        toast.error(response.data?.message || "Login failed");
        return;
      }

      const token =
        response.data.token ||
        response.data?.data?.token ||
        "";

      const user =
        response.data.student ||
        response.data.user ||
        response.data?.data?.user ||
        null;

      if (!token) {
        toast.error("Login succeeded but token was missing");
        return;
      }

      storeAuthData({
        token,
        user,
        rememberMe: formData.rememberMe,
      });

      toast.success(
        `Welcome ${user?.firstName || (role === "admin" ? "Admin" : "Student")} 🚀`
      );

      redirectToDashboard(token, user);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Login failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async (e) => {
    e.preventDefault();

    const email = forgotData.email.trim();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    try {
      setResetLoading(true);

      const endpoints = [
        `${AUTH_API}/forgot-password`,
        `${AUTH_API}/reset-password/request`,
        `${AUTH_API}/password/forgot`,
      ];

      let success = false;
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const res = await axios.post(endpoint, { email, role });
          if (res.data?.success || res.status === 200) {
            success = true;
            break;
          }
        } catch (err) {
          lastError = err;
        }
      }

      if (!success) {
        throw lastError || new Error("Reset request failed");
      }

      toast.success("Password reset link sent. Check your email.");
      setForgotOpen(false);
      setForgotData({ email: "" });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Unable to send reset link right now.";
      toast.error(message);
    } finally {
      setResetLoading(false);
    }
  };

  const RoleToggle = () => (
    <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => updateRole("student")}
        className={[
          "rounded-xl px-4 py-3 text-sm font-bold transition-all",
          role === "student"
            ? "bg-white text-blue-700 shadow"
            : "text-slate-500 hover:text-slate-700",
        ].join(" ")}
      >
        <span className="inline-flex items-center gap-2">
          <FaUserGraduate />
          Student Login
        </span>
      </button>

      <button
        type="button"
        onClick={() => updateRole("admin")}
        className={[
          "rounded-xl px-4 py-3 text-sm font-bold transition-all",
          role === "admin"
            ? "bg-white text-blue-700 shadow"
            : "text-slate-500 hover:text-slate-700",
        ].join(" ")}
      >
        <span className="inline-flex items-center gap-2">
          <FaUserShield />
          Admin Login
        </span>
      </button>
    </div>
  );

  return (
    <>
      <div className="min-h-screen overflow-x-hidden bg-slate-100 lg:h-screen">
        <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
          <div
            className={`relative hidden overflow-hidden bg-gradient-to-br ${hero.accent} text-white lg:flex`}
          >
            <div className="absolute inset-0">
              <div className="absolute left-10 top-10 h-96 w-96 rounded-full bg-cyan-400/20 blur-[120px]" />
              <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[150px]" />
              <div className="absolute right-20 top-28 h-44 w-44 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl" />
              <div className="absolute bottom-24 left-20 h-32 w-32 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl" />
            </div>

            <div className="relative z-10 flex w-full flex-col justify-center px-12 xl:px-16">
              <div className="mb-8 inline-flex w-fit items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur-xl">
                <FaRocket />
                {hero.badge}
              </div>

              <h1 className="max-w-2xl text-5xl font-black leading-tight xl:text-6xl">
                {role === "admin" ? "Login To" : hero.title}
                <span className="block bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                  {role === "admin" ? "CyberNet Admin Portal" : "CyberNet Portal"}
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-8 text-blue-100 xl:text-xl">
                {hero.subtitle}
              </p>

              <div className="mt-10 space-y-4">
                {hero.points.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-base">
                    <FaCheckCircle className="text-cyan-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-12 grid max-w-2xl grid-cols-3 gap-4">
                <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
                  <h3 className="text-3xl font-black">2500+</h3>
                  <p className="mt-2 text-sm text-blue-100">Students</p>
                </div>
                <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
                  <h3 className="text-3xl font-black">30+</h3>
                  <p className="mt-2 text-sm text-blue-100">Domains</p>
                </div>
                <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
                  <h3 className="text-3xl font-black">100%</h3>
                  <p className="mt-2 text-sm text-blue-100">Secure</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
            <div className="w-full max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-[36px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-7 lg:p-8"
              >
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 flex h-18 w-18 items-center justify-center rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 text-3xl text-white shadow-lg">
                    {role === "admin" ? <FaUserShield /> : <FaShieldAlt />}
                  </div>

                  <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">
                    {role === "admin" ? "Admin Login" : "Student Login"}
                  </h2>

                  <p className="mt-2 text-sm text-slate-500 sm:text-base">
                    {role === "admin"
                      ? "Login to access admin controls"
                      : "Login to access your dashboard"}
                  </p>
                </div>

                <RoleToggle />

                <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700">
                  🔒 Secure login protected by CyberNet
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Email Address
                    </label>
                    <div className="relative">
                      <FaEnvelope className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email"
                        autoComplete="email"
                        required
                        className="h-13 w-full rounded-2xl border border-slate-300 px-5 py-3 pl-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Password
                    </label>
                    <div className="relative">
                      <FaKey className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                        className="h-13 w-full rounded-2xl border border-slate-300 px-5 py-3 pl-12 pr-14 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-blue-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <label className="flex items-center gap-3 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        name="rememberMe"
                        checked={formData.rememberMe}
                        onChange={handleChange}
                        className="h-4 w-4 accent-blue-600"
                      />
                      Remember Me
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setForgotData({ email: formData.email.trim() });
                        setForgotOpen(true);
                      }}
                      className="font-semibold text-blue-600 transition hover:text-blue-800"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 text-base font-bold text-white shadow-xl transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        Logging In...
                      </>
                    ) : (
                      <>
                        <FaLock />
                        {hero.cta}
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  {role === "student" ? (
                    <p className="text-sm text-slate-600">
                      Don't have an account?
                      <Link
                        to="/register"
                        className="ml-2 font-bold text-blue-600 transition hover:text-blue-800"
                      >
                        Create Account
                      </Link>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Admin access only. Contact the system owner for credentials.
                    </p>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition hover:bg-blue-50">
                    <FaLaptopCode className="mx-auto mb-2 text-xl text-blue-600" />
                    <p className="text-xs font-semibold">Coding</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition hover:bg-cyan-50">
                    <FaCertificate className="mx-auto mb-2 text-xl text-cyan-600" />
                    <p className="text-xs font-semibold">Certificates</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition hover:bg-green-50">
                    <FaBrain className="mx-auto mb-2 text-xl text-green-600" />
                    <p className="text-xs font-semibold">AI</p>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4 text-center">
                  <p className="text-xs text-slate-400">
                    © 2026 CyberNet Technology Systems
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4"
          >
            <motion.div
              initial={{ y: 20, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.98 }}
              className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    Forgot Password
                  </h3>
                  <p className="mt-2 text-slate-500">
                    Enter your email to receive a reset link.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="rounded-2xl bg-slate-100 p-3 text-slate-600 hover:bg-slate-200"
                >
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={requestPasswordReset} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={forgotData.email}
                    onChange={handleForgotChange}
                    placeholder="Enter your registered email"
                    className="h-14 w-full rounded-2xl border border-slate-300 px-5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="h-12 flex-1 rounded-2xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 font-bold text-white hover:bg-blue-700 disabled:opacity-70"
                  >
                    {resetLoading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FaRocket />
                        Send Reset Link
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Login;