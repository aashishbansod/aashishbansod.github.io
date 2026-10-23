import mongoose, {
  Document,
  Model,
  Schema,
} from "mongoose";

/* ============================================================
   PLAN TYPES
============================================================ */

export const INTERNSHIP_PLAN_CODES = [
  "ONE_MONTH",
  "THREE_MONTHS",
  "SIX_MONTHS",
] as const;

export type InternshipPlanCode =
  (typeof INTERNSHIP_PLAN_CODES)[number];

/* ============================================================
   OFFICIAL PLAN PRICES
============================================================ */

export const INTERNSHIP_PLAN_PRICES: Record<
  InternshipPlanCode,
  number
> = {
  ONE_MONTH: 499,
  THREE_MONTHS: 999,
  SIX_MONTHS: 1699,
};

/* ============================================================
   OFFICIAL PLAN DURATION
============================================================ */

export const INTERNSHIP_PLAN_DURATION_MONTHS: Record<
  InternshipPlanCode,
  1 | 3 | 6
> = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
};

/* ============================================================
   PLAN HELPERS
============================================================ */

/**
 * Returns official internship price.
 *
 * NEVER trust price supplied by frontend.
 */
export function getInternshipPlanPrice(
  planCode: InternshipPlanCode,
): number {
  return INTERNSHIP_PLAN_PRICES[planCode];
}

/**
 * Returns official duration in months.
 */
export function getInternshipPlanDurationMonths(
  planCode: InternshipPlanCode,
): 1 | 3 | 6 {
  return INTERNSHIP_PLAN_DURATION_MONTHS[
    planCode
  ];
}

/**
 * Returns official duration label.
 *
 * ONE_MONTH   -> 1 Month
 * THREE_MONTHS -> 3 Months
 * SIX_MONTHS   -> 6 Months
 */
export function getInternshipPlanDuration(
  planCode: InternshipPlanCode,
): string {
  const months =
    getInternshipPlanDurationMonths(
      planCode,
    );

  return `${months} ${
    months === 1 ? "Month" : "Months"
  }`;
}

/**
 * Returns official price in paise.
 *
 * ₹499  -> 49900
 * ₹999  -> 99900
 * ₹1699 -> 169900
 */
export function getInternshipPlanPriceInPaise(
  planCode: InternshipPlanCode,
): number {
  return (
    getInternshipPlanPrice(planCode) * 100
  );
}

/* ============================================================
   PENDING APPLICATION
============================================================ */

export type PendingApplication = {
  /* ----------------------------------------------------------
     PERSONAL INFORMATION
  ---------------------------------------------------------- */

  fullName: string;
  email: string;
  phone: string;

  /* ----------------------------------------------------------
     EDUCATION
  ---------------------------------------------------------- */

  collegeUniversity: string;
  course: string;
  branchStream: string;
  graduationYear: string;

  /* ----------------------------------------------------------
     INTERNSHIP
  ---------------------------------------------------------- */

  internshipTrack: string;
  skills: string[];

  /* ----------------------------------------------------------
     SELECTED INTERNSHIP
  ---------------------------------------------------------- */

  internshipId?: mongoose.Types.ObjectId;

  /* ----------------------------------------------------------
     PLAN
  ---------------------------------------------------------- */

  planCode?: InternshipPlanCode;

  duration?: string;

  durationMonths?: 1 | 3 | 6;

  /**
   * Official price in INR.
   */
  price?: number;

  /**
   * Official price in paise.
   */
  priceInPaise?: number;

  /* ----------------------------------------------------------
     CONSENTS
  ---------------------------------------------------------- */

  consentTerms: boolean;
  consentPrivacy: boolean;
  consentDeclaration: boolean;
};

/* ============================================================
   EMAIL VERIFICATION DOCUMENT
============================================================ */

