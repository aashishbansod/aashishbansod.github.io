"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type Profile = {
  fullName?: string;
  email?: string;
  phone?: string;
  studentId?: string;
  collegeName?: string;
  university?: string;
  course?: string;
  branchStream?: string;
  year?: string;
  semester?: string;
  applicationStatus?: string;
  assessmentStatus?: string;
  assessmentScore?: number | null;
  assessmentStartedAt?: string;
  assessmentSubmittedAt?: string;
  assessmentEvaluatedAt?: string;
  internshipApplicationAllowed?: boolean;
  internshipTrack?: string;
  internshipPlan?: string;
  internshipStatus?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentId?: string;
  adminApprovalStatus?: string;
  dashboardStatus?: string;
  dashboardActivatedAt?: string;
  certificateStatus?: string;
  certificateId?: string;
  internshipStartedAt?: string;
  internshipEndsAt?: string;
  internshipDurationDays?: number;
  dashboardCredentialsExpiresAt?: string;
  loginEnabled?: boolean;
  lastLoginAt?: string;
  journeyExpired?: boolean;
};

type ApiPayload = {
  success?: boolean;
  message?: string;
  code?: string;
  data?: unknown;
  student?: unknown;
  profile?: unknown;
};

type TabId =
  | "overview"
  | "tasks"
  | "coding"
  | "attendance"
  | "leave"
  | "progress"
  | "certificate";

const PROFILE_API = "/api/student/profile";
const LOGIN_ROUTE = "/login";
const ASSESSMENT_ROUTE = "/student/assessment";
const INTERNSHIPS_ROUTE = "/student/internships";
const PAYMENT_ROUTE = "/student/payment";
const RESULT_ROUTE = "/student/assessment/result";
const CERTIFICATE_ROUTE = "/certificate";

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard; description: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, description: "Your internship at a glance" },
  { id: "tasks", label: "Daily Tasks", icon: BookOpenCheck, description: "Assigned work and reviews" },
  { id: "coding", label: "Coding Practice", icon: Code2, description: "Daily programming challenges" },
  { id: "attendance", label: "Attendance", icon: CalendarDays, description: "Your attendance record" },
  { id: "leave", label: "Leave & Holidays", icon: Clock3, description: "Leave requests and holidays" },
  { id: "progress", label: "My Progress", icon: Activity, description: "Approved work and milestones" },
  { id: "certificate", label: "Certificate", icon: Award, description: "Eligibility and certificate status" },
];

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeProfile(value: unknown): Profile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    fullName: text(record.fullName),
    email: text(record.email),
    phone: text(record.phone),
    studentId: text(record.studentId),
    collegeName: text(record.collegeName),
    university: text(record.university),
    course: text(record.course),
    branchStream: text(record.branchStream),
    year: text(record.year),
    semester: text(record.semester),
    applicationStatus: text(record.applicationStatus),
    assessmentStatus: text(record.assessmentStatus).toLowerCase().replace(/_/g, "-"),
    assessmentScore: number(record.assessmentScore),
    assessmentStartedAt: text(record.assessmentStartedAt),
    assessmentSubmittedAt: text(record.assessmentSubmittedAt),
    assessmentEvaluatedAt: text(record.assessmentEvaluatedAt),
    internshipApplicationAllowed: record.internshipApplicationAllowed === true,
    internshipTrack: text(record.internshipTrack),
    internshipPlan: text(record.internshipPlan),
    internshipStatus: text(record.internshipStatus).toLowerCase(),
    paymentStatus: text(record.paymentStatus).toLowerCase(),
    paymentAmount: number(record.paymentAmount) ?? undefined,
    paymentCurrency: text(record.paymentCurrency, "INR"),
    paymentId: text(record.paymentId),
    adminApprovalStatus: text(record.adminApprovalStatus).toLowerCase(),
    dashboardStatus: text(record.dashboardStatus).toLowerCase(),
    dashboardActivatedAt: text(record.dashboardActivatedAt),
    certificateStatus: text(record.certificateStatus).toLowerCase(),
    certificateId: text(record.certificateId),
    internshipStartedAt: text(record.internshipStartedAt),
    internshipEndsAt: text(record.internshipEndsAt),
    internshipDurationDays: number(record.internshipDurationDays) ?? undefined,
    dashboardCredentialsExpiresAt: text(record.dashboardCredentialsExpiresAt),
    loginEnabled: record.loginEnabled !== false,
    lastLoginAt: text(record.lastLoginAt),
    journeyExpired: record.journeyExpired === true,
  };
}

function payloadMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const root = value as ApiPayload;
  return text(root.message, fallback);
}

function date(value?: string): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function currency(value?: number, unit = "INR"): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: unit,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₹${Math.round(value)}`;
  }
}

function initials(value?: string): string {
  const parts = text(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return "CN";
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function titleCase(value?: string): string {
  return text(value, "Not set")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ value, positive = false }: { value: string; positive?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold ${positive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${positive ? "bg-emerald-500" : "bg-amber-500"}`} />
      {value}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone?: "blue" | "green" | "violet" | "orange";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-[10px] font-medium text-slate-400">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function SectionEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-sm font-black text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5">
        <div className="h-16 rounded-2xl bg-white" />
        <div className="h-48 rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-white" />)}
        </div>
        <div className="h-80 rounded-3xl bg-white" />
      </div>
    </main>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTabId, setActiveTab] = useState<TabId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProfile = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(PROFILE_API, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.replace(`${LOGIN_ROUTE}?next=${encodeURIComponent("/student/dashboard")}`);
        return;
      }
      if (!response.ok) throw new Error(payloadMessage(payload, "Unable to load your student dashboard."));
      const root = payload as ApiPayload;
      let candidate: unknown = root?.data ?? root?.student ?? root?.profile ?? payload;
      if (candidate && typeof candidate === "object" && "student" in candidate) {
        candidate = (candidate as Record<string, unknown>).student;
      }
      const normalized = normalizeProfile(candidate);
      if (!normalized) throw new Error("The student profile response is invalid.");
      setProfile(normalized);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load your dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } finally {
      router.replace(LOGIN_ROUTE);
      router.refresh();
    }
  };

  const state = useMemo(() => {
    const assessment = text(profile?.assessmentStatus, "not-started").toLowerCase();
    const payment = text(profile?.paymentStatus, "unpaid").toLowerCase();
    const approval = text(profile?.adminApprovalStatus, "pending").toLowerCase();
    const dashboard = text(profile?.dashboardStatus, "locked").toLowerCase();
    const passed = assessment === "passed";
    const selected = Boolean(profile?.internshipPlan);
    const paid = payment === "paid";
    const activated = dashboard === "active" && approval === "approved";
    let step = 1;
    let heading = "Complete your assessment";
    let detail = "Your technical assessment is the first step toward internship activation.";
    let href = ASSESSMENT_ROUTE;
    let action = "Open assessment";
    if (profile?.journeyExpired) {
      step = 0;
      heading = "Application journey expired";
      detail = "Your application window has expired. Contact support for assistance.";
      href = "mailto:cybernet.tech.india@gmail.com";
      action = "Contact support";
    } else if (passed && !selected) {
      step = 2;
      heading = "Choose your internship";
      detail = "Your assessment is passed. Select your domain and internship duration.";
      href = INTERNSHIPS_ROUTE;
      action = "Choose internship";
    } else if (passed && selected && !paid) {
      step = 3;
      heading = "Complete your payment";
      detail = "Your selected internship plan is waiting for payment confirmation.";
      href = PAYMENT_ROUTE;
      action = "Continue payment";
    } else if (passed && selected && paid && !activated) {
      step = 4;
      heading = "Approval in progress";
      detail = "Payment is recorded. Student Operations approval is required before dashboard work begins.";
      href = "/student/dashboard";
      action = "View status";
    } else if (activated) {
      step = 5;
      heading = "Your internship is active";
      detail = "Your student workspace is active. Complete assigned work and wait for admin reviews.";
      href = "/student/dashboard";
      action = "View workspace";
    }
    return { assessment, payment, approval, dashboard, passed, selected, paid, activated, step, heading, detail, href, action };
  }, [profile]);

  const progress = state.activated ? 100 : state.step <= 1 ? 20 : state.step * 20;
  const displayName = text(profile?.fullName, "Student").split(/\s+/)[0];

  if (loading && !profile) return <LoadingScreen />;

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-xl font-black text-slate-950">Dashboard unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error || "We could not verify your student account."}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button onClick={() => void loadProfile()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <Link href={LOGIN_ROUTE} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700">Back to login</Link>
          </div>
        </section>
      </main>
    );
  }

  const activeTabMeta = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      {sidebarOpen && <button aria-label="Close navigation overlay" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col bg-[#0b1425] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[78px] items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20"><ShieldCheck className="h-6 w-6" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-tight">CyberNet Careers</p>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300">Student workspace</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} aria-label="Close menu" className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-xs font-black">{initials(profile.fullName)}</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold">{profile.fullName || "Student"}</p>
              <p className="mt-1 truncate text-[10px] text-white/45">{profile.studentId || "Student account"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Workspace</p>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTabId === tab.id;
            const locked = !state.activated && tab.id !== "overview";
            return (
              <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${selected ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-white/65 hover:bg-white/7 hover:text-white"} ${locked ? "opacity-55" : ""}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-white/15" : "bg-white/5 group-hover:bg-white/10"}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{tab.label}</span>
                  <span className={`mt-0.5 block truncate text-[9px] ${selected ? "text-white/65" : "text-white/35"}`}>{tab.description}</span>
                </span>
                {locked ? <LockKeyhole className="h-3.5 w-3.5" /> : selected ? <ChevronRight className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button type="button" onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-white/65 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5"><LogOut className="h-4 w-4" /></span>
            <span className="text-xs font-bold">{loggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[276px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-[70px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 lg:hidden"><Menu className="h-5 w-5" /></button>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Student portal</p>
                <h1 className="truncate text-base font-black tracking-tight text-slate-950 sm:text-lg">{activeTabMeta.label}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void loadProfile(true)} disabled={refreshing} aria-label="Refresh profile" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <div className="hidden h-8 w-px bg-slate-200 sm:block" />
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-[10px] font-black text-white">{initials(profile.fullName)}</div>
                <div className="hidden sm:block">
                  <p className="max-w-[160px] truncate text-xs font-extrabold text-slate-800">{profile.fullName || "Student"}</p>
                  <p className="max-w-[160px] truncate text-[10px] text-slate-400">{profile.studentId || profile.email}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"><span>{error}</span><button onClick={() => void loadProfile(true)} className="shrink-0 underline">Retry</button></div>}

          <section className="relative overflow-hidden rounded-[28px] bg-[#0b1425] p-5 text-white shadow-xl sm:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300"><Sparkles className="h-3.5 w-3.5" /> Your learning journey</span>
                <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">Welcome back, {displayName}.</h2>
                <p className="mt-2 max-w-xl text-xs leading-6 text-white/60 sm:text-sm">{state.detail}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.internshipTrack && <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-white/80"><Code2 className="mr-1.5 inline h-3.5 w-3.5 text-cyan-300" />{profile.internshipTrack}</span>}
                  {profile.internshipPlan && <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-white/80"><Clock3 className="mr-1.5 inline h-3.5 w-3.5 text-blue-300" />{profile.internshipPlan}</span>}
                  <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-white/80"><ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-emerald-300" />{state.activated ? "Workspace active" : "Account verified"}</span>
                </div>
              </div>
              {state.step > 0 && state.step < 5 && (
                <Link href={state.href} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5">
                  {state.action}<ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {state.step === 5 && <button onClick={() => setActiveTab("tasks")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black text-slate-950 shadow-lg">Open workspace<ArrowRight className="h-4 w-4" /></button>}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Assessment" value={state.passed ? "Passed" : titleCase(state.assessment)} detail={profile.assessmentScore != null ? `Score: ${profile.assessmentScore}` : "Result status"} icon={GraduationCap} tone={state.passed ? "green" : "blue"} />
            <MetricCard label="Internship plan" value={profile.internshipPlan || "Not selected"} detail={profile.internshipTrack || "Select after passing assessment"} icon={BriefcaseBusiness} tone="violet" />
            <MetricCard label="Payment" value={titleCase(state.payment)} detail={profile.paymentAmount != null ? currency(profile.paymentAmount, profile.paymentCurrency || "INR") : "Payment record"} icon={CreditCard} tone={state.paid ? "green" : "orange"} />
            <MetricCard label="Workspace" value={state.activated ? "Active" : titleCase(state.dashboard)} detail={state.activated ? "Student Operations approved" : "Waiting for activation"} icon={ShieldCheck} tone={state.activated ? "green" : "blue"} />
          </section>

          {activeTabId === "overview" && (
            <>
              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.7fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Milestone tracker</p><h3 className="mt-1 text-lg font-black text-slate-950">Your onboarding progress</h3><p className="mt-1 text-xs text-slate-500">Complete each stage to unlock the next step.</p></div>
                    <span className="text-sm font-black text-blue-700">{progress}%</span>
                  </div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "Assessment", done: state.passed, active: state.step === 1 },
                      { label: "Internship selection", done: state.selected, active: state.step === 2 },
                      { label: "Payment", done: state.paid, active: state.step === 3 },
                      { label: "Admin approval", done: state.activated, active: state.step === 4 },
                    ].map((item, index) => (
                      <div key={item.label} className={`rounded-xl border p-3 ${item.done ? "border-emerald-200 bg-emerald-50/70" : item.active ? "border-blue-200 bg-blue-50/70" : "border-slate-100 bg-slate-50"}`}>
                        <div className="flex items-center justify-between"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black ${item.done ? "bg-emerald-500 text-white" : item.active ? "bg-blue-600 text-white" : "bg-white text-slate-400"}`}>{item.done ? <CheckCircle2 className="h-4 w-4" /> : `0${index + 1}`}</span>{!item.done && <LockKeyhole className="h-3.5 w-3.5 text-slate-300" />}</div>
                        <p className="mt-3 text-[11px] font-extrabold text-slate-800">{item.label}</p>
                        <p className="mt-1 text-[9px] font-semibold text-slate-400">{item.done ? "Completed" : item.active ? "Current step" : "Locked / pending"}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><div><p className="text-xs font-black text-slate-800">{state.heading}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{state.detail}</p></div></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Internship period</p><h3 className="mt-1 text-lg font-black text-slate-950">Program timeline</h3></div><CalendarDays className="h-5 w-5 text-slate-300" /></div>
                  <div className="mt-5 space-y-4">
                    <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-4 w-4" /></span><div><p className="text-[10px] font-bold text-slate-400">Internship starts</p><p className="mt-1 text-xs font-black text-slate-800">{date(profile.internshipStartedAt)}</p></div></div>
                    <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Clock3 className="h-4 w-4" /></span><div><p className="text-[10px] font-bold text-slate-400">Internship ends</p><p className="mt-1 text-xs font-black text-slate-800">{date(profile.internshipEndsAt)}</p></div></div>
                    <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><ShieldCheck className="h-4 w-4" /></span><div><p className="text-[10px] font-bold text-slate-400">Dashboard access expiry</p><p className="mt-1 text-xs font-black text-slate-800">{date(profile.dashboardCredentialsExpiresAt)}</p></div></div>
                  </div>
                  <div className="mt-5 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-500">Program duration</p><p className="mt-1 text-sm font-black text-slate-900">{profile.internshipDurationDays ? `${profile.internshipDurationDays} days` : "Not assigned"}</p></div>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><BookOpenCheck className="h-5 w-5" /></span><div><h3 className="text-sm font-black text-slate-900">Daily tasks</h3><p className="mt-0.5 text-[10px] text-slate-400">One assigned task each day</p></div></div>
                  <p className="mt-4 text-xs leading-6 text-slate-500">Your assigned task, submission status and Student Operations review will appear here once the student task API is connected.</p>
                  <button onClick={() => setActiveTab("tasks")} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-blue-700">Open daily tasks<ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Code2 className="h-5 w-5" /></span><div><h3 className="text-sm font-black text-slate-900">Daily coding challenge</h3><p className="mt-0.5 text-[10px] text-slate-400">One coding problem each day</p></div></div>
                  <p className="mt-4 text-xs leading-6 text-slate-500">Your daily problem, code submission and approval-based unlock will appear here when the student coding API is connected.</p>
                  <button onClick={() => setActiveTab("coding")} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-blue-700">Open coding practice<ArrowRight className="h-3.5 w-3.5" /></button>
                </div>
              </section>
            </>
          )}

          {activeTabId === "tasks" && <SectionEmpty icon={BookOpenCheck} title="Daily task workspace" description="This page is ready for the student task feed, task instructions, submission form, review status and next-task lock. The existing project files confirm the Student Operations admin task manager, but the student-facing task API contract has not yet been supplied. No demo tasks or fake completion states are shown." />}
          {activeTabId === "coding" && <SectionEmpty icon={Code2} title="Daily coding workspace" description="This section is reserved for the assigned daily coding problem, editor or solution upload, test details, submission history and approval-based unlock. The Student Operations coding manager exists; the student-facing coding API must be connected before submissions can be enabled." />}
          {activeTabId === "attendance" && <SectionEmpty icon={CalendarDays} title="Attendance record" description="Your daily attendance, present days, absent days and attendance percentage will appear here after the attendance API and attendance policy are connected. No attendance values are fabricated." />}
          {activeTabId === "leave" && <SectionEmpty icon={Clock3} title="Leave and holiday calendar" description="Your leave balance, leave applications, approval status and published holidays will appear here after the Student Operations leave and holiday endpoints are connected." />}
          {activeTabId === "progress" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Learning analytics</p><h2 className="mt-1 text-lg font-black text-slate-950">Internship progress</h2></div><Activity className="h-5 w-5 text-slate-300" /></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Approved tasks" value="—" detail="Awaiting task API" icon={CheckCircle2} tone="green" />
                <MetricCard label="Coding problems" value="—" detail="Awaiting coding API" icon={Code2} tone="violet" />
                <MetricCard label="Attendance" value="—" detail="Awaiting attendance API" icon={CalendarDays} tone="blue" />
                <MetricCard label="Overall progress" value="—" detail="Calculated from approved work" icon={Activity} tone="orange" />
              </div>
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">Progress must increase only when Student Operations approves the corresponding task or coding submission. This page does not calculate completion from a student-side click.</p>
            </section>
          )}
          {activeTabId === "certificate" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Award className="h-6 w-6" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Certificate center</p><h2 className="mt-1 text-lg font-black text-slate-950">Internship certificate</h2></div></div>
                <StatusPill value={titleCase(profile.certificateStatus || "not eligible")} positive={["eligible", "generated", "verified"].includes(profile.certificateStatus || "")} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold text-slate-400">Certificate ID</p><p className="mt-1 text-xs font-black text-slate-800">{profile.certificateId || "Not generated"}</p></div>
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold text-slate-400">Eligibility</p><p className="mt-1 text-xs font-black text-slate-800">{titleCase(profile.certificateStatus || "not eligible")}</p></div>
              </div>
              {["eligible", "generated", "verified"].includes(profile.certificateStatus || "") ? <Link href={CERTIFICATE_ROUTE} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black text-white hover:bg-blue-700">Open certificate<ArrowRight className="h-4 w-4" /></Link> : <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500"><LockKeyhole className="h-4 w-4" /> Certificate remains locked until eligibility and admin approval are complete.</div>}
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-blue-600" /><h3 className="text-sm font-black text-slate-900">Student profile</h3></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Student ID", profile.studentId],
                  ["Email", profile.email],
                  ["College", profile.collegeName || profile.university],
                  ["Course", profile.course],
                  ["Branch", profile.branchStream],
                  ["Application", titleCase(profile.applicationStatus)],
                ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-xs font-bold text-slate-800">{value || "—"}</p></div>)}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-5 text-white shadow-lg shadow-blue-500/10">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><CircleHelp className="h-5 w-5" /></span>
              <h3 className="mt-4 text-sm font-black">Need assistance?</h3>
              <p className="mt-1 text-[11px] leading-5 text-white/70">For account, internship or dashboard access issues, contact the CyberNet Careers support team.</p>
              <a href="mailto:cybernet.tech.india@gmail.com" className="mt-4 inline-flex items-center gap-2 text-xs font-black underline underline-offset-4">Contact support<ArrowRight className="h-3.5 w-3.5" /></a>
            </div>
          </section>

          <footer className="flex flex-col gap-2 border-t border-slate-200 py-4 text-[10px] font-semibold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>CyberNet Careers · Student Workspace</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Private student session</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
