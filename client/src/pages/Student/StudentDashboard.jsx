import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaHome,
  FaTasks,
  FaCode,
  FaGraduationCap,
  FaCertificate,
  FaUser,
  FaBell,
  FaSignOutAlt,
  FaRocket,
  FaTrophy,
  FaBriefcase,
  FaChartLine,
} from "react-icons/fa";

function StudentDashboard() {
  const navigate = useNavigate();

  const student =
    JSON.parse(localStorage.getItem("student")) || {};

  const [activeMenu, setActiveMenu] =
    useState("dashboard");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("student");
    navigate("/login");
  };

  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden">

      {/* SIDEBAR */}

      <div className="w-72 bg-gradient-to-b from-blue-950 via-blue-900 to-cyan-900 text-white flex flex-col">

        <div className="p-8 border-b border-white/10">

          <div className="flex items-center gap-4">

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center text-2xl font-black">
              CN
            </div>

            <div>
              <h1 className="text-2xl font-black">
                CyberNet
              </h1>

              <p className="text-cyan-300 text-sm">
                Student Portal
              </p>
            </div>

          </div>

        </div>

        <div className="flex-1 p-5 space-y-2">

          <button
            onClick={() => {
              setActiveMenu("dashboard");
              navigate("/student/dashboard");
            }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition ${
              activeMenu === "dashboard"
                ? "bg-white/20"
                : "hover:bg-white/10"
            }`}
          >
            <FaHome />
            Dashboard
          </button>

          <button
            onClick={() => {
              setActiveMenu("tasks");
              navigate("/student/daily-tasks");
            }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition ${
              activeMenu === "tasks"
                ? "bg-white/20"
                : "hover:bg-white/10"
            }`}
          >
            <FaTasks />
            Daily Tasks
          </button>

          <button
            onClick={() => {
              setActiveMenu("coding");
              navigate("/student/coding-practice");
            }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition ${
              activeMenu === "coding"
                ? "bg-white/20"
                : "hover:bg-white/10"
            }`}
          >
            <FaCode />
            Coding Practice
          </button>

          <button
            onClick={() => {
              setActiveMenu("assessment");
              navigate("/student/assessment");
            }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition ${
              activeMenu === "assessment"
                ? "bg-white/20"
                : "hover:bg-white/10"
            }`}
          >
            <FaGraduationCap />
            Assessment
          </button>

          <button
            onClick={() => {
              setActiveMenu("internship");
              navigate("/student/internships");
            }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition ${
              activeMenu === "internship"
                ? "bg-white/20"
                : "hover:bg-white/10"
            }`}
          >
            <FaBriefcase />
            Internship
          </button>

          <button
            onClick={() => {
              setActiveMenu("certificate");
              navigate("/student/certificates");
            }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition ${
              activeMenu === "certificate"
                ? "bg-white/20"
                : "hover:bg-white/10"
            }`}
          >
            <FaCertificate />
            Certificates
          </button>

          <button
            onClick={() => {
              setActiveMenu("profile");
              navigate("/student/profile");
            }}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition ${
              activeMenu === "profile"
                ? "bg-white/20"
                : "hover:bg-white/10"
            }`}
          >
            <FaUser />
            Profile
          </button>

          <button
            onClick={() =>
              navigate("/student/leaderboard")
            }
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl hover:bg-white/10"
          >
            <FaTrophy />
            Leaderboard
          </button>

        </div>

        <div className="p-5 border-t border-white/10">

          <button
            onClick={handleLogout}
            className="w-full bg-red-500 hover:bg-red-600 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold"
          >
            <FaSignOutAlt />
            Logout
          </button>

        </div>

      </div>

      {/* MAIN CONTENT */}

      <div className="flex-1 overflow-y-auto">

        <div className="bg-white h-24 shadow flex items-center justify-between px-10">
                    <div>
            <h1 className="text-3xl font-black text-slate-900">
              Welcome Back,{" "}
              {student?.firstName || "ASHISH"} 🚀
            </h1>

            <p className="text-slate-500">
              CyberNet Internship Program
            </p>
          </div>

          <div className="flex items-center gap-6">

            <button className="relative">
              <FaBell className="text-2xl text-slate-700" />

              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                3
              </span>
            </button>

            <div className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white flex items-center justify-center font-bold text-xl">
              {student?.firstName?.charAt(0) || "A"}
            </div>

          </div>

        </div>

        {/* DASHBOARD BODY */}

        <div className="p-10">

          {/* STATS */}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">

            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <div className="flex justify-between items-center">

                <div>
                  <p className="text-slate-500">
                    Assessment Score
                  </p>

                  <h2 className="text-4xl font-black text-blue-600 mt-2">
                    92%
                  </h2>
                </div>

                <FaGraduationCap className="text-5xl text-blue-500" />

              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <div className="flex justify-between items-center">

                <div>
                  <p className="text-slate-500">
                    Daily Streak
                  </p>

                  <h2 className="text-4xl font-black text-orange-500 mt-2">
                    21
                  </h2>
                </div>

                <FaRocket className="text-5xl text-orange-500" />

              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <div className="flex justify-between items-center">

                <div>
                  <p className="text-slate-500">
                    Tasks Completed
                  </p>

                  <h2 className="text-4xl font-black text-green-600 mt-2">
                    38
                  </h2>
                </div>

                <FaTasks className="text-5xl text-green-500" />

              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg">
              <div className="flex justify-between items-center">

                <div>
                  <p className="text-slate-500">
                    Scholarship
                  </p>

                  <h2 className="text-4xl font-black text-purple-600 mt-2">
                    75%
                  </h2>
                </div>

                <FaTrophy className="text-5xl text-purple-500" />

              </div>
            </div>

          </div>

          {/* TODAY MISSION */}

          <div className="bg-white rounded-3xl shadow-lg p-8 mb-10">

            <div className="flex justify-between items-center">

              <div>
                <h2 className="text-3xl font-black">
                  Today's Mission
                </h2>

                <p className="text-slate-500 mt-2">
                  Complete React Internship Task
                </p>
              </div>

              <span className="bg-green-100 text-green-700 px-5 py-2 rounded-full font-bold">
                +100 XP
              </span>

            </div>

            <div className="mt-6">

              <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden">

                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full w-[70%]" />

              </div>

              <p className="mt-3 text-slate-600">
                Progress : 70%
              </p>

            </div>

            <button
              onClick={() =>
                navigate("/student/daily-tasks")
              }
              className="mt-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-8 py-4 rounded-2xl font-bold shadow-lg"
            >
              Continue Task
            </button>

          </div>

          {/* QUICK ACTIONS */}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                        {/* Assessment Card */}

            <div className="bg-white rounded-3xl p-6 shadow-lg">

              <FaGraduationCap className="text-5xl text-blue-500 mb-4" />

              <h3 className="font-bold text-xl">
                Assessment
              </h3>

              <p className="text-slate-500 mt-2">
                Start AI Assessment Test
              </p>

              <button
                onClick={() =>
                  navigate("/student/assessment")
                }
                className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl"
              >
                Start
              </button>

            </div>

            {/* Coding Practice Card */}

            <div className="bg-white rounded-3xl p-6 shadow-lg">

              <FaCode className="text-5xl text-green-500 mb-4" />

              <h3 className="font-bold text-xl">
                Coding Practice
              </h3>

              <p className="text-slate-500 mt-2">
                Solve coding challenges
              </p>

              <button
                onClick={() =>
                  navigate("/student/coding-practice")
                }
                className="mt-5 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
              >
                Practice
              </button>

            </div>

            {/* Certificate Card */}

            <div className="bg-white rounded-3xl p-6 shadow-lg">

              <FaCertificate className="text-5xl text-purple-500 mb-4" />

              <h3 className="font-bold text-xl">
                Certificates
              </h3>

              <p className="text-slate-500 mt-2">
                Download Certificates
              </p>

              <button
                onClick={() =>
                  navigate("/student/certificates")
                }
                className="mt-5 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl"
              >
                View
              </button>

            </div>

            {/* Internship Card */}

            <div className="bg-white rounded-3xl p-6 shadow-lg">

              <FaBriefcase className="text-5xl text-orange-500 mb-4" />

              <h3 className="font-bold text-xl">
                Internship
              </h3>

              <p className="text-slate-500 mt-2">
                View Internship Progress
              </p>

              <button
                onClick={() =>
                  navigate("/student/internships")
                }
                className="mt-5 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl"
              >
                Open
              </button>

            </div>

          </div>

          {/* INTERNSHIP PROGRESS + AI MENTOR */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">

            {/* Progress */}

            <div className="bg-white rounded-3xl shadow-lg p-8">

              <div className="flex justify-between items-center mb-6">

                <h2 className="text-2xl font-black">
                  Internship Progress
                </h2>

                <FaChartLine className="text-3xl text-blue-600" />

              </div>

              <div className="space-y-6">

                <div>

                  <div className="flex justify-between mb-2">
                    <span>HTML & CSS</span>
                    <span>100%</span>
                  </div>

                  <div className="h-3 bg-slate-200 rounded-full">
                    <div className="h-3 bg-green-500 rounded-full w-full"></div>
                  </div>

                </div>

                <div>

                  <div className="flex justify-between mb-2">
                    <span>JavaScript</span>
                    <span>85%</span>
                  </div>

                  <div className="h-3 bg-slate-200 rounded-full">
                    <div className="h-3 bg-blue-500 rounded-full w-[85%]"></div>
                  </div>

                </div>

                <div>

                  <div className="flex justify-between mb-2">
                    <span>React JS</span>
                    <span>70%</span>
                  </div>

                  <div className="h-3 bg-slate-200 rounded-full">
                    <div className="h-3 bg-cyan-500 rounded-full w-[70%]"></div>
                  </div>

                </div>

                <div>

                  <div className="flex justify-between mb-2">
                    <span>Final Project</span>
                    <span>30%</span>
                  </div>

                  <div className="h-3 bg-slate-200 rounded-full">
                    <div className="h-3 bg-orange-500 rounded-full w-[30%]"></div>
                  </div>

                </div>

              </div>

            </div>

            {/* AI Mentor */}

            <div className="bg-gradient-to-br from-blue-700 via-cyan-600 to-blue-900 rounded-3xl shadow-lg p-8 text-white">

              <div className="flex justify-between items-center mb-6">

                <h2 className="text-3xl font-black">
                  CyberNet AI Mentor
                </h2>

                <FaRocket className="text-4xl" />

              </div>

              <p className="leading-8 text-lg text-blue-100">
                Ask coding doubts, project guidance,
                interview preparation, resume review,
                placement roadmap and internship support.
              </p>

              <input
                type="text"
                placeholder="Ask AI Mentor..."
                className="w-full mt-8 p-4 rounded-2xl text-black outline-none"
              />

              <button
                onClick={() =>
                  navigate("/student/ai-mentor")
                }
                className="mt-4 w-full bg-white text-blue-700 font-bold py-4 rounded-2xl"
              >
                Open AI Mentor
              </button>

            </div>

          </div>

                    {/* LEADERBOARD */}

          <div className="bg-white rounded-3xl shadow-lg p-8 mb-10">

            <div className="flex justify-between items-center mb-8">

              <h2 className="text-3xl font-black">
                Top Students Leaderboard
              </h2>

              <FaTrophy className="text-4xl text-yellow-500" />

            </div>

            <div className="space-y-5">

              <div className="flex justify-between bg-slate-50 p-4 rounded-2xl">
                <div className="flex gap-4">
                  <span className="font-black text-green-600">
                    #1
                  </span>
                  <span>Rahul Sharma</span>
                </div>

                <span className="font-bold">
                  5200 XP
                </span>
              </div>

              <div className="flex justify-between bg-slate-50 p-4 rounded-2xl">
                <div className="flex gap-4">
                  <span className="font-black text-blue-600">
                    #2
                  </span>
                  <span>Ashish Bansod</span>
                </div>

                <span className="font-bold">
                  4850 XP
                </span>
              </div>

              <div className="flex justify-between bg-slate-50 p-4 rounded-2xl">
                <div className="flex gap-4">
                  <span className="font-black text-orange-600">
                    #3
                  </span>
                  <span>Aman Verma</span>
                </div>

                <span className="font-bold">
                  4500 XP
                </span>
              </div>

            </div>

          </div>

          {/* RECENT ACTIVITY */}

          <div className="bg-white rounded-3xl shadow-lg p-8 mb-10">

            <h2 className="text-3xl font-black mb-8">
              Recent Activity
            </h2>

            <div className="space-y-6">

              <div className="flex items-center gap-4">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <p>Completed React Assignment</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <p>Scored 92% in Assessment</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                <p>Certificate Generated</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                <p>Daily Coding Challenge Completed</p>
              </div>

            </div>

          </div>

          {/* FOOTER STATS */}

          <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-cyan-600 rounded-3xl p-8 text-white">

            <div className="grid md:grid-cols-4 gap-8">

              <div>
                <h2 className="text-4xl font-black">
                  5000+
                </h2>
                <p className="text-blue-100">
                  Students
                </p>
              </div>

              <div>
                <h2 className="text-4xl font-black">
                  150+
                </h2>
                <p className="text-blue-100">
                  Internship Domains
                </p>
              </div>

              <div>
                <h2 className="text-4xl font-black">
                  98%
                </h2>
                <p className="text-blue-100">
                  Completion Rate
                </p>
              </div>

              <div>
                <h2 className="text-4xl font-black">
                  AI
                </h2>
                <p className="text-blue-100">
                  Powered Learning
                </p>
              </div>

            </div>

          </div>

        </div>
      </div>
    </div>

  );
}

export default StudentDashboard;