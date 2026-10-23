import StudentModel from "@/models/Student";
import connectDB from "@/lib/db";

import {
  INTERNSHIP_PLANS,
  selectInternship as selectStudentInternship,
  type InternshipPlan,
  type SelectInternshipInput,
  type ServiceResult,
} from "@/services/student.service";

/* ============================================================================
   CYBERNET CAREERS
   INTERNSHIP SERVICE
   ============================================================================

   SERVER-SIDE DOMAIN SERVICE

   RESPONSIBILITIES
   --------------------------------------------------------------------------
   - Internship plan catalog
   - Server-authoritative pricing
   - Internship eligibility
   - Internship selection
   - Internship status
   - Payment readiness
   - Student Operations readiness
   - Dashboard activation visibility
   - Safe student-facing serialization

   AUTHORITATIVE FLOW
   --------------------------------------------------------------------------

   Application Approved
          ↓
   Assessment Passed
          ↓
   Internship Eligible
          ↓
   Student Selects Track + Plan
          ↓
   Server Validates Official Price
          ↓
   Internship = payment-pending
          ↓
   Payment Service Creates Razorpay Order
          ↓
   Razorpay Payment
          ↓
   Server-Side Payment Verification
          ↓
   Payment = paid
          ↓
   Student Operations Review
          ↓
   Student Operations Approval
          ↓
   Dashboard Credentials Generated
          ↓
   Dashboard Active
          ↓
   Internship Active

   SECURITY RULES
   --------------------------------------------------------------------------
   - Never trust frontend amount.
   - Never trust frontend currency.
   - Never mark payment as paid here.
   - Never activate dashboard here.
   - Never generate dashboard credentials here.
   - Never bypass assessment.
   - Never bypass Student Operations approval.
   - Actual lifecycle mutation remains in student.service.ts.
   - Payment verification remains in payment.service.ts.
   - Authentication remains in auth.service.ts.
============================================================================ */

/* ============================================================================
   TYPES
============================================================================ */

export type {
  InternshipPlan,
};

export interface InternshipPlanDetails {
  code: InternshipPlan;
  name: string;
  durationMonths: number;
  durationDays: number;
  amount: number;
  currency: string;
  amountInPaise: number;
}

export interface InternshipEligibility {
  eligible: boolean;

  applicationApproved: boolean;
  assessmentPassed: boolean;
  internshipApplicationAllowed: boolean;

  internshipStatus: string;

  selectedPlan: string;
  selectedTrack: string;

  paymentStatus: string;

  paymentAmount: number;
  paymentCurrency: string;

  studentOpsApprovalStatus: string;
  studentOpsStatus: string;

  dashboardStatus: string;
  dashboardLoginEnabled: boolean;

  reasonCode: string;
  reason: string;
}

export interface InternshipStatus {
  studentId: string;
  applicationId: string;

  fullName: string;
  email: string;

  internshipTrack: string;
  internshipPlan: string;
  internshipPlanName: string;

  durationMonths: number;
  durationDays: number;

  internshipStatus: string;
  startPreference: string;

  internshipSelectionAt: Date | null;

  paymentStatus: string;
  paymentAmount: number;
  paymentCurrency: string;
  paymentCompletedAt: Date | null;

  studentOpsApprovalStatus: string;
  studentOpsStatus: string;

  dashboardStatus: string;
  dashboardLoginEnabled: boolean;

  internshipStartDate: Date | null;
  internshipEndDate: Date | null;
}

export interface SelectInternshipServiceInput {
  studentId: string;
  plan: InternshipPlan;
  track: string;
  startPreference?: string;
}

/* ============================================================================
   CONSTANTS
============================================================================ */

const MAX_STUDENT_ID_LENGTH = 100;
const MAX_TRACK_LENGTH = 150;
const MAX_START_PREFERENCE_LENGTH = 100;
const MAX_APPLICATION_ID_LENGTH = 150;
const MAX_NAME_LENGTH = 150;
const MAX_EMAIL_LENGTH = 254;
const DEFAULT_CURRENCY = "INR";

const VALID_PAYMENT_STATUSES = new Set([
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
]);

const PAYMENT_PENDING_INTERNSHIP_STATUSES =
  new Set([
    "payment-pending",
  ]);

const TERMINAL_INTERNSHIP_STATUSES =
  new Set([
    "completed",
    "expired",
    "rejected",
  ]);

const DASHBOARD_ACTIVE_STATUSES =
  new Set([
    "active",
    "completed",
  ]);

/* ============================================================================
   HELPERS
============================================================================ */

function cleanString(
  value: unknown,
  maxLength = 500,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeId(
  value: unknown,
): string {
  return cleanString(
    value,
    MAX_STUDENT_ID_LENGTH,
  ).toUpperCase();
}

function normalizeTrack(
  value: unknown,
): string {
  return cleanString(
    value,
    MAX_TRACK_LENGTH,
  );
}

function normalizeStartPreference(
  value: unknown,
): string {
  return cleanString(
    value,
    MAX_START_PREFERENCE_LENGTH,
  );
}

function normalizeCurrency(
  value: unknown,
): string {
  return (
    cleanString(
      value,
      10,
    ).toUpperCase() ||
    DEFAULT_CURRENCY
  );
}

function normalizeStatus(
  value: unknown,
): string {
  return cleanString(
    value,
    80,
  ).toLowerCase();
}

function numberValue(
  value: unknown,
  fallback = 0,
): number {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : fallback;
}

function booleanValue(
  value: unknown,
): boolean {
  return value === true;
}

function safeDate(
  value: unknown,
): Date | null {
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime(),
    )
  ) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const date = new Date(value);

    if (
      !Number.isNaN(
        date.getTime(),
      )
    ) {
      return date;
    }
  }

  return null;
}

function asRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return {};
  }

  return value as Record<
    string,
    unknown
  >;
}

function normalizePlanCode(
  value: unknown,
): string {
  return cleanString(
    value,
    50,
  ).toLowerCase();
}

function normalizeEmail(
  value: unknown,
): string {
  return cleanString(
    value,
    MAX_EMAIL_LENGTH,
  ).toLowerCase();
}

function isValidAmount(
  amount: number,
): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= 0
  );
}

/* ============================================================================
   DATABASE
============================================================================ */

async function ensureDatabase(): Promise<void> {
  await connectDB();
}

/* ============================================================================
   PLAN CATALOG
============================================================================ */

/**
 * Server-authoritative internship plans.
 *
 * IMPORTANT:
 * These values come from student.service.ts.
 *
 * Expected official catalog:
 * 1 Month  = ₹499
 * 3 Months = ₹999
 * 6 Months = ₹1699
 */
export function getInternshipPlans(): InternshipPlanDetails[] {
  return (
    Object.entries(
      INTERNSHIP_PLANS,
    ) as [
      InternshipPlan,
      (typeof INTERNSHIP_PLANS)[InternshipPlan],
    ][]
  ).map(
    ([code, plan]) => {
      const amount =
        numberValue(
          plan.amount,
          0,
        );

      const currency =
        normalizeCurrency(
          plan.currency,
        );

      return {
        code,

        name:
          cleanString(
            plan.name,
            100,
          ),

        durationMonths:
          Math.max(
            0,
            Math.floor(
              numberValue(
                plan.durationMonths,
                0,
              ),
            ),
          ),

        durationDays:
          Math.max(
            0,
            Math.floor(
              numberValue(
                plan.durationDays,
                0,
              ),
            ),
          ),

        amount,

        currency,

        amountInPaise:
          Math.round(
            amount * 100,
          ),
      };
    },
  );
}

/* ============================================================================
   SINGLE PLAN
============================================================================ */

export function getInternshipPlan(
  planCode: string,
): InternshipPlanDetails | null {
  const code =
    normalizePlanCode(
      planCode,
    ) as InternshipPlan;

  if (
    !Object.prototype.hasOwnProperty.call(
      INTERNSHIP_PLANS,
      code,
    )
  ) {
    return null;
  }

  const plan =
    INTERNSHIP_PLANS[code];

  if (!plan) {
    return null;
  }

  const amount =
    numberValue(
      plan.amount,
      0,
    );

  return {
    code,

    name:
      cleanString(
        plan.name,
        100,
      ),

    durationMonths:
      Math.max(
        0,
        Math.floor(
          numberValue(
            plan.durationMonths,
            0,
          ),
        ),
      ),

    durationDays:
      Math.max(
        0,
        Math.floor(
          numberValue(
            plan.durationDays,
            0,
          ),
        ),
      ),

    amount,

    currency:
      normalizeCurrency(
        plan.currency,
      ),

    amountInPaise:
      Math.round(
        amount * 100,
      ),
  };
}

/* ============================================================================
   PLAN VALIDATION
============================================================================ */

export function isValidInternshipPlan(
  planCode: unknown,
): planCode is InternshipPlan {
  const plan =
    normalizePlanCode(
      planCode,
    );

  return (
    plan.length > 0 &&
    Object.prototype.hasOwnProperty.call(
      INTERNSHIP_PLANS,
      plan,
    )
  );
}

/* ============================================================================
   AUTHORITATIVE PRICE VALIDATION
============================================================================ */

export function validateInternshipPlanPricing(
  planCode: unknown,
  expectedAmount?: unknown,
  expectedCurrency?: unknown,
): {
  valid: boolean;
  plan: InternshipPlanDetails | null;
  reasonCode: string;
  reason: string;
} {
  if (
    !isValidInternshipPlan(
      planCode,
    )
  ) {
    return {
      valid: false,
      plan: null,
      reasonCode:
        "INVALID_INTERNSHIP_PLAN",
      reason:
        "The selected internship plan is not valid.",
    };
  }

  const plan =
    getInternshipPlan(
      String(planCode),
    );

  if (!plan) {
    return {
      valid: false,
      plan: null,
      reasonCode:
        "PLAN_NOT_FOUND",
      reason:
        "The selected internship plan was not found.",
    };
  }

  if (
    expectedAmount !== undefined
  ) {
    const suppliedAmount =
      numberValue(
        expectedAmount,
        -1,
      );

    if (
      !isValidAmount(
        suppliedAmount,
      ) ||
      suppliedAmount !==
        plan.amount
    ) {
      return {
        valid: false,
        plan,
        reasonCode:
          "PRICE_MISMATCH",
        reason:
          "The supplied internship price does not match the official server price.",
      };
    }
  }

  if (
    expectedCurrency !== undefined
  ) {
    const suppliedCurrency =
      normalizeCurrency(
        expectedCurrency,
      );

    if (
      suppliedCurrency !==
      plan.currency
    ) {
      return {
        valid: false,
        plan,
        reasonCode:
          "CURRENCY_MISMATCH",
        reason:
          "The supplied currency does not match the official server currency.",
      };
    }
  }

  return {
    valid: true,
    plan,
    reasonCode:
      "PRICING_VALID",
    reason:
      "Internship plan pricing is valid.",
  };
}

