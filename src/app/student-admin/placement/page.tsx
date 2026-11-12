"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CircleHelp,
  GraduationCap,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Target,
  Users,
  Video,
  X,
} from "lucide-react";

type Tab = "overview" | "companies" | "drives" | "applications" | "offers" | "analytics";

const modules: { id: Tab; label: string; description: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", description: "Placement activity at a glance", icon: LayoutDashboard },
  { id: "companies", label: "Companies", description: "Manage recruiting partners", icon: Building2 },
  { id: "drives", label: "Placement drives", description: "Plan and manage hiring drives", icon: CalendarDays },
  { id: "applications", label: "Applications", description: "Review student applications", icon: ClipboardList },
  { id: "offers", label: "Offers", description: "Track selection and offers", icon: Award },
  { id: "analytics", label: "Analytics", description: "Placement performance insights", icon: Activity },
];

const stats = [
  { label: "Eligible students", icon: Users, tone: "blue" },
  { label: "Recruiting companies", icon: Building2, tone: "violet" },
  { label: "Active drives", icon: CalendarDays, tone: "amber" },
  { label: "Offers released", icon: Award, tone: "emerald" },
] as const;

const quickActions = [
  { title: "Company management", description: "Maintain company profiles, contacts and hiring details.", icon: Building2, tab: "companies" as Tab, tone: "blue" },
  { title: "Placement drives", description: "Prepare drive timelines, roles and eligibility criteria.", icon: CalendarDays, tab: "drives" as Tab, tone: "violet" },
  { title: "Student applications", description: "Review applications and manage shortlisting stages.", icon: ClipboardList, tab: "applications" as Tab, tone: "amber" },
  { title: "Offers & selections", description: "Record interview outcomes and placement offers.", icon: Award, tab: "offers" as Tab, tone: "emerald" },
] as const;

const tones: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

function EmptyPanel({ icon: Icon, title, description }: { icon: typeof ClipboardList; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><Icon size={25} /></span>
      <h3 className="mt-4 text-sm font-bold text-slate-800">{title}</h3>
      <p className="mt-2 max-w-md text-xs leading-6 text-slate-500">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-100">
        <ShieldCheck size={12} /> Backend integration pending
      </span>
    </div>
  );
}

