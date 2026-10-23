import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-950">
            Admin Login
          </h1>

          <p className="mt-3 text-slate-600">
            Use the main CyberNet Careers login to authenticate as
            an administrator.
          </p>

          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}