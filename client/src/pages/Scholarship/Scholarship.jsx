import React, { useState, useEffect } from "react";
import {
  FaGraduationCap,
  FaAward,
  FaPercent,
  FaSearch,
  FaTrophy,
  FaCheckCircle,
  FaRupeeSign,
  FaUserGraduate,
} from "react-icons/fa";

const Scholarship = () => {
  const [search, setSearch] = useState("");

  // Assessment Score
  const [assessmentScore, setAssessmentScore] =
    useState(92);

  const internshipFee = 999;

  useEffect(() => {
    const savedScore =
      localStorage.getItem(
        "assessmentScore"
      );

    if (savedScore) {
      setAssessmentScore(
        Number(savedScore)
      );
    }
  }, []);

  const getScholarshipPercent = () => {
    if (assessmentScore >= 95)
      return 30;

    if (assessmentScore >= 90)
      return 25;

    if (assessmentScore >= 85)
      return 20;

    if (assessmentScore >= 80)
      return 10;

    return 0;
  };

  const scholarshipPercent =
    getScholarshipPercent();

  const discountAmount =
    Math.round(
      (internshipFee *
        scholarshipPercent) /
        100
    );

  const finalFee =
    internshipFee -
    discountAmount;

  const scholarshipLevel =
    assessmentScore >= 95
      ? "Platinum Scholar"
      : assessmentScore >= 90
      ? "Gold Scholar"
      : assessmentScore >= 85
      ? "Silver Scholar"
      : assessmentScore >= 80
      ? "Bronze Scholar"
      : "Not Eligible";

  const scholarships = [
    {
      id: 1,
      title:
        "Bronze Scholarship",
      minScore: 80,
      discount: "10%",
      color:
        "from-green-500 to-emerald-600",
    },

    {
      id: 2,
      title:
        "Silver Scholarship",
      minScore: 85,
      discount: "20%",
      color:
        "from-blue-500 to-cyan-600",
    },

    {
      id: 3,
      title:
        "Gold Scholarship",
      minScore: 90,
      discount: "25%",
      color:
        "from-purple-500 to-pink-600",
    },

    {
      id: 4,
      title:
        "Platinum Scholarship",
      minScore: 95,
      discount: "30%",
      color:
        "from-yellow-500 to-orange-500",
    },
  ];

  const filteredScholarships =
    scholarships.filter((item) =>
      item.title
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HERO */}

      <section className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-cyan-700 to-blue-500 py-24">

        <div className="absolute top-0 left-0 w-full h-full">

          <div className="absolute top-20 left-20 w-80 h-80 bg-cyan-400/20 rounded-full blur-[120px]" />

          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-300/20 rounded-full blur-[150px]" />

        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">

          <div className="grid lg:grid-cols-2 gap-14 items-center">

            {/* LEFT */}

            <div className="text-white">

              <div className="inline-flex items-center gap-3 bg-white/15 backdrop-blur-xl px-6 py-3 rounded-full mb-8">

                <FaAward />

                <span>
                  CyberNet Scholarship
                  Program 2026
                </span>

              </div>

              <h1 className="text-6xl md:text-7xl font-black leading-tight">

                Unlock
                <span className="block text-cyan-300">
                  Scholarship
                </span>

                Through Assessment
              </h1>

              <p className="text-xl text-blue-100 mt-8 leading-9">

                Complete the
                CyberNet Assessment,
                score high and get
                internship fee
                discounts, offer
                letter benefits and
                priority internship
                access.

              </p>

              <div className="flex flex-wrap gap-5 mt-10">

                <div className="bg-green-500 text-white px-6 py-3 rounded-2xl font-bold shadow-xl">

                  Assessment Score:
                  {" "}
                  {assessmentScore}%

                </div>

                <div className="bg-yellow-400 text-black px-6 py-3 rounded-2xl font-black shadow-xl">

                  {scholarshipPercent}%
                  Scholarship

                </div>

              </div>

            </div>

            {/* RIGHT */}

            <div className="bg-white rounded-[40px] shadow-2xl p-10">

              <div className="flex justify-between items-center">

                <h2 className="text-3xl font-black text-slate-900">
                  Your Scholarship
                </h2>

                <FaTrophy className="text-4xl text-yellow-500" />

              </div>

              <div className="mt-8 space-y-5">

                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Assessment Score
                  </span>

                  <span className="font-black text-blue-600">
                    {assessmentScore}%
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Scholarship Level
                  </span>

                  <span className="font-black text-green-600">
                    {scholarshipLevel}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Internship Fee
                  </span>

                  <span className="font-black">
                    ₹{internshipFee}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Discount
                  </span>

                  <span className="font-black text-green-600">
                    -₹{discountAmount}
                  </span>

                </div>

                <div className="border-t pt-5 flex justify-between">

                  <span className="text-xl font-black">
                    Final Payable
                  </span>

                  <span className="text-3xl font-black text-blue-700">
                    ₹{finalFee}
                  </span>

                </div>

              </div>

              <button className="w-full mt-8 h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-xl">
                Apply Scholarship
              </button>

            </div>

          </div>

          {/* SEARCH */}

          <div className="max-w-3xl mx-auto mt-20 relative">

            <FaSearch className="absolute left-5 top-5 text-slate-500 text-lg" />

            <input
              type="text"
              placeholder="Search scholarship program..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="w-full h-16 rounded-2xl pl-14 pr-5 outline-none text-black shadow-2xl"
            />

          </div>

        </div>

      </section>

      {/* STATS SECTION */}

      <section className="max-w-7xl mx-auto px-6 py-20">

        <div className="grid md:grid-cols-4 gap-8">

          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <FaGraduationCap className="text-5xl text-blue-600" />

            <h2 className="text-5xl font-black mt-4">
              80%
            </h2>

            <p className="text-slate-500">
              Minimum Score
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <FaPercent className="text-5xl text-green-600" />

            <h2 className="text-5xl font-black mt-4">
              30%
            </h2>

            <p className="text-slate-500">
              Max Scholarship
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <FaUserGraduate className="text-5xl text-purple-600" />

            <h2 className="text-5xl font-black mt-4">
              5000+
            </h2>

            <p className="text-slate-500">
              Students
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <FaRupeeSign className="text-5xl text-orange-600" />

            <h2 className="text-5xl font-black mt-4">
              ₹250
            </h2>

            <p className="text-slate-500">
              Average Saving
            </p>
          </div>

        </div>

      </section>

      {/* PART B YAHAN SE START HOGA */}
            {/* SCHOLARSHIP PROGRAMS */}

      <section className="max-w-7xl mx-auto px-6 pb-24">

        <div className="flex items-center justify-between mb-12">

          <div>

            <h2 className="text-5xl font-black text-slate-900">
              Scholarship Programs
            </h2>

            <p className="text-slate-500 mt-3 text-lg">
              Assessment performance ke basis par scholarship unlock karo.
            </p>

          </div>

          <div className="hidden md:flex items-center gap-3 bg-green-100 text-green-700 px-5 py-3 rounded-2xl font-bold">
            <FaCheckCircle />
            Active Scholarship Programs
          </div>

        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">

          {filteredScholarships.map((item) => (

            <div
              key={item.id}
              className="bg-white rounded-[32px] shadow-xl overflow-hidden hover:-translate-y-2 transition-all duration-300"
            >

              <div
                className={`h-3 bg-gradient-to-r ${item.color}`}
              />

              <div className="p-8">

                <div
                  className={`w-20 h-20 rounded-3xl bg-gradient-to-r ${item.color} text-white flex items-center justify-center text-4xl mb-6`}
                >
                  <FaAward />
                </div>

                <h3 className="text-2xl font-black text-slate-900">
                  {item.title}
                </h3>

                <div className="space-y-4 mt-8">

                  <div className="flex justify-between">

                    <span className="text-slate-500">
                      Required Score
                    </span>

                    <span className="font-black text-blue-600">
                      {item.minScore}%+
                    </span>

                  </div>

                  <div className="flex justify-between">

                    <span className="text-slate-500">
                      Scholarship
                    </span>

                    <span className="font-black text-green-600">
                      {item.discount}
                    </span>

                  </div>

                  <div className="flex justify-between">

                    <span className="text-slate-500">
                      Internship Fee
                    </span>

                    <span className="font-black">
                      ₹999
                    </span>

                  </div>

                </div>

                <button
                  className={`mt-8 w-full py-4 rounded-2xl text-white font-bold bg-gradient-to-r ${item.color}`}
                >
                  Check Eligibility
                </button>

              </div>

            </div>

          ))}

        </div>

      </section>

      {/* SCHOLARSHIP SLABS */}

      <section className="bg-white py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Scholarship Slabs
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Assessment score ke basis par automatic scholarship calculation.
            </p>

          </div>

          <div className="grid md:grid-cols-4 gap-8">

            <div className="bg-green-50 border border-green-200 rounded-3xl p-8">

              <div className="text-green-600 text-5xl mb-6">
                🥉
              </div>

              <h3 className="text-3xl font-black text-green-700">
                Bronze
              </h3>

              <div className="text-5xl font-black mt-4 text-green-600">
                10%
              </div>

              <p className="mt-4 text-slate-600">
                80% - 84%
              </p>

            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-3xl p-8">

              <div className="text-blue-600 text-5xl mb-6">
                🥈
              </div>

              <h3 className="text-3xl font-black text-blue-700">
                Silver
              </h3>

              <div className="text-5xl font-black mt-4 text-blue-600">
                20%
              </div>

              <p className="mt-4 text-slate-600">
                85% - 89%
              </p>

            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-3xl p-8">

              <div className="text-purple-600 text-5xl mb-6">
                🥇
              </div>

              <h3 className="text-3xl font-black text-purple-700">
                Gold
              </h3>

              <div className="text-5xl font-black mt-4 text-purple-600">
                25%
              </div>

              <p className="mt-4 text-slate-600">
                90% - 94%
              </p>

            </div>

            <div className="bg-yellow-50 border border-yellow-300 rounded-3xl p-8">

              <div className="text-yellow-600 text-5xl mb-6">
                👑
              </div>

              <h3 className="text-3xl font-black text-yellow-700">
                Platinum
              </h3>

              <div className="text-5xl font-black mt-4 text-yellow-600">
                30%
              </div>

              <p className="mt-4 text-slate-600">
                95%+
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* LIVE SCHOLARSHIP CALCULATOR */}

      <section className="bg-slate-50 py-24">

        <div className="max-w-5xl mx-auto px-6">

          <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-500 rounded-[40px] p-12 text-white shadow-2xl">

            <h2 className="text-5xl font-black text-center">
              Live Scholarship Calculator
            </h2>

            <p className="text-center mt-4 text-blue-100">
              Assessment score ke hisab se fee automatically calculate hoti hai.
            </p>

            <div className="grid md:grid-cols-4 gap-6 mt-12">

              <div className="bg-white/10 rounded-3xl p-6 text-center">

                <h3 className="text-4xl font-black">
                  {assessmentScore}%
                </h3>

                <p className="mt-2">
                  Score
                </p>

              </div>

              <div className="bg-white/10 rounded-3xl p-6 text-center">

                <h3 className="text-4xl font-black">
                  {scholarshipPercent}%
                </h3>

                <p className="mt-2">
                  Scholarship
                </p>

              </div>

              <div className="bg-white/10 rounded-3xl p-6 text-center">

                <h3 className="text-4xl font-black">
                  ₹{discountAmount}
                </h3>

                <p className="mt-2">
                  Saving
                </p>

              </div>

              <div className="bg-white/10 rounded-3xl p-6 text-center">

                <h3 className="text-4xl font-black">
                  ₹{finalFee}
                </h3>

                <p className="mt-2">
                  Payable
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* PART C YAHAN SE START HOGA */}
            {/* TOP SCHOLARS */}

      <section className="bg-white py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Top Scholarship Achievers
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Highest assessment performers of CyberNet Internship Program.
            </p>

          </div>

          <div className="overflow-hidden bg-white rounded-[40px] shadow-2xl">

            <table className="w-full">

              <thead className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white">

                <tr>
                  <th className="p-6 text-left">Rank</th>
                  <th className="p-6 text-left">Student</th>
                  <th className="p-6 text-left">Assessment Score</th>
                  <th className="p-6 text-left">Scholarship</th>
                  <th className="p-6 text-left">Level</th>
                </tr>

              </thead>

              <tbody>

                <tr className="border-b">

                  <td className="p-6 font-black">
                    🥇 #1
                  </td>

                  <td className="p-6">
                    Rahul Sharma
                  </td>

                  <td className="p-6 text-green-600 font-bold">
                    98%
                  </td>

                  <td className="p-6 text-blue-600 font-bold">
                    30%
                  </td>

                  <td className="p-6">
                    Platinum
                  </td>

                </tr>

                <tr className="border-b">

                  <td className="p-6 font-black">
                    🥈 #2
                  </td>

                  <td className="p-6">
                    Priya Verma
                  </td>

                  <td className="p-6 text-green-600 font-bold">
                    96%
                  </td>

                  <td className="p-6 text-blue-600 font-bold">
                    30%
                  </td>

                  <td className="p-6">
                    Platinum
                  </td>

                </tr>

                <tr className="border-b">

                  <td className="p-6 font-black">
                    🥉 #3
                  </td>

                  <td className="p-6">
                    Aman Gupta
                  </td>

                  <td className="p-6 text-green-600 font-bold">
                    93%
                  </td>

                  <td className="p-6 text-blue-600 font-bold">
                    25%
                  </td>

                  <td className="p-6">
                    Gold
                  </td>

                </tr>

                <tr>

                  <td className="p-6 font-black">
                    ⭐ #4
                  </td>

                  <td className="p-6">
                    Neha Patil
                  </td>

                  <td className="p-6 text-green-600 font-bold">
                    89%
                  </td>

                  <td className="p-6 text-blue-600 font-bold">
                    20%
                  </td>

                  <td className="p-6">
                    Silver
                  </td>

                </tr>

              </tbody>

            </table>

          </div>

        </div>

      </section>

      {/* SCHOLARSHIP BENEFITS */}

      <section className="bg-slate-50 py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Scholarship Benefits
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Scholarship students receive additional career advantages.
            </p>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">

            <div className="bg-white rounded-[32px] p-8 shadow-xl">

              <div className="text-6xl">
                💰
              </div>

              <h3 className="text-2xl font-black mt-6">
                Internship Fee Discount
              </h3>

              <p className="text-slate-600 mt-4">
                Up to 30% fee reduction based on assessment score.
              </p>

            </div>

            <div className="bg-white rounded-[32px] p-8 shadow-xl">

              <div className="text-6xl">
                🎓
              </div>

              <h3 className="text-2xl font-black mt-6">
                Verified Certificate
              </h3>

              <p className="text-slate-600 mt-4">
                Industry-recognized internship certificate.
              </p>

            </div>

            <div className="bg-white rounded-[32px] p-8 shadow-xl">

              <div className="text-6xl">
                🚀
              </div>

              <h3 className="text-2xl font-black mt-6">
                Priority Internship Access
              </h3>

              <p className="text-slate-600 mt-4">
                Faster approval and internship allocation.
              </p>

            </div>

            <div className="bg-white rounded-[32px] p-8 shadow-xl">

              <div className="text-6xl">
                👨‍🏫
              </div>

              <h3 className="text-2xl font-black mt-6">
                Mentor Support
              </h3>

              <p className="text-slate-600 mt-4">
                Direct guidance from industry professionals.
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* SCHOLARSHIP ROADMAP */}

      <section className="bg-white py-24">

        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Scholarship Workflow
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Complete process from assessment to internship.
            </p>

          </div>

          <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-6">

            <div className="bg-blue-50 rounded-3xl p-6 text-center">
              <div className="text-5xl">1️⃣</div>
              <h3 className="font-black mt-4">
                Register
              </h3>
            </div>

            <div className="bg-blue-50 rounded-3xl p-6 text-center">
              <div className="text-5xl">2️⃣</div>
              <h3 className="font-black mt-4">
                Assessment
              </h3>
            </div>

            <div className="bg-blue-50 rounded-3xl p-6 text-center">
              <div className="text-5xl">3️⃣</div>
              <h3 className="font-black mt-4">
                Score
              </h3>
            </div>

            <div className="bg-blue-50 rounded-3xl p-6 text-center">
              <div className="text-5xl">4️⃣</div>
              <h3 className="font-black mt-4">
                Scholarship
              </h3>
            </div>

            <div className="bg-blue-50 rounded-3xl p-6 text-center">
              <div className="text-5xl">5️⃣</div>
              <h3 className="font-black mt-4">
                Internship
              </h3>
            </div>

            <div className="bg-blue-50 rounded-3xl p-6 text-center">
              <div className="text-5xl">6️⃣</div>
              <h3 className="font-black mt-4">
                Certificate
              </h3>
            </div>

          </div>

        </div>

      </section>

      {/* PART D YAHAN SE START HOGA */}
            {/* FAQ SECTION */}

      <section className="bg-slate-50 py-24">

        <div className="max-w-5xl mx-auto px-6">

          <div className="text-center mb-16">

            <h2 className="text-5xl font-black text-slate-900">
              Frequently Asked Questions
            </h2>

            <p className="text-slate-500 text-lg mt-4">
              Scholarship related common questions.
            </p>

          </div>

          <div className="space-y-6">

            <div className="bg-white rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                How can I get a scholarship?
              </h3>

              <p className="text-slate-600 mt-4">
                Complete the CyberNet Assessment and achieve the required score.
              </p>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                Is scholarship guaranteed?
              </h3>

              <p className="text-slate-600 mt-4">
                Scholarship depends on assessment performance and eligibility criteria.
              </p>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                Can scholarship be combined with offers?
              </h3>

              <p className="text-slate-600 mt-4">
                Generally scholarship discounts are applied separately from promotional offers.
              </p>

            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg">

              <h3 className="text-2xl font-black">
                Will I receive a certificate?
              </h3>

              <p className="text-slate-600 mt-4">
                Yes, after successful internship completion you receive a verified certificate.
              </p>

            </div>

          </div>

        </div>

      </section>

      {/* FINAL CTA */}

      <section className="bg-gradient-to-r from-blue-900 via-cyan-700 to-blue-500 py-28 text-white">

        <div className="max-w-6xl mx-auto px-6 text-center">

          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full">

            <FaAward />

            <span>
              CyberNet Scholarship Program
            </span>

          </div>

          <h2 className="text-7xl font-black mt-8 leading-tight">

            Start Your Journey

            <span className="block text-cyan-300">
              With Scholarship Benefits
            </span>

          </h2>

          <p className="text-xl text-blue-100 mt-8 max-w-4xl mx-auto leading-9">

            Take the assessment, unlock scholarships,
            reduce internship fees and gain access
            to premium internship opportunities.

          </p>

          <div className="flex flex-wrap justify-center gap-6 mt-12">

            <button
              onClick={() =>
                window.location.href =
                  "/assessment"
              }
              className="
              px-10
              py-5
              rounded-2xl
              bg-white
              text-blue-700
              font-black
              shadow-2xl
              "
            >
              Take Assessment
            </button>

            <button
              onClick={() =>
                window.location.href =
                  "/internships"
              }
              className="
              px-10
              py-5
              rounded-2xl
              border
              border-white
              font-black
              "
            >
              View Internships
            </button>

          </div>

        </div>

      </section>

    </div>
  );
};

export default Scholarship;