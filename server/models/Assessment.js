const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    assessmentName: {
      type: String,
      required: true,
      trim: true,
    },

    assessmentCode: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
    },

    description: {
      type: String,
      default: "",
    },

    internshipDomain: {
      type: String,
      required: true,
    },

    duration: {
      type: Number,
      default: 60, // Minutes
    },

    totalMCQQuestions: {
      type: Number,
      default: 30,
    },

    totalCodingQuestions: {
      type: Number,
      default: 2,
    },

    totalMarks: {
      type: Number,
      default: 100,
    },

    passingPercentage: {
      type: Number,
      default: 60,
    },

    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],

    scholarshipEnabled: {
      type: Boolean,
      default: true,
    },

    certificateEnabled: {
      type: Boolean,
      default: true,
    },

    antiCopyPaste: {
      type: Boolean,
      default: true,
    },

    antiTabSwitch: {
      type: Boolean,
      default: true,
    },

    fullScreenRequired: {
      type: Boolean,
      default: true,
    },

    webcamMonitoring: {
      type: Boolean,
      default: false,
    },

    autoSubmit: {
      type: Boolean,
      default: true,
    },

    randomQuestions: {
      type: Boolean,
      default: true,
    },

    shuffleOptions: {
      type: Boolean,
      default: true,
    },

    maxAttempts: {
      type: Number,
      default: 1,
    },

    scholarshipRules: {
      scholarship100: {
        type: Number,
        default: 90,
      },

      scholarship75: {
        type: Number,
        default: 80,
      },

      scholarship50: {
        type: Number,
        default: 70,
      },

      scholarship30: {
        type: Number,
        default: 60,
      },
    },

    instructions: [
      {
        type: String,
      },
    ],

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "ACTIVE",
        "CLOSED",
      ],
      default: "DRAFT",
    },

    createdBy: {
      type: String,
      default: "CyberNet Admin",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Assessment",
  assessmentSchema
);