/* ============================================================================
   STUDENT LOOKUP
============================================================================ */

async function findStudent(
  studentId: string,
): Promise<Record<string, unknown> | null> {
  const id =
    normalizeId(
      studentId,
    );

  if (!id) {
    return null;
  }

  const student =
    await StudentModel
      .findOne({
        $or: [
          {
            studentId: id,
          },
          {
            dashboardStudentId: id,
          },
        ],
      })
      .lean()
      .exec();

  if (!student) {
    return null;
  }

  return asRecord(
    student,
  );
}

/* ============================================================================
   APPLICATION APPROVAL
============================================================================ */

function isApplicationApproved(
  record: Record<string, unknown>,
): boolean {
  const applicationStatus =
    normalizeStatus(
      record.applicationStatus,
    );

  const adminApprovalStatus =
    normalizeStatus(
      record.adminApprovalStatus,
    );

  return (
    applicationStatus ===
      "approved" ||
    adminApprovalStatus ===
      "approved"
  );
}

/* ============================================================================
   ASSESSMENT PASS
============================================================================ */

function isAssessmentPassed(
  record: Record<string, unknown>,
): boolean {
  const assessmentStatus =
    normalizeStatus(
      record.assessmentStatus,
    );

  const resultStatus =
    normalizeStatus(
      record.resultStatus,
    );

  return (
    assessmentStatus ===
      "passed" &&
    resultStatus ===
      "passed"
  );
}

/* ============================================================================
   INTERNSHIP ELIGIBILITY
============================================================================ */

export async function getInternshipEligibility(
  studentId: string,
): Promise<
  ServiceResult<InternshipEligibility>
> {
  try {
    await ensureDatabase();

    const id =
      normalizeId(
        studentId,
      );

    if (!id) {
      return {
        success: false,
        message:
          "Student ID is required.",
        code:
          "INVALID_STUDENT_ID",
      };
    }

    const record =
      await findStudent(id);

    if (!record) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    const applicationApproved =
      isApplicationApproved(
        record,
      );

    const assessmentPassed =
      isAssessmentPassed(
        record,
      );

    const internshipAllowed =
      booleanValue(
        record.internshipApplicationAllowed,
      );

    const internshipStatus =
      normalizeStatus(
        record.internshipStatus,
      ) || "locked";

    const paymentStatus =
      normalizeStatus(
        record.paymentStatus,
      ) || "unpaid";

    const selectedPlan =
      normalizePlanCode(
        record.internshipPlan,
      );

    const selectedTrack =
      normalizeTrack(
        record.internshipTrack,
      );

    const paymentAmount =
      numberValue(
        record.paymentAmount,
        0,
      );

    const paymentCurrency =
      normalizeCurrency(
        record.paymentCurrency,
      );

    const studentOpsApprovalStatus =
      normalizeStatus(
        record.studentOpsApprovalStatus,
      ) || "pending";

    const studentOpsStatus =
      normalizeStatus(
        record.studentOpsStatus,
      ) || "not-ready";

    const dashboardStatus =
      normalizeStatus(
        record.dashboardStatus,
      ) || "locked";

    const dashboardLoginEnabled =
      booleanValue(
        record.dashboardLoginEnabled,
      );

    let eligible = true;

    let reasonCode =
      "ELIGIBLE";

    let reason =
      "Student is eligible to select an internship.";

    /*
     * Highest priority lifecycle gates.
     */

    if (!applicationApproved) {
      eligible = false;

      reasonCode =
        "APPLICATION_NOT_APPROVED";

      reason =
        "Application approval is required before internship selection.";
    } else if (!assessmentPassed) {
      eligible = false;

      reasonCode =
        "ASSESSMENT_NOT_PASSED";

      reason =
        "Student must pass the assessment before internship selection.";
    } else if (!internshipAllowed) {
      eligible = false;

      reasonCode =
        "INTERNSHIP_NOT_AVAILABLE";

      reason =
        "Internship selection is not currently available.";
    } else if (
      PAYMENT_PENDING_INTERNSHIP_STATUSES.has(
        internshipStatus,
      ) ||
      paymentStatus === "pending"
    ) {
      eligible = false;

      reasonCode =
        "INTERNSHIP_ALREADY_SELECTED";

      reason =
        "An internship plan has already been selected and payment is pending.";
    } else if (
      paymentStatus === "paid"
    ) {
      eligible = false;

      reasonCode =
        "PAYMENT_ALREADY_COMPLETED";

      reason =
        "Payment has already been completed for this internship.";
    } else if (
      TERMINAL_INTERNSHIP_STATUSES.has(
        internshipStatus,
      )
    ) {
      eligible = false;

      reasonCode =
        "INTERNSHIP_TERMINAL_STATE";

      reason =
        "The current internship lifecycle is already in a terminal state.";
    }

    return {
      success: true,

      message:
        eligible
          ? "Internship selection is available."
          : reason,

      code:
        reasonCode,

      data: {
        eligible,

        applicationApproved,

        assessmentPassed,

        internshipApplicationAllowed:
          internshipAllowed,

        internshipStatus,

        selectedPlan,

        selectedTrack,

        paymentStatus,

        paymentAmount,

        paymentCurrency,

        studentOpsApprovalStatus,

        studentOpsStatus,

        dashboardStatus,

        dashboardLoginEnabled,

        reasonCode,

        reason,
      },
    };
  } catch (error) {
    return handleInternshipError(
      "[InternshipService] getInternshipEligibility",
      error,
    );
  }
}

