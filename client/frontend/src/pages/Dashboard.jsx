import React, {
  useEffect
} from "react";

import {
  FaLaptopCode,
  FaCertificate,
  FaCode,
  FaRocket,
  FaTrophy,
  FaBell,
  FaBrain,
  FaFire,
  FaChartLine,
  FaSignOutAlt
} from "react-icons/fa";

import { MdDashboard } from "react-icons/md";

import {
  NavLink,
  useNavigate
} from "react-router-dom";

import "../styles/dashboard.css";

function Dashboard() {

  const navigate = useNavigate();

  /* ========================= */
  /* PROTECTED ROUTE */
  /* ========================= */

  useEffect(() => {

    const token =
    localStorage.getItem("token");

    if(!token){

      navigate("/login");

    }

  }, []);

  /* ========================= */
  /* USER DATA */
  /* ========================= */

  const user = JSON.parse(

    localStorage.getItem("user")

  );

  /* ========================= */
  /* LOGOUT */
  /* ========================= */

  const handleLogout = () => {

    localStorage.removeItem("token");

    localStorage.removeItem("user");

    navigate("/login");

  };

  return (

    <div className="dashboard-page">

      {/* SIDEBAR */}

      <div className="dashboard-sidebar">

        <div className="dashboard-logo">

          Cyber <span>Net</span>

        </div>

        {/* MENU */}

        <div className="sidebar-menu">

          <NavLink
            to="/dashboard"
            className="sidebar-item"
          >

            <MdDashboard />
            Dashboard

          </NavLink>

          <NavLink
            to="/instructions"
            className="sidebar-item"
          >

            <FaRocket />
            Live Exams

          </NavLink>

          <NavLink
            to="/explore"
            className="sidebar-item"
          >

            <FaCode />
            Coding Arena

          </NavLink>

          <NavLink
            to="/certificate"
            className="sidebar-item"
          >

            <FaLaptopCode />
            Internship

          </NavLink>

          <NavLink
            to="/certificate"
            className="sidebar-item"
          >

            <FaCertificate />
            Certificates

          </NavLink>

          <NavLink
            to="/leaderboard"
            className="sidebar-item"
          >

            <FaTrophy />
            Leaderboard

          </NavLink>

        </div>

        {/* AI BOX */}

        <div className="sidebar-ai-box">

          <FaBrain className="sidebar-ai-icon" />

          <h3>

            AI Automation

          </h3>

          <p>

            Smart AI exam tracking
            and student analytics.

          </p>

        </div>

        {/* LOGOUT */}

        <button
          className="logout-btn"
          onClick={handleLogout}
        >

          <FaSignOutAlt />

          Logout

        </button>

      </div>

      {/* MAIN */}

      <div className="dashboard-main">

        {/* TOPBAR */}

        <div className="dashboard-topbar">

          <div>

            <h1>

              Welcome Back 👋

            </h1>

            <p>

              AI Powered Student Dashboard

            </p>

          </div>

          <div className="topbar-right">

            {/* NOTIFICATION */}

            <div className="notification-box">

              <FaBell />

              <span className="notify-dot"></span>

            </div>

            {/* PROFILE */}

            <div className="student-profile">

              <img
                src="https://i.pravatar.cc/150?img=12"
                alt=""
              />

              <div>

                <h3>

                  {

                    user?.name ||

                    "Student"

                  }

                </h3>

                <span>

                  Frontend Intern

                </span>

              </div>

            </div>

          </div>

        </div>

        {/* AI BANNER */}

        <div className="ai-banner">

          <div className="ai-left">

            <div className="ai-badge">

              <FaFire />

              AI Powered Analytics

            </div>

            <h1>

              🤖 AI Performance Analysis

            </h1>

            <p>

              Your performance increased
              by 28% this week.
              Keep practicing coding tests
              and internship tasks.

            </p>

            <div className="banner-buttons">

              <button
                onClick={() =>
                  navigate("/explore")
                }
              >

                Explore AI Insights

              </button>

              <button
                className="secondary-btn"
                onClick={() =>
                  navigate("/leaderboard")
                }
              >

                View Rankings

              </button>

            </div>

          </div>

          <div className="ai-right">

            <FaBrain className="brain-icon" />

          </div>

        </div>

        {/* STATS */}

        <div className="stats-grid">

          <div
            className="stat-card"
            onClick={() =>
              navigate("/exams")
            }
          >

            <div className="stat-icon blue">

              <FaRocket />

            </div>

            <div>

              <h2>

                12

              </h2>

              <p>

                Total Exams

              </p>

            </div>

          </div>

          <div
            className="stat-card"
            onClick={() =>
              navigate("/certificate-form")
            }
          >

            <div className="stat-icon purple">

              <FaCertificate />

            </div>

            <div>

              <h2>

                5

              </h2>

              <p>

                Certificates

              </p>

            </div>

          </div>

          <div
            className="stat-card"
            onClick={() =>
              navigate("/explore")
            }
          >

            <div className="stat-icon orange">

              <FaCode />

            </div>

            <div>

              <h2>

                8

              </h2>

              <p>

                Coding Tasks

              </p>

            </div>

          </div>

          <div
            className="stat-card"
            onClick={() =>
              navigate("/leaderboard")
            }
          >

            <div className="stat-icon green">

              <FaChartLine />

            </div>

            <div>

              <h2>

                #12

              </h2>

              <p>

                Global Rank

              </p>

            </div>

          </div>

        </div>

        {/* BOTTOM */}

        <div className="dashboard-bottom">

          {/* ANALYTICS */}

          <div className="analytics-card">

            <div className="card-top">

              <h2>

                📊 Performance Analytics

              </h2>

              <span>

                AI Updated

              </span>

            </div>

            <div className="progress-box">

              <div>

                <h1>

                  92%

                </h1>

                <p>

                  Overall Score

                </p>

              </div>

              <div className="progress-circle">

                92%

              </div>

            </div>

            <div className="analytics-grid">

              <div>

                <h2>

                  #12

                </h2>

                <span>

                  Global Rank

                </span>

              </div>

              <div>

                <h2>

                  95%

                </h2>

                <span>

                  Attendance

                </span>

              </div>

              <div>

                <h2>

                  18

                </h2>

                <span>

                  Projects

                </span>

              </div>

            </div>

          </div>

          {/* ACTIVITY */}

          <div className="activity-card">

            <div className="card-top">

              <h2>

                ⚡ Recent Activity

              </h2>

              <span>

                Live Updates

              </span>

            </div>

            <div
              className="activity-item"
              onClick={() =>
                navigate("/result")
              }
            >

              ✅ React Exam Submitted

            </div>

            <div
              className="activity-item"
              onClick={() =>
                navigate("/certificate-form")
              }
            >

              🚀 Internship Approved

            </div>

            <div
              className="activity-item"
              onClick={() =>
                navigate("/certificate-form")
              }
            >

              📜 Certificate Generated

            </div>

            <div
              className="activity-item"
              onClick={() =>
                navigate("/explore")
              }
            >

              💻 Coding Challenge Completed

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}

export default Dashboard;