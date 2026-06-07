const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    questionType: {
      type: String,
      enum: ["MCQ", "CODING"],
      required: true,
    },

    domain: {
      type: String,
      required: true,
    },

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Easy",
    },

    question: {
      type: String,
      required: true,
    },

    options: [
      {
        type: String,
      },
    ],

    correctAnswer: {
      type: String,
      required: true,
    },

    explanation: {
      type: String,
      default: "",
    },

    marks: {
      type: Number,
      default: 1,
    },

    negativeMarks: {
      type: Number,
      default: 0,
    },

    codingLanguage: {
      type: [String],
      default: [],
    },

    starterCode: {
      type: String,
      default: "",
    },

    sampleInput: {
      type: String,
      default: "",
    },

    sampleOutput: {
      type: String,
      default: "",
    },

    hiddenInput: {
      type: String,
      default: "",
    },

    hiddenOutput: {
      type: String,
      default: "",
    },

    timeLimit: {
      type: Number,
      default: 2,
    },

    memoryLimit: {
      type: Number,
      default: 256,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: String,
      default: "CyberNet Admin",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Question",
  questionSchema
);