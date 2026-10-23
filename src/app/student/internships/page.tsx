
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

type PlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";

type StudentProfile = {
  studentId?: string;
  applicationId?: string;
  fullName?: string;
  email?: string;
  dateOfBirth?: string | null;
  applicationStatus?: string;
  assessmentStatus?: string;
  assessmentPassed?: boolean;
  resultStatus?: string;
  internshipApplicationAllowed?: boolean;
  internshipStatus?: string;
  internshipPlan?: string;
  paymentStatus?: string;
};

type RawPlan = {
  _id?: string;
  id?: string;
  internshipId?: string;
  planCode?: string;
  duration?: string;
  durationMonths?: number | string;
  price?: number | string;
  priceInPaise?: number | string;
  currency?: string;
  stipend?: string | number;
};

type RawInternship = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  domain?: string;
  assessmentDomain?: string;
  mode?: string;
  location?: string;
  currency?: string;
  skills?: unknown;
  technologies?: unknown;
  status?: string;
  isActive?: boolean;
  isPublic?: boolean;
  isSelectable?: boolean;
  plans?: RawPlan[];
  planCode?: string;
  duration?: string;
  durationMonths?: number | string;
  price?: number | string;
  priceInPaise?: number | string;
  stipend?: string | number;
};

type Plan = {
  internshipId: string;
  planCode: PlanCode;
  duration: string;
  months: 1 | 3 | 6;
  price: number;
  currency: string;
  stipend?: string | number;
};

type Program = {
  id: string;
  title: string;
  description: string;
  domain: string;
  mode: string;
  location: string;
  skills: string[];
  technologies: string[];
  plans: Plan[];
};

type ApiPayload = {
  success?: boolean;
  message?: string;
  error?: string;
  data?: unknown;
  student?: unknown;
  internships?: unknown;
  items?: unknown;
  results?: unknown;
};

const PLAN_ORDER: PlanCode[] = [
  "ONE_MONTH",
  "THREE_MONTHS",
  "SIX_MONTHS",
];

const PLAN_INFO: Record<PlanCode, { label: string; months: 1 | 3 | 6 }> = {
  ONE_MONTH: { label: "1 Month", months: 1 },
  THREE_MONTHS: { label: "3 Months", months: 3 },
  SIX_MONTHS: { label: "6 Months", months: 6 },
};

const PLAN_PRICES: Record<PlanCode, number> = {
  ONE_MONTH: 499,
  THREE_MONTHS: 999,
  SIX_MONTHS: 1699,
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function statusValue(value: unknown): string {
  return stringValue(value).toLowerCase().replace(/_/g, "-");
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const result = Number(value);
    if (Number.isFinite(result)) return result;
  }
  return null;
}

function listValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(stringValue).filter(Boolean))];
}

function extractProfile(payload: unknown): StudentProfile | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as ApiPayload;
  const data = root.data;

  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    if (nested.student && typeof nested.student === "object") {
      return nested.student as StudentProfile;
    }
    return data as StudentProfile;
  }

  if (root.student && typeof root.student === "object") {
    return root.student as StudentProfile;
  }

  return payload as StudentProfile;
}

function extractInternships(payload: unknown): RawInternship[] {
  if (Array.isArray(payload)) return payload as RawInternship[];
  if (!payload || typeof payload !== "object") return [];

  const root = payload as Record<string, unknown>;
  const candidates = [root.internships, root.items, root.results, root.data];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as RawInternship[];

    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      for (const value of [
        nested.internships,
        nested.items,
        nested.results,
        nested.data,
      ]) {
        if (Array.isArray(value)) return value as RawInternship[];
      }
    }
  }

  return [];
}

function resolvePlanCode(value: unknown, monthsValue: unknown): PlanCode | null {
  const code = stringValue(value).toUpperCase().replace(/[\s-]+/g, "_");

  if (["ONE_MONTH", "1_MONTH", "1M"].includes(code)) return "ONE_MONTH";
  if (["THREE_MONTHS", "3_MONTHS", "3M"].includes(code)) return "THREE_MONTHS";
  if (["SIX_MONTHS", "6_MONTHS", "6M"].includes(code)) return "SIX_MONTHS";

  const months = numericValue(monthsValue);
  if (months === 1) return "ONE_MONTH";
  if (months === 3) return "THREE_MONTHS";
  if (months === 6) return "SIX_MONTHS";

  return null;
}

