
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { connectStudentDB } from "@/lib/student-db";

export const CODING_ATTENDANCE_STATUSES = [
  "pending",
  "present",
  "late",
  "absent",
  "excused",
] as const;

export const CODING_ATTENDANCE_SOURCES = [
  "coding-submission",
  "dashboard-activity",
  "admin",
  "system",
] as const;

export type CodingAttendanceStatus =
  (typeof CODING_ATTENDANCE_STATUSES)[number];

export type CodingAttendanceSource =
  (typeof CODING_ATTENDANCE_SOURCES)[number];

const COLLECTION_NAME = "coding_attendance";

const MAX_ID_LENGTH = 100;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_TIMEZONE_LENGTH = 64;
const MAX_NOTE_LENGTH = 2000;
const MAX_DAILY_MINUTES = 1440;
const MAX_DAILY_SUBMISSIONS = 10000;
const MAX_DAILY_QUESTIONS = 365;

const codingAttendanceSchema = new Schema(
  {
    studentOperationsId: {
      type: String,
      required: [true, "Student Operations ID is required."],
      trim: true,
      maxlength: [
        MAX_ID_LENGTH,
        "Student Operations ID cannot exceed 100 characters.",
      ],
    },

    mainStudentId: {
      type: String,
      required: [true, "Main Student ID is required."],
      trim: true,
      maxlength: [
        MAX_ID_LENGTH,
        "Main Student ID cannot exceed 100 characters.",
      ],
    },

    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [
        MAX_ID_LENGTH,
        "Student ID cannot exceed 100 characters.",
      ],
      default: "",
    },

    dashboardStudentId: {
      type: String,
      required: [true, "Dashboard Student ID is required."],
      trim: true,
      uppercase: true,
      maxlength: [
        MAX_ID_LENGTH,
        "Dashboard Student ID cannot exceed 100 characters.",
      ],
    },

    studentName: {
      type: String,
      required: [true, "Student name is required."],
      trim: true,
      maxlength: [
        MAX_NAME_LENGTH,
        "Student name cannot exceed 120 characters.",
      ],
    },

    studentEmail: {
      type: String,
      required: [true, "Student email is required."],
      trim: true,
      lowercase: true,
      maxlength: [
        MAX_EMAIL_LENGTH,
        "Student email cannot exceed 254 characters.",
      ],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid student email.",
      ],
    },

    track: {
      type: String,
      required: [true, "Internship track is required."],
      trim: true,
      maxlength: [
        150,
        "Internship track cannot exceed 150 characters.",
      ],
    },

    attendanceDateKey: {
      type: String,
      required: [true, "Attendance date key is required."],
      trim: true,
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        "Attendance date must use YYYY-MM-DD format.",
      ],
    },

    attendanceDate: {
      type: Date,
      required: [true, "Attendance date timestamp is required."],
    },

    timezone: {
      type: String,
      required: true,
      trim: true,
      maxlength: [
        MAX_TIMEZONE_LENGTH,
        "Timezone cannot exceed 64 characters.",
      ],
      default: "Asia/Kolkata",
    },

    status: {
      type: String,
      enum: {
        values: CODING_ATTENDANCE_STATUSES,
        message: "Choose a valid attendance status.",
      },
      required: true,
      default: "pending",
      index: true,
    },

    source: {
      type: String,
      enum: {
        values: CODING_ATTENDANCE_SOURCES,
        message: "Choose a valid attendance source.",
      },
      required: true,
      default: "system",
    },

    firstActivityAt: {
      type: Date,
      default: null,
    },

    checkInAt: {
      type: Date,
      default: null,
    },

    lastActivityAt: {
      type: Date,
      default: null,
    },

    checkOutAt: {
      type: Date,
      default: null,
    },

    totalActiveMinutes: {
      type: Number,
      min: [0, "Active minutes cannot be negative."],
      max: [
        MAX_DAILY_MINUTES,
        "Active minutes cannot exceed 1440.",
      ],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Active minutes must be a whole number.",
      },
    },

    totalSubmissions: {
      type: Number,
      min: [0, "Submission count cannot be negative."],
      max: [
        MAX_DAILY_SUBMISSIONS,
        "Submission count is too large.",
      ],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Submission count must be a whole number.",
      },
    },

    questionsAttempted: {
      type: Number,
      min: [0, "Attempted question count cannot be negative."],
      max: [
        MAX_DAILY_QUESTIONS,
        "Attempted question count is too large.",
      ],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Attempted question count must be a whole number.",
      },
    },

    questionsAccepted: {
      type: Number,
      min: [0, "Accepted question count cannot be negative."],
      max: [
        MAX_DAILY_QUESTIONS,
        "Accepted question count is too large.",
      ],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Accepted question count must be a whole number.",
      },
    },

    dailyQuestionGoal: {
      type: Number,
      min: [1, "Daily question goal must be at least 1."],
      max: [
        MAX_DAILY_QUESTIONS,
        "Daily question goal cannot exceed 365.",
      ],
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Daily question goal must be a whole number.",
      },
    },

    dailyGoalCompleted: {
      type: Boolean,
      default: false,
    },

    firstQuestionId: {
      type: Schema.Types.ObjectId,
      ref: "CodingQuestion",
      default: null,
    },

    lastQuestionId: {
      type: Schema.Types.ObjectId,
      ref: "CodingQuestion",
      default: null,
    },

    lastSubmissionId: {
      type: String,
      trim: true,
      maxlength: [
        100,
        "Submission ID cannot exceed 100 characters.",
      ],
      default: "",
    },

    lastSubmissionObjectId: {
      type: Schema.Types.ObjectId,
      ref: "CodingSubmission",
      default: null,
    },

    attendanceMarkedAt: {
      type: Date,
      default: null,
    },

    attendanceMarkedBy: {
      type: String,
      trim: true,
      maxlength: [
        MAX_ID_LENGTH,
        "Attendance actor ID cannot exceed 100 characters.",
      ],
      default: "",
    },

    adminOverride: {
      type: Boolean,
      default: false,
    },

    adminOverrideReason: {
      type: String,
      trim: true,
      maxlength: [
        MAX_NOTE_LENGTH,
        "Override reason cannot exceed 2000 characters.",
      ],
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [
        MAX_NOTE_LENGTH,
        "Attendance notes cannot exceed 2000 characters.",
      ],
      default: "",
    },

    createdBy: {
      type: String,
      trim: true,
      maxlength: [
        MAX_ID_LENGTH,
        "Creator ID cannot exceed 100 characters.",
      ],
      default: "",
    },

    updatedBy: {
      type: String,
      trim: true,
      maxlength: [
        MAX_ID_LENGTH,
        "Updater ID cannot exceed 100 characters.",
      ],
      default: "",
    },

    version: {
      type: Number,
      min: [1, "Version must be at least 1."],
      max: [1000000, "Version is too large."],
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Version must be a whole number.",
      },
    },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
    strict: "throw",
    versionKey: false,
    minimize: true,
    optimisticConcurrency: true,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

