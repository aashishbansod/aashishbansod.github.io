import React, { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Medal,
  Crown,
  Star,
  Flame,
  Search,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import api from "../../services/api";

function StudentLeaderboard() {
  const [loading, setLoading] = useState(true);
  const [leaders, setLeaders] = useState([]);
  const [search, setSearch] = useState("");

  const [myStats, setMyStats] = useState({
    rank: "-",
    xp: 0,
    tasksCompleted: 0,
    badge: "Starter",
  });

  const loadLeaderboard = async () => {
    try {
      setLoading(true);

      const [leaderboardRes, statsRes] =
        await Promise.all([
          api.get("/student/leaderboard"),
          api.get("/student/stats"),
        ]);

      const leaderboard =
        leaderboardRes?.data?.leaderboard ||
        leaderboardRes?.data?.students ||
        [];

      setLeaders(leaderboard);

      const stats =
        statsRes?.data?.stats || {};

      setMyStats({
        rank: stats.rank || "-",
        xp: stats.totalXP || 0,
        tasksCompleted:
          stats.completedTasks || 0,
        badge:
          stats.badge || "Starter",
      });
    } catch (error) {
      console.error(error);

      setLeaders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const filteredLeaders = useMemo(() => {
    return leaders.filter((student) =>
      `${student.firstName || ""} ${
        student.lastName || ""
      }`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [leaders, search]);

  const getBadgeColor = (badge) => {
    switch (badge) {
      case "Diamond":
        return "text-cyan-500";
      case "Platinum":
        return "text-slate-500";
      case "Gold":
        return "text-yellow-500";
      case "Silver":
        return "text-gray-500";
      default:
        return "text-blue-500";
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2
          className="animate-spin text-blue-600"
          size={50}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">

      {/* Hero */}

      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 rounded-3xl p-8 text-white shadow-xl">

        <div className="flex justify-between items-center">

          <div>
            <h1 className="text-4xl font-bold">
              CyberNet Leaderboard
            </h1>

            <p className="mt-2 text-blue-100">
              Compete with students from all
              over India
            </p>
          </div>

          <Trophy size={70} />
        </div>
      </div>

      {/* Stats */}

      <div className="grid md:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow">
          <Trophy
            size={40}
            className="text-yellow-500"
          />

          <h2 className="text-3xl font-bold mt-3">
            #{myStats.rank}
          </h2>

          <p>Your Rank</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Flame
            size={40}
            className="text-orange-500"
          />

          <h2 className="text-3xl font-bold mt-3">
            {myStats.xp}
          </h2>

          <p>Total XP</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Star
            size={40}
            className="text-blue-500"
          />

          <h2 className="text-3xl font-bold mt-3">
            {myStats.tasksCompleted}
          </h2>

          <p>Tasks Completed</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Crown
            size={40}
            className="text-purple-500"
          />

          <h2 className="text-3xl font-bold mt-3">
            {myStats.badge}
          </h2>

          <p>Current Badge</p>
        </div>

      </div>

      {/* Search */}

      <div className="bg-white rounded-3xl p-5 shadow mt-8">

        <div className="flex items-center gap-4">

          <Search className="text-slate-500" />

          <input
            type="text"
            placeholder="Search Student..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full outline-none"
          />

          <button
            onClick={loadLeaderboard}
            className="bg-blue-600 text-white p-2 rounded-xl"
          >
            <RefreshCw size={18} />
          </button>

        </div>

      </div>

      {/* Leaderboard */}

      <div className="bg-white rounded-3xl shadow p-8 mt-8">

        <div className="flex items-center gap-3 mb-6">

          <TrendingUp className="text-green-600" />

          <h2 className="text-3xl font-bold">
            Top Students
          </h2>

        </div>

        {filteredLeaders.length === 0 ? (
          <div className="text-center py-16">

            <Medal
              size={60}
              className="mx-auto text-slate-300"
            />

            <h3 className="text-xl font-bold mt-4">
              No Leaderboard Data
            </h3>

          </div>
        ) : (
          filteredLeaders.map(
            (student, index) => (
              <div
                key={
                  student._id || index
                }
                className="flex items-center justify-between bg-slate-50 p-5 rounded-2xl mb-4 hover:shadow-md transition"
              >
                <div className="flex items-center gap-5">

                  <div className="text-2xl font-bold w-12">
                    #{index + 1}
                  </div>

                  <div>

                    <h3 className="font-bold text-lg">

                      {student.firstName}{" "}
                      {student.lastName}

                    </h3>

                    <p className="text-slate-500">

                      {student.college ||
                        "CyberNet Student"}

                    </p>

                  </div>

                </div>

                <div className="text-right">

                  <p className="font-bold text-xl text-blue-600">

                    {student.totalXP ||
                      student.xp ||
                      0}{" "}
                    XP

                  </p>

                  <p
                    className={`text-sm font-semibold ${getBadgeColor(
                      student.badge
                    )}`}
                  >
                    {student.badge ||
                      "Starter"}
                  </p>

                </div>

              </div>
            )
          )
        )}

      </div>

    </div>
  );
}

export default StudentLeaderboard;