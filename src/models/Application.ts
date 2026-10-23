import crypto from "node:crypto";

import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

/* ============================================================
   APPLICATION TYPES
============================================================ */

export type ApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected";

export type AssessmentStatus =
  | "not_started"
  | "active"
  | "passed"
  | "failed";

export type SelectedDuration =
  | "1 Month"
  | "3 Months"
  | "6 Months";

export type InternshipPlanCode =
  | "ONE_MONTH"
  | "THREE_MONTHS"
  | "SIX_MONTHS";

export type PaymentStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed";

/* ============================================================
   OFFICIAL INTERNSHIP PLAN PRICING
============================================================ */

/**
 * Official CyberNet Careers pricing.
 *
 * 1 Month  = ₹499
 * 3 Months = ₹999
 * 6 Months = ₹1699
 *
 * IMPORTANT:
 * Never trust price/duration received from frontend.
 * Backend derives these values from planCode.
 */

export const INTERNSHIP_PLAN_PRICES = {
  ONE_MONTH: 499,
  THREE_MONTHS: 999,
  SIX_MONTHS: 1699,
} as const;

export const INTERNSHIP_PLAN_PRICES_IN_PAISE = {
  ONE_MONTH: 49900,
  THREE_MONTHS: 99900,
  SIX_MONTHS: 169900,
} as const;

export const INTERNSHIP_PLAN_DURATIONS = {
  ONE_MONTH: "1 Month",
  THREE_MONTHS: "3 Months",
  SIX_MONTHS: "6 Months",
} as const;

export const INTERNSHIP_PLAN_DURATION_MONTHS = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
} as const;

/* ============================================================
   PLAN HELPERS
============================================================ */

export function getPlanPrice(
  planCode: InternshipPlanCode,
): number {
  return INTERNSHIP_PLAN_PRICES[planCode];
}

export function getPlanPriceInPaise(
  planCode: InternshipPlanCode,
): number {
  return INTERNSHIP_PLAN_PRICES_IN_PAISE[planCode];
}

export function getPlanDuration(
  planCode: InternshipPlanCode,
): SelectedDuration {
  return INTERNSHIP_PLAN_DURATIONS[planCode];
}

export function getPlanDurationMonths(
  planCode: InternshipPlanCode,
): 1 | 3 | 6 {
  return INTERNSHIP_PLAN_DURATION_MONTHS[planCode];
}

/* ============================================================
   APPLICATION INTERFACE
============================================================ */

export interface IApplication extends Document {
  /* Application */
  applicationId: string;

  /* Student */
  fullName: string;
  email: string;
  phone: string;

  /* Education */
  collegeUniversity: string;
  course: string;
  branchStream: string;
  graduationYear: string;

  /* Internship */
  internshipTrack: string;
  skills: string[];

  internshipId?: Types.ObjectId;
  internshipTitle?: string;
  internshipDomain?: string;

  /* Plan */
  planCode?: InternshipPlanCode;
  selectedDuration?: SelectedDuration;
  durationMonths?: 1 | 3 | 6;

  price?: number;
  priceInPaise?: number;

  currency: "INR";

  /* Consent */
  consentTerms: boolean;
  consentPrivacy: boolean;
  consentDeclaration: boolean;

  /* Email verification */
  emailVerified: boolean;
  emailVerifiedAt?: Date;

  /* Application review */
  status: ApplicationStatus;

  /* Student account */
  studentId?: string;

  /* Assessment */
  assessmentStatus: AssessmentStatus;
  assessmentScore?: number;
  assessmentStartedAt?: Date;
  assessmentDeadline?: Date;

  /* Eligibility */
  internshipEligible: boolean;

  /* Payment */
  paymentStatus: PaymentStatus;
  paymentId?: string;
  paymentPaidAt?: Date;

