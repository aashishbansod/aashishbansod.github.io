import mongoose, {
  Schema,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * ============================================================
 * CYBERNET CAREERS
 * INTERNSHIP MODEL
 * ============================================================
 *
 * ONE MongoDB document = ONE internship plan.
 *
 * Admin creates ONE internship program.
 * The API can automatically create:
 *
 *   1 Month  -> ₹499
 *   3 Months -> ₹999
 *   6 Months -> ₹1699
 *
 * IMPORTANT:
 * Pricing is controlled by the planCode.
 * The browser/API cannot override the trusted plan price.
 *
 * Payment:
 *   price        -> INR amount
 *   priceInPaise -> Razorpay/payment gateway amount
 * ============================================================
 */

/* ============================================================
   CONSTANTS
   ============================================================ */

export const INTERNSHIP_STATUSES = [
  "active",
  "inactive",
  "draft",
  "closed",
] as const;

export const INTERNSHIP_PLAN_CODES = [
  "ONE_MONTH",
  "THREE_MONTHS",
  "SIX_MONTHS",
] as const;

export const INTERNSHIP_DURATIONS = [
  "1 Month",
  "3 Months",
  "6 Months",
] as const;

export const INTERNSHIP_MODES = [
  "Remote",
  "Hybrid",
  "On-site",
] as const;

/* ============================================================
   TYPES
   ============================================================ */

export type InternshipStatus =
  (typeof INTERNSHIP_STATUSES)[number];

export type InternshipPlanCode =
  (typeof INTERNSHIP_PLAN_CODES)[number];

export type InternshipDuration =
  (typeof INTERNSHIP_DURATIONS)[number];

export type InternshipMode =
  (typeof INTERNSHIP_MODES)[number];

/* ============================================================
   PLAN CONFIGURATION
   ============================================================ */

/**
 * CENTRAL PLAN CONFIGURATION
 *
 * This is the single source of truth for automatic plans.
 *
 * 1 Month  = ₹499
 * 3 Months = ₹999
 * 6 Months = ₹1699
 */

export const INTERNSHIP_PLAN_CONFIG = {
  ONE_MONTH: {
    planCode: "ONE_MONTH",
    duration: "1 Month",
    durationMonths: 1,
    price: 499,
    priceInPaise: 49900,
    sortOrder: 1,
  },

  THREE_MONTHS: {
    planCode: "THREE_MONTHS",
    duration: "3 Months",
    durationMonths: 3,
    price: 999,
    priceInPaise: 99900,
    sortOrder: 2,
  },

  SIX_MONTHS: {
    planCode: "SIX_MONTHS",
    duration: "6 Months",
    durationMonths: 6,
    price: 1699,
    priceInPaise: 169900,
    sortOrder: 3,
  },
} as const;

/**
 * Price lookup by plan code.
 */
export const INTERNSHIP_PLAN_PRICES: Record<
  InternshipPlanCode,
  number
> = {
  ONE_MONTH: 499,
  THREE_MONTHS: 999,
  SIX_MONTHS: 1699,
};

/**
 * Duration lookup by plan code.
 */
export const INTERNSHIP_PLAN_DURATIONS: Record<
  InternshipPlanCode,
  InternshipDuration
> = {
  ONE_MONTH: "1 Month",
  THREE_MONTHS: "3 Months",
  SIX_MONTHS: "6 Months",
};

/**
 * Duration months lookup.
 */
export const INTERNSHIP_PLAN_MONTHS: Record<
  InternshipPlanCode,
  1 | 3 | 6
> = {
  ONE_MONTH: 1,
  THREE_MONTHS: 3,
  SIX_MONTHS: 6,
};

/**
 * Sort order lookup.
 */
export const INTERNSHIP_PLAN_SORT_ORDER: Record<
  InternshipPlanCode,
  1 | 2 | 3
> = {
  ONE_MONTH: 1,
  THREE_MONTHS: 2,
  SIX_MONTHS: 3,
};

/* ============================================================
   HELPER FUNCTIONS
   ============================================================ */

/**
 * Returns the trusted price for a plan.
 */
export function getInternshipPlanPrice(
  planCode: InternshipPlanCode,
): number {
  return INTERNSHIP_PLAN_PRICES[planCode];
}

/**
 * Returns the trusted price in paise.
 */
export function getInternshipPlanPriceInPaise(
  planCode: InternshipPlanCode,
): number {
  return INTERNSHIP_PLAN_PRICES[planCode] * 100;
}

/**
 * Returns duration for a plan.
 */
export function getInternshipPlanDuration(
  planCode: InternshipPlanCode,
): InternshipDuration {
  return INTERNSHIP_PLAN_DURATIONS[planCode];
}

/**
 * Returns duration months.
 */
export function getInternshipPlanMonths(
  planCode: InternshipPlanCode,
): 1 | 3 | 6 {
  return INTERNSHIP_PLAN_MONTHS[planCode];
}

/* ============================================================
   SCHEMA
   ============================================================ */

const InternshipSchema = new Schema(
  {
    /* ========================================================
       IDENTIFICATION
       ======================================================== */

    internshipId: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      maxlength: 80,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },

    /**
     * Legacy/UI compatibility.
     */
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
    },

    /* ========================================================
       DOMAIN
       ======================================================== */

    domain: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
      index: true,
    },

    assessmentDomain: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
      index: true,
    },

    assessmentRequired: {
      type: Boolean,
      default: true,
      index: true,
    },

    applicationRequired: {
      type: Boolean,
      default: true,
    },

    /* ========================================================
       PLAN
       ======================================================== */

    planCode: {
      type: String,
      enum: INTERNSHIP_PLAN_CODES,
      required: true,
      index: true,
    },

    duration: {
      type: String,
      enum: INTERNSHIP_DURATIONS,
      required: true,
      index: true,
    },

    durationMonths: {
      type: Number,
      enum: [1, 3, 6],
      required: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },

    /* ========================================================
       PRICING
       ======================================================== */

    /**
     * Trusted INR price.
     *
     * IMPORTANT:
     * pre("validate") automatically replaces this value
     * according to planCode.
     */
    price: {
      type: Number,
      required: true,
      default: 499,
      min: 0,
      max: 100000000,
    },

    /**
     * Trusted payment amount in paise.
     *
     * Example:
     * ₹499  -> 49900
     * ₹999  -> 99900
     * ₹1699 -> 169900
     */
    priceInPaise: {
      type: Number,
      required: true,
      default: 49900,
      min: 0,
      max: 10000000000,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    stipend: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    /* ========================================================
       DELIVERY
       ======================================================== */

    mode: {
      type: String,
      enum: INTERNSHIP_MODES,
      default: "Remote",
      required: true,
    },

    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    /* ========================================================
       CONTENT
       ======================================================== */

    skills: {
      type: [String],
      default: [],
    },

    technologies: {
      type: [String],
      default: [],
    },

    requirements: {
      type: [String],
      default: [],
    },

    responsibilities: {
      type: [String],
      default: [],
    },

    eligibility: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },

    /* ========================================================
       CAPACITY / COUNTERS
       ======================================================== */

    /**
     * 0 = unlimited.
     */
    maxStudents: {
      type: Number,
      default: 0,
      min: 0,
      max: 100000000,
    },

    /**
     * Backend-controlled confirmed enrolments.
     */
    enrolledStudents: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Compatibility counter.
     */
    applications: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * Compatibility counter.
     */
    applicants: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* ========================================================
       AVAILABILITY
       ======================================================== */

    status: {
      type: String,
      enum: INTERNSHIP_STATUSES,
      default: "draft",
      required: true,
      index: true,
    },

    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },

    isSelectable: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* ========================================================
       DATES
       ======================================================== */

    startDate: {
      type: Date,
      default: null,
      index: true,
    },

    endDate: {
      type: Date,
      default: null,
      index: true,
    },

    /* ========================================================
       CERTIFICATE / METADATA
       ======================================================== */

    certificateEligible: {
      type: Boolean,
      default: true,
    },

    featured: {
      type: Boolean,
      default: false,
      index: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    /* ========================================================
       ADMIN
       ======================================================== */

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },
  },
  {
    timestamps: true,
    collection: "internships",
    strict: true,
    versionKey: false,
  },
);

