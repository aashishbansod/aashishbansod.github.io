import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import {
  FaRocket,
  FaShieldAlt,
  FaCertificate,
  FaUserGraduate,
  FaBrain,
  FaEye,
  FaEyeSlash,
  FaLaptopCode,
} from "react-icons/fa";

const API_URL =
  "http://localhost:5000/api/auth";

function Login() {

  const navigate = useNavigate();

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [formData, setFormData] =
    useState({
      email: "",
      password: "",
      rememberMe: false,
    });

  useEffect(() => {

    const token =
      localStorage.getItem("token");

    if (token) {
      navigate(
        "/student/dashboard"
      );
    }

  }, [navigate]);

  const handleChange = (e) => {

    const {
      name,
      value,
      checked,
      type,
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    try {

      setLoading(true);

      const response =
        await axios.post(
          `${API_URL}/login`,
          {
            email:
              formData.email,
            password:
              formData.password,
          }
        );

      if (
        response.data.success
      ) {

        const {
          token,
          student,
        } = response.data;

        localStorage.setItem(
          "token",
          token
        );

        localStorage.setItem(
          "student",
          JSON.stringify(student)
        );

        toast.success(
          `Welcome ${
            student.firstName ||
            "Student"
          } 🚀`
        );

        setTimeout(() => {

          navigate(
            "/student/dashboard"
          );

        }, 1000);

      }

    } catch (error) {

      toast.error(
        error?.response?.data
          ?.message ||
          "Login Failed"
      );

    } finally {

      setLoading(false);

    }
  };

  const handleForgotPassword =
    () => {

      toast(
        "Forgot Password Module Coming Soon"
      );

    };

  return (

    <div className="min-h-screen bg-slate-100 flex">

      {/* LEFT SIDE */}

      <div
        className="
        hidden
        lg:flex
        lg:w-1/2
        relative
        bg-gradient-to-br
        from-slate-950
        via-blue-950
        to-cyan-900
        text-white
        "
      >

        {/* BACKGROUND GLOW */}

        <div className="absolute inset-0">

          <div
            className="
            absolute
            top-20
            left-20
            w-[450px]
            h-[450px]
            bg-cyan-500/20
            rounded-full
            blur-[150px]
            "
          />

          <div
            className="
            absolute
            bottom-0
            right-0
            w-[500px]
            h-[500px]
            bg-blue-500/20
            rounded-full
            blur-[180px]
            "
          />

        </div>

        <div
          className="
          relative
          z-10
          flex
          flex-col
          justify-center
          px-16
          "
        >

          {/* LOGO */}

          <div className="flex items-center gap-5 mb-12">

            <div
              className="
              w-20
              h-20
              rounded-3xl
              bg-gradient-to-br
              from-blue-500
              via-cyan-400
              to-purple-500
              flex
              items-center
              justify-center
              text-3xl
              font-black
              shadow-2xl
              "
            >
              CN
            </div>

            <div>

              <h1 className="text-5xl font-black">
                CyberNet
              </h1>

              <p className="text-cyan-300 font-semibold">
                Technology Systems
              </p>

            </div>

          </div>

          {/* HERO */}

          <h2
            className="
            text-6xl
            font-black
            leading-tight
            mb-8
            "
          >
            Learn.
            <br />
            Build.
            <br />
            Get Hired.
          </h2>

          <p
            className="
            text-slate-300
            text-xl
            leading-9
            mb-14
            "
          >
            CyberNet helps students gain
            practical experience through
            internships, industry projects,
            assessments and verified
            certificates.
          </p>

          {/* STATS */}

          <div className="grid grid-cols-2 gap-6">
                        <div
              className="
              bg-white/10
              backdrop-blur-xl
              border
              border-white/20
              rounded-3xl
              p-6
              "
            >

              <FaUserGraduate
                className="
                text-cyan-400
                text-4xl
                mb-4
                "
              />

              <h3 className="text-5xl font-black">
                2500+
              </h3>

              <p className="text-slate-300 mt-2">
                Active Learners
              </p>

            </div>

            <div
              className="
              bg-white/10
              backdrop-blur-xl
              border
              border-white/20
              rounded-3xl
              p-6
              "
            >

              <FaRocket
                className="
                text-cyan-400
                text-4xl
                mb-4
                "
              />

              <h3 className="text-5xl font-black">
                30+
              </h3>

              <p className="text-slate-300 mt-2">
                Career Tracks
              </p>

            </div>

            <div
              className="
              bg-white/10
              backdrop-blur-xl
              border
              border-white/20
              rounded-3xl
              p-6
              "
            >

              <FaLaptopCode
                className="
                text-cyan-400
                text-4xl
                mb-4
                "
              />

              <h3 className="text-5xl font-black">
                300+
              </h3>

              <p className="text-slate-300 mt-2">
                Projects Completed
              </p>

            </div>

            <div
              className="
              bg-white/10
              backdrop-blur-xl
              border
              border-white/20
              rounded-3xl
              p-6
              "
            >

              <FaCertificate
                className="
                text-cyan-400
                text-4xl
                mb-4
                "
              />

              <h3 className="text-5xl font-black">
                24/7
              </h3>

              <p className="text-slate-300 mt-2">
                Student Support
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* RIGHT SIDE */}

      <div
        className="
        w-full
        lg:w-1/2
        flex
        items-center
        justify-center
        p-8
        "
      >

        <div className="w-full max-w-xl">

          <div
            className="
            bg-white
            rounded-[40px]
            shadow-2xl
            border
            border-slate-200
            p-10
            "
          >

            {/* HEADER */}

            <div className="text-center mb-8">

              <div
                className="
                inline-flex
                items-center
                justify-center
                w-20
                h-20
                rounded-3xl
                bg-gradient-to-r
                from-blue-600
                to-cyan-500
                text-white
                text-3xl
                shadow-xl
                mb-5
                "
              >
                <FaShieldAlt />
              </div>

              <h1
                className="
                text-5xl
                font-black
                text-slate-900
                "
              >
                Student Login
              </h1>

              <p
                className="
                text-slate-500
                mt-3
                text-lg
                "
              >
                Access your dashboard,
                assessments, certificates
                and internship progress.
              </p>

            </div>

            {/* SECURITY BADGE */}

            <div
              className="
              mb-8
              px-4
              py-3
              rounded-2xl
              bg-green-50
              border
              border-green-200
              text-green-700
              text-sm
              font-semibold
              text-center
              "
            >
              🔒 Secure Login Protected By CyberNet
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >

              {/* EMAIL */}

              <div>

                <label
                  className="
                  block
                  mb-2
                  font-bold
                  text-slate-700
                  "
                >
                  Email Address
                </label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  required
                  className="
                  w-full
                  h-16
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  focus:border-blue-500
                  "
                />

              </div>

              {/* PASSWORD */}

              <div>

                <label
                  className="
                  block
                  mb-2
                  font-bold
                  text-slate-700
                  "
                >
                  Password
                </label>

                <div className="relative">

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    className="
                    w-full
                    h-16
                    px-5
                    pr-14
                    rounded-2xl
                    border
                    border-slate-300
                    outline-none
                    focus:border-blue-500
                    "
                  />
                                    <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="
                    absolute
                    right-5
                    top-1/2
                    -translate-y-1/2
                    text-slate-500
                    hover:text-blue-600
                    transition-all
                    "
                  >
                    {showPassword ? (
                      <FaEyeSlash />
                    ) : (
                      <FaEye />
                    )}
                  </button>

                </div>

              </div>

              {/* REMEMBER & FORGOT */}

              <div
                className="
                flex
                items-center
                justify-between
                "
              >

                <label
                  className="
                  flex
                  items-center
                  gap-3
                  text-sm
                  text-slate-600
                  "
                >

                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={
                      formData.rememberMe
                    }
                    onChange={handleChange}
                    className="
                    w-4
                    h-4
                    accent-blue-600
                    "
                  />

                  Remember Me

                </label>

                <button
                  type="button"
                  onClick={
                    handleForgotPassword
                  }
                  className="
                  text-blue-600
                  font-semibold
                  hover:text-blue-800
                  transition-all
                  "
                >
                  Forgot Password?
                </button>

              </div>

              {/* LOGIN BUTTON */}

              <button
                type="submit"
                disabled={loading}
                className="
                w-full
                h-16
                rounded-2xl
                text-white
                text-lg
                font-bold
                bg-gradient-to-r
                from-blue-600
                via-cyan-500
                to-blue-600
                shadow-[0_15px_40px_rgba(37,99,235,0.35)]
                hover:-translate-y-1
                hover:shadow-[0_20px_50px_rgba(37,99,235,0.45)]
                transition-all
                duration-300
                disabled:opacity-70
                disabled:hover:translate-y-0
                "
              >
                {loading
                  ? "Logging In..."
                  : "Login To Dashboard"}
              </button>

            </form>

            {/* BENEFITS */}

            <div
              className="
              mt-8
              p-6
              rounded-3xl
              bg-blue-50
              border
              border-blue-100
              "
            >

              <h3
                className="
                text-lg
                font-bold
                text-slate-900
                mb-4
                " align="center"
              >
                Access Internship Dashboard
              </h3>

            

            </div>

            {/* REGISTER LINK */}

            <div className="text-center mt-8">

              <p className="text-slate-600">

                Don't have an account?

                <Link
                  to="/register"
                  className="
                  ml-2
                  text-blue-600
                  font-bold
                  hover:text-blue-800
                  "
                >
                  Create Account
                </Link>

              </p>

            </div>
                        {/* FEATURE CARDS */}

            <div className="grid grid-cols-3 gap-3 mt-10">

              <div
                className="
                bg-slate-50
                rounded-2xl
                p-4
                text-center
                border
                border-slate-100
                hover:border-cyan-200
                hover:bg-cyan-50
                transition-all
                "
              >

                <FaBrain
                  className="
                  mx-auto
                  text-cyan-500
                  text-2xl
                  mb-2
                  "
                />

                <p
                  className="
                  text-xs
                  font-semibold
                  text-slate-700
                  "
                >
                  Assessments
                </p>

              </div>

              <div
                className="
                bg-slate-50
                rounded-2xl
                p-4
                text-center
                border
                border-slate-100
                hover:border-blue-200
                hover:bg-blue-50
                transition-all
                "
              >

                <FaRocket
                  className="
                  mx-auto
                  text-blue-500
                  text-2xl
                  mb-2
                  "
                />

                <p
                  className="
                  text-xs
                  font-semibold
                  text-slate-700
                  "
                >
                  Projects
                </p>

              </div>

              <div
                className="
                bg-slate-50
                rounded-2xl
                p-4
                text-center
                border
                border-slate-100
                hover:border-green-200
                hover:bg-green-50
                transition-all
                "
              >

                <FaCertificate
                  className="
                  mx-auto
                  text-green-500
                  text-2xl
                  mb-2
                  "
                />

                <p
                  className="
                  text-xs
                  font-semibold
                  text-slate-700
                  "
                >
                  Certificates
                </p>

              </div>

            </div>

            {/* FOOTER NOTE */}

            <div
              className="
              mt-8
              text-center
              text-xs
              text-slate-400
              "
            >
              © 2026 CyberNet Technology Systems.
              All Rights Reserved.
            </div>

          </div>

        </div>

      </div>

    </div>

  );
}

export default Login;