  /* Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/* ============================================================
   VALIDATION REGEX
============================================================ */

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * International E.164-style phone number.
 *
 * Examples:
 * +919876543210
 * +14155552671
 * +447911123456
 */
const PHONE_REGEX =
  /^\+[1-9]\d{6,14}$/;

/* ============================================================
   CONSTANT VALUES
============================================================ */

const PLAN_CODES: InternshipPlanCode[] = [
  "ONE_MONTH",
  "THREE_MONTHS",
  "SIX_MONTHS",
];

const DURATIONS: SelectedDuration[] = [
  "1 Month",
  "3 Months",
  "6 Months",
];

/* ============================================================
   APPLICATION SCHEMA
============================================================ */

const applicationSchema =
  new Schema<IApplication>(
    {
      /* ======================================================
         APPLICATION ID
      ====================================================== */

      applicationId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        immutable: true,
        minlength: 5,
        maxlength: 50,
      },

      /* ======================================================
         FULL NAME
      ====================================================== */

      fullName: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 120,

        validate: {
          validator(value: string): boolean {
            return (
              typeof value === "string" &&
              value.trim().length >= 3 &&
              value.trim().length <= 120
            );
          },

          message:
            "Please provide a valid full name.",
        },
      },

      /* ======================================================
         EMAIL
      ====================================================== */

      email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        maxlength: 254,

