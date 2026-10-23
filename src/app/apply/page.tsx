"use client";

import type {
  ChangeEvent,
  FormEvent,
  ReactNode,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

/* ============================================================================
   CYBERNET CAREERS
   APPLICATION PAGE

   FLOW

   Application
        ↓
   Email OTP Verification
        ↓
   Admin Review
        ↓
   Admin Approval
        ↓
   Student ID + Password
        ↓
   Selected Domain Assessment
        ↓
   Pass
        ↓
   Internship Plan
        ↓
   Razorpay Payment
        ↓
   Payment Verification
        ↓
   Internship Dashboard

   IMPORTANT
   ----------------------------------------------------------------------------
   This page does NOT select an internship plan.
   This page does NOT collect payment.
   This page only submits the internship application and verifies email.
============================================================================ */

/* ============================================================================
   API
============================================================================ */

const APPLY_API = "/api/apply";
const VERIFY_API = "/api/apply/verify";
const INTERNSHIPS_API = "/api/internships";

/* ============================================================================
   CONSTANTS
============================================================================ */

const OTP_DEFAULT_SECONDS = 600;
const OTP_COOLDOWN_SECONDS = 60;

const CURRENT_YEAR = new Date().getFullYear();

const APPROVED_DOMAINS = [
  "Java Full Stack Development",
  "Python Full Stack Development",
  "Frontend Development",
  "Backend Development",
  "Web Development",
  "MERN Stack Development",
] as const;

/* ============================================================================
   TYPES
============================================================================ */

type Domain = (typeof APPROVED_DOMAINS)[number];

type ApplicantForm = {
  fullName: string;
  email: string;
  phone: string;
  collegeUniversity: string;
  course: string;
  branchStream: string;
  graduationYear: string;
  internshipTrack: string;
  skills: string[];
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;

  otpRequired?: boolean;
  requiresOtp?: boolean;

  applicationId?: string;
  submittedAt?: string;

  expiresInSeconds?: number;
  otpExpiresInSeconds?: number;

  cooldown?: number;
  resendAvailableIn?: number;
  retryAfter?: number;

  internships?: unknown[];
  data?: unknown;
};

type ErrorMap = Partial<
  Record<
    | keyof ApplicantForm
    | "terms"
    | "privacy"
    | "declaration"
    | "submit",
    string
  >
>;

type InternshipAvailability = {
  domain: Domain;
  available: boolean;
};

/* ============================================================================
   INITIAL FORM
============================================================================ */

const INITIAL_FORM: ApplicantForm = {
  fullName: "",
  email: "",
  phone: "",
  collegeUniversity: "",
  course: "",
  branchStream: "",
  graduationYear: "",
  internshipTrack: "",
  skills: [],
};

/* ============================================================================
   EDUCATION
============================================================================ */

const COURSE_OPTIONS = [
  "B.E.",
  "B.Tech",
  "BCA",
  "MCA",
  "B.Sc.",
  "M.Sc.",
  "Diploma",
  "Other",
] as const;

const BRANCH_OPTIONS = [
  "Computer Science Engineering",
  "Information Technology",
  "Artificial Intelligence & Machine Learning",
  "Artificial Intelligence & Data Science",
  "Data Science",
  "Electronics & Telecommunication",
  "Electronics & Communication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Computer Science",
  "Information Science",
  "Software Engineering",
  "Other",
] as const;

const GRADUATION_YEARS = Array.from(
  { length: 2050 - 2020 + 1 },
  (_, index) => String(2020 + index),
);

/* ============================================================================
   HELPERS
============================================================================ */

function normalizeText(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeEmail(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

function normalizePhone(
  value: string,
): string {
  return value
    .replace(/[^\d+]/g, "")
    .slice(0, 16);
}

function digitsOnly(
  value: string,
): string {
  return value.replace(/\D/g, "");
}

function isValidEmail(
  value: string,
): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value,
    )
  );
}

function getApiMessage(
  data: ApiResponse | null,
  fallback: string,
): string {
  if (
    typeof data?.message ===
      "string" &&
    data.message.trim()
  ) {
    return data.message;
  }

  if (
    typeof data?.error ===
      "string" &&
    data.error.trim()
  ) {
    return data.error;
  }

  return fallback;
}

function getRetrySeconds(
  data: ApiResponse | null,
  response: Response,
): number {
  const values = [
    data?.retryAfter,
    data?.cooldown,
    data?.resendAvailableIn,
  ];

  for (const value of values) {
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
    ) {
      return Math.ceil(value);
    }
  }

  const header =
    response.headers.get(
      "Retry-After",
    );

  if (header) {
    const seconds = Number(
      header,
    );

    if (
      Number.isFinite(seconds) &&
      seconds > 0
    ) {
      return Math.ceil(seconds);
    }
  }

  return 0;
}

function isApprovedDomain(
  value: string,
): value is Domain {
  return (
    APPROVED_DOMAINS as readonly string[]
  ).includes(value);
}

function getDomainFromItem(
  item: unknown,
): string {
  if (
    typeof item !== "object" ||
    item === null
  ) {
    return "";
  }

  const record =
    item as Record<
      string,
      unknown
    >;

  const values = [
    record.domain,
    record.assessmentDomain,
    record.internshipTrack,
    record.title,
    record.name,
  ];

  for (const value of values) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return normalizeText(value);
    }
  }

  return "";
}

