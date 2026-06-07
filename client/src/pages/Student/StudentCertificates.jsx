import React, { useState } from "react";
import {
  Award,
  Download,
  Search,
  Trophy,
  Star,
  Medal,
  CheckCircle,
  Calendar,
} from "lucide-react";

function StudentCertificates() {
  const [search, setSearch] = useState("");

  const certificates = [
    {
      id: 1,
      title: "HTML & CSS Internship",
      issueDate: "10 June 2026",
      credential: "CNT-HTML-2026",
      status: "Verified",
      xp: 500,
    },
    {
      id: 2,
      title: "JavaScript Mastery",
      issueDate: "15 June 2026",
      credential: "CNT-JS-2026",
      status: "Verified",
      xp: 700,
    },
    {
      id: 3,
      title: "React JS Internship",
      issueDate: "25 June 2026",
      credential: "CNT-REACT-2026",
      status: "In Progress",
      xp: 1200,
    },
    {
      id: 4,
      title: "Full Stack Development",
      issueDate: "Upcoming",
      credential: "CNT-FULLSTACK-2026",
      status: "Locked",
      xp: 2500,
    },
  ];

  const filteredCertificates = certificates.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-7xl mx-auto">

        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl p-8 text-white shadow-xl mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold">
                My Certificates
              </h1>

              <p className="mt-2 text-blue-100">
                Download and verify all earned certificates
              </p>
            </div>

            <Award size={60} />
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <Trophy className="text-yellow-500 mb-3" size={35} />
            <h2 className="text-3xl font-bold">12</h2>
            <p className="text-gray-500">Certificates Earned</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <Star className="text-purple-500 mb-3" size={35} />
            <h2 className="text-3xl font-bold">5200</h2>
            <p className="text-gray-500">XP Earned</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <Medal className="text-green-500 mb-3" size={35} />
            <h2 className="text-3xl font-bold">4</h2>
            <p className="text-gray-500">Badges Unlocked</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <CheckCircle
              className="text-blue-500 mb-3"
              size={35}
            />
            <h2 className="text-3xl font-bold">100%</h2>
            <p className="text-gray-500">Verification Rate</p>
          </div>

        </div>
                <div className="bg-white rounded-2xl p-5 shadow-lg mb-8">
          <div className="flex items-center gap-3">

            <Search className="text-gray-500" size={22} />

            <input
              type="text"
              placeholder="Search certificates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full outline-none border border-gray-300 rounded-xl px-4 py-3"
            />

          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          {filteredCertificates.map((certificate) => (
            <div
              key={certificate.id}
              className="bg-white rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300"
            >

              <div className="flex justify-between items-start mb-5">

                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {certificate.title}
                  </h2>

                  <p className="text-gray-500 mt-1">
                    Credential ID : {certificate.credential}
                  </p>
                </div>

                <Award
                  className="text-blue-600"
                  size={40}
                />

              </div>

              <div className="space-y-3">

                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={18} />
                  <span>
                    Issue Date : {certificate.issueDate}
                  </span>
                </div>

                <div className="flex items-center justify-between">

                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      certificate.status === "Verified"
                        ? "bg-green-100 text-green-700"
                        : certificate.status === "In Progress"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {certificate.status}
                  </span>

                  <span className="font-bold text-purple-600">
                    +{certificate.xp} XP
                  </span>

                </div>

              </div>

              <div className="mt-6 flex gap-3">
                                {certificate.status === "Verified" && (
                  <>
                    <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition">
                      View Certificate
                    </button>

                    <button className="bg-green-600 hover:bg-green-700 text-white px-5 rounded-xl transition">
                      <Download size={20} />
                    </button>
                  </>
                )}

                {certificate.status === "In Progress" && (
                  <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-semibold transition">
                    Continue Internship
                  </button>
                )}

                {certificate.status === "Locked" && (
                  <button className="w-full bg-gray-400 text-white py-3 rounded-xl font-semibold cursor-not-allowed">
                    Locked
                  </button>
                )}
              </div>

            </div>
          ))}

        </div>

        <div className="mt-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-8 text-white shadow-xl">

          <h2 className="text-3xl font-bold mb-4">
            Premium Achievement Center
          </h2>

          <p className="text-lg text-purple-100 mb-6">
            Complete internships, coding challenges, assessments and projects
            to unlock premium certificates recognized by companies.
          </p>

          <div className="grid md:grid-cols-3 gap-5">

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
              <h3 className="text-xl font-bold mb-2">
                Bronze Level
              </h3>
              <p>5 Certificates Required</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
              <h3 className="text-xl font-bold mb-2">
                Silver Level
              </h3>
              <p>10 Certificates Required</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5">
              <h3 className="text-xl font-bold mb-2">
                Gold Level
              </h3>
              <p>20 Certificates Required</p>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default StudentCertificates;