        validate: {
          validator(value: string): boolean {
            return EMAIL_REGEX.test(value);
          },

          message:
            "Please provide a valid email address.",
        },
      },

      /* ======================================================
         PHONE
      ====================================================== */

      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 16,

        validate: {
          validator(value: string): boolean {
            return PHONE_REGEX.test(value);
          },

          message:
            "Please provide a valid international phone number.",
        },
      },

      /* ======================================================
         COLLEGE / UNIVERSITY
      ====================================================== */

      collegeUniversity: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 200,
      },

      /* ======================================================
         COURSE
      ====================================================== */

      course: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 120,
      },

      /* ======================================================
         BRANCH / STREAM
      ====================================================== */

      branchStream: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 120,
      },

      /* ======================================================
         GRADUATION YEAR
      ====================================================== */

      graduationYear: {
        type: String,
        required: true,
        trim: true,

        validate: {
          validator(value: string): boolean {
            const year = Number(value);

            return (
              Number.isInteger(year) &&
              year >= 2020 &&
              year <= 2050
            );
          },

          message:
            "Graduation year must be between 2020 and 2050.",
        },
      },

      /* ======================================================
         INTERNSHIP TRACK
      ====================================================== */

      internshipTrack: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 120,
      },

      /* ======================================================
         SKILLS
      ====================================================== */

      skills: {
        type: [String],
        required: true,
        default: [],

        validate: {
          validator(value: string[]): boolean {
            if (!Array.isArray(value)) {
              return false;
            }

            if (
              value.length < 1 ||
              value.length > 20
            ) {
              return false;
            }

            return value.every(
              (skill) =>
                typeof skill === "string" &&
                skill.trim().length >= 1 &&
                skill.trim().length <= 80,
            );
          },

          message:
            "Select between 1 and 20 valid skills.",
        },
      },

      /* ======================================================
         INTERNSHIP ID
      ====================================================== */

      internshipId: {
        type: Schema.Types.ObjectId,
        ref: "Internship",
        default: undefined,
      },

      /* ======================================================
         INTERNSHIP TITLE SNAPSHOT
      ====================================================== */

      internshipTitle: {
        type: String,
        default: undefined,
        trim: true,
        maxlength: 200,
      },

      /* ======================================================
         INTERNSHIP DOMAIN SNAPSHOT
      ====================================================== */

      internshipDomain: {
        type: String,
        default: undefined,
        trim: true,
        maxlength: 120,
      },

      /* ======================================================
         PLAN CODE
      ====================================================== */

      planCode: {
        type: String,

        enum: {
          values: PLAN_CODES,

          message:
            "Invalid internship plan code.",
        },

        default: undefined,
      },

      /* ======================================================
         SELECTED DURATION
      ====================================================== */

      selectedDuration: {
        type: String,

        enum: {
          values: DURATIONS,

          message:
            "Selected duration must be 1 Month, 3 Months, or 6 Months.",
        },

        default: undefined,
      },

      /* ======================================================
         DURATION MONTHS
      ====================================================== */

      durationMonths: {
        type: Number,
        enum: [1, 3, 6],
        default: undefined,
      },

      /* ======================================================
         PRICE IN INR
      ====================================================== */

      price: {
        type: Number,
        min: 0,
        default: undefined,

        validate: {
          validator(value: number): boolean {
            return (
              Number.isFinite(value) &&
              value >= 0
            );
          },

          message:
            "Price must be a valid non-negative number.",
        },
      },

      /* ======================================================
         PRICE IN PAISE
      ====================================================== */

      priceInPaise: {
        type: Number,
        min: 0,
        default: undefined,

        validate: {
          validator(value: number): boolean {
            return (
              Number.isSafeInteger(value) &&
              value >= 0
            );
          },

          message:
            "Price in paise must be a valid non-negative integer.",
        },
      },

      /* ======================================================
         CURRENCY
      ====================================================== */

      currency: {
        type: String,
        enum: ["INR"],
        required: true,
        default: "INR",
        immutable: true,
      },

      /* ======================================================
         TERMS CONSENT
      ====================================================== */

      consentTerms: {
        type: Boolean,
        required: true,

        validate: {
          validator(value: boolean): boolean {
            return value === true;
          },

          message:
            "Terms & Conditions must be accepted.",
        },
      },

      /* ======================================================
         PRIVACY CONSENT
      ====================================================== */

      consentPrivacy: {
        type: Boolean,
        required: true,

        validate: {
          validator(value: boolean): boolean {
            return value === true;
          },

          message:
            "Privacy Policy must be accepted.",
        },
      },

      /* ======================================================
         DECLARATION CONSENT
      ====================================================== */

      consentDeclaration: {
        type: Boolean,
        required: true,

        validate: {
          validator(value: boolean): boolean {
            return value === true;
          },

          message:
            "Declaration must be accepted.",
        },
      },

      /* ======================================================
         EMAIL VERIFIED
      ====================================================== */

      emailVerified: {
        type: Boolean,
        required: true,
        default: false,
      },

      /* ======================================================
         EMAIL VERIFIED AT
      ====================================================== */

      emailVerifiedAt: {
        type: Date,
        default: undefined,
      },

      /* ======================================================
         APPLICATION STATUS
      ====================================================== */

      status: {
        type: String,
        required: true,

        enum: [
          "pending",
          "under_review",
          "approved",
          "rejected",
        ],

        default: "pending",
      },

      /* ======================================================
         STUDENT ID
      ====================================================== */

      studentId: {
        type: String,
        default: undefined,
        trim: true,
        maxlength: 50,
      },

      /* ======================================================
         ASSESSMENT STATUS
      ====================================================== */

      assessmentStatus: {
        type: String,
        required: true,

        enum: [
          "not_started",
          "active",
          "passed",
          "failed",
        ],

        default: "not_started",
      },

      /* ======================================================
         ASSESSMENT SCORE
      ====================================================== */

      assessmentScore: {
        type: Number,
        min: 0,
        max: 100,
        default: undefined,
      },

      /* ======================================================
         ASSESSMENT STARTED AT
      ====================================================== */

      assessmentStartedAt: {
        type: Date,
        default: undefined,
      },

      /* ======================================================
         ASSESSMENT DEADLINE
      ====================================================== */

      assessmentDeadline: {
        type: Date,
        default: undefined,
      },

      /* ======================================================
         INTERNSHIP ELIGIBILITY
      ====================================================== */

      internshipEligible: {
        type: Boolean,
        required: true,
        default: false,
      },

      /* ======================================================
         PAYMENT STATUS
      ====================================================== */

      paymentStatus: {
        type: String,
        required: true,

        enum: [
          "not_required",
          "pending",
          "paid",
          "failed",
        ],

        default: "pending",
      },

      /* ======================================================
         PAYMENT ID
      ====================================================== */

      paymentId: {
        type: String,
        default: undefined,
        trim: true,
        maxlength: 150,
      },

      /* ======================================================
         PAYMENT PAID AT
      ====================================================== */

      paymentPaidAt: {
        type: Date,
        default: undefined,
      },
    },

    {
      timestamps: true,
      strict: true,
      versionKey: false,
    },
  );

/* ============================================================
   NORMALIZATION + SERVER-SIDE PLAN PRICING
============================================================ */

/**
 * Mongoose 9 compatible async middleware.
 *
 * No next() callback is used.
 */

