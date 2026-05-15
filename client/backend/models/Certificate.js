const mongoose = require("mongoose");

const certificateSchema =
new mongoose.Schema({

  studentName:{
    type:String,
    required:true,
  },

  examTitle:{
    type:String,
    required:true,
  },

  percentage:{
    type:Number,
    required:true,
  },

  certificateId:{
    type:String,
    required:true,
  },

  issuedAt:{
    type:Date,
    default:Date.now,
  }

});

module.exports =
mongoose.model(
  "Certificate",
  certificateSchema
);