/* ============================================================================
   SELECT INTERNSHIP
============================================================================ */

export async function selectInternship(
  input: SelectInternshipServiceInput,
): Promise<ServiceResult> {
  try {
    await ensureDatabase();

    const studentId =
      normalizeId(
        input?.studentId,
      );

    const plan =
      normalizePlanCode(
        input?.plan,
      ) as InternshipPlan;

    const track =
      normalizeTrack(
        input?.track,
      );

    const startPreference =
      normalizeStartPreference(
        input?.startPreference,
      );

    if (!studentId) {
      return {
        success: false,
        message:
          "Student ID is required.",
        code:
          "INVALID_STUDENT_ID",
      };
    }

    if (
      !isValidInternshipPlan(
        plan,
      )
    ) {
      return {
        success: false,
        message:
          "Invalid internship plan.",
        code:
          "INVALID_INTERNSHIP_PLAN",
      };
    }

    if (!track) {
      return {
        success: false,
        message:
          "Internship track is required.",
        code:
          "INTERNSHIP_TRACK_REQUIRED",
      };
    }

    /*
     * Server-authoritative plan lookup.
     */

    const selectedPlan =
      getInternshipPlan(
        plan,
      );

    if (!selectedPlan) {
      return {
        success: false,
        message:
          "Selected internship plan was not found.",
        code:
          "INVALID_INTERNSHIP_PLAN",
      };
    }

    /*
     * Defensive pricing validation.
     *
     * There is intentionally no amount
     * accepted from this method's input.
     */

    const pricing =
      validateInternshipPlanPricing(
        plan,
      );

    if (
      !pricing.valid ||
      !pricing.plan
    ) {
      return {
        success: false,
        message:
          pricing.reason,
        code:
          pricing.reasonCode,
      };
    }

    /*
     * Preflight eligibility.
     */

    const eligibility =
      await getInternshipEligibility(
        studentId,
      );

    if (!eligibility.success) {
      return eligibility;
    }

    if (
      eligibility.data &&
      !eligibility.data.eligible
    ) {
      return {
        success: false,
        message:
          eligibility.data.reason,
        code:
          eligibility.data.reasonCode,
      };
    }

    /*
     * Final student-service mutation.
     *
     * IMPORTANT:
     * Never mutate Student directly here.
     */

    const result =
      await selectStudentInternship({
        studentId,

        plan,

        track,

        startPreference,
      } as SelectInternshipInput);

    if (!result.success) {
      return result;
    }

    return {
      success: true,

      message:
        "Internship selected successfully. Payment is now pending.",

      code:
        "INTERNSHIP_SELECTED",

      data: {
        ...(result.data &&
        typeof result.data ===
          "object"
          ? result.data
          : {}),

        studentId,

        planCode:
          selectedPlan.code,

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

        amountInPaise:
          selectedPlan.amountInPaise,

        internshipTrack:
          track,

        startPreference,

        internshipStatus:
          "payment-pending",

        paymentStatus:
          "pending",

        dashboardActivation:
          "NOT_ACTIVE",

        dashboardLogin:
          "LOCKED",

        pricingAuthoritative:
          true,
      },
    };
  } catch (error) {
    return handleInternshipError(
      "[InternshipService] selectInternship",
      error,
    );
  }
}

/* ============================================================================
   GET INTERNSHIP STATUS
============================================================================ */

export async function getInternshipStatus(
  studentId: string,
): Promise<
  ServiceResult<InternshipStatus>
