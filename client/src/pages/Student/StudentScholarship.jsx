import React, { useState } from "react";
import {
  Award,
  Trophy,
  Search,
  Star,
  Calendar,
  CheckCircle,
  TrendingUp,
  IndianRupee,
} from "lucide-react";

function StudentScholarship() {
  const [search, setSearch] = useState("");

  const scholarships = [
    {
      id: 1,
      title: "CyberNet Merit Scholarship",
      amount: "₹25,000",
      eligibility: "Above 85%",
      deadline: "30 June 2026",
      status: "Approved",
      progress: 100,
    },
    {
      id: 2,
      title: "Full Stack Excellence Scholarship",
      amount: "₹15,000",
      eligibility: "React + Node Students",
      deadline: "15 July 2026",
      status: "Under Review",
      progress: 70,
    },
    {
      id: 3,
      title: "AI Innovation Scholarship",
      amount: "₹20,000",
      eligibility: "AI Assessment > 90%",
      deadline: "20 July 2026",
      status: "Pending",
      progress: 40,
    },
  ];

  const filteredScholarships = scholarships.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6">

      {/* Header */}

      <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-3xl p-8 text-white shadow-xl">

        <div className="flex justify-between items-center">

          <div>
            <h1 className="text-4xl font-bold">
              Scholarship Portal
            </h1>

            <p className="mt-2 text-purple-100">
              Apply and Track Scholarship Progress
            </p>
          </div>

          <Award size={70} />
        </div>

      </div>

      {/* Statistics Cards */}

      <div className="grid md:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <IndianRupee className="text-green-600 mb-3" size={35} />
          <h2 className="text-3xl font-bold">₹60K</h2>
          <p className="text-gray-500">Scholarships Earned</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Trophy className="text-yellow-500 mb-3" size={35} />
          <h2 className="text-3xl font-bold">12</h2>
          <p className="text-gray-500">Awards Won</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Star className="text-purple-600 mb-3" size={35} />
          <h2 className="text-3xl font-bold">98%</h2>
          <p className="text-gray-500">Performance Score</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <TrendingUp className="text-blue-600 mb-3" size={35} />
          <h2 className="text-3xl font-bold">Top 5%</h2>
          <p className="text-gray-500">Student Ranking</p>
        </div>

      </div>
            {/* Search Bar */}

      <div className="bg-white rounded-3xl shadow-lg p-6 mt-8">

        <div className="flex items-center gap-4">

          <Search className="text-gray-500" />

          <input
            type="text"
            placeholder="Search Scholarships..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full outline-none text-lg"
          />

        </div>

      </div>

      {/* Scholarship Cards */}

      <div className="grid lg:grid-cols-2 gap-8 mt-8">

        {filteredScholarships.map((item) => (

          <div
            key={item.id}
            className="bg-white rounded-3xl shadow-lg p-8 hover:shadow-2xl transition"
          >

            <div className="flex justify-between items-start">

              <div>

                <h2 className="text-2xl font-bold">
                  {item.title}
                </h2>

                <p className="text-green-600 font-semibold mt-2">
                  {item.amount}
                </p>

              </div>

              <Award
                className="text-purple-600"
                size={40}
              />

            </div>

            <div className="mt-6 space-y-3">

              <p className="text-gray-600">
                <strong>Eligibility:</strong>{" "}
                {item.eligibility}
              </p>

              <div className="flex items-center gap-2 text-gray-600">

                <Calendar size={18} />

                <span>
                  Deadline: {item.deadline}
                </span>

              </div>

              <div className="flex items-center gap-2">

                <CheckCircle
                  size={18}
                  className="text-green-600"
                />

                <span className="font-semibold">
                  {item.status}
                </span>

              </div>

            </div>

            <div className="mt-6">

              <div className="flex justify-between mb-2">

                <span>Application Progress</span>

                <span>{item.progress}%</span>

              </div>

              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">

                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-500"
                  style={{
                    width: `${item.progress}%`,
                  }}
                ></div>

              </div>

            </div>
                        <div className="flex gap-3 mt-6">

              <button className="flex-1 bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl font-semibold hover:scale-105 transition">
                Apply Now
              </button>

              <button className="px-6 py-3 border-2 border-purple-500 text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition">
                Details
              </button>

            </div>

          </div>

        ))}

      </div>

      {/* Scholarship Tips */}

      <div className="bg-white rounded-3xl shadow-lg p-8 mt-8">

        <h2 className="text-2xl font-bold mb-6">
          Scholarship Success Tips
        </h2>

        <div className="grid md:grid-cols-3 gap-6">

          <div className="border rounded-2xl p-6 hover:shadow-lg transition">

            <Star
              className="text-yellow-500 mb-4"
              size={35}
            />

            <h3 className="font-bold text-lg">
              Maintain High Scores
            </h3>

            <p className="text-gray-600 mt-2">
              Keep your assessment score above
              85% to maximize scholarship
              opportunities.
            </p>

          </div>

          <div className="border rounded-2xl p-6 hover:shadow-lg transition">

            <Trophy
              className="text-orange-500 mb-4"
              size={35}
            />

            <h3 className="font-bold text-lg">
              Complete Internships
            </h3>

            <p className="text-gray-600 mt-2">
              Internship completion adds
              significant weight to scholarship
              applications.
            </p>

          </div>

          <div className="border rounded-2xl p-6 hover:shadow-lg transition">

            <TrendingUp
              className="text-green-600 mb-4"
              size={35}
            />

            <h3 className="font-bold text-lg">
              Stay Consistent
            </h3>

            <p className="text-gray-600 mt-2">
              Daily task completion and coding
              practice improve your ranking.
            </p>

          </div>

        </div>

      </div>
            {/* Recent Scholarship Activity */}

      <div className="bg-white rounded-3xl shadow-lg p-8 mt-8">

        <h2 className="text-2xl font-bold mb-6">
          Recent Scholarship Activity
        </h2>

        <div className="space-y-4">

          {[
            "CyberNet Merit Scholarship Approved",
            "AI Innovation Scholarship Submitted",
            "Full Stack Scholarship Under Review",
            "React Excellence Scholarship Earned",
            "Profile Verification Completed",
          ].map((activity, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-b pb-4"
            >

              <div className="w-3 h-3 rounded-full bg-purple-600"></div>

              <p className="text-slate-700">
                {activity}
              </p>

            </div>
          ))}

        </div>

      </div>

    </div>
  );
}

export default StudentScholarship;