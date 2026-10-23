import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const OtpSchema = new Schema(
  {
    // ===========================
    // User Information
    // ===========================

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    applicationId: {
      type: String,
      default: "",
      index: true,
    },

    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },

    // ===========================
    // OTP Details
    // ===========================

    otp: {
      type: String,
      required: true,
    },

    purpose: {
      type: String,
      enum: [
        "APPLICATION",
        "LOGIN",
        "EMAIL_VERIFICATION",
        "PASSWORD_RESET",
      ],
      default: "APPLICATION",
      index: true,
    },

    // ===========================
    // Security
    // ===========================

    attempts: {
      type: Number,
      default: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
    },

    verified: {
      type: Boolean,
      default: false,
      index: true,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    expired: {
      type: Boolean,
      default: false,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // ===========================
    // Email
    // ===========================

    emailSent: {
      type: Boolean,
      default: false,
    },

    emailSentAt: {
      type: Date,
      default: null,
    },

    resendCount: {
      type: Number,
      default: 0,
    },

    lastResendAt: {
      type: Date,
      default: null,
    },

    // ===========================
    // Device Info
    // ===========================

    ipAddress: {
      type: String,
      default: "",
    },

    userAgent: {
      type: String,
      default: "",
    },

    device: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "otps",
  }
);

// =====================================
// Auto delete OTP after expiry (TTL)
// =====================================

OtpSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

// =====================================

OtpSchema.index({
  email: 1,
  purpose: 1,
});

OtpSchema.index({
  applicationId: 1,
});

OtpSchema.index({
  verified: 1,
});

export type OtpDocument = InferSchemaType<typeof OtpSchema>;

const OtpModel: Model<OtpDocument> =
  mongoose.models.Otp ||
  mongoose.model<OtpDocument>("Otp", OtpSchema);

export default OtpModel;