import mongoose, {
  type ClientSession,
} from "mongoose";

import crypto from "node:crypto";

import StudentModelSource from "@/models/Student";
import ApplicationModelSource from "@/models/Application";
import { getStudentOperationsModel } from "@/models/StudentOperations";

import connectDB from "@/lib/db";

import {
  hashPassword,
} from "@/lib/auth";

import {
  sendStudentCredentialsEmail,
} from "@/lib/email";


const StudentModel: any = StudentModelSource;
const ApplicationModel: any = ApplicationModelSource;


const STUDENT_ID_PREFIX = "CN";

const DASHBOARD_ID_PREFIX = "CND";

const CERTIFICATE_ID_PREFIX = "CN-CERT";

const MAIN_PASSWORD_LENGTH = 14;

const DASHBOARD_PASSWORD_LENGTH = 16;

const MAIN_CREDENTIAL_EXPIRY_DAYS = 30;



const INTERNSHIP_SELECTION_WINDOW_HOURS = 72;

const DEFAULT_PASSING_SCORE = 60;

const MAX_ID_ATTEMPTS = 30;


export const INTERNSHIP_PLANS = {
  "1 month": {
    name: "1 Month",
    durationMonths: 1,
    durationDays: 30,
    amount: 499,
    currency: "INR",
  },

  "3 months": {
    name: "3 Months",
    durationMonths: 3,
    durationDays: 90,
    amount: 999,
    currency: "INR",
  },

  "6 months": {
    name: "6 Months",
    durationMonths: 6,
    durationDays: 180,
    amount: 1699,
    currency: "INR",
  },
} as const;

export type InternshipPlan =
  keyof typeof INTERNSHIP_PLANS;

function normalizeInternshipPlan(value: unknown): InternshipPlan | null {
  const normalized = cleanString(value)
    .toLowerCase()
    .replace(/[\\s_-]+/g, " ")
    .trim();

  const aliases: Record<string, InternshipPlan> = {
    "1 month": "1 month",
    "one month": "1 month",
    "1": "1 month",
    "one month plan": "1 month",
    "3 months": "3 months",
    "three months": "3 months",
    "3 month": "3 months",
    "3": "3 months",
    "three month plan": "3 months",
    "6 months": "6 months",
    "six months": "6 months",
    "6 month": "6 months",
    "6": "6 months",
    "six month plan": "6 months",
  };

  return aliases[normalized] ?? null;
}


export interface ServiceResult<
  T = unknown,
> {
  success: boolean;
  message: string;
  code?: string;
  data?: T;
}

export interface StudentActor {
  id: string;
  role?: string;
}

export interface ApproveApplicationInput {
  applicationId: string;
  actor: StudentActor;
  sendCredentials?: boolean;
}

export interface RejectApplicationInput {
  applicationId: string;
  actor: StudentActor;
  reason: string;
}

export interface ResendCredentialsInput {
  studentId: string;
  actor: StudentActor;
}

export interface AssessmentResultInput {
  studentId: string;
  score: number;
  passingScore?: number;
  resultStatus?: "passed" | "failed";
}

export interface SelectInternshipInput {
  studentId: string;
  plan: InternshipPlan;
  track?: string;
  startPreference?: string;
}

export interface PaymentVerificationInput {
  studentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  amount?: number;
  currency?: string;
}

export interface StudentOperationsApprovalInput {
  studentId: string;
  actor: StudentActor;
  approved: boolean;
  reason?: string;
}

export interface GenerateDashboardCredentialsInput {
  studentId: string;
  actor: StudentActor;
  sendCredentials?: boolean;
}

export interface DashboardStatusInput {
  studentId: string;
  actor: StudentActor;
  status:
    | "active"
    | "suspended"
    | "completed"
    | "locked";
  reason?: string;
}

export interface CompleteInternshipInput {
  studentId: string;
  actor?: StudentActor;
}

export interface StudentSummary {
  id: string;
  studentId: string;
  dashboardStudentId: string;
  applicationId: string;

  fullName: string;
  email: string;
  phone: string;

  applicationStatus: string;
  adminApprovalStatus: string;

  assessmentStatus: string;
  resultStatus: string;

  internshipStatus: string;
  internshipPlan: string;
  internshipTrack: string;

  paymentStatus: string;
  paymentAmount: number;

  studentOpsApprovalStatus: string;
  studentOpsStatus: string;

  dashboardStatus: string;
  dashboardLoginEnabled: boolean;
  dashboardCredentialsGenerated: boolean;

  learningStatus: string;
  taskCompletionPercentage: number;
  learningProgressPercentage: number;
  attendancePercentage: number;

  weeklyAssessmentStatus: string;
  saturdayAssessmentStatus: string;

  projectStatus: string;
  projectCompletionPercentage: number;

  certificateStatus: string;
  certificateId: string;

  createdAt?: Date;
  updatedAt?: Date;
}


type DatabaseRecord =
  Record<string, unknown>;


type StudentDocument = any;


export class StudentServiceError
  extends Error {

  public readonly code: string;

  public readonly status: number;

  constructor(
    code: string,
    message: string,
    status = 400,
  ) {
    super(message);

    this.name =
      "StudentServiceError";

    this.code =
      code;

    this.status =
      status;
  }
}


function cleanString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}


function normalizeId(
  value: unknown,
): string {
  return cleanString(value)
    .toUpperCase();
}


function normalizeEmail(
  value: unknown,
): string {
  return cleanString(value)
    .toLowerCase();
}


function numberValue(
  value: unknown,
  fallback = 0,
): number {
  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : fallback;
}


function booleanValue(
  value: unknown,
): boolean {
  return value === true;
}


function objectIdString(
  value: unknown,
): string {
  if (!value) {
    return "";
  }

  try {
    return String(value);
  } catch {
    return "";
  }
}


function dateOrNull(
  value: unknown,
): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(
      value.getTime(),
    )
      ? null
      : value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime(),
    )
      ? null
      : date;
  }

  return null;
}


function normalizedStatus(
  value: unknown,
): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}


function isStatus(
  value: unknown,
  ...allowed: string[]
): boolean {
  const normalizedValue = normalizedStatus(value);
  return allowed.some(
    (status) => normalizedStatus(status) === normalizedValue,
  );
}


function assertNonEmpty(
  value: unknown,
  field: string,
): string {
  const result =
    cleanString(value);

  if (!result) {
    throw new StudentServiceError(
      "INVALID_INPUT",
      `${field} is required.`,
      400,
    );
  }

  return result;
}


function assertScore(
  value: unknown,
): number {
  const score =
    numberValue(value, -1);

  if (
    score < 0 ||
    score > 100
  ) {
    throw new StudentServiceError(
      "INVALID_SCORE",
      "Score must be between 0 and 100.",
      400,
    );
  }

  return score;
}


function assertReason(
  value: unknown,
): string {
  const reason =
    cleanString(value);

  if (!reason) {
    throw new StudentServiceError(
      "REASON_REQUIRED",
      "A reason is required.",
      400,
    );
  }

  return reason.slice(
    0,
    1000,
  );
}


const MAIN_ADMIN_ROLES =
  new Set([
    "Super Admin",
    "Admin",
    "HR",
  ]);


const STUDENT_OPERATIONS_ROLES =
  new Set([
    "Super Admin",
    "Admin",
    "Student Operations Admin",
  ]);


function assertActor(
  actor: StudentActor,
): void {
  if (
    !actor ||
    !cleanString(actor.id)
  ) {
    throw new StudentServiceError(
      "UNAUTHORIZED",
      "Authenticated administrator is required.",
      401,
    );
  }
}


function assertMainAdminRole(
  actor: StudentActor,
): void {
  assertActor(actor);

  const role =
    cleanString(actor.role);

  if (
    !MAIN_ADMIN_ROLES.has(role)
  ) {
    throw new StudentServiceError(
      "FORBIDDEN",
      "You are not authorized for Main Admin student operations.",
      403,
    );
  }
}


function assertStudentOperationsRole(
  actor: StudentActor,
): void {
  assertActor(actor);

  const role =
    cleanString(actor.role);

  if (
    !STUDENT_OPERATIONS_ROLES.has(
      role,
    )
  ) {
    throw new StudentServiceError(
      "FORBIDDEN",
      "You are not authorized for Student Operations actions.",
      403,
    );
  }
}


async function ensureDatabase(): Promise<void> {
  await connectDB();
}


