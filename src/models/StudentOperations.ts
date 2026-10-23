import type { Connection, Model, InferSchemaType } from "mongoose";
import { Schema } from "mongoose";

import { connectStudentDB } from "@/lib/student-db";

/**
 * CyberNet Careers — Student Operations data model.
 *
 * Database boundary:
 * - This model is registered ONLY on the dedicated Student Operations connection.
 * - Main Careers applications, main assessment results, and verified payment
 *   records remain owned by the Main Careers database.
 * - This collection stores the operational student projection and learning data:
 *   operations approval, enrollment, dashboard access state, daily tasks,
 *   submissions, attendance, weekly assessments, progress and certificate state.
 *
 * Security:
 * - Never store plaintext passwords, payment secrets, or session tokens here.
 * - Dashboard credential hashes are excluded from normal query results.
 * - API/service layers must authorize every read/write and validate transitions.
 */

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
    // Stable link to the canonical student in the Main Careers database.
    mainStudentId: {
      type: String,
      required: [true, "Main student ID is required."],
      trim: true,
      maxlength: [100, "Main student ID cannot exceed 100 characters."],
      index: true,
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

    // Minimal contact/display projection; canonical identity remains in Main DB.
    fullName: {
      type: String,
      required: [true, "Student full name is required."],
      trim: true,
      minlength: [2, "Student full name must contain at least 2 characters."],
      maxlength: [120, "Student full name cannot exceed 120 characters."],
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
    internshipDurationDays: {
      type: Number,
      min: [0, "Internship duration cannot be negative."],
      default: 0,
    },
    internshipStartedAt: nullableDate,
    internshipEndsAt: nullableDate,

    // Student Operations approval is separate from Main Admin approval.
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

    // Dashboard access is a projection controlled by trusted services.
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

    // Idempotency/cross-database reconciliation metadata.
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

    // Learning summary. Detailed tasks/submissions can be split into separate
    // collections later if the operational data volume requires it.
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

    // Daily coding task / submission summary.
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

    // Weekly/Saturday assessment summary.
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

    // Attendance aggregates only; actual attendance events should be recorded
    // in a separate immutable/auditable collection if required.
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

    // Project completion summary.
    projectStatus: {
      type: String,
      enum: ["not-started", "in-progress", "submitted", "approved", "rework"],
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

    // Certificate state is a projection; issuance is performed by a service.
    certificateStatus: {
      type: String,
      enum: ["not-eligible", "eligible", "generated", "revoked"],
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

// One operational projection per canonical Main Careers student.
StudentOperationsSchema.index({ mainStudentId: 1 }, { unique: true });
StudentOperationsSchema.index({ operationsApprovalStatus: 1, createdAt: -1 });
StudentOperationsSchema.index({ operationsStatus: 1, createdAt: -1 });
StudentOperationsSchema.index({ dashboardStatus: 1, dashboardLoginEnabled: 1 });
StudentOperationsSchema.index({ syncStatus: 1, updatedAt: 1 });
StudentOperationsSchema.index({ internshipEndsAt: 1, operationsStatus: 1 });
StudentOperationsSchema.index({ certificateStatus: 1, updatedAt: -1 });

StudentOperationsSchema.pre("validate", function normalizeStudentOperations() {
  this.mainStudentId = this.mainStudentId.trim();

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

  if (typeof this.email === "string") {
    this.email = this.email.trim().toLowerCase();
  }
});

export type StudentOperationsDocument = InferSchemaType<typeof StudentOperationsSchema>;

const modelRegistry = new WeakMap<Connection, Model<StudentOperationsDocument>>();

/**
 * Returns the Student Operations model bound to the dedicated database.
 * Registration is cached per connection and never uses mongoose.model().
 */
export async function getStudentOperationsModel(): Promise<
  Model<StudentOperationsDocument>
> {
  const connection = await connectStudentDB();
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

/**
 * Convenience alias for service code that uses a descriptive model getter.
 */
export const getStudentOperations = getStudentOperationsModel;
