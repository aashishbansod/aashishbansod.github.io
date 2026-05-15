import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginUser = (e) => {

    e.preventDefault();

    if(email && password){

      localStorage.setItem("token", "cybernetuser");

      navigate("/dashboard");

    }

  };

  return (

    <div className="auth-page">

      {/* LEFT SIDE */}

      <div className="auth-left">

        <h1>
          CyberNet Portal 🚀
        </h1>

        <p className="main-text">

          India's futuristic internship and examination platform
          for students, developers and innovators.

        </p>

        <div className="hiring-box">

          <h2>🚀 Why Join CyberNet?</h2>

          <ul>

            <li>💻 Real Internship Projects</li>

            <li>📜 Verified Certificates</li>

            <li>🧠 AI Based Dashboard</li>

            <li>⚡ Coding Challenges</li>

            <li>🎯 Student Hiring Program</li>

            <li>🌟 Build Your Tech Career</li>

          </ul>

        </div>

      </div>

      {/* RIGHT SIDE */}

      <div className="auth-right">

        <form
          className="auth-card"
          onSubmit={loginUser}
        >

          <h1>
            Student Login
          </h1>

          <p>
            Login to continue your journey
          </p>

          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />

          <button type="submit">
            Login Now
          </button>

          <span>

            Don’t have account?

            <Link to="/register">
              Register
            </Link>

          </span>

        </form>

      </div>

    </div>

  );

}

export default Login;