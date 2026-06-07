import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import {
  Home,
  Trophy,
  BookOpen,
  Briefcase,
  Award,
  User,
  Bell,
  Rocket,
  GraduationCap,
  Code,
  Target,
  LogOut,
  Flame,
  ListChecks,
  Sparkles,
} from "lucide-react";

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const stats = [
    {
      title: "Assessment Score",
      value: "92%",
      icon: GraduationCap,
      color: "text-blue-600",
    },
    {
      title: "Daily Streak",
      value: "21",
      icon: Flame,
      color: "text-orange-500",
    },
    {
      title: "Tasks Completed",
      value: "38",
      icon: ListChecks,
      color: "text-green-600",
    },
    {
      title: "Scholarship",
      value: "75%",
      icon: Trophy,
      color: "text-purple-600",
    },
  ];

  const leaderboard = [
    { name: "Rahul Sharma", xp: 5200 },
    { name: "Priya Verma", xp: 5000 },
    { name: "Aashish Bansod", xp: 4800 },
    { name: "Aman Gupta", xp: 4600 },
  ];

  const menuItems = [
    {
      title: "Dashboard",
      icon: Home,
      path: "/student/dashboard",
    },
    {
      title: "Daily Tasks",
      icon: BookOpen,
      path: "/student/daily-tasks",
    },
    {
      title: "Coding Practice",
      icon: Code,
      path: "/student/coding-practice",
    },
    {
      title: "Assessment",
      icon: GraduationCap,
      path: "/student/assessment",
    },
    {
      title: "Internships",
      icon: Briefcase,
      path: "/student/internships",
    },
    {
      title: "Certificates",
      icon: Award,
      path: "/student/certificates",
    },
    {
      title: "Leaderboard",
      icon: Trophy,
      path: "/student/leaderboard",
    },
    {
      title: "Profile",
      icon: User,
      path: "/student/profile",
    },
    {
      title: "Scholarship",
      icon: Sparkles,
      path: "/student/scholarship",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">

      {/* Sidebar */}

      <div className="w-72 bg-gradient-to-b from-blue-950 via-blue-900 to-cyan-900 text-white shadow-2xl flex flex-col">

        {/* Logo */}

        <div className="p-8 border-b border-white/10">

          <div className="flex items-center gap-4">

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center text-2xl font-black">
              CN
            </div>

            <div>
              <h1 className="text-3xl font-extrabold">
                CyberNet
              </h1>

              <p className="text-blue-200 text-sm">
                Student Portal
              </p>
            </div>

          </div>

        </div>

        {/* Navigation */}

        <div className="flex-1 p-5">

          <div className="space-y-3">

            {menuItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <button
                  key={index}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-300 ${
                    location.pathname === item.path
                      ? "bg-white/20 shadow-lg"
                      : "hover:bg-white/10"
                  }`}
                >
                  <Icon size={20} />
                  {item.title}
                </button>
              );
            })}

          </div>

        </div>

        {/* Logout */}

        <div className="p-5">

          <button
            onClick={() => navigate("/login")}
            className="w-full bg-red-500 hover:bg-red-600 transition p-4 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            Logout
          </button>

        </div>

      </div>
            {/* Main Content */}

      <div className="flex-1 overflow-y-auto">

        {/* Header */}

        <div className="bg-white shadow-sm border-b px-8 py-6">

          <div className="flex justify-between items-center">

            <div>
              <h1 className="text-4xl font-bold text-slate-800">
                Welcome Back, ASHISH 🚀
              </h1>

              <p className="text-slate-500 mt-2">
                CyberNet Internship Program Dashboard
              </p>
            </div>

            <div className="flex items-center gap-5">

              <div className="relative cursor-pointer">

                <Bell
                  className="text-slate-700"
                  size={26}
                />

                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  3
                </span>

              </div>

              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                A
              </div>

            </div>

          </div>

        </div>

        {/* Dashboard Body */}

        <div className="p-8">

          {/* Hero Banner */}

          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 rounded-3xl p-8 text-white shadow-xl mb-8">

            <div className="flex justify-between items-center">

              <div>

                <h2 className="text-4xl font-bold">
                  CyberNet Internship Program
                </h2>

                <p className="mt-3 text-blue-100 text-lg">
                  Complete Tasks, Earn XP, Unlock Certificates
                  and Secure Scholarships.
                </p>

              </div>

              <Rocket
                size={70}
                className="text-white"
              />

            </div>

          </div>

          {/* Stats Cards */}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">

            {stats.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={index}
                  className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition"
                >

                  <div className="flex justify-between items-center">

                    <div>

                      <p className="text-slate-500">
                        {item.title}
                      </p>

                      <h2
                        className={`text-4xl font-bold mt-3 ${item.color}`}
                      >
                        {item.value}
                      </h2>

                    </div>

                    <Icon
                      size={48}
                      className={item.color}
                    />

                  </div>

                </div>
              );
            })}

          </div>
                    {/* Today's Mission */}

          <div className="bg-white rounded-3xl shadow-lg p-8 mb-8">

            <div className="flex justify-between items-center">

              <div>

                <h2 className="text-3xl font-bold">
                  Today's Mission 🎯
                </h2>

                <p className="text-slate-500 mt-2">
                  Complete React Internship Task
                </p>

              </div>

              <div className="bg-green-100 text-green-700 px-5 py-2 rounded-full font-bold">
                +100 XP
              </div>

            </div>

            <div className="mt-6">

              <div className="flex justify-between mb-2">
                <span>Progress</span>
                <span>70%</span>
              </div>

              <div className="w-full h-4 bg-slate-200 rounded-full">

                <div className="h-4 w-[70%] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"></div>

              </div>

            </div>

            <button
              onClick={() =>
                navigate("/student/daily-tasks")
              }
              className="mt-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-8 py-3 rounded-xl font-bold hover:scale-105 transition"
            >
              Continue Task
            </button>

          </div>

          {/* Quick Access Cards */}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">

            <div className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition">

              <GraduationCap
                className="text-blue-600"
                size={42}
              />

              <h3 className="text-2xl font-bold mt-4">
                Assessment
              </h3>

              <p className="text-slate-500 mt-2">
                Start AI Assessment Test
              </p>

              <button
                onClick={() =>
                  navigate("/student/assessment")
                }
                className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-bold"
              >
                Start Assessment
              </button>

            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition">

              <Code
                className="text-green-600"
                size={42}
              />

              <h3 className="text-2xl font-bold mt-4">
                Coding Practice
              </h3>

              <p className="text-slate-500 mt-2">
                Solve coding challenges
              </p>

              <button
                onClick={() =>
                  navigate("/student/coding-practice")
                }
                className="w-full mt-6 bg-green-600 text-white py-3 rounded-xl font-bold"
              >
                Start Practice
              </button>

            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition">

              <Award
                className="text-purple-600"
                size={42}
              />

              <h3 className="text-2xl font-bold mt-4">
                Certificates
              </h3>

              <p className="text-slate-500 mt-2">
                Download Internship Certificates
              </p>

              <button
                onClick={() =>
                  navigate("/student/certificates")
                }
                className="w-full mt-6 bg-purple-600 text-white py-3 rounded-xl font-bold"
              >
                View Certificates
              </button>

            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition">

              <Briefcase
                className="text-orange-600"
                size={42}
              />

              <h3 className="text-2xl font-bold mt-4">
                Internships
              </h3>

              <p className="text-slate-500 mt-2">
                View Internship Progress
              </p>

              <button
                onClick={() =>
                  navigate("/student/internships")
                }
                className="w-full mt-6 bg-orange-500 text-white py-3 rounded-xl font-bold"
              >
                Open Portal
              </button>

            </div>

          </div>

          {/* Premium Tools */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            <div
              onClick={() =>
                navigate("/student/ai-mentor")
              }
              className="bg-gradient-to-r from-blue-700 to-cyan-500 text-white p-8 rounded-3xl cursor-pointer hover:scale-105 transition"
            >
              <Rocket size={40} />

              <h2 className="text-2xl font-bold mt-4">
                AI Mentor
              </h2>

              <p className="mt-2 text-blue-100">
                Ask coding doubts and get career guidance.
              </p>

            </div>

            <div
              onClick={() =>
                navigate("/student/scholarship")
              }
              className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-8 rounded-3xl cursor-pointer hover:scale-105 transition"
            >
              <Trophy size={40} />

              <h2 className="text-2xl font-bold mt-4">
                Scholarship
              </h2>

              <p className="mt-2 text-purple-100">
                Track scholarship eligibility and rewards.
              </p>

            </div>

            <div
              onClick={() =>
                navigate("/student/leaderboard")
              }
              className="bg-gradient-to-r from-green-600 to-emerald-500 text-white p-8 rounded-3xl cursor-pointer hover:scale-105 transition"
            >
              <Target size={40} />

              <h2 className="text-2xl font-bold mt-4">
                Leaderboard
              </h2>

              <p className="mt-2 text-green-100">
                Compete with top CyberNet students.
              </p>

            </div>

          </div>
                    {/* Internship Progress + AI Mentor */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">

            {/* Progress */}

            <div className="bg-white rounded-3xl p-8 shadow-lg">

              <h2 className="text-3xl font-bold mb-6">
                Internship Progress
              </h2>

              <div className="space-y-6">

                <div>
                  <div className="flex justify-between">
                    <span>HTML & CSS</span>
                    <span>100%</span>
                  </div>

                  <div className="h-3 bg-slate-200 rounded-full mt-2">
                    <div className="h-3 bg-green-500 rounded-full w-full"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span>JavaScript</span>
                    <span>85%</span>
                  </div>

                  <div className="h-3 bg-slate-200 rounded-full mt-2">
                    <div className="h-3 bg-blue-500 rounded-full w-[85%]"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span>React JS</span>
                    <span>70%</span>
                  </div>

                  <div className="h-3 bg-slate-200 rounded-full mt-2">
                    <div className="h-3 bg-cyan-500 rounded-full w-[70%]"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span>Node JS</span>
                    <span>60%</span>
                  </div>

                  <div className="h-3 bg-slate-200 rounded-full mt-2">
                    <div className="h-3 bg-purple-500 rounded-full w-[60%]"></div>
                  </div>
                </div>

              </div>

            </div>

            {/* AI Mentor */}

            <div className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white rounded-3xl p-8 shadow-lg">

              <div className="flex justify-between items-center">

                <h2 className="text-4xl font-bold">
                  CyberNet AI Mentor
                </h2>

                <Rocket size={40} />

              </div>

              <p className="mt-6 text-lg">
                Ask coding doubts, resume review,
                interview preparation and placement guidance.
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
                className="mt-5 bg-white text-blue-700 font-bold px-8 py-4 rounded-2xl w-full"
              >
                Open AI Mentor
              </button>

            </div>

          </div>

          {/* Leaderboard */}

          <div className="bg-white rounded-3xl shadow-lg p-8">

            <div className="flex justify-between items-center">

              <h2 className="text-4xl font-bold">
                Top Students Leaderboard
              </h2>

              <Trophy
                className="text-yellow-500"
                size={40}
              />

            </div>

            <div className="mt-8 space-y-4">

              {leaderboard.map((student, index) => (

                <div
                  key={index}
                  className="flex justify-between items-center p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 transition"
                >

                  <div className="flex items-center gap-4">

                    <span className="font-bold text-green-600">
                      #{index + 1}
                    </span>

                    <span className="font-semibold">
                      {student.name}
                    </span>

                  </div>

                  <span className="font-bold text-blue-600">
                    {student.xp} XP
                  </span>

                </div>

              ))}

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default Dashboard;