import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name:"",
    email:"",
    mobile:"",
    college:"",
    course:"",
    password:""
  });

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]:e.target.value
    });

  };

  const registerUser = (e) => {

    e.preventDefault();

    localStorage.setItem(
      "token",
      "cybernetuser"
    );

    navigate("/dashboard");

  };

  return (

    <div className="auth-page">

      {/* LEFT SIDE */}

      <div className="auth-left">

        <h1>
          CyberNet Exam Portal 🚀
        </h1>

        <p className="main-text">

          India's futuristic internship and examination
          platform for students, developers and innovators.

        </p>

        <div className="hiring-box">

          <h2>
            🎯 Student Hiring Program
          </h2>

          <ul>

            <li>💻 Frontend Development</li>

            <li>⚡ Backend Development</li>

            <li>🎨 UI / UX Designing</li>

            <li>📱 Android App Development</li>

            <li>🤖 AI & Automation Projects</li>

            <li>🚀 Internship + Certificate + Real Projects</li>

          </ul>

        </div>

      </div>

      {/* RIGHT SIDE */}

      <div className="auth-right">

        <form
          className="auth-card"
          onSubmit={registerUser}
        >

          <h1>
            Create Account
          </h1>

          <p>
            Register for CyberNet Portal
          </p>

          <input
            type="text"
            name="name"
            placeholder="Full Name"
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="mobile"
            placeholder="Mobile Number"
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="college"
            placeholder="College Name"
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="course"
            placeholder="Course / Branch"
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Create Password"
            onChange={handleChange}
            required
          />

          <button type="submit">
            Register Now
          </button>

          <span>

            Already have account?

            <Link to="/login">
              Login
            </Link>

          </span>

        </form>

      </div>

    </div>

  );

}

export default Register;