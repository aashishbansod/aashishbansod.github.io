
import type {
  Connection,
  Model,
  InferSchemaType,
} from "mongoose";
import { Schema } from "mongoose";
import { connectStudentDB } from "@/lib/student-db";

const COLLECTION_NAME = "student_operations";

const nullableDate = {
  type: Date,
  default: null,
} as const;

const boundedPercentage = {
  type: Number,
  min: [0, "Percentage cannot be less than 0."],
  max: [100, "Percentage cannot exceed 100."],
  default: 0,
} as const;

const nonNegativeNumber = {
  type: Number,
  min: [0, "Value cannot be negative."],
  default: 0,
} as const;

const approvalStatuses = [
  "pending",
  "approved",
  "rejected",
] as const;

const internshipPlans = {
  ONE_MONTH: {
    durationMonths: 1,
    durationDays: 30,
    amount: 499,
    currency: "INR",
    legacyLabel: "1 month",
  },
  THREE_MONTHS: {
    durationMonths: 3,
    durationDays: 90,
    amount: 999,
    currency: "INR",
    legacyLabel: "3 months",
  },
  SIX_MONTHS: {
    durationMonths: 6,
    durationDays: 180,
    amount: 1699,
    currency: "INR",
    legacyLabel: "6 months",
  },
} as const;

type InternshipPlanCode = keyof typeof internshipPlans;

const internshipPlanAliases: Record<string, InternshipPlanCode> = {
  ONE_MONTH: "ONE_MONTH",
  "1_MONTH": "ONE_MONTH",
  "1_MONTHS": "ONE_MONTH",
  "1 MONTH": "ONE_MONTH",
  "1 MONTHS": "ONE_MONTH",
  THREE_MONTHS: "THREE_MONTHS",
  "3_MONTH": "THREE_MONTHS",
  "3 MONTHS": "THREE_MONTHS",
  SIX_MONTHS: "SIX_MONTHS",
  "6_MONTH": "SIX_MONTHS",
  "6 MONTHS": "SIX_MONTHS",
};

function normalizeInternshipPlanCode(value: unknown): InternshipPlanCode | "" {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toUpperCase().replace(/[-\\s]+/g, "_");
  return internshipPlanAliases[normalized] ?? internshipPlanAliases[value.trim().toUpperCase()] ?? "";
}

const operationsStatuses = [
  "not-ready",
  "payment-pending",
  "pending-review",
  "approved",
  "active",
  "suspended",
  "completed",
  "expired",
] as const;

const dashboardStatuses = [
  "locked",
  "pending",
  "active",
  "suspended",
  "completed",
] as const;