async function syncStudentOperationsRecord(
  student: Record<string, any>,
): Promise<void> {
  const mainStudentId = objectIdString(student._id);

  if (!mainStudentId) {
    throw new StudentServiceError(
      "STUDENT_OPERATIONS_ID_MISSING",
      "A valid Main DB student ID is required to sync Student Operations.",
      500,
    );
  }

  const studentId = normalizeId(student.studentId);
  const applicationId = normalizeId(student.applicationId);

  const OperationsModel = await getStudentOperationsModel();
  const now = new Date();
  const rawProjectStatus = cleanString(student.projectStatus);
  const projectStatus =
    rawProjectStatus === "locked" || rawProjectStatus === "available"
      ? "not-started"
      : rawProjectStatus === "review"
        ? "under-review"
        : rawProjectStatus || "not-started";

  const fields: Record<string, unknown> = {
    mainStudentId,
    studentId,
    applicationId,
    dashboardStudentId: normalizeId(student.dashboardStudentId),
    dashboardStudentIdNormalized: normalizeId(student.dashboardStudentId),
    fullName: cleanString(student.fullName),
    email: normalizeEmail(student.email),
    phone: cleanString(student.phone),
    applicationStatus: cleanString(student.applicationStatus) || "pending",
    adminApprovalStatus: cleanString(student.adminApprovalStatus) || "pending",
    assessmentStatus: cleanString(student.assessmentStatus) || "not-started",
    assessmentScore:
      student.assessmentScore == null
        ? null
        : numberValue(student.assessmentScore),
    resultStatus: cleanString(student.resultStatus) || "not-declared",
    internshipStatus: cleanString(student.internshipStatus) || "not-started",
    internshipTrack: cleanString(student.internshipTrack),
    internshipPlan: cleanString(student.internshipPlan),
    internshipDurationMonths: numberValue(
      student.internshipDurationMonths,
      numberValue(student.internshipDurationDays) / 30,
    ),
    internshipDurationDays: numberValue(student.internshipDurationDays),
    internshipStartedAt: dateOrNull(student.internshipStartedAt),
    internshipEndsAt: dateOrNull(student.internshipEndsAt),
    paymentStatus: cleanString(student.paymentStatus) || "unpaid",
    paymentAmount: numberValue(student.paymentAmount),
    paymentCurrency: cleanString(student.paymentCurrency).toUpperCase() || "INR",
    studentOpsApprovalStatus:
      cleanString(student.studentOpsApprovalStatus) || "pending",
    operationsApprovalStatus:
      cleanString(student.studentOpsApprovalStatus) || "pending",
    operationsApprovedBy: cleanString(student.studentOpsApprovedBy),
    operationsApprovedAt: dateOrNull(student.studentOpsApprovedAt),
    operationsReviewedAt: dateOrNull(student.studentOpsReviewedAt),
    operationsRejectionReason: cleanString(student.studentOpsRejectionReason),
    studentOpsStatus: cleanString(student.studentOpsStatus) || "not-ready",
    operationsStatus: cleanString(student.studentOpsStatus) || "not-ready",
    dashboardStatus: cleanString(student.dashboardStatus) || "locked",
    dashboardLoginEnabled: student.dashboardLoginEnabled === true,
    dashboardLoginEnabledAt: dateOrNull(student.dashboardLoginEnabledAt),
    dashboardCredentialsGenerated:
      student.dashboardCredentialsGenerated === true,
    dashboardCredentialsGeneratedAt:
      dateOrNull(student.dashboardCredentialsGeneratedAt),
    dashboardCredentialsExpiresAt:
      dateOrNull(student.dashboardCredentialsExpiresAt),
    dashboardPasswordChangedAt:
      dateOrNull(student.dashboardPasswordChangedAt),
    dashboardMustChangePassword:
      student.dashboardMustChangePassword !== false,
    dashboardLastLoginAt: dateOrNull(student.dashboardLastLoginAt),
    dashboardLoginAttempts: numberValue(student.dashboardLoginAttempts),
    dashboardAccountLocked: student.dashboardAccountLocked === true,
    dashboardLockedUntil: dateOrNull(student.dashboardLockedUntil),
    dashboardDeactivatedAt: dateOrNull(student.dashboardDeactivatedAt),
    dashboardDeactivationReason: cleanString(
      student.dashboardDeactivationReason,
    ),
    learningStatus: cleanString(student.learningStatus) || "not-started",
    currentLearningDay: numberValue(student.currentLearningDay),
    completedLearningDays: numberValue(student.completedLearningDays),
    taskCompletionPercentage: numberValue(student.taskCompletionPercentage),
    learningProgressPercentage: numberValue(
      student.learningProgressPercentage,
    ),
    attendancePercentage: numberValue(student.attendancePercentage),
    currentTaskId: cleanString(student.currentTaskId),
    lastTaskAssignedAt: dateOrNull(student.lastTaskAssignedAt),
    lastTaskSubmittedAt: dateOrNull(student.lastTaskSubmittedAt),
    totalTasksAssigned: numberValue(student.totalTasksAssigned),
    totalTasksSubmitted: numberValue(student.totalTasksSubmitted),
    totalTasksApproved: numberValue(student.totalTasksApproved),
    weeklyAssessmentStatus:
      cleanString(student.weeklyAssessmentStatus) || "locked",
    weeklyAssessmentScore:
      student.weeklyAssessmentScore == null
        ? null
        : numberValue(student.weeklyAssessmentScore),
    weeklyAssessmentSubmittedAt:
      dateOrNull(student.weeklyAssessmentSubmittedAt),
    saturdayAssessmentStatus:
      cleanString(student.saturdayAssessmentStatus) || "locked",
    saturdayAssessmentScore:
      student.saturdayAssessmentScore == null
        ? null
        : numberValue(student.saturdayAssessmentScore),
    saturdayAssessmentSubmittedAt:
      dateOrNull(student.saturdayAssessmentSubmittedAt),
    attendanceDaysPresent: numberValue(student.attendanceDaysPresent),
    attendanceDaysAbsent: numberValue(student.attendanceDaysAbsent),
    lastAttendanceAt: dateOrNull(student.lastAttendanceAt),
    projectStatus,
    projectFolderReference: cleanString(student.projectFolderReference),
    projectSubmittedAt: dateOrNull(student.projectSubmittedAt),
    projectReviewedAt: dateOrNull(student.projectReviewedAt),
    projectReviewNotes: cleanString(student.projectReviewNotes),
    certificateStatus:
      cleanString(student.certificateStatus) || "not-eligible",
    certificateId: cleanString(student.certificateId),
    certificateGeneratedAt: dateOrNull(student.certificateGeneratedAt),
    notes: cleanString(student.notes),
    sourceVersion: Math.max(1, numberValue(student.__v, 1) + 1),
    sourceUpdatedAt: dateOrNull(student.updatedAt) || now,
    lastSyncedAt: now,
    syncStatus: "synced",
    syncError: "",
    updatedAt: now,
  };

  try {
    await OperationsModel.updateOne(
      { mainStudentId },
      {
        $set: fields,
        $unset: {
          dashboardPasswordHash: 1,
          passwordHash: 1,
          loginPasswordHash: 1,
        },
        $setOnInsert: { createdAt: dateOrNull(student.createdAt) || now },
      },
      {
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    await StudentModel.updateOne(
      { _id: student._id },
      {
        $set: {
          operationsSyncStatus: "synced",
          operationsStudentRef: mainStudentId,
          operationsLastSyncedAt: now,
          operationsSyncError: "",
        },
      },
    ).exec();
  } catch (error) {
    const syncError =
      error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";

    try {
      await StudentModel.updateOne(
        { _id: student._id },
        {
          $set: {
            operationsSyncStatus: "failed",
            operationsStudentRef: mainStudentId,
            operationsSyncError: syncError,
          },
        },
      ).exec();
    } catch (statusError) {
      console.error(
        "[StudentService] Unable to persist Operations sync failure:",
        statusError,
      );
    }

    throw error;
  }
}

function generateSecurePassword(
  length = MAIN_PASSWORD_LENGTH,
): string {
  const letters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  const numbers =
    "23456789";

  const symbols =
    "@#$%&*!";

  const all =
    letters +
    numbers +
    symbols;

  const output: string[] =
    [];

  output.push(
    symbols[
      crypto.randomInt(
        0,
        symbols.length,
      )
    ],
  );

  output.push(
    numbers[
      crypto.randomInt(
        0,
        numbers.length,
      )
    ],
  );

  while (
    output.length < length
  ) {
    output.push(
      all[
        crypto.randomInt(
          0,
          all.length,
        )
      ],
    );
  }

  for (
    let index =
      output.length - 1;
    index > 0;
    index--
  ) {
    const randomIndex =
      crypto.randomInt(
        0,
        index + 1,
      );

    [
      output[index],
      output[randomIndex],
    ] = [
      output[randomIndex],
      output[index],
    ];
  }

  return output.join("");
}


function generateStudentId(): string {
  const year =
    new Date().getFullYear();

  return `${STUDENT_ID_PREFIX}-${year}-${crypto.randomInt(
    100000,
    1000000,
  )}`;
}


function generateDashboardStudentId(): string {
  const year =
    new Date().getFullYear();

  return `${DASHBOARD_ID_PREFIX}-${year}-${crypto.randomInt(
    100000,
    1000000,
  )}`;
}


function generateCertificateId(): string {
  const year =
    new Date().getFullYear();

  return `${CERTIFICATE_ID_PREFIX}-${year}-${crypto.randomInt(
    100000,
    1000000,
  )}`;
}


async function generateUniqueStudentId(
  session?: ClientSession | null,
): Promise<string> {
  for (
    let attempt = 0;
    attempt < MAX_ID_ATTEMPTS;
    attempt++
  ) {
    const candidate =
      generateStudentId();

    const query =
      StudentModel.exists({
        studentId:
          candidate,
      });

    if (session) {
      query.session(session);
    }

    if (
      !(await query.exec())
    ) {
      return candidate;
    }
  }

  throw new StudentServiceError(
    "STUDENT_ID_GENERATION_FAILED",
    "Unable to generate a unique Student ID.",
    500,
  );
}


async function generateUniqueDashboardStudentId(): Promise<string> {
  for (
    let attempt = 0;
    attempt < MAX_ID_ATTEMPTS;
    attempt++
  ) {
    const candidate =
      generateDashboardStudentId();

    const exists =
      await StudentModel.exists({
        dashboardStudentId:
          candidate,
      });

    if (!exists) {
      return candidate;
    }
  }

  throw new StudentServiceError(
    "DASHBOARD_ID_GENERATION_FAILED",
    "Unable to generate a unique dashboard Student ID.",
    500,
  );
}


async function generateUniqueCertificateId(): Promise<string> {
  for (
    let attempt = 0;
    attempt < MAX_ID_ATTEMPTS;
    attempt++
  ) {
    const candidate =
      generateCertificateId();

    const exists =
      await StudentModel.exists({
        certificateId:
          candidate,
      });

    if (!exists) {
      return candidate;
    }
  }

  throw new StudentServiceError(
    "CERTIFICATE_ID_GENERATION_FAILED",
    "Unable to generate a unique certificate ID.",
    500,
  );
}


function createExpiryDate(
  days: number,
  from = new Date(),
): Date {
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new StudentServiceError(
      "INVALID_INTERNSHIP_DURATION",
      "A valid internship duration is required.",
      400,
    );
  }

  return new Date(
    from.getTime() +
      days *
        24 *
        60 *
        60 *
        1000,
  );
}

function getVerifiedInternshipDurationDays(student: StudentDocument): number {
  const plan = normalizeInternshipPlan(student.internshipPlan);
  const configuredDays = plan ? INTERNSHIP_PLANS[plan].durationDays : 0;
  const storedDays = numberValue(student.internshipDurationDays, 0);
  const durationDays = configuredDays || storedDays;

  if (![30, 90, 180].includes(durationDays)) {
    throw new StudentServiceError(
      "INVALID_INTERNSHIP_DURATION",
      "The selected internship plan must be 1, 3, or 6 months before dashboard activation.",
      409,
    );
  }

  if (configuredDays && storedDays && configuredDays !== storedDays) {
    throw new StudentServiceError(
      "INTERNSHIP_DURATION_MISMATCH",
      "The saved internship duration does not match the selected plan. Contact an administrator.",
      409,
    );
  }

  return durationDays;
}

function createHoursExpiryDate(hours: number, from = new Date()): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}


function ensureInternshipSelectionDeadline(student: StudentDocument): Date {
  const existingDeadline = dateOrNull(student.internshipSelectionDeadlineAt);
  if (existingDeadline) {
    return existingDeadline;
  }

  const startedAt =
    dateOrNull(student.internshipSelectionWindowStartedAt) ||
    dateOrNull(student.assessmentEvaluatedAt) ||
    dateOrNull(student.resultDeclaredAt) ||
    dateOrNull(student.assessmentSubmittedAt) ||
    new Date();

  const deadline = createHoursExpiryDate(
    INTERNSHIP_SELECTION_WINDOW_HOURS,
    startedAt,
  );

  student.internshipSelectionWindowStartedAt = startedAt;
  student.internshipSelectionDeadlineAt = deadline;
  student.internshipSelectionWindowExpired = false;
  student.internshipSelectionExpiredAt = null;

  return deadline;
}


function expireUnpaidSelectionJourney(student: StudentDocument, now = new Date()): void {
  if (isStatus(student.paymentStatus, "paid")) {
    return;
  }

  student.internshipSelectionWindowExpired = true;
  student.internshipSelectionExpiredAt =
    dateOrNull(student.internshipSelectionExpiredAt) || now;
  student.journeyExpired = true;
  student.journeyExpiresAt =
    dateOrNull(student.journeyExpiresAt) || now;
  student.loginEnabled = false;
  student.internshipApplicationAllowed = false;
  student.internshipStatus = "expired";

}


async function sendMainCredentialsEmail(
  params: {
    email: string;
    name: string;
    studentId: string;
    password: string;
    internship?: string;
  },
): Promise<void> {
  await sendStudentCredentialsEmail({
    studentEmail:
      params.email,

    studentName:
      params.name,

    studentId:
      params.studentId,

    password:
      params.password,

    internshipName:
      params.internship ||
      "CyberNet Careers Internship",

    loginUrl:
      undefined,
  });
}


async function sendDashboardCredentialsEmail(
  params: {
    email: string;
    name: string;
    dashboardStudentId: string;
    password: string;
    internship?: string;
  },
): Promise<void> {
  await sendStudentCredentialsEmail({
    studentEmail:
      params.email,

    studentName:
      params.name,

    studentId:
      params.dashboardStudentId,

    password:
      params.password,

    internshipName:
      params.internship ||
      "CyberNet Careers Internship",

    loginUrl:
      undefined,
  });
}


async function findStudentById(
  studentId: string,
  session?: ClientSession,
): Promise<StudentDocument | null> {
  const id =
    normalizeId(studentId);

  const lookupConditions: Record<string, unknown>[] = [
    { studentId: id },
    { dashboardStudentId: id },
  ];


  if (mongoose.Types.ObjectId.isValid(cleanString(studentId))) {
    lookupConditions.push({
      _id: new mongoose.Types.ObjectId(cleanString(studentId)),
    });
  }

  const query = StudentModel.findOne({
    $or: lookupConditions,
  });

  if (session) {
    query.session(session);
  }

  return query.exec();
}


async function findStudentByObjectId(
  id: string,
  session?: ClientSession,
): Promise<StudentDocument | null> {
  const query =
    StudentModel.findById(id);

  if (session) {
    query.session(session);
  }

  return query.exec();
}


