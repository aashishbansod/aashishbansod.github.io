import crypto from "node:crypto";
import mongoose, { Schema, Types } from "mongoose";
import type { Document, Model } from "mongoose";

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

export type SelectedDuration = "1 Month" | "3 Months" | "6 Months";

export type InternshipPlanCode =
  | "ONE_MONTH"
  | "THREE_MONTHS"
  | "SIX_MONTHS";

export type PaymentStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed";

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

const PLAN_CODES = [
  "ONE_MONTH",
  "THREE_MONTHS",
  "SIX_MONTHS",
] as const;

const DURATIONS = ["1 Month", "3 Months", "6 Months"] as const;

const APPLICATION_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
] as const;

const ASSESSMENT_STATUSES = [
  "not_started",
  "active",
  "passed",
  "failed",
] as const;

const PAYMENT_STATUSES = [
  "not_required",
  "pending",
  "paid",
  "failed",
] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export interface IApplication extends Document {
  applicationId: string;
  fullName: string;
  email: string;
  phone: string;
  collegeUniversity: string;
  course: string;
  branchStream: string;
  graduationYear: string;
  internshipTrack: string;
  skills: string[];
  internshipId?: Types.ObjectId;
  internshipTitle?: string;
  internshipDomain?: string;
  planCode?: InternshipPlanCode;
  selectedDuration?: SelectedDuration;
  durationMonths?: 1 | 3 | 6;
  price?: number;
  priceInPaise?: number;
  currency: "INR";
  consentTerms: boolean;
  consentPrivacy: boolean;
  consentDeclaration: boolean;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  status: ApplicationStatus;
  studentId?: string;
  assessmentStatus: AssessmentStatus;
  assessmentScore?: number;
  assessmentStartedAt?: Date;
  assessmentDeadline?: Date;
  internshipEligible: boolean;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  paymentPaidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function getPlanPrice(planCode: InternshipPlanCode): number {
  return INTERNSHIP_PLAN_PRICES[planCode];
}

export function getPlanPriceInPaise(planCode: InternshipPlanCode): number {
  return INTERNSHIP_PLAN_PRICES_IN_PAISE[planCode];
}

export function getPlanDuration(planCode: InternshipPlanCode): SelectedDuration {
  return INTERNSHIP_PLAN_DURATIONS[planCode];
}

export function getPlanDurationMonths(planCode: InternshipPlanCode): 1 | 3 | 6 {
  return INTERNSHIP_PLAN_DURATION_MONTHS[planCode];
}

export function isInternshipPlanCode(value: unknown): value is InternshipPlanCode {
  return typeof value === "string" &&
    (PLAN_CODES as readonly string[]).includes(value);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const skill = normalizeText(item);

    if (!skill || skill.length > 80) {
      continue;
    }

    const key = skill.toLocaleLowerCase("en");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(skill);

    if (normalized.length >= 20) {
      break;
    }
  }

  return normalized;
}

function createApplicationId(): string {
  return `CN-${new Date().getFullYear()}-${crypto.randomInt(100000, 1000000)}`;
}

const applicationSchema = new Schema<IApplication>(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
      minlength: 5,
      maxlength: 50,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      validate: {
        validator(value: string): boolean {
          return typeof value === "string" && EMAIL_REGEX.test(value);
        },
        message: "Please provide a valid email address.",
      },
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16,
      validate: {
        validator(value: string): boolean {
          return typeof value === "string" && PHONE_REGEX.test(value);
        },
        message: "Please provide a valid international phone number.",
      },
    },
    collegeUniversity: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    course: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    branchStream: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    graduationYear: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value: string): boolean {
          const year = Number(value);
          return /^\d{4}$/.test(value) &&
            Number.isInteger(year) &&
            year >= 2020 &&
            year <= 2050;
        },
        message: "Graduation year must be between 2020 and 2050.",
      },
    },
    internshipTrack: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    skills: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator(value: string[]): boolean {
          return Array.isArray(value) &&
            value.length >= 1 &&
            value.length <= 20 &&
            value.every(
              (skill) =>
                typeof skill === "string" &&
                skill.trim().length >= 1 &&
                skill.trim().length <= 80,
            );
        },
        message: "Select between 1 and 20 valid skills.",
      },
    },
    internshipId: {
      type: Schema.Types.ObjectId,
      ref: "Internship",
      default: undefined,
    },
    internshipTitle: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 200,
    },
    internshipDomain: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 120,
    },
    planCode: {
      type: String,
      enum: {
        values: PLAN_CODES,
        message: "Invalid internship plan code.",
      },
      default: undefined,
    },
    selectedDuration: {
      type: String,
      enum: {
        values: DURATIONS,
        message: "Selected duration must be 1 Month, 3 Months, or 6 Months.",
      },
      default: undefined,
    },
    durationMonths: {
      type: Number,
      enum: [1, 3, 6],
      default: undefined,
    },
    price: {
      type: Number,
      min: 0,
      default: undefined,
      validate: {
        validator(value: number): boolean {
          return Number.isFinite(value) && value >= 0;
        },
        message: "Price must be a valid non-negative number.",
      },
    },
    priceInPaise: {
      type: Number,
      min: 0,
      default: undefined,
      validate: {
        validator(value: number): boolean {
          return Number.isSafeInteger(value) && value >= 0;
        },
        message: "Price in paise must be a valid non-negative integer.",
      },
    },
    currency: {
      type: String,
      enum: ["INR"],
      required: true,
      default: "INR",
      immutable: true,
    },
    consentTerms: {
      type: Boolean,
      required: true,
      validate: {
        validator(value: boolean): boolean {
          return value === true;
        },
        message: "Terms & Conditions must be accepted.",
      },
    },
    consentPrivacy: {
      type: Boolean,
      required: true,
      validate: {
        validator(value: boolean): boolean {
          return value === true;
        },
        message: "Privacy Policy must be accepted.",
      },
    },
    consentDeclaration: {
      type: Boolean,
      required: true,
      validate: {
        validator(value: boolean): boolean {
          return value === true;
        },
        message: "Declaration must be accepted.",
      },
    },
    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: undefined,
    },
    status: {
      type: String,
      required: true,
      enum: APPLICATION_STATUSES,
      default: "pending",
    },
    studentId: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 50,
    },
    assessmentStatus: {
      type: String,
      required: true,
      enum: ASSESSMENT_STATUSES,
      default: "not_started",
    },
    assessmentScore: {
      type: Number,
      min: 0,
      max: 100,
      default: undefined,
      validate: {
        validator(value: number): boolean {
          return Number.isFinite(value) && value >= 0 && value <= 100;
        },
        message: "Assessment score must be between 0 and 100.",
      },
    },
    assessmentStartedAt: {
      type: Date,
      default: undefined,
    },
    assessmentDeadline: {
      type: Date,
      default: undefined,
    },
    internshipEligible: {
      type: Boolean,
      required: true,
      default: false,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: PAYMENT_STATUSES,
      default: "pending",
    },
    paymentId: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 150,
    },
    paymentPaidAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    strict: true,
    versionKey: false,
    minimize: true,
  },
);