function getItemsFromResponse(
  data: ApiResponse | null,
): unknown[] {
  if (
    Array.isArray(data?.internships)
  ) {
    return data.internships;
  }

  if (
    Array.isArray(data?.data)
  ) {
    return data.data;
  }

  return [];
}

/* ============================================================================
   COMPONENT
============================================================================ */

export default function ApplyPage() {
  const [form, setForm] =
    useState<ApplicantForm>(
      INITIAL_FORM,
    );

  const [
    termsAccepted,
    setTermsAccepted,
  ] = useState(false);

  const [
    privacyAccepted,
    setPrivacyAccepted,
  ] = useState(false);

  const [
    declarationAccepted,
    setDeclarationAccepted,
  ] = useState(false);

  const [errors, setErrors] =
    useState<ErrorMap>({});

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    otpMode,
    setOtpMode,
  ] = useState(false);

  const [otp, setOtp] =
    useState("");

  const [
    otpError,
    setOtpError,
  ] = useState("");

  const [
    otpMessage,
    setOtpMessage,
  ] = useState("");

  const [
    verifying,
    setVerifying,
  ] = useState(false);

  const [
    resending,
    setResending,
  ] = useState(false);

  const [
    resendCooldown,
    setResendCooldown,
  ] = useState(0);

  const [
    otpExpiresIn,
    setOtpExpiresIn,
  ] = useState(
    OTP_DEFAULT_SECONDS,
  );

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const [
    applicationId,
    setApplicationId,
  ] = useState("");

  const [
    submittedAt,
    setSubmittedAt,
  ] = useState("");

  const [
    internshipLoading,
    setInternshipLoading,
  ] = useState(true);

  const [
    internshipError,
    setInternshipError,
  ] = useState("");

  const [
    availability,
    setAvailability,
  ] = useState<
    InternshipAvailability[]
  >([]);

  const [
    skillSearch,
    setSkillSearch,
  ] = useState("");

  /* ========================================================================
     LOAD AVAILABLE INTERNSHIPS
  ======================================================================== */

  useEffect(() => {
    let active = true;

    async function loadInternships() {
      setInternshipLoading(true);
      setInternshipError("");

      try {
        const response =
          await fetch(
            INTERNSHIPS_API,
            {
              method: "GET",
              headers: {
                Accept:
                  "application/json",
              },
              cache: "no-store",
            },
          );

        const data =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | ApiResponse
            | null;

        if (
          !response.ok
        ) {
          throw new Error(
            getApiMessage(
              data,
              "Unable to load available internships.",
            ),
          );
        }

        const items =
          getItemsFromResponse(
            data,
          );

        const activeDomains =
          new Set<Domain>();

        for (
          const item of items
        ) {
          const domain =
            getDomainFromItem(
              item,
            );

          if (
            isApprovedDomain(
              domain,
            )
          ) {
            activeDomains.add(
              domain,
            );
          }
        }

        if (!active) {
          return;
        }

        setAvailability(
          APPROVED_DOMAINS.map(
            (domain) => ({
              domain,
              available:
                activeDomains.has(
                  domain,
                ),
            }),
          ),
        );
      } catch (error) {
        if (!active) {
          return;
        }

        /*
         * Do not silently show fake availability.
         * If the internship API cannot be checked, the applicant cannot
         * safely submit a new application.
         */
        setAvailability([]);
        setInternshipError(
          error instanceof Error
            ? error.message
            : "Unable to verify internship availability.",
        );
      } finally {
        if (active) {
          setInternshipLoading(
            false,
          );
        }
      }
    }

    void loadInternships();

    return () => {
      active = false;
    };
  }, []);

  /* ========================================================================
     AVAILABLE DOMAINS
  ======================================================================== */

  const availableDomains =
    useMemo(() => {
      return availability.filter(
        (item) =>
          item.available,
      );
    }, [availability]);

  /* ========================================================================
     SELECTED DOMAIN AVAILABILITY
  ======================================================================== */

  const selectedDomainAvailable =
    useMemo(() => {
      if (
        !form.internshipTrack
      ) {
        return false;
      }

      return availability.some(
        (item) =>
          item.domain ===
            form.internshipTrack &&
          item.available,
      );
    }, [
      availability,
      form.internshipTrack,
    ]);

  /* ========================================================================
     OTP TIMER
  ======================================================================== */

  useEffect(() => {
    if (!otpMode) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setOtpExpiresIn(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        );

        setResendCooldown(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        );
      }, 1000);

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [otpMode]);

  /* ========================================================================
     CHANGE HANDLER
  ======================================================================== */

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => {
    const {
      name,
      value,
    } = event.target;

    if (
      name === "phone"
    ) {
      setForm(
        (previous) => ({
          ...previous,
          phone:
            normalizePhone(
              value,
            ),
        }),
      );
    } else if (
      name ===
      "internshipTrack"
    ) {
      setForm(
        (previous) => ({
          ...previous,
          internshipTrack:
            value,
          skills: [],
        }),
      );

      setSkillSearch("");
    } else {
      setForm(
        (previous) => ({
          ...previous,
          [name]:
            value,
        }),
      );
    }

    setErrors(
      (previous) => ({
        ...previous,
        [name]:
          "",
        submit:
          "",
      }),
    );
  };

  /* ========================================================================
     ADD CUSTOM SKILL
  ======================================================================== */

  const addSkill = (rawSkill: string = skillSearch) => {
    const skill = normalizeText(rawSkill).replace(/[,;]+$/, "").trim();

    if (!skill) return;

    if (skill.length > 50) {
      setErrors((previous) => ({
        ...previous,
        skills: "Each skill must be 50 characters or fewer.",
      }));
      return;
    }

    const alreadyExists = form.skills.some(
      (item) => item.toLocaleLowerCase() === skill.toLocaleLowerCase(),
    );

    if (alreadyExists) {
      setSkillSearch("");
      setErrors((previous) => ({ ...previous, skills: "", submit: "" }));
      return;
    }

    if (form.skills.length >= 20) {
      setErrors((previous) => ({
        ...previous,
        skills: "You can add up to 20 skills.",
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      skills: [...previous.skills, skill],
    }));

    setSkillSearch("");
    setErrors((previous) => ({
      ...previous,
      skills: "",
      submit: "",
    }));
  };

  /* ========================================================================
     REMOVE SKILL
  ======================================================================== */

  const removeSkill = (
    skill: string,
  ) => {
    setForm(
      (previous) => ({
        ...previous,
        skills:
          previous.skills.filter(
            (item) =>
              item !== skill,
          ),
      }),
    );
  };

  /* ========================================================================
     VALIDATION
  ======================================================================== */

  const validateForm =
    (): ErrorMap => {
      const next: ErrorMap =
        {};

      const fullName =
        normalizeText(
          form.fullName,
        );

      const email =
        normalizeEmail(
          form.email,
        );

      const phone =
        normalizePhone(
          form.phone,
        );

      if (!fullName) {
        next.fullName =
          "Full name is required.";
      } else if (
        fullName.length < 2
      ) {
        next.fullName =
          "Enter your complete name.";
      } else if (
        fullName.length > 100
      ) {
        next.fullName =
          "Name is too long.";
      }

      if (!email) {
        next.email =
          "Email address is required.";
      } else if (
        !isValidEmail(
          email,
        )
      ) {
        next.email =
          "Enter a valid email address.";
      }

      if (!phone) {
        next.phone =
          "Mobile number is required.";
      } else if (
        !/^\+[1-9]\d{6,14}$/.test(
          phone,
        )
      ) {
        next.phone =
          "Enter a valid international mobile number, e.g. +919876543210.";
      }

      if (
        !normalizeText(
          form.collegeUniversity,
        )
      ) {
        next.collegeUniversity =
          "College / University is required.";
      }

      if (!form.course) {
        next.course =
          "Select your course.";
      }

      if (
        !form.branchStream
      ) {
        next.branchStream =
          "Select your branch / stream.";
      }

      if (
        !form.graduationYear
      ) {
        next.graduationYear =
          "Select your graduation year.";
      }

      if (
        !isApprovedDomain(
          form.internshipTrack,
        )
      ) {
        next.internshipTrack =
          "Select a valid internship domain.";
      } else if (
        !selectedDomainAvailable
      ) {
        next.internshipTrack =
          "This internship is currently unavailable. Please select another available domain.";
      }

      if (
        form.skills.length ===
        0
      ) {
        next.skills =
          "Select at least one relevant skill.";
      }

      if (!termsAccepted) {
        next.terms =
          "Please accept the Terms & Conditions.";
      }

      if (!privacyAccepted) {
        next.privacy =
          "Please accept the Privacy Policy.";
      }

      if (
        !declarationAccepted
      ) {
        next.declaration =
          "Please confirm that your information is accurate.";
      }

      return next;
    };

  /* ========================================================================
     PAYLOAD
  ======================================================================== */

  const buildPayload =
    () => ({
      fullName:
        normalizeText(
          form.fullName,
        ),

      email:
        normalizeEmail(
          form.email,
        ),

      phone:
        normalizePhone(
          form.phone,
        ),

      collegeUniversity:
        normalizeText(
          form.collegeUniversity,
        ),

      course:
        form.course,

      branchStream:
        form.branchStream,

      graduationYear:
        form.graduationYear,

      internshipTrack:
        form.internshipTrack,

      skills:
        form.skills,

      consentTerms:
        termsAccepted,

      consentPrivacy:
        privacyAccepted,

      consentDeclaration:
        declarationAccepted,
    });

  /* ========================================================================
     SUBMIT APPLICATION
  ======================================================================== */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setErrors({});
    setOtpError("");
    setOtpMessage("");

    const validation =
      validateForm();

    if (
      Object.keys(
        validation,
      ).length > 0
    ) {
      setErrors(
        validation,
      );

      return;
    }

    if (
      internshipLoading
    ) {
      setErrors({
        submit:
          "Please wait while available internships are being checked.",
      });

      return;
    }

    if (
      availableDomains.length ===
      0
    ) {
      setErrors({
        submit:
          "No internship is currently available for application.",
      });

      return;
    }

    setSubmitting(true);

    try {
      const response =
        await fetch(
          APPLY_API,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            cache:
              "no-store",
            credentials:
              "include",
            body:
              JSON.stringify(
                buildPayload(),
              ),
          },
        );

      const data =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | ApiResponse
          | null;

      if (
        !response.ok ||
        !data?.success
      ) {
        const retry =
          getRetrySeconds(
            data,
            response,
          );

        if (
          retry > 0
        ) {
          setResendCooldown(
            retry,
          );
        }

        throw new Error(
          getApiMessage(
            data,
            `Unable to submit application. HTTP ${response.status}`,
          ),
        );
      }

      if (
        data.otpRequired ||
        data.requiresOtp
      ) {
        setOtpMode(true);
        setOtp("");
        setOtpError("");

        setOtpMessage(
          data.message ??
            "A verification OTP has been sent to your email address.",
        );

        setOtpExpiresIn(
          Math.max(
            60,
            Number(
              data.expiresInSeconds ??
                data.otpExpiresInSeconds ??
                OTP_DEFAULT_SECONDS,
            ),
          ),
        );

        setResendCooldown(
          Math.max(
            1,
            Number(
              data.resendAvailableIn ??
                data.cooldown ??
                OTP_COOLDOWN_SECONDS,
            ),
          ),
        );

        return;
      }

      setApplicationId(
        data.applicationId ??
          "",
      );

      setSubmittedAt(
        data.submittedAt
          ? new Date(
              data.submittedAt,
            ).toLocaleString(
              "en-IN",
            )
          : new Date().toLocaleString(
              "en-IN",
            ),
      );

      setSubmitted(true);
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : "Unable to submit your application. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ========================================================================
     VERIFY OTP
  ======================================================================== */

  const verifyOtp =
    async () => {
      const cleanOtp =
        digitsOnly(
          otp,
        ).slice(
          0,
          6,
        );

      if (
        cleanOtp.length !==
        6
      ) {
        setOtpError(
          "Enter the 6-digit OTP sent to your email.",
        );

        return;
      }

      if (
        otpExpiresIn <=
        0
      ) {
        setOtpError(
          "This OTP has expired. Request a new OTP.",
        );

        return;
      }

      setVerifying(true);
      setOtpError("");
      setOtpMessage("");

      try {
        const response =
          await fetch(
            VERIFY_API,
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              cache:
                "no-store",
              credentials:
                "include",
              body:
                JSON.stringify(
                  {
                    email:
                      normalizeEmail(
                        form.email,
                      ),
                    otp:
                      cleanOtp,
                  },
                ),
            },
          );

        const data =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | ApiResponse
            | null;

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            getApiMessage(
              data,
              `OTP verification failed. HTTP ${response.status}`,
            ),
          );
        }

        setApplicationId(
          data.applicationId ??
            "",
        );

        setSubmittedAt(
          data.submittedAt
            ? new Date(
                data.submittedAt,
              ).toLocaleString(
                "en-IN",
              )
            : new Date().toLocaleString(
                "en-IN",
              ),
        );

        setOtpMode(false);
        setOtp("");
        setSubmitted(true);
        setResendCooldown(
          0,
        );
      } catch (error) {
        setOtpError(
          error instanceof Error
            ? error.message
            : "OTP verification failed. Please try again.",
        );
      } finally {
        setVerifying(false);
      }
    };

  /* ========================================================================
     RESEND OTP
  ======================================================================== */

  const resendOtp =
    async () => {
      if (
        resendCooldown > 0 ||
        resending
      ) {
        return;
      }

      setResending(true);
      setOtpError("");
      setOtpMessage("");

      try {
        const response =
          await fetch(
            APPLY_API,
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              cache:
                "no-store",
              credentials:
                "include",
              body:
                JSON.stringify(
                  buildPayload(),
                ),
            },
          );

        const data =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | ApiResponse
            | null;

        if (
          !response.ok ||
          !data?.success
        ) {
          const retry =
            getRetrySeconds(
              data,
              response,
            );

          if (
            retry > 0
          ) {
            setResendCooldown(
              retry,
            );
          }

          throw new Error(
            getApiMessage(
              data,
              `Unable to resend OTP. HTTP ${response.status}`,
            ),
          );
        }

        setOtp("");

        setOtpExpiresIn(
          Math.max(
            60,
            Number(
              data.expiresInSeconds ??
                data.otpExpiresInSeconds ??
                OTP_DEFAULT_SECONDS,
            ),
          ),
        );

        setResendCooldown(
          Math.max(
            1,
            Number(
              data.resendAvailableIn ??
                data.cooldown ??
                OTP_COOLDOWN_SECONDS,
            ),
          ),
        );

        setOtpMessage(
          data.message ??
            "A new verification OTP has been sent.",
        );
      } catch (error) {
        setOtpError(
          error instanceof Error
            ? error.message
            : "Unable to resend OTP.",
        );
      } finally {
        setResending(false);
      }
    };

  /* ========================================================================
     RESET
  ======================================================================== */

  const resetApplication =
    () => {
      setForm(
        INITIAL_FORM,
      );

      setTermsAccepted(
        false,
      );

      setPrivacyAccepted(
        false,
      );

      setDeclarationAccepted(
        false,
      );

      setErrors({});
      setOtp("");
      setOtpError("");
      setOtpMessage("");
      setOtpMode(false);
      setSubmitted(false);
      setApplicationId("");
      setSubmittedAt("");
      setSkillSearch("");
      setResendCooldown(0);
      setOtpExpiresIn(
        OTP_DEFAULT_SECONDS,
      );
    };

  /* ========================================================================
     OTP SCREEN
  ======================================================================== */

  if (otpMode) {
    return (
      <main className="min-h-[100dvh] bg-slate-50 text-slate-950">
        <Header />

        <section className="flex min-h-[calc(100dvh-65px)] items-center justify-center px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-[0_30px_90px_-45px_rgba(15,23,42,0.4)] sm:rounded-[2rem] sm:p-8 md:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-600/20">
              <Mail className="h-9 w-9" />
            </div>

            <p className="mt-7 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
              Email Verification
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Verify Your Email
            </h1>

            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">
              Enter the 6-digit OTP sent to your registered email address.
            </p>

            <p className="mt-2 break-all font-bold text-blue-600">
              {form.email}
            </p>

            <input
              value={otp}
              onChange={(event) =>
                setOtp(
                  digitsOnly(
                    event.target
                      .value,
                  ).slice(
                    0,
                    6,
                  ),
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  otp.length ===
                    6 &&
                  !verifying
                ) {
                  void verifyOtp();
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              aria-label="Email verification OTP"
              className="mt-6 min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-2xl font-black tracking-[0.28em] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:mt-8 sm:px-5 sm:text-3xl sm:tracking-[0.35em]"
            />

            <div className="mt-3 flex justify-between text-xs font-bold text-slate-500">
              <span>
                OTP expires in
              </span>

              <span
                className={
                  otpExpiresIn ===
                  0
                    ? "text-rose-600"
                    : "text-blue-600"
                }
              >
                {otpExpiresIn ===
                0
                  ? "Expired"
                  : `${Math.floor(
                      otpExpiresIn /
                        60,
                    )}:${String(
                      otpExpiresIn %
                        60,
                    ).padStart(
                      2,
                      "0",
                    )}`}
              </span>
            </div>

            {otpMessage && (
              <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  {otpMessage}
                </span>
              </div>
            )}

            {otpError && (
              <div className="mt-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-sm font-semibold text-rose-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>
                  {otpError}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                void verifyOtp()
              }
              disabled={
                verifying ||
                otp.length !==
                  6 ||
                otpExpiresIn ===
                  0
              }
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-4"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify Email
                  <CheckCircle2 className="h-5 w-5" />
                </>
              )}
            </button>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  void resendOtp()
                }
                disabled={
                  resending ||
                  resendCooldown >
                    0
                }
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-center text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {resending
                  ? "Sending..."
                  : resendCooldown >
                      0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend OTP"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpMode(
                    false,
                  );
                  setOtp("");
                  setOtpError("");
                  setOtpMessage("");
                }}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-center text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              >
                Edit Application
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  /* ========================================================================
     SUCCESS SCREEN
  ======================================================================== */

  if (submitted) {
    return (
      <main className="min-h-[100dvh] bg-slate-50 text-slate-950">
        <Header />

        <section className="flex min-h-[calc(100dvh-65px)] items-center justify-center px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-[0_30px_90px_-45px_rgba(15,23,42,0.4)] sm:rounded-[2rem] sm:p-8 md:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <p className="mt-7 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">
              Application Received
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Application Submitted
            </h1>

            <p className="mt-4 text-sm leading-7 text-slate-600">
              Your email has been verified and your internship application has
              been submitted for admin review.
            </p>

            {applicationId && (
              <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Application ID
                </p>

                <p className="mt-2 break-all font-mono text-lg font-black">
                  {applicationId}
                </p>
              </div>
            )}

            {submittedAt && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Submitted
                </p>

                <p className="mt-2 text-sm font-bold">
                  {submittedAt}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-left">
              <h2 className="font-black text-blue-950">
                What happens next?
              </h2>

              <div className="mt-3 space-y-2 text-sm leading-6 text-blue-900">
                <p>
                  1. Your application is reviewed by the admin team.
                </p>

                <p>
                  2. If approved, your Student ID and login credentials are
                  issued.
                </p>

                <p>
                  3. You complete the assessment for your selected domain.
                </p>

                <p>
                  4. After passing the assessment, available internship plans
                  can be selected.
                </p>

                <p>
                  5. Payment is handled later through the student internship
                  workflow.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/"
                className="flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Back To Home
              </Link>

              <button
                type="button"
                onClick={
                  resetApplication
                }
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-center text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              >
                New Application
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  /* ========================================================================
     MAIN APPLICATION PAGE
  ======================================================================== */

  return (
    <main className="min-h-[100dvh] overflow-x-clip bg-slate-50 text-slate-950">
      <Header />

      {/* ====================================================================
          HERO
      ===================================================================== */}

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 text-center sm:px-6 sm:py-12 lg:px-8 lg:py-14">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/20 sm:h-16 sm:w-16">
            <BriefcaseBusiness className="h-7 w-7" />
          </div>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">
            CyberNet Careers
          </p>

          <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-0.045em] sm:text-4xl md:text-5xl">
            Internship{" "}
            <span className="text-blue-600">
              Application
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Submit your academic details and choose an available technology
            internship domain. Email verification is required before your
            application enters admin review.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-7">
            {[
              "Apply",
              "Email Verification",
              "Admin Review",
              "Student Login",
              "Assessment",
            ].map(
              (step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-2"
                >
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-600 sm:text-xs">
                    {step}
                  </span>

                  {index <
                    4 && (
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ====================================================================
          CONTENT
      ===================================================================== */}

      <section className="px-3 py-5 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.35)] sm:rounded-[2rem] sm:p-6 md:p-7 lg:p-9">
            {/* ================================================================
                AVAILABILITY
            ================================================================= */}

            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:mb-6 sm:rounded-3xl sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-base font-black sm:text-lg">
                      Internship Availability
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                      Only currently available internship domains can be
                      selected.
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {internshipLoading ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking...
                    </span>
                  ) : availableDomains.length >
                    0 ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      {availableDomains.length}{" "}
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                      <AlertCircle className="h-4 w-4" />
                      Currently Unavailable
                    </span>
                  )}
                </div>
              </div>

              {internshipError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold leading-5 text-rose-700">
                  {internshipError}
                </div>
              )}

              {!internshipLoading &&
                availableDomains.length >
                  0 && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {availableDomains.map(
                      ({
                        domain,
                      }) => (
                        <span
                          key={domain}
                          className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                        >
                          {domain}
                        </span>
                      ),
                    )}
                  </div>
                )}
            </div>

            {/* ================================================================
                FORM
            ================================================================= */}

            <form
              onSubmit={
                handleSubmit
              }
              noValidate
              className="space-y-4 sm:space-y-6"
            >
              {/* ==========================================================
                  PERSONAL
              =========================================================== */}

              <FormSection
                number="01"
                icon={
                  <UserRound className="h-5 w-5" />
                }
                title="Personal Details"
                description="Enter your basic contact information."
              >
                <TextField
                  label="Full Name"
                  name="fullName"
                  value={
                    form.fullName
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Enter your full name"
                  autoComplete="name"
                  error={
                    errors.fullName
                  }
                  required
                />

                <TextField
                  label="Email Address"
                  name="email"
                  type="email"
                  value={
                    form.email
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  icon={
                    <Mail className="h-4 w-4" />
                  }
                  error={
                    errors.email
                  }
                  required
                />

                <div className="md:col-span-2">
                  <TextField
                    label="Mobile Number"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    value={
                      form.phone
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="+91 9876543210"
                    autoComplete="tel"
                    icon={
                      <Phone className="h-4 w-4" />
                    }
                    error={
                      errors.phone
                    }
                    required
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    Include your country code.
                  </p>
                </div>
              </FormSection>

              {/* ==========================================================
                  EDUCATION
              =========================================================== */}

              <FormSection
                number="02"
                icon={
                  <GraduationCap className="h-5 w-5" />
                }
                title="Education"
                description="Provide your current academic information."
              >
                <div className="md:col-span-2">
                  <TextField
                    label="College / University"
                    name="collegeUniversity"
                    value={
                      form.collegeUniversity
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Enter college or university"
                    autoComplete="organization"
                    error={
                      errors.collegeUniversity
                    }
                    required
                  />
                </div>

                <SelectField
                  label="Course"
                  name="course"
                  value={
                    form.course
                  }
                  onChange={
                    handleChange
                  }
                  options={
                    COURSE_OPTIONS
                  }
                  error={
                    errors.course
                  }
                  required
                />

                <SelectField
                  label="Branch / Stream"
                  name="branchStream"
                  value={
                    form.branchStream
                  }
                  onChange={
                    handleChange
                  }
                  options={
                    BRANCH_OPTIONS
                  }
                  error={
                    errors.branchStream
                  }
                  required
                />

                <div className="md:col-span-2">
                  <SelectField
                    label="Graduation Year"
                    name="graduationYear"
                    value={
                      form.graduationYear
                    }
                    onChange={
                      handleChange
                    }
                    options={
                      GRADUATION_YEARS
                    }
                    error={
                      errors.graduationYear
                    }
                    required
                  />
                </div>
              </FormSection>

              {/* ==========================================================
                  DOMAIN
              =========================================================== */}

              <FormSection
                number="03"
                icon={
                  <BriefcaseBusiness className="h-5 w-5" />
                }
                title="Internship Domain"
                description="Select one currently available technology internship."
              >
                <div className="md:col-span-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Preferred Internship Domain
                      <span className="ml-1 text-rose-500">
                        *
                      </span>
                    </span>

                    <div className="relative">
                      <select
                        name="internshipTrack"
                        value={
                          form.internshipTrack
                        }
                        onChange={
                          handleChange
                        }
                        disabled={
                          internshipLoading ||
                          availableDomains.length ===
                            0
                        }
                        className={[
                          "min-h-12 w-full min-w-0 appearance-none rounded-xl border bg-white px-3.5 py-3.5 pr-11 text-base text-slate-900 outline-none transition sm:rounded-2xl sm:px-4 sm:text-sm",
                          "focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
                          errors.internshipTrack
                            ? "border-rose-300"
                            : "border-slate-200",
                          "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
                        ].join(
                          " ",
                        )}
                      >
                        <option value="">
                          {internshipLoading
                            ? "Checking availability..."
                            : availableDomains.length ===
                                0
                              ? "No internship available"
                              : "Select an internship domain"}
                        </option>

                        {availableDomains.map(
                          ({
                            domain,
                          }) => (
                            <option
                              key={
                                domain
                              }
                              value={
                                domain
                              }
                            >
                              {
                                domain
                              }
                            </option>
                          ),
                        )}
                      </select>

                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </label>

                  {errors.internshipTrack && (
                    <p className="mt-2 text-xs font-semibold text-rose-600">
                      {
                        errors.internshipTrack
                      }
                    </p>
                  )}
                </div>

                {form.internshipTrack &&
                  selectedDomainAvailable && (
                    <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                            Available Internship
                          </p>

                          <h3 className="mt-1 text-lg font-black text-slate-950">
                            {
                              form.internshipTrack
                            }
                          </h3>

                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            Your selected domain will determine the assessment
                            you receive after admin approval.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                <div className="md:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="relevant-skill-input" className="text-sm font-bold text-slate-700">
                      Relevant Skills
                      <span className="ml-1 text-rose-500">*</span>
                    </label>
                    <span className="text-xs font-bold text-blue-600">
                      {form.skills.length}/20 added
                    </span>
                  </div>

                  {!form.internshipTrack ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                      Select an available internship domain first.
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 text-xs leading-5 text-slate-500">
                        Type any skill and press Enter, comma, or Add skill. Skills are not limited to a predefined list.
                      </p>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          id="relevant-skill-input"
                          type="text"
                          value={skillSearch}
                          maxLength={60}
                          disabled={form.skills.length >= 20}
                          onChange={(event) => {
                            setSkillSearch(event.target.value);
                            if (errors.skills) {
                              setErrors((previous) => ({ ...previous, skills: "" }));
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === ",") {
                              event.preventDefault();
                              addSkill();
                            }
                          }}
                          placeholder="e.g. Python, React, Communication"
                          aria-describedby="relevant-skill-help"
                          aria-invalid={Boolean(errors.skills)}
                          className={[
                            "min-h-12 w-full min-w-0 rounded-xl border bg-white px-3.5 py-3.5 text-base text-slate-900 outline-none transition sm:rounded-2xl sm:px-4 sm:text-sm",
                            "focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
                            errors.skills ? "border-rose-300" : "border-slate-200",
                            "disabled:cursor-not-allowed disabled:bg-slate-100",
                          ].join(" ")}
                        />
                        <button
                          type="button"
                          onClick={() => addSkill()}
                          disabled={!skillSearch.trim() || form.skills.length >= 20}
                          className="min-h-12 shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl"
                        >
                          Add skill
                        </button>
                      </div>

                      <p id="relevant-skill-help" className="mt-2 text-xs text-slate-500">
                        Add 1–20 skills. Duplicate entries are ignored; each skill can contain up to 50 characters.
                      </p>

                      {form.skills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {form.skills.map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => removeSkill(skill)}
                              aria-label={`Remove ${skill}`}
                              title={`Remove ${skill}`}
                              className="inline-flex max-w-full items-center gap-1.5 break-words rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                            >
                              <span className="break-words">{skill}</span>
                              <X className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {errors.skills && (
                    <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">
                      {errors.skills}
                    </p>
                  )}
                </div>
              </FormSection>

              

              {/* ==========================================================
                  CONSENT
              =========================================================== */}

              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-black">
                    Confirm Your Application
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                    Please review your information before continuing to email
                    verification.
                  </p>
                </div>

                <div className="space-y-3">
                  <Consent
                    checked={
                      termsAccepted
                    }
                    onChange={
                      setTermsAccepted
                    }
                    error={
                      errors.terms
                    }
                  >
                    I agree to the{" "}
                    <Link
                      href="/terms-and-conditions"
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Terms & Conditions
                    </Link>
                    .
                  </Consent>

                  <Consent
                    checked={
                      privacyAccepted
                    }
                    onChange={
                      setPrivacyAccepted
                    }
                    error={
                      errors.privacy
                    }
                  >
                    I agree to the{" "}
                    <Link
                      href="/privacy-policy"
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </Consent>

                  <Consent
                    checked={
                      declarationAccepted
                    }
                    onChange={
                      setDeclarationAccepted
                    }
                    error={
                      errors.declaration
                    }
                  >
                    I confirm that the information provided by me is accurate
                    and genuine.
                  </Consent>
                </div>

                {errors.submit && (
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

                    <span>
                      {errors.submit}
                    </span>
                  </div>
                )}
              </section>

              {/* ==========================================================
                  SUBMIT
              =========================================================== */}

              <button
                type="submit"
                disabled={
                  submitting ||
                  internshipLoading ||
                  availableDomains.length ===
                    0
                }
                className="group flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-center text-sm font-black text-white shadow-[0_16px_40px_rgba(37,99,235,0.22)] transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-5 sm:text-base"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending Verification OTP...
                  </>
                ) : internshipLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Checking Availability...
                  </>
                ) : availableDomains.length ===
                  0 ? (
                  <>
                    No Internship Available
                  </>
                ) : (
                  <>
                    Continue With Email Verification
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <p className="text-center text-xs leading-5 text-slate-500">
                No internship plan selection or payment is required at this
                application stage.
              </p>
            </form>
          </div>

          {/* Bottom navigation */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
            <Link
              href="/internships"
              className="transition hover:text-blue-600"
            >
              View Internships
            </Link>

            <span className="text-slate-300">
              •
            </span>

            <Link
              href="/certificate"
              className="transition hover:text-blue-600"
            >
              Certificate Verification
            </Link>

            <span className="text-slate-300">
              •
            </span>

            <Link
              href="/contact"
              className="transition hover:text-blue-600"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>

      {/* ====================================================================
          FOOTER
      ===================================================================== */}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-7 text-center">
          <p className="text-xs text-slate-500">
            © {CURRENT_YEAR} CyberNet Careers. All rights reserved.
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-[11px] font-semibold text-slate-400">
            <Link
              href="/privacy-policy"
              className="hover:text-blue-600"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms-and-conditions"
              className="hover:text-blue-600"
            >
              Terms & Conditions
            </Link>

            <Link
              href="/contact"
              className="hover:text-blue-600"
            >
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ============================================================================
   HEADER
============================================================================ */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="CyberNet Careers home"
          className="flex min-w-0 items-center gap-2 sm:gap-3"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[10px] font-black text-white shadow-lg shadow-blue-600/20">
            CN
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-black tracking-tight sm:text-base">
              CyberNet Careers
            </span>

            <span className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:block">
              Internship & Student Portal
            </span>
          </span>
        </Link>

        <Link
          href="/"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:gap-2 sm:px-3.5 sm:text-sm"
        >
          Home
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

/* ============================================================================
   FORM SECTION
============================================================================ */

function FormSection({
  number,
  icon,
  title,
  description,
  children,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:rounded-3xl sm:p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-lg shadow-blue-600/15">
            {icon}
          </div>

          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-950 text-[10px] font-black text-white">
            {number}
          </span>
        </div>

        <div>
          <h2 className="text-lg font-black sm:text-xl">
            {title}
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

/* ============================================================================
   TEXT FIELD
============================================================================ */

function TextField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  error,
  required,
  inputMode,
  autoComplete,
}: {
  label: string;
  name: keyof ApplicantForm;
  value: string;
  onChange: (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => void;
  placeholder: string;
  type?: string;
  icon?: ReactNode;
  error?: string;
  required?: boolean;
  inputMode?:
    | "text"
    | "numeric"
    | "decimal"
    | "tel"
    | "email"
    | "url"
    | "search"
    | "none";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
        {icon}

        {label}

        {required && (
          <span className="text-rose-500">
            *
          </span>
        )}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        onChange={
          onChange
        }
        placeholder={
          placeholder
        }
        inputMode={
          inputMode
        }
        autoComplete={
          autoComplete ??
          "off"
        }
        aria-invalid={
          Boolean(error)
        }
        className={[
          "min-h-12 w-full min-w-0 rounded-xl border bg-white px-3.5 py-3.5 text-base text-slate-900 outline-none transition sm:rounded-2xl sm:px-5 sm:text-sm",
          "placeholder:text-slate-400 focus:ring-4",
          error
            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            : "border-slate-200 focus:border-blue-500 focus:ring-blue-100",
        ].join(
          " ",
        )}
      />

      {error && (
        <p className="mt-2 text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </label>
  );
}

/* ============================================================================
   SELECT FIELD
============================================================================ */

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required,
}: {
  label: string;
  name: keyof ApplicantForm;
  value: string;
  onChange: (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) => void;
  options: readonly string[];
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-rose-500">
            *
          </span>
        )}
      </span>

      <select
        name={name}
        value={value}
        onChange={
          onChange
        }
        aria-invalid={
          Boolean(error)
        }
        className={[
          "min-h-12 w-full min-w-0 rounded-xl border bg-white px-3.5 py-3.5 text-base text-slate-900 outline-none transition sm:rounded-2xl sm:px-5 sm:text-sm",
          "focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
          error
            ? "border-rose-300"
            : "border-slate-200",
        ].join(
          " ",
        )}
      >
        <option value="">
          Select an option
        </option>

        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ),
        )}
      </select>

      {error && (
        <p className="mt-2 text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </label>
  );
}

/* ============================================================================
   CONSENT
============================================================================ */

function Consent({
  checked,
  onChange,
  error,
  children,
}: {
  checked: boolean;
  onChange: (
    value: boolean,
  ) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-blue-300 sm:p-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(
              event.target
                .checked,
            )
          }
          className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
        />

        <span className="text-sm leading-6 text-slate-700">
          {children}
        </span>
      </label>

      {error && (
        <p className="mt-2 pl-7 text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
