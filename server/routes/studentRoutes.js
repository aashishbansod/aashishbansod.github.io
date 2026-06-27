const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getProfile,
  updateProfile,
  submitProject,
  getTasks,
  completeTask,
  getNotifications,
  markNotificationRead,
  getLeaderboard,
  getStats,
} = require("../controllers/studentController");

const {
  authMiddleware,
  studentMiddleware,
} = require("../middleware/authMiddleware");

/*
|--------------------------------------------------------------------------
| Async Wrapper
|--------------------------------------------------------------------------
*/
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/*
|--------------------------------------------------------------------------
| Health / Meta
|--------------------------------------------------------------------------
*/
router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "CyberNet Student API",
    status: "Running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/version", (req, res) => {
  return res.status(200).json({
    success: true,
    module: "Student Portal",
    version: "2.0.0",
    company: "CyberNet Technology Systems",
    timestamp: new Date().toISOString(),
  });
});

router.get("/routes", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "CyberNet Student API",
    routes: [
      "GET    /health",
      "GET    /version",
      "GET    /routes",
      "GET    /dashboard",
      "GET    /overview",
      "GET    /dashboard/refresh",
      "GET    /summary",
      "GET    /profile",
      "GET    /me",
      "GET    /account",
      "PUT    /profile",
      "PATCH  /profile",
      "GET    /tasks",
      "PATCH  /tasks/:taskId/complete",
      "POST   /project/submit",
      "GET    /notifications",
      "PATCH  /notifications/:id/read",
      "GET    /leaderboard",
      "GET    /stats",
    ],
  });
});

/*
|--------------------------------------------------------------------------
| Auth Guard
|--------------------------------------------------------------------------
*/
router.use(authMiddleware);
router.use(studentMiddleware);

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/
router.get("/dashboard", asyncHandler(getDashboard));
router.get("/overview", asyncHandler(getDashboard));
router.get("/dashboard/refresh", asyncHandler(getDashboard));
router.get("/summary", asyncHandler(getDashboard));

/*
|--------------------------------------------------------------------------
| Profile
|--------------------------------------------------------------------------
*/
router.get("/profile", asyncHandler(getProfile));
router.get("/me", asyncHandler(getProfile));
router.get("/account", asyncHandler(getProfile));

router.put("/profile", asyncHandler(updateProfile));
router.patch("/profile", asyncHandler(updateProfile));

/*
|--------------------------------------------------------------------------
| Tasks
|--------------------------------------------------------------------------
*/
router.get("/tasks", asyncHandler(getTasks));
router.patch("/tasks/:taskId/complete", asyncHandler(completeTask));

/*
|--------------------------------------------------------------------------
| Project Submission
|--------------------------------------------------------------------------
*/
router.post("/project/submit", asyncHandler(submitProject));

/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
*/
router.get("/notifications", asyncHandler(getNotifications));
router.patch("/notifications/:id/read", asyncHandler(markNotificationRead));

/*
|--------------------------------------------------------------------------
| Leaderboard
|--------------------------------------------------------------------------
*/
router.get("/leaderboard", asyncHandler(getLeaderboard));

/*
|--------------------------------------------------------------------------
| Stats
|--------------------------------------------------------------------------
*/
router.get("/stats", asyncHandler(getStats));

/*
|--------------------------------------------------------------------------
| Fallback
|--------------------------------------------------------------------------
*/
router.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Student Route Not Found",
    path: req.originalUrl,
    method: req.method,
  });
});

module.exports = router;