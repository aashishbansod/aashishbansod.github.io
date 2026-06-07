import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import {
  FaUserGraduate,
  FaBrain,
  FaUserShield,
  FaEye,
  FaEyeSlash,
  FaBriefcase,
  FaRocket,
  FaLaptopCode,
  FaShieldAlt,
  FaCertificate,
  FaChartLine,
} from "react-icons/fa";

function Register() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword,
    setShowConfirmPassword] =
    useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",

    // Required Backend Fields
    collegeName: "Student",
    course: "Student",

    currentYear: "",
    internshipDomain: "",

    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      formData.password !==
      formData.confirmPassword
    ) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        "http://localhost:5000/api/auth/register",
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          mobile: formData.mobile,

          // Fixed Values
          collegeName: "Student",
          course: "Student",

          currentYear:
            formData.currentYear,

          internshipDomain:
            formData.internshipDomain,

          password:
            formData.password,
        }
      );

      if (response.data.success) {
        toast.success(
          "Registration Successful 🎉"
        );

        navigate("/login");
      }

    } catch (error) {

      toast.error(
        error.response?.data?.message ||
        "Registration Failed"
      );

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">

      {/* LEFT PANEL START */}

      <div
        className="
        hidden
        lg:flex
        lg:w-1/2
        min-h-screen
        bg-gradient-to-br
        from-slate-950
        via-blue-950
        to-cyan-900
        text-white
        relative
        "
      >
              <div className="absolute inset-0">

          <div className="absolute top-10 left-10 w-[450px] h-[450px] bg-cyan-500/20 rounded-full blur-[150px]" />

          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[180px]" />

        </div>

        <div className="relative z-10 px-16 py-14 flex flex-col w-full">

          <div className="flex items-center gap-5 mb-16">

            <div
              className="
              w-20
              h-20
              rounded-3xl
              bg-gradient-to-r
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

          <h2
            className="
            text-6xl
            font-black
            leading-tight
            mb-8
            "
          >
            Launch Your
            <br />
            Tech Career
            <br />
            With CyberNet
          </h2>

          <p
            className="
            text-xl
            text-slate-300
            leading-10
            mb-12
            "
          >
            Join CyberNet Technology Systems
            and start your professional
            internship journey with real-world
            projects, industry mentorship,
            verified certificates and career
            opportunities.
          </p>

          <div className="space-y-5 mb-12">

            <div className="flex items-center gap-4">
              <FaRocket className="text-cyan-400 text-xl" />
              <span>Industry Based Internships</span>
            </div>

            <div className="flex items-center gap-4">
              <FaBrain className="text-cyan-400 text-xl" />
              <span>AI Powered Assessments</span>
            </div>

            <div className="flex items-center gap-4">
              <FaCertificate className="text-cyan-400 text-xl" />
              <span>Verified Certificates</span>
            </div>

            <div className="flex items-center gap-4">
              <FaShieldAlt className="text-cyan-400 text-xl" />
              <span>Secure Student Dashboard</span>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-6">

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6">
              <FaUserGraduate className="text-cyan-400 text-4xl mb-4" />

              <h3 className="text-5xl font-black">
                1200+
              </h3>

              <p className="text-slate-300 mt-2">
                Students Registered
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6">
              <FaBriefcase className="text-cyan-400 text-4xl mb-4" />

              <h3 className="text-5xl font-black">
                25+
              </h3>

              <p className="text-slate-300 mt-2">
                Internship Tracks
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6">
              <FaLaptopCode className="text-cyan-400 text-4xl mb-4" />

              <h3 className="text-5xl font-black">
                150+
              </h3>

              <p className="text-slate-300 mt-2">
                Projects Completed
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6">
              <FaChartLine className="text-cyan-400 text-4xl mb-4" />

              <h3 className="text-5xl font-black">
                24/7
              </h3>

              <p className="text-slate-300 mt-2">
                Support Available
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* RIGHT PANEL */}

      <div
        className="
        w-full
        lg:w-1/2
        flex
        justify-center
        px-6
        py-10
        "
      >

        <div className="w-full max-w-2xl">

          <div
            className="
            bg-white
            rounded-[40px]
            shadow-2xl
            border
            border-slate-200
            p-8
            lg:p-12
            "
          >

            <div className="text-center mb-10">

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
                <FaUserShield />
              </div>

              <h1 className="text-5xl font-black text-slate-900">
                Create Account
              </h1>

              <p className="text-slate-500 mt-3 text-lg">
                Register for CyberNet Internship Portal
              </p>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
                            {/* NAME */}

              <div className="grid md:grid-cols-2 gap-4">

                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="First Name"
                  required
                  className="
                  h-14
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  focus:border-blue-500
                  "
                />

                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Last Name"
                  required
                  className="
                  h-14
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  focus:border-blue-500
                  "
                />

              </div>

              {/* EMAIL */}

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address"
                required
                className="
                w-full
                h-14
                px-5
                rounded-2xl
                border
                border-slate-300
                outline-none
                focus:border-blue-500
                "
              />

              {/* MOBILE */}

              <input
                type="text"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="Mobile Number"
                required
                className="
                w-full
                h-14
                px-5
                rounded-2xl
                border
                border-slate-300
                outline-none
                focus:border-blue-500
                "
              />

              {/* STUDENT TYPE + YEAR */}

              <div className="grid md:grid-cols-2 gap-4">

                <input
                  type="text"
                  value={formData.course}
                  onChange={handleChange}
                  placeholder="College Name"
                  className="
                  h-14
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  bg-slate-100
                  text-slate-700
                  font-medium
                  "
                />

                <select
                  name="currentYear"
                  value={formData.currentYear}
                  onChange={handleChange}
                  required
                  className="
                  h-14
                  px-5
                  rounded-2xl
                  border
                  border-slate-300
                  outline-none
                  focus:border-blue-500
                  bg-white
                  "
                >
                  <option value="">
                    Select Current Year
                  </option>

                  <option value="1st Year">
                    1st Year
                  </option>

                  <option value="2nd Year">
                    2nd Year
                  </option>

                  <option value="3rd Year">
                    3rd Year
                  </option>

                  <option value="Final Year">
                    Final Year
                  </option>

                  <option value="Graduate">
                    Graduate
                  </option>

                </select>

              </div>

              {/* INTERNSHIP DOMAIN */}

              <select
                name="internshipDomain"
                value={formData.internshipDomain}
                onChange={handleChange}
                required
                className="
                w-full
                h-14
                px-5
                rounded-2xl
                border
                border-slate-300
                outline-none
                focus:border-blue-500
                bg-white
                "
              >
                <option value="">
                  Select Internship Domain
                </option>

                <option value="Full Stack Development">
                  Full Stack Development
                </option>

                <option value="Frontend Development">
                  Frontend Development
                </option>

                <option value="Backend Development">
                  Backend Development
                </option>

                <option value="Python Development">
                  Python Development
                </option>

                <option value="Java Development">
                  Java Development
                </option>

                <option value="Artificial Intelligence">
                  Artificial Intelligence
                </option>

                <option value="Machine Learning">
                  Machine Learning
                </option>

                <option value="Cyber Security">
                  Cyber Security
                </option>

                <option value="Cloud Computing">
                  Cloud Computing
                </option>

                <option value="Data Science">
                  Data Science
                </option>

              </select>

              {/* PASSWORD */}

              <div className="relative">

                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create Password"
                  required
                  className="
                  w-full
                  h-14
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
                    setShowPassword(!showPassword)
                  }
                  className="
                  absolute
                  right-5
                  top-1/2
                  -translate-y-1/2
                  text-slate-500
                  "
                >
                  {showPassword ? (
                    <FaEyeSlash />
                  ) : (
                    <FaEye />
                  )}
                </button>

              </div>

              {/* CONFIRM PASSWORD */}

              <div className="relative">

                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm Password"
                  required
                  className="
                  w-full
                  h-14
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
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  className="
                  absolute
                  right-5
                  top-1/2
                  -translate-y-1/2
                  text-slate-500
                  "
                >
                  {showConfirmPassword ? (
                    <FaEyeSlash />
                  ) : (
                    <FaEye />
                  )}
                </button>

              </div>
                            {/* TERMS */}

              <label className="flex items-start gap-3">

                <input
                  type="checkbox"
                  required
                  className="mt-1"
                />

                <span className="text-slate-600 text-sm leading-6">
                  I agree to CyberNet Technology
                  Systems Terms & Conditions and
                  Privacy Policy.
                </span>

              </label>

              {/* SUBMIT BUTTON */}

              <button
                type="submit"
                disabled={loading}
                className="
                w-full
                h-14
                rounded-2xl
                text-white
                font-bold
                text-lg
                bg-gradient-to-r
                from-blue-600
                via-cyan-500
                to-blue-600
                shadow-xl
                hover:shadow-2xl
                hover:scale-[1.02]
                transition-all
                duration-300
                disabled:opacity-70
                disabled:hover:scale-100
                flex
                items-center
                justify-center
                gap-3
                "
              >
                <FaRocket />

                {loading
                  ? "Creating Account..."
                  : "Create Account"}
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

              <h3 className="font-bold text-slate-900 text-lg text-center mb-5">
                Benefits After Registration
              </h3>

              <div className="grid md:grid-cols-2 gap-4">

                <div className="flex items-center gap-3">
                  <FaCertificate className="text-blue-600" />
                  <span className="text-slate-700">
                    Verified Internship Certificate
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <FaBrain className="text-blue-600" />
                  <span className="text-slate-700">
                    AI Based Assessment System
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <FaLaptopCode className="text-blue-600" />
                  <span className="text-slate-700">
                    Real Industry Projects
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <FaBriefcase className="text-blue-600" />
                  <span className="text-slate-700">
                    Internship Opportunities
                  </span>
                </div>

              </div>

            </div>

            {/* LOGIN LINK */}

            <div className="text-center mt-8">

              <p className="text-slate-500">

                Already Registered?

                <Link
                  to="/login"
                  className="
                  ml-2
                  text-blue-600
                  font-bold
                  hover:text-blue-800
                  "
                >
                  Sign In
                </Link>

              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Register;