export interface IEmailVerification
  extends Document {
  /* ----------------------------------------------------------
     EMAIL
  ---------------------------------------------------------- */

  email: string;

  /* ----------------------------------------------------------
     OTP
  ---------------------------------------------------------- */

  /**
   * SHA-256 hashed OTP.
   *
   * Plain OTP must NEVER be stored.
   */
  otpHash: string;

  /* ----------------------------------------------------------
     ATTEMPTS
  ---------------------------------------------------------- */

  attempts: number;

  /**
   * Maximum allowed failed attempts.
   */
  maxAttempts: number;

  /* ----------------------------------------------------------
     EXPIRATION
  ---------------------------------------------------------- */

  expiresAt: Date;

  /* ----------------------------------------------------------
     SEND / RESEND
  ---------------------------------------------------------- */

  lastSentAt: Date;

  resendCount: number;

  /* ----------------------------------------------------------
     PENDING APPLICATION
  ---------------------------------------------------------- */

  pendingApplication: PendingApplication;

  /* ----------------------------------------------------------
     VERIFICATION
  ---------------------------------------------------------- */

  verifiedAt?: Date;

  /* ----------------------------------------------------------
     TIMESTAMPS
  ---------------------------------------------------------- */

  createdAt: Date;
  updatedAt: Date;
}

/* ============================================================
   PENDING APPLICATION SCHEMA
============================================================ */

const pendingApplicationSchema =
  new Schema<PendingApplication>(
    {
      /* ======================================================
         FULL NAME
      ====================================================== */

      fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },

      /* ======================================================
         EMAIL
      ====================================================== */

      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 254,
      },

      /* ======================================================
         PHONE
      ====================================================== */

      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20,
      },

      /* ======================================================
         COLLEGE / UNIVERSITY
      ====================================================== */

      collegeUniversity: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },

      /* ======================================================
         COURSE
      ====================================================== */

      course: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },

      /* ======================================================
         BRANCH / STREAM
      ====================================================== */

      branchStream: {
        type: String,
        required: true,
        trim: true,
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
              value.length > 30
            ) {
              return false;
            }

            return value.every(
              (skill) =>
                typeof skill === "string" &&
                skill.trim().length >= 1 &&
                skill.trim().length <= 100,
            );
          },

          message:
            "Select at least one skill and maximum 30 skills are allowed.",
        },
      },

      /* ======================================================
         INTERNSHIP ID
      ====================================================== */

      internshipId: {
        type: Schema.Types.ObjectId,
        ref: "Internship",
        required: false,
      },

      /* ======================================================
         PLAN CODE
      ====================================================== */

      planCode: {
        type: String,

        enum: {
          values: INTERNSHIP_PLAN_CODES,

          message:
            "Invalid internship plan.",
        },

        required: false,

        trim: true,
      },

      /* ======================================================
         DURATION
      ====================================================== */

      duration: {
        type: String,
        trim: true,
        maxlength: 30,
        required: false,
      },

      /* ======================================================
         DURATION MONTHS
      ====================================================== */

      durationMonths: {
        type: Number,

        enum: {
          values: [1, 3, 6],

          message:
            "Duration must be 1, 3, or 6 months.",
        },

        required: false,
      },

      /* ======================================================
         PRICE
      ====================================================== */

      price: {
        type: Number,

        min: 0,

        required: false,

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

        required: false,

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
         TERMS
      ====================================================== */

      consentTerms: {
        type: Boolean,
        required: true,

        validate: {
          validator(value: boolean): boolean {
            return value === true;
          },

          message:
            "Terms & Conditions consent is required.",
        },
      },

      /* ======================================================
         PRIVACY
      ====================================================== */

      consentPrivacy: {
        type: Boolean,
        required: true,

        validate: {
          validator(value: boolean): boolean {
            return value === true;
          },

          message:
            "Privacy Policy consent is required.",
        },
      },

      /* ======================================================
         DECLARATION
      ====================================================== */

      consentDeclaration: {
        type: Boolean,
        required: true,

        validate: {
          validator(value: boolean): boolean {
            return value === true;
          },

          message:
            "Declaration consent is required.",
        },
      },
    },

    {
      /**
       * Embedded object.
       * No separate MongoDB _id required.
       */
      _id: false,

      /**
       * Reject unknown fields.
       */
      strict: true,
    },
  );

/* ============================================================
   PENDING APPLICATION PLAN NORMALIZATION
============================================================ */

