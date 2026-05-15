import React, {
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import {
  FaRobot,
  FaShieldAlt,
  FaLock,
  FaArrowRight
} from "react-icons/fa";

import "../styles/adminLogin.css";

function AdminLogin() {

  const navigate = useNavigate();

  const [email, setEmail] =
  useState("");

  const [password, setPassword] =
  useState("");

  const handleLogin = (e) => {

    e.preventDefault();

    navigate("/admin/dashboard");

  };

  return (

    <div className="admin-login-page">

      {/* AI BACKGROUND */}

      <div className="admin-bg-circle circle1"></div>
      <div className="admin-bg-circle circle2"></div>
      <div className="admin-bg-circle circle3"></div>

      {/* LEFT SIDE */}

      <div className="admin-left">

        <span className="admin-badge">

          🤖 AI Powered Admin Panel

        </span>

        <h1>

          CyberNet
          <span> Control Center</span>

        </h1>

        <p>

          Secure futuristic admin dashboard
          with AI automation, student management,
          certificate verification and internship control.

        </p>

        <div className="admin-features">

          <div className="admin-feature-card">

            <FaRobot />

            <span>
              AI Automation
            </span>

          </div>

          <div className="admin-feature-card">

            <FaShieldAlt />

            <span>
              Secure Access
            </span>

          </div>

          <div className="admin-feature-card">

            <FaLock />

            <span>
              Data Protection
            </span>

          </div>

        </div>

      </div>

      {/* LOGIN CARD */}

      <div className="admin-login-card">

        <div className="login-glow"></div>

        <h1>

          Admin Login

        </h1>

        <p>

          Access CyberNet AI Dashboard

        </p>

        <form onSubmit={handleLogin}>

          <div className="admin-input-box">

            <input
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={(e)=>
                setEmail(e.target.value)
              }
              required
            />

          </div>

          <div className="admin-input-box">

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e)=>
                setPassword(e.target.value)
              }
              required
            />

          </div>

          <button
            type="submit"
            className="admin-login-btn"
          >

            Login As Admin
            <FaArrowRight />

          </button>

        </form>

      </div>

    </div>

  );

}

export default AdminLogin;