const StudentOperationsSchema = new Schema(
  {
    mainStudentId: {
      type: String,
      required: [true, "Main database student ID is required."],
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    applicationId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: "",
      index: true,
    },
    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: "",
      index: true,
    },
    dashboardStudentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 60,
      default: "",
    },
    fullName: {
      type: String,
      required: [true, "Student full name is required."],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    email: {
      type: String,
      required: [true, "Student email is required."],
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    applicationStatus: {
      type: String,
      trim: true,
      default: "pending",
      maxlength: 40,
      index: true,
    },
    adminApprovalStatus: {
      type: String,
      trim: true,
      default: "pending",
      maxlength: 40,
      index: true,
    },
    assessmentStatus: {
      type: String,
      trim: true,
      default: "not-started",
      maxlength: 40,
      index: true,
    },
    assessmentScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    resultStatus: {
      type: String,
      trim: true,
      default: "not-declared",
      maxlength: 40,
      index: true,
    },

    internshipStatus: {
      type: String,
      trim: true,
      default: "not-started",
      maxlength: 50,
      index: true,
    },
    internshipTrack: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    internshipPlan: {
      type: String,
      enum: [
        "",
        "1 month",
        "3 months",
        "6 months",
        "1 Month",
        "3 Months",
        "6 Months",
        "ONE_MONTH",
        "THREE_MONTHS",
        "SIX_MONTHS",
      ],
      default: "",
    },
    internshipPlanCode: {
      type: String,
      enum: ["", "ONE_MONTH", "THREE_MONTHS", "SIX_MONTHS"],
      default: "",
      index: true,
    },
    internshipDurationMonths: {
      type: Number,
      min: 0,
      max: 36,
      default: 0,
    },
    internshipDurationDays: {
      type: Number,
      min: 0,
      max: 3650,
      default: 0,
    },
    internshipStartedAt: nullableDate,
    internshipEndsAt: nullableDate,

    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "expired", "refunded"],
      default: "unpaid",
      index: true,
    },
    paymentAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    paymentCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 3,
      default: "INR",
    },
    paymentAttemptGroupId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
      index: true,
    },
    razorpayCheckoutExpiresAt: nullableDate,
    paymentExpiredAt: nullableDate,
    paymentVerificationSource: {
      type: String,
      enum: ["", "razorpay_checkout", "razorpay_webhook", "admin_reconciliation", "legacy"],
      default: "",
    },

    studentOpsApprovalStatus: {
      type: String,
      enum: approvalStatuses,
      default: "pending",
      index: true,
    },
    studentOpsStatus: {
      type: String,
      enum: operationsStatuses,
      default: "not-ready",
      index: true,
    },
    operationsApprovalStatus: {
      type: String,
      enum: approvalStatuses,
      default: "pending",
      index: true,
    },
    operationsApprovedBy: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    operationsApprovedAt: nullableDate,
    operationsReviewedAt: nullableDate,
    operationsRejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    operationsStatus: {
      type: String,
      enum: operationsStatuses,
      default: "not-ready",
      index: true,
    },

    dashboardStatus: {
      type: String,
      enum: dashboardStatuses,
      default: "locked",
      index: true,
    },
    dashboardLoginEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    dashboardLoginEnabledAt: nullableDate,
    dashboardStudentIdNormalized: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 60,
      default: "",
    },
    dashboardPasswordHash: {
      type: String,
      default: "",
      select: false,
      maxlength: 255,
    },
    dashboardCredentialsGenerated: {
      type: Boolean,
      default: false,
    },
    dashboardCredentialsGeneratedAt: nullableDate,
    dashboardCredentialsExpiresAt: nullableDate,
    dashboardPasswordChangedAt: nullableDate,
    dashboardMustChangePassword: {
      type: Boolean,
      default: true,
    },
    dashboardLastLoginAt: nullableDate,
    dashboardLoginAttempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    dashboardAccountLocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    dashboardLockedUntil: nullableDate,
    dashboardDeactivatedAt: nullableDate,
    dashboardDeactivationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    sourceVersion: {
      type: Number,
      min: 1,
      default: 1,
    },
    sourceUpdatedAt: nullableDate,
    lastSyncedAt: nullableDate,
    syncStatus: {
      type: String,
      enum: ["pending", "synced", "failed"],
      default: "pending",
      index: true,
    },
    syncError: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    learningStatus: {
      type: String,
      enum: ["not-started", "active", "paused", "completed"],
      default: "not-started",
    },
    currentLearningDay: nonNegativeNumber,
    completedLearningDays: nonNegativeNumber,
    taskCompletionPercentage: boundedPercentage,
    learningProgressPercentage: boundedPercentage,
    attendancePercentage: boundedPercentage,
    currentTaskId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    lastTaskAssignedAt: nullableDate,
    lastTaskSubmittedAt: nullableDate,
    totalTasksAssigned: nonNegativeNumber,
    totalTasksSubmitted: nonNegativeNumber,
    totalTasksApproved: nonNegativeNumber,

    weeklyAssessmentStatus: {
      type: String,
      enum: ["locked", "available", "in-progress", "submitted", "passed", "failed"],
      default: "locked",
    },
    weeklyAssessmentScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    weeklyAssessmentSubmittedAt: nullableDate,

    saturdayAssessmentStatus: {
      type: String,
      enum: ["locked", "available", "in-progress", "submitted", "passed", "failed"],
      default: "locked",
    },
    saturdayAssessmentScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    saturdayAssessmentSubmittedAt: nullableDate,

    attendanceDaysPresent: nonNegativeNumber,
    attendanceDaysAbsent: nonNegativeNumber,
    lastAttendanceAt: nullableDate,

    projectStatus: {
      type: String,
      enum: [
        "not-started",
        "in-progress",
        "submitted",
        "under-review",
        "approved",
        "completed",
        "rework",
        "rejected",
      ],
      default: "not-started",
      index: true,
    },
    projectFolderReference: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    projectSubmittedAt: nullableDate,
    projectReviewedAt: nullableDate,
    projectReviewNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    certificateStatus: {
      type: String,
      enum: ["not-eligible", "eligible", "generated", "verified", "revoked"],
      default: "not-eligible",
      index: true,
    },
    certificateId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    certificateGeneratedAt: nullableDate,

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
    strict: true,
    versionKey: false,
    minimize: true,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

StudentOperationsSchema.index(
  { mainStudentId: 1 },
  {
    name: "uniq_student_operations_main_student",
    unique: true,
    partialFilterExpression: {
      mainStudentId: { $type: "string", $gt: "" },
    },
  },
);