/**
 * Mongoose 9 compatible middleware.
 *
 * IMPORTANT:
 * No next() callback is used.
 *
 * The middleware returns a Promise because it is async.
 */
pendingApplicationSchema.pre(
  "validate",
  async function () {
    const application =
      this as PendingApplication;

    /* --------------------------------------------------------
       NORMALIZE STRINGS
    -------------------------------------------------------- */

    if (
      typeof application.fullName ===
      "string"
    ) {
      application.fullName =
        application.fullName
          .trim()
          .replace(/\s+/g, " ");
    }

    if (
      typeof application.email ===
      "string"
    ) {
      application.email =
        application.email
          .trim()
          .toLowerCase();
    }

    if (
      typeof application.phone ===
      "string"
    ) {
      application.phone =
        application.phone.trim();
    }

    if (
      typeof application.collegeUniversity ===
      "string"
    ) {
      application.collegeUniversity =
        application.collegeUniversity
          .trim()
          .replace(/\s+/g, " ");
    }

    if (
      typeof application.course ===
      "string"
    ) {
      application.course =
        application.course
          .trim()
          .replace(/\s+/g, " ");
    }

    if (
      typeof application.branchStream ===
      "string"
    ) {
      application.branchStream =
        application.branchStream
          .trim()
          .replace(/\s+/g, " ");
    }

    if (
      typeof application.internshipTrack ===
      "string"
    ) {
      application.internshipTrack =
        application.internshipTrack
          .trim()
          .replace(/\s+/g, " ");
    }

    if (
      typeof application.duration ===
      "string"
    ) {
      application.duration =
        application.duration
          .trim()
          .replace(/\s+/g, " ");
    }

    /* --------------------------------------------------------
       NORMALIZE SKILLS
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
              .map((skill) =>
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
       * NEVER trust frontend price.
       *
       * planCode is the source of truth.
       */

      application.duration =
        getInternshipPlanDuration(
          planCode,
        );

      application.durationMonths =
        getInternshipPlanDurationMonths(
          planCode,
        );

      application.price =
        getInternshipPlanPrice(
          planCode,
        );

      application.priceInPaise =
        getInternshipPlanPriceInPaise(
          planCode,
        );
    }
  },
);

/* ============================================================
   PENDING APPLICATION PLAN CONSISTENCY
============================================================ */

/**
 * Strictly validates all generated plan values.
 *
 * Example:
 *
 * ONE_MONTH
 * -> duration = 1 Month
 * -> durationMonths = 1
 * -> price = 499
 * -> priceInPaise = 49900
 */
pendingApplicationSchema.pre(
  "validate",
  async function () {
    const application =
      this as PendingApplication;

    /* --------------------------------------------------------
       No plan = legacy-compatible application
    -------------------------------------------------------- */

    if (!application.planCode) {
      return;
    }

    const planCode =
      application.planCode;

    /* --------------------------------------------------------
       OFFICIAL VALUES
    -------------------------------------------------------- */

    const expectedDuration =
      getInternshipPlanDuration(
        planCode,
      );

    const expectedMonths =
      getInternshipPlanDurationMonths(
        planCode,
      );

    const expectedPrice =
      getInternshipPlanPrice(
        planCode,
      );

    const expectedPriceInPaise =
      getInternshipPlanPriceInPaise(
        planCode,
      );

    /* --------------------------------------------------------
       DURATION VALIDATION
    -------------------------------------------------------- */

    if (
      application.duration !==
      expectedDuration
    ) {
      throw new Error(
        `Invalid duration for ${planCode}. Expected ${expectedDuration}.`,
      );
    }

    /* --------------------------------------------------------
       MONTH VALIDATION
    -------------------------------------------------------- */

    if (
      application.durationMonths !==
      expectedMonths
    ) {
      throw new Error(
        `Invalid durationMonths for ${planCode}. Expected ${expectedMonths}.`,
      );
    }

    /* --------------------------------------------------------
       PRICE VALIDATION
    -------------------------------------------------------- */

    if (
      application.price !==
      expectedPrice
    ) {
      throw new Error(
        `Invalid price for ${planCode}. Official price is ₹${expectedPrice}.`,
      );
    }

    /* --------------------------------------------------------
       PAISE VALIDATION
    -------------------------------------------------------- */

    if (
      application.priceInPaise !==
      expectedPriceInPaise
    ) {
      throw new Error(
        `Invalid priceInPaise for ${planCode}. Expected ${expectedPriceInPaise}.`,
      );
    }
  },
);

