"use strict";

const express = require("express");

const router = express.Router();

const {
  verifyCertificate,
  verifyCertificateByCode,
  getCertificateById,
  getStudentCertificates,
  issueCertificate,
  revokeCertificate,
  downloadCertificate,
  getCertificateAnalytics,
  companyVerification,
} = require("../controllers/certificateController");

const {
  authMiddleware,
  adminMiddleware,
} = require("../middleware/authMiddleware");

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

function validateCertificateId(req, res, next) {
  const certificateId = String(
    req.params.certificateId || ""
  ).trim();

  if (!certificateId) {
    return res.status(400).json({
      success: false,
      message: "Certificate ID is required",
    });
  }

  req.params.certificateId =
    certificateId.toUpperCase();

  next();
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "CyberNet Certificate API",
    status: "Running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/status", (req, res) => {
  return res.status(200).json({
    success: true,
    company: "CyberNet Technology Systems",
    module: "Certificate Management",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

router.get("/routes", (req, res) => {
  return res.status(200).json({
    success: true,
    routes: [
      "GET /health",
      "GET /status",
      "GET /routes",
      "GET /verify/:certificateId",
      "POST /verify",
      "POST /company-verify",
      "GET /public/:certificateId",
      "GET /my-certificates",
      "GET /download/:certificateId",
      "POST /issue",
      "PATCH /revoke/:certificateId",
      "GET /analytics",
    ],
  });
});

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/verify/:certificateId",
  validateCertificateId,
  asyncHandler(verifyCertificate)
);

router.post(
  "/verify",
  asyncHandler(verifyCertificateByCode)
);

router.post(
  "/company-verify",
  asyncHandler(companyVerification)
);

router.get(
  "/public/:certificateId",
  validateCertificateId,
  asyncHandler(getCertificateById)
);

/*
|--------------------------------------------------------------------------
| Student Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/my-certificates",
  authMiddleware,
  asyncHandler(getStudentCertificates)
);

router.get(
  "/download/:certificateId",
  authMiddleware,
  validateCertificateId,
  asyncHandler(downloadCertificate)
);

/*
|--------------------------------------------------------------------------
| Admin Routes
|--------------------------------------------------------------------------
*/

router.post(
  "/issue",
  authMiddleware,
  adminMiddleware,
  asyncHandler(issueCertificate)
);

router.patch(
  "/revoke/:certificateId",
  authMiddleware,
  adminMiddleware,
  validateCertificateId,
  asyncHandler(revokeCertificate)
);

router.get(
  "/analytics",
  authMiddleware,
  adminMiddleware,
  asyncHandler(getCertificateAnalytics)
);

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

router.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Certificate Route Not Found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = router;