> {
  try {
    await ensureDatabase();

    const id =
      normalizeId(
        studentId,
      );

    if (!id) {
      return {
        success: false,
        message:
          "Student ID is required.",
        code:
          "INVALID_STUDENT_ID",
      };
    }

    const record =
      await findStudent(id);

    if (!record) {
      return {
        success: false,
        message:
          "Student account was not found.",
        code:
          "STUDENT_NOT_FOUND",
      };
    }

    const planCode =
      normalizePlanCode(
        record.internshipPlan,
      ) as InternshipPlan;

    const plan =
      getInternshipPlan(
        planCode,
      );

    const durationDays =
      plan?.durationDays ??
      Math.max(
        0,
        Math.floor(
          numberValue(
            record.internshipDurationDays,
            0,
          ),
        ),
      );

    const durationMonths =
      plan?.durationMonths ??
      (
        durationDays > 0
          ? Math.max(
              1,
              Math.round(
                durationDays / 30,
              ),
            )
          : 0
      );

    const status: InternshipStatus =
      {
        studentId:
          cleanString(
            record.studentId,
            MAX_STUDENT_ID_LENGTH,
          ),

        applicationId:
          cleanString(
            record.applicationId,
            MAX_APPLICATION_ID_LENGTH,
          ),

        fullName:
          cleanString(
            record.fullName,
            MAX_NAME_LENGTH,
          ),

        email:
          normalizeEmail(
            record.email,
          ),

        internshipTrack:
          normalizeTrack(
            record.internshipTrack,
          ),

        internshipPlan:
          planCode,

        internshipPlanName:
          plan?.name || "",

        durationMonths,

        durationDays,

        internshipStatus:
          normalizeStatus(
            record.internshipStatus,
          ) || "locked",

        startPreference:
          normalizeStartPreference(
            record.startPreference,
          ),

        internshipSelectionAt:
          safeDate(
            record.internshipSelectionAt,
          ),

        paymentStatus:
          normalizeStatus(
            record.paymentStatus,
          ) || "unpaid",

        paymentAmount:
          numberValue(
            record.paymentAmount,
            0,
          ),

        paymentCurrency:
          normalizeCurrency(
            record.paymentCurrency,
          ),

        paymentCompletedAt:
          safeDate(
            record.paymentCompletedAt,
          ),

        studentOpsApprovalStatus:
          normalizeStatus(
            record.studentOpsApprovalStatus,
          ) || "pending",

        studentOpsStatus:
          normalizeStatus(
            record.studentOpsStatus,
          ) || "not-ready",

        dashboardStatus:
          normalizeStatus(
            record.dashboardStatus,
          ) || "locked",

        dashboardLoginEnabled:
          booleanValue(
            record.dashboardLoginEnabled,
          ),

        internshipStartDate:
          safeDate(
            record.internshipStartDate,
          ),

        internshipEndDate:
          safeDate(
            record.internshipEndDate,
          ),
      };

    return {
      success: true,

      message:
        "Internship status loaded successfully.",

      code:
        "INTERNSHIP_STATUS_LOADED",

      data: status,
    };
  } catch (error) {
    return handleInternshipError<InternshipStatus>(
      "[InternshipService] getInternshipStatus",
      error,
    );
  }
}

/* ============================================================================
   INTERNSHIP SUMMARY
============================================================================ */

export async function getInternshipSummary(
  studentId: string,
): Promise<
  ServiceResult<{
    status: InternshipStatus;
    eligibility: InternshipEligibility;
    plans: InternshipPlanDetails[];
  }>
> {
  try {
    const [
      statusResult,
      eligibilityResult,
    ] = await Promise.all([
      getInternshipStatus(
        studentId,
      ),

      getInternshipEligibility(
        studentId,
      ),
    ]);

    if (
      !statusResult.success
    ) {
      return {
        success: false,
        message:
          statusResult.message,
        code:
          statusResult.code,
      };
    }

    if (
      !eligibilityResult.success
    ) {
      return {
        success: false,
        message:
          eligibilityResult.message,
        code:
          eligibilityResult.code,
      };
    }

    if (
      !statusResult.data ||
      !eligibilityResult.data
    ) {
      return {
        success: false,
        message:
          "Internship summary could not be generated.",
        code:
          "INTERNSHIP_SUMMARY_UNAVAILABLE",
      };
    }

    return {
      success: true,

      message:
        "Internship summary loaded successfully.",

      code:
        "INTERNSHIP_SUMMARY_LOADED",

      data: {
        status:
          statusResult.data,

        eligibility:
          eligibilityResult.data,

        plans:
          getInternshipPlans(),
      },
    };
  } catch (error) {
    return handleInternshipError(
      "[InternshipService] getInternshipSummary",
      error,
    );
  }
}

/* ============================================================================
   PAYMENT READINESS
============================================================================ */

export async function getInternshipPaymentReadiness(
  studentId: string,
): Promise<
  ServiceResult<{
    ready: boolean;

    reasonCode: string;
    reason: string;

    studentId: string;

    planCode: string;
    planName: string;

    amount: number;
    amountInPaise: number;
    currency: string;

    paymentStatus: string;
    internshipStatus: string;

    pricingAuthoritative: true;
  }>