/* ============================================================
   PRE-VALIDATE
   ============================================================ */

/**
 * IMPORTANT:
 *
 * This is async middleware.
 * We intentionally DO NOT use next().
 *
 * This avoids the previous Mongoose/TypeScript callback
 * typing problem.
 */
InternshipSchema.pre("validate", async function () {
  /* ----------------------------------------------------------
     BASIC NORMALIZATION
     ---------------------------------------------------------- */

  if (!this.name && this.title) {
    this.name = this.title;
  }

  if (!this.assessmentDomain && this.domain) {
    this.assessmentDomain = this.domain;
  }

  /* ----------------------------------------------------------
     PLAN NORMALIZATION
     ---------------------------------------------------------- */

  const planCode =
    this.planCode as InternshipPlanCode;

  if (
    planCode &&
    Object.prototype.hasOwnProperty.call(
      INTERNSHIP_PLAN_CONFIG,
      planCode,
    )
  ) {
    const plan =
      INTERNSHIP_PLAN_CONFIG[planCode];

    /**
     * Always derive these fields from planCode.
     */
    this.duration = plan.duration;
    this.durationMonths =
      plan.durationMonths;

    this.sortOrder =
      plan.sortOrder;

    /**
     * CRITICAL:
     *
     * The price sent from frontend/API is NOT trusted.
     *
     * The plan determines the price.
     */
    this.price = plan.price;

    this.priceInPaise =
      plan.priceInPaise;

    this.currency = "INR";
  }

  /* ----------------------------------------------------------
     MONEY SAFETY
     * ---------------------------------------------------------- */

  if (
    typeof this.price === "number" &&
    Number.isFinite(this.price)
  ) {
    this.price = Math.max(
      0,
      Math.round(this.price * 100) / 100,
    );

    this.priceInPaise = Math.round(
      this.price * 100,
    );
  }

  /* ----------------------------------------------------------
     NUMERIC NORMALIZATION
     ---------------------------------------------------------- */

  if (
    typeof this.maxStudents === "number"
  ) {
    this.maxStudents = Math.max(
      0,
      Math.floor(this.maxStudents),
    );
  }

  if (
    typeof this.enrolledStudents === "number"
  ) {
    this.enrolledStudents = Math.max(
      0,
      Math.floor(this.enrolledStudents),
    );
  }

  if (
    typeof this.applications === "number"
  ) {
    this.applications = Math.max(
      0,
      Math.floor(this.applications),
    );
  }

  if (
    typeof this.applicants === "number"
  ) {
    this.applicants = Math.max(
      0,
      Math.floor(this.applicants),
    );
  }

  /* ----------------------------------------------------------
     AVAILABILITY SAFETY
     ---------------------------------------------------------- */

  if (
    this.status !== "active" ||
    this.isPublic !== true
  ) {
    this.isSelectable = false;
  }

  /* ----------------------------------------------------------
     DATE VALIDATION
     ---------------------------------------------------------- */

  if (
    this.startDate &&
    this.endDate &&
    this.endDate.getTime() <
      this.startDate.getTime()
  ) {
    throw new Error(
      "Internship endDate cannot be earlier than startDate.",
    );
  }

  /* ----------------------------------------------------------
     CAPACITY VALIDATION
     ---------------------------------------------------------- */

  if (
    this.maxStudents > 0 &&
    this.enrolledStudents >
      this.maxStudents
  ) {
    throw new Error(
      "Enrolled students cannot exceed maxStudents.",
    );
  }

  /* ----------------------------------------------------------
     PRICE VALIDATION
     ---------------------------------------------------------- */

  if (
    !Number.isFinite(this.price) ||
    this.price < 0
  ) {
    throw new Error(
      "Internship price must be a valid non-negative number.",
    );
  }

  if (
    !Number.isFinite(this.priceInPaise) ||
    this.priceInPaise < 0
  ) {
    throw new Error(
      "Internship priceInPaise must be a valid non-negative number.",
    );
  }

  /* ----------------------------------------------------------
     PRICE CONSISTENCY
     ---------------------------------------------------------- */

  const expectedPriceInPaise =
    Math.round(this.price * 100);

  if (
    this.priceInPaise !==
    expectedPriceInPaise
  ) {
    this.priceInPaise =
      expectedPriceInPaise;
  }
});

