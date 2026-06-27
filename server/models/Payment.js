const mongoose = require("mongoose");
const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : value;

const generateReceiptNumber = () => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `RCPT-${year}-${random}`;
};

const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `INV-${year}-${random}`;
};

const generatePaymentId = () => {
  return `PAY-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
};

const clampNumber = (value, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
};

/*
|--------------------------------------------------------------------------
| Payment Schema
|--------------------------------------------------------------------------
*/

const paymentSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | References
    |--------------------------------------------------------------------------
    */

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    internship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Internship",
      required: true,
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Payment IDs
    |--------------------------------------------------------------------------
    */

    paymentId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      index: true,
    },

    orderId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },

    transactionId: {
      type: String,
      default: "",
      trim: true,
    },

    gatewayTransactionId: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Razorpay
    |--------------------------------------------------------------------------
    */

    razorpayOrderId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    razorpaySignature: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Gateway
    |--------------------------------------------------------------------------
    */

    paymentGateway: {
      type: String,
      enum: ["PAYTM", "RAZORPAY", "PHONEPE", "UPI", "BANK_TRANSFER"],
      default: "RAZORPAY",
      index: true,
    },

    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /*
    |--------------------------------------------------------------------------
    | Amount Details
    |--------------------------------------------------------------------------
    */

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    scholarshipDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    couponCode: {
      type: String,
      default: "",
      trim: true,
    },

    couponDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    gstPercentage: {
      type: Number,
      default: 18,
      min: 0,
      max: 100,
    },

    gstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Status
    |--------------------------------------------------------------------------
    */

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Dates
    |--------------------------------------------------------------------------
    */

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    successAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | Invoice
    |--------------------------------------------------------------------------
    */

    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
      default: "",
      trim: true,
      index: true,
    },

    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      default: "",
      trim: true,
      index: true,
    },

    invoiceGenerated: {
      type: Boolean,
      default: false,
    },

    invoiceUrl: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Refund
    |--------------------------------------------------------------------------
    */

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundReason: {
      type: String,
      default: "",
      trim: true,
    },

    refundTransactionId: {
      type: String,
      default: "",
      trim: true,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    /*
    |--------------------------------------------------------------------------
    | Verification
    |--------------------------------------------------------------------------
    */

    verifiedByAdmin: {
      type: Boolean,
      default: false,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    adminRemark: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Paytm Business
    |--------------------------------------------------------------------------
    */

    paytmOrderId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    paytmTxnId: {
      type: String,
      default: "",
      trim: true,
    },

    paytmMid: {
      type: String,
      default: "",
      trim: true,
    },

    paytmStatus: {
      type: String,
      default: "",
      trim: true,
    },

    paytmBankTxnId: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Notifications
    |--------------------------------------------------------------------------
    */

    emailSent: {
      type: Boolean,
      default: false,
    },

    smsSent: {
      type: Boolean,
      default: false,
    },

    whatsappSent: {
      type: Boolean,
      default: false,
    },

    /*
    |--------------------------------------------------------------------------
    | Attachments
    |--------------------------------------------------------------------------
    */

    paymentProof: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Security
    |--------------------------------------------------------------------------
    */

    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },

    userAgent: {
      type: String,
      default: "",
      trim: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Active
    |--------------------------------------------------------------------------
    */

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

paymentSchema.index({ student: 1, createdAt: -1 });
paymentSchema.index({ internship: 1, createdAt: -1 });
paymentSchema.index({ paymentStatus: 1, createdAt: -1 });
paymentSchema.index({ paymentGateway: 1, paymentStatus: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ paytmOrderId: 1 });
paymentSchema.index({ gatewayTransactionId: 1 });

/*
|--------------------------------------------------------------------------
| Virtuals
|--------------------------------------------------------------------------
*/

paymentSchema.virtual("discountAmount").get(function () {
  return Math.max((this.scholarshipDiscount || 0) + (this.couponDiscount || 0), 0);
});

paymentSchema.virtual("taxAmount").get(function () {
  return this.gstAmount || 0;
});

paymentSchema.virtual("payableAmount").get(function () {
  return this.finalAmount || 0;
});

paymentSchema.virtual("isSuccessful").get(function () {
  return this.paymentStatus === "SUCCESS";
});

paymentSchema.virtual("netAmount").get(function () {
  return Math.max((this.amount || 0) - this.discountAmount + this.taxAmount, 0);
});

/*
|--------------------------------------------------------------------------
| Methods
|--------------------------------------------------------------------------
*/

paymentSchema.methods.markProcessing = function () {
  this.paymentStatus = "PROCESSING";
  return this;
};

paymentSchema.methods.markSuccess = function ({
  gateway = "RAZORPAY",
  transactionId = "",
  gatewayTransactionId = "",
  razorpayOrderId = "",
  razorpayPaymentId = "",
  razorpaySignature = "",
  paytmOrderId = "",
  paytmTxnId = "",
  paytmStatus = "",
  adminRemark = "",
} = {}) {
  this.paymentGateway = gateway || this.paymentGateway || "RAZORPAY";
  this.paymentStatus = "SUCCESS";
  this.successAt = new Date();
  this.verifiedAt = new Date();

  if (transactionId) this.transactionId = transactionId;
  if (gatewayTransactionId) this.gatewayTransactionId = gatewayTransactionId;
  if (razorpayOrderId) this.razorpayOrderId = razorpayOrderId;
  if (razorpayPaymentId) this.razorpayPaymentId = razorpayPaymentId;
  if (razorpaySignature) this.razorpaySignature = razorpaySignature;
  if (paytmOrderId) this.paytmOrderId = paytmOrderId;
  if (paytmTxnId) this.paytmTxnId = paytmTxnId;
  if (paytmStatus) this.paytmStatus = paytmStatus;
  if (adminRemark) this.adminRemark = adminRemark;

  return this;
};

paymentSchema.methods.markFailed = function (reason = "") {
  this.paymentStatus = "FAILED";
  if (reason) this.adminRemark = reason;
  return this;
};

paymentSchema.methods.markRefunded = function ({
  refundAmount = 0,
  reason = "",
  refundTransactionId = "",
} = {}) {
  this.paymentStatus = "REFUNDED";
  this.refundAmount = clampNumber(refundAmount, 0, 0);
  this.refundReason = reason || this.refundReason || "";
  this.refundTransactionId =
    refundTransactionId || this.refundTransactionId || "";
  this.refundedAt = new Date();
  return this;
};

paymentSchema.methods.toDisplayObject = function () {
  const obj = this.toObject({ virtuals: true });

  obj.discountAmount = obj.discountAmount || 0;
  obj.taxAmount = obj.taxAmount || 0;
  obj.payableAmount = obj.payableAmount || 0;
  obj.netAmount = obj.netAmount || 0;

  return obj;
};

/*
|--------------------------------------------------------------------------
| Pre-save Hooks
|--------------------------------------------------------------------------
*/

paymentSchema.pre("validate", function (next) {
  try {
    if (!this.paymentId) {
      this.paymentId = generatePaymentId();
    }

    if (!this.receiptNumber) {
      this.receiptNumber = generateReceiptNumber();
    }

    if (!this.invoiceNumber) {
      this.invoiceNumber = generateInvoiceNumber();
    }

    if (!this.currency) {
      this.currency = "INR";
    }

    next();
  } catch (error) {
    next(error);
  }
});

paymentSchema.pre("save", function (next) {
  try {
    const textFields = [
      "paymentId",
      "orderId",
      "transactionId",
      "gatewayTransactionId",
      "razorpayOrderId",
      "razorpayPaymentId",
      "razorpaySignature",
      "couponCode",
      "refundReason",
      "refundTransactionId",
      "adminRemark",
      "paytmOrderId",
      "paytmTxnId",
      "paytmMid",
      "paytmStatus",
      "paytmBankTxnId",
      "invoiceUrl",
      "paymentProof",
      "ipAddress",
      "userAgent",
      "receiptNumber",
      "invoiceNumber",
      "currency",
    ];

    for (const field of textFields) {
      if (this[field] !== undefined && this[field] !== null) {
        this[field] = normalizeText(this[field]);
      }
    }

    this.amount = clampNumber(this.amount, 0, 0);
    this.scholarshipDiscount = clampNumber(this.scholarshipDiscount, 0, 0);
    this.couponDiscount = clampNumber(this.couponDiscount, 0, 0);
    this.gstPercentage = clampNumber(this.gstPercentage, 18, 0, 100);
    this.gstAmount = clampNumber(this.gstAmount, 0, 0);
    this.finalAmount = clampNumber(this.finalAmount, 0, 0);
    this.refundAmount = clampNumber(this.refundAmount, 0, 0);

    if (this.paymentStatus === "SUCCESS" && !this.successAt) {
      this.successAt = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

/*
|--------------------------------------------------------------------------
| Export Model
|--------------------------------------------------------------------------
*/

module.exports =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);