> {
  try {
    const statusResult =
      await getInternshipStatus(
        studentId,
      );

    if (
      !statusResult.success
    ) {
      return {
        success: false,
        message:
          statusResult.message,
        code:
          statusResult.code,
      };
    }

    const status =
      statusResult.data;

    if (!status) {
      return {
        success: false,
        message:
          "Internship status is unavailable.",
        code:
          "INTERNSHIP_STATUS_UNAVAILABLE",
      };
    }

    const plan =
      getInternshipPlan(
        status.internshipPlan,
      );

    if (!plan) {
      return {
        success: true,

        message:
          "Select an internship plan before payment.",

        code:
          "PAYMENT_NOT_READY",

        data: {
          ready: false,

          reasonCode:
            "PLAN_NOT_SELECTED",

          reason:
            "No valid internship plan has been selected.",

          studentId:
            status.studentId,

          planCode:
            "",

          planName:
            "",

          amount:
            0,

          amountInPaise:
            0,

          currency:
            DEFAULT_CURRENCY,

          paymentStatus:
            status.paymentStatus,

          internshipStatus:
            status.internshipStatus,

          pricingAuthoritative:
            true,
        },
      };
    }

    /*
     * Detect stale/tampered database
     * pricing before payment order creation.
     */

    if (
      status.paymentAmount > 0 &&
      status.paymentAmount !==
        plan.amount
    ) {
      return {
        success: false,

        message:
          "Stored internship payment amount does not match the official plan price.",

        code:
          "STORED_PRICE_MISMATCH",
      };
    }

    if (
      status.paymentCurrency &&
      status.paymentCurrency !==
        plan.currency
    ) {
      return {
        success: false,

        message:
          "Stored internship payment currency does not match the official plan currency.",

        code:
          "STORED_CURRENCY_MISMATCH",
      };
    }

    if (
      status.paymentStatus ===
      "paid"
    ) {
      return {
        success: true,

        message:
          "Payment has already been completed.",

        code:
          "PAYMENT_ALREADY_COMPLETED",

        data: {
          ready: false,

          reasonCode:
            "PAYMENT_ALREADY_COMPLETED",

          reason:
            "Payment has already been completed for this internship.",

          studentId:
            status.studentId,

          planCode:
            plan.code,

          planName:
            plan.name,

          amount:
            plan.amount,

          amountInPaise:
            plan.amountInPaise,

          currency:
            plan.currency,

          paymentStatus:
            status.paymentStatus,

          internshipStatus:
            status.internshipStatus,

          pricingAuthoritative:
            true,
        },
      };
    }

    if (
      status.internshipStatus !==
      "payment-pending"
    ) {
      return {
        success: true,

        message:
          "Internship is not currently ready for payment.",

        code:
          "PAYMENT_NOT_READY",

        data: {
          ready: false,

          reasonCode:
            "INTERNSHIP_NOT_PAYMENT_PENDING",

          reason:
            "Internship must be selected before payment can be initiated.",

          studentId:
            status.studentId,

          planCode:
            plan.code,

          planName:
            plan.name,

          amount:
            plan.amount,

          amountInPaise:
            plan.amountInPaise,

          currency:
            plan.currency,

          paymentStatus:
            status.paymentStatus,

          internshipStatus:
            status.internshipStatus,

          pricingAuthoritative:
            true,
        },
      };
    }

    /*
     * A valid payment state must be pending
     * before the payment service creates
     * a Razorpay order.
     */

    if (
      status.paymentStatus !==
      "pending"
    ) {
      return {
        success: true,

        message:
          "Internship payment state is not ready for payment creation.",

        code:
          "PAYMENT_STATE_INVALID",

        data: {
          ready: false,

          reasonCode:
            "INVALID_PAYMENT_STATE",

          reason:
            "Payment must be in pending state before a payment order can be created.",

          studentId:
            status.studentId,

          planCode:
            plan.code,

          planName:
            plan.name,

          amount:
            plan.amount,

          amountInPaise:
            plan.amountInPaise,

          currency:
            plan.currency,

          paymentStatus:
            status.paymentStatus,

          internshipStatus:
            status.internshipStatus,

          pricingAuthoritative:
            true,
        },
      };
    }

    return {
      success: true,

      message:
        "Internship is ready for server-side payment order creation.",

      code:
        "PAYMENT_READY",

      data: {
        ready: true,

        reasonCode:
          "PAYMENT_READY",

        reason:
          "Selected internship plan is ready for payment.",

        studentId:
          status.studentId,

        planCode:
          plan.code,

        planName:
          plan.name,

        amount:
          plan.amount,

        amountInPaise:
          plan.amountInPaise,

        currency:
          plan.currency,

        paymentStatus:
          status.paymentStatus,

        internshipStatus:
          status.internshipStatus,

        pricingAuthoritative:
          true,
      },
    };
  } catch (error) {
    return handleInternshipError(
      "[InternshipService] getInternshipPaymentReadiness",
      error,
    );
  }
}

/* ============================================================================
   STUDENT OPERATIONS STATUS
============================================================================ */

export async function getInternshipOperationsStatus(
  studentId: string,
): Promise<
  ServiceResult<{
    studentId: string;

    paymentCompleted: boolean;

    paymentStatus: string;

    internshipStatus: string;

    studentOpsApprovalStatus: string;

    studentOpsStatus: string;

    readyForOperationsReview: boolean;

    dashboardStatus: string;

    dashboardLoginEnabled: boolean;

    dashboardActivationAllowed: boolean;

    reasonCode: string;

    reason: string;
  }>
