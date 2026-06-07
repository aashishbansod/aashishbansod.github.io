import React, { useState } from "react";
import {
  Code2,
  Trophy,
  Flame,
  Star,
  Play,
  CheckCircle,
} from "lucide-react";

function StudentCodingPractice() {
  const [selectedProblem, setSelectedProblem] =
    useState("Two Sum");

  const problems = [
    {
      title: "Two Sum",
      difficulty: "Easy",
      xp: 50,
    },
    {
      title: "Palindrome Number",
      difficulty: "Easy",
      xp: 50,
    },
    {
      title: "Merge Intervals",
      difficulty: "Medium",
      xp: 120,
    },
    {
      title: "LRU Cache",
      difficulty: "Hard",
      xp: 250,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      <div className="flex justify-between items-center mb-8">

        <div>
          <h1 className="text-4xl font-bold text-slate-800">
            Coding Practice Arena
          </h1>

          <p className="text-slate-500 mt-2">
            Solve problems, earn XP and rank higher.
          </p>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-3 rounded-2xl font-bold">
          Level 12 Developer
        </div>

      </div>

      <div className="grid md:grid-cols-4 gap-6 mb-8">

        <div className="bg-white rounded-3xl p-6 shadow">
          <Trophy
            size={40}
            className="text-yellow-500"
          />

          <h2 className="text-3xl font-bold mt-3">
            4200
          </h2>

          <p>Total XP</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Flame
            size={40}
            className="text-orange-500"
          />

          <h2 className="text-3xl font-bold mt-3">
            21
          </h2>

          <p>Daily Streak</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Code2
            size={40}
            className="text-blue-500"
          />

          <h2 className="text-3xl font-bold mt-3">
            87
          </h2>

          <p>Problems Solved</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow">
          <Star
            size={40}
            className="text-purple-500"
          />

          <h2 className="text-3xl font-bold mt-3">
            Gold
          </h2>

          <p>Current Badge</p>
        </div>

      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        <div className="bg-white rounded-3xl p-6 shadow">

          <h2 className="text-2xl font-bold mb-5">
            Problems
          </h2>

          {problems.map((problem, index) => (
            <div
              key={index}
              onClick={() =>
                setSelectedProblem(
                  problem.title
                )
              }
              className={`p-4 rounded-2xl cursor-pointer mb-4 border transition ${
                selectedProblem === problem.title
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200"
              }`}
            >
              <h3 className="font-bold">
                {problem.title}
              </h3>

              <div className="flex justify-between mt-2">
                <span>
                  {problem.difficulty}
                </span>

                <span className="font-bold text-green-600">
                  +{problem.xp} XP
                </span>
              </div>
            </div>
          ))}
        </div>
                <div className="lg:col-span-2">

          <div className="bg-white rounded-3xl shadow p-6 mb-6">

            <div className="flex justify-between items-center mb-5">

              <div>
                <h2 className="text-2xl font-bold">
                  {selectedProblem}
                </h2>

                <p className="text-slate-500">
                  Solve this coding challenge
                </p>
              </div>

              <button className="bg-green-500 text-white px-5 py-3 rounded-xl flex items-center gap-2">
                <CheckCircle size={18} />
                Submit
              </button>

            </div>

            <div className="bg-slate-50 rounded-2xl p-5">

              <h3 className="font-bold text-lg mb-3">
                Problem Statement
              </h3>

              <p className="text-slate-700 leading-7">
                Given an array of integers nums
                and an integer target, return
                indices of the two numbers such
                that they add up to target.
              </p>

              <div className="mt-5">

                <h4 className="font-bold mb-2">
                  Example
                </h4>

                <div className="bg-slate-900 text-green-400 p-4 rounded-xl font-mono">
                  Input: nums = [2,7,11,15]
                  <br />
                  target = 9
                  <br />
                  Output: [0,1]
                </div>

              </div>

            </div>

          </div>

          <div className="bg-white rounded-3xl shadow p-6 mb-6">

            <div className="flex justify-between items-center mb-4">

              <h2 className="text-2xl font-bold">
                Code Editor
              </h2>

              <button className="bg-blue-600 text-white px-5 py-3 rounded-xl flex items-center gap-2">
                <Play size={18} />
                Run Code
              </button>

            </div>

            <textarea
              className="w-full h-96 bg-slate-900 text-green-400 p-5 rounded-2xl font-mono outline-none"
              defaultValue={`function twoSum(nums, target) {

  // Write your solution here

}`}
            />

          </div>
                    <div className="grid md:grid-cols-2 gap-6">

            <div className="bg-white rounded-3xl shadow p-6">

              <h2 className="text-2xl font-bold mb-5">
                Test Cases
              </h2>

              <div className="space-y-4">

                <div className="bg-slate-100 p-4 rounded-xl">
                  <p className="font-semibold">
                    Test Case #1
                  </p>

                  <p>
                    Input:
                    [2,7,11,15], Target = 9
                  </p>

                  <p className="text-green-600 font-bold">
                    Expected: [0,1]
                  </p>
                </div>

                <div className="bg-slate-100 p-4 rounded-xl">
                  <p className="font-semibold">
                    Test Case #2
                  </p>

                  <p>
                    Input:
                    [3,2,4], Target = 6
                  </p>

                  <p className="text-green-600 font-bold">
                    Expected: [1,2]
                  </p>
                </div>

                <div className="bg-slate-100 p-4 rounded-xl">
                  <p className="font-semibold">
                    Test Case #3
                  </p>

                  <p>
                    Input:
                    [3,3], Target = 6
                  </p>

                  <p className="text-green-600 font-bold">
                    Expected: [0,1]
                  </p>
                </div>

              </div>

            </div>

            <div className="bg-white rounded-3xl shadow p-6">

              <h2 className="text-2xl font-bold mb-5">
                Output Console
              </h2>

              <div className="bg-slate-900 text-green-400 rounded-2xl p-5 h-72 font-mono overflow-auto">

                <p>✓ Compilation Success</p>

                <p>
                  ✓ Test Case #1 Passed
                </p>

                <p>
                  ✓ Test Case #2 Passed
                </p>

                <p>
                  ✓ Test Case #3 Passed
                </p>

                <br />

                <p className="text-cyan-400">
                  All Test Cases Passed
                </p>

              </div>

            </div>

          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-6">

            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl p-6">

              <h2 className="text-2xl font-bold">
                +50 XP
              </h2>

              <p className="mt-2">
                Reward For Solving Problem
              </p>

            </div>

            <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-3xl p-6">

              <h2 className="text-2xl font-bold">
                Daily Challenge
              </h2>

              <p className="mt-2">
                Complete 3 Problems Today
              </p>

            </div>

            <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-3xl p-6">

              <h2 className="text-2xl font-bold">
                Next Badge
              </h2>

              <p className="mt-2">
                Need 800 XP More
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default StudentCodingPractice;