const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true,
      
    },

    
    firstName: {
      type: String,
      default: "",
      trim: true,
    },

    lastName: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    college: {
      type: String,
      default: "",
      trim: true,
    },

    internshipDomain: {
      type: String,
      default: "",
      trim: true,
    },

    points: {
      type: Number,
      default: 0,
      min: 0,
    },

    rank: {
      type: Number,
      default: 0,
      min: 0,
    },

    assessmentScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    completedTasks: {
      type: Number,
      default: 0,
      min: 0,
    },

    aiMentorChats: {
      type: Number,
      default: 0,
      min: 0,
    },

    certificatesEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    scholarshipPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    badge: {
      type: String,
      enum: [
        "Bronze",
        "Silver",
        "Gold",
        "Platinum",
        "Diamond",
      ],
      default: "Bronze",
    },

    streakDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
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

leaderboardSchema.index({
   points: -1
});

leaderboardSchema.index({
   rank: 1
});


/*
|--------------------------------------------------------------------------
| AUTO BADGE CALCULATION
|--------------------------------------------------------------------------
*/

leaderboardSchema.pre("save", function (next) {
  if (this.points >= 10000) {
    this.badge = "Diamond";
  } else if (this.points >= 5000) {
    this.badge = "Platinum";
  } else if (this.points >= 2500) {
    this.badge = "Gold";
  } else if (this.points >= 1000) {
    this.badge = "Silver";
  } else {
    this.badge = "Bronze";
  }

  this.lastUpdated = new Date();

  next();
});

module.exports = mongoose.model(
  "Leaderboard",
  leaderboardSchema
);