function sanitizeStudentSummary(
  student: DatabaseRecord,
): StudentSummary {
  return {
    id:
      objectIdString(
        student._id,
      ),

    studentId:
      normalizeId(
        student.studentId,
      ),

    dashboardStudentId:
      normalizeId(
        student.dashboardStudentId,
      ),

    applicationId:
      normalizeId(
        student.applicationId,
      ),

    fullName:
      cleanString(
        student.fullName,
      ),

    email:
      normalizeEmail(
        student.email,
      ),

    phone:
      cleanString(
        student.phone,
      ),

    applicationStatus:
      cleanString(
        student.applicationStatus,
      ),

    adminApprovalStatus:
      cleanString(
        student.adminApprovalStatus,
      ),

    assessmentStatus:
      cleanString(
        student.assessmentStatus,
      ),

    resultStatus:
      cleanString(
        student.resultStatus,
      ),

    internshipStatus:
      cleanString(
        student.internshipStatus,
      ),

    internshipPlan:
      cleanString(
        student.internshipPlan,
      ),

    internshipTrack:
      cleanString(
        student.internshipTrack,
      ),

    paymentStatus:
      cleanString(
        student.paymentStatus,
      ),

    paymentAmount:
      numberValue(
        student.paymentAmount,
      ),

    studentOpsApprovalStatus:
      cleanString(
        student.studentOpsApprovalStatus,
      ),

    studentOpsStatus:
      cleanString(
        student.studentOpsStatus,
      ),

    dashboardStatus:
      cleanString(
        student.dashboardStatus,
      ),

    dashboardLoginEnabled:
      booleanValue(
        student.dashboardLoginEnabled,
      ),

    dashboardCredentialsGenerated:
      booleanValue(
        student.dashboardCredentialsGenerated,
      ),

    learningStatus:
      cleanString(
        student.learningStatus,
      ),

    taskCompletionPercentage:
      numberValue(
        student.taskCompletionPercentage,
      ),

    learningProgressPercentage:
      numberValue(
        student.learningProgressPercentage,
      ),

    attendancePercentage:
      numberValue(
        student.attendancePercentage,
      ),

    weeklyAssessmentStatus:
      cleanString(
        student.weeklyAssessmentStatus,
      ),

    saturdayAssessmentStatus:
      cleanString(
        student.saturdayAssessmentStatus,
      ),

    projectStatus:
      cleanString(
        student.projectStatus,
      ),

    projectCompletionPercentage:
      numberValue(
        student.projectCompletionPercentage,
      ),

    certificateStatus:
      cleanString(
        student.certificateStatus,
      ),

    certificateId:
      cleanString(
        student.certificateId,
      ),

    createdAt:
      dateOrNull(
        student.createdAt,
      ) || undefined,

    updatedAt:
      dateOrNull(
        student.updatedAt,
      ) || undefined,
  };
}


export async function getStudent(
  studentId: string,
): Promise<
  ServiceResult<StudentSummary>
> {
  try {
    await ensureDatabase();

    const id =
      assertNonEmpty(
        studentId,
        "Student ID",
      );

    const student =
      await findStudentById(id);

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    return {
      success: true,
      message:
        "Student loaded successfully.",
      data:
        sanitizeStudentSummary(
          student.toObject(),
        ),
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] getStudent",
      error,
    );
  }
}


export async function getStudentByApplicationId(
  applicationId: string,
): Promise<
  ServiceResult<StudentSummary>
> {
  try {
    await ensureDatabase();

    const id =
      assertNonEmpty(
        applicationId,
        "Application ID",
      );

    const student =
      await StudentModel.findOne({
        applicationId:
          normalizeId(id),
      }).exec();

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found for this application.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    return {
      success: true,
      message:
        "Student loaded successfully.",
      data:
        sanitizeStudentSummary(
          student.toObject(),
        ),
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] getStudentByApplicationId",
      error,
    );
  }
}


export async function listStudents(
  input?: {
    applicationStatus?: string;
    assessmentStatus?: string;
    internshipStatus?: string;
    paymentStatus?: string;
    studentOpsApprovalStatus?: string;
    studentOpsStatus?: string;
    dashboardStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
): Promise<
  ServiceResult<{
    students: StudentSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>
> {
  try {
    await ensureDatabase();

    const page =
      Math.max(
        1,
        Math.floor(
          numberValue(
            input?.page,
            1,
          ),
        ),
      );

    const limit =
      Math.min(
        100,
        Math.max(
          1,
          Math.floor(
            numberValue(
              input?.limit,
              25,
            ),
          ),
        ),
      );

    const filter:
      Record<string, unknown> =
      {};

    const fields = [
      "applicationStatus",
      "assessmentStatus",
      "internshipStatus",
      "paymentStatus",
      "studentOpsApprovalStatus",
      "studentOpsStatus",
      "dashboardStatus",
    ] as const;

    for (
      const field of fields
    ) {
      const value =
        cleanString(
          input?.[field],
        );

      if (value) {
        filter[field] =
          value;
      }
    }

    const search =
      cleanString(
        input?.search,
      );

    if (search) {
      const escaped =
        search.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );

      const regex =
        new RegExp(
          escaped.slice(
            0,
            120,
          ),
          "i",
        );

      filter.$or = [
        { studentId: regex },
        {
          dashboardStudentId:
            regex,
        },
        { applicationId: regex },
        { fullName: regex },
        { email: regex },
        { phone: regex },
        {
          internshipTrack:
            regex,
        },
      ];
    }

    const skip =
      (page - 1) *
      limit;

    const [
      students,
      total,
    ] = await Promise.all([
      StudentModel.find(
        filter,
      )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      StudentModel.countDocuments(
        filter,
      ).exec(),
    ]);

    return {
      success: true,
      message:
        "Students loaded successfully.",
      data: {
        students:
          students.map(
            (student: DatabaseRecord) =>
              sanitizeStudentSummary(
                student,
              ),
          ),

        total,

        page,

        limit,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] listStudents",
      error,
    );
  }
}


export async function approveApplication(
  input: ApproveApplicationInput,
): Promise<ServiceResult> {
  let session:
    | ClientSession
    | null = null;

  try {
    assertMainAdminRole(
      input.actor,
    );

    const applicationId =
      assertNonEmpty(
        input.applicationId,
        "Application ID",
      );

    await ensureDatabase();

    session =
      await mongoose.startSession();

    const temporaryPassword =
      generateSecurePassword(
        MAIN_PASSWORD_LENGTH,
      );

    const passwordHash =
      await hashPassword(
        temporaryPassword,
      );

    let createdStudentId = "";

    let studentEmail = "";

    let studentName = "";

    let internshipTrack = "";

    await session.withTransaction(
      async () => {
        const application =
          await ApplicationModel.findOne({
            applicationId:
              normalizeId(
                applicationId,
              ),
          })
            .session(session)
            .exec();

        if (!application) {
          throw new StudentServiceError(
            "APPLICATION_NOT_FOUND",
            "Application was not found.",
            404,
          );
        }

        if (
          application.status ===
          "approved"
        ) {
          throw new StudentServiceError(
            "APPLICATION_ALREADY_APPROVED",
            "Application is already approved.",
            409,
          );
        }

        if (
          application.status ===
          "rejected"
        ) {
          throw new StudentServiceError(
            "APPLICATION_REJECTED",
            "A rejected application cannot be approved directly.",
            409,
          );
        }

        if (
          application.emailVerified !==
          true
        ) {
          throw new StudentServiceError(
            "EMAIL_NOT_VERIFIED",
            "Student email must be verified before approval.",
            403,
          );
        }

        const existing =
          await StudentModel.findOne({
            $or: [
              {
                applicationId:
                  application.applicationId,
              },
              {
                email:
                  normalizeEmail(
                    application.email,
                  ),
              },
            ],
          })
            .session(session)
            .exec();

        if (existing) {
          throw new StudentServiceError(
            "STUDENT_ALREADY_EXISTS",
            "A student account already exists for this application.",
            409,
          );
        }

        const studentId =
          await generateUniqueStudentId(
            session,
          );

        const now =
          new Date();

        const student =
          new StudentModel({
            applicationId:
              application.applicationId,

            fullName:
              cleanString(
                application.fullName,
              ),

            email:
              normalizeEmail(
                application.email,
              ),

            emailVerified:
              true,

            emailVerifiedAt:
              application.emailVerifiedAt ||
              now,

            phone:
              cleanString(
                application.phone,
              ),

            collegeName:
              cleanString(
                application.collegeUniversity,
              ),

            university:
              cleanString(
                application.collegeUniversity,
              ),

            course:
              cleanString(
                application.course,
              ),

            branchStream:
              cleanString(
                application.branchStream,
              ),

            year:
              cleanString(
                application.graduationYear,
              ),

            studentId,

            loginPasswordHash:
              passwordHash,

            credentialsGenerated:
              true,

            credentialsGeneratedAt:
              now,

            credentialsExpiresAt:
              createExpiryDate(
                MAIN_CREDENTIAL_EXPIRY_DAYS,
              ),

            loginEnabled:
              true,

            loginEnabledAt:
              now,

            mustChangePassword:
              true,

            accountLocked:
              false,

            loginAttempts:
              0,

            applicationStatus:
              "approved",

            assessmentStatus:
              "not-started",

            assessmentPassingScore:
              DEFAULT_PASSING_SCORE,

            resultStatus:
              "pending",

            internshipApplicationAllowed:
              false,

            internshipStatus:
              "locked",

            paymentStatus:
              "unpaid",

            paymentAmount:
              0,

            paymentCurrency:
              "INR",

            adminApprovalStatus:
              "approved",

            adminApprovedBy:
              input.actor.id,

            adminApprovedAt:
              now,

            adminReviewedAt:
              now,

            approvedAt:
              now,

            studentOpsApprovalStatus:
              "pending",

            studentOpsStatus:
              "not-ready",

            dashboardCredentialsGenerated:
              false,

            dashboardLoginEnabled:
              false,

            dashboardStatus:
              "locked",

            dashboardMustChangePassword:
              true,

            dashboardLoginAttempts:
              0,

            dashboardAccountLocked:
              false,

            learningStatus:
              "not-started",

            currentLearningDay:
              0,

            completedLearningDays:
              0,

            taskCompletionPercentage:
              0,

            learningProgressPercentage:
              0,

            attendancePercentage:
              0,

            dailyCodingProblemsCompleted:
              0,

            dailyTasksCompleted:
              0,

            projectCompletionPercentage:
              0,

            weeklyAssessmentStatus:
              "locked",

            saturdayAssessmentStatus:
              "locked",

            projectStatus:
              "locked",

            certificateStatus:
              "not-eligible",

            certificateId:
              "",

            applicationApprovalEmailSent:
              false,

            dashboardCredentialsEmailSent:
              false,

            consentTerms:
              application.consentTerms,

            consentPrivacy:
              application.consentPrivacy,

            consentDeclaration:
              application.consentDeclaration,

            consentAcceptedAt:
              now,

            notes:
              "",
          });

        await student.save({
          session,
        });

        application.status =
          "approved";

        application.studentId =
          studentId;

        await application.save({
          session,
        });

        createdStudentId =
          studentId;

        studentEmail =
          normalizeEmail(
            application.email,
          );

        studentName =
          cleanString(
            application.fullName,
          );

        internshipTrack =
          cleanString(
            application.internshipTrack,
          );
      },
    );

    try {
      const approvedStudent = await StudentModel.findOne({
        studentId: createdStudentId,
      }).exec();

      if (approvedStudent) {
        await syncStudentOperationsRecord(approvedStudent.toObject());
      }
    } catch (syncError) {
      console.error(
        "[StudentService] Initial Student Operations mirror sync failed:",
        syncError,
      );
    }

    if (
      input.sendCredentials !==
      false
    ) {
      try {
        await sendMainCredentialsEmail({
          email:
            studentEmail,

          name:
            studentName,

          studentId:
            createdStudentId,

          password:
            temporaryPassword,

          internship:
            internshipTrack,
        });

        await StudentModel.updateOne(
          {
            studentId:
              createdStudentId,
          },
          {
            $set: {
              applicationApprovalEmailSent:
                true,

              applicationApprovalEmailSentAt:
                new Date(),
            },
          },
        ).exec();

        return {
          success: true,
          message:
            "Application approved. Main student credentials were generated and emailed successfully.",
          code:
            "STUDENT_CREATED",
          data: {
            studentId:
              createdStudentId,

            credentialsGenerated:
              true,

            credentialsSent:
              true,
          },
        };
      } catch (emailError) {
        console.error(
          "[StudentService] Main credentials email failed:",
          emailError,
        );

        return {
          success: true,
          message:
            "Application approved and student account created, but the credential email failed. Use Resend Credentials.",
          code:
            "CREDENTIAL_EMAIL_FAILED",
          data: {
            studentId:
              createdStudentId,

            credentialsGenerated:
              true,

            credentialsSent:
              false,
          },
        };
      }
    }

    return {
      success: true,
      message:
        "Application approved and student account created successfully.",
      code:
        "STUDENT_CREATED",
      data: {
        studentId:
          createdStudentId,

        credentialsGenerated:
          true,

        credentialsSent:
          false,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] approveApplication",
      error,
    );
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}


export async function rejectApplication(
  input: RejectApplicationInput,
): Promise<ServiceResult> {
  try {
    assertMainAdminRole(
      input.actor,
    );

    const applicationId =
      assertNonEmpty(
        input.applicationId,
        "Application ID",
      );

    const reason =
      assertReason(
        input.reason,
      );

    await ensureDatabase();

    const application =
      await ApplicationModel.findOne({
        applicationId:
          normalizeId(
            applicationId,
          ),
      }).exec();

    if (!application) {
      return {
        success: false,
        message:
          "Application was not found.",
        code:
          "APPLICATION_NOT_FOUND",
      };
    }

    if (
      application.status ===
      "approved"
    ) {
      return {
        success: false,
        message:
          "An approved application cannot be rejected.",
        code:
          "APPLICATION_ALREADY_APPROVED",
      };
    }

    application.status =
      "rejected";

    await application.save();

    return {
      success: true,
      message:
        "Application rejected successfully.",
      code:
        "APPLICATION_REJECTED",
      data: {
        applicationId:
          application.applicationId,

        status:
          application.status,

        rejectionReason:
          reason,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] rejectApplication",
      error,
    );
  }
}


export async function resendCredentials(
  input: ResendCredentialsInput,
): Promise<ServiceResult> {
  try {
    assertMainAdminRole(
      input.actor,
    );

    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    await ensureDatabase();

    const student =
      await StudentModel.findOne({
        studentId:
          normalizeId(
            studentId,
          ),
      })
        .select(
          "+loginPasswordHash",
        )
        .exec();

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.applicationStatus,
        "approved",
      )
    ) {
      return {
        success: false,
        message:
          "Student application is not approved.",
        code:
          "APPLICATION_NOT_APPROVED",
      };
    }

    const temporaryPassword =
      generateSecurePassword(
        MAIN_PASSWORD_LENGTH,
      );

    student.loginPasswordHash =
      await hashPassword(
        temporaryPassword,
      );

    student.credentialsGenerated =
      true;

    student.credentialsGeneratedAt =
      new Date();

    student.credentialsExpiresAt =
      createExpiryDate(
        MAIN_CREDENTIAL_EXPIRY_DAYS,
      );

    student.loginEnabled =
      true;

    student.loginEnabledAt =
      student.loginEnabledAt ||
      new Date();

    student.mustChangePassword =
      true;

    student.passwordChangedAt =
      null;

    student.loginAttempts =
      0;

    student.accountLocked =
      false;

    student.lockedUntil =
      null;

    await student.save();

    try {
      await sendMainCredentialsEmail({
        email:
          normalizeEmail(
            student.email,
          ),

        name:
          cleanString(
            student.fullName,
          ),

        studentId:
          normalizeId(
            student.studentId,
          ),

        password:
          temporaryPassword,

        internship:
          cleanString(
            student.internshipTrack,
          ),
      });

      student.applicationApprovalEmailSent =
        true;

      student.applicationApprovalEmailSentAt =
        new Date();

      await student.save();

      return {
        success: true,
        message:
          "Main student credentials regenerated and emailed successfully.",
        code:
          "CREDENTIALS_RESENT",
        data: {
          studentId:
            student.studentId,

          credentialsSent:
            true,
        },
      };
    } catch (emailError) {
      console.error(
        "[StudentService] Credential email failed:",
        emailError,
      );

      return {
        success: true,
        message:
          "Credentials were regenerated but the email could not be sent.",
        code:
          "CREDENTIAL_EMAIL_FAILED",
        data: {
          studentId:
            student.studentId,

          credentialsSent:
            false,
        },
      };
    }
  } catch (error) {
    return handleServiceError(
      "[StudentService] resendCredentials",
      error,
    );
  }
}


