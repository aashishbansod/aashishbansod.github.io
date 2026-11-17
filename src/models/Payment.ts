import mongoose, { Schema, type Model } from "mongoose";

export type PaymentStatus = "success" | "pending" | "failed" | "refunded" | "expired";
export type ReceiptEmailStatus = "pending" | "sent" | "failed" | "not_required";
export type InternshipPlanCode = "ONE_MONTH" | "THREE_MONTHS" | "SIX_MONTHS";
export type LegacyInternshipPlanCode = "1_MONTH" | "3_MONTHS" | "6_MONTHS" | "1 month" | "3 months" | "6 months";
export type InternshipPlanInput = InternshipPlanCode | LegacyInternshipPlanCode;
export type PaymentVerificationSource = "razorpay_checkout" | "razorpay_webhook" | "admin_reconciliation" | "legacy";

export const PAYMENT_PLAN_CONFIG = {
  ONE_MONTH: { code: "ONE_MONTH", name: "1 Month", durationDays: 30, amount: 499, amountInPaise: 49900 },
  THREE_MONTHS: { code: "THREE_MONTHS", name: "3 Months", durationDays: 90, amount: 999, amountInPaise: 99900 },
  SIX_MONTHS: { code: "SIX_MONTHS", name: "6 Months", durationDays: 180, amount: 1699, amountInPaise: 169900 },
} as const;

export function normalizePaymentPlanCode(value: unknown): InternshipPlanCode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "ONE_MONTH" || normalized === "1_MONTH") return "ONE_MONTH";
  if (normalized === "THREE_MONTHS" || normalized === "3_MONTHS") return "THREE_MONTHS";
  if (normalized === "SIX_MONTHS" || normalized === "6_MONTHS") return "SIX_MONTHS";
  return null;
}

export interface IPaymentAuditEntry {
  action: string;
  performedBy: string;
  performedByRole: string;
  reason: string;
  previousValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  createdAt: Date;
}

export interface IPayment {
  studentName: string;
  studentId: string;
  email: string;
  internship: string;
  planCode: InternshipPlanCode | "";
  planName: string;
  planDurationDays: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  paymentId: string;
  orderId: string;
  attemptGroupId: string;
  checkoutExpiresAt: Date | null;
  expiredAt: Date | null;
  verifiedAt: Date | null;
  verificationSource: PaymentVerificationSource | "";
  notes: string;
  archivedAt: Date | null;
  archivedBy: string;
  receiptEmailStatus: ReceiptEmailStatus;
  receiptEmailSentAt: Date | null;
  receiptEmailLastAttemptAt: Date | null;
  receiptEmailAttempts: number;
  receiptEmailError: string;
  isManuallyEdited: boolean;
  lastEditedAt: Date | null;
  lastEditedBy: string;
  auditHistory: IPaymentAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const MAX_TEXT_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_AMOUNT = 10_000_000;
const MAX_NOTES_LENGTH = 2000;
const MAX_EMAIL_ERROR_LENGTH = 500;
const MAX_RECEIPT_ATTEMPTS = 1000;
const MAX_AUDIT_ENTRIES = 100;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLAN_CONFIG: Record<InternshipPlanCode, { name: string; days: number; amount: number }> = {
  ONE_MONTH: { name: PAYMENT_PLAN_CONFIG.ONE_MONTH.name, days: PAYMENT_PLAN_CONFIG.ONE_MONTH.durationDays, amount: PAYMENT_PLAN_CONFIG.ONE_MONTH.amount },
  THREE_MONTHS: { name: PAYMENT_PLAN_CONFIG.THREE_MONTHS.name, days: PAYMENT_PLAN_CONFIG.THREE_MONTHS.durationDays, amount: PAYMENT_PLAN_CONFIG.THREE_MONTHS.amount },
  SIX_MONTHS: { name: PAYMENT_PLAN_CONFIG.SIX_MONTHS.name, days: PAYMENT_PLAN_CONFIG.SIX_MONTHS.durationDays, amount: PAYMENT_PLAN_CONFIG.SIX_MONTHS.amount },
};

const auditEntrySchema = new Schema<IPaymentAuditEntry>(
  {
    action: { type: String, required: true, trim: true, maxlength: 80 },
    performedBy: { type: String, required: true, trim: true, maxlength: 120 },
    performedByRole: { type: String, default: "", trim: true, maxlength: 80 },
    reason: { type: String, default: "", trim: true, maxlength: 500 },
    previousValue: { type: Schema.Types.Mixed, default: {} },
    newValue: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, required: true },
  },
  { _id: false, versionKey: false },
);

