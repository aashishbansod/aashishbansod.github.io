import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Navbar from "./components/common/Navbar";
import Footer from "./components/common/Footer";
import ProtectedRoute from "./components/common/ProtectedRoute";
import StudentLayout from "./layouts/StudentLayout";
import AdminLayout from "./layouts/AdminLayout";

/* ===========================
   Lazy Imports
=========================== */

const Home = lazy(() => import("./pages/Home/Home"));
const About = lazy(() => import("./pages/About/About"));
const Contact = lazy(() => import("./pages/Contact/Contact"));
const Internships = lazy(() =>
  import("./pages/Internships/Internships")
);
const Login = lazy(() => import("./pages/Auth/Login"));
const Register = lazy(() => import("./pages/Auth/Register"));
const VerifyCertificate = lazy(() =>
  import("./pages/Certificate/VerifyCertificate")
);

/* Student */
const Dashboard = lazy(() =>
  import("./pages/Student/Dashboard")
);
const Tasks = lazy(() =>
  import("./pages/Student/Tasks")
);
const Practice = lazy(() =>
  import("./pages/Student/Practice")
);
const StudentInternships = lazy(() =>
  import("./pages/Student/Internships")
);
const Certificates = lazy(() =>
  import("./pages/Student/Certificates")
);
const Profile = lazy(() =>
  import("./pages/Student/Profile")
);
const Leaderboard = lazy(() =>
  import("./pages/Student/Leaderboard")
);
const Scholarship = lazy(() =>
  import("./pages/Student/Scholarship")
);
const AIMentor = lazy(() =>
  import("./pages/Student/AIMentor")
);
const Assessment = lazy(() =>
  import("./pages/Student/Assessment")
);
const ApplyInternship = lazy(() =>
  import("./pages/Student/ApplyInternship")
);

/* Admin */
const AdminDashboard = lazy(() =>
  import("./pages/Admin/AdminDashboard")
);
const AdminStudents = lazy(() =>
  import("./pages/Admin/Students")
);
const AdminInternships = lazy(() =>
  import("./pages/Admin/Internships")
);
const AdminApplications = lazy(() =>
  import("./pages/Admin/Applications")
);
const AdminAssessments = lazy(() =>
  import("./pages/Admin/Assessments")
);
const AdminPayments = lazy(() =>
  import("./pages/Admin/Payments")
);
const AdminCertificates = lazy(() =>
  import("./pages/Admin/Certificates")
);
const AdminActivity = lazy(() =>
  import("./pages/Admin/Activity")
);
const AdminAnalytics = lazy(() =>
  import("./pages/Admin/Analytics")
);
const AdminSettings = lazy(() =>
  import("./pages/Admin/Settings")
);

/* ===========================
   Auth Helpers
=========================== */

function decodeToken(token) {
  try {
    if (!token) return null;

    const payload = token.split(".")[1];

    if (!payload) return null;

    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const base64 =
      normalized +
      "=".repeat((4 - (normalized.length % 4)) % 4);

    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

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

function getRole() {
  const payload = decodeToken(getToken());

  return (
    payload?.role ||
    localStorage.getItem("userRole") ||
    sessionStorage.getItem("userRole") ||
    "student"
  );
}

function clearAuth() {
  const keys = [
    "token",
    "authToken",
    "cybernet_token",
    "userRole",
    "user",
    "student",
    "admin",
  ];

  keys.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}

function isAuthenticated() {
  const token = getToken();

  if (!token) return false;

  const payload = decodeToken(token);

  if (!payload) return false;

  if (
    payload.exp &&
    Date.now() >= payload.exp * 1000
  ) {
    clearAuth();
    return false;
  }

  return true;
}

function getHomePath() {
  if (!isAuthenticated()) {
    return "/";
  }

  return getRole() === "admin"
    ? "/admin/dashboard"
    : "/student/dashboard";
}

/* ===========================
   UI Components
=========================== */

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />

        <h2 className="mt-6 text-2xl font-black text-slate-900">
          Loading CyberNet
        </h2>

        <p className="mt-2 text-slate-500">
          Please wait...
        </p>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [location.pathname]);

  return null;
}