function normalizePlan(raw: RawPlan, parentId: string, currency: string): Plan | null {
  const code = resolvePlanCode(raw.planCode, raw.durationMonths);
  if (!code) return null;

  const months = PLAN_INFO[code].months;
  const priceValue = numericValue(raw.price);
  const paiseValue = numericValue(raw.priceInPaise);

  const price =
    priceValue !== null && priceValue >= 0
      ? priceValue
      : paiseValue !== null && paiseValue >= 0
        ? paiseValue / 100
        : PLAN_PRICES[code];

  // This checkout flow is INR-only. The API remains authoritative for the final amount.
  const planCurrency = stringValue(raw.currency).toUpperCase() || currency || "INR";
  if (planCurrency !== "INR") return null;

  const internshipId =
    stringValue(raw.internshipId) ||
    stringValue(raw._id) ||
    stringValue(raw.id) ||
    parentId;

  if (!internshipId || !Number.isFinite(price) || price < 0) return null;

  return {
    internshipId,
    planCode: code,
    duration: stringValue(raw.duration) || PLAN_INFO[code].label,
    months,
    price: Math.round(price),
    currency: planCurrency,
    stipend: raw.stipend,
  };
}

function normalizeProgram(raw: RawInternship): Program | null {
  if (
    raw.isActive === false ||
    raw.isPublic === false ||
    raw.isSelectable === false ||
    (stringValue(raw.status) && statusValue(raw.status) !== "active")
  ) {
    return null;
  }

  const id = stringValue(raw._id) || stringValue(raw.id);
  if (!id) return null;

  const currency = stringValue(raw.currency).toUpperCase() || "INR";
  const rawPlans =
    Array.isArray(raw.plans) && raw.plans.length
      ? raw.plans
      : [{
          _id: raw._id,
          id: raw.id,
          internshipId: id,
          planCode: raw.planCode,
          duration: raw.duration,
          durationMonths: raw.durationMonths,
          price: raw.price,
          priceInPaise: raw.priceInPaise,
          currency,
          stipend: raw.stipend,
        }];

  const byCode = new Map<PlanCode, Plan>();

  for (const rawPlan of rawPlans) {
    const plan = normalizePlan(rawPlan, id, currency);
    if (plan && !byCode.has(plan.planCode)) byCode.set(plan.planCode, plan);
  }

  const plans = PLAN_ORDER.flatMap((code) => {
    const plan = byCode.get(code);
    return plan ? [plan] : [];
  });

  if (!plans.length) return null;

  return {
    id,
    title: stringValue(raw.title) || stringValue(raw.name) || "Internship Program",
    description:
      stringValue(raw.description) ||
      "Build practical skills through structured internship tasks and projects.",
    domain: stringValue(raw.domain) || stringValue(raw.assessmentDomain) || "Technology",
    mode: stringValue(raw.mode) || "Remote",
    location: stringValue(raw.location) || "Online",
    skills: listValue(raw.skills),
    technologies: listValue(raw.technologies),
    plans,
  };
}

function money(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const result = payload as ApiPayload;
  return stringValue(result.message) || stringValue(result.error) || fallback;
}

function assessmentPassed(profile: StudentProfile): boolean {
  return (
    profile.assessmentPassed === true ||
    (
      statusValue(profile.assessmentStatus) === "passed" &&
      statusValue(profile.resultStatus) === "passed"
    )
  );
}

function paymentOrOperationsReview(profile: StudentProfile): boolean {
  const payment = statusValue(profile.paymentStatus);
  const operations = statusValue(profile.internshipStatus);

  // Never offer a fresh selection after a payment has been recorded as paid
  // or the internship has entered the post-payment approval workflow.
  return (
    ["paid", "captured", "verified", "success", "successful"].includes(payment) ||
    ["pending-review", "under-review", "operations-review", "active"].includes(operations)
  );
}

