import React from "react";
import { useNavigate } from "react-router-dom";

import "../styles/admin.css";

function AdminLogin() {

  const navigate = useNavigate();

  const loginAdmin = () => {

    localStorage.setItem("adminToken", "cybernetadmin");

    navigate("/admin/dashboard");

  };

  return (

    <div className="admin-login-page">

      <div className="admin-login-box">

        <h1>
          Admin Login
        </h1>

        <p>
          Secure Admin Control Panel
        </p>

        <input
          type="email"
          placeholder="Admin Email"
        />

        <input
          type="password"
          placeholder="Password"
        />

        <button onClick={loginAdmin}>
          Login As Admin
        </button>

      </div>

    </div>

  );

}

export default AdminLogin;