codingAttendanceSchema.index(
  {
    studentOperationsId: 1,
    attendanceDateKey: 1,
  },
  {
    name: "uniq_student_daily_coding_attendance",
    unique: true,
  },
);

codingAttendanceSchema.index(
  {
    mainStudentId: 1,
    attendanceDate: -1,
  },
  {
    name: "coding_attendance_student_history",
  },
);

codingAttendanceSchema.index(
  {
    dashboardStudentId: 1,
    attendanceDateKey: -1,
  },
  {
    name: "coding_attendance_dashboard_history",
  },
);

codingAttendanceSchema.index(
  {
    status: 1,
    attendanceDate: -1,
  },
  {
    name: "coding_attendance_status_date",
  },
);

codingAttendanceSchema.index(
  {
    track: 1,
    attendanceDate: -1,
    status: 1,
  },
  {
    name: "coding_attendance_track_analytics",
  },
);

codingAttendanceSchema.index(
  {
    attendanceDateKey: 1,
    status: 1,
  },
  {
    name: "coding_attendance_daily_analytics",
  },
);

codingAttendanceSchema.index(
  {
    lastActivityAt: -1,
  },
  {
    name: "coding_attendance_latest_activity",
  },
);

codingAttendanceSchema.index(
  {
    lastSubmissionId: 1,
  },
  {
    name: "coding_attendance_submission_lookup",
    partialFilterExpression: {
      lastSubmissionId: {
        $type: "string",
        $gt: "",
      },
    },
  },
);

