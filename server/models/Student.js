const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    // Basic Information
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: true,
      trim: true,
    },

    college: {
      type: String,
      required: true,
      trim: true,
    },

    course: {
      type: String,
      required: true,
      trim: true,
    },

    year: {
      type: String,
      required: true,
      trim: true,
    },

    internshipDomain: {
      type: String,
      default: "",
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "admin", "mentor"],
      default: "student",
    },

    // Profile
    profileImage: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      default: "",
    },

    githubLink: {
      type: String,
      default: "",
    },

    linkedinLink: {
      type: String,
      default: "",
    },

    // Performance
    assessmentScore: {
      type: Number,
      default: 0,
    },

    scholarshipPercentage: {
      type: Number,
      default: 0,
    },

    leaderboardPoints: {
      type: Number,
      default: 0,
    },

    aiMentorChats: {
      type: Number,
      default: 0,
    },

    // Internship
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
    },

    internshipStartDate: {
      type: Date,
      default: null,
    },

    internshipEndDate: {
      type: Date,
      default: null,
    },

    // Tasks
    totalTasks: {
      type: Number,
      default: 0,
    },

    completedTasks: {
      type: Number,
      default: 0,
    },

    weeklyTasks: [
      {
        title: {
          type: String,
          default: "",
        },

        description: {
          type: String,
          default: "",
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
      },
    ],

    // Project
    projectSubmitted: {
      type: Boolean,
      default: false,
    },

    projectGithubLink: {
      type: String,
      default: "",
    },

    projectLiveLink: {
      type: String,
      default: "",
    },

    // Certificates
    certificateIssued: {
      type: Boolean,
      default: false,
    },

    certificateId: {
      type: String,
      default: "",
    },

    offerLetterIssued: {
      type: Boolean,
      default: false,
    },

    experienceLetterIssued: {
      type: Boolean,
      default: false,
    },

    // Placement
    placementStatus: {
      type: String,
      enum: [
        "Not Eligible",
        "Eligible",
        "Interview Scheduled",
        "Placed",
      ],
      default: "Not Eligible",
    },

    // Verification
    isVerified: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Student",
  studentSchema
);