> {
  try {
    const statusResult =
      await getInternshipStatus(
        studentId,
      );

    if (
      !statusResult.success
    ) {
      return {
        success: false,
        message:
          statusResult.message,
        code:
          statusResult.code,
      };
    }

    const status =
      statusResult.data;

    if (!status) {
      return {
        success: false,
        message:
          "Internship status is unavailable.",
        code:
          "INTERNSHIP_STATUS_UNAVAILABLE",
      };
    }

    const paymentCompleted =
      status.paymentStatus ===
      "paid";

    const readyForOperationsReview =
      paymentCompleted &&
      (
        status.internshipStatus ===
          "approved" ||
        status.studentOpsStatus ===
          "pending-review"
      ) &&
      (
        status.studentOpsApprovalStatus ===
          "pending"
      );

    const dashboardActivationAllowed =
      paymentCompleted &&
      status.studentOpsApprovalStatus ===
        "approved" &&
      (
        status.studentOpsStatus ===
          "approved" ||
        status.studentOpsStatus ===
          "active" ||
        status.studentOpsStatus ===
          "completed"
      );

    let reasonCode =
      "OPERATIONS_STATUS";

    let reason =
      "Internship Operations status loaded.";

    if (!paymentCompleted) {
      reasonCode =
        "PAYMENT_NOT_COMPLETED";

      reason =
        "Payment must be verified before Student Operations review.";
    } else if (
      status.studentOpsApprovalStatus ===
      "pending"
    ) {
      reasonCode =
        "OPERATIONS_REVIEW_PENDING";

      reason =
        "Payment is completed and the internship is waiting for Student Operations approval.";
    } else if (
      dashboardActivationAllowed
    ) {
      reasonCode =
        "DASHBOARD_ACTIVATION_ALLOWED";

      reason =
        "Student Operations approval is complete and dashboard activation is allowed.";
    }

    return {
      success: true,

      message:
        reason,

      code:
        reasonCode,

      data: {
        studentId:
          status.studentId,

        paymentCompleted,

        paymentStatus:
          status.paymentStatus,

        internshipStatus:
          status.internshipStatus,

        studentOpsApprovalStatus:
          status.studentOpsApprovalStatus,

        studentOpsStatus:
          status.studentOpsStatus,

        readyForOperationsReview,

        dashboardStatus:
          status.dashboardStatus,

        dashboardLoginEnabled:
          status.dashboardLoginEnabled,

        dashboardActivationAllowed,

        reasonCode,

        reason,
      },
    };
  } catch (error) {
    return handleInternshipError(
      "[InternshipService] getInternshipOperationsStatus",
      error,
    );
  }
}

/* ============================================================================
   DASHBOARD ACTIVATION STATE
============================================================================ */

export async function getInternshipDashboardState(
  studentId: string,
): Promise<
  ServiceResult<{
    studentId: string;

    paymentCompleted: boolean;
    operationsApproved: boolean;

    dashboardStatus: string;
    dashboardLoginEnabled: boolean;

    internshipActive: boolean;

    allowed: boolean;

    reasonCode: string;
    reason: string;
  }>
> {
  try {
    const statusResult =
      await getInternshipStatus(
        studentId,
      );

    if (
      !statusResult.success
    ) {
      return {
        success: false,
        message:
          statusResult.message,
        code:
          statusResult.code,
      };
    }

    const status =
      statusResult.data;

    if (!status) {
      return {
        success: false,
        message:
          "Internship status is unavailable.",
        code:
          "INTERNSHIP_STATUS_UNAVAILABLE",
      };
    }

    const paymentCompleted =
      status.paymentStatus ===
      "paid";

    const operationsApproved =
      status.studentOpsApprovalStatus ===
      "approved";

    const internshipActive =
      status.internshipStatus ===
      "active";

    const dashboardActive =
      status.dashboardStatus ===
      "active";

    const dashboardLoginEnabled =
      status.dashboardLoginEnabled;

    const allowed =
      paymentCompleted &&
      operationsApproved &&
      dashboardActive &&
      dashboardLoginEnabled;

    let reasonCode =
      "DASHBOARD_LOCKED";

    let reason =
      "Student dashboard is not active.";

    if (!paymentCompleted) {
      reasonCode =
        "PAYMENT_NOT_COMPLETED";

      reason =
        "Payment must be verified before dashboard activation.";
    } else if (
      !operationsApproved
    ) {
      reasonCode =
        "STUDENT_OPERATIONS_APPROVAL_REQUIRED";

      reason =
        "Student Operations approval is required before dashboard activation.";
    } else if (
      !dashboardActive
    ) {
      reasonCode =
        "DASHBOARD_NOT_ACTIVE";

      reason =
        "Dashboard has not been activated yet.";
    } else if (
      !dashboardLoginEnabled
    ) {
      reasonCode =
        "DASHBOARD_LOGIN_DISABLED";

      reason =
        "Dashboard login is currently disabled.";
    } else {
      reasonCode =
        "DASHBOARD_ACTIVE";

      reason =
        "Student dashboard is active.";
    }

    return {
      success: true,

      message:
        reason,

      code:
        reasonCode,

      data: {
        studentId:
          status.studentId,

        paymentCompleted,

        operationsApproved,

        dashboardStatus:
          status.dashboardStatus,

        dashboardLoginEnabled,

        internshipActive,

        allowed,

        reasonCode,

        reason,
      },
    };
  } catch (error) {
    return handleInternshipError(
      "[InternshipService] getInternshipDashboardState",
      error,
    );
  }
}

