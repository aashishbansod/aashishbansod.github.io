import React from "react";
import {
  Trophy,
  Medal,
  Crown,
  Star,
  Flame,
} from "lucide-react";

function StudentLeaderboard() {
  const leaders = [
    {
      rank: 1,
      name: "Rahul Sharma",
      xp: 5200,
      college: "IIT Delhi",
      badge: "Diamond",
    },
    {
      rank: 2,
      name: "Aman Verma",
      xp: 4850,
      college: "NIT Nagpur",
      badge: "Platinum",
    },
    {
      rank: 3,
      name: "Sneha Patil",
      xp: 4600,
      college: "SGBAU",
      badge: "Gold",
    },
    {
      rank: 4,
      name: "Rohit Kumar",
      xp: 4300,
      college: "Pune University",
      badge: "Silver",
    },
    {
      rank: 5,
      name: "Priya Singh",
      xp: 4100,
      college: "VNIT",
      badge: "Silver",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-800">
          🏆 CyberNet Leaderboard
        </h1>

        <p className="text-slate-500 mt-2">
          Compete with students across India
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-6 mb-8">

        <div className="bg-white rounded-3xl p-6 shadow">
          <Trophy size={40} className="text-yellow-500" />
          <h2 className="text-3xl font-bold mt-3">
            #12
          </h2>
          <p>Your Rank</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Flame size={40} className="text-orange-500" />
          <h2 className="text-3xl font-bold mt-3">
            4200 XP
          </h2>
          <p>Total XP</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Star size={40} className="text-blue-500" />
          <h2 className="text-3xl font-bold mt-3">
            38
          </h2>
          <p>Tasks Completed</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Crown size={40} className="text-purple-500" />
          <h2 className="text-3xl font-bold mt-3">
            Gold
          </h2>
          <p>Current Badge</p>
        </div>

      </div>

      <div className="bg-white rounded-3xl shadow p-8">

        <div className="flex items-center gap-3 mb-6">
          <Trophy className="text-yellow-500" />
          <h2 className="text-3xl font-bold">
            Top Students
          </h2>
        </div>

        {leaders.map((student) => (
          <div
            key={student.rank}
            className="flex items-center justify-between bg-slate-50 p-5 rounded-2xl mb-4 hover:shadow-md transition"
          >
            <div className="flex items-center gap-5">

              <div className="text-2xl font-bold w-12">
                #{student.rank}
              </div>

              <div>
                <h3 className="font-bold text-lg">
                  {student.name}
                </h3>

                <p className="text-slate-500">
                  {student.college}
                </p>
              </div>

            </div>

            <div className="text-right">
              <p className="font-bold text-xl text-blue-600">
                {student.xp} XP
              </p>

              <p className="text-sm text-slate-500">
                {student.badge}
              </p>
            </div>

          </div>
        ))}

      </div>

    </div>
  );
}

export default StudentLeaderboard;