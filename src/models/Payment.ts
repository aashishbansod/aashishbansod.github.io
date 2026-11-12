import mongoose, { Schema, type Model } from "mongoose";

export type PaymentStatus = "success" | "pending" | "failed" | "refunded";
export type ReceiptEmailStatus = "pending" | "sent" | "failed" | "not_required";

export interface IPayment {
  studentName: string;
  studentId: string;
  email: string;
  internship: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  paymentId: string;
  orderId: string;
  notes: string;
  archivedAt: Date | null;
  archivedBy: string;
  receiptEmailStatus: ReceiptEmailStatus;
  receiptEmailSentAt: Date | null;
  receiptEmailLastAttemptAt: Date | null;
  receiptEmailAttempts: number;
  receiptEmailError: string;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_TEXT_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_AMOUNT = 10_000_000;
const MAX_NOTES_LENGTH = 2000;
const MAX_EMAIL_ERROR_LENGTH = 500;

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
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: MAX_EMAIL_LENGTH,
      index: true,
      validate: {
        validator: (value: string) =>
          value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: "Payment email address is invalid.",
      },
    },
    internship: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_TEXT_LENGTH,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_AMOUNT,
      default: 0,
      validate: {
        validator: (value: number) =>
          Number.isFinite(value) && Math.round(value * 100) === value * 100,
        message: "Payment amount must be a valid currency amount.",
      },
    },
    status: {
      type: String,
      enum: ["success", "pending", "failed", "refunded"],
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
      default: "pending",
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
      validate: {
        validator: (value: number) =>
          Number.isInteger(value) && value <= 1000,
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
  },
  {
    timestamps: true,
    collection: "payments",
    strict: true,
    minimize: false,
    versionKey: false,
  },
);

paymentSchema.index(
  { orderId: 1 },
  {
    name: "uniq_payment_order_id_nonempty",
    unique: true,
    partialFilterExpression: {
      orderId: { $type: "string", $gt: "" },
    },
  },
);

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
  { createdAt: -1 },
  { name: "payments_created_at" },
);

const Payment: Model<IPayment> =
  (mongoose.models.Payment as Model<IPayment> | undefined) ??
  mongoose.model<IPayment>("Payment", paymentSchema);

export default Payment;
