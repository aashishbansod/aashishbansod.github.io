const express = require("express");

const router = express.Router();

const {
  authMiddleware,
  adminMiddleware,
  studentMiddleware,
} = require("../middleware/authMiddleware");

const {
  createInternship,
  getAllInternships,
  getInternshipById,
  applyInternship,
  getStudentInternships,
  getMyApplications,
  getInternshipApplicants,
  updateInternship,
  deleteInternship,
  selectStudent,
  rejectStudent,
  completeInternship,
  getFeaturedInternships,
  getInternshipStats,
  getDashboardAnalytics,
} = require("../controllers/internshipController");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const validateObjectId = (field = "id") => {
  return (req, res, next) => {
    const value = req.params[field];

    if (!value || !/^[0-9a-fA-F]{24}$/.test(value)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${field}`,
      });
    }

    next();
  };
};

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "CyberNet Internship API",
    status: "Running",
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.get("/", asyncHandler(getAllInternships));

router.get(
  "/featured",
  asyncHandler(getFeaturedInternships)
);

router.get(
  "/:id",
  validateObjectId("id"),
  asyncHandler(getInternshipById)
);

/*
|--------------------------------------------------------------------------
| Student Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/my/applications",
  authMiddleware,
  studentMiddleware,
  asyncHandler(getMyApplications)
);

router.get(
  "/my/internships",
  authMiddleware,
  studentMiddleware,
  asyncHandler(getStudentInternships)
);

router.post(
  "/:id/apply",
  authMiddleware,
  studentMiddleware,
  validateObjectId("id"),
  asyncHandler(applyInternship)
);

/*
|--------------------------------------------------------------------------
| Admin Analytics
|--------------------------------------------------------------------------
*/

router.get(
  "/stats",
  authMiddleware,
  adminMiddleware,
  asyncHandler(getInternshipStats)
);

router.get(
  "/analytics",
  authMiddleware,
  adminMiddleware,
  asyncHandler(getDashboardAnalytics)
);

/*
|--------------------------------------------------------------------------
| Admin Internship CRUD
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  asyncHandler(createInternship)
);

router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateObjectId("id"),
  asyncHandler(updateInternship)
);

router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  validateObjectId("id"),
  asyncHandler(deleteInternship)
);

/*
|--------------------------------------------------------------------------
| Applicant Management
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/applicants",
  authMiddleware,
  adminMiddleware,
  validateObjectId("id"),
  asyncHandler(getInternshipApplicants)
);

router.patch(
  "/:id/applicants/:studentId/select",
  authMiddleware,
  adminMiddleware,
  validateObjectId("id"),
  validateObjectId("studentId"),
  asyncHandler(selectStudent)
);

router.patch(
  "/:id/applicants/:studentId/reject",
  authMiddleware,
  adminMiddleware,
  validateObjectId("id"),
  validateObjectId("studentId"),
  asyncHandler(rejectStudent)
);

router.patch(
  "/:id/applicants/:studentId/complete",
  authMiddleware,
  adminMiddleware,
  validateObjectId("id"),
  validateObjectId("studentId"),
  asyncHandler(completeInternship)
);

/*
|--------------------------------------------------------------------------
| Feature Toggle
|--------------------------------------------------------------------------
*/

router.patch(
  "/:id/feature",
  authMiddleware,
  adminMiddleware,
  validateObjectId("id"),
  async (req, res) => {
    try {
      const Internship = require("../models/Internship");

      const internship =
        await Internship.findById(req.params.id);

      if (!internship) {
        return res.status(404).json({
          success: false,
          message: "Internship not found",
        });
      }

      internship.isFeatured =
        !internship.isFeatured;

      internship.updatedBy =
        req.user?.email ||
        internship.updatedBy;

      await internship.save();

      return res.status(200).json({
        success: true,
        message: internship.isFeatured
          ? "Internship featured successfully"
          : "Internship removed from featured",
        internship,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Route Information
|--------------------------------------------------------------------------
*/

router.get("/routes", (req, res) => {
  return res.status(200).json({
    success: true,
    module: "Internship API",
    routes: {
      public: [
        "GET /",
        "GET /featured",
        "GET /:id",
      ],
      student: [
        "POST /:id/apply",
        "GET /my/applications",
        "GET /my/internships",
      ],
      admin: [
        "POST /",
        "PUT /:id",
        "DELETE /:id",
        "GET /stats",
        "GET /analytics",
        "GET /:id/applicants",
        "PATCH /:id/applicants/:studentId/select",
        "PATCH /:id/applicants/:studentId/reject",
        "PATCH /:id/applicants/:studentId/complete",
        "PATCH /:id/feature",
      ],
    },
  });
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = router;