function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    const title =
      location.pathname
        .split("/")
        .filter(Boolean)
        .join(" | ") || "Home";

    document.title =
      `${title} | CyberNet Technology Systems`;
  }, [location.pathname]);

  return null;
}

function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}

function AuthRedirect({ children }) {
  if (isAuthenticated()) {
    return (
      <Navigate
        to={getHomePath()}
        replace
      />
    );
  }

  return children;
}

function RootRedirect() {
  return (
    <Navigate
      to={getHomePath()}
      replace
    />
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center px-5">
        <h1 className="text-8xl font-black text-blue-600">
          404
        </h1>

        <h2 className="mt-4 text-3xl font-bold">
          Page Not Found
        </h2>

        <p className="mt-3 text-slate-500">
          This page does not exist.
        </p>

        <a
          href="/"
          className="inline-block mt-8 px-6 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

/* ===========================
   App Routes
=========================== */

function AppContent() {
  const publicRoutes = useMemo(
    () => [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/about",
        element: <About />,
      },
      {
        path: "/contact",
        element: <Contact />,
      },
      {
        path: "/internships",
        element: <Internships />,
      },
      {
        path: "/certificates",
        element: (
          <VerifyCertificate />
        ),
      },
    ],
    []
  );

  return (
    <>
      <ScrollToTop />
      <PageTitle />

      <Suspense fallback={<Loader />}>
        <Routes>

          {/* PUBLIC */}
          {publicRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <PublicLayout>
                  {route.element}
                </PublicLayout>
              }
            />
          ))}

          {/* AUTH */}
          <Route
            path="/login"
            element={
              <AuthRedirect>
                <Login />
              </AuthRedirect>
            }
          />

          <Route
            path="/register"
            element={
              <AuthRedirect>
                <Register />
              </AuthRedirect>
            }
          />

          {/* ROOT */}
          <Route
            path="/dashboard"
            element={<RootRedirect />}
          />

          {/* STUDENT */}
          <Route
            path="/student"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "student",
                  "admin",
                ]}
              >
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <Navigate
                  to="dashboard"
                  replace
                />
              }
            />

            <Route
              path="dashboard"
              element={<Dashboard />}
            />
            <Route
              path="tasks"
              element={<Tasks />}
            />
            <Route
              path="practice"
              element={<Practice />}
            />
            <Route
              path="internships"
              element={
                <StudentInternships />
              }
            />
            <Route
              path="certificates"
              element={<Certificates />}
            />
            <Route
              path="profile"
              element={<Profile />}
            />
            <Route
              path="leaderboard"
              element={<Leaderboard />}
            />
            <Route
              path="scholarship"
              element={<Scholarship />}
            />
            <Route
              path="ai-mentor"
              element={<AIMentor />}
            />
            <Route
              path="assessment"
              element={<Assessment />}
            />
            <Route
              path="apply-internship"
              element={
                <ApplyInternship />
              }
            />
          </Route>

          {/* ADMIN */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "admin",
                ]}
              >
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <Navigate
                  to="dashboard"
                  replace
                />
              }
            />

            <Route
              path="dashboard"
              element={
                <AdminDashboard />
              }
            />

            <Route
              path="students"
              element={
                <AdminStudents />
              }
            />

            <Route
              path="internships"
              element={
                <AdminInternships />
              }
            />

            <Route
              path="applications"
              element={
                <AdminApplications />
              }
            />

            <Route
              path="assessments"
              element={
                <AdminAssessments />
              }
            />

            <Route
              path="payments"
              element={
                <AdminPayments />
              }
            />

            <Route
              path="certificates"
              element={
                <AdminCertificates />
              }
            />

            <Route
              path="activity"
              element={<AdminActivity />}
            />

            <Route
              path="analytics"
              element={
                <AdminAnalytics />
              }
            />

            <Route
              path="settings"
              element={
                <AdminSettings />
              }
            />
          </Route>

          {/* 404 */}
          <Route
            path="*"
            element={<NotFound />}
          />
        </Routes>
      </Suspense>
    </>
  );
}

/* ===========================
   Export
=========================== */

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}