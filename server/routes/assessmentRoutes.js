const express = require("express");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Controllers
|--------------------------------------------------------------------------
*/

const {
  getAssessmentQuestions,
  submitAssessment,
  getMyResult,
  getLeaderboard,
  healthCheck,
} = require("../controllers/assessmentController");

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

const {
  authMiddleware,
  adminMiddleware,
} = require("../middleware/authMiddleware");

/*
|--------------------------------------------------------------------------
| Async Handler
|--------------------------------------------------------------------------
*/

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/*
|--------------------------------------------------------------------------
| Security Headers
|--------------------------------------------------------------------------
*/

router.use((req, res, next) => {
  res.setHeader("X-Service", "CyberNet Assessment API");
  next();
});

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/health",
  asyncHandler(healthCheck)
);

router.get("/routes", (req, res) => {
  return res.status(200).json({
    success: true,
    module: "CyberNet Assessment API",
    version: "1.0.0",
    routes: {
      public: [
        "GET /health",
        "GET /routes",
        "GET /leaderboard",
      ],
      protected: [
        "GET /questions",
        "POST /submit",
        "GET /result",
      ],
      admin: [
        "GET /admin/stats",
      ],
    },
    timestamp: new Date().toISOString(),
  });
});

router.get(
  "/leaderboard",
  asyncHandler(getLeaderboard)
);

/*
|--------------------------------------------------------------------------
| Protected Routes
|--------------------------------------------------------------------------
*/

router.use(authMiddleware);

router.get(
  "/questions",
  asyncHandler(getAssessmentQuestions)
);

router.post(
  "/submit",
  asyncHandler(submitAssessment)
);

router.get(
  "/result",
  asyncHandler(getMyResult)
);

/*
|--------------------------------------------------------------------------
| Admin Analytics
|--------------------------------------------------------------------------
*/

router.get(
  "/admin/stats",
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const Student = require("../models/Student");
    const Result = require("../models/Result");

    const [
      totalStudents,
      completedAssessments,
      passedStudents,
      totalResults,
      certificatesEligible,
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({
        assessmentCompleted: true,
      }),
      Student.countDocuments({
        assessmentPassed: true,
      }),
      Result.countDocuments(),
      Result.countDocuments({
        certificateEligible: true,
      }),
    ]);

    const failedStudents =
      completedAssessments - passedStudents;

    const passPercentage =
      completedAssessments > 0
        ? Number(
            (
              (passedStudents /
                completedAssessments) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.status(200).json({
      success: true,
      analytics: {
        totalStudents,
        completedAssessments,
        passedStudents,
        failedStudents,
        totalResults,
        certificatesEligible,
        passPercentage,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/*
|--------------------------------------------------------------------------
| Route Not Found
|--------------------------------------------------------------------------
*/

router.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Assessment Route Not Found",
    path: req.originalUrl,
    method: req.method,
  });
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = router;