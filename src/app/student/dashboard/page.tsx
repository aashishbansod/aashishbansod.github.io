"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  CreditCard,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type DashboardStatus =
  | "locked"
  | "pending"
  | "active";

type AssessmentStatus =
  | "not-started"
  | "scheduled"
  | "in-progress"
  | "submitted"
  | "evaluated"
  | "passed"
  | "failed"
  | string;

type PaymentStatus =
  | "unpaid"
  | "not_required"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | string;

type InternshipStatus =
  | "locked"
  | "pending"
  | "approved"
  | "active"
  | "completed"
  | string;

type AdminApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | string;

type CertificateStatus =
  | "not-eligible"
  | "eligible"
  | "generated"
  | "verified"
  | string;

type StudentProfile = {
  _id?: string;

  applicationId?: string;

  fullName?: string;
  email?: string;
  emailVerified?: boolean;

  phone?: string;

  studentId?: string;

  collegeName?: string;
  university?: string;
  course?: string;
  branchStream?: string;

  year?: string;
  semester?: string;
  cgpa?: string;

  applicationStatus?: string;
  submittedAt?: string;

  batchName?: string;
  batchDate?: string;

  assessmentStatus?: AssessmentStatus;
  assessmentScore?: number | null;

  assessmentStartedAt?: string;
  assessmentSubmittedAt?: string;
  assessmentEvaluatedAt?: string;

  resultDeclaredAt?: string;
  resultVisibleAt?: string;
  resultStatus?: string;

  internshipApplicationAllowed?: boolean;
  internshipTrack?: string;
  internshipPlan?: string;
  internshipStatus?: InternshipStatus;

  paymentStatus?: PaymentStatus;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentId?: string;

  adminApprovalStatus?: AdminApprovalStatus;

  approvedAt?: string;
  adminApprovedAt?: string;

  dashboardStatus?: DashboardStatus;
  dashboardActivatedAt?: string;

  certificateStatus?: CertificateStatus;
  certificateId?: string;

  journeyStartedAt?: string;
  journeyExpiresAt?: string;
  journeyExpired?: boolean;

  loginEnabled?: boolean;
  lastLoginAt?: string;

  updatedAt?: string;
  createdAt?: string;
};

type ApiPayload = {
  success?: boolean;
  message?: string;
  code?: string;

  data?: unknown;

  student?: unknown;
  profile?: unknown;
};

// ============================================================
// CONSTANTS
// ============================================================

const PROFILE_API = "/api/student/profile";

const LOGIN_ROUTE = "/login";

const ASSESSMENT_ROUTE = "/student/assessment";
const INTERNSHIPS_ROUTE = "/student/internships";
const PAYMENT_ROUTE = "/student/payment";
const RESULT_ROUTE = "/student/assessment/result";

const CERTIFICATE_ROUTE = "/certificate";

// ============================================================
// NAVIGATION
// ============================================================

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
  requires?: "assessment" | "internship" | "payment" | "certificate";
};

const NAVIGATION: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/student/dashboard",
    icon: LayoutDashboard,
    description: "Your internship journey overview",
  },
  {
    label: "Assessment",
    href: ASSESSMENT_ROUTE,
    icon: BookOpenCheck,
    description: "Complete your technical assessment",
    requires: "assessment",
  },
  {
    label: "Internships",
    href: INTERNSHIPS_ROUTE,
    icon: BriefcaseBusiness,
    description: "Choose your internship plan",
    requires: "internship",
  },
  {
    label: "Payment",
    href: PAYMENT_ROUTE,
    icon: CreditCard,
    description: "Complete internship payment",
    requires: "payment",
  },
  {
    label: "Certificate",
    href: CERTIFICATE_ROUTE,
    icon: Award,
    description: "View your certificate status",
    requires: "certificate",
  },
];

// ============================================================
// HELPERS
// ============================================================

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function safeNumber(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeAssessmentStatus(
  value: unknown,
): AssessmentStatus {
  const status = cleanString(value)
    .toLowerCase()
    .replace(/_/g, "-");

  if (!status) {
    return "not-started";
  }

  return status;
}

function normalizeDashboardStatus(
  value: unknown,
): DashboardStatus {
  const status = cleanString(value)
    .toLowerCase();

  if (
    status === "active" ||
    status === "pending" ||
    status === "locked"
  ) {
    return status;
  }

  return "locked";
}

function normalizeProfile(
  source: unknown,
): StudentProfile {
  if (
    !source ||
    typeof source !== "object"
  ) {
    return {};
  }

  const record =
    source as Record<string, unknown>;

  return {
    ...record,

    fullName:
      cleanString(record.fullName),

    email:
      cleanString(record.email),

    studentId:
      cleanString(record.studentId),

    internshipTrack:
      cleanString(record.internshipTrack),

    internshipPlan:
      cleanString(record.internshipPlan),

    assessmentStatus:
      normalizeAssessmentStatus(
        record.assessmentStatus,
      ),

    assessmentScore:
      safeNumber(
        record.assessmentScore,
      ),

    dashboardStatus:
      normalizeDashboardStatus(
        record.dashboardStatus,
      ),

    paymentStatus:
      cleanString(
        record.paymentStatus,
      ).toLowerCase(),

    internshipStatus:
      cleanString(
        record.internshipStatus,
      ).toLowerCase(),

    adminApprovalStatus:
      cleanString(
        record.adminApprovalStatus,
      ).toLowerCase(),

    certificateStatus:
      cleanString(
        record.certificateStatus,
      ).toLowerCase(),
  };
}

function getApiMessage(
  payload: unknown,
  fallback: string,
): string {
  if (
    payload &&
    typeof payload === "object"
  ) {
    const root =
      payload as ApiPayload;

    const message =
      cleanString(root.message);

    if (message) {
      return message;
    }

    if (
      root.data &&
      typeof root.data === "object"
    ) {
      const data =
        root.data as Record<
          string,
          unknown
        >;

      const dataMessage =
        cleanString(data.message);

      if (dataMessage) {
        return dataMessage;
      }
    }
  }

  return fallback;
}

function formatDate(
  value?: string,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatCurrency(
  amount?: number,
  currency = "INR",
): string {
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      },
    ).format(amount);
  } catch {
    return `₹${Math.round(amount)}`;
  }
}

