import React from "react";

import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import Home from "./pages/Home";

import Login from "./pages/Login";

import Register from "./pages/Register";

import Dashboard from "./pages/Dashboard";

import Exams from "./pages/Exams";

import Result from "./pages/Result";

import Instructions from "./pages/Instructions";

import AdminLogin from "./pages/AdminLogin";

import AdminDashboard from "./pages/AdminDashboard";

import CreateExam from "./pages/CreateExam";

import ProtectedRoute from "./components/ProtectedRoute";

import CertificateForm from "./pages/CertificateForm";

import ExploreExams from "./pages/ExploreExams";

import CodingArena from "./pages/CodingArena";

import InternshipPlans from "./pages/InternshipPlans";

import PaymentPage from "./pages/PaymentPage";



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

        {/* DASHBOARD */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>

              <Dashboard />

            </ProtectedRoute>
          }
        />

        {/* INSTRUCTIONS */}

        <Route
          path="/instructions"
          element={
            <ProtectedRoute>

              <Instructions />

            </ProtectedRoute>
          }
        />

        {/* EXAMS */}

        <Route
          path="/exams"
          element={
            <ProtectedRoute>

              <Exams />

            </ProtectedRoute>
          }
        />

        {/* RESULT */}

        <Route
          path="/result"
          element={
            <ProtectedRoute>

              <Result />

            </ProtectedRoute>
          }
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
        {/* CERTIFICATE FORM */}
        
        <Route
          path="/certificate-form"
          element={
            <ProtectedRoute>

              <CertificateForm />

            </ProtectedRoute>
          }
        />

        {/* EXPLORE EXAMS */}

        <Route
          path="/explore"
          element={<ExploreExams />}
        />
        {/* CODING ARENA */}

        <Route
          path="/coding-arena"
          element={
            <ProtectedRoute>

              <CodingArena />

            </ProtectedRoute>
          }
        />

        {/* INTERNSHIP PLANS */}

        <Route
          path="/internship-plans"
          element={
            <ProtectedRoute>

              <InternshipPlans />

            </ProtectedRoute>
          }
        />

        {/* PAYMENT PAGE */}

        <Route
          path="/payment"
          element={
            <ProtectedRoute>

              <PaymentPage />

            </ProtectedRoute>
          }
        />


      </Routes>

    </BrowserRouter>

  );

}

export default App;