StudentOperationsSchema.index(
  { operationsApprovalStatus: 1, createdAt: -1 },
  { name: "student_operations_approval_created" },
);

StudentOperationsSchema.index(
  { operationsStatus: 1, createdAt: -1 },
  { name: "student_operations_status_created" },
);

StudentOperationsSchema.index(
  { dashboardStatus: 1, dashboardLoginEnabled: 1 },
  { name: "student_operations_dashboard_access" },
);

StudentOperationsSchema.index(
  { syncStatus: 1, updatedAt: 1 },
  { name: "student_operations_sync_updated" },
);

StudentOperationsSchema.index(
  { internshipEndsAt: 1, operationsStatus: 1 },
  { name: "student_operations_internship_completion" },
);

StudentOperationsSchema.index(
  { certificateStatus: 1, updatedAt: -1 },
  { name: "student_operations_certificate_updated" },
);

StudentOperationsSchema.index(
  { email: 1, createdAt: -1 },
  { name: "student_operations_email_created" },
);

StudentOperationsSchema.index(
  { studentId: 1, createdAt: -1 },
  { name: "student_operations_student_id_created" },
);

StudentOperationsSchema.index(
  { dashboardStudentId: 1, createdAt: -1 },
  { name: "student_operations_dashboard_id_created" },
);

StudentOperationsSchema.index(
  { paymentStatus: 1, operationsApprovalStatus: 1, createdAt: -1 },
  { name: "student_operations_payment_approval_created" },
);

StudentOperationsSchema.index(
  { internshipPlanCode: 1, paymentStatus: 1, createdAt: -1 },
  { name: "student_operations_plan_payment_created" },
);

StudentOperationsSchema.index(
  { paymentAttemptGroupId: 1, updatedAt: -1 },
  { name: "student_operations_payment_attempt_updated" },
);

StudentOperationsSchema.index(
  { razorpayCheckoutExpiresAt: 1, paymentStatus: 1 },
  { name: "student_operations_checkout_expiry_status" },
);

StudentOperationsSchema.index(
  { projectStatus: 1, certificateStatus: 1, internshipEndsAt: 1 },
  { name: "student_operations_project_certificate_eligibility" },
);