applicationSchema.pre(
  "validate",
  async function () {
    const application =
      this as IApplication;

    /* --------------------------------------------------------
       EMAIL
    -------------------------------------------------------- */

    if (
      typeof application.email === "string"
    ) {
      application.email =
        application.email
          .trim()
          .toLowerCase();
    }

    /* --------------------------------------------------------
       FULL NAME
    -------------------------------------------------------- */

    if (
      typeof application.fullName === "string"
    ) {
      application.fullName =
        application.fullName
          .trim()
          .replace(/\s+/g, " ");
    }

    /* --------------------------------------------------------
       PHONE
    -------------------------------------------------------- */

    if (
      typeof application.phone === "string"
    ) {
      application.phone =
        application.phone.trim();
    }

    /* --------------------------------------------------------
       COLLEGE
    -------------------------------------------------------- */

    if (
      typeof application.collegeUniversity ===
      "string"
    ) {
      application.collegeUniversity =
        application.collegeUniversity
          .trim()
          .replace(/\s+/g, " ");
    }

    /* --------------------------------------------------------
       COURSE
    -------------------------------------------------------- */

    if (
      typeof application.course === "string"
    ) {
      application.course =
        application.course
          .trim()
          .replace(/\s+/g, " ");
    }

    /* --------------------------------------------------------
       BRANCH
    -------------------------------------------------------- */

    if (
      typeof application.branchStream ===
      "string"
    ) {
      application.branchStream =
        application.branchStream
          .trim()
          .replace(/\s+/g, " ");
    }

    /* --------------------------------------------------------
       INTERNSHIP TRACK
    -------------------------------------------------------- */

    if (
      typeof application.internshipTrack ===
      "string"
    ) {
      application.internshipTrack =
        application.internshipTrack
          .trim()
          .replace(/\s+/g, " ");
    }

    /* --------------------------------------------------------
       INTERNSHIP TITLE
    -------------------------------------------------------- */

    if (
      typeof application.internshipTitle ===
      "string"
    ) {
      application.internshipTitle =
        application.internshipTitle
          .trim()
          .replace(/\s+/g, " ");
    }

    /* --------------------------------------------------------
       INTERNSHIP DOMAIN
    -------------------------------------------------------- */

    if (
      typeof application.internshipDomain ===
      "string"
    ) {
      application.internshipDomain =
        application.internshipDomain
          .trim()
          .replace(/\s+/g, " ");
    }

    /* --------------------------------------------------------
       SKILLS
    -------------------------------------------------------- */

    if (
      Array.isArray(application.skills)
    ) {
      application.skills =
        Array.from(
          new Set(
            application.skills
              .filter(
                (
                  skill,
                ): skill is string =>
                  typeof skill === "string",
              )
              .map(
                (skill) =>
                  skill
                    .trim()
                    .replace(/\s+/g, " "),
              )
              .filter(Boolean),
          ),
        );
    }

    /* --------------------------------------------------------
       SERVER-SIDE PLAN PRICING
    -------------------------------------------------------- */

    if (application.planCode) {
      const planCode =
        application.planCode;

      /*
       * Frontend price is NEVER trusted.
       *
       * planCode is the source of truth.
       */

      application.selectedDuration =
        getPlanDuration(planCode);

      application.durationMonths =
        getPlanDurationMonths(planCode);

      application.price =
        getPlanPrice(planCode);

      application.priceInPaise =
        getPlanPriceInPaise(planCode);

      application.currency = "INR";
    }
  },
);

/* ============================================================
   PLAN VALIDATION
============================================================ */

/**
 * New applications containing internshipId
 * must contain a valid commercial plan.
 *
 * Legacy applications without internshipId
 * remain supported.
 */

