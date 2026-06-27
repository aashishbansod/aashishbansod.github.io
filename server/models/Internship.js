const mongoose = require("mongoose");
const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : value;

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter((item) => typeof item === "string" && item.length > 0);
};

const generateInternshipCode = () => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CNT-INT-${year}-${random}`;
};

/*
|--------------------------------------------------------------------------
| Application Subdocument
|--------------------------------------------------------------------------
*/

const applicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    internshipId: {
      type: String,
      default: "",
      trim: true,
    },

    assessmentScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    scholarshipPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    originalFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentCompleted: {
      type: Boolean,
      default: false,
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING",
    },

    paymentId: {
      type: String,
      default: "",
      trim: true,
    },

    orderId: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "Applied",
        "Selected",
        "Rejected",
        "In Progress",
        "Completed",
      ],
      default: "Applied",
      index: true,
    },

    appliedAt: {
      type: Date,
      default: Date.now,
    },

    selectedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    studentRemark: {
      type: String,
      default: "",
      trim: true,
    },

    adminRemark: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/*
|--------------------------------------------------------------------------
| Internship Schema
|--------------------------------------------------------------------------
*/

const internshipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Internship title is required"],
      trim: true,
      maxlength: 120,
      index: true,
    },

    internshipCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    domain: {
      type: String,
      required: [true, "Domain is required"],
      trim: true,
      index: true,
    },

    subDomain: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },

    shortDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    companyName: {
      type: String,
      default: "CyberNet Technology Systems",
      trim: true,
      index: true,
    },

    companyWebsite: {
      type: String,
      default: "",
      trim: true,
    },

    companyLogo: {
      type: String,
      default: "",
      trim: true,
    },

    skillsRequired: {
      type: [String],
      default: [],
    },

    technologies: {
      type: [String],
      default: [],
    },

    duration: {
      type: String,
      default: "1 Month",
      trim: true,
    },

    internshipFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    stipend: {
      type: Number,
      default: 0,
      min: 0,
    },

    scholarshipEnabled: {
      type: Boolean,
      default: true,
    },

    internshipType: {
      type: String,
      enum: ["Remote", "Hybrid", "Onsite"],
      default: "Remote",
      index: true,
    },

    location: {
      type: String,
      default: "Remote",
      trim: true,
    },

    seats: {
      type: Number,
      default: 100,
      min: 1,
    },

    availableSeats: {
      type: Number,
      default: 100,
      min: 0,
    },

    applicationDeadline: {
      type: Date,
      required: [true, "Application deadline is required"],
      index: true,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    assessmentRequired: {
      type: Boolean,
      default: true,
    },

    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      default: null,
    },

    minimumScoreRequired: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },

    mentorName: {
      type: String,
      default: "",
      trim: true,
    },

    mentorEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    certificateProvided: {
      type: Boolean,
      default: true,
    },

    offerLetterProvided: {
      type: Boolean,
      default: true,
    },

    experienceLetterProvided: {
      type: Boolean,
      default: true,
    },

    completionCertificate: {
      type: Boolean,
      default: true,
    },

    projectRequired: {
      type: Boolean,
      default: true,
    },

    finalProjectTitle: {
      type: String,
      default: "",
      trim: true,
    },

    applications: {
      type: [applicationSchema],
      default: [],
    },

    totalApplications: {
      type: Number,
      default: 0,
      min: 0,
    },

    selectedStudents: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedStudents: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageAssessmentScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    liveClasses: {
      type: Boolean,
      default: false,
    },

    aiMentorEnabled: {
      type: Boolean,
      default: true,
    },

    codingPracticeEnabled: {
      type: Boolean,
      default: true,
    },

    leaderboardEnabled: {
      type: Boolean,
      default: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "CLOSED"],
      default: "DRAFT",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: String,
      default: "CyberNet Admin",
      trim: true,
    },

    updatedBy: {
      type: String,
      default: "CyberNet Admin",
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

internshipSchema.index({ status: 1, isActive: 1 });
internshipSchema.index({ domain: 1, internshipType: 1 });
internshipSchema.index({ companyName: 1 });
internshipSchema.index({ applicationDeadline: 1 });
internshipSchema.index({ internshipCode: 1 }, { unique: true });
internshipSchema.index({ isFeatured: 1, createdAt: -1 });
internshipSchema.index({ "applications.student": 1 });
internshipSchema.index({ mentorEmail: 1 });
internshipSchema.index({ assessmentId: 1 });

/*
|--------------------------------------------------------------------------
| Virtuals
|--------------------------------------------------------------------------
*/

internshipSchema.virtual("filledSeats").get(function () {
  return Math.max(this.seats - this.availableSeats, 0);
});

internshipSchema.virtual("remainingSeats").get(function () {
  return Math.max(this.availableSeats, 0);
});

internshipSchema.virtual("applicationFillRate").get(function () {
  if (!this.seats || this.seats <= 0) return 0;
  return Math.round((this.filledSeats / this.seats) * 100);
});

internshipSchema.virtual("isApplicationOpen").get(function () {
  return (
    this.isActive === true &&
    this.status === "ACTIVE" &&
    (!this.applicationDeadline ||
      new Date() <= new Date(this.applicationDeadline)) &&
    this.availableSeats > 0
  );
});

/*
|--------------------------------------------------------------------------
| Methods
|--------------------------------------------------------------------------
*/

internshipSchema.methods.addApplication = async function (applicationData) {
  const studentId = String(applicationData?.student || "");

  if (!studentId) {
    throw new Error("Student is required");
  }

  const existing = this.applications.find(
    (app) => String(app.student) === studentId
  );

  if (existing) {
    return this;
  }

  const payload = {
    ...applicationData,
    student: applicationData.student,
    internshipId: applicationData.internshipId || "",
    assessmentScore: Number(applicationData.assessmentScore || 0),
    scholarshipPercentage: Number(applicationData.scholarshipPercentage || 0),
    originalFee: Number(applicationData.originalFee || this.internshipFee || 0),
    discountAmount: Number(applicationData.discountAmount || 0),
    finalFee: Number(applicationData.finalFee || 0),
    paymentCompleted: Boolean(applicationData.paymentCompleted),
    paymentStatus: applicationData.paymentStatus || "PENDING",
    paymentId: normalizeText(applicationData.paymentId || ""),
    orderId: normalizeText(applicationData.orderId || ""),
    status: applicationData.status || "Applied",
    appliedAt: applicationData.appliedAt || new Date(),
    selectedAt: applicationData.selectedAt || null,
    rejectedAt: applicationData.rejectedAt || null,
    completedAt: applicationData.completedAt || null,
    studentRemark: normalizeText(applicationData.studentRemark || ""),
    adminRemark: normalizeText(applicationData.adminRemark || ""),
  };

  this.applications.push(payload);
  this.totalApplications = this.applications.length;

  this.selectedStudents = this.applications.filter(
    (app) => app.status === "Selected"
  ).length;

  this.completedStudents = this.applications.filter(
    (app) => app.status === "Completed"
  ).length;

  return this.save();
};

internshipSchema.methods.selectStudent = async function (
  studentId,
  remark = ""
) {
  const application = this.applications.find(
    (app) => String(app.student) === String(studentId)
  );

  if (!application) {
    throw new Error("Application not found");
  }

  application.status = "Selected";
  application.selectedAt = new Date();
  application.rejectedAt = null;
  application.adminRemark = normalizeText(remark);

  if (this.availableSeats > 0) {
    this.availableSeats -= 1;
  }

  this.selectedStudents = this.applications.filter(
    (app) => app.status === "Selected"
  ).length;

  return this.save();
};

internshipSchema.methods.rejectStudent = async function (
  studentId,
  remark = ""
) {
  const application = this.applications.find(
    (app) => String(app.student) === String(studentId)
  );

  if (!application) {
    throw new Error("Application not found");
  }

  application.status = "Rejected";
  application.rejectedAt = new Date();
  application.adminRemark = normalizeText(remark);

  this.selectedStudents = this.applications.filter(
    (app) => app.status === "Selected"
  ).length;

  return this.save();
};

internshipSchema.methods.completeStudent = async function (studentId) {
  const application = this.applications.find(
    (app) => String(app.student) === String(studentId)
  );

  if (!application) {
    throw new Error("Application not found");
  }

  application.status = "Completed";
  application.completedAt = new Date();

  this.completedStudents = this.applications.filter(
    (app) => app.status === "Completed"
  ).length;

  return this.save();
};

internshipSchema.methods.recalculateAnalytics = function () {
  const total = this.applications.length;
  const selected = this.applications.filter(
    (app) => app.status === "Selected"
  ).length;
  const completed = this.applications.filter(
    (app) => app.status === "Completed"
  ).length;

  const avg =
    total > 0
      ? this.applications.reduce(
          (sum, app) => sum + Number(app.assessmentScore || 0),
          0
        ) / total
      : 0;

  this.totalApplications = total;
  this.selectedStudents = selected;
  this.completedStudents = completed;
  this.averageAssessmentScore = Number(avg.toFixed(2));

  return this;
};

/*
|--------------------------------------------------------------------------
| Hooks
|--------------------------------------------------------------------------
*/

internshipSchema.pre("validate", function (next) {
  try {
    if (!this.internshipCode) {
      this.internshipCode = generateInternshipCode();
    }

    this.availableSeats = Math.min(
      Math.max(Number(this.availableSeats || 0), 0),
      Number(this.seats || 0)
    );

    const textFields = [
      "title",
      "internshipCode",
      "domain",
      "subDomain",
      "description",
      "shortDescription",
      "companyName",
      "companyWebsite",
      "companyLogo",
      "duration",
      "location",
      "mentorName",
      "mentorEmail",
      "finalProjectTitle",
      "createdBy",
      "updatedBy",
    ];

    for (const field of textFields) {
      if (this[field] !== undefined && this[field] !== null) {
        this[field] = normalizeText(this[field]);
      }
    }

    if (this.internshipCode) {
      this.internshipCode = this.internshipCode.toUpperCase();
    }

    if (this.mentorEmail) {
      this.mentorEmail = normalizeEmail(this.mentorEmail);
    }

    this.skillsRequired = normalizeArray(this.skillsRequired);
    this.technologies = normalizeArray(this.technologies);

    next();
  } catch (error) {
    next(error);
  }
});

internshipSchema.pre("save", function (next) {
  try {
    this.recalculateAnalytics();
    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports =
  mongoose.models.Internship ||
  mongoose.model("Internship", internshipSchema);