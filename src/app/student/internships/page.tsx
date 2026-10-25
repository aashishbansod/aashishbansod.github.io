"use client";



import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { useRouter } from "next/navigation";

import {

  ArrowRight, BadgeCheck, BriefcaseBusiness, Check, ChevronDown, Clock3,

  Code2, CreditCard, Database, Laptop, LoaderCircle, LockKeyhole, MapPin,

  RefreshCw, Search, ShieldCheck, Sparkles, X,

} from "lucide-react";



type PlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";

type Profile = {

  studentId?: string; fullName?: string; email?: string; dateOfBirth?: string | null;

  applicationStatus?: string; adminApprovalStatus?: string; assessmentStatus?: string;

  assessmentPassed?: boolean; resultStatus?: string; internshipApplicationAllowed?: boolean;

  assessmentDomain?: string; internshipDomain?: string; domain?: string;

  selectedDomain?: string; selectedInternshipDomain?: string; internshipTrack?: string;

};

type RawPlan = {

  internshipId?: string; planCode?: string; duration?: string; durationMonths?: number | string;

  price?: number | string; priceInPaise?: number | string; currency?: string; stipend?: string | number;

};

type RawProgram = {

  _id?: string; id?: string; title?: string; name?: string; description?: string;

  domain?: string; assessmentDomain?: string; mode?: string; location?: string;

  currency?: string; skills?: unknown; technologies?: unknown; status?: string;

  isActive?: boolean; isPublic?: boolean; isSelectable?: boolean; plans?: RawPlan[];

  planCode?: string; duration?: string; durationMonths?: number | string;

  price?: number | string; priceInPaise?: number | string; stipend?: string | number;

};

type Plan = { internshipId: string; planCode: PlanCode; duration: string; months: 1 | 3 | 6; price: number; currency: string; stipend?: string | number };

type Program = { id: string; title: string; description: string; domain: string; mode: string; location: string; skills: string[]; technologies: string[]; plans: Plan[] };

type Payload = { success?: boolean; message?: string; error?: string; data?: unknown; student?: unknown; profile?: unknown; internships?: unknown; items?: unknown; results?: unknown };



const PLAN_ORDER: PlanCode[] = ["ONE_MONTH", "THREE_MONTHS", "SIX_MONTHS"];

const PLAN_INFO: Record<PlanCode, { label: string; months: 1 | 3 | 6; price: number; tier: string }> = {

  ONE_MONTH: { label: "1 Month", months: 1, price: 499, tier: "Starter" },

  THREE_MONTHS: { label: "3 Months", months: 3, price: 999, tier: "Popular" },

  SIX_MONTHS: { label: "6 Months", months: 6, price: 1699, tier: "Advanced" },

};



const str = (v: unknown) => typeof v === "string" ? v.trim() : "";

const status = (v: unknown) => str(v).toLowerCase().replace(/_/g, "-");

const num = (v: unknown): number | null => {

  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);

  return null;

};

const list = (v: unknown): string[] => Array.isArray(v)

  ? [...new Set(v.map(str).filter(Boolean))]

  : typeof v === "string" ? [...new Set(v.split(",").map(s => s.trim()).filter(Boolean))] : [];



function getError(payload: unknown, fallback: string) {

  if (!payload || typeof payload !== "object") return fallback;

  const p = payload as Payload;

  return str(p.message) || str(p.error) || fallback;

}

function getProfile(payload: unknown): Profile | null {

  if (!payload || typeof payload !== "object") return null;

  const p = payload as Payload;

  const d = p.data;

  if (d && typeof d === "object") {

    const x = d as Record<string, unknown>;

    if (x.student && typeof x.student === "object") return x.student as Profile;

    if (x.profile && typeof x.profile === "object") return x.profile as Profile;

    return d as Profile;

  }

  if (p.student && typeof p.student === "object") return p.student as Profile;

  if (p.profile && typeof p.profile === "object") return p.profile as Profile;

  return payload as Profile;

}