export async function startAssessment(
  studentId: string,
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const id =
      assertNonEmpty(
        studentId,
        "Student ID",
      );

    const student =
      await findStudentById(id);

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.applicationStatus,
        "approved",
      )
    ) {
      return {
        success: false,
        message:
          "Application is not approved.",
        code:
          "APPLICATION_NOT_APPROVED",
      };
    }

    if (
      student.loginEnabled !==
      true
    ) {
      return {
        success: false,
        message:
          "Student login is not enabled.",
        code:
          "LOGIN_NOT_ENABLED",
      };
    }

    if (
      !isStatus(
        student.assessmentStatus,
        "not-started",
        "failed",
      )
    ) {
      return {
        success: false,
        message:
          "Assessment cannot be started in the current state.",
        code:
          "ASSESSMENT_NOT_AVAILABLE",
      };
    }

    student.assessmentStatus =
      "in-progress";

    student.assessmentStartedAt =
      new Date();

    student.assessmentAttemptCount =
      numberValue(
        student.assessmentAttemptCount,
      ) + 1;

    await student.save();

    return {
      success: true,
      message:
        "Assessment started successfully.",
      code:
        "ASSESSMENT_STARTED",
      data: {
        studentId:
          student.studentId,

        assessmentStatus:
          student.assessmentStatus,

        assessmentAttemptCount:
          student.assessmentAttemptCount,

        assessmentStartedAt:
          student.assessmentStartedAt,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] startAssessment",
      error,
    );
  }
}


export async function submitAssessmentResult(
  input: AssessmentResultInput,
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    const score =
      assertScore(
        input.score,
      );

    const student =
      await findStudentById(
        studentId,
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.applicationStatus,
        "approved",
      )
    ) {
      return {
        success: false,
        message:
          "Application is not approved.",
        code:
          "APPLICATION_NOT_APPROVED",
      };
    }

    if (
      !isStatus(
        student.assessmentStatus,
        "in-progress",
        "submitted",
        "evaluated",
      )
    ) {
      return {
        success: false,
        message:
          "Assessment is not currently available for result submission.",
        code:
          "ASSESSMENT_NOT_IN_PROGRESS",
      };
    }

    const passingScore = input.passingScore ??
      numberValue(student.assessmentPassingScore, DEFAULT_PASSING_SCORE);

    if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) {
      return {
        success: false,
        message: "Passing score must be between 0 and 100.",
        code: "INVALID_PASSING_SCORE",
      };
    }


    const passed = score >= passingScore;

    student.assessmentScore =
      score;

    student.assessmentPassingScore =
      passingScore;

    student.assessmentStatus =
      passed
        ? "passed"
        : "failed";

    student.resultStatus =
      passed
        ? "passed"
        : "failed";

    student.assessmentSubmittedAt =
      new Date();

    student.assessmentEvaluatedAt =
      new Date();

    student.resultDeclaredAt =
      new Date();

    student.resultVisibleAt =
      new Date();

    student.internshipApplicationAllowed =
      passed;

    if (passed) {

      if (!dateOrNull(student.internshipSelectionDeadlineAt)) {
        const now = new Date();
        student.internshipSelectionWindowStartedAt = now;
        student.internshipSelectionDeadlineAt = createHoursExpiryDate(
          INTERNSHIP_SELECTION_WINDOW_HOURS,
          now,
        );
        student.internshipSelectionWindowExpired = false;
        student.internshipSelectionExpiredAt = null;
        student.journeyExpired = false;
        student.journeyExpiresAt = null;
      }
      student.internshipStatus =
        "available";
    } else {
      student.internshipApplicationAllowed =
        false;

      student.internshipStatus =
        "locked";
    }

    await student.save();

    return {
      success: true,
      message:
        passed
          ? "Assessment passed. Internship selection is now available."
          : "Assessment result recorded. Student did not meet the passing score.",
      code:
        passed
          ? "ASSESSMENT_PASSED"
          : "ASSESSMENT_FAILED",
      data: {
        studentId:
          student.studentId,

        score,

        passingScore,

        assessmentStatus:
          student.assessmentStatus,

        resultStatus:
          student.resultStatus,

        internshipApplicationAllowed:
          student.internshipApplicationAllowed,

        internshipStatus:
          student.internshipStatus,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] submitAssessmentResult",
      error,
    );
  }
}


export async function selectInternship(
  input: SelectInternshipInput,
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    const plan = normalizeInternshipPlan(input.plan);

    if (!plan) {
      return {
        success: false,
        message:
          "Invalid internship plan.",
        code:
          "INVALID_INTERNSHIP_PLAN",
      };
    }

    const student =
      await findStudentById(
        studentId,
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.applicationStatus,
        "approved",
      )
    ) {
      return {
        success: false,
        message:
          "Application is not approved.",
        code:
          "APPLICATION_NOT_APPROVED",
      };
    }

    if (
      !isStatus(
        student.assessmentStatus,
        "passed",
      )
    ) {
      return {
        success: false,
        message:
          "Internship selection requires a passed assessment.",
        code:
          "ASSESSMENT_NOT_PASSED",
      };
    }

    if (
      student.internshipApplicationAllowed !==
      true
    ) {
      return {
        success: false,
        message:
          "Internship selection is not available yet.",
        code:
          "INTERNSHIP_NOT_AVAILABLE",
      };
    }

    if (isStatus(student.paymentStatus, "paid")) {
      return {
        success: false,
        message: "A verified payment already exists for this student.",
        code: "PAYMENT_ALREADY_VERIFIED",
      };
    }

    if (
      isStatus(student.internshipStatus, "payment-pending") &&
      cleanString(student.razorpayOrderId)
    ) {
      return {
        success: false,
        message: "A payment order already exists for the selected internship. Do not change the plan while payment is pending.",
        code: "PAYMENT_ORDER_ALREADY_CREATED",
      };
    }

    const selectionDeadline = ensureInternshipSelectionDeadline(student);
    const now = new Date();
    if (
      student.internshipSelectionWindowExpired === true ||
      selectionDeadline.getTime() <= now.getTime()
    ) {
      expireUnpaidSelectionJourney(student, now);
      await student.save();
      try {
        await syncStudentOperationsRecord(student.toObject());
      } catch (syncError) {
        console.error("[StudentService] Expired selection mirror sync failed:", syncError);
      }
      return {
        success: false,
        message: "The 72-hour internship selection window has expired. Contact the administrator for assistance.",
        code: "INTERNSHIP_SELECTION_WINDOW_EXPIRED",
      };
    }

    const selectedPlan = INTERNSHIP_PLANS[plan];
    const selectedAt = new Date();
    const expectedVersion = Number(student.__v ?? 0);
    const atomicFilter: Record<string, unknown> = {
      _id: student._id,
      __v: expectedVersion,
      applicationStatus: student.applicationStatus,
      assessmentStatus: student.assessmentStatus,
      internshipApplicationAllowed: true,
      paymentStatus: { $ne: "paid" },
      $and: [
        {
          $or: [
            { razorpayOrderId: { $exists: false } },
            { razorpayOrderId: null },
            { razorpayOrderId: "" },
          ],
        },
        {
          $or: [
            { internshipSelectionDeadlineAt: { $gt: selectedAt } },
            { internshipSelectionDeadlineAt: null },
            { internshipSelectionDeadlineAt: { $exists: false } },
          ],
        },
      ],
      internshipSelectionWindowExpired: { $ne: true },
    };

    const updatedStudent = await StudentModel.findOneAndUpdate(
      atomicFilter,
      {
        $set: {
          internshipTrack: cleanString(input.track),
          internshipPlan: plan,
          internshipDurationMonths: selectedPlan.durationMonths,
          internshipDurationDays: selectedPlan.durationDays,
          internshipSelectionAt: selectedAt,
          internshipSelectionWindowStartedAt: student.internshipSelectionWindowStartedAt,
          internshipSelectionDeadlineAt: selectionDeadline,
          internshipSelectionWindowExpired: false,
          internshipSelectionExpiredAt: null,
          internshipStatus: "payment-pending",
          startPreference: cleanString(input.startPreference),
          paymentStatus: "pending",
          paymentAmount: selectedPlan.amount,
          paymentCurrency: selectedPlan.currency,
          studentOpsStatus: "not-ready",
          studentOpsApprovalStatus: "pending",
          dashboardStatus: "locked",
          dashboardLoginEnabled: false,
        },
        $inc: { __v: 1 },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      },
    ).exec();

    if (!updatedStudent) {
      return {
        success: false,
        message: "The student record changed or the internship selection window is no longer valid. Refresh and try again.",
        code: "INTERNSHIP_SELECTION_CONFLICT",
      };
    }

    try {
      await syncStudentOperationsRecord(updatedStudent.toObject());
    } catch (syncError) {
      console.error(
        "[StudentService] Student Operations mirror sync failed:",
        syncError,
      );
    }

    return {
      success: true,
      message:
        "Internship selected successfully. Payment is now pending.",
      code:
        "INTERNSHIP_SELECTED",
      data: {
        studentId:
          updatedStudent.studentId,

        internshipPlan:
          selectedPlan.name,

        durationMonths:
          selectedPlan.durationMonths,

        durationDays:
          selectedPlan.durationDays,

        amount:
          selectedPlan.amount,

        currency:
          selectedPlan.currency,

        internshipStatus:
          updatedStudent.internshipStatus,

        paymentStatus:
          updatedStudent.paymentStatus,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] selectInternship",
      error,
    );
  }
}


