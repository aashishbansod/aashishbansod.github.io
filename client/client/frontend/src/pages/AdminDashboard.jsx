import React from "react";

import { useNavigate } from "react-router-dom";

import "../styles/cybernet.css";

function AdminDashboard() {

  const navigate = useNavigate();

  return (

    <div className="admin-dashboard">

      {/* SIDEBAR */}

      <div className="admin-sidebar">

        <div>

          <h1 className="admin-logo">
            CyberNet
          </h1>

          <ul className="admin-menu">

            <li>
              <a
                href="#"
                className="active-admin-link"
              >
                📊 Dashboard
              </a>
            </li>

            <li>
              <a href="#">
                👨‍🎓 Students
              </a>
            </li>

            <li>
              <a href="#">
                📝 Exams
              </a>
            </li>

            <li>
              <a href="#">
                📜 Certificates
              </a>
            </li>

            <li>
              <a href="#">
                ⚙ Settings
              </a>
            </li>

          </ul>

        </div>

      </div>

      {/* MAIN */}

      <div className="admin-main">

        {/* TOPBAR */}

        <div className="admin-topbar">

          <div>

            <h1>
              Admin Dashboard
            </h1>

            <p>
              Manage students,
              exams and certificates.
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

        {/* STATS */}

        <div className="admin-stats">

          <div className="admin-stat-card">

            <h3>
              Total Students
            </h3>

            <h1>
              120
            </h1>

          </div>

          <div className="admin-stat-card">

            <h3>
              Total Exams
            </h3>

            <h1>
              15
            </h1>

          </div>

          <div className="admin-stat-card">

            <h3>
              Certificates
            </h3>

            <h1>
              98
            </h1>

          </div>

        </div>

        {/* ACTION */}

        <div className="admin-action-card">

          <h2>
            Create New Exam
          </h2>

          <p>
            Add MCQ exams,
            coding rounds and
            technical assessments
            for students.
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

      </div>

    </div>

  );

}

export default AdminDashboard;