function getPrograms(payload: unknown): RawProgram[] {

  if (Array.isArray(payload)) return payload as RawProgram[];

  if (!payload || typeof payload !== "object") return [];

  const p = payload as Record<string, unknown>;

  for (const candidate of [p.internships, p.items, p.results, p.data]) {

    if (Array.isArray(candidate)) return candidate as RawProgram[];

    if (candidate && typeof candidate === "object") {

      const n = candidate as Record<string, unknown>;

      for (const nested of [n.internships, n.items, n.results, n.data]) {

        if (Array.isArray(nested)) return nested as RawProgram[];

      }

    }

  }

  return [];

}

function resolvePlan(v: unknown, months: unknown): PlanCode | null {

  const c = str(v).toUpperCase().replace(/[\s-]+/g, "_");

  if (["ONE_MONTH", "1_MONTH", "1M"].includes(c) || num(months) === 1) return "ONE_MONTH";

  if (["THREE_MONTHS", "3_MONTHS", "3M"].includes(c) || num(months) === 3) return "THREE_MONTHS";

  if (["SIX_MONTHS", "6_MONTHS", "6M"].includes(c) || num(months) === 6) return "SIX_MONTHS";

  return null;

}

function normalizeProgram(r: RawProgram): Program | null {

  const s = status(r.status);

  if (r.isActive === false || r.isPublic === false || r.isSelectable === false || (s && s !== "active")) return null;

  const id = str(r._id) || str(r.id);

  if (!id) return null;

  const currency = str(r.currency).toUpperCase() || "INR";

  const source = Array.isArray(r.plans) && r.plans.length ? r.plans : [{

    internshipId: id, planCode: r.planCode, duration: r.duration, durationMonths: r.durationMonths,

    price: r.price, priceInPaise: r.priceInPaise, currency, stipend: r.stipend,

  }];

  const map = new Map<PlanCode, Plan>();

  for (const p of source) {

    const code = resolvePlan(p.planCode, p.durationMonths);

    if (!code || map.has(code)) continue;

    const config = PLAN_INFO[code];

    const rawPrice = num(p.price);

    const paise = num(p.priceInPaise);

    const price = rawPrice !== null && rawPrice >= 0 ? rawPrice : paise !== null && paise >= 0 ? paise / 100 : config.price;

    map.set(code, {

      internshipId: str(p.internshipId) || id, planCode: code, duration: str(p.duration) || config.label,

      months: config.months, price: Math.round(price), currency: str(p.currency).toUpperCase() || currency, stipend: p.stipend,

    });

  }

  const plans = PLAN_ORDER.flatMap(code => map.has(code) ? [map.get(code)!] : []);

  if (!plans.length) return null;

  return {

    id, title: str(r.title) || str(r.name) || "Internship Program",

    description: str(r.description) || "Build practical skills through structured tasks and projects.",

    domain: str(r.domain) || str(r.assessmentDomain) || "Technology",

    mode: str(r.mode) || "Remote", location: str(r.location) || "Online",

    skills: list(r.skills), technologies: list(r.technologies), plans,

  };

}

function approved(p: Profile) {

  return status(p.applicationStatus) === "approved" || status(p.adminApprovalStatus) === "approved";

}

function passed(p: Profile) {

  return p.assessmentPassed === true || (status(p.assessmentStatus) === "passed" && status(p.resultStatus) === "passed");

}

function money(n: number, currency = "INR") {

  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }

  catch { return `${currency} ${Math.round(n).toLocaleString("en-IN")}`; }

}

function modeName(m: string) {

  const v = m.toLowerCase();

  if (["online", "remote"].includes(v)) return "Remote";

  if (["onsite", "on-site", "offline"].includes(v)) return "On-site";

  if (v === "hybrid") return "Hybrid";

  return m || "Remote";

}

function modeKey(m: string) {

  const v = modeName(m).toLowerCase();

  return v === "remote" ? "REMOTE" : v === "on-site" ? "ONSITE" : v === "hybrid" ? "HYBRID" : "OTHER";

}

function localToday() {

  const d = new Date();

  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

}

