"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Database,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";

type SettingLink = {
  title: string;
  description: string;
  href: string;
  icon: typeof LayoutDashboard;
  tag?: string;
};

const WORKSPACE_LINKS: SettingLink[] = [
  {
    title: "Dashboard overview",
    description: "Review Student Operations activity and pending work.",
    href: "/student-admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Student applications",
    description: "Review student records, eligibility and approval status.",
    href: "/student-admin/applications",
    icon: Users,
  },
  {
    title: "Internship programs",
    description: "Review available domains and internship plan information.",
    href: "/student-admin/internships",
    icon: BriefcaseBusiness,
  },
  {
    title: "Payment records",
    description: "Check payment verification and receipt status.",
    href: "/student-admin/payments",
    icon: CreditCard,
  },
  {
    title: "Assessments",
    description: "View assessment completion and result information.",
    href: "/student-admin/assessments",
    icon: BookOpenCheck,
  },
  {
    title: "Reports",
    description: "Open operational reports and student progress summaries.",
    href: "/student-admin/reports",
    icon: FileCheck2,
  },
];

const SECURITY_ITEMS = [
  {
    title: "Dedicated Student Operations access",
    description: "This workspace is intended for the Student Operations Admin role.",
    icon: Fingerprint,
  },
  {
    title: "Server-verified permissions",
    description: "Protected actions must be authorized by the server, not by page controls alone.",
    icon: ShieldCheck,
  },
  {
    title: "Credential protection",
    description: "Passwords and authentication secrets should never be displayed in this settings screen.",
    icon: KeyRound,
  },
];

export default function StudentAdminSettingsPage() {
  const [query, setQuery] = useState("");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const filteredLinks = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return WORKSPACE_LINKS;
    return WORKSPACE_LINKS.filter((item) =>
      `${item.title} ${item.description}`.toLowerCase().includes(value),
    );
  }, [query]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white shadow-xl shadow-blue-950/10">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
                <SlidersHorizontal size={14} /> Student Operations Workspace
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Settings & workspace</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
                Manage your way around the Student Operations workspace, review security guidance and access the tools used for payment review, student approvals and dashboard activation.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/student-admin/dashboard" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-blue-900 transition hover:bg-blue-50">
                <LayoutDashboard size={16} /> Dashboard <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="grid border-t border-white/10 bg-black/10 sm:grid-cols-3">
            <div className="flex items-center gap-3 px-6 py-4 sm:px-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><ShieldCheck size={19} /></span>
              <div><p className="text-xs font-semibold text-blue-200">Access model</p><p className="mt-0.5 text-sm font-bold">Role protected</p></div>
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4 sm:border-l sm:border-t-0 sm:px-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Database size={19} /></span>
              <div><p className="text-xs font-semibold text-blue-200">Data handling</p><p className="mt-0.5 text-sm font-bold">Server controlled</p></div>
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4 sm:border-l sm:border-t-0 sm:px-8">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Activity size={19} /></span>
              <div><p className="text-xs font-semibold text-blue-200">Workspace</p><p className="mt-0.5 text-sm font-bold">Student Operations</p></div>
            </div>
          </div>
        </header>

        <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Workspace shortcuts</p>
                  <h2 className="mt-2 text-xl font-black tracking-tight">Operational modules</h2>
                  <p className="mt-1 text-sm text-slate-500">Quick access to the areas you use most.</p>
                </div>
                <label className="block w-full sm:max-w-xs">
                  <span className="sr-only">Search workspace modules</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    type="search"
                    placeholder="Search modules…"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </label>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {filteredLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="group flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md hover:shadow-blue-950/5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white"><Icon size={20} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-sm font-extrabold text-slate-900">{item.title}<ChevronRight size={16} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" /></span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
                {filteredLinks.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 sm:col-span-2">No workspace module matches “{query}”.</div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 size={21} /></span>
                <div>
                  <h2 className="text-lg font-black">Student approval workflow</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Use the operational modules to follow the verified payment-to-dashboard process.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {[
                  ["01", "Payment verified", "A verified payment should enter the Student Operations review queue."],
                  ["02", "Review student record", "Confirm student identity, assessment result, domain and selected plan."],
                  ["03", "Approve or reject", "Record the decision with an auditable reason where required."],
                  ["04", "Activate dashboard", "Generate and deliver credentials only after approval; apply the paid plan duration."],
                ].map(([number, title, description]) => (
                  <div key={number} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">{number}</span>
                    <div><p className="text-sm font-extrabold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                Dashboard credentials and plan expiry must be enforced by the server-side approval and authentication services. This page does not approve students or change payment records.
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><LockKeyhole size={20} /></span>
                <div><p className="text-xs font-black uppercase tracking-[0.15em] text-indigo-700">Security centre</p><h2 className="mt-1 text-lg font-black">Account protection</h2></div>
              </div>
              <div className="mt-5 space-y-4">
                {SECURITY_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return <div key={item.title} className="flex gap-3"><span className="mt-0.5 text-slate-400"><Icon size={18} /></span><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p></div></div>;
                })}
              </div>
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-blue-900"><Bell size={16} /> Notification delivery</div>
                <p className="mt-2 text-xs leading-5 text-blue-800">Student approval and credential emails should be triggered by server-side workflow events. Delivery status should be checked in the relevant student record.</p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><CircleHelp size={19} /></span><h2 className="text-base font-black">Settings information</h2></div>
              <p className="mt-3 text-sm leading-6 text-slate-600">This screen currently provides workspace navigation and workflow guidance. Account preferences, password changes and notification settings should be connected to dedicated authenticated APIs before they are made editable.</p>
              <button type="button" onClick={() => setLastChecked(new Date())} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"><RefreshCw size={14} /> Check page status</button>
              {lastChecked && <p className="mt-2 text-[11px] text-slate-400">Page checked locally at {lastChecked.toLocaleTimeString()}.</p>}
            </section>

            <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-lg shadow-slate-950/10">
              <div className="flex items-center gap-2 text-blue-300"><Mail size={17} /><span className="text-xs font-black uppercase tracking-[0.15em]">Need assistance?</span></div>
              <h2 className="mt-3 text-lg font-black">Keep operations moving</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Open the dashboard to continue reviewing applications and payment-cleared students.</p>
              <Link href="/student-admin/dashboard" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-blue-500">Open dashboard <ArrowRight size={15} /></Link>
            </section>
          </aside>
        </section>
        <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>CyberNet Careers · Student Operations</span>
          <span>Protected workspace · Settings overview</span>
        </footer>
      </div>
    </main>
  );
}
