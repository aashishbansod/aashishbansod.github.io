import React from "react";

import logo from "../assets/logo.png";

import {
  FaInstagram,
  FaLinkedin,
  FaGlobe,
  FaRobot,
  FaChartLine,
  FaShieldAlt,
  FaCode,
  FaBrain
} from "react-icons/fa";

import { Link } from "react-router-dom";

import "../styles/home.css";

function Home() {

  return (

    <div className="cyber-home">

      {/* AI BACKGROUND */}

      <div className="ai-bg-circle ai-circle1"></div>
      <div className="ai-bg-circle ai-circle2"></div>
      <div className="ai-bg-circle ai-circle3"></div>

      {/* ================= NAVBAR ================= */}

      <nav className="cyber-navbar">

        <div className="cyber-logo">

          <img
            src={logo}
            alt="CyberNet"
            className="logo-img"
          />

          <div>

            <h1>
              Cyber<span>Net</span>
            </h1>

            <p>
                AI TECHNOLOGY
            </p>

          </div>

        </div>

        <div className="nav-buttons">

          <Link to="/login">

            <button className="student-btn">
              Student Login
            </button>

          </Link>

          <Link to="/admin">

            <button className="admin-btn">
              Admin Login
            </button>

          </Link>

        </div>

      </nav>

      {/* ================= HERO ================= */}

      <section className="hero-section">

        {/* LEFT */}

        <div className="hero-left">

          <div className="ai-badge">
            🤖 AI Powered Education Platform
          </div>

          <h1>

            Future Ready <br />

            <span>
              AI Exam Platform
            </span>

          </h1>

          <p>

            CyberNet Technology is an advanced AI-powered
            online examination, internship and automation
            platform built for developers, students and
            future innovators.

          </p>

          {/* AI TAGS */}

          <div className="ai-tags">

            <div className="tag">
              🚀 AI Automation
            </div>

            <div className="tag">
              💻 Coding Arena
            </div>

            <div className="tag">
              🛡 Cyber Security
            </div>

            <div className="tag">
              📜 Certificates
            </div>

          </div>

          {/* BUTTONS */}

          <div className="hero-actions">

            <Link to="/register">

              <button className="register-btn">
                Register Now
              </button>

            </Link>

            <Link to="/explore">

              <button className="explore-btn">
                Explore Exams
              </button>

            </Link>

          </div>

        </div>

        {/* RIGHT */}

        <div className="hero-right">

          {/* CARD 1 */}

          <div className="ai-card">

            <div className="card-icon blue-card">
              <FaRobot />
            </div>

            <div>

              <h2>
                AI Automation
              </h2>

              <p>
                Smart AI based exams & automation systems
              </p>

            </div>

          </div>

          {/* CARD 2 */}

          <div className="ai-card">

            <div className="card-icon green-card">
              <FaCode />
            </div>

            <div>

              <h2>
                Coding Arena
              </h2>

              <p>
                Real coding challenges & live practice
              </p>

            </div>

          </div>

          {/* CARD 3 */}

          <div className="ai-card">

            <div className="card-icon orange-card">
              <FaShieldAlt />
            </div>

            <div>

              <h2>
                Cyber Security
              </h2>

              <p>
                Ethical hacking & penetration testing labs
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* ================= AI SECTION ================= */}

      <section className="automation-section">

        <div className="automation-left">

          <div className="section-badge">
            ⚡ AI AUTOMATION
          </div>

          <h1>
            Smart AI Automation
          </h1>

          <p>

            Use AI to generate exams, analyze performance,
            manage certificates and automate internship
            systems with futuristic technology.

          </p>

          <div className="automation-features">

            <div className="feature-item">

              <FaBrain className="feature-icon" />

              <div>

                <h3>
                  AI Exam Generator
                </h3>

                <p>
                  Generate smart MCQ & coding exams
                </p>

              </div>

            </div>

            <div className="feature-item">

              <FaChartLine className="feature-icon" />

              <div>

                <h3>
                  Performance Analytics
                </h3>

                <p>
                  AI based student analysis dashboard
                </p>

              </div>

            </div>

            <div className="feature-item">

              <FaShieldAlt className="feature-icon" />

              <div>

                <h3>
                  Secure Verification
                </h3>

                <p>
                  Verify certificates & offer letters
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* AI ORBIT */}

        <div className="automation-right">

          <div className="ai-core">
            AI
          </div>

          <div className="orbit orbit1">
            🤖
          </div>

          <div className="orbit orbit2">
            📊
          </div>

          <div className="orbit orbit3">
            📜
          </div>

          <div className="orbit orbit4">
            💻
          </div>

        </div>

      </section>

      {/* ================= STATS ================= */}

      <section className="stats-section">

        <div className="stat-card">

          <h1>
            10K+
          </h1>

          <p>
            Students Joined
          </p>

        </div>

        <div className="stat-card">

          <h1>
            500+
          </h1>

          <p>
            AI Exams Created
          </p>

        </div>

        <div className="stat-card">

          <h1>
            120+
          </h1>

          <p>
            Hiring Partners
          </p>

        </div>

        <div className="stat-card">

          <h1>
            98%
          </h1>

          <p>
            Success Rate
          </p>

        </div>

      </section>

      {/* ================= FOOTER ================= */}

      <footer className="cyber-footer">

        <div className="footer-grid">

          <div className="footer-box">

            <h2>
              Cyber<span>Net</span>
            </h2>

            <p>

              Future-ready online examination,
              internship and certification platform
              for students and developers.

            </p>

          </div>

          <div className="footer-box">

            <h3>
              Contact Details
            </h3>

            <p>
              📧 cybernet.tech.india@gmail.com
            </p>

            <p>
              📞 +91 8010612993
            </p>

            <p>
              📍 Amravati, Maharashtra
            </p>

          </div>

          <div className="footer-box">

            <h3>
              Services
            </h3>

            <p>
              ✔ Online Exams
            </p>

            <p>
              ✔ AI Automation
            </p>

            <p>
              ✔ Coding Challenges
            </p>

            <p>
              ✔ Internship Programs
            </p>

          </div>

          <div className="footer-box">

            <h3>
              Follow Us
            </h3>

            <p className="social-link">

              <FaGlobe className="footer-icon" />

              www.cybernet.com

            </p>

            <p className="social-link">

              <FaInstagram className="footer-icon" />

              @cyber_net.tech

            </p>

            <p className="social-link">

              <FaLinkedin className="footer-icon" />

              CyberNet Technology

            </p>

          </div>

        </div>

        <div className="footer-bottom">

          © 2026 CyberNet Technology.
          All Rights Reserved.

        </div>

      </footer>

    </div>

  );

}

export default Home;