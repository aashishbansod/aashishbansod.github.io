import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  Trophy,
  Search,
  Star,
  Calendar,
  CheckCircle,
  TrendingUp,
  IndianRupee,
  Loader2,
  RefreshCw,
} from "lucide-react";

import api from "../../services/api";

function StudentScholarship() {
  const [loading, setLoading] = useState(true);
  const [scholarships, setScholarships] = useState([]);
  const [search, setSearch] = useState("");

  const [stats, setStats] = useState({
    totalScholarship: 0,
    scholarshipPercentage: 0,
    assessmentScore: 0,
    rank: "N/A",
  });

  const loadData = async () => {
    try {
      setLoading(true);

      const profileRes = await api.get("/student/profile");

      const student =
        profileRes?.data?.student ||
        profileRes?.data?.user ||
        {};

      const scholarshipAmount =
        student.scholarshipAmount || 0;

      const scholarshipPercentage =
        student.scholarshipPercentage || 0;

      const assessmentScore =
        student.assessmentScore || 0;

      setStats({
        totalScholarship: scholarshipAmount,
        scholarshipPercentage,
        assessmentScore,
        rank: "Top Performer",
      });

      setScholarships([
        {
          id: 1,
          title: "CyberNet Merit Scholarship",
          amount: `₹${scholarshipAmount}`,
          eligibility: `Assessment Score ${assessmentScore}%`,
          deadline: "Active",
          status:
            scholarshipPercentage > 0
              ? "Approved"
              : "Not Eligible",
          progress: scholarshipPercentage,
        },
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredScholarships = useMemo(() => {
    return scholarships.filter((item) =>
      item.title
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [scholarships, search]);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2
          size={45}
          className="animate-spin text-blue-600"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">

      <div className="bg-gradient-to-r from-purple-700 via-pink-600 to-rose-500 rounded-3xl p-8 text-white shadow-xl">

        <div className="flex justify-between items-center">

          <div>
            <h1 className="text-4xl font-bold">
              Scholarship Portal
            </h1>

            <p className="mt-2 text-purple-100">
              CyberNet Scholarship Dashboard
            </p>
          </div>

          <Award size={65} />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <IndianRupee
            className="text-green-600 mb-3"
            size={35}
          />
          <h2 className="text-3xl font-bold">
            ₹{stats.totalScholarship}
          </h2>
          <p className="text-gray-500">
            Scholarship Earned
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Trophy
            className="text-yellow-500 mb-3"
            size={35}
          />
          <h2 className="text-3xl font-bold">
            {stats.scholarshipPercentage}%
          </h2>
          <p className="text-gray-500">
            Scholarship %
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <Star
            className="text-purple-600 mb-3"
            size={35}
          />
          <h2 className="text-3xl font-bold">
            {stats.assessmentScore}%
          </h2>
          <p className="text-gray-500">
            Assessment Score
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">
          <TrendingUp
            className="text-blue-600 mb-3"
            size={35}
          />
          <h2 className="text-3xl font-bold">
            {stats.rank}
          </h2>
          <p className="text-gray-500">
            Performance Rank
          </p>
        </div>

      </div>

      <div className="bg-white rounded-3xl shadow-lg p-6 mt-8">

        <div className="flex items-center gap-3">

          <Search />

          <input
            type="text"
            placeholder="Search Scholarship..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full outline-none"
          />

          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            <RefreshCw size={18} />
          </button>

        </div>

      </div>

      <div className="grid lg:grid-cols-2 gap-8 mt-8">

        {filteredScholarships.map(
          (item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl shadow-lg p-8"
            >
              <div className="flex justify-between">

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

                <p>
                  <strong>
                    Eligibility:
                  </strong>{" "}
                  {item.eligibility}
                </p>

                <div className="flex items-center gap-2">

                  <Calendar size={18} />

                  <span>
                    {item.deadline}
                  </span>

                </div>

                <div className="flex items-center gap-2">

                  <CheckCircle
                    size={18}
                    className="text-green-600"
                  />

                  <span>
                    {item.status}
                  </span>

                </div>

              </div>

              <div className="mt-5">

                <div className="flex justify-between mb-2">
                  <span>
                    Scholarship Progress
                  </span>

                  <span>
                    {item.progress}%
                  </span>
                </div>

                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">

                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-500"
                    style={{
                      width: `${item.progress}%`,
                    }}
                  />

                </div>

              </div>

            </div>
          )
        )}

      </div>

    </div>
  );
}

export default StudentScholarship;