function modeLabel(mode: string): string {
  const value = mode.toLowerCase();
  if (["remote", "online"].includes(value)) return "Remote";
  if (["onsite", "on-site", "offline"].includes(value)) return "On-site";
  if (value === "hybrid") return "Hybrid";
  return mode || "Remote";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateYearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

export default function StudentInternshipsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("ALL");
  const [mode, setMode] = useState("ALL");

  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const [profileResponse, internshipResponse] = await Promise.all([
        fetch("/api/student/profile", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
        fetch("/api/internships", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
      ]);

      const [profilePayload, internshipPayload] = await Promise.all([
        profileResponse.json().catch(() => null),
        internshipResponse.json().catch(() => null),
      ]);

      if (profileResponse.status === 401 || internshipResponse.status === 401) {
        router.replace("/login?next=/student/internships");
        return;
      }

      if (!profileResponse.ok) {
        throw new Error(errorMessage(profilePayload, "Unable to load your student profile."));
      }

      if (!internshipResponse.ok) {
        throw new Error(errorMessage(internshipPayload, "Unable to load internship programs."));
      }

      const nextProfile = extractProfile(profilePayload);
      if (!nextProfile) throw new Error("The student profile response was invalid.");

      setProfile(nextProfile);
      setPrograms(
        extractInternships(internshipPayload)
          .map(normalizeProgram)
          .filter((item): item is Program => item !== null),
      );
    } catch (requestError) {
      console.error("[student/internships] load error", requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load internship information.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const domains = useMemo(
    () => [...new Set(programs.map((item) => item.domain))].sort(),
    [programs],
  );

  const filteredPrograms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return programs.filter((program) => {
      const searchable = [
        program.title,
        program.description,
        program.domain,
        ...program.skills,
        ...program.technologies,
      ].join(" ").toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (domain === "ALL" || program.domain === domain) &&
        (mode === "ALL" ||
          (mode === "ONSITE"
            ? modeLabel(program.mode).toUpperCase() === "ON-SITE"
            : modeLabel(program.mode).toUpperCase() === mode))
      );
    });
  }, [programs, search, domain, mode]);

  const alreadyPaidOrInReview = Boolean(profile && paymentOrOperationsReview(profile));

  const canSelect = Boolean(
    profile &&
    statusValue(profile.applicationStatus) === "approved" &&
    assessmentPassed(profile) &&
    profile.internshipApplicationAllowed !== false &&
    !alreadyPaidOrInReview,
  );

  function openProgram(program: Program) {
    if (!canSelect) {
      router.push("/student/assessment");
      return;
    }

    setSelectedProgram(program);
    setSelectedPlan(null);
    setDateOfBirth(
      typeof profile?.dateOfBirth === "string"
        ? profile.dateOfBirth.slice(0, 10)
        : "",
    );
    setFormError("");
  }

  function closeModal() {
    if (submitting) return;
    setSelectedProgram(null);
    setSelectedPlan(null);
    setFormError("");
  }

  async function handleSelectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!profile || !selectedProgram || !selectedPlan) {
      setFormError("Select an internship and duration first.");
      return;
    }

    if (alreadyPaidOrInReview) {
      setFormError("Your payment or Student Operations review is already in progress. Please check your student progress page.");
      return;
    }

    if (!canSelect) {
      setFormError("Your application must be approved and your assessment must be passed before selecting an internship.");
      return;
    }

    if (!dateOfBirth || dateOfBirth > todayISO()) {
      setFormError("Enter a valid date of birth.");
      return;
    }

    const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
    const now = new Date();
    const validCalendarDate =
      Number.isFinite(dob.getTime()) &&
      dob.toISOString().slice(0, 10) === dateOfBirth;
    let age = now.getUTCFullYear() - dob.getUTCFullYear();

    const birthdayHasNotOccurred =
      now.getUTCMonth() < dob.getUTCMonth() ||
      (now.getUTCMonth() === dob.getUTCMonth() &&
        now.getUTCDate() < dob.getUTCDate());

    if (birthdayHasNotOccurred) age -= 1;

    if (!validCalendarDate || age < 13 || age > 100) {
      setFormError("Please enter a valid date of birth.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/student/internships/select", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          internshipId: selectedProgram.id,
          planCode: selectedPlan.planCode,
          dateOfBirth,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        router.replace("/login?next=/student/internships");
        return;
      }

      if (!response.ok || !payload || typeof payload !== "object" ||
          (payload as ApiPayload).success === false) {
        throw new Error(
          errorMessage(payload, "Unable to save internship selection. Please try again."),
        );
      }

      // DOB is sent in the POST body, never placed in the URL.
      // The server must validate eligibility and save the selection before returning success.
      const params = new URLSearchParams({
        internshipId: selectedProgram.id,
        planCode: selectedPlan.planCode,
      });

      router.push(`/student/payment?${params.toString()}`);
    } catch (requestError) {
      console.error("[student/internships] selection error", requestError);
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to continue. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="h-10 w-72 rounded-lg bg-slate-200" />
          <div className="mt-4 h-5 max-w-xl rounded bg-slate-200" />
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-80 rounded-3xl bg-white shadow-sm" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
        <section className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="text-sm font-black uppercase tracking-widest text-red-600">
            CyberNet Careers
          </div>
          <h1 className="mt-4 text-2xl font-black text-slate-950">
            Unable to load your account
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error || "Your profile could not be verified."}
          </p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }

  if (alreadyPaidOrInReview && profile) {
    const paymentStatus = statusValue(profile.paymentStatus);
    const internshipStatus = statusValue(profile.internshipStatus);
    const paymentVerified = ["paid", "captured", "verified", "success", "successful"].includes(paymentStatus);

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
        <section className="w-full max-w-2xl rounded-3xl border border-blue-100 bg-white p-8 shadow-xl sm:p-10">
          <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
            CyberNet Careers
          </span>
          <h1 className="mt-6 text-3xl font-black text-slate-950">
            {paymentVerified ? "Payment recorded" : "Internship review in progress"}
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            {paymentVerified
              ? "Your payment is recorded. Student Operations must review and approve your internship before dashboard access is enabled."
              : "Your internship is already in the post-selection workflow. To avoid duplicate selections or payments, this page is temporarily locked."}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment status</p>
              <p className="mt-2 font-black text-slate-900">{profile.paymentStatus || "Not available"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Internship status</p>
              <p className="mt-2 font-black text-slate-900">{profile.internshipStatus || "Not available"}</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-500">
            Dashboard credentials are issued only after Student Operations approval. Do not make another payment for the same selection.
          </p>
          <button
            type="button"
            onClick={() => router.push("/student/progress")}
            className="mt-7 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
          >
            Check Student Progress
          </button>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="ml-3 mt-7 rounded-xl border border-slate-200 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh Status"}
          </button>
        </section>
      </main>
    );
  }

  if (!canSelect) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
        <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
          <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
            CyberNet Careers
          </span>
          <h1 className="mt-6 text-3xl font-black text-slate-950">
            Complete your assessment first
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            Internship selection becomes available after your application is approved
            and you pass the technical assessment.
          </p>
          <button
            type="button"
            onClick={() => router.push("/student/assessment")}
            className="mt-7 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
          >
            Go to Assessment
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
              CyberNet Careers
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Choose Your Internship
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Select a program and duration. Confirm your personal details before
              proceeding to secure payment.
            </p>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadData(true)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "↻ Refresh Programs"}
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="mb-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Student
            </p>
            <p className="mt-2 truncate text-lg font-black">
              {profile.fullName || "Student"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {profile.studentId || "Student ID pending"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Assessment
            </p>
            <p className="mt-2 text-lg font-black text-emerald-600">Passed</p>
            <p className="mt-1 text-xs text-slate-500">Internship selection unlocked</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Available plans
            </p>
            <p className="mt-2 text-lg font-black">₹499 / ₹999 / ₹1,699</p>
            <p className="mt-1 text-xs text-slate-500">1, 3 and 6 months</p>
          </div>
        </div>

        <div className="mb-7 grid gap-3 lg:grid-cols-[1fr_240px_190px]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search internships, skills or technologies..."
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          />
          <select
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-500"
          >
            <option value="ALL">All Domains</option>
            {domains.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-500"
          >
            <option value="ALL">All Modes</option>
            <option value="REMOTE">Remote</option>
            <option value="ONSITE">On-site</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>

        {filteredPrograms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <h2 className="text-2xl font-black">No internships found</h2>
            <p className="mt-2 text-sm text-slate-500">
              Try a different search or clear the filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDomain("ALL");
                setMode("ALL");
              }}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPrograms.map((program) => {
              const cheapest = Math.min(...program.plans.map((plan) => plan.price));

              return (
                <article
                  key={program.id}
                  className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-black text-white">
                      {program.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-black">{program.title}</h2>
                      <p className="mt-1 text-sm font-bold text-blue-600">{program.domain}</p>
                    </div>
                  </div>

                  <p className="mt-5 line-clamp-3 text-sm leading-6 text-slate-600">
                    {program.description}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-400">MODE</p>
                      <p className="mt-1 text-sm font-bold">{modeLabel(program.mode)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-400">LOCATION</p>
                      <p className="mt-1 text-sm font-bold">{program.location}</p>
                    </div>
                  </div>

                  {program.skills.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {program.skills.slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-blue-600">
                      Available plans
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {PLAN_ORDER.map((code) => {
                        const plan = program.plans.find((item) => item.planCode === code);
                        return (
                          <div key={code} className="rounded-xl bg-white p-2 text-center">
                            <p className="text-[10px] font-bold text-slate-500">
                              {PLAN_INFO[code].label}
                            </p>
                            <p className="mt-1 text-sm font-black">
                              {plan ? money(plan.price, plan.currency) : "N/A"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="mt-5 text-sm text-slate-500">
                    Starting from <strong className="text-slate-950">{money(cheapest)}</strong>
                  </p>

                  <button
                    type="button"
                    onClick={() => openProgram(program)}
                    className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white hover:bg-blue-700"
                  >
                    View Plans & Continue →
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedProgram && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="selection-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="border-b border-slate-200 p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-blue-600">
                    Internship selection
                  </p>
                  <h2 id="selection-dialog-title" className="mt-2 text-2xl font-black">
                    {selectedProgram.title}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-blue-600">
                    {selectedProgram.domain}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  aria-label="Close selection form"
                  className="h-10 w-10 rounded-xl bg-slate-100 text-xl font-bold text-slate-600 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Choose a duration, confirm your details and continue to payment.
              </p>
            </header>

            <form onSubmit={handleSelectionSubmit} className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              <section>
                <h3 className="text-lg font-black">1. Select duration</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {PLAN_ORDER.map((code) => {
                    const plan = selectedProgram.plans.find((item) => item.planCode === code);
                    if (!plan) {
                      return (
                        <div key={code} className="rounded-2xl border border-dashed border-slate-300 p-4 opacity-60">
                          <p className="font-bold">{PLAN_INFO[code].label}</p>
                          <p className="mt-2 text-xs text-slate-500">Unavailable</p>
                        </div>
                      );
                    }

                    const active = selectedPlan?.planCode === code;

                    return (
                      <button
                        key={code}
                        type="button"
                        disabled={submitting}
                        onClick={() => setSelectedPlan(plan)}
                        className={`rounded-2xl border-2 p-4 text-left transition ${
                          active
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-500">{plan.duration}</p>
                        <p className="mt-2 text-2xl font-black">{money(plan.price, plan.currency)}</p>
                        <p className="mt-2 text-xs text-slate-500">One-time program price</p>
                        <p className="mt-4 text-xs font-black">{active ? "✓ Selected" : "Select plan"}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-8">
                <h3 className="text-lg font-black">2. Confirm student details</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Your name is taken from your verified student account.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Student name</span>
                    <input
                      value={profile?.fullName || ""}
                      readOnly
                      className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-600"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Student ID</span>
                    <input
                      value={profile?.studentId || "Assigned by server"}
                      readOnly
                      className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-600"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-bold text-slate-700">Date of birth</span>
                    <input
                      type="date"
                      required
                      value={dateOfBirth}
                      min={dateYearsAgo(100)}
                      max={todayISO()}
                      onChange={(event) => setDateOfBirth(event.target.value)}
                      className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                    <span className="mt-2 block text-xs text-slate-500">
                      This will be submitted securely to the server for validation.
                    </span>
                  </label>
                </div>
              </section>

              {selectedPlan && (
                <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-blue-600">
                        Selected plan
                      </p>
                      <p className="mt-1 font-black">{selectedPlan.duration}</p>
                    </div>
                    <p className="text-2xl font-black">
                      {money(selectedPlan.price, selectedPlan.currency)}
                    </p>
                  </div>
                </section>
              )}

              {formError && (
                <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {formError}
                </div>
              )}

              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Prices shown here are indicative. The server validates the selected plan and final amount.
                Payment is verified by the server. Completing payment does not automatically unlock your dashboard.
                Student Operations approval and new dashboard credentials are required.
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedPlan || !dateOfBirth}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Saving selection..." : "Confirm Details & Continue to Payment →"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
