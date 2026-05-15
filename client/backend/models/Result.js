const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({

  studentName: {
    type: String,
    required: true,
  },

  examTitle: {
    type: String,
    required: true,
  },

  score: {
    type: Number,
    required: true,
  },

  percentage: {
    type: Number,
    required: true,
  },

  submittedAt: {
    type: Date,
    default: Date.now,
  },

});

module.exports = mongoose.model(
  "Result",
  resultSchema
);