export async function markPaymentPending(
  input: {
    studentId: string;
    razorpayOrderId: string;
    amount: number;
    currency?: string;
  },
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    const orderId =
      assertNonEmpty(
        input.razorpayOrderId,
        "Razorpay Order ID",
      );

    const amount =
      numberValue(
        input.amount,
        -1,
      );

    if (
      amount <= 0
    ) {
      return {
        success: false,
        message:
          "Invalid payment amount.",
        code:
          "INVALID_PAYMENT_AMOUNT",
      };
    }

    const currency =
      cleanString(
        input.currency,
      ).toUpperCase() ||
      "INR";

    const student =
      await findStudentById(
        studentId,
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    const selectedPlan = normalizeInternshipPlan(student.internshipPlan);

    if (!selectedPlan) {
      return {
        success: false,
        message: "A valid internship plan must be selected before payment.",
        code: "INTERNSHIP_PLAN_REQUIRED",
      };
    }

    const officialPlan = INTERNSHIP_PLANS[selectedPlan];

    if (
      numberValue(student.paymentAmount, -1) !== officialPlan.amount ||
      cleanString(student.paymentCurrency).toUpperCase() !== officialPlan.currency
    ) {
      return {
        success: false,
        message: "The saved payment amount or currency does not match the official internship plan. Please select the plan again.",
        code: "PAYMENT_PLAN_MISMATCH",
      };
    }

    if (
      !isStatus(
        student.internshipStatus,
        "payment-pending",
      )
    ) {
      return {
        success: false,
        message:
          "Student is not currently waiting for payment.",
        code:
          "PAYMENT_NOT_ALLOWED",
      };
    }

    if (
      amount !==
      numberValue(
        student.paymentAmount,
      )
    ) {
      return {
        success: false,
        message:
          "Payment amount does not match the selected internship plan.",
        code:
          "PAYMENT_AMOUNT_MISMATCH",
      };
    }

    const selectionDeadline = ensureInternshipSelectionDeadline(student);
    const now = new Date();
    if (
      student.internshipSelectionWindowExpired === true ||
      selectionDeadline.getTime() <= now.getTime()
    ) {
      expireUnpaidSelectionJourney(student, now);
      await student.save();
      try {
        await syncStudentOperationsRecord(student.toObject());
      } catch (syncError) {
        console.error("[StudentService] Expired payment-order mirror sync failed:", syncError);
      }
      return {
        success: false,
        message: "The 72-hour selection/payment window has expired. A new payment order cannot be created.",
        code: "INTERNSHIP_SELECTION_WINDOW_EXPIRED",
      };
    }

    if (currency !== cleanString(student.paymentCurrency).toUpperCase()) {
      return {
        success: false,
        message: "Payment currency does not match the selected plan.",
        code: "PAYMENT_CURRENCY_MISMATCH",
      };
    }

    student.razorpayOrderId =
      orderId;

    student.paymentCurrency =
      currency;

    student.paymentStatus =
      "pending";

    await student.save();
    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error(
        "[StudentService] Student Operations mirror sync failed:",
        syncError,
      );
    }

    return {
      success: true,
      message:
        "Payment order recorded successfully.",
      code:
        "PAYMENT_PENDING",
      data: {
        studentId:
          student.studentId,

        razorpayOrderId:
          student.razorpayOrderId,

        paymentAmount:
          student.paymentAmount,

        paymentCurrency:
          student.paymentCurrency,

        paymentStatus:
          student.paymentStatus,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] markPaymentPending",
      error,
    );
  }
}


export async function recordVerifiedPayment(
  input: PaymentVerificationInput,
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    const orderId =
      assertNonEmpty(
        input.razorpayOrderId,
        "Razorpay Order ID",
      );

    const paymentId =
      assertNonEmpty(
        input.razorpayPaymentId,
        "Razorpay Payment ID",
      );

    const student =
      await findStudentById(
        studentId,
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      student.razorpayOrderId !==
      orderId
    ) {
      return {
        success: false,
        message:
          "Razorpay Order ID does not match the student's payment order.",
        code:
          "PAYMENT_ORDER_MISMATCH",
      };
    }

    if (
      input.amount !==
      undefined &&
      numberValue(
        input.amount,
        -1,
      ) !==
      numberValue(
        student.paymentAmount,
        -2,
      )
    ) {
      return {
        success: false,
        message:
          "Payment amount does not match the selected internship plan.",
        code:
          "PAYMENT_AMOUNT_MISMATCH",
      };
    }

    const incomingCurrency =
      cleanString(
        input.currency,
      ).toUpperCase() ||
      "INR";

    if (
      incomingCurrency !==
      cleanString(
        student.paymentCurrency,
      ).toUpperCase()
    ) {
      return {
        success: false,
        message:
          "Payment currency does not match the expected currency.",
        code:
          "PAYMENT_CURRENCY_MISMATCH",
      };
    }


    if (
      isStatus(
        student.paymentStatus,
        "paid",
      ) &&
      student.razorpayPaymentId ===
        paymentId
    ) {
      return {
        success: true,
        message:
          "Payment was already verified.",
        code:
          "PAYMENT_ALREADY_VERIFIED",
        data: {
          studentId:
            student.studentId,

          paymentStatus:
            student.paymentStatus,

          internshipStatus:
            student.internshipStatus,

          studentOpsStatus:
            student.studentOpsStatus,

          receiptEmailSent:
            booleanValue(
              student.receiptEmailSent,
            ),
        },
      };
    }

    if (
      isStatus(
        student.paymentStatus,
        "refunded",
      )
    ) {
      return {
        success: false,
        message:
          "A refunded payment cannot be reused.",
        code:
          "PAYMENT_REFUNDED",
      };
    }


    const selectionDeadline = ensureInternshipSelectionDeadline(student);
    const now = new Date();
    if (
      student.internshipSelectionWindowExpired === true ||
      selectionDeadline.getTime() <= now.getTime()
    ) {
      expireUnpaidSelectionJourney(student, now);
      await student.save();
      try {
        await syncStudentOperationsRecord(student.toObject());
      } catch (syncError) {
        console.error("[StudentService] Expired payment verification mirror sync failed:", syncError);
      }
      return {
        success: false,
        message: "The 72-hour selection/payment window expired before payment was accepted. Contact support for payment reconciliation.",
        code: "INTERNSHIP_SELECTION_WINDOW_EXPIRED",
      };
    }

    if (!cleanString(student.razorpayOrderId) || student.razorpayOrderId !== orderId) {
      return {
        success: false,
        message: "A matching server-created payment order is required.",
        code: "PAYMENT_ORDER_MISMATCH",
      };
    }

    student.razorpayOrderId =
      orderId;

    student.razorpayPaymentId =
      paymentId;

    if (
      input.razorpaySignature
    ) {
      student.razorpaySignature =
        input.razorpaySignature;
    }

    student.paymentStatus =
      "paid";
    student.internshipSelectionWindowExpired = false;
    student.journeyExpired = false;

    student.paymentCompletedAt =
      new Date();

    student.paymentVerifiedAt =
      new Date();


    student.internshipStatus =
      "approved";

    student.studentOpsApprovalStatus =
      "pending";

    student.studentOpsStatus =
      "pending-review";

    student.dashboardStatus =
      "locked";

    student.dashboardLoginEnabled =
      false;

    student.dashboardCredentialsGenerated =
      false;

    await student.save();
    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error(
        "[StudentService] Student Operations mirror sync failed:",
        syncError,
      );
    }

    return {
      success: true,
      message:
        "Payment verified successfully. Payment receipt can now be sent and the student has been moved to Student Operations review.",
      code:
        "PAYMENT_VERIFIED",
      data: {
        studentId:
          student.studentId,

        internshipPlan:
          student.internshipPlan,

        internshipStatus:
          student.internshipStatus,

        paymentStatus:
          student.paymentStatus,

        paymentAmount:
          student.paymentAmount,

        paymentCurrency:
          student.paymentCurrency,

        razorpayOrderId:
          student.razorpayOrderId,

        razorpayPaymentId:
          student.razorpayPaymentId,

        studentOpsApprovalStatus:
          student.studentOpsApprovalStatus,

        studentOpsStatus:
          student.studentOpsStatus,

        dashboardStatus:
          student.dashboardStatus,

        receiptEmailSent:
          booleanValue(
            student.receiptEmailSent,
          ),
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] recordVerifiedPayment",
      error,
    );
  }
}


export async function approveStudentOperations(
  input: StudentOperationsApprovalInput,
): Promise<ServiceResult> {
  try {
    assertStudentOperationsRole(
      input.actor,
    );

    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    await ensureDatabase();

    const student =
      await findStudentById(
        studentId,
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.paymentStatus,
        "paid",
      )
    ) {
      return {
        success: false,
        message:
          "Verified payment is required before Student Operations approval.",
        code:
          "PAYMENT_NOT_VERIFIED",
      };
    }

    if (
      !isStatus(
        student.internshipStatus,
        "approved",
      )
    ) {
      return {
        success: false,
        message:
          "Internship is not ready for Student Operations approval.",
        code:
          "INTERNSHIP_NOT_APPROVED",
      };
    }

    const now =
      new Date();

    if (
      input.approved !==
      true
    ) {
      const reason =
        assertReason(
          input.reason,
        );

      student.studentOpsApprovalStatus =
        "rejected";

      student.studentOpsApprovedBy =
        input.actor.id;

      student.studentOpsApprovedAt =
        now;

      student.studentOpsReviewedAt =
        now;

      student.studentOpsRejectionReason =
        reason;

      student.studentOpsStatus =
        "suspended";

      student.studentOpsSuspendedAt =
        now;

      student.studentOpsSuspensionReason =
        reason;

      student.dashboardLoginEnabled =
        false;

      student.dashboardStatus =
        "locked";

      await student.save();


      try {
        await syncStudentOperationsRecord(student.toObject());
      } catch (syncError) {
        console.error(
          "[StudentService] Student Operations mirror sync failed after rejection:",
          syncError,
        );
      }

      return {
        success: true,
        message:
          "Student Operations approval rejected.",
        code:
          "STUDENT_OPS_REJECTED",
        data: {
          studentId:
            student.studentId,

          studentOpsApprovalStatus:
            student.studentOpsApprovalStatus,

          studentOpsStatus:
            student.studentOpsStatus,

          dashboardStatus:
            student.dashboardStatus,
        },
      };
    }


    student.studentOpsApprovalStatus =
      "approved";

    student.studentOpsApprovedBy =
      input.actor.id;

    student.studentOpsApprovedAt =
      now;

    student.studentOpsReviewedAt =
      now;

    student.studentOpsRejectionReason =
      "";

    student.studentOpsStatus =
      "active";

    student.studentOpsActivatedAt =
      now;


    const dashboardStudentId =
      student.dashboardStudentId ||
      await generateUniqueDashboardStudentId();

    const temporaryPassword =
      generateSecurePassword(
        DASHBOARD_PASSWORD_LENGTH,
      );

    student.dashboardStudentId =
      dashboardStudentId;

    student.dashboardPasswordHash =
      await hashPassword(
        temporaryPassword,
      );

    student.dashboardCredentialsGenerated =
      true;

    student.dashboardCredentialsEmailSent =
      false;

    student.dashboardCredentialsEmailSentAt =
      null;

    student.dashboardCredentialsGeneratedAt =
      now;

    const internshipDurationDays =
      getVerifiedInternshipDurationDays(student);

    const internshipStartedAt =
      dateOrNull(student.internshipStartedAt) || now;

    const internshipEndsAt =
      createExpiryDate(
        internshipDurationDays,
        internshipStartedAt,
      );

    student.internshipDurationDays =
      internshipDurationDays;

    student.internshipStartedAt =
      internshipStartedAt;

    student.internshipEndsAt =
      internshipEndsAt;

    student.dashboardCredentialsExpiresAt =
      internshipEndsAt;

    student.dashboardLoginEnabled =
      true;

    student.dashboardLoginEnabledAt =
      now;

    student.dashboardPasswordChangedAt =
      null;

    student.dashboardMustChangePassword =
      true;

    student.dashboardLoginAttempts =
      0;

    student.dashboardAccountLocked =
      false;

    student.dashboardLockedUntil =
      null;

    student.dashboardStatus =
      "active";

    student.dashboardActivatedAt =
      now;

    student.dashboardDeactivatedAt =
      null;

    student.dashboardDeactivationReason =
      "";

    await student.save();


    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error(
        "[StudentService] Student Operations mirror sync failed after approval:",
        syncError,
      );
    }


    try {
      await sendDashboardCredentialsEmail({
        email:
          normalizeEmail(
            student.email,
          ),

        name:
          cleanString(
            student.fullName,
          ),

        dashboardStudentId,

        password:
          temporaryPassword,

        internship:
          cleanString(
            student.internshipTrack,
          ),
      });

      student.dashboardCredentialsEmailSent =
        true;

      student.dashboardCredentialsEmailSentAt =
        new Date();

      await student.save();

      try {
        await syncStudentOperationsRecord(student.toObject());
      } catch (syncError) {
        console.error(
          "[StudentService] Student Operations mirror sync failed after credential email status update:",
          syncError,
        );
      }

      return {
        success: true,
        message:
          "Student approved successfully. New dashboard credentials were generated and emailed to the student.",
        code:
          "STUDENT_OPS_APPROVED_AND_DASHBOARD_ACTIVATED",
        data: {
          studentId:
            student.studentId,

          dashboardStudentId,

          studentOpsApprovalStatus:
            student.studentOpsApprovalStatus,

          studentOpsStatus:
            student.studentOpsStatus,

          dashboardStatus:
            student.dashboardStatus,

          dashboardLoginEnabled:
            student.dashboardLoginEnabled,

          credentialsGenerated:
            true,

          credentialsSent:
            true,
        },
      };
    } catch (emailError) {
      console.error(
        "[StudentService] Dashboard credential email failed:",
        emailError,
      );

      return {
        success: true,
        message:
          "Student approved and dashboard activated, but the new dashboard credential email failed. Use dashboard credential resend.",
        code:
          "DASHBOARD_CREDENTIAL_EMAIL_FAILED",
        data: {
          studentId:
            student.studentId,

          dashboardStudentId,

          dashboardStatus:
            student.dashboardStatus,

          dashboardLoginEnabled:
            student.dashboardLoginEnabled,

          credentialsGenerated:
            true,

          credentialsSent:
            false,
        },
      };
    }
  } catch (error) {
    return handleServiceError(
      "[StudentService] approveStudentOperations",
      error,
    );
  }
}


