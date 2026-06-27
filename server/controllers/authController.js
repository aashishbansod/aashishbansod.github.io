const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Student = require("../models/Student");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const trimText = (value) =>
  typeof value === "string" ? value.trim() : "";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toSafeStudent = (studentDoc) => {
  if (!studentDoc) return null;

  const student =
    typeof studentDoc.toObject === "function"
      ? studentDoc.toObject({ virtuals: true })
      : { ...studentDoc };

  delete student.password;
  delete student.__v;

  return student;
};

const handleMongoError = (error, res) => {
  if (error?.code === 11000) {
    return res.status(400).json({
      success: false,
      message: "Student already exists",
    });
  }

  if (error?.name === "ValidationError") {
    const message = Object.values(error.errors || {})
      .map((err) => err.message)
      .join(", ");

    return res.status(400).json({
      success: false,
      message: message || "Validation failed",
    });
  }

  return res.status(500).json({
    success: false,
    message: error.message || "Internal server error",
  });
};

const calculateScholarship = (score) => {
  const value = Number(score || 0);

  if (value >= 95) return 50;
  if (value >= 90) return 30;
  if (value >= 85) return 20;
  if (value >= 80) return 10;
  if (value >= 60) return 5;

  return 0;
};

const generateToken = (student) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: student._id,
      email: student.email,
      role: student.role || "student",
      firstName: student.firstName || "",
      lastName: student.lastName || "",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const setAuthCookie = (res, token) => {
  if (!token) return;

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("cybernet_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

const getStudentPassword = async (email) => {
  return Student.findOne({
    email: normalizeEmail(email),
  }).select("+password");
};

const getStudentByAuthContext = async (req) => {
  const studentId = req.user?.id || req.user?._id;
  if (!studentId) return null;

  return Student.findById(studentId);
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
      college,
      course,
      currentYear,
      year,
      internshipDomain,
      password,
    } = req.body;

    const cleanFirstName = trimText(firstName);
    const cleanLastName = trimText(lastName);
    const cleanEmail = normalizeEmail(email);
    const cleanMobile = trimText(mobile);
    const cleanCollege = trimText(collegeName || college);
    const cleanCourse = trimText(course);
    const cleanYear = trimText(currentYear || year);
    const cleanInternshipDomain = trimText(internshipDomain) || "General";
    const cleanPassword = typeof password === "string" ? password : "";

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanEmail ||
      !cleanMobile ||
      !cleanCollege ||
      !cleanCourse ||
      !cleanYear ||
      !cleanPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    const minPasswordLength = Number(process.env.MIN_PASSWORD_LENGTH || 6);
    if (cleanPassword.length < minPasswordLength) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${minPasswordLength} characters`,
      });
    }

    const existingStudent = await Student.findOne({
      email: cleanEmail,
    }).lean();

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student already exists",
      });
    }

    const student = await Student.create({
      firstName: cleanFirstName,
      lastName: cleanLastName,
      email: cleanEmail,
      mobile: cleanMobile,
      college: cleanCollege,
      course: cleanCourse,
      year: cleanYear,
      internshipDomain: cleanInternshipDomain,
      password: cleanPassword,
      role: "student",
      accountStatus: "active",
      isVerified: false,
      emailVerified: false,
      mobileVerified: false,
      assessmentCompleted: false,
      assessmentPassed: false,
      internshipUnlocked: false,
      paymentCompleted: false,
      certificateEligible: false,
      scholarshipPercentage: 0,
      leaderboardPoints: 0,
      loginCount: 0,
    });

    const token = generateToken(student);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: "Student registered successfully",
      token,
      student: toSafeStudent(student),
      user: toSafeStudent(student),
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return handleMongoError(error, res);
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

    const cleanEmail = normalizeEmail(email);
    const cleanPassword = typeof password === "string" ? password : "";

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const student = await getStudentPassword(cleanEmail);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (student.accountStatus === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Account blocked",
      });
    }

    if (student.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account suspended",
      });
    }

    let isMatch = false;

    if (typeof student.comparePassword === "function") {
      isMatch = await student.comparePassword(cleanPassword);
    } else {
      isMatch = await bcrypt.compare(cleanPassword, student.password);
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    student.lastLogin = new Date();
    student.loginCount = Number(student.loginCount || 0) + 1;

    await student.save();

    const token = generateToken(student);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      student: toSafeStudent(student),
      user: toSafeStudent(student),
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Student Profile
|--------------------------------------------------------------------------
*/

const getStudentProfile = async (req, res) => {
  try {
    const student = await getStudentByAuthContext(req);

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const profile = await Student.findById(student._id).select("-password");

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      student: profile,
      user: profile,
      profile,
    });
  } catch (error) {
    console.error("PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Profile fetch failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Update Assessment Score
|--------------------------------------------------------------------------
*/

const updateAssessmentScore = async (req, res) => {
  try {
    const student = await getStudentByAuthContext(req);

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const score = toNumber(req.body.score, NaN);

    if (Number.isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: "Score must be a number between 0 and 100",
      });
    }

    const passScore = Number(process.env.ASSESSMENT_PASS_SCORE || 40);
    const scholarship = calculateScholarship(score);
    const passed = score >= passScore;

    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      {
        assessmentScore: score,
        assessmentCompleted: true,
        assessmentPassed: passed,
        assessmentAttemptCount: Number(student.assessmentAttemptCount || 0) + 1,
        assessmentCompletedAt: new Date(),
        scholarshipPercentage: scholarship,
        scholarshipEligible: scholarship > 0,
        internshipUnlocked: passed,
        certificateEligible: passed,
        placementStatus: passed ? "Eligible" : "Not Eligible",
        lastProfileUpdate: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Assessment score updated successfully",
      student: updatedStudent,
      user: updatedStudent,
    });
  } catch (error) {
    console.error("UPDATE ASSESSMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Assessment update failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Logout User
|--------------------------------------------------------------------------
*/

const logoutUser = async (req, res) => {
  try {
    res.clearCookie("cybernet_token", {
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Logout failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Current User
|--------------------------------------------------------------------------
*/

const getCurrentUser = async (req, res) => {
  try {
    const student = await getStudentByAuthContext(req);

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await Student.findById(student._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
      student: user,
    });
  } catch (error) {
    console.error("CURRENT USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "User fetch failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = {
  registerStudent,
  loginStudent,
  getStudentProfile,
  updateAssessmentScore,
  logoutUser,
  getCurrentUser,
};