export default function StudentAdminPlacementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const activeModule = useMemo(() => modules.find((item) => item.id === activeTab) ?? modules[0], [activeTab]);
  const ActiveModuleIcon = activeModule.icon;
  const visibleModules = useMemo(() => {
    const value = search.trim().toLowerCase();
    return value ? modules.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(value)) : modules;
  }, [search]);

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-[#102a56] via-[#17458a] to-[#2468c8] p-5 text-white shadow-[0_18px_50px_-25px_rgba(22,75,145,0.65)] sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">
              <GraduationCap size={13} /> Student Operations
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Placement Management</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/90">
              Organize recruiting partners, placement drives, student applications, interviews and final offers from one workspace.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-blue-100">
              <span className="rounded-full bg-white/10 px-3 py-1.5">Student Admin workspace</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><CheckCircle2 size={13} /> Separate from Student Dashboard</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
            <button type="button" onClick={() => setShowInfo((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15">
              <CircleHelp size={15} /> Module information <ChevronDown size={14} className={`transition ${showInfo ? "rotate-180" : ""}`} />
            </button>
            <span className="text-[10px] text-blue-100/75">Design workspace · Data connection pending</span>
          </div>
        </header>

        {showInfo && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <ShieldCheck className="mt-0.5 shrink-0" size={18} />
            <p className="flex-1 text-xs leading-6">
              This is a separate Student Admin interface. It does not add placement links or features to the student-facing dashboard. Live company, student, drive and offer records will appear after dedicated APIs and database models are connected.
            </p>
            <button type="button" onClick={() => setShowInfo(false)} aria-label="Close module information" className="rounded-lg p-1 text-blue-700 hover:bg-blue-100"><X size={16} /></button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">—</p>
                  </div>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${tones[item.tone]}`}><Icon size={19} /></span>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">Awaiting placement data integration</p>
              </article>
            );
          })}
        </section>

        <section className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Workspace</p>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Placement operations</h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">Choose a module to manage the placement lifecycle.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a module..." aria-label="Find a placement module" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              </div>
            </div>

            <nav aria-label="Placement modules" className="mt-5 flex gap-2 overflow-x-auto pb-2">
              {visibleModules.map((module) => {
                const Icon = module.icon;
                const selected = activeTab === module.id;
                return (
                  <button key={module.id} type="button" onClick={() => setActiveTab(module.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${selected ? "bg-blue-600 text-white shadow-md shadow-blue-600/15" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"}`}>
                    <Icon size={15} /> {module.label}
                  </button>
                );
              })}
            </nav>

            {visibleModules.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No placement modules match your search.</div>
            ) : activeTab === "overview" ? (
              <div className="mt-4 space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Target size={18} /></span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Placement lifecycle</h3>
                      <p className="mt-1 text-xs text-slate-500">Planned process from company onboarding to verified placement.</p>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { step: "01", title: "Company onboarding", text: "Create company profiles and hiring contacts.", icon: Building2 },
                      { step: "02", title: "Drive planning", text: "Set roles, dates and eligibility criteria.", icon: CalendarDays },
                      { step: "03", title: "Student applications", text: "Collect and review eligible applications.", icon: ClipboardList },
                      { step: "04", title: "Shortlisting", text: "Manage screening and interview rounds.", icon: Users },
                      { step: "05", title: "Interview outcomes", text: "Record round-wise results and decisions.", icon: Video },
                      { step: "06", title: "Offer confirmation", text: "Track offers and final placement status.", icon: Award },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.step} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                          <div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-widest text-blue-600">STEP {item.step}</span><Icon size={17} className="text-slate-400" /></div>
                          <h4 className="mt-3 text-xs font-bold text-slate-800">{item.title}</h4>
                          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{item.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Quick access</h3>
                    <span className="text-[10px] font-medium text-slate-400">Select a module to continue</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {quickActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button key={action.title} type="button" onClick={() => setActiveTab(action.tab)} className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[action.tone]}`}><Icon size={18} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-slate-800">{action.title}</span>
                            <span className="mt-1 block text-[11px] leading-5 text-slate-500">{action.description}</span>
                          </span>
                          <ArrowRight size={15} className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ActiveModuleIcon size={19} /></span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{activeModule.label}</h3>
                    <p className="mt-1 text-xs text-slate-500">{activeModule.description}</p>
                  </div>
                </div>
                <EmptyPanel icon={activeModule.icon} title={`${activeModule.label} is ready for setup`} description={`The ${activeModule.label.toLowerCase()} workspace UI is prepared. Live records, create/edit actions, filters and permissions will be connected after the placement data models and API routes are finalized.`} />
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={18} /></span>
                <div><h3 className="text-xs font-bold text-slate-900">Workspace status</h3><p className="text-[10px] text-slate-400">Current setup stage</p></div>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ["Placement UI", "Designed", true],
                  ["Student Dashboard", "Not connected", false],
                  ["Placement APIs", "Pending", false],
                  ["Database models", "Pending", false],
                ].map(([label, value, done]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-600">{label}</span>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${done ? "text-emerald-700" : "text-amber-700"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-amber-500"}`} />{value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-500">Placement data is intentionally not loaded until its dedicated backend is implemented.</div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
              <div className="flex items-center gap-2 text-blue-700"><Target size={17} /><h3 className="text-xs font-bold">Implementation focus</h3></div>
              <p className="mt-3 text-xs leading-6 text-slate-600">Keep placement records isolated from internship enrollment records. Use dedicated placement entities and server-side authorization for every operation.</p>
              <div className="mt-4 text-[10px] font-semibold text-blue-700">Separate placement module</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-900">Suggested next build</h3>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">Start with company records and placement drive creation, then connect student eligibility and applications.</p>
              <button type="button" onClick={() => setActiveTab("companies")} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-700">Open company module <ArrowRight size={13} /></button>
            </div>
          </aside>
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-5 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>CyberNet Careers · Student Admin Placement Workspace</span>
          <span>Placement module remains separate from the student portal</span>
        </footer>
      </div>
    </main>
  );
}