export async function generateDashboardCredentials(
  input: GenerateDashboardCredentialsInput,
): Promise<ServiceResult> {
  try {
    assertStudentOperationsRole(
      input.actor,
    );

    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    await ensureDatabase();

    const student =
      await findStudentById(
        studentId,
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.paymentStatus,
        "paid",
      )
    ) {
      return {
        success: false,
        message:
          "Verified payment is required.",
        code:
          "PAYMENT_NOT_VERIFIED",
      };
    }

    if (
      !isStatus(
        student.studentOpsApprovalStatus,
        "approved",
      )
    ) {
      return {
        success: false,
        message:
          "Student Operations approval is required.",
        code:
          "STUDENT_OPS_NOT_APPROVED",
      };
    }

    if (
      !isStatus(
        student.studentOpsStatus,
        "active",
      )
    ) {
      return {
        success: false,
        message:
          "Student Operations account is not active.",
        code:
          "STUDENT_OPS_NOT_ACTIVE",
      };
    }

    const dashboardStudentId =
      student.dashboardStudentId ||
      await generateUniqueDashboardStudentId();

    const temporaryPassword =
      generateSecurePassword(
        DASHBOARD_PASSWORD_LENGTH,
      );

    student.dashboardStudentId =
      dashboardStudentId;

    student.dashboardPasswordHash =
      await hashPassword(
        temporaryPassword,
      );

    student.dashboardCredentialsGenerated =
      true;

    student.dashboardCredentialsEmailSent =
      false;

    student.dashboardCredentialsEmailSentAt =
      null;

    const credentialGeneratedAt = new Date();

    student.dashboardCredentialsGeneratedAt =
      credentialGeneratedAt;
    const internshipDurationDays =
      getVerifiedInternshipDurationDays(student);

    const internshipStartedAt =
      dateOrNull(student.internshipStartedAt) || credentialGeneratedAt;

    const internshipEndsAt =
      dateOrNull(student.internshipEndsAt) ||
      createExpiryDate(internshipDurationDays, internshipStartedAt);

    if (internshipEndsAt.getTime() <= credentialGeneratedAt.getTime()) {
      return {
        success: false,
        message: "The internship period has expired. Dashboard credentials cannot be generated.",
        code: "INTERNSHIP_PERIOD_EXPIRED",
      };
    }

    student.internshipDurationDays =
      internshipDurationDays;

    student.internshipStartedAt =
      internshipStartedAt;

    student.internshipEndsAt =
      internshipEndsAt;

    student.dashboardCredentialsExpiresAt =
      internshipEndsAt;

    student.dashboardLoginEnabled =
      true;

    student.dashboardLoginEnabledAt =
      credentialGeneratedAt;

    student.dashboardPasswordChangedAt =
      null;

    student.dashboardMustChangePassword =
      true;

    student.dashboardLoginAttempts =
      0;

    student.dashboardAccountLocked =
      false;

    student.dashboardLockedUntil =
      null;

    student.dashboardStatus =
      "active";

    student.dashboardActivatedAt =
      credentialGeneratedAt;

    await student.save();


    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error(
        "[StudentService] Student Operations mirror sync failed after dashboard credential generation:",
        syncError,
      );
    }

    if (
      input.sendCredentials !==
      false
    ) {
      try {
        await sendDashboardCredentialsEmail({
          email:
            normalizeEmail(
              student.email,
            ),

          name:
            cleanString(
              student.fullName,
            ),

          dashboardStudentId,

          password:
            temporaryPassword,

          internship:
            cleanString(
              student.internshipTrack,
            ),
        });

        student.dashboardCredentialsEmailSent =
          true;

        student.dashboardCredentialsEmailSentAt =
          new Date();

        await student.save();

        try {
          await syncStudentOperationsRecord(student.toObject());
        } catch (syncError) {
          console.error(
            "[StudentService] Student Operations mirror sync failed after dashboard credential email status update:",
            syncError,
          );
        }

        return {
          success: true,
          message:
            "Dashboard credentials generated and emailed successfully.",
          code:
            "DASHBOARD_ACTIVATED",
          data: {
            dashboardStudentId,
            credentialsSent:
              true,
          },
        };
      } catch (emailError) {
        console.error(
          "[StudentService] Dashboard credentials email failed:",
          emailError,
        );

        return {
          success: true,
          message:
            "Dashboard credentials were generated but email delivery failed.",
          code:
            "DASHBOARD_CREDENTIAL_EMAIL_FAILED",
          data: {
            dashboardStudentId,
            credentialsSent:
              false,
          },
        };
      }
    }

    return {
      success: true,
      message:
        "Dashboard credentials generated successfully.",
      code:
        "DASHBOARD_ACTIVATED",
      data: {
        dashboardStudentId,
        credentialsSent:
          false,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] generateDashboardCredentials",
      error,
    );
  }
}


export async function updateDashboardStatus(
  input: DashboardStatusInput,
): Promise<ServiceResult> {
  try {
    assertStudentOperationsRole(
      input.actor,
    );

    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    await ensureDatabase();

    const student =
      await findStudentById(
        studentId,
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      input.status ===
      "active"
    ) {
      if (
        !isStatus(
          student.studentOpsApprovalStatus,
          "approved",
        )
      ) {
        return {
          success: false,
          message:
            "Student Operations approval is required.",
          code:
            "STUDENT_OPS_NOT_APPROVED",
        };
      }

      if (
        student.dashboardCredentialsGenerated !==
        true
      ) {
        return {
          success: false,
          message:
            "Dashboard credentials must be generated first.",
          code:
            "DASHBOARD_CREDENTIALS_NOT_GENERATED",
        };
      }

      student.dashboardStatus =
        "active";

      student.dashboardLoginEnabled =
        true;

      student.dashboardLoginEnabledAt =
        new Date();

      student.dashboardActivatedAt =
        new Date();

      student.dashboardDeactivatedAt =
        null;

      student.dashboardDeactivationReason =
        "";
    } else {
      student.dashboardStatus =
        input.status;

      student.dashboardLoginEnabled =
        false;

      student.dashboardDeactivatedAt =
        new Date();

      student.dashboardDeactivationReason =
        cleanString(
          input.reason,
        );
    }

    await student.save();
    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error(
        "[StudentService] Student Operations mirror sync failed after dashboard status update:",
        syncError,
      );
    }


    return {
      success: true,
      message:
        `Dashboard status changed to ${input.status}.`,
      code:
        "DASHBOARD_STATUS_UPDATED",
      data: {
        studentId:
          student.studentId,

        dashboardStatus:
          student.dashboardStatus,

        dashboardLoginEnabled:
          student.dashboardLoginEnabled,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] updateDashboardStatus",
      error,
    );
  }
}


export async function canAccessDashboard(
  studentId: string,
): Promise<
  ServiceResult<{
    allowed: boolean;
    reason?: string;
  }>
> {
  try {
    await ensureDatabase();

    const id =
      assertNonEmpty(
        studentId,
        "Student ID",
      );

    const student =
      await findStudentById(id);

    if (!student) {
      return {
        success: true,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
        data: {
          allowed: false,
          reason:
            "Student account was not found.",
        },
      };
    }

    const checks: Array<
      [boolean, string, string]
    > = [
      [
        isStatus(
          student.applicationStatus,
          "approved",
        ),
        "APPLICATION_NOT_APPROVED",
        "Application is not approved.",
      ],

      [
        isStatus(
          student.assessmentStatus,
          "passed",
        ),
        "ASSESSMENT_NOT_PASSED",
        "Assessment has not been passed.",
      ],

      [
        isStatus(
          student.paymentStatus,
          "paid",
        ),
        "PAYMENT_NOT_VERIFIED",
        "Payment has not been verified.",
      ],

      [
        isStatus(
          student.studentOpsApprovalStatus,
          "approved",
        ),
        "STUDENT_OPS_NOT_APPROVED",
        "Student Operations approval is pending.",
      ],

      [
        isStatus(
          student.studentOpsStatus,
          "active",
        ),
        "STUDENT_OPS_NOT_ACTIVE",
        "Student Operations account is not active.",
      ],

      [
        isStatus(
          student.dashboardStatus,
          "active",
        ),
        "DASHBOARD_NOT_ACTIVE",
        "Dashboard is not active.",
      ],

      [
        student.dashboardLoginEnabled ===
          true,
        "DASHBOARD_LOGIN_NOT_ENABLED",
        "Dashboard login is disabled.",
      ],

      [
        student.dashboardCredentialsGenerated ===
          true,
        "DASHBOARD_CREDENTIALS_NOT_GENERATED",
        "Dashboard credentials have not been generated.",
      ],
    ];

    for (
      const [
        passed,
        code,
        reason,
      ] of checks
    ) {
      if (!passed) {
        return {
          success: true,
          message:
            reason,
          code,
          data: {
            allowed: false,
            reason,
          },
        };
      }
    }

    const expiry =
      dateOrNull(
        student.dashboardCredentialsExpiresAt,
      );

    if (
      expiry &&
      expiry.getTime() <=
        Date.now()
    ) {
      return {
        success: true,
        message:
          "Dashboard credentials have expired.",
        code:
          "DASHBOARD_CREDENTIALS_EXPIRED",
        data: {
          allowed: false,
          reason:
            "Dashboard credentials have expired.",
        },
      };
    }

    return {
      success: true,
      message:
        "Student dashboard access granted.",
      code:
        "DASHBOARD_ACCESS_GRANTED",
      data: {
        allowed: true,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] canAccessDashboard",
      error,
    );
  }
}


