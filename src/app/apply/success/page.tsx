import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Home,
  ShieldCheck,
} from "lucide-react";

const NEXT_STEPS = [
  "Your application will be reviewed by the CyberNet Careers team.",
  "If approved, you will receive instructions for accessing your student account.",
  "Assessment details will be provided for your selected internship domain, when applicable.",
  "Further instructions will be sent through your registered contact details.",
] as const;

export default function ApplicationSuccessPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 sm:py-12 lg:px-8">
      <section
        aria-labelledby="application-success-title"
        className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl items-center justify-center sm:min-h-[calc(100svh-6rem)]"
      >
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] sm:p-8 md:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 sm:h-20 sm:w-20 sm:rounded-3xl">
            <CheckCircle2 aria-hidden="true" className="h-9 w-9 sm:h-11 sm:w-11" />
          </div>

          <p className="mt-6 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-blue-600 sm:text-sm">
            CyberNet Careers
          </p>

          <h1
            id="application-success-title"
            className="mx-auto mt-3 max-w-2xl text-center text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-4xl"
          >
            Application Submitted Successfully
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-7 text-slate-600 sm:text-base">
            Your internship application has been received. Our team will review
            your details and share the next steps through your registered
            contact details.
          </p>

          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">
                  What happens next?
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
                  Keep an eye on your registered email and phone for updates.
                </p>
              </div>
            </div>

            <ol className="mt-5 space-y-4">
              {NEXT_STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-extrabold text-blue-700">
                    {index + 1}
                  </span>
                  <p className="pt-0.5 text-sm leading-6 text-slate-700">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 active:translate-y-px"
            >
              <Home aria-hidden="true" className="h-4 w-4" />
              Back to Home
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>

            <Link
              href="/login"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-extrabold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 active:translate-y-px"
            >
              <GraduationCap aria-hidden="true" className="h-5 w-5 text-blue-600" />
              Student Login
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 flex items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              For your security, use only the official CyberNet Careers portal
              and never share your password or OTP.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