function getInitials(
  fullName?: string,
): string {
  const value =
    cleanString(fullName);

  if (!value) {
    return "CN";
  }

  const parts =
    value.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`
    .toUpperCase();
}

function getTrackLabel(
  track?: string,
): string {
  const value =
    cleanString(track);

  if (!value) {
    return "Internship Track";
  }

  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

// ============================================================
// FLOW STATE
// ============================================================

function hasPassedAssessment(
  profile: StudentProfile,
): boolean {
  return (
    normalizeAssessmentStatus(
      profile.assessmentStatus,
    ) === "passed"
  );
}

function hasSelectedInternship(
  profile: StudentProfile,
): boolean {
  return Boolean(
    cleanString(
      profile.internshipPlan,
    ),
  );
}

function canOpenAssessment(
  profile: StudentProfile,
): boolean {
  const status =
    normalizeAssessmentStatus(
      profile.assessmentStatus,
    );

  return (
    status !== "passed" &&
    profile.journeyExpired !== true
  );
}

function canOpenInternship(
  profile: StudentProfile,
): boolean {
  return (
    hasPassedAssessment(profile) &&
    profile.internshipApplicationAllowed !== false
  );
}

function canOpenPayment(
  profile: StudentProfile,
): boolean {
  return (
    hasPassedAssessment(profile) &&
    hasSelectedInternship(profile) &&
    cleanString(
      profile.paymentStatus,
    ) !== "paid"
  );
}

function canOpenCertificate(
  profile: StudentProfile,
): boolean {
  const status =
    cleanString(
      profile.certificateStatus,
    ).toLowerCase();

  return (
    status === "eligible" ||
    status === "generated" ||
    status === "verified"
  );
}

function isNavigationUnlocked(
  item: NavigationItem,
  profile: StudentProfile,
): boolean {
  if (!item.requires) {
    return true;
  }

  switch (item.requires) {
    case "assessment":
      return canOpenAssessment(profile);

    case "internship":
      return canOpenInternship(profile);

    case "payment":
      return canOpenPayment(profile);

    case "certificate":
      return canOpenCertificate(profile);

    default:
      return false;
  }
}

// ============================================================
// PAGE
// ============================================================

export default function StudentDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [
    profile,
    setProfile,
  ] = useState<StudentProfile | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  // ==========================================================
  // LOAD PROFILE
  // ==========================================================

  const loadProfile = useCallback(
    async (
      isRefresh = false,
    ) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response =
          await fetch(
            PROFILE_API,
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json",
              },

              credentials:
                "include",

              cache:
                "no-store",
            },
          );

        const payload: unknown =
          await response
            .json()
            .catch(() => null);

        if (
          response.status === 401
        ) {
          router.replace(
            `${LOGIN_ROUTE}?next=/student/dashboard`,
          );

          return;
        }

        if (!response.ok) {
          throw new Error(
            getApiMessage(
              payload,
              "Unable to load your student dashboard.",
            ),
          );
        }

        const root =
          payload as ApiPayload;

        let rawProfile: unknown =
          root.data;

        if (
          !rawProfile ||
          typeof rawProfile !== "object"
        ) {
          rawProfile =
            root.student ??
            root.profile ??
            payload;
        }

        /*
         * Some APIs return:
         *
         * { data: { student: {...} } }
         *
         * Support that shape too.
         */
        if (
          rawProfile &&
          typeof rawProfile === "object" &&
          "student" in
            (rawProfile as Record<
              string,
              unknown
            >)
        ) {
          rawProfile =
            (
              rawProfile as Record<
                string,
                unknown
              >
            ).student;
        }

        const normalized =
          normalizeProfile(
            rawProfile,
          );

        setProfile(
          normalized,
        );
      } catch (caughtError) {
        console.error(
          "[StudentDashboard] Profile:",
          caughtError,
        );

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load your dashboard.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // ==========================================================
  // CLOSE MOBILE SIDEBAR
  // ==========================================================

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // ==========================================================
  // LOCK BODY WHEN MOBILE SIDEBAR OPEN
  // ==========================================================

  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // ==========================================================
  // ESCAPE
  // ==========================================================

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [sidebarOpen]);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      /*
       * The authentication architecture uses the
       * HttpOnly cybernet_auth_token cookie.
       *
       * If the logout route exists, it clears that cookie.
       */
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",
          },

          credentials:
            "include",

          cache:
            "no-store",
        },
      );
    } catch (logoutError) {
      console.error(
        "[StudentDashboard] Logout:",
        logoutError,
      );
    } finally {
      router.replace(LOGIN_ROUTE);
      router.refresh();
    }
  };

  // ==========================================================
  // DERIVED STATE
  // ==========================================================

  const assessmentPassed =
    profile
      ? hasPassedAssessment(profile)
      : false;

  const internshipSelected =
    profile
      ? hasSelectedInternship(profile)
      : false;

  const internshipAllowed =
    profile
      ? canOpenInternship(profile)
      : false;

  const paymentAllowed =
    profile
      ? canOpenPayment(profile)
      : false;

  const certificateAllowed =
    profile
      ? canOpenCertificate(profile)
      : false;

  const assessmentStatus =
    normalizeAssessmentStatus(
      profile?.assessmentStatus,
    );

  const dashboardStatus =
    normalizeDashboardStatus(
      profile?.dashboardStatus,
    );

  const paymentStatus =
    cleanString(
      profile?.paymentStatus,
    ).toLowerCase();

  const adminApprovalStatus =
    cleanString(
      profile?.adminApprovalStatus,
    ).toLowerCase();

  const internshipStatus =
    cleanString(
      profile?.internshipStatus,
    ).toLowerCase();

  const journeyExpired =
    profile?.journeyExpired === true;

  const score =
    typeof profile?.assessmentScore ===
      "number"
      ? Math.max(
          0,
          Math.min(
            100,
            profile.assessmentScore,
          ),
        )
      : null;

  // ==========================================================
  // CURRENT STEP
  // ==========================================================

  const journey = useMemo(() => {
    if (!profile) {
      return {
        current: 1,
        title: "Verifying your account",
        description:
          "Please wait while we load your student journey.",
        href: "/student/dashboard",
        button: "Loading",
      };
    }

    if (journeyExpired) {
      return {
        current: 0,
        title: "Journey expired",
        description:
          "Your student journey has expired. Please contact CyberNet Careers for further assistance.",
        href: "/student/dashboard",
        button: "Contact support",
      };
    }

    if (!assessmentPassed) {
      return {
        current: 1,
        title: "Complete your assessment",
        description:
          "Your technical assessment is the next required step before internship selection.",
        href: ASSESSMENT_ROUTE,
        button:
          assessmentStatus === "in-progress"
            ? "Continue assessment"
            : "Start assessment",
      };
    }

    if (!internshipSelected) {
      return {
        current: 2,
        title: "Select your internship",
        description:
          "Your assessment is complete. Choose the internship duration that suits you.",
        href: INTERNSHIPS_ROUTE,
        button: "View internships",
      };
    }

    if (
      paymentStatus !== "paid"
    ) {
      return {
        current: 3,
        title: "Complete payment",
        description:
          "Complete payment for your selected internship plan.",
        href: PAYMENT_ROUTE,
        button: "Continue to payment",
      };
    }

    if (
      adminApprovalStatus !== "approved" ||
      dashboardStatus !== "active"
    ) {
      return {
        current: 4,
        title: "Waiting for admin approval",
        description:
          "Your payment has been recorded. Your internship dashboard will activate after the required approval.",
        href: "/student/dashboard",
        button: "View status",
      };
    }

    return {
      current: 5,
      title: "Internship active",
      description:
        "Your internship journey is active. Keep progressing through your assigned work.",
      href: "/student/dashboard",
      button: "View dashboard",
    };
  }, [
    profile,
    journeyExpired,
    assessmentPassed,
    assessmentStatus,
    internshipSelected,
    paymentStatus,
    adminApprovalStatus,
    dashboardStatus,
  ]);

  // ==========================================================
  // STEP STATUS
  // ==========================================================

  const stepOneComplete =
    assessmentPassed;

  const stepTwoComplete =
    internshipSelected;

  const stepThreeComplete =
    paymentStatus === "paid";

  const stepFourComplete =
    paymentStatus === "paid" &&
    adminApprovalStatus === "approved";

  // ==========================================================
  // NAV CLICK
  // ==========================================================

  const handleNavigation = (
    item: NavigationItem,
  ) => {
    if (!profile) {
      return;
    }

    const unlocked =
      isNavigationUnlocked(
        item,
        profile,
      );

    if (!unlocked) {
      return;
    }

    setSidebarOpen(false);

    router.push(item.href);
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading && !profile) {
    return (
      <DashboardLoading />
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (!profile) {
    return (
      <main className="min-h-[100dvh] bg-slate-950 px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-[30px] border border-white/10 bg-white p-7 shadow-2xl sm:p-9">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <CircleHelp className="h-7 w-7" />
            </div>

            <h1 className="mt-5 text-center text-2xl font-black tracking-tight text-slate-950">
              Dashboard unavailable
            </h1>

            <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-slate-500">
              {error ||
                "We could not verify your student account."}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  void loadProfile()
                }
                className="
                  inline-flex
                  h-12
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  bg-blue-600
                  px-5
                  text-sm
                  font-black
                  text-white
                  transition
                  hover:bg-blue-700
                  focus:outline-none
                  focus:ring-4
                  focus:ring-blue-200
                "
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>

              <Link
                href={LOGIN_ROUTE}
                className="
                  inline-flex
                  h-12
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  px-5
                  text-sm
                  font-black
                  text-slate-700
                  transition
                  hover:bg-slate-50
                "
              >
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <div className="min-h-[100dvh] bg-[#f5f7fb] text-slate-900">
      {/* ======================================================
          MOBILE OVERLAY
      ====================================================== */}

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close student navigation"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="
            fixed
            inset-0
            z-40
            bg-slate-950/45
            backdrop-blur-sm
            lg:hidden
          "
        />
      ) : null}

      {/* ======================================================
          SIDEBAR
      ====================================================== */}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col border-r border-slate-800 bg-[#0b1220] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0",
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex h-[82px] shrink-0 items-center border-b border-white/8 px-5">
          <Link
            href="/student/dashboard"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[15px] font-black tracking-tight text-white">
                CyberNet Careers
              </p>

              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400">
                Student Portal
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            aria-label="Close navigation"
            className="
              ml-auto
              rounded-xl
              p-2
              text-white/45
              transition
              hover:bg-white/10
              hover:text-white
              lg:hidden
            "
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Student mini profile */}
        <div className="border-b border-white/8 p-4">
          <div className="rounded-2xl border border-white/8 bg-white/5 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-black text-white">
                {getInitials(
                  profile.fullName,
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-white">
                  {profile.fullName ||
                    "Student"}
                </p>

                <p className="mt-0.5 truncate text-[11px] text-white/45">
                  {profile.studentId ||
                    "Student account"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
            Student Portal
          </p>

          <nav className="space-y-1.5">
            {NAVIGATION.map(
              (item) => {
                const Icon =
                  item.icon;

                const unlocked =
                  isNavigationUnlocked(
                    item,
                    profile,
                  );

                const active =
                  pathname ===
                  item.href;

                if (!unlocked) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      disabled
                      title={
                        item.requires ===
                        "internship"
                          ? "Pass your assessment first"
                          : item.requires ===
                            "payment"
                            ? "Select an internship plan first"
                            : item.requires ===
                              "certificate"
                              ? "Certificate is not available yet"
                              : "Complete the previous step first"
                      }
                      className="
                        flex
                        w-full
                        cursor-not-allowed
                        items-center
                        gap-3
                        rounded-2xl
                        px-3
                        py-3
                        text-left
                        opacity-35
                      "
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold">
                          {item.label}
                        </span>

                        <span className="mt-0.5 block truncate text-[9px] text-white/40">
                          {item.description}
                        </span>
                      </span>

                      <Lock className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() =>
                      setSidebarOpen(false)
                    }
                    className={[
                      "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all",
                      active
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/25"
                        : "text-white/65 hover:bg-white/7 hover:text-white",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                        active
                          ? "bg-white/15"
                          : "bg-white/5 group-hover:bg-white/10",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold">
                        {item.label}
                      </span>

                      <span
                        className={[
                          "mt-0.5 block truncate text-[9px]",
                          active
                            ? "text-white/60"
                            : "text-white/30",
                        ].join(" ")}
                      >
                        {item.description}
                      </span>
                    </span>

                    {active ? (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    ) : null}
                  </Link>
                );
              },
            )}
          </nav>

          {/* Journey mini card */}
          <div className="mt-6 rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-blue-500/10 to-cyan-400/5 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />

              <p className="text-[10px] font-black uppercase tracking-wider text-white/70">
                Current step
              </p>
            </div>

            <p className="mt-2 text-xs font-extrabold text-white">
              {journey.title}
            </p>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      ((Math.max(
                        1,
                        journey.current,
                      ) -
                        1) /
                        4) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="shrink-0 border-t border-white/8 p-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="
              flex
              w-full
              items-center
              gap-3
              rounded-2xl
              px-3
              py-3
              text-left
              text-white/55
              transition
              hover:bg-red-500/10
              hover:text-red-300
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
              {isLoggingOut ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </span>

            <span className="text-xs font-bold">
              {isLoggingOut
                ? "Signing out..."
                : "Sign out"}
            </span>
          </button>
        </div>
      </aside>

      {/* ======================================================
          PAGE SHELL
      ====================================================== */}

      <div className="min-h-[100dvh] lg:pl-[286px]">
        {/* ====================================================
            TOPBAR
        ==================================================== */}

        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setSidebarOpen(true)
                }
                aria-label="Open student navigation"
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  text-slate-600
                  shadow-sm
                  transition
                  hover:bg-slate-50
                  lg:hidden
                "
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Student Dashboard
                </p>

                <h1 className="truncate text-base font-black tracking-tight text-slate-950 sm:text-lg">
                  Welcome,{" "}
                  {profile.fullName?.split(
                    /\s+/,
                  )[0] ||
                    "Student"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadProfile(true)
                }
                disabled={refreshing}
                aria-label="Refresh dashboard"
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  shadow-sm
                  transition
                  hover:border-blue-200
                  hover:text-blue-600
                  disabled:opacity-50
                "
              >
                <RefreshCw
                  className={[
                    "h-4 w-4",
                    refreshing
                      ? "animate-spin"
                      : "",
                  ].join(" ")}
                />
              </button>

              <div className="hidden h-8 w-px bg-slate-200 sm:block" />

              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white shadow-md shadow-blue-500/15">
                  {getInitials(
                    profile.fullName,
                  )}
                </div>

                <div className="hidden min-w-0 sm:block">
                  <p className="max-w-[150px] truncate text-xs font-extrabold text-slate-800">
                    {profile.fullName ||
                      "Student"}
                  </p>

                  <p className="mt-0.5 max-w-[150px] truncate text-[10px] text-slate-400">
                    {profile.studentId ||
                      "Student"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ====================================================
            MAIN 3-COLUMN AREA
        ==================================================== */}

        <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* ==================================================
                CENTER
            ================================================== */}

            <div className="min-w-0 space-y-5">
              {/* Welcome / Journey Hero */}
              <section className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[#0b1220] p-5 text-white shadow-xl sm:p-7">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]"
                />

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-[90px]"
                />

                <div className="relative">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        <Activity className="h-3.5 w-3.5" />
                        Internship journey
                      </div>

                      <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] sm:text-3xl lg:text-4xl">
                        {journey.title}
                      </h2>

                      <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
                        {journey.description}
                      </p>

                      {profile.internshipTrack ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[11px] font-bold text-white/70">
                            <Code2 className="h-3.5 w-3.5 text-cyan-400" />
                            {getTrackLabel(
                              profile.internshipTrack,
                            )}
                          </span>

                          {profile.internshipPlan ? (
                            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[11px] font-bold text-white/70">
                              <Clock3 className="h-3.5 w-3.5 text-blue-400" />
                              {profile.internshipPlan}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {journey.current > 0 &&
                    journey.current < 5 ? (
                      <Link
                        href={journey.href}
                        className="
                          group
                          inline-flex
                          shrink-0
                          items-center
                          justify-center
                          gap-2
                          rounded-2xl
                          bg-white
                          px-5
                          py-3.5
                          text-xs
                          font-black
                          text-slate-950
                          shadow-lg
                          transition
                          hover:-translate-y-0.5
                        "
                      >
                        {journey.button}

                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </section>

              {/* ==================================================
                  STATUS CARDS
              ================================================== */}

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatusCard
                  icon={BookOpenCheck}
                  label="Assessment"
                  value={
                    assessmentPassed
                      ? "Passed"
                      : assessmentStatus ===
                        "in-progress"
                        ? "In progress"
                        : "Pending"
                  }
                  detail={
                    score !== null
                      ? `${score}/100`
                      : "40/100 required"
                  }
                  tone={
                    assessmentPassed
                      ? "success"
                      : "blue"
                  }
                />

                <StatusCard
                  icon={BriefcaseBusiness}
                  label="Internship"
                  value={
                    internshipSelected
                      ? profile.internshipPlan ||
                        "Selected"
                      : "Locked"
                  }
                  detail={
                    internshipSelected
                      ? getTrackLabel(
                          profile.internshipTrack,
                        )
                      : "Pass assessment first"
                  }
                  tone={
                    internshipSelected
                      ? "success"
                      : "slate"
                  }
                />

                <StatusCard
                  icon={CreditCard}
                  label="Payment"
                  value={
                    paymentStatus === "paid"
                      ? "Paid"
                      : paymentStatus ===
                        "pending"
                        ? "Pending"
                        : "Not completed"
                  }
                  detail={
                    profile.paymentAmount
                      ? formatCurrency(
                          profile.paymentAmount,
                          profile.paymentCurrency ||
                            "INR",
                        )
                      : "Awaiting plan selection"
                  }
                  tone={
                    paymentStatus === "paid"
                      ? "success"
                      : "orange"
                  }
                />

                <StatusCard
                  icon={ShieldCheck}
                  label="Dashboard"
                  value={
                    dashboardStatus ===
                    "active"
                      ? "Active"
                      : dashboardStatus ===
                        "pending"
                        ? "Pending"
                        : "Locked"
                  }
                  detail={
                    internshipStatus ||
                    "Journey status"
                  }
                  tone={
                    dashboardStatus ===
                    "active"
                      ? "success"
                      : "blue"
                  }
                />
              </section>

              {/* ==================================================
                  JOURNEY PROGRESS
              ================================================== */}

              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                      Your progress
                    </p>

                    <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                      Complete each step in order
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-slate-400">
                    Step{" "}
                    {Math.min(
                      5,
                      Math.max(
                        1,
                        journey.current,
                      ),
                    )}{" "}
                    of 5
                  </span>
                </div>

                <div className="mt-7 grid gap-4 md:grid-cols-4">
                  <JourneyStep
                    number="01"
                    title="Assessment"
                    description="Complete technical assessment"
                    complete={stepOneComplete}
                    active={
                      journey.current === 1
                    }
                    locked={false}
                    href={
                      assessmentPassed
                        ? RESULT_ROUTE
                        : ASSESSMENT_ROUTE
                    }
                  />

                  <JourneyStep
                    number="02"
                    title="Internship"
                    description="Select your duration"
                    complete={stepTwoComplete}
                    active={
                      journey.current === 2
                    }
                    locked={!stepOneComplete}
                    href={INTERNSHIPS_ROUTE}
                  />

                  <JourneyStep
                    number="03"
                    title="Payment"
                    description="Complete selected plan"
                    complete={stepThreeComplete}
                    active={
                      journey.current === 3
                    }
                    locked={
                      !stepTwoComplete
                    }
                    href={PAYMENT_ROUTE}
                  />

                  <JourneyStep
                    number="04"
                    title="Approval"
                    description="Admin validates your payment"
                    complete={stepFourComplete}
                    active={
                      journey.current === 4
                    }
                    locked={
                      !stepThreeComplete
                    }
                    href="/student/dashboard"
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                      <ShieldCheck className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-xs font-black text-slate-800">
                        Secure student journey
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        Each stage is controlled by your
                        account status. Completing a later
                        stage does not unlock it until the
                        required previous stage is completed.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ==================================================
                  ASSESSMENT / NEXT ACTION
              ================================================== */}

              <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
                <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
                        <BookOpenCheck className="h-3.5 w-3.5" />
                        Assessment
                      </div>

                      <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">
                        Technical assessment
                      </h3>

                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                        Your assessment contains the
                        required technical sections for
                        your selected internship domain.
                      </p>
                    </div>

                    <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-blue-600 sm:flex">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MiniMetric
                      value="30"
                      label="MCQs"
                    />

                    <MiniMetric
                      value="2"
                      label="Coding"
                    />

                    <MiniMetric
                      value="100"
                      label="Total marks"
                    />

                    <MiniMetric
                      value="40"
                      label="Pass marks"
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    {!assessmentPassed ? (
                      <Link
                        href={ASSESSMENT_ROUTE}
                        className="
                          group
                          inline-flex
                          h-12
                          flex-1
                          items-center
                          justify-center
                          gap-2
                          rounded-2xl
                          bg-blue-600
                          px-5
                          text-xs
                          font-black
                          text-white
                          shadow-lg
                          shadow-blue-600/15
                          transition
                          hover:-translate-y-0.5
                          hover:bg-blue-700
                        "
                      >
                        {assessmentStatus ===
                        "in-progress"
                          ? "Continue assessment"
                          : "Start assessment"}

                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    ) : (
                      <Link
                        href={INTERNSHIPS_ROUTE}
                        className="
                          group
                          inline-flex
                          h-12
                          flex-1
                          items-center
                          justify-center
                          gap-2
                          rounded-2xl
                          bg-emerald-600
                          px-5
                          text-xs
                          font-black
                          text-white
                          shadow-lg
                          shadow-emerald-600/15
                          transition
                          hover:-translate-y-0.5
                        "
                      >
                        Continue to internships

                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    )}

                    <Link
                      href={
                        assessmentPassed
                          ? RESULT_ROUTE
                          : ASSESSMENT_ROUTE
                      }
                      className="
                        inline-flex
                        h-12
                        flex-1
                        items-center
                        justify-center
                        gap-2
                        rounded-2xl
                        border
                        border-slate-200
                        bg-white
                        px-5
                        text-xs
                        font-black
                        text-slate-700
                        transition
                        hover:bg-slate-50
                      "
                    >
                      {assessmentPassed
                        ? "View result"
                        : "Assessment details"}
                    </Link>
                  </div>
                </div>

                {/* Selected track */}
                <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                    <Code2 className="h-5 w-5" />
                  </div>

                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Selected domain
                  </p>

                  <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                    {getTrackLabel(
                      profile.internshipTrack,
                    )}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Your assessment should correspond
                    to this internship domain.
                  </p>

                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Current plan
                    </p>

                    <p className="mt-1 text-sm font-black text-slate-800">
                      {profile.internshipPlan ||
                        "Not selected yet"}
                    </p>
                  </div>
                </div>
              </section>

              {/* ==================================================
                  ACCOUNT DETAILS
              ================================================== */}

              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                      Account
                    </p>

                    <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                      Student information
                    </h3>
                  </div>

                  <UserRound className="h-5 w-5 text-slate-300" />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem
                    label="Student ID"
                    value={
                      profile.studentId ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Email"
                    value={
                      profile.email ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="College / University"
                    value={
                      profile.collegeName ||
                      profile.university ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Course"
                    value={
                      profile.course ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Branch / Stream"
                    value={
                      profile.branchStream ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Application"
                    value={
                      profile.applicationStatus ||
                      "—"
                    }
                  />
                </div>
              </section>

              {/* ==================================================
                  MOBILE / SMALL FOOTER
              ================================================== */}

              <footer className="pb-2 pt-1 text-center lg:hidden">
                <p className="text-[10px] font-semibold text-slate-400">
                  CyberNet Careers · Student Portal
                </p>
              </footer>
            </div>

            {/* ==================================================
                RIGHT PANEL
            ================================================== */}

            <aside className="space-y-5">
              {/* Profile card */}
              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-black text-white shadow-lg shadow-blue-500/15">
                    {getInitials(
                      profile.fullName,
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black text-slate-950">
                      {profile.fullName ||
                        "Student"}
                    </h2>

                    <p className="mt-1 truncate text-[11px] text-slate-400">
                      {profile.studentId ||
                        "Student account"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        Account status
                      </p>

                      <p className="mt-0.5 text-xs font-bold text-emerald-800">
                        {profile.loginEnabled ===
                        false
                          ? "Login disabled"
                          : "Account active"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ==================================================
                  JOURNEY STATUS
              ================================================== */}

              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                      Journey
                    </p>

                    <h3 className="mt-1 text-base font-black tracking-tight text-slate-950">
                      Completion status
                    </h3>
                  </div>

                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
                    {journey.current >= 5
                      ? "Complete"
                      : `Step ${Math.max(
                          1,
                          journey.current,
                        )}/5`}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <RightStep
                    title="Application approved"
                    complete={
                      adminApprovalStatus ===
                      "approved"
                    }
                    active={false}
                  />

                  <RightStep
                    title="Assessment passed"
                    complete={
                      assessmentPassed
                    }
                    active={
                      journey.current ===
                      1
                    }
                  />

                  <RightStep
                    title="Internship selected"
                    complete={
                      internshipSelected
                    }
                    active={
                      journey.current ===
                      2
                    }
                  />

                  <RightStep
                    title="Payment completed"
                    complete={
                      stepThreeComplete
                    }
                    active={
                      journey.current ===
                      3
                    }
                  />

                  <RightStep
                    title="Internship activated"
                    complete={
                      stepFourComplete &&
                      dashboardStatus ===
                        "active"
                    }
                    active={
                      journey.current ===
                      4
                    }
                  />
                </div>
              </section>

              {/* ==================================================
                  SCORE
              ================================================== */}

              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Assessment score
                    </p>

                    <h3 className="mt-1 text-base font-black text-slate-950">
                      {score !== null
                        ? `${score}/100`
                        : "Not evaluated"}
                    </h3>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={[
                      "h-full rounded-full transition-all duration-700",
                      assessmentPassed
                        ? "bg-emerald-500"
                        : "bg-blue-600",
                    ].join(" ")}
                    style={{
                      width: `${score ?? 0}%`,
                    }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">
                    Passing score
                  </span>

                  <span className="text-slate-700">
                    40/100
                  </span>
                </div>
              </section>

              {/* ==================================================
                  PAYMENT STATUS
              ================================================== */}

              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <CreditCard className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Payment
                    </p>

                    <p className="mt-0.5 text-sm font-black text-slate-900">
                      {paymentStatus ===
                      "paid"
                        ? "Payment completed"
                        : paymentStatus ===
                          "pending"
                          ? "Payment pending"
                          : "Payment not completed"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-400">
                      Selected plan
                    </span>

                    <span className="text-xs font-black text-slate-800">
                      {profile.internshipPlan ||
                        "—"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold text-slate-400">
                      Amount
                    </span>

                    <span className="text-xs font-black text-slate-800">
                      {profile.paymentAmount
                        ? formatCurrency(
                            profile.paymentAmount,
                            profile.paymentCurrency ||
                              "INR",
                          )
                        : "—"}
                    </span>
                  </div>
                </div>

                {paymentAllowed ? (
                  <Link
                    href={PAYMENT_ROUTE}
                    className="
                      mt-4
                      inline-flex
                      h-11
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-slate-950
                      px-4
                      text-xs
                      font-black
                      text-white
                      transition
                      hover:bg-blue-700
                    "
                  >
                    Continue payment
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </section>

              {/* ==================================================
                  CERTIFICATE
              ================================================== */}

              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Certificate
                    </p>

                    <p className="mt-1 text-sm font-black text-slate-900">
                      {profile.certificateStatus
                        ? profile.certificateStatus
                            .replace(
                              /-/g,
                              " ",
                            )
                            .replace(
                              /\b\w/g,
                              (letter) =>
                                letter.toUpperCase(),
                            )
                        : "Not eligible"}
                    </p>
                  </div>

                  <Award className="h-5 w-5 text-slate-300" />
                </div>

                {certificateAllowed ? (
                  <Link
                    href={CERTIFICATE_ROUTE}
                    className="
                      mt-4
                      inline-flex
                      h-10
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      border
                      border-slate-200
                      text-xs
                      font-black
                      text-slate-700
                      transition
                      hover:bg-slate-50
                    "
                  >
                    View certificate
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[10px] font-bold text-slate-400">
                    <Lock className="h-3.5 w-3.5" />
                    Available after eligibility
                  </div>
                )}
              </section>

              {/* ==================================================
                  HELP
              ================================================== */}

              <section className="rounded-[26px] bg-gradient-to-br from-blue-600 to-cyan-500 p-5 text-white shadow-lg shadow-blue-500/15">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <CircleHelp className="h-5 w-5" />
                </div>

                <h3 className="mt-4 text-sm font-black">
                  Need help?
                </h3>

                <p className="mt-1 text-[11px] leading-5 text-white/65">
                  If your account status does not
                  update after completing a step,
                  contact CyberNet Careers support.
                </p>

                <a
                  href="mailto:cybernet.tech.india@gmail.com"
                  className="
                    mt-4
                    inline-flex
                    items-center
                    gap-1.5
                    text-[11px]
                    font-black
                    text-white
                    underline-offset-4
                    hover:underline
                  "
                >
                  Contact support
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </section>
            </aside>
          </div>

          {/* ====================================================
              DESKTOP FOOTER
          ==================================================== */}

          <footer className="mx-auto mt-7 hidden max-w-[1800px] items-center justify-between border-t border-slate-200 pt-5 text-[10px] font-semibold text-slate-400 lg:flex">
            <p>
              CyberNet Careers · Student Portal
            </p>

            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Secure student session
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// STATUS CARD
// ============================================================

type StatusCardProps = {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone:
    | "success"
    | "blue"
    | "orange"
    | "slate";
};

function StatusCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: StatusCardProps) {
  const toneClasses = {
    success: {
      icon: "bg-emerald-50 text-emerald-600",
      value: "text-emerald-700",
    },
    blue: {
      icon: "bg-blue-50 text-blue-600",
      value: "text-blue-700",
    },
    orange: {
      icon: "bg-orange-50 text-orange-600",
      value: "text-orange-700",
    },
    slate: {
      icon: "bg-slate-100 text-slate-500",
      value: "text-slate-700",
    },
  };

  const styles =
    toneClasses[tone];

  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-xl",
            styles.icon,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>

        <CheckCircle2
          className={[
            "h-4 w-4",
            tone === "success"
              ? "text-emerald-500"
              : "text-slate-200",
          ].join(" ")}
        />
      </div>

      <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p
        className={[
          "mt-1 truncate text-sm font-black",
          styles.value,
        ].join(" ")}
      >
        {value}
      </p>

      <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
        {detail}
      </p>
    </article>
  );
}

// ============================================================
// JOURNEY STEP
// ============================================================

type JourneyStepProps = {
  number: string;
  title: string;
  description: string;
  complete: boolean;
  active: boolean;
  locked: boolean;
  href: string;
};

function JourneyStep({
  number,
  title,
  description,
  complete,
  active,
  locked,
  href,
}: JourneyStepProps) {
  const content = (
    <div
      className={[
        "relative rounded-2xl border p-4 transition",
        complete
          ? "border-emerald-200 bg-emerald-50/60"
          : active
            ? "border-blue-200 bg-blue-50/60"
            : locked
              ? "border-slate-100 bg-slate-50/70 opacity-55"
              : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black",
            complete
              ? "bg-emerald-500 text-white"
              : active
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-500",
          ].join(" ")}
        >
          {complete ? (
            <Check className="h-4 w-4" />
          ) : locked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            number
          )}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black text-slate-800">
            {title}
          </p>

          <p className="mt-1 text-[10px] leading-4 text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );

  if (
    locked ||
    href === "/student/dashboard"
  ) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block"
    >
      {content}
    </Link>
  );
}

// ============================================================
// RIGHT STEP
// ============================================================

type RightStepProps = {
  title: string;
  complete: boolean;
  active: boolean;
};

function RightStep({
  title,
  complete,
  active,
}: RightStepProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          complete
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-400",
        ].join(" ")}
      >
        {complete ? (
          <Check className="h-3.5 w-3.5" />
        ) : active ? (
          <span className="h-2 w-2 rounded-full bg-white" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        )}
      </div>

      <p
        className={[
          "text-xs font-bold",
          complete || active
            ? "text-slate-800"
            : "text-slate-400",
        ].join(" ")}
      >
        {title}
      </p>
    </div>
  );
}

// ============================================================
// MINI METRIC
// ============================================================

function MiniMetric({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
      <p className="text-lg font-black tracking-tight text-slate-900">
        {value}
      </p>

      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
    </div>
  );
}

// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1.5 truncate text-xs font-bold text-slate-800">
        {value}
      </p>
    </div>
  );
}

// ============================================================
// LOADING SCREEN
// ============================================================

function DashboardLoading() {
  return (
    <main className="min-h-[100dvh] bg-[#f5f7fb]">
      <div className="flex min-h-[100dvh]">
        {/* Sidebar skeleton */}
        <aside className="hidden w-[286px] shrink-0 bg-[#0b1220] p-5 lg:block">
          <div className="h-11 w-44 animate-pulse rounded-xl bg-white/10" />

          <div className="mt-8 space-y-3">
            {Array.from({
              length: 5,
            }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-2xl bg-white/5"
              />
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="h-[72px] border-b border-slate-200 bg-white" />

          <div className="space-y-5 p-4 sm:p-6 lg:p-8">
            <div className="h-52 animate-pulse rounded-[28px] bg-slate-200/70" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({
                length: 4,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-[22px] bg-white shadow-sm"
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div className="h-64 animate-pulse rounded-[26px] bg-white shadow-sm" />

                <div className="h-72 animate-pulse rounded-[26px] bg-white shadow-sm" />

                <div className="h-52 animate-pulse rounded-[26px] bg-white shadow-sm" />
              </div>

              <div className="space-y-5">
                {Array.from({
                  length: 4,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="h-40 animate-pulse rounded-[26px] bg-white shadow-sm"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}