applicationSchema.pre(
  "validate",
  async function () {
    const application =
      this as IApplication;

    /* --------------------------------------------------------
       LEGACY APPLICATION
    -------------------------------------------------------- */

    if (!application.internshipId) {
      return;
    }

    /* --------------------------------------------------------
       PLAN REQUIRED
    -------------------------------------------------------- */

    if (!application.planCode) {
      throw new Error(
        "Internship plan code is required for new internship applications.",
      );
    }

    /* --------------------------------------------------------
       DURATION REQUIRED
    -------------------------------------------------------- */

    if (!application.selectedDuration) {
      throw new Error(
        "Selected internship duration is required.",
      );
    }

    /* --------------------------------------------------------
       MONTHS REQUIRED
    -------------------------------------------------------- */

    if (
      application.durationMonths ===
      undefined
    ) {
      throw new Error(
        "Internship duration in months is required.",
      );
    }

    /* --------------------------------------------------------
       PRICE REQUIRED
    -------------------------------------------------------- */

    if (
      application.price === undefined
    ) {
      throw new Error(
        "Internship price is required.",
      );
    }

    /* --------------------------------------------------------
       PAISE REQUIRED
    -------------------------------------------------------- */

    if (
      application.priceInPaise ===
      undefined
    ) {
      throw new Error(
        "Internship price in paise is required.",
      );
    }

    /* --------------------------------------------------------
       CURRENCY
    -------------------------------------------------------- */

    if (application.currency !== "INR") {
      throw new Error(
        "Only INR currency is supported.",
      );
    }

    /* --------------------------------------------------------
       EXPECTED SERVER VALUES
    -------------------------------------------------------- */

    const expectedPrice =
      getPlanPrice(
        application.planCode,
      );

    const expectedPriceInPaise =
      getPlanPriceInPaise(
        application.planCode,
      );

    const expectedDuration =
      getPlanDuration(
        application.planCode,
      );

    const expectedMonths =
      getPlanDurationMonths(
        application.planCode,
      );

    /* --------------------------------------------------------
       PRICE CONSISTENCY
    -------------------------------------------------------- */

    if (
      application.price !==
      expectedPrice
    ) {
      throw new Error(
        `Price for ${application.planCode} must be ₹${expectedPrice}.`,
      );
    }

    /* --------------------------------------------------------
       PAISE CONSISTENCY
    -------------------------------------------------------- */

    if (
      application.priceInPaise !==
      expectedPriceInPaise
    ) {
      throw new Error(
        `Price in paise for ${application.planCode} must be ${expectedPriceInPaise}.`,
      );
    }

    /* --------------------------------------------------------
       DURATION CONSISTENCY
    -------------------------------------------------------- */

    if (
      application.selectedDuration !==
      expectedDuration
    ) {
      throw new Error(
        `Duration for ${application.planCode} must be ${expectedDuration}.`,
      );
    }

    /* --------------------------------------------------------
       MONTH CONSISTENCY
    -------------------------------------------------------- */

    if (
      application.durationMonths !==
      expectedMonths
    ) {
      throw new Error(
        `Duration for ${application.planCode} must be ${expectedMonths} months.`,
      );
    }
  },
);

/* ============================================================
   APPLICATION ID GENERATION
============================================================ */

/**
 * Generates IDs such as:
 *
 * CN-2026-583421
 *
 * Uses Node crypto instead of Math.random().
 */

applicationSchema.pre(
  "validate",
  async function () {
    const application =
      this as IApplication;

    if (application.applicationId) {
      return;
    }

    const year =
      new Date().getFullYear();

    const randomNumber =
      crypto.randomInt(
        100000,
        1000000,
      );

    application.applicationId =
      `CN-${year}-${randomNumber}`;
  },
);

/* ============================================================
   INDEXES
============================================================ */

/**
 * IMPORTANT:
 *
 * Do not duplicate indexes generated by:
 *
 * unique: true
 *
 * or field-level index declarations.
 *
 * This helps prevent duplicate schema-index warnings.
 */

/* Latest applications */
applicationSchema.index({
  createdAt: -1,
});

/* Admin filtering */
applicationSchema.index({
  status: 1,
  createdAt: -1,
});

/* Assessment management */
applicationSchema.index({
  assessmentStatus: 1,
  createdAt: -1,
});

/* Payment management */
applicationSchema.index({
  paymentStatus: 1,
  createdAt: -1,
});

/* Student lookup */
applicationSchema.index({
  studentId: 1,
});

/* Internship lookup */
applicationSchema.index({
  internshipId: 1,
  createdAt: -1,
});

/* Plan filtering */
applicationSchema.index({
  planCode: 1,
  selectedDuration: 1,
  createdAt: -1,
});

/* Eligibility */
applicationSchema.index({
  internshipEligible: 1,
  createdAt: -1,
});

/* Verified applications */
applicationSchema.index({
  emailVerified: 1,
  status: 1,
  createdAt: -1,
});

/* Internship track + status */
applicationSchema.index({
  internshipTrack: 1,
  status: 1,
  createdAt: -1,
});

/* Payment ID lookup */
applicationSchema.index({
  paymentId: 1,
});

/* ============================================================
   MODEL
============================================================ */

const Application: Model<IApplication> =
  mongoose.models.Application ||
  mongoose.model<IApplication>(
    "Application",
    applicationSchema,
  );

export default Application;