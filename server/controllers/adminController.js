const Student = require("../models/Student");
const Assessment = require("../models/Assessment");
const Result = require("../models/Result");
const Internship = require("../models/Internship");
const Payment = require("../models/Payment");

/*
|--------------------------------------------------------------------------
| Dashboard Stats
|--------------------------------------------------------------------------
*/

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalStudents,
      totalAssessments,
      totalResults,
      totalInternships,
      totalPayments,
    ] = await Promise.all([
      Student.countDocuments(),
      Assessment.countDocuments(),
      Result.countDocuments(),
      Internship.countDocuments(),
      Payment.countDocuments(),
    ]);

    const activeStudents =
      await Student.countDocuments({
        internshipStatus: {
          $in: [
            "Applied",
            "Selected",
            "In Progress",
          ],
        },
      });

    const averageScoreData =
      await Result.aggregate([
        {
          $group: {
            _id: null,
            avgScore: {
              $avg: "$percentage",
            },
          },
        },
      ]);

    const revenueData =
      await Payment.aggregate([
        {
          $match: {
            paymentStatus: "SUCCESS",
          },
        },
        {
          $group: {
            _id: null,
            revenue: {
              $sum: "$finalAmount",
            },
          },
        },
      ]);

    const averageScore =
      averageScoreData.length
        ? averageScoreData[0].avgScore
        : 0;

    const revenue =
      revenueData.length
        ? revenueData[0].revenue
        : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        activeStudents,
        totalAssessments,
        totalResults,
        totalInternships,
        totalPayments,
        revenue,
        averageScore:
          Number(
            averageScore.toFixed(2)
          ),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Students
|--------------------------------------------------------------------------
*/

const getAllStudents = async (
  req,
  res
) => {
  try {
    const students =
      await Student.find()
        .select("-password")
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentById = async (
  req,
  res
) => {
  try {
    const student =
      await Student.findById(
        req.params.id
      ).select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateStudent = async (
  req,
  res
) => {
  try {
    const student =
      await Student.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteStudent = async (
  req,
  res
) => {
  try {
    await Student.findByIdAndDelete(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message:
        "Student deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Assessments
|--------------------------------------------------------------------------
*/

const getAllAssessments =
  async (req, res) => {
    try {
      const assessments =
        await Assessment.find()
          .populate("questions")
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        count:
          assessments.length,
        assessments,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Results
|--------------------------------------------------------------------------
*/

const getAllResults = async (
  req,
  res
) => {
  try {
    const results =
      await Result.find()
        .populate(
          "student",
          "firstName lastName email"
        )
        .populate(
          "assessment",
          "assessmentName"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Internships
|--------------------------------------------------------------------------
*/

const getAllInternships =
  async (req, res) => {
    try {
      const internships =
        await Internship.find().sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        count:
          internships.length,
        internships,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
*/

const getAllPayments =
  async (req, res) => {
    try {
      const payments =
        await Payment.find()
          .populate(
            "student",
            "firstName lastName email"
          )
          .populate(
            "internship",
            "title"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        count:
          payments.length,
        payments,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

module.exports = {
  getDashboardStats,

  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,

  getAllAssessments,

  getAllResults,

  getAllInternships,

  getAllPayments,
};