import React from "react";

import { useNavigate } from "react-router-dom";

import "../styles/cybernet.css";

function Dashboard() {

  const navigate = useNavigate();

  // LOGOUT

  const logoutUser = () => {

    localStorage.removeItem("token");

    navigate("/login");

  };

  return (

    <div className="dashboard-page">

      {/* ========================= */}
      {/* SIDEBAR */}
      {/* ========================= */}

      <div className="dashboard-sidebar">

        <div>

          <h2 className="logo-text">
            CyberNet Technology
          </h2>

          <ul>

            <li
              onClick={() =>
                navigate("/dashboard")
              }
            >
              🏠 Dashboard
            </li>

            <li
              onClick={() =>
                navigate("/instructions")
              }
            >
              📝 Live Exams
            </li>

            <li
              onClick={() =>
                navigate("/coding-arena")
              }
            >
              💻 Coding Arena
            </li>

            <li
              onClick={() =>
                navigate("/internships")
              }
            >
              🎯 Internship
            </li>

            <li
              onClick={() =>
                navigate("/certificate-form")
              }
            >
              📜 Certificates
            </li>

            <li>
              🏆 Leaderboard
            </li>

            <li>
              ⚙ Settings
            </li>

          </ul>

        </div>

        <button
          className="logout-btn"
          onClick={logoutUser}
        >
          Logout
        </button>

      </div>

      {/* ========================= */}
      {/* MAIN */}
      {/* ========================= */}

      <div className="dashboard-main">

        {/* TOPBAR */}

        <div className="top-navbar">

          <div>

            <h1>
              Welcome Back 👋
            </h1>

            <p>
              Manage your exams,
              internships and coding tasks.
            </p>

          </div>

          <div className="profile-box">

            <div className="notification">
              🔔
            </div>

            <div className="profile-info">

              <img
                src="https://i.pravatar.cc/100"
                alt="profile"
              />

              <div>

                <h3>
                  Student
                </h3>

                <p>
                  Frontend Intern
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* ========================= */}
        {/* QUICK ACTIONS */}
        {/* ========================= */}

        <div className="quick-actions">

          <button
            onClick={() =>
              navigate("/instructions")
            }
          >
            🚀 Start Exam
          </button>

          <button
            onClick={() =>
              navigate("/coding-arena")
            }
          >
            💻 Coding Arena
          </button>

          <button
            onClick={() =>
              navigate("/internships")
            }
          >
            🎯 Internship Plans
          </button>

          <button
            onClick={() =>
              navigate("/certificate-form")
            }
          >
            📜 Certificates
          </button>

        </div>

        {/* ========================= */}
        {/* DASHBOARD CARDS */}
        {/* ========================= */}

        <div className="dashboard-cards">

          <div className="dashboard-card">

            <h3>
              Total Exams
            </h3>

            <h1>
              12
            </h1>

            <p>
              Completed assessments
            </p>

          </div>

          <div className="dashboard-card">

            <h3>
              Certificates
            </h3>

            <h1>
              5
            </h1>

            <p>
              Verified certificates
            </p>

          </div>

          <div className="dashboard-card">

            <h3>
              Coding Tasks
            </h3>

            <h1>
              8
            </h1>

            <p>
              Active coding challenges
            </p>

          </div>

          <div className="dashboard-card">

            <h3>
              Internship Status
            </h3>

            <h1>
              Active
            </h1>

            <p>
              Frontend Developer Intern
            </p>

          </div>

        </div>

        {/* ========================= */}
        {/* ANALYTICS */}
        {/* ========================= */}

        <div className="analytics-section">

          {/* LEFT */}

          <div className="analytics-card">

            <h2>
              📈 Performance Analytics
            </h2>

            <div className="progress-box">

              <div className="progress-top">

                <span>
                  Overall Score
                </span>

                <span>
                  92%
                </span>

              </div>

              <div className="progress-bar">

                <div className="progress-fill"></div>

              </div>

            </div>

            <div className="analytics-stats">

              <div>

                <h1>
                  #12
                </h1>

                <p>
                  Global Rank
                </p>

              </div>

              <div>

                <h1>
                  95%
                </h1>

                <p>
                  Attendance
                </p>

              </div>

              <div>

                <h1>
                  18
                </h1>

                <p>
                  Projects
                </p>

              </div>

            </div>

          </div>

          {/* RIGHT */}

          <div className="activity-card">

            <h2>
              ⚡ Recent Activity
            </h2>

            <ul>

              <li>
                ✔ React Exam Submitted
              </li>

              <li>
                ✔ Internship Approved
              </li>

              <li>
                ✔ Certificate Generated
              </li>

              <li>
                ✔ Coding Challenge Completed
              </li>

            </ul>

          </div>

        </div>

      </div>

    </div>

  );

}

export default Dashboard;