StudentOperationsSchema.pre("validate", function normalizeStudentOperations() {
  if (typeof this.mainStudentId === "string") {
    this.mainStudentId = this.mainStudentId.trim();
  }

  if (typeof this.applicationId === "string") {
    this.applicationId = this.applicationId.trim().toUpperCase();
  }

  if (typeof this.studentId === "string") {
    this.studentId = this.studentId.trim().toUpperCase();
  }

  if (typeof this.dashboardStudentId === "string") {
    this.dashboardStudentId = this.dashboardStudentId.trim().toUpperCase();
  }

  if (typeof this.dashboardStudentIdNormalized === "string") {
    this.dashboardStudentIdNormalized =
      this.dashboardStudentIdNormalized.trim().toUpperCase();
  }

  if (typeof this.fullName === "string") {
    this.fullName = this.fullName.trim().replace(/\s+/g, " ");
  }

  if (typeof this.email === "string") {
    this.email = this.email.trim().toLowerCase();
  }

  if (typeof this.phone === "string") {
    this.phone = this.phone.trim();
  }

  if (typeof this.internshipTrack === "string") {
    this.internshipTrack = this.internshipTrack.trim();
  }

  const normalizedPlanCode = normalizeInternshipPlanCode(
    this.internshipPlanCode || this.internshipPlan,
  );

  if (normalizedPlanCode) {
    const plan = internshipPlans[normalizedPlanCode];
    this.internshipPlanCode = normalizedPlanCode;
    this.internshipPlan = plan.legacyLabel;
    this.internshipDurationMonths = plan.durationMonths;
    this.internshipDurationDays = plan.durationDays;
    this.paymentCurrency = plan.currency;

    if (
      typeof this.paymentAmount === "number" &&
      this.paymentAmount > 0 &&
      this.paymentAmount !== plan.amount
    ) {
      this.invalidate(
        "paymentAmount",
        "Payment amount does not match the selected internship plan.",
      );
    }

    if (
      this.paymentStatus === "paid" &&
      (!this.paymentAmount || this.paymentAmount !== plan.amount)
    ) {
      this.invalidate(
        "paymentAmount",
        "A paid internship record must match the selected plan amount.",
      );
    }
  } else if (this.internshipPlanCode) {
    this.invalidate(
      "internshipPlanCode",
      "Select a supported internship plan.",
    );
  }

  if (
    this.paymentVerificationSource &&
    this.paymentStatus !== "paid"
  ) {
    this.invalidate(
      "paymentVerificationSource",
      "Payment verification source is only valid for paid records.",
    );
  }

  if (
    this.paymentExpiredAt instanceof Date &&
    this.paymentStatus !== "expired"
  ) {
    this.invalidate(
      "paymentExpiredAt",
      "Payment expiry timestamp requires expired payment status.",
    );
  }

  if (
    this.razorpayCheckoutExpiresAt instanceof Date &&
    this.paymentStatus === "paid"
  ) {
    this.razorpayCheckoutExpiresAt = null;
  }

  if (typeof this.paymentCurrency === "string") {
    this.paymentCurrency = this.paymentCurrency.trim().toUpperCase();
  }

  if (typeof this.certificateId === "string") {
    this.certificateId = this.certificateId.trim().toUpperCase();
  }

  if (typeof this.operationsApprovedBy === "string") {
    this.operationsApprovedBy = this.operationsApprovedBy.trim();
  }

  if (typeof this.syncError === "string") {
    this.syncError = this.syncError.trim().slice(0, 500);
  }

  if (
    this.internshipStartedAt instanceof Date &&
    this.internshipEndsAt instanceof Date &&
    !Number.isNaN(this.internshipStartedAt.getTime()) &&
    !Number.isNaN(this.internshipEndsAt.getTime()) &&
    this.internshipEndsAt.getTime() < this.internshipStartedAt.getTime()
  ) {
    this.invalidate(
      "internshipEndsAt",
      "Internship end date cannot be earlier than the start date.",
    );
  }

  if (
    this.dashboardCredentialsGeneratedAt instanceof Date &&
    this.dashboardCredentialsExpiresAt instanceof Date &&
    !Number.isNaN(this.dashboardCredentialsGeneratedAt.getTime()) &&
    !Number.isNaN(this.dashboardCredentialsExpiresAt.getTime()) &&
    this.dashboardCredentialsExpiresAt.getTime() <=
      this.dashboardCredentialsGeneratedAt.getTime()
  ) {
    this.invalidate(
      "dashboardCredentialsExpiresAt",
      "Dashboard credentials expiry must be after generation.",
    );
  }

  if (
    this.dashboardLoginEnabled === true &&
    (
      this.paymentStatus !== "paid" ||
      this.studentOpsApprovalStatus !== "approved" ||
      this.operationsApprovalStatus !== "approved" ||
      this.dashboardCredentialsGenerated !== true ||
      !this.dashboardStudentId
    )
  ) {
    this.invalidate(
      "dashboardLoginEnabled",
      "Dashboard login requires verified payment, Student Operations approval and generated credentials.",
    );
  }

  if (
    this.certificateStatus === "generated" ||
    this.certificateStatus === "verified"
  ) {
    if (!this.certificateId?.trim()) {
      this.invalidate(
        "certificateId",
        "Generated or verified certificates require a certificate ID.",
      );
    }

    if (
      !(this.certificateGeneratedAt instanceof Date) ||
      Number.isNaN(this.certificateGeneratedAt.getTime())
    ) {
      this.invalidate(
        "certificateGeneratedAt",
        "Generated or verified certificates require a valid generation date.",
      );
    }
  }

  if (
    this.certificateStatus === "not-eligible" ||
    this.certificateStatus === "eligible"
  ) {
    if (this.certificateId?.trim()) {
      this.invalidate(
        "certificateId",
        "A certificate ID cannot be assigned before certificate generation.",
      );
    }
  }
});

export type StudentOperationsDocument = InferSchemaType<
  typeof StudentOperationsSchema
>;

const modelRegistry = new WeakMap<
  Connection,
  Model<StudentOperationsDocument>
>();

export async function getStudentOperationsModel(): Promise<
  Model<StudentOperationsDocument>
> {
  const connection = await connectStudentDB();

  if (connection.readyState !== 1 || !connection.db) {
    throw new Error(
      "Student Operations database connection is not ready.",
    );
  }

  const cached = modelRegistry.get(connection);

  if (cached) {
    return cached;
  }

  const existing = connection.models.StudentOperations as
    | Model<StudentOperationsDocument>
    | undefined;

  if (existing) {
    modelRegistry.set(connection, existing);
    return existing;
  }

  const model = connection.model<StudentOperationsDocument>(
    "StudentOperations",
    StudentOperationsSchema,
    COLLECTION_NAME,
  );

  modelRegistry.set(connection, model);

  return model;
}

export const getStudentOperations = getStudentOperationsModel;

export default getStudentOperationsModel;
