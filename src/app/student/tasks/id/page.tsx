import Link from "next/link";

type TaskPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StudentTaskDetailPage({
  params,
}: TaskPageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <Link
            href="/student/tasks"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Back to Tasks
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-blue-400">
                Student Task
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Task Details
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Task ID: {id}
              </p>
            </div>

            <span className="rounded-full bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400">
              Pending
            </span>
          </div>

          <div className="mt-8 border-t border-slate-800 pt-8">
            <h2 className="text-lg font-semibold">
              Task Description
            </h2>

            <p className="mt-3 leading-7 text-slate-400">
              This task has not been configured yet. The complete task
              information, submission system, deadline and evaluation
              functionality will be connected to the student administration
              system.
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold">
              Submission
            </h2>

            <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-sm text-slate-400">
                Task submission will be available here.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}