import React from "react";

import { useNavigate } from "react-router-dom";

import "../styles/cybernet.css";

function ExploreExams() {

  const navigate = useNavigate();

  return (

    <div className="explore-page">

      {/* HERO SECTION */}

      <div className="explore-hero">

        <div>

          <h1>
            🚀 Explore CyberNet Programs
          </h1>

          <p>
            Learn about our live exams,
            internship programs,
            certifications and real-world
            career opportunities.
          </p>

        </div>

      </div>

      {/* EXAMS SECTION */}

      <div className="explore-section">

        <h2>
          📝 Available Exams
        </h2>

        <div className="explore-grid">

          <div className="explore-card">

            <h3>
              Frontend Development Exam
            </h3>

            <p>
              HTML, CSS, JavaScript,
              React basics and UI design.
            </p>

            <span>
              Duration: 30 Minutes
            </span>

          </div>

          <div className="explore-card">

            <h3>
              Backend Development Exam
            </h3>

            <p>
              Node.js, Express,
              MongoDB and APIs.
            </p>

            <span>
              Duration: 45 Minutes
            </span>

          </div>

          <div className="explore-card">

            <h3>
              Full Stack Development Exam
            </h3>

            <p>
              Frontend + Backend
              complete technical round.
            </p>

            <span>
              Duration: 60 Minutes
            </span>

          </div>

        </div>

      </div>

      {/* INTERNSHIP SECTION */}

      <div className="explore-section">

        <h2>
          🎯 Internship Programs
        </h2>

        <div className="explore-grid">

          <div className="explore-card">

            <h3>
              Frontend Internship
            </h3>

            <p>
              Build real websites and
              responsive dashboards.
            </p>

            <span>
              Internship Duration:
              1 Month / 3 Months
            </span>

          </div>

          <div className="explore-card">

            <h3>
              Backend Internship
            </h3>

            <p>
              Work on APIs,
              authentication and databases.
            </p>

            <span>
              Internship Duration:
              2 Months / 6 Months
            </span>

          </div>

          <div className="explore-card">

            <h3>
              AI & Automation Internship
            </h3>

            <p>
              Python, AI tools,
              automation projects and bots.
            </p>

            <span>
              Internship Duration:
              3 Months
            </span>

          </div>

        </div>

      </div>

      {/* CERTIFICATION SECTION */}

      <div className="explore-section">

        <h2>
          📜 Certifications
        </h2>

        <div className="explore-grid">

          <div className="explore-card">

            <h3>
              Internship Certificate
            </h3>

            <p>
              Industry-ready verified
              internship certificate.
            </p>

          </div>

          <div className="explore-card">

            <h3>
              Project Completion Certificate
            </h3>

            <p>
              Certificate for real-world
              projects completed successfully.
            </p>

          </div>

          <div className="explore-card">

            <h3>
              Exam Completion Certificate
            </h3>

            <p>
              Get verified certificate after
              passing technical exams.
            </p>

          </div>

        </div>

      </div>

      {/* BUTTON */}

      <div className="explore-btn-section">

        <button
          className="start-explore-btn"
          onClick={() =>
            navigate("/login")
          }
        >

          Start Your Journey

        </button>

      </div>

    </div>

  );

}

export default ExploreExams;