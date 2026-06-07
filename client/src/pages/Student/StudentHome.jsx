import React from "react";
import {
  User,
  Trophy,
  BookOpen,
  Award,
  Rocket,
  Target,
  Brain,
  Star,
} from "lucide-react";

function StudentHome() {

  const student = {
    name: "ASHISH",
    course: "Full Stack Development",
    level: 12,
    xp: 5200,
    rank: "#7",
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      {/* Hero Section */}

      <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-500 rounded-3xl p-10 text-white shadow-2xl">

        <div className="flex flex-col md:flex-row justify-between items-center">

          <div>

            <h1 className="text-5xl font-black">
              Welcome Back, {student.name}
            </h1>

            <p className="mt-3 text-xl opacity-90">
              CyberNet Internship Program
            </p>

            <div className="flex gap-4 mt-6">

              <span className="bg-white/20 px-4 py-2 rounded-full">
                Level {student.level}
              </span>

              <span className="bg-white/20 px-4 py-2 rounded-full">
                Rank {student.rank}
              </span>

            </div>

          </div>

          <Rocket size={90} />

        </div>

      </div>

      {/* Stats Cards */}

      <div className="grid md:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <BookOpen size={35} className="text-blue-600" />

          <h2 className="text-4xl font-black mt-3">
            24
          </h2>

          <p className="text-slate-500">
            Completed Lessons
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Trophy size={35} className="text-yellow-500" />

          <h2 className="text-4xl font-black mt-3">
            {student.xp}
          </h2>

          <p className="text-slate-500">
            Total XP
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Award size={35} className="text-purple-600" />

          <h2 className="text-4xl font-black mt-3">
            12
          </h2>

          <p className="text-slate-500">
            Certificates
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Target size={35} className="text-green-600" />

          <h2 className="text-4xl font-black mt-3">
            92%
          </h2>

          <p className="text-slate-500">
            Assessment Score
          </p>

        </div>

      </div>
            {/* Progress Section */}

      <div className="bg-white rounded-3xl shadow-lg p-8 mt-8">

        <div className="flex justify-between items-center mb-4">

          <h2 className="text-2xl font-bold">
            Internship Progress
          </h2>

          <span className="font-bold text-blue-600">
            78%
          </span>

        </div>

        <div className="w-full h-5 bg-slate-200 rounded-full overflow-hidden">

          <div
            className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"
            style={{ width: "78%" }}
          />

        </div>

        <p className="mt-4 text-slate-500">
          You are very close to completing your internship journey.
        </p>

      </div>

      {/* Quick Actions */}

      <div className="grid md:grid-cols-3 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition">

          <Brain size={40} className="text-blue-600" />

          <h3 className="text-xl font-bold mt-4">
            AI Mentor
          </h3>

          <p className="text-slate-500 mt-2">
            Ask questions and get instant guidance.
          </p>

          <button className="mt-4 w-full bg-blue-600 text-white py-3 rounded-xl">
            Open Mentor
          </button>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition">

          <BookOpen size={40} className="text-green-600" />

          <h3 className="text-xl font-bold mt-4">
            Daily Learning
          </h3>

          <p className="text-slate-500 mt-2">
            Continue today's learning challenge.
          </p>

          <button className="mt-4 w-full bg-green-600 text-white py-3 rounded-xl">
            Continue
          </button>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition">

          <Star size={40} className="text-yellow-500" />

          <h3 className="text-xl font-bold mt-4">
            Rewards
          </h3>

          <p className="text-slate-500 mt-2">
            Unlock rewards and premium badges.
          </p>

          <button className="mt-4 w-full bg-yellow-500 text-white py-3 rounded-xl">
            View Rewards
          </button>

        </div>

      </div>
            {/* Recent Activity */}

      <div className="bg-white rounded-3xl shadow-lg p-8 mt-8">

        <h2 className="text-2xl font-bold mb-6">
          Recent Activity
        </h2>

        <div className="space-y-4">

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">

            <div className="flex items-center gap-4">

              <Award className="text-purple-600" />

              <div>

                <h4 className="font-bold">
                  Certificate Earned
                </h4>

                <p className="text-slate-500 text-sm">
                  React Development Internship
                </p>

              </div>

            </div>

            <span className="text-green-600 font-bold">
              +500 XP
            </span>

          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">

            <div className="flex items-center gap-4">

              <BookOpen className="text-blue-600" />

              <div>

                <h4 className="font-bold">
                  Lesson Completed
                </h4>

                <p className="text-slate-500 text-sm">
                  Advanced JavaScript Concepts
                </p>

              </div>

            </div>

            <span className="text-blue-600 font-bold">
              +120 XP
            </span>

          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">

            <div className="flex items-center gap-4">

              <Trophy className="text-yellow-500" />

              <div>

                <h4 className="font-bold">
                  Weekly Challenge Won
                </h4>

                <p className="text-slate-500 text-sm">
                  Top Performer Badge
                </p>

              </div>

            </div>

            <span className="text-yellow-600 font-bold">
              +300 XP
            </span>

          </div>

        </div>

      </div>

      {/* Performance Overview */}

      <div className="grid md:grid-cols-2 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-8 shadow-lg">

          <h3 className="text-2xl font-bold mb-4">
            Skills Progress
          </h3>

          <div className="space-y-5">

            <div>
              <div className="flex justify-between">
                <span>HTML & CSS</span>
                <span>95%</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full mt-2">
                <div className="h-3 bg-blue-600 rounded-full w-[95%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between">
                <span>JavaScript</span>
                <span>88%</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full mt-2">
                <div className="h-3 bg-green-600 rounded-full w-[88%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between">
                <span>React JS</span>
                <span>82%</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full mt-2">
                <div className="h-3 bg-purple-600 rounded-full w-[82%]" />
              </div>
            </div>

          </div>

        </div>

                <div className="bg-white rounded-3xl p-8 shadow-lg">

          <h3 className="text-2xl font-bold mb-4">
            Profile Summary
          </h3>

          <div className="flex flex-col items-center text-center">

            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center text-white">
              <User size={40} />
            </div>

            <h2 className="text-2xl font-bold mt-4">
              {student.name}
            </h2>

            <p className="text-slate-500">
              {student.course}
            </p>

            <div className="grid grid-cols-2 gap-4 w-full mt-6">

              <div className="bg-slate-100 rounded-2xl p-4">
                <h4 className="text-2xl font-bold">
                  {student.level}
                </h4>
                <p className="text-slate-500">
                  Level
                </p>
              </div>

              <div className="bg-slate-100 rounded-2xl p-4">
                <h4 className="text-2xl font-bold">
                  {student.rank}
                </h4>
                <p className="text-slate-500">
                  Rank
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default StudentHome;