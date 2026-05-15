import React from "react";

import logo from "../assets/logo.png";

import {
  FaInstagram,
  FaLinkedin,
  FaGlobe
} from "react-icons/fa";

import {
  Link
} from "react-router-dom";

import "../styles/cybernet.css";

function Home() {

  return (

    <>

      {/* ========================= */}
      {/* HERO PAGE */}
      {/* ========================= */}

      <div className="hero-page">

        {/* ========================= */}
        {/* NAVBAR */}
        {/* ========================= */}

        <nav className="navbar">

          {/* LOGO */}

          <div className="logo">

            <img
              src={logo}
              alt="CyberNet Logo"
              className="logo-img"
            />

          </div>

          {/* NAV BUTTONS */}

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

        {/* ========================= */}
        {/* HERO CONTENT */}
        {/* ========================= */}

        <div className="hero-content">

          {/* LEFT SIDE */}

          <div className="hero-left">

            <h1>
              Future Ready <br />

              <span>
                Online Exam Platform
              </span>

            </h1>

            <p>

              CyberNet Technology is a futuristic
              software and internship platform focused
              on coding exams, AI automation,
              web development and real-world projects.

            </p>

            {/* ACTION BUTTONS */}

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

          {/* RIGHT SIDE */}

          <div className="hero-right">

            {/* CARD 1 */}

            <div className="hero-card">

              <h2>
                🚀 Live Hiring
              </h2>

              <p>
                Frontend Developer Internship
              </p>

              <span>
                Apply Now
              </span>

            </div>

            {/* CARD 2 */}

            <div className="hero-card">

              <h2>
                💻 Coding Arena
              </h2>

              <p>
                Real Coding Challenges
              </p>

              <span>
                Start Practice
              </span>

            </div>

            {/* CARD 3 */}

            <div className="hero-card">

              <h2>
                📜 Certificates
              </h2>

              <p>
                Verified Internship Certificates
              </p>

              <span>
                Download
              </span>

            </div>

          </div>

        </div>

      </div>

      {/* ========================= */}
      {/* FOOTER */}
      {/* ========================= */}

      <footer className="cybernet-footer">

        <div className="footer-grid">

          {/* COMPANY */}

          <div className="footer-box">

            <h2>
              CyberNet 🚀
            </h2>

            <p>

              Future-ready online examination,
              internship and certification platform
              for students and developers.

            </p>

          </div>

          {/* CONTACT */}

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

          {/* SERVICES */}

          <div className="footer-box">

            <h3>
              Services
            </h3>

            <p>
              ✔ Online Exams
            </p>

            <p>
              ✔ Internship Programs
            </p>

            <p>
              ✔ Coding Challenges
            </p>

            <p>
              ✔ Certificates
            </p>

          </div>

          {/* SOCIAL */}

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

        {/* FOOTER BOTTOM */}

        <div className="footer-bottom">

          © 2026 CyberNet Technology.
          All Rights Reserved.

        </div>

      </footer>

    </>

  );

}

export default Home;