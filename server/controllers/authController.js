const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");

/*
|--------------------------------------------------------------------------
| Generate JWT Token
|--------------------------------------------------------------------------
*/

const generateToken = (student) => {
  return jwt.sign(
    {
      id: student._id,
      email: student.email,
      role: student.role || "student",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

/*
|--------------------------------------------------------------------------
| Register Student
|--------------------------------------------------------------------------
*/

const registerStudent = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      collegeName,
      currentYear,
      internshipDomain,
      password,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !mobile ||
      !collegeName ||
      !currentYear ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    const existingStudent = await Student.findOne({
      email: email.toLowerCase(),
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const student = await Student.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      mobile,

      // College Name
      college: collegeName,

      // Fixed Value
      course: "Student",

      year: currentYear,

      internshipDomain:
        internshipDomain || "General",

      password: hashedPassword,

      role: "student",
    });

    const token = generateToken(student);

    return res.status(201).json({
      success: true,
      message: "Student Registered Successfully",
      token,
      student,
    });
  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Login Student
|--------------------------------------------------------------------------
*/

const loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body;

    const student = await Student.findOne({
      email: email.toLowerCase(),
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      student.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid Credentials",
      });
    }

    student.lastLogin = new Date();
    await student.save();

    const token = generateToken(student);

    return res.status(200).json({
      success: true,
      message: "Login Successful",
      token,
      student,
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Student Profile
|--------------------------------------------------------------------------
*/

const getStudentProfile = async (
  req,
  res
) => {
  try {
    const student =
      await Student.findById(
        req.user.id
      ).select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
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

/*
|--------------------------------------------------------------------------
| Update Assessment Score
|--------------------------------------------------------------------------
*/

const updateAssessmentScore = async (
  req,
  res
) => {
  try {
    const { score } = req.body;

    let scholarship = 0;

    if (score >= 90) {
      scholarship = 30;
    } else if (score >= 85) {
      scholarship = 20;
    } else if (score >= 80) {
      scholarship = 10;
    }

    const student =
      await Student.findByIdAndUpdate(
        req.user.id,
        {
          assessmentScore: score,
          scholarshipPercentage:
            scholarship,
        },
        {
          new: true,
        }
      );

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

module.exports = {
  registerStudent,
  loginStudent,
  getStudentProfile,
  updateAssessmentScore,
};