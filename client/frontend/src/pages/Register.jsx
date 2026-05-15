import React, { useState } from "react";

import {
  Link,
  useNavigate
} from "react-router-dom";

import API from "../api/api";

import "../styles/register.css";

function Register() {

  const navigate = useNavigate();

  const [loading, setLoading] =
  useState(false);

  const [formData, setFormData] =
  useState({

    fullName:"",
    email:"",
    mobile:"",
    college:"",
    course:"",
    password:""

  });

  /* ========================= */
  /* HANDLE INPUT */
  /* ========================= */

  const handleChange = (e) => {

    setFormData({

      ...formData,

      [e.target.name]:
      e.target.value

    });

  };

  /* ========================= */
  /* REGISTER */
  /* ========================= */

  const handleRegister = async (e) => {

    e.preventDefault();

    setLoading(true);

    try{

      const response =
      await API.post(

        "/auth/register",

        {

          name:
          formData.fullName,

          email:
          formData.email,

          password:
          formData.password,

          mobile:
          formData.mobile,

          college:
          formData.college,

          course:
          formData.course

        }

      );

      alert(
        "✅ Registration Successful"
      );

      setLoading(false);

      navigate("/login");

    }

    catch(error){

      setLoading(false);

      alert(

        error?.response?.data?.message ||

        "Registration Failed"

      );

    }

  };

  return (

    <div className="register-page">

      {/* ========================= */}
      {/* LEFT SIDE */}
      {/* ========================= */}

      <div className="register-left">

        <div className="register-overlay"></div>

        <div className="register-content">

          <div className="register-badge">

            🚀 AI Powered Student Portal

          </div>

          <h1>

            CyberNet

            <span>
              Exam Portal
            </span>

          </h1>

          <p>

            India’s futuristic internship,
            AI automation and online exam
            platform for students,
            developers and innovators.

          </p>

        </div>

        {/* FEATURES */}

        <div className="register-feature-box">

          <h2>

            🎯 Student Hiring Programs

          </h2>

          <ul>

            <li>
              💻 Frontend Development
            </li>

            <li>
              ⚡ Backend Development
            </li>

            <li>
              🎨 UI / UX Designing
            </li>

            <li>
              📱 Android Development
            </li>

            <li>
              🤖 AI Automation Projects
            </li>

            <li>
              🔐 Cyber Security Training
            </li>

            <li>
              🚀 Internship + Live Projects
            </li>

            <li>
              📜 AI Verified Certificates
            </li>

          </ul>

        </div>

      </div>

      {/* ========================= */}
      {/* RIGHT SIDE */}
      {/* ========================= */}

      <div className="register-right">

        <form
          className="register-box"
          onSubmit={handleRegister}
        >

          {/* TOP */}

          <div className="register-top">

            <div className="register-ai">

              🤖 AI Registration System

            </div>

            <h1>

              Create Account

            </h1>

            <p>

              Register for CyberNet
              Internship & Exam Portal

            </p>

          </div>

          {/* INPUT GRID */}

          <div className="register-grid">

            <input
              type="text"
              name="fullName"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={handleChange}
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <input
              type="text"
              name="mobile"
              placeholder="Mobile Number"
              value={formData.mobile}
              onChange={handleChange}
              required
            />

            <input
              type="text"
              name="college"
              placeholder="College Name"
              value={formData.college}
              onChange={handleChange}
              required
            />

            <input
              type="text"
              name="course"
              placeholder="Course / Branch"
              value={formData.course}
              onChange={handleChange}
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Create Password"
              value={formData.password}
              onChange={handleChange}
              required
            />

          </div>

          {/* TERMS */}

          <div className="register-terms">

            <input
              type="checkbox"
              required
            />

            <span>

              I agree to CyberNet
              Terms & Privacy Policy

            </span>

          </div>

          {/* BUTTON */}

          <button
            type="submit"
            className="register-submit-btn"
            disabled={loading}
          >

            {

              loading

              ?

              "Creating Account..."

              :

              "🚀 Register Now"

            }

          </button>

          {/* LOGIN LINK */}

          <div className="register-login-link">

            Already have an account?

            <Link to="/login">

              <span>

                Login

              </span>

            </Link>

          </div>

        </form>

      </div>

    </div>

  );

}

export default Register;