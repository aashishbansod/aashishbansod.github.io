"use strict";

const jwt = require("jsonwebtoken");
const Student = require("../models/Student");

/*
|--------------------------------------------------------------------------
| Config
|--------------------------------------------------------------------------
*/

const TOKEN_COOKIE_NAMES = ["cybernet_token", "token", "authToken"];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getTokenFromRequest(req) {
  const authHeader = req.headers?.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  for (const cookieName of TOKEN_COOKIE_NAMES) {
    const cookieToken = req.cookies?.[cookieName];
    if (cookieToken && typeof cookieToken === "string" && cookieToken.trim()) {
      return cookieToken.trim();
    }
  }

  return null;
}

function createUserObject(student) {
  return {
    id: student._id?.toString?.() || student._id,
    role: student.role || "student",
    email: student.email || "",
    firstName: student.firstName || "",
    lastName: student.lastName || "",
    fullName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
    assessmentCompleted: Boolean(student.assessmentCompleted),
    assessmentScore: Number(student.assessmentScore || 0),
    scholarshipPercentage: Number(student.scholarshipPercentage || 0),
    internshipUnlocked: Boolean(student.internshipUnlocked),
    certificateEligible: Boolean(student.certificateEligible),
    accountStatus: student.accountStatus || "active",
  };
}

async function getStudentFromToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (!decoded?.id) {
    throw new Error("Invalid token payload");
  }

  const student = await Student.findById(decoded.id).select("-password");
  return student;
}

function accountValidation(student, res) {
  if (!student) {
    return res.status(401).json({
      success: false,
      message: "Account not found",
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

  if (student.isActive === false) {
    return res.status(403).json({
      success: false,
      message: "Account disabled",
    });
  }

  return null;
}

async function loadFreshStudent(studentId) {
  if (!studentId) return null;
  return Student.findById(studentId).select("-password");
}

/*
|--------------------------------------------------------------------------
| Main Auth Middleware
|--------------------------------------------------------------------------
*/

async function authMiddleware(req, res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const student = await getStudentFromToken(token);

    const validationError = accountValidation(student, res);
    if (validationError) return validationError;

    req.user = createUserObject(student);
    req.student = student;

    return next();
  } catch (error) {
    const message =
      error?.name === "TokenExpiredError"
        ? "Token expired"
        : "Invalid or expired token";

    console.error("AUTH ERROR:", error.message);

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| Role Middleware
|--------------------------------------------------------------------------
*/

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    return next();
  };
}

const adminMiddleware = requireRole("admin");
const studentMiddleware = requireRole("student");
const mentorMiddleware = requireRole("mentor");
const adminOrMentor = requireRole("admin", "mentor");

/*
|--------------------------------------------------------------------------
| Assessment Required
|--------------------------------------------------------------------------
*/

async function assessmentRequired(req, res, next) {
  try {
    const studentId = req.user?.id;
    const student = req.student || (await loadFreshStudent(studentId));

    if (!student || !student.assessmentCompleted) {
      return res.status(403).json({
        success: false,
        message: "Complete assessment first",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Assessment access check failed",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Internship Required
|--------------------------------------------------------------------------
*/

async function internshipUnlockedRequired(req, res, next) {
  try {
    const studentId = req.user?.id;
    const student = req.student || (await loadFreshStudent(studentId));

    if (!student || !student.internshipUnlocked) {
      return res.status(403).json({
        success: false,
        message: "Pass assessment first to unlock internships",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internship access check failed",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Certificate Required
|--------------------------------------------------------------------------
*/

async function certificateEligibleRequired(req, res, next) {
  try {
    const studentId = req.user?.id;
    const student = req.student || (await loadFreshStudent(studentId));

    if (!student || !student.certificateEligible) {
      return res.status(403).json({
        success: false,
        message: "Certificate not available yet",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Certificate access check failed",
    });
  }
}

/*
|--------------------------------------------------------------------------
| Optional Auth
|--------------------------------------------------------------------------
*/

async function optionalAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return next();
    }

    const student = await getStudentFromToken(token);
    const validationError = accountValidation(student, res);

    if (validationError) {
      return next();
    }

    if (student) {
      req.user = createUserObject(student);
      req.student = student;
    }

    return next();
  } catch {
    return next();
  }
}

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  authMiddleware,
  adminMiddleware,
  studentMiddleware,
  mentorMiddleware,
  adminOrMentor,
  assessmentRequired,
  internshipUnlockedRequired,
  certificateEligibleRequired,
  optionalAuth,
  requireRole,
};