/* ============================================================
   EMAIL VERIFICATION SCHEMA
============================================================ */

const emailVerificationSchema =
  new Schema<IEmailVerification>(
    {
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
      },

      /* ======================================================
         OTP HASH
      ====================================================== */

      otpHash: {
        type: String,

        required: true,

        /**
         * OTP hash is hidden by default.
         *
         * Verification route must explicitly use:
         *
         * .select("+otpHash")
         */
        select: false,
      },

      /* ======================================================
         ATTEMPTS
      ====================================================== */

      attempts: {
        type: Number,

        required: true,

        default: 0,

        min: 0,

        max: 10,
      },

      /* ======================================================
         MAX ATTEMPTS
      ====================================================== */

      maxAttempts: {
        type: Number,

        required: true,

        default: 5,

        min: 1,

        max: 10,
      },

      /* ======================================================
         OTP EXPIRATION
      ====================================================== */

      expiresAt: {
        type: Date,

        required: true,

        index: true,
      },

      /* ======================================================
         LAST SENT
      ====================================================== */

      lastSentAt: {
        type: Date,

        required: true,
      },

      /* ======================================================
         RESEND COUNT
      ====================================================== */

      resendCount: {
        type: Number,

        required: true,

        default: 0,

        min: 0,

        max: 20,
      },

      /* ======================================================
         PENDING APPLICATION
      ====================================================== */

      pendingApplication: {
        type: pendingApplicationSchema,

        required: true,
      },

      /* ======================================================
         VERIFIED AT
      ====================================================== */

      verifiedAt: {
        type: Date,

        required: false,
      },
    },

    {
      timestamps: true,

      strict: true,
    },
  );

/* ============================================================
   EMAIL VERIFICATION NORMALIZATION
============================================================ */

/**
 * Mongoose 9 compatible async middleware.
 *
 * No next() callback.
 */
emailVerificationSchema.pre(
  "validate",
  async function () {
    if (
      typeof this.email ===
      "string"
    ) {
      this.email =
        this.email
          .trim()
          .toLowerCase();
    }
  },
);

/* ============================================================
   TTL INDEX
============================================================ */

/**
 * Automatically deletes expired OTP sessions.
 *
 * IMPORTANT:
 * TTL deletion is asynchronous.
 *
 * The verification API must STILL check:
 *
 * expiresAt <= new Date()
 *
 * before accepting an OTP.
 */
emailVerificationSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,

    name:
      "email_verification_expiry_ttl",
  },
);

/* ============================================================
   EMAIL + EXPIRY INDEX
============================================================ */

/**
 * Useful for verification lookups.
 */
emailVerificationSchema.index(
  {
    email: 1,
    expiresAt: 1,
  },
  {
    name:
      "email_verification_email_expiry",
  },
);

/* ============================================================
   PENDING INTERNSHIP INDEX
============================================================ */

/**
 * Helps locate pending applications belonging
 * to a particular internship.
 *
 * sparse because internshipId is optional.
 */
emailVerificationSchema.index(
  {
    "pendingApplication.internshipId": 1,
    createdAt: -1,
  },
  {
    sparse: true,

    name:
      "pending_application_internship_created",
  },
);

/* ============================================================
   MODEL
============================================================ */

/**
 * Next.js development / Fast Refresh safe model.
 *
 * Prevents:
 *
 * OverwriteModelError
 */
const EmailVerification: Model<IEmailVerification> =
  mongoose.models.EmailVerification ||
  mongoose.model<IEmailVerification>(
    "EmailVerification",
    emailVerificationSchema,
  );

/* ============================================================
   EXPORT
============================================================ */

export default EmailVerification;