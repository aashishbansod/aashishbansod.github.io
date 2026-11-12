"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CloudUpload,
  FileArchive,
  FileCheck2,
  Filter,
  FolderKanban,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
  X,
} from "lucide-react";

type ProjectTab = "overview" | "library" | "assignments" | "submissions" | "certificate";
type ProjectKind = "Major" | "Minor";

const tabs: { id: ProjectTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "library", label: "Project Library", icon: FolderKanban },
  { id: "assignments", label: "Assignments", icon: Users },
  { id: "submissions", label: "Submissions", icon: FileCheck2 },
  { id: "certificate", label: "Certificate Projects", icon: Award },
];

const lifecycle = [
  { number: "01", title: "Upload project", description: "Admin uploads project ZIP, instructions, domain and requirements.", icon: CloudUpload },
  { number: "02", title: "Assign to student", description: "Assign Major and Minor projects to eligible internship students.", icon: Users },
  { number: "03", title: "Student works", description: "Student downloads files and updates progress from the dashboard.", icon: Activity },
  { number: "04", title: "Review submission", description: "Admin checks project files, evidence and completion requirements.", icon: FileCheck2 },
  { number: "05", title: "Certificate application", description: "After internship completion, student submits final project files with the certificate form.", icon: Award },
];

const statusStyles: Record<string, string> = {
  "Not Started": "bg-slate-100 text-slate-600",
  "In Progress": "bg-blue-50 text-blue-700",
  Submitted: "bg-violet-50 text-violet-700",
  "Under Review": "bg-amber-50 text-amber-700",
  Approved: "bg-emerald-50 text-emerald-700",
  "Revision Required": "bg-rose-50 text-rose-700",
};

