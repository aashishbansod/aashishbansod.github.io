const mongoose = require("mongoose");
const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const generateCode = (prefix = "CNT", length = 10) => {
  const raw = crypto.randomBytes(12).toString("hex").toUpperCase();
  return `${prefix}-${raw.slice(0, length)}`;
};

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const clampNumber = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
};

/*
|--------------------------------------------------------------------------
| Certificate Schema
|--------------------------------------------------------------------------
*/

const certificateSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    studentName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    studentEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    studentPhone: {
      type: String,
      default: "",
      trim: true,
    },

    college: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    course: {
      type: String,
      default: "",
      trim: true,
    },

    year: {
      type: String,
      default: "",
      trim: true,
    },

    internshipDomain: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    internshipTitle: {
      type: String,
      required: true,
      trim: true,
    },

    internshipDuration: {
      type: String,
      default: "",
      trim: true,
    },

    issueDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    completionDate: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    certificateType: {
      type: String,
      enum: [
        "Internship",
        "Training",
        "Workshop",
        "Project",
        "Assessment",
        "Achievement",
      ],
      default: "Internship",
      index: true,
    },

    grade: {
      type: String,
      default: "A",
      trim: true,
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    xpEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    pdfUrl: {
      type: String,
      default: "",
      trim: true,
    },

    qrCodeUrl: {
      type: String,
      default: "",
      trim: true,
    },

    verificationUrl: {
      type: String,
      default: "",
      trim: true,
    },

    verificationCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    publicSlug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },

    digitalSignature: {
      type: String,
      default: "",
      trim: true,
    },

    hash: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    verificationCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastVerifiedAt: {
      type: Date,
      default: null,
    },

    lastDownloadedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Issued", "Pending", "Revoked", "Expired"],
      default: "Issued",
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedReason: {
      type: String,
      default: "",
      trim: true,
    },

    companyVerified: [
      {
        companyName: {
          type: String,
          default: "",
          trim: true,
        },
        verifiedAt: {
          type: Date,
          default: Date.now,
        },
        ipAddress: {
          type: String,
          default: "",
          trim: true,
        },
        userAgent: {
          type: String,
          default: "",
          trim: true,
        },
        location: {
          type: String,
          default: "",
          trim: true,
        },
      },
    ],

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    issuedBy: {
      type: String,
      default: "CyberNet Technology Systems",
      trim: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

certificateSchema.index({ student: 1, certificateType: 1 });
certificateSchema.index({ certificateId: 1, verificationCode: 1 });
certificateSchema.index({ status: 1, isVerified: 1 });
certificateSchema.index({ studentEmail: 1, issueDate: -1 });
certificateSchema.index({ companyVerified: 1 });
certificateSchema.index({ internshipDomain: 1, certificateType: 1 });
certificateSchema.index({ isActive: 1, createdAt: -1 });

/*
|--------------------------------------------------------------------------
| Virtuals
|--------------------------------------------------------------------------
*/

certificateSchema.virtual("certificateAgeDays").get(function () {
  if (!this.issueDate) return 0;

  const today = new Date();
  const issued = new Date(this.issueDate);

  return Math.max(
    0,
    Math.floor((today - issued) / (1000 * 60 * 60 * 24))
  );
});

certificateSchema.virtual("verificationLink").get(function () {
  if (this.verificationUrl) return this.verificationUrl;
  if (this.publicSlug) return `/verify/${this.publicSlug}`;
  return `/verify/${this.certificateId || ""}`;
});

certificateSchema.virtual("isIssued").get(function () {
  return this.status === "Issued";
});

/*
|--------------------------------------------------------------------------
| Methods
|--------------------------------------------------------------------------
*/

certificateSchema.methods.incrementVerification = async function ({
  companyName = "",
  ipAddress = "",
  userAgent = "",
  location = "",
} = {}) {
  this.verificationCount = clampNumber(this.verificationCount, 0, 0) + 1;
  this.lastVerifiedAt = new Date();

  this.companyVerified.push({
    companyName: normalizeText(companyName),
    ipAddress: normalizeText(ipAddress),
    userAgent: normalizeText(userAgent),
    location: normalizeText(location),
    verifiedAt: new Date(),
  });

  return this.save();
};

certificateSchema.methods.incrementDownload = async function () {
  this.downloadCount = clampNumber(this.downloadCount, 0, 0) + 1;
  this.lastDownloadedAt = new Date();
  return this.save();
};

certificateSchema.methods.revoke = async function (reason = "") {
  this.status = "Revoked";
  this.isVerified = false;
  this.isActive = false;
  this.revokedAt = new Date();
  this.revokedReason = normalizeText(reason);
  return this.save();
};

certificateSchema.methods.expire = async function () {
  this.status = "Expired";
  this.isVerified = false;
  this.isActive = false;
  return this.save();
};

certificateSchema.methods.getPublicData = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

/*
|--------------------------------------------------------------------------
| Pre-Validate
|--------------------------------------------------------------------------
*/

certificateSchema.pre("validate", function (next) {
  try {
    if (!this.certificateId) {
      this.certificateId = generateCode("CNTS", 12);
    }

    if (!this.verificationCode) {
      this.verificationCode = generateCode("VER", 14);
    }

    if (!this.publicSlug) {
      this.publicSlug = this.certificateId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| Pre-Save Normalization
|--------------------------------------------------------------------------
*/

certificateSchema.pre("save", function (next) {
  try {
    const textFields = [
      "studentName",
      "studentEmail",
      "studentPhone",
      "college",
      "course",
      "year",
      "internshipDomain",
      "internshipTitle",
      "internshipDuration",
      "pdfUrl",
      "qrCodeUrl",
      "verificationUrl",
      "digitalSignature",
      "hash",
      "remarks",
      "issuedBy",
      "revokedReason",
    ];

    for (const field of textFields) {
      if (this[field] !== undefined && this[field] !== null) {
        this[field] = normalizeText(this[field]);
      }
    }

    if (this.studentEmail) {
      this.studentEmail = normalizeEmail(this.studentEmail);
    }

    if (this.certificateId) {
      this.certificateId = this.certificateId.toUpperCase();
    }

    if (this.verificationCode) {
      this.verificationCode = this.verificationCode.toUpperCase();
    }

    this.score = clampNumber(this.score, 0, 0, 100);
    this.xpEarned = clampNumber(this.xpEarned, 0, 0);
    this.verificationCount = clampNumber(this.verificationCount, 0, 0);
    this.downloadCount = clampNumber(this.downloadCount, 0, 0);

    if (this.status === "Revoked") {
      this.isVerified = false;
      this.isActive = false;
      if (!this.revokedAt) {
        this.revokedAt = new Date();
      }
    }

    if (this.status === "Expired") {
      this.isVerified = false;
      this.isActive = false;
    }

    if (this.status === "Issued" && this.isActive === undefined) {
      this.isActive = true;
    }

    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| Transform
|--------------------------------------------------------------------------
*/

const transformCertificate = (doc, ret) => {
  delete ret.__v;
  return ret;
};

certificateSchema.set("toJSON", {
  virtuals: true,
  transform: transformCertificate,
});

certificateSchema.set("toObject", {
  virtuals: true,
  transform: transformCertificate,
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports =
  mongoose.models.Certificate ||
  mongoose.model("Certificate", certificateSchema);