export async function updateLearningProgress(
  input: {
    studentId: string;
    currentLearningDay?: number;
    completedLearningDays?: number;
    totalLearningDays?: number;
    taskCompletionPercentage?: number;
    learningProgressPercentage?: number;
    attendancePercentage?: number;
    dailyCodingProblemsCompleted?: number;
    dailyTasksCompleted?: number;
    projectCompletionPercentage?: number;
  },
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const student =
      await findStudentById(
        assertNonEmpty(
          input.studentId,
          "Student ID",
        ),
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    const numericFields = [
      "currentLearningDay",
      "completedLearningDays",
      "totalLearningDays",
      "dailyCodingProblemsCompleted",
      "dailyTasksCompleted",
    ] as const;

    for (
      const field of numericFields
    ) {
      const value =
        input[field];

      if (value !== undefined) {
        if (!Number.isFinite(value) || value < 0) {
          return {
            success: false,
            message: `${field} must be a non-negative number.`,
            code: "INVALID_PROGRESS",
          };
        }
        student[field] = Math.floor(value);
      }
    }

    const percentageFields = [
      "taskCompletionPercentage",
      "learningProgressPercentage",
      "attendancePercentage",
      "projectCompletionPercentage",
    ] as const;

    for (
      const field of percentageFields
    ) {
      const value =
        input[field];

      if (
        value !== undefined
      ) {
        if (
          value < 0 ||
          value > 100
        ) {
          return {
            success: false,
            message:
              `${field} must be between 0 and 100.`,
            code:
              "INVALID_PROGRESS",
          };
        }

        student[field] =
          value;
      }
    }

    if (
      student.learningProgressPercentage >
      0 &&
      student.learningStatus ===
        "not-started"
    ) {
      student.learningStatus =
        "active";
    }

    if (
      student.learningProgressPercentage >=
      100
    ) {
      student.learningStatus =
        "completed";
    }

    await student.save();

    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error("[StudentService] Learning progress mirror sync failed:", syncError);
    }

    return {
      success: true,
      message:
        "Learning progress updated successfully.",
      code:
        "LEARNING_PROGRESS_UPDATED",
      data: {
        studentId:
          student.studentId,

        learningStatus:
          student.learningStatus,

        currentLearningDay:
          student.currentLearningDay,

        completedLearningDays:
          student.completedLearningDays,

        taskCompletionPercentage:
          student.taskCompletionPercentage,

        learningProgressPercentage:
          student.learningProgressPercentage,

        attendancePercentage:
          student.attendancePercentage,

        dailyCodingProblemsCompleted:
          student.dailyCodingProblemsCompleted,

        dailyTasksCompleted:
          student.dailyTasksCompleted,

        projectCompletionPercentage:
          student.projectCompletionPercentage,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] updateLearningProgress",
      error,
    );
  }
}


export async function recordWeeklyAssessment(
  input: {
    studentId: string;
    score: number;
    saturday?: boolean;
  },
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const student =
      await findStudentById(
        assertNonEmpty(
          input.studentId,
          "Student ID",
        ),
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.dashboardStatus,
        "active",
      )
    ) {
      return {
        success: false,
        message:
          "Student dashboard is not active.",
        code:
          "DASHBOARD_NOT_ACTIVE",
      };
    }

    const score =
      assertScore(
        input.score,
      );

    const passed =
      score >=
      DEFAULT_PASSING_SCORE;

    const status =
      passed
        ? "passed"
        : "failed";

    if (
      input.saturday
    ) {
      student.saturdayAssessmentScore =
        score;

      student.saturdayAssessmentStatus =
        status;

      student.lastSaturdayAssessmentAt =
        new Date();
    } else {
      student.weeklyAssessmentScore =
        score;

      student.weeklyAssessmentStatus =
        status;

      student.lastWeeklyAssessmentAt =
        new Date();

      student.weeklyAssessmentCount =
        numberValue(
          student.weeklyAssessmentCount,
        ) + 1;
    }

    await student.save();

    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error("[StudentService] Weekly assessment mirror sync failed:", syncError);
    }

    return {
      success: true,
      message:
        passed
          ? "Assessment passed successfully."
          : "Assessment result recorded.",
      code:
        passed
          ? "WEEKLY_ASSESSMENT_PASSED"
          : "WEEKLY_ASSESSMENT_FAILED",
      data: {
        studentId:
          student.studentId,

        score,

        passed,

        saturday:
          input.saturday === true,

        status,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] recordWeeklyAssessment",
      error,
    );
  }
}


export async function updateProjectStatus(
  input: {
    studentId: string;
    status:
      | "locked"
      | "available"
      | "in-progress"
      | "submitted"
      | "review"
      | "approved"
      | "rejected"
      | "completed";
    projectId?: string;
    projectName?: string;
    completionPercentage?: number;
  },
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const student =
      await findStudentById(
        assertNonEmpty(
          input.studentId,
          "Student ID",
        ),
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      input.completionPercentage !==
      undefined
    ) {
      if (
        input.completionPercentage <
          0 ||
        input.completionPercentage >
          100
      ) {
        return {
          success: false,
          message:
            "Project completion must be between 0 and 100.",
          code:
            "INVALID_PROJECT_PROGRESS",
        };
      }

      student.projectCompletionPercentage =
        input.completionPercentage;
    }

    student.projectStatus =
      input.status;

    if (
      input.projectName !==
      undefined
    ) {
      student.currentProjectName =
        cleanString(
          input.projectName,
        );
    }

    if (
      input.projectId &&
      mongoose.Types.ObjectId.isValid(
        input.projectId,
      )
    ) {
      student.currentProjectId =
        input.projectId;
    }

    if (
      input.status ===
      "in-progress" &&
      !student.projectStartedAt
    ) {
      student.projectStartedAt =
        new Date();
    }

    if (
      input.status ===
        "completed" ||
      student.projectCompletionPercentage >=
        100
    ) {
      student.projectCompletedAt =
        new Date();

      student.projectCompletionPercentage =
        100;
    }

    await student.save();

    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error("[StudentService] Project status mirror sync failed:", syncError);
    }

    return {
      success: true,
      message:
        "Project status updated successfully.",
      code:
        "PROJECT_STATUS_UPDATED",
      data: {
        studentId:
          student.studentId,

        projectStatus:
          student.projectStatus,

        projectCompletionPercentage:
          student.projectCompletionPercentage,

        currentProjectName:
          student.currentProjectName,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] updateProjectStatus",
      error,
    );
  }
}


export async function completeInternship(
  input: CompleteInternshipInput,
): Promise<ServiceResult> {
  try {
    if (input.actor) {
      assertStudentOperationsRole(
        input.actor,
      );
    }

    await ensureDatabase();

    const student =
      await findStudentById(
        assertNonEmpty(
          input.studentId,
          "Student ID",
        ),
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.paymentStatus,
        "paid",
      )
    ) {
      return {
        success: false,
        message:
          "Verified payment is required.",
        code:
          "PAYMENT_NOT_VERIFIED",
      };
    }

    if (
      numberValue(
        student.projectCompletionPercentage,
      ) < 100
    ) {
      return {
        success: false,
        message:
          "Project must be completed before internship completion.",
        code:
          "PROJECT_NOT_COMPLETED",
      };
    }

    student.internshipStatus =
      "completed";

    student.internshipCompletedAt =
      new Date();

    student.studentOpsStatus =
      "completed";

    student.dashboardStatus =
      "completed";

    student.dashboardLoginEnabled =
      false;

    student.learningStatus =
      "completed";

    student.certificateStatus =
      "eligible";

    await student.save();

    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error("[StudentService] Internship completion mirror sync failed:", syncError);
    }

    return {
      success: true,
      message:
        "Internship completed successfully. Student is now eligible for certificate generation.",
      code:
        "INTERNSHIP_COMPLETED",
      data: {
        studentId:
          student.studentId,

        internshipStatus:
          student.internshipStatus,

        studentOpsStatus:
          student.studentOpsStatus,

        dashboardStatus:
          student.dashboardStatus,

        certificateStatus:
          student.certificateStatus,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] completeInternship",
      error,
    );
  }
}


export async function verifyCertificate(
  certificateId: string,
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const id =
      assertNonEmpty(
        certificateId,
        "Certificate ID",
      );

    const student =
      await StudentModel.findOne({
        certificateId:
          normalizeId(id),
      })
        .lean()
        .exec();

    if (!student) {
      return {
        success: false,
        message:
          "Certificate was not found.",
        code:
          "CERTIFICATE_NOT_FOUND",
        data: {
          valid: false,
        },
      };
    }

    const valid =
      isStatus(
        student.certificateStatus,
        "eligible",
        "generated",
        "verified",
      );

    return {
      success: true,
      message:
        valid
          ? "Certificate verified successfully."
          : "Certificate is not currently valid.",
      code:
        valid
          ? "CERTIFICATE_VERIFIED"
          : "CERTIFICATE_INVALID",
      data: {
        valid,

        certificateId:
          student.certificateId,

        studentId:
          student.studentId,

        studentName:
          student.fullName,

        internshipPlan:
          student.internshipPlan,

        internshipTrack:
          student.internshipTrack,

        certificateStatus:
          student.certificateStatus,

        generatedAt:
          dateOrNull(
            student.certificateGeneratedAt,
          ),
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] verifyCertificate",
      error,
    );
  }
}


export async function changeMainPassword(
  input: {
    studentId: string;
    newPassword: string;
  },
): Promise<ServiceResult> {
  try {
    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    const password =
      typeof input.newPassword ===
      "string"
        ? input.newPassword
        : "";

    if (
      password.length < 8 ||
      password.length > 128
    ) {
      return {
        success: false,
        message:
          "Password must contain 8 to 128 characters.",
        code:
          "INVALID_PASSWORD",
      };
    }

    await ensureDatabase();

    const student =
      await StudentModel.findOne({
        studentId:
          normalizeId(
            studentId,
          ),
      })
        .select(
          "+loginPasswordHash",
        )
        .exec();

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    student.loginPasswordHash =
      await hashPassword(
        password,
      );

    student.mustChangePassword =
      false;

    student.passwordChangedAt =
      new Date();

    student.loginAttempts =
      0;

    student.accountLocked =
      false;

    student.lockedUntil =
      null;

    await student.save();

    return {
      success: true,
      message:
        "Main student password changed successfully.",
      code:
        "PASSWORD_CHANGED",
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] changeMainPassword",
      error,
    );
  }
}


