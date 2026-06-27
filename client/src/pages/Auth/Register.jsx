import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import {
  FaUserGraduate,
  FaBrain,
  FaUserShield,
  FaEye,
  FaEyeSlash,
  FaBriefcase,
  FaRocket,
  FaLaptopCode,
  FaShieldAlt,
  FaCertificate,
  FaChartLine,
  FaArrowRight,
  FaCheckCircle,
  FaSpinner,
  FaUserPlus,
  FaEnvelope,
  FaPhoneAlt,
  FaBuilding,
  FaBook,
  FaLayerGroup,
  FaLock,
  FaIdCard,
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

function Register() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    collegeName: "",
    course: "",
    currentYear: "",
    internshipDomain: "",
    password: "",
    confirmPassword: "",
    rememberMe: true,
    agreeTerms: false,
  });

  const internshipDomains = useMemo(
    () => [
      "Full Stack Development",
      "Frontend Development",
      "Backend Development",
      "Java Development",
      "Python Development",
      "Artificial Intelligence",
      "Machine Learning",
      "Cyber Security",
      "Cloud Computing",
      "Data Science",
      "UI/UX Design",
      "Digital Marketing",
    ],
    []
  );

  const stats = useMemo(
    () => [
      { value: "1200+", label: "Students", icon: FaUserGraduate },
      { value: "25+", label: "Internship Tracks", icon: FaBriefcase },
      { value: "150+", label: "Projects", icon: FaLaptopCode },
      { value: "24/7", label: "Support", icon: FaChartLine },
    ],
    []
  );

  useEffect(() => {
    const token = getToken();
    if (token) {
      const payload = decodeJwtPayload(token);
      const role = payload?.role || "student";

      navigate(
        String(role).toLowerCase() === "admin"
          ? "/admin/dashboard"
          : "/student/dashboard",
        { replace: true }
      );
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    const {
      firstName,
      lastName,
      email,
      mobile,
      collegeName,
      course,
      currentYear,
      internshipDomain,
      password,
      confirmPassword,
      agreeTerms,
    } = formData;

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !mobile.trim() ||
      !collegeName.trim() ||
      !course.trim() ||
      !currentYear.trim() ||
      !internshipDomain.trim() ||
      !password ||
      !confirmPassword
    ) {
      toast.error("Please fill all required fields");
      return false;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return false;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }

    if (!agreeTerms) {
      toast.error("Please accept the terms and conditions");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);

      const response = await axios.post(`${AUTH_API}/register`, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile.trim(),
        collegeName: formData.collegeName.trim(),
        course: formData.course.trim(),
        currentYear: formData.currentYear.trim(),
        internshipDomain: formData.internshipDomain.trim(),
        password: formData.password,
        role: "student",
      });

      if (!response.data?.success) {
        toast.error(response.data?.message || "Registration failed");
        return;
      }

      const token = response.data.token || "";
      const user = response.data.student || response.data.user || null;

      if (token) {
        storeAuthData({
          token,
          user,
          rememberMe: formData.rememberMe,
        });

        toast.success("Registration successful 🚀");

        const payload = decodeJwtPayload(token);
        const role = payload?.role || user?.role || "student";

        navigate(
          String(role).toLowerCase() === "admin"
            ? "/admin/dashboard"
            : "/student/dashboard",
          { replace: true }
        );
        return;
      }

      toast.success("Registration successful. Please login.");
      navigate("/login?role=student", { replace: true });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Registration failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-slate-100">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 px-6 py-12 text-white lg:flex lg:flex-col lg:justify-between lg:px-16">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute left-10 top-10 h-[450px] w-[450px] rounded-full bg-cyan-500/20 blur-[140px]" />
            <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[180px]" />
            <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl" />
          </div>

          <div className="relative z-10">
            <div className="mb-12 flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-2xl backdrop-blur-xl">
                <FaRocket />
              </div>
              <div>
                <h2 className="text-2xl font-black">CyberNet</h2>
                <p className="text-sm text-cyan-300">Technology Systems</p>
              </div>
            </div>

            <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 font-medium text-cyan-300">
              <FaRocket />
              Internship Registration Portal
            </span>

            <h2 className="max-w-2xl text-5xl font-black leading-tight lg:text-6xl">
              Launch Your
              <br />
              <span className="text-cyan-400">Tech Career</span>
              <br />
              With CyberNet
            </h2>

            <p className="mt-8 max-w-xl text-lg leading-9 text-slate-300 lg:text-xl">
              Join industry-ready internship programs, AI-powered learning, real projects,
              mentorship and verified certificates through CyberNet Technology Systems.
            </p>

            <div className="mt-12 space-y-5">
              <div className="flex items-center gap-4">
                <FaCheckCircle className="text-xl text-cyan-400" />
                <span>Industry Based Internships</span>
              </div>
              <div className="flex items-center gap-4">
                <FaCheckCircle className="text-xl text-cyan-400" />
                <span>AI Powered Assessment System</span>
              </div>
              <div className="flex items-center gap-4">
                <FaCheckCircle className="text-xl text-cyan-400" />
                <span>Verified Digital Certificates</span>
              </div>
              <div className="flex items-center gap-4">
                <FaCheckCircle className="text-xl text-cyan-400" />
                <span>Student Dashboard Access</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-12 grid grid-cols-2 gap-5">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl"
              >
                <item.icon className="mb-4 text-4xl text-cyan-400" />
                <h3 className="text-4xl font-black">{item.value}</h3>
                <p className="mt-2 text-slate-300">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start justify-center overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-2xl rounded-[40px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 lg:p-10"
          >
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 text-3xl text-white shadow-xl">
                <FaUserShield />
              </div>

              <h1 className="text-4xl font-black text-slate-900 sm:text-5xl">
                Create Account
              </h1>

              <p className="mt-3 text-base text-slate-500 sm:text-lg">
                Register for CyberNet Internship Portal
              </p>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Student registration only
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="First Name"
                    autoComplete="given-name"
                    required
                    className="h-14 w-full rounded-2xl border border-slate-300 px-5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last Name"
                    autoComplete="family-name"
                    required
                    className="h-14 w-full rounded-2xl border border-slate-300 px-5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

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
                    className="h-14 w-full rounded-2xl border border-slate-300 px-5 pl-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Mobile Number
                </label>
                <div className="relative">
                  <FaPhoneAlt className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="Enter your mobile number"
                    autoComplete="tel"
                    required
                    className="h-14 w-full rounded-2xl border border-slate-300 px-5 pl-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    College Name
                  </label>
                  <div className="relative">
                    <FaBuilding className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="collegeName"
                      value={formData.collegeName}
                      onChange={handleChange}
                      placeholder="College Name"
                      required
                      className="h-14 w-full rounded-2xl border border-slate-300 px-5 pl-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Course
                  </label>
                  <div className="relative">
                    <FaBook className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      name="course"
                      value={formData.course}
                      onChange={handleChange}
                      placeholder="Course"
                      required
                      className="h-14 w-full rounded-2xl border border-slate-300 px-5 pl-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Current Year
                  </label>
                  <div className="relative">
                    <FaLayerGroup className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      name="currentYear"
                      value={formData.currentYear}
                      onChange={handleChange}
                      required
                      className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-5 pl-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Select Current Year</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="Final Year">Final Year</option>
                      <option value="Graduate">Graduate</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Internship Domain
                  </label>
                  <div className="relative">
                    <FaBriefcase className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      name="internshipDomain"
                      value={formData.internshipDomain}
                      onChange={handleChange}
                      required
                      className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-5 pl-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Select Internship Domain</option>
                      {internshipDomains.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Create Password
                  </label>
                  <div className="relative">
                    <FaLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create Password"
                      autoComplete="new-password"
                      required
                      className="h-14 w-full rounded-2xl border border-slate-300 px-5 pl-12 pr-14 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-blue-600"
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <FaLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm Password"
                      autoComplete="new-password"
                      required
                      className="h-14 w-full rounded-2xl border border-slate-300 px-5 pl-12 pr-14 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-blue-600"
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 accent-blue-600"
                />
                <label className="text-sm text-slate-600">
                  I agree to CyberNet Technology Systems Terms & Conditions and Privacy
                  Policy.
                </label>
              </div>

              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="h-4 w-4 accent-blue-600"
                />
                Remember me on this device
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 font-bold text-white shadow-xl transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <FaUserPlus />
                    Create Account
                    <FaArrowRight />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-slate-500">
                Already have an account?
                <Link
                  to="/login?role=student"
                  className="ml-2 font-bold text-blue-600 transition hover:text-blue-800"
                >
                  Sign In
                </Link>
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition hover:bg-blue-50">
                <FaLaptopCode className="mx-auto mb-2 text-2xl text-blue-600" />
                <p className="text-xs font-semibold">Coding</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition hover:bg-cyan-50">
                <FaCertificate className="mx-auto mb-2 text-2xl text-cyan-600" />
                <p className="text-xs font-semibold">Certificates</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center transition hover:bg-green-50">
                <FaUserGraduate className="mx-auto mb-2 text-2xl text-green-600" />
                <p className="text-xs font-semibold">Internships</p>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6 text-center">
              <p className="text-xs text-slate-400">
                © 2026 CyberNet Technology Systems
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Secure Internship & Learning Platform
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default Register;