/* ============================================================================
   PUBLIC PLAN CATALOG
============================================================================ */

export function getPublicInternshipPlans(): {
  plans: InternshipPlanDetails[];

  currency: string;

  pricingAuthoritative: true;
} {
  return {
    plans:
      getInternshipPlans(),

    currency:
      DEFAULT_CURRENCY,

    pricingAuthoritative:
      true,
  };
}

/* ============================================================================
   PAYMENT AMOUNT VERIFICATION
============================================================================ */

/**
 * Used by payment-related server code to compare
 * a database-selected plan against the official
 * plan catalog.
 *
 * This method DOES NOT update Student.
 * This method DOES NOT mark payment paid.
 */
export function verifySelectedPlanAmount(
  planCode: unknown,
  amount: unknown,
  currency: unknown,
): {
  valid: boolean;
  plan: InternshipPlanDetails | null;

  expectedAmount: number;
  receivedAmount: number;

  expectedCurrency: string;
  receivedCurrency: string;

  reasonCode: string;
  reason: string;
} {
  const plan =
    isValidInternshipPlan(
      planCode,
    )
      ? getInternshipPlan(
          String(planCode),
        )
      : null;

  const receivedAmount =
    numberValue(
      amount,
      -1,
    );

  const receivedCurrency =
    normalizeCurrency(
      currency,
    );

  if (!plan) {
    return {
      valid: false,

      plan: null,

      expectedAmount: 0,

      receivedAmount,

      expectedCurrency:
        DEFAULT_CURRENCY,

      receivedCurrency,

      reasonCode:
        "INVALID_INTERNSHIP_PLAN",

      reason:
        "The selected internship plan is invalid.",
    };
  }

  const amountMatches =
    receivedAmount ===
    plan.amount;

  const currencyMatches =
    receivedCurrency ===
    plan.currency;

  if (
    !amountMatches
  ) {
    return {
      valid: false,

      plan,

      expectedAmount:
        plan.amount,

      receivedAmount,

      expectedCurrency:
        plan.currency,

      receivedCurrency,

      reasonCode:
        "PRICE_MISMATCH",

      reason:
        "Payment amount does not match the official internship plan price.",
    };
  }

  if (
    !currencyMatches
  ) {
    return {
      valid: false,

      plan,

      expectedAmount:
        plan.amount,

      receivedAmount,

      expectedCurrency:
        plan.currency,

      receivedCurrency,

      reasonCode:
        "CURRENCY_MISMATCH",

      reason:
        "Payment currency does not match the official internship plan currency.",
    };
  }

  return {
    valid: true,

    plan,

    expectedAmount:
      plan.amount,

    receivedAmount,

    expectedCurrency:
      plan.currency,

    receivedCurrency,

    reasonCode:
      "PAYMENT_AMOUNT_VALID",

    reason:
      "Payment amount and currency match the official internship plan.",
  };
}

/* ============================================================================
   INTERNSHIP LIFECYCLE SUMMARY
============================================================================ */

export function getInternshipLifecycleState(
  status: Pick<
    InternshipStatus,
    | "internshipStatus"
    | "paymentStatus"
    | "studentOpsApprovalStatus"
    | "studentOpsStatus"
    | "dashboardStatus"
    | "dashboardLoginEnabled"
  >,
): {
  paymentVerified: boolean;
  operationsPending: boolean;
  operationsApproved: boolean;
  dashboardActive: boolean;
  internshipActive: boolean;
} {
  const paymentVerified =
    status.paymentStatus ===
    "paid";

  const operationsPending =
    paymentVerified &&
    status.studentOpsApprovalStatus ===
      "pending";

  const operationsApproved =
    paymentVerified &&
    status.studentOpsApprovalStatus ===
      "approved";

  const dashboardActive =
    operationsApproved &&
    DASHBOARD_ACTIVE_STATUSES.has(
      status.dashboardStatus,
    ) &&
    status.dashboardLoginEnabled;

  const internshipActive =
    status.internshipStatus ===
    "active";

  return {
    paymentVerified,

    operationsPending,

    operationsApproved,

    dashboardActive,

    internshipActive,
  };
}

/* ============================================================================
   ERROR HANDLER
============================================================================ */

function handleInternshipError<
  T = unknown,
>(
  context: string,
  error: unknown,
): ServiceResult<T> {
  console.error(
    context,
    error,
  );

  return {
    success: false,

    message:
      "Unable to process internship request right now. Please try again later.",

    code:
      "INTERNAL_SERVER_ERROR",
  };
}

/* ============================================================================
   DEFAULT EXPORT
============================================================================ */

const internshipService = {
  getInternshipPlans,

  getPublicInternshipPlans,

  getInternshipPlan,

  isValidInternshipPlan,

  validateInternshipPlanPricing,

  verifySelectedPlanAmount,

  getInternshipEligibility,

  selectInternship,

  getInternshipStatus,

  getInternshipSummary,

  getInternshipPaymentReadiness,

  getInternshipOperationsStatus,

  getInternshipDashboardState,

  getInternshipLifecycleState,
};

export default internshipService;