import React from "react";

import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

/* GLOBAL CSS */

import "./styles/cybernet.css";
import "./styles/leaderboard.css";
import "./styles/dashboard.css";
import "./styles/login.css";
import "./styles/register.css";
import "./styles/adminLogin.css";
import "./styles/adminDashboard.css";
import "./styles/explore.css";
import "./styles/exams.css";
import "./styles/instructions.css";
import "./styles/certificate.css";
import "./styles/createExam.css";
import "./styles/result.css";


/* PAGES */

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Exams from "./pages/Exams";
import Result from "./pages/Result";
import ExploreExams from "./pages/ExploreExams";
import Instructions from "./pages/Instructions";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import CreateExam from "./pages/CreateExam";
import Leaderboard from "./pages/Leaderboard";
import InternshipPlans from "./pages/InternshipPlans";
import PaymentPage from "./pages/PaymentPage";
import AdminCertificates from "./pages/AdminCertificates";
import Certificate from "./pages/Certificate";

function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* HOME */}

        <Route
          path="/"
          element={<Home />}
        />

        {/* LOGIN */}

        <Route
          path="/login"
          element={<Login />}
        />

        {/* REGISTER */}

        <Route
          path="/register"
          element={<Register />}
        />

        {/* USER DASHBOARD */}

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        {/* EXPLORE EXAMS */}

        <Route
          path="/explore"
          element={<ExploreExams />}
        />

        {/* INSTRUCTIONS */}

        <Route
          path="/instructions"
          element={<Instructions />}
        />

        {/* LIVE EXAM */}

        <Route
          path="/exams"
          element={<Exams />}
        />

        {/* RESULT */}

        <Route
          path="/result"
          element={<Result />}
        />

        {/* CERTIFICATE */}

        <Route
          path="/certificate"
          element={<Certificate />}
        />


        {/* LEADERBOARD */}

        <Route
          path="/leaderboard"
          element={<Leaderboard />}
        />

        {/* ADMIN LOGIN */}

        <Route
          path="/admin"
          element={<AdminLogin />}
        />

        {/* ADMIN DASHBOARD */}

        <Route
          path="/admin/dashboard"
          element={<AdminDashboard />}
        />

        {/* CREATE EXAM */}

        <Route
          path="/admin/create-exam"
          element={<CreateExam />}
        />
        {/* INTERNSHIP PLANS */}

        <Route
          path="/internship-plans"
          element={<InternshipPlans />}
        />

        {/* PAYMENT PAGE */}

        <Route
          path="/payment"
          element={<PaymentPage />}
        />  
      {/* ADMIN CERTIFICATES */}

        <Route
          path="/admin/certificates"
          element={<AdminCertificates />}
        />  
      </Routes>

    </BrowserRouter>

  );

}

export default App;