function validDob(v: string) {

  if (!v || v > localToday()) return false;

  const d = new Date(`${v}T00:00:00.000Z`);

  if (!Number.isFinite(d.getTime())) return false;

  const now = new Date();

  let age = now.getUTCFullYear() - d.getUTCFullYear();

  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age--;

  return age >= 13 && age <= 100;

}

function iconFor(domain: string) {

  const d = domain.toLowerCase();

  if (d.includes("python") || d.includes("data") || d.includes("ai")) return Database;

  if (d.includes("java") || d.includes("backend")) return Code2;

  return Laptop;

}



export default function StudentInternshipsPage() {

  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [domainFilter, setDomainFilter] = useState("ALL");

  const [modeFilter, setModeFilter] = useState("ALL");

  const [chosenProgram, setChosenProgram] = useState<Program | null>(null);

  const [chosenPlan, setChosenPlan] = useState<Plan | null>(null);

  const [dob, setDob] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [formError, setFormError] = useState("");



  const loadData = useCallback(async (refresh = false) => {

    refresh ? setRefreshing(true) : setLoading(true);

    setError("");

    try {

      const pr = await fetch("/api/student/profile", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });

      const pp: unknown = await pr.json().catch(() => null);

      if (pr.status === 401) { router.replace("/login?next=/student/internships"); return; }

      if (!pr.ok) throw new Error(getError(pp, "Unable to verify your student account."));

      const next = getProfile(pp);

      if (!next) throw new Error("Student profile response was invalid.");

      setProfile(next);



      // Crucial gate: do not request/render the internship catalogue until eligibility is confirmed.*

      if (!approved(next) || !passed(next) || next.internshipApplicationAllowed === false) {

        setPrograms([]);

        return;

      }

      const ir = await fetch("/api/internships", { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });

      const ip: unknown = await ir.json().catch(() => null);

      if (ir.status === 401) { router.replace("/login?next=/student/internships"); return; }

      if (!ir.ok) throw new Error(getError(ip, "Unable to load internship programs."));

      setPrograms(getPrograms(ip).map(normalizeProgram).filter((x): x is Program => x !== null));

    } catch (e) {

      console.error("[student/internships] load error", e);

      setError(e instanceof Error ? e.message : "Unable to load internship information.");

    } finally { setLoading(false); setRefreshing(false); }

  }, [router]);



  useEffect(() => { void loadData(); }, [loadData]);



  const canSelect = Boolean(profile && approved(profile) && passed(profile) && profile.internshipApplicationAllowed !== false);

  // The student's assigned/selected domain is the source of truth.

  // Never fall back to showing the full catalogue if it is missing.

  const assignedDomain = str(profile?.selectedInternshipDomain) ||

    str(profile?.internshipDomain) ||

    str(profile?.assessmentDomain) ||

    str(profile?.internshipTrack) ||

    str(profile?.selectedDomain) ||

    str(profile?.domain);



  const normalizeDomain = (value: string) =>

    value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");



  const domainPrograms = useMemo(() => {

    if (!assignedDomain) return [];

    const assignedKey = normalizeDomain(assignedDomain);

    return programs.filter((program) => normalizeDomain(program.domain) === assignedKey);

  }, [programs, assignedDomain]);



  const domains = useMemo(() => [...new Set(domainPrograms.map(p => p.domain))].sort((a, b) => a.localeCompare(b)), [domainPrograms]);



  const filtered = useMemo(() => {

    const q = search.trim().toLowerCase();

    return domainPrograms.filter(p => {

      const haystack = [p.title, p.description, p.domain, p.mode, p.location, ...p.skills, ...p.technologies].join(" ").toLowerCase();

      return (!q || haystack.includes(q)) && (domainFilter === "ALL" || p.domain === domainFilter) && (modeFilter === "ALL" || modeKey(p.mode) === modeFilter);

    });

  }, [domainPrograms, search, domainFilter, modeFilter]);

  const groups = useMemo(() => {

    const m = new Map<string, Program[]>();

    for (const p of filtered) m.set(p.domain, [...(m.get(p.domain) || []), p]);

    return [...m.entries()].sort(([a], [b]) => {

      const aa = Boolean(assignedDomain && a.toLowerCase() === assignedDomain.toLowerCase());

      const bb = Boolean(assignedDomain && b.toLowerCase() === assignedDomain.toLowerCase());

      return aa === bb ? a.localeCompare(b) : aa ? -1 : 1;

    });

  }, [filtered, assignedDomain]);



  function openProgram(p: Program) {

    if (!canSelect) { router.replace("/student/assessment"); return; }

    setChosenProgram(p); setChosenPlan(p.plans.find(plan => plan.planCode === "THREE_MONTHS") || null);

    setDob(typeof profile?.dateOfBirth === "string" ? profile.dateOfBirth.slice(0, 10) : "");

    setFormError("");

  }

  function closeModal() {

    if (submitting) return;

    setChosenProgram(null); setChosenPlan(null); setFormError("");

  }

  async function submitSelection(e: FormEvent<HTMLFormElement>) {

    e.preventDefault(); setFormError("");

    if (!profile || !chosenProgram || !chosenPlan) { setFormError("Choose an internship and duration."); return; }

    if (!canSelect) { setFormError("A passed assessment is required before internship selection."); return; }

    if (!validDob(dob)) { setFormError("Enter a valid date of birth."); return; }

    setSubmitting(true);

    try {

      const response = await fetch("/api/student/internships/select", {

        method: "POST", credentials: "include", cache: "no-store",

        headers: { "Content-Type": "application/json", Accept: "application/json" },

        body: JSON.stringify({ internshipId: chosenProgram.id, planCode: chosenPlan.planCode, dateOfBirth: dob }),

      });

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) { router.replace("/login?next=/student/internships"); return; }

      if (!response.ok || !payload || typeof payload !== "object" || (payload as Payload).success === false) {

        throw new Error(getError(payload, "Unable to save internship selection. Please try again."));

      }

      router.push(`/student/payment?${new URLSearchParams({ internshipId: chosenProgram.id, planCode: chosenPlan.planCode }).toString()}`);

    } catch (e) {

      console.error("[student/internships] selection error", e);

      setFormError(e instanceof Error ? e.message : "Unable to continue. Please try again.");

    } finally { setSubmitting(false); }

  }



  if (loading) return <main className="min-h-screen bg-slate-50 p-5 sm:p-10"><div className="mx-auto max-w-7xl animate-pulse"><div className="h-10 w-64 rounded-xl bg-slate-200" /><div className="mt-5 h-5 max-w-xl rounded bg-slate-200" /><div className="mt-8 grid gap-4 md:grid-cols-3">{[1,2,3].map(n => <div key={n} className="h-28 rounded-2xl bg-white" />)}</div><div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map(n => <div key={n} className="h-72 rounded-3xl bg-white" />)}</div></div></main>;



  if (error || !profile) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl"><ShieldCheck className="mx-auto text-red-600" size={32}/><h1 className="mt-4 text-2xl font-black">Unable to verify account</h1><p className="mt-3 text-sm leading-6 text-slate-600">{error || "Student profile could not be verified."}</p><button onClick={() => void loadData()} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Try again</button></section></main>;



  if (!approved(profile)) return <LockedScreen title="Application approval required" message="Internship selection remains locked until the Main Admin approves your application." action="Check status" onAction={() => void loadData(true)} refreshing={refreshing}/>;



  if (!assignedDomain) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl"><LockKeyhole className="mx-auto text-amber-600" size={32}/><h1 className="mt-4 text-2xl font-black">Internship domain not assigned</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your student profile does not contain a selected internship or assessment domain yet. Please contact Student Operations to correct your profile. Other domains remain hidden.</p><button onClick={() => void loadData(true)} disabled={refreshing} className="mt-6 rounded-xl border px-5 py-3 text-sm font-bold disabled:opacity-60"><RefreshCw size={15} className={`mr-2 inline ${refreshing?"animate-spin":""}`}/>Refresh profile</button></section></main>;



  if (!passed(profile) || profile.internshipApplicationAllowed === false) return <main className="grid min-h-screen place-items-center bg-gradient-to-b from-blue-50 via-slate-50 to-white p-4 sm:p-8"><section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-blue-950/10"><div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white sm:p-10"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><LockKeyhole size={25}/></div><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-200">Student pathway</p><p className="mt-1 text-sm font-bold">Internship selection locked</p></div></div><h1 className="mt-8 text-3xl font-black sm:text-4xl">Pass your assessment to unlock internships</h1><p className="mt-4 max-w-xl text-sm leading-7 text-blue-100">Active programs and paid plans stay hidden until your official result is recorded as Passed. A pending result does not unlock selection.</p></div><div className="grid gap-3 p-6 sm:grid-cols-3 sm:p-8">{[{title:"Complete",body:"Finish the technical assessment."},{title:"Result verified",body:"Wait until the official result says Passed."},{title:"Select program",body:"Choose a domain and duration after unlock."}].map((x,i)=><div key={x.title} className="rounded-2xl border border-slate-200 p-4"><BadgeCheck className="text-blue-600" size={21}/><p className="mt-3 text-sm font-extrabold">{i+1}. {x.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{x.body}</p></div>)}</div><div className="flex flex-col gap-3 border-t bg-slate-50 p-6 sm:flex-row sm:justify-between sm:p-8"><button onClick={() => void loadData(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-5 py-3 text-sm font-bold disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/> Refresh result</button><button onClick={() => router.push("/student/assessment")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-blue-700">Go to assessment <ArrowRight size={17}/></button></div></section></main>;



  return <main className="min-h-screen bg-slate-50 text-slate-950">

    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-[11px] font-black uppercase tracking-[.18em] text-blue-700">
            <Sparkles size={14}/> CyberNet Careers · Internship Programs
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Choose your internship plan</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Select a program from your assigned domain and choose the duration that fits your goals.</p>
          <button onClick={() => void loadData(true)} disabled={refreshing} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold shadow-sm hover:border-blue-200 hover:text-blue-700 disabled:opacity-60">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/>{refreshing ? "Refreshing…" : "Refresh programs"}
          </button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Student" value={profile.fullName || "Student"} detail={profile.studentId || "Student ID verified"}/>
          <Stat label="Assessment" value="Passed" detail="Internship selection unlocked" success/>
          <Stat label="Your domain" value={assignedDomain} detail={`${domainPrograms.length} matching active program${domainPrograms.length === 1 ? "" : "s"}`}/>
          <Stat label="Plans" value="₹499 · ₹999 · ₹1,699" detail="1, 3 or 6 months when offered"/>
        </div>
      </div>
    </header>



    <section className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9"><div className="mb-7 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:grid-cols-[minmax(240px,1fr)_250px_190px]"><label className="relative"><span className="sr-only">Search programs</span><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input value={search} onChange={e => setSearch(e.target.value)} type="search" placeholder="Search domains, skills or technologies…" className="h-12 w-full rounded-xl border bg-slate-50 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"/></label><label className="relative"><span className="sr-only">Domain filter</span><select value={domainFilter} onChange={e => setDomainFilter(e.target.value)} className="h-12 w-full appearance-none rounded-xl border bg-white px-4 pr-9 text-sm font-semibold outline-none focus:border-blue-500"><option value="ALL">All domains</option>{domains.map(d => <option key={d} value={d}>{d}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/></label><label className="relative"><span className="sr-only">Mode filter</span><select value={modeFilter} onChange={e => setModeFilter(e.target.value)} className="h-12 w-full appearance-none rounded-xl border bg-white px-4 pr-9 text-sm font-semibold outline-none focus:border-blue-500"><option value="ALL">All modes</option><option value="REMOTE">Remote</option><option value="ONSITE">On-site</option><option value="HYBRID">Hybrid</option><option value="OTHER">Other</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/></label></div>



    {domainPrograms.length === 0 ? <Empty title={`No active programs for ${assignedDomain}`} message="Only programs matching your assigned domain can be shown. Ask Student Operations to check domain mapping or program availability." onClick={() => void loadData(true)} /> : filtered.length === 0 ? <Empty title="No matching programs" message="Try another search or clear the filters." onClick={() => {setSearch("");setDomainFilter("ALL");setModeFilter("ALL");}}/> : <div className="space-y-10">{groups.map(([domain, items]) => { const Icon = iconFor(domain); const assigned = Boolean(assignedDomain && domain.toLowerCase() === assignedDomain.toLowerCase()); return <section key={domain}><div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-700/15"><Icon size={23}/></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black tracking-tight sm:text-2xl">{domain}</h2>{assigned && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">Your assessment domain</span>}</div><p className="mt-1 text-sm text-slate-500">{items.length} available {items.length === 1 ? "program" : "programs"}</p></div></div><span className="inline-flex items-center gap-1.5 self-start rounded-full border bg-white px-3 py-1.5 text-xs font-bold text-slate-600 sm:self-auto"><ShieldCheck size={14} className="text-emerald-600"/> Active programs only</span></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map(p => {const cheapest = Math.min(...p.plans.map(x => x.price)); const isPopular = p.plans.some(x => x.planCode === "THREE_MONTHS"); return <article key={p.id} className={`group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10 ${isPopular ? "border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-600/10" : "border-slate-200 hover:border-blue-200"}`}><div className={`h-2 ${isPopular ? "bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-400" : "bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300"}`}/>{isPopular && <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 px-3 py-2.5 text-center text-xs font-black uppercase tracking-[.12em] text-white shadow-sm"><Sparkles size={15} className="shrink-0"/> Most Popular Internship <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] tracking-normal">₹999 · 3 Months</span></div>}<div className="flex flex-1 flex-col p-5 sm:p-6"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon size={22}/></div><div className="min-w-0"><h3 className="break-words text-lg font-black leading-snug">{p.title}</h3><p className="mt-1 text-xs font-bold text-blue-700">{p.domain}</p></div></div><p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{p.description}</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400"><Laptop size={13} className="mr-1 inline"/> Mode</p><p className="mt-1 text-sm font-bold">{modeName(p.mode)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400"><MapPin size={13} className="mr-1 inline"/> Location</p><p className="mt-1 truncate text-sm font-bold">{p.location}</p></div></div>{(p.skills.length > 0 || p.technologies.length > 0) && <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Skills & technologies</p><div className="mt-2 flex flex-wrap gap-1.5">{[...p.skills,...p.technologies].filter((s,i,a)=>a.indexOf(s)===i).slice(0,5).map(s=><span key={s} className="rounded-lg border bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{s}</span>)}</div></div>}<div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Plans from</p><p className="mt-1 text-2xl font-black tracking-tight">{money(cheapest,p.plans[0]?.currency || "INR")}</p><p className="mt-1 text-xs text-slate-500">{p.plans.length} duration option{p.plans.length===1?"":"s"}</p>{isPopular && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-extrabold text-blue-800"><Sparkles size={12}/> Best value · 3-month plan available</p>}</div><button onClick={()=>openProgram(p)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-blue-600/15 hover:bg-blue-700">Select <ArrowRight size={16}/></button></div></div></article>})}</div></section>})}</div>}

    <div className="mt-10 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><ShieldCheck className="mt-0.5 shrink-0 text-blue-700" size={19}/><p><strong>Secure selection:</strong> choosing a program does not activate your dashboard. Payment must be verified and Student Operations review completed before dashboard access.</p></div>

    </section>



    {chosenProgram && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal();}}><section role="dialog" aria-modal="true" aria-labelledby="selection-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white/95 p-5 backdrop-blur sm:p-6"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-700">Confirm selection</p><h2 id="selection-title" className="mt-2 text-xl font-black sm:text-2xl">{chosenProgram.title}</h2><p className="mt-1 text-sm text-slate-500">{chosenProgram.domain}</p></div><button type="button" onClick={closeModal} disabled={submitting} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl border text-slate-500 hover:bg-slate-50 disabled:opacity-50"><X size={18}/></button></div><form onSubmit={submitSelection} className="space-y-6 p-5 sm:p-6"><div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-extrabold">Choose duration</h3><span className="text-xs text-slate-500">Select one plan</span></div><div className="grid gap-3 sm:grid-cols-3">{chosenProgram.plans.map(plan=>{const cfg=PLAN_INFO[plan.planCode];const active=chosenPlan?.planCode===plan.planCode;return <button type="button" key={plan.planCode} onClick={()=>{setChosenPlan(plan);setFormError("");}} className={`relative rounded-2xl border p-4 pt-7 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${plan.planCode === "THREE_MONTHS" ? (active ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/15 shadow-lg shadow-blue-600/10" : "border-blue-400 bg-blue-50/50 shadow-md shadow-blue-600/5") : (active ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/10" : "border-slate-200 hover:border-blue-200 hover:bg-slate-50")}`}>
{plan.planCode === "THREE_MONTHS" && <span className="absolute inset-x-0 top-0 flex items-center justify-center rounded-t-[14px] bg-gradient-to-r from-blue-600 to-indigo-600 py-1 text-[10px] font-black uppercase tracking-wider text-white"><Sparkles size={11} className="mr-1"/> Most popular</span>}
<p className={`text-xs font-bold ${plan.planCode === "THREE_MONTHS" ? "text-blue-700" : "text-slate-500"}`}>{cfg.tier}</p><p className="mt-2 text-sm font-extrabold">{plan.duration}</p><p className="mt-2 text-2xl font-black">{money(plan.price,plan.currency)}</p><p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500"><Clock3 size={13}/>{plan.months} month{plan.months===1?"":"s"}</p>{active&&<span className="absolute right-3 bottom-3 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white"><Check size={12}/></span>}</button>})}</div></div><div><label htmlFor="student-dob" className="mb-2 block text-sm font-extrabold">Date of birth</label><input id="student-dob" type="date" required max={localToday()} value={dob} onChange={e=>setDob(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"/><p className="mt-2 text-xs leading-5 text-slate-500">Sent in the secure request body, not in the URL.</p></div>{formError&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{formError}</div>}<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><p className="flex items-center gap-2 font-extrabold"><CreditCard size={15}/> Payment is next</p><p className="mt-1">Dashboard access stays locked until payment verification and the required operations review are complete.</p></div><div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={closeModal} disabled={submitting} className="rounded-xl border px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={submitting||!chosenPlan||!validDob(dob)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting?<><LoaderCircle size={17} className="animate-spin"/> Saving selection…</>:<>Continue to payment <ArrowRight size={17}/></>}</button></div></form></section></div>}

  </main>;

}



