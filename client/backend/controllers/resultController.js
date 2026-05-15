const Result = require("../models/Result");

/* SAVE RESULT */

exports.saveResult = async (req, res) => {

  try {

    const {

      studentName,
      examTitle,
      score,
      percentage,

    } = req.body;

    const newResult = new Result({

      studentName,
      examTitle,
      score,
      percentage,

    });

    await newResult.save();

    res.status(201).json({

      success: true,
      message: "Result Saved Successfully",

      result: newResult,

    });

  } catch (error) {

    res.status(500).json({

      success: false,
      message: error.message,

    });

  }

};

/* GET RESULTS */

exports.getResults = async (req, res) => {

  try {

    const results = await Result.find()

    .sort({ percentage: -1 });

    res.status(200).json({

      success: true,
      results,

    });

  } catch (error) {

    res.status(500).json({

      success: false,
      message: error.message,

    });

  }

};