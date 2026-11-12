
import type { Connection, Model, InferSchemaType } from "mongoose";
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

const StudentOperationsSchema = new Schema(
  {
    mainStudentId: {
      type: String,
      required: [true, "Main database student ID is required."],
      trim: true,
      minlength: [1, "Main database student ID cannot be empty."],
      maxlength: [100, "Main student ID cannot exceed 100 characters."],
    },
    applicationId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [50, "Application ID cannot exceed 50 characters."],
      default: "",
      index: true,
    },
    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [50, "Student ID cannot exceed 50 characters."],
      default: "",
      index: true,
    },
    dashboardStudentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [60, "Dashboard student ID cannot exceed 60 characters."],
      default: "",
    },
    fullName: {
      type: String,
      required: [true, "Student full name is required."],
      trim: true,
      minlength: [2, "Student full name must contain at least 2 characters."],
      maxlength: [120, "Student full name cannot exceed 120 characters."],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [30, "Phone number cannot exceed 30 characters."],
      default: "",
    },
    email: {
      type: String,
      required: [true, "Student email is required."],
      trim: true,
      lowercase: true,
      maxlength: [254, "Student email cannot exceed 254 characters."],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address."],
    },
    internshipTrack: {
      type: String,
      trim: true,
      maxlength: [150, "Internship track cannot exceed 150 characters."],
      default: "",
    },
    internshipPlan: {
      type: String,
      enum: ["", "1 month", "3 months", "6 months"],
      default: "",
    },
    internshipDurationMonths: {
      type: Number,
      min: [0, "Internship duration cannot be negative."],
      max: [36, "Internship duration cannot exceed 36 months."],
      default: 0,
    },
    internshipDurationDays: {
      type: Number,
      min: [0, "Internship duration cannot be negative."],
      max: [3650, "Internship duration cannot exceed 3650 days."],
      default: 0,
    },
    internshipStartedAt: nullableDate,
    internshipEndsAt: nullableDate,
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed", "refunded"],
      default: "unpaid",
      index: true,
    },
    paymentAmount: {
      type: Number,
      min: [0, "Payment amount cannot be negative."],
      default: 0,
    },
    paymentCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [3, "Payment currency must be a three-letter code."],
      default: "INR",
    },
    studentOpsApprovalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
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
    operationsApprovalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    operationsApprovedBy: {
      type: String,
      trim: true,
      maxlength: [100, "Approver ID cannot exceed 100 characters."],
      default: "",
    },
    operationsApprovedAt: nullableDate,
    operationsReviewedAt: nullableDate,
    operationsRejectionReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Rejection reason cannot exceed 1000 characters."],
      default: "",
    },
    operationsStatus: {
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
      default: "pending-review",
      index: true,
    },
    dashboardStatus: {
      type: String,
      enum: ["locked", "pending", "active", "suspended", "completed"],
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
      maxlength: [60, "Normalized dashboard ID cannot exceed 60 characters."],
      default: "",
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
      default: 0,
      min: [0, "Login attempts cannot be negative."],
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
      maxlength: [1000, "Deactivation reason cannot exceed 1000 characters."],
      default: "",
    },
    sourceVersion: {
      type: Number,
      default: 1,
      min: [1, "Source version must be at least 1."],
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
      maxlength: [500, "Sync error cannot exceed 500 characters."],
      default: "",
    },
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
    completedLearningDays: {
      type: Number,
      default: 0,
      min: [0, "Completed learning days cannot be negative."],
    },
    taskCompletionPercentage: boundedPercentage,
    learningProgressPercentage: boundedPercentage,
    attendancePercentage: boundedPercentage,
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
    weeklyAssessmentStatus: {
      type: String,
      enum: ["locked", "available", "in-progress", "submitted", "passed", "failed"],
      default: "locked",
    },
    weeklyAssessmentScore: {
      type: Number,
      default: null,
      min: [0, "Assessment score cannot be negative."],
      max: [100, "Assessment score cannot exceed 100."],
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
      min: [0, "Assessment score cannot be negative."],
      max: [100, "Assessment score cannot exceed 100."],
    },
    saturdayAssessmentSubmittedAt: nullableDate,
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
      maxlength: [500, "Project reference cannot exceed 500 characters."],
      default: "",
    },
    projectSubmittedAt: nullableDate,
    projectReviewedAt: nullableDate,
    projectReviewNotes: {
      type: String,
      trim: true,
      maxlength: [2000, "Project review notes cannot exceed 2000 characters."],
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
      maxlength: [100, "Certificate ID cannot exceed 100 characters."],
      default: "",
    },
    certificateGeneratedAt: nullableDate,
    notes: {
      type: String,
      trim: true,
      maxlength: [3000, "Notes cannot exceed 3000 characters."],
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

  if (typeof this.internshipPlan === "string") {
    this.internshipPlan = this.internshipPlan.trim() as typeof this.internshipPlan;
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
    throw new Error("Student Operations database connection is not ready.");
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
