const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    type: {
      type: String,
      enum: [
        "General",
        "Task",
        "Assessment",
        "Internship",
        "Certificate",
        "Payment",
        "Placement",
        "System",
      ],
      default: "General",
    },

    priority: {
      type: String,
      enum: [
        "Low",
        "Medium",
        "High",
        "Critical",
      ],
      default: "Medium",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    actionUrl: {
      type: String,
      default: "",
      trim: true,
    },

    actionLabel: {
      type: String,
      default: "",
      trim: true,
    },

    icon: {
      type: String,
      default: "bell",
    },

    sender: {
      type: String,
      default: "CyberNet System",
      trim: true,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

notificationSchema.index({
  studentId: 1,
  isRead: 1,
});

notificationSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);