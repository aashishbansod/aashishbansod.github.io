"use client";

import Link from "next/link";

type Task = {
  id: string;
  title: string;
  description: string;
  status: "Pending" | "In Progress" | "Completed";
};

const tasks: Task[] = [];

export default function StudentTasksPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-400">Student Portal</p>

            <h1 className="mt-1 text-3xl font-bold">
              My Tasks
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Complete your assigned internship tasks.
            </p>
          </div>

          <Link
            href="/student/dashboard"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            ← Dashboard
          </Link>
        </div>

        {tasks.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl">
              📋
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              No tasks assigned
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              When an administrator assigns you a task, it will appear here.
            </p>
          </section>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/student/tasks/${task.id}`}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-semibold">
                    {task.title}
                  </h2>

                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                    {task.status}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {task.description}
                </p>

                <p className="mt-5 text-sm font-medium text-blue-400">
                  Open Task →
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}