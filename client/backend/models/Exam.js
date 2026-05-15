const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({

  question: {
    type: String,
    required: true,
  },

  options: {
    type: [String],
    required: true,
  },

  correctAnswer: {
    type: String,
    required: true,
  }

});

const examSchema = new mongoose.Schema({

  title: {
    type: String,
    required: true,
  },

  subject: {
    type: String,
    required: true,
  },

  duration: {
    type: Number,
    default: 30,
  },

  questions: [questionSchema],

  createdAt: {
    type: Date,
    default: Date.now,
  }

});

module.exports = mongoose.model("Exam", examSchema);