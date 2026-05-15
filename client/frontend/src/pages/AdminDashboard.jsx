import React from "react";

import { useNavigate } from "react-router-dom";

import {
  FaUsers,
  FaClipboardList,
  FaAward,
  FaRobot,
  FaChartLine,
  FaBell,
  FaFileAlt,
  FaCog,
  FaRocket,
  FaSignOutAlt,
  FaUserCheck
} from "react-icons/fa";

import "../styles/adminDashboard.css";

function AdminDashboard() {

  const navigate = useNavigate();

  const logoutAdmin = () => {

    alert("Admin Logged Out");

    navigate("/admin");

  };

  return (

    <div className="admin-dashboard">

      {/* ================= SIDEBAR ================= */}

      <div className="admin-sidebar">

        <div>

          {/* LOGO */}

          <div className="admin-logo-box">

            <div className="admin-logo-icon">
              ⚡
            </div>

            <div>

              <h1 className="admin-logo">
                CyberNet
              </h1>

              <p className="admin-sub-logo">
                AI Admin Panel
              </p>

            </div>

          </div>

          {/* MENU */}

          <ul className="admin-menu">

            <li
              className="active-admin-link"
              onClick={() =>
                navigate("/admin/dashboard")
              }
            >

              <FaRocket />
              <span>Dashboard</span>

            </li>

            <li
              onClick={() =>
                navigate("/leaderboard")
              }
            >

              <FaUsers />
              <span>Students</span>

            </li>

            <li
              onClick={() =>
                navigate("/admin/create-exam")
              }
            >

              <FaClipboardList />
              <span>Exams</span>

            </li>

            {/* UPDATED */}

            <li
              onClick={() =>
                navigate("/admin/certificates")
              }
            >

              <FaUserCheck />
              <span>Student Requests</span>

            </li>

            <li>

              <FaCog />
              <span>Settings</span>

            </li>

          </ul>

        </div>

        {/* AI PRO CARD */}

        <div className="admin-upgrade-card">

          <h3>
            Upgrade To AI Pro 🚀
          </h3>

          <p>
            Unlock smart automation,
            AI reports and analytics.
          </p>

          <button>
            Upgrade Now
          </button>

        </div>

      </div>

      {/* ================= MAIN ================= */}

      <div className="admin-main">

        {/* TOPBAR */}

        <div className="admin-topbar">

          <div>

            <h1>
              Admin Dashboard
            </h1>

            <p>
              Manage exams, students,
              certificates and AI automation.
            </p>

          </div>

          <div className="admin-profile">

            <img
              src="https://i.pravatar.cc/100"
              alt="admin"
            />

            <div>

              <h3>
                Admin
              </h3>

              <p>
                Super Admin
              </p>

            </div>

          </div>

        </div>

        {/* ================= STATS ================= */}

        <div className="admin-stats">

          {/* STUDENTS */}

          <div
            className="admin-stat-card blue-card"
            onClick={() =>
              navigate("/leaderboard")
            }
          >

            <div className="stat-icon">
              <FaUsers />
            </div>

            <div>

              <h3>
                Total Students
              </h3>

              <h1>
                120
              </h1>

              <p>
                +12% this month
              </p>

            </div>

          </div>

          {/* EXAMS */}

          <div
            className="admin-stat-card purple-card"
            onClick={() =>
              navigate("/admin/create-exam")
            }
          >

            <div className="stat-icon">
              <FaClipboardList />
            </div>

            <div>

              <h3>
                Total Exams
              </h3>

              <h1>
                15
              </h1>

              <p>
                AI Generated Exams
              </p>

            </div>

          </div>

          {/* CERTIFICATE REQUESTS */}

          <div
            className="admin-stat-card green-card"
            onClick={() =>
              navigate("/admin/certificates")
            }
          >

            <div className="stat-icon">
              <FaAward />
            </div>

            <div>

              <h3>
                Certificate Requests
              </h3>

              <h1>
                98
              </h1>

              <p>
                Pending Verification
              </p>

            </div>

          </div>

          {/* INTERNS */}

          <div
            className="admin-stat-card orange-card"
            onClick={() =>
              navigate("/leaderboard")
            }
          >

            <div className="stat-icon">
              <FaChartLine />
            </div>

            <div>

              <h3>
                Active Interns
              </h3>

              <h1>
                32
              </h1>

              <p>
                +18% Growth
              </p>

            </div>

          </div>

        </div>

        {/* ================= AI SECTION ================= */}

        <div className="admin-ai-section">

          {/* CREATE EXAM */}

          <div className="admin-action-card">

            <div className="floating-circle one"></div>
            <div className="floating-circle two"></div>

            <h2>
              Create New Exam
            </h2>

            <p>
              Generate MCQ exams,
              coding rounds and AI
              technical assessments.
            </p>

            <button
              className="admin-btn"
              onClick={() =>
                navigate("/admin/create-exam")
              }
            >

              Create Exam

            </button>

          </div>

          {/* AI SYSTEM */}

          <div className="admin-ai-card">

            <div className="ai-badge">
              🤖 AI Automation
            </div>

            <h2>
              Smart AI System
            </h2>

            <p>
              CyberNet AI automatically
              analyzes students, verifies
              certificate requests and
              manages internships.
            </p>

            <div className="ai-features">

              <div
                className="ai-feature-card"
                onClick={() =>
                  navigate("/admin/create-exam")
                }
              >

                <FaRobot />
                AI Exam Generator

              </div>

              <div
                className="ai-feature-card"
                onClick={() =>
                  navigate("/leaderboard")
                }
              >

                <FaChartLine />
                Performance Analytics

              </div>

              <div
                className="ai-feature-card"
                onClick={() =>
                  navigate("/admin/certificates")
                }
              >

                <FaFileAlt />
                Certificate Requests

              </div>

              <div className="ai-feature-card">

                <FaBell />
                Auto Notifications

              </div>

            </div>

          </div>

        </div>

        {/* ================= RECENT ACTIVITY ================= */}

        <div className="recent-activity">

          <h2>
            Recent Activity
          </h2>

          <div className="activity-list">

            <div className="activity-item">
              ✅ New React Exam Created
            </div>

            <div className="activity-item">
              📜 New Certificate Request Submitted
            </div>

            <div className="activity-item">
              🚀 12 Students Joined Internship
            </div>

            <div className="activity-item">
              🤖 AI analyzed student reports
            </div>

          </div>

        </div>

        {/* ================= FOOTER ================= */}

        <div className="admin-footer">

          <button
            className="logout-btn"
            onClick={logoutAdmin}
          >

            <FaSignOutAlt />
            Logout

          </button>

          <p>
            © 2026 CyberNet Technology.
            All Rights Reserved.
          </p>

        </div>

      </div>

    </div>

  );

}

export default AdminDashboard;