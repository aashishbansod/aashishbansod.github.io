import { BrowserRouter, Routes, Route } from "react-router-dom";

// Public Pages
import Home from "./pages/Home/Home";
import About from "./pages/About/About";
import Verify from "./pages/Verify/Verify";
import Contact from "./pages/Contact/Contact";

// Auth Pages
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";

// Protected Route
import ProtectedRoute from "./components/ProtectedRoute";

// Student Pages
import StudentDashboard from "./pages/Student/StudentDashboard";
import StudentDailyTasks from "./pages/Student/StudentDailyTasks";
import StudentCodingPractice from "./pages/Student/StudentCodingPractice";
import StudentInternships from "./pages/Student/StudentInternships";
import StudentCertificates from "./pages/Student/StudentCertificates";
import StudentProfile from "./pages/Student/StudentProfile";
import StudentLeaderboard from "./pages/Student/StudentLeaderboard";
import StudentAssessment from "./pages/Student/StudentAssessment";
import StudentScholarship from "./pages/Student/StudentScholarship";
import StudentAIMentor from "./pages/Student/StudentAIMentor";
import ApplyInternship from "./pages/Student/ApplyInternship";
import AssessmentTest from "./pages/Assessment/AssessmentTest";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC ROUTES */}

        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/contact" element={<Contact />} />

        {/* AUTH ROUTES */}

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
    
                {/* STUDENT DASHBOARD ROUTES */}

        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/daily-tasks"
          element={
            <ProtectedRoute>
              <StudentDailyTasks />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/coding-practice"
          element={
            <ProtectedRoute>
              <StudentCodingPractice />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/internships"
          element={
            <ProtectedRoute>
              <StudentInternships />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/certificates"
          element={
            <ProtectedRoute>
              <StudentCertificates />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/profile"
          element={
            <ProtectedRoute>
              <StudentProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/leaderboard"
          element={
            <ProtectedRoute>
              <StudentLeaderboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/assessment"
          element={
            <ProtectedRoute>
              <StudentAssessment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/scholarship"
          element={
            <ProtectedRoute>
              <StudentScholarship />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/ai-mentor"
          element={
            <ProtectedRoute>
              <StudentAIMentor />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/apply-internship"
          element={
            <ProtectedRoute>
              <ApplyInternship />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assessment/test"
          element={
            <ProtectedRoute>
              <AssessmentTest />
            </ProtectedRoute>
          }
        />
                {/* 404 FALLBACK */}

        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-slate-100">

              <div className="text-center">

                <h1 className="text-7xl font-black text-blue-600">
                  404
                </h1>

                <h2 className="text-3xl font-bold mt-4">
                  Page Not Found
                </h2>

                <p className="text-slate-500 mt-3">
                  The page you are looking for does not exist.
                </p>

              </div>

            </div>
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;