import React, { useState } from "react";

import {
  Link,
  useNavigate
} from "react-router-dom";

import API from "../api/api";

import "../styles/login.css";

function Login() {

  const navigate = useNavigate();

  const [loading, setLoading] =
  useState(false);

  const [email, setEmail] =
  useState("");

  const [password, setPassword] =
  useState("");

  /* ========================= */
  /* LOGIN */
  /* ========================= */

  const handleLogin = async (e) => {

    e.preventDefault();

    setLoading(true);

    try{

      const response =
      await API.post(

        "/auth/login",

        {

          email,
          password

        }

      );

      /* SAVE TOKEN */

      localStorage.setItem(

        "token",

        response.data.token

      );

      /* SAVE USER */

      localStorage.setItem(

        "user",

        JSON.stringify(
          response.data.user
        )

      );

      alert(
        "✅ Login Successful"
      );

      setLoading(false);

      navigate("/dashboard");

    }

    catch(error){

      setLoading(false);

      alert(

        error?.response?.data?.message ||

        "Login Failed"

      );

    }

  };

  return (

    <div className="login-page">

      {/* ========================= */}
      {/* LEFT SIDE */}
      {/* ========================= */}

      <div className="login-left">

        <div className="login-overlay"></div>

        <div className="login-brand">

          <div className="login-badge">

            🚀 AI Powered Career Platform

          </div>

          <h1>

            CyberNet

            <span>

              Portal

            </span>

          </h1>

          <p>

            India’s futuristic internship,
            coding exam and AI automation
            platform for students,
            developers and innovators.

          </p>

        </div>

        {/* FEATURES */}

        <div className="login-info-box">

          <h2>

            🎯 Why Join CyberNet?

          </h2>

          <ul>

            <li>
              🚀 Real Internship Projects
            </li>

            <li>
              📜 Verified Certificates
            </li>

            <li>
              🧠 AI Powered Dashboard
            </li>

            <li>
              ⚡ Coding Challenges
            </li>

            <li>
              🤖 AI Automation Training
            </li>

            <li>
              🔐 Cyber Security Labs
            </li>

            <li>
              🌟 Student Hiring Program
            </li>

            <li>
              💼 Career Growth System
            </li>

          </ul>

        </div>

      </div>

      {/* ========================= */}
      {/* RIGHT SIDE */}
      {/* ========================= */}

      <div className="login-right">

        <form
          className="login-box"
          onSubmit={handleLogin}
        >

          {/* TOP */}

          <div className="login-top">

            <div className="login-ai-tag">

              🤖 AI Secure Login

            </div>

            <h1>

              Student Login

            </h1>

            <p>

              Login to continue your
              CyberNet journey

            </p>

          </div>

          {/* EMAIL */}

          <div className="input-group">

            <label>

              Email Address

            </label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e)=>
                setEmail(
                  e.target.value
                )
              }
              required
            />

          </div>

          {/* PASSWORD */}

          <div className="input-group">

            <label>

              Password

            </label>

            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e)=>
                setPassword(
                  e.target.value
                )
              }
              required
            />

          </div>

          {/* OPTIONS */}

          <div className="login-options">

            <div className="remember-box">

              <input
                type="checkbox"
                id="remember"
              />

              <label htmlFor="remember">

                Remember Me

              </label>

            </div>

            <span className="forgot-password">

              Forgot Password?

            </span>

          </div>

          {/* BUTTON */}

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >

            {

              loading

              ?

              "Logging In..."

              :

              "🚀 Login Now"

            }

          </button>

          {/* REGISTER */}

          <div className="login-link">

            Don’t have an account?

            <Link to="/register">

              <span>

                Register

              </span>

            </Link>

          </div>

        </form>

      </div>

    </div>

  );

}

export default Login;