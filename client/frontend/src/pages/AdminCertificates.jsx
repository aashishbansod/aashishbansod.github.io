import React, { useState } from "react";

import {
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaRobot,
  FaFileAlt,
  FaUserGraduate,
  FaClock,
  FaShieldAlt
} from "react-icons/fa";

import "../styles/adminCertificates.css";

function AdminCertificates() {

  const [search, setSearch] = useState("");

  const [requests, setRequests] = useState([

    {
      id: 1,
      fullName: "Aashish",
      email: "aashish@gmail.com",
      college: "SGBAU University",
      course: "B.Sc Computer Application",
      certificateId: "CYBER-2026-001",
      domain: "Frontend Development",
      duration: "3 Months",
      project: "CyberNet AI Platform",
      status: "Pending"
    },

    {
      id: 2,
      fullName: "Rahul",
      email: "rahul@gmail.com",
      college: "Pune University",
      course: "BCA",
      certificateId: "CYBER-2026-002",
      domain: "Backend Development",
      duration: "6 Months",
      project: "AI Exam Generator",
      status: "Approved"
    },

    {
      id: 3,
      fullName: "Priya",
      email: "priya@gmail.com",
      college: "Nagpur College",
      course: "B.Tech",
      certificateId: "CYBER-2026-003",
      domain: "AI Automation",
      duration: "2 Months",
      project: "AI Chatbot",
      status: "Rejected"
    }

  ]);

  // =========================
  // APPROVE
  // =========================

  const approveRequest = (id) => {

    const updated = requests.map((item) =>

      item.id === id
        ? { ...item, status: "Approved" }
        : item

    );

    setRequests(updated);

  };

  // =========================
  // REJECT
  // =========================

  const rejectRequest = (id) => {

    const updated = requests.map((item) =>

      item.id === id
        ? { ...item, status: "Rejected" }
        : item

    );

    setRequests(updated);

  };

  // =========================
  // SEARCH FILTER
  // =========================

  const filteredRequests = requests.filter((item) =>

    item.fullName
      .toLowerCase()
      .includes(search.toLowerCase())

  );

  return (

    <div className="admin-certificates-page">

      {/* BACKGROUND EFFECT */}

      <div className="admin-bg admin-bg1"></div>
      <div className="admin-bg admin-bg2"></div>

      {/* HEADER */}

      <div className="admin-certificates-header">

        <div>

          <div className="admin-ai-badge">

            🤖 AI Certificate Verification

          </div>

          <h1>

            Student Certificate Requests

          </h1>

          <p>

            Manage internship certificates,
            approve requests and monitor AI verification.

          </p>

        </div>

        {/* SEARCH */}

        <div className="certificate-search-box">

          <FaSearch />

          <input
            type="text"
            placeholder="Search Student..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

        </div>

      </div>

      {/* STATS */}

      <div className="certificate-stats">

        <div className="certificate-stat-card blue">

          <FaFileAlt />

          <div>

            <h2>
              120+
            </h2>

            <p>
              Total Requests
            </p>

          </div>

        </div>

        <div className="certificate-stat-card green">

          <FaCheckCircle />

          <div>

            <h2>
              98
            </h2>

            <p>
              Approved
            </p>

          </div>

        </div>

        <div className="certificate-stat-card orange">

          <FaClock />

          <div>

            <h2>
              14
            </h2>

            <p>
              Pending
            </p>

          </div>

        </div>

        <div className="certificate-stat-card purple">

          <FaShieldAlt />

          <div>

            <h2>
              AI Secure
            </h2>

            <p>
              Verification Enabled
            </p>

          </div>

        </div>

      </div>

      {/* REQUESTS */}

      <div className="requests-container">

        {

          filteredRequests.map((item) => (

            <div
              className="request-card"
              key={item.id}
            >

              {/* TOP */}

              <div className="request-top">

                <div className="student-info">

                  <div className="student-avatar">

                    <FaUserGraduate />

                  </div>

                  <div>

                    <h2>
                      {item.fullName}
                    </h2>

                    <p>
                      {item.email}
                    </p>

                  </div>

                </div>

                {/* STATUS */}

                <div
                  className={`status-badge ${
                    item.status.toLowerCase()
                  }`}
                >

                  {item.status}

                </div>

              </div>

              {/* DETAILS */}

              <div className="request-details">

                <div>

                  <span>
                    College
                  </span>

                  <h4>
                    {item.college}
                  </h4>

                </div>

                <div>

                  <span>
                    Course
                  </span>

                  <h4>
                    {item.course}
                  </h4>

                </div>

                <div>

                  <span>
                    Certificate ID
                  </span>

                  <h4>
                    {item.certificateId}
                  </h4>

                </div>

                <div>

                  <span>
                    Domain
                  </span>

                  <h4>
                    {item.domain}
                  </h4>

                </div>

                <div>

                  <span>
                    Duration
                  </span>

                  <h4>
                    {item.duration}
                  </h4>

                </div>

                <div>

                  <span>
                    Project
                  </span>

                  <h4>
                    {item.project}
                  </h4>

                </div>

              </div>

              {/* AI VERIFICATION */}

              <div className="ai-verification-box">

                <FaRobot />

                AI Verification Completed Successfully

              </div>

              {/* BUTTONS */}

              <div className="request-actions">

                <button
                  className="approve-btn"
                  onClick={() =>
                    approveRequest(item.id)
                  }
                >

                  <FaCheckCircle />

                  Approve

                </button>

                <button
                  className="reject-btn"
                  onClick={() =>
                    rejectRequest(item.id)
                  }
                >

                  <FaTimesCircle />

                  Reject

                </button>

              </div>

            </div>

          ))

        }

      </div>

    </div>

  );

}

export default AdminCertificates;