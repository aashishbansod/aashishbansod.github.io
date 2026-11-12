import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { connectStudentDB } from "@/lib/db";

export type CertificateStatus = "issued" | "pending" | "revoked" | "expired";

export type CertificateAuditAction =
  | "created"
  | "issued"
  | "updated"
  | "revoked"
  | "reissued"
  | "pdf-generated"
  | "verification-viewed";

const MAX_NAME_LENGTH = 150;
const MAX_EMAIL_LENGTH = 254;
const MAX_TEXT_LENGTH = 500;
const MAX_URL_LENGTH = 2048;
const MAX_AUDIT_ENTRIES = 100;

const certificateAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "created",
        "issued",
        "updated",
        "revoked",
        "reissued",
        "pdf-generated",
        "verification-viewed",
      ],
      required: true,
    },
    actorId: {
      type: String,
      trim: true,
      maxlength: 150,
      required: true,
    },
    actorName: {
      type: String,
      trim: true,
      maxlength: MAX_NAME_LENGTH,
      default: "",
    },
    actorRole: {
      type: String,
      trim: true,
      maxlength: 100,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    _id: false,
    id: false,
    strict: true,
    minimize: true,
  },
);

const certificateSchema = new Schema(
  {
    certificateId: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      immutable: true,
      maxlength: 100,
    },
    mainStudentId: {
      type: String,
      trim: true,
      required: true,
      immutable: true,
      maxlength: 100,
    },
    operationsStudentId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    applicationId: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 80,
    },
    studentId: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      maxlength: 80,
    },
    dashboardStudentId: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 80,
    },
    studentName: {
      type: String,
      trim: true,
      required: true,
      maxlength: MAX_NAME_LENGTH,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: MAX_EMAIL_LENGTH,
    },
    internship: {
      type: String,
      trim: true,
      required: true,
      maxlength: MAX_TEXT_LENGTH,
    },
    course: {
      type: String,
      trim: true,
      default: "",
      maxlength: MAX_TEXT_LENGTH,
    },
    internshipPlan: {
      type: String,
      trim: true,
      default: "",
      maxlength: 50,
    },
    internshipDurationDays: {
      type: Number,
      min: 0,
      max: 3650,
      default: 0,
    },
    issueDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["issued", "pending", "revoked", "expired"],
      default: "pending",
      required: true,
      index: true,
    },
    verificationToken: {
      type: String,
      trim: true,
      select: false,
      maxlength: 128,
      default: "",
    },
    verificationUrl: {
      type: String,
      trim: true,
      maxlength: MAX_URL_LENGTH,
      default: "",
    },
    pdfUrl: {
      type: String,
      trim: true,
      maxlength: MAX_URL_LENGTH,
      default: "",
    },
    pdfStorageKey: {
      type: String,
      trim: true,
      select: false,
      maxlength: MAX_URL_LENGTH,
      default: "",
    },
    pdfSha256: {
      type: String,
      trim: true,
      lowercase: true,
      select: false,
      maxlength: 64,
      default: "",
    },
    issuedById: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    issuedByName: {
      type: String,
      trim: true,
      maxlength: MAX_NAME_LENGTH,
      default: "",
    },
    issuedByRole: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedById: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    revokedByName: {
      type: String,
      trim: true,
      maxlength: MAX_NAME_LENGTH,
      default: "",
    },
    revocationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    reissuedFromCertificateId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 100,
      default: "",
    },
    source: {
      type: String,
      enum: ["student-operations", "migration", "admin-import"],
      default: "student-operations",
      required: true,
    },
    syncStatus: {
      type: String,
      enum: ["pending", "synced", "failed"],
      default: "pending",
      required: true,
      index: true,
    },
    mainAdminSyncedAt: {
      type: Date,
      default: null,
    },
    auditTrail: {
      type: [certificateAuditSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => value.length <= MAX_AUDIT_ENTRIES,
        message: `Certificate audit trail cannot exceed ${MAX_AUDIT_ENTRIES} entries.`,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: "certificates",
    strict: "throw",
    minimize: true,
    versionKey: "__v",
    optimisticConcurrency: true,
    autoIndex: process.env.NODE_ENV !== "production",
  },
);

certificateSchema.index(
  { certificateId: 1 },
  {
    name: "uniq_certificate_id",
    unique: true,
  },
);

certificateSchema.index(
  { mainStudentId: 1 },
  {
    name: "uniq_certificate_main_student",
    unique: true,
  },
);

certificateSchema.index(
  { verificationToken: 1 },
  {
    name: "uniq_certificate_verification_token_nonempty",
    unique: true,
    partialFilterExpression: {
      verificationToken: { $type: "string", $gt: "" },
    },
  },
);

certificateSchema.index(
  { status: 1, issueDate: -1 },
  { name: "certificates_status_issue_date" },
);

certificateSchema.index(
  { email: 1, createdAt: -1 },
  { name: "certificates_email_created_at" },
);

certificateSchema.index(
  { studentId: 1, createdAt: -1 },
  { name: "certificates_student_created_at" },
);

certificateSchema.index(
  { syncStatus: 1, updatedAt: 1 },
  { name: "certificates_sync_status_updated_at" },
);

certificateSchema.pre("validate", function validateCertificateDates() {
  if (
    this.issueDate &&
    this.expiryDate &&
    this.expiryDate.getTime() <= this.issueDate.getTime()
  ) {
    this.invalidate("expiryDate", "Expiry date must be after issue date.");
  }

  if (this.status === "issued" && !this.issueDate) {
    this.invalidate("issueDate", "Issued certificates require an issue date.");
  }

  if (this.status === "revoked" && !this.revokedAt) {
    this.invalidate("revokedAt", "Revoked certificates require a revocation date.");
  }

  if (this.status !== "revoked" && this.revokedAt) {
    this.invalidate("revokedAt", "Only revoked certificates can have a revocation date.");
  }

  if (this.status === "issued" && !this.verificationToken) {
    this.invalidate(
      "verificationToken",
      "Issued certificates require a verification token.",
    );
  }
});

certificateSchema.pre("save", function normalizeCertificateFields() {
  this.certificateId = this.certificateId.trim().toUpperCase();
  this.mainStudentId = this.mainStudentId.trim();
  this.studentId = this.studentId.trim().toUpperCase();
  this.email = this.email.trim().toLowerCase();

  if (this.applicationId) {
    this.applicationId = this.applicationId.trim().toUpperCase();
  }

  if (this.dashboardStudentId) {
    this.dashboardStudentId = this.dashboardStudentId.trim().toUpperCase();
  }

  if (this.internship) {
    this.internship = this.internship.trim();
  }
});

export type CertificateDocument = InferSchemaType<typeof certificateSchema>;

const modelRegistry = new WeakMap<
  Connection,
  Model<CertificateDocument>
>();

export async function getCertificateModel(): Promise<
  Model<CertificateDocument>
> {
  const connection = await connectStudentDB();
  const cached = modelRegistry.get(connection);

  if (cached) {
    return cached;
  }

  const existing = connection.models.Certificate as
    | Model<CertificateDocument>
    | undefined;

  if (existing) {
    modelRegistry.set(connection, existing);
    return existing;
  }

  const model = connection.model<CertificateDocument>(
    "Certificate",
    certificateSchema,
    "certificates",
  );

  modelRegistry.set(connection, model);
  return model;
}

export default getCertificateModel;
