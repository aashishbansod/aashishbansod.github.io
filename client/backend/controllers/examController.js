const Exam = require("../models/Exam");

/* CREATE EXAM */

exports.createExam = async (req, res) => {

  try {

    const newExam = new Exam(req.body);

    await newExam.save();

    res.status(201).json({
      success: true,
      message: "Exam Created Successfully",
      exam: newExam,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }

};

/* GET ALL EXAMS */

exports.getAllExams = async (req, res) => {

  try {

    const exams = await Exam.find();

    res.status(200).json({
      success: true,
      exams,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }

};

/* GET SINGLE EXAM */

exports.getSingleExam = async (req, res) => {

  try {

    const exam = await Exam.findById(req.params.id);

    if (!exam) {

      return res.status(404).json({
        success: false,
        message: "Exam Not Found",
      });

    }

    res.status(200).json({
      success: true,
      exam,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }

};