applicationSchema.pre("validate", async function () {
  const application = this as IApplication;

  if (typeof application.email === "string") {
    application.email = application.email.trim().toLowerCase();
  }

  if (typeof application.fullName === "string") {
    application.fullName = normalizeText(application.fullName);
  }

  if (typeof application.phone === "string") {
    application.phone = application.phone.trim();
  }

  if (typeof application.collegeUniversity === "string") {
    application.collegeUniversity = normalizeText(application.collegeUniversity);
  }

  if (typeof application.course === "string") {
    application.course = normalizeText(application.course);
  }

  if (typeof application.branchStream === "string") {
    application.branchStream = normalizeText(application.branchStream);
  }

  if (typeof application.graduationYear === "string") {
    application.graduationYear = application.graduationYear.trim();
  }

  if (typeof application.internshipTrack === "string") {
    application.internshipTrack = normalizeText(application.internshipTrack);
  }

  if (typeof application.internshipTitle === "string") {
    application.internshipTitle = normalizeText(application.internshipTitle);
  }

  if (typeof application.internshipDomain === "string") {
    application.internshipDomain = normalizeText(application.internshipDomain);
  }

  application.skills = normalizeSkills(application.skills);

  if (application.planCode && isInternshipPlanCode(application.planCode)) {
    application.selectedDuration = getPlanDuration(application.planCode);
    application.durationMonths = getPlanDurationMonths(application.planCode);
    application.price = getPlanPrice(application.planCode);
    application.priceInPaise = getPlanPriceInPaise(application.planCode);
    application.currency = "INR";
  }

  if (!application.applicationId) {
    application.applicationId = createApplicationId();
  }
});

applicationSchema.pre("validate", async function () {
  const application = this as IApplication;

  if (!application.internshipId) {
    return;
  }

  if (!application.planCode || !isInternshipPlanCode(application.planCode)) {
    throw new Error("A valid internship plan code is required for this application.");
  }

  const expectedPrice = getPlanPrice(application.planCode);
  const expectedPriceInPaise = getPlanPriceInPaise(application.planCode);
  const expectedDuration = getPlanDuration(application.planCode);
  const expectedMonths = getPlanDurationMonths(application.planCode);

  if (
    application.selectedDuration !== expectedDuration ||
    application.durationMonths !== expectedMonths ||
    application.price !== expectedPrice ||
    application.priceInPaise !== expectedPriceInPaise ||
    application.currency !== "INR"
  ) {
    throw new Error("Internship plan pricing or duration does not match the selected plan.");
  }
});

applicationSchema.pre("validate", async function () {
  const application = this as IApplication;

  if (
    application.assessmentStartedAt &&
    application.assessmentDeadline &&
    application.assessmentDeadline.getTime() < application.assessmentStartedAt.getTime()
  ) {
    throw new Error("Assessment deadline cannot be earlier than its start time.");
  }
});

applicationSchema.index({ createdAt: -1 });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ assessmentStatus: 1, createdAt: -1 });
applicationSchema.index({ paymentStatus: 1, createdAt: -1 });
applicationSchema.index({ studentId: 1 });
applicationSchema.index({ internshipId: 1, createdAt: -1 });
applicationSchema.index({ planCode: 1, selectedDuration: 1, createdAt: -1 });
applicationSchema.index({ internshipEligible: 1, createdAt: -1 });
applicationSchema.index({ emailVerified: 1, status: 1, createdAt: -1 });
applicationSchema.index({ internshipTrack: 1, status: 1, createdAt: -1 });
applicationSchema.index({ paymentId: 1 });

const Application: Model<IApplication> =
  (mongoose.models.Application as Model<IApplication>) ||
  mongoose.model<IApplication>("Application", applicationSchema);

export default Application;