const paymentSchema = new Schema<IPayment>(
  {
    studentName: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_TEXT_LENGTH,
    },
    studentId: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_TEXT_LENGTH,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: MAX_EMAIL_LENGTH,
      validate: {
        validator: (value: string) => value === "" || emailPattern.test(value),
        message: "Payment email address is invalid.",
      },
    },
    internship: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_TEXT_LENGTH,
    },
    planCode: {
      type: String,
      enum: ["", "ONE_MONTH", "THREE_MONTHS", "SIX_MONTHS"],
      default: "",
      index: true,
    },
    planName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    planDurationDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 3650,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: "Plan duration must be a whole number of days.",
      },
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      max: MAX_AMOUNT,
      validate: {
        validator: (value: number) =>
          Number.isFinite(value) && Math.round(value * 100) === value * 100,
        message: "Payment amount must be a valid currency amount.",
      },
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "INR",
      enum: ["INR"],
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "pending", "failed", "refunded", "expired"],
      default: "pending",
      required: true,
      index: true,
    },
    method: {
      type: String,
      trim: true,
      default: "Razorpay",
      maxlength: 80,
    },
    paymentId: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_TEXT_LENGTH,
    },
    orderId: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_TEXT_LENGTH,
    },
    attemptGroupId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
      index: true,
    },
    checkoutExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    expiredAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationSource: {
      type: String,
      enum: ["", "razorpay_checkout", "razorpay_webhook", "admin_reconciliation", "legacy"],
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_NOTES_LENGTH,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedBy: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    receiptEmailStatus: {
      type: String,
      enum: ["pending", "sent", "failed", "not_required"],
      default: "not_required",
      required: true,
      index: true,
    },
    receiptEmailSentAt: {
      type: Date,
      default: null,
    },
    receiptEmailLastAttemptAt: {
      type: Date,
      default: null,
    },
    receiptEmailAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: MAX_RECEIPT_ATTEMPTS,
      validate: {
        validator: (value: number) =>
          Number.isInteger(value) && value >= 0 && value <= MAX_RECEIPT_ATTEMPTS,
        message: "Receipt email attempts must be a valid non-negative integer.",
      },
    },
    receiptEmailError: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_EMAIL_ERROR_LENGTH,
      select: false,
    },
    isManuallyEdited: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastEditedAt: {
      type: Date,
      default: null,
    },
    lastEditedBy: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    auditHistory: {
      type: [auditEntrySchema],
      default: [],
      validate: {
        validator: (value: IPaymentAuditEntry[]) => value.length <= MAX_AUDIT_ENTRIES,
        message: `Payment audit history cannot exceed ${MAX_AUDIT_ENTRIES} entries.`,
      },
    },
  },
  {
    timestamps: true,
    collection: "payments",
    strict: true,
    minimize: false,
    versionKey: false,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

paymentSchema.pre("validate", function () {
  if (typeof this.studentId === "string") {
    this.studentId = this.studentId.trim();
  }

  if (typeof this.email === "string") {
    this.email = this.email.trim().toLowerCase();
  }

  if (typeof this.currency === "string") {
    this.currency = this.currency.trim().toUpperCase();
  }

  if (typeof this.paymentId === "string") {
    this.paymentId = this.paymentId.trim();
  }

  if (typeof this.orderId === "string") {
    this.orderId = this.orderId.trim();
  }

  if (typeof this.attemptGroupId === "string") {
    this.attemptGroupId = this.attemptGroupId.trim();
  }

  if (this.planCode) {
    const normalizedPlanCode = normalizePaymentPlanCode(this.planCode);
    if (!normalizedPlanCode) {
      this.invalidate("planCode", "The selected internship plan is invalid.");
      return;
    }

    this.planCode = normalizedPlanCode;
    const plan = PLAN_CONFIG[normalizedPlanCode];

    if (!this.planName) this.planName = plan.name;
    if (!this.planDurationDays) this.planDurationDays = plan.days;

    if (this.planName !== plan.name) {
      this.invalidate("planName", "Plan name does not match the selected plan.");
    }

    if (this.planDurationDays !== plan.days) {
      this.invalidate("planDurationDays", "Plan duration does not match the selected plan.");
    }

    if (this.amount !== plan.amount) {
      this.invalidate("amount", "Payment amount does not match the selected internship plan.");
    }

    if (this.currency !== "INR") {
      this.invalidate("currency", "Internship plan payments must use INR.");
    }

    this.planName = plan.name;
    this.internship = plan.name;
  }

  if (this.status === "success") {
    if (!this.verifiedAt) this.verifiedAt = new Date();
    if (!this.verificationSource) this.verificationSource = "legacy";
    this.expiredAt = null;
    this.checkoutExpiresAt = null;

    if (this.receiptEmailStatus === "not_required") {
      this.receiptEmailStatus = "pending";
    }
  }

  if (this.status === "expired") {
    if (this.paymentId) {
      this.invalidate("status", "A payment with a captured payment ID cannot be marked expired.");
    }
    if (!this.expiredAt) this.expiredAt = new Date();
    this.verifiedAt = null;
    this.verificationSource = "";
    this.receiptEmailStatus = "not_required";
    this.receiptEmailSentAt = null;
  }

  if (this.status === "failed" || this.status === "refunded") {
    this.receiptEmailStatus = "not_required";
    this.receiptEmailSentAt = null;
  }

  if (this.receiptEmailStatus === "sent" && !this.receiptEmailSentAt) {
    this.receiptEmailSentAt = new Date();
  }

  if (this.receiptEmailStatus !== "sent") {
    this.receiptEmailSentAt = null;
  }

  if (this.auditHistory.length > MAX_AUDIT_ENTRIES) {
    this.auditHistory = this.auditHistory.slice(-MAX_AUDIT_ENTRIES);
  }
});

paymentSchema.index(
  { paymentId: 1 },
  {
    name: "uniq_payment_gateway_payment_id_nonempty",
    unique: true,
    partialFilterExpression: {
      paymentId: { $type: "string", $gt: "" },
    },
  },
);

paymentSchema.index(
  { orderId: 1 },
  {
    name: "uniq_payment_gateway_order_id_nonempty",
    unique: true,
    partialFilterExpression: {
      orderId: { $type: "string", $gt: "" },
    },
  },
);

paymentSchema.index(
  { studentId: 1, createdAt: -1 },
  { name: "payments_student_created_at" },
);

paymentSchema.index(
  { status: 1, createdAt: -1 },
  { name: "payments_status_created_at" },
);

paymentSchema.index(
  { receiptEmailStatus: 1, createdAt: 1 },
  { name: "payments_receipt_email_delivery" },
);

paymentSchema.index(
  { archivedAt: 1, createdAt: -1 },
  { name: "payments_archive_created_at" },
);

paymentSchema.index(
  { studentId: 1, attemptGroupId: 1, createdAt: -1 },
  { name: "payments_student_attempt_group" },
);

paymentSchema.index(
  { status: 1, checkoutExpiresAt: 1 },
  { name: "payments_status_checkout_expiry" },
);

paymentSchema.index(
  { createdAt: -1 },
  { name: "payments_created_at" },
);

paymentSchema.index(
  { email: 1, createdAt: -1 },
  { name: "payments_email_created_at" },
);

paymentSchema.index(
  { verificationSource: 1, verifiedAt: -1 },
  { name: "payments_verification_source_verified_at" },
);

const Payment: Model<IPayment> =
  (mongoose.models.Payment as Model<IPayment> | undefined) ??
  mongoose.model<IPayment>("Payment", paymentSchema);

export default Payment;