codingAttendanceSchema.pre(
  "validate",
  function validateCodingAttendance() {
    if (typeof this.studentOperationsId === "string") {
      this.studentOperationsId = this.studentOperationsId.trim();
    }

    if (typeof this.mainStudentId === "string") {
      this.mainStudentId = this.mainStudentId.trim();
    }

    if (typeof this.studentId === "string") {
      this.studentId = this.studentId.trim().toUpperCase();
    }

    if (typeof this.dashboardStudentId === "string") {
      this.dashboardStudentId = this.dashboardStudentId
        .trim()
        .toUpperCase();
    }

    if (typeof this.studentName === "string") {
      this.studentName = this.studentName.replace(/\s+/g, " ").trim();
    }

    if (typeof this.studentEmail === "string") {
      this.studentEmail = this.studentEmail.trim().toLowerCase();
    }

    if (typeof this.track === "string") {
      this.track = this.track.replace(/\s+/g, " ").trim();
    }

    if (
      this.firstActivityAt &&
      this.lastActivityAt &&
      this.lastActivityAt < this.firstActivityAt
    ) {
      this.invalidate(
        "lastActivityAt",
        "Last activity cannot be earlier than first activity.",
      );
    }

    if (
      this.checkInAt &&
      this.checkOutAt &&
      this.checkOutAt < this.checkInAt
    ) {
      this.invalidate(
        "checkOutAt",
        "Check-out cannot be earlier than check-in.",
      );
    }

    if (
      Number.isInteger(this.questionsAccepted) &&
      Number.isInteger(this.questionsAttempted) &&
      this.questionsAccepted > this.questionsAttempted
    ) {
      this.invalidate(
        "questionsAccepted",
        "Accepted questions cannot exceed attempted questions.",
      );
    }

    if (
      Number.isInteger(this.questionsAccepted) &&
      Number.isInteger(this.dailyQuestionGoal)
    ) {
      const goalReached =
        this.questionsAccepted >= this.dailyQuestionGoal;

      if (this.dailyGoalCompleted !== goalReached) {
        this.dailyGoalCompleted = goalReached;
      }
    }

    if (
      this.adminOverride &&
      !this.adminOverrideReason?.trim()
    ) {
      this.invalidate(
        "adminOverrideReason",
        "An admin override requires a reason.",
      );
    }

    if (
      this.status !== "pending" &&
      !this.attendanceMarkedAt
    ) {
      this.attendanceMarkedAt = new Date();
    }

    if (
      this.source === "admin" &&
      !this.attendanceMarkedBy
    ) {
      this.invalidate(
        "attendanceMarkedBy",
        "Admin attendance updates require an actor ID.",
      );
    }
  },
);

export type CodingAttendanceDocument = InferSchemaType<
  typeof codingAttendanceSchema
>;

const modelRegistry = new WeakMap<
  Connection,
  Model<CodingAttendanceDocument>
>();

export async function getCodingAttendanceModel(): Promise<
  Model<CodingAttendanceDocument>
> {
  const connection = await connectStudentDB();

  const cached = modelRegistry.get(connection);

  if (cached) {
    return cached;
  }

  const existing = connection.models.CodingAttendance as
    | Model<CodingAttendanceDocument>
    | undefined;

  if (existing) {
    modelRegistry.set(connection, existing);
    return existing;
  }

  const model = connection.model<CodingAttendanceDocument>(
    "CodingAttendance",
    codingAttendanceSchema,
    COLLECTION_NAME,
  );

  modelRegistry.set(connection, model);

  return model;
}

export const getCodingAttendance = getCodingAttendanceModel;

export default getCodingAttendanceModel;
