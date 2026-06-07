import React, { useState } from "react";
import {
  CheckCircle,
  Clock,
  Trophy,
  Flame,
  Target,
  Star,
  Zap,
} from "lucide-react";

function StudentDailyTasks() {

  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Complete React Fundamentals",
      xp: 100,
      completed: true,
      category: "Frontend",
    },
    {
      id: 2,
      title: "Solve JavaScript Quiz",
      xp: 80,
      completed: false,
      category: "Programming",
    },
    {
      id: 3,
      title: "Watch AI Mentor Session",
      xp: 50,
      completed: false,
      category: "Learning",
    },
    {
      id: 4,
      title: "Build Portfolio Section",
      xp: 120,
      completed: true,
      category: "Project",
    },
  ]);

  const totalXP = tasks
    .filter((task) => task.completed)
    .reduce((sum, task) => sum + task.xp, 0);

  const completedTasks = tasks.filter(
    (task) => task.completed
  ).length;

  const progress =
    (completedTasks / tasks.length) * 100;

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      {/* Hero Section */}

      <div className="bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-500 rounded-3xl p-10 text-white shadow-2xl">

        <div className="flex justify-between items-center">

          <div>

            <h1 className="text-5xl font-black">
              Daily Tasks
            </h1>

            <p className="mt-3 text-lg opacity-90">
              Complete daily missions and earn rewards
            </p>

          </div>

          <Target size={70} />

        </div>

      </div>

      {/* Statistics */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Flame
            size={35}
            className="text-orange-500"
          />

          <h2 className="text-4xl font-black mt-3">
            21
          </h2>

          <p className="text-slate-500">
            Day Streak
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Zap
            size={35}
            className="text-yellow-500"
          />

          <h2 className="text-4xl font-black mt-3">
            {totalXP}
          </h2>

          <p className="text-slate-500">
            XP Earned
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <CheckCircle
            size={35}
            className="text-green-500"
          />

          <h2 className="text-4xl font-black mt-3">
            {completedTasks}
          </h2>

          <p className="text-slate-500">
            Completed Tasks
          </p>

        </div>

        <div className="bg-white rounded-3xl p-6 shadow-lg">

          <Trophy
            size={35}
            className="text-purple-500"
          />

          <h2 className="text-4xl font-black mt-3">
            Gold
          </h2>

          <p className="text-slate-500">
            Current Rank
          </p>

        </div>

      </div>
            {/* Progress Section */}

      <div className="bg-white rounded-3xl shadow-lg p-8 mt-8">

        <div className="flex justify-between items-center mb-4">

          <h2 className="text-2xl font-bold">
            Today's Progress
          </h2>

          <span className="font-bold text-blue-600">
            {Math.round(progress)}%
          </span>

        </div>

        <div className="w-full h-5 bg-slate-200 rounded-full overflow-hidden">

          <div
            className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />

        </div>

        <div className="flex justify-between mt-4 text-slate-500">

          <span>
            {completedTasks} / {tasks.length} Tasks Completed
          </span>

          <span>
            {totalXP} XP Earned
          </span>

        </div>

      </div>

      {/* Rewards Section */}

      <div className="grid md:grid-cols-3 gap-6 mt-8">

        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-3xl p-6 shadow-lg">

          <Star size={40} />

          <h3 className="text-2xl font-bold mt-3">
            Daily Bonus
          </h3>

          <p className="opacity-90 mt-2">
            Complete all tasks to earn +200 XP
          </p>

        </div>

        <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-3xl p-6 shadow-lg">

          <Trophy size={40} />

          <h3 className="text-2xl font-bold mt-3">
            Achievement
          </h3>

          <p className="opacity-90 mt-2">
            Unlock exclusive internship badges
          </p>

        </div>

        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-3xl p-6 shadow-lg">

          <Flame size={40} />

          <h3 className="text-2xl font-bold mt-3">
            Streak Reward
          </h3>

          <p className="opacity-90 mt-2">
            Maintain streak for premium rewards
          </p>

        </div>

      </div>
            {/* Tasks Section */}

      <div className="mt-8">

        <h2 className="text-3xl font-bold mb-6">
          Today's Tasks
        </h2>

        <div className="grid gap-5">

          {tasks.map((task) => (

            <div
              key={task.id}
              className="bg-white rounded-3xl shadow-lg p-6 hover:shadow-2xl transition-all"
            >

              <div className="flex justify-between items-center">

                <div>

                  <div className="flex items-center gap-3">

                    {task.completed ? (
                      <CheckCircle
                        size={28}
                        className="text-green-500"
                      />
                    ) : (
                      <Clock
                        size={28}
                        className="text-orange-500"
                      />
                    )}

                    <h3 className="text-xl font-bold">
                      {task.title}
                    </h3>

                  </div>

                  <p className="text-slate-500 mt-2">
                    Category : {task.category}
                  </p>

                </div>

                <div className="text-right">

                  <div className="text-blue-600 font-black text-2xl">
                    +{task.xp} XP
                  </div>

                  <div
                    className={`mt-2 px-4 py-1 rounded-full text-sm font-semibold inline-block ${
                      task.completed
                        ? "bg-green-100 text-green-600"
                        : "bg-orange-100 text-orange-600"
                    }`}
                  >
                    {task.completed
                      ? "Completed"
                      : "Pending"}
                  </div>

                </div>

              </div>

            </div>

          ))}

        </div>

      </div>
     </div>
  );
}

export default StudentDailyTasks;