function Stat({label,value,detail,success=false}:{label:string;value:string;detail:string;success?:boolean}) {

  return <div className={`rounded-2xl border p-4 ${success?"border-emerald-100 bg-emerald-50":"border-slate-200 bg-slate-50"}`}><p className={`text-[10px] font-black uppercase tracking-[.18em] ${success?"text-emerald-700":"text-slate-500"}`}>{label}</p><p className={`mt-2 truncate text-base font-extrabold ${success?"text-emerald-800":"text-slate-900"}`}>{success&&<Check size={16} className="mr-1 inline"/>}{value}</p><p className={`mt-1 text-xs ${success?"text-emerald-700":"text-slate-500"}`}>{detail}</p></div>;

}

function Empty({title,message,onClick}:{title:string;message:string;onClick:()=>void}) {

  return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><BriefcaseBusiness className="mx-auto text-slate-400" size={29}/><h2 className="mt-4 text-xl font-black">{title}</h2><p className="mt-2 text-sm text-slate-500">{message}</p><button onClick={onClick} className="mt-5 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold hover:bg-slate-50">Clear filters / refresh</button></div>;

}

function LockedScreen({title,message,action,onAction,refreshing}:{title:string;message:string;action:string;onAction:()=>void;refreshing:boolean}) {

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5"><section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><LockKeyhole className="mx-auto text-amber-600" size={32}/><p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-blue-700">CyberNet Careers</p><h1 className="mt-3 text-2xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p><button onClick={onAction} disabled={refreshing} className="mt-6 rounded-xl border px-5 py-3 text-sm font-bold disabled:opacity-60"><RefreshCw size={15} className={`mr-2 inline ${refreshing?"animate-spin":""}`}/>{action}</button></section></main>;

}
