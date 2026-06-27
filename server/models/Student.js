"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item))
    .filter((item) => typeof item === "string" && item.length > 0);
}

function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return Boolean(value);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function generateCode(prefix) {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000);
  return `${prefix}-${ts}-${rand}`;
}

/*
|--------------------------------------------------------------------------
| Weekly Task Sub-Schema
|--------------------------------------------------------------------------
*/

const weeklyTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
    },
    assignedDate: {
      type: Date,
      default: Date.now,
    },
    completedDate: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

/*
|--------------------------------------------------------------------------
| Student Schema
|--------------------------------------------------------------------------
*/

const studentSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | BASIC INFORMATION
    |--------------------------------------------------------------------------
    */
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      index: true,
    },

    college: {
      type: String,
      required: [true, "College name is required"],
      trim: true,
      maxlength: 150,
    },

    course: {
      type: String,
      required: [true, "Course is required"],
      trim: true,
      maxlength: 150,
    },

    year: {
      type: String,
      required: [true, "Year is required"],
      trim: true,
      maxlength: 50,
    },

    internshipDomain: {
      type: String,
      default: "General",
      trim: true,
      maxlength: 100,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "admin", "mentor"],
      default: "student",
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | PROFILE
    |--------------------------------------------------------------------------
    */
    profileImage: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    githubLink: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    linkedinLink: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    resumeUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    portfolioUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    skills: {
      type: [String],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | PERFORMANCE / AI
    |--------------------------------------------------------------------------
    */
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

    leaderboardPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    aiMentorChats: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | ASSESSMENT
    |--------------------------------------------------------------------------
    */
    assessmentCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    assessmentPassed: {
      type: Boolean,
      default: false,
    },

    assessmentAttemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    assessmentCompletedAt: {
      type: Date,
      default: null,
    },

    scholarshipEligible: {
      type: Boolean,
      default: false,
    },

    /*
    |--------------------------------------------------------------------------
    | INTERNSHIP
    |--------------------------------------------------------------------------
    */
    internshipStatus: {
      type: String,
      enum: [
        "Not Applied",
        "Applied",
        "Selected",
        "In Progress",
        "Completed",
        "Rejected",
      ],
      default: "Not Applied",
      index: true,
    },

    internshipStartDate: {
      type: Date,
      default: null,
    },

    internshipEndDate: {
      type: Date,
      default: null,
    },

    currentInternship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Internship",
      default: null,
    },

    internshipApplicationsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    internshipUnlocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    internshipId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },

    appliedInternshipAt: {
      type: Date,
      default: null,
    },

    internshipApproved: {
      type: Boolean,
      default: false,
    },

    internshipApprovedAt: {
      type: Date,
      default: null,
    },

    internshipProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    internshipCompletionDate: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | TASKS
    |--------------------------------------------------------------------------
    */
    totalTasks: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedTasks: {
      type: Number,
      default: 0,
      min: 0,
    },

    weeklyTasks: {
      type: [weeklyTaskSchema],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | PROJECT SUBMISSION
    |--------------------------------------------------------------------------
    */
    projectSubmitted: {
      type: Boolean,
      default: false,
    },

    projectGithubLink: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    projectLiveLink: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    projectReviewStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    /*
    |--------------------------------------------------------------------------
    | PAYMENT
    |--------------------------------------------------------------------------
    */
    paymentCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },

    paymentId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | CERTIFICATES
    |--------------------------------------------------------------------------
    */
    certificateIssued: {
      type: Boolean,
      default: false,
    },

    certificateId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },

    certificateIssuedDate: {
      type: Date,
      default: null,
    },

    certificateEligible: {
      type: Boolean,
      default: false,
      index: true,
    },

    certificateUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    certificateGeneratedAt: {
      type: Date,
      default: null,
    },

    certificateVerificationCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    certificateLastVerifiedAt: {
      type: Date,
      default: null,
    },

    offerLetterIssued: {
      type: Boolean,
      default: false,
    },

    offerLetterIssuedDate: {
      type: Date,
      default: null,
    },

    experienceLetterIssued: {
      type: Boolean,
      default: false,
    },

    experienceLetterIssuedDate: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | PLACEMENT
    |--------------------------------------------------------------------------
    */
    placementStatus: {
      type: String,
      enum: ["Not Eligible", "Eligible", "Interview Scheduled", "Placed"],
      default: "Not Eligible",
      index: true,
    },

    placementCompany: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    placementPackage: {
      type: Number,
      default: 0,
      min: 0,
    },

    placementDate: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | ACCOUNT / AUDIT
    |--------------------------------------------------------------------------
    */
    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    mobileVerified: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    loginCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    accountStatus: {
      type: String,
      enum: ["active", "suspended", "blocked"],
      default: "active",
      index: true,
    },

    lastProfileUpdate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/*
|--------------------------------------------------------------------------
| INDEXES
|--------------------------------------------------------------------------
*/

