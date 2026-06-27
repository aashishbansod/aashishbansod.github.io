const express = require("express");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Route Imports
|--------------------------------------------------------------------------
*/

const authRoutes = require("./authRoutes");
const studentRoutes = require("./studentRoutes");
const internshipRoutes = require("./internshipRoutes");
const assessmentRoutes = require("./assessmentRoutes");
const paymentRoutes = require("./paymentRoutes");
const certificateRoutes = require("./certificateRoutes");
const adminRoutes = require("./adminRoutes");

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    company: "CyberNet Technology Systems",
    project: "CyberNet Internship Portal API",
    version: "1.0.0",
    status: "Running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "API Server Healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| Module Routes
|--------------------------------------------------------------------------
*/

router.use("/auth", authRoutes);
router.use("/students", studentRoutes);
router.use("/internships", internshipRoutes);
router.use("/assessments", assessmentRoutes);
router.use("/payments", paymentRoutes);
router.use("/certificates", certificateRoutes);
router.use("/admin", adminRoutes);

/*
|--------------------------------------------------------------------------
| API Information
|--------------------------------------------------------------------------
*/

router.get("/routes", (req, res) => {
  return res.status(200).json({
    success: true,
    routes: {
      auth: "/api/auth",
      students: "/api/students",
      internships: "/api/internships",
      assessments: "/api/assessments",
      payments: "/api/payments",
      certificates: "/api/certificates",
      admin: "/api/admin",
    },
  });
});

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

router.use("*", (req, res) => {
  return res.status(404).json({
    success: false,
    message: "API Route Not Found",
    method: req.method,
    path: req.originalUrl,
  });
});

module.exports = router;