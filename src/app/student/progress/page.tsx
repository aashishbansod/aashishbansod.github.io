"use client";

import Link from "next/link";

export default function StudentProgressPage() {
  const progress = 0;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-400">Student Portal</p>

            <h1 className="mt-1 text-3xl font-bold">
              My Progress
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Track your internship and learning progress.
            </p>
          </div>

          <Link
            href="/student/dashboard"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Overall Progress</p>

            <p className="mt-2 text-4xl font-bold">
              {progress}%
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Tasks Completed</p>

            <p className="mt-2 text-4xl font-bold">
              0
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Assessments</p>

            <p className="mt-2 text-4xl font-bold">
              0
            </p>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">
              Program Progress
            </h2>

            <span className="text-sm text-slate-400">
              {progress}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-4 text-sm text-slate-400">
            Start your assigned tasks to increase your progress.
          </p>
        </section>
      </div>
    </main>
  );
}