export default function StudentAdminProjectsPage() {
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectKind, setProjectKind] = useState<ProjectKind>("Major");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");

  const currentTab = useMemo(() => tabs.find((tab) => tab.id === activeTab) ?? tabs[0], [activeTab]);
  const CurrentIcon = currentTab.icon;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const isZip = file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
    if (!isZip) {
      setNotice("Please select a ZIP archive for the project folder.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setNotice("Project ZIP must be 100 MB or smaller.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }
    setNotice("");
    setSelectedFile(file);
  }

  function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectName.trim() || !domain.trim() || !selectedFile) {
      setNotice("Project name, domain and ZIP file are required.");
      return;
    }
    setNotice("Project upload is not connected yet. Configure secure cloud storage and the Projects API before publishing project files.");
  }

  function resetUpload() {
    setShowUpload(false);
    setProjectName("");
    setProjectKind("Major");
    setDomain("");
    setDescription("");
    setInstructions("");
    setSelectedFile(null);
    setNotice("");
  }

  const statCards = [
    { label: "Project templates", value: "—", detail: "Waiting for project library API", icon: FolderKanban, color: "blue" },
    { label: "Assigned projects", value: "—", detail: "Waiting for assignment API", icon: Users, color: "violet" },
    { label: "Pending reviews", value: "—", detail: "Waiting for submission API", icon: Clock3, color: "amber" },
    { label: "Approved projects", value: "—", detail: "Verified project records", icon: Award, color: "emerald" },
  ];

  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#102b58] via-[#17498e] to-[#2470d1] p-5 text-white shadow-[0_20px_55px_-28px_rgba(19,73,145,0.7)] sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-2 -top-12 h-52 w-52 rounded-full border border-white/10" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100">
                <GraduationCap size={13} /> Student Operations · Learning & Projects
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Project Management</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/90">
                Upload project resources, assign Major and Minor projects, review student progress and verify final submissions before certificate approval.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-medium text-blue-50"><ShieldCheck size={12} /> Student Admin controlled</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-medium text-blue-50"><LockKeyhole size={12} /> Separate from student dashboard</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col xl:items-end">
              <button type="button" onClick={() => { setNotice(""); setShowUpload(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-blue-800 shadow-lg shadow-blue-950/10 transition hover:bg-blue-50">
                <Plus size={16} /> Upload project
              </button>
              <span className="text-[10px] text-blue-100/75">Project library · Backend connection pending</span>
            </div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{item.value}</p>
                  </div>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${colors[item.color]}`}><Icon size={19} /></span>
                </div>
                <p className="mt-3 text-[10px] text-slate-400">{item.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Project workspace</p>
              <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Manage the complete project lifecycle</h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">Admin resources, student assignments, submissions and certificate-stage verification.</p>
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project workspace..." aria-label="Search project workspace" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </div>
          </div>

          <nav aria-label="Project management sections" className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${selected ? "bg-blue-600 text-white shadow-md shadow-blue-600/15" : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"}`}>
                  <Icon size={15} /> {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-3 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
            <div className="min-w-0">
              {activeTab === "overview" && (
                <div className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Target size={19} /></span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">How project management works</h3>
                        <p className="mt-1 text-[11px] text-slate-500">The controlled flow from admin upload to certificate review.</p>
                      </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {lifecycle.map((step) => {
                        const Icon = step.icon;
                        return (
                          <div key={step.number} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"><Icon size={17} /></span>
                            <div className="min-w-0">
                              <div className="text-[9px] font-bold tracking-[0.16em] text-blue-600">STEP {step.number}</div>
                              <h4 className="mt-1 text-xs font-bold text-slate-800">{step.title}</h4>
                              <p className="mt-1 text-[11px] leading-5 text-slate-500">{step.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Project categories</h3>
                        <p className="mt-1 text-[11px] text-slate-500">Maintain separate Major and Minor project requirements.</p>
                      </div>
                      <BookOpen size={19} className="text-slate-400" />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button type="button" onClick={() => { setActiveTab("library"); setKindFilter("Major"); }} className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-left transition hover:border-blue-300">
                        <div className="flex items-center justify-between"><span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-blue-700">MAJOR PROJECT</span><ArrowRight size={15} className="text-blue-600" /></div>
                        <h4 className="mt-3 text-sm font-bold text-slate-900">End-to-end practical project</h4>
                        <p className="mt-1 text-[11px] leading-5 text-slate-600">A larger domain-based project with complete source code, documentation and final demonstration.</p>
                      </button>
                      <button type="button" onClick={() => { setActiveTab("library"); setKindFilter("Minor"); }} className="rounded-xl border border-violet-100 bg-violet-50/70 p-4 text-left transition hover:border-violet-300">
                        <div className="flex items-center justify-between"><span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-violet-700">MINOR PROJECT</span><ArrowRight size={15} className="text-violet-600" /></div>
                        <h4 className="mt-3 text-sm font-bold text-slate-900">Focused skill project</h4>
                        <p className="mt-1 text-[11px] leading-5 text-slate-600">A smaller implementation to demonstrate a specific concept, feature or technical skill.</p>
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "library" && (
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div><h3 className="text-sm font-bold text-slate-900">Project Library</h3><p className="mt-1 text-[11px] text-slate-500">Upload and maintain reusable project packages.</p></div>
                    <button type="button" onClick={() => setShowUpload(true)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-bold text-white hover:bg-blue-700"><Upload size={14} /> Add project</button>
                  </div>
                  <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
                    <div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, domain..." className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-blue-400" /></div>
                    <div className="relative"><Filter size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} aria-label="Filter project type" className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-xs text-slate-600 outline-none sm:w-40"><option value="all">All project types</option><option value="Major">Major</option><option value="Minor">Minor</option></select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></div>
                  </div>
                  <EmptyState icon={FolderKanban} title="Your project library is empty" description="Upload a Major or Minor project ZIP with its domain, description, instructions and completion requirements. Project records will appear here after the secure storage and API integration is enabled." />
                </section>
              )}

              {activeTab === "assignments" && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <SectionHeading icon={Users} title="Student project assignments" subtitle="Assign approved project templates to students in the correct internship domain." />
                  <EmptyState icon={Users} title="No project assignments yet" description="Once the project library and student eligibility API are connected, you can assign Major and Minor projects, set due dates and track each student's progress." />
                </section>
              )}

              {activeTab === "submissions" && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <SectionHeading icon={FileCheck2} title="Project submission review" subtitle="Review student uploads, evidence, progress and completion status." />
                  <div className="mt-5 flex flex-wrap gap-2">
                    {Object.entries(statusStyles).map(([label, style]) => <span key={label} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${style}`}>{label}</span>)}
                  </div>
                  <EmptyState icon={FileCheck2} title="No submissions waiting for review" description="Submitted projects will appear here with student details, project type, uploaded files and review history. Admin approval or revision feedback will be recorded on the server." />
                </section>
              )}

              {activeTab === "certificate" && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <SectionHeading icon={Award} title="Certificate project verification" subtitle="Final Major and Minor project files submitted with the certificate application." />
                  <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <div className="flex items-start gap-3"><AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-700" /><div><h4 className="text-xs font-bold text-amber-900">Certificate approval requirements</h4><p className="mt-1 text-[11px] leading-5 text-amber-800">Internship must be completed, required projects must be approved, and the certificate application with final project files must pass Student Admin verification.</p></div></div>
                  </div>
                  <EmptyState icon={Award} title="No certificate project applications" description="Eligible students' final project files and certificate forms will appear here for final verification. This section will connect to the existing certificate eligibility workflow after project records are integrated." />
                </section>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={18} /></span><div><h3 className="text-xs font-bold text-slate-900">Module readiness</h3><p className="text-[10px] text-slate-400">Implementation status</p></div></div>
                <div className="mt-5 space-y-3">
                  {[["Admin project UI", "Designed", true], ["Secure file storage", "Pending", false], ["Project APIs", "Pending", false], ["Student dashboard link", "Pending", false], ["Certificate verification", "Pending", false]].map(([label, value, done]) => <div key={String(label)} className="flex items-center justify-between gap-2"><span className="text-[10px] text-slate-600">{label}</span><span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${done ? "text-emerald-700" : "text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-amber-500"}`} />{value}</span></div>)}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
                <div className="flex items-center gap-2 text-blue-700"><Sparkles size={17} /><h3 className="text-xs font-bold">Recommended project package</h3></div>
                <ul className="mt-3 space-y-2 text-[10px] leading-5 text-slate-600">
                  <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" /> Source code ZIP</li>
                  <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" /> README and setup steps</li>
                  <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" /> Project requirements</li>
                  <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" /> Expected output / screenshots</li>
                  <li className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" /> Completion checklist</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2"><ListChecks size={17} className="text-slate-500" /><h3 className="text-xs font-bold text-slate-900">Approval rule</h3></div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">A student cannot submit a certificate application until internship completion and required project approvals are verified by the backend.</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-semibold text-slate-600"><LockKeyhole size={11} /> Server-side enforcement required</div>
              </div>
            </aside>
          </div>
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-5 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>CyberNet Careers · Student Admin Project Workspace</span>
          <span>Project lifecycle is separate from internship task tracking</span>
        </footer>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) resetUpload(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="upload-project-title" className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6">
              <div><div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600"><CloudUpload size={13} /> Project library</div><h2 id="upload-project-title" className="mt-2 text-lg font-bold text-slate-900">Upload a project package</h2><p className="mt-1 text-xs text-slate-500">Add project details and select the ZIP folder to prepare the upload.</p></div>
              <button type="button" onClick={resetUpload} aria-label="Close upload dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleUploadSubmit} className="space-y-4 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-700">Project title <span className="text-rose-500">*</span></span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={140} required placeholder="e.g. Employee Management System" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
                <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-700">Project type <span className="text-rose-500">*</span></span><select value={projectKind} onChange={(event) => setProjectKind(event.target.value as ProjectKind)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-400"><option value="Major">Major Project</option><option value="Minor">Minor Project</option></select></label>
                <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-semibold text-slate-700">Internship domain <span className="text-rose-500">*</span></span><input value={domain} onChange={(event) => setDomain(event.target.value)} maxLength={100} required placeholder="e.g. Java Full Stack Development" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
                <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-semibold text-slate-700">Project description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1500} rows={3} placeholder="Describe the project objective and expected outcome..." className="w-full resize-y rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
                <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-semibold text-slate-700">Student instructions and requirements</span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={5000} rows={4} placeholder="Setup steps, features to implement, submission checklist..." className="w-full resize-y rounded-lg border border-slate-200 p-3 text-xs outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
              </div>
              <label className="block cursor-pointer rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-5 text-center transition hover:bg-blue-50">
                <input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={handleFileChange} className="sr-only" />
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><FileArchive size={20} /></span>
                <span className="mt-3 block text-xs font-bold text-slate-800">{selectedFile ? selectedFile.name : "Choose project ZIP file"}</span>
                <span className="mt-1 block text-[10px] text-slate-500">{selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB selected` : "ZIP archive · Maximum 100 MB"}</span>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-blue-700"><Upload size={12} /> Browse files</span>
              </label>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-[10px] leading-5 text-amber-800"><AlertCircle size={13} className="mr-1 inline" /> Secure upload is not active yet. This form currently validates the selected ZIP locally; it does not upload or publish files.</div>
              {notice && <p role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-700">{notice}</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={resetUpload} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700"><CloudUpload size={14} /> Validate project details</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }: { icon: typeof Users; title: string; subtitle: string }) {
  return <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon size={19} /></span><div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1 text-[11px] text-slate-500">{subtitle}</p></div></div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof FolderKanban; title: string; description: string }) {
  return <div className="flex flex-col items-center justify-center px-6 py-12 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200"><Icon size={24} /></span><h3 className="mt-4 text-sm font-bold text-slate-800">{title}</h3><p className="mt-2 max-w-lg text-[11px] leading-6 text-slate-500">{description}</p><span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[9px] font-bold text-amber-700 ring-1 ring-amber-100"><AlertCircle size={11} /> Backend integration pending</span></div>;
}