export async function changeDashboardPassword(
  input: {
    studentId: string;
    newPassword: string;
  },
): Promise<ServiceResult> {
  try {
    const studentId =
      assertNonEmpty(
        input.studentId,
        "Student ID",
      );

    const password =
      typeof input.newPassword ===
      "string"
        ? input.newPassword
        : "";

    if (
      password.length < 8 ||
      password.length > 128
    ) {
      return {
        success: false,
        message:
          "Dashboard password must contain 8 to 128 characters.",
        code:
          "INVALID_PASSWORD",
      };
    }

    await ensureDatabase();

    const student =
      await StudentModel.findOne({
        $or: [
          {
            studentId:
              normalizeId(
                studentId,
              ),
          },
          {
            dashboardStudentId:
              normalizeId(
                studentId,
              ),
          },
        ],
      })
        .select(
          "+dashboardPasswordHash",
        )
        .exec();

    if (!student) {
      return {
        success: false,
        message:
          "Student dashboard account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    student.dashboardPasswordHash =
      await hashPassword(
        password,
      );

    student.dashboardMustChangePassword =
      false;

    student.dashboardPasswordChangedAt =
      new Date();

    student.dashboardLoginAttempts =
      0;

    student.dashboardAccountLocked =
      false;

    student.dashboardLockedUntil =
      null;

    await student.save();

    return {
      success: true,
      message:
        "Dashboard password changed successfully.",
      code:
        "DASHBOARD_PASSWORD_CHANGED",
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] changeDashboardPassword",
      error,
    );
  }
}


export async function suspendStudent(
  input: {
    studentId: string;
    actor: StudentActor;
    reason: string;
  },
): Promise<ServiceResult> {
  try {
    assertStudentOperationsRole(
      input.actor,
    );

    const reason =
      assertReason(
        input.reason,
      );

    await ensureDatabase();

    const student =
      await findStudentById(
        assertNonEmpty(
          input.studentId,
          "Student ID",
        ),
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    student.studentOpsStatus =
      "suspended";

    student.studentOpsSuspendedAt =
      new Date();

    student.studentOpsSuspensionReason =
      reason;

    student.dashboardLoginEnabled =
      false;

    student.dashboardStatus =
      "suspended";

    await student.save();

    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error("[StudentService] Suspension mirror sync failed:", syncError);
    }

    return {
      success: true,
      message:
        "Student account suspended successfully.",
      code:
        "STUDENT_SUSPENDED",
      data: {
        studentId:
          student.studentId,

        studentOpsStatus:
          student.studentOpsStatus,

        dashboardStatus:
          student.dashboardStatus,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] suspendStudent",
      error,
    );
  }
}


export async function reactivateStudent(
  input: {
    studentId: string;
    actor: StudentActor;
  },
): Promise<ServiceResult> {
  try {
    assertStudentOperationsRole(
      input.actor,
    );

    await ensureDatabase();

    const student =
      await findStudentById(
        assertNonEmpty(
          input.studentId,
          "Student ID",
        ),
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    if (
      !isStatus(
        student.studentOpsApprovalStatus,
        "approved",
      )
    ) {
      return {
        success: false,
        message:
          "Student Operations approval is required.",
        code:
          "STUDENT_OPS_NOT_APPROVED",
      };
    }

    if (
      !student.dashboardCredentialsGenerated
    ) {
      return {
        success: false,
        message:
          "Dashboard credentials must be generated before reactivation.",
        code:
          "DASHBOARD_CREDENTIALS_NOT_GENERATED",
      };
    }

    student.studentOpsStatus =
      "active";

    student.dashboardStatus =
      "active";

    student.dashboardLoginEnabled =
      true;

    student.dashboardLoginEnabledAt =
      new Date();

    student.dashboardDeactivatedAt =
      null;

    student.dashboardDeactivationReason =
      "";

    await student.save();

    try {
      await syncStudentOperationsRecord(student.toObject());
    } catch (syncError) {
      console.error("[StudentService] Reactivation mirror sync failed:", syncError);
    }

    return {
      success: true,
      message:
        "Student account reactivated successfully.",
      code:
        "STUDENT_REACTIVATED",
      data: {
        studentId:
          student.studentId,

        studentOpsStatus:
          student.studentOpsStatus,

        dashboardStatus:
          student.dashboardStatus,

        dashboardLoginEnabled:
          student.dashboardLoginEnabled,
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] reactivateStudent",
      error,
    );
  }
}


export async function unlockMainLogin(
  input: {
    studentId: string;
    actor: StudentActor;
  },
): Promise<ServiceResult> {
  try {
    assertMainAdminRole(
      input.actor,
    );

    await ensureDatabase();

    const student =
      await findStudentById(
        assertNonEmpty(
          input.studentId,
          "Student ID",
        ),
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    student.loginAttempts =
      0;

    student.accountLocked =
      false;

    student.lockedUntil =
      null;

    await student.save();

    return {
      success: true,
      message:
        "Student main login lock has been cleared.",
      code:
        "LOGIN_UNLOCKED",
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] unlockMainLogin",
      error,
    );
  }
}


export async function unlockDashboardLogin(
  input: {
    studentId: string;
    actor: StudentActor;
  },
): Promise<ServiceResult> {
  try {
    assertStudentOperationsRole(
      input.actor,
    );

    await ensureDatabase();

    const student =
      await findStudentById(
        assertNonEmpty(
          input.studentId,
          "Student ID",
        ),
      );

    if (!student) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    student.dashboardLoginAttempts =
      0;

    student.dashboardAccountLocked =
      false;

    student.dashboardLockedUntil =
      null;

    await student.save();

    return {
      success: true,
      message:
        "Student dashboard login lock has been cleared.",
      code:
        "DASHBOARD_LOGIN_UNLOCKED",
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] unlockDashboardLogin",
      error,
    );
  }
}


function isDuplicateKeyError(
  error: unknown,
): boolean {
  return (
    typeof error ===
      "object" &&
    error !== null &&
    "code" in error &&
    (
      error as {
        code?: unknown;
      }
    ).code === 11000
  );
}


function handleServiceError<T = never>(
  context: string,
  error: unknown,
): ServiceResult<T> {
  if (
    error instanceof
    StudentServiceError
  ) {
    return {
      success: false,
      message:
        error.message,
      code:
        error.code,
    };
  }

  if (
    isDuplicateKeyError(
      error,
    )
  ) {
    console.error(
      context,
      error,
    );

    return {
      success: false,
      message:
        "A duplicate student record already exists.",
      code:
        "DUPLICATE_RECORD",
    };
  }

  console.error(
    context,
    error,
  );

  return {
    success: false,
    message:
      "Unable to process the student operation right now. Please try again later.",
    code:
      "INTERNAL_SERVER_ERROR",
  };
}




export interface StudentOperationsDashboardQuery {
  applicationStatus?: string;
  assessmentStatus?: string;
  internshipStatus?: string;
  paymentStatus?: string;
  studentOpsApprovalStatus?: string;
  studentOpsStatus?: string;
  dashboardStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface StudentOperationsDashboardStudent {
  id: string;
  mainStudentId: string;
  studentId: string;
  dashboardStudentId: string;
  applicationId: string;
  fullName: string;
  email: string;
  phone: string;
  applicationStatus: string;
  assessmentStatus: string;
  internshipStatus: string;
  internshipPlan: string;
  internshipTrack: string;
  paymentStatus: string;
  paymentAmount: number;
  paymentCurrency: string;
  studentOpsApprovalStatus: string;
  studentOpsStatus: string;
  dashboardStatus: string;
  dashboardLoginEnabled: boolean;
  dashboardCredentialsGenerated: boolean;
  learningStatus: string;
  taskCompletionPercentage: number;
  learningProgressPercentage: number;
  attendancePercentage: number;
  weeklyAssessmentStatus: string;
  saturdayAssessmentStatus: string;
  projectStatus: string;
  certificateStatus: string;
  certificateId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

function sanitizeOperationsDashboardStudent(
  value: Record<string, any>,
): StudentOperationsDashboardStudent {
  return {
    id: objectIdString(value._id),
    mainStudentId: cleanString(value.mainStudentId),
    studentId: normalizeId(value.studentId),
    dashboardStudentId: normalizeId(value.dashboardStudentId),
    applicationId: normalizeId(value.applicationId),
    fullName: cleanString(value.fullName),
    email: normalizeEmail(value.email),
    phone: cleanString(value.phone),
    applicationStatus: cleanString(value.applicationStatus) || "unknown",
    assessmentStatus: cleanString(value.assessmentStatus) || "not-started",
    internshipStatus: cleanString(value.internshipStatus) || "not-started",
    internshipPlan: cleanString(value.internshipPlan),
    internshipTrack: cleanString(value.internshipTrack),
    paymentStatus: cleanString(value.paymentStatus) || "unpaid",
    paymentAmount: numberValue(value.paymentAmount),
    paymentCurrency: cleanString(value.paymentCurrency).toUpperCase() || "INR",
    studentOpsApprovalStatus:
      cleanString(value.studentOpsApprovalStatus) ||
      cleanString(value.operationsApprovalStatus) ||
      "pending",
    studentOpsStatus:
      cleanString(value.studentOpsStatus) ||
      cleanString(value.operationsStatus) ||
      "not-ready",
    dashboardStatus: cleanString(value.dashboardStatus) || "locked",
    dashboardLoginEnabled: booleanValue(value.dashboardLoginEnabled),
    dashboardCredentialsGenerated:
      booleanValue(value.dashboardCredentialsGenerated),
    learningStatus: cleanString(value.learningStatus) || "not-started",
    taskCompletionPercentage: Math.min(
      100,
      Math.max(0, numberValue(value.taskCompletionPercentage)),
    ),
    learningProgressPercentage: Math.min(
      100,
      Math.max(0, numberValue(value.learningProgressPercentage)),
    ),
    attendancePercentage: Math.min(
      100,
      Math.max(0, numberValue(value.attendancePercentage)),
    ),
    weeklyAssessmentStatus:
      cleanString(value.weeklyAssessmentStatus) || "locked",
    saturdayAssessmentStatus:
      cleanString(value.saturdayAssessmentStatus) || "locked",
    projectStatus: cleanString(value.projectStatus) || "not-started",
    certificateStatus:
      cleanString(value.certificateStatus) || "not-eligible",
    certificateId: cleanString(value.certificateId),
    createdAt: dateOrNull(value.createdAt) || undefined,
    updatedAt: dateOrNull(value.updatedAt) || undefined,
  };
}

function buildOperationsDashboardFilter(
  input: StudentOperationsDashboardQuery,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const statusFields = [
    "applicationStatus",
    "assessmentStatus",
    "internshipStatus",
    "paymentStatus",
    "studentOpsApprovalStatus",
    "studentOpsStatus",
    "dashboardStatus",
  ] as const;

  for (const field of statusFields) {
    const value = cleanString(input[field]).slice(0, 80);
    if (value) {
      if (field === "studentOpsApprovalStatus") {
        filter.$and = [
          ...((filter.$and as Record<string, unknown>[] | undefined) || []),
          {
            $or: [
              { studentOpsApprovalStatus: value },
              { operationsApprovalStatus: value },
            ],
          },
        ];
      } else if (field === "studentOpsStatus") {
        filter.$and = [
          ...((filter.$and as Record<string, unknown>[] | undefined) || []),
          {
            $or: [
              { studentOpsStatus: value },
              { operationsStatus: value },
            ],
          },
        ];
      } else {
        filter[field] = value;
      }
    }
  }

  const search = cleanString(input.search).slice(0, 120);
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$and = [
      ...((filter.$and as Record<string, unknown>[] | undefined) || []),
      {
        $or: [
          { fullName: regex },
          { email: regex },
          { phone: regex },
          { studentId: regex },
          { dashboardStudentId: regex },
          { applicationId: regex },
        ],
      },
    ];
  }

  return filter;
}

export async function getStudentOperationsDashboardRecord(
  identifier: string,
): Promise<ServiceResult<StudentOperationsDashboardStudent>> {
  try {
    const id = assertNonEmpty(identifier, "Student identifier").slice(0, 150);
    const OperationsModel = await getStudentOperationsModel();
    const normalized = normalizeId(id);
    const query = mongoose.isValidObjectId(id)
      ? {
          $or: [
            { _id: id },
            { mainStudentId: id },
            { studentId: normalized },
            { dashboardStudentId: normalized },
            { applicationId: normalized },
          ],
        }
      : {
          $or: [
            { mainStudentId: id },
            { studentId: normalized },
            { dashboardStudentId: normalized },
            { applicationId: normalized },
          ],
        };

    const record = await OperationsModel.findOne(query)
      .select(
        "-dashboardPasswordHash -passwordHash -loginPasswordHash -__v",
      )
      .lean()
      .exec();

    if (!record) {
      return {
        success: false,
        message: "Student Operations record was not found.",
        code: "STUDENT_NOT_FOUND",
      };
    }

    return {
      success: true,
      message: "Student Operations record loaded successfully.",
      data: sanitizeOperationsDashboardStudent(record),
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] getStudentOperationsDashboardRecord",
      error,
    );
  }
}

export async function listStudentOperationsDashboardRecords(
  input: StudentOperationsDashboardQuery = {},
): Promise<
  ServiceResult<{
    students: StudentOperationsDashboardStudent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>
> {
  try {
    const OperationsModel = await getStudentOperationsModel();
    const page = Math.min(
      10000,
      Math.max(1, Math.floor(numberValue(input.page, 1))),
    );
    const limit = Math.min(
      100,
      Math.max(1, Math.floor(numberValue(input.limit, 25))),
    );
    const filter = buildOperationsDashboardFilter(input);
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      OperationsModel.find(filter)
        .select(
          "-dashboardPasswordHash -passwordHash -loginPasswordHash -__v",
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      OperationsModel.countDocuments(filter).exec(),
    ]);

    return {
      success: true,
      message: "Student Operations records loaded successfully.",
      data: {
        students: records.map((record: Record<string, any>) =>
          sanitizeOperationsDashboardStudent(record),
        ),
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  } catch (error) {
    return handleServiceError(
      "[StudentService] listStudentOperationsDashboardRecords",
      error,
    );
  }
}


const studentService = {
  getStudent,
  getStudentByApplicationId,
  listStudents,
  getStudentOperationsDashboardRecord,
  listStudentOperationsDashboardRecords,

  approveApplication,
  rejectApplication,
  resendCredentials,

  startAssessment,
  submitAssessmentResult,

  selectInternship,

  markPaymentPending,
  recordVerifiedPayment,

  approveStudentOperations,

  generateDashboardCredentials,
  updateDashboardStatus,
  canAccessDashboard,

  updateLearningProgress,
  recordWeeklyAssessment,

  updateProjectStatus,
  completeInternship,

  verifyCertificate,

  changeMainPassword,
  changeDashboardPassword,

  suspendStudent,
  reactivateStudent,

  unlockMainLogin,
  unlockDashboardLogin,
};

export default studentService;