/* ============================================================
   INDEXES
   ============================================================ */

/**
 * One plan per domain.
 *
 * Example:
 *
 * Java + ONE_MONTH
 * Java + THREE_MONTHS
 * Java + SIX_MONTHS
 *
 * All three are allowed.
 *
 * Duplicate same plans are prevented.
 */
InternshipSchema.index(
  {
    domain: 1,
    planCode: 1,
  },
  {
    unique: true,
    name: "unique_domain_plan",
  },
);

/**
 * Student-facing lookup.
 */
InternshipSchema.index({
  domain: 1,
  status: 1,
  isPublic: 1,
  isSelectable: 1,
});

/**
 * Domain + duration.
 */
InternshipSchema.index({
  domain: 1,
  duration: 1,
});

/**
 * Assessment lookup.
 */
InternshipSchema.index({
  assessmentDomain: 1,
  status: 1,
});

/**
 * Student plan ordering.
 */
InternshipSchema.index({
  domain: 1,
  sortOrder: 1,
  status: 1,
});

/**
 * Active/public/selectable lookup.
 */
InternshipSchema.index({
  status: 1,
  isPublic: 1,
  isSelectable: 1,
  createdAt: -1,
});

/**
 * Featured internships.
 */
InternshipSchema.index({
  featured: 1,
  status: 1,
  isPublic: 1,
});

/**
 * Date availability.
 */
InternshipSchema.index({
  startDate: 1,
  endDate: 1,
  status: 1,
});

/**
 * Admin-created records.
 */
InternshipSchema.index({
  createdBy: 1,
  createdAt: -1,
});

/**
 * Latest records.
 */
InternshipSchema.index({
  createdAt: -1,
});

/**
 * Admin search.
 */
InternshipSchema.index({
  title: "text",
  name: "text",
  description: "text",
  domain: "text",
  assessmentDomain: "text",
  location: "text",
  eligibility: "text",
});

/* ============================================================
   MODEL TYPE
   ============================================================ */

export type InternshipDocument =
  InferSchemaType<
    typeof InternshipSchema
  >;

/* ============================================================
   MODEL
   ============================================================ */

const InternshipModel: Model<InternshipDocument> =
  (mongoose.models.Internship as
    | Model<InternshipDocument>
    | undefined) ||
  mongoose.model<InternshipDocument>(
    "Internship",
    InternshipSchema,
  );

export default InternshipModel;