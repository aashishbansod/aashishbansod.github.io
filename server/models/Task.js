const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    internshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Internship",
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "In Progress",
        "Submitted",
        "Completed",
        "Rejected",
      ],
      default: "Pending",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    points: {
      type: Number,
      default: 10,
      min: 0,
    },

    submissionLink: {
      type: String,
      default: "",
      trim: true,
    },

    githubLink: {
      type: String,
      default: "",
      trim: true,
    },

    attachment: {
      type: String,
      default: "",
    },

    feedback: {
      type: String,
      default: "",
    },

    assignedBy: {
      type: String,
      default: "CyberNet System",
    },

    assignedDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    submittedDate: {
      type: Date,
      default: null,
    },

    completedDate: {
      type: Date,
      default: null,
    },

    reviewStatus: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Rejected",
      ],
      default: "Pending",
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

taskSchema.index({
  studentId: 1,
  status: 1,
});

taskSchema.index({
  dueDate: 1,
});

module.exports = mongoose.model(
  "Task",
  taskSchema
);