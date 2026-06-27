const mongoose = require("mongoose");
const crypto = require("crypto");

const Payment = require("../models/Payment");
const Student = require("../models/Student");
const Internship = require("../models/Internship");

let Razorpay = null;
try {
  Razorpay = require("razorpay");
} catch {
  Razorpay = null;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : value;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

const generateUniqueId = (prefix) => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${year}-${random}`;
};

const getRazorpayClient = () => {
  if (
    !Razorpay ||
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET
  ) {
    return null;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const getApplicationByStudentId = (internship, studentId) => {
  if (!internship?.applications?.length) return null;

  return internship.applications.find(
    (app) => String(app.student) === String(studentId)
  );
};

const getScholarshipDiscountAmount = (baseAmount, scholarshipPercentage) => {
  const base = Math.max(toNumber(baseAmount, 0), 0);
  const pct = Math.max(Math.min(toNumber(scholarshipPercentage, 0), 100), 0);

  const discount = Math.round((base * pct) / 100);
  return Math.min(discount, base);
};

const getCouponDiscountAmount = (baseAmount, couponDiscount) => {
  const base = Math.max(toNumber(baseAmount, 0), 0);
  const discount = Math.max(toNumber(couponDiscount, 0), 0);
  return Math.min(discount, base);
};

const buildAmountBreakdown = ({
  baseAmount,
  scholarshipPercentage,
  scholarshipDiscount,
  couponDiscount,
  gstPercentage,
}) => {
  const base = Math.max(toNumber(baseAmount, 0), 0);
  const scholarshipPct = Math.max(
    Math.min(toNumber(scholarshipPercentage, 0), 100),
    0
  );
  const scholarshipAmount = Math.max(toNumber(scholarshipDiscount, 0), 0);
  const couponAmount = Math.max(toNumber(couponDiscount, 0), 0);
  const gstPct = Math.max(Math.min(toNumber(gstPercentage, 18), 100), 0);

  const discountedAmount = Math.max(base - scholarshipAmount - couponAmount, 0);
  const gstAmount = Math.round((discountedAmount * gstPct) / 100);
  const finalAmount = discountedAmount + gstAmount;

  return {
    baseAmount: base,
    scholarshipPercentage: scholarshipPct,
    scholarshipDiscount: scholarshipAmount,
    couponDiscount: couponAmount,
    gstPercentage: gstPct,
    gstAmount,
    discountedAmount,
    finalAmount,
  };
};

const buildInternalOrderId = () => generateUniqueId("ORD");
const buildInternalPaymentId = () => generateUniqueId("PAY");

const safeStudentSelect = "-password";

const findPaymentByAnyKey = async ({
  paymentId,
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  transactionId,
  gatewayTransactionId,
  paytmOrderId,
}) => {
  const filters = [];

  if (paymentId) filters.push({ paymentId });
  if (orderId) filters.push({ orderId });
  if (razorpayOrderId) filters.push({ razorpayOrderId });
  if (razorpayPaymentId) filters.push({ razorpayPaymentId });
  if (transactionId) filters.push({ transactionId });
  if (gatewayTransactionId) filters.push({ gatewayTransactionId });
  if (paytmOrderId) filters.push({ paytmOrderId });

  if (!filters.length) return null;

  return Payment.findOne({
    $or: filters,
  });
};

const buildPaymentQuery = (req) => {
  const query = {};
  const { status, gateway, studentId, internshipId, search } = req.query || {};

  if (status) query.paymentStatus = String(status).trim().toUpperCase();
  if (gateway) query.paymentGateway = String(gateway).trim().toUpperCase();
  if (studentId && isValidObjectId(studentId)) query.student = studentId;
  if (internshipId && isValidObjectId(internshipId)) query.internship = internshipId;

  if (search) {
    const regex = new RegExp(String(search).trim(), "i");
    query.$or = [
      { paymentId: regex },
      { orderId: regex },
      { gatewayTransactionId: regex },
      { transactionId: regex },
      { razorpayOrderId: regex },
      { razorpayPaymentId: regex },
      { paytmOrderId: regex },
      { paytmTxnId: regex },
    ];
  }

  return query;
};

async function finalizeSuccessfulPayment({
  payment,
  gatewayResponse = {},
  gatewayTransactionId = "",
  transactionId = "",
  paymentGateway = "RAZORPAY",
  razorpayOrderId = "",
  razorpayPaymentId = "",
  razorpaySignature = "",
  paytmOrderId = "",
  paytmTxnId = "",
  paytmStatus = "",
  verifiedByAdmin = false,
}) {
  const [student, internship] = await Promise.all([
    Student.findById(payment.student),
    Internship.findById(payment.internship),
  ]);

  if (!student) throw new Error("Student not found");
  if (!internship) throw new Error("Internship not found");

  let application = getApplicationByStudentId(internship, student._id);
  const alreadySuccessful = application?.paymentStatus === "SUCCESS";

  if (!application) {
    application = {
      student: student._id,
      internshipId: student.internshipId || "",
      assessmentScore: toNumber(student.assessmentScore, 0),
      scholarshipPercentage: toNumber(student.scholarshipPercentage, 0),
      originalFee: toNumber(payment.amount, 0),
      discountAmount: toNumber(
        payment.scholarshipDiscount + payment.couponDiscount,
        0
      ),
      finalFee: toNumber(payment.finalAmount, 0),
      paymentCompleted: true,
      paymentStatus: "SUCCESS",
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      status: "In Progress",
      appliedAt: new Date(),
      selectedAt: new Date(),
      adminRemark: "Auto-created after successful payment",
    };

    internship.applications.push(application);
  } else {
    application.originalFee = toNumber(payment.amount, application.originalFee);
    application.discountAmount = toNumber(
      payment.scholarshipDiscount + payment.couponDiscount,
      application.discountAmount
    );
    application.finalFee = toNumber(payment.finalAmount, application.finalFee);
    application.paymentCompleted = true;
    application.paymentStatus = "SUCCESS";
    application.paymentId = payment.paymentId;
    application.orderId = payment.orderId;
    application.selectedAt = application.selectedAt || new Date();
    application.status =
      application.status === "Completed" ? "Completed" : "In Progress";
  }

  if (!alreadySuccessful) {
    internship.totalRevenue =
      toNumber(internship.totalRevenue, 0) + toNumber(payment.finalAmount, 0);
  }

  if (typeof internship.recalculateAnalytics === "function") {
    internship.recalculateAnalytics();
  }

  student.paymentCompleted = true;
  student.paymentStatus = "SUCCESS";
  student.paymentId = payment.paymentId;
  student.paymentDate = new Date();
  student.paidAmount = toNumber(payment.finalAmount, 0);
  student.internshipStatus =
    application.status === "Completed" ? "Completed" : "In Progress";
  student.internshipApproved = true;
  student.internshipApprovedAt = new Date();
  student.currentInternship = internship._id;
  student.internshipUnlocked = true;
  student.scholarshipEligible = toNumber(student.scholarshipPercentage, 0) > 0;
  student.internshipStartDate = student.internshipStartDate || new Date();
  student.appliedInternshipAt = student.appliedInternshipAt || new Date();
  student.internshipId =
    student.internshipId && String(student.internshipId).trim() !== ""
      ? student.internshipId
      : generateUniqueId("CNT-INT");
  student.lastProfileUpdate = new Date();

  payment.paymentGateway = paymentGateway || payment.paymentGateway || "RAZORPAY";
  payment.paymentStatus = "SUCCESS";
  payment.successAt = payment.successAt || new Date();
  payment.verifiedAt = new Date();
  payment.verifiedByAdmin = verifiedByAdmin;
  payment.gatewayResponse = gatewayResponse || {};
  payment.gatewayTransactionId =
    gatewayTransactionId ||
    transactionId ||
    payment.gatewayTransactionId ||
    "";
  payment.transactionId = transactionId || payment.transactionId || "";
  payment.razorpayOrderId = razorpayOrderId || payment.razorpayOrderId || "";
  payment.razorpayPaymentId =
    razorpayPaymentId || payment.razorpayPaymentId || "";
  payment.razorpaySignature =
    razorpaySignature || payment.razorpaySignature || "";
  payment.paytmOrderId = paytmOrderId || payment.paytmOrderId || "";
  payment.paytmTxnId = paytmTxnId || payment.paytmTxnId || "";
  payment.paytmStatus = paytmStatus || payment.paytmStatus || "";

  await Promise.all([internship.save(), student.save(), payment.save()]);

  return {
    student,
    internship,
    application,
    payment,
  };
}

/*
|--------------------------------------------------------------------------
| Create Payment Order
|--------------------------------------------------------------------------
*/

const createPaymentOrder = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const {
      internshipId,
      couponCode = "",
      couponDiscount = 0,
      gstPercentage = 18,
    } = req.body;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isValidObjectId(internshipId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid internship ID",
      });
    }

    const [student, internship] = await Promise.all([
      Student.findById(studentId),
      Internship.findById(internshipId),
    ]);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (!internship) {
      return res.status(404).json({
        success: false,
        message: "Internship not found",
      });
    }

    if (!internship.isActive || internship.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Internship is not active",
      });
    }

    const deadline = internship.applicationDeadline
      ? new Date(internship.applicationDeadline)
      : null;

    if (deadline && new Date() > deadline) {
      return res.status(400).json({
        success: false,
        message: "Application deadline has passed",
      });
    }

    const application = getApplicationByStudentId(internship, student._id);

    if (!application) {
      return res.status(400).json({
        success: false,
        message: "Apply for the internship first",
      });
    }

    if (
      internship.assessmentRequired &&
      (!student.assessmentCompleted ||
        !student.assessmentPassed ||
        !student.internshipUnlocked)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Assessment must be completed and passed before payment",
      });
    }

    if (
      toNumber(student.assessmentScore, 0) <
      toNumber(internship.minimumScoreRequired, 60)
    ) {
      return res.status(403).json({
        success: false,
        message: "Assessment score is below the required cutoff",
      });
    }

    const existingPayment = await Payment.findOne({
      student: student._id,
      internship: internship._id,
      paymentStatus: {
        $in: ["PENDING", "PROCESSING", "SUCCESS"],
      },
    }).sort({ createdAt: -1 });

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message:
          existingPayment.paymentStatus === "SUCCESS"
            ? "Payment already completed"
            : "Existing payment order found",
        payment: existingPayment,
        reused: true,
      });
    }

    const baseAmount = toNumber(
      application.originalFee || internship.internshipFee,
      0
    );

    const scholarshipPercentage = internship.scholarshipEnabled
      ? toNumber(student.scholarshipPercentage, 0)
      : 0;

    const scholarshipDiscount = application.discountAmount
      ? toNumber(application.discountAmount, 0)
      : getScholarshipDiscountAmount(baseAmount, scholarshipPercentage);

    const couponDiscountAmount = getCouponDiscountAmount(
      baseAmount - scholarshipDiscount,
      couponDiscount
    );

    const amounts = buildAmountBreakdown({
      baseAmount,
      scholarshipPercentage,
      scholarshipDiscount,
      couponDiscount: couponDiscountAmount,
      gstPercentage,
    });

    const paymentId = buildInternalPaymentId();
    const orderId = buildInternalOrderId();
    const receiptNumber = generateUniqueId("RCPT");
    const invoiceNumber = generateUniqueId("INV");

    const razorpayClient = getRazorpayClient();
    let gatewayOrder = null;
    let paymentGateway = "PAYTM";

    if (razorpayClient) {
      paymentGateway = "RAZORPAY";

      gatewayOrder = await razorpayClient.orders.create({
        amount: Math.max(Math.round(amounts.finalAmount * 100), 1),
        currency: "INR",
        receipt: receiptNumber,
        notes: {
          paymentId,
          studentId: String(student._id),
          internshipId: String(internship._id),
          internshipCode: internship.internshipCode || "",
        },
      });
    }

    const payment = await Payment.create({
      student: student._id,
      internship: internship._id,
      paymentId,
      orderId,
      razorpayOrderId: gatewayOrder?.id || "",
      paymentGateway,
      amount: amounts.baseAmount,
      scholarshipDiscount: amounts.scholarshipDiscount,
      couponCode: normalizeText(couponCode),
      couponDiscount: amounts.couponDiscount,
      gstPercentage: amounts.gstPercentage,
      gstAmount: amounts.gstAmount,
      finalAmount: amounts.finalAmount,
      currency: "INR",
      paymentStatus: "PENDING",
      receiptNumber,
      invoiceNumber,
      gatewayResponse: gatewayOrder || {},
      ipAddress: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(201).json({
      success: true,
      message: "Payment order created successfully",
      gateway: paymentGateway,
      keyId: process.env.RAZORPAY_KEY_ID || "",
      order: gatewayOrder || {
        id: orderId,
        amount: Math.max(Math.round(amounts.finalAmount * 100), 1),
        currency: "INR",
        receipt: receiptNumber,
      },
      payment,
      feeBreakdown: {
        baseAmount: amounts.baseAmount,
        scholarshipPercentage: amounts.scholarshipPercentage,
        scholarshipDiscount: amounts.scholarshipDiscount,
        couponDiscount: amounts.couponDiscount,
        gstPercentage: amounts.gstPercentage,
        gstAmount: amounts.gstAmount,
        finalAmount: amounts.finalAmount,
      },
    });
  } catch (error) {
    console.error("CREATE PAYMENT ORDER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create payment order",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Verify Payment
|--------------------------------------------------------------------------
*/

const verifyPayment = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const {
      paymentId,
      orderId,
      transactionId,
      gatewayTransactionId,
      paymentGateway,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paytmOrderId,
      paytmTxnId,
      paytmStatus,
      gatewayResponse = {},
    } = req.body;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const payment = await findPaymentByAnyKey({
      paymentId,
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      transactionId,
      gatewayTransactionId,
      paytmOrderId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (
      String(payment.student) !== String(studentId) &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to verify this payment",
      });
    }

    const gateway = String(
      paymentGateway || payment.paymentGateway || ""
    ).toUpperCase();

    if (
      gateway === "RAZORPAY" ||
      razorpayOrderId ||
      razorpayPaymentId ||
      razorpaySignature
    ) {
      const orderIdToVerify =
        razorpayOrderId || payment.razorpayOrderId || payment.orderId;
      const paymentIdToVerify =
        razorpayPaymentId || payment.razorpayPaymentId;
      const signatureToVerify = razorpaySignature || payment.razorpaySignature;

      if (!orderIdToVerify || !paymentIdToVerify || !signatureToVerify) {
        return res.status(400).json({
          success: false,
          message: "Missing Razorpay verification data",
        });
      }

      if (process.env.RAZORPAY_KEY_SECRET && Razorpay) {
        const expectedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
          .update(`${orderIdToVerify}|${paymentIdToVerify}`)
          .digest("hex");

        if (expectedSignature !== signatureToVerify) {
          return res.status(400).json({
            success: false,
            message: "Invalid payment signature",
          });
        }
      }

      payment.paymentGateway = "RAZORPAY";
      payment.razorpayOrderId = orderIdToVerify;
      payment.razorpayPaymentId = paymentIdToVerify;
      payment.razorpaySignature = signatureToVerify;
      payment.gatewayTransactionId =
        gatewayTransactionId || paymentIdToVerify;
      payment.transactionId = transactionId || payment.transactionId || "";
      payment.gatewayResponse = gatewayResponse || {};
      payment.paymentStatus = "SUCCESS";
      payment.successAt = new Date();
      payment.verifiedAt = new Date();
    } else {
      if (!transactionId && !gatewayTransactionId && !paytmTxnId) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID is required",
        });
      }

      payment.paymentGateway = payment.paymentGateway || "PAYTM";
      payment.transactionId = transactionId || payment.transactionId || "";
      payment.gatewayTransactionId =
        gatewayTransactionId ||
        transactionId ||
        payment.gatewayTransactionId ||
        "";
      payment.paytmOrderId =
        paytmOrderId || payment.paytmOrderId || payment.orderId;
      payment.paytmTxnId = paytmTxnId || payment.paytmTxnId || "";
      payment.paytmStatus = paytmStatus || payment.paytmStatus || "TXN_SUCCESS";
      payment.gatewayResponse = gatewayResponse || {};
      payment.paymentStatus = "SUCCESS";
      payment.successAt = new Date();
      payment.verifiedAt = new Date();
    }

    await finalizeSuccessfulPayment({
      payment,
      gatewayResponse: gatewayResponse || {},
      gatewayTransactionId:
        gatewayTransactionId ||
        transactionId ||
        razorpayPaymentId ||
        paytmTxnId ||
        "",
      transactionId: transactionId || payment.transactionId || "",
      paymentGateway: payment.paymentGateway,
      razorpayOrderId: payment.razorpayOrderId || "",
      razorpayPaymentId: payment.razorpayPaymentId || "",
      razorpaySignature: payment.razorpaySignature || "",
      paytmOrderId: payment.paytmOrderId || "",
      paytmTxnId: payment.paytmTxnId || "",
      paytmStatus: payment.paytmStatus || "",
      verifiedByAdmin: false,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment,
    });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Payment verification failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Paytm Callback
|--------------------------------------------------------------------------
*/

const paytmCallback = async (req, res) => {
  try {
    const {
      ORDERID,
      TXNID,
      STATUS,
      RESPMSG,
    } = req.body;

    const payment = await Payment.findOne({
      $or: [{ orderId: ORDERID }, { paytmOrderId: ORDERID }],
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    payment.paytmOrderId = ORDERID || payment.paytmOrderId;
    payment.paytmTxnId = TXNID || payment.paytmTxnId;
    payment.paytmStatus = STATUS || payment.paytmStatus;
    payment.gatewayResponse = req.body || {};
    payment.paymentGateway = "PAYTM";
    payment.gatewayTransactionId = TXNID || payment.gatewayTransactionId || "";
    payment.transactionId = TXNID || payment.transactionId || "";

    if (STATUS === "TXN_SUCCESS") {
      payment.paymentStatus = "SUCCESS";
      payment.successAt = new Date();
      payment.verifiedAt = new Date();

      await finalizeSuccessfulPayment({
        payment,
        gatewayResponse: req.body || {},
        gatewayTransactionId: TXNID || "",
        transactionId: TXNID || "",
        paymentGateway: "PAYTM",
        paytmOrderId: ORDERID || "",
        paytmTxnId: TXNID || "",
        paytmStatus: STATUS || "",
        verifiedByAdmin: false,
      });
    } else {
      payment.paymentStatus = "FAILED";
      payment.adminRemark = RESPMSG || payment.adminRemark || "";
      await payment.save();
    }

    return res.status(200).json({
      success: true,
      message:
        STATUS === "TXN_SUCCESS"
          ? "Paytm payment processed successfully"
          : "Paytm payment failed",
    });
  } catch (error) {
    console.error("PAYTM CALLBACK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Callback processing failed",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Student Payments
|--------------------------------------------------------------------------
*/

const getMyPayments = async (req, res) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const payments = await Payment.find({
      student: studentId,
    })
      .populate(
        "internship",
        "title internshipCode domain duration companyName internshipType"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load payments",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Admin Payments
|--------------------------------------------------------------------------
*/

const getAllPayments = async (req, res) => {
  try {
    const query = buildPaymentQuery(req);
    const payments = await Payment.find(query)
      .populate(
        "student",
        "firstName lastName email mobile college course year internshipDomain role"
      )
      .populate(
        "internship",
        "title internshipCode domain duration companyName internshipType"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load payments",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Payment Details
|--------------------------------------------------------------------------
*/

const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
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
};

/*
|--------------------------------------------------------------------------
| Revenue Analytics
|--------------------------------------------------------------------------
*/

const getRevenueStats = async (req, res) => {
  try {
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "SUCCESS"] },
                "$finalAmount",
                0,
              ],
            },
          },
          totalPayments: {
            $sum: 1,
          },
          successPayments: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "SUCCESS"] }, 1, 0],
            },
          },
          failedPayments: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "FAILED"] }, 1, 0],
            },
          },
          pendingPayments: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "PENDING"] }, 1, 0],
            },
          },
          refundedPayments: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "REFUNDED"] }, 1, 0],
            },
          },
          averageTicket: {
            $avg: {
              $cond: [
                { $eq: ["$paymentStatus", "SUCCESS"] },
                "$finalAmount",
                null,
              ],
            },
          },
        },
      },
    ]);

    const revenue = stats[0] || {
      totalRevenue: 0,
      totalPayments: 0,
      successPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      refundedPayments: 0,
      averageTicket: 0,
    };

    return res.status(200).json({
      success: true,
      revenue: {
        ...revenue,
        averageTicket: Number(toNumber(revenue.averageTicket, 0).toFixed(2)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load revenue stats",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  createPaymentOrder,
  verifyPayment,
  paytmCallback,
  getMyPayments,
  getAllPayments,
  getPaymentById,
  getRevenueStats,
};