import React from "react";

import {
  FaCode,
  FaServer,
  FaLaptopCode,
  FaRobot,
  FaCertificate,
  FaArrowRight
} from "react-icons/fa";

import "../styles/explore.css";

function ExploreExams() {

  return (

    <div className="explore-page">

      {/* HERO */}

      <div className="explore-hero">

        <div className="explore-left">

          <span className="explore-badge">
            🚀 AI Powered Learning Platform
          </span>

          <h1>

            Explore
            <span> CyberNet </span>
            Programs

          </h1>

          <p>

            Join futuristic internship programs,
            coding exams, AI automation projects
            and industry-ready technical training.

          </p>

          <button className="explore-main-btn">

            Start Your Journey
            <FaArrowRight />

          </button>

        </div>

        <div className="explore-right">

          <div className="ai-circle"></div>

          <div className="floating-card card1">

            🤖 AI Automation

          </div>

          <div className="floating-card card2">

            💻 Coding Arena

          </div>

          <div className="floating-card card3">

            🚀 Internship

          </div>

        </div>

      </div>

      {/* EXAMS */}

      <div className="explore-section">

        <div className="section-title">

          <h1>
            📄 Available Exams
          </h1>

          <p>
            Industry-level assessments
            for real-world skills.
          </p>

        </div>

        <div className="explore-grid">

          <div className="explore-card">

            <div className="explore-icon blue">

              <FaCode />

            </div>

            <h2>
              Frontend Development
            </h2>

            <p>

              HTML, CSS, JavaScript,
              React basics and UI design.

            </p>

            <span>
              ⏰ Duration: 30 Minutes
            </span>

          </div>

          <div className="explore-card">

            <div className="explore-icon purple">

              <FaServer />

            </div>

            <h2>
              Backend Development
            </h2>

            <p>

              Node.js, Express,
              MongoDB and APIs.

            </p>

            <span>
              ⏰ Duration: 45 Minutes
            </span>

          </div>

          <div className="explore-card">

            <div className="explore-icon orange">

              <FaLaptopCode />

            </div>

            <h2>
              Full Stack Development
            </h2>

            <p>

              Frontend + Backend
              complete technical round.

            </p>

            <span>
              ⏰ Duration: 60 Minutes
            </span>

          </div>

        </div>

      </div>

      {/* INTERNSHIP */}

      <div className="explore-section">

        <div className="section-title">

          <h1>
            🎯 Internship Programs
          </h1>

          <p>
            Build real-world projects
            with AI-powered learning.
          </p>

        </div>

        <div className="explore-grid">

          <div className="explore-card">

            <div className="explore-icon blue">

              💻

            </div>

            <h2>
              Frontend Internship
            </h2>

            <p>

              Build responsive websites,
              dashboards and UI systems.

            </p>

            <span>
              🗓 Duration: 1 / 3 Months
            </span>

          </div>

          <div className="explore-card">

            <div className="explore-icon green">

              ⚡

            </div>

            <h2>
              Backend Internship
            </h2>

            <p>

              APIs, authentication,
              databases and servers.

            </p>

            <span>
              🗓 Duration: 2 / 6 Months
            </span>

          </div>

          <div className="explore-card">

            <div className="explore-icon purple">

              <FaRobot />

            </div>

            <h2>
              AI & Automation
            </h2>

            <p>

              AI tools, automation bots,
              Python and smart systems.

            </p>

            <span>
              🗓 Duration: 3 Months
            </span>

          </div>

        </div>

      </div>

      {/* CERTIFICATES */}

      <div className="explore-section">

        <div className="section-title">

          <h1>
            📜 Certifications
          </h1>

          <p>
            Industry-ready verified certificates.
          </p>

        </div>

        <div className="explore-grid">

          <div className="explore-card">

            <div className="explore-icon blue">

              <FaCertificate />

            </div>

            <h2>
              Internship Certificate
            </h2>

            <p>

              Verified certificate
              after internship completion.

            </p>

          </div>

          <div className="explore-card">

            <div className="explore-icon orange">

              🏆

            </div>

            <h2>
              Project Certificate
            </h2>

            <p>

              Real-world project
              completion verification.

            </p>

          </div>

          <div className="explore-card">

            <div className="explore-icon purple">

              🚀

            </div>

            <h2>
              Exam Certificate
            </h2>

            <p>

              Technical assessment
              completion certificate.

            </p>

          </div>

        </div>

      </div>

    </div>

  );

}

export default ExploreExams;