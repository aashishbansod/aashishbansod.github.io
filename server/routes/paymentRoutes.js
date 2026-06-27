"use strict";

const express = require("express");

const router = express.Router();

const {
  authMiddleware,
  adminMiddleware,
  studentMiddleware,
} = require("../middleware/authMiddleware");

const Payment = require("../models/Payment");

const {
  createPaymentOrder,
  verifyPayment,
  paytmCallback,
  getMyPayments,
  getAllPayments,
  getPaymentById,
  getRevenueStats,
} = require("../controllers/paymentController");

function isValidId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/*
|--------------------------------------------------------------------------
| HEALTH & STATUS
|--------------------------------------------------------------------------
*/

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "CyberNet Payment API",
    status: "Running",
    timestamp: new Date().toISOString(),
  });
});

router.get("/status", (req, res) => {
  return res.status(200).json({
    success: true,
    module: "Payment Management",
    version: "1.0.0",
    company: "CyberNet Technology Systems",
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| STUDENT PAYMENT ROUTES
|--------------------------------------------------------------------------
*/

router.post(
  "/create-order",
  authMiddleware,
  studentMiddleware,
  createPaymentOrder
);

router.post(
  "/verify",
  authMiddleware,
  studentMiddleware,
  verifyPayment
);

router.get(
  "/my-payments",
  authMiddleware,
  studentMiddleware,
  getMyPayments
);

/*
|--------------------------------------------------------------------------
| PAYMENT GATEWAY CALLBACKS
|--------------------------------------------------------------------------
*/

router.post("/paytm/callback", paytmCallback);

/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
*/

router.get(
  "/admin/payments",
  authMiddleware,
  adminMiddleware,
  getAllPayments
);

router.get(
  "/admin/revenue",
  authMiddleware,
  adminMiddleware,
  getRevenueStats
);

router.get(
  "/admin/payment/:id",
  authMiddleware,
  adminMiddleware,
  getPaymentById
);

/*
|--------------------------------------------------------------------------
| ADMIN SUMMARY
|--------------------------------------------------------------------------
*/

router.get(
  "/admin/summary",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const [
        totalPayments,
        successPayments,
        pendingPayments,
        failedPayments,
      ] = await Promise.all([
        Payment.countDocuments(),
        Payment.countDocuments({ paymentStatus: "SUCCESS" }),
        Payment.countDocuments({ paymentStatus: "PENDING" }),
        Payment.countDocuments({ paymentStatus: "FAILED" }),
      ]);

      return res.status(200).json({
        success: true,
        summary: {
          totalPayments,
          successPayments,
          pendingPayments,
          failedPayments,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to load payment summary",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| PAYMENT LOOKUP
|--------------------------------------------------------------------------
*/

router.get("/lookup/:id", authMiddleware, async (req, res) => {
  try {
    const lookupId = String(req.params.id || "").trim();

    if (!isValidId(lookupId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment id",
      });
    }

    const payment = await Payment.findOne({
      $or: [{ paymentId: lookupId }, { orderId: lookupId }],
    })
      .populate(
        "student",
        "firstName lastName email mobile college course year internshipDomain role"
      )
      .populate(
        "internship",
        "title internshipCode domain duration companyName internshipType"
      );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (
      req.user?.role !== "admin" &&
      String(payment.student?._id || payment.student) !== String(req.user?.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load payment",
    });
  }
});

/*
|--------------------------------------------------------------------------
| ROUTE INFORMATION
|--------------------------------------------------------------------------
*/

router.get("/routes", (req, res) => {
  return res.status(200).json({
    success: true,
    routes: [
      "/health",
      "/status",
      "/create-order",
      "/verify",
      "/my-payments",
      "/paytm/callback",
      "/admin/payments",
      "/admin/payment/:id",
      "/admin/revenue",
      "/admin/summary",
      "/lookup/:id",
    ],
  });
});

/*
|--------------------------------------------------------------------------
| NOT FOUND
|--------------------------------------------------------------------------
*/

router.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Payment Route Not Found",
    path: req.originalUrl,
    method: req.method,
  });
});

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = router;