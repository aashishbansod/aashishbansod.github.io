import React, { useState } from "react";
import {
  GraduationCap,
  Clock,
  Trophy,
  Target,
  Brain,
  Rocket,
  CheckCircle,
  BookOpen,
  Star,
  Award,
} from "lucide-react";

function StudentAssessment() {

  const [selectedTest, setSelectedTest] = useState(null);

  const assessments = [
    {
      id: 1,
      title: "HTML & CSS Assessment",
      questions: 50,
      duration: "45 Min",
      xp: 500,
      level: "Beginner",
      color: "blue",
    },
    {
      id: 2,
      title: "JavaScript Assessment",
      questions: 60,
      duration: "60 Min",
      xp: 700,
      level: "Intermediate",
      color: "yellow",
    },
    {
      id: 3,
      title: "React JS Assessment",
      questions: 70,
      duration: "75 Min",
      xp: 1000,
      level: "Advanced",
      color: "cyan",
    },
    {
      id: 4,
      title: "Full Stack Assessment",
      questions: 100,
      duration: "120 Min",
      xp: 2000,
      level: "Expert",
      color: "green",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-900 rounded-3xl p-8 text-white shadow-xl">

        <div className="flex justify-between items-center">

          <div>

            <h1 className="text-5xl font-black flex items-center gap-4">
              <GraduationCap size={50} />
              CyberNet Assessment Center
            </h1>

            <p className="mt-4 text-blue-100 text-lg">
              Premium Internship Skill Evaluation Platform
            </p>

          </div>

          <Rocket size={60} />

        </div>

      </div>

      {/* Stats Section */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Target size={40} className="text-blue-600" />
          <h2 className="text-4xl font-black mt-3">
            92%
          </h2>
          <p className="text-slate-500">
            Average Score
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Trophy size={40} className="text-yellow-500" />
          <h2 className="text-4xl font-black mt-3">
            5200
          </h2>
          <p className="text-slate-500">
            XP Earned
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Award size={40} className="text-green-600" />
          <h2 className="text-4xl font-black mt-3">
            12
          </h2>
          <p className="text-slate-500">
            Tests Completed
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Star size={40} className="text-purple-600" />
          <h2 className="text-4xl font-black mt-3">
            Rank #3
          </h2>
          <p className="text-slate-500">
            Leaderboard Position
          </p>
        </div>

      </div>
            {/* Assessment Cards */}

      <div className="mt-10">

        <div className="flex items-center gap-3 mb-6">

          <Brain
            size={32}
            className="text-blue-600"
          />

          <h2 className="text-3xl font-black">
            Available Assessments
          </h2>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {assessments.map((test) => (

            <div
              key={test.id}
              className="bg-white rounded-3xl shadow-lg p-8 hover:shadow-2xl transition duration-300"
            >

              <div className="flex justify-between items-start">

                <div>

                  <h3 className="text-2xl font-black">
                    {test.title}
                  </h3>

                  <p className="text-slate-500 mt-2">
                    CyberNet Skill Assessment
                  </p>

                </div>

                <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-bold">
                  {test.level}
                </span>

              </div>

              <div className="grid grid-cols-3 gap-4 mt-8">

                <div className="bg-slate-50 rounded-2xl p-4 text-center">

                  <BookOpen
                    className="mx-auto text-blue-600"
                    size={24}
                  />

                  <h4 className="font-black text-xl mt-2">
                    {test.questions}
                  </h4>

                  <p className="text-xs text-slate-500">
                    Questions
                  </p>

                </div>

                <div className="bg-slate-50 rounded-2xl p-4 text-center">

                  <Clock
                    className="mx-auto text-orange-500"
                    size={24}
                  />

                  <h4 className="font-black text-xl mt-2">
                    {test.duration}
                  </h4>

                  <p className="text-xs text-slate-500">
                    Duration
                  </p>

                </div>

                <div className="bg-slate-50 rounded-2xl p-4 text-center">

                  <Trophy
                    className="mx-auto text-yellow-500"
                    size={24}
                  />

                  <h4 className="font-black text-xl mt-2">
                    {test.xp}
                  </h4>

                  <p className="text-xs text-slate-500">
                    XP Reward
                  </p>

                </div>

              </div>

              <button
                onClick={() =>
                  setSelectedTest(test)
                }
                className="w-full mt-8 bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-4 rounded-2xl font-bold hover:scale-105 transition"
              >
                Start Assessment
              </button>

            </div>

          ))}

        </div>

      </div>

            {/* Selected Test Preview */}

      {selectedTest && (

        <div className="bg-white rounded-3xl shadow-xl p-8 mt-10">

          <div className="flex justify-between items-center">

            <div>

              <h2 className="text-4xl font-black">
                {selectedTest.title}
              </h2>

              <p className="text-slate-500 mt-2">
                Assessment Preview & Rules
              </p>

            </div>

            <CheckCircle
              size={50}
              className="text-green-500"
            />

          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">

            <div className="bg-blue-50 p-5 rounded-2xl">

              <h3 className="font-bold">
                Questions
              </h3>

              <p className="text-3xl font-black mt-2">
                {selectedTest.questions}
              </p>

            </div>

            <div className="bg-orange-50 p-5 rounded-2xl">

              <h3 className="font-bold">
                Duration
              </h3>

              <p className="text-3xl font-black mt-2">
                {selectedTest.duration}
              </p>

            </div>

            <div className="bg-yellow-50 p-5 rounded-2xl">

              <h3 className="font-bold">
                XP Reward
              </h3>

              <p className="text-3xl font-black mt-2">
                {selectedTest.xp}
              </p>

            </div>

            <div className="bg-green-50 p-5 rounded-2xl">

              <h3 className="font-bold">
                Level
              </h3>

              <p className="text-3xl font-black mt-2">
                {selectedTest.level}
              </p>

            </div>

          </div>

          {/* Rules */}

          <div className="mt-10">

            <h3 className="text-2xl font-black mb-5">
              Assessment Rules
            </h3>

            <div className="space-y-4">

              <div className="flex gap-3 items-center">
                <CheckCircle className="text-green-500" />
                <span>
                  Complete all questions before submission.
                </span>
              </div>

              <div className="flex gap-3 items-center">
                <CheckCircle className="text-green-500" />
                <span>
                  Assessment timer cannot be paused.
                </span>
              </div>

              <div className="flex gap-3 items-center">
                <CheckCircle className="text-green-500" />
                <span>
                  Minimum 60% score required to pass.
                </span>
              </div>

              <div className="flex gap-3 items-center">
                <CheckCircle className="text-green-500" />
                <span>
                  XP and Certificates awarded automatically.
                </span>
              </div>

            </div>

          </div>

          <button
            className="mt-10 w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white py-5 rounded-2xl text-xl font-black hover:scale-105 transition"
          >
            Launch Assessment
          </button>

        </div>

      )}
            {/* Previous Results */}

      <div className="bg-white rounded-3xl shadow-xl p-8 mt-10">

        <h2 className="text-3xl font-black mb-8">
          Previous Assessment Results
        </h2>

        <div className="space-y-5">

          <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl">

            <div>
              <h3 className="font-black">
                HTML & CSS Assessment
              </h3>

              <p className="text-slate-500">
                Completed Successfully
              </p>
            </div>

            <div className="text-right">
              <h3 className="text-2xl font-black text-green-600">
                95%
              </h3>

              <p className="text-slate-500">
                +500 XP
              </p>
            </div>

          </div>

          <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl">

            <div>
              <h3 className="font-black">
                JavaScript Assessment
              </h3>

              <p className="text-slate-500">
                Completed Successfully
              </p>
            </div>

            <div className="text-right">
              <h3 className="text-2xl font-black text-blue-600">
                88%
              </h3>

              <p className="text-slate-500">
                +700 XP
              </p>
            </div>

          </div>

          <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl">

            <div>
              <h3 className="font-black">
                React JS Assessment
              </h3>

              <p className="text-slate-500">
                Completed Successfully
              </p>
            </div>

            <div className="text-right">
              <h3 className="text-2xl font-black text-cyan-600">
                91%
              </h3>

              <p className="text-slate-500">
                +1000 XP
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* Achievement Section */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-3xl p-8 shadow-xl">

          <Trophy size={45} />

          <h2 className="text-3xl font-black mt-4">
            Gold Performer
          </h2>

          <p className="mt-2">
            Score above 90% in assessments.
          </p>

        </div>

        <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-3xl p-8 shadow-xl">

          <Award size={45} />

          <h2 className="text-3xl font-black mt-4">
            Skill Master
          </h2>

          <p className="mt-2">
            Completed 10+ assessments.
          </p>

        </div>

        <div className="bg-gradient-to-r from-blue-700 to-cyan-500 text-white rounded-3xl p-8 shadow-xl">

          <Rocket size={45} />

          <h2 className="text-3xl font-black mt-4">
            Fast Learner
          </h2>

          <p className="mt-2">
            Earned over 5000 XP.
          </p>

        </div>

      </div>

    </div>
  );
}

export default StudentAssessment;