studentSchema.index({ role: 1, accountStatus: 1 });
studentSchema.index({ internshipStatus: 1, placementStatus: 1 });
studentSchema.index({ leaderboardPoints: -1 });
studentSchema.index({ certificateIssued: 1 });
studentSchema.index({ currentInternship: 1 });
studentSchema.index({ assessmentCompleted: 1 });
studentSchema.index({ internshipUnlocked: 1 });
studentSchema.index({ paymentCompleted: 1 });
studentSchema.index({ internshipId: 1 });
studentSchema.index({ certificateEligible: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({ mobile: 1 });

/*
|--------------------------------------------------------------------------
| VIRTUALS
|--------------------------------------------------------------------------
*/

studentSchema.virtual("fullName").get(function () {
  return `${this.firstName || ""} ${this.lastName || ""}`.trim();
});

studentSchema.virtual("profileCompletion").get(function () {
  const fields = [
    this.firstName,
    this.lastName,
    this.email,
    this.mobile,
    this.college,
    this.course,
    this.year,
    this.city,
    this.githubLink,
    this.linkedinLink,
    this.profileImage,
    this.bio,
    this.resumeUrl,
    this.portfolioUrl,
  ];

  const completed = fields.filter(isFilled).length;
  const total = fields.length || 1;
  return Math.round((completed / total) * 100);
});

/*
|--------------------------------------------------------------------------
| METHODS
|--------------------------------------------------------------------------
*/

studentSchema.methods.getProfileCompletion = function () {
  return this.profileCompletion;
};

studentSchema.methods.getDisplayName = function () {
  return this.fullName || "Student";
};

studentSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

studentSchema.methods.unlockInternship = function (scholarshipPercentage = 0) {
  this.assessmentCompleted = true;
  this.assessmentPassed = true;
  this.internshipUnlocked = true;
  this.scholarshipEligible = true;
  this.scholarshipPercentage = safeNumber(scholarshipPercentage, 0);
  this.internshipStatus = "Applied";
};

studentSchema.methods.markPaymentSuccess = function ({
  paymentId = "",
  amount = 0,
} = {}) {
  this.paymentCompleted = true;
  this.paymentStatus = "SUCCESS";
  this.paymentId = normalizeText(paymentId) || this.paymentId || "";
  this.paymentDate = new Date();
  this.paidAmount = safeNumber(amount, 0);
};

studentSchema.methods.generateInternshipId = function () {
  if (!this.internshipId) {
    this.internshipId = generateCode("INT");
  }
  return this.internshipId;
};

studentSchema.methods.generateCertificateId = function () {
  if (!this.certificateId) {
    this.certificateId = generateCode("CERT");
  }
  return this.certificateId;
};

/*
|--------------------------------------------------------------------------
| PRE-VALIDATE
|--------------------------------------------------------------------------
*/

studentSchema.pre("validate", function (next) {
  try {
    if (this.email) this.email = normalizeEmail(this.email);

    if (!this.internshipDomain) {
      this.internshipDomain = "General";
    }

    if (this.skills) {
      this.skills = normalizeArray(this.skills);
    }

    if (!this.internshipId && this.internshipUnlocked) {
      this.generateInternshipId();
    }

    if (!this.certificateId && this.certificateIssued) {
      this.generateCertificateId();
    }

    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| PRE-SAVE
|--------------------------------------------------------------------------
*/

studentSchema.pre("save", async function (next) {
  try {
    if (this.isModified("email")) {
      this.email = normalizeEmail(this.email);
    }

    const textFields = [
      "firstName",
      "lastName",
      "mobile",
      "college",
      "course",
      "year",
      "internshipDomain",
      "city",
      "githubLink",
      "linkedinLink",
      "bio",
      "resumeUrl",
      "portfolioUrl",
      "projectGithubLink",
      "projectLiveLink",
      "placementCompany",
      "certificateId",
      "paymentId",
      "internshipId",
      "certificateUrl",
      "profileImage",
    ];

    for (const field of textFields) {
      if (this[field] !== undefined && this[field] !== null) {
        this[field] = normalizeText(this[field]);
      }
    }

    if (Array.isArray(this.skills)) {
      this.skills = normalizeArray(this.skills);
    }

    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    if (this.certificateIssued && !this.certificateId) {
      this.generateCertificateId();
    }

    if (this.internshipUnlocked && !this.internshipId) {
      this.generateInternshipId();
    }

    this.lastProfileUpdate = new Date();

    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| TOJSON / TOOBJECT
|--------------------------------------------------------------------------
*/

function hideSensitiveFields(doc, ret) {
  delete ret.password;
  delete ret.__v;
  return ret;
}

studentSchema.set("toJSON", {
  virtuals: true,
  transform: hideSensitiveFields,
});

studentSchema.set("toObject", {
  virtuals: true,
  transform: hideSensitiveFields,
});

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports =
  mongoose.models.Student || mongoose.model("Student", studentSchema);