import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaBrain,
  FaLaptopCode,
  FaCode,
  FaRobot,
  FaShieldAlt,
  FaDatabase,
  FaMobileAlt,
  FaCloud,
  FaSearch,
  FaAward,
  FaClock,
  FaCheckCircle,
} from "react-icons/fa";

function Assessment() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] =
    useState("");

  const assessments = [
    {
      id: 1,
      title: "Frontend Development Assessment",
      duration: "30 Minutes",
      questions: 30,
      passingScore: 70,
      internship: "Frontend Developer Internship",
      icon: <FaLaptopCode />,
      color: "from-blue-600 to-cyan-500",
    },

    {
      id: 2,
      title: "Backend Development Assessment",
      duration: "35 Minutes",
      questions: 35,
      passingScore: 70,
      internship: "Backend Developer Internship",
      icon: <FaCode />,
      color: "from-indigo-600 to-blue-500",
    },

    {
      id: 3,
      title: "Full Stack Assessment",
      duration: "45 Minutes",
      questions: 40,
      passingScore: 75,
      internship: "Full Stack Development Internship",
      icon: <FaCode />,
      color: "from-purple-600 to-pink-500",
    },

    {
      id: 4,
      title: "Artificial Intelligence Assessment",
      duration: "45 Minutes",
      questions: 40,
      passingScore: 80,
      internship: "AI Internship",
      icon: <FaRobot />,
      color: "from-fuchsia-600 to-purple-500",
    },

    {
      id: 5,
      title: "Data Science Assessment",
      duration: "40 Minutes",
      questions: 35,
      passingScore: 75,
      internship: "Data Science Internship",
      icon: <FaDatabase />,
      color: "from-green-600 to-emerald-500",
    },

    {
      id: 6,
      title: "Cyber Security Assessment",
      duration: "40 Minutes",
      questions: 35,
      passingScore: 75,
      internship: "Cyber Security Internship",
      icon: <FaShieldAlt />,
      color: "from-red-600 to-orange-500",
    },

    {
      id: 7,
      title: "Cloud Computing Assessment",
      duration: "35 Minutes",
      questions: 30,
      passingScore: 70,
      internship: "Cloud Computing Internship",
      icon: <FaCloud />,
      color: "from-sky-600 to-cyan-500",
    },

    {
      id: 8,
      title: "Android Development Assessment",
      duration: "35 Minutes",
      questions: 30,
      passingScore: 70,
      internship: "Android Development Internship",
      icon: <FaMobileAlt />,
      color: "from-green-600 to-lime-500",
    },
  ];

  const filteredAssessments =
    assessments.filter((item) =>
      item.title
        .toLowerCase()
        .includes(
          searchTerm.toLowerCase()
        )
    );

  return (
    <div className="min-h-screen bg-slate-50">
            {/* HERO SECTION */}

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 text-white">

        <div className="absolute inset-0">

          <div className="absolute top-20 left-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px]" />

          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[150px]" />

        </div>

        <div className="relative max-w-[1800px] mx-auto px-12 py-24">

          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* LEFT */}

            <div>

              <div className="inline-flex items-center gap-3 bg-white/10 border border-white/20 rounded-full px-6 py-3 backdrop-blur-lg">

                <FaCheckCircle className="text-green-400" />

                <span className="font-semibold">
                  AI Powered Assessment Engine
                </span>

              </div>

              <h1 className="text-7xl font-black leading-tight mt-8">

                CyberNet

                <span className="block text-cyan-400">
                  Assessment Portal
                </span>

              </h1>

              <p className="text-xl text-slate-300 leading-9 mt-8 max-w-3xl">

                Complete domain specific assessments,
                unlock internship eligibility,
                earn scholarships and start your career journey.

              </p>

              <div className="flex flex-wrap gap-5 mt-10">

                <button
                  onClick={() =>
                    document
                      .getElementById("assessment-list")
                      ?.scrollIntoView({
                        behavior: "smooth",
                      })
                  }
                  className="px-10 py-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 font-black shadow-2xl"
                >
                  Start Assessment
                </button>

                <button
                  onClick={() =>
                    navigate("/internships")
                  }
                  className="px-10 py-5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg font-bold"
                >
                  View Internships
                </button>

              </div>

            </div>

            {/* RIGHT */}

            <div>

              <div className="bg-white/10 border border-white/20 rounded-[40px] p-10 backdrop-blur-xl">

                <h2 className="text-4xl font-black">
                  Assessment Flow
                </h2>

                <div className="space-y-5 mt-10">

                  {[
                    "Register Account",
                    "Select Assessment",
                    "Complete Test",
                    "AI Evaluation",
                    "Get Score",
                    "Unlock Scholarship",
                    "Apply Internship",
                    "Make Payment",
                    "Receive Offer Letter"
                  ].map((step) => (
                    <div
                      key={step}
                      className="flex items-center gap-4"
                    >
                      <FaCheckCircle className="text-green-400" />
                      <span className="text-lg">
                        {step}
                      </span>
                    </div>
                  ))}

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* STATS */}

      <section className="py-20 bg-white">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">

            <div className="bg-white border rounded-[35px] p-10 shadow-xl">

              <FaAward className="text-5xl text-blue-600 mb-5" />

              <h2 className="text-5xl font-black">
                5000+
              </h2>

              <p className="text-slate-500 mt-3">
                Assessments Completed
              </p>

            </div>

            <div className="bg-white border rounded-[35px] p-10 shadow-xl">

              <FaBrain className="text-5xl text-purple-500 mb-5" />

              <h2 className="text-5xl font-black">
                20+
              </h2>

              <p className="text-slate-500 mt-3">
                Assessment Categories
              </p>

            </div>

            <div className="bg-white border rounded-[35px] p-10 shadow-xl">

              <FaCode className="text-5xl text-green-500 mb-5" />

              <h2 className="text-5xl font-black">
                300+
              </h2>

              <p className="text-slate-500 mt-3">
                Technical Questions
              </p>

            </div>

            <div className="bg-white border rounded-[35px] p-10 shadow-xl">

              <FaClock className="text-5xl text-orange-500 mb-5" />

              <h2 className="text-5xl font-black">
                24/7
              </h2>

              <p className="text-slate-500 mt-3">
                Assessment Access
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* SCHOLARSHIP SYSTEM */}

      <section className="py-20 bg-slate-50">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="bg-gradient-to-r from-blue-700 via-cyan-500 to-blue-700 rounded-[40px] p-12 text-white shadow-2xl">

            <div className="text-center">

              <h2 className="text-6xl font-black">
                Scholarship Program
              </h2>

              <p className="text-blue-100 text-xl mt-5">
                Score Higher. Pay Less.
              </p>

            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mt-16">

              <div className="bg-white/10 rounded-3xl p-8 text-center">

                <h3 className="text-5xl font-black">
                  90+
                </h3>

                <p className="mt-3">
                  30% Scholarship
                </p>

              </div>

              <div className="bg-white/10 rounded-3xl p-8 text-center">

                <h3 className="text-5xl font-black">
                  80+
                </h3>

                <p className="mt-3">
                  20% Scholarship
                </p>

              </div>

              <div className="bg-white/10 rounded-3xl p-8 text-center">

                <h3 className="text-5xl font-black">
                  70+
                </h3>

                <p className="mt-3">
                  10% Scholarship
                </p>

              </div>

              <div className="bg-white/10 rounded-3xl p-8 text-center">

                <h3 className="text-5xl font-black">
                  Below 70
                </h3>

                <p className="mt-3">
                  Standard Fee
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* SEARCH SECTION */}

      <section
        id="assessment-list"
        className="py-16 bg-white"
      >

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="relative">

            <FaSearch className="absolute left-5 top-5 text-slate-400 text-xl" />

            <input
              type="text"
              placeholder="Search Assessment..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(
                  e.target.value
                )
              }
              className="
              w-full
              h-16
              pl-14
              pr-5
              rounded-2xl
              border
              shadow-lg
              outline-none
              "
            />

          </div>

        </div>

      </section>
            {/* ASSESSMENT CARDS */}

      <section className="py-24 bg-slate-50">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="text-center mb-16">

            <h2 className="text-6xl font-black text-slate-900">
              Available Assessments
            </h2>

            <p className="text-slate-500 text-xl mt-5">
              Complete the assessment to unlock internships and scholarships.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-10">

            {filteredAssessments.map((item) => (

              <div
                key={item.id}
                className="
                bg-white
                rounded-[35px]
                border
                shadow-xl
                hover:-translate-y-2
                hover:shadow-2xl
                transition-all
                duration-300
                overflow-hidden
                "
              >

                {/* HEADER */}

                <div
                  className={`
                  bg-gradient-to-r
                  ${item.color}
                  text-white
                  p-8
                  `}
                >

                  <div className="flex items-center justify-between">

                    <div className="text-5xl">
                      {item.icon}
                    </div>

                    <div className="bg-white/20 px-4 py-2 rounded-full font-bold">
                      Assessment
                    </div>

                  </div>

                  <h3 className="text-3xl font-black mt-6">
                    {item.title}
                  </h3>

                </div>

                {/* BODY */}

                <div className="p-8">

                  <div className="grid grid-cols-2 gap-4">

                    <div className="bg-slate-50 rounded-2xl p-4">

                      <p className="text-slate-500 text-sm">
                        Duration
                      </p>

                      <h4 className="font-black text-lg">
                        {item.duration}
                      </h4>

                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4">

                      <p className="text-slate-500 text-sm">
                        Questions
                      </p>

                      <h4 className="font-black text-lg">
                        {item.questions}
                      </h4>

                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4">

                      <p className="text-slate-500 text-sm">
                        Passing Score
                      </p>

                      <h4 className="font-black text-lg text-green-600">
                        {item.passingScore}%
                      </h4>

                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4">

                      <p className="text-slate-500 text-sm">
                        Internship
                      </p>

                      <h4 className="font-black text-sm">
                        Eligible
                      </h4>

                    </div>

                  </div>

                  {/* INTERNSHIP */}

                  <div className="
                  mt-8
                  bg-blue-50
                  border
                  border-blue-200
                  rounded-3xl
                  p-6
                  ">

                    <h4 className="font-black text-blue-700 text-xl">
                      Unlock Internship
                    </h4>

                    <p className="text-slate-600 mt-2">
                      {item.internship}
                    </p>

                  </div>

                  {/* SCHOLARSHIP */}

                  <div className="
                  mt-6
                  bg-green-50
                  border
                  border-green-200
                  rounded-3xl
                  p-6
                  ">

                    <h4 className="font-black text-green-700 text-xl">
                      Scholarship Benefit
                    </h4>

                    <p className="text-slate-600 mt-2">
                      Up to 30% fee reduction based on score.
                    </p>

                  </div>

                  {/* RULES */}

                  <div className="
                  mt-6
                  bg-orange-50
                  border
                  border-orange-200
                  rounded-3xl
                  p-6
                  ">

                    <h4 className="font-black text-orange-700">
                      Assessment Rules
                    </h4>

                    <ul className="mt-3 space-y-2 text-slate-600 text-sm">

                      <li>
                        • Timer based examination
                      </li>

                      <li>
                        • One attempt per student
                      </li>

                      <li>
                        • Minimum passing score required
                      </li>

                      <li>
                        • Scholarship calculated automatically
                      </li>

                    </ul>

                  </div>

                  {/* BUTTONS */}

                  <div className="grid grid-cols-2 gap-4 mt-8">

                    <button
                      onClick={() =>
                        navigate("/register")
                      }
                      className="
                      h-14
                      rounded-2xl
                      border-2
                      border-blue-600
                      text-blue-600
                      font-black
                      "
                    >
                      Register
                    </button>

                    <button
                      onClick={() =>
                        navigate(
                          `/assessment/start/${item.id}`
                        )
                      }
                      className="
                      h-14
                      rounded-2xl
                      bg-gradient-to-r
                      from-blue-600
                      to-cyan-500
                      text-white
                      font-black
                      shadow-xl
                      "
                    >
                      Start Test
                    </button>

                  </div>

                </div>

              </div>

            ))}

          </div>

        </div>

      </section>

      {/* CAREER FLOW */}

      <section className="py-24 bg-white">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="text-center">

            <h2 className="text-6xl font-black text-slate-900">
              CyberNet Career Journey
            </h2>

            <p className="text-slate-500 text-xl mt-5">
              Complete the journey from assessment to certificate.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-8 mt-20">

            {[
              "Assessment",
              "Score",
              "Scholarship",
              "Internship",
              "Payment",
              "Certificate"
            ].map((step, index) => (

              <div
                key={step}
                className="
                bg-slate-50
                rounded-[35px]
                p-10
                text-center
                shadow-lg
                "
              >

                <div className="
                w-16 h-16
                rounded-full
                bg-gradient-to-r
                from-blue-600
                to-cyan-500
                text-white
                flex
                items-center
                justify-center
                font-black
                text-2xl
                mx-auto
                ">
                  {index + 1}
                </div>

                <h3 className="text-2xl font-black mt-6">
                  {step}
                </h3>

              </div>

            ))}

          </div>

        </div>

      </section>
            {/* TOP PERFORMERS */}

      <section className="py-24 bg-slate-50">

        <div className="max-w-[1800px] mx-auto px-12">

          <div className="text-center">

            <h2 className="text-6xl font-black text-slate-900">
              Top Assessment Performers
            </h2>

            <p className="text-slate-500 text-xl mt-5">
              Students achieving outstanding scores.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8 mt-20">

            <div className="bg-white rounded-[35px] p-10 shadow-xl text-center">

              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto flex items-center justify-center text-white text-4xl font-black">
                1
              </div>

              <h3 className="text-3xl font-black mt-6">
                Top Rank
              </h3>

              <p className="text-slate-500 mt-3">
                Highest Assessment Score
              </p>

            </div>

            <div className="bg-white rounded-[35px] p-10 shadow-xl text-center">

              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-slate-400 to-slate-600 mx-auto flex items-center justify-center text-white text-4xl font-black">
                2
              </div>

              <h3 className="text-3xl font-black mt-6">
                Second Rank
              </h3>

              <p className="text-slate-500 mt-3">
                Outstanding Performance
              </p>

            </div>

            <div className="bg-white rounded-[35px] p-10 shadow-xl text-center">

              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-orange-500 to-red-500 mx-auto flex items-center justify-center text-white text-4xl font-black">
                3
              </div>

              <h3 className="text-3xl font-black mt-6">
                Third Rank
              </h3>

              <p className="text-slate-500 mt-3">
                Excellent Technical Skills
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* FAQ */}

      <section className="py-24 bg-white">

        <div className="max-w-6xl mx-auto px-10">

          <div className="text-center">

            <h2 className="text-6xl font-black text-slate-900">
              Frequently Asked Questions
            </h2>

          </div>

          <div className="space-y-6 mt-16">

            <div className="bg-slate-50 rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                Is assessment mandatory?
              </h3>

              <p className="text-slate-600 mt-4">
                Yes. Assessment completion is required before internship enrollment.
              </p>

            </div>

            <div className="bg-slate-50 rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                How is scholarship calculated?
              </h3>

              <p className="text-slate-600 mt-4">
                Scholarship percentage is based on your final assessment score.
              </p>

            </div>

            <div className="bg-slate-50 rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                Can I retake the assessment?
              </h3>

              <p className="text-slate-600 mt-4">
                Assessment attempts can be restricted according to program rules.
              </p>

            </div>

            <div className="bg-slate-50 rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                What happens after passing?
              </h3>

              <p className="text-slate-600 mt-4">
                Internship application, payment, offer letter and dashboard access are unlocked.
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* FINAL CTA */}

      <section className="py-28 bg-gradient-to-r from-blue-900 via-blue-700 to-cyan-500 text-white">

        <div className="max-w-6xl mx-auto px-10 text-center">

          <h2 className="text-7xl font-black">
            Ready To Take
            <span className="block">
              Your Assessment?
            </span>
          </h2>

          <p className="text-xl text-blue-100 mt-8">
            Complete the assessment, unlock scholarship benefits and start your internship journey.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mt-12">

            <button
              onClick={() =>
                document
                  .getElementById("assessment-list")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="px-10 py-5 rounded-2xl bg-white text-blue-700 font-black shadow-xl"
            >
              Start Assessment
            </button>

            <button
              onClick={() =>
                navigate("/internships")
              }
              className="px-10 py-5 rounded-2xl border border-white text-white font-black"
            >
              View Internships
            </button>

          </div>

        </div>

      </section>

    </div>
  );
}

export default Assessment;