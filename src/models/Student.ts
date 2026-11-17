import mongoose, {
  Schema,
  type InferSchemaType,
  type Model,
} from "mongoose";

export type StudentInternshipPlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";

export const STUDENT_INTERNSHIP_PLANS = {
  ONE_MONTH: { code: "ONE_MONTH", legacyName: "1 month", name: "1 Month", months: 1, days: 30, amount: 499, amountInPaise: 49900 },
  THREE_MONTHS: { code: "THREE_MONTHS", legacyName: "3 months", name: "3 Months", months: 3, days: 90, amount: 999, amountInPaise: 99900 },
  SIX_MONTHS: { code: "SIX_MONTHS", legacyName: "6 months", name: "6 Months", months: 6, days: 180, amount: 1699, amountInPaise: 169900 },
} as const;

export function normalizeStudentInternshipPlan(value: unknown): StudentInternshipPlanCode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[\\s-]+/g, "_");
  if (normalized === "ONE_MONTH" || normalized === "1_MONTH") return "ONE_MONTH";
  if (normalized === "THREE_MONTHS" || normalized === "3_MONTHS") return "THREE_MONTHS";
  if (normalized === "SIX_MONTHS" || normalized === "6_MONTHS") return "SIX_MONTHS";
  return null;
}

const nullableDate = {
  type: Date,
  default: null,
} as const;
const emptyString = {
  type: String,
  trim: true,
  default: "",
} as const;
const percentageField = {
  type: Number,
  min: [0, "Percentage cannot be less than 0."],
  max: [100, "Percentage cannot exceed 100."],
  default: 0,
} as const;
const StudentSchema = new Schema(
  {
    applicationId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [50, "Application ID cannot exceed 50 characters."],
      unique: true,
      sparse: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      minlength: [2, "Full name must contain at least 2 characters."],
      maxlength: [120, "Full name cannot exceed 120 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      trim: true,
      lowercase: true,
      maxlength: [254, "Email cannot exceed 254 characters."],
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address."],
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    emailVerifiedAt: nullableDate,
    phone: {
      type: String,
      required: [true, "Phone number is required."],
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters."],
    },
    dateOfBirth: nullableDate,
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer-not-to-say"],
      default: "prefer-not-to-say",
    },
    fatherName: emptyString,
    motherName: emptyString,
    parentGuardianName: emptyString,
    parentGuardianPhone: emptyString,
    emergencyContact: emptyString,
    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters."],
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, "City cannot exceed 100 characters."],
      default: "",
    },
    state: {
      type: String,
      trim: true,
      maxlength: [100, "State cannot exceed 100 characters."],
      default: "",
    },
    pincode: {
      type: String,
      trim: true,
      maxlength: [10, "Pincode cannot exceed 10 characters."],
      default: "",
    },
    collegeName: {
      type: String,
      required: [true, "College name is required."],
      trim: true,
      maxlength: [200, "College name cannot exceed 200 characters."],
    },
    university: {
      type: String,
      required: [true, "University is required."],
      trim: true,
      maxlength: [200, "University cannot exceed 200 characters."],
    },
    course: {
      type: String,
      required: [true, "Course is required."],
      trim: true,
      maxlength: [120, "Course cannot exceed 120 characters."],
    },
    branchStream: {
      type: String,
      required: [true, "Branch/stream is required."],
      trim: true,
      maxlength: [120, "Branch/stream cannot exceed 120 characters."],
    },
    year: {
      type: String,
      trim: true,
      maxlength: [50, "Year cannot exceed 50 characters."],
      default: "",
    },
    semester: {
      type: String,
      trim: true,
      maxlength: [50, "Semester cannot exceed 50 characters."],
      default: "",
    },
    cgpa: {
      type: String,
      trim: true,
      maxlength: [20, "CGPA cannot exceed 20 characters."],
      default: "",
    },
    backlogStatus: {
      type: String,
      enum: ["none", "active", "cleared", "not-disclosed"],
      default: "not-disclosed",
    },
    linkedinUrl: {
      type: String,
      trim: true,
      maxlength: [500, "LinkedIn URL cannot exceed 500 characters."],
      default: "",
    },
    githubUrl: {
      type: String,
      trim: true,
      maxlength: [500, "GitHub URL cannot exceed 500 characters."],
      default: "",
    },
    portfolioUrl: {
      type: String,
      trim: true,
      maxlength: [500, "Portfolio URL cannot exceed 500 characters."],
      default: "",
    },
    resumeUrl: {
      type: String,
      trim: true,
      maxlength: [1000, "Resume URL cannot exceed 1000 characters."],
      default: "",
    },
    collegeIdUrl: {
      type: String,
      trim: true,
      maxlength: [1000, "College ID URL cannot exceed 1000 characters."],
      default: "",
    },
    photoUrl: {
      type: String,
      trim: true,
      maxlength: [1000, "Photo URL cannot exceed 1000 characters."],
      default: "",
    },
    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [50, "Student ID cannot exceed 50 characters."],
      unique: true,
      sparse: true,
    },
    loginPasswordHash: {
      type: String,
      default: "",
      select: false,
      maxlength: [255, "Password hash cannot exceed 255 characters."],
    },
    credentialsGenerated: {
      type: Boolean,
      default: false,
      index: true,
    },
    credentialsGeneratedAt: nullableDate,
    credentialsExpiresAt: nullableDate,
    loginEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    loginEnabledAt: nullableDate,
    lastLoginAt: nullableDate,
    loginAttempts: {
      type: Number,
      default: 0,
      min: [0, "Login attempts cannot be negative."],
    },
    accountLocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    lockedUntil: nullableDate,
    passwordChangedAt: nullableDate,
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    journeyStartedAt: nullableDate,
    journeyExpiresAt: nullableDate,
    journeyExpired: {
      type: Boolean,
      default: false,
      index: true,
    },
    applicationStatus: {
      type: String,
      enum: ["draft", "submitted", "pending", "approved", "rejected", "expired"],
      default: "draft",
      index: true,
    },
    submittedAt: nullableDate,
    batchName: {
      type: String,
      trim: true,
      maxlength: [120, "Batch name cannot exceed 120 characters."],
      default: "",
    },
    batchDate: nullableDate,
    adminApprovalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    adminApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    adminApprovedAt: nullableDate,
    adminReviewedAt: nullableDate,
    adminRejectionReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Rejection reason cannot exceed 1000 characters."],
      default: "",
    },
    applicationApprovalEmailSent: {
      type: Boolean,
      default: false,
    },
    applicationApprovalEmailSentAt: nullableDate,
    assessmentStatus: {
      type: String,
      enum: [
        "not-started",
        "scheduled",
        "in-progress",
        "submitted",
        "evaluated",
        "passed",
        "failed",
      ],
      default: "not-started",
      index: true,
    },
    assessmentScore: {
      type: Number,
      default: null,
      min: [0, "Assessment score cannot be negative."],
      max: [100, "Assessment score cannot exceed 100."],
    },

    assessmentPassingScore: {
      type: Number,
      default: 40,
      min: [0, "Assessment passing score cannot be negative."],
      max: [100, "Assessment passing score cannot exceed 100."],
    },
    assessmentAttemptCount: {
      type: Number,
      default: 0,
      min: [0, "Assessment attempt count cannot be negative."],
    },
    assessmentStartedAt: nullableDate,
    assessmentSubmittedAt: nullableDate,
    assessmentEvaluatedAt: nullableDate,
    resultDeclaredAt: nullableDate,
    resultVisibleAt: nullableDate,
    resultStatus: {
      type: String,
      enum: ["pending", "passed", "failed"],
      default: "pending",
      index: true,
    },
    internshipApplicationAllowed: {
      type: Boolean,
      default: false,
      index: true,
    },
    internshipTrack: {
      type: String,
      trim: true,
      maxlength: [150, "Internship track cannot exceed 150 characters."],
      default: "",
    },
    skills: {
      type: [String],
      default: [],
    },
    internshipPlan: {
      type: String,
      enum: ["", "1 month", "3 months", "6 months", "1 Month", "3 Months", "6 Months"],
      default: "",
      trim: true,
    },
    internshipPlanCode: {
      type: String,
      enum: ["", "ONE_MONTH", "THREE_MONTHS", "SIX_MONTHS"],
      default: "",
      index: true,
    },
    internshipDurationMonths: {
      type: Number,
      default: 0,
      min: [0, "Internship duration in months cannot be negative."],
      max: [120, "Internship duration in months is too large."],
    },
    internshipDurationDays: {
      type: Number,
      default: 0,
      min: [0, "Internship duration cannot be negative."],
      max: [366, "Internship duration cannot exceed 366 days."],
      validate: {
        validator: Number.isInteger,
        message: "Internship duration must be a whole number of days.",
      },
    },
    internshipSelectionAt: nullableDate,
    internshipSelectionWindowStartedAt: nullableDate,
    internshipSelectionDeadlineAt: nullableDate,
    internshipSelectionExpiredAt: nullableDate,
    internshipSelectionWindowExpired: {
      type: Boolean,
      default: false,
      index: true,
    },
    internshipStatus: {
      type: String,
      enum: [
        "locked",
        "available",
        "selected",
        "payment-pending",
        "payment-completed",
        "approved",
        "rejected",
        "active",
        "completed",
        "expired",
      ],
      default: "locked",
      index: true,
    },
    startPreference: {
      type: String,
      trim: true,
      maxlength: [100, "Start preference cannot exceed 100 characters."],
      default: "",
    },
    internshipStartedAt: nullableDate,
    internshipEndsAt: nullableDate,
    internshipActivatedAt: nullableDate,
    internshipApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    internshipCompletedAt: nullableDate,
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "refunded"],
      default: "unpaid",
      index: true,
    },
    paymentAmount: {
      type: Number,
      default: 0,
      min: [0, "Payment amount cannot be negative."],
    },
    paymentCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [3, "Currency must be a three-letter code."],
      default: "INR",
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    paymentAttemptGroupId: {
      type: String,
      trim: true,
      default: "",
      maxlength: [120, "Payment attempt group ID cannot exceed 120 characters."],
      index: true,
    },
    razorpayCheckoutExpiresAt: nullableDate,
    paymentExpiredAt: nullableDate,
    paymentVerificationSource: {
      type: String,
      enum: ["", "razorpay_checkout", "razorpay_webhook", "admin_reconciliation", "legacy"],
      default: "",
    },
    razorpaySignature: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
    paymentCompletedAt: nullableDate,
    paymentVerifiedAt: nullableDate,
    paymentFailedAt: nullableDate,
    paymentRefundedAt: nullableDate,
    receiptEmailSent: {
      type: Boolean,
      default: false,
    },
    receiptEmailSentAt: nullableDate,
    studentOpsApprovalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    studentOpsApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    studentOpsApprovedAt: nullableDate,
    studentOpsRejectionReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Student Operations rejection reason cannot exceed 1000 characters."],
      default: "",
    },
    studentOpsReviewedAt: nullableDate,
    studentOpsStatus: {
      type: String,
      enum: [
        "not-ready",
        "payment-pending",
        "pending-review",
        "approved",
        "active",
        "suspended",
        "completed",
        "expired",
      ],
      default: "not-ready",
      index: true,
    },
    studentOpsActivatedAt: nullableDate,
    studentOpsSuspendedAt: nullableDate,
    studentOpsSuspensionReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Student Operations suspension reason cannot exceed 1000 characters."],
      default: "",
    },
    studentOpsCompletedAt: nullableDate,
    dashboardStudentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [60, "Dashboard student ID cannot exceed 60 characters."],
      unique: true,
      sparse: true,
    },
    dashboardPasswordHash: {
      type: String,
      default: "",
      select: false,
      maxlength: [255, "Dashboard password hash cannot exceed 255 characters."],
    },
    dashboardCredentialsGenerated: {
      type: Boolean,
      default: false,
      index: true,
    },
    dashboardCredentialsGeneratedAt: nullableDate,
    dashboardCredentialsExpiresAt: nullableDate,
    dashboardLoginEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    dashboardLoginEnabledAt: nullableDate,
    dashboardLastLoginAt: nullableDate,
    dashboardPasswordChangedAt: nullableDate,
    dashboardMustChangePassword: {
      type: Boolean,
      default: true,
    },
    dashboardLoginAttempts: {
      type: Number,
      default: 0,
      min: [0, "Dashboard login attempts cannot be negative."],
    },
    dashboardAccountLocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    dashboardLockedUntil: nullableDate,
    dashboardStatus: {
      type: String,
      enum: ["locked", "pending", "active", "suspended", "completed"],
      default: "locked",
      index: true,
    },
    dashboardActivatedAt: nullableDate,
    dashboardDeactivatedAt: nullableDate,
    dashboardDeactivationReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Dashboard deactivation reason cannot exceed 1000 characters."],
      default: "",
    },
    dashboardCredentialsEmailSent: {
      type: Boolean,
      default: false,
    },
    dashboardCredentialsEmailSentAt: nullableDate,
    learningStatus: {
      type: String,
      enum: ["not-started", "active", "paused", "completed"],
      default: "not-started",
    },
    currentLearningDay: {
      type: Number,
      default: 0,
      min: [0, "Current learning day cannot be negative."],
    },
    totalLearningDays: {
      type: Number,
      default: 0,
      min: [0, "Total learning days cannot be negative."],
    },
    dailyCodingProblemsCompleted: {
      type: Number,
      default: 0,
      min: [0, "Daily coding problems completed cannot be negative."],
    },
    dailyTasksCompleted: {
      type: Number,
      default: 0,
      min: [0, "Daily tasks completed cannot be negative."],
    },
    completedLearningDays: {
      type: Number,
      default: 0,
      min: [0, "Completed learning days cannot be negative."],
    },
    taskCompletionPercentage: percentageField,
    currentTaskId: {
      type: String,
      trim: true,
      maxlength: [100, "Current task ID cannot exceed 100 characters."],
      default: "",
    },
    lastTaskAssignedAt: nullableDate,
    lastTaskSubmittedAt: nullableDate,
    totalTasksAssigned: {
      type: Number,
      default: 0,
      min: [0, "Assigned task count cannot be negative."],
    },
    totalTasksSubmitted: {
      type: Number,
      default: 0,
      min: [0, "Submitted task count cannot be negative."],
    },
    totalTasksApproved: {
      type: Number,
      default: 0,
      min: [0, "Approved task count cannot be negative."],
    },
    attendanceDaysPresent: {
      type: Number,
      default: 0,
      min: [0, "Present days cannot be negative."],
    },
    attendanceDaysAbsent: {
      type: Number,
      default: 0,
      min: [0, "Absent days cannot be negative."],
    },
    lastAttendanceAt: nullableDate,
    projectFolderReference: {
      type: String,
      trim: true,
      maxlength: [500, "Project folder reference cannot exceed 500 characters."],
      default: "",
    },
    currentProjectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    currentProjectName: {
      type: String,
      trim: true,
      maxlength: [200, "Current project name cannot exceed 200 characters."],
      default: "",
    },
    projectStartedAt: nullableDate,
    projectCompletedAt: nullableDate,
    projectSubmittedAt: nullableDate,
    projectReviewedAt: nullableDate,
    projectReviewNotes: {
      type: String,
      trim: true,
      maxlength: [2000, "Project review notes cannot exceed 2000 characters."],
      default: "",
    },
    weeklyAssessmentSubmittedAt: nullableDate,
    saturdayAssessmentSubmittedAt: nullableDate,
    lastWeeklyAssessmentAt: nullableDate,
    lastSaturdayAssessmentAt: nullableDate,
    weeklyAssessmentCount: {
      type: Number,
      default: 0,
      min: [0, "Weekly assessment count cannot be negative."],
    },
    projectStatus: {
      type: String,
      enum: ["not-started", "in-progress", "submitted", "under-review", "completed", "rejected"],
      default: "not-started",
      index: true,
    },
    projectCompletionPercentage: percentageField,
    learningProgressPercentage: percentageField,
    attendancePercentage: percentageField,
    weeklyAssessmentStatus: {
      type: String,
      enum: ["locked", "available", "in-progress", "submitted", "passed", "failed"],
      default: "locked",
    },
    saturdayAssessmentStatus: {
      type: String,
      enum: ["locked", "available", "in-progress", "submitted", "passed", "failed"],
      default: "locked",
    },
    weeklyAssessmentScore: {
      type: Number,
      default: null,
      min: [0, "Weekly assessment score cannot be negative."],
      max: [100, "Weekly assessment score cannot exceed 100."],
    },
    saturdayAssessmentScore: {
      type: Number,
      default: null,
      min: [0, "Saturday assessment score cannot be negative."],
      max: [100, "Saturday assessment score cannot exceed 100."],
    },
    certificateStatus: {
      type: String,
      enum: ["not-eligible", "eligible", "generated", "verified"],
      default: "not-eligible",
      index: true,
    },
    certificateId: {
      type: String,
      trim: true,
      maxlength: [100, "Certificate ID cannot exceed 100 characters."],
      default: "",
    },
    certificateGeneratedAt: nullableDate,
    whatsappJoined: {
      type: Boolean,
      default: false,
    },
    lastNotificationAt: nullableDate,
    consentTerms: {
      type: Boolean,
      default: false,
    },
    consentPrivacy: {
      type: Boolean,
      default: false,
    },
    consentDeclaration: {
      type: Boolean,
      default: false,
    },
    consentUpdates: {
      type: Boolean,
      default: false,
    },
    consentAcceptedAt: nullableDate,
    notes: {
      type: String,
      trim: true,
      maxlength: [3000, "Notes cannot exceed 3000 characters."],
      default: "",
    },
    approvedAt: nullableDate,
    operationsSyncStatus: {
      type: String,
      enum: ["not-required", "pending", "synced", "failed"],
      default: "not-required",
      index: true,
    },
    operationsStudentRef: {
      type: String,
      trim: true,
      maxlength: [100, "Operations student reference cannot exceed 100 characters."],
      default: "",
    },
    operationsLastSyncedAt: nullableDate,
    operationsSyncError: {
      type: String,
      trim: true,
      maxlength: [500, "Operations sync error cannot exceed 500 characters."],
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "students",
    strict: true,
    versionKey: false,
    minimize: true,
    autoIndex: process.env.NODE_ENV !== "production",
    toJSON: {
      transform: (_document, result) => {
        Reflect.deleteProperty(result, "loginPasswordHash");
        Reflect.deleteProperty(result, "dashboardPasswordHash");
        Reflect.deleteProperty(result, "razorpaySignature");
        return result;
      },
    },
    toObject: {
      transform: (_document, result) => {
        Reflect.deleteProperty(result, "loginPasswordHash");
        Reflect.deleteProperty(result, "dashboardPasswordHash");
        Reflect.deleteProperty(result, "razorpaySignature");
        return result;
      },
    },
  },
);
StudentSchema.index({ applicationStatus: 1, createdAt: -1 });
StudentSchema.index({ adminApprovalStatus: 1, createdAt: -1 });
StudentSchema.index({ adminApprovalStatus: 1, assessmentStatus: 1 });
StudentSchema.index({ assessmentStatus: 1, resultStatus: 1 });
StudentSchema.index({ studentId: 1, loginEnabled: 1 });
StudentSchema.index({ email: 1, loginEnabled: 1 });
StudentSchema.index({ accountLocked: 1, lockedUntil: 1 });
StudentSchema.index({ credentialsExpiresAt: 1, loginEnabled: 1 });
StudentSchema.index({ internshipStatus: 1, internshipPlan: 1 });
StudentSchema.index({ internshipPlanCode: 1, paymentStatus: 1, updatedAt: -1 });
StudentSchema.index({ paymentAttemptGroupId: 1, updatedAt: -1 });
StudentSchema.index({ razorpayCheckoutExpiresAt: 1, paymentStatus: 1 });
StudentSchema.index({ paymentStatus: 1, paymentCompletedAt: -1 });
StudentSchema.index({
    paymentStatus: 1,
    adminApprovalStatus: 1,
    studentOpsApprovalStatus: 1,
});
StudentSchema.index({
    studentOpsApprovalStatus: 1,
    paymentStatus: 1,
    createdAt: -1,
});
StudentSchema.index({ studentOpsStatus: 1, createdAt: -1 });
StudentSchema.index({ dashboardStatus: 1, dashboardLoginEnabled: 1 });
StudentSchema.index({ dashboardLoginEnabled: 1, dashboardCredentialsExpiresAt: 1 });
StudentSchema.index({ internshipStatus: 1, internshipEndsAt: 1 });
StudentSchema.index({ dashboardAccountLocked: 1, dashboardLockedUntil: 1 });
StudentSchema.index({ learningStatus: 1, internshipStatus: 1 });
StudentSchema.index({ projectStatus: 1, projectCompletionPercentage: -1 });
StudentSchema.index({ weeklyAssessmentStatus: 1 });
StudentSchema.index({ saturdayAssessmentStatus: 1 });
StudentSchema.index({ journeyExpiresAt: 1, journeyExpired: 1 });
StudentSchema.index({
    internshipSelectionWindowExpired: 1,
    paymentStatus: 1,
    internshipSelectionDeadlineAt: 1,
});
StudentSchema.index({ certificateStatus: 1, internshipStatus: 1 });
StudentSchema.index({ operationsSyncStatus: 1, updatedAt: 1 });
StudentSchema.index({ credentialsGenerated: 1, credentialsExpiresAt: 1 });
StudentSchema.index({ assessmentStatus: 1, internshipApplicationAllowed: 1 });
StudentSchema.index({ internshipStatus: 1, paymentStatus: 1, updatedAt: -1 });
StudentSchema.index({
  adminApprovalStatus: 1,
  assessmentStatus: 1,
  internshipApplicationAllowed: 1,
  internshipSelectionDeadlineAt: 1,
});
StudentSchema.index({ dashboardStatus: 1, studentOpsStatus: 1, updatedAt: -1 });
StudentSchema.index(
  { certificateId: 1 },
  { unique: true, partialFilterExpression: { certificateId: { $gt: "" } } },
);
StudentSchema.pre("validate", function normalizeStudentData() {
  if (typeof this.email === "string") {
    this.email = this.email.trim().toLowerCase();
  }

  if (typeof this.studentId === "string") {
    this.studentId = this.studentId.trim().toUpperCase();
  }

  if (typeof this.dashboardStudentId === "string") {
    this.dashboardStudentId = this.dashboardStudentId.trim().toUpperCase();
  }

  if (typeof this.applicationId === "string") {
    this.applicationId = this.applicationId.trim().toUpperCase();
  }

  if (typeof this.phone === "string") {
    this.phone = this.phone.trim().replace(/\s+/g, "");
  }

  if (typeof this.paymentCurrency === "string") {
    this.paymentCurrency = this.paymentCurrency.trim().toUpperCase();
  }

  const selectedPlanCode =
    normalizeStudentInternshipPlan(this.internshipPlanCode) ??
    normalizeStudentInternshipPlan(this.internshipPlan);

  if (selectedPlanCode) {
    const plan = STUDENT_INTERNSHIP_PLANS[selectedPlanCode];
    this.internshipPlanCode = plan.code;
    this.internshipPlan = plan.legacyName;
    this.internshipDurationMonths = plan.months;
    this.internshipDurationDays = plan.days;

    if (this.paymentAmount > 0 && this.paymentAmount !== plan.amount) {
      this.invalidate("paymentAmount", "Payment amount does not match the selected internship plan.");
    }

    if (this.paymentCurrency && this.paymentCurrency !== "INR") {
      this.invalidate("paymentCurrency", "Internship plan payments must use INR.");
    }
  } else if (this.internshipPlanCode || this.internshipPlan) {
    this.invalidate("internshipPlanCode", "Select a valid internship plan.");
  }

  if (this.paymentStatus === "paid") {
    if (!this.paymentCompletedAt) this.paymentCompletedAt = new Date();
    if (!this.paymentVerifiedAt) this.paymentVerifiedAt = this.paymentCompletedAt;
    if (this.internshipPlanCode && !this.razorpayOrderId) {
      this.invalidate("razorpayOrderId", "A paid internship record must include a Razorpay order ID.");
    }
    if (this.internshipPlanCode && !this.razorpayPaymentId) {
      this.invalidate("razorpayPaymentId", "A paid internship record must include a Razorpay payment ID.");
    }
  }

  if (this.paymentStatus === "pending" && this.paymentAmount <= 0 && this.internshipPlanCode) {
    this.invalidate("paymentAmount", "A pending selected plan must have a valid payment amount.");
  }

  if (this.internshipSelectionDeadlineAt && this.internshipSelectionWindowStartedAt) {
    if (this.internshipSelectionDeadlineAt.getTime() < this.internshipSelectionWindowStartedAt.getTime()) {
      this.invalidate("internshipSelectionDeadlineAt", "Selection deadline cannot be earlier than its start time.");
    }
  }

  if (this.internshipSelectionWindowExpired && !this.internshipSelectionExpiredAt) {
    this.internshipSelectionExpiredAt = new Date();
  }

  if (typeof this.fullName === "string") {
    this.fullName = this.fullName.trim().replace(/\s+/g, " ");
  }

  if (Array.isArray(this.skills)) {
    this.skills = [...new Set(
      this.skills
        .filter((skill): skill is string => typeof skill === "string")
        .map((skill) => skill.trim().slice(0, 100))
        .filter(Boolean),
    )].slice(0, 100);
  }

  if (typeof this.internshipTrack === "string") {
    this.internshipTrack = this.internshipTrack.trim();
  }

  if (typeof this.currentTaskId === "string") {
    this.currentTaskId = this.currentTaskId.trim();
  }

  if (typeof this.projectFolderReference === "string") {
    this.projectFolderReference = this.projectFolderReference.trim();
  }

  if (typeof this.projectReviewNotes === "string") {
    this.projectReviewNotes = this.projectReviewNotes.trim();
  }

  if (typeof this.razorpayOrderId === "string") {
    this.razorpayOrderId = this.razorpayOrderId.trim();
  }

  if (typeof this.razorpayPaymentId === "string") {
    this.razorpayPaymentId = this.razorpayPaymentId.trim();
  }

  if (typeof this.dashboardDeactivationReason === "string") {
    this.dashboardDeactivationReason = this.dashboardDeactivationReason.trim();
  }

  if (typeof this.studentOpsRejectionReason === "string") {
    this.studentOpsRejectionReason = this.studentOpsRejectionReason.trim();
  }

  if (typeof this.operationsSyncError === "string") {
    this.operationsSyncError = this.operationsSyncError.trim().slice(0, 500);
  }
});

export type StudentDocument = InferSchemaType<typeof StudentSchema>;
export { StudentSchema };
const existingStudentModel = mongoose.models.Student as
| Model<StudentDocument>
| undefined;
const StudentModel: Model<StudentDocument> =
existingStudentModel ?? mongoose.model<StudentDocument>("Student", StudentSchema);
export default StudentModel;
